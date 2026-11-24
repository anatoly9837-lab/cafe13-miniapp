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
    // шаг 36 (Cafe13KPG#567, рецепт 36/myStats, #403): «моя» статистика — у любого вошедшего; форма api#195
    'myStats.door': 'Моя статистика',
    'myStats.title': 'Моя статистика',
    'myStats.period.day': 'День',
    'myStats.period.week': 'Неделя',
    'myStats.period.month': 'Месяц',
    'myStats.period.dayLabel': '{date}',
    'myStats.period.weekLabel': 'Неделя {from}–{to}',
    'myStats.period.monthLabel': '{month} {year}',
    'myStats.period.prev': 'Предыдущий период',              // клиент
    'myStats.period.next': 'Следующий период',               // клиент
    'myStats.period.clockNote': 'Записи считаются по дню ивента, пополнения — по дню зачисления.',
    'myStats.events.title': 'Мои записи',
    'myStats.events.count': 'Записей',
    'myStats.events.spent': 'Оплачено',
    'myStats.events.none': 'Записей в этом периоде не было.',
    'myStats.topups.title': 'Пополнения',
    'myStats.topups.amount': 'Пополнено',
    'myStats.topups.count': 'Пополнений',
    'myStats.topups.none': 'Пополнений в этом периоде не было.',
    'myStats.money.title': 'Мой счёт',                       // клиент: у карточки D заголовка в рецепте нет
    'myStats.money.balance': 'На счёте',
    'myStats.money.nowNote': 'На счёте — на сегодня, а не за период.',
    'myStats.list.title': 'Ивенты периода',
    'myStats.list.row': '{date}',
    'myStats.noData': 'нет данных',
    'myStats.error': 'Статистика не загрузилась.',
    'myStats.retry': 'Повторить',
    'myStats.loading': 'Загружаем статистику…',              // клиент
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
    'home.masterBookings.slotFee': '{amount} ฿ — плата за слот, они остаются клубу.'
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
