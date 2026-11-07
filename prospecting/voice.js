// Turnia · Odontólogos. La sesión de Turnia autoriza el envío; el panel público
// de Chapa y el navegador no tienen la clave de WAHA.
(function () {
  'use strict';

  const origin = 'https://turniasalud.app';
  const apiUrl = origin + '/api/prospeccion/audio';
  const selectionKey = 'cl-pr-turnia-voice-notes';
  const initialSender = '5483';
  const dialog = document.createElement('dialog');
  dialog.className = 'voice-dialog glass strong';
  dialog.setAttribute('aria-labelledby', 'voice-title');
  dialog.innerHTML = `
    <div class="card-head"><div><h2 id="voice-title">Audios de seguimiento</h2>
      <p class="sub">Elegí una etapa y su nota de voz. La misma grabación sirve para ambas líneas.</p></div>
      <form method="dialog"><button class="btn ghost" aria-label="Cerrar audios">Cerrar</button></form></div>
    <p role="status" data-status></p>
    <button class="btn primary" type="button" data-authorize>Autorizar con Turnia</button>
    <section class="voice-rules" aria-labelledby="voice-rules-title">
      <h3 id="voice-rules-title">Reglas de envío</h3>
      <p class="sub" data-rules-summary>Autorizá con Turnia para ver el cupo disponible y ajustar las tandas y las pausas.</p>
      <p class="sub">Horario de 8 a 21 h de Buenos Aires. El cupo diario se comparte entre las dos líneas. El 5483 se elige al abrir y el 0022 personal requiere tu selección.</p>
      <div data-rules-details>
        <form data-rules-form>
          <fieldset data-rules-fields disabled>
            <div class="voice-fields">
              <label class="field">Audios por día entre ambas líneas<input name="dailyLimit" type="number" min="1" step="1" required></label>
              <label class="field">Contactos por tanda<input name="batchSize" type="number" min="1" step="1" required></label>
              <label class="field">Espera mínima entre envíos (segundos)<input name="pauseMinSeconds" type="number" min="1" max="3600" step="1" required></label>
              <label class="field">Espera máxima entre envíos (segundos)<input name="pauseMaxSeconds" type="number" min="1" max="3600" step="1" required></label>
            </div>
            <p class="sub">Una tanda es el grupo que seleccionás y confirmás de una vez. Chapa elige una pausa entre el mínimo y el máximo antes del próximo contacto. Estos ajustes se aplican a ambas líneas.</p>
            <button class="btn small" type="submit">Guardar reglas</button>
          </fieldset>
          <p class="sub" role="status" data-rules-status></p>
        </form>
      </div>
      <p class="sub">Las pausas y los cupos ordenan el envío. WhatsApp puede restringir cuentas que usan automatización.</p>
    </section>
    <div data-voice-controls hidden>
      <div class="voice-fields">
        <label class="field">Etapa<select data-group>
          <option value="no_abrio">Recibieron la demo y no la abrieron</option>
          <option value="abrio">Abrieron la demo y no hablaron con Sofi</option>
          <option value="hablo">Hablaron con Sofi</option>
        </select></label>
        <label class="field">Audio para esta etapa<select data-note></select></label>
      </div>
      <div class="btns">
        <button class="btn small" type="button" data-preview>Escuchar audio</button>
        <button class="btn small" type="button" data-test>Mandarme una prueba</button>
      </div>
      <audio controls preload="none" data-player hidden></audio>
      <details><summary>Grabar o subir otro audio</summary>
        <form data-upload>
          <label class="field">Nombre del audio<input name="label" maxlength="80" required placeholder="Ej. Ya habló con Sofi"></label>
          <div class="btns">
            <button class="btn" type="button" data-record>Grabar</button>
            <label class="field">O elegí un archivo<input type="file" accept="audio/*,.opus,.ogg,.webm,.m4a,.mp3" data-file></label>
          </div>
          <audio controls preload="none" data-draft hidden></audio>
          <button class="btn" type="submit" data-save>Guardar para esta etapa</button>
        </form>
      </details>
      <label class="field">Texto previo opcional<textarea data-text rows="2" maxlength="500" placeholder="Usá {saludo} y {link} para personalizarlo"></textarea></label>
      <fieldset data-contacts>
        <legend>Destinatarios</legend>
        <label class="field">Enviar desde<select data-emitter></select></label>
        <label class="field">Chats iniciados desde<select data-sender-filter></select></label>
        <p class="sub">Confirmá una línea si ya le escribiste desde ese número. La búsqueda de chats muestra sugerencias para revisar. Las reglas de arriba se aplican a cada tanda.</p>
        <div class="btns"><button class="btn small" type="button" data-detect>Buscar chats para revisar</button></div>
        <button class="btn small" type="button" data-pick>Armar una tanda</button>
        <p class="sub" data-count></p>
        <p class="sub" data-selection></p>
        <div class="voice-list" data-people></div>
      </fieldset>
      <div class="btns">
        <button class="btn primary" type="button" data-send>Revisar tanda</button>
        <button class="btn" type="button" data-adjust>Cambiar tanda y pausa</button>
        <button class="btn" type="button" data-stop hidden>Detener los próximos envíos</button>
      </div>
      <div data-review role="group" aria-label="Confirmar tanda" hidden>
        <p data-summary></p>
        <div class="btns">
          <button class="btn ghost" type="button" data-back>Volver a la selección</button>
          <button class="btn primary" type="button" data-confirm>Confirmar envío</button>
        </div>
      </div>
    </div>`;
  document.body.append(dialog);

  const el = (name) => dialog.querySelector(`[data-${name}]`);
  const group = el('group');
  const note = el('note');
  const emitter = el('emitter');
  const form = el('upload');
  const rulesForm = el('rules-form');
  let preferred = {};
  try { preferred = JSON.parse(localStorage.getItem(selectionKey)) || {}; } catch { /* almacenamiento desactivado */ }
  let token = '';
  let popup;
  let info;
  let generation = 0;
  let busy = false;
  let running = false;
  let reviewing = false;
  let rulesDirty = false;
  let adjustAfterSend = false;
  let suggested = new Set();
  let paused = false;
  let recorder;
  let draft;
  let draftUrl;
  let previewUrl;

  function message(text) { el('status').textContent = text; }

  function resetDraft(blob) {
    if (draftUrl) URL.revokeObjectURL(draftUrl);
    draft = blob;
    draftUrl = draft && URL.createObjectURL(draft);
    el('draft').hidden = !draftUrl;
    if (draftUrl) el('draft').src = draftUrl;
    else el('draft').removeAttribute('src');
  }

  function selected() {
    return [...el('people').querySelectorAll('input:checked')];
  }

  function selectionLimit() {
    return Math.min(info?.remaining || 0, info?.rules?.batchSize || 0);
  }

  function readRules() {
    const value = (key) => Number(rulesForm.elements.namedItem(key).value);
    return {
      dailyLimit: value('dailyLimit'), batchSize: value('batchSize'),
      pauseMinMinutes: value('pauseMinSeconds') / 60, pauseMaxMinutes: value('pauseMaxSeconds') / 60,
    };
  }

  function pauseLabel(rules) {
    const min = Math.round(rules.pauseMinMinutes * 60);
    const max = Math.round(rules.pauseMaxMinutes * 60);
    return min % 60 === 0 && max % 60 === 0
      ? `${min / 60} a ${max / 60} minutos` : `${min} a ${max} segundos`;
  }

  function renderRules() {
    if (!info?.rules) return;
    const rules = info.rules;
    rulesDirty = false;
    el('rules-status').textContent = '';
    const fields = {
      dailyLimit: rules.dailyLimit, batchSize: rules.batchSize,
      pauseMinSeconds: Math.round(rules.pauseMinMinutes * 60),
      pauseMaxSeconds: Math.round(rules.pauseMaxMinutes * 60),
    };
    for (const [key, value] of Object.entries(fields)) rulesForm.elements.namedItem(key).value = String(value);
    el('rules-summary').textContent = `Hoy se usaron ${info.used} de ${rules.dailyLimit} audios y quedan ${info.remaining}. Cada tanda tiene hasta ${rules.batchSize} contactos y pausas de ${pauseLabel(rules)}.`;
  }

  function focusRules() {
    reviewing = false;
    controls();
    rulesForm.scrollIntoView({ block: 'center', behavior: 'smooth' });
    rulesForm.elements.namedItem('batchSize').focus({ preventScroll: true });
  }

  function controls() {
    el('authorize').hidden = Boolean(token);
    el('voice-controls').hidden = !token;
    const locked = busy || running || reviewing || Boolean(recorder);
    group.disabled = locked || rulesDirty;
    note.disabled = locked || rulesDirty;
    emitter.disabled = locked || rulesDirty;
    el('rules-fields').disabled = locked || !token || !info?.rules;
    rulesForm.querySelector('button[type=submit]').classList.toggle('primary', rulesDirty);
    el('save').disabled = locked || !info?.ready;
    el('file').disabled = locked;
    el('record').disabled = (busy || running || !info?.ready) && !recorder;
    el('preview').disabled = locked || !note.value;
    el('test').disabled = locked || !info?.ready || !info.testTo || !note.value;
    el('contacts').disabled = locked || !info || rulesDirty;
    el('detect').disabled = locked || !info?.ready;
    if (info?.sender) el('detect').textContent = `Buscar chats del ${info.sender} para revisar`;
    el('text').disabled = locked;
    el('stop').hidden = !running;
    el('adjust').disabled = busy || Boolean(recorder) || !info?.rules;
    el('adjust').textContent = running ? 'Detener y cambiar ajustes' : 'Cambiar tanda y pausa';
    el('review').hidden = !reviewing;
    el('send').hidden = reviewing || running;
    el('pick').disabled = locked || rulesDirty || !info?.ready || !selectionLimit() || !el('people').querySelector('input:not(:disabled)');
    const n = selected().length;
    el('send').disabled = locked || rulesDirty || !info?.ready || !note.value || !n || n > selectionLimit();
    el('pick').textContent = rulesDirty ? 'Guardá las reglas para aplicar la tanda' : selectionLimit() ? `Armar tanda de hasta ${selectionLimit()}` : 'Armar una tanda';
    el('selection').textContent = rulesDirty ? 'Guardá los ajustes de tanda y pausa para aplicarlos.' : info?.rules ? `Elegidos ${n} · máximo ${selectionLimit()} en esta tanda` : '';
    el('send').textContent = rulesDirty ? 'Guardá los ajustes antes de enviar' : n ? `Revisar tanda de ${n}` : 'Revisar tanda';
  }

  async function request({ query, body, binary } = {}) {
    const url = new URL(apiUrl);
    for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
    const multipart = body instanceof FormData;
    const headers = { Authorization: `Bearer ${token}` };
    if (body && !multipart) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { headers, method: body ? 'POST' : 'GET', body: multipart ? body : body ? JSON.stringify(body) : undefined });
    if (r.ok && binary) return r.blob();
    const data = await r.json().catch(() => ({}));
    if (r.ok) return data;
    if (r.status === 401) {
      token = '';
      info = null;
      controls();
    }
    const error = new Error(data.error || 'Turnia no pudo completar la operación.');
    if (r.status === 429 && Number.isInteger(data.retryAfter) && data.retryAfter > 0 && data.retryAfter <= 3600) {
      error.retryAfter = data.retryAfter;
    }
    throw error;
  }

  function renderPeople() {
    if (!info) return;
    const filter = el('sender-filter').value;
    const rows = info.people.filter((row) =>
      filter === 'all' || (filter === 'unknown' ? !row.senders.length : row.senders.includes(filter)));
    el('people').replaceChildren(...rows.map((row) => {
      const line = document.createElement('div');
      line.className = 'voice-person';
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = row.id;
      box.disabled = row.sent || !info.ready || !note.value || !row.senders.includes(info.sender);
      const source = row.senders.length ? 'Desde ' + row.senders.join(' y ') : 'Sin verificar';
      const delivery = row.needsReview ? 'Revisá el envío en WhatsApp' : row.sent && 'Audio ya registrado o reservado';
      const suggestion = suggested.has(row.id) && !row.senders.includes(info.sender) && 'Chat encontrado, pendiente de confirmar';
      const detail = [row.name, row.practice, row.last4 && '…' + row.last4, source, suggestion, delivery].filter(Boolean).join(' · ');
      label.append(box, document.createTextNode(detail));
      line.append(label);
      const tags = document.createElement('div');
      tags.className = 'btns voice-senders';
      for (const sender of info.senderOptions) {
        const tag = document.createElement('button');
        const marked = row.senders.includes(sender);
        tag.className = 'btn small ghost';
        tag.type = 'button';
        tag.dataset.sender = sender;
        tag.dataset.person = row.id;
        tag.setAttribute('aria-pressed', String(marked));
        tag.setAttribute('aria-label', `${marked ? 'Quitar' : 'Confirmar'} ${sender} para ${row.name}`);
        tag.textContent = `${marked ? '✓' : '+'} ${sender}`;
        tags.append(tag);
      }
      line.append(tags);
      return line;
    }));
    const available = rows.filter((row) => !row.sent && row.senders.includes(info.sender)).length;
    el('count').textContent = info.ready
      ? `${rows.length} en esta vista · ${available} disponibles desde el ${info.sender}`
      : `${rows.length} en esta vista`;
    if (!rows.length) el('people').textContent = 'No hay contactos de esta etapa con ese emisor.';
    controls();
  }

  async function load() {
    const id = ++generation;
    busy = true;
    controls();
    const sender = emitter.value || initialSender;
    try {
      const data = await request({ query: { group: group.value, note: preferred[group.value] || '', sender } });
      if (id !== generation) return;
      info = { ...data, ready: data.ready && data.sender === sender && Boolean(data.rules) };
      renderRules();
      emitter.replaceChildren(...data.senderOptions.map((ending) =>
        new Option(ending === '0022' ? '0022 · personal' : ending, ending)));
      emitter.value = sender;
      note.replaceChildren(new Option('Elegí un audio', ''), ...data.notes.map((row) => new Option(row.label, row.id)));
      note.value = preferred[group.value] || '';
      const senderFilter = el('sender-filter');
      const previous = senderFilter.value;
      senderFilter.replaceChildren(...data.senderOptions.map((sender) =>
        new Option(sender === data.sender ? `${sender} · conectado` : sender, sender)),
      new Option('Sin verificar', 'unknown'), new Option('Todos', 'all'));
      senderFilter.value = [...senderFilter.options].some((option) => option.value === previous)
        ? previous : emitter.value || 'unknown';
      renderPeople();
      message(info.ready
        ? `WhatsApp emisor · ${data.sender}. Quedan ${data.remaining} audios hoy entre las dos líneas.`
        : `El WhatsApp ${sender} necesita conexión.`);
    } catch (error) {
      info = null;
      message(error.message);
    } finally {
      if (id === generation) { busy = false; controls(); }
    }
  }

  function setPreferred(value) {
    preferred[group.value] = value;
    try { localStorage.setItem(selectionKey, JSON.stringify(preferred)); } catch { /* almacenamiento desactivado */ }
    el('player').hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-voice-open]')) return;
    if (!running) {
      emitter.value = initialSender;
      el('sender-filter').value = initialSender;
      suggested.clear();
    }
    dialog.showModal();
    controls();
    if (token && !running) load();
  });
  dialog.addEventListener('close', () => {
    paused = true;
    reviewing = false;
    controls();
    adjustAfterSend = false;
    if (recorder?.state === 'recording') recorder.stop();
  });
  el('authorize').addEventListener('click', () => {
    popup = window.open(origin + '/panel/prospeccion/audio/acceso', '_blank', 'popup,width=540,height=650');
    message(popup ? 'Completá el acceso en la ventana de Turnia.' : 'Permití la ventana emergente para autorizar los envíos.');
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.source !== popup || event.data?.type !== 'turnia-prospecting-voice' || typeof event.data.token !== 'string') return;
    token = event.data.token;
    popup = null;
    load();
  });
  group.addEventListener('change', () => { setPreferred(preferred[group.value] || ''); load(); });
  note.addEventListener('change', () => { setPreferred(note.value); load(); });
  emitter.addEventListener('change', () => { suggested.clear(); el('sender-filter').value = emitter.value; load(); });
  el('sender-filter').addEventListener('change', renderPeople);
  el('pick').addEventListener('click', () => {
    const available = [...el('people').querySelectorAll('input:not(:disabled)')];
    available.forEach((box, index) => { box.checked = index < selectionLimit(); });
    controls();
  });
  rulesForm.addEventListener('input', () => {
    if (!info?.rules) return;
    rulesDirty = Object.entries(readRules()).some(([key, value]) => value !== info.rules[key]);
    el('rules-status').textContent = rulesDirty ? 'Cambios sin guardar. Tocá Guardar reglas para aplicarlos.' : '';
    controls();
  });
  rulesForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || running || reviewing || recorder || !info?.rules) return;
    const rules = readRules();
    if (rules.batchSize > rules.dailyLimit || rules.pauseMaxMinutes < rules.pauseMinMinutes) {
      el('rules-status').textContent = rules.batchSize > rules.dailyLimit
        ? 'La tanda debe ser igual o menor que el cupo diario.'
        : 'La pausa máxima debe ser igual o mayor que la mínima.';
      return;
    }
    busy = true;
    controls();
    el('rules-status').textContent = 'Guardando reglas…';
    try {
      await request({ body: { action: 'rules', rules } });
      await load();
      el('rules-status').textContent = 'Reglas guardadas para ambas líneas.';
    } catch (error) { el('rules-status').textContent = error.message; }
    finally { busy = false; controls(); }
  });
  el('people').addEventListener('change', controls);
  el('detect').addEventListener('click', async () => {
    if (busy || running) return;
    busy = true;
    controls();
    message('Buscando los chats del WhatsApp conectado…');
    try {
      const found = await request({ body: { action: 'detect', sender: info.sender } });
      suggested = new Set(found.suggestions || []);
      el('sender-filter').value = 'all';
      renderPeople();
      message(`Se revisaron ${found.chats} chats del ${found.sender}. Hay ${suggested.size} sugerencias entre todas las etapas. Confirmá solo las que reconozcas como envíos desde esa línea.`);
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });
  el('people').addEventListener('click', async (event) => {
    const tag = event.target.closest('button[data-sender]');
    if (!tag || busy || running) return;
    busy = true;
    controls();
    try {
      await request({ body: {
        action: 'source', person: tag.dataset.person, sender: tag.dataset.sender,
        confirmed: tag.getAttribute('aria-pressed') !== 'true',
      } });
      await load();
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });

  el('record').addEventListener('click', async () => {
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      message('Este navegador no puede grabar. Podés subir un audio.');
      return;
    }
    busy = true;
    controls();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!dialog.open) { stream.getTracks().forEach((track) => track.stop()); return; }
      const mimeType = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const chunks = [];
      capture.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const limit = setTimeout(() => { if (capture.state === 'recording') capture.stop(); }, 120000);
      capture.onstop = () => {
        clearTimeout(limit);
        stream.getTracks().forEach((track) => track.stop());
        recorder = null;
        if (chunks.length) resetDraft(new Blob(chunks, { type: capture.mimeType || chunks[0].type }));
        el('record').textContent = 'Volver a grabar';
        message(chunks.length ? 'Escuchá la grabación y guardala para esta etapa.' : 'No se grabó audio.');
        controls();
      };
      capture.onerror = () => {
        clearTimeout(limit);
        stream.getTracks().forEach((track) => track.stop());
        recorder = null;
        message('Se interrumpió la grabación. Podés volver a grabar.');
        controls();
      };
      capture.start();
      recorder = capture;
      el('file').value = '';
      el('record').textContent = 'Detener grabación';
      message('Grabando…');
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      message('No pudimos usar el micrófono. Habilitalo en el navegador o subí un archivo.');
    } finally { busy = false; controls(); }
  });

  el('file').addEventListener('change', () => resetDraft(el('file').files[0]));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || running || recorder) return;
    if (!draft || !draft.size || draft.size > 3 * 1024 * 1024) {
      message('Grabá o subí un audio de hasta 3 MB.');
      return;
    }
    const body = new FormData(form);
    if (emitter.value) body.set('sender', emitter.value);
    body.set('audio', draft, draft.name || 'grabacion');
    busy = true;
    message('Preparando la nota de voz…');
    controls();
    try {
      const { id } = await request({ body });
      setPreferred(id);
      resetDraft(null);
      form.reset();
      await load();
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });

  el('preview').addEventListener('click', async () => {
    busy = true;
    controls();
    try {
      const audio = await request({ query: { view: 'recording', note: note.value }, binary: true });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(audio);
      el('player').src = previewUrl;
      el('player').hidden = false;
      el('player').play().catch(() => {});
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });

  el('test').addEventListener('click', async () => {
    busy = true;
    message(`Mandando la prueba a tu WhatsApp terminado en ${info.testTo}…`);
    controls();
    try {
      await request({ body: { action: 'test', note: note.value, sender: info.sender } });
      message(`WAHA aceptó la prueba. Confirmá que llegó como nota de voz al ${info.testTo}.`);
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });

  async function waitForNext(seconds, status) {
    const next = Date.now() + seconds * 1000;
    while (Date.now() < next && !paused) {
      const left = Math.ceil((next - Date.now()) / 1000);
      message(`${status} Próximo intento en ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}.`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  el('adjust').addEventListener('click', () => {
    if (running) {
      adjustAfterSend = true;
      paused = true;
      message('Deteniendo la tanda para cambiar la cantidad o la espera.');
    } else focusRules();
  });
  el('stop').addEventListener('click', () => {
    paused = true;
    message('Deteniendo la tanda. Si hay un envío en curso, se registra su resultado.');
  });
  el('send').addEventListener('click', () => {
    if (el('send').disabled) return;
    const boxes = selected();
    const label = note.selectedOptions[0]?.textContent || '';
    el('summary').textContent = `Vas a enviar «${label}» a ${boxes.length} desde el ${info.sender}${info.sender === '0022' ? ' personal' : ''}. Pausa guardada de ${pauseLabel(info.rules)}.`;
    reviewing = true;
    controls();
    el('back').focus();
  });
  el('back').addEventListener('click', () => { reviewing = false; controls(); el('send').focus(); });
  el('confirm').addEventListener('click', async () => {
    if (!reviewing || running || busy || !info?.ready || info.sender !== emitter.value) return;
    const boxes = selected();
    if (!boxes.length || boxes.length > selectionLimit()) return;
    const rules = info.rules;
    const base = { action: 'send', sender: info.sender, group: group.value, note: note.value, text: el('text').value };
    reviewing = false;
    running = true;
    paused = false;
    controls();
    let sent = 0;
    let failures = 0;
    let lastError = '';
    for (const [i, box] of boxes.entries()) {
      while (!paused && token && dialog.open) {
        message(`Enviando ${i + 1} de ${boxes.length} desde el ${base.sender}…`);
        try {
          await request({ body: { ...base, person: box.value } });
          failures = 0;
          sent += 1;
        } catch (error) {
          if (error.retryAfter) {
            await waitForNext(error.retryAfter, 'Pausa del servidor entre tandas o líneas.');
            continue;
          }
          failures += 1;
          lastError = error.message;
        }
        break;
      }
      if (paused || failures >= 2 || i === boxes.length - 1 || !token || !dialog.open) break;
      await waitForNext((rules.pauseMinMinutes * 60) + Math.floor(Math.random() * ((rules.pauseMaxMinutes - rules.pauseMinMinutes) * 60 + 1)), `${sent} aceptados por WAHA.`);
    }
    running = false;
    if (token && dialog.open) await load();
    message(`${paused ? 'Tanda detenida. ' : ''}${sent} de ${boxes.length} aceptados por WAHA desde el ${base.sender}.${lastError ? ' ' + lastError : ''}`);
    controls();
    if (adjustAfterSend && dialog.open) { adjustAfterSend = false; focusRules(); }
    if (sent) window.dispatchEvent(new Event('turnia-voice-sent'));
  });

  window.addEventListener('beforeunload', (event) => { if (running) event.preventDefault(); });
})();
