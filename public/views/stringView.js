// stringView.js: the string vibration lab.
//
// Every "view" file describes one module of the lab:
//   title / intro       names and a plain-English description
//   (Simple mode has no controls of its own: the tour sets every picture up.)
//   displayed(p)        the info card: what is on screen, and how honest a picture it is
//   presets             one-click setups for the Advanced sidebar
//   inspector(p, ui)    the Advanced settings panel, in sections
//   create(ctx)         builds the 3D scene; returns update(), info(), graphs, setVis()
//
// Three kinds of string live here:
//   relativistic  an exact solution of the real (classical) relativistic string
//   open / closed a classical string with harmonics, like a guitar: an educational analogy

import * as THREE from 'three';
import { beads, dynamicTube } from '../scene.js';
import { chartBox, linePlot, barPlot } from '../charts.js';
import {
  stringState, constraintError, closedStringLevel, classicalDisplacement, modeSpectrum,
  classicalPhysics, parseHarmonics, formatHarmonics, HARMONICS,
} from '../physics/string.js';

const SAMPLES = 240;
const ROWS = 48;          // how many past moments the worldsheet remembers
const ROW_EVERY = 0.045;  // time between remembered moments
const GHOSTS = 14;        // faint past positions of the classical string

// Speed colour scale: deep blue (slow) → violet → orange → warm white (light speed).
const SPEED_STOPS = [
  [0.0, new THREE.Color(0x2f6bff)],
  [0.55, new THREE.Color(0x9b5cff)],
  [0.85, new THREE.Color(0xff7a3d)],
  [1.0, new THREE.Color(0xffe2b8)],
];
function speedColor(s, out) {
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    const [b, cb] = SPEED_STOPS[i];
    if (s <= b) {
      const [a, ca] = SPEED_STOPS[i - 1];
      return out.copy(ca).lerp(cb, (s - a) / (b - a));
    }
  }
  return out.copy(SPEED_STOPS[SPEED_STOPS.length - 1][1]);
}

const pluck = () => formatHarmonics(Array.from({ length: HARMONICS }, (_, k) => Math.abs(Math.sin(((k + 1) * Math.PI) / 5)) / (k + 1) ** 2 / 0.588));
const solo = (n) => formatHarmonics(Array.from({ length: HARMONICS }, (_, k) => (k + 1 === n ? 1 : 0)));

export default {
  key: 'string',
  title: 'Strings',
  labTitle: 'String Vibration Lab',
  labSub: 'Relativistic loops, standing and travelling waves',
  intro: 'A tiny string. Like a guitar string, it can vibrate in different ways, and string theory says each way would be a different particle. Strings can also be closed loops.',
  camera: [2.4, 1.7, 3.2],
  bloom: 0.6,


  // ── Advanced (lab) mode ──
  displayed(p) {
    if (p.kind === 'open') {
      return { title: 'Classical string — fixed ends', badges: ['analogy'],
        text: 'An ideal classical string, y(x, t) = Σ Aₙ sin(nπx/L) cos(2πfₙt), slowed down enormously so you can watch it. Not a quantum string: it shows how harmonics add up.' };
    }
    if (p.kind === 'closed') {
      return { title: `Classical string — closed loop (${p.wave})`, badges: ['analogy'],
        text: 'An ideal classical loop with periodic boundary conditions; the sideways wobble is drawn exaggerated and slowed down. Not a quantum string.' };
    }
    return { title: `Relativistic closed string — ${p.family === 'burden' ? `Burden loop (m = ${p.m}, n = ${p.n})` : `Kibble–Turok loop (α = ${p.alpha.toFixed(2)})`}`, badges: ['result'],
      text: 'An exact solution of the relativistic string: x(σ, t) = ½[a(σ − t) + b(σ + t)] with |a′| = |b′| = 1, in string units. Colour is speed; warm white means light speed (a cusp). The glow behind is its worldsheet.' };
  },

  presets: [
    { label: 'Collapsing circle', sub: 'A loop that shrinks to a point and back', set: { kind: 'relativistic', family: 'burden', m: 1, n: 1, psi: 0, sheet: 'on' } },
    { label: 'Loop with cusps', sub: 'Points that touch light speed', set: { kind: 'relativistic', family: 'kibble-turok', alpha: 0.5, psi: 1, sheet: 'off' } },
    { label: 'Fundamental', sub: 'Only the n = 1 mode: one antinode', set: { kind: 'open', harmonics: solo(1) } },
    { label: 'Third harmonic', sub: 'Only n = 3: three antinodes', set: { kind: 'open', harmonics: solo(3) } },
    { label: 'Plucked string', sub: 'A guitar string plucked near one end', set: { kind: 'open', harmonics: pluck() } },
    { label: 'Closed loop — travelling', sub: 'Waves running around a loop', set: { kind: 'closed', wave: 'travelling', harmonics: '0,0.6,0,0.35,0,0,0,0' } },
    { label: 'Closed loop — standing', sub: 'A loop vibrating in place', set: { kind: 'closed', wave: 'standing', harmonics: '0,0.6,0.3,0,0,0,0,0' } },
  ],

  inspector(p, ui) {
    const sections = [{
      title: 'String type',
      controls: [{ type: 'choices', label: '', options: [
        { label: 'Relativistic loop', set: { kind: 'relativistic' } },
        { label: 'Open · fixed ends', set: { kind: 'open' } },
        { label: 'Closed · periodic', set: { kind: 'closed' } },
      ] }],
    }];
    if (p.kind === 'relativistic') {
      sections.push({
        title: 'Loop',
        controls: [
          { type: 'select', key: 'family', label: 'Family', options: [['burden', 'Burden loop'], ['kibble-turok', 'Kibble–Turok loop']] },
          ...(p.family === 'burden'
            ? [{ type: 'range', key: 'm', label: 'Left wave number m', min: 1, max: 6, step: 1 }, { type: 'range', key: 'n', label: 'Right wave number n', min: 1, max: 6, step: 1 }]
            : [{ type: 'range', key: 'alpha', label: 'Shape α', min: 0, max: 1, step: 0.01 }]),
          { type: 'range', key: 'psi', label: 'Tilt between waves ψ', min: 0, max: Math.PI, step: 0.01, unit: 'rad' },
          { type: 'toggle', key: 'sheet', label: 'Worldsheet', on: 'on', off: 'off' },
        ],
      }, {
        title: 'Quantum levels',
        controls: [
          { type: 'range', key: 'N', label: 'Left level N', min: 0, max: 6, step: 1 },
          { type: 'range', key: 'Ntilde', label: 'Right level Ñ', min: 0, max: 6, step: 1 },
        ],
      });
      return sections;
    }
    const amps = parseHarmonics(p.harmonics);
    const sel = ui.stringSelected ?? 0;
    const setAmp = (k, a) => { const next = amps.slice(); next[k] = a; return { harmonics: formatHarmonics(next) }; };
    if (p.kind === 'closed') {
      sections.push({ title: 'Motion', controls: [{ type: 'choices', label: '', options: [
        { label: 'Standing', set: { wave: 'standing' } },
        { label: 'Travelling', set: { wave: 'travelling' } },
      ] }] });
    }
    sections.push({
      title: 'Harmonics',
      controls: [
        { type: 'mixer', values: amps, selected: sel, setSelected: 'stringSelected', setValue: setAmp },
        { type: 'ui-range', ui: 'stringSelected', label: 'Harmonic number n', min: 0, max: HARMONICS - 1, step: 1, format: (v) => String(v + 1) },
        { type: 'value-range', label: `Amplitude A${sel + 1}`, value: amps[sel], min: 0, max: 1, step: 0.01, set: (v) => setAmp(sel, v) },
        { type: 'ui-toggle', ui: 'stringSolo', label: 'Solo selected harmonic' },
      ],
    });
    const phys = classicalPhysics(p);
    sections.push({
      title: 'Classical string model',
      controls: [
        { type: 'range', key: 'f1', label: 'Fundamental frequency f₁', min: 20, max: 880, step: 1, unit: 'Hz' },
        { type: 'range', key: 'tension', label: 'Tension T', min: 10, max: 1000, step: 1, unit: 'N' },
        { type: 'readout', rows: [
          ['Length L', `${phys.length.toFixed(3)} m`],
          ['Wave speed v', `${phys.waveSpeed.toFixed(1)} m/s`],
          ['Mass per metre μ = T / v²', `${(phys.massPerMetre * 1000).toFixed(2)} g/m`],
          [`Selected harmonic f${sel + 1}`, `${phys.frequencies[sel].toFixed(0)} Hz`],
        ] },
      ],
    });
    return sections;
  },

  controls: [], // (older layout; the inspector above replaced it)

  create() {
    const group = new THREE.Group();
    let ui = {};

    // ── Relativistic loop ──
    const rel = new THREE.Group();
    rel.scale.setScalar(1.6);
    group.add(rel);
    const dots = beads(SAMPLES, 0.02);
    rel.add(dots.mesh);
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SAMPLES + 1) * 3), 3));
    coreGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((SAMPLES + 1) * 3), 3));
    rel.add(new THREE.Line(coreGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, toneMapped: false,
    })));

    // The worldsheet: a surface stitched between remembered positions of the string.
    const sheetGeo = new THREE.BufferGeometry();
    sheetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROWS * SAMPLES * 3), 3));
    sheetGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ROWS * SAMPLES * 3), 3));
    const idx = [];
    for (let r = 0; r < ROWS - 1; r++) {
      for (let i = 0; i < SAMPLES; i++) {
        const a = r * SAMPLES + i;
        const b = r * SAMPLES + ((i + 1) % SAMPLES);
        idx.push(a, a + SAMPLES, b, b, a + SAMPLES, b + SAMPLES);
      }
    }
    sheetGeo.setIndex(idx);
    sheetGeo.setDrawRange(0, 0);
    const sheet = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.65, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    sheet.frustumCulled = false; // it changes constantly; skip recomputing its bounds
    rel.add(sheet);
    const rows = [];
    let frameState; // reused every frame by stringState()
    let sinceRow = 0;
    let maxSpeed = 0;
    const color = new THREE.Color();
    const sheetTint = new THREE.Color(0x4a6bff);
    const sheetTintNew = new THREE.Color(0x8f7bff);

    function rebuildSheet() {
      const pos = sheetGeo.attributes.position.array;
      const col = sheetGeo.attributes.color.array;
      for (let r = 0; r < rows.length; r++) {
        pos.set(rows[r], r * SAMPLES * 3);
        const age = rows.length > 1 ? r / (rows.length - 1) : 1;
        color.copy(sheetTint).lerp(sheetTintNew, age).multiplyScalar(0.02 + 0.3 * age * age * age);
        for (let i = 0, o = r * SAMPLES * 3; i < SAMPLES; i++, o += 3) {
          col[o] = color.r; col[o + 1] = color.g; col[o + 2] = color.b;
        }
      }
      sheetGeo.attributes.position.needsUpdate = true;
      sheetGeo.attributes.color.needsUpdate = true;
      sheetGeo.setDrawRange(0, Math.max(0, rows.length - 1) * SAMPLES * 6);
    }

    // ── Classical string ──
    const cls = new THREE.Group();
    group.add(cls);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5f86ff, emissive: 0x1a2a66, metalness: 0.4, roughness: 0.3 });
    const posts = [-1.6, 1.6].map((x) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.2), postMat);
      m.position.x = x;
      cls.add(m);
      return m;
    });
    const restGeo = new THREE.BufferGeometry();
    const rest = new THREE.Line(restGeo, new THREE.LineDashedMaterial({ color: 0x7f93c8, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.55 }));
    cls.add(rest);
    // Everything below is created ONCE and only updated while animating (no per-frame garbage).
    const CLS_POINTS = 181;
    const clsPts = new Float32Array(CLS_POINTS * 3);
    const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.82, 1.35), toneMapped: false });
    const tube = dynamicTube(CLS_POINTS, 0.035, tubeMat);
    cls.add(tube.mesh);
    // Faint past positions: a fixed ring of lines, reused in turn.
    const ghosts = Array.from({ length: GHOSTS }, () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((CLS_POINTS + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setDrawRange(0, 0);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false;
      cls.add(line);
      return line;
    });
    let ghostNext = 0;
    let ghostCount = 0;
    let sinceGhost = 0;
    let restKind = '';
    let ampsKey = '';
    let amps = [];

    /** Fill clsPts with the string's current shape; returns how many points were written. */
    function classicalPoints(p, t) {
      const key = `${p.harmonics}|${ui.stringSolo}|${ui.stringSelected}`;
      if (key !== ampsKey) {
        ampsKey = key;
        amps = parseHarmonics(p.harmonics);
        if (ui.stringSolo) amps = amps.map((a, k) => (k === (ui.stringSelected ?? 0) ? a : 0));
      }
      const total = amps.reduce((s, a) => s + a, 0);
      const scale = 1 / Math.max(1, total);
      const open = p.kind === 'open';
      const count = open ? CLS_POINTS : CLS_POINTS - 1;
      for (let i = 0; i < count; i++) {
        const s = i / (CLS_POINTS - 1);
        const y = classicalDisplacement(p, s, t, amps) * scale;
        if (open) {
          clsPts[i * 3] = -1.6 + 3.2 * s; clsPts[i * 3 + 1] = 0.5 * y; clsPts[i * 3 + 2] = 0;
        } else {
          const r = 1.15 + 0.38 * y;
          clsPts[i * 3] = r * Math.cos(2 * Math.PI * s); clsPts[i * 3 + 1] = r * Math.sin(2 * Math.PI * s); clsPts[i * 3 + 2] = 0;
        }
      }
      return count;
    }

    function setRest(p) {
      if (restKind === p.kind) return;
      restKind = p.kind;
      const pts = [];
      if (p.kind === 'open') pts.push(new THREE.Vector3(-1.6, 0, 0), new THREE.Vector3(1.6, 0, 0));
      else for (let k = 0; k <= 128; k++) pts.push(new THREE.Vector3(1.15 * Math.cos((k / 128) * 2 * Math.PI), 1.15 * Math.sin((k / 128) * 2 * Math.PI), 0));
      restGeo.setFromPoints(pts);
      rest.computeLineDistances();
      posts.forEach((m) => { m.visible = p.kind === 'open'; });
      cls.rotation.x = p.kind === 'open' ? 0 : -0.35;
    }

    function clearGhosts() {
      for (const g of ghosts) { g.geometry.setDrawRange(0, 0); g.material.opacity = 0; }
      ghostNext = 0;
      ghostCount = 0;
    }

    // ── Graphs (Advanced mode, Graphs tab) ──
    const wave = chartBox('Waveform y(x, t): total and harmonics');
    const spectrum = chartBox('Spectrum: live projection onto modes');
    const speedChart = chartBox('Speed along the string |ẋ(σ)|, as a fraction of light speed', { wide: true });
    const graphsEl = document.createElement('div');
    graphsEl.className = 'graph-grid';

    return {
      group,
      setVis(v) { ui = v; },
      onParams(p) {
        rows.length = 0;
        rebuildSheet();
        clearGhosts();
        restKind = '';
      },
      update(p, t, dt) {
        const relativistic = p.kind === 'relativistic';
        rel.visible = relativistic;
        cls.visible = !relativistic;
        if (!relativistic) {
          setRest(p);
          const count = classicalPoints(p, t);
          const closed = p.kind !== 'open';
          tube.setPoints(clsPts, count, closed);
          sinceGhost += dt;
          if (dt > 0 && sinceGhost > 0.05) {
            sinceGhost = 0;
            // Copy the current shape into the oldest ghost line, then fade all by age.
            const g = ghosts[ghostNext];
            const arr = g.geometry.attributes.position.array;
            arr.set(clsPts.subarray(0, count * 3));
            if (closed) arr.set(clsPts.subarray(0, 3), count * 3);
            g.geometry.attributes.position.needsUpdate = true;
            g.geometry.setDrawRange(0, closed ? count + 1 : count);
            ghostNext = (ghostNext + 1) % GHOSTS;
            ghostCount = Math.min(GHOSTS, ghostCount + 1);
            for (let age = 0; age < ghostCount; age++) {
              const idx = (ghostNext - 1 - age + GHOSTS * 2) % GHOSTS;
              ghosts[idx].material.opacity = 0.25 - (0.22 * age) / GHOSTS;
            }
          }
          return;
        }

        frameState = stringState(p, t, SAMPLES, frameState);
        const { positions, speeds } = frameState;
        maxSpeed = 0;
        const corePos = coreGeo.attributes.position.array;
        const coreCol = coreGeo.attributes.color.array;
        for (let i = 0; i < SAMPLES; i++) {
          const s = speeds[i];
          maxSpeed = Math.max(maxSpeed, s);
          speedColor(s, color);
          dots.set(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], s > 0.995 ? 1.9 : 1, color);
          coreCol[i * 3] = color.r * 0.8; coreCol[i * 3 + 1] = color.g * 0.8; coreCol[i * 3 + 2] = color.b * 0.8;
        }
        dots.commit();
        corePos.set(positions);
        corePos.set(positions.subarray(0, 3), SAMPLES * 3);
        coreCol.set(coreCol.subarray(0, 3), SAMPLES * 3);
        coreGeo.attributes.position.needsUpdate = true;
        coreGeo.attributes.color.needsUpdate = true;

        sheet.visible = p.sheet === 'on';
        sinceRow += dt;
        if (dt > 0 && sinceRow > ROW_EVERY) {
          sinceRow = 0;
          // Reuse the oldest row's memory once the worldsheet is full.
          const row = rows.length >= ROWS ? rows.shift() : new Float32Array(SAMPLES * 3);
          row.set(positions);
          rows.push(row);
          if (sheet.visible) rebuildSheet();
        }
      },
      info(p, t) {
        if (p.kind !== 'relativistic') {
          const phys = classicalPhysics(p);
          const amps = parseHarmonics(p.harmonics);
          return {
            rows: [
              ['Harmonics playing', String(amps.filter((a) => a > 0).length)],
              ['Fundamental f₁', `${p.f1.toFixed(0)} Hz`],
              ['Wave speed', `${phys.waveSpeed.toFixed(1)} m/s`],
              ['Highest harmonic', `${phys.frequencies[amps.findLastIndex((a) => a > 0)]?.toFixed(0) ?? '—'} Hz`],
            ],
            note: 'A classical string is an analogy: real strings in string theory are quantum, relativistic and unimaginably small.',
            live: {},
          };
        }
        const err = constraintError(p, t);
        maxSpeed = Math.max(...stringState(p, t, SAMPLES).speeds); // fresh, even before the first frame
        const q = closedStringLevel(p.N, p.Ntilde);
        const rowsOut = [
          ['Physics check', err < 1e-5 ? `✓ valid (error ${err.toExponential(1)})` : `✗ error ${err.toExponential(1)}`, err < 1e-5 ? 'ok' : 'bad'],
          ['Fastest point', `${(maxSpeed * 100).toFixed(1)}% of light speed${maxSpeed > 0.995 ? ': cusp!' : ''}`, maxSpeed > 0.995 ? 'hot' : ''],
          ['Quantum state', q.label, q.allowed ? '' : 'bad'],
        ];
        if (q.allowed) {
          rowsOut.push(['Mass² (units of 1/α′)', String(q.mass2)]);
          rowsOut.push(['Number of states', q.states.toLocaleString()]);
        }
        return { rows: rowsOut, note: q.note, live: { constraintError: err, maxSpeed } };
      },
      graphs: {
        el: graphsEl,
        render(p, t) {
          if (p.kind === 'relativistic') {
            if (graphsEl.firstChild !== speedChart.el) graphsEl.replaceChildren(speedChart.el);
            const { speeds } = stringState(p, t, SAMPLES);
            const pts = Array.from(speeds, (s, i) => [(i / SAMPLES) * 2 * Math.PI, s]);
            linePlot(speedChart.canvas, [{ points: pts, width: 2.2 }], {
              xmin: 0, xmax: 2 * Math.PI, ymin: 0, ymax: 1.05, yTicks: [0, 0.5, 1], xLabel: 'σ →', guides: [{ y: 1, label: 'light speed' }],
            });
            return;
          }
          if (graphsEl.firstChild !== wave.el) graphsEl.replaceChildren(wave.el, spectrum.el);
          const amps = parseHarmonics(p.harmonics);
          const total = [];
          const parts = amps.map(() => []);
          for (let i = 0; i <= 200; i++) {
            const x = i / 200;
            total.push([x, classicalDisplacement(p, x, t, amps)]);
            amps.forEach((a, k) => {
              if (!a) return;
              const only = amps.map((_, j) => (j === k ? a : 0));
              parts[k].push([x, classicalDisplacement(p, x, t, only)]);
            });
          }
          const ymax = Math.max(1, amps.reduce((s, a) => s + a, 0));
          linePlot(wave.canvas, [
            ...parts.map((pts) => ({ points: pts, width: 1, alpha: 0.45, color: undefined })),
            { points: total, width: 2.4 },
          ], { xmin: 0, xmax: 1, ymin: -ymax, ymax, yTicks: [-ymax, 0, ymax], xLabel: p.kind === 'open' ? 'x / L →' : 'σ / 2π →' });
          barPlot(spectrum.canvas, modeSpectrum(p, t), { max: 1, ghost: amps, highlight: ui.stringSelected ?? 0 });
        },
      },
    };
  },
};
