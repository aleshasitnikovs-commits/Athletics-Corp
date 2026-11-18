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
  // СТАТЬ становится светлым, пока занимает середину видимой области экрана.
  var stat = document.getElementById("p-stat");
  var on = false;
  if (stat) {
    var viewport = window.visualViewport;
    var themeFrame = 0;
    function updateTheme() {
      themeFrame = 0;
      var rect = stat.getBoundingClientRect();
      var center = viewport ? viewport.offsetTop + viewport.height / 2 : innerHeight / 2;
      var isActive = rect.top <= center && rect.bottom > center;
      if (isActive === on) return;
      on = isActive;
      if (on) root.dataset.theme = "stat";
      else delete root.dataset.theme;
    }
    function scheduleTheme() {
      if (!themeFrame) themeFrame = requestAnimationFrame(updateTheme);
    }
    addEventListener("scroll", scheduleTheme, { passive: true });
    addEventListener("resize", scheduleTheme);
    addEventListener("catalog:layout", scheduleTheme);
    addEventListener("pageshow", scheduleTheme);
    if (viewport) {
      viewport.addEventListener("resize", scheduleTheme);
      viewport.addEventListener("scroll", scheduleTheme);
    }
    updateTheme();
  }

  // для автотестов
  window.__produkty = { theme: function () { return on; }, lenis: !!lenis };
})();
