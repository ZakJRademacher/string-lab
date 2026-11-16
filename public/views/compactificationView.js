// compactificationView.js: draws the compactification tab, plus a mass chart.

import * as THREE from 'three';
import { dynamicTube } from '../scene.js';
import { stateAt, mass2Curve, SELF_DUAL_RADIUS } from '../physics/compactification.js';

const LENGTH = 6;      // length of the drawn cylinder (the "big" dimension)
const DRAW_SCALE = 0.42; // how big radius R looks on screen

export default {
  key: 'compactification',
  title: 'Rolled-up space',
  intro: 'Imagine space rolled up like a garden hose. A string can move around the hose, or wrap around it like a rubber band.',
  camera: [1.2, 3.2, 7.6],
  bloom: 0.35,
  labTitle: 'Compactification Explorer',
  labSub: 'A dimension curled into a circle',

  displayed(p) {
    return { title: `Closed string on a circle, R = ${p.R.toFixed(2)}`, badges: ['result', 'metaphor'],
      text: 'The masses in the readout and in Graphs are exact for the bosonic string on a circle (string units, α′ = 1). The tube and the glowing loop on it are an illustration, not to scale. The dashed ring marks the T-dual radius 1/R.' };
  },

  presets: [
    { label: 'Large circle, moving', sub: 'Momentum is cheap on a big circle', set: { R: 3, n: 1, w: 0, N: 1 } },
    { label: 'Tiny circle, wrapped', sub: 'Winding is cheap on a small circle', set: { R: 0.4, n: 0, w: 1, N: 1 } },
    { label: 'T-dual pair', sub: 'R = 2.5 moving equals R = 0.4 wrapped', set: { R: 2.5, n: 1, w: 0, N: 1 } },
    { label: 'Self-dual radius', sub: 'R = 1: extra massless states appear', set: { R: 1, n: 1, w: 1, N: 1 } },
  ],

  inspector() {
    return [
      { title: 'Circle', controls: [
        { type: 'range', key: 'R', label: 'Radius R', min: 0.25, max: 4, step: 0.01 },
        { type: 'buttons', buttons: [{ label: 'Jump to self-dual R = 1', set: { R: 1 } }, { label: 'Swap to T-dual twin', twin: true }] },
      ] },
      { title: 'String state', controls: [
        { type: 'range', key: 'n', label: 'Momentum number n', min: -3, max: 3, step: 1 },
        { type: 'range', key: 'w', label: 'Winding number w', min: -3, max: 3, step: 1 },
        { type: 'range', key: 'N', label: 'Left vibration level N', min: 0, max: 4, step: 1 },
      ] },
    ];
  },

  controls: [],

  create() {
    const group = new THREE.Group();
    group.rotation.x = 0.35;

    // The curled-up dimension: a glassy tube with a glowing coordinate grid.
    const cylMat = new THREE.MeshPhysicalMaterial({
      color: 0x3552c8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
      roughness: 0.15, metalness: 0, clearcoat: 1,
    });
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, LENGTH, 96, 1, true), cylMat);
    cylinder.rotation.z = Math.PI / 2;
    group.add(cylinder);

    const grid = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: 0x6f8fe0, transparent: true, opacity: 0.28 });
    for (let i = 0; i <= 12; i++) { // rings around the circle
      const pts = [];
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(-LENGTH / 2 + (i / 12) * LENGTH, Math.cos(a), Math.sin(a)));
      }
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let k = 0; k < 16; k++) { // lines along the big dimension
      const a = (k / 16) * Math.PI * 2;
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-LENGTH / 2, Math.cos(a), Math.sin(a)),
        new THREE.Vector3(LENGTH / 2, Math.cos(a), Math.sin(a)),
      ]), gridMat));
    }
    group.add(grid);

    // A dashed ring at the end shows the radius of the T-dual twin circle, 1/R.
    const dualPts = [];
    for (let k = 0; k <= 128; k++) {
      const a = (k / 128) * Math.PI * 2;
      dualPts.push(new THREE.Vector3(LENGTH / 2 + 0.02, Math.cos(a), Math.sin(a)));
    }
    const dualRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(dualPts),
      new THREE.LineDashedMaterial({ color: new THREE.Color(0.8, 0.6, 1.5), dashSize: 0.06, gapSize: 0.05, toneMapped: false }));
    dualRing.computeLineDistances();
    group.add(dualRing);

    const stringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.95, 1.4), toneMapped: false });
    // Made once, then only its points move (no per-frame garbage).
    const POINTS = 320;
    const pts = new Float32Array(POINTS * 3);
    const tube = dynamicTube(POINTS, 0.035, stringMat);
    group.add(tube.mesh);

    const chart = document.createElement('canvas');
    chart.className = 'chart';
    chart.setAttribute('role', 'img');
    let chartKey = '';
    const figure = document.createElement('figure');
    figure.className = 'chart-box wide';
    const caption = document.createElement('figcaption');
    caption.textContent = 'Mass² against radius R (log scale): this state (solid) and its T-dual twin (dashed)';
    figure.append(caption, chart);
    const graphsEl = document.createElement('div');
    graphsEl.className = 'graph-grid';
    graphsEl.append(figure);

    return {
      group,
      graphs: {
        el: graphsEl,
        render(p) {
          const key = `${p.R}:${p.n}:${p.w}:${p.N}:${chart.clientWidth}`;
          if (key !== chartKey) { chartKey = key; drawChart(chart, p); }
        },
      },
      onParams() { chartKey = ''; },
      update(p, t) {
        const r = Math.max(0.12, p.R * DRAW_SCALE);
        cylinder.scale.set(r, 1, r);
        grid.scale.set(1, r, r);
        const rd = Math.max(0.12, (1 / p.R) * DRAW_SCALE);
        dualRing.scale.set(1, rd, rd);

        // Illustration (not to scale): the string's path on the cylinder surface.
        const omega = (p.n / (p.R * p.R)) * 0.9; // more momentum → faster around the circle
        const theta0 = omega * t;
        const wiggles = Math.max(1, p.N + 1);
        for (let k = 0; k < POINTS; k++) {
          const s = (k / POINTS) * Math.PI * 2;
          let x;
          let theta;
          if (p.w !== 0) {
            theta = p.w * s + theta0;
            x = 0.35 * Math.sin(wiggles * s - 2.5 * t);
          } else {
            const rho = Math.min(0.55, r * 1.2);
            x = rho * Math.cos(s) * (1 + 0.15 * Math.sin(wiggles * s - 2.5 * t));
            theta = theta0 + ((rho / r) * Math.sin(s)) * 0.8;
          }
          pts[k * 3] = x;
          pts[k * 3 + 1] = r * 1.03 * Math.cos(theta);
          pts[k * 3 + 2] = r * 1.03 * Math.sin(theta);
        }
        tube.setPoints(pts, POINTS, true);
      },
      info(p) {
        const s = stateAt(p);
        if (!s.allowed) return { rows: [['State', 'Not allowed', 'bad']], note: s.reason };
        const f = (x) => (Math.abs(x) < 5e-4 ? '0' : x.toFixed(3));
        const massless = Math.abs(s.mass2) < 5e-3;
        return {
          rows: [
            ['Mass² total', `${f(s.mass2)}${massless ? ' (massless!)' : s.mass2 < 0 ? ' (tachyon)' : ''}`, massless ? 'ok' : ''],
            ['  from moving (n²/R²)', f(s.parts.momentum)],
            ['  from wrapping (w²R²)', f(s.parts.winding)],
            ['  from vibrating', f(s.parts.oscillators)],
            ['Right vibration level (Ñ)', String(s.Ntilde)],
            ['T-dual twin', `R = ${(1 / p.R).toFixed(3)}, n = ${p.w}, w = ${p.n}: same mass`],
          ],
          note: Math.abs(p.R - SELF_DUAL_RADIUS) < 0.02
            ? 'You are at the self-dual radius R = 1, where the circle equals its own T-dual. Extra massless particles appear here (try n = 1, w = 1, N = 1).'
            : 'Mass is shown in string units. Drag R toward 1, the "self-dual" radius, and watch the chart.',
        };
      },
    };
  },
};

// ─── The mass chart: M² against R (log scale), current state vs its T-dual twin ───
function drawChart(canvas, p) {
  const css = getComputedStyle(document.documentElement);
  const fg = css.getPropertyValue('--text').trim();
  const muted = css.getPropertyValue('--muted').trim();
  const accent = css.getPropertyValue('--chart-1').trim();
  const accent2 = css.getPropertyValue('--chart-3').trim(); // the twin is drawn in violet
  const grid = css.getPropertyValue('--line').trim();

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 280;
  const H = 190;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 34, r: 10, t: 24, b: 26 };
  const Rmin = 0.25;
  const Rmax = 4;
  const yMin = -4;
  const yMax = 12;
  const X = (R) => pad.l + (Math.log(R / Rmin) / Math.log(Rmax / Rmin)) * (W - pad.l - pad.r);
  const Y = (m) => pad.t + (1 - (Math.min(yMax, Math.max(yMin, m)) - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  ctx.font = '11px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = grid;
  ctx.fillStyle = muted;
  for (const m of [-4, 0, 4, 8, 12]) {
    ctx.beginPath(); ctx.moveTo(pad.l, Y(m)); ctx.lineTo(W - pad.r, Y(m)); ctx.stroke();
    ctx.fillText(String(m), 6, Y(m) + 4);
  }
  for (const R of [0.25, 0.5, 1, 2, 4]) ctx.fillText(String(R), X(R) - 8, H - 8);
  ctx.fillText('R →', W - pad.r - 24, H - 8);

  // Self-dual line at R = 1
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = muted;
  ctx.beginPath(); ctx.moveTo(X(1), pad.t); ctx.lineTo(X(1), H - pad.b); ctx.stroke();
  ctx.setLineDash([]);

  const curve = (pts, color, width, dash = []) => {
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach(([R, m], i) => (i ? ctx.lineTo(X(R), Y(m)) : ctx.moveTo(X(R), Y(m))));
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const twin = { n: p.w, w: p.n };
  curve(mass2Curve(twin.n, twin.w, p.N), accent2, 2, [6, 4]);
  curve(mass2Curve(p.n, p.w, p.N), accent, 2.5);

  const s = stateAt(p);
  if (s.allowed) {
    const dot = (R, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(R), Y(s.mass2), 4.5, 0, Math.PI * 2); ctx.fill(); };
    dot(p.R, accent);
    dot(1 / p.R, accent2);
  }
  ctx.fillStyle = fg;
  ctx.fillText(`M²  ·  solid: n=${p.n}, w=${p.w}  ·  dashed twin: n=${twin.n}, w=${twin.w}`, pad.l, 12);
  canvas.setAttribute('aria-label', `Mass squared against radius for n=${p.n}, w=${p.w}, and its T-dual twin`);
}
