Object.assign(SCREENS, {

  tillMembership: function () { return tillForm('membership'); },
  tillTopup: function () { return tillForm('topup'); },

  organizer: function () {
    if (LIVE) return organizerLive();
    var signed = DATA.myEvents.reduce(function (a, e) { return a + e.signed; }, 0);
    var seats = DATA.myEvents.reduce(function (a, e) { return a + e.of; }, 0);
    var due = DATA.myEvents.reduce(function (a, e) {
      return a + (e.kind === 'paid' ? e.signed * e.price : 0);
    }, 0);
    return (FLASH ? flash() : '') +
      '<div class="group"><span class="label">Ваши мероприятия в этом месяце</span>' +
        '<div class="rows">' +
          '<div><span class="small">Событий</span><b class="num">' + DATA.myEvents.length + '</b></div>' +
          '<div><span class="small">Записалось</span><b class="num">' + signed + ' из ' + seats + '</b></div>' +
          '<div><span class="small">Наполненность</span><b class="num">' +
            (seats ? Math.round(signed / seats * 100) : 0) + ' %</b></div>' +
          '<div><span class="small">Соберёте с платных</span><b class="num">' + money(due) + ' ฿</b></div>' +
        '</div>' +
        '<span class="small">Наполненность события — сильнее любой цены: по нашему расчёту рост с 5 до 15 человек меняет картину вдвое больше, чем правка тарифа.</span>' +
      '</div>' +
      '<button type="button" class="btn" data-go="eventNew">' +
        svg('<path d="M12 5v14M5 12h14"/>') + 'Создать мероприятие</button>' +
      '<div class="group"><span class="label">Мои мероприятия</span>' +
        (DATA.myEvents.length ? DATA.myEvents.map(function (e) {
          return '<button type="button" class="listitem" data-manage="' + esc(e.id) + '">' +
            '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.day.split(',')[0]) + '</span></span>' +
            '<span class="grow"><b>' + esc(e.title) + '</b>' +
            '<span class="small">записалось ' + e.signed + ' из ' + e.of + ' · ' + esc(e.state) + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>';
        }).join('') : '<div class="card quiet"><span class="small">Пока ни одного. Создайте первое.</span></div>') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Цену своего мероприятия назначаете вы. Клуб берёт за уровень «Мастер», а не долю со входа.</span>' +
      '</div>';
  },

  eventNew: function () {
    var paid = FORM.kind === 'paid';
    // У человека без права формы нет вовсе: форма, отказывающая по нажатию,
    // хуже прямой строки о том, кто заводит мероприятия.
    if (LIVE && !mayCreateEvent())
      return '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Мероприятия заводят не все</b>' +
        // Слово вида — с БОЛЬШОЙ: тут речь о праве по кУПЛЕННОМУ уровню, а не о ремесле
      // (словарь облика, раздел «Мастер, мастер, организатор»): «мастер» с маленькой —
      // тот, кто ВЕДЁТ вечер, и гостевой учитель без членства прочёл бы
      // маленькую как разрешение себе (находка архитектора на #63). Сервер спрашивает
      // ровно купленное: `has_live_membership(…, ("organizer", "partner"))` либо роль
      // клуба, и отказ звучит «мероприятия заводят организатор, партнёр и
      // работники клуба» (api `events.py`, замер мой).
      //
      // УКАЗАТЕЛЯ НА ЭКРАН ЗДЕСЬ НЕТ НАРОЧНО. Прежняя редакция добавляла
      // «Свой уровень членства видно на экране «Членство»» — и отправляла на
      // ВЫКЛЮЧЕННЫЙ экран: `membership` вышло из WIRED, и в живом режиме там
      // «ещё не подключено». Нового указателя не ставлю: читатели у этого
      // отказа РАЗНЫЕ — член без права и гость без членства вовсе, и у
      // гостя вкладки «Клуб» нет (`TABS.guest`), то есть любой адрес был бы
      // верен одному и ложен другому.
        '<span class="small">Их заводят члены с уровнем «Мастер» или «Бизнес-партнёр» и работники клуба.</span>' +
      '</div></div>';
    return '<p style="font-size:13px">Появится в афише клуба сразу после публикации.</p>' +

      (EVN_ERR ? '<div class="card strong"><div class="col">' +
        '<b style="font-size:13px">Не получилось</b><span class="small">' + esc(EVN_ERR) + '</span>' +
      '</div></div>' : '') +

      '<div class="field"><label for="f-title">Название</label>' +
        '<input id="f-title" type="text" value="' + keep('f-title') + '" placeholder="Например: звуковая практика">' +
        '<span class="small">До 200 знаков.</span></div>' +

      '<div class="row" style="gap:10px;align-items:stretch">' +
        '<div class="field" style="flex:1 1 0"><label for="f-date">День</label>' +
          '<input id="f-date" type="date" value="' + keep('f-date') + '"></div>' +
        '<div class="field" style="flex:1 1 0"><label for="f-time">Начало</label>' +
          '<input id="f-time" type="time" value="' + keep('f-time', '19:00') + '">' +
          '<span class="small">Время клуба, остров.</span></div>' +
      '</div>' +

      // Не плашка-совет: эхо — ответ поля, а не подсказка. В `.note` оно
      // вдобавок начиналось на 28 px левее соседних плашек (у тех значок,
      // у него не было). Дата — тушью, хвост — подписью: разные голоса.
      echoLine(echoText(cur('f-date'), cur('f-time', '19:00'))) +

      '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Когда на острове ходят на события</b>' +
        '<span class="small">Доли спроса по 522 позициям афиши острова за 19 дней, наш замер.</span>' +
        '<div class="rows" style="margin-top:6px">' +
          DEMAND.map(function (d) {
            return '<div><span class="small">' + d.part + ' · ' + d.hours + '</span>' +
              '<b class="num">' + d.share + ' %</b></div>';
          }).join('') +
        '</div>' +
        '<span class="small" style="margin-top:6px">Пик — 19:00: каждое шестое событие острова.</span>' +
      '</div></div>' +

      '<div class="row" style="gap:10px;align-items:stretch">' +
        '<div class="field" style="flex:1 1 0"><label for="f-dur">Длительность, мин</label>' +
          // В старом черновике здесь лежит «90 мин»: числовое поле с такой
          // строкой рисуется ПУСТЫМ, и человек решил бы, что стёрлось само.
          '<input id="f-dur" type="number" inputmode="numeric" value="' +
            keep('f-dur', '90').replace(/\D+/g, '') + '">' +
          '<span class="small">От 1 до 1440.</span></div>' +
        '<div class="field" style="flex:1 1 0"><label for="f-seats">Мест</label>' +
          '<input id="f-seats" type="number" inputmode="numeric" value="' + keep('f-seats', '12') + '">' +
          '<span class="small">От 1 до 500.</span></div>' +
      '</div>' +

      '<div class="group"><span class="label">Где</span>' +
        placeSeg() +
      '</div>' +

      '<div class="group"><span class="label">Участие</span>' +
        '<div class="seg">' +
          [['paid','Платное'],['free','Бесплатное'],['donation','Донейшн']].map(function (k) {
            return '<button type="button" data-kind="' + k[0] + '" aria-pressed="' +
              (FORM.kind === k[0]) + '">' + k[1] + '</button>';
          }).join('') +
        '</div>' +
        // Три вида — не три состояния одного поля, а разная ПОДПИСЬ в одном
        // месте: у платного «Цена», у донейшна «Ориентир». У бесплатного
        // поля нет в раскладке вовсе — серое поле, которое нельзя заполнить,
        // выглядит работающим и молчит о причине.
        (FORM.kind === 'free'
          ? '<div class="note">' + svg(ICON.info) +
            '<span>Бесплатное: человек просто записывается, место держится за ним. Поля цены здесь нет — брать нечего.</span></div>'
          : '<div class="field"><label for="f-price">' + (paid ? 'Цена входа, ฿' : 'Ориентир, ฿') + '</label>' +
            '<input id="f-price" type="number" inputmode="numeric" value="' +
              keep('f-price', paid ? '400' : '') + '" placeholder="' + (paid ? '400' : '— ฿') + '">' +
            '<span class="small">' + (paid
              ? 'Больше нуля.'
              : 'Можно не указывать: взнос добровольный, и его отсутствие не мешает записаться.') +
            '</span></div>') +
      '</div>' +

      '<div class="field"><label for="f-about">Описание</label>' +
        '<input id="f-about" type="text" value="' + keep('f-about') + '" placeholder="Что будет и что взять с собой"></div>' +

      '<button type="button" class="listitem" data-toggle="filmed" aria-pressed="' + FORM.filmed + '">' +
        svg(ICON.cam, 'chev') +
        '<span class="grow"><b>Ведётся съёмка</b>' +
        '<span class="small">' + (FORM.filmed
          ? 'Участники увидят это и дадут согласие отдельно'
          : 'Отметьте, если снимаете: согласие участники дают отдельно') + '</span></span>' +
        '<span class="pill' + (FORM.filmed ? ' on' : '') + '">' + (FORM.filmed ? 'да' : 'нет') + '</span>' +
      '</button>' +

      (EVN_BUSY
        ? '<div class="card quiet"><span class="small">Отправляем…</span></div>'
        : '<button type="button" class="btn dup-main" data-action="create-event">Опубликовать в афише</button>') +
      // Единственное место, где человек ещё может перечитать поля: правок у
      // мероприятия не существует, исправляют снятием.
      '<span class="small" style="text-align:center">Исправить потом нельзя: только снять, а снятие гости видят как отмену. Перечитайте поля.</span>';
  },

  /* E65/E65b (шаг 7, часть А): сумму называет человек, нижнего предела нет (кроме нуля). Деньги — `POST /events/{id}/donate`
     со счёта; отказы словами сервера. После — /me и архив перечитаны. Отправлено, а архив ещё не пришёл — сумма из ответа */
  thanks: function (id) {
    var e = eventById(id);
    if (!e) return HIST ? '<div class="card quiet"><span class="small">Этого мероприятия в архиве нет.</span></div>'
      : '<div class="card quiet"><span class="small">Загружаем мероприятие…</span></div>';
    var head = '<div class="col"><h1>Поблагодарить мастера</h1><span class="small">' + esc(e.title + ' · ' + e.day.split(',')[0] + ' · ' + e.master) + '</span></div>';
    var sent = e.donated > 0 ? e.donated : TH.sent;
    if (sent > 0) return head + '<div class="card quiet"><div class="col"><b>Вы поблагодарили: ' + esc(e.master) + '</b>' +
        '<span class="small num">' + money(sent) + ' ฿</span></div></div>' +
      '<button type="button" class="btn quiet" data-action="thank-back">К мероприятию</button>';
    if (!e.mayThank) return head + '<div class="card quiet"><span class="small">Поблагодарить за это мероприятие нельзя.</span></div>';
    return head +
      '<div class="field"><label for="th-amount">Сколько, ฿</label><input id="th-amount" inputmode="decimal" placeholder="Сколько считаете нужным" value="' + esc(TH.amount) + '"></div>' +
      (TH.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TH.err) + '</span></div>' : '') +
      '<button type="button" class="btn" data-action="thank-send"' + (TH.busy ? ' disabled' : '') + '>' + (TH.busy ? 'Отправляем…' : 'Отправить') + '</button>' +
      '<span class="small" style="text-align:center">Спишется со счёта сразу. На запись и на место это не влияет.</span>';
  },

  // E55k/E55l: правка ОДНОЙ недели — число мест и описание; остальное справкой словами сервера
  eventEdit: function (id) {
    var e = eventById(id);
    if (!e) return EVENTS ? '<div class="card quiet"><span class="small">Этого мероприятия в афише больше нет.</span></div>' : eventsWait();
    // Домашняя форма v117 (Cafe13KPG#691): отказ «не ваше» — только в живом режиме. Вне Telegram
    // `isMyEvent` ложен по построению, и витрина с описью видели отказ вместо экрана
    if (e.done || LIVE && !canEditEvent(e)) return '<div class="card quiet"><span class="small">' +
      (e.done ? 'Мероприятие завершилось: править его уже нельзя.' : 'Править это мероприятие может его ведущий.') + '</span></div>';
    var on = e.day.split(',')[0], when = /^(Сегодня|Завтра)$/.test(on) ? on.toLowerCase() : on;
    // у демо-афиши длительности нет полем — она считается из «с»–«до»
    var mins = typeof e.mins === 'number' ? e.mins : hmMin(e.until) - hmMin(e.time);
    var h = Math.round(mins / 60 * 10) / 10;
    return '<div class="card quiet"><div class="col"><b>' + esc(e.title) + '</b>' +
        '<span class="small">' + esc(e.day + ' · ' + e.time + (h > 0 ? ' · ' + (h % 1 ? h : h + ' ' + msHours(h)) : '') + (e.place ? ' · ' + e.place : '')) + '</span>' +
        '<span class="small">Название, время, длительность и место мероприятия здесь не меняются.</span></div></div>' +
      '<div class="field"><label for="edt-seats">Мест</label><input id="edt-seats" type="number" inputmode="numeric" min="0" max="500" value="' + esc(EDT.seats) + '">' +
        '<span class="small">0 — без ограничения</span></div>' +
      '<div class="field"><label for="edt-about">Коротко для афиши</label><textarea id="edt-about" maxlength="2000">' + esc(EDT.about) + '</textarea>' +
        '<span class="small">До 2000 знаков</span></div>' +
      // E67: цена входа; при живых записях — погашена, причина словами сервера (409 правки)
      '<div class="field"><label for="edt-price">Цена входа, ฿</label><input id="edt-price" inputmode="decimal" value="' + esc(EDT.price) + '"' +
        (takenOf(e) > 0 ? ' disabled aria-disabled="true" aria-describedby="edt-price-why"' : '') + '>' +
        (takenOf(e) > 0 ? '<span class="small" id="edt-price-why">Цена входа не меняется, пока есть записи: записано ' + takenOf(e) + '.</span>'
          : '<span class="small">0 — вход без оплаты</span>') + '</div>' +
      /* E67: галочка доната. Подпись кадра «После мероприятия у записавшихся появится «Поблагодарить мастера»» НЕ дана:
         кнопки благодарности в клиенте нет (вход — Cafe13KPG#755), обещание пути, которого нет, — та же поломка */
      (typeof EDT.ask === 'boolean' ? '<button type="button" class="listitem" data-action="edt-ask" aria-pressed="' + EDT.ask + '">' +
        '<span class="col"><b>Просить донат</b></span>' +
        '<span class="pill' + (EDT.ask ? ' on' : '') + '">' + (EDT.ask ? 'включено' : 'выключено') + '</span></button>' : '') +
      (EDT.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(EDT.err) + '</span></div>'
        : '<div class="note">' + svg(ICON.info) + '<span>Правка только на эту неделю. Следующие недели придут такими, как в заявке.</span></div>') +
      '<button type="button" class="btn" data-action="edt-save"' + (EDT.busy ? ' disabled' : '') + '>' +
        (EDT.busy ? 'Сохраняем…' : 'Сохранить на ' + esc(when)) + '</button>';
  },

  eventManage: function (id) {
    var e = DATA.myEvents.filter(function (x) { return x.id === id; })[0] || DATA.myEvents[0];
    if (!e) return '<div class="card quiet"><span class="small">Мероприятие не найдено.</span></div>';
    var paidCount = DATA.signed.filter(function (p) { return p.paid; }).length;
    return '<div class="col"><h1>' + esc(e.title) + '</h1>' +
        '<span class="small">' + esc(e.day) + ' · ' + esc(e.time) + '</span></div>' +
      '<div class="rows">' +
        '<div><span class="small">Записалось</span><b class="num">' + e.signed + ' из ' + e.of + '</b></div>' +
        (e.kind === 'paid'
          ? '<div><span class="small">Оплатили</span><b class="num">' + paidCount + ' из ' + DATA.signed.length + '</b></div>' +
            '<div><span class="small">Соберёте</span><b class="num">' + money(paidCount * e.price) + ' ฿</b></div>'
          : '<div><span class="small">Участие</span><b>' + (e.kind === 'free' ? 'Бесплатно' : 'Донейшн') + '</b></div>') +
      '</div>' +
      '<div class="group"><span class="label">Кто идёт</span>' +
        DATA.signed.map(function (p) {
          return '<div class="card"><div class="row">' +
            '<div class="col"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.when) + '</span></div>' +
            '<span class="pill' + (p.paid ? ' on' : '') + '">' + (p.paid ? 'оплачено' : 'не оплачено') + '</span>' +
          '</div></div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="btn ghost" data-action="cancel-event">Отменить мероприятие</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Отменить можно, стереть — нет: запись об отмене останется, и записавшиеся получат уведомление.</span>' +
      '</div>';
  },
});
