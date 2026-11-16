// dimensionsView.js: the dimension explorer (0D to 9D).
// Edges use "fat lines" (a Three.js add-on) so they can be thicker than 1 pixel.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { beads } from '../scene.js';
import { chartBox, barPlot } from '../charts.js';
import { polytope, frame, faceCounts, shapeName, allPlanes, cubeSquares, binomial, eulerCharacteristic, MAX_DIM } from '../physics/dimensions.js';

// One colour per direction: x, y, z, then the hidden directions.
export const AXIS_COLORS = [0x5b8cff, 0x3ccf91, 0xb57bff, 0xff8a3d, 0xff4f7b, 0xffd23f, 0x4fe0d0, 0xff9ad5, 0xc6f04a];
const AXIS_NAMES = ['x', 'y', 'z', '4th', '5th', '6th', '7th', '8th', '9th'];
const FACE_NAMES = ['corners', 'edges', 'faces', '3D cells', '4D cells', '5D cells', '6D cells', '7D cells', '8D cells'];
const DEPTH_NEAR = new THREE.Color(0x45d9ff);
const DEPTH_FAR = new THREE.Color(0x9f6bff);
const WHITE = new THREE.Color(0xffffff);

export default {
  key: 'dimensions',
  title: 'Extra dimensions',
  labTitle: 'Dimension Explorer',
  labSub: 'Points, cubes, tesseracts and n-cubes',
  intro: 'We can\'t see a 4D shape, but we can see its shadow, just like a 3D cube casts a flat shadow on a wall. Orange, pink and yellow edges point into directions we can\'t see.',
  camera: [3.4, 2.4, 4.6],
  bloom: 0.7,


  displayed(p) {
    const name = shapeName(p.shape, p.dim);
    const { vertices } = polytope(p.shape, p.dim);
    const title = `${p.dim}D — ${name}`;
    if (p.dim <= 3) {
      return { title, badges: ['result'], text: `The ${p.dim}-dimensional ${p.shape === 'cube' ? 'cube' : 'cross-polytope'} drawn directly in 3D space. No projection needed.` };
    }
    return { title, badges: ['result'],
      text: `A 3D shadow of the ${name}: its ${vertices.length} corners are rotated in ${p.dim}D, then ${p.projection === 'perspective' ? (p.dim === 4 ? 'perspective-projected to 3D with the depth factor d / (d − w)' : 'perspective-projected to 3D with one combined depth factor d / (d − w), where w averages the hidden axes') : 'flattened to 3D by dropping the hidden axes'}. Apparent self-crossings and size changes are effects of the projection, not of the shape.` };
  },

  presets: [
    { label: 'Tesseract — double rotation', sub: 'Spins in the XW and YZ planes at once', set: { dim: 4, shape: 'cube', spin: 'XW,YZ', projection: 'perspective' } },
    { label: 'Tesseract — single rotation', sub: 'Turns only through the 4th dimension', set: { dim: 4, shape: 'cube', spin: 'XW', projection: 'perspective' } },
    { label: '16-cell', sub: 'The 4D cousin of the octahedron', set: { dim: 4, shape: 'cross', spin: 'XW,YZ', projection: 'perspective' } },
    { label: 'Penteract (5D)', sub: '32 corners, 80 edges', set: { dim: 5, shape: 'cube', spin: 'auto', projection: 'perspective' } },
    { label: '9-cube', sub: 'Superstring theory\'s 9 space dimensions', set: { dim: 9, shape: 'cube', spin: 'auto', projection: 'perspective' } },
  ],

  inspector(p, ui) {
    const counts = faceCounts(p.shape, p.dim);
    const planes = allPlanes(p.dim);
    const spinning = new Set(p.spin === 'auto' ? [] : p.spin.split(',').filter(Boolean));
    const sel = planes.some((pl) => pl.code === ui.dimPlane) ? ui.dimPlane : planes[0]?.code;
    const angle = ui.dimAngles?.[sel] ?? 0;
    const sections = [{
      title: 'Dimension',
      controls: [
        { type: 'choices', label: '', compact: true, options: Array.from({ length: MAX_DIM + 1 }, (_, d) => ({ label: `${d}D`, set: { dim: d } })) },
        { type: 'note', text: 'Superstring theories use 9 space dimensions + 1 of time.' },
        { type: 'choices', label: 'Shape', options: [{ label: 'Hypercube', set: { shape: 'cube' } }, { label: 'Cross-polytope', set: { shape: 'cross' } }] },
        { type: 'choices', label: 'Projection', options: [{ label: 'Perspective', set: { projection: 'perspective' } }, { label: 'Flat shadow', set: { projection: 'orthographic' } }] },
        { type: 'readout', rows: [
          ['Vertices', counts[0].toLocaleString()],
          ['Edges', (counts[1] ?? 0).toLocaleString()],
          ['Square faces', p.shape === 'cube' ? (counts[2] ?? 0).toLocaleString() : '—'],
          ['Rotation planes n(n−1)/2', String(binomial(p.dim, 2))],
        ] },
      ],
    }];
    if (planes.length) {
      sections.push({
        title: 'Rotation planes',
        controls: [
          { type: 'note', text: 'Pick a plane to set its angle. A dot marks planes that spin while playing.' },
          { type: 'planes', planes: planes.map((pl) => ({ code: pl.code, spinning: p.spin === 'auto' ? false : spinning.has(pl.code), selected: pl.code === sel })) },
          { type: 'ui-angle', plane: sel, label: `Angle θ in ${sel}`, value: angle },
          { type: 'toggle-plane', plane: sel, label: `Spin ${sel} continuously`, on: spinning.has(sel) },
          { type: 'buttons', buttons: [
            { label: 'Zero all angles', ui: { dimAngles: {} } },
            { label: 'Stop spins', set: { spin: '' } },
            { label: 'Auto spin', set: { spin: 'auto' } },
          ] },
        ],
      });
    }
    sections.push({
      title: 'Visualization',
      controls: [
        { type: 'ui-choices', ui: 'dimColor', label: 'Colour edges by', options: [['axis', 'Direction'], ['depth', 'Hidden depth']] },
        { type: 'ui-toggle', ui: 'dimFaces', label: 'Faces (cubes up to 6D)' },
      ],
    });
    return sections;
  },

  controls: [],

  create(ctx) {
    const group = new THREE.Group();
    let ui = {};
    let built = null;
    let dots = null;
    let lines = null;
    let faces = null;
    let edgePositions = null;
    let edgeColors = null;
    let frameOut;
    const c = new THREE.Color();
    const c2 = new THREE.Color();

    const keyOf = (p) => `${p.shape}:${p.dim}:${ui.dimColor}:${ui.dimFaces}`;

    function build(p) {
      for (const obj of [lines, faces, dots?.mesh]) if (obj) { group.remove(obj); obj.geometry.dispose(); obj.material.dispose(); }
      lines = null; faces = null;
      const shape = polytope(p.shape, p.dim);
      const many = shape.edges.length > 300;
      if (shape.edges.length) {
        const geo = new LineSegmentsGeometry();
        edgePositions = new Float32Array(shape.edges.length * 6);
        edgeColors = new Float32Array(shape.edges.length * 6);
        geo.setPositions(edgePositions);
        if (ui.dimColor !== 'depth') {
          shape.edges.forEach(([, , axis], i) => {
            c.setHex(AXIS_COLORS[axis]).multiplyScalar(axis >= 3 ? 1.35 : 1);
            edgeColors.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
          });
        }
        geo.setColors(edgeColors);
        lines = new LineSegments2(geo, new LineMaterial({
          vertexColors: true, linewidth: many ? 1.4 : 2.6, worldUnits: false, toneMapped: false,
          transparent: true, opacity: many ? 0.55 : 0.95, depthWrite: !many,
        }));
        lines.frustumCulled = false; // the shape moves every frame; don't recompute its bounds
        group.add(lines);
      }
      if (ui.dimFaces && p.shape === 'cube' && p.dim >= 2 && p.dim <= 6) {
        const squares = cubeSquares(p.dim);
        const fgeo = new THREE.BufferGeometry();
        fgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(squares.length * 4 * 3), 3));
        const index = [];
        squares.forEach((_, q) => { const b = q * 4; index.push(b, b + 1, b + 2, b, b + 2, b + 3); });
        fgeo.setIndex(index);
        faces = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({
          color: 0x4a7dff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        faces.userData.squares = squares;
        faces.frustumCulled = false;
        group.add(faces);
      }
      dots = beads(shape.vertices.length, many ? 0.045 : 0.07);
      group.add(dots.mesh);
      built = { key: keyOf(p), shape };
      group.scale.setScalar(0.5);
    }

    return {
      group,
      setVis(v) { ui = v; },
      onParams(p) { if (!built || built.key !== keyOf(p)) build(p); },
      update(p, t) {
        if (!built || built.key !== keyOf(p)) build(p);
        frameOut = frame(p, t, built.shape, ui.dimAngles ?? {}, frameOut); // reuses last frame's arrays
        const { positions, edges, depth } = frameOut;
        if (lines) {
          const depthColours = ui.dimColor === 'depth';
          for (let i = 0; i < edges.length; i++) {
            const a = edges[i][0] * 3;
            const b = edges[i][1] * 3;
            const o = i * 6;
            edgePositions[o] = positions[a]; edgePositions[o + 1] = positions[a + 1]; edgePositions[o + 2] = positions[a + 2];
            edgePositions[o + 3] = positions[b]; edgePositions[o + 4] = positions[b + 1]; edgePositions[o + 5] = positions[b + 2];
            if (depthColours) {
              c.copy(DEPTH_NEAR).lerp(DEPTH_FAR, (depth[edges[i][0]] + 1) / 2).multiplyScalar(1.3);
              c2.copy(DEPTH_NEAR).lerp(DEPTH_FAR, (depth[edges[i][1]] + 1) / 2).multiplyScalar(1.3);
              edgeColors[o] = c.r; edgeColors[o + 1] = c.g; edgeColors[o + 2] = c.b;
              edgeColors[o + 3] = c2.r; edgeColors[o + 4] = c2.g; edgeColors[o + 5] = c2.b;
            }
          }
          // The line geometry already uses these very arrays: just flag them as changed.
          lines.geometry.attributes.instanceStart.data.needsUpdate = true;
          if (depthColours) lines.geometry.attributes.instanceColorStart.data.needsUpdate = true;
          lines.material.resolution.copy(ctx.size);
        }
        if (faces) {
          const pos = faces.geometry.attributes.position.array;
          const squares = faces.userData.squares;
          for (let q = 0; q < squares.length; q++) {
            for (let k = 0; k < 4; k++) {
              const v = squares[q][k] * 3;
              const o = (q * 4 + k) * 3;
              pos[o] = positions[v]; pos[o + 1] = positions[v + 1]; pos[o + 2] = positions[v + 2];
            }
          }
          faces.geometry.attributes.position.needsUpdate = true;
        }
        for (let i = 0; i < positions.length / 3; i++) {
          c.copy(DEPTH_NEAR).lerp(DEPTH_FAR, (depth[i] + 1) / 2).lerp(WHITE, 0.55);
          dots.set(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], 1, c);
        }
        dots.commit();
      },
      info(p) {
        const counts = faceCounts(p.shape, p.dim);
        const rows = [['Dimensions', `${p.dim}`], ['Shape', shapeName(p.shape, p.dim)]];
        counts.forEach((n, k) => rows.push([FACE_NAMES[k][0].toUpperCase() + FACE_NAMES[k].slice(1), n.toLocaleString()]));
        if (p.dim >= 1) rows.push(['Euler check', `${eulerCharacteristic(p.shape, p.dim)} = 1 − (−1)^${p.dim} ✓`, 'ok']);
        const legend = ui.dimColor === 'depth'
          ? [{ label: 'near (hidden axes)', color: 0x45d9ff }, { label: 'far', color: 0x9f6bff }]
          : AXIS_NAMES.slice(0, p.dim).map((name, i) => ({ label: name, color: AXIS_COLORS[i] }));
        return {
          rows,
          legend,
          note: 'Superstring theory needs 10 dimensions: the 4 we know (3 of space plus time) and 6 more. If they exist, they are curled up far too small to see.',
        };
      },
      graphs: (() => {
        const bars = chartBox('Pieces of the shape, by dimension (log scale)', { wide: true });
        const el = document.createElement('div');
        el.className = 'graph-grid';
        el.append(bars.el);
        return {
          el,
          render(p) {
            const counts = faceCounts(p.shape, p.dim);
            barPlot(bars.canvas, counts.map((n) => Math.log10(n + 1)), {
              labels: counts.map((_, k) => `${k}D`),
              valueLabels: counts.map((n) => n.toLocaleString()),
            });
          },
        };
      })(),
    };
  },
};
