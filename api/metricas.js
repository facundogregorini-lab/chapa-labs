// Prospección, demos, ingresos y uso, en vivo, desde los endpoints /api/metricas de
// cada producto (habita. y Turnia). Cada app calcula sus números con las mismas
// reglas que su panel; acá solo se reenvían.
//
// Variables de entorno en Vercel:
//   HABITA_METRICS_SECRET   la misma clave que METRICS_SECRET en el proyecto de habita.
//   TURNIA_METRICS_SECRET   la misma clave que METRICS_SECRET en el proyecto de Turnia.
//   HABITA_METRICS_URL      opcional; por defecto https://amoblaia.vercel.app/api/metricas
//   TURNIA_METRICS_URL      opcional; por defecto https://turniasalud.vercel.app/api/metricas
//
// Período: sin parámetros es el histórico. Con ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
// (días de Buenos Aires, ambos incluidos). Los endpoints devuelven solo totales y
// series por día: nada de nombres, teléfonos ni emails.

const SOURCES = {
  'amobla-ia': {
    url: () => process.env.HABITA_METRICS_URL || 'https://amoblaia.vercel.app/api/metricas',
    secret: () => process.env.HABITA_METRICS_SECRET,
    secretName: 'HABITA_METRICS_SECRET',
  },
  turnia: {
    url: () => process.env.TURNIA_METRICS_URL || 'https://turniasalud.vercel.app/api/metricas',
    secret: () => process.env.TURNIA_METRICS_SECRET,
    secretName: 'TURNIA_METRICS_SECRET',
  },
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

async function fetchSource(cfg, desde, hasta) {
  const url = new URL(cfg.url());
  if (desde) url.searchParams.set('desde', desde);
  if (hasta) url.searchParams.set('hasta', hasta);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${cfg.secret()}` }, signal: ctrl.signal });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `Respondió ${r.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  const { desde, hasta } = req.query || {};
  if ((desde || hasta) && (!ISO_DAY.test(desde || '') || !ISO_DAY.test(hasta || '') || desde > hasta)) {
    res.status(400).json({ error: 'Período inválido: usá desde y hasta con formato AAAA-MM-DD.' });
    return;
  }
  const projects = {};
  const errors = {};
  await Promise.all(Object.entries(SOURCES).map(async ([id, cfg]) => {
    if (!cfg.secret()) {
      errors[id] = `Falta configurar ${cfg.secretName} en Vercel.`;
      return;
    }
    try {
      projects[id] = await fetchSource(cfg, desde, hasta);
    } catch (err) {
      errors[id] = err.name === 'AbortError' ? 'No respondió a tiempo.' : err.message;
    }
  }));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  res.status(Object.keys(projects).length ? 200 : 503).json({ updatedAt: new Date().toISOString(), desde: desde || null, hasta: hasta || null, projects, errors });
};

module.exports.SOURCES = SOURCES;
