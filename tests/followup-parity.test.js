'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const F=require('../prospecting/followup.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..','prospecting',p),'utf8');

test('Mismo selector comercial para Habita y Turnia, con 7 y 8 etapas respectivamente',()=>{
  const snap={funnel:[{key:'no-contactado',waiting:5,reached:10,rate:.5},{key:'no-responde',waiting:2,reached:5,rate:.5}]};
  assert.equal(F.commercialStages('habita',snap).length,7);
  assert.equal(F.commercialStages('turnia',{funnel:[]}).length,8);
  assert.equal(F.commercialStages('habita',snap)[0].waiting,5);
});
test('Las situaciones originadas en producto llegan sin convertirse en WhatsApp',()=>{
 const item={agencyId:'sample',name:'Demo',situation:'neutro',productSituations:['custom_demo_genero_imagen'],catalogSituation:null,stage:'sin-cuenta'};
 const n=F.normalize({habita:{queue:[item],scheduled:[],blocked:[],stages:[],summary:{}}});
 assert.equal(n.queue[0].situation,'neutro');
 assert.deepEqual(n.queue[0].productSituations,['custom_demo_genero_imagen']);
});
test('La bandeja normaliza los dos motores manteniendo el texto original',()=>{
  const n=F.normalize({
    habita:{queue:[],scheduled:[],blocked:[],stages:[],summary:{},
      inbox:[{id:'r1',agency_id:'ag1',name:'Agencia',body:'Gracias',received_at:'2026-11-09T14:00:00Z',status:'pendiente'}]},
    turnia:{queue:[],scheduled:[],blocked:[],stages:[],summary:{},
      inbox:[{id:'p1',name:'Consultorio',latestReply:'Lo miro hoy',latestReplyAt:'2026-11-09T15:00:00Z'}]}
  });
  const list=F.inboxItems(n);
  assert.equal(list.length,2);
  assert.equal(list[0].body,'Gracias');
  assert.equal(list[1].body,'Lo miro hoy');
});
test('El panel conserva la sintaxis y la fuente de estados por avance de embudo',()=>{
 assert.doesNotThrow(()=>new vm.Script(read('app.js')));
 const js=read('app.js');
 assert.match(js,/data-fu-catalog-source/);
 assert.match(js,/product_stage/);
 assert.match(js,/productSituations/);
 assert.match(js,/data-fu-rule-template/);
 assert.match(js,/followup-reference-stage-cards/);
 assert.match(read('commercial-os.css'),/data-catalog-products\]\[hidden\]/);
});
