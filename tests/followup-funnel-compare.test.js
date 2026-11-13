'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../prospecting/commercial-os.css'), 'utf8');

function fns() {
  const start = app.indexOf('  const FU_FUNNEL_PERIODS=');
  const end = app.indexOf('  function fuFunnelChart(', start);
  assert.ok(start > 0 && end > start);
  const ctx = { dayTime: (iso) => iso };
  vm.runInNewContext(app.slice(start, end) + ';this.W=fuFunnelWindows;this.R=fuReachDates;this.C=fuFunnelCounts;', ctx);
  return ctx;
}

const now = new Date(2026, 10, 13, 13, 5); // viernes 13/11 13:05
const d = (day, h = 10) => new Date(2026, 10, day, h).toISOString();
const rows = [
  { id: 'a', step: 2, at: [d(10), d(11), d(12)] },
  { id: 'b', step: 1, at: [d(4), d(6, 9)] },
  { id: 'c', step: 1, at: [d(6, 15), null] },
  { id: 'd', step: 3, at: [null, null, d(12), null] },
  { id: 'e', step: 0, at: [null] },
];

test('Sin fecha en un paso, vale la del paso siguiente que la tenga («a más tardar»)', () => {
  const { R } = fns();
  const dd = R(rows[3]);
  assert.equal(dd[0], Date.parse(d(12)));
  assert.equal(dd[1], Date.parse(d(12)));
  assert.equal(dd[3], null);
});

test('Esta semana vs. la semana pasada hasta el mismo día y hora', () => {
  const { W, R, C } = fns();
  const D = rows.map((r) => R(r)), w = W('semana', now);
  assert.deepEqual([...C(D, 4, w.cur, w.open)], [2, 2, 2, 0]);
  assert.deepEqual([...C(D, 4, w.prev, w.open)], [1, 1, 0, 0]); // c (vie pasado 15 h) queda afuera
});

test('Semana pasada completa vs. la anterior, y el acumulado vs. hace una semana', () => {
  const { W, R, C } = fns();
  const D = rows.map((r) => R(r));
  const p = W('pasada', now), a = W('acumulado', now);
  assert.deepEqual([...C(D, 4, p.cur, p.open)], [2, 1, 0, 0]);
  assert.deepEqual([...C(D, 4, a.cur, a.open)], [5, 4, 2, 1]);
  assert.deepEqual([...C(D, 4, a.prev, a.open)], [2, 2, 0, 1]);
});

test('El embudo usa funnelDates si la API lo manda y si no queda el gráfico de antes', () => {
  assert.match(app, /if\(!rows\|\|!Array\.isArray\(chart\)\|\|!chart\.length\)return fuNativeChart\(snap,unit\);/);
  assert.match(app, /if\(scope==='habita'\)return fuFunnelChart\(snap,'habita'\);/);
  assert.match(app, /case 'funnel-compare':/);
  assert.match(app, /case 'funnel-window':/);
  assert.match(css, /\.os-cmp-prev\{position:absolute;left:0;top:-3px;bottom:-3px;border:1\.5px dashed/);
});

test('Cambiar de producto arriba mantiene la pestaña y el lugar, con un fundido corto', () => {
  assert.match(app, /if \(ds\.unit && t\.closest\('#units'\)\) \{ switchUnit\(ds\.unit\); return; \}/);
  assert.match(app, /go\(unit, keeps \? view : unit === 'todas' \? 'resumen' : 'hoy', \{ keepScroll: true \}\);/);
  assert.match(app, /if \(!keepScroll\) window\.scrollTo/);
  assert.match(css, /#main\.is-switching\{animation:os-unit-in \.22s ease-out\}/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{#main\.is-switching\{animation:none\}/);
});

test('El embudo comparado arranca en los períodos, sin título ni descripción', () => {
  const fn = app.slice(app.indexOf('  function fuFunnelChart('), app.indexOf('  function fuNativeChart('));
  assert.doesNotMatch(fn, /<h2>Funnel comercial<\/h2>/);
  assert.doesNotMatch(fn, /Cada paso cuenta/);
  assert.match(fn, /aria-label="Funnel comercial"/);
});

test('Cohortes en el celular: etapas en filas y las 3 semanas más recientes en columnas', () => {
  const R = require('../prospecting/results-view.js');
  const rv = fs.readFileSync(path.join(__dirname, '../prospecting/results-view.js'), 'utf8');
  assert.match(rv, /function cohortMobile\(stages,rows,by,who,view\)/);
  assert.match(rv, /const SHOW=3/);
  assert.match(css, /@media\(max-width:760px\)\{\n  \.rs-heat-desk\{display:none\}\n  \.rs-heat-mob\{display:block\}/);
  assert.match(app, /case 'results-cohort-back':/);
  assert.ok(R);
});
