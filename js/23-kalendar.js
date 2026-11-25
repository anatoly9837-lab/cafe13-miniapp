/* ── календарь клуба (шаг 43, рецепт `_docs/recept/ekran/43/calendar.md`, черновик miniapp#449 e6c59f2) ──

   Своё, без библиотеки: решение координатора 25.11.2026 после замера трёх кандидатов — рецепт не берёт у
   библиотеки ничего, кроме сетки месяца («Неделя» — список по дням, «День» — список по времени, без шкалы
   часов; выбор — полосами по границам занятого), а 145 КБ человек ждал бы на каждом открытии.

   Часы — клуба, не телефона: день и время любой отметки считает bkk() (`js/09-afisha.js`, явный пояс
   Asia/Bangkok через Intl, тот же, что у афиши). Даты — строками ymd острова; арифметика — ymdAdd() в UTC
   полдень. Случай на границе суток — `cal-chasy-kluba`: starts_at 2026-12-01T18:30:00Z — это 2 декабря.

   Ивенты — eventList(), тот же массив, что у «Ивентов», своего запроса нет.

   ⚠ ЗАГЛУШКА ЦЕРЕМОНИЙ. Ручки церемоний (сервер шага 42) нет. TEA_API = false: в живом режиме церемоний в
   календаре НЕТ вовсе (не «не загрузились» — спрашивать некого), в демонстрации — набор TEA_DEMO в форме,
   которую ждём от сервера. Живой путь включается ТОЛЬКО заменой TEA_API на true вместе с loadTea() на ручку
   сервера в бою — правило сцепки: клиент в бой после сервера. */

var TEA_API = false;
var CAL = { mode: 'look', view: 'month', day: null, mon: null, ret: false };   // mon — первое число показанного месяца, ymd

/* Набор демонстрации. Ёмкость 4, а не 3 НАРОЧНО (рецепт, случай `cal-vybor-tri`): 3 константой в коде
   сошлось бы с набором и спряталось. `vis`: open — согласованная, mine — своя ждущая, private — частная бронь
   мастера (без имён), pending — чужая ждущая (без имён). */
var TEA_CAP_DEMO = 4;
function teaDemo() {
  var t = ymdAdd(bkk(new Date()).ymd, 1);
  function at(ymd, hm) { return Date.parse(ymd + 'T' + hm + ':00+07:00'); }
  return [
    { id: 't1', vis: 'open', title: 'Пуэр и тишина', at: at(t, '15:00'), mins: 60, host: '[мастер]', free: 3, of: 6, price: 300, booked: false },
    { id: 't2', vis: 'open', title: 'Улуны Тайваня', at: at(t, '15:00'), mins: 90, host: '[мастер]', free: null, of: null, price: 100, booked: true },
    { id: 't3', vis: 'private', at: at(t, '15:00'), mins: 60 },
    { id: 't4', vis: 'pending', at: at(t, '15:30'), mins: 60 },
    { id: 't5', vis: 'mine', title: 'Габа на закате', at: at(ymdAdd(t, 2), '18:00'), mins: 75, host: '[вы]', free: 5, of: 5, price: 200, booked: false }
  ];
}
function teaList() { return LIVE ? (TEA_API ? null : []) : teaDemo(); }
function teaCap() { return LIVE ? null : TEA_CAP_DEMO; }

/* Дни, которые занимает отметка: от дня начала до дня последней минуты — ивент 22:00 + 300 мин стоит в
   двух клетках (`cal-polnoch`). У демо-ивента даты нет — его день даёт evYmd(), и он однодневный. */
function calDays(x) {
  var a = typeof x.at === 'number' ? bkk(new Date(x.at)).ymd : evYmd(x);
  if (typeof x.at !== 'number' || !(x.mins > 0)) return [a];
  var b = bkk(new Date(x.at + x.mins * 60000 - 1)).ymd, out = [a];
  while (out[out.length - 1] < b && out.length < 62) out.push(ymdAdd(out[out.length - 1], 1));
  return out;
}
function calIndex() {
  var ev = {}, tea = {}, list = eventList() || [], tl = teaList() || [];
  list.forEach(function (e) { calDays(e).forEach(function (d) { (ev[d] = ev[d] || []).push(e); }); });
  tl.forEach(function (c) { calDays(c).forEach(function (d) { (tea[d] = tea[d] || []).push(c); }); });
  return { ev: ev, tea: tea };
}
function calSortKey(x, d) {
  // начатое в прошлый день идёт первым: его «начало» в этом дне — полночь
  var s = typeof x.at === 'number' ? bkk(new Date(x.at)) : null;
  return s && s.ymd < d ? '00:00' : s ? s.hm : (x.time || '');
}

function calDayTitle(d) {
  var x = d.split('-'), w = (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
  return DOW_SHORT[w] + ', ' + Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1];
}
var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function calMonthStart(d) { return d.slice(0, 8) + '01'; }
function calMonthAdd(m, n) {
  var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n;
  y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
  return y + '-' + (mo < 9 ? '0' : '') + (mo + 1) + '-01';
}
function calCount(n, one, few, many) {
  return n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
}
function calNote(d, ix) {
  var e = (ix.ev[d] || []).length, t = (ix.tea[d] || []).filter(function (c) { return c.vis === 'open' || c.vis === 'mine'; }).length;
  return calDayTitle(d) +
    (e ? ' · ' + e + ' ' + calCount(e, 'ивент', 'ивента', 'ивентов') : '') +
    (t ? ' · ' + t + ' ' + calCount(t, 'церемония', 'церемонии', 'церемоний') : '');
}

/* L18 — строка церемонии. Частные и чужие ждущие строк НЕ получают: они сосчитаны в L19/L20. */
function teaRow(c) {
  var s = bkk(new Date(c.at)), f = bkk(new Date(c.at + c.mins * 60000));
  var seats = c.of === null || c.of === undefined ? slovo('calendar.tea.seatsNoLimit') : slovo('calendar.tea.seats', { free: c.free, of: c.of });
  return '<button type="button" class="listitem" data-action="cal-tea:' + esc(c.id) + '">' +
    '<span class="time"><b>' + esc(s.hm) + '</b><span>' + esc(f.hm) + '</span></span>' +
    '<span class="grow"><b class="clamp1">' + esc(s.hm + '–' + f.hm + ' · ' + c.title) + '</b>' +
    '<span class="small">' + esc(slovo('calendar.tea.host', { name: c.host }) + ' · ' + seats + ' · ' + slovo('calendar.tea.price', { n: c.price })) + '</span></span>' +
    (c.vis === 'mine' ? '<span class="pill on">' + esc(slovo('event.approval.pendingPill')) + '</span>'
      : c.booked ? '<span class="pill on">' + esc(slovo('calendar.tea.booked')) + '</span>' : '') +
    '<span class="pill tea">' + esc(slovo('calendar.tea.pill')) + '</span>' +
  '</button>';
}

/* Список одного дня: ивенты и церемонии по времени начала. Церемонии одного часа — группа: над ней L19, когда их
   больше одной или среди них скрытые; под ней L20 — ненулевые части скрытых. */
function calDayList(d, ix, dayView) {
  var items = (ix.ev[d] || []).map(function (e) { return { k: calSortKey(e, d), e: e }; });
  var hours = {};
  (ix.tea[d] || []).forEach(function (c) { var h = calSortKey(c, d).slice(0, 2); (hours[h] = hours[h] || []).push(c); });
  Object.keys(hours).forEach(function (h) { items.push({ k: h + ':00', tea: hours[h] }); });
  items.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : a.e ? -1 : 1; });
  var cap = teaCap();
  return items.map(function (it) {
    if (it.e) {
      var e = it.e, s = typeof e.at === 'number' ? bkk(new Date(e.at)) : null;
      var x = s ? s.ymd.split('-') : null;
      return (s && s.ymd < d ? '<span class="small">' + esc(slovo('calendar.day.since', { date: Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1], hm: s.hm })) + '</span>' : '') +
        eventRow(e) + (dayView ? '<span class="small">' + esc(slovo('calendar.day.noTeaDuringEvent')) + '</span>' : '');
    }
    var shown = it.tea.filter(function (c) { return c.vis === 'open' || c.vis === 'mine'; });
    var priv = it.tea.filter(function (c) { return c.vis === 'private'; }).length;
    var pend = it.tea.filter(function (c) { return c.vis === 'pending'; }).length;
    var head = it.tea.length > 1 || priv || pend
      ? '<span class="small">' + esc(slovo('calendar.tea.countNow', { k: it.tea.length, cap: cap })) + '</span>' : '';
    var tail = [priv ? slovo('calendar.tea.hiddenPrivate', { n: priv }) : '', pend ? slovo('calendar.tea.hiddenPending', { n: pend }) : '']
      .filter(Boolean).join(' · ');
    return head + shown.map(teaRow).join('') + (tail ? '<span class="small">' + esc(tail) + '</span>' : '');
  }).join('');
}

function calSeg() {
  return '<div class="seg">' + [['month', slovo('calendar.view.month')], ['week', slovo('calendar.view.week')], ['day', slovo('calendar.view.day')]].map(function (v) {
    return '<button type="button" data-action="cal-view:' + v[0] + '" aria-pressed="' + (CAL.view === v[0]) + '">' + esc(v[1]) + '</button>';
  }).join('') + '</div>';
}
function calNav(label, hasToday, canBack) {
  return '<div class="wknav"><button type="button" class="round" data-action="cal-prev" aria-label="' + esc(slovo('calendar.nav.prev')) + '"' + (canBack ? '' : ' disabled') + '>‹</button>' +
    '<b>' + esc(label) + '</b>' +
    (hasToday ? '' : '<button type="button" class="btn quiet mini" data-action="cal-today">' + esc(slovo('calendar.nav.today')) + '</button>') +
    '<button type="button" class="round" data-action="cal-next" aria-label="' + esc(slovo('calendar.nav.next')) + '">›</button></div>';
}

/* Прошлое: /events отдаёт только не кончившееся, поэтому пустой прошедший день был бы правдоподобной ложью — он
   говорит L9. ‹ на периоде, который содержит сегодня, жив (прошлые дни этого периода говорят L9); дальше назад —
   погашен. */
function calLook() {
  var list = eventList();
  if (!list) return eventsWait();
  var today = bkk(new Date()).ymd, ix = calIndex();
  if (!CAL.day) CAL.day = today;
  if (!CAL.mon) CAL.mon = calMonthStart(CAL.day);
  var empty = !list.length && !(teaList() || []).some(function (c) { return c.vis === 'open' || c.vis === 'mine'; });
  var body = '', nav;
  if (CAL.view === 'month') {
    var m = CAL.mon, first = ymdMonday(m), next = calMonthAdd(m, 1), cells = '';
    nav = calNav(MONTHS_NOM[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4), m === calMonthStart(today), calCanBack(today));
    for (var d = first, i = 0; i < 42 && (i % 7 !== 0 || d < next); d = ymdAdd(d, 1), i++) {
      if (d < m || d >= next) { cells += '<span class="out"></span>'; continue; }
      var past = d < today, bars = '';
      if (!past) {
        var ne = (ix.ev[d] || []).length, nt = (ix.tea[d] || []).filter(function (c) { return c.vis === 'open' || c.vis === 'mine'; }).length;
        for (var k = 0; k < Math.min(ne + nt, 3); k++) bars += '<span class="' + (k < ne ? 'ev' : 'ev tea') + '"></span>';
      }
      cells += '<button type="button" data-action="cal-day:' + d + '" class="' + (d === CAL.day ? 'on' : '') + (d === today ? ' today' : '') + (past ? ' past' : '') + '"' +
        ' aria-pressed="' + (d === CAL.day) + '"><span class="n">' + Number(d.slice(8)) + '</span>' + bars + '</button>';
    }
    body = '<div class="month">' + DOW_SHORT.map(function (w) { return '<span class="dw">' + w + '</span>'; }).join('') + cells + '</div>';
  } else if (CAL.view === 'week') {
    var mon = ymdMonday(CAL.day), days = [0, 1, 2, 3, 4, 5, 6].map(function (n) { return ymdAdd(mon, n); });
    nav = calNav(weekRange(days[0], days[6]), days.indexOf(today) !== -1, calCanBack(today));
    body = days.map(function (d) {
      var rows = d < today ? '' : calDayList(d, ix, false);
      return '<div class="group"><button type="button" class="daynote" data-action="cal-day:' + d + '">' + esc(calNote(d, ix)) + '</button>' +
        (d < today ? '<span class="small">' + esc(slovo('calendar.day.past')) + '</span>'
          : rows || '<span class="small">' + esc(slovo('calendar.week.emptyDay')) + '</span>') + '</div>';
    }).join('');
  } else {
    var dd = CAL.day;
    nav = calNav(calDayTitle(dd), dd === today, calCanBack(today));
    var rows2 = dd < today ? '' : calDayList(dd, ix, true);
    body = '<div class="daynote">' + esc(calNote(dd, ix)) + '</div>' +
      (dd < today ? '<div class="card quiet"><span class="small">' + esc(slovo('calendar.day.past')) + '</span></div>'
        : rows2 ? '<div class="group">' + rows2 + '</div>'
        : '<div class="card quiet"><span class="small">' + esc(slovo('calendar.day.empty')) + '</span></div>');
  }
  return calSeg() + nav + body +
    (empty ? '<div class="card quiet"><span class="small">' + esc(slovo('calendar.empty')) + '</span></div>' : '');
}

SCREENS.calendar = function () { return calLook(); };

/* Перелистывание. Месяц — на месяц, неделя — на семь дней, день — на день. Назад не дальше периода с сегодня. */
function calPeriodEnd() {
  return CAL.view === 'month' ? ymdAdd(calMonthAdd(CAL.mon, 1), -1)
    : CAL.view === 'week' ? ymdAdd(ymdMonday(CAL.day), 6) : CAL.day;
}
function calCanBack(today) { return calPeriodEnd() >= today; }
function calMove(n) {
  var today = bkk(new Date()).ymd;
  if (n < 0 && !calCanBack(today)) return;
  if (CAL.view === 'month') {
    var m = calMonthAdd(CAL.mon, n);
    CAL.mon = m; CAL.day = m === calMonthStart(today) ? today : m;
  } else {
    var d = ymdAdd(CAL.day, CAL.view === 'week' ? 7 * n : n);
    CAL.day = d; CAL.mon = calMonthStart(d);
  }
  haptic(); render();
}
/* Вход с «Ивентов» — «Месяц» с сегодняшним месяцем; возврат с `event` — тот же вид и день (память страницы). */
function calEnter() { CAL = { mode: 'look', view: 'month', day: bkk(new Date()).ymd, mon: null, ret: false }; }
/* Зовёт go() на каждый переход: с календаря на `event`/`teaJoin` — запомнить, что назад в календарь; вход в
   календарь с «Ивентов» — с начала; любой другой переход забывает возврат. */
function calGo(screen) {
  if (screen === 'calendar' && current === 'events') calEnter();
  else if ((screen === 'event' || screen === 'teaJoin') && current === 'calendar') CAL.ret = true;
  else if (screen !== 'calendar' && screen !== 'event' && screen !== 'teaJoin') CAL.ret = false;
}
function calAction(a, arg) {
  if (a === 'cal-view' && /^(month|week|day)$/.test(arg)) { CAL.view = arg; haptic(); render(); return true; }
  if (a === 'cal-prev') { calMove(-1); return true; }
  if (a === 'cal-next') { calMove(1); return true; }
  if (a === 'cal-today') { CAL.day = bkk(new Date()).ymd; CAL.mon = calMonthStart(CAL.day); haptic(); render(); return true; }
  if (a === 'cal-day' && /^\d{4}-\d\d-\d\d$/.test(arg)) { CAL.day = arg; CAL.mon = calMonthStart(arg); CAL.view = 'day'; haptic(); render(); return true; }
  // запись на церемонию — экран teaJoin шага 42 (первая рука); пока его нет, строка не ведёт никуда
  if (a === 'cal-tea') { if (SCREENS.teaJoin) go('teaJoin', arg); return true; }
  return false;
}
