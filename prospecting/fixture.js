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
        ev('saludo', { template: unit.id === 'turnia' ? 'whatsapp_abridor' : 'whatsapp_saludo' });
        a.stage = 'saludado';
        if (r() < 0.25 && C.daysBetween(day, t) < 3) { a.lastContact = a.firstContact; a.nextAt = C.addBusinessDays(day, 1); continue; }
        day = C.addDays(day, r() < 0.6 ? 0 : 1);
      }
      const steps = 1 + Math.floor(r() * 3);
      let replied = false;
      for (let s = 1; s <= steps && day <= t; s++) {
        const key = unit.id === 'turnia' ? (s === 1 ? 'whatsapp_entrega' : s === 2 ? 'whatsapp_seguimiento' : 'whatsapp_reenviable') : `whatsapp_${s}`;
        ev('mensaje', { template: key });
        a.touches = s;
        a.lastContact = at(day, 10);
        // Algunos seguimientos salieron como audio (sin tocar el azar, para no cambiar el resto del ejemplo).
        if (unit.id === 'turnia' && s >= 2 && i % 4 === 0) a.audioAt = a.lastContact;
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
    // Turnia: algunas cuentas reales vinculadas (las que llegaron a reunión o cliente).
    if (unit.id === 'turnia') {
      accounts.filter((a) => a.stage === 'reunion' || a.stage === 'cliente').slice(0, 3).forEach((a, i) => {
        a.accountAt = a.meeting || a.replied;
        a.accountClinic = `Clínica de ejemplo ${i + 1}`;
        a.clientAt = C.addDays(t, -[20, 9, 3][i]) + ' 10:00';
        if (i === 0) { a.operationalAt = C.addDays(t, -12) + ' 11:00'; a.firstMonth = 31; a.accountActive = C.nowLocal(); }
        if (i === 1) { a.operationalAt = C.addDays(t, -2) + ' 09:00'; a.firstMonth = 2; a.accountActive = C.nowLocal(); }
      });
    }
    // «Responder»: respuestas de ejemplo, sin tocar el azar del resto (todo ficticio).
    let lineOptions = null;
    let inboxReplies = null;
    const ago = (h) => C.nowLocal(new Date(Date.now() - h * 3600000));
    if (unit.id === 'turnia') {
      lineOptions = ['0022', '5483'];
      const said = (a, i, text, extra = {}) => {
        const inAt = ago(Math.max(1, 10 - i));
        // Lo nuestro, antes de su respuesta (si el ejemplo lo había puesto más tarde, se corre).
        if (!a.lastContact || a.lastContact >= inAt) { a.lastContact = ago(30 + i); if (!a.firstContact || a.firstContact > a.lastContact) a.firstContact = a.lastContact; }
        a.lastReply = inAt;
        if (a.stage === 'saludado' || a.stage === 'contactado') a.stage = 'respondio';
        a.whatsappSenders = [lineOptions[i % 2]];
        a.chats = [{ line: lineOptions[i % 2], inAt, inText: text, outAt: a.lastContact || a.firstContact, lastFromMe: false, received: 1, sent: Math.max(1, a.touches), automatic: false, ...extra }];
      };
      const greeted = accounts.filter((a) => a.stage === 'saludado').slice(0, 5);
      greeted.forEach((a) => { a.greetingSent = a.firstContact; a.lastContact = a.lastContact || a.firstContact; });
      [['Hola, sí, ¿es por un turno?'], ['Sí, es la recepción. ¿Quién habla?'], ['Buenas, ¿para cuándo sería el turno?'], ['Gracias por comunicarte con el consultorio!', { automatic: true }]].forEach(([text, extra], i) => greeted[i] && said(greeted[i], i, text, extra));
      if (greeted[3]) greeted[3].botOnly = true;
      // Respondió el Paso 2.
      if (greeted[4]) { greeted[4].permissionSent = ago(40); greeted[4].lastContact = greeted[4].permissionSent; said(greeted[4], 4, 'Dale, pasame el link'); }
      const linked = accounts.filter((a) => a.stage === 'contactado' && a.touches >= 1 && a.phoneKind !== 'fijo').slice(0, 5);
      ['¿Cuánto sale por mes?', 'Me gustó, ¿cómo sigue?', 'No, gracias. Por ahora no.', 'Te paso el WhatsApp de la Dra: 223 000-9999'].forEach((text, i) => linked[i] && said(linked[i], i + 5, text));
      // Una respuesta cargada a mano (la línea 5483 todavía no se lee).
      if (linked[4]) { linked[4].stage = 'respondio'; linked[4].whatsappSenders = ['5483']; linked[4].manualReply = { at: ago(5), text: '¿Esto lo puede usar el Dr. también?', by: 'Axel' }; linked[4].lastReply = linked[4].manualReply.at; }
      // Dos profesionales con el mismo número: una sola fila.
      if (greeted[1] && linked[0]) linked[0].phone = greeted[1].phone;
    } else {
      const sent = accounts.filter((a) => a.stage === 'contactado' && a.phoneKind === 'celular').slice(0, 4);
      inboxReplies = ['¿Cuánto sale por foto?', 'Me interesa, ¿cómo sigue?', 'No gracias, no estamos interesados', 'Hablá con el dueño, te paso su número: 11 0000-1234']
        .map((text, i) => sent[i] && ({ id: `ej-reply-${i}`, agency_id: sent[i].id, body: text, received_at: new Date(Date.now() - (20 - i * 3) * 3600000).toISOString(), classification: null, name: sent[i].name, phone: sent[i].phone }))
        .filter(Boolean);
    }
    for (const a of accounts) a.updated = C.nowLocal();
    events.sort((x, y) => x.at.localeCompare(y.at));
    return {
      accounts, events, templates: {},
      whatsappSenderOptions: lineOptions || undefined,
      whatsappReadAt: lineOptions ? ago(2) : undefined,
      inboxReplies: inboxReplies || undefined,
      sheet: { title: 'Datos de ejemplo', tab: unit.tab, url: '', missingColumns: [] },
      readAt: new Date().toISOString(),
      signals: unit.id === 'turnia' ? { matched: accounts.filter((a) => a.demoOpened).length, total: accounts.length } : null,
      clinics: unit.id === 'turnia' ? [1, 2, 3, 4].map((i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, name: `Clínica de ejemplo ${i}` })) : null,
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

  // habita. · la lista «Inmobiliarias» con inmobiliarias ficticias (mismas formas que su API).
  function agencies() {
    const names = ['Inmobiliaria Costa Azul', 'Propiedades del Puerto', 'Bosque Peralta Ramos Propiedades', 'Güemes Inmuebles', 'Alem Bienes Raíces', 'Playa Grande Propiedades', 'La Perla Inmobiliaria', 'Constitución Negocios', 'Punta Mogotes Inmuebles', 'Chauvin Propiedades', 'Centro Inmobiliario Mar', 'QA Habita', 'Los Troncos Bienes', 'San Carlos Inmuebles'];
    const stages = ['prospect', 'contacted', 'demo_sent', 'demo_sent', 'interacted', 'interacted', 'panel', 'client', 'contacted', 'prospect', 'demo_sent', 'interacted', 'panel', 'demo_sent'];
    const steps = [0, 0, 1, 1, 2, 3, 5, 6, 0, null, 1, 3, 4, 2];
    const now = Date.now();
    const rows = names.map((name, i) => {
      const step = steps[i];
      const created = new Date(now - (i * 2 + 1) * 86400000).toISOString();
      const demos = step === null ? [] : [{ id: `d${i}`, sent: step >= 1, createdAt: created, step }, ...(i % 4 === 0 && step !== null ? [{ id: `d${i}b`, sent: false, createdAt: new Date(now - (i * 2 + 9) * 86400000).toISOString(), step: Math.min(step, 1) }] : [])];
      return {
        id: `ej-${i}`, name, coverPhotoId: null, stage: stages[i], hasOwner: step >= 4, subscribed: step === 6, prospect: true,
        properties: demos.length + (i % 3), published: demos.length, score: step >= 2 ? 30 + step * 9 : null,
        lastActivity: { at: new Date(now - i * 9 * 3600000).toISOString(), text: step >= 2 ? 'Vio una demo' : step === 1 ? 'Recibió la demo' : 'Creada en adquisición' },
        createdAt: new Date(now - (i + 3) * 86400000).toISOString(), test: /^QA/.test(name), demos,
        wa: i % 5 === 3 ? null : `549223${String(5000000 + i * 12345).slice(0, 7)}`, shareDemo: step >= 1 ? { id: `d${i}`, token: `tok${i}` } : null,
      };
    });
    return { rows, toReview: [{ id: 'ej-2', name: 'Bosque Peralta Ramos Propiedades', claim_email: 'bosque.propiedades@gmail.com', claim_review: 'personal' }], app: 'https://www.habitaia.app' };
  }

  window.ProspectingFixture = { build, metrics, agencies };
})();
