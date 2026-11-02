/* ── афиша ────────────────────────────────────
   Живая афиша и демонстрационная не смешиваются: EVENTS — то, что прислал
   сервер, DATA.events — зашитые примеры. Подменять вторую первой нельзя:
   демонстрацию открывают поверх живого режима.

   Что видно в снимке ответа и чего не видно по письму: цена приходит
   строкой («400.00»); booked_by_me у события, на которое не записался
   никто, приходит null, а не false, — поэтому поле проверяется на
   правдивость, а не на равенство; my_booking_id появился позже остальных и
   его отсутствие ответ не портит — просто отменять нечем.

   Место приходит ДВУМЯ полями, `place_id` и `place_name`, и оба бывают
   null сразу: мероприятия, заведённые до миграции мест, места не имеют и
   получить его не могут — ручки правки события на сервере нет вовсе.
   Половина места (номер без имени или имя без номера) — порченая строка, и
   афиша отказывается целиком: за выдуманным местом человек поедет ногами.

   Афиша отдаёт только то, что ещё НЕ кончилось — окно сервер считает по
   КОНЦУ события (`NOT (starts_at + duration_min <= now())`, замер по
   стволу api 23.10.2026). Поэтому «идёт» — обычное состояние строки, а
   «завершилось» попадает на экран лишь в щель между ответом сервера и
   взглядом человека. Пометка всё равно нужна: за эту щель жмут
   «Записаться». */
var EVENTS = null;          // афиша с сервера или null, пока не пришла
var EVENTS_STATE = '';      // '' — не грузили, 'loading', 'ok', иначе текст отказа
var EVENTS_GEN = 0;         // ответ старого запроса, пришедший позже, молчит
var EV_PLACES = null;       // места клуба для формы или null, пока не пришли
var EV_PLACES_STATE = '';   // '' — не спрашивали, 'loading', 'ok', иначе отказ
var EV_PLACES_GEN = 0;      // ответ старого запроса, пришедший позже, молчит
var SEG = 'все';            // выбранная часть дня на экране афиши
var WK = { off: 0, day: null };   // неделя афиши от текущей (0 — эта) и выбранный день (ymd острова)
var DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// даты — строками ymd острова; арифметика в UTC полдень, чтобы смена часов не сдвигала день
function ymdAdd(ymd, n) { var d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function ymdMonday(ymd) { var w = new Date(ymd + 'T12:00:00Z').getUTCDay(); return ymdAdd(ymd, -((w + 6) % 7)); }
function weekRange(a, b) {
  var x = a.split('-'), y = b.split('-');
  return x[1] === y[1] ? Number(x[2]) + ' – ' + Number(y[2]) + ' ' + MONTHS[Number(y[1]) - 1]
    : Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1] + ' – ' + Number(y[2]) + ' ' + MONTHS[Number(y[1]) - 1];
}
// день события на острове; у демо-набора даты нет — его «Сегодня/Завтра» и переводится в дату
function evYmd(e) {
  if (typeof e.at === 'number') return bkk(new Date(e.at)).ymd;
  var today = bkk(new Date()).ymd;
  return /^Сегодня/.test(e.day) ? today : /^Завтра/.test(e.day) ? ymdAdd(today, 1) : ymdAdd(today, 2);
}
var TZ = 'Asia/Bangkok';    // афиша клуба живёт по острову, а не по поясу телефона

var SEGS = [['все', 'Все'], ['утро', 'Утро'], ['день', 'День'], ['вечер', 'Вечер']];
var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
              'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* Время события — в поясе клуба. 'en-CA' взят не ради языка, а ради формы
   YYYY-MM-DD: в ней даты сравниваются строками, без сдвигов руками. */
function bkk(d) {
  return {
    ymd: d.toLocaleDateString('en-CA', { timeZone: TZ }),
    hm: d.toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
    dow: d.toLocaleDateString('ru-RU', { timeZone: TZ, weekday: 'long' })
  };
}

/* Короткая дата для левой колонки строки (50 px): «6 ноя». Еженедельный слот мастера даёт строки с одним
   названием и временем — без даты их не различить (снимок владельца 30.10.2026: две «12:00 ДЕНЬ Кошкин
   дом» подряд на «Клубе», Cafe13KPG#675). Форма — кадр E61 (`9315b3f`). */
function dayShort(p) { var x = p.ymd.split('-'); return Number(x[2]) + ' ' + (MONTHS[Number(x[1]) - 1] || '').slice(0, 3); }
function dayLabel(p, now) {
  if (p.ymd === bkk(now).ymd) return 'Сегодня, ' + p.dow;
  if (p.ymd === bkk(new Date(now.getTime() + 86400000)).ymd) return 'Завтра, ' + p.dow;
  var x = p.ymd.split('-');
  return Number(x[2]) + ' ' + (MONTHS[Number(x[1]) - 1] || '') + ', ' + p.dow;
}

/* Ответ /events → строки, которые рисует экран: имена полей те же, что у
   демонстрационных событий, чтобы разметка осталась одна. Битое событие —
   отказ целиком: афиша с пропавшей строкой выглядит полной. */
// деньги строкой («400.00») или null/нет поля → число или null; иное — undefined: строка битая
function moneyOrNull(x) {
  if (x === undefined || x === null) return null;
  var n = typeof x === 'string' && /^\d+(\.\d+)?$/.test(x) ? Number(x) : NaN;
  return isFinite(n) ? n : undefined;
}
function fromEvents(d) {
  if (!Array.isArray(d)) return null;
  var now = new Date(), out = [];
  for (var i = 0; i < d.length; i++) {
    var e = d[i];
    if (!e || typeof e.id !== 'number' || typeof e.title !== 'string' || !e.title) return null;
    if (!KIND[e.kind] || typeof e.duration_min !== 'number' || !(e.duration_min > 0)) return null;
    /* `seats_left: null` — «мест без ограничения» (слово владельца 29.10.2026: «0 мест = не ограничено»,
       Cafe13KPG#639). Порядок здесь ОБРАТНЫЙ обычному: сервер меняет форму поля, которое клиент уже читает, —
       поэтому клиент первым, и при старом сервере null просто не приходит. Записалось тогда — `taken` сервера */
    if (typeof e.seats !== 'number' || !(e.seats_left === null || typeof e.seats_left === 'number') || typeof e.taken !== 'number') return null;
    if (typeof e.organizer_id !== 'number') return null;
    // Место: отсутствие приходит null'ом в ОБОИХ полях. Пустая строка в
    // имени — не место, а след поломки, поэтому имя требуется непустым.
    var pid = e.place_id === undefined ? null : e.place_id;
    var pname = e.place_name === undefined ? null : e.place_name;
    if (!(pid === null || typeof pid === 'number')) return null;
    if (!(pname === null || typeof pname === 'string' && pname)) return null;
    if ((pid === null) !== (pname === null)) return null;
    var price = num(e.price);
    if (!(price >= 0)) return null;
    var paid = moneyOrNull(e.my_entry_paid), refund = moneyOrNull(e.my_refund_now), donated = moneyOrNull(e.my_donated);
    if (paid === undefined || refund === undefined || donated === undefined) return null;
    var start = new Date(e.starts_at);
    if (isNaN(start.getTime())) return null;
    var ends = start.getTime() + e.duration_min * 60000;
    var p = bkk(start), fin = bkk(new Date(ends));
    out.push({
      id: String(e.id), eid: e.id, at: start.getTime(),
      title: e.title, day: dayLabel(p, now), date: dayShort(p), time: p.hm, until: fin.hm, mins: e.duration_min,
      seg: partOf(p.hm),
      // «Идёт» верно только до конца события: часовая практика,
      // начавшаяся два часа назад, идущей не является — это было бы
      // правдоподобной ложью. Кончившееся сервер в афише уже не отдаёт, но
      // считать конец всё равно нам: между его ответом и этим взглядом
      // проходит время.
      part: now.getTime() >= start.getTime() && now.getTime() < ends ? 'идёт' : partOf(p.hm),
      done: now.getTime() >= ends,
      master: [e.organizer_first_name, e.organizer_last_name].filter(Boolean).join(' ') || 'Без имени',
      by: e.organizer_id,       // Telegram id ведущего: по нему и только по нему «своё»
      seats: e.seats_left, of: e.seats, unl: e.seats_left === null, taken: e.taken,
      kind: e.kind, price: price,
      about: typeof e.about === 'string' ? e.about : '',
      filmed: !!e.filmed,
      booked: !!e.booked_by_me,
      // номер своей записи — им отменяют; его читает `bookBlock`: нет номера — нет и кнопки
      bookingId: typeof e.my_booking_id === 'number' ? e.my_booking_id : null,
      // шаг 7 (api#113/#114): уплаченный СО СЧЁТА вход своей записи и что вернёт снятие сейчас — числа сервера,
      // клиент возврат не считает. null — входа со счёта нет; поля нет — сервер до шага 7
      paid: paid, refund: refund,
      // галочка «Просить донат» (шаг 7, E67); нет поля — сервер до шага 7, правки галочки не предлагаем
      ask: typeof e.ask_donation === 'boolean' ? e.ask_donation : null,
      // благодарность (шаг 7, часть А): признак «можно» — СЕРВЕРА (`my_may_thank`, только в архиве), сумма уже отправленной —
      // `my_donated`; даты благодарности сервер не отдаёт, и клиент её не печатает (#755)
      mayThank: e.my_may_thank === true, donated: donated || 0,
      // граница полного возврата — мгновение СЕРВЕРА (`full_refund_until`, Cafe13KPG#750): срок клиент не знает и
      // не называет; нет поля или битое — фразы о границе нет, числа «Вернётся» остаются
      refundUntil: typeof e.full_refund_until === 'string' && !isNaN(Date.parse(e.full_refund_until)) ? new Date(e.full_refund_until) : null,
      place: pname, placeId: pid
    });
  }
  return out.sort(function (a, b) { return a.at - b.at; });
}

/* Список мест нужен только форме: в афише место приходит полями самого
   мероприятия, и отдельный запрос там был бы вторым источником правды.

   Порядок — по имени, здесь: сервер своего порядка не обещает, а чем
   сортировать сетку, решает владелец (Cafe13KPG#250) — это одна строка.
   `capacity: null` в снимке стоит у двора и сада: число никто не называл.
   Ноль вместо него был бы «мест нет» — ложь противоположного смысла. */
function fromPlaces(d) {
  if (!Array.isArray(d)) return null;
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var p = d[i];
    if (!p || typeof p.id !== 'number' || typeof p.name !== 'string' || !p.name) return null;
    if (typeof p.state !== 'string' || !p.state) return null;
    var cap = p.capacity === undefined ? null : p.capacity;
    if (!(cap === null || typeof cap === 'number' && cap > 0)) return null;
    // В выбор идёт только 'active': на скрытое место сервер назначить
    // откажет (409 «место … сейчас не используется»), а кнопка, ведущая к
    // верному отказу, обманывает дважды. Незнакомое состояние — тоже мимо:
    // разрешаем известное, а не запрещаем перечисленное.
    if (p.state !== 'active') continue;
    out.push({ id: p.id, name: p.name, capacity: typeof cap === 'number' ? cap : null });
  }
  return out.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
}

function loadPlaces() {
  if (!LIVE) return;
  EV_PLACES_STATE = 'loading';
  var gen = ++EV_PLACES_GEN;
  api('GET', '/places').then(function (r) {
    if (gen !== EV_PLACES_GEN) return;
    var list = r.status === 200 ? fromPlaces(r.data) : null;
    if (list) { EV_PLACES = list; EV_PLACES_STATE = 'ok'; }
    else { EV_PLACES = null; EV_PLACES_STATE = failText(r); }
    if (current === 'eventNew' || current === 'masterApply') render();
  });
}

function loadEvents() {
  EVENTS_STATE = 'loading';
  var gen = ++EVENTS_GEN;
  api('GET', '/events').then(function (r) {
    if (gen !== EVENTS_GEN) return;
    var list = r.status === 200 ? fromEvents(r.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; }
    else EVENTS_STATE = failText(r);
    /* Перерисовать надо и «Записи»: экран строится из этого же ответа, и
       без него человек, вошедший сюда сразу после записи, остаётся в
       «Загружаем афишу…» навсегда — данные пришли, а экран их не показал.
       Поймал случай `bookings-gost`: запустить загрузку и перерисовать по
       ответу — ДВА разных перечня экранов, и добавить надо в оба. */
    if (current === 'home' || current === 'events' || current === 'event'
        || current === 'bookings') render();
  });
}

/* ── запись на событие ─────────────────────────────────
   Деньги при записи не берутся вовсе: платное оплачивается в кассе, взнос
   донейшна — дело добровольное. Поэтому «записаться» — это только место.

   Успех признаётся ПЕРЕЧИТАННОЙ афишей, а не кодом 201: код говорит, что
   сервер принял, а человеку нужно то, что сервер теперь отдаёт.

   Отмена идёт по номеру своей записи (my_booking_id). Сервер отдаёт его не
   всегда: пока ручка не выложена, номера нет — и тогда отмена не
   предлагается вовсе, вместо кнопки стоит прямая строка. Кнопка,
   отказывающая по нажатию, хуже своего отсутствия. */
var BOOK_BUSY = false;     // запись или отмена в пути: второе нажатие молчит
var BOOK_ERR = '';         // чем кончилась неудачная попытка — текст на карточке
var BOOK_ASK = false;      // у отмены спрашивают: место уходит другому и может не вернуться

function cap(t) { return t ? t[0].toUpperCase() + t.slice(1) : ''; }

/* «Записываться пока не нужно» — слово владельца 30.10.2026 (Cafe13KPG#670, шаг 4): афиша открыта всем, а
   записывается только человек с ЖИВЫМ членством. По свойству, а не по роли: членство есть и у мастера,
   и у куратора, и у бармена. ⚠ Запрет КЛИЕНТСКИЙ — сервер его не держит (боевая ревизия по /health 30.10.2026: `POST /bookings`
   охраняет только допуск, `caller`, членства не спрашивает). «Пока» — срок: когда запись понадобится шире,
   снимается и этот запрет, и решается, проверять ли членство на сервере (#670). */
// ⚠ `!LIVE ||` сегодня не исполняется НИ ОДНИМ путём (замер frontend-11 по 706edea): canBookEvent/bookBlock
// зовутся только из живых веток, демо-карточка рисует «Записаться» своей веткой. Оставлено как страховка:
// у демо-человека членств нет, и демо-путь, начавший звать canBookEvent, без неё закрыл бы запись витрине
function mayBookEvents() { return !LIVE || ((DATA.member && DATA.member.memberships) || []).length > 0; }
// На своё мероприятие мастер не записывается (слово владельца, Cafe13KPG#700): признак тот же, что у
// управления, и через этот предикат он доходит и до главной кнопки (`mainFor`), и до самой записи (`bookEvent`)
function canBookEvent(e) { return !!e && !e.booked && !e.done && !isMyEvent(e) && (e.unl || e.seats > 0) && !BOOK_BUSY && mayBookEvents() && !shortOf(e); }
/* Вход списывается со счёта ПРИ ЗАПИСИ, и только у платного (api#113, бой 36073d3: `price if kind == "paid" else 0`):
   у донейшна цена — ориентир, она не списывается. Нехватка — до нажатия, остатком из /me; остатка не знаем — не
   держим, решит сервер своим отказом (Cafe13KPG#748, кадры E62/E62b/E62v) */
/* Подпись к возврату — ГРАНИЦЕЙ из поля сервера, а не сроком: правило («за сколько до начала») меняет сервер
   (72 ч → 48 ч, Cafe13KPG#750), и число в клиенте лгало бы в окне между выкладками в любом порядке. Дата — по
   часам клуба. Какая половина фразы — по числам сервера (вернётся всё или меньше), не по часам телефона */
// условие сделки — на карточке, ДО записи (Cafe13KPG#750, довод designer-55): та же граница из поля. Прошла ли она —
// единственное место, где мгновение сервера сравнивается с часами телефона; ошибка часов сдвигает фразу, не деньги
function refundAt(e) {
  var p = bkk(e.refundUntil), x = p.ymd.split('-');
  return Number(x[2]) + ' ' + (MONTHS[Number(x[1]) - 1] || '') + ', ' + p.hm;
}
function refundTerms(e) {
  if (!e.refundUntil) return '';
  /* Со старта деньги не возвращаются — слово владельца 02.11.2026 («В момент старта мероприятия — деньги не
     возвращаются», Cafe13KPG#768); на идущее записаться можно (`canBookEvent`: !done), и «вернётся половина» здесь
     было бы ложью. Сравнение с часами телефона — то же, что у границы ниже */
  if (Date.now() >= e.at) return '<br>Если снимете запись, деньги не вернутся: мероприятие уже идёт.';
  // слова кадров E62/E62г (Cafe13KPG#751): сперва что человек может сделать, дата — вторым
  return Date.now() <= e.refundUntil.getTime()
    ? '<br>Снять запись с полным возвратом можно до ' + refundAt(e) + ' — позже вернётся половина.'
    : '<br>Если снимете запись, вернётся половина: полный возврат действовал до ' + refundAt(e) + '.';
}
function refundWhen(e) {
  if (!e.refundUntil) return '';
  var at = refundAt(e);
  // кадры E66/E66b (Cafe13KPG#751): до границы подписи нет — полный возврат не удивляет
  return e.refund >= e.paid ? '' : '<span class="small" style="text-align:center">Полный возврат действовал до ' + esc(at) + '.</span>';
}
// на прошедшем со своей записью: уже поблагодарил — сумма; можно (признак сервера) — кнопка; иначе ничего
function thanksBlock(e) {
  if (e.donated > 0) return '<div class="card quiet"><div class="col"><b>Вы поблагодарили: ' + esc(e.master) + '</b>' +
    '<span class="small num">' + money(e.donated) + ' ฿</span></div></div>';
  return e.mayThank ? '<button type="button" class="btn" data-action="thank:' + esc(e.id) + '">Поблагодарить мастера</button>' : '';
}
function bookWord(e) { return entryOf(e) > 0 ? 'Записаться за ' + money(entryOf(e)) + ' ฿' : 'Записаться'; }
function entryOf(e) { return e.kind === 'paid' ? e.price : 0; }
function shortOf(e) {
  var bal = DATA.member && DATA.member.balance;
  return LIVE && typeof bal === 'number' && entryOf(e) > bal ? entryOf(e) - bal : 0;
}
// сколько записалось: без ограничения — `taken` сервера (из «мест» не вычесть), иначе — мест минус осталось
function takenOf(e) { return e.unl ? e.taken : e.of - e.seats; }
// ВРЕМЕННЫЕ слова «без ограничения» — до кадра дизайнера (Cafe13KPG#639)
var NO_LIMIT = 'без ограничения';

function bookEvent(id) {
  var e = eventById(id);
  if (!LIVE || !canBookEvent(e)) return;
  BOOK_BUSY = true; BOOK_ERR = ''; render();
  api('POST', '/bookings', { event_id: e.eid }).then(function (r) {
    afterBooking(r, id, true);
  });
}

/* Отмена своей записи. Номер берётся из афиши: своего номера у клиента нет
   и выдумывать его нельзя — нет номера, нет и кнопки. */
function cancelBooking(id) {
  var e = eventById(id);
  if (!LIVE || BOOK_BUSY || !e || !e.booked || typeof e.bookingId !== 'number') return;
  BOOK_BUSY = true; BOOK_ERR = ''; BOOK_ASK = false; render();
  api('POST', '/bookings/' + e.bookingId + '/cancel').then(function (r) {
    afterBooking(r, id, false);
  });
}

/* Чем бы ни ответил сервер, афиша перечитывается: и отказ «мест нет», и
   обрыв связи могли случиться потому, что экран устарел. Состоялось ли
   задуманное, решает перечитанное, а не код ответа. */
function afterBooking(r, id, want) {
  var detail = detailOf(r);
  refreshMe();     // вход списан или возвращён — шапка и нехватка на других карточках по новому остатку
  api('GET', '/events').then(function (g) {
    var list = g.status === 200 ? fromEvents(g.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
    BOOK_BUSY = false;
    var e = eventById(id);
    if (!e) BOOK_ERR = 'Этого события в афише больше нет.';
    else if (!!e.booked === want) {
      haptic('ok');            // успех виден самой карточкой: она нарисована по перечитанной афише
    } else if (r.status === 200 || r.status === 201) {
      BOOK_ERR = 'Сервер принял, а в афише этого нет. Откройте экран заново и проверьте, прежде чем нажимать снова.';
      haptic('warn');
    } else if (r.status === 0) {
      BOOK_ERR = 'Сервер не ответил, и в афише ничего не изменилось. Можно попробовать ещё раз.';
      haptic('warn');
    } else {
      BOOK_ERR = detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
      haptic('warn');
    }
    if (current === 'event' || current === 'events' || current === 'home') render();
  });
}

var EV_BUSY = false;       // отмена мероприятия в пути: второе нажатие молчит
var EV_ERR = '';           // чем кончилась неудачная отмена — текст на карточке
var EV_ASK = false;        // спрашиваем: отмена мероприятия снимает записи людей
/* Правка недели (шаг 4, E55k/E55l, `POST /events/{id}/edit` — на бою с 455dcdd). Ручка берёт `seats`
   (0–500, 0 — без ограничения), `about` (до 2000), а с шага 7 (бой 36073d3) — `price` и `ask_donation`; ответ — строка без имён ведущего, поэтому после 200
   афиша перечитывается. Условие показа — то же, что у сервера: своё и не кончившееся (он отказывает «уже
   прошло» по КОНЦУ, идущее править можно). Права решает сервер; его отказ печатается словами. */
/* Шаг 7 (E67, Cafe13KPG#686/Г): правятся и деньги — цена входа и галочка доната. Цена в поле — ВХОД (`entryOf`), а не
   `price`: у донейшна `price` — ориентир, и сервер правку считает от входа (у донейшна 0). Цена не меняется, пока
   есть записи (409 сервера) — поле тогда погашено, причина его словами. Заведение мероприятия заморожено (#510):
   экран только правит */
var EDT = { id: null, seats: '', about: '', price: '', ask: null, busy: false, err: '' };
function canEditEvent(e) { return isMyEvent(e) && !e.done && mayOwnEvents(); }
function hmMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; }
function editGrab() {
  if (!document.getElementById('edt-seats')) return;
  EDT.seats = document.getElementById('edt-seats').value; EDT.about = document.getElementById('edt-about').value;
  var pr = document.getElementById('edt-price'); if (pr && !pr.disabled) EDT.price = pr.value;
}
// набранное — в EDT на каждый ввод: перерисовка (поздний ответ афиши) иначе вернула бы прежнее
document.addEventListener('input', function (ev) { if (ev.target && /^edt-/.test(ev.target.id)) editGrab(); });
function editSave() {
  var e = eventById(EDT.id);
  // вне Telegram экран виден (#691), а «Сохранить» в сеть не ходит: витрину открыли посмотреть
  if (!LIVE || EDT.busy || !canEditEvent(e)) return;
  editGrab();
  var seats = Number(EDT.seats), price = String(EDT.price).trim();
  EDT.err = !(String(EDT.seats).trim() !== '' && Math.floor(seats) === seats && seats >= 0 && seats <= 500) ? 'Число мест — целое, от 0 до 500; 0 — без ограничения.'
    : EDT.about.length > 2000 ? 'Описание длиннее 2000 знаков: сократите.'
    : !/^\d+(\.\d{1,2})?$/.test(price) ? 'Цена входа — число в батах, 0 — вход без оплаты.' : '';
  if (EDT.err) { render(); return; }
  EDT.busy = true; render();
  var id = EDT.id;
  var body = { seats: seats, about: EDT.about, price: Number(price) };
  if (typeof EDT.ask === 'boolean') body.ask_donation = EDT.ask;
  api('POST', '/events/' + e.eid + '/edit', body).then(function (r) {
    api('GET', '/events').then(function (g) {
      var list = g.status === 200 ? fromEvents(g.data) : null;
      if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
      EDT.busy = false;
      if (r.status === 200 && r.data && r.data.id === e.eid) {
        haptic('ok'); FLASH = { text: 'Сохранено', note: 'Только на эту неделю: ' + e.day.split(',')[0].toLowerCase() + '.' };
        if (current === 'eventEdit') go('event', id);
        return;
      }
      haptic('warn');
      EDT.err = r.status >= 400 && r.status < 500 ? denyText(r) : failText(r);
      if (current === 'eventEdit') render();
    });
  });
}

/* «Своё» мероприятие — это organizer_id из афиши против своего tg id из /me.
   Сервер отдаёт в organizer_id именно Telegram id (миграция 004: bigint NOT
   NULL REFERENCES members(tg_user_id)), поэтому сравнение идёт с uid, а не с
   номером члена: ошибиться здесь — показать чужое управление. */
function isMyEvent(e) {
  return !!e && LIVE && typeof e.by === 'number' && !!DATA.member &&
         typeof DATA.member.uid === 'number' && e.by === DATA.member.uid;
}

function canCancelEvent(e) { return isMyEvent(e) && !e.done && !EV_BUSY; }

/* Отмена своего мероприятия. У кончившегося её нет: оно уже состоялось, и
   отмена стёрла бы записи тех, кто на нём был. */
function cancelEvent(id) {
  var e = eventById(id);
  if (!LIVE || !canCancelEvent(e)) return;
  EV_BUSY = true; EV_ERR = ''; EV_ASK = false; render();
  api('POST', '/events/' + e.eid + '/cancel').then(function (r) { afterEventCancel(r, id); });
}

/* Успех — не код ответа, а перечитанная афиша: отменённое мероприятие в ней
   не публикуется, поэтому исчезновение и есть подтверждение. */
function afterEventCancel(r, id) {
  var detail = detailOf(r);
  api('GET', '/events').then(function (g) {
    var list = g.status === 200 ? fromEvents(g.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
    EV_BUSY = false;
    var e = eventById(id);
    if (!e) { EV_ERR = ''; haptic('ok'); }
    else if (r.status === 200) {
      EV_ERR = 'Сервер принял, а в афише мероприятие осталось. Откройте экран заново и проверьте, прежде чем нажимать снова.';
      haptic('warn');
    } else if (r.status === 0) {
      EV_ERR = 'Сервер не ответил, и в афише ничего не изменилось. Можно попробовать ещё раз.';
      haptic('warn');
    } else {
      EV_ERR = detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
      haptic('warn');
    }
    if (current === 'event' || current === 'events' || current === 'home') render();
  });
}

/* Управление видно ТОЛЬКО ведущему и только на его мероприятии. Раздачи прав
   здесь нет и быть не должно: ведущий распоряжается своим событием, а не
   людьми клуба. Список записавшихся, наоборот, ЕСТЬ: ручка на бою живая, и
   `signedBlock` рисует его с графой оплаты (Cafe13KPG#271, шаг 2). Прежняя
   редакция этой шапки говорила «списка тоже нет» и пережила тот PR, которым
   он появился. */
/* ── кто записался ─────────────────────────────────────
   Ручка отдаёт имя, время записи, сумму и признак оплаты; телефонов и
   Telegram id в ответе нет вовсе — и не надо.

   Графа «оплатил» здесь ЕСТЬ — у платного мероприятия. Прежняя редакция
   этого пояснения её ЗАПРЕЩАЛА: «поле `paid` в ответе есть, но сегодня
   оно всегда false — касса пишет в книгу номер мероприятия, а связи с
   записью не ставит (карточка #103); колонка по такому полю говорила бы
   „не платил“ про тех, кто заплатил». Сам запрет был верен — истёк его
   ДОВОД: приём денег за запись (`POST /till`, `kind=event`) теперь ставит
   `bookings.ledger_id` (api `app/routers/till.py:284`), а признак оплаты — это
   ровно `(b.ledger_id IS NOT NULL)` (`app/queries.py:227`, одно место на
   три ручки). Коммит, заведший связь, — `48a56bc` «Оплата записи
   доходит до записи (#103)», и он ПРЕДОК боевого `fa2cebc`: замер
   мой, 24.10.2026. Поэтому графа говорит о деньгах в книге, а не о
   нуле в `amount_due`.

   Сумма подписана «записан на N ฿», а не «к оплате»: `amount_due` ничем не
   гасится, и после оплаты он остался бы прежним.

   Снятые записи не смешиваются с живыми в одном счёте: они показаны
   отдельно и помечены. Иначе ведущий считал бы пришедших по длине списка.
   ⚠ **На бою эта ветка НЕДОСТИЖИМА, и оставлена она НАРОЧНО.**
   Сервер снятых не отдаёт вовсе: `event_bookings` отбирает
   `WHERE b.event_id = %s AND b.state <> 'cancelled'` — api `app/routers/events.py:318`,
   замер по БЛОБУ боевого sha `fa2cebc`, снятого с `/health` 24.10.2026 в 18:44 UTC = 25.10 в 01:44 по острову
   (контроль признака: заведомо иное `WHERE b.state = 'cancelled'` в том же
   файле не находится). Ветка — защита на случай изменения сервера: если
   снятые однажды поедут, они не попадут в счёт живых молча. Удалить её
   как «мёртвый код» — именно тот ремонт, от которого эта фраза и стоит.

   Что сторожит что, разведено: случай `spisok-snyataya` судит саму ветку
   (подкладывая снятую запись нарочно — то есть гипотетическое будущее
   сервера, а не живой путь), а страж `snyatye-dovod` сторожит ДОВОД:
   базовая фикстура моделирует боевой ответ, и появись в ней снятые —
   утверждение «на бою их нет» перестало бы моделироваться, и его надо
   перечитать, а не держать вечно (правило команды Cafe13KPG#296).

   Прежняя редакция этой строки говорила то же, но со ссылкой на ревизию
   `880b4b6` и без номера строки; довод не снят, а ПЕРЕМЕРЕН на том sha,
   который лежит на бою СЕГОДНЯ: ссылка на старую ревизию верна по сути
   и непроверяема читателем, у которого на руках другой бой. */
var SIGNED = { eid: null, state: '', taken: 0, rows: null };
var SIGNED_GEN = 0;

function fromSigned(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.event_id !== 'number' || typeof d.taken !== 'number') return null;
  if (!Array.isArray(d.bookings)) return null;
  var now = new Date(), out = [];
  for (var i = 0; i < d.bookings.length; i++) {
    var b = d.bookings[i];
    if (!b || typeof b.id !== 'number') return null;
    if (typeof b.first_name !== 'string' || typeof b.last_name !== 'string') return null;
    if (typeof b.booked_at !== 'string' || typeof b.state !== 'string' || !b.state) return null;
    var when = new Date(b.booked_at);
    if (isNaN(when.getTime())) return null;
    var sum = num(b.amount_due);
    if (!(sum >= 0)) return null;           // сумма строкой, как все деньги в этом API
    // Оплата читается СТРОГО булевой. На правдивость её проверять нельзя:
    // `null` и отсутствие поля прочитались бы как «не оплачено», то есть
    // поломка сервера стала бы на экране обвинением человеку. Поле на бою
    // есть (замер: коммит, который его завёл, — предок боевого sha).
    if (typeof b.paid !== 'boolean') return null;
    var p = bkk(when);
    out.push({
      id: b.id,
      name: [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Без имени',
      when: dayLabel(p, now) + ', ' + p.hm,
      sum: sum,
      paid: b.paid,
      // Живая запись — ВСЁ, кроме снятой: у записи три состояния
      // (`CHECK (state IN ('booked','cancelled','attended'))`, замер по
      // боевой ревизии 880b4b6), и `attended` — это пришедший гость.
      // Сравнение с 'booked' отправляло бы его в «снятые».
      live: b.state !== 'cancelled'
    });
  }
  return { taken: d.taken, rows: out };
}

function signedFail(r) {
  var detail = detailOf(r);
  // Привратник доступа и отказ прав приходят одним кодом; у них разные
  // следующие шаги, поэтому и строки разные.
  if (r.status === 403 && /доступа нет/.test(detail))
    return 'Вас ещё не впустили в клуб — список поэтому и не открылся.';
  if (r.status === 404) return 'Сервер не знает такого мероприятия.';
  return detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
}

function loadSigned(e) {
  // Список спрашивается ТОЛЬКО на своём мероприятии: на чужое запроса нет
  // вовсе, а не отказ по ответу. Один предикат с показом «Управления».
  if (!LIVE || !isMyEvent(e)) return;
  var gen = ++SIGNED_GEN;
  SIGNED = { eid: e.eid, state: 'loading', taken: 0, rows: null };
  api('GET', '/events/' + e.eid + '/bookings').then(function (r) {
    if (gen !== SIGNED_GEN) return;        // ответ под прежнее событие молчит
    var got = r.status === 200 ? fromSigned(r.data) : null;
    if (got) SIGNED = { eid: e.eid, state: 'ok', taken: got.taken, rows: got.rows };
    else SIGNED = { eid: e.eid, state: signedFail(r), taken: 0, rows: null };
    if (current === 'event') render();
  });
}

/* Метка оплаты — только у ПЛАТНОГО мероприятия: у бесплатного платить нечего,
   а у донейшна взнос добровольный, и «не оплачено» там было бы упрёком за то,
   что человек имел право не делать. Это решение, а не недосмотр. */
function signedRow(p, kind, off) {
  return '<div class="card"><div class="row">' +
      '<div class="col"><b>' + esc(p.name) + '</b>' +
        '<span class="small">' + esc(p.when) +
          (p.sum > 0 && kind === 'paid' ? ' · записан на ' + money(p.sum) + ' ฿' : '') +
        '</span></div>' +
      (off ? '<span class="pill">снята</span>'
           : kind === 'paid' ? '<span class="pill' + (p.paid ? ' on' : '') + '">' +
             (p.paid ? 'оплачено' : 'не оплачено') + '</span>' : '') +
    '</div></div>';
}

function signedBlock(e) {
  /* ⚠ Сверка номера здесь — ВТОРАЯ линия, и она недостижима, пока жива
     первая: `go()` синхронно зовёт `loadSigned`, тот сбрасывает состояние в
     `{eid: текущее, loading}`, и только потом идёт `render()`. Мутация,
     снимающая эту сверку при живом гарде поколения, остаётся зелёной
     (замер 22.10.2026), поэтому доказательством она не прикрыта.

     Оставлена намеренно — но не как «защита вдвойне»: если снять гард
     `gen !== SIGNED_GEN` в `loadSigned`, эта строка НЕ спасёт экран, а
     оставит его в «Читаем, кто записался…» навсегда. Снимать первую,
     полагаясь на вторую, нельзя. */
  if (SIGNED.eid !== e.eid || SIGNED.state === 'loading')
    return '<div class="card quiet"><span class="small">Читаем, кто записался…</span></div>';
  if (SIGNED.state !== 'ok')
    return '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Список не открылся</b>' +
      '<span class="small">' + esc(SIGNED.state) + '</span></div></div>';

  var live = [], off = [];
  SIGNED.rows.forEach(function (p) { (p.live ? live : off).push(p); });
  // Число в афише и число в списке считает сервер в двух местах. Разойдутся —
  // сказать прямо: ведущий и гость иначе будут спорить о числе, а не о записи.
  var spor = SIGNED.taken !== takenOf(e)
    ? '<div class="card quiet"><span class="small">Афиша говорит «' + takenOf(e) +
      '», список — «' + SIGNED.taken + '». Откройте экран заново: одно из чисел устарело.</span></div>'
    : '';
  if (!live.length && !off.length)
    return spor + '<div class="card quiet"><span class="small">Пока никто не записался.</span></div>';
  // Сводка по оплате — у платного и только по ЖИВЫМ записям: снятая запись
  // денег не ждёт. Считается из тех же строк, что нарисованы ниже, поэтому
  // разойтись с ними не может.
  var paidN = 0;
  live.forEach(function (p) { if (p.paid) paidN += 1; });
  var itog = e.kind === 'paid' && live.length
    ? '<div class="card quiet"><span class="small">Оплатили ' + paidN + ' из ' + live.length +
      // Кто может снять — правдой, а не «можно снять»: слово владельца 02.11.2026 «Снять запись может только сам
      // участник» (Cafe13KPG#768; сервер забирает право у работника — #761, клиент едет первым). Прежняя фраза
      // называла работника клуба и с выкладкой #761 стала бы ложью; в ноль не снята — организатор остался бы с
      // вопросом «а кто тогда снимает» (решение координатора). Кнопки снятия здесь нет ни у кого.
      (paidN < live.length ? '. Снять запись может только сам участник.' : '.') +
      '</span></div>'
    : '';
  return spor + itog + live.map(function (p) { return signedRow(p, e.kind, false); }).join('') +
    (off.length ? '<span class="label">Снятые записи</span>' +
      off.map(function (p) { return signedRow(p, e.kind, true); }).join('') : '');
}

function manageBlock(e) {
  if (!isMyEvent(e)) return '';
  var err = EV_ERR ? '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Не получилось</b><span class="small">' + esc(EV_ERR) + '</span>' +
    '</div></div>' : '';
  var head = '<div class="group"><span class="label">Управление</span>' +
    '<div class="rows"><div><span class="small">Записалось</span>' +
      '<b class="num">' + takenOf(e) + (e.unl ? ' · мест ' + NO_LIMIT : ' из ' + e.of) + '</b></div></div>' +
    signedBlock(e) + err;
  if (EV_BUSY) return head + '<div class="card quiet"><span class="small">Отправляем…</span></div></div>';
  // Один предикат на оба пути: рисование и отправку. Пока их было два,
  // мутация, снявшая запрет у кончившегося, оставалась зелёной — кнопка
  // не рисовалась по своему, отдельному условию.
  if (!canCancelEvent(e)) return head + '<div class="card quiet"><span class="small">' +
    (e.done ? 'Мероприятие завершилось: отменить его уже нельзя.'
            : 'Отменить это мероприятие сейчас нельзя.') + '</span></div></div>';
  /* Текст принят командой и лежит адресом — кадр `E37d-event-cancel-ask.dc.html`
     на `Cafe13KPG` dev `8f4dc54`; здесь он стоит ДОСЛОВНО, и менять его тут
     нельзя. Прежняя редакция обещала «вернуть их сможет только каждый сам» —
     вернуть не может НИКТО: отмена уводит событие в `state='cancelled'`, афиша
     отбирает только `published`, запись на такое сервер отклоняет 409, а
     дороги назад нет вовсе — на бою `fa2cebc` по всему `app/` ровно один
     `UPDATE events`, и он только в `'cancelled'` (Cafe13KPG#359).

     Фраза про список — порядок действий ДО нажатия, а не сожаление после:
     после отмены список записавшихся недостижим обоими путями (карточка
     исчезает из афиши, а ручка отдаёт 200 с ПУСТЫМ списком — отмена снимает
     все записи, а запрос отбирает неснятые).

     Про деньги здесь НЕТ НИ СЛОВА нарочно: отмена к книге не прикасается
     (вхождений `ledger` в `cancel_event` — 0), то есть оплаченная запись
     становится снятой при живой строке дохода. Что об этом сказать человеку —
     решение владельца, Cafe13KPG#367; денежная строка приедет отдельной
     правкой, а не домыслом здесь.

     Плашка ГЛИНЯНАЯ (`card warm`), а кнопки стоят ПОД ней, а не внутри: так
     в кадре — на прежней отрисовке вопрос читался четвёртой строкой списка.
     Фраза держится одним литералом: разорванная переносом, она даёт ноль на
     построчном признаке, хотя на экране цела. */
  if (EV_ASK) return head + '<div class="card warm"><div class="col">' +
      '<b style="font-size:13px">Отменить мероприятие?</b>' +
      '<span class="small">Записи всех, кто записался, будут сняты, и мероприятие уйдёт из афиши. Вернуть его нельзя — только завести новое. Перепишите, кто записался: после отмены список не вернуть, а приложение гостей не предупредит.</span></div></div>' +
      '<button type="button" class="btn ghost" data-action="event-cancel-yes:' + esc(e.id) + '">Да, отменить</button>' +
      '<button type="button" class="btn quiet" data-action="event-cancel-no">Оставить</button></div>';
  // правка — НАД отменой: необратимое последним; слово называет, что изменится (designer-55, E55k)
  return head + '<button type="button" class="btn ghost" data-action="event-edit:' + esc(e.id) + '">Изменить описание и места</button>' +
    '<button type="button" class="btn ghost" data-action="event-cancel">Отменить мероприятие</button></div>';
}

/* ── завести мероприятие ───────────────────────────────
   Право даёт либо роль клуба, либо КУПЛЕННЫЙ уровень членства: уровень
   покупается и кончается сроком, роль выдаётся главой. Роли «мастер» в базе
   нет вовсе, поэтому признак здесь только из /me — и при приведении ролей к
   модели меняется список значений, а не логика экрана.

   Правок у мероприятия не существует: исправить можно лишь снятием, а
   снятие гости видят как отмену. Поэтому форма говорит это ДО отправки —
   после неё сказать уже некому.

   Успех — перечитанная афиша И совпадение с отправленным: код 201 обещает
   только, что сервер принял. */
var EVN_BUSY = false;      // создание в пути: второе нажатие молчит
var EVN_ERR = '';          // чем кончилась неудачная попытка — текст на форме

function mayCreateEvent() {
  return LIVE && (grant('admin') || grant('director') || grant('staff') ||
                  grant('head') || grant('curator') ||
                  DATA.role === 'organizer' || DATA.role === 'partner');
}
/* «Свои мероприятия» — шире, чем «завести»: мастер правит и смотрит свои, но не заводит (слово владельца
   30.10.2026: «в нём он может модерировать своё мероприятие… вкладка ивенты, но только с его собственным»,
   Cafe13KPG#670 шаг 4). Создание — по-прежнему `mayCreateEvent()`: мастер кнопки «Создать» не получает. */
function mayOwnEvents() { return mayCreateEvent() || (LIVE && msIsMaster()); }

/* Форма → тело запроса. Пределы здесь те же, что в подписях полей: подпись
   говорит до ввода, проверка — после, и расходиться им нельзя. */
function eventForm() {
  var title = val('f-title');
  if (!title) return { err: 'Без названия мероприятие в афишу не ставится.' };
  if (title.length > 200) return { err: 'Название длиннее 200 знаков: сократите.' };
  var day = val('f-date'), time = val('f-time');
  if (!day || !time) return { err: 'Укажите день и время начала.' };
  // Пояс клуба стоит в строке явно: иначе сутки считает телефон ведущего, а
  // он может быть где угодно. Перехода на лето в Таиланде нет, смещение
  // постоянное — поэтому литерал, а не вычисление по часам телефона.
  var starts = day + 'T' + time + ':00+07:00';
  var at = Date.parse(starts);
  if (isNaN(at)) return { err: 'День и время не разобраны: проверьте поля.' };
  if (at <= Date.now()) return { err: 'Это время уже прошло по часам клуба.' };
  var dur = parseInt(val('f-dur'), 10);
  if (!(dur >= 1 && dur <= 1440)) return { err: 'Длительность — от 1 до 1440 минут.' };
  var seats = parseInt(val('f-seats'), 10);
  if (!(seats >= 1 && seats <= 500)) return { err: 'Мест — от 1 до 500.' };
  if (!KIND[FORM.kind]) return { err: 'Выберите вид участия.' };
  var price = 0, raw = val('f-price');
  if (FORM.kind === 'paid') {
    price = parseInt(raw, 10);
    if (!(price > 0)) return { err: 'У платного мероприятия цена больше нуля.' };
  } else if (FORM.kind === 'donation' && raw) {
    price = parseInt(raw, 10);
    if (!(price >= 0)) return { err: 'Ориентир — число или пустое поле.' };
  }
  var body = { title: title, starts_at: starts, duration_min: dur, seats: seats,
               kind: FORM.kind, price: price,
               about: val('f-about'), filmed: !!FORM.filmed };
  // «Без места» уходит ОТСУТСТВИЕМ ключа, а не null: обе формы сервер
  // принимает, но отсутствие — та, что стоит в снимке создания без места.
  if (typeof FORM.place === 'number') body.place_id = FORM.place;
  return { body: body };
}

/* Имена полей запроса по-русски: 422 называет поле в `loc`, и это
   единственное, что в его теле годится человеку — `msg` приходит
   по-английски. Поля, которого здесь нет, мы не отправляем вовсе: тогда
   честнее общий текст с кодом, чем выдуманное имя. */
var FIELD_RU = { title: 'Название', starts_at: 'Начало', duration_min: 'Длительность',
                 seats: 'Мест', price: 'Цена', about: 'Описание', kind: 'Вид участия',
                 filmed: 'Съёмка', place_id: 'Место' };

/* Места демонстрации: те же три, что отдаёт сервер клуба, и у двух из них
   вместимость неизвестна — демонстрация обязана показывать ту же форму
   данных, иначе снимок описи обещает не то, что увидит человек. */
var DEMO_PLACES = [{ id: 3, name: 'Двор', capacity: null },
                   { id: 1, name: 'Зал', capacity: 30 },
                   { id: 2, name: 'Сад', capacity: null }];

/* Выбор места в форме. Состояний у этого куска ПЯТЬ, и каждое говорит
   своё: не спрашивали, спрашиваем, отказ сервера, пустой список активных
   мест, список пришёл. Пустой список — не «выбирайте»: сервер назвал ноль
   мест, и честнее это сказать, чем показать одну кнопку «без места» и
   промолчать о причине.

   Вместимость показываем только там, где она есть: у двора и сада в снимке
   `capacity: null` — «числа никто не называл». Ноль нарисовать нельзя, он
   значит ровно обратное. */
function placeSeg() {
  // Вне Telegram приложение показывает демонстрацию, и места в ней зашиты,
  // как числа афиши: спрашивать сервер там некого, а «места не пришли» на
  // демонстрационном экране — отказ без отказа.
  var list = LIVE ? EV_PLACES : DEMO_PLACES;
  if (LIVE && (EV_PLACES_STATE === 'loading' || EV_PLACES_STATE === ''))
    return '<div class="note">' + svg(ICON.info) + '<span>Спрашиваем места у сервера…</span></div>';
  if (!list)
    return '<div class="note">' + svg(ICON.info) + '<span>Места не пришли: ' +
      esc(EV_PLACES_STATE) + ' Мероприятие заводится и без места — в афише у него просто не будет строки «где».</span></div>';
  if (!list.length)
    return '<div class="note">' + svg(ICON.info) +
      '<span>Сервер не назвал ни одного открытого места. Заводите без места: место потом не поменять — ручки правки события нет.</span></div>';
  var sel = null;
  for (var i = 0; i < list.length; i++) if (list[i].id === FORM.place) sel = list[i];
  var hint = FORM.place === null
    ? 'Без места — тоже ответ: в афише не будет строки «где».'
    : sel ? (sel.capacity
        ? 'Вместимость: ' + sel.capacity + '. Если место в это время занято, сервер скажет — с названием и временем того, что уже стоит.'
        : 'Сколько человек влезает, нам не называли — числа здесь нет. Если место занято, сервер скажет чем.')
      : 'Это место больше не предлагается — выберите другое или заводите без места.';
  return '<div class="seg wrap"><button type="button" data-place="" aria-pressed="' +
      (FORM.place === null) + '">Без места</button>' +
    list.map(function (p) {
      return '<button type="button" data-place="' + esc(String(p.id)) +
        '" aria-pressed="' + (FORM.place === p.id) + '">' + esc(p.name) + '</button>';
    }).join('') + '</div>' +
    '<span class="small" style="margin-top:6px;display:block">' + esc(hint) + '</span>';
}

function badFields(d) {
  if (!Array.isArray(d)) return [];
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var loc = d[i] && d[i].loc;
    var ru = Array.isArray(loc) && loc.length ? FIELD_RU[loc[loc.length - 1]] : null;
    if (ru && out.indexOf(ru) === -1) out.push(ru);
  }
  return out;
}

/* Эхо под полями дня и времени.

   Виджет даты рисуется в формате УСТРОЙСТВА, а не страницы: при русской
   странице система по-английски печатает «mm/dd/yyyy» и «07:00 PM» (замер
   на кадре 390px). Первые двенадцать дней месяца такой порядок двусмыслен —
   «07/08» это и 8 июля, и 7 августа, — и подписью это не лечится: подпись
   спорила бы с виджетом. Поэтому строка повторяет ПОНЯТОЕ нами нашими
   словами: месяц словом, год числом, время в поясе клуба.

   И это не украшение: «Время клуба, остров» — обещание, а эхо — посчитанный
   факт. Потеряется пояс — разойдётся эхо, и видно это будет на кадре. */
function cur(id, dflt) {
  var x = FORM.v[id];
  return x === undefined || x === '' ? (dflt || '') : x;
}

/* Возвращает {text, ok}: ok — «это посчитанная дата», а не просьба. Хвост
   «· время клуба» дорисовывается отдельным узлом и прячется у просьбы:
   «Выберите день · время клуба» было бы бессмыслицей.

   ⚠ Пустые поля называются ПООТДЕЛЬНОСТИ. Общая фраза «День и время не
   заполнены» верна только когда пусты оба, а форма открывается с пустым
   днём и временем 19:00 — и плашка спорила с полем в сантиметре от себя
   (нашёл designer-55 на кадре каталога, 22.10.2026). Мои случаи этого не
   видели: оба заполняли ОБА поля. */
function echoText(day, time) {
  if (!day) return { text: 'Выберите день.', ok: false };
  if (!time) return { text: 'Выберите время.', ok: false };
  var d = new Date(day + 'T' + time + ':00+07:00');
  if (isNaN(d.getTime())) return { text: 'День и время не разобраны.', ok: false };
  // День собирается из ymd ПОЯСА КЛУБА и своего списка месяцев, а не из
  // toLocaleDateString: тот добавляет «г.» и вообще волен менять вид.
  var p = bkk(d), x = p.ymd.split('-'), mon = MONTHS[Number(x[1]) - 1];
  if (!mon) return { text: 'День и время не разобраны.', ok: false };
  return { text: p.dow + ', ' + Number(x[2]) + ' ' + mon + ' ' + x[0] + ', ' + p.hm, ok: true };
}

function echoLine(eh) {
  return '<div class="small" style="margin-top:-2px">' +
      '<span id="f-echo" style="color:var(--ink)">' + esc(eh.text) + '</span>' +
      '<span id="f-echo-tail"' + (eh.ok ? '' : ' hidden') + '> · время клуба</span>' +
    '</div>';
}

function createEvent() {
  // Один предикат на рисование и на отправку: у человека без права кнопки
  // нет, но и путь закрыт здесь же — иначе мутация, снявшая кнопку,
  // осталась бы зелёной.
  if (!mayCreateEvent() || EVN_BUSY) return;
  // Снять введённое ДО первой перерисовки: экран рисует поля из FORM.v, и без
  // этого отказ сервера стирал всё набранное — человек платил вводом за то, в
  // чём не виноват. Нашлось мутацией: второе нажатие не заводило второго
  // мероприятия не из-за запрета, а потому что поля к тому времени были пусты,
  // то есть запрет был зелёным по чужой причине.
  grabForm(EVENT_FIELDS);
  var f = eventForm();
  if (f.err) { EVN_ERR = f.err; haptic('warn'); render(); return; }
  EVN_BUSY = true; EVN_ERR = ''; render();
  api('POST', '/events', f.body).then(function (r) { afterEventCreate(r, f.body); });
}

/* Мало того, что событие нашлось под выданным номером: оно должно совпасть
   с отправленным. Чужое событие под своим номером — правдоподобный успех. */
function sameAsSent(e, sent) {
  return e.title === sent.title && e.of === sent.seats && e.kind === sent.kind &&
         e.at === Date.parse(sent.starts_at) &&
         (sent.kind === 'paid' ? e.price === sent.price : true);
}

function afterEventCreate(r, sent) {
  var detail = detailOf(r);
  var id = r.data && typeof r.data.id === 'number' ? String(r.data.id) : null;
  api('GET', '/events').then(function (g) {
    var list = g.status === 200 ? fromEvents(g.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
    EVN_BUSY = false;
    var e = id ? eventById(id) : null;
    if (e && sameAsSent(e, sent)) {
      EVN_ERR = '';
      FORM = { kind: 'paid', filmed: false, place: null, v: {} };
      dropDraft();
      haptic('ok');
      // Человека уводим на карточку его события только если он всё ещё на
      // форме: уйти с неё — тоже решение, и отменять его нечем.
      if (current === 'eventNew') { go('event', id); return; }
      render(); return;
    }
    if (r.status === 201 || r.status === 200) {
      EVN_ERR = e ? 'Сервер принял, а под этим номером в афише другое мероприятие. Откройте афишу и проверьте, прежде чем заводить снова.'
                  : 'Сервер принял, а в афише мероприятия нет. Откройте афишу и проверьте, прежде чем заводить снова.';
      haptic('warn');
    } else if (r.status === 0) {
      EVN_ERR = 'Сервер не ответил, и в афише ничего не появилось. Можно попробовать ещё раз.';
      haptic('warn');
    } else if (r.status === 422) {
      // Пределы на экране и модель сервера разошлись: клиент эти же поля
      // проверяет до отправки, поэтому 422 — не ошибка человека, а
      // расхождение, и его надо назвать, а не спрятать за кодом.
      var ff = badFields(r.data && r.data.detail);
      EVN_ERR = ff.length
        ? 'Сервер не принял ' + (ff.length > 1 ? 'поля' : 'поле') + ': ' + ff.join(', ') +
          '. На экране они проверяются иначе — сообщите в клуб, это расхождение.'
        : failText(r);
      haptic('warn');
    } else if (r.status === 403 && /доступа нет/.test(detail)) {
      // 403 приходит ДВУХ происхождений, и по коду они неразличимы: отказ
      // прав («мероприятия заводят организатор, партнёр и работники клуба»)
      // и привратник доступа («доступа нет»). Во втором случае слово сервера
      // отвечает не на тот вопрос: человек прочитал бы «Доступа нет» посреди
      // формы и стал бы править поля. Сравнение по ВХОЖДЕНИЮ: текст
      // привратника может обрасти уточнением, и точное равенство тогда молча
      // перестанет узнавать свой случай.
      EVN_ERR = 'Вас ещё не впустили в клуб — дело не в форме. Напишите тому, кто вас приглашал.';
      haptic('warn');
    } else {
      EVN_ERR = detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
      haptic('warn');
    }
    render();
  });
}

/* ── рецепт позиции бара (#176) ─────────────────────
   Только ЧТЕНИЕ: конструктор карточки и общие функции бара — чужая зона,
   поэтому здесь своё состояние и свои помощники.

   Построчной пары «тайская строка / английская под ней» не бывает: сервер
   хранит один живой рецепт НА ЯЗЫК, целым текстом, и записи независимы —
   число шагов и порядок у них разные. Поэтому два блока целиком.

   ⚠ Ручка на отсутствующий язык отдаёт ЛЮБОЙ живой рецепт, и единственная
   защита от молчаливой подмены — поля ответа: `lang` — язык ПОКАЗАННОГО,
   `asked_lang` — запрошенный, `exact` — совпали ли они (снимки
   `recipe-th.json` и `recipe-en-fallback.json`). При `exact: false` блок
   обязан сказать, на каком языке текст на самом деле, иначе экран соврёт
   ровно в том, ради чего заведён.

   Языка работника клиент не знает: в `/me` поля `lang` нет (замер по
   снимку `me-member.json`). Поэтому первый блок спрашивается БЕЗ `lang` —
   язык выбирает сервер по `members.lang`, — а какой это оказался язык,
   видно из `asked_lang` в ответе. Подписи двуязычные: кто читает экран,
   клиент не знает. */
var RECIPE = { pid: null, gen: 0, me: null, en: null };
// Два падежа: в плашке язык НАЗЫВАЮТ («тайский»), в подписи о подмене о нём
// говорят («показан на русском»). Один список на оба места давал «ภาษาไทย ·
// тайском» — видно только на отрисованном экране, в коде это незаметно.
var LANG_RU = { ru: 'русский', en: 'английский', th: 'тайский' };
var LANG_NA = { ru: 'русском', en: 'английском', th: 'тайском' };
var LANG_TH = { ru: 'ภาษารัสเซีย', en: 'ภาษาอังกฤษ', th: 'ภาษาไทย' };

function langRu(code) { return LANG_RU[code] || ('«' + code + '»'); }
function langNa(code) { return LANG_NA[code] || ('«' + code + '»'); }
function langTh(code) { return LANG_TH[code] || ('«' + code + '»'); }

function mayRecipe() {
  // Ровно то, что пропускает сервер (`_needs_bar_side`, замер по боевой
  // ревизии 880b4b6): админ, а бар и куратор — на СВОЁМ направлении.
  // `BAR` до загрузки направлений null, и `grant(role, undefined)` сняло бы
  // проверку направления совсем — поэтому обе скобки обязательны.
  return LIVE && (grant('admin') || (!!BAR && (grant('bar', BAR.id) || grant('curator', BAR.id))));
}

function fromRecipe(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.lang !== 'string' || !d.lang) return null;
  if (typeof d.body !== 'string' || !d.body) return null;
  if (typeof d.exact !== 'boolean') return null;
  return { lang: d.lang, asked: typeof d.asked_lang === 'string' ? d.asked_lang : '',
           exact: d.exact, body: d.body };
}

function recipeFail(r) {
  var detail = detailOf(r);
  // «Рецепта нет» и «не открылось» — разные вещи: первое чинится письмом
  // рецепта, второе — правами или сетью.
  //
  // ⚠ Текст сервера на 404 («напишите его, иначе её нельзя вернуть в меню»)
  // дословно НЕ печатается: это поручение, а этот экран действия не несёт —
  // записи рецепта здесь нет вовсе (решение координатора, 22.10.2026).
  // Поручение без кнопки читается как упрёк.
  if (r.status === 404) return { none: true,
    text: 'Рецепта пока нет. Его пишет бар или куратор направления.' };
  return { none: false, text: detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r) };
}

function loadRecipe(pid) {
  if (!LIVE || !mayRecipe()) return;
  var gen = ++RECIPE.gen;
  RECIPE = { pid: pid, gen: gen, me: { state: 'loading' }, en: { state: 'loading' } };
  ask('', 'me');
  ask('en', 'en');
  function ask(lang, slot) {
    api('GET', '/bar/products/' + pid + '/recipe' + (lang ? '?lang=' + lang : '')).then(function (r) {
      if (gen !== RECIPE.gen) return;         // ответ под прежнюю позицию молчит
      var got = r.status === 200 ? fromRecipe(r.data) : null;
      RECIPE[slot] = got ? { state: 'ok', r: got } : { state: 'fail', fail: recipeFail(r) };
      if (current === 'barRecipe') render();
    });
  }
}

/* Подпись о подменённом языке — на обоих языках сразу и с НАЗВАНИЕМ того,
   что показано: «нет на английском, показан русский». Неизвестный код языка
   печатается как есть, выдумывать названия нельзя. */
function recipeSwap(asked, lang) {
  return 'Рецепта на ' + langNa(asked) + ' нет — показан на ' + langNa(lang) + '. · ' +
         'ไม่มี' + langTh(asked) + ' · แสดง' + langTh(lang);
}

function recipeBlock(head, slot, want) {
  var s = RECIPE[slot], top = '<div class="group"><span class="label">' + esc(head) + '</span>';
  if (!s || s.state === 'loading') return top + '<div class="card quiet"><span class="small">Читаем рецепт…</span></div></div>';
  if (s.state === 'fail') return top + '<div class="card' + (s.fail.none ? ' quiet' : ' strong') + '"><div class="col">' +
      '<b style="font-size:13px">' + (s.fail.none ? 'Рецепта нет' : 'Рецепт не открылся') + '</b>' +
      '<span class="small">' + esc(s.fail.text) + '</span></div></div></div>';
  var r = s.r;
  var asked = want || r.asked;
  // Три случая, а не два. `exact: false` бывает и БЕЗ подмены: у работника
  // может быть не задан язык (Telegram не прислал language_code), тогда
  // сервер отвечает `asked_lang: ""` — сравнивать было не с чем. Писать
  // «Рецепта на «» нет» значит сообщать о подмене, которой не было.
  var note = r.exact
    ? '<span class="pill on">' + esc(langTh(r.lang)) + ' · ' + esc(langRu(r.lang)) + '</span>'
    : !asked
      ? '<span class="pill">' + esc('Ваш язык не задан — показан на ' + langNa(r.lang) + '. · ' +
          'ไม่ได้ตั้งภาษา · แสดง' + langTh(r.lang)) + '</span>'
      : '<span class="pill warm">' + esc(recipeSwap(asked, r.lang)) + '</span>';
  return top + '<div class="card"><div class="col">' + note +
      '<p style="font-size:14px;white-space:pre-line">' + esc(r.body) + '</p>' +
    '</div></div></div>';
}

function eventList() { return LIVE ? EVENTS : DATA.events; }
function eventById(id) {
  var list = eventList() || [];
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
  return LIVE ? histById(id) : null;
}
/* Архив (`GET /events/history`, шаг 7, часть А): члену клуба сервер отдаёт прошедшее, где он был записан, мастеру — ещё и
   своё. «Записи» берут из него ТОЛЬКО записанное мной: мастерское своё без записи здесь не моё. Не пришло — сказано и
   «Повторить»: пустой раздел и неотвеченный сервер выглядят по-разному. Порядок — новые сверху */
var HIST = null, HIST_STATE = '', HIST_GEN = 0;
var TH = { id: null, amount: '', busy: false, err: '', sent: 0 };
document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'th-amount') TH.amount = ev.target.value; });
function sendThanks() {
  var e = eventById(TH.id);
  if (!LIVE || TH.busy || !e || !e.mayThank || e.donated > 0) return;
  var a = String(TH.amount).trim();
  TH.err = /^\d+(\.\d{1,2})?$/.test(a) && Number(a) > 0 ? '' : 'Сумма — число в батах, больше нуля.';
  if (TH.err) { render(); return; }
  TH.busy = true; render();
  api('POST', '/events/' + e.eid + '/donate', { amount: Number(a) }).then(function (r) {
    TH.busy = false;
    refreshMe(); loadHistory();     // деньги ушли или нет — остаток и признак «можно» спрашиваются заново
    if (r.status === 201 && r.data && r.data.event_id === e.eid) { TH.sent = num(r.data.amount) || Number(a); haptic('ok'); }
    else { TH.err = r.status >= 400 && r.status < 500 ? denyText(r) : failText(r); haptic('warn'); }
    if (current === 'thanks') render();
  });
}
// прошедшие записи: свои по `booked_by_me`; строка ведёт в карточку, где живёт «Поблагодарить мастера»
function pastBookings() {
  if (!HIST) return HIST_STATE === 'loading' || HIST_STATE === ''
    ? '<div class="card quiet"><span class="small">Загружаем прошедшие…</span></div>'
    : '<div class="card quiet"><div class="row"><span class="small">Прошедшие не загрузились: ' + esc(HIST_STATE) + '</span>' +
      '<button type="button" class="btn quiet" data-action="retry-hist">Повторить</button></div></div>';
  var past = HIST.filter(function (e) { return e.booked; });
  return past.length ? past.map(function (e) { return eventRow(e, { date: true }); }).join('')
    : '<div class="card quiet"><span class="small">Прошедших записей нет.</span></div>';
}
function histById(id) {
  for (var i = 0; HIST && i < HIST.length; i++) if (String(HIST[i].id) === String(id)) return HIST[i];
  return null;
}
function loadHistory() {
  if (!LIVE) return;
  HIST_STATE = 'loading';
  var gen = ++HIST_GEN;
  api('GET', '/events/history').then(function (r) {
    if (gen !== HIST_GEN) return;
    var list = r.status === 200 ? fromEvents(r.data) : null;
    if (list) { HIST = list.reverse(); HIST_STATE = 'ok'; } else HIST_STATE = failText(r);
    if ({ bookings: 1, event: 1, thanks: 1 }[current]) render();
  });
}
function segOf(e) { return e.seg || partOf(e.time); }

/* «Афиша не открылась» — это состояние, а не пустая афиша: отказ сервера и
   ноль событий одинаково выглядят только у вруна. */
function eventsWait() {
  return EVENTS_STATE === 'loading' || EVENTS_STATE === ''
    ? '<div class="card quiet"><span class="small">Загружаем афишу…</span></div>'
    : '<div class="card strong"><h2>Афиша не открылась</h2><p>' + esc(EVENTS_STATE) + '</p>' +
      '<button type="button" class="btn" data-action="retry-events">Попробовать снова</button></div>';
}

/* Вход в афишу с главной. Занимает место, где до сих пор стояло «ещё не
   подключено». */
function afishaHome() {
  if (!EVENTS) return eventsWait();
  if (!EVENTS.length) return '<div class="group"><span class="label">Афиша</span>' +
    '<div class="card quiet"><span class="small">В афише пока ничего нет.</span></div></div>';
  return '<div class="group"><div class="row"><span class="label">Афиша</span>' +
    '<button type="button" class="btn quiet" data-go="events">Вся афиша</button></div>' +
    EVENTS.slice(0, 2).map(function (e) { return eventRow(e, { date: true }); }).join('') + '</div>';
}

/* Карточка события на живых данных. Запись и отмена здесь ЕСТЬ: обе живут в
   `bookBlock`, который эта функция и зовёт последним. Прежняя редакция шапки
   говорила «кнопки записи здесь пока нет» и пережила тот PR, которым запись
   появилась, — следующий читатель завёл бы второй путь к записи. */
function eventLive(e) {
  return '<div class="col"><h1>' + esc(e.title) + '</h1>' +
      '<span class="small">' + esc(e.day) + ' · ' + esc(e.time) + '–' + esc(e.until) +
        (e.done ? ' · завершилось' : e.part === 'идёт' ? ' · уже идёт' : '') + '</span></div>' +
    (e.booked ? '<div class="card accent"><div class="row">' +
        '<div class="col"><b>Вы записаны</b>' +
          '<span class="small">Место держится за вами.</span></div>' +
        '<span class="pill on">записаны</span>' +
      '</div></div>' : '') +
    '<div class="rows">' +
      '<div><span class="small">Ведёт</span><b>' + esc(e.master) + '</b></div>' +
      // Места нет — строки нет вовсе. «Место не указано» обещало бы, что
      // его когда-нибудь укажут: ручки правки события на сервере нет.
      (e.place ? '<div><span class="small">Где</span><b>' + esc(e.place) + '</b></div>' : '') +
      '<div><span class="small">Мест осталось</span><b class="num">' +
        (e.unl ? NO_LIMIT : e.seats === 0 ? 'мест нет' : e.seats + ' из ' + e.of) + '</b></div>' +
      '<div><span class="small">Участие</span><b class="num">' + KIND[e.kind].label(e) + '</b></div>' +
    '</div>' +
    (e.about ? '<p style="font-size:14px">' + esc(e.about) + '</p>' : '') +
    '<div class="note">' + svg(ICON.cam) + '<span>' + (e.filmed
      ? 'На этом событии ведётся съёмка. Согласие даётся отдельно и его можно не давать — запись останется в силе.'
      : 'Съёмки на этом событии нет.') + '</span></div>' +
    manageBlock(e) +
    bookBlock(e);
}

/* Что можно сделать с событием. Кончившееся и заполненное не предлагают
   записи вовсе: отказ сервера, полученный после нажатия, человек читает как
   поломку приложения. */
function bookBlock(e) {
  if (BOOK_BUSY) return '<div class="card quiet"><span class="small">Отправляем…</span></div>';
  var err = BOOK_ERR ? '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Не получилось</b><span class="small">' + esc(BOOK_ERR) + '</span>' +
    '</div></div>' : '';
  if (e.booked) {
    // У кончившегося события отменять нечего: сервер такую отмену примет и
    // сотрёт сам факт записи, а подтверждение обещало бы вернуть место в
    // афишу — обещание заведомо ложное. Идущее событие отменить можно:
    // место ещё можно отдать тому, кто придёт.
    if (e.done) return err + thanksBlock(e);
    // Номера своей записи сервер может не отдать — тогда отменять нечем, и
    // это сказано прямо, а не спрятано за кнопкой, которая откажет.
    if (typeof e.bookingId !== 'number')
      return err + '<div class="card quiet"><span class="small">Отменить запись из приложения пока нельзя.</span></div>';
    // уплачено со счёта — спрос по кадрам E66/E66b: сколько заплатил и сколько вернётся, оба числа сервера
    if (BOOK_ASK && e.paid > 0 && typeof e.refund === 'number')
      return err + '<div class="card strong"><div class="col"><b>Снять запись?</b></div>' +
          '<div class="rows"><div><span class="small">Вы заплатили</span><b class="num">' + money(e.paid) + ' ฿</b></div>' +
          '<div><span class="small">Вернётся</span><b class="num">' + money(e.refund) + ' ฿</b></div></div>' +
          '<button type="button" class="btn ghost" data-action="book-cancel-yes:' + esc(e.id) + '">Снять запись</button>' +
          refundWhen(e) +
          '<button type="button" class="btn quiet" data-action="book-cancel-no">Оставить запись</button>' +
        '</div>';
    if (BOOK_ASK)
      return err + '<div class="card strong"><div class="col">' +
          '<b>Отменить запись?</b>' +
          '<span class="small">Место вернётся в афишу и может достаться другому.</span></div>' +
          '<button type="button" class="btn ghost" data-action="book-cancel-yes:' + esc(e.id) + '">Да, отменить</button>' +
          '<button type="button" class="btn quiet" data-action="book-cancel-no">Оставить запись</button>' +
        '</div>';
    return err + '<button type="button" class="btn ghost" data-action="book-cancel">Отменить запись</button>';
  }
  // Своё — вместо кнопки строка с причиной: пустое место под «Управлением» читается как поломка (#700).
  // Раньше членства: причина здесь не в нём. Уже записанному (запись старше этой правки) отмена выше остаётся
  if (isMyEvent(e))
    return err + (e.done ? '' : '<div class="card quiet"><span class="small">Это ваше мероприятие.</span></div>');
  // без живого членства (E37k): кнопка ОСТАЁТСЯ, погашена, причина вплотную под ней; подсказка оплаты
  // снята — она про то, что будет после нажатия, а нажатия не будет (designer-55)
  if (!mayBookEvents() && !e.done)
    return err + '<div style="display:flex;flex-direction:column;gap:9px">' +
      '<button type="button" class="btn" disabled aria-disabled="true">Записаться</button>' +
      '<span class="small" style="text-align:center">Пока записываются только члены клуба.</span></div>';
  if (shortOf(e) && !e.done && (e.unl || e.seats > 0))
    return err + '<div style="display:flex;flex-direction:column;gap:9px">' +
      '<button type="button" class="btn" disabled aria-disabled="true">Записаться за ' + money(entryOf(e)) + ' ฿</button>' +
      '<span class="small" style="text-align:center">Не хватает ' + money(shortOf(e)) + ' ฿.</span></div>';
  if (!canBookEvent(e)) {
    // Объяснение — там, где человек мог ждать кнопку: мест нет. Кончившемуся
    // событию объяснять нечего, у него всё сказано карточкой.
    return err + (!e.done && e.seats === 0
      ? '<div class="card quiet"><span class="small">Мест нет. Если кто-то снимет запись, место вернётся в афишу.</span></div>'
      : '');
  }
  /* Подпись — про деньги, потому что их теперь трогает сама запись (шаг 7, Cafe13KPG#748). Прежняя подпись («оплата
     на месте», «при записи не трогается счёт») стала ложью с выкладкой api#113 (бой 36073d3). Вторая фраза кадра E62
     («Поблагодарить мастера можно после мероприятия») НЕ дана: кнопки благодарности в клиенте ещё нет (E65 — следующей
     заявкой), и обещание пути, которого нет, было бы той же поломкой. */
  var hint = entryOf(e) > 0 ? 'Спишется со счёта сразу.' + refundTerms(e) : 'Со счёта ничего не спишется.';
  return err +
    '<div class="group">' +
      '<button type="button" class="btn dup-main" data-action="book:' + esc(e.id) + '">' + bookWord(e) + '</button>' +
      (hint ? '<span class="small" style="text-align:center">' + hint + '</span>' : '') +
    '</div>';
}

