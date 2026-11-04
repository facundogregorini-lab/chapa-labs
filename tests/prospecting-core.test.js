// node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../prospecting/core');
const { UNITS } = require('../prospecting/units');

const { turnia, habita } = UNITS;

test('reconoce los encabezados de la planilla espejo de Turnia', () => {
  const head = ['Código', 'Nombre', 'Trato', 'Saludo', 'Consultorio', 'Zona', 'Dirección', 'Especialidad', 'Teléfono', 'De quién es el teléfono', 'Instagram', 'Email', 'Web', 'Prioridad', 'Estado', 'Mensajes', 'Saludo enviado', 'Primer contacto', 'Último contacto', 'Último canal', 'Próximo paso', 'Abrió su demo', 'Veces que la abrió', 'Probó la demo', 'Link de su demo', 'Señales', 'Fuente', 'Notas', 'Actualizado'];
  const m = C.mapHeaders(head);
  assert.equal(m.id, 0);
  assert.equal(m.name, 1);
  assert.equal(m.title, 2);
  assert.equal(m.greeting, 3);
  assert.equal(m.org, 4);
  assert.equal(m.phone, 8);
  assert.equal(m.phoneKind, 9);
  assert.equal(m.stage, 14);
  assert.equal(m.touches, 15);
  assert.equal(m.firstContact, 17);
  assert.equal(m.demoOpened, 21);
  assert.equal(m.demoTried, 23);
  assert.equal(m.demoUrl, 24);
  assert.equal(m.updated, 28);
});

test('reconoce los encabezados de la planilla de habita.', () => {
  const head = ['Prioridad', 'Score', 'Inmobiliaria', 'SDR', 'Estado', 'Fecha envío', 'Notas', 'Zona', 'WhatsApp', 'Confianza del número', 'Email', 'Web'];
  const m = C.mapHeaders(head);
  assert.equal(m.priority, 0);
  assert.equal(m.score, 1);
  assert.equal(m.name, 2);
  assert.equal(m.sdr, 3);
  assert.equal(m.stage, 4);
  assert.equal(m.firstContact, 5);
  assert.equal(m.phone, 8);
  assert.equal(m.phoneKind, 9);
});

test('traduce los estados de las dos planillas a las etapas comunes', () => {
  const cases = {
    Pendiente: 'por_contactar', Enviado: 'contactado', 'Número incorrecto': 'invalido', 'No interesado': 'perdido', 'No le interesa': 'perdido',
    Interesado: 'interesado', 'Respondió': 'respondio', 'Reunión': 'reunion', Cliente: 'cliente', 'Pidió no recibir más': 'baja', 'Demo enviada': 'contactado',
    'No tiene WhatsApp': 'invalido', '': 'por_contactar', respondio: 'respondio', no_interesa: 'perdido',
  };
  for (const [text, stage] of Object.entries(cases)) assert.equal(C.stageFromText(text), stage, text);
  // Cada etapa, escrita con el nombre de la unidad, se vuelve a leer igual.
  for (const u of [turnia, habita]) for (const k of C.STAGE_KEYS) assert.equal(C.stageFromText(u.stageLabel(k)), k, `${u.id}:${k}`);
});

test('lee fechas de la planilla en los formatos habituales', () => {
  assert.equal(C.parseDate('23/10/2026'), '2026-10-23');
  assert.equal(C.parseDate('3/11/2026 9:05'), '2026-11-03 09:05');
  assert.equal(C.parseDate('2026-11-03 14:20'), '2026-11-03 14:20');
  assert.equal(C.parseDate('Sí'), 'sí');
  assert.equal(C.parseDate('No'), '');
});

test('días hábiles salta el fin de semana', () => {
  assert.equal(C.addBusinessDays('2026-10-30', 2), '2026-11-03'); // viernes + 2 → martes
  assert.equal(C.addBusinessDays('2026-11-02', 4), '2026-11-06');
});

function sheet(rows) {
  return [['ID', 'Nombre', 'Teléfono', 'De quién es el teléfono', 'Zona', 'Prioridad', 'Estado', 'Primer contacto', 'Respondió', 'Abrió la demo'], ...rows];
}

test('embudo: cada etapa incluye a las siguientes y la cohorte usa el primer contacto', () => {
  const { accounts } = C.toAccounts(sheet([
    ['a', 'Ana', '2231111111', 'celular', 'MdP', '1', 'Por contactar', '', '', ''],
    ['b', 'Beto', '2232222222', 'celular', 'MdP', '2', 'Demo enviada', '2026-10-20 09:00', '', '2026-10-20'],
    ['c', 'Caro', '2233333333', 'celular', 'Miramar', '1', 'Cliente', '2026-10-21 09:00', '', ''],
    ['d', 'Dani', '2234444444', 'celular', 'MdP', '1', 'No le interesa', '2026-11-01 09:00', '2026-11-01', ''],
    ['e', 'Eli', '2234444445', 'fijo', 'MdP', '3', 'Demo enviada', '2026-11-01 09:00', '', ''],
  ]), turnia);
  const f = C.funnel(accounts, turnia, { todayDay: '2026-11-03' });
  assert.equal(f.prospectados, 4, 'el fijo sin respuesta no cuenta en Turnia');
  assert.equal(f.contactados, 3);
  assert.equal(f.respondieron, 2, 'cliente y no le interesa respondieron');
  assert.equal(f.interesados, 1);
  assert.equal(f.clientes, 1);
  assert.equal(f.perdidos, 1);
  assert.equal(f.abrieronDemo, 1);
  const oct = C.funnel(accounts, turnia, { range: { from: '2026-10-01', to: '2026-10-31' }, todayDay: '2026-11-03' });
  assert.equal(oct.contactados, 2);
  assert.equal(oct.prospectados, 4, 'prospectados no depende del período');
  // En habita. el fijo sí cuenta como prospectado.
  assert.equal(C.funnel(accounts, habita).prospectados, 5);
});

test('cola de Turnia: saludo primero, nada a fijos, meta del día', () => {
  const { accounts } = C.toAccounts(sheet([
    ['a', 'Ana', '2231111111', 'celular', 'MdP', '2', '', '', '', ''],
    ['b', 'Beto', '2232222222', 'celular', 'MdP', '1', '', '', '', ''],
    ['c', 'Caro', '2233333333', 'fijo', 'MdP', '1', '', '', '', ''],
  ]), turnia);
  const q = C.queue(accounts, turnia, { todayDay: '2026-11-03' });
  assert.deepEqual(q.fresh.map((a) => a.id), ['b', 'a']);
  assert.equal(C.nextTemplate(q.fresh[0], turnia).key, 'whatsapp_saludo');
  assert.equal(C.nextTemplate(q.fresh[0], turnia).kind, 'saludo');
});

test('acciones: el saludo no cuenta como mensaje y la secuencia agenda el seguimiento', () => {
  const { accounts } = C.toAccounts(sheet([['a', 'Ana', '2231111111', 'celular', 'MdP', '1', '', '', '', '']]), turnia);
  let a = accounts[0];
  const now = '2026-11-02 09:10';
  let r = C.applyAction(a, { type: 'sent', kind: 'saludo', channel: 'whatsapp', template: 'whatsapp_saludo' }, { unit: turnia, now, by: 'Axel' });
  assert.equal(r.patch.stage, 'saludado');
  assert.equal(r.patch.touches, undefined);
  assert.equal(r.patch.firstContact, now);
  assert.equal(r.events[0].type, 'saludo');
  a = { ...a, ...r.patch };
  r = C.applyAction(a, { type: 'sent', kind: 'mensaje', channel: 'whatsapp', template: 'whatsapp_1' }, { unit: turnia, now: '2026-11-02 13:00', by: 'Axel' });
  assert.equal(r.patch.touches, 1);
  assert.equal(r.patch.stage, 'contactado');
  assert.equal(r.patch.nextAt, '2026-11-04');
  assert.equal(r.patch.firstContact, undefined, 'el primer contacto no se pisa');
  a = { ...a, ...r.patch };
  r = C.applyAction(a, { type: 'outcome', outcome: 'reunion', detail: 'Martes 10 h' }, { unit: turnia, now: '2026-11-03 10:00', by: 'Axel' });
  assert.equal(r.patch.stage, 'reunion');
  assert.ok(r.patch.replied && r.patch.interested && r.patch.meeting);
  a = { ...a, ...r.patch };
  r = C.applyAction(a, { type: 'outcome', outcome: 'baja' }, { unit: turnia, now: '2026-11-03 11:00', by: 'Axel' });
  assert.equal(r.patch.stage, 'baja');
  assert.ok(r.patch.optOut);
  a = { ...a, ...r.patch };
  assert.equal(C.canMessage(a, turnia), false);
});

test('las ediciones solo tocan campos permitidos', () => {
  const a = { id: 'a', name: 'Ana', touches: 0, stage: 'por_contactar' };
  const r = C.applyAction(a, { type: 'edit', fields: { phone: ' 223 555 ', touches: 9, stage: 'cliente' } }, { unit: habita, by: 'x' });
  assert.equal(r.patch.phone, '223 555');
  assert.equal(r.patch.touches, undefined);
  assert.equal(r.patch.stage, undefined);
});

test('respuestas por plantilla: último toque dentro de la ventana y muestra chica', () => {
  const ev = (at, id, type, template = '') => ({ at, id, type, template });
  const events = [
    ev('2026-10-01 09:00', 'a', 'mensaje', 'whatsapp_1'),
    ev('2026-10-03 09:00', 'a', 'mensaje', 'whatsapp_2'),
    ev('2026-10-04 09:00', 'a', 'respondio'),
    ev('2026-10-01 09:00', 'b', 'mensaje', 'whatsapp_1'),
    ev('2026-10-20 09:00', 'b', 'respondio'),
    ev('2026-11-02 09:00', 'c', 'mensaje', 'whatsapp_1'),
  ];
  const s = Object.fromEntries(C.templateStats(events, turnia, '2026-11-03').map((x) => [x.template, x]));
  assert.equal(s.whatsapp_1.enviados, 3);
  assert.equal(s.whatsapp_1.respuestas, 0, 'la respuesta de a va al seguimiento y la de b llegó tarde');
  assert.equal(s.whatsapp_1.maduros, 2, 'el envío de c todavía está en observación');
  assert.equal(s.whatsapp_2.respuestas, 1);
  assert.equal(s.whatsapp_2.muestraChica, true);
});

test('deshacer anula el último contacto en la actividad por día', () => {
  const events = [
    { at: '2026-11-03 09:00', id: 'a', type: 'mensaje' },
    { at: '2026-11-03 09:05', id: 'a', type: 'deshacer' },
    { at: '2026-11-03 09:10', id: 'b', type: 'mensaje' },
  ];
  const d = C.daily(events, [], turnia);
  assert.equal(d[0].contactos, 1);
});

test('plantillas y link de WhatsApp', () => {
  const a = { name: 'Laura Pérez', title: 'Dra.', greeting: 'Laura', org: 'Consultorio Pérez', demoUrl: 'https://x.test/p/abc', phone: '223 155-123456' };
  assert.equal(C.renderTemplate(turnia.templates.whatsapp_saludo_consultorio.text, a, turnia), '¡Buenas! ¿Hablo con el consultorio de la Dra. Pérez?');
  assert.match(C.renderTemplate(turnia.templates.whatsapp_1.text, a, turnia), /https:\/\/x\.test\/p\/abc/);
  assert.equal(C.waLink('2235123456', 'hola'), 'https://wa.me/5492235123456?text=hola');
  assert.equal(C.waLink('+54 9 223 512-3456', ''), 'https://wa.me/5492235123456');
});

test('habita.: la fecha de envío se escribe como día, igual que su planilla', () => {
  assert.equal(C.cellValue('firstContact', '2026-11-03 09:10', habita), '03/11/2026');
  assert.equal(C.cellValue('lastContact', '2026-11-03 09:10', habita), '2026-11-03 09:10');
  assert.equal(C.cellValue('firstContact', '2026-11-03 09:10', turnia), '2026-11-03 09:10');
  assert.equal(C.cellValue('stage', 'contactado', habita), 'Enviado');
});

test('planillas reales: columnas de habita. y estados de la app de Turnia', () => {
  const habitaHead = ['Prioridad', 'Score Habita /100', 'Inmobiliaria', 'SDR', 'Quién decide', 'Abrir WhatsApp', 'Número (sin 0 ni 15)', 'Confianza del número', 'Fuente del número', 'Estado', 'Fecha envío', 'Notas', 'Propiedades publicadas (Argenprop)', 'Avisos vistos en muestra', 'Pts contacto /20', 'Pts decisión /15', 'Pts cartera /25', 'Pts encaje /40', 'Dirección', 'Zona', 'Web', 'Instagram', 'Email', 'Perfil Argenprop', 'Otros teléfonos', 'Grupo Habita', 'Motivo / próximo paso'];
  const m = C.mapHeaders(habitaHead);
  assert.equal(m.phone, 6);
  assert.equal(m.score, 1);
  assert.equal(m.segment, 25);
  assert.equal(m.signals, 26, 'la nota de investigación no es el próximo paso del panel');
  assert.equal(m.nextStep, undefined);
  const { accounts } = C.toAccounts([
    ['Código', 'Nombre', 'Teléfono', 'De quién es el teléfono', 'Estado', 'Mensajes', 'Saludo enviado', 'Primer contacto'],
    ['a', 'Ana', '2231', 'Celular de la persona', 'Contactado', '0', '2026-11-02 21:24', '2026-11-02 21:24'],
    ['b', 'Beto', '2232', 'Celular del consultorio', 'Contactado', '1', '2026-11-02 21:24', '2026-11-02 21:24'],
    ['c', 'Caro', '2233', 'Fijo', 'Sin WhatsApp', '0', '', ''],
  ], turnia);
  assert.deepEqual(accounts.map((a) => a.stage), ['saludado', 'contactado', 'invalido']);
  assert.deepEqual(accounts.map((a) => a.phoneKind), ['celular', 'compartido', 'fijo']);
});

test('credenciales de Google: JSON entero, o solo la clave con el email aparte', () => {
  const path = require('node:path');
  const file = path.resolve(__dirname, '../api/_google.js');
  const load = (env) => {
    for (const k of ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY']) delete process.env[k];
    Object.assign(process.env, env);
    delete require.cache[file];
    return require(file);
  };
  const key = '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n';
  let g = load({ GOOGLE_SERVICE_ACCOUNT_JSON: key });
  assert.match(g.problem(), /solo la clave privada/);
  g = load({ GOOGLE_SERVICE_ACCOUNT_JSON: key, GOOGLE_SERVICE_ACCOUNT_EMAIL: 'bot@x.iam.gserviceaccount.com' });
  assert.equal(g.problem(), null);
  assert.equal(g.serviceEmail(), 'bot@x.iam.gserviceaccount.com');
  g = load({ GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'b@x.iam.gserviceaccount.com', private_key: key }) });
  assert.equal(g.problem(), null);
  g = load({});
  assert.match(g.problem(), /Falta/);
  delete require.cache[file];
  for (const k of ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_EMAIL']) delete process.env[k];
});

test('embudo contra la meta: base por semana, conversión por paso y fuente', () => {
  const unit = { targets: [
    { key: 'saludos', perWeek: 250, sheet: (a) => Boolean(a.firstContact) },
    { key: 'demos', rate: 0.15, sheet: (a) => a.touches >= 1 },
    { key: 'cuentas', rate: 0.5, metrics: 'uso.clinicas' },
    { key: 'pagos', rate: 0.25, metrics: 'nada.aca' },
  ] };
  const accounts = [
    { id: 'a', firstContact: '2026-11-02 10:00', touches: 1, stage: 'contactado' },
    { id: 'b', firstContact: '2026-11-03 10:00', touches: 0, stage: 'saludado' },
    { id: 'c', firstContact: '', touches: 0, stage: 'por_contactar' },
  ];
  const tf = C.targetFunnel(accounts, unit, { range: { from: '2026-10-28', to: '2026-11-03' }, todayDay: '2026-11-03', metrics: { uso: { clinicas: 3 } } });
  assert.equal(tf.weeks, 1);
  assert.deepEqual(tf.steps.map((s) => s.actual), [2, 1, 3, null]);
  assert.deepEqual(tf.steps.map((s) => Math.round(s.target * 100) / 100), [250, 37.5, 18.75, 4.69]);
  assert.equal(tf.steps[1].rate, 0.5);
  assert.equal(tf.steps[1].rateOk, true);
  assert.equal(tf.steps[0].onTarget, false);
  assert.deepEqual(tf.steps.map((s) => s.source), ['sheet', 'sheet', 'app', 'none']);
});

test('embudo contra la meta de Turnia con datos como los de su planilla: visitadas incluye a quienes conversaron', () => {
  const { turnia } = require('../prospecting/units').UNITS;
  const a = (o) => ({ firstContact: '2026-11-02 10:00', greetingSent: '2026-11-02 10:00', touches: 1, stage: 'contactado', phoneKind: 'celular', ...o });
  const accounts = [
    a({ demoOpened: '2026-11-02 11:00' }),
    a({ demoOpened: '2026-11-02 11:00', demoTried: '2026-11-02 11:01', demoClinic: '2026-11-02 11:01' }),
    a({ demoOpened: '2026-11-02 11:00', demoTried: '2026-11-02 11:01', demoClinic: '2026-11-02 11:01', demoChat: '2026-11-02 11:02' }),
    a({ demoChat: '2026-11-02 11:02' }), // conversó sin que se registrara la apertura: igual cuenta como visita
    a({ touches: 0 }),
    a({ touches: 0, stage: 'saludado' }),
  ];
  const tf = C.targetFunnel(accounts, turnia, { range: { from: '2026-10-28', to: '2026-11-03' }, todayDay: '2026-11-03', metrics: { uso: { clinicas: 1, clinicas_activas: 1 } } });
  const by = Object.fromEntries(tf.steps.map((s) => [s.key, s.actual]));
  assert.deepEqual(by, { saludos: 6, demos: 4, visitadas: 4, interaccion: 2, cuentas: 0, activas: 0, pagos: 0 });
  for (let i = 1; i < 4; i++) assert.ok(tf.steps[i].actual <= tf.steps[i - 1].actual, tf.steps[i].key);
});

test('Turnia: cuentas creadas y activas son por persona (no cuenta clínicas de otras fuentes)', () => {
  const { turnia } = require('../prospecting/units').UNITS;
  const a = (o) => ({ firstContact: '2026-11-02 10:00', touches: 1, stage: 'contactado', phoneKind: 'celular', ...o });
  const accounts = [a({ demoOpened: 'sí', demoChat: 'sí', accountAt: '2026-11-03 10:00', accountActive: '2026-11-03 12:00' }), a({ demoOpened: 'sí' }), a({})];
  // La app dice 1 clínica activa (por ejemplo, una de otra fuente): no se usa.
  const tf = C.targetFunnel(accounts, turnia, { range: { from: '2026-10-28', to: '2026-11-03' }, todayDay: '2026-11-03', metrics: { uso: { clinicas: 5, clinicas_activas: 5 } } });
  const by = Object.fromEntries(tf.steps.map((s) => [s.key, [s.actual, s.source]]));
  assert.deepEqual(by.cuentas, [1, 'sheet']);
  assert.deepEqual(by.activas, [1, 'sheet']);
  assert.deepEqual(C.toAccounts([['Código', 'Nombre', 'Cuenta creada', 'Clínica de la cuenta', 'Cuenta activa'], ['x', 'X', '2026-11-03 10:00', 'Clínica X', '']], turnia).accounts[0].accountClinic, 'Clínica X');
});

test('modo Enviar: WhatsApp Web directo, franjas horarias y un reintento no se registra dos veces', () => {
  assert.equal(C.waWebLink('223 512-3456', 'Hola Ana'), 'https://web.whatsapp.com/send?phone=5492235123456&text=Hola%20Ana');
  const unit = { sendWindows: [['08:30', '09:30'], ['13:00', '14:30']] };
  assert.equal(C.inSendWindow(unit, '2026-11-04 08:45'), true);
  assert.equal(C.inSendWindow(unit, '2026-11-04 09:30'), false);
  assert.equal(C.nextSendWindow(unit, '2026-11-04 10:00'), 'hoy a las 13:00');
  assert.equal(C.nextSendWindow(unit, '2026-11-04 15:00'), 'mañana a las 08:30');
  const ev = [{ id: 'a', type: 'saludo', template: 'whatsapp_saludo', at: '2026-11-04 08:40' }];
  assert.equal(C.isReplay(ev, 'a', 'saludo', 'whatsapp_saludo', '2026-11-04 08:41'), true);
  assert.equal(C.isReplay(ev, 'a', 'saludo', 'whatsapp_saludo', '2026-11-04 08:45'), false, 'pasados 2 minutos es otro envío');
  assert.equal(C.isReplay(ev, 'a', 'mensaje', 'whatsapp_1', '2026-11-04 08:41'), false, 'otro paso no es reintento');
  assert.equal(C.isReplay([...ev, { id: 'a', type: 'deshacer', at: '2026-11-04 08:41' }], 'a', 'saludo', 'whatsapp_saludo', '2026-11-04 08:41'), false);
});
