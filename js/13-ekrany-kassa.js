Object.assign(SCREENS, {

  staff: function () {
    if (LIVE) {
      if (!canTopup()) return '<div class="card quiet"><span class="small">Касса — для работников с правом кассы.</span></div>';
      var lock = TP.busy ? ' disabled' : '';
      return (FLASH ? flash() : '') +
        '<button type="button" class="btn" data-action="scan"' + lock + '>' + svg(ICON.till) + 'Сканировать пропуск</button>' +
        '<div class="group"><span class="label">Или код с экрана пропуска</span>' +
          (TP.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TP.deny) + '</span></div>' : '') +
          '<div class="row" style="gap:8px;align-items:flex-end"><div style="flex:1 1 auto;min-width:0">' +
            '<div class="field"><label for="tp-code">Код</label>' +
              '<input id="tp-code" type="text" inputmode="numeric" autocomplete="off" value="' + esc(TP.code) + '" placeholder="0000"' + lock + '></div></div>' +
            '<button type="button" class="btn mini" data-action="tp-find"' + lock + '>' + (TP.busy ? 'Ищем…' : 'Найти') + '</button></div>' +
          '<span class="small">Четыре цифры. Можно с «XIII-» или без — касса читает оба вида.</span></div>' +
        '<button type="button" class="btn ghost" data-go="tillDay">День кассы</button>' +
        '<div class="note">' + svg(ICON.info) +
          '<span>Деньги вносятся только тому, кого нашли по пропуску: сервер принимает приём по номеру человека, а у кассира на руках только код. Карточка человека — это и есть проверка, что деньги уйдут не чужому.</span></div>';
    }
    var total = DATA.shift.reduce(function (a, r) { return r.cancelled ? a : a + r.sum; }, 0);
    return (FLASH ? flash() : '') +
      // Вид приёма выбирается на карточке найденного человека, как в живой
      // кассе, а не здесь: ряд «Членство / На баланс / Событие» и «Отменить»
      // у строк смены нажимались и не делали ничего (Cafe13KPG#338).
      '<button type="button" class="btn" data-action="scan">' + svg(ICON.till) + 'Сканировать пропуск</button>' +
      '<div class="group">' +
        '<div class="row"><span class="label">Внесено за смену</span><b class="num">' + money(total) + ' ฿</b></div>' +
        DATA.shift.map(function (r) {
          if (r.cancelled) {
            return '<div class="card cancelled">' +
              '<div class="row"><b class="strike">' + esc(r.what) + ' · ' + r.sum + ' ฿</b>' +
              '<span class="pill gold">Отменено</span></div>' +
              '<span class="small">' + esc(r.when) + '. Запись остаётся видимой: книга клуба дописывается, а не правится.</span>' +
            '</div>';
          }
          return '<div class="card"><div class="row">' +
            '<div class="col"><b>' + esc(r.what) + '</b><span class="small num">' + esc(r.when) + '</span></div>' +
            '<b class="num">' + money(r.sum) + ' ฿</b></div></div>';
        }).join('') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Каждая строка попадает в книгу событий клуба. По ней считается прибыль направления — поэтому задним числом её не меняют.</span>' +
      '</div>';
  },

  tillDay: function () {
    if (LIVE && !canTopup()) return '<div class="card quiet"><span class="small">Касса — для работников с правом кассы.</span></div>';
    var d = TD.data;
    if (!d) return TD.fail
      ? '<div class="card quiet"><span class="small">' + esc(TD.fail) + '</span></div>' +
        '<button type="button" class="btn ghost" data-action="td-reload">Повторить</button>'
      : '<div class="card quiet"><span class="small">Загружаем день кассы…</span></div>';
    // «Через книгу», а не «внесено»: в итоге сервера и заказы бара, и
    // списания со счёта. В ящике — только строка «наличными» (designer-55).
    return (!LIVE && FLASH ? flash() : '') +
      (d.odd ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>Итог дня не сходится со строками — показывать его нельзя. Сообщите администратору клуба.</span></div>' :
      '<div class="rows"><div><span class="small">Через книгу за день</span><b class="num">' + money(d.total) + ' ฿</b></div>' +
        '<div><span class="small">наличными <b class="num">' + money(d.by.cash) + '</b></span>' +
          '<span class="small">картой <b class="num">' + money(d.by.card) + '</b></span>' +
          '<span class="small">со счёта <b class="num">' + money(d.by.account) + '</b></span></div>' +
        '<div><span class="small">Живых строк</span><b class="num">' + d.count + '</b></div></div>') +
      (TD.fail ? '<span class="small">Не перечитался: ' + esc(TD.fail) + '</span>' : '') +
      (d.rows.length
        ? '<div class="group"><span class="label">Строки за сегодня</span>' + d.rows.map(tillDayRow).join('') + '</div>' +
          '<div class="note">' + svg(ICON.info) + '<span>Исправить строку нельзя — только отменить и внести заново: книга клуба дописывается, а не правится. Поэтому отмена стоит отдельной строкой, а отменённая остаётся видимой.</span></div>'
        : '<div class="card quiet"><div class="col"><b>Сегодня через кассу ничего не прошло</b>' +
          '<span class="small">Сутки считаются по часам клуба, от полуночи до полуночи по Пхангану: вечерняя выручка не уезжает во вчера.</span></div></div>');
  },

  tillPerson: function () {
    var w = TP.who;
    if (!w) return '<div class="card quiet"><span class="small">Человек не выбран.</span></div>' +
      '<button type="button" class="btn" data-go="staff">К скану пропуска</button>';
    var d = TP.done, again = d ? ' ghost' : '', reload = TP.busy ? 'Перечитываем…' : 'Перечитать карточку';
    /* Неизвестный исход — глиной и с громким «Перечитать»: у стойки смотрят
       вполглаза, и серая карточка того же веса, что «Принято», отличалась бы
       только словами (кадр E34zh, designer-55). */
    /* «Подождите минуту» у потерянного ответа — потому что status 0 значит «МЫ
       перестали ждать» (api() рвёт через 10 с), а платёж может лечь в книгу
       позже (находка designer-55). Тексты — дословно кадры: E34zh на Cafe13KPG
       dev `a47fd3c` (четыре ступени совета, #356), E34z/E34i — `678a0ae`.
       Совет E34zh велит сверить со строкой «Перед приёмом» — она поэтому
       стоит у потерянного ответа всегда, и при неперечитанной карточке.
       Совет ИСПОЛНИМЫЙ: карточка строк книги не показывает, поэтому сверять
       можно только срок и остаток — с тем, что было ДО приёма (строка под
       карточкой). «Принять заново» не разрешается ни в одном исходе: ошибиться
       здесь дороже, чем позвать администратора (Cafe13KPG#333, координатор). */
    var head = d && d.unsure ? '<div class="card warm"><div class="col"><b style="font-size:13px">' + esc(d.text) + '</b>' +
          '<span class="small">' + esc(d.note) + '</span></div></div>' : '';
    /* E34k: «Перечитать карточку» и строки «Перед приёмом» нет — так на
       кадре: с ними и тремя строками пары кадр не влезает (−1 px при 712). */
    if (d && d.odd) return head +
        '<div class="rows"><div><span class="small">Вы вводили</span><b class="num">' + esc(d.odd.mine) + '</b></div>' +
          '<div><span class="small">Сервер ответил</span><b class="num">' + esc(d.odd.theirs) + '</b></div>' +
          (d.odd.id !== null ? '<div><span class="small">Строка в книге</span><b class="num">№ ' + d.odd.id + '</b></div>' : '') + '</div>' +
        tillCard(w) +
        '<button type="button" class="btn quiet" data-action="tp-next">Следующий человек</button>' +
        '<div class="note">' + svg(ICON.info) + '<span>Назовите администратору клуба номер строки и что с чем разошлось — дальше это его дело. ' +
          '«Внести ещё раз» здесь нет и быть не может: платёж уже прошёл, вторая отправка дала бы в книге вторую строку.</span></div>';
    if (d && d.unsure) return head +
        tillCard(w) +
        '<span class="small">' + esc(d.reread || !d.sent || d.person ? d.before : 'Это данные ДО приёма: карточка не перечиталась') + '</span>' +
        '<button type="button" class="btn" data-action="tp-reload"' + (TP.busy ? ' disabled' : '') + '>' + reload + '</button>' +
        '<button type="button" class="btn quiet" data-action="tp-next">Следующий человек</button>' +
        '<div class="note">' + svg(ICON.info) + '<span>' + (
          d.person ? 'Нажмите «Перечитать карточку». Изменилось — строка легла на этого человека, спорны только подробности: назовите их администратору клуба. ' +
                     'Не изменилось — вывода нет, и «не прошло» это тоже не значит: карточка одного человека о чужой строке не говорит.'
          : !d.sent ? 'Кнопки «Внести ещё раз» здесь нет: вторая отправка может создать второй платёж. Нажмите «Перечитать карточку» и сверьте со строкой «Перед приёмом». Изменилось — платёж прошёл, больше ничего не нужно. Не изменилось — подождите минуту и перечитайте: сервер мог провести его позже, чем экран перестал ждать. Если и тогда не изменилось — позовите администратора клуба, а не вносите заново. Строк книги карточка не показывает.'
          : d.reread ? 'Кнопки «Внести ещё раз» здесь нет и быть не может: платёж уже прошёл. Строк книги в карточке нет. Членство и остаток перед приёмом — выше. Если они не изменились, это вопрос к администратору клуба, а не повод принять снова.'
          : 'Карточку перечитать не удалось, поэтому сверять сейчас не с чем. Откройте её заново по коду пропуска: у членства изменится срок, у пополнения — остаток. Не открывается — к администратору клуба, а не принимать снова. Строк книги карточка не показывает.') +
        '</span></div>';
    return (!LIVE && FLASH ? flash() : '') +
      (d ? '<div class="card quiet"><div class="col"><b style="font-size:13px">' + esc(d.text) + '</b>' +
                '<span class="small">' + esc(d.note) + '</span></div></div>' : '') +
      tillCard(w) +
      (d && d.warn ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(d.warn) + '</span></div>' : '') +
      (w.balance === null ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>Остаток не перечитан — обновите карточку</span></div>' +
                            '<button type="button" class="btn quiet" data-action="tp-reload"' + (TP.busy ? ' disabled' : '') + '>' +
                            reload + '</button>' : '') +
      (d ? '<button type="button" class="btn" data-action="tp-next">Следующий человек</button>' : '') +
      '<div class="group"><span class="label">' + (d ? 'Тому же человеку' : 'Что принимаем') + '</span>' +
        '<button type="button" class="btn' + again + '" data-action="tp-open:membership">Продать членство</button>' +
        '<button type="button" class="btn ghost" data-action="tp-open:topup">Внести на счёт</button></div>' +
      (d && d.kind === 'membership'
        ? '<div class="note">' + svg(ICON.info) + '<span>Отменить строку членства отсюда нельзя: «правки членства в приложении пока нет — нужен администратор клуба».</span></div>'
        : '') +
      (d ? '' : '<div class="note">' + svg(ICON.info) +
        '<span>По коду пропуска сервер отдаёт имя, членство и остаток — ни телефона, ни фотографии. Этого хватает, чтобы не внести деньги не тому, и это весь объём: ручка под ролями кассы, но данные ограничены задачей, а не ролью.</span></div>' +
        /* Правда на бою `fa2cebc` (`/health`, замер 27.10.2026 остров): записей в by-pass там нет.
           В стволе api они есть (`27ff063`, на 9 впереди боя) — после выкладки api фраза ложна,
           снять её и сделать лист (перечень таких фраз — Cafe13KPG#357). */
        '<div class="note">' + svg(ICON.info) +
        '<span>«Принять за запись» и «за услугу» появятся своим листом: по коду пропуска записи человека сервер пока не отдаёт, и мероприятие пришлось бы угадывать из афиши.</span></div>');
  },
});
