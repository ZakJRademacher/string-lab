// Tests for the laboratory features: 0D–9D shapes, rotation planes, the classical
// string with harmonics, presets, honesty badges and the inspector panels.
// (The rotation-plane validation test covers what the removed AI tutor used to check.)

import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import * as dims from '../public/physics/dimensions.js';
import * as str from '../public/physics/string.js';
import { defaultLabState, MODULES, LAB_TABS, validateLabState } from '../public/physics/index.js';
import { checkFields } from '../public/physics/validate.js';
import { formulas } from '../public/formulas.js';
import stringView from '../public/views/stringView.js';
import dimensionsView from '../public/views/dimensionsView.js';
import calabiYauView from '../public/views/calabiYauView.js';
import compactificationView from '../public/views/compactificationView.js';
import problemView from '../public/views/problemView.js';

const VIEWS = { string: stringView, dimensions: dimensionsView, calabiYau: calabiYauView, compactification: compactificationView, problem: problemView };
const UI = { dimPlane: 'XW', dimAngles: {}, stringSelected: 2, cyRes: 30 };

// ─── 0D to 9D ─────────────────────────────────────────────────────────────

test('n-cubes from 0D to 9D have the right numbers of corners and edges', () => {
  for (let n = 0; n <= 9; n++) {
    const { vertices, edges } = dims.polytope('cube', n);
    assert.equal(vertices.length, 2 ** n);
    assert.equal(edges.length, n === 0 ? 0 : n * 2 ** (n - 1));
  }
  assert.deepEqual(dims.faceCounts('cube', 9), [512, 2304, 4608, 5376, 4032, 2016, 672, 144, 18]);
});

test('projection never "explodes", even for a spinning 9-cube', () => {
  for (const shape of ['cube', 'cross']) {
    for (let n = 0; n <= 9; n++) {
      const sh = dims.polytope(shape, n);
      for (const t of [0, 0.7, 1.9, 3.3, 5.1, 8.2, 13.7, 21.4]) {
        const { positions } = dims.frame({ dim: n, shape, projection: 'perspective', spin: 'auto' }, t, sh);
        for (const v of positions) assert.ok(Number.isFinite(v) && Math.abs(v) < 4, `${shape} ${n}D at t=${t}: ${v}`);
      }
    }
  }
});

test('there are n(n−1)/2 rotation planes, named by axis pairs', () => {
  assert.equal(dims.allPlanes(4).length, 6);
  assert.equal(dims.allPlanes(9).length, 36);
  assert.deepEqual(dims.allPlanes(4).map((p) => p.code), ['XY', 'XZ', 'XW', 'YZ', 'YW', 'ZW']);
});

test('chosen spin planes rotate, and rotation keeps every length', () => {
  const planes = dims.spinningPlanes('XW,YZ', 4);
  assert.deepEqual(planes.map(([i, j]) => [i, j]), [[0, 3], [1, 2]]);
  const p = [1, -1, 1, -1];
  const q = dims.rotate(p, 4, 2.3, planes, { XY: 0.4 });
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...q)) < 1e-12);
  assert.deepEqual(dims.spinningPlanes('', 4), []);
  assert.deepEqual(dims.spinningPlanes('XQ', 4), [], 'planes outside the dimension are ignored');
});

test('spin settings are validated', () => {
  const ok = (spin) => checkFields({ ...MODULES.dimensions.DEFAULTS, spin }, MODULES.dimensions.SPEC).ok;
  assert.equal(ok('auto'), true);
  assert.equal(ok(''), true);
  assert.equal(ok('XW,YZ,QR'), true);
  assert.equal(ok('XW;drop table'), false);
  assert.equal(ok('xw'), false);
});

// ─── Classical string ────────────────────────────────────────────────────

test('the live spectrum recovers exactly the harmonics that were mixed in', () => {
  const cases = [
    { kind: 'open', wave: 'standing', harmonics: '0.8,0,0.4,0,0,0,0,0.2', t: 0 },
    { kind: 'closed', wave: 'standing', harmonics: '0,0.6,0.3,0,0,0,0,0', t: 0 },
    { kind: 'closed', wave: 'travelling', harmonics: '0,0.6,0,0.35,0,0,0,0', t: 1.37 },
  ];
  for (const c of cases) {
    const p = { ...str.DEFAULTS, ...c };
    const spectrum = str.modeSpectrum(p, c.t);
    str.parseHarmonics(c.harmonics).forEach((a, k) => assert.ok(Math.abs(spectrum[k] - a) < 1e-6, `${c.kind}/${c.wave} harmonic ${k + 1}`));
  }
});

test('fixed ends never move', () => {
  const p = { ...str.DEFAULTS, kind: 'open', harmonics: '1,0.5,0.3,0.2,0.1,0.1,0.1,0.1' };
  for (const t of [0, 0.4, 2.2]) {
    assert.ok(Math.abs(str.classicalDisplacement(p, 0, t)) < 1e-12);
    assert.ok(Math.abs(str.classicalDisplacement(p, 1, t)) < 1e-12);
  }
});

test('string physics: v = 2Lf₁, μ = T/v², harmonics are whole multiples', () => {
  const phys = str.classicalPhysics({ ...str.DEFAULTS, kind: 'open', f1: 110, tension: 242 });
  assert.ok(Math.abs(phys.waveSpeed - 2 * 0.65 * 110) < 1e-9);
  assert.ok(Math.abs(phys.massPerMetre - 242 / phys.waveSpeed ** 2) < 1e-12);
  assert.deepEqual(phys.frequencies, [110, 220, 330, 440, 550, 660, 770, 880]);
});

test('harmonic lists round-trip and bad ones are rejected', () => {
  const amps = [1, 0.5, 0.333, 0, 0, 0, 0, 0.05];
  assert.deepEqual(str.parseHarmonics(str.formatHarmonics(amps)), amps);
  const ok = (harmonics) => checkFields({ ...str.DEFAULTS, harmonics }, str.SPEC).ok;
  assert.equal(ok('1,0,0,0,0,0,0,0'), true);
  assert.equal(ok('2,0,0,0,0,0,0,0'), false);
  assert.equal(ok('1,0,0'), false);
});

// ─── Presets, badges, inspector, maths ───────────────────────────────────

test('every preset leads to a valid lab state', () => {
  for (const tab of LAB_TABS) {
    for (const preset of VIEWS[tab].presets) {
      const lab = defaultLabState();
      lab[tab] = { ...lab[tab], ...preset.set };
      const r = validateLabState(lab);
      assert.equal(r.ok, true, `${tab} preset "${preset.label}": ${r.errors?.join('; ')}`);
    }
  }
});

test('every view states honestly what is displayed', () => {
  const kinds = new Set(['result', 'analogy', 'metaphor']);
  const states = { string: ['relativistic', 'open', 'closed'].map((kind) => ({ ...str.DEFAULTS, kind })) };
  for (const tab of LAB_TABS) {
    for (const p of states[tab] ?? [MODULES[tab].DEFAULTS]) {
      const d = VIEWS[tab].displayed(p);
      assert.ok(d.title.length > 3 && d.text.length > 40, tab);
      assert.ok(d.badges.length >= 1 && d.badges.every((b) => kinds.has(b)), `${tab}: ${d.badges}`);
    }
  }
  assert.deepEqual(stringView.displayed({ ...str.DEFAULTS, kind: 'open' }).badges, ['analogy'], 'a guitar string is labelled an analogy');
  assert.deepEqual(calabiYauView.displayed({ n: 3, alpha: 0, speed: 0 }).badges, ['result'], 'degree 3 is a true Calabi–Yau');
});

test('inspector panels build for every module and setting', () => {
  const states = {
    string: ['relativistic', 'open', 'closed'].map((kind) => ({ ...str.DEFAULTS, kind })),
    dimensions: [0, 1, 4, 9].map((dim) => ({ ...dims.DEFAULTS, dim })),
  };
  for (const tab of LAB_TABS) {
    for (const p of states[tab] ?? [MODULES[tab].DEFAULTS]) {
      const sections = VIEWS[tab].inspector(p, UI);
      assert.ok(sections.length >= 1, tab);
      for (const s of sections) {
        assert.ok(s.title && s.controls.length, `${tab}: empty section`);
        for (const c of s.controls) if (c.key) assert.ok(c.key in MODULES[tab].SPEC, `${tab}: unknown setting ${c.key}`);
      }
    }
  }
});

test('maths typesets for classical strings and 0D–9D shapes', () => {
  const render = (tex) => katex.renderToString(tex, { displayMode: true, throwOnError: true, strict: 'error' });
  const cases = [
    ...['open', 'closed'].flatMap((kind) => ['standing', 'travelling'].map((wave) => ['string', { ...str.DEFAULTS, kind, wave, harmonics: '1,0.5,0,0.2,0,0,0.1,0.1' }])),
    ['string', { ...str.DEFAULTS, kind: 'open', harmonics: '0,0,0,0,0,0,0,0' }],
    ...Array.from({ length: 10 }, (_, dim) => ['dimensions', { ...dims.DEFAULTS, dim }]),
    ['dimensions', { ...dims.DEFAULTS, dim: 7, shape: 'cross', projection: 'orthographic' }],
  ];
  for (const [tab, p] of cases) {
    const items = formulas(tab, p, {});
    assert.ok(items.length >= 4, `${tab} ${JSON.stringify(p)}`);
    for (const item of items) assert.doesNotThrow(() => render(item.tex), `${tab}: ${item.title}\n${item.tex}`);
  }
});
