/*
 * Datos del dashboard de Chapa Labs.
 *
 * Lo que tiene `noData: true` todavía no tiene fuente conectada: se muestra en 0
 * con la etiqueta "Sin datos". Nunca se cargan números inventados.
 * Los bloques `ads` (Meta Ads) y `posthog` (PostHog) son datos reales: esta es
 * la foto guardada, y /api/meta y /api/posthog la actualizan en vivo.
 *
 * Cada proyecto tiene:
 *   - ads:         pauta real en Meta Ads (opcional), por día y campaña.
 *   - posthog:     resultados de las consultas de api/posthog.js (opcional).
 *   - northStar:   la métrica principal. Con `posthog` sale de esas consultas;
 *                  si no, de una serie mensual con meta.
 *   - acquisition: "funnel" (embudo real por canal + inversión de Meta),
 *                  "paid" (pauta por mes), "outbound" (embudo comercial por mes)
 *                  o "prospects" (planilla de prospección + ventas proyectadas).
 *                  Se muestra en la sección Distribución.
 *   - usability:   KPIs, embudo y tablas de uso (sección Producto). Con `query`
 *                  salen de PostHog.
 *
 * Los meses van en formato "AAAA-MM" y en el mismo orden en todas las series.
 * Para sumar un proyecto, copiá uno de los bloques y cambiá el id.
 */
window.CHAPA_DATA = {
  updatedAt: '2026-10-25',
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
        tables: [
          {
            title: 'Secciones más usadas',
            note: 'Últimos 30 días. Personas únicas que entraron a cada sección.',
            query: 'secciones',
            columns: [
              { key: 'seccion', label: 'Sección' },
              { key: 'usuarios', label: 'Personas', format: 'int' },
              { key: 'vistas', label: 'Vistas', format: 'int' },
            ],
          },
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

    // ─────────────────────────────────────────── AMOBLA IA
    {
      id: 'amobla-ia',
      name: 'Amobla IA',
      tagline: 'Virtual staging con IA para inmobiliarias · Meta Ads + outbound',
      stage: 'Lanzamiento',
      currency: 'USD',
      // Analítica real de PostHog (organización "AmoblaIA"). Todavía sin eventos
      // propios: se usan páginas vistas y clics automáticos sobre los botones.
      posthog: {
        org: 'AmoblaIA',
        projectId: 683617,
        snapshotAt: '2026-10-25',
        data: {
          daily: [
            { date: '2026-10-23', visitantes: 36, visitantesMeta: 12, estudio: 3, foto: 5, generaron: 1, descargados: 0, precios: 4, compras: 0, ingresos: 0 },
            { date: '2026-10-24', visitantes: 38, visitantesMeta: 26, estudio: 4, foto: 3, generaron: 3, descargados: 0, precios: 5, compras: 0, ingresos: 0 },
            { date: '2026-10-25', visitantes: 29, visitantesMeta: 9, estudio: 16, foto: 10, generaron: 8, descargados: 0, precios: 2, compras: 0, ingresos: 0 },
          ],
          totales: [{ visitantes: 92, visitantesMeta: 43, estudio: 22, foto: 17, generaron: 10, precios: 10, quisieronPagar: 7, rageclicks: 12 }],
          // Diseños descargados: la app todavía no manda diseno_descargado
          // (PR #12 en axellaban/amoblaia), así que la foto marca 0.
          nsm: [{ ultimos7: 0, previos7: 0 }],
          paginas: [
            { pagina: '/', visitantes: 61, vistas: 116 },
            { pagina: '/estudio', visitantes: 21, vistas: 34 },
            { pagina: '/precios', visitantes: 10, vistas: 19 },
            { pagina: '/galeria', visitantes: 7, vistas: 9 },
            { pagina: '/como-hacer-virtual-staging', visitantes: 5, vistas: 5 },
            { pagina: '/marca-blanca', visitantes: 5, vistas: 5 },
            { pagina: '/acceso', visitantes: 3, vistas: 13 },
            { pagina: '/proyectos', visitantes: 2, vistas: 16 },
          ],
        },
      },
      northStar: {
        name: 'Diseños descargados',
        definition: 'Diseños que se descargaron o compartieron en los últimos 7 días (evento diseno_descargado; una descarga de un lote cuenta cada foto). Marca 0 hasta que la app mande el evento.',
        format: 'int',
        posthog: { query: 'nsm', value: 'ultimos7', prev: 'previos7', daily: 'daily', dailyKey: 'descargados' },
      },
      revenue: {
        query: 'daily',
        subsKey: 'compras',
        revenueKey: 'ingresos',
        currency: 'ARS',
        subsLabel: 'Nuevos suscriptores',
        unitLabel: 'suscriptor',
        note: 'Pagos confirmados por Mercado Pago (evento compra_confirmada, desde el 26/10). Ingresos = monto cobrado.',
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
      // Outbound real: la planilla de prospección "Prospecting amobla IA" (Google
      // Sheets). /api/prospectos la lee en vivo; esta es la foto del 25/10.
      // Cada fila: [prioridad, inmobiliaria, SDR, estado, fecha de envío, canal, score].
      acquisition: {
        type: 'prospects',
        source: 'Planilla de prospección',
        snapshotAt: '2026-10-25',
        // Etapa según la columna Estado (y la fecha de envío) de cada fila.
        stages: [
          { key: 'prospectados', label: 'Prospectados', hint: 'Filas de la planilla' },
          { key: 'contactados', label: 'Contactados', hint: 'Con mensaje enviado' },
          { key: 'interesados', label: 'Interesados', hint: 'Estado "Interesado" o "Demo"' },
          { key: 'suscriptores', label: 'Suscriptores', hint: 'Estado "Suscriptor" o "Cliente"' },
        ],
        // Valores iniciales de "Ventas proyectadas" (cada uno se cambia en el tablero).
        projection: {
          currency: 'ARS',
          ticket: 38900, // plan Básico mensual de Amobla IA, precio de lista
          ticketNote: 'Plan Básico mensual, precio de lista',
          // La conversión real Prospectados → Contactados mide el avance (a cuántos
          // ya se les escribió), así que arranca en estimada: la parte de la base
          // que se puede contactar (hay números fijos, viejos o equivocados).
          rates: [
            { mode: 'estimate', estimate: 0.85 }, // Prospectados → Contactados
            { mode: 'estimate', estimate: 0.1 }, // Contactados → Interesados
            { mode: 'estimate', estimate: 0.25 }, // Interesados → Suscriptores
          ],
        },
        rows: [
          [1, 'Mauro Musso Negocios Inmobiliarios', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 96],
          [2, 'Carla Guzman Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 94],
          [3, 'Guillermina Moroni', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 93],
          [4, 'Bartolini Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 92],
          [5, 'Tormes Propiedades', 'Facu', 'Pendiente', '', '', 92],
          [6, 'Michalopulos Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 92],
          [7, 'Salvatto Inmobiliaria', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 92],
          [8, 'Pezzati Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 92],
          [9, 'Russillo Asesores Inmobiliarios', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 90],
          [10, 'De Gennaro Giacone Brokers Inmobiliarios', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 90],
          [11, 'Aiello Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 89],
          [12, 'Insabella Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 88],
          [13, 'Introcaso Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 88],
          [14, 'Tomasini Bienes Raices', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 88],
          [15, 'Arriola Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 88],
          [16, 'Canicoba Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 88],
          [17, 'Melina Acampora Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 87],
          [18, 'Valencia Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 86],
          [19, 'Goncebate Loscalzo Negocios Inmobiliarios', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 86],
          [20, 'Agliano Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 86],
          [21, 'Bessone Inmobiliaria', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 85],
          [22, 'Etchegorry Bienes Raices', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 85],
          [23, 'Pagnone Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 84],
          [24, 'Bombina Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 84],
          [25, 'Leonardo Lencina Estudio Inmobiliario', 'Facu', 'Pendiente', '', '', 93],
          [26, 'Sol Conde Negocios Inmobiliarios', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 81],
          [27, 'Girard Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 79],
          [28, 'Indra Persic Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 77],
          [29, 'Kuhn Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 77],
          [30, 'Zelaschi Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 76],
          [31, 'Visciarelli Abad Propiedades', 'Facu', 'Enviado', '2026-10-23', 'WhatsApp', 75],
          [32, 'Pestrin Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 73],
          [33, 'Candoli Propiedades', 'Facu', 'Enviado', '2026-10-23', 'Email', 72],
          [34, 'Allende Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 71],
          [35, 'Gisela D´Alessandro', 'Facu', 'Enviado', '2026-10-23', 'Email', 71],
          [36, 'Walter Burga Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 70],
          [37, 'Erne Propiedades', 'Facu', 'Número incorrecto', '2026-10-24', 'WhatsApp', 68],
          [38, 'Gago Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 68],
          [39, 'Barrera Inmobiliaria', 'Facu', 'Enviado', '2026-10-23', 'Email', 62],
          [40, 'Crespo Inmobiliaria', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 62],
          [41, 'Baires One', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 61],
          [42, 'Bruma Propiedades', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 59],
          [43, 'REMAX Arena', 'Facu', 'Enviado', '2026-10-23', 'Email', 57],
          [44, 'REMAX Feliz', 'Laban', 'Enviado', '2026-10-23', 'WhatsApp', 47],
          [45, 'Espatolero - Lorenzo Desarrollos Inmobiliaria', 'Facu', 'Pendiente', '', '', 46],
          [46, 'Liliana Armanelli Servicios Inmobiliarios', 'Laban', 'Pendiente', '', '', 67],
          [47, 'Diana Meiojas Propiedades', 'Facu', 'Pendiente', '', '', 63],
          [48, 'Sebastian Castro Propiedades', 'Laban', 'Pendiente', '', '', 61],
          [49, 'Candela Tapia Inmobiliaria Boutique', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 61],
          [50, 'Leticia Peraza Negocios Inmobiliarios', 'Laban', 'Pendiente', '', '', 61],
          [51, 'Carlos Piglia Inmuebles', 'Facu', 'Pendiente', '', '', 60],
          [52, 'Mariano Blanco Propiedades', 'Laban', 'Pendiente', '', '', 59],
          [53, 'Karina Colaneri Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 59],
          [54, 'Costa Galli Propiedades', 'Laban', 'Pendiente', '', '', 59],
          [55, 'Cirilo Leontiev', 'Facu', 'Pendiente', '', '', 59],
          [56, 'Sandra Gotte Inmobiliaria', 'Laban', 'Pendiente', '', '', 58],
          [57, 'Gausachs Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 57],
          [58, 'Oliva Negocios Inmobiliarios', 'Laban', 'Pendiente', '', '', 57],
          [59, 'Magarzo Estudio Inmobiliario', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 55],
          [60, 'Mendiondo Propiedades', 'Laban', 'Pendiente', '', '', 55],
          [61, 'Fernando Gomez Propiedades', 'Facu', 'Enviado', '2026-10-23', 'Email', 73],
          [62, 'Saforcada Propiedades', 'Laban', 'Pendiente', '', '', 53],
          [63, 'Franco Propiedades MDP', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 53],
          [64, 'Acampora y Asoc Propiedades', 'Laban', 'Pendiente', '', '', 53],
          [65, 'ALAN Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 51],
          [66, 'Suarez y Asociados Inmobiliaria', 'Laban', 'Pendiente', '', '', 50],
          [67, 'Madeira Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 49],
          [68, 'Mc Cosentino', 'Laban', 'Pendiente', '', '', 49],
          [69, 'Garcia Costanzo Asesoria', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 49],
          [70, 'Elvira Tenaglia', 'Laban', 'Pendiente', '', '', 47],
          [71, 'Gabriel Paulino', 'Facu', 'Enviado', '2026-10-23', 'Email', 81],
          [72, 'Emmanuel Jara Propiedades', 'Laban', 'Pendiente', '', '', 81],
          [73, 'Carolina Rendo', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 46],
          [74, 'Pluchino Propiedades', 'Laban', 'Pendiente', '', '', 44],
          [75, 'GM Servicios Inmobiliarios', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 40],
          [76, 'Liberatore Propiedades', 'Laban', 'Pendiente', '', '', 75],
          [77, 'Club House Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 39],
          [78, 'Obras de Mar', 'Laban', 'Pendiente', '', '', 37],
          [79, 'Beber Inmobiliaria', 'Facu', 'Pendiente', '', '', 37],
          [80, 'Doris Elizabeth Angel', 'Laban', 'Pendiente', '', '', 36],
          [81, 'Eugenia Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 35],
          [82, 'San Sebastián Inmobiliaria', 'Laban', 'Pendiente', '', '', 35],
          [83, 'Inmobiliaria Oscar Cura', 'Facu', 'Pendiente', '', '', 35],
          [84, 'Aldo Germán Patiño Iriarte', 'Laban', 'Pendiente', '', '', 35],
          [85, 'Jorge J. Bianchi', 'Facu', 'Pendiente', '', '', 35],
          [86, 'Oreste Gonnet', 'Laban', 'Pendiente', '', '', 70],
          [87, 'Marcelo Muiño Negocios Inmobiliarios', 'Facu', 'Pendiente', '', '', 35],
          [88, 'Sarasua Echevarria', 'Laban', 'Pendiente', '', '', 32],
          [89, 'Turdó Estudio Inmobiliario', 'Facu', 'Pendiente', '', '', 31],
          [90, 'Mitre 1120 Inmobiliaria', 'Laban', 'Pendiente', '', '', 48],
          [91, 'Inmobiliaria Bedoya', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 29],
          [92, 'Zabib Propiedades', 'Laban', 'Pendiente', '', '', 28],
          [93, 'REMAX Acqua', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 27],
          [94, 'C21 Niglia', 'Laban', 'Pendiente', '', '', 62],
          [95, 'Nepi Propiedades', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 27],
          [96, 'Insaurralde Brokers', 'Laban', 'Pendiente', '', '', 27],
          [97, 'Reynolds Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [98, 'Ricordi Negocios Inmobiliarios', 'Laban', 'Pendiente', '', '', 27],
          [99, 'Lepore', 'Facu', 'Pendiente', '', '', 27],
          [100, 'Castelao Propiedades', 'Laban', 'Pendiente', '', '', 27],
          [101, 'Bazán Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [102, 'Quiroga Propiedades', 'Laban', 'Pendiente', '', '', 27],
          [103, 'Cepeñas Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [104, 'Cechetti Inmobiliaria', 'Laban', 'Pendiente', '', '', 27],
          [105, 'Schafer y Asoc Negocios Inmobiliarios', 'Facu', 'Pendiente', '', '', 27],
          [106, 'O.Camino Propiedades', 'Laban', 'Pendiente', '', '', 27],
          [107, 'Rodríguez Llames Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [108, 'Andreatta Propiedades', 'Laban', 'Pendiente', '', '', 27],
          [109, 'Sanz y Ordoqui Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [110, 'Baigorra Propiedades', 'Laban', 'Pendiente', '', '', 27],
          [111, 'Giromini Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [112, 'Velati Propiedades', 'Laban', 'Pendiente', '', '', 27],
          [113, 'Armando Propiedades', 'Facu', 'Pendiente', '', '', 27],
          [114, 'REMAX Surf', 'Laban', 'Pendiente', '', '', 26],
          [115, 'REMAX Beach', 'Facu', 'Enviado', '2026-10-24', 'WhatsApp', 25],
          [116, 'C21 Cavalca', 'Laban', 'Pendiente', '', '', 59],
          [117, 'Sauce Propiedades', 'Facu', 'Pendiente', '', '', 21],
          [118, 'Fera', 'Laban', 'Pendiente', '', '', 17],
          [119, 'ESV Propiedades', 'Facu', 'Pendiente', '', '', 17],
          [120, 'GET Propiedades', 'Laban', 'Pendiente', '', '', 17],
          [121, 'Activa Propiedades', 'Facu', 'Pendiente', '', '', 17],
        ],
      },
      usability: {
        funnel: {
          title: 'Recorrido en la web',
          note: 'Personas únicas desde el lanzamiento, como % de los visitantes. Son clics en botones: PostHog todavía no recibe el evento de foto subida.',
          query: 'totales',
          baseLabel: 'de los visitantes',
          steps: [
            { key: 'visitantes', label: 'Visitaron la web' },
            { key: 'estudio', label: 'Entraron al estudio' },
            { key: 'foto', label: 'Tocaron "Subir foto"' },
            { key: 'generaron', label: 'Tocaron "Crear diseños"' },
            { key: 'precios', label: 'Vieron precios' },
            { key: 'quisieronPagar', label: 'Tocaron "plan pago"' },
          ],
        },
        kpis: [
          { label: 'Visitantes únicos', query: 'totales', key: 'visitantes', format: 'int' },
          { label: 'Llegaron desde Meta', hint: '% de los visitantes', query: 'totales', key: 'visitantesMeta', of: 'visitantes', format: 'pct' },
          { label: 'Entraron al estudio', hint: '% de los visitantes', query: 'totales', key: 'estudio', of: 'visitantes', format: 'pct' },
          { label: 'Clics de frustración', hint: 'Rage clicks', query: 'totales', key: 'rageclicks', format: 'int' },
        ],
        tables: [
          {
            title: 'Páginas más visitadas',
            note: 'Últimos 30 días.',
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
              { key: 'estudio', label: 'Estudio', format: 'int' },
              { key: 'foto', label: 'Tocaron subir foto', format: 'int' },
              { key: 'generaron', label: 'Tocaron crear', format: 'int' },
            ],
          },
        ],
      },
    },

    // ─────────────────────────────────────────── TURNIA
    // Sin fuente conectada (sus datos viven en su propia base): todo en 0.
    {
      id: 'turnia',
      name: 'Turnia',
      tagline: 'SaaS B2B de turnos · venta outbound',
      stage: 'Tracción',
      currency: 'USD',
      northStar: {
        noData: true,
        name: 'Turnos agendados vía Turnia',
        definition: 'Turnos confirmados en los últimos 7 días en todos los negocios que usan Turnia. Marca 0 hasta conectar la base de Turnia.',
        format: 'int',
      },
      revenue: {
        noData: true,
        currency: 'USD',
        subsLabel: 'Nuevos clientes',
        unitLabel: 'cliente',
        note: 'Marca 0 hasta conectar la base de Turnia.',
        daily: [],
      },
      acquisition: {
        type: 'outbound',
        noData: true,
        stages: [
          { key: 'prospectados', label: 'Prospectados' },
          { key: 'contactados', label: 'Contactados' },
          { key: 'interesados', label: 'Interesados' },
          { key: 'agendadas', label: 'Demo agendada' },
          { key: 'demos', label: 'Demo realizada' },
          { key: 'clientes', label: 'Cliente nuevo' },
        ],
        months: [],
        channels: [],
      },
      usability: {
        noData: true,
        kpis: [
          { label: 'Negocios activos', format: 'int', value: 0 },
          { label: 'Turnos por negocio', format: 'dec', value: 0 },
          { label: 'Turnos autogestionados', hint: 'Los saca el cliente final, sin llamar', format: 'pct', value: 0 },
          { label: 'Ausentismo', format: 'pct', value: 0 },
        ],
        tables: [],
      },
    },
  ],
};
