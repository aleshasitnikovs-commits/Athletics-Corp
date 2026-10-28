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
    if (!hdr || !btn || !menu) return;

    // ---------------------------------------------------------- прятанье при прокрутке
    // Вниз дальше 120 px - уезжает вверх; вверх на 10+ px подряд - возвращается; у верха всегда видна.
    // Положение берётся из событий Lenis (там, где он есть), иначе из обычной прокрутки.
    var lastY = scrollY, upRun = 0, hidden = false, menuOpen = false;
    function setHidden(h) { if (h !== hidden) { hidden = h; hdr.classList.toggle('is-hidden', h); } }
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
    function open() {
      if (menuOpen) return;
      menuOpen = true; back = document.activeElement; clearTimeout(hideT);
      menu.hidden = false; void menu.offsetWidth;          // кадр со скрытыми строками, затем выезд
      menu.classList.add('is-open'); setHidden(false);
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden'; if (window.__lenis) window.__lenis.stop();
      closeBtn.focus({ preventScroll: true });
    }
    function close() {
      if (!menuOpen) return;
      menuOpen = false; menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = ''; if (window.__lenis) window.__lenis.start();
      hideT = setTimeout(function () { menu.hidden = true; }, reduce ? 0 : 300);
      (back && back.focus ? back : btn).focus({ preventScroll: true });
    }
    btn.addEventListener('click', open);
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
