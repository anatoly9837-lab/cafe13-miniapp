/* ── шаг 42: чайные мастера, рука ЧАЙ-A (рецепты `_docs/recept/ekran/42/`) ─────────────────────────────────────
   Шесть экранов: teaMasters (каталог), teaMaster (карточка с альбомом), teaApply (дверь «я чайный мастер»),
   teaHold (провести церемонию), teaBook (бронь мастера гостем), teaJoin (запись на церемонию).
   Очередь карточек и согласование (teaReqs, teaReq), двери на guest/home/masters, BACK и крючки в go()/doAction —
   у руки ЧАЙ-Б (js/11, js/18, js/21). Календарь «выбрать» — у руки шага 43 (js/23-kalendar.js): стык назначен
   координатором — go('calendar', {pick: 'teaHold'|'teaBook'}), выбранное — calPicked(откуда).

   ⚠ РУЧЕК СЕРВЕРА НЕТ. На api main шага 42 нет; в api#224–#227 нет карточки, каталога, кадра и брони мастера
   («Чего НЕТ» в #227). Адреса НЕ выдумываются: таблица TEA_URL пуста, и пока адреса в ней нет, живой режим
   этого запроса не делает — экран говорит, что не загрузилось, и в WIRED экраны не стоят (дверь гаснет сама).
   Адрес и форму ответа называет PR сервера; разбор ответа — в одном месте (teaCardFrom и соседи), ключи —
   по словам рецепта, сверить со снимком формы, когда он будет.
   Демонстрация — набор teaCardsDemo() в той форме, которую ждём от разбора.

   Слова — ключами `tea.*` в js/00-slova.js (словарь ведёт ЧАЙ-A, строки ЧАЙ-Б приходят письмом).
   Деньги — строкой сервера, клиент не округляет: на экран — money(строка). Доля клуба и цена заявки — числа
   сервера; в демонстрации — TEA_DEMO, в разметке литерала нет. */

var TEA_URL = { list: null, card: null, shot: null, mine: null, myBooks: null, book: null, apply: null, upload: null, hold: null, price: null };
function teaLive(k) { return LIVE && typeof TEA_URL[k] === 'function'; }
function teaW(k, p) { return slovo('tea.' + k, p); }

// демонстрация: доля клуба 100, заявка 100 — так говорит владелец; в живом — только сервер
var TEA_DEMO = { share: 100, amount: 100, mine: { status: 'none', note: '', card: null } };

var TEA = { list: null, listFail: '', listGen: 0,
            card: null, cardId: null, cardFail: '', cardGone: false, cardGen: 0,
            mine: null, mineFail: '', mineGen: 0,
            books: {}, booksGen: 0,
            share: null, amount: null, priceFail: '', priceGen: 0 };

/* ── разбор ───────────────────────────────────────────────────────────────────────────────────────────────── */
function teaPrice(v) { return typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? v : null; }
/* Карточка мастера: номер мастера, имя, описание, цена СТРОКОЙ, длительность в минутах, число кадров. Кадр — адрес
   СЕРВЕРА клуба (teaShotUrl), file_id и путь файла Telegram сюда не попадают вовсе: из ответа берутся только
   перечисленные поля, всё прочее отбрасывается. */
function teaCardFrom(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.master_id !== 'number' || typeof d.name !== 'string') return null;
  var price = teaPrice(d.price); if (price === null) return null;
  var mins = typeof d.duration_min === 'number' && d.duration_min > 0 ? d.duration_min : null;
  var n = typeof d.shots === 'number' && d.shots >= 0 ? Math.floor(d.shots) : 0;
  var shots = []; for (var i = 0; i < n; i++) shots.push(teaShotUrl(d.master_id, i + 1));
  return { id: d.master_id, name: d.name, about: typeof d.about === 'string' ? d.about : '', price: price, mins: mins,
           shots: shots, status: typeof d.status === 'string' ? d.status : 'approved',
           approvedAt: typeof d.approved_at === 'string' ? d.approved_at : '' };
}
function teaShotUrl(id, n) { return typeof TEA_URL.shot === 'function' ? API + TEA_URL.shot(id, n) : ''; }

/* Демонстрация: три карточки трёх состояний (случай tea-spisok-tolko-soglasovannye) — в списке одна строка с
   каждого согласованного. Люди — роль-словами: клиент публичный (ids-clean). Кадров в демонстрации нет — рамки
   пустыми квадратами, как у не загрузившегося кадра. */
function teaCardsDemo() {
  return [
    { id: 801, name: '[мастер А]', about: 'Пуэр и улуны, тихая церемония на двоих-четверых.\nВ саду, у старого дерева.',
      price: '600', mins: 90, shots: ['', '', ''], status: 'approved', approvedAt: '2026-11-24T10:00:00+07:00' },
    { id: 802, name: '[мастер Б]', about: 'Габа и красные чаи. Рассказываю, откуда чай и как его заваривать дома.',
      price: '450', mins: 60, shots: [''], status: 'approved', approvedAt: '2026-11-20T10:00:00+07:00' },
    { id: 803, name: '[мастер В]', about: 'Ждёт согласования.', price: '500', mins: 60, shots: [], status: 'pending', approvedAt: '' },
    { id: 804, name: '[мастер Г]', about: 'Отказано.', price: '300', mins: 45, shots: [], status: 'denied', approvedAt: '' }
  ];
}
// список «Услуг» — только СОГЛАСОВАННЫЕ, новые сверху (выбор дизайнера); фильтр стоит и на живом ответе
function teaShown(list) {
  return list.filter(function (c) { return c.status === 'approved'; })
    .sort(function (a, b) { return a.approvedAt < b.approvedAt ? 1 : a.approvedAt > b.approvedAt ? -1 : 0; });
}

/* ── загрузки ─────────────────────────────────────────────────────────────────────────────────────────────── */
function teaRerender(screens) { if (screens[current]) render(); }
function teaLoadList() {
  if (!LIVE) { TEA.list = teaShown(teaCardsDemo()); TEA.listFail = ''; return; }
  TEA.list = null; TEA.listFail = '';
  if (!teaLive('list')) { TEA.listFail = 'нет ручки'; return; }
  var gen = ++TEA.listGen;
  api('GET', TEA_URL.list()).then(function (r) {
    if (gen !== TEA.listGen) return;
    var got = r.status === 200 && Array.isArray(r.data) ? r.data.map(teaCardFrom) : null;
    if (got && got.every(Boolean)) TEA.list = teaShown(got); else TEA.listFail = failText(r);
    teaRerender({ teaMasters: 1 });
  });
}
function teaLoadCard(id) {
  TEA.cardId = id; TEA.cardFail = ''; TEA.cardGone = false;
  if (!LIVE) {
    TEA.card = teaCardsDemo().filter(function (c) { return String(c.id) === String(id) && c.status === 'approved'; })[0] || null;
    TEA.cardGone = !TEA.card; return;
  }
  TEA.card = null;
  if (!teaLive('card')) { TEA.cardFail = 'нет ручки'; return; }
  var gen = ++TEA.cardGen;
  api('GET', TEA_URL.card(id)).then(function (r) {
    if (gen !== TEA.cardGen) return;
    var c = r.status === 200 ? teaCardFrom(r.data) : null;
    if (c && c.status === 'approved') TEA.card = c;
    else if (r.status === 404 || c) TEA.cardGone = true;     // сняли, пока смотрели
    else TEA.cardFail = failText(r);
    teaRerender({ teaMaster: 1, teaBook: 1 });
  });
}
/* Своя карточка (блок «Чайный мастер» на home у ЧАЙ-Б и форма teaApply): TEA.mine = null — не грузили или в пути;
   {status: none|pending|approved|edit|rejected, note, card}. Без адреса ручки в живом — запроса нет, TEA.mineFail. */
function loadTeaMine() {
  if (!LIVE) { TEA.mine = TEA_DEMO.mine; TEA.mineFail = ''; return; }
  TEA.mine = null; TEA.mineFail = '';
  if (!teaLive('mine')) { TEA.mineFail = 'нет ручки'; return; }
  var gen = ++TEA.mineGen;
  api('GET', TEA_URL.mine()).then(function (r) {
    if (gen !== TEA.mineGen) return;
    var d = r.status === 200 && r.data ? r.data : null;
    var st = d && /^(none|pending|approved|edit|rejected)$/.test(d.status) ? d.status : null;
    var card = d && d.card ? teaCardFrom(d.card) : null;
    if (st) TEA.mine = { status: st, note: typeof d.note === 'string' ? d.note : '', card: card };
    else TEA.mineFail = failText(r);
    teaRerender({ home: 1, teaApply: 1 });
  });
}
/* Свои брони у мастера (B11): [{at, mins, master: wait|ok|no, art: wait|ok|no, refund: строка|null}] */
function teaBookFrom(b) {
  var at = b && typeof b.starts_at === 'string' ? Date.parse(b.starts_at) : NaN;
  var ok = { wait: 1, ok: 1, no: 1 };
  if (isNaN(at) || !(b.duration_min > 0) || !ok[b.master] || !ok[b.art]) return null;
  return { at: at, mins: b.duration_min, master: b.master, art: b.art, refund: teaPrice(b.refund) };
}
function teaLoadBooks(id) {
  if (!LIVE) {
    if (!TEA.books[id] && String(id) === '801')
      TEA.books[id] = [{ at: Date.parse(ymdAdd(bkk(new Date()).ymd, 3) + 'T17:00:00+07:00'), mins: 90, master: 'ok', art: 'wait', refund: null }];
    return;
  }
  if (!teaLive('myBooks')) return;
  var gen = ++TEA.booksGen;
  api('GET', TEA_URL.myBooks(id)).then(function (r) {
    if (gen !== TEA.booksGen) return;
    var got = r.status === 200 && Array.isArray(r.data) ? r.data.map(teaBookFrom) : null;
    TEA.books[id] = got && got.every(Boolean) ? got : null;
    teaRerender({ teaBook: 1 });
  });
}
/* Цена заявки на церемонию и доля клуба с гостя — числа сервера (teaHold C1, C4; teaApply A4c, A12) */
function teaLoadPrice() {
  if (!LIVE) { TEA.amount = TEA_DEMO.amount; TEA.share = TEA_DEMO.share; TEA.priceFail = ''; return; }
  TEA.amount = null; TEA.share = null; TEA.priceFail = '';
  if (!teaLive('price')) { TEA.priceFail = 'нет ручки'; return; }
  var gen = ++TEA.priceGen;
  api('GET', TEA_URL.price()).then(function (r) {
    if (gen !== TEA.priceGen) return;
    var a = r.status === 200 && r.data ? teaPrice(r.data.amount) : null, s = r.status === 200 && r.data ? teaPrice(r.data.share) : null;
    if (a !== null && s !== null) { TEA.amount = Number(a); TEA.share = Number(s); } else TEA.priceFail = failText(r);
    teaRerender({ teaHold: 1, teaApply: 1 });
  });
}

/* ── общие куски разметки ─────────────────────────────────────────────────────────────────────────────────── */
function teaBal() { return DATA.member && typeof DATA.member.balance === 'number' ? DATA.member.balance : null; }
function teaHm(mins) { var h = Math.floor(mins / 60), m = mins % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
function teaDay(ymd) {
  var x = ymd.split('-'), w = new Date(ymd + 'T12:00:00Z').getUTCDay();
  return DOW_SHORT[(w + 6) % 7] + ', ' + Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1];
}
// «Ср, 2 декабря · 19:07–21:48»; через полночь — «… · 19:07 — до 01:00, 3 декабря» (teaJoin J2, teaBook B11)
function teaWhen(at, mins) {
  var a = bkk(new Date(at)), z = bkk(new Date(at + mins * 60000));
  if (a.ymd === z.ymd) return teaDay(a.ymd) + ' · ' + a.hm + '–' + z.hm;
  var y = z.ymd.split('-');
  return teaDay(a.ymd) + ' · ' + a.hm + ' — ' + teaW('when.until', { hm: z.hm, day: Number(y[2]) + ' ' + MONTHS[Number(y[1]) - 1] });
}
function teaDeny(t, verbatim) {
  return '<div class="deny" role="alert">' + svg(ICON.info) + '<span' + (verbatim ? ' class="verbatim"' : '') + '>' + esc(t) + '</span></div>';
}
function teaRetry(text, act) {
  return '<div class="card quiet"><div class="col"><span class="small">' + esc(text) + '</span>' +
    '<button type="button" class="btn quiet" data-action="' + act + '">' + esc(teaW('retry')) + '</button></div></div>';
}
/* .album (новый класс, рецепт sostav.md): лента квадратных кадров с пролистыванием пальцем, под лентой точки «какой
   из скольких». Один кадр — без точек, ноль — блока нет. Кадр не загрузился — пустой квадрат --surface. */
function teaAlbum(shots, edit) {
  if (!shots.length) return '';
  return '<div class="album"><div class="album-track">' + shots.map(function (s, i) {
      var src = typeof s === 'string' ? s : s.url;
      return '<div class="album-frame">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '') +
        (edit ? edit(s, i) : '') + '</div>';
    }).join('') + '</div>' +
    (shots.length > 1 ? '<div class="album-dots" aria-hidden="true">' + shots.map(function (s, i) {
      return '<span' + (i === 0 ? ' class="on"' : '') + '></span>'; }).join('') + '</div>' : '') +
  '</div>';
}
// точки идут за пальцем: какая рамка ближе к левому краю ленты — та и «на»
document.addEventListener('scroll', function (ev) {
  var t = ev.target;
  if (!t || !t.classList || !t.classList.contains('album-track')) return;
  var i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
  var dots = t.parentNode.querySelectorAll('.album-dots span');
  for (var k = 0; k < dots.length; k++) dots[k].className = k === i ? 'on' : '';
}, true);
// кадр не загрузился — прячем картинку, рамка остаётся пустым квадратом (лента не сжимается)
document.addEventListener('error', function (ev) {
  var t = ev.target;
  if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('album-frame')) t.style.visibility = 'hidden';
}, true);

/* Разметка карточки мастера: альбом, описание, цена. o.book — кнопка K5 (или K6 у своей); без неё — предпросмотр
   teaApply (A5) и согласование teaReq у ЧАЙ-Б. */
function teaIsMine(c) { return LIVE && !!DATA.member && typeof DATA.member.uid === 'number' && c.id === DATA.member.uid; }
function teaCardHtml(c, o) {
  o = o || {};
  var foot = !o.book ? '' : teaIsMine(c) ? '<span class="small">' + esc(teaW('card.mine')) + '</span>'
    : '<button type="button" class="btn" data-action="tea-book:' + esc(c.id) + '">' + esc(teaW('card.book')) + '</button>';
  return teaAlbum(c.shots || []) +
    '<div class="card"><div class="col"><span class="label">' + esc(teaW('card.aboutLabel')) + '</span>' +
      '<p style="font-size:14px;white-space:pre-line;margin:0">' + esc(c.about) + '</p></div></div>' +
    '<div class="card"><div class="col">' +
      '<div class="row"><span class="small">' + esc(teaW('card.priceLabel', { dur: c.mins ? teaHm(c.mins) : '—' })) + '</span>' +
        '<b class="num">' + esc(money(c.price)) + ' ฿</b></div>' +
      '<span class="small">' + esc(teaW('card.priceNote')) + '</span>' + foot +
    '</div></div>';
}

/* ── формы: набранное ─────────────────────────────────────────────────────────────────────────────────────── */
function teaVal(id) { var el = document.getElementById(id); return el ? el.value : null; }
function teaApplyBlank(mine) {
  var c = mine && mine.card;
  return { about: c ? c.about : '', price: c ? String(c.price) : '', h: c && c.mins ? String(Math.floor(c.mins / 60)) : '',
           m: c && c.mins ? String(c.mins % 60) : '', shots: c ? c.shots.map(function (u, i) { return { url: u, id: i + 1, state: 'ok' }; }) : [],
           err: '', deny: '', busy: false, preview: false, botOnly: false };
}
var TAF = teaApplyBlank(null);
var THF = { title: '', about: '', seats: '0', entry: '', err: '', deny: '', money: false, busy: false, stale: null };
var TB = { id: null, err: '', busy: false, stale: null };
function teaGrab() {
  if (current === 'teaApply' && document.getElementById('taf-about')) {
    TAF.about = teaVal('taf-about'); TAF.price = teaVal('taf-price'); TAF.h = teaVal('taf-h'); TAF.m = teaVal('taf-m');
  }
  if (current === 'teaHold' && document.getElementById('thf-title')) {
    THF.title = teaVal('thf-title'); THF.about = teaVal('thf-about'); THF.seats = teaVal('thf-seats'); THF.entry = teaVal('thf-entry');
  }
}
function teaMins() { var h = Number(TAF.h || 0), m = Number(TAF.m || 0); return Math.floor(h) === h && Math.floor(m) === m && h >= 0 && m >= 0 ? h * 60 + m : NaN; }
// доля клуба под ценой/входом: ВСЕГДА при цене ≥ доли; ниже — отказ у поля до нажатия (teaHold C4/C5, teaApply A4c/A12)
function teaShareLine(v, low) {
  var s = TEA.share, n = Number(v);
  if (typeof s !== 'number') return '';
  if (v === '' || !/^\d+(\.\d+)?$/.test(String(v)) || n < s) return teaDeny(teaW(low, { share: money(s) }));
  return '<span class="small">' + esc(teaW('share', { share: money(s), rest: money(Math.round((n - s) * 100) / 100) })) + '</span>';
}
// ввод без перерисовки: строка доли и погашенность кнопки идут за набором, фокус не теряется
document.addEventListener('input', function (ev) {
  var t = ev.target; if (!t || !t.id) return;
  if (t.id === 'thf-entry') {
    THF.entry = t.value;
    var box = document.getElementById('thf-share'); if (box) box.innerHTML = teaShareLine(THF.entry, 'hold.entryLow');
    var b = document.getElementById('thf-send'); if (b) { b.disabled = !teaHoldReady(); b.setAttribute('aria-disabled', String(b.disabled)); }
  }
  if (t.id === 'taf-price') {
    TAF.price = t.value;
    var bx = document.getElementById('taf-share'); if (bx) bx.innerHTML = teaShareLine(TAF.price, 'apply.priceLow');
  }
});

/* ── тела запросов: ни места, ни стола (цитаты 7, 8) ─────────────────────────────────────────────────────── */
function teaBookBody(c, pick) { return { master_id: c.id, starts_at: new Date(pick.at).toISOString() }; }
function teaHoldBody(pick) {
  return { occupancy: 'tea', title: THF.title.trim(), about: THF.about, seats: Number(THF.seats || 0), price: String(THF.entry).trim(),
           starts_at: new Date(pick.at).toISOString(), duration_min: pick.mins };
}
function teaApplyBody() {
  return { about: TAF.about, price: String(TAF.price).trim(), duration_min: teaMins(),
           shots: TAF.shots.filter(function (s) { return s.state === 'ok'; }).map(function (s) { return s.id; }) };
}

/* ── отправки ─────────────────────────────────────────────────────────────────────────────────────────────── */
function teaPick(src, stale) { var p = typeof calPicked === 'function' ? calPicked(src) : null; return p && p !== stale ? p : null; }
function teaBookSend() {
  var c = TEA.card, pick = teaPick('teaBook', TB.stale), bal = teaBal();
  if (TB.busy || !c || !pick || teaIsMine(c) || bal !== null && Number(c.price) > bal) return;
  if (!LIVE) {
    FLASH = { text: teaW('book.done'), note: teaW('demoNote') }; haptic('ok'); go('teaMaster', c.id); return;
  }
  if (!teaLive('book')) { TB.err = teaW('noApi'); render(); return; }
  TB.busy = true; TB.err = ''; render();
  api('POST', TEA_URL.book(), teaBookBody(c, pick)).then(function (r) {
    TB.busy = false; refreshMe();
    if (r.status === 200 || r.status === 201) { FLASH = teaW('book.done'); haptic('ok'); go('teaMaster', c.id); return; }
    TB.err = denyText(r); haptic('warn');
    if (current === 'teaBook') render();
  });
}
function teaHoldReady() {
  var e = Number(THF.entry);
  return !THF.busy && typeof TEA.amount === 'number' && typeof TEA.share === 'number' && /^\d+(\.\d+)?$/.test(String(THF.entry).trim()) &&
    e >= TEA.share && !!teaPick('teaHold', THF.stale) && !teaHoldShort();
}
function teaHoldShort() { var b = teaBal(); return LIVE && typeof TEA.amount === 'number' && b !== null && TEA.amount > b ? TEA.amount - b : 0; }
function teaHoldSend() {
  teaGrab();
  var pick = teaPick('teaHold', THF.stale);
  THF.deny = ''; THF.money = false;
  THF.err = !THF.title.trim() ? teaW('hold.noTitle') : '';
  if (THF.err || !teaHoldReady()) { render(); return; }
  if (!LIVE) {
    FLASH = { text: teaW('hold.done'), note: teaW('demoNote') }; haptic('ok'); go('home'); return;
  }
  if (!teaLive('hold')) { THF.deny = teaW('noApi'); render(); return; }
  THF.busy = true; render();
  var amount = TEA.amount;
  api('POST', TEA_URL.hold(), teaHoldBody(pick)).then(function (r) {
    THF.busy = false; refreshMe();
    if (typeof loadMineMaster === 'function') loadMineMaster();   // строка в «Ваших букингах» на home
    if (r.status === 200 || r.status === 201) {
      FLASH = { text: teaW('hold.done'), note: teaW('hold.doneNote', { amount: money(amount) }) };
      THF = { title: '', about: '', seats: '0', entry: '', err: '', deny: '', money: false, busy: false, stale: pick };
      haptic('ok'); go('home'); return;
    }
    // отказ по деньгам — словами сервера, под ним путь пополнения (C12); своего кода у отказа нет — 402/409 о деньгах
    THF.deny = denyText(r); THF.money = r.status === 402 || /хват|баланс|счёт|счет/i.test(detailOf(r));
    haptic('warn'); if (current === 'teaHold') render();
  });
}
function teaApplySend() {
  teaGrab();
  TAF.deny = '';
  var s = TEA.share, p = String(TAF.price).trim(), mins = teaMins();
  TAF.err = !TAF.about.trim() ? teaW('apply.noAbout')
    : !/^\d+(\.\d+)?$/.test(p) || typeof s === 'number' && Number(p) < s ? teaW('apply.priceLow', { share: typeof s === 'number' ? money(s) : '…' })
    : !(mins > 0) ? teaW('apply.noDur') : '';
  if (TAF.err || TAF.busy || TAF.shots.some(function (x) { return x.state === 'loading'; })) { render(); return; }
  if (!LIVE) {
    FLASH = { text: teaW('apply.done'), note: teaW('demoNote') }; TEA.mine = TEA_DEMO.mine = { status: 'pending', note: '', card: null };
    TAF = teaApplyBlank(null); haptic('ok'); go('home'); return;
  }
  if (!teaLive('apply')) { TAF.deny = teaW('noApi'); render(); return; }
  TAF.busy = true; render();
  api('POST', TEA_URL.apply(), teaApplyBody()).then(function (r) {
    TAF.busy = false;
    if (r.status === 200 || r.status === 201) { FLASH = teaW('apply.done'); TAF = teaApplyBlank(null); loadTeaMine(); haptic('ok'); go('home'); return; }
    TAF.deny = denyText(r); haptic('warn');
    if (current === 'teaApply') render();
  });
}
/* Кадр с телефона: клиент отдаёт файл серверу клуба, тот пересылает в Telegram и хранит file_id у себя (№55 «а»).
   Ручки приёма нет — в живом кадр не добавляется, A2 говорит «Пришлите фото боту». В демонстрации — предпросмотр
   из файла, никуда не уходит. */
var TEA_SHOTS_MAX = 10;
function teaAddFiles(files) {
  teaGrab();
  [].slice.call(files || [], 0, Math.max(0, TEA_SHOTS_MAX - TAF.shots.length)).forEach(function (f) {
    if (!LIVE) { TAF.shots.push({ url: URL.createObjectURL(f), id: 'd' + TAF.shots.length, state: 'ok' }); return; }
    if (!teaLive('upload')) { TAF.botOnly = true; return; }
    var s = { url: '', id: null, state: 'loading', file: f }; TAF.shots.push(s); teaUpload(s);
  });
  render();
}
function teaUpload(s) {
  s.state = 'loading';
  var fd = new FormData(); fd.append('file', s.file);
  var opt = { method: 'POST', headers: { 'X-Telegram-Init-Data': tg.initData }, body: fd };
  if (TEST.on) opt.headers['X-Test-Mode'] = '1';
  if (TEST.on && TEST.as) opt.headers['X-Act-As'] = String(TEST.as.id);
  fetch(API + TEA_URL.upload(), opt).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); },
    function () { return { status: 0 }; }).then(function (r) {
    var n = r.status === 201 && r.data && typeof r.data.shot_id === 'number' ? r.data.shot_id : null;
    if (n !== null) { s.id = n; s.url = typeof r.data.url === 'string' && r.data.url.charAt(0) === '/' ? API + r.data.url : ''; s.state = 'ok'; }
    else if (r.status === 415 || r.status === 413) { TAF.shots.splice(TAF.shots.indexOf(s), 1); TAF.botOnly = true; }
    else s.state = 'fail';
    if (current === 'teaApply') { teaGrab(); render(); }
  });
}
document.addEventListener('change', function (ev) { if (ev.target && ev.target.id === 'taf-file') teaAddFiles(ev.target.files); });

/* ── крючки навигации (вписаны ЧАЙ-Б в js/21-navigaciya.js) ──────────────────────────────────────────────── */
function teaGo(screen, p) {
  if (screen === 'teaMasters') teaLoadList();
  if (screen === 'teaMaster') { teaLoadCard(p); teaLoadBooks(p); }
  if (screen === 'teaBook') {
    var id = p !== undefined && p !== null ? p : TB.id;
    // новый вход с карточки: выбор, сделанный раньше (у другого мастера, с другой длительностью), не подставляется
    if (current !== 'teaBook' && current !== 'calendar') TB = { id: id, err: '', busy: false, stale: typeof calPicked === 'function' ? calPicked('teaBook') : null };
    teaLoadCard(id); teaLoadBooks(id);        // и на возврат из календаря (рецепт «Перечитать на входе»)
  }
  if (screen === 'teaHold') {
    if (current !== 'teaHold' && current !== 'calendar')
      THF = { title: '', about: '', seats: '0', entry: '', err: '', deny: '', money: false, busy: false, stale: typeof calPicked === 'function' ? calPicked('teaHold') : null };
    teaLoadPrice();
  }
  if (screen === 'teaApply' && current !== 'teaApply') {
    if (!TEA.mine && !TEA.mineFail) loadTeaMine();
    TAF = teaApplyBlank(TEA.mine && (TEA.mine.status === 'approved' || TEA.mine.status === 'rejected') ? TEA.mine : null);
    teaLoadPrice();
  }
  if (screen === 'teaJoin') {
    if (LIVE && !EVENTS && EVENTS_STATE !== 'loading') loadEvents();
    var e = LIVE ? eventById(p) : null;
    BOOK_ERR = ''; BOOK_ASK = false;
    if (e && e.occ === 'tea' && isMyEvent(e)) loadSigned(e);
  }
}
function teaAction(a, arg) {
  if (a === 'tea-open') { haptic(); go('teaMaster', Number(arg)); return true; }
  if (a === 'tea-list-retry') { teaLoadList(); render(); return true; }
  if (a === 'tea-card-retry') { teaLoadCard(TEA.cardId); render(); return true; }
  if (a === 'tea-to-list') { go('teaMasters'); return true; }
  if (a === 'tea-book') { haptic(); go('teaBook', Number(arg)); return true; }
  if (a === 'tea-book-cal') {
    var c = TEA.card; if (!c) return true;
    go('calendar', { pick: 'teaBook', master: { id: c.id, name: c.name, mins: c.mins || 0 } }); return true;
  }
  if (a === 'tea-book-send') { teaBookSend(); return true; }
  if (a === 'tea-hold-cal') { teaGrab(); go('calendar', { pick: 'teaHold' }); return true; }
  if (a === 'tea-hold-send') { teaHoldSend(); return true; }
  if (a === 'tea-price-retry') { teaGrab(); teaLoadPrice(); render(); return true; }
  if (a === 'tea-apply-send') { teaApplySend(); return true; }
  if (a === 'tea-apply-preview') { teaGrab(); TAF.preview = !TAF.preview; render(); return true; }
  if (a === 'tea-apply-add') { var f = document.getElementById('taf-file'); if (f) f.click(); return true; }
  if (a === 'tea-shot-del') { teaGrab(); TAF.shots.splice(Number(arg), 1); render(); return true; }
  if (a === 'tea-shot-first') { teaGrab(); var i = Number(arg), s = TAF.shots.splice(i, 1)[0]; if (s) TAF.shots.unshift(s); render(); return true; }
  if (a === 'tea-shot-retry') { var r = TAF.shots[Number(arg)]; if (r && r.file) { teaGrab(); teaUpload(r); render(); } return true; }
  return false;
}

/* ── teaJoin: церемония — ивент вида tea из /events (api#225, ключ occupancy); запись и список — функции ивента ── */
function teaJoinEvent(id) {
  if (LIVE) { var e = eventById(id); return e && e.occ === 'tea' ? e : null; }
  // демонстрация — набор календаря (js/23-kalendar.js); частной брони и чужой ждущей тут нет (tea-join-ne-chastnaya)
  var c = typeof teaDemo === 'function' ? teaDemo().filter(function (x) { return x.id === id && (x.vis === 'open' || x.vis === 'mine'); })[0] : null;
  if (!c) return null;
  var p = bkk(new Date(c.at)), z = bkk(new Date(c.at + c.mins * 60000));
  return { id: c.id, eid: null, occ: 'tea', title: c.title, at: c.at, mins: c.mins, time: p.hm, until: z.hm, master: c.host,
           seats: c.free === null ? null : c.free, of: c.of, unl: c.of === null, taken: 0, kind: 'paid', price: c.price,
           about: '', booked: !!c.booked, approval: 'approved', done: false, demoMine: c.vis === 'mine' };
}

/* ── экраны ───────────────────────────────────────────────────────────────────────────────────────────────── */
Object.assign(SCREENS, {

  teaMasters: function () {
    if (TEA.listFail) return teaRetry(teaW('list.fail'), 'tea-list-retry');
    if (!TEA.list) return '<span class="small">' + esc(teaW('list.loading')) + '</span>';
    if (!TEA.list.length) return '<div class="card quiet"><span class="small">' + esc(teaW('list.empty')) + '</span></div>';
    return '<div class="group">' + TEA.list.map(function (c) {
      var first = c.shots && c.shots[0];
      return '<button type="button" class="listitem" data-action="tea-open:' + esc(c.id) + '">' +
        '<span class="avatar">' + (first ? '<img src="' + esc(first) + '" alt="">' : '') + '</span>' +
        '<span class="grow"><b class="clamp1">' + esc(c.name) + '</b><span class="small clamp2">' + esc(c.about) + '</span></span>' +
        '<b class="num">' + esc(money(c.price)) + ' ฿</b>' + svg(ICON.chev, 'chev') +
      '</button>';
    }).join('') + '</div>';
  },

  teaMaster: function () {
    if (TEA.cardGone) return '<div class="card quiet"><div class="col"><span class="small">' + esc(teaW('card.gone')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="tea-to-list">' + esc(teaW('card.toList')) + '</button></div></div>';
    if (TEA.cardFail) return teaRetry(teaW('card.fail'), 'tea-card-retry');
    if (!TEA.card) return '<span class="small">' + esc(teaW('card.loading')) + '</span>';
    return (FLASH ? flash() : '') + teaCardHtml(TEA.card, { book: true });
  },

  teaBook: function () {
    var c = TEA.card;
    if (TEA.cardGone) return SCREENS.teaMaster();
    if (TEA.cardFail) return teaRetry(teaW('card.fail'), 'tea-card-retry');
    if (!c) return '<span class="small">' + esc(teaW('card.loading')) + '</span>';
    var pick = teaPick('teaBook', TB.stale), bal = teaBal(), price = Number(c.price);
    var short = LIVE && bal !== null && price > bal ? Math.round((price - bal) * 100) / 100 : 0;
    var books = (TEA.books[c.id] || []).map(function (b) {
      var mw = { wait: 'book.stWait', ok: 'book.stMasterOk', no: 'book.stNo' }, aw = { wait: 'book.stWait', ok: 'book.stArtOk', no: 'book.stNo' };
      return '<div class="card quiet"><div class="col"><b>' + esc(teaWhen(b.at, b.mins)) + '</b>' +
        '<div class="row"><span class="small">' + esc(teaW('book.master')) + '</span><span class="st ' + b.master + '">' + esc(teaW(mw[b.master])) + '</span></div>' +
        '<div class="row"><span class="small">' + esc(teaW('book.art')) + '</span><span class="st ' + b.art + '">' + esc(teaW(aw[b.art])) + '</span></div>' +
        (b.master === 'no' && b.refund ? '<span class="small">' + esc(teaW('book.refund', { sum: money(b.refund) })) + '</span>' : '') +
      '</div></div>';
    }).join('');
    return '<span class="small">' + esc(c.name) + ' · ' + esc(teaW('book.sub')) + ' <span class="num">' + esc(money(c.price)) + ' ฿</span></span>' +
      books +
      '<div class="card"><div class="col"><span class="label">' + esc(teaW('time')) + '</span>' +
        (pick ? '<div class="row"><b>' + esc(pick.label) + '</b><button type="button" class="btn quiet mini" data-action="tea-book-cal">' + esc(teaW('timeChange')) + '</button></div>'
              : '<button type="button" class="btn quiet" data-action="tea-book-cal">' + esc(teaW('timePick')) + '</button>') +
      '</div></div>' +
      '<div class="card"><div class="col">' +
        (pick ? '<div class="row"><span class="small">' + esc(teaW('willCharge')) + '</span><b class="num">' + esc(money(c.price)) + ' ฿</b></div>' : '') +
        (short ? '<span class="small">' + esc(teaW('book.short', { n: money(short) })) + '</span>' : '') +
        '<button type="button" class="btn" data-action="tea-book-send"' + (!pick || short || TB.busy || teaIsMine(c) ? ' disabled aria-disabled="true"' : '') + '>' +
          esc(TB.busy ? teaW('sending') : teaW('book.send')) + '</button>' +
      '</div></div>' +
      (TB.err ? teaDeny(TB.err, true) : '');
  },

  teaApply: function () {
    var m = TEA.mine, edit = m && m.status === 'approved', back = m && m.status === 'rejected';
    if (TAF.preview) return '<span class="small">' + esc(teaW('apply.previewNote')) + '</span>' +
      teaCardHtml({ id: 0, name: '', about: TAF.about, price: String(TAF.price || '0'), mins: teaMins() || null,
                    shots: TAF.shots.filter(function (s) { return s.state === 'ok'; }).map(function (s) { return s.url; }) }, { book: false }) +
      '<button type="button" class="btn ghost" data-action="tea-apply-preview">' + esc(teaW('apply.previewBack')) + '</button>';
    var loadingShot = TAF.shots.some(function (s) { return s.state === 'loading'; });
    var shotEdit = function (s, i) {
      return s.state === 'loading' ? '<span class="small album-cap">' + esc(teaW('apply.shotLoading')) + '</span>'
        : s.state === 'fail' ? '<span class="album-cap"><span class="small">' + esc(teaW('apply.shotFail')) + '</span>' +
            '<button type="button" class="btn quiet mini" data-action="tea-shot-retry:' + i + '">' + esc(teaW('retry')) + '</button></span>'
        : '<span class="album-cap">' +
            '<button type="button" class="btn quiet mini" data-action="tea-shot-del:' + i + '">' + esc(teaW('apply.shotDel')) + '</button>' +
            (i > 0 ? '<button type="button" class="btn quiet mini" data-action="tea-shot-first:' + i + '">' + esc(teaW('apply.shotFirst')) + '</button>' : '') +
          '</span>';
    };
    return (edit ? '<span class="small">' + esc(teaW('apply.editNote')) + '</span>' : '') +
      '<span class="small">' + esc(teaW('apply.sub')) + '</span>' +
      (back && m.note ? '<span class="said">' + esc(m.note) + '</span>' : '') +
      '<div class="card"><div class="col"><span class="label">' + esc(teaW('apply.photo')) + '</span>' +
        '<span class="small">' + esc(teaW('apply.photoNote')) + '</span>' +
        teaAlbum(TAF.shots, shotEdit) +
        (TAF.botOnly ? '<span class="small">' + esc(teaW('apply.botOnly')) + '</span>' : '') +
        (TAF.shots.length < TEA_SHOTS_MAX ? '<button type="button" class="btn quiet" data-action="tea-apply-add">' + esc(teaW('apply.add')) + '</button>' +
          '<input type="file" id="taf-file" accept="image/*" multiple hidden>' : '') +
      '</div></div>' +
      '<div class="card"><div class="col">' +
        '<div class="field"><label for="taf-about">' + esc(teaW('apply.about')) + '</label>' +
          '<textarea id="taf-about" rows="5">' + esc(TAF.about) + '</textarea>' +
          '<span class="small">' + esc(teaW('apply.aboutNote')) + '</span></div>' +
        '<div class="field"><label for="taf-price">' + esc(teaW('apply.price')) + '</label>' +
          '<input id="taf-price" inputmode="decimal" value="' + esc(TAF.price) + '">' +
          '<span id="taf-share">' + (TAF.price !== '' ? teaShareLine(TAF.price, 'apply.priceLow') : '') + '</span></div>' +
        '<div class="field"><label for="taf-h">' + esc(teaW('apply.dur')) + '</label>' +
          '<div class="row"><input id="taf-h" inputmode="numeric" value="' + esc(TAF.h) + '" aria-label="' + esc(teaW('apply.durH')) + '">' +
          '<span class="small">' + esc(teaW('apply.durH')) + '</span>' +
          '<input id="taf-m" inputmode="numeric" value="' + esc(TAF.m) + '" aria-label="' + esc(teaW('apply.durM')) + '">' +
          '<span class="small">' + esc(teaW('apply.durM')) + '</span></div></div>' +
      '</div></div>' +
      '<button type="button" class="btn ghost" data-action="tea-apply-preview">' + esc(teaW('apply.preview')) + '</button>' +
      (TAF.err ? teaDeny(TAF.err) : '') + (TAF.deny ? teaDeny(TAF.deny, true) : '') +
      '<button type="button" class="btn" data-action="tea-apply-send"' + (loadingShot || TAF.busy ? ' disabled aria-disabled="true"' : '') + '>' +
        esc(TAF.busy ? teaW('sending') : edit ? teaW('apply.sendEdit') : teaW('apply.send')) + '</button>';
  },

  teaHold: function () {
    if (TEA.priceFail) return teaRetry(teaW('hold.priceFail'), 'tea-price-retry');
    if (typeof TEA.amount !== 'number') return '<span class="small">' + esc(teaW('card.loading')) + '</span>';
    var pick = teaPick('teaHold', THF.stale), short = teaHoldShort(), bal = teaBal();
    return '<span class="small">' + esc(teaW('hold.sub', { amount: money(TEA.amount) })) + '</span>' +
      '<div class="card"><div class="col">' +
        '<div class="field"><label for="thf-title">' + esc(teaW('hold.title')) + '</label><input id="thf-title" value="' + esc(THF.title) + '"></div>' +
        '<div class="field"><label for="thf-about">' + esc(teaW('hold.about')) + '</label><textarea id="thf-about" rows="4">' + esc(THF.about) + '</textarea>' +
          '<span class="small">' + esc(teaW('hold.aboutNote')) + '</span></div>' +
        '<div class="field"><label for="thf-seats">' + esc(teaW('hold.seats')) + '</label><input id="thf-seats" inputmode="numeric" value="' + esc(THF.seats) + '">' +
          '<span class="small">' + esc(teaW('hold.seatsNote')) + '</span></div>' +
        '<div class="field"><label for="thf-entry">' + esc(teaW('hold.entry')) + '</label><input id="thf-entry" inputmode="decimal" value="' + esc(THF.entry) + '">' +
          '<span id="thf-share">' + teaShareLine(THF.entry, 'hold.entryLow') + '</span></div>' +
      '</div></div>' +
      '<div class="card"><div class="col"><span class="label">' + esc(teaW('time')) + '</span>' +
        (pick ? '<div class="row"><b>' + esc(pick.label) + '</b><button type="button" class="btn quiet mini" data-action="tea-hold-cal">' + esc(teaW('timeChange')) + '</button></div>'
              : '<button type="button" class="btn quiet" data-action="tea-hold-cal">' + esc(teaW('timePick')) + '</button>') +
      '</div></div>' +
      '<div class="card"><div class="col">' +
        (pick ? '<div class="row"><span class="small">' + esc(teaW('willCharge')) + '</span><b class="num">' + esc(money(TEA.amount)) + ' ฿</b></div>' : '') +
        (short ? '<span class="small">' + esc(teaW('hold.short', { n: money(short), amount: money(TEA.amount), balance: money(bal) })) + '</span>' : '') +
        '<button type="button" class="btn" id="thf-send" data-action="tea-hold-send"' + (teaHoldReady() ? '' : ' disabled aria-disabled="true"') + '>' +
          esc(THF.busy ? teaW('sending') : teaW('hold.send')) + '</button>' +
      '</div></div>' +
      (short ? '<div class="note">' + svg(ICON.info) + '<span>' + esc(teaW('hold.topupNote')) + '</span></div>' : '') +
      (THF.err ? teaDeny(THF.err) : '') +
      (THF.deny ? teaDeny(THF.deny, true) + (THF.money ? '<span class="small">' + esc(teaW('hold.moneyNote')) + '</span>' : '') : '');
  },

  teaJoin: function (id) {
    if (LIVE && !EVENTS) return eventsWait();
    var e = teaJoinEvent(id);
    if (!e) return '<div class="card quiet"><span class="small">' + esc(teaW('join.gone')) + '</span></div>';
    var mine = LIVE ? isMyEvent(e) : e.demoMine;
    var seats = e.unl ? teaW('join.seatsNoLimit') : teaW('join.seats', { free: e.seats, of: e.of });
    var foot = e.done ? '<div class="card quiet"><span class="small">' + esc(teaW('join.past')) + '</span></div>'
      : mine ? '<div class="card quiet"><span class="small">' + esc(teaW('join.mine')) + '</span></div>' + (LIVE ? signedBlock(e) : '')
      : bookBlock(e);
    return '<div class="row"><span class="pill tea">' + esc(teaW('join.pill')) + '</span></div>' +
      '<div class="col"><h1 class="clamp2">' + esc(e.title) + '</h1>' +
        '<span class="small">' + esc(teaWhen(e.at, e.mins)) + '</span>' +
        '<span class="small">' + esc(teaW('join.host', { name: e.master })) + '</span>' +
        '<span class="small">' + esc(seats) + '</span></div>' +
      (e.about ? '<div class="card"><p style="font-size:14px;white-space:pre-line;margin:0">' + esc(e.about) + '</p></div>' : '') +
      foot;
  }
});

// заголовки шапки: имя мастера на карточке — словом сервера; прочие — словарём
Object.assign(TITLES, { teaMasters: teaW('list.title'), teaBook: teaW('book.title'), teaApply: teaW('apply.title'),
                        teaHold: teaW('hold.title.screen'), teaJoin: teaW('join.title') });
Object.defineProperty(TITLES, 'teaMaster', { get: function () { return TEA.card ? TEA.card.name : ''; }, enumerable: true, configurable: true });
