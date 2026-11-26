// шаг 42 (рецепт 42/guest.md): ОДНА строка-вход «Чайные мастера» — всем, у кого есть «Услуги», членство не нужно;
// числа мастеров на входе нет, список — на `teaMasters`. Место — после «Бизнесов клуба», до «Работы»
function teaEntry() {
  // в живом — только когда экран подключён (WIRED у руки ЧАЙ-A): серая дверь сказала бы «временно недоступно» о том,
  // что не работало никогда (случай freeze), а вход появится сам, как только экран включат
  if (closed('teaMasters')) return '';
  return '<div class="group"><span class="label">' + esc(slovo('guest.tea.label')) + '</span>' +
    '<button type="button" class="listitem" data-go="teaMasters"><span class="grow"><b>' + esc(slovo('guest.tea.title')) + '</b>' +
      '<span class="small">' + esc(slovo('guest.tea.sub')) + '</span></span>' + svg(ICON.chev, 'chev') + '</button></div>';
}

/* шаг 42 (рецепт 42/home.md, «Чайный мастер»): своя карточка для «Услуг» — пять состояний и «не загрузилось».
   Зритель — все, роль и членство не спрашиваются (№65 «а»). Дверь карточки (H1) вносит человека в каталог «Услуг»,
   одну церемонию НЕ создаёт (№66 «а»); поэтому кнопка вторичная (.btn quiet). Состояние — у руки ЧАЙ-A: TEA.mine, loadTeaMine (js/22) */
function teaMineBlock() {
  if (typeof TEA === 'undefined' || closed('teaApply')) return '';   // как teaEntry: до подключения teaApply блока нет
  var m = TEA.mine;
  if (!m) return TEA.mineFail ? '<div class="card quiet"><div class="row"><span class="small">' + esc(slovo('home.tea.fail')) + '</span>' +
      '<button type="button" class="btn quiet" data-action="tc-mine-retry">' + esc(slovo('home.tea.retry')) + '</button></div></div>' : '';
  var line = function (st, word) {
    return '<div class="row"><b>' + esc(slovo('home.tea.line')) + '</b><span class="st ' + st + '">' + esc(word) + '</span></div>';
  };
  if (m.status === 'pending') return '<div class="card quiet"><div class="col">' + line('wait', slovo('home.tea.st.wait')) +
      '<span class="small">' + esc(slovo('home.tea.pending')) + '</span></div></div>';
  if (m.status === 'approved' || m.status === 'edit') return '<div class="card"><div class="col">' + line('ok', slovo('home.tea.st.ok')) +
      (m.status === 'edit' ? '<span class="small">' + esc(slovo('home.tea.editWait')) + '</span>' : '') +
      '<button type="button" class="btn quiet" data-go="teaApply">' + esc(slovo('home.tea.change')) + '</button></div></div>';
  if (m.status === 'rejected') return '<div class="card quiet"><div class="col">' + line('no', slovo('home.tea.st.no')) +
      (m.note ? '<span class="said">' + esc(m.note) + '</span>' : '') +
      '<button type="button" class="btn quiet" data-go="teaApply">' + esc(slovo('home.tea.again')) + '</button></div></div>';
  return '<div class="card"><div class="col"><b>' + esc(slovo('home.tea.title')) + '</b><span class="small">' + esc(slovo('home.tea.about')) + '</span>' +
    '<button type="button" class="btn quiet" data-go="teaApply">' + esc(slovo('home.tea.open')) + '</button></div></div>';
}

// остаток бизнеса строкой (шаг 20, рецепт 20/ostatok.md): в блоке партнёра на «Клубе» и в карточке дела (фича 10, B6).
// Только если дело есть в BW.dirs: у куратора прочерка нет — строки нет
function bizWallet(biz) {
  var d = (BW.dirs || []).filter(function (x) { return x.id === biz; })[0];
  if (!d) return '';
  return walletRow('На счёте', d.wallet, { 'null': 'доли ещё не назначены', wait: 'доля будет зачислена по закрытию месяца',
      zero: 'по закрытым месяцам зачислять было нечего' }) +
    (d.wallet === undefined ? '<span class="small">Остаток сервер пока не отдаёт — у ручки нет поля. Прочерк значит «не спросили», а не «ноль».</span>' : '');
}

var SCREENS = {

  home: function () {
    var next = LIVE ? null : DATA.upcoming[0];
    // фича 10 (рецепт moi-biznesy/home.md): у куратора двух дел и больше строки бара уезжают из «Работы» в карточку дела;
    // при одном деле «Клуб» прежний, ни одного нового нажатия
    var many = manyBiz(), barHere = DATA.barSide && !many;
    return (FLASH ? flash() : '') +
      // Cafe13KPG#1096 (слово владельца 25.11.2026: «мы пока отменили членство и это устаревшее штука»): плашки
      // членства — вид, «Активно», срок — на «Клубе» НЕТ ни у кого. Снят только показ: данные /me и ручки не тронуты.
      // Дверь «Пропуск» жила в плашке и осталась строкой на том же месте и с тем же условием (слово координатора):
      // у новичка без членства пропуска нет (№45), у члена — есть (№38). По ней live.cjs узнаёт кабинет (CABINET)
      (LIVE && !isMember() ? '' :
      '<button type="button" class="listitem" data-go="pass">' +
        '<span class="grow"><b>Пропуск</b></span>' + svg(ICON.chev, 'chev') +
      '</button>') +

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

      // шаг 3: «Я мастер» — под строкой «Пропуск» (кадр E54; плашки членства нет с #1096); у гостя пусто
      masterOffer() +
      // шаг 42: «Чайный мастер» — ниже «Провести», выше «Свой бизнес в клубе» (рецепт 42/home.md)
      teaMineBlock() +
      // шаг 13 (рецепт R1): «Свой бизнес в клубе» — ниже блока мастера. Шаг 14 (рецепт 14/bizWorkers): дверь «Работники»
      // в согласованном состоянии блока — одна на все бизнесы, выбор бизнеса на самом экране
      // шаг 16 (рецепт 16/home): дверь очереди согласования — партнёру по владению; счётчик по списку, null — без чипа
      partnerOffer((WIRED.bizWorkers ? '<button type="button" class="btn quiet" data-go="bizWorkers">Работники</button>' : '') +
        (cardPartnerDir() ? '<button type="button" class="listitem" data-go="barCards"><span class="grow"><b>Карточки на согласовании</b>' +
          '<span class="small">' + esc(waitSub(PCARDS.n, 'Что ждёт вашего решения')) + '</span></span>' + waitMark(PCARDS.n) + svg(ICON.chev, 'chev') + '</button>' : '') +
        // шаг 20 (рецепт 20/home): третья дверь — чтение, никого не ждёт, поэтому ниже очереди; суммы на двери нет
        ('<button type="button" class="listitem" data-go="bizMoney"><span class="grow"><b>Деньги бизнеса</b>' +
          '<span class="small">Чистая, ваша доля и доля клуба — за месяц</span></span>' + svg(ICON.chev, 'chev') + '</button>'),
        // остаток — СТРОКОЙ в карточке своего бизнеса (слово владельца «в карточке бизнеса»); договор — 20/ostatok.md
        bizWallet) +
      rolePanel() +

      (LIVE ? myRoles() +
        // фича 10: «Мои бизнесы» — на месте «Работы», перед ней; строка дела — выбор приёмом bizPick и вход в myBiz
        (many ? '<div class="group"><span class="label">Мои бизнесы</span>' + myBizList() + '</div>' : '') +
        // Одна группа «Работа»: бар и «Заявки на членство» (кадр E42g, Cafe13KPG#428) —
        // при барной роли строка главы клуба встаёт в ту же группу, а не во вторую «Работу».
        // «Люди» отсюда уехали во вкладку «Управление» (E46, Cafe13KPG#413): рабочее
        // не живёт внутри клиентского; в E42g они стояли здесь — кадр старше решения.
        // При двух делах и больше в ней остаются только «Заявки на членство»: это клубное, к делу не привязано
        (barHere || mayRequests() && WIRED.memberRequests ? '<div class="group"><span class="label">Работа</span>' +
          (barHere ? '<button type="button" class="listitem accent" data-go="barQueue">' +
            '<span class="grow"><b>Заказы на баре</b><span class="small">Очередь: принять, готово, выдан</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' +
          (mayCards() && !workerOnly() ? '<button type="button" class="listitem" data-go="barCards">' +
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

  /* фича 10 (рецепт moi-biznesy/myBiz.md): карточка дела — рабочие строки ЭТОГО дела. Дело выбрано до входа приёмом
     bizPick: BAR и BAR_PICK — оно. Без выбора сюда не входят (go ведёт на «Клуб»); строки — прежние строки «Клуба» */
  myBiz: function () {
    if (!BAR || BAR.id !== BAR_PICK) return '';
    var id = BAR.id;
    return shiftBlock() +
      '<div class="group"><span class="label clamp2">Бизнес «' + esc(BAR.title) + '»</span>' +
        '<button type="button" class="listitem accent" data-go="barQueue">' +
          '<span class="grow"><b>Заказы на баре</b><span class="small">Очередь: принять, готово, выдан</span></span>' +
          svg(ICON.chev, 'chev') + '</button>' +
        (mayCards() && !workerOnly() ? '<button type="button" class="listitem" data-go="barCards">' +
          '<span class="grow"><b>Карточки меню</b><span class="small">Новые позиции и утверждение</span></span>' +
          svg(ICON.chev, 'chev') + '</button>' : '') +
        (grant('curator', id) || grant('admin') ? '<button type="button" class="listitem" data-go="barMoney">' +
          '<span class="grow"><b>Доход и расход бара</b><span class="small">Выручка и затраты руками, с комментарием</span></span>' +
          svg(ICON.chev, 'chev') + '</button>' : '') +
        bizWallet(id) +
      '</div>';
  },

  guest: function () {
    if (LIVE) {
      // шаг 19 (рецепт 19/guest.md): строка на каждый АКТИВНЫЙ бизнес, порядок серверный; метка — только «закрыт»;
      // подписи нет — описания сервер не отдаёт; без accent — главного действия среди N строк нет
      return '<div class="group"><span class="label">Бизнесы клуба</span>' +
          (KLUB_BIZ.list === null
            ? (KLUB_BIZ.fail ? '<div class="card strong"><h2>Бизнесы не загрузились</h2><p class="verbatim">' + esc(KLUB_BIZ.fail) + '</p>' +
                '<button type="button" class="btn" data-action="klub-biz-retry">Повторить</button></div>' : '')
            : !KLUB_BIZ.list.length ? '<div class="card quiet"><span class="small">Пока ни одного бизнеса.</span></div>'
            : KLUB_BIZ.list.map(function (b) {
                return '<button type="button" class="listitem" data-action="klub-biz:' + b.id + '">' +
                  '<span class="grow"><b class="clamp2">' + esc(b.title) + '</b></span>' +
                  (b.is_open ? '' : '<span class="pill">закрыт</span>') + svg(ICON.chev, 'chev') + '</button>';
              }).join('')) +
        '</div>' + teaEntry() +
        // шаг 15 (рецепт 15/barCards): дверь РАБОТНИКА бизнеса — по его праву, а не mayCards(): у барной стороны
        // двери уже две («Клуб», «Заказы»). «Работа» — то же слово, что на «Клубе»; подпись — без «утверждения»:
        // утверждает куратор, и чужое слово обещало бы право шага 16
        (grant('worker') ? '<div class="group"><span class="label">Работа</span>' +
          '<button type="button" class="listitem" data-go="barCards">' +
            '<span class="grow"><b>Карточки меню</b><span class="small">Завести позицию и отправить на утверждение</span></span>' +
            svg(ICON.chev, 'chev') + '</button></div>' : '');
      // «Услуги острова — ещё не подключено» снято: оно обещало раздел, которого
      // у клуба нет (решение владельца, Cafe13KPG#102, со слов координатора).
      // Вернуть, когда у клуба появятся настоящие услуги и ручка под них.
    }
    return '' +
      // демо — ОДИН бизнес (слово владельца 21.10.2026: выдуманных позиций нет), название из DATA.bar.title
      '<div class="group"><span class="label">Бизнесы клуба</span>' +
        '<button type="button" class="listitem" data-go="bar">' +
          '<span class="grow"><b class="clamp2">' + esc(DATA.bar.title) + '</b></span>' +
          (DATA.bar.open ? '' : '<span class="pill">закрыт</span>') + svg(ICON.chev, 'chev') +
        '</button>' +
      '</div>' + teaEntry() +
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
          '<span style="font-size:12px;color:#B8B6AE">' + esc(m.level + (m.lifelong ? ' · пожизненно' : '')) + '</span></span>' +
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
