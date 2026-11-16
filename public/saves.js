// saves.js: saved setups, kept in this browser (no account, no server).
//
// Each save is { id, title, state, savedAt }. The list lives in the browser's
// localStorage, which belongs to this one browser on this one device: nothing is sent
// anywhere. Every saved state is re-validated when read back, because stored data can be
// old, edited by hand, or written by an older version of the app.

const KEY = 'string-lab:saves';
export const MAX_SAVES = 50;

/**
 * storage: anything with getItem / setItem (localStorage, or a stand-in in tests).
 * validate: validateLabState from physics/index.js.
 */
export function createSaveStore(storage, validate) {
  function read() {
    let raw;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch { return []; }
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const s of raw) {
      if (!s || typeof s.id !== 'string' || typeof s.title !== 'string') continue;
      const check = validate(s.state);
      if (check.ok) out.push({ id: s.id, title: s.title.slice(0, 80), state: check.value, savedAt: Number(s.savedAt) || 0 });
    }
    return out;
  }
  function write(list) {
    storage.setItem(KEY, JSON.stringify(list)); // may throw if the browser blocks storage
  }

  return {
    /** All saves, newest first. */
    list() {
      return read().sort((a, b) => b.savedAt - a.savedAt);
    },
    /** Save a lab state under a title. Throws a friendly Error if it can't. */
    add(title, state) {
      const name = String(title ?? '').trim().slice(0, 80);
      if (!name) throw new Error('Give the setup a name first.');
      const check = validate(state);
      if (!check.ok) throw new Error('This setup has invalid settings and was not saved.');
      const list = read();
      if (list.length >= MAX_SAVES) throw new Error(`You can keep up to ${MAX_SAVES} saves. Delete one first.`);
      const item = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, title: name, state: check.value, savedAt: Date.now() };
      try { write([...list, item]); } catch { throw new Error('This browser is blocking storage (private mode?), so the setup could not be saved.'); }
      return item;
    },
    remove(id) {
      try { write(read().filter((s) => s.id !== id)); } catch { /* nothing we can do */ }
    },
  };
}
