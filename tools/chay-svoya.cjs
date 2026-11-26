// Случаи «своя карточка мастера» (шаг 42, ЧАЙ-A) без браузера: node tools/chay-svoya.cjs <корень клиента> [uid]
// Форма ответов — снимок api#228 (tea-card-mine-*.json, tea-masters.json): master_id — номер ПЕРВОЙ подачи, не Telegram id.
// nozov — мутант «вход на карточку не читает свою»: обязан дать КРАСНОЕ (С1); nobook — K5 при закрытом teaBook (С8).
// uid — мутант «сверять master_id с Telegram id (DATA.member.uid)», как было до сверки с api#228: обязан дать КРАСНОЕ и rc=1.
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
const calls = [];
let reply = null;   // ответ подменённого api на GET /tea/card/mine
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'teaMaster', haptic() {}, render() {}, go() {}, svg: () => '',
  failText: r => 'код ' + r.status, DATA: { member: { uid: 4242 } }, API: '',
  // дверь teaBook: открыта в С1–С7 (так они и писались), закрыта в С8 — как на бою, пока POST /tea/bookings нет
  SHUT: {}, closed(k) { return !!ctx.SHUT[k]; },
  api(m, u) { calls.push(m + ' ' + u); return { then(f) { f(reply); } }; } };
vm.createContext(ctx);
for (const f of ['js/00-slova.js', 'js/10-utility.js']) vm.runInContext(fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f });
let src = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
if (mutant === 'uid') {
  const a = 'function teaIsMine(c) { var my = teaMyId(); return LIVE && my !== null && c.id === my; }';
  if (!src.includes(a)) throw 'подмена не применилась';
  src = src.replace(a, "function teaIsMine(c) { return LIVE && !!DATA.member && typeof DATA.member.uid === 'number' && c.id === DATA.member.uid; }");
  console.log('подлог наложен');
}
// nobook — мутант «K5 рисуется и при закрытом teaBook»: обязан дать КРАСНОЕ (С8)
if (mutant === 'nobook') {
  const a = "    : closed('teaBook') ? '' : '<button";
  if (!src.includes(a)) throw 'подмена не применилась';
  src = src.replace(a, "    : '<button"); console.log('подлог наложен');
}
if (mutant === 'nozov') {
  const a = "  if ((screen === 'teaMaster' || screen === 'teaBook') && LIVE && !TEA.mine && !TEA.mineFail) loadTeaMine();";
  if (!src.includes(a)) throw 'подмена не применилась';
  src = src.replace(a, ''); console.log('подлог наложен');
}
vm.runInContext(src, ctx, { filename: '22' });
const R = c => vm.runInContext(c, ctx);
R(`TEA_URL.mine = function () { return '/tea/card/mine'; }`);
const card = (id, st) => ({ master_id: id, name: 'Образец', about: 'Пуэр.', price: '600.00', duration_min: 90, shots: 0,
  status: st, approved_at: st === 'approved' ? '2026-11-25T21:58:34.566750Z' : null });
const mine = R(`slovo('tea.card.mine')`);
const foot = id => { const h = R(`teaCardHtml(teaCardFrom(${JSON.stringify(card(id, 'approved'))}), { book: true })`);
  return h.includes(mine) && !h.includes('tea-book:') ? 'своя' : h.includes('tea-book:' + id) && !h.includes(mine) ? 'запись' : '??'; };
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };

// С1: своя карточка не загружена — входом на карточку она запрашивается
R(`TEA.mine = null; TEA.mineFail = ''`); calls.length = 0;
reply = { status: 200, data: { status: 'approved', note: '', card: card(1, 'approved'), live: card(1, 'approved') } };
R(`teaGo('teaMaster', 1)`);
check('С1 вход на карточку читает /tea/card/mine', calls.includes('GET /tea/card/mine') ? 'да' : 'нет', 'да');
// С2: мастер (Telegram 4242, master_id 1) на своей карточке — «это ваша», без записи
check('С2 своя (master_id 1) у мастера', foot(1), 'своя');
// С3: чужая карточка, чей master_id случайно равен Telegram id смотрящего — запись есть
check('С3 чужая с master_id = Telegram id смотрящего', foot(4242), 'запись');
// С4: правка ждёт (status edit): card и live — одного мастера, своя узнаётся
reply = { status: 200, data: { status: 'edit', note: '', card: card(1, 'pending'), live: card(1, 'approved') } }; R(`loadTeaMine()`);
check('С4 правка ждёт — своя узнаётся', foot(1), 'своя');
// С5: первая подача ждёт (live null) — номер берётся из card
reply = { status: 200, data: { status: 'pending', note: '', card: card(7, 'pending'), live: null } }; R(`loadTeaMine()`);
check('С5 первая подача ждёт — своя по card', foot(7), 'своя');
// С6: карточки нет (none) — любая карточка чужая
reply = { status: 200, data: { status: 'none', note: '', card: null, live: null } }; R(`loadTeaMine()`);
check('С6 карточки нет — у карточки 1 запись', foot(1), 'запись');
// С7: кнопка отправки брони у своей карточки заперта
reply = { status: 200, data: { status: 'approved', note: '', card: card(1, 'approved'), live: card(1, 'approved') } }; R(`loadTeaMine()`);
check('С7 teaIsMine у своей', String(R(`teaIsMine(teaCardFrom(${JSON.stringify(card(1, 'approved'))}))`)), 'true');
// С8: teaBook вне WIRED (брони на сервере нет) — у чужой карточки K5 нет, у своей K6 остаётся
ctx.SHUT.teaBook = 1;
const h8 = id => R(`teaCardHtml(teaCardFrom(${JSON.stringify(card(id, 'approved'))}), { book: true })`);
check('С8 teaBook закрыт — у чужой нет K5, у своей K6',
  (h8(2).includes('tea-book:') ? 'K5' : 'нет') + '/' + (h8(1).includes(mine) ? 'K6' : 'нет'), 'нет/K6');
ctx.SHUT.teaBook = 0;
const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
