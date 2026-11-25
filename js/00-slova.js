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
    'event.approval.pendingPill': 'Ждёт одобрения',
    'event.approval.pendingNote': 'Ивент видите вы и арт-директор. В афише для всех он появится после одобрения, записаться на него до этого нельзя.',
    'event.approval.toQueue': 'Ивенты на одобрение',                      // клиент: ссылка E1 арт-директору (рецепт event.md)
    'event.approval.rejectedPill': 'Отклонён',
    'event.approval.rejectedNote': 'Арт-директор отклонил ивент, в афишу он не попадёт. Причина:',
    'eventNew.done.pending': 'Ивент создан и ждёт одобрения арт-директора. До одобрения его видите только вы и арт-директор.',
    'home.masterBookings.slotFee': '{amount} ฿ — плата за слот, они остаются клубу.',
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
    'calendar.pick.retry': 'Повторить'
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
