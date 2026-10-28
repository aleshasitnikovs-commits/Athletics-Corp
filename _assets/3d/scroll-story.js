// Иммерсивная история главной, 15.10. Скролл ведёт камеру и показывает/прячет текст глав.
// Без pin (scroll-jacking) — глава проигрывается по мере обычной прокрутки, по невидимым
// распоркам .story-trigger[data-chapter]. hero-scene.js читает window.CH.chN (0..1) в своём
// рендер-лупе.
//
// Этап 0, п.3: статичная раскладка (html.story-static) - нет WebGL, сцена упала или GSAP
// не загрузился. Тогда главы - обычные секции (CSS в index.html), этот скрипт их не прячет,
// цифры главы 7 показываются итоговыми, ссылка "Как устроена компания" ведёт на главу 2.
// Класс может появиться и позже, уже после инициализации (hero-scene.js упал на загрузке
// модели) - для этого событие "story:static".
(function () {
  var root = document.documentElement;
  function isStatic() {
    return root.classList.contains("story-static");
  }

  var nums = Array.prototype.slice.call(document.querySelectorAll(".ch7num"));
  function fmt(el, p) {
    var to = parseInt(el.dataset.to, 10),
      suf = el.dataset.suffix || "",
      approx = el.dataset.approx === "1";
    return (approx ? "≈" : "") + Math.round(to * p).toLocaleString("ru-RU") + suf;
  }
  function setNums(p) {
    nums.forEach(function (el) {
      el.textContent = fmt(el, p);
    });
  }
  var down = document.querySelector("#hero .down");
  // В статичной раскладке ScrollTrigger не нужен совсем. disable() важен не только для
  // порядка: сам ScrollTrigger при загрузке запускает бесконечный цикл rAF (_rafBugFix),
  // который при prefers-reduced-motion крутился бы ~60 раз в секунду впустую (этап 0, п.4).
  function goStatic() {
    if (down) down.setAttribute("href", "#ch2panel");
    setNums(1);
    if (typeof ScrollTrigger !== "undefined" && ScrollTrigger.disable) ScrollTrigger.disable();
  }
  document.addEventListener("story:static", goStatic);

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    root.classList.add("story-static");
    goStatic();
    return;
  }
  if (isStatic()) {
    goStatic();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if (typeof SplitText !== "undefined") gsap.registerPlugin(SplitText);

  window.CH = { ch2: 0, ch3: 0, ch4: 0, ch5: 0, ch6: 0, ch7: 0 };

  // Плавность, п.1: Lenis - инерционная прокрутка колесом, по официальной схеме с GSAP
  // (один общий тикер, ScrollTrigger обновляется от Lenis). На тач-устройствах родная
  // прокрутка (syncTouch:false). При prefers-reduced-motion и без WebGL сюда не доходим:
  // статичная раскладка выходит выше, там прокрутка родная.
  var lenis = null;
  if (typeof Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) {
      lenis.raf(t * 1000);
    });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
    // Якорь "Как устроена компания" - через lenis.scrollTo, а не прыжком браузера.
    if (down)
      down.addEventListener("click", function (e) {
        var target = document.querySelector(down.getAttribute("href"));
        if (!target || isStatic()) return;
        e.preventDefault();
        lenis.scrollTo(target, { duration: 1.6 });
      });
  }

  // Плавность, п.2: прогресс глав с инерцией. У этих ScrollTrigger нет своей анимации -
  // числовой scrub на голом ScrollTrigger ничего бы не сгладил (onUpdate получает сырой
  // self.progress). Поэтому прогресс ведёт прокси-твин {p:0 -> 1} со scrub: 1: значение
  // догоняет прокрутку за ~1 с, и по нему считаются и window.CH (камера и параметры сцены
  // в hero-scene.js), и прозрачность текста. Твины создаются один раз, в обработчиках
  // только запись чисел/стилей.
  var SCRUB = 1;
  function scrubbed(trigger, onProgress) {
    var proxy = { p: 0 };
    gsap.to(proxy, {
      p: 1,
      ease: "none",
      onUpdate: function () {
        onProgress(proxy.p);
      },
      // top top / bottom top: диапазон прогресса 0..1 ровно по высоте распорки главы,
      // без запаса в целый экран с каждой стороны (так было с "top bottom"/"bottom top" —
      // соседние главы перекрывались и тексты читались друг на друге).
      scrollTrigger: { trigger: trigger, start: "top top", end: "bottom top", scrub: SCRUB },
    });
  }

  // Плавность, п.4: заголовки глав выезжают построчно снизу из-под маски, когда панель
  // главы становится видимой (yPercent 100 -> 0, 0.9 с, power3.out, шаг 0.08 с между
  // строками); когда панель гаснет - строки уходят обратно вниз, к следующему появлению.
  // Строки режет SplitText (mask: lines), autoSplit пересобирает их при смене ширины и
  // после загрузки шрифтов - положение (показан/скрыт) при этом сохраняется.
  // В статичной раскладке (без WebGL, reduced motion) заголовки не режутся вообще, а если
  // она включилась позже (сцена упала) - разбиение откатывается, текст обычный.
  var reveals = [];
  function setupReveal(panel) {
    if (typeof SplitText === "undefined") return null;
    var h = panel.querySelector(".ch3-text h2, .ch2-text .bridge-line");
    if (!h) return null;
    var st = { lines: [], shown: false, tween: null, split: null };
    st.split = SplitText.create(h, {
      type: "lines",
      mask: "lines",
      linesClass: "rv-line",
      autoSplit: true,
      onSplit: function (self) {
        st.lines = self.lines;
        if (st.tween) st.tween.kill();
        gsap.set(self.lines, { yPercent: st.shown ? 0 : 100 });
      },
    });
    reveals.push(st);
    return st;
  }
  function showReveal(st, on) {
    if (!st || st.shown === on) return;
    st.shown = on;
    if (st.tween) st.tween.kill();
    if (on) st.tween = gsap.fromTo(st.lines, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 });
    else { st.tween = null; gsap.set(st.lines, { yPercent: 100 }); }
  }
  document.addEventListener("story:static", function () {
    reveals.forEach(function (st) {
      if (st.tween) st.tween.kill();
      st.split.revert();
    });
  });

  function wireChapter(chapterNum, panelSel, key, fadeInStart, fadeOutEnd) {
    var panel = document.querySelector(panelSel);
    var trigger = document.querySelector('.story-trigger[data-chapter="' + chapterNum + '"]');
    if (!panel || !trigger) return;
    var rv = setupReveal(panel);
    // fadeInStart сдвигает начало появления текста главы - нужно главе 2, чтобы между
    // полным уходом заголовка первого экрана и началом текста главы 2 был зазор, а не
    // наложение (баг 15.10: оба текста читались одновременно).
    // fadeOutEnd (чистка 16.10, пункт D15) сдвигает конец затухания РАНЬШЕ конца диапазона
    // главы - нужно главе 7, чтобы текст полностью погас заметно до того, как главу сменит
    // старый статичный контент, без огромного пустого буфера после.
    var fi = fadeInStart || 0, fo = fadeOutEnd || 1;
    scrubbed(trigger, function (p) {
      window.CH[key] = p;
      if (isStatic()) return;
      var span = fo - fi;
      var q = Math.max(0, Math.min(1, (p - fi) / span));
      var o = q < 0.22 ? q / 0.22 : q > 0.78 ? (1 - q) / 0.22 : 1;
      o = Math.max(0, Math.min(1, o));
      panel.style.opacity = o.toFixed(3);
      panel.classList.toggle("on", o > 0.08);
      showReveal(rv, o > 0.08);
    });
  }

  // Этап 0, п.2: заголовок первого экрана виден с первой отрисовки (CSS) и уходит только
  // по скроллу в главу 2 - резко, к 10% её диапазона, до того как проявится текст главы 2
  // (fadeInStart .16 ниже). Раньше это считал hero-scene.js в рендер-цикле, т.е. без
  // WebGL и до загрузки Three.js заголовок не управлялся вообще.
  (function () {
    var hero = document.getElementById("hero");
    var t2 = document.querySelector('.story-trigger[data-chapter="2"]');
    if (!hero || !t2) return;
    scrubbed(t2, function (p) {
      if (isStatic()) return;
      var x = Math.min(1, p / 0.1);
      var o = 1 - x * x * (3 - 2 * x);
      hero.style.opacity = o.toFixed(3);
      hero.classList.toggle("off", o < 0.5);
    });
  })();

  wireChapter(2, "#ch2panel", "ch2", 0.16);
  // Чистка 16.10, пункт C9: заголовок главы 3 раньше проявлялся сразу поверх ног фигуры
  // (ещё крупных на входе в главу) - небольшая задержка появления текста, пока камера/
  // прогресс главы уже отъехали и фигура видна целиком, а не только ногами крупным планом.
  wireChapter(3, "#ch3panel", "ch3", 0.12);
  wireChapter(4, "#ch4panel", "ch4", 0);
  wireChapter(5, "#ch5panel", "ch5", 0);
  wireChapter(6, "#ch6panel", "ch6", 0);
  wireChapter(7, "#ch7panel", "ch7", 0, 0.82);

  // Глава 7: цифры считаются вверх в такт прогрессу (держим на 30-80% диапазона главы,
  // чтобы досчитать и до, и после ещё было видно текст). В разметке стоят итоговые
  // значения (их видно без JS и в статичной раскладке); счёт с нуля - только здесь.
  (function () {
    var trigger = document.querySelector('.story-trigger[data-chapter="7"]');
    if (!trigger || !nums.length) return;
    setNums(0);
    scrubbed(trigger, function (p) {
      if (isStatic()) return setNums(1);
      setNums(Math.max(0, Math.min(1, (p - 0.3) / 0.5)));
    });
  })();
})();
