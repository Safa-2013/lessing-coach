(function(){
  const $=id=>document.getElementById(id);
  document.addEventListener('DOMContentLoaded',()=>{
    const sidebar=$('sidebar'), scrim=$('scrim');
    document.querySelectorAll('.menu-btn').forEach(b=>b.addEventListener('click',()=>{sidebar?.classList.toggle('open');scrim?.classList.toggle('show')}));
    scrim?.addEventListener('click',()=>{sidebar?.classList.remove('open');scrim?.classList.remove('show')});
    document.querySelectorAll('.sidebar a').forEach(a=>a.addEventListener('click',()=>{sidebar?.classList.remove('open');scrim?.classList.remove('show')}));
    document.querySelectorAll('[data-mobile-menu]').forEach(b=>b.addEventListener('click',()=>{sidebar?.classList.add('open');scrim?.classList.add('show')}));
  });
  window.openAdmin=()=>location.href='admin.html';
  window.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  window.nowTime=()=>new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v));}
  window.sendContact=function(){
    const i=$('contactInput'),box=$('contactMessages'); if(!i||!box)return;
    const text=i.value.trim(); if(!text)return;
    const profile=read('lessing_contact_profile')[0]||{};
    const item={id:crypto.randomUUID(),first:profile.first||'',last:profile.last||'',klass:profile.klass||'',text,created:Date.now()};
    const a=read('lessing_contact');a.push(item);write('lessing_contact',a);
    const b=document.createElement('div');b.className='bubble user';b.innerHTML='<p>'+esc(text)+'</p><small>'+nowTime()+' ✓✓</small>';box.appendChild(b);i.value='';box.scrollTop=box.scrollHeight;
    setTimeout(()=>{const r=document.createElement('div');r.className='bubble ai';r.innerHTML='<b>Lessing Schulen Coaching</b><p>Vielen Dank! Deine Nachricht wurde an das Team weitergegeben. Wir melden uns so schnell wie möglich.</p><small>'+nowTime()+'</small>';box.appendChild(r);box.scrollTop=box.scrollHeight;},250);
  };
  window.saveContactProfile=function(){
    const f=$('cFirst')?.value.trim(),l=$('cLast')?.value.trim(),c=$('cClass')?.value.trim();
    if(!f||!l||!c){alert('Bitte Vorname, Nachname und Klasse eingeben.');return false;}
    write('lessing_contact_profile',[{first:f,last:l,klass:c}]); $('contactGate').hidden=true; $('contactChat').hidden=false; return true;
  };
  window.saveRequest=function(e){
    e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.code='LS-'+crypto.randomUUID().slice(0,8).toUpperCase();d.created=Date.now();d.status='eingegangen';
    const a=read('lessing_requests');a.push(d);write('lessing_requests',a);
    $('requestResult').innerHTML='<div class="success-card"><b>Anfrage gespeichert</b><strong>'+d.code+'</strong><p>Bewahre diesen Anfragecode auf. Damit kannst du später den Status abrufen.</p></div>';e.target.reset();
  };
  window.lookup=function(){const c=$('code').value.trim().toUpperCase(),a=read('lessing_requests'),x=a.find(v=>v.code===c);$('lookupResult').innerHTML=x?'<div class="success-card"><b>Anfrage gefunden</b><p>'+esc(x.area)+' · '+esc(x.date)+'</p><strong>Status: '+esc(x.status||'eingegangen')+'</strong></div>':'<div class="error-card"><b>Kein Treffer</b><p>Bitte prüfe den Anfragecode.</p></div>'};
})();
