// Métricas de producto desde PostHog, en vivo, para el dashboard.
//
// Variables de entorno en Vercel:
//   POSTHOG_API_KEY   clave personal (phx_...) con permiso "Query: read" y acceso
//                     a las organizaciones de cada proyecto.
//   POSTHOG_HOST      opcional; por defecto https://us.posthog.com
//
// Las consultas de cada proyecto están acá abajo. La foto inicial de data.js
// tiene exactamente estas mismas columnas.

const HOST = process.env.POSTHOG_HOST || 'https://us.posthog.com';
const DAY = "toDate(toTimeZone(timestamp, 'America/Argentina/Buenos_Aires'))";
const FROM_META = "lower(properties.utm_source) IN ('meta', 'ig', 'facebook', 'fb', 'instagram')";
// Amobla IA: clic en el botón que genera el diseño ("Crear N diseños gratis",
// "Generar mi diseño"). Ojo: "Amoblar" es solo la pestaña del modo.
const GENERATE_CLICK = "event = '$autocapture' AND (properties.$el_text ILIKE 'Crear % gratis'"
  + " OR properties.$el_text IN ('Generar mi diseño', 'Generar otra variante'))";

const PROJECTS = {
  // Maru Coach · organización "Growth Labs 2"
  'maru-coach': {
    id: 670796,
    queries: {
      daily: `SELECT toString(${DAY}) AS date,
          uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = 'herramienta_resultado') AS resultado,
          uniqIf(person_id, event = 'activacion') AS activados,
          countIf(event = 'compra_confirmada') AS compras,
          sumIf(toFloat(properties.monto), event = 'compra_confirmada') AS ingresos
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
        GROUP BY date ORDER BY date`,
      // Registro nuevo = primer login exitoso de cada persona.
      registros: `SELECT toString(d) AS date, count() AS registros
        FROM (SELECT person_id, min(${DAY}) AS d FROM events WHERE event = 'login_ok' GROUP BY person_id)
        WHERE d >= today() - 60 GROUP BY date ORDER BY date`,
      // Embudo por canal de llegada (UTM de la primera visita de cada persona).
      porCanal: `SELECT if(o.origen IN ('meta', 'ig', 'facebook', 'fb', 'instagram'), 'meta', 'otras') AS canal,
          uniqIf(e.person_id, e.event = '$pageview') AS visitantes,
          uniqIf(e.person_id, e.event = 'match_inicio') AS empezaron,
          uniqIf(e.person_id, e.event = 'herramienta_resultado') AS resultado,
          uniqIf(e.person_id, e.event = 'login_ok') AS registrados,
          uniqIf(e.person_id, e.event = 'activacion') AS activados,
          uniqIf(e.person_id, e.event = 'checkout_creado') AS checkouts,
          uniqIf(e.person_id, e.event = 'compra_confirmada') AS compradores,
          sumIf(toFloat(e.properties.monto), e.event = 'compra_confirmada') AS ingresos
        FROM events e
        LEFT JOIN (SELECT person_id, lower(argMin(properties.utm_source, timestamp)) AS origen
          FROM events WHERE event = '$pageview' GROUP BY person_id) o ON e.person_id = o.person_id
        WHERE e.timestamp >= now() - INTERVAL 60 DAY
        GROUP BY canal ORDER BY canal`,
      nsm: `SELECT uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY) AS ultimos7,
          uniqIf(person_id, timestamp < now() - INTERVAL 7 DAY) AS previos7
        FROM events WHERE event = 'herramienta_resultado' AND timestamp >= now() - INTERVAL 14 DAY`,
      secciones: `SELECT properties.seccion AS seccion, uniq(person_id) AS usuarios, count() AS vistas
        FROM events WHERE event = 'seccion_vista' AND timestamp >= now() - INTERVAL 30 DAY
        GROUP BY seccion ORDER BY usuarios DESC LIMIT 10`,
    },
  },

  // Amobla IA · organización "AmoblaIA". Todavía sin eventos propios: se usan
  // páginas vistas y clics automáticos sobre los botones.
  'amobla-ia': {
    id: 683617,
    queries: {
      daily: `SELECT toString(${DAY}) AS date,
          uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = '$pageview' AND ${FROM_META}) AS visitantesMeta,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/estudio') AS estudio,
          uniqIf(person_id, event = '$autocapture' AND properties.$el_text IN ('Subir mi foto', 'Subí una imagen', 'Cambiar foto')) AS foto,
          uniqIf(person_id, ${GENERATE_CLICK}) AS generaron,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/precios') AS precios
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
        GROUP BY date ORDER BY date`,
      totales: `SELECT uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = '$pageview' AND ${FROM_META}) AS visitantesMeta,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/estudio') AS estudio,
          uniqIf(person_id, event = '$autocapture' AND properties.$el_text IN ('Subir mi foto', 'Subí una imagen', 'Cambiar foto')) AS foto,
          uniqIf(person_id, ${GENERATE_CLICK}) AS generaron,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/precios') AS precios,
          uniqIf(person_id, event = '$autocapture' AND properties.$el_text = 'Rediseñar (plan pago)') AS quisieronPagar,
          countIf(event = '$rageclick') AS rageclicks
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY`,
      nsm: `SELECT uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY) AS ultimos7,
          uniqIf(person_id, timestamp < now() - INTERVAL 7 DAY) AS previos7
        FROM events WHERE ${GENERATE_CLICK} AND timestamp >= now() - INTERVAL 14 DAY`,
      paginas: `SELECT properties.$pathname AS pagina, uniq(person_id) AS visitantes, count() AS vistas
        FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
        GROUP BY pagina ORDER BY visitantes DESC LIMIT 8`,
    },
  },
};

async function runQuery(projectId, sql, key) {
  const res = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || `PostHog respondió ${res.status}`);
  return (body.results || []).map((row) => Object.fromEntries(body.columns.map((c, i) => [c, row[i] ?? 0])));
}

module.exports = async (req, res) => {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'Falta configurar POSTHOG_API_KEY en Vercel.' });
    return;
  }
  const projects = {};
  const errors = {};
  await Promise.all(Object.entries(PROJECTS).map(async ([name, cfg]) => {
    try {
      const entries = await Promise.all(Object.entries(cfg.queries)
        .map(async ([q, sql]) => [q, await runQuery(cfg.id, sql, key)]));
      projects[name] = Object.fromEntries(entries);
    } catch (err) {
      errors[name] = err.message;
    }
  }));
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.status(Object.keys(projects).length ? 200 : 502).json({ updatedAt: new Date().toISOString(), projects, errors });
};

module.exports.PROJECTS = PROJECTS;
