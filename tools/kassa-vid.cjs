// Незнакомый вид и способ строки дня кассы не роняют ВЕСЬ день: node tools/kassa-vid.cjs <корень клиента> [мутант]
// Класс вернулся трижды (donation, withdraw, tea — api#230): прежний разбор `!TD_KIND[r.kind]` → null отвергал день
// целиком. Поэтому главный случай — ВЫДУМАННЫЙ вид, которого нет ни в клиенте, ни на сервере (К1), а не `tea`.
// Форма строки — сервер till.py `/till/day` (id, at, kind, amount, method, member_id, note, cancels_id, by_staff_id,
// cancelled_by). Экран tillDay в живом заморожен (FROZEN, js/02) — случаи батареи о нём спят, класс держит этот прибор.
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1):
//   kind — прежнее условие `!TD_KIND[r.kind]` вернуто;  how — прежнее `!TD_HOW[r.method]`;
//   undo — у незнакомого вида кнопка «Отменить» (касса подменила бы отмену брони).
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
try { load('js/05-kassa.js', src); } catch (e) { console.error('js/05-kassa.js не загрузился: ' + e.message); process.exit(2); }
for (const f of ['js/10-utility.js']) { try { load(f); } catch (e) {} }
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
// К4: tea — словами («Бронь церемонии»), без отмены из кассы
const d4 = parse(day([row(1, 'tea', 'account', 600)]));
check('К4 tea — «Бронь церемонии»', d4 ? (() => { ctx.__r = d4.rows[0]; const h = R('tillDayRow(__r, 0)');
  return (h.includes('Бронь церемонии') ? 'Бронь церемонии' : 'нет слова') + (h.includes('td-ask:') ? ' + Отменить' : ''); })() : 'не разобран', 'Бронь церемонии');
// К5: незнакомый СПОСОБ — день открыт, строка «другим способом», в разбивку по способам не входит
const d5 = parse(day([row(1, 'topup', 'zzz-sposob', 300), row(2, 'topup', 'cash', 200)]));
check('К5 незнакомый способ — день открыт', d5 ? 'день, итог ' + d5.total + ', наличными ' + d5.by.cash + ', ' + d5.rows[0].how : 'не разобран',
  'день, итог 500, наличными 200, другим способом');
// К6: знакомый вид по-прежнему отменяется из кассы (отрицательная пара к К3)
check('К6 у знакомого вида «Отменить» есть', d0 ? (() => { ctx.__r = d0.rows[0]; return R('tillDayRow(__r, 0)').includes('td-ask:') ? 'есть' : 'нет'; })() : 'дня нет', 'есть');
// К7: сломанная строка (вид не строкой) — день по-прежнему отвергается: послабление не шире предмета
check('К7 вид не строкой — день отвергнут', parse(day([row(1, 7, 'cash', 10)])) ? 'разобран' : 'не разобран', 'не разобран');

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
