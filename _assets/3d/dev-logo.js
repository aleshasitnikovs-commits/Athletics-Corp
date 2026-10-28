// Страницы «в разработке»: сплошной белый 3D-логотип AC медленно вращается над заголовком.
// Форма - _assets/img/logo-ac-solid.svg: позитив того же знака, что в интро главной (logo-ac-negative.svg,
// построение - _3d/logo/), выдавливание как у 3D-логотипа СТАТЬ на «Продуктах»: SVGLoader -> ExtrudeGeometry,
// матовый MeshLambertMaterial #F2F0EB. Рисует, только пока сцена на экране и вкладка видна.
// reduced motion - один неподвижный кадр; без WebGL - плоский знак маской (page.css, .dev-static).
import * as THREE from 'three';
import { SVGLoader } from '../vendor/three/loaders/SVGLoader.js';

const TURN = 16;                                       // с на оборот
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('devLogo'), stage = document.getElementById('devStage');
const fail = (e) => { root.classList.add('no-webgl'); if (e) console.warn('dev-logo: 3D выключено, показан плоский знак', e); };

if (canvas && stage) init().catch(fail);

async function init() {
  const test = document.createElement('canvas');
  if (!test.getContext('webgl2')) { fail(); return; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8880, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(1.2, 1.6, 3); scene.add(key);

  const url = new URL('../img/logo-ac-solid.svg', import.meta.url);
  const txt = await fetch(url).then((r) => { if (!r.ok) throw new Error('logo ' + r.status); return r.text(); });
  const shapes = new SVGLoader().parse(txt).paths.flatMap((p) => p.toShapes(true));
  // толщина ~16% высоты знака (482 единицы), мягкая фаска 3 единицы наружу. Фаска внутрь (bevelOffset < 0, как
  // у СТАТЬ) здесь ломает форму: в узких местах знака сдвинутые контуры пересекаются и просветы заливаются
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 78, curveSegments: 6, bevelEnabled: true, bevelThickness: 6, bevelSize: 3, bevelOffset: 0, bevelSegments: 4 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox, c = new THREE.Vector3(); bb.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
  const LW = bb.max.x - bb.min.x, LH = bb.max.y - bb.min.y;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color('#F2F0EB') }));
  const g = new THREE.Group(); g.add(mesh); scene.add(g);

  let W = 0, H = 0, visible = true, raf = 0, last = performance.now(), rot = reduce ? 0 : -0.5;
  function resize() {
    const r = stage.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    // знак целиком в кадре при любом повороте: ширина по кадру
    const half = Math.tan(THREE.MathUtils.degToRad(14)) * 6, s = Math.min(1.7 * half * camera.aspect / LW, 1.7 * half / LH);
    mesh.scale.set(s, -s, s);                          // SVG: ось y вниз
    draw();
  }
  function draw() { renderer.render(scene, camera); }
  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    rot += (2 * Math.PI / TURN) * Math.min(0.05, (now - last) / 1000); last = now;
    g.rotation.y = rot; draw();
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (!reduce && !raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  addEventListener('resize', resize);
  g.rotation.y = rot; resize(); wake();
  window.__devLogo = { running: () => !!raf };   // для автотестов
}
