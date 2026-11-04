// Panel de prospección (/prospecting): una sola función para no pasar el límite de
// funciones de Vercel Hobby. Lee y escribe la planilla de Google de cada unidad.
//
//   GET  ?op=session                 estado de la conexión y de la sesión
//   POST ?op=login  {name,password}  abre la sesión del equipo
//   POST ?op=logout
//   GET  ?op=data&unit=turnia        cuentas, actividad y plantillas de esa unidad
//   POST ?op=action {unit,id,version,action}   aplica una acción a una cuenta
//   POST ?op=setup  {unit}           agrega las columnas y pestañas que falten
//
// Variables: PROSPECTING_PASSWORD (ver _session.js), la cuenta de servicio (ver
// _google.js) y, por unidad, <ID>_PROSPECTING_SHEET_ID (ver prospecting/units.js).
// Nunca devuelve nada sin sesión: las planillas tienen nombres y teléfonos.

const google = require('./_google');
const session = require('./_session');
const core = require('../prospecting/core');
const { UNITS } = require('../prospecting/units');

const TEMPLATES_TAB = 'Mensajes';
const TEMPLATES_HEAD = ['Clave', 'Título', 'Canal', 'Asunto', 'Texto', 'Cuándo se usa'];

function sheetOf(unit) {
  const id = (process.env[unit.sheetEnv] || '').trim();
  return id ? { id, tab: (process.env[unit.tabEnv] || '').trim() || unit.tab } : null;
}

function googleReady() {
  try { return google.configured(); } catch { return false; }
}

function fail(res, status, error, extra = {}) {
  res.status(status).json({ error, ...extra });
}

async function readUnit(unit, sheet) {
  const meta = await google.tabs(sheet.id);
  const want = [sheet.tab, core.ACTIVITY_TAB, TEMPLATES_TAB].filter((t) => meta.tabs.includes(t));
  if (!meta.tabs.includes(sheet.tab)) {
    return { meta, missingTab: true, accounts: [], events: [], map: {}, head: [], templates: {} };
  }
  const values = await google.readTabs(sheet.id, want);
  const { accounts, map, head } = core.toAccounts(values[sheet.tab], unit);
  const events = core.toEvents(values[core.ACTIVITY_TAB] || []);
  const templates = {};
  const [, ...trows] = values[TEMPLATES_TAB] || [];
  for (const r of trows) {
    if (r[0] && r[4]) templates[String(r[0]).trim()] = { title: r[1] || '', channel: r[2] || '', subject: r[3] || '', text: String(r[4]) };
  }
  return { meta, accounts, events, map, head, templates };
}

// Señales de solo lectura desde otra planilla (por ejemplo, la que Turnia escribe sola).
async function mergeSignals(unit, accounts) {
  const cfg = unit.signals;
  const id = cfg && (process.env[cfg.env] || '').trim();
  if (!id) return null;
  try {
    const values = await google.readTabs(id, [cfg.tab]);
    const { accounts: other } = core.toAccounts(values[cfg.tab], null);
    const byId = new Map(other.map((o) => [o.id, o]));
    const digits = (p) => String(p || '').replace(/\D+/g, '').slice(-10);
    const byPhone = new Map(other.filter((o) => digits(o.phone)).map((o) => [digits(o.phone), o]));
    let matched = 0;
    for (const a of accounts) {
      const o = byId.get(a.id) || (digits(a.phone) && byPhone.get(digits(a.phone)));
      if (!o) continue;
      matched++;
      for (const f of cfg.fields) if (!a[f] && o[f]) { a[f] = o[f]; a.fromSignals = true; }
    }
    return { matched, total: other.length };
  } catch (err) {
    return { error: err.message };
  }
}

async function ensureColumns(sheet, head, keys) {
  const map = core.mapHeaders(head);
  const missing = keys.filter((k) => map[k] === undefined);
  if (!missing.length) return map;
  const next = head.slice();
  for (const k of missing) next.push(core.LABEL[k]);
  await google.writeRange(sheet.id, sheet.tab, 1, [next]);
  return core.mapHeaders(next);
}

async function appendEvents(sheet, tabs, events) {
  if (!events.length) return;
  if (!tabs.includes(core.ACTIVITY_TAB)) {
    await google.addTabs(sheet.id, [core.ACTIVITY_TAB]);
    await google.writeRange(sheet.id, core.ACTIVITY_TAB, 1, [core.ACTIVITY_HEAD]);
  }
  await google.appendRows(sheet.id, core.ACTIVITY_TAB, events.map(core.eventRow));
}

// Unidades cuya planilla la escribe su app (Turnia): las acciones van a la API de la app.
function apiOf(unit) {
  if (!unit.api) return null;
  const secret = unit.api.secretEnvs.map((k) => (process.env[k] || '').trim()).find((v) => v.length >= 32);
  return secret ? { url: (process.env[unit.api.urlEnv] || '').trim() || unit.api.url, secret } : null;
}
const readOnlyOf = (unit) => Boolean(unit.readOnly || (unit.api && !apiOf(unit)));

// Llamada a la API de la app de la unidad (GET o POST con JSON).
async function callApi(unit, { method = 'GET', body } = {}) {
  const api = apiOf(unit);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(api.url, {
      method,
      headers: { Authorization: `Bearer ${api.secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = r.status === 401 ? `${unit.name} rechazó la clave: revisá que sea la misma en los dos proyectos.` : json.error || `${unit.name} respondió ${r.status}.`;
      throw Object.assign(new Error(msg), { status: r.status === 401 ? 502 : r.status });
    }
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error(`${unit.name} no respondió a tiempo.`), { status: 504 });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Los mensajes de la app ({ key, title, hint, text }) con la forma de la pestaña Mensajes.
const appTemplates = (list) => Object.fromEntries((list || []).map((t) => [t.key, { title: t.title || '', text: t.text || '', hint: t.hint || '' }]));

async function doTemplate(req, res) {
  const { unit: unitId, key, text, subject, title } = req.body || {};
  const unit = UNITS[unitId];
  const sheet = unit && sheetOf(unit);
  if (!sheet) return fail(res, 400, 'Unidad sin planilla configurada.');
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!key || !/^[a-z0-9_]{2,40}$/.test(key)) return fail(res, 400, 'Clave de mensaje inválida.');
  if (!clean) return fail(res, 400, 'El mensaje no puede quedar vacío.');
  if (clean.length > 1500) return fail(res, 400, 'El mensaje tiene que tener menos de 1500 caracteres.');
  if (unit.api) {
    if (!apiOf(unit)) return fail(res, 403, `Para editar los mensajes de ${unit.name} falta la clave de su API.`);
    try {
      const out = await callApi(unit, { method: 'POST', body: { templates: { [key]: clean } } });
      return res.status(200).json({ templates: appTemplates(out.templates) });
    } catch (err) {
      return fail(res, err.status || 502, err.message);
    }
  }
  // En la planilla: la fila de esa clave en la pestaña Mensajes (se crea si no está).
  const meta = await google.tabs(sheet.id);
  if (!meta.tabs.includes(TEMPLATES_TAB)) {
    await google.addTabs(sheet.id, [TEMPLATES_TAB]);
    const rows = Object.entries(unit.templates).map(([k, t]) => [k, t.title, t.channel, t.subject || '', t.text, t.hint || '']);
    await google.writeRange(sheet.id, TEMPLATES_TAB, 1, [TEMPLATES_HEAD, ...rows]);
  }
  const rows = (await google.readTabs(sheet.id, [TEMPLATES_TAB]))[TEMPLATES_TAB] || [];
  const base = unit.templates[key] || {};
  const i = rows.findIndex((r, n) => n > 0 && String(r[0] || '').trim() === key);
  const row = [key, title || (i > 0 && rows[i][1]) || base.title || key, (i > 0 && rows[i][2]) || base.channel || '', subject ?? ((i > 0 && rows[i][3]) || base.subject || ''), clean, (i > 0 && rows[i][5]) || base.hint || ''];
  if (i > 0) await google.writeRange(sheet.id, TEMPLATES_TAB, i + 1, [row]);
  else await google.appendRows(sheet.id, TEMPLATES_TAB, [row]);
  return res.status(200).json({ ok: true, template: { title: row[1], channel: row[2], subject: row[3], text: row[4] } });
}

async function actionViaApi(res, unit, user, id, action) {
  const api = apiOf(unit);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let r;
  let body;
  try {
    r = await fetch(api.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${api.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: id, action, by: user.name }),
      signal: ctrl.signal,
    });
    body = await r.json().catch(() => ({}));
  } catch (err) {
    return fail(res, 502, err.name === 'AbortError' ? `${unit.name} no respondió a tiempo.` : `No pudimos hablar con ${unit.name}.`);
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) return fail(res, r.status === 401 ? 502 : r.status, r.status === 401 ? `${unit.name} rechazó la clave: revisá que sea la misma en los dos proyectos.` : body.error || `${unit.name} respondió ${r.status}.`);
  const { accounts } = core.toAccounts([body.header, body.row], unit);
  const account = accounts[0];
  // Para la historia de la ficha (la de Turnia queda en su panel).
  let events = [];
  try { events = core.applyAction(account, action, { unit, by: user.name }).events; } catch { /* sin historia */ }
  return res.status(200).json({ account, events });
}

async function doAction(req, res, user) {
  const { unit: unitId, id, version, action } = req.body || {};
  const unit = UNITS[unitId];
  const sheet = unit && sheetOf(unit);
  if (!sheet) return fail(res, 400, 'Unidad sin planilla configurada.');
  if (!id || !action || typeof action.type !== 'string') return fail(res, 400, 'Falta la cuenta o la acción.');
  if (unit.api && apiOf(unit)) return actionViaApi(res, unit, user, id, action);
  if (readOnlyOf(unit)) return fail(res, 403, `${unit.name} se opera en ${unit.appName}: falta la clave de su API (${unit.api ? unit.api.secretEnvs.join(' o ') : ''}).`);
  const data = await readUnit(unit, sheet);
  if (data.missingTab) return fail(res, 409, `La planilla no tiene la pestaña «${sheet.tab}».`);
  const account = data.accounts.find((a) => a.id === id);
  if (!account) return fail(res, 404, 'Esa cuenta ya no está en la planilla.');
  // Si alguien la cambió desde que la abriste, no se pisa: se devuelve la versión nueva.
  if (version !== undefined && version !== null && String(version) !== String(account.updated)) {
    return fail(res, 409, 'Alguien cambió esta cuenta recién. Te mostramos la versión nueva: revisala y volvé a intentar.', { account });
  }
  // Un reintento (o un doble clic) del mismo envío no se registra dos veces.
  if (action.type === 'sent') {
    const type = action.kind === 'saludo' ? 'saludo' : 'mensaje';
    if (core.isReplay(data.events, account.id, type, action.template || '')) return res.status(200).json({ account, events: [], replayed: true });
  }
  let result;
  try {
    result = core.applyAction(account, action, { unit, by: user.name });
  } catch (err) {
    return fail(res, 400, err.message);
  }
  // Una fila sin ID recibe el que se le calculó, así la próxima lectura la encuentra igual.
  const needId = account.id.startsWith('fila-');
  const keys = Object.keys(result.patch).concat(needId ? ['id'] : []);
  const map = await ensureColumns(sheet, data.head, keys);
  const cells = Object.entries(result.patch).map(([k, v]) => ({ tab: sheet.tab, row: account.row, col: map[k], value: core.cellValue(k, v, unit) }));
  if (needId) cells.push({ tab: sheet.tab, row: account.row, col: map.id, value: account.id });
  await google.writeCells(sheet.id, cells.filter((c) => c.col !== undefined));
  await appendEvents(sheet, data.meta.tabs, result.events);
  const updated = { ...account, ...result.patch };
  if (result.patch.stage) updated.stage = result.patch.stage;
  res.status(200).json({ account: updated, events: result.events });
}

async function doSetup(req, res, user) {
  const unit = UNITS[(req.body || {}).unit];
  const sheet = unit && sheetOf(unit);
  if (!sheet) return fail(res, 400, 'Unidad sin planilla configurada.');
  if (unit.readOnly || unit.api) return fail(res, 403, `La planilla de ${unit.name} la escribe su app: no se prepara desde acá.`);
  const meta = await google.tabs(sheet.id);
  const add = [sheet.tab, core.ACTIVITY_TAB, TEMPLATES_TAB].filter((t) => !meta.tabs.includes(t));
  await google.addTabs(sheet.id, add);
  const values = await google.readTabs(sheet.id, [sheet.tab, TEMPLATES_TAB]);
  const head = (values[sheet.tab] || [])[0] || [];
  const needed = ['id', 'name', 'org', 'greeting', 'phone', 'phoneKind', 'email', 'zone', 'priority', 'sdr', 'campaign', 'demoUrl', ...core.WRITABLE];
  const map = await ensureColumns(sheet, head, [...new Set(needed)]);
  // IDs estables para las filas que no tienen.
  const fresh = (await google.readTabs(sheet.id, [sheet.tab]))[sheet.tab];
  const { accounts } = core.toAccounts(fresh, unit);
  const ids = accounts.filter((a) => a.id.startsWith('fila-')).map((a) => ({ tab: sheet.tab, row: a.row, col: map.id, value: a.id }));
  await google.writeCells(sheet.id, ids);
  if (add.includes(core.ACTIVITY_TAB)) await google.writeRange(sheet.id, core.ACTIVITY_TAB, 1, [core.ACTIVITY_HEAD]);
  if (!(values[TEMPLATES_TAB] || []).length) {
    const rows = Object.entries(unit.templates).map(([k, t]) => [k, t.title, t.channel, t.subject || '', t.text, t.hint || '']);
    await google.writeRange(sheet.id, TEMPLATES_TAB, 1, [TEMPLATES_HEAD, ...rows]);
  }
  await google.appendRows(sheet.id, core.ACTIVITY_TAB, [core.eventRow({ at: core.nowLocal(), id: '-', account: '-', type: 'planilla', detail: `Preparada: ${add.length} pestañas y ${ids.length} IDs nuevos`, by: user.name })]);
  res.status(200).json({ ok: true, addedTabs: add, newIds: ids.length });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const op = (req.query && req.query.op) || '';
  try {
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').includes('application/json')) return fail(res, 415, 'Se espera JSON.');

    if (op === 'session') {
      const user = session.read(req);
      return res.status(200).json({
        auth: session.configured(),
        open: session.open(),
        google: googleReady(),
        googleProblem: google.problem ? google.problem() : null,
        serviceEmail: google.serviceEmail(),
        user: user ? { name: user.name } : null,
        units: Object.values(UNITS).map((u) => ({ id: u.id, sheet: Boolean(sheetOf(u)), sheetEnv: u.sheetEnv })),
      });
    }
    if (op === 'login' && req.method === 'POST') {
      const { name, password } = req.body || {};
      const who = String(name || '').trim().slice(0, 40);
      if (!who) return fail(res, 400, 'Poné tu nombre: queda en cada contacto que registres.');
      if (!session.checkPassword(password || '')) {
        await new Promise((r) => setTimeout(r, 600));
        return fail(res, 401, 'La contraseña no es correcta.');
      }
      session.start(res, who);
      return res.status(200).json({ user: { name: who } });
    }
    if (op === 'logout' && req.method === 'POST') {
      session.end(res);
      return res.status(200).json({ ok: true });
    }

    const user = session.read(req);
    if (!user) return fail(res, 401, 'Iniciá sesión.');
    if (!googleReady()) return fail(res, 503, 'Falta configurar la cuenta de servicio de Google.', { code: 'NO_GOOGLE' });

    if (op === 'data') {
      const unit = UNITS[req.query.unit];
      if (!unit) return fail(res, 404, 'No existe esa unidad.');
      const sheet = sheetOf(unit);
      if (!sheet) return fail(res, 503, `Falta configurar ${unit.sheetEnv} en Vercel.`, { code: 'NO_SHEET' });
      const data = await readUnit(unit, sheet);
      const signals = data.missingTab ? null : await mergeSignals(unit, data.accounts);
      const missing = core.WRITABLE.filter((k) => data.map[k] === undefined);
      // Unidades con API: los mensajes y las clínicas salen de la app (los mismos de su panel).
      let templates = data.templates;
      let clinics = null;
      let apiError = null;
      if (unit.api && apiOf(unit)) {
        try {
          const out = await callApi(unit);
          templates = appTemplates(out.templates);
          clinics = out.clinics || [];
        } catch (err) {
          apiError = err.message;
        }
      }
      return res.status(200).json({
        unit: unit.id,
        readAt: new Date().toISOString(),
        readOnly: readOnlyOf(unit),
        viaApi: Boolean(unit.api && apiOf(unit)),
        sheet: { title: data.meta.title, tab: sheet.tab, url: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`, missingTab: Boolean(data.missingTab), missingColumns: missing.map((k) => core.LABEL[k]), mapped: Object.keys(data.map) },
        accounts: data.accounts,
        events: data.events.slice(-8000),
        templates,
        clinics,
        apiError,
        signals,
      });
    }
    if (op === 'action' && req.method === 'POST') return await doAction(req, res, user);
    if (op === 'setup' && req.method === 'POST') return await doSetup(req, res, user);
    if (op === 'template' && req.method === 'POST') return await doTemplate(req, res);
    return fail(res, 404, 'Operación desconocida.');
  } catch (err) {
    console.error('prospecting_error', op, err.message);
    return fail(res, err.status === 404 || err.status === 403 ? 502 : 500, err.message || 'Algo salió mal.');
  }
};
