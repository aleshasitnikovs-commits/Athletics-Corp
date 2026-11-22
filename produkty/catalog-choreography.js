import * as THREE from 'three';

const D = Math.PI / 180;
const white = '#f2f0eb';
const brass = '#dda74f';
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function pointBuffer(group, count, { color = white, opacity = .48, size = 1.65 } = {}) {
  const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  const material = new THREE.PointsMaterial({ color, opacity, size, sizeAttenuation: false, transparent: true, depthWrite: false });
  const shape = new THREE.Points(geometry, material);
  shape.frustumCulled = false;
  shape.renderOrder = 8;
  group.add(shape);
  return { shape, position, material };
}

function paths(group, list, style) {
  const positions = [];
  for (const path of list) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 94));
      for (let j = 0; j < count; j++) {
        for (let k = 0; k < 3; k++) positions.push(lerp(a[k], b[k], j / count));
      }
    }
  }
  const dots = pointBuffer(group, positions.length / 3, style);
  dots.position.array.set(positions);
  return dots;
}

function rect(x, y, w, h, z) {
  return [[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z]];
}

function wave(group, count, sample, style) {
  const { position } = pointBuffer(group, count, style);
  position.setUsage(THREE.DynamicDrawUsage);
  return time => {
    for (let i = 0; i < count; i++) sample(position, i, time);
    position.needsUpdate = true;
  };
}

const actor = (x, z, angle, extra = {}) => ({ at: [[x, z, angle * D]], ...extra });
const jointNames = ['LeftShoulder','RightShoulder','LeftArm','RightArm','LeftForeArm','RightForeArm',
  'LeftHand','RightHand','Hips','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot'];
function markStudioPose(group, figure) {
  const point = new THREE.Vector3();
  const dots = pointBuffer(group, jointNames.length, { color: brass, opacity: .9, size: 3 });
  return () => {
    jointNames.forEach((name, i) => {
      figure.bone(name, point);
      dots.position.setXYZ(i, point.x, point.y, point.z + .08);
    });
    dots.position.needsUpdate = true;
  };
}

const reveal = (a,b,t) => THREE.MathUtils.smoothstep(t,a,b);

function segment(buffer, a, b, ratio = 1) {
  const count = buffer.position.count;
  for (let i=0; i<count; i++) {
    const t=i/(count-1);
    buffer.position.setXYZ(i,lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t));
  }
  buffer.position.needsUpdate=true;
  buffer.shape.geometry.setDrawRange(0,Math.round(count*ratio));
}

function caption(group,x,y,width,text,size=37) {
  const bitmap=document.createElement('canvas');
  bitmap.width=512; bitmap.height=76;
  const context=bitmap.getContext('2d');
  const texture=new THREE.CanvasTexture(bitmap);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
  const object=new THREE.Mesh(new THREE.PlaneGeometry(width,width*76/512),material);
  object.position.set(x+width/2,y,.13);
  group.add(object);
  let previous;
  function update(value) {
    if (value===previous) return;
    previous=value;
    context.clearRect(0,0,512,76);
    context.font='600 '+size+'px system-ui';
    context.textBaseline='middle';
    context.fillStyle=white;
    context.fillText(value,5,38,503);
    texture.needsUpdate=true;
  }
  update(text);
  return {material,update};
}

function ellipse(x,y,z,rx,rz) {
  return Array.from({length:61},(_,i)=>{
    const a=i*Math.PI/30;
    return [x+rx*Math.cos(a),y,z+rz*Math.sin(a)];
  });
}

function surface(x,y,z,w,d) {
  return [[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2],[x-w/2,y,z-d/2]];
}

function furniture(group,x,z,w,d,h,{back=false,opacity=.64}={}) {
  const top=surface(x,h,z,w,d);
  const feet=top.slice(0,4).map(([px,py,pz])=>[[px,.012,pz],[px,py,pz]]);
  if (back) feet.push([[x-w/2,h,z-d/2],[x-w/2,h+.24,z-d/2],[x+w/2,h+.24,z-d/2],[x+w/2,h,z-d/2]]);
  paths(group,[top,...feet],{opacity,size:1.7});
}

function seminar(group, [presenter, model]) {
  paths(group, [rect(-.06,.10,.78,.83,-.35)], {opacity:.47});
  const labels = caption(group,.02,.86,.54,'Линия плеч');
  const gold = pointBuffer(group, 28, {color:brass,opacity:.92,size:1.8});
  const base = pointBuffer(group, 32, {opacity:.63,size:1.48});
  const markers = pointBuffer(group, 2, {color:brass,opacity:1,size:4.4});
  const left = new THREE.Vector3(), right = new THREE.Vector3();
  return {
    before(t) {
      const phase = t % 6.8;
      model.inst.setProgress({alpha:.18 + .82 * reveal(.08,1.22,phase),occ:.85});
      presenter.aim(.12 + .15 * reveal(.4,2,phase),-.06);
    },
    after(t) {
      const phase = t % 6.8;
      model.bone('RightArm',left);
      model.bone('LeftArm',right);
      const y = Math.min(left.y,right.y);
      const z = Math.max(left.z,right.z) + .105;
      segment(gold,[left.x,left.y,z],[right.x,right.y,z],reveal(2.0,3.12,phase));
      segment(base,[left.x-.11,y,z-.024],[right.x+.11,y,z-.024],reveal(3.2,4.28,phase));
      markers.position.setXYZ(0,left.x,left.y,z);
      markers.position.setXYZ(1,right.x,right.y,z);
      markers.position.needsUpdate = true;
      markers.material.opacity = reveal(1.52,2.05,phase);
      labels.material.opacity = .85 * reveal(2.9,4.05,phase);
    },
  };
}

function concierge(group) {
  // Contour of the entry and interior. The route leads to the consultation, in the client's space.
  paths(group, [rect(-.81,0,.36,.91,-.59),
    [[-.82,0,-.59],[-.82,1.06,-.59],[.67,1.06,-.59],[.74,1.01,-.47],[.74,0,-.47]],
    [[-.82,0,-.59],[.74,0,-.59],[.74,0,-.09]]], {opacity:.53,size:1.65});
  paths(group, [[[.52,.03,-.30],[.52,.33,-.30],[.68,.33,-.30],[.68,.03,-.30]],
    [[.52,.19,-.29],[.68,.19,-.29]]], {opacity:.3});
  paths(group, [rect(.18,.59,.45,.34,-.55),
    [[.405,.59,-.54],[.405,.93,-.54]], [[.18,.758,-.54],[.63,.758,-.54]],
    [[.15,.565,-.53],[.66,.565,-.53]], rect(-.30,.77,.14,.17,-.54)],
    {opacity:.61,size:1.7});
  paths(group, [[[.27,.05,-.46],[.27,.26,-.46],[.60,.26,-.46],[.60,.05,-.46]],
    surface(.43,.13,-.32,.36,.25)],{opacity:.41});
  const route = paths(group, [[[-.74,.01,-.47],[-.65,.01,-.24],[-.43,.01,.06],[-.11,.01,.16],[.15,.01,.09]]], {opacity:.30});
  const pulse = wave(group, 18, (p, i, t) => {
    const k = (t * .30 + i * .013) % 1;
    p.setXYZ(i, -.74 + .9 * k, .017, -.47 + .56 * Math.sin(k * Math.PI / 2));
  }, {opacity:.82,size:1.9});
  route.shape.renderOrder = 2;
  return pulse;
}

function studio(group, [client]) {
  paths(group, [rect(-.69,.04,.47,.95,-.14), rect(.39,.23,.51,.63,-.13),
    [[.47,.75,-.12],[.80,.75,-.12]], [[.47,.35,-.12],[.82,.35,-.12]]], {opacity:.47});
  paths(group, [[[.48,.43,-.10],[.55,.48,-.10],[.61,.47,-.10],[.68,.58,-.10],[.82,.56,-.10]],
    [[.47,.63,-.10],[.67,.63,-.10]]], {color:brass,opacity:.78,size:1.83});
  const bind = markStudioPose(group, client);
  const transfer = wave(group, 14, (p, i, t) => {
    const u = (t * .35 + i * .023) % 1;
    p.setXYZ(i, lerp(-.19,.35,u), .43 + Math.sin(u * Math.PI) * .10, -.04);
  }, {color:brass,opacity:.78});
  return t => { bind(); transfer(t); };
}

function sport(group) {
  const lanes = [];
  for (let i = 0; i < 5; i++) lanes.push([[-.88,.005,.15-i*.15],[.89,.005,.15-i*.15]]);
  paths(group, lanes, {opacity:.37,size:1.55});
  for (let i = 0; i < 9; i++) {
    const x = -.84 + i * .193;
    paths(group, [[[x,.007,.19],[x,.007,.27]]], {opacity:.35});
  }
  return wave(group, 150, (p, i, t) => {
    const v = (i % 50) / 49, x = .89 - ((v + t * .68) % 1) * 1.78;
    const lane = Math.floor(i / 50);
    p.setXYZ(i, x, .012, -.18 + lane * .16);
  }, {opacity:.63,size:1.7});
}

function realtime(group, [client]) {
  paths(group, [rect(.24,.22,.67,.57,-.16), [[.30,.34,-.15],[.86,.34,-.15]],
    [[.30,.47,-.15],[.86,.47,-.15]], [[.30,.60,-.15],[.86,.60,-.15]]], {opacity:.31});
  const title=caption(group,.25,.83,.69,'Сгибание локтя');
  const value=caption(group,.66,.71,.29,'',59);
  title.material.opacity=.9;
  const shoulder=new THREE.Vector3(), elbow=new THREE.Vector3(), wrist=new THREE.Vector3();
  const arm1=new THREE.Vector3(), arm2=new THREE.Vector3();
  const nodes=pointBuffer(group,3,{color:brass,opacity:1,size:5.5});
  const core=pointBuffer(group,3,{opacity:1,size:2.0});
  const upper=pointBuffer(group,28,{color:brass,opacity:.84,size:1.85});
  const lower=pointBuffer(group,28,{color:brass,opacity:.84,size:1.85});
  const wire=pointBuffer(group,30,{color:brass,opacity:.65,size:1.55});
  const trace=pointBuffer(group,66,{color:brass,opacity:1,size:2.0});
  const marker=pointBuffer(group,1,{color:brass,opacity:1,size:4.5});
  const history=[];
  let previous=-1;
  return t=>{
    client.bone('RightArm',shoulder);
    client.bone('RightForeArm',elbow);
    client.bone('RightHand',wrist);
    const flex=180-THREE.MathUtils.radToDeg(arm1.copy(shoulder).sub(elbow).angleTo(arm2.copy(wrist).sub(elbow)));
    const pts=[shoulder,elbow,wrist].map((p,i)=>{
      nodes.position.setXYZ(i,p.x,p.y,p.z+.12);
      core.position.setXYZ(i,p.x,p.y,p.z+.124);
      return [p.x,p.y,p.z+.12];
    });
    nodes.position.needsUpdate=core.position.needsUpdate=true;
    segment(upper,pts[0],pts[1]);
    segment(lower,pts[1],pts[2]);
    segment(wire,pts[1],[.25,.52,-.11]);
    const y=.31+.29*clamp(flex/125,0,1);
    if(!history.length) history.push(...Array(66).fill(y));
    const tick=Math.floor(t*17);
    if(tick!==previous){history.shift();history.push(y);previous=tick;}
    history.forEach((h,i)=>trace.position.setXYZ(i,lerp(.30,.86,i/65),h,-.105));
    trace.position.needsUpdate=true;
    marker.position.setXYZ(0,.86,y,-.10);
    marker.position.needsUpdate=true;
    value.update(Math.round(flex)+'°');
  };
}

function management(group, people) {
  const pathsAbove=[[0,1,.23,0],[0,2,.32,.55],[0,3,.44,1.1],[1,2,.18,2.8],[2,3,.19,3.4]];
  const links=pathsAbove.map(([from,to,height,offset])=>({
    from,to,height,offset,
    route:pointBuffer(group,54,{opacity:.25,size:1.65}),
    pulse:pointBuffer(group,13,{opacity:.95,size:2.4}),
  }));
  const positions=people.map(()=>new THREE.Vector3());
  const mark=pointBuffer(group,4,{opacity:.81,size:3.7});
  const cycle=5.65;
  return {
    before(t) {
      const phase=t%cycle;
      people[0].aim(.14,-.06);
      people[1].aim(-.19+.45*reveal(2.40,3.05,phase)*(1-reveal(4.30,5.1,phase)),.04);
      people[2].aim(-.15+.31*reveal(2.8,3.3,phase)*(1-reveal(4.3,5.1,phase)),.03);
      people[3].aim(-.20,.04);
    },
    after(t) {
      people.forEach((person,i)=>{
        person.bone('Head',positions[i]);
        positions[i].y+=.15;
        positions[i].z+=.03;
        mark.position.setXYZ(i,positions[i].x,positions[i].y,positions[i].z);
      });
      mark.position.needsUpdate=true;
      for(const {from,to,height,offset,route,pulse} of links){
        const start=positions[from],end=positions[to];
        const phase=(t%cycle-offset)/1.08;
        const pass=(p,i,u)=>{
          p.setXYZ(i,lerp(start.x,end.x,u),lerp(start.y,end.y,u)+Math.sin(Math.PI*u)*height,lerp(start.z,end.z,u));
        };
        const visible=phase>=0 && phase<1.2;
        route.material.opacity=visible ? .46 : .14;
        for(let i=0;i<54;i++) pass(route.position,i,i/53);
        for(let i=0;i<13;i++) pass(pulse.position,i,clamp(phase-i*.016,0,1));
        pulse.shape.visible=visible;
        route.position.needsUpdate=pulse.position.needsUpdate=true;
      }
    },
  };
}

function assistant(group, [figure], el) {
  let targetX = 0, targetY = 0, x = 0, y = 0;
  el.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const box = el.getBoundingClientRect();
    targetX = ((event.clientX - box.left) / box.width - .5) * .96;
    targetY = ((event.clientY - box.top) / box.height - .5) * .53;
  }, { passive: true });
  el.addEventListener('pointerleave', () => { targetX = targetY = 0; });

  const flow = wave(group, 408, (p, i, t) => {
    const row = Math.floor(i / 102), u = i % 102 / 101, angle = u * Math.PI * 2;
    const r = .204 + row * .039;
    const px = r * Math.cos(angle);
    const z = r * Math.sin(angle) - .14;
    const py = .85 + row * .019 + .045 * Math.sin(angle * 2 - t * 1.55 + row * .48);
    p.setXYZ(i,px,py,z);
  }, {opacity:.30,size:1.40});
  return {
    before(t, dt) {
      const response = 1 - Math.exp(-9 * dt);
      x += (targetX - x) * response;
      y += (targetY - y) * response;
      figure.aim(x, y);
      figure.inst.setProgress({ tm: t, ripple: 1 });
    },
    after: flow,
  };
}

function coworking(group) {
  paths(group, [surface(0,.013,-.03,2.18,.75),
    [[-1.08,.015,-.42],[-1.08,1.03,-.42],[1.08,1.03,-.42],[1.08,.015,-.42]],
    [[-.37,.12,-.42],[-.37,1.03,-.42]], [[.39,.12,-.42],[.39,1.03,-.42]],
    surface(.02,.016,.08,.57,.52)],{opacity:.32});
  furniture(group,-.78,-.10,.25,.25,.265,{back:true,opacity:.54});
  furniture(group,-.66,.25,.46,.30,.475,{opacity:.64});
  return wave(group, 14, (p,i,t)=>{
    const u=(t*.24+i*.025)%1;
    p.setXYZ(i,lerp(-.30,.30,u),.025,.36);
  },{opacity:.59,size:1.5});
}

function dank(group) {
  const circle = (x,y,z,r,vertical) => Array.from({length:53}, (_, i) => {
    const angle = i / 52 * 2 * Math.PI;
    return [x + r*Math.cos(angle), y + (vertical ? r*Math.sin(angle) : 0), z + (vertical ? 0 : r*Math.sin(angle))];
  });
  const hoop = circle(.54,.63,-.07,.115,false);
  paths(group, [rect(.30,.61,.48,.32,-.24), rect(.46,.63,.16,.13,-.23), hoop,
    [[.54,.22,-.3],[.54,.62,-.3]], [[-.58,.15,.02],[.78,.15,.02]]], {opacity:.60});
  const strands = [];
  for (let i = 0; i < 12; i++) {
    strands.push([hoop[i*4], [.54 + (hoop[i*4][0]-.54)*.58,.49,-.07 + (hoop[i*4][2]+.07)*.58]]);
  }
  paths(group, strands, {opacity:.35});
  const trajectory = u => [lerp(-.58,.545,u), .21 + .85*Math.sin(u*2.62), .03-.085*u];
  paths(group, [Array.from({length:65}, (_, i) => trajectory(i/64))], {opacity:.38,color:brass});
  paths(group, [[[-.695,.15,.02],[-.695,1.055,.02]], [[-.73,1.055,.02],[-.66,1.055,.02]],
    [[-.18,1.055,.02],[.13,1.055,.02]]], {opacity:.44,color:brass});
  return wave(group, 54, (p, i, t) => {
    const u = (t * .43) % 1;
    const [x,y,z] = trajectory(u);
    const angle = i * 2 * Math.PI / 27;
    const radius = .045;
    p.setXYZ(i, x + radius*Math.cos(angle), y + radius*Math.sin(angle)*(i<27 ? 1 : .71), z + (i<27 ? 0 : radius*Math.sin(angle)*.71));
  }, {opacity:.88,size:1.65});
}


function trainer(group) {
  paths(group,[rect(-.83,.17,.70,.66,-.14),
    [[-.76,.58,-.12],[-.23,.58,-.12]], [[-.76,.38,-.12],[-.23,.38,-.12]],
    [[-.76,.29,-.12],[-.43,.29,-.12]]],{opacity:.41});
  caption(group,-.77,.75,.60,'План занятия');
  const variation=caption(group,-.77,.50,.64,'Приседание');
  const transfer=wave(group,21,(p,i,t)=>{
    const u=(t*.33+i*.017)%1;
    p.setXYZ(i,lerp(-.08,.29,u),.53+Math.sin(u*Math.PI)*.08,-.04);
  },{color:brass,opacity:.8,size:1.8});
  return t=>{
    variation.update(t%9.6<4.8?'Приседание':'Сгибание руки');
    transfer(t);
  };
}

function food(group) {
  furniture(group,-.70,-.20,.27,.27,.27,{back:true,opacity:.42});
  furniture(group,-.34,.17,.81,.52,.49,{opacity:.58});
  const plate=ellipse(-.23,.507,.23,.179,.135);
  const inner=ellipse(-.23,.514,.23,.128,.097);
  const apple=pointBuffer(group,156,{opacity:.94,size:1.8});
  for(let i=0;i<156;i++){
    const depth=1-2*i/155, a=i*2.39996, r=Math.sqrt(1-depth*depth)*.061;
    apple.position.setXYZ(i,-.23+Math.cos(a)*r,.587+depth*.061,.235+Math.sin(a)*r);
  }
  paths(group,[plate,inner,[[-.23,.643,.23],[-.22,.67,.23],[-.18,.67,.24]],rect(.27,.25,.54,.46,-.22),
    [[.29,.43,-.21],[.79,.43,-.21]]],{opacity:.54});
  caption(group,.31,.66,.46,'Ритм привычек');
  const set=[.375,.54,.705];
  const cues=set.map(x=>paths(group,[[[x-.034,.365,-.20],[x-.008,.33,-.20],[x+.045,.399,-.20]]],
    {color:brass,opacity:0,size:2.1}));
  return t=>cues.forEach((cue,i)=>{cue.material.opacity=.85*reveal(i+.35,i+.75,t%4.8);});
}

function awareness(group) {
  const ribbon=wave(group,520,(p,i,t)=>{
    const row=Math.floor(i/104),u=i%104/103;
    const envelope=Math.sin(Math.PI*u);
    p.setXYZ(i,lerp(-.91,.26,u),.48+.16*envelope*Math.sin(u*7.4-t*1.16+row*.45)+row*.036,
      -.18 + .12*Math.sin(row*.74+u*4));
  },{opacity:.51,size:1.65});
  const left=[[.09,.21,.25],[.42,.19,.32],[.44,.66,-.08],[.11,.68,-.11],[.09,.21,.25]];
  const right=[[.42,.19,.32],[.83,.23,.25],[.82,.69,-.11],[.44,.66,-.08],[.42,.19,.32]];
  paths(group,[left,right],{opacity:.73});
  const entries=[0,1,2,3].map(i=>{
    const y=.56-i*.073,z=.014+i*.052;
    return paths(group,[[[.49,y,z],[.75-(i===3?.10:0),y+.017,z]]],{opacity:.65});
  });
  return t=>{
    ribbon(t);
    entries.forEach((entry,i)=>{entry.shape.geometry.setDrawRange(0,
      Math.floor(entry.position.count*reveal(.68+i*.6,1.35+i*.6,t%5.2)));});
  };
}

export const featureScenes = {
  trainer: {figures:[actor(.43,-.02,32,{pose:'trainer',still:true,gaze:[0,0],scale:.89})],
    decorate:trainer,width:1.90},
  food: {figures:[actor(-.70,-.19,48,{pose:'seated',still:true,gaze:[.02,.21]})],
    decorate:food,width:1.91,centerY:.46},
  awareness: {figures:[],decorate:awareness,width:1.87,height:.72,centerY:.47},

  coworking: {
    figures: [actor(-.80,-.10,32,{clip:'coach_notes',props:['notebook','pen'],pose:'seated',n:4.9}),
      actor(0,.07,29,{pose:'squat',still:true,gaze:[0,-.08],n:4.8}),
      actor(.74,-.13,-65,{pose:'observer',still:true,gaze:[.06,.09],n:4.6})],
    decorate: coworking,
    tilt: .13,
    width: 2.32,
  },
  dank: {
    figures: [],
    decorate: dank,
    tilt: .12,
    width: 1.68,
    centerY: .61,
  },
  seminar: {
    figures: [actor(-.47,.10,58,{still:true,gaze:[0,0]}),
      actor(.33,-.10,0,{still:true,gaze:[0,0],pose:'reference',scale:.69,elevation:.15,n:5.6})],
    decorate: seminar,
    width: 1.57,
  },
  concierge: {
    figures: [actor(-.29,.08,63,{clip:'coach_notes', props:['notebook','pen']}), actor(.29,.03,-52,{still:true,gaze:[-.49,.015]})],
    decorate: concierge,
    width: 1.79,
  },
  studio: {
    figures: [actor(-.46,.00,7,{t0:.5})],
    decorate: studio,
    width: 1.74,
  },
  sport: {
    figures: [actor(.035,.05,80,{clip:'catalog_run', speed:1.06})],
    decorate: sport,
    tilt: .11,
    width: 1.87,
    centerY: .47,
  },
  realtime: {
    figures: [actor(-.43,.06,48,{pose:'curl',still:true,gaze:[.02,.03]})],
    decorate: realtime,
    width: 1.90,
  },
  management: {
    figures: [actor(-.73,.08,53,{n:4.7,still:true,gaze:[.14,0]}),
      actor(-.24,-.08,-13,{n:4.2,still:true,gaze:[-.16,0],scale:.86}),
      actor(.26,-.15,-35,{n:4.2,still:true,gaze:[-.12,0],scale:.86}),
      actor(.73,.02,-54,{n:4.2,still:true,gaze:[-.18,0],scale:.86})],
    decorate: management,
    tilt: .055,
    width: 1.86,
    height: 1.6,
    centerY: .72,
  },
  ai: {
    figures: [actor(0,0,0,{n:10, portrait:true})],
    decorate: assistant,
    width: .67,
    height: .30,
    centerY: .874,
  },
};
