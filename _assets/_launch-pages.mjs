// Страницы к запуску (задача 19): юридические документы, страницы «спасибо», 404, страницы «в разработке»
// и переадресации со старых адресов *.html. Пишет готовые HTML; шапку вставляет потом _header-apply.mjs
// (между <!-- header:start --> и <!-- header:end -->). Запуск из папки «Сайт 2.0»:
//   node _assets/_launch-pages.mjs && node _assets/_header-apply.mjs
// Юридические тексты - дословно со старого сайта: _каркас/юр-тексты/*.html (см. первую строку файлов).
// Прежние версии страниц «в разработке» сохранены в _каркас/до-запуска/ (на сайт не попадают).
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const W = (p, s) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), s); };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const TG = 'https://t.me/athleticscorpmsc';

function head({ rel, title, desc, path, noindex = false, extra = '' }) {
  return `<!doctype html>
<html lang="ru"${noindex ? ' class="dev-page"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">\n` : ''}${noindex ? '<meta name="robots" content="noindex">\n' : ''}${path !== null ? `<link rel="canonical" href="https://athleticscorp.ru/${path}">\n` : ''}<link rel="icon" type="image/png" href="${rel}_assets/img/favicon-ac-64.png">
<link rel="stylesheet" href="${rel}_assets/tokens.css">
<link rel="stylesheet" href="${rel}_assets/header.css">
<link rel="stylesheet" href="${rel}_assets/page.css">
<script src="${rel}_assets/header.js"></script>
<script src="${rel}_assets/site.js"></script>
${extra}</head>
<body>
<!-- header:start --><!-- header:end -->
`;
}
const foot = (rel) => `<footer class="ftr">
  <span>© 2026 Атлетикс Корп</span>
  <span>Анализ немедицинский, не заменяет консультацию врача</span>
  <span class="legal"><a href="${rel}privacy-policy/">Политика конфиденциальности</a><a href="${rel}personal-data-policy/">Согласие на обработку данных</a><a href="${rel}consent-photo/">Согласие на обработку фото</a><a href="${rel}oferta/">Публичная оферта</a><a href="${rel}cookies/">Cookie</a><a href="${rel}disclaimer/">Дисклеймер</a></span>
  <span class="contacts"><a href="${TG}" target="_blank" rel="noopener">Telegram</a><a href="mailto:ac@athleticscorp.ru">ac@athleticscorp.ru</a></span>
</footer>
`;

// ---------------------------------------------------------------- юридические документы
const LEGAL = ['privacy-policy', 'personal-data-policy', 'oferta', 'consent-photo', 'advertising-consent', 'cookies', 'disclaimer'];
for (const k of LEGAL) {
  const src = readFileSync(join(ROOT, '_каркас/юр-тексты', k + '.html'), 'utf8');
  const title = src.match(/<!-- title: (.*?) -->/)[1], desc = src.match(/<!-- description: (.*?) -->/)[1];
  // ссылки на соседние документы на старом сайте - от корня («/personal-data-policy»): делаем относительными
  // (../personal-data-policy/), чтобы работали и на тестовом адресе github.io; текст документа не меняется
  const body = src.split('\n').filter((l) => !l.startsWith('<!-- ')).join('\n')
    .replace(new RegExp(`href="/(${LEGAL.join('|')})(\\.html)?/?"`, 'g'), 'href="../$1/"');
  W(`${k}/index.html`, head({ rel: '../', title, desc, path: k + '/' }) + `<main class="doc">
<!-- Текст документа - дословно со старого сайта (_каркас/юр-тексты/${k}.html). Менять только после юридической проверки. -->
${body}
</main>
` + foot('../') + '</body>\n</html>\n');
}

// ---------------------------------------------------------------- спасибо
const THANKS = {
  'spasibo-analiz': ['Мы свяжемся с вами в ближайшее время.', '../', 'На главную'],
  'spasibo-lite': ['Специалист посмотрит фото и свяжется с вами в ближайшее время.', '../', 'На главную'],
  'spasibo-biznes': ['Мы свяжемся с вами в ближайшее время.', '../', 'На главную'],
  'spasibo-investory': ['Мы свяжемся с вами в ближайшее время.', '../', 'На главную'],
  'spasibo-karera': ['Мы свяжемся с вами в ближайшее время.', '../', 'На главную'],
  'spasibo-partnery': ['Мы свяжемся с вами в ближайшее время.', '../', 'На главную'],
  'spasibo-specialistam': ['Мы свяжемся с вами в ближайшее время.', '../', 'На главную'],
};
for (const [k, [txt, href, btn]] of Object.entries(THANKS)) {
  W(`${k}/index.html`, head({ rel: '../', title: 'Спасибо, заявка получена | Атлетикс Корп', desc: '', path: k + '/', noindex: false, extra: '<meta name="robots" content="noindex">\n' }) + `<main class="center">
  <div class="center-in">
    <span class="eyebrow">Заявка отправлена</span>
    <h1>Спасибо, заявка получена</h1>
    <p class="lead">${txt}</p>
    <div class="btns"><a class="btn" href="${href}">${btn}</a><a class="btn ghost" href="${TG}" target="_blank" rel="noopener">Написать в Telegram</a></div>
  </div>
</main>
` + foot('../') + '</body>\n</html>\n');
}

// ---------------------------------------------------------------- 404: адреса от корня сайта (страница отдаётся по любому адресу)
// <base> ставится до стилей: на github.io корень сайта - первый сегмент пути (/имя-репозитория/), на домене - «/»
// Стили и скрипты пишет тот же скрипт после <base>: иначе браузер успевает заранее запросить их по
// относительным путям от адреса ошибки (лишние 404 в консоли).
const BASE = `<script>(function(){var h=location.hostname,p=location.pathname.split('/');document.write('<base href="'+(/github\\.io$/.test(h)&&p[1]?'/'+p[1]+'/':'/')+'">'
 +'<link rel="icon" type="image/png" href="_assets/img/favicon-ac-64.png"><link rel="stylesheet" href="_assets/tokens.css"><link rel="stylesheet" href="_assets/header.css"><link rel="stylesheet" href="_assets/page.css">'
 +'<scr'+'ipt src="_assets/header.js"></scr'+'ipt><scr'+'ipt src="_assets/site.js"></scr'+'ipt>')})();</script>\n`;
const head404 = head({ rel: '', title: 'Страница не найдена | Атлетикс Корп', desc: '', path: null, extra: '<meta name="robots" content="noindex">\n' })
  .replace(/<link rel="(icon|stylesheet)"[^>]*>\n|<script src="_assets\/[^"]*"><\/script>\n/g, '').replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<!-- head:manual -->\n' + BASE);   // пометка для _header-apply.mjs
W('404.html', head404 + `<main class="center">
  <div class="center-in">
    <span class="eyebrow">Ошибка 404</span>
    <h1>Такой страницы нет</h1>
    <p class="lead">Проверьте адрес или начните с главной.</p>
    <div class="btns"><a class="btn" href="./">На главную</a><a class="btn ghost" href="analiz-osanki/">Анализ осанки</a></div>
  </div>
</main>
` + foot('') + '</body>\n</html>\n');

// ---------------------------------------------------------------- «в разработке»
// [путь, глубина, название раздела в строке «Скоро здесь будет …», title]
const DEV = [
  ['podhod', 'страница о нашем подходе', 'Подход'],
  ['kompaniya', 'страница о компании', 'Компания'],
  ['biznes', 'страница для бизнеса', 'Для бизнеса'],
  ['specialistam', 'страница для специалистов', 'Специалистам'],
  ['znaniya', 'раздел «Знания»', 'Знания'],
  ['znaniya/shablon-stati', 'статья', 'Знания'],
  ['partneram', 'страница для партнёров', 'Партнёрам'],
  ['investoram', 'страница для инвесторов', 'Инвесторам'],
  ['karera', 'страница о работе в команде', 'Карьера'],
];
for (const [p, what, title] of DEV) {
  const rel = '../'.repeat(p.split('/').length);
  const keep = join(ROOT, '_каркас/до-запуска', p, 'index.html');
  if (!existsSync(keep)) { mkdirSync(dirname(keep), { recursive: true }); cpSync(join(ROOT, p, 'index.html'), keep); }
  W(`${p}/index.html`, head({ rel, title: `${title}: страница в разработке | Атлетикс Корп`, desc: '', path: p + '/', noindex: true }) + `<main class="center dev">
  <div class="dev-stage" id="devStage" aria-hidden="true"><canvas id="devLogo"></canvas><div class="dev-static"></div></div>
  <div class="center-in">
    <h1>Страница в разработке</h1>
    <p class="lead">Скоро здесь будет ${what}. Пока можно начать с главного.</p>
    <div class="btns"><a class="btn" href="${rel}analiz-osanki/">Анализ осанки</a><a class="btn ghost" href="${TG}" target="_blank" rel="noopener">Написать в Telegram</a></div>
  </div>
</main>
` + foot(rel) + `<script type="importmap">
{ "imports": { "three": "${rel}_assets/vendor/three/three.module.min.js" } }
</script>
<script type="module" src="${rel}_assets/3d/dev-logo.js"></script>
</body>
</html>
`);
}

// ---------------------------------------------------------------- переадресации со старых адресов *.html
// GitHub Pages не умеет 301: страница с meta refresh, canonical и ссылкой; Метрика видит переход по referrer
const OLD = { 'oferta.html': 'oferta/', 'privacy-policy.html': 'privacy-policy/', 'personal-data-policy.html': 'personal-data-policy/',
  'consent-photo.html': 'consent-photo/', 'advertising-consent.html': 'advertising-consent/', 'cookies.html': 'cookies/', 'disclaimer.html': 'disclaimer/' };
for (const [from, to] of Object.entries(OLD)) {
  W(from, `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Страница переехала | Атлетикс Корп</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="https://athleticscorp.ru/${to}">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace('${to}' + location.hash);</script>
</head>
<body style="background:#0A0A08;color:#F2F0EB;font-family:system-ui,sans-serif">
<p>Страница переехала: <a href="${to}" style="color:#F2F0EB">${to}</a></p>
</body>
</html>
`);
}
console.log('ok', LEGAL.length, Object.keys(THANKS).length, DEV.length, Object.keys(OLD).length);
