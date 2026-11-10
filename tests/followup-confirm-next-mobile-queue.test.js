'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('Confirming a send leaves a receipt rather than dropping to queue',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/case 'confirm':\s*\{/);
  assert.match(app,/if\(!task\|\|task\.mode!=='ejecutar'\)break/);
  assert.match(app,/op: 'confirm'/);
  assert.match(app,/if \(r\) \{\s*\/\/ Keep the completed item/);
  assert.match(app,/state\.fu\.task = \{\.\.\.task,mode:'confirmado',confirmedAt:new Date\(\)\.toISOString\(\)\}/);
  assert.match(app,/data-testid="fu-confirmed-receipt"/);
  assert.match(app,/Envío confirmado/);
  assert.match(app,/data-testid="fu-next-confirmed"/);
  assert.match(app,/data-fu="next-after"/);
});

test('Next after confirmed never calls release or sends duplicate confirmation',()=>{
  const start=app.indexOf('  async function fuNext() {');
  const end=app.indexOf('  // ── Las vistas ──',start);
  assert.ok(start>0&&end>start);
  const fn=app.slice(start,end);
  assert.match(fn,/previous\?\.mode==='ejecutar'/);
  assert.match(fn,/op:'release'/);
  assert.match(fn,/if\(previous\?\.mode!=='confirmado'\)state\.fu\.task=null/);
  assert.doesNotMatch(fn,/op: ?'confirm'/);
  assert.match(fn,/await fuClaim\(next\)/);
  assert.match(fn,/toast\('No hay otra tarea libre con estos filtros/);
});

test('Mobile cards replace wide queue table without changing filtered data',()=>{
  assert.match(app,/function fuQueueMobileCard\(x,\{closed=false\}=\{\}\)/);
  assert.match(app,/data-testid="fu-mobile-queue"/);
  assert.match(app,/rows\.slice\(0,q\.limit\)\.map\(x=>fuQueueMobileCard\(x,\{closed:q\.closed\}\)\)/);
  assert.match(app,/data-testid="fu-mobile-execute"/);
  assert.match(app,/data-testid="fu-mobile-expand"/);
  assert.match(app,/<details class="os-fu-mobile-item-more"/);
  assert.match(app,/data-fu="queue-view"/);
  assert.match(app,/case 'queue-view':/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/body\[data-unit="habita"\] \.os-fu-tablecard>\.table-wrap\s*\{\s*display:none!important/);
  assert.match(css,/body\[data-unit="habita"\] \.os-fu-mobile-list\s*\{\s*display:grid/);
  assert.match(css,/\.os-fu-mobile-item-control \.btn\s*\{[\s\S]*?min-height:44px/);
});

test('Mobile execute is disabled for claimed, blocked, scheduled and closed items',()=>{
  assert.match(app,/const executable=!closed&&!x\.claim&&!x\.blocked&&!x\.dueAt&&Boolean\(x\.action\)/);
  assert.match(app,/TOMADA POR /);
  assert.match(app,/SIN ACCIÓN/);
  assert.match(app,/data-fu="claim" data-fu-key="\$\{esc\(x\.key\)\}"/);
});

test('Desktop original table and next action stay available',()=>{
  assert.match(app,/fuQueueTableRow\(x,\{closed:q\.closed\}\)/);
  assert.match(app,/data-testid="fu-take-next"/);
  assert.match(app,/data-testid="fu-confirm-mobile"/);
  assert.match(css,/\.os-fu-mobile-list\{display:none\}/);
});
