/* ── шаг 3: мастера (кадры E54*, E55*) — на ручках сервера (cafe13-api, бой `bbf09f8`).
   Форма ответа — по СНИМКАМ `tools/api-keys.json` (cafe13-api#96 `2e262b4`), а не по модели запроса.
   Слова владельца 29.10.2026: «Я мастер… списывает с его баланса 2600 бат и отправляет арт директору
   заявку… За каждый дополнительный час… 1300»; «Про деньги - они списываются в момент заявки. Если не
   достаточно - заявку подать нельзя»; «арт директор не может начать / он может только согласовать». */
var MS_DAY = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];   // weekday сервера: 1 — понедельник (ISO)
/* Старт — ЛЮБОЙ с шагом 30 минут, продолжительность — отдельным полем (слово владельца 29.10.2026: «время
   должгно быть произвольное с интервалом в 30 минут. Нужен старт мероприятия и продолжительность, по умолчанию
   продолжительность 2 часа, + для добавки еще одного за 1300 бат»). Отказ сервера при пересечении остаётся
   ПОСЛЕДНЕЙ защитой и печатается буквой: между показом занятости и отправкой время мог занять другой. */
var MS_TIMES = [];
for (var msi = 0; msi < 48; msi++) MS_TIMES.push((msi < 20 ? '0' : '') + Math.floor(msi / 2) + ':' + (msi % 2 ? '30' : '00'));
// место ФИКСИРОВАНО — «Зал» (слово владельца через координатора, 29.10.2026); его номер — из `GET /places` по имени
var MS_PLACE = 'Зал';
function msPlace() { return EV_PLACES ? EV_PLACES.filter(function (x) { return x.name === MS_PLACE; })[0] || null : null; }
/* Занятость дня — ОДНОЙ ручкой на все даты месяца (`GET /master/slot-busy`, снимки master-slot-busy*,
   cafe13-api#100 `da239b1`): даты — ровно те, что сервер выпишет при согласии, клиент их не считает.
   Слово владельца: «когда выбран день должны появиться занятые слоты… сервер должен показать это сразу еще
   перед тем как пользователь начал выбирать время». Частичного ответа нет: пришло — показ, не пришло —
   «не загрузилась», и отказ сервера при пересечении остаётся ПОСЛЕДНЕЙ защитой. */
var MSB = { key: '', gen: 0, data: null, fail: '' };
function fromBusy(d) {
  if (!d || !Array.isArray(d.dates) || typeof d.month !== 'string') return null;
  var bad = false;
  var dates = d.dates.map(function (x) {
    if (!x || typeof x.date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(x.date) || !Array.isArray(x.busy)) { bad = true; return null; }
    var busy = x.busy.map(function (b) {
      var a = b && new Date(b.starts_at), z = b && new Date(b.ends_at);
      if (!b || typeof b.title !== 'string' || isNaN(a) || isNaN(z)) { bad = true; return null; }
      return { title: b.title, from: bkk(a).hm, to: bkk(z).hm };
    });
    var c = x.conflict;
    if (c !== undefined && c !== null && (typeof c.title !== 'string' || typeof c.starts_label !== 'string' || typeof c.ends_label !== 'string')) bad = true;
    return { day: x.date.slice(8, 10) + '.' + x.date.slice(5, 7), busy: busy, conflict: c || null };
  });
  if (bad || (d.fits !== undefined && typeof d.fits !== 'boolean')) return null;
  return { dates: dates, fits: typeof d.fits === 'boolean' ? d.fits : null };
}
function loadBusy() {
  var pl = msPlace(); if (!pl || !LIVE) return;
  var key = pl.id + '|' + MSF.day + '|' + MSF.time + '|' + (2 + MSF.extra);
  if (key === MSB.key && (MSB.data || MSB.fail)) return;
  var gen = ++MSB.gen; MSB.key = key; MSB.data = null; MSB.fail = '';
  api('GET', '/master/slot-busy?place_id=' + pl.id + '&weekday=' + MSF.day + '&start_local=' + encodeURIComponent(MSF.time) + '&hours=' + (2 + MSF.extra)).then(function (r) {
    if (gen !== MSB.gen) return;    // поздний ответ под прежний день или время молчит
    var d = r.status === 200 ? fromBusy(r.data) : null;
    if (d) MSB.data = d; else MSB.fail = r.status >= 400 && r.status < 500 ? denyText(r) : failText(r);
    if (current === 'masterApply') { msfGrab(); render(); }
  });
}
// набранное в полях формы — в MSF перед любой перерисовкой, иначе текст пропадёт
function msfGrab() {
  if (!document.getElementById('msf-title')) return;
  MSF.title = val('msf-title'); MSF.about = val('msf-about'); MSF.seats = val('msf-seats');
  if (document.getElementById('msf-time')) MSF.time = document.getElementById('msf-time').value;
}
// потолки — сервера (`NewMasterRequest`, master.py:75; снимок master-request-201-max: hours 12, about 2000)
var MS_MAX_H = 12, MS_ABOUT = 2000, MS_SEATS = 500;
function msName(p) {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || (p.username ? '@' + p.username : 'Без имени');
}
function msHours(n) { return n % 10 === 1 && n % 100 !== 11 ? 'час' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'часа' : 'часов'; }
function msWhen(r) { return msSpan(MS_DAY[r.weekday - 1], r.start, r.hours); }
/* Заявка: снимки master-request-201, master-requests-mine-*, master-requests-queue. Сумма — СТРОКОЙ
   («3900.00»). Номера человека в ответе нет вовсе — и в разметку класть нечего. Битая строка — null. */
function fromMasterReq(x, queue) {
  if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.about !== 'string') return null;
  if (typeof x.seats !== 'number' || typeof x.place_name !== 'string') return null;
  if (!(x.weekday >= 1 && x.weekday <= 7) || typeof x.start_local !== 'string' || !/^\d\d:\d\d$/.test(x.start_local)) return null;
  if (typeof x.hours !== 'number' || typeof x.hours_extra !== 'number') return null;
  var amount = typeof x.amount === 'string' && /^\d+(\.\d+)?$/.test(x.amount) ? Number(x.amount) : NaN;
  if (!isFinite(amount)) return null;
  if (!{ pending: 1, approved: 1, rejected: 1 }[x.status] || typeof x.status_ru !== 'string' || typeof x.created_at !== 'string') return null;
  var r = { id: x.id, title: x.title, about: x.about, seats: x.seats, place: x.place_name, weekday: x.weekday,
            start: x.start_local, hours: x.hours, extra: x.hours_extra, amount: amount, status: x.status,
            word: x.status_ru, note: typeof x.decision_note === 'string' ? x.decision_note : '',
            iso: x.created_at, done: typeof x.decided_at === 'string' ? x.decided_at : null };
  // `paid_until` — последний день последнего оплаченного месяца (api#99); null — ни одного; нет поля — старый сервер
  if (x.paid_until !== undefined && x.paid_until !== null && !(typeof x.paid_until === 'string' && /^\d{4}-\d\d-\d\d$/.test(x.paid_until))) return null;
  r.paidUntil = typeof x.paid_until === 'string' ? x.paid_until : null;
  if (queue) { if (typeof x.first_name !== 'string') return null; r.who = msName(x); }
  return r;
}
// одна битая строка — отказ целиком: список с пропавшей заявкой выглядит полным
function fromMasterList(d, queue) {
  if (!d || !Array.isArray(d.requests) || queue && typeof d.pending !== 'number') return null;
  var out = d.requests.map(function (x) { return fromMasterReq(x, queue); });
  if (out.some(function (x) { return !x; })) return null;
  return { list: out.sort(function (a, b) { return a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0; }), pending: queue ? d.pending : null };
}
// слот: снимок master-slots. Единица экрана «Ивенты мастеров» — СЛОТ (state published|hidden), не неделя
function fromSlots(d) {
  if (!d || !Array.isArray(d.slots) || !Array.isArray(d.masters_without_slot)) return null;
  var slots = [], bad = false;
  d.slots.forEach(function (x) {
    if (!x || typeof x.request_id !== 'number' || typeof x.title !== 'string' || !(x.weekday >= 1 && x.weekday <= 7) ||
        typeof x.start_local !== 'string' || !/^\d\d:\d\d$/.test(x.start_local) || typeof x.hours !== 'number' ||
        typeof x.place_name !== 'string' || typeof x.first_name !== 'string' || typeof x.weeks_on !== 'number' ||
        typeof x.weeks_off !== 'number' || typeof x.membership_live !== 'boolean' || !{ published: 1, hidden: 1 }[x.state]) { bad = true; return; }
    slots.push({ id: x.request_id, title: x.title, weekday: x.weekday, start: x.start_local, hours: x.hours, place: x.place_name,
                 who: msName(x), on: x.state === 'published', weeksOn: x.weeks_on, weeksOff: x.weeks_off, live: x.membership_live });
  });
  var without = d.masters_without_slot.map(function (x) { return x && typeof x.first_name === 'string' ? msName(x) : null; });
  if (bad || without.some(function (x) { return !x; })) return null;
  return { slots: slots, without: without };
}
var MR = { mine: null, mineState: '', mineGen: 0, q: null, pending: null, qFail: '', qGen: 0,
           slots: null, without: null, sFail: '', sGen: 0, price: {}, priceAsk: {},
           busy: false, err: '', qErr: '', sErr: '', ask: 0, note: '' };
/* Отказ в мастерстве — с причиной и рекомендациями, обязательно (слово владельца 31.10.2026, Cafe13KPG#696).
   Поле одно: «причину» от «рекомендаций» машине не отличить, поэтому подпись просит оба, а проверка меряет
   непустоту. Кнопка гаснет и включается на ВВОДЕ, без перерисовки — иначе набор терял бы фокус. */
function msNoteSync() {
  var t = document.getElementById('ms-note'); if (!t) return;
  MR.note = t.value;
  var b = document.querySelector('#view [data-action^="ms-no:"]'), w = document.getElementById('ms-why'), empty = !MR.note.trim();
  if (b) { b.disabled = empty || MR.busy; b.setAttribute('aria-disabled', String(b.disabled)); }
  if (w) w.hidden = !empty;
}
document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'ms-note') msNoteSync(); });
// мест по умолчанию 0 = «не ограничено» (слово владельца); ⚠ схема сервера ноль пока не принимает (seats ≥ 1)
// `from` — номер заявки, чьими полями форма уже заполнена (#697): подстановка одна на форму
var MSF = { day: 4, time: '18:00', extra: 0, seats: '0', title: '', about: '', err: '', from: 0 };
/* Повторная заявка открывается полями последней ОТПРАВЛЕННОЙ (слово владельца 31.10.2026, Cafe13KPG#697):
   `MR.mine` отсортирован по created_at, первая — последняя при любом решении. Цена не подставляется — её даёт
   сервер по часам. Подставляется ОДИН раз и только в нетронутую форму: набранное человеком не перетирается.
   Часы — как были, даже если денег теперь не хватает: урезать выбор молча нельзя, «Не хватает» видно и отправку гасит */
function msfPrefill() {
  var last = MR.mine && MR.mine[0];
  if (!last || last.status === 'pending' || MSF.from) return;
  if (current === 'masterApply') msfGrab();
  if (MSF.day !== 4 || MSF.time !== '18:00' || MSF.extra || MSF.seats !== '0' || MSF.title || MSF.about) return;
  MSF = { day: last.weekday, time: MS_TIMES.indexOf(last.start) >= 0 ? last.start : MSF.time,
          extra: Math.max(0, Math.min(last.hours, MS_MAX_H) - 2), seats: String(last.seats),
          title: last.title, about: last.about, err: '', from: last.id };
}
function loadMineMaster() {
  if (!LIVE) return;
  var gen = ++MR.mineGen; MR.mineState = 'loading';
  api('GET', '/master/requests/mine').then(function (r) {
    if (gen !== MR.mineGen) return;
    var d = r.status === 200 ? fromMasterList(r.data, false) : null;
    MR.mine = d ? d.list : null; MR.mineState = d ? 'ok' : failText(r);
    // набранное — в MSF до перерисовки: без этого ответ, пришедший посреди набора, стирал текст полей
    if (current === 'masterApply') msfGrab();
    if (d) { msfPrefill(); loadPrice(2 + MSF.extra); loadPrice(3 + MSF.extra); }
    if ({ home: 1, masterApply: 1, masterReqs: 1, masterReq: 1 }[current]) render();
  });
}
/* Пометка ждущих решений на плашке-меню (слово владельца 02.11.2026: «пометка… что внутри есть решения, требующие
   ответа, и их число, если больше нуля», Cafe13KPG#769; форма — designer-55). Свод подписей: >0 — описательная подпись
   и цифра; 0 — «Ждущих нет»; ручка не ответила или ответ ещё в пути — описательная подпись БЕЗ цифры. Подпись здесь
   не лишняя: она одна различает честный ноль и неотвеченную ручку — снимете её, и «не спросили» станет «никого нет».
   Право — построением: плашка рисуется только тому, кто вправе решать ЭТУ очередь; на замороженной плашке цифру прячет
   `.listitem[disabled] .count` */
function waitMark(n) { return typeof n === 'number' && n > 0 ? '<span class="count">' + n + '</span>' : ''; }
function waitSub(n, plain) { return n === 0 ? 'Ждущих нет' : plain; }
function loadMasterQueue() {
  if (!LIVE) return;
  var gen = ++MR.qGen; MR.qFail = '';
  api('GET', '/master/requests').then(function (r) {
    if (gen !== MR.qGen) return;
    var d = r.status === 200 ? fromMasterList(r.data, true) : null;
    if (d) { MR.q = d.list; MR.pending = d.pending; } else { MR.q = null; MR.qFail = r.status === 403 ? denyText(r) : failText(r); }
    if ({ masters: 1, masterReqs: 1, masterReq: 1, manage: 1 }[current]) render();
  });
}
function loadSlots() {
  if (!LIVE) return;
  var gen = ++MR.sGen; MR.sFail = '';
  api('GET', '/master/slots').then(function (r) {
    if (gen !== MR.sGen) return;
    var d = r.status === 200 ? fromSlots(r.data) : null;
    if (d) { MR.slots = d.slots; MR.without = d.without; } else { MR.slots = null; MR.sFail = r.status === 403 ? denyText(r) : failText(r); }
    if ({ masterEvents: 1, masterEvent: 1, masterList: 1 }[current]) render();
  });
}
/* Цена — у сервера (`GET /master/price?hours=N`, снимок master-price: amount строкой «3900»), а не
   константой: клиент не обещает суммы, которой сервер не спишет */
function loadPrice(h) {
  if (!LIVE) return;
  if (MR.price[h] !== undefined || MR.priceAsk[h] || h > MS_MAX_H) return;
  MR.priceAsk[h] = true;
  api('GET', '/master/price?hours=' + h).then(function (r) {
    MR.priceAsk[h] = false;
    var a = r.status === 200 && r.data && typeof r.data.amount === 'string' && /^\d+(\.\d+)?$/.test(r.data.amount) ? Number(r.data.amount) : null;
    MR.price[h] = a === null ? null : a;
    if ({ home: 1, masterApply: 1 }[current]) render();
  });
}
/* Демо-набор модуля мастеров — только вне LIVE (см. MS_DEMO). Люди — роль-словами: клиент публичный.
   Формы — те же, что отдают разборщики живых ответов (fromMasterReq/fromSlots/fromBusy/fromPlaces). */
function msDemoFill() {
  if (LIVE || MR.demo) return;
  MR.demo = true;
  var own = { id: 901, title: 'Звуковая практика', about: 'Чаши, гонг, голос.', seats: 0, place: 'Зал', weekday: 4, start: '18:30',
              hours: 2, extra: 0, amount: 2600, status: 'approved', word: 'одобрена', note: '', iso: '2026-10-20T10:00:00+07:00',
              done: '2026-10-21T10:00:00+07:00', paidUntil: '2026-11-30' };
  MR.mine = [own]; MR.mineState = 'ok';
  MR.q = [Object.assign({}, own, { id: 902, title: 'Утренняя растяжка', weekday: 2, start: '08:00', status: 'pending', word: 'ждёт решения',
                                   done: null, paidUntil: null, iso: '2026-10-29T09:00:00+07:00', who: '[член клуба]' }),
          Object.assign({}, own, { who: '[мастер]' })];
  MR.pending = 1;
  MR.slots = [{ id: 901, title: 'Звуковая практика', weekday: 4, start: '18:30', hours: 2, place: 'Зал', who: '[мастер]', on: true, weeksOn: 4, weeksOff: 0, live: true },
              { id: 903, title: 'Йога на закате', weekday: 6, start: '17:00', hours: 2, place: 'Зал', who: '[второй мастер]', on: false, weeksOn: 0, weeksOff: 4, live: true }];
  MR.without = ['[мастер без слота]'];
  MR.price = { 2: 2600, 3: 3900, 4: 5200, 5: 6500 };
  if (!EV_PLACES) { EV_PLACES = [{ id: 1, name: 'Зал', capacity: null }]; EV_PLACES_STATE = 'ok'; MR.demoPlaces = true; }
  MSB.data = { dates: [{ day: '05.11', busy: [], conflict: null }, { day: '12.11', busy: [{ title: 'Чайная церемония', from: '16:00', to: '17:30' }], conflict: null },
                       { day: '19.11', busy: [], conflict: null }, { day: '26.11', busy: [], conflict: null }], fits: true };
}
// предпросмотр продления в витрине: те же поля, что у `fromPreview`; цена примерная, как и всё под плашкой
function msDemoPreview(own, months) {
  var x = own.paidUntil.split('-'), y = Number(x[0]), m = Number(x[1]) + months;
  y += Math.floor((m - 1) / 12); m = (m - 1) % 12 + 1;
  var last = new Date(Date.UTC(y, m, 0)).getUTCDate(), charged = 2600 * months, bal = msBalance();
  return { charged: charged, until: y + '-' + (m < 10 ? '0' : '') + m + '-' + last, enough: charged <= bal, short: Math.max(0, charged - bal), months: months };
}
// вход состоялся — демо уходит целиком, иначе живой экран взял бы примерное за ответ сервера
function msDemoClear() {
  if (!MR.demo) return;
  MR.demo = false; MR.mine = null; MR.mineState = ''; MR.q = null; MR.pending = null; MR.slots = null; MR.without = null;
  MR.price = {}; MR.priceAsk = {}; RNW.prev = null; RNW.key = ''; MSB.data = null; MSB.key = '';
  if (MR.demoPlaces) { MR.demoPlaces = false; EV_PLACES = null; EV_PLACES_STATE = ''; }
}
function msBalance() { return DATA.member && typeof DATA.member.balance === 'number' ? DATA.member.balance : 0; }
function msIsMaster() {
  var lv = ((DATA.member && DATA.member.memberships) || []).map(function (m) { return m && m.level; });
  return lv.indexOf('organizer') !== -1 || !!(MR.mine && MR.mine.some(function (r) { return r.status === 'approved'; }));
}
/* ── продление статуса мастера (кадры E59, E59b; Cafe13KPG#632 `953a1af`) — на ручках api#99/#102.
   Слово владельца: подписка, календарный месяц, продление оплатой без новой заявки. ЦЕНУ СЧИТАЕТ СЕРВЕР:
   «Спишется», «Оплачено будет до» и «Не хватает» — из `GET …/periods/preview?months=N` (снимок
   master-renew-preview*), клиентской арифметики на экране нет (решение координатора: иначе
   «правдоподобное вместо известного» там, где сервер обрежет план или откажет членством).
   ⚠ Кнопка тратит деньги, а ВОЗВРАТА НЕТ: защита — окно отмены ДО отправки, та же функция, что у
   снятия уровня (`undoStart`, E47y). Окно задерживает ОТПРАВКУ, отменить на сервере нечего. */
var RNW = { months: 1, prev: null, prevFail: '', prevCode: 0, gen: 0, key: '', busy: false, err: '', errCode: 0 };
function msOwnSlot() { return MR.mine ? MR.mine.filter(function (r) { return r.status === 'approved'; })[0] || null : null; }
function msDate(ymd) { var x = String(ymd).split('-'); return x[2] + '.' + x[1] + '.' + x[0]; }
function msMonths(n) { return n % 10 === 1 && n % 100 !== 11 ? 'месяц' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'месяца' : 'месяцев'; }
var RNW_MAX = 12;   // предел ВВОДА сервера («защита от опечатки, а не правило клуба»)
function moneyOf(v) { return typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN; }
function loadRenewPreview() {
  var own = msOwnSlot(); if (!own) return;
  var key = own.id + '|' + RNW.months;
  if (key === RNW.key && (RNW.prev || RNW.prevFail)) return;
  if (!LIVE) { RNW.key = key; RNW.prev = msDemoPreview(own, RNW.months); return; }
  var gen = ++RNW.gen; RNW.key = key; RNW.prev = null; RNW.prevFail = ''; RNW.prevCode = 0;
  api('GET', '/master/requests/' + own.id + '/periods/preview?months=' + RNW.months).then(function (r) {
    if (gen !== RNW.gen) return;
    var d = r.data, charged = d && moneyOf(d.charged), short = d && moneyOf(d.short);
    var ok = r.status === 200 && d && isFinite(charged) && isFinite(short) && typeof d.enough === 'boolean' &&
      typeof d.paid_until === 'string' && /^\d{4}-\d\d-\d\d$/.test(d.paid_until) && Array.isArray(d.months);
    if (ok) RNW.prev = { charged: charged, until: d.paid_until, enough: d.enough, short: short, months: d.months.length };
    else { RNW.prevFail = r.status >= 400 && r.status < 500 ? denyText(r) : failText(r); RNW.prevCode = r.status; }
    if (current === 'masterRenew') render();
  });
}
function renewSend(key) {
  if (UNDO.key !== null && UNDO.key !== key) return;
  undoStop();
  var m = /^renew:(\d+):(\d+)$/.exec(String(key)); if (!m) return;
  if (!LIVE) { if (current === 'masterRenew') render(); return; }
  RNW.busy = true; RNW.err = ''; RNW.errCode = 0; if (current === 'masterRenew') render();
  api('POST', '/master/requests/' + m[1] + '/periods', { months: Number(m[2]) }).then(function (r) {
    RNW.busy = false;
    var got = r.status === 201 ? fromMasterReq(r.data, false) : null, charged = r.data && moneyOf(r.data.charged);
    // деньги могли уйти и при неразобранном ответе — своя заявка и остаток перечитываются ВСЕГДА
    loadMineMaster(); refreshMe(); RNW.key = '';
    if (got && got.paidUntil) {
      FLASH = { text: 'Продлено', note: 'Оплачено до ' + msDate(got.paidUntil) + (isFinite(charged) ? '. Списано ' + money(charged) + ' ฿.' : '.') };
      RNW.months = 1;
    } else { RNW.err = denyText(r); RNW.errCode = r.status; }
    if (current === 'masterRenew') render();
  });
}
/* E59v, Cafe13KPG#667: один отказ — одно сообщение. После отказа отправки предпросмотр перечитывается (цена
   могла измениться — НЕ гасить) и получает тот же отказ: общий `_renew_plan`. Тогда строка предпросмотра
   говорит не отказ второй раз, а то, ради чего в ней «Повторить», — «Цена не пересчитана». Тот же — это
   тот же код и текст отправки НАЧИНАЕТСЯ с текста предпросмотра: к отправке сервер дописывает «Деньги не
   списаны, месяц не продлён» (api#103), к предпросмотру нарочно нет. Другой отказ (сеть, иной код, иные
   слова) — второй отказ, а не копия, и печатается целиком. */
function rnwSameRefusal() {
  return !!RNW.err && !!RNW.prevFail && RNW.errCode === RNW.prevCode && RNW.prevCode >= 400 && RNW.prevCode < 500 &&
    RNW.err.indexOf(RNW.prevFail.replace(/\.$/, '')) === 0;
}

function masterOffer() {
  if (!LIVE || DATA.role === 'guest') return '';
  if (MR.mineState === '') loadMineMaster();
  loadPrice(2); loadPrice(3);
  if (MR.mineState === 'loading' && !MR.mine) return '';
  if (MR.mineState !== 'ok' && !MR.mine) return '<div class="card quiet"><div class="row"><span class="small">Заявки в мастера не загрузились: ' +
      esc(MR.mineState) + '</span><button type="button" class="btn quiet" data-action="ms-retry-mine">Повторить</button></div></div>';
  // блок «Вы мастер» снят (E68, Cafe13KPG#682): условие слота живёт на «Продлении» числами, а дверь
  // туда — «Продлить» под ролями (masterRenewDoor)
  if (msIsMaster()) return '';
  var last = MR.mine[0];
  if (last && last.status === 'pending') return '<div class="card quiet"><div class="row"><div class="col"><b>Заявка в мастера</b>' +
      '<span class="small">' + esc(topupDay(last.iso, true)) + '</span></div><span class="st wait">' + esc(last.word) + '</span></div>' +
      '<span class="small">' + esc('Списано ' + money(last.amount) + ' ฿. ' + msWhen(last) + (last.extra ? ', +' + last.extra + ' ' + msHours(last.extra) : '') + '.') + '</span></div>' +
    '<div class="note">' + svg(ICON.info) + '<span>Решение принимает арт-директор. Если он откажет, деньги вернутся на счёт.</span></div>';
  var again = last && last.status === 'rejected' ? '<div class="card quiet"><div class="row"><div class="col"><b>Заявка в мастера</b>' +
      '<span class="small">' + esc(topupDay(last.done || last.iso, false)) + '</span></div><span class="st no">' + esc(last.word) + '</span></div>' +
      '<span class="small">' + esc((last.note ? cap(last.note) + '. ' : '') + money(last.amount) + ' ฿ вернулись на счёт.') + '</span></div>' : '';
  if (again) return again + '<button type="button" class="btn" data-action="ms-apply">Подать заново</button>';
  var p = MR.price[2], bal = msBalance(), short = typeof p === 'number' && bal < p;
  // E54g: кнопка недоступна, причина — рядом, до нажатия. Цены ещё нет — тоже недоступна: сумму называет сервер
  return '<div class="card"><div class="col"><b>Стать мастером</b>' +
      // «свой ивент», а не «своё ивент» кадра: род после переименования (вопрос дизайнеру)
      '<span class="small">Свой слот в расписании клуба и свой ивент в афише.</span></div>' +
      '<span class="small">' + (typeof p !== 'number' ? (p === null ? 'Цену не удалось узнать у сервера.' : 'Узнаём цену…')
        : short ? 'Не хватает ' + money(p - bal) + ' ฿: нужно ' + money(p) + ' ฿, на счёте ' + money(bal) + ' ฿'
        /* ВРЕМЕННАЯ строка из фактов владельца 29.10.2026 (через координатора), слова ждут кадра дизайнера:
           2 600 ฿ — за календарный МЕСЯЦ («Не правильно - на месяц»), продление оплатой без новой заявки,
           неоплаченный слот отдаётся. «Один раз» и «пока есть членство» — сняты: первое ложно, второе — не период */
        : money(p) + ' ฿ в месяц · ивент на 2 часа каждую неделю' + (typeof MR.price[3] === 'number' ? ', ещё час — ' + money(MR.price[3] - p) + ' ฿' : '')) + '</span>' +
      (typeof p === 'number' && !short ? '<span class="small">Месяц календарный. Продлевается оплатой, без новой заявки; неоплаченный слот отдаётся.</span>' : '') +
      '<button type="button" class="btn" data-action="ms-apply"' + (typeof p !== 'number' || short ? ' disabled' : '') + '>Я мастер</button></div>' +
    (short ? '<div class="note">' + svg(ICON.info) + '<span>Пополнить счёт можно на вкладке «Клуб» — кошельком в шапке.</span></div>' : '');
}
function sendMaster() {
  if (MR.busy) return;
  var seats = Number(MSF.seats), h = 2 + MSF.extra, p = MR.price[h];
  // пределы — сервера (NewMasterRequest): название 1–200, мест 1–500, аннотация до 2000
  MSF.err = !MSF.title ? 'Без названия ивент в афишу не ставится.'
    : !(seats >= 0 && seats <= MS_SEATS && Math.floor(seats) === seats) ? 'Число мест — целое, от 0 до ' + MS_SEATS + '; 0 — без ограничения.'
    : !msPlace() ? 'Места «' + MS_PLACE + '» нет среди открытых мест клуба.' : typeof p !== 'number' ? 'Цена ещё не пришла от сервера.'
    : p > msBalance() ? 'Не хватает денег на счёте.' : '';
  if (MSF.err) { render(); return; }
  if (!LIVE) return;   // витрина: нажатие ничего не отправляет (плашка прототипа это говорит)
  MR.busy = true; render();
  api('POST', '/master/request', { title: MSF.title, about: MSF.about, seats: seats, place_id: msPlace().id,
    weekday: MSF.day, start_local: MSF.time, hours: h }).then(function (r) {
    MR.busy = false;
    var got = r.status === 201 ? fromMasterReq(r.data, false) : null;
    // деньги могли уйти и при неразобранном ответе — свою заявку и остаток перечитываем ВСЕГДА
    loadMineMaster(); refreshMe();
    if (got) {
      MSF = { day: 4, time: '18:00', extra: 0, seats: '0', title: '', about: '', err: '', from: 0 };
      FLASH = { text: 'Заявка отправлена', note: 'Списано ' + money(got.amount) + ' ฿. Решение примет арт-директор; если он откажет, деньги вернутся на счёт.' };
      go('home'); return;
    }
    MSF.err = denyText(r);
    if (current === 'masterApply') render();
  });
}
function decideMaster(id, decision) {
  var note = decision === 'rejected' ? MR.note.trim() : '';
  if (MR.busy || !LIVE || decision === 'rejected' && (MR.ask !== id || !note)) return;
  MR.busy = true; MR.qErr = ''; render();
  api('POST', '/master/requests/' + id + '/decide', { decision: decision, note: note }).then(function (r) {
    MR.busy = false;
    if (r.status === 200 && r.data && r.data.status === decision) {
      FLASH = { text: decision === 'approved' ? 'Согласовано' : 'Отказано',
                note: decision === 'approved' ? 'Ивент встал в афишу: недель ' + (Array.isArray(r.data.events) ? r.data.events.length : '—') + '.'
                                              : 'Деньги вернулись на счёт заявителя.' };
      MR.ask = 0; MR.note = '';
      loadMasterQueue(); loadSlots(); go('masterReqs'); return;
    }
    MR.qErr = denyText(r);
    if (r.status === 409) loadMasterQueue();
    if (current === 'masterReq') render();
  });
}
function slotToggle(id, show) {
  if (MR.busy || !LIVE) return;
  MR.busy = true; MR.sErr = ''; render();
  api('POST', '/master/slots/' + id + '/' + (show ? 'show' : 'hide'), {}).then(function (r) {
    MR.busy = false;
    if (r.status === 200 && r.data && r.data.state === (show ? 'published' : 'hidden')) {
      FLASH = { text: show ? 'Включено' : 'Выключено', note: (show ? 'В афише снова видно недель: ' : 'Из афиши убрано недель: ') + (typeof r.data.weeks === 'number' ? r.data.weeks : '—') + '.' };
      loadSlots();
    } else MR.sErr = denyText(r);
    if ({ masterEvents: 1, masterEvent: 1 }[current]) render();
  });
}
/* Одна битая заявка — отказ целиком: очередь с пропавшей строкой выглядит полной. */
function fromTopupQueue(d) {
  if (!d || !Array.isArray(d.requests) || typeof d.pending !== 'number') return null;
  var me = tgUid(), out = [];
  for (var i = 0; i < d.requests.length; i++) {
    var q = d.requests[i];
    if (!q || typeof q.id !== 'number' || !TOPQ_ST[q.status] || typeof q.status_ru !== 'string' ||
        !JOIN_MIME[q.receipt_mime] || typeof q.receipt_bytes !== 'number' || !isFinite(num(q.amount)) ||
        typeof q.member_id !== 'number') return null;
    out.push({ id: q.id, status: q.status, word: q.status_ru, mine: me !== null && q.member_id === me,
               name: [q.first_name, q.last_name].filter(Boolean).join(' ') || 'Без имени',
               way: TOPQ_WAY[q.pay_method] || String(q.pay_method || ''), sum: num(q.amount),
               mime: q.receipt_mime, bytes: q.receipt_bytes,
               iso: typeof q.created_at === 'string' ? q.created_at : '',
               done: typeof q.decided_at === 'string' ? q.decided_at : '',
               answer: typeof q.decision_note === 'string' ? q.decision_note.trim() : '' });
  }
  return { list: out, pending: d.pending };
}
function loadTopupQueue() {
  var gen = ++TOPQ.gen, who = WHO;
  if (TOPQ.who !== WHO) { topupDropShots(); TOPQ.who = WHO; }
  TOPQ.fail = '';
  api('GET', '/topup/requests').then(function (r) {
    if (gen !== TOPQ.gen || who !== WHO) return;
    var got = r.status === 200 ? fromTopupQueue(r.data) : null;
    if (got) { TOPQ.list = got.list; TOPQ.pending = got.pending; }
    else { TOPQ.list = null; TOPQ.pending = null; TOPQ.fail = r.status === 403 ? denyText(r) : failText(r); }
    if (current === 'topupReq') topupShotFor(param);
    if (current === 'topupQueue' || current === 'topupReq' || current === 'manage') render();
  });
}
function topupDropShots() {
  Object.keys(TOPQ.shot).forEach(function (k) { if (TOPQ.shot[k].url) URL.revokeObjectURL(TOPQ.shot[k].url); });
  TOPQ.shot = {};
}
// чек — только у ждущей заявки и только снимком: PDF в <img> не показать, его байты не берутся
function topupShotFor(id) {
  var q = (TOPQ.list || []).filter(function (x) { return x.id === Number(id); })[0];
  if (q && q.status === 'pending' && q.mime !== 'application/pdf') topupShot(q.id);
}
/* Заголовки — те же, что у api(): без тестового режима чек пришёл бы из боевой базы. */
function topupShot(id) {
  if (TOPQ.shot[id]) return;
  var s = TOPQ.shot[id] = { url: '', fail: false }, who = WHO;
  var h = { 'X-Telegram-Init-Data': tg.initData };
  if (TEST.on) h['X-Test-Mode'] = '1';
  if (TEST.on && TEST.as) h['X-Act-As'] = String(TEST.as.id);
  fetch(API + '/topup/requests/' + id + '/receipt', { headers: h })
    .then(function (r) { return r.ok ? r.blob() : null; }, function () { return null; })
    .then(function (b) {
      if (who !== WHO || TOPQ.shot[id] !== s) return;
      if (b && b.size) s.url = URL.createObjectURL(b); else s.fail = true;
      if (current === 'topupReq') render();
    }, function () { s.fail = true; if (current === 'topupReq') render(); });
}
function decideTopup(id, decision) {
  var q = (TOPQ.list || []).filter(function (x) { return x.id === id; })[0];
  if (TOPQ.busy || !q || q.mine || q.status !== 'pending') return;
  TOPQ.busy = true; TOPQ.err = ''; render();
  var who = WHO;
  api('POST', '/topup/requests/' + id + '/decide',
      { decision: decision, note: decision === 'rejected' ? TOPQ.note.trim() : '' }).then(function (r) {
    // занятость гасится ДО гарда: иначе ответ, пришедший после смены человека, запер бы экран (#213)
    TOPQ.busy = false;
    if (who !== WHO) return;
    if (r.status === 200 && r.data && r.data.status === decision) {
      haptic('ok');
      TOPQ.step = ''; TOPQ.note = '';
      TOPQ.done = decision === 'approved'
        ? 'Зачислено ' + money(q.sum) + ' ฿ — деньги на счёте человека.'
        : 'Отказано. Причину человек увидит в своей истории.';
      loadTopupQueue();
      go('topupQueue');
      return;
    }
    TOPQ.err = denyText(r); haptic('warn');
    // 409 — очередь устарела (решил другой) или заявка своя: перечитать
    loadTopupQueue();
    if (current === 'topupReq') render();
  });
}
function topupDay(iso, withTime) {
  var d = new Date(iso); if (!iso || isNaN(d.getTime())) return '';
  var p = bkk(d), x = p.ymd.split('-');
  return x[2] + '.' + x[1] + '.' + x[0] + (withTime ? ', ' + p.hm : '');
}
// вид и размер чека — как у очереди доступа («PNG · 3 КБ»): один предмет — один вид (designer-55, E56b/E56v)
function topupSize(q) { return JOIN_MIME[q.mime] + ' · ' + Math.max(1, Math.round(q.bytes / 1024)) + ' КБ'; }
document.addEventListener('input', function (ev) {
  if (ev.target && ev.target.id === 'tq-note') TOPQ.note = ev.target.value;
});

