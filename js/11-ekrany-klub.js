var SCREENS = {

  home: function () {
    var m = DATA.member;
    var next = LIVE ? null : DATA.upcoming[0];
    return (FLASH ? flash() : '') +
      // E68 (Cafe13KPG#682): «Активно» в строке заголовка, «Пропуск» — короткой кнопкой справа в плашке.
      // Подпись короткая по замеру дизайнера: «Показать пропуск» — 145 px и перенос даты на вторую строку
      '<div class="card strong">' +
        '<div class="row top">' +
          '<div class="col grow"><div class="row" style="justify-content:flex-start;gap:8px"><h2>' + esc(m.level) + '</h2><span class="pill on">Активно</span></div>' +
            '<span class="small">' + esc(untilText(m)) + '</span></div>' +
          '<button type="button" class="btn quiet mini" data-go="pass">Пропуск</button>' +
        '</div>' +
      '</div>' +

      // карточки «Баланс» здесь больше нет: остаток живёт в шапке (v83), а две суммы на
      // одном экране — две правды об одном (кадры #500; слово владельца 29.10 «убрать баланс из вкладки клуб»)

      (next ? '<div class="group"><span class="label">Вы записаны</span>' +
        '<button type="button" class="listitem accent" data-go="bookings">' +
          '<span class="grow"><b>' + esc(next.title) + '</b><span class="small">' + esc(next.when) + '</span></span>' +
          svg(ICON.chev, 'chev') +
        '</button></div>' : '') +
      /* Вход в «Мои записи» — строкой, ВСЕГДА, есть ли записи или нет: пустоту объясняет экран, а не отсутствие входа
         (решение координатора 02.11.2026, Cafe13KPG#755). Прежде в живом входа не было вовсе (`next` выше — только
         демо), и разморозка «Записей» дала бы экран, на который не попасть. Не вкладка и не ссылка на афише: «Ивенты»
         владелец назвал календарём-афишей (#670), пятая вкладка спорила бы с тем же словом */
      (LIVE ? '<button type="button" class="listitem" data-go="bookings">' +
          '<span class="grow"><b>Мои записи</b></span>' + svg(ICON.chev, 'chev') + '</button>' : '') +

      // шаг 3: «Я мастер» — под карточкой членства (кадр E54); у гостя пусто
      masterOffer() +
      // шаг 13 (рецепт R1): «Свой бизнес в клубе» — ниже блока мастера
      partnerOffer() +
      rolePanel() +

      (LIVE ? myRoles() +
        // Одна группа «Работа»: бар и «Заявки на членство» (кадр E42g, Cafe13KPG#428) —
        // при барной роли строка главы клуба встаёт в ту же группу, а не во вторую «Работу».
        // «Люди» отсюда уехали во вкладку «Управление» (E46, Cafe13KPG#413): рабочее
        // не живёт внутри клиентского; в E42g они стояли здесь — кадр старше решения.
        (DATA.barSide || mayRequests() && WIRED.memberRequests ? '<div class="group"><span class="label">Работа</span>' +
          (DATA.barSide ? '<button type="button" class="listitem accent" data-go="barQueue">' +
            '<span class="grow"><b>Заказы на баре</b><span class="small">Очередь: принять, готово, выдан</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' +
          (mayCards() ? '<button type="button" class="listitem" data-go="barCards">' +
            '<span class="grow"><b>Карточки меню</b><span class="small">Новые позиции и утверждение</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') +
          (mayBook() ? '<button type="button" class="listitem" data-go="barMoney">' +
            '<span class="grow"><b>Доход и расход бара</b><span class="small">Выручка и затраты руками, с комментарием</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') : '') +
          // строка — только когда экран включён: до выкладки api заявок она вела бы в заглушку;
          // счёт ждущих — словами в подстрочнике, пилюли внутри .listitem у клиента нет
          (mayRequests() && WIRED.memberRequests ? '<button type="button" class="listitem" data-go="memberRequests">' +
            '<span class="grow"><b>Заявки на членство</b><span class="small">' +
              (MREQS.pending !== null ? 'Ждут ответа: ' + MREQS.pending : 'Согласие или отказ, со словом заявителю') + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') +
          '</div>' : '') +
        afishaHome() :
      '<div class="group">' +
        '<div class="row"><span class="label">На этой неделе</span>' +
        '<button type="button" class="btn quiet" data-go="events">Вся афиша</button></div>' +
        DATA.events.slice(0, 2).map(eventRow).join('') +
      '</div>');
  },

  guest: function () {
    if (LIVE) {
      return '<div class="group"><span class="label">Бар клуба</span>' +
          '<button type="button" class="listitem accent" data-go="bar">' +
            '<span class="grow"><b>Бар Café XIII</b><span class="small">Кофе, чай, авторские · заказ из приложения</span></span>' +
            svg(ICON.chev, 'chev') +
          '</button>' +
        '</div>';
      // «Услуги острова — ещё не подключено» снято: оно обещало раздел, которого
      // у клуба нет (решение владельца, Cafe13KPG#102, со слов координатора).
      // Вернуть, когда у клуба появятся настоящие услуги и ручка под них.
    }
    return '' +
      '<div class="group"><span class="label">Бар клуба</span>' +
        '<button type="button" class="listitem accent" data-go="bar">' +
          '<span class="grow"><b>Бар Café XIII</b>' +
          '<span class="small">' + (DATA.bar.open
            ? 'Кофе, чай, авторские · заказ из приложения'
            : 'Сейчас закрыт') + '</span></span>' +
          '<span class="pill' + (DATA.bar.open ? ' on' : '') + '">' +
            (DATA.bar.open ? 'открыт' : 'закрыт') + '</span>' +
        '</button>' +
      '</div>' +
      '<div class="group"><span class="label">Услуги острова</span>' +
        (DATA.services.length ? DATA.services.map(function (s) {
          return '<button type="button" class="listitem">' +
            '<span class="grow"><b>' + esc(s.title) + '</b><span class="small">' + esc(s.about) + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>';
        }).join('') : '<div class="card quiet"><span class="small">Пока ни одной.</span></div>') +
      '</div>' +
      (isMember() ? '' :
      '<div class="card strong">' +
        '<h2>Клуб закрыт для гостей</h2>' +
        '<p>Афиша, пространство и мероприятия доступны членам клуба. Услуги выше — всем.</p>' +
        '<button type="button" class="btn" data-go="membership">Что даёт членство</button>' +
      '</div>' +
      '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Вы уже член клуба?</b>' +
        '<span class="small">Если членство оформлено в кассе, оно появится здесь само — приложение узнаёт вас по Telegram.</span>' +
      '</div></div>');
  },

  pass: function () {
    if (LIVE) {
      if (PASS) return passCard(PASS, PASS_PHOTO) +
        '<div class="note">' + svg(ICON.info) +
          '<span>Код постоянный и <b>сохранён на этом телефоне</b>: если у двери нет сети, приложение покажет его без сервера. Код — это номер, а не секрет: переслать его кому-то — всё равно что отдать пропуск.</span>' +
        '</div>';
      if (PASS_FAIL) return '<div class="card strong"><h2>Пропуска нет</h2><p>' + esc(PASS_FAIL) + '</p>' +
        '<button type="button" class="btn" data-action="retry-pass">Попробовать снова</button></div>';
      return '<div class="card quiet"><div class="col"><b>Получаем пропуск…</b>' +
        '<span class="small">Сервер клуба выдаёт код один раз — дальше он не меняется.</span></div></div>';
    }
    var m = DATA.member;
    return '' +
      '<div class="pass">' +
        '<div class="who">' +
          '<span class="avatar">' + esc((m.name || '?').slice(0, 1).toUpperCase()) + '</span>' +
          '<span class="col"><b style="font-size:19px;font-family:Prata,Georgia,serif">' + esc(m.name) + '</b>' +
          '<span style="font-size:12px;color:#B8B6AE">' + esc(m.level) + ' · до ' + esc(m.until) + '</span></span>' +
        '</div>' +
        '<div class="code-box">' + pattern(m.number) + '</div>' +
        '<span class="num-big">' + esc(m.number) + '</span>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Код постоянный и <b>работает без интернета</b>. Сеть нужна тому, кто сканирует: у него на экране ваше фото и имя — переслать код другому бесполезно.</span>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Узор выше — демонстрационный. Настоящий код выдаёт сервер клуба: в Telegram здесь будет он.</span>' +
      '</div>';
  },

  membership: function () {
    if (LIVE) return membershipLive();
    // уровень — из оплаченных членств (/me), а не из роли; в демо их нет
    var have = DATA.member && DATA.member.memberships;
    var mine = function (k) { return have ? have.some(function (m) { return m.level === k; }) : DATA.role === k; };
    var tiers = [
      { name: LEVEL.member, about: 'Вход в пространство без оплаты. Афиша, записи, жизнь клуба.', mine: mine('member') },
      { name: LEVEL.organizer, about: 'Всё, что у члена клуба, плюс право проводить свои мероприятия и назначать их цену.', mine: mine('organizer') },
      { name: LEVEL.partner, about: 'Всё, что у члена клуба, плюс своё направление внутри клуба и его отчётность.', mine: mine('partner') }
    ];
    // Ни одной суммы и ни одной кнопки без действия — и в демо тоже: цен
    // владелец не называл, а демо показывают ему (решение координатора 24.10).
    return tiers.map(function (t) {
      return '<div class="card' + (t.mine ? ' strong' : '') + '">' +
        '<div class="row"><h2>' + esc(t.name) + '</h2></div>' +
        '<p style="font-size:13px">' + esc(t.about) + '</p>' +
        (t.mine ? '<span class="pill on" style="align-self:flex-start">Ваш уровень</span>' : '') +
      '</div>';
    }).join('') +
    (FLASH ? flash() : '') +
    // Кнопки «Поделиться телефоном» нет (Cafe13KPG#312): requestContact отдаёт
    // контакт БОТУ, приложению его хранить негде, а касса по телефону не ищет.
    // Вернётся, только если владелец решит собирать телефоны.
    '<div class="note">' + svg(ICON.info) +
      '<span>Оплата — в кассе, наличными или картой: работник отметит её, и уровень обновится здесь.</span>' +
    '</div>';
  },

  memberRequests: function () {
    if (!mayRequests()) return '<div class="card quiet"><span class="small">Заявки на членство смотрит и решает глава клуба.</span></div>';
    if (!MREQS.list) return MREQS.fail
      ? '<div class="card strong"><h2>Заявки не загрузились</h2><p>' + esc(MREQS.fail) + '</p>' +
        '<button type="button" class="btn" data-action="mq-retry">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем заявки…</span></div>';
    var wait = MREQS.list.filter(function (q) { return q.status === 'pending'; });
    var past = MREQS.list.filter(function (q) { return q.status !== 'pending'; });
    if (!wait.length && !past.length) return '<div class="card quiet"><div class="col"><b>Заявок нет</b>' +
      '<span class="small">Здесь появятся просьбы о членстве — из приложения, с экрана «Членство». Решение принимает глава клуба, деньги принимает касса.</span></div></div>';
    return (MREQS.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MREQS.err) + '</span></div>' : '') +
      (wait.length ? '<div class="group"><span class="label">Ждут ответа · ' + wait.length + '</span>' + wait.map(requestCard).join('') + '</div>' : '') +
      (past.length ? '<div class="group"><span class="label">Решённые</span>' + past.map(requestRow).join('') + '</div>' : '') +
      (MREQS.ask ? noteBox('Отказ не закрывает дорогу: отклонённая заявка закрыта, и человек может подать новую. Согласие членства не создаёт — его создаёт касса, приняв деньги.') : '');
  },
};
