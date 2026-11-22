import * as THREE from 'three';
import { SVGLoader } from '../vendor/three/loaders/SVGLoader.js';

const turn = Math.PI * 2 / 8.5;
const geometrySettings = {
  ifach: { depth: 27, bevel: 1.15, angle: -.32 },
  ac: { depth: 66, bevel: 3, angle: .38 },
};

export function startInstituteMarks(section, reduceMotion) {
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
  const material = [
    new THREE.MeshStandardMaterial({ color: '#f2f0eb', roughness: .53, metalness: .11 }),
    new THREE.MeshStandardMaterial({ color: '#aaa79f', roughness: .48, metalness: .18 }),
  ];
  const marks = new Map();
  let animation = 0, previous = 0, lost = false;

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

      mark.elapsed += dt;
      const { model, bounds } = mark;
      const scale = Math.min(fullHeight * .76 / bounds.y, fullHeight * camera.aspect * .82 / bounds.x);
      model.scale.set(scale, -scale, scale);
      model.rotation.set(-.07, mark.angle + mark.elapsed * turn, 0);
      model.position.y = .055 * Math.sin(mark.elapsed * 1.65 + mark.angle);
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
    const shapes = logo.paths.flatMap(shape => shape.toShapes());
    if (!shapes.length) throw new Error('Форма логотипа пуста');
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth, curveSegments: 5, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel / 2, bevelSegments: 2,
    });
    geometry.center();
    mark.bounds = geometry.boundingBox.getSize(new THREE.Vector3());
    mark.model = new THREE.Mesh(geometry, material);
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
  for (const host of section.querySelectorAll('.home-institute-mark')) {
    const canvas = document.createElement('canvas');
    const output = canvas.getContext('2d');
    if (!output) continue;
    canvas.setAttribute('aria-hidden', 'true');
    const source = host.querySelector('img').src;
    const { angle } = geometrySettings[host.dataset.brand];
    marks.set(host, { host, canvas, output, source, angle, elapsed: 0, visible: false });
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
