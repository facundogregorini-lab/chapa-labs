'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('prospecting/app.js');
const css=read('prospecting/commercial-os.css');

test('Habita inbox matches original native four KPI labels and copy',()=>{
  assert.doesNotThrow(()=>new vm.Script(js));
  for(const s of ['SIN CLASIFICAR','PARA FACU','MÍNIMO PARA APLICAR SOLA',
    'la extensión no estaba segura o no las clasificó',
    'audios, preguntas no cubiertas, confianza baja',
    'de confianza en la clasificación',
    '¿LLEGÓ UNA RESPUESTA?','Registrala a mano']){
    assert.ok(js.includes(s),s);
  }
  assert.match(js,/scope==='habita'\s*\? rows\.filter\(x=>x\.status==='pendiente'\)\.length/);
  assert.match(js,/data-testid="followup-reply"/);
  assert.match(js,/data-testid="followup-reply-detail"/);
});

test('Native reply controls act exactly as original and cannot classify inadvertently on review',()=>{
  assert.match(js,/data-testid="followup-reply-save"/);
  assert.match(js,/GUARDAR Y PASAR A LA COLA/);
  assert.match(js,/data-testid="followup-reply-facu"/);
  assert.match(js,/ASIGNAR A FACU/);
  assert.match(js,/const fields=review\s*\? \{op:'reply',id:r\.replyId,facu:true\}/);
  assert.match(js,/form\.dataset\.fuReplyHasBody!=='1'/);
  assert.match(js,/save\.disabled=!selected/);
  assert.match(js,/data-reply-condition="mas_adelante"/);
  assert.match(js,/data-reply-condition="derivo"/);
  assert.match(js,/contactoWhatsapp/);
  assert.match(js,/confidence!=null/);
  assert.match(js,/data-fu-manual-reply-form data-testid="followup-reply-form"/);
});

test('Habita inbox is legible on mobile; Turnia engine remains untouched',()=>{
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \[data-testid="followup-inbox"\]/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.os-fu-conv-tags/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.os-fu-actions \[data-testid="followup-reply-save"\]/);
  assert.match(js,/if\(r\.unit==='habita'\)/);
  assert.match(js,/op:'situation',inmobiliaria:r\.id/);
});
