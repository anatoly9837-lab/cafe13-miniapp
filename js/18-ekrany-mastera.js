Object.assign(SCREENS, {

  /* ── шаг 3: арт-директор и мастера (кадры E55b, E55v, E55g, E55e, E55d; Cafe13KPG#534) — на ручках сервера.
     Вход — группой в «Управлении» (слово владельца: «во вкладке управление — управление этими ивентами»). */
  masters: function () {
    if (LIVE && !mayMasters()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Слотами и мастерами управляет арт-директор.</span></div></div>';
    var entry = function (go, what, sub, mark) {
      return '<button type="button" class="listitem" ' + go + '><span class="grow"><b>' + what + '</b>' +
        '<span class="small">' + sub + '</span></span>' + (mark || '') + svg(ICON.chev, 'chev') + '</button>';
    };
    // число ждущих > 0 — пометкой на плашке (#769, тот же вид, что «всё что больше 0» владельца); до ответа — не ноль
    var n = MR.pending;
    return (FLASH ? flash() : '') + '<div class="group"><span class="label">Слоты и мастера</span>' +
      entry('data-go="masterReqs"', 'Заявки в мастера', waitSub(n, 'Кто просится в мастера'), waitMark(n)) +
      entry('data-go="masterEvents"', 'Ивенты', 'выключить или включить в афише') +
      entry('data-go="masterList"', 'Мастера', 'их слоты в расписании') +
      /* Входов РОВНО ТРИ: «выдать» слот или ответственность нет — всё через заявку (слова владельца 29.10.2026:
         «арт директор не может начать / он может только согласовать») */
    '</div>';
  },

  // E55v. Ждущая строка — вход на заявку (как у очереди пополнений E56)
  masterReqs: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.q) return MR.qFail ? '<div class="card strong"><h2>Заявки не загрузились</h2><p>' + esc(MR.qFail) + '</p>' +
        '<button type="button" class="btn" data-action="ms-retry-q">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем заявки…</span></div>';
    var sub = function (q) { return msWhen(q) + (q.extra ? ', +' + q.extra + ' ' + msHours(q.extra) : '') + ' · «' + q.title + '» · ' + money(q.amount) + ' ฿'; };
    var row = function (q, box) {
      return '<span class="' + box + '"><b>' + esc(q.who) + '</b><span class="small">' + esc(topupDay(q.iso, true)) + '</span></span>' +
        '<span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span>';
    };
    var wait = MR.q.filter(function (q) { return q.status === 'pending'; });
    var past = MR.q.filter(function (q) { return q.status !== 'pending'; });
    if (!wait.length && !past.length) return (FLASH ? flash() : '') + '<div class="card quiet"><div class="col"><b>Заявок нет</b>' +
      '<span class="small">Здесь появятся заявки членов клуба на статус мастера.</span></div></div>';
    return (FLASH ? flash() : '') +
      (wait.length ? '<div class="group"><span class="label">Ждут решения</span>' + wait.map(function (q) {
        return '<button type="button" class="listitem" data-action="ms-open:' + q.id + '">' + row(q, 'grow') + svg(ICON.chev, 'chev') + '</button>' +
          '<span class="small">' + esc(sub(q)) + '</span>';
      }).join('') + '</div>' : '') +
      (past.length ? '<div class="group"><span class="label">Решённые</span>' + past.map(function (q) {
        return '<div class="card quiet"><div class="row">' + row(q, 'col') + '</div><span class="small">' +
          esc(q.status === 'rejected' ? (q.note ? cap(q.note) + ' · ' : '') + 'деньги возвращены' : sub(q)) + '</span></div>';
      }).join('') + '</div>' : '');
  },

  // E55g. Название и аннотация — ЧТЕНИЕМ: правки заявки у сервера нет, поле ввода обещало бы её
  masterReq: function (id) {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.q) return SCREENS.masterReqs();
    var q = MR.q.filter(function (x) { return x.id === Number(id); })[0];
    if (!q) return '<div class="card quiet"><div class="col"><b>Такой заявки нет</b>' +
      '<span class="small">Вернитесь к заявкам в мастера.</span></div></div>';
    // своя — по номеру заявки в СВОИХ (`/master/requests/mine`): номера человека в очереди нет
    var own = !!(MR.mine && MR.mine.some(function (x) { return x.id === q.id; }));
    var busy = MR.busy ? ' disabled' : '';
    var err = MR.qErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MR.qErr) + '</span></div>' : '';
    return (FLASH ? flash() : '') +
      '<div class="card"><div class="col"><b>' + esc(q.who) + '</b><span class="small">Заявка в мастера · ' + esc(topupDay(q.iso, true)) + '</span></div></div>' +
      '<div class="rows">' +
        '<div><span class="small">День и слот</span><b>' + esc(msWhen(q)) + '</b></div>' +
        '<div><span class="small">Часы сверх двух</span><b>' + esc(q.extra ? '+' + q.extra + ' ' + msHours(q.extra) : 'нет') + '</b></div>' +
        '<div><span class="small">Место и мест</span><b>' + esc(q.place + ' · ' + q.seats) + '</b></div>' +
        '<div><span class="small">Списано</span><b class="num">' + money(q.amount) + ' ฿</b></div></div>' +
      '<div class="card quiet"><div class="col"><b>' + esc(q.title) + '</b>' + (q.about ? '<span class="small">' + esc(q.about) + '</span>' : '') + '</div></div>' +
      err +
      (q.status !== 'pending' ? '<div class="card quiet"><div class="row"><span class="small">Решено ' + esc(topupDay(q.done, true)) + '</span>' +
          '<span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span></div></div>'
      : own ? '<div class="note">' + svg(ICON.info) + '<span>Свою заявку решает другой арт-директор.</span></div>'
      // отказ (#696): форма причины, как у пополнений; почему кнопка не нажимается — строкой у неё (как v123)
      : MR.ask === q.id ? '<div class="field"><label for="ms-note">Почему отказ и что исправить</label>' +
          '<textarea id="ms-note" rows="4" maxlength="500">' + esc(MR.note) + '</textarea>' +
          '<span class="small">Мастер прочтёт это в своей заявке. До 500 знаков.</span></div>' +
        '<button type="button" class="btn" data-action="ms-no:' + q.id + '"' + (MR.busy || !MR.note.trim() ? ' disabled aria-disabled="true"' : ' aria-disabled="false"') +
          ' aria-describedby="ms-why">' + (MR.busy ? 'Отправляем…' : 'Отказать и вернуть деньги') + '</button>' +
        '<span class="small" id="ms-why"' + (MR.note.trim() ? ' hidden' : '') + '>Сначала причина — без неё мастер не узнает, что исправить.</span>' +
        '<button type="button" class="btn quiet" data-action="ms-keep"' + busy + '>Назад</button>'
      : '<button type="button" class="btn" data-action="ms-yes:' + q.id + '"' + busy + '>' + (MR.busy ? 'Отправляем…' : 'Согласовать') + '</button>' +
        '<span class="small">Ивент сразу встанет в афишу. Выключить его можно в «Ивентах».</span>' +
        // кадр E55ж (Cafe13KPG#726): короткий вход «Отказать», а возврат денег назван в точке выбора подписью;
        // «…и вернуть деньги» стоит на кнопке ОТПРАВКИ — там, где возврат случается
        '<button type="button" class="btn quiet" data-action="ms-ask:' + q.id + '"' + busy + '>Отказать</button>' +
        '<span class="small">Деньги вернутся мастеру на счёт.</span>');
  },

  // E55e. Единица — СЛОТ (снимок master-slots), выключенный не прячется: иначе включить его негде
  masterEvents: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.slots) return MR.sFail ? '<div class="card strong"><h2>Ивенты не загрузились</h2><p>' + esc(MR.sFail) + '</p>' +
        '<button type="button" class="btn" data-action="ms-retry-s">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем ивенты…</span></div>';
    var busy = MR.busy ? ' disabled' : '';
    var err = MR.sErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MR.sErr) + '</span></div>' : '';
    if (!MR.slots.length) return (FLASH ? flash() : '') + err + '<div class="card quiet"><div class="col"><b>Ивентов мастеров нет</b>' +
      '<span class="small">Они появятся, когда вы согласуете заявку в мастера.</span></div></div>';
    return (FLASH ? flash() : '') + err + '<div class="group"><span class="label">Ивенты мастеров</span>' + MR.slots.map(function (e) {
      return '<div class="card"><div class="row"><button type="button" class="col tap" data-action="ms-ev:' + e.id + '"><b>' + esc(e.title) + '</b>' +
        '<span class="small">' + esc(msWhen(e) + ' · ' + e.who + (e.on ? '' : ' · выключено, в афише не видно')) + '</span></button>' +
        '<button type="button" class="btn mini' + (e.on ? '' : ' quiet') + '" data-action="' + (e.on ? 'ms-hide:' : 'ms-show:') + e.id + '"' + busy + '>' +
          (e.on ? 'Выключить' : 'Включить') + '</button>' +
      '</div></div>';
    }).join('') + '</div>';
  },

  // экран слота: только то, что отдаёт сервер (снимок master-slots). «Коротко для афиши» у слота сервер НЕ отдаёт
  masterEvent: function (id) {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.slots) return SCREENS.masterEvents();
    var e = MR.slots.filter(function (x) { return x.id === Number(id); })[0];
    if (!e) return '<div class="card quiet"><div class="col"><b>Такого ивента нет</b>' +
      '<span class="small">Вернитесь к ивентам мастеров.</span></div></div>';
    var busy = MR.busy ? ' disabled' : '';
    return (FLASH ? flash() : '') +
      (MR.sErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MR.sErr) + '</span></div>' : '') +
      '<div class="card"><div class="col"><b>' + esc(e.title) + '</b></div></div>' +
      '<div class="rows">' +
        '<div><span class="small">День и время</span><b>' + esc(msWhen(e)) + '</b></div>' +
        '<div><span class="small">Место</span><b>' + esc(e.place) + '</b></div>' +
        '<div><span class="small">Ведёт</span><b>' + esc(e.who) + '</b></div>' +
        '<div><span class="small">В афише</span><b>' + (e.on ? 'видно' : 'выключено, не видно') + '</b></div>' +
        '<div><span class="small">Недель впереди</span><b class="num">' + (e.weeksOn + e.weeksOff) + '</b></div></div>' +
      (e.live ? '' : '<div class="note">' + svg(ICON.info) + '<span>Членство мастера сейчас не действует.</span></div>') +
      '<button type="button" class="btn' + (e.on ? '' : ' quiet') + '" data-action="' + (e.on ? 'ms-hide:' : 'ms-show:') + e.id + '"' + busy + '>' +
        (e.on ? 'Выключить' : 'Включить') + '</button>';
  },

  /* E54b + E54i одним экраном (в живом прокрутка есть). Время — из списка, занятость проверит сервер (вариант «б»);
     место — из `GET /places` (только `active`), число мест — поле: оба требует схема (`events.seats NOT NULL`,
     место у недели обязательно), а не перечень владельца */
  masterApply: function () {
    if (LIVE && DATA.role === 'guest') return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Мастером становится член клуба.</span></div></div>';
    if (msIsMaster()) return '<div class="card"><div class="col"><b>Вы мастер</b>' +
      '<span class="small">Новая заявка не нужна: слот продлевается оплатой.</span></div></div>';
    var last = MR.mine && MR.mine[0];
    if (last && last.status === 'pending') return '<div class="card quiet"><div class="col"><b>Заявка уже ждёт решения</b>' +
      '<span class="small">Вторую не подать, пока арт-директор не ответил на первую.</span></div></div>';
    var h = 2 + MSF.extra, bal = msBalance(), p = MR.price[h], pNext = MR.price[h + 1], base = MR.price[2];
    var top = h >= MS_MAX_H, more = !top && typeof pNext === 'number' && pNext <= bal;
    var chips = function (act, list, on) {
      return '<div class="chips">' + list.map(function (x) {
        return '<button type="button" class="chip' + (x[0] === on ? ' on' : '') + '" data-action="' + act + ':' + x[0] + '" aria-pressed="' + (x[0] === on) + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div>';
    };
    var place = EV_PLACES ? (msPlace() ? '<b>' + esc(MS_PLACE) + '</b>' : '<span class="small">Места «' + esc(MS_PLACE) + '» нет среди открытых мест клуба</span>')
      : EV_PLACES_STATE === 'loading' || !EV_PLACES_STATE ? '<span class="small">Загружаем место…</span>'
      : '<div class="row"><span class="small">' + esc(EV_PLACES_STATE) + '</span><button type="button" class="btn quiet" data-action="ms-retry-places">Повторить</button></div>';
    if (msPlace()) loadBusy();
    var B = MSB.data, clash = B && B.fits === false;
    var why = MR.busy ? '' : typeof p !== 'number' ? (p === null ? 'Цену не удалось узнать у сервера.' : 'Узнаём цену…')
      : p > bal ? 'Не хватает ' + money(p - bal) + ' ฿ на счёте.' : EV_PLACES && !msPlace() ? 'Места «' + MS_PLACE + '» нет.' : !EV_PLACES ? 'Загружаем место…'
      : clash ? 'Выбранное время пересекается с занятым — выберите другое.' : '';
    // занятость: даты месяца, занятое в каждую, и пересечение выбранного времени — ДО отправки
    var busy = !msPlace() ? '' : !B ? (MSB.fail ? '<div class="row"><span class="small">Занятость не загрузилась: ' + esc(MSB.fail) +
          ' Отправить можно — пересечение проверит сервер.</span><button type="button" class="btn quiet" data-action="msf-busy-retry">Повторить</button></div>'
        : '<span class="small">Смотрим занятость…</span>')
      : !B.dates.length ? '<span class="small">В этом месяце недель для слота не осталось.</span>'
      : '<div class="rows">' + B.dates.map(function (x) {
          var used = x.busy.length ? x.busy.map(function (b) { return b.from + '–' + b.to + ' «' + b.title + '»'; }).join(', ') : 'свободно';
          return '<div><span class="small">' + esc(x.day) + '</span><b' + (x.conflict ? ' style="color:var(--clay-ink)"' : '') + '>' +
            esc(x.conflict ? 'пересекается: ' + x.conflict.starts_label.split(' ').pop() + '–' + x.conflict.ends_label + ' «' + x.conflict.title + '»' : used) + '</b></div>';
        }).join('') + '</div>' +
        '<span class="small">' + (B.fits ? 'Выбранное время свободно на всех ' + B.dates.length + ' датах месяца.' : 'Красным — даты, где выбранное время занято.') + '</span>';
    return (FLASH ? flash() : '') + '<div class="mf">' +
      '<div class="field"><label>День недели</label>' + chips('msf-day', MS_DAY.map(function (d, i) { return [i + 1, d]; }), MSF.day) + '</div>' +
      '<div class="field"><label for="msf-time">Начало</label><select id="msf-time">' + MS_TIMES.map(function (t) {
          return '<option value="' + t + '"' + (t === MSF.time ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Продолжительность</label><div class="counter">' +
        '<button type="button" class="round" data-action="msf-minus"' + (MSF.extra ? '' : ' disabled') + ' aria-label="Меньше">−</button>' +
        '<b class="num">' + h + ' ' + msHours(h) + '</b>' +
        '<button type="button" class="round" data-action="msf-plus"' + (more ? '' : ' disabled') + ' aria-label="Больше">+</button></div>' +
        // «+» гаснет там, где следующий час не покрыт остатком или упёрся в потолок сервера, и причина — рядом
        '<span class="small">' + (top ? 'Больше ' + MS_MAX_H + ' часов в слоте сервер не примет'
          : more ? msSpan(MS_DAY[MSF.day - 1], MSF.time, h) + (typeof pNext === 'number' && typeof p === 'number' ? ' · ещё час — ' + money(pNext - p) + ' ฿' : '')
          : typeof pNext === 'number' ? 'Ещё час — ' + money(pNext) + ' ฿, на счёте ' + money(bal) + ' ฿' : 'Узнаём цену…') + '</span></div>' +
      '<div class="field"><label>Место</label>' + place + '</div>' +
      (busy ? '<div class="field"><label>Занято в этот день недели</label>' + busy + '</div>' : '') +
      '<div class="field"><label for="msf-seats">Мест</label>' +
        '<input id="msf-seats" inputmode="numeric" style="width:92px" value="' + esc(MSF.seats) + '">' +
        '<span class="small">0 — без ограничения</span></div>' +
      '<div class="field"><label for="msf-title">Название ивента</label><input id="msf-title" maxlength="200" value="' + esc(MSF.title) + '"></div>' +
      '<div class="field"><label for="msf-about">Коротко для афиши</label><textarea id="msf-about" rows="3" maxlength="' + MS_ABOUT + '">' + esc(MSF.about) + '</textarea></div>' +
      '<div class="rows">' +
        '<div><span class="small">Статус мастера · 2 часа</span><b class="num">' + (typeof base === 'number' ? money(base) + ' ฿' : '…') + '</b></div>' +
        (MSF.extra ? '<div><span class="small">Ещё ' + MSF.extra + ' ' + msHours(MSF.extra) + '</span><b class="num">' +
          (typeof p === 'number' && typeof base === 'number' ? money(p - base) + ' ฿' : '…') + '</b></div>' : '') +
        '<div><span class="small">Спишется</span><b class="num">' + (typeof p === 'number' ? money(p) + ' ฿' : '…') + '</b></div></div>' +
      (MSF.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MSF.err) + '</span></div>' : '') +
      '<button type="button" class="btn" data-action="ms-send"' + (why || MR.busy ? ' disabled' : '') + '>' + (MR.busy ? 'Отправляем…' : 'Отправить заявку') + '</button>' +
      (why ? '<span class="small">' + esc(why) + '</span>' : '') +
    '</div>';
  },

  // E59 / E59b: продление. Окно отмены — общая полоса `.undo`, как у снятия уровня
  masterRenew: function () {
    if (LIVE && DATA.role === 'guest') return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Продлевает мастер — член клуба.</span></div></div>';
    if (!MR.mine) return MR.mineState && MR.mineState !== 'loading' && MR.mineState !== 'ok'
      ? '<div class="card quiet"><div class="row"><span class="small">Заявки не загрузились: ' + esc(MR.mineState) + '</span>' +
        '<button type="button" class="btn quiet" data-action="ms-retry-mine">Повторить</button></div></div>'
      : '<div class="card quiet"><span class="small">Загружаем…</span></div>';
    var own = msOwnSlot();
    if (!own) return '<div class="card quiet"><div class="col"><b>Продлевать нечего</b>' +
      '<span class="small">Продление — у согласованного слота мастера.</span></div></div>';
    loadRenewPreview();
    var P = RNW.prev, waiting = UNDO.key && /^renew:/.test(UNDO.key);
    var busy = RNW.busy || waiting ? ' disabled' : '';
    var top = '<div class="card"><div class="col"><b>Статус мастера</b>' +
        '<span class="small">' + (own.paidTill ? 'Оплачено до ' + esc(msTill(own.paidTill)) : 'Оплаченных месяцев нет') + '</span>' +
        '<span class="small">' + esc(MS_DAY[own.weekday - 1] + ', ' + own.start + ' · ' + own.hours + ' ' + msHours(own.hours) + ' · ' + own.place) + '</span>' +
      '</div></div>' +
      '<div class="field"><label>Месяцев</label><div class="counter">' +
        '<button type="button" class="round" data-action="rnw-minus"' + (RNW.months > 1 && !busy ? '' : ' disabled') + ' aria-label="Меньше">−</button>' +
        '<b class="num">' + RNW.months + '</b>' +
        '<button type="button" class="round" data-action="rnw-plus"' + (RNW.months < RNW_MAX && !busy ? '' : ' disabled') + ' aria-label="Больше">+</button></div>' +
        '<span class="small">Подряд, не больше ' + RNW_MAX + ' — это предел ввода</span></div>' +
      (P ? '<div class="rows"><div><span class="small">Спишется</span><b class="num">' + money(P.charged) + ' ฿</b></div>' +
             // окно, а не месяцы (Cafe13KPG#894): с какого дня пойдёт продление и до какого будет оплачено
             '<div><span class="small">Начало</span><b>' + esc(msTill(P.from)) + '</b></div>' +
             '<div><span class="small">Оплачено будет до</span><b>' + esc(msTill(P.till)) + '</b></div></div>'
        // «Посчитать снова», а не «Повторить» (Cafe13KPG#685): повторяется запрос ЦЕНЫ, в слоте ничего не повторяется
        : RNW.prevFail ? '<div class="row"><span class="small">' + esc(rnwSameRefusal() ? 'Цена не пересчитана' : RNW.prevFail) + '</span><button type="button" class="btn quiet" data-action="rnw-retry">Посчитать снова</button></div>'
        : '<span class="small">Считаем у сервера…</span>');
    var err = RNW.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(RNW.err) + '</span></div>' : '';
    // E59b: окно ДО отправки; пока идёт отсчёт, запрос не ушёл
    if (waiting) return (FLASH ? flash() : '') + top + err +
      '<div class="undo"><span class="small">Продлеваем на ' + RNW.months + ' ' + msMonths(RNW.months) + '</span>' +
        '<span class="sec">' + undoLeft() + '</span><button type="button" data-action="rnw-keep">Отменить</button></div>' +
      '<span class="small">Пока идёт отсчёт, деньги не списаны: запрос ещё не ушёл.</span>';
    // почему «Продлить» не нажимается — строкой у самой кнопки (Cafe13KPG#685), связана с ней aria-describedby.
    // Два приговора не склеиваются: недостача — плашкой отказа, как и была; «цены нет» — подписью, как «почему»
    // у «Отправить заявку», а слова отказа остаются дословно в строке предпросмотра и здесь не повторяются
    var why = P ? (P.enough ? '' : '<div class="deny" role="alert" id="rnw-why">' + svg(ICON.info) + '<span>Не хватает ' + money(P.short) + ' ฿ на счёте.</span></div>')
      : RNW.prevFail ? '<span class="small" id="rnw-why">' + (RNW.prevCode >= 400 && RNW.prevCode < 500 ? 'Цена не посчитана: сервер отказал.' : 'Цена не посчитана.') + '</span>' : '';
    if (RNW.busy) why = '';
    return (FLASH ? flash() : '') + top + err +
      '<button type="button" class="btn" data-action="rnw-go"' + (!P || !P.enough || busy ? ' disabled' : '') + (why ? ' aria-describedby="rnw-why"' : '') + '>' + (RNW.busy ? 'Продлеваем…' : 'Продлить') + '</button>' +
      why +
      '<div class="note">' + svg(ICON.info) + '<span>Оплаченный месяц не возвращается. Неоплаченный слот уходит другому мастеру.</span></div>';
  },

  // E55d: мастера и их слоты (снимок master-slots), «слота нет» — `masters_without_slot`. Экрана за строкой нет
  masterList: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.slots) return SCREENS.masterEvents();
    var rows = MR.slots.map(function (e) { return [e.who, msWhen(e) + ' · «' + e.title + '»']; })
      .concat(MR.without.map(function (w) { return [w, 'слота нет']; }));
    if (!rows.length) return '<div class="card quiet"><div class="col"><b>Мастеров нет</b>' +
      '<span class="small">Мастер появляется, когда вы согласуете его заявку.</span></div></div>';
    return '<div class="group"><span class="label">Мастера</span>' + rows.map(function (r) {
      return '<div class="card quiet"><div class="col"><b>' + esc(r[0]) + '</b><span class="small">' + esc(r[1]) + '</span></div></div>';
    }).join('') + '</div>';
  },

  /* ── шаг 11: «Распределить деньги» (кадры E69, E69b, E69v; Cafe13KPG#857) — данные и отправка в 07-mastera.js.
     Плашка ждущего — кнопка к подтверждению; ушедшего — карточка без кнопки: нажимать там нечего. */
  payouts: function () {
    if (LIVE && !mayMasters()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Деньги мероприятий распределяет арт-директор.</span></div></div>';
    if (!PAY.list) return PAY.fail ? '<div class="card strong"><h2>Список не загрузился</h2><p>' + esc(PAY.fail) + '</p>' +
        '<button type="button" class="btn" data-action="pay-retry">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем прошедшие мероприятия…</span></div>';
    if (!PAY.list.length) return (FLASH ? flash() : '') + '<div class="note">' + svg(ICON.info) + '<span>Прошедших мероприятий пока нет. ' +
      'Плашка появится, когда мероприятие кончится: до конца сумма ещё меняется.</span></div>';
    var line = function (what, val) { return '<span class="row"><span class="small">' + what + '</span><b class="num">' + val + '</b></span>'; };
    var shares = function (head, nums) {
      return '<span class="col"><span class="small">' + esc(head) + '</span>' + PAY_KEYS.map(function (k, i) {
        return '<span class="small">' + k[2] + ' ' + payMoney(nums[i]) + '</span>';
      }).join('') + '</span>';
    };
    return (FLASH ? flash() : '') +
      '<span class="small">Гости — те, кто заплатил за вход: запись без оплаты денег не приносит.</span>' +
      PAY.list.map(function (r) {
        var body = '<span class="row"><span class="col"><b>' + esc(r.title) + '</b><span class="small">' + esc(payDay(r.starts, true)) + '</span></span>' +
            (r.may ? '<span class="st wait">ждёт</span>' : '<span class="st ok">распределено</span>') + '</span>' +
          line('Гостей', r.guests) + line('Собрано', payMoney(r.collected)) +
          (r.may ? shares('Доли', r.split) : shares('Ушло ' + payDay(r.at, false), r.out));
        return r.may ? '<button type="button" class="card" data-action="pay-open:' + r.id + '">' + body + '</button>'
                     : '<div class="card">' + body + '</div>';
      }).join('');
  },

  // E69b. Суммы и проценты — присланные сервером; кнопка называет то, что уйдёт (нераспределённый остаток)
  payout: function (id) {
    if (LIVE && !mayMasters()) return SCREENS.payouts();
    if (!PAY.list) return SCREENS.payouts();
    var r = payById(id);
    if (!r) return '<div class="card quiet"><div class="col"><b>Такого мероприятия нет</b>' +
      '<span class="small">Вернитесь к списку прошедших.</span></div></div>';
    var err = PAY.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(PAY.err) + '</span></div>' : '';
    return '<div class="col"><b>' + esc(r.title) + '</b><span class="small">' + esc(payDay(r.starts, false)) + '</span>' +
        '<span class="small">Гости — те, кто заплатил за вход: запись без оплаты денег не приносит.</span></div>' +
      '<div class="rows">' +
        '<div><span class="small">Гостей</span><b class="num">' + r.guests + '</b></div>' +
        '<div><span class="small">Собрано</span><b class="num">' + payMoney(r.collected) + '</b></div>' +
        PAY_KEYS.map(function (k, i) {
          return '<div><span class="small">' + cap(k[2]) + (r.may ? ', ' + r.pct[i] + ' %' : '') + '</span><b class="num">' + payMoney((r.may ? r.split : r.out)[i]) + '</b></div>';
        }).join('') + '</div>' +
      err +
      (r.may ? '<button type="button" class="btn" data-action="pay-go:' + r.id + '"' + (PAY.busy ? ' disabled' : '') + '>' +
          (PAY.busy ? 'Отправляем…' : 'Подтвердить ' + payMoney(r.left)) + '</button>' +
        '<span class="small" style="text-align:center">Деньги уйдут сразу: обратного действия в приложении нет.</span>'
      : '<div class="note">' + svg(ICON.info) + '<span>Делить нечего: собранное ушло ' + esc(payDay(r.at, false)) + '.</span></div>');
  },
});
