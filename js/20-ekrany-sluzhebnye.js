// Человек уже в клубе и платит на кассе (шаг 24): чек ему не нужен, его находит кассир по нажатию
Object.assign(SCREENS, {

  /* Состояния входа. Каждое — свой экран со своей причиной: пустой кабинет
     у незнакомого выглядел бы как «вы в клубе, просто денег нет». */
  loading: function () {
    return '<div class="card quiet"><div class="col"><b>Узнаём вас…</b>' +
      '<span class="small">Сервер клуба проверяет подпись Telegram.</span></div></div>';
  },

  noSign: function () {
    return '<div class="card strong"><h2>Подпись не принята</h2>' +
      '<p>Сервер клуба не смог убедиться, что вход идёт из Telegram. Так бывает, если приложение открыто давно или не через бота.</p>' +
      '<p class="small">Закройте приложение и откройте его снова кнопкой меню в чате с ботом.</p></div>';
  },

  // Тетрадь клуба внутри приложения (v74): рамка только по свежему токену
  // кадры E49 (тетрадь), E49b (пока грузится), E49v (отказ — листа нет вовсе: отказ приходит JSON-ом)
  joinAbout: function () {
    if (ABOUT.fail) return '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(ABOUT.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="about-retry">Попробовать снова</button>' +
        '<span class="small" style="text-align:center">Тетрадь живёт на сервере клуба — без него её не показать.</span>';
    return '<div class="paper">' +
        '<div class="wait"' + (ABOUT.loaded ? ' hidden' : '') + '><span>Открываем тетрадь клуба</span>' +
          '<span class="small" style="text-align:center">Страница большая — это занимает секунду</span></div>' +
        (ABOUT.url ? '<iframe class="about" src="' + esc(ABOUT.url) + '" title="О клубе"' + (ABOUT.loaded ? '' : ' hidden') +
          ' onload="aboutLoaded()"></iframe>' : '') +
      '</div>';
  },

  // Кого нет в списке: просьба о вступлении (кадры E44*, Cafe13KPG#459)
  noAccess: function () {
    var j = JOIN.info;
    var head = '<h2>Вас ещё нет в списке</h2>' + joinWho() +
      '<p>Приложение открыто тем, кого внёс владелец. Попасть в список можно отсюда.</p>';
    if (!j) return '<div class="card strong">' + head +
      (JOIN.fail ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="join-retry">Попробовать снова</button>' : '') + '</div>';
    var q = j.request;
    // E44g: ждёт ответа — отправки нет, вторую сервер отвергнет
    if (q && q.status === 'pending') return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2>Просьба отправлена</h2>' + joinWho() + '</div><span class="pill">ЖДЁТ ОТВЕТА</span></div>' +
        // J4 (фича 8): просьба без чека — прежние слова «посмотрит чек» врали бы
        '<p>' + esc(slovo('noAccess.return.sent')) + '</p></div>';
    // E44e: согласовано, а /me читался при старте — войти тем же путём, что «Попробовать снова»
    if (q && q.status === 'approved') return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2>Вас приняли в клуб</h2>' + joinWho() + '</div><span class="pill">СОГЛАСОВАНО</span></div>' +
        '<p>Членство уже создано. Осталось войти — приложение перечитает вас с сервера.</p>' +
        '<button type="button" class="btn" data-action="retry">Войти в клуб</button>' +
        '<span class="small" style="text-align:center">Если клуб всё ещё не открылся — закройте приложение и откройте снова.</span></div>';
    // E44d: отказано — слово решившего плашкой, это чужая прямая речь
    if (q && q.status === 'rejected' && !JOIN.again) return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2 style="color:var(--clay-ink)">Просьба отклонена</h2>' + joinWho() + '</div><span class="pill warm">ОТКАЗАНО</span></div>' +
        '<p>Можно попросить снова — например, с другим чеком.</p>' +
        (q.note ? '<div class="deny">' + svg(ICON.info) + '<span>«' + esc(q.note) + '»</span></div>' : '') +
        '<button type="button" class="btn" data-action="join-again">Попросить снова</button></div>';
    /* Фича 8 (рецепт `_docs/recept/ekran/popolnenie/noAccess.md`, api #182/#183): выгнанный просит вернуться — без
       денег, суммы, чека, способа, реквизитов и кассы. J1 — всегда; J2 необязательное, ≤1000 (`said` сервера); отказы —
       словами сервера (J5: 410 за деньги в теле от старого клиента — человек обязан прочесть, что чек НЕ принят). */
    return '<div class="card strong">' + head +
        '<span class="small">' + esc(slovo('noAccess.return.note')) + '</span>' +
        '<button type="button" class="btn quiet" data-action="join-about">О клубе</button></div>' +
      '<div class="field"><label for="join-said">' + esc(slovo('noAccess.return.said')) + '</label>' +
        '<textarea id="join-said" maxlength="1000">' + esc(JOIN.said) + '</textarea></div>' +
      (JOIN.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(JOIN.err) + '</span></div>' : '') +
      '<button type="button" class="btn" data-action="join-send"' + (JOIN.busy ? ' disabled' : '') + '>' +
        (JOIN.busy ? '…' : esc(slovo('noAccess.return.send'))) + '</button>';
  },

  apiDown: function () {
    // Без сети пропуск, сохранённый раньше, всё равно нужен у двери.
    var p = FAIL_NET ? savedPass() : null;
    return '<div class="card strong"><h2>Сервер клуба недоступен</h2>' +
      '<p>' + esc(FAIL) + ' Показывать вместо ваших данных примерные мы не будем.</p>' +
      '<button type="button" class="btn" data-action="retry">Попробовать снова</button></div>' +
      (p ? '<div class="group"><span class="label">Пропуск, сохранённый на телефоне</span>' + passCard(p) + '</div>' : '');
  },

  soon: function () {
    return notWired(TITLES[current] || 'Этот раздел');
  },

  // не `notWired`: тот говорит «работает только в демонстрации… подключат к серверу», а
  // замороженный экран был подключён — для него это неправда (Cafe13KPG#510)
  frozen: function () {
    return '<div class="card quiet"><div class="col">' +
      '<b style="font-size:13px">' + esc(TITLES[current] || 'Этот раздел') + ' — временно недоступно</b>' +
      // текст designer-55: «данные на месте» — первое, о чём думает человек, увидевший пустоту на месте своей работы
      '<span class="small">Раздел выключен в приложении, данные на сервере на месте. Вернётся, когда дойдут руки.</span>' +
    '</div></div>';
  },

  demo: function () {
    // В Telegram это не демонстрация: данные настоящие. Панель — тестовый
    // режим и просмотр чужими глазами; список людей даёт сервер, своей
    // таблицы людей в публичном клиенте нет.
    if (LIVE) {
      var ver = '<span class="small">Версия приложения: <b>' + esc(VERSION) + '</b></span>';
      if (TEST.busy) return '<div class="card quiet"><span class="small">Переключаемся…</span></div>' + ver;
      if (TEST.as) return (FLASH ? flash() : '') +
        '<div class="card quiet"><div class="col"><b>Смотрите как ' + esc(TEST.as.name) + '</b>' +
          '<span class="small">Чтобы выбрать другого, выйдите из просмотра.</span></div></div>' +
        '<button type="button" class="btn" data-action="test-self">Выйти из просмотра</button>' + ver;
      if (TEST.on) return (FLASH ? flash() : '') +
        '<div class="group"><span class="label">Смотреть как</span>' +
          (TEST.fail ? '<div class="card quiet"><span class="small">' + esc(TEST.fail) + '</span></div>'
           : TEST.people === null ? '<div class="card quiet"><span class="small">Загружаем список…</span></div>'
           : !TEST.people.length ? '<div class="card quiet"><span class="small">В тестовой базе некого выбрать.</span></div>'
           : TEST.people.map(function (p) {
               return '<button type="button" class="listitem" data-action="test-as:' + p.id + '">' +
                 '<span class="grow"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.what) + '</span></span>' +
                 svg(ICON.chev, 'chev') + '</button>';
             }).join('')) +
        '</div>' +
        '<span class="small">Нажатия в тестовом режиме записываются в тестовую базу: деньги и записи там ненастоящие, боевая база не меняется.</span>' +
        '<button type="button" class="btn ghost" data-action="test-off">Выйти из тестового режима</button>' + ver;
      return (FLASH ? flash() : '') +
        '<div class="card quiet"><div class="col"><b>Тестовый режим</b>' +
          (TEST.health === 'configured'
            ? '<span class="small">Приложение переключится на тестовую базу: можно смотреть глазами любого человека из списка и нажимать всё — деньги там ненастоящие.</span>' +
              '<button type="button" class="btn" data-action="test-on">Войти в тестовый режим</button>'
            : TEST.health === 'unset' ? '<span class="small">Тестовая база ещё не выложена — режим недоступен.</span>'
            : TEST.health === 'loading' || TEST.health === '' ? '<span class="small">Проверяем, выложена ли тестовая база…</span>'
            : '<span class="small">Не удалось узнать, выложена ли тестовая база: ' + esc(TEST.health) + '</span>' +
              '<button type="button" class="btn ghost" data-action="test-health">Проверить снова</button>') +
        '</div></div>' + ver;
    }
    var roles = [
      ['guest', 'Гость', 'без членства: только услуги'],
      ['member', 'Член клуба', 'пропуск, афиша, записи'],
      ['organizer', LEVEL.organizer, 'то же плюс свои мероприятия'],
      ['partner', 'Бизнес-партнёр', 'то же плюс своё направление и его отчётность'],
      ['staff', ROLE_NAME.staff, 'касса: внести и отменить'],   // имя роли — одно, из ROLE_NAME (#999 №11)
      ['bar', 'Бар · исполнитель', 'заказы, съёмка напитков, затраты, смена'],
      ['curator', 'Куратор направления', 'отчётность бара и доля клуба']
    ];
    return '<div class="card quiet"><div class="col">' +
        '<b>Это демонстрация</b>' +
        '<span class="small">Версия приложения: <b>' + esc(VERSION) + '</b></span>' +
        '<span class="small">Страница открыта вне Telegram: членство, события и баланс зашиты в страницу, роль переключается вручную. В Telegram приложение работает на сервере клуба, и роль приходит оттуда.</span>' +
      '</div></div>' +
      '<div class="group"><span class="label">Смотреть как</span>' +
        roles.map(function (r) {
          return '<button type="button" class="listitem" data-role="' + r[0] + '"' +
            (DATA.role === r[0] ? ' style="border-color:var(--ink);border-width:2px"' : '') + '>' +
            '<span class="grow"><b>' + r[1] + '</b><span class="small">' + r[2] + '</span></span>' +
            (DATA.role === r[0] ? '<span class="pill on">сейчас</span>' : svg(ICON.chev, 'chev')) +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>В рабочем приложении роль придёт с сервера: он проверит подпись Telegram и ответит, кто вы. Подменить её из браузера будет нельзя.</span>' +
      '</div>' +
      '<div class="group"><span class="label">Согласие на данные</span>' +
        '<button type="button" class="btn quiet" data-action="reset-consent">Показать экран согласия заново</button>' +
        '<span class="small">Согласие спрашивается один раз. Кнопка стирает отметку в этом браузере, чтобы экран можно было посмотреть ещё раз.</span>' +
      '</div>';
  }
});
