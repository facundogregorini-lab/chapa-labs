'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../prospecting/commercial-os.css'), 'utf8');

function periodFn() {
  const start = app.indexOf('  const FU_PERIODS=');
  const end = app.indexOf('  function fuQueueSelection', start);
  assert.ok(start > 0 && end > start);
  const ctx = {};
  vm.runInNewContext(app.slice(start, end) + ';this.fuInPeriod=fuInPeriod;', ctx);
  return ctx.fuInPeriod;
}

test('Pendiente no filtra; Hoy, Ayer y Esta semana miran la última acción', () => {
  const inPeriod = periodFn();
  const now = new Date(2026, 10, 13, 12, 0); // viernes 13/11/2026
  const at = (d, h = 10) => ({ since: new Date(2026, 10, d, h).toISOString() });
  assert.equal(inPeriod({ since: '' }, '', now), true);
  assert.equal(inPeriod(at(13), 'hoy', now), true);
  assert.equal(inPeriod(at(12), 'hoy', now), false);
  assert.equal(inPeriod(at(12), 'ayer', now), true);
  assert.equal(inPeriod(at(11), 'ayer', now), false);
  assert.equal(inPeriod(at(9, 0), 'semana', now), true); // lunes
  assert.equal(inPeriod(at(8, 23), 'semana', now), false); // domingo anterior
  assert.equal(inPeriod({ since: '' }, 'hoy', now), false);
});

test('Quién ejecuta y el período van arriba de las tarjetas de etapas', () => {
  const top = app.indexOf('data-testid="fu-queue-topfilters"');
  const stages = app.indexOf('data-testid="followup-reference-stage-cards"');
  assert.ok(top > 0 && stages > top);
  assert.ok(app.indexOf('data-testid="fu-queue-period"', top) > top);
  assert.equal(app.split('data-testid="fu-queue-executor"').length, 2);
  assert.match(app, /case 'queue-period':/);
  assert.match(css, /\.os-fu-period-bar button\.is-on\{/);
});
