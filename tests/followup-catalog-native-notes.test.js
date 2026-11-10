'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
test('Habita catalog shows the exact native explanations for canonical situations',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  for(const note of [
    'Todavía no respondió al mensaje.',
    'Confirmó que es el WhatsApp de la inmobiliaria.',
    'Quiere conocer o probar HABITA.',
    'Respondió sin expresar interés ni rechazo.',
    'Consultó por planes, créditos o precios.',
    'Pidió retomar la conversación más adelante.',
    'Indicó con quién continuar la conversación.',
    'Respondió que la propuesta no le interesa.',
    'Ya trabaja con otro proveedor de IA.',
    'Pidió que no se le vuelva a escribir.',
    'El número no tiene WhatsApp.',
    'El número corresponde a otro destinatario.',
  ]) assert.ok(app.includes(note),note);
  assert.match(app,/unit==='habita'&&HABITA_SITUATION_NOTES\[id\]/);
  assert.match(app,/o\?\.description\|\|/);
});
