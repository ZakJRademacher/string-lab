// Syntax check for every JavaScript file, including the browser-only ones that no
// other test loads.
//
// Why this exists: during the first deploy, a message like 'isn't switched on' was
// put inside a single-quoted string. The apostrophe ended the string early, the whole
// page script failed, and the tests still passed because none of them load app.js.
// It was live for about a minute before a manual check caught it. Now `npm test` catches it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

for (const file of jsFiles('public')) {
  test(`parses: ${file}`, () => {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }));
  });
}
