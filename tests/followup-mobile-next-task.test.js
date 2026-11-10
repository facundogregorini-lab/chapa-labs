'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../prospecting/commercial-os.css'), 'utf8');

test('mobile execution provides distinct Confirmar envío and Siguiente tarea CTAs', () => {
  assert.doesNotThrow(() => new vm.Script(app));
  assert.match(app, /data-testid="fu-confirm-mobile"/);
  assert.match(app, /data-testid="fu-next-mobile"/);
  assert.match(app, /data-fu="next-after" data-testid="fu-next-mobile"/);
  assert.match(app, /Siguiente tarea →/);
  assert.match(app, /data-testid="fu-reclassify-open">Reclasificar/);
  assert.match(css, /\.os-fu-mobile-send \.os-fu-mobile-next\s*\{/);
  assert.match(css, /min-height:50px/);
});

test('next task uses existing filtered and ranked queue with no claimed, blocked or scheduled tasks', () => {
  assert.match(app, /function fuNextCandidate\(currentKey\)/);
  assert.match(app, /fuQueueSelection\(fuScope\(\)\)\.rows\.find\(x=>/);
  assert.match(app, /x\.key!==currentKey&&!x\.claim&&!x\.blocked&&!x\.dueAt&&Boolean\(x\.action\)/);
  assert.match(app, /case 'next-after': await fuNext\(t\)/);
  assert.match(app, /if\(!next\)\{\s*toast\('No hay otra tarea libre/);
});

test('next task checks eligibility BEFORE releasing and does not use confirm operation', () => {
  const start = app.indexOf('  async function fuNext(clicked) {');
  const end = app.indexOf('  // ── Las vistas ──', start);
  assert.ok(start > 0 && end > start);
  const fn = app.slice(start, end);
  const findNext = fn.indexOf('let next=fuNextCandidate(cur)');
  const release = fn.indexOf("op:'release'");
  const claim = fn.indexOf('await fuClaim(next)');
  assert.ok(findNext > 0 && release > findNext && claim > release);
  assert.doesNotMatch(fn, /op:\s*'confirm'/);
  assert.match(fn, /if\(previous\?\.mode==='ejecutar'\)/);
  assert.match(fn, /if\(!released\)return/);
  assert.match(fn, /if\(!next\)\{[\s\S]*?return;\s*\}/);
});

test('other navigation keeps current business and active queue filters', () => {
  const start = app.indexOf('  async function fuNext(clicked) {');
  const end = app.indexOf('  // ── Las vistas ──', start);
  const fn = app.slice(start, end);
  assert.doesNotMatch(fn, /q\.commercial\s*=|q\.situation\s*=|q\.tech\s*=|q\.rule\s*=|go\(/);
});
