/*
 * Datos del dashboard de Chapa Labs.
 *
 * Lo que tiene `sample: true` son números DE EJEMPLO: se muestran con la
 * etiqueta "Ejemplo" hasta que se conecten los datos reales (ver README.md).
 * Los bloques `ads` (Meta Ads) y `posthog` (PostHog) son datos reales: esta es
 * la foto guardada, y /api/meta y /api/posthog la actualizan en vivo.
 *
 * Cada proyecto tiene:
 *   - ads:         pauta real en Meta Ads (opcional), por día y campaña.
 *   - posthog:     resultados de las consultas de api/posthog.js (opcional).
 *   - northStar:   la métrica principal. Con `posthog` sale de esas consultas;
 *                  si no, de una serie mensual con meta.
 *   - acquisition: "funnel" (embudo real por canal + inversión de Meta),
 *                  "paid" (pauta por mes) u "outbound" (embudo comercial).
 *   - usability:   KPIs, embudo y tablas de uso. Con `query` salen de PostHog.
 *
 * Los meses van en formato "AAAA-MM" y en el mismo orden en todas las series.
 * Para sumar un proyecto, copiá uno de los bloques y cambiá el id.
 */
window.CHAPA_DATA = {
  updatedAt: '2026-10-25',
  sample: true,
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
            { date: '2026-10-23', visitantes: 36, visitantesMeta: 12, estudio: 3, foto: 5, generaron: 1, precios: 4, compras: 0, ingresos: 0 },
            { date: '2026-10-24', visitantes: 38, visitantesMeta: 26, estudio: 4, foto: 3, generaron: 3, precios: 5, compras: 0, ingresos: 0 },
            { date: '2026-10-25', visitantes: 29, visitantesMeta: 9, estudio: 16, foto: 10, generaron: 8, precios: 2, compras: 0, ingresos: 0 },
          ],
          totales: [{ visitantes: 92, visitantesMeta: 43, estudio: 22, foto: 17, generaron: 10, precios: 10, quisieronPagar: 7, rageclicks: 12 }],
          nsm: [{ ultimos7: 10, previos7: 0 }],
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
        name: 'Personas que generaron un diseño',
        definition: 'Personas que tocaron el botón que genera ("Crear diseños gratis" / "Generar mi diseño") en los últimos 7 días. Se mide con los clics automáticos hasta que la app mande un evento propio.',
        format: 'int',
        posthog: { query: 'nsm', value: 'ultimos7', prev: 'previos7', daily: 'daily', dailyKey: 'generaron' },
      },
      revenue: {
        query: 'daily',
        subsKey: 'compras',
        revenueKey: 'ingresos',
        currency: 'ARS',
        subsLabel: 'Nuevos suscriptores',
        unitLabel: 'suscriptor',
        note: 'Se completa cuando la app mande compra_confirmada a PostHog (PR #10 en axellaban/amoblaia). Hasta entonces marca 0.',
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
        type: 'outbound',
        sample: true,
        stages: [
          { key: 'prospectados', label: 'Prospectados' },
          { key: 'contactados', label: 'Contactados' },
          { key: 'interesados', label: 'Interesados' },
          { key: 'agendadas', label: 'Demo agendada' },
          { key: 'demos', label: 'Demo realizada' },
          { key: 'clientes', label: 'Cliente nuevo' },
        ],
        months: [
          { month: '2026-05', prospectados: 300, contactados: 260, interesados: 38, agendadas: 22, demos: 17, clientes: 3, mrrNuevo: 270 },
          { month: '2026-06', prospectados: 420, contactados: 360, interesados: 52, agendadas: 30, demos: 24, clientes: 5, mrrNuevo: 450 },
          { month: '2026-07', prospectados: 500, contactados: 440, interesados: 66, agendadas: 39, demos: 31, clientes: 7, mrrNuevo: 630 },
          { month: '2026-08', prospectados: 560, contactados: 500, interesados: 74, agendadas: 45, demos: 37, clientes: 8, mrrNuevo: 720 },
          { month: '2026-09', prospectados: 640, contactados: 580, interesados: 88, agendadas: 52, demos: 43, clientes: 10, mrrNuevo: 900 },
          { month: '2026-10', prospectados: 720, contactados: 650, interesados: 101, agendadas: 61, demos: 50, clientes: 12, mrrNuevo: 1080 },
        ],
        channels: [
          { canal: 'WhatsApp', prospectados: 300, contactados: 280, interesados: 48, agendadas: 30, demos: 25, clientes: 6 },
          { canal: 'Email', prospectados: 250, contactados: 230, interesados: 22, agendadas: 12, demos: 10, clientes: 2 },
          { canal: 'LinkedIn', prospectados: 150, contactados: 125, interesados: 21, agendadas: 13, demos: 10, clientes: 3 },
          { canal: 'Referidos', prospectados: 20, contactados: 15, interesados: 10, agendadas: 6, demos: 5, clientes: 1 },
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
    {
      id: 'turnia',
      name: 'Turnia',
      tagline: 'SaaS B2B de turnos · venta outbound',
      stage: 'Tracción',
      currency: 'USD',
      northStar: {
        sample: true,
        name: 'Turnos agendados vía Turnia',
        definition: 'Turnos confirmados en el mes en todos los negocios que usan Turnia.',
        format: 'int',
        target: 8000,
        series: [
          { month: '2026-05', value: 2100 },
          { month: '2026-06', value: 2800 },
          { month: '2026-07', value: 3600 },
          { month: '2026-08', value: 4700 },
          { month: '2026-09', value: 5900 },
          { month: '2026-10', value: 7400 },
        ],
      },
      revenue: {
        sample: true,
        currency: 'USD',
        subsLabel: 'Nuevos clientes',
        unitLabel: 'cliente',
        note: 'Ejemplo: clientes nuevos y MRR nuevo de octubre repartidos por día.',
        daily: [
          { date: '2026-10-01', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-02', suscriptores: 2, ingresos: 60 },
          { date: '2026-10-03', suscriptores: 2, ingresos: 60 },
          { date: '2026-10-04', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-05', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-06', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-07', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-08', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-09', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-10', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-11', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-12', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-13', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-14', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-15', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-16', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-17', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-18', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-19', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-20', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-21', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-22', suscriptores: 1, ingresos: 30 },
          { date: '2026-10-23', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-24', suscriptores: 0, ingresos: 0 },
          { date: '2026-10-25', suscriptores: 0, ingresos: 0 },
        ],
      },
      acquisition: {
        type: 'outbound',
        sample: true,
        stages: [
          { key: 'prospectados', label: 'Prospectados' },
          { key: 'contactados', label: 'Contactados' },
          { key: 'interesados', label: 'Interesados' },
          { key: 'agendadas', label: 'Demo agendada' },
          { key: 'demos', label: 'Demo realizada' },
          { key: 'clientes', label: 'Cliente nuevo' },
        ],
        months: [
          { month: '2026-05', prospectados: 400, contactados: 350, interesados: 45, agendadas: 28, demos: 21, clientes: 5, mrrNuevo: 150 },
          { month: '2026-06', prospectados: 480, contactados: 430, interesados: 60, agendadas: 36, demos: 28, clientes: 7, mrrNuevo: 210 },
          { month: '2026-07', prospectados: 560, contactados: 500, interesados: 72, agendadas: 44, demos: 35, clientes: 9, mrrNuevo: 270 },
          { month: '2026-08', prospectados: 650, contactados: 590, interesados: 85, agendadas: 52, demos: 42, clientes: 11, mrrNuevo: 330 },
          { month: '2026-09', prospectados: 700, contactados: 640, interesados: 94, agendadas: 58, demos: 47, clientes: 12, mrrNuevo: 360 },
          { month: '2026-10', prospectados: 800, contactados: 720, interesados: 110, agendadas: 68, demos: 55, clientes: 15, mrrNuevo: 450 },
        ],
        channels: [
          { canal: 'WhatsApp', prospectados: 380, contactados: 350, interesados: 58, agendadas: 36, demos: 30, clientes: 9 },
          { canal: 'Llamada', prospectados: 200, contactados: 180, interesados: 26, agendadas: 16, demos: 13, clientes: 3 },
          { canal: 'Email', prospectados: 180, contactados: 160, interesados: 14, agendadas: 9, demos: 7, clientes: 2 },
          { canal: 'Instagram', prospectados: 40, contactados: 30, interesados: 12, agendadas: 7, demos: 5, clientes: 1 },
        ],
      },
      usability: {
        sample: true,
        kpis: [
          { label: 'Negocios activos', format: 'int', value: 64, prev: 52, good: 'up' },
          { label: 'Turnos por negocio', format: 'dec', value: 116, prev: 113, good: 'up' },
          { label: 'Turnos autogestionados', hint: 'Los saca el cliente final, sin llamar', format: 'pct', value: 0.68, prev: 0.61, good: 'up' },
          { label: 'Ausentismo', format: 'pct', value: 0.071, prev: 0.094, good: 'down' },
        ],
        tables: [
          {
            title: 'Uso por rubro',
            note: 'Último mes.',
            columns: [
              { key: 'rubro', label: 'Rubro' },
              { key: 'negocios', label: 'Negocios', format: 'int' },
              { key: 'turnos', label: 'Turnos', format: 'int' },
              { key: 'auto', label: 'Autogestionados', format: 'pct' },
              { key: 'ausentismo', label: 'Ausentismo', format: 'pct' },
            ],
            rows: [
              { rubro: 'Salud', negocios: 22, turnos: 2900, auto: 0.62, ausentismo: 0.08 },
              { rubro: 'Estética', negocios: 18, turnos: 2150, auto: 0.71, ausentismo: 0.06 },
              { rubro: 'Barbería', negocios: 14, turnos: 1700, auto: 0.79, ausentismo: 0.05 },
              { rubro: 'Otros', negocios: 10, turnos: 650, auto: 0.55, ausentismo: 0.11 },
            ],
          },
          {
            title: 'Uso por funcionalidad',
            note: 'Último mes. % sobre negocios activos.',
            columns: [
              { key: 'funcion', label: 'Funcionalidad' },
              { key: 'alcance', label: '% negocios', format: 'pct' },
              { key: 'var', label: 'Var. vs mes anterior', format: 'delta' },
            ],
            rows: [
              { funcion: 'Reserva online (link / web)', alcance: 0.92, var: 0.04 },
              { funcion: 'Recordatorios por WhatsApp', alcance: 0.81, var: 0.11 },
              { funcion: 'Agenda con varios profesionales', alcance: 0.44, var: 0.07 },
              { funcion: 'Cobro de seña', alcance: 0.19, var: 0.05 },
            ],
          },
        ],
      },
    },
  ],
};
