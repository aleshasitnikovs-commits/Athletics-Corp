// Страницы «Спасибо», юридические заглушки, 404.
import { page, sec } from './_generate.mjs';
import { headerHtml, headLinks, iconLink } from './_header-template.mjs';

const R1 = '../';

function thanks(slug, title, backLabel, backUrl, goalNote){
  page({
    path: `spasibo-${slug}/`, rel: R1,
    title: `Спасибо: ${title} | Атлетикс Корп`,
    desc: 'Заявка получена.',
    noIndex: true,
    body: `
${sec('', 'страница благодарности', null, `
  <h1>Спасибо, заявка получена</h1>
  <p>Мы свяжемся с вами в ближайшее время.</p>
  <a class="btn p" href="${backUrl}" style="margin-top:10px;display:inline-block">${backLabel}</a>`,
  `Технический смысл страницы: отдельный URL под цель Яндекс.Метрики (${goalNote}). Своей формы на этой странице нет, сюда только переходят после отправки формы на «${title}».`)}
`,
  });
}

thanks('analiz', 'Анализ осанки', 'На главную', '../index.html', 'цель full_request');
thanks('lite', 'LITE-анализ', 'На главную', '../index.html', 'цель lite_submit');
thanks('biznes', 'Для бизнеса', 'К странице «Для бизнеса»', '../biznes/', 'заявка на пилот');
thanks('specialistam', 'Специалистам', 'К странице «Специалистам»', '../specialistam/', 'заявка на мастер-класс');
thanks('partnery', 'Партнёрам', 'К странице «Партнёрам»', '../partneram/', 'предложение партнёрства');
thanks('investory', 'Инвесторам', 'К странице «Инвесторам»', '../investoram/', 'запрос разговора');
thanks('karera', 'Карьера', 'К странице «Карьера»', '../karera/', 'отклик на задачи');

// ===================================================== ЮРИДИЧЕСКИЕ =======
function legal(slug, title){
  page({
    path: `${slug}/`, rel: R1,
    title: `${title} | Атлетикс Корп`,
    desc: title,
    body: `
${sec('', 'юридический документ', null, `
  <h1>${title}</h1>
  <div class="ph" style="min-height:140px">Текст уже готов и опубликован на живом сайте athleticscorp.ru (финальная редакция 15.07.2026, юридический аудит формулировок пройден 30.08.2026). На этапе 1 текст не переносится заново, переносится без изменений при публикации</div>`,
  `Источник правды: живой сайт («Сайт на Cloude Code», только чтение). Менять формулировки без повторной юридической проверки нельзя, паспорт сайта §6.`)}
`,
  });
}
legal('privacy-policy', 'Политика конфиденциальности');
legal('personal-data-policy', 'Политика обработки персональных данных');
legal('oferta', 'Публичная оферта');
legal('disclaimer', 'Дисклеймер');
legal('consent-photo', 'Согласие на обработку фотографий для скрининга осанки');
legal('advertising-consent', 'Согласие на рекламную рассылку');

// cookies.html отдельно: на живом сайте его редакция не обновлялась с 30.08,
// это уже отмечено как долг в паспорте §9, несу этот факт в заглушку явно.
page({
  path: 'cookies/', rel: R1,
  title: 'Использование файлов cookie | Атлетикс Корп',
  desc: 'Использование файлов cookie',
  body: `
${sec('', 'юридический документ', null, `
  <h1>Использование файлов cookie</h1>
  <div class="ph" style="min-height:140px">Текст есть на живом сайте, но это старый черновик от 30.08.2026, не обновлялся вместе с остальным юрконтуром 15.07</div>`,
  `Паспорт сайта §6: «обновление cookies.html (старый черновик на 30.08)» это долг, не закрытый на живом сайте. Перенести с проверкой, не как остальные 6 документов.`)}
`,
});

// ================================================================ 404 ====
import { writeFileSync } from 'node:fs';
const html404 = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Страница не найдена | Атлетикс Корп</title>
<link rel="stylesheet" href="_assets/skeleton.css">
${iconLink('')}
${headLinks('')}
</head>
<body>
<div class="draft-flag">Сайт 2.0 · черновой каркас · не публикуется</div>
${headerHtml('')}
<div class="wrap" style="padding:60px 20px">
  <div class="docbar mono">Сайт 2.0 · черновой каркас · 404.html</div>
  <h1>Такой страницы нет</h1>
  <p>Проверьте адрес или начните с главной.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
    <a class="btn p" href="index.html">На главную</a>
    <a class="btn" href="analiz-osanki/">Анализ осанки</a>
    <a class="btn" href="znaniya/">Знания</a>
  </div>
  <span class="note" style="margin-top:20px;display:inline-block">Лежит в корне как <code>404.html</code>: стандартное место для автоматической обработки ошибок у статических хостингов (в т.ч. GitHub Pages, на котором сейчас живёт athleticscorp.ru).</span>
</div>
</body>
</html>
`;
writeFileSync('404.html', html404, 'utf8');
console.log('written 404.html');

console.log('--- служебные страницы готовы ---');
