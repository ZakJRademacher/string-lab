// Physics tests. Run with:  npm test
//
// Lesson: a test is a small program that checks your real program. Each one
// states something that MUST be true. If someone breaks the math later, a test
// goes red before any user sees a wrong picture.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as str from '../public/physics/string.js';
import * as dims from '../public/physics/dimensions.js';
import * as cy from '../public/physics/calabiYau.js';
import * as comp from '../public/physics/compactification.js';
import { defaultLabState, validateLabState } from '../public/physics/index.js';

// ─── Vibrating string ─────────────────────────────────────────────────────

test('string: valid loops obey the Virasoro constraints', () => {
  const cases = [
    { ...str.DEFAULTS },
    { ...str.DEFAULTS, m: 3, n: 2, psi: 0.4 },
    { ...str.DEFAULTS, family: 'kibble-turok', alpha: 0.3, psi: 2.0 },
  ];
  for (const p of cases) {
    for (const t of [0, 0.7, 2.3]) {
      assert.ok(str.constraintError(p, t) < 1e-6, `constraint violated for ${JSON.stringify(p)} at t=${t}`);
    }
  }
});

test('string: the check catches a NON-relativistic string', () => {
  // An ordinary slowly spinning ring is not a valid relativistic string.
  // Its velocity is 0.1 along the string, so ẋ · x′ = 0.1 instead of 0.
  const ring = (s, t) => [Math.cos(s + 0.1 * t), Math.sin(s + 0.1 * t), 0];
  assert.ok(str.measureConstraints(ring, 0) > 0.05);
});

test('string: no point ever moves faster than light', () => {
  const { speeds } = str.stringState({ ...str.DEFAULTS, m: 2, n: 3 }, 1.1);
  for (const s of speeds) assert.ok(s <= 1);
});

test('string: N = Ñ = 1 is the massless graviton level with 576 states', () => {
  const lvl = str.closedStringLevel(1, 1);
  assert.equal(lvl.mass2, 0);
  assert.equal(lvl.states, 576);
  assert.equal(str.closedStringLevel(2, 1).allowed, false);
  assert.equal(str.transverseStates(2), 324);
});

// ─── Dimension explorer ───────────────────────────────────────────────────

test('dimensions: hypercubes have 2^n corners and n·2^(n−1) edges', () => {
  for (let n = 3; n <= 6; n++) {
    const { vertices, edges } = dims.polytope('cube', n);
    assert.equal(vertices.length, 2 ** n);
    assert.equal(edges.length, n * 2 ** (n - 1));
  }
});

test('dimensions: cross-polytopes have 2n points and 2n(n−1) edges', () => {
  for (let n = 3; n <= 6; n++) {
    const { vertices, edges } = dims.polytope('cross', n);
    assert.equal(vertices.length, 2 * n);
    assert.equal(edges.length, 2 * n * (n - 1));
  }
});

test('dimensions: rotation does not change lengths', () => {
  const p = [1, -1, 1, -1, 1, 1];
  const q = dims.rotate(p, 6, 1.234);
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...q)) < 1e-12);
});

test('dimensions: projection always ends in 3D', () => {
  assert.equal(dims.project([1, 1, 1, 1, 1, 1], 'perspective').length, 3);
  assert.deepEqual(dims.project([1, 2, 3, 4], 'orthographic'), [1, 2, 3]);
});

// ─── Calabi–Yau ───────────────────────────────────────────────────────────

test('calabi-yau: every point solves z1^n + z2^n = 1', () => {
  for (let n = 2; n <= 6; n++) {
    const s = cy.surface({ n, alpha: 0.7 }, 10);
    assert.equal(s.patches, n * n);
    assert.ok(s.maxError < 1e-9, `n=${n} error ${s.maxError}`);
  }
});

// ─── Compactification ─────────────────────────────────────────────────────

test('compactification: T-duality (n↔w, R↔1/R) leaves every mass unchanged', () => {
  for (const R of [0.3, 0.8, 1.7, 3.5]) {
    for (const [n, w, N] of [[1, 0, 1], [0, 2, 1], [2, 1, 3], [1, -1, 1]]) {
      const a = comp.stateAt({ R, n, w, N });
      const b = comp.stateAt({ R: 1 / R, n: w, w: n, N });
      assert.equal(a.allowed, b.allowed);
      if (a.allowed) assert.ok(Math.abs(a.mass2 - b.mass2) < 1e-9);
    }
  }
});

test('compactification: n = w = 1 becomes massless exactly at the self-dual radius', () => {
  const s = comp.stateAt({ R: comp.SELF_DUAL_RADIUS, n: 1, w: 1, N: 1 });
  assert.ok(Math.abs(s.mass2) < 1e-12);
  assert.ok(comp.stateAt({ R: 2, n: 1, w: 1, N: 1 }).mass2 > 0);
});

test('compactification: level matching rejects impossible states', () => {
  assert.equal(comp.stateAt({ R: 1, n: 2, w: 2, N: 1 }).allowed, false);
});

// ─── Shared validation ────────────────────────────────────────────────────

test('validation: defaults pass, bad values are rejected with clear errors', () => {
  assert.equal(validateLabState(defaultLabState()).ok, true);

  const bad = defaultLabState();
  bad.string.m = 2.5;
  bad.compactification.R = 99;
  bad.tab = 'hacker';
  const r = validateLabState(bad);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 3);
});

test('validation: unknown extra fields are dropped, not stored', () => {
  const s = defaultLabState();
  s.string.evil = '<script>';
  const r = validateLabState(s);
  assert.equal(r.ok, true);
  assert.equal('evil' in r.value.string, false);
});
