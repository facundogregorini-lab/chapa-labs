'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('One-tap confirm checks persisted receipt without blocking on reload',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  const start=app.indexOf("      case 'confirm': {");
  const end=app.indexOf("      case 'next-after':",start);
  const fn=app.slice(start,end);
  assert.match(fn,/r\?\.execution\?\.status==='sent'/);
  assert.match(fn,/Guardando envío/);
  assert.match(fn,/state\.fu\.n\.queue=state\.fu\.n\.queue\.filter/);
  assert.doesNotMatch(fn,/await loadFollowup/);
  assert.match(fn,/El servidor no confirmó el guardado/);
  assert.doesNotMatch(app,/data-fu="confirm"[^>]*data-arm=/);
  assert.match(app,/data-testid="fu-confirmed-receipt"/);
  assert.match(app,/data-testid="fu-next-confirmed"/);
});

test('Next action shows immediate progress and avoids full-board refresh on claim',()=>{
  const start=app.indexOf('  async function fuNext(clicked) {');
  const end=app.indexOf('  // ── Las vistas ──',start);
  const fn=app.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(fn,/state\.fu\.advancing=true/);
  assert.match(fn,/Abriendo siguiente/);
  assert.match(fn,/previous\?\.mode==='ejecutar'/);
  assert.match(fn,/op:'release'/);
  assert.doesNotMatch(fn,/op: ?'confirm'/);
  assert.match(fn,/const claimed=await fuClaim\(next\)/);
  assert.match(fn,/state\.fu\.task=null/);
  assert.match(fn,/finally \{/);
  const claim=app.slice(app.indexOf('  async function fuClaim(it)'),app.indexOf('  function fuNextCandidate'));
  assert.doesNotMatch(claim,/loadFollowup/);
  assert.match(app,/case 'next-after': await fuNext\(t\)/);
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

test('Execution hides legacy menu and presents compact reclasificar action',()=>{
  assert.match(app,/document\.body\.dataset\.executing = state\.fu\?\.task/);
  assert.match(app,/state\.fu\?\.task \? '' : legacy\.map/);
  assert.doesNotMatch(app,/Soltar sin hacer nada/);
  assert.match(app,/data-testid="fu-reclassify"/);
  assert.match(app,/data-testid="fu-reclassify-open">Reclasificar/);
  assert.match(app,/data-fu-change-stage/);
  assert.match(app,/data-fu-change-situation/);
  assert.match(app,/op:'stage',inmobiliaria:it\.id,etapa:fd\.etapa/);
  assert.match(app,/op:'situation',inmobiliaria:it\.id,situacion:fd\.situacion/);
  assert.match(css,/body\[data-executing="true"\] #legacy-tabs\{display:none!important\}/);
  assert.match(css,/body\[data-executing="true"\] \.os-workspace>main\{padding-top:14px!important\}/);
});


test('Recontactar is only a situation, starting from contacted or greeted',()=>{
  assert.match(app,/function fuSituationOptions\(situations, stage, unit\)/);
  assert.match(app,/stage !== first/);
  assert.match(app,/data-fu-change-situation/);
  assert.match(app,/data-fu-change-stage/);
  assert.match(app,/recontactar_vacaciones/);
  assert.match(app,/recontactar_mas_adelante/);
  assert.match(app,/no altera su etapa del embudo/);
});

test('Both units expose recontact situations only after first contact',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/function fuSituationOptions\(situations, stage, unit\)/);
  assert.match(app,/unit === 'turnia' \? 'sin-saludo' : 'no-contactado'/);
  assert.match(app,/recontactar_vacaciones/);
  assert.match(app,/recontactar_mas_adelante/);
  assert.match(app,/fuSituationOptions\(situations,it.stage,t.unit\)/);
  assert.match(app,/selected\?\.technical/);
});
