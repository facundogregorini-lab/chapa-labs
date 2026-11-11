'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../prospecting/commercial-os.css'), 'utf8');

function executorFn() {
  const start = app.indexOf('  function fuExecutor(x) {');
  const end = app.indexOf('  const FU_EXECUTOR_LABEL', start);
  assert.ok(start > 0 && end > start);
  const ctx = {};
  vm.runInNewContext(app.slice(start, end) + ';this.fuExecutor=fuExecutor;', ctx);
  return ctx.fuExecutor;
}

test('quién ejecuta: sin responsable o «Extensión» es la extensión; Facu y Axel a mano', () => {
  const ex = executorFn();
  assert.equal(ex({ owner: '' }), 'extension');
  assert.equal(ex({ owner: 'Todos' }), 'extension');
  assert.equal(ex({ owner: 'Extensión' }), 'extension');
  assert.equal(ex({ owner: 'Facu' }), 'facu');
  assert.equal(ex({ owner: 'Facundo' }), 'facu');
  assert.equal(ex({ owner: 'Axel' }), 'axel');
});

test('la cola filtra por quién ejecuta y muestra Facu o Axel solo si tienen acciones', () => {
  assert.doesNotThrow(() => new vm.Script(app));
  assert.match(app, /data-testid="fu-queue-executor"/);
  assert.match(app, /\.filter\(\(\[k\]\)=>!k\|\|k==='extension'\|\|executors\[k\]>0\|\|q\.executor===k\)/);
  assert.match(app, /q\.executor\?filtered\.filter\(x=>fuExecutor\(x\)===q\.executor\):filtered/);
  assert.match(app, /case 'queue-executor':/);
  assert.match(app, /data-testid="fu-mobile-executor"/);
});

test('en mobile: un solo «Filtros» que despliega buscar, métricas y orden; sin «Ejecutar siguiente»', () => {
  assert.match(app, /data-testid="fu-queue-filters-toggle"/);
  assert.match(app, /case 'queue-filters':/);
  const body = app.indexOf('data-testid="fu-queue-filters-body"');
  assert.ok(body > 0);
  assert.ok(app.indexOf('os-fu-queue-compact-search', body) > body);
  assert.ok(app.indexOf('data-testid="fu-queue-sort-options"', body) > body);
  assert.match(css, /\.os-fu-filters-body\[data-open="false"\]\{display:none\}/);
  assert.match(css, /\.os-fu-queue-next\{display:none!important\}/);
});

test('Turnia usa el mismo espacio de trabajo y diseño mobile que habita.', () => {
  assert.match(app, /if\(\(state\.unit==='habita'\|\|state\.unit==='turnia'\)&&\(isFu\(\)\|\|state\.view==='script'\)&&!state\.demo\)/);
  assert.match(app, /Gestioná el outreach y el seguimiento de todos tus consultorios\./);
  assert.doesNotMatch(css, /body\[data-unit="habita"\] /);
  assert.match(css, /body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\):has\(\.habita-fu-tabs\) #legacy-tabs/);
});
