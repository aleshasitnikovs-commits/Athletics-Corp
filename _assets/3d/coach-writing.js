import * as THREE from 'three';

const PAGE_WIDTH = 0.105;
const PAGE_HEIGHT = 0.148;
const PAGE_THICKNESS = 0.004;
const FOLD = THREE.MathUtils.degToRad(10);
const UP = new THREE.Vector3(0, 1, 0);
export const PENCIL_TIP = 0.07;
export const NOTEBOOK_PAGES = [-1, 1].map(side => ({
  width: PAGE_WIDTH, height: PAGE_HEIGHT, thickness: PAGE_THICKNESS,
  center: new THREE.Vector3(side * PAGE_WIDTH / 2 * Math.cos(FOLD), 0.05, 0.034 + PAGE_WIDTH / 2 * Math.sin(FOLD)),
  rotation: new THREE.Quaternion().setFromAxisAngle(UP, -side * FOLD),
}));

const bone = (model, name) => model.getObjectByName('mixamorig' + name);

// Та же рамка используется для крепления реквизита и расчёта контакта со страницей.
export function palmFrame(model, side) {
  const hand = bone(model, side + 'Hand');
  const middle = bone(model, side + 'HandMiddle1');
  const index = bone(model, side + 'HandIndex1');
  const pinky = bone(model, side + 'HandPinky1');
  const thumb = bone(model, side + 'HandThumb3');
  const matrix = new THREE.Matrix4();
  const origin = new THREE.Vector3(), center = new THREE.Vector3(), thumbDirection = new THREE.Vector3();
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  return function update() {
    hand.getWorldPosition(origin);
    middle.getWorldPosition(y);
    center.copy(y).lerp(origin, 0.5);
    y.sub(origin).normalize();
    index.getWorldPosition(x);
    pinky.getWorldPosition(z);
    x.sub(z).addScaledVector(y, -x.dot(y)).normalize();
    z.crossVectors(x, y).normalize();
    if (z.dot(thumb.getWorldPosition(thumbDirection).sub(origin)) < 0) {
      x.negate(); z.negate();
    }
    return matrix.makeBasis(x, y, z).setPosition(center);
  };
}

const ease = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);
const mix = THREE.MathUtils.lerp;
const FIRST = 3.1, TURN = 3.75, SECOND = 3.97, END = 4.7;
const START_X = -0.027, END_X = 0.028;
const LINE_1 = -0.017, LINE_2 = 0.011;
const PARK_X = 0.033, PARK_Y = -0.027, PARK_Z = 0.034;

function stroke(t, from, to, line, target) {
  const p = ease(from, to, t);
  const envelope = Math.sin(Math.PI * p);
  return target.set(mix(START_X, END_X, p) + 0.0015 * envelope * Math.sin(p * 29),
    line + 0.0034 * envelope * Math.sin(p * 36), 0);
}

function targetOnPage(t, target) {
  if (t < FIRST) {
    const p = ease(2.55, FIRST, t);
    return target.set(mix(PARK_X, START_X, p), mix(PARK_Y, LINE_1, p), PARK_Z * (1 - p));
  }
  if (t < TURN) return stroke(t, FIRST, TURN, LINE_1, target);
  if (t < SECOND) {
    const p = ease(TURN, SECOND, t);
    return target.set(mix(END_X, START_X, p), mix(LINE_1, LINE_2, p), 0.009 * Math.sin(Math.PI * p));
  }
  if (t < END) return stroke(t, SECOND, END, LINE_2, target);
  const p = ease(END, 5.45, t);
  return target.set(mix(END_X, PARK_X, p), mix(LINE_2, PARK_Y, p), PARK_Z * p);
}

export function constrainWriting(model, notebookPalm, pencilPalm, pencilMount) {
  const upper = bone(model, 'RightArm');
  const fore = bone(model, 'RightForeArm');
  const wrist = bone(model, 'RightHand');
  const joints = [upper, fore, wrist];
  const original = joints.map(() => new THREE.Quaternion());
  const handRotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion();
  const turn = new THREE.Quaternion(), world = new THREE.Quaternion();
  const shoulder = new THREE.Vector3(), elbow = new THREE.Vector3(), hand = new THREE.Vector3();
  const tip = new THREE.Vector3(), target = new THREE.Vector3();
  const along = new THREE.Vector3(), bend = new THREE.Vector3(), nextElbow = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const page = NOTEBOOK_PAGES[1];
  let hasPose = false;

  function setWorldRotation(joint, rotation) {
    joint.parent.getWorldQuaternion(parentRotation).invert();
    joint.quaternion.multiplyQuaternions(parentRotation, rotation);
    joint.updateWorldMatrix(false, true);
  }

  function aim(joint, current, desired) {
    turn.setFromUnitVectors(current.normalize(), desired.normalize());
    setWorldRotation(joint, joint.getWorldQuaternion(world).premultiply(turn));
  }

  return {
    restore() {
      if (hasPose) joints.forEach((joint, i) => joint.quaternion.copy(original[i]));
    },
    apply(time) {
      joints.forEach((joint, i) => original[i].copy(joint.quaternion));
      hasPose = true;
      upper.getWorldPosition(shoulder);
      fore.getWorldPosition(elbow);
      wrist.getWorldPosition(hand);
      wrist.getWorldQuaternion(handRotation);
      tip.set(0, PENCIL_TIP, 0).applyMatrix4(pencilMount).applyMatrix4(pencilPalm());
      targetOnPage(time, target);
      target.z += page.thickness / 2 + 0.00045;
      target.applyQuaternion(page.rotation).add(page.center).applyMatrix4(notebookPalm());
      // Перемещаем запястье на ту же величину, что и кончик, сохраняя хват.
      target.add(hand).sub(tip);

      const upperLength = shoulder.distanceTo(elbow), foreLength = elbow.distanceTo(hand);
      along.subVectors(target, shoulder).normalize();
      const reach = THREE.MathUtils.clamp(shoulder.distanceTo(target), Math.abs(upperLength - foreLength) + 0.001, upperLength + foreLength - 0.001);
      bend.subVectors(elbow, shoulder).addScaledVector(along, -bend.dot(along)).normalize();
      const a = (upperLength ** 2 - foreLength ** 2 + reach ** 2) / (2 * reach);
      nextElbow.copy(shoulder).addScaledVector(along, a).addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - a ** 2)));
      target.copy(shoulder).addScaledVector(along, reach);
      aim(upper, from.subVectors(elbow, shoulder), to.subVectors(nextElbow, shoulder));
      fore.getWorldPosition(elbow);
      wrist.getWorldPosition(hand);
      aim(fore, from.subVectors(hand, elbow), to.subVectors(target, elbow));
      setWorldRotation(wrist, handRotation);
    },
  };
}
