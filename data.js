/*
 * Datos del dashboard de Chapa Labs.
 *
 * ⚠️ Todos los números de esta versión son DE EJEMPLO. Reemplazalos por los
 * reales (a mano, o más adelante desde una planilla / API; ver README.md).
 *
 * Cada proyecto tiene:
 *   - northStar:   la métrica principal, con su serie mensual y la meta.
 *   - acquisition: tipo "paid" (pauta: inversión → registros → pagos → ROI)
 *                  o tipo "outbound" (embudo comercial por etapas).
 *   - usability:   KPIs y tablas de uso del producto (columnas libres).
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
      tagline: 'App B2C · crecimiento con pauta paga',
      stage: 'Tracción',
      currency: 'USD',
      northStar: {
        name: 'Usuarios activos semanales',
        definition: 'Personas que completan al menos una rutina con su coach en la semana (promedio del mes).',
        format: 'int',
        target: 1300,
        series: [
          { month: '2026-05', value: 620 },
          { month: '2026-06', value: 710 },
          { month: '2026-07', value: 830 },
          { month: '2026-08', value: 960 },
          { month: '2026-09', value: 1080 },
          { month: '2026-10', value: 1240 },
        ],
      },
      acquisition: {
        type: 'paid',
        // inversion e ingresos en la moneda del proyecto; pagos = nuevos suscriptores pagos.
        months: [
          { month: '2026-05', inversion: 800, registros: 410, pagos: 32, ingresos: 1100 },
          { month: '2026-06', inversion: 950, registros: 520, pagos: 41, ingresos: 1450 },
          { month: '2026-07', inversion: 1100, registros: 600, pagos: 50, ingresos: 1800 },
          { month: '2026-08', inversion: 1300, registros: 760, pagos: 66, ingresos: 2400 },
          { month: '2026-09', inversion: 1500, registros: 840, pagos: 74, ingresos: 2750 },
          { month: '2026-10', inversion: 1700, registros: 990, pagos: 92, ingresos: 3450 },
        ],
        // Desglose por canal del último mes cargado.
        channels: [
          { canal: 'Meta Ads', inversion: 1000, registros: 610, pagos: 55, ingresos: 2050 },
          { canal: 'Google Ads', inversion: 500, registros: 250, pagos: 26, ingresos: 990 },
          { canal: 'TikTok Ads', inversion: 200, registros: 130, pagos: 11, ingresos: 410 },
        ],
      },
      usability: {
        kpis: [
          { label: 'Usuarios activos mensuales', format: 'int', value: 2950, prev: 2480, good: 'up' },
          { label: 'Stickiness (DAU / MAU)', format: 'pct', value: 0.31, prev: 0.28, good: 'up' },
          { label: 'Activación', hint: 'Registro → primera rutina en 7 días', format: 'pct', value: 0.46, prev: 0.42, good: 'up' },
          { label: 'Churn mensual de pagos', format: 'pct', value: 0.072, prev: 0.081, good: 'down' },
        ],
        tables: [
          {
            title: 'Uso por funcionalidad',
            note: 'Último mes. % sobre usuarios activos mensuales.',
            columns: [
              { key: 'funcion', label: 'Funcionalidad' },
              { key: 'alcance', label: '% usuarios', format: 'pct' },
              { key: 'frecuencia', label: 'Usos / usuario / semana', format: 'dec' },
              { key: 'var', label: 'Var. vs mes anterior', format: 'delta' },
            ],
            rows: [
              { funcion: 'Rutina guiada', alcance: 0.82, frecuencia: 3.4, var: 0.06 },
              { funcion: 'Chat con coach IA', alcance: 0.57, frecuencia: 4.1, var: 0.12 },
              { funcion: 'Registro de comidas', alcance: 0.38, frecuencia: 5.2, var: -0.03 },
              { funcion: 'Seguimiento de progreso', alcance: 0.34, frecuencia: 1.6, var: 0.02 },
              { funcion: 'Retos semanales', alcance: 0.21, frecuencia: 1.1, var: 0.09 },
            ],
          },
          {
            title: 'Retención por cohorte',
            note: '% de cada cohorte de registro que sigue activa N meses después.',
            heat: true,
            columns: [
              { key: 'cohorte', label: 'Cohorte', format: 'month' },
              { key: 'usuarios', label: 'Registros', format: 'int' },
              { key: 'm1', label: 'Mes 1', format: 'pct', heat: true },
              { key: 'm2', label: 'Mes 2', format: 'pct', heat: true },
              { key: 'm3', label: 'Mes 3', format: 'pct', heat: true },
              { key: 'm4', label: 'Mes 4', format: 'pct', heat: true },
              { key: 'm5', label: 'Mes 5', format: 'pct', heat: true },
            ],
            rows: [
              { cohorte: '2026-05', usuarios: 410, m1: 0.44, m2: 0.33, m3: 0.28, m4: 0.25, m5: 0.23 },
              { cohorte: '2026-06', usuarios: 520, m1: 0.47, m2: 0.36, m3: 0.30, m4: 0.27 },
              { cohorte: '2026-07', usuarios: 600, m1: 0.49, m2: 0.38, m3: 0.32 },
              { cohorte: '2026-08', usuarios: 760, m1: 0.52, m2: 0.40 },
              { cohorte: '2026-09', usuarios: 840, m1: 0.54 },
            ],
          },
        ],
      },
    },

    // ─────────────────────────────────────────── AMOBLA IA
    {
      id: 'amobla-ia',
      name: 'Amobla IA',
      tagline: 'SaaS B2B · venta outbound',
      stage: 'Validación',
      currency: 'USD',
      northStar: {
        name: 'Ambientes generados con IA',
        definition: 'Ambientes amoblados con IA por las cuentas clientes en el mes.',
        format: 'int',
        target: 5000,
        series: [
          { month: '2026-05', value: 1200 },
          { month: '2026-06', value: 1650 },
          { month: '2026-07', value: 2300 },
          { month: '2026-08', value: 2900 },
          { month: '2026-09', value: 3700 },
          { month: '2026-10', value: 4600 },
        ],
      },
      acquisition: {
        type: 'outbound',
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
        kpis: [
          { label: 'Cuentas activas', format: 'int', value: 41, prev: 31, good: 'up' },
          { label: 'Ambientes por cuenta', format: 'dec', value: 112, prev: 119, good: 'up' },
          { label: 'Tiempo a primer ambiente', hint: 'Desde el alta de la cuenta', format: 'hours', value: 5.5, prev: 9, good: 'down' },
          { label: 'Ambientes descargados o compartidos', format: 'pct', value: 0.63, prev: 0.58, good: 'up' },
        ],
        tables: [
          {
            title: 'Uso por funcionalidad',
            note: 'Último mes. % sobre cuentas activas.',
            columns: [
              { key: 'funcion', label: 'Funcionalidad' },
              { key: 'alcance', label: '% cuentas', format: 'pct' },
              { key: 'volumen', label: 'Usos en el mes', format: 'int' },
              { key: 'var', label: 'Var. vs mes anterior', format: 'delta' },
            ],
            rows: [
              { funcion: 'Amoblar foto de ambiente', alcance: 0.95, volumen: 3150, var: 0.21 },
              { funcion: 'Cambiar estilo', alcance: 0.71, volumen: 980, var: 0.34 },
              { funcion: 'Catálogo propio de muebles', alcance: 0.39, volumen: 310, var: 0.18 },
              { funcion: 'Compartir con cliente final', alcance: 0.56, volumen: 1420, var: 0.27 },
            ],
          },
          {
            title: 'Salud de cuentas',
            note: 'Cuentas con más uso del mes.',
            columns: [
              { key: 'cuenta', label: 'Cuenta' },
              { key: 'plan', label: 'Plan' },
              { key: 'ambientes', label: 'Ambientes', format: 'int' },
              { key: 'usuarios', label: 'Usuarios', format: 'int' },
              { key: 'ultimo', label: 'Último uso' },
              { key: 'salud', label: 'Salud', format: 'status' },
            ],
            rows: [
              { cuenta: 'Cuenta A', plan: 'Pro', ambientes: 640, usuarios: 6, ultimo: 'Hoy', salud: 'good' },
              { cuenta: 'Cuenta B', plan: 'Pro', ambientes: 410, usuarios: 4, ultimo: 'Hoy', salud: 'good' },
              { cuenta: 'Cuenta C', plan: 'Starter', ambientes: 220, usuarios: 2, ultimo: 'Ayer', salud: 'good' },
              { cuenta: 'Cuenta D', plan: 'Starter', ambientes: 95, usuarios: 1, ultimo: 'Hace 6 días', salud: 'warning' },
              { cuenta: 'Cuenta E', plan: 'Pro', ambientes: 30, usuarios: 3, ultimo: 'Hace 15 días', salud: 'critical' },
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
      acquisition: {
        type: 'outbound',
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
