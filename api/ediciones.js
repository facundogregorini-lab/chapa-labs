// Etapas editadas a mano en el tablero, compartidas entre todos los que lo abren.
//
// Se guardan en Vercel Blob (almacén privado "chapa-labs-ediciones"; Vercel
// carga BLOB_READ_WRITE_TOKEN al conectarlo al proyecto). Cada edición guarda
// también el valor que tenía la planilla en ese momento: el tablero la usa
// mientras la planilla siga igual y la descarta cuando trae un dato nuevo.
//
//   GET  /api/ediciones?proyecto=amobla-ia   → { edits: { etapa: { value, planilla, at } } }
//   POST /api/ediciones  { proyecto, edits }  → lo mismo, ya guardado

const { get, put } = require('@vercel/blob');

// Proyectos y etapas que se pueden editar (las de acquisition.stages en data.js).
const EDITABLE = { 'amobla-ia': ['prospectados', 'contactados', 'interesados', 'suscriptores'] };
const MAX = 1e6;
const path = (proyecto) => `ediciones/${proyecto}.json`;

async function read(proyecto) {
  const res = await get(path(proyecto), { access: 'private', useCache: false });
  if (!res) return {};
  const text = await new Response(res.stream).text();
  try { return JSON.parse(text).edits || {}; } catch (e) { return {}; }
}

// Solo etapas conocidas y números enteros razonables.
function clean(proyecto, edits) {
  const out = {};
  const now = new Date().toISOString();
  Object.entries(edits || {}).forEach(([k, e]) => {
    if (!EDITABLE[proyecto].includes(k) || !e) return;
    const value = Number(e.value);
    const planilla = Number(e.planilla);
    if (!Number.isInteger(value) || value < 0 || value > MAX) return;
    if (!Number.isInteger(planilla) || planilla < 0 || planilla > MAX) return;
    out[k] = { value, planilla, at: typeof e.at === 'string' ? e.at.slice(0, 30) : now };
  });
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({ error: 'Falta conectar el almacén de Vercel Blob al proyecto.' });
    return;
  }
  const proyecto = req.method === 'POST' ? req.body && req.body.proyecto : req.query.proyecto;
  if (!EDITABLE[proyecto]) {
    res.status(400).json({ error: 'Proyecto sin etapas editables.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      res.status(200).json({ edits: await read(proyecto) });
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Usá GET o POST.' });
      return;
    }
    const edits = clean(proyecto, req.body.edits);
    await put(path(proyecto), JSON.stringify({ edits }), {
      access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
    });
    res.status(200).json({ edits });
  } catch (err) {
    res.status(502).json({ error: err.message || 'No se pudo leer o guardar en Vercel Blob.' });
  }
};
