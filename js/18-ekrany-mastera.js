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
      // шаг 42 (рецепт 42/masters.md): вторым — очередь карточек чайных мастеров; число до ответа — не ноль
      entry('data-go="teaReqs"', esc(slovo('masters.tea.title')), esc(waitSub(TQ.pending, slovo('masters.tea.sub'))), waitMark(TQ.pending)) +
      entry('data-go="masterEvents"', 'Ивенты', 'выключить или включить в афише') +
      entry('data-go="masterList"', 'Мастера', 'их слоты в расписании') +
      /* Входов четыре, все — согласование: «выдать» слот, ответственность или карточку нет — всё через заявку
         (слова владельца 29.10.2026: «арт директор не может начать / он может только согласовать») */
    '</div>';
  },

  // E55v. Ждущая строка — вход на заявку (как у очереди пополнений E56)
  masterReqs: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.q) return MR.qFail ? '<div class="card strong"><h2>Заявки не загрузились</h2><p>' + esc(MR.qFail) + '</p>' +
        '<button type="button" class="btn" data-action="ms-retry-q">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем заявки…</span></div>';
    var sub = function (q) { return msWhen(q) + (q.at ? '' : ', каждую неделю') + ' · «' + q.title + '» · ' + money(q.amount) + ' ฿'; };
    var row = function (q, box) {
      return '<span class="' + box + '"><b>' + esc(q.who) + '</b><span class="small">' + esc(topupDay(q.iso, true)) + '</span></span>' +
        '<span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span>';
    };
    var wait = MR.q.filter(function (q) { return q.status === 'pending'; });
    var past = MR.q.filter(function (q) { return q.status !== 'pending'; });
    if (!wait.length && !past.length) return (FLASH ? flash() : '') + '<div class="card quiet"><div class="col"><b>Заявок нет</b>' +
      '<span class="small">Здесь появятся букинги членов клуба: один ивент на дату и время.</span></div></div>';
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
      '<div class="card"><div class="col"><b>' + esc(q.who) + '</b><span class="small">Букинг · ' + esc(topupDay(q.iso, true)) + '</span></div></div>' +
      '<div class="rows">' +
        '<div><span class="small">' + (q.at ? 'Дата и время' : 'День и слот') + '</span><b>' + esc(msWhen(q) + (q.at ? '' : ', каждую неделю')) + '</b></div>' +
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
        '<span class="small">Ивент встанет в афишу на эту дату. Выключить его можно в «Ивентах».</span>' +
        // кадр E55ж (Cafe13KPG#726): короткий вход «Отказать», а возврат денег назван в точке выбора подписью;
        // «…и вернуть деньги» стоит на кнопке ОТПРАВКИ — там, где возврат случается
        '<button type="button" class="btn quiet" data-action="ms-ask:' + q.id + '"' + busy + '>Отказать</button>' +
        '<span class="small">Деньги вернутся мастеру на счёт.</span>');
  },

  /* шаг 25 (рецепт 25/withdraw): запрос мастера на вывод. Остаток — `/me` (перечитан на входе), список — свои запросы.
     W2 стоит ВСЕГДА (контроль 5 ТЗ): на одном счёте и доля взноса, и выводится весь остаток (слово владельца 20.11.2026).
     Поле суммы пустое, без подстановки остатка; с остатком сумму клиент не сравнивает — это делает сервер. */
  withdraw: function () {
    if (!mayWithdraw()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Вывод денег просит мастер.</span></div></div>';
    var w2 = '<div class="card quiet"><span class="small">Вывести можно весь остаток счёта. В него входят доли за ваши события, ' +
      'доля вашего членского взноса и пополнения — счёт у них один.</span></div>';
    var bal = '<div class="row"><span class="small">На счёте:</span><b class="num">' + money(DATA.member.balance) + ' ฿</b></div>';
    // без списка своих запросов форма не показывается: мастер подал бы второй вслепую (рецепт, «не загрузилось»)
    // рецепт отказов (ekran/otkazy.md): 403 загрузки — слова сервера .deny → .verbatim на месте списка, без «Повторить»
    if (!WD.list) return '<div class="card">' + bal + '</div>' + w2 + (WD.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(WD.deny) + '</span></div>' : WD.fail
      ? '<div class="card quiet"><div class="col"><b>Запросы не загрузились.</b><span class="verbatim">' + esc(WD.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="wd-retry">Повторить</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем запросы…</span></div>');
    var busy = WD.busy ? ' disabled' : '';
    return '<div class="card">' + bal +
        '<div class="field"><label for="wd-amount">Сколько вывести, ฿</label>' +
          '<input id="wd-amount" inputmode="decimal" autocomplete="off" value="' + esc(WD.amount) + '"></div>' +
        '<button type="button" class="btn" data-action="wd-send"' + busy + '>Попросить вывод</button></div>' +
      w2 +
      '<span class="small">Запрос решает администратор клуба. Приложение записывает запрос и решение; как клуб передаст деньги, оно не решает.</span>' +
      (WD.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(WD.err) + '</span></div>' : '') +
      (!WD.list.length ? '<div class="card quiet"><span class="small">Запросов на вывод ещё не было.</span></div>'
        : '<div class="rows">' + WD.list.map(function (q) {
            return '<div><div class="col"><b class="num">' + money(q.sum) + ' ฿</b>' +
                '<span class="small">' + esc(askedWhen(q.iso, true)) + '</span>' +
                (q.status === 'rejected' && q.answer ? '<span class="small">' + esc(q.answer) + '</span>' : '') +
                (q.status === 'pending' ? '<button type="button" class="btn ghost" data-action="wd-cancel:' + q.id + '"' + busy + '>Отменить запрос</button>' : '') +
              '</div><span class="pill' + WD_PILL[q.status] + '">' + WD_WORD[q.status] + '</span></div>';
          }).join('') + '</div>');
  },

  // E55e. Единица — букинг (снимок master-slots; прошедшие сервер отсеивает), выключенный не прячется: иначе включить его негде
  masterEvents: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.slots) return MR.sFail ? '<div class="card strong"><h2>Ивенты не загрузились</h2><p>' + esc(MR.sFail) + '</p>' +
        '<button type="button" class="btn" data-action="ms-retry-s">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем ивенты…</span></div>';
    var busy = MR.busy ? ' disabled' : '';
    var err = MR.sErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MR.sErr) + '</span></div>' : '';
    if (!MR.slots.length) return (FLASH ? flash() : '') + err + '<div class="card quiet"><div class="col"><b>Ивентов мастеров нет</b>' +
      '<span class="small">Они появятся, когда вы согласуете букинг мастера.</span></div></div>';
    return (FLASH ? flash() : '') + err + '<div class="group"><span class="label">Ивенты мастеров</span>' + MR.slots.map(function (e) {
      return '<div class="card"><div class="row"><button type="button" class="col tap" data-action="ms-ev:' + e.id + '"><b>' + esc(e.title) + '</b>' +
        '<span class="small">' + esc(msWhen(e) + (e.at ? '' : ', каждую неделю') + ' · ' + e.who + (e.on ? '' : ' · выключено, в афише не видно')) + '</span></button>' +
        '<button type="button" class="btn mini' + (e.on ? '' : ' quiet') + '" data-action="' + (e.on ? 'ms-hide:' : 'ms-show:') + e.id + '"' + busy + '>' +
          (e.on ? 'Выключить' : 'Включить') + '</button>' +
      '</div></div>';
    }).join('') + '</div>';
  },

  // экран букинга: только то, что отдаёт сервер (снимок master-slots). «Коротко для афиши» сервер НЕ отдаёт
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
        '<div><span class="small">' + (e.at ? 'Дата и время' : 'День и время') + '</span><b>' + esc(msWhen(e) + (e.at ? '' : ', каждую неделю')) + '</b></div>' +
        '<div><span class="small">Место</span><b>' + esc(e.place) + '</b></div>' +
        '<div><span class="small">Ведёт</span><b>' + esc(e.who) + '</b></div>' +
        '<div><span class="small">В афише</span><b>' + (e.on ? 'видно' : 'выключено, не видно') + '</b></div>' +
        // недели — только у прежнего недельного слота; у букинга ивент один
        (e.at ? '' : '<div><span class="small">Недель впереди</span><b class="num">' + (e.weeksOn + e.weeksOff) + '</b></div>') + '</div>' +
      (e.live ? '' : '<div class="note">' + svg(ICON.info) + '<span>Членство мастера сейчас не действует.</span></div>') +
      '<button type="button" class="btn' + (e.on ? '' : ' quiet') + '" data-action="' + (e.on ? 'ms-hide:' : 'ms-show:') + e.id + '"' + busy + '>' +
        (e.on ? 'Выключить' : 'Включить') + '</button>';
  },

  /* E54b + E54i одним экраном: БУКИНГ — один ивент на дату и время (Cafe13KPG#985). Время — из списка, занятость
     выбранной даты — с сервера ДО отправки; место фиксировано, число мест — поле (`events.seats NOT NULL`). Ждущий
     прежний букинг подаче не мешает: «сколько угодно — каждый по 100 ฿» (слово владельца 20.11.2026) */
  masterApply: function () {
    if (LIVE && DATA.role === 'guest') return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Букает ивент член клуба.</span></div></div>';
    if (!MSF.date) MSF.date = msTomorrow();
    var h = 2 + MSF.extra, bal = msBalance(), p = MR.price[h];
    var top = h >= MS_MAX_H, dateOk = msYmd(MSF.date) && MSF.date >= msToday();
    var place = EV_PLACES ? (msPlace() ? '<b>' + esc(MS_PLACE) + '</b>' : '<span class="small">Места «' + esc(MS_PLACE) + '» нет среди открытых мест клуба</span>')
      : EV_PLACES_STATE === 'loading' || !EV_PLACES_STATE ? '<span class="small">Загружаем место…</span>'
      : '<div class="row"><span class="small">' + esc(EV_PLACES_STATE) + '</span><button type="button" class="btn quiet" data-action="ms-retry-places">Повторить</button></div>';
    if (msPlace() && dateOk) loadBusy();
    // занятость — только той даты, что выбрана сейчас: ответ о прежней дате не показывается
    // в витрине занятость — демо-набора, без ключа запроса (вне Telegram сервер не спрашивается)
    var B = dateOk && (MR.demo || MSB.key.indexOf('|' + MSF.date + '|') > 0) ? MSB.data : null, clash = B && B.fits === false;
    var why = MR.busy ? '' : !dateOk ? 'Выберите дату — сегодня или позже.'
      : typeof p !== 'number' ? (p === null ? 'Цену не удалось узнать у сервера.' : 'Узнаём цену…')
      : p > bal ? 'Не хватает ' + money(p - bal) + ' ฿ на счёте.' : EV_PLACES && !msPlace() ? 'Места «' + MS_PLACE + '» нет.' : !EV_PLACES ? 'Загружаем место…'
      // `fits` false без пересечения — время уже прошло (снимок api d75c445): «пересекается» тогда было бы неправдой
      : clash ? (B.conflict ? 'Выбранное время пересекается с занятым — выберите другое.' : 'Это время уже прошло — выберите другое.') : '';
    var busy = !msPlace() || !dateOk ? '' : !B ? (MSB.fail ? '<div class="row"><span class="small">Занятость не загрузилась: ' + esc(MSB.fail) +
          ' Отправить можно — пересечение проверит сервер.</span><button type="button" class="btn quiet" data-action="msf-busy-retry">Повторить</button></div>'
        : '<span class="small">Смотрим занятость…</span>')
      : '<div class="rows">' + (B.busy.length ? B.busy.map(function (b) {
          return '<div><span class="small">' + esc(b.from + '–' + b.to) + '</span><b>' + esc('«' + b.title + '»') + '</b></div>';
        }).join('') : '<div><span class="small">' + esc(msDate(MSF.date)) + '</span><b>свободно</b></div>') + '</div>' +
        (B.conflict ? '<span class="small" style="color:var(--clay-ink)">' + esc('Пересекается: ' + B.conflict.starts_label.split(' ').pop() + '–' + B.conflict.ends_label + ' «' + B.conflict.title + '»') + '</span>'
          : B.fits ? '<span class="small">' + esc(msSpan(msDate(MSF.date), MSF.time, h)) + ' — свободно.</span>' : '');
    return (FLASH ? flash() : '') + '<div class="mf">' +
      '<div class="field"><label for="msf-date">Дата</label><input id="msf-date" type="date" min="' + msToday() + '" value="' + esc(MSF.date) + '"></div>' +
      '<div class="field"><label for="msf-time">Начало</label><select id="msf-time">' + MS_TIMES.map(function (t) {
          return '<option value="' + t + '"' + (t === MSF.time ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Продолжительность</label><div class="counter">' +
        '<button type="button" class="round" data-action="msf-minus"' + (MSF.extra ? '' : ' disabled') + ' aria-label="Меньше">−</button>' +
        '<b class="num">' + h + ' ' + msHours(h) + '</b>' +
        '<button type="button" class="round" data-action="msf-plus"' + (top ? ' disabled' : '') + ' aria-label="Больше">+</button></div>' +
        (top ? '<span class="small">Больше ' + MS_MAX_H + ' часов сервер не примет</span>' : '') + '</div>' +
      '<div class="field"><label>Место</label>' + place + '</div>' +
      (busy ? '<div class="field"><label>Занято в этот день</label>' + busy + '</div>' : '') +
      '<div class="field"><label for="msf-seats">Мест</label>' +
        '<input id="msf-seats" inputmode="numeric" style="width:92px" value="' + esc(MSF.seats) + '">' +
        '<span class="small">0 — без ограничения</span></div>' +
      '<div class="field"><label for="msf-title">Название ивента</label><input id="msf-title" maxlength="200" value="' + esc(MSF.title) + '"></div>' +
      '<div class="field"><label for="msf-about">Коротко для афиши</label><textarea id="msf-about" rows="3" maxlength="' + MS_ABOUT + '">' + esc(MSF.about) + '</textarea></div>' +
      '<div class="rows">' +
        '<div><span class="small">Спишется · ' + h + ' ' + msHours(h) + '</span><b class="num">' + (typeof p === 'number' ? money(p) + ' ฿' : '…') + '</b></div></div>' +
      '<span class="small">Если арт-директор откажет, деньги вернутся на счёт.</span>' +
      (MSF.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MSF.err) + '</span></div>' : '') +
      '<button type="button" class="btn" data-action="ms-send"' + (why || MR.busy ? ' disabled' : '') + '>' + (MR.busy ? 'Отправляем…' : 'Отправить букинг') + '</button>' +
      (why ? '<span class="small">' + esc(why) + '</span>' : '') +
    '</div>';
  },

  // E55d: мастера и их слоты (снимок master-slots), «слота нет» — `masters_without_slot`. Экрана за строкой нет
  masterList: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!MR.slots) return SCREENS.masterEvents();
    var rows = MR.slots.map(function (e) { return [e.who, msWhen(e) + (e.at ? '' : ', каждую неделю') + ' · «' + e.title + '»']; })
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

/* ── шаг 42: очередь карточек чайных мастеров (рецепты 42/teaReqs.md, 42/teaReq.md) ───────────────────────
   Зритель — арт-директор (mayMasters). Решение — только на `teaReq`, где видна вся карточка; в строке очереди кнопок нет.
   Разметка карточки (R2) — ОДНА, у руки ЧАЙ-A: teaCardHtml(c, {book:false}), разбор — teaCardFrom(raw), js/22-ekrany-chay.js.
   ⚠ Ручек шага 42 на api main НЕТ: адреса ниже — заглушка клиента под проверки, сверить с PR сервера, когда он выйдет.
   Форма строки очереди: { id, status: pending|approved|rejected, kind: new|edit, iso (подана), done (решена),
   card (как teaCardFrom), prev (у правки — что сейчас в «Услугах»), changed: ['photo','about','price'] } */
var TQ_API = { list: '/tea/cards/requests', approve: '/tea/cards/requests/{id}/approve', reject: '/tea/cards/requests/{id}/reject' };
var TQ = { list: null, fail: '', pending: null, gen: 0, busy: false, err: '', note: '', gone: 0 };
var TQ_ST = { pending: 'wait', approved: 'ok', rejected: 'no' };
// включено в живом здесь, а не в js/02: файл 02 вне наряда руки. До ручек сервера экран честно скажет «не загрузились»
WIRED.teaReqs = 1; WIRED.teaReq = 1;

function tqFrom(raw) {
  if (!raw || typeof raw !== 'object' || (typeof raw.id !== 'number' && typeof raw.id !== 'string')) return null;
  if (!TQ_ST[raw.status]) return null;
  var card = typeof teaCardFrom === 'function' ? teaCardFrom(raw.card || raw) : null;
  if (!card) return null;
  return { id: String(raw.id), status: raw.status, kind: raw.kind === 'edit' ? 'edit' : 'new', iso: raw.created_at || raw.iso || '',
    done: raw.decided_at || raw.done || '', card: card, prev: raw.prev && typeof teaCardFrom === 'function' ? teaCardFrom(raw.prev) : null,
    changed: Array.isArray(raw.changed) ? raw.changed : [], note: typeof raw.note === 'string' ? raw.note : '' };
}
function tqDemo() {
  var all = typeof teaCardsDemo === 'function' ? teaCardsDemo() : [];
  return all.map(function (c, i) {
    return { id: String(c.id), status: c.status === 'denied' ? 'rejected' : c.status === 'approved' ? 'approved' : 'pending', kind: 'new',
      iso: c.iso || '', done: c.done || '', card: c, prev: null, changed: [], note: '' };
  });
}
function tqCount() { TQ.pending = TQ.list ? TQ.list.filter(function (q) { return q.status === 'pending'; }).length : null; }
function loadTeaQueue() {
  if (!LIVE) { if (!TQ.list) { TQ.list = tqDemo(); tqCount(); } return; }
  var gen = ++TQ.gen; TQ.fail = '';
  api('GET', TQ_API.list).then(function (r) {
    if (gen !== TQ.gen) return;
    var arr = r.status === 200 && r.data && Array.isArray(r.data.items) ? r.data.items : r.status === 200 && Array.isArray(r.data) ? r.data : null;
    var list = arr && arr.map(tqFrom);
    if (list && list.every(Boolean)) { TQ.list = list; } else { TQ.list = null; TQ.fail = r.status === 403 ? denyText(r) : failText(r); }
    tqCount();
    if ({ masters: 1, teaReqs: 1, teaReq: 1, manage: 1 }[current]) render();
  });
}
function tqById(id) { return (TQ.list || []).filter(function (q) { return q.id === String(id); })[0]; }

// вход: очередь — на каждый вход на «Слоты и мастера» и в очередь (рецепт «Перечитать на входе»); заявка — поля с нуля
function tqGo(screen, p) {
  if ((screen === 'masters' || screen === 'teaReqs' || screen === 'manage') && current !== screen && mayMasters()) loadTeaQueue();
  if (screen === 'teaReq' && (current !== 'teaReq' || param !== p)) { TQ.err = ''; TQ.note = ''; TQ.gone = 0; if (!TQ.list) loadTeaQueue(); }
}
function tqGrab() { var f = document.getElementById('tq-note'); if (f) TQ.note = f.value; }
function tqAction(a, arg) {
  if (a === 'tq-retry') { loadTeaQueue(); render(); return true; }
  if (a === 'tq-open') { go('teaReq', arg); return true; }
  // R10 «К очереди»: действием, а не data-go — вход в очередь на «Слотах» ровно один (признак masters.md)
  if (a === 'tq-back') { go('teaReqs'); return true; }
  // «Повторить» блока «Чайный мастер» на «Клубе» (js/11): загрузка — руки ЧАЙ-A
  if (a === 'tq-mine-retry') { if (typeof loadTeaMine === 'function') { TEA.mineFail = ''; loadTeaMine(); } render(); return true; }
  if (a !== 'tq-yes' && a !== 'tq-no') return false;
  tqGrab();
  var q = tqById(arg);
  if (!q || TQ.busy) return true;
  var yes = a === 'tq-yes';
  if (!LIVE) {
    FLASH = { text: 'Это демонстрация', note: 'В Telegram это ушло бы на сервер клуба. Здесь ничего не отправлено и не записано.' };
    haptic('warn'); render(); return true;
  }
  TQ.busy = true; TQ.err = ''; render();
  var body = yes ? {} : (TQ.note.trim() ? { note: TQ.note.trim() } : {});
  api('POST', (yes ? TQ_API.approve : TQ_API.reject).replace('{id}', encodeURIComponent(q.id)), body).then(function (r) {
    TQ.busy = false;
    if (r.status === 200 || r.status === 201 || r.status === 204) {
      TQ.note = '';
      FLASH = { text: slovo(yes ? 'teaReq.done.yes' : 'teaReq.done.no'), note: '' };
      loadTeaQueue(); go('teaReqs'); return;
    }
    // R10: карточку уже решил другой арт-директор — сервер отвечает 409; поле R3 сохраняется при любом отказе
    if (r.status === 409) { TQ.gone = q.id; loadTeaQueue(); render(); return; }
    TQ.err = detailOf(r) || failText(r); render();
  });
  return true;
}

Object.assign(SCREENS, {

  // рецепт 42/teaReqs.md: ждущие сверху (вход на teaReq), решённые ниже — тихие, без перехода
  teaReqs: function () {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!TQ.list) return TQ.fail ? '<div class="card strong"><h2>' + esc(slovo('teaReqs.fail.title')) + '</h2><p class="verbatim">' + esc(TQ.fail) + '</p>' +
        '<button type="button" class="btn" data-action="tq-retry">' + esc(slovo('teaReqs.fail.retry')) + '</button></div>'
      : '<div class="card quiet"><span class="small">' + esc(slovo('teaReqs.loading')) + '</span></div>';
    var wait = TQ.list.filter(function (q) { return q.status === 'pending'; });
    var past = TQ.list.filter(function (q) { return q.status !== 'pending'; });
    var ava = function (q) { var u = q.card.shots && q.card.shots[0]; return u ? '<img class="avatar" alt="" src="' + esc(u) + '">' : ''; };
    if (!wait.length && !past.length) return (FLASH ? flash() : '') + '<div class="card quiet"><div class="col"><b>' + esc(slovo('teaReqs.empty.title')) + '</b>' +
      '<span class="small">' + esc(slovo('teaReqs.empty.sub')) + '</span></div></div>';
    return (FLASH ? flash() : '') +
      (wait.length ? '<div class="group"><span class="label">' + esc(slovo('teaReqs.wait')) + '</span>' + wait.map(function (q) {
        return '<button type="button" class="listitem" data-action="tq-open:' + esc(q.id) + '">' + ava(q) +
          '<span class="grow"><b class="clamp1">' + esc(q.card.name) + '</b><span class="small">' +
            esc(slovo(q.kind === 'edit' ? 'teaReqs.kind.edit' : 'teaReqs.kind.new') + ' · ' + topupDay(q.iso, true)) + '</span></span>' +
          '<span class="st wait">' + esc(slovo('teaReqs.st.wait')) + '</span>' + svg(ICON.chev, 'chev') + '</button>';
      }).join('') + '</div>' : '') +
      (past.length ? '<div class="group"><span class="label">' + esc(slovo('teaReqs.past')) + '</span>' + past.map(function (q) {
        return '<div class="listitem"><span class="grow"><b class="clamp1">' + esc(q.card.name) + '</b><span class="small">' + esc(topupDay(q.done, true)) + '</span></span>' +
          '<span class="st ' + TQ_ST[q.status] + '">' + esc(slovo(q.status === 'approved' ? 'teaReqs.st.ok' : 'teaReqs.st.no')) + '</span></div>';
      }).join('') + '</div>' : '');
  },

  // рецепт 42/teaReq.md: арт-директор только решает — полей карточки на экране нет; отказ слов не требует
  teaReq: function (id) {
    if (LIVE && !mayMasters()) return SCREENS.masters();
    if (!TQ.list) return SCREENS.teaReqs();
    var q = tqById(id);
    if (!q || TQ.gone === q.id || q.status !== 'pending') return '<div class="card quiet"><div class="col"><b>' + esc(slovo('teaReq.gone')) + '</b>' +
      '<button type="button" class="btn quiet" data-action="tq-back">' + esc(slovo('teaReq.gone.back')) + '</button></div></div>';
    var off = TQ.busy ? ' disabled aria-disabled="true"' : '';
    var CH = { photo: 'teaReq.edit.photo', about: 'teaReq.edit.about', price: 'teaReq.edit.price' };
    var changed = q.changed.filter(function (k) { return CH[k]; }).map(function (k) { return slovo(CH[k]); });
    var card = typeof teaCardHtml === 'function' ? teaCardHtml(q.card, { book: false }) : '';
    return (FLASH ? flash() : '') +
      '<span class="small">' + esc(slovo('teaReq.sub')) + '</span>' +
      (q.kind === 'edit' ? '<div class="card quiet"><div class="col"><b>' + esc(slovo('teaReq.edit.title')) + '</b>' +
          (q.prev ? '<span class="small">' + esc(q.prev.about) + '</span><b class="num">' + esc(q.prev.price) + ' ฿</b>' : '') +
          (changed.length ? '<span class="small">' + esc(slovo('teaReq.edit.changed', { what: changed.join(' / ') })) + '</span>' : '') +
        '</div></div>' : '') +
      card +
      '<div class="card"><div class="field"><label for="tq-note">' + esc(slovo('teaReq.note.label')) + '</label>' +
        '<textarea id="tq-note" rows="3" maxlength="500"' + off + '>' + esc(TQ.note) + '</textarea>' +
        '<span class="small">' + esc(slovo('teaReq.note.sub')) + '</span></div></div>' +
      (TQ.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(TQ.err) + '</span></div>' : '') +
      '<div class="row">' +
        '<button type="button" class="btn ghost" data-action="tq-no:' + esc(q.id) + '"' + off + '>' + esc(slovo('teaReq.no')) + '</button>' +
        '<button type="button" class="btn" data-action="tq-yes:' + esc(q.id) + '"' + off + '>' + esc(slovo('teaReq.yes')) + '</button>' +
      '</div>';
  }
});
