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
  assert.match(app, /fuQueueSelection\(fuScope\(\)\)\.rows\.filter\(x=>/);
  assert.match(app, /x\.key!==currentKey&&x\.bucket!=='ejecutada'&&!x\.claim&&!x\.blocked&&!x\.dueAt&&Boolean\(x\.action\)/);
  assert.match(app, /case 'next-after': await fuNext\(t\)/);
  assert.match(app, /if\(!next\)\{\s*toast\('No hay otra tarea libre/);
});

test('next task checks eligibility BEFORE releasing and does not use confirm operation', () => {
  const start = app.indexOf('  async function fuNext(clicked');
  const end = app.indexOf('  // ── Las vistas ──', start);
  assert.ok(start > 0 && end > start);
  const fn = app.slice(start, end);
  const findNext = fn.indexOf('let next=claiming?.item||fuNextCandidate(cur)');
  const release = fn.indexOf("op:'release'");
  const claim = fn.indexOf('await fuClaim(next,');
  assert.ok(findNext > 0 && release > findNext && claim > release);
  assert.doesNotMatch(fn, /op:\s*'confirm'/);
  assert.match(fn, /if\(previous\?\.mode==='ejecutar'\)/);
  assert.match(fn, /if\(!next\)\{[\s\S]*?return;\s*\}/);
});

test('other navigation keeps current business and active queue filters', () => {
  const start = app.indexOf('  async function fuNext(clicked');
  const end = app.indexOf('  // ── Las vistas ──', start);
  const fn = app.slice(start, end);
  assert.doesNotMatch(fn, /q\.commercial\s*=|q\.situation\s*=|q\.tech\s*=|q\.rule\s*=|go\(/);
});

// The real function, run against a queue: «Siguiente tarea» used to come back
// to the first task (A → B → A) because a skipped task returns to its place.
function nextCandidateWith(rows) {
  const start = app.indexOf('  state.fu.skipped = new Set();');
  const end = app.indexOf('  async function fuNext(clicked', start);
  assert.ok(start > 0 && end > start);
  const state = { fu: { n: {} } };
  const fn = new Function('state', 'fuQueueSelection', 'fuScope', app.slice(start, end) + '\n return fuNextCandidate;');
  return { state, next: fn(state, () => ({ rows }), () => 'habita') };
}
const row = (key, extra = {}) => ({ key, action: 'Mandar demo', ...extra });

test('«Siguiente tarea» walks the queue in order instead of returning to the first task', () => {
  const { state, next } = nextCandidateWith([row('A'), row('B'), row('C'), row('D')]);
  assert.equal(next('A').key, 'B');
  state.fu.skipped.add('A');            // A was skipped without confirming
  assert.equal(next('B').key, 'C');     // before the fix: 'A'
  state.fu.skipped.add('B');
  assert.equal(next('C').key, 'D');
});

test('«Siguiente tarea» skips taken, blocked and scheduled tasks and starts over at the end', () => {
  const { state, next } = nextCandidateWith([row('A'), row('B', { claim: { by: 'Axel' } }), row('C', { blocked: 'Fuera de horario' }), row('D', { dueAt: '2026-11-13' }), row('E')]);
  state.fu.skipped.add('A');
  assert.equal(next('A').key, 'E');
  state.fu.skipped.add('E');
  assert.equal(next('E').key, 'A');     // end of the list: back to the top
  assert.equal(state.fu.skipped.size, 0);
  assert.equal(nextCandidateWith([row('A')]).next('A'), null);
});
