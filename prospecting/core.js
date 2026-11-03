// Motor común de la prospección: lee las filas de la planilla de cualquier unidad,
// calcula embudos, cola del día y plantillas, y aplica las acciones del equipo.
// Es el mismo archivo en el navegador (window.ProspectingCore) y en el servidor
// (require), así las reglas son unas solas. No toca la red ni el DOM.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProspectingCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TZ = 'America/Argentina/Buenos_Aires';

  // ─── Columnas ───────────────────────────────────────────────
  // Cada campo tiene su encabezado canónico (el que se crea si falta) y una expresión
  // que reconoce los encabezados de las planillas que ya existen (Turnia, habita.).
  // El orden importa: cada encabezado se asigna al primer campo que lo reconoce.
  const FIELDS = [
    ['id', 'ID', /^(id|c[oó]digo|clave|row id)$/i],
    ['name', 'Nombre', /^(nombre|inmobiliaria|odont[oó]logo|cuenta|raz[oó]n social|prospecto)$/i],
    ['org', 'Organización', /^(organizaci[oó]n|consultorio|empresa|marca)$/i],
    ['greeting', 'Saludo', /^saludo$/i],
    ['title', 'Trato', /^trato$/i],
    ['phone', 'Teléfono', /^(tel[eé]fono|celular|whatsapp|tel[eé]fono \/ whatsapp)$|^n[uú]mero\b/i],
    ['phoneKind', 'Tipo de teléfono', /de qui[eé]n es el tel|tipo de tel|confianza del n[uú]mero/i],
    ['email', 'Email', /^(e-?mail|correo)/i],
    ['instagram', 'Instagram', /instagram/i],
    ['web', 'Web', /^(web|sitio)/i],
    ['address', 'Dirección', /^direcci[oó]n/i],
    ['zone', 'Zona', /^(zona|localidad|ciudad|barrio)/i],
    ['segment', 'Segmento', /^(segmento|especialidad|tipo de cuenta|rubro|grupo)/i],
    ['priority', 'Prioridad', /^prioridad/i],
    ['score', 'Score', /^(score|puntaje)\b/i],
    ['sdr', 'SDR', /\bsdr\b|^responsable/i],
    ['campaign', 'Campaña', /campa[nñ]a|^lista$/i],
    ['source', 'Fuente', /^fuente$/i],
    ['stage', 'Etapa', /^(etapa|estado)$/i],
    ['nextStep', 'Próximo paso', /^(pr[oó]ximo paso|pr[oó]xima acci[oó]n)$/i],
    ['nextAt', 'Fecha del próximo paso', /fecha.*pr[oó]xim|^seguimiento$/i],
    ['touches', 'Mensajes', /^mensajes( enviados)?$/i],
    ['greetingSent', 'Saludo enviado', /^saludo enviado$/i],
    ['firstContact', 'Primer contacto', /^(primer contacto|fecha (de )?env[ií]o|fecha)$/i],
    ['lastContact', 'Último contacto', /^[uú]ltimo contacto/i],
    ['lastChannel', 'Último canal', /^([uú]ltimo canal|canal)$/i],
    ['demoUrl', 'Demo', /^(demo|link de su demo|link demo|link de la demo)$/i],
    ['demoOpened', 'Abrió la demo', /^abri[oó] (su |la )?demo/i],
    ['demoTried', 'Probó la demo', /^prob[oó] (su |la )?demo/i],
    ['demoClinic', 'Clínica de la demo', /^cl[ií]nica de (su |la )?demo/i],
    ['demoChat', 'Conversó en la demo', /^convers[oó] en (su |la )?demo/i],
    ['replied', 'Respondió', /^respondi[oó]$/i],
    ['interested', 'Interesado', /^interesad[oa]$/i],
    ['meeting', 'Reunión', /^reuni[oó]n$/i],
    ['customer', 'Cliente', /^cliente$/i],
    ['lostReason', 'Motivo de pérdida', /motivo de p[eé]rdida/i],
    ['optOut', 'Baja', /^(baja|no recibir m[aá]s)$/i],
    // En habita. «Motivo / próximo paso» es la nota de la investigación: se muestra, no se pisa.
    ['signals', 'Señales', /^se[ñn]ales|^motivo \/ pr[oó]ximo paso/i],
    ['notes', 'Notas', /^notas?/i],
    ['updated', 'Actualizado', /^actualizado/i],
  ];
  const LABEL = Object.fromEntries(FIELDS.map(([k, l]) => [k, l]));
  const FIELD_KEYS = FIELDS.map(([k]) => k);

  // Columnas que el panel escribe: si la planilla no las tiene, «Preparar planilla» las agrega al final.
  const WRITABLE = ['id', 'stage', 'nextStep', 'nextAt', 'touches', 'firstContact', 'lastContact', 'lastChannel', 'demoOpened', 'demoTried', 'replied', 'interested', 'meeting', 'customer', 'lostReason', 'optOut', 'notes', 'updated'];
  // Lo que se puede editar a mano desde la ficha.
  const EDITABLE = ['name', 'org', 'greeting', 'phone', 'phoneKind', 'email', 'instagram', 'web', 'zone', 'segment', 'priority', 'sdr', 'campaign', 'demoUrl', 'nextStep', 'nextAt', 'lostReason'];

  const ACTIVITY_TAB = 'Actividad';
  const ACTIVITY_HEAD = ['Fecha', 'ID', 'Cuenta', 'Tipo', 'Canal', 'Plantilla', 'Detalle', 'Por'];

  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  function mapHeaders(head) {
    const map = {};
    const used = new Set();
    for (const [key, , re] of FIELDS) {
      const i = head.findIndex((h, idx) => !used.has(idx) && re.test(String(h || '').trim()));
      if (i >= 0) { map[key] = i; used.add(i); }
    }
    return map;
  }

  // ─── Fechas ─────────────────────────────────────────────────
  // Se guardan como texto «AAAA-MM-DD HH:mm» (hora de Buenos Aires) y se leen también
  // «23/10/2026», «23/10/2026 9:15» e ISO.
  function parseDate(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) return m[4] ? `${m[1]}-${m[2]}-${m[3]} ${m[4].padStart(2, '0')}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
    if (m) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      const d = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      return m[4] ? `${d} ${m[4].padStart(2, '0')}:${m[5]}` : d;
    }
    return /^(s[ií]|si|x|true|verdadero)$/i.test(s) ? 'sí' : '';
  }
  const dayOf = (d) => (d && d !== 'sí' ? d.slice(0, 10) : '');

  function nowLocal(date = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  }
  const today = (date) => nowLocal(date).slice(0, 10);

  function addDays(day, n) {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function addBusinessDays(day, n) {
    let d = day;
    let left = n;
    while (left > 0) {
      d = addDays(d, 1);
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (wd !== 0 && wd !== 6) left--;
    }
    return d;
  }
  const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

  // ─── Etapas ─────────────────────────────────────────────────
  // Las mismas para todas las unidades: el nivel ordena el embudo y permite sumar
  // Turnia y habita. en una vista general. Cada unidad las nombra a su manera.
  const STAGES = {
    por_contactar: { level: 0 },
    saludado: { level: 1 },
    contactado: { level: 1 },
    respondio: { level: 2 },
    interesado: { level: 3 },
    reunion: { level: 4 },
    cliente: { level: 5 },
    perdido: { level: -1, closed: true },
    invalido: { level: -1, closed: true },
    baja: { level: -1, closed: true },
  };
  const STAGE_KEYS = Object.keys(STAGES);

  // El orden importa: «No le interesa» antes que «Interesado».
  const STAGE_TEXT = [
    ['baja', /baja|no recibir|no (le )?escrib|opt.?out/],
    ['perdido', /no (le )?interes|perdid|descartad|no califica|lost|discarded/],
    ['invalido', /incorrect|sin whatsapp|no tiene whatsapp|invalid/],
    ['cliente', /cliente|suscript|pag[oó]|compr[oó]|cerrad|ganad|customer|activad|activated/],
    ['reunion', /reuni[oó]n|demo agendada|meeting/],
    ['interesado', /interesad|propuesta|prueba|interested/],
    ['respondio', /respondi|conversaci[oó]n|conversation|replied/],
    ['saludado', /saludad|esperan? la demo/],
    ['contactado', /enviad|contactad|seguimiento|sent|demo enviada/],
    ['por_contactar', /pendiente|por contactar|nuevo|pending|^$/],
  ];
  function stageFromText(text) {
    const t = norm(text).replace(/_/g, ' ');
    if (STAGES[t.replace(/ /g, '_')]) return t.replace(/ /g, '_');
    for (const [k, re] of STAGE_TEXT) if (re.test(t)) return k;
    return 'por_contactar';
  }

  // ─── Cuentas ────────────────────────────────────────────────
  function toAccounts(values, unit) {
    const [head = [], ...body] = values || [];
    const map = mapHeaders(head);
    const accounts = [];
    const seen = new Set();
    body.forEach((cells, i) => {
      const get = (k) => (map[k] === undefined ? '' : String(cells[map[k]] ?? '').trim());
      const name = get('name') || get('org');
      if (!name) return;
      const a = {};
      for (const k of FIELD_KEYS) a[k] = get(k);
      a.row = i + 2;
      a.name = name;
      a.stageRaw = a.stage;
      a.stage = stageFromText(a.stage);
      // Fechas o «Sí»; cualquier otro texto en Baja también cuenta como baja.
      for (const k of ['nextAt', 'firstContact', 'lastContact', 'greetingSent', 'demoClinic', 'demoChat', 'demoOpened', 'demoTried', 'replied', 'interested', 'meeting', 'customer']) a[k] = parseDate(a[k]);
      a.optOut = parseDate(a.optOut) || (a.optOut && !/^(no|false|falso|-)$/i.test(a.optOut) ? 'sí' : '');
      a.touches = Number(String(a.touches).replace(',', '.')) || 0;
      a.score = a.score === '' ? null : Number(String(a.score).replace(',', '.'));
      if (Number.isNaN(a.score)) a.score = null;
      a.priority = a.priority === '' ? null : Number(String(a.priority).replace(/\D+/g, '')) || null;
      a.phoneKind = a.phoneKind ? phoneKind(a.phoneKind) : '';
      // Sin ID en la planilla: uno estable a partir del nombre (la primera vez que se escribe, queda guardado).
      if (!a.id) a.id = `fila-${slug(name)}`;
      if (seen.has(a.id)) a.id = `${a.id}-${a.row}`;
      seen.add(a.id);
      a.extra = {};
      head.forEach((h, idx) => { if (!Object.values(map).includes(idx) && h && cells[idx]) a.extra[h] = cells[idx]; });
      if (a.stage === 'por_contactar' && a.firstContact) a.stage = 'contactado';
      if (a.optOut) a.stage = 'baja';
      accounts.push(unit && unit.enrich ? unit.enrich(a) : a);
    });
    return { accounts, map, head };
  }

  function phoneKind(t) {
    const s = norm(t);
    if (/fijo|landline/.test(s)) return 'fijo';
    if (/consultorio|oficina|empresa|recepci/.test(s)) return 'compartido';
    if (/verificad|propio|persona|celular|movil/.test(s)) return 'celular';
    if (/revisar|probable|confirmar/.test(s)) return 'revisar';
    return String(t).trim();
  }

  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'sin-nombre';
  }

  function toEvents(values) {
    const [, ...body] = values || [];
    return body.filter((r) => r[0] && r[1]).map((r) => ({
      at: parseDate(r[0]), id: String(r[1]), account: r[2] || '', type: norm(r[3]), channel: norm(r[4]), template: r[5] || '', detail: r[6] || '', by: r[7] || '',
    }));
  }
  const eventRow = (e) => [e.at, e.id, e.account, e.type, e.channel || '', e.template || '', e.detail || '', e.by || ''];

  // ─── Lectura de cada cuenta ─────────────────────────────────
  const level = (a) => Math.max(
    STAGES[a.stage] ? STAGES[a.stage].level : 0,
    a.firstContact ? 1 : 0,
    a.replied ? 2 : 0,
    a.interested ? 3 : 0,
    a.meeting ? 4 : 0,
    a.customer ? 5 : 0,
  );
  const isContacted = (a) => Boolean(a.firstContact) || level(a) >= 1;
  const closed = (a) => Boolean(STAGES[a.stage] && STAGES[a.stage].closed);

  function canMessage(a, unit) {
    if (a.optOut || a.stage === 'baja' || a.stage === 'invalido') return false;
    if (unit && unit.canMessage) return unit.canMessage(a);
    return Boolean(a.phone || a.email);
  }

  function counted(a, unit) {
    return unit && unit.counted ? unit.counted(a) : true;
  }

  function inRange(day, range) {
    if (!range || (!range.from && !range.to)) return true;
    if (!day) return false;
    return (!range.from || day >= range.from) && (!range.to || day <= range.to);
  }

  // ─── Embudo ─────────────────────────────────────────────────
  // Cohorte: contactados por primera vez en el período (como los dos paneles).
  // Prospectados es siempre toda la base filtrada. Cada etapa incluye a las siguientes.
  const FUNNEL = [
    ['prospectados', 'Prospectados'],
    ['contactados', 'Contactados'],
    ['respondieron', 'Respondieron'],
    ['interesados', 'Interesados'],
    ['reuniones', 'Reunión o demo'],
    ['clientes', 'Clientes'],
  ];

  function funnel(accounts, unit, { range, todayDay } = {}) {
    const base = accounts.filter((a) => counted(a, unit));
    const cohort = base.filter((a) => isContacted(a) && (!range || (!range.from && !range.to) ? true : inRange(dayOf(a.firstContact), range)));
    const interested = unit && unit.isInterested ? unit.isInterested : (a) => level(a) >= 3;
    const t = todayDay || today();
    const out = {
      prospectados: base.length,
      contactados: cohort.length,
      respondieron: cohort.filter((a) => level(a) >= 2 || a.replied).length,
      interesados: cohort.filter((a) => level(a) >= 3 || interested(a)).length,
      reuniones: cohort.filter((a) => level(a) >= 4).length,
      clientes: cohort.filter((a) => level(a) >= 5).length,
      perdidos: cohort.filter((a) => a.stage === 'perdido').length,
      bajas: base.filter((a) => a.stage === 'baja' || a.optOut).length,
      invalidos: base.filter((a) => a.stage === 'invalido').length,
      abrieronDemo: cohort.filter((a) => a.demoOpened).length,
      probaronDemo: cohort.filter((a) => a.demoTried).length,
      mensajes: cohort.reduce((s, a) => s + (a.touches || 0), 0),
      // Contactados hace menos de la ventana que todavía no respondieron: pueden responder.
      enObservacion: cohort.filter((a) => level(a) < 2 && a.firstContact && daysBetween(dayOf(a.firstContact), t) < ((unit && unit.window) || 7)).length,
      porContactar: base.filter((a) => !isContacted(a) && canMessage(a, unit)).length,
    };
    out.maduros = out.contactados - out.enObservacion;
    return out;
  }

  function funnelSteps(f) {
    return FUNNEL.map(([key, label], i) => ({
      key, label, value: f[key] || 0,
      ofPrev: i === 0 ? null : ratio(f[key], f[FUNNEL[i - 1][0]]),
      ofContacted: i <= 1 ? null : ratio(f[key], f.contactados),
    }));
  }
  const ratio = (a, b) => (b ? a / b : null);

  // Desglose por una dimensión (zona, SDR, campaña…): un embudo por valor.
  function breakdown(accounts, unit, dim, opts) {
    const groups = new Map();
    for (const a of accounts) {
      const raw = dim === 'priority' ? (a.priority ? `P${a.priority}` : '') : dim === 'phoneKind' ? a.phoneKind : a[dim];
      const k = String(raw || '').trim() || 'Sin dato';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }
    return [...groups.entries()].map(([value, list]) => ({ value, ...funnel(list, unit, opts) }))
      .sort((x, y) => y.contactados - x.contactados || y.prospectados - x.prospectados);
  }

  // ─── Embudo con metas ───────────────────────────────────────
  // La base (saludos) tiene una meta por semana que se escala al período; cada paso siguiente tiene
  // una conversión esperada sobre el anterior. Lo real sale de la planilla (cohorte del período) o del
  // /api/metricas de la app (mismo período). Sin dato, el paso queda «Sin datos» y no se inventa.
  function periodWeeks(accounts, range, todayDay) {
    const t = todayDay || today();
    if (range && range.from) return Math.max(1, daysBetween(range.from, range.to || t) + 1) / 7;
    const firsts = accounts.map((a) => dayOf(a.firstContact)).filter(Boolean).sort();
    return firsts.length ? Math.max(1, daysBetween(firsts[0], t) + 1) / 7 : 1;
  }
  const pathGet = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  function targetFunnel(accounts, unit, { range, todayDay, metrics } = {}) {
    const steps = (unit && unit.targets) || [];
    if (!steps.length) return null;
    const base = accounts.filter((a) => counted(a, unit));
    const cohort = base.filter((a) => (range && (range.from || range.to) ? inRange(dayOf(a.firstContact), range) : true));
    const weeks = periodWeeks(base, range, todayDay);
    let target = null;
    let prevActual = null;
    return {
      weeks,
      steps: steps.map((s, i) => {
        target = i === 0 ? (s.perWeek || 0) * weeks : target * (s.rate || 0);
        let actual = null;
        let source = 'none';
        if (s.sheet) {
          actual = (i === 0 ? cohort : cohort).filter(s.sheet).length;
          source = 'sheet';
        } else if (s.metrics && metrics) {
          const v = pathGet(metrics, s.metrics);
          if (typeof v === 'number') { actual = v; source = 'app'; }
        }
        const rate = i === 0 || actual == null || prevActual == null ? null : ratio(actual, prevActual);
        const out = { key: s.key, label: s.label, hint: s.hint || '', target, targetRate: i === 0 ? null : s.rate, actual, rate, source,
          // En meta si llega a la cantidad; para la conversión, si la iguala o la supera.
          onTarget: actual == null ? null : actual >= target - 1e-9,
          rateOk: rate == null ? null : rate >= s.rate - 1e-9 };
        prevActual = actual;
        return out;
      }),
    };
  }

  // ─── Actividad por día ──────────────────────────────────────
  const CONTACT_TYPES = ['saludo', 'mensaje', 'llamada', 'visita'];
  function daily(events, accounts, unit, range) {
    const days = new Map();
    const bump = (d, k) => {
      if (!d || !inRange(d, range)) return;
      if (!days.has(d)) days.set(d, { date: d, contactos: 0, nuevos: 0, respuestas: 0, interesados: 0, reuniones: 0, clientes: 0 });
      days.get(d)[k]++;
    };
    const undone = undoneSet(events);
    for (const e of events) {
      if (undone.has(e)) continue;
      const d = dayOf(e.at);
      if (CONTACT_TYPES.includes(e.type)) bump(d, 'contactos');
      else if (e.type === 'respondio') bump(d, 'respuestas');
      else if (e.type === 'interesado') bump(d, 'interesados');
      else if (e.type === 'reunion') bump(d, 'reuniones');
      else if (e.type === 'cliente') bump(d, 'clientes');
    }
    for (const a of accounts) if (counted(a, unit) && a.firstContact) bump(dayOf(a.firstContact), 'nuevos');
    // Sin pestaña Actividad (una planilla de solo lectura): los primeros contactos hacen de contactos.
    if (!events.length) for (const d of days.values()) d.contactos = d.nuevos;
    return [...days.values()].sort((x, y) => x.date.localeCompare(y.date));
  }

  // «Deshacer» deja un evento que anula el último contacto de esa cuenta.
  function undoneSet(events) {
    const out = new Set();
    const last = new Map();
    for (const e of events) {
      if (CONTACT_TYPES.includes(e.type)) last.set(e.id, e);
      else if (e.type === 'deshacer' && last.has(e.id)) { out.add(last.get(e.id)); last.delete(e.id); }
    }
    return out;
  }

  // ─── Mensajes: qué responde cada plantilla ──────────────────
  // Cada respuesta va al último mensaje enviado antes, dentro de la ventana (7 días).
  // Un envío madura cuando pasó la ventana o ya tuvo respuesta. Muestra chica si n<30.
  function templateStats(events, unit, todayDay) {
    const t = todayDay || today();
    const win = (unit && unit.window) || 7;
    const undone = undoneSet(events);
    const byAccount = new Map();
    for (const e of events) {
      if (undone.has(e)) continue;
      if (!byAccount.has(e.id)) byAccount.set(e.id, []);
      byAccount.get(e.id).push(e);
    }
    const stats = new Map();
    const row = (k) => {
      if (!stats.has(k)) stats.set(k, { template: k, enviados: 0, maduros: 0, respuestas: 0 });
      return stats.get(k);
    };
    for (const list of byAccount.values()) {
      list.sort((x, y) => x.at.localeCompare(y.at));
      let open = null;
      for (const e of list) {
        if (CONTACT_TYPES.includes(e.type) && e.type !== 'llamada' && e.type !== 'visita') {
          if (open) closeSend(open, false);
          open = { e, s: row(e.template || 'Sin plantilla') };
          open.s.enviados++;
        } else if (e.type === 'respondio' && open) {
          const inWindow = daysBetween(dayOf(open.e.at), dayOf(e.at)) <= win;
          closeSend(open, inWindow);
          open = null;
        }
      }
      if (open) closeSend(open, false);
    }
    function closeSend(o, replied) {
      if (replied) { o.s.respuestas++; o.s.maduros++; return; }
      if (daysBetween(dayOf(o.e.at), t) >= win) o.s.maduros++;
    }
    return [...stats.values()].map((s) => ({ ...s, tasa: ratio(s.respuestas, s.maduros), muestraChica: s.maduros < 30 }))
      .sort((x, y) => y.enviados - x.enviados);
  }

  // ─── Cola del día ───────────────────────────────────────────
  function queue(accounts, unit, { todayDay, events = [] } = {}) {
    const t = todayDay || today();
    const due = (a) => !a.nextAt || dayOf(a.nextAt) <= t;
    const live = accounts.filter((a) => !closed(a) && !a.optOut && counted(a, unit));
    const max = (unit && unit.maxTouches) || 3;
    const heat = (a) => (a.demoTried ? 2 : a.demoOpened ? 1 : 0);
    const conversations = live.filter((a) => level(a) >= 2 && level(a) < 5 && due(a))
      .sort((x, y) => level(y) - level(x) || String(x.nextAt).localeCompare(String(y.nextAt)));
    const greeted = live.filter((a) => a.stage === 'saludado')
      .sort((x, y) => String(x.lastContact).localeCompare(String(y.lastContact)));
    const followUps = live.filter((a) => level(a) === 1 && a.stage !== 'saludado' && a.touches < max && due(a) && a.nextAt)
      .sort((x, y) => heat(y) - heat(x) || String(x.nextAt).localeCompare(String(y.nextAt)));
    const contactedToday = new Set(accounts.filter((a) => dayOf(a.firstContact) === t).map((a) => a.id));
    for (const e of events) if (dayOf(e.at) === t && (e.type === 'saludo' || e.type === 'mensaje')) contactedToday.add(e.id);
    const goal = (unit && unit.dailyGoal) || 40;
    const fresh = live.filter((a) => !isContacted(a) && canMessage(a, unit))
      .sort((x, y) => (x.priority || 9) - (y.priority || 9) || (y.score ?? -1) - (x.score ?? -1) || x.row - y.row);
    return {
      conversations, greeted, followUps,
      fresh: fresh.slice(0, Math.max(0, goal - contactedToday.size)),
      freshTotal: fresh.length,
      goal, doneToday: contactedToday.size,
    };
  }

  // ─── Plantillas ─────────────────────────────────────────────
  function firstName(a) {
    const g = a.greeting || String(a.name).split(/\s+/)[0] || '';
    return g;
  }
  function renderTemplate(text, a, unit) {
    const vars = Object.assign({
      saludo: firstName(a),
      nombre: a.name,
      organizacion: a.org || a.name,
      consultorio: a.org || a.name,
      inmobiliaria: a.org || a.name,
      zona: a.zone || '',
      link: (unit && unit.demoLink ? unit.demoLink(a) : a.demoUrl) || '',
      remitente: (unit && unit.sender) || '',
    }, unit && unit.vars ? unit.vars(a) : {});
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\n{3,}/g, '\n\n').trim();
  }

  function nextTemplate(a, unit) {
    return unit && unit.nextTemplate ? unit.nextTemplate(a) : null;
  }

  function waLink(phone, text) {
    let d = String(phone || '').replace(/\D+/g, '');
    if (!d) return '';
    if (d.length === 10) d = `549${d}`; // número argentino sin código de país
    else if (d.length === 12 && d.startsWith('54') && d[2] !== '9') d = `549${d.slice(2)}`;
    return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  }

  // ─── Acciones ───────────────────────────────────────────────
  // Devuelve qué cambia en la fila y qué se anota en Actividad. Lo usan el servidor
  // (sobre la fila recién leída) y el modo de ejemplo del navegador.
  const OUTCOMES = {
    respondio: { milestone: 'replied', stage: 'respondio' },
    interesado: { milestone: 'interested', stage: 'interesado' },
    reunion: { milestone: 'meeting', stage: 'reunion' },
    cliente: { milestone: 'customer', stage: 'cliente' },
    perdido: { stage: 'perdido' },
    invalido: { stage: 'invalido' },
    baja: { stage: 'baja' },
  };

  function applyAction(a, action, { unit, now, by }) {
    const at = now || nowLocal();
    const day = at.slice(0, 10);
    const patch = {};
    const events = [];
    const ev = (type, extra = {}) => events.push({ at, id: a.id, account: a.name, type, by, ...extra });
    const cadence = (unit && unit.cadence) || [3, 4];
    const max = (unit && unit.maxTouches) || 3;

    switch (action.type) {
      case 'sent': {
        // Solo se registra cuando el equipo confirma que el mensaje salió: abrir el chat no cuenta.
        const greeting = action.kind === 'saludo';
        // Los mensajes de una conversación en curso no cuentan como pasos de la secuencia.
        const touches = greeting || level(a) >= 2 ? a.touches : (a.touches || 0) + 1;
        if (!a.firstContact) patch.firstContact = at;
        patch.lastContact = at;
        patch.lastChannel = action.channel || 'whatsapp';
        if (touches !== a.touches) patch.touches = touches;
        if (level(a) < 2) {
          patch.stage = greeting ? 'saludado' : 'contactado';
          if (greeting) {
            patch.nextAt = addBusinessDays(day, 1);
            patch.nextStep = 'Ver si respondió el saludo';
          } else if (touches < max) {
            patch.nextAt = addBusinessDays(day, cadence[Math.min(touches - 1, cadence.length - 1)]);
            patch.nextStep = `Seguimiento ${touches + 1} de ${max}`;
          } else {
            patch.nextAt = '';
            patch.nextStep = 'Sin respuesta: no escribir más';
          }
        } else {
          patch.nextAt = addBusinessDays(day, 2);
          patch.nextStep = 'Esperar respuesta';
        }
        ev(greeting ? 'saludo' : 'mensaje', { channel: patch.lastChannel, template: action.template || '', detail: action.detail || '' });
        break;
      }
      case 'call':
      case 'visit': {
        if (!a.firstContact) patch.firstContact = at;
        patch.lastContact = at;
        patch.lastChannel = action.type === 'call' ? 'llamada' : 'visita';
        if (level(a) < 1) patch.stage = 'contactado';
        if (action.nextAt !== undefined) patch.nextAt = action.nextAt;
        ev(action.type === 'call' ? 'llamada' : 'visita', { channel: patch.lastChannel, detail: action.detail || '' });
        break;
      }
      case 'outcome': {
        const o = OUTCOMES[action.outcome];
        if (!o) throw new Error('Resultado desconocido.');
        if (o.milestone && !a[o.milestone]) patch[o.milestone] = at;
        // Interés, reunión o cliente implican que respondió.
        if (['interested', 'meeting', 'customer'].includes(o.milestone) && !a.replied) patch.replied = at;
        if (['meeting', 'customer'].includes(o.milestone) && !a.interested) patch.interested = at;
        if (o.milestone === 'customer' && !a.meeting) patch.meeting = at;
        if (!o.milestone || STAGES[o.stage].level >= level(a) || closed(a)) patch.stage = o.stage;
        if (!a.firstContact && action.outcome !== 'invalido') patch.firstContact = at;
        if (action.outcome === 'baja') { patch.optOut = at; patch.nextAt = ''; patch.nextStep = 'No escribir más'; }
        if (action.outcome === 'perdido' || action.outcome === 'invalido') { patch.nextAt = ''; patch.lostReason = action.detail || a.lostReason || ''; }
        if (action.outcome === 'respondio') { patch.nextAt = day; patch.nextStep = 'Contestarle'; }
        if (action.outcome === 'interesado') { patch.nextAt = day; patch.nextStep = 'Proponer reunión'; }
        if (action.outcome === 'reunion') { patch.nextAt = action.nextAt || addBusinessDays(day, 1); patch.nextStep = action.nextStep || 'Reunión'; }
        if (action.outcome === 'cliente') { patch.nextAt = ''; patch.nextStep = 'Onboarding'; }
        ev(action.outcome, { channel: action.channel || '', detail: action.detail || '' });
        break;
      }
      case 'demo': {
        const k = action.tried ? 'demoTried' : 'demoOpened';
        if (!a[k]) patch[k] = at;
        if (action.tried && !a.demoOpened) patch.demoOpened = at;
        if (level(a) === 1) patch.nextAt = day;
        ev(action.tried ? 'probo_demo' : 'abrio_demo');
        break;
      }
      case 'schedule': {
        patch.nextAt = action.nextAt || '';
        if (action.nextStep !== undefined) patch.nextStep = action.nextStep;
        ev('proximo', { detail: [patch.nextAt, patch.nextStep].filter(Boolean).join(' · ') });
        break;
      }
      case 'note': {
        const text = String(action.text || '').trim();
        if (!text) throw new Error('La nota está vacía.');
        patch.notes = [a.notes, `${day}: ${text}`].filter(Boolean).join('\n');
        ev('nota', { detail: text.slice(0, 500) });
        break;
      }
      case 'edit': {
        for (const [k, v] of Object.entries(action.fields || {})) {
          if (!EDITABLE.includes(k)) continue;
          patch[k] = k === 'nextAt' ? parseDate(v) : String(v ?? '').trim();
        }
        ev('edicion', { detail: Object.keys(patch).map((k) => LABEL[k]).join(', ') });
        break;
      }
      case 'undo': {
        // Vuelve los campos a como estaban antes del último contacto (los manda el navegador).
        for (const [k, v] of Object.entries(action.previous || {})) if (WRITABLE.includes(k) && k !== 'updated' && k !== 'id') patch[k] = v;
        ev('deshacer', { detail: action.detail || 'Deshacer el último contacto' });
        break;
      }
      case 'reopen': {
        patch.stage = level(a) >= 2 ? 'respondio' : a.firstContact ? 'contactado' : 'por_contactar';
        patch.optOut = '';
        ev('reabrir', { detail: action.detail || '' });
        break;
      }
      default:
        throw new Error('Acción desconocida.');
    }
    patch.updated = nowLocal();
    return { patch, events };
  }

  // Valor que va a la planilla para cada campo.
  function cellValue(key, value, unit) {
    if (key === 'stage') return unit && unit.stageLabel ? unit.stageLabel(value) : value;
    if (key === 'touches') return value === '' ? '' : Number(value) || 0;
    // Algunas planillas guardan ciertas fechas como «23/10/2026» (sin hora): se respeta su formato.
    if (unit && unit.dayColumns && unit.dayColumns.includes(key) && /^\d{4}-\d{2}-\d{2}/.test(value || '')) {
      return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
    }
    return value ?? '';
  }

  return {
    TZ, FIELDS, LABEL, WRITABLE, EDITABLE, STAGES, STAGE_KEYS, FUNNEL, ACTIVITY_TAB, ACTIVITY_HEAD, CONTACT_TYPES,
    norm, slug, mapHeaders, parseDate, dayOf, nowLocal, today, addDays, addBusinessDays, daysBetween,
    stageFromText, toAccounts, toEvents, eventRow, level, isContacted, closed, canMessage, counted, inRange,
    funnel, funnelSteps, breakdown, daily, targetFunnel, periodWeeks, templateStats, queue, renderTemplate, nextTemplate, waLink, applyAction, cellValue, firstName,
  };
});
