// Saved setups now live in the browser. These tests use a pretend localStorage
// (a plain Map) so they run offline, with no browser at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveStore, MAX_SAVES } from '../public/saves.js';
import { defaultLabState, validateLabState } from '../public/physics/index.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
}

test('save, list (newest first), load and delete', async () => {
  const store = createSaveStore(memoryStorage(), validateLabState);
  const lab = defaultLabState();
  lab.compactification.R = 1;
  store.add('First', defaultLabState());
  await new Promise((r) => setTimeout(r, 2));
  store.add('  Self-dual circle  ', lab);
  const list = store.list();
  assert.deepEqual(list.map((s) => s.title), ['Self-dual circle', 'First']);
  assert.equal(list[0].state.compactification.R, 1);
  store.remove(list[0].id);
  assert.deepEqual(store.list().map((s) => s.title), ['First']);
});

test('refuses empty names, invalid settings and too many saves', () => {
  const store = createSaveStore(memoryStorage(), validateLabState);
  assert.throws(() => store.add('   ', defaultLabState()), /name/);
  const bad = defaultLabState();
  bad.dimensions.dim = 42;
  assert.throws(() => store.add('Bad', bad), /invalid/);
  for (let i = 0; i < MAX_SAVES; i++) store.add(`Save ${i}`, defaultLabState());
  assert.throws(() => store.add('One too many', defaultLabState()), /up to/);
});

test('damaged or hand-edited storage never breaks the app', () => {
  const storage = memoryStorage();
  const store = createSaveStore(storage, validateLabState);
  storage.setItem('string-lab:saves', 'not json at all');
  assert.deepEqual(store.list(), []);
  const bad = defaultLabState();
  bad.string.m = 99;
  storage.setItem('string-lab:saves', JSON.stringify([
    { id: 'a', title: 'Good', state: defaultLabState(), savedAt: 1 },
    { id: 'b', title: 'Tampered', state: bad, savedAt: 2 },
    { nonsense: true },
  ]));
  assert.deepEqual(store.list().map((s) => s.title), ['Good']);
});

test('a browser that blocks storage gets a clear message, not a crash', () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const store = createSaveStore(blocked, validateLabState);
  assert.throws(() => store.add('Anything', defaultLabState()), /blocking storage/);
  assert.deepEqual(store.list(), []);
});
