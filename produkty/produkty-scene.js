// Страница «Продукты»: один WebGL-холст на страницу (#scene, фиксирован под текстом) и четыре объекта,
// каждый привязан к своей области .stage[data-obj] и каждый кадр ставится по её положению на экране:
//   spine - позвоночник из точек (createSpinePoints из spine-page.js, как на странице анализа);
//   duo   - две фигуры из точек (human-points.js, поза idle), правая чуть повёрнута к левой;
//   class - шесть фигур полукругом, idle, низкая плотность: два экземпляра человека, у каждого три
//           копии (одна прорисовка скиннинга на три фигуры, у копий своя матрица);
//   stat  - 3D-логотип СТАТЬ: SVG (_assets/img/stat-logo.svg) -> SVGLoader -> ExtrudeGeometry, матовый.
// Рисуются только объекты, чья область на экране; нет ни одного - холст очищается и не рисуется.
// В скрытой вкладке requestAnimationFrame не идёт. Lenis (produkty-page.js) крутится в этом же кадре.
// Тема СТАТЬ (<html data-theme="stat">): логотип белый -> графитовый, фон тела фигур и затухание
// позвоночника - цвет фона страницы; переход 0,6 с, как у CSS-переменных (при reduced motion сразу).
import * as THREE from 'three';
import { SVGLoader } from '../_assets/vendor/three/loaders/SVGLoader.js';
import { createSpinePoints } from '../_assets/3d/spine-page.js';
import { init as initHuman } from '../_assets/3d/human-points.js';

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
      modelUrl: '../_assets/3d/human.glb', samplesUrl: '../_assets/3d/human-samples.bin',
    });
    inst.actions.idle.time = opt.t0 || 0;
    inst.mixer.update(0); inst.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inst.mesh);
    const foot = inst.floors.idle, S = 1 / Math.max(0.01, box.max.y - foot);
    const [p0, ...more] = opt.at;
    inst.setTransform(S, foot, p0[0], p0[1], Math.cos(p0[2]), Math.sin(p0[2]));
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
      dpr() { inst.setQuality({ n: inst.n }); },
      frame(dt, vis) {
        if (!vis) { if (on) { inst.pause(); for (const c of copies) c.pts.visible = c.occ.visible = false; on = false; } return; }
        if (!on) { inst.resume(); on = true; }
        if (!reduce) inst.mixer.update(dt);
        inst.model.updateMatrixWorld(true);
        inst.update();
        inst.occ.material.uniforms.uColor.value.copy(bg);
        for (const c of copies) {
          c.pts.matrix.multiplyMatrices(c.pl, inst.mesh.matrixWorld); c.pts.matrixWorldNeedsUpdate = true;
          c.occ.matrix.copy(c.pts.matrix); c.occ.matrixWorldNeedsUpdate = true;
          c.pts.visible = inst.points.visible; c.occ.visible = inst.occ.visible;
        }
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
  const addDuo = () => addFigures('duo', [
    { n: 8, t0: 0.0, at: [[-0.2, 0, 14 * D]] },
    { n: 8, t0: 1.3, at: [[0.24, -0.06, -52 * D]] },
  ], (a) => Math.min(a.h * 0.8, a.w / 0.9), 0.02);
  // шесть фигур полукругом, лицом к центру, низкая плотность
  const ARC = [-80, -48, -16, 16, 48, 80].map((d) => { const r = 1.05, t = d * D; return [r * Math.sin(t), -r * Math.cos(t) + 0.55, -t]; });
  const addClass = () => addFigures('class', [
    { n: mobile ? 2 : 3, t0: 0.0, at: [ARC[0], ARC[2], ARC[4]] },
    { n: mobile ? 2 : 3, t0: 1.6, at: [ARC[1], ARC[3], ARC[5]] },
  ], (a) => Math.min(a.h * 0.6, a.w / 3.0), 0.45);

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

  const jobs = { spine: addSpine(), duo: addDuo(), class: addClass(), stat: addStat() };
  for (const [k, p] of Object.entries(jobs)) p.then(() => { resize(); }, fallback(k));
  Promise.allSettled(Object.values(jobs)).then(() => { api.ready = true; });

  // для автотестов
  const api = window.__scene = {
    ready: false, objects: () => objs.map((o) => o.k), visible: () => objs.filter((o) => o.g.visible).map((o) => o.k),
    drawn: () => drawn, blank: () => blank, theme: () => tk,
    fps() { if (frames.length < 2) return 0; return 1000 * (frames.length - 1) / (frames[frames.length - 1] - frames[0]); },
  };
}
