// Случаи «доля клуба и грань входа teaHold» (шаг 42, ЧАЙ-A, №78) без браузера: node tools/chay-dolya.cjs <корень клиента> [мутант]
// Провод: GET /master/price (api master.py:320) отдаёт "share": Decimal("100"); pydantic 2 пишет его СТРОКОЙ — {"share":"100"}.
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1):
//   str    — доля не приводится к числу (teaLoadPrice: TEA.share = s): вход сравнивается со строкой;
//   chislo — teaPrice снова принимает только строку: доля JSON-числом становится null, грань пропадает молча (Д6);
//   foto   — teaHoldReady не ждёт загрузки фото (снят `!fotoBusy('teaHold')`): подача уходит без кадра (Д10).
// Коды: 0 — зелёное, 1 — КРАСНОЕ, 2 — ПРОВЕРКА НЕ ВЫПОЛНЕНА (код не загрузился или случай упал, Cafe13KPG#1137).
// fotoBusy и FOTO — живые, из js/09-afisha.js (не заглушка: заглушка отстала бы от кода, как до #1137).
// Равносильный (не мутант): вернуть ветку `typeof TEA.share !== 'number' ||` — доля бывает только числом или null,
// а `e >= null` истинно для любого входа, прошедшего регулярку; поэтому ветка снята, а Д8 называет это поведение.
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('ПРОВЕРКА НЕ ВЫПОЛНЕНА: корень клиента первым аргументом'); process.exit(2); }
if (!['', 'str', 'chislo', 'foto'].includes(mutant)) { console.error('ПРОВЕРКА НЕ ВЫПОЛНЕНА: мутант неизвестен: ' + mutant); process.exit(2); }
// упавший случай (исключение) — «ПРОВЕРКА НЕ ВЫПОЛНЕНА», код 2, а не КРАСНОЕ: rc=1 значит только «проверка сказала нет»
process.on('uncaughtException', e => { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: случай упал — ' + (e && e.message || e)); process.exit(2); });
let reply = null;   // ответ подменённого api на GET /master/price
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, isFinite, parseInt,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'home', haptic() {}, render() {}, go() {}, refreshMe() {}, svg: () => '',
  failText: r => 'код ' + r.status, DATA: { member: { uid: 4242, balance: 5000 } }, API: '',
  calPicked: () => 'P1',
  api() { return { then(f) { f(reply); } }; } };
vm.createContext(ctx);
let src;
try {
  for (const f of ['js/00-slova.js', 'js/10-utility.js', 'js/09-afisha.js']) vm.runInContext(fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f });
  src = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
} catch (e) { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: код не загрузился — ' + e); process.exit(2); }
const sub = (a, b) => { if (!src.includes(a)) throw 'подмена не применилась: ' + mutant; src = src.replace(a, b); console.log('подлог наложен: ' + mutant); };
if (mutant === 'str') sub('TEA.share = s === null ? null : Number(s);', 'TEA.share = s;');
if (mutant === 'chislo') sub("var t = typeof v === 'number' && isFinite(v) ? String(v) : v;", 'var t = v;');
if (mutant === 'foto') sub("return !THF.busy && !fotoBusy('teaHold') && ", 'return !THF.busy && ');
try { vm.runInContext(src, ctx, { filename: '22' }); }
catch (e) { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: код не загрузился — ' + e); process.exit(2); }
const R = c => vm.runInContext(c, ctx);
R(`TEA_URL.price = function () { return '/master/price'; }`);
const price = share => { reply = { status: 200, data: { duration_min: 120, hours: 2, hours_included: 2, amount: '100', share } }; R(`teaLoadPrice()`); };
const ready = entry => R(`THF.entry = ${JSON.stringify(entry)}; THF.busy = false; THF.stale = null; teaHoldReady()`) ? 'проходит' : 'отказ';
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };

// доля строкой — как шлёт сервер сегодня
price('100');
check('Д1 доля "100" строкой → число в клиенте', typeof R('TEA.share') + ' ' + R('TEA.share'), 'number 100');
check('Д2 вход 50 при доле "100"', ready('50'), 'отказ');
check('Д3 вход 99.99 при доле "100"', ready('99.99'), 'отказ');
check('Д4 вход 100 при доле "100" (ровно)', ready('100'), 'проходит');
check('Д5 вход 600 при доле "100"', ready('600'), 'проходит');
// доля JSON-числом — сегодня сервер так не шлёт; защита на будущее
price(100);
check('Д6 вход 50 при доле 100 числом', ready('50'), 'отказ');
check('Д7 вход 100 при доле 100 числом', ready('100'), 'проходит');
// доли нет — клиент грань не выдумывает, её держит сервер
price(undefined);
check('Д8 доли нет — вход 50 клиент пропускает (грань у сервера)', ready('50'), 'проходит');
// разбор денег: прочее не принимается
check('Д9 teaPrice: -5, NaN, Infinity, "1e3", "" → null',
  [-5, NaN, Infinity, '1e3', ''].map(v => R(`teaPrice(${typeof v === 'string' ? JSON.stringify(v) : String(v)})`)).every(x => x === null) ? 'null' : 'не null', 'null');
// кадр ещё грузится — подача ждёт его (живой fotoBusy из 09-afisha.js); кадр догрузился — проходит
price('100');
R(`FOTO.teaHold = { of: null, err: '', verb: false, list: [{ k: 1, id: null, url: '', squeezed: false, loading: true, draft: true }] }`);
check('Д10 вход 600, кадр грузится → ждёт', ready('600'), 'отказ');
R(`FOTO.teaHold.list[0].loading = false`);
check('Д11 вход 600, кадр догрузился', ready('600'), 'проходит');
R(`delete FOTO.teaHold`);

const red = ok.filter(x => !x).length;
console.log(red ? 'КРАСНОЕ: ' + red + ' из ' + ok.length : 'ЗЕЛЁНОЕ: ' + ok.length + ' из ' + ok.length);
process.exit(red ? 1 : 0);
