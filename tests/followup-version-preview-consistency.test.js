'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');

test('WhatsApp preview and copy select the exact same version id',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/const active=versions\.find\(v=>v\.id===state\.fu\.previewVersion\)/);
  assert.match(app,/case 'rules-preview-copy':\s*\{/);
  assert.match(app,/const version=versions\.find\(v=>v\.id===state\.fu\.previewVersion\)/);
  assert.match(app,/Versión V'\+version\.version\+' copiada sin enviarla/);
});

test('Switching WhatsApp preview version never dirties a saved rule',()=>{
  const segments=[...app.matchAll(/if\(!e\.target\.matches\('\[data-fu-rule-version\]'\)/g)];
  assert.equal(segments.length,2,'change and input handlers each keep preview-only changes clean');
});
