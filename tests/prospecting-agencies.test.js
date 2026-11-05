// La lista «Inmobiliarias» de habita. (copia de commercial.ts y demo-funnel.ts de amoblaia).
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../prospecting/agencies');

const NOW = Date.parse('2026-11-05T15:00:00Z');
const row = (id, o = {}) => ({ id, name: o.name || id, stage: o.stage || 'prospect', hasOwner: false, subscribed: false, score: null, lastActivity: null, createdAt: o.createdAt || '2026-10-01T12:00:00Z', test: false, demos: [], ...o });

test('embudo de demos: acumulado y % sobre el paso anterior', () => {
  const f = A.funnelCounts([0, 1, 1, 2, 4]);
  assert.deepEqual(f.map((x) => x.count), [5, 4, 2, 1, 1, 0, 0]);
  assert.deepEqual(f.map((x) => x.ofPrevious), [null, 80, 50, 50, 100, 0, null]);
  assert.equal(f[1].ofFirst, 0.8);
});

test('períodos en días de la Argentina', () => {
  assert.deepEqual(A.parsePeriod({ periodo: '7' }, NOW), { key: '7', from: '2026-10-30', to: '2026-11-05' });
  assert.deepEqual(A.parsePeriod({ periodo: 'mes' }, NOW), { key: 'mes', from: '2026-11-01', to: '2026-11-05' });
  assert.deepEqual(A.parsePeriod({ desde: '2026-11-04', hasta: '2026-11-01' }, NOW), { key: 'rango', from: '2026-11-04', to: '2026-11-04' });
  assert.deepEqual(A.parsePeriod({}, NOW), { key: 'todo', from: null, to: null });
  // 01:00 UTC del 5 es todavía el 4 en la Argentina.
  assert.equal(A.inPeriod('2026-11-05T01:00:00Z', { from: '2026-11-05', to: '2026-11-05' }), false);
  assert.equal(A.shortDay('2026-11-05T01:00:00Z'), '04/11');
});

test('orden: sin score al final en los dos sentidos', () => {
  const rows = [row('a', { score: 10 }), row('b'), row('c', { score: 70 })];
  assert.deepEqual(A.sortRows(rows, { by: 'score', dir: 'desc' }).map((r) => r.id), ['c', 'a', 'b']);
  assert.deepEqual(A.sortRows(rows, { by: 'score', dir: 'asc' }).map((r) => r.id), ['a', 'c', 'b']);
  assert.deepEqual(A.sortFromParam('actividad-asc'), { by: 'actividad', dir: 'asc' });
  assert.equal(A.sortParam(A.DEFAULT_SORT), '');
});

test('la lista con período, paso del embudo y «se quedaron»', () => {
  const rows = [
    row('x', { stage: 'demo_sent', demos: [{ createdAt: '2026-11-04T15:00:00Z', step: 1 }] }),
    row('y', { stage: 'interacted', score: 65, demos: [{ createdAt: '2026-11-03T15:00:00Z', step: 3 }] }),
    row('z', { stage: 'prospect', demos: [{ createdAt: '2026-09-01T15:00:00Z', step: 0 }] }),
    row('qa', { name: 'QA Habita', test: true, demos: [{ createdAt: '2026-11-04T15:00:00Z', step: 6 }] }),
    row('w', { stage: 'contacted' }),
  ];
  const sp = new URLSearchParams('periodo=7&paso=1&quedo=1');
  const f = A.filtersFrom(sp);
  assert.equal(f.period.key, '7');
  const v = A.view(rows, { ...f, period: A.parsePeriod({ periodo: '7' }, NOW) });
  // El embudo no cuenta las de prueba; la lista sí las muestra en su paso.
  assert.deepEqual(v.funnel.map((x) => x.count), [2, 2, 1, 1, 0, 0, 0]);
  assert.equal(v.totals.total, 3);
  assert.deepEqual(v.items.map((r) => r.id), ['x']);
  const all = A.view(rows, A.filtersFrom(new URLSearchParams('etapa=con-demo')));
  assert.equal(all.withDemos, 4);
  assert.deepEqual(all.items.map((r) => r.id).sort(), ['qa', 'x', 'y', 'z']);
  assert.deepEqual(A.filtersParams(A.filtersFrom(new URLSearchParams('etapa=clientes&score=60&orden=score'))), {
    etapa: 'clientes', paso: '', quedo: '', periodo: '', desde: '', hasta: '', q: '', cuenta: '', score: '60', actividad: '', orden: 'score', pagina: '',
  });
});

test('totales por etapa y cuenta', () => {
  const t = A.listTotals([row('a', { stage: 'panel', hasOwner: true }), row('b', { stage: 'client', hasOwner: true, subscribed: true, score: 80 })]);
  assert.deepEqual([t.total, t.hot, t.withAccount, t.paying, t.byStage.panel, t.byStage.client], [2, 1, 2, 1, 1, 1]);
  assert.equal(A.accountState({ hasOwner: true, subscribed: false }), 'registered');
  assert.equal(A.agoText('2026-11-04T15:00:00Z', NOW), 'Ayer');
});
