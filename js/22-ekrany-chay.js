/* ── шаг 42: чайные мастера, рука ЧАЙ-A (рецепты `_docs/recept/ekran/42/`) ─────────────────────────────────────
   Шесть экранов: teaMasters (каталог), teaMaster (карточка с альбомом), teaApply (дверь «я чайный мастер»),
   teaHold (провести церемонию), teaBook (бронь мастера гостем), teaJoin (запись на церемонию).
   Очередь карточек и согласование (teaReqs, teaReq), двери на guest/home/masters, BACK и крючки в go()/doAction —
   у руки ЧАЙ-Б (js/11, js/18, js/21). Календарь «выбрать» — у руки шага 43 (js/23-kalendar.js): стык назначен
   координатором — go('calendar', {pick: 'teaHold'|'teaBook'}), выбранное — calPicked(откуда).

   Ручки сервера (api app/routers/tea.py, бой d23e45d): каталог, чужая карточка, своя карточка и подача — в TEA_URL
   ниже. Кадра на сервере НЕТ (кадры — «отдельная часть», tea.py:21); бронь (POST /tea/bookings, GET /tea/bookings/mine)
   есть на стволе api a6d4d4c, но не в бою (d23e45d → 404):
   их адреса пусты, и пока адреса нет, живой режим этого запроса не делает; teaBook в WIRED не стоит (дверь K5
   гаснет сама, teaCardHtml). Разбор ответа — в одном месте (teaCardFrom и соседи).
   Демонстрация — набор teaCardsDemo() в той форме, которую ждём от разбора.

   Слова — ключами `tea.*` в js/00-slova.js (словарь ведёт ЧАЙ-A, строки ЧАЙ-Б приходят письмом).
   Деньги — строкой сервера, клиент не округляет: на экран — money(строка). Доля клуба и цена заявки — числа
   сервера; в демонстрации — TEA_DEMO, в разметке литерала нет. */

/* Живые ручки: заявка церемонии — POST /master/request с occupancy 'tea', цена — GET /master/price (доля клуба
   `share` — строкой, teaPrice). Каталог — GET /tea/masters (только согласованные, №66), чужая карточка —
   GET /tea/masters/{master_id} (404 — нет согласованной), своя — GET /tea/card/mine, подача и правка —
   POST /tea/card (api tea.py, бой d23e45d). Кадра (shot) на сервере нет. Бронь (book) и свои брони (myBooks) —
   api tea_bookings.py, бой c2167c5 (POST /tea/bookings :203, GET /tea/bookings/mine :281). */
var TEA_URL = { list: function () { return '/tea/masters'; },
                card: function (id) { return '/tea/masters/' + encodeURIComponent(id); },
                shot: null, mine: function () { return '/tea/card/mine'; },
                // myBooks — GET /tea/bookings/mine: ВСЕ брони гостя, без номера мастера в пути; book — POST /tea/bookings
                // (NewBooking: master_id, starts_on, start_local). Адреса поставлены вместе с включением teaBook (бой c2167c5)
                myBooks: function () { return '/tea/bookings/mine'; }, book: function () { return '/tea/bookings'; },
                apply: function () { return '/tea/card'; },
                // teaToMe (рецепт 42/teaToMe.md, №98): брони ко мне как к мастеру и согласие — api tea_bookings.bookings_to_me
                // и tea_bookings.accept, бой c2167c5. В WIRED вместе с teaBook (наряд coordinator-3 28.11)
                toMe: function () { return '/tea/bookings/to-me'; },
                accept: function (id) { return '/tea/bookings/' + encodeURIComponent(id) + '/accept'; },
                refuse: function (id) { return '/tea/bookings/' + encodeURIComponent(id) + '/refuse'; },
                // teaBooks, teaBookReq (рецепты 42/teaBooks.md, 42/teaBookReq.md, №98): очередь и решение арт-директора —
                // api tea_bookings.queue и tea_bookings.decide, бой c2167c5. В WIRED вместе с teaBook: дверь S2 открыта
                queue: function () { return '/tea/bookings'; },
                decide: function (id) { return '/tea/bookings/' + encodeURIComponent(id) + '/decide'; },
                hold: function () { return '/master/request'; }, price: function () { return '/master/price'; } };
function teaLive(k) { return LIVE && typeof TEA_URL[k] === 'function'; }

// демонстрация: доля клуба 100, заявка 100 — так говорит владелец; в живом — только сервер
var TEA_DEMO = { share: 100, amount: 100, mine: { status: 'none', note: '', card: null } };

var TEA = { list: null, listFail: '', listGen: 0,
            card: null, cardId: null, cardFail: '', cardGone: false, cardGen: 0,
            mine: null, mineFail: '', mineGen: 0,
            books: {}, booksGen: 0,
            toMe: null, toMeFail: '', toMeGen: 0,
            share: null, amount: null, priceFail: '', priceGen: 0 };

/* ── разбор ───────────────────────────────────────────────────────────────────────────────────────────────── */
/* Деньги сервера: сегодня pydantic отдаёт Decimal СТРОКОЙ ("100"), но конечное неотрицательное число принимается
   тоже — иначе доля числом стала бы null, и грань №78 у teaHold пропала бы молча (tools/chay-dolya.cjs, Д6). */
function teaPrice(v) {
  var t = typeof v === 'number' && isFinite(v) ? String(v) : v;
  return typeof t === 'string' && /^\d+(\.\d+)?$/.test(t) ? t : null;
}
/* Карточка мастера: номер мастера, имя, описание, цена СТРОКОЙ, длительность в минутах, число кадров. Кадр — адрес
   СЕРВЕРА клуба (teaShotUrl): из ответа берутся только перечисленные поля, всё прочее отбрасывается. Кадров
   не больше TEA_SHOTS_MAX — галерея показывает три. */
var TEA_SHOTS_MAX = 3;
function teaCardFrom(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.master_id !== 'number' || typeof d.name !== 'string') return null;
  // цена — Decimal сервера с двумя знаками («600.00»): нулевые копейки на экран не идут, прочее — как пришло
  var price = teaPrice(d.price); if (price === null) return null;
  price = price.replace(/\.0+$/, '');
  var mins = typeof d.duration_min === 'number' && d.duration_min > 0 ? d.duration_min : null;
  var n = typeof d.shots === 'number' && d.shots >= 0 ? Math.min(TEA_SHOTS_MAX, Math.floor(d.shots)) : 0;
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
   {status: none|pending|approved|edit|rejected, note, card, live}: card — последняя подача, live — карточка в каталоге
   (или null). Без адреса ручки в живом — запроса нет, TEA.mineFail. */
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
    var live = d && d.live ? teaCardFrom(d.live) : null;
    if (st) TEA.mine = { status: st, note: typeof d.note === 'string' ? d.note : '', card: card, live: live };
    else TEA.mineFail = failText(r);
    teaRerender({ home: 1, teaApply: 1, teaMaster: 1, teaBook: 1, teaToMe: 1 });   // teaToMe: кнопки — по своему номеру
  });
}
/* Свои брони (B11, B12) — форма api `tea_bookings._row`: {id, master_id, starts_at, duration_min, price
   строкой, status: pending|master_ok|approved|rejected, note, refunded}. Цепочка №98 (api#239): pending — ждёт
   мастера, master_ok — мастер согласился, ждёт арт-директора; решает арт-директор. Полей master/art у сервера нет.
   ⚠ master_ok обязан быть в TEA_BOOK_ST: незнакомый status отбрасывает ВЕСЬ ответ (every(Boolean)), и одна
   бронь в master_ok обнулила бы список гостя. У гостя master_ok — то же «ждёт согласования» (B11 — одно
   состояние на бронь, решения ещё нет). Отказ возвращает ВСЮ цену (№86 «а»): refund = price, если refunded. →
   {master, at, mins, st: wait|ok|no, refund: строка|null, note} */
var TEA_BOOK_ST = { pending: 'wait', master_ok: 'wait', approved: 'ok', rejected: 'no' };
function teaBookFrom(b) {
  var at = b && typeof b.starts_at === 'string' ? Date.parse(b.starts_at) : NaN;
  var st = b && TEA_BOOK_ST.hasOwnProperty(b.status) ? TEA_BOOK_ST[b.status] : null;
  if (isNaN(at) || !(b.duration_min > 0) || !st || typeof b.master_id !== 'number') return null;
  return { master: b.master_id, at: at, mins: b.duration_min, st: st,
           refund: st === 'no' && b.refunded === true ? teaPrice(b.price) : null,
           note: typeof b.note === 'string' ? b.note : '' };
}
function teaLoadBooks(id) {
  if (!LIVE) {
    if (!TEA.books[id] && String(id) === '801')
      TEA.books[id] = [{ master: 801, at: Date.parse(ymdAdd(bkk(new Date()).ymd, 3) + 'T17:00:00+07:00'), mins: 90, st: 'wait', refund: null, note: '' }];
    return;
  }
  if (!teaLive('myBooks')) return;
  var gen = ++TEA.booksGen;
  api('GET', TEA_URL.myBooks()).then(function (r) {
    if (gen !== TEA.booksGen) return;
    // список гостя по всем мастерам, новые сверху; у экрана — брони ЭТОГО мастера (номер карточки, не Telegram id)
    var got = r.status === 200 && Array.isArray(r.data) ? r.data.map(teaBookFrom) : null;
    TEA.books[id] = got && got.every(Boolean) ? got.filter(function (b) { return String(b.master) === String(id); }) : null;
    teaRerender({ teaBook: 1 });
  });
}
/* Брони ко мне (teaToMe, №98) — форма api `tea_bookings._row(queue=True)`: та же, что у своих броней, плюс
   guest_name. Состояние разбирается ТЕМ ЖЕ словарём TEA_BOOK_ST (вид .st), а слово — status_ru сервера печатью:
   своих слов состояния клиент не заводит (рецепт T3). Незнакомое состояние — весь ответ не принят. */
function teaToMeFrom(b) {
  var x = teaBookFrom(b);
  if (!x || typeof b.id !== 'number' || typeof b.status_ru !== 'string') return null;
  x.id = b.id; x.status = b.status; x.word = b.status_ru; x.price = teaPrice(b.price);
  x.guest = typeof b.guest_name === 'string' ? b.guest_name : '';
  x.refunded = b.refunded === true;      // T10: отказ вернул ВСЮ цену гостю (tea_bookings._refund)
  return x;
}
/* Кнопки «Согласиться» (T4) и «Отказаться» (T7) — ТОЛЬКО через этот предикат (обе половины одного решения): бронь ждёт мастера И она к МОЕЙ карточке (master_id —
   номер первой подачи, teaMyId). Сервер отдаёт чужому 403 (tea_bookings._own_booking), но кнопка, обречённая на
   отказ, — ложь экрана. Номера своей карточки нет — кнопки нет ни у одной брони. */
function teaMyMaster() { return LIVE ? teaMyId() : TEA_TOME_DEMO_ME; }
function teaMayAccept(b) { var my = teaMyMaster(); return b.status === 'pending' && my !== null && b.master === my; }
// демонстрация: мастер 801 (как TEA.books в teaLoadBooks); status_ru — копия STATUS_RU сервера a04c4dd ТОЛЬКО для демо
var TEA_TOME_DEMO_ME = 801;
function teaToMeDemo() {
  var d = function (n, h) { return Date.parse(ymdAdd(bkk(new Date()).ymd, n) + 'T' + h + ':00+07:00'); };
  return [
    { id: 9001, master: 801, at: d(2, '17:00'), mins: 90, st: 'wait', status: 'pending', word: 'ждёт решения', price: '600', guest: 'Гость клуба', refund: null, note: '' },
    { id: 9002, master: 801, at: d(4, '19:00'), mins: 90, st: 'wait', status: 'master_ok', word: 'мастер согласился, ждёт арт-директора', price: '600', guest: 'Гость клуба', refund: null, note: '' }
  ];
}
var TTM = { busy: null, deny: {}, open: null, note: '' };   // open — бронь с раскрытым отказом (T8), note — набранное
function teaLoadToMe() {
  if (!LIVE) { if (!TEA.toMe) TEA.toMe = teaToMeDemo(); TEA.toMeFail = ''; return; }
  TEA.toMe = null; TEA.toMeFail = '';
  if (!teaLive('toMe')) { TEA.toMeFail = 'нет ручки'; return; }
  var gen = ++TEA.toMeGen;
  api('GET', TEA_URL.toMe()).then(function (r) {
    if (gen !== TEA.toMeGen) return;
    var got = r.status === 200 && Array.isArray(r.data) ? r.data.map(teaToMeFrom) : null;
    if (got && got.every(Boolean)) TEA.toMe = got; else TEA.toMeFail = failText(r);
    teaRerender({ teaToMe: 1 });
  });
}
/* Согласие (T4): сразу — кнопка ЭТОЙ брони гаснет; 200 — строка из ответа (бронь остаётся в списке, master_ok);
   отказ — слова сервера под бронью и перечитывание списка. */
function teaAcceptSend(id) {
  var b = (TEA.toMe || []).filter(function (x) { return x.id === id; })[0];
  if (TTM.busy !== null || !b || !teaMayAccept(b)) return;
  var swap = function (nb) { TEA.toMe = TEA.toMe.map(function (x) { return x.id === id ? nb : x; }); };
  delete TTM.deny[id];
  if (!LIVE) {
    var nb = Object.assign({}, b, { status: 'master_ok', word: teaToMeDemo()[1].word });
    swap(nb); FLASH = { text: slovo('tea.toMe.done'), note: slovo('tea.demoNote') }; haptic('ok'); render(); return;
  }
  if (typeof TEA_URL.accept !== 'function') { TTM.deny[id] = slovo('tea.noApi'); render(); return; }
  TTM.busy = id; render();
  api('POST', TEA_URL.accept(id)).then(function (r) {
    TTM.busy = null;
    var nb = r.status === 200 ? teaToMeFrom(r.data) : null;
    if (nb && TEA.toMe) { swap(nb); FLASH = slovo('tea.toMe.done'); haptic('ok'); }
    else { TTM.deny[id] = denyText(r); haptic('warn'); teaLoadToMe(); }
    if (current === 'teaToMe') render();
  });
}
/* Отказ (T9): два шага — T7 только раскрывает поле, деньги уходят здесь. 200 — строка из ответа (rejected, T10);
   отказ сервера — слова под бронью, набранное остаётся. Тело — MasterRefusal {note} (≤ 500, необязательно). */
function teaRefuseSend(id) {
  var b = (TEA.toMe || []).filter(function (x) { return x.id === id; })[0];
  if (TTM.busy !== null || !b || !teaMayAccept(b) || TTM.open !== id) return;
  var el = document.getElementById('ttm-note'); if (el) TTM.note = el.value;
  var swap = function (nb) { TEA.toMe = TEA.toMe.map(function (x) { return x.id === id ? nb : x; }); };
  delete TTM.deny[id];
  if (!LIVE) {
    swap(Object.assign({}, b, { status: 'rejected', st: 'no', word: 'отклонено, деньги возвращены на счёт', refunded: true }));
    TTM.open = null; TTM.note = ''; FLASH = { text: slovo('tea.toMe.refusedDone'), note: slovo('tea.demoNote') }; haptic('ok'); render(); return;
  }
  if (typeof TEA_URL.refuse !== 'function') { TTM.deny[id] = slovo('tea.noApi'); render(); return; }
  TTM.busy = id; render();
  api('POST', TEA_URL.refuse(id), { note: String(TTM.note || '').trim() }).then(function (r) {
    TTM.busy = null;
    var nb = r.status === 200 ? teaToMeFrom(r.data) : null;
    // весть о деньгах — по refunded ответа, как T10 (замечание arhitector32): не вернул — не обещаем
    if (nb && TEA.toMe) { swap(nb); TTM.open = null; TTM.note = ''; FLASH = (nb.refunded ? slovo('tea.toMe.refusedDone') : slovo('tea.toMe.refusedPlain')); haptic('ok'); }
    else { TTM.deny[id] = denyText(r); haptic('warn'); teaLoadToMe(); }
    if (current === 'teaToMe') render();
  });
}
/* ── teaBooks, teaBookReq: очередь броней и решение арт-директора (рецепты 42/teaBooks.md, 42/teaBookReq.md, №98) ──
   Цепочка владельца: гость бронирует → мастер соглашается (teaToMe) → арт-директор решает здесь. Сервер (a04c4dd)
   решает ТОЛЬКО master_ok: по pending decide отдаёт 409 «мастер ещё не согласился». Очередь — GET /tea/bookings →
   {bookings: [_row(queue=True)], pending, master_ok}; решение — POST /tea/bookings/{id}/decide {decision, note ≤ 500},
   ответ — та же строка. Разбор строки — teaToMeFrom (тот же словарь TEA_BOOK_ST, слово — status_ru печатью) плюс
   имя мастера; цена обязательна: без неё U4 и U6 не назвали бы сумму возврата. */
function teaQueueFrom(b) {
  var x = teaToMeFrom(b);
  if (!x || x.price === null || typeof b.master_name !== 'string') return null;
  x.masterName = b.master_name;
  return x;
}
/* Решать можно ТОЛЬКО бронь, с которой мастер согласился. Этим предикатом режутся группы teaBooks (V0 против V7)
   и рисуются кнопки teaBookReq (U5, U6): кнопка у pending заведомо получила бы 409. */
function teaMayDecide(b) { return !!b && b.status === 'master_ok'; }
var TBQ = { list: null, fail: '', masterOk: null, gen: 0, busy: null, err: '', note: '' };
// демонстрация: status_ru — копия STATUS_RU сервера a04c4dd ТОЛЬКО для демо (как teaToMeDemo)
function teaQueueDemo() {
  var d = function (n, h) { return Date.parse(ymdAdd(bkk(new Date()).ymd, n) + 'T' + h + ':00+07:00'); };
  var x = function (id, n, h, status, st, word, refunded) {
    return { id: id, master: 801, masterName: 'Чайный мастер', at: d(n, h), mins: 90, st: st, status: status, word: word,
             price: '600', guest: 'Гость клуба', refund: null, note: '', refunded: refunded };
  };
  return [x(9102, 3, '19:00', 'master_ok', 'wait', 'мастер согласился, ждёт арт-директора', false),
          x(9101, 2, '17:00', 'pending', 'wait', 'ждёт решения', false),
          x(9103, 1, '18:00', 'rejected', 'no', 'отклонено, деньги возвращены на счёт', true)];
}
function teaQueueById(id) { return (TBQ.list || []).filter(function (b) { return String(b.id) === String(id); })[0]; }
function teaLoadQueue() {
  if (!LIVE) { if (!TBQ.list) TBQ.list = teaQueueDemo(); TBQ.masterOk = TBQ.list.filter(teaMayDecide).length; TBQ.fail = ''; return; }
  TBQ.fail = '';
  if (!teaLive('queue')) { TBQ.fail = slovo('tea.noApi'); return; }
  var gen = ++TBQ.gen;
  api('GET', TEA_URL.queue()).then(function (r) {
    if (gen !== TBQ.gen) return;
    var d = r.status === 200 && r.data ? r.data : null;
    var got = d && Array.isArray(d.bookings) ? d.bookings.map(teaQueueFrom) : null;
    // S2 — число сервера master_ok (ждут арт-директора), а не pending (ждут мастера): рецепт masters.md
    if (got && got.every(Boolean) && typeof d.master_ok === 'number') { TBQ.list = got; TBQ.masterOk = d.master_ok; }
    else { TBQ.list = null; TBQ.masterOk = null; TBQ.fail = r.status === 403 ? denyText(r) : failText(r); }
    // бронь пропала из перечитанной очереди — назад в очередь, состояние не выдумывается (teaBookReq «Состояния»)
    // leaving — от повторного входа: go('teaBooks') сам перечитывает очередь, пока current ещё teaBookReq
    if (current === 'teaBookReq' && TBQ.list && !teaQueueById(param)) {
      if (!TBQ.leaving) { TBQ.leaving = true; go('teaBooks'); TBQ.leaving = false; }
      return;
    }
    teaRerender({ masters: 1, teaBooks: 1, teaBookReq: 1 });
  });
}
/* U5 «Согласовать» / U6 «Отказать и вернуть». 200 — строка из ответа в очередь, весть, назад на teaBooks; весть о
   деньгах — по refunded ОТВЕТА (как T10): не вернул — слово сервера, а не обещание. 409 — очередь перечитывается,
   дальше судит перечитанное состояние (U9 при master_ok, U10 иначе); иной отказ — U9, набранное в U2 цело. */
function teaDecideSend(id, yes) {
  var b = teaQueueById(id);
  if (TBQ.busy !== null || !b || !teaMayDecide(b)) return;
  var el = document.getElementById('tbr-note'); if (el) TBQ.note = el.value;
  TBQ.err = '';
  var swap = function (nb) { TBQ.list = TBQ.list.map(function (x) { return String(x.id) === String(id) ? nb : x; }); };
  if (!LIVE) {
    swap(Object.assign({}, b, yes ? { status: 'approved', st: 'ok', word: 'согласовано' }
                                  : { status: 'rejected', st: 'no', word: 'отклонено, деньги возвращены на счёт', refunded: true }));
    TBQ.masterOk = TBQ.list.filter(teaMayDecide).length; TBQ.note = '';
    FLASH = { text: yes ? slovo('tea.bookReq.doneYes') : slovo('tea.bookReq.doneNo', { sum: money(b.price) }), note: slovo('tea.demoNote') };
    haptic('ok'); go('teaBooks'); return;
  }
  if (typeof TEA_URL.decide !== 'function') { TBQ.err = slovo('tea.noApi'); render(); return; }
  TBQ.busy = yes ? 'yes' : 'no'; render();
  api('POST', TEA_URL.decide(id), { decision: yes ? 'approved' : 'rejected', note: yes ? '' : String(TBQ.note || '').trim() }).then(function (r) {
    TBQ.busy = null;
    var nb = r.status === 200 ? teaQueueFrom(r.data) : null;
    if (nb && TBQ.list) {
      swap(nb); TBQ.note = '';
      FLASH = nb.status === 'approved' ? slovo('tea.bookReq.doneYes')
        : nb.status === 'rejected' && nb.refunded ? slovo('tea.bookReq.doneNo', { sum: money(nb.price) }) : nb.word;
      haptic('ok'); go('teaBooks'); return;
    }
    TBQ.err = denyText(r); haptic('warn');
    if (r.status === 409) { TBQ.list = null; teaLoadQueue(); }
    if (current === 'teaBookReq') render();
  });
}
/* S2 на «Слотах и мастерах» (рецепт 42/masters.md) — вызывается из SCREENS.masters (js/18). Пока teaBooks вне
   WIRED, в живом входа нет — как T0 у teaToMe и K5 у teaBook. Метка — TBQ.masterOk, до ответа не ноль. */
function teaBooksEntry(entry) {
  if (closed('teaBooks')) return '';
  return entry('data-go="teaBooks"', esc(slovo('tea.books.title')), esc(waitSub(TBQ.masterOk, slovo('tea.books.entrySub'))), waitMark(TBQ.masterOk));
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
    if (a !== null) { TEA.amount = Number(a); TEA.share = s === null ? null : Number(s); } else TEA.priceFail = failText(r);
    teaRerender({ teaHold: 1, teaApply: 1, home: 1 });
  });
}

/* Стык с ЧАЙ-Б (H0 «Провести в клубе», js/07-mastera.js): цена заявки церемонии — число; null — не узнали;
   undefined — грузится. Загрузка — та же, что у teaHold. */
function teaHoldPrice() { return TEA.amount !== null ? TEA.amount : TEA.priceFail ? null : undefined; }
function loadTeaHoldPrice() { teaLoadPrice(); }

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
  return teaDay(a.ymd) + ' · ' + a.hm + ' — ' + slovo('tea.when.until', { hm: z.hm, day: Number(y[2]) + ' ' + MONTHS[Number(y[1]) - 1] });
}
function teaDeny(t, verbatim) {
  return '<div class="deny" role="alert">' + svg(ICON.info) + '<span' + (verbatim ? ' class="verbatim"' : '') + '>' + esc(t) + '</span></div>';
}
function teaRetry(text, act) {
  return '<div class="card quiet"><div class="col"><span class="small">' + esc(text) + '</span>' +
    '<button type="button" class="btn quiet" data-action="' + act + '">' + esc(slovo('tea.retry')) + '</button></div></div>';
}
/* .album — галерея 1–3 кадров, видна целиком: первый крупный сверху, второй и третий мелкими превью в ряд под
   ним. Пролистывания и точек нет. Ноль кадров — блока нет. Кадр не загрузился — пустой квадрат --surface. */
/* Шаг 44 (рецепт foto/sostav.md, «Правка .album»): `pair` — вид СОБЫТИЯ: при двух кадрах они стоят рядом равными
   половинами (`.album-pair`), крупного нет. Карточка мастера зовёт без `pair` и рисуется побайтно как прежде:
   №81 «а» отказал отдельному механизму, а не велел менять её работающий показ (решение координатора 26.11). */
function teaAlbum(shots, edit, pair) {
  shots = shots.slice(0, TEA_SHOTS_MAX);
  if (!shots.length) return '';
  var frame = function (s, i) {
    var src = typeof s === 'string' ? s : s.url;
    return '<div class="album-frame' + (i ? ' small' : '') + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '') +
      (edit ? edit(s, i) : '') + '</div>';
  };
  if (pair && shots.length === 2) return '<div class="album album-pair">' + frame(shots[0], 0) + frame(shots[1], 1) + '</div>';
  return '<div class="album">' + frame(shots[0], 0) +
    (shots.length > 1 ? '<div class="album-thumbs">' + shots.slice(1).map(function (s, k) { return frame(s, k + 1); }).join('') + '</div>' : '') +
  '</div>';
}
// кадр не загрузился — прячем картинку, рамка остаётся пустым квадратом (лента не сжимается)
document.addEventListener('error', function (ev) {
  var t = ev.target;
  if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('album-frame')) t.style.visibility = 'hidden';
}, true);

/* Разметка карточки мастера: альбом, описание, цена. o.book — кнопка K5 (или K6 у своей); без неё — предпросмотр
   teaApply (A5) и согласование teaReq у ЧАЙ-Б. */
/* Своя ли карточка: master_id — номер ПЕРВОЙ подачи мастера, а не Telegram id (api#228, tea.py:18), и он один у
   всех подач мастера. Поэтому сверка — с номером из своей карточки (/tea/card/mine), а не с DATA.member.uid. */
function teaMyId() { var m = TEA.mine, c = m && (m.live || m.card); return c ? c.id : null; }
function teaIsMine(c) { var my = teaMyId(); return LIVE && my !== null && c.id === my; }
function teaCardHtml(c, o) {
  o = o || {};
  // K5 ведёт на teaBook; пока брони мастера на сервере нет (teaBook вне WIRED), кнопки в живом нет — как у дверей closed()
  var foot = !o.book ? '' : teaIsMine(c) ? '<span class="small">' + esc(slovo('tea.card.mine')) + '</span>'
    : closed('teaBook') ? '' : '<button type="button" class="btn" data-action="tea-book:' + esc(c.id) + '">' + esc(slovo('tea.card.book')) + '</button>';
  return teaAlbum(c.shots || []) +
    '<div class="card"><div class="col"><span class="label">' + esc(slovo('tea.card.aboutLabel')) + '</span>' +
      '<p style="font-size:14px;white-space:pre-line;margin:0">' + esc(c.about) + '</p></div></div>' +
    '<div class="card"><div class="col">' +
      '<div class="row"><span class="small">' + esc(slovo('tea.card.priceLabel', { dur: c.mins ? teaHm(c.mins) : '—' })) + '</span>' +
        '<b class="num">' + esc(money(c.price)) + ' ฿</b></div>' +
      '<span class="small">' + esc(slovo('tea.card.priceNote')) + '</span>' + foot +
    '</div></div>';
}

/* ── формы: набранное ─────────────────────────────────────────────────────────────────────────────────────── */
function teaVal(id) { var el = document.getElementById(id); return el ? el.value : null; }
function teaApplyBlank(mine) {
  var c = mine && mine.card;
  return { about: c ? c.about : '', price: c ? String(c.price) : '', h: c && c.mins ? String(Math.floor(c.mins / 60)) : '',
           m: c && c.mins ? String(c.mins % 60) : '', shots: c ? c.shots.slice(0, TEA_SHOTS_MAX).map(function (u, i) { return { url: u, id: i + 1, state: 'ok' }; }) : [],
           err: '', deny: '', busy: false, preview: false };
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
function teaShareLine(v, low) {   // low: 'hold' — грань входа заявки, 'apply' — грань цены карточки
  var s = TEA.share, n = Number(v);
  if (typeof s !== 'number') return '';
  if (v === '' || !/^\d+(\.\d+)?$/.test(String(v)) || n < s) return teaDeny(low === 'hold' ? slovo('tea.hold.entryLow', { share: money(s) }) : slovo('tea.apply.priceLow', { share: money(s) }));
  return '<span class="small">' + esc(slovo('tea.share', { share: money(s), rest: money(Math.round((n - s) * 100) / 100) })) + '</span>';
}
// ввод без перерисовки: строка доли и погашенность кнопки идут за набором, фокус не теряется
document.addEventListener('input', function (ev) {
  var t = ev.target; if (!t || !t.id) return;
  if (t.id === 'thf-entry') {
    THF.entry = t.value;
    var box = document.getElementById('thf-share'); if (box) box.innerHTML = teaShareLine(THF.entry, 'hold');
    var b = document.getElementById('thf-send'); if (b) { b.disabled = !teaHoldReady(); b.setAttribute('aria-disabled', String(b.disabled)); }
  }
  if (t.id === 'ttm-note') TTM.note = t.value;     // T8: набранное переживает перерисовку
  if (t.id === 'tbr-note') TBQ.note = t.value;     // U2: «Слова гостю» переживают перерисовку ответом очереди (находка arhitektor34)
  if (t.id === 'taf-price') {
    TAF.price = t.value;
    var bx = document.getElementById('taf-share'); if (bx) bx.innerHTML = teaShareLine(TAF.price, 'apply');
  }
});

/* ── тела запросов: ни места, ни стола (цитаты 7, 8) ─────────────────────────────────────────────────────── */
/* Время — как у POST /master/request на api main (NewMasterRequest): день starts_on (ГГГГ-ММ-ДД) и время
   start_local (ЧЧ:ММ) по часам клуба — это ymd и from выбора календаря. Бронь мастера — та же пара (слово координатора: ведёт сервер). */
function teaBookBody(c, pick) { return { master_id: c.id, starts_on: pick.ymd, start_local: pick.from }; }
function teaHoldBody(pick) {
  return fotoBody('teaHold', { occupancy: 'tea', title: THF.title.trim(), about: THF.about, seats: Number(THF.seats || 0), price: String(THF.entry).trim(),
           starts_on: pick.ymd, start_local: pick.from, duration_min: pick.mins });
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
    FLASH = { text: slovo('tea.book.done'), note: slovo('tea.demoNote') }; haptic('ok'); go('teaMaster', c.id); return;
  }
  if (!teaLive('book')) { TB.err = slovo('tea.noApi'); render(); return; }
  TB.busy = true; TB.err = ''; render();
  api('POST', TEA_URL.book(), teaBookBody(c, pick)).then(function (r) {
    TB.busy = false; refreshMe();
    if (r.status === 200 || r.status === 201) { FLASH = slovo('tea.book.done'); haptic('ok'); go('teaMaster', c.id); return; }
    TB.err = denyText(r); haptic('warn');
    if (current === 'teaBook') render();
  });
}
function teaHoldReady() {
  var e = Number(THF.entry);
  // TEA.share — число (teaLoadPrice: Number) или null. При null `e >= null` истинно для любого входа, прошедшего
  // регулярку: без доли нижнюю грань №78 держит сервер, клиент её не выдумывает (константы 100 нет).
  return !THF.busy && !fotoBusy('teaHold') && typeof TEA.amount === 'number' && /^\d+(\.\d+)?$/.test(String(THF.entry).trim()) &&
    e >= TEA.share && !!teaPick('teaHold', THF.stale) && !teaHoldShort();
}
function teaHoldShort() { var b = teaBal(); return LIVE && typeof TEA.amount === 'number' && b !== null && TEA.amount > b ? TEA.amount - b : 0; }
function teaHoldSend() {
  teaGrab();
  var pick = teaPick('teaHold', THF.stale);
  THF.deny = ''; THF.money = false;
  THF.err = !THF.title.trim() ? slovo('tea.hold.noTitle') : '';
  if (THF.err || !teaHoldReady()) { render(); return; }
  if (!LIVE) {
    FLASH = { text: slovo('tea.hold.done'), note: slovo('tea.demoNote') }; haptic('ok'); go('home'); return;
  }
  if (!teaLive('hold')) { THF.deny = slovo('tea.noApi'); render(); return; }
  THF.busy = true; render();
  var amount = TEA.amount;
  api('POST', TEA_URL.hold(), teaHoldBody(pick)).then(function (r) {
    THF.busy = false; refreshMe();
    if (typeof loadMineMaster === 'function') loadMineMaster();   // строка в «Ваших букингах» на home
    if (r.status === 200 || r.status === 201) {
      FLASH = { text: slovo('tea.hold.done'), note: slovo('tea.hold.doneNote', { amount: money(amount) }) };
      THF = { title: '', about: '', seats: '0', entry: '', err: '', deny: '', money: false, busy: false, stale: pick };
      fotoDone('teaHold'); haptic('ok'); go('home'); return;
    }
    // отказ по деньгам — словами сервера, под ним путь пополнения (C12); признак — code 'insufficient_funds' (409, app/refusal.py)
    THF.deny = denyText(r); THF.money = r.data && r.data.code === 'insufficient_funds' || r.status === 402 || /хват|баланс|счёт|счет/i.test(detailOf(r));
    haptic('warn'); if (current === 'teaHold') render();
  });
}
function teaApplySend() {
  teaGrab();
  TAF.deny = '';
  var s = TEA.share, p = String(TAF.price).trim(), mins = teaMins();
  TAF.err = !TAF.about.trim() ? slovo('tea.apply.noAbout')
    : !/^\d+(\.\d+)?$/.test(p) || typeof s === 'number' && Number(p) < s ? slovo('tea.apply.priceLow', { share: typeof s === 'number' ? money(s) : '…' })
    : !(mins > 0) ? slovo('tea.apply.noDur') : '';
  if (TAF.err || TAF.busy) { render(); return; }
  if (!LIVE) {
    FLASH = { text: slovo('tea.apply.done'), note: slovo('tea.demoNote') }; TEA.mine = TEA_DEMO.mine = { status: 'pending', note: '', card: null };
    TAF = teaApplyBlank(null); haptic('ok'); go('home'); return;
  }
  if (!teaLive('apply')) { TAF.deny = slovo('tea.noApi'); render(); return; }
  TAF.busy = true; render();
  api('POST', TEA_URL.apply(), teaApplyBody()).then(function (r) {
    TAF.busy = false;
    if (r.status === 200 || r.status === 201) { FLASH = slovo('tea.apply.done'); TAF = teaApplyBlank(null); loadTeaMine(); haptic('ok'); go('home'); return; }
    TAF.deny = denyText(r); haptic('warn');
    if (current === 'teaApply') render();
  });
}
/* Загрузки кадра нет: ручки приёма на сервере ещё нет, форма её появится отдельно. Форма показывает кадры, что
   уже есть у карточки, — их можно убрать и переставить первым. */

/* ── крючки навигации (вписаны ЧАЙ-Б в js/21-navigaciya.js) ──────────────────────────────────────────────── */
/* «заново» (№97, №109 «б»): подача, заполненная как у прошедшей церемонии `id` (строка архива, histById).
   Переносится: название, описание, места (0 — без ограничения), вход. НЕ переносятся: дата, время, длительность —
   их даёт выбор календаря, а прошедшее время сервер не примет (экран говорит это словами, tea.hold.againNote);
   снимки прошлой — не переносятся (вопрос №115 у владельца); новые грузятся блоком «Фото» (FOTO_ON.teaHold открыт, v235).
   Строка не церемония или не найдена — пустая форма, а не форма с чужим видом. */
function teaAgainForm(id, blank) {
  var h = id !== null && id !== undefined && typeof histById === 'function' ? histById(id) : null;
  if (!h || h.occ !== 'tea') return blank;
  blank.title = h.title; blank.about = h.about; blank.seats = String(h.of); blank.entry = String(h.price); blank.again = h.eid;
  return blank;
}
function teaGo(screen, p) {
  if (screen === 'teaMasters') teaLoadList();
  if ((screen === 'teaMaster' || screen === 'teaBook') && LIVE && !TEA.mine && !TEA.mineFail) loadTeaMine();   // «своя» — по ней
  if (screen === 'teaMaster') { teaLoadCard(p); teaLoadBooks(p); }
  if (screen === 'teaBook') {
    var id = p !== undefined && p !== null ? p : TB.id;
    // новый вход с карточки: выбор, сделанный раньше (у другого мастера, с другой длительностью), не подставляется
    if (current !== 'teaBook' && current !== 'calendar') TB = { id: id, err: '', busy: false, stale: typeof calPicked === 'function' ? calPicked('teaBook') : null };
    teaLoadCard(id); teaLoadBooks(id);        // и на возврат из календаря (рецепт «Перечитать на входе»)
  }
  if (screen === 'teaToMe') {
    if (current !== 'teaToMe') TTM = { busy: null, deny: {}, open: null, note: '' };
    if (LIVE && !TEA.mine && !TEA.mineFail) loadTeaMine();     // свой номер мастера — для teaMayAccept
    teaLoadToMe();
  }
  // очередь броней — на каждый вход на «Слоты и мастера» (метка S2) и в очередь; решение — поля с нуля (рецепты 42/teaBooks.md, 42/teaBookReq.md)
  if ((screen === 'masters' || screen === 'teaBooks') && current !== screen && (!LIVE || mayMasters())) teaLoadQueue();
  if (screen === 'teaBookReq' && (current !== 'teaBookReq' || param !== p)) {
    TBQ.err = ''; TBQ.note = ''; TBQ.busy = null;
    if (!TBQ.list) teaLoadQueue();
  }
  if (screen === 'teaHold') {
    if (current !== 'teaHold' && current !== 'calendar')
      THF = teaAgainForm(p && typeof p === 'object' ? p.again : null,
        { title: '', about: '', seats: '0', entry: '', err: '', deny: '', money: false, busy: false, stale: typeof calPicked === 'function' ? calPicked('teaHold') : null });
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
  if (a === 'tea-tome-accept') { haptic(); teaAcceptSend(Number(arg)); return true; }
  if (a === 'tea-tome-retry') { teaLoadToMe(); render(); return true; }
  if (a === 'tea-tome-refuse') { var rb = (TEA.toMe || []).filter(function (x) { return x.id === Number(arg); })[0];
    if (rb && teaMayAccept(rb) && TTM.busy === null) { TTM.open = rb.id; TTM.note = ''; render(); } return true; }
  if (a === 'tea-tome-refuse-cancel') { TTM.open = null; TTM.note = ''; render(); return true; }
  if (a === 'tea-tome-refuse-send') { haptic(); teaRefuseSend(Number(arg)); return true; }
  if (a === 'tea-books-open') { haptic(); go('teaBookReq', Number(arg)); return true; }
  if (a === 'tea-books-retry') { teaLoadQueue(); render(); return true; }
  // U10 «К очереди» — действием, а не data-go: вход в очередь на «Слотах» ровно один (признак masters.md)
  if (a === 'tea-books-back') { go('teaBooks'); return true; }
  if (a === 'tea-books-yes' || a === 'tea-books-no') { haptic(); teaDecideSend(Number(arg), a === 'tea-books-yes'); return true; }
  if (a === 'tea-hold-cal') { teaGrab(); go('calendar', { pick: 'teaHold' }); return true; }
  if (a === 'tea-hold-send') { teaHoldSend(); return true; }
  if (a === 'tea-price-retry') { teaGrab(); teaLoadPrice(); render(); return true; }
  if (a === 'tea-apply-send') { teaApplySend(); return true; }
  if (a === 'tea-apply-preview') { teaGrab(); TAF.preview = !TAF.preview; render(); return true; }
  if (a === 'tea-shot-del') { teaGrab(); TAF.shots.splice(Number(arg), 1); render(); return true; }
  if (a === 'tea-shot-first') { teaGrab(); var i = Number(arg), s = TAF.shots.splice(i, 1)[0]; if (s) TAF.shots.unshift(s); render(); return true; }
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

/* T4 и T7, а при раскрытом отказе — T8, T9, T9a. Зовётся только под teaMayAccept. */
function teaToMeButtons(b, busy) {
  var off = TTM.busy !== null ? ' disabled aria-disabled="true"' : '';
  if (TTM.open === b.id) return '<div class="field"><label for="ttm-note">' + esc(slovo('tea.toMe.noteLabel')) + '</label>' +
      '<textarea id="ttm-note" rows="3" maxlength="500">' + esc(TTM.note) + '</textarea></div>' +
    '<div class="row"><button type="button" class="btn ghost" data-action="tea-tome-refuse-send:' + esc(b.id) + '"' + off + '>' +
      esc(busy ? slovo('tea.sending') : slovo('tea.toMe.refuseSend')) + '</button>' +
    '<button type="button" class="btn quiet" data-action="tea-tome-refuse-cancel"' + off + '>' + esc(slovo('tea.toMe.refuseCancel')) + '</button></div>';
  return '<div class="row"><button type="button" class="btn" data-action="tea-tome-accept:' + esc(b.id) + '"' + off + '>' +
      esc(busy ? slovo('tea.sending') : slovo('tea.toMe.accept')) + '</button>' +
    '<button type="button" class="btn ghost" data-action="tea-tome-refuse:' + esc(b.id) + '"' + off + '>' + esc(slovo('tea.toMe.refuse')) + '</button></div>';
}

/* ── экраны ───────────────────────────────────────────────────────────────────────────────────────────────── */
Object.assign(SCREENS, {

  teaMasters: function () {
    if (TEA.listFail) return teaRetry(slovo('tea.list.fail'), 'tea-list-retry');
    if (!TEA.list) return '<span class="small">' + esc(slovo('tea.list.loading')) + '</span>';
    if (!TEA.list.length) return '<div class="card quiet"><span class="small">' + esc(slovo('tea.list.empty')) + '</span></div>';
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
    if (TEA.cardGone) return '<div class="card quiet"><div class="col"><span class="small">' + esc(slovo('tea.card.gone')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="tea-to-list">' + esc(slovo('tea.card.toList')) + '</button></div></div>';
    if (TEA.cardFail) return teaRetry(slovo('tea.card.fail'), 'tea-card-retry');
    if (!TEA.card) return '<span class="small">' + esc(slovo('tea.card.loading')) + '</span>';
    return (FLASH ? flash() : '') + teaCardHtml(TEA.card, { book: true });
  },

  teaBook: function () {
    var c = TEA.card;
    if (TEA.cardGone) return SCREENS.teaMaster();
    if (TEA.cardFail) return teaRetry(slovo('tea.card.fail'), 'tea-card-retry');
    if (!c) return '<span class="small">' + esc(slovo('tea.card.loading')) + '</span>';
    var pick = teaPick('teaBook', TB.stale), bal = teaBal(), price = Number(c.price);
    var short = LIVE && bal !== null && price > bal ? Math.round((price - bal) * 100) / 100 : 0;
    var books = (TEA.books[c.id] || []).map(function (b) {
      var sw = { wait: slovo('tea.book.stWait'), ok: slovo('tea.book.stOk'), no: slovo('tea.book.stNo') };
      return '<div class="card quiet"><div class="col">' +
        '<div class="row"><b>' + esc(teaWhen(b.at, b.mins)) + '</b><span class="st ' + b.st + '">' + esc(sw[b.st]) + '</span></div>' +
        (b.st === 'no' && b.refund ? '<span class="small">' + esc(slovo('tea.book.refund', { sum: money(b.refund) })) + '</span>' : '') +
        (b.st === 'no' && b.note ? '<span class="said">' + esc(b.note) + '</span>' : '') +
      '</div></div>';
    }).join('');
    return '<span class="small">' + esc(c.name) + ' · ' + esc(slovo('tea.book.sub')) + ' <span class="num">' + esc(money(c.price)) + ' ฿</span></span>' +
      books +
      '<div class="card"><div class="col"><span class="label">' + esc(slovo('tea.time')) + '</span>' +
        (pick ? '<div class="row"><b>' + esc(pick.label) + '</b><button type="button" class="btn quiet mini" data-action="tea-book-cal">' + esc(slovo('tea.timeChange')) + '</button></div>'
              : '<button type="button" class="btn quiet" data-action="tea-book-cal">' + esc(slovo('tea.timePick')) + '</button>') +
      '</div></div>' +
      '<div class="card"><div class="col">' +
        (pick ? '<div class="row"><span class="small">' + esc(slovo('tea.willCharge')) + '</span><b class="num">' + esc(money(c.price)) + ' ฿</b></div>' : '') +
        (short ? '<span class="small">' + esc(slovo('tea.book.short', { n: money(short) })) + '</span>' : '') +
        '<button type="button" class="btn" data-action="tea-book-send"' + (!pick || short || TB.busy || teaIsMine(c) ? ' disabled aria-disabled="true"' : '') + '>' +
          esc(TB.busy ? slovo('tea.sending') : slovo('tea.book.send')) + '</button>' +
      '</div></div>' +
      (TB.err ? teaDeny(TB.err, true) : '');
  },

  teaToMe: function () {
    if (TEA.toMeFail) return teaRetry(slovo('tea.toMe.fail'), 'tea-tome-retry');
    if (!TEA.toMe) return '<span class="small">' + esc(slovo('tea.card.loading')) + '</span>';
    var head = (FLASH ? flash() : '') + '<span class="small">' + esc(slovo('tea.toMe.sub')) + '</span>';
    if (!TEA.toMe.length) return head + '<div class="card quiet"><div class="col"><b>' + esc(slovo('tea.toMe.empty')) + '</b>' +
      '<span class="small">' + esc(slovo('tea.toMe.emptyNote')) + '</span></div></div>';
    return head + TEA.toMe.map(function (b) {
      var busy = TTM.busy === b.id;
      return '<div class="card" data-tome="' + esc(b.id) + '"><div class="col">' +
        '<div class="row"><b>' + esc(teaWhen(b.at, b.mins)) + '</b><span class="st ' + b.st + '"><span class="verbatim">' + esc(b.word) + '</span></span></div>' +
        '<div class="row"><span class="small clamp1">' + esc(b.guest) + '</span>' + (b.price !== null ? '<b class="num">' + esc(money(b.price)) + ' ฿</b>' : '') + '</div>' +
        (b.status === 'rejected' && b.refunded && b.price !== null ? '<span class="small">' + esc(slovo('tea.toMe.refunded', { sum: money(b.price) })) + '</span>' : '') +
        (teaMayAccept(b) ? teaToMeButtons(b, busy) : '') +
        (TTM.deny[b.id] ? teaDeny(TTM.deny[b.id], true) : '') +
      '</div></div>';
    }).join('');
  },

  // рецепт 42/teaBooks.md: группы режет teaMayDecide; порядок — сервера, клиент не пересортировывает
  teaBooks: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!TBQ.list) return TBQ.fail ? teaRetry(slovo('tea.toMe.fail'), 'tea-books-retry') : '<span class="small">' + esc(slovo('tea.card.loading')) + '</span>';
    var L = TBQ.list, head = FLASH ? flash() : '';
    if (!L.length) return head + '<div class="card quiet"><div class="col"><b>' + esc(slovo('tea.books.empty')) + '</b>' +
      '<span class="small">' + esc(slovo('tea.books.emptyNote')) + '</span></div></div>';
    var dec = L.filter(teaMayDecide);
    var wait = L.filter(function (b) { return !teaMayDecide(b) && b.status === 'pending'; });
    var past = L.filter(function (b) { return !teaMayDecide(b) && b.status !== 'pending'; });
    var text = function (b, extra) {
      return '<span class="grow"><b class="clamp1">' + esc(b.guest) + '</b>' +
        '<span class="small">' + esc(slovo('tea.books.row', { name: b.masterName, when: teaWhen(b.at, b.mins) })) + '</span>' + (extra || '') + '</span>' +
        '<span class="st ' + b.st + '"><span class="verbatim">' + esc(b.word) + '</span></span>';
    };
    var grp = function (label, rows) { return rows.length ? '<div class="group"><span class="label">' + esc(label) + '</span>' + rows.join('') + '</div>' : ''; };
    return head +
      grp(slovo('tea.books.wait'), dec.map(function (b) {
        return '<button type="button" class="listitem" data-book="' + esc(b.id) + '" data-action="tea-books-open:' + esc(b.id) + '">' + text(b) + svg(ICON.chev, 'chev') + '</button>';
      })) +
      grp(slovo('tea.books.master'), wait.map(function (b) {
        return '<div class="listitem" data-book="' + esc(b.id) + '">' + text(b, '<span class="small">' + esc(slovo('tea.books.afterMaster')) + '</span>') + '</div>';
      })) +
      grp(slovo('tea.books.past'), past.map(function (b) {
        // V8: возврат — по refunded сервера, не по слову «отказ»
        return '<div class="listitem" data-book="' + esc(b.id) + '">' + text(b, b.status === 'rejected' && b.refunded
          ? '<span class="small">' + esc(slovo('tea.toMe.refunded', { sum: money(b.price) })) + '</span>' : '') + '</div>';
      }));
  },

  // рецепт 42/teaBookReq.md: кнопки — только под teaMayDecide; иначе U10 по последнему ответу сервера
  teaBookReq: function (id) {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!TBQ.list) return SCREENS.teaBooks();
    var b = teaQueueById(id);
    if (!b) return SCREENS.teaBooks();
    var sum = money(b.price), head = FLASH ? flash() : '';
    // подпись — готовым словом, а не ключом: ключ перевода только литералом (сборщик текстов читает код, live slova-klyuchi)
    var line = function (word, v) { return '<div><span class="small">' + esc(word) + '</span>' + v + '</div>'; };
    var top = '<div class="rows">' + line(slovo('tea.bookReq.master'), '<b class="clamp1">' + esc(b.masterName) + '</b>') +
        line(slovo('tea.bookReq.when'), '<b>' + esc(teaWhen(b.at, b.mins)) + '</b>') +
        line(slovo('tea.bookReq.paid'), '<b class="num">' + esc(sum) + ' ฿</b>') + '</div>' +
      '<span class="st ' + b.st + '"><span class="verbatim">' + esc(b.word) + '</span></span>';
    if (!teaMayDecide(b)) return head + top +
      '<div class="card quiet"><div class="col"><b>' + esc(b.status === 'pending' ? slovo('tea.bookReq.notYet') : slovo('tea.bookReq.decided')) + '</b>' +
        (b.status === 'rejected' && b.refunded ? '<span class="small">' + esc(slovo('tea.toMe.refunded', { sum: sum })) + '</span>' : '') +
        '<button type="button" class="btn quiet" data-action="tea-books-back">' + esc(slovo('tea.bookReq.back')) + '</button></div></div>';
    var off = TBQ.busy !== null ? ' disabled aria-disabled="true"' : '';
    return head + top +
      '<div class="card"><div class="field"><label for="tbr-note">' + esc(slovo('tea.bookReq.noteLabel')) + '</label>' +
        '<textarea id="tbr-note" rows="3" maxlength="500"' + off + '>' + esc(TBQ.note) + '</textarea>' +
        '<span class="small">' + esc(slovo('tea.bookReq.noteSub')) + '</span></div></div>' +
      '<span class="small">' + esc(slovo('tea.bookReq.yesNote')) + '</span>' +
      '<span class="small">' + esc(slovo('tea.bookReq.refund', { sum: sum })) + '</span>' +
      (TBQ.err ? teaDeny(TBQ.err, true) : '') +
      '<div class="row">' +
        '<button type="button" class="btn ghost" data-action="tea-books-no:' + esc(b.id) + '"' + off + '>' +
          esc(TBQ.busy === 'no' ? slovo('tea.sending') : slovo('tea.bookReq.no', { sum: sum })) + '</button>' +
        '<button type="button" class="btn" data-action="tea-books-yes:' + esc(b.id) + '"' + off + '>' +
          esc(TBQ.busy === 'yes' ? slovo('tea.sending') : slovo('tea.bookReq.yes')) + '</button>' +
      '</div>';
  },

  teaApply: function () {
    var m = TEA.mine, edit = m && m.status === 'approved', back = m && m.status === 'rejected';
    if (TAF.preview) return '<span class="small">' + esc(slovo('tea.apply.previewNote')) + '</span>' +
      teaCardHtml({ id: 0, name: '', about: TAF.about, price: String(TAF.price || '0'), mins: teaMins() || null,
                    shots: TAF.shots.filter(function (s) { return s.state === 'ok'; }).map(function (s) { return s.url; }) }, { book: false }) +
      '<button type="button" class="btn ghost" data-action="tea-apply-preview">' + esc(slovo('tea.apply.previewBack')) + '</button>';
    var shotEdit = function (s, i) {
      return '<span class="album-cap">' +
            '<button type="button" class="btn quiet mini" data-action="tea-shot-del:' + i + '">' + esc(slovo('tea.apply.shotDel')) + '</button>' +
            (i > 0 ? '<button type="button" class="btn quiet mini" data-action="tea-shot-first:' + i + '">' + esc(slovo('tea.apply.shotFirst')) + '</button>' : '') +
          '</span>';
    };
    return (edit ? '<span class="small">' + esc(slovo('tea.apply.editNote')) + '</span>' : '') +
      '<span class="small">' + esc(slovo('tea.apply.sub')) + '</span>' +
      (back && m.note ? '<span class="said">' + esc(m.note) + '</span>' : '') +
      '<div class="card"><div class="col"><span class="label">' + esc(slovo('tea.apply.photo')) + '</span>' +
        '<span class="small">' + esc(slovo('tea.apply.photoNote')) + '</span>' +
        teaAlbum(TAF.shots, shotEdit) +
      '</div></div>' +
      '<div class="card"><div class="col">' +
        '<div class="field"><label for="taf-about">' + esc(slovo('tea.apply.about')) + '</label>' +
          '<textarea id="taf-about" rows="5">' + esc(TAF.about) + '</textarea>' +
          '<span class="small">' + esc(slovo('tea.apply.aboutNote')) + '</span></div>' +
        '<div class="field"><label for="taf-price">' + esc(slovo('tea.apply.price')) + '</label>' +
          '<input id="taf-price" inputmode="decimal" value="' + esc(TAF.price) + '">' +
          '<span id="taf-share">' + (TAF.price !== '' ? teaShareLine(TAF.price, 'apply') : '') + '</span></div>' +
        '<div class="field"><label for="taf-h">' + esc(slovo('tea.apply.dur')) + '</label>' +
          '<div class="row"><input id="taf-h" inputmode="numeric" value="' + esc(TAF.h) + '" aria-label="' + esc(slovo('tea.apply.durH')) + '">' +
          '<span class="small">' + esc(slovo('tea.apply.durH')) + '</span>' +
          '<input id="taf-m" inputmode="numeric" value="' + esc(TAF.m) + '" aria-label="' + esc(slovo('tea.apply.durM')) + '">' +
          '<span class="small">' + esc(slovo('tea.apply.durM')) + '</span></div></div>' +
      '</div></div>' +
      '<button type="button" class="btn ghost" data-action="tea-apply-preview">' + esc(slovo('tea.apply.preview')) + '</button>' +
      (TAF.err ? teaDeny(TAF.err) : '') + (TAF.deny ? teaDeny(TAF.deny, true) : '') +
      '<button type="button" class="btn" data-action="tea-apply-send"' + (TAF.busy ? ' disabled aria-disabled="true"' : '') + '>' +
        esc(TAF.busy ? slovo('tea.sending') : edit ? slovo('tea.apply.sendEdit') : slovo('tea.apply.send')) + '</button>';
  },

  teaHold: function () {
    if (TEA.priceFail) return teaRetry(slovo('tea.hold.priceFail'), 'tea-price-retry');
    if (typeof TEA.amount !== 'number') return '<span class="small">' + esc(slovo('tea.card.loading')) + '</span>';
    var pick = teaPick('teaHold', THF.stale), short = teaHoldShort(), bal = teaBal();
    return '<span class="small">' + esc(slovo('tea.hold.sub', { amount: money(TEA.amount) })) + '</span>' +
      '<div class="card"><div class="col">' +
        '<div class="field"><label for="thf-title">' + esc(slovo('tea.hold.title')) + '</label><input id="thf-title" value="' + esc(THF.title) + '"></div>' +
        '<div class="field"><label for="thf-about">' + esc(slovo('tea.hold.about')) + '</label><textarea id="thf-about" rows="4">' + esc(THF.about) + '</textarea>' +
          '<span class="small">' + esc(slovo('tea.hold.aboutNote')) + '</span></div>' +
        '<div class="field"><label for="thf-seats">' + esc(slovo('tea.hold.seats')) + '</label><input id="thf-seats" inputmode="numeric" value="' + esc(THF.seats) + '">' +
          '<span class="small">' + esc(slovo('tea.hold.seatsNote')) + '</span></div>' +
        '<div class="field"><label for="thf-entry">' + esc(slovo('tea.hold.entry')) + '</label><input id="thf-entry" inputmode="decimal" value="' + esc(THF.entry) + '">' +
          '<span id="thf-share">' + teaShareLine(THF.entry, 'hold') + '</span></div>' +
      '</div></div>' +
      // шаг 44 (foto/teaHold.md): блок «Фото» после полей (C2), перед временем (C3); №81 «а» — тот же механизм, что у ивента
      fotoBlock('teaHold', slovo('foto.add')) +
      '<div class="card"><div class="col"><span class="label">' + esc(slovo('tea.time')) + '</span>' +
        (THF.again && !pick ? '<div class="note">' + svg(ICON.info) + '<span>' + esc(slovo('tea.hold.againNote')) + '</span></div>' : '') +
        (pick ? '<div class="row"><b>' + esc(pick.label) + '</b><button type="button" class="btn quiet mini" data-action="tea-hold-cal">' + esc(slovo('tea.timeChange')) + '</button></div>'
              : '<button type="button" class="btn quiet" data-action="tea-hold-cal">' + esc(slovo('tea.timePick')) + '</button>') +
      '</div></div>' +
      '<div class="card"><div class="col">' +
        (pick ? '<div class="row"><span class="small">' + esc(slovo('tea.willCharge')) + '</span><b class="num">' + esc(money(TEA.amount)) + ' ฿</b></div>' : '') +
        (short ? '<span class="small">' + esc(slovo('tea.hold.short', { n: money(short), amount: money(TEA.amount), balance: money(bal) })) + '</span>' : '') +
        '<button type="button" class="btn" id="thf-send" data-action="tea-hold-send"' + (teaHoldReady() ? '' : ' disabled aria-disabled="true"') + '>' +
          esc(THF.busy ? slovo('tea.sending') : fotoBusy('teaHold') ? slovo('foto.wait') : slovo('tea.hold.send')) + '</button>' +
      '</div></div>' +
      (short ? '<div class="note">' + svg(ICON.info) + '<span>' + esc(slovo('tea.hold.topupNote')) + '</span></div>' : '') +
      (THF.err ? teaDeny(THF.err) : '') +
      (THF.deny ? teaDeny(THF.deny, true) + (THF.money ? '<span class="small">' + esc(slovo('tea.hold.moneyNote')) + '</span>' : '') : '');
  },

  teaJoin: function (id) {
    if (LIVE && !EVENTS) return eventsWait();
    var e = teaJoinEvent(id);
    if (!e) return '<div class="card quiet"><span class="small">' + esc(slovo('tea.join.gone')) + '</span></div>';
    var mine = LIVE ? isMyEvent(e) : e.demoMine;
    var seats = e.unl ? slovo('tea.join.seatsNoLimit') : slovo('tea.join.seats', { free: e.seats, of: e.of });
    var foot = e.done ? '<div class="card quiet"><span class="small">' + esc(slovo('tea.join.past')) + '</span></div>'
      : mine ? '<div class="card quiet"><span class="small">' + esc(slovo('tea.join.mine')) + '</span></div>' + (LIVE ? signedBlock(e) : '')
      : bookBlock(e);
    return '<div class="row"><span class="pill tea">' + esc(slovo('tea.join.pill')) + '</span></div>' +
      '<div class="col"><h1 class="clamp2">' + esc(e.title) + '</h1>' +
        '<span class="small">' + esc(teaWhen(e.at, e.mins)) + '</span>' +
        '<span class="small">' + esc(slovo('tea.join.host', { name: e.master })) + '</span>' +
        '<span class="small">' + esc(seats) + '</span></div>' +
      (e.about ? '<div class="card"><p style="font-size:14px;white-space:pre-line;margin:0">' + esc(e.about) + '</p></div>' : '') +
      foot;
  }
});

// заголовки шапки: имя мастера на карточке — словом сервера; прочие — словарём
Object.assign(TITLES, { teaMasters: slovo('tea.list.title'), teaBook: slovo('tea.book.title'), teaApply: slovo('tea.apply.title'), teaToMe: slovo('tea.toMe.title'), teaBooks: slovo('tea.books.title'),
                        teaHold: slovo('tea.hold.title.screen'), teaJoin: slovo('tea.join.title') });
// teaBookReq — имя гостя брони (рецепт U-заголовок), словом сервера
Object.defineProperty(TITLES, 'teaBookReq', { get: function () { var b = teaQueueById(param); return b ? b.guest : ''; }, enumerable: true, configurable: true });
Object.defineProperty(TITLES, 'teaMaster', { get: function () { return TEA.card ? TEA.card.name : ''; }, enumerable: true, configurable: true });
