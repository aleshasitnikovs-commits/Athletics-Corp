const showcase = document.querySelector('[data-home-showcase]');
const mediaRoot = new URL('./img/showcase/', import.meta.url);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const films = new Set(['spine', 'duo', 'masterclass', 'stat']);
const illustrations = {
  concierge: new URL('./img/home-walk-poster.png', import.meta.url),
  group: new URL('./img/produkty-class.png', import.meta.url)
};

const buttonList = [...showcase.querySelectorAll('[data-preview]')];
const selector = showcase.querySelector('select');
const poster = showcase.querySelector('img');
const video = showcase.querySelector('video');
const canvas = showcase.querySelector('canvas');
const caption = {
  name: showcase.querySelector('.home-showcase-name'),
  status: showcase.querySelector('.home-showcase-status'),
  description: showcase.querySelector('.home-showcase-description')
};

const width = 640, height = 384, tau = Math.PI * 2;
canvas.width = width;
canvas.height = height;
const context = canvas.getContext('2d');
let activeKey = 'spine';
let visible = false;
let frameId = 0;
let paintStarted = null;

function stopFrame() {
  cancelAnimationFrame(frameId);
  frameId = 0;
}

function drawDots(time) {
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const rows = activeKey === 'management' ? 5 : 6;
  const columns = activeKey === 'management' ? 42 : 82;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const u = column / (columns - 1);
      const angle = u * tau;
      const phase = time * 1.22 + row * .4;
      let x, y;
      switch (activeKey) {
        case 'concierge':
          x = 320 + (132 + row * 13) * Math.cos(angle + phase * .22);
          y = 229 + (34 + row * 6) * Math.sin(angle + phase * .22) - (x - 320) * .16;
          break;
        case 'group':
          x = 60 + u * 520;
          y = 280 + 26 * Math.sin(angle + phase) + row * 7;
          break;
        case 'sport':
          x = 320 + (170 + row * 12) * Math.cos(angle);
          y = 190 + (42 + row * 8) * Math.sin(angle) - (x - 320) * .23;
          break;
        case 'realtime':
          x = 70 + u * 500;
          y = 130 + row * 23 + 29 * Math.sin(angle * (1.4 + row * .1) - phase) * Math.sin(u * Math.PI);
          break;
        case 'management': {
          const group = Math.floor(u * 2.999);
          const a = (u * 3 - group) * tau + phase * .18;
          x = 163 + group * 156 + (24 + row * 9) * Math.cos(a);
          y = 192 + (24 + row * 9) * Math.sin(a);
          break;
        }
      }
      const pulse = .5 + .5 * Math.cos(angle - phase);
      context.fillStyle = '#f2f0eb';
      context.globalAlpha = .19 + pulse * .48;
      const size = 1 + pulse * 1.6;
      context.fillRect(x, y, size, size);
    }
  }
  context.globalAlpha = 1;
}

function animate(now) {
  frameId = 0;
  if (!visible || document.hidden || motion.matches) return;
  paintStarted ??= now;
  const duration = Math.min(4.4, (now - paintStarted) / 1000);
  drawDots(duration);
  if (duration < 4.4) frameId = requestAnimationFrame(animate);
}

function updatePlayback() {
  stopFrame();
  if (!visible || document.hidden || motion.matches) {
    video.pause();
    if (motion.matches) {
      video.hidden = true;
      if (!films.has(activeKey)) drawDots(0);
    }
    return;
  }

  if (films.has(activeKey)) {
    const source = new URL(activeKey + '.webm', mediaRoot).href;
    if (video.src !== source) video.src = source;
    if (!video.ended) video.play().catch(() => { video.hidden = true; });
  } else if (context) {
    frameId = requestAnimationFrame(animate);
  }
}

function select(button) {
  activeKey = button.dataset.preview;
  const group = button.closest('.home-showcase-group');
  showcase.dataset.previewActive = activeKey;
  showcase.toggleAttribute('data-development', group.id === 'technology');
  for (const item of buttonList) item.setAttribute('aria-pressed', String(item === button));
  selector.value = activeKey;
  caption.name.textContent = button.textContent;
  caption.status.textContent = button.dataset.status || group.querySelector('h3').textContent;
  caption.description.textContent = button.dataset.summary;

  video.pause();
  video.hidden = true;
  if (video.src) {
    video.removeAttribute('src');
    video.load();
  }
  canvas.hidden = films.has(activeKey) || !context;
  const illustration = illustrations[activeKey];
  poster.classList.toggle('is-illustration', Boolean(illustration));
  poster.hidden = !illustration && !films.has(activeKey);
  if (!poster.hidden) poster.src = illustration || new URL(activeKey + '.webp', mediaRoot);
  paintStarted = null;
  if (!canvas.hidden) drawDots(0);
  updatePlayback();
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
  const button = buttonList.find(item => item.dataset.preview === selector.value);
  if (button) select(button);
});
video.addEventListener('playing', () => {
  if (films.has(activeKey) && visible && !document.hidden && !motion.matches) video.hidden = false;
});
video.addEventListener('error', () => { video.hidden = true; });
motion.addEventListener('change', updatePlayback);
document.addEventListener('visibilitychange', updatePlayback);

showcase.classList.add('is-ready');
const fromDevelopment = location.hash === '#technology';
select(fromDevelopment ? buttonList.find(item => item.dataset.preview === 'stat') : buttonList[0]);
if (fromDevelopment && matchMedia('(max-width: 760px)').matches) {
  showcase.closest('section').scrollIntoView();
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }, {threshold: .08}).observe(showcase.querySelector('.home-showcase-art'));
} else {
  visible = true;
  updatePlayback();
}
