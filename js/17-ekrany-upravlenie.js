Object.assign(SCREENS, {

  // E46: ровно два входа — решение владельца 28.10.2026 (#413). «Заявки на членство» (E42)
  // остаются на главной: это другая очередь, для уже допущенных.
  manage: function () {
    // v100: две группы, каждая по своему праву — «Кто в клубе» у главы, «Деньги» у ответственного
    // за пополнения (кадр E46, Cafe13KPG#586). Ни одного права — прежний отказ.
    if (!mayPeople() && !mayTopups() && !mayMasters() && !mayOps() && !(LIVE && msIsMaster())) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Просьбы о вступлении смотрит и решает глава клуба.</span></div></div>';
    // пока счёт не пришёл — не ноль: ноль значил бы «никто не просится» (кадр E46). То же у денег:
    // `pending` приходит в ответе очереди, и «Ждут решения: 0» отличается от «не посчитано»
    var wait = JOINQ.list ? JOINQ.list.filter(function (q) { return q.status === 'pending'; }).length : null;
    // шаг 11 (кадр E46д, Cafe13KPG#857): группа «Деньги» — у того, кто вправе хоть одну её строку; каждая строка —
    // под СВОИМ правом. Распределяет арт-директор, а пополнения решает ответственный за них: группа на одном
    // `mayTopups()` прятала вход от того, кому он. Вторая группа с тем же заголовком читалась бы вторым разделом
    var money_ = mayTopups() || mayMasters() ? '<div class="group"><span class="label">Деньги</span>' +
      (mayTopups() ? '<button type="button" class="listitem" data-go="topupQueue"><span class="grow"><b>Заявки на пополнение</b>' +
        '<span class="small">' + waitSub(TOPQ.pending, 'Кто просит пополнить счёт') + '</span></span>' +
        waitMark(TOPQ.pending) + svg(ICON.chev, 'chev') + '</button>' : '') +
      (mayMasters() ? '<button type="button" class="listitem" data-go="payouts"><span class="grow"><b>Распределить деньги</b>' +
        '<span class="small">' + waitSub(PAY.pending, 'Доли с прошедших мероприятий') + '</span></span>' +
        waitMark(PAY.pending) + svg(ICON.chev, 'chev') + '</button>' : '') + '</div>' : '';
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
      (q.about ? '<div class="card quiet"><span class="small" style="white-space:pre-wrap">' + esc(q.about) + '</span></div>' : '') +
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
     «закрыт» читался бы как «закрыт навсегда» (`is_active`). Ни одного числа доли: шаг 21. */
  businesses: function () {
    if (LIVE && !mayOps()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Бизнесы клуба видит операционный директор.</span></div></div>';
    if (!BIZ.list) return BIZ.fail ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(BIZ.fail) + '</span></div>' +
        '<button type="button" class="btn quiet" data-action="biz-retry">Попробовать снова</button>' +
        '<span class="small">Бизнесы клуба живут на сервере — без ответа показать их нечем.</span>'
      : '<div class="card quiet"><span class="small">Загружаем бизнесы клуба…</span></div>';
    if (!BIZ.list.length) return '<div class="note">' + svg(ICON.info) + '<span>Бизнесов в клубе пока нет. ' +
      'Бизнес появляется, когда клуб договаривается с партнёром.</span></div>';
    return BIZ.list.map(function (b) {
      return '<div class="card"><div class="row"><span class="col"><b>' + esc(b.title) + '</b>' +
          '<span class="small">' + (b.partner ? 'Партнёр: ' + esc(b.who || 'имя не указано') : 'Партнёра нет') + '</span></span>' +
          (b.open ? '<span class="pill on">открыт</span>' : '<span class="pill">закрыт</span>') + '</div></div>';
    }).join('') +
      '<div class="note">' + svg(ICON.info) + '<span>«Открыт» и «закрыт» — про смену на сегодня, а не про закрытие бизнеса: ' +
      'смену открывает куратор направления или администратор. Условий сделки и долей здесь нет.</span></div>';
  },
});
