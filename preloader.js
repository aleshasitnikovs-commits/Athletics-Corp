(function () {
  'use strict';

  var pre = document.getElementById('pre');
  if (!pre) return;

  var STORAGE_KEY = 'ac_pre_shown';
  var done = false;

  function hideNow() {
    if (done) return;
    done = true;
    pre.style.transition = 'none';
    pre.style.opacity = '0';
    pre.style.display = 'none';
  }

  // Абсолютный предохранитель: оверлей уходит не позже, чем через 2.5с,
  // что бы ни случилось с остальным кодом ниже (ошибка, зависший таймер и т.п.).
  var fallback = setTimeout(hideNow, 2500);

  try {
    if (document.documentElement.classList.contains('no-pre')) {
      // Уже показывали в этой сессии — CSS уже скрыл оверлей, доп. работы не нужно.
      clearTimeout(fallback);
      done = true;
      return;
    }

    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var spine = document.getElementById('preSpine');
    var logo = document.getElementById('preLogo');

    function fadeOutOverlay() {
      pre.classList.add('pre-out');
      setTimeout(function () {
        hideNow();
        clearTimeout(fallback);
      }, 450);
    }

    if (reduced || !spine || !logo) {
      if (logo) logo.classList.add('show');
      setTimeout(fadeOutOverlay, 700);
      return;
    }

    var COUNT = 7;
    var STAGGER = 70;
    var SEG_DUR = 260;
    var WIDTHS = [58, 54, 50, 46, 42, 38, 34];

    for (var i = 0; i < COUNT; i++) {
      var v = document.createElement('div');
      v.className = 'vert';
      v.style.width = WIDTHS[i] + 'px';
      v.style.animationDelay = (i * STAGGER) + 'ms';
      spine.appendChild(v);
    }

    var buildTime = (COUNT - 1) * STAGGER + SEG_DUR;

    setTimeout(function () {
      spine.classList.add('pulse');
      setTimeout(function () {
        spine.classList.add('pre-exit');
        logo.classList.add('show');
        setTimeout(fadeOutOverlay, 400);
      }, 300);
    }, buildTime + 60);

  } catch (err) {
    hideNow();
    clearTimeout(fallback);
  }
})();
