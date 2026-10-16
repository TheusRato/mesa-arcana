import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/assets.json'));
test('Application and source files have valid JavaScript syntax', () => {
  new vm.Script(read('dist/assets/app.js'));
  for (const file of manifest['app.js']) new vm.Script(read('src/' + file), { filename: file });
});
test('Build matches the ordered source files', () => {
  for (const [output, inputs] of Object.entries(manifest)) {
    assert.equal(read('dist/assets/' + output), inputs.map(file => read('src/' + file)).join('\n'));
  }
  assert.equal(read('dist/index.html'), read('src/index.html'));
});
test('HTML uses relative assets and has unique element IDs', () => {
  const html = read('dist/index.html');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(!/<style>|<script>/.test(html));
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) {
    assert.ok(fs.existsSync(new URL('../dist/' + match[1], import.meta.url)), match[1]);
  }
});
test('Offline shell includes extracted assets', () => {
  const worker = read('dist/service-worker.js');
  for (const output of Object.keys(manifest)) assert.ok(worker.includes('./assets/' + output));
});
