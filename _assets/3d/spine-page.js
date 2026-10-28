// Позвоночник из точек для страницы «Анализ осанки».
// Точки посчитаны один раз в Blender (_3d/spine/build_spine.py -> spine-points.bin): позиция и нормаль,
// порядок вложенный - первые K точек при любом K равномерно покрывают поверхность.
// Модель статичная, деформации нет; изгиб «ровно -> сутуло» на экране 03 считается в вершинном шейдере:
// у каждого отдела свой угол сгиба вперёд, ось позвоночника интегрируется снизу вверх. Вид как у человека в пресете «зерно-8k»: зерно, свет справа, тёмная сторона уходит в фон.
//
// Поведение (как на живом сайте): медленное вращение вокруг вертикали, поворот мышью или пальцем,
// после отпускания - инерция и плавный возврат к своему вращению.
// По прокрутке (window.SP из analiz.js): 01 справа от заголовка; 03 доворот в три четверти и цикл
// «ровно -> сутуло -> ровно» за BEND_SECONDS; 04 профиль, латунные метки отделов; до начала экрана 05
// гаснет полностью и перестаёт рисоваться.
import * as THREE from 'three';

export const SPINE_POINTS = 30000;          // точек на компьютере
const SPINE_POINTS_PHONE = 12000;           // на телефоне (ширина < 860 px)
const TURN_SECONDS = 20;                    // оборот автовращения
const BEND_SECONDS = 6;                     // цикл «ровно -> сутуло -> ровно» на экране 03
// компьютер: позвоночник между шапкой и низом окна, не выше DESK_HEIGHT окна
const DESK_HEIGHT = 0.85;                   // наибольшая высота, доля высоты окна
const DESK_TOP = 92;                        // px от верха окна: ниже шапки-капсулы (16 + 52 px) с запасом
const DESK_BOTTOM = 64;                     // px от низа окна
const DESK_X = 0.58;                        // центр по горизонтали (NDC): 79% ширины, правее середины правой половины
const PHONE_FILL = 0.85;                    // на телефоне - доля высоты своей области data-stage-box

const root = document.documentElement;
const reduce = root.classList.contains('reduce');
const canvas = document.getElementById('spine');
const fail = (e) => { root.classList.add('no-webgl'); if (canvas) canvas.style.display = 'none'; if (e) console.warn('spine: 3D выключено, показана картинка', e); };

if (!root.classList.contains('no-webgl') && canvas) {
  init().catch(fail);
}

async function init() {
  const params = new URLSearchParams(location.search);
  const capture = params.has('capture');
  const phone = () => innerWidth < 860;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: capture, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0A0A08, capture ? 0 : 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5);
  const HALF = Math.tan(THREE.MathUtils.degToRad(15)) * 5;   // половина высоты кадра в плоскости z=0

  const { points, mat, geo, N, meta } = await createSpinePoints('../_assets/3d/');
  const tilt = new THREE.Group(); tilt.add(points);
  const holder = new THREE.Group(); holder.add(tilt);
  scene.add(holder);

  const stages = [...document.querySelectorAll('[data-stage-box]')];
  const s05 = document.getElementById('s05');

  // ---------------------------------------------------------------- размер, качество
  let W = 0, H = 0;
  function resize() {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, phone() ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    mat.uniforms.uDpr.value = dpr;
    mat.uniforms.uSize.value.set(...(phone() ? [1.2, 2.0] : [1.1, 1.8]));
    geo.setDrawRange(0, Math.min(N, phone() ? SPINE_POINTS_PHONE : SPINE_POINTS));
    wake();
  }
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- вращение и жесты
  // профиль: перед (+Z) смотрит влево, спина (остистые отростки) - вправо, от текста; метки ставятся
  // на линии спины и подписи уходят вправо, не наезжая на текст экрана
  const PROFILE = -Math.PI / 2;
  const VIEW3 = PROFILE + 0.45;              // экран 03: три четверти, сгиб вперёд читается, объём остаётся
  // off - поворот рукой поверх доворота на 03 и 04, после отпускания плавно возвращается к нулю
  let rot = capture || reduce ? Math.PI / 4 : 0.6, off = 0, vx = 0, tiltX = 0, drag = false, lastX = 0, lastY = 0, pid = null;
  document.querySelectorAll('[data-hit]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => { drag = true; pid = e.pointerId; lastX = e.clientX; lastY = e.clientY; vx = 0; el.setPointerCapture(e.pointerId); wake(); });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== pid) return;
      vx = (e.clientX - lastX) * 0.013; rot += vx; off += vx;
      tiltX = Math.max(-0.55, Math.min(0.55, tiltX + (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
    });
    const up = () => { drag = false; pid = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  });

  // ---------------------------------------------------------------- метки отделов (экран 04)
  const labels = [...document.querySelectorAll('.spine-label')].map((el) => ({ el, p: new THREE.Vector3(...meta.labels[el.dataset.k]) }));
  const tmp = new THREE.Vector3();

  // ---------------------------------------------------------------- кадр
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  let raf = 0, last = performance.now(), idle = false, frames = [], t3 = 0, blank = false;
  function state() {
    const SP = window.SP || { w3: 0, w4: 0 };
    return reduce || capture ? { w3: 0, w4: 0 } : SP;
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frames.push(now); if (frames.length > 121) frames.shift();
    const { w3, w4 } = state();
    const ph = phone();
    // вращение: своё (стоит на 03 и 04), инерция после жеста, наклон и поворот рукой возвращаются к нулю
    if (!reduce && !capture) {
      if (!drag) {
        if (Math.abs(vx) > 0.0005) { vx *= Math.pow(0.93, dt * 60); rot += vx; off += vx; }
        rot += (2 * Math.PI / TURN_SECONDS) * dt * (1 - w3) * (1 - w4);
        tiltX += (0 - tiltX) * Math.min(1, dt * 2.5);
        off += (0 - off) * Math.min(1, dt * 1.2);
      }
    }
    // 03: доворот в три четверти, 04: в профиль (к ближайшему такому углу)
    const near = (a) => a + 2 * Math.PI * Math.round((rot - a) / (2 * Math.PI));
    const e3 = sm(0, 1, w3), e4 = sm(0, 1, w4);
    holder.rotation.y = mix(mix(rot, near(VIEW3), e3), near(PROFILE), e4) + off * Math.max(e3, e4);
    tilt.rotation.x = tiltX * (1 - Math.max(e3, e4));
    // изгиб: цикл по времени, пока виден экран 03; начинается с ровного положения
    t3 = w3 > 0.01 && !reduce ? t3 + dt : 0;
    mat.uniforms.uBend.value = (0.5 - 0.5 * Math.cos(2 * Math.PI * t3 / BEND_SECONDS)) * e3 * (1 - e4);
    // положение в кадре. Компьютер: в середине правой половины, неподвижно.
    // Телефон: в своей области data-stage-box (01, 03, 04), прокручивается вместе с ней. Пока видны две
    // области сразу, гаснет и переходит в ту, что видна больше, - без прыжка на виду.
    const aspect = W / H;
    let stageA = 1;
    if (ph && !capture && !reduce) {
      let best = null, bestV = 0, secV = 0;
      for (const el of stages) {
        const r = el.getBoundingClientRect();
        const v = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)) / Math.max(1, r.height);
        if (v > bestV) { secV = bestV; bestV = v; best = { r }; } else if (v > secV) secV = v;
      }
      if (best) {
        const { r } = best, cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        holder.position.set((2 * cx / W - 1 - 0.18 * e4) * HALF * aspect, (1 - 2 * cy / H) * HALF, 0);
        holder.scale.setScalar(r.height / H * PHONE_FILL * HALF);
      }
      stageA = sm(0.15, 0.6, bestV) * sm(0, 0.3, bestV - secV);
    } else {
      const hPx = Math.min(DESK_HEIGHT * H, H - DESK_TOP - DESK_BOTTOM), cy = DESK_TOP + hPx / 2;
      holder.position.set((ph ? 0 : DESK_X) * HALF * aspect, ph ? -0.42 * HALF : (1 - 2 * cy / H) * HALF, 0);
      holder.scale.setScalar(ph ? 0.62 : hPx / H * HALF);
    }
    if (capture) { holder.position.set(0, 0, 0); holder.scale.setScalar(1.25); }
    // после экрана 04: гаснет до нуля, пока верх экрана 05 поднимается от 1.25 высоты окна до нижнего края
    const gone = s05 && !capture ? sm(0, 1, (1.25 * H - s05.getBoundingClientRect().top) / (0.25 * H)) : 0;
    const alpha = (1 - gone) * stageA;
    mat.uniforms.uAlpha.value = alpha;
    points.visible = alpha > 0;
    // пустой холст (позвоночник погас) перерисовывать незачем
    if (alpha > 0 || !blank) renderer.render(scene, camera);
    blank = alpha === 0;
    // метки
    const la = reduce ? 0 : e4 * (1 - gone) * stageA;
    holder.updateMatrixWorld();
    for (const L of labels) {
      if (la < 0.01) { if (L.el.style.opacity !== '0') L.el.style.opacity = '0'; continue; }
      tmp.copy(L.p).applyMatrix4(points.matrixWorld).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
      L.el.style.transform = `translate(${(x - 3.5).toFixed(1)}px, ${(y - 7).toFixed(1)}px)`;
      L.el.style.opacity = la.toFixed(3);
    }
    // перестать рисовать: позвоночник ушёл в фон, жестов нет, инерция погасла
    idle = !drag && Math.abs(vx) < 0.0005 && gone >= 1;
  }
  function loop(now) {
    raf = 0;
    if (document.hidden) return;
    frame(now);
    if (reduce || capture) return;            // один кадр: перерисовка только по resize
    if (idle) return;                         // спит до прокрутки или жеста
    raf = requestAnimationFrame(loop);
  }
  function wake() { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  addEventListener('scroll', () => { if (idle) { idle = false; wake(); } }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  resize();

  window.SPINE = {
    ready: true, points: () => geo.drawRange.count, running: () => !!raf, idle: () => idle,
    bend: () => mat.uniforms.uBend.value, alpha: () => mat.uniforms.uAlpha.value,
    fps() { if (frames.length < 2) return 0; return 1000 * (frames.length - 1) / (frames[frames.length - 1] - frames[0]); },
    capture() { frame(performance.now()); return canvas.toDataURL('image/png'); },
  };
}

// Точки позвоночника: загрузка spine-points.bin и материал (вид «зерно-8k»). Общие для страницы анализа
// и страницы «Продукты» (produkty/produkty.js), где позвоночник рисуется на общем холсте страницы.
// base - папка с файлами модели; uBg - цвет фона, к которому гаснет точка при uAlpha < 1.
export async function createSpinePoints(base) {
  const [buf, meta] = await Promise.all([
    fetch(base + 'spine-points.bin').then(r => { if (!r.ok) throw new Error('spine-points ' + r.status); return r.arrayBuffer(); }),
    fetch(base + 'spine-meta.json').then(r => r.json()),
  ]);
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'SPNP') throw new Error('spine-points: формат');
  const N = dv.getUint32(8, true);
  const pos = new Float32Array(buf.slice(12, 12 + N * 12));
  const nrm = new Int8Array(buf.slice(12 + N * 12, 12 + N * 15));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));

  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uBend: { value: 0 }, uAlpha: { value: 1 }, uDpr: { value: 1 }, uSize: { value: new THREE.Vector2(1.1, 1.8) },
      uKey: { value: new THREE.Vector3(0.62, 0.38, 0.68).normalize() }, uFill: { value: 0.34 }, uKeyGain: { value: 1.25 }, uExposure: { value: 2.6 },
      uAlbedo: { value: new THREE.Vector3(0.888, 0.871, 0.831) }, uRef: { value: 5.0 },
      uBg: { value: new THREE.Vector3(10 / 255, 10 / 255, 8 / 255) },
    },
    vertexShader: /* glsl */`
      uniform float uBend, uDpr, uFill, uKeyGain, uExposure, uRef;
      uniform vec2 uSize; uniform vec3 uKey, uAlbedo;
      out vec3 vColor;
      float hash(float n){ return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
      // сутулость: накопленный угол сгиба вперёд (+Z) на высоте y. Модель от -1 (крестец) до 1 (атлант):
      // поясница -0.75..-0.35 слегка уплощается, грудной кифоз -0.3..0.55 растёт, шея 0.5..0.85 уходит вперёд
      const float Y0 = -0.75;
      float theta(float y){
        return uBend * (0.15 * smoothstep(-0.75, -0.35, y) + 0.5 * smoothstep(-0.3, 0.55, y) + 0.6 * smoothstep(0.5, 0.85, y));
      }
      void main(){
        // ось позвоночника изгибается по theta (интеграл снизу вверх, 16 шагов), точка сохраняет
        // своё смещение от оси по Z, повёрнутое на угол оси
        vec3 p = position, n = normal;
        if (uBend > 0.001 && p.y > Y0) {
          float h = (p.y - Y0) / 16.0; vec2 ax = vec2(Y0, 0.0);
          for (int i = 0; i < 16; i++) { float t = theta(Y0 + (float(i) + 0.5) * h); ax += h * vec2(cos(t), sin(t)); }
          float a = theta(p.y), c = cos(a), s = sin(a);
          p.y = ax.x - p.z * s; p.z = ax.y + p.z * c;
          n = vec3(n.x, n.y * c - n.z * s, n.z * c + n.y * s);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 N = normalize(normalMatrix * n), V = normalize(-mv.xyz);
        if (dot(N, V) < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); return; }
        gl_Position = projectionMatrix * mv;
        float id = float(gl_VertexID);
        gl_PointSize = clamp(mix(uSize.x, uSize.y, hash(id + 17.0)) * uRef / max(-mv.z, 0.1), 0.8, 2.6) * uDpr;
        float L = uKeyGain * max(dot(N, uKey), 0.0) + uFill * (0.5 + 0.5 * N.y);
        L = (1.0 - exp(-uExposure * L)) / (1.0 - exp(-uExposure));
        vColor = uAlbedo * min(L, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; uniform vec3 uBg;
      in vec3 vColor; layout(location = 0) out vec4 outColor;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){ vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; 
        // яркость гасит точку к цвету фона (uBg, по умолчанию #0A0A08), а не к чёрному: иначе погасший
        // позвоночник остаётся на фоне чёрным силуэтом
        outColor = vec4(mix(uBg, toSRGB(vColor), uAlpha), 1.0); }`,
    depthTest: true, depthWrite: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat, geo, N, meta };
}
