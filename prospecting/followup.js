// La bandeja comercial de todas las unidades: junta la cola de Follow-up que arma cada app
// (habita.: amoblaia src/lib/followup; Turnia: turniasalud src/lib/sales/followup-queue.ts) en una
// sola forma, para verlas juntas, filtrarlas y operarlas. No decide nada: las etapas, las reglas,
// los bloqueos, las tomas y los resultados son los de cada app. Puro: lo usan el navegador y los tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProspectingFollowup = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRIORITY = { alta: 0, media: 1, baja: 2 };
  const GROUPS = ['respuestas', 'demos', 'seguimientos', 'nuevos'];
  const GROUP_LABEL = { respuestas: 'Respuestas para atender', demos: 'Demos pendientes', seguimientos: 'Seguimientos', nuevos: 'Contactos nuevos' };
  const PRIORITY_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  // Los pasos de las secuencias de habita. (Turnia ya manda la etiqueta).
  const ACTION_LABEL = { principal: 'Mensaje de la etapa', seguimiento_2: 'Seguimiento 2', presentacion: 'Presentación', presentacion_seguimiento: 'Presentación sin respuesta', precios: 'Precios' };

  const live = (claim, now) => Boolean(claim && claim.until && Date.parse(claim.until) > now);

  /** Una persona o inmobiliaria de la cola de una unidad, en la forma común. */
  function item(unit, q, snap, bucket, now = Date.now()) {
    const labels = (snap && snap.labels) || {};
    const titles = Object.fromEntries(((snap && snap.stages) || []).map((s) => [s.key, s.title]));
    const goals = Object.fromEntries(((snap && snap.stages) || []).map((s) => [s.key, s.goal]));
    const isHabita = unit === 'habita';
    // «Next best action» es el nombre genérico del paso principal en habita.: se muestra a qué lleva.
    const label = isHabita ? q.actionLabel || q.action || '' : q.action || '';
    const action = /^next best action$/i.test(label) && goals[q.stage] ? `Llevar a: ${goals[q.stage]}` : label;
    return {
      unit,
      key: `${unit}:${q.agencyId || q.id}`,
      id: q.agencyId || q.id,
      code: q.code || '',
      name: q.name || '',
      sub: q.person || q.business || '',
      shortName: q.shortName || q.name || '',
      person: q.person || '',
      website: q.website || '',
      properties: Number.isFinite(Number(q.properties)) ? Number(q.properties) : null,
      address: q.address || '',
      wa: Boolean(q.wa),
      needsReview: Boolean(q.needsReview),
      window: q.window || null,
      lastAction: q.lastAction || null,
      zone: q.zone || '',
      phone: q.phone || '',
      stage: q.stage,
      stageTitle: q.stageTitle || titles[q.stage] || q.stage || '',
      situation: q.situation || '',
      catalogSituation: q.catalogSituation || null,
      productSituations: q.productSituations || [],
      ruleKey: q.ruleKey || null,
      situationLabel: q.situationLabel || (labels.situations && labels.situations[q.situation]) || q.situation || '',
      situationNote: q.situationNote || '',
      // habita.: la acción es una clave («presentacion») con su etiqueta; Turnia manda la etiqueta.
      action,
      actionKey: isHabita ? q.action || null : null,
      actionReason: q.actionReason || '',
      group: GROUPS.includes(q.group) ? q.group : 'seguimientos',
      priority: PRIORITY[q.priority] !== undefined ? q.priority : 'media',
      priorityManual: Boolean(q.priorityManual),
      owner: q.owner || '',
      since: (q.lastAction && q.lastAction.at) || q.lastContactAt || q.since || '',
      lastText: (q.lastAction && q.lastAction.text) || '',
      blocked: q.blocked || null,
      dueAt: q.dueAt || null,
      snoozedUntil: q.snoozedUntil || null,
      claim: live(q.claim, now) ? { by: q.claim.by, until: q.claim.until } : null,
      versionId: q.versionId || null,
      ads: Boolean(q.ads),
      score: q.score === undefined ? null : q.score,
      demoUrl: q.demoUrl || '',
      execution: q.execution || null,
      bucket,
    };
  }

  /**
   * Preserve a previously verified snapshot only when a transient upstream error
   * occurs. The caller limits the previous snapshot's age before passing it in.
   * No fabricated queue or empty catalog is ever substituted for a failed read.
   */
  function mergeUnits(previous, incoming) {
    const next = { ...(previous || {}) };
    for (const [unit, snapshot] of Object.entries(incoming || {})) {
      if (snapshot?.error && next[unit] && !next[unit].error) {
        next[unit] = {
          ...next[unit],
          __warning: snapshot.error,
          __freshness: { stale: true, source: 'previous', ageMs: null },
        };
      } else {
        next[unit] = snapshot;
      }
    }
    return next;
  }

  /** La cola de cada unidad ({ habita: snapshot, turnia: snapshot }) en una sola forma. */
  function normalize(units, now = Date.now()) {
    const out = { queue: [], scheduled: [], blocked: [], noInteresados: [], errors: {}, units: {} };
    for (const [unit, snap] of Object.entries(units || {})) {
      if (!snap || snap.error) { out.errors[unit] = (snap && snap.error) || 'Sin datos.'; continue; }
      if (snap.__warning) out.errors[unit] = 'Mostrando datos anteriores (no actualizados): ' + snap.__warning;
      out.units[unit] = snap;
      out.queue.push(...(snap.queue || []).map((q) => item(unit, q, snap, 'cola', now)));
      out.scheduled.push(...(snap.scheduled || []).map((q) => item(unit, q, snap, 'programada', now)));
      out.blocked.push(...(snap.blocked || []).filter((q) => q.stage).map((q) => item(unit, q, snap, 'bloqueada', now)));
      out.noInteresados.push(...(snap.noInteresados || []).map((q) => item(unit, q, snap, 'cerrada', now)));

    }
    out.queue.sort(byPriority);
    out.scheduled.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    out.blocked.sort(byPriority);
    return out;
  }

  /**
   * Mismo modelo de navegación de Habita: etapa comercial -> pasos técnicos.
   * Los pasos técnicos nunca se renombran ni mutan en el motor de origen.
   * Turnia utiliza el mismo gesto/interacción y sus etapas específicas.
   */
  const COMMERCIAL = {
    habita: [
      ['prospectado', 'Prospectado', ['no-contactado']],
      ['contactado', 'Contactado', ['no-responde']],
      ['interesado', 'Interesado', ['sin-demo', 'sin-enviar']],
      ['demo-enviada', 'Demo enviada', ['no-abrio', 'sin-interaccion', 'sin-cuenta']],
      ['cuenta-creada', 'Cuenta creada', ['sin-uso']],
      ['cuenta-activa', 'Cuenta activa', ['sin-suscripcion']],
      ['cliente', 'Cliente', []],
    ],
    turnia: [
      ['prospectado', 'Prospectado', ['sin-saludo']],
      ['saludado', 'Saludado', ['saludo-sin-demo']],
      ['demo-enviada', 'Demo enviada', ['demo-sin-abrir']],
      ['demo-visitada', 'Demo visitada', ['abrio-sin-conversar']],
      ['converso', 'Conversó con Sofi', ['converso-sin-cuenta']],
      ['cuenta-creada', 'Cuenta creada', ['cuenta-sin-actividad']],
      ['cuenta-activa', 'Cuenta activa', ['activa-sin-pago']],
      ['cliente', 'Cliente', []],
    ],
  };

  function commercialStages(unit, snap) {
    if (!snap) return [];
    const funnel = snap.funnel || [];
    const stageBase = COMMERCIAL[unit] || (snap.stages || []).map(s => [s.key, s.title, [s.key]]);
    const last = funnel.at(-1);
    const clientReached = last && last.rate != null ? Math.round(Number(last.reached || 0) * last.rate) : 0;
    const stages = stageBase.map(([key, title, technical], index) => {
      const first = funnel.find(s => s.key === technical[0]);
      const reached = first ? Number(first.reached || 0) : clientReached;
      const waiting = technical.length
        ? technical.reduce((n,k)=>n + Number(funnel.find(s=>s.key===k)?.waiting || 0),0) : reached;
      const nextTechnical = stageBase[index+1]?.[2]?.[0];
      const nextReached = nextTechnical ? Number(funnel.find(s=>s.key===nextTechnical)?.reached || 0) : null;
      return { key, title, technical, reached, waiting, rate: nextReached===null || !reached ? null : Math.min(1,nextReached/reached) };
    });
    if (unit === 'habita' || unit === 'turnia') {
      for(const s of (snap.catalog?.stages || []))
        stages.push({ key:s.key, title:s.label, technical:[s.technical_stage],
          waiting:Number(s.waiting||0), reached:0, rate:null, situation:s.entry_situation });
    }
    return stages;
  }

  /** Misma estructura de inbox en ambas unidades; el texto siempre proviene del motor de origen. */
  function inboxItems(normalized, scope = 'todas') {
    if (!normalized) return [];
    const out=[];
    for(const [unit,snap] of Object.entries(normalized.units||{})){
      if(scope!=='todas' && scope!==unit)continue;
      for(const r of snap.inbox || []){
        if(unit==='habita')out.push({
          unit, key:unit+':reply:'+r.id, replyId:r.id, id:r.agency_id,
          name:r.name||'Inmobiliaria', phone:r.phone||'', stage:r.stage||'',
          body:r.body||'', receivedAt:r.received_at||'', status:r.status||'pendiente',
          classification:r.classification||'', confidence:r.confidence,
          note:r.note||'', situation:r.situation||'', actionable:true,
        });
        else out.push({
          unit, key:unit+':reply:'+r.id, replyId:null, id:r.id,
          name:r.name||'Contacto', phone:r.phone||'', stage:r.stage||'',
          body:r.latestReply||r.situationNote||'', receivedAt:r.latestReplyAt||r.lastContactAt||r.since||'',
          status:'pendiente', classification:r.situation||'', confidence:null,
          note:r.situationNote||'', situation:r.situation||'', actionable:true,
        });
      }
    }
    return out.sort((a,b)=>String(a.receivedAt).localeCompare(String(b.receivedAt)));
  }

  /** Prioridad, grupo, lo que nadie tomó, los que pagan anuncios y los que esperan hace más. */
  function byPriority(a, b) {
    return PRIORITY[a.priority] - PRIORITY[b.priority]
      || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)
      || Number(Boolean(a.claim)) - Number(Boolean(b.claim))
      || Number(b.ads) - Number(a.ads)
      || (b.score ?? -1) - (a.score ?? -1)
      || String(a.since).localeCompare(String(b.since));
  }

  /** Filtros de la bandeja: unidad, responsable, prioridad, grupo y texto. */
  function filter(list, f = {}) {
    const q = String(f.q || '').trim().toLowerCase();
    return list.filter((x) =>
      (!f.unit || f.unit === 'todas' || x.unit === f.unit)
      && (!f.owner || (f.owner === '—' ? !x.owner : x.owner === f.owner))
      && (!f.priority || x.priority === f.priority)
      && (!f.group || x.group === f.group)
      && (!q || `${x.name} ${x.sub} ${x.zone} ${x.code} ${x.stageTitle} ${x.situationLabel} ${x.phone}`.toLowerCase().includes(q)));
  }

  /** Los contadores de arriba, sumados entre las unidades que se ven. */
  function summary(n, unit) {
    const keys = ['ready', 'replies', 'demos', 'scheduled', 'blocked', 'claimed', 'doneToday', 'newToday'];
    const out = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const [u, snap] of Object.entries(n.units)) {
      if (unit && unit !== 'todas' && u !== unit) continue;
      for (const k of keys) out[k] += Number((snap.summary || {})[k]) || 0;
    }
    return out;
  }

  /** Lo que lleva cada operación sobre la tarea: los mismos campos en las dos apps. */
  function taskFields(it) {
    const out = { inmobiliaria: it.id, etapa: it.stage, version: it.versionId };
    if (it.actionKey) out.tarea = it.actionKey;
    return out;
  }

  /** La respuesta de «Ejecutar» (claim) de cualquiera de las dos apps, en una forma común. */
  function prepared(unit, r, base) {
    if (!r) return null;
    const message = r.message || '';
    const messages = Array.isArray(r.messages) && r.messages.length ? r.messages : message.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
    const it = base || (r.item ? item(unit, r.item, null, 'cola') : null);
    return {
      unit,
      id: r.agencyId || r.id || (it && it.id),
      name: r.name || (it && it.name) || '',
      phone: r.phone || (it && it.phone) || '',
      stage: r.stage || (it && it.stage),
      actionKey: unit === 'habita' ? r.action || null : null,
      actionLabel: r.actionLabel || (it && it.action) || '',
      versionId: r.versionId || null,
      version: r.version || null,
      channel: r.channel || 'whatsapp',
      message,
      messages,
      ready: r.ready !== false,
      whatsappUrl: r.whatsappUrl || (r.whatsapp && r.whatsapp.web) || null,
      warnings: r.warnings || [],
      checklist: r.checklist || [],
      history: r.history || [],
      notes: r.notes || '',
      links: r.links || {},
      lockedUntil: r.lockedUntil || null,
      item: it,
    };
  }

  /** Las versiones de cada etapa con sus números, iguales para las dos apps. */
  function versionRows(unit, snap) {
    const rows = [];
    const habitaResults = unit === 'habita' && snap.results && snap.results.windows && snap.results.windows.todo ? snap.results.windows.todo.versions || [] : null;
    for (const s of snap.stages || []) {
      for (const v of s.versions || []) {
        const r = habitaResults && habitaResults.find((x) => x.versionId === v.id);
        const st = v.stats || {};
        const executed = r ? r.executed : st.executions || 0;
        const conversions = r ? r.conversions : st.conversions || 0;
        rows.push({
          unit,
          id: v.id,
          stage: s.key,
          stageTitle: s.title,
          action: v.action || 'principal',
          actionLabel: ACTION_LABEL[v.action || 'principal'] || v.action,
          version: v.version,
          status: v.status,
          channel: v.channel,
          body: v.body,
          notes: v.notes || '',
          trigger: v.trigger_label || v.trigger || '',
          executed,
          conversions,
          rate: executed ? conversions / executed : null,
          medianHours: r ? r.medianHours : null,
          small: executed > 0 && executed < 30,
          best: Boolean(r && r.best),
        });
      }
    }
    return rows;
  }

  /** Las reglas (habita.: editables; Turnia: la cadencia de su panel), en filas. */
  function ruleRows(unit, snap) {
    const labels = (snap.labels && snap.labels.situations) || {};
    const catalogLabels=Object.fromEntries((snap.catalog?.states||[]).map(s=>[s.key,s.label]));
    const titles = Object.fromEntries((snap.stages || []).map((s) => [s.key, s.title]));
    return (snap.rules || []).map((r) => ({
      unit,
      key: r.key || r.stage,
      stage: r.stage,
      stageTitle: r.title || titles[r.stage] || r.stage,
      when: r.catalog_situation ? (catalogLabels[r.catalog_situation]||r.catalog_situation) :
        Array.isArray(r.situations) ? (r.situations.length ? r.situations.map((s) => labels[s] || s).join(', ') : 'Cualquier situación') : 'Al entrar en la etapa',
      action: r.action_label || ACTION_LABEL[r.action] || r.action || '',
      wait: r.wait || (r.after_hours !== undefined ? (r.after_hours ? `${r.after_hours} h desde nuestro último mensaje` : 'Enseguida') : ''),
      window: r.hours_from !== undefined ? `${r.hours_from} a ${r.hours_to} h` : '',
      exit: r.exit || '',
      enabled: r.enabled !== false,
      editable: unit === 'habita' && Boolean(r.key),
      raw: r,
    }));
  }

  /** Envíos y conversiones por quien ejecutó, de todas las unidades. */
  function actorRows(n, unit) {
    const rows = [];
    for (const [u, snap] of Object.entries(n.units)) {
      if (unit && unit !== 'todas' && u !== unit) continue;
      for (const a of (snap.results && snap.results.byActor) || []) rows.push({ unit: u, ...a });
    }
    return rows.sort((a, b) => b.executions - a.executions);
  }

  /**
   * La lectura diaria de WhatsApp de una unidad (hoy solo Turnia: lee los chats de sus dos líneas de
   * WAHA y abre las respuestas nuevas), lista para mostrar. null si la unidad no la tiene.
   */
  function whatsapp(n, unit = 'turnia') {
    const snap = n && n.units && n.units[unit];
    if (!snap || !('whatsapp' in snap)) return null;
    const r = snap.whatsapp;
    if (!r) return { unit, never: true, lines: [], pending: [], totals: null, at: null };
    const lines = (r.lines || []).map((l) => ({
      line: l.line,
      ok: l.status === 'ok',
      text: l.status === 'ok'
        ? `${l.prospects || 0} de la base con chat${l.unread ? ` (${l.unread} sin leer: se completan en la próxima)` : ''}`
        : l.status === 'sin_configurar' ? 'Sin conectar: falta su WAHA en Turnia' : l.problem || 'No se pudo leer',
    }));
    const pending = (r.pending || []).map((p) => {
      const it = (n.queue.concat(n.scheduled, n.blocked)).find((x) => x.unit === unit && x.code === p.code);
      return { ...p, key: it ? it.key : null };
    });
    return { unit, never: false, at: r.at, trigger: r.trigger || '', totals: r.totals || {}, lines, pending };
  }

  return { whatsapp, GROUPS, GROUP_LABEL, PRIORITY_LABEL, ACTION_LABEL, COMMERCIAL, commercialStages, inboxItems, item, normalize, byPriority, filter, summary, taskFields, prepared, versionRows, ruleRows, actorRows };
});
