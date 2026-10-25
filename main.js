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
    ...p.northStar.series.map((s) => s.month),
    ...(p.ads ? p.ads.daily.map((d) => d.date.slice(0, 7)) : []),
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
  // Con muchos puntos (días) se muestran ~8 etiquetas en el eje.
  const showTick = (i, n) => {
    const every = Math.ceil(n / 8);
    return n <= 12 || i === n - 1 || (i % every === 0 && n - 1 - i >= every / 2);
  };
  const badge = (block, real) => {
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

  // ─── Datos por mes ────────────────────────────────────────
  const upTo = (rows) => rows.filter((r) => r.month <= state.month);
  const pick = (rows) => {
    const list = upTo(rows);
    return { curr: list[list.length - 1], prev: list[list.length - 2], list };
  };

  // ─── Gráficos (SVG a mano) ────────────────────────────────
  function niceScale(max, format) {
    if (max <= 0) return format === 'pct' ? { top: 1, step: 0.25 } : { top: 4, step: 1 };
    const raw = max / 4;
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
      const { top, step } = niceScale(max, format);
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
        if (showTick(i, n)) out += `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${axisLabel(p)}</text>`;
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
      const { top, step } = niceScale(max, format);
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
        if (showTick(i, n)) out += `<text x="${cx}" y="${h - 6}" text-anchor="middle">${axisLabel(p)}</text>`;
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

  function acquisitionHeadline(p) {
    if (p.ads) {
      const t = adsTotals(adsRows(p.ads));
      return [
        { k: 'Inversión Meta', v: fmt(t.spend, 'money', p.ads.currency) },
        { k: 'Costo por clic', v: fmt(t.cpc, 'money', p.ads.currency) },
        { k: p.ads.resultLabel, v: fmt(t.results, 'int') },
      ];
    }
    const a = p.acquisition;
    const { curr, prev } = pick(a.months);
    if (!curr) return [];
    if (a.type === 'paid') {
      const c = paidRow(curr);
      const pv = prev && paidRow(prev);
      return [
        { k: 'Registros', v: fmt(c.registros, 'int'), d: pv && delta(c.registros, pv.registros, { suffix: '' }) },
        { k: 'CPA', v: fmt(c.cpa, 'money2', p.currency), d: pv && delta(c.cpa, pv.cpa, { good: 'down', suffix: '' }) },
        { k: 'ROI', v: fmt(c.roi, 'pct'), d: pv && delta(c.roi, pv.roi, { format: 'pct', suffix: '' }) },
      ];
    }
    const first = a.stages[0].key;
    const last = a.stages[a.stages.length - 1].key;
    return [
      { k: 'Prospectados', v: fmt(curr[first], 'int'), d: prev && delta(curr[first], prev[first], { suffix: '' }) },
      { k: 'Demos', v: fmt(curr.demos, 'int'), d: prev && delta(curr.demos, prev.demos, { suffix: '' }) },
      { k: 'Clientes nuevos', v: fmt(curr[last], 'int'), d: prev && delta(curr[last], prev[last], { suffix: '' }) },
    ];
  }

  // ─── Vistas ───────────────────────────────────────────────
  function nsmFigures(p) {
    const ns = p.northStar;
    const { curr, prev, list } = pick(ns.series);
    const value = curr ? curr.value : NaN;
    const progress = ns.target ? Math.min(1, value / ns.target) : null;
    return { ns, curr, prev, list, value, progress };
  }

  function renderSummary() {
    const cards = PROJECTS.map((p, i) => {
      const { ns, prev, list, value, progress } = nsmFigures(p);
      const spark = chart(lineChart({ points: list, format: ns.format, color: ACCENTS[i], height: 120, target: ns.target }));
      const acq = acquisitionHeadline(p).map((m) => `<div class="mini"><div class="k">${m.k}</div><div class="v">${m.v}</div>${m.d || ''}</div>`).join('');
      return `
        <a class="card proj" href="#${esc(p.id)}">
          <div class="proj-top">
            <span class="proj-name"><span class="dot" style="background:${ACCENTS[i]}"></span>${esc(p.name)}</span>
            <span class="chip">${esc(p.stage)}</span>
          </div>
          <div>
            <p class="nsm-label">North Star · ${esc(ns.name)} ${badge(ns)}</p>
            <p class="hero">${fmt(value, ns.format)}</p>
            ${delta(value, prev && prev.value, { format: ns.format })}
          </div>
          ${progress !== null ? `
            <div>
              <div class="progress"><span style="width:${progress * 100}%;background:${ACCENTS[i]}"></span></div>
              <div class="progress-row"><span>${fmt(progress, 'pct')} de la meta</span><span>Meta ${fmt(ns.target, ns.format)}</span></div>
            </div>` : ''}
          ${spark}
          <div class="proj-acq">${acq}${p.ads ? '' : badge(p.acquisition)}</div>
        </a>`;
    }).join('');

    const rows = PROJECTS.map((p, i) => {
      const { ns, prev, value, progress } = nsmFigures(p);
      const acq = acquisitionHeadline(p).map((m) => `${m.k}: <strong>${m.v}</strong>`).join(' · ');
      return `<tr>
        <td><span class="proj-name" style="font-size:13px"><span class="dot" style="background:${ACCENTS[i]}"></span><a href="#${esc(p.id)}">${esc(p.name)}</a></span></td>
        <td style="text-align:left">${esc(ns.name)}</td>
        <td><strong>${fmt(value, ns.format)}</strong></td>
        <td>${delta(value, prev && prev.value, { format: ns.format, suffix: '' })}</td>
        <td>${progress !== null ? fmt(progress, 'pct') : '—'} ${badge(ns)}</td>
        <td>${p.ads ? `${esc(p.ads.source)} ${badge(null, 'Real')}` : `${p.acquisition.type === 'paid' ? 'Pauta paga' : 'Outbound'} ${badge(p.acquisition)}`}</td>
        <td style="text-align:left;white-space:normal;min-width:260px">${acq}</td>
      </tr>`;
    }).join('');

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Portafolio</h1>
          <p>${monthLabel(state.month, true)} · North Star y adquisición de cada proyecto</p>
        </div>
      </div>
      <div class="grid g-3">${cards}</div>
      <h2 class="section">Comparativo <span>· ${monthLabel(state.month, true)}</span></h2>
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>Proyecto</th><th style="text-align:left">North Star</th><th>Valor</th><th>Var. mensual</th><th>% de meta</th><th>Adquisición</th><th style="text-align:left">Claves del mes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
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

  function renderOutbound(p, color) {
    const a = p.acquisition;
    const { curr, prev, list } = pick(a.months);
    if (!curr) return '<p class="note">Sin datos para este mes.</p>';
    const stages = a.stages;
    const first = stages[0].key;
    const last = stages[stages.length - 1].key;
    const pv = prev || {};

    const tiles = stages.map((s) => tile({ label: s.label, value: curr[s.key], prev: pv[s.key], format: 'int' }));
    tiles.push(tile({ label: 'Conversión total', hint: `${stages[0].label} → ${stages[stages.length - 1].label}`, value: ratio(curr[last], curr[first]), prev: prev && ratio(pv[last], pv[first]), format: 'pct' }));
    if (curr.mrrNuevo !== undefined) tiles.push(tile({ label: 'MRR nuevo', value: curr.mrrNuevo, prev: pv.mrrNuevo, format: 'money', currency: p.currency }));

    const top = curr[first] || 1;
    const funnel = stages.map((s, i) => {
      const v = curr[s.key];
      const conv = i ? ratio(v, curr[stages[i - 1].key]) : null;
      return `${conv !== null ? `<div class="f-row"><span></span><span class="f-conv">↓ ${fmt(conv, 'pct')} pasa a la siguiente etapa</span></div>` : ''}
        <div class="f-row">
          <span class="f-label">${esc(s.label)}</span>
          <span class="f-track"><span class="f-bar" style="display:block;width:${(v / top) * 100}%;background:${color}" data-tip="${tipHtml(s.label, fmt(v, 'int'), i ? `${fmt(ratio(v, top), 'pct')} del total prospectado` : '')}"></span></span>
          <span class="f-num">${fmt(v, 'int')}</span>
        </div>`;
    }).join('');

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
    const channelMonth = a.months[a.months.length - 1].month;

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

  function renderUsability(p) {
    const u = p.usability || {};
    const tiles = (u.kpis || []).map((k) => tile({ ...k, currency: p.currency })).join('');
    const tables = (u.tables || []).map((t) => `
      <div class="card">
        <h3>${esc(t.title)}</h3>${t.note ? `<p class="sub">${esc(t.note)}</p>` : ''}
        ${table({ columns: t.columns, rows: t.rows, heat: t.heat, currency: p.currency })}
      </div>`).join('');
    return `
      ${tiles ? `<div class="tiles">${tiles}</div>` : ''}
      ${tables ? `<div class="grid g-2" style="margin-top:12px">${tables}</div>` : ''}`;
  }

  function renderProject(p) {
    const i = PROJECTS.indexOf(p);
    const color = ACCENTS[i % ACCENTS.length];
    const { ns, prev, list, value, progress } = nsmFigures(p);
    const lastMonth = allMonths[allMonths.length - 1];

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h1><span class="dot" style="background:${color};width:12px;height:12px"></span>${esc(p.name)} <span class="chip">${esc(p.stage)}</span></h1>
          <p>${esc(p.tagline)} · ${monthLabel(state.month, true)}</p>
        </div>
      </div>

      <h2 class="section">North Star Metric ${badge(ns)}</h2>
      <div class="card nsm">
        <div>
          <p class="nsm-label">${esc(ns.name)}</p>
          <p class="hero">${fmt(value, ns.format)}</p>
          ${delta(value, prev && prev.value, { format: ns.format })}
          <p class="nsm-def">${esc(ns.definition)}</p>
          ${progress !== null ? `
            <div class="progress"><span style="width:${progress * 100}%;background:${color}"></span></div>
            <div class="progress-row"><span>${fmt(progress, 'pct')} de la meta</span><span>Meta ${fmt(ns.target, ns.format)}</span></div>` : ''}
        </div>
        ${chart(lineChart({ points: list, format: ns.format, target: ns.target, color, height: 240 }))}
      </div>

      ${p.ads ? `
      <h2 class="section">Adquisición <span>· Pauta en ${esc(p.ads.source)}</span> ${badge(null, `Datos reales · ${adsUpdated(p.ads)}`)}</h2>
      ${renderAds(p, color)}` : ''}

      <h2 class="section">Adquisición <span>· ${p.acquisition.type === 'paid' ? 'Registros, pagos y ROI' : 'Outbound'}</span> ${badge(p.acquisition)}</h2>
      ${p.acquisition.type === 'paid' ? renderPaid(p, color) : renderOutbound(p, color)}

      <h2 class="section">Usabilidad <span>· ${monthLabel(lastMonth, true)}${state.month !== lastMonth ? ' (último mes cargado)' : ''}</span> ${badge(p.usability)}</h2>
      ${renderUsability(p)}`;
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
  }

  function fromHash() {
    state.view = decodeURIComponent(location.hash.slice(1)) || 'resumen';
  }

  window.addEventListener('hashchange', () => {
    fromHash();
    render();
    window.scrollTo({ top: 0 });
  });

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

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 80);
  }).observe(main);

  if (DATA.sample) $('#sample').hidden = false;
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

  fromHash();
  render();
  loadLiveAds();
})();
