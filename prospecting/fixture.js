// Datos de ejemplo para recorrer el panel sin planillas conectadas. Todo es ficticio:
// apellidos inventados, teléfonos 000 y dominios .test. Se carga solo en el modo de
// ejemplo y nunca se mezcla con datos reales.
(function () {
  'use strict';
  const C = window.ProspectingCore;

  function rng(seed) {
    let s = 0;
    for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FIRST = ['Laura', 'Martín', 'Sofía', 'Diego', 'Valeria', 'Pablo', 'Carolina', 'Julián', 'Mariana', 'Federico', 'Lucía', 'Gonzalo', 'Paula', 'Andrés', 'Florencia', 'Matías', 'Natalia', 'Ignacio', 'Romina', 'Tomás'];
  const LAST = ['Valdamar', 'Quintell', 'Arrieche', 'Borsalli', 'Montefrío', 'Larraquí', 'Esterhal', 'Ocampell', 'Variosa', 'Treviñal', 'Aldunce', 'Mirabet', 'Corvalán Ficticio', 'Senadur', 'Pelleri', 'Ibarzal', 'Granduque', 'Fiorentel'];
  const AGENCY = ['Propiedades', 'Inmobiliaria', 'Bienes Raíces', 'Negocios Inmobiliarios', 'Real Estate'];

  function build(unit) {
    const r = rng(unit.id);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const t = C.today();
    const zones = unit.id === 'turnia' ? ['Mar del Plata', 'Mar del Plata', 'Mar del Plata', 'Miramar', 'Batán', 'Santa Clara del Mar', 'Necochea', 'Balcarce'] : ['Palermo', 'Belgrano', 'Caballito', 'Mar del Plata', 'Rosario', 'Córdoba', 'La Plata', 'Nordelta'];
    const sdrs = ['Axel', 'Facundo', 'Agustín'];
    const accounts = [];
    const events = [];
    const n = unit.id === 'turnia' ? 210 : 170;
    for (let i = 0; i < n; i++) {
      const first = pick(FIRST);
      const last = pick(LAST);
      const female = /a$/.test(first);
      const id = unit.id === 'turnia' ? `ej${(1000 + i).toString(36)}` : `hab-${i + 1}`;
      const kindRoll = r();
      const a = {
        id, row: i + 2,
        name: unit.id === 'turnia' ? `${first} ${last}` : `${last} ${pick(AGENCY)}`,
        org: unit.id === 'turnia' ? `Consultorio ${female ? 'Dra.' : 'Dr.'} ${last}` : '',
        greeting: unit.id === 'turnia' ? first : first,
        title: unit.id === 'turnia' ? (female ? 'Dra.' : 'Dr.') : '',
        phone: `223 000-${String(1000 + i).slice(-4)}`,
        phoneKind: unit.id === 'turnia' ? (kindRoll < 0.55 ? 'celular' : kindRoll < 0.7 ? 'compartido' : 'fijo') : (kindRoll < 0.6 ? 'celular' : 'revisar'),
        email: unit.id === 'habita' ? `contacto@${C.slug(last)}.test` : '',
        instagram: r() < 0.3 ? `@${C.slug(last)}.ejemplo` : '',
        web: r() < 0.25 ? `${C.slug(last)}.test` : '',
        address: '', zone: pick(zones), segment: '',
        priority: 1 + Math.floor(r() * 3), score: Math.round(40 + r() * 60),
        sdr: unit.id === 'habita' ? pick(sdrs) : 'Axel',
        campaign: unit.id === 'turnia' ? (i < 140 ? 'Lista 1' : 'Lista 3') : (i < 100 ? 'Octubre' : 'Noviembre'),
        source: '', stage: 'por_contactar', stageRaw: '', nextStep: '', nextAt: '', touches: 0,
        firstContact: '', lastContact: '', lastChannel: '',
        demoUrl: unit.id === 'turnia' ? `https://turniasalud.vercel.app/p/${id}` : `https://habitaia.vercel.app/demo/ejemplo-${i + 1}`,
        demoOpened: '', demoTried: '', replied: '', interested: '', meeting: '', customer: '',
        lostReason: '', optOut: '', signals: '', notes: '', updated: '', extra: {},
      };
      accounts.push(a);
      // ~60% ya fue contactado en las últimas 4 semanas.
      if (i > n * 0.62 || (unit.id === 'turnia' && a.phoneKind === 'fijo' && r() < 0.8)) continue;
      const start = C.addDays(t, -Math.floor(r() * 26));
      const at = (day, h) => `${day} ${String(h).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
      let day = start;
      const ev = (type, extra = {}) => events.push({ at: at(day, 9 + Math.floor(r() * 6)), id, account: a.name, type, channel: 'whatsapp', template: '', detail: '', by: a.sdr, ...extra });
      a.firstContact = at(day, 9);
      if (unit.greetingFirst) {
        ev('saludo', { template: a.phoneKind === 'compartido' ? 'whatsapp_saludo_consultorio' : 'whatsapp_saludo' });
        a.stage = 'saludado';
        if (r() < 0.25 && C.daysBetween(day, t) < 3) { a.lastContact = a.firstContact; a.nextAt = C.addBusinessDays(day, 1); continue; }
        day = C.addDays(day, r() < 0.6 ? 0 : 1);
      }
      const steps = 1 + Math.floor(r() * 3);
      let replied = false;
      for (let s = 1; s <= steps && day <= t; s++) {
        const key = unit.id === 'turnia' ? (s === 1 ? 'whatsapp_1' : s === 2 ? 'whatsapp_2' : 'whatsapp_3') : `whatsapp_${s}`;
        ev('mensaje', { template: key });
        a.touches = s;
        a.lastContact = at(day, 10);
        a.stage = 'contactado';
        if (unit.id === 'turnia' && r() < 0.32) { a.demoOpened = at(day, 12); events.push({ at: a.demoOpened, id, account: a.name, type: 'abrio_demo', by: '' }); if (r() < 0.4) { a.demoTried = at(day, 13); a.demoClinic = a.demoTried; if (r() < 0.6) a.demoChat = at(day, 14); } }
        if (r() < (unit.id === 'turnia' ? 0.12 : 0.09)) { replied = true; break; }
        day = C.addBusinessDays(day, unit.cadence[Math.min(s - 1, unit.cadence.length - 1)]);
      }
      if (day > t) day = t;
      if (!replied) {
        a.nextAt = a.touches < unit.maxTouches ? C.addBusinessDays(C.dayOf(a.lastContact), unit.cadence[Math.min(a.touches - 1, unit.cadence.length - 1)]) : '';
        a.nextStep = a.touches < unit.maxTouches ? `Seguimiento ${a.touches + 1} de ${unit.maxTouches}` : 'Sin respuesta: no escribir más';
        if (r() < 0.04) { a.stage = 'baja'; a.optOut = a.lastContact; ev('baja'); }
        continue;
      }
      a.replied = at(day, 16);
      ev('respondio', { detail: 'Contestó por WhatsApp' });
      a.stage = 'respondio';
      a.nextAt = t;
      a.nextStep = 'Contestarle';
      const roll = r();
      if (roll < 0.28) { a.stage = 'perdido'; a.lostReason = 'Ya tiene una solución'; a.nextAt = ''; ev('perdido', { detail: a.lostReason }); continue; }
      if (roll < 0.62) continue;
      a.interested = a.replied; a.stage = 'interesado'; ev('interesado'); a.nextStep = 'Proponer reunión';
      if (r() < 0.55) { a.meeting = a.replied; a.stage = 'reunion'; ev('reunion'); a.nextAt = C.addBusinessDays(t, 1); a.nextStep = 'Reunión de 15 minutos'; }
      if (a.stage === 'reunion' && r() < 0.35) { a.customer = a.replied; a.stage = 'cliente'; a.nextAt = ''; a.nextStep = 'Onboarding'; ev('cliente'); }
    }
    for (const a of accounts) a.updated = C.nowLocal();
    events.sort((x, y) => x.at.localeCompare(y.at));
    return {
      accounts, events, templates: {},
      sheet: { title: 'Datos de ejemplo', tab: unit.tab, url: '', missingColumns: [] },
      readAt: new Date().toISOString(),
      signals: unit.id === 'turnia' ? { matched: accounts.filter((a) => a.demoOpened).length, total: accounts.length } : null,
    };
  }

  // Métricas de la app, de ejemplo (las de verdad salen de /api/metricas de cada una).
  const metrics = () => ({
    projects: {
      turnia: { uso: { clinicas: 2, clinicas_activas: 1 }, demos: { iniciadas: 31 }, pedidos: { pedidos: 6 } },
      'amobla-ia': { prospeccion: { vinculados: 4, activados: 2, clientes: 1, demos: { sent: 19, entered: 13, interacted: 7 } }, demos: { publicadas: 22 }, ingresos: { ingresos: 54000 } },
    },
    errors: {},
  });

  window.ProspectingFixture = { build, metrics };
})();
