// Turnia · Odontólogos. La sesión de Turnia autoriza el envío; el panel público
// de Chapa y el navegador no tienen la clave de WAHA.
(function () {
  'use strict';

  const origin = 'https://turniasalud.app';
  const apiUrl = origin + '/api/prospeccion/audio';
  const selectionKey = 'cl-pr-turnia-voice-notes';
  const dialog = document.createElement('dialog');
  dialog.className = 'voice-dialog glass strong';
  dialog.setAttribute('aria-labelledby', 'voice-title');
  dialog.innerHTML = `
    <div class="card-head"><div><h2 id="voice-title">Audios de seguimiento</h2>
      <p class="sub">Elegí una etapa y su nota de voz. Los audios salen del WhatsApp conectado a Turnia.</p></div>
      <form method="dialog"><button class="btn ghost" aria-label="Cerrar audios">Cerrar</button></form></div>
    <p role="status" data-status></p>
    <button class="btn primary" type="button" data-authorize>Autorizar con Turnia</button>
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
        <p class="sub">Marcá solo a quienes ya les escribiste desde el número emisor. Los envíos se separan entre 3 y 6 minutos.</p>
        <div class="voice-list" data-people></div>
      </fieldset>
      <div class="btns">
        <button class="btn primary" type="button" data-send>Enviar a seleccionados</button>
        <button class="btn" type="button" data-stop hidden>Detener los próximos envíos</button>
      </div>
    </div>`;
  document.body.append(dialog);

  const el = (name) => dialog.querySelector(`[data-${name}]`);
  const group = el('group');
  const note = el('note');
  const form = el('upload');
  let preferred = {};
  try { preferred = JSON.parse(localStorage.getItem(selectionKey)) || {}; } catch { /* almacenamiento desactivado */ }
  let token = '';
  let popup;
  let info;
  let generation = 0;
  let busy = false;
  let running = false;
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

  function controls() {
    el('authorize').hidden = Boolean(token);
    el('voice-controls').hidden = !token;
    const locked = busy || running || Boolean(recorder);
    group.disabled = locked;
    note.disabled = locked;
    el('save').disabled = locked || !info?.ready;
    el('file').disabled = locked;
    el('record').disabled = (busy || running || !info?.ready) && !recorder;
    el('preview').disabled = locked || !note.value;
    el('test').disabled = locked || !info?.ready || !note.value;
    el('contacts').disabled = locked || !info?.ready || !note.value;
    el('text').disabled = locked;
    el('stop').hidden = !running;
    const n = selected().length;
    el('send').disabled = locked || !info?.ready || !note.value || !n || n > info.remaining;
    el('send').textContent = n ? `Enviar a ${n} seleccionados` : 'Enviar a seleccionados';
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
    throw new Error(data.error || 'Turnia no pudo completar la operación.');
  }

  async function load() {
    const id = ++generation;
    busy = true;
    controls();
    try {
      const data = await request({ query: { group: group.value, note: preferred[group.value] || '' } });
      if (id !== generation) return;
      info = data;
      note.replaceChildren(new Option('Elegí un audio', ''), ...data.notes.map((row) => new Option(row.label, row.id)));
      note.value = preferred[group.value] || '';
      el('people').replaceChildren(...data.people.map((row) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = row.id;
        box.disabled = row.sent;
        const detail = [row.name, row.practice, row.last4 && '…' + row.last4, row.sent && 'Audio ya registrado'].filter(Boolean).join(' · ');
        label.append(box, document.createTextNode(detail));
        return label;
      }));
      if (!data.people.length) el('people').textContent = 'Por ahora no hay destinatarios habilitados en esta etapa.';
      message(data.ready ? `WhatsApp emisor · ${data.sender}. Quedan ${data.remaining} audios hoy.` : 'El WhatsApp de Turnia necesita conexión.');
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
    dialog.showModal();
    controls();
    if (token && !running) load();
  });
  dialog.addEventListener('close', () => {
    paused = true;
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
  el('people').addEventListener('change', controls);

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
      await request({ body: { action: 'test', note: note.value } });
      message(`WAHA aceptó la prueba. Confirmá que llegó como nota de voz al ${info.testTo}.`);
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });

  el('stop').addEventListener('click', () => { paused = true; });
  el('send').addEventListener('click', async () => {
    if (running || busy || !info?.ready) return;
    const boxes = selected();
    if (!boxes.length || boxes.length > info.remaining) return;
    const base = { action: 'send', group: group.value, note: note.value, text: el('text').value };
    running = true;
    paused = false;
    controls();
    let sent = 0;
    let failures = 0;
    let lastError = '';
    for (const [i, box] of boxes.entries()) {
      if (paused || !token || !dialog.open) break;
      message(`Enviando ${i + 1} de ${boxes.length}…`);
      try {
        await request({ body: { ...base, person: box.value } });
        failures = 0;
        sent += 1;
      } catch (error) {
        failures += 1;
        lastError = error.message;
      }
      if (failures >= 2 || i === boxes.length - 1 || !token) break;
      for (let seconds = 180 + Math.floor(Math.random() * 181); seconds > 0 && !paused; seconds -= 1) {
        message(`${sent} aceptados por WAHA. Próximo intento en ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${lastError ? ' ' + lastError : ''}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    running = false;
    if (token && dialog.open) await load();
    message(`${sent} de ${boxes.length} aceptados por WAHA.${lastError ? ' ' + lastError : ''}`);
    controls();
    if (sent) window.dispatchEvent(new Event('turnia-voice-sent'));
  });

  window.addEventListener('beforeunload', (event) => { if (running) event.preventDefault(); });
})();
