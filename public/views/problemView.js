// problemView.js: draws "the problem" — why physics needs something like string theory.
//
// Three scenes, blended smoothly into each other:
//   small  quantum mechanics: a particle as a shimmering cloud of possible places
//   large  gravity: a heavy star bends a grid of space; a moon rolls around the dip
//   clash  a black hole: the dip becomes a bottomless funnel, and the quantum cloud
//          squeezed into its throat glitches — the two theories give nonsense together
// It appears only in the guided tour (not in the Advanced lab). An illustration, not to scale.

import * as THREE from 'three';

const LINES = 41;        // grid lines in each direction
const SEG = 72;          // segments per grid line
const SPAN = 7;          // width of the grid
const GRID_Y = -0.7;     // height of flat space
const CLOUD = 3000;      // points in the quantum cloud

export default {
  key: 'problem',
  title: 'The problem',
  intro: 'Two great theories: one for the very small, one for gravity. Each works perfectly on its own, but inside a black hole they clash.',
  camera: [0, 4.4, 6.2],
  bloom: 0.55,

  controls: [],

  create() {
    const group = new THREE.Group();

    // ── Space: a grid whose height we rewrite every frame (made once, no per-frame garbage) ──
    const verts = LINES * 2 * SEG * 2;
    const base = new Float32Array(verts * 2);   // x, z of every vertex
    const gridPos = new Float32Array(verts * 3);
    let v = 0;
    const put = (x, z) => { base[v * 2] = x; base[v * 2 + 1] = z; v++; };
    for (let i = 0; i < LINES; i++) {
      const fixed = -SPAN / 2 + (i / (LINES - 1)) * SPAN;
      for (let k = 0; k < SEG; k++) {
        const a = -SPAN / 2 + (k / SEG) * SPAN;
        const b = -SPAN / 2 + ((k + 1) / SEG) * SPAN;
        put(a, fixed); put(b, fixed);   // a line along x
        put(fixed, a); put(fixed, b);   // a line along z
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.BufferAttribute(gridPos, 3));
    const gridMat = new THREE.LineBasicMaterial({ color: 0x4b8dff, transparent: true, opacity: 0.3 });
    const grid = new THREE.LineSegments(gridGeo, gridMat);
    grid.frustumCulled = false;
    group.add(grid);

    // ── Gravity: a star in the dip, and a moon rolling around it ──
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0xbfd6ff, emissive: 0x5a86ff, emissiveIntensity: 0.9, roughness: 0.4 }));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xd9d9e6, roughness: 0.6 }));
    group.add(star, moon);

    // ── The black hole: a black ball with a glowing ring of hot gas ──
    const hole = new THREE.Group();
    hole.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 40, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 12, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.75, 0.3), toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    hole.add(ring);
    group.add(hole);

    // ── Quantum: a cloud of points, shaped like an electron orbital, always shimmering ──
    const cloudBase = new Float32Array(CLOUD * 3);
    for (let i = 0; i < CLOUD; i++) {
      // Distance from the centre: mostly close, sometimes far (a fuzzy edge, no hard surface).
      const r = 0.42 * -Math.log(Math.max(1e-6, Math.random() * Math.random()));
      let x; let y; let z;
      do { // a random direction, favouring two lobes (like a "p" orbital) for 60% of points
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        x = s * Math.cos(th); y = u; z = s * Math.sin(th);
      } while (i % 5 < 3 && Math.random() > y * y);
      cloudBase.set([x * r, y * r, z * r], i * 3);
    }
    const cloudPos = new Float32Array(CLOUD * 3);
    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
    const cloudMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.9, 0.65, 1.6), size: 0.07, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const cloud = new THREE.Points(cloudGeo, cloudMat);
    cloud.frustumCulled = false;
    group.add(cloud);

    // How much of each scene is showing (0 to 1). They ease toward the chosen one.
    const w = { small: 1, large: 0, clash: 0 };
    let last = performance.now();
    let started = false;
    // The dip in space, set fresh each frame (kept outside update so no new function is made per frame).
    let depth = 0;
    let width = 1;
    const dip = (r) => -depth * (width / Math.sqrt(r * r + width * width));

    return {
      group,
      update(p, t) {
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        // Ease between scenes when you switch, but start straight on the chosen one.
        const k = started ? 1 - Math.exp(-dt * 3) : 1;
        started = true;
        w.small += ((p.focus === 'small' ? 1 : 0) - w.small) * k;
        w.large += ((p.focus === 'large' ? 1 : 0) - w.large) * k;
        w.clash += ((p.focus === 'clash' ? 1 : 0) - w.clash) * k;

        // Shape of space: a dip of a given depth and width. A black hole is deep and narrow.
        const depthLarge = 1.3 + 0.4 * Math.log(p.mass);
        depth = w.large * depthLarge + w.clash * 3.4;
        width = (w.small * 1 + w.large * 1.4 + w.clash * 0.4) / (w.small + w.large + w.clash);
        const glitch = w.clash * 0.25;
        const edge = dip(SPAN / 2);
        for (let i = 0; i < verts; i++) {
          const x = base[i * 2];
          const z = base[i * 2 + 1];
          const r = Math.sqrt(x * x + z * z);
          let y = GRID_Y + dip(r) - edge;
          if (glitch > 0.01 && r < 1.4) y += (Math.random() - 0.5) * glitch * (1.4 - r); // the maths breaking down
          gridPos[i * 3] = x; gridPos[i * 3 + 1] = y; gridPos[i * 3 + 2] = z;
        }
        gridGeo.attributes.position.needsUpdate = true;
        // Space only appears with gravity: the quantum scene is just the cloud.
        gridMat.opacity = 0.68 * (w.large + w.clash);
        grid.visible = gridMat.opacity > 0.01;

        // The star sits in the dip; the moon circles it, following the curve of space.
        const bottom = GRID_Y + dip(0) - edge;
        star.scale.setScalar(Math.max(0.001, w.large * (0.65 + 0.1 * Math.log(p.mass))));
        star.position.set(0, bottom + 0.4 * w.large, 0);
        const orbit = 2.2;
        const angle = t * 0.9;
        moon.scale.setScalar(Math.max(0.001, w.large));
        moon.position.set(orbit * Math.cos(angle), GRID_Y + dip(orbit) - edge + 0.12, orbit * Math.sin(angle));

        hole.scale.setScalar(Math.max(0.001, w.clash));
        hole.position.set(0, GRID_Y + dip(0.5) - edge, 0); // the ring of hot gas sits inside the throat
        ring.rotation.z = t * 0.8;

        // The quantum cloud: big and gently shimmering on its own, crushed and frantic in a black hole.
        const scale = w.small * 1 + w.clash * 0.2;
        const cy = w.small * 0.35 + w.clash * (GRID_Y - 1.6);
        const jitter = w.small * 0.035 + w.clash * 0.4;
        for (let i = 0; i < CLOUD; i++) {
          cloudPos[i * 3] = cloudBase[i * 3] * scale + (Math.random() - 0.5) * jitter;
          cloudPos[i * 3 + 1] = cy + cloudBase[i * 3 + 1] * scale + (Math.random() - 0.5) * jitter;
          cloudPos[i * 3 + 2] = cloudBase[i * 3 + 2] * scale + (Math.random() - 0.5) * jitter;
        }
        cloudGeo.attributes.position.needsUpdate = true;
        cloudMat.opacity = Math.min(1, w.small + 0.6 * w.clash);
        cloudMat.size = 0.07 * w.small + 0.025 * w.clash; // crushed: finer grains, so the funnel shows through
        cloud.visible = cloudMat.opacity > 0.01;
      },
      info() { return { rows: [] }; }, // told only in the tour, so no lab readout
    };
  },
};
