// Panel de prospección: la interfaz. Las reglas están en core.js y lo propio de cada
// unidad en units.js; acá solo se dibuja y se llama a /api/prospecting.
(function () {
  'use strict';

  const C = window.ProspectingCore;
  const U = window.ProspectingUnits;
  const API = '/api/prospecting';
  const $ = (s, r = document) => r.querySelector(s);
  const main = $('#main');

  const state = {
    session: null,
    demo: false,
    unit: 'todas',
    view: 'hoy',
    data: {},        // por unidad: { accounts, events, templates, sheet, readAt, error, code }
    metrics: null,   // /api/metricas: { projects, errors }
    period: 'all',
    filters: {},     // por unidad: { stage, q, dims: { zone: 'Mar del Plata' } }
    breakdownDim: {},
    drawer: null,    // id de la cuenta abierta
    pending: null,   // envío esperando confirmación
    undo: {},        // id → { previous, version, label }
    shown: 100,
    more: {},        // bloques de Hoy desplegados completos
    editing: null,   // mensaje en edición: { unit, key, text, subject }
    agent: { replied: null, fails: 0, override: false }, // modo Enviar
    editingTargets: null, // unidad cuyas metas del embudo se están editando
    busy: false,     // una acción en curso: un doble clic no la repite
  };

  // ─── Utilidades ─────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('es-AR');
  const int = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : nf.format(Math.round(v)));
  const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits: v < 0.1 ? 1 : 0 })}%`);
  const money = (v) => (v === null || v === undefined ? '—' : `$${nf.format(Math.round(v))}`);
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const shortDay = (d) => (d ? `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}` : '');
  const when = (d) => {
    if (!d || d === 'sí') return d === 'sí' ? 'Sí' : '';
    const t = C.today();
    const day = d.slice(0, 10);
    const diff = C.daysBetween(t, day);
    const hour = d.length > 10 ? ` ${d.slice(11, 16)}` : '';
    if (diff === 0) return `hoy${hour}`;
    if (diff === -1) return `ayer${hour}`;
    if (diff === 1) return 'mañana';
    return shortDay(day) + (diff < -300 || diff > 300 ? ` ${day.slice(0, 4)}` : '');
  };
  const unitOf = (id) => U.get(id);
  const units = () => U.list();
  const color = (u) => `var(--${u.color})`;
  const icon = {
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 6h18v12H3zM3 7l9 6 9-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M8 8h12v12H8zM4 16V4h12"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2" d="M6 6l12 12M18 6 6 18"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" d="m6 9 6 6 6-6"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(`cl-pr-${key}`) || 'null');
      localStorage.setItem(`cl-pr-${key}`, JSON.stringify(value));
    } catch { /* sin storage */ }
    return null;
  }

  // ─── Red ────────────────────────────────────────────────────
  async function api(op, { method = 'GET', body, query = {} } = {}) {
    const url = new URL(API, location.origin);
    url.searchParams.set('op', op);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    const json = await r.json().catch(() => ({ error: `El servidor respondió ${r.status}.` }));
    if (!r.ok) throw Object.assign(new Error(json.error || 'Algo salió mal.'), { status: r.status, body: json });
    return json;
  }

  async function loadUnit(id, { quiet, noSync } = {}) {
    if (state.demo) {
      state.data[id] = window.ProspectingFixture.build(unitOf(id));
      return;
    }
    if (!quiet) state.data[id] = { loading: true };
    try {
      const d = await api('data', { query: { unit: id } });
      state.data[id] = d;
      if (!noSync) maybeSync(id);
    } catch (err) {
      state.data[id] = { error: err.message, code: err.body && err.body.code };
      if (err.status === 401) { state.session.user = null; render(); }
    }
  }

  // habita.: si la planilla no entró a su base en la última hora, se manda (una vez por sesión del panel).
  const synced = {};
  async function maybeSync(id, { force } = {}) {
    const d = state.data[id];
    if (state.demo || !d || !d.sync || synced[id] === 'running') return;
    const age = d.sync.lastImport ? Date.now() - Date.parse(d.sync.lastImport) : Infinity;
    if (!force && (synced[id] || age < 60 * 60 * 1000)) return;
    synced[id] = 'running';
    try {
      const { report } = await api('sync', { method: 'POST', body: { unit: id } });
      synced[id] = true;
      const n = (report.created || 0) + (report.legacy_sends || 0) + (report.updated || 0);
      if (force || n) toast(`Planilla traída: ${report.created || 0} cuentas nuevas, ${report.legacy_sends || 0} envíos históricos, ${report.updated || 0} actualizadas${report.held && report.held.length ? ` · ${report.held.length} para revisar en ${unitOf(id).appName}` : ''}.`);
      await loadUnit(id, { quiet: true, noSync: true });
      render();
    } catch (err) {
      synced[id] = true;
      if (force) toast(err.message, true);
    }
  }

  async function loadMetrics() {
    if (state.demo && window.ProspectingFixture) { state.metrics = window.ProspectingFixture.metrics(); return; }
    const r = periodRange();
    const q = r.from ? `?desde=${r.from}&hasta=${r.to}` : '';
    try {
      const res = await fetch(`/api/metricas${q}`);
      state.metrics = await res.json();
    } catch {
      state.metrics = { projects: {}, errors: { all: 'Sin conexión' } };
    }
  }

  // ─── Rutas ──────────────────────────────────────────────────
  function readRoute() {
    const m = location.pathname.match(/^\/prospecting\/?(turnia|habita|todas)?/);
    state.unit = (m && m[1]) || 'todas';
    const v = new URLSearchParams(location.search).get('vista');
    state.view = state.unit === 'todas' ? (TODAS_VIEWS.includes(v) ? v : 'resumen') : v === 'followup' ? 'hoy' : UNIT_VIEWS.includes(v) ? v : 'hoy';
    if (v === 'odontologos' && state.unit === 'turnia') state.view = 'inmobiliarias';
    if (state.view === 'inmobiliarias' && window.ProspectingAgencies) state.agf = window.ProspectingAgencies.filtersFrom(new URLSearchParams(location.search), state.unit === 'turnia' ? window.ProspectingAgencies.TURNIA : window.ProspectingAgencies.HABITA);
  }
  function go(unit, view, { replace } = {}) {
    if (unit!==state.unit && state.fu?.queueView) state.fu.queueView={...state.fu.queueView,commercial:null,situation:null,rule:null,tech:null,closed:false,limit:25};
    if (unit !== state.unit && window.ProspectingAgencies && unit !== 'todas')
      state.agf = window.ProspectingAgencies.filtersFrom(new URLSearchParams(''), unit === 'turnia' ? window.ProspectingAgencies.TURNIA : window.ProspectingAgencies.HABITA);
    state.unit = unit;
    if (unit === 'todas') state.view = TODAS_VIEWS.includes(view) ? view : 'resumen';
    else state.view = view === 'followup' ? 'hoy' : UNIT_VIEWS.includes(view) ? view : 'hoy';
    if (UNIT_FU_VIEWS.includes(state.view)) state.fu.sub = state.view;
    state.shown = 100;
    const path = state.view === 'inmobiliarias' ? agUrl() :
      `/prospecting${unit === 'todas' ? '' : `/${unit}`}${state.view !== 'hoy' ? `?vista=${state.view}` : ''}${state.demo ? (state.view !== 'hoy' ? '&' : '?') + 'ejemplo=1' : ''}`;
    history[replace ? 'replaceState' : 'pushState']({}, '', path);
    render();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  

  window.addEventListener('popstate', () => { readRoute(); render(); });

  // ─── Período ────────────────────────────────────────────────
  const PERIODS = [['all', 'Histórico'], ['7', '7 días'], ['30', '30 días'], ['mes', 'Este mes']];
  function periodRange() {
    const t = C.today();
    if (state.period === '7') return { from: C.addDays(t, -6), to: t };
    if (state.period === '30') return { from: C.addDays(t, -29), to: t };
    if (state.period === 'mes') return { from: `${t.slice(0, 8)}01`, to: t };
    return { from: null, to: null };
  }
  function periodSeg() {
    return `<div class="seg" role="group" aria-label="Período">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${state.period === k}">${l}</button>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>`;
  }

  // ─── Filtros (desagregar) ───────────────────────────────────
  const filt = (id) => (state.filters[id] = state.filters[id] || { stage: 'all', q: '', dims: {} });
  function scoped(id) {
    const d = state.data[id];
    if (!d || !d.accounts) return [];
    const f = filt(id);
    return d.accounts.filter((a) => Object.entries(f.dims).every(([k, v]) => dimValue(a, k) === v));
  }
  function dimValue(a, k) {
    if (k === 'priority') return a.priority ? `P${a.priority}` : 'Sin dato';
    return String(a[k] || '').trim() || 'Sin dato';
  }
  function crumbs(id) {
    const u = unitOf(id);
    const f = filt(id);
    const entries = Object.entries(f.dims);
    if (!entries.length) return '';
    const label = (k) => (u.dims.find(([dk]) => dk === k) || [k, k])[1];
    return `<div class="crumbs" aria-label="Filtros activos"><span>Mirando:</span>${entries.map(([k, v]) => `<button type="button" data-undim="${esc(k)}" aria-label="Quitar filtro ${esc(label(k))}">${esc(label(k))}: ${esc(v)} ✕</button>`).join('')}<button type="button" data-undim="*">Ver todo</button></div>`;
  }

  // ─── Marco ──────────────────────────────────────────────────
  function renderTop() {
  const segs = [['todas', 'General', 's1'], ...units().map(u => [u.id, u.name, u.color])];
  $('#units').innerHTML = segs.map(([id, name, color]) =>
    `<button type="button" data-unit="${id}" aria-pressed="${state.unit === id}"><span class="dot" style="--c:var(--${color})"></span>${esc(name.toUpperCase())}${id === 'todas' ? '' : `<span class="count num">${fuCount(id)}</span>`}</button>`
  ).join('');
  const common = [['hoy','COLA DE EJECUCIÓN','☷',fuCount(state.unit)],['responder','RESPUESTAS','◌',replyCount(state.unit)],['pipeline','EMBUDO','◫'],['prospectos','PROSPECTOS','▤'],['secuencias','REGLAS Y MENSAJES','◇'],['rendimiento','RESULTADOS','▥'],['etapas','ETAPAS Y SITUACIONES','⚙']];
  const tabs = state.unit === 'todas'
    ? [['resumen','RESUMEN','▦'],['hoy','COLA DE EJECUCIÓN','☷',fuCount('todas')],['pipeline','EMBUDOS','◫'],['prospectos','PROSPECTOS','▤'],['secuencias','REGLAS Y MENSAJES','◇'],['rendimiento','RESULTADOS','▥']]
    : common;
  $('#tabs').innerHTML = tabs.map(([key,label,glyph,num]) =>
    `<button type="button" role="tab" data-view="${key}" aria-selected="${state.view === key}"><span class="os-icon" aria-hidden="true">${glyph}</span>${label}${num ? `<span class="count num">${num}</span>` : ''}</button>`
  ).join('');
  const legacy = state.unit === 'todas' ? [] : [
    ['adquisicion','ADQUISICIÓN ANTERIOR'],
    ['responder-legado','BANDEJA DE WHATSAPP ANTERIOR'], 
    ['embudo','EMBUDO DE PRODUCTO'],
    ['cuentas','FICHAS DE CUENTAS'],
    ['enviar','ENVÍOS Y AUDIOS'],
    ...(unitOf(state.unit).agencies ? [['inmobiliarias',cfgOf(state.unit).title.toUpperCase()]] : []),
    ...(unitOf(state.unit).onboarding ? [['onboarding','ONBOARDING']] : []),
    ['mensajes','PLANTILLAS ANTERIORES'],
    ['playbook','PLAYBOOK']
  ];
  $('#legacy-tabs').innerHTML = legacy.map(([key,label]) =>
    `<button type="button" data-view="${key}" aria-current="${state.view === key ? 'page' : 'false'}">${esc(label)}</button>`
  ).join('');
  document.body.dataset.unit = state.unit;
  $('#os-place').textContent = state.unit === 'todas' ? 'GENERAL' : (unitOf(state.unit)?.name || state.unit).toUpperCase();
  const userBtn = $('#user'), user = state.session && state.session.user;
  userBtn.hidden = !user && !state.demo;
  userBtn.textContent = state.demo ? 'Ej.' : user ? user.name.slice(0,2).toUpperCase() : '';
  userBtn.title = state.demo ? 'Salir del ejemplo' : user ? `${user.name} · cerrar sesión` : '';
  userBtn.setAttribute('aria-label', userBtn.title);
  requestAnimationFrame(() => document.querySelectorAll('.seg').forEach(moveThumb));
}

  function moveThumb(seg) {
    const thumb = seg.querySelector('.seg-thumb');
    const on = seg.querySelector('[aria-pressed="true"]');
    if (!thumb || !on) return;
    thumb.style.width = `${on.offsetWidth}px`;
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
  }

  function queueCount() {
    const d = state.data[state.unit];
    if (!d || !d.accounts) return 0;
    const q = C.queue(scoped(state.unit), unitOf(state.unit), { events: d.events });
    return q.conversations.length + q.followUps.length + q.greeted.length + q.fresh.length;
  }

  function render() {
    renderTop();
    if (!state.session) return;
    const s = state.session;
    if (!state.demo && !s.google) { main.innerHTML = setupScreen(); return after(); }
    if (!state.demo && !s.user) { main.innerHTML = loginScreen(); return after(); }
    if (isFu() && !state.demo && !state.fu.n && !state.fu.loading && !state.fu.error) setTimeout(() => loadFollowup(), 0);
    if (state.unit === 'todas') main.innerHTML = state.view === 'resumen' ? renderCommercialOverview() : renderFu();
    else if (UNIT_FU_VIEWS.includes(state.view) || state.view === 'followup' || state.view === 'responder') main.innerHTML = renderFu();
    else {
      const d = state.data[state.unit];
      if (!d || d.loading) main.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
      else if (d.error) main.innerHTML = unitError(state.unit, d);
      else main.innerHTML = demoBanner() + readOnlyBanner(state.unit) + ({ hoy: renderToday, adquisicion: renderToday, responder: renderResponder, 'responder-legado': renderResponder, enviar: renderSend, onboarding: renderOnboarding, embudo: renderFunnelView, cuentas: renderAccounts, inmobiliarias: renderAgencies, mensajes: renderMessages, playbook: renderPlaybook }[state.view] || renderToday)(state.unit);
    }
    after();
  }
  // Cuenta regresiva del modo Enviar y aviso de un envío abierto sin confirmar (por ejemplo, tras recargar).
  setInterval(() => {
    const card = document.getElementById('agent');
    if (card && card.dataset.state === 'wait' && !state.busy) {
      const left = Math.ceil(((store(`next-${state.unit}`) || 0) - Date.now()) / 1000);
      if (left <= 0) render();
      else { const st = card.querySelector('.agent-status'); if (st) st.textContent = `Ritmo seguro: esperá ${left} s para el próximo.`; }
    }
  }, 1000);

  // Entrada de cada vista: las tarjetas suben en cascada, las barras crecen y los números cuentan.
  // Solo al cambiar de unidad o de vista: un dato que se actualiza no repite la animación.
  let shownKey = null;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function enter() {
    const loaded = !main.querySelector(':scope > .skeleton');
    const key = `${state.unit}/${state.view}/${state.demo}`;
    const entering = loaded && key !== shownKey;
    if (loaded) shownKey = key;
    if (!entering || calm) return;
    // La clase queda lo que dura la entrada: si llegan datos en ese momento, la animación sigue.
    main.classList.add('entering');
    clearTimeout(enter.t);
    enter.t = setTimeout(() => main.classList.remove('entering'), 1600);
    main.querySelectorAll(':scope > .card, :scope > section, :scope > .notice').forEach((c, i) => c.style.setProperty('--n', Math.min(i, 12)));
    main.querySelectorAll('.kpi .value, .hero h1').forEach(countUp);
  }
  // Enteros con separador de miles (es-AR) y, opcionalmente, un prefijo o sufijo: «1.234», «45%».
  function countUp(el) {
    if (el.children.length) return;
    const m = /^([^\d-]*)(\d{1,3}(?:\.\d{3})*|\d+)([^\d,]*)$/.exec(el.textContent.trim());
    if (!m) return;
    const target = Number(m[2].replace(/\./g, ''));
    if (!Number.isFinite(target) || target < 2) return;
    const t0 = performance.now();
    const dur = Math.min(1400, 600 + Math.log10(target + 1) * 220);
    const step = (now) => {
      if (!el.isConnected) return;
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = `${m[1]}${Math.round(target * (1 - (1 - k) ** 4)).toLocaleString('es-AR')}${m[3]}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function after() {
    enter();
    const p = storedPending();
    if (p && !state.pending && state.view !== 'enviar' && !$('#confirm').classList.contains('on')) { state.pending = p; showConfirmBar(p, { again: true }); }
    window.LiquidGlass && window.LiquidGlass.scan();
    requestAnimationFrame(() => document.querySelectorAll('.seg').forEach(moveThumb));
    bindCharts();
  }

  // Unidades cuya planilla escribe su propia app (Turnia): acá se mira y se mide; se opera allá.
  const isReadOnly = (id) => { const d = state.data[id]; return Boolean(d && d.readOnly && !state.demo); };
  function readOnlyBanner(id) {
    const u = unitOf(id);
    const d = state.data[id];
    // habita.: sin respuesta de su API se ve la planilla, que no tiene lo que se hizo en su panel.
    if (!state.demo && u.api && u.api.rows && d && d.apiError) return `<div class="notice glass"><span class="badge off">Sin conexión</span><span>No pudimos leer ${esc(u.appName)} (${esc(d.apiError)}). Lo que ves es la planilla, que no tiene lo que se hizo en ese panel.</span><a class="btn small" href="${esc(u.appUrl)}" target="_blank" rel="noopener">${icon.ext} Abrir ${esc(u.appName)}</a></div>`;
    if (!state.demo && u.api && u.api.rows && d && !d.error && !d.loading && !d.viaApi) return `<div class="notice glass"><span class="badge off">Planilla</span><span>Falta la clave de la API de ${esc(u.name)} en Vercel (${esc(u.api.secretEnvs.join(' o '))}): lo que ves es la planilla, que no tiene lo que se hizo en ${esc(u.appName)}.</span></div>`;
    if (!isReadOnly(id)) return '';
    return `<div class="notice glass"><span class="badge off">Solo lectura</span><span>La planilla de ${esc(u.name)} la escribe ${esc(u.appName)}. Para operar desde acá falta la clave de su API en Vercel (${esc((u.api && u.api.secretEnvs.join(' o ')) || '')}); mientras tanto, para contactar, abrí el panel.</span><a class="btn small primary" href="${esc(u.appUrl)}" target="_blank" rel="noopener">${icon.ext} Abrir ${esc(u.appName)}</a></div>`;
  }

  function demoBanner() {
    if (!state.demo) return '';
    return `<div class="notice glass"><span class="badge demo">Datos de ejemplo</span><span>Cuentas ficticias para recorrer el panel. Nada se guarda ni se envía a ninguna planilla.</span><button class="btn small" type="button" data-action="exit-demo">Salir del ejemplo</button></div>`;
  }

  // ─── Pantallas de acceso ────────────────────────────────────
  function setupScreen() {
    const s = state.session;
    const item = (ok, text) => `<li>${ok ? '✓' : '○'} ${text}</li>`;
    return `<div class="center"><section class="login glass strong" data-liquid="34" aria-labelledby="setup-title">
      <span class="eyebrow">Conexión pendiente</span>
      <h1 id="setup-title">Falta conectar las planillas</h1>
      <p class="sub">El panel lee y escribe la planilla de Google de cada unidad. Se configura una vez en Vercel (proyecto chapa-labs):</p>
      <ul style="margin:0;padding:0;list-style:none;display:grid;gap:6px">
        ${item(s.auth, '<code>PROSPECTING_PASSWORD</code>: la contraseña del equipo (opcional: sin ella, cualquiera con el link entra).')}
        ${item(s.google, '<code>GOOGLE_SERVICE_ACCOUNT_JSON</code>: el archivo JSON entero de la cuenta de servicio.')}
        ${s.googleProblem ? `<li style="color:var(--bad-text)">${esc(s.googleProblem)}</li>` : ''}
        ${s.units.map((u) => item(u.sheet, `<code>${esc(u.sheetEnv)}</code>: la planilla de ${esc(unitOf(u.id).name.replace(/\.$/, ''))}.`)).join('')}
      </ul>
      <p class="sub">Los pasos están en <code>docs/PROSPECCION.md</code> del repo.</p>
      <button class="btn primary" type="button" data-action="demo">Recorrer con datos de ejemplo</button>
    </section></div>`;
  }

  function loginScreen() {
    const last = store('name') || '';
    return `<div class="center"><form class="login glass strong" id="login" data-liquid="34" aria-labelledby="login-title">
      <span class="eyebrow">Chapa Labs</span>
      <h1 id="login-title">Entrar a Prospección</h1>
      <p class="sub">Tu nombre queda en cada contacto que registres.</p>
      <label class="field">Tu nombre<input name="name" autocomplete="nickname" required value="${esc(last)}"></label>
      ${state.session.auth ? '<label class="field">Contraseña del equipo<input name="password" type="password" autocomplete="current-password" required></label>' : ''}
      <p class="sub" id="login-error" role="alert"></p>
      <button class="btn primary" type="submit">Entrar</button>
      <button class="btn ghost" type="button" data-action="demo">Ver con datos de ejemplo</button>
    </form></div>`;
  }

  function unitError(id, d) {
    const u = unitOf(id);
    return `${demoBanner()}<section class="card glass"><div class="card-head"><div><span class="eyebrow">${esc(u.name)}</span><h2>No se pudo leer la planilla</h2><p class="sub">${esc(d.error)}</p></div></div>
      ${d.code === 'NO_SHEET' ? `<p class="sub">Creá (o elegí) la planilla de ${esc(u.name)}, compartila como Editor con <code>${esc(state.session.serviceEmail || 'la cuenta de servicio')}</code> y cargá su id en <code>${esc(u.sheetEnv)}</code>.</p>` : ''}
      <div class="btns"><button class="btn" type="button" data-action="reload">Reintentar</button></div></section>`;
  }

  // ─── Resumen general (todas las unidades) ───────────────────
  function renderCommercialOverview() {
  if (state.demo) return renderOverview();
  if (!state.fu.n) return state.fu.error
    ? `<section class="card glass"><h2>No se pudo cargar la operación comercial</h2><p>${esc(state.fu.error)}</p><button class="btn primary" type="button" data-fu="reload">Reintentar</button></section>`
    : '<div class="skeleton"></div><div class="skeleton"></div>';
  const s = F.summary(state.fu.n, 'todas');
  const entries = units().map(u => {
    const snap = state.fu.n.units[u.id];
    const sum = F.summary(state.fu.n,u.id);
    return `<button type="button" class="os-business-card" data-business="${u.id}" data-goto="${u.id}" data-view-to="hoy">
      <div class="os-business-head"><span class="eyebrow">${u.id === 'habita' ? '● INMOBILIARIAS · VIRTUAL STAGING' : '● SALUD · ASISTENTE DE TURNOS'}</span><span class="badge ${snap?'live':'off'}">${snap?'CONECTADO':'SIN DATOS'}</span></div>
      <h2>${esc(u.name)}</h2><p>${esc(u.icp || '')}</p>
      <div class="os-business-metrics">
        <div><strong>${int(sum.ready)}</strong><small>Listas</small></div>
        <div><strong>${int(sum.replies)}</strong><small>Respuestas</small></div>
        <div><strong>${int(sum.doneToday)}</strong><small>Hechas hoy</small></div>
      </div></button>`;
  }).join('');
  const today=state.fu.n.queue.slice(0,8);
  const errors=Object.entries(state.fu.n.errors).map(([u,e])=>`<div class="notice glass"><span class="badge off">${esc(fuName(u))}</span>${esc(e)}</div>`).join('');
  return `<section class="hero"><div><span class="eyebrow">CHAPA LABS / GENERAL</span><h1>Tu centro de operaciones comerciales.</h1><p>Dos negocios, una sola ejecución. Priorizá el trabajo del día, entendé dónde se frena el avance y entrá a cada equipo sin cambiar de herramienta.</p></div><span class="os-tag">VISTA CONSOLIDADA</span></section>
    ${errors}
    <section class="card glass"><div class="os-section-heading"><div><span class="os-kicker">ACTIVIDAD DE HOY</span><h2>El pulso comercial</h2></div><button class="btn small" type="button" data-view="rendimiento">Ver resultados →</button></div>
    <div class="kpis" style="margin-top:15px">
      ${kpi('Acciones listas', int(s.ready),'Ejecutables ahora')}
      ${kpi('Respuestas', int(s.replies),'Esperan respuesta')}
      ${kpi('Demos pendientes', int(s.demos),'Por crear o enviar')}
      ${kpi('Enviadas hoy', int(s.doneToday),'Confirmadas')}
      ${kpi('Programadas', int(s.scheduled),'Pendientes futuras')}
      ${kpi('Bloqueadas', int(s.blocked),'Con motivo registrado')}
    </div></section>
    <section><div class="os-section-heading" style="margin-bottom:13px"><div><span class="os-kicker">WORKSPACES</span><h2>Elegí dónde enfocarte</h2></div></div><div class="os-business-cards">${entries}</div></section>
    <section class="os-action-banner"><div><strong>${int(s.ready)} acciones esperan al equipo</strong><p>Empezá con respuestas y demos pendientes; el motor de cada producto determina qué puede ejecutarse.</p></div><button class="btn" data-view="hoy" type="button">IR A LA COLA UNIFICADA →</button></section>
    <section class="card glass"><div class="os-section-heading"><div><span class="os-kicker">PRIORIDAD</span><h2>Próximas acciones</h2></div><button class="btn small" data-view="hoy" type="button">Ver toda la cola</button></div>
      <div class="rows" style="margin-top:12px">${today.map(x=>fuRow(x)).join('')||'<p class="empty">No hay tareas listas ahora.</p>'}</div></section>`;
}

  function fuCatalog() {
  const unit=fuScope(),snap=state.fu.n?.units?.[unit];
  if(!snap)return '<section class="card glass">Catálogo no disponible.</section>';
  const db=snap.catalog||{},canEdit=db.available===true&&!state.session?.open;
  const steps=F.commercialStages(unit,snap),selected=steps.find(s=>s.key===state.fu.catalogStage)||steps.find(s=>s.key==='contactado')||steps[0];
  const key=selected?.key||'contactado',canonical=Object.entries(snap.labels?.situations||{});
  const overrides=(db.overrides||[]).filter(x=>x.commercial_stage===key);
  const rules=F.ruleRows(unit,snap).filter(r=>selected?.technical?.includes(r.stage));
  const rows=[
    ...canonical.map(([id,label])=>{
      const o=overrides.find(x=>x.key===id);
      return {key:id,label:o?.label||label,description:o?.description||'',examples:o?.examples||'',
        active:o?.enabled!==false,removed:!!o?.removed,base:true,source:'manual',maps_to:id,product_stage:null};
    }).filter(x=>!x.removed),
    ...(db.states||[]).filter(s=>s.commercial_stage===key).map(x=>({...x,base:false,active:x.active===true}))
  ];
  const editing=state.fu.catalogEdit?.commercial_stage===key?state.fu.catalogEdit:null;
  const current=editing?.create?{key:'',label:'',description:'',examples:'',active:false,maps_to:'',source:'whatsapp',product_stage:selected?.technical?.[0]||null,base:false}
    :rows.find(r=>r.key===editing?.key&&r.base===editing.base);
  const allowed=(db.canonical||canonical.map(([key,label])=>({key,label}))).filter(x=>!x.permanent_stop);
  const isCustom=!!(db.stages||[]).find(s=>s.key===key);
  const stageForm=canEdit&&state.fu.newStage?`<form class="fu-catalog-editor" data-fu-stage-form>
    <h3>Nueva etapa</h3>
    <label>Nombre de la etapa<input class="input" name="label" required minlength="2" maxlength="80"></label>
    <label>Etapa de origen<select class="input" name="technical_stage">${(snap.stages||[]).map(s=>`<option value="${esc(s.key)}">${esc(s.title)}</option>`).join('')}</select></label>
    <label>Situación de entrada<select class="input" name="entry_situation">${canonical.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select></label>
    <p>Se agrupa por la etapa técnica y situación de entrada. No cambia la secuencia de mensajes.</p>
    <div class="fu-ref-buttons"><button type="submit" class="btn primary">CREAR ETAPA</button><button class="btn" type="button" data-fu="new-stage">CANCELAR</button></div>
  </form>`:'';
  const editor=canEdit&&current?`<form class="fu-catalog-editor" data-fu-state-form data-testid="followup-state-editor"
    data-fu-key="${esc(current.key)}" data-fu-base="${current.base?'1':'0'}"
    data-fu-commercial="${esc(key)}" data-fu-create="${editing.create?'1':'0'}">
    <h3>${editing.create?'Nueva situación':'Editar situación'}</h3>
    <label>Nombre<input class="input" name="label" value="${esc(current.label||'')}" required maxlength="80"></label>
    <label>Descripción<textarea class="input" name="description" rows="3" maxlength="800">${esc(current.description||'')}</textarea></label>
    <label>Ejemplos de respuestas<textarea class="input" name="examples" rows="3" maxlength="2000">${esc(current.examples||'')}</textarea></label>
    ${current.base?'':`
      <div data-catalog-mapping ${current.source==='product'?'hidden':''}><label>Situación que entiende el motor
      <select class="input" name="maps_to"><option value="">Sin mapear (revisión manual)</option>
        ${allowed.map(x=>`<option value="${esc(x.key)}" ${x.key===current.maps_to?'selected':''}>${esc(x.label)}</option>`).join('')}
      </select></label></div>
      <div data-catalog-products ${current.source==='product'?'':'hidden'}><label>Condición del embudo
      <select class="input" name="product_stage">${(selected?.technical||[]).map(s=>`<option value="${esc(s)}" ${s===current.product_stage?'selected':''}>${esc((snap.stages||[]).find(x=>x.key===s)?.title||s)}</option>`).join('')}</select></label></div>
      <label>Origen<select class="input" name="source" data-fu-catalog-source>
        <option value="whatsapp" ${current.source==='whatsapp'?'selected':''}>WhatsApp</option>
        <option value="manual" ${current.source==='manual'?'selected':''}>Manual</option>
        ${selected?.technical?.length&&!isCustom?`<option value="product" ${current.source==='product'?'selected':''}>Avance del embudo</option>`:''}
      </select></label>
      <label class="fu-catalog-enabled"><input type="checkbox" name="active" ${current.active?'checked':''}>Activa para clasificación</label>`}
    <div class="fu-ref-buttons"><button class="btn" type="button" data-fu="catalog-cancel">CANCELAR</button><button type="submit" class="btn primary">GUARDAR SITUACIÓN</button></div>
  </form>`:'';
  const list=rows.map(s=>{
    const count=rules.filter(r=>s.base?(!r.raw?.catalog_situation&&(r.raw?.situations||[]).includes(s.key)):r.raw?.catalog_situation===s.key).length;
    return `<li class="fu-catalog-state-row" data-testid="followup-state-row">
      <span class="fu-catalog-state-icon">${fuStageGlyph(s.maps_to==='interesado'?'interesado':'contactado')}</span>
      <div class="fu-catalog-state-main"><strong>${esc(s.label)} ${count?`<span class="fu-catalog-rule-count">${int(count)} ${count===1?'regla':'reglas'}</span>`:''}</strong>
        <small>${esc(s.description||((snap.stages||[]).find(x=>x.key===s.product_stage)?.title||'Situación personalizada'))}</small></div>
      <button type="button" class="fu-catalog-toggle ${s.active?'is-on':''}" role="switch" aria-checked="${s.active}"
        data-fu="state-toggle" data-fu-key="${esc(s.key)}" data-fu-enabled="${s.active?'0':'1'}"
        aria-label="${s.active?'Deshabilitar':'Habilitar'} ${esc(s.label)}" ${canEdit?'':'disabled'}><span></span>${s.active?'Habilitada':'Deshabilitada'}</button>
      <button type="button" class="fu-catalog-icon-btn" data-fu="edit-situation" data-fu-key="${esc(s.key)}" data-fu-base="${s.base?'1':'0'}"
        aria-label="Editar ${esc(s.label)}" ${canEdit?'':'disabled'}>✎</button>
      <button type="button" class="fu-catalog-icon-btn" data-fu="state-delete" data-fu-key="${esc(s.key)}" data-fu-base="${s.base?'1':'0'}"
        data-fu-commercial="${esc(key)}" aria-label="Eliminar ${esc(s.label)}" ${canEdit?'':'disabled'}>×</button></li>`;
  }).join('');
  return `<section class="fu-catalog-reference" data-testid="followup-state-catalog">
    ${!canEdit?`<p class="os-warn-note">${state.session?.open?'Para editar, configurá PROSPECTING_PASSWORD en Vercel.':'El catálogo está en modo lectura hasta que la API del producto esté disponible.'}</p>`:''}
    <div class="fu-catalog-layout"><aside class="fu-catalog-nav"><header><h2>Etapas del embudo</h2></header>
      <button class="btn" type="button" data-fu="new-stage" ${canEdit?'':'disabled'}>${state.fu.newStage?'CANCELAR':'+ NUEVA ETAPA'}</button>
      <nav aria-label="Etapas del embudo">${steps.map(s=>`<button type="button" aria-pressed="${s.key===key}" data-fu="catalog-stage" data-fu-stage="${esc(s.key)}">
        ${fuStageGlyph(s.key)}<span>${esc(s.title)}</span><span aria-hidden="true">›</span></button>`).join('')}</nav>
      </aside><div class="fu-catalog-content">${stageForm}
      ${isCustom?`<p class="os-view-caption">Etapa personalizada · ${esc((snap.stages||[]).find(s=>s.key===selected?.technical?.[0])?.title||'')}</p>`:''}
      <div class="fu-catalog-panel"><header class="fu-catalog-head"><div><h2>${esc(selected?.title||'Situaciones')}</h2>
        <p>${rows.filter(s=>s.active).length} de ${rows.length} situaciones habilitadas</p></div>
        <button type="button" class="btn primary" data-fu="new-situation" ${canEdit?'':'disabled'}>+ NUEVA SITUACIÓN</button></header>
        ${editor}<ul class="fu-catalog-list">${list||'<li>No hay situaciones en esta etapa.</li>'}</ul>
      </div><a class="btn small" href="${unit==='habita'?'https://www.habitaia.app/admin/follow-up':'https://turniasalud.app/panel/prospeccion'}"
        target="_blank" rel="noopener">ABRIR PANEL ORIGINAL ↗</a></div></div></section>`;
}

  async function submitCatalog(form) {
  const unit=state.unit;
  if(!['habita','turnia'].includes(unit)||state.session?.open||!state.fu.n?.units?.[unit]?.catalog?.available)return;
  const fd=new FormData(form);
  if(form.matches('[data-fu-stage-form]')){
    const values={label:String(fd.get('label')||''),technical_stage:fd.get('technical_stage'),entry_situation:fd.get('entry_situation')};
    if(await fuOp(unit,{op:'stage-create',valores:values},{label:'Etapa creada en '+fuName(unit)+'.'})){
      state.fu.newStage=false;await loadFollowup({quiet:true});render();
    }
  } else if(form.matches('[data-fu-state-form]')){
    const isNew=form.dataset.fuCreate==='1',isBase=form.dataset.fuBase==='1';
    const values={key:isNew?`custom_${Date.now().toString(36)}`:form.dataset.fuKey,
      commercial_stage:form.dataset.fuCommercial,base:isBase,create:isNew,
      label:String(fd.get('label')||''),description:String(fd.get('description')||''),
      examples:String(fd.get('examples')||''),source:String(fd.get('source')||'whatsapp'),
      maps_to:isBase||fd.get('source')==='product'?null:(fd.get('maps_to')||null),
      product_stage:isBase||fd.get('source')!=='product'?null:(fd.get('product_stage')||null),
      active:isBase?true:fd.has('active')};
    if(await fuOp(unit,{op:'state-save',valores:values},{label:'Situación guardada en '+fuName(unit)+'.'})){
      state.fu.catalogEdit=null;await loadFollowup({quiet:true});render();
    }
  }
}

  function renderOverview() {
    const range = periodRange();
    const loaded = units().filter((u) => state.data[u.id] && state.data[u.id].accounts);
    const fs = loaded.map((u) => ({ u, f: C.funnel(state.data[u.id].accounts, u, { range }), q: C.queue(state.data[u.id].accounts, u, { events: state.data[u.id].events }) }));
    const total = {};
    for (const [k] of C.FUNNEL) total[k] = fs.reduce((s, x) => s + x.f[k], 0);
    const doneToday = fs.reduce((s, x) => s + x.q.doneToday, 0);
    const goal = fs.reduce((s, x) => s + x.q.goal, 0);
    const replyRate = total.contactados ? total.respondieron / total.contactados : null;

    const cards = units().map((u) => {
      const x = fs.find((y) => y.u === u);
      const d = state.data[u.id];
      if (!x) {
        return `<button type="button" class="unit-card card glass" data-goto="${u.id}"><div class="card-head"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)}</span><h2>${d && d.error ? 'Sin conexión con la planilla' : 'Cargando…'}</h2><p class="sub">${esc((d && d.error) || '')}</p></div></div></button>`;
      }
      return `<button type="button" class="unit-card card glass" data-goto="${u.id}" data-view-to="embudo" aria-label="Ver el embudo de ${esc(u.name)}">
        <div class="card-head" style="margin:0"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)}</span><h2>${int(x.f.clientes)} clientes de ${int(x.f.contactados)} contactados</h2><p class="sub">${esc(u.icp)}</p></div><span class="badge ${state.demo ? 'demo' : 'live'}">${state.demo ? 'Ejemplo' : 'Planilla'}</span></div>
        ${targetHtml(u, state.data[u.id].accounts, { compact: true })}
      </button>`;
    }).join('');

    return `${demoBanner()}
      <section class="hero"><div><span class="eyebrow">Todas las unidades</span><h1>Operación comercial</h1><p>Un mismo motor y una misma forma de medir para Turnia y habita.; cada una con su ICP, su propuesta y su planilla. Tocá una unidad para bajar al detalle.</p></div>${periodSeg()}</section>
      <section class="card glass" aria-label="Totales">
        <div class="kpis">
          ${kpi('Contactos hoy', `${int(doneToday)}<span class="sub"> / ${int(goal)}</span>`, 'Meta diaria sumada')}
          ${kpi('Contactados', int(total.contactados), state.period === 'all' ? 'Histórico' : 'Primer contacto en el período')}
          ${kpi('Tasa de respuesta', pct(replyRate), total.contactados < 30 ? 'Muestra chica (n<30)' : `${int(total.respondieron)} respondieron`)}
          ${kpi('Reuniones o demos', int(total.reuniones), pct(total.contactados ? total.reuniones / total.contactados : null) + ' de contactados')}
          ${kpi('Clientes', int(total.clientes), 'Desde la prospección')}
        </div>
      </section>
      <div class="grid cols-2">${cards}</div>
      <section class="card glass">
        <div class="card-head"><div><h2>Contactos por día</h2><p class="sub">Mensajes confirmados, llamadas y visitas de cada unidad${state.period === 'all' ? ', últimos 30 días' : ''}.</p></div></div>
        ${linesChart(loaded.map((u) => ({ u, rows: C.daily(state.data[u.id].events, state.data[u.id].accounts, u, state.period === 'all' ? { from: C.addDays(C.today(), -29), to: C.today() } : range) })))}
      </section>
      ${sourcesCard()}`;
  }

  function sourcesCard() {
    const m = state.metrics;
    const rows = units().map((u) => {
      const d = state.data[u.id];
      const sheet = state.demo ? '<span class="badge demo">Ejemplo</span>' : d && d.sheet ? `<a class="badge live" href="${esc(d.sheet.url)}" target="_blank" rel="noopener">${esc(d.sheet.title || 'Planilla')} · ${esc(d.sheet.tab)}</a>` : `<span class="badge off">${esc((d && d.error) || 'Sin planilla')}</span>`;
      const app = m && m.projects && m.projects[u.metricsKey] ? '<span class="badge live">En vivo</span>' : `<span class="badge off">${esc((m && m.errors && (m.errors[u.metricsKey] || m.errors.all)) || 'Cargando…')}</span>`;
      return `<tr><td><strong>${esc(u.name)}</strong></td><td>${sheet}</td><td>${app}</td><td><a href="/${esc(u.dashboardHash)}">Producto y PostHog ${icon.ext.replace('<svg', '<svg width="12" height="12"')}</a></td></tr>`;
    }).join('');
    return `<section class="card glass"><div class="card-head"><div><h2>De dónde sale cada número</h2><p class="sub">La prospección sale de la planilla de cada unidad (se lee al abrir y después de cada cambio). Lo que pasa después del contacto, del <code>/api/metricas</code> de cada app. La web y el producto, de PostHog en el tablero.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Prospección</th><th>App (/api/metricas)</th><th>Tablero</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  function metricAt(u, path) {
    const p = state.metrics && state.metrics.projects && state.metrics.projects[u.metricsKey];
    if (!p) return null;
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), p);
  }
  function productStrip(u, { title = 'Después del contacto · ' } = {}) {
    const live = state.metrics && state.metrics.projects && state.metrics.projects[u.metricsKey];
    return `<div><div class="sub" style="margin-bottom:6px">${title}${live ? '<span class="badge live">App en vivo</span>' : '<span class="badge off">App sin conexión</span>'}</div>
      <div class="kpis">${u.product.map((p) => {
        const v = metricAt(u, p.path);
        return kpi(p.label, v == null ? '—' : p.format === 'money' ? money(v) : int(v), p.hint || '');
      }).join('')}</div></div>`;
  }

  // Embudo con metas: barra = real, marca = meta. Al lado, la conversión real contra la esperada.
  // Las metas de la unidad con las que el equipo ajustó (compartidas, guardadas en el servidor).
  function withTargets(u) {
    const o = state.data[u.id] && state.data[u.id].targets;
    if (!u.targets || !o) return u;
    return { ...u, targets: u.targets.map((t, i) => (i === 0 ? { ...t, perWeek: o.perWeek || t.perWeek } : { ...t, rate: (o.rates && o.rates[t.key]) || t.rate })) };
  }

  function targetHtml(u0, accounts, { compact } = {}) {
    const u = withTargets(u0);
    const metrics = state.metrics && state.metrics.projects ? state.metrics.projects[u.metricsKey] : null;
    const tf = C.targetFunnel(accounts, u, { range: periodRange(), metrics });
    if (!tf) return '';
    const num = (v) => (v == null ? '—' : v < 10 && v % 1 ? v.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : int(v));
    const status = (ok, text) => (ok == null ? '' : `<span class="tstat ${ok ? 'ok' : 'low'}">${ok ? '✓' : '↓'} ${text}</span>`);
    const src = { sheet: 'Planilla', app: 'App', none: 'Sin datos' };
    const rows = tf.steps.map((st, i) => {
      // Cada fila en su escala (la meta de abajo es chica): se ve cuánto falta o cuánto sobra.
      const max = Math.max(st.target || 0, st.actual || 0, 1e-9) * 1.12;
      const w = st.actual == null ? 0 : Math.max(st.actual ? 1.5 : 0, (st.actual / max) * 100);
      const t = Math.min(100, ((st.target || 0) / max) * 100);
      const conv = i === 0 ? `<span class="sub">meta ${int(Math.round(tf.steps[0].target))}${state.period === 'all' ? ` en ${num(tf.weeks)} sem.` : ''}</span>`
        : `${pct(st.rate)} <span class="sub">/ ${pct(st.targetRate)}</span> ${compact ? '' : status(st.rateOk, st.rateOk ? 'en meta' : `${Math.round(((st.targetRate || 0) - (st.rate || 0)) * 100)} pts`)}`;
      return `<div class="trow" role="listitem" aria-label="${esc(st.label)}: ${num(st.actual)} de una meta de ${num(st.target)}">
        <span class="tname">${esc(st.label)}${!compact && st.hint ? `<small>${esc(st.hint)}</small>` : ''}</span>
        <span class="ttrack" title="Real ${num(st.actual)} · Meta ${num(st.target)}"><span class="tbar" style="width:${w}%;--c:${color(u)}"></span><span class="tmark" style="left:${t}%"></span></span>
        <span class="tval num">${st.actual == null ? '<span class="sub">Sin datos</span>' : `${num(st.actual)}<span class="sub"> / ${num(st.target)}</span>`}</span>
        ${compact ? '' : `<span class="tconv num">${conv}</span><span class="tsrc"><span class="badge plain">${src[st.source]}</span></span>`}
      </div>`;
    }).join('');
    return `<div class="tfunnel${compact ? ' compact' : ''}" role="list">${compact ? '' : '<div class="trow thead" aria-hidden="true"><span>Paso</span><span>Real (barra) contra meta (marca), cada paso en su escala</span><span>Real / meta</span><span>Conversión / meta</span><span>Fuente</span></div>'}${rows}</div>
      <div class="legend"><span><i style="background:${color(u)}"></i>Real</span><span><i class="mark"></i>Meta del período (${state.period === 'all' ? 'desde el primer contacto' : 'período elegido'}: ${int(u.targets[0].perWeek)} saludos por semana)</span></div>`;
  }

  function targetsForm(id) {
    const u = withTargets(unitOf(id));
    const base = unitOf(id).targets;
    const pctv = (r) => Math.round(r * 1000) / 10;
    return `<form class="grid" data-targets-form style="gap:10px">
      <div class="tform">
        <label class="field">${esc(u.targets[0].label)} por semana<input type="number" name="perWeek" min="1" max="5000" step="1" required value="${u.targets[0].perWeek}" data-testid="target-perWeek"></label>
        ${u.targets.slice(1).map((t, i) => `<label class="field">${esc(t.label)} <span class="sub" style="font-weight:500">(% sobre «${esc(u.targets[i].label)}»${pctv(base[i + 1].rate) !== pctv(t.rate) ? ` · de fábrica ${pctv(base[i + 1].rate)}%` : ''})</span><span class="pct-input"><input type="number" name="rate-${esc(t.key)}" min="1" max="100" step="0.5" required value="${pctv(t.rate)}" data-testid="target-${esc(t.key)}"><span>%</span></span></label>`).join('')}
      </div>
      <p class="sub" style="margin:0">Las metas son del equipo: las ve todo el que abre el panel. ${unitOf(id).api && unitOf(id).api.targets !== false ? `Se guardan en ${esc(unitOf(id).appName)}: los saludos por semana son su misma meta semanal.` : 'Se guardan en la pestaña «Metas» de la planilla.'}</p>
      <div class="btns"><button class="btn primary" type="submit" data-testid="save-targets">Guardar metas</button><button class="btn ghost" type="button" data-action="cancel-targets">Cancelar</button><button class="btn ghost" type="button" data-action="reset-targets" data-arm="Confirmar: volver a las de fábrica">Volver a las de fábrica</button></div>
    </form>`;
  }

  const kpi = (label, value, foot) => `<div class="kpi"><div class="label">${label}</div><div class="value num">${value}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;

  // ─── Embudo ─────────────────────────────────────────────────
  function funnelHtml(f, u, { compact, unitId } = {}) {
    const steps = C.funnelSteps(f);
    const max = Math.max(1, steps[0].value);
    return `<div class="funnel" role="list" aria-label="Embudo de ${esc(u.name)}">${steps.map((s, i) => {
      const w = Math.max(0.6, (s.value / max) * 100);
      const conv = i > 0 && s.ofPrev !== null ? `<div class="fconv" aria-hidden="true"><span></span><span>↳ ${pct(s.ofPrev)} del paso anterior${i > 1 && s.ofContacted !== null ? ` · ${pct(s.ofContacted)} de contactados` : ''}${i > 1 && f.contactados < 30 && !compact ? ' <span class="chip warn">Muestra chica</span>' : ''}</span></div>` : '';
      const tag = compact ? 'div' : 'button';
      return `${conv}<${tag} ${compact ? '' : `type="button" data-drill-stage="${s.key}"`} class="fstep" role="listitem" aria-label="${esc(s.label)}: ${int(s.value)}" style="--c:${color(u)}"><span class="name">${esc(s.label)}</span><span class="track"><span class="bar" style="width:${w}%"></span></span><span class="val num">${int(s.value)}</span></${tag}>`;
    }).join('')}</div>`;
  }

  /** La demo personal por versión (Turnia): cuál convierte mejor de «abrieron» a «hablaron con Sofi». */
  function demoVersionsHtml(u, accounts) {
    const vs = C.demoVersions(accounts, u);
    if (!vs) return '';
    const best = vs.filter((v) => v.abrieron >= 15).sort((a, b) => b.rate - a.rate)[0];
    return `<section class="card glass" data-testid="demo-versions"><div class="card-head"><div><h2>La demo, por versión</h2><p class="sub">Cada persona va a la versión de su primera apertura. Se compara <strong>abrieron → hablaron con Sofi</strong>: «empezaron» (tocar «Probar la demo» o la esfera) no significa lo mismo en las dos. Con menos de 15 aperturas, una persona mueve mucho el porcentaje.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Versión</th><th class="n">Abrieron</th><th class="n">Empezaron</th><th class="n">Hablaron con Sofi</th><th>Abrieron → hablaron</th></tr></thead><tbody>
      ${vs.map((v) => `<tr><td><strong>${esc(v.label)}</strong> <span class="sub">· ${esc(v.when)}</span><div class="sub">${esc(v.steps)}</div></td><td class="n">${int(v.abrieron)}</td><td class="n">${int(v.empezaron)}</td><td class="n">${int(v.hablaron)}</td><td>${pct(v.rate)}${v.abrieron && v.abrieron < 15 ? ' <span class="chip warn">Muestra chica</span>' : best && best.key === v.key && vs.length > 1 ? ' <span class="chip">Mejor</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }

  function renderFunnelView(id) {
    const u = unitOf(id);
    const d = state.data[id];
    const range = periodRange();
    const list = scoped(id);
    const f = C.funnel(list, u, { range });
    const dim = state.breakdownDim[id] || u.dims[0][0];
    const rows = C.breakdown(list, u, dim, { range }).slice(0, 14);
    const maxC = Math.max(1, ...rows.map((r) => r.contactados));
    const dayRange = state.period === 'all' ? { from: C.addDays(C.today(), -29), to: C.today() } : range;
    const series = C.daily(d.events.filter((e) => list.some((a) => a.id === e.id)), list, u, dayRange);
    const replied = f.contactados ? f.respondieron / f.contactados : null;
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Embudo</span><h1>${int(f.contactados)} contactados, ${int(f.respondieron)} respondieron</h1><p>${esc(u.icp)}</p></div>${periodSeg()}</section>
      ${crumbs(id)}
      <section class="card glass" data-testid="target-card"><div class="card-head"><div><h2>Embudo contra la meta</h2><p class="sub">Saludos: ${int(withTargets(u).targets[0].perWeek)} por semana. Cada paso, la conversión esperada sobre el anterior. Lo de la planilla es la cohorte contactada en el período; lo de la app, el mismo período desde su <code>/api/metricas</code>.${d.targets && d.targets.by ? ` Metas ajustadas por ${esc(d.targets.by)}.` : ''}</p></div>${state.editingTargets === id ? '' : '<button class="btn small" type="button" data-action="edit-targets" data-testid="edit-targets">Editar metas</button>'}</div>${state.editingTargets === id ? targetsForm(id) : targetHtml(u, list)}</section>
      ${demoVersionsHtml(u, scoped(id))}
      <section class="card glass"><div class="kpis">
        ${kpi('Prospectados', int(f.prospectados), `${int(f.porContactar)} por contactar con canal`)}
        ${kpi('Contactados', int(f.contactados), state.period === 'all' ? 'Histórico' : 'Primer contacto en el período')}
        ${kpi('Respondieron', pct(replied), f.maduros < 30 ? `n=${int(f.contactados)} · muestra chica` : `${int(f.respondieron)} de ${int(f.contactados)}`)}
        ${kpi('Interesados', int(f.interesados), 'Interés explícito registrado')}
        ${kpi('Reunión o demo', int(f.reuniones), '')}
        ${kpi('Clientes', int(f.clientes), '')}
        ${kpi('En observación', int(f.enObservacion), `Contactados hace menos de ${u.window} días`)}
        ${u.id === 'turnia' ? kpi('Abrieron · probaron su demo', `${int(f.abrieronDemo)} · ${int(f.probaronDemo)}`, d.signals && d.signals.matched ? `Señales de ${int(d.signals.matched)} cuentas de la app` : 'Desde la planilla') : ''}
      </div></section>
      <div class="grid cols-2">
        <section class="card glass"><div class="card-head"><div><h2>Embudo</h2><p class="sub">Cada etapa incluye a las siguientes. Tocá una etapa para ver esas cuentas.</p></div></div>${funnelHtml(f, u, { unitId: id })}
          <p class="sub" style="margin-top:12px">${int(f.perdidos)} no interesados · ${int(f.invalidos)} con número incorrecto · ${int(f.bajas)} bajas</p></section>
        <section class="card glass"><div class="card-head"><div><h2>Después del contacto</h2><p class="sub">Lo que pasa en el producto, desde la app de ${esc(u.name)} (${state.period === 'all' ? 'histórico' : 'mismo período'}).</p></div><a class="btn small" href="/${esc(u.dashboardHash)}">Ver en el tablero</a></div>${productStrip(u, { title: '' })}</section>
      </div>
      <section class="card glass"><div class="card-head"><div><h2>Ritmo diario</h2><p class="sub">Contactos confirmados por día contra la meta de ${int(u.dailyGoal)}${state.period === 'all' ? ' (últimos 30 días)' : ''}.</p></div></div>${barsChart(series, u)}</section>
      <section class="card glass"><div class="card-head"><div><h2>Por segmento</h2><p class="sub">Tocá una fila para mirar solo ese segmento en todo el panel.</p></div>
        <div class="chips" role="group" aria-label="Agrupar por">${u.dims.map(([k, l]) => `<button type="button" class="btn small" data-dim="${k}" aria-pressed="${dim === k}">${esc(l)}</button>`).join('')}</div></div>
        <div class="table-wrap"><table><thead><tr><th>${esc((u.dims.find(([k]) => k === dim) || [, ''])[1])}</th><th class="n">Prospectados</th><th class="n">Contactados</th><th>Respondieron</th><th class="n">Interesados</th><th class="n">Reuniones</th><th class="n">Clientes</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="click" data-drill-dim="${esc(dim)}" data-drill-value="${esc(r.value)}" tabindex="0"><td><strong>${esc(r.value)}</strong></td><td class="n">${int(r.prospectados)}</td><td class="n"><span class="minibar" style="width:${Math.round((r.contactados / maxC) * 60)}px;--accent:${color(u)};opacity:.45"></span> ${int(r.contactados)}</td><td class="num">${pct(r.contactados ? r.respondieron / r.contactados : null)} <span class="sub">(${int(r.respondieron)})</span>${r.contactados && r.contactados < 30 ? ' <span class="chip warn" title="Menos de 30 contactados">n<30</span>' : ''}</td><td class="n">${int(r.interesados)}</td><td class="n">${int(r.reuniones)}</td><td class="n">${int(r.clientes)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sin datos para agrupar.</td></tr>'}
        </tbody></table></div></section>`;
  }

  // ─── Gráficos (SVG propio, con tooltip) ─────────────────────
  // El SVG se dibuja al ancho real: así el texto de los ejes no se agranda ni se achica.
  const chartWidth = () => Math.max(300, Math.min(1200, main.clientWidth - 44));
  function fillDays(rows, from, to) {
    const by = new Map(rows.map((r) => [r.date, r]));
    const out = [];
    for (let d = from; d <= to; d = C.addDays(d, 1)) out.push(by.get(d) || { date: d, contactos: 0, nuevos: 0, respuestas: 0 });
    return out;
  }
  function scale(max) {
    const raw = Math.max(1, max) / 4;
    const p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
    return { step, top: step * 4 };
  }
  function barsChart(rows, u) {
    const r = periodRange();
    const pts = fillDays(rows, r.from || C.addDays(C.today(), -29), r.to || C.today());
    const W = chartWidth(); const H = 220; const L = 34; const B = 24; const T = 10;
    const { step, top } = scale(Math.max(u.dailyGoal, ...pts.map((p) => p.contactos)));
    const bw = (W - L) / pts.length;
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const grid = [0, 1, 2, 3, 4].map((i) => `<line class="gridline" x1="${L}" x2="${W}" y1="${y(step * i)}" y2="${y(step * i)}"/><text class="axis" x="${L - 6}" y="${y(step * i) + 4}" text-anchor="end">${int(step * i)}</text>`).join('');
    const bars = pts.map((p, i) => {
      const h = Math.max(p.contactos ? 2 : 0, (H - T - B) * (p.contactos / top));
      const x = L + i * bw + Math.min(2, bw * 0.15);
      const wpx = Math.max(1, bw - Math.min(4, bw * 0.3));
      return `<rect class="col" style="--i:${i}" x="${x}" y="${H - B - h}" width="${wpx}" height="${h}" rx="${Math.min(4, wpx / 2)}" fill="${color(u)}"/><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-tip="${esc(JSON.stringify({ t: shortDay(p.date), v: `${int(p.contactos)} contactos`, e: `${int(p.nuevos || 0)} nuevos · ${int(p.respuestas || 0)} respuestas` }))}"/>`;
    }).join('');
    const every = Math.ceil(pts.length / 8);
    const labels = pts.map((p, i) => (i % every === 0 ? `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${shortDay(p.date)}</text>` : '')).join('');
    const goal = `<line x1="${L}" x2="${W}" y1="${y(u.dailyGoal)}" y2="${y(u.dailyGoal)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/><text class="axis" x="${W}" y="${y(u.dailyGoal) - 5}" text-anchor="end">Meta ${int(u.dailyGoal)}</text>`;
    return `<div class="chart" role="img" aria-label="Contactos por día de ${esc(u.name)}"><svg viewBox="0 0 ${W} ${H}">${grid}<line class="baseline" x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}"/>${bars}${goal}${labels}</svg></div>
      <div class="legend"><span><i style="background:${color(u)}"></i>Contactos confirmados</span><span><i class="line"></i>Meta diaria</span></div>`;
  }
  function linesChart(series) {
    if (!series.length) return '<p class="empty">Sin datos todavía.</p>';
    const r = periodRange();
    const from = r.from || C.addDays(C.today(), -29);
    const to = r.to || C.today();
    const filled = series.map((s) => ({ u: s.u, pts: fillDays(s.rows, from, to) }));
    const n = filled[0].pts.length;
    const W = chartWidth(); const H = 220; const L = 34; const B = 24; const T = 10;
    const { step, top } = scale(Math.max(...filled.flatMap((s) => s.pts.map((p) => p.contactos))));
    const x = (i) => L + (n === 1 ? (W - L) / 2 : (i * (W - L - 8)) / (n - 1));
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const grid = [0, 1, 2, 3, 4].map((i) => `<line class="gridline" x1="${L}" x2="${W}" y1="${y(step * i)}" y2="${y(step * i)}"/><text class="axis" x="${L - 6}" y="${y(step * i) + 4}" text-anchor="end">${int(step * i)}</text>`).join('');
    const lines = filled.map((s) => `<polyline fill="none" stroke="${color(s.u)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.pts.map((p, i) => `${x(i)},${y(p.contactos)}`).join(' ')}"/>`).join('');
    const ends = filled.map((s) => { const p = s.pts[n - 1]; return `<circle cx="${x(n - 1)}" cy="${y(p.contactos)}" r="4" fill="${color(s.u)}" stroke="var(--glass-strong)" stroke-width="2"/>`; }).join('');
    const hits = filled[0].pts.map((p, i) => `<rect x="${x(i) - (W - L) / n / 2}" y="${T}" width="${(W - L) / n}" height="${H - T - B}" fill="transparent" data-tip="${esc(JSON.stringify({ t: shortDay(p.date), v: filled.map((s) => `${s.u.name}: ${int(s.pts[i].contactos)}`).join(' · ') }))}"/>`).join('');
    const every = Math.ceil(n / 8);
    const labels = filled[0].pts.map((p, i) => (i % every === 0 ? `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${shortDay(p.date)}</text>` : '')).join('');
    return `<div class="chart" role="img" aria-label="Contactos por día por unidad"><svg viewBox="0 0 ${W} ${H}">${grid}<line class="baseline" x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}"/>${lines}${ends}${hits}${labels}</svg></div>
      <div class="legend">${filled.map((s) => `<span><i style="background:${color(s.u)}"></i>${esc(s.u.name)} · ${int(s.pts.reduce((a, p) => a + p.contactos, 0))} en el período</span>`).join('')}</div>`;
  }
  function bindCharts() {
    const tip = $('#tip');
    main.querySelectorAll('[data-tip]').forEach((el) => {
      el.addEventListener('pointerenter', () => {
        const d = JSON.parse(el.dataset.tip);
        tip.innerHTML = `<strong>${esc(d.t)}</strong>${esc(d.v)}${d.e ? `<br><span class="sub">${esc(d.e)}</span>` : ''}`;
        tip.hidden = false;
      });
      el.addEventListener('pointermove', (e) => {
        tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
        tip.style.top = `${e.clientY - tip.offsetHeight - 12}px`;
      });
      el.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  // ─── Hoy ────────────────────────────────────────────────────
  function renderToday(id) {
    const u = unitOf(id);
    const d = state.data[id];
    const q = C.queue(scoped(id), u, { events: d.events });
    const folds = store(`folds-${id}`) || {};
    const ratio = Math.min(1, q.doneToday / q.goal);
    const R = 27; const circ = 2 * Math.PI * R;
    const block = (key, title, sub, list, { open = true, all = false } = {}) => {
      const isOpen = folds[key] === undefined ? open : folds[key];
      const cap = all || state.more[key] ? list.length : 15;
      return `<section class="card glass block" data-open="${isOpen}" aria-label="${esc(title)}">
        <button type="button" class="block-head" data-fold="${key}" aria-expanded="${isOpen}"><div><h3>${esc(title)} <span class="count num" style="vertical-align:1px">${list.length}</span></h3><p class="sub">${sub}</p></div><span class="chev">${icon.chev}</span></button>
        <div class="rows">${list.length ? list.slice(0, cap).map((a) => accountRow(a, u, key)).join('') + (list.length > cap ? `<div style="text-align:center;padding:6px"><button class="btn small" type="button" data-more-block="${key}">Ver los ${int(list.length - 15)} restantes</button></div>` : '') : `<p class="empty">${key === 'fresh' && q.freshTotal === 0 ? (u.api && !u.api.rows ? `No quedan ${esc(u.entity.many)} nuevos con WhatsApp (los que faltan son fijos o comparten un número que ya usaste). Importá la próxima lista en <a href="${esc(u.appUrl)}/importar" target="_blank" rel="noopener">${esc(u.appName)} → Importar lista</a>.` : `No quedan ${esc(u.entity.many)} nuevos con canal (los que faltan no tienen WhatsApp verificado o comparten un número ya usado): sumá una lista a la planilla.`) : 'Nada por acá.'}</p>`}</div></section>`;
    };
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Hoy</span><h1>${q.doneToday >= q.goal ? '¡Meta del día cumplida!' : `Te faltan ${int(q.goal - q.doneToday)} contactos nuevos`}</h1><p>${esc(u.hours)}</p></div>
        <div class="progress"><svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${int(q.doneToday)} de ${int(q.goal)} contactos hoy"><circle class="bg" cx="32" cy="32" r="${R}"/><circle class="fg" style="--c0:${circ}" cx="32" cy="32" r="${R}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - ratio)}" transform="rotate(-90 32 32)"/></svg><div><div class="num" style="font-size:24px;font-weight:700">${int(q.doneToday)}<span class="sub"> / ${int(q.goal)}</span></div><div class="sub">contactos nuevos hoy</div></div></div></section>
      ${crumbs(id)}
      ${replyCount(id) ? `<div class="notice glass" data-testid="hoy-responder"><span class="badge live">Responder</span><span>${int(replyCount(id))} ${replyCount(id) === 1 ? 'espera' : 'esperan'} respuesta: el último mensaje es de ellos. En Responder está lo que escribió cada uno y el texto para contestarle.</span><button class="btn small primary" type="button" data-view="responder">Abrir Responder</button></div>` : ''}
      ${block('conversations', 'Conversaciones abiertas', 'Respondieron o están interesados: contestá primero.', q.conversations, { all: true })}
      ${u.greetingFirst ? block('greeted', 'Esperan la demo', 'Los saludaste. Si te respondieron, mandales la demo.', q.greeted, { open: false }) : ''}
      ${block('followUps', 'Seguimientos de hoy', 'Les escribiste y no respondieron. Arriba, quienes abrieron o probaron su demo.', q.followUps)}
      ${block('fresh', 'Nuevos para hoy', `Por prioridad hasta la meta del día. Quedan ${int(q.freshTotal)} con canal.`, q.fresh)}`;
  }

  function stagePill(a, u) {
    if (a.botOnly) return '<span class="stage" title="Figura como «Respondió», pero lo único que llegó es la respuesta automática del consultorio">Solo respuesta automática</span>';
    const lvl = C.level(a);
    return `<span class="stage ${C.closed(a) ? 'closed' : ''}" style="--o:${0.35 + Math.max(0, lvl) * 0.13}">${esc(u.stageLabel(a.stage))}</span>`;
  }
  // Los que pagan anuncios: de los más calientes (Turnia lo anota en «Señales»).
  function adBadges(a, lead = '') {
    return `${a.googleAds ? `${lead}<span class="signal" title="Paga anuncios en Google: de los más calientes">Google Ads</span>` : ''}${a.metaAds ? `${lead}<span class="signal" title="Paga anuncios en Instagram o Facebook: de los más calientes">Meta Ads</span>` : ''}`;
  }
  function signals(a) {
    return `${a.demoTried ? '<span class="signal">Probó la demo</span>' : a.demoOpened ? '<span class="signal">Abrió la demo</span>' : ''}${adBadges(a)}`;
  }

  function accountRow(a, u, block) {
    const next = C.nextTemplate(a, u);
    const tpl = next && templatesOf(u.id)[next.key];
    const text = next && tpl && next.channel === 'whatsapp' ? C.renderTemplate(tpl.text, a, u) : '';
    let action = '';
    if (isReadOnly(u.id)) return accountRowHtml(a, u, `<a class="btn small" href="${esc(u.appUrl)}" target="_blank" rel="noopener">${icon.ext} Panel</a>`, { block, text });
    // «Ya lo mandé»: registra el envío hecho directo desde WhatsApp, sin pasar por la cola (dos toques).
    const manual = (kind, key) => `<button type="button" class="btn small ghost" data-manual-sent="${esc(a.id)}" data-manual-kind="${kind}" data-key="${esc(key || '')}" data-arm="Confirmar: ya lo mandé" data-testid="manual-sent" title="Lo mandaste directo desde WhatsApp: registralo sin abrir nada">✓ Ya lo mandé</button>`;
    if (block === 'conversations') action = a.phone ? `<button type="button" class="btn small" data-chat="${esc(a.id)}">${icon.wa} Abrir chat</button>${manual('conversation')}` : '';
    else if (next && tpl && (next.channel === 'whatsapp' || next.channel === 'email' || next.channel === 'instagram')) {
      action = `<button type="button" class="btn small primary" data-testid="send-next" data-send="${esc(a.id)}" data-key="${esc(next.key)}">${next.channel === 'email' ? icon.mail : next.channel === 'instagram' ? icon.ig : icon.wa} ${esc(tpl.title)}</button>${next.channel === 'whatsapp' ? manual('sent', next.key) : ''}`;
    }
    return accountRowHtml(a, u, action, { block, text });
  }
  /** Los datos de una cuenta para un agente, en atributos: así no hay que abrir la ficha para sacar el teléfono. */
  function rowData(a, u, { state: st = '', text = '' } = {}) {
    const digits = C.waDigits(a.phone);
    const first = String(text || '').split(/\n[ \t]*-{3,}[ \t]*\n/)[0].trim();
    return ` data-phone="${esc(digits)}" data-wa-url="${esc(digits ? C.waWebLink(a.phone, first) : '')}" data-demo-url="${esc((u.demoLink && u.demoLink(a)) || '')}" data-state="${esc(st)}" data-line="${esc((a.whatsappSenders || []).join(' '))}"`;
  }
  function sharedNote(a, u) {
    const d = state.data[u.id];
    const mates = d && d.accounts ? C.sharedWith(a, d.accounts) : [];
    return mates.length ? `<span class="signal" data-testid="shared-phone" title="Es un solo chat: se le escribe una vez">Mismo número que ${esc(mates.map((x) => x.name).slice(0, 2).join(', '))}${mates.length > 2 ? '…' : ''}</span>` : '';
  }
  function accountRowHtml(a, u, action, { block = '', text = '' } = {}) {
    const lines = a.whatsappSenders || [];
    return `<div class="arow" data-testid="queue-item" data-account-id="${esc(a.id)}" data-open-account="${esc(a.id)}"${rowData(a, u, { state: block, text })} tabindex="0" role="button" aria-label="Abrir la ficha de ${esc(a.name)}">
      <div class="who"><strong>${esc(a.name)}</strong><div class="meta">${a.org && a.org !== a.name ? `<span>${esc(a.org)}</span>·` : ''}<span>${esc(a.zone || 'Sin zona')}</span>${a.priority && a.priority <= 5 ? `<span>· P${a.priority}</span>` : ''}${stagePill(a, u)}${C.isContacted(a) ? `<span title="Mensajes de la secuencia usados">${int(a.touches || 0)}/${u.maxTouches || 3} msj.</span>` : ''}${lines.map((l) => `<span class="badge plain" title="Chat en la línea ${esc(l)}">${esc(l)}</span>`).join('')}${a.lastContact ? `<span>últ. ${esc(when(a.lastContact))}</span>` : ''}${signals(a)}${sharedNote(a, u)}</div></div>
      <div class="acts">${action}</div></div>`;
  }

  // ─── Enviar (uno por vez; pensado también para un agente de IA) ─
  // Una sola tarjeta en un lugar fijo: quién, a qué número, qué texto y qué botón tocar. El estado
  // está en data-state y cada botón tiene su data-testid, para que un agente con computer use
  // (una extensión del navegador que alterna con la pestaña de WhatsApp) lo opere sin adivinar.
  function agentSkipped(id) {
    try { return new Set(JSON.parse(sessionStorage.getItem(`cl-pr-skip-${id}`) || '[]')); } catch { return new Set(); }
  }
  function skipAgent(accountId) {
    const set = agentSkipped(state.unit);
    set.add(accountId);
    try { sessionStorage.setItem(`cl-pr-skip-${state.unit}`, JSON.stringify([...set])); } catch { /* sin storage */ }
  }
  // Horas desde una fecha «AAAA-MM-DD HH:MM» de Buenos Aires.
  const hoursSince = (at) => (Date.parse(`${C.nowLocal().replace(' ', 'T')}:00Z`) - Date.parse(`${String(at).replace(' ', 'T')}:00Z`)) / 3600000;
  function sendQueue(id) {
    const u = unitOf(id);
    const d = state.data[id];
    const q = C.queue(scoped(id), u, { events: d.events });
    const wa = (a) => { const n = C.nextTemplate(a, u); return a.phone && C.canMessage(a, u) && n && n.channel === 'whatsapp'; };
    const senderOptions = id === 'turnia' ? d.whatsappSenderOptions : null;
    const selected = store('send-whatsapp-line');
    const sender = senderOptions && (selected === 'unknown' || senderOptions.includes(selected)) ? selected : 'all';
    const replied = id === 'turnia'
      ? q.conversations.filter((a) => a.stage === 'respondio' && !a.touches && a.greetingSent
        && a.lastReply > (a.permissionSent || a.greetingSent) && wa(a))
      : [];
    const items = [
      ...replied.map((a) => ({ a, step: a.permissionSent ? 'Respondió al Paso 2' : 'Respondió al saludo', check: true })),
      ...q.followUps.filter(wa).map((a) => ({ a, step: 'Seguimiento' })),
      // Turnia: después del Paso 2, el Seguimiento 1 espera 24 horas si no respondió (C.nowLocal es la hora de Buenos Aires).
      ...q.greeted.filter((a) => a.phone && !(a.permissionSent && !(a.lastReply > a.permissionSent) && hoursSince(a.permissionSent) < 24))
        .map((a) => ({ a, step: a.permissionSent ? 'Paso 2 enviado' : 'Saludado', check: true })),
      ...q.fresh.filter(wa).map((a) => ({ a, step: 'Nuevo', fresh: true })),
    ].filter(({ a }) => sender === 'all' || (sender === 'unknown' ? !a.whatsappSenders?.length : a.whatsappSenders?.includes(sender)));
    // Un número compartido, una sola vez en toda la sesión (no se le manda doble al mismo celular).
    const phones = new Set();
    const unique = items.filter(({ a }) => { const k = C.phoneKey(a.phone); if (!k) return true; if (phones.has(k)) return false; phones.add(k); return true; });
    const skipped = agentSkipped(id);
    return { q, sender, senderOptions, items: [...unique.filter((x) => !skipped.has(x.a.id)), ...unique.filter((x) => skipped.has(x.a.id))] };
  }

  function agentInstructions(u) {
    return [
      `Sos quien manda los mensajes de prospección de ${u.name} por WhatsApp Web. Trabajás con dos pestañas: este panel (${location.origin}/prospecting/${u.id}?vista=enviar) y WhatsApp Web, que el panel abre siempre en la misma pestaña.`,
      'Repetí, de a uno:',
      '1. En el panel, leé la tarjeta (data-testid="agent"): nombre (agent-name), teléfono (agent-phone) y el mensaje exacto (agent-message). Mirá data-state: solo seguís si dice "ready" o "check". Si dice "opened", ya se abrió WhatsApp para esa persona: andá al paso 4.',
      '2. Si data-state="check" (le mandamos el saludo o el Paso 2): tocá «Abrir chat» (agent-open-chat), fijate en WhatsApp si la persona respondió. Si respondió, volvé y tocá el botón principal (agent-replied). Si no, «Todavía no» (agent-skip).',
      '3. Tocá «Abrir WhatsApp» (agent-open-whatsapp): se abre WhatsApp Web en una pestaña nueva con el chat y el texto ya escritos (tarda unos segundos en cargar). Comprobá que el chat sea del mismo número y que el texto sea igual al de la tarjeta. Tocá Enviar una sola vez y esperá el tilde.',
      '4. Cerrá esa pestaña de WhatsApp (que no se acumulen: WhatsApp Web no deja que el panel la reutilice), volvé al panel y tocá «Sí, se envió» (agent-confirm-sent) solo si viste el mensaje enviado. Si no salió, «No salió» (agent-not-sent). Si WhatsApp dice que el número no es válido o no tiene WhatsApp, «No tiene WhatsApp» (agent-no-whatsapp).',
      'Si preferís una sola pestaña fija de WhatsApp: en vez de «Abrir WhatsApp», tocalo igual (marca el envío como abierto) y cerrá la pestaña nueva, o navegá tu pestaña de WhatsApp al link de data-wa-url de la tarjeta.',
      '5. Esperá a que el panel habilite el siguiente (data-state="wait" muestra la cuenta regresiva) y volvé al paso 1.',
      'Nunca: cambies el texto, respondas o converses con nadie, mandes dos veces, toques otro botón del panel, ni mandes si data-state es "paused", "done" o "stopped".',
      'Pará y avisá si: WhatsApp muestra un aviso de restricción o de cuenta bloqueada, el número o el nombre no coinciden, aparece un error, o el panel dice que pares.',
    ].join('\n');
  }

  /** La demo del mensaje que le toca es la de esta cuenta (no la de otro consultorio). */
  function demoOk(a, id) {
    const u = unitOf(id);
    const next = a && C.nextTemplate(a, u);
    const tpl = next && templatesOf(id)[next.key];
    return C.demoCheck(a, u, state.data[id].accounts, tpl ? C.renderTemplate(tpl.text, a, u) : '');
  }
  function renderSend(id) {
    const u = unitOf(id);
    const { q, items, sender, senderOptions } = sendQueue(id);
    const pending = state.pending && state.pending.inline ? state.pending : storedPending();
    const cur = pending ? (items.find((x) => x.a.id === pending.id) || { a: findAccount(pending.id), step: 'En curso' }) : items[0];
    const nextAt = store(`next-${id}`) || 0;
    const wait = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
    const ro = isReadOnly(id);
    let phase;
    let status;
    if (ro) { phase = 'paused'; status = `Solo lectura: falta la clave de la API de ${u.name}.`; }
    else if (pending && cur && cur.a) { phase = 'opened'; status = '¿Salió el mensaje? Confirmá antes de seguir.'; }
    else if (!cur || !cur.a) {
      phase = 'done';
      status = sender !== 'all' ? 'No hay contactos en la cola para este filtro.'
        : q.freshTotal ? 'No queda nadie para hoy. Pará.' : `No queda nadie para hoy y no hay ${esc(u.entity.many)} nuevos con WhatsApp: hay que sumar otra lista. Pará.`;
    }
    else if (state.agent.fails >= 3) { phase = 'stopped'; status = 'Pará: tres envíos seguidos no salieron. Revisá WhatsApp (¿restricción, sesión cerrada?).'; }
    else if (!demoOk(cur.a, id).ok) { phase = 'stopped'; status = `Pará: ${demoOk(cur.a, id).problem} Corregí el link en su ficha o tocá «Saltar».`; }
    else if (cur.fresh && q.doneToday >= q.goal) { phase = 'done'; status = `Meta del día cumplida (${int(q.doneToday)} de ${int(q.goal)}). Pará.`; }
    else if (!C.inSendWindow(u) && store(`override-${id}`) !== C.today()) { phase = 'paused'; status = `Fuera del horario de envío (${esc(u.hours)}). Próxima franja: ${esc(C.nextSendWindow(u))}.`; }
    else if (cur.check && state.agent.replied !== cur.a.id) {
      phase = 'check';
      status = cur.a.permissionSent
        ? 'Le mandamos el Paso 2: mirá si respondió. Si dijo que sí, va el Paso 3 con la demo; si pasaron 24 horas sin respuesta, el Seguimiento 1.'
        : 'Le mandamos el saludo: mirá si respondió antes de mandar el Paso 2.';
    }
    else if (wait > 0) { phase = 'wait'; status = `Ritmo seguro: esperá ${wait} s para el próximo.`; }
    else { phase = 'ready'; status = 'Listo para enviar.'; }

    const a = cur && cur.a;
    const next = a ? (pending ? { key: pending.key } : C.nextTemplate(a, u)) : null;
    const tpl = next && templatesOf(id)[next.key];
    const text = a && tpl ? C.renderTemplate(tpl.text, a, u) : '';
    // «---» separa dos mensajes (el Seguimiento 3 de Turnia): el chat se abre con el primero y el segundo se copia aparte.
    const parts = text.split(/\n[ \t]*-{3,}[ \t]*\n/).map((t) => t.trim()).filter(Boolean);
    const digits = a ? C.waDigits(a.phone) : '';
    const senderLabel = a?.whatsappSenders?.length ? a.whatsappSenders.join(' y ') : 'Sin línea verificada';
    const kinds = { celular: 'celular de la persona', compartido: 'del consultorio u oficina', fijo: 'fijo', revisar: 'por revisar' };
    const btn = (testid, label, attrs = '', cls = '') => `<button type="button" class="btn ${cls}" data-testid="${testid}" ${attrs}>${label}</button>`;
    let actions = '';
    if (a && phase === 'check') actions = btn('agent-open-chat', `${icon.wa} Abrir chat`, `data-agent="chat"`) + btn('agent-replied', cur.a.permissionSent ? 'Mandar la demo' : 'Respondió: mandar el Paso 2', `data-agent="replied"`, 'primary') + btn('agent-skip', 'Todavía no', `data-agent="skip"`, 'ghost');
    else if (a && phase === 'opened') actions = btn('agent-confirm-sent', 'Sí, se envió', `data-agent="sent"`, 'primary') + btn('agent-not-sent', 'No salió', `data-agent="not-sent"`, 'ghost') + btn('agent-no-whatsapp', 'No tiene WhatsApp', `data-agent="no-wa"`, 'ghost danger');
    else if (a && phase === 'stopped' && state.agent.fails < 3) actions = btn('agent-skip', 'Saltar', `data-agent="skip"`, 'ghost');
    else if (a && (phase === 'ready' || phase === 'wait' || phase === 'paused')) actions = btn('agent-open-whatsapp', `${icon.wa} Abrir WhatsApp`, `data-agent="open" ${phase === 'ready' ? '' : 'disabled'}`, 'primary') + btn('agent-skip', 'Saltar', `data-agent="skip"`, 'ghost') + btn('agent-no-whatsapp', 'No tiene WhatsApp', `data-agent="no-wa"`, 'ghost danger');
    const R = 27; const circ = 2 * Math.PI * R; const ratio = Math.min(1, q.doneToday / q.goal);
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Enviar</span><h1>Uno por vez</h1><p>Una tarjeta, un mensaje, una confirmación. Sirve igual para una persona o para un agente de IA que alterna con la pestaña de WhatsApp. ${esc(u.hours)}</p></div>
        <div class="progress"><svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${int(q.doneToday)} de ${int(q.goal)} contactos nuevos hoy"><circle class="bg" cx="32" cy="32" r="${R}"/><circle class="fg" style="--c0:${circ}" cx="32" cy="32" r="${R}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - ratio)}" transform="rotate(-90 32 32)"/></svg><div><div class="num" style="font-size:24px;font-weight:700">${int(q.doneToday)}<span class="sub"> / ${int(q.goal)}</span></div><div class="sub">nuevos hoy · ${int(items.length)} en la cola</div></div></div></section>
      ${senderOptions ? `<section class="card glass" aria-label="Filtro por línea de WhatsApp">
        <label class="field">WhatsApp desde el que se escribió
          <select data-send-whatsapp-line ${pending ? 'disabled' : ''}>
            ${[['all', 'Todas las líneas'], ...senderOptions.map((ending) => [ending, ending === '0022' ? '0022 · Personal' : ending === '5483' ? '5483 · Business' : ending]), ['unknown', 'Sin línea verificada']]
              .map(([value, label]) => `<option value="${esc(value)}" ${value === sender ? 'selected' : ''}>${esc(label)}</option>`).join('')}
          </select>
        </label>
        <p class="sub">${sender === 'all' || sender === 'unknown' ? 'Antes de enviar, verificá qué cuenta está abierta en WhatsApp.' : `Antes de enviar, verificá que esté abierta la cuenta terminada en ${esc(sender)}.`}</p>
      </section>` : ''}
      <section id="agent" class="card glass strong agent" data-testid="agent" data-state="${phase}" data-account-id="${esc(a ? a.id : '')}" data-phone="${esc(digits)}" data-demo-url="${esc(a ? u.demoLink(a) || '' : '')}" data-line="${esc(a && a.whatsappSenders ? a.whatsappSenders.join(' ') : '')}" data-expected-name="${esc(a ? a.name : '')}" data-template="${esc(next ? next.key : '')}" data-wa-url="${esc(a && text ? C.waWebLink(a.phone, parts[0] || text) : '')}" aria-labelledby="agent-name">
        <p class="agent-status ${phase}" role="status" aria-live="polite" data-testid="agent-status">${status}${phase === 'paused' && !ro && a ? ` <button type="button" class="btn small ghost" data-testid="agent-override-hours" data-agent="override" data-arm="Confirmar: mandar fuera de horario">Mandar igual</button>` : ''}</p>
        ${a ? `
        <div class="agent-grid">
          <div>
            <span class="eyebrow">${esc(cur.step)}${tpl ? ` · ${esc(tpl.title)}` : ''}</span>
            <h2 id="agent-name" data-testid="agent-name">${esc(a.name)}</h2>
            <p class="sub" style="margin:2px 0 10px">${esc([a.org !== a.name ? a.org : '', a.zone].filter(Boolean).join(' · '))}</p>
            <dl class="facts">
              <dt>WhatsApp</dt><dd><strong data-testid="agent-phone">+${esc(digits)}</strong>${a.phoneKind ? ` <span class="sub">(${esc(kinds[a.phoneKind] || a.phoneKind)})</span>` : ''}</dd>
              ${senderOptions ? `<dt>Línea registrada</dt><dd>${esc(senderLabel)}</dd>` : ''}
              ${C.sharedWith(a, state.data[id].accounts).length ? `<dt>Comparte el número</dt><dd data-testid="agent-shared">con ${esc(C.sharedWith(a, state.data[id].accounts).map((x) => x.name).join(', '))}: es un solo chat, se le escribe una vez</dd>` : ''}
              ${a.touches ? `<dt>Mensajes</dt><dd>${int(a.touches)} de ${u.maxTouches}</dd>` : ''}
              ${a.lastContact ? `<dt>Último</dt><dd>${esc(when(a.lastContact))}</dd>` : ''}
            </dl>
            ${signals(a) ? `<p style="margin:8px 0 0">${signals(a)}</p>` : ''}
          </div>
          <div>
            <span class="eyebrow">${phase === 'check' ? 'Lo que se manda si respondió' : 'Mensaje exacto'}</span>
            <pre class="tpl" data-testid="agent-message">${esc(parts[0] || text)}</pre>
            ${parts.slice(1).map((part, i) => `<span class="eyebrow">Mensaje ${i + 2}, aparte (para reenviar)</span><pre class="tpl" data-testid="agent-message-${i + 2}">${esc(part)}</pre><button type="button" class="btn small" data-copy-text="${esc(part)}">${icon.copy} Copiar el mensaje ${i + 2}</button>`).join('')}
          </div>
        </div>
        <div class="btns agent-actions">${actions}</div>` : ''}
      </section>
      <section class="card glass">
        <details><summary><strong>Instrucciones para el agente de IA</strong> <span class="sub">· para pegar en la extensión (por ejemplo, Claude en Chrome)</span></summary>
          <pre class="tpl" data-testid="agent-instructions" style="margin-top:10px">${esc(agentInstructions(u))}</pre>
          <div class="btns"><button class="btn small" type="button" data-action="copy-instructions">${icon.copy} Copiar instrucciones</button></div>
        </details>
      </section>
      <section class="card glass"><div class="card-head"><div><h2>Después</h2><p class="sub">${id === 'turnia' ? 'Primero, las respuestas al saludo o al Paso 2. ' : ''}Luego, seguimientos, saludos por revisar y nuevos hasta la meta. Los saltados van al final.</p></div></div>
        <div class="rows">${items.slice(cur && items[0] && items[0].a.id === (a && a.id) ? 1 : 0, 9).map((x) => `<div class="arow" data-open-account="${esc(x.a.id)}" tabindex="0" role="button"><div class="who"><strong>${esc(x.a.name)}</strong><div class="meta"><span>${esc(x.step)}</span>·<span>${esc(x.a.zone || '')}</span>${signals(x.a)}</div></div></div>`).join('') || '<p class="empty">Nadie más por ahora.</p>'}</div>
      </section>`;
  }

  // ─── Responder (la bandeja: quienes escribieron último) ─────
  // Las respuestas llegan cuando llegan y cada una necesita un texto distinto: cada fila trae lo que escribió,
  // la respuesta sugerida ya armada y todo lo que hace falta para abrir el chat sin buscarlo a ciegas
  // (data-phone, data-line, data-wa-url, data-demo-url, data-state). Se atiende en cualquier orden.
  const lineName = (l) => (l === '0022' ? '0022 · Personal' : l === '5483' ? '5483 · Business' : l);
  function lineOptions(id) { const d = state.data[id]; return (d && d.whatsappSenderOptions) || []; }
  function openLine(id) { const v = store(`open-line-${id}`); return lineOptions(id).includes(v) ? v : ''; }

  // habita.: las respuestas abiertas de su bandeja (Follow-up), por cuenta. En el ejemplo, las del fixture.
  function bandejaReplies(id) {
    const d = state.data[id];
    const raw = state.demo ? d.inboxReplies || [] : (state.fu.raw && state.fu.raw.units && state.fu.raw.units[id] && state.fu.raw.units[id].inbox) || [];
    const map = new Map();
    const extra = [];
    const key = (s) => C.norm(s).replace(/[^a-z0-9]+/g, ' ').trim();
    for (const r of raw) {
      const a = d.accounts.find((x) => x.id === r.agency_id)
        || (r.phone && d.accounts.find((x) => C.phoneKey(x.phone) && C.phoneKey(x.phone) === C.phoneKey(r.phone)))
        || (r.name && d.accounts.find((x) => key(x.org || x.name) === key(r.name) || key(x.name) === key(r.name)));
      const item = { id: r.id, at: r.received_at, text: r.body, classification: r.classification || null };
      const target = a || { id: `bandeja-${r.id}`, name: r.name || 'Sin nombre', phone: r.phone || '', stage: 'respondio', touches: 0, orphan: true };
      if (!a) extra.push(target);
      if (!map.has(target.id)) map.set(target.id, []);
      map.get(target.id).push(item);
    }
    return { map, extra };
  }
  function inboxOf(id) {
    const u = unitOf(id);
    const d = state.data[id];
    if (!d || !d.accounts) return { rows: [], bots: [] };
    if (u.inbox === 'bandeja') {
      const { map, extra } = bandejaReplies(id);
      return C.inbox([...d.accounts, ...extra], u, { replies: map });
    }
    return C.inbox(d.accounts, u);
  }
  function replyCount(id) { try { return inboxOf(id).rows.length; } catch { return 0; } }

  /** Las respuestas posibles para una fila: la sugerida primero, después los pasos de la secuencia y las demás. */
  function replyOptions(row, id) {
    const u = unitOf(id);
    const tpls = templatesOf(id);
    const a = row.a;
    const out = [];
    const add = (o) => { if (o && !out.some((x) => x.key === o.key)) out.push(o); };
    const fromTemplate = (key, extra = {}) => tpls[key] && { key, title: tpls[key].title, text: C.renderTemplate(tpls[key].text, a, u), register: { type: 'sent', template: key }, ...extra };
    const fromReply = (r) => {
      if (!r) return null;
      if (r.template) return fromTemplate(r.template, { title: r.title, register: { type: 'conversation', detail: r.title }, then: r.key === 'negativo' ? { type: 'outcome', outcome: 'perdido' } : null, classification: r.classification });
      return { key: r.key, title: r.title, text: C.renderTemplate(r.text || '', a, u), register: { type: 'conversation', detail: r.title }, classification: r.classification || null, then: null };
    };
    const plan = C.replyPlan(a, row.inbound, u);
    if (plan) {
      const o = plan.template ? fromTemplate(plan.template) : fromReply(plan.reply);
      if (o) { o.register = plan.register || o.register; o.then = plan.then || o.then || null; if (o.then && o.then.outcome === 'perdido' && !o.then.detail) o.then.detail = String(row.inbound.text || '').slice(0, 200); o.suggested = true; add(o); }
    }
    if (u.id === 'turnia' && !a.touches) ['whatsapp_permiso', 'whatsapp_permiso_turno', 'whatsapp_entrega'].forEach((k) => add(fromTemplate(k)));
    for (const r of u.replies || []) add(fromReply(r));
    if (u.id === 'turnia') add(fromTemplate('whatsapp_feedback', { register: { type: 'conversation', detail: 'Feedback de no interesados' }, then: { type: 'outcome', outcome: 'perdido', detail: String(row.inbound.text || '').slice(0, 200) } }));
    return out.filter((o) => o.text);
  }

  /** Todo lo de una fila, armado una vez: lo usan la vista, los botones y los atributos para el agente. */
  function replyView(row, id) {
    const u = unitOf(id);
    const d = state.data[id];
    const a = row.a;
    const options = replyOptions(row, id);
    state.replyPick = state.replyPick || {};
    const picked = options.find((o) => o.key === state.replyPick[`${id}:${a.id}`]) || options[0] || null;
    const text = picked ? picked.text : '';
    const parts = text.split(/\n[ \t]*-{3,}[ \t]*\n/).map((s) => s.trim()).filter(Boolean);
    const open = openLine(id);
    const lineOk = !open || !row.lines.length || row.lines.includes(open);
    const demo = C.demoCheck(a, u, d.accounts, text);
    const digits = C.waDigits(a.phone);
    return { row, a, options, picked, text, parts, open, lineOk, demo, digits, waUrl: digits ? C.waWebLink(a.phone, parts[0] || text) : '', demoUrl: (u.demoLink && u.demoLink(a)) || '' };
  }

  function renderResponder(id) {
    const u = unitOf(id);
    const d = state.data[id];
    if (u.inbox === 'bandeja' && !state.demo && !state.fu.n && !state.fu.loading && !state.fu.error) setTimeout(() => loadFollowup({ quiet: true }), 0);
    const { rows, bots } = inboxOf(id);
    const opts = lineOptions(id);
    const open = openLine(id);
    const views = rows.map((r) => replyView(r, id));
    // Primero los de la línea abierta en WhatsApp Web; adentro, de la que espera hace más a la más nueva.
    views.sort((x, y) => Number(y.lineOk) - Number(x.lineOk));
    const noText = rows.filter((r) => !r.inbound.text).length;
    const other = views.filter((v) => !v.lineOk).length;
    const ro = isReadOnly(id);
    const waitingSince = rows[0] ? when(rows[0].inbound.at) : '';
    const source = u.inbox === 'bandeja'
      ? `Las respuestas abiertas en la bandeja de ${esc(u.appName)} (las registra su extensión de WhatsApp o el equipo).`
      : `Lo que leyó la lectura de WhatsApp${d.whatsappReadAt ? ` (${esc(when(d.whatsappReadAt))})` : ''} y las respuestas cargadas a mano.`;
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Responder</span><h1>${rows.length ? `${int(rows.length)} ${rows.length === 1 ? 'espera' : 'esperan'} respuesta` : 'No hay nadie esperando respuesta'}</h1><p>Quienes escribieron último, en cualquier orden. ${source}${waitingSince ? ` La más vieja es de ${esc(waitingSince)}.` : ''}</p></div>
        <div class="btns">${u.inbox !== 'bandeja' && !state.demo ? `<button class="btn" type="button" data-action="resp-sync" ${state.respSync ? 'disabled' : ''}>${state.respSync ? 'Leyendo los chats…' : 'Leer WhatsApp ahora'}</button>` : ''}${u.inbox === 'bandeja' && !state.demo ? `<button class="btn" type="button" data-action="resp-reload">Actualizar</button>` : ''}</div></section>
      ${opts.length ? `<section class="card glass" aria-label="Línea abierta en WhatsApp Web">
        <div class="toolbar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0"><span class="sub">Línea abierta en WhatsApp Web:</span>
          <div class="seg" role="group" aria-label="Línea abierta">${[['', 'No sé'], ...opts.map((l) => [l, lineName(l)])].map(([v, l]) => `<button type="button" data-open-line="${esc(v)}" aria-pressed="${open === v}" data-testid="open-line-${esc(v || 'none')}">${esc(l)}</button>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>
          ${open ? `<span class="sub">${other ? `${int(other)} están en la otra línea: van al final, marcadas.` : 'Todas son de esta línea.'}</span>` : '<span class="sub">Elegila y el panel marca qué chats no están en esa cuenta.</span>'}</div></section>` : ''}
      <section class="card glass" aria-label="Resumen"><div class="kpis">
        ${kpi('Esperan respuesta', int(rows.length), 'El último mensaje es de ellos')}
        ${kpi('Respuestas automáticas', int(bots.length), 'Bots del consultorio: no cuentan')}
        ${opts.length ? kpi('En la otra línea', open ? int(other) : '—', open ? `No están en la ${esc(open)}` : 'Elegí la línea abierta') : ''}
        ${kpi('Sin texto', int(noText), u.inbox === 'bandeja' ? 'Sin el texto de la respuesta' : 'Respondieron por una línea que no se lee')}
      </div></section>
      <div class="replies" data-testid="reply-list">${views.map((v) => replyRowHtml(v, id)).join('') || '<section class="card glass"><p class="empty">Nadie espera respuesta. Las nuevas aparecen con la próxima lectura (o con «Leer WhatsApp ahora»).</p></section>'}</div>
      ${bots.length ? `<details class="card glass" data-testid="reply-bots"><summary><strong>Respuestas automáticas</strong> <span class="count num">${bots.length}</span> <span class="sub">· el bot del consultorio contestó, no una persona: no cuentan como «Respondió» y no se contestan.</span></summary>
        <div class="rows">${bots.map((r) => `<div class="arow" data-testid="reply-bot" data-account-id="${esc(r.a.id)}" data-state="bot" data-phone="${esc(C.waDigits(r.a.phone))}" data-line="${esc(r.lines.join(' '))}" data-open-account="${esc(r.a.orphan ? '' : r.a.id)}" tabindex="0" role="button"><div class="who"><strong>${esc(r.a.name)}</strong><div class="meta"><span>${esc(when(r.inbound.at))}</span>${r.lines.map((l) => `<span class="badge plain">${esc(l)}</span>`).join('')}</div><div class="meta" style="white-space:pre-wrap">«${esc(r.inbound.text)}»</div></div></div>`).join('')}</div>
        <p class="sub" style="margin:8px 0 0">${u.inbox === 'bandeja' ? 'Siguen en la bandeja de habita.: clasificalas ahí.' : 'La próxima lectura de WhatsApp las corrige sola en Turnia (vuelven a «Contactado» con su seguimiento).'}</p></details>` : ''}
      <section class="card glass">
        <details><summary><strong>Instrucciones para el agente de IA · Responder</strong> <span class="sub">· distintas de las de Enviar: acá se contesta en cualquier orden</span></summary>
          <pre class="tpl" data-testid="reply-instructions" style="margin-top:10px">${esc(replyInstructions(u))}</pre>
          <div class="btns"><button class="btn small" type="button" data-action="copy-reply-instructions">${icon.copy} Copiar instrucciones</button></div>
        </details>
      </section>`;
  }

  function replyRowHtml(v, id) {
    const u = unitOf(id);
    const { a, row } = v;
    const inb = row.inbound;
    const by = { whatsapp: `leído de WhatsApp${inb.line ? ` · ${inb.line}` : ''}`, manual: `cargado a mano${inb.by ? ` por ${inb.by}` : ''}`, bandeja: `bandeja de ${u.appName}`, panel: 'marcado en el panel' }[inb.source] || '';
    const ro = isReadOnly(id) || a.orphan && u.inbox !== 'bandeja';
    const k = `${id}:${a.id}`;
    const max = u.maxTouches || 3;
    return `<article class="card glass reply" data-testid="reply-item" data-unit="${esc(id)}" data-account-id="${esc(a.id)}" data-phone="${esc(v.digits)}" data-wa-url="${esc(v.waUrl)}" data-demo-url="${esc(v.demoUrl)}" data-state="${inb.text ? 'responder' : 'sin-texto'}" data-line="${esc(row.lines.join(' '))}" data-line-ok="${v.lineOk}" data-template="${esc(v.picked ? v.picked.key : '')}" data-demo-ok="${v.demo.ok}"${inb.replyId ? ` data-reply-id="${esc(inb.replyId)}"` : ''}>
      <div class="reply-head">
        <div class="who"><strong data-testid="reply-name">${esc(a.name)}</strong>${a.org && a.org !== a.name ? ` <span class="sub">${esc(a.org)}</span>` : ''}
          <div class="meta"><strong class="num" data-testid="reply-phone">${v.digits ? `+${esc(v.digits)}` : 'Sin teléfono'}</strong>${row.lines.length ? row.lines.map((l) => `<span class="badge ${v.open && l === v.open ? 'live' : 'plain'}" title="Chat en la línea ${esc(lineName(l))}">${esc(l)}</span>`).join('') : (lineOptions(id).length ? '<span class="badge off" title="No sabemos en qué línea está el chat">Línea sin verificar</span>' : '')}${a.stage ? stagePill(a, u) : ''}<span title="Mensajes de la secuencia usados">${int(a.touches || 0)}/${max} msj.</span><span>escribió ${esc(when(inb.at))}</span></div></div>
        <div class="acts">${a.orphan ? '' : `<button class="btn small ghost" type="button" data-open-account="${esc(a.id)}">Ficha</button>`}</div>
      </div>
      <blockquote class="said" data-testid="reply-last-message">${inb.text ? `«${esc(inb.text)}»` : `<span class="sub">${u.inbox === 'bandeja' ? 'Sin el texto de la respuesta.' : 'Sin texto: respondió por una línea que no se lee (mirá el chat antes de contestar).'}</span>`}</blockquote>
      <p class="sub" style="margin:0">${esc(by)}</p>
      ${row.shared && row.shared.length ? `<p class="notice-line" data-testid="reply-shared">Mismo número que ${esc(row.shared.join(', '))}: es un solo chat, contestá una vez.</p>` : ''}
      ${!v.lineOk ? `<p class="notice-line" data-testid="reply-wrong-line">Este chat está en la ${esc(row.lines.join(' y '))}, no en la ${esc(v.open)} que tenés abierta: cambiá de cuenta en WhatsApp Web antes de contestar.</p>` : ''}
      ${!v.demo.ok ? `<p class="notice-line bad" data-testid="reply-demo-problem">${esc(v.demo.problem)} No lo mandes así.</p>` : v.demo.slug && /\{link\}|https?:/.test(v.text) ? `<p class="sub" style="margin:0" data-testid="reply-demo-ok">✓ La demo del mensaje es la de esta cuenta${u.demoIsCode ? ` (/p/${esc(v.demo.slug)})` : ''}.</p>` : ''}
      ${v.picked ? `<div class="reply-body">
        <label class="field">${v.picked.suggested ? 'Respuesta sugerida (podés elegir otra)' : 'Respuesta'}<select data-reply-pick="${esc(k)}" data-testid="reply-pick">${v.options.map((o) => `<option value="${esc(o.key)}" ${o.key === v.picked.key ? 'selected' : ''}>${esc(o.title)}${o.suggested ? ' · sugerida' : ''}</option>`).join('')}</select></label>
        ${v.parts.map((p, i) => `${v.parts.length > 1 ? `<span class="eyebrow">Mensaje ${i + 1} de ${v.parts.length}</span>` : ''}<pre class="tpl" data-testid="${i ? `reply-message-${i + 1}` : 'reply-message'}">${esc(p)}</pre>`).join('')}
        <div class="btns">
          ${v.parts.map((p, i) => `<button class="btn small" type="button" data-copy-text="${esc(p)}" data-testid="${i ? `reply-copy-${i + 1}` : 'reply-copy'}">${icon.copy} Copiar${v.parts.length > 1 ? ` el ${i + 1}` : ''}</button>`).join('')}
          ${v.waUrl ? `<button class="btn small" type="button" data-reply-open="${esc(k)}" data-testid="reply-open">${icon.wa} Abrir chat</button>` : ''}
          ${ro ? '' : `<button class="btn small primary" type="button" data-reply-sent="${esc(k)}" data-testid="reply-sent" data-arm="Confirmar: ya lo mandé" ${v.demo.ok ? '' : 'disabled'}>✓ Ya lo mandé</button>
          <button class="btn small ghost" type="button" data-reply-refer="${esc(k)}" data-testid="reply-refer">Derivó a otro número</button>`}
        </div>
        ${state.referOpen === k ? `<form class="btns" data-refer-form="${esc(k)}" data-testid="reply-refer-form" style="align-items:flex-end"><label class="field" style="flex:1 1 150px">Número nuevo<input name="phone" required inputmode="tel" placeholder="223 555-1234" value="${esc((String(inb.text || '').match(/(\+?54\s?9?\s?)?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4}/) || [''])[0])}"></label><label class="field" style="flex:1 1 150px">De quién<input name="name" placeholder="Dra. Pérez (opcional)"></label><button class="btn small primary" type="submit">Guardar en esta cuenta</button></form><p class="sub" style="margin:0">Queda en la misma cuenta${u.demoIsCode ? ', con la misma demo' : ''}: no hace falta crear otra ficha.</p>` : ''}
      </div>` : ''}
    </article>`;
  }

  function replyInstructions(u) {
    const lines = u.id === 'turnia';
    return [
      `Sos quien contesta por WhatsApp Web a los ${u.entity.many} de ${u.name} que respondieron. Trabajás con dos pestañas: este panel (${location.origin}/prospecting/${u.id}?vista=responder) y WhatsApp Web.`,
      'Las respuestas llegan cuando llegan: no hay cola ni turno. Podés tomar cualquier fila de la lista (data-testid="reply-item"), en el orden que quieras, y el panel no te habilita la siguiente: cuando registrás una, desaparece.',
      `Cada fila trae todo resuelto en sus atributos: data-phone (el número con 549, solo dígitos)${lines ? ', data-line (la línea donde está el chat: 0022 o 5483) y data-line-ok' : ''}, data-wa-url, data-demo-url, data-demo-ok, data-template y data-state. Lo que escribió la persona está en reply-last-message y el texto exacto para mandar, en reply-message.`,
      'Para cada fila:',
      lines ? '1. Línea. Elegí en el panel la «Línea abierta en WhatsApp Web» (la cuenta que ves en WhatsApp Web). Contestá solo las filas con data-line-ok="true". Las de la otra línea van al final: cuando termines, cambiá de cuenta en WhatsApp Web, cambiá la línea en el panel y seguí.' : '1. Mirá que WhatsApp Web tenga abierta la cuenta del equipo de prospección.',
      '2. Abrí el chat con la búsqueda de WhatsApp Web (los clics simulados por código no funcionan: usá clics reales):',
      '   a. Clic en el buscador de chats («Buscar un chat o iniciar uno nuevo», arriba a la izquierda).',
      '   b. Escribí los últimos 10 números de data-phone (sin 549) y esperá el resultado.',
      '   c. Clic en el resultado. Si no aparece, abrí data-wa-url en la pestaña de WhatsApp Web (abre el chat directo). No crees un chat nuevo con otro número.',
      '3. Verificá antes de escribir:',
      '   - El número del chat termina en los mismos 10 números que data-phone. Si el chat muestra un nombre, mirá el número en la info del contacto.',
      '   - Lo último del chat es lo de reply-last-message. Si hay algo más nuevo, o si reply-last-message dice «Sin texto», leé el chat y elegí la respuesta que corresponda en «Respuesta» (reply-pick). Si ninguna corresponde, salteá la fila y avisá.',
      '   - Si la fila dice «Mismo número que…» (reply-shared), es un solo chat: contestás una vez.',
      '   - Si data-demo-ok="false" (reply-demo-problem), no lo mandes: el link es de otra cuenta. Avisá.',
      '4. Escribí: tocá «Copiar» (reply-copy) en el panel, pegá en el cuadro del chat y comprobá que quedó igual a reply-message. Enviá una sola vez y esperá el tilde. Si hay dos mensajes (reply-message y reply-message-2), mandá cada uno aparte, en ese orden.',
      '5. Registrá en el panel: «Ya lo mandé» (reply-sent) y otra vez para confirmar. Si pasaron el número de otra persona, después de contestar tocá «Derivó a otro número» (reply-refer), cargá el número y guardá.',
      '6. Elegí otra fila y repetí.',
      'Nunca: escribas sin verificar el número, cambies el texto a mano, contestes las «Respuestas automáticas» (son bots), mandes dos veces o registres algo que no salió.',
      'Pará y avisá si: WhatsApp muestra un aviso de restricción o de cuenta bloqueada, el número no coincide, alguien pide que no le escriban más (marcalo en su ficha: «Pidió no recibir más») o aparece un error.',
    ].join('\n');
  }

  /** Registrar una fila de Responder: el paso de la secuencia, la respuesta de conversación o, en habita., la clasificación. */
  async function replySent(id, accountId) {
    const u = unitOf(id);
    const row = inboxOf(id).rows.find((r) => r.a.id === accountId);
    if (!row) { toast('Esa respuesta ya no está en la lista.', true); render(); return; }
    const v = replyView(row, id);
    if (!v.picked) return;
    if (!v.demo.ok) { toast(v.demo.problem, true); return; }
    if (u.inbox === 'bandeja') {
      if (state.demo) { toast('En el ejemplo no se cambia nada.', true); return; }
      if (!row.inbound.replyId) { toast('No encontramos la respuesta en la bandeja.', true); return; }
      const r = await fuOp(id, { op: 'reply', id: row.inbound.replyId, clasificacion: v.picked.classification || 'neutro' }, { label: `Listo: ${v.picked.title}` });
      if (r) { await loadFollowup({ quiet: true }); render(); }
      return;
    }
    const line = v.open || (row.lines.length === 1 ? row.lines[0] : '');
    const reg = { ...v.picked.register, channel: 'whatsapp', ...(line ? { line } : {}) };
    if (reg.type === 'sent') reg.kind = /abridor/.test(reg.template) ? 'saludo' : 'mensaje';
    const res = await act(accountId, reg, { label: `Registrado: ${v.picked.title}` });
    if (res && v.picked.then) await act(accountId, v.picked.then, { label: `Marcado: ${u.stageLabel(v.picked.then.outcome)}` });
  }

  /** «Ya lo mandé»: un envío hecho directo desde WhatsApp (sin abrir nada desde el panel), con la línea abierta. */
  async function manualSent(accountId, kind, key) {
    const id = state.unit;
    const u = unitOf(id);
    const a = findAccount(accountId);
    if (!a) return;
    const line = openLine(id) || ((a.whatsappSenders || []).length === 1 ? a.whatsappSenders[0] : '');
    let action;
    if (kind === 'conversation') {
      action = u.inbox === 'bandeja' ? { type: 'note', text: 'Le respondimos por WhatsApp (a mano)' } : { type: 'conversation', channel: 'whatsapp', ...(line ? { line } : {}) };
    } else {
      const tpl = templatesOf(id)[key];
      const check = C.demoCheck(a, u, state.data[id].accounts, tpl ? C.renderTemplate(tpl.text, a, u) : '');
      if (!check.ok) { toast(check.problem, true); return; }
      const next = C.nextTemplate(a, u);
      action = { type: 'sent', channel: 'whatsapp', template: key, kind: /abridor/.test(key || '') ? 'saludo' : (next && next.key === key ? next.kind : 'mensaje'), ...(line ? { line } : {}) };
    }
    await act(accountId, action, { label: kind === 'conversation' ? 'Registrado: le respondiste' : `Registrado: ${(templatesOf(id)[key] || {}).title || 'mensaje'}`, undoable: kind !== 'conversation' && u.inbox !== 'bandeja' });
  }

  // ─── Buscador global (arriba): cualquier cuenta de cualquier unidad, esté o no en la cola del día ─
  // Por nombre, consultorio o inmobiliaria, código (el slug de la demo, «perez-a1b») o teléfono (alcanzan los
  // últimos 3 o más números, sin importar espacios ni el 549). Cada resultado abre su ficha.
  function globalSearch(q) {
    const text = C.norm(q).trim();
    const digits = String(q || '').replace(/\D+/g, '');
    if (text.length < 2 && digits.length < 3) return [];
    const out = [];
    for (const u of units()) {
      const d = state.data[u.id];
      if (!d || !d.accounts) continue;
      for (const a of d.accounts) {
        const slug = (u.demoSlug && u.demoSlug((u.demoLink && u.demoLink(a)) || '')) || '';
        const phone = String(a.phone || '').replace(/\D+/g, '');
        let score = 0;
        if (text && (C.norm(a.id) === text || C.norm(slug) === text)) score = 4;
        else if (digits.length >= 3 && phone && (phone.endsWith(digits) || (digits.length >= 6 && C.waDigits(a.phone).includes(digits.replace(/^0+/, ''))))) score = 3;
        else if (text && C.norm(`${a.name} ${a.org}`).includes(text)) score = 2;
        else if (text && C.norm(`${a.id} ${slug} ${a.zone} ${a.email} ${a.instagram}`).includes(text)) score = 1;
        if (score) out.push({ u, a, slug, score });
      }
    }
    return out.sort((x, y) => y.score - x.score || String(x.a.name).localeCompare(String(y.a.name))).slice(0, 12);
  }
  function renderGlobalResults() {
    const box = $('#gresults');
    const input = $('#gsearch');
    if (!box || !input) return;
    const q = input.value;
    const res = globalSearch(q);
    const loading = units().some((u) => !state.data[u.id] || state.data[u.id].loading);
    if (!q.trim()) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    box.innerHTML = res.length ? res.map(({ u, a, slug }, i) => `<button type="button" class="gresult" role="option" data-gresult="${esc(a.id)}" data-gunit="${esc(u.id)}" data-testid="global-result" data-account-id="${esc(a.id)}" data-phone="${esc(C.waDigits(a.phone))}" data-unit="${esc(u.id)}" ${i === 0 ? 'aria-selected="true"' : ''}>
        <span class="dot" style="--c:${color(u)}"></span><span class="gr-main"><strong>${esc(a.name)}</strong><span class="sub">${esc([a.org !== a.name ? a.org : '', a.phone, u.demoIsCode && slug ? `/p/${slug}` : ''].filter(Boolean).join(' · '))}</span></span><span class="stage">${esc(u.stageLabel(a.stage))}</span></button>`).join('')
      : `<p class="sub" style="margin:8px">${loading ? 'Cargando las cuentas…' : 'Nadie con ese nombre, teléfono o código.'}</p>`;
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function openFromSearch(unitId, accountId) {
    const box = $('#gresults');
    const input = $('#gsearch');
    if (box) box.hidden = true;
    if (input) { input.value = ''; input.setAttribute('aria-expanded', 'false'); }
    if (state.unit !== unitId) go(unitId, UNIT_VIEWS.includes(state.view) ? state.view : 'cuentas');
    openDrawer(accountId);
  }
  $('#gsearch').addEventListener('input', () => { clearTimeout(renderGlobalResults.t); renderGlobalResults.t = setTimeout(renderGlobalResults, 120); });
  $('#gsearch').addEventListener('focus', () => { ensureLoaded(); if ($('#gsearch').value.trim()) renderGlobalResults(); });
  $('#gsearch').addEventListener('keydown', (e) => {
    const box = $('#gresults');
    const items = [...box.querySelectorAll('[data-gresult]')];
    const cur = items.findIndex((x) => x.getAttribute('aria-selected') === 'true');
    if (e.key === 'Escape') { box.hidden = true; e.target.value = ''; return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
      e.preventDefault();
      const next = (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((x, i) => x.setAttribute('aria-selected', String(i === next)));
      items[next].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && items.length) { e.preventDefault(); const it = items[Math.max(0, cur)]; openFromSearch(it.dataset.gunit, it.dataset.gresult); }
  });
  $('#gresults').addEventListener('click', (e) => {
    const it = e.target.closest('[data-gresult]');
    if (it) openFromSearch(it.dataset.gunit, it.dataset.gresult);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.gsearch')) { const b = $('#gresults'); if (b) b.hidden = true; } });

  // ─── Onboarding (posventa: garantías del Programa Fundadores) ─
  // Cada cliente: desde que se cobró el setup, operativo en 14 días (si no, se devuelve el setup) y
  // al menos 50 interacciones en su primer mes operativo (si no, el mes 2 es gratis).
  function onboardingRows(id) {
    const u = unitOf(id);
    const g = u.onboarding;
    const t = C.today();
    const d = state.data[id];
    if (!g || !d || !d.accounts) return [];
    return d.accounts.filter((a) => a.stage === 'cliente' || a.customer || a.clientAt || a.accountAt).map((a) => {
      const start = C.dayOf(a.clientAt || a.customer || a.accountAt);
      const op = C.dayOf(a.operationalAt);
      let g1;
      if (!start) g1 = { state: 'info', text: 'Falta la fecha de cobro (marcalo «Cliente»)' };
      else if (op) {
        const days = C.daysBetween(start, op);
        g1 = days <= g.setupDays ? { state: 'ok', text: `Operativa en ${days} días` } : { state: 'bad', text: `Operativa en ${days} días: corresponde devolver el setup` };
      } else {
        const left = g.setupDays - C.daysBetween(start, t);
        g1 = left < 0 ? { state: 'bad', text: `Vencida hace ${-left} días: corresponde devolver el setup` } : { state: left <= 3 ? 'risk' : 'wait', text: `Faltan ${left} días para que opere` };
      }
      let g2;
      const n = a.firstMonth || 0;
      if (!op) g2 = { state: 'info', text: 'Empieza cuando opere' };
      else {
        const elapsed = C.daysBetween(op, t);
        if (n >= g.firstMonthInteractions) g2 = { state: 'ok', text: `${int(n)} interacciones en el primer mes` };
        else if (elapsed >= 30) g2 = { state: 'bad', text: `${int(n)} de ${g.firstMonthInteractions}: el mes 2 es gratis` };
        else {
          const pace = (n / Math.max(1, elapsed)) * 30;
          g2 = { state: pace < g.firstMonthInteractions ? 'risk' : 'wait', text: `${int(n)} de ${g.firstMonthInteractions} · quedan ${30 - elapsed} días${pace < g.firstMonthInteractions ? ' · a este ritmo no llega' : ''}` };
        }
      }
      return { a, start, op, g1, g2 };
    }).sort((x, y) => ['bad', 'risk', 'wait', 'info', 'ok'].indexOf(x.g1.state) - ['bad', 'risk', 'wait', 'info', 'ok'].indexOf(y.g1.state) || String(y.start).localeCompare(String(x.start)));
  }
  function onboardingAlerts() {
    if (!state.data[state.unit] || !state.data[state.unit].accounts) return 0;
    return onboardingRows(state.unit).filter((r) => [r.g1.state, r.g2.state].some((x) => x === 'bad' || x === 'risk')).length;
  }
  function renderOnboarding(id) {
    const u = unitOf(id);
    const g = u.onboarding;
    const rows = onboardingRows(id);
    const chip = (x) => `<span class="gstate ${x.state}">${{ ok: '✓', bad: '✗', risk: '!', wait: '…', info: '·' }[x.state]} ${esc(x.text)}</span>`;
    const count = (f) => rows.filter(f).length;
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Onboarding</span><h1>Que cada fundador quede andando</h1><p>Posventa, fuera del embudo comercial: desde que se cobra el setup, la clínica tiene que operar en ${g.setupDays} días (si no, se devuelve el setup) y tener al menos ${g.firstMonthInteractions} interacciones en su primer mes (si no, el mes 2 es gratis).</p></div></section>
      <section class="card glass"><div class="kpis">
        ${kpi('Clientes', int(rows.length), 'Setup cobrado o cuenta vinculada')}
        ${kpi('Operativas', int(count((r) => r.op)), `Primera conversación de Sofi`)}
        ${kpi('En riesgo', int(count((r) => r.g1.state === 'risk' || r.g2.state === 'risk')), 'Garantía por vencer')}
        ${kpi('Garantías incumplidas', int(count((r) => r.g1.state === 'bad' || r.g2.state === 'bad')), 'Devolución o mes gratis')}
      </div></section>
      <section class="card glass"><div class="card-head"><div><h2>Clientes</h2><p class="sub">«Cliente desde» es cuando se marcó «Cliente» (setup cobrado); «operativa», la primera conversación de Sofi en su clínica. Vinculá la clínica real en la ficha (sección Cuenta).</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Clínica</th><th>Cliente desde</th><th>Garantía 1 · operativa en ${g.setupDays} días</th><th>Garantía 2 · ${g.firstMonthInteractions} interacciones el primer mes</th></tr></thead><tbody>
          ${rows.map((r) => `<tr class="click" data-open-account="${esc(r.a.id)}" tabindex="0"><td><strong>${esc(r.a.name)}</strong></td><td>${r.a.accountClinic ? esc(r.a.accountClinic) : '<span class="sub">Sin vincular</span>'}${r.a.accountActive ? ' <span class="badge live">Activa</span>' : ''}</td><td>${esc(when(r.start) || '—')}</td><td>${chip(r.g1)}</td><td>${chip(r.g2)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Todavía no hay clientes. Cuando cobres el setup, marcalo «Cliente» en su ficha y vinculá su clínica.</td></tr>`}
        </tbody></table></div></section>`;
  }

  // ─── Cuentas ────────────────────────────────────────────────
  const STAGE_FILTERS = [
    ['all', 'Todas', () => true],
    ['por_contactar', 'Por contactar', (a) => !C.isContacted(a) && !C.closed(a)],
    ['contactados', 'Contactados', (a) => C.isContacted(a)],
    ['respondieron', 'Respondieron', (a) => C.level(a) >= 2],
    ['interesados', 'Interesados', (a) => C.level(a) >= 3],
    ['reuniones', 'Reunión', (a) => C.level(a) >= 4],
    ['clientes', 'Clientes', (a) => C.level(a) >= 5],
    ['cerrados', 'Cerrados', (a) => C.closed(a)],
  ];
  function renderAccounts(id) {
    const u = unitOf(id);
    const f = filt(id);
    const q = C.norm(f.q);
    const test = (STAGE_FILTERS.find(([k]) => k === f.stage) || STAGE_FILTERS[0])[2];
    const list = scoped(id).filter(test).filter((a) => !q || C.norm([a.name, a.org, a.zone, a.phone, a.email, a.sdr, a.campaign].join(' ')).includes(q));
    const shown = list.slice(0, state.shown);
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Cuentas</span><h1>${int(list.length)} ${esc(u.entity.many)}</h1><p>${state.data[id].viaApi && u.api.rows ? `La base de ${esc(u.appName)}: cada cambio se guarda allá, con sus reglas.` : 'La base completa de la planilla. Los cambios se guardan en la misma fila.'}</p></div>
        <div class="btns">${state.data[id].sync ? `<button class="btn" type="button" data-action="sync" title="La planilla alimenta ${esc(u.appName)}: trae las cuentas y los envíos nuevos">Traer la planilla</button>` : ''}${state.data[id].sheet && state.data[id].sheet.url ? `<a class="btn" href="${esc(state.data[id].sheet.url)}" target="_blank" rel="noopener">${icon.ext} Abrir la planilla</a>` : ''}</div></section>
      ${sheetWarnings(id)}
      ${state.data[id].viaApi && !isReadOnly(id) ? bulkCard(id) : ''}
      ${crumbs(id)}
      <section class="card glass">
        <div class="toolbar"><input class="input search" type="search" placeholder="Buscar por nombre, zona, teléfono…" aria-label="Buscar" value="${esc(f.q)}" data-search>
          ${u.dims.slice(0, 3).map(([k, l]) => dimSelect(id, k, l)).join('')}</div>
        <div class="chips" role="group" aria-label="Etapa" style="margin-bottom:10px">${STAGE_FILTERS.map(([k, l]) => `<button type="button" class="btn small" data-stage-filter="${k}" aria-pressed="${f.stage === k}">${l}</button>`).join('')}</div>
        <div class="table-wrap"><table><thead><tr><th>${esc(u.entity.one[0].toUpperCase() + u.entity.one.slice(1))}</th><th>Zona</th><th>Etapa</th><th class="n">Msj.</th><th>Último contacto</th><th>Próximo paso</th></tr></thead><tbody>
          ${shown.map((a) => `<tr class="click" data-open-account="${esc(a.id)}" tabindex="0"><td><strong>${esc(a.name)}</strong>${a.org && a.org !== a.name ? `<div class="sub">${esc(a.org)}</div>` : ''}</td><td>${esc(a.zone)}</td><td>${stagePill(a, u)} ${signals(a)}</td><td class="n">${int(a.touches)}</td><td>${esc(when(a.lastContact))}</td><td>${esc(a.nextStep)}${a.nextAt ? ` <span class="sub">${esc(when(a.nextAt))}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Ninguna cuenta con estos filtros.</td></tr>'}
        </tbody></table></div>
        ${list.length > shown.length ? `<div style="text-align:center;margin-top:12px"><button class="btn" type="button" data-action="more">Ver ${int(Math.min(100, list.length - shown.length))} más</button></div>` : ''}
      </section>`;
  }
  // ─── Envíos hechos fuera del panel (desde el celular), en lote ─────
  const STEP_LABEL = ['saludo', 'demo', 'seguimiento', 'último'];
  const BULK_STATUS = { registrar: 'Falta registrar', 'al-dia': 'Ya está al día', ambigua: 'Hay más de una: elegí', 'no-esta': 'No está en la base', cerrada: 'Cerrada o pidió la baja' };
  function bulkPlan(id) {
    const b = state.bulk;
    const u = unitOf(id);
    return C.planBulk(C.parseBulk(b.text), state.data[id].accounts, u).map((p) => {
      if (p.status !== 'ambigua' || !b.picks[p.line]) return p;
      const a = p.matches.find((m) => m.id === b.picks[p.line]);
      if (!a) return p;
      const steps = C.closed(a) || a.optOut ? [] : p.plan(a);
      return { ...p, account: a, steps, status: C.closed(a) || a.optOut ? 'cerrada' : steps.length ? 'registrar' : 'al-dia' };
    });
  }
  function bulkCard(id) {
    const b = state.bulk;
    if (!b || b.unit !== id) {
      return `<section class="card glass"><div class="card-head"><div><h2>Mensajes mandados desde el celular</h2><p class="sub">Pegá la lista de chats (número, demo, seguimiento) y se registran los pasos que falten en ${esc(unitOf(id).name)}.</p></div><button class="btn small" type="button" data-action="bulk-open" data-testid="bulk-open">Registrar envíos en lote</button></div></section>`;
    }
    const plan = b.reviewed ? bulkPlan(id) : [];
    const todo = plan.filter((p) => p.status === 'registrar');
    const counts = {};
    for (const p of plan) counts[p.status] = (counts[p.status] || 0) + 1;
    const res = b.results || {};
    return `<section class="card glass" data-testid="bulk-card"><div class="card-head"><div><h2>Registrar envíos en lote</h2><p class="sub">Una fila por chat: el número (o el nombre del consultorio si no se ve) y, separados por «|», si se mandó la demo y el seguimiento (Sí/No). Sirve la tabla tal cual. Repetir la misma lista no duplica nada. Quedan con la fecha de hoy.</p></div><button class="btn small ghost" type="button" data-action="bulk-close">Cerrar</button></div>
      <textarea class="input" rows="8" data-bulk-text placeholder="+54 9 223 512-3456 | Sí | Sí&#10;Consultorio Pérez | Sí | No" style="width:100%;font-family:inherit">${esc(b.text)}</textarea>
      <div class="btns" style="margin-top:10px"><button class="btn" type="button" data-action="bulk-review" data-testid="bulk-review">Revisar</button>
        ${todo.length ? `<button class="btn primary" type="button" data-action="bulk-run" data-testid="bulk-run" ${b.running ? 'disabled' : ''}>${b.running ? `Registrando… ${int(b.progress || 0)}/${int(todo.length)}` : `Registrar ${int(todo.length)}`}</button>` : ''}</div>
      ${b.reviewed ? `<p class="sub" style="margin:10px 0">${Object.entries(counts).map(([k, n]) => `${esc(BULK_STATUS[k])}: <strong>${int(n)}</strong>`).join(' · ') || 'No reconocimos ninguna fila.'}</p>
      <div class="table-wrap"><table><thead><tr><th>Chat</th><th>En la base</th><th>Msj.</th><th>Qué se registra</th></tr></thead><tbody>
        ${plan.map((p) => {
          const r = p.account && res[p.account.id];
          const who = p.status === 'ambigua' && !p.account
            ? `<select class="input" data-bulk-pick="${esc(p.line)}" aria-label="Elegí la cuenta"><option value="">Elegí…</option>${p.matches.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}${m.org && m.org !== m.name ? ` · ${esc(m.org)}` : ''}</option>`).join('')}</select>`
            : p.account ? `<strong class="click" data-open-account="${esc(p.account.id)}" tabindex="0" style="text-decoration:underline">${esc(p.account.name)}</strong>${p.account.org && p.account.org !== p.account.name ? `<div class="sub">${esc(p.account.org)}</div>` : ''}` : '<span class="sub">—</span>';
          const what = r ? (r.ok ? '✓ Registrado' : `✕ ${esc(r.error)}`) : p.status === 'registrar' ? esc(p.steps.map((s) => STEP_LABEL[s]).join(' + ')) : esc(BULK_STATUS[p.status]);
          return `<tr><td>${esc(p.phone ? `${p.phone}${p.name ? ` (${p.name})` : ''}` : p.name)}<div class="sub">${p.demo ? 'demo' : 'sin demo'} · ${p.seg ? 'seguimiento' : 'sin seguimiento'}</div></td><td>${who}</td><td class="n">${p.account ? int(p.account.touches) : ''}</td><td>${what}</td></tr>`;
        }).join('')}
      </tbody></table></div>` : ''}
    </section>`;
  }
  async function runBulk(id) {
    const b = state.bulk;
    if (state.demo) { toast('En el ejemplo no se registra nada.', true); return; }
    const todo = bulkPlan(id).filter((p) => p.status === 'registrar');
    const items = [...new Map(todo.map((p) => [p.account.id, { id: p.account.id, actions: p.steps.map((step) => ({ type: 'sent', step, channel: 'whatsapp' })) }])).values()];
    b.running = true;
    b.progress = 0;
    b.results = {};
    render();
    let ok = 0;
    let bad = 0;
    for (let i = 0; i < items.length; i += 20) {
      const chunk = items.slice(i, i + 20);
      try {
        const r = await api('bulk', { method: 'POST', body: { unit: id, items: chunk } });
        for (const x of r.results) {
          b.results[x.id] = x;
          if (x.account) replaceAccount(id, x.account);
          if (x.ok) ok++; else bad++;
        }
      } catch (err) {
        for (const x of chunk) b.results[x.id] = { ok: false, error: err.message };
        bad += chunk.length;
        if (err.status === 401) break;
      }
      b.progress = Math.min(items.length, i + 20);
      render();
    }
    b.running = false;
    render();
    toast(bad ? `Registradas ${ok}; ${bad} con error (revisá la lista).` : `Registradas ${ok} personas.`, Boolean(bad));
    loadUnit(id, { quiet: true }).then(render);
  }
  function dimSelect(id, k, label) {
    const values = [...new Set(state.data[id].accounts.map((a) => dimValue(a, k)))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    const cur = filt(id).dims[k] || '';
    return `<select class="input" data-dim-select="${k}" aria-label="${esc(label)}"><option value="">${esc(label)}: todas</option>${values.slice(0, 80).map((v) => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  }
  function sheetWarnings(id) {
    const s = state.data[id].sheet;
    if (!s || state.demo || isReadOnly(id)) return '';
    if (s.missingTab) return `<div class="notice glass"><strong>La planilla no tiene la pestaña «${esc(s.tab)}».</strong><button class="btn small primary" type="button" data-action="setup">Preparar la planilla</button></div>`;
    if (s.missingColumns && s.missingColumns.length) return `<div class="notice glass"><span>Faltan columnas que el panel completa (${esc(s.missingColumns.join(', '))}). Se agregan solas al primer cambio, o ahora:</span><button class="btn small" type="button" data-action="setup">Preparar la planilla</button></div>`;
    return '';
  }

  // ─── La lista con el embudo de demos (la de /admin/inmobiliarias de habita., tal cual) ─────────────
  // habita. · Inmobiliarias: las filas las calcula habita. y las acciones van por su API.
  // Turnia · Odontólogos: la misma vista armada con sus cuentas; las acciones son las del panel (registrar
  // el envío, la ficha, su demo /p/…). Las reglas de filtros, orden y embudo son las mismas (agencies.js).
  const AG = window.ProspectingAgencies;
  const WA_LOGO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>';
  const STAGE_ICON = { prospect: '◎', contacted: '✉', demo_sent: '➤', interacted: '↗', panel: '▦', call: '☎', client: '✓', closed: '✕' };
  const cfgOf = (id) => (id === 'turnia' ? AG.TURNIA : AG.HABITA);
  const lc = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);
  const fromApi = (id) => unitOf(id).agencies === true;
  state.ag = {};
  state.agf = AG.filtersFrom(new URLSearchParams(location.search), cfgOf((location.pathname.match(/\/prospecting\/(turnia|habita)/) || [])[1]));
  function agUrl() {
    const cfg = cfgOf(state.unit);
    const p = new URLSearchParams({ vista: cfg.slug });
    for (const [k, v] of Object.entries(AG.filtersParams(state.agf, cfg))) if (v) p.set(k, v);
    if (state.demo) p.set('ejemplo', '1');
    return `/prospecting/${state.unit}?${p}`;
  }
  /** Cambia filtros como los links de la lista original: un valor vacío lo quita y la página vuelve a 1. */
  function agSet(change, { push = true } = {}) {
    const cfg = cfgOf(state.unit);
    const cur = AG.filtersParams(state.agf, cfg);
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...cur, pagina: '', ...change })) if (v) next.set(k, v);
    state.agf = AG.filtersFrom(next, cfg);
    state.agMenu = null;
    history[push ? 'pushState' : 'replaceState']({}, '', agUrl());
    render();
  }
  async function loadAgencies(id, { quiet } = {}) {
    if (!fromApi(id)) return;
    if (state.demo) { state.ag[id] = window.ProspectingFixture.agencies(); return; }
    if (!quiet) state.ag[id] = { loading: true };
    try { state.ag[id] = await api('agencies', { query: { unit: id } }); } catch (err) { state.ag[id] = { error: err.message }; }
  }
  function agThumb(id, photo, name) {
    if (!fromApi(id)) return `<span class="ag-thumb is-initials" aria-hidden="true">${esc(String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase())}</span>`;
    if (!photo) return '<span class="ag-thumb" aria-hidden="true">▦</span>';
    if (state.demo) return '<span class="ag-thumb" aria-hidden="true">▦</span>';
    return `<span class="ag-thumb" aria-hidden="true"><img src="/api/prospecting?op=agencyThumb&unit=${esc(id)}&foto=${esc(photo)}&w=120" alt="" loading="lazy"></span>`;
  }
  const agStagePill = (s, cfg) => `<span class="ag-pill ag-stage is-${s}"><i aria-hidden="true">${STAGE_ICON[s]}</i> ${esc(cfg.stageStep[s])}</span>`;
  const accountPill = (s, cfg) => `<span class="ag-pill ag-account is-${s}">${esc(cfg.accountLabel[s])}</span>`;
  /** Los datos de la lista: los de habita. por su API; los de Turnia, de sus cuentas en el panel. */
  function agData(id) {
    if (fromApi(id)) return state.ag[id];
    const d = state.data[id];
    if (!d || !d.accounts) return d;
    const u = unitOf(id);
    return { rows: AG.fromAccounts(d.accounts, { counted: u.counted, closed: C.closed, targets: u.targets }), toReview: [], app: u.appUrl ? new URL(u.appUrl).origin : '' };
  }
  function scorePill(score) {
    if (score === null || score === undefined) return '<span class="ag-pill ag-score is-none" title="Sin visitas externas: las del equipo no cuentan">—</span>';
    return `<span class="ag-pill ag-score ${score >= AG.HOT_SCORE ? 'is-hot' : score >= 40 ? 'is-warm' : 'is-cold'}" title="Lead score: engagement observado, no probabilidad de compra">${int(score)} / 100</span>`;
  }

  function renderAgencies(id) {
    const u = unitOf(id);
    const cfg = cfgOf(id);
    const api_ = fromApi(id);
    const d = agData(id);
    if (!d && api_) { loadAgencies(id).then(render); return '<div class="skeleton"></div><div class="skeleton"></div>'; }
    if (!d || d.loading) return '<div class="skeleton"></div><div class="skeleton"></div>';
    const app = d.app || (u.appUrl ? new URL(u.appUrl).origin : '');
    const head = `<section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · ${esc(cfg.title)}</span><h1>${esc(cfg.title)}</h1><p>${api_ ? `Todas las inmobiliarias, en un solo lugar: prospectos, leads y clientes. La misma lista de ${esc(u.appName)} (Inmobiliarias), con sus datos.` : `Todos los ${esc(cfg.many)}, en un solo lugar, con el embudo de su demo (/p/…) hasta el Cliente Fundador. La misma vista que armó Facu para habita., con los datos de ${esc(u.name)}.`}</p></div>
      <div class="btns">${id === 'turnia' && !state.demo ? '<button class="btn primary" type="button" data-voice-open>🎤 Audios y mensajes</button>' : ''}<button class="btn" type="button" data-action="ag-reload">Actualizar</button>${api_ ? `<a class="btn primary" href="${esc(app)}/admin/inmobiliarias/nueva" target="_blank" rel="noopener">+ Nueva inmobiliaria</a>` : u.appUrl ? `<a class="btn" href="${esc(u.appUrl)}" target="_blank" rel="noopener">${icon.ext} Abrir ${esc(u.appName)}</a>` : ''}</div></section>`;
    if (d.error) return `${head}<section class="card glass"><h2>No pudimos cargar ${esc(api_ ? 'las inmobiliarias' : `los ${cfg.many}`)}</h2><p class="sub">${esc(d.error)}</p><button class="btn" type="button" data-action="ag-reload">Reintentar</button></section>`;
    const f = state.agf;
    const v = AG.view(d.rows, f, cfg);
    const filtering = Boolean(f.account || f.minScore !== null || f.days);
    const isOn = (s, st) => f.step === s && f.stayed === st;
    // Turnia: el segmento elegido (o la pestaña) abre «Audios y mensajes» con su etapa ya elegida.
    const voiceGroup = id !== 'turnia' || state.demo ? null
      : f.step !== null ? (f.stayed ? [null, 'permiso', 'no_abrio', 'abrio', 'hablo'][f.step] || null : null)
      : !f.withDemo && f.stage === 'prospect' ? 'saludo' : !f.withDemo && f.stage === 'closed' ? 'no_interesa' : null;
    const segment = f.step !== null && f.stayed && v.funnel[f.step + 1]
      ? `a los ${int(v.funnel[f.step].count - v.funnel[f.step + 1].count)} que ${lc(cfg.stayed[f.step])}`
      : voiceGroup === 'saludo' ? 'para saludar a los que faltan' : 'con el feedback de no interesados';
    const voiceAction = voiceGroup
      ? `<div class="ag-voice-cta"><button type="button" class="btn primary small" data-voice-open data-voice-group="${voiceGroup}">✉ Enviar mensaje o audio ${esc(segment)}</button><span class="sub">${voiceGroup === 'permiso'
        ? 'Se abre en el Paso 2, con quienes respondieron el saludo. Para mandar la demo, elegí ahí el Paso 3 (respondieron el Paso 2) o el Seguimiento 1 (24 horas sin responderlo).'
        : 'Se abre con esta etapa elegida.'} Turnia arma la lista con quienes se les puede escribir (celular, sin baja, con mensajes disponibles), sin el filtro de fechas.</span></div>`
      : id === 'turnia' && !state.demo && f.step === 0 && f.stayed ? '<p class="sub ag-voice-cta">No respondieron el saludo: la secuencia no les escribe más. Si alguno respondió y no figura, tocá «Leer las respuestas ahora» en «🎤 Audios y mensajes» o marcalo «Respondió» en Turnia, y pasa al Paso 2.</p>'
      : id === 'turnia' && !state.demo && f.step !== null && !f.stayed ? '<p class="sub ag-voice-cta">Para mandar un mensaje, tocá la parte naranja de una barra: los que se quedaron en ese paso.</p>' : '';
    const set = (o) => esc(new URLSearchParams(o).toString());
    const bars = v.funnel.map((x, i) => {
      const last = i === v.funnel.length - 1;
      const went = last ? x.count : v.funnel[i + 1].count;
      const stay = x.count - went;
      const total = x.ofFirst * 100;
      const minPx = (stay > 0 ? 24 : 0) + (went > 0 ? 24 : 0);
      const wentStep = last ? i : i + 1;
      return `<li style="--i:${i}">
        <button type="button" class="ag-f-top${isOn(i, false) ? ' is-on' : ''}" data-ag-set="${set({ paso: isOn(i, false) ? '' : String(i), quedo: '' })}" title="Ver las ${int(x.count)} que llegaron a «${esc(x.label)}»"><strong class="num">${int(x.count)}</strong><small>${i === 0 ? 'Base del período' : x.ofPrevious === null ? '—' : `${x.ofPrevious}% ${cfg.ofPrevious[i]}`}</small></button>
        <div class="ag-f-plot">${x.count ? `<div class="ag-f-col" style="height:max(${total}%, ${minPx}px)">
          ${stay > 0 ? `<button type="button" class="ag-f-seg is-stayed${isOn(i, true) ? ' is-on' : ''}" style="flex-grow:${stay}" data-ag-set="${set({ paso: isOn(i, true) ? '' : String(i), quedo: isOn(i, true) ? '' : '1' })}" aria-label="${int(stay)}: ${esc(lc(cfg.stayed[i]))}. Ver sus ${esc(cfg.many)}">${int(stay)}</button>` : ''}
          ${went > 0 ? `<button type="button" class="ag-f-seg is-went${last ? ' is-last' : ''}${isOn(wentStep, false) ? ' is-on' : ''}" style="flex-grow:${went}" data-ag-set="${set({ paso: isOn(wentStep, false) ? '' : String(wentStep), quedo: '' })}" aria-label="${last ? `${int(went)}: ${esc(lc(cfg.lastNote))}` : `${int(went)} pasaron a «${esc(v.funnel[i + 1].label)}»`}. Ver sus ${esc(cfg.many)}">${int(went)}</button>` : ''}
        </div>` : '<span class="ag-f-zero"></span>'}</div>
        <span class="ag-f-label">${i + 1}. ${esc(x.label)}${last ? `<small class="is-went">${esc(cfg.lastNote)}</small>` : stay > 0 ? `<small>${int(stay)} ${esc(lc(cfg.stayed[i]))}</small>` : '<small>&nbsp;</small>'}</span>
      </li>`;
    }).join('');
    const funnel = `<section class="card glass ag-funnel"><div class="card-head"><div><h2>Funnel de demos</h2><p class="sub">Cada paso cuenta las demos que llegaron hasta ahí. El % compara con el paso anterior.</p></div>
        <div class="ag-period"><span class="sub">${esc(cfg.periodBy)}:</span><div class="seg" role="group" aria-label="Período">${AG.PERIODS.map((p) => `<button type="button" aria-pressed="${f.period.key === p.key}" data-ag-set="${set({ periodo: p.key === 'todo' ? '' : p.key, desde: '', hasta: '' })}">${esc(p.label)}</button>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>
        <form class="ag-range" data-ag-range><label>Desde <input class="input" type="date" name="desde" value="${esc(f.period.from && f.period.key === 'rango' ? f.period.from : '')}"></label><label>Hasta <input class="input" type="date" name="hasta" value="${esc(f.period.to && f.period.key === 'rango' ? f.period.to : '')}"></label><button class="btn small" type="submit">Aplicar</button></form></div></div>
      <ul class="ag-f-legend" aria-hidden="true"><li class="is-went">Pasaron al paso siguiente</li><li class="is-stayed">Se quedaron (para hacer seguimiento)</li></ul>
      <ol class="ag-f-chart">${bars}</ol>
      ${f.step !== null ? voiceAction : ''}
      <p class="sub" style="margin:0">Tocá una parte de una barra para ver sus ${esc(cfg.many)}: lo verde pasó al paso siguiente; lo naranja se quedó ahí. ${esc(cfg.note)}</p></section>`;
    const review = d.toReview && d.toReview.length ? `<section class="card glass"><h2>Cuentas reclamadas para revisar (${int(d.toReview.length)})</h2><ul class="ag-review">${d.toReview.map((a) => `<li><a href="${esc(app)}/admin/inmobiliarias/${esc(a.id)}?pestana=cuenta" target="_blank" rel="noopener">${esc(a.name)}</a> · ${esc(a.claim_email || '')} · <span class="ag-pill ${a.claim_review === 'mismatch' ? 'is-alert' : ''}">${a.claim_review === 'mismatch' ? 'El email no coincide con su web' : 'Email personal'}</span></li>`).join('')}</ul></section>` : '';
    const tabs = [
      `<button type="button" class="btn small" aria-pressed="${!f.stage && !f.withDemo}" data-ag-set="${set({ etapa: '' })}">${esc(cfg.all)} (${int(v.totals.total)})</button>`,
      `<button type="button" class="btn small" aria-pressed="${f.withDemo}" data-ag-set="${set({ etapa: 'con-demo' })}">${esc(cfg.withDemoTab)} (${int(v.withDemos)})</button>`,
      ...cfg.stages.map((s) => `<button type="button" class="btn small" aria-pressed="${!f.withDemo && f.stage === s}" data-ag-set="${set({ etapa: cfg.stageParam[s] })}">${esc(cfg.stageTab[s])} (${int(v.totals.byStage[s])})</button>`),
    ].join('');
    const opt = (val, label, cur) => `<option value="${val}" ${String(cur ?? '') === String(val) ? 'selected' : ''}>${label}</option>`;
    const toolbar = `<section class="card glass ag-toolbar"><div class="chips ag-tabs" role="group" aria-label="Etapa comercial">${tabs}</div>
      <div class="toolbar"><input class="input search" type="search" placeholder="Buscar por nombre o teléfono…" aria-label="Buscar ${esc(cfg.one)} por nombre o teléfono" value="${esc(f.q)}" data-ag-search>
        <details class="ag-filter" ${filtering ? 'open' : ''}><summary class="btn small">Filtrar${filtering ? ' ·' : ''}</summary>
          <form class="ag-filter-form" data-ag-filters>
            <label class="field">${esc(cfg.accountTitle)}<select class="input" name="cuenta">${opt('', 'Todas', f.account && AG.ACCOUNT_PARAM[f.account])}${opt('sin-cuenta', cfg.accountLabel.none, f.account && AG.ACCOUNT_PARAM[f.account])}${opt('registrada', cfg.accountLabel.registered, f.account && AG.ACCOUNT_PARAM[f.account])}${opt('activa', cfg.accountActive, f.account && AG.ACCOUNT_PARAM[f.account])}</select></label>
            ${api_ ? '' : '<!--'}<label class="field">Lead score<select class="input" name="score">${opt('', 'Cualquiera', f.minScore)}${opt(20, '20 o más', f.minScore)}${opt(40, '40 o más', f.minScore)}${opt(60, '60 o más (calientes)', f.minScore)}${opt(80, '80 o más', f.minScore)}</select></label>${api_ ? '' : '-->'}
            <label class="field">Última actividad<select class="input" name="actividad">${opt('', 'Cualquier fecha', f.days)}${opt(7, 'Últimos 7 días', f.days)}${opt(30, 'Últimos 30 días', f.days)}${opt(90, 'Últimos 90 días', f.days)}</select></label>
            <div class="btns">${filtering ? `<button class="btn small ghost" type="button" data-ag-set="${set({ cuenta: '', score: '', actividad: '' })}">Quitar filtros</button>` : ''}<button class="btn small primary" type="submit">Aplicar</button></div>
          </form></details></div></section>`;
    const tabAction = f.step === null ? voiceAction : '';
    const scope = v.periodOn || f.step !== null ? `<p class="ag-scope">${int(v.shown.length)} ${v.shown.length === 1 ? esc(cfg.one) : esc(cfg.many)}${f.step !== null ? (f.stayed ? ` en «${esc(cfg.steps[f.step])}» sin pasar a «${esc(cfg.steps[f.step + 1])}» (${esc(lc(cfg.stayed[f.step]))})` : ` en «${esc(cfg.steps[f.step])}»`) : ' con demos en el período'}${v.periodOn ? ` · ${esc(AG.periodLabel(f.period))} (${int(v.periodDemos)} ${v.periodDemos === 1 ? 'demo' : 'demos'})` : ''} · <button type="button" class="link" data-ag-set="${set({ periodo: '', desde: '', hasta: '', paso: '', quedo: '' })}">Ver ${esc(cfg.all.toLowerCase())}</button></p>` : '';
    const sortHead = (by, label, title) => {
      const on = f.sort.by === by;
      const next = { by, dir: on && f.sort.dir === 'desc' ? 'asc' : 'desc' };
      return `<button type="button" class="ag-sort${on ? ' is-on' : ''}" data-ag-set="${set({ orden: AG.sortParam(next) })}" ${title ? `title="${esc(title)}"` : ''}>${label}<span aria-hidden="true">${on ? (f.sort.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span></button>`;
    };
    const rowsHtml = v.items.map((r) => {
      const base = api_ ? `${app}/admin/inmobiliarias/${r.id}` : '';
      const pv = v.per.get(r.id);
      let demo = '—';
      if ((pv.latest || !api_) && pv.step !== null && pv.count) {
        const editable = api_ ? pv.step <= 1 && r.demos.every((x) => x.step <= 1 && x.id) : pv.step === 0;
        const label = cfg.stepLabel[pv.step];
        const stepEl = editable
          ? `<button type="button" class="ag-step is-step-${pv.step} is-button" data-ag-menu="${esc(r.id)}" aria-expanded="${state.agMenu === r.id}" title="Cambiar el estado de la demo">${esc(label)} ▾</button>`
          : `<span class="ag-step is-step-${pv.step}">${esc(label)}</span>`;
        demo = `<span class="ag-demo">${stepEl}<small>${pv.latest ? esc(AG.shortDay(pv.latest)) : 'sin enviar'}${pv.count > 1 ? ` · ${int(pv.count)} demos` : ''}${r.test ? ' · prueba' : ''}</small></span>`;
      }
      const wa = !api_ ? (u.canMessage(r) ? `<button type="button" class="ag-wa" data-ag-wa-account="${esc(r.id)}" aria-label="Escribir a ${esc(r.name)} por WhatsApp" title="Escribir por WhatsApp: abre el mensaje que le toca y después pregunta si salió">${WA_LOGO}</button>` : `<span class="ag-wa is-off" role="img" aria-label="Sin WhatsApp" title="Sin WhatsApp (fijo o por revisar)">${WA_LOGO}</span>`) : r.wa ? `<button type="button" class="ag-wa" data-ag-wa="${esc(r.wa)}" aria-label="Escribir a ${esc(r.name)} por WhatsApp" title="Escribir por WhatsApp («¡Buenas!»)">${WA_LOGO}</button>` : `<span class="ag-wa is-off" role="img" aria-label="Falta su WhatsApp" title="Falta su WhatsApp: cargalo en «Editar inmobiliaria»">${WA_LOGO}</span>`;
      return `<tr>
        <td class="is-name">${api_ ? `<a class="ag-name" href="${esc(base)}" target="_blank" rel="noopener">` : `<a class="ag-name" href="#" data-open-account="${esc(r.id)}">`}${agThumb(id, r.coverPhotoId, r.name)}<span><strong>${esc(r.name)}</strong>${adBadges(r, ' ')}${!api_ && r.org && r.org !== r.name ? `<small class="sub" style="display:block">${esc(r.org)}</small>` : ''}</span></a></td>
        <td class="is-stage" data-label="Estado">${agStagePill(r.stage, cfg)}</td>
        <td class="is-demo" data-label="Demo">${demo}</td>
        ${api_ ? `<td class="is-account" data-label="Cuenta">${accountPill(AG.accountState(r), cfg)}</td>` : ''}
        ${api_ ? `<td class="n is-props" data-label="Propiedades">${int(r.properties)}</td>` : `<td class="is-phone" data-label="Teléfono">${r.phone ? `<span class="ag-phone" title="${esc(r.zone || '')}">${esc(r.phone)}</span>` : '—'}</td>`}
        <td class="is-score" data-label="${api_ ? 'Lead score' : 'Mensajes'}">${api_ ? scorePill(r.score) : `<span class="ag-msgs"><span class="ag-pill">${int(r.touches)} / ${int(u.maxTouches || 3)}</span>${audioCheck(r, u)}</span>`}</td>
        <td class="is-when" data-label="Actividad">${r.lastActivity ? `<span class="ag-when">${esc(AG.agoText(r.lastActivity.at))}<small>${esc(r.lastActivity.text)}</small></span>` : '—'}</td>
        <td class="is-actions">${wa}
          ${api_ ? `<button type="button" class="ag-chip" data-ag-link="demo" data-id="${esc(r.id)}" ${r.shareDemo ? '' : 'disabled title="Todavía no tiene una demo publicada"'}>🔗 <span>Demo</span></button>
          <button type="button" class="ag-chip" data-ag-link="panel" data-id="${esc(r.id)}">🔑 <span>Panel</span></button>
          <a class="btn small" href="${esc(base)}" target="_blank" rel="noopener">Ver →</a>` : `<button type="button" class="ag-chip" data-ag-copy="${esc(r.demoUrl)}" ${r.demoUrl ? '' : 'disabled title="No tiene demo"'}>🔗 <span>Demo</span></button>
          <button type="button" class="btn small" data-open-account="${esc(r.id)}">Ficha →</button>`}
          <button type="button" class="btn small icon ghost" data-ag-more="${esc(r.id)}" aria-expanded="${state.agMore === r.id}" aria-label="Más acciones de ${esc(r.name)}">⋯</button>
        </td></tr>`;
    }).join('');
    const table = !v.items.length
      ? (d.rows.length ? `<p class="empty">No hay ${esc(cfg.many)} con estos filtros.</p>` : `<section class="card glass"><h2>Todavía no hay inmobiliarias</h2><p class="sub">Creá la primera: alcanza con su nombre comercial.</p><a class="btn primary" href="${esc(app)}/admin/inmobiliarias/nueva" target="_blank" rel="noopener">+ Nueva inmobiliaria</a></section>`)
      : `<section class="card glass ag-list"><div class="table-wrap"><table class="ag-table"><thead><tr>
          <th>${esc(cfg.one[0].toUpperCase() + cfg.one.slice(1))}</th><th><span title="${esc(cfg.stages.map((k) => cfg.stageStep[k]).join(' → '))}. Surge de los hechos registrados.">Estado comercial ⓘ</span></th>
          <th><span title="${api_ ? 'La última demo creada en el período y el paso más alto del funnel que alcanzaron sus demos.' : 'Hasta dónde llegó su demo (/p/…) y cuándo se la mandamos.'}">Demo ⓘ</span></th>${api_ ? `<th>${esc(cfg.accountTitle)}</th><th class="n">Propiedades</th>` : '<th>Teléfono</th>'}
          <th>${api_ ? sortHead('score', 'Lead score ⓘ', 'Engagement de visitantes externos con sus demos (0 a 100). No es probabilidad de compra. Tocá para ordenar.') : 'Mensajes'}</th><th>${sortHead('actividad', 'Última actividad')}</th><th>Acciones</th>
        </tr></thead><tbody>${rowsHtml}</tbody></table></div>
        ${v.pages > 1 ? `<nav class="ag-pages" aria-label="Páginas">${v.page > 1 ? `<button type="button" class="btn small" data-ag-set="${set({ pagina: String(v.page - 1) })}">Anterior</button>` : '<span></span>'}<span class="sub">Página ${int(v.page)} de ${int(v.pages)} · ${int(v.shown.length)} ${esc(cfg.many)}</span>${v.page < v.pages ? `<button type="button" class="btn small" data-ag-set="${set({ pagina: String(v.page + 1) })}">Siguiente</button>` : '<span></span>'}</nav>` : ''}</section>`;
    const recalc = !api_ ? '' : `<p class="ag-recalc"><button type="button" class="link" data-action="ag-recalc">${state.agRecalc === 'busy' ? 'Recalculando…' : 'Recalcular lead scores'}</button>${state.agRecalc && state.agRecalc !== 'busy' ? ` · <span role="status">${esc(state.agRecalc)}</span>` : ''}</p>`;
    state.agRows = new Map(v.items.map((r) => [r.id, { r, step: v.per.get(r.id).step, app }]));
    queueMicrotask(agPop);
    return head + funnel + review + toolbar + tabAction + scope + table + recalc;
  }
  // Turnia: tilde rápido de «le mandé un audio» desde el celular. Cuenta como mensaje (salvo que ese día ya
  // haya salido uno) y queda en «Audio enviado». Con un toque alcanza.
  function audioCheck(r, u) {
    // Ya marcado: tocarlo lo desmarca (si fue por error). Si ese audio había sumado un mensaje, se descuenta.
    if (r.audioAt) return `<button type="button" class="ag-chip is-done ag-audio" data-ag-unaudio="${esc(r.id)}" title="Audio enviado ${esc(AG.agoText(r.audioAt))}. Tocá para desmarcarlo" aria-label="Desmarcar el audio enviado a ${esc(r.name)}">🎤 ✓</button>`;
    // Sin WhatsApp no corresponde. Con los tres mensajes usados, solo si el último salió hoy: el audio va con
    // ese mensaje (no suma otro), como cuando mandás el texto con el botón y después el audio desde el celular.
    if (!u.canMessage(r)) return '';
    if (r.touches >= (u.maxTouches || 3) && r.lastContactDay !== C.today()) return '';
    return `<button type="button" class="ag-chip ag-audio" data-ag-audio="${esc(r.id)}" title="Registrar que le mandaste un audio por WhatsApp (un toque)">🎤 Audio</button>`;
  }
  // Los menús (estado de la demo y «⋯») van en una capa propia: dentro del vidrio de una tarjeta,
  // un elemento fijo queda encerrado en ella.
  function agPop() {
    let el = document.getElementById('agpop');
    if (!el) { el = document.createElement('div'); el.id = 'agpop'; document.body.appendChild(el); }
    const menuRow = state.view === 'inmobiliarias' && state.agMenu && state.agRows && state.agRows.get(state.agMenu);
    const moreRow = state.view === 'inmobiliarias' && state.agMore && state.agRows && state.agRows.get(state.agMore);
    el.innerHTML = menuRow ? stepMenu(menuRow.r, menuRow.step) : moreRow ? moreMenu(moreRow.r, moreRow.app) : '';
  }
  function moreMenu(r, app) {
    if (!fromApi(state.unit)) {
      const u = unitOf(state.unit);
      const at = state.agMenuAt || { top: 120, left: 20 };
      return `<div class="ag-more-list glass strong" style="--at-top:${at.top}px;--at-left:${Math.max(8, at.left - 200)}px" role="menu" aria-label="Más acciones de ${esc(r.name)}">
        <a role="menuitem" href="#" data-open-account="${esc(r.id)}">Abrir su ficha</a>
        ${r.demoUrl ? `<a role="menuitem" href="${esc(r.demoUrl)}" target="_blank" rel="noopener">Ver su demo</a>` : ''}
        ${u.appUrl ? `<a role="menuitem" href="${esc(u.appUrl)}" target="_blank" rel="noopener">Abrir ${esc(u.appName)}</a>` : ''}
      </div>`;
    }
    const base = `${app}/admin/inmobiliarias/${r.id}`;
    const at = state.agMenuAt || { top: 120, left: 20 };
    return `<div class="ag-more-list glass strong" style="--at-top:${at.top}px;--at-left:${Math.max(8, at.left - 200)}px" role="menu" aria-label="Más acciones de ${esc(r.name)}">
      <a role="menuitem" href="${esc(`${base}/propiedades/nueva?${new URLSearchParams({ volver: `/admin/inmobiliarias/${r.id}?pestana=propiedades` })}`)}" target="_blank" rel="noopener">Nueva propiedad</a>
      <a role="menuitem" href="${esc(`${base}/editar?${new URLSearchParams({ volver: `/admin/inmobiliarias/${r.id}` })}`)}" target="_blank" rel="noopener">Editar inmobiliaria</a>
      <a role="menuitem" href="${esc(base)}?pestana=enlaces" target="_blank" rel="noopener">Ver enlaces</a>
      <a role="menuitem" href="${esc(base)}?pestana=cuenta" target="_blank" rel="noopener">Cuenta y créditos</a>
      <a role="menuitem" href="${esc(base)}" target="_blank" rel="noopener">Ver o entrar como cliente (en su ficha)</a>
    </div>`;
  }
  function stepMenu(r, step) {
    if (!fromApi(state.unit)) {
      const at = state.agMenuAt || { top: 120, left: 20 };
      const o = (val, title, help) => `<button type="button" role="radio" aria-checked="${step === val}" class="ag-step-opt${step === val ? ' is-on' : ''}" data-ag-sent="${val}" data-id="${esc(r.id)}"><span class="dot-opt" aria-hidden="true"></span><span><strong>${title}</strong><small>${help}</small></span></button>`;
      return `<div class="ag-step-pop glass strong" style="--at-top:${at.top}px;--at-left:${at.left}px" role="dialog" aria-label="Estado de la demo de ${esc(r.name)}"><p><strong>Demo de ${esc(r.name)}</strong><span class="sub">¿Ya se la mandaste?</span></p>
        ${o(0, 'Saludado', 'Todavía no le mandamos la demo')}${o(1, 'Enviada', 'Ya se la mandamos (registra la demo)')}
        <p class="sub" style="margin:6px 0 0">Abrió, habló con Sofi, llamada y cliente se marcan solos. Para deshacer un envío, usá la ficha.</p><button type="button" class="btn small ghost" data-ag-menu="">Cancelar</button></div>`;
    }
    const o = (val, title, help) => `<button type="button" role="radio" aria-checked="${step === val}" class="ag-step-opt${step === val ? ' is-on' : ''}" data-ag-sent="${val}" data-id="${esc(r.id)}"><span class="dot-opt" aria-hidden="true"></span><span><strong>${title}</strong><small>${help}</small></span></button>`;
    const at = state.agMenuAt || { top: 120, left: 20 };
    return `<div class="ag-step-pop glass strong" style="--at-top:${at.top}px;--at-left:${at.left}px" role="dialog" aria-label="Estado de la demo de ${esc(r.name)}"><p><strong>Demo de ${esc(r.name)}</strong><span class="sub">¿En qué estado está?</span></p>
      ${o(0, 'Creada', 'Todavía no se la mandamos')}${o(1, 'Enviada', 'Ya se la mandamos (por WhatsApp u otro medio)')}
      <p class="sub" style="margin:6px 0 0">Con visita, interacción, cuenta y suscripción se marcan solos.</p><button type="button" class="btn small ghost" data-ag-menu="">Cancelar</button></div>`;
  }
  // El menú fijo se cierra si la página se mueve de verdad (no por el reacomodo al abrirlo).
  window.addEventListener('scroll', () => { if ((state.agMenu || state.agMore) && Math.abs(scrollY - (state.agMenuAt ? state.agMenuAt.y : scrollY)) > 40) { state.agMenu = null; state.agMore = null; agPop(); } }, { passive: true });
  // Un clic afuera o Escape cierran los menús.
  document.addEventListener('mousedown', (e) => { if ((state.agMenu || state.agMore) && !e.target.closest('#agpop, [data-ag-menu], [data-ag-more]')) { state.agMenu = null; state.agMore = null; agPop(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (state.agMenu || state.agMore)) { state.agMenu = null; state.agMore = null; agPop(); } });
  async function agencyAction(body) {
    if (state.demo) { toast('En el ejemplo no se cambia nada.', true); return null; }
    return api('agency', { method: 'POST', body: { unit: state.unit, ...body } });
  }

  // ─── Mensajes ───────────────────────────────────────────────
  function templatesOf(id) {
    const u = unitOf(id);
    const custom = (state.data[id] && state.data[id].templates) || {};
    const out = {};
    for (const [k, t] of Object.entries(u.templates)) out[k] = { ...t, ...(custom[k] ? { text: custom[k].text, title: custom[k].title || t.title, subject: custom[k].subject || t.subject } : {}), custom: Boolean(custom[k] && custom[k].text.trim() !== t.text.trim()), factory: t.text, factorySubject: t.subject || '' };
    for (const [k, t] of Object.entries(custom)) if (!out[k]) out[k] = { ...t, hint: 'Agregada en la planilla', custom: true };
    out.libre = { title: 'Mensaje libre', channel: 'whatsapp', text: '', hint: 'Para una conversación en curso: escribí lo que corresponda.', builtin: true };
    return out;
  }
  function renderMessages(id) {
    const u = unitOf(id);
    const d = state.data[id];
    const sample = d.accounts.find((a) => a.stage === 'por_contactar' && a.name) || d.accounts[0] || { name: 'Ana Ejemplo', greeting: 'Ana' };
    const stats = C.templateStats(d.events, u);
    const tpls = templatesOf(id);
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Mensajes</span><h1>Qué decimos y qué responde</h1><p>${u.api && u.api.templates !== false ? `Son los mismos mensajes de ${esc(u.appName)}: lo que edites acá cambia allá también.` : 'Se guardan en la pestaña «Mensajes» de la planilla: el cambio llega a todo el equipo.'} Tocá «Editar» en cualquiera.</p></div></section>
      <section class="card glass"><div class="card-head"><div><h2>Respuesta por plantilla</h2><p class="sub">Cada respuesta va al último mensaje enviado antes, dentro de ${u.window} días. Un envío cuenta en la tasa cuando pasó esa ventana o ya respondió. Sin ganadora automática: con menos de 30, es muestra chica.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Plantilla</th><th class="n">Enviados</th><th class="n">Maduros</th><th class="n">Respuestas</th><th>Tasa</th></tr></thead><tbody>
        ${stats.map((s) => `<tr><td><strong>${esc((tpls[s.template] && tpls[s.template].title) || s.template)}</strong></td><td class="n">${int(s.enviados)}</td><td class="n">${int(s.maduros)}</td><td class="n">${int(s.respuestas)}</td><td class="num"><span class="minibar" style="width:${Math.round((s.tasa || 0) * 120)}px;--accent:${color(u)}"></span> ${pct(s.tasa)} ${s.muestraChica ? '<span class="chip warn">Muestra chica</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Todavía no hay envíos registrados desde el panel.</td></tr>'}
        </tbody></table></div></section>
      <div class="grid cols-2">${Object.entries(tpls).filter(([, t]) => !t.builtin).map(([k, t]) => templateCard(id, k, t, sample)).join('')}</div>`;
  }

  const VARS = [['{saludo}', 'nombre de pila'], ['{nombre}', 'nombre completo'], ['{destinatario}', '«la Dra. Pérez»'], ['{organizacion}', 'consultorio o inmobiliaria'], ['{zona}', 'ciudad o zona'], ['{link}', 'su demo']];
  function templateCard(id, k, t, sample) {
    const u = unitOf(id);
    const editing = state.editing && state.editing.unit === id && state.editing.key === k;
    const locked = isReadOnly(id) || (u.api && u.api.templates !== false && state.data[id] && state.data[id].apiError);
    const head = `<div class="card-head" style="margin-bottom:8px"><div><h3>${esc(t.title)}</h3><p class="sub">${esc(t.hint || '')}</p></div>
      <div class="btns" style="align-items:center"><span class="badge plain">${esc(t.channel || '')}${t.custom ? ' · editado' : ''}</span>${editing || locked ? '' : `<button class="btn small" type="button" data-edit-tpl="${esc(k)}">Editar</button>`}</div></div>`;
    if (!editing) {
      return `<section class="card glass" data-tpl-card="${esc(k)}">${head}
        ${t.subject ? `<p class="sub"><strong>Asunto:</strong> ${esc(C.renderTemplate(t.subject, sample, u))}</p>` : ''}<pre class="tpl">${esc(C.renderTemplate(t.text, sample, u))}</pre></section>`;
    }
    const draft = state.editing.text;
    return `<section class="card glass strong" data-tpl-card="${esc(k)}">${head}
      <form class="grid" data-tpl-form="${esc(k)}" style="gap:10px">
        ${t.channel === 'email' ? `<label class="field">Asunto<input name="subject" value="${esc(state.editing.subject)}"></label>` : ''}
        <label class="field">Texto<textarea name="text" rows="7" data-tpl-text>${esc(draft)}</textarea></label>
        <p class="sub" style="margin:0">Variables: ${VARS.map(([v, l]) => `<button type="button" class="chip" data-insert-var="${esc(v)}" title="${esc(l)}">${esc(v)}</button>`).join(' ')}</p>
        <div><span class="eyebrow">Así lo recibe ${esc(sample.name || '')}</span><pre class="tpl" data-tpl-preview>${esc(C.renderTemplate(draft, sample, u))}</pre></div>
        <div class="btns">
          <button class="btn primary" type="submit">Guardar</button>
          <button class="btn ghost" type="button" data-action="cancel-tpl">Cancelar</button>
          ${t.factory ? '<button class="btn ghost" type="button" data-action="factory-tpl">Volver al de fábrica</button>' : ''}
        </div>
      </form></section>`;
  }

  // ─── Playbook ───────────────────────────────────────────────
  function renderPlaybook(id) {
    const u = unitOf(id);
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Playbook</span><h1>A quién, qué y cómo</h1><p>El foco propio de ${esc(u.name)} sobre el mismo panel.</p></div></section>
      <div class="grid cols-2 playbook">
        <section class="card glass"><span class="eyebrow">ICP</span><p class="quote" style="margin-top:6px">${esc(u.icp)}</p></section>
        <section class="card glass"><span class="eyebrow">Propuesta de valor</span><p class="quote" style="margin-top:6px">${esc(u.uvp)}</p><p style="margin-top:10px">${esc(u.proof)}</p></section>
        <section class="card glass"><h2>Reglas</h2><ul style="margin-top:10px">${u.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>
        <section class="card glass"><h2>Ritmo</h2><ul style="margin-top:10px">
          <li>Meta: ${int(u.dailyGoal)} contactos nuevos por día.</li>
          <li>${esc(u.hours)}</li>
          <li>Hasta ${u.maxTouches} mensajes${u.greetingFirst ? ' (sin contar el saludo)' : ''}: el siguiente a los ${u.cadence.join(' y después a los ')} días hábiles.</li>
          <li>Ventana para medir respuesta: ${u.window} días.</li></ul></section>
      </div>
      <section class="card glass"><h2>Si te dice…</h2><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Te dice</th><th>Respondé</th></tr></thead><tbody>${u.objections.map(([a, b]) => `<tr><td><strong>${esc(a)}</strong></td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card glass"><h2>Cómo se mide (igual en todas las unidades)</h2><div class="table-wrap" style="margin-top:8px"><table><tbody>
        <tr><td><strong>Prospectados</strong></td><td>Toda la base filtrada${u.id === 'turnia' ? ' (sin los fijos que no respondieron: no tienen WhatsApp)' : ''}. No depende del período.</td></tr>
        <tr><td><strong>Contactados</strong></td><td>Cohorte: primer contacto confirmado dentro del período. Abrir el chat o el mail no cuenta: cuenta cuando confirmás que salió.</td></tr>
        <tr><td><strong>Respondieron</strong></td><td>Respuesta de una persona registrada. Una respuesta negativa cuenta; una baja sin respuesta, no.</td></tr>
        <tr><td><strong>Interesados</strong></td><td>Interés explícito registrado. Abrir o probar la demo es una señal aparte, no interés.</td></tr>
        <tr><td><strong>Reunión o demo · Clientes</strong></td><td>Cada etapa incluye a las siguientes: un cliente también cuenta como interesado y como respondió.</td></tr>
        <tr><td><strong>En observación</strong></td><td>Contactados hace menos de ${u.window} días que todavía pueden responder.</td></tr>
      </tbody></table></div></section>`;
  }

  // ─── Ficha ──────────────────────────────────────────────────
  function findAccount(id, unitId = state.unit) {
    const d = state.data[unitId];
    return d && d.accounts ? d.accounts.find((a) => a.id === id) : null;
  }

  function openDrawer(id) {
    state.drawer = id;
    const dr = $('#drawer');
    const scrim = $('#scrim');
    dr.hidden = false;
    scrim.hidden = false;
    renderDrawer();
    requestAnimationFrame(() => { dr.classList.add('on'); scrim.classList.add('on'); });
    setTimeout(() => { const f = dr.querySelector('[data-autofocus]') || dr.querySelector('button'); if (f) f.focus(); }, 60);
  }
  function closeDrawer() {
    const dr = $('#drawer');
    const scrim = $('#scrim');
    const back = state.drawer && main.querySelector(`[data-open-account="${CSS.escape(state.drawer)}"]`);
    state.drawer = null;
    dr.classList.remove('on');
    scrim.classList.remove('on');
    setTimeout(() => { if (!state.drawer) { dr.hidden = true; scrim.hidden = true; } }, 420);
    if (back) back.focus();
  }

  function renderDrawer() {
    const a = findAccount(state.drawer);
    const dr = $('#drawer');
    if (!a) { dr.innerHTML = ''; return; }
    const u = unitOf(state.unit);
    const tpls = templatesOf(state.unit);
    const next = C.nextTemplate(a, u);
    const key = (dr.dataset.key && tpls[dr.dataset.key] && dr.dataset.for === a.id) ? dr.dataset.key : next ? next.key : 'libre';
    dr.dataset.key = key;
    dr.dataset.for = a.id;
    const t = tpls[key] || { text: '' };
    const text = C.renderTemplate(t.text, a, u);
    const events = (state.data[state.unit].events || []).filter((e) => e.id === a.id).slice(-40).reverse();
    const undo = state.undo[a.id];
    const link = u.demoLink(a);
    const phoneKinds = { celular: 'celular de la persona', compartido: 'del consultorio u oficina', fijo: 'fijo', revisar: 'por revisar' };
    dr.innerHTML = `
      <div class="drawer-head"><div style="flex:1;min-width:0"><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)}</span><h2 id="drawer-title">${esc(a.name)}</h2>
        <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${stagePill(a, u)}${signals(a)}${a.touches ? `<span class="badge plain">${int(a.touches)} de ${u.maxTouches} mensajes</span>` : ''}${a.priority ? `<span class="badge plain">P${a.priority}</span>` : ''}</div></div>
        <button class="btn icon ghost" type="button" data-action="close" aria-label="Cerrar la ficha">${icon.close}</button></div>
      <div class="drawer-body">
        ${a.optOut || a.stage === 'baja' ? `<div class="notice glass"><strong>Pidió no recibir más.</strong> No se le escribe por ningún canal.</div>` : ''}
        ${a.nextStep || a.nextAt ? `<div class="section"><h3>Próximo paso</h3><div><strong>${esc(a.nextStep || 'Seguimiento')}</strong>${a.nextAt ? ` · ${esc(when(a.nextAt))}` : ''}</div></div>` : ''}
        ${isReadOnly(state.unit) ? `<div class="section"><h3>Contactar</h3><p class="sub" style="margin:0">${esc(u.name)} se opera en ${esc(u.appName)}: ahí está su WhatsApp, su demo y el seguimiento. Lo que hagas allá aparece acá solo.</p><div class="btns"><a class="btn primary" href="${esc(u.appUrl)}" target="_blank" rel="noopener" data-autofocus>${icon.ext} Abrir ${esc(u.appName)}</a></div></div>` : ''}
        ${!isReadOnly(state.unit) && (C.canMessage(a, u) || a.instagram) ? `<div class="section"><h3>Mensaje</h3>
          <label class="field">Plantilla<select data-tpl>${Object.entries(tpls).map(([k, x]) => `<option value="${esc(k)}" ${k === key ? 'selected' : ''}>${esc(x.title)}${next && next.key === k ? ' · sugerida' : ''}</option>`).join('')}</select></label>
          ${t.hint ? `<p class="sub" style="margin:0">${esc(t.hint)}</p>` : ''}
          <label class="field"><span class="sr">Texto</span><textarea data-text rows="6">${esc(text)}</textarea></label>
          ${!link && /\{link\}/.test(t.text) ? `<p class="sub" style="margin:0;color:var(--bad-text)">Esta cuenta no tiene link de demo: cargalo en la columna «Demo» antes de mandar.</p>` : ''}
          <div class="btns">
            ${a.phone && t.channel !== 'email' && t.channel !== 'llamada' ? `<button class="btn primary" type="button" data-send-drawer="whatsapp" data-testid="open-whatsapp" data-autofocus>${icon.wa} Abrir WhatsApp</button>` : ''}
            ${a.email && (t.channel === 'email' || !a.phone) ? `<button class="btn primary" type="button" data-send-drawer="email">${icon.mail} Abrir mail</button>` : ''}
            ${a.instagram ? `<button class="btn" type="button" data-send-drawer="instagram">${icon.ig} Copiar y abrir Instagram</button>` : ''}
            <button class="btn" type="button" data-action="copy">${icon.copy} Copiar</button>
            ${a.phone && t.channel === 'whatsapp' ? `<button class="btn ghost" type="button" data-action="manual-drawer" data-arm="Confirmar: ya lo mandé" data-testid="drawer-manual-sent" title="Lo mandaste directo desde WhatsApp">✓ Ya lo mandé a mano</button>` : ''}
          </div>
          <p class="sub" style="margin:0">Abrir el chat no cuenta como contacto: después te preguntamos si salió. Si ya lo mandaste desde WhatsApp, «Ya lo mandé a mano» lo registra sin abrir nada.</p></div>` : ''}
        ${isReadOnly(state.unit) ? '' : `<div class="section"><h3>Qué pasó</h3>
          <div class="btns">
            ${a.phone ? `<button class="btn small" type="button" data-log="call">${icon.phone} Llamé</button>` : ''}
            <button class="btn small" type="button" data-log="visit">Lo visité</button>
            <button class="btn small" type="button" data-outcome="respondio" data-testid="outcome-respondio">Respondió</button>
            <button class="btn small" type="button" data-outcome="interesado" data-testid="outcome-interesado">Interesado</button>
            <button class="btn small" type="button" data-outcome="reunion" data-testid="outcome-reunion">Reunión</button>
            <button class="btn small" type="button" data-outcome="cliente" data-testid="outcome-cliente">Cliente</button>
            ${link && !(state.data[state.unit] || {}).viaApi ? `<button class="btn small" type="button" data-demo="opened">Abrió la demo</button><button class="btn small" type="button" data-demo="tried">Probó la demo</button>` : ''}
          </div>
          <div class="btns">
            <button class="btn small ghost" type="button" data-outcome="perdido">${esc(u.stageLabel('perdido'))}</button>
            <button class="btn small ghost" type="button" data-outcome="invalido">${esc(u.stageLabel('invalido'))}</button>
            <button class="btn small ghost danger" type="button" data-outcome="baja" data-testid="outcome-baja" data-arm="Confirmar: no escribirle nunca más">Pidió no recibir más</button>
            ${C.closed(a) ? '<button class="btn small ghost" type="button" data-action="reopen">Reabrir</button>' : ''}
          </div>
          <label class="field">Detalle o evidencia (qué dijo, por qué)<input data-detail placeholder="Opcional, pero ayuda a medir bien"></label>
          ${u.inbox !== 'bandeja' && a.phone ? `<details data-testid="drawer-refer"><summary class="sub" style="cursor:pointer">Derivó a otro número (pasaron el contacto del doctor)</summary>
            <form class="btns" data-refer-drawer style="align-items:flex-end;margin-top:8px"><label class="field" style="flex:1 1 140px">Número nuevo<input name="phone" required inputmode="tel" placeholder="223 555-1234"></label><label class="field" style="flex:1 1 140px">De quién<input name="name" placeholder="Dra. Pérez (opcional)"></label><button class="btn small" type="submit">Guardar en esta cuenta</button></form>
            <p class="sub" style="margin:4px 0 0">Reemplaza el número de esta cuenta${u.demoIsCode ? ' (misma demo)' : ''} y deja el anterior en las notas.</p></details>` : ''}
          ${undo ? `<button class="btn small ghost" type="button" data-action="undo">↶ Deshacer: ${esc(undo.label)}</button>` : ''}
        </div>
        <div class="section"><h3>Agendar</h3>
          <div class="btns" style="align-items:flex-end"><label class="field" style="flex:1 1 140px">Fecha<input type="date" data-next-at value="${esc(C.dayOf(a.nextAt))}"></label><label class="field" style="flex:2 1 180px">Qué hacer<input data-next-step value="${esc(a.nextStep)}"></label><button class="btn small" type="button" data-action="schedule">Guardar</button></div>
        </div>`}
        ${u.api && !u.api.rows && !isReadOnly(state.unit) ? accountSection(a, u) : ''}
        ${productActivity(a, u)}
        <div class="section"><h3>Datos</h3>
          <dl class="facts">
            ${a.org && a.org !== a.name ? `<dt>${esc(u.entity.org)}</dt><dd>${esc(a.org)}</dd>` : ''}
            ${a.phone ? `<dt>Teléfono</dt><dd><a href="tel:${esc(a.phone.replace(/[^\d+]/g, ''))}">${esc(a.phone)}</a>${a.phoneKind ? ` <span class="sub">(${esc(phoneKinds[a.phoneKind] || a.phoneKind)})</span>` : ''}</dd>` : ''}
            ${a.email ? `<dt>Email</dt><dd>${esc(a.email)}</dd>` : ''}
            ${a.instagram ? `<dt>Instagram</dt><dd>${esc(a.instagram)}</dd>` : ''}
            ${a.web ? `<dt>Web</dt><dd><a href="${esc(/^https?:/.test(a.web) ? a.web : `https://${a.web}`)}" target="_blank" rel="noopener">${esc(a.web)}</a></dd>` : ''}
            ${a.zone ? `<dt>Zona</dt><dd>${esc(a.zone)}</dd>` : ''}
            ${a.sdr ? `<dt>SDR</dt><dd>${esc(a.sdr)}</dd>` : ''}
            ${a.campaign ? `<dt>Campaña</dt><dd>${esc(a.campaign)}</dd>` : ''}
            ${link ? `<dt>Su demo</dt><dd><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace(/^https?:\/\//, ''))}</a></dd>` : ''}
            ${a.firstContact ? `<dt>Primer contacto</dt><dd>${esc(when(a.firstContact))}</dd>` : ''}
            ${a.signals ? `<dt>Señales</dt><dd>${esc(a.signals)}</dd>` : ''}
            ${a.lostReason ? `<dt>Motivo</dt><dd>${esc(a.lostReason)}</dd>` : ''}
            ${Object.entries(a.extra || {}).slice(0, 8).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
          </dl>
          <div class="btns">
            <a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(`${a.org || a.name} ${a.zone || ''}`)}">Buscar en Google</a>
            ${!a.instagram ? `<a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${a.org || a.name} ${a.zone || ''}`)}">Buscar su Instagram</a>` : ''}
          </div>
          ${isReadOnly(state.unit) ? '' : `<details><summary class="sub" style="cursor:pointer">Editar datos</summary>
            <form class="grid" data-edit style="margin-top:10px;gap:8px">
              ${[['name', 'Nombre'], ['org', u.entity.org], ['greeting', 'Saludo (nombre de pila)'], ['phone', 'Teléfono'], ['email', 'Email'], ['instagram', 'Instagram'], ['web', 'Web'], ['zone', 'Zona'], ['sdr', 'SDR'], ['demoUrl', 'Link de su demo']].map(([k, l]) => `<label class="field">${esc(l)}<input name="${k}" value="${esc(a[k] || '')}"></label>`).join('')}
              <label class="field">De quién es el teléfono<select name="phoneKind">${[['', 'Sin dato'], ['celular', 'Celular de la persona (verificado)'], ['compartido', 'Del consultorio u oficina'], ['fijo', 'Fijo'], ['revisar', 'Por revisar']].map(([v, l]) => `<option value="${v}" ${a.phoneKind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <button class="btn small" type="submit">Guardar datos</button>
            </form></details>`}
        </div>
        <div class="section"><h3>Notas</h3>
          ${a.notes ? `<p style="margin:0;white-space:pre-wrap;font-size:14px">${esc(a.notes)}</p>` : ''}
          ${isReadOnly(state.unit) ? (a.notes ? '' : '<p class="sub" style="margin:0">Sin notas.</p>') : '<form class="btns" data-note><input class="input" name="note" placeholder="Agregar una nota" style="flex:1 1 200px" aria-label="Nueva nota"><button class="btn small" type="submit">Agregar</button></form>'}
        </div>
        <div class="section"><h3>Historia</h3>
          ${events.length ? `<ul class="history">${events.map((e) => `<li><time>${esc(when(e.at))}</time><span><strong>${esc(eventLabel(e, u))}</strong>${e.detail ? ` · ${esc(e.detail)}` : ''}${e.by ? ` <span class="sub">· ${esc(e.by)}</span>` : ''}</span></li>`).join('')}</ul>` : `<p class="sub" style="margin:0">${isReadOnly(state.unit) ? `El historial completo está en ${esc(u.appName)}.` : 'Sin actividad registrada desde el panel.'}</p>`}
        </div>
      </div>`;
    window.LiquidGlass && window.LiquidGlass.scan();
  }

  // La cuenta real que se le dio (Turnia): mide «cuentas creadas» y «activas» de la prospección.
  function accountSection(a, u) {
    const clinics = (state.data[state.unit] && state.data[state.unit].clinics) || [];
    if (a.accountAt || a.accountClinic) {
      return `<div class="section"><h3>Cuenta</h3>
        <p style="margin:0"><strong>${esc(a.accountClinic || 'Cuenta creada')}</strong> · desde ${esc(when(a.accountAt))}
          ${a.accountActive ? '<span class="badge live" style="margin-left:6px">Activa</span>' : '<span class="badge off" style="margin-left:6px">Sin turnos en 30 días</span>'}</p>
        <div class="btns"><button class="btn small ghost" type="button" data-account="" data-arm="Confirmar: desvincular">Desvincular</button></div></div>`;
    }
    return `<div class="section"><h3>Cuenta</h3>
      <p class="sub" style="margin:0">Cuando le des acceso a una clínica real, vinculala acá: así cuenta en «cuentas creadas» y, si tiene turnos, en «activas».</p>
      ${clinics.length ? `<div class="btns" style="align-items:flex-end"><label class="field" style="flex:1 1 200px">Clínica<select data-account-select><option value="">Elegí la clínica</option>${clinics.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><button class="btn small" type="button" data-account-link>Vincular cuenta</button></div>` : `<p class="sub" style="margin:0">${state.demo ? 'En el ejemplo no hay clínicas.' : 'No hay clínicas reales para elegir.'}</p>`}
    </div>`;
  }

  function eventLabel(e, u) {
    const tpls = templatesOf(u.id);
    const labels = { cuenta: 'Cuenta', saludo: 'Saludo enviado', mensaje: 'Mensaje enviado', llamada: 'Llamada', visita: 'Visita', respondio: 'Respondió', interesado: 'Interesado', reunion: 'Reunión', cliente: 'Cliente', perdido: u.stageLabel('perdido'), invalido: u.stageLabel('invalido'), baja: 'Pidió no recibir más', abrio_demo: 'Abrió la demo', probo_demo: 'Probó la demo', proximo: 'Agendado', nota: 'Nota', edicion: 'Datos editados', deshacer: 'Deshecho', audio_desmarcado: 'Audio desmarcado', reabrir: 'Reabierta' };
    const base = labels[e.type] || e.type;
    return e.template && tpls[e.template] ? `${base} (${tpls[e.template].title})` : base;
  }

  // ─── Acciones ───────────────────────────────────────────────
  async function act(id, action, { label, undoable } = {}) {
    const unitId = state.unit;
    const u = unitOf(unitId);
    const d = state.data[unitId];
    const a = findAccount(id, unitId);
    if (!a || state.busy) return null;
    state.busy = true;
    let res;
    try {
      if (state.demo) {
        res = C.applyAction(a, action, { unit: u, by: 'Ejemplo' });
        res = { account: { ...a, ...res.patch }, events: res.events };
      } else {
        res = await api('action', { method: 'POST', body: { unit: unitId, id, version: a.updated, action } });
      }
    } catch (err) {
      if (err.status === 409 && err.body && err.body.account) replaceAccount(unitId, err.body.account);
      toast(err.message, true);
      render();
      if (state.drawer) renderDrawer();
      return null;
    } finally {
      state.busy = false;
    }
    const before = a;
    replaceAccount(unitId, res.account);
    d.events.push(...res.events);
    if (undoable) {
      const previous = {};
      for (const k of Object.keys(res.account)) if (C.WRITABLE.includes(k) && k !== 'updated' && before[k] !== res.account[k]) previous[k] = before[k] === undefined ? '' : before[k];
      if (previous.stage) previous.stage = u.stageLabel(previous.stage);
      state.undo[id] = { previous, label };
    } else if (action.type === 'undo') delete state.undo[id];
    render();
    if (state.drawer) renderDrawer();
    if (label) toast(label + (undoable ? ' · podés deshacerlo desde la ficha' : ''));
    return res;
  }
  function replaceAccount(unitId, acc) {
    const d = state.data[unitId];
    const i = d.accounts.findIndex((x) => x.id === acc.id);
    if (i >= 0) d.accounts[i] = { ...d.accounts[i], ...acc, stage: C.stageFromText(acc.stage) };
  }

  // Abrir el canal y preguntar si salió (abrir no es enviar).
  // WhatsApp siempre en la misma pestaña («chapa-whatsapp»): en la computadora, WhatsApp Web directo
  // (sin la página de wa.me); en el celular, wa.me abre la app. Como el panel original de Turnia.
  function openWhatsApp(phone, text) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const url = coarse ? C.waLink(phone, text) : C.waWebLink(phone, text);
    if (!url) return false;
    const w = window.open(url, 'chapa-whatsapp');
    if (w) { try { w.opener = null; } catch { /* otra pestaña */ } }
    return true;
  }

  // El envío abierto y sin confirmar sobrevive a una recarga: se vuelve a preguntar si salió.
  function savePending(p) { store('pending', p ? { ...p, unit: state.unit, at: Date.now() } : null); }
  function storedPending() {
    const p = store('pending');
    return p && p.unit === state.unit && Date.now() - p.at < 6 * 3600000 ? p : null;
  }
  function showConfirmBar(p, { again } = {}) {
    const c = $('#confirm');
    const mins = again ? Math.round((Date.now() - p.at) / 60000) : 0;
    c.innerHTML = `<p>${again ? `Abriste WhatsApp para <strong>${esc(p.name)}</strong>${mins ? ` hace ${mins} min` : ''}. ¿Salió el ${p.kind === 'saludo' ? 'saludo' : 'mensaje'}?` : `¿Salió el ${p.kind === 'saludo' ? 'saludo' : 'mensaje'} a <strong>${esc(p.name)}</strong>?`}</p><button class="btn primary" type="button" data-confirm="yes" data-testid="confirm-sent">Sí, se envió</button><button class="btn ghost" type="button" data-confirm="no" data-testid="confirm-not-sent">No salió</button>`;
    c.classList.add('on');
    window.LiquidGlass && window.LiquidGlass.refresh(c);
  }

  function startSend(id, channel, key, text, { inline } = {}) {
    const u = unitOf(state.unit);
    const a = findAccount(id);
    if (!a) return;
    const tpls = templatesOf(state.unit);
    const t = tpls[key] || {};
    const body = text != null ? text : C.renderTemplate(t.text, a, u);
    const next = C.nextTemplate(a, u);
    const kind = next && next.key === key ? next.kind : /saludo/.test(key) ? 'saludo' : 'mensaje';
    let url = '';
    if (channel === 'whatsapp') url = C.waWebLink(a.phone, body);
    else if (channel === 'email') url = `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(C.renderTemplate(t.subject || '', a, u))}&body=${encodeURIComponent(body)}`;
    else if (channel === 'instagram') {
      copy(body);
      const handle = String(a.instagram || '').replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, '').replace(/\/.*$/, '');
      url = `https://ig.me/m/${encodeURIComponent(handle)}`;
    }
    if (!url) { toast('Esta cuenta no tiene ese canal.', true); return; }
    if (channel === 'whatsapp') openWhatsApp(a.phone, body);
    else window.open(url, '_blank', 'noopener');
    state.pending = { id, channel, key, kind, name: a.name, text: body, subject: channel === 'email' ? C.renderTemplate(t.subject || '', a, u) : '', inline: Boolean(inline) };
    savePending(state.pending);
    if (inline) { render(); return; }
    showConfirmBar(state.pending);
    setTimeout(() => { const b = $('#confirm [data-confirm="yes"]'); if (b) b.focus(); }, 50);
  }
  async function confirmSend(yes) {
    const p = state.pending || storedPending();
    state.pending = null;
    $('#confirm').classList.remove('on');
    if (!p) return;
    if (!yes) {
      savePending(null);
      if (p.inline) { state.agent.fails++; skipAgent(p.id); render(); }
      return;
    }
    const ok = await act(p.id, { type: 'sent', channel: p.channel, template: p.key, kind: p.kind, ...(p.text ? { text: String(p.text).slice(0, 4000) } : {}), ...(p.subject ? { subject: p.subject } : {}) }, { label: `${p.kind === 'saludo' ? 'Saludo' : 'Mensaje'} a ${p.name} registrado`, undoable: true });
    // El mensaje ya salió: si no se pudo registrar, se reintenta sin volver a abrir WhatsApp.
    if (!ok) {
      state.pending = p;
      if (p.inline) { render(); return; }
      const c = $('#confirm');
      c.innerHTML = `<p>No se pudo registrar el ${p.kind === 'saludo' ? 'saludo' : 'mensaje'} a <strong>${esc(p.name)}</strong>. Ya salió: reintentá cuando quieras.</p><button class="btn primary" type="button" data-confirm="yes" data-testid="confirm-sent">Reintentar</button><button class="btn ghost" type="button" data-confirm="no" data-testid="confirm-not-sent">Descartar</button>`;
      c.classList.add('on');
      return;
    }
    savePending(null);
    if (p.inline) {
      // Ritmo seguro: una pausa al azar antes del próximo envío.
      const [lo, hi] = unitOf(state.unit).pacing || [45, 90];
      store(`next-${state.unit}`, Date.now() + (lo + Math.random() * (hi - lo)) * 1000);
      state.agent.fails = 0;
      state.agent.replied = null;
      render();
    }
  }

  async function saveTargets(body) {
    const id = state.unit;
    try {
      const r = state.demo ? { targets: body.reset ? null : body } : await api('targets', { method: 'POST', body: { unit: id, ...body } });
      state.data[id].targets = r.targets && r.targets.perWeek ? r.targets : null;
      state.editingTargets = null;
      toast(body.reset ? 'Metas de fábrica' : 'Metas guardadas');
      render();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado'); } catch { toast('No se pudo copiar: seleccioná el texto.', true); }
  }

  let toastTimer = 0;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', Boolean(err));
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), err ? 6000 : 3200);
  }

  // ─── Bandeja comercial: el Follow-up de cada app, junto ──────────
  // La cola la arma cada app (habita. y Turnia) con sus reglas, sus bloqueos, sus tomas de 10 minutos
  // y sus resultados (prospecting/followup.js la pone en una sola forma). Acá se mira, se filtra y se
  // ejecuta: cada acción va a la app de su unidad a nombre de quien opera.
  const F = window.ProspectingFollowup;
  const FU_VIEWS = ['hoy', 'pipeline', 'prospectos', 'secuencias', 'rendimiento'];
  const TODAS_VIEWS = [...FU_VIEWS, 'resumen'];
  const UNIT_FU_VIEWS = [...FU_VIEWS, 'etapas'];
  const UNIT_VIEWS = ['hoy', 'responder', 'responder-legado', 'followup', 'pipeline', 'prospectos', 'secuencias', 'rendimiento', 'etapas', 'adquisicion', 'enviar', 'embudo', 'cuentas', 'inmobiliarias', 'onboarding', 'mensajes', 'playbook'];
  const FU_LABEL = { hoy: 'Hoy', pipeline: 'Pipeline', prospectos: 'Prospectos', secuencias: 'Secuencias', rendimiento: 'Rendimiento' };
  state.fu = { raw: null, n: null, loading: false, error: null, at: 0, f: store('fu-filters') || {}, task: null, busy: false, sub: store('fu-sub') || 'hoy', open: {} };
  const isFu = () => (state.unit === 'todas' ? [...FU_VIEWS,'resumen'].includes(state.view) : UNIT_FU_VIEWS.includes(state.view) || state.view === 'followup' || state.view === 'responder');
  const fuView = () => state.view === 'followup' ? (state.fu.sub || 'hoy') : state.view;
  const fuScope = () => (state.unit === 'todas' ? state.fu.f.unit || 'todas' : state.unit);
  const fuUnits = () => units().filter((u) => fuScope() === 'todas' || u.id === fuScope());
  const fuName = (id) => (unitOf(id) || { name: id }).name;
  const fuDot = (id) => { const u = unitOf(id); return u ? `<span class="eyebrow" style="color:${color(u)};font-size:12px">● ${esc(u.name)}</span>` : ''; };
  const ago = (iso) => {
    if (!iso) return '';
    const h = (Date.now() - Date.parse(iso)) / 3600000;
    if (!Number.isFinite(h)) return '';
    if (h < 1) return 'hace minutos';
    if (h < 24) return `hace ${Math.round(h)} h`;
    return `hace ${Math.round(h / 24)} d`;
  };
  const dayTime = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '');

  function fuCount(scope) {
    if (!state.fu.n) return 0;
    return F.filter(state.fu.n.queue, { unit: scope }).filter((x) => !x.claim).length;
  }

  async function loadFollowup({ quiet } = {}) {
    if (state.demo) { state.fu.n = F.normalize({}); state.fu.raw = { units: {} }; return; }
    if (state.fu.loading || !state.session || !state.session.user) return;
    state.fu.loading = true;
    if (!quiet) render();
    try {
      const period=fuChartPeriod();
      state.fu.raw = await api('followup', { query: { unit: 'todas',periodo:period.preset,...(period.from?{desde:period.from}:{}),...(period.to?{hasta:period.to}:{}) } });
      state.fu.n = F.normalize(state.fu.raw.units);
      state.fu.at = Date.now();
      state.fu.error = null;
    } catch (err) {
      state.fu.error = err.message;
      if (err.status === 401) state.session.user = null;
    } finally {
      state.fu.loading = false;
      // Con una tarea abierta no se redibuja: se perdería lo que se está escribiendo.
      if (!state.fu.task&&!fuRulesState('habita').dirty&&!fuRulesState('turnia').dirty) render(); else renderTopOnly();
    }
  }
  function renderTopOnly() { renderTop(); requestAnimationFrame(() => document.querySelectorAll('.seg').forEach(moveThumb)); }

  async function fuOp(unit, followup, { label } = {}) {
    if (state.fu.busy) return null;
    state.fu.busy = true;
    try {
      const { result } = await api('task', { method: 'POST', body: { unit, followup } });
      if (label) toast(label);
      if (result && result.warning) toast(result.warning, true);
      return result || {};
    } catch (err) {
      toast(err.message, true);
      return null;
    } finally {
      state.fu.busy = false;
    }
  }

  function fuFind(key) {
    const n = state.fu.n;
    return n ? [...n.queue, ...n.scheduled, ...n.blocked, ...(n.noInteresados||[])].find((x) => x.key === key) : null;
  }

  async function fuClaim(it) {
    const r = await fuOp(it.unit, { op: 'claim', inmobiliaria: it.id });
    if (!r) { loadFollowup({ quiet: true }); return; }
    state.fu.task = F.prepared(it.unit, r, it);
    state.fu.task.mode = 'ejecutar';
    render();
    loadFollowup({ quiet: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function fuNext() {
    const previous=state.fu.task;
    const cur=previous?.item?.key;
    // No dejar un claim abierto al pasar al siguiente (es distinto a confirmar un envío).
    if(previous?.mode==='ejecutar'){
      const released=await fuOp(previous.unit,{op:'release',inmobiliaria:previous.item?.id});
      if(!released)return;
    }
    state.fu.task=null;
    await loadFollowup({quiet:true});
    const me=state.session?.user?.name;
    const next=fuQueueSelection(fuScope()).rows
      .find(x=>x.key!==cur&&!x.blocked&&!x.dueAt&&x.action&&(!x.claim||x.claim.by===me));
    if (next) await fuClaim(next);
    else { toast('No quedan tareas libres en la cola.'); render(); }
  }

  // ── Las vistas ──
  function fuTaskWithQueue(t) {
  const scope=t.unit,rows=fuQueueSelection(scope).rows;
  const selected=t.item;
  return `<section class="os-fu-task-layout" data-testid="followup-task-context">
    <aside class="os-fu-task-sidebar"><span class="os-kicker">COLA DE EJECUCIÓN · ${esc(fuName(scope).toUpperCase())}</span>
      <h2 style="margin:8px 0 3px">Trabajá sin perder el contexto.</h2>
      <p>La tarea seleccionada queda a la vista. Para cambiar a otra, liberá primero la toma o confirmá la acción.</p>
      <div class="os-fu-reply-bubble"><strong>${esc(selected.name||t.name)}</strong>
        <small>${esc(selected.stageTitle||'')} · ${esc(selected.situationLabel||'')}</small></div>
      <h3 style="font-size:12px;margin:17px 0 6px">Siguientes acciones</h3><ul>
        ${rows.slice(0,12).map(x=>`<li class="${x.key===selected.key?'is-on':''}"><b>${esc(x.name)}</b>
          <small>${esc(x.action||'Sin acción')} · ${esc(x.situationLabel||'')}</small></li>`).join('')||'<li>La cola no tiene otras acciones libres.</li>'}
      </ul>
    </aside><div class="os-fu-task-detail">${renderFuTask(t)}</div></section>`;
}

  function renderFu() {
    if (state.demo) return `${demoBanner()}<div class="notice glass"><span class="badge demo">Ejemplo</span><span>La bandeja comercial lee la cola de Follow-up de cada app: en el modo de ejemplo no hay datos.</span></div>`;
    if (state.fu.task && fuView()!=='hoy') return fuTaskWithQueue(state.fu.task);
    const v = fuView();
    const sub = '';
    if (!state.fu.n) {
      if (state.fu.error) return `${sub}<div class="notice glass"><span class="badge off">Sin conexión</span><span>${esc(state.fu.error)}</span><button class="btn small" type="button" data-fu="reload">Reintentar</button></div>`;
      return `${sub}<div class="skeleton"></div><div class="skeleton"></div>`;
    }
    const errors = Object.entries(state.fu.n.errors).filter(([u]) => fuScope() === 'todas' || u === fuScope())
      .map(([u, e]) => `<div class="notice glass"><span class="badge off">${esc(fuName(u))}</span><span>${esc(e)}</span></div>`).join('');
    const body = { hoy: fuHoy, responder: fuReplies, pipeline: fuPipeline, prospectos: fuProspectos, secuencias: fuSecuencias, rendimiento: fuRendimiento, etapas: fuCatalog }[v] || fuHoy;
    return sub + errors + body();
  }

  

  function fuToolbar({ search = true, groups = true, filters = true } = {}) {
    const f = state.fu.f;
    const n = state.fu.n;
    const owners = [...new Set([...n.queue, ...n.scheduled, ...n.blocked].map((x) => x.owner).filter(Boolean))].sort();
    const unitSeg = state.unit === 'todas' ? `<div class="seg" role="group" aria-label="Producto">${[['todas', 'Todas'], ...units().map((u) => [u.id, u.name])].map(([id, l]) => `<button type="button" data-fu="unit" data-fu-unit="${id}" aria-pressed="${(f.unit || 'todas') === id}">${esc(l)}</button>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>` : '';
    return `<div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${unitSeg}
      ${groups ? `<select class="input" data-fu-filter="group" aria-label="Tipo de acción"><option value="">Todas las acciones</option>${F.GROUPS.map((g) => `<option value="${g}" ${f.group === g ? 'selected' : ''}>${esc(F.GROUP_LABEL[g])}</option>`).join('')}</select>` : ''}
      ${filters ? `<select class="input" data-fu-filter="priority" aria-label="Prioridad"><option value="">Toda prioridad</option>${['alta', 'media', 'baja'].map((p) => `<option value="${p}" ${f.priority === p ? 'selected' : ''}>Prioridad ${F.PRIORITY_LABEL[p].toLowerCase()}</option>`).join('')}</select>
      <select class="input" data-fu-filter="owner" aria-label="Responsable"><option value="">Todos los responsables</option><option value="—" ${f.owner === '—' ? 'selected' : ''}>Sin responsable</option>${owners.map((o) => `<option ${f.owner === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : ''}
      ${search ? `<input class="input" type="search" data-fu-search placeholder="Buscar nombre, zona, etapa…" value="${esc(f.q || '')}" aria-label="Buscar" style="flex:1 1 180px">` : ''}
      <button class="btn small ghost" type="button" data-fu="reload" title="Actualizar">↻ ${state.fu.loading ? 'Actualizando…' : state.fu.at ? `Actualizado ${esc(ago(new Date(state.fu.at).toISOString()))}` : 'Actualizar'}</button></div>`;
  }

  function fuRow(x, { button = true } = {}) {
    const me = state.session && state.session.user && state.session.user.name;
    const other = x.claim && x.claim.by !== me;
    const pill = { alta: 'live', media: 'demo', baja: 'plain' }[x.priority];
    const status = x.claim ? `<span class="badge ${other ? 'off' : 'live'}">${other ? `Lo tiene ${esc(x.claim.by)}` : 'Lo tenés vos'}</span>`
      : x.blocked ? `<span class="badge off" title="${esc(x.blocked)}">Bloqueada</span>`
      : x.dueAt ? `<span class="badge plain">Sale ${esc(dayTime(x.dueAt))}</span>` : '';
    const action = !button ? '' : other || x.blocked || x.dueAt || !x.action ? '' : `<button type="button" class="btn small primary" data-fu="claim" data-fu-key="${esc(x.key)}" data-testid="fu-execute">${icon.wa} ${esc(x.action)}</button>`;
    return `<div class="arow" data-testid="fu-item" data-fu-unit-id="${esc(x.unit)}" data-fu-open="${esc(x.key)}" data-priority="${esc(x.priority)}" data-group="${esc(x.group)}" tabindex="0" role="button" aria-label="Abrir ${esc(x.name)}">
      <div class="who"><strong>${esc(x.name)}</strong><div class="meta">${fuDot(x.unit)}${x.sub && x.sub !== x.name ? `<span>${esc(x.sub)}</span>·` : ''}${x.zone ? `<span>${esc(x.zone)}</span>` : ''}<span class="stage">${esc(x.stageTitle)}</span>${x.situation && x.situation !== 'sin_respuesta' ? `<span class="signal">${esc(x.situationLabel)}</span>` : ''}<span class="badge ${pill}">${esc(F.PRIORITY_LABEL[x.priority])}</span>${x.owner ? `<span>· ${esc(x.owner)}</span>` : ''}${x.since ? `<span>· últ. ${esc(ago(x.since))}</span>` : ''}${x.ads ? '<span class="signal">Paga anuncios</span>' : ''}${status}</div>
      ${x.blocked ? `<div class="meta" style="color:var(--bad-text)">${esc(x.blocked)}</div>` : ''}</div>
      <div class="acts">${action}</div></div>`;
  }

  /** La lectura diaria de los chats de WhatsApp de Turnia: cómo estamos y a quién falta contestarle. */
  function fuWhatsapp(scope) {
    if (scope !== 'todas' && scope !== 'turnia') return '';
    const w = F.whatsapp(state.fu.n, 'turnia');
    if (!w) return '';
    const btn = `<button class="btn small" type="button" data-fu="wa-sync" ${state.fu.waBusy ? 'disabled' : ''}>${state.fu.waBusy ? 'Leyendo los chats…' : 'Leer WhatsApp ahora'}</button>`;
    if (w.never) return `<section class="card glass" aria-label="WhatsApp de Turnia"><div class="block-head" style="cursor:default"><div><h3>WhatsApp de Turnia</h3><p class="sub" style="margin:0">Todavía no se leyeron los chats. Se leen solos una vez por día, a las 8.</p></div>${btn}</div></section>`;
    const t = w.totals;
    const shown = state.more['fu-wa'] ? 1e9 : 8;
    return `<section class="card glass" aria-label="WhatsApp de Turnia" data-testid="fu-whatsapp"><div class="block-head" style="cursor:default"><div><h3>WhatsApp de Turnia</h3><p class="sub" style="margin:0">Leído ${esc(ago(w.at))}${w.trigger ? ` · ${esc(w.trigger)}` : ''} · ${w.lines.map((l) => `<span class="badge ${l.ok ? 'live' : 'off'}">${esc(l.line)}</span> ${esc(l.text)}`).join(' · ')}</p></div>${btn}</div>
      <div class="kpis">
        ${kpi('Conversaciones', int(t.conversaciones), 'Personas a las que les escribimos')}
        ${kpi('Respondieron', int(t.respondieron), t.conversaciones ? `${Math.round((t.respondieron / t.conversaciones) * 100)}% de las conversaciones` : '')}
        ${kpi('Esperan respuesta', int(t.esperanRespuesta), 'El último mensaje es de ellos')}
        ${kpi('Nuevas', int(t.nuevas), `${int(t.abiertas)} pasaron a Respuestas${t.corregidas ? ` · ${int(t.corregidas)} corregidas (eran automáticas)` : ''}`)}
      </div>
      ${w.pending.length ? `<div class="rows">${w.pending.slice(0, shown).map((p) => `<div class="arow" data-testid="fu-wa-pending"><div class="who"><strong>${esc(p.name)}</strong><div class="meta"><span>Al ${esc(p.line)}</span>·<span>${esc(p.at)}</span></div><div class="meta" style="white-space:pre-wrap">«${esc(p.text)}»</div></div><div class="acts">${p.key ? `<button class="btn small" type="button" data-fu="from-ficha" data-fu-key="${esc(p.key)}">Abrir</button>` : ''}</div></div>`).join('')}${w.pending.length > shown ? `<div style="text-align:center;padding:6px"><button class="btn small" type="button" data-more-block="fu-wa">Ver los ${int(w.pending.length - shown)} restantes</button></div>` : ''}</div>` : ''}
    </section>`;
  }

  function fuStageGlyph(key){
  const p={
   todas:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/>',
   prospectado:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
   contactado:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/>',
   interesado:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
   "demo-enviada":'<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3"/>',
   "cuenta-creada":'<rect x="4" y="5" width="16" height="17" rx="2"/><path d="M9 22v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"/>',
   "cuenta-activa":'<path d="m3 12 4 4 6-7M13 16l3 3 6-8"/>',
   cliente:'<path d="m12 2 8 4.5v9L12 20l-8-4.5v-9Z"/><path d="m4 6.5 8 4.5 8-4.5M12 11v9"/>',
   saludado:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/>',
   "demo-visitada":'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
   converso:'<path d="M21 11a8 8 0 0 1-8 8H6l-3 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M8 11h8M8 15h4"/>',
  }[key]||'<circle cx="12" cy="12" r="8"/>';
  return `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

  function fuQueueState() {
  return state.fu.queueView || (state.fu.queueView = {
    kpi:'listas',commercial:null,situation:null,rule:null,tech:null,closed:false,
    order:'comercial',limit:25,search:'',group:null,
  });
}

  function fuQueueSelection(scope) {
  const n=state.fu.n,q=fuQueueState();
  const snap=scope==='todas'?null:n.units[scope];
  const stages=snap?F.commercialStages(scope,snap):[];
  const current=stages.find(s=>s.key===q.commercial)||null;
  const base=q.closed ? n.noInteresados
    : q.kpi==='bloqueadas' ? n.blocked
    : q.kpi==='respuestas' ? n.queue.filter(x=>x.group==='respuestas')
    : q.kpi==='demos' ? n.queue.filter(x=>x.group==='demos') : n.queue;
  const rows=base.filter(x=>{
    if(scope!=='todas'&&x.unit!==scope)return false;
    if(current && !(current.technical.includes(x.stage) && (!current.situation||x.situation===current.situation)))return false;
    if(q.tech&&x.stage!==q.tech)return false;
    if(q.situation&&x.situation!==q.situation&&x.catalogSituation!==q.situation&&!x.productSituations?.includes(q.situation))return false;
    if(q.rule&&x.ruleKey!==q.rule)return false;
    if(q.group&&x.group!==q.group)return false;
    return true;
  });
  const filtered=F.filter(rows,{...state.fu.f,unit:scope==='todas'?state.fu.f.unit||'todas':scope,q:q.search});
  const sort={comercial:F.byPriority,score:(a,b)=>(b.score??-1)-(a.score??-1)||F.byPriority(a,b),
    antiguo:(a,b)=>String(a.since||'').localeCompare(String(b.since||'')),
    reciente:(a,b)=>String(b.since||'').localeCompare(String(a.since||''))};
  filtered.sort(sort[q.order]||sort.comercial);
  return {q,snap,stages,current,all:base,rows:filtered};
}

  function fuQueueTableRow(x,{closed=false}={}) {
  const me=state.session?.user?.name;
  const locked=x.claim&&x.claim.by!==me;
  const active=!closed&&!x.blocked&&!x.dueAt&&Boolean(x.action)&&!locked;
  return `<tr class="os-fu-table-row" data-fu-open="${esc(x.key)}" tabindex="0" aria-label="Ver ${esc(x.name)}" data-testid="fu-item">
    <td class="os-fu-score">${x.score===null||x.score===undefined?'—':esc(String(x.score))}</td>
    <td><strong>${esc(x.name)}</strong><small>${esc(x.sub&&x.sub!==x.name?x.sub:x.stageTitle||'')}</small></td>
    <td>${esc(x.zone||'—')}</td>
    <td><span class="os-fu-pill">${esc(x.situationLabel||'—')}</span></td>
    <td><b>${esc(closed?'Sin acciones':x.action||x.actionReason||'—')}</b></td>
    <td><span>${esc(x.lastText||'—')}</span><small>${esc(ago(x.since)||'—')}</small></td>
    <td>${esc(x.phone||'—')}</td>
    <td><span class="os-fu-priority" data-level="${esc(x.priority)}">${esc(F.PRIORITY_LABEL[x.priority]||'—')}</span></td>
    <td>${closed?'<span class="os-fu-muted">CERRADO</span>':x.blocked?'<span class="os-fu-muted">BLOQUEADA</span>':x.dueAt?'<span class="os-fu-muted">PROGRAMADA</span>':locked?`<span class="os-fu-muted">TOMADA POR ${esc(x.claim.by)}</span>`:
      active?`<button type="button" class="btn small primary" data-fu="claim" data-fu-key="${esc(x.key)}" data-testid="fu-execute">EJECUTAR →</button>`:
      '<span class="os-fu-muted">VER DETALLE</span>'}</td>
  </tr>`;
}

  function fuRecommended(scope,rows,selected,q) {
  const safe=rows.find(x=>x.action&&!x.claim&&!x.blocked&&!x.dueAt&&!q.closed)||null;
  const snap=safe?state.fu.n.units[safe.unit]:null;
  const rule=safe&&(snap.rules||[]).find(x=>x.key===safe.ruleKey);
  const version=safe&&F.versionRows(safe.unit,snap).find(x=>x.id===safe.versionId);
  if(!safe)return `<aside class="os-fu-side" data-testid="followup-recommended"><div class="os-fu-side-head"><span>◎ SIGUIENTE EN LA COLA</span></div><p class="os-fu-caption">No queda ningún contacto libre con los filtros elegidos.</p></aside>`;
  const checks=[
    ['Número de WhatsApp validado',Boolean(safe.wa)&&!safe.needsReview],
    ['Situación: '+(safe.situationLabel||'Sin clasificar'),true],
    ['Regla: '+(rule?.name||rule?.action_label||safe.action||'Revisión manual'),Boolean(safe.ruleKey)],
    ['Horario y bloqueos controlados por '+fuName(safe.unit),!safe.blocked&&!safe.dueAt],
  ];
  return `<aside class="os-fu-side" data-testid="followup-recommended" data-prospect="${esc(safe.id)}">
    <div class="os-fu-side-head"><span>◎ SIGUIENTE RECOMENDADA</span><span class="os-tag">${esc(safe.stageTitle||safe.stage)}</span></div>
    <div class="os-fu-side-ident"><h3>${esc(safe.name)}</h3><p>${esc(safe.zone||'Sin ciudad')} · SCORE ${safe.score==null?'—':esc(String(safe.score))}</p>
      <div><span>WHATSAPP</span><strong>${esc(safe.phone||'Sin WhatsApp')}</strong></div></div>
    <div class="os-fu-side-rule" data-testid="followup-applied-rule"><span>◇ REGLA APLICADA</span><strong>${esc(rule?.name||safe.action||'No hay regla activa')}</strong>
      <p>${esc(rule?.situations?.map(s=>snap.labels?.situations?.[s]||s).join(', ')||safe.situationLabel||'Revisar situación actual')}</p></div>
    <button class="btn primary os-fu-side-execute" type="button" data-fu="claim" data-fu-key="${esc(safe.key)}" data-testid="followup-recommended-execute">↗ EJECUTAR ESTA</button>
    <div class="os-fu-side-status"><span>SITUACIÓN ACTUAL</span><span class="os-fu-pill">${esc(safe.situationLabel||'—')}</span></div>
    <details class="os-fu-side-details" data-testid="followup-recommended-context"><summary>ANTECEDENTES Y NOTAS</summary>
      <div class="os-fu-side-detail"><b>CONTEXTO</b><p>${esc(safe.website||'Sin web')}${safe.properties!=null?' · '+int(safe.properties)+' propiedades':''}</p>${safe.address?`<p>${esc(safe.address)}</p>`:''}<p>En el mensaje: «${esc(safe.shortName||safe.name)}»</p>
      <b>ÚLTIMA ACCIÓN</b><p>${esc(safe.lastText||'Sin acciones anteriores')} · ${esc(ago(safe.since)||'')}</p></div></details>
    <details class="os-fu-side-details" data-testid="followup-recommended-flow"><summary>PRÓXIMO PASO DEL FLUJO</summary>
      <div class="os-fu-side-detail"><p>Ejecutar ${esc(safe.action||'acción pendiente')}. ${esc(safe.actionReason||'El motor del producto determina la próxima etapa al confirmar.')}</p></div></details>
    <details class="os-fu-side-details" data-testid="followup-recommended-preparation"><summary>VALIDACIONES Y MENSAJE</summary>
      <div class="os-fu-side-detail"><b>ANTES DE ENVIAR</b>
      <ul>${checks.map(([label,ok])=>`<li><span>${ok?'✓':'!'}</span>${esc(label)}</li>`).join('')}</ul>
      <b>MENSAJE (${esc(safe.action||'Seguimiento')}${version?' · V'+int(version.version):''})</b>
      <p class="os-fu-side-preview">${esc(version?.body?
        version.body.replaceAll('{{inmobiliaria}}',safe.shortName||safe.name).replaceAll('{{decisor}}',safe.person||''):
        'El texto personalizado se prepara al tomar la tarea. Revisalo antes de enviar.')}</p></div></details>
    <p class="os-fu-caption">Al tomarla, la reserva dura 10 minutos. Abrir WhatsApp no confirma el envío; tenés que confirmarlo después.</p>
  </aside>`;
}

  function fuHoy() {
  const scope=fuScope(),n=state.fu.n;
  const {q,snap,stages,current,rows}=fuQueueSelection(scope);
  const summary=F.summary(n,scope);
  const cards=[
    ['listas','ACCIONES LISTAS',summary.ready,'Disponibles para ejecutar'],
    ['respuestas','RESPUESTAS NUEVAS',summary.replies,'Responder o clasificar'],
    ['demos','DEMOS PENDIENTES',summary.demos,'Por crear o enviar'],
    ['bloqueadas','BLOQUEADAS',summary.blocked,`${summary.scheduled} programadas`],
  ];
  const baseStageRows=q.closed?n.noInteresados:q.kpi==='bloqueadas'?n.blocked:
    q.kpi==='respuestas'?n.queue.filter(x=>x.group==='respuestas'):
    q.kpi==='demos'?n.queue.filter(x=>x.group==='demos'):n.queue;
  const stageCounter=(stage)=>F.filter(baseStageRows,{unit:scope,q:q.search,group:q.group}).filter(x=>
    (!stage||stage.technical.includes(x.stage)&&(!stage.situation||x.situation===stage.situation))&&
    (!q.situation||x.situation===q.situation||x.catalogSituation===q.situation||x.productSituations?.includes(q.situation))&&
    (!q.rule||x.ruleKey===q.rule)).length;
  const canonical=Object.entries(snap?.labels?.situations||{});
  const override=Array.isArray(snap?.catalog?.overrides)?snap.catalog.overrides.filter(x=>!current||x.commercial_stage===current.key):[];
  const situ=[...canonical.filter(([key])=>!override.some(o=>o.key===key&&o.removed)).map(([key,label])=>{
    const o=override.find(a=>a.key===key);return {key,label:o?.label||label}
  }),...(snap?.catalog?.states||[]).filter(s=>s.active&&(!current||s.commercial_stage===current.key)).map(s=>({key:s.key,label:s.label}))];
  const rules=scope!=='todas' && current?F.ruleRows(scope,snap).filter(r=>current.technical.includes(r.stage)): [];
  const showClosed=scope!=='todas' && (current?.key==='contactado'||current?.key==='saludado');
  const closedCount=n.noInteresados.filter(x=>x.unit===scope).length;
  const filterSummary=Object.entries(state.fu.f||{}).filter(([k,v])=>['owner','priority'].includes(k)&&v);
  const reasons=Object.entries(n.blocked.filter(x=>scope==='todas'||x.unit===scope).reduce((obj,x)=>{
    const k=String(x.blocked||'').split(':')[0].trim()||'Sin motivo';obj[k]=(obj[k]||0)+1;return obj;
  },{})).sort((a,b)=>b[1]-a[1]).slice(0,4);
  return `<section class="os-fu-center" data-testid="followup-queue">

    ${scope==='todas'?`<div class="os-fu-stage-grid" aria-label="Unidades"><button class="os-fu-stage ${!state.fu.f.unit||state.fu.f.unit==='todas'?'is-on':''}" data-fu="unit" data-fu-unit="todas">TODOS LOS NEGOCIOS <strong>${n.queue.length}</strong></button>${units().map(u=>`<button class="os-fu-stage ${state.fu.f.unit===u.id?'is-on':''}" data-fu="unit" data-fu-unit="${u.id}">${esc(u.name.toUpperCase())}<strong>${n.queue.filter(x=>x.unit===u.id).length}</strong></button>`).join('')}</div>`:
      `<div class="os-fu-stage-grid" aria-label="Etapas comerciales" data-testid="followup-reference-stage-cards">
        <button class="os-fu-stage is-todas ${!current?'is-on':''}" type="button" aria-pressed="${!current}" data-fu="queue-stage" data-fu-stage=""><span class="os-fu-stage-icon">${fuStageGlyph('todas')}</span><span class="os-fu-stage-label">TODAS</span><strong>${stageCounter(null)}</strong><span class="os-fu-reference-spark" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>
        ${stages.map(s=>`<button class="os-fu-stage is-${esc(s.key)} ${current?.key===s.key?'is-on':''}" type="button" aria-pressed="${current?.key===s.key}" data-fu="queue-stage" data-fu-stage="${esc(s.key)}"><span class="os-fu-stage-icon">${fuStageGlyph(s.key)}</span><span class="os-fu-stage-label">${esc(s.title.toUpperCase())}</span><strong>${stageCounter(s)}</strong></button>`).join('')}
      </div>`}
    <div class="os-fu-kpis">${cards.map(([key,label,value,note])=>`<button type="button" class="os-fu-kpi ${q.kpi===key?'is-on':''}" data-fu="queue-kpi" data-fu-kpi="${key}" aria-pressed="${q.kpi===key}" data-testid="followup-kpi-${key}">
      <span>${label}</span><strong>${int(value)}</strong><small>${esc(note)}</small></button>`).join('')}</div>
    ${scope!=='todas'?`<div class="os-fu-chipbar" data-testid="followup-queue-situations"><strong>SITUACIÓN</strong><div class="os-fu-chips">
      <button type="button" class="${!q.situation?'is-on':''}" data-fu="queue-situation" data-fu-situation="">Todas <b>${n.queue.filter(x=>x.unit===scope&&(!current||current.technical.includes(x.stage))).length}</b></button>
      ${situ.map(s=>`<button type="button" class="${q.situation===s.key?'is-on':''}" data-fu="queue-situation" data-fu-situation="${esc(s.key)}">${esc(s.label)} <b>${n.queue.filter(x=>x.unit===scope&&(!current||current.technical.includes(x.stage))&&(x.situation===s.key||x.catalogSituation===s.key||x.productSituations?.includes(s.key))).length}</b></button>`).join('')}</div></div>`:''}
    ${showClosed?`<div class="os-fu-chipbar"><strong>RESULTADO DEL CONTACTO</strong><div class="os-fu-chips">
      <button type="button" class="${!q.closed?'is-on':''}" data-fu="queue-closed" data-fu-closed="0">Pendientes de acción</button>
      <button type="button" class="${q.closed?'is-on':''}" data-fu="queue-closed" data-fu-closed="1">No interesados <b>${closedCount}</b></button>
      </div><span class="os-fu-caption">Cerrados · sin envíos automáticos</span></div>`:''}
    ${current?.key==='prospectado'&&snap?.summary?.cap?`<div class="os-tutorial-note">Primeros contactos: ${int(snap.summary.newToday||0)} / ${int(snap.summary.cap)} registrados. Los bloqueos y horarios se aplican desde ${esc(fuName(scope))}.</div>`:''}
    <div class="os-fu-banner"><span>COLA DE EJECUCIÓN · ${esc(current?.title||'Todas las etapas')} · ${esc(q.situation?situ.find(s=>s.key===q.situation)?.label||q.situation:'Todas las situaciones')}</span><span>${state.fu.loading?'ACTUALIZANDO…':state.fu.at?'ACTUALIZADA '+esc(dayTime(new Date(state.fu.at).toISOString())):'SIN SINCRONIZAR'} · CADA 60 S</span><button type="button" class="btn small" data-fu="reload" aria-label="Actualizar cola">↻</button></div>
    <div class="os-fu-queue-grid" data-testid="followup-queue-grid">
    <section class="card glass os-fu-tablecard"><div class="os-fu-tablehead"><h2>${int(rows.length)} ${q.closed?'no interesados':q.kpi==='bloqueadas'?'bloqueadas':'en este filtro'}</h2><div class="os-fu-tools">
      <label>ORDENAR<select class="input" data-fu-queue-select="order"><option value="comercial" ${q.order==='comercial'?'selected':''}>Prioridad comercial</option><option value="score" ${q.order==='score'?'selected':''}>Score mayor</option><option value="antiguo" ${q.order==='antiguo'?'selected':''}>Más antiguas</option><option value="reciente" ${q.order==='reciente'?'selected':''}>Más recientes</option></select></label>
      ${rules.length?`<label>REGLA<select class="input" data-fu-queue-select="rule"><option value="">Todas</option>${rules.map(r=>`<option value="${esc(r.key)}" ${q.rule===r.key?'selected':''}>${esc(r.action||r.key)}</option>`).join('')}</select></label>`:''}
      <label>TIPO<select class="input" data-fu-queue-select="group"><option value="">Todos</option>${F.GROUPS.map(g=>`<option value="${g}" ${q.group===g?'selected':''}>${esc(F.GROUP_LABEL[g])}</option>`).join('')}</select></label>
      <input class="input os-fu-search" type="search" data-fu-queue-search value="${esc(q.search||'')}" placeholder="Buscar contacto…" aria-label="Buscar contacto">
      <button type="button" class="btn primary" data-fu="next" ${!rows.some(x=>!x.claim&&!x.blocked&&!x.dueAt&&x.action)||q.closed?'disabled':''} data-testid="fu-take-next">TOMAR LA PRÓXIMA →</button>
    </div></div>
    ${filterSummary.length?`<p class="os-fu-caption">Filtros activos: ${filterSummary.map(([k,v])=>esc(k+'='+v)).join(' · ')}</p>`:''}
    ${q.kpi==='bloqueadas'&&reasons.length?`<div class="os-fu-reasons">${reasons.map(([key,count])=>`<span>${esc(key)} · <b>${count}</b></span>`).join('')}</div>`:''}
    <div class="table-wrap"><table class="os-fu-table"><thead><tr><th>SCORE</th><th>${scope==='turnia'?'CONTACTO':'INMOBILIARIA'}</th><th>CIUDAD</th><th>SITUACIÓN</th><th>PRÓXIMA ACCIÓN</th><th>ÚLTIMA ACCIÓN</th><th>WHATSAPP</th><th>PRIORIDAD</th><th></th></tr></thead>
    <tbody>${rows.slice(0,q.limit).map(x=>fuQueueTableRow(x,{closed:q.closed})).join('')||'<tr><td colspan="9" class="empty">No hay contactos con estos filtros.</td></tr>'}</tbody></table></div>
    ${rows.length>q.limit?`<div style="text-align:center;padding:14px"><button type="button" class="btn" data-fu="queue-more">VER ${int(Math.min(25,rows.length-q.limit))} MÁS</button></div>`:''}
    <p class="os-fu-queue-foot">Conversaciones nuevas en 24 h: <strong>${int(summary.newToday)}</strong> · confirmadas hoy: <strong>${int(summary.doneToday)}</strong></p>
    </section>
    ${q.kpi==='bloqueadas'?'':(state.fu.task?'<aside class="os-fu-side" data-testid="followup-execution-aside">'+renderFuTask(state.fu.task)+'</aside>':fuRecommended(scope,rows,current,q))}
    </div>
    <details class="card glass" data-fu-details="sched" ${state.fu.open.sched?'open':''}><summary><strong>Programadas</strong> <span class="count">${int(n.scheduled.filter(x=>scope==='todas'||x.unit===scope).length)}</span></summary><div class="rows">
      ${n.scheduled.filter(x=>scope==='todas'||x.unit===scope).slice(0,50).map(x=>fuRow(x,{button:false})).join('')||'<p class="empty">Sin programadas.</p>'}</div></details>
    <details class="card glass" data-fu-details="blocked" ${state.fu.open.blocked?'open':''}><summary><strong>Bloqueadas</strong> <span class="count">${int(n.blocked.filter(x=>scope==='todas'||x.unit===scope).length)}</span></summary><div class="rows">
      ${n.blocked.filter(x=>scope==='todas'||x.unit===scope).slice(0,50).map(x=>fuRow(x,{button:false})).join('')||'<p class="empty">Sin bloqueadas.</p>'}</div></details>
  </section>`;
}
  function fuReplyState() {
  return state.fu.replyView || (state.fu.replyView={selected:null,manual:false});
}

  function fuReplies() {
  const scope=fuScope(), n=state.fu.n;
  const rows=F.inboxItems(n,scope);
  const stateReply=fuReplyState();
  const selected=rows.find(r=>r.key===stateReply.selected)||rows[0]||null;
  const snap=selected?n.units[selected.unit]:n.units[scope];
  const allowed=selected?.unit==='habita'
    ? (snap?.catalog?.canonical||[]).filter(o=>o.key!=='sin_respuesta')
    : Object.entries(snap?.labels?.situations||{}).filter(([key])=>key!=='sin_respuesta').map(([key,label])=>({key,label}));
  const without=rows.filter(x=>!x.classification||x.status==='pendiente').length;
  const facu=rows.filter(x=>x.status==='facu').length;
  const any=scope!=='todas';
  const opts=(snap?.labels?.situations||{});
  const newManual=stateReply.manual&&any?`<form class="card glass os-fu-manual-form" data-fu-manual-reply-form>
    <div class="os-section-heading"><h2>Registrar una respuesta manual</h2><button type="button" class="btn small" data-fu="reply-manual">CERRAR</button></div>
    <p class="os-fu-caption">Usá este formulario cuando recibiste un mensaje que no quedó registrado por la extensión o la lectura de WhatsApp.</p>
    <label class="field"><span>Contacto</span><select class="input" name="id" required><option value="">Elegí un contacto</option>
    ${[...new Map([...n.queue,...n.scheduled,...n.blocked].filter(x=>x.unit===scope).map(x=>[x.id,x])).values()].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.stageTitle||'')}</option>`).join('')}</select></label>
    <label class="field"><span>Texto original</span><textarea class="input" name="texto" rows="3" maxlength="4000" required placeholder="Copiá lo que respondió…"></textarea></label>
    <label class="field"><span>Clasificación</span><select class="input" name="clase"><option value="">${scope==="turnia"?"Sin clasificar (Turnia registra Neutro)":"Clasificar más tarde"}</option>
    ${allowed.map(x=>`<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('')}</select></label>
    <button class="btn primary" type="submit">REGISTRAR RESPUESTA</button></form>`:'';
  const item=selected?`
    <div class="os-fu-conversation-head"><div><span class="os-kicker">CONVERSACIÓN SELECCIONADA</span><h2>${esc(selected.name)}</h2><p class="os-fu-caption">${esc(selected.phone||'')} · ${esc(selected.stage||'')}</p></div><span class="os-tag">${esc(fuName(selected.unit))}</span></div>
    <div class="os-fu-reply-bubble">${esc(selected.body||'No hay texto original registrado. Consultá WhatsApp antes de clasificar.')}<small>${esc(dayTime(selected.receivedAt)||'')}</small></div>
    ${selected.note?`<p class="os-fu-caption">Nota: ${esc(selected.note)}</p>`:''}
    <form data-fu-inbox-form data-fu-reply-key="${esc(selected.key)}">
      <fieldset class="os-fu-reply-classes"><legend>CLASIFICACIÓN ${selected.confidence!=null?' · sugerida '+Math.round(selected.confidence*100)+'%':''}</legend>
      <div class="os-fu-chips">${allowed.map(o=>`<label><input type="radio" name="clase" value="${esc(o.key)}" ${selected.classification===o.key?'checked':''}><span>${esc(o.label)}</span></label>`).join('')}</div></fieldset>
      ${selected.unit==='habita'?`<div class="os-fu-conditional" data-reply-condition="mas_adelante" ${selected.classification==="mas_adelante"?"":"hidden"}>
        <label class="field"><span>Retomar el contacto (opcional)</span><input class="input" type="date" name="hasta"></label></div>
      <div class="os-fu-conditional" data-reply-condition="derivo" ${selected.classification==="derivo"?"":"hidden"}>
        <label class="field"><span>Nombre de la nueva persona</span><input class="input" name="contactoNombre" maxlength="120"></label>
        <label class="field"><span>WhatsApp del referido</span><input class="input" name="contactoWhatsapp" maxlength="40"></label></div>`:''}
      <label class="field" style="margin-top:14px"><span>Observación (opcional)</span><textarea class="input" name="nota" rows="2" maxlength="700" placeholder="Contexto para la siguiente acción…"></textarea></label>
      <div class="os-fu-actions"><button type="submit" class="btn primary" ${!selected.body?'disabled title="No hay texto para clasificar."':''}>APLICAR CLASIFICACIÓN</button>
      ${selected.unit==='habita'?'<button type="submit" class="btn" name="facu" value="1">ENVIAR A REVISIÓN</button>':''}
      <button type="button" class="btn" data-fu="reply-to-queue" data-fu-id="${esc(selected.id)}">VER EN COLA →</button></div>
      <p class="os-fu-caption">Las bajas y solicitudes de no contactar quedan protegidas por el motor de cada producto. La clasificación no envía WhatsApp por sí sola.</p>
    </form>`:'<p class="empty">No hay respuestas pendientes.</p>';
  return `<section class="hero"><div><span class="eyebrow">${scope==='todas'?'GENERAL':esc(fuName(scope).toUpperCase())} / RESPUESTAS</span>
    <h1>Conversaciones que importan.</h1><p>La misma bandeja del Follow-up de Habita: mensaje original, clasificación, contexto y siguiente acción. La conversación pertenece al producto.</p></div>
    ${any?`<button class="btn" type="button" data-view="responder-legado">BANDEJA DE WHATSAPP ↗</button>`:''}</section>
    <section class="os-fu-kpis" data-testid="followup-inbox">
      <div class="os-fu-kpi"><span>SIN CLASIFICAR</span><strong>${int(without)}</strong><small>Requieren revisión</small></div>
      <div class="os-fu-kpi"><span>PARA FACU</span><strong>${int(facu)}</strong><small>Respuestas especiales</small></div>
      <div class="os-fu-kpi"><span>CONFIANZA MÍNIMA</span><strong>${scope==='habita'?'70%':'—'}</strong><small>${scope==='habita'?'Clasificación automática':'Clasificación por el equipo'}</small></div>
      <button type="button" class="os-fu-kpi" data-fu="reply-manual" ${!any?'disabled':''} aria-expanded="${stateReply.manual}"><span>¿LLEGÓ UNA RESPUESTA?</span><strong>+</strong><small>Registrala a mano</small></button>
    </section>${newManual}
    <section class="card glass os-fu-inbox-grid"><div class="os-fu-conversation-list" aria-label="Respuestas pendientes">
      ${rows.map(r=>`<button type="button" class="os-fu-conversation ${selected?.key===r.key?'is-on':''}" data-fu="reply-select" data-fu-key="${esc(r.key)}">
        <span class="os-fu-conv-head"><strong>${esc(r.name)}</strong><time>${esc(dayTime(r.receivedAt)||'')}</time></span>
        <span class="os-fu-conv-text">«${esc(r.body||'Mensaje sin texto guardado')}»</span>
        <span class="os-fu-conv-status">${esc(r.status==='facu'?'PARA FACU':opts[r.classification]||r.classification||'SIN CLASIFICAR')}</span>
      </button>`).join('')||'<p class="empty">No hay respuestas pendientes.</p>'}
    </div><div class="os-fu-reply-detail" data-testid="followup-reply-detail">${item}</div></section>`;
}

  async function fuReplySubmit(form,submitter) {
  const fd=new FormData(form), scope=fuScope();
  if(form.matches('[data-fu-inbox-form]')){
    const r=F.inboxItems(state.fu.n,scope).find(x=>x.key===form.dataset.fuReplyKey);
    if(!r)return;
    const classification=fd.get('clase')||null, review=submitter?.name==='facu';
    if(!classification&&!review){toast('Elegí una clasificación.',true);return;}
    if(r.unit==='habita'){
      const until=fd.get('hasta')?new Date(String(fd.get('hasta'))+'T09:00:00-03:00').toISOString():null;
      const fields={op:'reply',id:r.replyId,clasificacion:classification,
        facu:review,nota:String(fd.get('nota')||''),contactoNombre:String(fd.get('contactoNombre')||''),
        contactoWhatsapp:String(fd.get('contactoWhatsapp')||''),hasta:until};
      if(!await fuOp(r.unit,fields,{label:review?'Enviada a revisión.':'Respuesta clasificada.'}))return;
    }else{
      if(review)return;
      // La respuesta ya consta en la auditoría de Turnia: actualizar su situación, no duplicarla.
      if(!await fuOp(r.unit,{op:'situation',inmobiliaria:r.id,situacion:classification,
        texto:r.body||String(fd.get('nota')||'Clasificada desde Chapa')},{label:'Respuesta clasificada.'}))return;
    }
    await loadFollowup({quiet:true});fuReplyState().selected=null;render();
  }else if(form.matches('[data-fu-manual-reply-form]')){
    const id=String(fd.get('id')||''), body=String(fd.get('texto')||'').trim(),classification=String(fd.get('clase')||'');
    if(!id||!body){toast('Elegí el contacto y copiá su respuesta.',true);return;}
    const data={op:'reply',inmobiliaria:id,texto:body,...(classification?{clasificacion:classification,confianza:1}:{})};
    if(!await fuOp(scope,data,{label:'Respuesta registrada.'}))return;
    fuReplyState().manual=false;await loadFollowup({quiet:true});render();
  }
}

  function fuBlockReasons(list) {
    const c = {};
    for (const x of list) { const k = String(x.blocked || '').split(':')[0].split('(')[0].trim(); c[k] = (c[k] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(' · ') || 'sin bloqueos';
  }

  function fuChartPeriod() {
  return state.fu.chartPeriod||(state.fu.chartPeriod={preset:'todo',from:'',to:''});
}

  function fuNativeChart(snap) {
  const chart=snap?.chart,lostAt=snap?.lostAt,rows=snap?.chartRows;
  if(!Array.isArray(chart)||!Array.isArray(lostAt)||!Array.isArray(rows))
    return `<div class="os-funnel-note" data-testid="followup-native-chart-unavailable">El embudo histórico original todavía no está disponible en la API. El resumen de etapas y reglas se mantiene debajo.</div>`;
  const period=fuChartPeriod(),focus=state.fu.chartFocus||null;
  const counts=chart.map(x=>Number(x.count)||0),max=Math.max(0,...counts);
  const below=counts.filter(n=>n>0&&n<=max*.3),limit=below.length?Math.max(...below)*1.25:max;
  const broken=max>0&&limit<max/3;
  const height=n=>{
    if(n<=0||max<=0)return 0;
    if(!broken)return 100*n/max;
    if(n<=limit)return n/limit*78;
    return 78+22*Math.log(n/limit)/Math.log(max/limit);
  };
  const segment=(i,mode,count,label,style,extra='')=>{
    if(count<=0)return '';
    const selected=focus?.step===i&&focus.mode===mode;
    return `<button type="button" class="os-native-segment is-${mode} ${selected?'is-on':''} ${extra}" style="${style}" data-fu="funnel-select" data-fu-step="${i}" data-fu-mode="${mode}"
      aria-label="${int(count)} ${esc(label)}. Ver inmobiliarias" aria-pressed="${selected}" title="${int(count)} · ${esc(label)}">${int(count)}</button>`;
  };
  const picks=chart.map((x,i)=>{
    const count=Number(x.count)||0,last=i===chart.length-1,next=Number(chart[i+1]?.count||0);
    const advanced=last?count:next,lost=last?0:Number(lostAt[i]||0),stayed=Math.max(0,count-advanced-lost);
    const full=height(count),went=height(advanced),rest=Math.max(0,full-went);
    const selected=focus?.step===i&&focus.mode==='arrived';
    const label=x.label||`Paso ${i+1}`;
    return `<li class="os-native-step">
      <button type="button" class="os-native-step-top ${selected?'is-on':''}" aria-pressed="${selected}" data-fu="funnel-select" data-fu-step="${i}" data-fu-mode="arrived"
        title="Ver las ${int(count)} que llegaron a ${esc(label)}"><strong>${int(count)}</strong><small>${i===0?'Base del período':x.ofPrevious==null?'—':`${int(x.ofPrevious)}% del paso anterior`}</small></button>
      <div class="os-native-step-plot">
        ${count?`<div class="os-native-bar ${broken&&count>limit?'is-broken':''}" style="height:max(${full.toFixed(3)}%,${(stayed>0?1:0)+(lost>0?1:0)+(advanced>0?1:0)*24}px)">
          ${segment(i,'stayed',stayed,`se quedaron en ${label}`,`flex-grow:${stayed+lost?(rest*stayed/(stayed+lost)).toFixed(3):0}`)}
          ${segment(i,'lost',lost,`se perdieron en ${label}`,`flex-grow:${stayed+lost?(rest*lost/(stayed+lost)).toFixed(3):0}`)}
          ${broken&&count>limit&&(stayed>0||lost>0)&&advanced>0?'<span class="os-native-break" aria-hidden="true"></span>':''}
          ${segment(i,'advanced',advanced,last?'clientes pagos':`pasaron a ${chart[i+1]?.label||'el siguiente paso'}`,`flex-grow:${Math.max(1,went).toFixed(3)}`,last?'is-last':'')}
        </div>`:'<span class="os-native-zero"></span>'}
      </div><div class="os-native-step-label"><b>${i+1}. ${esc(label)}</b><small>${int(stayed)} permanecen${lost?` · ${int(lost)} perdidas`:''}</small></div></li>`;
  }).join('');
  let detail='';
  if(focus){
    const step=Number(focus.step),mode=focus.mode;
    const chosen=rows.filter(x=>{
      const s=Number(x.step);
      if(x.step===null)return false;
      if(mode==='lost')return s===step&&x.lost===true;
      if(mode==='stayed')return s===step&&!x.lost;
      if(mode==='advanced')return s>=(step===chart.length-1?step:step+1);
      return s>=step;
    });
    const name=chart[step]?.label||`Paso ${step+1}`;
    const kind=mode==='lost'?'No interesadas':mode==='stayed'?'Se quedaron':mode==='advanced'?'Pasaron al siguiente paso':'Llegaron al paso';
    detail=`<section class="card glass os-native-drilldown" data-testid="followup-funnel-drilldown"><div class="os-section-heading">
      <div><span class="os-kicker">${esc(kind.toUpperCase())}</span><h2>${int(chosen.length)} inmobiliarias · ${esc(name)}</h2></div>
      <button type="button" class="btn small" data-fu="funnel-reset">CERRAR FILTRO</button></div>
      <div class="table-wrap"><table><thead><tr><th>INMOBILIARIA</th><th>SCORE</th><th>WHATSAPP</th><th>ÚLTIMO PASO ALCANZADO</th></tr></thead><tbody>
        ${chosen.slice(0,300).map(x=>`<tr><td><strong>${esc(x.name||'Sin nombre')}</strong></td>
          <td>${x.score==null?'—':int(x.score)}</td><td>${esc(x.whatsapp||'—')}</td>
          <td>${esc(chart[x.step]?.label||'—')}</td></tr>`).join('')||'<tr><td colspan="4">No hay inmobiliarias para este filtro.</td></tr>'}
      </tbody></table></div>${chosen.length>300?'<p class="os-fu-caption">Se muestran las primeras 300.</p>':''}</section>`;
  }
  return `<section class="os-native-funnel" data-testid="followup-native-funnel">
    <div class="os-native-head"><div><h2>Funnel comercial</h2><p>Cada paso cuenta las inmobiliarias que llegaron hasta ahí. El porcentaje compara con el anterior.</p></div>
      <div class="os-native-period"><span>PERÍODO</span><nav aria-label="Período del embudo">${[['hoy','Hoy'],['7','7 días'],['30','30 días'],['mes','Este mes'],['todo','Todo']].map(([key,label])=>`<button type="button" data-fu="funnel-period" data-fu-period="${key}" class="${period.preset===key&&!period.from&&!period.to?'is-on':''}">${label}</button>`).join('')}</nav>
        <form data-fu-chart-range><label>Desde <input class="input" type="date" name="desde" value="${esc(period.from||'')}"></label>
          <label>Hasta <input class="input" type="date" name="hasta" value="${esc(period.to||'')}"></label>
          <button class="btn small" type="submit">APLICAR</button></form></div></div>
    <div class="os-native-legend"><span><i class="is-went"></i>Pasaron al paso siguiente</span>
      <span><i class="is-stayed"></i>Se quedaron (seguimiento)</span><span><i class="is-lost"></i>Perdidas (no interesadas)</span></div>
    <div class="os-native-chart-scroll"><ol class="os-native-chart" aria-label="Embudo comercial histórico">${picks}</ol></div>
    <p class="os-native-note">Elegí una cifra o un segmento de barra para consultar sus inmobiliarias. Los datos, el período y las pérdidas provienen del embudo original de Habita; las barras grandes pueden mostrar un corte de escala.</p>
    ${detail}
  </section>`;
}

  function fuPipeline() {
  const n=state.fu.n, scope=fuScope();
  if(scope==='todas'){
    const cards=units().filter(u=>n.units[u.id]).map(u=>{
      const stages=F.commercialStages(u.id,n.units[u.id]);
      const live=F.summary(n,u.id);
      return `<button type="button" class="os-business-card" data-business="${u.id}" data-goto="${u.id}" data-view-to="pipeline">
        <div class="os-business-head"><span class="os-kicker">EMBUDO ${esc(u.name.toUpperCase())}</span><span class="os-tag">${int(live.ready)} LISTAS</span></div><h2>${esc(u.name)}</h2>
        <p>${stages.length} etapas comerciales con sus definiciones de conversión independientes.</p>
        <div class="os-business-metrics"><div><strong>${int(stages[0]?.reached||0)}</strong><small>Inicio</small></div>
        <div><strong>${int(stages.reduce((s,x)=>s+x.waiting,0))}</strong><small>En etapas</small></div>
        <div><strong>${int(live.blocked)}</strong><small>Bloqueadas</small></div></div>
      </button>`;
    }).join('');
    return `<section class="hero"><div><span class="eyebrow">GENERAL / EMBUDOS</span><h1>El recorrido de cada negocio.</h1><p>Seleccioná un negocio para ver sus etapas, situaciones, reglas y contactos. No se agregan tasas de conversión incompatibles.</p></div></section><div class="os-business-cards">${cards}</div>`;
  }
  const snap=n.units[scope];
  if(!snap)return `<section class="card glass"><p>El embudo de ${esc(fuName(scope))} no está disponible.</p></section>`;
  const stages=F.commercialStages(scope,snap);
  const selected=stages.find(s=>s.key===state.fu.pipelineStage)||stages[0];
  const tech=(selected?.technical||[]).includes(state.fu.technicalStage)?state.fu.technicalStage:null;
  const activeTech=tech||selected?.technical?.[0]||null;
  const selectedSituation=state.fu.pipelineSituation||selected?.situation||null;
  const all=[...n.queue,...n.scheduled,...n.blocked].filter(x=>x.unit===scope);
  const matchStage=x=>selected?.technical?.includes(x.stage)&&(!selected.situation||selected.situation===x.situation);
  const situationRows=all.filter(matchStage);
  const canonical=Object.entries(snap.labels?.situations||{});
  const hidden=(snap.catalog?.overrides||[]).filter(o=>o.commercial_stage===selected?.key&&o.removed);
  const situations=canonical.filter(([key])=>!hidden.some(h=>h.key===key)).map(([key,label])=>({key,label}));
  const custom=(snap.catalog?.states||[]).filter(s=>s.active&&s.commercial_stage===selected?.key).map(s=>({key:s.key,label:s.label}));
  situations.push(...custom);
  const rows=F.filter(all.filter(x=>matchStage(x)&&(!tech||x.stage===tech)&&
    (!selectedSituation||x.situation===selectedSituation||x.catalogSituation===selectedSituation||x.productSituations?.includes(selectedSituation))),
    {...state.fu.f,unit:scope});
  const own=F.ruleRows(scope,snap).filter(r=>selected?.technical?.includes(r.stage)&&(!tech||r.stage===tech));
  const versions=F.versionRows(scope,snap);
  const activeVersions=(stage,action)=>versions.filter(v=>v.stage===stage && v.action===action);
  const selectedTechnical=snap.stages?.find(x=>x.key===activeTech);
  return `<section class="hero"><div><span class="eyebrow">${esc(fuName(scope).toUpperCase())} / EMBUDO</span><h1>Etapas y decisiones.</h1><p>La misma lectura del Follow-up de Habita: elegí una etapa y revisá sus pasos, situaciones, reglas y prospectos, sin cambiar la lógica del motor.</p></div></section>
    ${scope==='habita'?fuNativeChart(snap):''}
    <section class="card glass" data-testid="followup-funnel"><div class="os-funnel-title"><div><span class="os-kicker">EMBUDO COMERCIAL</span><h2>${esc(fuName(scope))} · ${stages.length} etapas</h2></div><button type="button" class="btn small" data-view="etapas">ETAPAS Y SITUACIONES →</button></div>
    <div class="os-fu-stage-grid" data-testid="followup-funnel-stages">
      ${stages.map(s=>`<button type="button" class="os-fu-stage is-${esc(s.key)} ${selected?.key===s.key?'is-on':''}" aria-pressed="${selected?.key===s.key}" data-fu="pipeline-stage" data-fu-stage="${esc(s.key)}"><span class="os-fu-stage-icon">${fuStageGlyph(s.key)}</span><span class="os-fu-stage-label">${esc(s.title.toUpperCase())}</span><strong>${int(s.waiting)}</strong></button>`).join('')}
    </div>
    ${selected?.technical?.length>1?`<div class="os-fu-chipbar" data-testid="followup-funnel-substages"><strong>ETAPA TÉCNICA</strong><div class="os-fu-chips">
      <button type="button" class="${!tech?'is-on':''}" data-fu="pipeline-technical" data-fu-stage="">Todas <b>${int(selected.waiting)}</b></button>
      ${selected.technical.map(key=>{const s=snap.stages.find(x=>x.key===key);return `<button type="button" class="${tech===key?'is-on':''}" data-fu="pipeline-technical" data-fu-stage="${esc(key)}">${esc(s?.title||key)} <b>${int(s?.waiting||0)}</b></button>`}).join('')}
    </div></div>`:''}
    <div class="os-fu-chipbar"><strong>SITUACIÓN</strong><div class="os-fu-chips">
      <button class="${!selectedSituation?'is-on':''}" data-fu="pipeline-situation" data-fu-situation="">Todas <b>${int(situationRows.length)}</b></button>
      ${situations.map(s=>`<button type="button" class="${selectedSituation===s.key?'is-on':''}" data-fu="pipeline-situation" data-fu-situation="${esc(s.key)}">${esc(s.label)}
        <b>${int(situationRows.filter(x=>x.situation===s.key||x.catalogSituation===s.key||x.productSituations?.includes(s.key)).length)}</b></button>`).join('')}
    </div></div>
    <div class="os-fu-banner"><strong>${esc(selected?.title||'')}</strong><span>${int(selected?.waiting||0)} EN LA ETAPA · ${activeTech?'OBJETIVO: '+esc(selectedTechnical?.goal||'siguiente paso'):'SIN PASO PENDIENTE'}</span><button class="btn small" data-view="secuencias">EDITAR REGLAS →</button></div>
    <div class="os-fu-rules">
      ${own.map(r=>{
        const vv=activeVersions(r.stage,r.raw?.action||'principal'),active=vv.find(v=>v.status==='active'),test=vv.find(v=>v.status==='test');
        return `<div class="os-fu-rule"><small>${esc(r.when)} · ${esc(r.wait)}</small><strong>${esc(r.action)}</strong><span>${active?'V'+int(active.version)+' ACTIVA':'SIN VERSIÓN ACTIVA'}${r.enabled?'':' · REGLA APAGADA'}</span>
          <div><b>${active?pct(active.rate):'—'}</b> AVANZARON · ${int(active?.executed||0)} EJECUCIONES ${test?'<span class="os-tag">A/B</span>':''}</div></div>`;
      }).join('')||'<p class="os-fu-caption">No hay reglas configuradas en esta etapa.</p>'}
    </div></section>
    <section class="card glass os-fu-tablecard"><div class="os-fu-tablehead"><div><span class="os-kicker">CONTACTOS EN ESTA ETAPA</span><h2>${int(rows.length)} ${scope==='habita'?'inmobiliarias':'contactos'} con seguimiento</h2></div><button type="button" class="btn small" data-view="hoy">IR A LA COLA →</button></div>
    ${fuToolbar()}
    <div class="table-wrap"><table class="os-fu-table"><thead><tr><th>SCORE</th><th>CONTACTO</th><th>CIUDAD</th><th>SITUACIÓN</th><th>PRÓXIMA ACCIÓN</th><th>ÚLTIMA ACCIÓN</th><th>WHATSAPP</th><th>PRIORIDAD</th><th></th></tr></thead>
    <tbody>${rows.slice(0,100).map(x=>fuQueueTableRow(x)).join('')||'<tr><td colspan="9" class="empty">No hay contactos con seguimiento vigente en este filtro.</td></tr>'}</tbody></table></div>
    ${rows.length>100?'<p class="os-fu-caption" style="padding:12px">Se muestran 100. Usá Prospectos para consultar la lista completa.</p>':''}</section>`;
}

  function fuProspectos() {
    const n = state.fu.n;
    const f = state.fu.f;
    const all = F.filter([...n.queue, ...n.scheduled, ...n.blocked], { ...f, unit: fuScope() });
    const shown = state.more['fu-prospectos'] ? all.length : 100;
    return `<section class="hero"><div><span class="eyebrow">Prospectos</span><h1>${int(all.length)} en seguimiento</h1><p>Todos los que tienen una próxima acción en algún producto. Tocá uno para ver su contexto, su historia y lo que se puede hacer.</p></div></section>
      ${fuToolbar()}
      <section class="card glass"><div class="table-wrap"><table><thead><tr><th>Prospecto</th><th>Producto</th><th>Responsable</th><th>Etapa</th><th>Situación</th><th>Próxima acción</th><th>Prioridad</th><th>Último contacto</th><th>Estado</th></tr></thead><tbody>
      ${all.slice(0, shown).map((x) => `<tr data-fu-open="${esc(x.key)}" tabindex="0" style="cursor:pointer"><td><strong>${esc(x.name)}</strong>${x.sub && x.sub !== x.name ? `<div class="sub">${esc(x.sub)}</div>` : ''}</td><td>${esc(fuName(x.unit))}</td><td>${esc(x.owner || '—')}</td><td>${esc(x.stageTitle)}</td><td>${esc(x.situationLabel)}</td><td>${esc(x.action || x.actionReason || '—')}</td><td>${esc(F.PRIORITY_LABEL[x.priority])}</td><td>${esc(ago(x.since) || '—')}</td><td>${x.claim ? `Lo tiene ${esc(x.claim.by)}` : x.blocked ? `<span style="color:var(--bad-text)">${esc(x.blocked)}</span>` : x.dueAt ? `Sale ${esc(dayTime(x.dueAt))}` : 'Lista'}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Sin resultados.</td></tr>'}
      </tbody></table></div>${all.length > shown ? `<div style="text-align:center;padding:8px"><button class="btn small" type="button" data-more-block="fu-prospectos">Ver los ${int(all.length - shown)} restantes</button></div>` : ''}</section>`;
  }

  function fuRuleEditor(unit,snap) {
  if(unit!=='habita'||!state.fu.ruleEdit)return '';
  const create=state.fu.ruleEdit==='__new';
  const stage=create?state.fu.ruleDraftStage:null;
  const existing=create?null:(snap.rules||[]).find(x=>x.key===state.fu.ruleEdit);
  if(!create&&!existing)return '';
  const key=stage||existing.stage;
  const actions=snap.catalog?.actions?.[key]||[{key:'principal',label:'Mensaje de la etapa'}];
  const allowed=actions.map(a=>a.key);
  const tpl=create?(snap.rules||[]).find(r=>r.key===state.fu.ruleTemplate):null;
  const siblings=(snap.rules||[]).filter(r=>r.stage===key);
  const defaults={stage:key,action:allowed[0],situations:[key==='no-contactado'?'sin_respuesta':key==='no-responde'?'confirmo_numero':'interesado'],
    after_hours:48,after_action:null,position:Math.max(0,...siblings.map(r=>Number(r.position)||0))+10,
    enabled:true,hours_from:9,hours_to:19,days:[1,2,3,4,5,6],name:'',catalog_situation:null,min_demo_activity_level:0};
  const r=existing||{...defaults,...(tpl||{}),key:null,stage:key,
    action:tpl&&allowed.includes(tpl.action)?tpl.action:defaults.action,
    after_action:tpl&&allowed.includes(tpl.after_action)?tpl.after_action:null,
    catalog_situation:tpl?.catalog_situation||null,
    min_demo_activity_level:['no-abrio','sin-interaccion','sin-cuenta'].includes(key)?(tpl?.min_demo_activity_level||0):0,
    position:defaults.position,
    name:tpl?.name?`Copia de ${tpl.name}`.slice(0,80):''};
  const stageCommercial=F.commercialStages(unit,snap).find(s=>s.technical.includes(key))?.key;
  const overrides=(snap.catalog?.overrides||[]).filter(s=>s.commercial_stage===stageCommercial&&s.removed);
  const labels=Object.entries(snap.labels?.situations||{}).filter(([s])=>{
    const cat=snap.catalog?.canonical?.find(x=>x.key===s);
    return (!cat||!cat.permanent_stop||s==='rechazo')&&!overrides.some(x=>x.key===s);
  });
  const custom=(snap.catalog?.states||[]).filter(s=>s.active&&(s.maps_to||s.product_stage===key)
    &&(s.commercial_stage===stageCommercial||(snap.catalog?.stages||[]).some(x=>x.key===s.commercial_stage&&x.technical_stage===key)));
  const surveyed=r.action==='encuesta_cierre';
  const allowRejection=allowed.includes('encuesta_cierre');
  const days=[['DO',0],['LU',1],['MA',2],['MI',3],['JU',4],['VI',5],['SA',6]];
  const rank=existing?siblings.sort((a,b)=>(a.position||999)-(b.position||999)).findIndex(x=>x.key===r.key)+1:0;
  return `<form class="card glass fu-ref-editor fu-ref-rule-form" data-fu-rule-form data-fu-rule-key="${esc(r.key||'')}"
    data-fu-unit-id="habita" data-fu-stage="${esc(key)}" data-fu-position="${Number(r.position)||10}" data-testid="followup-rule-form">
    <header class="fu-ref-edit-head"><div><div class="fu-ref-titleline"><span class="os-tag">${create?'NUEVA REGLA':'PRIORIDAD P'+rank}</span>
      <label class="field"><span class="sr-only">NOMBRE DE LA REGLA</span><input class="input fu-ref-rule-name" name="name" maxlength="80" value="${esc(r.name||'')}" placeholder="${esc(actions.find(a=>a.key===r.action)?.label||'Nombre de la regla')}" data-testid="followup-rule-name"></label></div>
      <p class="os-view-caption">Gana la primera regla compatible. Los cambios se guardan en el motor de Habita.</p></div>
      <label class="fu-ref-switch"><input type="checkbox" name="enabled" ${r.enabled!==false?'checked':''} data-testid="followup-rule-enabled">ACTIVA</label>
    </header>
    <section class="fu-ref-when" data-testid="followup-part-when"><h3>◷ CUÁNDO SE EJECUTA</h3>
      ${create&&tpl?'<p class="os-warn-note">Regla copiada: revisá y adaptá la situación, el mensaje y la etapa antes de guardarla.</p>':''}
      <label class="field"><span>ETAPA DEL EMBUDO</span><input class="input" value="${esc(snap.stages?.find(x=>x.key===key)?.title||key)}" disabled></label>
      <div class="field"><span>SITUACIÓN (CUALQUIERA DE)</span><div class="fu-ref-classifiers" data-testid="followup-rule-situations">
        ${labels.map(([id,label])=>`<label><input type="checkbox" name="sit" value="${esc(id)}" ${(r.situations||[]).includes(id)?'checked':''} ${id==='rechazo'&&!allowRejection?'disabled title="Esta etapa no admite encuesta de cierre"':''}><span>${esc(label)}</span></label>`).join('')}
      </div></div>
      ${custom.length?`<label class="field"><span>SITUACIÓN PERSONALIZADA</span><select class="input" name="catalog_situation"><option value="">Ninguna</option>${custom.map(s=>`<option value="${esc(s.key)}" ${r.catalog_situation===s.key?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label>`:''}
      <label class="field"><span>PASO PREVIO</span><select class="input" name="after_action"><option value="">Ningún paso</option>
        ${actions.filter(a=>a.key!==r.action&&a.key!=='encuesta_cierre').map(a=>`<option value="${esc(a.key)}" ${r.after_action===a.key?'selected':''}>${esc(a.label)}</option>`).join('')}</select></label>
      <label class="field"><span>ESPERA</span><div class="fu-ref-wait"><input class="input" name="after_hours" type="number" min="0" max="720" value="${Number(r.after_hours)||0}" required data-testid="followup-rule-hours"><small>horas desde nuestro último mensaje</small></div></label>
      <div class="fu-ref-fields">
        <label class="field"><span>DÍAS DE ENVÍO</span><div class="fu-ref-classifiers">${days.map(([d,i])=>`<label><input type="checkbox" name="days" value="${i}" ${(r.days||[]).includes(i)?'checked':''}><span>${d}</span></label>`).join('')}</div></label>
        <label class="field"><span>HORARIO</span><div class="fu-ref-hours"><input class="input" name="hours_from" type="number" min="0" max="23" value="${r.hours_from??9}" required><span>A</span><input class="input" name="hours_to" type="number" min="0" max="23" value="${r.hours_to??19}" required></div></label>
      </div>
      ${['no-abrio','sin-interaccion','sin-cuenta'].includes(key)?`<label class="field"><span>CONDICIÓN DE INTERACCIÓN CON LA DEMO</span><select class="input" name="min_demo_activity_level"><option value="0" ${(r.min_demo_activity_level||0)===0?'selected':''}>Cualquier nivel de interacción</option><option value="3" ${r.min_demo_activity_level===3?'selected':''}>Solo si generó una imagen</option></select></label>`:''}
    </section>
    <section class="fu-ref-what" data-testid="followup-part-what"><h3>◇ QUÉ SE EJECUTA</h3>
      <label class="field"><span>ACCIÓN DE LA REGLA</span><select class="input" name="action" data-fu-rule-action data-testid="followup-rule-action">
        ${actions.map(a=>`<option value="${esc(a.key)}" ${r.action===a.key?'selected':''}>${esc(a.label)}</option>`).join('')}</select></label>
      <p class="os-view-caption">${surveyed?'La encuesta de cierre se envía solo si el motor confirma la situación «No interesado».':'La acción utiliza la versión de mensaje vinculada a esta etapa. Podés editarla en el panel contiguo.'}</p>
    </section>
    <footer class="fu-ref-buttons"><button type="button" class="btn" data-fu="rules-cancel">CANCELAR</button>
      <button type="submit" class="btn primary" data-testid="followup-rule-save" ${state.session?.open?'disabled title="Requiere sesión protegida"':''}>${create?'CREAR REGLA':'GUARDAR CAMBIOS'}</button></footer>
  </form>`;
}

  function fuVersionEditor(unit, snap, stageKey) {
  if(unit!=='habita'||!state.fu.versionEdit)return '';
  const version=(snap.stages||[]).flatMap(s=>s.versions||[]).find(v=>v.id===state.fu.versionEdit&&v.stage===stageKey);
  if(!version)return '';
  return `<form class="section" data-fu-version-edit-form data-fu-unit-id="${unit}" data-fu-version="${esc(version.id)}" style="margin-top:12px">
    <div class="os-section-heading"><h3>EDITAR V${version.version}</h3><button type="button" class="btn small" data-fu="version-edit" data-fu-version="">CERRAR</button></div>
    <p class="os-warn-note">Editar el texto de una versión mezcla métricas del texto anterior y el nuevo. Para A/B creá otra versión.</p>
    <label class="field"><span>Mensaje</span><textarea class="input" name="body" rows="6" required>${esc(version.body||'')}</textarea></label>
    <label class="field"><span>Observaciones</span><textarea class="input" name="notes" rows="3">${esc(version.notes||'')}</textarea></label>
    <button class="btn primary" type="submit">GUARDAR VERSIÓN</button>
  </form>`;
}

  async function handleFuEditorSubmit(form) {
  const unit=form.dataset.fuUnitId, snap=state.fu.n?.units[unit], fd=new FormData(form);
  if(form.matches('[data-fu-rule-form]')){
    const create=!form.dataset.fuRuleKey;
    const rule=create?null:(snap?.rules||[]).find(r=>r.key===form.dataset.fuRuleKey);
    if(!create&&!rule)return;
    const action=String(fd.get('action')||rule?.action||'principal');
    const situations=fd.getAll('sit').map(String);
    if(action==='encuesta_cierre'&&!situations.includes('rechazo')){toast('La encuesta de cierre requiere la situación No interesado.',true);return;}
    if(action!=='encuesta_cierre'&&situations.includes('rechazo')){toast('Para No interesado elegí la acción Encuesta de cierre.',true);return;}
    const values={...(rule||{stage:form.dataset.fuStage,position:Number(form.dataset.fuPosition)||10}),
      action, name:String(fd.get('name')||'').slice(0,80),situations,
      catalog_situation:fd.get('catalog_situation')||null,
      min_demo_activity_level:Number(fd.get('min_demo_activity_level')||0),
      after_hours:Number(fd.get('after_hours')),after_action:fd.get('after_action')||null,
      hours_from:Number(fd.get('hours_from')),hours_to:Number(fd.get('hours_to')),
      days:fd.getAll('days').map(Number),enabled:fd.has('enabled')};
    const draft=document.querySelector('[data-fu-new-rule-message]');
    const messageBody=create?String(draft?.querySelector('textarea[name="body"]')?.value||'').trim():'';
    const messageNotes=create?String(draft?.querySelector('textarea[name="notes"]')?.value||'').trim():'';
    if(create&&messageBody&&(snap?.stages||[]).flatMap(s=>s.versions||[]).some(v=>v.stage===values.stage&&v.action===action&&v.status==='active')){
      if(!window.confirm('Esta acción ya tiene un mensaje activo que otras reglas pueden usar. ¿Crear una nueva versión activa igualmente?'))return;
    }
    const saved=await fuOp(unit,{op:'rule-save',key:rule?.key||null,valores:values},{label:create?'Regla creada en Habita.':'Regla actualizada en Habita.'});
    if(saved){
      const ui=fuRulesState(unit);
      ui.dirty=false;ui.creating=false;ui.template=null;ui.selected=saved.key||rule?.key||null;
      state.fu.ruleEdit=null;
      if(create&&messageBody){
        const result=await fuOp(unit,{op:'version-create',valores:{stage:values.stage,action,channel:'whatsapp',trigger:'',body:messageBody,notes:messageNotes,
          ctas:['whatsapp','demo','copy'],status:'active'}},{label:'Mensaje creado y vinculado a la acción.'});
        if(!result)toast('La regla quedó guardada, pero el mensaje no. Creá una nueva versión desde el editor.',true);
      }
      await loadFollowup({quiet:true});render();
    }
    return;
  }
  if(form.matches('[data-fu-version-edit-form]')){
    const version=(snap?.stages||[]).flatMap(s=>s.versions||[]).find(v=>v.id===form.dataset.fuVersion);
    if(!version)return;
    const values={channel:version.channel||'whatsapp',trigger:version.trigger_label||'',
      body:String(fd.get('body')||''),ctas:version.ctas||[],notes:String(fd.get('notes')||'')};
    if(await fuOp(unit,{op:'version-update',id:version.id,valores:values},{label:'Versión actualizada en Habita.'})){
      state.fu.versionEdit=null;await loadFollowup({quiet:true});render();
    }
  }
}

  function fuRulesState(unit) {
  state.fu.rulesWorkspace ||= {};
  return state.fu.rulesWorkspace[unit] ||= {
    commercial: unit === 'habita' ? 'contactado' : 'saludado',
    selected: null, creating: false, template: null, showMenu: false, picking: false,
    technical: null, dirty: false, moving: false,
  };
}

  function fuRulesMessage(unit, snap, rule, stage, create) {
  if(create)return `<section class="fu-ref-message" data-fu-new-rule-message data-testid="followup-rule-message">
  <div class="os-section-heading"><div><span class="os-kicker">QUÉ SE EJECUTA</span><h3>Mensaje de la nueva regla</h3></div></div>
  <p class="os-view-caption">Prepará el texto junto con la regla. Guardar crea la regla y, si escribís un mensaje, una versión activa para su acción.</p>
  <label class="field"><span>MENSAJE A ENVIAR</span><textarea class="input" name="body" rows="9" maxlength="4000" placeholder="Escribí el mensaje o adaptá la plantilla…"></textarea></label>
  <p class="os-view-caption">Podés usar {{inmobiliaria}} y las variables que reconoce Habita. No se envía ningún mensaje al guardar esta pantalla.</p>
  <label class="field"><span>OBSERVACIONES (OPCIONAL)</span><textarea class="input" name="notes" rows="3" maxlength="2000" placeholder="Notas para el equipo…"></textarea></label>
  <p class="os-warn-note">Las versiones anteriores se conservan. Si esta acción ya tiene una versión activa, revisá lo existente antes de crear otra.</p>
</section>`;
  const action=unit==='turnia'?'principal':rule?.action||'principal';
  const versions=F.versionRows(unit,snap).filter(v=>v.stage===stage&&v.action===action).sort((a,b)=>b.version-a.version);
  const canEdit=!state.session?.open && (unit==='habita'||snap.catalog?.available);
  return `<section class="fu-ref-message" data-testid="followup-rule-message">
    <div class="os-section-heading"><div><span class="os-kicker">MENSAJE VINCULADO A LA ACCIÓN</span><h3>${esc((snap.catalog?.actions?.[stage]||[]).find(a=>a.key===action)?.label||rule?.name||action)}</h3></div>
    <span class="os-tag">${versions.length} VERSIONES</span></div>
    ${versions.map(v=>`<article class="fu-ref-version">
      <div class="fu-ref-version-top"><b>V${int(v.version)} · ${esc(v.status==='active'?'ACTIVA':v.status==='test'?'EN PRUEBA':'ARCHIVADA')}</b>
        <small>${int(v.executed)} enviadas · ${int(v.conversions)} conversiones</small></div>
      <p>${esc(v.body||'')}</p>
      <div class="fu-ref-buttons">${canEdit?`${unit==='habita'?`<button type="button" class="btn small" data-fu="version-edit" data-fu-version="${esc(v.id)}">EDITAR</button>`:''}
        ${v.status!=='active'?`<button type="button" class="btn small" data-fu="version-status" data-fu-unit-id="${unit}" data-fu-version="${esc(v.id)}" data-fu-status="active">ACTIVAR VERSIÓN</button>`:''}
        ${v.status==='test'?`<button type="button" class="btn small" data-fu="version-status" data-fu-unit-id="${unit}" data-fu-version="${esc(v.id)}" data-fu-status="archived">DETENER PRUEBA</button>`:''}`:''}</div>
    </article>`).join('')||'<p class="os-view-caption">Todavía no hay versiones de esta acción.</p>'}
    ${unit==='habita'?fuVersionEditor(unit,snap,stage):''}
    <details class="fu-ref-new-message">
      <summary>+ NUEVA VERSIÓN DEL MENSAJE</summary>
      <form data-fu-version-form data-fu-unit-id="${unit}" data-fu-stage="${esc(stage)}" data-fu-rule-action="${esc(action)}">
        <p class="os-view-caption">Cada versión queda registrada por separado para preservar las métricas de las anteriores.</p>
        <label class="field"><span>TEXTO DEL MENSAJE</span><textarea class="input" rows="5" name="body" maxlength="4000" required placeholder="Escribí el mensaje…"></textarea></label>
        <div class="fu-ref-fields"><label class="field"><span>ACCIÓN</span><select class="input" name="action" aria-label="Acción">${(snap.catalog?.actions?.[stage]||[{key:action,label:action}]).map(a=>`<option value="${esc(a.key)}" ${a.key===action?'selected':''}>${esc(a.label)}</option>`).join('')}</select></label>
        <label class="field"><span>ESTADO</span><select class="input" name="status"><option value="test">Probar 50/50</option><option value="active">Reemplazar versión activa</option></select></label></div>
        <button class="btn primary" type="submit" ${canEdit?'':'disabled title="Requiere sesión protegida"'}>GUARDAR NUEVA VERSIÓN</button>
      </form>
    </details>
  </section>`;
}

  function fuTurniaRuleEditor(snap, rule, stage) {
  if(!rule)return `<section class="card glass"><p class="os-view-caption">Seleccioná una regla para ver sus condiciones.</p></section>`;
  const canEdit=!state.session?.open && snap.catalog?.available;
  const reason=canEdit?'Las condiciones de esta pantalla solo restringen la cadencia nativa de Turnia; no pueden adelantar mensajes ni modificar su consentimiento.':'Las reglas siguen el motor de Turnia. Para editarlas desde acá debe estar publicada la API de configuración y la sesión protegida.';
  const days=['DO','LU','MA','MI','JU','VI','SA'];
  return `<form class="card glass fu-ref-editor" data-fu-turnia-rule-form data-fu-unit-id="turnia" data-fu-stage="${esc(stage)}">
    <div class="fu-ref-edit-head"><div><span class="os-kicker">REGLA DE TURNIA · ${esc(rule.stageTitle||stage)}</span><h3>${esc(rule.name||rule.title||rule.action||'Acción principal')}</h3></div><span class="os-tag">CADENCIA NATIVA</span></div>
    <p class="os-view-caption">${esc(reason)}</p>
    <label class="field"><span>NOMBRE</span><input class="input" name="name" value="${esc(rule.name||'')}" maxlength="120" ${canEdit?'':'disabled'}></label>
    <label class="field"><span>QUÉ SE EJECUTA</span><input class="input" value="${esc(rule.action_label||rule.action||'Mensaje de la etapa')}" disabled></label>
    <h3>Condiciones de la regla</h3>
    <div class="fu-ref-classifiers">${Object.entries(snap.labels?.situations||{}).filter(([k])=>!['no_contactar','sin_whatsapp','numero_incorrecto','rechazo'].includes(k)).map(([key,label])=>`<label><input type="checkbox" name="sit" value="${esc(key)}" ${(rule.situations||[]).includes(key)?'checked':''} ${canEdit?'':'disabled'}><span>${esc(label)}</span></label>`).join('')}</div>
    <div class="fu-ref-fields"><label class="field"><span>ESPERA MÍNIMA ADICIONAL (HORAS)</span><input class="input" name="after_hours" type="number" min="0" max="720" value="${Number(rule.after_hours??0)}" ${canEdit?'':'disabled'}></label>
      <label class="field"><span>HORARIO DESDE</span><input class="input" name="hours_from" type="number" min="0" max="23" value="${Number(rule.hours_from??8)}" ${canEdit?'':'disabled'}></label>
      <label class="field"><span>HORARIO HASTA</span><input class="input" name="hours_to" type="number" min="0" max="23" value="${Number(rule.hours_to??21)}" ${canEdit?'':'disabled'}></label></div>
    <h3>Días habilitados</h3><div class="fu-ref-classifiers">${days.map((day,i)=>`<label><input type="checkbox" name="days" value="${i}" ${(rule.days||[1,2,3,4,5,6]).includes(i)?'checked':''} ${canEdit?'':'disabled'}><span>${day}</span></label>`).join('')}</div>
    <label class="fu-ref-switch"><input type="checkbox" name="enabled" ${rule.enabled!==false?'checked':''} ${canEdit?'':'disabled'}> Regla activa</label>
    <div class="fu-ref-buttons"><button type="submit" class="btn primary" ${canEdit?'':'disabled'}>GUARDAR CAMBIOS</button></div>
  </form>`;
}

  async function fuRulesMove(unit, from, to) {
  if(unit!=='habita'||from===to)return;
  const snap=state.fu.n?.units[unit],ui=fuRulesState(unit);
  if(!snap||ui.dirty||ui.moving){toast('Guardá los cambios antes de reordenar.',true);return;}
  const step=F.commercialStages(unit,snap).find(s=>s.key===ui.commercial);
  const rows=(snap.rules||[]).filter(r=>step?.technical?.includes(r.stage)).sort((a,b)=>Number(a.position??999)-Number(b.position??999)||String(a.key).localeCompare(String(b.key)));
  const before=rows.map(r=>r.key),start=before.indexOf(from),end=before.indexOf(to);
  if(start<0||end<0)return;
  const after=[...before];after.splice(start,1);after.splice(end,0,from);
  ui.moving=true;
  const ok=await fuOp('habita',{op:'rule-reorder',before,after},{label:'Orden de reglas actualizado.'});
  ui.moving=false;
  if(ok){await loadFollowup({quiet:true});render();}
}

  function fuRulePreview(unit,snap,rule,stage,create) {
  const action=unit==='turnia'?'principal':rule?.action||'principal';
  const versions=F.versionRows(unit,snap).filter(v=>v.stage===stage&&v.action===action).sort((a,b)=>b.version-a.version);
  const active=versions.find(v=>v.status==='active')||versions[0];
  const sample=[...state.fu.n.queue,...state.fu.n.scheduled].find(x=>x.unit===unit&&x.stage===stage&&x.action);
  const org=unit==='habita'?'Inmobiliaria de ejemplo':'Consultorio de ejemplo';
  const name=sample?.shortName||sample?.name||org;
  const person=sample?.person||'';
  const body=active?.body||'';
  const filled=body
    .replaceAll('{{inmobiliaria}}',name).replaceAll('{{destinatario}}',name)
    .replaceAll('{{decisor}}',person).replaceAll('{{sdr}}','vos')
    .replaceAll('{{demo}}','[link a demo]').replaceAll('{{panel}}','[link a panel]');
  const bubbles=filled.split(/(?:\r?\n)\s*---\s*(?:\r?\n)/).filter(Boolean);
  return `<aside class="fu-ref-wa-preview" data-testid="followup-preview">
    <h3>◉ VISTA PREVIA EN WHATSAPP</h3>
    <div class="fu-ref-wa-phone">
      <div class="fu-ref-wa-header"><span>‹</span><span class="fu-ref-wa-avatar">▣</span>
        <b title="${esc(name)}">${esc(name)}</b><span>☏</span><span>⋮</span></div>
      <div class="fu-ref-wa-chat"><span class="fu-ref-wa-today">Hoy</span>
        ${bubbles.length?bubbles.map(x=>`<div class="fu-ref-wa-bubble">${esc(x)}<small>✓✓</small></div>`).join(''):
          '<p class="fu-ref-wa-empty">Elegí una versión del mensaje para ver cómo quedaría. No se enviará nada desde esta vista.</p>'}</div>
      <div class="fu-ref-wa-bottom">
        <button type="button" class="btn small" data-view="hoy">IR A LA COLA</button>
        <button type="button" class="btn small" data-fu="rules-preview-copy" data-fu-unit-id="${esc(unit)}" data-fu-stage="${esc(stage)}" data-fu-rule-action="${esc(action)}" ${body?'':'disabled'}>COPIAR MENSAJE</button>
      </div>
    </div>
    <p class="os-view-caption">Simulación sin envío. El texto final y los enlaces reales se revisan al tomar cada contacto de la cola.</p>
  </aside>`;
}

  function fuSecuencias() {
  const n=state.fu.n,unit=fuScope();
  if(unit==='todas'){
    return `<section class="hero"><div><span class="eyebrow">GENERAL / REGLAS Y MENSAJES</span><h1>Dos motores, un mismo espacio.</h1>
    <p>Entrá a cada negocio para configurar sus reglas en el mismo editor. Habita y Turnia conservan sus propias condiciones de avance.</p></div></section>
    <div class="os-business-cards">${units().filter(u=>n.units[u.id]).map(u=>`<button type="button" class="os-business-card" data-goto="${u.id}" data-view-to="secuencias" data-business="${u.id}"><span class="os-kicker">REGLAS COMERCIALES</span><h2>${esc(u.name)}</h2><p>${int(n.units[u.id].rules?.length||0)} reglas · configurar flujo y mensajes</p></button>`).join('')}</div>`;
  }
  const snap=n.units[unit];
  if(!snap)return `<section class="card glass"><p>No hay reglas disponibles de ${esc(fuName(unit))}.</p></section>`;
  const ui=fuRulesState(unit);
  const commercial=F.commercialStages(unit,snap).filter(x=>!x.key.startsWith('etapa_'));
  const active=commercial.find(s=>s.key===ui.commercial)||commercial[unit==='habita'?1:1]||commercial[0];
  const tech=active?.technical||[];
  const rules=F.ruleRows(unit,snap).filter(r=>tech.includes(r.stage))
    .sort((a,b)=>Number(a.raw.position??999)-Number(b.raw.position??999)||String(a.key).localeCompare(String(b.key)));
  const selected=ui.creating?null:rules.find(r=>r.key===ui.selected)||rules[0]||null;
  const stage=ui.creating?(ui.technical&&tech.includes(ui.technical)?ui.technical:tech[0]):selected?.stage||tech[0]||null;
  state.fu.ruleEdit=ui.creating?'__new':selected?.key||null;
  state.fu.ruleDraftStage=stage;
  state.fu.ruleTemplate=ui.creating?ui.template:null;
  const readonly=state.session?.open||unit==='turnia'&&!snap.catalog?.available;
  const versions=F.versionRows(unit,snap);
  const raw=selected?.raw||null;
  const labels=snap.labels?.situations||{};
  const renderRules=rules.map((r,i)=>`<article class="fu-ref-rule ${selected?.key===r.key&&!ui.creating?'is-on':''}" draggable="${unit==='habita'&&!readonly&&!ui.dirty&&rules.length>1}" data-fu-drag-key="${esc(r.key)}" data-testid="followup-rule-row">
    <div class="fu-ref-rule-actions">
      <div class="fu-ref-pos">P${i+1}</div>
      <button type="button" class="fu-ref-rule-label" data-fu="rules-select" data-fu-key="${esc(r.key)}">
        <strong>${esc(r.raw.name||r.action||'Mensaje de la etapa')}</strong>
        <small>${esc(r.when)}</small>
        <small>${esc(r.wait)}${r.enabled?'':' · APAGADA'}</small>
      </button>
      ${unit==='habita'&&!readonly?`<div class="fu-ref-reorder"><button type="button" class="fu-ref-move" data-fu="rules-move" data-fu-key="${esc(r.key)}" data-fu-dir="up" ${!i||ui.dirty?'disabled':''} aria-label="Subir regla" title="Subir prioridad">↑</button><button type="button" class="fu-ref-move" data-fu="rules-move" data-fu-key="${esc(r.key)}" data-fu-dir="down" ${i===rules.length-1||ui.dirty?'disabled':''} aria-label="Bajar regla" title="Bajar prioridad">↓</button></div>`:''}
    </div>
  </article>`).join('');
  const currentAction=raw?.action||'principal';
  const form=ui.creating && !stage?'<section class="card glass"><p class="os-view-caption">Cliente es el último hito del embudo y no tiene reglas configurables.</p></section>'
    :unit==='habita'?fuRuleEditor(unit,snap):fuTurniaRuleEditor(snap,raw,stage);
  const message=stage&&!ui.creating?fuRulesMessage(unit,snap,raw,stage,false):fuRulesMessage(unit,snap,raw,stage,true);
  const preview=stage?fuRulePreview(unit,snap,raw,stage,ui.creating):'';
  const addAllowed=unit==='habita'&&!readonly&&tech.length>0;
  const safeRules=rules.map(r=>r.raw);
  return `${state.session?.open?'<p class="os-warn-note">La sesión abierta no permite editar reglas ni mensajes. Configurá PROSPECTING_PASSWORD en Vercel.</p>':''}
    <section class="fu-ref-flowrow" data-testid="followup-flow"><span class="fu-ref-flow-label">ETAPAS COMERCIALES</span><nav class="fu-ref-flow" aria-label="Etapas comerciales">
      ${commercial.map((s,i)=>`<button type="button" class="fu-ref-flowstep ${active?.key===s.key?'is-on':''}" data-fu="rules-stage" data-fu-stage="${esc(s.key)}" aria-pressed="${active?.key===s.key}" data-testid="followup-commercial-stage">
        <span class="fu-ref-num">${i+1}</span><span><b>${esc(s.title)}</b><small>${int(s.waiting)} esperando</small></span></button>${i<commercial.length-1?'<span class="fu-ref-arrow" aria-hidden="true">›</span>':''}`).join('')}
    </nav></section>
    <section class="fu-ref-stage-head" data-testid="followup-stage-head"><div><div class="fu-ref-stage-title"><span class="fu-ref-num">${commercial.indexOf(active)+1}</span>
      <h2>${esc(active?.title||'')}</h2><span class="os-tag">REGLAS DE LA ETAPA</span></div>
      <p>Las condiciones de avance, las respuestas de WhatsApp y los eventos de producto se configuran dentro de cada regla.</p></div>
      <p>Seleccioná una regla para editarla o creá una nueva. La cola de ejecución muestra a quién corresponde aplicarla.</p></section>
    <div class="fu-ref-workspace" data-testid="followup-rules-workspace">
      <aside class="fu-ref-list card glass" data-testid="followup-rules-list">
        <div class="os-section-heading"><div><h3>Reglas de esta etapa</h3><p class="os-view-caption">${unit==='habita'?'Arrastrá las reglas o usá las flechas para ordenar su prioridad. P1 se evalúa primero.':'Las reglas de Turnia respetan su secuencia nativa.'}</p></div>
          <div class="fu-ref-add-area"><button type="button" class="btn small" data-fu="rules-add-menu" ${addAllowed?'':'disabled'} data-testid="followup-rule-add">+ AGREGAR REGLA ▾</button>
          ${ui.showMenu?`<div class="fu-ref-add-menu"><button type="button" data-fu="rules-new">+ CREAR UNA REGLA NUEVA</button><button type="button" data-fu="rules-pick">USAR UNA REGLA EXISTENTE</button></div>`:''}</div></div>
        <div class="fu-ref-rule-list">${renderRules}${ui.creating?`<article class="fu-ref-rule is-on"><div class="fu-ref-rule-actions"><span class="fu-ref-pos">+</span><div class="fu-ref-rule-label"><strong>${ui.template?'Copia de regla existente':'Nueva regla'}</strong><small>Revisala a la derecha y guardala.</small></div></div></article>`:''}
        ${!rules.length&&!ui.creating?'<p class="os-view-caption">Esta etapa no tiene reglas configuradas.</p>':''}</div>
        <details class="fu-ref-classifier-link"><summary>Administrar clasificaciones de WhatsApp</summary><p class="os-view-caption">Las situaciones existentes y personalizadas se configuran en el mismo catálogo por etapa.</p><button type="button" class="btn small" data-view="etapas">ETAPAS Y SITUACIONES →</button></details>
      </aside>
      <div class="fu-ref-detail" data-testid="followup-rule-detail">
        ${ui.creating && tech.length>1?`<div class="card glass fu-ref-step-switch"><label class="field"><span>PASO TÉCNICO DE LA REGLA</span><select class="input" data-fu-rules-tech>${tech.map(key=>`<option value="${esc(key)}" ${stage===key?'selected':''}>${esc(snap.stages.find(s=>s.key===key)?.title||key)}</option>`).join('')}</select></label></div>`:''}
        ${form}
        ${message}
        ${preview}
        ${!ui.creating&&selected&&unit==='habita'&&!readonly?`<div class="fu-ref-buttons"><button type="button" class="btn" data-fu="rules-delete" data-fu-key="${esc(selected.key)}">ELIMINAR REGLA</button></div>`:''}
        ${unit==='turnia'&&!snap.catalog?.available?'<p class="os-warn-note">El editor de reglas de Turnia se activará al desplegar su catálogo y validar el motor; la lectura de reglas sigue disponible.</p>':''}
      </div></div>
    ${ui.picking?`<div class="fu-ref-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="fu-rule-pick-title"><div class="fu-ref-picker card glass">
      <div class="os-section-heading"><h3 id="fu-rule-pick-title">Usar una regla existente</h3><button type="button" class="btn small" data-fu="rules-pick-close">CERRAR</button></div>
      <p class="os-view-caption">Elegí cualquier regla como punto de partida. La copia se abre a la derecha para que la adaptes a esta etapa antes de guardar.</p>
      <div class="fu-ref-picker-list">${(snap.rules||[]).map(r=>`<button type="button" data-fu="rules-template" data-fu-key="${esc(r.key)}"><b>${esc(snap.stages.find(s=>s.key===r.stage)?.title||r.stage)}</b><span>${esc(r.name||r.action)}</span><small>${esc((r.situations||[]).map(x=>labels[x]||x).join(', '))}</small></button>`).join('')}</div>
    </div></div>`:''}`;
}

  function fuRendimiento() {
    const n = state.fu.n;
    const scope = fuScope();
    const actors = F.actorRows(n, scope);
    return `<section class="hero"><div><span class="eyebrow">Rendimiento</span><h1>Qué mensajes y quién convierten</h1><p>Conversión: que la persona o la inmobiliaria avanzó de etapa después del envío, con la definición de cada producto. Con menos de 30 envíos, la muestra es chica.</p></div></section>
      ${state.unit === 'todas' ? fuToolbar({ search: false, groups: false, filters: false }) : ''}
      ${fuUnits().filter((u) => n.units[u.id]).map((u) => {
        const snap = n.units[u.id];
        const rows = F.versionRows(u.id, snap).filter((v) => v.executed > 0 || v.status !== 'archived');
        const sent = rows.reduce((s, v) => s + v.executed, 0);
        const conv = rows.reduce((s, v) => s + v.conversions, 0);
        const funnel = snap.funnel || [];
        return `<section class="card glass"><div class="card-head"><div>${fuDot(u.id)}<h2>${esc(u.name)}</h2></div></div>
          <div class="kpis">${kpi('Enviados desde Follow-up', int(sent), 'Una vez por persona y versión')}${kpi('Avanzaron después', int(conv), pct(sent ? conv / sent : null))}${funnel.slice(0, 3).map((s) => kpi(`${esc(s.title)} → ${esc(s.goal)}`, pct(s.rate), `${int(s.reached)} llegaron`)).join('')}</div>
          <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Etapa</th><th>Versión</th><th>Enviadas</th><th>Avanzaron</th><th>Tasa</th>${u.id === 'habita' ? '<th>Tiempo mediano</th>' : ''}</tr></thead><tbody>
          ${rows.map((v) => `<tr><td>${esc(v.stageTitle)}${v.action !== 'principal' ? ` · ${esc(v.actionLabel)}` : ''}</td><td>V${v.version} ${v.status === 'test' ? '(a prueba)' : v.status === 'archived' ? '(archivada)' : ''}</td><td class="num">${int(v.executed)}</td><td class="num">${int(v.conversions)}</td><td class="num">${pct(v.rate)}${v.small ? ' <span class="sub">muestra chica</span>' : ''}${v.best ? ' <span class="signal">Mejor</span>' : ''}</td>${u.id === 'habita' ? `<td class="num">${v.medianHours === null || v.medianHours === undefined ? '—' : `${Math.round(v.medianHours)} h`}</td>` : ''}</tr>`).join('') || '<tr><td colspan="6" class="empty">Todavía no hay envíos desde Follow-up.</td></tr>'}
          </tbody></table></div></section>`;
      }).join('')}
      <section class="card glass"><div class="card-head"><div><h2>Por responsable</h2><p class="sub">Envíos confirmados por cada persona y cuántos avanzaron después.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Quién</th><th>Producto</th><th>Enviados</th><th>Avanzaron</th><th>Tasa</th></tr></thead><tbody>
        ${actors.map((a) => `<tr><td>${esc(a.actor)}</td><td>${esc(fuName(a.unit))}</td><td class="num">${int(a.executions)}</td><td class="num">${int(a.conversions)}</td><td class="num">${pct(a.rate)}${a.executions < 30 ? ' <span class="sub">muestra chica</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Todavía no hay envíos.</td></tr>'}
        </tbody></table></div></section>`;
  }

  // ── La tarea: contexto, mensaje y checklist (como el detalle de Follow-up de habita.) ──
  function renderFuTask(t) {
    const it = t.item || {};
    const u = unitOf(t.unit);
    const snap = state.fu.n && state.fu.n.units[t.unit];
    const situations = (snap && snap.labels && snap.labels.situations) || {};
    const exec = t.mode === 'ejecutar';
    const acc = fuAccount(t.unit, it);
    const me = state.session && state.session.user && state.session.user.name;
    const otherClaim = it.claim && it.claim.by !== me;
    return `${demoBanner()}
      <div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn small" type="button" data-fu="back">← Volver a la cola</button>${exec ? `<button class="btn small ghost" type="button" data-fu="release">Soltar sin hacer nada</button><span class="sub">La tenés vos${t.lockedUntil ? ` hasta las ${esc(new Date(t.lockedUntil).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))}` : ' 10 minutos'}: nadie más puede mandarle.</span>` : otherClaim ? `<span class="badge off">Lo tiene ${esc(it.claim.by)}</span>` : ''}</div>
      <section class="hero"><div>${fuDot(t.unit)}<h1>${esc(t.name || it.name)}</h1><p>${esc(it.stageTitle || '')}${it.situationLabel ? ` · ${esc(it.situationLabel)}` : ''}${t.actionLabel || it.action ? ` · ${esc(t.actionLabel || it.action)}` : ''}</p></div></section>
      <div class="grid cols-3" data-testid="fu-detail">
        <section class="card glass"><h2>Contexto</h2>
          <dl class="facts">${it.sub && it.sub !== it.name ? `<dt>${esc(u.entity.org)}</dt><dd>${esc(it.sub)}</dd>` : ''}${t.phone || it.phone ? `<dt>WhatsApp</dt><dd>${esc(t.phone || it.phone)}</dd>` : ''}${it.zone ? `<dt>Zona</dt><dd>${esc(it.zone)}</dd>` : ''}<dt>Etapa</dt><dd>${esc(it.stageTitle || '')}</dd><dt>Prioridad</dt><dd>${esc(F.PRIORITY_LABEL[it.priority] || '')}${it.priorityManual ? ' (a mano)' : ''}</dd>${it.owner ? `<dt>Responsable</dt><dd>${esc(it.owner)}</dd>` : ''}${it.since ? `<dt>Último contacto</dt><dd>${esc(ago(it.since))}${it.lastText ? ` · ${esc(it.lastText)}` : ''}</dd>` : ''}${it.blocked ? `<dt>Bloqueada</dt><dd style="color:var(--bad-text)">${esc(it.blocked)}</dd>` : ''}${it.dueAt ? `<dt>Programada</dt><dd>${esc(dayTime(it.dueAt))}</dd>` : ''}</dl>
          <form class="section" data-fu-situation><h3>Situación</h3><select class="input" name="situacion" aria-label="Situación">${Object.entries(situations).map(([k, l]) => `<option value="${esc(k)}" ${it.situation === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><input class="input" name="texto" placeholder="Qué dijo (texto original)" value="${esc(it.situationNote || '')}"><button class="btn small" type="submit">Guardar situación</button></form>
          <form class="section" data-fu-reply><h3>Registrar una respuesta</h3><textarea class="input" name="texto" rows="2" placeholder="Lo que respondió por WhatsApp" required></textarea><select class="input" name="clasificacion" aria-label="Clasificación"><option value="">Resolver después (queda en Respuestas)</option>${Object.entries(situations).filter(([k]) => k !== 'sin_respuesta').map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select><button class="btn small" type="submit">Registrar</button></form>
          <div class="section"><h3>Prioridad y responsable</h3><div class="btns">${['alta', 'media', 'baja'].map((p) => `<button class="btn small ${it.priority === p ? 'primary' : ''}" type="button" data-fu="priority" data-fu-priority="${p}">${F.PRIORITY_LABEL[p]}</button>`).join('')}<button class="btn small ghost" type="button" data-fu="priority" data-fu-priority="">Automática</button></div>
            ${t.unit === 'turnia' ? `<form class="btns" data-fu-owner><input class="input" name="responsable" list="fu-owners" value="${esc(it.owner || '')}" placeholder="Facu, Axel…" style="flex:1 1 120px" aria-label="Responsable"><datalist id="fu-owners"><option>Facu</option><option>Axel</option>${me ? `<option>${esc(me)}</option>` : ''}</datalist><button class="btn small" type="submit">Asignar</button></form>` : '<p class="sub" style="margin:0">En habita. el responsable es el SDR de la cuenta.</p>'}</div>
          ${t.history && t.history.length ? `<div class="section"><h3>Últimas acciones</h3><ul class="history">${t.history.map((h) => `<li><time>${esc(dayTime(h.at))}</time><span>${esc(h.text)}</span></li>`).join('')}</ul></div>` : ''}
        </section>
        <section class="card glass"><h2>Mensaje</h2>
          ${exec ? `${t.warnings.map((w) => `<div class="notice glass"><span>${esc(w)}</span></div>`).join('')}${fuDemoWarning(t)}
            ${t.messages.map((m, i) => `<div class="section"><h3>${t.messages.length > 1 ? `Mensaje ${i + 1} de ${t.messages.length}` : `V${esc(t.version || '')}`}</h3><p style="margin:0;white-space:pre-wrap;font-size:15px" data-testid="fu-message" data-index="${i}">${esc(m)}</p><div class="btns"><button class="btn small" type="button" data-fu="copy" data-fu-index="${i}">${icon.copy} Copiar</button></div></div>`).join('')}
            ${t.notes ? `<div class="section"><h3>Observaciones</h3><p style="margin:0;white-space:pre-wrap;font-size:14px">${esc(t.notes)}</p></div>` : ''}`
          : `<p class="sub">${it.action ? `Próxima acción: <strong>${esc(it.action)}</strong>.` : esc(it.actionReason || 'No hay nada para mandarle ahora.')}</p>${it.action && !it.blocked && !it.dueAt && !otherClaim ? `<button class="btn primary" type="button" data-fu="claim" data-fu-key="${esc(it.key)}">Tomarla y armar el mensaje</button>` : ''}`}
          <div class="section"><h3>Enlaces</h3><div class="btns">${t.links && t.links.demo ? `<a class="btn small" href="${esc(t.links.demo)}" target="_blank" rel="noopener">${icon.ext} Su demo</a>` : it.demoUrl ? `<a class="btn small" href="${esc(it.demoUrl)}" target="_blank" rel="noopener">${icon.ext} Su demo</a>` : ''}${t.links && t.links.panel ? `<a class="btn small" href="${esc(t.links.panel)}" target="_blank" rel="noopener">${icon.ext} Su panel</a>` : ''}<a class="btn small" href="${esc(u.appUrl)}" target="_blank" rel="noopener">${icon.ext} Abrir ${esc(u.appName)}</a>${acc ? `<button class="btn small" type="button" data-fu="ficha" data-fu-account="${esc(acc.id)}">Ver la ficha</button>` : ''}</div></div>
        </section>
        <section class="card glass"><h2>${exec ? 'Antes de mandar' : 'Acciones'}</h2>
          ${exec && t.checklist.length ? `<ul class="history" data-testid="fu-checklist">${t.checklist.map((c) => `<li data-check="${esc(c.key)}" data-ok="${c.ok}"><time>${c.ok ? '✓' : '✗'}</time><span><strong>${esc(c.label)}</strong>${c.note ? ` · ${esc(c.note)}` : ''}</span></li>`).join('')}</ul>` : ''}
          ${exec ? `<div class="btns">${t.whatsappUrl ? `<button class="btn primary" type="button" data-fu="open" data-testid="fu-open">${icon.wa} Abrir WhatsApp</button>` : ''}<button class="btn ${t.whatsappUrl ? '' : 'primary'}" type="button" data-fu="confirm" data-testid="fu-confirm" data-arm="Confirmar: el mensaje salió">Confirmar envío</button></div>
            <p class="sub" style="margin:0">Abrir el chat no cuenta. Confirmá cuando lo veas enviado; si el número del chat no coincide, no lo mandes.</p>
            <form class="section" data-fu-fail><h3>No salió</h3><input class="input" name="motivo" placeholder="Por qué" aria-label="Motivo"><select class="input" name="tipo" aria-label="Tipo"><option value="">Otro motivo</option><option value="sin_whatsapp">No tiene WhatsApp</option><option value="numero_incorrecto">Número incorrecto</option></select><button class="btn small" type="submit">Registrar que no salió</button></form>` : ''}
          <form class="section" data-fu-snooze><h3>Omitir o reprogramar</h3><div class="btns">${[['1', 'Mañana'], ['3', 'En 3 días'], ['7', 'En una semana']].map(([d, l]) => `<button class="btn small" type="button" data-fu="snooze-days" data-fu-days="${d}">${l}</button>`).join('')}</div><input class="input" type="date" name="hasta" aria-label="Otra fecha"><input class="input" name="motivo" placeholder="Motivo (opcional)"><button class="btn small" type="submit">Reprogramar</button>${it.snoozedUntil ? `<button class="btn small ghost" type="button" data-fu="unsnooze">Volver a la cola</button>` : ''}</form>
          ${exec ? `<button class="btn ghost" type="button" data-fu="next-after">Siguiente pendiente →</button>` : ''}
        </section>
      </div>`;
  }

  /** El mensaje armado por la app lleva la demo de otra cuenta (por ejemplo, la de otro consultorio con el mismo número). */
  function fuDemoWarning(t) {
    const u = unitOf(t.unit);
    const d = state.data[t.unit];
    const acc = fuAccount(t.unit, t.item);
    if (!u || !acc || !d || !d.accounts) return '';
    const check = C.demoCheck(acc, u, d.accounts, (t.messages || []).join('\n'));
    return check.ok ? '' : `<div class="notice glass" data-testid="fu-demo-problem"><span class="badge off">Demo equivocada</span><span>${esc(check.problem)} No lo mandes así.</span></div>`;
  }

  /** La cuenta de la planilla o de la app que corresponde a esta tarea (para abrir su ficha). */
  function fuAccount(unit, it) {
    const d = state.data[unit];
    if (!d || !d.accounts || !it) return null;
    const name = String(it.name || '').trim().toLowerCase();
    return d.accounts.find((a) => (it.code && a.id === it.code) || a.id === it.id) || d.accounts.find((a) => name && (String(a.org || '').trim().toLowerCase() === name || String(a.name || '').trim().toLowerCase() === name)) || null;
  }

  /** En la ficha: lo que dice la bandeja (situación, próxima acción, quién la tiene). */
  function fuForAccount(a, unit) {
    const n = state.fu.n;
    if (!n) return null;
    const name = String(a.org || a.name || '').trim().toLowerCase();
    return [...n.queue, ...n.scheduled, ...n.blocked].find((x) => x.unit === unit && (x.code === a.id || x.id === a.id || (name && x.name.trim().toLowerCase() === name))) || null;
  }
  function productActivity(a, u) {
    const link = u.demoLink(a);
    const facts = [
      link ? ['Su demo', `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace(/^https?:\/\//, ''))}</a>`] : null,
      a.demoOpened ? ['Abrió la demo', esc(when(a.demoOpened))] : null,
      a.demoTried ? ['Probó la demo', esc(when(a.demoTried))] : null,
      a.demoChat ? ['Conversó en la demo', esc(when(a.demoChat))] : null,
      a.accountAt ? ['Cuenta creada', `${esc(when(a.accountAt))}${a.accountClinic ? ` · ${esc(a.accountClinic)}` : ''}`] : null,
      a.accountActive ? ['Cuenta activa', esc(when(a.accountActive))] : null,
      a.operationalAt ? ['Operativa desde', esc(when(a.operationalAt))] : null,
      a.clientAt ? ['Cliente desde', esc(when(a.clientAt))] : null,
    ].filter(Boolean);
    const fu = fuForAccount(a, u.id);
    return `${fu ? `<div class="section"><h3>Operación comercial · Follow-up</h3><p style="margin:0"><strong>${esc(fu.action || fu.actionReason || 'Sin acción')}</strong> · ${esc(fu.stageTitle)}${fu.situationLabel ? ` · ${esc(fu.situationLabel)}` : ''}</p><p class="sub" style="margin:0">${fu.claim ? `Lo tiene ${esc(fu.claim.by)}` : fu.blocked ? esc(fu.blocked) : fu.dueAt ? `Sale ${esc(dayTime(fu.dueAt))}` : 'En la cola'}${fu.owner ? ` · responsable ${esc(fu.owner)}` : ''}</p><div class="btns"><button class="btn small" type="button" data-fu="from-ficha" data-fu-key="${esc(fu.key)}">Abrir en la bandeja</button></div></div>` : ''}
      <div class="section"><h3>Actividad de producto</h3>${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>` : `<p class="sub" style="margin:0">Todavía no hay actividad en ${esc(u.name)}.</p>`}</div>`;
  }

  // ── Eventos de la bandeja ──
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-fu], [data-fu-open]');
    if (!t || !main.contains(t) && !$('#drawer').contains(t)) return;
    const ds = t.dataset;
    if (ds.fu === undefined && ds.fuOpen) {
      if (e.target.closest('button, a')) return;
      const it = fuFind(ds.fuOpen);
      if (it) { state.fu.task = { unit: it.unit, mode: 'ver', item: it, name: it.name, messages: [], warnings: [], checklist: [], history: [], links: {} }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      return;
    }
    if (ds.arm && ds.armed !== '1') return; // la confirmación en dos clics la maneja el panel
    const task = state.fu.task;
    const it = task && task.item;
    const fields = () => ({ ...F.taskFields(it), ...(task.versionId ? { version: task.versionId } : {}), ...(task.actionKey ? { tarea: task.actionKey } : {}), ...(task.stage ? { etapa: task.stage } : {}) });
    switch (ds.fu) {
      case 'sub': state.fu.sub = ds.fuSub; store('fu-sub', state.fu.sub); go(state.unit, state.fu.sub); break;
      case 'reply-select': fuReplyState().selected=ds.fuKey;render();break;
      case 'reply-manual': fuReplyState().manual=!fuReplyState().manual;render();break;
      case 'reply-to-queue': { state.fu.task=null;go(state.unit,'hoy');const x=[...state.fu.n.queue,...state.fu.n.blocked,...state.fu.n.scheduled].find(x=>x.unit===state.unit&&x.id===ds.fuId);if(x){state.fu.task={unit:x.unit,mode:'ver',item:x,name:x.name,messages:[],warnings:[],checklist:[],history:[],links:{}};render();}break; }
      case 'queue-stage': {
        const q=fuQueueState();q.commercial=ds.fuStage||null;q.tech=null;q.situation=null;q.rule=null;q.closed=false;q.limit=25;render();break;
      }
      case 'queue-kpi': {
        const q=fuQueueState();
        if(ds.fuKpi==='respuestas'&&q.kpi==='respuestas'&&state.unit!=='todas'){go(state.unit,'responder');break;}
        q.kpi=ds.fuKpi;q.group=null;q.closed=false;q.limit=25;render();break;
      }
      case 'queue-situation': {
        const q=fuQueueState();q.situation=ds.fuSituation||null;q.limit=25;render();break;
      }
      case 'queue-closed': {
        const q=fuQueueState();q.closed=ds.fuClosed==='1';q.rule=null;q.group=null;q.situation=null;q.limit=25;render();break;
      }
      case 'queue-more': fuQueueState().limit+=25;render();break;
      case 'funnel-period': {
        const p=fuChartPeriod();p.preset=ds.fuPeriod||'todo';p.from='';p.to='';
        state.fu.chartFocus=null;await loadFollowup({quiet:true});render();break;
      }
      case 'funnel-select': {
        const next={step:Number(ds.fuStep),mode:ds.fuMode};
        const prev=state.fu.chartFocus;
        state.fu.chartFocus=prev?.step===next.step&&prev?.mode===next.mode?null:next;
        render();break;
      }
      case 'funnel-reset':state.fu.chartFocus=null;render();break;
      case 'pipeline-stage': state.fu.pipelineStage = ds.fuStage; state.fu.technicalStage = null; state.fu.pipelineSituation=null;render(); break;
      case 'pipeline-technical': state.fu.technicalStage = ds.fuStage || null; render(); break;
      case 'pipeline-situation': state.fu.pipelineSituation=ds.fuSituation||null;render();break;
      case 'catalog-stage': state.fu.catalogStage=ds.fuStage;state.fu.catalogEdit=null;state.fu.newStage=false;render();break;
      case 'state-toggle': {
        const key=ds.fuKey,enabled=ds.fuEnabled==='1',stage=state.fu.catalogStage||'contactado';
        const stateRow=(state.fu.n?.units?.[state.unit]?.catalog?.states||[]).find(s=>s.key===key&&s.commercial_stage===stage);
        if(enabled&&stateRow&&!stateRow.maps_to&&!stateRow.product_stage){
          state.fu.catalogEdit={key,base:false,create:false,commercial_stage:stage};
          toast('Primero configurá a qué respuesta o condición del embudo corresponde.',true);render();break;
        }
        if(await fuOp(state.unit,{op:'state-toggle',valores:{key,commercial_stage:stage,enabled}},
          {label:enabled?'Situación habilitada.':'Situación deshabilitada.'})){
          await loadFollowup({quiet:true});render();
        }
        break;
      }
      case 'new-stage': state.fu.newStage=!state.fu.newStage;state.fu.catalogEdit=null;render();break;
      case 'new-situation': state.fu.catalogEdit={key:null,base:false,create:true,commercial_stage:state.fu.catalogStage||'contactado'};render();break;
      case 'edit-situation': state.fu.catalogEdit={key:ds.fuKey,base:ds.fuBase==='1',create:false,commercial_stage:state.fu.catalogStage||'contactado'};render();break;
      case 'catalog-cancel': state.fu.catalogEdit=null;render();break;
      case 'state-restore': {
        const canonical=state.fu.n.units.habita?.labels?.situations||{};
        if(await fuOp('habita',{op:'state-save',valores:{base:true,key:ds.fuKey,label:canonical[ds.fuKey],commercial_stage:state.fu.catalogStage||'contactado',description:'',examples:''}},{label:'Situación restaurada.'})){await loadFollowup({quiet:true});render();}
        break;
      }
      case 'state-delete': {
        if(!window.confirm('¿Eliminar esta situación de la etapa? Se conservan el historial y las reglas guardadas.'))break;
        if(await fuOp(state.unit,{op:'state-delete',valores:{key:ds.fuKey,base:ds.fuBase==='1',commercial_stage:ds.fuCommercial}},{label:'Situación quitada de esta etapa.'})){
          state.fu.catalogEdit=null;await loadFollowup({quiet:true});render();
        }
        break;
      }
      case 'unit': state.fu.f.unit = ds.fuUnit; store('fu-filters', state.fu.f); render(); break;
      case 'reload': loadFollowup(); break;
      case 'wa-sync': {
        state.fu.waBusy = true; render();
        const r = await fuOp('turnia', { op: 'whatsapp-sync' });
        state.fu.waBusy = false;
        if (r && r.whatsapp) toast(r.whatsapp.reused ? 'Se leyó hace menos de 10 minutos: es la última lectura.' : `Listo: ${int(r.whatsapp.totals.nuevas)} respuestas nuevas.`);
        loadFollowup();
        break;
      }
      case 'claim': { const x = fuFind(ds.fuKey) || it; if (x) await fuClaim(x); break; }
      case 'next': await fuNext(); break;
      case 'back':
        if(task?.mode==='ejecutar'){
          if(!await fuOp(task.unit,{op:'release',inmobiliaria:it.id},{label:'Tarea liberada sin confirmar envío.'}))break;
        }
        state.fu.task=null;render();loadFollowup({quiet:true});break;
      case 'release': if (await fuOp(task.unit, { op: 'release', inmobiliaria: it.id }, { label: 'Quedó libre.' })) { state.fu.task = null; loadFollowup(); } break;
      case 'copy': copy(task.messages[Number(ds.fuIndex)] || task.message); break;
      case 'open':
        if (await fuOp(task.unit, { op: 'open', ...fields() })) window.open(task.whatsappUrl, 'chapa-whatsapp');
        break;
      case 'confirm': {
        const r = await fuOp(task.unit, { op: 'confirm', ...fields(), texto: task.messages.join('\n\n') || task.message }, { label: 'Envío confirmado.' });
        if (r) { state.fu.task = null; await loadFollowup({ quiet: true }); render(); }
        break;
      }
      case 'next-after': await fuNext(); break;
      case 'priority': if (await fuOp(task.unit, { op: 'priority', inmobiliaria: it.id, prioridad: ds.fuPriority || null }, { label: 'Prioridad guardada.' })) { it.priority = ds.fuPriority || it.priority; it.priorityManual = Boolean(ds.fuPriority); render(); loadFollowup({ quiet: true }); } break;
      case 'snooze-days': {
        const d = new Date(Date.now() + Number(ds.fuDays) * 86400000);
        d.setUTCHours(12, 0, 0, 0);
        if (await fuOp(task.unit, { op: 'snooze', inmobiliaria: it.id, hasta: d.toISOString() }, { label: `Reprogramada para el ${d.toLocaleDateString('es-AR')}.` })) { state.fu.task = null; loadFollowup(); }
        break;
      }
      case 'unsnooze': if (await fuOp(task.unit, { op: 'snooze', inmobiliaria: it.id, volver: true }, { label: 'Volvió a la cola.' })) { state.fu.task = null; loadFollowup(); } break;
      case 'ficha': { const unit = task.unit; state.fu.task = null; go(unit, 'cuentas'); openDrawer(ds.fuAccount); break; }
      case 'from-ficha': { const x = fuFind(ds.fuKey); closeDrawer(); if (x) { state.fu.task = { unit: x.unit, mode: 'ver', item: x, name: x.name, messages: [], warnings: [], checklist: [], history: [], links: {} }; go(x.unit, 'followup'); } break; }
      case 'version-status': if (await fuOp(ds.fuUnitId, { op: 'version-status', id: ds.fuVersion, estado: ds.fuStatus }, { label: 'Versión actualizada.' })) loadFollowup(); break;
      case 'rules-stage': {
        const ui=fuRulesState(state.unit);
        if(ui.dirty&&!window.confirm('Tenés cambios sin guardar. ¿Descartarlos y cambiar de etapa?'))break;
        ui.commercial=ds.fuStage;ui.selected=null;ui.creating=false;ui.template=null;ui.technical=null;ui.dirty=false;ui.showMenu=false;render();break;
      }
      case 'rules-select': {
        const ui=fuRulesState(state.unit);
        if(ui.dirty&&!window.confirm('Tenés cambios sin guardar. ¿Descartarlos y cambiar de regla?'))break;
        ui.selected=ds.fuKey;ui.creating=false;ui.template=null;ui.dirty=false;ui.showMenu=false;render();break;
      }
      case 'rules-add-menu': {const ui=fuRulesState(state.unit);ui.showMenu=!ui.showMenu;render();break;}
      case 'rules-new': {
        const ui=fuRulesState(state.unit);
        if(ui.dirty&&!window.confirm('Tenés cambios sin guardar. ¿Descartarlos?'))break;
        ui.creating=true;ui.template=null;ui.selected=null;ui.showMenu=false;ui.dirty=false;render();break;
      }
      case 'rules-pick': {const ui=fuRulesState(state.unit);ui.showMenu=false;ui.picking=true;render();break;}
      case 'rules-pick-close': {fuRulesState(state.unit).picking=false;render();break;}
      case 'rules-template': {
        const ui=fuRulesState(state.unit);
        ui.template=ds.fuKey;ui.creating=true;ui.selected=null;ui.picking=false;ui.dirty=false;render();break;
      }
      case 'rules-move': {
        const ui=fuRulesState(state.unit), snap=state.fu.n?.units[state.unit];
        const step=F.commercialStages(state.unit,snap).find(x=>x.key===ui.commercial);
        const list=(snap?.rules||[]).filter(r=>step?.technical?.includes(r.stage)).sort((a,b)=>(a.position??999)-(b.position??999)||String(a.key).localeCompare(String(b.key)));
        const i=list.findIndex(r=>r.key===ds.fuKey),neighbor=list[i+(ds.fuDir==='up'?-1:1)];
        if(neighbor)await fuRulesMove(state.unit,ds.fuKey,neighbor.key);
        break;
      }
      case 'rules-preview-copy': {
        const unit=ds.fuUnitId, snap=state.fu.n?.units[unit];
        const version=F.versionRows(unit,snap).filter(v=>v.stage===ds.fuStage&&v.action===ds.fuRuleAction)
          .find(v=>v.status==='active');
        if(version?.body){copy(version.body);toast('Mensaje copiado sin enviarlo.');}
        else toast('No hay una versión activa para copiar.',true);
        break;
      }
      case 'rules-cancel': {const ui=fuRulesState(state.unit);ui.dirty=false;ui.creating=false;ui.template=null;ui.selected=null;render();break;}
      case 'rules-delete': {
        const ui=fuRulesState(state.unit);
        if(ui.dirty){toast('Guardá o cancelá los cambios antes de eliminar.',true);break;}
        if(!window.confirm('¿Eliminar esta regla? Se conserva el historial de envíos y métricas.'))break;
        const result=await fuOp(state.unit,{op:'rule-delete',key:ds.fuKey},{label:'Regla eliminada; historial conservado.'});
        if(result){ui.selected=null;ui.creating=false;await loadFollowup({quiet:true});render();}
        break;
      }
      case 'rule-edit': state.fu.ruleEdit=ds.fuRule||null;fuRulesState(state.unit).dirty=false;render();break;
      case 'rule-create': state.fu.ruleEdit='__new'; state.fu.ruleDraftStage=ds.fuStage;state.fu.ruleTemplate=null;render(); break;
      case 'version-edit': state.fu.versionEdit = ds.fuVersion || null; render(); break;
      case 'rule-toggle': {
        const snap = state.fu.n.units[ds.fuUnitId];
        const rule = snap && (snap.rules || []).find((r) => r.key === ds.fuRule);
        if (rule && await fuOp(ds.fuUnitId, { op: 'rule-save', key: rule.key, valores: { ...rule, enabled: !rule.enabled } }, { label: rule.enabled ? 'Regla apagada.' : 'Regla prendida.' })) loadFollowup();
        break;
      }
      default: break;
    }
  });
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.matches('[data-fu-chart-range], [data-fu-turnia-rule-form], [data-fu-situation], [data-fu-reply], [data-fu-owner], [data-fu-fail], [data-fu-snooze], [data-fu-version-form], [data-fu-rule-form], [data-fu-version-edit-form], [data-fu-stage-form], [data-fu-state-form], [data-fu-inbox-form], [data-fu-manual-reply-form]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(form.matches('[data-fu-chart-range]')){
      const fd=new FormData(form),p=fuChartPeriod(),from=String(fd.get('desde')||''),to=String(fd.get('hasta')||'');
      if(from&&to&&to<from){toast('La fecha Hasta debe ser igual o posterior a Desde.',true);return;}
      p.preset='todo';p.from=from;p.to=to;state.fu.chartFocus=null;
      await loadFollowup({quiet:true});render();return;
    }
    if(form.matches('[data-fu-turnia-rule-form]')){
      const fd=new FormData(form);
      const val={stage:form.dataset.fuStage,name:String(fd.get('name')||''),enabled:fd.has('enabled'),
        situations:fd.getAll('sit').map(String),days:fd.getAll('days').map(Number),
        after_hours:Number(fd.get('after_hours')),hours_from:Number(fd.get('hours_from')),hours_to:Number(fd.get('hours_to'))};
      if(await fuOp('turnia',{op:'rule-save',key:form.dataset.fuStage,valores:val},{label:'Restricciones de Turnia guardadas.'})){
        fuRulesState('turnia').dirty=false;await loadFollowup({quiet:true});render();
      }
      return;
    }
    if(form.matches('[data-fu-inbox-form], [data-fu-manual-reply-form]')) { await fuReplySubmit(form,e.submitter);return; }
    if (form.matches('[data-fu-rule-form], [data-fu-version-edit-form]')) { await handleFuEditorSubmit(form); return; }
    if(form.matches('[data-fu-stage-form], [data-fu-state-form]')){await submitCatalog(form);return;}
    const fd = Object.fromEntries(new FormData(form));
    const task = state.fu.task;
    const it = task && task.item;
    if (form.matches('[data-fu-version-form]')) {
      const unit = form.dataset.fuUnitId;
      const valores = { stage: form.dataset.fuStage, action: fd.action || 'principal', channel: 'whatsapp', trigger: '', body: fd.body, ctas: ['whatsapp', 'demo', 'copy'], status: fd.status };
      if (await fuOp(unit, { op: 'version-create', valores }, { label: 'Versión guardada.' })) loadFollowup();
      return;
    }
    if (!task) return;
    if (form.matches('[data-fu-situation]')) {
      if (await fuOp(task.unit, { op: 'situation', inmobiliaria: it.id, situacion: fd.situacion, texto: fd.texto }, { label: 'Situación guardada.' })) { state.fu.task = null; loadFollowup(); }
    } else if (form.matches('[data-fu-reply]')) {
      if (await fuOp(task.unit, { op: 'reply', inmobiliaria: it.id, texto: fd.texto, ...(fd.clasificacion ? { clasificacion: fd.clasificacion, confianza: 1 } : {}) }, { label: 'Respuesta registrada.' })) { state.fu.task = null; loadFollowup(); }
    } else if (form.matches('[data-fu-owner]')) {
      if (await fuOp(task.unit, { op: 'owner', inmobiliaria: it.id, responsable: fd.responsable }, { label: 'Responsable asignado.' })) { it.owner = fd.responsable; render(); loadFollowup({ quiet: true }); }
    } else if (form.matches('[data-fu-fail]')) {
      if (!fd.motivo && !fd.tipo) { toast('Contá por qué no salió.', true); return; }
      const f = { ...F.taskFields(it), ...(task.versionId ? { version: task.versionId } : {}), ...(task.actionKey ? { tarea: task.actionKey } : {}), ...(task.stage ? { etapa: task.stage } : {}) };
      if (await fuOp(task.unit, { op: 'fail', ...f, motivo: fd.motivo, ...(fd.tipo ? { tipo: fd.tipo } : {}) }, { label: 'Registrado: no salió.' })) { state.fu.task = null; loadFollowup(); }
    } else if (form.matches('[data-fu-snooze]')) {
      if (!fd.hasta) { toast('Elegí la fecha.', true); return; }
      const until = new Date(`${fd.hasta}T09:00:00-03:00`).toISOString();
      if (await fuOp(task.unit, { op: 'snooze', inmobiliaria: it.id, hasta: until, motivo: fd.motivo }, { label: 'Reprogramada.' })) { state.fu.task = null; loadFollowup(); }
    }
  }, true);
  document.addEventListener('change', (e) => {
    if(e.target.closest('[data-fu-rule-form], [data-fu-turnia-rule-form], [data-fu-new-rule-message]'))fuRulesState(state.unit).dirty=true;
    if(e.target.matches('[data-fu-rule-form] input[name="sit"][value="rechazo"]')){
      const form=e.target.closest('[data-fu-rule-form]');
      if(form){
        const action=form.querySelector('select[name="action"]');
        if(e.target.checked){
          if(action&&[...action.options].some(x=>x.value==='encuesta_cierre'))action.value='encuesta_cierre';
          for(const checkbox of form.querySelectorAll('input[name="sit"]'))if(checkbox!==e.target)checkbox.checked=false;
          const wait=form.querySelector('input[name="after_hours"]');if(wait)wait.value='0';
          const previous=form.querySelector('select[name="after_action"]');if(previous)previous.value='';
        }else if(action&&action.value==='encuesta_cierre')action.value='principal';
        fuRulesState(state.unit).dirty=true;
      }
    }
    if(e.target.matches('[data-fu-rule-action]')){
      const form=e.target.closest('[data-fu-rule-form]');
      if(form){
        const survey=e.target.value==='encuesta_cierre',reject=form.querySelector('input[name="sit"][value="rechazo"]');
        if(reject){reject.checked=survey;if(survey)for(const other of form.querySelectorAll('input[name="sit"]'))if(other!==reject)other.checked=false;}
        const wait=form.querySelector('input[name="after_hours"]');
        if(survey && wait)wait.value='0';
        const previous=form.querySelector('select[name="after_action"]');
        if(survey && previous)previous.value='';
        fuRulesState(state.unit).dirty=true;
      }
    }
    if(e.target.matches('[data-fu-rules-tech]')){
      const ui=fuRulesState(state.unit);
      if(ui.dirty&&!window.confirm('Tenés cambios sin guardar. ¿Descartarlos?')){render();return;}
      ui.technical=e.target.value;ui.dirty=false;render();return;
    }
    if(e.target.matches('[data-fu-rule-template]')){
      state.fu.ruleTemplate=e.target.value||null;render();return;
    }
    if(e.target.matches('[data-fu-catalog-source]')){
      const form=e.target.closest('[data-fu-state-form]'), product=e.target.value==='product';
      if(form?.querySelector('[data-catalog-products]'))form.querySelector('[data-catalog-products]').hidden=!product;
      if(form?.querySelector('[data-catalog-mapping]'))form.querySelector('[data-catalog-mapping]').hidden=product;
    }
    if(e.target.matches('[data-fu-inbox-form] input[name="clase"]')){
      const selected=e.target.value, form=e.target.closest('[data-fu-inbox-form]');
      for(const block of form.querySelectorAll('[data-reply-condition]'))
        block.hidden=block.dataset.replyCondition!==selected;
    }
    if (e.target.matches('[data-fu-filter]')) { state.fu.f[e.target.dataset.fuFilter] = e.target.value; store('fu-filters', state.fu.f); render(); }
    if(e.target.matches('[data-fu-queue-select]')){
      const q=fuQueueState();q[e.target.dataset.fuQueueSelect]=e.target.value||null;q.limit=25;render();
    }
  });
  document.addEventListener('toggle', (e) => {
    if (e.target.matches && e.target.matches('[data-fu-details]')) state.fu.open[e.target.dataset.fuDetails] = e.target.open;
  }, true);
  document.addEventListener('input', (e) => {
    if(e.target.closest('[data-fu-rule-form], [data-fu-turnia-rule-form], [data-fu-new-rule-message]'))fuRulesState(state.unit).dirty=true;
    if(e.target.matches('[data-fu-queue-search]')){
      const target=e.target,q=fuQueueState();q.search=target.value;q.limit=25;
      clearTimeout(target._t);
      target._t=setTimeout(()=>{const pos=target.selectionStart;render();const next=$('[data-fu-queue-search]');if(next){next.focus();next.setSelectionRange(pos,pos)}},230);
      return;
    }
    if (!e.target.matches('[data-fu-search]')) return;
    state.fu.f.q = e.target.value;
    clearTimeout(e.target._t);
    e.target._t = setTimeout(() => { const pos = e.target.selectionStart; render(); const s = $('[data-fu-search]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } }, 200);
  });
  // La cola se relee cada minuto mientras se mira (así se ve lo que toma la otra persona).
  setInterval(() => {
    if (document.visibilityState === 'visible' && isFu() && !state.fu.task && !state.fu.busy && !state.demo) loadFollowup({ quiet: true });
  }, 60000);


  // Igual que Habita: prioridad drag & drop (con flechas accesibles como alternativa).
  document.addEventListener('dragstart',(e)=>{
    const target=e.target.closest?.('[data-fu-drag-key]');
    if(!target)return;
    const ui=fuRulesState(state.unit);
    if(state.unit!=='habita'||ui.dirty||ui.moving){e.preventDefault();return;}
    state.fu.dragRuleKey=target.dataset.fuDragKey;
    e.dataTransfer?.setData('text/plain',state.fu.dragRuleKey);
    if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
  });
  document.addEventListener('dragover',(e)=>{
    const target=e.target.closest?.('[data-fu-drag-key]');
    if(!target||!state.fu.dragRuleKey||target.dataset.fuDragKey===state.fu.dragRuleKey)return;
    e.preventDefault();
    document.querySelectorAll('.fu-ref-rule.drag-target').forEach(x=>x.classList.remove('drag-target'));
    target.classList.add('drag-target');
  });
  document.addEventListener('drop',async(e)=>{
    const target=e.target.closest?.('[data-fu-drag-key]');
    const key=state.fu.dragRuleKey;
    if(!target||!key)return;
    e.preventDefault();state.fu.dragRuleKey=null;
    document.querySelectorAll('.fu-ref-rule.drag-target').forEach(x=>x.classList.remove('drag-target'));
    if(target.dataset.fuDragKey!==key)await fuRulesMove(state.unit,key,target.dataset.fuDragKey);
  });
  document.addEventListener('dragend',()=>{
    state.fu.dragRuleKey=null;
    document.querySelectorAll('.fu-ref-rule.drag-target').forEach(x=>x.classList.remove('drag-target'));
  });

  // ─── Eventos ────────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-open-account], [data-goto], a');
    if (!t) return;
    const ds = t.dataset;
    if (ds.copyText !== undefined) { copy(ds.copyText); return; }
    // Confirmación en la misma página (sin ventanas del navegador, que traban a los agentes de IA):
    // el primer clic pide confirmar y el segundo, dentro de 5 s, ejecuta.
    if (ds.arm && ds.armed !== '1') {
      ds.armed = '1';
      ds.label = t.innerHTML;
      t.textContent = ds.arm;
      t.classList.add('armed');
      setTimeout(() => { if (t.isConnected && ds.armed === '1') { ds.armed = ''; t.innerHTML = ds.label; t.classList.remove('armed'); } }, 5000);
      return;
    }
    if (ds.unit && t.closest('#units')) { go(ds.unit, ds.unit === 'todas' ? 'resumen' : 'hoy'); ensureLoaded(); return; }
    if (ds.view) { go(state.unit, ds.view); return; }
    if (ds.goto) { go(ds.goto, ds.viewTo || 'hoy'); ensureLoaded(); return; }
    if (ds.period) { state.period = ds.period; render(); loadMetrics().then(render); return; }
    if (ds.fold) {
      const folds = store(`folds-${state.unit}`) || {};
      const block = t.closest('.block');
      const open = block.dataset.open !== 'true';
      folds[ds.fold] = open;
      store(`folds-${state.unit}`, folds);
      block.dataset.open = String(open);
      t.setAttribute('aria-expanded', String(open));
      return;
    }
    if (ds.dim && !t.closest('#units')) { state.breakdownDim[state.unit] = ds.dim; render(); return; }
    if (ds.drillStage) {
      const map = { prospectados: 'all', contactados: 'contactados', respondieron: 'respondieron', interesados: 'interesados', reuniones: 'reuniones', clientes: 'clientes' };
      filt(state.unit).stage = map[ds.drillStage] || 'all';
      go(state.unit, 'cuentas');
      return;
    }
    if (ds.undim) {
      const f = filt(state.unit);
      if (ds.undim === '*') f.dims = {}; else delete f.dims[ds.undim];
      render();
      return;
    }
    if (ds.agent) {
      const card = $('#agent');
      const id = card && card.dataset.accountId;
      const key = card && card.dataset.template;
      switch (ds.agent) {
        case 'open': if (id) startSend(id, 'whatsapp', key, null, { inline: true }); break;
        case 'sent': await confirmSend(true); break;
        case 'not-sent': await confirmSend(false); break;
        case 'no-wa': {
          state.pending = null;
          savePending(null);
          await act(id, { type: 'outcome', outcome: 'invalido', detail: 'WhatsApp dice que el número no es válido' }, { label: 'Marcado: no tiene WhatsApp' });
          render();
          break;
        }
        case 'skip': skipAgent(id); state.agent.replied = null; render(); break;
        case 'chat': { const a = findAccount(id); if (a) openWhatsApp(a.phone, ''); break; }
        case 'replied': state.agent.replied = id; render(); break;
        case 'override': store(`override-${state.unit}`, C.today()); render(); break;
        default: break;
      }
      return;
    }
    if (ds.editTpl) {
      const t = templatesOf(state.unit)[ds.editTpl];
      state.editing = { unit: state.unit, key: ds.editTpl, text: t.text, subject: t.subject || '' };
      render();
      const ta = main.querySelector('[data-tpl-text]');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      return;
    }
    if (ds.insertVar) {
      const ta = main.querySelector('[data-tpl-text]');
      if (ta) {
        const [a0, b0] = [ta.selectionStart, ta.selectionEnd];
        ta.setRangeText(ds.insertVar, a0, b0, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
      }
      return;
    }
    if (ds.moreBlock) { state.more[ds.moreBlock] = true; render(); return; }
    // Responder
    const accOf = (k) => String(k || '').slice(String(k || '').indexOf(':') + 1);
    if (ds.openLine !== undefined && t.closest('main')) { store(`open-line-${state.unit}`, ds.openLine); render(); return; }
    if (ds.replyOpen) {
      const row = inboxOf(state.unit).rows.find((r) => r.a.id === accOf(ds.replyOpen));
      if (row) { const v = replyView(row, state.unit); openWhatsApp(row.a.phone, v.parts[0] || v.text); }
      return;
    }
    if (ds.replySent) { await replySent(state.unit, accOf(ds.replySent)); return; }
    if (ds.replyRefer) { state.referOpen = state.referOpen === ds.replyRefer ? null : ds.replyRefer; render(); const f = main.querySelector('[data-refer-form] input[name="phone"]'); if (f) f.focus(); return; }
    if (ds.manualSent) { await manualSent(ds.manualSent, ds.manualKind, ds.key); return; }
    if (ds.stageFilter) { filt(state.unit).stage = ds.stageFilter; state.shown = 100; render(); return; }
    if (ds.send) { e.stopPropagation(); const a = findAccount(ds.send); const next = a && C.nextTemplate(a, unitOf(state.unit)); startSend(ds.send, next ? next.channel : 'whatsapp', ds.key); return; }
    if (ds.chat) { e.stopPropagation(); const a = findAccount(ds.chat); if (a) openWhatsApp(a.phone, ''); return; }
    if (ds.confirm) { confirmSend(ds.confirm === 'yes'); return; }
    if (ds.openAccount && !e.target.closest('button, a')) { openDrawer(ds.openAccount); return; }
    if (ds.sendDrawer) {
      const dr = $('#drawer');
      startSend(state.drawer, ds.sendDrawer, dr.dataset.key, dr.querySelector('[data-text]').value);
      return;
    }
    const detail = () => { const i = $('#drawer [data-detail]'); return i ? i.value.trim() : ''; };
    if (ds.log) { await act(state.drawer, { type: ds.log, detail: detail() }, { label: ds.log === 'call' ? 'Llamada registrada' : 'Visita registrada', undoable: true }); return; }
    if (ds.outcome) {
      const u = unitOf(state.unit);
      await act(state.drawer, { type: 'outcome', outcome: ds.outcome, detail: detail() }, { label: `Marcado: ${u.stageLabel(ds.outcome)}`, undoable: true });
      return;
    }
    if (ds.accountLink !== undefined) {
      const sel = $('#drawer [data-account-select]');
      if (!sel || !sel.value) { toast('Elegí la clínica.', true); return; }
      const name = sel.options[sel.selectedIndex].textContent;
      await act(state.drawer, { type: 'account', clinicId: sel.value, clinicName: name }, { label: `Cuenta vinculada: ${name}` });
      return;
    }
    if (ds.account !== undefined && t.closest('#drawer')) {
      await act(state.drawer, { type: 'account', clinicId: null }, { label: 'Cuenta desvinculada' });
      return;
    }
    if (ds.demo) { await act(state.drawer, { type: 'demo', tried: ds.demo === 'tried' }, { label: ds.demo === 'tried' ? 'Probó la demo' : 'Abrió la demo', undoable: true }); return; }
    // habita. · Inmobiliarias
    if (ds.agSet !== undefined) { const ch = Object.fromEntries(new URLSearchParams(ds.agSet)); agSet(ch); return; }
    if (ds.agMenu !== undefined) {
      // Fijo debajo del botón, para que el scroll de la tabla no lo corte (como en la lista original).
      const r = t.getBoundingClientRect();
      state.agMenuAt = { top: Math.min(r.bottom + 6, innerHeight - 300), left: Math.min(r.left, innerWidth - 300), y: scrollY };
      state.agMenu = ds.agMenu && state.agMenu !== ds.agMenu ? ds.agMenu : null;
      state.agMore = null;
      agPop();
      return;
    }
    if (ds.agMore !== undefined) {
      const r = t.getBoundingClientRect();
      state.agMenuAt = { top: Math.min(r.bottom + 6, innerHeight - 260), left: Math.min(r.right, innerWidth - 48), y: scrollY };
      state.agMore = state.agMore !== ds.agMore ? ds.agMore : null;
      state.agMenu = null;
      agPop();
      return;
    }
    if (ds.agWa) { openWhatsApp(ds.agWa, '¡Buenas!'); return; }
    if (ds.agCopy !== undefined) { copy(ds.agCopy); return; }
    if (ds.agAudio) {
      if (state.demo) { toast('En el ejemplo no se cambia nada.', true); return; }
      await act(ds.agAudio, { type: 'sent', channel: 'whatsapp', format: 'audio' }, { label: 'Audio registrado · tocá 🎤 ✓ para desmarcarlo' });
      return;
    }
    if (ds.agUnaudio) {
      if (state.demo) { toast('En el ejemplo no se cambia nada.', true); return; }
      await act(ds.agUnaudio, { type: 'unaudio' }, { label: 'Audio desmarcado' });
      return;
    }
    if (ds.agWaAccount) {
      // Turnia: el mensaje que le toca (saludo, demo o seguimiento) y después la confirmación de que salió.
      const a = findAccount(ds.agWaAccount);
      const next = a && C.nextTemplate(a, unitOf(state.unit));
      if (next && next.channel === 'whatsapp') startSend(a.id, 'whatsapp', next.key);
      else if (a) openWhatsApp(a.phone, '');
      return;
    }
    if (ds.openAccount && t.matches('a, button')) { e.preventDefault(); state.agMore = null; state.agMenu = null; agPop(); openDrawer(ds.openAccount); return; }
    if (ds.agSent !== undefined && !fromApi(state.unit)) {
      // Turnia: «Enviada» registra el saludo (si faltaba) y la demo, como el registro en lote.
      const a = findAccount(ds.id);
      if (ds.agSent === '0') { toast('Para deshacer un envío, usá «Deshacer» en la ficha.', true); return; }
      if (!a) return;
      if (state.demo) { toast('En el ejemplo no se cambia nada.', true); return; }
      const steps = [...(!a.greetingSent && !a.touches && unitOf(state.unit).greetingFirst ? [0] : []), 1];
      t.disabled = true;
      try {
        const r = await api('bulk', { method: 'POST', body: { unit: state.unit, items: [{ id: a.id, actions: steps.map((step) => ({ type: 'sent', step, channel: 'whatsapp' })) }] } });
        const x = r.results && r.results[0];
        if (!x || !x.ok) throw new Error((x && x.error) || 'No se pudo registrar.');
        if (x.account) replaceAccount(state.unit, x.account);
        state.agMenu = null;
        toast(`Demo de ${a.name} registrada como enviada`);
        render();
      } catch (err) { toast(err.message, true); t.disabled = false; }
      return;
    }
    if (ds.agSent !== undefined) {
      t.disabled = true;
      try {
        const r = await agencyAction({ inmobiliaria: ds.id, accion: 'demo-estado', enviada: ds.agSent === '1' });
        state.agMenu = null;
        if (r) { toast(ds.agSent === '1' ? 'Demo marcada como enviada' : 'Demo marcada como creada'); await loadAgencies(state.unit, { quiet: true }); }
        render();
      } catch (err) { toast(err.message, true); t.disabled = false; }
      return;
    }
    if (ds.agLink) {
      const label = t.querySelector('span');
      const before = label ? label.textContent : '';
      t.disabled = true;
      if (label) label.textContent = '…';
      try {
        const r = await agencyAction({ inmobiliaria: ds.id, accion: ds.agLink === 'demo' ? 'link-demo' : 'link-panel' });
        if (r && r.url) { await navigator.clipboard.writeText(r.url); t.classList.add('is-done'); if (label) label.textContent = 'Copiado'; }
      } catch (err) { t.classList.add('is-error'); if (label) label.textContent = 'No se pudo'; toast(err.message, true); }
      setTimeout(() => { if (!t.isConnected) return; t.disabled = false; t.classList.remove('is-done', 'is-error'); if (label) label.textContent = before; }, 2000);
      return;
    }
    switch (ds.action) {
      case 'close': closeDrawer(); break;
      case 'copy': copy($('#drawer [data-text]').value); break;
      case 'undo': {
        const u = state.undo[state.drawer];
        if (u) await act(state.drawer, { type: 'undo', previous: u.previous, detail: u.label }, { label: 'Deshecho' });
        break;
      }
      case 'reopen': await act(state.drawer, { type: 'reopen' }, { label: 'Cuenta reabierta' }); break;
      case 'schedule': {
        const dr = $('#drawer');
        await act(state.drawer, { type: 'schedule', nextAt: dr.querySelector('[data-next-at]').value, nextStep: dr.querySelector('[data-next-step]').value }, { label: 'Próximo paso guardado' });
        break;
      }
      case 'more': state.shown += 100; render(); break;
      case 'ag-reload': if (fromApi(state.unit)) { state.ag[state.unit] = null; render(); } else { await loadUnit(state.unit, { quiet: true }); render(); toast('Actualizado'); } break;
      case 'ag-recalc': {
        if (state.agRecalc === 'busy') break;
        state.agRecalc = 'busy'; render();
        try { const r = await agencyAction({ accion: 'recalcular-scores' }); state.agRecalc = r ? 'Lead scores recalculados.' : ''; if (r) await loadAgencies(state.unit, { quiet: true }); } catch (err) { state.agRecalc = err.message; }
        render();
        break;
      }
      case 'sync': toast('Trayendo la planilla…'); await maybeSync(state.unit, { force: true }); break;
      case 'bulk-open': state.bulk = { unit: state.unit, text: '', picks: {}, reviewed: false }; render(); { const ta = $('[data-bulk-text]'); if (ta) ta.focus(); } break;
      case 'bulk-close': if (!state.bulk || !state.bulk.running) { state.bulk = null; render(); } break;
      case 'bulk-review': if (state.bulk) { state.bulk.reviewed = true; state.bulk.results = null; render(); } break;
      case 'bulk-run': if (state.bulk && !state.bulk.running) { if (!state.bulk.reviewed) { state.bulk.reviewed = true; render(); } else await runBulk(state.unit); } break;
      case 'cancel-tpl': state.editing = null; render(); break;
      case 'edit-targets': state.editingTargets = state.unit; render(); break;
      case 'cancel-targets': state.editingTargets = null; render(); break;
      case 'reset-targets': await saveTargets({ reset: true }); break;
      case 'copy-instructions': copy(agentInstructions(unitOf(state.unit))); break;
      case 'copy-reply-instructions': copy(replyInstructions(unitOf(state.unit))); break;
      case 'manual-drawer': {
        const key = $('#drawer').dataset.key;
        await manualSent(state.drawer, key === 'libre' ? 'conversation' : 'sent', key);
        break;
      }
      case 'resp-sync': {
        if (state.respSync) break;
        state.respSync = true; render();
        try {
          const { result } = await api('task', { method: 'POST', body: { unit: state.unit, followup: { op: 'whatsapp-sync' } } });
          const w = result && result.whatsapp;
          toast(w && w.reused ? 'Se leyó hace menos de 10 minutos: es la última lectura.' : `Listo: ${int(w && w.totals ? w.totals.nuevas : 0)} respuestas nuevas.`);
        } catch (err) { toast(err.message, true); }
        state.respSync = false;
        await loadUnit(state.unit, { quiet: true, noSync: true });
        render();
        break;
      }
      case 'resp-reload': await loadFollowup({ quiet: true }); render(); break;
      case 'factory-tpl': {
        const t = templatesOf(state.unit)[state.editing.key];
        state.editing.text = t.factory;
        state.editing.subject = t.factorySubject || state.editing.subject;
        render();
        break;
      }
      case 'demo': await startDemo(); break;
      case 'exit-demo': state.demo = false; state.data = {}; go(state.unit, state.view, { replace: true }); boot(); break;
      case 'reload': state.data[state.unit] = null; ensureLoaded(true); break;
      case 'setup': {
        try { await api('setup', { method: 'POST', body: { unit: state.unit } }); toast('Planilla preparada'); } catch (err) { toast(err.message, true); }
        await loadUnit(state.unit); render();
        break;
      }
      default: break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.pending && !state.pending.inline) { confirmSend(false); return; }
      if (state.drawer) closeDrawer();
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open-account], tr[data-drill-dim]')) {
      e.preventDefault();
      e.target.click();
    }
  });
  document.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-drill-dim]');
    if (!row) return;
    filt(state.unit).dims[row.dataset.drillDim] = row.dataset.drillValue;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#scrim').addEventListener('click', closeDrawer);

  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-tpl-text]') && state.editing) {
      state.editing.text = e.target.value;
      const d = state.data[state.unit];
      const sample = d.accounts.find((a) => a.stage === 'por_contactar' && a.name) || d.accounts[0] || { name: 'Ana Ejemplo', greeting: 'Ana' };
      const pv = main.querySelector('[data-tpl-preview]');
      if (pv) pv.textContent = C.renderTemplate(state.editing.text, sample, unitOf(state.unit));
      return;
    }
    if (e.target.matches('[data-tpl-form] input[name="subject"]') && state.editing) { state.editing.subject = e.target.value; return; }
    if (e.target.matches('[data-bulk-text]') && state.bulk) { state.bulk.text = e.target.value; state.bulk.reviewed = false; return; }
    if (e.target.matches('[data-ag-search]')) {
      clearTimeout(e.target._t);
      const el = e.target;
      el._t = setTimeout(() => { const pos = el.selectionStart; agSet({ q: el.value }, { push: false }); const s = $('[data-ag-search]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } }, 250);
      return;
    }
    if (e.target.matches('[data-search]')) {
      filt(state.unit).q = e.target.value;
      clearTimeout(e.target._t);
      e.target._t = setTimeout(() => { const pos = e.target.selectionStart; render(); const s = $('[data-search]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } }, 180);
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-dim-select]')) {
      const f = filt(state.unit);
      if (e.target.value) f.dims[e.target.dataset.dimSelect] = e.target.value; else delete f.dims[e.target.dataset.dimSelect];
      render();
    }
    if (e.target.matches('[data-send-whatsapp-line]')) {
      store('send-whatsapp-line', e.target.value);
      state.agent.replied = null;
      render();
      $('[data-send-whatsapp-line]')?.focus();
    }
    if (e.target.matches('[data-tpl]')) { $('#drawer').dataset.key = e.target.value; renderDrawer(); }
    if (e.target.matches('[data-reply-pick]')) {
      state.replyPick = state.replyPick || {};
      state.replyPick[e.target.dataset.replyPick] = e.target.value;
      const key = e.target.dataset.replyPick;
      render();
      const sel = main.querySelector(`[data-reply-pick="${CSS.escape(key)}"]`);
      if (sel) sel.focus();
    }
    if (e.target.matches('[data-bulk-pick]') && state.bulk) { state.bulk.picks[e.target.dataset.bulkPick] = e.target.value; render(); }
  });
  document.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'login') {
      const fd = new FormData(form);
      const err = $('#login-error');
      err.textContent = '';
      try {
        const r = await api('login', { method: 'POST', body: { name: fd.get('name'), password: fd.get('password') } });
        store('name', fd.get('name'));
        state.session.user = r.user;
        render();
        ensureLoaded();
      } catch (x) { err.textContent = x.message; }
    }
    if (form.matches('[data-ag-range]')) {
      const fd = new FormData(form);
      agSet({ periodo: '', desde: fd.get('desde') || '', hasta: fd.get('hasta') || '' });
      return;
    }
    if (form.matches('[data-ag-filters]')) {
      const fd = new FormData(form);
      agSet({ cuenta: fd.get('cuenta') || '', score: fd.get('score') || '', actividad: fd.get('actividad') || '' });
      return;
    }
    if (form.matches('[data-edit]')) {
      const fields = Object.fromEntries(new FormData(form).entries());
      await act(state.drawer, { type: 'edit', fields }, { label: 'Datos guardados' });
    }
    if (form.matches('[data-targets-form]')) {
      const fd = new FormData(form);
      const rates = {};
      for (const t of unitOf(state.unit).targets.slice(1)) rates[t.key] = Number(fd.get(`rate-${t.key}`)) / 100;
      await saveTargets({ perWeek: Number(fd.get('perWeek')), rates });
      return;
    }
    if (form.matches('[data-tpl-form]')) {
      const ed = state.editing;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const r = state.demo
          ? { template: { title: templatesOf(ed.unit)[ed.key].title, text: ed.text, subject: ed.subject } }
          : await api('template', { method: 'POST', body: { unit: ed.unit, key: ed.key, text: ed.text, subject: ed.subject } });
        const d = state.data[ed.unit];
        if (r.templates) d.templates = r.templates;
        else d.templates = { ...(d.templates || {}), [ed.key]: r.template };
        state.editing = null;
        toast('Mensaje guardado');
        render();
      } catch (err) {
        btn.disabled = false;
        toast(err.message, true);
      }
      return;
    }
    if (form.matches('[data-refer-form], [data-refer-drawer]')) {
      const fd = new FormData(form);
      const phone = String(fd.get('phone') || '').trim();
      const name = String(fd.get('name') || '').trim();
      const fromRow = form.matches('[data-refer-form]');
      const key = form.dataset.referForm || '';
      const accId = fromRow ? key.slice(key.indexOf(':') + 1) : state.drawer;
      const u = unitOf(state.unit);
      if (u.inbox === 'bandeja') {
        const row = inboxOf(state.unit).rows.find((r) => r.a.id === accId);
        if (state.demo) { toast('En el ejemplo no se cambia nada.', true); return; }
        if (!row || !row.inbound.replyId) { toast('No encontramos la respuesta en la bandeja.', true); return; }
        const r = await fuOp(state.unit, { op: 'reply', id: row.inbound.replyId, clasificacion: 'derivo', contactoNombre: name, contactoWhatsapp: phone }, { label: 'Derivación guardada: el contacto nuevo quedó en la inmobiliaria.' });
        if (r) { state.referOpen = null; await loadFollowup({ quiet: true }); render(); }
        return;
      }
      const res = await act(accId, { type: 'refer', phone, name }, { label: 'Número nuevo guardado en la cuenta (el anterior quedó en las notas)' });
      if (res) { state.referOpen = null; render(); }
      return;
    }
    if (form.matches('[data-note]')) {
      const text = new FormData(form).get('note');
      if (String(text || '').trim()) await act(state.drawer, { type: 'note', text }, { label: 'Nota agregada' });
    }
  });

  $('#user').addEventListener('click', async () => {
    if (state.demo) { state.demo = false; state.data = {}; boot(); return; }
    const u = $('#user');
    if (u.dataset.armed !== '1') {
      u.dataset.armed = '1';
      toast('Tocá de nuevo para cerrar la sesión');
      setTimeout(() => { u.dataset.armed = ''; }, 5000);
      return;
    }
    u.dataset.armed = '';
    await api('logout', { method: 'POST', body: {} }).catch(() => {});
    state.session.user = null;
    state.data = {};
    render();
  });

  // Foto de fondo: si está prospecting/fondo.jpg, se usa; si no, queda la luz de color.
  const photo = new Image();
  photo.onload = () => {
    const el = document.querySelector('.ambient .photo');
    if (el) el.style.backgroundImage = `url(${photo.src})`;
    document.documentElement.classList.add('has-photo');
  };
  photo.src = '/prospecting/fondo.jpg';

  // Tema compartido con el tablero.
  const root = document.documentElement;
  try { const saved = localStorage.getItem('chapa-theme'); if (saved) root.dataset.theme = saved; } catch { /* sin storage */ }
  $('#theme').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('chapa-theme', root.dataset.theme); } catch { /* sin storage */ }
  });
  let resizeTimer = 0;
  let lastWidth = innerWidth;
  window.addEventListener('resize', () => {
    document.querySelectorAll('.seg').forEach(moveThumb);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (Math.abs(innerWidth - lastWidth) > 40 && main.querySelector('.chart')) { lastWidth = innerWidth; render(); } }, 250);
  });

  // ─── Arranque ───────────────────────────────────────────────
  async function startDemo() {
    if (!window.ProspectingFixture) {
      await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = '/prospecting/fixture.js'; s.onload = ok; s.onerror = ko; document.body.appendChild(s); });
    }
    state.demo = true;
    state.session = state.session || { auth: false, google: false, units: [] };
    for (const u of units()) await loadUnit(u.id);
    go(state.unit, state.view, { replace: true });
    loadMetrics().then(render);
  }

  async function ensureLoaded(force) {
    if (state.demo || !state.session || !state.session.user) return;
    const ids = state.unit === 'todas' ? units().map((u) => u.id) : [state.unit, ...units().map((u) => u.id).filter((x) => x !== state.unit)];
    await Promise.all(ids.map(async (id) => {
      if (!force && state.data[id] && (state.data[id].accounts || state.data[id].loading)) return;
      await loadUnit(id);
      render();
    }));
  }

  async function boot() {
    readRoute();
    renderTop();
    try {
      state.session = await api('session');
    } catch {
      state.session = { auth: false, google: false, units: units().map((u) => ({ id: u.id, sheet: false, sheetEnv: u.sheetEnv })), offline: true };
    }
    if (new URLSearchParams(location.search).get('ejemplo') === '1') { await startDemo(); return; }
    render();
    await ensureLoaded();
    await loadMetrics();
    render();
  }

  // Al volver a la pestaña, se relee la planilla (alguien pudo cambiarla).
  window.addEventListener('turnia-voice-sent', () => {
    if (state.unit === 'turnia' && !state.demo) loadUnit('turnia', { quiet: true }).then(render);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.demo && state.session && state.session.user && !state.drawer && !state.pending) {
      Promise.all(units().map((u) => loadUnit(u.id, { quiet: true }))).then(render);
      if (isFu() && !state.fu.task) loadFollowup({ quiet: true });
    }
  });

  boot();
})();
