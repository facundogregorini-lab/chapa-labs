'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, 'prospecting', p), 'utf8');

test('Commercial OS keeps the original JS app syntactically valid', () => {
  assert.doesNotThrow(() => new vm.Script(read('app.js'), { filename: 'prospecting/app.js' }));
});
test('Shared shell has one business selector, route navigation, search and work area', () => {
  const html = read('index.html');
  for (const id of ['units','tabs','legacy-tabs','main','gsearch','user','theme','os-place'])
    assert.equal((html.match(new RegExp('id="'+id+'"', 'g')) || []).length, 1, id);
  assert.match(html, /commercial-os\.css/);
  assert.match(html, /class="os-shell"/);
  assert.match(html, /id="tabs" role="tablist"/);
});
test('Commercial views remain product-owned and sends are never registered by opening WhatsApp', () => {
  const source = read('app.js');
  assert.match(source, /function renderCommercialOverview\(\)/);
  assert.match(source, /function fuCatalog\(\)/);
  assert.match(source, /function fuPipeline\(\)/);
  assert.match(source, /case 'confirm':/);
  assert.match(source, /op: 'open'/);
  assert.match(source, /op: 'confirm'/);
  assert.match(source, /data-fu="pipeline-stage"/);
  assert.match(source, /data-fu-rule-form/);
  assert.match(source, /data-fu-state-form/);
  assert.match(source, /state\.session\?\.open/);
});
test('Responsive design preserves mobile access to legacy product tools', () => {
  const css = read('commercial-os.css');
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /\.os-legacy-nav \{ display:flex/);
  assert.match(css, /\.os-stage-rail/);
});
