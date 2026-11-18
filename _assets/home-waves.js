const duration = 1180;
const ink = '#F2F0EB';

function smooth(from, to, value) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function revealSection(wrap, direction, motionPreference, finished) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    finished();
    return () => {};
  }

  const section = wrap.parentElement;
  canvas.className = 'home-wave';
  canvas.setAttribute('aria-hidden', 'true');
  section.classList.add('home-wave-entering');
  wrap.prepend(canvas);

  // Draw at a limited resolution so the wave stays light on a phone.
  const width = Math.min(canvas.clientWidth, 1460);
  const height = canvas.clientHeight;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = ink;

  const columns = Math.max(24, Math.round(width / 12));
  const rows = width < 620 ? 6 : 8;
  const points = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const seed = row * columns + column;
      const offset = ((seed * 73) % 101) / 101;
      points.push({
        u: (column + .1 + offset * .8) / columns,
        depth: row / (rows - 1) - .5,
        phase: row * .35 + offset * .2,
        size: .85 + ((seed * 19) % 71) / 71 * 1.35,
        light: .36 + offset * .64
      });
    }
  }

  const start = performance.now();
  let frame;
  function stop() {
    cancelAnimationFrame(frame);
    canvas.remove();
    section.classList.remove('home-wave-entering');
    finished();
  }
  function draw(now) {
    const progress = Math.max(0, (now - start) / duration);
    if (progress >= 1 || motionPreference.matches || document.hidden) {
      stop();
      return;
    }

    const crest = -.19 + smooth(0, .93, progress) * 1.34;
    const fade = smooth(0, .14, progress) * (1 - smooth(.72, 1, progress));
    context.clearRect(0, 0, width, height);
    for (const point of points) {
      const distance = point.u - crest;
      const pulse = Math.exp(-13 * distance * distance);
      if (pulse < .035) continue;

      // Behind the crest the rows gather into a thin band, then dissolve.
      const gather = 1 - .83 * smooth(-.1, .34, -distance);
      const drift = Math.sin(point.u * 14 - progress * 5.5 + point.phase);
      const x = (direction > 0 ? point.u : 1 - point.u) * width;
      const y = height * (.59 + gather * (point.depth * .47 + drift * .17));
      context.globalAlpha = fade * pulse * point.light * .9;
      context.fillRect(x, y, point.size, point.size);
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return stop;
}

export function prepareSectionWaves(motionPreference) {
  if (motionPreference.matches || !('IntersectionObserver' in window)) return;
  const directions = new Map();
  const active = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      const stop = active.get(target);
      if (!isIntersecting) {
        if (stop) stop();
        continue;
      }
      if (stop || motionPreference.matches) continue;

      const finish = () => {
        observer.unobserve(target);
        active.delete(target);
      };
      const stopWave = revealSection(target, directions.get(target), motionPreference, finish);
      if (target.parentElement.classList.contains('home-wave-entering')) active.set(target, stopWave);
    }
  }, {rootMargin: '0px 0px -14% 0px'});
  document.querySelectorAll('.home-section > .home-wrap').forEach((wrap, index) => {
    directions.set(wrap, index % 2 === 0 ? 1 : -1);
    observer.observe(wrap);
  });
}
