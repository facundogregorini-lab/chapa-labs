// Liquid glass: refracción real del fondo con un filtro SVG (feDisplacementMap) usado
// como backdrop-filter. Técnica de kube.io («Liquid Glass in the browser») y de
// rizroze/liquid-glass: un mapa de desplazamiento calculado para el borde de cada
// elemento (un bisel convexo tipo squircle) que curva lo que hay detrás, como un vidrio.
//
// Solo Chromium aplica filtros SVG en backdrop-filter. En Safari y Firefox queda el
// vidrio esmerilado de glass.css (blur + saturación + brillo en el borde), que ya se ve bien.
// Se aplica solo a los elementos con [data-liquid]: es costoso, no va en cada tarjeta.
(function () {
  'use strict';

  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)) || (/Chrome\/\d+/.test(navigator.userAgent) && !/Edg\/|OPR\//.test(navigator.userAgent) && 'chrome' in window);
  const reduced = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  const enabled = chromium && !reduced && CSS.supports('backdrop-filter', 'blur(1px)');
  document.documentElement.classList.toggle('lg-refract', enabled);

  const NS = 'http://www.w3.org/2000/svg';
  let defs = null;
  let seq = 0;

  function ensureDefs() {
    if (defs) return defs;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  // Distancia con signo a un rectángulo redondeado y su normal (afuera = positivo).
  function sdf(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r);
    const qy = Math.abs(py) - (hh - r);
    const sx = Math.sign(px) || 1;
    const sy = Math.sign(py) || 1;
    if (qx > 0 && qy > 0) {
      const len = Math.hypot(qx, qy);
      return { d: len - r, nx: (qx / len) * sx, ny: (qy / len) * sy };
    }
    if (qx > qy) return { d: qx - r, nx: sx, ny: 0 };
    return { d: qy - r, nx: 0, ny: sy };
  }

  // Mapa de desplazamiento: R = x, G = y, 128 = sin desplazamiento.
  function displacementMap(w, h, radius, bezel) {
    const k = Math.min(1, 320 / Math.max(w, h)); // resolución reducida: el mapa es suave
    const cw = Math.max(8, Math.round(w * k));
    const ch = Math.max(8, Math.round(h * k));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    const hw = w / 2;
    const hh = h / 2;
    const r = Math.min(radius, hw, hh);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const px = (x + 0.5) / k - hw;
        const py = (y + 0.5) / k - hh;
        const { d, nx, ny } = sdf(px, py, hw, hh, r);
        const inside = -d;
        let mag = 0;
        if (inside > 0 && inside < bezel) {
          // Perfil convexo (squircle): la pendiente es máxima en el borde y se apaga hacia adentro.
          const t = inside / bezel;
          mag = Math.pow(1 - t, 2.2);
        }
        // Se toma el fondo desde adentro: el borde «estira» lo que hay detrás.
        const i = (y * cw + x) * 4;
        img.data[i] = 128 - nx * mag * 127;
        img.data[i + 1] = 128 - ny * mag * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function build(el) {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 8 || h < 8) return;
    const key = `${w}x${h}`;
    if (el.dataset.lgKey === key) return;
    el.dataset.lgKey = key;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16;
    const bezel = Math.min(Number(el.dataset.liquidBezel) || 22, Math.min(w, h) / 2);
    const strength = Number(el.dataset.liquid) || 36;
    const blur = Number(el.dataset.liquidBlur ?? 2.2);
    const id = el.dataset.lgId || `lg-${++seq}`;
    el.dataset.lgId = id;
    let filter = document.getElementById(id);
    if (!filter) {
      filter = document.createElementNS(NS, 'filter');
      filter.id = id;
      ensureDefs().appendChild(filter);
    }
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', String(w));
    filter.setAttribute('height', String(h));
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const map = displacementMap(w, h, radius, bezel);
    // Aberración cromática leve: cada canal se desplaza un poco distinto.
    filter.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="soft"/>
      <feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="soft" in2="map" scale="${strength}" xChannelSelector="R" yChannelSelector="G" result="dR"/>
      <feDisplacementMap in="soft" in2="map" scale="${strength * 0.92}" xChannelSelector="R" yChannelSelector="G" result="dG"/>
      <feDisplacementMap in="soft" in2="map" scale="${strength * 0.84}" xChannelSelector="R" yChannelSelector="G" result="dB"/>
      <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feBlend in="r" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="b" mode="screen" result="rgb"/>
      <feColorMatrix in="rgb" type="saturate" values="1.6"/>`;
    el.style.setProperty('--lg-filter', `url(#${id})`);
  }

  const observer = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    for (const e of entries) schedule(e.target);
  }) : null;
  const pending = new Set();
  let raf = 0;
  function schedule(el) {
    pending.add(el);
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      for (const p of pending) if (p.isConnected) build(p);
      pending.clear();
    });
  }

  function scan(root) {
    if (!enabled) return;
    (root || document).querySelectorAll('[data-liquid]').forEach((el) => {
      if (el.dataset.lgWatched) return;
      el.dataset.lgWatched = '1';
      schedule(el);
      if (observer) observer.observe(el);
    });
  }

  window.LiquidGlass = { enabled, scan, refresh: (el) => { if (enabled && el) { delete el.dataset.lgKey; schedule(el); } } };
})();
