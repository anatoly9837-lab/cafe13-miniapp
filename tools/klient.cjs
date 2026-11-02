/* Клиент по index.html (Cafe13KPG#806). Клиент — несколько обычных <script>, и ЕДИНСТВЕННЫЙ источник правды о
   составе и порядке — index.html: прибор не держит своего списка файлов, иначе он разойдётся с тем, что грузит страница.

   Отдаёт:
     files  — [{ file, text }] в порядке подключения;
     text   — склейка в том же порядке (то, что видит страница как одну общую область);
     where(offset) — «файл:строка» для смещения в склейке, чтобы отказ прибора называл место, а не номер символа.

   Берутся только ЛОКАЛЬНЫЕ src; «?v=…» срезается; внешние (https://…) пропускаются; vendor/ — сторонний код, не клиент
   (до разбивки приборы читали только app.js, без библиотеки QR).

   Стражи — НЕ ВЫПОЛНЕНО, а не «зелёное»: ноль скриптов клиента; файла из index.html нет на диске; .js в js/ без ссылки
   из index.html («модуль-сирота» — его правят, а страница его не грузит).

   Близнец — tools/klient.py; оба обязаны отдавать один перечень в одном порядке (сверка — в воротах). Форма —
   frontend-11 (02.11.2026). */
'use strict';
const fs = require('fs');
const path = require('path');

class NeVypolneno extends Error {}

function srcsOf(html) {
  return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])
    .filter(s => !/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith('//'))
    .map(s => s.replace(/[?#].*$/, ''))
    .filter(s => !s.startsWith('vendor/'));
}

function klient(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const srcs = srcsOf(html);
  if (!srcs.length) throw new NeVypolneno('в index.html нет ни одного скрипта клиента');
  const files = srcs.map(f => {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) throw new NeVypolneno(`index.html подключает «${f}», а файла нет`);
    return { file: f, text: fs.readFileSync(p, 'utf8') };
  });
  const dir = path.join(root, 'js');
  if (fs.existsSync(dir)) {
    const orphans = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !srcs.includes('js/' + f));
    if (orphans.length) throw new NeVypolneno('модуль-сирота: ' + orphans.map(f => 'js/' + f).join(', ') + ' — в index.html не подключён');
  }
  const text = files.map(f => f.text).join('');
  const starts = [];
  let off = 0;
  for (const f of files) { starts.push(off); off += f.text.length; }
  const where = o => {
    let i = starts.length - 1;
    while (i > 0 && starts[i] > o) i--;
    const before = files[i].text.slice(0, o - starts[i]);
    return files[i].file + ':' + (before.split('\n').length);
  };
  return { files, text, where };
}

// файл, где объявлен API_ON: ровно один файл и в нём ровно одно объявление — иначе НЕ ВЫПОЛНЕНО (перехват не на чем ставить)
const API_ON_DECL = /^\s*(var|let|const)\s+API_ON\s*=/gm;
function apiOnFile(k) {
  const hits = k.files.map(f => ({ file: f.file, n: (f.text.match(API_ON_DECL) || []).length })).filter(x => x.n);
  if (hits.length !== 1 || hits[0].n !== 1)
    throw new NeVypolneno('объявление API_ON: ' + (hits.length ? hits.map(x => x.file + ' ×' + x.n).join(', ') : 'нигде') + ' — ждали ровно одно в одном файле');
  return hits[0].file;
}

module.exports = { klient, apiOnFile, NeVypolneno, srcsOf };

if (require.main === module) {
  // `node tools/klient.cjs <корень>` — перечень файлов JSON-ом (для сверки с близнецом на Python)
  // `--where`: для каждого файла — where() от смещения его ПЕРВОГО байта; у обоих близнецов обязано быть «файл:1»
  try {
    const k = klient(process.argv[2] && process.argv[2] !== '--where' ? process.argv[2] : '.');
    if (process.argv.includes('--where')) {
      let off = 0;
      console.log(JSON.stringify(k.files.map(f => { const w = k.where(off); off += f.text.length; return w; })));
    } else console.log(JSON.stringify(k.files.map(f => f.file)));
  }
  catch (e) { console.error((e instanceof NeVypolneno ? 'ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' : '') + e.message); process.exit(2); }
}
