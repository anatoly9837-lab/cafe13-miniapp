Object.assign(SCREENS, {

  // E46: ровно два входа — решение владельца 28.10.2026 (#413). «Заявки на членство» (E42)
  // остаются на главной: это другая очередь, для уже допущенных.
  manage: function () {
    // v100: две группы, каждая по своему праву — «Кто в клубе» у главы, «Деньги» у ответственного
    // за пополнения (кадр E46, Cafe13KPG#586). Ни одного права — прежний отказ.
    if (!mayPeople() && !mayTopups() && !mayMasters() && !(LIVE && msIsMaster())) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Просьбы о вступлении смотрит и решает глава клуба.</span></div></div>';
    // пока счёт не пришёл — не ноль: ноль значил бы «никто не просится» (кадр E46). То же у денег:
    // `pending` приходит в ответе очереди, и «Ждут решения: 0» отличается от «не посчитано»
    var wait = JOINQ.list ? JOINQ.list.filter(function (q) { return q.status === 'pending'; }).length : null;
    var money_ = mayTopups() ? '<div class="group"><span class="label">Деньги</span>' +
      '<button type="button" class="listitem" data-go="topupQueue"><span class="grow"><b>Заявки на пополнение</b>' +
        '<span class="small">' + waitSub(TOPQ.pending, 'Кто просит пополнить счёт') + '</span></span>' +
        waitMark(TOPQ.pending) + svg(ICON.chev, 'chev') + '</button></div>' : '';
    // шаг 3: дверь «Слоты и мастера» — группой, как «Деньги» (слово владельца: «во вкладке управление — управление этими ивентами»)
    // «Ивенты», а не «Мероприятия» — слово владельца 29.10.2026 по прототипу: «Не мероприятия а ивенты»
    // шаг 4: «Свои ивенты» — в той же группе, у всякого, кто ведёт свои (мастер, организатор, работник)
    var own = mayOwnEvents() ? '<button type="button" class="listitem" data-go="organizer"><span class="grow"><b>Свои ивенты</b>' +
        '<span class="small">Записавшиеся, места и описание</span></span>' + svg(ICON.chev, 'chev') + '</button>' : '';
    var art = mayMasters() || own ? '<div class="group"><span class="label">Ивенты</span>' +
      (mayMasters() ? '<button type="button" class="listitem" data-go="masters"><span class="grow"><b>Слоты и мастера</b>' +
        '<span class="small">' + waitSub(MR.pending, 'Заявки в мастера, ивенты, слоты') + '</span></span>' +
        waitMark(MR.pending) + svg(ICON.chev, 'chev') + '</button>' : '') + own + '</div>' : '';
    if (!mayPeople()) return money_ + art;
    return '<div class="group"><span class="label">Кто в клубе</span>' +
      '<button type="button" class="listitem" data-go="joinQueue"><span class="grow"><b>Заявки на доступ</b>' +
        '<span class="small">' + waitSub(wait, 'Кто просится в клуб') + '</span></span>' +
        waitMark(wait) + svg(ICON.chev, 'chev') + '</button>' +
      '<button type="button" class="listitem" data-go="people"><span class="grow"><b>Члены клуба</b>' +
        '<span class="small">Кто в клубе и с какими уровнями</span></span>' + svg(ICON.chev, 'chev') + '</button>' +
    '</div>' + money_ + art;
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
});
