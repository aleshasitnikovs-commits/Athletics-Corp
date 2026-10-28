// Перенесено из ШТАБ/06-сайт-и-конверсия/передача-в-vs-code/прототип-исходники/main.js (v7).
// Логика не менялась, кроме loadModel(): вместо base64-строки XBOT модель грузится
// по URL через fetch — модель меняется одной строкой в MODEL_URL ниже, без правки кода сцены.
//
// 15.10, апгрейд: свежий Three.js (0.186, был r128 от 2021) через ES-модули, локально из
// npm (_assets/vendor/three/), без сборщика — браузер резолвит "three" через importmap
// в index.html. THREE.GLTFLoader (глобальный, старый стиль) стал именованным экспортом
// GLTFLoader — единственное реальное изменение в использовании API ниже.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import * as HUMAN from './human-points.js';

/* ---------- человек: какой и как ----------
   20.10: вместо Xbot - нейтральная модель _assets/3d/human.glb (ходьба и стояние из CMU) через
   модуль human-points.js: точки на поверхности, деформация на видеокарте, тело прячет задние точки,
   свет спереди справа. Интро (поле -> логотип -> человек) - прежнее, точки интро садятся на новую
   модель и к концу интро плавно сменяются точками модуля.
   HUMAN_PRESET - вид точек: 'зерно-8k' (крупное редкое зерно) или 'материал-60k' (на телефоне 16k).
   USE_XBOT=true - вернуть прежнего человека (Xbot из MODEL_URL в index.html), код сохранён. */
const HUMAN_PRESET = 'зерно-8k';
/* телефон (ширина < 860): замер 20.10 (390x844, CPU x4) - «зерно-8k» 59,7 к/с, «материал» 16k 49-56 к/с
   с рывками до 350 мс, поэтому на телефоне зерно при любом HUMAN_PRESET. Чтобы проверить материал на
   телефоне - поставить сюда 'материал-60k' (на телефоне он сам берёт 16 тыс. точек). */
const HUMAN_PRESET_PHONE = 'зерно-8k';
const USE_XBOT = false;
const HUMAN_URL = '_assets/3d/human.glb', HUMAN_SAMPLES = '_assets/3d/human-samples.bin';

/* Этап 0, п.3: любая ошибка сцены (нет контекста, исключение при инициализации, не
   загрузилась модель/маска логотипа, исключение в рендер-цикле) переводит страницу в
   статичную раскладку: html.no-webgl + html.story-static, событие для scroll-story.js.
   Ошибка не выбрасывается дальше - остальной JS страницы (шапка, меню, главы) работает. */
var dead=false;
function fail(e){
 if(dead)return;dead=true;
 document.documentElement.classList.add('no-webgl','story-static');
 document.dispatchEvent(new Event('story:static'));
 if(window.__reveal)window.__reveal(true);
 if(e)console.warn('hero-scene: сцена отключена, страница в статичной раскладке.',e);
}

/* Точки человека (плавность, п.3). Замер на живой странице: тот же цикл внутри IIFE сцены
   (функция объявлена в блоке try строгого модуля, массивы берутся из огромного замыкания)
   шёл ~13-16 мс на кадр, а тот же код с теми же данными, но получающий их параметрами
   фабрики - 0.4 мс. Поэтому фабрика на уровне модуля: всё нужное приходит одним объектом
   при инициализации (эти значения после неё не переприсваиваются, только меняются по
   содержимому), горячий цикл работает с локальными привязками.
   Дрожание точек (амплитуда 5 мм) - табличный синус вместо трёх Math.sin на точку. */
function makeHumanPoints(E){
 var sm=E.sm,cl=E.cl,wave=E.wave,mob=E.mob,XW=E.XW,Z0=E.Z0,Z1=E.Z1,ZD=E.ZD,NH=E.NH,MW=E.MW,LP=E.LP,HW=E.HW,HL=E.HL,HYN=E.HYN,SEED=E.SEED,TX=E.TX,TZ=E.TZ,HIDX=E.HIDX,MAIN=E.MAIN;
 var SINT=new Float32Array(1024),SINK=1024/(2*Math.PI);for(var si=0;si<1024;si++)SINT[si]=Math.sin(si/SINK);
 /* сиды точек человека подряд (k), а не вразброс через HIDX по всему массиву поля */
 var HS=new Float32Array(NH*3);for(var hk=0;hk<NH;hk++){var hi=HIDX[hk]*3;HS[hk*3]=SEED[hi];HS[hk*3+1]=SEED[hi+1];HS[hk*3+2]=SEED[hi+2]}
 var intro=function humanIntro(T,tm,dist,dvx,dvz,hx,hz,logoK,revOn,rr,heroK,mOn,nR,RW,ch4a,freezeK,ch4b){
 /* Быстрый путь: самая поздняя точка долетает до логотипа к T=1.35+1+.48+1.25=4.08 (дальше
    eL=1 у всех - позицию в поле и dc не считаем), до человека - к T=4.55+.85+.3+1.05=6.75
    (дальше eH=1 у всех). Замер: цикл 22 000 точек был ~27 мс на кадр на слабом CPU. */
 var inField=T<4.1,toHuman=T<6.8;
 var P=MAIN.P,B=MAIN.B,A=MAIN.A,TI=MAIN.T,SZ=MAIN.S;
 for(var k=0;k<NH;k++){
   var i=HIDX[k];
   var s0=HS[k*3],s1=HS[k*3+1],s2=HS[k*3+2];
   var x=0,z=0,dc=0,eL=1;
   if(inField){
     x=TX[i]+dvx*dist;z=TZ[i]+dvz*dist;x=((x+XW/2)%XW+XW)%XW-XW/2;z=((z-Z0)%ZD+ZD)%ZD+Z0;
     dc=Math.sqrt(x*x+z*z);
     /* поле -> логотип (фонтан) */
     eL=sm(0,1,(T-1.35-s1*1.0-Math.min(dc,8)*.06)/1.25);
   }
   var y=0,alT=0,brT=0;
   if(eL<1){
     var dxh=x-hx,dzh=z-hz,dh=Math.sqrt(dxh*dxh+dzh*dzh),mask=sm(.55,2.4,dh),amp=1+1.5*sm(-1,-13,z);
     y=-.04+(wave(x,z,tm)+.12)*amp*mask*(1-.45*logoK);
     var rev=1,bump=0;
     if(revOn){rev=sm(0,.9,rr-dc);bump=.42*Math.exp(-(dc-rr)*(dc-rr)*2.2)*(1-sm(2.6,3.4,T))}
     y+=bump;var rb=0;
     for(var r=0;r<nR;r++){var q=RW[r];if(q[3]<=0)continue;var ex=x-q[0],ez=z-q[1],d2=ex*ex+ez*ez;if(d2>9)continue;var d=Math.sqrt(d2),k1=d-q[2],k2=d-q[2]+.22,ring=Math.exp(-k1*k1*45)+.6*Math.exp(-k2*k2*45);
       y+=.07*ring*q[3];rb+=ring*q[3]*2.2}
     if(mOn>0){var mdx=x-MW.x,mdz=z-MW.z,md=Math.sqrt(mdx*mdx+mdz*mdz);y+=mOn*.2*Math.exp(-md*md*.7)*Math.cos(md*5.5-tm*4.2)}
     var crest=cl((y+.1)/(.62*amp)),fog=sm(Z0,Z0+8,z)*(1-sm(2.4,Z1,z))*(1-.55*heroK*sm(-.5,2.2,z))*(1-sm(XW/2-3,XW/2,Math.abs(x)));
     alT=(1.15+.9*bump+.8*rb)*fog*rev;brT=Math.min(1,.16+.84*crest*crest+bump*1.5+rb);
   }
   /* логотип -> человек (спираль) */
   var eH=toHuman?sm(0,1,(T-4.55-(1-HYN[k])*.85-s0*s0*.3)/1.05):1;
   var px,py,pz;
   if(eL<1){var u=1-eL,cx=s0*.12,cy=.12,cz=-.6+s2*.12;px=u*u*x+2*u*eL*cx+eL*eL*LP[k*3];py=u*u*y+2*u*eL*cy+eL*eL*LP[k*3+1];pz=u*u*z+2*u*eL*cz+eL*eL*LP[k*3+2]}
   else{px=LP[k*3];py=LP[k*3+1];pz=LP[k*3+2]}
   if(eH>=1){px=HW[k*3];py=HW[k*3+1];pz=HW[k*3+2]}
   else if(eH>0){var hx3=HW[k*3],hy3=HW[k*3+1],hz3=HW[k*3+2];px+=(hx3-px)*eH;py+=(hy3-py)*eH;pz+=(hz3-pz)*eH;
     var sp=Math.sin(Math.PI*eH),ang=eH*9+s0*6.28,rad=.5*sp*(.6+.4*s1);px+=Math.cos(ang)*rad;pz+=Math.sin(ang)*rad}
   var sh=.005*eH;
   /* глава 4, фаза A: часть точек человека приподнимается и расходится в поле - "информация
      поднимается в воздух". Семя s2 решает, кто из точек заметнее уходит (не все разом). */
   if(ch4a>0){var ang4=s0*6.283+tm*.12,rise4=(.25+.95*s2*s2)*ch4a,rad4=(.1+.5*s1)*ch4a;
     px+=Math.cos(ang4)*rad4;pz+=Math.sin(ang4)*rad4;py+=rise4}
   P[k*3]=px+sh*SINT[((tm*2.1+s0*40)*SINK|0)&1023];P[k*3+1]=py+sh*SINT[((tm*1.7+s1*40)*SINK|0)&1023];P[k*3+2]=pz+sh*SINT[((tm*2.4+s2*40)*SINK|0)&1023];
   var inL=eL*(1-eH),fly=Math.sin(Math.PI*eL)*(1-eL>0?1:0);
   A[k]=alT*(1-eL)+.95*inL+(mob?.85:.75)*eH+.3*fly;
   /* freezeK (глава 3, силуэт-снимок) и ch4b (глава 4, фаза "густеет") поднимают яркость и
      размер поверх обычного расчёта - оба 0 вне своих окон, друг другу не мешают. */
   B[k]=Math.min(1,(brT*(1-eL)+(.55+.45*s1)*inL+(.1+.9*HL[k])*eH)*(1+freezeK*.6+ch4b*.5));
   SZ[k]=(1.25*(1-eL)+.72*inL+.82*eH)*(1+freezeK*.45+ch4b*.35);TI[k]=-inL}
};
 /* Установившийся режим: после T=6.8 все точки уже в человеке (eL=1, eH=1). Отдельный
    литерал функции, который никогда не видит веток интро: у функции с полным путём V8
    собирает профиль типов ещё в интро, и после смены ветки она шла ~10 мс на кадр, а
    "чистая" копия того же кода - 0.3-0.4 мс (замер в живой странице, подменой функции). */
 var steady=function humanSteady(T,tm,dist,dvx,dvz,hx,hz,logoK,revOn,rr,heroK,mOn,nR,RW,ch4a,freezeK,ch4b){
  var P=MAIN.P,B=MAIN.B,A=MAIN.A,TI=MAIN.T,SZ=MAIN.S;
  var aBase=mob?.85:.75,bK=1+freezeK*.6+ch4b*.5,sK=.82*(1+freezeK*.45+ch4b*.35),sh=.005;
  var t21=tm*2.1,t17=tm*1.7,t24=tm*2.4,drift=ch4a>0;
  for(var k=0;k<NH;k++){
   var s0=HS[k*3],s1=HS[k*3+1],s2=HS[k*3+2];
   var px=HW[k*3],py=HW[k*3+1],pz=HW[k*3+2];
   if(drift){var ang4=s0*6.283+tm*.12,rise4=(.25+.95*s2*s2)*ch4a,rad4=(.1+.5*s1)*ch4a;
     px+=Math.cos(ang4)*rad4;pz+=Math.sin(ang4)*rad4;py+=rise4}
   P[k*3]=px+sh*SINT[((t21+s0*40)*SINK|0)&1023];P[k*3+1]=py+sh*SINT[((t17+s1*40)*SINK|0)&1023];P[k*3+2]=pz+sh*SINT[((t24+s2*40)*SINK|0)&1023];
   A[k]=aBase;
   var b=(.1+.9*HL[k])*bK;B[k]=b<1?b:1;
   SZ[k]=sK;TI[k]=0}
 };
 return {intro:intro,steady:steady};
}

(function(){try{
if(document.documentElement.classList.contains('no-webgl'))return;
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var mob=innerWidth<860;
function sm(a,b,x){var t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}
/* Камера глав 5-7 "прилетает" в свою систему координат быстро (первые 12% главы), а
   дальше весь прогресс главы отдан живому слежению (дольше по дуге/подъём кольца/вид
   сверху) без примеси камеры предыдущей главы - без этого слежение было бы искажено
   остатком предыдущей позиции камеры почти до самого конца главы (баг 16.10). */
function chIn(x){return sm(0,.12,x)}
function cl(x){return x<0?0:x>1?1:x}
function rnd(i){var x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
var D=Math.PI/180;

/* ---------- сцена ---------- */
var cv=document.getElementById('cv'),R;try{R=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true,powerPreference:'high-performance'});
}catch(err){fail(err);return}
R.setPixelRatio(Math.min(mob?1.5:2,devicePixelRatio||1));R.setClearColor(0x0A0A08,1);
var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,1,.05,80);
/* Правка 16.10 (чистка, пункт C8+C9): читаемость текста глав теперь не прямоугольной
   подложкой с видимой границей, а гашением точек поля позади активной панели прямо в
   шейдере (maskRect/maskOn, экранные координаты активной .chapter-text, считаются раз в
   кадр в loop() ниже) - мягкий растушёванный прямоугольник, без жёсткого края. Заодно
   ограничен максимальный размер точки (clamp, не только max) - близкие точки переднего
   плана главы 3 раньше вырастали в огромные "снежные" кружки без верхнего предела. */
/* Цвет логотипа (решение 19.10: знак не латунный, а костяной белый) берётся из CSS-токена
   --c-logo (tokens.css). Шейдер сырой и пишет цвет без перевода цветовых пространств,
   поэтому hex разбирается вручную в sRGB 0..1 (THREE.Color перевёл бы его в linear).
   Знак tint: >0 - латунь (только измеряемое: рябь шага, график, вспышки), <0 - цвет логотипа. */
function tokenRGB(name,fb){var h=(getComputedStyle(document.documentElement).getPropertyValue(name)||'').trim();if(!/^#[0-9a-f]{6}$/i.test(h))h=fb;
 return new THREE.Vector3(parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255)}
var MAT=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor,
 uniforms:{size:{value:mob?2.9:2.5},pr:{value:R.getPixelRatio()},maskRect:{value:new THREE.Vector4(-1,-1,-1,-1)},maskOn:{value:0},logoCol:{value:tokenRGB('--c-logo','#F2F0EB')}},
 vertexShader:'attribute float bri;attribute float al;attribute float tint;attribute float sz;varying float vb;varying float va;varying float vt;uniform float size;uniform float pr;void main(){vb=bri;va=al;vt=tint;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*sz*pr*(4.0/-mv.z),1.0,3.4*pr);gl_Position=projectionMatrix*mv;if(al<.004)gl_Position=vec4(2.,2.,2.,1.);}',
 fragmentShader:'varying float vb;varying float va;varying float vt;uniform vec4 maskRect;uniform float maskOn;uniform vec3 logoCol;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.12,d);vec3 bone=vec3(.949,.941,.922);vec3 base=bone*(.42+.58*vb);vec3 c=vt<0.?mix(base,logoCol,clamp(-vt,0.,1.)):mix(base,vec3(.867,.655,.31)*.95,clamp(vt,0.,1.));float al2=a*va*(.3+.85*vb);\n float mx=smoothstep(maskRect.x-60.0,maskRect.x,gl_FragCoord.x)*(1.0-smoothstep(maskRect.z,maskRect.z+60.0,gl_FragCoord.x));\n float my=smoothstep(maskRect.y-60.0,maskRect.y,gl_FragCoord.y)*(1.0-smoothstep(maskRect.w,maskRect.w+60.0,gl_FragCoord.y));\n al2*=mix(1.0,0.1,mx*my*maskOn);\n gl_FragColor=vec4(c,al2);}'});
function cloud(n){var g=new THREE.BufferGeometry(),o={n:n,P:new Float32Array(n*3),B:new Float32Array(n),A:new Float32Array(n),T:new Float32Array(n),S:new Float32Array(n),g:g};
 g.setAttribute('position',new THREE.BufferAttribute(o.P,3));g.setAttribute('bri',new THREE.BufferAttribute(o.B,1));g.setAttribute('al',new THREE.BufferAttribute(o.A,1));g.setAttribute('tint',new THREE.BufferAttribute(o.T,1));g.setAttribute('sz',new THREE.BufferAttribute(o.S,1));
 var p=new THREE.Points(g,MAT);p.frustumCulled=false;p.renderOrder=7;scene.add(p);o.up=function(){for(var k in g.attributes)g.attributes[k].needsUpdate=true};return o}

/* ---------- размеры ---------- */
var NH=mob?8000:22000,GX=mob?150:300,GZ=mob?120:250,N=GX*GZ;
var MAIN=cloud(NH); // точки человека (поле -> логотип -> человек); остальное поле - FIELD на видеокарте
var NF=11,KF=mob?140:200,FIGS=cloud(NF*KF); // 11 фигур главы 5 (на первом экране скрыты - alpha=0 вне главы 5)
var RL=mob?13:23,RP=64,RAIL=cloud(RL*RP);
/* глава 2: "из шага над полем вытягивается линия-график, как самописец" — латунная линия
   растёт вверх от последнего шага, пока активна глава 2, перерисовывается на каждый шаг.
   16.10: было почти не видно на скриншотах — по две точки на "перекладину" (толщина),
   крупнее и ярче обычных точек поля, чтобы читалось с первого взгляда, не терялось в поле. */
var GH=110,GN=GH*2,GRAPH=cloud(GN);
var GState={x:0,z:0,t0:-9};
var AX=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.02,0),new THREE.Vector3(0,2.15,0)]),new THREE.LineBasicMaterial({color:0xDDA74F,transparent:true,opacity:0,depthTest:false}));scene.add(AX);

/* ---------- поле ---------- */
var TX=new Float32Array(N),TZ=new Float32Array(N),SEED=new Float32Array(N*3),ROLE=new Int32Array(N),HIDX=new Int32Array(NH);
var XW=mob?16:22,Z0=-17,Z1=3.4,ZD=Z1-Z0;
(function(){var ids=new Int32Array(N);for(var i=0;i<N;i++)ids[i]=i;for(var i=N-1;i>0;i--){var j=Math.floor(rnd(i*1.7+.3)*(i+1)),t=ids[i];ids[i]=ids[j];ids[j]=t}
 for(var i=0;i<N;i++){var gx=i%GX,gz=Math.floor(i/GX);TX[i]=(gx+rnd(i*3.1)*.6)/GX*XW-XW/2;TZ[i]=Z0+(gz+rnd(i*5.3)*.6)/GZ*ZD;
  SEED[i*3]=rnd(i*7.7)*2-1;SEED[i*3+1]=rnd(i*9.1);SEED[i*3+2]=rnd(i*11.3)*2-1;ROLE[i]=-1}
 for(var k=0;k<NH;k++){ROLE[ids[k]]=k;HIDX[k]=ids[k]}})();
function wave(x,z,tm){return Math.sin(x*.55+tm*.45)*Math.cos(z*.42+tm*.3)*.34+Math.sin(x*1.25-z*.85+tm*.75)*.13+Math.sin(z*2.2+x*.5-tm*1.05)*.045}

/* ---------- поле на видеокарте (плавность, п.3) ---------- */
/* Замер 19.10 на реальной видеокарте (Intel UHD): пересчёт поля на CPU - 75 000 точек
   (волна, рябь, туман) плюс заливка всех атрибутов каждый кадр - стоил ~57 мс на кадр
   (14 к/с), скиннинг человека всего 1,7 мс. Поэтому на видеокарту переехало именно поле:
   точки с ROLE<0 (не участвуют в превращении "поле -> логотип -> человек") считаются в
   вершинном шейдере по тем же формулам, что были в цикле. В атрибутах - только постоянное
   (базовая позиция, сиды), всё меняющееся - uniform. Точки человека остались на CPU (MAIN). */
var NFLD=N-NH,FB=new Float32Array(NFLD*3),FS=new Float32Array(NFLD);
(function(){var j=0;for(var i=0;i<N;i++){if(ROLE[i]>=0)continue;FB[j*3]=TX[i];FB[j*3+1]=SEED[i*3+1];FB[j*3+2]=TZ[i];FS[j]=SEED[i*3]*.5+.5;j++}})();
var RIPU=[];for(var r=0;r<10;r++)RIPU.push(new THREE.Vector4(0,0,0,0));
var FMAT=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor,
 uniforms:{size:MAT.uniforms.size,pr:MAT.uniforms.pr,maskRect:MAT.uniforms.maskRect,maskOn:MAT.uniforms.maskOn,logoCol:MAT.uniforms.logoCol,
  tm:{value:0},ox:{value:0},oz:{value:0},hx:{value:0},hz:{value:0},logoK:{value:0},revOn:{value:1},rr:{value:0},bumpF:{value:1},heroK:{value:0},
  mOn:{value:0},mw:{value:new THREE.Vector2(9,9)},calmK:{value:0},flashK:{value:0},XW:{value:XW},Z0:{value:Z0},Z1:{value:Z1},ZD:{value:ZD},
  rip:{value:RIPU},ripT:{value:[0,0,0,0,0,0,0,0,0,0]},nRip:{value:0}},
 vertexShader:[
  'attribute float fseed;',
  'uniform float size,pr,tm,ox,oz,hx,hz,logoK,revOn,rr,bumpF,heroK,mOn,calmK,flashK,XW,Z0,Z1,ZD;',
  'uniform vec2 mw;uniform vec4 rip[10];uniform float ripT[10];uniform int nRip;',
  'varying float vb;varying float va;varying float vt;',
  'float sm(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}',
  'float wave(float x,float z){return sin(x*.55+tm*.45)*cos(z*.42+tm*.3)*.34+sin(x*1.25-z*.85+tm*.75)*.13+sin(z*2.2+x*.5-tm*1.05)*.045;}',
  'void main(){',
  ' float x=mod(position.x+ox+XW*.5,XW)-XW*.5;',
  ' float z=mod(position.z+oz-Z0,ZD)+Z0;',
  ' float dxh=x-hx,dzh=z-hz,dh=sqrt(dxh*dxh+dzh*dzh);',
  ' float mask=sm(.55,2.4,dh),amp=1.+1.5*sm(-1.,-13.,z);',
  ' float y=-.04+(wave(x,z)+.12)*amp*mask*(1.-.45*logoK);',
  ' float dc=sqrt(x*x+z*z),rev=1.,bump=0.;',
  ' if(revOn>.5){rev=sm(0.,.9,rr-dc);bump=.42*exp(-(dc-rr)*(dc-rr)*2.2)*bumpF;}',
  ' y+=bump;float rb=0.,rt=0.;',
  ' for(int r=0;r<10;r++){if(r>=nRip)break;vec4 q=rip[r];if(q.w<=0.)continue;float ex=x-q.x,ez=z-q.y,d2=ex*ex+ez*ez;if(d2>9.)continue;',
  '  float d=sqrt(d2),k1=d-q.z,k2=d-q.z+.22,ring=exp(-k1*k1*45.)+.6*exp(-k2*k2*45.);y+=.07*ring*q.w;rb+=ring*q.w*2.2;rt+=exp(-k1*k1*45.)*ripT[r];}',
  ' if(mOn>0.){float mdx=x-mw.x,mdz=z-mw.y,md=sqrt(mdx*mdx+mdz*mdz);y+=mOn*.2*exp(-md*md*.7)*cos(md*5.5-tm*4.2);}',
  ' float crest=clamp((y+.1)/(.62*amp),0.,1.);',
  ' float fog=sm(Z0,Z0+8.,z)*(1.-sm(2.4,Z1,z))*(1.-.55*heroK*sm(-.5,2.2,z))*(1.-sm(XW*.5-3.,XW*.5,abs(x)));',
  ' float alT=(1.15+.9*bump+.8*rb)*fog*rev,brT=min(1.,.16+.84*crest*crest+bump*1.5+rb);',
  ' float fy=y*(1.-calmK)-.04*calmK;',
  ' float flash=(position.y>.96&&flashK>0.)?pow(max(0.,1.-fract(tm*.5+fseed*53.1)/.04),2.):0.;',
  ' va=alT*(1.-.5*logoK)*(1.-calmK*.15)+flash*flashK*1.3;',
  ' vb=brT*(1.+flash*flashK*1.6);',
  ' vt=rt+flash*flashK*.9;',
  ' float sz=1.25+rt*.8+flash*flashK*1.3;',
  ' vec4 mv=modelViewMatrix*vec4(x,fy,z,1.);',
  ' gl_PointSize=clamp(size*sz*pr*(4.0/-mv.z),1.0,3.4*pr);',
  ' gl_Position=projectionMatrix*mv;',
  ' if(va<.004)gl_Position=vec4(2.,2.,2.,1.);',
  '}'].join('\n'),
 fragmentShader:MAT.fragmentShader});
(function(){var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(FB,3));g.setAttribute('fseed',new THREE.BufferAttribute(FS,1));
 var p=new THREE.Points(g,FMAT);p.frustumCulled=false;scene.add(p)})();

/* ---------- логотип ---------- */
var LW=mob?1.75:2.3,LH=LW*289/600,LCY=mob?1.45:1.5,TIP=[(464/600-.5)*LW,LCY+(144.5-1)/600*LW,0];
var LP=new Float32Array(NH*3);

/* Сплошной логотип (задача 14): форма из SVG живого сайта (_assets/img/logo-ac-negative.svg).
   Этот SVG - негатив: латунный квадрат с вырезанным знаком. Квадрат закрашивается целиком и из
   него вычитается SVG - остаётся сам знак. Рамка знака в единицах SVG: x 0..1000, y 258.92..740.59
   (та же рамка, что у маски точек logo-white-mask.png 600x289; совпадение формы IoU 0,991). Растр
   2048 px по ширине из вектора - края чёткие. Плоскость лежит там же, где точки логотипа
   (центр 0, LCY; размер LW x LH), цвет - тот же токен --c-logo, без перевода цветовых пространств. */
var FILL=null;
/* для автотестов (как window.__human): реальное время интро, сценарное T, доля заливки логотипа;
   freeze - остановить интро на заданной секунде (только для скриншотов) */
var INTRO=window.__intro={r:0,T:0,fill:0,ready:false,freeze:null};
/* Переход точки <-> заливка (правка 15): заливка проявляется по прозрачности (k) с мягким краем -
   маска смешивается от размытой к чёткой (soft); распад (dis) - знак покрывается зерном и съедается
   с краёв: пиксель гаснет, когда порог dis проходит его значение «зерно + расстояние до края»
   (расстояние берётся из размытой маски). */
function loadFill(){var img=new Image();img.onload=function(){try{
 var W=2048,H=Math.round(W*289/600),Y0=258.92,SH=481.67,sx=W/1000,sy=H/SH;
 function cv(blur){var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.globalCompositeOperation='destination-out';x.drawImage(img,0,-Y0*sy,1000*sx,1000*sy);
  if(!blur)return c;
  var b=document.createElement('canvas');b.width=W;b.height=H;var y=b.getContext('2d');y.filter='blur('+blur+'px)';y.drawImage(c,0,0);return b}
 var tex=new THREE.CanvasTexture(cv(0)),texB=new THREE.CanvasTexture(cv(18));tex.anisotropy=texB.anisotropy=4;
 var U={map:{value:tex},mapB:{value:texB},col:MAT.uniforms.logoCol,k:{value:0},soft:{value:0},dis:{value:0}};
 var m=new THREE.Mesh(new THREE.PlaneGeometry(LW,LH),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:U,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:['uniform sampler2D map,mapB;uniform vec3 col;uniform float k,soft,dis;varying vec2 vUv;',
   'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
   'void main(){float a=texture2D(map,vUv).a,b=texture2D(mapB,vUv).a;',
   ' float m=mix(b*smoothstep(.0,.6,b),a,soft);',
   ' float g=h(floor(vUv*vec2(900.,434.))),v=.5*g+.62*b,t=mix(.28,1.16,dis)*step(.001,dis);',
   ' float e=(1.-smoothstep(v-.05,v+.05,t))*(1.-.45*smoothstep(0.,.5,dis)*g);',
   ' gl_FragColor=vec4(col,m*k*e);}'].join('\n')}));
 m.position.set(0,LCY,0);m.renderOrder=8;m.frustumCulled=false;m.visible=false;scene.add(m);FILL={mesh:m,u:U};
 }catch(e){console.warn('сплошной логотип выключен',e)}};img.src=LOGO_FILL_SRC}
/* плавные кривые: smootherstep по отрезку (ease-in-out, нулевые 1-я и 2-я производные на концах) */
function ease(a,b,x){var t=cl((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10)}
/* после переходов точек логотипа: рост и уплотнение при сборке, гашение под заливкой, возврат при распаде.
   inL (доля «точка в логотипе») хранится как -TI: летящие точки не трогаем. */
function logoPoints(gK,ptK){if(gK<=0&&ptK>=1)return;
 var A=MAIN.A,SZ=MAIN.S,B=MAIN.B,TI=MAIN.T;
 for(var k=0;k<NH;k++){var inL=-TI[k];if(inL<=0)continue;
  SZ[k]*=1+1.9*gK*inL;B[k]+=(1-B[k])*.6*gK*inL;A[k]*=(1+.5*gK*inL)*(1-(1-ptK)*inL)}}

/* ---------- человек (3D-модель) ---------- */
var HSP=new Float32Array(NH*4),HBI=new Uint16Array(NH*4),HBW=new Float32Array(NH*4),HNB=new Float32Array(NH*3),HMESH=new Uint8Array(NH),HJ=new Uint8Array(NH);
var HW=new Float32Array(NH*3),HL=new Float32Array(NH),HYN=new Float32Array(NH);
var model,mixer,acts={},meshes=[],S=1,FOOTY=0,feet=[];
/* новый человек: модуль, пол стояния/ходьбы (FOOTY для каждого клипа), точки интро выключены */
var HUM=null,FOOTY_I=0,FOOTY_W=0,mainOff=false,WLB=null;
var FIGF=24,FIGP=null,LB=[null,null,null,null];

function skin(out,outL,list,count,applyXf,xf){
 // list: индексы в выборках
 for(var mi=0;mi<meshes.length;mi++){var m=meshes[mi];m.skeleton.update();m.M.multiplyMatrices(m.matrixWorld,m.bindMatrixInverse)}
 for(var q=0;q<count;q++){var k=list?list[q]:q,m=meshes[HMESH[k]],bm=m.skeleton.boneMatrices,M=m.M.elements;
  var px=HSP[k*4],py=HSP[k*4+1],pz=HSP[k*4+2],ax=0,ay=0,az=0,nx=0,ny=0,nz=0,nxs=HNB[k*3],nys=HNB[k*3+1],nzs=HNB[k*3+2];
  for(var j=0;j<4;j++){var w=HBW[k*4+j];if(w<=0)continue;var o=HBI[k*4+j]*16;
   ax+=w*(bm[o]*px+bm[o+4]*py+bm[o+8]*pz+bm[o+12]);ay+=w*(bm[o+1]*px+bm[o+5]*py+bm[o+9]*pz+bm[o+13]);az+=w*(bm[o+2]*px+bm[o+6]*py+bm[o+10]*pz+bm[o+14]);
   nx+=w*(bm[o]*nxs+bm[o+4]*nys+bm[o+8]*nzs);ny+=w*(bm[o+1]*nxs+bm[o+5]*nys+bm[o+9]*nzs);nz+=w*(bm[o+2]*nxs+bm[o+6]*nys+bm[o+10]*nzs)}
  var x=M[0]*ax+M[4]*ay+M[8]*az+M[12],y=M[1]*ax+M[5]*ay+M[9]*az+M[13],z=M[2]*ax+M[6]*ay+M[10]*az+M[14];
  var wx=M[0]*nx+M[4]*ny+M[8]*nz,wy=M[1]*nx+M[5]*ny+M[9]*nz,wz=M[2]*nx+M[6]*ny+M[10]*nz,nl=Math.sqrt(wx*wx+wy*wy+wz*wz)||1;wx/=nl;wy/=nl;wz/=nl;
  x*=S;y=(y-FOOTY)*S;z*=S;
  if(applyXf){var ca=xf.ca,sa=xf.sa,rx=x*ca+z*sa,rz=-x*sa+z*ca;x=rx+xf.x;z=rz+xf.z;var rnx=wx*ca+wz*sa,rnz=-wx*sa+wz*ca;wx=rnx;wz=rnz}
  out[q*3]=x;out[q*3+1]=y;out[q*3+2]=z;if(outL)outL[q]=Math.max(0,wx*.42+wy*.6+wz*.68)}
}

function loadModel(done){
 if(!USE_XBOT){
  HUMAN.init({renderer:R,scene:scene,modelUrl:HUMAN_URL,samplesUrl:HUMAN_SAMPLES,preset:mob?HUMAN_PRESET_PHONE:HUMAN_PRESET,mobile:mob,refDist:mob?5.9:6.1,renderOrder:5,mask:{maskRect:MAT.uniforms.maskRect,maskOn:MAT.uniforms.maskOn}})
   .then(function(h){HUM=h;window.__human=h;/* для автотестов: касания, пол, число точек */setupModel(h.gltf,h.mixer,h.actions,done)}).catch(fail);
  return}
 fetch(MODEL_URL).then(function(r){if(!r.ok)throw new Error('модель: HTTP '+r.status);return r.arrayBuffer()}).then(function(buf){
 new GLTFLoader().parse(buf,'',function(g){var mx=new THREE.AnimationMixer(g.scene),ac={};
  g.animations.forEach(function(a){ac[a.name]=mx.clipAction(a)});setupModel(g,mx,ac,done)},function(e){fail(e)})
 }).catch(fail)}

function setupModel(g,mx,ac,done){try{
  model=g.scene;model.updateMatrixWorld(true);
  model.traverse(function(o){if(o.isSkinnedMesh)meshes.push(o)});
  meshes.forEach(function(m){m.M=new THREE.Matrix4()});
  mixer=mx;acts=ac;
  acts.idle.play();acts.walk.play();acts.idle.setEffectiveWeight(1);acts.walk.setEffectiveWeight(0);
  /* Xbot: шаги по высоте костей носка. Новый человек: касания заранее посчитаны модулем по подошве
     (фаза цикла walk + точка касания), кольцо ставится ровно в момент касания - в frame(). */
  if(USE_XBOT){
  model.traverse(function(o){if(o.isBone&&(o.name==='mixamorigLeftToeBase'||o.name==='mixamorigRightToeBase'))feet.push({b:o,prev:9,dir:0,last:-9})});
  if(feet.length<2){feet=[];model.traverse(function(o){if(o.isBone&&/Left(Foot)$|Right(Foot)$/.test(o.name))feet.push({b:o,prev:9,dir:0,last:-9})})}}
  // площадь треугольников
  var tris=[],tot=0;
  meshes.forEach(function(m,mi){var ga=m.geometry,pa=ga.attributes.position.array,ix=ga.index.array,bmx=m.bindMatrix;m.geometry.computeBoundingBox();
   var v=new THREE.Vector3();m.BP=new Float32Array(pa.length);for(var i=0;i<pa.length/3;i++){v.set(pa[i*3],pa[i*3+1],pa[i*3+2]).applyMatrix4(bmx);m.BP[i*3]=v.x;m.BP[i*3+1]=v.y;m.BP[i*3+2]=v.z}
   var P=m.BP;for(var f=0;f<ix.length;f+=3){var a=ix[f]*3,b=ix[f+1]*3,c=ix[f+2]*3;var ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],wx=P[c]-P[a],wy=P[c+1]-P[a+1],wz=P[c+2]-P[a+2];
    var cx=uy*wz-uz*wy,cy=uz*wx-ux*wz,cz=ux*wy-uy*wx,ar=Math.sqrt(cx*cx+cy*cy+cz*cz)*.5;tot+=ar;tris.push(tot,mi,f)}});
  var nT=tris.length/3,cum=new Float64Array(nT);for(var i=0;i<nT;i++)cum[i]=tris[i*3];
  for(var k=0;k<NH;k++){var r=rnd(k*3.33+.71)*tot,lo=0,hi=nT-1;while(lo<hi){var mid=(lo+hi)>>1;if(cum[mid]<r)lo=mid+1;else hi=mid}
   var mi=tris[lo*3+1],f=tris[lo*3+2],m=meshes[mi],ga=m.geometry,ix=ga.index.array,P=m.BP,NA=ga.attributes.normal.array,SI=ga.attributes.skinIndex.array,SW=ga.attributes.skinWeight.array;
   var u1=rnd(k*5.1+.2),u2=rnd(k*6.7+.9);if(u1+u2>1){u1=1-u1;u2=1-u2}var w0=1-u1-u2,vs=[ix[f],ix[f+1],ix[f+2]],ws=[w0,u1,u2];
   var x=0,y=0,z=0,nx=0,ny=0,nz=0;for(var j=0;j<3;j++){var vi=vs[j];x+=P[vi*3]*ws[j];y+=P[vi*3+1]*ws[j];z+=P[vi*3+2]*ws[j];nx+=NA[vi*3]*ws[j];ny+=NA[vi*3+1]*ws[j];nz+=NA[vi*3+2]*ws[j]}
   var dom=vs[ws[0]>=ws[1]&&ws[0]>=ws[2]?0:ws[1]>=ws[2]?1:2];
   HSP[k*4]=x;HSP[k*4+1]=y;HSP[k*4+2]=z;HNB[k*3]=nx;HNB[k*3+1]=ny;HNB[k*3+2]=nz;HMESH[k]=mi;HJ[k]=mi===0&&meshes[0].name==='Beta_Joints'?1:0;
   for(var j=0;j<4;j++){HBI[k*4+j]=SI[dom*4+j];HBW[k*4+j]=SW[dom*4+j]}}
  // масштаб по позе покоя
  mixer.update(0);model.updateMatrixWorld(true);S=1;FOOTY=0;skin(HW,null,null,NH,false);
  var mn=1e9,mxY=-1e9;for(var k=0;k<NH;k++){var y=HW[k*3+1];if(y<mn)mn=y;if(y>mxY)mxY=y}S=1.82/(mxY-mn);FOOTY=mn;
  /* новый человек: в клипах CMU стопы стоят не на высоте позы покоя - пол каждого клипа (нижняя
     точка подошвы) замерен модулем, FOOTY в кадре смешивается между стоянием и ходьбой по весу ходьбы */
  if(HUM){FOOTY_I=HUM.floors.idle;FOOTY_W=HUM.floors.walk;FOOTY=FOOTY_I}
  skin(HW,null,null,NH,false);for(var k=0;k<NH;k++)HYN[k]=cl(HW[k*3+1]/1.82);
  // кадры ходьбы для дальних фигур
  var sub=new Int32Array(KF);for(var q=0;q<KF;q++)sub[q]=Math.floor(rnd(q*17.3+.4)*NH);
  FIGP=[];acts.idle.setEffectiveWeight(0);acts.walk.setEffectiveWeight(1);var dur=acts.walk.getClip().duration;
  if(HUM)FOOTY=FOOTY_W;
  for(var f=0;f<FIGF;f++){acts.walk.time=f/FIGF*dur;acts.idle.time=0;mixer.update(0);model.updateMatrixWorld(true);var arr=new Float32Array(KF*3);skin(arr,null,sub,KF,false);FIGP.push(arr)}
  if(HUM)FOOTY=FOOTY_I;
  acts.walk.time=0;acts.idle.setEffectiveWeight(1);acts.walk.setEffectiveWeight(0);mixer.update(0);
  if(HUM)walkCourse();
  model.traverse(function(o){if(o.isBone){var n=o.name.replace('mixamorig','');if(n==='Head')LB[2]=o;if(n==='Hips')LB[1]=o;if(n==='LeftLeg')LB[0]=o;if(n==='RightToeBase')LB[3]=o}});
  done()}catch(e){fail(e)}}

function loadLogo(done){var img=new Image();img.onerror=function(){fail(new Error('маска логотипа не загрузилась'))};img.onload=function(){try{
 var c=document.createElement('canvas');c.width=600;c.height=289;var x=c.getContext('2d');x.drawImage(img,0,0);var d=x.getImageData(0,0,600,289).data,F=[];
 for(var y=0;y<289;y++)for(var xx=0;xx<600;xx++)if(d[(y*600+xx)*4+3]>140)F.push(xx,y);
 var nf=F.length/2;
 for(var k=0;k<NH;k++){var p=Math.floor(rnd(k*13.37+.5)*nf),px=F[p*2]+rnd(k*2.2),py=F[p*2+1]+rnd(k*4.4);
  LP[k*3]=(px/600-.5)*LW;LP[k*3+1]=LCY+(144.5-py)/600*LW;LP[k*3+2]=(rnd(k*6.6)-.5)*.03}
 for(var r=0;r<RL;r++)for(var j=0;j<RP;j++){var q=r*RP+j,e=(j===0||j===RP-1);RAIL.P[q*3]=(r/(RL-1)-.5)*LW*1.18;RAIL.P[q*3+1]=LCY-LH*.7+j/(RP-1)*LH*1.4;RAIL.P[q*3+2]=-.08;RAIL.B[q]=e?1:.5;RAIL.S[q]=e?2.4:1.15}
 done()}catch(e){fail(e)}};img.src=LOGO_SRC}

/* ---------- глава 5: 11 фигур полукругом ---------- */
/* Было "фигуры вдали" на первом экране (убраны правкой 15.10) — переиспользую тот же пул
   точек (FIGS/FIGP, готовые кадры ходьбы) под главу 5, расставляю полукругом вместо
   случайного разброса, видимость теперь по прогрессу главы 5, не по heroK. */
var FC5={x:0,z:-7.5},FR5=6.2,FIG_ANG=[];
var FG=[];for(var f=0;f<NF;f++){var ang=(-70+140*f/(NF-1))*D;FIG_ANG.push(ang);
 FG.push({x:FC5.x+Math.sin(ang)*FR5,z:FC5.z-Math.cos(ang)*FR5,ca:1,sa:0,ph:f/NF,sp:.5,sc:.92+rnd(f*6.1)*.12})}

/* ---------- глава 6: кольцо из 9 узлов петли, человек идёт по кругу ---------- */
/* Сцена-витрина, как глава 5: центр круга фиксирован в мире, не на треадмиле поля (тот
   едет сам по себе через dvx/dvz*dist, как и в главе 5 - фигуры/узлы на него не завязаны).
   9 латунных узлов - те же 9 шагов петли, что в тексте главы (.chain b); 5 продуктов
   из текста подсвечиваются на части узлов (PROD_NODE), когда человек проходит мимо. */
var NR=9,RK=90,RING=cloud(NR*RK);
var RLOC=new Float32Array(RK*3);
(function(){for(var q=0;q<RK;q++){var rr=rnd(q*3.3+.11)*.09,aa=rnd(q*5.7+.37)*6.283,hh=rnd(q*7.1+.59)*.62;
 RLOC[q*3]=Math.cos(aa)*rr;RLOC[q*3+1]=hh;RLOC[q*3+2]=Math.sin(aa)*rr}})();
var WC6={x:0,z:-7},WR6=4.4,NODE_ANG=[];for(var j=0;j<NR;j++)NODE_ANG.push(j/NR*2*Math.PI);
var PROD_NODE=[0,2,4,6,8];

/* ---------- волны от шагов ---------- */
var RIP=[],MAXR=10;
function addRipple(x,z,tm,brass){RIP.push({x:x,z:z,t:tm,b:brass});if(RIP.length>MAXR)RIP.shift()}

/* ---------- время ---------- */
/* Интро в исходном темпе (как в bf225b2, 19.10), но без прелоадера: «калибровка», фазы,
   «Пропустить», Esc/Enter убраны (задача 14, 27.10); шапка и заголовок видны с первой отрисовки,
   как в этапе 0, п.2. Сжатие интро до 2,5 с пробовали 27.10 и вернули прежнюю скорость.
   T - реальные секунды от готовности модели и маски: поле -> логотип -> человек -> шаг (конец 9.6). */
var END=10,HERO0=8.0,REVEAL_T=7.6,SHORT_T=6.0,t0=0,last=0,dist=0,lastT=0;
/* Пауза собранного логотипа (правка 15): со сценарной секунды LOGO_HOLD0 сцена ждёт LOGO_HOLD с,
   пока заливка плавно проявляется и рассыпается; всё дальнейшее сдвигается на LOGO_HOLD
   (Tr - реальные секунды интро, T - сценарные). */
var LOGO_HOLD0=4.5,LOGO_HOLD=.5;
function sceneT(Tr){return Tr<LOGO_HOLD0?Tr:Tr<LOGO_HOLD0+LOGO_HOLD?LOGO_HOLD0:Tr-LOGO_HOLD}
var mx=0,my=0,tmx=0,tmy=0,mouseOn=0,MW=new THREE.Vector3(9,0,9);
addEventListener('pointermove',function(e){tmx=e.clientX/innerWidth*2-1;tmy=-(e.clientY/innerHeight*2-1);mouseOn=1});
function resize(){var w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.fov=w<h?44:32;cam.updateProjectionMatrix()}
resize();addEventListener('resize',function(){resize();if(reduce&&ready>=2)requestAnimationFrame(loop)});
var tmpV=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function lerp3(o,a,b,w){o[0]=a[0]+(b[0]-a[0])*w;o[1]=a[1]+(b[1]-a[1])*w;o[2]=a[2]+(b[2]-a[2])*w;return o}
var XF={ca:1,sa:0,x:0,z:0},YAW=-70*D;XF.ca=Math.cos(YAW);XF.sa=Math.sin(YAW);
/* «Беговая дорожка» (правка 15): человек идёт на месте, поле едет вдоль (DVX, DVZ). Раньше поле ехало
   с постоянной скоростью 1.15, а опорная стопа клипа - с переменной и под углом в несколько градусов
   (курс записи CMU; поправка курса из задачи 12 не была применена) - стопа в опоре скользила по полю
   (замер: левая ~12,6 см за опору, правая ~6,4 см, рывки до 3 см за кадр). Теперь: (1) курс клипа
   меряется при загрузке, человек доворачивается так, чтобы опорная стопа двигалась точно вдоль оси
   дорожки; (2) поле каждый кадр сдвигается ровно на столько, на сколько сдвинулась опорная стопа. */
var DVX=.94,DVZ=-.34,TOE=null,TOEP=[null,null],TOEMIN=[0,0];
window.__walkFix=null;/* для автотестов и отчёта: курс клипа и поворот */
function toeBones(){if(TOE)return;TOE=[null,null];model.traverse(function(o){if(!o.isBone)return;if(/LeftToeBase$/.test(o.name))TOE[0]=o;if(/RightToeBase$/.test(o.name))TOE[1]=o})}
/* вес опоры стопы по высоте носка над её минимумом (м): на полу 1, выше 2 см - 0 */
function toeW(i,y){return 1-sm(.004,.02,(y-TOEMIN[i])*S)}
function walkCourse(){toeBones();if(!TOE[0]||!TOE[1])return;
 var dur=acts.walk.getClip().duration,N=240,P=[];acts.idle.setEffectiveWeight(0);acts.walk.setEffectiveWeight(1);
 for(var f=0;f<=N;f++){acts.walk.time=f/N*dur;mixer.update(0);model.updateMatrixWorld(true);
  P.push(TOE.map(function(b){b.getWorldPosition(fw);return [fw.x,fw.y,fw.z]}))}
 for(var i=0;i<2;i++)TOEMIN[i]=Math.min.apply(null,P.map(function(c){return c[i][1]}));
 var dx=0,dz=0;for(var f=1;f<P.length;f++)for(var i=0;i<2;i++){var w=Math.min(toeW(i,P[f][i][1]),toeW(i,P[f-1][i][1]));dx+=w*(P[f][i][0]-P[f-1][i][0]);dz+=w*(P[f][i][2]-P[f-1][i][2])}
 /* поворот R(Y): (x,z) -> (x cosY + z sinY, -x sinY + z cosY), т.е. угол a -> a - Y. Нужно a(клип) - Y = a(дорожка) */
 var was=YAW;YAW=Math.atan2(dz,dx)-Math.atan2(DVZ,DVX);while(YAW-was>Math.PI)YAW-=2*Math.PI;while(was-YAW>Math.PI)YAW+=2*Math.PI;
 if(Math.abs(YAW-was)>20*D)YAW=was;/* курс не похож на ходьбу вперёд - не трогаем */
 window.__walkFix={yawWasDeg:+(was/D).toFixed(2),yawDeg:+(YAW/D).toFixed(2),turnDeg:+((YAW-was)/D).toFixed(2)};
 acts.walk.time=0;acts.idle.setEffectiveWeight(1);acts.walk.setEffectiveWeight(0);mixer.update(0);model.updateMatrixWorld(true)}
var fw=new THREE.Vector3();
/* Маска читаемости (пункт C8): раз в кадр берём панель глав 2-7 с наибольшей непрозрачностью
   (её ставит scroll-story.js в panel.style.opacity) и гасим точки поля в прямоугольнике её
   текста - mask- уходит, когда ни одна панель не видна (maskOn=0, прямоугольник недостижим). */
var MASK_PANELS=Array.prototype.slice.call(document.querySelectorAll('.chapter-panel .chapter-text'));
/* Плавность, п.3: прямоугольники текста не читаются из layout каждый кадр - панели глав
   fixed, их положение от прокрутки не зависит. Замер один раз, повтор после resize и после
   загрузки шрифтов (меняют переносы строк). */
var MASK_RECTS=null;
function measureMask(){MASK_RECTS=MASK_PANELS.map(function(el){var r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})}
addEventListener('resize',function(){MASK_RECTS=null});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){MASK_RECTS=null});
function updateMask(){
 var best=-1,bestO=0;
 for(var i=0;i<MASK_PANELS.length;i++){var o=parseFloat(MASK_PANELS[i].parentElement.style.opacity)||0;if(o>bestO){bestO=o;best=i}}
 if(best<0||bestO<.03){MAT.uniforms.maskOn.value=0;return}
 if(!MASK_RECTS)measureMask();
 var r=MASK_RECTS[best],pr=R.getPixelRatio(),H=innerHeight;
 MAT.uniforms.maskRect.value.set(r[0]*pr,(H-r[3])*pr,r[2]*pr,(H-r[1])*pr);
 MAT.uniforms.maskOn.value=bestO;
}
/* Подпись шага петли ("[ 06 ] ВОЗДЕЙСТВОВАТЬ" с линией-выноской и точкой) убрана с первого
   экрана правкой 16.10 (чистка, пункт A3) - петля и так объясняется текстом главы 6, здесь
   она читалась как лишний элемент (экран был перегружен). Латунное кольцо на шаге (рябь
   поля, addRipple/RIP ниже) - осталось, это "измерение", не текстовая подпись. */

var HP=makeHumanPoints({sm:sm,cl:cl,wave:wave,mob:mob,XW:XW,Z0:Z0,Z1:Z1,ZD:ZD,NH:NH,MW:MW,LP:LP,HW:HW,HL:HL,HYN:HYN,SEED:SEED,TX:TX,TZ:TZ,HIDX:HIDX,MAIN:MAIN});
/* Рендер-цикл: исключение в кадре останавливает сцену и переводит страницу в статичную
   раскладку (fail), а не роняет цикл молча с замёрзшим холстом. */
/* п.4: при prefers-reduced-motion цикл не крутится - один кадр итогового состояния
   интро (камера на месте, поле не волнуется: tm заморожено), перерисовка только на resize. */
/* п.5: во скрытой вкладке цикл останавливается (новый кадр не заказывается), по
   visibilitychange возобновляется - running не даёт запустить второй параллельный цикл. */
var running=false;
function loop(){
 if(dead){running=false;return}
 if(!reduce&&!document.hidden){running=true;requestAnimationFrame(loop)}else running=false;
 try{frame()}catch(e){fail(e)}
}
function frame(){
 var now=performance.now(),Tr=INTRO.freeze!=null?INTRO.freeze:(now-t0)/1000,T=sceneT(Tr),dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(T<lastT-.5){RIP.length=0;dist=0}lastT=T;
 var tm=reduce?12:now/1000;
 mx+=(tmx-mx)*.05;my+=(tmy-my)*.05;
 var heroK=sm(HERO0,HERO0+1.6,T);
 /* шапка и заголовок: проявляются, когда логотип ушёл в человека (человек собран к 7.4) */
 if(T>=REVEAL_T&&window.__reveal)window.__reveal(false);

 /* главы 2-7: прогресс скролла, умноженный на heroK - так главы не могут "обогнать"
    интро, даже если прокрутить очень быстро сразу после загрузки. При reduce-motion
    камера глав не едет вообще, остаётся на итоговом ракурсе интро. */
 var ch2=0,ch3=0,ch4=0,ch5=0,ch6=0,ch7=0;
 if(!reduce&&window.CH){ch2=(window.CH.ch2||0)*heroK;ch3=(window.CH.ch3||0)*heroK;ch4=(window.CH.ch4||0)*heroK;
  ch5=(window.CH.ch5||0)*heroK;ch6=(window.CH.ch6||0)*heroK;ch7=(window.CH.ch7||0)*heroK}

 /* глава 3: "точки на мгновение застывают в чёткий силуэт-снимок, потом оттаивают" —
    окно внутри главы 3, где поза перестаёт обновляться (mixer не тикает), плюс яркость/
    размер точек человека на это время приподняты (freezeK, применяется ниже по точкам). */
 var freezeWin=ch3>.32&&ch3<.62;
 var freezeK=sm(.32,.42,ch3)*(1-sm(.56,.62,ch3));

 /* поза человека */
 var walkW=sm(5.9,6.7,T)*(1-ch3);
 acts.idle.setEffectiveWeight(1-walkW);acts.walk.setEffectiveWeight(walkW);
 var wPrev=acts.walk.time;
 /* шаг анимации и дорожки - не больше 1/30 с: после тяжёлого кадра человек не прыгает вперёд */
 var adt=Math.min(dt,1/30);
 if(!freezeWin)mixer.update(adt);
 model.updateMatrixWorld(true);
 if(HUM)FOOTY=FOOTY_I+(FOOTY_W-FOOTY_I)*walkW;
 var HX=0,baseX=HX*heroK,baseZ=mob?-.2*heroK:0,baseCA=Math.cos(YAW),baseSA=Math.sin(YAW);
 /* глава 6: человек идёт по кругу - сцена-витрина, центр круга фиксирован в мире (как
    полукруг главы 5), не треадмил поля. Позиция и поворот смешиваются с обычной позой
    по ch6, чтобы вход/выход из главы были плавными. Круг укладывается в первые 82%
    прогресса главы (walkPh6), последние 18% - только подъём кольца в спираль (ниже). */
 var walkPh6=cl(ch6/.82),ang6=walkPh6*2*Math.PI;
 var hcx6=WC6.x+Math.sin(ang6)*WR6,hcz6=WC6.z-Math.cos(ang6)*WR6;
 var hYAW6=-(ang6+Math.PI/2),hca6=Math.cos(hYAW6),hsa6=Math.sin(hYAW6);
 XF.x=baseX+(hcx6-baseX)*ch6;XF.z=baseZ+(hcz6-baseZ)*ch6;
 XF.ca=baseCA+(hca6-baseCA)*ch6;XF.sa=baseSA+(hsa6-baseSA)*ch6;
 /* точки интро (MAIN) нужны только до смены на точки модуля - дальше не скинятся */
 if(!HUM||!mainOff)skin(HW,HL,null,NH,true,XF);
 /* шаги */
 var dvx=DVX,dvz=DVZ,step=1.15*walkW*adt;
 if(HUM&&TOE&&TOE[0]&&TOE[1]){var mv=0,ws=0;
  for(var i=0;i<2;i++){TOE[i].getWorldPosition(fw);var cur=[fw.x,fw.y,fw.z],pv=TOEP[i];
   if(pv&&!freezeWin){var w=Math.min(toeW(i,cur[1]),toeW(i,pv[1])),ddx=(cur[0]-pv[0])*S,ddz=(cur[2]-pv[2])*S;
    mv+=w*((ddx*XF.ca+ddz*XF.sa)*dvx+(-ddx*XF.sa+ddz*XF.ca)*dvz);ws+=w}
   TOEP[i]=cur}
  if(freezeWin)step=0;else if(ws>.3)step=Math.max(-.02,Math.min(.08,mv/ws))}
 dist+=step;
 /* для автотестов: журнал ходьбы (window.__walkLog = [] включает) - время кадра, время клипа, стопы
    в координатах поля (с учётом «беговой дорожки»): стопа в опоре там должна стоять на месте */
 if(window.__walkLog){if(!WLB){WLB=[];model.traverse(function(o){if(o.isBone&&/(Left|Right)ToeBase$/.test(o.name))WLB.push(o)})}
  var rec={t:now,dt:dt,wt:acts.walk.time,ww:walkW,f:[]};
  WLB.forEach(function(b){b.getWorldPosition(fw);var x=fw.x*S,z=fw.z*S,rx=x*XF.ca+z*XF.sa+XF.x,rz=-x*XF.sa+z*XF.ca+XF.z;rec.f.push([rx-dvx*dist,(fw.y-FOOTY)*S,rz-dvz*dist])});
  window.__walkLog.push(rec)}
 /* новый человек: латунное кольцо ровно в момент касания - когда время цикла walk проходит
    заранее замеренную фазу касания; точка - нижняя вершина подошвы в этот момент */
 if(HUM&&walkW>.6&&!freezeWin){var wd=acts.walk.getClip().duration,p0=wPrev/wd,p1=acts.walk.time/wd;
   HUM.contacts.forEach(function(c){var hit=p1>=p0?(c.phase>p0&&c.phase<=p1):(c.phase>p0||c.phase<=p1);
     if(!hit||T-(c.last||-9)<.25)return;c.last=T;
     var x=c.x*S,z=c.z*S,rx=x*XF.ca+z*XF.sa+XF.x,rz=-x*XF.sa+z*XF.ca+XF.z;addRipple(rx-dvx*dist,rz-dvz*dist,tm,1);
     if(ch2>.1)GState={x:rx-dvx*dist,z:rz-dvz*dist,t0:tm}})}
 if(!HUM&&walkW>.6)feet.forEach(function(f,fi){f.b.getWorldPosition(fw);var y=(fw.y-FOOTY)*S,dy=y-f.prev;
   if(f.dir<0&&dy>=0&&y<.09&&T-f.last>.3){var x=fw.x*S,z=fw.z*S,rx=x*XF.ca+z*XF.sa+XF.x,rz=-x*XF.sa+z*XF.ca+XF.z;addRipple(rx-dvx*dist,rz-dvz*dist,tm,1);f.last=T;
     if(ch2>.1)GState={x:rx-dvx*dist,z:rz-dvz*dist,t0:tm}}
   f.dir=dy<0?-1:dy>0?1:f.dir;f.prev=y});
 var hx=XF.x,hz=XF.z;

 /* мышь */
 if(heroK>0&&mouseOn){ray.setFromCamera({x:mx,y:my},cam);var hit=ray.ray.intersectPlane(plane,tmpV);if(hit)MW.lerp(hit,.15)}
 var mOn=heroK*mouseOn;
 var rr=(T-.3)*5.2,revOn=T<3.5;
 var logoK=sm(1.4,2.8,T)*(1-sm(4.6,6.0,T));
 /* Сплошной логотип (правка 15, по реальному времени Tr):
    2.5-4.0 точки логотипа растут, ярчают, промежутки заполняются (gK);
    2.8-4.2 заливка проявляется по прозрачности, край от размытого к чёткому (inK, softK);
    точки гаснут, только когда заливка набрала силу (inK > .55);
    4.4-5.3 распад: зерно и края съедаются (disK), точки возвращаются и с 5.05 летят в человека. */
 var inK=ease(2.8,4.2,Tr),softK=ease(3.3,4.2,Tr),disK=ease(4.4,5.3,Tr),gK=ease(2.5,4.0,Tr)*(1-disK);
 var fillK=FILL?inK*(1-disK):0,ptK=1-ease(.55,1,inK)*(1-ease(0,.75,disK));
 if(FILL){FILL.mesh.visible=fillK>.001;FILL.u.k.value=inK;FILL.u.soft.value=softK;FILL.u.dis.value=disK}else{gK=0;ptK=1}
 INTRO.r=(now-t0)/1000;INTRO.Tr=Tr;INTRO.T=T;INTRO.fill=fillK;
 /* глава 4, две фазы: A — точки поднимаются из человека в поле (информация),
    B — наоборот, густеют на человеке (воздействие). Половины главы, с нахлёстом
    на стыке, чтобы не было рывка. */
 var ch4a=sm(0,.5,ch4)*(1-sm(.42,.56,ch4));
 var ch4b=sm(.46,.72,ch4);
 var nR=RIP.length,RW=[];for(var r=0;r<nR;r++){var p=RIP[r],a=tm-p.t;RW.push([p.x+dvx*dist,p.z+dvz*dist,.12+a*1.5,Math.max(0,1-a/2.4),r===nR-1?Math.max(0,1-a/1.3):0])}
 /* поле (FIELD) - параметры кадра в uniform, сам расчёт в вершинном шейдере */
 var FU=FMAT.uniforms,nRu=Math.min(nR,10);
 FU.tm.value=tm;FU.ox.value=(dvx*dist)%XW;FU.oz.value=((dvz*dist)%ZD+ZD)%ZD;FU.hx.value=hx;FU.hz.value=hz;
 FU.logoK.value=logoK;FU.revOn.value=revOn?1:0;FU.rr.value=rr;FU.bumpF.value=1-sm(2.6,3.4,T);FU.heroK.value=heroK;
 FU.mOn.value=mOn;FU.mw.value.set(MW.x,MW.z);FU.calmK.value=sm(.08,.5,ch7);FU.flashK.value=sm(.02,.2,ch7)*(1-sm(.45,.7,ch7));
 for(var r=0;r<nRu;r++){var q=RW[r];RIPU[r].set(q[0],q[1],q[2],q[3]);FU.ripT.value[r]=q[4]}FU.nRip.value=nRu;
 /* точки человека (MAIN, CPU): поле -> логотип -> человек. Их "полевая" часть (волна,
    рябь, туман) нужна только пока точка ещё не улетела в логотип (eL<1, первые секунды
    интро) - дальше она умножается на (1-eL)=0, поэтому не считается. */
 /* новый человек: к концу интро точки MAIN (CPU) сменяются точками модуля (GPU) - модуль
    проявляется вразнобой по номеру точки, MAIN гаснет; дальше MAIN не считается совсем.
    Главы 3 и 4 (снимок, подъём точек, «густеет») - теми же величинами в шейдере модуля. */
 if(HUM){
  var hIn=reduce?1:sm(6.7,7.4,T),mOut=reduce?0:1-sm(6.95,7.55,T);
  if(mOut>0){mainOff=false;(T<6.8?HP.intro:HP.steady)(T,tm,dist,dvx,dvz,hx,hz,logoK,revOn,rr,heroK,mOn,nR,RW,ch4a,freezeK,ch4b);
   if(mOut<1)for(var k=0;k<NH;k++)MAIN.A[k]*=mOut;
   logoPoints(gK,ptK);
   MAIN.up()}
  else if(!mainOff){MAIN.A.fill(0);MAIN.up();mainOff=true}
  HUM.setTransform(S,FOOTY,XF.x,XF.z,XF.ca,XF.sa);
  HUM.setProgress({alpha:hIn,occ:hIn*(1-.85*ch4a),tm:tm,drift:ch4a,boost:freezeK*.6+ch4b*.5,sizeK:(1+freezeK*.45)*(1+ch4b*.35)});
  HUM.update();
 }else{
 (T<6.8?HP.intro:HP.steady)(T,tm,dist,dvx,dvz,hx,hz,logoK,revOn,rr,heroK,mOn,nR,RW,ch4a,freezeK,ch4b);
 logoPoints(gK,ptK);
 MAIN.up()}
 var bi=HIDX[0],bk=sm(3.0,3.5,T)*(1-sm(4.5,4.9,T));
 /* рельсы */
 var ra=sm(2.3,3.0,T)*(1-sm(4.3,5.0,T));
 RAIL.g.attributes.al.needsUpdate=true;
 /* глава 2: график-самописец от последнего шага. Видна почти всю главу (широкое окно),
    толщина — две точки на "перекладину" с небольшим боковым разводом, крупнее и ярче
    обычных точек поля (SZ 2.3 против ~1.25 у поля, B=1 максимум), чтобы не терялась. */
 var gEnv=sm(.03,.12,ch2)*(1-sm(.94,1,ch2));
 var gage=tm-GState.t0,ggrow=cl(gage/1.05),gtail=cl(1-(gage-1.05)/.9);
 var ggx=GState.x+dvx*dist,ggz=GState.z+dvz*dist;
 for(var hIdx=0;hIdx<GH;hIdx++){var u=hIdx/(GH-1),h=u*1.4;
   var wob=Math.sin(u*13+tm*2.3)*.07*(1-u*.3)+Math.sin(u*29-tm*3.4)*.025;
   var vis=u<=ggrow?1:0,al=gEnv*vis*gtail*(1-u*.15);
   for(var side=0;side<2;side++){var q=hIdx*2+side,off=side===0?-.028:.028;
     GRAPH.P[q*3]=ggx+wob+off;GRAPH.P[q*3+1]=h;GRAPH.P[q*3+2]=ggz;
     GRAPH.A[q]=al;GRAPH.B[q]=1;GRAPH.S[q]=2.3;GRAPH.T[q]=1}}
 GRAPH.up();
 /* глава 5: 11 фигур полукругом, каждая на своём месте (без дрейфа и без переноса на
    дистанцию шага dist - это не часть движущегося поля, а отдельная сцена-витрина).
    Текущая по прогрессу главы фигура ярче и крупнее - "подписи загораются в такт" (сама
    подпись - HTML-лейбл ниже в коде, подсвечивается тем же near). */
 var curIdx5=-1;
 if(NF>0){
   var segW=1/NF;
   for(var f=0;f<NF;f++){var F=FG[f];
     var wx0=F.x,wz0=F.z;
     var gy=-.04+(wave(wx0,wz0,tm)+.12)*(1+1.5*sm(-1,-13,wz0));
     var fr=FIGP[Math.floor(((tm*F.sp+F.ph)%1)*FIGF)%FIGF];
     var segC=(f+.5)*segW,near=ch5>0?cl(1-Math.abs(ch5-segC)/(segW*.85)):0;
     if(near>0.5)curIdx5=f;
     var al=ch5*(0.75+0.75*near);
     for(var q=0;q<KF;q++){var o=f*KF+q,lx=fr[q*3]*F.sc,ly=fr[q*3+1]*F.sc,lz=fr[q*3+2]*F.sc;
       FIGS.P[o*3]=wx0+lx*F.ca+lz*F.sa;FIGS.P[o*3+1]=gy+ly;FIGS.P[o*3+2]=wz0-lx*F.sa+lz*F.ca;
       FIGS.A[o]=al;FIGS.B[o]=.8+.2*near;FIGS.S[o]=1.3+.9*near;FIGS.T[o]=.1+.6*near}}
 }
 FIGS.up();
 if(curIdx5!==window._ch5active){window._ch5active=curIdx5;
   var chips=document.querySelectorAll('#ch5panel .chips span');
   chips.forEach(function(el,ix){el.classList.toggle('active',ix===curIdx5)})}

 /* глава 6: кольцо из 9 узлов - ringRise поднимает их из-под поля (как "поднимается из
    поля" в задании), nodeOn загорается по одному, когда пройденная человеком дуга
    (walkPh6, посчитан выше перед skin()) доходит до сектора узла, и остаётся гореть -
    "шаги зажигают узлы" зажигает по кругу, не гасит. После полного круга (spiralK)
    узлы доворачиваются и расходятся по высоте - кольцо становится спиралью. */
 var ringRise=sm(0,.1,ch6),spiralK=sm(.8,1,ch6),curNode6=-1;
 for(var j=0;j<NR;j++){
   var nodeOn=cl(walkPh6*NR-j);if(nodeOn>.5)curNode6=j;
   var na=NODE_ANG[j]+spiralK*3,nr=WR6*(1-spiralK*.5);
   var nx6=WC6.x+Math.sin(na)*nr,nz6=WC6.z-Math.cos(na)*nr;
   var ny6=-.5+ringRise*1.9+spiralK*(j/(NR-1))*2.4;
   var bri6=.55+.45*nodeOn,sz6=1+.6*nodeOn,al6=ringRise*(.5+.5*nodeOn);
   for(var q=0;q<RK;q++){var o=j*RK+q;
     RING.P[o*3]=nx6+RLOC[q*3];RING.P[o*3+1]=ny6+RLOC[q*3+1]*(1+spiralK*.8);RING.P[o*3+2]=nz6+RLOC[q*3+2];
     RING.A[o]=al6;RING.B[o]=bri6;RING.S[o]=sz6;RING.T[o]=.6+.4*nodeOn}}
 RING.up();
 if(curNode6!==window._ch6active){window._ch6active=curNode6;
   var chainB=document.querySelectorAll('#ch6panel .chain b');
   chainB.forEach(function(el,ix){el.classList.toggle('active',ix===curNode6)});
   document.querySelectorAll('#ch6panel .products span').forEach(function(el,ix){
     el.classList.toggle('active',PROD_NODE[ix]===curNode6)})}
 /* ось */
 AX.position.set(hx,0,hz);AX.material.opacity=0;AX.visible=false;AX.scale.y=Math.max(.001,sm(HERO0+1,HERO0+2.2,T));

 /* камера */
 var c0=[0,3.6,7.6],t0v=[0,0,-1],
     cL=mob?[0,1.2,6.2]:[0,1.08,5.0],tL=mob?[0,1.3,0]:[0,1.22,0],
     cH=mob?[0,1.2,6.2]:[0,1.1,4.6],tH=[0,.95,0],
     cE=mob?[0,1.05,5.9]:[0,1.1,6.1],tE=mob?[0,.2,0]:[0,1.0,0];
 var a=sm(1.0,3.0,T),b=sm(4.6,6.3,T),cc=[0,0,0],tt=[0,0,0];
 lerp3(cc,c0,cL,a);lerp3(tt,t0v,tL,a);lerp3(cc,cc,cH,b);lerp3(tt,tt,tH,b);lerp3(cc,cc,cE,heroK);lerp3(tt,tt,tE,heroK);
 var drift=(1-heroK);cc[0]+=Math.sin(tm*.23)*.12*drift;cc[1]+=Math.sin(tm*.31)*.05*drift;
 cc[0]+=mx*.28*heroK;cc[1]+=my*.14*heroK;
 /* глава 2: камера опускается к стопе, одна волна крупно */
 var cCh2=[0,.5,2.0],tCh2=[0,-.05,.4];
 lerp3(cc,cc,cCh2,ch2);lerp3(tt,tt,tCh2,ch2);
 /* глава 3: отъезд назад, видно человека целиком, он останавливается (walkW выше) */
 var cCh3=mob?[0,1.4,7.8]:[0,1.35,8.0],tCh3=[0,1.0,0];
 lerp3(cc,cc,cCh3,ch3);lerp3(tt,tt,tCh3,ch3);
 /* глава 4: лёгкий боковой увод камеры, чтобы было видно и точки, уходящие вверх (фаза A),
    и то, как человек густеет точками (фаза B) — камера не отвлекает, почти статична */
 var cCh4=[mob?.5:.9,1.3,7.2],tCh4=[0,1.05,0];
 lerp3(cc,cc,cCh4,ch4);lerp3(tt,tt,tCh4,ch4);
 /* глава 5: камера едет вдоль полукруга фигур синхронно с прогрессом - "проезжает вдоль" */
 var ang5=(-70+140*ch5)*D;
 var cCh5=[FC5.x+Math.sin(ang5)*3.4,1.1,FC5.z-Math.cos(ang5)*3.4+4.6];
 var tCh5=[FC5.x+Math.sin(ang5)*FR5,2.3,FC5.z-Math.cos(ang5)*FR5];
 lerp3(cc,cc,cCh5,chIn(ch5));lerp3(tt,tt,tCh5,chIn(ch5));
 /* глава 6: камера медленно орбитит вокруг кольца (медленнее человека - не укачивает),
    держит в кадре и человека, и текущий узел; на подъёме спирали (spiralK) отъезжает
    и поднимается, чтобы видно было, как кольцо вытягивается вверх */
 var camAng6=ang6*.4;
 /* Чистка 16.10, пункт C12: цель камеры была на высоте торса человека (.9) - ровно там же,
    где центр текстовой панели главы, человек стоял прямо в строке продуктов. Поднял точку
    взгляда (как раньше для главы 5), чтобы человек и кольцо были ниже панели, на виду. */
 var cCh6=[WC6.x+Math.sin(camAng6)*2.2,1.6+spiralK*1.8,WC6.z-Math.cos(camAng6)*2.2+7.4-spiralK*1.6];
 var tCh6=[WC6.x,2.1+ringRise*0.3+spiralK*0.8,WC6.z];
 lerp3(cc,cc,cCh6,chIn(ch6));lerp3(tt,tt,tCh6,chIn(ch6));
 /* глава 7: вид сверху - камера поднимается над полем и смотрит прямо вниз. Прямой
    "смотреть вниз" - вырожденный случай для lookAt (направление параллельно обычному
    up(0,1,0)), поэтому up на время главы доворачивается к (0,0,-1), иначе кадр дёргается */
 var cCh7=[0,mob?9.5:11.5,-5],tCh7=[cCh7[0],0,cCh7[2]];
 var ch7w=chIn(ch7);
 lerp3(cc,cc,cCh7,ch7w);lerp3(tt,tt,tCh7,ch7w);
 var upY=1-ch7w,upZ=-ch7w,upL=Math.sqrt(upY*upY+upZ*upZ)||1;
 cam.up.set(0,upY/upL,upZ/upL);
 cam.position.set(cc[0],cc[1],cc[2]);cam.lookAt(tt[0],tt[1],tt[2]);
 updateMask();
 R.render(scene,cam);

 /* Шапка и заголовок здесь не ведутся: видны с первой отрисовки по CSS (этап 0, п.2), уход
    заголовка при скролле в главу 2 - scroll-story.js. */
}
var ready=0;function go(){if(++ready<2)return;t0=performance.now();INTRO.ready=true;last=t0;if(reduce)t0-=(END+LOGO_HOLD)*1000;else if(window.__introShort)t0-=(SHORT_T+LOGO_HOLD)*1000;requestAnimationFrame(loop)}
document.addEventListener('visibilitychange',function(){
 if(document.hidden||running||dead||reduce||ready<2)return;
 last=performance.now();running=true;requestAnimationFrame(loop)});
loadLogo(go);loadModel(go);loadFill();
}catch(e){fail(e)}})();
