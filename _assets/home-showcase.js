const showcase = document.querySelector('[data-home-showcase]');
const art = showcase.querySelector('.home-showcase-art');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const buttons = [...showcase.querySelectorAll('[data-preview]')];
const selector = showcase.querySelector('select');
const caption = {
  name: showcase.querySelector('.home-showcase-name'),
  status: showcase.querySelector('.home-showcase-status'),
  description: showcase.querySelector('.home-showcase-description'),
};
const posters = {
  duo: 'catalog/duo.webp?v=20261122',
  masterclass: 'produkty-class.png?v=20261112-2',
  stat: 'showcase/stat.webp',
};
const stages = new Map([['spine', art.querySelector('.stage')]]);
let stage = stages.get('spine');
let visible = false;
let runtime;
let drawing;
let loading;
let failed = false;

const canPlay = () => visible && !document.hidden && !motion.matches;

function showScene() {
  if (!canPlay() || failed || document.documentElement.classList.contains('no-webgl')) return;
  if (runtime) {
    runtime.refresh();
  } else if (!loading) {
    if (!drawing) {
      const canvas = document.createElement('canvas');
      try {
        const mobile = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
        const context = canvas.getContext('webgl2', { alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
        if (context) drawing = { canvas, context };
      } catch {}
      if (!drawing) { failed = true; return; }
    }
    loading = import('../produkty/produkty-scene.js?v=20261122-5')
      .then(({createProductScenes}) => {
        if (!canPlay()) return;
        runtime = createProductScenes({
          ...drawing,
          scope: art,
          embedded: true,
          enabled: canPlay,
          light: () => showcase.dataset.previewActive === 'stat',
        });
        window.__homeProductScene = runtime;
      })
      .catch(error => {
        failed = true;
        console.warn('Витрина главной: показан статичный кадр', error);
      })
      .finally(() => { loading = null; });
  }
}

function createStage(key) {
  const node = document.createElement('div');
  const poster = new Image();
  poster.alt = '';
  poster.className = 'static';
  poster.src = new URL('./img/' + (posters[key] || 'catalog/' + key + '.webp?v=20261122'), import.meta.url);
  node.dataset.obj = key;
  node.className = 'stage fallback';
  if (key !== 'ai') node.setAttribute('data-hit', '');
  node.append(poster);
  art.append(node);
  stages.set(key, node);
  return node;
}

function select(button) {
  const key = button.dataset.preview;
  const group = button.closest('.home-showcase-group');
  stage.hidden = true;
  stage = stages.get(key) || createStage(key);
  stage.hidden = false;
  showcase.dataset.previewActive = key;
  showcase.toggleAttribute('data-development', group.id === 'technology');
  for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
  selector.value = key;
  caption.name.textContent = button.textContent;
  caption.status.textContent = button.dataset.status || group.querySelector('h3').textContent;
  caption.description.textContent = button.dataset.summary;
  showScene();
}

for (const group of showcase.querySelectorAll('.home-showcase-group')) {
  const options = document.createElement('optgroup');
  options.label = group.querySelector('h3').textContent;
  for (const button of group.querySelectorAll('[data-preview]')) {
    options.append(new Option(button.textContent, button.dataset.preview));
    button.disabled = false;
    button.addEventListener('click', () => select(button));
  }
  selector.append(options);
}
selector.addEventListener('change', () => {
  const button = buttons.find(item => item.dataset.preview === selector.value);
  if (button) select(button);
});
motion.addEventListener('change', showScene);
document.addEventListener('visibilitychange', showScene);

const stat = buttons.find(item => item.dataset.preview === 'stat');
function showTechnology() {
  if (location.hash !== '#technology') return;
  select(stat);
  if (matchMedia('(max-width: 760px)').matches) showcase.closest('section').scrollIntoView();
}
showcase.classList.add('is-ready');
if (location.hash === '#technology') showTechnology();
else select(buttons[0]);
addEventListener('hashchange', showTechnology);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    showScene();
  }, { rootMargin: '240px 0px' }).observe(art);
} else {
  visible = true;
  showScene();
}
