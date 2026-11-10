'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');

test('Las reglas abren en Contactado, como el panel Habita',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/commercial: 'contactado',\s*selected: null, creating: false/);
});

test('La selección del paso técnico está integrada al editor de la regla nueva',()=>{
  assert.match(app,/availableTechnical\.map\(stageKey=>/);
  assert.match(app,/data-fu-rules-tech aria-label="Etapa del embudo de la regla"/);
  assert.match(app,/case 'rules-new':/);
  assert.match(app,/ui\.technical=e\.target\.value/);
  assert.doesNotMatch(app,/PASO TÉCNICO DE LA REGLA/);
});
