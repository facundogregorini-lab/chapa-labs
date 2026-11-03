// Sesión del panel de prospección: contraseña compartida del equipo y cookie firmada
// (HttpOnly, 30 días) con el nombre de quien opera.
//
// Variables de entorno en Vercel:
//   PROSPECTING_PASSWORD   la contraseña que usa el equipo (12 caracteres o más). Sin ella el
//                          panel queda abierto: cualquiera con el link ve nombres y teléfonos y
//                          puede registrar contactos; solo se pide un nombre.
//   PROSPECTING_SECRET     opcional; clave para firmar la cookie (32 caracteres o más).
//                          Sin ella se deriva de la contraseña: cambiarla cierra todas las sesiones.

const crypto = require('node:crypto');

const COOKIE = 'cl_prospecting';
const DAYS = 30;

const password = () => (process.env.PROSPECTING_PASSWORD || '').trim();
const configured = () => password().length >= 12;
const open = () => !configured();

function key() {
  const secret = (process.env.PROSPECTING_SECRET || '').trim();
  return secret.length >= 32 ? secret : crypto.createHash('sha256').update(`chapa-labs:${password() || 'abierto'}`).digest('hex');
}

const sign = (payload) => crypto.createHmac('sha256', key()).update(payload).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function checkPassword(given) {
  if (open()) return true;
  // Comparación en tiempo constante sobre hashes del mismo largo.
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  return safeEqual(h(given), h(password()));
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function read(req) {
  const raw = cookies(req)[COOKIE];
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return s.exp > Date.now() / 1000 && typeof s.name === 'string' ? s : null;
  } catch {
    return null;
  }
}

function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function start(res, name) {
  const payload = Buffer.from(JSON.stringify({ name, exp: Math.floor(Date.now() / 1000) + DAYS * 86400 })).toString('base64url');
  res.setHeader('Set-Cookie', cookieHeader(`${payload}.${sign(payload)}`, DAYS * 86400));
}

function end(res) {
  res.setHeader('Set-Cookie', cookieHeader('', 0));
}

module.exports = { configured, open, checkPassword, read, start, end };
