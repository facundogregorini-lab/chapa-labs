'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../prospecting/followup.js');
const js = fs.readFileSync(path.join(__dirname, '../prospecting/app.js'), 'utf8');

const snap = (over = {}) => ({ labels: { situations: {} }, stages: [], queue: [], blocked: [], scheduled: [], executed: [], inbox: [], ...over });

test('las respuestas para Facu sin tarea vuelven a la cola como «Para Facu»', () => {
  const n = F.normalize({
    habita: snap({
      queue: [{ agencyId: 'a-lista', name: 'Lista', stage: 'no-responde', action: 'presentacion', actionLabel: 'Presentación' }],
      blocked: [
        { agencyId: 'a-pasada', name: 'Pasada', stage: 'sin-demo', blocked: 'Pasada a Facu. Retomar para volver a ejecutar.' },
        { agencyId: 'a-espera', name: 'Espera', stage: 'no-responde', blocked: 'Ya le escribimos después de su última respuesta: esperá que conteste.' },
      ],
      inbox: [
        // Un audio al saludo: el saludo ya se envió, así que no queda ninguna tarea en la cola.
        { id: 'r1', agency_id: 'a-audio', name: 'Moccia', stage: 'no-contactado', status: 'facu', note: 'Audio', body: '[Audio de 0:09]', received_at: '2026-11-18T18:29:00Z' },
        { id: 'r2', agency_id: 'a-sin', name: 'Sin clasificar', stage: 'no-contactado', status: 'pendiente', body: 'Hola' },
        { id: 'r3', agency_id: 'a-lista', name: 'Lista', stage: 'no-responde', status: 'facu', note: 'Audio', body: 'x' },
      ],
    }),
  });
  const names = n.facu.map((x) => x.name).sort();
  assert.deepEqual(names, ['Moccia', 'Pasada']);
  const audio = n.facu.find((x) => x.name === 'Moccia');
  assert.equal(audio.owner, 'Facu');
  assert.equal(audio.bucket, 'facu');
  assert.equal(audio.action, 'Responder · Audio');
  assert.ok(audio.blocked, 'no se ejecuta desde la cola');
  assert.notEqual(audio.key, 'habita:a-audio', 'no pisa la clave de una tarea real');
});

test('la vista FACU y la cola muestran esas filas, y el formulario manual guarda la hora', () => {
  assert.match(js, /\[\.\.\.n\.queue,\.\.\.\(n\.facu\|\|\[\]\)\]/);
  assert.match(js, /if\(x\?\.bucket==='facu'\)return 'facu';/);
  assert.match(js, /'PARA FACU'/);
  assert.match(js, /name="hora"/);
  assert.match(js, /hora:at\.toISOString\(\)/);
  assert.match(js, /function fuManualReplyOptions/);
});
