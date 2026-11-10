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

test('Habita experimental: la sesión por nombre permite editar sin PROSPECTING_PASSWORD, pero no Turnia ni visitantes anónimos', async () => {
  const oldPassword=process.env.PROSPECTING_PASSWORD;
  const oldHabita=process.env.HABITA_METRICS_SECRET;
  const oldTurnia=process.env.TURNIA_METRICS_SECRET;
  const realFetch=global.fetch;
  delete process.env.PROSPECTING_PASSWORD;
  process.env.HABITA_METRICS_SECRET='h'.repeat(40);
  process.env.TURNIA_METRICS_SECRET='t'.repeat(40);
  const calls=[];
  global.fetch=async(url,opts={})=>{
    calls.push({url:String(url),method:opts.method,body:opts.body?JSON.parse(opts.body):null});
    return {ok:true,status:200,json:async()=>({ok:true,rule:{key:'demo'}})};
  };
  try {
    const operation={unit:'habita',followup:{op:'rule-save',regla:{key:'demo',enabled:true}}};
    const notLogged=await call('task',{method:'POST',body:operation});
    assert.equal(notLogged.statusCode,401);
    assert.equal(calls.length,0);

    const login=await call('login',{method:'POST',body:{name:'Facu'}});
    assert.equal(login.statusCode,200);
    const openedCookie=login.headers['set-cookie'].split(';')[0];
    const actions=[
      'rule-save','rule-delete','rule-reorder','version-create','version-update',
      'version-status','stage-create','state-save','state-delete','state-toggle'
    ];
    for(const op of actions){
      const response=await call('task',{method:'POST',cookie:openedCookie,
        body:{unit:'habita',followup:{op,regla:{key:'demo'}}}});
      assert.equal(response.statusCode,200,op+': '+JSON.stringify(response.body));
    }
    assert.equal(calls.length,actions.length);
    assert.ok(calls.every(x=>x.url.includes('habitaia')&&x.method==='POST'));
    assert.ok(calls.every(x=>x.body.by==='Facu'));
    assert.deepEqual(calls.map(x=>x.body.followup.op),actions);

    const other=await call('task',{method:'POST',cookie:openedCookie,
      body:{unit:'turnia',followup:{op:'rule-save',regla:{key:'demo'}}}});
    assert.equal(other.statusCode,403);
    assert.equal(calls.length,actions.length,'Turnia sensitive writes stay blocked in open mode');
  }finally{
    global.fetch=realFetch;
    if(oldPassword===undefined)delete process.env.PROSPECTING_PASSWORD;
    else process.env.PROSPECTING_PASSWORD=oldPassword;
    if(oldHabita===undefined)delete process.env.HABITA_METRICS_SECRET;
    else process.env.HABITA_METRICS_SECRET=oldHabita;
    if(oldTurnia===undefined)delete process.env.TURNIA_METRICS_SECRET;
    else process.env.TURNIA_METRICS_SECRET=oldTurnia;
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
    assert.equal(sent.url, 'https://turniasalud.app/api/prospeccion');
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
    const t = await call('targets', { method: 'POST', cookie, body: { unit: 'turnia', perWeek: 320, rates: { respondieron: 0.2, demos: 0.75, visitadas: 0.65, interaccion: 0.5, llamadas: 0.6, fundadores: 0.5 } } });
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
    assert.equal(habita.statusCode, 403); // sin la clave de habita.
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});

test('habita. con la clave: las cuentas salen de su API y las acciones van allá; la planilla no se toca', async () => {
  process.env.HABITA_METRICS_SECRET = 'h'.repeat(40);
  const realFetch = global.fetch;
  const calls = [];
  const header = ['ID', 'Inmobiliaria', 'Teléfono', 'Confianza del número', 'Estado', 'Mensajes', 'Primer contacto'];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method, auth: opts.headers.Authorization, body: opts.body ? JSON.parse(opts.body) : null });
    if (opts.method === 'POST') return { ok: true, status: 200, json: async () => ({ header, row: ['u-1', 'Inmo Uno', '+5492235111111', 'verificado', 'Enviado', 1, '2026-11-05 10:00'] }) };
    return { ok: true, status: 200, json: async () => ({ header, rows: [['u-1', 'Inmo Uno', '+5492235111111', 'verificado', 'Pendiente', 0, ''], ['u-2', 'Inmo Dos', '', '', 'Respondió', 1, '2026-11-01 09:00']], events: [{ at: '2026-11-01 09:00', id: 'u-2', account: 'Inmo Dos', type: 'mensaje', channel: 'whatsapp' }] }) };
  };
  const before = JSON.stringify(book.tabs.Prospectos);
  try {
    const data = await call('data', { query: { unit: 'habita' }, cookie });
    assert.equal(data.statusCode, 200, JSON.stringify(data.body));
    assert.equal(data.body.viaApi, true);
    assert.equal(data.body.readOnly, false);
    assert.deepEqual(data.body.accounts.map((a) => [a.id, a.stage]), [['u-1', 'por_contactar'], ['u-2', 'respondio']]);
    assert.equal(data.body.events.length, 1);
    assert.deepEqual(data.body.sheet.missingColumns, []);
    assert.equal(calls[0].url, 'https://www.habitaia.app/api/prospeccion');
    assert.equal(calls[0].auth, `Bearer ${'h'.repeat(40)}`);
    const r = await call('action', { method: 'POST', cookie, body: { unit: 'habita', id: 'u-1', action: { type: 'sent', channel: 'whatsapp', template: 'whatsapp_1', text: 'Hola' } } });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    assert.deepEqual(calls[1].body.action, { type: 'sent', channel: 'whatsapp', template: 'whatsapp_1', text: 'Hola' });
    assert.equal(r.body.account.stage, 'contactado');
    assert.equal(JSON.stringify(book.tabs.Prospectos), before);
  } finally {
    global.fetch = realFetch;
    delete process.env.HABITA_METRICS_SECRET;
  }
});

test('la clave sobrevive a una redirección a otro dominio (habitaia.vercel.app → www.habitaia.app)', async () => {
  const authFetch = require('../api/_authfetch');
  const realFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, opts) => {
    seen.push([String(url), opts.headers.Authorization, opts.redirect]);
    if (String(url).startsWith('https://viejo.test')) return { status: 308, headers: new Map([['location', 'https://nuevo.test/api/x']]) };
    return { status: 200, headers: new Map(), json: async () => ({ ok: true }) };
  };
  try {
    const r = await authFetch('https://viejo.test/api/x', { headers: { Authorization: 'Bearer k' } });
    assert.equal(r.status, 200);
    assert.deepEqual(seen, [['https://viejo.test/api/x', 'Bearer k', 'manual'], ['https://nuevo.test/api/x', 'Bearer k', 'manual']]);
  } finally {
    global.fetch = realFetch;
  }
});

test('habita.: «Traer la planilla» manda la pestaña tal como se ve a su API', async () => {
  process.env.HABITA_METRICS_SECRET = 'h'.repeat(40);
  const realFetch = global.fetch;
  let body = null;
  global.fetch = async (url, opts = {}) => {
    body = JSON.parse(opts.body);
    return { ok: true, status: 200, headers: new Map(), json: async () => ({ created: 0, updated: 2, legacy_sends: 1 }) };
  };
  try {
    const r = await call('sync', { method: 'POST', cookie, body: { unit: 'habita' } });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    assert.equal(r.body.report.legacy_sends, 1);
    const lines = body.sync.csv.split('\n');
    assert.ok(lines[0].startsWith('Código,Nombre,Teléfono,De quién es el teléfono,Zona,Estado,Notas'));
    assert.ok(body.sync.csv.includes('Laura Pérez'));
    const turnia = await call('sync', { method: 'POST', cookie, body: { unit: 'turnia' } });
    assert.equal(turnia.statusCode, 400);
  } finally {
    global.fetch = realFetch;
    delete process.env.HABITA_METRICS_SECRET;
  }
});

test('Turnia: las filas salen de su base (?vista=filas); si su API no las tiene, de la planilla', async () => {
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  book.tabs['Prospección'] = [['Código', 'Nombre', 'Estado', 'Mensajes'], ['ana-111', 'Ana', 'Por contactar', '0']];
  const realFetch = global.fetch;
  const urls = [];
  let rows = true;
  global.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('vista=filas')) {
      if (!rows) return { ok: false, status: 404, json: async () => ({ error: 'no' }) };
      return { ok: true, status: 200, json: async () => ({ header: ['Código', 'Nombre', 'Estado', 'Mensajes', 'Fuente'], rows: [['ana-111', 'Ana', 'Respondió', 1, 'Lista 4 · Maps'], ['beto-222', 'Beto', 'Por contactar', 0, '']], events: [{ at: '2026-11-08 10:00', id: 'ana-111', account: 'Ana', type: 'mensaje', channel: 'whatsapp' }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ templates: [], clinics: [] }) };
  };
  try {
    let data = await call('data', { query: { unit: 'turnia' }, cookie });
    assert.equal(data.body.rowsFromApi, true);
    assert.deepEqual(data.body.accounts.map((a) => [a.id, a.stage, a.campaign]), [['ana-111', 'respondio', 'Lista 4'], ['beto-222', 'por_contactar', '']]);
    assert.equal(data.body.events.length, 1);
    assert.ok(urls.some((u) => u === 'https://turniasalud.app/api/prospeccion?vista=filas'));
    rows = false;
    data = await call('data', { query: { unit: 'turnia' }, cookie });
    assert.equal(data.body.rowsFromApi, false);
    assert.deepEqual(data.body.accounts.map((a) => a.id), ['ana-111']);
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});

test('Turnia: «Responder» trae lo último que escribió cada uno (whatsappInbox) y marca a quien solo le contestó un bot', async () => {
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  book.tabs['Prospección'] = [['Código', 'Nombre', 'Estado', 'Mensajes'], ['ana-111', 'Ana', 'Por contactar', '0']];
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('vista=filas')) {
      return { ok: true, status: 200, json: async () => ({
        header: ['Código', 'Nombre', 'Estado', 'Mensajes', 'Último contacto'],
        rows: [['ana-111', 'Ana', 'Respondió', 1, '2026-11-08 10:00'], ['bot-333', 'Bot', 'Respondió', 0, '2026-11-08 10:00'], ['beto-222', 'Beto', 'Contactado', 1, '2026-11-08 10:00']],
        events: [],
        whatsappSenders: { options: ['0022', '5483'], byCode: { 'ana-111': ['0022'] } },
        whatsappInbox: { readAt: '2026-11-09 08:00', byCode: {
          'ana-111': { chats: [{ line: '0022', inAt: '2026-11-09 07:50', inText: '¿Cuánto sale?', outAt: '2026-11-08 10:00', lastFromMe: false, received: 1, sent: 1, automatic: false }], manual: null },
          'bot-333': { chats: [{ line: '5483', inAt: '2026-11-09 07:40', inText: 'Gracias por comunicarte con Odontología Sur!', outAt: '2026-11-08 10:00', lastFromMe: false, received: 1, sent: 1, automatic: true }], manual: null },
        } },
      }) };
    }
    return { ok: true, status: 200, json: async () => ({ templates: [], clinics: [] }) };
  };
  try {
    const data = await call('data', { query: { unit: 'turnia' }, cookie });
    assert.equal(data.body.whatsappReadAt, '2026-11-09 08:00');
    const by = Object.fromEntries(data.body.accounts.map((a) => [a.id, a]));
    assert.equal(by['ana-111'].chats[0].inText, '¿Cuánto sale?');
    assert.deepEqual(by['ana-111'].whatsappSenders, ['0022']);
    assert.equal(by['ana-111'].botOnly, undefined);
    assert.equal(by['bot-333'].botOnly, true);
    assert.equal(by['beto-222'].chats, undefined);
    // El bot no cuenta como «Respondieron» en el embudo.
    const f = require('../prospecting/core').funnel(data.body.accounts, require('../prospecting/units').UNITS.turnia);
    assert.equal(f.respondieron, 1);
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});

test('Follow-up: junta la cola de cada unidad y manda cada acción a su app a nombre de quien opera', async () => {
  process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
  process.env.HABITA_METRICS_SECRET = 'h'.repeat(40);
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    if (u.includes('habitaia') && u.includes('vista=followup')) return { ok: true, status: 200, json: async () => ({ summary: { ready: 2 }, queue: [{ agencyId: 'a1' }] }) };
    if (u.includes('turniasalud') && u.includes('vista=followup')) return { ok: false, status: 400, json: async () => ({ error: 'Falta la persona o la acción.' }) };
    if (opts.method === 'POST' && u.includes('turniasalud')) return { ok: false, status: 409, json: async () => ({ error: 'Ana la está ejecutando Facu.' }) };
    return { ok: true, status: 200, json: async () => ({ message: 'Hola', versionId: 'v1' }) };
  };
  try {
    const q = await call('followup', { query: { unit: 'todas' }, cookie });
    assert.equal(q.statusCode, 200);
    assert.equal(q.body.units.habita.summary.ready, 2);
    assert.match(q.body.units.turnia.error, /todavía no tiene la cola/);
    const ok = await call('task', { method: 'POST', cookie, body: { unit: 'habita', followup: { op: 'claim', inmobiliaria: 'a1' } } });
    assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.result.message, 'Hola');
    const sent = calls.find((c) => c.method === 'POST' && c.url.includes('habitaia'));
    assert.deepEqual(sent.body, { by: 'Axel', followup: { op: 'claim', inmobiliaria: 'a1' } });
    const busy = await call('task', { method: 'POST', cookie, body: { unit: 'turnia', followup: { op: 'confirm', inmobiliaria: 'x' } } });
    assert.equal(busy.statusCode, 409);
    assert.equal(busy.body.error, 'Ana la está ejecutando Facu.');
    const bad = await call('task', { method: 'POST', cookie, body: { unit: 'habita', followup: { op: 'borrar' } } });
    assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
    delete process.env.HABITA_METRICS_SECRET;
  }
});

test('WhatsApp de Turnia: el cron diario pide la lectura sin sesión y solo devuelve los totales', async () => {
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, status: 200, json: async () => ({ whatsapp: { totals: { conversaciones: 10, respondieron: 3 }, lines: [{ line: '0022', status: 'ok', chats: 40 }], pending: [{ name: 'Ana', text: 'hola' }] } }) };
  };
  try {
    const none = await call('whatsapp-cron');
    assert.equal(none.statusCode, 403);
    assert.equal(calls.length, 0);
    process.env.TURNIA_METRICS_SECRET = 's'.repeat(40);
    const r = await call('whatsapp-cron');
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true, totals: { conversaciones: 10, respondieron: 3 }, lines: [{ line: '0022', status: 'ok' }] });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /turniasalud/);
    assert.deepEqual(calls[0].body, { by: 'Lectura diaria', followup: { op: 'whatsapp-sync' } });
  } finally {
    global.fetch = realFetch;
    delete process.env.TURNIA_METRICS_SECRET;
  }
});
