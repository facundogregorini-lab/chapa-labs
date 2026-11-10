'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const F=require('../prospecting/followup.js');

test('Cola y Embudo mantienen siete tarjetas principales y las etapas personalizadas como chips separados',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  for(const marker of ['followup-reference-stage-cards','followup-funnel-stages',
    'followup-queue-custom-stages','followup-funnel-custom-stages'])
    assert.ok(app.includes(marker),marker);
  assert.match(app,/commercialStages\.map\(s=>`<button class="os-fu-stage/);
  assert.match(app,/customStages\.map\(s=>`<button type="button"/);
});

test('Las etapas personalizadas mantienen sus claves y condiciones de origen',()=>{
  const snap={funnel:[{key:'no-responde',reached:12,waiting:4}],catalog:{stages:[
    {key:'etapa_demo_prop',label:'Demo prometida',technical_stage:'sin-demo',entry_situation:'interesado',waiting:3},
  ]}};
  const stages=F.commercialStages('habita',snap);
  assert.equal(stages.length,8);
  const custom=stages.find(s=>s.key==='etapa_demo_prop');
  assert.deepEqual(custom.technical,['sin-demo']);
  assert.equal(custom.situation,'interesado');
  assert.equal(custom.waiting,3);
  assert.equal(stages.filter(s=>!snap.catalog.stages.some(x=>x.key===s.key)).length,7);
});
