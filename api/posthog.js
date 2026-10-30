// Métricas de producto desde PostHog, en vivo, para el dashboard.
//
// Variables de entorno en Vercel:
//   POSTHOG_API_KEY   clave personal (phx_...) con permiso "Query: read" y acceso
//                     a las organizaciones de cada proyecto.
//   POSTHOG_HOST      opcional; por defecto https://us.posthog.com
//
// Las consultas de cada proyecto están acá abajo. La foto inicial de data.js
// tiene exactamente estas mismas columnas.
//
// Período: sin parámetros es el histórico completo. Con ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
// (días de Buenos Aires, ambos incluidos) las consultas de Producto y
// Distribución se limitan a ese período. La North Star (últimos 7 días) no cambia.
// En las consultas, {ts} es la condición sobre `timestamp`, {ets} sobre
// `e.timestamp` y {dia} sobre la columna `d` (una fecha).

const HOST = process.env.POSTHOG_HOST || 'https://us.posthog.com';
const DAY = "toDate(toTimeZone(timestamp, 'America/Argentina/Buenos_Aires'))";
const FROM_META = "lower(properties.utm_source) IN ('meta', 'ig', 'facebook', 'fb', 'instagram')";
// Tráfico del equipo: las apps marcan is_internal en sus dispositivos.
const EXTERNAL = "ifNull(toString(properties.is_internal), '') != 'true'";
// Las demos y los links de la prospección llevan un token en la URL: se agrupan.
const PAGE = "multiIf(properties.$pathname LIKE '/demo/%', '/demo/…', properties.$pathname LIKE '/p/%', '/p/…', properties.$pathname)";
// habita.: alguien interactuó con una demo pública (estilos, fotos, comparación, descargas).
const DEMO_INTERACTION = "event IN ('demo_estilo', 'demo_style_viewed', 'demo_photo_changed', 'comparison_slider_used', 'demo_fullscreen_toggled', 'demo_owner_download', 'demo_owner_generar')";
const AGENCY_JOINED = "event IN ('agency_created', 'agency_claimed', 'agency_user_joined')";
// Turnia comparte el proyecto de PostHog con otras apps: solo cuenta su dominio.
const TURNIA_SITE = "properties.$host ILIKE '%turnia%'";

// Funnels ordenados: cada persona tiene que dar los pasos en ese orden, dentro
// de la ventana. Devuelve una fila por funnel con las personas de cada paso
// (s1 … s10; los pasos que el funnel no tiene quedan en 0).
const MAX_STEPS = 10;
function funnelsQuery(defs, days) {
  return Object.entries(defs).map(([id, steps]) => `SELECT '${id}' AS funnel,
      ${Array.from({ length: MAX_STEPS }, (_, i) => `countIf(l >= ${i + 1}) AS s${i + 1}`).join(', ')}
    FROM (SELECT person_id, windowFunnel(${days * 86400})(toDateTime(timestamp), ${steps.map((c) => `(${c})`).join(', ')}) AS l
      FROM events WHERE {ts} GROUP BY person_id)`).join('\nUNION ALL\n');
}

// Maru Coach. El orden de los pasos es el de las etiquetas de data.js.
const section = (s) => `event = 'seccion_vista' AND properties.seccion = '${s}'`;
const result = (h) => `event = 'herramienta_resultado' AND properties.herramienta = '${h}'`;
// Activación: descargó o usó el resultado. CV y Postulación comparten editor,
// así que se separan por sección.
const activation = (key, v) => `event = 'activacion' AND properties.${key} = '${v}'`;
const MARU_FUNNELS = {
  // Visita → resultado → precios (límite gratis, modal de una función pro o la
  // página /precios) → elige un plan → Mercado Pago → suscripción.
  general: [
    "event = '$pageview'",
    "event = 'herramienta_resultado'",
    `event IN ('limite_planes_visto', 'funcion_plan_vista') OR (${section('precios')})`,
    "event = 'plan_click'",
    "event = 'checkout_creado'",
    "event = 'compra_confirmada'",
  ],
  // Una por función: entra → resultado → lo usa.
  // Match hasta el final: prepara la postulación personalizada, recibe el CV
  // adaptado y lo descarga.
  match: [section('match'), "event = 'match_inicio'", result('match'), "event = 'match_preparar_postulacion'",
    result('postulacion'), activation('seccion', 'postulacion')],
  cv: [section('cv'), result('cv'), activation('seccion', 'cv')],
  postulacion: [section('postulacion'), result('postulacion'), activation('seccion', 'postulacion')],
  carta: [section('carta'), result('carta'), activation('herramienta', 'carta')],
  entrevista: [section('entrevista'), result('entrevista'), activation('herramienta', 'entrevista')],
  video: [section('video'), result('video'), activation('herramienta', 'video')],
  // Recorridos que cruzan pantallas. El match completo sigue en Postulación
  // (/postulacion con el aviso cargado) hasta el último paso de esa pantalla:
  // completar el formulario con la extensión.
  matchPasos: ["event = 'match_inicio'", "event = 'match_cv_listo'", "event = 'match_perfil_confirmado'",
    "event = 'match_preferencias_listas'", "event = 'match_ranking_visto'", "event = 'match_preparar_postulacion'",
    result('postulacion'), activation('seccion', 'postulacion'), "event IN ('extension_store', 'extension_descarga')"],
  ingreso: ["event = 'login_pedido'", "event = 'login_google'", "event = 'login_ok'"],
};

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
        FROM events WHERE {ts}
        GROUP BY date ORDER BY date`,
      // Registro nuevo = primer login exitoso de cada persona.
      registros: `SELECT toString(d) AS date, count() AS registros
        FROM (SELECT person_id, min(${DAY}) AS d FROM events WHERE event = 'login_ok' GROUP BY person_id)
        WHERE {dia} GROUP BY date ORDER BY date`,
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
        WHERE {ets}
        GROUP BY canal ORDER BY canal`,
      nsm: `SELECT uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY) AS ultimos7,
          uniqIf(person_id, timestamp < now() - INTERVAL 7 DAY) AS previos7
        FROM events WHERE event = 'herramienta_resultado' AND timestamp >= now() - INTERVAL 14 DAY`,
      secciones: `SELECT properties.seccion AS seccion, uniq(person_id) AS usuarios, count() AS vistas
        FROM events WHERE event = 'seccion_vista' AND {ts}
        GROUP BY seccion ORDER BY usuarios DESC LIMIT 10`,
      funnels: funnelsQuery(MARU_FUNNELS, 30),
    },
  },

  // habita. (ex Amobla IA) · organización "AmoblaIA". Eventos propios de la app
  // (foto_subida, diseno_generado, demo_vista…) y páginas vistas; sin el equipo.
  'amobla-ia': {
    id: 683617,
    queries: {
      daily: `SELECT toString(${DAY}) AS date,
          uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = '$pageview' AND ${FROM_META}) AS visitantesMeta,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/estudio') AS estudio,
          uniqIf(person_id, event = 'foto_subida') AS foto,
          uniqIf(person_id, event = 'diseno_generado') AS generaron,
          countIf(event = 'diseno_generado') AS disenos,
          uniqIf(person_id, event = 'demo_vista') AS demoVieron,
          uniqIf(person_id, ${AGENCY_JOINED}) AS inmobiliarias
        FROM events WHERE {ts} AND ${EXTERNAL}
        GROUP BY date ORDER BY date`,
      totales: `SELECT uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = '$pageview' AND ${FROM_META}) AS visitantesMeta,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/estudio') AS estudio,
          uniqIf(person_id, event = 'foto_subida') AS foto,
          uniqIf(person_id, event = 'diseno_generado') AS generaron,
          countIf(event = 'diseno_generado') AS disenos,
          uniqIf(person_id, event = '$pageview' AND properties.$pathname = '/precios') AS precios,
          uniqIf(person_id, event = 'plan_click') AS eligieronPlan,
          uniqIf(person_id, event = 'checkout_creado') AS mercadoPago,
          uniqIf(person_id, event = 'compra_confirmada') AS pagaron,
          uniqIf(person_id, event = 'demo_vista') AS demoVieron,
          uniqIf(person_id, ${DEMO_INTERACTION}) AS demoInteractuaron,
          uniqIf(person_id, event = 'demo_agency_cta_clicked') AS demoCta,
          uniqIf(person_id, event = 'agency_signup_started') AS altaVista,
          uniqIf(person_id, ${AGENCY_JOINED}) AS inmobiliarias,
          uniqIf(person_id, event = 'asistente_pregunta') AS asistente,
          countIf(event = '$rageclick') AS rageclicks
        FROM events WHERE {ts} AND ${EXTERNAL}`,
      // North Star: diseños generados (cada ambientación terminada).
      nsm: `SELECT countIf(timestamp >= now() - INTERVAL 7 DAY) AS ultimos7,
          countIf(timestamp < now() - INTERVAL 7 DAY) AS previos7
        FROM events WHERE event = 'diseno_generado' AND timestamp >= now() - INTERVAL 14 DAY AND ${EXTERNAL}`,
      paginas: `SELECT ${PAGE} AS pagina, uniq(person_id) AS visitantes, count() AS vistas
        FROM events WHERE event = '$pageview' AND {ts} AND ${EXTERNAL}
        GROUP BY pagina ORDER BY visitantes DESC LIMIT 8`,
    },
  },

  // Turnia · proyecto 518346 (organización "Ai lab"). Lo comparte con otras apps
  // (Loreado, Copiloto), así que todo se limita al dominio de Turnia. La clave de
  // POSTHOG_API_KEY tiene que tener acceso a ese proyecto. El panel no se mide
  // (datos de pacientes). Eventos: ANALITICA.md del repo turniasalud.
  turnia: {
    id: 518346,
    queries: {
      daily: `SELECT toString(${DAY}) AS date,
          uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = 'personal_demo_viewed') AS demoPersonal,
          uniqIf(person_id, event = 'demo_started') AS empezaronDemo,
          uniqIf(person_id, event = 'demo_conversation_started') AS conversaron,
          uniqIf(person_id, event = 'lead_created') AS pedidos
        FROM events WHERE {ts} AND ${TURNIA_SITE} AND ${EXTERNAL}
        GROUP BY date ORDER BY date`,
      totales: `SELECT uniqIf(person_id, event = '$pageview') AS visitantes,
          uniqIf(person_id, event = 'personal_demo_viewed') AS demoPersonal,
          uniqIf(person_id, event = 'demo_form_viewed') AS formulario,
          uniqIf(person_id, event = 'demo_started') AS empezaronDemo,
          uniqIf(person_id, event = 'demo_ready_seen') AS demoLista,
          uniqIf(person_id, event = 'demo_conversation_started') AS conversaron,
          uniqIf(person_id, event = 'demo_audio_played') AS escucharon,
          uniqIf(person_id, event = 'lead_created') AS pedidos,
          countIf(event = '$rageclick') AS rageclicks
        FROM events WHERE {ts} AND ${TURNIA_SITE} AND ${EXTERNAL}`,
      paginas: `SELECT ${PAGE} AS pagina, uniq(person_id) AS visitantes, count() AS vistas
        FROM events WHERE event = '$pageview' AND {ts} AND ${TURNIA_SITE} AND ${EXTERNAL}
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

// Condiciones del período. Las fechas se validan antes de entrar a la consulta.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "'America/Argentina/Buenos_Aires'";
function periodSql(desde, hasta) {
  if (!desde && !hasta) return { ts: '1 = 1', ets: '1 = 1', dia: '1 = 1' };
  if (!ISO_DAY.test(desde || '') || !ISO_DAY.test(hasta || '') || desde > hasta) return null;
  const from = (col) => `${col} >= toDateTime('${desde} 00:00:00', ${TZ})`;
  const to = (col) => `${col} < toDateTime('${hasta} 00:00:00', ${TZ}) + INTERVAL 1 DAY`;
  return {
    ts: `${from('timestamp')} AND ${to('timestamp')}`,
    ets: `${from('e.timestamp')} AND ${to('e.timestamp')}`,
    dia: `d >= toDate('${desde}') AND d <= toDate('${hasta}')`,
  };
}
const withPeriod = (sql, period) => sql.replace(/\{(ts|ets|dia)\}/g, (_, k) => period[k]);

module.exports = async (req, res) => {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'Falta configurar POSTHOG_API_KEY en Vercel.' });
    return;
  }
  const query = req.query || {};
  const period = periodSql(query.desde, query.hasta);
  if (!period) {
    res.status(400).json({ error: 'Período inválido: usá desde y hasta con formato AAAA-MM-DD.' });
    return;
  }
  const projects = {};
  const errors = {};
  await Promise.all(Object.entries(PROJECTS).map(async ([name, cfg]) => {
    try {
      const entries = await Promise.all(Object.entries(cfg.queries)
        .map(async ([q, sql]) => [q, await runQuery(cfg.id, withPeriod(sql, period), key)]));
      projects[name] = Object.fromEntries(entries);
    } catch (err) {
      errors[name] = err.message;
    }
  }));
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.status(Object.keys(projects).length ? 200 : 502).json({ updatedAt: new Date().toISOString(), desde: query.desde || null, hasta: query.hasta || null, projects, errors });
};

module.exports.PROJECTS = PROJECTS;
module.exports.periodSql = periodSql;
module.exports.withPeriod = withPeriod;
