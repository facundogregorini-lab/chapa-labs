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

test('Hoy, Ayer y Esta semana listan lo ejecutado (que ya salió de la cola), no la cola filtrada por fecha', () => {
  const F = require('../prospecting/followup.js');
  const now = Date.now();
  const sent = (id, at, executedBy = 'bot') => ({ agencyId: id, name: 'Inmo ' + id, stage: 'no-contactado', action: 'principal', since: at,
    execution: { status: 'sent', at, reason: null, executedBy, by: executedBy === 'bot' ? null : 'Facu' } });
  const today = new Date(now - 60_000).toISOString();
  const n = F.normalize({ habita: {
    queue: [{ agencyId: 'q1', name: 'Del Rey', stage: 'sin-demo', action: 'principal', lastAction: { at: today } }],
    executed: [...Array.from({ length: 50 }, (_, i) => sent('e' + i, today)), sent('h1', today, 'humano'), sent('e0', new Date(now - 120_000).toISOString())],
  } });
  assert.equal(n.queue.length, 1);
  assert.equal(n.executed.length, 52);
  // Cada envío es su propia fila: la misma inmobiliaria con dos envíos no se pisa.
  assert.equal(new Set(n.executed.map((x) => x.key)).size, 52);
  assert.ok(n.executed.every((x) => x.bucket === 'ejecutada' && x.since === x.execution.at));
  assert.equal(n.executed.at(-1).since < today, true); // del más reciente al más viejo
  assert.ok(!n.queue.some((x) => n.executed.some((e) => e.key === x.key)));
});

test('La cola usa n.executed para los períodos y no ofrece ejecutar lo ya ejecutado', () => {
  const sel = app.slice(app.indexOf('  function fuQueueSelection'), app.indexOf('  // ¿Tienen WhatsApp?'));
  assert.match(sel, /n\.executed/);
  assert.match(sel, /period\?done\.filter\(x=>fuInPeriod\(x,period\)\):pending/);
  assert.match(app, /x\.bucket!=='ejecutada'&&!x\.claim/);
  assert.match(app, /const executable=!closed&&!done&&/);
  assert.match(app, /x\.execution\.executedBy==='bot'\)return 'extension'/);
});
