// Шапка и полноэкранное меню - один шаблон на весь сайт (задача 14, ветка header-v2).
// Используют: _header-apply.mjs (вставка в готовые страницы) и генераторы каркаса _generate.mjs,
// _build-utility.mjs. Стили - _assets/header.css, поведение - _assets/header.js.
// rel - путь до корня сайта от страницы ('' , '../', '../../'); active - раздел страницы ('podhod/' ...).

// пункты в самой шапке (на компьютере)
export const HEADER_NAV = [
  ['Подход', 'podhod/'],
  ['Продукты', 'produkty/'],
  ['Анализ осанки', 'analiz-osanki/'],
  ['Компания', 'kompaniya/'],
];
// все пункты полноэкранного меню
export const MENU_NAV = [
  ['Подход', 'podhod/'],
  ['Продукты', 'produkty/'],
  ['Анализ осанки', 'analiz-osanki/'],
  ['Для бизнеса', 'biznes/'],
  ['Знания', 'znaniya/'],
  ['Компания', 'kompaniya/'],
  ['Партнёрам', 'partneram/'],
  ['Инвесторам', 'investoram/'],
  ['Карьера', 'karera/'],
];
export const EMAIL = 'ac@athleticscorp.ru';
// НУЖЕН ФАКТ: телефон или Telegram компании. На живом сайте и в «Сайт 2.0» их нет (есть только почта;
// «@athleticscorpmsc» встречается один раз в заметке со знаком вопроса). Не выдумывать. Когда будет -
// вписать сюда, например ['Telegram @...', 'https://t.me/...'], и перезапустить _header-apply.mjs.
export const CONTACT = null;

const cur = (u, active) => (u === active ? ' aria-current="page"' : '');

export function headerHtml(rel, active = '', extraClass = '') {
  const nav = HEADER_NAV.map(([t, u]) => `<a href="${rel}${u}"${cur(u, active)}>${t}</a>`).join('\n      ');
  const menu = MENU_NAV.map(([t, u], i) =>
    `<li style="--i:${i}"><a href="${rel}${u}"${cur(u, active)}><span>${t}</span></a></li>`).join('\n      ');
  const contact = CONTACT ? `<a href="${CONTACT[1]}">${CONTACT[0]}</a>\n    ` : '';
  return `<!-- header:start - шаблон _assets/_header-template.mjs, правки там, затем node _assets/_header-apply.mjs -->
<header id="hdr" class="hdr${extraClass ? ' ' + extraClass : ''}">
  <div class="hdr-in">
    <a class="hdr-logo" href="${rel || './'}" aria-label="Атлетикс Корп, на главную"><img src="${rel}_assets/img/logo-ac-light@2x.png" srcset="${rel}_assets/img/logo-ac-light@2x.png 2x, ${rel}_assets/img/logo-ac-light@3x.png 3x" width="48" height="24" alt="Атлетикс Корп"></a>
    <nav class="hdr-nav" aria-label="Основные разделы">
      ${nav}
    </nav>
    <a class="hdr-cta" href="${rel}analiz-osanki/#zapis">Записаться</a>
    <button class="hdr-menu" id="menuBtn" type="button" aria-label="Меню" aria-expanded="false" aria-controls="siteMenu"><i></i><i></i></button>
  </div>
</header>
<div class="smenu" id="siteMenu" role="dialog" aria-modal="true" aria-label="Меню сайта" hidden>
  <button class="smenu-close" type="button" aria-label="Закрыть меню"><i></i><i></i></button>
  <nav class="smenu-nav" aria-label="Все разделы">
    <ul>
      ${menu}
    </ul>
  </nav>
  <div class="smenu-foot">
    ${contact}<a href="mailto:${EMAIL}">${EMAIL}</a>
  </div>
</div>
<!-- header:end -->`;
}

// подключение в <head>: стили и скрипт (скрипт маленький, синхронный - вариант шапки ставится до отрисовки)
export function headLinks(rel) {
  return `<link rel="stylesheet" href="${rel}_assets/header.css">
<script src="${rel}_assets/header.js"></script>`;
}

// значок вкладки - тот же, что на главной (каркас-страницы были без него, браузер просил /favicon.ico и получал 404)
export function iconLink(rel) {
  return `<link rel="icon" type="image/png" href="${rel}_assets/img/favicon-ac-64.png">`;
}
