Object.assign(SCREENS, {

  /* E60 (вариант А владельца, 30.10.2026): сетка недели + список ВЫБРАННОГО дня — половина варианта, а не
     улучшение: полоска говорит «тут что-то есть», что именно — список. Названий в сетке нет по построению
     (колонка ≈47 px) — это выбранный размен, а не дефект. Переход по неделям — решение координатора после
     выбора; «‹» на текущей неделе погашен: /events прошедших не отдаёт, и прошлая неделя читалась бы
     «ивентов нет» там, где они были. «Сегодня» — только не на текущей неделе (E60d). */
  events: function () {
    var list = eventList();
    if (!list) return eventsWait();
    var today = bkk(new Date()).ymd, mon = ymdAdd(ymdMonday(today), WK.off * 7);
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return ymdAdd(mon, i); });
    var on = {}; list.forEach(function (e) { var k = evYmd(e); (on[k] = on[k] || []).push(e); });
    var sel = WK.day && days.indexOf(WK.day) !== -1 ? WK.day
      : WK.off === 0 ? today : (days.filter(function (d) { return on[d]; })[0] || mon);
    var mine = on[sel] || [];
    // фильтр части дня ОСТАЁТСЯ до слова владельца (снятие живого элемента — через координатора, designer-55):
    // календарь выбирает день, фильтр сужает список внутри него; подпись дня считает ВСЕ события дня
    var shown = mine.filter(function (e) { return SEG === 'все' || segOf(e) === SEG; });
    var seg = '<div class="seg">' + SEGS.map(function (s) {
        return '<button type="button" data-action="seg:' + s[0] + '" aria-pressed="' + (SEG === s[0]) + '">' + s[1] + '</button>';
      }).join('') + '</div>';
    var nav = '<div class="wknav"><button type="button" class="round" data-action="wk-prev" aria-label="Неделя назад"' + (WK.off > 0 ? '' : ' disabled') + '>‹</button>' +
      '<b>' + esc(weekRange(days[0], days[6])) + '</b>' +
      (WK.off !== 0 ? '<button type="button" class="btn quiet mini" data-action="wk-today">Сегодня</button>' : '') +
      '<button type="button" class="round" data-action="wk-next" aria-label="Неделя вперёд">›</button></div>';
    var grid = '<div class="wk">' + days.map(function (d, i) {
      var n = (on[d] || []).length, bars = '';
      for (var k = 0; k < Math.max(2, Math.min(n, 3)); k++) bars += '<span class="' + (k < n ? 'ev' : 'no') + '"></span>';
      return '<button type="button" data-action="wk-day:' + d + '"' + (d === sel ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' +
        '<span class="d">' + DOW_SHORT[i] + '</span><span class="n">' + Number(d.slice(8)) + '</span>' + bars + '</button>';
    }).join('') + '</div>';
    var x = sel.split('-'), note = DOW_SHORT[days.indexOf(sel)] + ', ' + Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1] +
      (mine.length ? ' · ' + mine.length + ' ' + (mine.length % 10 === 1 && mine.length % 100 !== 11 ? 'событие'
        : mine.length % 10 >= 2 && mine.length % 10 <= 4 && (mine.length % 100 < 10 || mine.length % 100 >= 20) ? 'события' : 'событий') : '');
    return seg + nav + grid + '<div class="daynote">' + esc(note) + '</div>' +
      (shown.length ? '<div class="group">' + shown.map(eventRow).join('') + '</div>'
        // пустая афиша ЦЕЛИКОМ — не пустой день: /events отдаёт всё будущее без диапазона (бой 455dcdd: условие
        // только «не кончилось»), значит клиент ЗНАЕТ, что листать нечего, и говорит это прежними словами
        : '<div class="card quiet"><span class="small">' + (!list.length ? 'В афише пока ничего нет.'
            : mine.length ? 'На эту часть дня ничего не назначено.' : 'В этот день ивентов нет') + '</span></div>') +
      (mayCreateEvent() ? '<button type="button" class="btn" data-go="eventNew">' +
        svg('<path d="M12 5v14M5 12h14"/>') + 'Создать мероприятие</button>' : '') +
      /* Переключатель в режим управления стоит ЗДЕСЬ, а не отдельной
         вкладкой: решение владельца 21.10.2026 — вкладка становится «двойной»,
         из обзора переход в администрирование (`_docs/STAGE.md` в стволе
         Cafe13KPG, со слов координатора — первоисточник в шлюзе не поднимается).
         Право то же, что у формы: кто не может завести, тому и управлять нечем,
         и кнопки он не видит вовсе, а не получает отказ по нажатию. */
      (mayOwnEvents() ? '<button type="button" class="btn ghost" data-go="organizer">' +
        svg(ICON.star) + 'Управление своими</button>' : '');
  },

  event: function (id) {
    if (LIVE) {
      if (!EVENTS) return eventsWait();
      var le = eventById(id);
      return le ? (FLASH ? flash() : '') + eventLive(le)
        : '<div class="card quiet"><span class="small">Этого мероприятия в афише больше нет.</span></div>';
    }
    var e = byId(id) || DATA.events[0];
    var k = KIND[e.kind];
    var foot;
    if (e.kind === 'paid') {
      // Демонстрация показывает ровно то, что видит человек в живом режиме:
      // кнопка «Записаться» и та же подпись, что в `bookBlock`. Прежние слова
      // («Оплатить … и записаться», «место держится 15 минут, пока идёт
      // оплата») обещали механизм, которого в системе НЕТ: в таблице
      // `bookings` нет ни срока, ни фонового снятия (замер по стволу api
      // 24.10.2026), и неоплаченная запись держит место вечно. В живом
      // режиме этой лжи не было никогда — она жила здесь и в описи, то есть
      // ровно там, где по продукту судят.
      // С шагом 7 вход списывается при записи (Cafe13KPG#748) — витрина говорит то же, что живая карточка.
      foot = '<button type="button" class="btn dup-main" data-action="book">Записаться за ' + money(e.price) + ' ฿</button>' +
             '<span class="small" style="text-align:center">Спишется со счёта сразу.</span>';
    } else if (e.kind === 'free') {
      foot = '<button type="button" class="btn dup-main" data-action="book">Записаться</button>' +
             '<span class="small" style="text-align:center">Если передумали — отмените запись, чтобы место досталось другому.</span>';
    } else {
      /* Прежняя редакция показывала здесь выбор суммы взноса: три кнопки
         (200/400/600 ฿) и поле «Своя сумма». Ни одна из них не делала НИЧЕГО —
         ни атрибута делегирования, ни слушателя, — и механизма за ними нет
         нигде: живой экран говорит «взнос по желанию, передать можно мастеру
         на месте», а сервер при записи на донейшн суммы не принимает вовсе.
         То есть демонстрация обещала платёж в приложении, которого не
         существует, — тот же класс, что снятое «место держится 15 минут»
         (Cafe13KPG#271), и видит это владелец и всякий, кто читает опись.
         Снято по Cafe13KPG#338; вернуть, когда появится ручка взноса. */
      foot = '<div class="card" style="border-color:var(--clay)">' +
          '<div class="col"><b>Взнос — по желанию</b><span class="small">Сколько считаете нужным, и можно нисколько. На запись это не влияет.</span></div>' +
        '</div>' +
        '<button type="button" class="btn dup-main" data-action="book">Записаться</button>' +
        '<span class="small" style="text-align:center">Взнос можно передать мастеру на месте или оставить в кассе после практики.</span>';
    }
    return '<div class="col"><h1>' + esc(e.title) + '</h1>' +
      '<span class="small">' + esc(e.day) + ' · ' + esc(e.time) + '–' + esc(e.until) + '</span></div>' +
      '<div class="rows">' +
        '<div><span class="small">Ведёт</span><b>' + esc(e.master) + '</b></div>' +
        '<div><span class="small">Мест осталось</span><b class="num">' + (e.unl ? NO_LIMIT : e.seats + ' из ' + e.of) + '</b></div>' +
        '<div><span class="small">Участие</span><b class="num">' + k.label(e) + '</b></div>' +
      '</div>' +
      '<p style="font-size:14px">' + esc(e.about) + '</p>' +
      '<div class="note">' + svg(ICON.cam) + '<span>' + (e.filmed
        ? 'На этом событии ведётся съёмка. Согласие даётся отдельно и его можно не давать — запись останется в силе.'
        : 'Съёмки на этом событии нет.') + '</span></div>' +
      '<div class="group" style="margin-top:4px">' + foot + '</div>';
  },

  bookings: function () {
    /* Живой экран «Записи» (Cafe13KPG#360). Тексты лежат АДРЕСОМ — кадры
       `E40-bookings-mine.dc.html` и `E40b-bookings-none.dc.html` в `Cafe13KPG`,
       ствол `dev` `051bfa3`; здесь они стоят
       дословно.

       ПРЕДСТОЯЩИЕ собираются из ответа афиши по `booked` (`booked_by_me`
       сервера), а не отдельной ручкой: «моих записей» на сервере нет как
       понятия. Строка — та же `eventRow`, что на афише, и ведёт в карточку
       мероприятия. ВТОРОГО пути к отмене здесь НЕТ нарочно: отмена живёт в
       карточке (`bookBlock`, `data-action="book-cancel"`), и два места
       расходились бы молча.

       СОСТОЯНИЯ «не пришло» и «отказ» берутся у афиши (`eventsWait`), а не
       сочиняются: пустой список при непришедшем ответе сказал бы «вы никуда
       не записаны» тому, кто только что записался. Слово «афишу» в том тексте
       верно — экран строится из её ответа.

       ПРОШЕДШИЕ — из `/events/history` (`pastBookings`): с шага 7 архив отдаёт и
       прошедшее, где я был записан (api#114), — это дверь к благодарности
       (Cafe13KPG#755). Прежде здесь стояла фраза «прошедших записей сервер не
       отдаёт», и тогда она была верна.

       Метки «оплачено» нет нарочно: `my_booking_paid` и `my_amount_due` на
       бою отсутствуют, и клиент их не читает. Пилюля называет условие
       участия — свойство мероприятия, верное всегда, — а не мой долг.

       Имя ведущего стоит без обёртки `.who`: в кадре это слот-пометка живого
       имени, а в клиентских стилях `.who` существует только как `.pass .who`,
       flex-контейнер экрана пропуска. Афиша рисует имя так же. */
    if (LIVE) {
      var list = eventList();
      if (!list) return eventsWait();
      var mine = list.filter(function (e) { return e.booked && !e.done; });
      /* ДЕНЬ — в заголовке группы, как на афише, и теми же словами того же
         помощника: в двух местах один день писался бы по-разному. В строке
         его нет вовсе, поэтому подстрочник короткий — «ведёт <мастер>», без
         статуса: на этом экране каждая строка и есть «вы записаны», и статус,
         верный всегда, не несёт ничего.

         Прежняя редакция держала день В СТРОКЕ и один заголовок «Предстоящие».
         Отрисовка показала цену: подстрочник с днём и мастером занимал две-три
         серых строки — 30 px при узкой пилюле и 45 при длинном имени против 15
         у одной (замер дизайнера, Cafe13KPG#382). Заголовка «Предстоящие»
         больше нет: его работу делают заголовки дней.

         Второй заголовок — «Прошедшие записи», и слово «записи» здесь
         работает: без него он читается ЧЕТВЁРТЫМ ДНЁМ среди дат (проверено
         отрисовкой, Cafe13KPG#384). */
      var days = [];
      mine.forEach(function (e) { if (days.indexOf(e.day) === -1) days.push(e.day); });
      return (mine.length
        ? days.map(function (d) {
            return '<div class="group"><span class="label">' + esc(d) + '</span>' +
              mine.filter(function (e) { return e.day === d; })
                  .map(function (e) { return eventRow(e, { bezStatusa: true }); }).join('') +
            '</div>';
          }).join('')
        // Пустое состояние — карточкой БЕЗ группы, как пустая афиша: заголовка
        // «Предстоящие» больше нет, и вешать его ради пустоты значило бы
        // вернуть снятое.
        : '<div class="card quiet"><div class="col"><b>Вы никуда не записаны</b>' +
          '<span class="small">Записывают на экране мероприятия. Место закрепляется сразу.</span></div></div>') +
        /* ВХОД В АФИШУ — В ОБОИХ СОСТОЯНИЯХ, А НЕ ТОЛЬКО В ПУСТОМ. У гостя
           вкладки «Клуб» нет (`TABS.guest`), а обе кнопки «Вся афиша» живут
           внутри `home` — значит, пока эта стояла в ветке пустоты, гость,
           записавшийся хоть на одно мероприятие, терял афишу совсем: пустого
           состояния он больше не видит, и выхода с экрана к афише у него ноль.
           Записался — и заперся. Нашёл обходом отрисованных входов
           designer-55, перемерено мной на отрисованном экране
           (Cafe13KPG#371).
           Кнопка, а не адрес: вкладка есть у четырёх ролей с разными
           наборами, и «откройте „Клуб“» верно члену и ложно гостю.

           ⚠ ВЕС КНОПКИ ИДЁТ ОТ СОСТОЯНИЯ, и это не разнобой. В пустом она
           единственное, что на экране можно сделать, и кадр E40b рисует её
           сплошной. При живых записях главное здесь — сами записи, а сплошная
           кнопка посреди списка забирает экран себе (смотрено отрисованным на
           390px). Тихая — та же `btn quiet`, что стоит у «Всей афиши» в
           `afishaHome()`, то есть второй формы одной кнопки не заводится.

           Правило это в клиенте УЖЕ живёт, и в такой же развилке: `tillPerson`,
           `again = d ? ' ghost' : ''` — «Продать членство» сплошная, пока на
           экране нет действия важнее, и снижается, как только появляется
           «Следующий человек». Вес следует не за кнопкой, а за вопросом «есть
           ли здесь действие важнее»; здесь важнее сами строки записей — они
           нажимаются и ведут в мероприятие. Прецедент назвал designer-55,
           сверено мной по коду; `quiet`, а не `ghost`, потому что повторяющееся
           действие держит свою форму между экранами, а `ghost` — это контур во
           всю ширину (`styles.css`), то есть другая форма, а не другой вес. */
        '<button type="button" class="btn' + (mine.length ? ' quiet' : '') + '" data-go="events">Вся афиша</button>' +
        '<div class="group"><span class="label">Прошедшие записи</span>' + pastBookings() + '</div>';
    }
    return '<div class="group"><span class="label">Предстоящие</span>' +
      DATA.upcoming.map(function (b) {
        return '<div class="card' + (b.tone === 'on' ? ' accent' : '') + '">' +
          '<div class="row top"><div class="col"><h2>' + esc(b.title) + '</h2>' +
          '<span class="small">' + esc(b.when) + '</span></div>' +
          '<span class="pill' + (b.tone === 'on' ? ' on' : '') + '">' + esc(b.state) + '</span></div>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="group"><span class="label">Прошедшие</span>' +
      DATA.past.map(function (b) {
        return '<div class="card"><div class="row"><div class="col">' +
          '<b>' + esc(b.title) + '</b><span class="small">' + esc(b.when) + '</span>' +
          '</div>' + svg('<path d="M5 12l5 5 9-10"/>', 'chev') + '</div></div>';
      }).join('') + '</div>';
  },
});
