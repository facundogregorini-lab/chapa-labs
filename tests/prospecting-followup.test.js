// La bandeja comercial: junta la cola de cada app en una forma común sin cambiar sus reglas.
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../prospecting/followup');

const NOW = Date.parse('2026-11-10T14:00:00Z');
const later = '2026-11-10T14:05:00Z';
const habita = {
  labels: { situations: { interesado: 'Interesado', sin_respuesta: 'Sin respuesta' }, groups: {} },
  summary: { ready: 2, replies: 1, demos: 0, scheduled: 1, blocked: 1, claimed: 1, doneToday: 3, newToday: 4 },
  stages: [{ key: 'no-contactado', title: 'No contactado', versions: [{ id: 'hv1', version: 1, status: 'active', channel: 'whatsapp', body: 'Hola {{decisor}}', action: 'principal' }] }, { key: 'no-responde', title: 'Contactado, no responde', versions: [] }],
  queue: [
    { agencyId: 'a1', name: 'Inmo Uno', person: 'Laura', stage: 'no-contactado', situation: 'sin_respuesta', action: 'principal', actionLabel: 'Saludo', group: 'nuevos', priority: 'baja', score: 80, versionId: 'hv1', lastAction: null, since: '2026-11-01' },
    { agencyId: 'a2', name: 'Inmo Dos', stage: 'no-responde', situation: 'interesado', action: 'presentacion', actionLabel: 'Presentación', group: 'respuestas', priority: 'alta', versionId: 'hv2', claim: { actorId: 'x', by: 'Facu', until: later }, lastAction: { at: '2026-11-09T10:00:00Z', text: 'Respondió' } },
  ],
  scheduled: [{ agencyId: 'a3', name: 'Inmo Tres', stage: 'no-responde', dueAt: '2026-11-12T12:00:00Z', group: 'seguimientos', priority: 'media' }],
  blocked: [{ agencyId: 'a4', name: 'Inmo Cuatro', stage: 'no-contactado', situation: 'sin_respuesta', blocked: 'Fuera de horario' }],
  rules: [{ key: 'r1', stage: 'no-responde', situations: ['interesado'], action: 'presentacion', after_hours: 0, enabled: true, hours_from: 9, hours_to: 19 }],
  results: { windows: { todo: { versions: [{ versionId: 'hv1', executed: 40, conversions: 10, medianHours: 20, best: true }] } }, byActor: [{ actor: 'Facundo', executions: 40, conversions: 10, rate: 0.25 }] },
};
const turnia = {
  labels: { situations: { confirmo_numero: 'Respondió el saludo' } },
  summary: { ready: 1, replies: 1, demos: 1, scheduled: 0, blocked: 0, claimed: 0, doneToday: 2, newToday: 5 },
  stages: [{ key: 'saludo-sin-demo', title: 'Saludado, sin demo', versions: [{ id: 'tv1', version: 2, status: 'test', channel: 'whatsapp', body: 'Hola {saludo}', stats: { executions: 5, conversions: 1 } }] }],
  queue: [{ id: 't1', code: 'ana-111', name: 'Ana', business: 'Consultorio Ana', stage: 'saludo-sin-demo', stageTitle: 'Saludado, sin demo', situation: 'confirmo_numero', action: 'Mandar la demo', group: 'demos', priority: 'alta', ads: true, owner: 'Axel', versionId: 'tv1', since: '2026-11-08T10:00:00Z' }],
  scheduled: [],
  blocked: [],
  rules: [{ stage: 'saludo-sin-demo', title: 'Saludado, sin demo', action: 'Mandar la demo', wait: 'El mismo día', exit: 'Demo enviada' }],
  results: { byActor: [{ actor: 'Facu', executions: 3, conversions: 1, rate: 1 / 3 }] },
};

test('junta las dos colas: prioridad y grupo (las respuestas primero)', () => {
  const n = F.normalize({ habita, turnia: { ...turnia }, otra: { error: 'Falta la clave' } }, NOW);
  assert.deepEqual(n.queue.map((x) => x.key), ['habita:a2', 'turnia:t1', 'habita:a1']);
  assert.equal(n.errors.otra, 'Falta la clave');
  const generic = F.item('habita', { agencyId: 'g', stage: 'no-contactado', action: 'principal', actionLabel: 'Next best action' }, { stages: [{ key: 'no-contactado', title: 'No contactado', goal: 'Contactado' }] }, 'cola');
  assert.equal(generic.action, 'Llevar a: Contactado');
  const a2 = n.queue.find((x) => x.id === 'a2');
  assert.deepEqual(a2.claim, { by: 'Facu', until: later });
  assert.equal(a2.action, 'Presentación');
  assert.equal(a2.actionKey, 'presentacion');
  assert.equal(a2.situationLabel, 'Interesado');
  assert.equal(a2.stageTitle, 'Contactado, no responde');
  const t1 = n.queue.find((x) => x.id === 't1');
  assert.equal(t1.actionKey, null);
  assert.equal(t1.sub, 'Consultorio Ana');
  assert.equal(n.scheduled[0].bucket, 'programada');
  assert.equal(n.blocked[0].blocked, 'Fuera de horario');
  // Una toma vencida no cuenta.
  const old = F.normalize({ habita }, Date.parse('2026-11-10T15:00:00Z'));
  assert.equal(old.queue.find((x) => x.id === 'a2').claim, null);
});

test('filtros, contadores y campos de cada operación', () => {
  const n = F.normalize({ habita, turnia }, NOW);
  assert.deepEqual(F.filter(n.queue, { unit: 'turnia' }).map((x) => x.id), ['t1']);
  assert.deepEqual(F.filter(n.queue, { owner: 'Axel' }).map((x) => x.id), ['t1']);
  assert.deepEqual(F.filter(n.queue, { owner: '—' }).map((x) => x.id), ['a2', 'a1']);
  assert.deepEqual(F.filter(n.queue, { priority: 'baja' }).map((x) => x.id), ['a1']);
  assert.deepEqual(F.filter(n.queue, { q: 'laura' }).map((x) => x.id), ['a1']);
  assert.deepEqual(F.summary(n), { ready: 3, replies: 2, demos: 1, scheduled: 1, blocked: 1, claimed: 1, doneToday: 5, newToday: 9 });
  assert.equal(F.summary(n, 'habita').ready, 2);
  assert.deepEqual(F.taskFields(n.queue.find((x) => x.id === 'a2')), { inmobiliaria: 'a2', etapa: 'no-responde', version: 'hv2', tarea: 'presentacion' });
  assert.deepEqual(F.taskFields(n.queue.find((x) => x.id === 't1')), { inmobiliaria: 't1', etapa: 'saludo-sin-demo', version: 'tv1' });
});

test('el mensaje armado de cualquiera de las dos apps queda igual', () => {
  const h = F.prepared('habita', { agencyId: 'a1', name: 'Inmo Uno', stage: 'no-contactado', action: 'principal', actionLabel: 'Saludo', versionId: 'hv1', version: 1, message: 'Hola\n---\nSoy Facu', messages: ['Hola', 'Soy Facu'], whatsappUrl: 'https://web.whatsapp.com/send?phone=549', checklist: [{ key: 'horario', label: 'Horario', ok: true }], history: [{ at: '2026-11-01', text: 'Importada' }] });
  assert.deepEqual(h.messages, ['Hola', 'Soy Facu']);
  assert.equal(h.actionKey, 'principal');
  assert.equal(h.whatsappUrl, 'https://web.whatsapp.com/send?phone=549');
  const t = F.prepared('turnia', { id: 't1', name: 'Ana', stage: 'saludo-sin-demo', versionId: 'tv1', version: 2, message: 'Hola Ana\n---\nTu demo', whatsapp: { web: 'https://web.whatsapp.com/send?phone=5492235', app: 'https://wa.me/5492235' }, item: turnia.queue[0] });
  assert.deepEqual(t.messages, ['Hola Ana', 'Tu demo']);
  assert.equal(t.whatsappUrl, 'https://web.whatsapp.com/send?phone=5492235');
  assert.equal(t.actionKey, null);
  assert.equal(t.item.name, 'Ana');
});

test('versiones, reglas y resultados por quien ejecutó, con los números de cada app', () => {
  const hv = F.versionRows('habita', habita);
  assert.deepEqual(hv.map((v) => [v.version, v.executed, v.conversions, v.rate, v.small, v.best]), [[1, 40, 10, 0.25, false, true]]);
  const tv = F.versionRows('turnia', turnia);
  assert.deepEqual(tv.map((v) => [v.stageTitle, v.status, v.executed, v.small]), [['Saludado, sin demo', 'test', 5, true]]);
  const hr = F.ruleRows('habita', habita);
  assert.equal(hr[0].when, 'Interesado');
  assert.equal(hr[0].action, 'Presentación');
  assert.equal(hr[0].wait, 'Enseguida');
  assert.equal(hr[0].editable, true);
  const tr = F.ruleRows('turnia', turnia);
  assert.deepEqual([tr[0].when, tr[0].wait, tr[0].editable], ['Al entrar en la etapa', 'El mismo día', false]);
  const n = F.normalize({ habita, turnia }, NOW);
  assert.deepEqual(F.actorRows(n).map((r) => [r.unit, r.actor, r.executions]), [['habita', 'Facundo', 40], ['turnia', 'Facu', 3]]);
});

test('WhatsApp: la última lectura de Turnia, con cada pendiente vinculado a su tarea', () => {
  const units = {
    turnia: {
      queue: [], scheduled: [], blocked: [{ id: 't1', code: 'ana-a1', name: 'Ana', stage: 'converso-sin-cuenta', blocked: 'Fuera de horario' }],
      whatsapp: {
        at: '2026-11-08T11:00:00Z', trigger: 'Lectura diaria',
        lines: [{ line: '0022', status: 'ok', chats: 40, prospects: 12, read: 12, unread: 0 }, { line: '5483', status: 'sin_configurar' }, { line: '9999', status: 'error', problem: 'store' }],
        totals: { conversaciones: 12, respondieron: 4, esperanRespuesta: 2, nuevas: 1, abiertas: 1 },
        pending: [{ code: 'ana-a1', name: 'Ana', line: '0022', at: '2026-11-07 10:00', text: 'me interesa' }, { code: 'otro', name: 'Otro', line: '0022', at: '2026-11-07 11:00', text: 'x' }],
      },
    },
    habita: { queue: [], scheduled: [], blocked: [] },
  };
  const n = F.normalize(units, NOW);
  const w = F.whatsapp(n);
  assert.equal(w.totals.respondieron, 4);
  assert.deepEqual(w.lines.map((l) => [l.line, l.ok, l.text]), [
    ['0022', true, '12 de la base con chat'],
    ['5483', false, 'Sin conectar: falta su WAHA en Turnia'],
    ['9999', false, 'store'],
  ]);
  assert.deepEqual(w.pending.map((p) => p.key), ['turnia:t1', null]);
  assert.equal(F.whatsapp(n, 'habita'), null);
  assert.equal(F.whatsapp(F.normalize({ turnia: { queue: [], whatsapp: null } }, NOW)).never, true);
});
