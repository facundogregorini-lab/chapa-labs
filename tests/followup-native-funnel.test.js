'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const app=read('prospecting/app.js'),api=read('api/prospecting.js'),css=read('prospecting/commercial-os.css');
test('Real Habita chart: nine steps, original counts, losses and period navigation',()=>{
  assert.doesNotThrow(()=>new vm.Script(app));
  for(const s of ['followup-native-funnel','followup-funnel-drilldown','data-fu="funnel-select"',
    "case 'funnel-period'","case 'funnel-select'","case 'funnel-reset'",
    'data-fu-chart-range','chartRows','lostAt','chartPeriod'])
    assert.ok(app.includes(s),s);
  assert.match(api,/vista: 'followup', \.\.\.chartParams/);
  assert.match(app,/const chart=snap\?\.chart/);
  assert.match(app,/const period=fuChartPeriod\(\)/);
});
test('Period data is never synthesized from pending tasks',()=>{
  assert.match(app,/if\(!Array\.isArray\(chart\)\|\|!Array\.isArray\(lostAt\)\|\|!Array\.isArray\(rows\)\)/);
  assert.match(app,/followup-native-chart-unavailable/);
  assert.match(app,/chosen=rows\.filter/);
});
test('Responsive segmented chart and distinct advance/stay/lost classes',()=>{
  for(const s of ['.os-native-chart','.os-native-segment.is-advanced','.os-native-segment.is-stayed',
    '.os-native-segment.is-lost','@media(max-width:760px)'])assert.ok(css.includes(s),s);
});
