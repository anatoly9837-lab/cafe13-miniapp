/* Ключи перевода (решение владельца №22, 24.11.2026: «русский остаётся четвёртым языком; ключи закладываем с шага 32»).
   Первый экран на ключах — artStats (шаг 32, Cafe13KPG#563). Выпущенное до v177 ключей НЕ несёт и сюда в попутных
   правках не переводится — это отдельная работа.

   Ключ — `<экран>.<блок>.<слот>` латиницей через точку; один ключ — одна строка словаря (признак сборки рецепта —
   `rg -c '<ключ>' js/00-slova.js`, цель 1). Подстановка — `{имя}`: slovo('artStats.money.closes', { date: '…' }).

   Языков четыре: th, my, en, ru — порядок списка владельца (шаг 41) с русским четвёртым. Заполнен пока только ru;
   выбора языка в клиенте нет, поэтому LANG стоит 'ru'.

   ⚠ Ключа нет в словаре текущего языка → slovo() отдаёт САМ КЛЮЧ, а не пустую строку и не русский текст другого
   языка (AGENTS §4: «нет» видно, а не молчит). Подстановки, которой не передали, остаётся видимой как `{имя}`.
   Подмены на ru нет НАРОЧНО: тайский экран с русскими строками читался бы переведённым. Батарея (live.cjs,
   `slova-*`) краснеет на ключе, которого нет в ru, по ВСЕМ вызовам slovo('…') клиента.

   ⚠ Возвращается ТЕКСТ, а не разметка: в HTML он идёт через esc(), как любые слова. Имя функции — не `t`:
   в клиенте локальное `var t` встречается часто, и оно молча закрыло бы общую функцию. */
var LANGS = ['th', 'my', 'en', 'ru'];
var LANG = 'ru';
var SLOVA = {
  th: {},
  my: {},
  en: {},
  ru: {
    // шаг 32, artStats — рецепт `_docs/recept/ekran/32/artStats.md` (слова дизайнера; ⚠ отмеченные «клиент» — вне
    // таблицы рецепта: подписи стрелок для чтения с экрана, «загружаем» и отказ при прямом входе без права)
    'artStats.door': 'Статистика арт-директора',
    'artStats.title': 'Статистика арт-директора',
    'artStats.period.day': 'День',
    'artStats.period.week': 'Неделя',
    'artStats.period.month': 'Месяц',
    'artStats.period.dayLabel': '{date}',
    'artStats.period.weekLabel': 'Неделя {from}–{to}',
    'artStats.period.monthLabel': '{month} {year}',
    'artStats.period.prev': 'Предыдущий период',            // клиент
    'artStats.period.next': 'Следующий период',             // клиент
    'artStats.period.clockNote': 'Ивенты считаются по дню ивента, деньги — по дню распределения: ивент 30-го, распределённый 2-го, попадёт в разные периоды.',
    'artStats.events.title': 'Ивенты',
    'artStats.events.count': 'Ивентов',
    'artStats.events.bookings': 'Записей',
    'artStats.events.collected': 'Собрано',
    'artStats.events.cashNote': 'В деньгах ивента только безналичные: оплата наличными на кассе сюда не входит.',
    'artStats.events.none': 'Ивентов в этом периоде не было.',
    'artStats.masters.title': 'Мастера',
    'artStats.masters.payouts': 'Распределений: {n}',
    'artStats.masters.none': 'Распределений мастерам в этом периоде не было.',
    'artStats.money.title': 'Деньги арт-директора',
    'artStats.money.balance': 'На счёте роли',
    'artStats.money.accrued': 'Начислено за период',
    'artStats.money.expected': 'Ожидается к начислению',
    'artStats.money.roleNote': 'Счёт общий для роли: если её держат двое, деньги у них общие и вывести их может любой из них.',
    'artStats.money.expectedNone': 'Нераспределённых ивентов нет.',
    'artStats.money.nowNote': 'На счёте и ожидаемое — на сегодня, а не за период; за период — только начисленное.',
    'artStats.error': 'Статистика не загрузилась.',
    'artStats.retry': 'Повторить',
    'artStats.loading': 'Загружаем статистику…',            // клиент
    'artStats.denyTitle': 'Сюда нельзя',                     // клиент
    'artStats.denyNote': 'Статистику арт-директора видит арт-директор.',   // клиент
    // фича 8 (Cafe13KPG#1009), релиз 2 — рецепты `_docs/recept/ekran/popolnenie/` (слова дизайнера)
    'tillPerson.action.topup': 'Пополнить счёт',
    'tillTopup.title': 'Пополнение в кассе',
    'tillTopup.note': 'Деньги целиком ложатся на счёт человека. Членство касса больше не продаёт.',
    'tillTopup.balance': 'На счёте: {balance} ฿',
    'tillTopup.amount': 'Сумма, ฿',
    'tillTopup.method.cash': 'Наличные',
    'tillTopup.method.card': 'Карта',
    'tillTopup.send': 'Внести {amount} ฿',
    'tillTopup.amountEmpty': 'Назовите сумму больше нуля.',
    'tillTopup.done': 'Внесено {amount} ฿ на счёт.',
    'staff.arrivals.note': 'Человек нажимает в боте клуба «Я у кассы» — и появляется здесь. Касса найдёт его, если он хоть раз открывал приложение клуба.',
    'staff.arrivals.open': 'Пополнить счёт',                           // клиент: кнопка строки пришедшего
    'staff.arrivals.notFound': 'Пусть человек откроет приложение клуба — потом выберите его здесь снова.',
    'noAccess.return.title': 'Доступ снят',
    'noAccess.return.note': 'Ваш доступ в приложение снят. Можно попросить главу клуба вернуть его — платить ничего не нужно.',
    'noAccess.return.said': 'Что передать главе клуба',
    'noAccess.return.send': 'Попросить вернуть доступ',
    'noAccess.return.sent': 'Просьба у главы клуба. Ответ придёт сюда.',
    // фича 4 (Cafe13KPG#1009), одобрение ивентов — рецепты `_docs/recept/ekran/odobrenie/` (слова дизайнера; «клиент» — вне
    // таблицы рецепта) и `../master/home.md` H8 (решение владельца №46 «б»)
    'eventApproval.door': 'Ивенты на одобрение',
    'eventApproval.title': 'Ивенты на одобрение',
    'eventApproval.note': 'Пока ивент не одобрен, в афише его видят только автор и арт-директор, и записаться на него нельзя.',
    'eventApproval.approve': 'Одобрить',
    'eventApproval.reject': 'Отклонить',
    'eventApproval.reason': 'Причина отказа — её увидит автор',
    'eventApproval.rejectSend': 'Отклонить',
    'eventApproval.cancel': 'Не отклонять',
    'eventApproval.reasonEmpty': 'Без причины ивент не отклоняется.',
    'eventApproval.none': 'Ивентов на одобрение нет.',
    'eventApproval.error': 'Очередь не загрузилась.',
    'eventApproval.retry': 'Повторить',
    'eventApproval.loading': 'Загружаем очередь…',                        // клиент
    'eventApproval.denyTitle': 'Сюда нельзя',                             // клиент
    'eventApproval.denyNote': 'Ивенты одобряет арт-директор.',            // клиент
    // шаг 34, masterStats — рецепт `_docs/recept/ekran/34/masterStats.md` (#400; форма — api#196, 4d3b5a4)
    'masterStats.door': 'Статистика мастера',
    'masterStats.title': 'Статистика мастера',
    'masterStats.period.day': 'День',
    'masterStats.period.week': 'Неделя',
    'masterStats.period.month': 'Месяц',
    'masterStats.period.dayLabel': '{date}',
    'masterStats.period.weekLabel': 'Неделя {from}–{to}',
    'masterStats.period.monthLabel': '{month} {year}',
    'masterStats.period.prev': 'Предыдущий период',          // клиент
    'masterStats.period.next': 'Следующий период',           // клиент
    'masterStats.period.clockNote': 'Ивенты считаются по дню ивента, выплаты — по дню распределения: ивент 30-го, распределённый 2-го, попадёт в разные периоды.',
    'masterStats.events.title': 'Мои ивенты',
    'masterStats.events.count': 'Ивентов',
    'masterStats.events.bookings': 'Записей',
    'masterStats.events.collected': 'Собрано',
    'masterStats.events.cashNote': 'В собранном только безналичные: оплата наличными на кассе сюда не входит.',
    'masterStats.events.none': 'Ивентов в этом периоде не было.',
    'masterStats.payouts.title': 'Выплачено мне',
    'masterStats.payouts.amount': 'Выплачено',
    'masterStats.payouts.count': 'Распределений',
    'masterStats.payouts.none': 'Выплат в этом периоде не было.',
    'masterStats.money.title': 'Мой счёт',
    'masterStats.money.balance': 'На счёте',
    'masterStats.money.withdrawable': 'Можно вывести',
    'masterStats.money.expected': 'Ожидается',
    'masterStats.money.expectedNone': 'Нераспределённых ивентов нет.',
    'masterStats.money.nowNote': 'Счёт, вывод и ожидаемое — на сегодня, а не за период.',
    'masterStats.list.title': 'Ивенты периода',
    'masterStats.list.row': '{date} · Записей: {bookings}',
    'masterStats.noData': 'нет данных',
    'masterStats.error': 'Статистика не загрузилась.',
    'masterStats.retry': 'Повторить',
    'masterStats.loading': 'Загружаем статистику…',          // клиент
    'masterStats.denyTitle': 'Сюда нельзя',                   // клиент
    'masterStats.denyNote': 'Статистику мастера видит тот, кто ведёт свои ивенты.',   // клиент
    // шаг 34, eventReport — рецепт `_docs/recept/ekran/34/eventReport.md` (#400): ОДИН отчёт на все страницы статистики
    'eventReport.title': 'Отчёт по ивенту',                   // клиент: заголовок до ответа сервера
    'eventReport.when': '{date}, {time} · {place}',
    'eventReport.whenNoPlace': '{date}, {time}',              // клиент: place сервера null
    'eventReport.bookings.title': 'Записи',
    'eventReport.bookings.count': 'Записей',
    'eventReport.bookings.places': 'Мест',
    'eventReport.bookings.noLimit': 'без предела',
    'eventReport.money.title': 'Деньги',
    'eventReport.money.collected': 'Собрано',
    'eventReport.money.master': 'Мастеру',
    'eventReport.money.club': 'Клубу',
    'eventReport.money.cashNote': 'Только безналичные: оплата наличными на кассе сюда не входит.',
    'eventReport.money.notYet': 'Ещё не распределено — доли появятся после распределения.',
    'eventReport.slot': 'Плата за слот',
    'eventReport.noData': 'нет данных',
    'eventReport.error': 'Отчёт не загрузился.',
    'eventReport.retry': 'Повторить',
    'eventReport.loading': 'Загружаем отчёт…',                // клиент
    'event.approval.pendingPill': 'Ждёт одобрения',
    'event.approval.pendingNote': 'Ивент видите вы и арт-директор. В афише для всех он появится после одобрения, записаться на него до этого нельзя.',
    'event.approval.toQueue': 'Ивенты на одобрение',                      // клиент: ссылка E1 арт-директору (рецепт event.md)
    'event.approval.rejectedPill': 'Отклонён',
    'event.approval.rejectedNote': 'Арт-директор отклонил ивент, в афишу он не попадёт. Причина:',
    'eventNew.done.pending': 'Ивент создан и ждёт одобрения арт-директора. До одобрения его видите только вы и арт-директор.',
    'home.masterBookings.slotFee': '{amount} ฿ — плата за слот, они остаются клубу.',
    // шаг 42, рука ЧАЙ-A — рецепты `_docs/recept/ekran/42/` (teaMasters, teaMaster, teaBook, teaApply, teaHold, teaJoin);
    // «клиент» — вне таблиц рецепта: «загружаем», «отправляем», подписи полей часов/минут, отказ без ручки сервера
    'tea.retry': 'Повторить',
    'tea.sending': 'Отправляем…',                                  // клиент
    'tea.demoNote': 'Это демонстрация: на сервер клуба ничего не ушло.',   // клиент
    'tea.noApi': 'Сервер клуба этого ещё не умеет.',                // клиент: ручки шага 42 нет
    'tea.time': 'Время',
    'tea.timePick': 'Выбрать время в календаре',
    'tea.timeChange': 'Изменить',
    'tea.willCharge': 'Спишется',
    'tea.share': 'С каждого гостя {share} ฿ — клубу, вам — {rest} ฿.',
    'tea.when.until': 'до {hm}, {day}',
    'tea.list.title': 'Чайные мастера',
    'tea.list.loading': 'Загружаем мастеров…',
    'tea.list.fail': 'Мастера не загрузились',
    'tea.list.empty': 'Пока ни одного мастера. Вы чайный мастер? Карточку подают на «Клубе».',
    'tea.card.loading': 'Загружаем…',                             // клиент
    'tea.card.aboutLabel': 'О мастере',
    'tea.card.priceLabel': 'Церемония · {dur}',
    'tea.card.priceNote': 'Спишется со счёта при брони. Если арт-директор откажет, деньги вернутся полностью.',
    'tea.card.book': 'Забронировать мастера',
    'tea.card.mine': 'Это ваша карточка. Изменить её — на «Клубе».',
    'tea.card.gone': 'Карточки больше нет в списке.',
    'tea.card.toList': 'К мастерам',
    'tea.card.fail': 'Карточка не загрузилась',
    'tea.book.title': 'Бронь мастера',
    'tea.book.sub': 'церемония',
    'tea.book.short': 'Не хватает {n} ฿',
    'tea.book.send': 'Забронировать',
    'tea.book.done': 'Бронь отправлена. Мастеру ушло письмо в бота.',
    // B11 — одно состояние брони: решает только арт-директор (api a6d4d4c); строки «Мастер» нет — долг №57, KPG#1115
    'tea.book.stWait': 'ждёт согласования',
    'tea.book.stOk': 'согласована',
    'tea.book.stNo': 'отказ',
    'tea.book.refund': '{sum} ฿ вернулись на счёт.',
    'tea.apply.title': 'Карточка чайного мастера',
    'tea.apply.sub': 'Так карточку увидят в «Услугах». Согласует арт-директор.',
    'tea.apply.editNote': 'Пока арт-директор не решит, в «Услугах» прежняя карточка.',
    'tea.apply.photo': 'Фото',
    'tea.apply.photoNote': 'Вы и ваши церемонии — до 3 снимков. Первый встанет в список.',
    'tea.apply.shotDel': 'Убрать',
    'tea.apply.shotFirst': 'Сделать первым',
    'tea.apply.about': 'Описание',
    'tea.apply.aboutNote': 'Кто вы, какие церемонии проводите, где в клубе.',
    'tea.apply.price': 'Цена церемонии, ฿',
    'tea.apply.dur': 'Сколько длится церемония',
    'tea.apply.durH': 'ч',                                         // клиент
    'tea.apply.durM': 'мин',                                       // клиент
    'tea.apply.preview': 'Как увидят',
    'tea.apply.previewNote': 'Так карточку увидят в «Услугах».',   // клиент
    'tea.apply.previewBack': 'К форме',                            // клиент
    'tea.apply.send': 'Отправить на согласование',
    'tea.apply.sendEdit': 'Отправить правку',
    'tea.apply.done': 'Карточка отправлена арт-директору',
    'tea.apply.noAbout': 'Без описания карточку не согласуют.',
    'tea.apply.priceLow': 'Цена — не меньше {share} ฿: столько с каждого гостя получает клуб.',
    'tea.apply.noDur': 'Укажите, сколько длится церемония.',
    'tea.hold.title.screen': 'Чайная церемония',
    'tea.hold.sub': 'Заявка стоит {amount} ฿ — спишется при подаче. Согласует арт-директор: откажет — деньги вернутся на счёт.',
    'tea.hold.title': 'Название',
    'tea.hold.about': 'Описание',
    'tea.hold.aboutNote': 'Что за церемония и где в клубе',
    'tea.hold.seats': 'Мест',
    'tea.hold.seatsNote': '0 — без ограничения',
    'tea.hold.entry': 'Вход для гостей, ฿',
    'tea.hold.entryLow': 'Вход — не меньше {share} ฿: столько с каждого гостя получает клуб.',
    'tea.hold.short': 'Не хватает {n} ฿: нужно {amount} ฿, на счёте {balance} ฿',
    'tea.hold.topupNote': 'Пополнить счёт можно на вкладке «Клуб» — кошельком в шапке.',
    'tea.hold.send': 'Отправить заявку',
    'tea.hold.done': 'Заявка отправлена',
    'tea.hold.doneNote': 'Списано {amount} ฿. Арт-директору ушло письмо в бота. Ждёт согласования — строка в «Ваших букингах».',
    'tea.hold.noTitle': 'Без названия церемонию не согласуют.',
    'tea.hold.moneyNote': 'Пополнить счёт — кошельком в шапке.',
    'tea.hold.priceFail': 'Цена не загрузилась',
    'tea.join.title': 'Чайная церемония',
    'tea.join.pill': 'Чайная церемония',
    'tea.join.host': 'Проводит {name}',
    'tea.join.seats': 'Мест {free} из {of}',
    'tea.join.seatsNoLimit': 'Мест без ограничения',
    'tea.join.mine': 'Это ваша церемония.',
    'tea.join.past': 'Церемония прошла.',
    'tea.join.gone': 'Этой церемонии нет в календаре.',            // клиент
    // шаг 42, рука ЧАЙ-Б — строки письмом 25.11 (~/.cache/cafe13-chay-B-slova.txt), вписаны как есть
    // guest.md (G0, G1)
    'guest.tea.label': 'Чайные мастера',
    'guest.tea.title': 'Чайные мастера',
    'guest.tea.sub': 'Карточки мастеров и бронь церемонии',
    // masters.md (S1)
    'masters.tea.title': 'Карточки чайных мастеров',
    'masters.tea.sub': 'Новые и изменённые карточки',
    // teaReqs.md
    'teaReqs.title': 'Карточки чайных мастеров',
    'teaReqs.wait': 'Ждут решения',
    'teaReqs.past': 'Решённые',
    'teaReqs.kind.new': 'новая',
    'teaReqs.kind.edit': 'правка',
    'teaReqs.st.wait': 'ждёт',
    'teaReqs.st.ok': 'согласована',
    'teaReqs.st.no': 'отказ',
    'teaReqs.empty.title': 'Карточек нет',
    'teaReqs.empty.sub': 'Здесь появятся карточки, которые мастера подают на «Клубе».',
    'teaReqs.fail.title': 'Карточки не загрузились',
    'teaReqs.fail.retry': 'Попробовать снова',
    'teaReqs.loading': 'Загружаем карточки…',              // клиент
    // teaReq.md
    'teaReq.sub': 'Так карточку увидят в «Услугах».',
    'teaReq.note.label': 'Слова мастеру',
    'teaReq.note.sub': 'Увидит, если откажете.',
    'teaReq.yes': 'Согласовать',
    'teaReq.no': 'Отказать',
    'teaReq.edit.title': 'Это правка. Сейчас в «Услугах»:',
    'teaReq.edit.changed': 'изменено: {what}',
    'teaReq.edit.photo': 'фото',
    'teaReq.edit.about': 'описание',
    'teaReq.edit.price': 'цена',
    'teaReq.done.yes': 'Карточка в «Услугах»',
    'teaReq.done.no': 'Мастер увидит отказ на «Клубе»',
    'teaReq.gone': 'Эту карточку уже решили.',
    'teaReq.gone.back': 'К очереди',
    // home.md, блок «Чайный мастер»
    'home.tea.title': 'Чайный мастер',
    'home.tea.about': 'Карточка с фото, описанием и ценой церемонии. Согласует арт-директор — карточка встанет в «Услуги», и вас смогут забронировать.',
    'home.tea.open': 'Я чайный мастер',
    'home.tea.line': 'Карточка чайного мастера',
    'home.tea.st.wait': 'ждёт',
    'home.tea.st.ok': 'в «Услугах»',
    'home.tea.st.no': 'отказ',
    'home.tea.pending': 'Решает арт-директор.',
    'home.tea.change': 'Изменить карточку',
    'home.tea.editWait': 'Правка ждёт арт-директора. До решения в «Услугах» прежняя карточка.',
    'home.tea.again': 'Подать заново',
    'home.tea.fail': 'Карточка не загрузилась',
    'home.tea.retry': 'Повторить',
    // home.md, блок «Провести» (H0, H0a–H0d) и строка церемонии в «Ваших букингах» — добавлено вторым письмом
    'home.hold.title': 'Провести в клубе',
    'home.hold.sub': 'Заявка стоит {amount} ฿. Согласует арт-директор; откажет — деньги вернутся на счёт.',
    'home.hold.event': 'Провести ивент',
    'home.hold.tea': 'Провести чайную церемонию',
    'home.hold.short': 'Не хватает {n} ฿: нужно {amount} ฿, на счёте {balance} ฿',
    'home.hold.note': 'Пополнить счёт можно на вкладке «Клуб» — кошельком в шапке.',
    'home.hold.loading': 'Узнаём цену…',
    'home.hold.priceFail': 'Цену не удалось узнать у сервера.',
    'home.bookings.tea': 'чайная церемония',
    // шаг 43, calendar — рецепт `_docs/recept/ekran/43/calendar.md` (черновик miniapp#449 e6c59f2); ⚠ «клиент» — вне таблицы
    'calendar.title': 'Календарь',
    'calendar.door': 'Календарь',                                         // V1 на «Ивентах» (43/events.md)
    'calendar.view.month': 'Месяц',
    'calendar.view.week': 'Неделя',
    'calendar.view.day': 'День',
    'calendar.nav.today': 'Сегодня',
    'calendar.nav.prev': 'Предыдущий период',                             // клиент: подпись ‹ для чтения с экрана
    'calendar.nav.next': 'Следующий период',                              // клиент: подпись › для чтения с экрана
    'calendar.week.emptyDay': 'Ни ивентов, ни церемоний',
    'calendar.day.since': 'Идёт с {date} {hm}',
    'calendar.day.noTeaDuringEvent': 'В это время чайных церемоний нет',
    'calendar.day.empty': 'В этот день ни ивентов, ни чайных церемоний нет.',
    'calendar.day.past': 'Прошедшие ивенты афиша не показывает. Свои — в «Моих записях».',
    'calendar.empty': 'В календаре пока ничего нет.',
    'calendar.tea.pill': 'Чайная церемония',
    'calendar.tea.host': 'Проводит {name}',
    'calendar.tea.seats': 'мест {free} из {of}',
    'calendar.tea.seatsNoLimit': 'мест без ограничения',
    'calendar.tea.price': 'вход {n} ฿',
    'calendar.tea.booked': 'вы записаны',
    'calendar.tea.countNow': 'Чайных церемоний в это время: {k} из {cap}',
    'calendar.tea.hiddenPrivate': 'ещё {n} — частная бронь мастера',
    'calendar.tea.hiddenPending': 'ещё {n} — ждёт согласования',
    'calendar.pick.title': 'Время церемонии',
    'calendar.pick.noteHold': 'Выберите, с какого и до какого часа.',
    'calendar.pick.noteBook': '{name} · церемония {dur}. Выберите начало.',
    'calendar.pick.open': 'можно выбрать',
    'calendar.pick.openTea': 'можно выбрать · церемоний {k} из {cap}',
    'calendar.pick.whyEvent': 'занято ивентом «{title}»',
    'calendar.pick.whyFull': 'церемоний в это время уже {k} из {cap}',
    'calendar.pick.whyMaster': 'у мастера другая церемония',
    'calendar.pick.whySelf': 'у вас другая церемония',
    'calendar.pick.whyPast': 'уже прошло',
    'calendar.pick.from': 'С',
    'calendar.pick.to': 'До',
    'calendar.pick.untilBook': 'до {hm}',
    'calendar.pick.nextDay': 'заканчивается {date} в {hm}',
    'calendar.pick.deny': '{span} — {why}. Выберите другое время.',
    'calendar.pick.zero': 'Конец совпадает с началом.',
    'calendar.pick.choose': 'Выбрать это время',
    'calendar.pick.busyFail': 'Не удалось узнать, какое время занято.',
    'calendar.pick.busyWait': 'Узнаём, какое время занято…',
    'calendar.pick.retry': 'Повторить',
    // шаг 44, снимки события — рецепт `_docs/recept/ekran/foto/` (event F6; masterApply P1–P9; ⚠ «клиент» — foto.wait)
    'foto.label': 'Фото',
    'foto.note': 'До трёх снимков. Первый будет крупным.',
    'foto.del': 'Убрать',
    'foto.first': 'Сделать первым',
    'foto.add': 'Добавить фото',
    'foto.loading': 'Загружаем…',
    'foto.squeezed': 'Большие снимки уменьшили — так они быстрее открываются.',
    'foto.tooBig': 'Снимок больше 8 МБ — выберите поменьше.',
    'foto.notImage': 'Это не фото — выберите снимок.',
    'foto.wait': 'Загружаем фото…',
    'foto.frozen': 'Фото согласованы вместе с событием — заменить их нельзя.',
    // шаг 44, заведение карточки товара одной формой и предпросмотром — рецепт `_docs/recept/ekran/44/barCard.md`
    // (слова рецепта; «Создать выключенной» — слово владельца 26.11)
    'barCard.new.recipe': 'Рецепт',
    'barCard.new.recipeLang': 'Рецепт · {lang}',
    'barCard.new.recipeNote': 'Рецепт видит только бар, гость — нет. Без рецепта карточку можно создать выключенной, но не поставить в меню.',
    'barCard.new.create': 'Создать',
    'barCard.preview.note': 'Так карточку увидит гость. В меню она появится, когда её поставят.',
    'barCard.preview.row': 'В списке меню',
    'barCard.preview.open': 'Если открыть позицию',
    'barCard.preview.price': 'Цена',
    'barCard.preview.mins': 'Готовится',
    'barCard.preview.add': 'Добавить в меню',
    'barCard.preview.review': 'Отправить на утверждение',
    'barCard.preview.needRecipe': 'Сначала рецепт — без него позиция не попадёт в меню.',
    'barCard.preview.off': 'Создать выключенной',
    'barCard.preview.unseen': 'Выключенная карточка гостю не видна и ждёт в черновиках.',
    'barCard.preview.fix': 'Изменить',
    'barCard.preview.busy': 'Сохраняем…',
    'barCard.preview.empty': 'Карточка не заполнена.',
    'barCard.preview.toForm': 'К форме',
    'barCard.done.active': 'Карточка в меню: гость её уже видит.',
    'barCard.done.review': 'Карточка создана и отправлена на утверждение.',
    'barCard.done.off': 'Карточка создана выключенной: в меню её нет.',
    'barCard.part.recipe': 'Карточка создана выключенной, но рецепт {lang} не сохранился — он остался в поле.',
    'barCard.part.review': 'Карточка создана выключенной, но на утверждение не ушла.',
    'barCard.part.active': 'Карточка создана выключенной, но в меню не поставлена.'
  }
};
function slovo(key, vars) {
  var d = SLOVA[LANG], s = d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : null;
  if (typeof s !== 'string' || s === '') return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, function (m, k) {
    return Object.prototype.hasOwnProperty.call(vars, k) && vars[k] !== null && vars[k] !== undefined ? String(vars[k]) : m;
  });
}
