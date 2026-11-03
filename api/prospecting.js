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

async function doAction(req, res, user) {
  const { unit: unitId, id, version, action } = req.body || {};
  const unit = UNITS[unitId];
  const sheet = unit && sheetOf(unit);
  if (!sheet) return fail(res, 400, 'Unidad sin planilla configurada.');
  if (unit.readOnly) return fail(res, 403, `${unit.name} se opera en ${unit.appName}: su planilla la escribe la app y se actualiza sola.`);
  if (!id || !action || typeof action.type !== 'string') return fail(res, 400, 'Falta la cuenta o la acción.');
  const data = await readUnit(unit, sheet);
  if (data.missingTab) return fail(res, 409, `La planilla no tiene la pestaña «${sheet.tab}».`);
  const account = data.accounts.find((a) => a.id === id);
  if (!account) return fail(res, 404, 'Esa cuenta ya no está en la planilla.');
  // Si alguien la cambió desde que la abriste, no se pisa: se devuelve la versión nueva.
  if (version !== undefined && version !== null && String(version) !== String(account.updated)) {
    return fail(res, 409, 'Alguien cambió esta cuenta recién. Te mostramos la versión nueva: revisala y volvé a intentar.', { account });
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
  if (unit.readOnly) return fail(res, 403, `La planilla de ${unit.name} es de solo lectura.`);
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
      return res.status(200).json({
        unit: unit.id,
        readAt: new Date().toISOString(),
        readOnly: Boolean(unit.readOnly),
        sheet: { title: data.meta.title, tab: sheet.tab, url: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`, missingTab: Boolean(data.missingTab), missingColumns: missing.map((k) => core.LABEL[k]), mapped: Object.keys(data.map) },
        accounts: data.accounts,
        events: data.events.slice(-8000),
        templates: data.templates,
        signals,
      });
    }
    if (op === 'action' && req.method === 'POST') return await doAction(req, res, user);
    if (op === 'setup' && req.method === 'POST') return await doSetup(req, res, user);
    return fail(res, 404, 'Operación desconocida.');
  } catch (err) {
    console.error('prospecting_error', op, err.message);
    return fail(res, err.status === 404 || err.status === 403 ? 502 : 500, err.message || 'Algo salió mal.');
  }
};
