'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const WhatsApp=require('../prospecting/whatsapp-mobile.js');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../prospecting/index.html'),'utf8');

test('Mobile converts product-owned WhatsApp Web chat to iOS/Android universal link with the exact message',()=>{
  const raw='https://web.whatsapp.com/send?phone=%2B5492235127135&text='+encodeURIComponent('Hola María.\nTe comparto la demo: https://habitaia.app/demo?a=1&b=2');
  const native=WhatsApp.nativeLink(raw);
  const parsed=new URL(native);
  assert.equal(parsed.hostname,'wa.me');
  assert.equal(parsed.pathname,'/5492235127135');
  assert.equal(parsed.searchParams.get('text'),'Hola María.\nTe comparto la demo: https://habitaia.app/demo?a=1&b=2');
  assert.doesNotMatch(native,/web\.whatsapp\.com/);
});
test('Native WhatsApp link handles other known product formats and rejects unsafe URLs or bad recipients',()=>{
  assert.equal(new URL(WhatsApp.nativeLink('https://api.whatsapp.com/send?phone=5492235127135&text=Hola')).hostname,'wa.me');
  assert.equal(new URL(WhatsApp.nativeLink('https://wa.me/5492235127135?text=Hola')).pathname,'/5492235127135');
  assert.equal(WhatsApp.nativeLink('https://attacker.example/send?phone=5492235127135'),null);
  assert.equal(WhatsApp.nativeLink('javascript:alert(1)', '5492235127135'),null);
  assert.equal(WhatsApp.nativeLink('https://web.whatsapp.com/send?phone=1'),null);
  assert.equal(WhatsApp.nativeLink('','5492235127135','Hola'), 'https://wa.me/5492235127135?text=Hola');
  assert.equal(WhatsApp.nativeLink('https://web.whatsapp.com/send?phone=5492235127135&text=','5492235127135','unrelated'),'https://wa.me/5492235127135');
});
test('Direct WhatsApp application scheme offered only as explicit user-tap fallback',()=>{
  const url=WhatsApp.appLink('https://web.whatsapp.com/send?phone=5492235127135&text=Hola');
  assert.equal(new URL(url).protocol,'whatsapp:');
  assert.equal(new URL(url).searchParams.get('phone'),'5492235127135');
  assert.equal(new URL(url).searchParams.get('text'),'Hola');
  assert.equal(WhatsApp.appLink('javascript:bad'),null);
});
test('Mobile detection covers iPhone/iPad and Android regardless of horizontal viewport',()=>{
  assert.equal(WhatsApp.isMobileClient({navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}}),true);
  assert.equal(WhatsApp.isMobileClient({navigator:{userAgent:'Android Chrome'}}),true);
  assert.equal(WhatsApp.isMobileClient({navigator:{userAgent:'Windows NT'},matchMedia:()=>({matches:false})}),false);
});
test('Dedicated mobile execution screen reuses named WhatsApp tab; opening never confirms sending',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(html,/src="\/prospecting\/whatsapp-mobile\.js"/);
  assert.ok(html.indexOf('whatsapp-mobile.js')<html.indexOf('app.js'));
  assert.match(app,/state\.fu\.task && v==='hoy' && window\.ProspectingWhatsApp\?\.isMobileClient\(window\)/);
  assert.match(app,/data-testid="fu-mobile-actions"/);
  assert.match(app,/data-testid="fu-open-mobile"/);
  assert.match(app,/href="\$\{esc\(nativeWhatsApp\|\|rawWhatsApp\)\}" target="habita-followup-whatsapp"/);
  // On a phone the button is the app's own link, followed in the same tab: no empty browser tab is left behind.
  assert.match(app,/phoneWhatsApp\?`href="\$\{esc\(appWhatsApp\)\}"`/);
  assert.match(app,/direct=new URL\(t\.href\)\.protocol==='whatsapp:'/);
  assert.match(app,/if\(direct\)window\.location\.href=direct/);
  assert.doesNotMatch(app,/void fuOp\(task\.unit,\{op:'open'/);
  assert.match(app,/window\.open\(u\.href,'habita-followup-whatsapp'\)/);
  assert.match(app,/data-fu="open-native"/);
  assert.match(app,/keepalive:true/);
  assert.match(app,/op:'open',\.\.\.fields\(\)/);
  assert.match(app,/case 'confirm':/);
  assert.match(app,/op: 'confirm'/);
  assert.match(app,/Si no se abre, probá con el enlace de WhatsApp/);
  assert.match(css,/\[data-testid="fu-mobile-actions"\]/);
  assert.match(css,/os-fu-wa-desktop\{display:none!important/);
  assert.match(css,/os-fu-task-cards>\.os-fu-message-card/);
  assert.match(css,/env\(safe-area-inset-top\)/);
});
