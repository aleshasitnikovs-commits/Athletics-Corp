// Человек из точек на поверхности (модель _assets/3d/human.glb, клипы walk/idle из CMU).
// Перенос из лаборатории _lab/human (итерация 2) в виде модуля для сцены главной.
//
// Интерфейс: init(config) -> Promise<экземпляр>; у экземпляра setProgress(state), setQuality(q),
// pause(), resume(), dispose(), а также update() - вызывать раз в кадр перед renderer.render.
//
// Устройство кадра:
//  1. Позу задаёт сцена через mixer/actions экземпляра (веса walk/idle, остановка в главе 3).
//  2. update(): кости -> boneTexture; отдельный проход скинит все вершины сетки в float-текстуры
//     позиций и нормалей (та же формула, что у SkinnedMesh three.js, 4 влияния).
//  3. Невидимое тело (occluder): сетка из той же текстуры, цветом фона, пишет глубину - прячет
//     дальнюю руку/ногу и поле за телом.
//  4. Точки: треугольник + барицентрики (офлайн, human-samples.bin); вершинный шейдер берёт три
//     скиненные вершины и интерполирует - точка лежит на той же поверхности, что и глубина.
//     Свет в linear, key спереди справа (в пространстве камеры), без бликов и ободка.
// Модель в сцену не добавляется: её узлы нужны только скелету. Положение и масштаб человека - одна
// матрица placement (как в CPU-скиннинге сцены: x*S, (y-footY)*S, z*S, поворот, сдвиг).
// CPU не трогает точки ни в одном кадре.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';

// Пресеты материала (из лаборатории). Форма, свет и поведение - общие.
export const PRESETS = {
  'зерно-8k': {
    n: { desktop: 8, phone: 8 }, extra: { desktop: 1.0, phone: 1.5 },
    size: { desktop: [1.1, 1.8], phone: [1.2, 2.0] }, clampMin: { desktop: 0.8, phone: 1.0 },
    fill: 0.34, key: 1.25, exposure: 2.6, jitterSize: 0, jitterLum: 0, warm: 0, band: [0.0, 0.25],
  },
  'материал-60k': {
    n: { desktop: 60, phone: 16 }, extra: { desktop: 1.0, phone: 1.5 },
    size: { desktop: [0.9, 1.4], phone: [1.1, 1.7] }, clampMin: { desktop: 0.7, phone: 1.0 },
    fill: 0.13, key: 1.05, exposure: 1.0, jitterSize: 1, jitterLum: 1, warm: 1, band: [0.12, 0.3],
  },
};

const TW = 128;
const BG = new THREE.Color(0x0A0A08);

export async function init(cfg) {
  const { renderer, scene } = cfg;
  const mobile = !!cfg.mobile;
  const [gltf, samplesBuf] = await Promise.all([
    new GLTFLoader().loadAsync(cfg.modelUrl),
    fetch(cfg.samplesUrl).then(r => { if (!r.ok) throw new Error('human-samples: HTTP ' + r.status); return r.arrayBuffer(); }),
  ]);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  let mesh = null;
  model.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) throw new Error('human.glb: нет SkinnedMesh');
  const skeleton = mesh.skeleton;
  skeleton.computeBoneTexture();
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c);
  if (!actions.walk || !actions.idle) throw new Error('human.glb: нет клипов walk/idle');

  // ---------------- вершины сетки в текстуры
  const geo = mesh.geometry;
  const nV = geo.attributes.position.count, TH = Math.ceil(nV / TW);
  const vtxTex = (attr, comps) => {
    const data = new Float32Array(TW * TH * 4);
    for (let i = 0; i < nV; i++) for (let k = 0; k < comps; k++) data[i * 4 + k] = attr.getComponent(i, k);
    const t = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
  };
  const tPos0 = vtxTex(geo.attributes.position, 3), tNrm0 = vtxTex(geo.attributes.normal, 3);
  const tIdx = vtxTex(geo.attributes.skinIndex, 4), tWgt = vtxTex(geo.attributes.skinWeight, 4);
  const floatRT = renderer.extensions.has('EXT_color_buffer_float');
  const skinRT = new THREE.WebGLRenderTarget(TW, TH, {
    count: 2, type: floatRT ? THREE.FloatType : THREE.HalfFloatType,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false,
  });
  const skinMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tPos0: { value: tPos0 }, tNrm0: { value: tNrm0 }, tIdx: { value: tIdx }, tWgt: { value: tWgt },
      boneTexture: { value: skeleton.boneTexture }, bindMatrix: { value: mesh.bindMatrix }, bindMatrixInverse: { value: mesh.bindMatrixInverse },
    },
    vertexShader: `in vec3 position; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; precision highp int; precision highp sampler2D;
      uniform sampler2D tPos0, tNrm0, tIdx, tWgt, boneTexture; uniform mat4 bindMatrix, bindMatrixInverse;
      layout(location = 0) out vec4 outPos; layout(location = 1) out vec4 outNrm;
      mat4 bm(const in float i){ int size = textureSize(boneTexture, 0).x; int j = int(i) * 4; int x = j % size; int y = j / size;
        return mat4(texelFetch(boneTexture, ivec2(x, y), 0), texelFetch(boneTexture, ivec2(x + 1, y), 0),
                    texelFetch(boneTexture, ivec2(x + 2, y), 0), texelFetch(boneTexture, ivec2(x + 3, y), 0)); }
      void main(){ ivec2 c = ivec2(gl_FragCoord.xy);
        vec3 p = texelFetch(tPos0, c, 0).xyz, n = texelFetch(tNrm0, c, 0).xyz; vec4 si = texelFetch(tIdx, c, 0), sw = texelFetch(tWgt, c, 0);
        mat4 bx = bm(si.x), by = bm(si.y), bz = bm(si.z), bw = bm(si.w);
        vec4 sv = bindMatrix * vec4(p, 1.0);
        vec4 sk = bx * sv * sw.x + by * sv * sw.y + bz * sv * sw.z + bw * sv * sw.w;
        mat4 sm = bindMatrixInverse * (sw.x * bx + sw.y * by + sw.z * bz + sw.w * bw) * bindMatrix;
        outPos = vec4((bindMatrixInverse * sk).xyz, 1.0); outNrm = vec4(normalize((sm * vec4(n, 0.0)).xyz), 0.0); }`,
    depthTest: false, depthWrite: false,
  });
  const skinScene = new THREE.Scene();
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(tri, skinMat); quad.frustumCulled = false; skinScene.add(quad);
  const skinCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------------- невидимое тело: та же скиненная сетка из текстуры
  const vidx = new Float32Array(nV); for (let i = 0; i < nV; i++) vidx[i] = i;
  const occGeo = new THREE.BufferGeometry();
  occGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
  occGeo.setAttribute('vid', new THREE.BufferAttribute(vidx, 1));
  occGeo.setIndex(geo.index);
  const occMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { tPos: { value: skinRT.textures[0] }, uColor: { value: new THREE.Vector3(BG.r, BG.g, BG.b) }, uOpacity: { value: 1 } },
    vertexShader: `precision highp float; precision highp sampler2D; uniform sampler2D tPos; in float vid;
      void main(){ int k = int(vid); vec3 p = texelFetch(tPos, ivec2(k % ${TW}, k / ${TW}), 0).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; layout(location = 0) out vec4 outColor;
      void main(){ outColor = vec4(uColor, uOpacity); }`,
    transparent: true, depthTest: true, depthWrite: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  });
  // цвет фона в шейдере - как у clearColor (sRGB-байты), без перевода пространств
  occMat.uniforms.uColor.value.set(10 / 255, 10 / 255, 8 / 255);
  const occ = new THREE.Mesh(occGeo, occMat);
  occ.frustumCulled = false; occ.matrixAutoUpdate = false; occ.renderOrder = cfg.renderOrder ?? 5;
  scene.add(occ);

  // ---------------- точки
  const dv = new DataView(samplesBuf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'HSMP') throw new Error('human-samples: формат');
  const NS = dv.getUint32(8, true);
  const sTri = new Uint32Array(samplesBuf, 12, NS), sU = new Uint16Array(samplesBuf, 12 + NS * 4, NS), sV = new Uint16Array(samplesBuf, 12 + NS * 6, NS);
  const index = geo.index.array;
  const aVtx = new Float32Array(NS * 3), aBary = new Float32Array(NS * 2);
  for (let i = 0; i < NS; i++) {
    const t = sTri[i];
    aVtx[i * 3] = index[t * 3]; aVtx[i * 3 + 1] = index[t * 3 + 1]; aVtx[i * 3 + 2] = index[t * 3 + 2];
    aBary[i * 2] = sU[i] / 65535; aBary[i * 2 + 1] = sV[i] / 65535;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(aVtx, 3));
  pgeo.setAttribute('aBary', new THREE.BufferAttribute(aBary, 2));
  const keyDir = new THREE.Vector3(0.62, 0.38, 0.68).normalize();
  const pmat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tPos: { value: skinRT.textures[0] }, tNrm: { value: skinRT.textures[1] },
      uBase: { value: 8000 }, uSize: { value: new THREE.Vector2(1.1, 1.8) }, uClamp: { value: new THREE.Vector2(0.8, 2.4) },
      uDpr: { value: renderer.getPixelRatio() }, uRefDist: { value: cfg.refDist || 6.1 }, uBand: { value: 0.25 }, uBand0: { value: 0 },
      uKey: { value: keyDir }, uFill: { value: 0.2 }, uKeyGain: { value: 1 }, uExposure: { value: 1 },
      uJitter: { value: new THREE.Vector3() }, uAlbedo: { value: new THREE.Vector3(0.888, 0.871, 0.831) },
      uAlpha: { value: 1 }, uTm: { value: 0 }, uDrift: { value: 0 }, uBoost: { value: 0 }, uSizeK: { value: 1 },
      // маска читаемости текста глав - те же uniform-объекты, что у поля сцены (cfg.mask), если переданы
      maskRect: cfg.mask ? cfg.mask.maskRect : { value: new THREE.Vector4(-1, -1, -1, -1) },
      maskOn: cfg.mask ? cfg.mask.maskOn : { value: 0 },
    },
    vertexShader: `precision highp float; precision highp int; precision highp sampler2D;
      uniform sampler2D tPos, tNrm;
      uniform float uBase, uDpr, uRefDist, uBand, uBand0, uFill, uKeyGain, uExposure, uAlpha, uTm, uDrift, uBoost, uSizeK;
      uniform vec2 uSize, uClamp; uniform vec3 uKey, uAlbedo, uJitter;
      in vec2 aBary; out vec3 vColor; out float vA;
      vec3 fp(float i){ int k = int(i); return texelFetch(tPos, ivec2(k % ${TW}, k / ${TW}), 0).xyz; }
      vec3 fn(float i){ int k = int(i); return texelFetch(tNrm, ivec2(k % ${TW}, k / ${TW}), 0).xyz; }
      float hash(float n){ return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
      void main(){
        float w0 = 1.0 - aBary.x - aBary.y;
        vec3 p = w0 * fp(position.x) + aBary.x * fp(position.y) + aBary.y * fp(position.z);
        vec3 n = w0 * fn(position.x) + aBary.x * fn(position.y) + aBary.y * fn(position.z);
        float id = float(gl_VertexID);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        // глава 4, фаза A: точки поднимаются и расходятся в поле (как было у точек человека на CPU)
        if (uDrift > 0.0) {
          float s0 = hash(id + 3.0) * 2.0 - 1.0, s1 = hash(id + 5.0), s2 = hash(id + 9.0) * 2.0 - 1.0;
          float a4 = s0 * 6.283 + uTm * 0.12, r4 = (0.1 + 0.5 * s1) * uDrift;
          wp.xyz += vec3(cos(a4) * r4, (0.25 + 0.95 * s2 * s2) * uDrift, sin(a4) * r4);
        }
        vec4 mv = viewMatrix * wp;
        vec3 N = normalize(normalMatrix * n), V = normalize(-mv.xyz);
        float ndv = dot(N, V);
        float vis = step(0.0, ndv);
        if (id >= uBase) { float band = 1.0 - smoothstep(uBand0, uBand, ndv); vis *= smoothstep(-0.06, 0.06, band - hash(id)); }
        if (vis < 0.02 || uAlpha < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); vA = 0.0; return; }
        gl_Position = projectionMatrix * mv;
        float hs = hash(id + 17.0);
        float css = mix(mix(uSize.x, uSize.y, hs), mix(uSize.x, uSize.y, 0.5) * (0.75 + 0.5 * hs), uJitter.x) * uRefDist / max(-mv.z, 0.05);
        gl_PointSize = clamp(css * uSizeK, uClamp.x, uClamp.y) * uDpr * mix(0.6, 1.0, vis);
        float key = max(dot(N, uKey), 0.0), hemi = 0.5 + 0.5 * N.y;
        float L = uKeyGain * key + uFill * hemi;
        L = uExposure > 1.0 ? (1.0 - exp(-uExposure * L)) / (1.0 - exp(-uExposure)) : min(1.0, L);
        L = min(1.0, L * (1.0 + uBoost));
        L *= mix(1.0, 0.88 + 0.24 * hash(id + 41.0), uJitter.y);
        vec3 warm = mix(vec3(1.0), vec3(1.0, 0.86, 0.68), uJitter.z);
        vColor = uAlbedo * mix(warm, vec3(1.0), smoothstep(0.0, 0.7, L)) * L;
        // смена с точек интро: точки проявляются вразнобой по номеру, без общего «наплыва»
        vA = smoothstep(0.0, 0.25, uAlpha * 1.25 - hash(id + 23.0) * 1.0);
      }`,
    fragmentShader: `precision highp float; in vec3 vColor; in float vA; layout(location = 0) out vec4 outColor;
      uniform vec4 maskRect; uniform float maskOn;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){ vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25 || vA < 0.01) discard;
        // за панелью текста главы точки гаснут до 10% - как точки поля (та же растушёванная рамка 60 px)
        float mx = smoothstep(maskRect.x - 60.0, maskRect.x, gl_FragCoord.x) * (1.0 - smoothstep(maskRect.z, maskRect.z + 60.0, gl_FragCoord.x));
        float my = smoothstep(maskRect.y - 60.0, maskRect.y, gl_FragCoord.y) * (1.0 - smoothstep(maskRect.w, maskRect.w + 60.0, gl_FragCoord.y));
        outColor = vec4(toSRGB(vColor), vA * mix(1.0, 0.1, mx * my * maskOn)); }`,
    transparent: true, depthTest: true, depthWrite: true,
  });
  const points = new THREE.Points(pgeo, pmat);
  points.frustumCulled = false; points.matrixAutoUpdate = false; points.renderOrder = (cfg.renderOrder ?? 5) + 1;
  scene.add(points);

  // ---------------- пол клипов и касания стоп (офлайн-замер при загрузке, на CPU, один раз)
  const soles = soleVertices(mesh);
  const measured = measureClips({ model, mesh, mixer, actions, soles });

  const placement = new THREE.Matrix4();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), YAX = new THREE.Vector3(0, 1, 0);
  let paused = false, alpha = 1, occOpacity = 1;
  const inst = {
    gltf, model, mesh, mixer, actions, samples: NS, floatRT, floors: measured.floors, contacts: measured.contacts,
    preset: null, n: 0,
    /** Точки и невидимое тело. Страница «Продукты» рисует их копии (та же геометрия и материал, своя
        матрица) - несколько фигур на один проход скиннинга; цвет тела там меняется под тему страницы. */
    points, occ,
    /** Положение человека: та же схема, что у CPU-скиннинга сцены. */
    setTransform(S, footY, x, z, ca, sa) {
      tmpQ.setFromAxisAngle(YAX, Math.atan2(sa, ca));
      tmpS.set(S, S, S); tmpV.set(x, -footY * S, z);
      placement.compose(tmpV, tmpQ, tmpS);
    },
    /** Состояние сцены на кадр: alpha 0..1 (смена с точек интро), drift (глава 4A), boost/sizeK
        (глава 3 снимок, глава 4B густеет), tm - время сцены, occ 0..1 - непрозрачность тела. */
    setProgress(s) {
      const u = pmat.uniforms;
      if (s.alpha !== undefined) alpha = s.alpha;
      if (s.occ !== undefined) occOpacity = s.occ;
      u.uAlpha.value = alpha;
      if (s.tm !== undefined) u.uTm.value = s.tm;
      if (s.drift !== undefined) u.uDrift.value = s.drift;
      if (s.boost !== undefined) u.uBoost.value = s.boost;
      if (s.sizeK !== undefined) u.uSizeK.value = s.sizeK;
    },
    /** Качество: имя пресета и/или число точек (тыс.). */
    setQuality(q) {
      const name = q.preset || inst.preset || 'зерно-8k';
      const p = PRESETS[name] || PRESETS['зерно-8k'];
      const m = mobile ? 'phone' : 'desktop';
      const n = q.n || p.n[m];
      const base = Math.min(n * 1000, NS), pool = Math.min(Math.round(base * (1 + p.extra[m])), NS);
      const u = pmat.uniforms;
      u.uBase.value = base; u.uSize.value.set(...p.size[m]); u.uClamp.value.set(p.clampMin[m], q.clampMax || 2.4);
      u.uFill.value = p.fill; u.uKeyGain.value = p.key; u.uExposure.value = p.exposure;
      u.uJitter.value.set(p.jitterSize, p.jitterLum, p.warm); u.uBand0.value = p.band[0]; u.uBand.value = p.band[1];
      u.uDpr.value = renderer.getPixelRatio();
      if (q.refDist) u.uRefDist.value = q.refDist;
      pgeo.setDrawRange(0, pool);
      inst.preset = name; inst.n = n; inst.pool = pool;
    },
    pause() { paused = true; points.visible = occ.visible = false; },
    resume() { paused = false; },
    /** Раз в кадр, после того как сцена обновила mixer и model.updateMatrixWorld(). */
    update() {
      const on = !paused && alpha > 0.002;
      points.visible = on; occ.visible = on && occOpacity > 0.002;
      if (!on) return;
      skeleton.update();
      tmpM.multiplyMatrices(placement, mesh.matrixWorld);
      points.matrix.copy(tmpM); points.matrixWorldNeedsUpdate = true;
      occ.matrix.copy(tmpM); occ.matrixWorldNeedsUpdate = true;
      occMat.uniforms.uOpacity.value = occOpacity;
      const prevRT = renderer.getRenderTarget();
      renderer.setRenderTarget(skinRT);
      renderer.render(skinScene, skinCam);
      renderer.setRenderTarget(prevRT);
    },
    dispose() {
      scene.remove(points); scene.remove(occ);
      for (const o of [pgeo, pmat, occGeo, occMat, skinRT, skinMat, tri, tPos0, tNrm0, tIdx, tWgt]) o.dispose();
      mixer.stopAllAction();
    },
  };
  inst.setQuality({ preset: cfg.preset, n: cfg.n, refDist: cfg.refDist });
  return inst;
}

// Вершины подошвы: вес костей стопы/носка > 0.5 и в позе покоя у пола (до 3 см над нижней точкой).
function soleVertices(mesh) {
  const geo = mesh.geometry, P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const bones = mesh.skeleton.bones.map(b => b.name.replace(/^mixamorig:?/, ''));
  const v = new THREE.Vector3();
  let minY = Infinity;
  const ys = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(mesh.bindMatrix); ys[i] = v.y; if (v.y < minY) minY = v.y; }
  const out = { Left: [], Right: [] };
  for (let i = 0; i < P.count; i++) {
    if (ys[i] > minY + 0.03) continue;
    for (const side of ['Left', 'Right']) {
      let w = 0;
      for (let k = 0; k < 4; k++) { const n = bones[SI.getComponent(i, k)]; if (n === side + 'Foot' || n === side + 'ToeBase') w += SW.getComponent(i, k); }
      if (w > 0.5) out[side].push(i);
    }
  }
  return out;
}

// CPU-скиннинг одной вершины в пространство модели (как SkinnedMesh.applyBoneTransform).
function skinVertex(mesh, i, out) {
  out.fromBufferAttribute(mesh.geometry.attributes.position, i);
  mesh.applyBoneTransform(i, out);
  return out.applyMatrix4(mesh.matrixWorld);
}

// Пол каждого клипа (нижняя точка подошвы) и моменты касания стоп в walk:
// касание - первый кадр (шаг 1/120 с), где нижняя точка подошвы опустилась до пола + 6 мм,
// после того как была выше пола + 15 мм (гистерезис). Точка касания - нижняя вершина подошвы.
function measureClips({ model, mesh, mixer, actions, soles }) {
  const v = new THREE.Vector3();
  const floors = {};
  const tracks = {};
  for (const name of ['walk', 'idle']) {
    const act = actions[name], other = actions[name === 'walk' ? 'idle' : 'walk'];
    act.play(); other.play();
    act.setEffectiveWeight(1); other.setEffectiveWeight(0);
    const dur = act.getClip().duration, steps = Math.max(8, Math.round(dur * (name === 'walk' ? 120 : 15)));
    let minAll = Infinity;
    const tr = { Left: [], Right: [] };
    for (let s = 0; s < steps; s++) {
      act.time = (s / steps) * dur; other.time = 0;
      mixer.update(0); model.updateMatrixWorld(true); mesh.skeleton.update();
      for (const side of ['Left', 'Right']) {
        let my = Infinity, mp = null;
        for (const i of soles[side]) { skinVertex(mesh, i, v); if (v.y < my) { my = v.y; mp = v.clone(); } }
        tr[side].push({ t: s / steps, y: my, p: mp });
        if (my < minAll) minAll = my;
      }
    }
    floors[name] = minAll;
    tracks[name] = tr;
  }
  const contacts = [];
  for (const side of ['Left', 'Right']) {
    const tr = tracks.walk[side], fl = floors.walk, n = tr.length;
    for (let s = 0; s < n; s++) {
      const prev = tr[(s - 1 + n) % n];
      if (tr[s].y < fl + 0.006 && !(prev.y < fl + 0.006)) {
        // был ли подъём выше 15 мм перед этим касанием (за последние 0.6 цикла)
        let lifted = false;
        for (let b = 1; b < n * 0.6; b++) if (tr[(s - b + n) % n].y > fl + 0.015) { lifted = true; break; }
        if (lifted) contacts.push({ side, phase: tr[s].t, x: tr[s].p.x, y: tr[s].p.y, z: tr[s].p.z });
      }
    }
  }
  contacts.sort((a, b) => a.phase - b.phase);
  // вернуть веса: покой
  actions.walk.time = 0; actions.idle.time = 0;
  actions.idle.setEffectiveWeight(1); actions.walk.setEffectiveWeight(0);
  mixer.update(0); model.updateMatrixWorld(true);
  return { floors, contacts };
}
