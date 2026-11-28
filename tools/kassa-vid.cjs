// Незнакомый вид и способ строки дня кассы не роняют ВЕСЬ день: node tools/kassa-vid.cjs <корень клиента> [мутант]
// Класс грозил трижды (donation, withdraw, tea — api#230; сервер прячет их фильтром till.py): прежний разбор `!TD_KIND[r.kind]` → null отвергал день
// целиком. Поэтому главный случай — ВЫДУМАННЫЙ вид, которого нет ни в клиенте, ни на сервере (К1), а не `tea`.
// Форма строки — сервер till.py `/till/day` (id, at, kind, amount, method, member_id, note, cancels_id, by_staff_id,
// cancelled_by). Экран tillDay в живом заморожен (FROZEN, js/02) — случаи батареи о нём спят, класс держит этот прибор.
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1):
//   kind — прежнее условие `!TD_KIND[r.kind]` вернуто;  how — прежнее `!TD_HOW[r.method]`;
//   undo — у незнакомого вида кнопка «Отменить» (касса подменила бы отмену брони);
//   whole — нечитаемая строка снова отвергает весь день (Cafe13KPG#718; краснеют К7, К8, К10);
//   vilka — при пропуске счёт сверяется строго, без вилки live ≤ count_live ≤ live + skipped (К7: законный пропуск — «не сходится»);
//   fraza — фраза о пропущенных строках снята с экрана tillDay (К9).
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, parseFloat, isFinite,
  document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } },
  window: { Telegram: undefined, location: { search: '', hash: '' }, addEventListener() {} }, navigator: {}, localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() {}, clearTimeout() {}, fetch() { return new Promise(() => {}); } };
vm.createContext(ctx);
const load = (f, src) => vm.runInContext(src || fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f });
for (const f of ['js/00-slova.js', 'js/01-osnova.js', 'js/02-chlenstvo.js', 'js/03-propusk.js', 'js/04-bar.js']) {
  try { load(f); } catch (e) { /* верх файлов зовёт DOM; нужное — объявления функций, они уже подняты */ }
}
let src = fs.readFileSync(root + '/js/05-kassa.js', 'utf8');
const sub = (a, b) => { if (!src.includes(a)) { console.error('подмена не применилась: ' + a.slice(0, 60)); process.exit(2); }
  src = src.replace(a, b); console.log('подлог наложен'); };
if (mutant === 'kind') sub("typeof r.kind !== 'string'", '!TD_KIND[r.kind]');
if (mutant === 'how') sub("typeof r.method !== 'string'", '!TD_HOW[r.method]');
if (mutant === 'undo') sub('canUndo: !!TD_UNDO[r.kind]', 'canUndo: true');
if (mutant === 'whole') sub('{ skipped++; continue; }', 'return null;');
if (mutant === 'vilka') sub('odd: skipped ? !(live <= d.count_live && d.count_live <= live + skipped) : ', 'odd: ');
let scr = fs.readFileSync(root + '/js/13-ekrany-kassa.js', 'utf8');
if (mutant === 'fraza') { const a = "(d.skipped ? '<div class=\"note\" role=\"status\">'";
  if (!scr.includes(a)) { console.error('подмена не применилась: fraza'); process.exit(2); } scr = scr.replace(a, "(false ? '<div>'"); console.log('подлог наложен'); }
try { load('js/05-kassa.js', src); } catch (e) { console.error('js/05-kassa.js не загрузился: ' + e.message); process.exit(2); }
const R0 = c => vm.runInContext(c, ctx);
for (const f of ['js/10-utility.js']) { try { load(f); } catch (e) {} }
R0('var SCREENS = typeof SCREENS === "object" ? SCREENS : {}');
try { load('js/13-ekrany-kassa.js', scr); } catch (e) { /* SCREENS объявлен выше файла — нужное поднято */ }
if (typeof ctx.fromTillDay !== 'function' || typeof ctx.tillDayRow !== 'function') { console.error('fromTillDay/tillDayRow не найдены'); process.exit(2); }
const R = c => vm.runInContext(c, ctx);
R("var TD = TD || {}; TD.busy = -1; TD.ask = -1; TD.deny = null; if (typeof svg !== 'function') svg = function () { return ''; }");

const row = (id, kind, method, amount, extra) => Object.assign({ id, at: '2026-11-26T10:0' + id + ':00+07:00', kind, amount: String(amount),
  method, member_id: null, note: null, cancels_id: null, by_staff_id: 1, cancelled_by: null }, extra || {});
const day = rows => ({ day_start: '2026-11-25T17:00:00Z', day_end: '2026-11-26T17:00:00Z', rows,
  total_live: String(rows.filter(r => r.cancels_id === null && r.cancelled_by === null).reduce((a, r) => a + Number(r.amount), 0)),
  count_live: rows.filter(r => r.cancels_id === null && r.cancelled_by === null).length });
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const parse = d => { ctx.__d = d; return R('fromTillDay(__d)'); };

// К0 (контроль различения): знакомые виды — день разобран, итог 600
const d0 = parse(day([row(1, 'topup', 'cash', 500), row(2, 'service', 'card', 100)]));
check('К0 знакомые виды — день разобран', d0 ? 'день, итог ' + d0.total + (d0.odd ? ' НЕ СХОДИТСЯ' : '') : 'не разобран', 'день, итог 600');
// К1: ВЫДУМАННЫЙ вид — день открывается, строка нейтральная, сумма в итоге
const d1 = parse(day([row(1, 'topup', 'cash', 500), row(2, 'zzz-nevedomyy', 'account', 70)]));
check('К1 выдуманный вид zzz-nevedomyy — день открыт', d1 ? 'день, строк ' + d1.rows.length + ', итог ' + d1.total + (d1.odd ? ' НЕ СХОДИТСЯ' : '') : 'не разобран',
  'день, строк 2, итог 570');
check('К2 его строка — нейтрально, сырого вида на экране нет', d1 ? (() => { ctx.__r = d1.rows[1]; const h = R('tillDayRow(__r, 1)');
  return (h.includes('Прочее') ? 'Прочее' : 'нет слова') + (h.includes('zzz') ? ' + сырой вид' : ''); })() : 'дня нет', 'Прочее');
check('К3 у незнакомого вида нет «Отменить»', d1 ? (() => { ctx.__r = d1.rows[1]; return R('tillDayRow(__r, 1)').includes('td-ask:') ? 'есть' : 'нет'; })() : 'дня нет', 'нет');
// К4: строка ОТМЕНЫ незнакомого вида — «Отмена · Прочее», минусом, день открыт
const d4 = parse(day([row(1, 'zzz-nevedomyy', 'account', 600, { cancelled_by: 2 }), row(2, 'zzz-nevedomyy', 'account', 600, { cancels_id: 1 })]));
check('К4 отмена незнакомого вида', d4 ? (() => { ctx.__r = d4.rows[1]; return R('tillDayRow(__r, 1)').includes('Отмена · Прочее') ? 'Отмена · Прочее' : 'нет слова'; })() : 'не разобран',
  'Отмена · Прочее');
// К5: незнакомый СПОСОБ — день открыт, строка «другим способом», в разбивку по способам не входит
const d5 = parse(day([row(1, 'topup', 'zzz-sposob', 300), row(2, 'topup', 'cash', 200)]));
check('К5 незнакомый способ — день открыт', d5 ? 'день, итог ' + d5.total + ', наличными ' + d5.by.cash + ', ' + d5.rows[0].how : 'не разобран',
  'день, итог 500, наличными 200, другим способом');
// К6: знакомый вид по-прежнему отменяется из кассы (отрицательная пара к К3)
check('К6 у знакомого вида «Отменить» есть', d0 ? (() => { ctx.__r = d0.rows[0]; return R('tillDayRow(__r, 0)').includes('td-ask:') ? 'есть' : 'нет'; })() : 'дня нет', 'есть');
// К7 (Cafe13KPG#718): нечитаемая строка (вид не строкой) — пропуск ОДНОЙ строки, день открыт; итог — число сервера;
// count_live сервера (2) в вилке live 1 ≤ 2 ≤ 1 + 1 — «сходится» законно
const d7 = parse(day([row(1, 'topup', 'cash', 500), row(2, 7, 'cash', 10)]));
check('К7 вид не строкой — строка пропущена, день открыт', d7 ? 'день, строк ' + d7.rows.length + ', пропущено ' + d7.skipped + ', итог ' + d7.total +
  (d7.odd ? ' НЕ СХОДИТСЯ' : '') : 'не разобран', 'день, строк 1, пропущено 1, итог 510');
// К8: вилка держит — сервер насчитал живых больше, чем live + skipped: «не сходится»
const d8 = parse(Object.assign(day([row(1, 'topup', 'cash', 500), row(2, 'topup', 'cash', 'x')]), { count_live: 5, total_live: '500' }));
check('К8 count_live вне вилки — не сходится', d8 ? (d8.odd ? 'не сходится' : 'сходится') : 'не разобран', 'не сходится');
// К9: экран называет пропуск числом — день без строки полным не выглядит
R("LIVE = false; FLASH = null; TD.fail = ''"); ctx.__d7 = d7;
check('К9 на экране «Строк не разобрано: 1»', d7 ? (() => { R('TD.data = __d7'); let h = ''; try { h = R('SCREENS.tillDay()'); } catch (e) { return 'экран упал: ' + e.message; }
  return h.includes('Строк не разобрано: 1') ? 'есть' : 'нет'; })() : 'дня нет', 'есть');
// К10: битая ссылка отмены у одной строки — пропущена она одна, соседняя на месте
const d10 = parse(day([row(1, 'topup', 'cash', 300), row(2, 'topup', 'cash', 200, { cancels_id: 'ноль' })]));
check('К10 битая ссылка отмены — пропущена одна', d10 ? 'строк ' + d10.rows.length + ', пропущено ' + d10.skipped : 'не разобран', 'строк 1, пропущено 1');
// К11: оболочка ответа без rows — отказ целиком, как прежде: послабление не шире строки
check('К11 нет rows — день отвергнут', parse({ count_live: 0, total_live: '0' }) ? 'разобран' : 'не разобран', 'не разобран');

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
