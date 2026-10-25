// Prospección outbound de Amobla IA en vivo, desde la Google Sheet "Prospecting amobla IA".
//
// Variables de entorno en Vercel:
//   AMOBLA_SHEET_ID    id de la planilla (lo que va entre /d/ y /edit en el link)
//   AMOBLA_SHEET_GID   opcional; id de la pestaña "Prospectos" (por defecto 0)
//
// La planilla tiene que poder leerse con el link (Compartir → "Cualquier persona con
// el enlace" → Lector). Va en una variable y no en el repo porque el repo es público.
//
// Devuelve solo lo que usa el dashboard: inmobiliaria, SDR, estado, fecha de envío,
// canal y score. No devuelve teléfonos, emails ni notas.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// "23/10/2026" → "2026-10-23"
const isoDate = (s) => {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};

module.exports = async (req, res) => {
  const id = process.env.AMOBLA_SHEET_ID;
  if (!id) {
    res.status(503).json({ error: 'Falta configurar AMOBLA_SHEET_ID en Vercel.' });
    return;
  }
  const gid = process.env.AMOBLA_SHEET_GID || '0';
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${encodeURIComponent(gid)}`);
    const text = await r.text();
    if (!r.ok || text.trimStart().startsWith('<')) throw new Error('No se pudo leer la planilla: revisá que se pueda ver con el link.');
    const [head, ...body] = parseCsv(text);
    const col = (name) => head.findIndex((h) => h.trim().toLowerCase() === name);
    const at = {
      p: col('prioridad'), score: col('score'), n: col('inmobiliaria'), sdr: col('sdr'),
      estado: col('estado'), fecha: col('fecha envío'), notas: col('notas'),
    };
    if (at.n < 0 || at.estado < 0) throw new Error('La planilla no tiene las columnas "Inmobiliaria" y "Estado".');
    const rows = body.filter((c) => (c[at.n] || '').trim()).map((c) => {
      const fecha = isoDate(c[at.fecha]);
      const notas = (c[at.notas] || '').toLowerCase();
      return {
        p: Number(c[at.p]) || null,
        n: c[at.n].trim(),
        sdr: (c[at.sdr] || '').trim().replace(/^#.*/, ''), // "#VALUE!" de una fórmula rota → vacío
        estado: (c[at.estado] || '').trim(),
        fecha,
        // Los envíos por mail se anotan "Mail (Gmail) a …"; el resto sale por WhatsApp.
        canal: fecha ? (/^\s*e?-?mail\b/.test(notas) ? 'Email' : 'WhatsApp') : '',
        score: Number(c[at.score]) || 0,
      };
    });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({ updatedAt: new Date().toISOString(), rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

module.exports.parseCsv = parseCsv;
module.exports.isoDate = isoDate;
