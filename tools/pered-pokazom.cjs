const { spawnSync } = require('child_process');
const fs = require('fs');

/* ВОРОТА ПЕРЕД ПОКАЗОМ — один запускатель на путь «код → коммит → владелец смотрит» (Cafe13KPG#605,
   #607). Ворот ТРИ, и каждое закрывает долг, который НЕ догоняется после показа:
     1. дым — приложение загружается и рисует главный экран (`tools/smoke.cjs`);
     2. имена и id живых людей — публичный git (`tools/ids-clean.cjs`). Не снимается НИКОГДА: «база не
        живая» сказано о ДАННЫХ стадии пред-МВП, а утечка — об истории публичного репозитория;
     3. номер версии — оба `?v=` в `index.html` равны номеру `app.js`, иначе владелец смотрит старый файл
        из кэша и правит нас по тому, чего мы не делали.
   И отдельной строкой — ПРЕДЕЛ отставания описи (`tools/check-opis.py`, второй вызывающий). Это не
   четвёртые ворота: прибор блокирует только при долге ≥ 3 опубликованных номеров.

   Исходы, и они НЕ склеиваются:
     0 — всё зелёное;
     1 — красное хоть у одного — с именем ворот и его текстом;
     2 — хоть одно «НЕ ВЫПОЛНЕНО» при отсутствии красного. «Не выполнено» НЕ перебивается зелёным
         остальных: оно значит «мерить нечем», а не «чисто». Красное важнее «не выполнено» потому, что
         это найденный дефект; но строка «не выполнено» печатается и тогда — приговор по ТЕКСТУ.

   Запуск (дыму нужен браузер, поэтому в образе):
     docker run --rm -v $PWD:/app:ro --entrypoint node agenthost/playwright:1.59.1 /app/tools/pered-pokazom.cjs */

const ROOT = process.env.APP || '/app';
const rows = [];
const say = (kind, name, rc, text) => rows.push({ kind, name, rc, text });

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, env: Object.assign({}, process.env, { APP: ROOT }), encoding: 'utf8', timeout: 60000 });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  if (r.error) return { rc: 2, out: 'не запустился: ' + r.error.message };
  return { rc: r.status === null ? 2 : r.status, out };
}
const first = s => String(s || '').split('\n').filter(Boolean).slice(0, 4).join(' | ');

// 1. дым
{
  const r = run('node', [ROOT + '/tools/smoke.cjs']);
  say('ворота', 'дым', [0, 1, 2].includes(r.rc) ? r.rc : 2, first(r.out));
}
// 2. имена и id — без флага «необязательно»: этих ворот не снимает ничто
try {
  const found = require(ROOT + '/tools/ids-clean.cjs').idsClean(ROOT);
  if (!Array.isArray(found)) say('ворота', 'имена и id', 2, 'страж вернул не список — разбор не тот');
  else say('ворота', 'имена и id', found.length ? 1 : 0, found.length ? found.slice(0, 3).join(' | ') : 'чисто');
} catch (e) { say('ворота', 'имена и id', 2, 'страж не запустился: ' + String(e.message).split('\n')[0]); }
// 3. номер версии: номер БЕРЁТСЯ из app.js и сверяется с обоими `?v=` в index.html
try {
  const app = fs.readFileSync(ROOT + '/app.js', 'utf8'), idx = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const m = app.match(/var VERSION = 'v(\d+) · /);
  if (!m) say('ворота', 'номер версии', 2, 'в app.js нет `var VERSION = \'vN · …\'` — номер не прочитан');
  else {
    const n = m[1];
    const css = (idx.match(/styles\.css\?v=(\d+)"/) || [])[1], js = (idx.match(/app\.js\?v=(\d+)"/) || [])[1];
    if (!css || !js) say('ворота', 'номер версии', 2, 'в index.html не найдено `styles.css?v=` или `app.js?v=` — признак не тот');
    else if (css !== n || js !== n) say('ворота', 'номер версии', 1, `app.js v${n}, а в index.html styles.css?v=${css}, app.js?v=${js} — владелец увидит старый файл из кэша`);
    else say('ворота', 'номер версии', 0, `v${n} во всех трёх местах`);
  }
} catch (e) { say('ворота', 'номер версии', 2, 'файлы не прочитаны: ' + String(e.message).split('\n')[0]); }
// предел описи — второй вызывающий. Прибора нет — «не выполнено», а НЕ тихий пропуск
if (!fs.existsSync(ROOT + '/tools/check-opis.py')) say('предел', 'отставание описи', 2, 'прибора tools/check-opis.py в дереве нет — предел не измерен');
else {
  const r = run('python3', ['-I', ROOT + '/tools/check-opis.py']);
  say('предел', 'отставание описи', [0, 1, 2].includes(r.rc) ? r.rc : 2, first(r.out));
}

const WORD = { 0: 'зелёное', 1: 'КРАСНОЕ', 2: 'НЕ ВЫПОЛНЕНО' };
for (const x of rows) console.log(`${x.kind === 'ворота' ? 'ВОРОТА' : 'ПРЕДЕЛ'} ${x.name}: ${WORD[x.rc]} — ${x.text}`);
const rc = rows.some(x => x.rc === 1) ? 1 : rows.some(x => x.rc === 2) ? 2 : 0;
console.log(rc === 0 ? 'ПОКАЗЫВАТЬ МОЖНО: ворота и предел зелёные'
  : rc === 1 ? 'НЕ ПОКАЗЫВАТЬ: есть красное'
  : 'НЕ ПОКАЗЫВАТЬ: красного нет, но не всё измерено — «не выполнено» не равно «зелёное»');
process.exit(rc);
