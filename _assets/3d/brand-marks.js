import * as THREE from 'three';
import { SVGLoader } from '../vendor/three/loaders/SVGLoader.js';

const turn = Math.PI * 2 / 8.5;
const geometrySettings = {
  ifach: { depth: 27, bevel: 1.15 },
  ac: { depth: 66, bevel: 3 },
  neurogames: { depth: 25, bevel: .9 },
  'corp-run': { depth: 29, bevel: 1.1 },
};

export function startBrandMarks(scope, reduceMotion) {
  if (!('IntersectionObserver' in window)) return;
  const buffer = document.createElement('canvas');
  const gl = buffer.getContext('webgl2', { alpha: true, antialias: true });
  if (!gl) return;

  const renderer = new THREE.WebGLRenderer({ canvas: buffer, context: gl, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 40);
  camera.position.z = 5.8;
  const fullHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9e9b93, 1.65));
  for (const [x, y, z, intensity] of [[2, 4, 5, 1.2], [-3, 1.5, -4, .75]]) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }
  const marks = new Map();
  let animation = 0, previous = 0, elapsed = 0, lost = false;

  function canDraw() {
    return !lost && !reduceMotion.matches && !document.hidden
      && [...marks.values()].some(mark => mark.visible && mark.model);
  }

  function schedule() {
    if (!animation && canDraw()) {
      previous = performance.now();
      animation = requestAnimationFrame(draw);
    }
  }

  function draw(now) {
    animation = 0;
    if (!canDraw()) return;
    const dt = Math.min(.05, (now - previous) / 1000);
    previous = now;
    elapsed += dt;
    const angle = -.32 + elapsed * turn;
    const lift = .055 * Math.sin(elapsed * 1.65);
    for (const mark of marks.values()) {
      if (!mark.visible || !mark.model) continue;
      const ratio = Math.min(devicePixelRatio || 1, 1.6);
      const width = Math.round(mark.host.clientWidth * ratio);
      const height = Math.round(mark.host.clientHeight * ratio);
      if (!width || !height) continue;
      if (mark.canvas.width !== width) mark.canvas.width = width;
      if (mark.canvas.height !== height) mark.canvas.height = height;
      if (buffer.width !== width || buffer.height !== height) renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const { model, bounds } = mark;
      const scale = Math.min(fullHeight * .76 / bounds.y, fullHeight * camera.aspect * .82 / bounds.x);
      model.scale.set(scale, -scale, scale);
      model.rotation.set(-.07, angle, 0);
      model.position.y = lift;
      scene.add(model);
      renderer.render(scene, camera);
      scene.remove(model);
      mark.output.clearRect(0, 0, width, height);
      mark.output.drawImage(buffer, 0, 0);
      mark.host.classList.add('is-3d');
    }
    animation = requestAnimationFrame(draw);
  }

  async function load(mark) {
    const { depth, bevel } = geometrySettings[mark.host.dataset.brand];
    const response = await fetch(mark.source);
    if (!response.ok) throw new Error('Форма логотипа: HTTP ' + response.status);
    const logo = new SVGLoader().parse(await response.text());
    const face = new THREE.Group();
    for (const path of logo.paths) {
      const shapes = path.toShapes();
      if (!shapes.length) continue;
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth, curveSegments: 5, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel / 2, bevelSegments: 2,
      });
      const material = [
        new THREE.MeshStandardMaterial({ color: path.color, roughness: .53, metalness: .11 }),
        new THREE.MeshStandardMaterial({ color: path.color.clone().multiplyScalar(.62), roughness: .48, metalness: .18 }),
      ];
      face.add(new THREE.Mesh(geometry, material));
    }
    if (!face.children.length) throw new Error('Форма логотипа пуста');
    const bounds = new THREE.Box3().setFromObject(face);
    face.position.copy(bounds.getCenter(new THREE.Vector3())).negate();
    mark.bounds = bounds.getSize(new THREE.Vector3());
    mark.model = new THREE.Group();
    mark.model.add(face);
    schedule();
  }

  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      const mark = marks.get(target);
      mark.visible = isIntersecting;
      if (isIntersecting && !mark.requested) {
        mark.requested = true;
        load(mark).catch(error => console.warn('Логотип главной: показан статичный знак', error));
      }
    }
    schedule();
  });
  for (const host of scope.querySelectorAll('.brand-mark[data-brand]')) {
    const canvas = document.createElement('canvas');
    const output = canvas.getContext('2d');
    if (!output) continue;
    canvas.setAttribute('aria-hidden', 'true');
    const source = host.querySelector('img').src;
    marks.set(host, { host, canvas, output, source, visible: false });
    host.append(canvas);
    observer.observe(host);
  }
  buffer.addEventListener('webglcontextlost', () => {
    lost = true;
    for (const host of marks.keys()) host.classList.remove('is-3d');
    observer.disconnect();
  });
  reduceMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
}
