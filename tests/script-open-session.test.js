'use strict';
// Integration test: an existing named Chapa session may edit the script even
// when PROSPECTING_PASSWORD isn't configured. No additional password prompt.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

delete process.env.PROSPECTING_PASSWORD;
process.env.TURNIA_PROSPECTING_SHEET_ID='test-sheet-script';
process.env.HABITA_PROSPECTING_SECRET='a'.repeat(40);
const sheet={};
const original={body:'HABITA SCRIPT ORIGINAL',updated_at:'2026-11-10T11:00:00Z'};
const remote=[];
const google={
  configured:()=>true,
  problem:()=>null,
  serviceEmail:()=> 'test@example.org',
  tabs:async()=>({title:'Test',tabs:Object.keys(sheet)}),
  readTabs:async(_id,names)=>Object.fromEntries(names.map(n=>[n,sheet[n]||[]])),
  addTabs:async(_id,names)=>names.forEach(n=>{sheet[n]=sheet[n]||[];}),
  writeRange:async(_id,tab,start,rows)=>{
    sheet[tab]=sheet[tab]||[];
    rows.forEach((row,i)=>{sheet[tab][start-1+i]=row.slice();});
  },
};
const fetchSource=async(url,options={})=>{
  remote.push({url,options});
  if(options.method==='POST'){
    const incoming=JSON.parse(options.body);
    assert.equal(incoming.followup.op,'script-save');
    original.body=incoming.followup.body;
    original.updated_at='2026-11-10T12:00:00Z';
  }
  return {ok:true,status:200,json:async()=>({...original}),headers:{get:()=>null}};
};
require.cache[path.resolve(__dirname,'../api/_google.js')]={id:'fake-google',loaded:true,exports:google};
require.cache[path.resolve(__dirname,'../api/_authfetch.js')]={id:'fake-fetch',loaded:true,exports:fetchSource};
const handler=require('../api/prospecting');

function request(op,{method='GET',body,query={},cookie}={}){
  const req={method,query:{op,...query},body,headers:{cookie:cookie||'','content-type':body?'application/json':''}};
  const res={
    statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    status(v){this.statusCode=v;return this;},
    json(v){this.body=v;return this;},
  };
  return Promise.resolve(handler(req,res)).then(()=>res);
}
test('Una sesión sin contraseña adicional puede editar y releer el script de TURNIA',async()=>{
  const noSession=await request('script',{method:'POST',body:{unit:'turnia',body:'Texto'}});
  assert.equal(noSession.statusCode,401);
  const login=await request('login',{method:'POST',body:{name:'Facu'}});
  assert.equal(login.statusCode,200);
  const cookie=login.headers['set-cookie'].split(';')[0];
  const before=await request('script',{query:{unit:'turnia'},cookie});
  assert.equal(before.statusCode,200);
  assert.equal(before.body.editable,true);
  assert.equal(before.body.body,'');
  const saved=await request('script',{method:'POST',cookie,body:{unit:'turnia',body:'Paso 1: revisar el lead.'}});
  assert.equal(saved.statusCode,200,JSON.stringify(saved.body));
  assert.equal(saved.body.body,'Paso 1: revisar el lead.');
  const after=await request('script',{query:{unit:'turnia'},cookie});
  assert.equal(after.body.body,'Paso 1: revisar el lead.');
  assert.equal(sheet['Script Chapa Labs'][1][2],'Facu');
});
test('HABITA usa la misma fuente de la extensión y permite guardado con la sesión de Chapa',async()=>{
  const login=await request('login',{method:'POST',body:{name:'Extensión'}});
  const cookie=login.headers['set-cookie'].split(';')[0];
  const before=await request('script',{query:{unit:'habita'},cookie});
  assert.equal(before.statusCode,200);
  assert.equal(before.body.body,'HABITA SCRIPT ORIGINAL');
  assert.equal(before.body.editable,true);
  const saved=await request('script',{method:'POST',cookie,body:{unit:'habita',body:'Script actualizado desde Chapa'}});
  assert.equal(saved.statusCode,200,JSON.stringify(saved.body));
  assert.equal(saved.body.body,'Script actualizado desde Chapa');
  assert.ok(remote.some(x=>x.url.includes('vista=script')));
  assert.ok(remote.some(x=>x.options.method==='POST'&&JSON.parse(x.options.body).by==='Extensión'));
});
test('El servidor mantiene límite de longitud y no permite edición sin sesión',async()=>{
  const login=await request('login',{method:'POST',body:{name:'Facu'}});
  const cookie=login.headers['set-cookie'].split(';')[0];
  const tooLong=await request('script',{method:'POST',cookie,body:{unit:'turnia',body:'x'.repeat(20001)}});
  assert.equal(tooLong.statusCode,400);
  assert.match(tooLong.body.error,/20.000/);
});
