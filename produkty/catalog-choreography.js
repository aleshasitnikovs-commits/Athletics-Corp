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
const links = [[0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[0,8],[1,8],[8,9],[8,10],[9,11],[10,12],[11,13],[12,14]];

function trackPose(group, figure, realtime) {
  const coords = jointNames.map(() => new THREE.Vector3());
  const dots = pointBuffer(group, coords.length, { color: brass, opacity: .9, size: 3 });
  const lines = pointBuffer(group, 10 * links.length, { color: brass, opacity: .64, size: 1.45 });
  return () => {
    coords.forEach((point, i) => {
      figure.bone(jointNames[i], point);
      point.z += realtime ? .125 : .08;
      dots.position.setXYZ(i, point.x, point.y, point.z);
    });
    if (realtime) {
      links.forEach(([a, b], index) => {
        for (let j = 0; j < 10; j++) {
          const t = j / 10, start = coords[a], end = coords[b];
          lines.position.setXYZ(index * 10 + j, lerp(start.x, end.x, t), lerp(start.y, end.y, t), lerp(start.z, end.z, t));
        }
      });
      lines.position.needsUpdate = true;
    } else {
      lines.shape.visible = false;
    }
    dots.position.needsUpdate = true;
  };
}

function seminar(group) {
  paths(group, [rect(-.05,.20,.72,.66,-.14),
    [[.31,.24,-.13],[.31,.81,-.13]], [[.02,.40,-.13],[.59,.40,-.13]],
    [[.02,.61,-.13],[.59,.61,-.13]]], {opacity:.33});
  const shape = [[.28,.72],[.27,.67],[.17,.62],[.16,.55],[.20,.42],[.23,.39],
    [.23,.28],[.30,.27],[.32,.43],[.36,.43],[.40,.27],[.47,.28],[.45,.40],
    [.48,.49],[.49,.63],[.38,.67],[.37,.72]];
  const head = Array.from({length:37}, (_, i) => {
    const a = i * Math.PI * 2 / 36;
    return [.325 + .049 * Math.sin(a), .753 + .061 * Math.cos(a), -.11];
  });
  const arc = Array.from({length:31}, (_, i) => {
    const a = .16 + i / 30 * .7;
    return [.20 + Math.cos(a) * .17, .581 + Math.sin(a) * .17, -.09];
  });
  paths(group, [shape.map(([x, y]) => [x,y,-.12]),head], {opacity:.59});
  paths(group, [[[.17,.59,-.11],[.48,.63,-.11]], [[.22,.43,-.11],[.45,.45,-.11]], arc],
    {color:brass,opacity:.84,size:1.85});
  const cursor = pointBuffer(group, 2, {color:brass,opacity:.88,size:3.2});
  return t => {
    const y = .44 + (1 - Math.cos(t * 1.2)) * .095;
    cursor.position.setXYZ(0, .17, y, -.09);
    cursor.position.setXYZ(1, .50, y + .03, -.09);
    cursor.position.needsUpdate = true;
  };
}

function concierge(group) {
  // Contour of the entry and interior. The route leads to the consultation, in the client's space.
  paths(group, [rect(-.81,0,.36,.91,-.59),
    [[-.82,0,-.59],[-.82,1.06,-.59],[.67,1.06,-.59],[.74,1.01,-.47],[.74,0,-.47]],
    [[-.82,0,-.59],[.74,0,-.59],[.74,0,-.09]]], {opacity:.53,size:1.65});
  paths(group, [[[.52,.03,-.30],[.52,.33,-.30],[.68,.33,-.30],[.68,.03,-.30]],
    [[.52,.19,-.29],[.68,.19,-.29]]], {opacity:.3});
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
  const bind = trackPose(group, client, false);
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
  paths(group, [rect(.27,.20,.63,.61,-.14), [[.32,.34,-.13],[.84,.34,-.13]],
    [[.32,.49,-.13],[.84,.49,-.13]], [[.32,.65,-.13],[.84,.65,-.13]],
    [[.21,.24,-.14],[.21,.76,-.14]]], {opacity:.31});
  const bind = trackPose(group, client, true);
  const shoulder = new THREE.Vector3(), wrist = new THREE.Vector3();
  const history = [];
  let previous;
  const trace = wave(group, 110, (p, i) => {
    const j = Math.floor(i / 2);
    const u = i / 109;
    const first = history[j] ?? history[0] ?? .45;
    const next = history[j+1] ?? first;
    p.setXYZ(i, .32 + u * .53, lerp(first, next, i % 2 * .5), -.095);
  }, {color:brass,opacity:.95,size:2.0});
  const marker = pointBuffer(group, 1, {color:brass,opacity:1,size:4.0});
  return t => {
    bind();
    client.bone('RightShoulder', shoulder);
    client.bone('RightHand', wrist);
    const reading = .46 + clamp((wrist.y - shoulder.y) * .8 + (wrist.z - shoulder.z) * .50, -.17, .23);
    if (previous === undefined) history.push(...Array(55).fill(reading));
    const tick = Math.floor(t * 16);
    if (tick !== previous) { history.shift(); history.push(reading); previous = tick; }
    trace(t);
    marker.position.setXYZ(0,.85,reading,-.09);
    marker.position.needsUpdate = true;
  };
}

function management(group) {
  const nodes = [[-.60,.18],[-.18,-.23],[.30,-.27],[.60,.17]];
  const routes = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const [x,z] = nodes[i], [x1,z1] = nodes[i+1];
    routes.push([[x,.013,z],[x1,.013,z1]]);
  }
  const ring = (x,z,r) => Array.from({length:49}, (_, i) => {
    const a = i / 48 * 2 * Math.PI;
    return [x + r * Math.cos(a), .014, z + r * Math.sin(a)];
  });
  paths(group, routes, {opacity:.37});
  paths(group, nodes.map(([x,z], i) => ring(x,z,i===0 ? .19 : .14)), {opacity:.47});
  const signal = pointBuffer(group, 42, {opacity:.85,size:2.1});
  return t => {
    for (let i = 0; i < 42; i++) {
      const [x,z] = nodes[0];
      const [endX,endZ] = nodes[1 + i % 3];
      const u = (t * .54 + Math.floor(i / 3) * .024) % 1;
      signal.position.setXYZ(i,lerp(x,endX,u),.025 + .25 * Math.sin(Math.PI * u),lerp(z,endZ,u));
    }
    signal.position.needsUpdate = true;
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
      figure.aim(x + Math.sin(t * .69) * .045, y);
      figure.inst.setProgress({ tm: t, ripple: 1 });
    },
    after: flow,
  };
}

function coworking(group) {
  const layout = rect(-1.06, .015, 2.12, .72, 0).map(([x,y]) => [x,.015,y-.50]);
  paths(group, [layout,
    [[-1.06,.015,-.485],[-1.06,1.03,-.485],[1.06,1.03,-.485],[1.06,.015,-.485]],
    [[-.36,1.03,-.485],[-.36,.015,-.485],[-.36,.015,.09]],
    [[.36,1.03,-.485],[.36,.015,-.485],[.36,.015,.09]],
    rect(-.21,.22,.42,.48,-.482)], {opacity:.42});
  paths(group, [[[-.96,.02,.14],[.96,.02,.14]]], {opacity:.24});
  return wave(group, 24, (p, i, t) => {
    const u = (t * .32 + i * .017) % 1;
    p.setXYZ(i, lerp(-.96,.96,u), .025, .14);
  }, {opacity:.82,size:1.7});
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

export const featureScenes = {
  coworking: {
    figures: [actor(-.72,-.14,53,{clip:'coach_notes',props:['notebook','pen'],n:4.7}),
      actor(0,-.02,-17,{clip:'chest_open',n:4.7,t0:1.1}), actor(.71,-.12,-24,{n:4.7,t0:1.3})],
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
    figures: [actor(-.46,.06,67,{t0:.7})],
    decorate: seminar,
    width: 1.57,
  },
  concierge: {
    figures: [actor(-.29,.08,63,{clip:'coach_notes', props:['notebook','pen']}), actor(.27,.00,-49,{t0:.8})],
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
    figures: [actor(-.41,.03,32,{clip:'chest_open',t0:1.30})],
    decorate: realtime,
    width: 1.90,
  },
  management: {
    figures: [actor(-.60,.18,81,{n:4.2,t0:.2}),
      actor(-.18,-.23,-21,{n:3.8,t0:.98}), actor(.30,-.27,-47,{n:3.8,t0:1.8}),
      actor(.60,.17,-108,{n:3.8,t0:2.4})],
    decorate: management,
    tilt: .17,
    width: 1.80,
  },
  ai: {
    figures: [actor(0,0,0,{n:10, portrait:true})],
    decorate: assistant,
    width: .67,
    height: .30,
    centerY: .874,
  },
};
