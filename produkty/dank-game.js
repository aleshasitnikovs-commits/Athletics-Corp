const dialog = document.querySelector('#dank-game');
const canvas = dialog.querySelector('canvas');
const ctx = canvas.getContext('2d');
const shoot = dialog.querySelector('[data-shoot]');
const readout = dialog.querySelector('[data-result]');
const meter = dialog.querySelector('meter');
const powerLabel = dialog.querySelector('[data-power]');
const tally = dialog.querySelector('[data-score]');
const attempts = dialog.querySelector('[data-attempts]');
const reward = dialog.querySelector('[data-reward]');
const stations = [...dialog.querySelectorAll('[data-station]')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const court = [{distance:3.1,points:2},{distance:6.7,points:3},{distance:12.8,points:5}];
const rimX = 14.2, rimY = 3.05, handY = 1.78;
const ballR = .16, gravity = 9.81, direction = 55 * Math.PI / 180;
const duration = 1450;
const cream = '#f2f0eb', gold = '#dda74f';
let station = 0, made = 0, shots = 0, score = 0;
let charge, flight, frame = 0, previous = 0;

function project(x, y, z=0) {
  return [76 + x*44 + z*39, 310 - y*62 - z*33];
}

function line(vertices, color, opacity, dashed = true) {
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.setLineDash(dashed ? [2,5] : []);
  ctx.beginPath();
  vertices.forEach((vertex,i) => {
    const [x,y] = project(...vertex);
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

function circle(x,y,z,r,color,opacity) {
  const [px,py]=project(x,y,z);
  ctx.globalAlpha=opacity;
  ctx.strokeStyle=color;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(px,py,r*44,r*55,0,0,Math.PI*2);
  ctx.stroke();
}

function draw() {
  const start=rimX-court[station].distance;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  line([[.8,0,-.45],[15.2,0,-.45],[15.2,0,1.1],[.8,0,1.1],[.8,0,-.45]],cream,.5);
  line([[13.9,0,-.45],[13.9,0,1.1]],cream,.21,false);
  line([[15.1,0,.12],[15.1,3.63,.12],[14.66,3.63,.12]],cream,.37);
  line([[14.66,2.75,-.23],[14.66,3.67,-.23],[14.66,3.67,.62],[14.66,2.75,.62],[14.66,2.75,-.23]],cream,.72);
  line([[13.96,3.02,.01],[14.02,2.55,.01],[14.36,2.55,.01],[14.45,3.02,.01]],cream,.56);
  line([[14.07,3.02,.08],[14.11,2.55,.08],[14.28,2.55,.08],[14.33,3.02,.08]],cream,.28);
  const [rx,ry]=project(rimX,rimY);
  ctx.globalAlpha=.95;
  ctx.strokeStyle=gold;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(rx,ry,20,5,0,0,Math.PI*2);
  ctx.stroke();
  court.forEach(({distance},i)=>{
    const x=rimX-distance;
    line([[x-.12,0,-.11],[x+.12,0,-.11],[x+.12,0,.11],[x-.12,0,.11],[x-.12,0,-.11]],
      i===station?gold:cream,i===station ? .98 : .38,false);
  });
  if(flight) {
    const points=flight.trace;
    if(points.length>1) line(points,gold,.35);
    circle(flight.x,flight.y,0,ballR,gold,.98);
    line([[flight.x-ballR*.82,flight.y,0],[flight.x+ballR*.82,flight.y,0]],gold,.72,false);
  } else {
    line([[start,0,0],[start,handY-.25,0]],cream,.23);
    circle(start,handY,0,ballR,gold,1);
  }
  ctx.globalAlpha=1;
}

function scoreboard() {
  tally.textContent=score;
  attempts.textContent=made+' / '+shots;
  reward.hidden=score<10;
}

function power(now) {
  return charge ? Math.min(1,Math.max(0,(now-charge.start)/duration)) : 0;
}
function paintPower(p) {
  meter.value=Math.round(p*100);
  powerLabel.textContent=meter.value+'%';
}

function queue() {
  if(!frame) frame=requestAnimationFrame(update);
}

function update(now) {
  frame=0;
  if(!dialog.open) return;
  const dt = previous ? Math.min(.04,(now-previous)/1000) : 0;
  previous=now;
  if(charge) paintPower(power(now));
  if(flight) {
    flight.elapsed += reduce.matches ? flight.total : dt;
    const time=flight.elapsed;
    flight.x=flight.start+flight.vx*time;
    flight.y=Math.max(ballR,handY+flight.vy*time-.5*gravity*time*time);
    flight.trace.push([flight.x,flight.y,0]);
    if(flight.trace.length>25) flight.trace.shift();
    if(time>=flight.land) {
      const { result, strength } = flight;
      const points=court[station].points;
      flight=null;
      shots++;
      if(result==='hit') {
        made++;
        score+=points;
        readout.textContent='Попадание! +'+points+' '+(points===5?'очков.':'очка.');
      } else {
        readout.textContent=result==='short'?'Недолёт. Попробуйте добавить силы.':'Перелёт. Попробуйте отпустить раньше.';
      }
      readout.textContent+=' Сила '+strength+'%.';
      if(score>=10 && reward.hidden) readout.textContent+=' Открыта памятка по съёмке прыжка.';
      shoot.removeAttribute('aria-disabled');
      stations.forEach(button=>button.disabled=false);
      paintPower(0);
      scoreboard();
    }
  }
  draw();
  if(charge || flight) queue();
  else previous=0;
}

function begin(id) {
  if(charge || flight || !dialog.open) return false;
  charge={id,start:performance.now()};
  readout.textContent='Набирайте силу и отпустите кнопку.';
  queue();
  return true;
}

function release(id) {
  if(charge?.id!==id) return;
  const p=power(performance.now());
  charge=null;
  paintPower(p);
  const speed=4.7 + p*10.65;
  const vx=speed*Math.cos(direction), vy=speed*Math.sin(direction);
  const start=rimX-court[station].distance;
  const discriminant=vy*vy-2*gravity*(rimY-handY);
  const crossing=discriminant>0 ? start+vx*(vy+Math.sqrt(discriminant))/gravity : start;
  const difference=crossing-rimX;
  const result=Math.abs(difference)<.47?'hit':difference<0?'short':'long';
  const atRim=discriminant>0 ? (vy+Math.sqrt(discriminant))/gravity : 0;
  const ground=(vy+Math.sqrt(vy*vy+2*gravity*(handY-ballR)))/gravity;
  const land=result==='hit'? atRim+.32 : Math.min(ground+.12,(16-start)/vx);
  flight={elapsed:0,total:land,land,result,start,vx,vy,x:start,y:handY,trace:[],strength:Math.round(p*100)};
  readout.textContent='Мяч в воздухе…';
  shoot.setAttribute('aria-disabled','true');
  stations.forEach(button=>button.disabled=true);
  queue();
}

function cancel() {
  if(!charge) return;
  charge=null;
  paintPower(0);
  readout.textContent='Зажмите кнопку и отпустите для броска.';
}

function select(index) {
  cancel();
  station=index;
  stations.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  const points=court[index].points;
  readout.textContent='За попадание с этой позиции — '+points+' '+(points===5?'очков.':'очка.');
  draw();
}

stations.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
shoot.addEventListener('pointerdown',event=>{
  if(event.button!==0 || !begin(event.pointerId)) return;
  shoot.setPointerCapture(event.pointerId);
});
shoot.addEventListener('pointerup',event=>release(event.pointerId));
shoot.addEventListener('pointercancel',cancel);
shoot.addEventListener('keydown',event=>{
  if(event.code!=='Space' && event.code!=='Enter') return;
  event.preventDefault();
  if(!event.repeat) begin('keyboard');
});
shoot.addEventListener('keyup',event=>{
  if(event.code!=='Space' && event.code!=='Enter') return;
  event.preventDefault();
  release('keyboard');
});
shoot.addEventListener('blur',()=>{if(charge?.id==='keyboard') cancel();});
shoot.addEventListener('click',event=>{
  // Assistive technology can activate the button without a pointer or paired key events.
  if(event.detail!==0 || !begin('accessible')) return;
  charge.start-=duration*.5;
  release('accessible');
});
let launcher;
export function openGame(button) {
  if(dialog.open) return;
  launcher=button;
  dialog.showModal();
  draw();
  stations[station].focus();
}
dialog.addEventListener('close',()=>{
  charge=flight=null;
  previous=0;
  cancelAnimationFrame(frame);
  frame=0;
  stations.forEach(button=>button.disabled=false);
  shoot.removeAttribute('aria-disabled');
  paintPower(0);
  readout.textContent='Зажмите кнопку и отпустите для броска.';
  launcher?.focus();
  launcher=null;
});
