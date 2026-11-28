// Вкладка вложенного экрана (Cafe13KPG#209) без браузера: node tools/vkladka-roditelya.cjs <корень клиента> [мутант]
// tabOf(keys) (js/21-navigaciya.js) идёт цепочкой «назад» — той же картой BACK, что кнопка, — до первой вкладки из keys.
// Прибор судит ВЫБОР вкладки; что выбранная получает aria-current в DOM — строка render() `t[0] === at`, её держит
// случай батареи `tabs-nested` (tools/live.cjs), а не этот прибор.
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1):
//   flat  — цепочка не идёт (прежнее `t[0] === current`): краснеют В1–В5;
//   obj   — шаг {s, p} не разбирается: «Благодарность» уходит на «Клуб», а не на «Ивенты» (В3);
//   sbros — topup спрашивается через BACK.topup: подсветка сбрасывает открытую форму пополнения (В4).
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
if (!['', 'flat', 'obj', 'sbros'].includes(mutant)) { console.error('не знаю мутанта: ' + mutant); process.exit(2); }
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, parseFloat, isFinite,
  document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    body: { setAttribute() {}, classList: { toggle() {}, add() {}, remove() {} } }, documentElement: { setAttribute() {}, style: {} } },
  window: { Telegram: undefined, location: { search: '', hash: '' }, addEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } },
  navigator: {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  setTimeout() {}, clearTimeout() {}, setInterval() {}, fetch() { return new Promise(() => {}); } };
ctx.self = ctx.window;
vm.createContext(ctx);
const load = (f, src) => vm.runInContext(src || fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f });
const files = fs.readdirSync(root + '/js').filter(f => /\.js$/.test(f)).sort();
let nav = fs.readFileSync(root + '/js/21-navigaciya.js', 'utf8');
const sub = (a, b) => { if (!nav.includes(a)) { console.error('подмена не применилась: ' + a.slice(0, 60)); process.exit(2); }
  nav = nav.replace(a, b); console.log('подлог наложен: ' + mutant); };
if (mutant === 'flat') sub("s = b && typeof b === 'object' ? b.s : b || homeOf();", 's = null;');
if (mutant === 'obj') sub("s = b && typeof b === 'object' ? b.s : b || homeOf();", 's = b || homeOf();');
if (mutant === 'sbros') sub("var b = s === 'topup' ? topupUp() : BACK[s];", 'var b = BACK[s];');
for (const f of files) {
  // верх файлов зовёт DOM и запуск; нужное — объявления функций и таблиц, они подняты до первой ошибки файла
  try { load('js/' + f, f === '21-navigaciya.js' ? nav : undefined); } catch (e) { /* молча: проверяется ниже наличием имён */ }
}
const R = c => vm.runInContext(c, ctx);
if (R('typeof tabOf') !== 'function' || R('typeof BACK') !== 'object' || R('typeof topupUp') !== 'function') {
  console.error('tabOf/BACK/topupUp не найдены — прибор не судит'); process.exit(2);
}
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const at = (screen, keys, pre) => { R("LIVE = false; DATA.role = 'member'; param = null; CAL.ret = null; CAL.mode = null; TOPUP.from = 'home'; TUP.online = false; TUP.hist = false;");
  if (pre) R(pre); ctx.__k = keys; R('current = ' + JSON.stringify(screen)); return String(R('tabOf(__k)')); };
const MEMBER = ['home', 'guest', 'events'];

// В0 (контроль различения): экран-вкладка отмечает сам себя — у всех мутантов тоже
check('В0 «Ивенты» — сама вкладка', at('events', MEMBER), 'events');
// В1: «Мероприятие» из афиши → «Ивенты» (BACK.event → calendar не вкладка → calBack → events: два шага)
check('В1 «Мероприятие» → «Ивенты»', at('event', MEMBER), 'events');
// В2: глубокая цепочка teaReq → teaReqs → masters → manage
check('В2 «Согласование» → «Управление»', at('teaReq', MEMBER.concat('manage')), 'manage');
// В3: шаг объектом {s, p}: thanks → {s: 'event'} → events
check('В3 «Благодарность» → «Ивенты»', at('thanks', MEMBER, 'TH.id = 7'), 'events');
// В4: открытая форма пополнения — вкладка «Клуб», и форма НЕ сброшена подсветкой
check('В4 «Пополнить» с открытой формой → «Клуб», форма цела',
  at('topup', MEMBER, 'TUP.online = true') + (R('TUP.online') ? '' : ' + форма сброшена'), 'home');
// В5: экран без своей строки в BACK — туда же, куда кнопка «назад» (homeOf)
check('В5 «Пропуск» → «Клуб»', at('pass', MEMBER), 'home');
// В6: цепочка не доходит ни до одной вкладки — не отмечено ничего, и цикл не висит
check('В6 вкладок цепочки нет — ничего', at('events', ['staff']), 'null');

const red = ok.filter(x => !x).length;
console.log(red ? 'КРАСНОЕ: ' + red + ' из ' + ok.length : 'ЗЕЛЁНОЕ: ' + ok.length + ' из ' + ok.length);
process.exit(red ? 1 : 0);
