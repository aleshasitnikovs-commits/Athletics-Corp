// Страница «Продукты»: один WebGL-холст на страницу (#scene, фиксирован под текстом) и четыре объекта,
// каждый привязан к своей области .stage[data-obj] и каждый кадр ставится по её положению на экране:
//   spine - позвоночник из точек (createSpinePoints из spine-page.js, как на странице анализа);
//   duo   - две фигуры из точек (human-points.js, поза idle), правая чуть повёрнута к левой;
//   masterclass - ведущий у доски и пять слушателей, позы из Blender;
//   stat  - 3D-логотип СТАТЬ: SVG (_assets/img/stat-logo.svg) -> SVGLoader -> ExtrudeGeometry, матовый.
// Рисуются только объекты, чья область на экране; нет ни одного - холст очищается и не рисуется.
// В скрытой вкладке requestAnimationFrame не идёт. Lenis (produkty-page.js) крутится в этом же кадре.
// Тема СТАТЬ (<html data-theme="stat">): логотип белый -> графитовый, фон тела фигур и затухание
// позвоночника - цвет фона страницы; переход 0,6 с, как у CSS-переменных (при reduced motion сразу).
import * as THREE from 'three';
import { SVGLoader } from '../_assets/vendor/three/loaders/SVGLoader.js';
import { createSpinePoints } from '../_assets/3d/spine-page.js';
import { init as initHuman } from '../_assets/3d/human-points.js?v=20261112-2';
import { createMasterclassPoints } from '../_assets/3d/masterclass-points.js?v=20261112-2';

const STAT_TURN = 12;                 // с на оборот логотипа
const SPINE_TURN = 20;                // с на оборот позвоночника (как на странице анализа)
const THEME_T = 0.6;                  // с, переход темы
const DARK = [10 / 255, 10 / 255, 8 / 255], LIGHT = [242 / 255, 240 / 255, 235 / 255];
const LOGO_DARK = new THREE.Color('#F2F0EB'), LOGO_LIGHT = new THREE.Color('#2B2A26');   // белый / графит (СТАТЬ-черный.svg)

const root = document.documentElement;
const reduce = root.classList.contains('reduce');
const canvas = document.getElementById('scene');
const phone = () => innerWidth < 860;
// Без WebGL или при ошибке сцены: Lenis крутится сам, у областей - статичные картинки
function lenisAlone() {
  const l = window.__lenis; if (!l || lenisAlone.on) return; lenisAlone.on = true;
  (function raf(t) { l.raf(t); requestAnimationFrame(raf); })(performance.now());
}
function fail(e) {
  root.classList.add('no-webgl'); if (canvas) canvas.style.display = 'none';
  if (e) console.warn('produkty: 3D выключено, показаны картинки', e);
  lenisAlone();
}
if (!root.classList.contains('no-webgl') && canvas) { try { init(); } catch (e) { fail(e); } }

function init() {
  const mobile = phone();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5);
  const HALF = Math.tan(THREE.MathUtils.degToRad(15)) * 5;   // половина высоты кадра в плоскости z=0
  // свет только для логотипа (у точек свой, в шейдере): мягкий общий + ключ спереди сверху справа
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8880, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(1.2, 1.6, 3); scene.add(key);

  let W = 0, H = 0;
  const objs = [];
  const bg = new THREE.Vector3(...DARK);

  // -------------------------------------------------------------- общее: область, вращение рукой
  // Объект в области: центр области -> точка плоскости z=0; возвращает размер области в мировых единицах.
  function place(group, el) {
    const r = el.getBoundingClientRect();
    group.position.set(((r.left + r.right) / W - 1) * HALF * (W / H), (1 - (r.top + r.bottom) / H) * HALF, 0);
    return { w: r.width / H * 2 * HALF, h: r.height / H * 2 * HALF, vis: r.bottom > 0 && r.top < H && r.height > 0 };
  }
  // поворот мышью или пальцем: по горизонтали - вокруг вертикали (с инерцией), по вертикали - наклон,
  // который после отпускания возвращается к нулю
  function spin(el) {
    const s = { rot: 0, vx: 0, tilt: 0, drag: false, x: 0, y: 0, id: null };
    if (reduce) return s;
    el.addEventListener('pointerdown', (e) => { s.drag = true; s.id = e.pointerId; s.x = e.clientX; s.y = e.clientY; s.vx = 0; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!s.drag || e.pointerId !== s.id) return;
      s.vx = (e.clientX - s.x) * 0.012; s.rot += s.vx;
      s.tilt = Math.max(-0.5, Math.min(0.5, s.tilt + (e.clientY - s.y) * 0.005));
      s.x = e.clientX; s.y = e.clientY;
    });
    const up = () => { s.drag = false; s.id = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    return s;
  }
  function spinStep(s, dt, turn) {
    if (reduce || s.drag) return;
    if (Math.abs(s.vx) > 0.0005) { s.vx *= Math.pow(0.93, dt * 60); s.rot += s.vx; }
    s.rot += (2 * Math.PI / turn) * dt;
    s.tilt += (0 - s.tilt) * Math.min(1, dt * 2.5);
  }
  const stage = (k) => document.querySelector(`.stage[data-obj="${k}"]`);
  // объект не загрузился - его область показывает статичную картинку, остальные работают
  const fallback = (k) => (e) => { const el = stage(k); if (el) el.classList.add('fallback'); console.warn('produkty: объект ' + k + ' не загрузился, показана картинка', e); };

  // -------------------------------------------------------------- позвоночник
  async function addSpine() {
    const el = stage('spine'); if (!el) return;
    const sp = await createSpinePoints('../_assets/3d/');
    const tilt = new THREE.Group(); tilt.add(sp.points);
    const g = new THREE.Group(); g.add(tilt); scene.add(g);
    const s = spin(el); s.rot = 0.6;
    objs.push({
      k: 'spine', el, g,
      quality(dpr) {
        sp.mat.uniforms.uDpr.value = dpr;
        sp.mat.uniforms.uSize.value.set(...(phone() ? [1.2, 2.0] : [1.1, 1.8]));
        sp.geo.setDrawRange(0, Math.min(sp.N, phone() ? 12000 : 30000));
      },
      frame(dt, a) {
        spinStep(s, dt, SPINE_TURN);
        g.rotation.y = s.rot; tilt.rotation.x = s.tilt;
        g.scale.setScalar(a.h * 0.86 / 2);                  // модель от -1 до 1 по высоте
        sp.mat.uniforms.uBg.value.copy(bg);
      },
    });
  }

  // -------------------------------------------------------------- фигуры
  // Фигура высотой 1 (S = 1 / рост), стопы на y = 0; x, z, yaw - в росте фигуры.
  async function human(parent, opt) {
    const inst = await initHuman({
      renderer, scene: parent, mobile, preset: 'зерно-8k', n: opt.n, refDist: 5,
      modelUrl: opt.clip ? '../_assets/3d/products-specialists.glb' : '../_assets/3d/human.glb',
      samplesUrl: '../_assets/3d/human-samples.bin',
    });
    inst.actions.idle.time = opt.t0 || 0;
    inst.mixer.update(0); inst.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inst.mesh);
    let foot = inst.floors.idle;
    const S = 1 / Math.max(0.01, box.max.y - foot);
    // свой клип (chest_open, coach_notes): играет он один; пол - нижняя точка тела в его первом кадре
    // (ноги в этих клипах неподвижны, см. build_human.py, раздел 6b)
    if (opt.clip && inst.actions[opt.clip]) {
      for (const a of Object.values(inst.actions)) a.stop();
      const a = inst.actions[opt.clip]; a.play(); a.setEffectiveWeight(1); a.time = opt.t0 || 0;
      (window.__clips = window.__clips || {})[opt.clip] = a;           // для автотестов
      inst.mixer.update(0); inst.model.updateMatrixWorld(true);
      inst.mesh.boundingBox = null;
      foot = new THREE.Box3().setFromObject(inst.mesh).min.y;
    }
    const [p0, ...more] = opt.at;
    inst.setTransform(S, foot, p0[0], p0[1], Math.cos(p0[2]), Math.sin(p0[2]));
    const placement = new THREE.Matrix4().compose(new THREE.Vector3(p0[0], -foot * S, p0[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p0[2]), new THREE.Vector3(S, S, S));
    const props = opt.props ? opt.props.map((k) => handProp(k, inst, parent)) : [];
    // копии: те же точки и тело, своя матрица
    const copies = more.map(([x, z, yaw]) => {
      const pl = new THREE.Matrix4().compose(new THREE.Vector3(x, -foot * S, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(S, S, S));
      const pts = new THREE.Points(inst.points.geometry, inst.points.material);
      const occ = new THREE.Mesh(inst.occ.geometry, inst.occ.material);
      for (const [o, src] of [[pts, inst.points], [occ, inst.occ]]) { o.frustumCulled = false; o.matrixAutoUpdate = false; o.renderOrder = src.renderOrder; parent.add(o); }
      return { pl, pts, occ };
    });
    let on = true;
    return {
      inst,
      dpr() { inst.setQuality({ n: inst.n }); for (const pr of props) pr.dpr(); },
      frame(dt, vis) {
        if (!vis) { if (on) { inst.pause(); for (const c of copies) c.pts.visible = c.occ.visible = false; for (const pr of props) pr.pts.visible = false; on = false; } return; }
        if (!on) { inst.resume(); on = true; }
        if (!reduce) inst.mixer.update(dt);
        inst.model.updateMatrixWorld(true);
        inst.update();
        inst.occ.material.uniforms.uColor.value.copy(bg);
        for (const pr of props) pr.update(placement);
        for (const c of copies) {
          c.pts.matrix.multiplyMatrices(c.pl, inst.mesh.matrixWorld); c.pts.matrixWorldNeedsUpdate = true;
          c.occ.matrix.copy(c.pts.matrix); c.occ.matrixWorldNeedsUpdate = true;
          c.pts.visible = inst.points.visible; c.occ.visible = inst.occ.visible;
        }
      },
    };
  }
  // -------------------------------------------------------------- блокнот и ручка тренера
  // Точки на поверхности предмета, вид как у человека («зерно-8k»: свет в осях камеры, цвет #F2F0EB).
  // Предмет держится в рамке ладони, которую каждый кадр строим по суставам кисти (кисть, основания
  // среднего, указательного и мизинца, большой палец): не зависит от осей костей в экспорте.
  // Рамка: y - вдоль кисти к пальцам, x - поперёк (к указательному), z - нормаль ладони (в сторону ладони).
  const PROP_KEY = new THREE.Vector3(0.62, 0.38, 0.68).normalize();
  const propMat = ({ tone = 1, size = 1, brass = false } = {}) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uDpr: { value: renderer.getPixelRatio() }, uKey: { value: PROP_KEY },
      uTone: { value: tone }, uSize: { value: size },
      uTint: { value: brass ? new THREE.Color('#DDA74F') : new THREE.Vector3(0.888, 0.871, 0.831) },
    },
    vertexShader: `uniform float uDpr, uTone, uSize; uniform vec3 uKey, uTint; out vec3 vColor;
      float hash(float n){ return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 N = normalize(normalMatrix * normal), V = normalize(-mv.xyz);
        if (dot(N, V) < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); return; }
        gl_Position = projectionMatrix * mv;
        float id = float(gl_VertexID);
        gl_PointSize = clamp(mix(1.1, 1.8, hash(id + 17.0)) * uSize * 5.0 / max(-mv.z, 0.05), 0.8, 2.4) * uDpr;
        float L = 1.25 * max(dot(N, uKey), 0.0) + 0.34 * (0.5 + 0.5 * N.y);
        L = (1.0 - exp(-2.6 * L)) / (1.0 - exp(-2.6));
        // бумага и пластик светлее кожи-точек: страница смотрит вверх, ключ в осях камеры её почти не берёт
        vColor = uTint * clamp(L, 0.62, 1.0) * uTone;
      }`,
    fragmentShader: `in vec3 vColor; layout(location = 0) out vec4 outColor;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){ vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; outColor = vec4(toSRGB(vColor), 1.0); }`,
    depthTest: true, depthWrite: true,
  });
  // точки на коробке w x h x d (м) с центром c и поворотом q в рамке ладони; dens - точек на м²
  function boxPoints(out, w, h, d, c, q, dens) {
    const faces = [[[1, 0, 0], h, d], [[-1, 0, 0], h, d], [[0, 1, 0], w, d], [[0, -1, 0], w, d], [[0, 0, 1], w, h], [[0, 0, -1], w, h]];
    for (const [n, a, b] of faces) {
      const cnt = Math.max(4, Math.round(a * b * dens)), nv = new THREE.Vector3(...n);
      for (let i = 0; i < cnt; i++) {
        const u = Math.random() - 0.5, v = Math.random() - 0.5;
        const p = n[0] ? new THREE.Vector3(n[0] * w / 2, u * h, v * d)
          : n[1] ? new THREE.Vector3(u * w, n[1] * h / 2, v * d) : new THREE.Vector3(u * w, v * h, n[2] * d / 2);
        out.push(p.applyQuaternion(q).add(c), nv.clone().applyQuaternion(q));
      }
    }
  }
  function cylPoints(out, len, r, dens) {
    const cnt = Math.round(2 * Math.PI * r * len * dens);
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * 2 * Math.PI, y = (Math.random() - 0.5) * len;
      out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
  }
  function handProp(kind, inst, parent) {
    const sd = kind === 'notebook' ? 'Left' : 'Right';
    const bone = (n) => inst.model.getObjectByName('mixamorig' + sd + n);
    const B = { hand: bone('Hand'), mid: bone('HandMiddle1'), idx: bone('HandIndex1'), pinky: bone('HandPinky1'), thumb: bone('HandThumb3') };
    const arr = [], DENS = 24000;
    if (kind === 'notebook') {
      // открытый блокнот A5 (две страницы по 10,5 x 14,8 см, толщина 4 мм), лёгкий излом по корешку;
      // лежит на ладони, корешок вдоль кисти
      const fold = 10 * Math.PI / 180;
      for (const sg of [-1, 1]) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sg * fold);
        const c = new THREE.Vector3(sg * 0.0525 * Math.cos(fold), 0.05, 0.034 + 0.0525 * Math.sin(fold));
        boxPoints(arr, 0.105, 0.148, 0.004, c, q, DENS);
      }
    } else {
      // ручка: цилиндр 14 см, диаметр 9 мм
      cylPoints(arr, 0.14, 0.0045, DENS * 1.6);
    }
    const n = arr.length / 2, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[2 * i].toArray(pos, 3 * i); arr[2 * i + 1].toArray(nrm, 3 * i); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const mat = propMat();
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.matrixAutoUpdate = false; pts.renderOrder = (inst.points.renderOrder || 6) + 1;
    parent.add(pts);
    (window.__props = window.__props || []).push({ kind, pts });   // для автотестов
    const P = {}, frame = new THREE.Matrix4(), off = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), tv = new THREE.Vector3();
    // ручка в рамке ладони: центр у основания указательного, ось наклонена к ладони и к мизинцу
    if (kind === 'pen') off.compose(new THREE.Vector3(0.015, 0.05, 0.03),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.25, 0.55, 0.8).normalize()), new THREE.Vector3(1, 1, 1));
    return {
      pts, count: n,
      dpr() { mat.uniforms.uDpr.value = renderer.getPixelRatio(); },
      update(placement) {
        for (const k in B) { P[k] = P[k] || new THREE.Vector3(); B[k].getWorldPosition(P[k]); }
        Y.subVectors(P.mid, P.hand).normalize();
        X.subVectors(P.idx, P.pinky); X.addScaledVector(Y, -X.dot(Y)).normalize();
        Z.crossVectors(X, Y).normalize();
        if (Z.dot(tv.subVectors(P.thumb, P.hand)) < 0) { Z.negate(); X.negate(); }
        frame.makeBasis(X, Y, Z).setPosition(tv.copy(P.hand).lerp(P.mid, 0.5));
        pts.matrix.multiplyMatrices(placement, frame);
        if (kind === 'pen') pts.matrix.multiply(off);
        pts.matrixWorldNeedsUpdate = true; pts.visible = inst.points.visible;
      },
    };
  }
  // группа фигур: g - в центре области, inner - стопы на полу, наклон камеры сверху
  async function addFigures(k, figs, fit, tiltX) {
    const el = stage(k); if (!el) return;
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); scene.add(g);
    inner.rotation.x = tiltX;
    const hs = await Promise.all(figs.map((f) => human(inner, f)));
    const s = spin(el);
    objs.push({
      k, el, g,
      quality() { for (const h of hs) h.dpr(); },
      frame(dt, a) {
        if (!reduce && !s.drag) { s.rot *= Math.pow(0.1, dt); s.vx = 0; }  // повёрнутые рукой фигуры возвращаются
        inner.rotation.y = s.rot; inner.rotation.x = tiltX + s.tilt * 0.5;
        if (!s.drag) s.tilt += (0 - s.tilt) * Math.min(1, dt * 2.5);
        const sc = fit(a); g.scale.setScalar(sc); inner.position.y = -0.5;
        for (const h of hs) h.frame(dt, a.vis);
      },
      hide() { for (const h of hs) h.frame(0, false); },
    });
  }
  const D = Math.PI / 180;
  // две фигуры: левая почти анфас, правая повёрнута к левой
  // работа со специалистом: тренер слева, вполоборота к клиенту и к камере, coach_notes с блокнотом и
  // ручкой; клиент справа, на три четверти лицом к тренеру, упражнение chest_open. Руки клиента в
  // раскрытии (полуразмах ~0,45 роста) до тренера не доходят: зазор ~0,5 роста.
  const addDuo = () => addFigures('duo', [
    { n: 8, t0: 0.0, clip: 'coach_notes', props: ['notebook', 'pen'], at: [[-0.50, -0.18, 50 * D]] },
    { n: 8, t0: 0.0, clip: 'chest_open', at: [[0.48, 0.05, -40 * D]] },
  ], (a) => Math.min(a.h * 0.72, a.w / 2.0), 0.02);
  async function addClass() {
    // Новый ключ не даёт старому скрипту рисовать фигуры поверх статичного кадра.
    const el = stage('masterclass'); if (!el) return;
    const workshop = await createMasterclassPoints({ renderer, mobile, propMat });
    const g = new THREE.Group();
    g.add(workshop.group); scene.add(g);
    const s = spin(el);
    objs.push({
      k: 'masterclass', el, g,
      quality(dpr) { workshop.setPixelRatio(dpr); },
      frame(dt, a) {
        if (!s.drag) {
          s.rot *= Math.pow(0.1, dt);
          s.tilt *= Math.pow(0.1, dt);
        }
        s.rot = THREE.MathUtils.clamp(s.rot, -0.27, 0.27);
        workshop.group.rotation.set(s.tilt * 0.24, s.rot, 0);
        g.scale.setScalar(Math.min(a.w / 4.64, a.h / 3.32));
        workshop.frame(reduce ? 0 : dt, bg);
      },
    });
    el.classList.remove('fallback');
  }

  // -------------------------------------------------------------- 3D-логотип СТАТЬ
  async function addStat() {
    const el = stage('stat'); if (!el) return;
    const txt = await fetch('../_assets/img/stat-logo.svg').then((r) => { if (!r.ok) throw new Error('stat-logo ' + r.status); return r.text(); });
    const shapes = new SVGLoader().parse(txt).paths.flatMap((p) => p.toShapes(true));
    // толщина 48 при высоте знака 313 (единицы SVG), мягкая фаска 7; силуэт не толстеет (bevelOffset)
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 48, curveSegments: 20, bevelEnabled: true, bevelThickness: 7, bevelSize: 7, bevelOffset: -7, bevelSegments: 6 });
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = new THREE.Vector3(); bb.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
    const LW = bb.max.x - bb.min.x, LH = bb.max.y - bb.min.y;
    const mat = new THREE.MeshLambertMaterial({ color: LOGO_DARK.clone() });
    const mesh = new THREE.Mesh(geo, mat);
    const tilt = new THREE.Group(); tilt.add(mesh);
    const g = new THREE.Group(); g.add(tilt); scene.add(g);
    const s = spin(el); s.rot = reduce ? 0 : -0.35;
    objs.push({
      k: 'stat', el, g,
      frame(dt, a, k) {
        spinStep(s, dt, STAT_TURN);
        g.rotation.y = s.rot; tilt.rotation.x = s.tilt;
        const sc = Math.min(a.w * 0.82 / LW, a.h * 0.5 / LH);
        mesh.scale.set(sc, -sc, sc);                        // SVG: ось y вниз
        mat.color.lerpColors(LOGO_DARK, LOGO_LIGHT, k);
        // область наведения для темы СТАТЬ (produkty-page.js): знак анфас в пикселях окна - не зависит
        // от угла поворота, иначе при неподвижной мыши тема мигала бы вместе с вращением
        const px = H / (2 * HALF), r = el.getBoundingClientRect();
        window.__statHit = { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, hw: LW * sc / 2 * px, hh: LH * sc / 2 * px };
      },
      hide() { window.__statHit = null; },
    });
  }

  // -------------------------------------------------------------- размер, кадр
  function resize() {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, phone() ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    for (const o of objs) if (o.quality) o.quality(dpr);
    dirty = true;
  }
  let last = performance.now(), tk = 0, blank = true, dirty = true, lastY = -1, frames = [], drawn = 0;
  const ease = (x) => x * x * (3 - 2 * x);
  function frame(now) {
    requestAnimationFrame(frame);
    if (window.__lenis) window.__lenis.raf(now);
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000)); last = now;
    // тема: 0 - тёмная, 1 - СТАТЬ; та же длительность, что у переменных CSS
    const target = root.getAttribute('data-theme') === 'stat' ? 1 : 0;
    const was = tk;
    tk = reduce ? target : target > tk ? Math.min(target, tk + dt / THEME_T) : Math.max(target, tk - dt / THEME_T);
    const k = ease(tk);
    for (let i = 0; i < 3; i++) bg.setComponent(i, DARK[i] + (LIGHT[i] - DARK[i]) * k);
    // reduced motion: перерисовка только при прокрутке, смене размера и темы
    const y = scrollY;
    if (reduce && !dirty && y === lastY && was === tk) return;
    lastY = y; dirty = false;
    let any = false;
    for (const o of objs) {
      const a = place(o.g, o.el);
      o.g.visible = a.vis;
      if (a.vis) { any = true; o.frame(dt, a, k); } else if (o.hide) o.hide();
    }
    if (any) { renderer.render(scene, camera); blank = false; drawn++; frames.push(now); if (frames.length > 121) frames.shift(); }
    else if (!blank) { renderer.clear(); blank = true; }
  }
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  const jobs = { spine: addSpine(), duo: addDuo(), masterclass: addClass(), stat: addStat() };
  for (const [k, p] of Object.entries(jobs)) p.then(() => { resize(); }, fallback(k));
  Promise.allSettled(Object.values(jobs)).then(() => { api.ready = true; });

  // для автотестов
  const api = window.__scene = {
    ready: false, objects: () => objs.map((o) => o.k), visible: () => objs.filter((o) => o.g.visible).map((o) => o.k),
    drawn: () => drawn, blank: () => blank, theme: () => tk,
    fps() { if (frames.length < 2) return 0; return 1000 * (frames.length - 1) / (frames[frames.length - 1] - frames[0]); },
  };
}
