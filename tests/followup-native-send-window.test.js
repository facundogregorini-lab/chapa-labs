'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const js=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('Habita native scheduling uses same three day presets and five hour presets',()=>{
  assert.doesNotThrow(()=>new vm.Script(js));
  for(const label of ['Lunes – Sábado','Lunes – Viernes','Todos los días'])
    assert.ok(js.includes(label),label);
  assert.match(js,/const hourPresets=\[\[9,18\],\[9,19\],\[9,20\],\[10,19\],\[8,20\]\]/);
  assert.match(js,/data-fu-rule-days-presets aria-label="Días"/);
  assert.match(js,/data-fu-rule-hours-presets aria-label="Horas"/);
  assert.match(js,/data-testid="followup-rule-send-window"/);
});

test('Preset controls still submit exact engine values through named hidden fields',()=>{
  assert.match(js,/name="days" value="\$\{n\}"/);
  assert.match(js,/name="hours_from" value="\$\{r\.hours_from\?\?9\}"/);
  assert.match(js,/name="hours_to" value="\$\{r\.hours_to\?\?19\}"/);
  assert.match(js,/case 'rules-message-focus':/);
  assert.match(js,/days=fd\.getAll\('days'\)\.map\(Number\)/);
  assert.match(js,/hours_from:Number\(fd\.get\('hours_from'\)\)/);
  assert.match(js,/if\(e\.target\.matches\('\[data-fu-rule-days-presets\]'\)\)/);
  assert.match(js,/if\(e\.target\.matches\('\[data-fu-rule-hours-presets\]'\)\)/);
});
test('Mobile retains the source two-selector layout',()=>{
  assert.match(css,/body\[data-unit="habita"\] \.fu-ref-send-window-selects\s*\{\s*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
