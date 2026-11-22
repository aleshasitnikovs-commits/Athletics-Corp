import * as THREE from 'three';

const smooth = (a,b,x) => THREE.MathUtils.smoothstep(x,a,b);
const wave = (t,s) => .5 - .5 * Math.cos(t * Math.PI * 2 / s);
const vec = (x, y, z) => new THREE.Vector3(x,y,z);

// Neutral local rotations live on the rig. A scene may turn the head relative to
// this baseline without inheriting the yaw or roll baked into its motion clip.
export function neutralGaze(bones) {
  const neck = bones.get('Neck'), head = bones.get('Head');
  const baseNeck = neck.getWorldQuaternion(new THREE.Quaternion());
  const baseHead = head.getWorldQuaternion(new THREE.Quaternion());
  const euler = new THREE.Euler(0,0,0,'YXZ');
  const world = new THREE.Quaternion(), parent = new THREE.Quaternion();
  const set = (node,base,yaw,pitch) => {
    world.setFromEuler(euler.set(pitch,yaw,0)).multiply(base);
    node.parent.getWorldQuaternion(parent);
    node.quaternion.copy(parent.invert().multiply(world));
  };
  return (yaw,pitch) => {
    set(neck,baseNeck,yaw*.32,pitch*.34);
    set(head,baseHead,yaw,pitch);
  };
}

export function catalogPose(kind,bones) {
  if (!kind) return null;
  const hips = bones.get('Hips'), hipRest = hips.position.clone();
  const targets = ['Spine','Spine1','LeftArm','RightArm','LeftForeArm','RightForeArm',
    'LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
  const rest = new Map(targets.map(name => [name,bones.get(name).quaternion.clone()]));
  const baseline = (name, child) => bones.get(child).position.clone().normalize()
    .applyQuaternion(bones.get(name).getWorldQuaternion(new THREE.Quaternion()));
  const origin = new THREE.Vector3(), axis = new THREE.Vector3(), bend = new THREE.Vector3();
  const knee = new THREE.Vector3(), direction = new THREE.Vector3(), current = new THREE.Quaternion();
  const rotate = new THREE.Quaternion(), parent = new THREE.Quaternion();
  function aim(name, child, desired) {
    const node = bones.get(name);
    node.getWorldQuaternion(current);
    direction.copy(bones.get(child).position).normalize().applyQuaternion(current);
    rotate.setFromUnitVectors(direction, desired.normalize()).multiply(current);
    node.parent.getWorldQuaternion(parent);
    node.quaternion.copy(parent.invert().multiply(rotate));
  }

  const legs = ['Left','Right'].map((side,i) => {
    const ankle = bones.get(side+'Foot');
    return {
      i, side, ankle,
      foot: ankle.getWorldPosition(new THREE.Vector3()),
      turn: ankle.getWorldQuaternion(new THREE.Quaternion()),
      upper: bones.get(side+'Leg').position.length(),
      lower: ankle.position.length(),
    };
  });
  function solveLeg(leg,target) {
    const {side,upper,lower} = leg;
    bones.get(side+'UpLeg').getWorldPosition(origin);
    axis.copy(target).sub(origin);
    const distance = THREE.MathUtils.clamp(axis.length(), .08, upper+lower-.0005);
    axis.normalize();
    const advance = (upper*upper - lower*lower + distance*distance)/(2*distance);
    bend.set(leg.i ? -.11 : .11,0,1).addScaledVector(axis,-bend.dot(axis)).normalize();
    knee.copy(origin).addScaledVector(axis,advance).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-advance*advance)));
    aim(side+'UpLeg',side+'Leg',knee.clone().sub(origin));
    aim(side+'Leg',side+'Foot',target.clone().sub(knee));
    leg.ankle.parent.getWorldQuaternion(parent);
    leg.ankle.quaternion.copy(parent.invert().multiply(leg.turn));
  }

  const upperRest = ['Left','Right'].map(side=>baseline(side+'Arm',side+'ForeArm'));
  const lowerRest = ['Left','Right'].map(side=>baseline(side+'ForeArm',side+'Hand'));
  const torsoRest = baseline('Spine','Spine1');
  function arm(i,upper,lower,mix) {
    const side = i ? 'Right' : 'Left';
    aim(side+'Arm',side+'ForeArm',upperRest[i].clone().lerp(upper,mix));
    aim(side+'ForeArm',side+'Hand',lowerRest[i].clone().lerp(lower,mix));
  }

  return t => {
    if (kind === 'seated') {
      hips.position.copy(hipRest);
      hips.position.y -= .425;
      hips.position.z -= .04;
      for (const leg of legs) solveLeg(leg,leg.foot.clone().add(vec(0,0,.30)));
      return;
    }
    hips.position.copy(hipRest);
    for (const [name, q] of rest) bones.get(name).quaternion.copy(q);
    if (kind === 'squat' || (kind === 'trainer' && t%9.6<4.8)) {
      const phase = t % 4.8;
      const depth = smooth(.42,1.95,phase) * (1 - smooth(2.45,4.20,phase));
      hips.position.y -= .285 * depth;
      hips.position.z -= .16 * depth;
      for (const leg of legs) solveLeg(leg,leg.foot.clone().add(vec(leg.i?-.035:.035,0,0)));
      aim('Spine','Spine1',torsoRest.clone().lerp(vec(0,.91,.40),depth));
      for (const i of [0,1]) arm(i,vec(i?-.13:.13,.05,1),vec(i?-.08:.08,.10,1),depth);
    } else if (kind === 'observer') {
      const raise = .36 + .58 * wave(t,5.3);
      arm(0,vec(.10,-.67,.72),vec(-.11,.35,.88),raise);
    } else if (kind === 'curl' || kind === 'trainer') {
      const bend = kind === 'trainer' ? wave(t-4.8,4.8) : wave(t+.5,4.55);
      const angle = .12 + bend * 1.98;
      arm(1,vec(-.08,-1,.13),vec(-.08,-Math.cos(angle),Math.sin(angle)),1);
    } else if (kind === 'reference') {
      aim('Spine','Spine1',torsoRest.clone().add(vec(.075,0,0)));
    }
  };
}
