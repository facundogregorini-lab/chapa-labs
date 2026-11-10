'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('desktop queue compiles and has the requested columns, not city',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  const start=app.indexOf('<div class="table-wrap"><table class="os-fu-table os-fu-desktop-table"');
  const end=app.indexOf('<div class="os-fu-mobile-list"',start);
  assert.ok(start>0&&end>start);
  const table=app.slice(start,end);
  for(const label of ['ETAPA','SITUACIÓN','PRÓXIMA ACCIÓN','ÚLTIMO CONTACTO','WHATSAPP','QUIÉN LO TOMA','PRIORIDAD'])
    assert.ok(table.includes(label),label);
  assert.doesNotMatch(table,/CIUDAD|<th>SCORE<\/th>/);
});
test('inline stage and situation are selected from native commercial catalog and persist on server',()=>{
  assert.match(app,/function fuQueueStageChoices\(x\)/);
  assert.match(app,/F\.commercialStages\(x\.unit,snap\)/);
  assert.match(app,/function fuQueueSituationChoices\(x\)/);
  assert.match(app,/data-fu-inline-stage/);
  assert.match(app,/data-fu-inline-situation/);
  assert.match(app,/data-fu-inline-owner/);
  assert.match(app,/const result=await fuOp\(x.unit,\{op,inmobiliaria:x.id,\.\.\.fields\}\)/);
  assert.match(app,/result\.stage===value/);
  assert.match(app,/result\.situation===value/);
  assert.match(app,/result\.owner===value/);
});
test('first row selected; hovering previews without claiming',()=>{
  assert.match(app,/rows\.find\(x=>x\.key===state\.fu\.queueSelected\)\|\|rows\[0\]\|\|null/);
  assert.match(app,/function fuQueueChoose\(key\)/);
  assert.match(app,/document\.addEventListener\('pointerover'/);
  assert.match(app,/if\(row&&main\.contains\(row\)&&!state\.fu\.task\)fuQueueChoose/);
  assert.match(css,/tbody tr\.is-selected td/);
});
test('right panel renders message and observations visibly, including multiple messages',()=>{
  assert.match(app,/data-testid="fu-desktop-message"/);
  assert.match(app,/data-testid="fu-desktop-observations"/);
  assert.match(app,/const rawMessages=active\?\(task\.messages\|\|\[\]\)\.filter\(Boolean\):\[\]/);
  assert.match(app,/version\.body\.replaceAll/);
  assert.match(app,/uniqueNotes\.map/);
  assert.doesNotMatch(app.slice(app.indexOf('function fuDesktopQueueAside'),app.indexOf('function fuHoy')), /<details class="os-fu-desktop-card"/);
  assert.match(app,/data-fu="copy"/);
});
test('WhatsApp is icon only in row and named tab in right panel',()=>{
  const row=app.slice(app.indexOf('function fuQueueTableRow'),app.indexOf('// Compact native mobile cards'));
  assert.match(row,/data-fu="queue-whatsapp"/);
  assert.doesNotMatch(row,/esc\(x\.phone\|\|'—'\)/);
  assert.match(app,/target="chapa-whatsapp"/);
});
test('confirm and next only advances after persisted sent status; normal confirm retained',()=>{
  const start=app.indexOf("      case 'confirm': {");
  const end=app.indexOf("      case 'next-after':",start);
  const handler=app.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(app,/case 'confirm-and-next':/);
  assert.match(app,/data-fu="confirm-and-next"/);
  assert.match(app,/data-fu="confirm"/);
  assert.match(handler,/r\?\.execution\?\.status==='sent'/);
  assert.match(handler,/if\(advanceAfterConfirmed\)await fuNext\(t\)/);
  assert.ok(handler.indexOf("r?.execution?.status==='sent'")<handler.indexOf('if(advanceAfterConfirmed)await fuNext(t)'));
  assert.match(app,/data-fu="next-after"/);
  assert.match(css,/\.os-fu-desktop-actions/);
});
test('mobile queue and mobile confirm UI remain functional and separate',()=>{
  assert.match(app,/function fuQueueMobileCard/);
  assert.match(app,/data-testid="fu-mobile-queue"/);
  assert.match(app,/data-testid="fu-confirm-mobile"/);
  assert.match(css,/body\[data-unit="habita"\] \.os-fu-queue-grid>\.os-fu-desktop-detail\{display:none!important\}/);
});
