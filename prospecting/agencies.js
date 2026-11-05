// La lista con el embudo de demos que armó Facu en habita. (/admin/inmobiliarias en amoblaia), para la
// vista de cada unidad: «Inmobiliarias» en habita. y «Odontólogos» en Turnia. Las reglas son las de su
// código (src/lib/agency/commercial.ts y src/lib/agency/demo-funnel.ts) y no se cambian acá; lo que cambia
// por unidad son las etapas y los pasos del embudo (HABITA y TURNIA, abajo). En habita. las filas llegan
// calculadas por su API; en Turnia se arman con sus cuentas (fromAccounts), con los datos de su panel.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProspectingAgencies = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Etapa comercial (commercial.ts) ─────────────────────────
  const COMMERCIAL_STAGES = ['prospect', 'contacted', 'demo_sent', 'interacted', 'panel', 'client'];
  const STAGE_STEP = { prospect: 'Prospecto', contacted: 'Contactada', demo_sent: 'Demo enviada', interacted: 'Interactuó', panel: 'Con panel', client: 'Cliente' };
  const STAGE_TAB = { prospect: 'Prospectos', contacted: 'Contactadas', demo_sent: 'Demo enviada', interacted: 'Interactuaron', panel: 'Con panel', client: 'Clientes' };
  const STAGE_PARAM = { prospect: 'prospectos', contacted: 'contactadas', demo_sent: 'demo-enviada', interacted: 'interactuaron', panel: 'con-panel', client: 'clientes' };
  const stageFromParam = (v, cfg = HABITA) => cfg.stages.find((k) => cfg.stageParam[k] === v) || null;
  const HOT_SCORE = 60;

  const ACCOUNT_LABEL = { active: 'Activa', registered: 'Registrada', none: 'Sin cuenta' };
  const ACCOUNT_PARAM = { none: 'sin-cuenta', registered: 'registrada', active: 'activa' };
  const accountState = (a) => (a.subscribed ? 'active' : a.hasOwner ? 'registered' : 'none');

  /** «Hace 2 horas», «Ayer», «Hace 5 días». */
  function agoText(iso, now = Date.now()) {
    const ms = Math.max(0, now - new Date(iso).getTime());
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Ayer';
    if (d < 30) return `Hace ${d} días`;
    const m = Math.floor(d / 30);
    if (m < 12) return `Hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
    return new Date(iso).toLocaleDateString('es-AR');
  }

  const DEFAULT_SORT = { by: 'creada', dir: 'desc' };
  function sortFromParam(v) {
    const [by, dir] = String(v || '').split('-');
    if (by !== 'score' && by !== 'actividad' && by !== 'creada') return DEFAULT_SORT;
    return { by, dir: dir === 'asc' ? 'asc' : 'desc' };
  }
  const sortParam = (s) => (s.by === DEFAULT_SORT.by && s.dir === DEFAULT_SORT.dir ? '' : s.dir === 'desc' ? s.by : `${s.by}-${s.dir}`);
  /** Sin score o sin actividad van al final en los dos sentidos; empates por nombre. */
  function sortRows(rows, s) {
    const key = (r) => (s.by === 'score' ? r.score : s.by === 'actividad' ? (r.lastActivity ? r.lastActivity.at : null) : r.createdAt) ?? null;
    const sign = s.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka === null || kb === null) return ka === kb ? a.name.localeCompare(b.name) : ka === null ? 1 : -1;
      const c = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb));
      return c * sign || a.name.localeCompare(b.name);
    });
  }

  function filterRows(rows, f, now = Date.now()) {
    const q = String(f.q || '').trim().toLowerCase();
    const since = f.days ? now - f.days * 86400000 : null;
    return rows
      .filter((r) =>
        (!f.stage || r.stage === f.stage) &&
        (!q || r.name.toLowerCase().includes(q)) &&
        (!f.account || accountState(r) === f.account) &&
        (f.minScore === null || f.minScore === undefined || (r.score ?? -1) >= f.minScore) &&
        (since === null || (r.lastActivity !== null && r.lastActivity !== undefined && new Date(r.lastActivity.at).getTime() >= since)))
      .sort((a, b) => String((b.lastActivity && b.lastActivity.at) || b.createdAt).localeCompare(String((a.lastActivity && a.lastActivity.at) || a.createdAt)) || a.name.localeCompare(b.name));
  }

  function listTotals(rows, cfg = HABITA) {
    const byStage = Object.fromEntries(cfg.stages.map((s) => [s, 0]));
    for (const r of rows) byStage[r.stage] += 1;
    return {
      total: rows.length,
      hot: rows.filter((r) => (r.score ?? 0) >= HOT_SCORE).length,
      withAccount: rows.filter((r) => r.hasOwner).length,
      paying: rows.filter((r) => r.subscribed).length,
      byStage,
    };
  }

  // ─── Funnel de demos (demo-funnel.ts) ────────────────────────
  const FUNNEL_STEPS = ['Demos creadas', 'Enviadas', 'Con visita', 'Con interacción', 'Cuenta creada', 'Cuenta con interacción', 'Suscripciones'];
  const STEP_LABEL = ['Creada', 'Enviada', 'Con visita', 'Con interacción', 'Cuenta creada', 'Cuenta activa', 'Suscripta'];
  /** Quiénes se quedaron en cada paso sin llegar al siguiente: la parte naranja de su barra. */
  const STAYED = ['No se enviaron', 'No abrieron la demo', 'Visitaron, sin interactuar', 'Interactuaron, sin cuenta', 'Cuenta sin uso', 'Sin suscripción'];
  const OF_PREVIOUS = ['', 'de las creadas', 'de las enviadas', 'de las visitadas', 'de las que interactuaron', 'de las cuentas creadas', 'de las cuentas activas'];

  function funnelCounts(steps, cfg = HABITA) {
    const counts = cfg.steps.map((_, i) => steps.filter((s) => s >= i).length);
    return counts.map((count, i) => ({
      label: cfg.steps[i],
      count,
      ofPrevious: i === 0 ? null : counts[i - 1] ? Math.round((count / counts[i - 1]) * 100) : null,
      ofFirst: counts[0] ? count / counts[0] : 0,
    }));
  }

  const PERIODS = [{ key: 'hoy', label: 'Hoy' }, { key: '7', label: '7 días' }, { key: '30', label: '30 días' }, { key: 'mes', label: 'Este mes' }, { key: 'todo', label: 'Todo' }];
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const valid = (v) => DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
  /** AAAA-MM-DD de un momento en la Argentina (el día del equipo). */
  const argDay = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
  function parsePeriod(p, now = Date.now()) {
    const from = p.desde && valid(p.desde) ? p.desde : null;
    const to = p.hasta && valid(p.hasta) ? p.hasta : null;
    if (from || to) return { key: 'rango', from, to: to && from && to < from ? from : to };
    const today = argDay(now);
    if (p.periodo === 'hoy') return { key: 'hoy', from: today, to: today };
    if (p.periodo === '7' || p.periodo === '30') return { key: p.periodo, from: argDay(now - (Number(p.periodo) - 1) * 86400000), to: today };
    if (p.periodo === 'mes') return { key: 'mes', from: `${today.slice(0, 8)}01`, to: today };
    return { key: 'todo', from: null, to: null };
  }
  function inPeriod(iso, p) {
    if (!iso) return !p.from && !p.to; // sin fecha (todavía no se le escribió): solo en «Todo»
    const day = argDay(new Date(iso).getTime());
    return (!p.from || day >= p.from) && (!p.to || day <= p.to);
  }
  const shortDay = (iso) => { const d = argDay(new Date(iso).getTime()); return `${d.slice(8, 10)}/${d.slice(5, 7)}`; };
  function demosInPeriod(demos, p) {
    const list = demos.filter((d) => inPeriod(d.createdAt, p));
    return {
      count: list.length,
      step: list.length ? Math.max(...list.map((d) => d.step)) : null,
      latest: list.map((d) => d.createdAt).sort().slice(-1)[0] || null,
    };
  }
  function periodLabel(p) {
    const day = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    if (p.key === 'hoy') return 'hoy';
    if (p.key === '7' || p.key === '30') return `últimos ${p.key} días`;
    if (p.key === 'mes') return 'este mes';
    if (p.from && p.to) return p.from === p.to ? `el ${day(p.from)}` : `del ${day(p.from)} al ${day(p.to)}`;
    return p.from ? `desde el ${day(p.from)}` : p.to ? `hasta el ${day(p.to)}` : '';
  }

  // ─── La lista entera, como la arma la página ─────────────────
  /** Filtros desde los parámetros de la URL (los mismos nombres que /admin/inmobiliarias). */
  function filtersFrom(sp, cfg = HABITA) {
    const g = (k) => (sp.get ? sp.get(k) : sp[k]) || '';
    const stepRaw = Number(g('paso'));
    const step = g('paso') !== '' && Number.isInteger(stepRaw) && stepRaw >= 0 && stepRaw < cfg.steps.length ? stepRaw : null;
    return {
      stage: stageFromParam(g('etapa'), cfg),
      withDemo: g('etapa') === 'con-demo',
      q: g('q').slice(0, 80),
      account: Object.keys(ACCOUNT_PARAM).find((k) => ACCOUNT_PARAM[k] === g('cuenta')) || null,
      minScore: [20, 40, 60, 80].includes(Number(g('score'))) ? Number(g('score')) : null,
      days: [7, 30, 90].includes(Number(g('actividad'))) ? Number(g('actividad')) : null,
      period: parsePeriod({ periodo: g('periodo'), desde: g('desde'), hasta: g('hasta') }),
      step,
      stayed: step !== null && step < cfg.steps.length - 1 && g('quedo') === '1',
      sort: sortFromParam(g('orden')),
      page: Math.max(1, Number(g('pagina')) || 1),
    };
  }
  /** Los parámetros de la URL de unos filtros (vacíos los que van por defecto). */
  function filtersParams(f, cfg = HABITA) {
    return {
      etapa: f.withDemo ? 'con-demo' : f.stage ? cfg.stageParam[f.stage] : '',
      paso: f.step !== null ? String(f.step) : '',
      quedo: f.stayed ? '1' : '',
      periodo: f.period.key === 'todo' || f.period.key === 'rango' ? '' : f.period.key,
      desde: f.period.key === 'rango' && f.period.from ? f.period.from : '',
      hasta: f.period.key === 'rango' && f.period.to ? f.period.to : '',
      q: f.q,
      cuenta: f.account ? ACCOUNT_PARAM[f.account] : '',
      score: f.minScore !== null ? String(f.minScore) : '',
      actividad: f.days ? String(f.days) : '',
      orden: sortParam(f.sort),
      pagina: f.page > 1 ? String(f.page) : '',
    };
  }

  const PER_PAGE = 50;
  /**
   * Todo lo que muestra la lista con estos filtros: el embudo (sin las de prueba), los totales de las
   * pestañas, las filas filtradas y ordenadas y la página. Un período distinto de «Todo» acota la lista
   * a las inmobiliarias con demos creadas en él, para que coincida con el embudo de arriba.
   */
  function view(rows, f, cfg = HABITA) {
    const funnel = funnelCounts(rows.filter((r) => !r.test).flatMap((r) => r.demos.filter((d) => inPeriod(d.createdAt, f.period)).map((d) => d.step)), cfg);
    const per = new Map(rows.map((r) => [r.id, demosInPeriod(r.demos, f.period)]));
    const periodOn = f.period.key !== 'todo';
    const scoped = periodOn ? rows.filter((r) => per.get(r.id).count > 0) : rows;
    const totals = listTotals(scoped, cfg);
    const withDemos = rows.filter((r) => per.get(r.id).count > 0).length;
    const periodDemos = scoped.reduce((n, r) => n + per.get(r.id).count, 0);
    const filtered = filterRows(scoped, f).filter((r) => {
      const v = per.get(r.id);
      if (f.withDemo && !v.count) return false;
      return f.step === null || (v.step !== null && (f.stayed ? v.step === f.step : v.step >= f.step));
    });
    const shown = sortRows(filtered, f.sort);
    const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
    const page = Math.min(f.page, pages);
    return { funnel, per, periodOn, totals, withDemos, periodDemos, shown, pages, page, items: shown.slice((page - 1) * PER_PAGE, page * PER_PAGE) };
  }

  // ─── Lo que cambia por unidad ────────────────────────────────
  const HABITA = {
    id: 'habita', slug: 'inmobiliarias', many: 'inmobiliarias', one: 'inmobiliaria', title: 'Inmobiliarias', all: 'Todas',
    stages: COMMERCIAL_STAGES, stageStep: STAGE_STEP, stageTab: STAGE_TAB, stageParam: STAGE_PARAM,
    steps: FUNNEL_STEPS, stepLabel: STEP_LABEL, stayed: STAYED, ofPrevious: OF_PREVIOUS,
    lastNote: 'Clientes pagos', periodBy: 'Demo creada', withDemoTab: 'Con demo creada', accountLabel: ACCOUNT_LABEL, accountTitle: 'Cuenta habita', accountActive: 'Activa (suscripción)',
    note: '«Con interacción» incluye descargas e imágenes generadas en la demo; «Cuenta con interacción»: la cuenta subió o importó una propiedad, o generó una imagen. Las inmobiliarias de prueba (QA) no cuentan.',
  };

  // Turnia: cada odontólogo tiene su demo (/p/<código>) desde que entra a la base. El embudo sigue esa
  // demo hasta el Cliente Fundador, con los mismos datos que el panel de Turnia (su planilla espejo).
  const TURNIA = {
    id: 'turnia', slug: 'odontologos', many: 'odontólogos', one: 'odontólogo', title: 'Odontólogos', all: 'Todos',
    stages: ['prospect', 'contacted', 'demo_sent', 'interacted', 'call', 'client', 'closed'],
    stageStep: { prospect: 'Por contactar', contacted: 'Saludado', demo_sent: 'Demo enviada', interacted: 'Interactuó', call: 'Llamada agendada', client: 'Cliente Fundador', closed: 'Cerrado' },
    stageTab: { prospect: 'Por contactar', contacted: 'Saludados', demo_sent: 'Demo enviada', interacted: 'Interactuaron', call: 'Llamada agendada', client: 'Clientes', closed: 'Cerrados' },
    stageParam: { prospect: 'por-contactar', contacted: 'saludados', demo_sent: 'demo-enviada', interacted: 'interactuaron', call: 'llamada', client: 'clientes', closed: 'cerrados' },
    steps: ['Demos armadas', 'Enviadas', 'Abrieron la demo', 'Hablaron con Sofi', 'Llamada agendada', 'Clientes Fundadores'],
    stepLabel: ['Armada', 'Enviada', 'La abrió', 'Habló con Sofi', 'Llamada', 'Cliente'],
    stayed: ['No se enviaron', 'No la abrieron', 'La abrieron, sin hablar con Sofi', 'Hablaron con Sofi, sin llamada', 'Llamada sin cierre'],
    ofPrevious: ['', 'de las armadas', 'de las enviadas', 'de las que la abrieron', 'de las que hablaron con Sofi', 'de las llamadas'],
    lastNote: 'Setup y mes 1 cobrados', periodBy: 'Demo enviada', withDemoTab: 'Con demo', accountLabel: { active: 'Activa', registered: 'Creada', none: 'Sin cuenta' }, accountTitle: 'Cuenta Turnia', accountActive: 'Activa (con turnos)',
    note: '«Abrieron la demo»: entraron a su /p/…; «Hablaron con Sofi»: conversaron con Sofi en la demo (o la probaron). Los fijos sin respuesta no cuentan, como en el panel de Turnia.',
  };

  /** «AAAA-MM-DD HH:mm» (hora de Buenos Aires, como las guarda el panel) a ISO. */
  const iso = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T${(v.slice(11, 16) || '12:00')}:00-03:00`).toISOString() : null);
  const isDate = (v) => Boolean(v && v !== 'sí');

  /**
   * Turnia: las filas desde sus cuentas. El paso de su demo (0 armada … 5 cliente) y la etapa sale de los
   * hechos que ya registra su panel: envío, apertura, conversación con Sofi, llamada, cuenta y cobro.
   */
  function fromAccounts(accounts, { counted, closed } = {}) {
    return accounts.filter((a) => !counted || counted(a)).map((a) => {
      const sent = (a.touches || 0) >= 1;
      const opened = Boolean(a.demoOpened || a.demoTried || a.demoChat || a.demoClinic);
      const chat = Boolean(a.demoChat || a.demoTried);
      const call = Boolean(a.meeting) || a.stage === 'reunion';
      const client = Boolean(a.customer || a.clientAt) || a.stage === 'cliente';
      const step = client ? 5 : call ? 4 : chat ? 3 : opened ? 2 : sent ? 1 : 0;
      const isClosed = closed ? closed(a) : false;
      const stage = client ? 'client' : isClosed ? 'closed' : call ? 'call' : chat || opened || a.replied ? 'interacted' : sent ? 'demo_sent' : a.greetingSent || a.firstContact ? 'contacted' : 'prospect';
      const facts = [
        [a.clientAt || a.customer, 'Cliente Fundador'], [a.meeting, 'Llamada agendada'], [a.accountAt, 'Creó su cuenta'], [a.demoChat, 'Habló con Sofi'],
        [a.demoTried, 'Probó la demo'], [a.demoOpened, 'Abrió la demo'], [a.replied, 'Respondió'], [a.lastContact, 'Le escribimos'], [a.greetingSent, 'Saludo enviado'],
      ].filter(([d]) => isDate(d)).map(([d, text]) => ({ at: iso(d), text })).filter((x) => x.at).sort((x, y) => y.at.localeCompare(x.at));
      return {
        id: a.id, name: a.name, org: a.org, zone: a.zone, coverPhotoId: null, stage, step,
        hasOwner: isDate(a.accountAt), subscribed: isDate(a.accountActive), client,
        score: null, touches: a.touches || 0, lastActivity: facts[0] || null,
        createdAt: iso(a.firstContact) || iso(a.greetingSent) || '2000-01-01T00:00:00.000Z',
        test: false, phone: a.phone, phoneKind: a.phoneKind, demoUrl: a.demoUrl || '',
        // La fecha de la demo es la del envío: sin enviar, cuenta solo en «Todo».
        demos: a.demoUrl || sent ? [{ id: a.id, sent, createdAt: sent ? iso(a.firstContact) || iso(a.lastContact) : null, step }] : [],
      };
    });
  }

  return {
    HABITA, TURNIA, fromAccounts,
    COMMERCIAL_STAGES, STAGE_STEP, STAGE_TAB, STAGE_PARAM, stageFromParam, HOT_SCORE, ACCOUNT_LABEL, ACCOUNT_PARAM, accountState, agoText,
    DEFAULT_SORT, sortFromParam, sortParam, sortRows, filterRows, listTotals,
    FUNNEL_STEPS, STEP_LABEL, STAYED, OF_PREVIOUS, funnelCounts, PERIODS, argDay, parsePeriod, inPeriod, shortDay, demosInPeriod, periodLabel,
    filtersFrom, filtersParams, PER_PAGE, view,
  };
});
