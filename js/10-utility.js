/* ── утилиты ─────────────────────────────────────────── */

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
/* Переключение типа участия перерисовывает форму. Без этого всё, что
   человек уже ввёл, пропадало — поймано функциональной проверкой. */
function grabForm(ids) {
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) FORM.v[id] = el.value;
  });
}
var EVENT_FIELDS = ['f-title', 'f-date', 'f-time', 'f-dur', 'f-seats', 'f-price', 'f-about'];
function keep(id, dflt) {
  var x = FORM.v[id];
  return esc(x === undefined || x === '' ? (dflt || '') : x);
}

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function dayWord(iso) {
  if (!iso) return 'Скоро';
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return 'Скоро';
  var days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  var today = new Date(); today.setHours(0,0,0,0);
  var diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Сегодня, ' + days[d.getDay()];
  if (diff === 1) return 'Завтра, ' + days[d.getDay()];
  return d.getDate() + '.' + (d.getMonth() + 1) + ', ' + days[d.getDay()];
}
function partOf(t) {
  var h = parseInt((t || '19:00').split(':')[0], 10);
  return h < 12 ? 'утро' : h < 16 ? 'день' : 'вечер';
}
function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

/* Живой экран членства (Cafe13KPG#415), кадры E38* (Cafe13KPG#428).
   Имя, описание, цена и срок вида — только с сервера: текст в клиенте не
   меняется без выкладки и не проверяется ничем. */
function tierSum(t) { return money(t.price % 1 ? t.price.toFixed(2) : t.price) + ' ฿'; }
function tierPeriod(t) { return t.months === 1 ? 'в месяц' : 'за ' + t.months + ' ' + plural(t.months, ['месяц', 'месяца', 'месяцев']); }
function tierPrice(t) { return tierSum(t) + ' ' + tierPeriod(t); }
function tierOf(code) { return (TIERS.list || []).filter(function (t) { return t.code === code; })[0] || null; }
function stateCard(title, small, pill, warm) {
  var ink = warm ? ' style="color:var(--clay-ink)"' : '';
  return '<div class="card' + (warm ? ' warm' : '') + '"><div class="row top"><div class="col"><b' + ink + '>' + title + '</b>' +
    '<span class="small">' + small + '</span></div><span class="pill"' + ink + '>' + pill + '</span></div></div>';
}
var PRICE_NOTE = 'Цены приходят с сервера клуба и могут измениться — в приложении они не зашиты. Деньги принимает касса: приложение платежей не принимает вовсе.';
function noteBox(t) { return '<div class="note">' + svg(ICON.info) + '<span>' + t + '</span></div>'; }
function membershipLive() {
  var have = (DATA.member && DATA.member.memberships) || [];
  var mine = function (code) { return have.some(function (m) { return m.level === code; }); };
  // completed и cancelled — прошлое: /me отдаёт заявку только тому, у кого членства нет,
  // значит прежнее закончилось, и подать можно заново
  var rq = DATA.request && (DATA.request.status === 'pending' || DATA.request.status === 'approved' ||
                            DATA.request.status === 'rejected') ? DATA.request : null;
  var member = isMember();
  var tierName = function (r) { return esc(r.tier || 'Членство'); };
  var top = member
    ? have.map(function (m) {
        return '<div class="card strong"><div class="row top"><div class="col"><h2>' + esc(LEVEL[m.level]) + '</h2>' +
          '<span class="small">' + esc(untilText(m)) + '</span></div><span class="pill on">АКТИВНО</span></div></div>';
      }).join('')
    : !rq ? '<div class="card quiet"><div class="col"><b>Членства нет</b>' +
        '<span class="small">Услугами острова можно пользоваться и так; пропуск в клуб выдаётся по членству.</span></div></div>'
    : rq.status === 'pending'
      ? stateCard('Заявка отправлена', tierName(rq) + (rq.at ? ' · отправлена ' + esc(rq.at) : '') + '. Глава клуба ответит в приложении.', 'ЖДЁТ ОТВЕТА')
    : rq.status === 'approved'
      // ⚠ согласие — не членство: его создаёт касса, приняв деньги
      ? stateCard('Глава клуба согласен', tierName(rq) + (tierOf(rq.code) ? ' · ' + esc(tierPrice(tierOf(rq.code))) : '') +
          '. Членство создаст касса, когда примет деньги: наличными или картой.', 'СОГЛАСОВАНО')
      : stateCard('Заявка отклонена', tierName(rq) + (rq.decided ? ' · решение от ' + esc(rq.decided) : ''), 'ОТКАЗАНО', true) +
        (rq.said ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>«' + esc(rq.said) + '»</span></div>' : '');
  var list = TIERS.list;
  var rows = list ? (list.length
      ? '<div class="group"><span class="label">Виды членства</span><div class="rows">' + list.map(function (t) {
          return '<div><div class="col"><b>' + esc(t.name) + '</b>' +
            (t.about ? '<span class="small">' + esc(t.about) + '</span>' : '') + '</div>' +
            '<div class="col" style="align-items:flex-end;gap:2px;flex:0 0 auto">' +
              (mine(t.code) ? '<span class="pill on">У ВАС ЕСТЬ</span>' : '') +
              '<b class="num" style="white-space:nowrap">' + esc(tierSum(t)) + '</b>' +
              '<span class="small" style="white-space:nowrap">' + esc(tierPeriod(t)) + '</span></div></div>';
        }).join('') + '</div></div>'
      : '<div class="card quiet"><span class="small">Видов членства сервер не назвал.</span></div>')
    : TIERS.fail ? '<div class="card quiet"><div class="col"><span class="small">' + esc(TIERS.fail) + '</span>' +
        '<button type="button" class="btn ghost" data-action="mr-retry">Попробовать снова</button></div></div>'
    : '<div class="card quiet"><span class="small">Загружаем виды членства…</span></div>';
  var lock = MREQ.busy ? ' disabled' : '';
  var pick = list && list.length ? (tierOf(MREQ.pick) ? MREQ.pick : list[0].code) : '';
  var tail = member
    ? noteBox('Продление считается от конца действующего, а не со дня оплаты. Каждый вид продлевается отдельно; деньги принимает касса.') +
      '<div style="display:flex;flex-direction:column;gap:9px"><button type="button" class="btn" data-go="pass">Показать пропуск</button>' +
      '<span class="small" style="text-align:center">Код пропуска спросят в кассе: по нему вас и находят.</span></div>'
    : rq && rq.status === 'pending'
      ? noteBox(PRICE_NOTE) +
        noteBox('Пока заявка ждёт ответа, второй раз её не подать: сервер отвечает «ваша заявка уже отправлена и ждёт ответа». Отозвать её из приложения нельзя — скажите главе клуба.')
    : rq && rq.status === 'approved'
      ? noteBox('Пропуска пока нет: он выдаётся по живому членству, а членство создаёт касса. Как только деньги приняты, этот экран покажет членство сам.') +
        '<div class="card quiet"><div class="col"><b style="font-size:13px">Что дальше</b>' +
        '<span class="small">Подойдите в кассу клуба и скажите, что заявка согласована. Срок членства считается от дня оплаты; какой он у вашего вида — скажет касса.</span></div></div>'
    : rq && rq.status === 'rejected'
      ? noteBox(PRICE_NOTE) + (tierOf(rq.code)
        ? '<div style="display:flex;flex-direction:column;gap:9px"><button type="button" class="btn" data-action="mr-send:' + esc(rq.code) + '"' + lock + '>Подать снова</button>' +
          '<span class="small" style="text-align:center">Отклонённая заявка закрыта: новую подать можно.</span></div>' : '')
    : noteBox(PRICE_NOTE) + (pick
        ? '<div class="group"><span class="label">На какой вид</span><div class="seg wrap">' + list.map(function (t) {
            return '<button type="button" data-action="mr-pick:' + esc(t.code) + '" aria-pressed="' + (t.code === pick) + '">' + esc(t.name) + '</button>';
          }).join('') + '</div></div>' +
          '<div style="display:flex;flex-direction:column;gap:9px"><button type="button" class="btn" data-action="mr-send:' + esc(pick) + '"' + lock + '>Подать заявку</button>' +
          '<span class="small" style="text-align:center">Глава клуба ответит в приложении. Деньги примет касса — после согласия.</span></div>' : '');
  return (FLASH ? flash() : '') + top +
    (MREQ.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MREQ.err) + '</span></div>' : '') +
    rows + tail;
}

/* Заявки главы клуба — кадры E42* (Cafe13KPG#428). */
var REQ_PILL = { pending: 'ЖДЁТ', approved: 'СОГЛАСОВАНА', rejected: 'ОТКАЗАНО', cancelled: 'ОТМЕНЕНА', completed: 'ОФОРМЛЕНА' };
// «сегодня, 14:20» / «вчера, 19:05» / «26 октября» — по часам клуба
function askedWhen(iso, withTime) {
  var d = new Date(iso); if (!iso || isNaN(d.getTime())) return '';
  var p = bkk(d), now = new Date();
  if (p.ymd === bkk(now).ymd) return withTime ? 'сегодня, ' + p.hm : 'сегодня';
  if (p.ymd === bkk(new Date(now.getTime() - 86400000)).ymd) return withTime ? 'вчера, ' + p.hm : 'вчера';
  var x = p.ymd.split('-');
  return Number(x[2]) + ' ' + (MONTHS[Number(x[1]) - 1] || '');
}
function requestCard(q) {
  var busy = MREQS.busy ? ' disabled' : '', t = tierOf(q.code), asking = MREQS.ask === q.id;
  return '<div class="card"><div class="row top"><div class="col"><b>' + esc(q.name) + '</b>' +
      '<span class="small">' + esc([q.tier, t ? tierSum(t) : '', askedWhen(q.iso, true), q.pass ? '' : 'пропуска нет'].filter(Boolean).join(' · ')) + '</span></div>' +
      '<span class="pill">' + REQ_PILL.pending + '</span></div>' +
    (q.note ? '<span class="small">«' + esc(q.note) + '»</span>' : '') +
    (asking
      ? '<div class="field"><label for="d-note">Слово отказа — его увидит человек</label>' +
          '<textarea id="d-note" rows="3" maxlength="500">' + esc(MREQS.note) + '</textarea></div>' +
        '<div class="row" style="justify-content:flex-start;gap:8px">' +
          '<button type="button" class="btn quiet" data-action="mq-keep"' + busy + '>Не отказывать</button>' +
          '<button type="button" class="btn quiet" data-action="mq-no:' + q.id + '"' + busy + '>Точно отказать</button></div>'
      : '<div class="row" style="justify-content:flex-start;gap:8px">' +
          '<button type="button" class="btn quiet" data-action="mq-ok:' + q.id + '"' + busy + '>Согласиться</button>' +
          '<button type="button" class="btn quiet" data-action="mq-ask:' + q.id + '"' + busy + '>Отказать</button></div>') +
  '</div>';
}
function requestRow(q) {
  return '<div class="card quiet"><div class="row top"><div class="col"><b>' + esc(q.name) + '</b>' +
      '<span class="small">' + esc([q.tier, askedWhen(q.done || q.iso, false)].filter(Boolean).join(' · ')) + '</span></div>' +
      '<span class="pill' + (q.status === 'rejected' ? ' warm' : '') + '">' + REQ_PILL[q.status] + '</span></div>' +
    (q.said ? '<span class="small">«' + esc(q.said) + '»</span>' : '') + '</div>';
}
function byId(id) { return DATA.events.filter(function (e) { return e.id === id; })[0]; }
function isMember() { return ['member', 'organizer', 'partner'].indexOf(DATA.role) !== -1; }

var ICON = {
  home: '<path d="M4 10l8-6 8 6v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z"/>',
  plus: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  cal:  '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>',
  till: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M3 12h18"/>',
  cam:  '<path d="M3 7h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  star: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18"/>',
  cup:  '<path d="M5 8h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5z"/><path d="M16 9h2.4a2.4 2.4 0 010 4.8H16"/><path d="M4 21h13"/>',
  bell: '<path d="M18.5 16.5h-13L7 14.1V10a5 5 0 0110 0v4.1z"/><path d="M10 19.5a2 2 0 004 0"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  // кошелёк с плюсом — вход в пополнение из шапки (Cafe13KPG#500); облик временный до кадра
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path d="M4 7l11-3v3"/><path d="M14 13.5h6"/><path d="M17 10.5v6"/>',
  coin: '<ellipse cx="12" cy="7" rx="8" ry="3.2"/><path d="M4 7v10c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V7"/><path d="M4 12.2c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  // Та же стрелка, что у кнопки «Назад» в шапке (`index.html`): у подписи
  // «Назад» стрелка вперёд читается как «дальше», и увидеть это можно только
  // ОТРИСОВАННЫМ — в исходнике `ICON.chev` ничем себя не выдаёт.
  chevBack: '<path d="M15 6l-6 6 6 6"/>',
  // вкладка «Управление» (кадр E46): две фигуры — не портфель «Моего дела», разделы разные
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><path d="M16 6.3a3 3 0 010 5.4M17.5 14.2A5.5 5.5 0 0120.5 19"/>'
};
function svg(paths, cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>'; }

/* Демонстрационный узор вместо кода. Настоящий код выдаёт сервер — здесь
   его взять неоткуда, и рисовать правдоподобную подделку было бы хуже. */
function pattern(seed) {
  var s = 0, i;
  for (i = 0; i < seed.length; i++) { s = (s * 31 + seed.charCodeAt(i)) % 100000; }
  var out = '<svg viewBox="0 0 25 25" role="img" aria-label="Демонстрационный узор вместо кода"><rect width="25" height="25" fill="#fff"/><g fill="#15171A">';
  [[1, 1], [18, 1], [1, 18]].forEach(function (p) {
    out += '<path d="M' + p[0] + ' ' + p[1] + 'h6v6h-6z M' + (p[0] + 1) + ' ' + (p[1] + 1) + 'v4h4v-4z M' + (p[0] + 2) + ' ' + (p[1] + 2) + 'h2v2h-2z"/>';
  });
  for (var y = 0; y < 25; y++) {
    for (var x = 0; x < 25; x++) {
      if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue;
      s = (s * 1103515245 + 12345) % 2147483648;
      if ((s >> 16) % 100 < 42) out += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
  }
  return out + '</g></svg>';
}

/* ── экраны ──────────────────────────────────────────── */

/* Кабинет мастера в ЖИВОМ режиме (Cafe13KPG#98). Кормится из той же
   афиши, что и обзор: отбора «только мои» на сервере нет, и «своё» считается
   по `organizer_id` против своего tg id (`isMyEvent`). Второго запроса нет
   нарочно: два источника одного списка расходятся молча.

   Что здесь ЕСТЬ и чего НЕТ — сказано строками на экране, а не умолчанием:
   - правки мероприятия на сервере НЕТ вовсе (замер: `^@router\.(patch|put)`
     в `app/routers/events.py` на блобе боевого `fa2cebc` → 0 при контроле
     `^@router\.post` → 4), поэтому кнопки «править» нет и не будет, пока нет ручки;
   - прошедшие свои сюда НЕ идут: это архив, карточка #265, и владелец её
     не открывал. Афиша прошедшего не отдаёт ни при каких параметрах;
   - управление ОДНИМ мероприятием здесь НЕ дублируется: пункт ведёт на
     живую карточку, где `manageBlock` уже даёт список записавшихся и отмену
     со своим гардом. Демонстрационный `eventManage` в живой режим не
     подключается именно поэтому.

   ⚠ И про деньги: сумма по платным — СЧЁТ ПО ЗАПИСЯМ, а не собранное:
   оплата идёт через кассу, и признака оплаты в строке афиши нет вовсе.
   Подпись поэтому «Если все заплатят», а не «Соберёте»: второе читалось бы
   как факт о деньгах, которых ещё нет. Кто заплатил поимённо — на карточке. */
function organizerLive() {
  var list = eventList();
  if (!list) return eventsWait();
  var mine = list.filter(isMyEvent);
  // наполненность — только по ивентам С ограничением: у безлимитного доли от мест нет
  var signed = 0, seats = 0, signedLim = 0, dueIfPaid = 0, unl = false;
  mine.forEach(function (e) {
    var t = takenOf(e);
    signed += t;
    if (e.unl) unl = true; else { seats += e.of; signedLim += t; }
    if (e.kind === 'paid') dueIfPaid += t * e.price;
  });
  return (FLASH ? flash() : '') +
    '<div class="group"><span class="label">Ваши мероприятия впереди</span>' +
      '<div class="rows">' +
        '<div><span class="small">Событий</span><b class="num">' + mine.length + '</b></div>' +
        '<div><span class="small">Записалось</span><b class="num">' + signed + (unl ? '' : ' из ' + seats) + '</b></div>' +
        '<div><span class="small">Наполненность</span><b class="num">' +
          (seats ? Math.round(signedLim / seats * 100) + ' %' : unl ? '—' : '0 %') + '</b></div>' +
        '<div><span class="small">Если все заплатят</span><b class="num">' + money(dueIfPaid) + ' ฿</b></div>' +
      '</div>' +
    '</div>' +
    '<div class="group"><span class="label">Свои в афише</span>' +
      (mine.length ? mine.map(function (e) {
        return '<button type="button" class="listitem" data-event="' + esc(e.id) + '">' +
          '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.date) + '</span></span>' +
          '<span class="grow"><b>' + esc(e.title) + '</b>' +
          '<span class="small">записалось ' + takenOf(e) + (e.unl ? ' · мест ' + NO_LIMIT : ' из ' + e.of) +
            // Слово берётся из афиши (`eventRow`), а не сочиняется второй
            // раз: кончившееся попадает сюда в зазор между ответом сервера
            // и взглядом человека, и без пометки строка неотличима от
            // завтрашней (Cafe13KPG#361).
            (e.done ? ' · завершилось' : e.part === 'идёт' ? ' · идёт' : '') + '</span></span>' +
          svg(ICON.chev, 'chev') + '</button>';
      }).join('')
      : '<div class="card quiet"><span class="small">Своих мероприятий впереди нет.</span></div>') +
    '</div>' +
    (mayCreateEvent() ? '<button type="button" class="btn" data-go="eventNew">' +
      svg('<path d="M12 5v14M5 12h14"/>') + 'Создать мероприятие</button>' : '') +
    '<button type="button" class="btn ghost" data-go="events">' + svg(ICON.chevBack) + 'Назад к афише</button>' +
    '<div class="note">' + svg(ICON.info) +
      '<span>Список записавшихся, отмена и правка — внутри мероприятия. Править можно число мест и описание, по одной неделе.</span>' +
    '</div>';
}

