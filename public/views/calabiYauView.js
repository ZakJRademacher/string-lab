// calabiYauView.js: Calabi–Yau geometry.
// Two looks: "glossy" (a clear-coated, iridescent surface coloured by patch) and
// "hologram" (a glowing translucent wireframe, coloured by height).

import * as THREE from 'three';
import { surface, genus } from '../physics/calabiYau.js';
import { chartBox, barPlot, texBlock } from '../charts.js';

const HOLO_LOW = new THREE.Color(0x45d9ff);
const HOLO_HIGH = new THREE.Color(0xa070ff);

export default {
  key: 'calabiYau',
  title: 'Hidden shapes',
  labTitle: 'Calabi–Yau Geometry',
  labSub: 'Slices and analogies of compact spaces',
  intro: 'If extra dimensions exist, they could be curled up into tiny shapes like this one, called Calabi–Yau shapes. What you see is a slice of one.',
  camera: [3.4, 2.2, 4.4],
  bloom: 0.12,

  displayed(p) {
    if (p.n === 3) {
      return { title: 'Fermat curve of degree 3', badges: ['result'],
        text: 'The complex curve z₁³ + z₂³ = 1, projected from 4 real dimensions to 3. Closed up, it is an elliptic curve: a genuine (1-dimensional) Calabi–Yau, shaped like a doughnut.' };
    }
    return { title: `Fermat curve of degree ${p.n}`, badges: ['result', 'analogy'],
      text: `The complex curve z₁${sup(p.n)} + z₂${sup(p.n)} = 1, computed exactly and projected from 4 real dimensions to 3. Only degree 3 is a true Calabi–Yau; this one${p.n === 5 ? ', the famous quintic slice,' : ''} is a picture-friendly analogy for the 6-dimensional shapes string theory uses.` };
  },

  presets: [
    { label: 'Elliptic curve', sub: 'Degree 3: a true 1D Calabi–Yau (a torus)', set: { n: 3, alpha: 0.785 } },
    { label: 'Fermat quartic curve', sub: 'Degree 4: 3 holes', set: { n: 4, alpha: 0.785 } },
    { label: 'Quintic slice', sub: 'The famous picture: degree 5, 6 holes', set: { n: 5, alpha: 0.785 } },
    { label: 'Degree 6', sub: '36 patches, 10 holes', set: { n: 6, alpha: 1.2 } },
  ],

  inspector() {
    return [
      {
        title: 'Model parameters',
        controls: [
          { type: 'range', key: 'n', label: 'Degree n', min: 2, max: 6, step: 1 },
          { type: 'range', key: 'alpha', label: 'Projection angle α', min: 0, max: Math.PI, step: 0.01, unit: 'rad' },
          { type: 'ui-range', ui: 'cyRes', label: 'Mesh resolution', min: 8, max: 48, step: 1 },
        ],
      },
      {
        title: 'Visualization',
        controls: [
          { type: 'ui-choices', ui: 'cyLook', label: 'Look', options: [['glossy', 'Glossy'], ['hologram', 'Hologram']] },
          { type: 'ui-toggle', ui: 'cySurface', label: 'Surface' },
          { type: 'ui-toggle', ui: 'cyWire', label: 'Wireframe overlay' },
          { type: 'ui-range', ui: 'cyOpacity', label: 'Opacity', min: 0.1, max: 1, step: 0.05 },
        ],
      },
    ];
  },

  controls: [],

  create() {
    const group = new THREE.Group();
    group.scale.setScalar(0.85);
    let ui = {};
    let mesh = null;
    let wire = null;
    let builtKey = '';
    let lastCheck = 0;
    let stats = { vertices: 0, triangles: 0 };

    const keyOf = (p) => `${p.n}:${p.alpha}:${ui.cyRes}:${ui.cyLook}:${ui.cySurface}:${ui.cyWire}:${ui.cyOpacity}`;

    function build(p) {
      for (const m of [mesh, wire]) if (m) { group.remove(m); m.material.dispose(); }
      (mesh ?? wire)?.geometry.dispose(); // both share one geometry
      mesh = null; wire = null;
      const res = ui.cyRes ?? 30;
      const s = surface(p, res);
      lastCheck = s.maxError;
      stats = { vertices: s.positions.length / 3, triangles: s.indices.length / 3 };
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
      geo.setIndex(new THREE.BufferAttribute(s.indices, 1));
      const hologram = ui.cyLook === 'hologram';
      const colors = new Float32Array(s.patch.length * 3);
      const c = new THREE.Color();
      let ymin = Infinity;
      let ymax = -Infinity;
      for (let i = 1; i < s.positions.length; i += 3) { ymin = Math.min(ymin, s.positions[i]); ymax = Math.max(ymax, s.positions[i]); }
      for (let i = 0; i < s.patch.length; i++) {
        if (hologram) c.copy(HOLO_LOW).lerp(HOLO_HIGH, (s.positions[i * 3 + 1] - ymin) / (ymax - ymin || 1));
        else c.setHSL(0.47 + (s.patch[i] / s.patches) * 0.5, 0.7, 0.42);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const opacity = ui.cyOpacity ?? 1;
      if (ui.cySurface !== false) {
        mesh = new THREE.Mesh(geo, hologram
          ? new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.13 * opacity, side: THREE.DoubleSide,
            depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
          })
          : new THREE.MeshPhysicalMaterial({
            vertexColors: true, side: THREE.DoubleSide, roughness: 0.42, metalness: 0.05,
            clearcoat: 0.45, clearcoatRoughness: 0.3, iridescence: 0.35, iridescenceIOR: 1.3,
            envMapIntensity: 0.45, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
          }));
        group.add(mesh);
      }
      if (ui.cyWire !== false) {
        wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          vertexColors: hologram, color: hologram ? 0xffffff : 0xbfd0ff, wireframe: true, transparent: true,
          opacity: (hologram ? 0.32 : 0.07) * opacity, depthWrite: false,
          blending: hologram ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !hologram,
        }));
        group.add(wire);
      }
      if (!mesh && !wire) geo.dispose();
      builtKey = keyOf(p);
    }

    // Graphs: the Hodge diamond of the real (6D) quintic, and holes by degree.
    const holes = chartBox('Holes (genus) of the closed curve, by degree n');
    const graphsEl = document.createElement('div');
    graphsEl.className = 'graph-grid';
    graphsEl.append(
      texBlock('Hodge diamond of the quintic threefold',
        String.raw`\begin{array}{ccccccc} &&&1&&&\\ &&0&&0&&\\ &0&&1&&0&\\ 1&&101&&101&&1\\ &0&&1&&0&\\ &&0&&0&&\\ &&&1&&& \end{array}\qquad \begin{aligned} h^{1,1}&=1\ \ \text{(one size parameter)}\\ h^{2,1}&=101\ \ \text{(101 shape parameters)}\\ \chi&=2(h^{1,1}-h^{2,1})=-200\end{aligned}`,
        'Mathematical result for the real 6-dimensional quintic (not the 2D slice on screen). These numbers count its independent ways to change size and shape.').el,
      holes.el,
    );

    return {
      group,
      setVis(v) { ui = v; },
      onParams(p) { if (builtKey !== keyOf(p)) build(p); },
      update(p, _t, dt) {
        if (builtKey !== keyOf(p)) build(p);
        group.rotation.y += dt * 0.4; // dt already includes the speed setting
      },
      info(p) {
        const g = genus(p.n);
        return {
          rows: [
            ['Equation', `z₁${sup(p.n)} + z₂${sup(p.n)} = 1`],
            ['Patches', `${p.n * p.n} (n × n)`],
            ['Holes in the closed surface', `${g} ${g === 0 ? '(a sphere)' : g === 1 ? '(a doughnut)' : ''}`.trim()],
            ['Math check', lastCheck < 1e-9 ? `✓ every point solves it (error ${lastCheck.toExponential(1)})` : `✗ error ${lastCheck.toExponential(1)}`, lastCheck < 1e-9 ? 'ok' : 'bad'],
            ['Mesh', `${stats.vertices.toLocaleString()} vertices, ${stats.triangles.toLocaleString()} triangles`],
            ['Real dimensions shown', '2 of 6'],
          ],
          note: p.n === 5
            ? 'n = 5 is a slice of the "quintic", the most famous Calabi–Yau example.'
            : 'Set n = 5 to see a slice of the famous "quintic" Calabi–Yau.',
          live: { maxError: lastCheck },
        };
      },
      graphs: {
        el: graphsEl,
        render(p) {
          barPlot(holes.canvas, [2, 3, 4, 5, 6].map(genus), {
            max: 10, labels: ['n=2', '3', '4', '5', '6'], valueLabels: [2, 3, 4, 5, 6].map((n) => String(genus(n))), highlight: p.n - 2,
          });
        },
      },
    };
  },
};

function sup(n) {
  return String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
}
