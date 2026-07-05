/* Athletics Corp — immersive layer (particles bg, scroll reveals, community counter). Vanilla JS, no deps. */
(function(){

  var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile=window.matchMedia&&window.matchMedia('(max-width: 768px)').matches;

  /* ---------- Single source of truth: community photo count ---------- */
  var COMMUNITY_GOAL=3000;
  var COMMUNITY_BASE=1000;
  var COMMUNITY_START=new Date('2023-01-01T00:00:00Z').getTime();
  var COMMUNITY_END=new Date('2028-01-01T00:00:00Z').getTime();
  function computeCommunityCount(){
    var progress=Math.min(1,Math.max(0,(Date.now()-COMMUNITY_START)/(COMMUNITY_END-COMMUNITY_START)));
    return Math.round(COMMUNITY_BASE+(COMMUNITY_GOAL-COMMUNITY_BASE)*progress);
  }

  /* ---------- Reusable particle network (hero + cta) ---------- */
  function attachParticleNetwork(canvasId,containerId){
    var canvas=document.getElementById(canvasId);
    var container=document.getElementById(containerId);
    if(!canvas||!container)return;
    var ctx=canvas.getContext('2d');
    if(!ctx)return;
    if(reduceMotion)return;

    var DPR=Math.min(window.devicePixelRatio||1,2);
    var W=0,H=0,particles=[],raf=null,running=false;
    var mouse={x:-9999,y:-9999,active:false};

    var COUNT=isMobile?16:52;
    var SPEED=isMobile?.12:.22;
    var LINK_DIST=isMobile?90:130;
    var MOUSE_DIST=150;

    function resize(){
      var r=container.getBoundingClientRect();
      W=r.width;H=r.height;
      canvas.width=Math.round(W*DPR);
      canvas.height=Math.round(H*DPR);
      canvas.style.width=W+'px';
      canvas.style.height=H+'px';
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }

    function makeParticles(){
      particles=[];
      for(var i=0;i<COUNT;i++){
        particles.push({
          x:Math.random()*W,
          y:Math.random()*H,
          vx:(Math.random()-.5)*SPEED,
          vy:(Math.random()-.5)*SPEED
        });
      }
    }

    function step(){
      ctx.clearRect(0,0,W,H);
      var i,j,p,q,dx,dy,dist,a;

      for(i=0;i<particles.length;i++){
        p=particles[i];
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<0||p.x>W)p.vx*=-1;
        if(p.y<0||p.y>H)p.vy*=-1;
        p.x=Math.max(0,Math.min(W,p.x));
        p.y=Math.max(0,Math.min(H,p.y));
      }

      for(i=0;i<particles.length;i++){
        p=particles[i];
        for(j=i+1;j<particles.length;j++){
          q=particles[j];
          dx=p.x-q.x;dy=p.y-q.y;
          dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<LINK_DIST){
            a=(1-dist/LINK_DIST)*.16;
            ctx.strokeStyle='rgba(200,184,130,'+a.toFixed(3)+')';
            ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
          }
        }
        if(mouse.active){
          dx=p.x-mouse.x;dy=p.y-mouse.y;
          dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<MOUSE_DIST){
            a=(1-dist/MOUSE_DIST)*.4;
            ctx.strokeStyle='rgba(63,214,224,'+a.toFixed(3)+')';
            ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(mouse.x,mouse.y);ctx.stroke();
          }
        }
        ctx.fillStyle='rgba(224,208,154,.35)';
        ctx.beginPath();ctx.arc(p.x,p.y,1.4,0,Math.PI*2);ctx.fill();
      }
    }

    function loop(){
      if(!running)return;
      step();
      raf=requestAnimationFrame(loop);
    }
    function start(){ if(running)return; running=true; raf=requestAnimationFrame(loop); }
    function stop(){ running=false; if(raf)cancelAnimationFrame(raf); raf=null; }

    resize();
    makeParticles();

    window.addEventListener('resize',function(){
      resize();
      if(particles.length!==COUNT)makeParticles();
    });

    container.addEventListener('mousemove',function(e){
      var r=container.getBoundingClientRect();
      mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; mouse.active=true;
    });
    container.addEventListener('mouseleave',function(){ mouse.active=false; mouse.x=-9999; mouse.y=-9999; });

    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting && !document.hidden) start(); else stop();
        });
      },{threshold:0});
      io.observe(container);
    }else{
      start();
    }

    document.addEventListener('visibilitychange',function(){
      if(document.hidden) stop();
      else if(container.getBoundingClientRect().bottom>0) start();
    });
  }

  /* ---------- Scroll reveals (fade-up on view) ---------- */
  function initScrollReveal(){
    var revealEls=document.querySelectorAll('.up,.up2,.up3,.fd');
    if(!('IntersectionObserver' in window)){
      revealEls.forEach(function(el){el.classList.add('go');});
    }else{
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){entry.target.classList.add('go');io.unobserve(entry.target);}
        });
      },{threshold:.07});
      revealEls.forEach(function(el){io.observe(el);});
    }

    var pb=document.getElementById('pb');
    if(!pb)return;
    var pls=pb.querySelectorAll('.pl,.pk');
    if(!('IntersectionObserver' in window)){
      pls.forEach(function(l){l.classList.add('v');});
      return;
    }
    var pio=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          pls.forEach(function(l,i){setTimeout(function(){l.classList.add('v');},i*220);});
          pio.unobserve(entry.target);
        }
      });
    },{threshold:.1});
    pio.observe(pb);
  }

  /* ---------- Community counter (photos collected, progress to goal) ---------- */
  function initCommunityWidget(){
    var numEl=document.getElementById('cwNum');
    var fillEl=document.getElementById('cwFill');
    var widget=document.getElementById('communityWidget');
    if(!numEl||!fillEl||!widget)return;

    var target=computeCommunityCount();

    function render(value){
      numEl.textContent=value.toLocaleString('ru-RU');
      fillEl.style.width=((value/COMMUNITY_GOAL)*100).toFixed(1)+'%';
    }

    function animateTo(value){
      var duration=1600,startTime=null;
      function tick(ts){
        if(!startTime)startTime=ts;
        var p=Math.min(1,(ts-startTime)/duration);
        var eased=1-Math.pow(1-p,3);
        render(Math.round(value*eased));
        if(p<1)requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    if(!('IntersectionObserver' in window)){
      render(target);
      return;
    }
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          animateTo(target);
          io.unobserve(entry.target);
        }
      });
    },{threshold:.4});
    io.observe(widget);
  }

  /* ---------- Floating social-proof badge ---------- */
  function initSocialProof(){
    var badge=document.getElementById('socialProof');
    var countEl=document.getElementById('spCount');
    if(!badge||!countEl)return;

    var dismissed=false;
    try{ dismissed=sessionStorage.getItem('sp_dismissed')==='1'; }catch(e){}
    if(dismissed)return;

    countEl.textContent=computeCommunityCount().toLocaleString('ru-RU');

    var closeBtn=document.getElementById('spClose');
    if(closeBtn){
      closeBtn.addEventListener('click',function(e){
        e.stopPropagation();
        badge.classList.remove('show');
        badge.classList.add('hide');
        try{ sessionStorage.setItem('sp_dismissed','1'); }catch(err){}
      });
    }

    setTimeout(function(){ badge.classList.add('show'); }, 3500);
  }

  function boot(){
    attachParticleNetwork('heroParticles','hero');
    attachParticleNetwork('ctaParticles','cta');
    initScrollReveal();
    initCommunityWidget();
    initSocialProof();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot);
  }else{
    boot();
  }
})();
