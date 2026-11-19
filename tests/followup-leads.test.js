'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../prospecting/followup.js');
const js = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');

// La pestaña «Leads»: la vista que arma habita. y, sin ella, lo que la cola ya trae. Datos sintéticos.
const snap = (over = {}) => ({ labels: { situations: {} }, stages: [{ key: 'sin-cuenta', title: 'Interactuó, sin cuenta', goal: 'Cuenta creada' }], queue: [], blocked: [], scheduled: [], executed: [], inbox: [], ...over });

test('usa la vista de habita. con sus estados, días y alertas', () => {
  const leads = {
    staleDays: 3,
    stages: [{ key: 'sin-cuenta', title: 'Interactuó, sin cuenta', goal: 'Cuenta creada', count: 2, states: { equipo: 1, lista: 1 }, rules: [{ key: 'sin-cuenta:principal', name: 'Envío panel', enabled: true, lastSentAt: '2026-11-12T12:00:00Z', pending: 2, states: {} }] }],
    rows: [
      { agencyId: 'a1', name: 'Uno', stage: 'sin-cuenta', state: 'equipo', who: 'Facu', reason: 'Pasada a Facu. Retomar para volver a ejecutar.', days: 6, lastRule: null },
      { agencyId: 'a2', name: 'Dos', stage: 'sin-cuenta', state: 'lista', reason: 'Puede salir ahora.', days: 1, lastRule: null },
    ],
    alerts: [{ kind: 'regla', ruleKey: 'sin-cuenta:principal', name: 'Envío panel', stage: 'sin-cuenta', days: 7, pending: 2, states: { equipo: 1, lista: 1 } }],
  };
  const n = F.normalize({ habita: snap({ leads, queue: [{ agencyId: 'a2', name: 'Dos', stage: 'sin-cuenta', action: 'principal' }] }) });
  const L = F.leads(n, 'habita');
  assert.equal(L.complete, true);
  assert.equal(L.alerts[0].name, 'Envío panel');
  assert.deepEqual(L.rows.map((r) => [r.key, r.queued]), [['habita:a1', false], ['habita:a2', true]]);
});

test('sin la vista, arma los pendientes de la cola y lo avisa como parcial', () => {
  const n = F.normalize({ turnia: snap({
    queue: [{ id: 't1', name: 'Lista', stage: 'sin-cuenta', action: 'Mensaje' }],
    scheduled: [{ id: 't2', name: 'Después', stage: 'sin-cuenta', action: 'Mensaje', dueAt: '2026-11-20T12:00:00Z' }],
    blocked: [{ id: 't3', name: 'Para Facu', stage: 'sin-cuenta', blocked: 'Pasada a Facu. Retomar para volver a ejecutar.' }, { id: 't4', name: 'Sin dato', stage: 'sin-cuenta', blocked: 'Sin WhatsApp: cargalo en la ficha.' }],
  }) });
  const L = F.leads(n, 'turnia');
  assert.equal(L.complete, false);
  assert.deepEqual(Object.fromEntries(L.rows.map((r) => [r.agencyId, r.state])), { t1: 'lista', t2: 'programada', t3: 'equipo', t4: 'bloqueada' });
  assert.deepEqual(L.stages[0].states, { lista: 1, programada: 1, equipo: 1, bloqueada: 1 });
});

test('la pestaña está en el menú y en las pestañas de Follow-up, con sus acciones', () => {
  assert.match(js, /\['leads','LEADS','◧'\]/);
  assert.match(js, /\['pipeline','EMBUDO'\],\['leads','LEADS'\]/);
  assert.match(js, /leads: fuLeads/);
  for (const a of ['leads-stage', 'leads-state', 'leads-pick', 'leads-retake']) assert.match(js, new RegExp(`case '${a}'`));
});

test('«Crear demo» a mano: la propiedad preparada o una nueva, también con la tarea bloqueada', () => {
  const prep = { prep: { items: [{ key: 'demo_listing_url', ok: true, demoId: 'd1' }] } };
  assert.equal(F.createDemoPath({ agencyId: 'a1', stage: 'sin-demo', demoKit: prep }), '/admin/inmobiliarias/a1/propiedades/d1?seccion=fotos');
  assert.equal(F.createDemoPath({ agencyId: 'a1', stage: 'sin-demo' }), '/admin/inmobiliarias/a1/propiedades/nueva');
  assert.equal(F.createDemoPath({ agencyId: 'a1', stage: 'no-abrio', demoKit: prep }), null);
  const n = F.normalize({ habita: snap({ blocked: [{ agencyId: 'a1', name: 'Uno', stage: 'sin-demo', blocked: 'Completar inmueble candidato en Prospectos.', demoKit: prep }] }) });
  assert.equal(n.blocked[0].createDemo, '/admin/inmobiliarias/a1/propiedades/d1?seccion=fotos');
  assert.equal(F.leads(n, 'habita').rows[0].createDemo, '/admin/inmobiliarias/a1/propiedades/d1?seccion=fotos');
  // Se ve sin tomar la tarea: en la tarjeta del celular, en el panel lateral de la cola, en la tarea y en Leads.
  for (const id of ['fu-mobile-create-demo', 'followup-preview-create-demo', 'fu-create-demo-mobile', 'leads-create-demo']) assert.match(js, new RegExp(id));
  assert.match(js, /os-fu-execution-card"><h2>[^\n]*\n\s*\$\{fuCreateDemo\(t,it,u\)\}/);
});
