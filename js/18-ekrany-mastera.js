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

/* ── шаг 34: статистика мастера и отчёт по ивенту (Cafe13KPG#565, рецепты `_docs/recept/ekran/34/masterStats.md` и
   `34/eventReport.md`, miniapp#400; форма — api#196, снимок на 4d3b5a4) ── Все слова — ключами masterStats.* и
   eventReport.* (№22); слова сервера (`detail` отказа) — как есть. Слово владельца: «Числа нужны. Реальные. Если нули -
   значит нули.» — каждое число на экране — поле ответа как есть, литерала числа в разметке нет; `0` печатается нулём;
   `null` или нет поля — «нет данных» (msNum/erNum), и нулём оно не печатается никогда. Разрез и ‹ › — функции шага 31
   (csStart, csShift, csDay); `money` — «сейчас», от периода не зависит. Отчёт по ивенту — ОДИН на все страницы
   статистики: состав урезает сервер по роли (ключей `money` и `slot_fee` у зрителя нет — и карточек нет). */
var MST = { period: 'month', at: '', data: null, fail: '', deny: '', gen: 0 };
function mayMasterStats() { return LIVE && mayOwnEvents(); }
// число сервера: null или нет поля → null («нет данных»); не число и не null → NaN (битый ответ)
function stNum(v, money) {
  if (v === null || v === undefined) return null;
  var n = money ? csMoney(v) : csCount(v) ? v : NaN;
  return isFinite(n) ? n : NaN;
}
function stBad(xs) { return xs.some(function (x) { return typeof x === 'number' && isNaN(x); }); }
// подстановки подписи периода — общие для страниц статистики; ключ слова каждая страница называет сама, литералом
function stLabelVars(period, ymd) {
  var s = csStart(period, ymd);
  if (period === 'day') return { date: csDay(s) };
  if (period === 'month') { var w = bmMonth(Date.parse(s.slice(0, 8) + '15T12:00:00Z')).split(' '); return { month: w[0], year: s.slice(0, 4) }; }
  var e = csAdd(s, 6), a = s.split('-'), b = e.split('-');
  return { from: Number(a[2]) + (a[1] === b[1] ? '' : ' ' + MONTHS[Number(a[1]) - 1]), to: Number(b[2]) + ' ' + MONTHS[Number(b[1]) - 1] };
}
function msLabel(period, ymd) {
  var v = stLabelVars(period, ymd);
  return period === 'day' ? slovo('masterStats.period.dayLabel', v) : period === 'month' ? slovo('masterStats.period.monthLabel', v)
    : slovo('masterStats.period.weekLabel', v);
}
/* Битая часть — отказ целиком: страница с пропавшим блоком читалась бы полной. Ноль не подставляется нигде. */
function fromMasterStats(d) {
  if (!d || typeof d !== 'object') return null;
  var e = d.events, p = d.payouts, m = d.money, l = d.list;
  if (!e || typeof e !== 'object' || !p || typeof p !== 'object' || !m || typeof m !== 'object' || !Array.isArray(l)) return null;
  var out = { count: stNum(e.count), bookings: stNum(e.bookings), collected: stNum(e.collected, true),
              pCount: stNum(p.count), pAmount: stNum(p.amount, true),
              balance: stNum(m.balance, true), withdrawable: stNum(m.withdrawable, true), expected: stNum(m.expected, true),
              expectedEvents: stNum(m.expected_events), list: [] };
  if (stBad([out.count, out.bookings, out.collected, out.pCount, out.pAmount, out.balance, out.withdrawable, out.expected, out.expectedEvents])) return null;
  for (var i = 0; i < l.length; i++) {
    var x = l[i];
    if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.starts_at !== 'string') return null;
    var at = new Date(x.starts_at);
    if (isNaN(at.getTime())) return null;
    // в строке списка числа всегда (форма api#196): bookings — число, collected — деньги; иначе отказ целиком
    var r = { id: x.id, title: x.title, ymd: bkk(at).ymd, at: at.getTime(), bookings: x.bookings, collected: csMoney(x.collected) };
    if (!csCount(r.bookings) || !isFinite(r.collected)) return null;
    out.list.push(r);
  }
  out.list.sort(function (a, b) { return a.at - b.at; });   // ВЫБОР рецепта: от ранних к поздним
  return out;
}
function loadMasterStats() {
  if (!mayMasterStats()) return;
  var gen = ++MST.gen, who = WHO;
  MST.data = null; MST.fail = ''; MST.deny = '';
  api('GET', '/stats/master?period=' + MST.period + '&at=' + MST.at).then(function (r) {
    if (gen !== MST.gen || who !== WHO) return;
    var got = r.status === 200 ? fromMasterStats(r.data) : null;
    if (got) MST.data = got;
    else if (r.status === 403) MST.deny = detailOf(r) || failText(r);
    else MST.fail = failText(r);
    if (current === 'masterStats') render();
  });
}
function mstMove(dir) {
  if (dir > 0 && csStart(MST.period, MST.at) >= csStart(MST.period, msToday())) return;   // › погашена на текущем
  MST.at = csShift(MST.period, MST.at, dir); loadMasterStats(); render();
}
// одно место печати числа экрана: null — «нет данных» словом, а не нулём
function msNum(v, money) {
  return v === null ? '<span class="small">' + esc(slovo('masterStats.noData')) + '</span>' : '<b class="num">' + esc(money ? bmSum(v) : String(v)) + '</b>';
}

var ER = { id: null, from: '', data: null, fail: '', deny: '', gen: 0 };
/* Ключа нет — блока нет (третье состояние, не 0 и не null): has.money / has.slot у ответа зрителя false. */
function fromEventReport(d) {
  if (!d || typeof d !== 'object' || typeof d.id !== 'number' || typeof d.title !== 'string' || typeof d.starts_at !== 'string') return null;
  var at = new Date(d.starts_at), b = d.bookings;
  if (isNaN(at.getTime()) || !b || typeof b !== 'object' || typeof b.unlimited !== 'boolean') return null;
  var k = bkk(at), out = { id: d.id, title: d.title, ymd: k.ymd, hm: k.hm, place: typeof d.place === 'string' && d.place ? d.place : null,
    count: stNum(b.count), places: b.unlimited ? null : stNum(b.places), unlimited: b.unlimited,
    hasMoney: Object.prototype.hasOwnProperty.call(d, 'money'), hasSlot: Object.prototype.hasOwnProperty.call(d, 'slot_fee') };
  if (stBad([out.count, out.places])) return null;
  if (out.hasMoney) {
    var m = d.money;
    if (!m || typeof m !== 'object' || typeof m.distributed !== 'boolean') return null;
    out.collected = stNum(m.collected, true); out.distributed = m.distributed;
    out.master = stNum(m.master, true); out.club = stNum(m.club, true);
    if (stBad([out.collected, out.master, out.club])) return null;
  }
  if (out.hasSlot) { out.slot = stNum(d.slot_fee, true); if (stBad([out.slot])) return null; }
  return out;
}
function loadEventReport() {
  var gen = ++ER.gen, who = WHO, id = ER.id;
  ER.data = null; ER.fail = ''; ER.deny = '';
  if (typeof id !== 'number') { ER.fail = 'id'; return; }
  api('GET', '/stats/event/' + id).then(function (r) {
    if (gen !== ER.gen || who !== WHO) return;
    var got = r.status === 200 ? fromEventReport(r.data) : null;
    if (got) ER.data = got;
    else if (r.status === 403) ER.deny = detailOf(r) || failText(r);
    else ER.fail = failText(r);
    if (current === 'eventReport') render();
  });
}
/* ── шаг 36 (Cafe13KPG#567, рецепт `_docs/recept/ekran/36/myStats.md`, miniapp#403; форма — api#195, снимок на 396ce48) ──
   «Моя» статистика: свои записи, пополнения и счёт; зритель — любой вошедший (№42 «а»). Правило чисел — шага 34
   (stNum/stBad; «нет данных» печатает только myNum); строка списка — в ОБЩИЙ `eventReport` (состав урезает
   сервер по роли). `money.balance` — «сейчас», от периода не зависит. */
var MY = { period: 'month', at: '', data: null, fail: '', deny: '', gen: 0 };
function mayMyStats() { return LIVE; }
function fromMyStats(d) {
  if (!d || typeof d !== 'object') return null;
  var e = d.events, t = d.topups, m = d.money, l = d.list;
  if (!e || typeof e !== 'object' || !t || typeof t !== 'object' || !m || typeof m !== 'object' || !Array.isArray(l)) return null;
  var out = { count: stNum(e.count), spent: stNum(e.spent, true), tCount: stNum(t.count), tAmount: stNum(t.amount, true),
              balance: stNum(m.balance, true), list: [] };
  if (stBad([out.count, out.spent, out.tCount, out.tAmount, out.balance])) return null;
  for (var i = 0; i < l.length; i++) {
    var x = l[i];
    if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.starts_at !== 'string') return null;
    var at = new Date(x.starts_at), paid = stNum(x.paid, true);
    if (isNaN(at.getTime()) || stBad([paid])) return null;
    out.list.push({ id: x.id, title: x.title, ymd: bkk(at).ymd, at: at.getTime(), paid: paid });
  }
  out.list.sort(function (a, b) { return a.at - b.at; });
  return out;
}
function loadMyStats() {
  if (!mayMyStats()) return;
  var gen = ++MY.gen, who = WHO;
  MY.data = null; MY.fail = ''; MY.deny = '';
  api('GET', '/stats/me?period=' + MY.period + '&at=' + MY.at).then(function (r) {
    if (gen !== MY.gen || who !== WHO) return;
    var got = r.status === 200 ? fromMyStats(r.data) : null;
    if (got) MY.data = got;
    else if (r.status === 403) MY.deny = detailOf(r) || failText(r);
    else MY.fail = failText(r);
    if (current === 'myStats') render();
  });
}
function myMove(dir) {
  if (dir > 0 && csStart(MY.period, MY.at) >= csStart(MY.period, msToday())) return;
  MY.at = csShift(MY.period, MY.at, dir); loadMyStats(); render();
}
function myNum(v, money) {
  return v === null ? '<span class="small">' + esc(slovo('myStats.noData')) + '</span>' : '<b class="num">' + esc(money ? bmSum(v) : String(v)) + '</b>';
}
/* Шаг 33: статистика опер-директора (`/stats/ops`, api#197; рецепт 33/opsStats, #405). Право — `mayOps()`. Числа — как у
   шага 34: null — «нет данных», 0 — нулём, битое — отказ целиком. Ключа `money` нет — карточки «Мои {pct} %» нет (до шага 28). */
var OPS = { period: 'month', at: '', data: null, fail: '', deny: '', gen: 0 };
function mayOpsStats() { return mayOps(); }
function fromOpsStats(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.businesses) || !Array.isArray(d.months)) return null;
  var out = { biz: [], months: [], hasMoney: Object.prototype.hasOwnProperty.call(d, 'money') }, i, x, r;
  for (i = 0; i < d.businesses.length; i++) {
    x = d.businesses[i];
    if (!x || typeof x.id !== 'number' || typeof x.title !== 'string') return null;
    r = { id: x.id, title: x.title, partner: typeof x.partner === 'string' && x.partner ? x.partner : null,
          club: stNum(x.share_club, true), partnerPct: stNum(x.share_partner, true), revenue: stNum(x.revenue, true) };
    if (stBad([r.club, r.partnerPct, r.revenue])) return null;
    out.biz.push(r);
  }
  for (i = 0; i < d.months.length; i++) {
    x = d.months[i];
    var at = x && typeof x.period_start === 'string' ? Date.parse(x.period_start) : NaN;
    if (!x || typeof x.title !== 'string' || !isFinite(at)) return null;
    r = { title: x.title, at: at, club: stNum(x.club, true), net: stNum(x.net_base, true), partner: stNum(x.partner, true),
          pct: stNum(x.partner_pct, true), ops: stNum(x.ops, true) };
    if (stBad([r.club, r.net, r.partner, r.pct, r.ops])) return null;
    out.months.push(r);
  }
  if (out.hasMoney) {
    var m = d.money;
    if (!m || typeof m !== 'object') return null;
    out.pct = stNum(m.pct, true); out.accrued = stNum(m.accrued, true); out.balance = stNum(m.balance, true);
    if (stBad([out.pct, out.accrued, out.balance])) return null;
  }
  return out;
}
function loadOpsStats() {
  if (!mayOpsStats()) return;
  var gen = ++OPS.gen, who = WHO;
  OPS.data = null; OPS.fail = ''; OPS.deny = '';
  api('GET', '/stats/ops?period=' + OPS.period + '&at=' + OPS.at).then(function (r) {
    if (gen !== OPS.gen || who !== WHO) return;
    var got = r.status === 200 ? fromOpsStats(r.data) : null;
    if (got) OPS.data = got;
    else if (r.status === 403) OPS.deny = detailOf(r) || failText(r);
    else OPS.fail = failText(r);
    if (current === 'opsStats') render();
  });
}
function opsMove(dir) {
  if (dir > 0 && csStart(OPS.period, OPS.at) >= csStart(OPS.period, msToday())) return;
  OPS.at = csShift(OPS.period, OPS.at, dir); loadOpsStats(); render();
}
// одно место печати числа экрана: null — «нет данных» словом, а не нулём
// plain — текстом для подстановки в слово (строка месяца M)
function osNum(v, money, plain) {
  var t = v === null ? slovo('opsStats.noData') : money ? bmSum(v) : String(v);
  return plain ? t : v === null ? '<span class="small">' + esc(t) + '</span>' : '<b class="num">' + esc(t) + '</b>';
}
/* Шаг 35: статистика бизнеса партнёра (`/stats/partner`, api#198; рецепт 35/partnerStats, #404). Бизнесы — свои
   (`/partner/directions`, BW.dirs); выбор — `.seg` при двух и более. Доли — только закрытого месяца (`shares.closed`),
   клиент их не считает. Кошелёк — та же пара `wallet`/`wallet_through`, что у шага 20 (fromWallet). */
var PST = { biz: null, period: 'month', at: '', data: null, fail: '', deny: '', gen: 0 };
function mayPartnerStats() { return LIVE; }
function fromPartnerStats(d, biz) {
  if (!d || typeof d !== 'object' || !d.business || d.business.id !== biz || !d.sales || typeof d.sales !== 'object' ||
      !d.shares || typeof d.shares !== 'object' || typeof d.shares.closed !== 'boolean') return null;
  var s = d.sales, h = d.shares, w = fromWallet(d);
  var out = { revenue: stNum(s.revenue, true), opex: stNum(s.opex, true), net: stNum(s.net, true), closed: h.closed,
              partner: stNum(h.partner, true), club: stNum(h.club, true), ops: stNum(h.ops, true), pct: stNum(h.share_partner_pct, true),
              wallet: w ? w.sum : null, through: w ? w.through : null };
  if (w === null || stBad([out.revenue, out.opex, out.net, out.partner, out.club, out.ops, out.pct])) return null;
  return out;
}
function loadPartnerStats() {
  if (!mayPartnerStats() || PST.biz === null) return;
  var gen = ++PST.gen, who = WHO, biz = PST.biz;
  PST.data = null; PST.fail = ''; PST.deny = '';
  api('GET', '/stats/partner?direction_id=' + biz + '&period=' + PST.period + '&at=' + PST.at).then(function (r) {
    if (gen !== PST.gen || who !== WHO) return;
    var got = r.status === 200 ? fromPartnerStats(r.data, biz) : null;
    if (got) PST.data = got;
    else if (r.status === 403) PST.deny = detailOf(r) || failText(r);
    else PST.fail = failText(r);
    if (current === 'partnerStats') render();
  });
}
// свои бизнесы — на каждом входе; один — выбран сам, при двух и более — первый, пока не выбран другой
function loadPartnerBiz() {
  if (!mayPartnerStats()) return;
  var gen = ++PST.gen;
  BW.dirs = null; BW.dirsFail = '';
  api('GET', '/partner/directions').then(function (r) {
    if (gen !== PST.gen) return;
    var l = r.status === 200 ? fromMyBiz(r.data) : null;
    BW.dirs = l; BW.dirsFail = l ? '' : denyText(r);
    if (l && l.length) { if (!l.some(function (x) { return x.id === PST.biz; })) PST.biz = l[0].id; loadPartnerStats(); }
    if (current === 'partnerStats') render();
  });
}
function psMove(dir) {
  if (dir > 0 && csStart(PST.period, PST.at) >= csStart(PST.period, msToday())) return;
  PST.at = csShift(PST.period, PST.at, dir); loadPartnerStats(); render();
}
function psNum(v, money) {
  return v === null ? '<span class="small">' + esc(slovo('partnerStats.noData')) + '</span>' : '<b class="num">' + esc(money ? bmSum(v) : String(v)) + '</b>';
}
function erNum(v, money) {
  return v === null ? '<span class="small">' + esc(slovo('eventReport.noData')) + '</span>' : '<b class="num">' + esc(money ? bmSum(v) : String(v)) + '</b>';
}

Object.assign(SCREENS, {
  masterStats: function () {
    if (!mayMasterStats()) return '<div class="card quiet"><div class="col"><b>' + esc(slovo('masterStats.denyTitle')) + '</b>' +
      '<span class="small">' + esc(slovo('masterStats.denyNote')) + '</span></div></div>';
    // ключ — литералом у каждого разреза: склеенный из частей ключ прибору (slova-klyuchi) не проверить
    var P = [['day', slovo('masterStats.period.day')], ['week', slovo('masterStats.period.week')], ['month', slovo('masterStats.period.month')]];
    var seg = '<div class="seg">' + P.map(function (x) {
      return '<button type="button" data-action="mst-period:' + x[0] + '" aria-pressed="' + (MST.period === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    var last = csStart(MST.period, MST.at) >= csStart(MST.period, msToday());
    var nav = '<div class="row"><button type="button" class="icon-btn" data-action="mst-prev" aria-label="' + esc(slovo('masterStats.period.prev')) + '">‹</button>' +
      '<b>' + esc(msLabel(MST.period, MST.at)) + '</b>' +
      '<button type="button" class="icon-btn" data-action="mst-next" aria-label="' + esc(slovo('masterStats.period.next')) + '"' + (last ? ' disabled' : '') + '>›</button></div>' +
      '<span class="small">' + esc(slovo('masterStats.period.clockNote')) + '</span>';
    if (MST.deny) return seg + nav + '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(MST.deny) + '</span></div>';
    if (MST.fail) return seg + nav + '<div class="card quiet"><div class="row"><span class="small">' + esc(slovo('masterStats.error')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="mst-retry">' + esc(slovo('masterStats.retry')) + '</button></div></div>';
    if (!MST.data) return seg + nav + '<div class="card quiet"><span class="small">' + esc(slovo('masterStats.loading')) + '</span></div>';
    var s = MST.data;
    var row = function (label, html) { return '<div><span class="small">' + esc(label) + '</span>' + html + '</div>'; };
    var E = '<div class="card"><b>' + esc(slovo('masterStats.events.title')) + '</b><div class="rows">' + row(slovo('masterStats.events.count'), msNum(s.count)) +
        (s.count === 0 ? '' : row(slovo('masterStats.events.bookings'), msNum(s.bookings)) + row(slovo('masterStats.events.collected'), msNum(s.collected, true))) + '</div>' +
      (s.count === 0 ? '<span class="small">' + esc(slovo('masterStats.events.none')) + '</span>' : '') +
      '<span class="small">' + esc(slovo('masterStats.events.cashNote')) + '</span></div>';
    // пустой блок — по СЧЁТЧИКУ (рецепт #400): при 0 счётчик стоит числом, P1 — вместо строки суммы
    var Pc = '<div class="card"><b>' + esc(slovo('masterStats.payouts.title')) + '</b><div class="rows">' +
        (s.pCount === 0 ? '' : row(slovo('masterStats.payouts.amount'), msNum(s.pAmount, true))) + row(slovo('masterStats.payouts.count'), msNum(s.pCount)) + '</div>' +
      (s.pCount === 0 ? '<span class="small">' + esc(slovo('masterStats.payouts.none')) + '</span>' : '') + '</div>';
    // D1 — строка, а не «0 ฿»: expected_events 0 — ждать нечего
    var D = '<div class="card"><b>' + esc(slovo('masterStats.money.title')) + '</b><div class="rows">' +
        row(slovo('masterStats.money.balance'), msNum(s.balance, true)) + row(slovo('masterStats.money.withdrawable'), msNum(s.withdrawable, true)) +
        row(slovo('masterStats.money.expected'), s.expectedEvents === 0
          ? '<span class="small">' + esc(slovo('masterStats.money.expectedNone')) + '</span>' : msNum(s.expected, true)) + '</div>' +
      '<span class="small">' + esc(slovo('masterStats.money.nowNote')) + '</span></div>';
    var L = s.count === 0 || !s.list.length ? '' : '<span class="label">' + esc(slovo('masterStats.list.title')) + '</span><div class="list">' +
      s.list.map(function (x) {
        return '<button type="button" class="listitem" data-action="mst-event:' + x.id + '"><span class="grow"><b class="clamp1">' + esc(x.title) + '</b>' +
          '<span class="small">' + esc(slovo('masterStats.list.row', { date: msDate(x.ymd), bookings: x.bookings })) + '</span></span>' +
          msNum(x.collected, true) + svg(ICON.chev, 'chev') + '</button>';
      }).join('') + '</div>';
    return seg + nav + E + Pc + D + L;
  },
  partnerStats: function () {
    if (!mayPartnerStats()) return '';
    var dirs = BW.dirs;
    if (!dirs) return '<div class="card quiet"><span class="small">' + esc(BW.dirsFail || slovo('partnerStats.loading')) + '</span></div>';
    if (!dirs.length) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b><span class="small">Статистику бизнеса видит его партнёр.</span></div></div>';
    var pick = dirs.length < 2 ? '' : '<div class="seg">' + dirs.map(function (x) {
      return '<button type="button" data-action="ps-biz:' + x.id + '" aria-pressed="' + (PST.biz === x.id) + '">' + esc(x.title) + '</button>';
    }).join('') + '</div>';
    var P = [['day', slovo('partnerStats.period.day')], ['week', slovo('partnerStats.period.week')], ['month', slovo('partnerStats.period.month')]];
    var seg = pick + '<div class="seg">' + P.map(function (x) {
      return '<button type="button" data-action="ps-period:' + x[0] + '" aria-pressed="' + (PST.period === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    var last = csStart(PST.period, PST.at) >= csStart(PST.period, msToday()), v = stLabelVars(PST.period, PST.at);
    var label = PST.period === 'day' ? slovo('partnerStats.period.dayLabel', v) : PST.period === 'month' ? slovo('partnerStats.period.monthLabel', v)
      : slovo('partnerStats.period.weekLabel', v);
    var nav = '<div class="row"><button type="button" class="icon-btn" data-action="ps-prev" aria-label="' + esc(slovo('partnerStats.period.prev')) + '">‹</button>' +
      '<b>' + esc(label) + '</b>' +
      '<button type="button" class="icon-btn" data-action="ps-next" aria-label="' + esc(slovo('partnerStats.period.next')) + '"' + (last ? ' disabled' : '') + '>›</button></div>' +
      '<span class="small">' + esc(slovo('partnerStats.period.clockNote')) + '</span>';
    if (PST.deny) return seg + nav + '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(PST.deny) + '</span></div>';
    if (PST.fail) return seg + nav + '<div class="card quiet"><div class="row"><span class="small">' + esc(slovo('partnerStats.error')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="ps-retry">' + esc(slovo('partnerStats.retry')) + '</button></div></div>';
    if (!PST.data) return seg + nav + '<div class="card quiet"><span class="small">' + esc(slovo('partnerStats.loading')) + '</span></div>';
    var s = PST.data;
    var row = function (label, html) { return '<div><span class="small">' + esc(label) + '</span>' + html + '</div>'; };
    var S = '<div class="card"><b>' + esc(slovo('partnerStats.sales.title')) + '</b><div class="rows">' + row(slovo('partnerStats.sales.revenue'), psNum(s.revenue, true)) +
      row(slovo('partnerStats.sales.opex'), psNum(s.opex, true)) + row(slovo('partnerStats.sales.net'), psNum(s.net, true)) + '</div></div>';
    // H1 — словом вместо долей: день, неделя и незакрытый месяц (`closed: false`); клиент доли не считает
    var H = '<div class="card"><b>' + esc(slovo('partnerStats.shares.title')) + '</b>' + (!s.closed
        ? '<span class="small">' + esc(slovo('partnerStats.shares.open')) + '</span>'
        : '<div class="rows">' + row(s.pct === null ? slovo('partnerStats.shares.partnerNoPct') : slovo('partnerStats.shares.partner', { pct: String(s.pct) }), psNum(s.partner, true)) +
          row(slovo('partnerStats.shares.club'), psNum(s.club, true)) + (s.ops === null ? '' : row(slovo('partnerStats.shares.ops'), psNum(s.ops, true))) + '</div>') + '</div>';
    // `wallet_through` — конец периода: месяц у мгновения перед ним (как шаг 20)
    var W = '<div class="card"><div class="rows">' + row(slovo('partnerStats.wallet'), psNum(s.wallet, true)) + '</div>' +
      (s.through ? '<span class="small">' + esc(slovo('partnerStats.walletThrough', { month: bmMonth(Date.parse(s.through) - 1).toLowerCase() })) + '</span>' : '') + '</div>';
    return seg + nav + S + H + W;
  },
  opsStats: function () {
    if (!mayOpsStats()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Статистику бизнесов видит операционный директор.</span></div></div>';
    var P = [['day', slovo('opsStats.period.day')], ['week', slovo('opsStats.period.week')], ['month', slovo('opsStats.period.month')]];
    var seg = '<div class="seg">' + P.map(function (x) {
      return '<button type="button" data-action="os-period:' + x[0] + '" aria-pressed="' + (OPS.period === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    var last = csStart(OPS.period, OPS.at) >= csStart(OPS.period, msToday()), v = stLabelVars(OPS.period, OPS.at);
    var label = OPS.period === 'day' ? slovo('opsStats.period.dayLabel', v) : OPS.period === 'month' ? slovo('opsStats.period.monthLabel', v)
      : slovo('opsStats.period.weekLabel', v);
    var nav = '<div class="row"><button type="button" class="icon-btn" data-action="os-prev" aria-label="' + esc(slovo('opsStats.period.prev')) + '">‹</button>' +
      '<b>' + esc(label) + '</b>' +
      '<button type="button" class="icon-btn" data-action="os-next" aria-label="' + esc(slovo('opsStats.period.next')) + '"' + (last ? ' disabled' : '') + '>›</button></div>' +
      '<span class="small">' + esc(slovo('opsStats.period.clockNote')) + '</span>';
    if (OPS.deny) return seg + nav + '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(OPS.deny) + '</span></div>';
    if (OPS.fail) return seg + nav + '<div class="card quiet"><div class="row"><span class="small">' + esc(slovo('opsStats.error')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="os-retry">' + esc(slovo('opsStats.retry')) + '</button></div></div>';
    if (!OPS.data) return seg + nav + '<div class="card quiet"><span class="small">' + esc(slovo('opsStats.loading')) + '</span></div>';
    var s = OPS.data;
    var row = function (label, html) { return '<div><span class="small">' + esc(label) + '</span>' + html + '</div>'; };
    var K = '<div class="card"><b>' + esc(slovo('opsStats.biz.title')) + '</b>' + (!s.biz.length
        ? '<span class="small">' + esc(slovo('opsStats.biz.none')) + '</span>'
        : '<div class="rows">' + s.biz.map(function (b) {
          return '<div data-biz="' + b.id + '"><span class="grow"><b class="clamp1">' + esc(b.title) + '</b>' +
            '<span class="small">' + esc(b.partner === null ? slovo('opsStats.biz.noPartner') : slovo('opsStats.biz.row', { partner: b.partner })) + '</span></span>' +
            osNum(b.revenue, true) + '</div>';
        }).join('') + '</div>') + '</div>';
    var H = !s.biz.length ? '' : '<div class="card"><b>' + esc(slovo('opsStats.shares.title')) + '</b><div class="rows">' + s.biz.map(function (b) {
      // H1 — словом, а не «0 %»: любой share_* null — доли не назначены
      return row(b.title, '<span class="small">' + esc(b.club === null || b.partnerPct === null ? slovo('opsStats.shares.unset')
        : slovo('opsStats.shares.row', { club: String(b.club), partner: String(b.partnerPct) })) + '</span>');
    }).join('') + '</div></div>';
    var M = '<div class="card"><b>' + esc(slovo('opsStats.months.title')) + '</b>' + (!s.months.length
        ? '<span class="small">' + esc(slovo('opsStats.months.none')) + '</span>'
        : '<div class="rows">' + s.months.map(function (m) {
          // месяц — из period_start в поясе клуба (bmMonth), а не из `month` сервера (Cafe13KPG#961)
          var det = { net: osNum(m.net, true, true), partner: osNum(m.partner, true, true), pct: osNum(m.pct, false, true), ops: osNum(m.ops, true, true) };
          return '<div><span class="grow"><span class="small">' + esc(slovo('opsStats.months.row', { month: bmMonth(m.at), title: m.title })) + '</span>' +
            '<span class="small">' + esc(m.ops === null ? slovo('opsStats.months.opsNone', det) : slovo('opsStats.months.detail', det)) + '</span></span>' +
            osNum(m.club, true) + '</div>';
        }).join('') + '</div>') + '</div>';
    var D = !s.hasMoney ? '' : '<div class="card"><b>' + esc(s.pct === null ? slovo('opsStats.money.titleNoPct') : slovo('opsStats.money.title', { pct: String(s.pct) })) + '</b>' +
      '<div class="rows">' + row(slovo('opsStats.money.accrued'), osNum(s.accrued, true)) + row(slovo('opsStats.money.balance'), osNum(s.balance, true)) + '</div>' +
      (s.pct === null ? '<span class="small">' + esc(slovo('opsStats.money.pctNone')) + '</span>' : '') + '</div>';
    return seg + nav + K + H + M + D;
  },
  myStats: function () {
    if (!mayMyStats()) return '';
    var P = [['day', slovo('myStats.period.day')], ['week', slovo('myStats.period.week')], ['month', slovo('myStats.period.month')]];
    var seg = '<div class="seg">' + P.map(function (x) {
      return '<button type="button" data-action="my-period:' + x[0] + '" aria-pressed="' + (MY.period === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    var last = csStart(MY.period, MY.at) >= csStart(MY.period, msToday()), v = stLabelVars(MY.period, MY.at);
    var label = MY.period === 'day' ? slovo('myStats.period.dayLabel', v) : MY.period === 'month' ? slovo('myStats.period.monthLabel', v)
      : slovo('myStats.period.weekLabel', v);
    var nav = '<div class="row"><button type="button" class="icon-btn" data-action="my-prev" aria-label="' + esc(slovo('myStats.period.prev')) + '">‹</button>' +
      '<b>' + esc(label) + '</b>' +
      '<button type="button" class="icon-btn" data-action="my-next" aria-label="' + esc(slovo('myStats.period.next')) + '"' + (last ? ' disabled' : '') + '>›</button></div>' +
      '<span class="small">' + esc(slovo('myStats.period.clockNote')) + '</span>';
    if (MY.deny) return seg + nav + '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(MY.deny) + '</span></div>';
    if (MY.fail) return seg + nav + '<div class="card quiet"><div class="row"><span class="small">' + esc(slovo('myStats.error')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="my-retry">' + esc(slovo('myStats.retry')) + '</button></div></div>';
    if (!MY.data) return seg + nav + '<div class="card quiet"><span class="small">' + esc(slovo('myStats.loading')) + '</span></div>';
    var s = MY.data;
    var row = function (l, html) { return '<div><span class="small">' + esc(l) + '</span>' + html + '</div>'; };
    // ноль — нулём, и под ним E1/T1; «Оплачено» при нуле записей не печатается: сервер отдаёт там null, а «нет данных» врало бы
    var E = '<div class="card"><b>' + esc(slovo('myStats.events.title')) + '</b><div class="rows">' + row(slovo('myStats.events.count'), myNum(s.count)) +
        (s.count === 0 ? '' : row(slovo('myStats.events.spent'), myNum(s.spent, true))) + '</div>' +
      (s.count === 0 ? '<span class="small">' + esc(slovo('myStats.events.none')) + '</span>' : '') + '</div>';
    var T = '<div class="card"><b>' + esc(slovo('myStats.topups.title')) + '</b><div class="rows">' +
        // пустой блок — по СЧЁТЧИКУ (рецепт #403): при 0 «Пополнений 0» числом и T1, «Пополнено» скрыто
        (s.tCount === 0 ? '' : row(slovo('myStats.topups.amount'), myNum(s.tAmount, true))) +
        row(slovo('myStats.topups.count'), myNum(s.tCount)) + '</div>' +
      (s.tCount === 0 ? '<span class="small">' + esc(slovo('myStats.topups.none')) + '</span>' : '') + '</div>';
    var D = '<div class="card"><b>' + esc(slovo('myStats.money.title')) + '</b><div class="rows">' + row(slovo('myStats.money.balance'), myNum(s.balance, true)) + '</div>' +
      '<span class="small">' + esc(slovo('myStats.money.nowNote')) + '</span></div>';
    var L = s.count === 0 || !s.list.length ? '' : '<span class="label">' + esc(slovo('myStats.list.title')) + '</span><div class="list">' +
      s.list.map(function (x) {
        return '<button type="button" class="listitem" data-action="my-event:' + x.id + '"><span class="grow"><b class="clamp1">' + esc(x.title) + '</b>' +
          '<span class="small">' + esc(slovo('myStats.list.row', { date: msDate(x.ymd) })) + '</span></span>' +
          myNum(x.paid, true) + svg(ICON.chev, 'chev') + '</button>';
      }).join('') + '</div>';
    return seg + nav + E + T + D + L;
  },
  eventReport: function () {
    if (ER.deny) return '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(ER.deny) + '</span></div>';
    if (ER.fail) return '<div class="card quiet"><div class="row"><span class="small">' + esc(slovo('eventReport.error')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="er-retry">' + esc(slovo('eventReport.retry')) + '</button></div></div>';
    if (!ER.data) return '<div class="card quiet"><span class="small">' + esc(slovo('eventReport.loading')) + '</span></div>';
    var s = ER.data;
    var row = function (label, html) { return '<div><span class="small">' + esc(label) + '</span>' + html + '</div>'; };
    var R0 = '<span class="small">' + esc(s.place === null ? slovo('eventReport.whenNoPlace', { date: msDate(s.ymd), time: s.hm })
      : slovo('eventReport.when', { date: msDate(s.ymd), time: s.hm, place: s.place })) + '</span>';
    var B = '<div class="card"><b>' + esc(slovo('eventReport.bookings.title')) + '</b><div class="rows">' +
      row(slovo('eventReport.bookings.count'), erNum(s.count)) +
      row(slovo('eventReport.bookings.places'), s.unlimited ? '<span class="small">' + esc(slovo('eventReport.bookings.noLimit')) + '</span>' : erNum(s.places)) + '</div></div>';
    // доли — числа сервера по факту распределения; до распределения M1, а не «0 ฿»
    var M = !s.hasMoney ? '' : '<div class="card"><b>' + esc(slovo('eventReport.money.title')) + '</b><div class="rows">' +
      row(slovo('eventReport.money.collected'), erNum(s.collected, true)) +
      (s.distributed ? row(slovo('eventReport.money.master'), erNum(s.master, true)) + row(slovo('eventReport.money.club'), erNum(s.club, true)) : '') + '</div>' +
      (s.distributed ? '' : '<span class="small">' + esc(slovo('eventReport.money.notYet')) + '</span>') +
      '<span class="small">' + esc(slovo('eventReport.money.cashNote')) + '</span></div>';
    var S = !s.hasSlot ? '' : '<div class="card"><div class="rows">' + row(slovo('eventReport.slot'), erNum(s.slot, true)) + '</div></div>';
    return R0 + B + M + S;
  },
});
