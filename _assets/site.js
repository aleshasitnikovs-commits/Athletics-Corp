// Общее для всех страниц (подключается в <head> синхронно, после header.js):
//  1. Яндекс.Метрика 110365930 - тот же счётчик и те же настройки, что на старом сайте («Сайт на Cloude Code»).
//  2. Цели: window.acGoal(имя, затем) - reachGoal и переход после ответа Метрики (не дольше 600 мс).
//     full_request  - отправлена заявка на анализ (форма на /analiz-osanki/, analiz.js);
//     lite_submit   - отправлены фото LITE (окно LITE на /analiz-osanki/, analiz.js);
//     telegram_click - клик по любой ссылке на t.me (здесь, для всех страниц).
//  3. Плашки внизу экрана:
//     - cookie (как на старом сайте, cookie-consent.js): до нажатия «Понятно», запоминается в localStorage;
//     - «Сайт обновляется» - на живых страницах (на <html> нет класса dev-page), после первой прокрутки,
//       крестик закрывает до конца сессии (sessionStorage).
//     Обе плашки - одна полоса снизу: сначала cookie, потом «обновляем». На телефоне страница получает отступ
//     снизу на высоту полосы - кнопки внизу не перекрываются.
(function () {
  var ID = 110365930, TG = 'https://t.me/athleticscorpmsc';
  var d = document, root = d.documentElement;
  // адрес политики cookie - от адреса этого файла (/_assets/site.js -> /cookies/), на любой глубине страницы
  var COOKIES = d.currentScript ? new URL('../cookies/', d.currentScript.src).pathname : '/cookies/';

  // ---------------------------------------------------------- Метрика
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < d.scripts.length; j++) { if (d.scripts[j].src === r) { return; } }
    k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a);
  })(window, d, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + ID, 'ym');
  ym(ID, 'init', { ssr: true, webvisor: true, clickmap: true, ecommerce: 'dataLayer', referrer: d.referrer, url: location.href, accurateTrackBounce: true, trackLinks: true });

  window.acGoal = function (name, then) {
    var done = false;
    function go() { if (!done) { done = true; if (then) then(); } }
    try { ym(ID, 'reachGoal', name, {}, go); } catch (e) { }
    if (then) setTimeout(go, 600); else go();
  };
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="t.me/"]');
    if (a) window.acGoal('telegram_click');
  }, true);

  // ---------------------------------------------------------- плашки
  var store = function (s, k, v) { try { if (v === undefined) return window[s].getItem(k); window[s].setItem(k, v); } catch (e) { return null; } };
  function mount() {
    var css = d.createElement('style');
    css.textContent =
      '#acBar{position:fixed;left:0;right:0;bottom:0;z-index:28;display:flex;flex-direction:column;pointer-events:none;' +
      'font:400 13px/1.45 "Golos Text","Segoe UI",system-ui,sans-serif;color:#C9C6BE}' +
      '#acBar .row{pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:16px;padding:10px 52px 10px 20px;' +
      'background:rgba(10,10,8,.92);border-top:1px solid rgba(242,240,235,.12);position:relative;' +
      'transform:translateY(100%);opacity:0;transition:transform .45s cubic-bezier(.2,.7,.2,1),opacity .45s}' +
      '#acBar .row.show{transform:none;opacity:1}' +
      '#acBar p{margin:0;max-width:72ch;text-align:center}' +
      '#acBar a{color:#F2F0EB;text-decoration:underline;text-decoration-color:rgba(242,240,235,.4);text-underline-offset:.2em}' +
      '#acBar .ok{flex:none;font:600 12px/1 "Golos Text",system-ui,sans-serif;padding:8px 14px;border:1px solid rgba(242,240,235,.4);background:none;color:#F2F0EB;border-radius:2px;cursor:pointer}' +
      '#acBar .x{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;background:none;color:#C9C6BE;cursor:pointer;font-size:18px;line-height:1}' +
      '#acBar .x:hover,#acBar .ok:hover{color:#fff;border-color:#F2F0EB}' +
      '@media (max-width:640px){#acBar .row{padding:10px 46px 10px 14px;gap:10px;font-size:12.5px}#acBar p{text-align:left}}' +
      '@media (prefers-reduced-motion:reduce){#acBar .row{transition:none}}';
    d.head.appendChild(css);
    var bar = d.createElement('div'); bar.id = 'acBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Уведомления сайта');
    d.body.appendChild(bar);
    function pad() { if (innerWidth < 861) d.body.style.paddingBottom = bar.offsetHeight + 'px'; else d.body.style.paddingBottom = ''; }
    function row(html, closeLabel, onClose, button) {
      var r = d.createElement('div'); r.className = 'row';
      r.innerHTML = '<p>' + html + '</p>' + (button ? '<button class="ok" type="button">' + button + '</button>' : '<button class="x" type="button" aria-label="' + closeLabel + '">✕</button>');
      r.querySelector('button').addEventListener('click', function () { onClose(); r.classList.remove('show'); setTimeout(function () { r.remove(); pad(); }, 450); });
      bar.appendChild(r);
      requestAnimationFrame(function () { requestAnimationFrame(function () { r.classList.add('show'); pad(); }); });
      return r;
    }
    // cookie - как на старом сайте: до подтверждения, на всех страницах
    if (store('localStorage', 'ac_cookie_notice_seen') !== '1')
      row('Сайт использует файлы cookie для аналитики (Яндекс.Метрика), чтобы улучшать сайт. Подробнее: <a href="' + COOKIES + '">политика cookie</a>.',
        '', function () { store('localStorage', 'ac_cookie_notice_seen', '1'); }, 'Понятно');
    // «Сайт обновляется» - только на живых страницах, после первой прокрутки
    if (!root.classList.contains('dev-page') && store('sessionStorage', 'ac_update_notice_closed') !== '1') {
      var shown = false;
      var show = function () {
        if (shown || (window.scrollY || 0) < 40) return; shown = true; removeEventListener('scroll', show);
        var r = row('Мы обновляем сайт. Если что-то не работает, напишите нам в <a href="' + TG + '" target="_blank" rel="noopener">Telegram</a>.',
          'Закрыть уведомление', function () { store('sessionStorage', 'ac_update_notice_closed', '1'); });
        bar.insertBefore(r, bar.firstChild);
      };
      addEventListener('scroll', show, { passive: true });
    }
    addEventListener('resize', pad);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount); else mount();
})();
