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

  const lastName = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0] || '';

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
      whatsapp_entrega: {
        title: 'Paso 3 · La entrega y el puente al médico', hint: 'Cuando dicen «Dale, pasame». Lleva el link de su demo.', channel: 'whatsapp',
        text: 'Acá tenés: {link}\n\nMandale un audio o escribile haciéndole alguna pregunta difícil como si fueras un paciente real!\n\nSi ves que responde bien, reenviale el link a los doctores: además de sacarte preguntas repetidas a vos, a ellos les rellena solos los huecos de turnos que se cancelan sobre la hora. Avisame si le encontraste algún error!',
      },
      whatsapp_sin_respuesta: {
        title: 'Seguimiento 1 · Sin respuesta al Paso 2', hint: 'A las 24 horas del Paso 2: el link directo igual.', channel: 'whatsapp',
        text: 'Buenas! Sé que en recepción no paran un segundo, así que te dejo directo acá la prueba que armé para {destinatario} por si querés chusmear en 20 segundos si cargué bien los datos: {link}',
      },
      whatsapp_seguimiento: {
        title: 'Seguimiento 2 · A las 24 h del link', hint: 'Audio de unos 12 segundos: este es el guion.', channel: 'whatsapp',
        text: 'Buenas! ¿Cómo va? Che, te consulto rápido: ¿pudiste hacerle alguna pregunta difícil al link que te pasé ayer o mostrárselo a los doctores? Avisame si le pifié en alguna obra social así ya lo corrijo!',
      },
      whatsapp_reenviable: {
        title: 'Seguimiento 3 · El mensaje para reenviar', hint: 'A las 48-72 horas. Dos mensajes: el segundo, solo, para reenviar a los doctores. Después no se escribe más.', channel: 'whatsapp',
        text: 'Buenas! Para no robarte más tiempo a vos en recepción, te dejo acá abajo un resumen cortito listo por si querés tocar "Reenviar" y pasárselo directo al WhatsApp de los doctores así lo evalúan ellos:\n---\nHola Doc! Nos armaron esta prueba gratis cargada con los datos del consultorio: {link} . Es una asistente de IA para el WhatsApp que responde dudas de pacientes y obras sociales 24/7 sin menús robóticos, agenda turnos y rellena sola los huecos de cancelaciones. Probala haciéndole una pregunta como paciente.',
      },
      instagram: { title: 'Instagram', hint: 'Sin link: los pedidos de mensaje con links se filtran.', channel: 'instagram', text: 'Hola {saludo}! Soy Axel, de Turnia. Armé una demo de Sofi con tu consultorio: contesta el WhatsApp cuando estás atendiendo o fuera de horario y da los turnos sola. ¿Te paso el link para probarla? Es un minuto.' },
      llamada: { title: 'Guion de llamada', hint: 'No se envía. El objetivo es el WhatsApp de quien decide.', channel: 'llamada', text: 'Hola, ¿qué tal? ¿Es el consultorio de {destinatario}? Soy Axel, de Turnia. Le preparé una demo de una asistente que contesta el WhatsApp del consultorio y da turnos cuando nadie puede atender. ¿Me pasás un WhatsApp para mandársela? Si es el de {saludo}, mejor: así la prueba directo.' },
    },
    // Embudo con metas: la base es por semana; cada paso, la conversión esperada del anterior.
    // Modelo comercial de Turnia (Programa Fundadores): nadie compra sin una llamada de 15 minutos y el
    // setup se cobra 100% antes de implementar. Por eso el embudo termina en «setup cobrado»; crear la
    // cuenta y que opere es posventa (vista Onboarding, con las garantías).
    targets: [
      { key: 'saludos', label: 'Saludos enviados', perWeek: 250, sheet: (a) => Boolean(a.greetingSent || a.firstContact) },
      { key: 'demos', label: 'Demos enviadas', rate: 0.15, sheet: (a) => a.touches >= 1 },
      { key: 'visitadas', label: 'Visitadas', hint: 'Abrieron su demo (/p/…)', rate: 0.65, sheet: (a) => Boolean(a.demoOpened || a.demoTried || a.demoClinic) },
      { key: 'interaccion', label: 'Hablaron con Sofi', hint: 'Conversaron con Sofi en su demo', rate: 0.5, sheet: (a) => Boolean(a.demoChat) },
      { key: 'llamadas', label: 'Llamadas agendadas', hint: 'Reunión de 15 minutos («Reunión» en Turnia)', rate: 0.45, sheet: (a) => Boolean(a.meeting) || a.stage === 'reunion' },
      { key: 'fundadores', label: 'Clientes Fundadores', hint: 'Setup y mes 1 cobrados («Cliente» en Turnia)', rate: 0.5, sheet: (a) => Boolean(a.customer) || a.stage === 'cliente' },
    ],
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
    appName: 'el panel de habita.',
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
      { key: 'saludos', label: 'Saludos enviados', perWeek: 250, sheet: (a) => Boolean(a.firstContact) || a.stage !== 'por_contactar' && a.stage !== 'invalido' && a.stage !== 'baja' },
      { key: 'demos', label: 'Demos enviadas', hint: 'Demos publicadas de las cuentas prospectadas', rate: 0.15, metrics: 'prospeccion.demos.sent' },
      { key: 'visitadas', label: 'Visitadas', hint: 'Entraron a su demo', rate: 0.65, metrics: 'prospeccion.demos.entered' },
      { key: 'interaccion', label: 'Con interacción', hint: 'Interactuaron con su demo', rate: 0.5, metrics: 'prospeccion.demos.interacted' },
      { key: 'cuentas', label: 'Cuentas creadas', hint: 'Crearon o reclamaron su cuenta', rate: 0.5, metrics: 'prospeccion.vinculados' },
      { key: 'activas', label: 'Cuentas activas', hint: 'Primera ambientación propia', rate: 0.5, metrics: 'prospeccion.activados' },
      { key: 'pagos', label: 'Clientes pagos', hint: 'Primer pago aprobado', rate: 0.25, metrics: 'prospeccion.clientes' },
    ],
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
