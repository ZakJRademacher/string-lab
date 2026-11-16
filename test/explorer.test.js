// Tests for the explorer: the guided tour, the live formulas, and the new maths.

import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import { TOUR, STEPS, applyStep, firstStepOfChapter, WELCOME_PICTURE } from '../public/tour.js';
import { formulas } from '../public/formulas.js';
import { defaultLabState, validateLabState, TABS, LAB_TABS } from '../public/physics/index.js';
import { faceCounts, eulerCharacteristic } from '../public/physics/dimensions.js';
import { genus } from '../public/physics/calabiYau.js';

/** Throws if KaTeX can't typeset the formula (strict mode reports every problem). */
function render(tex) {
  return katex.renderToString(tex, { displayMode: true, throwOnError: true, strict: 'error' });
}

// ─── New maths ────────────────────────────────────────────────────────────

test('face counts match known shapes', () => {
  assert.deepEqual(faceCounts('cube', 3), [8, 12, 6]);        // cube
  assert.deepEqual(faceCounts('cube', 4), [16, 32, 24, 8]);   // tesseract: 8 cubes
  assert.deepEqual(faceCounts('cross', 3), [6, 12, 8]);       // octahedron
  assert.deepEqual(faceCounts('cross', 4), [8, 24, 32, 16]);  // 16-cell
});

test("Euler's formula holds in every dimension", () => {
  for (const shape of ['cube', 'cross']) {
    for (let n = 3; n <= 6; n++) assert.equal(eulerCharacteristic(shape, n), 1 - (-1) ** n);
  }
});

test('genus of the Fermat curve: sphere, doughnut, then more holes', () => {
  assert.deepEqual([2, 3, 4, 5, 6].map(genus), [0, 1, 3, 6, 10]);
});

test('old saves without newer settings still load (fallback values)', () => {
  const old = defaultLabState();
  delete old.string.sheet;
  const r = validateLabState(old);
  assert.equal(r.ok, true);
  assert.equal(r.value.string.sheet, 'on');
  old.string.sheet = 'sideways'; // present but wrong is still an error
  assert.equal(validateLabState(old).ok, false);
});

// ─── The tour ─────────────────────────────────────────────────────────────

test('every tour step leads to a valid lab state', () => {
  let lab = defaultLabState();
  for (const step of STEPS) {
    lab = applyStep(lab, step);
    const r = validateLabState(lab);
    assert.equal(r.ok, true, `step "${step.title}": ${r.errors?.join('; ')}`);
    if (step.state?.tab) assert.ok(TABS.includes(lab.tab), `step "${step.title}" shows an unknown tab`);
  }
});

test('every tour step has readable content', () => {
  for (const step of STEPS) {
    assert.ok(step.title.length > 3);
    assert.ok(step.body.length >= 1 && step.body.every((p) => p.length > 40), `thin text in "${step.title}"`);
  }
});

test('the tour tells the four ideas in order, each ending with a takeaway', () => {
  // README.md: "the problem, the idea, the cost and the catch".
  // (The welcome screen in index.html comes before stop 1; it is not a tour chapter.)
  assert.deepEqual(TOUR.map((c) => c.id), ['problem', 'idea', 'cost', 'catch']);
  for (const chapter of TOUR) assert.equal(chapter.steps.at(-1).takeaway, true, chapter.id);
  assert.equal(STEPS[0].state?.tab, 'problem', 'the tour opens on the problem, with its own picture');
  assert.equal(STEPS[firstStepOfChapter('cost')].chapter.id, 'cost');
  assert.equal(firstStepOfChapter('no-such-stop'), 0);
});

test('the tour shows every picture somewhere', () => {
  const shown = new Set(STEPS.map((s) => s.state?.tab).filter(Boolean));
  for (const tab of TABS) assert.ok(shown.has(tab), `no tour step shows ${tab}`);
});

test('every tour formula typesets', () => {
  for (const step of STEPS) if (step.tex) assert.doesNotThrow(() => render(step.tex), step.title);
});

// ─── The live math panel ──────────────────────────────────────────────────

function* settingsToTry() {
  yield defaultLabState();
  let lab = defaultLabState();
  for (const step of STEPS) { lab = applyStep(lab, step); yield lab; }
  const odd = defaultLabState(); // edge cases: forbidden states, extremes
  Object.assign(odd.string, { N: 2, Ntilde: 0, m: 6, n: 1, psi: 0 });
  Object.assign(odd.compactification, { R: 0.25, n: 3, w: 3, N: 0 });
  Object.assign(odd.dimensions, { dim: 6, shape: 'cross', projection: 'orthographic' });
  Object.assign(odd.calabiYau, { n: 6, alpha: Math.PI });
  yield odd;
}

test('every live formula typesets, for every tab and many settings', () => {
  const live = { constraintError: 3.2e-9, maxSpeed: 0.9987, maxError: 1.1e-14 };
  let count = 0;
  for (const lab of settingsToTry()) {
    for (const tab of LAB_TABS) {
      const items = formulas(tab, lab[tab], live);
      assert.ok(items.length >= 4, `${tab} has too few formulas`);
      for (const item of items) {
        assert.doesNotThrow(() => render(item.tex), `${tab}: ${item.title}\n${item.tex}`);
        assert.ok(item.text.length > 40, `${tab}: ${item.title} needs an explanation`);
        count++;
      }
    }
  }
  assert.ok(count > 100);
});

test('live formulas show the real numbers', () => {
  const lab = defaultLabState();
  Object.assign(lab.compactification, { R: 2, n: 1, w: 0, N: 1 });
  const mass = formulas('compactification', lab.compactification)[0].tex;
  assert.match(mass, /=0\.25$/); // n²/R² = 1/4
  const holes = formulas('calabiYau', { n: 5, alpha: 1, speed: 0 }).find((f) => f.title === 'How many holes?');
  assert.match(holes.tex, /=6$/);
});

test('the picture behind the welcome screen is a valid setting', () => {
  const r = validateLabState(applyStep(defaultLabState(), { state: WELCOME_PICTURE }));
  assert.equal(r.ok, true, r.errors?.join('; '));
});
