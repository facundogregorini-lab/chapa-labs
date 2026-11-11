'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../prospecting/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../prospecting/commercial-os.css'),'utf8');

test('Native Habita 9-step funnel, broken-scale computation and original captions',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  for(const s of ['Sin interés todavía','Interesados, sin demo','No se enviaron',
    'No abrieron la demo','Visitaron, sin interactuar','Interactuaron, sin cuenta',
    'Cuenta sin uso','Sin suscripción','de los contactados','de los interesados',
    'de las creadas','de las enviadas','de las visitadas','de las que interactuaron',
    'de las cuentas creadas','de las cuentas activas','Base del período',
    'Los dos primeros pasos salen de la columna'])
    assert.ok(app.includes(s),s);
  assert.match(app,/data-fu="funnel-select"/);
  assert.match(app,/data-fu="funnel-period"/);
  assert.match(app,/data-fu-chart-range/);
  assert.match(app,/Math\.log\(n\/limit\)/);
});
test('Habita funnel draws hatched orange + dark green, no Turnia bleed',()=>{
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\],\[data-unit="todas"\]\) \.os-native-segment\.is-stayed\s*\{\s*background:repeating-linear-gradient/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\],\[data-unit="todas"\]\) \.os-native-segment\.is-advanced\s*\{\s*background:#206d4b/);
  assert.match(css,/body:is\(\[data-unit="habita"\],\[data-unit="turnia"\],\[data-unit="todas"\]\) \.os-native-step-label\s*\{\s*text-align:center/);
});
