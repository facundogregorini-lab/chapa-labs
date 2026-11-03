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

  async function loadUnit(id, { quiet } = {}) {
    if (state.demo) {
      state.data[id] = window.ProspectingFixture.build(unitOf(id));
      return;
    }
    if (!quiet) state.data[id] = { loading: true };
    try {
      const d = await api('data', { query: { unit: id } });
      state.data[id] = d;
    } catch (err) {
      state.data[id] = { error: err.message, code: err.body && err.body.code };
      if (err.status === 401) { state.session.user = null; render(); }
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
    state.view = state.unit === 'todas' ? 'resumen' : ['hoy', 'embudo', 'cuentas', 'mensajes', 'playbook'].includes(v) ? v : 'hoy';
  }
  function go(unit, view, { replace } = {}) {
    state.unit = unit;
    state.view = unit === 'todas' ? 'resumen' : view || 'hoy';
    state.shown = 100;
    const url = `/prospecting${unit === 'todas' ? '' : `/${unit}`}${unit !== 'todas' && state.view !== 'hoy' ? `?vista=${state.view}` : ''}${state.demo ? (unit !== 'todas' && state.view !== 'hoy' ? '&' : '?') + 'ejemplo=1' : ''}`;
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
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
    const segs = [['todas', 'Todas', 's1'], ...units().map((u) => [u.id, u.name, u.color])];
    $('#units').innerHTML = segs.map(([id, name, c]) => `<button type="button" data-unit="${id}" aria-pressed="${state.unit === id}"><span class="dot" style="--c:var(--${c})"></span>${esc(name)}</button>`).join('') + '<span class="seg-thumb" aria-hidden="true" data-liquid="18" data-liquid-bezel="14" data-liquid-blur="0.6"></span>';
    const tabs = state.unit === 'todas'
      ? [['resumen', 'Resumen']]
      : [['hoy', 'Hoy', queueCount()], ['embudo', 'Embudo'], ['cuentas', 'Cuentas'], ['mensajes', 'Mensajes'], ['playbook', 'Playbook']];
    $('#tabs').innerHTML = tabs.map(([k, l, n]) => `<button type="button" role="tab" data-view="${k}" aria-selected="${state.view === k}">${l}${n ? ` <span class="count num">${n}</span>` : ''}</button>`).join('');
    document.body.dataset.unit = state.unit;
    const userBtn = $('#user');
    const user = state.session && state.session.user;
    userBtn.hidden = !user && !state.demo;
    userBtn.textContent = state.demo ? 'Ej.' : user ? user.name.slice(0, 2).toUpperCase() : '';
    userBtn.title = state.demo ? 'Salir del modo de ejemplo' : user ? `${user.name} · cerrar sesión` : '';
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
    if (state.unit === 'todas') main.innerHTML = renderOverview();
    else {
      const d = state.data[state.unit];
      if (!d || d.loading) main.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
      else if (d.error) main.innerHTML = unitError(state.unit, d);
      else main.innerHTML = demoBanner() + readOnlyBanner(state.unit) + ({ hoy: renderToday, embudo: renderFunnelView, cuentas: renderAccounts, mensajes: renderMessages, playbook: renderPlaybook }[state.view] || renderToday)(state.unit);
    }
    after();
  }
  function after() {
    window.LiquidGlass && window.LiquidGlass.scan();
    requestAnimationFrame(() => document.querySelectorAll('.seg').forEach(moveThumb));
    bindCharts();
  }

  // Unidades cuya planilla escribe su propia app (Turnia): acá se mira y se mide; se opera allá.
  const isReadOnly = (id) => { const d = state.data[id]; return Boolean(d && d.readOnly && !state.demo); };
  function readOnlyBanner(id) {
    if (!isReadOnly(id)) return '';
    const u = unitOf(id);
    const d = state.data[id];
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
  function targetHtml(u, accounts, { compact } = {}) {
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
      <section class="card glass"><div class="card-head"><div><h2>Embudo contra la meta</h2><p class="sub">Saludos: ${int(u.targets[0].perWeek)} por semana. Cada paso, la conversión esperada sobre el anterior. Lo de la planilla es la cohorte contactada en el período; lo de la app, el mismo período desde su <code>/api/metricas</code>.</p></div></div>${targetHtml(u, list)}</section>
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
      return `<rect x="${x}" y="${H - B - h}" width="${wpx}" height="${h}" rx="${Math.min(4, wpx / 2)}" fill="${color(u)}"/><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-tip="${esc(JSON.stringify({ t: shortDay(p.date), v: `${int(p.contactos)} contactos`, e: `${int(p.nuevos || 0)} nuevos · ${int(p.respuestas || 0)} respuestas` }))}"/>`;
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
    const block = (key, title, sub, list, { open = true } = {}) => {
      const isOpen = folds[key] === undefined ? open : folds[key];
      return `<section class="card glass block" data-open="${isOpen}" aria-label="${esc(title)}">
        <button type="button" class="block-head" data-fold="${key}" aria-expanded="${isOpen}"><div><h3>${esc(title)} <span class="count num" style="vertical-align:1px">${list.length}</span></h3><p class="sub">${sub}</p></div><span class="chev">${icon.chev}</span></button>
        <div class="rows">${list.length ? list.slice(0, state.more[key] ? list.length : 15).map((a) => accountRow(a, u, key)).join('') + (list.length > 15 && !state.more[key] ? `<div style="text-align:center;padding:6px"><button class="btn small" type="button" data-more-block="${key}">Ver los ${int(list.length - 15)} restantes</button></div>` : '') : `<p class="empty">${key === 'fresh' && q.freshTotal === 0 ? `No quedan ${esc(u.entity.many)} con canal para contactar: sumá una lista a la planilla.` : 'Nada por acá.'}</p>`}</div></section>`;
    };
    return `
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Hoy</span><h1>${q.doneToday >= q.goal ? '¡Meta del día cumplida!' : `Te faltan ${int(q.goal - q.doneToday)} contactos nuevos`}</h1><p>${esc(u.hours)}</p></div>
        <div class="progress"><svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${int(q.doneToday)} de ${int(q.goal)} contactos hoy"><circle class="bg" cx="32" cy="32" r="${R}"/><circle class="fg" cx="32" cy="32" r="${R}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - ratio)}" transform="rotate(-90 32 32)"/></svg><div><div class="num" style="font-size:24px;font-weight:700">${int(q.doneToday)}<span class="sub"> / ${int(q.goal)}</span></div><div class="sub">contactos nuevos hoy</div></div></div></section>
      ${crumbs(id)}
      ${block('conversations', 'Conversaciones abiertas', 'Respondieron o están interesados: contestá primero.', q.conversations)}
      ${u.greetingFirst ? block('greeted', 'Esperan la demo', 'Los saludaste. Si te respondieron, mandales la demo.', q.greeted, { open: false }) : ''}
      ${block('followUps', 'Seguimientos de hoy', 'Les escribiste y no respondieron. Arriba, quienes abrieron o probaron su demo.', q.followUps)}
      ${block('fresh', 'Nuevos para hoy', `Por prioridad hasta la meta del día. Quedan ${int(q.freshTotal)} con canal.`, q.fresh)}`;
  }

  function stagePill(a, u) {
    const lvl = C.level(a);
    return `<span class="stage ${C.closed(a) ? 'closed' : ''}" style="--o:${0.35 + Math.max(0, lvl) * 0.13}">${esc(u.stageLabel(a.stage))}</span>`;
  }
  function signals(a) {
    return `${a.demoTried ? '<span class="signal">Probó la demo</span>' : a.demoOpened ? '<span class="signal">Abrió la demo</span>' : ''}`;
  }

  function accountRow(a, u, block) {
    const next = C.nextTemplate(a, u);
    const tpl = next && templatesOf(u.id)[next.key];
    let action = '';
    if (isReadOnly(u.id)) return accountRowHtml(a, u, `<a class="btn small" href="${esc(u.appUrl)}" target="_blank" rel="noopener">${icon.ext} Panel</a>`);
    if (block === 'conversations') action = a.phone ? `<button type="button" class="btn small" data-chat="${esc(a.id)}">${icon.wa} Abrir chat</button>` : '';
    else if (next && tpl && (next.channel === 'whatsapp' || next.channel === 'email' || next.channel === 'instagram')) {
      action = `<button type="button" class="btn small primary" data-send="${esc(a.id)}" data-key="${esc(next.key)}">${next.channel === 'email' ? icon.mail : next.channel === 'instagram' ? icon.ig : icon.wa} ${esc(tpl.title)}</button>`;
    }
    return accountRowHtml(a, u, action);
  }
  function accountRowHtml(a, u, action) {
    return `<div class="arow" data-open-account="${esc(a.id)}" tabindex="0" role="button" aria-label="Abrir la ficha de ${esc(a.name)}">
      <div class="who"><strong>${esc(a.name)}</strong><div class="meta">${a.org && a.org !== a.name ? `<span>${esc(a.org)}</span>·` : ''}<span>${esc(a.zone || 'Sin zona')}</span>${a.priority && a.priority <= 5 ? `<span>· P${a.priority}</span>` : ''}${stagePill(a, u)}${a.touches ? `<span>${int(a.touches)} msj.</span>` : ''}${a.lastContact ? `<span>últ. ${esc(when(a.lastContact))}</span>` : ''}${signals(a)}</div></div>
      <div class="acts">${action}</div></div>`;
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
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Cuentas</span><h1>${int(list.length)} ${esc(u.entity.many)}</h1><p>La base completa de la planilla. Los cambios se guardan en la misma fila.</p></div>
        ${state.data[id].sheet && state.data[id].sheet.url ? `<a class="btn" href="${esc(state.data[id].sheet.url)}" target="_blank" rel="noopener">${icon.ext} Abrir la planilla</a>` : ''}</section>
      ${sheetWarnings(id)}
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

  // ─── Mensajes ───────────────────────────────────────────────
  function templatesOf(id) {
    const u = unitOf(id);
    const custom = (state.data[id] && state.data[id].templates) || {};
    const out = {};
    for (const [k, t] of Object.entries(u.templates)) out[k] = { ...t, ...(custom[k] ? { text: custom[k].text, title: custom[k].title || t.title, subject: custom[k].subject || t.subject } : {}), custom: Boolean(custom[k]) };
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
      <section class="hero"><div><span class="eyebrow" style="color:${color(u)}">● ${esc(u.name)} · Mensajes</span><h1>Qué decimos y qué responde</h1><p>Las plantillas salen de la pestaña «Mensajes» de la planilla (si no está, se usan estas de fábrica). Editalas ahí: el cambio llega a todo el equipo.</p></div></section>
      <section class="card glass"><div class="card-head"><div><h2>Respuesta por plantilla</h2><p class="sub">Cada respuesta va al último mensaje enviado antes, dentro de ${u.window} días. Un envío cuenta en la tasa cuando pasó esa ventana o ya respondió. Sin ganadora automática: con menos de 30, es muestra chica.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Plantilla</th><th class="n">Enviados</th><th class="n">Maduros</th><th class="n">Respuestas</th><th>Tasa</th></tr></thead><tbody>
        ${stats.map((s) => `<tr><td><strong>${esc((tpls[s.template] && tpls[s.template].title) || s.template)}</strong></td><td class="n">${int(s.enviados)}</td><td class="n">${int(s.maduros)}</td><td class="n">${int(s.respuestas)}</td><td class="num"><span class="minibar" style="width:${Math.round((s.tasa || 0) * 120)}px;--accent:${color(u)}"></span> ${pct(s.tasa)} ${s.muestraChica ? '<span class="chip warn">Muestra chica</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Todavía no hay envíos registrados desde el panel.</td></tr>'}
        </tbody></table></div></section>
      <div class="grid cols-2">${Object.entries(tpls).filter(([, t]) => !t.builtin).map(([k, t]) => `<section class="card glass"><div class="card-head" style="margin-bottom:8px"><div><h3>${esc(t.title)}</h3><p class="sub">${esc(t.hint || '')}</p></div><span class="badge plain">${esc(t.channel || '')}${t.custom ? ' · planilla' : ''}</span></div>
        ${t.subject ? `<p class="sub"><strong>Asunto:</strong> ${esc(C.renderTemplate(t.subject, sample, u))}</p>` : ''}<pre class="tpl">${esc(C.renderTemplate(t.text, sample, u))}</pre></section>`).join('')}</div>`;
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
            ${a.phone && t.channel !== 'email' && t.channel !== 'llamada' ? `<button class="btn primary" type="button" data-send-drawer="whatsapp" data-autofocus>${icon.wa} Abrir WhatsApp</button>` : ''}
            ${a.email && (t.channel === 'email' || !a.phone) ? `<button class="btn primary" type="button" data-send-drawer="email">${icon.mail} Abrir mail</button>` : ''}
            ${a.instagram ? `<button class="btn" type="button" data-send-drawer="instagram">${icon.ig} Copiar y abrir Instagram</button>` : ''}
            <button class="btn" type="button" data-action="copy">${icon.copy} Copiar</button>
          </div>
          <p class="sub" style="margin:0">Abrir el chat no cuenta como contacto: después te preguntamos si salió.</p></div>` : ''}
        ${isReadOnly(state.unit) ? '' : `<div class="section"><h3>Qué pasó</h3>
          <div class="btns">
            ${a.phone ? `<button class="btn small" type="button" data-log="call">${icon.phone} Llamé</button>` : ''}
            <button class="btn small" type="button" data-log="visit">Lo visité</button>
            <button class="btn small" type="button" data-outcome="respondio">Respondió</button>
            <button class="btn small" type="button" data-outcome="interesado">Interesado</button>
            <button class="btn small" type="button" data-outcome="reunion">Reunión</button>
            <button class="btn small" type="button" data-outcome="cliente">Cliente</button>
            ${link && !u.api ? `<button class="btn small" type="button" data-demo="opened">Abrió la demo</button><button class="btn small" type="button" data-demo="tried">Probó la demo</button>` : ''}
          </div>
          <div class="btns">
            <button class="btn small ghost" type="button" data-outcome="perdido">${esc(u.stageLabel('perdido'))}</button>
            <button class="btn small ghost" type="button" data-outcome="invalido">${esc(u.stageLabel('invalido'))}</button>
            <button class="btn small ghost danger" type="button" data-outcome="baja">Pidió no recibir más</button>
            ${C.closed(a) ? '<button class="btn small ghost" type="button" data-action="reopen">Reabrir</button>' : ''}
          </div>
          <label class="field">Detalle o evidencia (qué dijo, por qué)<input data-detail placeholder="Opcional, pero ayuda a medir bien"></label>
          ${undo ? `<button class="btn small ghost" type="button" data-action="undo">↶ Deshacer: ${esc(undo.label)}</button>` : ''}
        </div>
        <div class="section"><h3>Agendar</h3>
          <div class="btns" style="align-items:flex-end"><label class="field" style="flex:1 1 140px">Fecha<input type="date" data-next-at value="${esc(C.dayOf(a.nextAt))}"></label><label class="field" style="flex:2 1 180px">Qué hacer<input data-next-step value="${esc(a.nextStep)}"></label><button class="btn small" type="button" data-action="schedule">Guardar</button></div>
        </div>`}
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

  function eventLabel(e, u) {
    const tpls = templatesOf(u.id);
    const labels = { saludo: 'Saludo enviado', mensaje: 'Mensaje enviado', llamada: 'Llamada', visita: 'Visita', respondio: 'Respondió', interesado: 'Interesado', reunion: 'Reunión', cliente: 'Cliente', perdido: u.stageLabel('perdido'), invalido: u.stageLabel('invalido'), baja: 'Pidió no recibir más', abrio_demo: 'Abrió la demo', probo_demo: 'Probó la demo', proximo: 'Agendado', nota: 'Nota', edicion: 'Datos editados', deshacer: 'Deshecho', reabrir: 'Reabierta' };
    const base = labels[e.type] || e.type;
    return e.template && tpls[e.template] ? `${base} (${tpls[e.template].title})` : base;
  }

  // ─── Acciones ───────────────────────────────────────────────
  async function act(id, action, { label, undoable } = {}) {
    const unitId = state.unit;
    const u = unitOf(unitId);
    const d = state.data[unitId];
    const a = findAccount(id, unitId);
    if (!a) return null;
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
  function startSend(id, channel, key, text) {
    const u = unitOf(state.unit);
    const a = findAccount(id);
    if (!a) return;
    const tpls = templatesOf(state.unit);
    const t = tpls[key] || {};
    const body = text != null ? text : C.renderTemplate(t.text, a, u);
    const next = C.nextTemplate(a, u);
    const kind = next && next.key === key ? next.kind : /saludo/.test(key) ? 'saludo' : 'mensaje';
    let url = '';
    if (channel === 'whatsapp') url = C.waLink(a.phone, body);
    else if (channel === 'email') url = `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(C.renderTemplate(t.subject || '', a, u))}&body=${encodeURIComponent(body)}`;
    else if (channel === 'instagram') {
      copy(body);
      const handle = String(a.instagram || '').replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, '').replace(/\/.*$/, '');
      url = `https://ig.me/m/${encodeURIComponent(handle)}`;
    }
    if (!url) { toast('Esta cuenta no tiene ese canal.', true); return; }
    window.open(url, '_blank', 'noopener');
    state.pending = { id, channel, key, kind, name: a.name };
    const c = $('#confirm');
    c.innerHTML = `<p>¿Salió el ${kind === 'saludo' ? 'saludo' : 'mensaje'} a <strong>${esc(a.name)}</strong>?</p><button class="btn primary" type="button" data-confirm="yes">Sí, se envió</button><button class="btn ghost" type="button" data-confirm="no">No salió</button>`;
    c.classList.add('on');
    window.LiquidGlass && window.LiquidGlass.refresh(c);
    setTimeout(() => { const b = c.querySelector('[data-confirm="yes"]'); if (b) b.focus(); }, 50);
  }
  async function confirmSend(yes) {
    const p = state.pending;
    state.pending = null;
    $('#confirm').classList.remove('on');
    if (!p || !yes) return;
    await act(p.id, { type: 'sent', channel: p.channel, template: p.key, kind: p.kind }, { label: `${p.kind === 'saludo' ? 'Saludo' : 'Mensaje'} a ${p.name} registrado`, undoable: true });
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

  // ─── Eventos ────────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-open-account], [data-goto], a');
    if (!t) return;
    const ds = t.dataset;
    if (ds.unit && t.closest('#units')) { go(ds.unit, state.view === 'resumen' ? 'hoy' : state.view); ensureLoaded(); return; }
    if (ds.view) { go(state.unit, ds.view); return; }
    if (ds.goto) { go(ds.goto, ds.viewTo || 'hoy'); return; }
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
    if (ds.moreBlock) { state.more[ds.moreBlock] = true; render(); return; }
    if (ds.stageFilter) { filt(state.unit).stage = ds.stageFilter; state.shown = 100; render(); return; }
    if (ds.send) { e.stopPropagation(); const a = findAccount(ds.send); const next = a && C.nextTemplate(a, unitOf(state.unit)); startSend(ds.send, next ? next.channel : 'whatsapp', ds.key); return; }
    if (ds.chat) { e.stopPropagation(); const a = findAccount(ds.chat); if (a) window.open(C.waLink(a.phone, ''), '_blank', 'noopener'); return; }
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
      if (ds.outcome === 'baja' && !confirm('¿Pidió no recibir más mensajes? No se le va a volver a escribir por ningún canal.')) return;
      await act(state.drawer, { type: 'outcome', outcome: ds.outcome, detail: detail() }, { label: `Marcado: ${u.stageLabel(ds.outcome)}`, undoable: true });
      return;
    }
    if (ds.demo) { await act(state.drawer, { type: 'demo', tried: ds.demo === 'tried' }, { label: ds.demo === 'tried' ? 'Probó la demo' : 'Abrió la demo', undoable: true }); return; }
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
      if (state.pending) { confirmSend(false); return; }
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
    if (e.target.matches('[data-tpl]')) { $('#drawer').dataset.key = e.target.value; renderDrawer(); }
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
    if (form.matches('[data-edit]')) {
      const fields = Object.fromEntries(new FormData(form).entries());
      await act(state.drawer, { type: 'edit', fields }, { label: 'Datos guardados' });
    }
    if (form.matches('[data-note]')) {
      const text = new FormData(form).get('note');
      if (String(text || '').trim()) await act(state.drawer, { type: 'note', text }, { label: 'Nota agregada' });
    }
  });

  $('#user').addEventListener('click', async () => {
    if (state.demo) { state.demo = false; state.data = {}; boot(); return; }
    if (!confirm('¿Cerrar la sesión?')) return;
    await api('logout', { method: 'POST', body: {} }).catch(() => {});
    state.session.user = null;
    state.data = {};
    render();
  });

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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.demo && state.session && state.session.user && !state.drawer && !state.pending) {
      Promise.all(units().map((u) => loadUnit(u.id, { quiet: true }))).then(render);
    }
  });

  boot();
})();
