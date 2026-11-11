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
  assert.match(app,/fuQueueTableRow\(x,\{closed:q\.closed,selected:/);
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
  assert.match(app,/op:'stage',inmobiliaria:it\.id,etapa:stage/);
  assert.match(app,/op:'situation',inmobiliaria:it\.id,situacion:situation/);
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
  assert.match(app,/No altera su etapa del embudo/);
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

test('Eight commercial funnel stage icons remain above execution shortcuts',()=>{
  const stages=app.indexOf('data-testid="followup-reference-stage-cards"');
  const grid=app.indexOf('data-testid="followup-queue-grid"',stages);
  const cta=app.indexOf('data-testid="fu-take-next"',grid);
  const filters=app.indexOf('data-testid="fu-queue-advanced"',cta);
  assert.ok(stages>0&&grid>stages&&cta>grid&&filters>cta);
  assert.match(app,/commercialStages\.map\(s=>`<button class="os-fu-stage/);
  assert.match(app,/data-fu="queue-stage"/);
  assert.match(app,/data-testid="fu-queue-sort-options"/);
  assert.match(app,/data-fu-queue-select="order"/);
  assert.match(app,/data-fu-queue-select="rule"/);
  assert.match(app,/data-fu-queue-select="group"/);
  assert.match(app,/data-fu-queue-search/);
  assert.match(app,/data-fu="queue-kpi"/);
  assert.match(app,/data-fu="queue-situation"/);
  assert.match(css,/\.os-fu-queue-next\{/);
  assert.match(css,/\.os-fu-advanced-body/);
  assert.match(app,/fuQueueState\(\)\.advancedOpen=d\.open/);
});

test('Reclassify forms are intercepted and persist via backend instead of reloading the page',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  const start=app.indexOf("document.addEventListener('submit'",app.indexOf('function fuQueueTableRow'));
  assert.ok(start>0);
  const handler=app.slice(start,app.indexOf("  //",start+1000)>start?app.indexOf("  //",start+1000):start+12000);
  const routing=app.slice(start,start+9300);
  assert.match(routing,/form\.matches\('\[data-fu-chart-range\]/);
  assert.match(routing,/\[data-fu-change-stage\]/);
  assert.match(routing,/\[data-fu-change-situation\]/);
  assert.match(routing,/e\.preventDefault\(\)/);
  assert.match(routing,/op:'stage',inmobiliaria:it\.id,etapa:stage/);
  assert.match(routing,/op:'situation',inmobiliaria:it\.id,situacion:situation/);
  assert.match(routing,/result\.stage!==stage/);
  assert.match(routing,/result\.situation!==situation/);
  assert.match(routing,/state\.fu\.task=null/);
});

test('Reclassify displays only commercial funnel stages, not internal technical progress',()=>{
  const markup=app.slice(app.indexOf('function renderFuTask(t)'),app.indexOf('function renderFuTask(t)')+12000);
  assert.match(markup,/Etapa comercial<select/);
  assert.match(markup,/F\.commercialStages\('habita',snap\)/);
  assert.match(markup,/v\.technical\.includes\(it\.stage\)\?it\.stage:v\.technical\[0\]/);
  assert.doesNotMatch(markup,/Etapa del funnel<select/);
  assert.doesNotMatch(markup,/\(snap\?\.stages\|\|\[\]\)\.map\(v=>/);
  assert.match(markup,/commercialStage = F\.commercialStages\(t\.unit,snap\)/);
  assert.match(markup,/Etapa: \$\{esc\(commercialStage\?\.title/);
  assert.match(markup,/Situación: \$\{esc\(it\.situationLabel\)/);
  assert.match(markup,/Actividad: \$\{esc\(it\.stageTitle\)/);
  assert.match(markup,/Situación<select/);
  assert.match(markup,/fuSituationOptions\(situations,it\.stage,t\.unit\)/);
});

test('Mobile task only overrides execution queue, never funnel or other navigation tabs',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  const start=app.indexOf('  function renderFu() {');
  const end=app.indexOf('  function fuToolbar(',start);
  const body=app.slice(start,end);
  assert.match(body,/const v = fuView\(\)/);
  assert.match(body,/state\.fu\.task && v==='hoy' && window\.ProspectingWhatsApp/);
  assert.doesNotMatch(body,/state\.fu\.task && fuView\(\)!=='hoy'/);
  assert.match(body,/pipeline: fuPipeline/);
});
test('Funnel review lists agencies under chart, editable commercial stage and independent situation',()=>{
  const start=app.indexOf('  function fuFunnelReviewList(');
  const end=app.indexOf('  function fuNativeChart(',start);
  assert.ok(start>0 && end>start);
  const fn=app.slice(start,end);
  assert.match(fn,/snap\.labels\?\.situations/);
  assert.match(fn,/F\.commercialStages\('habita',snap\)/);
  assert.match(fn,/chart\[x\.step\]\?\.label/);
  assert.match(fn,/data-fu-funnel-review/);
  assert.match(fn,/data-fu-review-id/);
  assert.match(fn,/Etapa comercial<select name="etapa"/);
  assert.match(fn,/Situación<select name="situacion"/);
  assert.match(fn,/https:\/\/web\.whatsapp\.com\/send\?phone=/);
  assert.match(app,/fuFunnelReviewList\(snap,rows,focus,chart\)/);
  assert.match(app,/data-fu="funnel-review-more"/);
  assert.match(css,/\.os-fu-funnel-review-item>form/);
});
test('Funnel review changes submit, wait for verified server receipt, release stale claim',()=>{
  const start=app.indexOf("document.addEventListener('submit'",app.indexOf('function fuQueueTableRow'));
  const end=app.indexOf("const fd = Object.fromEntries(new FormData(form))",start);
  const handler=app.slice(start,end);
  assert.match(handler,/\[data-fu-funnel-review\]/);
  assert.match(handler,/e\.preventDefault\(\)/);
  assert.match(handler,/op:'stage',inmobiliaria:id,etapa:stage/);
  assert.match(handler,/op:'situation',inmobiliaria:id,situacion:situation/);
  assert.match(handler,/saved\.stage!==stage/);
  assert.match(handler,/saved\.situation!==situation/);
  assert.match(handler,/op:'release',inmobiliaria:id/);
  assert.match(handler,/await loadFollowup\(\{quiet:true\}\)/);
});

test('WhatsApp opens one named tab without noopener and permits no-text mode',()=>{
  assert.match(app,/window\.open\(u\.href,'habita-followup-whatsapp'\)/);
  assert.match(app,/u\.searchParams\.delete\('text'\)/);
  assert.match(app,/data-testid="fu-open-without-text"/);
  assert.doesNotMatch(app,/target="chapa-whatsapp" rel="noopener"/);
  assert.match(app,/data-fu="open-native"/);
});

test('Handoff moves execution to Facu or Axel via durable API operation',()=>{
  assert.match(app,/data-testid="fu-handoff"/);
  assert.match(app,/data-fu="handoff-facu"/);
  assert.match(app,/data-fu="handoff-axel"/);
  assert.match(app,/op:'handoff',inmobiliaria:it\.id,para:to/);
  assert.match(app,/Tarea pasada a/);
});

test('Confirmar y siguiente only advances on confirmed server receipt',()=>{
  const start=app.indexOf("case 'confirm': {"),end=app.indexOf("case 'next-after':",start);
  const handler=app.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(app,/case 'confirm-and-next':/);
  assert.match(app,/data-fu="confirm-and-next" data-testid="fu-confirm-next-desktop"/);
  assert.match(handler,/r\?\.execution\?\.status==='sent'/);
  assert.match(handler,/if\(advanceAfterConfirmed\)await fuNext\(t\)/);
  assert.ok(handler.indexOf("r?.execution?.status==='sent'")<handler.indexOf("if(advanceAfterConfirmed)await fuNext(t)"));
  assert.match(css,/\.os-fu-confirm-next\{/);
});

test('Desktop preview shows next action, WhatsApp message and actual version notes before secondary detail',()=>{
  const start=app.indexOf('function fuRecommended(');
  const end=app.indexOf('function fuHoy()',start);
  const body=app.slice(start,end);
  assert.ok(start>0&&end>start);
  const action=body.indexOf('Próxima acción');
  const message=body.indexOf('Mensaje de WhatsApp · borrador');
  const observations=body.indexOf('Observaciones');
  const contact=body.indexOf('Información del contacto');
  assert.ok(action>=0&&message>action&&observations>message&&contact>observations);
  assert.match(body,/const observations=\[x\.situationNote,version\?\.notes\]/);
  assert.match(body,/esc\(observations\|\|'Sin observaciones registradas\.'/);
});
