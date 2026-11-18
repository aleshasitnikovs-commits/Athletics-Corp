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
  prepareSectionMotion();
  prepareObservation();
  import('./3d/hero-scene.js?v=20261118').catch(() => {
    root.classList.add('no-webgl', 'story-static');
    window.__reveal(true);
  });
}
