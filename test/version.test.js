import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the page header shows the package version', () => {
  const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(page, new RegExp(`<span class="version" id="version">v${version.replaceAll('.', '\.')}</span>`));
});
