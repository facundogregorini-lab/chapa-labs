/* Links produced by each product are allowed to remain the source of the
 * actual phone and message. On phones, convert supported WhatsApp Web URLs to
 * WhatsApp universal links; never send users to web.whatsapp.com on iOS. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ProspectingWhatsApp=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const HOSTS=new Set(['web.whatsapp.com','wa.me','api.whatsapp.com','www.whatsapp.com','whatsapp.com']);
  function nativeLink(source, phone='', text=''){
    const raw=String(source||'').trim();
    let number=String(phone||'').replace(/\D/g,'');
    let body=String(text||'');
    if(raw){
      let parsed;
      try{parsed=new URL(raw);}catch{return null;}
      if(!['https:','http:'].includes(parsed.protocol)||!HOSTS.has(parsed.hostname.toLowerCase()))return null;
      if(parsed.hostname.toLowerCase()==='wa.me'){
        number=decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0]||'').replace(/\D/g,'')||number;
      }else{
        number=(parsed.searchParams.get('phone')||parsed.searchParams.get('recipient')||number).replace(/\D/g,'');
      }
      body=parsed.searchParams.get('text')??body;
    }
    if(!/^\d{8,15}$/.test(number))return null;
    const link=new URL('https://wa.me/'+number);
    if(body)link.searchParams.set('text',body);
    return link.toString();
  }
  function appLink(source,phone='',text=''){
    const universal=nativeLink(source,phone,text);
    if(!universal)return null;
    const parts=new URL(universal);
    const result=new URL('whatsapp://send');
    result.searchParams.set('phone',parts.pathname.replace(/^\//,''));
    const body=parts.searchParams.get('text');
    if(body)result.searchParams.set('text',body);
    return result.toString();
  }
  function isMobileClient(win){
    if(!win)return false;
    const ua=win.navigator?.userAgent||'';
    return /iPhone|iPad|iPod|Android/i.test(ua)
      ||Boolean(win.matchMedia?.('(max-width: 760px) and (pointer: coarse)')?.matches);
  }
  return {nativeLink,appLink,isMobileClient};
});
