'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createComments, cleanText, pathOf } = require('../api/_comments.js');

const app = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../api/prospecting.js'), 'utf8');

/** An in-memory stand-in for the private Vercel Blob store. */
function memory() {
  const files = new Map();
  let tick = 0;
  return {
    files,
    store: createComments({
      now: () => new Date(Date.UTC(2026, 10, 12, 13, 0, tick++)),
      get: async (p) => (files.has(p) ? { stream: new Response(files.get(p).body).body } : null),
      put: async (p, body, opts) => { assert.equal(opts.access, 'private'); files.set(p, { body, uploadedAt: new Date(Date.UTC(2026, 10, 12, 13, 0, tick)) }); },
      list: async ({ prefix }) => ({ blobs: [...files].filter(([p]) => p.startsWith(prefix)).map(([pathname, f]) => ({ pathname, uploadedAt: f.uploadedAt })), hasMore: false }),
    }),
  };
}

test('The extension and a person leave comments on the same contact, in order', async () => {
  const { store } = memory();
  assert.deepEqual(await store.thread('habita', 'abc-123'), []);
  await store.add('habita', 'abc-123', { by: 'Facu', bot: true, text: 'Pidió que la llamen a la tarde.', name: 'Soria Company Propiedades' });
  const list = await store.add('habita', 'abc-123', { by: 'Facu', bot: false, text: '  Ok, mandale la demo mañana.\r\n' });
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((c) => [c.by, c.bot, c.text]), [['Facu', true, 'Pidió que la llamen a la tarde.'], ['Facu', false, 'Ok, mandale la demo mañana.']]);
  assert.ok(list[0].at < list[1].at);
  assert.deepEqual(await store.thread('habita', 'abc-123'), list);
});

test('Each contact and each business keeps its own thread; the index says who has comments', async () => {
  const { store, files } = memory();
  await store.add('habita', 'a1', { by: 'Facu', text: 'uno' });
  await store.add('habita', 'b2', { by: 'Axel', text: 'dos' });
  await store.add('turnia', 'a1', { by: 'Axel', bot: true, text: 'tres' });
  assert.deepEqual([...files.keys()].sort(), [pathOf('habita', 'a1'), pathOf('habita', 'b2'), pathOf('turnia', 'a1')].sort());
  assert.deepEqual(Object.keys(await store.index('habita')).sort(), ['a1', 'b2']);
  assert.deepEqual(Object.keys(await store.index('turnia')), ['a1']);
  assert.equal((await store.thread('turnia', 'a1'))[0].text, 'tres');
});

test('Empty comments and unsafe contact ids are rejected; long text is cut', async () => {
  const { store, files } = memory();
  await assert.rejects(store.add('habita', 'a1', { by: 'Facu', text: '   ' }), /Escribí el comentario/);
  await assert.rejects(store.add('habita', '../otro', { by: 'Facu', text: 'x' }), /Falta el contacto/);
  await assert.rejects(store.thread('habita', ''), /Falta el contacto/);
  assert.equal(files.size, 0);
  assert.equal(cleanText('a'.repeat(5000)).length, 2000);
});

test('Comments go through the session, are available for both businesses and mark the extension', () => {
  assert.match(api, /if \(op === 'comments' && \(req\.method === 'GET' \|\| req\.method === 'POST'\)\) return await doComments\(req, res, user\);/);
  assert.ok(api.indexOf("if (!user) return fail(res, 401") < api.indexOf("if (op === 'comments'"));
  assert.match(api, /by: user\.name, bot: body\.ejecutor === 'bot'/);
  assert.match(app, /data-testid="fu-comments"/);
  assert.match(app, /\$\{fuCommentsBox\(t\)\}\s*<div class="grid cols-3 os-fu-task-cards"/);
  assert.match(app, /agentMode\(\) \? \{ ejecutor: 'bot' \} : \{\}/);
  // Not tied to one business: Turnia gets the same box.
  const box = app.slice(app.indexOf('function fuCommentsBox(t)'), app.indexOf('function fuCommentsPaint'));
  assert.doesNotMatch(box, /habita/);
});

test('habita.: pasar un lead a Facu exige el motivo en sus comentarios', () => {
  // El motivo que llega con el pedido se guarda como comentario antes de pasarlo.
  assert.match(api, /text: `Pasada a \$\{handoffTo\}: \$\{motivo\}`/);
  // Sin motivo, solo pasa si ya tiene un comentario de las últimas dos horas.
  assert.match(api, /Para pasarla a Facu dejá un comentario con el motivo/);
  assert.match(api, /f\.op === 'owner' && \/\^facu\\b\/i/);
  // Se valida antes de llamar al producto.
  assert.ok(api.indexOf("Para pasarla a Facu") < api.indexOf("followup: f }, timeout: ['whatsapp-sync'"));
  // La pantalla pide el porqué y lo manda con el pase.
  assert.match(app, /data-testid="fu-handoff-reason"/);
  assert.match(app, /op:'handoff',inmobiliaria:it\.id,para:to,motivo,nombre:it\.name/);
  assert.match(app, /if\(to==='Facu'&&!motivo\)/);
});

test('Las tareas para Facu o Axel muestran los comentarios en «Más información»', () => {
  assert.match(app, /const fuForPerson = \(x\) => fuExecutor\(x\) !== 'extension'/);
  assert.match(app, /\$\{fuCardCommentsBox\(x\)\}\s*<button type="button" class="btn os-fu-mobile-item-view"/);
  assert.match(app, /data-fu-card-more="\$\{esc\(x\.key\)\}"/);
  assert.match(app, /if\(form\.matches\('\[data-fu-card-comment-form\]'\)\)\{await fuCardCommentSend\(form\);return;\}/);
  // Abrir «Más información» lee el hilo; nunca toma la tarea.
  assert.match(app, /if\(d\.open\)\{state\.fu\.cardOpen=key;void fuCardCommentsLoad\(key\);\}/);
});
