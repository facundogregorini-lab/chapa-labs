'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const R=require('../prospecting/habita-results.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const sample={
  results:{
    totals:{executed30:12,replies30:6,pending:7,failed:2,blocked:3},
    windows:{
      '7':{weekly:[{week:'2026-11-06',executed:8,conversions:2}],versions:[
        {versionId:'v1',stage:'no-responde',action:'presentacion',version:1,status:'active',eligible:12,executed:8,conversions:2,assisted:1,rate:0.25,medianHours:36,failed:1,smallSample:true,best:false}
      ]},
      '14':{weekly:[],versions:[
        {versionId:'v2',stage:'no-responde',action:'presentacion',version:2,status:'test',eligible:1,executed:1,conversions:1,assisted:0,rate:1,medianHours:48,failed:0,smallSample:true,best:false}
      ]},
      todo:{weekly:[],versions:[]},
    },
    cohorts:{
      contacto:[{cohort:'2026-11-06',size:4,respondio:2,interes:1,demo:1,cuenta:0,suscripcion:0}],
      respuesta:[],
      version:[{cohort:'V1',size:2,respondio:1,interes:1,demo:1,cuenta:0,suscripcion:0}],
    },
    blocks:[{reason:'Horario restringido',n:3}],
  },
  catalog:{actions:{'no-responde':[{key:'presentacion',label:'Presentación'}]}},
  stages:[{key:'no-responde',title:'Contactado'}],
};

test('Renders the native Habita four KPI, weekly, block, version and cohort panels using live-source schema',()=>{
  assert.doesNotThrow(()=>new vm.Script(read('prospecting/habita-results.js')));
  const html=R.render(sample);
  for(const id of ['followup-results','followup-window-7','followup-window-14','followup-results-blocks',
    'followup-results-versions','followup-results-cohorts','followup-cohort-contacto'])
    assert.ok(html.includes(id),id);
  for(const label of ['VENTANA DE CONVERSIÓN','EJECUCIONES CONFIRMADAS','RESPONDIERON POR PRIMERA VEZ',
    'ACCIONES PENDIENTES','NO SALIERON','EVOLUCIÓN SEMANAL','MOTIVOS DE BLOQUEO',
    'POR REGLA Y VERSIÓN','COHORTES','Horario restringido','Presentación'])
    assert.ok(html.includes(label),label);
  assert.match(html,/V1/);
  assert.match(html,/25%/);
  assert.match(html,/\+1 asistencias/);
  assert.match(html,/36 h/);
  assert.match(html,/muestra chica/);
});

test('Native window buttons and cohort filters switch without API refresh and use source window data',()=>{
  const html=R.render(sample,{windowKey:'14',cohortBy:'version'});
  assert.match(html,/V2/);
  assert.match(html,/EN PRUEBA/);
  assert.match(html,/V1/);
  assert.match(html,/data-fu="results-window"/);
  assert.match(html,/data-fu="results-cohort"/);
  assert.match(html,/aria-pressed="true" data-fu="results-window" data-fu-window="14"/);
  assert.match(html,/aria-pressed="true" data-fu="results-cohort" data-fu-cohort="version"/);
});

test('No source text is interpreted as HTML and unavailable results do not fabricate metrics',()=>{
  const injected={...sample,results:{...sample.results,blocks:[{reason:'<img src=x onerror=alert(1)>',n:2}]}};
  const html=R.render(injected);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;img src=x/);
  assert.match(R.render({}),/No se pudieron consultar los resultados/);
});

test('Chapa loads the dedicated renderer before app and keeps Turnia results separate',()=>{
  const app=read('prospecting/app.js'),page=read('prospecting/index.html'),styles=read('prospecting/commercial-os.css');
  assert.ok(page.indexOf('habita-results.js')<page.indexOf('app.js'));
  assert.match(app,/scope==='habita'&&window\.ProspectingHabitaResults/);
  assert.match(app,/case 'results-window'/);
  assert.match(app,/case 'results-cohort'/);
  assert.match(styles,/\.fu-native-results-kpis/);
});
