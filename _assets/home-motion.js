import {prepareSectionWaves} from './home-waves.js?v=20261118-2';

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 861px)');
const opening = document.querySelector('.home-opening');
const company = document.querySelector('.home-company');
const scene = document.querySelector('.home-scene');
const stage = document.querySelector('.home-stage');
const figure = document.querySelector('.home-motion');
function arrangeScene() {
  opening.classList.toggle('home-panoramic', desktop.matches);
  if (desktop.matches) stage.append(scene);
  else figure.prepend(scene);
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

function prepareInstituteMarks() {
  if (!('IntersectionObserver' in window)) return;
  const section = document.getElementById('institute');
  if (!section) return;
  let visible = false;
  let requested = false;
  function start() {
    if (!visible || requested || reduceMotion.matches) return;
    requested = true;
    observer.disconnect();
    reduceMotion.removeEventListener('change', start);
    import('./3d/brand-marks.js?v=20261122-4')
      .then(module => module.startBrandMarks(section, reduceMotion))
      .catch(error => console.warn('Логотипы главной: показаны статичные знаки', error));
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  });
  observer.observe(section);
  reduceMotion.addEventListener('change', start);
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
prepareInstituteMarks();
if (!reduceMotion.matches) {
  prepareSectionWaves(reduceMotion);
  prepareSectionMotion();
  prepareObservation();
  import('./3d/hero-scene.js?v=20261122-5').catch(() => {
    root.classList.add('no-webgl', 'story-static');
    window.__reveal(true);
  });
}
