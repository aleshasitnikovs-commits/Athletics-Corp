/* Athletics Corp — cookie notice banner. Vanilla JS, no deps. Shown once per browser until dismissed. */
(function(){
  var STORAGE_KEY='ac_cookie_notice_seen';
  var seen=false;
  try{ seen=localStorage.getItem(STORAGE_KEY)==='1'; }catch(e){}
  if(seen)return;

  function mount(){
    var css=document.createElement('style');
    css.textContent=
      '#acCookieBar{position:fixed;left:0;right:0;bottom:0;z-index:8000;'+
      'display:flex;align-items:center;justify-content:center;gap:1.25rem;flex-wrap:wrap;'+
      'padding:.9rem 1.5rem;background:rgba(10,10,8,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'+
      'border-top:1px solid rgba(255,255,255,.09);'+
      'font-family:"Unbounded",system-ui,sans-serif;'+
      'transform:translateY(100%);opacity:0;transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s ease;}'+
      '#acCookieBar.show{transform:translateY(0);opacity:1;}'+
      '#acCookieBar p{margin:0;font-size:.74rem;line-height:1.6;color:#B7B4A9;max-width:56ch;}'+
      '#acCookieBar a{color:#C8B882;text-decoration:none;border-bottom:1px solid rgba(200,184,130,.4);}'+
      '#acCookieBar a:hover{color:#E0D09A;border-color:#E0D09A;}'+
      '#acCookieBar button{flex-shrink:0;font-family:"Unbounded",system-ui,sans-serif;font-size:.62rem;letter-spacing:.14em;'+
      'text-transform:uppercase;padding:.65rem 1.5rem;border:1px solid rgba(200,184,130,.55);color:#C8B882;'+
      'background:rgba(200,184,130,.06);cursor:pointer;transition:background .25s,color .25s,border-color .25s;}'+
      '#acCookieBar button:hover{background:#C8B882;color:#0A0A08;border-color:#E0D09A;}'+
      '@media(max-width:640px){#acCookieBar{padding:.9rem 1.1rem;text-align:center;}#acCookieBar p{max-width:100%;}}';
    document.head.appendChild(css);

    var bar=document.createElement('div');
    bar.id='acCookieBar';
    bar.innerHTML=
      '<p>Сайт использует файлы cookie для аналитики (Яндекс.Метрика), чтобы улучшать сайт. Подробнее — <a href="cookies.html">Cookie-политика</a>.</p>'+
      '<button type="button" id="acCookieAccept">Принять</button>';
    document.body.appendChild(bar);

    requestAnimationFrame(function(){ requestAnimationFrame(function(){ bar.classList.add('show'); }); });

    document.getElementById('acCookieAccept').addEventListener('click',function(){
      try{ localStorage.setItem(STORAGE_KEY,'1'); }catch(e){}
      bar.classList.remove('show');
      setTimeout(function(){ bar.remove(); },500);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',mount);
  }else{
    mount();
  }
})();
