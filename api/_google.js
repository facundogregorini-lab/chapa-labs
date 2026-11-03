// Google Sheets por API REST, con una cuenta de servicio. Sin dependencias: el JWT se
// firma con node:crypto. Los archivos de api/ que empiezan con _ no son funciones.
//
// Variables de entorno en Vercel (una de las dos formas):
//   GOOGLE_SERVICE_ACCOUNT_JSON   el JSON entero de la clave de la cuenta de servicio, o
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  + GOOGLE_PRIVATE_KEY (con los \n tal cual vienen en el JSON).
//
// Cada planilla se comparte con el email de la cuenta de servicio como Editor.

const crypto = require('node:crypto');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

const pem = (k) => String(k || '').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');

function credentials() {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const emailVar = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  // También se acepta solo la clave privada («-----BEGIN PRIVATE KEY-----…»), con el email aparte.
  if (!raw.startsWith('{') && raw.includes('BEGIN PRIVATE KEY')) {
    if (!emailVar) throw Object.assign(new Error('GOOGLE_SERVICE_ACCOUNT_JSON tiene solo la clave privada: pegá el archivo JSON entero (empieza con «{»), o agregá GOOGLE_SERVICE_ACCOUNT_EMAIL con el email de la cuenta de servicio.'), { code: 'NO_GOOGLE' });
    return { email: emailVar, key: pem(raw) };
  }
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j.client_email && j.private_key) return { email: j.client_email, key: pem(j.private_key) };
    } catch { /* cae al error de abajo */ }
    throw Object.assign(new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es el JSON de una cuenta de servicio: pegá el archivo entero, desde «{» hasta «}».'), { code: 'NO_GOOGLE' });
  }
  const key = pem(process.env.GOOGLE_PRIVATE_KEY);
  if (!emailVar || !key) return null;
  return { email: emailVar, key };
}

// Qué falta para conectar con Google (para mostrarlo en la pantalla de conexión).
function problem() {
  try {
    return credentials() ? null : 'Falta GOOGLE_SERVICE_ACCOUNT_JSON en Vercel.';
  } catch (err) {
    return err.message;
  }
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

let cached = null; // { token, exp }

async function accessToken() {
  if (cached && cached.exp - 60 > Date.now() / 1000) return cached.token;
  const cred = credentials();
  if (!cred) throw Object.assign(new Error('Falta configurar la cuenta de servicio de Google.'), { code: 'NO_GOOGLE' });
  const now = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: 'RS256', typ: 'JWT' });
  const claim = b64url({ iss: cred.email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const signature = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(cred.key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${signature}` }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) throw new Error(`Google no dio acceso: ${body.error_description || body.error || r.status}`);
  cached = { token: body.access_token, exp: now + (body.expires_in || 3600) };
  return cached.token;
}

async function call(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    for (const item of [].concat(v)) url.searchParams.append(k, item);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = json.error?.message || `Google respondió ${r.status}`;
      const hint = r.status === 403 || r.status === 404 ? ' Revisá que la planilla esté compartida con la cuenta de servicio como Editor.' : '';
      throw Object.assign(new Error(msg + hint), { status: r.status });
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// 'Mi pestaña' → "'Mi pestaña'" para usarla en un rango A1.
const tab = (name) => `'${String(name).replace(/'/g, "''")}'`;

// 0 → A, 26 → AA.
function colLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

async function tabs(id) {
  const meta = await call(encodeURIComponent(id), { query: { fields: 'properties.title,sheets.properties(sheetId,title)' } });
  return { title: meta.properties?.title || '', tabs: (meta.sheets || []).map((s) => s.properties.title) };
}

async function readTabs(id, names) {
  if (!names.length) return {};
  const r = await call(`${encodeURIComponent(id)}/values:batchGet`, {
    query: { ranges: names.map((n) => tab(n)), valueRenderOption: 'FORMATTED_VALUE' },
  });
  const out = {};
  names.forEach((n, i) => { out[n] = r.valueRanges?.[i]?.values || []; });
  return out;
}

async function addTabs(id, names) {
  if (!names.length) return;
  await call(`${encodeURIComponent(id)}:batchUpdate`, {
    method: 'POST',
    body: { requests: names.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) },
  });
}

// cells: [{ tab, row (1-based), col (0-based), value }]
async function writeCells(id, cells) {
  if (!cells.length) return;
  await call(`${encodeURIComponent(id)}/values:batchUpdate`, {
    method: 'POST',
    body: {
      valueInputOption: 'RAW',
      data: cells.map((c) => ({ range: `${tab(c.tab)}!${colLetter(c.col)}${c.row}`, values: [[c.value ?? '']] })),
    },
  });
}

async function writeRange(id, tabName, startRow, rows) {
  if (!rows.length) return;
  const width = Math.max(...rows.map((r) => r.length));
  await call(`${encodeURIComponent(id)}/values/${encodeURIComponent(`${tab(tabName)}!A${startRow}:${colLetter(width - 1)}${startRow + rows.length - 1}`)}`, {
    method: 'PUT',
    query: { valueInputOption: 'RAW' },
    body: { values: rows },
  });
}

async function appendRows(id, tabName, rows) {
  if (!rows.length) return;
  await call(`${encodeURIComponent(id)}/values/${encodeURIComponent(`${tab(tabName)}!A1`)}:append`, {
    method: 'POST',
    query: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
    body: { values: rows },
  });
}

module.exports = { configured: () => Boolean(credentials()), problem, serviceEmail: () => { try { return credentials()?.email || null; } catch { return null; } }, tabs, readTabs, addTabs, writeCells, writeRange, appendRows, colLetter };
