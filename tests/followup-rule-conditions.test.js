'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const F=require('../prospecting/followup.js');
const app=fs.readFileSync(path.join(__dirname,'..','prospecting','app.js'),'utf8');

test('El editor de Reglas sigue teniendo sintaxis JS válida y el mismo origen de condiciones',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  for(const anchor of ['data-fu-rule-custom','data-fu-rule-action','followup-rule-enabled',
    'data-fu="rule-toggle"','data-fu="rules-delete"','data-fu="rules-template"',
    'data-fu="rules-move"','data-fu-new-rule-message'])
    assert.ok(app.includes(anchor),anchor);
  assert.match(app,/catalogState\?\.source==='product'&&situations\.length/);
  assert.match(app,/catalogState\?\.maps_to&&!situations\.includes/);
  assert.match(app,/const mapped=chosen\.source==='product'\?null:chosen\.maps_to/);
});

test('El resumen de reglas distingue avance de producto y situación personalizada de WhatsApp',()=>{
  const snap={stages:[{key:'sin-cuenta',title:'Sin cuenta'}],
    labels:{situations:{interesado:'Interesado'}},
    catalog:{states:[
      {key:'custom_genero',label:'Generó imagen',source:'product',active:true},
      {key:'custom_pregunto',label:'Consultó condiciones',source:'whatsapp',maps_to:'interesado',active:true},
    ]},
    rules:[
      {key:'p',stage:'sin-cuenta',action:'principal',situations:[],catalog_situation:'custom_genero',after_hours:24},
      {key:'w',stage:'sin-cuenta',action:'principal',situations:['interesado'],catalog_situation:'custom_pregunto',after_hours:12},
    ]};
  const rows=F.ruleRows('habita',snap);
  assert.equal(rows[0].when,'Generó imagen');
  assert.equal(rows[1].when,'Consultó condiciones');
  assert.notEqual(rows[0].when,'Cualquier situación');
});

test('Las observaciones permanecen vinculadas a cada versión y los mensajes compartidos se advierten',()=>{
  const snap={stages:[{key:'no-responde',title:'No responde',versions:[
    {id:'v1',version:1,status:'active',action:'principal',body:'Hola',notes:'Validar inmobiliaria primero'}
  ]}],rules:[]};
  const rows=F.versionRows('habita',snap);
  assert.equal(rows[0].notes,'Validar inmobiliaria primero');
  assert.match(app,/const shared=\(snap\.rules\|\|\[\]\)\.filter/);
  assert.match(app,/notes: String\(fd\.notes\|\|''\)/);
});
