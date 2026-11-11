/* Prospectos: las inmobiliarias antes de entrar a la cola de Follow-up, con su ranking, lo que les
 * falta para entrar y los aprendizajes (qué variables convierten).
 * Muestra lo que manda el producto (amoblaia: GET /api/prospeccion?vista=prospectos): el catálogo
 * de datos, el ranking y los estados se definen allá; acá no se recalcula nada. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ProspectingPool=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('es-AR'):'0';
  const pc=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const STATUS_ORDER=['descubierto','enriquecido','calificado','en_cola','descartado'];

  function defaults(view){
    const v=view||{};
    if(!['lista','aprendizajes'].includes(v.tab))v.tab='lista';
    if(!['todos',...STATUS_ORDER].includes(v.status))v.status='todos';
    if(typeof v.q!=='string')v.q='';
    if(v.open===undefined)v.open=null;
    if(v.message===undefined)v.message=null;
    if(!Number.isInteger(v.shown)||v.shown<50)v.shown=50;
    return v;
  }

  /** Las filas del filtro: estado y texto (nombre, zona, web o WhatsApp). */
  function filterRows(rows,view){
    const q=norm(view.q).trim();
    return (rows||[]).filter(r=>(view.status==='todos'||r.status===view.status)
      &&(!q||[r.name,r.zone,r.website,r.whatsapp,r.address].some(x=>norm(x).includes(q))));
  }

  const fieldValue=(f,v)=>v===undefined||v===null||v===''?'':f.type==='bool'?(v===true?'si':v===false?'no':''):String(v);
  /** El texto de un valor para leerlo (la etiqueta de la opción, Sí/No). */
  function display(f,v){
    if(v===undefined||v===null||v==='')return '';
    if(f.type==='bool')return v===true?'Sí':'No';
    return ((f.options||[]).find(o=>o.value===v)||{}).label||String(v);
  }

  /**
   * Lo que cambió en el formulario contra lo guardado: solo eso se manda. Vacío borra el dato
   * (null). Un valor que salió de la planilla no se guarda si no se lo tocó.
   */
  function changes(row,catalog,values){
    const out={};
    for(const f of catalog.fields){
      if(!(f.key in values))continue;
      const now=String(values[f.key]??'').trim(),before=fieldValue(f,(row.profile||{})[f.key]);
      if(now===before)continue;
      out[f.key]=now===''?null:f.type==='number'?Number(now.replace(',','.')):f.type==='bool'?now==='si':now;
    }
    return out;
  }

  function input(f,row,disabled){
    const stored=fieldValue(f,(row.profile||{})[f.key]),hint=(row.inferred||{})[f.key];
    const from=hint!==undefined&&stored===''?`<small class="pp-hint">En la planilla: ${esc(display(f,hint))}</small>`:f.help?`<small class="pp-hint">${esc(f.help)}</small>`:'';
    const attrs=`name="${esc(f.key)}" ${disabled?'disabled':''}`;
    let control;
    if(f.type==='enum'||f.type==='bool'){
      const options=f.type==='bool'?[{value:'si',label:'Sí'},{value:'no',label:'No'}]:f.options;
      control=`<select ${attrs}><option value="">Sin dato</option>${options.map(o=>`<option value="${esc(o.value)}" ${o.value===stored?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
    }else control=`<input ${attrs} type="${f.type==='number'?'number':f.type==='url'?'url':'text'}" ${f.type==='number'?`min="${f.min??0}" max="${f.max??''}" step="any" inputmode="decimal"`:''} value="${esc(stored)}" placeholder="${f.type==='url'?'https://…':''}">`;
    return `<label class="field pp-field"><span>${esc(f.label)}${f.key_data?' <i class="pp-key" title="Cuenta para el ranking">●</i>':''}</span>${control}${from}</label>`;
  }

  const statusLabel=(catalog,key)=>((catalog.statuses||[]).find(s=>s.key===key)||{}).label||key;
  const statusBadge=(catalog,r)=>`<span class="pp-status is-${esc(r.status)}">${esc(statusLabel(catalog,r.status))}${r.explore?' · exploración':''}</span>`;
  const bar=(label,v)=>`<div class="pp-bar" title="${esc(label)}: ${num(v)} de 100"><span>${esc(label)}</span><i><b style="width:${Math.max(0,Math.min(100,Number(v)||0))}%"></b></i><em>${num(v)}</em></div>`;
  const waLabel={verificado:'WhatsApp revisado',revisar:'WhatsApp por revisar',invalido:'Número inválido','':'Sin WhatsApp'};
  const PARTS={necesidad:['Avisos vacíos',40],cartera:['Tamaño de la cartera',20],ambientacion:['Todavía no ambienta',15],residencial:['Residencial',10],actividad:['Avisos nuevos',10],decisor:['Decisor',5]};

  function detail(row,catalog,o){
    const disabled=o.saving||!o.available;
    const groups=catalog.groups.map(g=>{
      const fields=catalog.fields.filter(f=>f.group===g.key);
      return `<fieldset class="pp-group"><legend>${esc(g.label)}</legend><div class="pp-fields">${fields.map(f=>input(f,row,disabled)).join('')}</div></fieldset>`;
    }).join('');
    const queued=row.status==='en_cola',discarded=row.status==='descartado';
    const canQueue=!queued&&!discarded&&!row.missing.length;
    // Por exploración entra sin el encaje mínimo: alcanza con WhatsApp y aviso para la demo.
    const exploreOnly=!queued&&!discarded&&row.missing.length>0&&row.missing.every(m=>/^Encaje/.test(m));
    return `<section class="card glass pp-detail" data-testid="pool-detail" data-id="${esc(row.id)}">
      <div class="card-head"><div><span class="os-kicker">FICHA DEL PROSPECTO</span><h2>${esc(row.name)}</h2>
        <p class="sub">${[row.zone,row.address,waLabel[row.whatsappState||'']+(row.whatsapp?' '+row.whatsapp:'')].filter(Boolean).map(esc).join(' · ')}${row.website?` · <a href="${esc(/^https?:/i.test(row.website)?row.website:'https://'+row.website)}" target="_blank" rel="noopener">${esc(String(row.website).replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''))}</a>`:''}</p></div>
        <div class="pp-detail-actions">${statusBadge(catalog,row)}<button class="btn small" type="button" data-pool="close">CERRAR</button></div></div>
      <div class="pp-score">
        <div class="pp-total"><strong>${num(row.score.total)}</strong><span>RANKING</span>${row.sheetScore!==null&&row.sheetScore!==undefined?`<small>Planilla: ${num(row.sheetScore)}</small>`:''}</div>
        <div class="pp-bars">${bar('Contactabilidad',row.score.contact)}${bar('Encaje',row.score.fit)}${bar('Facilidad de demo',row.score.demo)}
          <p class="pp-parts">${Object.entries(row.score.parts||{}).map(([k,v])=>PARTS[k]?`${esc(PARTS[k][0])} ${num(v)}/${PARTS[k][1]}`:'').filter(Boolean).join(' · ')}</p>
          ${(row.score.caps||[]).map(c=>`<p class="notice-line">${esc(c)}</p>`).join('')}</div>
        <div class="pp-missing">${queued?'<p class="pp-ok">Ya está en la cola, esperando el saludo.</p>':discarded?`<p class="notice-line bad">Descartada: ${esc(row.discardReason||'sin motivo')}</p>`:row.missing.length?`<span class="os-kicker">PARA ENTRAR A LA COLA FALTA</span><ul>${row.missing.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:'<p class="pp-ok">Lista para entrar a la cola.</p>'}
          <small>Datos clave cargados: ${num(row.complete)}%</small></div>
      </div>
      ${row.notes?`<p class="pp-notes"><strong>Notas de la planilla:</strong> ${esc(row.notes)}</p>`:''}
      <form data-pool-form="save" data-id="${esc(row.id)}">
        ${groups}
        <div class="pp-fields pp-account"><label class="field pp-field"><span>Zona</span><input name="__zona" value="${esc(row.zone||'')}" ${disabled?'disabled':''}></label>
          <label class="field pp-field"><span>Quién decide (nombre)</span><input name="__decisor" value="${esc(row.decisor||'')}" ${disabled?'disabled':''}></label></div>
        <div class="pp-actions">
          <button class="btn primary" type="submit" ${disabled?'disabled':''}>${o.saving?'GUARDANDO…':'GUARDAR DATOS'}</button>
          ${canQueue?`<button class="btn" type="button" data-pool="queue" data-id="${esc(row.id)}" ${disabled?'disabled':''}>PASAR A LA COLA →</button>`:''}
          ${exploreOnly?`<button class="btn" type="button" data-pool="explore" data-id="${esc(row.id)}" ${disabled?'disabled':''} title="Entra al azar, sin el encaje mínimo, para aprender">PASAR POR EXPLORACIÓN</button>`:''}
          ${queued?`<button class="btn" type="button" data-pool="unqueue" data-id="${esc(row.id)}" ${disabled?'disabled':''}>SACAR DE LA COLA</button>`:''}
          ${discarded?`<button class="btn" type="button" data-pool="reopen" data-id="${esc(row.id)}" ${disabled?'disabled':''}>REABRIR</button>`:''}
        </div>
      </form>
      ${discarded?'':`<form class="pp-discard" data-pool-form="discard" data-id="${esc(row.id)}"><label class="field pp-field"><span>Descartar: motivo</span><input name="motivo" maxlength="300" placeholder="Solo campos, cerró, fuera de zona…" ${disabled?'disabled':''} required></label><button class="btn danger small" type="submit" ${disabled?'disabled':''}>DESCARTAR</button></form>`}
    </section>`;
  }

  function createForm(catalog,o){
    const source=catalog.fields.find(f=>f.key==='source_channel');
    return `<section class="card glass pp-detail" data-testid="pool-create"><div class="card-head"><div><span class="os-kicker">NUEVO PROSPECTO</span><h2>Agregar inmobiliaria</h2><p class="sub">Entra como «Descubierto». Después se le cargan los datos y, cuando cumple, pasa a la cola.</p></div><button class="btn small" type="button" data-pool="add-toggle">CERRAR</button></div>
      <form data-pool-form="create"><div class="pp-fields">
        <label class="field pp-field"><span>Nombre</span><input name="nombre" maxlength="120" required></label>
        <label class="field pp-field"><span>Web</span><input name="web" maxlength="300" placeholder="ejemplo.com.ar"></label>
        <label class="field pp-field"><span>WhatsApp</span><input name="whatsapp" maxlength="60" inputmode="tel" placeholder="223 555 0000"></label>
        <label class="field pp-field"><span>Zona</span><input name="zona" maxlength="120"></label>
        ${source?`<label class="field pp-field"><span>${esc(source.label)}</span><select name="source_channel"><option value="">Sin dato</option>${source.options.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('')}</select></label>`:''}
        <label class="field pp-field"><span>Lote</span><input name="source_batch" maxlength="200" placeholder="Zonaprop noviembre"></label>
      </div>
      ${o.duplicate?`<p class="notice-line">${esc(o.duplicate)} <label class="pp-confirm"><input type="checkbox" name="confirmar" value="1"> Es otra: agregarla igual</label></p>`:''}
      <div class="pp-actions"><button class="btn primary" type="submit" ${o.saving?'disabled':''}>${o.saving?'AGREGANDO…':'AGREGAR'}</button></div></form></section>`;
  }

  function list(data,view,o){
    const catalog=data.catalog,rows=filterRows(data.rows,view),shown=rows.slice(0,view.shown);
    const open=view.open?data.rows.find(r=>r.id===view.open):null;
    const counts=data.counts||{};
    const chips=[['todos','Todas',counts.total||0],...STATUS_ORDER.map(k=>[k,statusLabel(catalog,k),counts[k]||0])];
    const ready=counts.calificado||0;
    return `${open?detail(open,catalog,o):''}${view.adding?createForm(catalog,o):''}
      <section class="card glass pp-list">
        <div class="pp-toolbar">
          <div class="chips" role="group" aria-label="Estado">${chips.map(([k,l,n])=>`<button type="button" class="chip" data-pool="status" data-value="${k}" aria-pressed="${view.status===k}" title="${esc(((catalog.statuses||[]).find(s=>s.key===k)||{}).help||'')}">${esc(l)} ${num(n)}</button>`).join('')}</div>
          <div class="pp-tools"><input class="input" type="search" data-pool-search placeholder="Buscar por nombre, zona o número" value="${esc(view.q)}" aria-label="Buscar">
            <button class="btn small" type="button" data-pool="add-toggle" ${o.available?'':'disabled'}>+ AGREGAR</button></div>
        </div>
        <form class="pp-fill" data-pool-form="fill"><span><strong>${num(ready)}</strong> calificada${ready===1?'':'s'} para entrar a la cola.</span>
          <label>Sumar <input name="cantidad" type="number" min="1" max="100" value="${Math.min(10,Math.max(1,ready))}" aria-label="Cuántas sumar"> a la cola</label>
          <button class="btn small primary" type="submit" ${!o.available||o.saving||!ready?'disabled':''}>SUMAR LAS MEJORES</button>
          <small>De cada tanda de 5 o más, ${Math.round((catalog.exploreShare||0)*100)}% entra al azar entre las demás que ya tienen WhatsApp y aviso: así el ranking se pone a prueba.</small></form>
        <div class="table-wrap"><table class="pp-table"><thead><tr><th>RANKING</th><th>INMOBILIARIA</th><th>ESTADO</th><th>CONTACTO</th><th>ENCAJE</th><th>DEMO</th><th>DATOS</th><th>QUÉ FALTA</th><th></th></tr></thead><tbody>
          ${shown.map(r=>`<tr data-pool="open" data-id="${esc(r.id)}" tabindex="0" class="${view.open===r.id?'is-open':''}" data-testid="pool-row">
            <td><strong class="pp-rank">${num(r.score.total)}</strong></td>
            <td><strong>${esc(r.name)}</strong><div class="sub">${[r.zone,waLabel[r.whatsappState||'']].filter(Boolean).map(esc).join(' · ')}</div></td>
            <td>${statusBadge(catalog,r)}</td>
            <td>${num(r.score.contact)}</td><td>${num(r.score.fit)}</td><td>${num(r.score.demo)}</td>
            <td>${num(r.complete)}%</td>
            <td class="pp-why">${r.status==='descartado'?esc(r.discardReason||''):esc(r.missing[0]||'')}${r.missing.length>1?` <span class="sub">+${r.missing.length-1}</span>`:''}</td>
            <td>${r.status==='calificado'?`<button class="btn small" type="button" data-pool="queue" data-id="${esc(r.id)}" ${o.saving?'disabled':''}>A LA COLA →</button>`:''}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">No hay prospectos en este filtro.</td></tr>'}
        </tbody></table></div>
        <div class="pp-cards">${shown.map(r=>`<button type="button" class="pp-card" data-pool="open" data-id="${esc(r.id)}"><strong class="pp-rank">${num(r.score.total)}</strong><span><b>${esc(r.name)}</b><small>${[r.zone,waLabel[r.whatsappState||'']].filter(Boolean).map(esc).join(' · ')}</small><small>${esc(r.missing[0]||'')}</small></span>${statusBadge(catalog,r)}</button>`).join('')||'<p class="empty">No hay prospectos en este filtro.</p>'}</div>
        ${rows.length>shown.length?`<div class="pp-more"><button class="btn small" type="button" data-pool="more">VER ${num(Math.min(50,rows.length-shown.length))} MÁS (quedan ${num(rows.length-shown.length)})</button></div>`:''}
        <p class="os-fu-caption">Ranking ${esc(catalog.scoringVersion)}: ${Math.round(catalog.weights.contact*100)}% contactabilidad, ${Math.round(catalog.weights.fit*100)}% encaje y ${Math.round(catalog.weights.demo*100)}% facilidad de armar la demo. Es una hipótesis para ordenar, no una probabilidad de compra: se ajusta con los Aprendizajes. <button class="btn ghost small" type="button" data-pool="recalc" ${o.available&&!o.saving?'':'disabled'}>Recalcular todo</button></p>
      </section>`;
  }

  function learning(data,view){
    const l=data.learning||{dimensions:[],total:{n:0}},t=l.total||{n:0};
    const cell=(a,b)=>`<td>${pc(a,b)}<span class="sub"> ${num(a)}</span></td>`;
    const table=d=>`<section class="card glass pp-learn" data-testid="pool-dimension" data-key="${esc(d.key)}"><div class="card-head"><div><h3>${esc(d.label)}</h3><p class="sub">${num(d.known)} de ${num(t.n)} intentadas con este dato</p></div></div>
      <div class="table-wrap"><table class="pp-table"><thead><tr><th>VALOR</th><th>INTENTADAS</th><th>NÚMERO VÁLIDO</th><th>RESPONDIERON</th><th>INTERÉS</th><th>DEMO CON INTERACCIÓN</th><th>CLIENTES</th></tr></thead><tbody>
      ${d.rows.map(r=>`<tr><td><strong>${esc(r.value)}</strong>${r.small?' <span class="os-tag">MUESTRA CHICA</span>':''}</td><td>${num(r.n)}</td>${cell(r.valid,r.n)}${cell(r.replied,r.valid)}${cell(r.interested,r.valid)}${cell(r.engaged,r.valid)}<td>${num(r.customers)}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    return `<section class="card glass pp-learn-head">
        <div class="card-head"><div><span class="os-kicker">APRENDIZAJES</span><h2>Qué prospectos convierten</h2>
          <p class="sub">Cada variable contra lo que pasó después. «Número válido» es sobre las intentadas; el resto, sobre las de número válido. Con menos de ${num(l.small||30)} intentadas es muestra chica: no alcanza para decidir.</p></div>
          <label class="field pp-field"><span>Primer mensaje</span><select data-pool-message><option value="">Todos los mensajes</option>${(l.messages||[]).map(m=>`<option value="${esc(m)}" ${m===l.message?'selected':''}>${esc(m)}</option>`).join('')}</select></label></div>
        <div class="pp-kpis"><div><strong>${num(t.n)}</strong><span>Intentadas</span></div><div><strong>${pc(t.valid,t.n)}</strong><span>Número válido</span></div><div><strong>${pc(t.replied,t.valid)}</strong><span>Respondieron</span></div><div><strong>${pc(t.interested,t.valid)}</strong><span>Interés</span></div><div><strong>${pc(t.engaged,t.valid)}</strong><span>Demo con interacción</span></div><div><strong>${num(t.customers)}</strong><span>Clientes</span></div></div>
        <p class="os-fu-caption">El mensaje pesa más que el prospecto: para comparar prospectos, elegí un mensaje y mirá dentro de él. Los datos que todavía no se cargaron en Prospectos no aparecen hasta que haya inmobiliarias contactadas con ese dato.</p>
      </section>
      ${l.dimensions.map(table).join('')||'<section class="card glass"><p class="empty">Todavía no hay inmobiliarias contactadas para comparar.</p></section>'}`;
  }

  /** La vista completa. `o`: { loading, error, saving, duplicate, name }. */
  function render(data,view,o){
    o=o||{};view=defaults(view);
    const head=n=>`<section class="hero"><div><span class="eyebrow">${esc(o.name||'')} / PROSPECTOS</span><h1>${n===null?'Prospectos':`${num(n)} antes del primer contacto`}</h1><p>Todas las inmobiliarias que todavía no recibieron el saludo: se les cargan los datos, se ordenan por ranking y las mejores pasan a la cola. Lo que pase después vuelve acá como aprendizaje.</p></div></section>`;
    if(!data){
      if(o.error)return `${head(null)}<section class="card glass" role="alert"><h2>No pudimos cargar Prospectos</h2><p>${esc(o.error)}</p><button class="btn primary" type="button" data-pool="reload">REINTENTAR</button></section>`;
      return `${head(null)}<div class="skeleton"></div><div class="skeleton"></div>`;
    }
    const opts={...o,available:data.available!==false};
    const tabs=`<nav class="pp-tabs" role="tablist">${[['lista','LISTA Y RANKING'],['aprendizajes','APRENDIZAJES']].map(([k,l])=>`<button type="button" role="tab" data-pool="tab" data-value="${k}" aria-selected="${view.tab===k}" class="${view.tab===k?'is-on':''}">${l}</button>`).join('')}</nav>`;
    const warn=(opts.available?'':'<div class="notice glass" role="status"><span class="badge off">FALTA UN PASO</span><span>Falta aplicar la migración de Prospectos en Supabase (202612140001_prospect_pool.sql). Hasta entonces la lista se ve, pero no se puede guardar.</span></div>')
      +(o.error?`<div class="notice glass" role="status"><span class="badge off">CONEXIÓN</span><span>No se pudo actualizar: ${esc(o.error)}</span><button class="btn small" type="button" data-pool="reload">REINTENTAR</button></div>`:'');
    return head((data.counts||{}).total||0)+warn+tabs+(view.tab==='aprendizajes'?learning(data,view):list(data,view,opts));
  }

  return {defaults,filterRows,changes,display,render};
});
