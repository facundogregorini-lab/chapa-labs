'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
const app=read('prospecting/app.js'),followup=read('prospecting/followup.js'),api=read('api/prospecting.js');
test('Same stage/situation editor writes through product-owned API for both businesses',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/const unit=state\.unit;\s*if\(!\['habita','turnia'\]\.includes\(unit\)/);
  for(const op of ['stage-create','state-save','state-delete','state-toggle'])
    assert.ok(api.includes("'"+op+"'"),op);
  assert.match(app,/fuOp\(unit,\{op:'stage-create'/);
  assert.match(app,/fuOp\(unit,\{op:'state-save'/);
  assert.match(app,/fuOp\(state\.unit,\{op:'state-toggle'/);
  assert.match(app,/db\.available===true&&\(unit==='habita'\|\|!state\.session\?\.open\)/);
});
test('Turnia custom stages remain additive without modifying the native eight-stage funnel',()=>{
  const F=require('../prospecting/followup.js');
  const s=F.commercialStages('turnia',{
    funnel:[],stages:[],catalog:{stages:[{key:'etapa_custom',label:'Custom',technical_stage:'demo-sin-abrir',entry_situation:'neutro',waiting:7}]}
  });
  assert.equal(s.length,9);assert.equal(s.slice(0,8).length,8);
  assert.equal(s[8].key,'etapa_custom');assert.equal(s[8].waiting,7);
});
test('Avoids accidental independent lead-state or message mutations in the shared shell',()=>{
  assert.match(api,/session\.open\(\)/);
  assert.match(app,/state\.session\?\.open/);
  assert.match(app,/loadFollowup\(\{quiet:true\}\)/);
});
