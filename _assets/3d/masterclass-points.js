import * as THREE from 'three';
import { init as initHuman, loadHumanAssets } from './human-points.js';

const SAMPLE_INTERVAL = 0.2;
const ACTORS = 6;
const PROP_STYLES = {
  1: { tone: 0.55, size: 0.95 },
  3: { tone: 0.76 },
  4: { brass: true },
  5: {},
  6: { tone: 0.58, size: 0.94 },
};

// ACW2: точки реквизита (позиции Int16 с шагом 0,1 мм и нормали Int8),
// затем матрицы скиннинга шести фигур в порядке костей products-specialists.glb.
async function loadWorkshop() {
  const response = await fetch(new URL('./products-masterclass.bin', import.meta.url));
  if (!response.ok || !response.body) throw new Error('Мастер-класс: HTTP ' + response.status);
  const raw = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const header = new DataView(raw);
  if (raw.byteLength < 20 || header.getUint32(0) !== 0x41435732) throw new Error('Мастер-класс: формат сцены');
  const count = header.getUint32(4, true);
  const moving = header.getUint32(8, true);
  const frames = header.getUint32(12, true);
  const bones = header.getUint32(16, true);
  const motionOffset = 20 + count * 10;
  const motionCount = moving * (frames - 1);
  const poseOffset = Math.ceil((motionOffset + motionCount * 9) / 4) * 4;
  const poseCount = frames * ACTORS * bones * 16;
  if (!moving || moving > count || frames < 2 || !bones || poseOffset + poseCount * 4 !== raw.byteLength) {
    throw new Error('Мастер-класс: неполные данные сцены');
  }
  return {
    frames, bones, moving,
    positions: new Int16Array(raw, 20, count * 3),
    normals: new Int8Array(raw, 20 + count * 6, count * 3),
    styles: new Uint8Array(raw, 20 + count * 9, count),
    motionPositions: new Int16Array(raw, motionOffset, motionCount * 3),
    motionNormals: new Int8Array(raw, motionOffset + motionCount * 6, motionCount * 3),
    poses: new Float32Array(raw, poseOffset, poseCount),
  };
}

function addProps(group, data, propMat) {
  const indices = new Map();
  data.styles.forEach((style, i) => {
    if (!indices.has(style)) indices.set(style, []);
    indices.get(style).push(i);
  });
  return Array.from(indices, ([style, ids]) => {
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(ids.length * 3), 3);
    const normal = new THREE.BufferAttribute(new Float32Array(ids.length * 3), 3);
    let moving = 0;
    ids.forEach((id, i) => {
      if (id < data.moving) moving++;
      for (let axis = 0; axis < 3; axis++) {
        position.array[i * 3 + axis] = data.positions[id * 3 + axis] * 0.0001;
        normal.array[i * 3 + axis] = data.normals[id * 3 + axis] / 127;
      }
    });
    if (moving) {
      position.setUsage(THREE.DynamicDrawUsage);
      normal.setUsage(THREE.DynamicDrawUsage);
    }
    geometry.setAttribute('position', position);
    geometry.setAttribute('normal', normal);
    const material = propMat(PROP_STYLES[style]);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    group.add(points);
    return { material, position, normal, moving, ids };
  });
}

function updateProps(props, data, frame, mix) {
  const aPosition = frame === 0 ? data.positions : data.motionPositions;
  const aNormal = frame === 0 ? data.normals : data.motionNormals;
  const aOffset = Math.max(0, frame - 1) * data.moving * 3;
  const bOffset = frame * data.moving * 3;
  for (const { position, normal, moving, ids } of props) {
    if (!moving) continue;
    for (let i = 0; i < moving; i++) {
      const id = ids[i] * 3;
      for (let axis = 0; axis < 3; axis++) {
        const a = aOffset + id + axis, b = bOffset + id + axis, j = i * 3 + axis;
        position.array[j] = THREE.MathUtils.lerp(aPosition[a], data.motionPositions[b], mix) * 0.0001;
        normal.array[j] = THREE.MathUtils.lerp(aNormal[a], data.motionNormals[b], mix) / 127;
      }
    }
    for (const attribute of [position, normal]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, moving * 3);
      attribute.needsUpdate = true;
    }
  }
}

export async function createMasterclassPoints({ renderer, mobile, propMat }) {
  const group = new THREE.Group();
  const asset = name => new URL(name, import.meta.url).href;
  const assets = loadHumanAssets(asset('products-specialists.glb'), asset('human-samples.bin'));
  const [data] = await Promise.all([loadWorkshop(), assets]);
  const figures = await Promise.all(Array.from({ length: ACTORS }, (_, i) => initHuman({
    renderer, scene: group, mobile, assets, bakedPose: true,
    preset: 'зерно-8k', n: mobile ? (i === 0 ? 3.6 : 3.3) : (i === 0 ? 5.2 : 4.7),
    refDist: 5,
  })));
  if (figures.some(figure => figure.mesh.skeleton.bones.length !== data.bones)) {
    throw new Error('Мастер-класс: позы не соответствуют модели');
  }
  const props = addProps(group, data, propMat);
  const stride = data.bones * 16;
  const pose = new Float32Array(stride);
  const duration = (data.frames - 1) * SAMPLE_INTERVAL;
  let elapsed = 0, previous = -1;

  return {
    group,
    setPixelRatio(dpr) {
      for (const figure of figures) figure.setQuality({ n: figure.n });
      for (const { material } of props) material.uniforms.uDpr.value = dpr;
    },
    frame(dt, bg) {
      for (const figure of figures) figure.occ.material.uniforms.uColor.value.copy(bg);
      elapsed = (elapsed + dt) % duration;
      // Текстуры с деформацией обновляются на 30 Гц; камера и прокрутка идут в основном кадре.
      const tick = Math.floor(elapsed * 30);
      if (tick === previous) return;
      previous = tick;
      const sample = tick / 30 / SAMPLE_INTERVAL;
      const frame = Math.min(data.frames - 2, Math.floor(sample));
      const mix = sample - frame;
      for (const [i, figure] of figures.entries()) {
        const a = (frame * ACTORS + i) * stride;
        const b = a + ACTORS * stride;
        for (let j = 0; j < stride; j++) {
          pose[j] = THREE.MathUtils.lerp(data.poses[a + j], data.poses[b + j], mix);
        }
        figure.update(pose);
      }
      updateProps(props, data, frame, mix);
    },
  };
}
