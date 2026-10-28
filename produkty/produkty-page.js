// Страница «Продукты»: плавная прокрутка (Lenis), переходы по оглавлению, светлая тема блока СТАТЬ.
// 3D - produkty-scene.js (общий холст страницы).
(function () {
  var root = document.documentElement;
  var isStatic = root.classList.contains("reduce") || root.classList.contains("no-webgl");

  // шапка и меню - общие, _assets/header.js (прятанье при прокрутке берёт события Lenis отсюда)

  // ---------------------------------------------------------------- Lenis
  // Своего цикла у Lenis нет (autoRaf выключен): его кадр вызывает produkty-scene.js в том же
  // requestAnimationFrame, где ставит объекты по положению их блоков, - объекты не отстают от прокрутки
  // на кадр. Без WebGL сцена не запускается, тогда цикл здесь.
  var lenis = null;
  if (!root.classList.contains("reduce") && typeof Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false, autoRaf: false });
    window.__lenis = lenis;
    if (isStatic) (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(t, { duration: 1.4 });
    });
  });

  // ---------------------------------------------------------------- тема СТАТЬ
  // Компьютер (есть наведение): мышь над самим 3D-логотипом (знак анфас + запас HIT_PAD px) дольше
  // 150 мс - светлая тема; увёл - обратно. Область логотипа каждый кадр отдаёт produkty-scene.js
  // (window.__statHit); без WebGL - рамка статичной картинки логотипа. Проверка - при движении мыши
  // и при прокрутке (логотип уезжает из-под неподвижной мыши).
  // Телефон и планшет: светлая, пока блок пересекает середину экрана.
  // Переход 0,6 с - в CSS (переменные на <html>); при reduced motion мгновенный. 3D-логотип и фон
  // холста подхватывают тему в produkty-scene.js по тому же атрибуту.
  var HIT_PAD = 24;
  var stat = document.getElementById("p-stat");
  var on = false;
  function setTheme(v) {
    if (v === on) return;
    on = v;
    if (v) root.setAttribute("data-theme", "stat"); else root.removeAttribute("data-theme");
  }
  function logoHit() {
    if (window.__statHit) return window.__statHit;
    var img = stat && stat.querySelector(".static.stat");
    if (!img || getComputedStyle(img).display === "none") return null;
    var r = img.getBoundingClientRect();
    return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, hw: r.width / 2, hh: r.height / 2 };
  }
  if (stat && root.classList.contains("hover")) {
    var mx = -1, my = -1, over = false, enterT = 0;
    var check = function () {
      var h = logoHit();
      var v = !!h && mx >= 0 && Math.abs(mx - h.cx) <= h.hw + HIT_PAD && Math.abs(my - h.cy) <= h.hh + HIT_PAD;
      if (v === over) return;
      over = v; clearTimeout(enterT);
      if (v) enterT = setTimeout(function () { setTheme(true); }, 150); else setTheme(false);
    };
    addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") { mx = e.clientX; my = e.clientY; check(); } }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { mx = my = -1; check(); });
    addEventListener("scroll", check, { passive: true });
    addEventListener("blur", function () { mx = my = -1; check(); });
  } else if (stat && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { setTheme(e.isIntersecting); }); },
      { rootMargin: "-50% 0px -50% 0px" }).observe(stat);
  }

  // для автотестов
  window.__produkty = { theme: function () { return on; }, lenis: !!lenis };
})();
