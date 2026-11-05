// habita. · la lista «Inmobiliarias» del equipo (/admin/inmobiliarias en amoblaia), tal cual, para la
// vista Inmobiliarias de /prospecting/habita. Las reglas son las de su código y no se cambian acá:
// src/lib/agency/commercial.ts (etapas, filtros, orden, totales) y src/lib/agency/demo-funnel.ts
// (embudo de demos, períodos). Las filas llegan ya calculadas por su API (/api/prospeccion?vista=inmobiliarias).
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
  const stageFromParam = (v) => COMMERCIAL_STAGES.find((k) => STAGE_PARAM[k] === v) || null;
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

  function listTotals(rows) {
    const byStage = Object.fromEntries(COMMERCIAL_STAGES.map((s) => [s, 0]));
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

  function funnelCounts(steps) {
    const counts = FUNNEL_STEPS.map((_, i) => steps.filter((s) => s >= i).length);
    return counts.map((count, i) => ({
      label: FUNNEL_STEPS[i],
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
  function filtersFrom(sp) {
    const g = (k) => (sp.get ? sp.get(k) : sp[k]) || '';
    const stepRaw = Number(g('paso'));
    const step = g('paso') !== '' && Number.isInteger(stepRaw) && stepRaw >= 0 && stepRaw < FUNNEL_STEPS.length ? stepRaw : null;
    return {
      stage: stageFromParam(g('etapa')),
      withDemo: g('etapa') === 'con-demo',
      q: g('q').slice(0, 80),
      account: Object.keys(ACCOUNT_PARAM).find((k) => ACCOUNT_PARAM[k] === g('cuenta')) || null,
      minScore: [20, 40, 60, 80].includes(Number(g('score'))) ? Number(g('score')) : null,
      days: [7, 30, 90].includes(Number(g('actividad'))) ? Number(g('actividad')) : null,
      period: parsePeriod({ periodo: g('periodo'), desde: g('desde'), hasta: g('hasta') }),
      step,
      stayed: step !== null && step < FUNNEL_STEPS.length - 1 && g('quedo') === '1',
      sort: sortFromParam(g('orden')),
      page: Math.max(1, Number(g('pagina')) || 1),
    };
  }
  /** Los parámetros de la URL de unos filtros (vacíos los que van por defecto). */
  function filtersParams(f) {
    return {
      etapa: f.withDemo ? 'con-demo' : f.stage ? STAGE_PARAM[f.stage] : '',
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
  function view(rows, f) {
    const funnel = funnelCounts(rows.filter((r) => !r.test).flatMap((r) => r.demos.filter((d) => inPeriod(d.createdAt, f.period)).map((d) => d.step)));
    const per = new Map(rows.map((r) => [r.id, demosInPeriod(r.demos, f.period)]));
    const periodOn = f.period.key !== 'todo';
    const scoped = periodOn ? rows.filter((r) => per.get(r.id).count > 0) : rows;
    const totals = listTotals(scoped);
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

  return {
    COMMERCIAL_STAGES, STAGE_STEP, STAGE_TAB, STAGE_PARAM, stageFromParam, HOT_SCORE, ACCOUNT_LABEL, ACCOUNT_PARAM, accountState, agoText,
    DEFAULT_SORT, sortFromParam, sortParam, sortRows, filterRows, listTotals,
    FUNNEL_STEPS, STEP_LABEL, STAYED, OF_PREVIOUS, funnelCounts, PERIODS, argDay, parsePeriod, inPeriod, shortDay, demosInPeriod, periodLabel,
    filtersFrom, filtersParams, PER_PAGE, view,
  };
});
