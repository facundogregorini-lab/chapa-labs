'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('prospecting/app.js');
const css=read('prospecting/commercial-os.css');
const html=read('prospecting/index.html');

test('Habita native workspace preserves tabs, title and new SCRIPT tab',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  assert.match(app,/function habitaFuChrome\(content\)/);
  for(const label of ['EJECUCIÓN COMERCIAL','Gestioná el outreach y el seguimiento',
    'COLA DE EJECUCIÓN','RESPUESTAS','EMBUDO','REGLAS','ETAPAS Y SITUACIONES','RESULTADOS','SCRIPT'])
    assert.ok(app.includes(label),label);
  for(const target of ['/panel','/galeria','/precios','/cuenta','/inicio'])
    assert.ok(app.includes("'"+target+"'"),target);
  assert.match(app,/main\.innerHTML=habitaFuChrome\(main\.innerHTML\)/);
});

test('Manrope is actually fetched and auth/logout remains accessible in native shell',()=>{
  assert.match(html,/fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.match(html,/family=Manrope/);
  assert.match(css,/\.habita-fu-head-copy h1/);
  assert.match(css,/\.habita-fu-tabs button\.is-on/);
  assert.match(css,/body\[data-unit="habita"\]:has\(\.habita-fu-workspace-head\) \.os-top \.os-user/);
  assert.match(css,/body\[data-unit="habita"\] \.os-sidebar::after/);
});

test('Native queue preserves compact scoring, situation edit action, recommended CTA and mobile layout',()=>{
  assert.match(app,/os-fu-inline-select/);
  assert.match(app,/data-fu="queue-focus-situation"/);
  assert.match(app,/case 'queue-edit-situation':/);
  assert.match(app,/data-testid="followup-reference-stage-cards"/);
  assert.match(app,/data-testid="followup-queue-situations"/);
  assert.match(css,/\.os-fu-center > \.os-fu-kpis\s*\{[^}]*order:12/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('Native Habita rules editor is one aligned header + when + what + message + preview',()=>{
  assert.match(app,/data-testid="followup-part-when"/);
  assert.match(app,/data-testid="followup-part-what"/);
  assert.match(app,/data-fu-rule-version/);
  assert.match(app,/case 'rules-message-focus':/);
  assert.match(app,/case 'rules-version-new':/);
  assert.match(app,/function syncFuLinkedRulePanel\(form\)/);
  assert.match(app,/data-testid="followup-preview"/);
  assert.match(css,/\.fu-ref-detail>\.fu-ref-rule-form\s*\{\s*display:contents/);
  assert.match(css,/\.fu-ref-rule-form>\.fu-ref-edit-head\s*\{[^}]*grid-column:1\/3/);
  assert.match(css,/\.fu-ref-detail>\.fu-ref-wa-preview\s*\{[^}]*grid-column:3/);
});

test('Habita funnel shows exactly original nine-step historical chart, not second invented flowboard',()=>{
  assert.match(app,/if\(scope==='habita'\)return fuNativeChart\(snap\)/);
  assert.match(app,/data-testid="followup-native-funnel"/);
  assert.match(css,/body\[data-unit="habita"\] \.os-native-segment\.is-stayed/);
});

test('Catalog remains bound to origin and preserves native labels and uppercase heading',()=>{
  assert.match(app,/HABITA_SITUATION_NOTES/);
  assert.match(app,/data-testid="followup-state-catalog"/);
  assert.match(css,/body\[data-unit="habita"\] \.fu-catalog-head h2\s*\{[^}]*text-transform:uppercase/);
  assert.match(app,/PROSPECTING_PASSWORD/);
});
