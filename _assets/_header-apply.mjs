// Вставляет шапку и меню из _header-template.mjs во все страницы сайта. Можно запускать сколько угодно
// раз: в странице заменяется только блок между <!-- header:start --> и <!-- header:end -->.
// В первый раз заменяет старую шапку (<header>…</header>, старое мобильное меню #mobileMenu и его скрипт).
// Остальное содержимое страниц не трогает. Запуск из папки «Сайт 2.0»: node _assets/_header-apply.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { headerHtml, headLinks, iconLink, MENU_NAV } from './_header-template.mjs';

const ROOT = process.cwd();
// служебные папки: на сайт не попадают, своей шапки сайта у них нет
const SKIP = /^(_|\.|node_modules)/;
const pages = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP.test(n)) walk(p); }
    else if (n.endsWith('.html')) pages.push(p);
  }
})(ROOT);

const START = /<!-- header:start[\s\S]*?<!-- header:end -->/;
const OLD = /<header[\s\S]*?<\/header>(\s*<nav id="mobileMenu"[\s\S]*?<\/nav>)?(\s*<script>(?:(?!<\/script>)[\s\S])*?(?:menuBtn|mobileMenu)[\s\S]*?<\/script>)?/;
const report = [];
for (const file of pages) {
  const relPath = relative(ROOT, file).split(sep).join('/');
  const depth = relPath.split('/').length - 1;
  const rel = '../'.repeat(depth);
  const seg = depth ? relPath.split('/')[0] + '/' : '';
  const active = MENU_NAV.some(([, u]) => u === seg) ? seg : '';
  let s = readFileSync(file, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  let how;
  if (START.test(s)) {
    const pre = /<header id="hdr" class="hdr pre"/.test(s.match(START)[0]);
    s = s.replace(START, () => headerHtml(rel, active, pre ? 'pre' : ''));
    how = 'обновлена';
  } else if (OLD.test(s)) {
    const pre = /<header[^>]*class="[^"]*\bpre\b/.test(s.match(OLD)[0]);
    s = s.replace(OLD, () => headerHtml(rel, active, pre ? 'pre' : ''));
    how = 'заменена старая';
  } else { report.push([relPath, 'нет шапки - пропущена']); continue; }
  // <head>: header.css и header.js после последней таблицы стилей (прежняя ссылка на header.css заменяется).
  // Страница с пометкой <!-- head:manual --> подключает их сама (404.html: после <base>) - <head> не трогаем
  if (s.includes('<!-- head:manual -->')) { writeFileSync(file, s.replace(/\n/g, eol)); report.push([relPath, how + ', <head> вручную']); continue; }
  s = s.replace(/<link rel="stylesheet" href="[^"]*_assets\/header\.css">\n?(<script src="[^"]*_assets\/header\.js"><\/script>\n?)?/, '');
  const links = [...s.matchAll(/<link rel="stylesheet"[^>]*>\n/g)].filter(m => m.index < s.indexOf('</head>'));
  const at = links.length ? links[links.length - 1].index + links[links.length - 1][0].length : s.indexOf('</head>');
  const icon = /<link rel="icon"/.test(s.slice(0, s.indexOf('</head>'))) ? '' : iconLink(rel) + '\n';
  s = s.slice(0, at) + icon + headLinks(rel) + '\n' + s.slice(at);
  writeFileSync(file, s.replace(/\n/g, eol));
  report.push([relPath, how + (active ? ', активный пункт ' + active : '')]);
}
for (const [p, r] of report) console.log(p.padEnd(40), r);
