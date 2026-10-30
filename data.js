/*
 * Datos del dashboard de Chapa Labs.
 *
 * Lo que tiene `noData: true` todavía no tiene fuente conectada: se muestra en 0
 * con la etiqueta "Sin datos". Nunca se cargan números inventados.
 * Los bloques `ads` (Meta Ads), `posthog` (PostHog) y `metrics` (las apps) son
 * datos reales: esta es la foto guardada, y /api/meta, /api/posthog y
 * /api/metricas la actualizan en vivo.
 *
 * Cada proyecto tiene:
 *   - ads:         pauta real en Meta Ads (opcional), por día y campaña.
 *   - posthog:     resultados de las consultas de api/posthog.js (opcional).
 *   - metrics:     foto de /api/metricas de la app (habita. y Turnia): prospección,
 *                  demos, ingresos y uso. Se lee con rutas como 'demos.creadas'.
 *   - northStar:   la métrica principal. Con `posthog` sale de esas consultas;
 *                  si no, de una serie mensual con meta.
 *   - acquisition: "funnel" (embudo real por canal + inversión de Meta),
 *                  "paid" (pauta por mes), "outbound" (embudo comercial por mes)
 *                  "prospects" (planilla de prospección + ventas proyectadas)
 *                  o "pipeline" (secciones de prospección y demos desde `metrics`).
 *                  Se muestra en la sección Distribución.
 *   - usability:   KPIs, embudo y tablas de uso (sección Producto). Con `query`
 *                  salen de PostHog.
 *
 * Los meses van en formato "AAAA-MM" y en el mismo orden en todas las series.
 * Para sumar un proyecto, copiá uno de los bloques y cambiá el id.
 */
window.CHAPA_DATA = {
  updatedAt: '2026-10-30',
  team: ['Facundo', 'Axel'],

  projects: [
    // ─────────────────────────────────────────── MARU COACH
    {
      id: 'maru-coach',
      name: 'Maru Coach',
      tagline: 'Coach de búsqueda laboral con IA · pauta paga',
      stage: 'Lanzamiento',
      currency: 'ARS',
      // Analítica real de PostHog (organización "Growth Labs 2"). Mismas columnas
      // que las consultas de api/posthog.js, que la actualizan en vivo.
      posthog: {
        org: 'Growth Labs 2',
        projectId: 670796,
        snapshotAt: '2026-10-25',
        data: {
          daily: [
            { date: '2026-10-17', visitantes: 6, resultado: 0, activados: 0, compras: 0, ingresos: 0 },
            { date: '2026-10-18', visitantes: 99, resultado: 3, activados: 2, compras: 0, ingresos: 0 },
            { date: '2026-10-19', visitantes: 91, resultado: 14, activados: 2, compras: 0, ingresos: 0 },
            { date: '2026-10-20', visitantes: 140, resultado: 14, activados: 5, compras: 0, ingresos: 0 },
            { date: '2026-10-21', visitantes: 57, resultado: 10, activados: 0, compras: 0, ingresos: 0 },
            { date: '2026-10-22', visitantes: 112, resultado: 16, activados: 1, compras: 0, ingresos: 0 },
            { date: '2026-10-23', visitantes: 158, resultado: 28, activados: 6, compras: 0, ingresos: 0 },
            { date: '2026-10-24', visitantes: 153, resultado: 25, activados: 6, compras: 2, ingresos: 1980 },
            { date: '2026-10-25', visitantes: 60, resultado: 5, activados: 0, compras: 0, ingresos: 0 },
          ],
          registros: [
            { date: '2026-10-19', registros: 8 },
            { date: '2026-10-20', registros: 9 },
            { date: '2026-10-21', registros: 5 },
            { date: '2026-10-22', registros: 3 },
            { date: '2026-10-23', registros: 19 },
            { date: '2026-10-24', registros: 16 },
            { date: '2026-10-25', registros: 1 },
          ],
          porCanal: [
            { canal: 'meta', visitantes: 496, empezaron: 112, resultado: 67, registrados: 35, activados: 12, checkouts: 2, compradores: 1, ingresos: 990 },
            { canal: 'otras', visitantes: 326, empezaron: 66, resultado: 30, registrados: 26, activados: 10, checkouts: 1, compradores: 1, ingresos: 990 },
          ],
          nsm: [{ ultimos7: 97, previos7: 2 }],
          // Funnels ordenados del histórico (consulta "funnels"; foto del 26/10).
          funnels: [
            { funnel: 'general', s1: 905, s2: 105, s3: 19, s4: 4, s5: 3, s6: 2 },
            { funnel: 'match', s1: 255, s2: 204, s3: 98, s4: 43, s5: 18, s6: 10 },
            { funnel: 'cv', s1: 188, s2: 15, s3: 13, s4: 0, s5: 0, s6: 0 },
            { funnel: 'postulacion', s1: 79, s2: 22, s3: 14, s4: 0, s5: 0, s6: 0 },
            { funnel: 'carta', s1: 16, s2: 1, s3: 1, s4: 0, s5: 0, s6: 0 },
            { funnel: 'entrevista', s1: 14, s2: 1, s3: 0, s4: 0, s5: 0, s6: 0 },
            { funnel: 'video', s1: 12, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 },
            { funnel: 'matchPasos', s1: 207, s2: 101, s3: 94, s4: 90, s5: 88, s6: 40, s7: 16, s8: 8, s9: 1 },
            { funnel: 'ingreso', s1: 97, s2: 81, s3: 68, s4: 0, s5: 0, s6: 0 },
          ],
          secciones: [
            { seccion: 'match', usuarios: 225, vistas: 482 },
            { seccion: 'cv', usuarios: 171, vistas: 263 },
            { seccion: 'busquedas', usuarios: 78, vistas: 253 },
            { seccion: 'postulacion', usuarios: 73, vistas: 162 },
            { seccion: 'precios', usuarios: 50, vistas: 85 },
            { seccion: 'carta', usuarios: 15, vistas: 20 },
            { seccion: 'entrevista', usuarios: 13, vistas: 14 },
            { seccion: 'video', usuarios: 11, vistas: 12 },
            { seccion: 'seguimiento', usuarios: 11, vistas: 16 },
            { seccion: 'extension', usuarios: 11, vistas: 16 },
          ],
        },
      },
      northStar: {
        name: 'Personas que obtienen un resultado',
        definition: 'Personas que recibieron un resultado de la herramienta (match, CV o postulación) en los últimos 7 días. Evento herramienta_resultado.',
        format: 'int',
        posthog: { query: 'nsm', value: 'ultimos7', prev: 'previos7', daily: 'daily', dailyKey: 'resultado' },
      },
      // Suscriptores e ingresos por día (PostHog: compra_confirmada y su monto).
      revenue: {
        query: 'daily',
        subsKey: 'compras',
        revenueKey: 'ingresos',
        currency: 'ARS',
        subsLabel: 'Nuevos suscriptores',
        unitLabel: 'suscriptor',
        note: 'Pagos confirmados por Mercado Pago (evento compra_confirmada). Ingresos = monto cobrado.',
      },
      // Pauta real en Meta Ads (cuenta "Costa Reset"). Se actualiza en vivo
      // desde /api/meta cuando está configurado META_ACCESS_TOKEN en Vercel;
      // si no, se usa esta foto.
      ads: {
        source: 'Meta Ads',
        currency: 'ARS',
        match: 'MARU', // campañas cuyo nombre empieza así
        resultLabel: 'Vieron el paywall',
        resultAction: 'offsite_conversion.fb_pixel_custom.maru_paywall_viewed',
        snapshotAt: '2026-10-25',
        campaigns: [
          { id: '120248861665880157', name: 'MARU | Límite gratuito | AR | Test01', status: 'ACTIVE', start: '2026-10-18' },
        ],
        daily: [
          { date: '2026-10-18', campaignId: '120248861665880157', spend: 2323.38, impressions: 846, clicks: 20, landing: 12, results: 0 },
          { date: '2026-10-19', campaignId: '120248861665880157', spend: 7115.93, impressions: 3265, clicks: 53, landing: 50, results: 1 },
          { date: '2026-10-20', campaignId: '120248861665880157', spend: 4726.62, impressions: 2238, clicks: 37, landing: 31, results: 1 },
          { date: '2026-10-21', campaignId: '120248861665880157', spend: 3670.98, impressions: 1635, clicks: 34, landing: 30, results: 0 },
          { date: '2026-10-22', campaignId: '120248861665880157', spend: 5181.55, impressions: 2453, clicks: 57, landing: 38, results: 0 },
          { date: '2026-10-23', campaignId: '120248861665880157', spend: 7604.44, impressions: 3562, clicks: 84, landing: 68, results: 2 },
          { date: '2026-10-24', campaignId: '120248861665880157', spend: 10987.88, impressions: 4035, clicks: 92, landing: 63, results: 3 },
          { date: '2026-10-25', campaignId: '120248861665880157', spend: 4869.33, impressions: 1653, clicks: 45, landing: 25, results: 0 },
        ],
      },
      // Embudo real: canal según la UTM de la primera visita (PostHog) y la
      // inversión de Meta Ads para costo por registro, CPA y ROI.
      acquisition: {
        type: 'funnel',
        query: 'porCanal',
        paidChannel: 'meta',
        channels: { meta: 'Meta Ads', otras: 'Otras fuentes' },
        steps: [
          { key: 'visitantes', label: 'Visitaron la web' },
          { key: 'empezaron', label: 'Empezaron el match' },
          { key: 'resultado', label: 'Obtuvieron un resultado' },
          { key: 'registrados', label: 'Se registraron' },
          { key: 'activados', label: 'Se activaron' },
          { key: 'checkouts', label: 'Iniciaron el pago' },
          { key: 'compradores', label: 'Se suscribieron' },
        ],
        signupKey: 'registrados',
        buyerKey: 'compradores',
        buyerLabel: 'Suscriptores',
        revenueKey: 'ingresos',
      },
      usability: {
        kpis: [
          { label: 'Visitantes únicos', query: 'porCanal', key: 'visitantes', format: 'int' },
          { label: 'Empezaron el match', hint: '% de los visitantes', query: 'porCanal', key: 'empezaron', of: 'visitantes', format: 'pct' },
          { label: 'Obtuvieron un resultado', hint: '% de los que empezaron', query: 'porCanal', key: 'resultado', of: 'empezaron', format: 'pct' },
          { label: 'Activación', hint: 'Activados / registrados', query: 'porCanal', key: 'activados', of: 'registrados', format: 'pct' },
        ],
        // Volumen por función: personas que entraron y veces que se abrió.
        features: {
          title: 'Funciones más usadas',
          note: 'la barra es la cantidad de personas',
          query: 'secciones',
          labelKey: 'seccion',
          key: 'usuarios',
          secondary: 'vistas',
          names: {
            match: 'Match', cv: 'CV', busquedas: 'Búsquedas', postulacion: 'Postulación', precios: 'Precios',
            carta: 'Carta', entrevista: 'Entrevista', video: 'Video', seguimiento: 'Seguimiento', extension: 'Extensión',
          },
        },
        // Funnels ordenados: el mismo id que en la consulta "funnels" de
        // api/posthog.js y una etiqueta por paso, en el mismo orden.
        funnelGroups: [
          {
            title: 'Funnel general',
            note: 'cada persona en orden, con hasta 30 días entre el primer y el último paso',
            query: 'funnels',
            funnels: [
              {
                id: 'general',
                title: 'De la visita a la suscripción',
                note: 'Llegar a precios: ver el modal de planes (por el límite gratis o una función pro) o abrir la página de precios.',
                steps: ['Visitaron la web', 'Obtuvieron un resultado', 'Llegaron a precios', 'Eligieron un plan', 'Fueron a Mercado Pago', 'Se suscribieron'],
              },
            ],
          },
          {
            title: 'Funnel por función',
            note: 'entran, obtienen un resultado y lo usan (descargan o copian)',
            query: 'funnels',
            funnels: [
              { id: 'match', title: 'Match', note: 'Sigue en la postulación personalizada hasta descargar el CV.', steps: ['Entraron', 'Empezaron el match', 'Vieron su ranking', 'Tocaron «Preparar postulación»', 'Obtuvieron el CV adaptado', 'Descargaron el CV'] },
              { id: 'cv', title: 'CV', steps: ['Entraron', 'Obtuvieron su CV', 'Lo descargaron'] },
              { id: 'postulacion', title: 'Postulación', steps: ['Entraron', 'Obtuvieron su CV adaptado', 'Lo descargaron'] },
              { id: 'carta', title: 'Carta', steps: ['Entraron', 'Obtuvieron su carta', 'La descargaron o copiaron'] },
              { id: 'entrevista', title: 'Entrevista', steps: ['Entraron', 'Prepararon la entrevista', 'Recibieron el informe'] },
              { id: 'video', title: 'Video', steps: ['Entraron', 'Obtuvieron el guion', 'Grabaron el video'] },
            ],
          },
          {
            title: 'Journeys',
            note: 'recorridos que cruzan varias pantallas',
            query: 'funnels',
            funnels: [
              {
                id: 'matchPasos',
                title: 'Match completo, hasta la postulación',
                note: 'Del match a la postulación personalizada (/postulacion con el aviso cargado) y su último paso: completar el formulario con la extensión. El análisis del aviso no manda evento, por eso no es un paso.',
                wide: true,
                steps: ['Empezaron el match', 'Cargaron el CV', 'Confirmaron el perfil', 'Completaron preferencias', 'Vieron el ranking', 'Tocaron «Preparar postulación»', 'Obtuvieron el CV adaptado', 'Descargaron el CV', 'Fueron a la extensión'],
              },
              { id: 'ingreso', title: 'Ingreso con Google', steps: ['Se les pidió ingresar', 'Tocaron Google', 'Ingresaron'] },
            ],
          },
        ],
        tables: [
          {
            title: 'Por día',
            note: 'Personas únicas por día. Registro = primer login.',
            wide: true,
            query: ['daily', 'registros'],
            columns: [
              { key: 'date', label: 'Día', format: 'day' },
              { key: 'visitantes', label: 'Visitantes', format: 'int' },
              { key: 'resultado', label: 'Con resultado', format: 'int' },
              { key: 'registros', label: 'Registros', format: 'int' },
              { key: 'activados', label: 'Activados', format: 'int' },
              { key: 'compras', label: 'Suscripciones', format: 'int' },
              { key: 'ingresos', label: 'Ingresos', format: 'money' },
            ],
          },
        ],
      },
    },

    // ─────────────────────────────────────────── HABITA. (ex Amobla IA)
    // El id sigue siendo amobla-ia para no romper los links (#amobla-ia).
    {
      id: 'amobla-ia',
      name: 'habita.',
      tagline: 'Virtual staging con IA para inmobiliarias · prospección, demos y Meta Ads',
      stage: 'Lanzamiento',
      currency: 'ARS',
      // Analítica real de PostHog (organización "AmoblaIA"), sin el tráfico del
      // equipo. Mismas columnas que las consultas de api/posthog.js.
      posthog: {
        org: 'AmoblaIA',
        projectId: 683617,
        snapshotAt: '2026-10-30',
        data: {
          daily: [
            { date: '2026-10-23', visitantes: 36, visitantesMeta: 12, foto: 0, generaron: 0, disenos: 0, demoVieron: 0, inmobiliarias: 0 },
            { date: '2026-10-24', visitantes: 38, visitantesMeta: 26, foto: 0, generaron: 0, disenos: 0, demoVieron: 0, inmobiliarias: 0 },
            { date: '2026-10-25', visitantes: 70, visitantesMeta: 17, foto: 2, generaron: 2, disenos: 31, demoVieron: 0, inmobiliarias: 0 },
            { date: '2026-10-26', visitantes: 126, visitantesMeta: 17, foto: 7, generaron: 7, disenos: 51, demoVieron: 7, inmobiliarias: 0 },
            { date: '2026-10-27', visitantes: 163, visitantesMeta: 4, foto: 13, generaron: 12, disenos: 100, demoVieron: 7, inmobiliarias: 2 },
            { date: '2026-10-28', visitantes: 53, visitantesMeta: 8, foto: 16, generaron: 4, disenos: 33, demoVieron: 6, inmobiliarias: 0 },
            { date: '2026-10-29', visitantes: 65, visitantesMeta: 10, foto: 8, generaron: 8, disenos: 54, demoVieron: 18, inmobiliarias: 0 },
            { date: '2026-10-30', visitantes: 26, visitantesMeta: 6, foto: 5, generaron: 5, disenos: 24, demoVieron: 3, inmobiliarias: 1 },
          ],
          totales: [{
            visitantes: 534, visitantesMeta: 92, estudio: 194, foto: 49, generaron: 36, disenos: 293, precios: 41,
            eligieronPlan: 1, mercadoPago: 0, pagaron: 0, demoVieron: 32, demoInteractuaron: 14, demoCta: 11,
            altaVista: 7, inmobiliarias: 3, asistente: 0, rageclicks: 60,
          }],
          nsm: [{ ultimos7: 293, previos7: 0 }],
          // Las demos llevan un token en la URL: se agrupan en /demo/….
          paginas: [
            { pagina: '/', visitantes: 306, vistas: 607 },
            { pagina: '/estudio', visitantes: 194, vistas: 317 },
            { pagina: '/precios', visitantes: 41, vistas: 89 },
            { pagina: '/demo/…', visitantes: 30, vistas: 194 },
            { pagina: '/galeria', visitantes: 24, vistas: 44 },
            { pagina: '/acceso', visitantes: 20, vistas: 43 },
            { pagina: '/panel/empezar', visitantes: 15, vistas: 35 },
            { pagina: '/marca-blanca', visitantes: 7, vistas: 14 },
          ],
        },
      },
      // Prospección, demos e ingresos del panel de habita. (Supabase). /api/metricas
      // los trae en vivo de /api/metricas de la app; esta es la foto del 30/10.
      metrics: {
        source: 'panel de habita.',
        snapshotAt: '2026-10-30',
        data: {
          prospeccion: {
            prospectados: 605, contactados: 65, mensajes: 65, respondieron: 0, interesados: 0, activados: 0, clientes: 0,
            etapas: { pending: 540, sent: 65 },
            porSdr: [
              { sdr: 'Facu', prospectados: 565, contactados: 37, respondieron: 0, interesados: 0, clientes: 0 },
              { sdr: 'Laban', prospectados: 40, contactados: 28, respondieron: 0, interesados: 0, clientes: 0 },
            ],
            porCanal: [{ canal: 'whatsapp', contactados: 65, mensajes: 65, respondieron: 0, interesados: 0, clientes: 0 }],
            diario: [
              { date: '2026-10-23', envios: 41, nuevos: 41, respuestas: 0, interesados: 0, reuniones: 0 },
              { date: '2026-10-24', envios: 17, nuevos: 17, respuestas: 0, interesados: 0, reuniones: 0 },
              { date: '2026-10-27', envios: 7, nuevos: 7, respuestas: 0, interesados: 0, reuniones: 0 },
            ],
          },
          demos: {
            creadas: 20, publicadas: 18, ingresaron: 8, interactuaron: 4, generaron: 2, panel: 0, suscribieron: 0, visitantes: 21,
            diario: [
              { date: '2026-10-26', creadas: 5, publicadas: 5, visita: 0, generacion: 0 },
              { date: '2026-10-27', creadas: 2, publicadas: 1, visita: 0, generacion: 0 },
              { date: '2026-10-28', creadas: 1, publicadas: 0, visita: 0, generacion: 0 },
              { date: '2026-10-29', creadas: 9, publicadas: 10, visita: 18, generacion: 2 },
              { date: '2026-10-30', creadas: 3, publicadas: 2, visita: 3, generacion: 0 },
            ],
          },
          ingresos: {
            moneda: 'ARS', pagos: 1, ingresos: 4990, nuevos: 1, clientes: 1,
            diario: [{ date: '2026-10-22', pagos: 1, ingresos: 4990, nuevos: 1 }],
          },
        },
      },
      northStar: {
        name: 'Diseños generados',
        definition: 'Ambientaciones terminadas en los últimos 7 días (evento diseno_generado), en el estudio, el panel y las demos. Sin el tráfico del equipo.',
        format: 'int',
        posthog: { query: 'nsm', value: 'ultimos7', prev: 'previos7', daily: 'daily', dailyKey: 'disenos' },
      },
      revenue: {
        metrics: 'ingresos.diario',
        subsKey: 'nuevos',
        revenueKey: 'ingresos',
        currency: 'ARS',
        subsLabel: 'Nuevos clientes',
        unitLabel: 'cliente',
        note: 'Pagos aprobados en Mercado Pago (tabla payments de habita.). Nuevos = primer pago de cada comprador.',
      },
      ads: {
        source: 'Meta Ads',
        currency: 'ARS',
        match: 'amoblaIA',
        resultLabel: 'Fotos subidas',
        resultAction: 'offsite_conversion.custom.1095995133177105',
        snapshotAt: '2026-10-25',
        campaigns: [
          { id: '120248966713100157', name: 'amoblaIA | Web - Foto subida | Inmobiliarias AR', status: 'ACTIVE', start: '2026-10-23' },
          { id: '120248947599480157', name: 'amoblaIA | Leads | Inmobiliarias AR', status: 'PAUSED', start: '2026-10-23' },
        ],
        daily: [
          { date: '2026-10-23', campaignId: '120248966713100157', spend: 1677.86, impressions: 430, clicks: 16, landing: 7, results: 0 },
          { date: '2026-10-24', campaignId: '120248966713100157', spend: 9159.73, impressions: 1454, clicks: 27, landing: 18, results: 0 },
          { date: '2026-10-25', campaignId: '120248966713100157', spend: 811.43, impressions: 117, clicks: 2, landing: 2, results: 0 },
        ],
      },
      acquisition: {
        type: 'pipeline',
        subtitle: 'prospección → demos → clientes',
        emptyNote: 'Falta conectar /api/metricas de habita. (ver README).',
        sections: [
          {
            title: 'Prospección',
            note: 'Cohorte del primer envío confirmado, con las reglas del panel /admin/prospeccion',
            kpis: [
              { label: 'Prospectados', hint: 'Inmobiliarias en la base', metrics: 'prospeccion.prospectados' },
              { label: 'Contactados', hint: 'Con un envío confirmado', metrics: 'prospeccion.contactados' },
              { label: 'Mensajes enviados', metrics: 'prospeccion.mensajes' },
              { label: 'Tasa de respuesta', hint: 'Respondieron / contactados', metrics: 'prospeccion.respondieron', of: 'prospeccion.contactados', format: 'pct' },
              { label: 'Interesados', metrics: 'prospeccion.interesados' },
              { label: 'Clientes', hint: 'Primer pago después de sumarse', metrics: 'prospeccion.clientes' },
            ],
            funnels: [{
              title: 'Embudo comercial',
              note: 'Conversión entre etapas',
              steps: [
                { key: 'prospectados', label: 'Prospectados', metrics: 'prospeccion.prospectados' },
                { key: 'contactados', label: 'Contactados', metrics: 'prospeccion.contactados' },
                { key: 'respondieron', label: 'Respondieron', metrics: 'prospeccion.respondieron' },
                { key: 'interesados', label: 'Interesados', metrics: 'prospeccion.interesados' },
                { key: 'activados', label: 'Activados', metrics: 'prospeccion.activados' },
                { key: 'clientes', label: 'Clientes', metrics: 'prospeccion.clientes' },
              ],
            }],
            daily: [{ title: 'Inmobiliarias contactadas por día', note: 'Primer envío confirmado', metrics: 'prospeccion.diario', key: 'nuevos' }],
            tables: [
              {
                title: 'Por SDR',
                metrics: 'prospeccion.porSdr',
                columns: [
                  { key: 'sdr', label: 'SDR' },
                  { key: 'prospectados', label: 'Prospectados', format: 'int' },
                  { key: 'contactados', label: 'Contactados', format: 'int' },
                  { key: 'respondieron', label: 'Respondieron', format: 'int' },
                  { key: 'interesados', label: 'Interesados', format: 'int' },
                  { key: 'clientes', label: 'Clientes', format: 'int' },
                ],
              },
              {
                title: 'Por canal',
                metrics: 'prospeccion.porCanal',
                columns: [
                  { key: 'canal', label: 'Canal' },
                  { key: 'contactados', label: 'Contactados', format: 'int' },
                  { key: 'mensajes', label: 'Mensajes', format: 'int' },
                  { key: 'respondieron', label: 'Respondieron', format: 'int' },
                  { key: 'clientes', label: 'Clientes', format: 'int' },
                ],
              },
            ],
          },
          {
            title: 'Demos comerciales',
            note: 'Cada demo cuenta el paso más alto al que llegó su inmobiliaria',
            kpis: [
              { label: 'Demos creadas', metrics: 'demos.creadas' },
              { label: 'Publicadas', hint: 'Con link para mandar', metrics: 'demos.publicadas' },
              { label: 'Abiertas', hint: '% de las publicadas', metrics: 'demos.ingresaron', of: 'demos.publicadas', format: 'pct' },
              { label: 'Visitantes de las demos', metrics: 'demos.visitantes' },
            ],
            funnels: [{
              title: 'Resultado de las demos',
              note: 'Demos que llegaron a cada paso',
              steps: [
                { key: 'publicadas', label: 'Publicadas', metrics: 'demos.publicadas' },
                { key: 'ingresaron', label: 'La abrieron', metrics: 'demos.ingresaron' },
                { key: 'interactuaron', label: 'Interactuaron', metrics: 'demos.interactuaron' },
                { key: 'generaron', label: 'Generaron una imagen', metrics: 'demos.generaron' },
                { key: 'panel', label: 'Crearon su panel', metrics: 'demos.panel' },
                { key: 'suscribieron', label: 'Se suscribieron', metrics: 'demos.suscribieron' },
              ],
            }],
            daily: [{ title: 'Visitas a las demos por día', note: 'Visitantes únicos de cada demo', metrics: 'demos.diario', key: 'visita' }],
          },
        ],
      },
      usability: {
        funnels: [
          {
            title: 'Recorrido en la web',
            note: 'Personas únicas en el período, como % de los visitantes. Sin el tráfico del equipo.',
            query: 'totales',
            baseLabel: 'de los visitantes',
            steps: [
              { key: 'visitantes', label: 'Visitaron la web' },
              { key: 'estudio', label: 'Entraron al estudio' },
              { key: 'foto', label: 'Subieron una foto' },
              { key: 'generaron', label: 'Generaron un diseño' },
              { key: 'precios', label: 'Vieron precios' },
              { key: 'eligieronPlan', label: 'Eligieron un plan' },
              { key: 'mercadoPago', label: 'Fueron a Mercado Pago' },
              { key: 'pagaron', label: 'Pagaron' },
            ],
          },
          {
            title: 'Interacción con las demos',
            note: 'Personas que abrieron una demo y lo que hicieron después.',
            query: 'totales',
            baseLabel: 'de los que la abrieron',
            steps: [
              { key: 'demoVieron', label: 'Abrieron una demo' },
              { key: 'demoInteractuaron', label: 'Interactuaron' },
              { key: 'demoCta', label: 'Tocaron «Crear mi inmobiliaria»' },
              { key: 'altaVista', label: 'Vieron el alta' },
              { key: 'inmobiliarias', label: 'Se sumaron' },
            ],
          },
        ],
        kpis: [
          { label: 'Visitantes únicos', query: 'totales', key: 'visitantes', format: 'int' },
          { label: 'Llegaron desde Meta', hint: '% de los visitantes', query: 'totales', key: 'visitantesMeta', of: 'visitantes', format: 'pct' },
          { label: 'Diseños generados', query: 'totales', key: 'disenos', format: 'int' },
          { label: 'Inmobiliarias que se sumaron', hint: 'Crearon, reclamaron o se unieron', query: 'totales', key: 'inmobiliarias', format: 'int' },
          { label: 'Clics de frustración', hint: 'Rage clicks', query: 'totales', key: 'rageclicks', format: 'int' },
        ],
        tables: [
          {
            title: 'Páginas más visitadas',
            note: 'En el período elegido.',
            query: 'paginas',
            columns: [
              { key: 'pagina', label: 'Página' },
              { key: 'visitantes', label: 'Personas', format: 'int' },
              { key: 'vistas', label: 'Vistas', format: 'int' },
            ],
          },
          {
            title: 'Por día',
            note: 'Personas únicas por día.',
            query: 'daily',
            columns: [
              { key: 'date', label: 'Día', format: 'day' },
              { key: 'visitantes', label: 'Visitantes', format: 'int' },
              { key: 'visitantesMeta', label: 'Desde Meta', format: 'int' },
              { key: 'foto', label: 'Subieron foto', format: 'int' },
              { key: 'generaron', label: 'Generaron', format: 'int' },
              { key: 'demoVieron', label: 'Abrieron una demo', format: 'int' },
            ],
          },
        ],
      },
    },

    // ─────────────────────────────────────────── TURNIA
    // Todo sale de /api/metricas de Turnia (su base) y del proyecto de PostHog
    // "Turnia Salud". Hasta conectarlos marca "Sin datos": no hay foto guardada.
    {
      id: 'turnia',
      name: 'Turnia',
      tagline: 'Agentes de IA que dan turnos para clínicas · prospección a odontólogos',
      stage: 'Tracción',
      currency: 'ARS',
      posthog: { org: 'Turnia Salud', projectId: 518346, snapshotAt: null, data: {} },
      metrics: { source: 'panel de Turnia', snapshotAt: null, data: null },
      northStar: {
        name: 'Turnos agendados por Turnia',
        definition: 'Turnos que tomó Turnia (WhatsApp, teléfono, web o campañas; no los cargados en el panel) en los últimos 7 días, en clínicas reales (sin las de las demos).',
        format: 'int',
        metrics: { value: 'uso.ultimos7', prev: 'uso.previos7', daily: 'uso.diario', dailyKey: 'turnos' },
      },
      revenue: {
        noData: true,
        currency: 'ARS',
        subsLabel: 'Nuevos clientes',
        unitLabel: 'cliente',
        note: 'Turnia todavía no registra cobros: marca 0. Los clientes ganados se ven en Distribución.',
        daily: [],
      },
      acquisition: {
        type: 'pipeline',
        subtitle: 'prospección → demo personal → reunión → cliente',
        emptyNote: 'Falta conectar /api/metricas de Turnia (ver README).',
        sections: [
          {
            title: 'Prospección a odontólogos',
            note: 'Cohorte del primer contacto, con las reglas de Panel → Prospección',
            kpis: [
              { label: 'Prospectados', metrics: 'prospeccion.prospectados' },
              { label: 'Contactados', metrics: 'prospeccion.contactados' },
              { label: 'Abrieron su demo', hint: '% de los contactados', metrics: 'prospeccion.abrieron_demo', of: 'prospeccion.contactados', format: 'pct' },
              { label: 'Tasa de respuesta', hint: 'Respondieron / contactados', metrics: 'prospeccion.respondieron', of: 'prospeccion.contactados', format: 'pct' },
              { label: 'Reuniones', hint: 'Incluye clientes', metrics: 'prospeccion.reuniones' },
              { label: 'Clientes', metrics: 'prospeccion.clientes' },
            ],
            funnels: [
              {
                title: 'Embudo comercial',
                note: 'Conversión entre etapas',
                steps: [
                  { key: 'prospectados', label: 'Prospectados', metrics: 'prospeccion.prospectados' },
                  { key: 'contactados', label: 'Contactados', metrics: 'prospeccion.contactados' },
                  { key: 'respondieron', label: 'Respondieron', metrics: 'prospeccion.respondieron' },
                  { key: 'reuniones', label: 'Reunión', metrics: 'prospeccion.reuniones' },
                  { key: 'clientes', label: 'Cliente', metrics: 'prospeccion.clientes' },
                ],
              },
              {
                title: 'La demo personal',
                note: 'El link /p/<código> que va en el mensaje',
                steps: [
                  { key: 'contactados', label: 'Contactados', metrics: 'prospeccion.contactados' },
                  { key: 'abrieron', label: 'Abrieron el link', metrics: 'prospeccion.abrieron_demo' },
                  { key: 'probaron', label: 'Probaron la demo', metrics: 'prospeccion.probaron_demo' },
                ],
              },
            ],
            daily: [
              { title: 'Mensajes por día', note: 'Presentaciones y seguimientos', metrics: 'prospeccion.diario', key: 'mensajes' },
              { title: 'Respuestas por día', metrics: 'prospeccion.diario', key: 'respuestas' },
            ],
            tables: [
              {
                title: 'Por canal',
                metrics: 'prospeccion.porCanal',
                columns: [
                  { key: 'canal', label: 'Canal' },
                  { key: 'contactados', label: 'Contactados', format: 'int' },
                  { key: 'respondieron', label: 'Respondieron', format: 'int' },
                  { key: 'probaron_demo', label: 'Probaron la demo', format: 'int' },
                  { key: 'clientes', label: 'Clientes', format: 'int' },
                ],
              },
              {
                title: 'Por zona',
                metrics: 'prospeccion.porZona',
                columns: [
                  { key: 'zona', label: 'Zona' },
                  { key: 'prospectados', label: 'Prospectados', format: 'int' },
                  { key: 'contactados', label: 'Contactados', format: 'int' },
                  { key: 'respondieron', label: 'Respondieron', format: 'int' },
                  { key: 'clientes', label: 'Clientes', format: 'int' },
                ],
              },
            ],
          },
          {
            title: 'Demos y pedidos de demo',
            note: 'Demos con Sofi (web, WhatsApp o llamada) y pedidos de «Pedí una demo»',
            kpis: [
              { label: 'Demos iniciadas', metrics: 'demos.iniciadas' },
              { label: 'Demos que funcionaron', hint: '% de las iniciadas', metrics: 'demos.listas', of: 'demos.iniciadas', format: 'pct' },
              { label: 'Pedidos de demo', metrics: 'pedidos.pedidos' },
              { label: 'Pedidos ganados', metrics: 'pedidos.ganados' },
            ],
            funnels: [
              {
                title: 'Resultado de las demos',
                steps: [
                  { key: 'iniciadas', label: 'Iniciadas', metrics: 'demos.iniciadas' },
                  { key: 'listas', label: 'Llegaron a hablar con Sofi', metrics: 'demos.listas' },
                  { key: 'terminadas', label: 'Terminadas', metrics: 'demos.terminadas' },
                ],
              },
              {
                title: 'Pedidos de demo',
                steps: [
                  { key: 'pedidos', label: 'Pedidos', metrics: 'pedidos.pedidos' },
                  { key: 'contactados', label: 'Contactados', metrics: 'pedidos.contactados' },
                  { key: 'demo_agendada', label: 'Demo agendada', metrics: 'pedidos.demo_agendada' },
                  { key: 'ganados', label: 'Ganados', metrics: 'pedidos.ganados' },
                ],
              },
            ],
            daily: [{ title: 'Demos por día', metrics: 'demos.diario', key: 'demos' }],
          },
        ],
      },
      usability: {
        kpis: [
          { label: 'Clínicas activas', hint: 'Con turnos en los últimos 30 días', metrics: 'uso.clinicas_activas', format: 'int' },
          { label: 'Turnos que tomó Turnia', hint: 'En el período', metrics: 'uso.turnos', format: 'int' },
          { label: 'Conversaciones con Sofi', hint: 'En el período', metrics: 'uso.conversaciones', format: 'int' },
          { label: 'Ausentismo', hint: 'Ausentes / turnos del período', metrics: 'uso.ausentes', of: 'uso.turnos', format: 'pct' },
        ],
        funnels: [{
          title: 'Recorrido en la web',
          note: 'PostHog «Turnia Salud», personas únicas como % de los visitantes. Sin el tráfico del equipo.',
          query: 'totales',
          baseLabel: 'de los visitantes',
          steps: [
            { key: 'visitantes', label: 'Visitaron la web' },
            { key: 'formulario', label: 'Vieron «Probar la demo»' },
            { key: 'empezaronDemo', label: 'Empezaron la demo' },
            { key: 'demoLista', label: 'La demo quedó lista' },
            { key: 'conversaron', label: 'Hablaron con Sofi' },
            { key: 'pedidos', label: 'Pidieron una demo guiada' },
          ],
        }],
        tables: [
          {
            title: 'Páginas más visitadas',
            note: 'En el período elegido. Los links de la prospección se agrupan en /p/….',
            query: 'paginas',
            columns: [
              { key: 'pagina', label: 'Página' },
              { key: 'visitantes', label: 'Personas', format: 'int' },
              { key: 'vistas', label: 'Vistas', format: 'int' },
            ],
          },
        ],
      },
    },
  ],
};
