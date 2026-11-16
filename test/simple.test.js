// Simple-mode tests: keep the beginner experience simple, on purpose.
//
// "Easy to read" is a feature, so it gets tests like any other feature:
//   • every tour step stays short (at most 60 words)
//   • no maths symbols or Greek letters in the beginner text
//   • no buttons or sliders: every picture the tour shows is a valid setting
//   • the words never ask you to press something that isn't there

import test from 'node:test';
import assert from 'node:assert/strict';

import { STEPS, applyStep } from '../public/tour.js';
import { defaultLabState, validateLabState } from '../public/physics/index.js';
import stringView from '../public/views/stringView.js';
import dimensionsView from '../public/views/dimensionsView.js';
import calabiYauView from '../public/views/calabiYauView.js';
import compactificationView from '../public/views/compactificationView.js';
import problemView from '../public/views/problemView.js';

const VIEWS = { string: stringView, dimensions: dimensionsView, calabiYau: calabiYauView, compactification: compactificationView, problem: problemView };
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const SYMBOLS = /[α-ωΑ-Ω∑∫√±≤≥→↔′ñÑ∞≈]|\\[a-z]/;

test('every tour step is short enough to read at a glance (60 words max)', () => {
  for (const step of STEPS) {
    const n = words(step.body.join(' '));
    assert.ok(n <= 60, `"${step.title}" has ${n} words`);
  }
});

test('beginner text has no maths symbols or Greek letters', () => {
  for (const step of STEPS) {
    for (const text of [step.title, ...step.body, step.try ?? '']) {
      assert.doesNotMatch(text, SYMBOLS, `"${step.title}": ${text}`);
    }
  }
  for (const view of Object.values(VIEWS)) assert.doesNotMatch(view.intro, SYMBOLS, view.key);
});

// Simple mode has no buttons or sliders: each step sets the picture up, and some steps
// step through a few variations by themselves. Those must all be valid settings too.
test('every picture the tour cycles through is a valid setting', () => {
  let lab = defaultLabState();
  for (const step of STEPS) {
    lab = applyStep(lab, step);
    for (const variation of step.cycle ?? []) {
      const next = applyStep(lab, { state: variation });
      const r = validateLabState(next);
      assert.equal(r.ok, true, `"${step.title}": ${r.errors?.join('; ')}`);
      assert.equal(next.tab, lab.tab, `"${step.title}": a variation must not switch pictures`);
    }
  }
  assert.ok(STEPS.filter((s) => s.cycle).length >= 3, 'the tour shows variations instead of asking for button presses');
});

test('the tour never asks you to press a button or slider (there are none)', () => {
  for (const step of STEPS) {
    for (const text of [...step.body, step.try ?? '']) {
      assert.doesNotMatch(text, /(press|slide|tap the|click|pick a)/i, `"${step.title}": ${text}`);
    }
  }
});

test('the T-duality sentence is true: the twin really weighs the same', async () => {
  const { stateAt } = await import('../public/physics/compactification.js');
  for (const R of [0.3, 0.7, 2, 3.5]) {
    const a = stateAt({ R, n: 1, w: 0, N: 1 });
    const b = stateAt({ R: 1 / R, n: 0, w: 1, N: 1 });
    assert.ok(Math.abs(a.mass2 - b.mass2) < 1e-9);
  }
});
