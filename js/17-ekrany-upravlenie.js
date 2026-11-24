Object.assign(SCREENS, {

  // E46: ровно два входа — решение владельца 28.10.2026 (#413). «Заявки на членство» (E42)
  // остаются на главной: это другая очередь, для уже допущенных.
  manage: function () {
    // v100: две группы, каждая по своему праву — «Кто в клубе» у главы, «Деньги» у ответственного
    // за пополнения (кадр E46, Cafe13KPG#586). Ни одного права — прежний отказ.
    if (!mayPeople() && !mayTopups() && !mayMasters() && !mayOps() && !(LIVE && msIsMaster()) && !mayWithdraw()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Просьбы о вступлении смотрит и решает глава клуба.</span></div></div>';
    // пока счёт не пришёл — не ноль: ноль значил бы «никто не просится» (кадр E46). То же у денег:
    // `pending` приходит в ответе очереди, и «Ждут решения: 0» отличается от «не посчитано»
    var wait = JOINQ.list ? JOINQ.list.filter(function (q) { return q.status === 'pending'; }).length : null;
    // шаг 11 (кадр E46д, Cafe13KPG#857): группа «Деньги» — у того, кто вправе хоть одну её строку; каждая строка —
    // под СВОИМ правом. Распределяет арт-директор, а пополнения решает ответственный за них: группа на одном
    // `mayTopups()` прятала вход от того, кому он. Вторая группа с тем же заголовком читалась бы вторым разделом
    var money_ = mayTopups() || mayMasters() || mayWithdrawQueue() || mayWithdraw() ? '<div class="group"><span class="label">Деньги</span>' +
      (mayTopups() ? '<button type="button" class="listitem" data-go="topupQueue"><span class="grow"><b>Заявки на пополнение</b>' +
        '<span class="small">' + waitSub(TOPQ.pending, 'Кто просит пополнить счёт') + '</span></span>' +
        waitMark(TOPQ.pending) + svg(ICON.chev, 'chev') + '</button>' : '') +
      (mayMasters() ? '<button type="button" class="listitem" data-go="payouts"><span class="grow"><b>Распределить деньги</b>' +
        '<span class="small">' + waitSub(PAY.pending, 'Доли с прошедших мероприятий') + '</span></span>' +
        waitMark(PAY.pending) + svg(ICON.chev, 'chev') + '</button>' : '') +
      // шаг 25: Q1 — очередь выводов у держателя `admin`, число ждущих — сервера; W1 — дверь мастера к своему выводу
      (mayWithdrawQueue() ? '<button type="button" class="listitem" data-go="withdrawQueue"><span class="grow"><b>Запросы на вывод</b></span>' +
        waitMark(WQ.pending) + svg(ICON.chev, 'chev') + '</button>' : '') +
      (mayWithdraw() ? '<button type="button" class="listitem" data-go="withdraw"><span class="grow"><b>Вывести деньги</b></span>' +
        svg(ICON.chev, 'chev') + '</button>' : '') + '</div>' : '';
    // шаг 3: дверь «Слоты и мастера» — группой, как «Деньги» (слово владельца: «во вкладке управление — управление этими ивентами»)
    // «Ивенты», а не «Мероприятия» — слово владельца 29.10.2026 по прототипу: «Не мероприятия а ивенты»
    // шаг 4: «Свои ивенты» — в той же группе, у всякого, кто ведёт свои (мастер, организатор, работник)
    var own = mayOwnEvents() ? '<button type="button" class="listitem" data-go="organizer"><span class="grow"><b>Свои ивенты</b>' +
        '<span class="small">Записавшиеся, места и описание</span></span>' + svg(ICON.chev, 'chev') + '</button>' : '';
    var art = mayMasters() || own ? '<div class="group"><span class="label">Ивенты</span>' +
      (mayMasters() ? '<button type="button" class="listitem" data-go="masters"><span class="grow"><b>Слоты и мастера</b>' +
        '<span class="small">' + waitSub(MR.pending, 'Заявки в мастера, ивенты, слоты') + '</span></span>' +
        waitMark(MR.pending) + svg(ICON.chev, 'chev') + '</button>' : '') + own + '</div>' : '';
    // шаг 12 (кадр E46е, Cafe13KPG#877): «Бизнесы» — у операционного директора (и админа). Пометки ждущих нет:
    // ждать тут нечему до шага 13, его строка «Заявки в партнёры» ляжет в эту же группу
    var biz = mayOps() ? '<div class="group"><span class="label">Бизнесы</span>' +
      '<button type="button" class="listitem" data-go="businesses"><span class="grow"><b>Бизнесы клуба</b>' +
        '<span class="small">Кто партнёр и открыта ли смена</span></span>' + svg(ICON.chev, 'chev') + '</button>' +
      // шаг 13 (рецепт R3): «Заявки в партнёры» — под «Бизнесами клуба», счётчик ждущих чипом `.count`; не загрузилось —
      // строка есть, счётчика нет (счётчик не выдумывается)
      '<button type="button" class="listitem" data-go="partnerReqs"><span class="grow"><b>Заявки в партнёры</b>' +
        '<span class="small">' + waitSub(PR.pending, 'Кто просит бизнес в клубе') + '</span></span>' +
        waitMark(PR.pending) + svg(ICON.chev, 'chev') + '</button></div>' : '';
    if (!mayPeople()) return money_ + art + biz;
    return '<div class="group"><span class="label">Кто в клубе</span>' +
      '<button type="button" class="listitem" data-go="joinQueue"><span class="grow"><b>Заявки на доступ</b>' +
        '<span class="small">' + waitSub(wait, 'Кто просится в клуб') + '</span></span>' +
        waitMark(wait) + svg(ICON.chev, 'chev') + '</button>' +
      '<button type="button" class="listitem" data-go="people"><span class="grow"><b>Члены клуба</b>' +
        '<span class="small">Кто в клубе и с какими уровнями</span></span>' + svg(ICON.chev, 'chev') + '</button>' +
      // шаг 31 (рецепт 31/clubStats, C0): статистика клуба — у главы и админа, тот же предикат, что у группы
      (mayClubStats() ? '<button type="button" class="listitem" data-go="clubStats"><span class="grow"><b>Статистика клуба</b></span>' +
        svg(ICON.chev, 'chev') + '</button>' : '') +
    '</div>' + money_ + art + biz;
  },

  // ── шаг 13 (Cafe13KPG#889): рецепт `_docs/recept/ekran/13-zayavka-v-partnyory.md` (cafe13-miniapp#257) ──
  // R2: форма. Цена и остаток — до нажатия; «спишется» — число сервера, своей арифметики нет
  partnerApply: function () {
    if (LIVE && DATA.role === 'guest') return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Заявку в партнёры подаёт член клуба.</span></div></div>';
    var p = PR.price, bal = msBalance();
    var err = PR.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(PR.err) + '</span></div>' : '';
    return '<div class="field"><label for="pr-title">Название бизнеса</label><input id="pr-title" value="' + esc(PR.title) + '">' +
        '<span class="small">Как его назовут гости</span></div>' +
      '<div class="field"><label for="pr-about">О бизнесе</label><textarea id="pr-about" rows="3">' + esc(PR.about) + '</textarea>' +
        '<span class="small">Одной строкой: чем он занимается</span></div>' +
      '<div class="rows">' +
        '<div><span class="small">Спишется сейчас</span><b class="num">' + (typeof p === 'number' ? money(p) + ' ฿' : p === null ? 'цену не узнать' : '…') + '</b></div>' +
        '<div><span class="small">На счёте</span><b class="num">' + money(bal) + ' ฿</b></div></div>' +
      (p === null ? '<div class="row"><span class="small">Цену не удалось узнать у сервера.</span>' +
        '<button type="button" class="btn quiet" data-action="pr-retry-price">Повторить</button></div>' : '') +
      err +
      '<button type="button" class="btn" data-action="pr-send"' + (PR.busy || typeof p !== 'number' || p > bal ? ' disabled' : '') + '>' +
        (PR.busy ? 'Отправляем…' : 'Подать заявку') + '</button>' +
      '<div class="note">' + svg(ICON.info) + '<span>Решение принимает операционный директор. Если он откажет, деньги вернутся на счёт.</span></div>';
  },

  // R4: очередь. Ждущие сверху — так отдаёт сервер (`list_requests`); решённые остаются со своим словом
  partnerReqs: function () {
    if (LIVE && !mayOps()) return '<div class="deny" role="alert">' + svg(ICON.info) + '<span>Сюда нельзя. ' +
      '<span class="verbatim">Заявки в партнёры решает операционный директор.</span></span></div>';
    if (!PR.q) return PR.qFail ? '<div class="card quiet"><div class="row"><span class="small">Заявки в партнёры не загрузились: ' + esc(PR.qFail) + '</span>' +
        '<button type="button" class="btn quiet" data-action="pr-retry-q">Повторить</button></div></div>'
      : '<div class="card quiet"><span class="small">Загружаем заявки…</span></div>';
    if (!PR.q.length) return (FLASH ? flash() : '') + '<div class="card quiet"><span class="small">Заявок в партнёры нет.</span></div>';
    return (FLASH ? flash() : '') + PR.q.map(function (q) {
      return '<button type="button" class="listitem" data-action="pr-open:' + q.id + '"><span class="grow">' +
          '<b class="clamp1">' + esc(q.title) + '</b><span class="small clamp1">' + esc((q.who || 'Без имени') + ' · ' + topupDay(q.iso, true)) + '</span></span>' +
          '<span class="pill' + (q.status === 'pending' ? ' on' : '') + '">' + esc(q.word) + '</span>' + svg(ICON.chev, 'chev') + '</button>';
    }).join('');
  },

  // R5: решение. «Оплачено до …» здесь нет: ответ decide даты не несёт (рецепт), дата — на «Клубе» партнёра
  partnerReq: function (id) {
    if (LIVE && !mayOps()) return SCREENS.partnerReqs();
    if (!PR.q) return SCREENS.partnerReqs();
    var q = PR.q.filter(function (x) { return x.id === Number(id); })[0];
    if (!q) return '<div class="card quiet"><div class="col"><b>Такой заявки нет</b>' +
      '<span class="small">Вернитесь к заявкам в партнёры.</span></div></div>';
    // своя — по номеру заявки в СВОИХ (`/partner/requests/mine`): номер человека в разметку не идёт
    var own = !!(PR.mine && PR.mine.some(function (x) { return x.id === q.id; }));
    var busy = PR.busy ? ' disabled' : '';
    var err = PR.qErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(PR.qErr) + '</span></div>' : '';
    return (FLASH ? flash() : '') +
      '<div class="card"><div class="col"><b class="clamp2">' + esc(q.title) + '</b><span class="small">' + esc((q.who || 'Без имени') + ' · ' + topupDay(q.iso, true)) + '</span></div></div>' +
      // описание — тушью, не подписью: на нём стоит решение (рецепт R5). `<div>`, а не `<p>`: `p` у нас приглушённый
      // (styles.css:207), тушь и 15 px `div` берёт от body. Переводы строк заявителя сохранены
      (q.about ? '<div class="card quiet"><div style="white-space:pre-wrap">' + esc(q.about) + '</div></div>' : '') +
      '<div class="rows"><div><span class="small">Списано</span><b class="num">' + money(q.amount) + ' ฿</b></div></div>' +
      err +
      (q.status !== 'pending' ? '<div class="card quiet"><div class="row"><span class="small">Решено ' + esc(topupDay(q.done, true)) + '</span>' +
          '<span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span></div>' + (q.note ? '<span class="said">' + esc(q.note) + '</span>' : '') + '</div>'
      : own ? '<div class="note">' + svg(ICON.info) + '<span>Свою заявку решает другой операционный директор.</span></div>'
      : PR.ask === q.id ? '<div class="field"><label for="pr-note">Причина отказа</label>' +
          '<textarea id="pr-note" rows="4" maxlength="500">' + esc(PR.note) + '</textarea>' +
          '<span class="small">Что исправить, чтобы согласовали</span></div>' +
        '<button type="button" class="btn" data-action="pr-no:' + q.id + '"' + (PR.busy || !PR.note.trim() ? ' disabled aria-disabled="true"' : ' aria-disabled="false"') +
          ' aria-describedby="pr-why">' + (PR.busy ? 'Отправляем…' : 'Отказать') + '</button>' +
        '<span class="small" id="pr-why"' + (PR.note.trim() ? ' hidden' : '') + '>Сначала причина — без неё заявитель не узнает, что исправить.</span>' +
        '<button type="button" class="btn quiet" data-action="pr-keep"' + busy + '>Назад</button>'
      : '<button type="button" class="btn" data-action="pr-yes:' + q.id + '"' + busy + '>' + (PR.busy ? 'Отправляем…' : 'Согласовать') + '</button>' +
        '<button type="button" class="btn quiet" data-action="pr-ask:' + q.id + '"' + busy + '>Отказать</button>' +
        '<div class="note">' + svg(ICON.info) + '<span>Согласие создаёт бизнес и начинает оплаченный месяц. Отказ вернёт деньги заявителю.</span></div>');
  },

  // ── шаг 14 (Cafe13KPG#545): рецепт `_docs/recept/ekran/14/bizWorkers.md`; выбор бизнеса и слова неоплаченного —
  // письмо designer-55 18.11.2026 (правка рецепта следом). Вход — «Работники» в блоке «Свой бизнес в клубе» на «Клубе»
  bizWorkers: function () {
    var dirs = LIVE ? BW.dirs : [{ id: 0, title: 'Кофейня', active: true }];
    var bizId = LIVE ? BW.biz : 0, list = LIVE ? BW.list : [];
    var retry = function (words, why, act) {
      return '<div class="card quiet"><div class="row"><span class="small">' + words + esc(why) + '</span>' +
        '<button type="button" class="btn quiet" data-action="' + act + '">Повторить</button></div></div>';
    };
    if (!dirs) return BW.dirsFail ? retry('Ваши бизнесы не загрузились: ', BW.dirsFail, 'bw-retry-biz')
      : '<div class="card quiet"><span class="small">Загружаем ваши бизнесы…</span></div>';
    if (!dirs.length) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Работников назначает партнёр своего бизнеса.</span></div></div>';
    var b = dirs.filter(function (x) { return x.id === bizId; })[0] || null;
    var head = '<span class="small">Назначенный работник появится в этом списке. Что ему будет видно в приложении — решают следующие шаги.</span>' +
      (BW.lost ? '<div class="note">' + svg(ICON.info) + '<span>Прежде выбранный бизнес больше не ваш.</span></div>' : '');
    // один бизнес — выбора нет; два и больше — переключатель формы «Смотреть как» (js/20), слова — названия сервера
    var pick = dirs.length === 1 ? '<span class="small">Бизнес „' + esc(dirs[0].title) + '“</span>'
      : '<div class="group"><span class="label">Ваши бизнесы</span>' + dirs.map(function (x) {
          return '<button type="button" class="listitem" data-action="bw-biz:' + x.id + '"' + (x.id === bizId ? ' aria-current="true"' : '') + '>' +
            '<span class="grow"><b class="clamp1">' + esc(x.title) + '</b></span>' +
            (x.id === bizId ? '<span class="pill on">сейчас</span>' : svg(ICON.chev, 'chev')) + '</button>';
        }).join('') + '<span class="small">Работника назначают в один бизнес. Выберите, в какой.</span></div>';
    if (!b) return head + pick;
    var off = BW.busy || BW.ask !== null ? ' disabled' : '';
    var rows = !list ? (BW.listFail ? retry('Работники бизнеса не загрузились: ', BW.listFail, 'bw-retry')
        : '<div class="card quiet"><span class="small">Загружаем работников…</span></div>')
      : !list.length ? '<div class="note">' + svg(ICON.info) + '<span>Работников пока нет. Назначьте первого — номер он узнает у бота.</span></div>'
      : list.map(function (w) {
          var asked = BW.ask === b.id + ':' + w.rid;
          return '<div class="listitem"><span class="grow"><b class="clamp1">' + esc(w.name) + '</b>' +
              '<span class="small">' + esc(ROLE_NAME.worker) + '</span></span>' +
              (w.elsewhere ? '<span class="pill">и в другом бизнесе</span>' : '') +
              (asked ? '' : '<button type="button" class="btn quiet" data-action="bw-revoke:' + w.rid + '"' + off + '>Снять</button>') + '</div>' +
            (asked ? '<div class="undo"><span class="small">Снимаем: ' + esc(w.name) + '</span>' +
              '<span class="sec">' + undoLeft() + '</span><button type="button" data-action="bw-keep">Отменить</button></div>' : '');
        }).join('');
    var seal = function (t) { return '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(t) + '</span></div>'; };
    var err = !BW.err ? '' : BW.err.seal ? seal(BW.err.text)
      : '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(BW.err.text) + '</span></div>';
    // неоплаченный (развилка 3): поле и кнопка погашены, запроса нет; слова — клиента (печати до запроса не существует)
    var shut = b.active ? '' : ' disabled';
    var bot = tg && typeof tg.openTelegramLink === 'function' ? '<u role="link" tabindex="0" data-action="bw-bot">@userinfobot</u>' : '@userinfobot';
    return head + pick +
      '<div class="group"><span class="label">Кто работает</span>' + rows +
        (BW.rowErr ? seal(BW.rowErr) : '') +
        (BW.done ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(BW.done) + '</span></div>' : '') + '</div>' +
      '<div class="group"><span class="label">Назначить работника</span>' +
        (b.active ? '' : '<div class="deny" role="alert">' + svg(ICON.info) + '<span>Оплаченный месяц бизнеса закончился. ' +
          'Назначать работников можно после оплаты — уже назначенные работают дальше.</span></div>') +
        '<div class="field"><label for="bw-uid">Telegram ID</label><input id="bw-uid" inputmode="numeric" autocomplete="off" value="' + esc(BW.uid) + '"' + shut + '>' +
          '<span class="small">Свой номер человек узнаёт у бота ' + bot + ' — в Telegram, за полминуты. Попросите его прислать номер вам.</span></div>' +
        err +
        '<button type="button" class="btn" data-action="bw-send"' + (shut || (BW.busy ? ' disabled' : '')) + '>' + (BW.busy ? 'Назначаем…' : 'Назначить') + '</button>' +
        '<div class="note">' + svg(ICON.info) + '<span>Имя появится в списке ПОСЛЕ назначения. Ошиблись номером — снимите строку и назначьте снова.</span></div>' +
      '</div>';
  },

  // ── шаг 20 (Cafe13KPG#551): рецепт `_docs/recept/ekran/20/bizMoney.md`, договор остатка `20/ostatok.md`.
  // Сверху остаток (сколько ЕСТЬ), ниже отчёт месяца (откуда). Выбор бизнеса — общий с bizWorkers (`BW.dirs`, `BW.biz`)
  bizMoney: function () {
    var dirs = LIVE ? BW.dirs : [{ id: 0, title: 'Кофейня', active: true, wallet: { sum: 0, through: null } }];
    var bizId = LIVE ? BW.biz : 0;
    var m = LIVE ? (MM.biz === bizId ? MM.data : null)
      : { title: 'Кофейня', start: Date.parse('2026-10-31T17:00:00Z'), revenue: 52000, opex: 31000, net: 21000, invest: 0,
          clubPct: 30, club: 6300, partnerPct: 70, partner: 14700 };
    var quiet = function (body) { return '<div class="card quiet">' + body + '</div>'; };
    var retry = function (why, act) {
      return quiet('<div class="row"><span class="small">' + esc(why) + '</span>' +
        '<button type="button" class="btn quiet" data-action="' + act + '">Повторить</button></div>');
    };
    var no = quiet('<div class="col"><b>Сюда нельзя</b><span class="small">Деньги бизнеса видит его партнёр, куратор направления или глава клуба.</span></div>');
    if (!dirs) return BW.dirsFail ? retry(BW.dirsFail, 'bm-retry-biz') : quiet('<span class="small">Загружаем деньги бизнеса…</span>');
    if (!dirs.length) return no;
    var b = dirs.filter(function (x) { return x.id === bizId; })[0] || null;
    var pick = dirs.length === 1 ? '' : '<div class="group"><span class="label">Ваши бизнесы</span>' + dirs.map(function (x) {
      return '<button type="button" class="listitem" data-action="bm-biz:' + x.id + '"' + (x.id === bizId ? ' aria-current="true"' : '') + '>' +
        '<span class="grow"><b class="clamp1">' + esc(x.title) + '</b></span>' +
        (x.id === bizId ? '<span class="pill on">сейчас</span>' : svg(ICON.chev, 'chev')) + '</button>';
    }).join('') + '</div>';
    if (!b) return (BW.lost ? '<div class="note">' + svg(ICON.info) + '<span>Прежде выбранный бизнес больше не ваш.</span></div>' : '') + pick;
    // шапка: остаток главным числом; «раз в месяц» — при ЛЮБОМ состоянии (вариант C владельца)
    var w = b.wallet, k = walletKind(w);
    var say = { 'null': 'доли ещё не назначены', wait: 'доля будет зачислена по закрытию месяца', zero: 'по закрытым месяцам зачислять было нечего' };
    var head = '<div class="card strong"><div class="col"><span class="small">На счёте</span>' +
        (k === 'sum' ? '<h2 class="num">' + esc(bmSum(w.sum)) + '</h2>' : k === 'dash' ? '<h2 class="num">—</h2>' : '<b>' + esc(say[k]) + '</b>') +
        '<span class="small">Доля зачисляется раз в месяц, по закрытию. Продажи месяца видны ниже.</span>' +
        (k === 'dash' ? '<span class="small">Остаток сервер пока не отдаёт — у ручки нет поля. Прочерк значит «не спросили», а не «ноль».</span>' : '') +
        // `wallet_through` — КОНЕЦ периода: месяц берётся у мгновения ПЕРЕД ним (у полуночи 1 ноября — октябрь)
        (w && w.through ? '<span class="small">Зачислено по ' + esc(bmMonth(Date.parse(w.through) - 1).toLowerCase()) + '</span>' +
          '<span class="small">Счёт ведётся с месяца, когда появился в клубе: за прежние месяцы доли на него не зачислялись.</span>' : '') +
        '<span class="small">Бизнес „' + esc(b.title) + '“ · месяц по Пхангану</span></div></div>';
    /* шаг 26 (рецепт 26/bizMoney): блок «Вывод» ПОД шапкой — следует выбранному бизнесу. Доли не назначены или поля
       остатка нет — блока нет: выводить нечего. Без списка запросов формы нет: партнёр подал бы второй вслепую. */
    var wd = '';
    if (k !== 'null' && k !== 'dash') {
      var wl = LIVE ? (BWD.biz === bizId ? BWD.list : null) : [], wbusy = BWD.busy ? ' disabled' : '';
      var b2 = '<span class="small">Вывести можно остаток этого бизнеса — его долю за закрытые месяцы. Запрос решает администратор клуба; ' +
        'приложение записывает запрос и решение, как клуб передаст деньги — не решает.</span>';
      wd = !wl ? quiet('<div class="col"><b>Вывод</b>' + b2 + '</div>') + (BWD.fail
          ? quiet('<div class="col"><b>Запросы не загрузились.</b><span class="verbatim">' + esc(BWD.fail) + '</span></div>' +
              '<button type="button" class="btn" data-action="bm-wd-retry">Повторить</button>')
          : quiet('<span class="small">Загружаем запросы…</span>'))
        : '<div class="card"><div class="col"><b>Вывод</b>' + b2 + '</div>' +
            '<div class="field"><label for="bm-wd-amount">Сколько вывести, ฿</label>' +
              '<input id="bm-wd-amount" inputmode="decimal" autocomplete="off" value="' + esc(BWD.amount) + '"></div>' +
            '<button type="button" class="btn" data-action="bm-wd-send"' + wbusy + '>Попросить вывод</button></div>' +
          (BWD.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(BWD.err) + '</span></div>' : '') +
          (!wl.length ? quiet('<span class="small">Запросов на вывод ещё не было.</span>')
            : '<div class="rows">' + wl.map(function (q) {
                return '<div><div class="col"><b class="num">' + money(q.sum) + ' ฿</b>' +
                    '<span class="small">' + esc(askedWhen(q.iso, true)) + '</span>' +
                    (q.status === 'rejected' && q.answer ? '<span class="small">' + esc(q.answer) + '</span>' : '') +
                    (q.status === 'pending' ? '<button type="button" class="btn ghost" data-action="bm-wd-cancel:' + q.id + '"' + wbusy + '>Отменить запрос</button>' : '') +
                  '</div><span class="pill' + WD_PILL[q.status] + '">' + WD_WORD[q.status] + '</span></div>';
              }).join('') + '</div>');
      wd = '<div data-bwd style="display:contents">' + wd + '</div>';   // метка блока для случаев: отчёт месяца сверяют без него
    }
    var body;
    if (!m) {
      body = MM.code === 409 ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(MM.fail) + '</span></div>' +
          '<div class="note">' + svg(ICON.info) + '<span>Как только доли появятся, здесь будут выручка, затраты и доли.</span></div>'
        : MM.code === 403 ? no
        : MM.fail ? retry(MM.fail, 'bm-retry') : quiet('<span class="small">Загружаем деньги бизнеса…</span>');
    } else if (m.bad) {
      body = '<div class="deny" role="alert">' + svg(ICON.info) + '<span>Числа отчёта не сходятся между собой — показывать их нельзя. Сообщите администратору клуба.</span></div>';
    } else {
      // проценты — числа сервера без нулевого хвоста: «30 %», а не «30.00 %»
      var pct = function (n) { return String(Number(n)).replace('.', ','); };
      body = '<h2>' + esc(bmMonth(m.start)) + '</h2>' +
        '<div class="group"><span class="label">Итог месяца</span><div class="rows">' +
          '<div><span class="small">Выручка</span><b class="num">' + esc(bmSum(m.revenue)) + '</b></div>' +
          '<div><span class="small">Текущие затраты</span><b class="num">' + esc(bmSum(m.opex)) + '</b></div>' +
          '<div><span>Чистая прибыль</span><b class="num">' + esc(bmSum(m.net)) + '</b></div>' +
        '</div></div>' +
        '<div class="group"><span class="label">Как делится</span><div class="rows">' +
          // пустая доля партнёра — СЛОВА, а не «0 ฿»: null значит «не назначали», а не ноль
          '<div><span>Ваша доля' + (m.partnerPct === null ? '</span><span class="small">не назначена</span>'
            : ' · <span class="num">' + pct(m.partnerPct) + ' %</span></span><b class="num">' + esc(bmSum(m.partner)) + '</b>') + '</div>' +
          '<div><span class="small">Клубу · <span class="num">' + pct(m.clubPct) + ' %</span></span><b class="num">' + esc(bmSum(m.club)) + '</b></div>' +
        '</div>' +
        (m.partnerPct === null ? '<span class="small">Долю партнёра у этого бизнеса ещё не назначили.</span>'
          : m.net <= 0 ? '<span class="small">За месяц прибыли нет: доли считаются только с прибыли, поэтому обе по нулю.</span>'
          : '<span class="small">Ваша доля зачислится на счёт по закрытию месяца.</span>') + '</div>' +
        (m.invest > 0 ? '<div class="group"><span class="label">Вложения</span><div class="rows">' +
          '<div><span class="small">Вложения за месяц</span><b class="num">' + esc(bmSum(m.invest)) + '</b></div></div>' +
          '<span class="small">В чистую прибыль и в доли не входят — возвращаются из вашей доли.</span></div>' : '');
    }
    return head + wd + pick + body +
      '<button type="button" class="btn quiet" data-action="bm-refresh">Обновить</button>' +
      '<div class="note">' + svg(ICON.info) + '<span>Ошибочную строку отменяет администратор клуба — отменённое в отчёт не входит.</span></div>';
  },

  /* шаг 25 (рецепт 25/withdrawQueue, поправка #355): очередь решений у держателя `admin`. Экран один — решение в карточке.
     Q2 стоит ВСЕГДА: «Одобрить» без него читалось бы как перевод денег, которого приложение не делает. «Не в минус»
     решает сервер на одобрении; отказ — в карточке словами сервера, карточка остаётся. */
  withdrawQueue: function () {
    if (!mayWithdrawQueue()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Запросы на вывод решает администратор клуба.</span></div></div>';
    var q2 = '<div class="card quiet"><span class="small">Одобрение списывает сумму со счёта человека. Деньги клуб передаёт сам — приложение их не переводит.</span></div>';
    var done = WQ.done ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(WQ.done) + '</span></div>' : '';
    if (!WQ.list) return done + q2 + (WQ.fail
      ? '<div class="card quiet"><div class="col"><b>Запросы не загрузились.</b><span class="verbatim">' + esc(WQ.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="wq-retry">Повторить</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем запросы…</span></div>');
    var wait = WQ.list.filter(function (q) { return q.status === 'pending'; });
    if (!wait.length) return done + q2 + '<div class="card quiet"><span class="small">Запросов на вывод нет.</span></div>';
    return done + q2 + wait.map(function (q) {
      var busy = WQ.busy ? ' disabled' : '';
      return '<div class="card"><div class="row"><div class="col"><b class="clamp1">' + esc(q.name) + '</b>' +
          '<span class="small">' + esc(askedWhen(q.iso, true)) + '</span>' +
          '<span class="small">Счёт: ' + esc(q.account === 'business' ? 'бизнес „' + q.dirTitle + '“' : WD_BOOK[q.book] || q.book) + '</span></div>' +
          '<b class="num">' + money(q.sum) + ' ฿</b></div>' +
        (WQ.err[q.id] ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(WQ.err[q.id]) + '</span></div>' : '') +
        (q.mine ? '<span class="small">Это ваш собственный запрос: просите и решаете вы сами. В записи останутся оба имени — ваше дважды.</span>' : '') +
        '<button type="button" class="btn" data-action="wq-ok:' + q.id + '"' + busy + '>Одобрить</button>' +
        '<div class="field"><label for="wq-note-' + q.id + '">' + (q.account === 'business' ? 'Причина — её увидит партнёр' : 'Причина — её увидит мастер') + '</label>' +
          '<input id="wq-note-' + q.id + '" autocomplete="off" maxlength="500" value="' + esc(WQ.note[q.id] || '') + '"></div>' +
        '<button type="button" class="btn ghost" data-action="wq-no:' + q.id + '"' + busy + '>Отказать</button></div>';
    }).join('');
  },

  /* шаги 27, 29, 30 (рецепт 27/roleAccount): счёт роли — один экран на троих, счёт приходит параметром (строка R1 на «Клубе»).
     R2 стоит ВСЕГДА: счёт общий у держателей роли. Остаток — `GET /withdraw/accounts`, с суммой его клиент не сравнивает.
     В списке — свои запросы с этого счёта и ждущий запрос счёта; чужой ждущий — без «Отменить» и без имени: форма
     отдаёт у ждущего только номер, сумму и время (кто просил — в форме нет). */
  roleAccount: function (acc) {
    if (!mayRoleAccount(acc)) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Счёт роли видит тот, кто держит эту роль.</span></div></div>';
    var r2 = '<span class="small">Это счёт роли, а не ваш личный: вывести из него может любой, кто держит эту роль. ' +
      'Запрос решает администратор клуба; приложение записывает запрос и решение, как клуб передаст деньги — не решает.</span>';
    if (!RA.accs || !RA.mine) return RA.fail
      ? '<div class="card quiet"><div class="col"><b>Счёт не загрузился.</b><span class="verbatim">' + esc(RA.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="ra-retry">Повторить</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем счёт…</span></div>';
    var a = RA.accs[acc];
    // счёт не назван сервером — права на него нет (сервер не кладёт в список счёт без права): формы не показываем
    if (!a) return '<div class="card quiet"><div class="col"><b>Счёт не загрузился.</b><span class="verbatim">Сервер не назвал этот счёт среди ваших.</span></div>' +
        '<button type="button" class="btn" data-action="ra-retry">Повторить</button></div>';
    var busy = RA.busy ? ' disabled' : '';
    var list = RA.mine.slice();
    if (a.pending && !list.some(function (q) { return q.id === a.pending.id; }))
      list.unshift({ id: a.pending.id, status: 'pending', sum: a.pending.sum, iso: a.pending.iso, answer: '', other: true });
    return '<div class="card"><div class="col"><b>' + esc(RA_WORD[acc]) + '</b>' +
        '<div class="row"><span class="small">На счёте:</span><b class="num">' + money(a.balance) + ' ฿</b></div>' + r2 + '</div>' +
        '<div class="field"><label for="ra-amount">Сколько вывести, ฿</label>' +
          '<input id="ra-amount" inputmode="decimal" autocomplete="off" value="' + esc(RA.amount) + '"></div>' +
        '<button type="button" class="btn" data-action="ra-send"' + busy + '>Попросить вывод</button></div>' +
      (RA.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(RA.err) + '</span></div>' : '') +
      (!list.length ? '<div class="card quiet"><span class="small">Запросов на вывод ещё не было.</span></div>'
        : '<div class="rows">' + list.map(function (q) {
            return '<div><div class="col"><b class="num">' + money(q.sum) + ' ฿</b>' +
                '<span class="small clamp1">' + esc((q.other ? 'другой держатель роли' : 'вы') + ' · ' + askedWhen(q.iso, true)) + '</span>' +
                (q.status === 'rejected' && q.answer ? '<span class="small">' + esc(q.answer) + '</span>' : '') +
                (q.status === 'pending' && !q.other ? '<button type="button" class="btn ghost" data-action="ra-cancel:' + q.id + '"' + busy + '>Отменить запрос</button>' : '') +
              '</div><span class="pill' + WD_PILL[q.status] + '">' + WD_WORD[q.status] + '</span></div>';
          }).join('') + '</div>');
  },

  // E56: очередь; E56b/E56v — заявка (чек снимком / PDF); E56g (подтверждение) снят по #695; E56d — причина; E56e — своя
  topupQueue: function () {
    // слова отказа — сервера (`_may_decide`, 403) буквой
    if (!mayTopups()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Заявки на пополнение решает ответственный за пополнения.</span></div></div>';
    if (!TOPQ.list) return TOPQ.fail
      ? '<div class="card strong"><h2>Заявки не загрузились</h2><p>' + esc(TOPQ.fail) + '</p>' +
        '<button type="button" class="btn" data-action="tq-retry">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем заявки…</span></div>';
    var wait = TOPQ.list.filter(function (q) { return q.status === 'pending'; });
    var past = TOPQ.list.filter(function (q) { return q.status !== 'pending'; });
    var done = TOPQ.done ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(TOPQ.done) + '</span></div>' : '';
    if (!wait.length && !past.length) return done + '<div class="card quiet"><div class="col"><b>Заявок нет</b>' +
      '<span class="small">Здесь появятся заявки на пополнение — члены клуба присылают их с чеком перевода.</span></div></div>';
    var who = function (q) { return q.mine ? 'вы' : q.name; };
    return done +
      (wait.length ? '<div class="group"><span class="label">Ждут решения</span>' + wait.map(function (q) {
        // ждущая строка ВЕДЁТ на заявку — решение живёт там (E56b); форма входа — `listitem`
        return '<button type="button" class="listitem" data-action="tq-open:' + q.id + '"><span class="grow">' +
            '<b class="num">' + money(q.sum) + ' ฿</b><span class="small">' + esc(who(q) + ' · ' + askedWhen(q.iso, true)) + '</span></span>' +
            '<span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span>' + svg(ICON.chev, 'chev') + '</button>';
      }).join('') + '</div>' : '') +
      (past.length ? '<div class="group"><span class="label">Решённые</span>' + past.map(function (q) {
        return '<div class="card quiet"><div class="row"><div class="col"><b class="num">' + money(q.sum) + ' ฿</b>' +
            '<span class="small">' + esc(who(q) + ' · ' + topupDay(q.done || q.iso, false)) + '</span></div>' +
            '<span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span></div>' +
          (q.status === 'rejected' && q.answer ? '<span class="small">' + esc(q.answer) + '</span>' : '') + '</div>';
      }).join('') + '</div>' : '');
  },

  topupReq: function (id) {
    if (!mayTopups()) return SCREENS.topupQueue();
    var q = (TOPQ.list || []).filter(function (x) { return x.id === Number(id); })[0];
    if (!q) return TOPQ.list ? '<div class="card quiet"><div class="col"><b>Такой заявки нет</b>' +
        '<span class="small">Её уже нет в очереди — вернитесь к заявкам.</span></div></div>' : SCREENS.topupQueue();
    var busy = TOPQ.busy ? ' disabled' : '';
    var rows = '<div class="rows">' +
      '<div><span class="small">Сумма</span><b class="num">' + money(q.sum) + ' ฿</b></div>' +
      '<div><span class="small">Способ</span><b>' + esc(q.way) + '</b></div>' +
      '<div><span class="small">Просит</span><b>' + esc(q.mine ? 'вы' : q.name) + '</b></div>' +
      '<div><span class="small">Когда</span><b>' + esc(topupDay(q.iso, true)) + '</b></div></div>';
    var err = TOPQ.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TOPQ.err) + '</span></div>' : '';
    if (q.status !== 'pending') return rows + err + '<div class="card quiet"><div class="row"><span class="small">Решено ' +
        esc(topupDay(q.done, true)) + '</span><span class="st ' + TOPQ_ST[q.status] + '">' + esc(q.word) + '</span></div>' +
        (q.answer ? '<span class="small">' + esc(q.answer) + '</span>' : '') + '</div>';
    // E56d. ⚠ Кнопка в кадре — «Отказать и вернуть деньги»; сервер при отказе денег не двигает
    // (`decide_request`: только статус и причина) — обещание возврата не ставлю (вопрос designer-55)
    if (TOPQ.step === 'no' && !q.mine) return rows + err +
      '<div class="field"><label for="tq-note">Причина отказа</label>' +
        '<textarea id="tq-note" rows="3" maxlength="500">' + esc(TOPQ.note) + '</textarea>' +
        '<span class="small">Человек увидит её в своей истории. Оставите пустым — он увидит «Мы не получили деньги».</span></div>' +
      '<button type="button" class="btn" data-action="tq-no:' + q.id + '"' + busy + '>' + (TOPQ.busy ? 'Отправляем…' : 'Отказать') + '</button>' +
      '<button type="button" class="btn quiet" data-action="tq-keep"' + busy + '>Назад</button>';
    var sh = TOPQ.shot[q.id] || {}, pdf = q.mime === 'application/pdf';
    var box = 'height:120px;display:flex;align-items:center;justify-content:center;color:var(--muted);overflow:hidden';
    // PDF в <img> не показать; «открыть» не ставлю: откроет ли вебвью Telegram objectURL PDF, не мерено
    // (#413). Слова — как у очереди доступа (кадр E56v приведён к ним designer-55)
    var inner = pdf ? '<div class="box" style="' + box + ';text-align:center">PDF<br>показать нечем</div>'
      : sh.url ? '<div class="box" style="' + box + ';padding:0"><img src="' + sh.url + '" alt="Чек" style="width:100%;height:100%;object-fit:contain"></div>'
      : sh.fail ? '<div class="row"><span class="small">Чек не загрузился</span><button type="button" class="btn quiet" data-action="tq-shot:' + q.id + '">Повторить</button></div>'
      : '<div class="box" style="' + box + '">загружаем чек…</div>';
    var check = '<div class="field"><label>Чек</label>' + inner +
      '<span class="small">' + esc(topupSize(q) + ' · прислан ' + topupDay(q.iso, true)) + '</span></div>';
    // E56e: своя заявка — кнопок НЕТ вовсе, а не погашены
    if (q.mine) return rows + check + '<div class="note">' + svg(ICON.info) + '<span>Свою заявку решает другой ответственный за пополнения.</span></div>';
    return rows + check + err +
      '<button type="button" class="btn" data-action="tq-ok:' + q.id + '"' + busy + '>' + (TOPQ.busy ? 'Зачисляем…' : 'Зачислить ' + money(q.sum) + ' ฿') + '</button>' +
      '<button type="button" class="btn quiet" data-action="tq-ask:' + q.id + '"' + busy + '>Отказать</button>';
  },

  /* ── шаг 12: «Бизнесы клуба» (кадры E75 список, E75b пусто, E75v не загрузилось; Cafe13KPG#877, #881) — данные в
     06-lyudi.js (`BIZ`). Плашка — НЕ кнопка и без шеврона (решение дизайнера, #881): за ней в шаге 12 нет экрана,
     а шеврон обещал бы дверь. Пилюля — про СМЕНУ (`is_open`), и это сказано прозой под списком: без неё
     «закрыт» читался бы как «закрыт навсегда» (`is_active`). Доли — группой в карточке (шаг 21). */
  businesses: function () {
    if (LIVE && !mayOps()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Бизнесы клуба видит операционный директор.</span></div></div>';
    if (!BIZ.list) return BIZ.fail ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(BIZ.fail) + '</span></div>' +
        '<button type="button" class="btn quiet" data-action="biz-retry">Попробовать снова</button>' +
        '<span class="small">Бизнесы клуба живут на сервере — без ответа показать их нечем.</span>'
      : '<div class="card quiet"><span class="small">Загружаем бизнесы клуба…</span></div>';
    if (!BIZ.list.length) return '<div class="note">' + svg(ICON.info) + '<span>Бизнесов в клубе пока нет. ' +
      'Бизнес появляется, когда клуб договаривается с партнёром.</span></div>';
    // шаг 20 (рецепт 20/businesses): остаток счёта строкой в карточке каждого бизнеса — у разных бизнесов состояния разные
    var say = { 'null': 'доли ещё не назначены', wait: 'доля будет зачислена по закрытию месяца',
                zero: 'по закрытым месяцам зачислять было нечего', nopartner: 'счёта нет: у бизнеса нет партнёра' };
    var dash = BIZ.list.some(function (b) { return b.wallet === undefined; });
    return BIZ.list.map(function (b) {
      return '<div class="card"><div class="row"><span class="col"><b>' + esc(b.title) + '</b>' +
          '<span class="small">' + (b.partner ? 'Партнёр: ' + esc(b.who || 'имя не указано') : 'Партнёра нет') + '</span></span>' +
          (b.open ? '<span class="pill on">открыт</span>' : '<span class="pill">закрыт</span>') + '</div>' +
          walletRow('На счёте', b.wallet, say, !b.partner) + doli(b) + '</div>';
    }).join('') +
      (dash ? '<span class="small">Остаток сервер пока не отдаёт — у ручки нет поля. Прочерк значит «не спросили», а не «ноль».</span>' : '') +
      '<div class="note">' + svg(ICON.info) + '<span>«Открыт» и «закрыт» — про смену на сегодня, а не про закрытие бизнеса: ' +
      'смену открывает куратор направления или администратор.</span></div>';
    /* шаг 21 (рецепт 21/businesses): группа долей — четыре состояния. Слова «не назначены» и «нет партнёра» —
       ЦИТАТЫ шага 20 (тот же `say`), своих шаг не вводит. Умолчания в полях нет: оба числа руками. */
    function doli(b) {
      var head = '<div class="group"><span class="label">Доли</span>';
      // отказ сервера на записи (партнёр ушёл между списком и нажатием) стоит и здесь: перечитанный список уже без партнёра
      var deny = DOLI.id === b.id && DOLI.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(DOLI.err) + '</span></div>' : '';
      if (!b.partner) return head + '<p class="verbatim">' + esc(say.nopartner) + '</p>' + deny + '</div>';
      if (b.shares === undefined) return head + '<span class="small">—</span>' +
        '<span class="small">Сервер пока не отдаёт долей — у ручки нет поля.</span></div>';
      if (DOLI.id === b.id) {
        var lock = DOLI.busy ? ' disabled' : '';
        return head +
          '<div class="field"><label for="doli-club">Клубу, %</label><input id="doli-club" class="num" inputmode="numeric" autocomplete="off" value="' + esc(DOLI.club) + '"' + lock + '></div>' +
          '<div class="field"><label for="doli-partner">Партнёру, %</label><input id="doli-partner" class="num" inputmode="numeric" autocomplete="off" value="' + esc(DOLI.partner) + '"' + lock + '></div>' +
          '<span class="small">Сумма обязана быть 100. Новые доли действуют вперёд: уже записанные деньги не пересчитываются.</span>' +
          deny +
          '<button type="button" class="btn" id="doli-save" data-action="doli-save"' + (DOLI.busy || !doliReady() ? ' disabled' : '') + '>' +
            (DOLI.busy ? 'Сохраняем…' : 'Сохранить доли') + '</button>' +
          '<button type="button" class="btn quiet" data-action="doli-keep"' + lock + '>Назад</button></div>';
      }
      var act = DOLI.busy ? ' disabled' : '';
      if (b.shares === false) return head + '<p class="verbatim">' + esc(say['null']) + '</p>' +
        '<span class="small">Пока доли не назначены, продажи идут, но деньги месяца не делятся: долю клуба и партнёра посчитать нельзя.</span>' +
        '<button type="button" class="btn" data-action="doli-open:' + b.id + '"' + act + '>Назначить доли</button></div>';
      return head + '<div class="rows"><div><span>Клубу · <span class="num">' + pct(b.shares.club) + '</span> %</span></div>' +
          '<div><span>Партнёру · <span class="num">' + pct(b.shares.partner) + '</span> %</span></div></div>' +
        '<button type="button" class="btn quiet" data-action="doli-open:' + b.id + '"' + act + '>Изменить доли</button></div>';
    }
  },
});

/* ── шаг 31: статистика клуба у главы (ТЗ Cafe13KPG#688 ред. 1, рецепт `_docs/recept/ekran/31/clubStats.md`,
   снимок формы api 61db38e) ── Одна ручка на страницу: `GET /stats/club?period=&at=`. Пусто ≠ 0 (§4): счётчики
   приходят числом всегда, а суммы ивентов по пустому периоду — `null`, и это НЕ ноль. Даты экран не считает:
   закрытие текущего месяца — `business.current.closes_on`; дату `live_at` не печатает вовсе (поправка рецепта
   6a313fa: конец окна — 00:00 следующего дня, «на 1 декабря» о ноябре читалось бы неверно). Посещений нет вовсе
   (слово владельца 21.11.2026). Числа не кэшируются между периодами: каждая смена разреза — новый запрос. */
var CS = { period: 'month', at: '', data: null, fail: '', deny: '', gen: 0 };
function mayClubStats() { return LIVE && (grant('head') || grant('admin')); }
// дата «ГГГГ-ММ-ДД» словами, без пересчёта пояса: «1 декабря 2026»
function csDay(ymd) { var x = ymd.split('-'); return Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1] + ' ' + x[0]; }
function csAdd(ymd, n) { return new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
// начало периода, в который попадает день: неделя ISO — с понедельника, как у сервера (`date_trunc('week')`)
function csStart(period, ymd) {
  if (period === 'month') return ymd.slice(0, 8) + '01';
  if (period === 'week') return csAdd(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7));
  return ymd;
}
function csShift(period, ymd, dir) {
  var s = csStart(period, ymd);
  if (period === 'day') return csAdd(s, dir);
  if (period === 'week') return csAdd(s, 7 * dir);
  var y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)) - 1 + dir;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + '-' + (m < 9 ? '0' : '') + (m + 1) + '-01';
}
function csLabel(period, ymd) {
  var s = csStart(period, ymd);
  if (period === 'day') return csDay(s);
  if (period === 'month') return bmMonth(Date.parse(s.slice(0, 8) + '15T12:00:00Z'));
  var e = csAdd(s, 6), a = s.split('-'), b = e.split('-');
  return 'Неделя ' + (a[1] === b[1] ? Number(a[2]) + '–' + Number(b[2]) + ' ' + MONTHS[Number(b[1]) - 1]
    : Number(a[2]) + ' ' + MONTHS[Number(a[1]) - 1] + ' – ' + Number(b[2]) + ' ' + MONTHS[Number(b[1]) - 1]);
}
// деньги сервера: число или строка-число; минус законен (доля клуба с бизнеса — разность)
function csMoney(v) { return typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN; }
function csCount(v) { return typeof v === 'number' && v >= 0 && v % 1 === 0; }
/* Одна битая часть — отказ целиком: страница с пропавшим блоком читалась бы полной. Ноль вместо `null` не
   подставляется нигде: у ивентов `null` значит «ивентов не было», и это слово E1, а не «0 ฿». */
function fromClubStats(d) {
  if (!d || typeof d !== 'object') return null;
  var c = d.club, m = d.memberships, e = d.events, t = d.till, b = d.business;
  if (!c || !m || !e || !t || !b || typeof c !== 'object' || typeof b !== 'object') return null;
  var club = {};
  var srcs = ['member', 'master', 'event', 'partner'];
  for (var i = 0; i < srcs.length; i++) {
    var x = c[srcs[i]];
    if (!x || !isFinite(csMoney(x.amount))) return null;
    club[srcs[i]] = csMoney(x.amount);
  }
  club.total = csMoney(c.total); club.balance = csMoney(c.balance);
  if (!isFinite(club.total) || !isFinite(club.balance)) return null;
  if (!csCount(m.new) || !csCount(m.live) || typeof m.live_at !== 'string' || isNaN(Date.parse(m.live_at))) return null;
  if (typeof d.period_end !== 'string' || isNaN(Date.parse(d.period_end))) return null;
  if (!csCount(e.count) || !csCount(t.arrivals)) return null;
  // ивентов нет — суммы `null`; ивенты есть — числа (ивент без записей даёт 0, а не null)
  var none = e.count === 0;
  if (none ? e.bookings !== null || e.collected !== null : !csCount(e.bookings) || !isFinite(csMoney(e.collected))) return null;
  var closed = b.closed, cur = b.current;
  if (closed !== null && (!closed || typeof closed !== 'object' || !isFinite(csMoney(closed.amount)))) return null;
  if (cur !== null && (!cur || typeof cur !== 'object' || typeof cur.closes_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cur.closes_on))) return null;
  return { club: club, isNew: m.new, live: m.live, // «на конец периода» — когда сервер мерил на конце окна; раньше конца — период текущий, мерил «сейчас»
           liveEnd: Date.parse(m.live_at) === Date.parse(d.period_end),
           count: e.count, bookings: none ? null : e.bookings, collected: none ? null : csMoney(e.collected),
           arrivals: t.arrivals, closed: closed === null ? null : csMoney(closed.amount),
           closesOn: cur === null ? null : cur.closes_on };
}
function loadClubStats() {
  if (!mayClubStats()) return;
  var gen = ++CS.gen, who = WHO;
  CS.data = null; CS.fail = ''; CS.deny = '';
  api('GET', '/stats/club?period=' + CS.period + '&at=' + CS.at).then(function (r) {
    if (gen !== CS.gen || who !== WHO) return;
    var got = r.status === 200 ? fromClubStats(r.data) : null;
    if (got) CS.data = got;
    else if (r.status === 403) CS.deny = detailOf(r) || failText(r);
    else CS.fail = failText(r);
    if (current === 'clubStats') render();
  });
}
function csMove(dir) {
  if (dir > 0 && csStart(CS.period, CS.at) >= csStart(CS.period, msToday())) return;   // › погашена на текущем
  CS.at = csShift(CS.period, CS.at, dir); loadClubStats(); render();
}

Object.assign(SCREENS, {
  clubStats: function () {
    if (!mayClubStats()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Статистику клуба видит глава клуба.</span></div></div>';
    var P = [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']];
    var seg = '<div class="seg">' + P.map(function (x) {
      return '<button type="button" data-action="cs-period:' + x[0] + '" aria-pressed="' + (CS.period === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var last = csStart(CS.period, CS.at) >= csStart(CS.period, msToday());
    var nav = '<div class="row"><button type="button" class="btn ghost" data-action="cs-prev" aria-label="Предыдущий период">‹</button>' +
      '<b>' + esc(csLabel(CS.period, CS.at)) + '</b>' +
      '<button type="button" class="btn ghost" data-action="cs-next" aria-label="Следующий период"' + (last ? ' disabled' : '') + '>›</button></div>';
    if (CS.deny) return seg + nav + '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(CS.deny) + '</span></div>';
    if (CS.fail) return seg + nav + '<div class="card quiet"><div class="row"><span class="small">Статистика не загрузилась.</span>' +
      '<button type="button" class="btn quiet" data-action="cs-retry">Повторить</button></div></div>';
    if (!CS.data) return seg + nav + '<div class="card quiet"><span class="small">Загружаем статистику…</span></div>';
    var s = CS.data;
    var row = function (label, val) { return '<div><span class="small">' + label + '</span><b class="num">' + val + '</b></div>'; };
    var D = '<div class="card"><b>Деньги клуба</b><div class="rows">' +
        row('Членство', bmSum(s.club.member)) + row('Мастера', bmSum(s.club.master)) + row('Ивенты', bmSum(s.club.event)) +
        row('Бизнесы', bmSum(s.club.partner)) + row('Итого', bmSum(s.club.total)) + row('Остаток счёта клуба', bmSum(s.club.balance)) +
      '</div><span class="small">Остаток — на сегодня, а не за период.</span></div>';
    var M = '<div class="card"><b>Членство</b><div class="rows">' +
        row('Новых за период', s.isNew) + row(s.liveEnd ? 'Живых на конец периода' : 'Живых сейчас', s.live) + '</div></div>';
    // E1: ивентов не было — строки записей и собранного не стоят вовсе; «0» из `null` солгал бы «был, но пустой»
    var E = '<div class="card"><b>Ивенты</b><div class="rows">' + row('Ивентов', s.count) +
        (s.count === 0 ? '' : row('Записей', s.bookings) + row('Собрано', bmSum(s.collected))) + '</div>' +
      (s.count === 0 ? '<span class="small">Ивентов в этом периоде не было.</span>' : '') + '</div>';
    // B: доля клуба — расчёт, а не поступление (замер шага 28, #559): B1 стоит при любом числе. B3 — строка, а не
    // «0 ฿» у незакрытого месяца (§4); дата — сервера, словами
    var B = '<div class="card"><b>Бизнес</b>' +
      (s.closed === null ? '<span class="small">Закрытых месяцев в этом периоде нет.</span>'
        : '<div class="rows">' + row('Доля клуба с закрытых месяцев', bmSum(s.closed)) + '</div>') +
      '<span class="small">Это расчёт доли клуба, а не деньги на его счёте: на счёт клуба она не зачисляется.</span>' +
      (s.closesOn === null ? '' : '<span class="small">Текущий месяц закроется ' + esc(csDay(s.closesOn)) + ' — доля считается при закрытии.</span>') +
      '</div>';
    var T = '<div class="card"><b>Касса</b><div class="rows">' + row('Незнакомцев у кассы', s.arrivals) + '</div>' +
      '<span class="small">Те, кто нажал в боте «Я у кассы» за период.</span></div>';
    return seg + nav + D + M + E + B + T;
  },
});
