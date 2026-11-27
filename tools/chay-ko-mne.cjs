// Случаи экрана «Брони ко мне» (teaToMe, рецепт _docs/recept/ekran/42/teaToMe.md, №98) без браузера:
//   node tools/chay-ko-mne.cjs <корень клиента> [мутант]
// Форма ответа — сервер cafe13-api a04c4dd (бой 27.11.2026), app/routers/tea_bookings.py:
//   GET /tea/bookings/to-me → список _row(queue=True) {id, master_id, master_name, guest_name, starts_at, duration_min,
//   price строкой, status pending|master_ok|approved|rejected, status_ru, note, refunded, refused_by_master,
//   created_at, decided_at, master_ok_at}; POST /tea/bookings/{id}/accept → та же строка; чужому — 403, не из pending — 409.
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1):
//   chej       — teaMayAccept не спрашивает «чей мастер»: кнопка у чужой брони (краснеет С2);
//   nopending  — teaMayAccept не спрашивает состояние: кнопка у брони, уже ушедшей арт-директору (С1, после согласия);
//   nomasterok — master_ok снят с TEA_BOOK_ST: бронь в master_ok отбрасывает весь список (С3; и С1 — ответ accept
//                в master_ok не разбирается).
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const known = ['', 'chej', 'nopending', 'nomasterok'];
if (!known.includes(mutant)) { console.error('не знаю мутанта: ' + mutant); process.exit(2); }
let reply = null, list = null, hold = false, held = null;   // reply — ответ на согласие, list — на GET to-me
const calls = [];
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, isFinite,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'teaToMe', FLASH: null, haptic() {}, render() {}, go() {},
  svg: () => '', ICON: {},
  failText: r => 'код ' + r.status, DATA: { member: { uid: 4242, balance: 5000 } }, API: '', closed: () => false,
  // как denyText (js/06-lyudi.js): слова сервера с заглавной и точкой
  denyText: r => r.data && r.data.detail ? r.data.detail[0].toUpperCase() + r.data.detail.slice(1) + '.' : 'код ' + r.status,
  ymdAdd: (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  DOW_SHORT: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  MONTHS: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bkk: d => ({ ymd: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
               hm: d.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }) }),
  api(m, u) { calls.push(m + ' ' + u); const r = /\/to-me$/.test(u) ? list : reply; return { then(f) { if (hold) held = () => f(r); else f(r); } }; } };
vm.createContext(ctx);
const sub = (src, a, b) => { if (!src.includes(a)) throw 'подмена не применилась: ' + a.slice(0, 60); console.log('подлог наложен'); return src.replace(a, b); };
const slova = fs.readFileSync(root + '/js/00-slova.js', 'utf8');
let src = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
if (mutant === 'chej') src = sub(src, "my !== null && b.master === my; }", "my !== null; }");
if (mutant === 'nopending') src = sub(src, "return b.status === 'pending' && my !== null", "return my !== null");
if (mutant === 'nomasterok') src = sub(src, "pending: 'wait', master_ok: 'wait', approved:", "pending: 'wait', approved:");
vm.runInContext(slova, ctx, { filename: '00' });
vm.runInContext(fs.readFileSync(root + '/js/10-utility.js', 'utf8'), ctx, { filename: '10' });
vm.runInContext(src, ctx, { filename: '22' });
const R = c => vm.runInContext(c, ctx);
// flash (js/21-navigaciya.js) — показать и погасить
R(`flash = function () { var t = FLASH; FLASH = null; return '<flash>' + (typeof t === 'string' ? t : t.text) + '</flash>'; }`);
const STATUS_RU = { pending: 'ждёт решения', master_ok: 'мастер согласился, ждёт арт-директора', approved: 'согласовано',
  rejected: 'отклонено, деньги возвращены на счёт' };
const row = (id, master, st, over) => Object.assign({ id, master_id: master, master_name: 'Образец', guest_name: 'Гость Образцов',
  starts_at: '2026-12-02T12:07:00Z', duration_min: 90, price: '600.00', status: st, status_ru: STATUS_RU[st],
  note: null, refunded: false, refused_by_master: false, created_at: '2026-11-27T01:00:00Z', decided_at: null,
  master_ok_at: st === 'master_ok' ? '2026-11-27T01:30:00Z' : null }, over || {});
// своя карточка мастера 3 (GET /tea/card/mine): номер мастера — номер первой подачи
const mine = id => R(`TEA.mine = ${id === null ? 'null' : `{ status: 'approved', note: '', card: { id: ${id} }, live: { id: ${id} } }`}; TEA.mineFail = ''`);
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const enter = data => { calls.length = 0; list = { status: 200, data }; R(`current = 'home'`); R(`teaGo('teaToMe')`); R(`current = 'teaToMe'`); };
const screen = () => R(`SCREENS.teaToMe()`);
const btn = (h, id) => h.includes(`data-action="tea-tome-accept:${id}"`);
const press = (id, r) => { calls.length = 0; reply = r; R(`teaAction('tea-tome-accept', '${id}')`); };

// С1 tea-ko-mne-soglasie: своя ждущая — кнопка есть; нажатие сразу гасит её; 200 — слово сервера про арт-директора, кнопки нет
mine(3); enter([row(31, 3, 'pending')]);
check('С1 адрес списка', calls.join(','), 'GET /tea/bookings/to-me');
let h = screen();
check('С1 своя ждущая — кнопка «Согласиться»', btn(h, 31) && h.includes('>Согласиться<') ? 'есть' : 'нет', 'есть');
hold = true; press(31, { status: 200, data: row(31, 3, 'master_ok') });
h = screen();
check('С1 сразу: запрос ушёл, кнопка погашена', calls.join(',') + '/' + (/tea-tome-accept:31" disabled/.test(h) && h.includes('Отправляем…') ? 'погашена' : 'живая'),
  'POST /tea/bookings/31/accept/погашена');
R(`teaAction('tea-tome-accept', '31')`);
check('С1 второе нажатие запроса не шлёт', String(calls.length), '1');
hold = false; held();
h = screen();
check('С1 после 200: слово сервера, кнопки нет, весть про арт-директора',
  (h.includes('мастер согласился, ждёт арт-директора') ? 'слово' : '-') + '/' + (btn(h, 31) ? 'кнопка' : 'нет') + '/' +
  (h.includes('<flash>Вы согласились. Бронь ушла арт-директору — решает он.</flash>') ? 'весть' : '-'), 'слово/нет/весть');
check('С1 бронь осталась в списке', String((h.match(/data-tome="/g) || []).length), '1');

// С2 tea-ko-mne-chuzhoj: ждущая ДРУГОГО мастера (5) у мастера 3 — строка есть, кнопки нет; без своей карточки — кнопки нет ни у кого
mine(3); enter([row(32, 5, 'pending'), row(35, 3, 'pending')]);
h = screen();
check('С2 чужая ждущая — строка есть, кнопки нет', (h.includes('data-tome="32"') ? 'строка' : '-') + '/' + (btn(h, 32) ? 'кнопка' : 'нет'), 'строка/нет');
check('С2 своя рядом — кнопка есть', btn(h, 35) ? 'есть' : 'нет', 'есть');
press(32, { status: 403, data: { detail: 'согласиться на бронь может только её мастер' } });
check('С2 нажатие на чужую запроса не шлёт', String(calls.length), '0');
mine(null); R(`TEA.mineFail = 'код 500'`); enter([row(36, 3, 'pending')]);
h = screen();
check('С2 своей карточки нет — кнопки нет, строка есть', (h.includes('data-tome="36"') ? 'строка' : '-') + '/' + (btn(h, 36) ? 'кнопка' : 'нет'), 'строка/нет');

// С3 tea-ko-mne-master-ok: бронь в master_ok рядом с ждущей — список не пустеет, обе в нём
mine(3); enter([row(33, 3, 'pending'), row(34, 3, 'master_ok')]);
h = screen();
check('С3 master_ok рядом с ждущей — обе в списке', String((h.match(/data-tome="/g) || []).length) + '/' + R(`TEA.toMeFail`), '2/');
check('С3 у master_ok кнопки нет', btn(h, 34) ? 'кнопка' : 'нет', 'нет');

// С4 tea-ko-mne-slovo-servera: слово состояния — status_ru печатью, своего клиент не подставляет
mine(3); enter([row(37, 3, 'approved', { status_ru: 'согласовано сервером (слово-образец)' })]);
h = screen();
check('С4 status_ru печатью', h.includes('<span class="st ok"><span class="verbatim">согласовано сервером (слово-образец)</span></span>') ? 'печать' : 'нет', 'печать');

// С5 tea-ko-mne-otkaz: 409 на согласие — слова сервера под бронью, список перечитан
mine(3); enter([row(38, 3, 'pending')]);
press(38, { status: 409, data: { detail: 'бронь уже не ждёт мастера: согласовано' } });
check('С5 перечитан список', calls.join(','), 'POST /tea/bookings/38/accept,GET /tea/bookings/to-me');
h = screen();
check('С5 слова сервера под бронью', h.includes('<span class="verbatim">Бронь уже не ждёт мастера: согласовано.</span>') ? 'есть' : 'нет', 'есть');

// С6: пусто и незнакомое состояние
mine(3); enter([]);
check('С6 пусто', screen().includes('Броней пока нет') ? 'пусто' : 'нет', 'пусто');
enter([row(39, 3, 'cancelled', { status_ru: 'отменено' })]);
check('С6 незнакомый status — не принято', screen().includes('Брони не загрузились') ? 'не загрузилось' : 'принято', 'не загрузилось');

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
