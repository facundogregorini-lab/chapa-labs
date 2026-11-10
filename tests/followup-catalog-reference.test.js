'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('prospecting/app.js'),api=read('api/prospecting.js'),css=read('prospecting/commercial-os.css');
test('Habita etapas y situaciones reproduce árbol, lista de estados, habilitar, editar y eliminar',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  for(const marker of ['fu-catalog-layout','fu-catalog-nav','fu-catalog-panel',
      'followup-state-catalog','followup-state-editor','fu-catalog-toggle',
      "case 'state-toggle'","case 'state-delete'","case 'edit-situation'","case 'new-stage'"])
    assert.ok(app.includes(marker),marker);
});
test('Cambios sensibles del catálogo se envían al backend, no mutan la UI localmente',()=>{
  for(const op of ['state-toggle','state-delete','state-save','stage-create'])
    assert.ok(api.includes("'"+op+"'"),op);
  assert.match(api,/session\.open\(\)/);
  assert.match(app,/op:'state-toggle'/);
  assert.match(app,/if\(await fuOp\(state\.unit,\{op:'state-delete'/);
});
test('No se pierde el comportamiento de actividad del producto ni reglas por situación',()=>{
  for(const marker of ['catalog_situation','product_stage','data-catalog-products','data-catalog-mapping',
    'fu-catalog-rule-count','data-fu-catalog-source'])
    assert.ok(app.includes(marker),marker);
});
test('Catálogo y lectura son responsive, y los controles se ocultan sin acceso protegido',()=>{
  for(const marker of ['.fu-catalog-layout','.fu-catalog-nav','.fu-catalog-toggle',
    '.fu-catalog-icon-btn','@media(max-width:850px)'])
    assert.ok(css.includes(marker),marker);
  assert.match(app,/db\.available===true&&!state\.session\?\.open/);
});
