'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'../api/prospecting.js'),'utf8');

test('Habita experimental remains an editable workspace with a name-only session',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/canEdit=db\.available===true&&\(unit==='habita'\|\|!state\.session\?\.open\)/);
  assert.match(app,/const canEdit=unit==='habita'\|\|\(!state\.session\?\.open&&snap\.catalog\?\.available\)/);
  assert.match(app,/const readonly=unit==='turnia'&&\(state\.session\?\.open\|\|!snap\.catalog\?\.available\)/);
  assert.doesNotMatch(app,/Para editar, configurá PROSPECTING_PASSWORD en Vercel/);
  assert.doesNotMatch(app,/La sesión abierta no permite editar reglas ni mensajes/);
});

test('Only Habita is unlocked: Turnia high-impact configuration still requires protected login',()=>{
  assert.match(api,/sensitiveOps\.has\(f\.op\) && session\.open\(\) && unit\.id !== 'habita'/);
  assert.match(api,/if \(!user\) return fail\(res, 401, 'Iniciá sesión\.'\)/);
  assert.match(api,/if \(!unit\.api \|\| !apiOf\(unit\)\)/);
  assert.match(api,/followupCache\.invalidate\(unit\.id \+ '\|'/);
  assert.match(app,/unit==='turnia'&&state\.session\?\.open/);
});
