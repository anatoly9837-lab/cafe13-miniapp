// Случаи «текст K4b и свои брони» (шаг 42) без браузера: node tools/chay-broni.cjs <корень клиента> [мутант]
// Форма ответа — сервер cafe13-api a6d4d4c, app/routers/tea_bookings.py: GET /tea/bookings/mine → список _row()
// {id, master_id, master_name, starts_at, duration_min, price строкой, status pending|approved|rejected, status_ru,
//  note, refunded, created_at, decided_at} — ВСЕ брони гостя, новые сверху. Решает только арт-директор (decide).
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1, и только на своих случаях):
//   master   — K4b снова обещает отказ мастера («Если мастер откажет…»): краснеет Т1 и только он;
//   masterart — разбор ждёт полей master/art, как до сверки с a6d4d4c: свои брони отбрасываются целиком (Т2–Т4);
//   nofilter — брони чужого мастера не отсеиваются (Т3);
//   notealways — слова арт-директора .said и под согласованной (Т6; мутант arhitector11-57): сервер принимает note
//   при любом решении (master.Decision), а рецепт B12 показывает .said только под отказом.
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
let reply = null;
const calls = [];
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, isFinite,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'teaBook', FLASH: null, haptic() {}, render() {}, go() {}, svg: () => '',
  failText: r => 'код ' + r.status, DATA: { member: { uid: 4242, balance: 5000 } }, API: '', closed: () => false,
  DOW_SHORT: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  MONTHS: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bkk: d => ({ ymd: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
               hm: d.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }) }),
  api(m, u) { calls.push(m + ' ' + u); return { then(f) { f(reply); } }; } };
vm.createContext(ctx);
const sub = (src, a, b) => { if (!src.includes(a)) throw 'подмена не применилась: ' + a.slice(0, 60); console.log('подлог наложен'); return src.replace(a, b); };
let slova = fs.readFileSync(root + '/js/00-slova.js', 'utf8');
let src = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
if (mutant === 'master') slova = sub(slova, 'Если арт-директор откажет, деньги вернутся полностью.', 'Если мастер откажет, деньги вернутся полностью.');
if (mutant === 'masterart') src = sub(src, "|| !st || typeof b.master_id !== 'number') return null;",
  "|| !st || typeof b.master_id !== 'number' || !({ wait: 1, ok: 1, no: 1 })[b.master] || !({ wait: 1, ok: 1, no: 1 })[b.art]) return null;");
if (mutant === 'notealways') src = sub(src, "(b.st === 'no' && b.note ?", "(b.note ?");
if (mutant === 'nofilter') src = sub(src, '? got.filter(function (b) { return String(b.master) === String(id); }) : null;', '? got : null;');
vm.runInContext(slova, ctx, { filename: '00' });
vm.runInContext(fs.readFileSync(root + '/js/10-utility.js', 'utf8'), ctx, { filename: '10' });
vm.runInContext(src, ctx, { filename: '22' });
const R = c => vm.runInContext(c, ctx);
R(`TEA_URL.myBooks = function () { return '/tea/bookings/mine'; }`);   // в бою адреса нет до выкладки api — включаем здесь
R(`TEA.mine = { status: 'none', note: '', card: null, live: null }`);
const card = id => ({ master_id: id, name: 'Образец', about: 'Пуэр.', price: '600.00', duration_min: 90, shots: 0,
  status: 'approved', approved_at: '2026-11-25T21:58:34.566750Z' });
// строка брони ровно в форме tea_bookings._row (очередь — без guest_name)
const row = (id, master, st, over) => Object.assign({ id, master_id: master, master_name: 'Образец',
  starts_at: '2026-12-02T12:07:00Z', duration_min: 90, price: '600.00', status: st,
  status_ru: { pending: 'ждёт решения', approved: 'согласовано', rejected: 'отклонено, деньги возвращены на счёт' }[st],
  note: null, refunded: false, created_at: '2026-11-26T01:00:00Z', decided_at: null }, over || {});
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const load = (id, data) => { reply = { status: 200, data }; R(`TEA.books = {}; teaLoadBooks(${id})`); return R(`TEA.books[${id}]`); };
const screen = id => { R(`TEA.card = teaCardFrom(${JSON.stringify(card(id))}); TEA.cardFail = ''; TEA.cardGone = false`); return R(`SCREENS.teaBook()`); };
const words = k => R(`slovo('${k}')`);

// Т1: K4b под ценой обещает только то, что сервер исполняет — отказ АРТ-ДИРЕКТОРА (decide), не мастера
const k = R(`teaCardHtml(teaCardFrom(${JSON.stringify(card(3))}), { book: true })`);
check('Т1 K4b — арт-директор, не мастер',
  (k.includes('Если арт-директор откажет, деньги вернутся полностью.') ? 'арт' : '') + (k.includes('мастер откажет') ? 'мастер' : ''), 'арт');
// Т2: ждущая бронь в форме сервера попадает в список, состояние wait, адрес — /tea/bookings/mine без номера
calls.length = 0;
const b2 = load(3, [row(21, 3, 'pending')]);
check('Т2 ждущая попадает в список', b2 ? b2.length + ':' + b2[0].st : 'отброшено', '1:wait');
check('Т2 адрес', calls.join(','), 'GET /tea/bookings/mine');
const h2 = screen(3);
check('Т2 B11 «ждёт согласования», строки «Мастер» нет',
  (h2.includes(words('tea.book.stWait')) ? 'ждёт' : '-') + '/' + (/>Мастер</.test(h2) ? 'Мастер' : 'нет'), 'ждёт/нет');
// Т3: список гостя по всем мастерам — у экрана мастера 3 только его брони (согласованная), чужая (мастер 5) — нет
const b3 = load(3, [row(23, 5, 'pending'), row(22, 3, 'approved', { decided_at: '2026-11-26T02:00:00Z' })]);
check('Т3 только брони этого мастера', b3 ? b3.map(b => b.master + ':' + b.st).join(',') : 'отброшено', '3:ok');
// Т4: отказ арт-директора со словами — вся цена обратно (B12 с суммой) и его слова (.said)
const b4 = load(3, [row(24, 3, 'rejected', { refunded: true, note: 'В этот день клуб закрыт.', price: '1500.50' })]);
const h4 = screen(3);
check('Т4 отказ: refund = price', b4 ? String(b4[0].refund) : 'отброшено', '1500.50');
check('Т4 B12 сумма и слова арт-директора',
  (h4.includes('1 500.50 ฿ вернулись на счёт.') ? 'сумма' : '-') + '/' + (h4.includes('<span class="said">В этот день клуб закрыт.</span>') ? 'слова' : '-'), 'сумма/слова');
// Т5: незнакомое состояние — список не выдумывается (весь ответ не принят, как прежде)
const b5 = load(3, [row(25, 3, 'cancelled')]);
check('Т5 незнакомый status — не принято', b5 === null ? 'null' : JSON.stringify(b5), 'null');
// Т6: согласованная со словами арт-директора — состояние «согласована», а .said и суммы возврата нет (B12 — только отказ)
load(3, [row(26, 3, 'approved', { note: 'Ждём вас к 19:00.', decided_at: '2026-11-26T02:00:00Z' })]);
const h6 = screen(3);
check('Т6 согласованная со словами — без .said и возврата',
  (h6.includes(words('tea.book.stOk')) ? 'согласована' : '-') + '/' + (h6.includes('class="said"') ? 'said' : 'нет') + '/' +
  (h6.includes('вернулись на счёт') ? 'возврат' : 'нет'), 'согласована/нет/нет');

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
