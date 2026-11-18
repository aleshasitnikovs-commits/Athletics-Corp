const root = document.documentElement;
const filters = [...document.querySelectorAll('.catalog-filters a')];
const groups = [...document.querySelectorAll('.catalog-group')];
const details = [...document.querySelectorAll('.catalog-detail')];
const detailById = new Map(details.map(detail => [detail.id, detail]));
const stages = new Map();
for (const detail of details) {
  const node = detail.querySelector('.stage');
  if (node) stages.set(detail.id, { node, parent: node.parentElement });
}

const layout = document.querySelector('.catalog-layout');
const exhibit = layout.querySelector('.catalog-exhibit');
const artwork = exhibit.querySelector('.catalog-exhibit-stage');
const picker = exhibit.querySelector('select');
const canvas = artwork.querySelector('canvas');
const paint = canvas.getContext('2d');
const caption = exhibit.querySelector('.catalog-exhibit-summary');
const more = caption.querySelector('.catalog-link');
let sceneRequested = false;
let mounted;
let currentGroup;
let selected;
let artworkVisible = !('IntersectionObserver' in window);
const catalogue = new Map(groups.map(group => [group.id, {
  stage: group.id.slice('catalog-'.length),
  products: [...group.querySelectorAll('.catalog-card')].map((card, index) => {
    const heading = card.querySelector('h2');
    const link = card.querySelector('.catalog-link');
    const title = heading.textContent.trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-row-button';
    button.setAttribute('aria-controls', caption.id);
    const name = document.createElement('span');
    name.textContent = title;
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    button.append(name, arrow);
    heading.replaceChildren(button);

    const item = {
      id: link.hash.slice(1), index, title, button,
      status: card.querySelector('.catalog-stage').textContent.trim(),
      copy: card.querySelector('.catalog-card-copy').textContent.trim(),
    };
    button.addEventListener('click', () => selectProduct(item));
    return item;
  }),
}]));
const choices = new Map();

function requestScene() {
  if (sceneRequested || root.matches('.no-webgl, .reduce') ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  sceneRequested = true;
  import('./produkty-scene.js?v=20261118-scenes-3').catch(() => root.classList.add('no-webgl'));
}

function restoreStage() {
  if (!mounted) return;
  mounted.parent.append(mounted.node);
  mounted = undefined;
}

// A field of points projected from tilted rings. The artwork represents a direction, not a product render.
function drawArtwork(item) {
  if (!paint) return;
  const { width, height } = canvas;
  paint.clearRect(0, 0, width, height);
  paint.fillStyle = '#f2f0eb';
  for (let ring = 0; ring < 9; ring++) {
    const r = 55 + ring * 17;
    for (let i = 0; i < 140; i++) {
      const a = i * 2 * Math.PI / 140 + ring * .33;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      const wave = Math.sin(a * (2 + item.index % 3) + ring * .55 + item.index);
      const y = wave * (32 + item.index * 5);
      const depth = 1 + z * .0016;
      const px = width / 2 + x * 1.45 * depth;
      const py = height * .54 + (z * .38 - y) * depth;
      const size = .6 + depth * .85;
      paint.globalAlpha = .18 + (wave + 1) * .22;
      paint.fillRect(px, py, size, size);
    }
  }
  paint.globalAlpha = 1;
}

function selectProduct(item) {
  if (selected === item && !layout.hidden) return;
  selected = item;
  choices.set(currentGroup, item);
  for (const product of currentGroup.products) {
    product.button.setAttribute('aria-pressed', String(product === item));
  }
  picker.value = item.id;
  exhibit.dataset.stage = currentGroup.stage;
  caption.querySelector('.catalog-stage').textContent = item.status;
  caption.querySelector('h2').textContent = item.title;
  caption.querySelector('.catalog-card-copy').textContent = item.copy;
  more.href = '#' + item.id;
  more.setAttribute('aria-label', 'Подробнее: ' + item.title);

  restoreStage();
  if (layout.hidden) return;
  mounted = stages.get(item.id);
  canvas.hidden = Boolean(mounted);
  if (mounted) {
    artwork.append(mounted.node);
    const fallback = mounted.node.querySelector('img');
    if (fallback) fallback.loading = 'eager';
    if (artworkVisible) requestScene();
  } else {
    drawArtwork(item);
  }
  dispatchEvent(new Event('catalog:layout'));
}

function applyRoute(scroll) {
  const hash = location.hash.slice(1);
  const detail = detailById.get(hash);
  const detailGroup = detail && 'catalog-' + detail.dataset.catalogStage;
  const groupId = detailGroup || (catalogue.has(hash) ? hash : 'catalog-available');
  const group = catalogue.get(groupId);

  const wasDetail = layout.hidden;
  restoreStage();
  layout.hidden = Boolean(detail);
  for (const section of groups) section.hidden = section.id !== groupId;
  for (const link of filters) {
    if (link.hash === '#' + groupId) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  for (const entry of details) entry.hidden = entry !== detail;

  if (currentGroup !== group) {
    picker.replaceChildren(...group.products.map(item => new Option(item.title, item.id)));
    currentGroup = group;
  }
  selected = undefined;
  const item = group.products.find(product => product.id === hash) || choices.get(group) || group.products[0];
  selectProduct(item);
  if (detail) {
    if (stages.has(detail.id)) requestScene();
    dispatchEvent(new Event('catalog:layout'));
    if (scroll) requestAnimationFrame(() => {
      if (detail.hidden) return;
      const heading = detail.querySelector('h2');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      detail.scrollIntoView();
    });
  } else if (wasDetail) {
    const target = picker.getClientRects().length ? picker : item.button;
    target.focus();
  }
}

for (const link of filters) {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    applyRoute(false);
  });
}
picker.addEventListener('change', () => {
  const item = currentGroup.products.find(product => product.id === picker.value);
  if (item) selectProduct(item);
});
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    artworkVisible = entry.isIntersecting;
    if (artworkVisible && mounted) requestScene();
  });
  observer.observe(artwork);
}
addEventListener('hashchange', () => applyRoute(true));
exhibit.hidden = false;
layout.classList.add('is-exhibit');
applyRoute(true);
