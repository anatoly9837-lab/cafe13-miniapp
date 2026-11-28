// Случаи «заново» и «Прошедшие церемонии» на masterStats (№97, №109 «б») без браузера:
//     node tools/zanovo.cjs <корень клиента> [мутант]
// Рецепты: _docs/recept/ekran/34/masterStats.md (раздел «Прошедшие церемонии», блок T) и
// _docs/recept/ekran/42/teaHold.md (раздел «Заново», C13). Предсказания исходов — tools/zanovo.ozhidaniya.txt,
// записаны до первого прогона. Коды: 0 — все случаи зелёные; 1 — КРАСНОЕ; 2 — ПРОВЕРКА НЕ ВЫПОЛНЕНА
// (клиент не загрузился, подлог не наложился).
// Грузится ВЕСЬ клиент по алфавиту файлов js/, кроме 22-zapusk.js (запуск приложения): разбор архива — настоящий
// fromEvents, экран — настоящие SCREENS.masterStats и SCREENS.teaHold, навигация — настоящий go() и BACK.
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
const fail = m => { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + m); process.exit(2); };
if (!root || !fs.existsSync(root + '/js')) fail('нет корня клиента: ' + root);

// мутации: [файл, образец, замена]; образец обязан стоять в файле ровно один раз, замена — отличаться
const MUT = {
  occ: ['js/18-ekrany-mastera.js', "h && h.occ === 'tea' && h.done", 'h && h.done'],
  done: ['js/18-ekrany-mastera.js', "h && h.occ === 'tea' && h.done", "h && h.occ === 'tea'"],
  'again-occ': ['js/22-ekrany-chay.js', "if (!h || h.occ !== 'tea') return blank;", 'if (!h) return blank;'],
  'seats-left': ['js/22-ekrany-chay.js', 'blank.seats = String(h.of);', 'blank.seats = String(h.seats);'],
  note: ['js/22-ekrany-chay.js', "(THF.again && !pick ? '<div class=\"note\">' + svg(ICON.info) + '<span>' + esc(slovo('tea.hold.againNote')) + '</span></div>' : '') +", ''],
  'note-pick': ['js/22-ekrany-chay.js', '(THF.again && !pick ?', '(THF.again ?'],
  back: ['js/21-navigaciya.js', "teaHold: function () { return THF.again ? 'masterStats' : 'home'; },", "teaHold: 'home',"],
  nohist: ['js/21-navigaciya.js', ' if (mayMasterStats()) loadHistory(); }', ' }'],
};
if (mutant && !MUT[mutant]) fail('незнакомый мутант: ' + mutant);

const el = { addEventListener() {}, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {} };
const calls = [];
const replies = {};   // 'GET /адрес' → ответ подменённого api
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, isFinite, parseInt, parseFloat,
  document: { addEventListener() {}, getElementById() { return el; }, querySelector() { return null }, querySelectorAll() { return []; },
              documentElement: el, body: el },
  window: { addEventListener() {}, location: { search: '', hash: '' } }, location: { search: '', hash: '' }, navigator: {},
  localStorage: { getItem() { return null; }, setItem() {} }, setTimeout() {}, clearTimeout() {} };
vm.createContext(ctx);
let applied = false;
for (const f of fs.readdirSync(root + '/js').filter(f => f.endsWith('.js') && f !== '22-zapusk.js').sort()) {
  let src = fs.readFileSync(root + '/js/' + f, 'utf8');
  if (mutant && MUT[mutant][0] === 'js/' + f) {
    const [, a, b] = MUT[mutant];
    if (src.split(a).length !== 2) fail('образец мутанта ' + mutant + ' в ' + f + ' стоит не один раз');
    const was = src; src = src.replace(a, b);
    if (src === was || src.split(a).length === 2 && !b.includes(a)) fail('подлог ' + mutant + ' не наложился');
    applied = true;
  }
  try { vm.runInContext(src, ctx, { filename: f }); } catch (e) { fail(f + ': ' + e); }
}
if (mutant) { if (!applied) fail('файл мутанта не загружен'); console.log('подлог наложен: ' + mutant); }
ctx.document.getElementById = () => null;   // после загрузки полей формы в «DOM» нет: teaGrab их не читает
const R = c => vm.runInContext(c, ctx);
// живой режим и подменённый api; дверь статистики — открыта (условие двери судит случай ms-dver, не этот прибор)
R(`LIVE = true; render = function () {}; haptic = function () {}; noEntry = function () { return false; };
   mayOwnEvents = function () { return true; }; refreshMe = function () {};
   DATA.member = { uid: 4242, balance: 1000 };`);
ctx.__api = (m, u) => { calls.push(m + ' ' + u); const r = replies[m + ' ' + u.split('?')[0]]; return { then(f) { if (r) f(r); } }; };
R(`api = function (m, u, b) { return __api(m, u, b); }`);

const now = Date.now(), H = 3600e3;
const iso = t => new Date(t).toISOString();
// строка архива — форма queries.EVENTS_ROW_SQL (api), как её читает fromEvents
const hrow = (id, occ, startsAt, mins, o) => Object.assign({ id, title: 'Церемония ' + id, kind: 'paid', duration_min: mins,
  seats: 8, seats_left: 3, taken: 5, organizer_id: 4242, place_id: null, place_name: null, price: '350.00',
  my_entry_paid: null, my_refund_now: null, my_donated: null, starts_at: iso(startsAt), about: 'Пуэр и улун.\nВторая строка.',
  occupancy: occ }, o || {});
// строка списка /stats/master — форма api#196
const lrow = (id, startsAt) => ({ id, title: 'Церемония ' + id, starts_at: iso(startsAt), bookings: 5, collected: '1750.00' });

const ok = [];
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want);
  ok.push(g === w); console.log((g === w ? '✓ ' : '✗ ') + name + ' — ' + g + (g === w ? '' : ', ждали ' + w)); };

// Архив: 11 — церемония, кончилась вчера; 12 — ивент, кончился вчера; 14 — вид, которого нет (третье направление);
// 15 — церемония, кончилась минуту назад; 16 — церемония в архиве, но по часам клиента ещё идёт (сервер так не отдаёт,
// клиент не верит на слово). 13 — церемония впереди: её в архиве нет.
const hist = [hrow(11, 'tea', now - 26 * H, 120), hrow(12, 'event', now - 25 * H, 60), hrow(14, 'xyz', now - 24 * H, 60),
  hrow(15, 'tea', now - 61 * 60e3, 60), hrow(16, 'tea', now - 30 * 60e3, 120)];
const list = [lrow(11, now - 26 * H), lrow(12, now - 25 * H), lrow(14, now - 24 * H), lrow(15, now - 61 * 60e3),
  lrow(16, now - 30 * 60e3), lrow(13, now + 48 * H)];
ctx.__hist = hist;
R(`HIST = fromEvents(__hist); if (!HIST) throw 'архив не разобран'; HIST.reverse(); HIST_STATE = 'ok';`);
ctx.__list = list;
const T = () => R(`msTeaPast(__list).map(function (r) { return r.x.id; })`);
const past = T();
check('Z1 ивент вида event в «Прошедших церемониях» не стоит', past.includes(12), false);
check('Z2 незнакомый вид (xyz) — не церемония', past.includes(14), false);
check('Z3 церемония впереди (нет в архиве) не стоит', past.includes(13), false);
check('Z4 строка архива, по часам ещё идущая, прошедшей не стоит', past.includes(16), false);
check('Z5 кончившиеся церемонии стоят, порядок списка: 11, 15', past, [11, 15]);

// разметка блока T на настоящем экране
R(`MST.data = fromMasterStats({ events: { count: 6, bookings: 30, collected: '10500.00' }, payouts: { count: 0, amount: '0' },
     money: { balance: '0', withdrawable: '0', expected: '0', expected_events: 0 }, list: __list }); MST.fail = ''; MST.deny = '';
     MST.period = 'month'; MST.at = msToday();`);
const page = R(`SCREENS.masterStats()`);
const againBtns = (page.match(/data-action="mst-again:(\d+)"/g) || []).map(s => Number(s.match(/\d+/)[0]));
check('Z5б на странице «Заново» — у 11 и 15, и только у них', againBtns, [11, 15]);
check('Z5в заголовок блока и пояснение T2 стоят', [page.includes(R(`slovo('masterStats.tea.title')`)), page.includes(R(`esc(slovo('masterStats.tea.note'))`))], [true, true]);

// Z6, Z7: форма «заново»
replies['GET /master/price'] = { status: 200, data: { amount: '100.00', share: '100.00' } };   // форма api master.py price
R(`TEA.amount = 100; TEA.share = 100; TEA.priceFail = ''; CAL.pick = null; current = 'masterStats';`);
R(`go('teaHold', { again: '11' })`);
const f = R(`({ title: THF.title, about: THF.about, seats: THF.seats, entry: THF.entry, again: THF.again })`);
check('Z6 «заново» с 11: название, описание, места ВСЕГО (8, не свободные 3), вход', f,
  { title: 'Церемония 11', about: 'Пуэр и улун.\nВторая строка.', seats: '8', entry: '350', again: 11 });
R(`current = 'masterStats'`); R(`go('teaHold', { again: '12' })`);
check('Z7 «заново» с ивента вида event — форма пустая', R(`[THF.title, THF.entry, !!THF.again]`), ['', '', false]);
R(`current = 'masterStats'`); R(`go('teaHold', { again: '999' })`);
check('Z7б «заново» с номера не из архива — форма пустая', R(`[THF.title, !!THF.again]`), ['', false]);

// Z8, Z9: надпись про дату
R(`current = 'masterStats'`); R(`go('teaHold', { again: '11' }); current = 'teaHold';`);
const note = R(`esc(slovo('tea.hold.againNote'))`);
check('Z8 время не выбрано — «дату и время выберите заново» стоит', R(`SCREENS.teaHold()`).includes(note), true);
R(`CAL.pick = { src: 'teaHold', ymd: '2026-12-02', from: '19:00', to: '21:00', mins: 120, label: 'Ср, 2 декабря · 19:00–21:00' }`);
check('Z9 время выбрано — надписи нет', R(`SCREENS.teaHold()`).includes(note), false);
R(`CAL.pick = null; current = 'masterStats'; go('teaHold'); current = 'teaHold';`);
check('Z9б обычный вход с home — надписи нет', R(`SCREENS.teaHold()`).includes(note), false);

// Z10: назад
R(`current = 'masterStats'; go('teaHold', { again: '11' }); current = 'teaHold';`);
check('Z10 назад из «заново» — masterStats; из обычного входа — home',
  [R(`backTo()`), R(`current = 'home'; go('teaHold'); current = 'teaHold'; backTo()`)], ['masterStats', 'home']);

// Z11: вход на статистику читает архив
R(`current = 'manage'`); calls.length = 0; R(`go('masterStats')`);
check('Z11 вход на masterStats: GET /stats/master и GET /events/history', ['GET /stats/master', 'GET /events/history']
  .map(u => calls.some(c => c.startsWith(u))), [true, true]);

// Z12: архив не загрузился — T3 с «Повторить», остальная страница на месте
R(`HIST = null; HIST_STATE = 'код 500'; current = 'masterStats'`);
ctx.__l2 = list;
R(`MST.data = fromMasterStats({ events: { count: 6, bookings: 30, collected: '10500.00' }, payouts: { count: 0, amount: '0' },
     money: { balance: '0', withdrawable: '0', expected: '0', expected_events: 0 }, list: __l2 });`);
const p2 = R(`SCREENS.masterStats()`);
check('Z12 архив не загрузился — T3 и mst-hist-retry, список L на месте',
  [p2.includes(R(`esc(slovo('masterStats.tea.fail'))`)), p2.includes('data-action="mst-hist-retry"'), p2.includes('data-action="mst-event:11"')], [true, true, true]);

const red = ok.filter(x => !x).length;
console.log(red ? 'КРАСНОЕ: ' + red + ' из ' + ok.length : 'ЗЕЛЁНОЕ: ' + ok.length + ' из ' + ok.length);
process.exit(red ? 1 : 0);
