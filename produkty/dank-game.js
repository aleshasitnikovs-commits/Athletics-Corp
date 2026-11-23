import {
  ballR, board, createShot, handY, netDepth, netExit, rimRadius, rimX, rimY, stepShot, stepTime,
} from './dank-physics.js';

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
const duration = 1450;
const cream = '#f2f0eb', gold = '#dda74f';
const meshRows = 4, meshColumns = 5;
let station = 0, made = 0, shots = 0, score = 0;
let charge, flight, frame = 0, previous = 0, timeBank = 0;

function project(x, y, z=0) {
  return [76 + x*44 + z*39, 310 - y*62 - z*33];
}

function line(vertices, color, opacity, dashed = true, width = 1.6) {
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [2,5] : []);
  ctx.beginPath();
  vertices.forEach((vertex,i) => {
    const [x,y] = project(...vertex);
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

function drawBall(x, y) {
  const [px, py] = project(x, y);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = gold;
  ctx.fillStyle = '#4e351d';
  ctx.lineWidth = 1.45;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(px, py, ballR * 50, ballR * 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  line([[x - ballR * .78, y, 0], [x + ballR * .78, y, 0]], gold, .65, false, .9);
}

function drawHoop(near) {
  const contact = flight?.netContact;
  const age = contact ? flight.elapsed - contact.time : 0;
  const swing = contact ? Math.sin(age * 19) * Math.exp(-age * 6) : 0;
  const sector = Math.PI / meshColumns;
  const start = near ? Math.PI : 0;
  function knot(angle, row) {
    const t = row / meshRows;
    const radius = rimRadius + (netExit - rimRadius + Math.abs(swing) * .032) * t;
    return [
      rimX + Math.cos(angle) * radius + swing * .14 * t,
      rimY - netDepth * t + (contact ? swing * contact.x * .6 * t : 0),
      Math.sin(angle) * radius,
    ];
  }
  for (let row = 0; row < meshRows; row++) {
    const base = row + (row % 2);
    const mid = 2 * row + 1 - base;
    for (let i = 0; i < meshColumns; i++) {
      const angle = start + i * sector;
      line([knot(angle, base), knot(angle + sector / 2, mid), knot(angle + sector, base)],
        cream, near ? .79 : .40, false, 1.05);
    }
  }
  const arc = row => Array.from({ length: 19 }, (_, i) => knot(start + Math.PI * i / 18, row));
  line(arc(meshRows), cream, near ? .86 : .45, false, 1.1);
  line(arc(0), gold, near ? 1 : .82, false, 2.2);
}

function draw() {
  const start=rimX-court[station].distance;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  line([[.8,0,-.45],[15.2,0,-.45],[15.2,0,1.1],[.8,0,1.1],[.8,0,-.45]],cream,.5);
  line([[13.9,0,-.45],[13.9,0,1.1]],cream,.21,false);
  line([[15.1,0,.12],[15.1,board.top-.04,.12],[board.x,board.top-.04,.12]],cream,.37);
  const { x, bottom, top, depth } = board;
  line([[x,bottom,-depth],[x,top,-depth],[x,top,depth],[x,bottom,depth],[x,bottom,-depth]],cream,.78,false);
  line([[x,rimY,-.19],[x,rimY+.35,-.19],[x,rimY+.35,.19],[x,rimY,.19],[x,rimY,-.19]],cream,.5,false,1.1);
  line([[rimX+rimRadius,rimY,0],[x,rimY,0]],gold,.72,false,2.2);
  court.forEach(({distance},i)=>{
    const x=rimX-distance;
    line([[x-.12,0,-.11],[x+.12,0,-.11],[x+.12,0,.11],[x-.12,0,.11],[x-.12,0,-.11]],
      i===station?gold:cream,i===station ? .98 : .38,false);
  });
  if (flight?.trace.length > 1) line(flight.trace, gold, .35);
  if (!flight) line([[start,0,0],[start,handY-.25,0]],cream,.23);
  drawHoop(false);
  drawBall(flight?.x ?? start, flight?.y ?? handY);
  drawHoop(true);
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

function finishShot(ball) {
  const points = court[station].points;
  shots++;
  if (ball.basket) {
    made++;
    score += points;
    const result = ball.bank ? 'Попадание от щита!' : 'Попадание!';
    readout.textContent = result + ' +' + points + ' ' + (points === 5 ? 'очков.' : 'очка.');
  } else if (ball.rimHit || ball.boardHit) {
    readout.textContent = ball.rimHit ? 'Мяч отскочил от дужки.' : 'Мяч отскочил от щита.';
  } else {
    readout.textContent = ball.short ? 'Недолёт. Попробуйте добавить силы.' : 'Перелёт. Попробуйте отпустить раньше.';
  }
  readout.textContent += ' Сила ' + ball.strength + '%.';
  if (score >= 10 && reward.hidden) readout.textContent += ' Открыта памятка по съёмке прыжка.';
  flight = null;
  timeBank = 0;
  shoot.removeAttribute('aria-disabled');
  stations.forEach(button => button.disabled = false);
  paintPower(0);
  scoreboard();
}

function update(now) {
  frame=0;
  if(!dialog.open) return;
  const dt = previous ? Math.min(.04,(now-previous)/1000) : 0;
  previous=now;
  if(charge) paintPower(power(now));
  if (flight) {
    timeBank += reduce.matches ? 6 : dt;
    while (flight && timeBank >= stepTime) {
      timeBank -= stepTime;
      if (stepShot(flight)) finishShot(flight);
    }
    if (flight) {
      flight.trace.push([flight.x, flight.y, 0]);
      if (flight.trace.length > 25) flight.trace.shift();
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
  flight = { ...createShot(court[station].distance, p), trace: [], strength: Math.round(p * 100) };
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
  previous=timeBank=0;
  cancelAnimationFrame(frame);
  frame=0;
  stations.forEach(button=>button.disabled=false);
  shoot.removeAttribute('aria-disabled');
  paintPower(0);
  readout.textContent='Зажмите кнопку и отпустите для броска.';
  launcher?.focus();
  launcher=null;
});
