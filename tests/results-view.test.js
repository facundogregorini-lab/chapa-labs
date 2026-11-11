'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const R=require('../prospecting/results-view.js');
const AG=require('../prospecting/agencies.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const t=(type,o={})=>({type,stages:['no-contactado'],pending:0,human:0,bot:0,successHuman:0,successBot:0,blocked:0,unclaimed:0,failed:0,scheduled:0,...o});
const day=(d,types,captured=true)=>({day:d,captured,types});
const habita={
  stages:[{key:'no-contactado',title:'Prospectado'},{key:'no-responde',title:'Contactado'},{key:'sin-uso',title:'Cuenta creada, sin uso'}],
  results:{
    actionLabels:{'no-contactado:principal':'Saludo','no-responde:precios':'Precios','sin-uso:precios':'Precios'},
    execution:{available:true,days:[
      day('2026-11-05',[t('Saludo',{pending:9,human:9,successHuman:1})],false),
      day('2026-11-10',[t('Saludo',{pending:10,human:6,bot:2,successHuman:2,successBot:1,blocked:1,unclaimed:1,scheduled:2})]),
      day('2026-11-11',[t('Saludo',{pending:4,human:1,unclaimed:3}),t('Precios',{stages:['no-responde','sin-uso'],pending:2,human:2,successHuman:1})]),
    ]},
    windows:{
      '7':{versions:[
        {versionId:'a',stage:'no-contactado',action:'principal',version:2,status:'active',executed:40,conversions:10,assisted:1,rate:.25,medianHours:20,failed:0,smallSample:false,best:true},
        {versionId:'b',stage:'no-responde',action:'precios',version:1,status:'active',executed:5,conversions:1,rate:.2,medianHours:30,failed:1,smallSample:true},
        {versionId:'c',stage:'sin-uso',action:'precios',version:1,status:'test',executed:3,conversions:0,rate:0,medianHours:null,failed:0,smallSample:true},
      ],weeklyByType:{Saludo:[{week:'2026-11-06',executed:4,conversions:1},{week:'2026-11-13',executed:6,conversions:2}]}},
      '14':{versions:[],weeklyByType:{}},todo:{versions:[],weeklyByType:{}},
    },
    cohortFunnel:{stages:[{key:'prospect',title:'Prospecto'},{key:'contacted',title:'Contactada'}],
      contacto:[{cohort:'2026-11-13',size:4,reached:[4,2]}],respuesta:[],version:[{cohort:'Saludo V1',size:2,reached:[2,1]}]},
    blocks:[{reason:'<img src=x onerror=alert(1)>',n:2}],
  },
};

test('the renderer parses and the page loads it before app.js',()=>{
  assert.doesNotThrow(()=>new vm.Script(read('prospecting/results-view.js')));
  const page=read('prospecting/index.html');
  assert.ok(page.indexOf('results-view.js')>0&&page.indexOf('results-view.js')<page.indexOf('app.js'));
  const app=read('prospecting/app.js');
  for(const op of ['results-window','results-cohort','results-period','results-day','results-open','results-action'])assert.match(app,new RegExp(`case '${op}'`));
});

test('1 · the queue: pending, executed by a person or a bot, successful, the leak and the score',()=>{
  const html=R.render('habita',habita,{period:'hoy'});
  assert.match(html,/¿Se ejecutó la cola\?/);
  assert.match(html,/data-testid="results-bar-pending"[\s\S]*?<strong>6<\/strong>/);
  assert.match(html,/data-testid="results-bar-executed"[\s\S]*?<strong>3<\/strong>/);
  assert.match(html,/data-testid="results-bar-success"[\s\S]*?<strong>1<\/strong>/);
  // Score: 60% × 3/6 + 40% × 1/3 = 43.
  assert.match(html,/class="rs-score-num">43</);
  const week=R.aggregate(R.selectedDays(habita.results.execution.days,{period:'7'}));
  // The day without a photo adds what was executed, never its pending.
  assert.equal(week.total.pending,16);
  assert.equal(week.executed,20);
  assert.equal(R.score(R.selectedDays(habita.results.execution.days,{period:'7'}),{wCov:60,wOk:40}).value,Math.round(100*(.6*(11/16)+.4*(4/11))));
  assert.match(R.render('habita',habita,{period:'7'}),/1 día no tiene foto de la cola/);
});

test('each bar opens into its types of action, for the chosen day',()=>{
  const html=R.render('habita',habita,{period:'7',open:'executed',day:'2026-11-10'});
  assert.match(html,/data-testid="results-open-executed"/);
  assert.match(html,/Ejecutadas por tipo de acción/);
  const open=html.slice(html.indexOf('results-open-executed'),html.indexOf('</table>',html.indexOf('results-open-executed')));
  assert.match(open,/<b>Saludo<\/b>[\s\S]*?<td>8<\/td><td>6<\/td><td>2<\/td><td>80%<\/td>/);
  assert.doesNotMatch(open,/<b>Precios<\/b>/);
  const pending=R.render('habita',habita,{period:'hoy',open:'pending'});
  assert.match(pending,/<b>Precios<\/b><small>Contactado · Cuenta creada, sin uso<\/small>/);
  // Block reasons are text, never HTML.
  assert.doesNotMatch(pending,/<img src=x/);
  assert.match(pending,/&lt;img src=x/);
});

test('2 · actions grouped by type; a row opens into the stages where it ran and its versions',()=>{
  const closed=R.render('habita',habita,{});
  assert.equal((closed.match(/data-testid="results-action-row"/g)||[]).length,2);
  assert.doesNotMatch(closed,/results-action-instances/);
  const open=R.render('habita',habita,{action:'Precios'});
  assert.match(open,/data-testid="results-action-instances"/);
  assert.match(open,/rs-stage is-hit">Contactado/);
  assert.match(open,/rs-stage is-hit">Cuenta creada, sin uso/);
  assert.match(open,/EN PRUEBA/);
  assert.match(R.render('habita',habita,{action:'Saludo'}),/MEJOR/);
});

test('3 · cohorts with the stages of the panel, as a heatmap',()=>{
  const html=R.render('habita',habita,{cohortBy:'version'});
  assert.match(html,/<th>Prospecto<\/th><th>Contactada<\/th>/);
  assert.match(html,/Saludo V1/);
  assert.match(html,/<b>50%<\/b>/);
});

test('Turnia: its cohorts come from its accounts with the Odontólogos stages; versions from its stats',()=>{
  const cfg=AG.TURNIA;
  const stages=cfg.stages.filter(k=>k!=='closed').map(k=>({key:k,title:cfg.stageStep[k]}));
  const rows=[
    {stage:'contacted',step:0,createdAt:'2026-11-09T12:00:00.000Z',repliedAt:null},
    {stage:'interacted',step:3,createdAt:'2026-11-10T12:00:00.000Z',repliedAt:'2026-11-10T15:00:00.000Z'},
    {stage:'closed',step:2,createdAt:'2026-11-10T12:00:00.000Z',repliedAt:null},
    {stage:'prospect',step:0,createdAt:'2000-01-01T00:00:00.000Z'},
  ];
  const cf=R.turniaCohorts(rows,stages,1,new Date('2026-11-11T15:00:00Z'));
  assert.deepEqual(cf.contacto,[{cohort:'2026-11-13',size:3,reached:[3,3,2,1,0,0]}]);
  assert.equal(cf.respuesta[0].size,1);
  const turnia={stages:[{key:'sin-saludo',title:'Sin saludar',versions:[{id:'v',version:1,status:'active',stats:{executions:40,conversions:8}}]}],
    results:{actionLabels:{'sin-saludo':'Paso 1: el saludo'},execution:{available:true,days:[day('2026-11-11',[t('Paso 1: el saludo',{stages:['sin-saludo'],pending:5,human:5,successHuman:2})])]},weeklyByType:{}}};
  const html=R.render('turnia',turnia,{period:'hoy',action:'Paso 1: el saludo'},{cohorts:cf});
  assert.match(html,/Paso 1: el saludo/);
  assert.match(html,/<th>Por contactar<\/th>/);
  assert.doesNotMatch(html,/data-fu="results-window"/);
  assert.match(html,/20%/);
});

test('without results it says so instead of fabricating numbers',()=>{
  assert.match(R.render('habita',{}),/No se pudieron consultar los resultados/);
  assert.match(R.render('habita',{results:{execution:{available:false,days:[]}}}),/Todavía no se guarda la foto diaria/);
});

test('cohorts start at the first week with contacts and say which funnel they use',()=>{
  const cf={stages:[{key:'contactado',title:'Contactado'},{key:'interesado',title:'Interesado'}],
    contacto:[{cohort:'2026-10-02',size:0,reached:[0,0]},{cohort:'2026-10-09',size:4,reached:[4,1]},{cohort:'2026-10-16',size:0,reached:[0,0]}]};
  const html=R.render('habita',{results:{execution:{days:[]},windows:{}}},{},{cohorts:cf});
  assert.doesNotMatch(html,/2 oct/);
  assert.match(html,/9 oct/);
  assert.match(html,/16 oct/);
  assert.match(html,/embudo de Follow-up, desde Contactado/);
  assert.match(R.render('turnia',{results:{execution:{days:[]}}},{},{cohorts:cf}),/desde Saludado/);
});

test('cohorts come before the actions',()=>{
  const html=R.render('habita',habita,{});
  assert.ok(html.indexOf('data-testid="results-queue"')<html.indexOf('data-testid="results-cohorts"'));
  assert.ok(html.indexOf('data-testid="results-cohorts"')<html.indexOf('data-testid="results-actions"'));
});
