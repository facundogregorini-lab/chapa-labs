(() => {
  'use strict';

  const DATA = window.CHAPA_DATA;
  const PROJECTS = DATA.projects;
  // Color de identidad de cada proyecto (orden fijo, no se recicla).
  const ACCENTS = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
  const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const $ = (sel) => document.querySelector(sel);
  const main = $('#main');
  const tip = $('#tip');

  const projectMonths = (p) => [
    ...(p.northStar.series || []).map((s) => s.month),
    ...(p.ads ? p.ads.daily.map((d) => d.date.slice(0, 7)) : []),
    ...(p.posthog ? (p.posthog.data.daily || []).map((d) => d.date.slice(0, 7)) : []),
  ];
  let allMonths = [...new Set(PROJECTS.flatMap(projectMonths))].sort();
  const state = { month: allMonths[allMonths.length - 1], view: 'resumen' };
  let charts = {};

  // ─── Formatos ─────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, max = 0, min = 0) => v.toLocaleString('es-AR', { maximumFractionDigits: max, minimumFractionDigits: min });
  const monthLabel = (m, long) => {
    const [y, mo] = m.split('-').map(Number);
    const name = MONTH_NAMES[mo - 1];
    return long ? `${name[0].toUpperCase()}${name.slice(1)} ${y}` : `${name.slice(0, 3)} ${String(y).slice(2)}`;
  };
  const SYMBOL = { USD: 'US$', ARS: '$' };
  const dayLabel = (d) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
  const dayTip = (d) => `${Number(d.slice(8))} de ${MONTH_NAMES[Number(d.slice(5, 7)) - 1]}`;
  const axisLabel = (p) => p.label || monthLabel(p.month);
  const tipLabel = (p) => p.tip || monthLabel(p.month, true);
  // Con muchos puntos (días) se muestran solo las etiquetas que entran en el ancho.
  const showTick = (i, n, fit) => {
    const every = Math.ceil(n / Math.max(2, fit));
    return every <= 1 || i === n - 1 || (i % every === 0 && n - 1 - i >= every / 2);
  };
  const badge = (block, real) => {
    if (block && block.noData) return '<span class="badge is-sample">Sin datos</span>';
    if (block && block.sample) return '<span class="badge is-sample">Ejemplo</span>';
    return real ? `<span class="badge is-real">● ${esc(real)}</span>` : '';
  };

  function fmt(v, format, currency = 'USD') {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    if (!Number.isFinite(v) && typeof v === 'number') return '—';
    switch (format) {
      case 'int': return num(Math.round(v));
      case 'dec': return num(v, 1);
      case 'pct': return `${num(v * 100, Math.abs(v) < 0.1 ? 1 : 0)}%`;
      case 'money': return `${SYMBOL[currency] || currency} ${num(Math.round(v))}`;
      case 'money2': return `${SYMBOL[currency] || currency} ${num(v, 2, 2)}`;
      case 'hours': return `${num(v, 1)} h`;
      case 'x': return `${num(v, 1, 1)}x`;
      case 'month': return monthLabel(v, true);
      case 'day': return dayTip(v);
      case 'delta': return `<span class="delta ${v > 0 ? 'good' : v < 0 ? 'bad' : 'flat'}">${v > 0 ? '+' : ''}${num(v * 100, 0)}%</span>`;
      case 'status': return statusBadge(v);
      case 'state': return v === 'ACTIVE' ? '<span class="state on">▶ Activa</span>' : '<span class="state">❚❚ Pausada</span>';
      default: return esc(v);
    }
  }
  const short = (v, format, currency) => {
    // Etiquetas de eje compactas: 1,2 k / 1,5 M
    const pre = format === 'money' || format === 'money2' ? `${SYMBOL[currency] || ''} ` : '';
    if (format === 'pct') return `${num(v * 100)}%`;
    if (Math.abs(v) >= 1e6) return `${pre}${num(v / 1e6, 1)} M`;
    if (Math.abs(v) >= 1e3) return `${pre}${num(v / 1e3, 1)} k`;
    return `${pre}${num(v, format === 'money2' ? 1 : 0)}`;
  };

  function statusBadge(s) {
    const map = { good: ['✓', 'Saludable'], warning: ['!', 'En riesgo'], critical: ['✕', 'Crítica'] };
    const [icon, label] = map[s] || ['', s];
    return `<span class="status ${esc(s)}"><i aria-hidden="true">${icon}</i>${label}</span>`;
  }

  // Variación vs período anterior. Para porcentajes muestra puntos porcentuales.
  function delta(curr, prev, { good = 'up', format, suffix = 'vs mes ant.' } = {}) {
    if (prev === undefined || prev === null || !Number.isFinite(curr) || !Number.isFinite(prev)) return '';
    const diff = curr - prev;
    let text;
    if (format === 'pct') {
      text = `${diff >= 0 ? '+' : ''}${num(diff * 100, Math.abs(diff) < 0.1 ? 1 : 0)} pp`;
    } else {
      if (prev === 0) return '';
      const rel = diff / Math.abs(prev);
      text = `${rel >= 0 ? '+' : ''}${num(rel * 100, 0)}%`;
    }
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '■';
    let cls = 'flat';
    if (diff !== 0 && good !== 'neutral') cls = (diff > 0) === (good === 'up') ? 'good' : 'bad';
    return `<span class="delta ${cls}">${arrow} ${text} <small>${suffix}</small></span>`;
  }

  const tile = ({ label, hint, value, prev, format, good, currency }) => `
    <div class="card tile">
      <p class="label">${esc(label)}</p>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
      <p class="value">${fmt(value, format, currency)}</p>
      ${delta(value, prev, { good, format })}
    </div>`;

  const ratio = (a, b) => (b ? a / b : NaN);

  // ─── Datos de PostHog ─────────────────────────────────────
  // Filas de una consulta de api/posthog.js. Con varias consultas diarias,
  // las une por fecha (lo que falta en un día cuenta como 0).
  function phRows(p, query) {
    const data = (p.posthog && p.posthog.data) || {};
    const names = [].concat(query);
    if (names.length === 1) return data[names[0]] || [];
    const byDate = new Map();
    names.flatMap((n) => data[n] || []).forEach((r) => byDate.set(r.date, { ...(byDate.get(r.date) || {}), ...r }));
    const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const keys = [...new Set(rows.flatMap(Object.keys))];
    return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? 0])));
  }
  const phSum = (p, query, key) => phRows(p, query).reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const phUpdated = (p) => (p.posthog.live ? 'en vivo' : `actualizado el ${dayTip(p.posthog.snapshotAt)}`);
  const phBadge = (p) => badge(null, `Datos reales · PostHog, ${phUpdated(p)}`);

  // ─── Días del mes elegido ─────────────────────────────────
  // Del 1 al último día del mes (o hasta hoy, si es el mes en curso). Todos los
  // proyectos usan los mismos días, así los gráficos se comparan.
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function monthDays() {
    const [y, m] = state.month.split('-').map(Number);
    const today = isoDay(new Date());
    const out = [];
    for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
      const key = isoDay(d);
      if (key > today) break;
      out.push(key);
    }
    return out;
  }
  // Valor por día de una columna; un día sin datos cuenta como 0.
  function dailyPoints(rows, key) {
    const byDate = new Map(rows.map((r) => [r.date, Number(r[key]) || 0]));
    return monthDays().map((date) => ({ date, label: dayLabel(date), tip: dayTip(date), value: byDate.get(date) || 0 }));
  }

  // ─── Datos por mes ────────────────────────────────────────
  const upTo = (rows) => rows.filter((r) => r.month <= state.month);
  const pick = (rows) => {
    const list = upTo(rows);
    return { curr: list[list.length - 1], prev: list[list.length - 2], list };
  };

  // ─── Gráficos (SVG a mano) ────────────────────────────────
  // ticks: líneas de grilla (4 en gráficos normales, 2 en los chicos).
  function niceScale(max, format, ticks = 4) {
    if (max <= 0) return format === 'pct' ? { top: 1, step: 1 / ticks } : { top: ticks, step: 1 };
    const raw = max / ticks;
    const p = 10 ** Math.floor(Math.log10(raw));
    const n = raw / p;
    let step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    if (format === 'int') step = Math.max(1, Math.round(step));
    return { top: Math.ceil(max / step) * step, step };
  }

  function frame(w, h, top, step, format, currency) {
    const pad = { l: 52, r: 14, t: 22, b: 26 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const y = (v) => pad.t + ih - (v / top) * ih;
    let grid = '';
    for (let v = 0; v <= top + step / 2; v += step) {
      grid += `<line class="${v === 0 ? 'base' : 'grid-line'}" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
      grid += `<text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${short(v, format, currency)}</text>`;
    }
    return { pad, iw, ih, y, grid };
  }

  function tipHtml(title, value, extra) {
    return esc(`<span>${title}</span><b>${value}</b>${extra ? `<span>${extra}</span>` : ''}`);
  }

  function lineChart({ points, format, currency, target, color, height = 220 }) {
    return (w) => {
      const h = height;
      const max = Math.max(...points.map((p) => p.value).filter(Number.isFinite), target || 0) * 1.08;
      const { top, step } = niceScale(max, format, h < 130 ? 2 : 4);
      const f = frame(w, h, top, step, format, currency);
      const n = points.length;
      const x = (i) => f.pad.l + (n === 1 ? f.iw / 2 : (i / (n - 1)) * f.iw);
      const valid = points.map((p, i) => ({ ...p, i })).filter((p) => Number.isFinite(p.value));
      const d = valid.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)},${f.y(p.value)}`).join('');
      let out = f.grid;
      if (target) {
        out += `<line class="target" x1="${f.pad.l}" x2="${w - f.pad.r}" y1="${f.y(target)}" y2="${f.y(target)}"/>`;
        out += `<text class="target-label" x="${f.pad.l + 4}" y="${f.y(target) - 6}">Meta ${fmt(target, format, currency)}</text>`;
      }
      out += `<path class="line" d="${d}" style="stroke:${color}"/>`;
      const colW = n > 1 ? f.iw / (n - 1) : f.iw;
      points.forEach((p, i) => {
        if (showTick(i, n, Math.floor(f.iw / 46))) out += `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${axisLabel(p)}</text>`;
        if (!Number.isFinite(p.value)) return;
        const prev = points[i - 1];
        const extra = prev && Number.isFinite(prev.value) ? delta(p.value, prev.value, { format }).replace(/<[^>]+>/g, '') : '';
        out += `<g class="hitg">
          <line class="cross" x1="${x(i)}" x2="${x(i)}" y1="${f.pad.t}" y2="${f.pad.t + f.ih}" opacity="0"/>
          <circle class="pt" cx="${x(i)}" cy="${f.y(p.value)}" r="4.5" style="fill:${color}"/>
          <rect class="hit" x="${x(i) - colW / 2}" y="0" width="${colW}" height="${h}" data-tip="${tipHtml(tipLabel(p), fmt(p.value, format, currency), extra)}"/>
        </g>`;
      });
      const last = valid[valid.length - 1];
      if (last) {
        // Si el último valor queda pegado a la meta, la etiqueta va debajo del punto.
        const nearTarget = target && Math.abs(f.y(last.value) - f.y(target)) < 18;
        out += `<text class="val" x="${x(last.i) - 8}" y="${f.y(last.value) + (nearTarget ? 20 : -10)}" text-anchor="end">${fmt(last.value, format, currency)}</text>`;
      }
      return `<svg viewBox="0 0 ${w} ${h}" height="${h}" role="img" aria-label="Evolución mensual">${out}</svg>`;
    };
  }

  function barChart({ points, format, currency, color, height = 220 }) {
    return (w) => {
      const h = height;
      const max = Math.max(...points.map((p) => p.value), 0) * 1.12;
      const { top, step } = niceScale(max, format, h < 130 ? 2 : 4);
      const f = frame(w, h, top, step, format, currency);
      const n = points.length;
      const band = f.iw / n;
      const bw = Math.min(44, band * 0.62);
      let out = f.grid;
      points.forEach((p, i) => {
        const cx = f.pad.l + band * i + band / 2;
        const y0 = f.y(0);
        const y1 = f.y(Math.max(p.value, 0));
        const r = Math.min(4, (y0 - y1) / 2, bw / 2);
        const x0 = cx - bw / 2;
        const d = `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + bw - r}Q${x0 + bw},${y1} ${x0 + bw},${y1 + r}V${y0}Z`;
        const prev = points[i - 1];
        const extra = prev ? delta(p.value, prev.value, { format }).replace(/<[^>]+>/g, '') : '';
        out += `<path class="bar" d="${d}" style="fill:${color}"/>`;
        out += `<rect class="hit" x="${cx - band / 2}" y="0" width="${band}" height="${h}" data-tip="${tipHtml(tipLabel(p), fmt(p.value, format, currency), extra)}"/>`;
        if (showTick(i, n, Math.floor(f.iw / 46))) out += `<text x="${cx}" y="${h - 6}" text-anchor="middle">${axisLabel(p)}</text>`;
        if (i === n - 1) out += `<text class="val" x="${cx}" y="${y1 - 7}" text-anchor="middle">${fmt(p.value, format, currency)}</text>`;
      });
      return `<svg viewBox="0 0 ${w} ${h}" height="${h}" role="img" aria-label="Evolución mensual">${out}</svg>`;
    };
  }

  let chartSeq = 0;
  function chart(render) {
    const id = `c${++chartSeq}`;
    charts[id] = render;
    return `<div class="chart" data-chart="${id}"></div>`;
  }
  function drawCharts() {
    document.querySelectorAll('[data-chart]').forEach((el) => {
      const render = charts[el.dataset.chart];
      const w = Math.max(240, Math.floor(el.clientWidth));
      if (render && el.dataset.w !== String(w)) {
        el.innerHTML = render(w);
        el.dataset.w = w;
      }
    });
  }

  // ─── Tablas ───────────────────────────────────────────────
  function table({ columns, rows, total, currentKey, heat, currency }) {
    const heatMax = heat
      ? Math.max(...rows.flatMap((r) => columns.filter((c) => c.heat).map((c) => r[c.key])).filter(Number.isFinite))
      : 1;
    const cell = (c, r) => {
      const v = r[c.key];
      if (c.heat && Number.isFinite(v)) {
        const pct = Math.round(8 + (v / heatMax) * 82);
        const ink = pct > 62 ? '#ffffff' : 'var(--ink)';
        return `<td class="heat" style="background:color-mix(in oklab, var(--seq) ${pct}%, var(--surface));color:${ink}">${fmt(v, c.format, currency)}</td>`;
      }
      if (c.heat) return '<td class="heat"></td>';
      return `<td>${fmt(v, c.format, currency)}</td>`;
    };
    const body = rows.map((r) => `<tr class="${currentKey && r.month === currentKey ? 'current' : ''}">${columns.map((c) => cell(c, r)).join('')}</tr>`).join('');
    const foot = total ? `<tr class="total">${columns.map((c) => `<td>${fmt(total[c.key], c.format, currency)}</td>`).join('')}</tr>` : '';
    return `<div class="table-wrap"><table>
      <thead><tr>${columns.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${body}${foot}</tbody></table></div>`;
  }

  // ─── Cálculos de adquisición ──────────────────────────────
  function paidRow(r) {
    return {
      ...r,
      cpl: ratio(r.inversion, r.registros),
      conv: ratio(r.pagos, r.registros),
      cpa: ratio(r.inversion, r.pagos),
      roi: ratio(r.ingresos - r.inversion, r.inversion),
      roas: ratio(r.ingresos, r.inversion),
    };
  }
  const sumRows = (rows, keys) => Object.fromEntries(keys.map((k) => [k, rows.reduce((a, r) => a + (r[k] || 0), 0)]));

  // ─── Vistas ───────────────────────────────────────────────
  function nsmFigures(p) {
    const ns = p.northStar;
    if (ns.posthog) {
      // Valor de los últimos 7 días; la comparación se muestra cuando la
      // semana anterior tiene datos suficientes.
      const src = ns.posthog;
      const head = phRows(p, src.query)[0] || {};
      const value = Number(head[src.value]) || 0;
      const prevValue = Number(head[src.prev]) || 0;
      return {
        ns, value,
        list: dailyPoints(phRows(p, src.daily), src.dailyKey),
        prev: prevValue >= 10 ? { value: prevValue } : null,
        suffix: 'vs 7 días ant.',
        period: prevValue >= 10 ? 'Últimos 7 días' : 'Últimos 7 días · sin semana anterior para comparar',
        badge: phBadge(p),
      };
    }
    // Sin fuente conectada: todo en 0, nada inventado.
    return {
      ns, value: 0, prev: null, list: dailyPoints([], 'value'),
      suffix: '', period: 'Últimos 7 días · sin fuente conectada', badge: badge(ns),
    };
  }

  function renderSummary() {
    const head = (p, i) => `
          <div class="proj-top">
            <span class="proj-name"><span class="dot" style="background:${ACCENTS[i]}"></span>${esc(p.name)}</span>
            <span class="chip">${esc(p.stage)}</span>
          </div>`;

    const nsmCards = PROJECTS.map((p, i) => {
      const f = nsmFigures(p);
      const { ns, prev, list, value } = f;
      return `
        <a class="card proj" href="#${esc(p.id)}">
          ${head(p, i)}
          <div>
            <p class="nsm-label">${esc(ns.name)} ${ns.noData ? badge(ns) : badge(null, 'Real')}</p>
            <p class="hero">${fmt(value, ns.format)}</p>
            ${delta(value, prev && prev.value, { format: ns.format, suffix: f.suffix })}
            <p class="period">${f.period}</p>
          </div>
          ${chart(lineChart({ points: list, format: ns.format, color: ACCENTS[i], height: 120 }))}
        </a>`;
    }).join('');

    const revCards = PROJECTS.map((p, i) => {
      const r = p.revenue || {};
      const rev = revenueSummary(p);
      const block = (title, total, key, format) => `
          <div class="proj-rev">
            <div class="proj-rev-head"><span>${esc(title)}</span><strong>${fmt(total, format, rev.cur)}</strong></div>
            ${chart(barChart({ points: rev.rows.map((d) => ({ label: dayLabel(d.date), tip: dayTip(d.date), value: d[key] })), format, currency: rev.cur, color: ACCENTS[i], height: 90 }))}
          </div>`;
      return `
        <a class="card proj" href="#${esc(p.id)}">
          ${head(p, i)}
          <p class="nsm-label">${monthLabel(state.month, true)} ${r.noData ? badge(r) : badge(null, 'Real')}</p>
          ${block(r.subsLabel || 'Nuevos suscriptores', rev.subs, 'subs', 'int')}
          ${block('Ingresos', rev.rev, 'rev', 'money')}
        </a>`;
    }).join('');

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Portafolio</h1>
          <p>${monthLabel(state.month, true)} · North Star, suscriptores e ingresos de cada proyecto</p>
        </div>
      </div>
      <h2 class="section">North Star Metric <span>· últimos 7 días y evolución por día</span></h2>
      <div class="grid g-3">${nsmCards}</div>
      <section class="summary-block" aria-labelledby="ingresos">
        <h2 class="section" id="ingresos">Suscriptores e ingresos <span>· ${monthLabel(state.month, true)}, por día</span></h2>
        <div class="grid g-3">${revCards}</div>
      </section>`;
  }

  function renderPaid(p, color) {
    const a = p.acquisition;
    const cur = p.currency;
    const { curr, prev, list } = pick(a.months);
    if (!curr) return '<p class="note">Sin datos para este mes.</p>';
    const c = paidRow(curr);
    const pv = prev ? paidRow(prev) : {};
    const rows = list.map(paidRow);

    const tiles = [
      { label: 'Inversión', value: c.inversion, prev: pv.inversion, format: 'money', good: 'neutral' },
      { label: 'Registros nuevos', value: c.registros, prev: pv.registros, format: 'int' },
      { label: 'Costo por registro (CPL)', value: c.cpl, prev: pv.cpl, format: 'money2', good: 'down' },
      { label: 'Nuevos pagos', value: c.pagos, prev: pv.pagos, format: 'int' },
      { label: 'Conversión registro → pago', value: c.conv, prev: pv.conv, format: 'pct' },
      { label: 'Costo por adquisición (CPA)', value: c.cpa, prev: pv.cpa, format: 'money2', good: 'down' },
      { label: 'Ingresos atribuidos', value: c.ingresos, prev: pv.ingresos, format: 'money' },
      { label: 'ROI', hint: '(Ingresos − inversión) / inversión', value: c.roi, prev: pv.roi, format: 'pct' },
    ].map((t) => tile({ ...t, currency: cur })).join('');

    const monthCols = [
      { key: 'month', label: 'Mes', format: 'month' },
      { key: 'inversion', label: 'Inversión', format: 'money' },
      { key: 'registros', label: 'Registros', format: 'int' },
      { key: 'cpl', label: 'CPL', format: 'money2' },
      { key: 'pagos', label: 'Pagos', format: 'int' },
      { key: 'conv', label: 'Conv.', format: 'pct' },
      { key: 'cpa', label: 'CPA', format: 'money2' },
      { key: 'ingresos', label: 'Ingresos', format: 'money' },
      { key: 'roi', label: 'ROI', format: 'pct' },
      { key: 'roas', label: 'ROAS', format: 'x' },
    ];

    const channelMonth = a.months[a.months.length - 1].month;
    const chRows = (a.channels || []).map(paidRow);
    const chTotal = paidRow({ canal: 'Total', ...sumRows(chRows, ['inversion', 'registros', 'pagos', 'ingresos']) });
    chRows.forEach((r) => { r.share = ratio(r.inversion, chTotal.inversion); });
    chTotal.share = 1;
    const chCols = [
      { key: 'canal', label: 'Canal' },
      { key: 'inversion', label: 'Inversión', format: 'money' },
      { key: 'share', label: '% inv.', format: 'pct' },
      { key: 'registros', label: 'Registros', format: 'int' },
      { key: 'cpl', label: 'CPL', format: 'money2' },
      { key: 'pagos', label: 'Pagos', format: 'int' },
      { key: 'cpa', label: 'CPA', format: 'money2' },
      { key: 'ingresos', label: 'Ingresos', format: 'money' },
      { key: 'roi', label: 'ROI', format: 'pct' },
    ];

    return `
      <div class="tiles">${tiles}</div>
      <div class="grid g-3" style="margin-top:12px">
        <div class="card"><h3>Inversión mensual</h3><p class="sub">En ${esc(cur)}</p>${chart(barChart({ points: rows.map((r) => ({ month: r.month, value: r.inversion })), format: 'money', currency: cur, color }))}</div>
        <div class="card"><h3>Costo por adquisición (CPA)</h3><p class="sub">Inversión / nuevos pagos · más bajo es mejor</p>${chart(lineChart({ points: rows.map((r) => ({ month: r.month, value: r.cpa })), format: 'money2', currency: cur, color }))}</div>
        <div class="card"><h3>ROI</h3><p class="sub">Retorno sobre la inversión en pauta</p>${chart(lineChart({ points: rows.map((r) => ({ month: r.month, value: r.roi })), format: 'pct', color }))}</div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Evolución mensual</h3><p class="sub">Inversión, registros y conversión a pago</p>
        ${table({ columns: monthCols, rows, currentKey: state.month, currency: cur })}
      </div>
      ${chRows.length ? `
      <div class="card" style="margin-top:12px">
        <h3>Por canal</h3><p class="sub">${monthLabel(channelMonth, true)}</p>
        ${table({ columns: chCols, rows: chRows, total: chTotal, currency: cur })}
      </div>` : ''}`;
  }

  // Barras de embudo. relative: 'prev' compara cada etapa con la anterior;
  // 'first' la compara con la primera (para recorridos que no son en orden).
  function funnelHtml(steps, row, color, { relative = 'prev', baseLabel = 'del total' } = {}) {
    const top = Math.max(1, ...steps.map((s) => Number(row[s.key]) || 0));
    const firstV = Number(row[steps[0].key]) || 0;
    return steps.map((s, i) => {
      const v = Number(row[s.key]) || 0;
      const base = relative === 'prev' && i ? Number(row[steps[i - 1].key]) || 0 : firstV;
      const conv = i ? ratio(v, base) : null;
      const convText = relative === 'prev' ? 'pasa a la siguiente etapa' : baseLabel;
      return `${conv !== null ? `<div class="f-row"><span></span><span class="f-conv">↓ ${fmt(conv, 'pct')} ${esc(convText)}</span></div>` : ''}
        <div class="f-row">
          <span class="f-label">${esc(s.label)}</span>
          <span class="f-track"><span class="f-bar" style="display:block;width:${(v / top) * 100}%;background:${color}" data-tip="${tipHtml(s.label, fmt(v, 'int'), i ? `${fmt(ratio(v, firstV), 'pct')} ${baseLabel}` : '')}"></span></span>
          <span class="f-num">${fmt(v, 'int')}</span>
        </div>`;
    }).join('');
  }

  // ─── Embudo real por canal (PostHog + inversión de Meta) ──
  function funnelFigures(p) {
    const a = p.acquisition;
    const rows = phRows(p, a.query);
    const paid = rows.find((r) => r.canal === a.paidChannel) || {};
    const spend = p.ads ? adsTotals(p.ads.daily).spend : NaN;
    const signups = Number(paid[a.signupKey]) || 0;
    const buyers = Number(paid[a.buyerKey]) || 0;
    const revenue = Number(paid[a.revenueKey]) || 0;
    const allBuyers = rows.reduce((n, r) => n + (Number(r[a.buyerKey]) || 0), 0);
    return {
      rows, paid, spend, signups, buyers, revenue, allBuyers,
      buyerLabel: a.buyerLabel || 'Compras',
      cpaAll: ratio(spend, allBuyers),
      cur: p.ads ? p.ads.currency : p.currency,
      cpl: ratio(spend, signups),
      cpa: ratio(spend, buyers),
      roi: ratio(revenue - spend, spend),
    };
  }

  function renderFunnelAcq(p, color) {
    const a = p.acquisition;
    const f = funnelFigures(p);
    const paidName = a.channels[a.paidChannel] || a.paidChannel;
    const tiles = [
      { label: `Inversión en ${paidName}`, value: f.spend, format: 'money' },
      { label: `Visitantes desde ${paidName}`, value: Number(f.paid.visitantes) || 0, format: 'int' },
      { label: 'Registros', hint: `Desde ${paidName}`, value: f.signups, format: 'int' },
      { label: 'Costo por registro', value: f.cpl, format: 'money' },
      { label: f.buyerLabel, hint: `Desde ${paidName}`, value: f.buyers, format: 'int' },
      { label: 'CPA', hint: `Inversión / ${f.buyerLabel.toLowerCase()} desde ${paidName}`, value: f.cpa, format: 'money' },
      { label: 'Ingresos', hint: `Desde ${paidName}`, value: f.revenue, format: 'money' },
      { label: 'ROI', hint: '(Ingresos − inversión) / inversión', value: f.roi, format: 'pct' },
    ].map((t) => tile({ ...t, currency: f.cur })).join('');

    const keys = [...a.steps.map((s) => s.key), a.revenueKey];
    const order = Object.keys(a.channels);
    const rows = f.rows.slice().sort((x, y) => order.indexOf(x.canal) - order.indexOf(y.canal))
      .map((r) => ({ ...r, nombre: a.channels[r.canal] || r.canal }));
    const total = { nombre: 'Total', ...sumRows(rows, keys) };
    const first = a.steps[0].key;
    const last = a.steps[a.steps.length - 1].key;
    [...rows, total].forEach((r) => { r.conv = ratio(r[last], r[first]); });
    const cols = [
      { key: 'nombre', label: 'Canal' },
      ...a.steps.map((s) => ({ key: s.key, label: s.label, format: 'int' })),
      { key: 'conv', label: 'Conv. total', format: 'pct' },
      { key: a.revenueKey, label: 'Ingresos', format: 'money' },
    ];
    const since = (phRows(p, 'daily')[0] || {}).date;

    return `
      <div class="tiles">${tiles}</div>
      <div class="grid g-2" style="margin-top:12px">
        <div class="card"><h3>Embudo de ${esc(paidName)}</h3><p class="sub">Personas que llegaron por ${esc(paidName)} · conversión entre etapas</p><div class="funnel">${funnelHtml(a.steps, f.paid, color)}</div></div>
        <div class="card"><h3>Embudo total</h3><p class="sub">Todas las fuentes</p><div class="funnel">${funnelHtml(a.steps, total, color)}</div></div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Por canal</h3><p class="sub">${since ? `Desde el ${dayTip(since)}` : ''} · canal según la UTM de la primera visita</p>
        ${table({ columns: cols, rows, total, currency: f.cur })}
      </div>`;
  }

  function renderOutbound(p, color) {
    const a = p.acquisition;
    const stages = a.stages;
    // Sin datos: el mes elegido con todas las etapas en 0.
    const picked = pick(a.months);
    const zero = { month: state.month, ...Object.fromEntries(stages.map((s) => [s.key, 0])) };
    const curr = picked.curr || zero;
    const prev = picked.prev;
    const list = picked.list.length ? picked.list : [zero];
    const first = stages[0].key;
    const last = stages[stages.length - 1].key;
    const pv = prev || {};

    const tiles = stages.map((s) => tile({ label: s.label, value: curr[s.key], prev: pv[s.key], format: 'int' }));
    tiles.push(tile({ label: 'Conversión total', hint: `${stages[0].label} → ${stages[stages.length - 1].label}`, value: ratio(curr[last], curr[first]), prev: prev && ratio(pv[last], pv[first]), format: 'pct' }));
    if (curr.mrrNuevo !== undefined) tiles.push(tile({ label: 'MRR nuevo', value: curr.mrrNuevo, prev: pv.mrrNuevo, format: 'money', currency: p.currency }));

    const funnel = funnelHtml(stages, curr, color);

    const monthCols = [
      { key: 'month', label: 'Mes', format: 'month' },
      ...stages.map((s) => ({ key: s.key, label: s.label, format: 'int' })),
      { key: 'convTotal', label: 'Conv. total', format: 'pct' },
      ...(list.some((r) => r.mrrNuevo !== undefined) ? [{ key: 'mrrNuevo', label: 'MRR nuevo', format: 'money' }] : []),
    ];
    const rows = list.map((r) => ({ ...r, convTotal: ratio(r[last], r[first]) }));

    const chRows = (a.channels || []).map((r) => ({ ...r }));
    const chTotal = { canal: 'Total', ...sumRows(chRows, stages.map((s) => s.key)) };
    [...chRows, chTotal].forEach((r) => {
      r.interes = ratio(r.interesados, r.contactados);
      r.convTotal = ratio(r[last], r[first]);
    });
    const chCols = [
      { key: 'canal', label: 'Canal' },
      ...stages.map((s) => ({ key: s.key, label: s.label, format: 'int' })),
      ...(stages.some((s) => s.key === 'interesados') ? [{ key: 'interes', label: 'Tasa de interés', format: 'pct' }] : []),
      { key: 'convTotal', label: 'Conv. total', format: 'pct' },
    ];
    const channelMonth = a.months.length ? a.months[a.months.length - 1].month : state.month;

    return `
      <div class="tiles">${tiles.join('')}</div>
      <div class="grid g-2" style="margin-top:12px">
        <div class="card"><h3>Embudo comercial</h3><p class="sub">${monthLabel(curr.month, true)} · conversión entre etapas</p><div class="funnel">${funnel}</div></div>
        <div class="card"><h3>Cierres por mes</h3><p class="sub">${esc(stages[stages.length - 1].label)}</p>${chart(barChart({ points: rows.map((r) => ({ month: r.month, value: r[last] })), format: 'int', color, height: 260 }))}</div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Evolución mensual del embudo</h3><p class="sub">Volumen por etapa</p>
        ${table({ columns: monthCols, rows, currentKey: state.month, currency: p.currency })}
      </div>
      ${chRows.length ? `
      <div class="card" style="margin-top:12px">
        <h3>Por canal</h3><p class="sub">${monthLabel(channelMonth, true)}</p>
        ${table({ columns: chCols, rows: chRows, total: chTotal })}
      </div>` : ''}`;
  }

  // ─── Prospección outbound (planilla) ──────────────────────
  // Filas de data.js ([prioridad, nombre, sdr, estado, fecha, canal, score]) o
  // de /api/prospectos (objetos con esas claves).
  const prospectRows = (a) => a.rows.map((r) => (Array.isArray(r)
    ? { p: r[0], n: r[1], sdr: r[2], estado: r[3], fecha: r[4], canal: r[5], score: r[6] }
    : r));
  const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Etapa a la que llegó cada fila (0 prospectado … 3 suscriptor), según la
  // columna Estado. Sin estado de avance, la fecha de envío la cuenta como contactada.
  function stageOf(r) {
    const e = plain(r.estado);
    if (/no interes|descart|rechaz|perdid/.test(e)) return 1;
    if (/suscri|client|pago|pagó|compr|cerrad|ganad/.test(e)) return 3;
    if (/interes|demo|prueba|reunion|propuesta/.test(e)) return 2;
    if (r.fecha || /envia|contact|respond|incorrect|seguim/.test(e)) return 1;
    return 0;
  }

  function prospectFigures(p) {
    const a = p.acquisition;
    const rows = prospectRows(a).map((r) => ({ ...r, stage: stageOf(r) }));
    const count = (list) => Object.fromEntries(a.stages.map((s, i) => [s.key, list.filter((r) => r.stage >= i).length]));
    const totals = count(rows);
    const group = (key, order) => {
      const names = [...new Set(rows.map((r) => r[key] || 'Sin asignar'))]
        .sort((x, y) => (order ? order.indexOf(x) - order.indexOf(y) : x.localeCompare(y)));
      return names.map((name) => ({ nombre: name, ...count(rows.filter((r) => (r[key] || 'Sin asignar') === name)) }));
    };
    const days = [...new Set(rows.map((r) => r.fecha).filter(Boolean))].sort();
    return {
      rows, totals,
      bySdr: group('sdr'),
      byChannel: group('canal').filter((g) => g.nombre !== 'Sin asignar'),
      byDay: days.map((d) => ({ label: dayLabel(d), tip: dayTip(d), value: rows.filter((r) => r.fecha === d).length })),
    };
  }

  // ─── Etapas editadas a mano ───────────────────────────────
  // Cada etapa sale de la planilla, pero se puede pisar a mano desde el
  // tablero. Se recuerda en este navegador hasta volver a la planilla.
  const stageStore = (p) => `chapa-etapas-${p.id}`;
  function stageEdits(p) {
    try { return JSON.parse(localStorage.getItem(stageStore(p)) || '{}'); } catch (e) { return {}; }
  }
  function saveStageEdits(p, edits) {
    try {
      if (Object.keys(edits).length) localStorage.setItem(stageStore(p), JSON.stringify(edits));
      else localStorage.removeItem(stageStore(p));
    } catch (e) { /* sin storage */ }
  }
  // Totales por etapa: los de la planilla, con lo editado a mano encima.
  function stageTotals(p, f) {
    const edits = stageEdits(p);
    const totals = { ...f.totals };
    Object.entries(edits).forEach(([k, v]) => { if (k in totals && Number.isFinite(v)) totals[k] = v; });
    return { totals, edited: edits };
  }

  // ─── Ventas proyectadas ───────────────────────────────────
  // Cada conversión es la real (de las etapas) o una estimada; se elige en el
  // tablero y se recuerda en este navegador.
  const projStore = (p) => `chapa-proyeccion-${p.id}`;
  function projSettings(p) {
    const def = p.acquisition.projection;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(projStore(p)) || '{}'); } catch (e) { /* sin storage */ }
    return {
      ticket: Number.isFinite(saved.ticket) ? saved.ticket : def.ticket,
      base: Number.isFinite(saved.base) ? saved.base : null,
      rates: def.rates.map((r, i) => ({ ...r, ...((saved.rates || [])[i] || {}) })),
    };
  }
  function saveProjSettings(p, s) {
    try { localStorage.setItem(projStore(p), JSON.stringify(s)); } catch (e) { /* sin storage */ }
  }

  function projection(p, totals, s) {
    const st = p.acquisition.stages;
    const rates = s.rates.map((r, i) => {
      const from = totals[st[i].key];
      const to = totals[st[i + 1].key];
      const real = ratio(to, from);
      // Sin datos en la etapa de origen no hay conversión real: se usa la estimada.
      const useReal = r.mode === 'real' && from > 0;
      return { from: st[i], to: st[i + 1], fromN: from, toN: to, real, mode: r.mode, estimate: r.estimate, value: useReal ? real : r.estimate, fallback: r.mode === 'real' && !useReal };
    });
    const fromContacted = (contacted) => {
      const interested = contacted * rates[1].value;
      const subs = interested * rates[2].value;
      return { contacted, interested, subs, sales: subs * s.ticket };
    };
    const current = totals[st[0].key];
    const base = s.base ?? current;
    return {
      rates, base, current,
      perContact: rates[1].value * rates[2].value * s.ticket,
      // Proyección sobre la base total de prospectados.
      total: { prospects: base, ...fromContacted(base * rates[0].value) },
      // Lo que ya está en marcha: los contactados de hoy.
      now: { prospects: current, ...fromContacted(totals[st[1].key]) },
    };
  }

  function projectionResults(p, totals, s) {
    const cur = p.acquisition.projection.currency;
    const st = p.acquisition.stages;
    const pr = projection(p, totals, s);
    const rateText = (r) => `${fmt(r.value, 'pct')} ${r.mode === 'real' && !r.fallback ? 'real' : 'estimada'}`;
    const t = pr.total;
    const steps = [
      { label: st[0].label, value: t.prospects, format: 'int' },
      { label: st[1].label, value: t.contacted, format: 'int', rate: pr.rates[0] },
      { label: st[2].label, value: t.interested, format: 'dec', rate: pr.rates[1] },
      { label: st[3].label, value: t.subs, format: 'dec', rate: pr.rates[2] },
    ];
    const top = Math.max(1, t.prospects);
    const flow = steps.map((x) => `
      ${x.rate ? `<div class="flow-rate">↓ ${rateText(x.rate)}</div>` : ''}
      <div class="flow-step">
        <span class="flow-label">${esc(x.label)}</span>
        <span class="flow-track"><span class="flow-bar" style="width:${Math.max(1.5, (x.value / top) * 100)}%"></span></span>
        <strong class="flow-num">${fmt(x.value, x.format)}</strong>
      </div>`).join('');
    const scenario = (title, hint, r, main) => `
      <div class="card scenario${main ? ' is-main' : ''}">
        <p class="label">${esc(title)}</p>
        <p class="hint">${esc(hint)}</p>
        <p class="scenario-value">${fmt(r.sales, 'money', cur)}<small> por mes</small></p>
        <p class="scenario-detail">${fmt(r.contacted, 'int')} contactados · ${fmt(r.interested, 'dec')} interesados · ${fmt(r.subs, 'dec')} suscriptores</p>
      </div>`;
    return `
      <div class="card proj-hero">
        <div class="proj-hero-head">
          <div>
            <p class="label">Ingresos proyectados por mes</p>
            <p class="proj-hero-value">${fmt(t.sales, 'money', cur)}</p>
            <p class="hint">Sobre una base de ${fmt(t.prospects, 'int')} prospectados · ticket ${fmt(s.ticket, 'money', cur)} · ${fmt(pr.perContact, 'money', cur)} por cada contactado</p>
          </div>
          <div class="proj-hero-subs"><strong>${fmt(t.subs, 'dec')}</strong><span>suscriptores</span></div>
        </div>
        <div class="flow">${flow}</div>
      </div>
      <div class="grid g-2" style="margin-top:12px">
        ${scenario('Con los contactados de hoy', 'Lo que ya está en marcha, sin escribirle a nadie más', pr.now)}
        ${scenario(`Con toda la base (${fmt(t.prospects, 'int')} prospectados)`, 'Si se contacta la base que elegiste arriba', t, true)}
      </div>
      <p class="note">Ingresos = suscriptores × ticket medio. Con una conversión en "Real" se usa la de las etapas (de la planilla o editadas a mano); si la etapa de origen está en 0, se usa la estimada.</p>`;
  }

  function renderProjection(p, totals) {
    const a = p.acquisition;
    const cur = a.projection.currency;
    const s = projSettings(p);
    const pr = projection(p, totals, s);
    const rateCtrl = pr.rates.map((r, i) => `
      <div class="ctrl">
        <span class="ctrl-label">${esc(r.from.label)} → ${esc(r.to.label)}</span>
        <select data-proj="mode" data-i="${i}" aria-label="Conversión ${esc(r.from.label)} a ${esc(r.to.label)}">
          <option value="real"${r.mode === 'real' ? ' selected' : ''}>Real</option>
          <option value="estimate"${r.mode === 'estimate' ? ' selected' : ''}>Estimada</option>
        </select>
        <label class="pct-input${r.mode === 'real' && !r.fallback ? ' is-off' : ''}">
          <input type="number" inputmode="decimal" min="0" max="100" step="0.5" value="${Math.round(r.estimate * 1000) / 10}" data-proj="estimate" data-i="${i}" aria-label="Conversión estimada en %">
          <span>%</span>
        </label>
        <span class="ctrl-real">Real: ${r.fromN ? `${fmt(r.real, 'pct')} (${fmt(r.toN, 'int')} de ${fmt(r.fromN, 'int')})` : 'sin datos'}${r.fallback ? ' · se usa la estimada' : ''}</span>
      </div>`).join('');
    return `
      <div class="proj-layout">
        <div class="card proj-controls">
          <h3>Variables</h3>
          <p class="sub">Se recuerdan en este navegador.</p>
          <div class="ctrl">
            <span class="ctrl-label"><strong>Prospectados totales</strong></span>
            <label class="num-input"><input type="number" inputmode="numeric" min="0" step="10" value="${pr.base}" data-proj="base" aria-label="Prospectados totales de la proyección"></label>
            <span class="ctrl-real">Hoy: ${fmt(pr.current, 'int')}</span>
          </div>
          ${rateCtrl}
          <div class="ctrl">
            <span class="ctrl-label">Ticket medio por mes</span>
            <label class="num-input"><span>${esc(SYMBOL[cur] || cur)}</span><input type="number" inputmode="numeric" min="0" step="100" value="${s.ticket}" data-proj="ticket" aria-label="Ticket medio"></label>
            <span class="ctrl-real">${esc(a.projection.ticketNote || '')}</span>
          </div>
          <button type="button" class="link-btn" data-proj="reset">Volver a los valores iniciales</button>
        </div>
        <div id="proj-out">${projectionResults(p, totals, s)}</div>
      </div>`;
  }

  // Cambios en las variables: recalcula solo los resultados (sin perder el foco).
  function onProjectionInput(e) {
    const el = e.target.closest('[data-proj]');
    const p = PROJECTS.find((x) => x.id === state.view);
    if (!el || !p || p.acquisition.type !== 'prospects') return;
    const s = projSettings(p);
    const k = el.dataset.proj;
    const i = Number(el.dataset.i);
    const n = Number(el.value);
    if ((e.type === 'click') !== (k === 'reset')) return;
    if (k === 'reset') {
      try { localStorage.removeItem(projStore(p)); } catch (err) { /* sin storage */ }
      render();
      return;
    }
    if (k === 'mode') s.rates[i].mode = el.value;
    else if (k === 'estimate' && el.value !== '' && Number.isFinite(n)) s.rates[i].estimate = Math.min(100, Math.max(0, n)) / 100;
    else if (k === 'ticket' && el.value !== '' && Number.isFinite(n)) s.ticket = Math.max(0, n);
    else if (k === 'base' && el.value !== '' && Number.isFinite(n)) s.base = Math.max(0, Math.round(n));
    else return;
    saveProjSettings(p, { ticket: s.ticket, base: s.base, rates: s.rates.map((r) => ({ mode: r.mode, estimate: r.estimate })) });
    const { totals } = stageTotals(p, prospectFigures(p));
    if (k === 'mode') {
      // El campo de % se atenúa cuando la conversión real está en uso.
      const r = projection(p, totals, s).rates[i];
      const box = el.parentElement.querySelector('.pct-input');
      if (box) box.classList.toggle('is-off', r.mode === 'real' && !r.fallback);
    }
    const out = $('#proj-out');
    if (out) out.innerHTML = projectionResults(p, totals, s);
  }

  // Etapas editadas a mano: al confirmar un valor se recalcula todo.
  function onStageEdit(e) {
    const el = e.target.closest('[data-stage]');
    const p = PROJECTS.find((x) => x.id === state.view);
    if (!el || !p || p.acquisition.type !== 'prospects') return;
    const edits = stageEdits(p);
    if (el.dataset.stage === 'reset') {
      if (e.type !== 'click') return;
      saveStageEdits(p, {});
    } else {
      if (e.type !== 'change') return;
      const n = Number(el.value);
      if (el.value === '' || !Number.isFinite(n)) delete edits[el.dataset.stage];
      else edits[el.dataset.stage] = Math.max(0, Math.round(n));
      saveStageEdits(p, edits);
    }
    const y = window.scrollY;
    render();
    window.scrollTo({ top: y });
  }

  function renderProspects(p, color) {
    const a = p.acquisition;
    const f = prospectFigures(p);
    const st = a.stages;
    const { totals: t, edited } = stageTotals(p, f);
    const last = st[st.length - 1].key;
    const anyEdit = Object.keys(edited).length > 0;
    const tiles = st.map((s) => tile({ label: s.label, hint: edited[s.key] !== undefined ? `Editado a mano · planilla: ${fmt(f.totals[s.key], 'int')}` : s.hint, value: t[s.key], format: 'int' }));
    tiles.push(tile({ label: 'Pendientes de contactar', hint: 'Prospectados sin mensaje enviado', value: Math.max(0, t[st[0].key] - t[st[1].key]), format: 'int' }));
    tiles.push(tile({ label: 'Tasa de contacto', hint: `${st[1].label} / ${st[0].label.toLowerCase()}`, value: ratio(t[st[1].key], t[st[0].key]), format: 'pct' }));
    tiles.push(tile({ label: 'Tasa de interés', hint: `${st[2].label} / ${st[1].label.toLowerCase()}`, value: ratio(t[st[2].key], t[st[1].key]), format: 'pct' }));
    tiles.push(tile({ label: 'Conversión total', hint: `${st[0].label} → ${st[st.length - 1].label}`, value: ratio(t[last], t[st[0].key]), format: 'pct' }));

    const editor = `
      <div class="card stage-edit">
        <div class="stage-edit-head">
          <div><h3>Editar etapas</h3><p class="sub">Los valores vienen de la planilla. Escribí uno para pisarlo a mano; vaciá el campo para volver al de la planilla. Se recuerda en este navegador.</p></div>
          ${anyEdit ? '<button type="button" class="link-btn" data-stage="reset">Volver a la planilla</button>' : ''}
        </div>
        <div class="stage-inputs">
          ${st.map((s) => `
            <label class="stage-input${edited[s.key] !== undefined ? ' is-edited' : ''}">
              <span>${esc(s.label)}</span>
              <input type="number" inputmode="numeric" min="0" step="1" value="${edited[s.key] ?? ''}" placeholder="${f.totals[s.key]}" data-stage="${esc(s.key)}" aria-label="${esc(s.label)}">
              <small>${edited[s.key] !== undefined ? `Planilla: ${fmt(f.totals[s.key], 'int')}` : 'De la planilla'}</small>
            </label>`).join('')}
        </div>
      </div>`;

    const cols = [{ key: 'nombre', label: '' }, ...st.map((s) => ({ key: s.key, label: s.label, format: 'int' })), { key: 'contacto', label: 'Tasa de contacto', format: 'pct' }];
    const withRates = (list) => list.map((r) => ({ ...r, contacto: ratio(r[st[1].key], r[st[0].key]) }));
    const total = withRates([{ nombre: 'Total', ...f.totals }])[0];

    const stageLabel = (r) => st[r.stage].label;
    const listCols = [
      { key: 'p', label: '#' },
      { key: 'n', label: 'Inmobiliaria' },
      { key: 'sdr', label: 'SDR' },
      { key: 'estado', label: 'Estado en la planilla' },
      { key: 'etapa', label: 'Etapa' },
      { key: 'fecha', label: 'Envío', format: 'day' },
      { key: 'canal', label: 'Canal' },
      { key: 'score', label: 'Score', format: 'int' },
    ];
    const list = f.rows.slice().sort((x, y) => y.stage - x.stage || (x.p || 999) - (y.p || 999))
      .map((r) => ({ ...r, etapa: stageLabel(r), fecha: r.fecha || null, canal: r.canal || '—', sdr: r.sdr || '—' }));

    return `
      <div class="tiles">${tiles.join('')}</div>
      ${editor}
      <div class="grid g-2" style="margin-top:12px">
        <div class="card"><h3>Embudo de prospección</h3><p class="sub">${anyEdit ? 'Con los valores editados a mano' : 'Toda la planilla'} · conversión entre etapas</p><div class="funnel">${funnelHtml(st, t, color)}</div></div>
        <div class="card"><h3>Contactados por día</h3><p class="sub">Según la fecha de envío en la planilla</p>${f.byDay.length ? chart(barChart({ points: f.byDay, format: 'int', color, height: 220 })) : '<p class="sub">Todavía no hay envíos con fecha.</p>'}</div>
      </div>
      <div class="grid g-2" style="margin-top:12px">
        <div class="card"><h3>Por SDR</h3><p class="sub">Según la planilla</p>${table({ columns: [{ ...cols[0], label: 'SDR' }, ...cols.slice(1)], rows: withRates(f.bySdr), total })}</div>
        <div class="card"><h3>Por canal</h3><p class="sub">Contactados según por dónde salió el mensaje</p>${table({ columns: [{ key: 'nombre', label: 'Canal' }, ...st.slice(1).map((s) => ({ key: s.key, label: s.label, format: 'int' }))], rows: f.byChannel })}</div>
      </div>
      <details class="card list-card" style="margin-top:12px">
        <summary><h3>Listado de prospectos</h3><span class="sub">${fmt(f.rows.length, 'int')} inmobiliarias · las más avanzadas primero</span></summary>
        ${table({ columns: listCols, rows: list })}
      </details>

      <h2 class="section">Ventas proyectadas <span>· sobre la base total de prospectados</span></h2>
      ${renderProjection(p, t)}`;
  }

  // ─── Pauta en Meta Ads (datos reales) ─────────────────────
  function adsTotals(rows) {
    const t = sumRows(rows, ['spend', 'impressions', 'clicks', 'landing', 'results']);
    t.ctr = ratio(t.clicks, t.impressions);
    t.cpc = ratio(t.spend, t.clicks);
    t.cpr = ratio(t.spend, t.results);
    return t;
  }
  const adsRows = (a) => a.daily.filter((d) => d.date.slice(0, 7) === state.month);
  const adsUpdated = (a) => (a.live ? 'en vivo' : `actualizado el ${dayTip(a.snapshotAt)}`);

  function renderAds(p, color) {
    const a = p.ads;
    const cur = a.currency;
    const rows = adsRows(a);
    if (!rows.length) {
      return `<div class="card"><p class="sub" style="margin:0">Sin pauta en ${esc(a.source)} en ${monthLabel(state.month, true)}.</p></div>`;
    }
    const t = adsTotals(rows);
    // Resultado de negocio (desde el lanzamiento): cruza la inversión de Meta
    // con las compras de PostHog. Solo en proyectos con embudo real.
    let business = '';
    if (p.acquisition.type === 'funnel') {
      const f = funnelFigures(p);
      const label = f.buyerLabel;
      business = `<div class="tiles key-tiles">${[
        { label: `${label} desde Meta`, hint: 'Llegaron por un anuncio', value: f.buyers, format: 'int' },
        { label: 'CPA Meta', hint: `Inversión / ${label.toLowerCase()} desde Meta`, value: f.cpa, format: 'money' },
        { label: `${label} totales`, hint: 'Todas las fuentes', value: f.allBuyers, format: 'int' },
        { label: 'CPA total', hint: `Inversión / ${label.toLowerCase()} totales`, value: f.cpaAll, format: 'money' },
      ].map((x) => tile({ ...x, currency: f.cur })).join('')}</div>
      <p class="note" style="margin:0 0 12px">${esc(label)}: pagos confirmados en PostHog (compra_confirmada) desde el lanzamiento. Meta: según la UTM de la primera visita.</p>`;
    }
    const tiles = [
      { label: 'Inversión', value: t.spend, format: 'money' },
      { label: 'Impresiones', value: t.impressions, format: 'int' },
      { label: 'Clics en el enlace', value: t.clicks, format: 'int' },
      { label: 'CTR', hint: 'Clics / impresiones', value: t.ctr, format: 'pct' },
      { label: 'Costo por clic', value: t.cpc, format: 'money' },
      { label: 'Visitas a la landing', value: t.landing, format: 'int' },
      { label: a.resultLabel, hint: 'Resultado de la campaña', value: t.results, format: 'int' },
      { label: 'Costo por resultado', hint: a.resultLabel, value: t.cpr, format: 'money' },
    ].map((x) => tile({ ...x, currency: cur })).join('');

    const days = [...new Set(rows.map((r) => r.date))].sort();
    const byDay = days.map((d) => adsTotals(rows.filter((r) => r.date === d)));
    const pts = (key) => days.map((d, i) => ({ label: dayLabel(d), tip: dayTip(d), value: byDay[i][key] }));

    const camps = a.campaigns.map((c) => ({ ...c, ...adsTotals(rows.filter((r) => r.campaignId === c.id)) }));
    const cols = [
      { key: 'name', label: 'Campaña' },
      { key: 'status', label: 'Estado', format: 'state' },
      { key: 'spend', label: 'Inversión', format: 'money' },
      { key: 'impressions', label: 'Impresiones', format: 'int' },
      { key: 'clicks', label: 'Clics', format: 'int' },
      { key: 'ctr', label: 'CTR', format: 'pct' },
      { key: 'cpc', label: 'CPC', format: 'money' },
      { key: 'landing', label: 'Visitas landing', format: 'int' },
      { key: 'results', label: a.resultLabel, format: 'int' },
      { key: 'cpr', label: 'Costo / resultado', format: 'money' },
    ];

    return `
      ${business}
      <div class="tiles">${tiles}</div>
      <div class="grid g-2" style="margin-top:12px">
        <div class="card"><h3>Inversión diaria</h3><p class="sub">En ${esc(cur)}</p>${chart(barChart({ points: pts('spend'), format: 'money', currency: cur, color }))}</div>
        <div class="card"><h3>${esc(a.resultLabel)} por día</h3><p class="sub">Resultado que optimiza la campaña</p>${chart(barChart({ points: pts('results'), format: 'int', color }))}</div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Por campaña</h3><p class="sub">${monthLabel(state.month, true)} · ${esc(a.source)}, ${adsUpdated(a)}</p>
        ${table({ columns: cols, rows: camps, total: camps.length > 1 ? { name: 'Total', ...adsTotals(rows) } : null, currency: cur })}
      </div>`;
  }

  // ─── Suscriptores e ingresos por día ──────────────────────
  // Días del mes elegido, sin huecos (un día sin datos cuenta como 0).
  function revenueRows(p) {
    const r = p.revenue || {};
    const src = r.daily || (r.query ? phRows(p, r.query) : []);
    const subs = dailyPoints(src, r.subsKey || 'suscriptores');
    const rev = dailyPoints(src, r.revenueKey || 'ingresos');
    return subs.map((d, i) => ({ date: d.date, subs: d.value, rev: rev[i].value }));
  }

  function revenueSummary(p) {
    const rows = revenueRows(p);
    return {
      rows,
      cur: (p.revenue && p.revenue.currency) || p.currency,
      subs: rows.reduce((a, d) => a + d.subs, 0),
      rev: rows.reduce((a, d) => a + d.rev, 0),
    };
  }

  function renderRevenue(p, color) {
    const r = p.revenue;
    const rows = revenueRows(p);
    const cur = r.currency || p.currency;
    const sum = (list, k) => list.reduce((a, d) => a + d[k], 0);
    const last7 = rows.slice(-7);
    const subs = sum(rows, 'subs');
    const rev = sum(rows, 'rev');
    const pts = (k) => rows.map((d) => ({ label: dayLabel(d.date), tip: dayTip(d.date), value: d[k] }));
    const stat = (k, v, hint) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${v}</div>${hint ? `<div class="h">${esc(hint)}</div>` : ''}</div>`;
    const period = `${monthLabel(state.month, true)} · del ${dayTip(rows[0].date)} al ${dayTip(rows[rows.length - 1].date)}`;
    return `
      <div class="card">
        <h3>${esc(r.subsLabel)}</h3><p class="sub">${period}</p>
        <div class="stat-row">
          ${stat('En el mes', fmt(subs, 'int'))}
          ${stat('Últimos 7 días', fmt(sum(last7, 'subs'), 'int'))}
          ${stat('Promedio diario', fmt(subs / rows.length, 'dec'))}
        </div>
        ${chart(barChart({ points: pts('subs'), format: 'int', color, height: 200 }))}
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Ingresos</h3><p class="sub">${period} · en ${esc(cur)}</p>
        <div class="stat-row">
          ${stat('En el mes', fmt(rev, 'money', cur))}
          ${stat('Últimos 7 días', fmt(sum(last7, 'rev'), 'money', cur))}
          ${stat(`Ingreso por ${r.unitLabel || 'suscriptor'}`, fmt(ratio(rev, subs), 'money', cur))}
        </div>
        ${chart(barChart({ points: pts('rev'), format: 'money', currency: cur, color, height: 200 }))}
      </div>
      ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}`;
  }

  function renderUsability(p, color) {
    const u = p.usability || {};
    // KPI con `query`: suma de la columna en PostHog (y con `of`, el cociente).
    const kpiValue = (k) => {
      if (!k.query) return k.value;
      const v = phSum(p, k.query, k.key);
      return k.of ? ratio(v, phSum(p, k.query, k.of)) : v;
    };
    const tiles = (u.kpis || []).map((k) => tile({ ...k, value: kpiValue(k), prev: k.query ? undefined : k.prev, currency: p.currency })).join('');
    const groups = (u.funnelGroups || []).map((g) => funnelGroupHtml(p, g, color)).join('');
    const volume = u.features ? featuresHtml(p, u.features, color) : '';
    const cards = [];
    if (u.funnel) {
      const row = phRows(p, u.funnel.query)[0] || {};
      cards.push(`<div class="card"><h3>${esc(u.funnel.title)}</h3>${u.funnel.note ? `<p class="sub">${esc(u.funnel.note)}</p>` : ''}
        <div class="funnel">${funnelHtml(u.funnel.steps, row, color, { relative: 'first', baseLabel: u.funnel.baseLabel })}</div></div>`);
    }
    (u.tables || []).forEach((t) => cards.push(`
      <div class="card${t.wide ? ' span-2' : ''}">
        <h3>${esc(t.title)}</h3>${t.note ? `<p class="sub">${esc(t.note)}</p>` : ''}
        ${table({ columns: t.columns, rows: t.query ? phRows(p, t.query) : t.rows, heat: t.heat, currency: p.currency })}
      </div>`));
    return `
      ${tiles ? `<div class="tiles">${tiles}</div>` : ''}
      ${volume}
      ${groups}
      ${cards.length ? `<div class="grid g-2" style="margin-top:12px">${cards.join('')}</div>` : ''}`;
  }

  // Funnels ordenados de PostHog: una fila por funnel con s1 … s6.
  function funnelGroupHtml(p, g, color) {
    const rows = new Map(phRows(p, g.query).map((r) => [r.funnel, r]));
    const card = (f, wide) => {
      const row = rows.get(f.id) || {};
      const steps = f.steps.map((label, i) => ({ key: `s${i + 1}`, label }));
      const first = Number(row.s1) || 0;
      const last = Number(row[`s${steps.length}`]) || 0;
      return `
        <div class="card funnel-card${wide ? ' span-2' : ''}">
          <div class="funnel-head">
            <div><h3>${esc(f.title)}</h3>${f.note ? `<p class="sub">${esc(f.note)}</p>` : ''}</div>
            <div class="funnel-total"><strong>${fmt(ratio(last, first), 'pct')}</strong><span>completa el recorrido</span></div>
          </div>
          <div class="funnel">${funnelHtml(steps, row, color)}</div>
        </div>`;
    };
    const wide = g.funnels.length === 1;
    return `
      <h3 class="group-title">${esc(g.title)}${g.note ? ` <span>· ${esc(g.note)}</span>` : ''}</h3>
      <div class="grid ${wide ? 'g-1' : 'g-2'}">${g.funnels.map((f) => card(f, wide)).join('')}</div>`;
  }

  // Volumen por función: personas (barra) y veces que se abrió cada una.
  function featuresHtml(p, cfg, color) {
    const rows = phRows(p, cfg.query);
    const top = Math.max(1, ...rows.map((r) => Number(r[cfg.key]) || 0));
    const list = rows.map((r) => {
      const v = Number(r[cfg.key]) || 0;
      const name = (cfg.names && cfg.names[r[cfg.labelKey]]) || r[cfg.labelKey];
      return `
        <div class="v-row">
          <span class="v-label">${esc(name)}</span>
          <span class="v-track"><span class="v-bar" style="width:${(v / top) * 100}%;background:${color}" data-tip="${tipHtml(name, `${fmt(v, 'int')} personas`, `${fmt(Number(r[cfg.secondary]) || 0, 'int')} veces`)}"></span></span>
          <span class="v-num"><strong>${fmt(v, 'int')}</strong><small>${fmt(Number(r[cfg.secondary]) || 0, 'int')} veces</small></span>
        </div>`;
    }).join('');
    return `
      <h3 class="group-title">${esc(cfg.title)}${cfg.note ? ` <span>· ${esc(cfg.note)}</span>` : ''}</h3>
      <div class="card"><div class="v-list">${list}</div></div>`;
  }

  function renderProject(p) {
    const i = PROJECTS.indexOf(p);
    const color = ACCENTS[i % ACCENTS.length];
    const f = nsmFigures(p);
    const { ns, prev, list, value } = f;
    const lastMonth = allMonths[allMonths.length - 1];
    const realUsability = !p.usability.noData && p.posthog;
    const acq = p.acquisition;
    const acqTitle = { funnel: 'Embudo por canal', paid: 'Registros, pagos y ROI', outbound: 'Outbound', prospects: 'Outbound' }[acq.type];
    const acqBadge = acq.type === 'funnel' ? phBadge(p)
      : acq.type === 'prospects' ? badge(null, `Datos reales · ${esc(acq.source)}, ${acq.live ? 'en vivo' : `actualizado el ${dayTip(acq.snapshotAt)}`}`)
        : badge(acq);
    const renderAcq = { funnel: renderFunnelAcq, paid: renderPaid, outbound: renderOutbound, prospects: renderProspects }[acq.type];

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1><span class="dot" style="background:${color};width:12px;height:12px"></span>${esc(p.name)} <span class="chip">${esc(p.stage)}</span></h1>
          <p>${esc(p.tagline)} · ${monthLabel(state.month, true)}</p>
        </div>
      </div>

      <nav class="jump" aria-label="Secciones del proyecto">
        <button type="button" data-jump="sec-resumen">Resumen</button>
        <button type="button" data-jump="producto-sec">Producto</button>
        <button type="button" data-jump="distribucion-sec">Distribución</button>
      </nav>

      <section class="pillar" id="sec-resumen" aria-labelledby="resumen-h">
        <div class="pillar-head">
          <h2 id="resumen-h">Resumen</h2>
          <p>La métrica principal y lo que entra: suscriptores e ingresos.</p>
        </div>
      <h2 class="section">North Star Metric ${f.badge}</h2>
      <div class="card nsm">
        <div>
          <p class="nsm-label">${esc(ns.name)}</p>
          <p class="hero">${fmt(value, ns.format)}</p>
          ${delta(value, prev && prev.value, { format: ns.format, suffix: f.suffix })}
          ${f.period ? `<p class="period">${f.period}</p>` : ''}
          <p class="nsm-def">${esc(ns.definition)}</p>
        </div>
        ${chart(lineChart({ points: list, format: ns.format, color, height: 240 }))}
      </div>

      ${p.revenue ? `
      <h2 class="section">Suscriptores e ingresos ${p.revenue.noData ? badge(p.revenue) : phBadge(p)}</h2>
      ${renderRevenue(p, color)}` : ''}
      </section>

      <section class="pillar" id="producto-sec" aria-labelledby="producto">
        <div class="pillar-head">
          <h2 id="producto">Producto</h2>
          <p>Funnels y usabilidad del producto digital: qué hace la gente una vez que llega.</p>
        </div>
        <h2 class="section">Funnels y usabilidad <span>· ${realUsability ? 'desde el lanzamiento' : `${monthLabel(lastMonth, true)}${state.month !== lastMonth ? ' (último mes cargado)' : ''}`}</span> ${realUsability ? phBadge(p) : badge(p.usability)}</h2>
        ${renderUsability(p, color)}
      </section>

      <section class="pillar" id="distribucion-sec" aria-labelledby="distribucion">
        <div class="pillar-head">
          <h2 id="distribucion">Distribución</h2>
          <p>Adquisición: cómo llegan los clientes, por qué canal y a qué costo.</p>
        </div>
        ${acq.type === 'prospects' ? `
        <h2 class="section">${acqTitle} <span>· prospectados → contactados → interesados → suscriptores</span> ${acqBadge}</h2>
        ${renderAcq(p, color)}` : ''}

        ${p.ads ? `
        <h2 class="section">Pauta en ${esc(p.ads.source)} ${badge(null, `Datos reales · ${adsUpdated(p.ads)}`)}</h2>
        ${renderAds(p, color)}` : ''}

        ${acq.type !== 'prospects' ? `
        <h2 class="section">${acqTitle} ${acqBadge}</h2>
        ${renderAcq(p, color)}` : ''}
      </section>`;
  }

  // ─── Navegación ───────────────────────────────────────────
  function renderTabs() {
    const items = [{ id: 'resumen', name: 'Resumen' }, ...PROJECTS];
    $('#tabs').innerHTML = items.map((p) => {
      const i = PROJECTS.indexOf(p);
      const dot = i >= 0 ? `<span class="dot" style="background:${ACCENTS[i % ACCENTS.length]}"></span>` : '';
      return `<a href="#${esc(p.id)}"${state.view === p.id ? ' aria-current="page"' : ''}>${dot}${esc(p.name)}</a>`;
    }).join('');
  }

  function render() {
    charts = {};
    tip.hidden = true;
    const project = PROJECTS.find((p) => p.id === state.view);
    if (!project) state.view = 'resumen';
    renderTabs();
    if (project) renderProject(project); else renderSummary();
    document.title = project ? `${project.name} · Chapa Labs` : 'Chapa Labs · Seguimiento';
    drawCharts();
    // Los botones de sección quedan pegados justo debajo del encabezado.
    document.documentElement.style.setProperty('--top-h', `${$('.top').offsetHeight}px`);
  }

  function fromHash() {
    state.view = decodeURIComponent(location.hash.slice(1)) || 'resumen';
  }

  window.addEventListener('hashchange', () => {
    fromHash();
    render();
    window.scrollTo({ top: 0 });
  });

  main.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-jump]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.jump);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // Marca el botón de la sección que se está viendo.
  window.addEventListener('scroll', () => {
    const buttons = [...document.querySelectorAll('[data-jump]')];
    if (!buttons.length) return;
    const limit = $('.top').offsetHeight + 80;
    let current = buttons[0];
    buttons.forEach((b) => {
      const el = document.getElementById(b.dataset.jump);
      if (el && el.getBoundingClientRect().top <= limit) current = b;
    });
    buttons.forEach((b) => b.classList.toggle('is-on', b === current));
  }, { passive: true });

  const select = $('#month');
  function fillMonths() {
    select.innerHTML = allMonths.slice().reverse().map((m) => `<option value="${m}">${monthLabel(m, true)}</option>`).join('');
    select.value = state.month;
  }
  fillMonths();
  select.addEventListener('change', () => { state.month = select.value; render(); });

  // Tema: sigue al sistema; el botón lo fija y se recuerda en este navegador.
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('chapa-theme');
    if (saved) root.dataset.theme = saved;
  } catch (e) { /* sin storage */ }
  $('#theme').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('chapa-theme', root.dataset.theme); } catch (e) { /* sin storage */ }
  });

  // Tooltip compartido por todos los gráficos.
  function showTip(e) {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.innerHTML = t.dataset.tip;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14;
    let y = e.clientY - r.height - 10;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y < 8) y = e.clientY + 16;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${y}px`;
  }
  main.addEventListener('pointermove', showTip);
  main.addEventListener('pointerdown', showTip);
  main.addEventListener('pointerleave', () => { tip.hidden = true; });
  main.addEventListener('mouseover', (e) => {
    const g = e.target.closest('.hitg');
    main.querySelectorAll('.cross').forEach((c) => c.setAttribute('opacity', '0'));
    if (g) g.querySelector('.cross').setAttribute('opacity', '1');
  });

  main.addEventListener('input', onProjectionInput);
  main.addEventListener('change', onProjectionInput);
  main.addEventListener('click', onProjectionInput);
  main.addEventListener('change', onStageEdit);
  main.addEventListener('click', onStageEdit);

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 80);
  }).observe(main);

  const noData = PROJECTS.some((p) => [p.northStar, p.revenue, p.acquisition, p.usability].some((b) => b && b.noData));
  if (noData) $('#sample').hidden = false;
  if (DATA.team && DATA.team.length) $('#team').textContent = `Seguimiento de proyectos · ${DATA.team.join(' y ')}`;
  $('#foot').textContent = `Datos actualizados al ${new Date(`${DATA.updatedAt}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.`;

  // Datos en vivo de Meta Ads (función /api/meta en Vercel). Si no está
  // configurada o falla, queda la foto guardada en data.js.
  async function loadLiveAds() {
    if (location.protocol === 'file:' || !PROJECTS.some((p) => p.ads)) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch('/api/meta', { signal: ctrl.signal });
      if (!res.ok) return;
      const live = await res.json();
      let changed = false;
      PROJECTS.forEach((p) => {
        if (!p.ads || !p.ads.match) return;
        const prefix = p.ads.match.toLowerCase();
        const camps = live.campaigns.filter((c) => c.name.toLowerCase().startsWith(prefix));
        if (!camps.length) return;
        const ids = new Set(camps.map((c) => c.id));
        p.ads.campaigns = camps;
        p.ads.daily = live.daily.filter((d) => ids.has(d.campaignId)).map((d) => ({
          date: d.date,
          campaignId: d.campaignId,
          spend: d.spend,
          impressions: d.impressions,
          clicks: d.clicks,
          landing: d.actions.landing_page_view || 0,
          results: d.actions[p.ads.resultAction] || 0,
        }));
        if (live.currency) p.ads.currency = live.currency;
        p.ads.live = true;
        changed = true;
      });
      if (!changed) return;
      const last = allMonths[allMonths.length - 1];
      allMonths = [...new Set(PROJECTS.flatMap(projectMonths))].sort();
      if (state.month === last) state.month = allMonths[allMonths.length - 1];
      fillMonths();
      render();
    } catch (e) { /* queda la foto de data.js */ }
  }

  // Datos en vivo de PostHog (función /api/posthog en Vercel).
  async function loadLivePosthog() {
    if (location.protocol === 'file:' || !PROJECTS.some((p) => p.posthog)) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch('/api/posthog', { signal: ctrl.signal });
      if (!res.ok) return;
      const live = await res.json();
      let changed = false;
      PROJECTS.forEach((p) => {
        const data = p.posthog && live.projects && live.projects[p.id];
        if (!data) return;
        p.posthog.data = data;
        p.posthog.live = true;
        changed = true;
      });
      if (changed) render();
    } catch (e) { /* queda la foto de data.js */ }
  }

  // Planilla de prospección en vivo (función /api/prospectos en Vercel).
  async function loadLiveProspects() {
    const p = PROJECTS.find((x) => x.acquisition.type === 'prospects');
    if (location.protocol === 'file:' || !p) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch('/api/prospectos', { signal: ctrl.signal });
      if (!res.ok) return;
      const live = await res.json();
      if (!live.rows || !live.rows.length) return;
      p.acquisition.rows = live.rows;
      p.acquisition.live = true;
      // Sin redibujar mientras se edita una variable de la proyección.
      if (document.activeElement && document.activeElement.closest('[data-proj]')) return;
      render();
    } catch (e) { /* queda la foto de data.js */ }
  }

  fromHash();
  render();
  loadLiveAds();
  loadLivePosthog();
  loadLiveProspects();
})();
