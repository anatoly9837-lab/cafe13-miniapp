Object.assign(SCREENS, {

  partner: function () {
    return (FLASH ? flash() : '') +
      '<button type="button" class="btn" data-go="serviceNew">' +
        svg('<path d="M12 5v14M5 12h14"/>') + 'Добавить услугу</button>' +
      '<div class="group"><span class="label">Мои услуги</span>' +
        (DATA.myServices.length ? DATA.myServices.map(function (x) {
          return '<div class="card"><div class="row top">' +
            '<div class="col"><b>' + esc(x.title) + '</b><span class="small">' + esc(x.about) + '</span></div>' +
            '<span class="pill' + (x.state === 'работает' ? ' on' : '') + '">' + esc(x.state) + '</span>' +
          '</div><div class="row"><span class="small">Цена</span><b class="num">' + esc(x.price) + '</b></div></div>';
        }).join('') : '<div class="card quiet"><span class="small">Пока ни одной.</span></div>') +
      '</div>' +
      '<div class="group"><span class="label">Отчётность направления</span>' +
        '<div class="rows">' +
          '<div><span class="small">Выручка за месяц</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Расходы и закуп</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Чистая прибыль</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Ваши 70 %</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Клубу 30 %</span><b class="num">[сумма]</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Суммы собираются из кассы: каждая строка внесена работником и может быть отменена, но не исправлена задним числом.</span>' +
      '</div>';
  },

  serviceNew: function () {
    return '<p style="font-size:13px">Появится в разделе «Услуги» после проверки директором.</p>' +
      '<div class="field"><label for="s-title">Название</label>' +
        '<input id="s-title" type="text" placeholder="Как её назовут гости"></div>' +
      '<div class="field"><label for="s-about">Коротко, что это</label>' +
        '<input id="s-about" type="text" placeholder="Одной строкой"></div>' +
      '<div class="field"><label for="s-price">Цена</label>' +
        '<input id="s-price" type="text" placeholder="Цена в батах"></div>' +
      '<div class="field"><label for="s-contact">Кто выполняет</label>' +
        '<input id="s-contact" type="text" placeholder="Вы сами или ваш работник"></div>' +
      '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Фотографии</b>' +
        '<span class="small">Прикладываются после проверки. Снимки должны быть ваши: чужие из каталогов публиковать нельзя.</span>' +
      '</div></div>' +
      '<button type="button" class="btn dup-main" data-action="create-service">Отправить на проверку</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Новые направления в клубе принимает директор — он же назначает бизнес-партнёров.</span>' +
      '</div>';
  },

  /* Первый экран, пока согласия нет. Вкладки и «назад» на нём скрыты: уйти
     отсюда можно только решением, иначе согласие становится формальностью,
     которую проскакивают. Отказ при этом не наказывается — об этом прямо
     сказано внизу. */
  consent: function () {
    return (FLASH ? flash() : '') + '<div class="group">' +
        '<h1>Клуб запомнит вас</h1>' +
        '<p>Чтобы вести членство, записи на мероприятия и ваш счёт, клуб сохранит имя из Telegram, номер члена клуба и всё, что вы сделаете в приложении: записи, посещения, движение денег по счёту.</p>' +
      '</div>' +
      '<div class="rows">' +
        '<div><span>Данные остаются внутри клуба</span><span class="pill on">не передаём</span></div>' +
        '<div><span>Реклама и продажа данных</span><span class="pill">нет</span></div>' +
        // «и удалить» снято словом владельца 28.10: удаления себя на сервере нет — обещание было ложным
        '<div><span>Посмотреть о себе</span><span class="pill gold">в любой момент</span></div>' +
      '</div>' +
      '<button type="button" class="btn dup-main" data-action="accept-consent">Принимаю</button>' +
      '<button type="button" class="btn ghost" data-go="consentFull">Подробно</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Не согласны — просто не пользуйтесь приложением: членства вы не теряете, ваш учёт работник будет вести вручную.</span>' +
      '</div>';
  },

  consentFull: function () {
    return '<div class="group">' +
        '<h1>Как клуб хранит данные</h1>' +
        '<p>Черновик. Текст написан до проверки юристом — перед тем как открыть клуб для людей со стороны, он будет уточнён.</p>' +
      '</div>' +
      CONSENT_FULL.map(function (sec) {
        return '<div class="card"><div class="col">' +
          '<h2>' + esc(sec[0]) + '</h2>' +
          sec[1].map(function (t) { return '<p class="small">' + esc(t) + '</p>'; }).join('') +
        '</div></div>';
      }).join('') +
      '<button type="button" class="btn dup-main" data-action="accept-consent">Принимаю</button>';
  },
});
