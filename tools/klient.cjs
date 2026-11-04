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
const crypto = require('crypto');

class NeVypolneno extends Error {}

const TEG_SO_SRC = /<script\b[^>]*?\bsrc\s*=/gi;
const KOMMENTARIY = /<!--[\s\S]*?-->/g;
const INLINE = /(<script\b(?![^>]*\bsrc\s*=)[^>]*>)[\s\S]*?(<\/script>)/gi;

// Разметка без комментариев и без ТЕЛ инлайновых скриптов: и там и там может
// лежать текст «<script src=…>», которого страница не грузит.
function razmetkaBezProzy(html) {
  return html.replace(KOMMENTARIY, '').replace(INLINE, '$1$2');
}

function srcsOf(html) {
  // ⚠ ПАДАЮЩАЯ ПРОВЕРКА ФОРМЫ — близнец tools/klient.py, тот же приговор.
  // Строгий признак требует src СРАЗУ после `<script` и в двойных кавычках, а
  // страница грузит и `<script defer src="…">`. Дыру нашёл arhitector-47
  // 05.11.2026 на #236: его мутация давала 22 файла без нового и зелёное у
  // прибора стадий. Число тегов со src в ЛЮБОЙ позиции обязано равняться
  // числу разобранных.
  html = razmetkaBezProzy(html);
  const tegov = (html.match(TEG_SO_SRC) || []).length;
  const strogih = [...html.matchAll(/<script\s+src="([^"]+)"/g)];
  if (tegov !== strogih.length) {
    throw new NeVypolneno(`в index.html тегов <script> с атрибутом src — ${tegov}, а признак состава разобрал ${strogih.length}: признак требует src СРАЗУ после \`<script\` и в ДВОЙНЫХ кавычках, а страница грузит любой. Состав читать нечем`);
  }
  return strogih.map(m => m[1])
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

/* ── Слепки страницы (свежесть описи, Cafe13KPG#806) ─────────────────────────
   Опись — ОТРИСОВКА, а не код: на неё влияет всё, что грузит страница, — разметка, стиль, водяной знак, сторонний QR.
   Поэтому у свежести описи состав ШИРЕ, чем у klient(): тот отдаёт только скрипты клиента (склейку для приборов кода),
   а здесь нужны ВСЕ ссылки разметки плюс сама разметка.
   ⚠ До #806 свежесть мерилась одним sha256 app.js, и правка index.html, styles.css или водяного знака опись НЕ
   ОБНОВЛЯЛА — страница печатала прежнее «видят», оставаясь зелёной. После разбивки тот признак умирает совсем:
   файла app.js нет, и чтение его дало бы «не выполнено».
   Близнец — tools/klient.py (слепки_страницы, свод); оба обязаны отдавать одну карту в одном порядке. */
const SSYLKA = /\b(?:src|href)="([^"]*)"/g;
const ODINARNAYA = /\b(?:src|href)='/;
const VNE_DEREVA = '— вне дерева (сеть)';

const vneshnyaya = s => /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//');

/* chitatel(путь) -> Buffer | null — чтобы один состав считался и по дереву, и по выложенным файлам.
   Своего списка файлов здесь нет НАРОЧНО: он разошёлся бы с тем, что грузит страница.
   Внешние входят строкой VNE_DEREVA: хешировать их нечем (сеть, в дерево не входят), но пропасть или
   сменить адрес они могут, и это обязано быть видно. */
function slepkiStranicy(chitatel) {
  const syrio = chitatel('index.html');
  if (!syrio) throw new NeVypolneno('index.html не прочитался — состав страницы взять негде');
  const html = syrio.toString('utf8');
  /* ⚠ Признак видит только ДВОЙНЫЕ кавычки. Одинарные он пропустил бы МОЛЧА, и файл выпал бы из слепков,
     оставив опись зелёной, — поэтому запрет построением, а не пополнение шаблона. */
  if (ODINARNAYA.test(html))
    throw new NeVypolneno('в index.html ссылка в ОДИНАРНЫХ кавычках — признак слепков её не видит, '
      + 'и файл выпал бы из состава молча');
  const karta = { 'index.html': crypto.createHash('sha256').update(syrio).digest('hex') };
  for (const m of html.matchAll(SSYLKA)) {
    const ssylka = m[1];
    if (vneshnyaya(ssylka)) { if (!(ssylka in karta)) karta[ssylka] = VNE_DEREVA; continue; }
    const put = ssylka.replace(/[?#].*$/, '');
    if (!put || put in karta) continue;
    const bytes = chitatel(put);
    if (!bytes) throw new NeVypolneno(`index.html ссылается на «${put}», а файла нет — слепки страницы неполны`);
    karta[put] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  /* Сверка с близнецом ПО ТОМУ ЖЕ ФАЙЛУ: скрипты, которые видит srcsOf, обязаны быть и в слепках.
     Разойдутся — значит один из двух признаков разметки сломался, и молчать об этом нельзя. */
  const net = srcsOf(html).filter(s => !(s in karta));
  if (net.length)
    throw new NeVypolneno('скрипты клиента есть в составе, а в слепках их нет: ' + net.join(', ')
      + ' — признаки разметки разошлись');
  return karta;
}

/* Одно сравнимое значение слепков — для трёхстороннего сличения описи. Меняется и от содержимого файла,
   и от СОСТАВА, и от его порядка: порядок подключения у клиента значащий (склейка), и переставленные файлы —
   другая страница. */
const svod = karta => crypto.createHash('sha256')
  .update(Object.entries(karta).map(([f, z]) => `${f} ${z}\n`).join('')).digest('hex');

const chitatelDereva = root => put => {
  const p = path.join(root, put);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
};


module.exports = { klient, apiOnFile, NeVypolneno, srcsOf, slepkiStranicy, svod, chitatelDereva, VNE_DEREVA };

// Близнец ПОДЛОГИ/самопроверки из tools/klient.py — те же случаи, те же слова.
const PODLOGI = [
  ['defer перед src (мутация arhitector-47 по #236)',
   ['</head>', '<script defer src="extra.js?v=146"></script></head>'], 'а признак состава разобрал'],
  ['src в ОДИНАРНЫХ кавычках',
   ['</head>', "<script src='js/01-osnova.js'></script></head>"], 'а признак состава разобрал'],
  ['пробелы вокруг знака равно',
   ['</head>', '<script src = "extra.js"></script></head>'], 'а признак состава разобрал'],
  ['заглавными буквами',
   ['</head>', '<SCRIPT SRC="extra.js"></SCRIPT></head>'], 'а признак состава разобрал'],
];

function samoproverka() {
  // Признак состава — настоящей srcsOf(), разметкой ЭТОГО дерева. Проверяется
  // ФОРМА признака: случаи подкладывают тег, который страница грузит, а
  // строгий признак не видит (находка arhitector-47, #236, 05.11.2026).
  const koren = path.dirname(path.dirname(path.resolve(__filename)));
  const html = fs.readFileSync(path.join(koren, 'index.html'), 'utf8');
  const bedy = [];

  const bylo = srcsOf(html).length;
  console.log(`  контроль «здоровая разметка»: скриптов клиента ${bylo}, отказа нет`);
  if (bylo < 2) bedy.push(`здоровая разметка дала ${bylo} скриптов — мерить нечем`);

  for (const [imya, [chto, chem], zhdyom] of PODLOGI) {
    const podmena = html.replace(chto, chem);
    if (podmena === html) { bedy.push(`${imya}: подмена НЕ применилась`); continue; }
    let pechat, ladno;
    try {
      pechat = `отказа НЕТ, разобрано ${srcsOf(podmena).length}`; ladno = false;
    } catch (e) {
      pechat = String(e.message).slice(0, 58); ladno = String(e.message).includes(zhdyom);
    }
    console.log(`  ${ladno ? 'сошлось' : 'РАЗОШЛОСЬ'}: ${imya} → ${pechat}`);
    if (!ladno) bedy.push(imya);
  }

  // ⚠ Обратная дыра: ПРОЗА не состав. Прежняя редакция читала
  // закомментированный тег как файл клиента (замер 05.11.2026: 22 файла,
  // среди них закомментированный) — страница его не грузит.
  const teg = html.match(/<script src="(js\/[^"]+)"><\/script>/);
  if (!teg) bedy.push('в разметке не нашлось тега для контроля прозы');
  else {
    const skryt = html.replace(teg[0], '<!-- ' + teg[0] + ' -->');
    const n = srcsOf(skryt).length, ladno = n === bylo - 1;
    console.log(`  ${ladno ? 'сошлось' : 'РАЗОШЛОСЬ'}: закомментированный тег не считается составом → скриптов ${n} (было ${bylo})`);
    if (!ladno) bedy.push('закомментированный тег прочитан как состав');
  }

  console.log('самопроверка признака состава: ' + (bedy.length ? 'РАЗОШЛАСЬ — ' + bedy.join('; ') : 'сошлась'));
  return bedy.length ? 1 : 0;
}

if (require.main === module) {
  // `--самопроверка` — ПЕРВЫМ: обычный прогон печатает перечень и может отказать на дереве
  if (process.argv.includes('--самопроверка')) process.exit(samoproverka());
  // `node tools/klient.cjs <корень>` — перечень файлов JSON-ом (для сверки с близнецом на Python)
  // `--where`: для каждого файла — where() от смещения его ПЕРВОГО байта; у обоих близнецов обязано быть «файл:1»
  try {
    const koren = process.argv.slice(2).find(a => !a.startsWith('--')) || '.';
    if (process.argv.includes('--слепки')) {
      // `--слепки`: карта файл→sha256 и свод — для сверки с близнецом на Python
      const karta = slepkiStranicy(chitatelDereva(koren));
      console.log(JSON.stringify({ 'слепки': karta, 'свод': svod(karta) }));
      process.exit(0);
    }
    const k = klient(koren);
    if (process.argv.includes('--where')) {
      let off = 0;
      console.log(JSON.stringify(k.files.map(f => { const w = k.where(off); off += f.text.length; return w; })));
    } else console.log(JSON.stringify(k.files.map(f => f.file)));
  }
  catch (e) { console.error((e instanceof NeVypolneno ? 'ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' : '') + e.message); process.exit(2); }
}
