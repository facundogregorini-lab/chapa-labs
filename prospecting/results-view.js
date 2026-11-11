/* Resultados de Follow-up, en tres lecturas, para habita. y Turnia:
 *   1. ¿Se ejecutó la cola? Pendientes → ejecutadas (persona / bot) → exitosas, por día o período,
 *      con el score de ejecución; cada barra se abre en sus tipos de acción.
 *   2. Cohortes con el embudo de Follow-up de cada unidad, como mapa de calor.
 *   3. Qué acciones convierten: una fila por tipo de acción; al abrirla, las etapas donde corrió
 *      y sus versiones.
 * Muestra lo que manda cada producto (amoblaia results / turniasalud results) sin recalcular
 * conversiones: «exitosa» es una ejecución con conversión atribuida, con la definición de cada uno. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ProspectingResults=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const WINDOWS={'7':'7 días','14':'14 días',todo:'Sin límite'};
  const COHORTS={contacto:'Semana de contacto',respuesta:'Semana de primera respuesta',version:'Versión del saludo'};
  const PERIODS={semana:'Esta semana',hoy:'Hoy',ayer:'Ayer','7':'Últimos 7 días',custom:'Elegir fechas'};
  /** El sábado que abre la semana de un día (las semanas de Follow-up van de sábado a viernes). */
  const weekStart=d=>{const t=new Date(String(d)+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+1)%7));return t.toISOString().slice(0,10);};
  const BARS={pending:'Pendientes',executed:'Ejecutadas',success:'Exitosas'};
  const SMALL=30;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('es-AR'):'0';
  const pc=x=>x===null||x===undefined||!Number.isFinite(Number(x))?'—':(Math.round(Number(x)*1000)/10).toLocaleString('es-AR')+'%';
  const ratio=(a,b)=>b?a/b:null;
  const hours=h=>h===null||h===undefined?'—':h<48?Math.round(h)+' h':(h/24).toFixed(1).replace('.',',')+' días';
  const dayLabel=d=>{const t=new Date(String(d)+'T12:00:00Z');return Number.isNaN(t.getTime())?String(d):t.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',timeZone:'UTC'});};
  const weekLabel=w=>{const t=new Date(String(w)+'T12:00:00Z');return Number.isNaN(t.getTime())?String(w):t.toLocaleDateString('es-AR',{day:'numeric',month:'short',timeZone:'UTC'});};
  const STATUS={active:'ACTIVA',test:'EN PRUEBA',archived:'ARCHIVADA'};

  function defaults(view){
    const v=view||{};
    if(!Object.hasOwn(PERIODS,v.period))v.period='semana';
    if(!Object.hasOwn(WINDOWS,v.windowKey))v.windowKey='7';
    if(!Object.hasOwn(COHORTS,v.cohortBy))v.cohortBy='contacto';
    if(!Number.isFinite(v.wCov))v.wCov=60;
    if(!Number.isFinite(v.wOk))v.wOk=40;
    return v;
  }

  // ── 1. La cola ──
  /** Los días que entran en el período elegido (o el día tocado en el gráfico). */
  function selectedDays(days,view){
    if(!days.length)return [];
    if(view.day&&days.some(d=>d.day===view.day))return days.filter(d=>d.day===view.day);
    if(view.period==='hoy')return days.slice(-1);
    if(view.period==='ayer')return days.slice(-2,-1);
    if(view.period==='semana'){const from=weekStart(days[days.length-1].day);return days.filter(d=>d.day>=from);}
    if(view.period==='custom'){
      const from=view.from||days[0].day,to=view.to||days[days.length-1].day;
      return days.filter(d=>d.day>=from&&d.day<=to);
    }
    return days.slice(-7);
  }
  const ZERO=()=>({pending:0,human:0,bot:0,successHuman:0,successBot:0,blocked:0,unclaimed:0,failed:0,scheduled:0});
  /**
   * Suma los días: el total y cada tipo de acción. Solo los días con foto de la cola entran al total, así
   * pendientes, ejecutadas y exitosas son del mismo período; lo ejecutado en días sin foto va aparte.
   */
  function aggregate(list){
    const total=ZERO(),types=new Map();
    let captured=0,outside=0;
    for(const d of list){
      if(d.captured)captured++;
      for(const t of d.types||[]){
        if(!d.captured){outside+=(Number(t.human)||0)+(Number(t.bot)||0);continue;}
        if(!types.has(t.type))types.set(t.type,{type:t.type,stages:[],...ZERO()});
        const acc=types.get(t.type);
        for(const s of t.stages||[])if(!acc.stages.includes(s))acc.stages.push(s);
        for(const k of Object.keys(total)){const n=Number(t[k])||0;acc[k]+=n;total[k]+=n;}
      }
    }
    const executed=total.human+total.bot,success=total.successHuman+total.successBot;
    return {total,executed,success,captured,outside,days:list.length,types:[...types.values()].sort((a,b)=>b.pending-a.pending||a.type.localeCompare(b.type))};
  }
  /** Score = 100 × (cobertura × peso + éxito × peso), solo con los días que tienen foto. */
  function score(list,view){
    const own=list.filter(d=>d.captured);
    if(!own.length)return null;
    const a=aggregate(own);
    const cov=ratio(a.executed,a.total.pending)??0,ok=ratio(a.success,a.executed)??0;
    const w=(view.wCov+view.wOk)||1;
    return {value:Math.round(100*(cov*view.wCov+ok*view.wOk)/w),cov,ok};
  }
  const band=v=>v===null?['Sin foto de la cola','is-none']:v>=85?['Muy bien','is-good']:v>=60?['Hay que empujar','is-warn']:['La cola no se está ejecutando','is-bad'];

  function breakdown(kind,a,stageTitle){
    const rows=a.types.filter(t=>kind==='pending'?t.pending:kind==='executed'?t.human+t.bot:t.successHuman+t.successBot);
    if(!rows.length)return '<p class="rs-muted">Nada en este período.</p>';
    const max=Math.max(1,...rows.map(t=>kind==='pending'?t.pending:t.human+t.bot));
    const stages=t=>t.stages.map(s=>stageTitle(s)).join(' · ');
    const head=kind==='pending'?'<th>Pendientes</th><th>Ejecutadas</th><th>Bloqueadas</th><th>Sin tomar</th><th>No salieron</th>'
      :kind==='executed'?'<th>Ejecutadas</th><th>Persona</th><th>Bot</th><th>De las pendientes</th>'
      :'<th>Exitosas</th><th>Persona</th><th>Bot</th><th>De las ejecutadas</th>';
    const cells=t=>{
      const ex=t.human+t.bot,ok=t.successHuman+t.successBot;
      if(kind==='pending')return `<td>${num(t.pending)}</td><td>${num(ex)}</td><td>${num(t.blocked)}</td><td>${num(t.unclaimed)}</td><td>${num(t.failed)}</td>`;
      if(kind==='executed')return `<td>${num(ex)}</td><td>${num(t.human)}</td><td>${num(t.bot)}</td><td>${pc(ratio(ex,t.pending))}</td>`;
      return `<td>${num(ok)}</td><td>${num(t.successHuman)}</td><td>${num(t.successBot)}</td><td>${pc(ratio(ok,ex))}</td>`;
    };
    const bar=t=>{
      const ex=t.human+t.bot,ok=t.successHuman+t.successBot;
      const base=kind==='pending'?t.pending:ex;
      const fill=kind==='pending'?ex:kind==='executed'?t.human:ok;
      return `<span class="rs-mini"><i class="is-base" style="width:${Math.round(base/max*100)}%"></i><i class="${kind==='executed'?'is-human':'is-ok'}" style="width:${Math.round(fill/max*100)}%"></i>${kind==='executed'&&t.bot?`<i class="is-bot" style="left:${Math.round(t.human/max*100)}%;width:${Math.round(t.bot/max*100)}%"></i>`:''}</span>`;
    };
    return `<div class="rs-table-scroll"><table class="rs-breakdown" data-testid="results-breakdown-${kind}"><thead><tr><th>Tipo de acción</th><th></th>${head}</tr></thead><tbody>
      ${rows.map(t=>`<tr><td><b>${esc(t.type)}</b><small>${esc(stages(t))}</small></td><td>${bar(t)}</td>${cells(t)}</tr>`).join('')}
    </tbody></table></div>`;
  }

  function queueSection(unit,snap,view,stageTitle){
    const ex=snap?.results?.execution;
    const days=Array.isArray(ex?.days)?ex.days:[];
    const list=selectedDays(days,view);
    const a=aggregate(list);
    const sc=score(list,view);
    const [bandText,bandClass]=band(sc?sc.value:null);
    const t=a.total,max=Math.max(1,t.pending,a.executed);
    const w=n=>Math.max(n?3:0,Math.round(n/max*100));
    const human=ratio(t.human,a.executed),bot=ratio(t.bot,a.executed);
    const noPhoto=a.days-a.captured;
    const bars=[
      ['pending','Pendientes','en la cola del período',`<span class="is-pending" style="width:100%">${num(t.pending)} acciones</span>`,100,num(t.pending),a.captured?'100%':'sin foto'],
      ['executed','Ejecutadas','persona + bot',`<span class="is-human" style="width:${human===null?0:human*100}%">${human?pc(human)+' persona':''}</span><span class="is-bot" style="width:${bot===null?0:bot*100}%">${bot?pc(bot)+' bot':''}</span>`,w(a.executed),num(a.executed),a.captured?pc(ratio(a.executed,t.pending))+' de pendientes':''],
      ['success','Exitosas','con conversión atribuida',`<span class="is-ok" style="width:100%">${a.executed?pc(ratio(a.success,a.executed))+' de ejecutadas':''}</span>`,w(a.success),num(a.success),`persona ${pc(ratio(t.successHuman,t.human))} · bot ${pc(ratio(t.successBot,t.bot))}`],
    ];
    const chart=(view.period==='7'||view.period==='semana'||view.period==='custom')&&days.length;
    const shown=view.period==='7'?days.slice(-7):selectedDays(days,{...view,day:null});
    const dmax=Math.max(1,...shown.map(d=>{const x=aggregate([d]);return Math.max(x.total.pending,x.executed);}));
    const reasons=Array.isArray(snap?.results?.blocks)?snap.results.blocks:[];
    return `<section class="rs-card" data-testid="results-queue">
      <div class="rs-head"><div><h2><span class="rs-step">1</span>¿Se ejecutó la cola?</h2>
        <p>Lo que la cola le asignó a cada día (los saludos, hasta el cupo diario): cuántas se ejecutaron, quién las hizo y cuántas tuvieron conversión. Tocá una barra para ver los tipos de acción.</p></div>
        <div class="rs-controls"><nav class="rs-seg" aria-label="Período">${Object.entries(PERIODS).map(([k,l])=>`<button type="button" class="${view.period===k&&!view.day?'is-on':''}" aria-pressed="${view.period===k&&!view.day}" data-fu="results-period" data-fu-period="${k}" data-testid="results-period-${k}">${l}</button>`).join('')}</nav>
        ${view.period==='custom'?`<div class="rs-dates"><label>Desde <input type="date" class="input" data-fu-results-date="from" value="${esc(view.from||days[0]?.day||'')}" min="${esc(days[0]?.day||'')}" max="${esc(days.at(-1)?.day||'')}"></label><label>hasta <input type="date" class="input" data-fu-results-date="to" value="${esc(view.to||days.at(-1)?.day||'')}" min="${esc(days[0]?.day||'')}" max="${esc(days.at(-1)?.day||'')}"></label></div>`:''}
        </div></div>
      ${ex?.available===false?'<p class="rs-note">Todavía no se guarda la foto diaria de la cola de este producto: se ve lo ejecutado, pero no lo que quedó pendiente.</p>':noPhoto&&a.days?`<p class="rs-note">${num(noPhoto)} ${noPhoto===1?'día no tiene':'días no tienen'} foto de la cola (antes de que empezara a guardarse): quedan fuera de estos números${a.outside?` (en esos días se ejecutaron ${num(a.outside)} acciones)`:''}. Todo se cuenta sobre ${num(a.captured)} ${a.captured===1?'día':'días'} con foto.</p>`:''}
      ${view.day?`<p class="rs-note">Mostrando solo el ${esc(dayLabel(view.day))}. <button type="button" class="rs-link" data-fu="results-day" data-fu-day="">Ver todo el período</button></p>`:''}
      <div class="rs-exec">
        <div class="rs-funnel">
          ${bars.map(([key,title,sub,inner,width,value,hint])=>`<button type="button" class="rs-frow ${view.open===key?'is-open':''}" aria-expanded="${view.open===key}" data-fu="results-open" data-fu-bar="${key}" data-testid="results-bar-${key}">
            <span class="rs-flabel"><b>${title}</b><small>${sub}</small></span>
            <span class="rs-ftrack"><span class="rs-fbar" style="width:${width}%">${inner}</span></span>
            <span class="rs-fval"><strong>${value}</strong><small>${esc(hint)}</small></span></button>
            ${key==='executed'&&a.captured?`<div class="rs-leak"><span>Sin ejecutar <b>${num(Math.max(0,t.pending-a.executed))}</b></span><span>bloqueadas ${num(t.blocked)}</span><span>sin tomar ${num(t.unclaimed)}</span><span>no salieron ${num(t.failed)}</span><span class="rs-muted" title="Saludos fuera del cupo diario, programadas para otro día y las que esperan que la persona conteste">para otro día ${num(t.scheduled)} (no cuentan)</span></div>`:''}
            ${view.open===key?`<div class="rs-open" data-testid="results-open-${key}"><h3>${BARS[key]} por tipo de acción</h3>${breakdown(key,a,stageTitle)}</div>`:''}`).join('')}
          ${chart?`<div class="rs-days" aria-label="Detalle por día">${shown.map(d=>{const x=aggregate([d]);const s=score([d],view);const [,c]=band(s?s.value:null);
            return `<button type="button" class="rs-day ${view.day===d.day?'is-on':''}" aria-pressed="${view.day===d.day}" data-fu="results-day" data-fu-day="${esc(d.day)}" title="${esc(dayLabel(d.day))}: ${num(x.total.pending)} pendientes, ${num(x.executed)} ejecutadas">
              <span class="rs-cols"><i class="is-base" style="height:${Math.round(x.total.pending/dmax*64)}px"></i><i class="is-ok" style="height:${Math.round(x.executed/dmax*64)}px"></i></span>
              <b class="${c}">${s?s.value:'—'}</b><small>${esc(dayLabel(d.day))}</small></button>`;}).join('')}</div>
            <p class="rs-muted">Columnas: pendientes (gris) y ejecutadas (verde); abajo, el score del día. Tocá un día para ver solo ese día.</p>`:''}
        </div>
        <aside class="rs-score" data-testid="results-score">
          <span class="rs-kicker">Score de ejecución</span>
          <svg viewBox="0 0 120 120" role="img" aria-label="Score ${sc?sc.value:'sin datos'} de 100"><circle cx="60" cy="60" r="50" class="rs-ring"/><circle cx="60" cy="60" r="50" class="rs-arc ${bandClass}" transform="rotate(-90 60 60)" stroke-dasharray="314.16" stroke-dashoffset="${(314.16*(1-(sc?sc.value:0)/100)).toFixed(1)}"/>
            <text x="60" y="66" text-anchor="middle" class="rs-score-num">${sc?sc.value:'—'}</text><text x="60" y="84" text-anchor="middle" class="rs-score-of">de 100</text></svg>
          <b class="rs-band ${bandClass}">${bandText}</b>
          <dl><dt>Cobertura (${Math.round(view.wCov/((view.wCov+view.wOk)||1)*100)}%)</dt><dd>${pc(sc?.cov)}</dd><dt>Éxito (${Math.round(view.wOk/((view.wCov+view.wOk)||1)*100)}%)</dt><dd>${pc(sc?.ok)}</dd><dt>Ejecutó una persona</dt><dd>${pc(human)}</dd><dt>Ejecutó un bot</dt><dd>${pc(bot)}</dd></dl>
          <details class="rs-weights" ${view.weightsOpen?'open':''}><summary data-fu="results-weights-toggle">Configurar el score</summary>
            <label>Peso de la cobertura: <b>${view.wCov}%</b><input type="range" min="0" max="100" step="5" value="${view.wCov}" data-fu-results-weight="wCov" aria-label="Peso de la cobertura"></label>
            <label>Peso del éxito: <b>${view.wOk}%</b><input type="range" min="0" max="100" step="5" value="${view.wOk}" data-fu-results-weight="wOk" aria-label="Peso del éxito"></label>
            <small>Cobertura: ejecutadas ÷ pendientes. Éxito: exitosas ÷ ejecutadas. Los pesos se normalizan a 100. Verde desde 85, ámbar de 60 a 84, rojo debajo de 60.</small></details>
        </aside>
      </div>
      ${reasons.length&&view.open==='pending'?`<div class="rs-open"><h3>Por qué están bloqueadas ahora</h3><ul class="rs-reasons">${reasons.slice(0,8).map(b=>`<li><span>${esc(b.reason)}</span><b>${num(b.n)}</b></li>`).join('')}</ul></div>`:''}
    </section>`;
  }

  // ── 2. Acciones ──
  function actionRows(unit,snap,view,stageTitle,label){
    let versions;
    if(unit==='habita'){
      const w=snap?.results?.windows?.[view.windowKey];
      versions=Array.isArray(w?.versions)?w.versions:[];
    }else{
      versions=[];
      for(const s of snap?.stages||[])for(const v of s.versions||[]){
        const st=v.stats||{};
        versions.push({versionId:v.id,stage:s.key,action:v.action||'principal',version:v.version,status:v.status,executed:st.executions||0,conversions:st.conversions||0,
          rate:st.executions?(st.conversions||0)/st.executions:null,medianHours:null,failed:st.failed||0,smallSample:(st.executions||0)<SMALL});
      }
      const groups=new Map();
      for(const v of versions){const k=v.stage+':'+v.action;groups.set(k,[...(groups.get(k)||[]),v]);}
      for(const list of groups.values()){const m=list.filter(v=>!v.smallSample&&v.rate!==null);if(m.length>1)m.reduce((a,b)=>b.rate>a.rate?b:a).best=true;}
    }
    const weekly=(unit==='habita'?snap?.results?.windows?.[view.windowKey]?.weeklyByType:snap?.results?.weeklyByType)||{};
    const byType=new Map();
    for(const v of versions){
      if(!v.executed&&v.status==='archived')continue;
      const type=label(v.stage,v.action);
      if(!byType.has(type))byType.set(type,{type,executed:0,conversions:0,stages:new Map()});
      const g=byType.get(type);
      g.executed+=v.executed;g.conversions+=v.conversions;
      if(!g.stages.has(v.stage))g.stages.set(v.stage,{stage:v.stage,executed:0,conversions:0,hours:[],versions:[]});
      const s=g.stages.get(v.stage);
      s.executed+=v.executed;s.conversions+=v.conversions;s.versions.push(v);
      if(v.medianHours!==null&&v.medianHours!==undefined&&v.executed)s.hours.push(v.medianHours);
    }
    const rows=[...byType.values()].sort((a,b)=>b.executed-a.executed||a.type.localeCompare(b.type));
    const max=Math.max(1,...rows.map(r=>r.executed));
    const order=(snap?.stages||[]).map(s=>s.key);
    const spark=list=>{
      if(!Array.isArray(list)||list.length<2)return '';
      const pts=list.map(w=>w.executed?w.conversions/w.executed:0);
      const top=Math.max(0.01,...pts);
      const xy=pts.map((p,i)=>[(i/(pts.length-1)*104+3).toFixed(1),(27-p/top*22).toFixed(1)]);
      const d=xy.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ');
      const last=xy[xy.length-1];
      return `<svg class="rs-spark" viewBox="0 0 110 30" aria-hidden="true"><path d="${d} L${last[0]} 30 L3 30 Z" class="rs-spark-area"/><path d="${d}" class="rs-spark-line"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" class="rs-spark-dot"/></svg>`;
    };
    return `<section class="rs-card" data-testid="results-actions">
      <div class="rs-head"><div><h2><span class="rs-step">3</span>Qué acciones convierten</h2>
        <p>Una fila por tipo de acción, sumando todas las etapas donde corre. Tocá o hacé doble clic en una fila para ver en qué etapas se ejecutó y cómo le fue a cada versión.</p></div>
        ${unit==='habita'?`<nav class="rs-seg" aria-label="Ventana de conversión">${Object.entries(WINDOWS).map(([k,l])=>`<button type="button" class="${view.windowKey===k?'is-on':''}" aria-pressed="${view.windowKey===k}" data-fu="results-window" data-fu-window="${k}" data-testid="followup-window-${k}">${l}</button>`).join('')}</nav>`:'<span class="rs-muted">Conversión: avanzó de paso después del envío</span>'}</div>
      <div class="rs-act-head" aria-hidden="true"><span></span><span>Acción</span><span>Ejecutadas y conversiones</span><span>Ejec.</span><span>Conv.</span><span>Tasa · 8 semanas</span></div>
      <div class="rs-acts">${rows.map(r=>{const open=view.action===r.type;const hit=new Set(r.stages.keys());
        return `<div class="rs-act ${open?'is-open':''}" role="button" tabindex="0" aria-expanded="${open}" data-fu="results-action" data-fu-action-type="${esc(r.type)}" data-testid="results-action-row">
          <span class="rs-chev" aria-hidden="true">›</span>
          <span class="rs-act-name"><b>${esc(r.type)}</b><small>${r.stages.size} ${r.stages.size===1?'etapa':'etapas'}</small></span>
          <span class="rs-dual"><i class="is-base" style="width:${Math.round(r.executed/max*100)}%"></i><i class="is-ok" style="width:${Math.round(r.conversions/max*100)}%"></i></span>
          <span class="rs-n">${num(r.executed)}</span><span class="rs-n rs-conv">${num(r.conversions)}</span>
          <span class="rs-rate"><b>${pc(ratio(r.conversions,r.executed))}</b>${r.executed<SMALL&&r.executed?'<small>muestra chica</small>':''}${spark(weekly[r.type])}</span></div>
        ${open?`<div class="rs-inst" data-testid="results-action-instances"><span class="rs-kicker">Dónde se ejecutó en el embudo</span>
          <div class="rs-path">${order.map((k,i)=>`<span class="rs-stage ${hit.has(k)?'is-hit':''}">${esc(stageTitle(k))}</span>${i<order.length-1?'<i>›</i>':''}`).join('')}</div>
          <div class="rs-inst-grid">${[...r.stages.values()].sort((a,b)=>order.indexOf(a.stage)-order.indexOf(b.stage)).map(s=>{const vmax=Math.max(0.0001,...s.versions.map(v=>v.rate||0));const h=s.hours.length?s.hours.sort((a,b)=>a-b)[Math.floor((s.hours.length-1)/2)]:null;
            return `<article class="rs-inst-card"><h4>${esc(stageTitle(s.stage))}</h4>
              <div class="rs-big"><div><strong>${num(s.executed)}</strong><small>ejecutadas</small></div><div><strong>${num(s.conversions)}</strong><small>conversiones</small></div><div><strong>${pc(ratio(s.conversions,s.executed))}</strong><small>tasa</small></div>${unit==='habita'?`<div><strong>${esc(hours(h))}</strong><small>tiempo mediano</small></div>`:''}</div>
              <div class="rs-vers">${s.versions.sort((a,b)=>b.version-a.version).map(v=>`<div class="rs-ver"><b>V${num(v.version)}</b><span class="rs-vbar"><i style="width:${Math.round((v.rate||0)/vmax*100)}%"></i></span><span>${pc(v.rate)}</span>
                <small>${num(v.executed)} ejecutadas${v.assisted?` · +${num(v.assisted)} asistencias`:''}${v.failed?` · ${num(v.failed)} no salieron`:''}${v.status&&v.status!=='active'?` · ${esc(STATUS[v.status]||v.status)}`:''}${v.best?' <em class="rs-pill is-best">MEJOR</em>':v.executed&&v.smallSample?' <em class="rs-pill">MUESTRA CHICA</em>':''}</small></div>`).join('')}</div></article>`;}).join('')}</div></div>`:''}`;}).join('')||'<p class="rs-muted">Todavía no hay acciones ejecutadas.</p>'}</div>
      <p class="rs-muted">${unit==='habita'?'Conversión: la inmobiliaria pasó del paso en que estaba al recibir el mensaje, dentro de la ventana. Si varios mensajes la precedieron, cuenta solo el último (los otros son asistencias). ':'Conversión: la persona avanzó de paso después del envío, con la definición de Turnia. '}«MEJOR» solo entre versiones con ${SMALL} o más ejecutadas.</p>
    </section>`;
  }

  // ── 3. Cohortes ──
  function cohortSection(unit,cf,view){
    const stages=Array.isArray(cf?.stages)?cf.stages:[];
    const options=Object.entries(COHORTS).filter(([k])=>Array.isArray(cf?.[k]));
    const by=Array.isArray(cf?.[view.cohortBy])?view.cohortBy:'contacto';
    const all=Array.isArray(cf?.[by])?cf[by]:[];
    // Las semanas vacías del principio no dicen nada: la tabla arranca en la primera con contactos.
    const first=all.findIndex(c=>Number(c.size)>0);
    const rows=first<0?[]:all.slice(first);
    const who=unit==='habita'?'inmobiliarias':'odontólogos';
    return `<section class="rs-card" data-testid="results-cohorts">
      <div class="rs-head"><div><h2><span class="rs-step">2</span>Cohortes</h2>
        <p>Con las etapas del embudo de Follow-up, desde ${unit==='habita'?'Contactado':'Saludado'}. Cada celda es el porcentaje de la cohorte que llegó a esa etapa: cuanto más oscura, mejor.</p></div>
        ${options.length>1?`<nav class="rs-seg" aria-label="Agrupación de cohortes">${options.map(([k,l])=>`<button type="button" class="${by===k?'is-on':''}" aria-pressed="${by===k}" data-fu="results-cohort" data-fu-cohort="${k}" data-testid="followup-cohort-${k}">${l}</button>`).join('')}</nav>`:''}</div>
      ${stages.length?`<div class="rs-table-scroll"><table class="rs-heat" data-testid="followup-results-cohorts"><thead><tr><th>${by==='version'?'Segmento':'Semana'}</th>${stages.map(s=>`<th>${esc(s.title)}</th>`).join('')}</tr></thead><tbody>
        ${rows.map(c=>`<tr><td class="rs-heat-lbl">${esc(by==='version'?c.cohort:weekLabel(c.cohort))}<small>${num(c.size)} ${who}</small></td>${stages.map((s,i)=>{const n=Number(c.reached?.[i])||0;const r=c.size?n/c.size:0;
          return `<td class="rs-heat-cell" style="--rs-a:${(0.06+r*0.94).toFixed(2)}" data-dark="${r>0.45}" title="${esc(s.title)}: ${num(n)} de ${num(c.size)}"><b>${c.size?pc(r):'—'}</b><small>${num(n)}</small></td>`;}).join('')}</tr>`).join('')||`<tr><td colspan="${stages.length+1}">Sin cohortes en este período.</td></tr>`}
      </tbody></table></div>
      <div class="rs-scale"><span>0%</span><i></i><span>100%</span>${by!=='version'?'<span class="rs-muted">Las semanas cierran el viernes; la última todavía está madurando.</span>':''}</div>`
      :'<p class="rs-muted">No se pudieron consultar las cohortes.</p>'}
    </section>`;
  }

  /** Turnia: las cohortes con las etapas de Odontólogos, desde las filas que ya arma Chapa (agencies.js fromAccounts). */
  function turniaCohorts(rows,stages,weeks=8,now=new Date()){
    const order=stages.map(s=>s.key);
    const reach=r=>{
      if(r.stage!=='closed')return Math.max(0,order.indexOf(r.stage));
      const step=Number(r.step)||0;return step>=6?5:step>=5?4:step>=3?3:step>=2?2:1;
    };
    const weekOf=iso=>{const t=new Date(Date.parse(iso)-3*3600000);t.setUTCDate(t.getUTCDate()+((5-t.getUTCDay()+7)%7));return t.toISOString().slice(0,10);};
    const last=Date.parse(weekOf(now.toISOString())+'T00:00:00Z');
    const list=Array.from({length:weeks},(_,i)=>new Date(last-(weeks-1-i)*7*86400000).toISOString().slice(0,10));
    const contacted=(rows||[]).filter(r=>r.stage!=='prospect'&&r.createdAt&&!String(r.createdAt).startsWith('2000-'));
    const cohort=(own,key)=>({cohort:key,size:own.length,reached:order.map((_,i)=>own.filter(r=>reach(r)>=i).length)});
    const out={stages,contacto:list.map(w=>cohort(contacted.filter(r=>weekOf(r.createdAt)===w),w))};
    const replied=(rows||[]).filter(r=>r.repliedAt);
    if(replied.length)out.respuesta=list.map(w=>cohort(replied.filter(r=>weekOf(r.repliedAt)===w),w));
    return out;
  }

  /**
   * unit: 'habita' | 'turnia'; snap: la foto de Follow-up de la unidad; view: el estado de la vista;
   * ctx.cohorts: las cohortes (habita: results.cohortFunnel; Turnia: turniaCohorts).
   */
  function render(unit,snap,view,ctx={}){
    if(!snap?.results)return '<section class="rs-card" role="alert"><p>No se pudieron consultar los resultados.</p></section>';
    const v=defaults(view);
    const titles=Object.fromEntries((snap.stages||[]).map(s=>[s.key,s.title]));
    const stageTitle=k=>titles[k]||snap.results.execution?.stages?.[k]||k;
    const labels=snap.results.actionLabels||{};
    const fallback=snap.catalog?.actions;
    const label=(stage,action)=>labels[`${stage}:${action||'principal'}`]||labels[stage]
      ||(fallback?.[stage]||[]).find(a=>a.key===action)?.label||action||'Mensaje de la etapa';
    const cohorts=ctx.cohorts||snap.results.cohortFunnel;
    return `<div class="rs" data-unit-results="${esc(unit)}" data-testid="followup-results">
      ${queueSection(unit,snap,v,stageTitle)}
      ${cohortSection(unit,cohorts,v)}
      ${actionRows(unit,snap,v,stageTitle,label)}
    </div>`;
  }
  /** Solo «¿Se ejecutó la cola?», para el Resumen general. */
  function renderQueue(unit,snap,view){
    if(!snap?.results)return '<section class="rs-card" role="alert"><p>No se pudo consultar la ejecución de la cola.</p></section>';
    const titles=Object.fromEntries((snap.stages||[]).map(s=>[s.key,s.title]));
    return `<div class="rs" data-unit-results="${esc(unit)}">${queueSection(unit,snap,defaults(view),k=>titles[k]||snap.results.execution?.stages?.[k]||k)}</div>`;
  }
  return {render,renderQueue,turniaCohorts,selectedDays,aggregate,score,defaults};
});
