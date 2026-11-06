
// сторож ПРОТОТИПА (решение координатора 29.10.2026): падает при загрузке, и дым это видит ошибкой страницы
Object.keys(PROTO).forEach(function (k) {
  if (!/^master/.test(k)) throw new Error('PROTO: «' + k + '» не экран шага 3 — флаг только для мастеров');
  if (WIRED[k]) throw new Error('PROTO: «' + k + '» стоит и в WIRED — снятие прототипа сделано наполовину');
  if (typeof SCREENS[k] !== 'function') throw new Error('PROTO: экрана «' + k + '» нет');
  if (/\bapi\s*\(/.test(String(SCREENS[k]))) throw new Error('PROTO: в экране «' + k + '» вызов api( — прототип не отправляет');
});

function notWired(what) {
  return '<div class="card quiet"><div class="col">' +
    '<b style="font-size:13px">' + esc(what) + ' — ещё не подключено</b>' +
    '<span class="small">Этот раздел пока работает только в демонстрации. Здесь будут настоящие данные клуба, как только раздел подключат к серверу.</span>' +
  '</div></div>';
}

// E68: «Продлить» — прямо под ролями, а не в конце экрана: прочтя роль, мастер видит, где платить.
// Только у своей СОГЛАСОВАННОЙ заявки: у мастера по старому виду членства слота нет
function masterRenewDoor() {
  return LIVE && msIsMaster() && msOwnSlot() ? '<button type="button" class="btn ghost" data-go="masterRenew">Продлить</button>' : '';
}

function myRoles() {
  var door = masterRenewDoor();
  if (!DATA.roles || !DATA.roles.length) return door;
  return '<div class="group"><span class="label">Ваши роли</span><div class="card quiet"><div class="row" style="flex-wrap:wrap;gap:6px;justify-content:flex-start">' +
    // head и god_mentor у владельца — одно и то же звание: одна плашка
    DATA.roles.map(function (r) { return ROLE_NAME[r] || r; })
      .filter(function (n, i, all) { return all.indexOf(n) === i; })
      .map(function (n) { return '<span class="pill">' + esc(n) + '</span>'; }).join('') +
  '</div></div>' + door + '</div>';
}

/* У каждой роли свои действия. Пересечений нет: организатор не заводит
   услуги, партнёр не создаёт мероприятия. */
function rolePanel() {
  // у организатора и партнёра есть собственная вкладка — на главной клуба
  // их рабочие кнопки не дублируются
  return '';
}

/* FLASH может быть строкой или парой {text, note}: не всякое сообщение
   что-то сохраняет, и писать «сохранено» под результатом сканирования —
   значит утверждать неверное. */
function flash() {
  var t = FLASH; FLASH_SHOWN = true;
  var text = typeof t === 'string' ? t : t.text;
  var note = typeof t === 'string'
    ? 'Это демонстрация: сохранено только в этой вкладке, при перезагрузке исчезнет.'
    : t.note;
  return '<div class="card quiet"><div class="col">' +
    '<b style="font-size:13px">' + esc(text) + '</b>' +
    (note ? '<span class="small">' + esc(note) + '</span>' : '') +
  '</div></div>';
}

function eventRow(e, o) {
  var k = KIND[e.kind];
  /* Подстрочник строки зависит от ЭКРАНА, а разметка одна. На афише день
     даёт заголовок группы, поэтому в строке стоит «ведёт <имя> · <статус>»;
     на экране «Записи» групп по дням нет вовсе, и день переезжает в строку —
     так в кадре E40 (`Cafe13KPG` ствол `dev` `051bfa3`).

     ⚠ Слова берутся у `dayLabel` — того же помощника, что у афиши, — ради
     единства: в двух местах один день писался бы по-разному. Форма полная —
     «6 декабря, воскресенье» (`MONTHS` родительным падежом плюс `weekday: 'long'`),
     и смерженный кадр показывает её так же (`Cafe13KPG` ствол `dev` `051bfa3`).

     Прежняя редакция этого комментария говорила, что образец кадра короче
     живого вывода и расхождение решается в Cafe13KPG#380. Ссылка была НЕВЕРНАЯ:
     форма дня — это Cafe13KPG#382, и она СНЯТА кадром (кадр исправлен под
     живой вывод, карточка смержена). А #380 — про ДРУГОЕ и ОТКРЫТА: широкая
     пилюля поджимает НАЗВАНИЕ в строке афиши (пилюля 81 → `.grow` 171 → название
     в две строки, замер дизайнера). Этой правкой название короче не становится,
     то есть #380 остаётся; укороченный подстрочник может снять её вторую
     половину, но это меряется ПОСЛЕ выкладки, а не объявляется сейчас. И второй вызов помощника стоит не в кассе,
     как стояло здесь с чужих слов, а в `fromSigned` — списке записавшихся на экране
     мероприятия (перемерено мной: `dayLabel` зовут два места — строка афиши
     и `fromSigned`).
     Второй разметки для этого не завожу: два места расходятся молча.

     ⚠ Второй аргумент читается ТОЛЬКО как объект, потому что три места
     зовут строку через `.map(eventRow)`, а `map` передаёт вторым параметром
     ИНДЕКС. Сам по себе индекс здесь безвреден: `o && o.day` при `o = 1`
     даёт `undefined`, у числа нет такого поля, — проверено node: 0→0,
     1→undefined, 2→undefined, {day:true}→true. Прежняя редакция этого
     комментария утверждала, что без проверки строки афиши сменили бы
     подстрочник; это была НЕПРАВДА, нашёл её arhitector-47 на ревью #87.

     Проверка стоит не против индекса, а против УПРОЩЕНИЯ этой строки:
     перепишет кто-нибудь условие на `!!o` или `o !== undefined` — и индекс
     станет истинным (у `!!o` с единицы, у второго даже при нуле), то есть
     день появится там, где его не просили. Опасность в ФОРМЕ проверки, а
     не в `map`. */
  var bez = o && typeof o === 'object' && o.bezStatusa;
  // без заголовков дня (афиша на «Клубе») вторая строка колонки — ДАТА, а не часть дня: иначе неделя слота
  // неотличима от следующей (#675)
  var withDate = o && typeof o === 'object' && o.date && e.date;
  return '<button type="button" class="listitem' + (e.kind === 'paid' ? ' accent' : '') + '" data-event="' + esc(e.id) + '">' +
    '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(withDate ? e.date : e.part) + '</span></span>' +
    '<span class="grow"><b>' + esc(e.title) + '</b>' +
    '<span class="small">' + (bez
      ? 'ведёт ' + esc(e.master)
      : 'ведёт ' + esc(e.master) + ' · ' + (e.done ? 'завершилось'
        : e.booked ? 'вы записаны'
        : e.unl ? 'мест ' + NO_LIMIT : e.seats === 0 ? 'мест нет' : e.seats === e.of ? e.of + ' мест' : 'осталось ' + e.seats)) + '</span></span>' +
    '<span class="pill ' + k.pill + '">' + k.label(e) + '</span>' +
  '</button>';
}

/* Плитка вместо фотографии напитка. Пока снимок не прошёл путь съёмки,
   честнее показать цветное поле с буквой и словом «без фото», чем картинку
   из каталога: гость закажет не то, что увидел. */
function tile(d, big) {
  var cls = 'tile' + (big ? ' big' : '');
  if (d.shot === 'ready') {
    return '<span class="' + cls + '" style="background:' + TONE[d.tone] + '" aria-hidden="true">' +
      esc(d.title.slice(0, 1).toUpperCase()) + '</span>';
  }
  // В живом меню photo — это файл в Telegram: показать его браузеру нечем, и
  // писать «без фото», когда фото есть, было бы неправдой.
  return '<span class="' + cls + ' empty">' +
    (d.photo ? 'фото не показано' : d.shot === 'none' ? 'без фото' : 'фото готовится') + '</span>';
}

function stepper(d) {
  var n = CART[d.id] || 0;
  return '<span class="stepper">' +
    '<button type="button" data-action="cart-less:' + esc(d.id) + '" aria-label="Убрать одну">−</button>' +
    '<b class="num">' + n + '</b>' +
    '<button type="button" data-action="cart-add:' + esc(d.id) + '" aria-label="Добавить одну">+</button>' +
  '</span>';
}

/* Главная кнопка позиции. Не хватает на счёте — ведёт к пополнению и говорит,
   сколько не хватает; заказ в пути — ждёт, второго не создаёт. */
function buyBtn(d, wide) {
  var cls = 'btn' + (wide ? '' : ' mini');
  if (BUSY) return '<button type="button" class="' + cls + '" disabled>Отправляем…</button>';
  if (!BAR || !BAR.open) return '<button type="button" class="' + cls + '" disabled>Бар закрыт</button>';
  if (DATA.member.balance < d.price) {
    return '<button type="button" class="' + cls + ' quiet" data-go="topup">Не хватает ' +
      money(d.price - DATA.member.balance) + ' ฿</button>';
  }
  return '<button type="button" class="' + cls + '" data-action="buy:' + esc(d.id) + '">Купить' +
    (wide ? ' за ' + money(d.price) + ' ฿' : '') + '</button>';
}

function barRow(d) {
  var n = CART[d.id] || 0;
  if (LIVE) {
    return '<div class="card"><div class="row top">' +
      '<button type="button" class="plain drinkbtn" data-drink="' + esc(d.id) + '">' + tile(d) +
        '<span class="col"><b>' + esc(d.title) + '</b>' +
          '<span class="small">' + esc(d.about) + '</span>' +
          '<b class="num">' + money(d.price) + ' ฿</b></span>' +
      '</button>' +
      '<span class="col" style="gap:6px;align-items:flex-end">' + buyBtn(d) +
        (n ? stepper(d) : '<button type="button" class="btn ghost mini" data-action="cart-add:' + esc(d.id) + '">в заказ</button>') +
      '</span>' +
    '</div></div>';
  }
  return '<div class="card"><div class="row top">' +
    '<button type="button" class="plain drinkbtn" data-drink="' + esc(d.id) + '">' + tile(d) +
      '<span class="col"><b>' + esc(d.title) + '</b>' +
        '<span class="small">' + esc(d.about) + '</span>' +
        '<b class="num">' + d.price + ' ฿</b></span>' +
    '</button>' +
    (n ? stepper(d)
       : '<button type="button" class="btn quiet" data-action="cart-add:' + esc(d.id) + '">В заказ</button>') +
  '</div></div>';
}

/* Карточка очереди в живом режиме. Фото гостя — чтобы знать, кому несёшь;
   без фото так и сказано. Суммы нет, если сервер её не прислал. */
var NEXT = { new: ['making', 'Принять'], making: ['ready', 'Готово'], ready: ['served', 'Выдан'] };
function liveCard(o) {
  var st = OSTATE[o.state], nx = NEXT[o.state], busy = STATE_BUSY[o.oid];
  var face = o.photo
    ? '<img class="avatar" src="' + esc(o.photo) + '" alt="" referrerpolicy="no-referrer">'
    : '<span class="avatar" title="фото нет">' + esc(o.who.slice(0, 1).toUpperCase()) + '</span>';
  var canCancel = o.state === 'new' || o.state === 'making';
  return '<div class="card' + (o.state === 'new' ? ' strong accent' : '') + '">' +
    '<div class="row top">' + face +
      '<div class="col grow"><b>' + esc(o.id) + ' · ' + esc(o.where) + '</b>' +
        '<span class="small">' + esc(o.at) + ' · ' + esc(o.who) + (o.photo ? '' : ' · фото нет') + ' · ' + esc(o.pay) + '</span></div>' +
      '<span class="pill' + st.pill + '">' + st.label + '</span>' +
    '</div>' +
    '<div class="col">' + o.items.map(function (i) {
      return '<span class="small"><b class="num">' + i[1] + ' ×</b> ' + esc(i[0]) + '</span>';
    }).join('') + '</div>' +
    '<div class="row">' + (o.sum === null ? '<span></span>' : '<b class="num">' + money(o.sum) + ' ฿</b>') +
      (busy ? '<button type="button" class="btn quiet" disabled>…</button>'
       : CANCEL_ASK === o.oid
         ? '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="q-keep">Не отменять</button>' +
           '<button type="button" class="btn quiet" data-action="q-cancel:' + o.oid + '">Точно отменить</button></span>'
       : nx ? '<span class="row" style="gap:6px">' +
           (canCancel ? '<button type="button" class="btn quiet" data-action="q-ask:' + o.oid + '">Отменить</button>' : '') +
           '<button type="button" class="btn mini" data-action="q-' + nx[0] + ':' + o.oid + '">' + nx[1] + '</button></span>'
       : '<span class="small">' + (o.state === 'cancelled' ? 'отменён' : 'выдан') + '</span>') +
    '</div></div>';
}

function queueCard(o) {
  var st = OSTATE[o.state];
  return '<div class="card' + (o.state === 'new' ? ' strong accent' : '') + '">' +
    '<div class="row top">' +
      '<div class="col"><b>' + esc(o.id) + ' · ' + esc(o.where) + '</b>' +
        '<span class="small">' + esc(o.at) + ' · ' + esc(o.who) + ' · ' + esc(o.pay) + '</span></div>' +
      '<span class="pill' + st.pill + '">' + st.label + '</span>' +
    '</div>' +
    '<div class="col">' + o.items.map(function (i) {
      return '<span class="small"><b class="num">' + i[1] + ' ×</b> ' + esc(i[0]) + '</span>';
    }).join('') + '</div>' +
    // работнику бара цены нет ни одним полем — решение владельца
    '<div class="row"><span></span>' +
      (st.next
        ? '<button type="button" class="btn quiet" data-action="order-' + st.next + ':' + esc(o.id) + '">' +
            st.action + '</button>'
        : '<span class="small">закрыт, строка ушла в книгу</span>') +
    '</div></div>';
}

/* ── навигация ───────────────────────────────────────── */

var TABS = {
  guest:     [['guest', 'Услуги', ICON.plus], ['events', 'Ивенты', ICON.cal]],
  member:    [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus], ['events', 'Ивенты', ICON.cal]],
  organizer: [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus],
              ['organizer', 'События', ICON.star], ['events', 'Ивенты', ICON.cal]],
  partner:   [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus],
              ['partner', 'Моё дело', ICON.case], ['events', 'Ивенты', ICON.cal]],
  staff:     [['staff', 'Касса', ICON.till], ['home', 'Клуб', ICON.home]],
  bar:       [['barQueue', 'Заказы', ICON.bell], ['barShot', 'Съёмка', ICON.cam],
              ['barDay', 'День', ICON.chart], ['barExpense', 'Затраты', ICON.coin]],
  curator:   [['curator', 'Бар', ICON.cup], ['barDay', 'День', ICON.chart],
              ['barExpense', 'Затраты', ICON.coin], ['home', 'Клуб', ICON.home]]
};
// порядок вкладок у человека с несколькими членствами: оба своих экрана — между «Услугами» и «Записями»
/* Вкладка «Ивенты» ведёт на афишу, а не на «мои записи»: слово владельца 30.10.2026 «на вкладке ивенты
   должен быть календарь на неделю» (Cafe13KPG#670). «Мои записи» (`bookings`) разморожены шагом 7 и встали
   СТРОКОЙ на «Клубе», а не вкладкой — решение координатора 02.11.2026 (Cafe13KPG#755); вкладки не трогаем. */
var TAB_ORDER = ['home', 'guest', 'organizer', 'partner', 'events'];
var TITLES = {
  pass: 'Пропуск', membership: 'Членство', memberRequests: 'Заявки на членство', events: 'Афиша',
  event: 'Мероприятие', bookings: 'Мои ивенты', thanks: 'Благодарность', staff: 'Касса', demo: 'Демо-режим',
  consentFull: 'Подробно', joinAbout: 'О клубе',
  bar: 'Бар', drink: 'Напиток', barCart: 'Ваш заказ', barOrder: 'Заказ', barRecipe: 'Рецепт',
  barQueue: 'Заказы на баре', topup: 'Пополнить счёт', barShot: 'Съёмка напитков', barDay: 'Отчёт за день',
  barExpense: 'Затраты направления', curator: 'Направление «Бар»', barMoney: 'Доход и расход',
  organizer: 'Мои мероприятия', eventNew: 'Новое мероприятие',
  eventManage: 'Мероприятие', eventEdit: 'Мероприятие', partner: 'Моё направление', serviceNew: 'Новая услуга',
  people: 'Члены клуба', manage: 'Управление', joinQueue: 'Заявки на доступ', topupQueue: 'Заявки на пополнение', topupReq: 'Заявка на пополнение', barCards: 'Карточки меню', barCard: 'Карточка',
  tillPerson: 'Карточка человека', tillMembership: 'Членство', tillTopup: 'На счёт',
  tillDay: 'День кассы',
  masters: 'Слоты и мастера', masterReqs: 'Заявки в мастера', masterReq: 'Заявка в мастера',
  masterEvents: 'Ивенты', masterEvent: 'Ивент', masterList: 'Мастера', masterApply: 'Заявка в мастера', masterRenew: 'Продление',
  payouts: 'Распределить', payout: 'Распределить'
};

/* Вкладки идут от уровня членства, а рабочая — от роли с сервера: бармен
   без членства — гость по уровню, и без этого до очереди он не доходил
   (вход был только кнопкой на главной, а главной у гостя нет). */
function tabList() {
  var t = (TABS[DATA.role] || []).slice();
  // В живом режиме — объединением по ВСЕМ живым членствам, а не по DATA.role:
  // сервер отдаёт роль одной строкой, и при равных сроках двух членств она
  // произвольна — вкладка «Моё дело» то была, то нет (Cafe13KPG#410, шаг 1a).
  // DATA.role здесь не правится: его читают homeOf, isMember, касса.
  if (LIVE) {
    var on = {};
    ((DATA.member && DATA.member.memberships) || []).map(function (m) { return m.level; })
      .concat(DATA.role).forEach(function (l) {
        (TABS[l] || []).forEach(function (x) { on[x[0]] = x; });
      });
    t = TAB_ORDER.filter(function (k) { return on[k]; }).map(function (k) { return on[k]; });
  }
  if (LIVE && DATA.barSide && !t.some(function (x) { return x[0] === 'barQueue'; }))
    t.unshift(['barQueue', 'Заказы', ICON.bell]);
  // касса — от права, а не от уровня: кассир с членством — член клуба по уровню
  if (canTopup() && !t.some(function (x) { return x[0] === 'staff'; }))
    t.unshift(['staff', 'Касса', ICON.till]);
  // «Управление» — от права главы клуба, а не от уровня; последней, как в кадре E46 (Cafe13KPG#413)
  // v100: и у ответственного за пополнения без главенства — иначе очередь пополнений ему недостижима
  // шаг 3: и у арт-директора — его вход «Слоты и мастера» живёт там (решение координатора 29.10.2026)
  // шаг 4: и у МАСТЕРА — его «Ивенты» со СВОИМИ живут там (слово владельца 30.10.2026: «мастер должен начать
  // видеть раздел управление»). Именно мастеру, а не всем с `mayOwnEvents()`: партнёру, куратору и организатору
  // вкладку никто не давал, у них свой вход «Управление своими» на афише
  if ((mayPeople() || mayTopups() || mayMasters() || LIVE && msIsMaster()) && !t.some(function (x) { return x[0] === 'manage'; }))
    t.push(['manage', 'Управление', ICON.people]);
  return t;
}

/* Куда ведёт «назад» с каждого экрана. Без карты всё падало на первую
   вкладку, и из мероприятия человек улетал на главную вместо списка. */
function homeOf() {
  // 0.1 «Путь мастера», слово владельца 05.11.2026: «человек без живого членства попадает на просьбу о вступлении и
  // видит только её». Экран входа (BARE): вкладок и выхода нет по построению — и у держателя роли без членства тоже,
  // это названная цена решения (Cafe13KPG#324). В демонстрации — прежние «Услуги»: гостя там показывают
  if (DATA.role === 'guest') return LIVE ? 'noAccess' : 'guest';
  if (DATA.role === 'staff') return 'staff';
  if (DATA.role === 'bar') return 'barQueue';
  if (DATA.role === 'curator') return 'curator';
  return 'home';
}
var BACK = {
  // прошедшее открывается из «Записей» — туда и назад; будущее — на афишу
  event: function () { return LIVE && !(EVENTS || []).some(function (x) { return String(x.id) === String(param); }) && histById(param) ? 'bookings' : 'events'; },
  thanks: function () { return { s: 'event', p: TH.id }; },
  // В живом режиме форма открывается с афиши, в демонстрации — из кабинета.
  // Без этого «назад» уводило на демонстрационный кабинет, где лежат
  // придуманные мероприятия: рядом с живой афишей они выглядели бы живыми.
  eventNew: function () { return LIVE ? 'events' : 'organizer'; },
  eventManage: 'organizer',
  // правка недели возвращает на ТУ ЖЕ карточку: экрану нужен номер, поэтому пара {s, p}
  eventEdit: function () { return { s: 'event', p: EDT.id }; },
  people: 'manage', joinQueue: 'manage', topupQueue: 'manage', topupReq: 'topupQueue', memberRequests: 'home',
  masters: 'manage', masterReqs: 'masters', masterReq: 'masterReqs', masterEvents: 'masters', masterEvent: 'masterEvents', masterList: 'masters', masterApply: 'home', masterRenew: 'home',
  payouts: 'manage', payout: 'payouts',
  tillPerson: 'staff', tillMembership: 'tillPerson', tillTopup: 'tillPerson', tillDay: 'staff',
  // homeOf() работника без членства — 'guest', экран услуг: из карточек он уезжал бы
  // туда, а не в «Заказы», откуда вошёл (Cafe13KPG#403)
  barCards: function () { return CARDS.from || homeOf(); }, barCard: 'barCards',
  serviceNew: 'partner', consentFull: 'consent',
  // тетрадь клуба открыта с экрана просьбы — туда и возврат (решение владельца 28.10, Cafe13KPG#324 v74)
  joinAbout: 'noAccess',
  bar: 'guest', drink: 'bar', barCart: 'bar', barOrder: 'bar',
  barRecipe: function () { return 'drink'; },
  topup: function () {
    // форма и история члена клуба — состояния того же экрана: «назад» сперва к путям (E52)
    if (TUP.online || TUP.hist) { TUP.online = false; TUP.hist = false; return 'topup'; }
    // 0.1 «Путь мастера»: «назад» — на «Клуб». На бар — только с самого бара и только пока он не заморожен:
    // в живом прежнее «всё, что не главная, — бар» уводило с ЛЮБОГО экрана рамки (кошелёк в шапке есть везде)
    // на замороженный «Бар» и звало его ручки (/directions, /bar/menu) — замер frontend-upravlenie 05.11.2026
    return TOPUP.from === 'bar' && !frozen('bar') ? 'bar' : 'home';
  },
  barMoney: function () { return BOOK.from; },
  barDay: function () { return LIVE ? DAY.from : homeOf(); },
  // съёмка открывается и с бара, и из кабинета куратора — «назад» зависит от роли
  barShot: function () { return DATA.role === 'curator' ? 'curator' : 'barQueue'; }
};
function goBack() { var b = backTo(); if (b && typeof b === 'object') go(b.s, b.p); else go(b); }
function backTo() {
  var b = BACK[current];
  if (typeof b === 'function') b = b();
  return b || homeOf();
}

/* Баланс в шапке (Cafe13KPG#500, слово владельца): справа на уровне «Café XIII»,
   по умолчанию СКРЫТ; тап показывает, повторный прячет. Рядом — кошелёк с плюсом,
   вход в пополнение. Число — то же DATA.member.balance, что из корня /me.
   На экранах входа (BARE) шапка пустая: человека ещё нет. */
var BAL = { shown: false };
function barRight() {
  // typeof … 'number' — вторая линия, НЕДОСТИЖИМА, пока жив разбор fromMe: все три записи
  // DATA.member.balance берут число из fromMe, а он отвергает /me без конечного остатка
  // (мутация arhitector-47 на #123 это и показала: снятая проверка — батарея зелёная)
  if (bare() || !DATA.member || typeof DATA.member.balance !== 'number') return '';
  return '<button type="button" class="bal" id="bal" data-action="bal-toggle" aria-pressed="' + BAL.shown + '"' +
      ' aria-label="' + (BAL.shown ? 'Скрыть баланс' : 'Показать баланс') + '">' +
      (BAL.shown ? money(DATA.member.balance) + ' ฿' : '••• ฿') + '</button>' +
    '<button type="button" class="icon-btn" id="wallet" data-go="topup" aria-label="Пополнить счёт">' + svg(ICON.wallet) + '</button>';
}

// где знака быть не должно: машиночитаемый код на экране (довод — доверие у двери, designer-55)
var MARK_OFF = '.code-box, .qr';

/* Экраны без вкладок: уйти с них можно решением, а не переключением. */
var BARE = { consent: 1, consentFull: 1, loading: 1, noSign: 1, noAccess: 1, apiDown: 1, joinAbout: 1 };
function bare() { return !!BARE[current]; }

var current = 'home';
var param = null;

/* Какой экран нарисован последним: «тот же экран» сохраняет место прокрутки, другой — сверху.
   Слово владельца 28.10.2026: «каждое действие и каждый клик дергает экран… после обновления
   возвращайся где было» (Cafe13KPG#490). Раньше render() кончался безусловным scrollTo(0, 0). */
var RENDERED = null;
function render() {
  var view = document.getElementById('view');
  var here = current + '|' + String(param), y = window.scrollY || 0;
  var same = RENDERED === here;
  RENDERED = here;
  // полоса просмотра — и на экране входа, когда бог смотрит ЧУЖИМИ глазами: человек без членства теперь стартует на
  // просьбе (0.1), и без полосы владелец не видел бы, чьими глазами смотрит, и не вышел бы из просмотра
  view.innerHTML = (bare() && !(TEST.on && TEST.as) ? '' : testStrip()) + (PROTO[current] || !LIVE && MS_DEMO[current] ? protoStrip() : '') +
    SCREENS[frozen(current) ? 'frozen' : LIVE && !WIRED[current] && !PROTO[current] ? 'soon' : current](param);
  // вход на замороженный экран гаснет ПО СВОЙСТВУ, а не перечнем кнопок: любой [data-go] туда
  // (Cafe13KPG#510); облик — общий .btn[disabled]
  if (LIVE) [].forEach.call(view.querySelectorAll('[data-go]'), function (b) {
    if (!closed(b.getAttribute('data-go'))) return;
    b.disabled = true; b.setAttribute('aria-disabled', 'true');
    // причина ЗАМЕНЯЕТ подстрочник (designer-55, по снимку): описание того, куда не войти, — шум, а
    // приписка через «·» переносила строку на вторую; серое без причины читается как поломка
    var sub = b.classList.contains('listitem') && b.querySelector('.grow .small');
    if (sub) sub.textContent = 'временно недоступно';
  });

  var root = tabList().some(function (t) { return t[0] === current; });
  // экран входа без вкладок, но со своим «назад» (consentFull, joinAbout) — стрелка и своё имя в шапке
  var away = bare() && !BACK[current];
  document.getElementById('back').hidden = root || away;

  var title = document.getElementById('title');
  if (current === 'home' || current === 'guest' || away) {
    title.textContent = 'Café XIII';
    title.className = 'wordmark';
  } else {
    title.textContent = LIVE && current === 'demo' ? 'Просмотр' : TITLES[current] || 'Café XIII';
    title.className = 'wordmark plain';
  }
  var right = document.getElementById('bar-right');
  if (right) right.innerHTML = barRight();
  /* Водяной знак (кадр E53, Cafe13KPG#509) гаснет ЭКРАНОМ ЦЕЛИКОМ там, где на нём
     машиночитаемый код: QR пропуска (.code-box) и QR реквизитов (.qr). Признак —
     СВОЙСТВО отрисованного экрана, а не перечень имён: пропуск рисуется и на
     apiDown (запас с телефона), и новый экран с кодом погасит знак сам. Гасится
     атрибутом оболочки, а не удалением узла — иначе на возврате знак мигнёт. */
  document.body.setAttribute('data-mark', view.querySelector(MARK_OFF) ? 'off' : 'on');

  var tabs = document.getElementById('tabs');
  var list = bare() ? [] : tabList();
  tabs.hidden = !list.length;
  document.body.classList.toggle('no-tabs', !list.length);
  tabs.innerHTML = list.map(function (t) {
    var on = t[0] === current;
    // замороженная вкладка — серая и не нажимается, а не спрятана (буква владельца, Cafe13KPG#510)
    return '<button type="button" data-go="' + t[0] + '"' + (on ? ' aria-current="page"' : '') +
      (closed(t[0]) ? ' disabled aria-disabled="true"' : '') + '>' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');

  sunButton();
  tgChrome();
  // место берётся ДО подмены разметки: после неё высота страницы другая, и браузер уже сдвинул бы его
  window.scrollTo(0, same ? y : 0);
}

/* ── рабочие экраны в демонстрации (Cafe13KPG#409) ─────
   Вне Telegram девять экранов бара, кассы и «Людей» рисовали отказ по праву:
   все права начинаются с LIVE, а опись снимает вне Telegram. Права НЕ
   ослаблены — у самих экранов гард стал `LIVE && !право()`. Данные ниже — в
   ФОРМЕ ОТВЕТА СЕРВЕРА и проходят те же разборщики, что живой ответ:
   демонстрация не может показать то, чего живой экран не разобрал бы.

   Входов на эти экраны в демонстрации нет — главная гостя и члена клуба не
   меняется, руками до них не дойти; их показывает опись (решение
   координатора по #409, вариант A). Люди — роли в скобках, как во всей
   демонстрации; номера — выдуманные из общей фикстуры (tools/ids-clean.cjs).
   Где смысл экрана в различии (наличные, карта, со счёта; доход и расход;
   остаток и платёж), числа нарочно разные: равные числа такую ошибку прячут. */
DATA.work = {
  dirs: [{ id: 1, title: 'Бар', is_active: true }],
  people: { people: [
    { tg_user_id: 200000001, first_name: '[глава клуба]', roles: [{ id: 11, role: 'head' }], memberships: ['partner'], balance: '3170.00' },
    { tg_user_id: 200000002, first_name: '[куратор бара]', roles: [{ id: 12, role: 'curator', direction_id: 1, direction: 'Бар' }], memberships: ['member'], balance: '0.00' },
    { tg_user_id: 200000003, first_name: '[исполнитель на баре]', roles: [{ id: 13, role: 'bar', direction_id: 1, direction: 'Бар' }], memberships: ['member'], balance: '420.00' },
    { tg_user_id: 200000004, first_name: '[кассир]', roles: [{ id: 14, role: 'staff' }], memberships: [], balance: '0.00' },
    { tg_user_id: 200000005, first_name: '[имя члена]', roles: [], memberships: ['member'], balance: '640.00' }
  ] },
  cards: [
    { id: 301, title: 'Тыквенный латте', group: 'Кофе', price: '135.00', mins: 4, about: 'Тыква, корица, двойной эспрессо', is_alcohol: false,
      state: 'review', recipes: ['ru'], decision_note: null, photo_id: null, last_photo_id: 91, last_photo_state: 'pending' },
    { id: 302, title: 'Манго-ласси', group: 'Авторские', price: '160.00', mins: 3, about: 'Манго, йогурт, кардамон', is_alcohol: false,
      state: 'review', recipes: [], decision_note: null, photo_id: null, last_photo_id: null, last_photo_state: null },
    { id: 303, title: 'Матча-тоник', group: 'Авторские', price: '150.00', mins: 2, about: 'Матча, тоник, лёд', is_alcohol: false,
      state: 'draft', recipes: ['ru'], decision_note: 'Нет фото, цена выше соседних', photo_id: null, last_photo_id: null, last_photo_state: null },
    { id: 304, title: 'Какао на кокосовом', group: 'Кофе', price: '125.00', mins: null, about: '', is_alcohol: false,
      state: 'draft', recipes: [], decision_note: null, photo_id: null, last_photo_id: null, last_photo_state: null },
    { id: 305, title: 'Флэт-уайт', group: 'Кофе', price: '110.00', mins: 4, about: 'Молоко обычное или кокосовое', is_alcohol: false,
      state: 'active', recipes: ['ru', 'en'], decision_note: null, photo_id: 92, last_photo_id: 92, last_photo_state: 'approved' },
    { id: 306, title: 'Эспрессо', group: 'Кофе', price: '70.00', mins: 2, about: 'Двойной, местная обжарка', is_alcohol: false,
      state: 'active', recipes: ['ru'], decision_note: null, photo_id: 93, last_photo_id: 93, last_photo_state: 'approved' },
    { id: 307, title: 'Габа', group: 'Чай', price: '140.00', mins: 5, about: 'Тайваньская, мягкая', is_alcohol: false,
      state: 'hidden', recipes: ['ru'], decision_note: null, photo_id: null, last_photo_id: null, last_photo_state: null }
  ],
  cardRecipes: {
    301: { ru: 'Тыквенное пюре 30 г, корица на кончике ножа, двойной эспрессо, молоко 150 мл.' },
    303: { ru: 'Матча 2 г взбить в 40 мл воды, лёд доверху, тоник 120 мл.' },
    305: { ru: 'Двойной ристретто, молоко 120 мл без пены, рисунок не обязателен.',
           en: 'Double ristretto, 120 ml milk with no foam, latte art optional.' },
    306: { ru: 'Двойной эспрессо, 36 г на выходе за 27 секунд.' },
    307: { ru: 'Гайвань, 5 г, вода 85 °C, первый пролив слить.' }
  },
  // экран рецепта: русский есть, английского нет — сервер отдаёт русский с exact: false
  recipe: {
    me: { lang: 'ru', asked_lang: 'ru', exact: true, body: 'Двойной ристретто, молоко 120 мл без пены, рисунок не обязателен.' },
    en: { lang: 'ru', asked_lang: 'en', exact: false, body: 'Двойной ристретто, молоко 120 мл без пены, рисунок не обязателен.' }
  },
  // «Записано сейчас» на экране дохода и расхода — уже разобранный вид, как его кладёт bookSend
  book: [
    { inc: true, amount: 2340, at: '21:05', note: 'выручка за вечер, 14 чеков', how: 'наличные' },
    { inc: false, amount: 480, at: '16:20', note: 'молоко, 6 литров', how: 'закуп · текущая трата · наличные бара' }
  ],
  tillCode: 'XIII-0137',
  tillWho: { member_id: 200000005, first_name: '[имя члена]', last_name: null, membership_active: true,
             membership: { level: 'member', lifelong: false, ends_at: '2026-12-03T00:00:00+07:00' }, balance: '640.00' },
  tillDay: { count_live: 3, total_live: '4475.00', rows: [
    { id: 45, kind: 'service', method: 'account', amount: '175.00', at: '2026-10-27T19:24:00+07:00', note: 'заказ бара 14', cancels_id: null, cancelled_by: null },
    { id: 44, kind: 'event', method: 'account', amount: '400.00', at: '2026-10-27T17:43:00+07:00', note: null, cancels_id: 43, cancelled_by: null },
    { id: 43, kind: 'event', method: 'account', amount: '400.00', at: '2026-10-27T17:40:00+07:00', note: null, cancels_id: null, cancelled_by: 44 },
    { id: 42, kind: 'topup', method: 'cash', amount: '1000.00', at: '2026-10-27T16:51:00+07:00', note: null, cancels_id: null, cancelled_by: null },
    { id: 41, kind: 'membership', method: 'card', amount: '3300.00', at: '2026-10-27T16:12:00+07:00', note: null, cancels_id: null, cancelled_by: null }
  ] }
};

// Кладёт данные демонстрации туда, где их ждёт экран, — один раз за вход
// и только если места пусты: переходы внутри экрана их не сбрасывают.
function demoWork(screen, p) {
  var W = DATA.work;
  if (screen === 'people' && !PEOPLE.list) { PEOPLE.list = fromRoster(W.people); PEOPLE.dirs = fromDirList(W.dirs); }
  if ((screen === 'barCards' || screen === 'barCard') && !CARDS.list) CARDS.list = fromCards(W.cards);
  if (screen === 'barRecipe' && RECIPE.pid !== p)
    RECIPE = { pid: p, gen: RECIPE.gen, me: { state: 'ok', r: fromRecipe(W.recipe.me) }, en: { state: 'ok', r: fromRecipe(W.recipe.en) } };
  if (screen === 'barMoney' && !BOOK.done.length) BOOK.done = W.book.slice();
  if (/^till(Person|Membership|Topup)$/.test(screen) && !TP.who) TP.who = fromTillPerson(W.tillWho, W.tillCode);
  if (screen === 'tillMembership' && TP.kind !== 'membership') tillPrep('membership');
  if (screen === 'tillTopup' && TP.kind !== 'topup') tillPrep('topup');
  if (screen === 'tillDay' && !TD.data) TD.data = fromTillDay(W.tillDay);
}

/* Отправки и перечитывания рабочих экранов. В демонстрации они не уходят:
   сервера нет, а «ничего не случилось» на нажатие — дефект, уже бывший у нас
   (Cafe13KPG#338). Поэтому нажатие отвечает словами, что это демонстрация. */
var DEMO_SENDS = ['p-give', 'p-ask', 'p-back', 'p-lvrevoke', 'p-outyes', 'p-reload', 'c-save', 'c-group-theirs', 'c-group-mine', 'c-recipe',
                  'c-review', 'c-approve', 'c-hide', 'c-back-send', 'c-reload', 'b-send', 'book-retry',
                  'tp-send', 'tp-reload', 'td-cancel', 'td-reload'];

function go(screen, p) {
  if (!SCREENS[screen]) return;
  if (screen === 'eventEdit' && (current !== 'eventEdit' || EDT.id !== p)) {
    var ee = eventById(p); EDT = { id: p, seats: ee ? String(ee.unl ? 0 : ee.of) : '', about: ee ? ee.about : '',
                                   price: ee ? String(entryOf(ee)) : '', ask: ee ? ee.ask : null, busy: false, err: '' };
  }
  if (!LIVE && MS_DEMO[screen]) msDemoFill();
  if (noEntry() && !BARE[screen]) return;      // вход не состоялся — только экраны входа
  if (screen === 'noAccess' && current !== 'noAccess') { JOIN.err = ''; JOIN.fileErr = ''; loadJoin(); }
  if (screen === 'joinAbout' && current !== 'joinAbout') loadAbout();
  if (screen === 'topup' && current !== 'topup') {
    TUP.online = false; TUP.hist = false; TUP.err = ''; TUP.fileErr = '';
    if (LIVE && !(TEST.on && TEST.as)) loadTopups();
  }
  if (screen === 'demo' && LIVE && !isGod()) return;
  if (screen === 'demo' && LIVE && !TEST.on && TEST.health !== 'configured' && TEST.health !== 'loading') loadHealth();
  if (FLASH_SHOWN) { FLASH = null; FLASH_SHOWN = false; }
  if (screen === 'topup' && current !== 'topup') {
    // «откуда» — бар, только если вошли С БАРА (кнопки «Не хватает» у напитка и в корзине); прочее — главная
    TOPUP.from = { bar: 1, drink: 1, barCart: 1 }[current] ? 'bar' : 'home';
    TOPUP.ask = false; TOPUP.err = '';
  }
  if (screen === 'barDay' && current !== 'barDay')
    DAY.from = current === 'barQueue' || current === 'barMoney' ? current : homeOf();
  if (screen === 'barMoney' && current !== 'barMoney') {
    BOOK.from = current === 'barQueue' ? 'barQueue' : homeOf();
    BOOK.ask = false; BOOK.err = '';
  }
  // уход с экрана — тоже «ушли»: окно уровня уходит отправкой, а не сбросом (v91)
  // окно отмены: уход с ЕГО экрана — по политике окна (UNDO.leave), см. undoStart
  if (UNDO.key && UNDO.screen === current && screen !== current) {
    if (UNDO.leave === 'send') UNDO.send(UNDO.key); else undoStop();
  }
  if (screen === 'people' && current !== 'people') { PEOPLE.back = null; peopleReset(); PEOPLE.card = null; if (mayPeople()) loadRoster(); }
  if (screen === 'manage' && current !== 'manage' && mayPeople()) loadJoinQueue();
  if (screen === 'manage' && current !== 'manage' && mayTopups()) loadTopupQueue();
  // пометка ждущих на «Слотах и мастерах» (#769) — счёт очереди мастеров нужен уже на «Управлении»
  if (screen === 'manage' && current !== 'manage' && mayMasters()) loadMasterQueue();
  // шаг 11: пометка ждущих на «Распределить деньги» — счёт нужен уже на «Управлении»; каждый вход — свежий список
  if ((screen === 'manage' || screen === 'payouts') && current !== screen && mayMasters()) { PAY.err = ''; loadPayouts(); }
  if (screen === 'payout') { PAY.err = ''; if (!PAY.list && mayMasters()) loadPayouts(); }
  if (screen === 'masterRenew' && current !== 'masterRenew' && LIVE) { RNW.err = ''; RNW.key = ''; if (MR.mineState === '' || !MR.mine) loadMineMaster(); }
  // вход на экран, где остаток решает (кнопки «Я мастер», «+» часа, пополнение), — перечитать его (Cafe13KPG#638)
  // кроме первого входа с «Загрузки»: остаток только что пришёл ответом /me на старте
  if ({ home: 1, topup: 1, masterApply: 1, masterRenew: 1 }[screen] && current !== screen && current !== 'loading' && LIVE && !noEntry()) refreshMe();
  // шаг 3: каждый вход — свежие данные сервера
  if (screen === 'home' && current !== 'home' && LIVE && DATA.role !== 'guest') { MR.mineState = ''; }
  if ((screen === 'masters' || screen === 'masterReqs') && current !== screen && mayMasters()) { MR.qErr = ''; loadMasterQueue(); loadMineMaster(); }
  if (screen === 'masterReq') { MR.qErr = ''; if (current !== 'masterReq' || param !== p) { MR.ask = 0; MR.note = ''; } if (!MR.q && mayMasters()) loadMasterQueue(); }
  if ((screen === 'masterEvents' || screen === 'masterList') && current !== screen && mayMasters()) { MR.sErr = ''; loadSlots(); }
  if (screen === 'masterEvent') { MR.sErr = ''; if (!MR.slots && mayMasters()) loadSlots(); }
  if (screen === 'masterApply' && current !== 'masterApply' && LIVE) {
    MSF.err = ''; if (!EV_PLACES && EV_PLACES_STATE !== 'loading') loadPlaces();
    loadPrice(2); loadPrice(2 + MSF.extra); loadPrice(3 + MSF.extra);
    if (MR.mineState === '') loadMineMaster();
  }
  if (screen === 'topupQueue' && current !== 'topupQueue') { TOPQ.err = ''; TOPQ.step = ''; TOPQ.note = ''; if (mayTopups()) loadTopupQueue(); }
  // заявку открывают и не с очереди (назад из другого экрана, тест) — без списка она не нарисуется
  if (screen === 'topupReq') { TOPQ.err = ''; TOPQ.step = ''; TOPQ.note = ''; TOPQ.done = '';
    if (!TOPQ.list && mayTopups()) loadTopupQueue(); else topupShotFor(p); }
  if (screen === 'joinQueue' && current !== 'joinQueue') { JOINQ.err = ''; JOINQ.ok = 0; JOINQ.no = 0; JOINQ.note = ''; if (mayPeople()) loadJoinQueue(); }
  if (screen === 'membership' && current !== 'membership' && LIVE) { MREQ.err = ''; loadTiers(); }
  if (screen === 'memberRequests' && current !== 'memberRequests' && mayRequests()) { MREQS.err = ''; MREQS.ask = 0; loadRequests(); if (!TIERS.list) loadTiers(); }
  if (screen === 'home' && current !== 'home' && mayRequests() && WIRED.memberRequests) loadRequests();
  // с самой карточки в список возвращаются — это не новый вход, «откуда» не трогать
  if (screen === 'barCards' && current !== 'barCards' && current !== 'barCard')
    CARDS.from = current === 'barQueue' ? 'barQueue' : homeOf();
  if (screen === 'barCards' && current !== 'barCards' && mayCards()) loadCards();
  if (screen === 'barCard' && (current !== 'barCard' || String(param) !== String(p))) {
    // заметка «черновик сохранён» переживает переход с формы на саму карточку
    var keepNote = current === 'barCard' ? CARD.note : '';
    cardReset(); CARD.note = keepNote;
  }
  current = screen;
  param = p || null;
  if (!LIVE) demoWork(screen, p);
  if (screen === 'barMoney' && LIVE && !BAR) bookLoad();
  if (screen === 'barDay' && LIVE) loadDay();
  if (screen === 'tillDay' && LIVE && canTopup()) { TD.ask = -1; TD.deny = null; tillDayLoad(); }
  if (screen === 'pass' && LIVE && !PASS && !PASS_FAIL) loadPass();
  if ((screen === 'bar' || screen === 'drink') && LIVE && MENU_STATE === '') loadMenu();
  /* «Записи» строятся из ответа афиши, поэтому грузить её надо и при входе
     сюда: человек попадает на этот экран сразу после записи (`go('bookings')`),
     минуя афишу, и без этой строки `EVENTS` остался бы `null` навсегда —
     экран сказал бы «вы никуда не записаны» тому, кто только что записался.
     Перечитывается при КАЖДОМ входе, а не один раз за запуск (Cafe13KPG#699): прежнее `=== ''`
     в пустое состояние не возвращалось, и мероприятие, заведённое после запуска, не появлялось
     до перезапуска. Прежний список стоит на экране до ответа — экраны рисуют `EVENTS`, а не
     состояние; запрос, уже идущий, второй раз не шлётся. Опроса по таймеру нет нарочно. */
  if ((screen === 'home' || screen === 'events' || screen === 'bookings') && LIVE && EVENTS_STATE !== 'loading') loadEvents();
  if (screen === 'bookings' && LIVE && HIST_STATE !== 'loading') loadHistory();
  // Места спрашиваются ЗАНОВО, если прошлый ответ списка не принёс: иначе
  // отказ, случившийся однажды, лежит на форме навсегда — человек читает
  // «места не пришли» уже после того, как сервер выздоровел. Пустой
  // список при этом второй раз не просим: `[]` — ответ, а не отказ.
  if (screen === 'eventNew' && LIVE && EV_PLACES_STATE !== 'loading' && !EV_PLACES) loadPlaces();
  if (screen !== 'event') { BOOK_ERR = ''; BOOK_ASK = false; EV_ERR = ''; EV_ASK = false; }
  // Список записавшихся спрашивается при входе на карточку СВОЕГО события:
  // loadSigned сам молчит на чужом, поэтому предикат один и здесь.
  if (screen === 'event' && LIVE) loadSigned(eventById(param));
  if (screen === 'barRecipe' && LIVE) loadRecipe(param);
  if (screen !== 'eventNew') EVN_ERR = '';
  render();
  if (screen === 'barOrder' && LIVE) pollMine();
  if (screen === 'barQueue' && LIVE) loadQueue();
  if (screen === 'eventNew') {
    loadDraft(function (restored) {
      if (restored && current === 'eventNew') {
        FLASH = 'Черновик восстановлен';
        render();
      }
    });
  }
}

/* Эхо дня и времени правится НА МЕСТЕ, без перерисовки экрана: перерисовка
   на каждую нажатую клавишу уводила бы курсор из поля. Заодно набранное
   сразу ложится в память формы — тогда и отказ сервера его не сотрёт. */
document.addEventListener('input', function (ev) {
  var t = ev.target;
  if (!t || (t.id !== 'f-date' && t.id !== 'f-time')) return;
  FORM.v[t.id] = t.value;
  var eh = echoText(val('f-date'), val('f-time'));
  var e = document.getElementById('f-echo');
  if (e) e.textContent = eh.text;
  var tail = document.getElementById('f-echo-tail');
  if (tail) tail.hidden = !eh.ok;
});

// «Начало» — выбор (select): смена значения кликом не приходит, а занятость обязана перечитаться под новое время
document.addEventListener('change', function (ev) {
  if (ev.target && ev.target.id === 'msf-time' && current === 'masterApply') { msfGrab(); MSF.err = ''; render(); }
});
document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-go],[data-event],[data-role],[data-kind],[data-place],[data-toggle],[data-manage],[data-action],[data-drink],[data-where],[data-pay],[data-exp],[data-expay]');
  if (!el) return;

  if (el.hasAttribute('data-role')) {
    if (LIVE) return;                  // роль ставит сервер
    DATA.role = el.getAttribute('data-role');
    go(homeOf());
    return;
  }
  if (el.hasAttribute('data-drink')) { go('drink', el.getAttribute('data-drink')); return; }
  if (el.hasAttribute('data-where')) { ORDER.where = el.getAttribute('data-where'); DENY = ''; haptic(); render(); return; }
  if (el.hasAttribute('data-pay'))   { ORDER.pay   = el.getAttribute('data-pay');   haptic(); render(); return; }
  // грабим введённое ДО перерисовки: иначе выбор категории стирал набранный текст
  if (el.hasAttribute('data-exp'))   { grabForm(EXP_FIELDS); EXP.cat = el.getAttribute('data-exp');   haptic(); render(); return; }
  if (el.hasAttribute('data-expay')) { grabForm(EXP_FIELDS); EXP.pay = el.getAttribute('data-expay'); haptic(); render(); return; }
  if (el.hasAttribute('data-kind')) {
    grabForm(EVENT_FIELDS); FORM.kind = el.getAttribute('data-kind'); haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-place')) {
    // Пустая строка в data-place — это «без места», а не поломка: числа
    // у места начинаются с единицы, и Number('') дал бы ноль-мероприятие.
    var pv = el.getAttribute('data-place');
    grabForm(EVENT_FIELDS); FORM.place = pv ? Number(pv) : null;
    haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-toggle')) {
    grabForm(EVENT_FIELDS); FORM.filmed = !FORM.filmed; haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-manage')) { go('eventManage', el.getAttribute('data-manage')); return; }

  if (el.hasAttribute('data-action')) { doAction(el.getAttribute('data-action')); return; }
  if (el.hasAttribute('data-event')) { go('event', el.getAttribute('data-event')); return; }
  // погашенный вход не ведёт никуда, даже если щелчок дошёл до него сквозь дочерний элемент
  if (el.disabled) return;
  go(el.getAttribute('data-go'));
});

function doAction(a) {
  /* Действия бара несут аргумент через двоеточие: cart-add:flat, order-make:A-16.
     Разбор здесь, чтобы разметка оставалась одними атрибутами. */
  var arg = null, c = a.indexOf(':');
  if (c !== -1) { arg = a.slice(c + 1); a = a.slice(0, c); }
  if (!LIVE && DEMO_SENDS.indexOf(a) !== -1) {
    if (a.slice(0, 2) === 'c-') grabCard();     // набранное в карточке не теряется
    FLASH = { text: 'Это демонстрация', note: 'В Telegram это ушло бы на сервер клуба. Здесь ничего не отправлено и не записано.' };
    haptic('warn'); render(); return;
  }

    if (a === 'buy') { buy(arg); return; }
    if (a === 'retry-menu') { loadMenu(); render(); return; }
    if (a === 'send-order' && LIVE) {
      var live = cartList();
      if (!live.length) { FLASH = { text: 'Заказ пуст', note: 'Добавьте что-нибудь в меню.' }; render(); return; }
      placeOrder(live, ORDER.where, 'account');
      return;
    }
    if (a === 'cart-add') {
      CART[arg] = (CART[arg] || 0) + 1; DENY = '';
      haptic(); render(); return;
    }
    if (a === 'cart-less') {
      CART[arg] = (CART[arg] || 0) - 1; DENY = '';
      if (CART[arg] <= 0) delete CART[arg];
      haptic(); render(); return;
    }
    if (a === 'send-order') {
      var olist = cartList();
      if (!olist.length) {
        FLASH = { text: 'Заказ пуст', note: 'Добавьте что-нибудь в меню.' };
        haptic('warn'); render(); return;
      }
      ORDERSEQ += 1;
      var o = { id: 'A-' + (16 + ORDERSEQ), who: DATA.member.name, at: nowHM(),
                where: ORDER.where, pay: ORDER.pay, sum: cartSum(), state: 'new',
                items: olist.map(function (x) { return [x.title, x.n]; }) };
      DATA.bar.orders.unshift(o);
      DATA.bar.mine = o;
      CART = {};
      haptic('ok');
      FLASH = { text: 'Заказ ' + o.id + ' отправлен на бар',
                note: 'Это демонстрация: заказ виден только в этой вкладке. В Telegram бар получает его в ту же секунду.' };
      go('barOrder');
      return;
    }
    if (a === 'q-making' || a === 'q-ready' || a === 'q-served') { setState(Number(arg), a.slice(2)); return; }
    if (a === 'tp-find') { tillFind(val('tp-code')); return; }
    if (a === 'tp-next') { tillReset(); TP.code = ''; go('staff'); return; }
    if (a === 'tp-open') { TP.done = null; tillOpen(arg); return; }
    if (a === 'tp-level' && LEVEL[arg] && !TP.busy) { TP.level = arg; render(); return; }
    if (a === 'tp-method' && PAY_HOW[arg] && !TP.busy && (arg !== 'account' || TP.kind === 'membership')) { TP.method = arg; render(); return; }
    if (a === 'tp-send') { tillSend(); return; }
    if (a === 'td-ask' && TD.busy === -1) { TD.ask = Number(arg); TD.deny = null; render(); return; }
    if (a === 'td-keep') { TD.ask = -1; render(); return; }
    if (a === 'td-cancel') { tillCancel(Number(arg)); return; }
    if (a === 'td-reload') { tillDayLoad(); render(); return; }
    if (a === 'tp-reload' && TP.who && !TP.busy) {
      TP.busy = true; render();
      tillLookup(TP.who.code, function (rec, r) {
        TP.busy = false;
        if (rec) { TP.who = rec; if (TP.done) TP.done.reread = true; }
        else FLASH = { text: 'Карточка не перечиталась', note: said(r) };
        render();
      });
      return;
    }
    if (a === 'book-retry') { bookLoad(); render(); return; }
    if (a === 'test-health') { loadHealth(); render(); return; }
    if (a === 'day-reload') { loadDay(); render(); return; }
    if (a === 'test-on' && isGod()) { switchTo(true, null); loadPeople(); return; }
    if (a === 'test-as' && isGod() && TEST.on && TEST.people) {
      var who = TEST.people.filter(function (x) { return String(x.id) === arg; })[0];
      if (who) switchTo(true, who);
      return;
    }
    if (a === 'test-self' && TEST.on) { switchTo(true, null); loadPeople(); return; }
    if (a === 'test-off' && TEST.on) { switchTo(false, null); return; }
    if (a.slice(0, 2) === 'b-') {
      if (BOOK.busy) return;
      bookGrab();
      if (a === 'b-new') { BOOK.kind = arg === 'income' ? 'income' : 'expense'; BOOK.ask = false; BOOK.err = ''; }
      if (a === 'b-method' && pick(INCOME_HOW, arg)) BOOK.method = arg;
      if (a === 'b-cat' && EXP_CATS.indexOf(arg) !== -1) BOOK.cat = arg;
      if (a === 'b-kind' && pick(EXP_KINDS, arg)) BOOK.ekind = arg;
      if (a === 'b-paid' && pick(PAID_BY, arg)) BOOK.paid = arg;
      if (a === 'b-ask') { BOOK.err = bookMissing(); BOOK.ask = !BOOK.err; }
      if (a === 'b-keep') BOOK.ask = false;
      if (a === 'b-send') { bookSend(); return; }
      if (BOOK.err && a !== 'b-ask') BOOK.err = bookMissing() && BOOK.err;
      haptic(); render(); return;
    }
    if (a.slice(0, 2) === 'c-' && (current === 'barCards' || current === 'barCard')) {
      if (CARD.busy) return;
      grabCard();
      if (a === 'c-reload') { loadCards(); render(); return; }
      if (a === 'c-new') { go('barCard', 'new'); return; }
      if (a === 'c-open') { go('barCard', arg); return; }
      if (a === 'c-save') { cardSave(); return; }
      if (a === 'c-group-theirs') { cardSave('theirs'); return; }
      if (a === 'c-group-mine') { cardSave('mine'); return; }
      if (a === 'c-recipe') { recipeSave(Number(arg)); return; }
      if (a === 'c-review') { cardState(Number(arg), 'review'); return; }
      if (a === 'c-approve') { cardState(Number(arg), 'active'); return; }
      if (a === 'c-hide') { cardState(Number(arg), 'hidden'); return; }
      if (a === 'c-back-send') {
        if (!CARD.reason.trim()) { CARD.err = ''; CARD.deny = 'Напишите причину — её прочтёт бар.'; haptic('warn'); render(); return; }
        cardState(Number(arg), 'hidden', CARD.reason.trim()); return;
      }
      if (a === 'c-group') { CARD.v['c-group'] = arg; CARD.groupAsk = ''; }
      if (a === 'c-alcohol') CARD.alcohol = !CARD.alcohol;
      if (a === 'c-lang' && CARD_LANGS.some(function (l) { return l[0] === arg; })) { CARD.lang = arg; CARD.err = ''; }
      if (a === 'c-back') CARD.back = true;
      if (a === 'c-back-keep') { CARD.back = false; CARD.reason = ''; }
      if (a === 'c-hide-ask') CARD.hideAsk = true;
      if (a === 'c-hide-keep') CARD.hideAsk = false;
      haptic(); render();
      // поле причины и его кнопки — в вид: иначе они открылись бы за нижним краем
      var rf = a === 'c-back' && document.getElementById('c-reason');
      if (rf && rf.scrollIntoView) rf.scrollIntoView({ block: 'start' });
      return;
    }
    if (a.slice(0, 2) === 'p-' && current === 'people') {
      // Против двойного нажатия две линии: эта и своя проверка busy в
      // grantSend/revokeSend. Они прикрывают друг друга: снятие любой одной
      // зелёное, обеих — красное (people-double, people-double-revoke;
      // Cafe13KPG#214, 22.10.2026). Снимать можно одну, не обе. Эта ещё и
      // держит p-open/p-close: peopleReset снимает блокировку.
      if (PEOPLE.busy) return;
      var before = peopleTouched();
      /* УХОД С КАРТОЧКИ (v91, слово владельца «пока не выбрали другую карточку»). Любое действие
         у ДРУГОГО человека: окно уровня ОТПРАВЛЯЕТ снятие досрочно (прежде сброс тихо его отменял —
         решение координатора), «Отменить» у роли гаснет. Само действие при этом выполняется — экран
         не заперт. Человек — по tg_user_id в памяти, не по номеру строки. */
      var L0 = PEOPLE.list || [], tk = null;
      if (a === 'p-open' || a === 'p-out' || a === 'p-outyes' || a === 'p-card') tk = Number(arg);
      else if (a === 'p-lvask') tk = Number(String(arg).split('.')[0]);
      else if (a === 'p-ask') tk = L0.findIndex(function (x) { return x.roles.some(function (r) { return r.id === Number(arg); }); });
      else if (a === 'p-give' || a === 'p-role' || a === 'p-close') tk = PEOPLE.open;
      else if (a === 'p-outkeep') tk = PEOPLE.out;
      var tu = tk !== null && L0[tk] ? L0[tk].uid : null;
      if (a !== 'p-keep' && a !== 'p-back') {
        if (PEOPLE.back && tu !== PEOPLE.back.uid) PEOPLE.back = null;
        var lvk = PEOPLE.lvAsk !== null ? Number(String(PEOPLE.lvAsk).split('.')[0]) : null;
        if (lvk !== null && (a === 'p-lvask' || !L0[lvk] || tu !== L0[lvk].uid)) lvSend(PEOPLE.lvAsk);
      }
      if (a === 'p-reload') { loadRoster(); render(); return; }
      if (a === 'p-give') {
        // Ключ строки — «роль» или «роль:направление». Приставку `p-` разобрал doAction,
        // здесь режется ПЕРВОЕ двоеточие остатка; у общей роли его нет вовсе.
        var cutg = String(arg).indexOf(':');
        grantSend(cutg === -1 ? arg : arg.slice(0, cutg), cutg === -1 ? null : Number(arg.slice(cutg + 1)));
        return;
      }
      // крестик у роли — снятие СРАЗУ (v91); отмена — `p-back` на итоге
      if (a === 'p-ask') { revokeSend(Number(arg)); return; }
      if (a === 'p-back') { backSend(); return; }
      if (a === 'p-lvrevoke') return;               // живой режим шлёт уровень сам (`lvSend`); здесь — только демонстрация
      if (a === 'p-outyes') { if (PEOPLE.out === Number(arg)) outSend(Number(arg)); return; }
      // сброс карточки НЕ гасит «Отменить» у той же карточки: итог с отменой живёт, пока не выбрана
      // ДРУГАЯ (слово владельца) — а «+ ответственность» у своей это не другая (back-gone)
      var keepDone = PEOPLE.back && PEOPLE.done && PEOPLE.done.uid === PEOPLE.back.uid ? PEOPLE.done : null;
      // Раскрыть ЭТУ карточку: прежняя сворачивается, и вместе с ней уходит её состояние.
      // ⚠ v91: окно отмены уровня прежней карточки уходит ОТПРАВКОЙ (выше, «уход с карточки»), а не
      // закрывается без неё, как было: слово владельца «отмена активна, пока не выбрали другую
      // карточку» — значит, выбрав другую, человек снятие подтвердил, а не отменил. Повторное нажатие
      // по той же карточке свёртки НЕ даёт: владелец просил «по клику разворачиваются».
      if (a === 'p-card') { var kc = Number(arg); if (PEOPLE.card !== kc) { peopleReset(); PEOPLE.card = kc; } }
      // Минус живёт и в СВЁРНУТОЙ строке, поэтому вопрос об исключении обязан её раскрыть:
      // иначе `PEOPLE.out` стоял бы у карточки, которая вопроса не рисует.
      if (a === 'p-out') { var ko = Number(arg); peopleReset(); PEOPLE.card = ko; PEOPLE.out = ko; }
      if (a === 'p-outkeep') PEOPLE.out = null;
      if (a === 'p-open') { var ko2 = Number(arg); peopleReset(); PEOPLE.card = ko2; PEOPLE.open = ko2; }
      if (a === 'p-close') peopleReset();
      if (keepDone && PEOPLE.back && !PEOPLE.done) PEOPLE.done = keepDone;
      // `p-role` больше не ВЫБИРАЕТ, а раскрывает направления, и спрашивается только у
      // DIR_ROLES: у роли без направления раскрывать нечего, а состояние, которое ничего не
      // рисует, не заводится. Второе нажатие складывает обратно — у указателя это его
      // единственный обратный ход, и `aria-expanded` в разметке обещает ровно это.
      if (a === 'p-role' && DIR_ROLES.indexOf(arg) !== -1) PEOPLE.role = PEOPLE.role === arg ? '' : arg;
      // уровень: только живой у этого человека. Открытое окно уже отправлено выше — второе нажатие
      // не молчит и не ждёт (прежде: «Идёт снятие…», v86)
      if (a === 'p-lvask') {
        var lm = /^(\d+)\.(\w+)$/.exec(arg), lp = lm && PEOPLE.list && PEOPLE.list[Number(lm[1])];
        if (!lp || lp.lvKeys.indexOf(lm[2]) === -1) return;
        lvAskStart(arg);
      }
      if (a === 'p-keep') { undoStop(); PEOPLE.lvAsk = null; }
      haptic(); peopleRedraw(before);
      // раскрытая форма — в вид: иначе она открылась бы за нижним краем
      var f = a === 'p-open' && document.querySelector('[data-person="' + PEOPLE.open + '"]');
      if (f && f.scrollIntoView) f.scrollIntoView({ block: 'start' });
      return;
    }
    if (a === 'shift-open') { shiftAct(true); return; }
    if (a === 'shift-ask') { SHIFT_ASK = true; render(); return; }
    if (a === 'shift-keep') { SHIFT_ASK = false; render(); return; }
    if (a === 'shift-close') { shiftAct(false); return; }
    if (a === 'q-ask') { CANCEL_ASK = Number(arg); render(); return; }
    if (a === 'q-keep') { CANCEL_ASK = null; render(); return; }
    if (a === 'q-cancel') { setState(Number(arg), 'cancelled'); return; }
    if (a === 'order-make' || a === 'order-ready' || a === 'order-serve') {
      var ord = orderById(arg);
      if (ord) {
        ord.state = a === 'order-make' ? 'making' : a === 'order-ready' ? 'ready' : 'served';
        if (DATA.bar.mine && DATA.bar.mine.id === ord.id) DATA.bar.mine.state = ord.state;
        haptic('ok');
        FLASH = { text: ord.id + ' · ' + OSTATE[ord.state].label,
                  note: 'Гость видит это у себя в заказе. В демонстрации — только в этой вкладке.' };
      }
      render(); return;
    }
    if (a === 'close-shift') {
      haptic('ok');
      FLASH = { text: 'Смена закрыта',
                note: 'Правок в закрытой смене не бывает: ошибка исправляется отменой строки и новой записью. В демонстрации отчёт никуда не ушёл.' };
      render(); return;
    }
    if (a === 'add-expense') {
      var ew = val('e-what') || 'Без названия';
      var es = parseInt(val('e-sum'), 10) || 0;
      DATA.bar.expenses.unshift({ what: ew, cat: EXP.cat, pay: EXP.pay, sum: es,
                                  when: 'сегодня · ' + DATA.member.name });
      DATA.bar.month.spend += es;
      EXP_FIELDS.forEach(function (f) { delete FORM.v[f]; });
      haptic('ok');
      FLASH = 'Затрата записана: ' + ew + ' · ' + money(es) + ' ฿';
      render(); return;
    }

  {
    if (a === 'wk-prev' && WK.off > 0) { WK.off -= 1; WK.day = null; haptic(); render(); return; }
    if (a === 'wk-next') { WK.off += 1; WK.day = null; haptic(); render(); return; }
    if (a === 'wk-today') { WK.off = 0; WK.day = null; haptic(); render(); return; }
    if (a === 'wk-day' && /^\d{4}-\d\d-\d\d$/.test(arg)) { WK.day = arg; haptic(); render(); return; }
    if (a === 'seg' && SEGS.some(function (s) { return s[0] === arg; })) {
      SEG = arg; haptic(); render(); return;
    }
    if (a === 'retry-events') { loadEvents(); render(); return; }
    if (a === 'retry-hist') { loadHistory(); render(); return; }
    if (a === 'thank' && LIVE) { TH = { id: arg, amount: '', busy: false, err: '', sent: 0 }; go('thanks', arg); return; }
    if (a === 'thank-send') { sendThanks(); return; }
    if (a === 'thank-back') { go('event', TH.id); return; }
    if (a === 'recipe' && LIVE) { go('barRecipe', arg); return; }

    if (a === 'create-event' && LIVE) { createEvent(); return; }

    if (a === 'create-event') {
      var title = (val('f-title') || 'Без названия');
      var time = val('f-time') || '19:00';
      var seats = parseInt(val('f-seats'), 10) || 12;
      var price = parseInt(val('f-price'), 10) || 0;
      var id = 'own-' + Date.now();
      DATA.myEvents.unshift({ id: id, title: title, day: dayWord(val('f-date')), time: time,
        signed: 0, of: seats, kind: FORM.kind, price: price, state: 'опубликовано' });
      DATA.events.push({ id: id, title: title, day: dayWord(val('f-date')), time: time,
        part: partOf(time), until: '', master: DATA.member.name, seats: seats, of: seats,
        kind: FORM.kind, price: price, filmed: FORM.filmed,
        about: val('f-about') || 'Описание не заполнено.' });
      FLASH = 'Мероприятие «' + title + '» опубликовано в афише';
      haptic('ok');
      FORM = { kind: 'paid', filmed: false, place: null, v: {} };
      dropDraft();
      go('organizer');
      return;
    }

    if (a === 'cancel-event') {
      FLASH = 'Мероприятие отменено. Запись об отмене осталась.';
      haptic('warn');
      go('organizer');
      return;
    }

    if (a === 'create-service') {
      var st = val('s-title') || 'Без названия';
      DATA.myServices.unshift({ title: st, about: val('s-about') || '—',
        price: val('s-price') || '[цена]', state: 'на проверке' });
      DATA.services.push({ title: st, about: val('s-about') || '—' });
      FLASH = 'Услуга «' + st + '» отправлена директору на проверку';
      haptic('ok');
      go('partner');
      return;
    }

    if (a === 'accept-consent' && LIVE) {
      api('POST', '/me/consent', { data: true }).then(function (r) {
        if (r.status === 200 && r.data && r.data.consent_data_at) {
          DATA.consent = true;
          haptic('ok');
          FLASH = { text: 'Согласие принято', note: 'Клуб записал его с датой.' };
          go(homeOf());
        } else {
          haptic('warn');
          FLASH = { text: 'Согласие не записано',
                    note: r.status ? 'Сервер ответил кодом ' + r.status + '. Попробуйте ещё раз.' : 'Сервер не ответил. Попробуйте ещё раз.' };
          render();
        }
      });
      return;
    }
    if (a === 'accept-consent') {
      giveConsent();
      haptic('ok');
      FLASH = { text: 'Согласие принято',
                note: 'Это демонстрация, поэтому отметка хранится только в этом браузере. В Telegram её хранит клуб — с датой.' };
      go(homeOf());
      return;
    }
    if (a === 'reset-consent') { if (LIVE) return; dropConsent(); go('consent'); return; }
    if (a === 'retry') { boot(); return; }
    if (a === 'bal-toggle') { BAL.shown = !BAL.shown; render(); return; }
    // реквизиты — с сервера по подписи; в демонстрации к серверу не ходим
    if (a === 'tu-online') { TUP.online = true; TUP.hist = false; TUP.err = ''; if (LIVE) loadRequisites('promptpay'); render(); return; }
    if (a === 'tu-send') {
      if (!LIVE) {   // демонстрация к серверу не ходит (как DEMO_SENDS)
        FLASH = { text: 'Это демонстрация', note: 'В Telegram это ушло бы на сервер клуба. Здесь ничего не отправлено и не записано.' };
        haptic('warn'); render(); return;
      }
      sendTopup(); return;
    }
    if (a === 'tu-retry') { loadTopups(); render(); return; }
    if (a === 'tu-hist') { TUP.hist = true; TUP.online = false; render(); return; }
    // просьба о вступлении: до входа LIVE ложно, поэтому без «&& LIVE»
    if (a === 'join-retry') { loadJoin(); render(); return; }
    if (a === 'join-pay' && JOIN_PAY[arg]) { JOIN.pay = arg; loadRequisites(arg); render(); return; }
    if (a === 'join-req-retry') { delete JOIN.img[JOIN.pay]; loadRequisites(JOIN.pay); render(); return; }
    if (a === 'join-again') { JOIN.again = true; JOIN.err = ''; render(); return; }
    if (a === 'join-send') { sendJoin(); return; }
    // тетрадь клуба — браузером по токену на час: заголовка подписи браузер не шлёт
    // тетрадь — внутри приложения, со стрелкой назад на экран просьбы (слово владельца 28.10)
    if (a === 'join-about') { go('joinAbout'); return; }
    if (a === 'about-retry') { loadAbout(); render(); return; }
    if (a === 'retry-pass') { loadPass(); render(); return; }
    if (a === 'mr-send' && LIVE) { sendRequest(arg); return; }
    if (a === 'mr-retry' && LIVE) { loadTiers(); render(); return; }
    if (a === 'mr-pick' && LIVE) { MREQ.pick = arg; render(); return; }
    if (a === 'mq-ok' && mayRequests()) { decideRequest(Number(arg), 'approved'); return; }
    if (a === 'mq-ask' && mayRequests()) { MREQS.ask = Number(arg); MREQS.note = ''; render(); return; }
    if (a === 'mq-keep') { MREQS.ask = 0; MREQS.note = ''; render(); return; }
    if (a === 'mq-no' && mayRequests()) { decideRequest(Number(arg), 'rejected'); return; }
    if (a === 'mq-retry' && mayRequests()) { loadRequests(); render(); return; }
    // заявки на доступ: согласие — только вторым нажатием (j-ok спрашивает, j-yes решает)
    if (a === 'j-ok' && mayPeople()) { JOINQ.ok = Number(arg); JOINQ.no = 0; JOINQ.err = ''; render(); return; }
    if (a === 'j-yes' && mayPeople() && JOINQ.ok === Number(arg)) { decideJoin(Number(arg), 'approved'); return; }
    if (a === 'j-ask' && mayPeople()) { JOINQ.no = Number(arg); JOINQ.ok = 0; JOINQ.note = ''; JOINQ.err = ''; render(); return; }
    if (a === 'j-keep') { JOINQ.ok = 0; JOINQ.no = 0; JOINQ.note = ''; render(); return; }
    if (a === 'j-no' && mayPeople() && JOINQ.no === Number(arg)) { decideJoin(Number(arg), 'rejected'); return; }
    if (a === 'j-retry' && mayPeople()) { loadJoinQueue(); render(); return; }
    if (a === 'tq-retry' && mayTopups()) { loadTopupQueue(); render(); return; }
    if (a === 'tq-open' && mayTopups()) { go('topupReq', Number(arg)); return; }
    if (a === 'tq-shot' && mayTopups()) { delete TOPQ.shot[Number(arg)]; topupShot(Number(arg)); render(); return; }
    if (a === 'tq-ok' && mayTopups() && !TOPQ.busy) { decideTopup(Number(arg), 'approved'); return; }   // без вопроса (#695)
    if (a === 'tq-ask' && mayTopups() && !TOPQ.busy) { TOPQ.step = 'no'; TOPQ.err = ''; render(); return; }
    if (a === 'tq-keep' && !TOPQ.busy) { TOPQ.step = ''; TOPQ.err = ''; render(); return; }
    // шаг 3: мастера — на ручках сервера (v109)
    if (a === 'ms-open') { go('masterReq', arg); return; }
    if (a === 'ms-ev') { go('masterEvent', arg); return; }
    if (a.slice(0, 4) === 'msf-' || a === 'ms-send') {
      // набранное не теряется при перерисовке нажатием чипа
      msfGrab();
      MSF.err = '';
    }
    if (a === 'ms-apply') { MSF.err = ''; go('masterApply'); return; }
    if (a === 'msf-day') { MSF.day = Number(arg); render(); return; }
    if (a === 'msf-busy-retry') { MSB.key = ''; render(); return; }
    if (a === 'msf-plus' && 2 + MSF.extra < MS_MAX_H && MR.price[3 + MSF.extra] <= msBalance()) {
      MSF.extra += 1; loadPrice(3 + MSF.extra); render(); return;
    }
    if (a === 'msf-minus' && MSF.extra > 0) { MSF.extra -= 1; render(); return; }
    if (a === 'ms-send') { sendMaster(); return; }
    if (a === 'rnw-plus' && RNW.months < RNW_MAX && !UNDO.key) { RNW.months += 1; RNW.err = ''; render(); return; }
    if (a === 'rnw-minus' && RNW.months > 1 && !UNDO.key) { RNW.months -= 1; RNW.err = ''; render(); return; }
    if (a === 'rnw-retry') { RNW.key = ''; render(); return; }
    // окно отмены ДО отправки (E59b) — общая функция снятия уровня; ключ несёт номер слота и число месяцев
    if (a === 'rnw-go' && RNW.prev && RNW.prev.enough && !RNW.busy && msOwnSlot()) {
      RNW.err = ''; undoStart('renew:' + msOwnSlot().id + ':' + RNW.months, renewSend, { leave: 'cancel' }); render(); return;
    }
    if (a === 'rnw-keep') { if (UNDO.key && /^renew:/.test(UNDO.key)) undoStop(); render(); return; }
    if (a === 'ms-yes' && mayMasters()) { decideMaster(Number(arg), 'approved'); return; }
    // форму отказа видит и витрина (опись снимет её состояние); отправка вне Telegram не уходит — decideMaster
    if (a === 'ms-ask' && (mayMasters() || !LIVE) && !MR.busy) { MR.ask = Number(arg); MR.note = ''; MR.qErr = ''; render(); return; }
    if (a === 'ms-keep' && !MR.busy) { MR.ask = 0; MR.qErr = ''; render(); return; }
    if (a === 'ms-no' && mayMasters()) { decideMaster(Number(arg), 'rejected'); return; }
    if (a === 'ms-hide' && mayMasters()) { slotToggle(Number(arg), false); return; }
    if (a === 'ms-show' && mayMasters()) { slotToggle(Number(arg), true); return; }
    if (a === 'ms-retry-mine') { loadMineMaster(); render(); return; }
    if (a === 'ms-retry-q' && mayMasters()) { loadMasterQueue(); render(); return; }
    if (a === 'pay-retry' && mayMasters()) { loadPayouts(); render(); return; }
    if (a === 'pay-open') { go('payout', Number(arg)); return; }
    if (a === 'pay-go' && mayMasters()) { sendPayout(Number(arg)); return; }
    if (a === 'ms-retry-s' && mayMasters()) { loadSlots(); render(); return; }
    if (a === 'ms-retry-places') { loadPlaces(); render(); return; }
    if (a === 'tq-no' && mayTopups()) { if (TOPQ.step === 'no') decideTopup(Number(arg), 'rejected'); return; }
    if (a === 'j-shot' && mayPeople()) { delete JOINQ.shot[Number(arg)]; joinShot(Number(arg)); render(); return; }

    if (a === 'scan') { scanPass(); return; }
    if (a === 'book' && LIVE) { bookEvent(arg); return; }
    if (a === 'event-edit' && LIVE) { go('eventEdit', arg); return; }
    if (a === 'edt-save' && LIVE) { editSave(); return; }
    if (a === 'edt-ask' && typeof EDT.ask === 'boolean' && !EDT.busy) { editGrab(); EDT.ask = !EDT.ask; EDT.err = ''; haptic(); render(); return; }
    if (a === 'event-cancel' && LIVE) { EV_ASK = true; EV_ERR = ''; haptic(); render(); return; }
    if (a === 'event-cancel-yes' && LIVE) { cancelEvent(arg); return; }
    if (a === 'event-cancel-no') { EV_ASK = false; haptic(); render(); return; }
    if (a === 'book-cancel' && LIVE) { BOOK_ASK = true; BOOK_ERR = ''; haptic(); render(); return; }
    if (a === 'book-cancel-yes' && LIVE) { cancelBooking(arg); return; }
    if (a === 'book-cancel-no') { BOOK_ASK = false; haptic(); render(); return; }
    if (a === 'book')  { haptic('ok'); FLASH = 'Вы записаны'; go('bookings'); return; }
  }
}

/* Съёмка напитка и фото чека. Отправить снимок пока некуда — приёма снимков на сервере ещё нет;
   честный ответ лучше вида работающей отправки. */
document.addEventListener('input', function (ev) {
  if (ev.target && ev.target.id === 'p-find') { PEOPLE.find = ev.target.value; peopleFilter(); }
  if (ev.target && ev.target.id === 'd-note') MREQS.note = ev.target.value;
  if (ev.target && ev.target.id === 'join-said') JOIN.said = ev.target.value;
  // сумма пополнения — в память формы, кнопка отправки без перерисовки (фокус не теряется)
  if (ev.target && ev.target.id === 'tu-amount') {
    TUP.amount = ev.target.value;
    var b = document.getElementById('tu-send');
    if (b) b.disabled = tupAmount(TUP.amount) === null || !TUP.file || TUP.busy || JOIN.img.promptpay === 'fail';
  }
});

// Касса: набранное сразу в память формы — перерисовка от выбора способа или
// отказ сервера иначе стёрли бы сумму и срок.
document.addEventListener('input', function (ev) {
  var t = ev.target, f = t && { 'tp-code': 'code', 'tp-months': 'months', 'tp-amount': 'amount' }[t.id];
  if (f) TP[f] = t.value;
});

document.addEventListener('change', function (ev) {
  var t = ev.target;
  // смена даты сразу показывает, в чей отчёт уйдёт запись
  if (t && t.id === 'b-date' && current === 'barMoney' && !BOOK.busy) { bookGrab(); render(); return; }
  if (t && t.id === 'join-file') { if (t.files && t.files[0]) attachReceipt(t.files[0], JOIN, 'noAccess'); return; }
  if (t && t.id === 'tu-file') { if (t.files && t.files[0]) attachReceipt(t.files[0], TUP, 'topup'); return; }
  if (!t || (t.id !== 'shot-file' && t.id !== 'bill-file')) return;
  var f = t.files && t.files[0];
  if (!f) return;
  haptic('ok');
  FLASH = { text: (t.id === 'shot-file' ? 'Снято: ' : 'Чек: ') + f.name,
            note: 'Отправить пока некуда: приёма снимков на сервере ещё нет, снимок остался в телефоне. Потом он уйдёт в клуб: по съёмке ИИ-команда собирает карточку меню, по чеку — подтверждение затраты.' };
  render();
});

/* Фото гостя не загрузилось — пустой кружок выглядел бы как «так и есть».
   Бармену нужно знать, что сверять не по чему. error не всплывает, поэтому
   ловим на погружении. */
document.addEventListener('error', function (ev) {
  var img = ev.target;
  if (!img || img.tagName !== 'IMG' || !img.classList.contains('avatar')) return;
  var span = document.createElement('span');
  span.className = 'avatar';
  span.textContent = '?';
  span.title = 'фото не загрузилось';
  var note = document.createElement('span');
  note.className = 'small';
  note.textContent = 'фото не загрузилось';
  img.parentNode.insertBefore(note, img.nextSibling);
  img.replaceWith(span);
}, true);

document.getElementById('back').addEventListener('click', function () {
  goBack();
});
/* Солнышко — только у богов (god, god_mentor), решение владельца 20.10:
   у остальных переключение работало некорректно. Кнопки нет в разметке
   вовсе: её создаёт render(), когда /me принёс божественную роль, и убирает,
   когда нет. Скрытая стилем осталась бы нажимаемой из консоли. Вне Telegram
   (демонстрация) — тоже нет: там некому быть богом. */
var GODS = ['god', 'god_mentor'];
function isGod() {
  return LIVE && SELF.some(function (r) { return GODS.indexOf(r) !== -1; });
}
var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>';
function sunButton() {
  var el = document.getElementById('demo-btn');
  if (isGod() && !el) {
    el = document.createElement('button');
    el.type = 'button'; el.className = 'icon-btn'; el.id = 'demo-btn';
    el.setAttribute('aria-label', 'Просмотр');
    el.innerHTML = SUN;
    el.addEventListener('click', function () { go('demo'); });
    document.getElementById('bar').appendChild(el);
  } else if (!isGod() && el) {
    el.parentNode.removeChild(el);
  }
}

