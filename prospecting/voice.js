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
        <label class="field">Chats iniciados desde<select data-sender-filter></select></label>
        <p class="sub">Solo podés enviar desde el WhatsApp conectado a Turnia. «Buscar sus chats» marca a quienes ya tienen un chat con ese número; si falta alguno, confirmalo a mano con su línea. Los envíos se separan entre 3 y 6 minutos.</p>
        <div class="btns"><button class="btn small" type="button" data-detect>Buscar sus chats en el WhatsApp conectado</button></div>
        <details class="voice-import">
          <summary>¿Faltan contactos o les escribiste desde otro número? Importalos desde WhatsApp Web</summary>
          <ol class="sub">
            <li>En la computadora, abrí WhatsApp Web con el número desde el que les escribiste.</li>
            <li>Tocá «Copiar código». En la pestaña de WhatsApp Web abrí la consola (F12 → Console, o Cmd+Opción+J en Mac), pegá y apretá Enter. Si Chrome pide escribir «allow pasting», escribilo y pegá de nuevo.</li>
            <li>El código no manda nada: solo copia los números de tus chats. Pegalos acá, elegí la línea y tocá «Importar».</li>
          </ol>
          <div class="btns"><button class="btn small" type="button" data-copy-script>Copiar código</button></div>
          <label class="field">Línea de ese WhatsApp<select data-import-sender></select></label>
          <label class="field">Números copiados<textarea data-import-text rows="3" placeholder="Pegá acá lo que copió el código"></textarea></label>
          <div class="btns"><button class="btn small" type="button" data-import>Importar</button></div>
        </details>
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
    el('contacts').disabled = locked || !info;
    el('detect').disabled = locked || !info?.ready;
    el('import').disabled = locked || !info;
    if (info?.sender) el('detect').textContent = `Buscar sus chats en el WhatsApp ${info.sender}`;
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
      const detail = [row.name, row.practice, row.last4 && '…' + row.last4, source, row.sent && 'Audio ya registrado'].filter(Boolean).join(' · ');
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
    if (!rows.length) el('people').textContent = 'No hay contactos de esta etapa con ese emisor.';
    controls();
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
      const senderFilter = el('sender-filter');
      const previous = senderFilter.value;
      senderFilter.replaceChildren(...data.senderOptions.map((sender) =>
        new Option(sender === data.sender ? `${sender} · conectado` : sender, sender)),
      new Option('Sin verificar', 'unknown'), new Option('Todos', 'all'));
      senderFilter.value = [...senderFilter.options].some((option) => option.value === previous)
        ? previous : data.sender || 'unknown';
      const importSender = el('import-sender');
      const chosen = importSender.value;
      importSender.replaceChildren(...data.senderOptions.map((sender) => new Option(sender, sender)));
      if (data.senderOptions.includes(chosen)) importSender.value = chosen;
      renderPeople();
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
  el('sender-filter').addEventListener('change', renderPeople);
  el('people').addEventListener('change', controls);
  el('copy-script').addEventListener('click', async () => {
    const code = `(${whatsappWebScript.toString()})();`;
    try {
      await navigator.clipboard.writeText(code);
      message('Código copiado. Pegalo en la consola de WhatsApp Web.');
    } catch {
      el('import-text').value = code;
      el('import-text').select();
      message('No se pudo copiar solo: copiá el código del cuadro (ya está seleccionado) y después reemplazalo por los números.');
    }
  });
  el('import').addEventListener('click', async () => {
    if (busy || running) return;
    const phones = [...new Set(el('import-text').value.split(/[\n,;]+/)
      .map((value) => value.replace(/\D/g, '')).filter((value) => value.length >= 10 && value.length <= 15))];
    if (!phones.length) { message('Pegá los números que copió el código de WhatsApp Web.'); return; }
    busy = true;
    controls();
    message(`Importando ${phones.length} números…`);
    try {
      const done = await request({ body: { action: 'import', sender: el('import-sender').value, phones } });
      await load();
      el('import-text').value = '';
      message(`De ${done.received} números, ${done.phones} son celulares de la Argentina y ${done.matched} son odontólogos de la lista (${done.inserted} nuevos marcados «Desde ${done.sender}»).`);
    } catch (error) { message(error.message); }
    finally { busy = false; controls(); }
  });
  el('detect').addEventListener('click', async () => {
    if (busy || running) return;
    busy = true;
    controls();
    message('Buscando los chats del WhatsApp conectado…');
    try {
      const found = await request({ body: { action: 'detect' } });
      await load();
      const k = found.kinds || {};
      const detail = found.kinds
        ? ` Detalle: ${k.numero} con número, ${k.lid} con @lid (${k.lidSinNumero} sin número), ${k.grupos} grupos, ${k.otros} otros; ${found.phones} teléfonos de Argentina.`
        : '';
      message(`Se revisaron ${found.chats} chats del ${found.sender}: ${found.matched} son odontólogos de la lista (${found.inserted} nuevos marcados «Desde ${found.sender}»).${detail}`);
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
  // Se copia y se pega en la consola de WhatsApp Web (no corre en este panel). Lee la lista de
  // chats de esa cuenta y copia sus números, uno por línea; los @lid se traducen con lo que sabe
  // WhatsApp Web. No manda ni cambia nada.
  function whatsappWebScript() {
    return (async () => {
      const phones = new Set();
      const stats = { chats: 0, conNumero: 0, lid: 0, lidConNumero: 0, gruposYCanales: 0 };
      const load = (name) => { try { return window.require(name); } catch { return null; } };
      const digits = (wid) => {
        const text = typeof wid === 'string' ? wid : wid?._serialized || (wid?.user && wid?.server ? `${wid.user}@${wid.server}` : '');
        return /^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/.exec(text || '')?.[1] || null;
      };
      const collections = load('WAWebCollections');
      const contactApi = load('WAWebApiContact');
      const lidPhone = (id, hint) => {
        for (const guess of [() => hint, () => contactApi?.getPhoneNumber?.(id), () => collections?.Contact?.get?.(id)?.phoneNumber]) {
          try { const found = digits(guess()); if (found) return found; } catch { /* siguiente */ }
        }
        return null;
      };
      const visit = (id, hint) => {
        const text = typeof id === 'string' ? id : id?._serialized || '';
        if (!text || text.startsWith('status@') || text.startsWith('0@')) return;
        stats.chats++;
        if (/@(g\.us|newsletter|broadcast)$/.test(text)) { stats.gruposYCanales++; return; }
        let phone = digits(text);
        if (phone) stats.conNumero++;
        else if (text.endsWith('@lid')) {
          stats.lid++;
          phone = lidPhone(id, hint);
          if (phone) stats.lidConNumero++;
        }
        if (phone) phones.add(phone);
      };
      const chats = collections?.Chat?.getModelsArray?.() || [];
      for (const chat of chats) { try { visit(chat.id, chat.contact?.phoneNumber); } catch { visit(chat.id); } }
      if (!phones.size) {
        // Plan B: la base local de WhatsApp Web.
        const db = await new Promise((ok, ko) => { const r = indexedDB.open('model-storage'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
        const all = (store) => new Promise((ok) => {
          try { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); } catch { ok([]); }
        });
        const byLid = new Map((await all('contact')).filter((c) => c.phoneNumber).map((c) => [c.id, c.phoneNumber]));
        stats.chats = 0;
        for (const chat of await all('chat')) visit(chat.id, byLid.get(chat.id));
      }
      const text = [...phones].join('\n');
      let copied = false;
      try { if (typeof copy === 'function') { copy(text); copied = true; } } catch { /* abajo */ }
      if (!copied) { try { await navigator.clipboard.writeText(text); copied = true; } catch { /* abajo */ } }
      console.log('Chapa Labs · chats de este WhatsApp', stats, `${phones.size} números`);
      console.log(copied ? 'Listo: los números quedaron copiados. Pegalos en Chapa Labs → Mandar audios → Importar.' : `Copiá estos números y pegalos en Chapa Labs:\n${text}`);
      return `${phones.size} números ${copied ? 'copiados' : 'listados arriba'}`;
    })();
  }
})();
