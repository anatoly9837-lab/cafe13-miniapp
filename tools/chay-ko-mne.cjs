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
//                в master_ok не разбирается);
//   norefund   — строка T10 «… ฿ вернулись гостю на счёт.» снята: краснеют С7 (после отказа) и С8 (возврат в списке);
// мутанты arhitector32 (ревью #504, ~/.cache/arhitector32/p504/mut.py, образцы те же):
//   refbusy    — teaRefuseSend не спрашивает TTM.busy: второй отказ при висящем ответе (A1);
//   refnodeny  — отказ сервера на refuse без слов под бронью (A2 слова);
//   refwipe    — отказ сервера стирает набранную причину (A2 поле);
//   maxlen     — maxlength поля причины 501 вместо 500 MasterRefusal (A3);
// и по его находкам:
//   minerender — loadTeaMine не перерисовывает teaToMe: поздняя карточка не даёт кнопок (A4);
//   flashrefund — весть «Деньги вернулись» без оглядки на refunded (A5).
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const known = ['', 'chej', 'nopending', 'nomasterok', 'norefund', 'refbusy', 'refnodeny', 'refwipe', 'maxlen', 'minerender', 'flashrefund'];
if (!known.includes(mutant)) { console.error('не знаю мутанта: ' + mutant); process.exit(2); }
let reply = null, list = null, mineR = null, hold = false, held = null, renders = 0, holdMine = false, heldMine = null;   // reply — ответ на согласие, list — на GET to-me
const calls = [];
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, isFinite,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'teaToMe', FLASH: null, haptic() {}, render() { renders++; }, go() {},
  svg: () => '', ICON: {},
  failText: r => 'код ' + r.status, DATA: { member: { uid: 4242, balance: 5000 } }, API: '', closed: () => false,
  // как denyText (js/06-lyudi.js): слова сервера с заглавной и точкой
  denyText: r => r.data && r.data.detail ? r.data.detail[0].toUpperCase() + r.data.detail.slice(1) + '.' : 'код ' + r.status,
  ymdAdd: (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  DOW_SHORT: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  MONTHS: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bkk: d => ({ ymd: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
               hm: d.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }) }),
  api(m, u) { calls.push(m + ' ' + u); const r = /\/to-me$/.test(u) ? list : /\/tea\/card\/mine$/.test(u) ? mineR : reply; const mineUrl = /\/tea\/card\/mine$/.test(u); return { then(f) { if (holdMine && mineUrl) heldMine = () => f(mineR) /* ответ — в момент прихода */; else if (hold) held = () => f(r); else f(r); } }; } };
vm.createContext(ctx);
const sub = (src, a, b) => { if (!src.includes(a)) throw 'подмена не применилась: ' + a.slice(0, 60); console.log('подлог наложен'); return src.replace(a, b); };
const slova = fs.readFileSync(root + '/js/00-slova.js', 'utf8');
let src = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
if (mutant === 'chej') src = sub(src, "my !== null && b.master === my; }", "my !== null; }");
if (mutant === 'nopending') src = sub(src, "return b.status === 'pending' && my !== null", "return my !== null");
if (mutant === 'norefund') src = sub(src, "(b.status === 'rejected' && b.refunded && b.price !== null ?", "(false ?");
if (mutant === 'refbusy') src = sub(src, "if (TTM.busy !== null || !b || !teaMayAccept(b) || TTM.open !== id) return;", "if (!b || !teaMayAccept(b) || TTM.open !== id) return;");
if (mutant === 'refnodeny') src = sub(src, "FLASH = slovo(nb.refunded ? 'tea.toMe.refusedDone' : 'tea.toMe.refusedPlain'); haptic('ok'); }\n    else { TTM.deny[id] = denyText(r);", "FLASH = slovo(nb.refunded ? 'tea.toMe.refusedDone' : 'tea.toMe.refusedPlain'); haptic('ok'); }\n    else {");
if (mutant === 'refwipe') src = sub(src, "FLASH = slovo(nb.refunded ? 'tea.toMe.refusedDone' : 'tea.toMe.refusedPlain'); haptic('ok'); }\n    else { TTM.deny[id]", "FLASH = slovo(nb.refunded ? 'tea.toMe.refusedDone' : 'tea.toMe.refusedPlain'); haptic('ok'); }\n    else { TTM.note = ''; TTM.deny[id]");
if (mutant === 'maxlen') src = sub(src, 'maxlength="500"', 'maxlength="501"');
if (mutant === 'minerender') src = sub(src, "teaBook: 1, teaToMe: 1 });   // teaToMe", "teaBook: 1 });   // teaToMe");
if (mutant === 'flashrefund') src = sub(src, "slovo(nb.refunded ? 'tea.toMe.refusedDone' : 'tea.toMe.refusedPlain')", "slovo('tea.toMe.refusedDone')");
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
check('С2 у чужой нет и «Отказаться»', h.includes('data-action="tea-tome-refuse:32"') ? 'кнопка' : 'нет', 'нет');
R(`teaAction('tea-tome-refuse', '32')`);
check('С2 отказ чужой не раскрывается', R(`String(TTM.open)`), 'null');
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

// С7 tea-ko-mne-otkaz-mastera: «Отказаться» только раскрывает поле, деньги уходят по «Отказать и вернуть деньги»
mine(3); enter([row(40, 3, 'pending', { price: '1500.50' })]);
h = screen();
check('С7 своя ждущая — «Отказаться» есть', h.includes('data-action="tea-tome-refuse:40"') && h.includes('>Отказаться<') ? 'есть' : 'нет', 'есть');
calls.length = 0; R(`teaAction('tea-tome-refuse', '40')`);
h = screen();
check('С7 первый шаг запроса не шлёт, поле раскрыто', String(calls.length) + '/' + (h.includes('id="ttm-note"') && h.includes('Отказать и вернуть деньги') ? 'поле' : '-'), '0/поле');
R(`TTM.note = '  Заболел, простите.  '`);
let body = null; const api0 = ctx.api; ctx.api = (m, u, b) => { body = b; return api0(m, u, b); };
calls.length = 0; reply = { status: 200, data: row(40, 3, 'rejected', { price: '1500.50', refunded: true, refused_by_master: true,
  note: 'Заболел, простите.', decided_at: '2026-11-27T02:00:00Z' }) };
R(`teaAction('tea-tome-refuse-send', '40')`); ctx.api = api0;
check('С7 второй шаг: адрес и тело', calls.join(',') + ' ' + JSON.stringify(body), 'POST /tea/bookings/40/refuse {"note":"Заболел, простите."}');
h = screen();
check('С7 после 200: слово сервера, вид no, кнопок нет, весть',
  (h.includes('<span class="st no"><span class="verbatim">отклонено, деньги возвращены на счёт</span>') ? 'слово' : '-') + '/' +
  (/tea-tome-(accept|refuse)/.test(h) ? 'кнопки' : 'нет') + '/' +
  (h.includes('<flash>Вы отказались. Деньги вернулись гостю на счёт.</flash>') ? 'весть' : '-'), 'слово/нет/весть');
check('С7 строка о возврате с суммой', h.includes('1 500.50 ฿ вернулись гостю на счёт.') ? 'есть' : 'нет', 'есть');

// С8 tea-ko-mne-vozvrat: отказанная с возвратом в списке — строка о возврате; без возврата — строки нет
mine(3); enter([row(41, 3, 'rejected', { refunded: true, refused_by_master: true }), row(42, 3, 'rejected', { refunded: false })]);
h = screen();
check('С8 возврат виден у refunded и только у неё', String((h.match(/600\.00 ฿ вернулись гостю на счёт\./g) || []).length), '1');

// ── arhitector32 (ревью #504): A1–A3 — его случаи, взяты из ~/.cache/arhitector32/p504/arh32-sluchai.cjs ──
const press2 = (a, id) => R(`teaAction('${a}', '${id}')`);
// A1: двойное «Отказать и вернуть деньги», пока первый ответ висит — запрос ОДИН; T9 сразу гаснет «Отправляем…»
mine(3); enter([row(50, 3, 'pending')]);
press2('tea-tome-refuse', 50); R(`TTM.note = 'Простите'`);
calls.length = 0; hold = true; reply = { status: 200, data: row(50, 3, 'rejected', { refunded: true, refused_by_master: true }) };
press2('tea-tome-refuse-send', 50); press2('tea-tome-refuse-send', 50);
check('A1 двойной отказ — запрос один', String(calls.filter(c => /refuse$/.test(c)).length), '1');
h = screen();
check('A1 T9 сразу погашен «Отправляем…»', /data-action="tea-tome-refuse-send:50" disabled aria-disabled="true">Отправляем…</.test(h) ? 'погашен' : 'живой', 'погашен');
hold = false; held();
// A2: сервер отказал на refuse (409) — слова под бронью, список перечитан, причина и поле целы
mine(3); enter([row(51, 3, 'pending')]);
press2('tea-tome-refuse', 51); R(`TTM.note = 'Заболел'`);
calls.length = 0; reply = { status: 409, data: { detail: 'бронь уже решена: согласовано' } };
press2('tea-tome-refuse-send', 51);
check('A2 перечитан список', calls.join(','), 'POST /tea/bookings/51/refuse,GET /tea/bookings/to-me');
h = screen();
check('A2 слова сервера под бронью', h.includes('Бронь уже решена: согласовано.') ? 'есть' : 'нет', 'есть');
check('A2 причина и поле целы', R(`TTM.note`) + '/' + (/<textarea id="ttm-note"[^>]*>Заболел<\/textarea>/.test(h) ? 'поле' : '-'), 'Заболел/поле');
// A3: поле причины — не длиннее 500 (MasterRefusal max_length=500)
check('A3 maxlength поля', (h.match(/id="ttm-note"[^>]*maxlength="(\d+)"/) || [])[1] || 'нет', '500');
// A4 (находка arhitector32): список пришёл раньше своей карточки — по приходу карточки экран перерисован и кнопки есть
mine(null); hold = false;
const card3 = { master_id: 3, name: 'Образец', about: 'Пуэр.', price: '600.00', duration_min: 90, shots: 0, status: 'approved', approved_at: '2026-11-25T21:58:34Z' };
calls.length = 0; list = { status: 200, data: [row(52, 3, 'pending')] };
R(`current = 'home'`); holdMine = true; R(`teaGo('teaToMe')`); R(`current = 'teaToMe'`); holdMine = false;   // список — сразу, карточка висит
check('A4 запрос карточки ушёл и висит', calls.join(',') + '/' + (heldMine ? 'висит' : '-'), 'GET /tea/card/mine,GET /tea/bookings/to-me/висит');
check('A4 до карточки кнопок нет', btn(screen(), 52) ? 'кнопка' : 'нет', 'нет');
mineR = { status: 200, data: { status: 'approved', note: '', card: card3, live: card3 } };
renders = 0; heldMine();
check('A4 карточка пришла — перерисовано, кнопка есть', String(renders > 0) + '/' + (btn(screen(), 52) ? 'кнопка' : 'нет'), 'true/кнопка');
// A5 (замечание arhitector32): ответ отказа без возврата — весть не обещает деньги
mine(3); enter([row(53, 3, 'pending')]);
press2('tea-tome-refuse', 53);
reply = { status: 200, data: row(53, 3, 'rejected', { refunded: false, refused_by_master: true }) };
press2('tea-tome-refuse-send', 53);
h = screen();
check('A5 без refunded — весть без денег', h.includes('<flash>Вы отказались.</flash>') ? 'без денег' : h.includes('Деньги вернулись') ? 'обещает деньги' : 'нет вести', 'без денег');

// С6: пусто и незнакомое состояние
mine(3); enter([]);
check('С6 пусто', screen().includes('Броней пока нет') ? 'пусто' : 'нет', 'пусто');
enter([row(39, 3, 'cancelled', { status_ru: 'отменено' })]);
check('С6 незнакомый status — не принято', screen().includes('Брони не загрузились') ? 'не загрузилось' : 'принято', 'не загрузилось');

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
