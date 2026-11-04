// La función /api/prospecting con una planilla de Google simulada en memoria.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.PROSPECTING_PASSWORD = 'una-clave-larga-de-prueba';
process.env.HABITA_PROSPECTING_SHEET_ID = 'sheet-habita';
process.env.TURNIA_PROSPECTING_SHEET_ID = 'sheet-turnia';
delete process.env.TURNIA_SIGNALS_SHEET_ID;

// Planilla falsa: pestañas como matrices de texto.
const book = {
  title: 'Prospecting Habita',
  tabs: {
    Prospectos: [
      ['Código', 'Nombre', 'Teléfono', 'De quién es el teléfono', 'Zona', 'Estado', 'Notas'],
      ['abc', 'Laura Pérez', '2235123456', 'celular', 'Mar del Plata', 'Por contactar', ''],
      ['', 'Sin Código', '2235000000', 'celular', 'Miramar', '', 'importada a mano'],
    ],
  },
};
const fake = {
  configured: () => true,
  serviceEmail: () => 'bot@proyecto.iam.gserviceaccount.com',
  colLetter: (i) => String.fromCharCode(65 + i),
  tabs: async () => ({ title: book.title, tabs: Object.keys(book.tabs) }),
  readTabs: async (id, names) => Object.fromEntries(names.map((n) => [n, (book.tabs[n] || []).map((r) => r.slice())])),
  addTabs: async (id, names) => { for (const n of names) book.tabs[n] = book.tabs[n] || []; },
  writeCells: async (id, cells) => {
    for (const c of cells) {
      const t = book.tabs[c.tab];
      while (t.length < c.row) t.push([]);
      const r = t[c.row - 1];
      while (r.length <= c.col) r.push('');
      r[c.col] = String(c.value);
    }
  },
  writeRange: async (id, tab, start, rows) => { rows.forEach((r, i) => { book.tabs[tab][start - 1 + i] = r.slice(); }); },
  appendRows: async (id, tab, rows) => { book.tabs[tab].push(...rows.map((r) => r.map(String))); },
};
require.cache[path.resolve(__dirname, '../api/_google.js')] = { id: 'x', filename: 'x', loaded: true, exports: fake };
const handler = require('../api/prospecting');

function call(op, { method = 'GET', body, query = {}, cookie } = {}) {
  const req = { method, query: { op, ...query }, body, headers: { cookie: cookie || '', 'content-type': body ? 'application/json' : '' } };
  const res = {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(s) { this.statusCode = s; return this; },
    json(o) { this.body = o; return this; },
  };
  return Promise.resolve(handler(req, res)).then(() => res);
}

let cookie = '';

test('sin sesión no devuelve datos', async () => {
  const r = await call('data', { query: { unit: 'habita' } });
  assert.equal(r.statusCode, 401);
});

test('la contraseña incorrecta no abre sesión', async () => {
  const r = await call('login', { method: 'POST', body: { name: 'Axel', password: 'otra' } });
  assert.equal(r.statusCode, 401);
});

test('login, lectura y una acción que escribe la fila y la actividad', async () => {
  const login = await call('login', { method: 'POST', body: { name: 'Axel', password: 'una-clave-larga-de-prueba' } });
  assert.equal(login.statusCode, 200);
  cookie = login.headers['set-cookie'].split(';')[0];
  assert.match(login.headers['set-cookie'], /HttpOnly/);

  const data = await call('data', { query: { unit: 'habita' }, cookie });
  assert.equal(data.statusCode, 200);
  assert.equal(data.body.accounts.length, 2);
  assert.ok(data.body.sheet.missingColumns.includes('Primer contacto'));
  const laura = data.body.accounts.find((a) => a.id === 'abc');

  const act = await call('action', { method: 'POST', cookie, body: { unit: 'habita', id: 'abc', version: laura.updated, action: { type: 'sent', kind: 'saludo', channel: 'whatsapp', template: 'whatsapp_saludo' } } });
  assert.equal(act.statusCode, 200, JSON.stringify(act.body));
  const head = book.tabs.Prospectos[0];
  const row = book.tabs.Prospectos[1];
  assert.equal(row[head.indexOf('Estado')], 'Saludado');
  assert.ok(row[head.indexOf('Primer contacto')]);
  assert.ok(row[head.indexOf('Actualizado')]);
  assert.equal(book.tabs.Actividad[0][0], 'Fecha');
  assert.equal(book.tabs.Actividad[1][3], 'saludo');
  assert.equal(book.tabs.Actividad[1][7], 'Axel');

  // Con la versión vieja, no se pisa: 409 y la cuenta nueva.
  const stale = await call('action', { method: 'POST', cookie, body: { unit: 'habita', id: 'abc', version: laura.updated, action: { type: 'note', text: 'hola' } } });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.account.stage, 'saludado');
});

test('una fila sin ID recibe uno estable al primer cambio', async () => {
  const data = await call('data', { query: { unit: 'habita' }, cookie });
  const sin = data.body.accounts.find((a) => a.name === 'Sin Código');
  assert.equal(sin.id, 'fila-sin-codigo');
  const r = await call('action', { method: 'POST', cookie, body: { unit: 'habita', id: sin.id, version: sin.updated, action: { type: 'note', text: 'Llamar a la tarde' } } });
  assert.equal(r.statusCode, 200);
  assert.equal(book.tabs.Prospectos[2][0], 'fila-sin-codigo');
  assert.match(book.tabs.Prospectos[2][book.tabs.Prospectos[0].indexOf('Notas')], /importada a mano\n\d{4}-\d{2}-\d{2}: Llamar a la tarde/);
});

test('preparar la planilla agrega pestañas, columnas y plantillas', async () => {
  const r = await call('setup', { method: 'POST', cookie, body: { unit: 'habita' } });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  assert.ok(book.tabs.Mensajes.length > 3);
  assert.equal(book.tabs.Mensajes[0][0], 'Clave');
  assert.ok(book.tabs.Prospectos[0].includes('Fecha del próximo paso'));
});

test('Turnia es de solo lectura: su planilla la escribe la app', async () => {
  const r = await call('action', { method: 'POST', cookie, body: { unit: 'turnia', id: 'abc', action: { type: 'note', text: 'x' } } });
  assert.equal(r.statusCode, 403);
  const s = await call('setup', { method: 'POST', cookie, body: { unit: 'turnia' } });
  assert.equal(s.statusCode, 403);
});

test('sin contraseña el panel queda abierto y solo pide un nombre', async () => {
  const saved = process.env.PROSPECTING_PASSWORD;
  delete process.env.PROSPECTING_PASSWORD;
  try {
    const s = await call('session');
    assert.equal(s.body.open, true);
    assert.equal(s.body.user, null);
    const login = await call('login', { method: 'POST', body: { name: 'Facu' } });
    assert.equal(login.statusCode, 200);
    const c = login.headers['set-cookie'].split(';')[0];
    const again = await call('session', { cookie: c });
    assert.equal(again.body.user.name, 'Facu');
  } finally {
    process.env.PROSPECTING_PASSWORD = saved;
  }
});

test('unidad sin planilla configurada', async () => {
  delete process.env.TURNIA_PROSPECTING_SHEET_ID;
  const r = await call('data', { query: { unit: 'turnia' }, cookie });
  assert.equal(r.statusCode, 503);
  assert.equal(r.body.code, 'NO_SHEET');
});

test('Turnia con la clave: las acciones van a su API y vuelve la fila nueva', async () => {
  process.env.TURNIA_PROSPECTING_SHEET_ID = 'sheet-turnia';
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  book.tabs['Prospección'] = [['Código', 'Nombre', 'Estado', 'Mensajes'], ['ana-111', 'Ana', 'Por contactar', '0']];
  const realFetch = global.fetch;
  let sent = null;
  global.fetch = async (url, opts) => {
    sent = { url: String(url), auth: opts.headers.Authorization, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ header: ['Código', 'Nombre', 'Estado', 'Mensajes', 'Saludo enviado'], row: ['ana-111', 'Ana', 'Contactado', 0, '2026-11-03 10:00'] }) };
  };
  try {
    const data = await call('data', { query: { unit: 'turnia' }, cookie });
    assert.equal(data.body.readOnly, false);
    assert.equal(data.body.viaApi, true);
    const r = await call('action', { method: 'POST', cookie, body: { unit: 'turnia', id: 'ana-111', action: { type: 'sent', channel: 'whatsapp', kind: 'saludo' } } });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    assert.equal(sent.url, 'https://turniasalud.vercel.app/api/prospeccion');
    assert.equal(sent.auth, `Bearer ${'s'.repeat(40)}`);
    assert.deepEqual(sent.body.action, { type: 'sent', channel: 'whatsapp', kind: 'saludo' });
    assert.equal(sent.body.code, 'ana-111');
    assert.equal(r.body.account.stage, 'saludado');
    // La planilla de Turnia no se toca: la escribe su app.
    assert.equal(book.tabs['Prospección'][1][2], 'Por contactar');
    global.fetch = async () => ({ ok: false, status: 422, json: async () => ({ error: 'Ya le escribiste tres veces.' }) });
    const no = await call('action', { method: 'POST', cookie, body: { unit: 'turnia', id: 'ana-111', action: { type: 'sent' } } });
    assert.equal(no.statusCode, 422);
    assert.equal(no.body.error, 'Ya le escribiste tres veces.');
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});

test('mensajes: en la planilla se guardan en la pestaña Mensajes; en Turnia, por su API', async () => {
  process.env.HABITA_PROSPECTING_SHEET_ID = 'sheet-habita';
  delete book.tabs.Mensajes;
  let r = await call('template', { method: 'POST', cookie, body: { unit: 'habita', key: 'whatsapp_1', text: 'Hola {saludo}, nuevo texto' } });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  const row = book.tabs.Mensajes.find((x) => x[0] === 'whatsapp_1');
  assert.equal(row[4], 'Hola {saludo}, nuevo texto');
  r = await call('template', { method: 'POST', cookie, body: { unit: 'habita', key: 'whatsapp_1', text: 'Otra versión' } });
  assert.equal(book.tabs.Mensajes.filter((x) => x[0] === 'whatsapp_1').length, 1, 'se reemplaza, no se duplica');
  assert.equal(book.tabs.Mensajes.find((x) => x[0] === 'whatsapp_1')[4], 'Otra versión');
  assert.equal((await call('template', { method: 'POST', cookie, body: { unit: 'habita', key: 'whatsapp_1', text: '  ' } })).statusCode, 400);

  process.env.TURNIA_PROSPECTING_SHEET_ID = 'sheet-turnia';
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  const realFetch = global.fetch;
  let sent = null;
  global.fetch = async (url, opts = {}) => {
    sent = { method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null };
    return { ok: true, status: 200, json: async () => ({ templates: [{ key: 'whatsapp_saludo', title: 'Saludo', text: '¡Hola {saludo}!' }], clinics: [{ id: 'c1', name: 'Clínica' }] }) };
  };
  try {
    r = await call('template', { method: 'POST', cookie, body: { unit: 'turnia', key: 'whatsapp_saludo', text: '¡Hola {saludo}!' } });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    assert.deepEqual(sent, { method: 'POST', body: { templates: { whatsapp_saludo: '¡Hola {saludo}!' } } });
    assert.equal(r.body.templates.whatsapp_saludo.text, '¡Hola {saludo}!');
    book.tabs['Prospección'] = [['Código', 'Nombre', 'Estado'], ['ana-111', 'Ana', 'Contactado']];
    const data = await call('data', { query: { unit: 'turnia' }, cookie });
    assert.equal(data.body.templates.whatsapp_saludo.text, '¡Hola {saludo}!');
    assert.deepEqual(data.body.clinics, [{ id: 'c1', name: 'Clínica' }]);
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});

test('el mismo envío confirmado dos veces seguidas se registra una sola vez', async () => {
  process.env.HABITA_PROSPECTING_SHEET_ID = 'sheet-habita';
  const data = await call('data', { query: { unit: 'habita' }, cookie });
  const acc = data.body.accounts.find((a) => a.stage === 'por_contactar' || !a.firstContact) || data.body.accounts[0];
  const before = (book.tabs.Actividad || []).length;
  const send = (version) => call('action', { method: 'POST', cookie, body: { unit: 'habita', id: acc.id, version, action: { type: 'sent', channel: 'whatsapp', template: 'whatsapp_1', kind: 'mensaje' } } });
  const first = await send(acc.updated);
  assert.equal(first.statusCode, 200);
  const second = await send(first.body.account.updated);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.replayed, true);
  assert.equal(book.tabs.Actividad.length, before + 1);
});

test('metas del embudo: habita. en la pestaña Metas de su planilla; Turnia, por su API', async () => {
  process.env.HABITA_PROSPECTING_SHEET_ID = 'sheet-habita';
  const rates = { demos: 0.2, visitadas: 0.6, interaccion: 0.4, cuentas: 0.5, activas: 0.5, pagos: 0.3 };
  const bad = await call('targets', { method: 'POST', cookie, body: { unit: 'habita', perWeek: 300, rates: { ...rates, demos: 2 } } });
  assert.equal(bad.statusCode, 400);
  const ok = await call('targets', { method: 'POST', cookie, body: { unit: 'habita', perWeek: 300, rates } });
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.equal(book.tabs.Metas[1][0], 'saludos_por_semana');
  assert.equal(book.tabs.Metas[1][1], 300);
  assert.deepEqual(book.tabs.Metas.find((r) => r[0] === 'demos').slice(0, 2), ['demos', 20]);
  const data = await call('data', { query: { unit: 'habita' }, cookie });
  assert.equal(data.body.targets.perWeek, 300);
  assert.equal(data.body.targets.rates.demos, 0.2);

  process.env.TURNIA_PROSPECTING_SHEET_ID = 'sheet-turnia';
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  book.tabs['Prospección'] = [['Código', 'Nombre', 'Estado'], ['ana-111', 'Ana', 'Contactado']];
  const realFetch = global.fetch;
  let sent = null;
  global.fetch = async (url, opts = {}) => {
    if (opts.method === 'POST') { sent = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ funnel: sent.funnel }) }; }
    return { ok: true, status: 200, json: async () => ({ templates: [], clinics: [], weeklyGoal: 320, funnelRates: { llamadas: 0.6 } }) };
  };
  try {
    const t = await call('targets', { method: 'POST', cookie, body: { unit: 'turnia', perWeek: 320, rates: { demos: 0.15, visitadas: 0.65, interaccion: 0.5, llamadas: 0.6, fundadores: 0.5 } } });
    assert.equal(t.statusCode, 200, JSON.stringify(t.body));
    assert.equal(sent.funnel.perWeek, 320);
    assert.equal(sent.funnel.rates.llamadas, 0.6);
    const d = await call('data', { query: { unit: 'turnia' }, cookie });
    assert.deepEqual(d.body.targets, { perWeek: 320, rates: { llamadas: 0.6 } });
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});

test('Turnia: registrar en lote manda cada paso con «step» y devuelve cada fila', async () => {
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  const realFetch = global.fetch;
  const sent = [];
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sent.push(body);
    if (body.code === 'mal-1') return { ok: false, status: 422, json: async () => ({ error: 'Pidió no recibir más mensajes.' }) };
    return { ok: true, status: 200, json: async () => ({ header: ['Código', 'Nombre', 'Estado', 'Mensajes'], row: [body.code, 'X', 'Contactado', body.action.step] }) };
  };
  try {
    const r = await call('bulk', { method: 'POST', cookie, body: { unit: 'turnia', items: [
      { id: 'ana-111', actions: [{ type: 'sent', step: 1, channel: 'whatsapp' }, { type: 'sent', step: 2, channel: 'whatsapp' }] },
      { id: 'mal-1', actions: [{ type: 'sent', step: 2 }] },
    ] } });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    assert.deepEqual(sent.map((s) => [s.code, s.action.step]), [['ana-111', 1], ['ana-111', 2], ['mal-1', 2]]);
    assert.equal(r.body.results[0].ok, true);
    assert.equal(r.body.results[0].account.touches, 2);
    assert.deepEqual([r.body.results[1].ok, r.body.results[1].error], [false, 'Pidió no recibir más mensajes.']);
    const bad = await call('bulk', { method: 'POST', cookie, body: { unit: 'turnia', items: [{ id: 'x', actions: [{ type: 'outcome', step: 1 }] }] } });
    assert.equal(bad.body.results[0].error, 'Acción inválida.');
    const habita = await call('bulk', { method: 'POST', cookie, body: { unit: 'habita', items: [{ id: 'abc', actions: [] }] } });
    assert.equal(habita.statusCode, 400);
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});
