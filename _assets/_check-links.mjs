// Быстрая проверка внутренних ссылок по файловой системе, без сети и без
// браузера — для 27 статических файлов это надёжнее и в сотни раз быстрее.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === '_assets' || name === '.git' || name.startsWith('_отчёты') || name.startsWith('_каркас')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full.replace(/\\/g, '/'));
  }
  return out;
}
const files = walk('.', []);

let broken = 0, checked = 0;
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  const dir = file.replace(/[^/]+$/, '');
  for (const href of hrefs) {
    if (href.startsWith('http') || href.startsWith('mailto') || href.startsWith('#') || href.includes('#')) continue;
    checked++;
    // resolve relative path against the file's directory
    const parts = (dir + href).split('/').filter(Boolean);
    const resolved = [];
    for (const p of parts) {
      if (p === '..') resolved.pop();
      else if (p === '.') continue;
      else resolved.push(p);
    }
    let target = resolved.join('/');
    const hasExt = /\.[a-z0-9]+$/i.test(target);
    if (!hasExt) {
      if (target.endsWith('/') || target === '') target += 'index.html';
      else target += '/index.html';
    }
    if (!existsSync(target)) {
      console.log('BROKEN:', file, '->', href, '(resolved:', target+')');
      broken++;
    }
  }
}
console.log(`\nпроверено ссылок: ${checked}, файлов: ${files.length}, битых: ${broken}`);
