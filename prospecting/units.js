// Las unidades de negocio sobre el panel base. El motor (core.js) es uno solo; acá
// va lo que cambia en cada una: ICP, propuesta de valor, cómo se nombran las etapas,
// las plantillas, la cadencia, quién entra en la cola y qué métricas del producto
// siguen al embudo comercial. Para sumar una unidad: copiar un bloque y su variable
// <ID>_PROSPECTING_SHEET_ID en Vercel.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProspectingUnits = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Una fecha cargada (no vacía ni «no»). */
  const isSet = (v) => Boolean(v) && !/^no$/i.test(String(v).trim());
  const lastName = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0] || '';
  /** Turnia: respondió el saludo (Paso 1). Las fechas son «AAAA-MM-DD HH:MM» de Buenos Aires: se comparan como texto. */
  const respondedGreeting = (a) => Boolean(a.permissionSent || a.replied) || ['respondio', 'interesado'].includes(a.stage)
    || Boolean(a.lastReply && a.lastReply > (a.greetingSent || a.firstContact || ''));

  // «Responder» de Turnia (10/11): lo que pasó en las respuestas reales y pide otra variante.
  const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /** Desconfían del link («no abrimos links», «parece una estafa»): no se insiste con el link. */
  const DISTRUST = /estafa|\bvirus\b|hacke|phishing|fraude|desconf[ií]|no (confiamos|conf[ií]o)|no (abrimos|abro|tocamos|toco|hacemos clic en|abrimos ning[uú]n) (los |ning[uú]n )?(links?|enlaces?)|(links?|enlaces?) (raros?|sospechos|de desconocidos)|parece (spam|una estafa|trucho)/i;
  /** El «no» ya trae el motivo: tienen un sistema («contamos con un sistema»). */
  const SYSTEM = /\b(sistema|software|programa|plataforma|aplicaci[oó]n|app|doctoralia|dentalink|agenda (online|web|electr[oó]nica)|bot|asistente( virtual)?)\b/i;
  /** El filtro de la recepción: «¿Ya hablaste con el Dr./la Dra. por esto?». */
  const ASKED_DOCTOR = /(hablaste|hablaron|charlaste|te comunicaste|te contactaste|lo consultaste|est[aá] al tanto|sabe(n)? de esto)\b.{0,40}\b(dr|dra|doc|doctor|doctora|odont[oó]log[oa]|con [eé]l|con ella|due[nñ]o|due[nñ]a)\b/i;
  /** ¿Contestó el profesional en persona? («Soy la Dra. …», «Soy Camila, ¿qué necesitabas?» si se llama Camila). */
  const isProfessional = (a, text) => {
    const t = fold(text);
    if (/\bsoy (el |la )?(dr|dra|doctor|doctora|odontolog[oa])\b/.test(t)) return true;
    const names = [fold(a.greeting).split(/\s+/)[0], fold(String(a.name || '').split(/\s+/)[0]), fold(lastName(a.name))].filter((n) => n && n.length >= 3);
    return names.some((n) => new RegExp(`\\bsoy (el |la )?(dr\\.? |dra\\.? )?${n.replace(/[^a-z]/g, '')}\\b`).test(t));
  };

  // ─── Turnia ─────────────────────────────────────────────────
  const turnia = {
    id: 'turnia',
    name: 'Turnia',
    color: 's3',
    sheetEnv: 'TURNIA_PROSPECTING_SHEET_ID',
    tabEnv: 'TURNIA_PROSPECTING_TAB',
    // La planilla que escribe la app de Turnia (espejo de su panel: se reescribe entera con
    // cada cambio). Por eso es de solo lectura: lo que se escribiera acá se perdería. Se opera
    // en el panel de Turnia, que tiene WhatsApp, las demos y su seguimiento.
    tab: 'Prospección',
    // Por eso las acciones no se escriben en la planilla: van a la API de Turnia (POST /api/prospeccion),
    // que aplica las mismas reglas que su panel y vuelve a copiar la planilla. Sin la clave, solo lectura.
    // Las filas, de su base (?vista=filas); sin eso (o si falla), de la planilla espejo.
    api: { urlEnv: 'TURNIA_PROSPECTING_API_URL', url: 'https://turniasalud.app/api/prospeccion', secretEnvs: ['TURNIA_PROSPECTING_SECRET', 'TURNIA_METRICS_SECRET'], rowsQuery: { vista: 'filas' } },
    appUrl: 'https://turniasalud.app/panel/prospeccion',
    appName: 'el panel de Turnia',
    // «Responder»: lo último que escribió cada uno sale de la lectura de WhatsApp de Turnia (?vista=filas → whatsappInbox).
    inbox: 'whatsapp',
    // La vista «Odontólogos»: la lista con el embudo de demos de habita. (de Facu), armada con estas cuentas.
    agencies: 'accounts',
    // Para cuando el panel escriba en una planilla propia: trae las señales de la app.
    signals: { env: 'TURNIA_SIGNALS_SHEET_ID', tab: 'Prospección', fields: ['demoOpened', 'demoTried', 'demoUrl'] },
    // En la planilla de Turnia, «Contactado» sin mensajes y con el saludo enviado es «saludado».
    // La lista sale de «Fuente» cuando empieza con «Lista N» (la planilla de Turnia no tiene columna Lista), y
    // «Hace Google Ads» o «anuncios en Instagram y Facebook» de «Señales»: los que pagan anuncios son los más
    // calientes y van primero en la cola.
    enrich: (a) => {
      if (a.stage === 'contactado' && !a.touches && a.greetingSent) a.stage = 'saludado';
      const list = /^\s*lista\s*(\d+)/i.exec(a.source || '');
      if (!a.campaign && list) a.campaign = `Lista ${list[1]}`;
      a.googleAds = /google ads/i.test(a.signals || '');
      a.metaAds = /meta ads|anuncios en (instagram|facebook)/i.test(a.signals || '');
      a.ads = a.googleAds || a.metaAds;
      return a;
    },
    metricsKey: 'turnia',
    dashboardHash: '#turnia',
    entity: { one: 'odontólogo', many: 'odontólogos', org: 'Consultorio' },
    icp: 'Odontólogos con consultorio propio en Mar del Plata, Miramar y la Costa; después Tucumán, La Rioja, Bahía Blanca y La Plata. Decide el profesional, no la recepción.',
    uvp: 'Sofi contesta el WhatsApp del consultorio y da turnos con su agenda cuando nadie puede atender: de noche, el fin de semana y en la temporada.',
    proof: 'Cada uno recibe su demo (/p/<código>) con el nombre de su consultorio: la prueba como si fuera un paciente.',
    sender: 'Axel, de Turnia',
    dailyGoal: 50,
    maxTouches: 3,
    // El Seguimiento 2 al día hábil siguiente del link; el 3, dos días hábiles después (48-72 h).
    cadence: [1, 2],
    window: 7,
    greetingFirst: true,
    hours: 'De 8:30 a 9:30 y de 13 a 14:30. Nunca después de las 21.',
    // Modo Enviar: franjas en las que se manda (hora de Buenos Aires) y pausa al azar entre envíos.
    sendWindows: [['08:30', '09:30'], ['13:00', '14:30']],
    pacing: [45, 90],
    rules: [
      'Siempre a la recepción: los teléfonos son los de los consultorios. Los mensajes nombran al odontólogo y le piden que se la pase a los doctores.',
      'Primero el saludo, sin link: un número desconocido que manda un link de entrada termina bloqueado. Cuando responde, el Paso 2 pide permiso (tampoco lleva link).',
      'El link va en el Paso 3 (dijo que sí) o, a las 24 horas sin respuesta, en el Seguimiento 1.',
      'Tres mensajes como máximo (el Paso 1 y el 2 no cuentan). Baja inmediata y para siempre ante cualquier «no me escribas».',
      'Nunca «vi que abriste la demo»: preguntá si llegó a probarla.',
      'Tu WhatsApp Business con el perfil de Turnia, no el chip de WAHA. Si aparece un aviso de restricción, frená por ese día.',
    ],
    objections: [
      ['¿Cuánto cuesta?', 'Depende de cuántos mensajes y turnos manejan. Primero probala; si te sirve, en 15 minutos te armo la propuesta.'],
      ['Ya tengo secretaria', 'No la reemplaza: cubre la noche, el fin de semana y los picos, y le deja los turnos dados.'],
      ['Uso Doctoralia / Dentalink', 'La integración todavía no está: en el piloto Sofi da turnos en los horarios que le reserves.'],
      ['¿Y si se equivoca?', 'Usa solo lo que cargás; lo que no sabe lo deja como tarea para una persona y ves todas las conversaciones.'],
    ],
    dims: [['zone', 'Zona'], ['priority', 'Prioridad'], ['phoneKind', 'Teléfono'], ['campaign', 'Lista'], ['sdr', 'SDR'], ['lastChannel', 'Canal']],
    stageNames: {
      por_contactar: 'Por contactar', saludado: 'Saludado', contactado: 'Demo enviada', respondio: 'Respondió', interesado: 'Interesado',
      reunion: 'Reunión', cliente: 'Cliente', perdido: 'No le interesa', invalido: 'No tiene WhatsApp', baja: 'Pidió no recibir más',
    },
    // Los fijos que no respondieron no cuentan (no tienen WhatsApp), como en el panel de Turnia.
    counted: (a) => a.phoneKind !== 'fijo' || Boolean(a.replied || a.demoOpened || a.demoTried),
    canMessage: (a) => Boolean(a.phone) && a.phoneKind !== 'fijo' && a.phoneKind !== 'revisar',
    demoLink: (a) => a.demoUrl || '',
    // La demo de cada persona es /p/<su código>: un mensaje con otro /p/… es la demo de otro consultorio.
    demoSlug: (url) => (/\/p\/([a-z0-9-]+)/i.exec(String(url || '')) || [])[1] || null,
    demoIsCode: true,
    vars: (a) => {
      const t = String(a.title || '').trim();
      return { destinatario: t ? `${/a\.?$/i.test(t) ? 'la' : 'el'} ${t} ${lastName(a.name)}` : a.name };
    },
    // La secuencia de WhatsApp (09/11), siempre a la recepción: el Paso 1, el 2 cuando responde, el link en el
    // Paso 3 (respondió el 2) o el Seguimiento 1 (no respondió), y los Seguimientos 2 y 3. Como en Turnia
    // (whatsappTemplateKey en src/lib/sales/outreach-messages.ts).
    nextTemplate(a) {
      if (a.stage === 'por_contactar') {
        if (a.phone && a.phoneKind !== 'fijo') return { key: 'whatsapp_abridor', kind: 'saludo', channel: 'whatsapp' };
        if (a.instagram) return { key: 'instagram', kind: 'mensaje', channel: 'instagram' };
        return { key: 'llamada', kind: 'llamada', channel: 'llamada' };
      }
      if (!['saludado', 'contactado', 'respondio'].includes(a.stage)) return null;
      const after = (x, y) => Boolean(x && y && String(x) > String(y));
      if (!a.touches) {
        if (!a.greetingSent) return { key: 'whatsapp_abridor', kind: 'saludo', channel: 'whatsapp' };
        if (!a.permissionSent) return { key: 'whatsapp_permiso', kind: 'mensaje', channel: 'whatsapp' };
        return { key: after(a.lastReply, a.permissionSent) ? 'whatsapp_entrega' : 'whatsapp_sin_respuesta', kind: 'mensaje', channel: 'whatsapp' };
      }
      // Después del link, si respondió, lo atiende una persona.
      if (after(a.lastReply, a.lastContact)) return null;
      if (a.touches === 1) return { key: 'whatsapp_seguimiento', kind: 'mensaje', channel: 'whatsapp' };
      if (a.touches === 2) return { key: 'whatsapp_reenviable', kind: 'mensaje', channel: 'whatsapp' };
      return null;
    },
    // Los de fábrica (los que valen salen de Turnia: Panel → Prospección → Mensajes). «---» separa dos mensajes.
    templates: {
      whatsapp_abridor: { title: 'Paso 1 · El abridor', hint: 'Siempre primero y sin link. No cuenta como uno de los tres mensajes.', channel: 'whatsapp', text: 'Buenas! Hablo con la recepción de {destinatario}?' },
      whatsapp_permiso: {
        title: 'Paso 2 · El gancho de permiso', hint: 'Cuando responden el Paso 1. Sin link; tampoco cuenta como uno de los tres.', channel: 'whatsapp',
        text: 'Qué tal! Soy Axel. Sé que en recepción viven a mil con el WhatsApp, así que les armé gratis una ayudante virtual cargada con los datos de {destinatario}.\n\nSirve para que conteste sola las preguntas repetidas de obras sociales, precios y horarios fuera de hora, así no llegan el lunes a la mañana con 100 mensajes atrasados.\n\nSeguro tiene algún error porque la armé rápido con la info que encontré en internet. ¿Te paso el link por acá y la probás 20 segundos como paciente a ver si le pifié en algo?',
      },
      whatsapp_permiso_turno: {
        title: 'Paso 2 · Si creen que sos un paciente', hint: 'Cuando contestan el Paso 1 como a un paciente («¿Es por un turno?»). Aclara que no y sigue como el Paso 2. Sin link; no cuenta.', channel: 'whatsapp',
        text: 'No, tranqui, no es por un turno! Soy Axel. Sé que en recepción viven a mil con el WhatsApp, así que les armé gratis una ayudante virtual cargada con los datos de {destinatario}.\n\nContesta sola las preguntas repetidas de obras sociales, precios y horarios, también fuera de hora, así no llegan el lunes a la mañana con 100 mensajes atrasados.\n\nSeguro tiene algún error porque la armé rápido con la info que encontré en internet. ¿Te paso el link por acá y la probás 20 segundos como paciente a ver si le pifié en algo?',
      },
      whatsapp_permiso_profesional: {
        title: 'Paso 2 · Si contesta el profesional', hint: 'Cuando el Paso 1 lo contesta el odontólogo en persona («Soy la Dra. …»). Le habla directo a él. Sin link; no cuenta.', channel: 'whatsapp',
        text: 'Qué tal! Soy Axel. Te armé gratis una ayudante virtual para el WhatsApp del consultorio, cargada con tus datos.\n\nContesta sola las preguntas repetidas de obras sociales, precios y horarios, también fuera de hora, y te rellena los huecos de turnos que se cancelan sobre la hora.\n\nSeguro tiene algún error porque la armé rápido con la info que encontré en internet. ¿Te paso el link por acá y la probás 20 segundos como si fueras un paciente?',
      },
      whatsapp_entrega: {
        title: 'Paso 3 · La entrega y el puente al médico', hint: 'Cuando dicen «Dale, pasame». Lleva el link de su demo.', channel: 'whatsapp',
        text: 'Acá tenés: {link}\n\nMandale un audio o escribile haciéndole alguna pregunta difícil como si fueras un paciente real!\n\nSi ves que responde bien, reenviale el link a los doctores: además de sacarte preguntas repetidas a vos, a ellos les rellena solos los huecos de turnos que se cancelan sobre la hora. Avisame si le encontraste algún error!',
      },
      whatsapp_entrega_profesional: {
        title: 'Paso 3 · Si es el profesional', hint: 'Cuando el profesional dice «Dale, pasame». Lleva el link, sin el «reenviáselo a los doctores».', channel: 'whatsapp',
        text: 'Acá tenés: {link}\n\nMandale un audio o escribile una pregunta difícil como si fueras un paciente real!\n\nSi te gusta cómo responde, en 15 minutos te muestro cómo quedaría con tu agenda. Avisame si le encontrás algún error!',
      },
      whatsapp_hablaste_doctor: {
        title: 'Paso 3 · «¿Ya hablaste con el doctor?»', hint: 'El filtro de la recepción: transparencia y el link.', channel: 'whatsapp',
        text: 'No, todavía no! Primero armé la prueba gratis con los datos públicos del consultorio, para que la puedan chusmear ustedes en recepción antes de molestar a {destinatario}. Acá tenés el link: {link}\n\nHacele una pregunta difícil como si fueras un paciente. Si ves que responde bien, ahí sí se la pasás!',
      },
      whatsapp_sin_respuesta: {
        title: 'Seguimiento 1 · Sin respuesta al Paso 2', hint: 'A las 24 horas del Paso 2: el link directo igual.', channel: 'whatsapp',
        text: 'Buenas! Sé que en recepción no paran un segundo, así que te dejo directo acá la prueba que armé para {destinatario} por si querés chusmear en 20 segundos si cargué bien los datos: {link}',
      },
      whatsapp_seguimiento: {
        title: 'Seguimiento 2 · A las 24 h del link', hint: 'Audio de unos 12 segundos: este es el guion.', channel: 'whatsapp',
        text: 'Buenas! ¿Cómo va? Te consulto rápido: ¿pudiste hacerle alguna pregunta difícil al link que te pasé ayer o mostrárselo a los doctores? Avisame si le pifié en alguna obra social así ya lo corrijo!',
      },
      whatsapp_reenviable: {
        title: 'Seguimiento 3 · El mensaje para reenviar', hint: 'A las 48-72 horas. Dos mensajes: el segundo, solo, para reenviar a los doctores. Después no se escribe más.', channel: 'whatsapp',
        text: 'Buenas! Para no robarte más tiempo a vos en recepción, te dejo acá abajo un resumen cortito listo por si querés tocar "Reenviar" y pasárselo directo al WhatsApp de los doctores así lo evalúan ellos:\n---\nHola Doc! Nos armaron esta prueba gratis cargada con los datos del consultorio: {link} . Es una asistente de IA para el WhatsApp que responde dudas de pacientes y obras sociales 24/7 sin menús robóticos, agenda turnos y rellena sola los huecos de cancelaciones. Probala haciéndole una pregunta como paciente.',
      },
      whatsapp_feedback: {
        title: 'Feedback de no interesados', hint: 'A quien respondió que no: una vez, cierra la charla. No cuenta como uno de los tres.', channel: 'whatsapp',
        text: 'Gracias por contestarme. No te escribo más. Si me decís en una línea por qué no te sirve, me ayudás un montón.',
      },
      whatsapp_feedback_sistema: {
        title: 'Feedback · Ya tienen un sistema', hint: 'Cuando el «no» ya trae el motivo: pregunta cuál usan, no por qué.', channel: 'whatsapp',
        text: 'Genial, gracias por contarme! No te escribo más. Si me decís en una línea qué sistema usan hoy, me ayudás un montón.',
      },
      whatsapp_feedback_desconfianza: {
        title: 'Si desconfían del link', hint: 'No insiste con el link: ofrece mostrarla en una llamada corta. No cierra la cuenta.', channel: 'whatsapp',
        text: 'Te entiendo, hacés bien en cuidarte con los links. No te mando nada más por acá. Si en algún momento te da curiosidad, te la muestro en una llamada de 5 minutos, sin tocar nada.',
      },
      instagram: { title: 'Instagram', hint: 'Sin link: los pedidos de mensaje con links se filtran.', channel: 'instagram', text: 'Hola {saludo}! Soy Axel, de Turnia. Armé una demo de Sofi con tu consultorio: contesta el WhatsApp cuando estás atendiendo o fuera de horario y da los turnos sola. ¿Te paso el link para probarla? Es un minuto.' },
      llamada: { title: 'Guion de llamada', hint: 'No se envía. El objetivo es el WhatsApp de quien decide.', channel: 'llamada', text: 'Hola, ¿qué tal? ¿Es el consultorio de {destinatario}? Soy Axel, de Turnia. Le preparé una demo de una asistente que contesta el WhatsApp del consultorio y da turnos cuando nadie puede atender. ¿Me pasás un WhatsApp para mandársela? Si es el de {saludo}, mejor: así la prueba directo.' },
    },
    // «Responder»: qué contestarle según lo que escribió (el orden importa: gana la primera que coincide).
    // Antes del link manda la secuencia (replyPlan); después, una de estas. Son sugerencias: se pueden cambiar.
    replies: [
      { key: 'derivacion', title: 'Pasó el número de otra persona', test: /(n[uú]mero|cel(u|ular)?|whats?app|contacto|wsp)\b[^.?!]*\b(dr|dra|doc|doctor|doctora|odont[oó]log[oa])\b|\b(dr|dra|doctor|doctora)\b[^.?!]*\b(n[uú]mero|cel(u|ular)?|whats?app|contacto)|\b(\+?54)?\s?9?\s?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4}\b/i,
        text: '¡Mil gracias! Le escribo directo así no te robo más tiempo.' },
      { key: 'error', title: 'Encontró un error en la demo', test: /se equivoc|est[aá] mal|no es as[ií]|dijo mal|no atendemos|no trabajamos con|error/i,
        text: '¡Gracias por avisarme! Decime qué dato estaba mal y lo corrijo hoy mismo. Lo que no sabe, Sofi lo deja como tarea para una persona del consultorio.' },
      { key: 'precio', title: 'Pregunta el precio', test: /cu[aá]nto (sale|cuesta|cobr|vale)|precio|costo|tarifa|abono|\$/i,
        text: 'Depende de cuántos mensajes y turnos manejan. Primero probala; si les sirve, en 15 minutos te armo la propuesta con {destinatario}. ¿Le pudiste pasar el link?' },
      { key: 'secretaria', title: 'Ya tienen secretaria', test: /secretari|recepcionista|ya (tenemos|tengo) (a )?alguien|lo hacemos nosotr/i,
        text: 'No la reemplaza: cubre la noche, el fin de semana y los picos, y le deja los turnos dados. Justamente les saca de encima las preguntas repetidas.' },
      { key: 'software', title: 'Usan otra agenda', test: /doctoralia|dentalink|agenda (online|web)|sistema de turnos|ya usamos/i,
        text: 'La integración todavía no está: en el piloto Sofi da turnos en los horarios que le reserven, y ustedes los pasan a su agenda. Si les sirve, lo vemos en 15 minutos.' },
      { key: 'mas_adelante', title: 'Más adelante', test: /m[aá]s adelante|despu[eé]s (lo|te)|ahora no|otro momento|lo vemos|lo charlo|lo consulto|le (digo|comento|paso) al? (dr|doc)/i,
        text: 'Dale, ningún problema. Si mientras tanto la quieren probar, el link queda acá: {link}' },
      { key: 'interesado', title: 'Le gustó', test: /me gust|est[aá] (buen|genial|b[aá]rbar)|interesante|interesad|c[oó]mo (sigue|seguimos|funciona)|quiero|nos (sirve|interesa)|muy bien|excelente|copado/i,
        text: '¡Qué bueno! ¿Te parece si coordinamos 15 minutos con {destinatario} para armarla con su agenda? ¿Qué día y horario les queda cómodo?' },
      { key: 'negativo', title: 'Dijo que no', test: null, template: 'whatsapp_feedback' },
      { key: 'default', title: 'Respuesta general', test: null,
        text: '¡Gracias por responder! ¿Pudieron probarla haciéndole una pregunta como paciente? Si les sirve, en 15 minutos te muestro cómo quedaría con su agenda.' },
    ],
    // Antes del link manda la secuencia: el Paso 2 (o su variante si creyeron que eras un paciente) y, si respondió
    // el Paso 2, el Paso 3 con la demo. Un «no, gracias» va al feedback y cierra. Después del link, `replies`.
    // Variantes (10/11): si contesta el profesional en persona, si la recepción pregunta si ya hablaste con el
    // doctor, y si el «no» ya trae el motivo (ya tienen un sistema) o desconfían del link.
    replyPlan(a, inbound, { pick, negative }) {
      const text = String((inbound && inbound.text) || '');
      const lost = { type: 'outcome', outcome: 'perdido', detail: text.slice(0, 200) };
      if (DISTRUST.test(text)) return { key: 'whatsapp_feedback_desconfianza', template: 'whatsapp_feedback_desconfianza', register: { type: 'conversation', detail: 'Desconfían del link' } };
      if (negative && SYSTEM.test(text)) return { key: 'whatsapp_feedback_sistema', template: 'whatsapp_feedback_sistema', register: { type: 'conversation', detail: 'Feedback: ya tienen un sistema' }, then: lost };
      if (negative) return { key: 'whatsapp_feedback', template: 'whatsapp_feedback', register: { type: 'conversation', detail: 'Feedback de no interesados' }, then: lost };
      if (a.touches) return null;
      const deriv = pick('derivacion');
      if (deriv && deriv.test.test(text)) return { key: 'derivacion', reply: deriv, register: { type: 'conversation', detail: deriv.title } };
      if (ASKED_DOCTOR.test(text)) return { key: 'whatsapp_hablaste_doctor', template: 'whatsapp_hablaste_doctor', register: { type: 'sent', template: 'whatsapp_hablaste_doctor' } };
      const pro = isProfessional(a, text);
      if (a.greetingSent && !a.permissionSent) {
        const patient = /\bturnos?\b|paciente|para cu[aá]ndo|qu[eé] (d[ií]a|fecha|horario)|obra social|primera vez|consulta (de|por|para)|una urgencia/i.test(text);
        const key = pro ? 'whatsapp_permiso_profesional' : patient ? 'whatsapp_permiso_turno' : 'whatsapp_permiso';
        return { key, template: key, register: { type: 'sent', template: key } };
      }
      if (a.permissionSent) {
        const key = pro ? 'whatsapp_entrega_profesional' : 'whatsapp_entrega';
        return { key, template: key, register: { type: 'sent', template: key } };
      }
      return null;
    },
    // Embudo con metas: la base es por semana; cada paso, la conversión esperada del anterior.
    // Los pasos son las etapas de su Follow-up (11/11): Saludado (Contactados), Demo enviada, Demo visitada,
    // Conversó con Sofi, Cuenta creada, Cuenta activa y Cliente. Cada paso incluye a los siguientes.
    // «demos_enviadas» es una clave nueva (antes «demos» era el % sobre «Respondieron el saludo»): así una
    // meta guardada con la definición vieja no se aplica a la nueva.
    // Después del saludo, lo que hicieron en el período las inmobiliarias prospectadas, saludadas cuando sea
    // (/api/metricas de habita, prospeccion.periodo): una demo enviada hoy a una saludada la semana pasada cuenta hoy.
    targets: [
      { key: 'saludos', label: 'Contactados', hint: 'Les llegó el saludo (Paso 1)', perWeek: 250, sheet: (a) => Boolean(a.greetingSent || a.firstContact) },
      { key: 'demos_enviadas', label: 'Demos enviadas', hint: 'El link: Paso 3 o Seguimiento 1', rate: 0.15, sheet: (a) => a.touches >= 1 },
      { key: 'visitadas', label: 'Demos visitadas', hint: 'Abrieron su demo (/p/…)', rate: 0.65, sheet: (a) => Boolean(a.demoOpened || a.demoTried || a.demoClinic) },
      { key: 'interaccion', label: 'Conversaron con Sofi', hint: 'Conversaron con Sofi en su demo', rate: 0.5, sheet: (a) => Boolean(a.demoChat) },
      { key: 'cuentas', label: 'Cuentas creadas', hint: 'Crearon su cuenta de Turnia', rate: 0.45, sheet: (a) => isSet(a.accountAt) },
      { key: 'activas', label: 'Cuentas activas', hint: 'La cuenta ya opera (con turnos)', rate: 0.8, sheet: (a) => isSet(a.accountActive) },
      { key: 'clientes', label: 'Clientes', hint: 'Setup y mes 1 cobrados («Cliente» en Turnia)', rate: 0.6, sheet: (a) => Boolean(a.customer) || isSet(a.clientAt) || a.stage === 'cliente' },
    ],
    // Qué etapa de la cola de Follow-up lleva a cada paso del embudo contra la meta (el índice de `targets`):
    // el Resumen cruza cuánto se ejecutó cada etapa con cuánto convirtió su paso.
    queueSteps: { 'sin-saludo': 0, 'saludo-sin-demo': 1, 'demo-sin-abrir': 2, 'abrio-sin-conversar': 3, 'converso-sin-cuenta': 4, 'cuenta-sin-actividad': 5, 'activa-sin-pago': 6 },
    // Las versiones de su demo personal (/p/<código>), para ver cuál convierte mejor. El corte es el de
    // turniasalud src/lib/demo-version.ts (el deploy de #138, en hora de Argentina): si cambia, cambiar los dos.
    demoVersions: [
      { key: 'con_probar', label: 'A · Con «Probar la demo»', when: 'hasta el 07/11', until: '2026-11-07 12:30', steps: 'Abrió → tocó «Probar la demo» → eligió voz o chat → habló con Sofi' },
      { key: 'esfera', label: 'B · Pantalla única con la esfera', when: 'desde el 07/11', from: '2026-11-07 12:30', steps: 'Abrió → tocó la esfera (empieza la charla) → habló con Sofi' },
    ],
    // Posventa: las garantías del Programa Fundadores (src/content/precios.ts en Turnia).
    onboarding: { setupDays: 14, firstMonthInteractions: 50 },
    // Lo que sigue al embudo comercial, desde /api/metricas de Turnia (totales, sin datos personales).
    product: [
      { label: 'Demos de Sofi', path: 'demos.iniciadas', hint: 'Web, WhatsApp o llamada' },
      { label: 'Pedidos de demo', path: 'pedidos.pedidos' },
      { label: 'Clínicas activas', path: 'uso.clinicas_activas', hint: 'Con turnos en 30 días' },
      { label: 'Turnos que tomó Sofi', path: 'uso.turnos' },
    ],
  };

  // ─── habita. ────────────────────────────────────────────────
  const habita = {
    id: 'habita',
    name: 'habita.',
    color: 's2',
    sheetEnv: 'HABITA_PROSPECTING_SHEET_ID',
    tabEnv: 'HABITA_PROSPECTING_TAB',
    tab: 'Prospectos',
    // La base es la de la app (/admin/prospeccion): la planilla solo la alimenta (cada hora, con
    // scripts/prospeccion-sync.gs). Con la clave, las cuentas y cada acción van por la API de habita.
    // (las mismas reglas que su panel); los mensajes y las metas siguen en la planilla. Sin la clave,
    // el panel opera sobre la planilla como antes.
    api: { urlEnv: 'HABITA_PROSPECTING_API_URL', url: 'https://www.habitaia.app/api/prospeccion', secretEnvs: ['HABITA_PROSPECTING_SECRET', 'HABITA_METRICS_SECRET'], rows: true, sync: true, templates: false, targets: false, fallback: 'sheet' },
    appUrl: 'https://www.habitaia.app/admin/prospeccion',
    // Prospectos: las inmobiliarias antes de la cola, con su ranking y los aprendizajes (GET ?vista=prospectos de su API).
    pool: true,
    appName: 'el panel de habita.',
    // «Responder»: las respuestas abiertas de su bandeja de Follow-up (las registra su extensión de WhatsApp o el equipo).
    inbox: 'bandeja',
    // La lista «Inmobiliarias» de su equipo (/admin/inmobiliarias), tal cual, en la vista Inmobiliarias.
    agencies: true,
    // La sincronización de la planilla con habita. (scripts/prospeccion-sync.gs) lee «Fecha envío» solo como día.
    dayColumns: ['firstContact'],
    metricsKey: 'amobla-ia',
    dashboardHash: '#amobla-ia',
    entity: { one: 'inmobiliaria', many: 'inmobiliarias', org: 'Inmobiliaria' },
    icp: 'Inmobiliarias con cartera activa publicada en portales (Argenprop, Zonaprop), con propiedades vacías o mal fotografiadas. Decide el dueño o quien lleva lo comercial.',
    uvp: 'Sus propiedades amobladas con IA en segundos, sin home staging: avisos que se destacan, más consultas y un sitio propio con su catálogo.',
    proof: 'Una demo comercial con sus propias propiedades amobladas, lista para mostrarle al dueño.',
    sender: 'el equipo de habita.',
    dailyGoal: 40,
    maxTouches: 3,
    cadence: [3, 4],
    window: 7,
    greetingFirst: false,
    hours: 'De 9 a 12:30 y de 15 a 18, días hábiles.',
    sendWindows: [['09:00', '12:30'], ['15:00', '18:00']],
    pacing: [45, 90],
    rules: [
      'Solo a contactos verificados: un número «por revisar» primero se confirma.',
      'Abrir WhatsApp o el mail no es enviar: el contacto cuenta cuando confirmás que salió.',
      'Las respuestas se registran con evidencia (qué dijo). Abrir la demo nunca cuenta como interés.',
      'Tres pasos de secuencia como máximo; si responde, se pasa a conversación.',
      'Bajas por cuenta, canal o contacto: nunca se borran, se levantan con motivo.',
    ],
    objections: [
      ['¿Cuánto sale?', 'Se paga por foto con créditos; primero mirá la demo con tus propiedades y lo vemos con tus números.'],
      ['¿Se nota que es IA?', 'Respeta la arquitectura de la foto y la exportación puede llevar la etiqueta de amoblamiento virtual.'],
      ['Ya hacemos home staging', 'Para las propiedades vacías que no lo justifican: en segundos y sin mover un mueble.'],
      ['No tengo tiempo', 'La demo ya está armada con tus avisos: son dos minutos para verla.'],
    ],
    dims: [['sdr', 'SDR'], ['segment', 'Grupo'], ['zone', 'Zona'], ['campaign', 'Campaña'], ['lastChannel', 'Canal']],
    stageNames: {
      por_contactar: 'Pendiente', saludado: 'Saludado', contactado: 'Enviado', respondio: 'Respondió', interesado: 'Interesado',
      reunion: 'Reunión', cliente: 'Cliente', perdido: 'No interesado', invalido: 'Número incorrecto', baja: 'Baja',
    },
    canMessage: (a) => (Boolean(a.phone) && !['revisar', 'fijo'].includes(a.phoneKind)) || Boolean(a.email),
    demoLink: (a) => a.demoUrl || '',
    // Cualquier link a una demo de habita.: el mensaje solo puede llevar la de esta inmobiliaria.
    demoSlug: (url) => (/habitaia\.app\/[^\s?#]*demo[^\s?#]*/i.exec(String(url || '')) || [])[0] || null,
    // «Responder»: la respuesta abierta en la bandeja de habita. se cierra con su clasificación (la de su
    // Follow-up: confirmo_numero, interesado, neutro, pregunta_precios, mas_adelante, derivo, rechazo).
    replies: [
      { key: 'derivacion', title: 'Pasó el contacto de otra persona', classification: 'derivo', test: /(n[uú]mero|cel(u|ular)?|whats?app|contacto|wsp|escribile|hablá con)\b[^.?!]*\b(dueñ|socio|encargad|martiller|corredor|gerente)|\b(\+?54)?\s?9?\s?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4}\b/i,
        text: '¡Mil gracias! Le escribo directo.' },
      { key: 'negativo', title: 'Dijo que no', classification: 'rechazo', test: null,
        text: 'Gracias por contestarme, {saludo}. No te escribo más. Si me decís en una línea por qué no te sirve, me ayudás un montón.' },
      { key: 'precio', title: 'Pregunta el precio', classification: 'pregunta_precios', test: /cu[aá]nto (sale|cuesta|cobr|vale)|precio|costo|tarifa|abono|\$/i,
        text: 'Se paga por foto con créditos, sin abono fijo. Para verlo con tus números, ¿te muestro la demo con tus propiedades en 10 minutos esta semana?' },
      { key: 'mas_adelante', title: 'Más adelante', classification: 'mas_adelante', test: /m[aá]s adelante|despu[eé]s (lo|te)|ahora no|otro momento|lo vemos/i,
        text: 'Perfecto, {saludo}. Te escribo más adelante. Si mientras tanto la querés ver, la demo con tus propiedades está acá: {link}' },
      { key: 'interesado', title: 'Le interesa', classification: 'interesado', test: /me gust|est[aá] (buen|genial|b[aá]rbar)|interesante|interesad|c[oó]mo (sigue|seguimos|funciona)|quiero|nos (sirve|interesa)|muy bien|excelente|copado/i,
        text: '¡Genial, {saludo}! ¿Te muestro en 10 minutos cómo hacerlo con toda tu cartera? Decime qué día y horario te queda cómodo.' },
      { key: 'confirmo', title: 'Confirmó el número', classification: 'confirmo_numero', test: /^\W*(s[ií]|hola|buenas|buen d[ií]a|qu[eé] tal|con qui[eé]n)\b.{0,40}$/i,
        text: '¡Hola, {saludo}! Te escribo de habita.: tomamos algunas propiedades de {inmobiliaria} y las amoblamos con IA para que veas cómo quedarían los avisos: {link}' },
      { key: 'default', title: 'Respuesta general', classification: 'neutro', test: null,
        text: '¡Gracias por responder, {saludo}! ¿Pudiste ver la demo con tus propiedades? Si querés, te muestro en 10 minutos cómo hacerlo con toda tu cartera.' },
    ],
    nextTemplate(a) {
      const channel = a.phone && !['revisar', 'fijo'].includes(a.phoneKind) ? 'whatsapp' : a.email ? 'email' : null;
      if (!channel || a.stage === 'respondio' || (a.stage !== 'por_contactar' && a.stage !== 'contactado')) return null;
      const step = Math.min((a.touches || 0) + 1, 4);
      if (step > 3) return null;
      return { key: `${channel}_${step}`, kind: 'mensaje', channel };
    },
    templates: {
      whatsapp_1: {
        title: 'Paso 1 · WhatsApp', hint: 'Primer contacto con la demo armada.', channel: 'whatsapp',
        text: 'Hola {saludo}, ¿cómo estás? Te escribo de habita.\nTomamos algunas propiedades de {inmobiliaria} y las amoblamos con IA, para que veas cómo quedarían los avisos: {link}\nEn segundos y sin home staging. Si te sirve, te muestro cómo hacerlo con toda tu cartera. Y si no, avisame y no te escribo más.',
      },
      whatsapp_2: {
        title: 'Paso 2 · WhatsApp', hint: 'Tres días hábiles después, si no respondió.', channel: 'whatsapp',
        text: 'Hola {saludo}, te escribo de nuevo por si quedó tapado. Las fotos amobladas suelen traer más consultas que las de ambientes vacíos.\nLa demo con tus propiedades sigue acá: {link}\n¿Te la muestro en 10 minutos esta semana?',
      },
      whatsapp_3: { title: 'Paso 3 · WhatsApp', hint: 'Último paso. Después no se escribe más.', channel: 'whatsapp', text: 'Hola {saludo}, último mensaje. ¿Te muestro la demo en 10 minutos o lo dejamos acá? Las dos respuestas están perfectas.' },
      email_1: {
        title: 'Paso 1 · Email', hint: 'Cuando no hay WhatsApp verificado.', channel: 'email', subject: 'Las propiedades de {inmobiliaria}, amobladas',
        text: 'Hola {saludo},\n\nTomamos algunas propiedades de {inmobiliaria} y las amoblamos con IA para que veas cómo quedarían los avisos:\n{link}\n\nSe hace en segundos, sin home staging, y respeta la arquitectura de cada foto. Si te sirve, te muestro en 10 minutos cómo hacerlo con toda la cartera.\n\nSi no te interesa, respondé «no» y no te escribo más.\n\nSaludos,\nhabita.',
      },
      email_2: { title: 'Paso 2 · Email', hint: 'Tres días hábiles después.', channel: 'email', subject: 'Re: las propiedades de {inmobiliaria}', text: 'Hola {saludo},\n\nTe reenvío la demo por si quedó abajo de otros mails: {link}\n\n¿Te la muestro en 10 minutos esta semana?\n\nSaludos,\nhabita.' },
      email_3: { title: 'Paso 3 · Email', hint: 'Último paso.', channel: 'email', subject: '¿Lo dejamos acá?', text: 'Hola {saludo},\n\nÚltimo mail, prometido. ¿Te muestro la demo en 10 minutos o lo dejamos acá?\n\nSaludos,\nhabita.' },
    },
    targets: [
      { key: 'saludos', label: 'Contactados', hint: 'Les llegó el primer mensaje', perWeek: 250, sheet: (a) => Boolean(a.firstContact) || a.stage !== 'por_contactar' && a.stage !== 'invalido' && a.stage !== 'baja' },
      { key: 'interesados', label: 'Interesados', hint: 'Mostraron interés o recibieron la demo por primera vez en el período', rate: 0.2, metrics: 'prospeccion.periodo.interesados' },
      { key: 'demos_enviadas', label: 'Demos enviadas', hint: 'Inmobiliarias prospectadas a las que se les envió la demo en el período', rate: 0.75, metrics: 'prospeccion.periodo.demosEnviadas' },
      { key: 'visitadas', label: 'Demos visitadas', hint: 'Abrieron su demo por primera vez en el período', rate: 0.6, metrics: 'prospeccion.periodo.visitadas' },
      { key: 'interaccion', label: 'Demos con interacción', hint: 'Hicieron algo más que abrir su demo (interactuaron, descargaron, generaron) en el período', rate: 0.5, metrics: 'prospeccion.periodo.conInteraccion' },
      { key: 'cuentas', label: 'Cuentas creadas', hint: 'Crearon o reclamaron su cuenta en el período', rate: 0.5, metrics: 'prospeccion.periodo.cuentas' },
      { key: 'activas', label: 'Cuentas activas', hint: 'Primera ambientación propia en el período', rate: 0.5, metrics: 'prospeccion.periodo.activas' },
      { key: 'pagos', label: 'Clientes', hint: 'Primer pago aprobado en el período', rate: 0.25, metrics: 'prospeccion.periodo.clientes' },
    ],
    // Qué etapa de la cola de Follow-up lleva a cada paso del embudo contra la meta (el índice de `targets`).
    // Los pasos son las etapas de su Follow-up: Contactado, Interesado, Demo enviada, Demo visitada, Demo con
    // interacción, Cuenta creada, Cuenta activa y Cliente (13/11: se sumaron visitada e interacción, como en
    // Turnia). «cuentas» reemplaza a «cuentas_creadas» porque su % ahora es sobre «Demos con interacción»
    // (0,6 × 0,5 × 0,5 = el mismo 15% de antes sobre las demos enviadas): una meta guardada con la base vieja no se aplica.
    // Cada inmobiliaria cuenta en el período en que llegó por primera vez al paso (amoblaia periodActivity).
    queueSteps: { 'no-contactado': 0, 'no-responde': 1, 'sin-demo': 2, 'sin-enviar': 2, 'no-abrio': 3, 'sin-interaccion': 4, 'sin-cuenta': 5, 'sin-uso': 6, 'sin-suscripcion': 7 },
    product: [
      { label: 'Demos publicadas', path: 'demos.publicadas' },
      { label: 'Vinculadas', path: 'prospeccion.vinculados', hint: 'Crearon o reclamaron su cuenta' },
      { label: 'Activadas', path: 'prospeccion.activados', hint: 'Primera ambientación propia' },
      { label: 'Ingresos', path: 'ingresos.ingresos', format: 'money' },
    ],
  };

  const UNITS = { turnia, habita };
  for (const u of Object.values(UNITS)) {
    u.stageLabel = (k) => u.stageNames[k] || k;
  }

  return { UNITS, list: () => Object.values(UNITS), get: (id) => UNITS[id] || null };
});
