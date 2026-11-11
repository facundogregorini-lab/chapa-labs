'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('Rules keep valid JS and native two-control situation interaction',()=>{
  assert.doesNotThrow(()=>new vm.Script(src));
  for(const label of ['data-fu-sit-chips','data-fu-rule-add-sit','data-fu="rules-remove-sit"',
    'syncFuRuleSituationChips(form)','fu-ref-chipbtn is-on'])
    assert.ok(src.includes(label),label);
});
test('Selected chip edits still write normal named checkbox values to FormData',()=>{
  assert.match(src,/name="sit" value="\$\{esc\(id\)\}"/);
  assert.match(src,/type="checkbox" class="fu-ref-situation-hidden"/);
  assert.match(src,/const situations=fd\.getAll\('sit'\)\.map\(String\)/);
  assert.match(src,/if\(selection==='rechazo'\)/);
  assert.match(src,/custom\)custom\.value=''/);
});
test('The native add selector is keyboard-accessible and checked values are visible',()=>{
  assert.match(src,/aria-label="Agregar situación"/);
  assert.match(src,/aria-label="Quitar \$\{esc\(/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.fu-ref-situation-editor/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.fu-ref-situation-hidden/);
});
