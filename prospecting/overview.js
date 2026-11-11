/* Resumen general: ¿la ejecución de las colas está moviendo los embudos?
 *   1. Cada producto en su columna: su embudo contra la meta (barras verticales) y, debajo, la
 *      ejecución de su cola tal cual está en Resultados (results-view.js).
 *   2. Cómo avanzó: la cohorte contactada cada día o semana, en el paso elegido, contra la meta, con
 *      las acciones de la cola que llevan a ese paso.
 *   3. Ejecución → avance: cada paso por cuánto se ejecutó su cola y cuánto convirtió contra la meta,
 *      y qué conviene hacer.
 * Puro: recibe los números ya calculados con las reglas del panel (core.js targetFunnel) y la foto de
 * Follow-up de cada producto. Nunca mezcla tasas entre productos. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ProspectingOverview=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const PERIODS=[['semana','Esta semana'],['7','Últimos 7 días'],['14','14 días'],['30','30 días'],['mes','Este mes']];
  const GRAINS=[['dia','Día'],['semana','Semana']];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':Number(n)<10&&Number(n)%1?Number(n).toLocaleString('es-AR',{maximumFractionDigits:1}):Math.round(Number(n)).toLocaleString('es-AR');
  const pc=x=>x===null||x===undefined||!Number.isFinite(Number(x))?'—':(Math.round(Number(x)*1000)/10).toLocaleString('es-AR')+'%';
  const times=x=>x===null||x===undefined||!Number.isFinite(x)?'—':(Math.round(x*10)/10).toLocaleString('es-AR')+'×';
  const ratio=(a,b)=>b?a/b:null;
  const dayLabel=d=>{const t=new Date(String(d)+'T12:00:00Z');return Number.isNaN(t.getTime())?String(d):t.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',timeZone:'UTC'});};
  const shortDay=d=>{const t=new Date(String(d)+'T12:00:00Z');return Number.isNaN(t.getTime())?String(d):t.toLocaleDateString('es-AR',{day:'numeric',month:'short',timeZone:'UTC'});};

  /** The days of a period ending today (YYYY-MM-DD, Buenos Aires), oldest first. */
  function periodDays(key,today){
    const t=new Date(today+'T12:00:00Z');
    // «Esta semana»: desde el sábado, como las semanas de Follow-up (sábado a viernes).
    const n=key==='mes'?t.getUTCDate():key==='semana'?((t.getUTCDay()+1)%7)+1:Number(key)||7;
    return Array.from({length:n},(_,i)=>new Date(t.getTime()-(n-1-i)*86400000).toISOString().slice(0,10));
  }

  /** Days grouped by Sat–Fri reporting week (the same weeks as Follow-up), each with its own days. */
  function buckets(days,grain){
    if(grain!=='semana')return days.map(d=>({key:d,label:dayLabel(d),days:[d]}));
    const out=[];
    for(const d of days){
      const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+((5-t.getUTCDay()+7)%7));
      const key=t.toISOString().slice(0,10);
      let b=out.find(x=>x.key===key);
      if(!b){b={key,label:'Sem. al '+shortDay(key),days:[]};out.push(b);}
      b.days.push(d);
    }
    return out;
  }

  /** The queue of the stages that lead to each funnel step, summed over the period's days with a photo. */
  function queueByStep(snap,queueSteps,days,stepCount){
    const set=new Set(days);
    const rows=Array.from({length:stepCount},()=>({pending:0,executed:0,success:0,today:0,captured:0}));
    const list=snap?.results?.execution?.days||[];
    const last=list[list.length-1];
    for(const d of list){
      if(!set.has(d.day)||!d.captured)continue;
      for(const s of d.stages||[]){
        const k=queueSteps[s.stage];
        if(k===undefined||!rows[k])continue;
        rows[k].pending+=s.pending;rows[k].executed+=s.executed;rows[k].success+=s.success;rows[k].captured++;
      }
    }
    for(const s of last?.stages||[]){const k=queueSteps[s.stage];if(k!==undefined&&rows[k])rows[k].today+=Math.max(0,s.pending-s.executed);}
    return rows;
  }
  /** Executed actions per day for the stages of one step (with a photo or not: what was executed is known). */
  function executedByDay(snap,queueSteps,k){
    const out={};
    for(const d of snap?.results?.execution?.days||[]){
      let n=0,p=0;
      for(const s of d.stages||[])if(queueSteps[s.stage]===k){n+=s.executed;p+=s.pending;}
      out[d.day]={executed:n,pending:d.captured?p:null};
    }
    return out;
  }

  function pearson(a,b){
    const n=a.length;if(n<14)return null;
    const ma=a.reduce((s,x)=>s+x,0)/n,mb=b.reduce((s,x)=>s+x,0)/n;
    let c=0,da=0,db=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2;}
    return da&&db?c/Math.sqrt(da*db):null;
  }

  // ── 1. El embudo contra la meta, en barras verticales ──
  function funnelCard(u,view){
    const steps=u.funnel?.steps||[];
    if(!steps.length)return `<section class="ov-card"><h3>${esc(u.name)}</h3><p class="ov-muted">${u.loading?'Cargando el embudo…':'No pudimos calcular el embudo contra la meta.'}</p></section>`;
    // A square-root scale keeps the last steps visible: 250 saludos and 2 clientes on the same chart.
    const top=Math.max(1,...steps.map(s=>Math.max(s.actual||0,s.target||0)));
    const h=v=>v?Math.max(3,Math.sqrt(v/top)*150):0;
    let worst=null;
    steps.forEach((s,i)=>{if(!i||s.rate==null||!s.targetRate)return;const r=s.rate/s.targetRate;if(!worst||r<worst.r)worst={i,r};});
    const selected=view.step?.[u.id]??1;
    const cols=steps.map((s,i)=>{
      const r=i&&s.rate!=null&&s.targetRate?s.rate/s.targetRate:null;
      const reach=s.actual!=null&&s.target?s.actual/s.target:null;
      const cls=s.actual==null?'is-none':(i?r:reach)>=1?'is-good':(i?r:reach)>=.8?'is-warn':'is-bad';
      return `<button type="button" class="ov-col ${selected===i?'is-on':''} ${worst&&worst.i===i&&worst.r<1?'is-worst':''}" data-fu="ov-step" data-fu-unit-id="${esc(u.id)}" data-fu-step="${i}" aria-pressed="${selected===i}" aria-label="${esc(s.label)}: ${num(s.actual)} de una meta de ${num(s.target)}">
          <span class="ov-val">${s.actual==null?'—':num(s.actual)}</span>
          <span class="ov-bars"><i class="ov-goal" style="height:${h(s.target).toFixed(1)}px"></i><i class="ov-real" style="height:${h(s.actual||0).toFixed(1)}px"></i></span>
          <span class="ov-name">${esc(s.label)}</span><small>meta ${num(s.target)}</small>
          <span class="ov-conv ${cls}" title="${i?`Conversión desde «${esc(steps[i-1].label)}»: ${pc(s.rate)}, esperada ${pc(s.targetRate)}`:`${pc(reach)} de la meta`}">${i?`<b>${s.rate==null?'—':pc(s.rate)}</b><small>esp. ${pc(s.targetRate)}</small>`:`<b>${pc(reach)}</b><small>de la meta</small>`}</span></button>`;}).join('');
    return `<section class="ov-card ov-funnel" style="--ov-c:${esc(u.color)}" data-testid="overview-funnel-${esc(u.id)}">
      <div class="ov-head"><h3><i class="ov-dot"></i>${esc(u.name)}</h3><span class="ov-muted">${num(steps.at(-1).actual)} de ${num(steps.at(-1).target)} ${esc(steps.at(-1).label.toLowerCase())} · meta de ${num(u.perWeek)} saludos por semana</span></div>
      <div class="ov-cols">${cols}</div>
      ${worst&&worst.r<1?`<p class="ov-flag">Acá se frena: ${esc(steps[worst.i-1].label)} → ${esc(steps[worst.i].label)} convierte ${times(worst.r)} lo esperado.</p>`:'<p class="ov-flag is-ok">Todos los pasos convierten en meta o por encima.</p>'}
      <div class="ov-legend"><span><i class="is-real"></i>Logrado</span><span><i class="is-goal"></i>Meta del período</span><span>Debajo de cada paso: su conversión desde el anterior y la esperada. Tocá un paso para seguirlo abajo.</span></div>
    </section>`;
  }

  // ── 2. Cómo avanzó ──
  function advanceCard(u,view,days){
    const k=view.step?.[u.id]??1;
    const step=u.funnel?.steps?.[k];
    if(!step)return '';
    const bs=buckets(days,view.grain);
    const byDay=new Map((u.daily||[]).map(d=>[d.date,d]));
    const exec=executedByDay(u.snap,u.queueSteps,k);
    const rows=bs.map(b=>{
      const vals=b.days.map(d=>byDay.get(d)?.steps?.[k]);
      const known=vals.filter(v=>v!=null);
      return {label:b.label,actual:known.length?known.reduce((s,v)=>s+v,0):null,
        target:b.days.reduce((s,d)=>s+(byDay.get(d)?.targets?.[k]||0),0),
        executed:b.days.reduce((s,d)=>s+(exec[d]?.executed||0),0)};
    });
    const W=560,H=210,P={l:34,r:12,t:16,b:64},iw=W-P.l-P.r,ih=H-P.t-P.b,bw=iw/Math.max(1,rows.length);
    const amax=Math.max(1,...rows.map(r=>Math.max(r.actual||0,r.target||0)))*1.12;
    const emax=Math.max(1,...rows.map(r=>r.executed));
    const y=v=>P.t+ih-v/amax*ih;
    const every=Math.ceil(rows.length/9);
    const total=rows.reduce((s,r)=>s+(r.actual||0),0),goal=rows.reduce((s,r)=>s+r.target,0);
    const svg=`<svg class="ov-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(step.label)} por ${view.grain==='semana'?'semana':'día'} en ${esc(u.name)}">
      ${[0,.5,1].map(f=>{const v=amax/1.12*f;return `<line class="ov-ax" x1="${P.l}" x2="${W-P.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${P.l-6}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${num(v)}</text>`;}).join('')}
      ${rows.map((r,i)=>{const x=P.l+i*bw;return `
        <rect x="${(x+bw*.16).toFixed(1)}" y="${y(r.target).toFixed(1)}" width="${(bw*.68).toFixed(1)}" height="${(P.t+ih-y(r.target)).toFixed(1)}" rx="3" class="ov-goalbar"><title>Meta ${num(r.target)}</title></rect>
        ${r.actual==null?'':`<rect x="${(x+bw*.26).toFixed(1)}" y="${y(r.actual).toFixed(1)}" width="${(bw*.48).toFixed(1)}" height="${(P.t+ih-y(r.actual)).toFixed(1)}" rx="3" class="ov-realbar"><title>${esc(r.label)}: ${num(r.actual)} llegaron, meta ${num(r.target)}, ${num(r.executed)} acciones ejecutadas</title></rect>`}
        <rect x="${(x+bw*.26).toFixed(1)}" y="${(H-2-r.executed/emax*18).toFixed(1)}" width="${(bw*.48).toFixed(1)}" height="${(r.executed/emax*18).toFixed(1)}" class="ov-execbar"><title>${num(r.executed)} ejecutadas</title></rect>
        ${i%every?'':`<text x="${(x+bw/2).toFixed(1)}" y="${P.t+ih+13}" text-anchor="middle">${esc(r.label)}</text>`}`;}).join('')}
      <text x="${P.l}" y="${H-25}" class="ov-lbl">Acciones ejecutadas de la cola que lleva a este paso</text>
    </svg>`;
    return `<article class="ov-card" style="--ov-c:${esc(u.color)}" data-testid="overview-advance-${esc(u.id)}">
      <div class="ov-head"><h3><i class="ov-dot"></i>${esc(u.name)} · ${esc(step.label)}</h3><span class="ov-muted">${num(total)} de una meta de ${num(goal)} · ${num(rows.reduce((s,r)=>s+r.executed,0))} ejecutadas</span></div>
      ${svg}</article>`;
  }

  // ── 3. Ejecución → avance ──
  function quadrantData(units,days){
    const pts=[];
    for(const u of units){
      const steps=u.funnel?.steps||[];
      const q=queueByStep(u.snap,u.queueSteps,days,steps.length);
      steps.forEach((s,k)=>{
        const row=q[k];
        if(!row||!row.pending)return;
        const conv=k?(s.rate!=null&&s.targetRate?s.rate/s.targetRate:null):(s.actual!=null&&s.target?s.actual/s.target:null);
        if(conv===null)return;
        const cov=row.executed/row.pending;
        const kind=cov<.8&&conv<1?'exe':cov>=.8&&conv<1?'msg':cov<.8?'opp':'ok';
        pts.push({unit:u.id,name:u.name,color:u.color,k,label:s.label,from:k?steps[k-1].label:'Prospectados',cov,conv,today:row.today,pending:row.pending,executed:row.executed,kind});
      });
    }
    return pts;
  }
  function correlationKpis(u,view,days){
    const k=view.step?.[u.id]??1;
    const step=u.funnel?.steps?.[k];
    if(!step)return '';
    const byDay=new Map((u.daily||[]).map(d=>[d.date,d]));
    const exec=executedByDay(u.snap,u.queueSteps,k);
    const a=[],b=[],good=[],bad=[];
    for(const d of days){
      const v=byDay.get(d)?.steps?.[k];const e=exec[d];
      if(v==null||!e)continue;
      a.push(e.executed);b.push(v);
      if(e.pending){const c=e.executed/e.pending;if(c>=.85)good.push(v);else if(c<.7)bad.push(v);}
    }
    const r=pearson(a,b);
    const avg=l=>l.length?l.reduce((s,x)=>s+x,0)/l.length:null;
    const lift=avg(good)!==null&&avg(bad)?avg(good)/avg(bad):null;
    return `<div class="ov-kpi" style="--ov-c:${esc(u.color)}"><span class="ov-kicker"><i class="ov-dot"></i>${esc(u.name)} · ${esc(step.label)}</span>
      <strong class="${r===null?'':r>.6?'is-good':r>.3?'is-warn':'is-bad'}">${r===null?'—':r.toFixed(2).replace('.',',')}</strong>
      <small>${r===null?`Correlación entre lo ejecutado y lo que llegó cada día: hace falta al menos 14 días con datos (hay ${a.length}).`:`Correlación ${r>.6?'fuerte':r>.3?'moderada':'débil'} entre lo ejecutado cada día y los que llegaron a este paso.`}</small>
      ${lift!==null?`<small>Los días con 85% o más de la cola ejecutada llegan ${times(lift)} más que los días con menos de 70%.</small>`:''}</div>`;
  }
  function quadrant(pts){
    const W=420,H=320,P={l:42,r:18,t:24,b:40},iw=W-P.l-P.r,ih=H-P.t-P.b;
    const X=v=>P.l+Math.min(1,Math.max(0,v))*iw,Y=v=>P.t+ih-Math.min(2,Math.max(0,v))/2*ih;
    const maxToday=Math.max(1,...pts.map(p=>p.today));
    return `<svg class="ov-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cada paso por cobertura de su cola y conversión contra la meta">
      <rect x="${X(.8)}" y="${Y(2)}" width="${X(1)-X(.8)}" height="${Y(1)-Y(2)}" class="ov-q is-ok"/>
      <rect x="${X(.8)}" y="${Y(1)}" width="${X(1)-X(.8)}" height="${Y(0)-Y(1)}" class="ov-q is-msg"/>
      <rect x="${X(0)}" y="${Y(1)}" width="${X(.8)-X(0)}" height="${Y(0)-Y(1)}" class="ov-q is-exe"/>
      <rect x="${X(0)}" y="${Y(2)}" width="${X(.8)-X(0)}" height="${Y(1)-Y(2)}" class="ov-q is-opp"/>
      <line class="ov-ax is-cut" x1="${X(.8)}" x2="${X(.8)}" y1="${P.t}" y2="${P.t+ih}"/><line class="ov-ax is-cut" x1="${P.l}" x2="${P.l+iw}" y1="${Y(1)}" y2="${Y(1)}"/>
      <text x="${X(1)-4}" y="${Y(2)+12}" text-anchor="end" class="ov-lbl">Se ejecuta y convierte</text>
      <text x="${X(1)-4}" y="${Y(0)-6}" text-anchor="end" class="ov-lbl">Se ejecuta, no convierte</text>
      <text x="${X(0)+4}" y="${Y(0)-6}" class="ov-lbl">No se ejecuta</text>
      <text x="${X(0)+4}" y="${Y(2)+12}" class="ov-lbl">Convierte sin ejecutar</text>
      ${[0,.5,.8,1].map(v=>`<text x="${X(v)}" y="${H-22}" text-anchor="middle">${pc(v)}</text>`).join('')}
      ${[0,1,2].map(v=>`<text x="${P.l-6}" y="${Y(v)+3}" text-anchor="end">${v}×</text>`).join('')}
      <text x="${P.l+iw/2}" y="${H-5}" text-anchor="middle" class="ov-lbl">Cola ejecutada de la etapa →</text>
      ${pts.map(p=>`<circle cx="${X(p.cov).toFixed(1)}" cy="${Y(p.conv).toFixed(1)}" r="${(5+Math.sqrt(p.today/maxToday)*9).toFixed(1)}" style="fill:${esc(p.color)}" class="ov-pt"><title>${esc(p.name)} · ${esc(p.from)} → ${esc(p.label)}: cola ejecutada ${pc(p.cov)}, convierte ${times(p.conv)} la meta, ${num(p.today)} esperan hoy</title></circle>`).join('')}
    </svg>`;
  }
  const TODO={
    exe:['EJECUTAR LA COLA',p=>`Se ejecutó el ${pc(p.cov)} de su cola y convierte ${times(p.conv)} la meta. Hoy esperan ${num(p.today)} acciones: el avance depende de hacerlas.`],
    msg:['REVISAR EL MENSAJE',p=>`Se ejecuta (${pc(p.cov)}) pero convierte ${times(p.conv)} la meta: más envíos no van a mover el embudo. Probá otra versión en Reglas y mensajes.`],
    opp:['OPORTUNIDAD',p=>`Convierte ${times(p.conv)} la meta con ${pc(p.cov)} de la cola ejecutada: cada acción de esta etapa rinde más que el promedio.`],
  };

  /**
   * ctx.units: [{ id, name, color, perWeek, funnel (core.targetFunnel), daily: [{date, steps[], targets[]}],
   *   snap (Follow-up), queueSteps {etapa técnica: paso}, queueHtml, loading }]
   * ctx.view: { period, grain, step: {unidad: paso} }; ctx.today: YYYY-MM-DD.
   */
  function render(ctx){
    const view=ctx.view||{};
    const units=ctx.units||[];
    const days=periodDays(view.period||'semana',ctx.today);
    const pts=quadrantData(units,days);
    const order={exe:0,msg:1,opp:2};
    const todo=pts.filter(p=>p.kind!=='ok').sort((a,b)=>order[a.kind]-order[b.kind]||b.today-a.today).slice(0,5);
    return `<div class="ov" data-testid="overview">
      <section class="ov-top"><div><span class="ov-kicker">CHAPA LABS / GENERAL</span><h1>¿La ejecución está moviendo los embudos?</h1>
        <p>Cada producto contra su meta y, debajo, cómo se ejecutó su cola. Después, cómo avanzó día a día y qué conviene hacer.</p></div>
        <div class="ov-filters">
          <nav class="ov-seg" aria-label="Período">${PERIODS.map(([k,l])=>`<button type="button" class="${view.period===k?'is-on':''}" aria-pressed="${view.period===k}" data-fu="ov-period" data-fu-period="${k}" data-testid="overview-period-${k}">${l}</button>`).join('')}</nav>
          <nav class="ov-seg" aria-label="Ver por">${GRAINS.map(([k,l])=>`<button type="button" class="${view.grain===k?'is-on':''}" aria-pressed="${view.grain===k}" data-fu="ov-grain" data-fu-grain="${k}">${l}</button>`).join('')}</nav>
        </div></section>
      ${ctx.notice?`<p class="ov-note">${esc(ctx.notice)}</p>`:''}
      <div class="ov-units">${units.map(u=>`<div class="ov-unit" data-testid="overview-unit-${esc(u.id)}">${funnelCard(u,view)}${u.queueHtml||''}</div>`).join('')}</div>
      <section class="ov-card ov-wide" data-testid="overview-advance"><div class="ov-head"><div><h2>Cómo avanzó</h2>
        <p class="ov-muted">De los contactados cada ${view.grain==='semana'?'semana':'día'}, cuántos llegaron al paso elegido arriba, contra la meta (la misma cohorte del embudo). Abajo, las acciones ejecutadas de la cola que lleva a ese paso: si suben y no sube el avance, el problema no es ejecutar. Los últimos días todavía están madurando.</p></div></div>
        <div class="ov-units">${units.map(u=>advanceCard(u,view,days)).join('')}</div></section>
      <section class="ov-card ov-wide" data-testid="overview-correlation"><div class="ov-head"><div><h2>Ejecución → avance</h2>
        <p class="ov-muted">Cada paso del embudo por cuánto se ejecutó la cola de su etapa en el período y cuánto convirtió contra la meta. El tamaño es cuántas acciones esperan hoy.</p></div></div>
        <div class="ov-kpis">${units.map(u=>correlationKpis(u,view,days)).join('')}</div>
        <div class="ov-corr">${pts.length?quadrant(pts):'<p class="ov-muted">Todavía no hay foto de la cola en este período: el cruce aparece desde el primer día con foto.</p>'}
          <div><span class="ov-kicker">Qué conviene hacer</span><div class="ov-todo">${todo.map(p=>`<div class="ov-todo-item"><em class="ov-tag is-${p.kind}">${TODO[p.kind][0]}</em><b style="--ov-c:${esc(p.color)}"><i class="ov-dot"></i>${esc(p.name)} · ${esc(p.from)} → ${esc(p.label)}</b><span>${TODO[p.kind][1](p)}</span></div>`).join('')||'<p class="ov-muted">Ningún paso necesita atención: todos se ejecutan y convierten en meta.</p>'}</div></div></div>
        <p class="ov-muted">Cortes: 80% de la cola ejecutada y 1× la conversión esperada. Cada producto con su definición; no se mezclan tasas.</p></section>
    </div>`;
  }
  return {render,periodDays,buckets,queueByStep,executedByDay,quadrantData,pearson,PERIODS};
});
