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
    { id: 't1', vis: 'open', title: 'Пуэр и тишина', at: at(t, '15:00'), mins: 60, master: 'm1', host: '[мастер]', free: 3, of: 6, price: 300, booked: false },
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
  return (CAL.mode === 'pick' ? calPickNote() : '') + calSeg() + nav + body +
    (empty ? '<div class="card quiet"><span class="small">' + esc(slovo('calendar.empty')) + '</span></div>' : '');
}

SCREENS.calendar = function () { return CAL.mode === 'pick' && CAL.view === 'day' ? calPick() : calLook(); };

/* Перелистывание. Месяц — на месяц, неделя — на семь дней, день — на день. Назад не дальше периода с сегодня. */
function calPeriodEnd() {
  return CAL.view === 'month' ? ymdAdd(calMonthAdd(CAL.mon, 1), -1)
    : CAL.view === 'week' ? ymdAdd(ymdMonday(CAL.day), 6) : CAL.day;
}
function calCanBack(today) { return calPeriodEnd() >= today; }
function calMove(n) {
  var today = bkk(new Date()).ymd;
  if (n < 0 && !calCanBack(today)) return;
  if (n < 0 && CAL.mode === 'pick' && CAL.view === 'day' && CAL.day <= today) return;   // «выбрать»: ‹ к прошлому погашен на сегодня
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
function calGo(screen, p) {
  if (screen === 'calendar' && p && typeof p === 'object' && (p.pick === 'teaHold' || p.pick === 'teaBook')) calPickEnter(p);
  else if (screen === 'calendar' && current === 'events') calEnter();
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
  // аргумент — «ЧЧ:ММ@ЧЧ:ММ», а не минуты: склейка цифр через дефис читается стражем ids-clean как номер
  if (a === 'cal-band' && /^\d\d:\d\d@\d\d:\d\d$/.test(arg) && CAL.mode === 'pick') { calBand(arg); return true; }
  if (a === 'cal-choose' && CAL.mode === 'pick') { calChoose(); return true; }
  if (a === 'cal-busy-retry' && CAL.mode === 'pick') { render(); return true; }
  return false;
}

/* ── режим «выбрать время» (рецепт calendar.md, L11–L17) ──────────────────────────────────────────────────
   Вход с teaHold (провести церемонию) и teaBook (бронь мастера) шага 42 — экраны первой руки. Стык назвал
   координатор 25.11: они зовут go('calendar', { pick: 'teaHold' | 'teaBook', day?, master? }) и читают выбор
   функцией calPicked(откуда). Экранов первой руки может ещё не быть — тогда выбор остаётся в CAL.pick, а экран
   говорит, что время выбрано; назад — на «Ивенты».

   ГЛАВНОЕ ПРАВИЛО ВЛАДЕЛЬЦА (цитата 10): занятое время НЕ ВЫБИРАЕТСЯ. Закрытая полоса — <div>, а не кнопка: у неё
   нет data-action, нажать её нечем. Поля С/До, задевшие закрытое, гасят «Выбрать это время» и называют причину.
   Календарь не единственный страж — сервер шага 42 обязан отказать сам (calendar-dovody.md, ГРАНИЦА).

   Время — по часам клуба ЯВНЫМ смещением: минута дня d считается от Date.parse(d + 'T00:00:00+07:00'). У острова
   нет перевода часов, поэтому смещение постоянно; оно же у bkk() через Intl 'Asia/Bangkok'. */
var CAL_OFF = '+07:00';
var CAL_DAY_MS = 86400000;
function calDayStart(d) { return Date.parse(d + 'T00:00:00' + CAL_OFF); }
function calHm(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
function calMin(hm) { var x = /^(\d\d):(\d\d)$/.exec(hm || ''); return x ? Number(x[1]) * 60 + Number(x[2]) : null; }

function calPickEnter(p) {
  var today = bkk(new Date()).ymd;
  var day = /^\d{4}-\d\d-\d\d$/.test(p.day || '') ? p.day : ymdAdd(today, 1);
  var m = p.master && typeof p.master === 'object' ? p.master : null;
  CAL = { mode: 'pick', src: p.pick, view: 'day', day: day, mon: calMonthStart(day), ret: false,
          master: m, from: '', to: '', pick: CAL.pick && CAL.pick.src === p.pick ? CAL.pick : null };
  if (CAL.pick && CAL.pick.ymd === day) { CAL.from = CAL.pick.from; CAL.to = CAL.pick.to; }
}
function calBack() {
  if (CAL.mode !== 'pick') return 'events';
  return SCREENS[CAL.src] ? CAL.src : 'events';
}
/* Что вернула календарь форме: { src, ymd, from, to, at, mins, label } или null. */
function calPicked(src) { return CAL.pick && CAL.pick.src === src ? CAL.pick : null; }

function calPickNote() {
  var m = CAL.master;
  return '<span class="small">' + esc(CAL.src === 'teaBook'
    ? slovo('calendar.pick.noteBook', { name: m && m.name || '', dur: calHm(calDur()).replace(/^0/, '') })
    : slovo('calendar.pick.noteHold')) + '</span>';
}
function calDur() { var m = CAL.master; return m && m.mins > 0 ? m.mins : 0; }

/* Занятость двух суток от начала дня d (минуты 0…2880): ивенты, церемонии с видом, свои/мастера. В демонстрации —
   из eventList() и teaDemo(); в живом режиме ручки нет (сервер шага 42) — null, экран говорит L17. */
function calSpan(x) {
  if (typeof x.at === 'number') return [x.at, x.at + (x.mins > 0 ? x.mins : 0) * 60000];
  var d = evYmd(x), s = Date.parse(d + 'T' + x.time + ':00' + CAL_OFF), e = Date.parse(d + 'T' + (x.until || x.time) + ':00' + CAL_OFF);
  if (e <= s) e += CAL_DAY_MS;
  return [s, e];
}
function calBusy(d) {
  if (LIVE && !TEA_API) return null;
  var t0 = calDayStart(d), t1 = t0 + 2 * CAL_DAY_MS, out = [];
  function add(span, o) {
    var a = Math.max(span[0], t0), b = Math.min(span[1], t1);
    if (b > a) { o.s = Math.round((a - t0) / 60000); o.e = Math.round((b - t0) / 60000); out.push(o); }
  }
  (eventList() || []).forEach(function (e) { add(calSpan(e), { kind: 'event', title: e.title }); });
  var mid = CAL.master && CAL.master.id;
  (teaList() || []).forEach(function (c) {
    var sp = calSpan(c);
    add(sp, { kind: 'tea', vis: c.vis, title: c.title || '' });
    if (CAL.src === 'teaHold' && c.vis === 'mine') add(sp, { kind: 'own' });
    if (CAL.src === 'teaBook' && mid && c.master === mid) add(sp, { kind: 'own' });
  });
  return { items: out, cap: teaCap() };
}
/* Отрезки двух суток по границам занятого. Причина закрытия — первая по порядку: ивент, полные места, своя/мастера
   церемония, прошлое (calendar-dovody.md, «Три причины закрытия»). */
function calSegments(d, busy) {
  var nowMin = Math.floor((Date.now() - calDayStart(d)) / 60000);
  var pts = [0, 2880];
  if (nowMin > 0 && nowMin < 2880) pts.push(nowMin);
  busy.items.forEach(function (x) { pts.push(x.s, x.e); });
  pts = pts.filter(function (v, i, a) { return v >= 0 && v <= 2880 && a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  var segs = [];
  for (var i = 0; i + 1 < pts.length; i++) {
    var a = pts[i], b = pts[i + 1];
    var on = busy.items.filter(function (x) { return x.s < b && x.e > a; });
    var ev = on.filter(function (x) { return x.kind === 'event'; })[0];
    var tea = on.filter(function (x) { return x.kind === 'tea'; });
    var own = on.some(function (x) { return x.kind === 'own'; });
    var why = ev ? 'event' : busy.cap !== null && tea.length >= busy.cap ? 'full' : own ? 'own' : b <= nowMin ? 'past' : '';
    var key = why + '|' + (ev ? ev.title : '') + '|' + tea.length + '|' + tea.map(function (x) { return x.vis + x.title; }).join(',');
    var last = segs[segs.length - 1];
    if (last && last.key === key) last.e = b;
    else segs.push({ s: a, e: b, why: why, ev: ev, tea: tea, key: key });
  }
  return segs;
}
function calWhy(sg, cap) {
  return sg.why === 'event' ? slovo('calendar.pick.whyEvent', { title: sg.ev.title })
    : sg.why === 'full' ? slovo('calendar.pick.whyFull', { k: sg.tea.length, cap: cap })
    : sg.why === 'own' ? (CAL.src === 'teaBook' ? slovo('calendar.pick.whyMaster') : slovo('calendar.pick.whySelf'))
    : slovo('calendar.pick.whyPast');
}
function calTeaNames(tea) {
  var named = tea.filter(function (x) { return x.vis === 'open' || x.vis === 'mine'; }).map(function (x) { return '«' + x.title + '»'; });
  var priv = tea.filter(function (x) { return x.vis === 'private'; }).length, pend = tea.filter(function (x) { return x.vis === 'pending'; }).length;
  return named.concat(priv ? [slovo('calendar.tea.hiddenPrivate', { n: priv })] : [], pend ? [slovo('calendar.tea.hiddenPending', { n: pend })] : []).join(', ');
}
/* Отрезок [f, t) в минутах от начала дня задевает закрытое? Возвращает закрытый отрезок или null. */
function calHit(segs, f, t) {
  for (var i = 0; i < segs.length; i++) if (segs[i].why && segs[i].s < t && segs[i].e > f) return segs[i];
  return null;
}
function calRange() {
  var f = calMin(CAL.from); if (f === null) return null;
  if (CAL.src === 'teaBook') { var du = calDur(); return du > 0 ? { f: f, t: f + du } : null; }
  var t = calMin(CAL.to); if (t === null) return null;
  return { f: f, t: t === f ? f : t < f ? t + 1440 : t };
}

function calPick() {
  var d = CAL.day, today = bkk(new Date()).ymd;
  var head = calPickNote() + calSeg() + calNav(calDayTitle(d), d === today, d > today);
  var busy = calBusy(d);
  if (!busy) return head + '<div class="card quiet"><span class="small">' + esc(slovo('calendar.pick.busyFail')) + '</span>' +
    '<button type="button" class="btn quiet mini" data-action="cal-busy-retry">' + esc(slovo('calendar.pick.retry')) + '</button></div>';
  var segs = calSegments(d, busy), r = calRange();
  var bands = segs.filter(function (sg) { return sg.s < 1440; }).map(function (sg) {
    var e = Math.min(sg.e, 1440), span = calHm(sg.s) + '–' + (e === 1440 ? '24:00' : calHm(e));
    var names = sg.tea.length ? '<span class="small">' + esc(calTeaNames(sg.tea)) + '</span>' : '';
    if (sg.why) return '<div class="tband off" aria-disabled="true">' + esc(span + ' · ' + calWhy(sg, busy.cap)) + '</div>' + (sg.why === 'full' ? names : '');
    var sel = r && r.f >= sg.s && r.f < e;
    return '<button type="button" class="tband' + (sel ? ' on' : '') + '" data-action="cal-band:' + calHm(sg.s) + '@' + (e === 1440 ? '24:00' : calHm(e)) + '">' +
      esc(span + ' · ' + (sg.tea.length ? slovo('calendar.pick.openTea', { k: sg.tea.length, cap: busy.cap }) : slovo('calendar.pick.open'))) + '</button>' + names;
  }).join('');
  var hit = r && r.t > r.f ? calHit(segs, r.f, r.t) : null;
  var deny = !r ? '' : r.t === r.f ? slovo('calendar.pick.zero')
    : hit ? slovo('calendar.pick.deny', { span: calHm(Math.max(hit.s, r.f)) + '–' + calHm(Math.min(hit.e, r.t)), why: calWhy(hit, busy.cap) }) : '';
  var ok = r && r.t > r.f && !hit;
  var to = CAL.src === 'teaBook'
    ? (r ? '<span class="small">' + esc(slovo('calendar.pick.untilBook', { hm: calHm(r.t) })) + '</span>' : '')
    : '<div class="field"><label for="cal-to">' + esc(slovo('calendar.pick.to')) + '</label><input id="cal-to" type="time" step="60" value="' + esc(CAL.to) + '"></div>';
  var x = r && r.t > 1440 ? ymdAdd(d, 1).split('-') : null;
  return head + '<div class="group">' + bands + '</div>' +
    '<div class="card"><div class="col"><div class="field"><label for="cal-from">' + esc(slovo('calendar.pick.from')) + '</label><input id="cal-from" type="time" step="60" value="' + esc(CAL.from) + '"></div>' +
    to + (x ? '<span class="small">' + esc(slovo('calendar.pick.nextDay', { date: Number(x[2]) + ' ' + MONTHS[Number(x[1]) - 1], hm: calHm(r.t) })) + '</span>' : '') +
    (deny ? '<div class="deny"><span>' + esc(deny) + '</span></div>' : '') +
    '<button type="button" class="btn" data-action="cal-choose"' + (ok ? '' : ' disabled') + '>' + esc(slovo('calendar.pick.choose')) + '</button>' +
    (CAL.pick && CAL.pick.ymd === d && !SCREENS[CAL.src] ? '<span class="small">' + esc(CAL.pick.label) + '</span>' : '') + '</div></div>';
}
/* Нажатие ОТКРЫТОЙ полосы: С — её начало (не раньше «сейчас»), До — её конец (teaHold). У закрытой полосы этого
   действия нет вовсе; повторная проверка здесь — на случай подложенной разметки. */
function calBand(arg) {
  var p = arg.split('@'), s = calMin(p[0]), e = calMin(p[1]);
  var busy = calBusy(CAL.day); if (!busy) return;
  var sg = calSegments(CAL.day, busy).filter(function (x) { return x.s <= s && x.e >= e; })[0];
  if (!sg || sg.why) return;
  CAL.from = calHm(s);
  if (CAL.src === 'teaHold') CAL.to = e >= 1440 ? '00:00' : calHm(e);
  haptic(); render();
}
function calChoose() {
  var busy = calBusy(CAL.day), r = calRange();
  if (!busy || !r || r.t <= r.f || calHit(calSegments(CAL.day, busy), r.f, r.t)) return;
  var at = calDayStart(CAL.day) + r.f * 60000;
  CAL.pick = { src: CAL.src, ymd: CAL.day, from: calHm(r.f), to: calHm(r.t), at: at, mins: r.t - r.f,
               label: calDayTitle(CAL.day) + ' · ' + calHm(r.f) + '–' + calHm(r.t) };
  haptic('ok');
  if (SCREENS[CAL.src]) go(CAL.src); else render();
}
document.addEventListener('change', function (ev) {
  var id = ev.target && ev.target.id;
  if (id !== 'cal-from' && id !== 'cal-to') return;
  if (id === 'cal-from') CAL.from = ev.target.value; else CAL.to = ev.target.value;
  render();
});
/* Заголовок экрана зависит от режима: «Календарь» / «Время церемонии». */
Object.defineProperty(TITLES, 'calendar', { configurable: true, enumerable: true,
  get: function () { return (CAL.mode === 'pick' ? slovo('calendar.pick.title') : slovo('calendar.title')); } });
