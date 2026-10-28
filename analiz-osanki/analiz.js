// Страница «Анализ осанки»: плавная прокрутка (Lenis), построчные заголовки,
// прогресс экранов для позвоночника (window.SP), форма записи (Formspree) и LITE (загрузка двух фото).
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
  var fFormat = document.getElementById("fFormat");
  document.querySelectorAll("[data-format]").forEach(function (a) {
    a.addEventListener("click", function () { fFormat.value = a.getAttribute("data-format"); });
  });
  function fErr(t) { fStatus.textContent = t; fStatus.classList.add("err"); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    fStatus.classList.remove("err");
    var name = document.getElementById("fName").value.trim();
    var contact = document.getElementById("fContact").value.trim();
    var consentData = document.getElementById("fConsentData").checked;
    var consentAds = document.getElementById("fConsentAds").checked;
    if (!name || !contact) return fErr("Заполните имя и телефон или Telegram.");
    if (!consentData) return fErr("Подтвердите согласие на обработку персональных данных.");
    var b = document.getElementById("fSubmit");
    b.disabled = true; b.textContent = "Отправляем…";
    fetch(FORMSPREE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: name, contact: contact, format: fFormat.value, consent_ads: consentAds ? "да" : "нет",
        page: "analiz-osanki", _subject: "Запись на анализ осанки, Атлетикс Корп",
      }),
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
      .then(function (x) {
        if (x.r.ok && (x.d.ok || x.d.next || x.r.status === 200)) {
          // цель Метрики «заявка на анализ» (_assets/site.js), переход - после её отправки
          var go = function () { location.href = "../spasibo-analiz/"; };
          if (window.acGoal) window.acGoal("full_request", go); else go();
          return;
        }
        throw new Error("formspree " + x.r.status);
      })
      .catch(function () {
        b.disabled = false; b.textContent = "Записаться · 2 000 ₽";
        fErr("Не получилось отправить. Напишите напрямую: ac@athleticscorp.ru");
      });
  });

  // ---------------------------------------------------------------- LITE: окно, фото, отправка
  var lite = document.getElementById("lite");
  function openLite() { lite.classList.add("open"); document.body.style.overflow = "hidden"; if (window.__lenis) window.__lenis.stop(); }
  function closeLite() { lite.classList.remove("open"); document.body.style.overflow = ""; if (window.__lenis) window.__lenis.start(); }
  document.querySelectorAll("[data-lite]").forEach(function (b) { b.addEventListener("click", openLite); });
  lite.querySelectorAll("[data-lite-close]").forEach(function (b) { b.addEventListener("click", closeLite); });
  addEventListener("keydown", function (e) { if (e.key === "Escape") closeLite(); });
  if (location.hash === "#lite") openLite();

  var SUPABASE_URL = "https://ttiumewnkdwzfleyobqe.supabase.co";              // с живого сайта
  var SUPABASE_KEY = "sb_publishable_hB8eRMx1a6z-soXKM4CgTw_SEpSiz2Q";        // публичный ключ, с живого сайта
  var files = [];
  var dz = document.getElementById("liteDz"), input = document.getElementById("liteFile");
  var thumbs = document.getElementById("liteThumbs"), lStatus = document.getElementById("liteStatus");
  function lMsg(t, err) { lStatus.textContent = t; lStatus.classList.toggle("err", !!err); }
  dz.addEventListener("click", function () { input.click(); });
  dz.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
  ["dragover", "dragenter"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("drag"); }); });
  ["dragleave", "dragend"].forEach(function (ev) { dz.addEventListener(ev, function () { dz.classList.remove("drag"); }); });
  dz.addEventListener("drop", function (e) {
    e.preventDefault(); dz.classList.remove("drag");
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  function addFiles(list) {
    for (var i = 0; i < list.length; i++) {
      if (files.length >= 2) { lMsg("Достаточно двух фото, лишние не добавлены."); break; }
      if (list[i].type.indexOf("image/") === 0) files.push(list[i]);
    }
    render();
  }
  function render() {
    thumbs.innerHTML = "";
    files.forEach(function (f, i) {
      var url = URL.createObjectURL(f), el = document.createElement("div");
      el.className = "thumb";
      var img = document.createElement("img"); img.src = url; img.alt = "Фото " + (i + 1);
      var rm = document.createElement("button"); rm.type = "button"; rm.textContent = "✕"; rm.setAttribute("aria-label", "Удалить фото");
      rm.addEventListener("click", function () { URL.revokeObjectURL(url); files.splice(i, 1); render(); });
      el.appendChild(img); el.appendChild(rm); thumbs.appendChild(el);
    });
    thumbs.classList.toggle("has", files.length > 0);
  }
  // сжатие как на живом сайте: до 1800 px по большей стороне и до 2 МБ, JPEG
  function compress(file, maxBytes, maxDim) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxDim || h > maxDim) { var s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        var q = 0.86;
        (function enc() {
          c.toBlob(function (b) {
            if (!b) return rej(new Error("Не удалось обработать изображение"));
            if (b.size <= maxBytes || q <= 0.35) res(b); else { q -= 0.12; enc(); }
          }, "image/jpeg", q);
        })();
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Не удалось загрузить изображение")); };
      img.src = url;
    });
  }
  // те же два действия, что делала библиотека supabase-js на живом сайте, напрямую через API Supabase:
  // загрузка в хранилище photos (папка lite/) и строка в таблице submissions
  var SB_HEADERS = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
  function sbUpload(path, blob) {
    return fetch(SUPABASE_URL + "/storage/v1/object/photos/" + path, {
      method: "POST", headers: Object.assign({ "Content-Type": "image/jpeg", "x-upsert": "false" }, SB_HEADERS), body: blob,
    }).then(function (r) { if (!r.ok) throw new Error("upload " + r.status); });
  }
  function sbInsert(row) {
    return fetch(SUPABASE_URL + "/rest/v1/submissions", {
      method: "POST", headers: Object.assign({ "Content-Type": "application/json", Prefer: "return=minimal" }, SB_HEADERS), body: JSON.stringify(row),
    }).then(function (r) { if (!r.ok) throw new Error("insert " + r.status); });
  }
  document.getElementById("liteForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var name = document.getElementById("liteName").value.trim();
    var contact = document.getElementById("liteContact").value.trim();
    var consent = document.getElementById("liteConsent").checked;
    if (!name || !contact) return lMsg("Заполните имя и телефон или Telegram.", true);
    if (files.length < 2) return lMsg("Прикрепите оба фото: спереди или сзади и сбоку.", true);
    if (!consent) return lMsg("Подтвердите согласие на обработку фотографий для скрининга осанки.", true);
    var b = document.getElementById("liteSubmit");
    b.disabled = true; b.textContent = "Отправляем…"; lMsg("Сжимаем и загружаем фото…");
    try {
      var paths = [];
      for (var i = 0; i < files.length; i++) {
        var blob = await compress(files[i], 2 * 1024 * 1024, 1800);
        var path = "lite/" + Date.now() + "-" + Math.random().toString(36).slice(2, 9) + "-" + (i + 1) + ".jpg";
        await sbUpload(path, blob);
        paths.push(path);
      }
      await sbInsert({ name: name, contact: contact, photo_urls: paths });
      // цель Метрики «LITE: фото отправлены» (_assets/site.js), переход - после её отправки
      var go = function () { location.href = "../spasibo-lite/"; };
      if (window.acGoal) window.acGoal("lite_submit", go); else go();
    } catch (err) {
      console.warn("LITE: отправка не прошла", err);
      b.disabled = false; b.textContent = "Отправить фото на разбор";
      lMsg("Не получилось отправить. Попробуйте ещё раз или напишите на ac@athleticscorp.ru", true);
    }
  });
})();
