'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');

test('Habita uses the original Follow-up workspace dimensions without changing the Turnia shell',()=>{
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.os-shell\s*\{\s*grid-template-columns:190px minmax\(0,1fr\)/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.os-workspace > main\s*\{[^}]*padding:30px clamp\(14px,1\.6vw,28px\) 40px/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.fu-ref-workspace\s*\{\s*grid-template-columns:minmax\(300px,\.85fr\) minmax\(680px,2fr\)/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\]\) \.fu-catalog-layout\s*\{\s*grid-template-columns:minmax\(200px,245px\) minmax\(0,1fr\)/);
});

test('Mobile displays the same 2x4 stage tile grid and two-column KPI arrangement as Habita',()=>{
  assert.match(css,/@media\(max-width:760px\)\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.os-fu-stage-grid\[data-testid="followup-reference-stage-cards"\]/);
  assert.match(app,/data-testid="followup-reference-stage-cards"/);
  assert.match(app,/data-testid="followup-queue-custom-stages"/);
  assert.match(app,/data-testid="followup-queue-situations"/);
  assert.match(app,/data-testid="followup-queue-grid"/);
});

test('Live CTAs and filters stay wired, native commercial navigation stays distinct from custom stages',()=>{
  assert.match(app,/data-fu="next"/);
  assert.match(app,/data-fu="queue-stage"/);
  assert.match(app,/data-fu="queue-situation"/);
  assert.match(app,/data-fu="claim"/);
  assert.match(app,/commercialStages\.map/);
  assert.match(app,/customStages\.map/);
});
