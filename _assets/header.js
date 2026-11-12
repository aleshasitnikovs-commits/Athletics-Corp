// Шапка: вариант, прятанье при прокрутке, полноэкранное меню (задача 14). Подключается в <head>
// синхронно - вариант (data-header на <html>) ставится до отрисовки, без прыжка. Остальное - после разметки.
// Разметка - _assets/_header-template.mjs, стили - _assets/header.css.
(function () {
  var d = document.documentElement, VARIANTS = ['pill', 'line', 'rail'];
  var q = (location.search.match(/[?&]header=(pill|line|rail)\b/) || [])[1];
  if (q) d.setAttribute('data-header', q);
  else if (VARIANTS.indexOf(d.getAttribute('data-header')) < 0) d.setAttribute('data-header', 'pill');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    var hdr = document.getElementById('hdr'), btn = document.getElementById('menuBtn'), menu = document.getElementById('siteMenu');
    if (!hdr || !btn || !menu || document.querySelector('.hdr-menu-fab')) return;

    var mobile = matchMedia('(max-width: 860px), (pointer: coarse)');
    var quick = btn.cloneNode(true);
    quick.removeAttribute('id');
    quick.className = 'hdr-menu-fab';
    quick.setAttribute('aria-label', 'Открыть меню');
    quick.hidden = true;
    var lines = document.createElement('span');
    lines.setAttribute('aria-hidden', 'true');
    lines.append(...quick.childNodes);
    quick.append(lines);
    var logo = hdr.querySelector('.hdr-logo img');
    if (logo) {
      var icon = logo.cloneNode(false);
      icon.alt = '';
      quick.prepend(icon);
    }
    menu.before(quick);
    // Полоса уведомлений создаётся site.js после разметки и меняет высоту.
    requestAnimationFrame(function () {
      var bar = document.getElementById('acBar');
      if (!bar) return;
      function placeQuick() { quick.style.setProperty('--ac-bar-height', bar.offsetHeight + 'px'); }
      placeQuick();
      if ('ResizeObserver' in window) new ResizeObserver(placeQuick).observe(bar);
    });

    // ---------------------------------------------------------- прятанье при прокрутке
    // Вниз дальше 120 px - уезжает вверх; вверх на 10+ px подряд - возвращается; у верха всегда видна.
    // Положение берётся из событий Lenis (там, где он есть), иначе из обычной прокрутки.
    var lastY = scrollY, upRun = 0, hidden = false, menuOpen = false;
    function syncQuick() {
      var hide = !mobile.matches || !hidden || menuOpen;
      if (quick.hidden !== hide) quick.hidden = hide;
    }
    function setHidden(h) {
      if (h !== hidden) { hidden = h; hdr.classList.toggle('is-hidden', h); hdr.inert = h; }
      syncQuick();
    }
    mobile.addEventListener('change', syncQuick);
    function onY(y) {
      var dy = y - lastY; lastY = y;
      if (reduce || menuOpen || y <= 120) { upRun = 0; setHidden(false); return; }
      if (dy > 0) { upRun = 0; setHidden(true); }
      else if (dy < 0) { upRun -= dy; if (upRun >= 10) setHidden(false); }
    }
    function onNative() { onY(scrollY); }
    var onLenis = false;
    function bindLenis() {
      if (onLenis || !window.__lenis || !window.__lenis.on) return;
      onLenis = true; removeEventListener('scroll', onNative);
      window.__lenis.on('scroll', function (e) { onY(e.scroll); });
    }
    addEventListener('scroll', onNative, { passive: true });
    bindLenis();
    if (!onLenis) addEventListener('load', bindLenis);
    onY(scrollY);

    // ---------------------------------------------------------- меню
    var closeBtn = menu.querySelector('.smenu-close'), back = null, hideT = 0;
    function items() { return [].slice.call(menu.querySelectorAll('a[href], button')); }
    function open(e) {
      if (menuOpen) return;
      menuOpen = true; back = e.currentTarget; clearTimeout(hideT);
      menu.hidden = false; void menu.offsetWidth;          // кадр со скрытыми строками, затем выезд
      menu.classList.add('is-open'); setHidden(false);
      btn.setAttribute('aria-expanded', 'true');
      quick.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden'; if (window.__lenis) window.__lenis.stop();
      closeBtn.focus({ preventScroll: true });
    }
    function close() {
      if (!menuOpen) return;
      menuOpen = false; menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      quick.setAttribute('aria-expanded', 'false');
      if (back === quick && mobile.matches && scrollY > 120) setHidden(true);
      else syncQuick();
      document.body.style.overflow = ''; if (window.__lenis) window.__lenis.start();
      hideT = setTimeout(function () { menu.hidden = true; }, reduce ? 0 : 300);
      (back === quick && !quick.hidden ? quick : btn).focus({ preventScroll: true });
    }
    btn.addEventListener('click', open);
    quick.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    addEventListener('keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;                         // фокус не уходит из открытого меню
      var f = items(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // для автотестов
    window.__header = { hidden: function () { return hidden; }, menuOpen: function () { return menuOpen; }, lenis: function () { return onLenis; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
