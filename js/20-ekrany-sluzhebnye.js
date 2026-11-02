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
    var j = JOIN.info, note = '<div class="note">' + svg(ICON.info) +
      '<span>Приложение денег не принимает: оплата идёт прямо в клуб.</span></div>';
    var head = '<h2>Вас ещё нет в списке</h2>' + joinWho() +
      '<p>Приложение открыто тем, кого внёс владелец. Попасть в список можно отсюда.</p>';
    if (!j) return '<div class="card strong">' + head +
      (JOIN.fail ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="join-retry">Попробовать снова</button>' : '') + '</div>';
    var q = j.request;
    // E44g: ждёт ответа — отправки нет, вторую сервер отвергнет
    if (q && q.status === 'pending') return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2>Просьба отправлена</h2>' + joinWho() + '</div><span class="pill">ЖДЁТ ОТВЕТА</span></div>' +
        '<p>Глава клуба посмотрит чек и ответит здесь же. Второй раз просить не нужно: сервер отвечает «ваша просьба уже ждёт ответа».</p></div>' + note;
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
    // E44, E44b, E44v: просьбы нет — форма
    var m = JOIN_PAY[JOIN.pay], img = JOIN.img[JOIN.pay], f = JOIN.file, gone = img === 'fail';
    return '<div class="card strong">' + head +
        '<button type="button" class="btn quiet" data-action="join-about">О клубе</button></div>' +
      '<div class="group"><span class="label">Чем платить</span><div class="seg">' +
        Object.keys(JOIN_PAY).map(function (k) {
          return '<button type="button" data-action="join-pay:' + k + '" aria-pressed="' + (JOIN.pay === k) + '">' + JOIN_PAY[k].name + '</button>';
        }).join('') + '</div>' +
        '<div class="qr"><div>' +
          // E44zh: реквизитов нет — строка вместо квадрата (сообщению нужна ширина), суммы нет, платить не по чему
          (gone ? '<div class="row"><span class="small">Реквизиты не загрузились</span>' +
                  '<button type="button" class="btn quiet mini" data-action="join-req-retry">Повторить</button></div>' +
                '<div class="row"><span class="small">' + m.where + '</span><span class="small">суммы нет</span></div>' +
                '<span class="small">Платить не по чему, пока их нет.</span>'
           : (img && img !== 'loading' ? '<div class="place img"><img src="' + esc(img) + '" alt="Реквизиты ' + m.name + '"></div>'
              : '<div class="place"><span>Загружаем реквизиты…</span></div>') +
            '<div class="row"><span class="small">' + m.where + '</span><b class="num">' +
              money(JOIN.pay === 'usdt' ? j.usd : j.thb) + ' ' + m.cur + '</b></div>' +
            '<span class="small">' + m.hint + '</span>') + '</div></div></div>' +
      '<div class="field"><label for="join-said">Пара слов о себе <span class="small">— необязательно</span></label>' +
        '<textarea id="join-said" maxlength="1000" placeholder="Кто вы и почему хотите в клуб">' + esc(JOIN.said) + '</textarea></div>' +
      // близнец «Фото чека» затрат, но без камеры по умолчанию: чек уже лежит в телефоне (кадр E44)
      '<label class="btn ghost" for="join-file">' + svg(f ? ICON.check : ICON.cam) + (f ? 'Чек приложен · заменить' : 'Приложить чек') +
        '<input id="join-file" type="file" accept="' + RECEIPT_TYPES.join(',') + '" hidden></label>' +
      '<span class="small" style="text-align:center">' +
        (f ? (f.pdf ? 'PDF' : 'Фото') + ' · ' + money(Math.max(1, Math.round(f.size / 1024))) + ' КБ' : 'Фото или PDF, до 2 МБ') + '</span>' +
      (JOIN.fileErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.fileErr) + '</span></div>' : '') +
      (JOIN.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.err) + '</span></div>' : '') +
      '<button type="button" class="btn" data-action="join-send"' + (!f || gone || JOIN.busy ? ' disabled' : '') + '>' +
        (JOIN.busy ? '…' : 'Отправить запрос') + '</button>' + note;
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
      ['staff', 'Работник', 'касса: внести и отменить'],
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
