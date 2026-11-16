// Страница «Анализ осанки»: плавная прокрутка (Lenis), построчные заголовки,
// прогресс экранов для позвоночника (window.SP) и форма записи (Formspree).
// Логика форм перенесена с живого сайта (Сайт на Cloude Code/index.html); адреса и ключ - оттуда же.
(function () {
  var root = document.documentElement;
  var isStatic = root.classList.contains("reduce") || root.classList.contains("no-webgl");

  // шапка и меню - общие, _assets/header.js (прятанье при прокрутке берёт события Lenis отсюда)

  // ---------------------------------------------------------------- прогресс экранов для позвоночника
  // w3 - вход в экран 03 (доворот, цикл изгиба), w4 - вход в экран 04 (профиль, метки).
  // Исчезновение перед экраном 05 spine-page.js считает сам по положению #s05, без задержки scrub.
  var SP = window.SP = { w3: 0, w4: 0, ready: false };

  if (!isStatic && typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    if (typeof SplitText !== "undefined") gsap.registerPlugin(SplitText);
    if (typeof Lenis !== "undefined") {
      var lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      window.__lenis = lenis;
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var id = a.getAttribute("href");
          if (id.length < 2) return;
          var t = document.querySelector(id);
          if (!t) return;
          e.preventDefault();
          lenis.scrollTo(t, { duration: 1.4, offset: -40 });
        });
      });
    }
    function scrubbed(trigger, start, end, key) {
      var proxy = { p: 0 };
      gsap.to(proxy, {
        p: 1, ease: "none",
        onUpdate: function () { SP[key] = proxy.p; },
        scrollTrigger: { trigger: trigger, start: start, end: end, scrub: 1 },
      });
    }
    scrubbed("#s03", "top 85%", "top 35%", "w3");
    scrubbed("#s04", "top 80%", "top 45%", "w4");
    SP.ready = true;

    // заголовки экранов выезжают построчно снизу из-под маски, как на главной (один раз, при входе)
    if (typeof SplitText !== "undefined") {
      document.querySelectorAll("h2.rv").forEach(function (h) {
        var st = { shown: false, lines: [] };
        SplitText.create(h, {
          type: "lines", mask: "lines", linesClass: "rv-line", autoSplit: true,
          onSplit: function (self) { st.lines = self.lines; gsap.set(self.lines, { yPercent: st.shown ? 0 : 100 }); },
        });
        ScrollTrigger.create({
          trigger: h, start: "top 88%", once: true,
          onEnter: function () {
            st.shown = true;
            gsap.fromTo(st.lines, { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 });
          },
        });
      });
    }
  }

  // ---------------------------------------------------------------- форма записи (Formspree)
  var FORMSPREE = "https://formspree.io/f/mlgvapod";   // адрес формы с живого сайта
  var form = document.getElementById("bookForm"), fStatus = document.getElementById("fStatus");
  var b = document.getElementById("fSubmit");
  var format = document.getElementById("fFormat");
  document.querySelectorAll("a[data-format]").forEach(function (link) {
    link.addEventListener("click", function () {
      format.value = link.dataset.format;
    });
  });
  function fErr(t) { fStatus.textContent = t; fStatus.classList.add("err"); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (b.disabled) return;
    fStatus.textContent = "";
    fStatus.classList.remove("err");
    var name = document.getElementById("fName").value.trim();
    var contact = document.getElementById("fContact").value.trim();
    var consentData = document.getElementById("fConsentData").checked;
    var consentAds = document.getElementById("fConsentAds").checked;
    var option = format.selectedOptions[0];
    var price = Number(option && option.dataset.priceRub);
    if (!format.value || !Number.isFinite(price) || price <= 0) {
      format.focus();
      return fErr("Выберите формат анализа.");
    }
    if (!name || !contact) return fErr("Заполните имя и телефон или Telegram.");
    if (!consentData) return fErr("Подтвердите согласие на обработку персональных данных.");
    var submitLabel = b.textContent;
    b.disabled = true; b.textContent = "Отправляем…";
    fetch(FORMSPREE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: name, contact: contact, format: option.value,
        price: price, currency: "RUB", consent_ads: consentAds ? "да" : "нет",
        page: "analiz-osanki", _subject: "Запись на анализ осанки, Атлетикс Корп",
      }),
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
      .then(function (x) {
        if (x.r.ok && x.d.ok !== false && (x.d.ok === true || x.d.next)) {
          // цель Метрики «заявка на анализ» (_assets/site.js), переход - после её отправки
          var go = function () { location.href = "../spasibo-analiz/"; };
          if (window.acGoal) window.acGoal("full_request", go); else go();
          return;
        }
        throw new Error("formspree " + x.r.status);
      })
      .catch(function () {
        b.disabled = false; b.textContent = submitLabel;
        fErr("Не получилось отправить. Напишите напрямую: ac@athleticscorp.ru");
      });
  });

})();
