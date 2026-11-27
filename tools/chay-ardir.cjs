// Случаи очереди броней и решения арт-директора (teaBooks, teaBookReq; рецепты _docs/recept/ekran/42/teaBooks.md,
// teaBookReq.md, masters.md S2; №98) без браузера:
//   node tools/chay-ardir.cjs <корень клиента> [мутант]
// Форма ответа — сервер cafe13-api a04c4dd (бой 27.11.2026), app/routers/tea_bookings.py:
//   GET /tea/bookings → {bookings: [_row(queue=True)], pending, master_ok}; строка {id, master_id, master_name, guest_name,
//   starts_at, duration_min, price строкой, status pending|master_ok|approved|rejected, status_ru, note, refunded,
//   refused_by_master, created_at, decided_at, master_ok_at}; POST /tea/bookings/{id}/decide {decision, note} → та же
//   строка; по pending — 409 «мастер ещё не согласился…», решённой — 409 «бронь уже решена…».
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1; что именно краснеет — в файле предсказаний ДО прогона):
//   always     — teaMayDecide истинен всегда (условие master_ok снято);
//   norefund   — строка V8 о возврате снята в очереди;
//   refstatus  — строка V8 по слову rejected, без refunded;
//   ownword    — своё слово вместо status_ru в строке очереди;
//   flashsum   — весть U8 без суммы;
//   flashrefund — весть U8 без оглядки на refunded ответа;
//   u10word    — после 409 решение по слову отказа, без перечитывания очереди;
//   nonote     — тело отказа без набранных слов;
//   s2pending  — метка S2 по числу pending, а не master_ok;
//   busy       — teaDecideSend не спрашивает TBQ.busy (второе нажатие при висящем ответе).
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const known = ['', 'always', 'norefund', 'refstatus', 'ownword', 'flashsum', 'flashrefund', 'u10word', 'nonote', 's2pending', 'busy'];
if (!known.includes(mutant)) { console.error('не знаю мутанта: ' + mutant); process.exit(2); }
let queue = null, reply = null, hold = false, held = null;
const calls = [], bodies = [], gos = [];
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, isFinite,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'masters', param: null, FLASH: null, haptic() {}, render() {},
  svg: () => '', ICON: {}, mayMasters: () => true, closed: () => false,
  waitMark: n => typeof n === 'number' && n > 0 ? '<span class="count">' + n + '</span>' : '',
  waitSub: (n, plain) => n === 0 ? 'Ждущих нет' : plain,
  failText: r => 'код ' + r.status, DATA: { member: { uid: 4242, balance: 5000 } }, API: '',
  denyText: r => r.data && r.data.detail ? r.data.detail[0].toUpperCase() + r.data.detail.slice(1) + '.' : 'код ' + r.status,
  ymdAdd: (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  DOW_SHORT: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  MONTHS: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bkk: d => ({ ymd: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
               hm: d.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }) }),
  // ответы по АДРЕСУ: очередь — queue, решение — reply (грабля #504: один ответ на всё даёт ложное красное)
  api(m, u, b) { calls.push(m + ' ' + u); if (b !== undefined) bodies.push(JSON.stringify(b));
    const r = /\/tea\/bookings$/.test(u) ? queue : reply, isQ = /\/tea\/bookings$/.test(u);
    return { then(f) { if (hold && !isQ) held = () => f(r); else f(r); } }; } };
vm.createContext(ctx);
const sub = (src, a, b) => { if (!src.includes(a)) throw 'подмена не применилась: ' + a.slice(0, 60); const out = src.replace(a, b); if (out === src) throw 'подлог не изменил текст'; console.log('подлог наложен: ' + mutant); return out; };
const slova = fs.readFileSync(root + '/js/00-slova.js', 'utf8');
let src = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
if (mutant === 'always') src = sub(src, "function teaMayDecide(b) { return !!b && b.status === 'master_ok'; }", "function teaMayDecide(b) { return !!b; }");
if (mutant === 'norefund') src = sub(src, "text(b, b.status === 'rejected' && b.refunded\n", "text(b, false\n");
if (mutant === 'refstatus') src = sub(src, "text(b, b.status === 'rejected' && b.refunded\n", "text(b, b.status === 'rejected'\n");
if (mutant === 'ownword') src = sub(src, "'<span class=\"st ' + b.st + '\"><span class=\"verbatim\">' + esc(b.word) + '</span></span>';\n    };", "'<span class=\"st ' + b.st + '\"><span class=\"verbatim\">' + esc(b.st === 'ok' ? 'согласована' : b.st === 'no' ? 'отказ' : 'ждёт') + '</span></span>';\n    };");
if (mutant === 'flashsum') src = sub(src, ": nb.status === 'rejected' && nb.refunded ? slovo('tea.bookReq.doneNo', { sum: money(nb.price) }) : nb.word;", ": nb.status === 'rejected' && nb.refunded ? slovo('tea.toMe.refusedDone') : nb.word;");
if (mutant === 'flashrefund') src = sub(src, ": nb.status === 'rejected' && nb.refunded ? slovo('tea.bookReq.doneNo', { sum: money(nb.price) }) : nb.word;", ": slovo('tea.bookReq.doneNo', { sum: money(nb.price) });");
if (mutant === 'u10word') src = sub(src, "if (r.status === 409) { TBQ.list = null; teaLoadQueue(); }", "if (r.status === 409) { TBQ.list = TBQ.list.map(function (x) { return String(x.id) === String(id) ? Object.assign({}, x, { status: 'approved', st: 'ok' }) : x; }); }");
if (mutant === 'nonote') src = sub(src, "note: yes ? '' : String(TBQ.note || '').trim() }", "note: '' }");
if (mutant === 's2pending') src = sub(src, "TBQ.list = got; TBQ.masterOk = d.master_ok; }", "TBQ.list = got; TBQ.masterOk = d.pending; }");
if (mutant === 'busy') src = sub(src, "if (TBQ.busy !== null || !b || !teaMayDecide(b)) return;", "if (!b || !teaMayDecide(b)) return;");
vm.runInContext(slova, ctx, { filename: '00' });
vm.runInContext(fs.readFileSync(root + '/js/10-utility.js', 'utf8'), ctx, { filename: '10' });
vm.runInContext(src, ctx, { filename: '22' });
const R = c => vm.runInContext(c, ctx);
R(`flash = function () { var t = FLASH; FLASH = null; return '<flash>' + (typeof t === 'string' ? t : t.text) + '</flash>'; }`);
// go — как js/21: крючок teaGo ДО смены current/param
R(`go = function (s, p) { __gos.push(s); teaGo(s, p); current = s; param = p || null; }`);
ctx.__gos = gos;
const STATUS_RU = { pending: 'ждёт решения', master_ok: 'мастер согласился, ждёт арт-директора', approved: 'согласовано',
  rejected: 'отклонено, деньги возвращены на счёт' };
const row = (id, st, over) => Object.assign({ id, master_id: 3, master_name: 'Мастер Образцов', guest_name: 'Гость ' + id,
  starts_at: '2026-12-02T12:07:00Z', duration_min: 90, price: '600.00', status: st, status_ru: STATUS_RU[st],
  note: null, refunded: false, refused_by_master: false, created_at: '2026-11-27T01:00:00Z', decided_at: null,
  master_ok_at: st === 'master_ok' ? '2026-11-27T01:30:00Z' : null }, over || {});
const Q = (rows, over) => ({ status: 200, data: Object.assign({ bookings: rows,
  pending: rows.filter(r => r.status === 'pending').length, master_ok: rows.filter(r => r.status === 'master_ok').length }, over || {}) });
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const reset = () => R(`TBQ = { list: null, fail: '', masterOk: null, gen: 0, busy: null, err: '', note: '' }; FLASH = null; current = 'masters'; param = null`);
const enterList = rows => { reset(); queue = Q(rows); calls.length = 0; R(`go('teaBooks')`); };
const openReq = id => { gos.length = 0; R(`go('teaBookReq', ${id})`); };
const list = () => R(`SCREENS.teaBooks()`);
const req = () => R(`SCREENS.teaBookReq(param)`);
const group = (h, label) => { const i = h.indexOf('<span class="label">' + label + '</span>'); if (i < 0) return ''; const j = h.indexOf('<div class="group">', i); return h.slice(i, j < 0 ? undefined : j); };
const ids = s => (s.match(/data-book="(\d+)"/g) || []).map(x => x.replace(/\D/g, '')).join(',');
const hasBtns = h => /data-action="tea-books-(yes|no):/.test(h);

// tea-broni-poryadok: порядок сервера, три группы, переход только у master_ok
enterList([row(11, 'master_ok'), row(12, 'pending'), row(13, 'rejected', { refunded: true })]);
check('poryadok адрес очереди', calls.join(','), 'GET /tea/bookings');
let h = list();
check('poryadok группы по порядку', ['Ждут вашего решения', 'Ждут мастера', 'Решённые'].map(l => h.indexOf('<span class="label">' + l + '</span>')).every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1])) ? 'по порядку' : 'нет', 'по порядку');
check('poryadok в группах', [ids(group(h, 'Ждут вашего решения')), ids(group(h, 'Ждут мастера')), ids(group(h, 'Решённые'))].join(' | '), '11 | 12 | 13');
check('poryadok переход только у master_ok', (h.match(/data-action="tea-books-open:(\d+)"/g) || []).join(','), 'data-action="tea-books-open:11"');
check('poryadok кнопок решения в строках нет', hasBtns(h) ? 'есть' : 'нет', 'нет');
check('poryadok строка: гость, мастер', h.includes('<b class="clamp1">Гость 11</b>') && h.includes('мастер Мастер Образцов · ') ? 'есть' : 'нет', 'есть');

// tea-broni-zhdut-mastera: pending — в «Ждут мастера», без перехода, подпись
enterList([row(21, 'pending')]);
h = list();
check('zhdut-mastera группа', ids(group(h, 'Ждут мастера')) + '/' + ids(group(h, 'Ждут вашего решения')), '21/');
check('zhdut-mastera без перехода', h.includes('tea-books-open:21') ? 'переход' : 'нет', 'нет');
check('zhdut-mastera подпись', h.includes('Решать можно после согласия мастера.') ? 'есть' : 'нет', 'есть');

// tea-broni-slovo-servera: status_ru печатью во всех трёх группах
enterList([row(31, 'master_ok', { status_ru: 'образец-м' }), row(32, 'pending', { status_ru: 'образец-п' }), row(33, 'approved', { status_ru: 'образец-с' })]);
h = list();
check('slovo-servera печать', ['wait">образец-м', 'wait">образец-п', 'ok">образец-с'].map(w => h.includes('<span class="st ' + w.split('"')[0] + '"><span class="verbatim">' + w.split('>')[1] + '</span></span>') ? '+' : '-').join(''), '+++');

// tea-broni-pusto
enterList([]);
h = list();
check('pusto', h.includes('<b>Броней нет</b>') && h.includes('Здесь появятся брони, которые гости делают у чайных мастеров.') ? 'V4' : h.slice(0, 80), 'V4');

// tea-broni-neznakomoe: одна строка с незнакомым состоянием — весь ответ не принят
enterList([row(41, 'master_ok'), row(42, 'cancelled', { status_ru: 'отменено' })]);
h = list();
check('neznakomoe → V5', h.includes('Брони не загрузились') && h.includes('tea-books-retry') && !h.includes('data-book=') ? 'V5' : 'список', 'V5');

// tea-broni-otkaz-vozvrat и tea-broni-vozvrat-tolko-refunded
enterList([row(51, 'rejected', { refunded: true, price: '1500.50' }), row(52, 'rejected', { refunded: false })]);
h = list();
const seg = (h, id) => { const i = h.indexOf('data-book="' + id + '"'); const j = h.indexOf('data-book="', i + 5); return h.slice(i, j < 0 ? undefined : j); };
check('otkaz-vozvrat V8 с суммой', seg(h, 51).includes('<span class="small">1 500.50 ฿ вернулись гостю на счёт.</span>') ? 'есть' : 'нет', 'есть');
check('vozvrat-tolko-refunded без refunded строки нет', seg(h, 52).includes('вернулись гостю') ? 'строка' : 'нет', 'нет');

// tea-broni-vhod: S2 — число master_ok сервера
reset(); queue = Q([row(61, 'master_ok'), row(62, 'master_ok')], { pending: 5 }); R(`current = 'manage'`); R(`go('masters')`);
const entryStub = `function (go, what, sub, mark) { return '[' + go + '|' + what + '|' + sub + '|' + (mark || '') + ']'; }`;
h = R(`teaBooksEntry(${entryStub})`);
check('vhod S2 метка master_ok', h, '[data-go="teaBooks"|Брони церемоний|Мастер согласился — решаете вы|<span class="count">2</span>]');
reset(); R(`TBQ.masterOk = null`);
check('vhod до ответа метки нет', R(`teaBooksEntry(${entryStub})`), '[data-go="teaBooks"|Брони церемоний|Мастер согласился — решаете вы|]');
ctx.closed = s => s === 'teaBooks';
check('vhod дверь закрыта — входа нет', R(`teaBooksEntry(${entryStub})`), '');
ctx.closed = () => false;

// tea-bron-vozvrat-vidno: до нажатия сумма в U4 и на U6
enterList([row(71, 'master_ok', { price: '1500.50' })]); openReq(71);
h = req();
check('vozvrat-vidno U4 и U6', (h.includes('При отказе гостю вернутся все 1 500.50 ฿, доля клуба тоже.') ? 'U4' : '-') + '/' + (h.includes('>Отказать и вернуть 1 500.50 ฿<') ? 'U6' : '-'), 'U4/U6');
check('vozvrat-vidno заголовок — имя гостя', R(`TITLES.teaBookReq`), 'Гость 71');

// tea-bron-reshit-da
enterList([row(81, 'master_ok')]); openReq(81);
calls.length = 0; bodies.length = 0; hold = true; reply = { status: 200, data: row(81, 'approved', { decided_at: '2026-11-27T03:00:00Z' }) };
queue = Q([reply.data]);   // очередь после решения — как отдал бы сервер: go('teaBooks') её перечитывает
R(`teaAction('tea-books-yes', '81')`);
h = req();
check('reshit-da сразу: запрос и гашение', calls.join(',') + ' ' + bodies.join('') + ' ' + (/tea-books-yes:81" disabled/.test(h) && /tea-books-no:81" disabled/.test(h) && h.includes('Отправляем…') ? 'погашены' : 'живые'),
  'POST /tea/bookings/81/decide {"decision":"approved","note":""} погашены');
R(`teaAction('tea-books-yes', '81')`);
check('reshit-da второе нажатие запроса не шлёт', String(calls.length), '1');
hold = false; held();
h = R(`SCREENS[current](param)`);
check('reshit-da после 200: очередь, весть, в «Решённых»', R(`current`) + '/' + (h.includes('<flash>Бронь согласована.</flash>') ? 'весть' : '-') + '/' + ids(group(h, 'Решённые')), 'teaBooks/весть/81');

// tea-bron-reshit-net: отказ со словами; весть с суммой из ОТВЕТА
enterList([row(91, 'master_ok', { price: '600.00' })]); openReq(91);
R(`TBQ.note = '  Клуб закрыт на ремонт.  '`);
calls.length = 0; bodies.length = 0;
reply = { status: 200, data: row(91, 'rejected', { refunded: true, price: '700.00', note: 'Клуб закрыт на ремонт.' }) };
queue = Q([reply.data]);
R(`teaAction('tea-books-no', '91')`);
check('reshit-net тело', bodies.join(''), '{"decision":"rejected","note":"Клуб закрыт на ремонт."}');
h = R(`SCREENS[current](param)`);
check('reshit-net весть U8 с суммой ответа', h.includes('<flash>Вы отказали. 700.00 ฿ вернулись гостю на счёт.</flash>') ? 'U8' : h.slice(0, 120), 'U8');
check('reshit-net в «Решённых» строка возврата', seg(h, 91).includes('700.00 ฿ вернулись гостю на счёт.') ? 'V8' : 'нет', 'V8');
// отказ без refunded — весть словом сервера, без обещания денег
enterList([row(92, 'master_ok')]); openReq(92);
reply = { status: 200, data: row(92, 'rejected', { refunded: false, status_ru: 'отклонено (образец без возврата)' }) };
queue = Q([reply.data]);
R(`teaAction('tea-books-no', '92')`);
h = R(`SCREENS[current](param)`);
check('reshit-net без refunded — слово сервера', h.includes('<flash>отклонено (образец без возврата)</flash>') ? 'слово' : h.slice(0, 120), 'слово');

// tea-bron-master-ne-soglasilsya: pending на экране решения — кнопок нет, U10
enterList([row(101, 'pending')]); openReq(101);
h = req();
check('master-ne-soglasilsya кнопок нет, U10', (hasBtns(h) ? 'кнопки' : 'нет') + '/' + (h.includes('Мастер ещё не согласился. Решать можно после его согласия.') ? 'U10' : '-') + '/' + (h.includes('tea-books-back') ? 'к очереди' : '-'), 'нет/U10/к очереди');
calls.length = 0; R(`teaAction('tea-books-yes', '101')`);
check('master-ne-soglasilsya нажатие мимо предиката запроса не шлёт', String(calls.length), '0');

// tea-bron-409-pending: 409, перечитанная — pending → U10 того же слова
enterList([row(111, 'master_ok')]); openReq(111);
calls.length = 0; reply = { status: 409, data: { detail: 'мастер ещё не согласился: бронь решается после согласия мастера' } };
queue = Q([row(111, 'pending')]);
R(`teaAction('tea-books-yes', '111')`);
check('409-pending очередь перечитана', calls.join(','), 'POST /tea/bookings/111/decide,GET /tea/bookings');
h = req();
check('409-pending → U10, кнопок нет', (hasBtns(h) ? 'кнопки' : 'нет') + '/' + (h.includes('Мастер ещё не согласился. Решать можно после его согласия.') ? 'U10' : '-'), 'нет/U10');

// tea-bron-nelzya-soglasovat: 409 «клуб занят», перечитанная — master_ok → U9, U6 жив, слова сохранены
enterList([row(121, 'master_ok')]); openReq(121);
R(`TBQ.note = 'черновик'`);
reply = { status: 409, data: { detail: 'клуб занят: «Ивент», 19:00–21:00: согласовать нельзя — откажите, деньги вернутся гостю' } };
queue = Q([row(121, 'master_ok')]);
R(`teaAction('tea-books-yes', '121')`);
h = req();
check('nelzya-soglasovat U9 печатью', h.includes('<span class="verbatim">Клуб занят: «Ивент», 19:00–21:00: согласовать нельзя — откажите, деньги вернутся гостю.</span>') ? 'U9' : '-', 'U9');
check('nelzya-soglasovat U6 жив, поле цело', (/data-action="tea-books-no:121">/.test(h) ? 'жив' : 'погашен') + '/' + (h.includes('>черновик</textarea>') ? 'цело' : 'стёрто'), 'жив/цело');

// tea-bron-uzhe: 409, перечитанная — approved → U10 «уже решили»
enterList([row(131, 'master_ok')]); openReq(131);
reply = { status: 409, data: { detail: 'бронь уже решена: согласовано' } };
queue = Q([row(131, 'approved')]);
R(`teaAction('tea-books-no', '131')`);
h = req();
check('uzhe → U10 «уже решили»', (hasBtns(h) ? 'кнопки' : 'нет') + '/' + (h.includes('Эту бронь уже решили.') ? 'U10' : '-'), 'нет/U10');

// tea-bron-svoya: 409 «свою бронь…», перечитанная — master_ok → U9, U10 нет
enterList([row(141, 'master_ok')]); openReq(141);
reply = { status: 409, data: { detail: 'свою бронь решает другой арт-директор' } };
queue = Q([row(141, 'master_ok')]);
R(`teaAction('tea-books-yes', '141')`);
h = req();
check('svoya U9, U10 нет, кнопки живые', (h.includes('Свою бронь решает другой арт-директор.') ? 'U9' : '-') + '/' + (h.includes('Эту бронь уже решили.') || h.includes('Мастер ещё не согласился') ? 'U10' : 'нет') + '/' + (hasBtns(h) ? 'кнопки' : '-'), 'U9/нет/кнопки');

// бронь пропала из перечитанной очереди — назад в очередь
enterList([row(151, 'master_ok')]); openReq(151);
reply = { status: 409, data: { detail: 'бронь уже решена' } }; queue = Q([]);
gos.length = 0; R(`teaAction('tea-books-yes', '151')`);
check('пропала — назад в очередь', gos.join(',') + '/' + R(`current`), 'teaBooks/teaBooks');

const bad = ok.filter(x => !x).length;
console.log(bad ? `КРАСНОЕ: ${bad} из ${ok.length}` : `зелёное: ${ok.length} из ${ok.length}`);
process.exit(bad ? 1 : 0);
