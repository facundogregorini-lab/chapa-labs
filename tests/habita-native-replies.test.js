'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const js=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('Habita inbox preserves its native four KPIs and does not show a redundant hero',()=>{
  assert.doesNotThrow(()=>new vm.Script(js));
  for(const label of ['SIN CLASIFICAR','PARA FACU','MÍNIMO PARA APLICAR SOLA',
    '¿LLEGÓ UNA RESPUESTA?','la extensión no estaba segura o no las clasificó',
    'audios, preguntas no cubiertas, confianza baja','de confianza en la clasificación'])
    assert.ok(js.includes(label),label);
  assert.match(js,/scope!=='todas'\?'':/);
  assert.match(js,/data-testid="followup-inbox"/);
  assert.match(js,/data-testid="followup-reply-form"/);
});

test('Native classification detail shows confidence, correct CTA, referral/date conditions',()=>{
  for(const label of ['GUARDAR Y PASAR A LA COLA','ASIGNAR A FACU',
    'la extensión sugirió','confianza','Contacto'])
    assert.ok(js.includes(label),label);
  assert.match(js,/data-testid="followup-reply-save"/);
  assert.match(js,/data-testid="followup-reply-facu"/);
  assert.match(js,/data-reply-condition="mas_adelante"/);
  assert.match(js,/data-reply-condition="derivo"/);
  assert.match(js,/data-fu="reply-select"/);
  assert.match(js,/data-fu="reply-manual"/);
  assert.match(js,/case 'reply-select':/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.os-fu-conv-tags/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \[data-testid="followup-inbox"\]/);
});
