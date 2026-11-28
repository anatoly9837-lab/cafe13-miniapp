#!/usr/bin/env node
// Уборка каталога прогона ворот — самопроверка (Cafe13KPG#1098):  node tools/uborka.cjs --самопроверка
//
// Судит НЕ свою копию, а тело функции `uborka()` и строку `trap` из tools/pered-mergem.sh того же дерева:
// вырезает функцию, гоняет её bash-ем на подложенном каталоге прогона и смотрит, что осталось на диске.
// Ни docker, ни сети, ни git (дерево `T` подложено без git — `itog` пишет «нет-git»).
//
// Случаи (что обязано быть ПОСЛЕ уборки — существование файлов, не чтение лога):
//   З   чистое зелёное (код 0, находок нет) — live/part-1.json, live/part-1.log, sp.log, shots/razmetka.json НА МЕСТЕ;
//       каждый *.png и tree/ УБРАНЫ; itog = «нет-git 0»; строка «логи прогона: <каталог> (N КБ)», N — число;
//   К   красное (1), Н — «не выполнено» через die (2), ЗН — зелёное с находкой отчёта: НЕ ТРОНУТО ничего, png и tree
//       на месте, строка «ОСТАВЛЕН»; itog с тем же кодом;
//   T   строка trap в pered-mergem.sh ровно одна и зовёт `uborka $?` — иначе функцию никто не зовёт.
// Контроли различения (подлог в вырезанном теле; каждый обязан уронить хотя бы один случай, иначе РАЗОШЛАСЬ):
//   M1 вернуть `rm -rf "$W"` (прежняя редакция) · M2 не стирать png · M3 не писать itog · M4 убирать при любом коде ·
//   M5 не печатать размер · M6 строка trap прежней редакции (`rm -rf "$W"` прямо в trap).
// Коды: 0 — сошлась, 1 — РАЗОШЛАСЬ, 2 — НЕ ВЫПОЛНЕНА (нет pered-mergem.sh, нет функции, нет bash).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const PM = path.join(__dirname, 'pered-mergem.sh');

function telo(src) { const m = src.match(/^uborka\(\) \{.*\n(?:.*\n)*?\}\n/m); return m ? m[0] : null; }
function trapOk(src) {
  const t = src.split('\n').filter(l => /^\s*trap\b/.test(l));
  return { ok: t.length === 1 && t[0].trim() === "trap 'uborka $?' EXIT", pechat: t.length + ' строк trap: ' + t.map(l => l.trim().slice(0, 60)).join(' | ') };
}

const LEGKOE = ['live/part-1.json', 'live/part-1.log', 'sp.log', 'shots/razmetka.json', 'vid/vidimost.json'];
const TYAZH = ['live/live-bar.png', 'shots/home.png', 'tree/index.html', 'tree/js/01-osnova.js'];
function prognat(fn, ec, keep) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'uborka-'));
  try {
    const W = path.join(base, 'run-x'), T = path.join(base, 'derevo');
    fs.mkdirSync(T);
    for (const f of LEGKOE.concat(TYAZH)) { fs.mkdirSync(path.dirname(path.join(W, f)), { recursive: true }); fs.writeFileSync(path.join(W, f), 'x'.repeat(2048)); }
    const r = spawnSync('bash', ['-c', 'set -u; W=$1; T=$2; keep_why=$3\n' + fn + '\nuborka "$4"', 'uborka', W, T, keep, String(ec)], { encoding: 'utf8' });
    if (r.error) throw r.error;
    const est = f => fs.existsSync(path.join(W, f));
    const itog = est('itog') ? fs.readFileSync(path.join(W, 'itog'), 'utf8') : null;
    return { W, out: r.stdout, rc: r.status, legkoe: LEGKOE.filter(est), tyazh: TYAZH.filter(est), tree: est('tree'), itog };
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
// случаи: [имя, код, находка, проверка(итог) → '' если ладно, иначе почему]
const SLUCHAI = [
  ['З чистое зелёное: лёгкое на месте, png и tree убраны, размер числом', 0, '', p =>
    p.legkoe.length !== LEGKOE.length ? 'пропало лёгкое: ' + LEGKOE.filter(f => !p.legkoe.includes(f)).join(' ')
    : p.tyazh.length || p.tree ? 'осталось тяжёлое: ' + p.tyazh.join(' ')
    : p.itog !== 'нет-git 0\n' ? 'itog ' + JSON.stringify(p.itog)
    : !new RegExp('^логи прогона: ' + p.W.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(\\d+ КБ\\)$', 'm').test(p.out) ? 'нет строки размера: ' + JSON.stringify(p.out.slice(0, 120))
    : ''],
  ...[['К красное', 1, ''], ['Н не выполнено (die)', 2, ''], ['ЗН зелёное с находкой отчёта', 0, 'отчёт 2']].map(([imya, ec, keep]) => [
    imya + ': не тронуто ничего, «ОСТАВЛЕН»', ec, keep, p =>
      p.legkoe.length !== LEGKOE.length || p.tyazh.length !== TYAZH.length ? 'стёрто: ' + LEGKOE.concat(TYAZH).filter(f => !p.legkoe.includes(f) && !p.tyazh.includes(f)).join(' ')
      : p.itog !== 'нет-git ' + ec + '\n' ? 'itog ' + JSON.stringify(p.itog)
      : !p.out.includes('рабочий каталог прогона ОСТАВЛЕН: ' + p.W) ? 'нет строки ОСТАВЛЕН' : '']),
];
function sudit(fn, src) {   // → перечень упавших случаев ([имя, почему])
  const pal = [];
  for (const [imya, ec, keep, f] of SLUCHAI) { let why; try { why = f(prognat(fn, ec, keep)); } catch (e) { why = 'исключение: ' + e.message; } if (why) pal.push([imya, why]); }
  const t = trapOk(src); if (!t.ok) pal.push(['T строка trap зовёт uborka', t.pechat]);
  return pal;
}
const KONTROLI = [
  ['M1 вернуть rm -rf "$W"', 'rm -rf "${W:?}/tree"', 'rm -rf "${W:?}"'],
  ['M2 не стирать png', "find \"$W\" -type f -name '*.png' -delete", ':'],
  ['M3 не писать itog', 'printf \'%s %s\\n\' "$sha" "$ec" > "$W/itog"', ':'],
  ['M4 убирать при любом коде', 'if [ "$ec" -eq 0 ] && [ -z "$keep_why" ]; then', 'if true; then'],
  ['M5 не печатать размер', 'echo "логи прогона: $W ($(du -sk "$W" | cut -f1) КБ)"', ':'],
];

function samoproverka() {
  let src;
  try { src = fs.readFileSync(PM, 'utf8'); } catch (e) { console.log('  нет ' + PM + ' — мерить нечего'); return 2; }
  const fn = telo(src);
  if (!fn) { console.log('  в pered-mergem.sh нет функции uborka() — мерить нечего'); return 2; }
  if (spawnSync('bash', ['-c', 'true']).status !== 0) { console.log('  bash не запускается'); return 2; }
  const bedy = []; let n = 0;
  const sud = (imya, ladno, pechat) => { n++; console.log(`  ${ladno ? 'сошлось' : 'РАЗОШЛОСЬ'}: ${imya} → ${pechat}`); if (!ladno) bedy.push(imya); };
  const pal = sudit(fn, src);
  for (const [imya] of SLUCHAI.concat([['T строка trap зовёт uborka']])) {
    const p = pal.find(x => x[0] === imya); sud(imya, !p, p ? p[1] : 'да');
  }
  for (const [imya, a, b] of KONTROLI) {
    if (!fn.includes(a)) { sud('контроль ' + imya, false, 'подмена не применилась — тело функции разошлось с контролем'); continue; }
    const m = sudit(fn.replace(a, b), src);
    sud('контроль ' + imya + ' краснеет', m.length > 0, m.length ? 'упал ' + m.map(x => x[0].split(' ')[0]).join(',') : 'ВЫЖИЛ');
  }
  const stary = src.replace("trap 'uborka $?' EXIT", "trap 'ec=$?; [ \"$ec\" -eq 0 ] && rm -rf \"$W\"' EXIT");
  sud('контроль M6 trap прежней редакции краснеет', !trapOk(stary).ok, trapOk(stary).ok ? 'ВЫЖИЛ' : 'упал T');
  if (n === 0) { console.log('  случаев не прогнано ни одного — мерить нечем'); return 2; }
  console.log(`случаев ${n}, бед ${bedy.length}` + (bedy.length ? ' — ' + bedy.join('; ') : ''));
  return bedy.length ? 1 : 0;
}
// Контракт шага 18 ворот (Cafe13KPG#1118): ПОСЛЕДНЯЯ строка — приговор, из того же кода, каким прибор выходит.
function itogSamoproverki(kod) {
  console.log(`самопроверка ${path.basename(__filename)}: ${kod === 0 ? 'сошлась' : kod === 1 ? 'РАЗОШЛАСЬ — код 1' : 'НЕ ВЫПОЛНЕНА — код ' + kod}`);
  return kod;
}
const argv = process.argv.slice(2);
if (argv.length !== 1 || argv[0] !== '--самопроверка') {
  console.log('НЕ ВЫПОЛНЕНО: знаю только --самопроверка (судит uborka() в tools/pered-mergem.sh); ничего не мерено');
  process.exit(2);
}
process.exit(itogSamoproverki(samoproverka()));
