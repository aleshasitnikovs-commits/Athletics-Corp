const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 861px)');
const opening = document.querySelector('.home-opening');
const company = document.querySelector('.home-company');
const scene = document.querySelector('.home-scene');
const stage = document.querySelector('.home-stage');
const figure = document.querySelector('.home-motion');
const prelude = document.querySelector('.home-prelude');

function arrangeScene() {
  opening.classList.toggle('home-panoramic', desktop.matches);
  if (desktop.matches) stage.append(scene);
  else figure.prepend(scene);
}

function playPrelude() {
  if (!root.classList.contains('home-intro-active')) return;

  const canvas = prelude.querySelector('canvas');
  const context = canvas.getContext('2d');
  const controller = new AbortController();
  const options = {capture: true, passive: true, signal: controller.signal};
  let timeout;

  function dismiss(immediate = false) {
    if (immediate) prelude.style.transition = 'none';
    root.classList.remove('home-intro-active');
    controller.abort();
    clearTimeout(timeout);
  }

  try { sessionStorage.setItem('ac-home-intro', '1'); } catch (_) {}
  for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll']) {
    addEventListener(event, () => dismiss(true), options);
  }
  timeout = setTimeout(dismiss, 1290);
  if (!context) return;

  const logo = new Image();
  logo.onload = () => {
    if (controller.signal.aborted) return;
    const sample = document.createElement('canvas');
    sample.width = 260;
    sample.height = 125;
    const sampler = sample.getContext('2d', {willReadFrequently: true});
    if (!sampler) return;
    sampler.drawImage(logo, 0, 0, sample.width, sample.height);
    const pixels = sampler.getImageData(0, 0, sample.width, sample.height).data;
    const targets = [];
    for (let y = 0; y < sample.height; y += 2) {
      for (let x = 0; x < sample.width; x += 2) {
        if (pixels[(y * sample.width + x) * 4 + 3] > 140) targets.push([x + 100, y + 62]);
      }
    }
    if (!targets.length) return;
    const particles = targets.map(([x, y]) => ({
      x, y,
      fromX: Math.random() * canvas.width,
      fromY: 60 + Math.random() * 175,
      brightness: .34 + Math.random() * .63
    }));

    const start = performance.now();
    prelude.classList.add('has-particles');
    function draw(now) {
      if (controller.signal.aborted) return;
      const progress = Math.min(1, (now - start) / 785);
      const convergence = 1 - (1 - progress) ** 3;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#F2F0EB';
      for (const p of particles) {
        context.globalAlpha = p.brightness * (.45 + .55 * progress);
        const x = p.fromX + (p.x - p.fromX) * convergence;
        const y = p.fromY + (p.y - p.fromY) * convergence;
        context.fillRect(x, y, 1.2, 1.2);
      }
      if (progress < 1) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };
  logo.src = new URL('./3d/logo-white-mask.png', import.meta.url).href;
}

function prepareSectionMotion() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting) continue;
      target.classList.add('has-entered');
      observer.unobserve(target);
    }
  }, {threshold: .18});
  for (const visual of document.querySelectorAll('[data-home-motion]')) observer.observe(visual);
}

function prepareObservation() {
  const chapter = window.CH = {ch3: 0};
  let pending = false;
  function readPosition() {
    pending = false;
    const viewport = document.documentElement.clientHeight;
    const top = company.getBoundingClientRect().top;
    const progress = Math.max(0, Math.min(1, (viewport * .93 - top) / (viewport * .8)));
    chapter.ch3 = desktop.matches ? progress * progress * (3 - 2 * progress) * .60 : 0;
  }
  function queuePosition() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(readPosition);
  }
  addEventListener('scroll', queuePosition, {passive: true});
  addEventListener('resize', queuePosition, {passive: true});
  desktop.addEventListener('change', queuePosition);
  readPosition();
}

arrangeScene();
desktop.addEventListener('change', arrangeScene);
if (!reduceMotion.matches) {
  playPrelude();
  prepareSectionMotion();
  prepareObservation();
  import('./3d/hero-scene.js?v=20261117-2').catch(() => {
    root.classList.add('no-webgl', 'story-static');
  });
}
