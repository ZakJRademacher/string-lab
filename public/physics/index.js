// index.js: one front door for all physics modules.
//
// The whole app's state is one "lab state" object:
//   { tab: 'string', string: {...}, dimensions: {...}, calabiYau: {...}, compactification: {...} }
// That single object is what gets saved to the database and
// shown on screen. One shape everywhere = far fewer bugs.

import { checkFields, oneOf } from './validate.js';
import * as string from './string.js';
import * as dimensions from './dimensions.js';
import * as calabiYau from './calabiYau.js';
import * as compactification from './compactification.js';
import * as problem from './problem.js';

export const MODULES = { problem, string, dimensions, calabiYau, compactification };
export const TABS = Object.keys(MODULES);
// The modules in the Advanced lab. "The problem" is told only in the Simple tour.
export const LAB_TABS = TABS.filter((t) => t !== 'problem');

export function defaultLabState() {
  const state = { tab: 'string' };
  for (const [key, mod] of Object.entries(MODULES)) state[key] = { ...mod.DEFAULTS };
  return state;
}

/** Validate a full lab state. Returns {ok, value} or {ok: false, errors}. */
export function validateLabState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['state must be an object'] };
  }
  const errors = [];
  const value = {};
  const tab = checkFields(input, { tab: oneOf(TABS) });
  if (tab.ok) value.tab = tab.value.tab;
  else errors.push(...tab.errors);
  for (const [key, mod] of Object.entries(MODULES)) {
    // Data outlives code: a save made before a module existed gets that module's defaults.
    const r = checkFields(input[key] === undefined ? { ...mod.DEFAULTS } : input[key], mod.SPEC, key);
    if (r.ok) value[key] = r.value;
    else errors.push(...r.errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** A compact, computed description of the whole lab (handy for debugging and tests). */
export function summarizeLab(state) {
  return {
    activeTab: state.tab,
    problem: { settings: state.problem, computed: problem.summarize(state.problem) },
    string: { settings: state.string, computed: string.summarize(state.string) },
    dimensions: { settings: state.dimensions, computed: dimensions.summarize(state.dimensions) },
    calabiYau: { settings: state.calabiYau, computed: calabiYau.summarize(state.calabiYau) },
    compactification: { settings: state.compactification, computed: compactification.summarize(state.compactification) },
  };
}
