/* Habita ResultsView parity: render exactly the native breakdown from the
 * product's live results object. No metrics recalculation or cross-product math. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ProspectingHabitaResults=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const WINDOWS={'7':'7 días','14':'14 días',todo:'Sin límite'};
  const COHORTS={contacto:'Por semana de contacto',respuesta:'Por semana de primera respuesta',version:'Por versión del saludo'};
  const COHORT_COLS=[
    ['respondio','Respondieron'],['interes','Interesadas'],['demo','Demo enviada'],
    ['cuenta','Cuenta creada'],['suscripcion','Suscripción'],
  ];
  const STATUS={active:'ACTIVA',test:'EN PRUEBA',archived:'ARCHIVADA'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('es-AR'):'0';
  const pc=n=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':(Math.round(Number(n)*1000)/10).toLocaleString('es-AR')+'%';
  const hours=h=>h===null||h===undefined?'—':h<48?Math.round(h)+' h':(h/24).toFixed(1).replace('.',',')+' días';
  const week=w=>{
    const d=new Date(String(w)+'T12:00:00Z');
    return Number.isNaN(d.getTime())?String(w):d.toLocaleDateString('es-AR',{day:'numeric',month:'short',timeZone:'UTC'});
  };
  const barHeight=(n,max)=>Math.max(0,Math.round(Number(n||0)/Math.max(1,max)*140));
  const status=key=>STATUS[key]||key||'';
  function render(snap,view={}){
    const data=snap?.results;
    if(!data?.windows||!data?.totals||!data?.cohorts){
      return '<section class="fu-native-results" role="alert"><p>No se pudieron consultar los resultados históricos de Habita.</p></section>';
    }
    const selected=Object.hasOwn(WINDOWS,view.windowKey)?view.windowKey:'7';
    const cohort=Object.hasOwn(COHORTS,view.cohortBy)?view.cohortBy:'contacto';
    const win=data.windows[selected]||{weekly:[],versions:[]};
    const weekly=Array.isArray(win.weekly)?win.weekly:[];
    const versions=Array.isArray(win.versions)?win.versions:[];
    const blocks=Array.isArray(data.blocks)?data.blocks:[];
    const cohorts=Array.isArray(data.cohorts[cohort])?data.cohorts[cohort]:[];
    const maxWeek=Math.max(1,...weekly.map(w=>Number(w.executed)||0));
    const maxBlock=Math.max(1,...blocks.map(b=>Number(b.n)||0));
    const totals=data.totals;
    const kpis=[
      ['EJECUCIONES CONFIRMADAS',totals.executed30,'confirmadas, últimos 30 días'],
      ['RESPONDIERON POR PRIMERA VEZ',totals.replies30,'últimos 30 días'],
      ['ACCIONES PENDIENTES',totals.pending,num(totals.blocked)+' bloqueadas o programadas'],
      ['NO SALIERON',totals.failed,'marcadas «No se envió»'],
    ];
    const actionTitle=v=>(snap?.catalog?.actions?.[v.stage]||[]).find(a=>a.key===v.action)?.label||v.action||'Mensaje de la etapa';
    const stageTitle=v=>(snap?.stages||[]).find(s=>s.key===v.stage)?.title||v.stage||'';
    return `<section class="fu-native-results" data-testid="followup-results">
      <div class="fu-native-results-filters"><span>VENTANA DE CONVERSIÓN</span>
        ${Object.entries(WINDOWS).map(([key,label])=>`<button type="button" class="${selected===key?'is-on':''}" aria-pressed="${selected===key}" data-fu="results-window" data-fu-window="${key}" data-testid="followup-window-${key}">${label}</button>`).join('')}
      </div>
      <div class="fu-native-results-kpis">
        ${kpis.map(([label,value,hint])=>`<div class="fu-native-results-kpi"><span>${esc(label)}</span><strong>${num(value)}</strong><small>${esc(hint)}</small></div>`).join('')}
      </div>
      <div class="fu-native-results-columns">
        <section class="fu-native-results-card"><h2>EVOLUCIÓN SEMANAL · ${esc(WINDOWS[selected].toLocaleLowerCase('es-AR'))}</h2>
          <div class="fu-native-results-legend"><span><i class="is-ex"></i> Ejecutadas</span><span><i class="is-cv"></i> Conversiones atribuidas</span></div>
          <div class="fu-native-weekly" role="img" aria-label="Ejecutadas y conversiones por semana">
            ${weekly.map(w=>`<div class="fu-native-week"><small>${num(w.executed)} · ${num(w.conversions)}</small>
              <div class="fu-native-bar-pair"><span class="is-ex" style="height:${barHeight(w.executed,maxWeek)}px"></span>
                <span class="is-cv" style="height:${w.conversions?Math.max(3,barHeight(w.conversions,maxWeek)):0}px"></span></div>
              <small>${esc(week(w.week))}</small></div>`).join('')}
          </div>
        </section>
        <section class="fu-native-results-card"><h2>MOTIVOS DE BLOQUEO</h2>
          ${blocks.length?`<ul class="fu-native-blocks" data-testid="followup-results-blocks">
            ${blocks.slice(0,8).map(b=>`<li><span>${esc(b.reason)} <b>${num(b.n)}</b></span>
              <i style="width:${Math.max(3,Math.round(Number(b.n||0)/maxBlock*100))}%"></i></li>`).join('')}
          </ul>`:'<p class="fu-native-muted">Nada bloqueado.</p>'}
        </section>
      </div>
      <section class="fu-native-results-card">
        <h2>POR REGLA Y VERSIÓN · ${esc(WINDOWS[selected].toLocaleLowerCase('es-AR'))}</h2>
        <div class="fu-native-table-scroll"><table data-testid="followup-results-versions"><thead><tr>
          <th>PASO</th><th>VERSIÓN</th><th>ELEGIBLES</th><th>EJECUTADAS</th>
          <th>CONVERSIONES</th><th>TASA</th><th>TIEMPO</th><th>NO SALIERON</th><th>MUESTRA</th>
        </tr></thead><tbody>
          ${versions.map(v=>`<tr><td><b>${esc(actionTitle(v))}</b><small>${esc(stageTitle(v))}</small></td>
            <td>V${num(v.version)} <span class="fu-native-version-status is-${esc(v.status)}">${esc(status(v.status))}</span></td>
            <td>${num(v.eligible)}</td><td>${num(v.executed)}</td>
            <td>${num(v.conversions)}${v.assisted?`<small>+${num(v.assisted)} asistencias</small>`:''}</td>
            <td><b>${pc(v.rate)}</b></td><td>${esc(hours(v.medianHours))}</td><td>${num(v.failed)}</td>
            <td>${v.best?'<span class="fu-native-best">MEJOR</span>':!v.executed?'—':v.smallSample?'<small>muestra chica</small>':'OK'}</td></tr>`).join('')||'<tr><td colspan="9">Todavía no hay versiones con actividad.</td></tr>'}
        </tbody></table></div>
        <p class="fu-native-muted">Conversión: la inmobiliaria pasó del paso en que estaba al recibir el mensaje, dentro de la ventana. Si varios mensajes de la misma etapa la precedieron, cuenta solo el último (los otros son asistencias): una conversión nunca suma dos veces. «MEJOR» se marca solo entre versiones con 30 o más ejecutadas. La actividad de producto ya excluye el tráfico interno; las acciones comerciales no se excluyen.</p>
      </section>
      <section class="fu-native-results-card">
        <div class="fu-native-cohort-header"><h2>COHORTES</h2>
          <nav aria-label="Agrupación de cohortes">${Object.entries(COHORTS).map(([key,label])=>
            `<button type="button" class="${cohort===key?'is-on':''}" aria-pressed="${cohort===key}" data-fu="results-cohort" data-fu-cohort="${key}" data-testid="followup-cohort-${key}">${label}</button>`).join('')}</nav></div>
        <div class="fu-native-table-scroll"><table data-testid="followup-results-cohorts"><thead><tr>
          <th>${cohort==='version'?'SEGMENTO':'SEMANA'}</th><th>INMOBILIARIAS</th>
          ${COHORT_COLS.map(([_,label])=>`<th>${esc(label)}</th>`).join('')}
        </tr></thead><tbody>
          ${cohorts.map(c=>`<tr><td>${esc(cohort==='version'?c.cohort:week(c.cohort))}</td><td>${num(c.size)}</td>
            ${COHORT_COLS.map(([key])=>`<td>${num(c[key])}<small>${c.size?pc(Number(c[key]||0)/Number(c.size)):'—'}</small></td>`).join('')}</tr>`).join('')||'<tr><td colspan="7">Sin cohortes en este período.</td></tr>'}
        </tbody></table></div>
      </section>
    </section>`;
  }
  return {render};
});
