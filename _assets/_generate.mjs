// Генератор серого каркаса. Разовый офлайн-инструмент подготовки файлов
// (как npx gltf-transform в соседнем проекте) — результат это обычные
// статические HTML-файлы, никакого сборщика в рантайме сайта нет.
// Запуск: node _assets/_generate.mjs из папки "Сайт 2.0".
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// шапка и меню - общий шаблон сайта (задача 14), тот же, что вставляет _header-apply.mjs
import { headerHtml as siteHeader, headLinks, iconLink } from './_header-template.mjs';

function headerHtml(rel, path = ''){
  const seg = path.split('/')[0];
  return `<div class="draft-flag">Сайт 2.0 · черновой каркас · не публикуется</div>
${siteHeader(rel, seg ? seg + '/' : '')}`;
}

function footerHtml(rel, variant){
  // Главная не заканчивается призывом на консультацию — решение Алексея
  // 15.10: на главной вообще нет записи как главного действия, в том числе
  // в подвале. Остальные страницы консультацию в подвале сохраняют.
  const ctaRow = variant === 'home'
    ? `<div class="cta-row" style="align-items:flex-start">
      <div>
        <h3 style="margin-bottom:8px">Выберите маршрут</h3>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:14px">
          <a href="${rel}analiz-osanki/">Для себя</a>
          <a href="${rel}biznes/">Для бизнеса</a>
          <a href="${rel}partneram/">Партнёрам</a>
          <a href="${rel}investoram/">Инвесторам</a>
          <a href="${rel}karera/">Карьера</a>
        </div>
      </div>
    </div>`
    : `<div class="cta-row">
      <div><h3 style="margin-bottom:4px">Начните с понимания своего состояния</h3><p class="mut" style="margin:0;font-size:13.5px">Первичная консультация: анализ осанки и онлайн-разбор со специалистом.</p></div>
      <a href="${rel}analiz-osanki/#zapis" class="btn p">Записаться</a>
    </div>`;
  return `<footer class="site-ftr">
  <div class="wrap">
    ${ctaRow}
    <div class="cols">
      <div class="col"><h4>Атлетикс Корп</h4><ul>
        <li><a href="${rel}podhod/">Подход</a></li>
        <li><a href="${rel}produkty/">Продукты</a></li>
        <li><a href="${rel}znaniya/">Знания</a></li>
        <li><a href="${rel}kompaniya/">Компания</a></li>
      </ul></div>
      <div class="col"><h4>Маршруты</h4><ul>
        <li><a href="${rel}analiz-osanki/">Для себя</a></li>
        <li><a href="${rel}biznes/">Для бизнеса</a></li>
        <li><a href="${rel}partneram/">Партнёрам</a></li>
        <li><a href="${rel}investoram/">Инвесторам</a></li>
        <li><a href="${rel}karera/">Карьера</a></li>
        <li><a href="${rel}specialistam/">Специалистам</a></li>
      </ul></div>
      <div class="col"><h4>Рядом</h4><ul>
        <li><a href="https://стать.com" rel="noopener">СТАТЬ ↗</a></li>
        <li><a href="https://humanadapt.ru" rel="noopener">Институт ↗</a></li>
      </ul></div>
      <div class="col"><h4>Контакты</h4><ul>
        <li><a href="mailto:ac@athleticscorp.ru">ac@athleticscorp.ru</a></li>
        <li><a href="#" rel="noopener">Telegram</a></li>
        <li><a href="#" rel="noopener">Instagram</a></li>
      </ul></div>
    </div>
    <div class="legal">
      <span>© ООО «Атлетикс Корп»</span>
      <a href="${rel}privacy-policy/">Конфиденциальность</a>
      <a href="${rel}personal-data-policy/">Обработка ПДн</a>
      <a href="${rel}oferta/">Оферта</a>
      <a href="${rel}disclaimer/">Дисклеймер</a>
      <a href="${rel}consent-photo/">Согласие на фото</a>
      <a href="${rel}advertising-consent/">Согласие на рекламу</a>
      <a href="${rel}cookies/">Cookie</a>
      <span>Анализ немедицинский, не заменяет консультацию врача</span>
    </div>
  </div>
</footer>`;
}

function page({ path, title, desc, rel, body, noIndex, footerVariant }) {
  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${noIndex ? '<meta name="robots" content="noindex">\n' : ''}<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="stylesheet" href="${rel}_assets/skeleton.css">
${iconLink(rel)}
${headLinks(rel)}
</head>
<body>
${headerHtml(rel, path)}
<div class="wrap" style="padding-top:18px">
  <div class="docbar mono">Сайт 2.0 · черновой каркас · ${path}</div>
  <div class="ctrl"><button id="tn" aria-pressed="true">Пометки видны</button></div>
</div>
${body}
${footerHtml(rel, footerVariant)}
<script src="${rel}_assets/skeleton.js"></script>
</body>
</html>
`;
  const full = `${path}index.html`;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html, 'utf8');
  console.log('written', full);
}

function sec(num, tag, h2, inner, note){
  return `<section class="sec">
  <span class="tag mono">${num ? num+' · ' : ''}${tag}</span>
  ${h2 ? `<h2>${h2}</h2>` : ''}
  ${inner}
  ${note ? `<span class="note">${note}</span>` : ''}
</section>`;
}

export { page, sec, writeFileSync, mkdirSync };
