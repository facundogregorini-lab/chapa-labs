'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const O=require('../prospecting/overview.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const steps=[
  {label:'Saludos enviados',actual:240,target:250,rate:null,targetRate:null},
  {label:'Demos enviadas',actual:30,target:37.5,rate:30/240,targetRate:.15},
  {label:'Visitadas',actual:24,target:24.4,rate:.8,targetRate:.65},
];
const day=(d,stages,captured=true)=>({day:d,captured,types:[],stages});
const snap={results:{execution:{available:true,days:[
  day('2026-11-10',[{stage:'no-contactado',pending:40,executed:36,success:5},{stage:'no-responde',pending:20,executed:8,success:1},{stage:'no-abrio',pending:10,executed:9,success:4}]),
  day('2026-11-11',[{stage:'no-contactado',pending:30,executed:24,success:3},{stage:'sin-enviar',pending:10,executed:2,success:1}]),
]}}};
const queueSteps={'no-contactado':0,'no-responde':1,'sin-enviar':1,'no-abrio':2};
const unit={id:'habita',name:'habita.',color:'var(--s2)',perWeek:250,funnel:{steps},snap,queueSteps,queueHtml:'<div data-testid="followup-results"></div>',
  daily:[{date:'2026-11-10',steps:[40,5,3],targets:[35.7,5.4,3.5]},{date:'2026-11-11',steps:[30,null,null],targets:[35.7,5.4,3.5]}]};

test('the page loads overview.js after results-view.js and before app.js; app wires its actions',()=>{
  assert.doesNotThrow(()=>new vm.Script(read('prospecting/overview.js')));
  const page=read('prospecting/index.html'),app=read('prospecting/app.js');
  assert.ok(page.indexOf('results-view.js')<page.indexOf('overview.js')&&page.indexOf('overview.js')<page.indexOf('app.js'));
  for(const op of ['ov-period','ov-grain','ov-step'])assert.match(app,new RegExp(`case '${op}'`));
  assert.match(app,/window\.ProspectingOverview\.render\(/);
});

test('periods and buckets use Buenos Aires days and Sat–Fri weeks',()=>{
  assert.deepEqual(O.periodDays('7','2026-11-11'),['2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10','2026-11-11']);
  assert.equal(O.periodDays('mes','2026-11-11').length,11);
  const weeks=O.buckets(O.periodDays('14','2026-11-11'),'semana');
  assert.deepEqual(weeks.map(w=>w.key),['2026-10-30','2026-11-06','2026-11-13']);
  assert.equal(weeks.reduce((n,w)=>n+w.days.length,0),14);
});

test('the queue is summed by the funnel step each stage leads to, only on days with a photo',()=>{
  const q=O.queueByStep(snap,queueSteps,['2026-11-10','2026-11-11'],3);
  assert.deepEqual(q.map(r=>[r.pending,r.executed]),[[70,60],[30,10],[10,9]]);
  // Waiting today: pending minus executed on the last day.
  assert.equal(q[0].today,6);
  assert.equal(q[1].today,8);
});

test('each step lands in its quadrant: execute the queue, review the message or an opportunity',()=>{
  const pts=O.quadrantData([unit],['2026-11-10','2026-11-11']);
  const by=k=>pts.find(p=>p.k===k);
  assert.equal(by(0).kind,'msg');      // 86% executed, but 96% of the goal
  assert.equal(by(1).kind,'exe');      // 33% executed, 0.83× the expected rate
  assert.equal(by(2).kind,'ok');       // 90% executed, 1.23×
  // Converting above its goal with little of the queue executed: an opportunity.
  assert.equal(O.quadrantData([{...unit,funnel:{steps:[steps[0],{...steps[1],rate:.3}]}}],['2026-11-10','2026-11-11']).find(p=>p.k===1).kind,'opp');
});

test('renders the two-column layout: vertical funnel against the goal with the queue below, then the advance and the cross',()=>{
  const html=O.render({units:[unit,{...unit,id:'turnia',name:'Turnia',color:'var(--s1)'}],view:{period:'7',grain:'dia',step:{habita:1,turnia:2}},today:'2026-11-11'});
  assert.match(html,/data-testid="overview-funnel-habita"/);
  assert.match(html,/data-testid="overview-funnel-turnia"/);
  assert.ok(html.indexOf('overview-funnel-habita')<html.indexOf('followup-results'));
  assert.match(html,/class="ov-col is-on[^"]*" data-fu="ov-step" data-fu-unit-id="habita" data-fu-step="1"/);
  assert.match(html,/Acá se frena: Saludos enviados → Demos enviadas convierte 0,8× lo esperado/);
  assert.match(html,/data-testid="overview-advance-habita"/);
  assert.match(html,/EJECUTAR LA COLA/);
  assert.match(html,/hace falta al menos 14 días con datos/);
  assert.doesNotMatch(html,/<script/);
});

test('without the queue photo it says so instead of inventing the cross',()=>{
  const html=O.render({units:[{...unit,snap:{results:{execution:{available:false,days:[]}}}}],view:{period:'7',grain:'dia',step:{}},today:'2026-11-11'});
  assert.match(html,/Todavía no hay foto de la cola en este período/);
  assert.match(O.render({units:[{id:'habita',name:'habita.',loading:true}],view:{},today:'2026-11-11'}),/Cargando el embudo/);
});

test('pearson needs 14 days',()=>{
  assert.equal(O.pearson([1,2,3],[1,2,3]),null);
  const a=Array.from({length:14},(_,i)=>i),b=a.map(x=>x*2+1);
  assert.ok(Math.abs(O.pearson(a,b)-1)<1e-9);
});
