'use strict';

/**
 * Comentarios de la ficha de un contacto en la cola: notas entre quien opera y
 * la extensión. No son datos del producto (no cambian etapa, situación ni
 * envíos), así que viven en Chapa, en el almacén privado de Vercel Blob que el
 * proyecto ya tiene conectado (BLOB_READ_WRITE_TOKEN), nunca en el repo.
 *
 * Un archivo por contacto: comentarios/<unidad>/<id>.json → { name, comments }.
 * Así dos personas que comentan contactos distintos al mismo tiempo no se pisan.
 * El índice (qué contactos tienen comentarios) sale de listar la carpeta.
 */
const MAX_TEXT = 2000;
const MAX_THREAD = 200;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

const pathOf = (unit, id) => `comentarios/${unit}/${id}.json`;

function cleanText(raw) {
  return String(raw ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, MAX_TEXT);
}

function createComments({ get, put, list, now = () => new Date() }) {
  async function read(unit, id) {
    const res = await get(pathOf(unit, id), { access: 'private', useCache: false });
    if (!res) return { name: '', comments: [] };
    try {
      const data = JSON.parse(await new Response(res.stream).text());
      return { name: String(data.name || ''), comments: Array.isArray(data.comments) ? data.comments : [] };
    } catch {
      return { name: '', comments: [] };
    }
  }

  /** Los comentarios de un contacto, del más viejo al más nuevo. */
  async function thread(unit, id) {
    if (!ID.test(String(id || ''))) throw Object.assign(new Error('Falta el contacto.'), { status: 400 });
    return (await read(unit, id)).comments;
  }

  /** Suma un comentario y devuelve el hilo como quedó. */
  async function add(unit, id, { by, bot, text, name }) {
    if (!ID.test(String(id || ''))) throw Object.assign(new Error('Falta el contacto.'), { status: 400 });
    const body = cleanText(text);
    if (!body) throw Object.assign(new Error('Escribí el comentario.'), { status: 400 });
    const cur = await read(unit, id);
    const comments = [...cur.comments, { by: String(by || '').slice(0, 80), bot: Boolean(bot), at: now().toISOString(), text: body }].slice(-MAX_THREAD);
    await put(pathOf(unit, id), JSON.stringify({ name: String(name || cur.name || '').slice(0, 160), comments }), {
      access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
    });
    return comments;
  }

  /** Qué contactos de la unidad tienen comentarios y cuándo fue el último: { id: { at } }. */
  async function index(unit) {
    const out = {};
    const prefix = `comentarios/${unit}/`;
    let cursor;
    for (let page = 0; page < 20; page++) {
      const r = await list({ prefix, cursor, limit: 1000 });
      for (const b of r.blobs || []) {
        const id = String(b.pathname || '').slice(prefix.length).replace(/\.json$/, '');
        if (ID.test(id)) out[id] = { at: b.uploadedAt ? new Date(b.uploadedAt).toISOString() : null };
      }
      if (!r.hasMore || !r.cursor) break;
      cursor = r.cursor;
    }
    return out;
  }

  return { thread, add, index };
}

module.exports = { createComments, cleanText, pathOf, MAX_TEXT };
