'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('prospecting/app.js');
const helpers=require('../prospecting/followup.js');

test('La Cola reproduce la jerarquía Habita: tarjetas comerciales, KPIs, filtros, tabla y panel a la derecha',()=>{
  assert.doesNotThrow(()=>new vm.Script(js));
  for(const anchor of ['followup-reference-stage-cards','followup-kpi-','followup-queue-situations',
    'followup-queue-grid','followup-recommended','followup-applied-rule',
    'os-fu-preview-head','os-fu-preview-card','Mensaje de WhatsApp',
    'Observaciones','followup-recommended-execute','followup-queue-order'])
    assert.ok(js.includes(anchor)||anchor==='followup-queue-order'&&js.includes('data-fu-queue-select="order"'),anchor);
  assert.match(js,/renderFuTask\(state\.fu\.task\)/);
  assert.match(js,/case 'confirm':/);
  assert.match(js,/op: 'confirm'/);
});
test('Reglas: etapa comercial, prioridades, editor, mensaje, plantillas, orden y baja reales',()=>{
  for(const anchor of ['followup-flow','followup-commercial-stage','followup-rules-workspace',
    'followup-rules-list','followup-rule-detail','followup-rule-form','followup-part-when',
    'followup-rule-action','followup-rule-save','followup-rule-message',
    "case 'rules-stage'","case 'rules-select'","case 'rules-template'","case 'rules-move'",
    "case 'rules-delete'",'fuRulesMove','data-fu-drag-key'])
    assert.ok(js.includes(anchor),anchor);
  assert.match(js,/op:'rule-reorder'/);
  assert.match(js,/op:'rule-delete'/);
  assert.match(js,/op:'rule-save'/);
  assert.match(js,/op:'version-create'/);
  assert.match(js,/encuesta_cierre/);
  assert.match(js,/catalog_situation/);
  assert.match(js,/min_demo_activity_level/);
});
test('Las operaciones sensibles requieren sesión protegida y usan APIs del producto',()=>{
  const api=read('api/prospecting.js');
  for(const op of ['rule-save','rule-reorder','rule-delete','version-create','version-update'])
    assert.ok(api.includes("'"+op+"'"),op);
  assert.match(api,/session\.open\(\)/);
  assert.match(js,/state\.session\?\.open/);
});
test('El mismo contexto de lead se conserva desde los datos de Habita hasta la recomendación',()=>{
  const q=helpers.item('habita',{
    agencyId:'abc',name:'Inmobiliaria Ejemplo',shortName:'Ejemplo',person:'Ana',zone:'Miramar',
    website:'https://example.test',properties:17,address:'Calle 10',wa:true,needsReview:false,
    action:'principal',stage:'no-responde',situation:'interesado',phone:'+54 11 1111',
  },{stages:[],labels:{situations:{interesado:'Interesado'}}},'cola');
  assert.equal(q.shortName,'Ejemplo');assert.equal(q.person,'Ana');assert.equal(q.properties,17);
  assert.equal(q.website,'https://example.test');assert.equal(q.wa,true);assert.equal(q.needsReview,false);
  assert.equal(q.situationLabel,'Interesado');
});
test('La experiencia de reglas y la Cola conserva layout de dos columnas y responsive',()=>{
  const css=read('prospecting/commercial-os.css');
  for(const cls of ['.fu-ref-workspace','.fu-ref-flow','.fu-ref-rule','.fu-ref-detail',
    '.os-fu-queue-grid','.os-fu-side','.os-fu-side-rule','.fu-ref-rule.drag-target'])
    assert.ok(css.includes(cls),cls);
  assert.match(css,/@media\(max-width:760px\)/);
});
