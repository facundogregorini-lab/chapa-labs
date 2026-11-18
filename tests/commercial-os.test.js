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
test('Global search stays visible in the Follow-up header and loads accounts when used', () => {
  const html = read('index.html');
  const css = read('commercial-os.css');
  const app = read('app.js');
  for (const id of ['gsearch-open', 'gsearch-close']) assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
  // The Follow-up header hides the breadcrumb and theme, never the search.
  const desktopHide = css.slice(css.indexOf('Arriba a la derecha: el buscador global'), css.indexOf('@media(max-width:760px)', css.indexOf('Arriba a la derecha: el buscador global')));
  assert.ok(desktopHide.includes('.os-top #theme'));
  assert.doesNotMatch(desktopHide, /\.os-top \.gsearch,/);
  assert.match(css, /:has\(\.habita-fu-workspace-head\) \.os-top \.gsearch\{\n  display:block/);
  // Mobile: a magnifier opens it full width.
  assert.match(css, /:has\(\.habita-fu-workspace-head\) \.os-top \.os-search-toggle\{\n    display:grid/);
  assert.match(css, /\.os-top\.is-searching \.gsearch\{/);
  // Follow-up views don't load accounts on their own: the search must load them itself.
  assert.match(app, /function loadForSearch\(\)/);
  assert.match(app, /loadUnit\(u\.id, \{ quiet: true, noSync: true \}\)/);
  assert.match(app, /addEventListener\('focus', \(\) => \{ loadForSearch\(\)/);
});
test('Account drawer has a links section and the header stays behind an open drawer', () => {
  const app = read('app.js');
  const core = read('core.js');
  const css = read('commercial-os.css');
  assert.match(core, /\['agencyId', 'Inmobiliaria ID', \/\^inmobiliaria id\$\/i\]/);
  const fn = app.slice(app.indexOf('function linksSection('), app.indexOf('function accountSection('));
  for (const s of ['data-ag-link="demo"', 'data-ag-link="panel"', '/admin/inmobiliarias/', '/precios', '/galeria', 'data-testid="drawer-links"']) assert.ok(fn.includes(s), s);
  assert.match(app, /\$\{linksSection\(a, u, link\)\}/);
  assert.match(css, /body:has\(#drawer:not\(\[hidden\]\)\) \.top\.os-top\{z-index:30!important\}/);
});
