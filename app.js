'use strict';

/* Клиент мини-приложения Café XIII.
 *
 * Секретов здесь нет и быть не может: эту страницу скачивает браузер каждого
 * гостя. Токен бота живёт только на сервере, который проверяет подпись
 * initData. Пока сервера нет, DATA зашита — заменить на fetch, разметку не
 * трогая.
 *
 * ⚠ tg.initDataUnsafe НЕ проверен подписью. Имя отсюда годится, чтобы
 * поздороваться, и не годится, чтобы впустить в клуб: это решает сервер.
 */

var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

var DATA = {
  role: 'member',            // guest | member | organizer | staff — ставит сервер
  member: {
    name: 'Гость',
    level: 'Член клуба',
    until: '14 ноября',
    balance: 1250,
    number: 'XIII · 0042'
  },
  events: [
    { id: 'morning', title: 'Утренняя практика', day: 'Сегодня, четверг', time: '08:00',
      part: 'утро', until: '09:00', master: '[мастер]', seats: 6, of: 12, kind: 'donation',
      filmed: true, about: 'Час тишины и дыхания, пока остров ещё не проснулся. Коврики есть, приходите как есть.' },
    { id: 'sound', title: 'Звуковая практика', day: 'Сегодня, четверг', time: '19:00',
      part: 'вечер', until: '20:30', master: '[мастер]', seats: 4, of: 14, kind: 'paid', price: 400,
      filmed: true, about: 'Полтора часа со звуком: чаши, гонг, голос. Вход в пространство членам клуба бесплатный — оплачивается само мероприятие.' },
    { id: 'tea', title: 'Чайная церемония', day: 'Завтра, пятница', time: '17:00',
      part: 'вечер', until: '18:30', master: '[мастер]', seats: 8, of: 8, kind: 'free',
      filmed: false, about: 'Самообслуживание: иван-чай, пуэр, габа. Садитесь, когда удобно, уходите, когда нужно. Запись — чтобы хватило посуды и воды.' },
    { id: 'circle', title: 'Разговорный круг', day: 'Завтра, пятница', time: '20:00',
      part: 'вечер', until: '21:30', master: '[мастер]', seats: 9, of: 16, kind: 'paid', price: 300,
      filmed: false, about: 'Говорим по кругу, перебивать нельзя. Тема объявляется на месте.' }
  ],
  upcoming: [
    { title: 'Звуковая практика', when: 'Сегодня, 19:00 · ведёт [мастер]', state: 'Оплачено', tone: 'on' },
    { title: 'Чайная церемония', when: 'Завтра, 17:00 · 8 мест', state: 'Бесплатно', tone: '' }
  ],
  past: [
    { title: 'Утренняя практика', when: '9 октября · взнос 300 ฿' },
    { title: 'Разговорный круг', when: '2 октября · 300 ฿' }
  ],
  shift: [
    { what: 'На баланс · [имя члена]', when: '18:51 · наличные', sum: 1000, cancelled: false },
    { what: 'Членство · [имя члена]', when: '18:12 · карта', sum: 3300, cancelled: false },
    { what: 'Событие · [имя члена]', when: 'внесено 17:40, отменено 17:43', sum: 400, cancelled: true }
  ],
  services: [
    { title: 'Аренда байка', about: 'По дням, с залогом и доставкой' },
    { title: 'Доставка воды', about: 'Разово или по расписанию' },
    { title: 'Помощь на дороге', about: 'Сантехник, электрик, механик' }
  ]
};

var KIND = {
  paid:     { label: function (e) { return e.price + ' ฿'; }, pill: 'gold' },
  free:     { label: function () { return 'Бесплатно'; },     pill: '' },
  donation: { label: function () { return 'Донейшн'; },       pill: 'warm' }
};

/* ── утилиты ─────────────────────────────────────────── */

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function byId(id) { return DATA.events.filter(function (e) { return e.id === id; })[0]; }
function isMember() { return DATA.role === 'member' || DATA.role === 'organizer'; }

var ICON = {
  home: '<path d="M4 10l8-6 8 6v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z"/>',
  plus: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  cal:  '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>',
  till: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M3 12h18"/>',
  cam:  '<path d="M3 7h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chev: '<path d="M9 6l6 6-6 6"/>'
};
function svg(paths, cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>'; }

/* Демонстрационный узор вместо кода. Настоящий код выдаёт сервер — здесь
   его взять неоткуда, и рисовать правдоподобную подделку было бы хуже. */
function pattern(seed) {
  var s = 0, i;
  for (i = 0; i < seed.length; i++) { s = (s * 31 + seed.charCodeAt(i)) % 100000; }
  var out = '<svg viewBox="0 0 25 25" role="img" aria-label="Демонстрационный узор вместо кода"><rect width="25" height="25" fill="#fff"/><g fill="#190F26">';
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

var SCREENS = {

  home: function () {
    var m = DATA.member;
    var next = DATA.upcoming[0];
    return '' +
      '<div class="card strong">' +
        '<div class="row top">' +
          '<div class="col"><h2>' + esc(m.level) + '</h2><span class="small">Действует до ' + esc(m.until) + '</span></div>' +
          '<span class="pill on">Активно</span>' +
        '</div>' +
        '<button type="button" class="btn" data-go="pass">' + svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/>') + 'Показать пропуск</button>' +
      '</div>' +

      '<div class="card quiet"><div class="row">' +
        '<div class="col"><span class="label">Баланс</span><span class="big num">' + money(m.balance) + ' ฿</span></div>' +
        '<span class="small" style="text-align:right;max-width:130px">Пополняется в кассе — наличными или картой</span>' +
      '</div></div>' +

      (next ? '<div class="group"><span class="label">Вы записаны</span>' +
        '<button type="button" class="listitem accent card" data-go="bookings">' +
          '<span class="grow"><b>' + esc(next.title) + '</b><span class="small">' + esc(next.when) + '</span></span>' +
          svg(ICON.chev, 'chev') +
        '</button></div>' : '') +

      '<div class="group">' +
        '<div class="row"><span class="label">На этой неделе</span>' +
        '<button type="button" class="btn quiet" data-go="events">Вся афиша</button></div>' +
        DATA.events.slice(0, 2).map(eventRow).join('') +
      '</div>';
  },

  guest: function () {
    return '' +
      '<div class="group"><span class="label">Услуги острова</span>' +
        DATA.services.map(function (s) {
          return '<button type="button" class="listitem">' +
            '<span class="grow"><b>' + esc(s.title) + '</b><span class="small">' + esc(s.about) + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>';
        }).join('') +
      '</div>' +
      (isMember() ? '' :
      '<div class="card strong">' +
        '<h2>Клуб закрыт для гостей</h2>' +
        '<p>Афиша, пространство и мероприятия доступны членам клуба. Услуги выше — всем.</p>' +
        '<button type="button" class="btn" data-go="membership">Что даёт членство</button>' +
      '</div>' +
      '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Вы уже член клуба?</b>' +
        '<span class="small">Если членство оформлено в кассе, оно появится здесь само — приложение узнаёт вас по Telegram.</span>' +
      '</div></div>');
  },

  pass: function () {
    var m = DATA.member;
    return '' +
      '<div class="pass">' +
        '<div class="who">' +
          '<span class="avatar">' + esc((m.name || '?').slice(0, 1).toUpperCase()) + '</span>' +
          '<span class="col"><b style="font-size:19px;font-family:\'Zilla Slab\',Georgia,serif">' + esc(m.name) + '</b>' +
          '<span style="font-size:12px;color:#F0DFF2">' + esc(m.level) + ' · до ' + esc(m.until) + '</span></span>' +
        '</div>' +
        '<div class="code-box">' + pattern(m.number) + '</div>' +
        '<span class="num-big">' + esc(m.number) + '</span>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Код постоянный и <b>работает без интернета</b>. Сеть нужна тому, кто сканирует: у него на экране ваше фото и имя — переслать код другому бесполезно.</span>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Узор выше — демонстрационный. Настоящий код выдаёт сервер клуба, которого пока нет.</span>' +
      '</div>';
  },

  membership: function () {
    var tiers = [
      { name: 'Член клуба', price: '[100] $', about: 'Вход в пространство без оплаты. Афиша, записи, жизнь клуба.', mine: DATA.role === 'member' },
      { name: 'Организатор', price: '[200] $', about: 'Всё, что у члена клуба, плюс право проводить свои мероприятия и назначать их цену.', mine: DATA.role === 'organizer' },
      { name: 'Бизнес-партнёр', price: '[300] $', about: 'Всё, что у члена клуба, плюс своё направление внутри клуба и его отчётность.', mine: false, split: true }
    ];
    return tiers.map(function (t) {
      return '<div class="card' + (t.mine ? ' strong' : '') + '">' +
        '<div class="row"><h2>' + esc(t.name) + '</h2><b class="num" style="font-size:18px">' + esc(t.price) + '</b></div>' +
        '<p style="font-size:13px">' + esc(t.about) + '</p>' +
        (t.split ? '<div class="card quiet" style="padding:11px 13px"><div class="row">' +
          '<span class="small">Прибыль направления</span><b class="num" style="font-size:13px">[70] % вам · [30] % клубу</b>' +
        '</div></div>' : '') +
        (t.mine ? '<span class="pill on" style="align-self:flex-start">Ваш уровень</span>'
                : '<button type="button" class="btn ghost">' + (t.split ? 'Обсудить с директором' : 'Перейти на уровень') + '</button>') +
      '</div>';
    }).join('') +
    '<div class="note">' + svg(ICON.info) +
      '<span>Оплата — в кассе клуба, наличными или картой. Работник отметит её, и уровень обновится здесь.</span>' +
    '</div>';
  },

  events: function () {
    var parts = ['Все', 'Утро', 'День', 'Вечер'];
    var days = [];
    DATA.events.forEach(function (e) {
      if (days.indexOf(e.day) === -1) days.push(e.day);
    });
    return '<div class="seg">' + parts.map(function (p, i) {
        return '<button type="button" aria-pressed="' + (i === 0) + '">' + p + '</button>';
      }).join('') + '</div>' +
      days.map(function (d) {
        return '<div class="group"><span class="label">' + esc(d) + '</span>' +
          DATA.events.filter(function (e) { return e.day === d; }).map(eventRow).join('') +
        '</div>';
      }).join('');
  },

  event: function (id) {
    var e = byId(id) || DATA.events[0];
    var k = KIND[e.kind];
    var foot;
    if (e.kind === 'paid') {
      foot = '<button type="button" class="btn">Оплатить ' + e.price + ' ฿ и записаться</button>' +
             '<span class="small" style="text-align:center">Место держится 15 минут, пока идёт оплата. Не оплачено — место возвращается в афишу.</span>';
    } else if (e.kind === 'free') {
      foot = '<button type="button" class="btn">Записаться</button>' +
             '<span class="small" style="text-align:center">Если передумали — отмените запись, чтобы место досталось другому.</span>';
    } else {
      foot = '<div class="card" style="border-color:var(--clay)">' +
          '<div class="col"><b>Взнос — по желанию</b><span class="small">Сколько считаете нужным, и можно нисколько. На запись это не влияет.</span></div>' +
          '<div class="seg">' + [200, 400, 600].map(function (s) {
            return '<button type="button" aria-pressed="false" class="num">' + s + ' ฿</button>';
          }).join('') + '</div>' +
          '<div class="field"><label for="own">Своя сумма, можно оставить пустым</label>' +
          '<input id="own" type="text" inputmode="numeric" placeholder="— ฿"></div>' +
        '</div>' +
        '<button type="button" class="btn">Записаться</button>' +
        '<span class="small" style="text-align:center">Взнос можно передать мастеру на месте или оставить в кассе после практики.</span>';
    }
    return '<div class="col"><h1>' + esc(e.title) + '</h1>' +
      '<span class="small">' + esc(e.day) + ' · ' + esc(e.time) + '–' + esc(e.until) + '</span></div>' +
      '<div class="rows">' +
        '<div><span class="small">Ведёт</span><b>' + esc(e.master) + '</b></div>' +
        '<div><span class="small">Мест осталось</span><b class="num">' + e.seats + ' из ' + e.of + '</b></div>' +
        '<div><span class="small">Участие</span><b class="num">' + k.label(e) + '</b></div>' +
      '</div>' +
      '<p style="font-size:14px">' + esc(e.about) + '</p>' +
      '<div class="note">' + svg(ICON.cam) + '<span>' + (e.filmed
        ? 'На этом событии ведётся съёмка. Согласие даётся отдельно и его можно не давать — запись останется в силе.'
        : 'Съёмки на этом событии нет.') + '</span></div>' +
      '<div class="group" style="margin-top:4px">' + foot + '</div>';
  },

  bookings: function () {
    return '<div class="group"><span class="label">Предстоящие</span>' +
      DATA.upcoming.map(function (b) {
        return '<div class="card' + (b.tone === 'on' ? ' accent' : '') + '">' +
          '<div class="row top"><div class="col"><h2>' + esc(b.title) + '</h2>' +
          '<span class="small">' + esc(b.when) + '</span></div>' +
          '<span class="pill' + (b.tone === 'on' ? ' on' : '') + '">' + esc(b.state) + '</span></div>' +
          '<button type="button" class="btn quiet">Отменить запись</button>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="group"><span class="label">Прошедшие</span>' +
      DATA.past.map(function (b) {
        return '<div class="card"><div class="row"><div class="col">' +
          '<b>' + esc(b.title) + '</b><span class="small">' + esc(b.when) + '</span>' +
          '</div>' + svg('<path d="M5 12l5 5 9-10"/>', 'chev') + '</div></div>';
      }).join('') + '</div>';
  },

  staff: function () {
    var total = DATA.shift.reduce(function (a, r) { return r.cancelled ? a : a + r.sum; }, 0);
    return '<button type="button" class="btn">' + svg(ICON.till) + 'Сканировать пропуск</button>' +
      '<div class="group"><span class="label">Принять деньги</span>' +
        '<div class="seg">' +
          '<button type="button">Членство</button><button type="button">На баланс</button><button type="button">Событие</button>' +
        '</div>' +
      '</div>' +
      '<div class="group">' +
        '<div class="row"><span class="label">Внесено за смену</span><b class="num">' + money(total) + ' ฿</b></div>' +
        DATA.shift.map(function (r) {
          if (r.cancelled) {
            return '<div class="card cancelled">' +
              '<div class="row"><b class="strike">' + esc(r.what) + ' · ' + r.sum + ' ฿</b>' +
              '<span class="pill gold">Отменено</span></div>' +
              '<span class="small">' + esc(r.when) + '. Запись остаётся видимой: исправить внесённое нельзя, только отменить и внести заново.</span>' +
            '</div>';
          }
          return '<div class="card"><div class="row">' +
            '<div class="col"><b>' + esc(r.what) + '</b><span class="small num">' + esc(r.when) + '</span></div>' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<b class="num">' + money(r.sum) + ' ฿</b>' +
              '<button type="button" class="btn quiet">Отменить</button>' +
            '</div></div></div>';
        }).join('') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Каждая строка попадает в книгу событий клуба. По ней считается прибыль направления — поэтому задним числом её не меняют.</span>' +
      '</div>';
  },

  demo: function () {
    var roles = [
      ['guest', 'Гость', 'без членства: только услуги'],
      ['member', 'Член клуба', 'пропуск, афиша, записи'],
      ['organizer', 'Организатор', 'то же плюс свои мероприятия'],
      ['staff', 'Работник', 'касса: внести и отменить']
    ];
    return '<div class="card quiet"><div class="col">' +
        '<b>Это демонстрация без сервера</b>' +
        '<span class="small">Членство, события и баланс зашиты в страницу. Сервер, который проверяет подпись Telegram и хранит данные, ещё не поднят — поэтому роль здесь переключается вручную.</span>' +
      '</div></div>' +
      '<div class="group"><span class="label">Смотреть как</span>' +
        roles.map(function (r) {
          return '<button type="button" class="listitem" data-role="' + r[0] + '"' +
            (DATA.role === r[0] ? ' style="border-color:var(--ink);border-width:2px"' : '') + '>' +
            '<span class="grow"><b>' + r[1] + '</b><span class="small">' + r[2] + '</span></span>' +
            (DATA.role === r[0] ? '<span class="pill on">сейчас</span>' : svg(ICON.chev, 'chev')) +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>В рабочем приложении роль придёт с сервера: он проверит подпись Telegram и ответит, кто вы. Подменить её из браузера будет нельзя.</span>' +
      '</div>';
  }
};

function eventRow(e) {
  var k = KIND[e.kind];
  return '<button type="button" class="listitem' + (e.kind === 'paid' ? ' accent card' : '') + '" data-event="' + e.id + '">' +
    '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.part) + '</span></span>' +
    '<span class="grow"><b>' + esc(e.title) + '</b>' +
    '<span class="small">ведёт ' + esc(e.master) + ' · ' + (e.seats === e.of ? e.of + ' мест' : 'осталось ' + e.seats) + '</span></span>' +
    '<span class="pill ' + k.pill + '">' + k.label(e) + '</span>' +
  '</button>';
}

/* ── навигация ───────────────────────────────────────── */

var TABS = {
  guest:     [['guest', 'Услуги', ICON.plus], ['bookings', 'Записи', ICON.cal]],
  member:    [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus], ['bookings', 'Записи', ICON.cal]],
  organizer: [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus], ['bookings', 'Записи', ICON.cal]],
  staff:     [['staff', 'Касса', ICON.till], ['home', 'Клуб', ICON.home]]
};
var TITLES = {
  pass: 'Пропуск', membership: 'Членство', events: 'Афиша',
  event: 'Мероприятие', bookings: 'Мои записи', staff: 'Касса', demo: 'Демо-режим'
};

var current = 'home';
var param = null;

function render() {
  var view = document.getElementById('view');
  view.innerHTML = SCREENS[current](param);

  var root = (TABS[DATA.role] || []).some(function (t) { return t[0] === current; });
  document.getElementById('back').hidden = root;

  var title = document.getElementById('title');
  if (current === 'home' || current === 'guest') {
    title.textContent = 'Café XIII';
    title.className = 'wordmark';
  } else {
    title.textContent = TITLES[current] || 'Café XIII';
    title.className = 'wordmark plain';
  }

  var tabs = document.getElementById('tabs');
  var list = TABS[DATA.role] || [];
  tabs.hidden = !list.length;
  document.body.classList.toggle('no-tabs', !list.length);
  tabs.innerHTML = list.map(function (t) {
    var on = t[0] === current;
    return '<button type="button" data-go="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');

  window.scrollTo(0, 0);
}

function go(screen, p) {
  if (!SCREENS[screen]) return;
  current = screen;
  param = p || null;
  render();
}

document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-go],[data-event],[data-role]');
  if (!el) return;
  if (el.hasAttribute('data-role')) {
    DATA.role = el.getAttribute('data-role');
    go(DATA.role === 'staff' ? 'staff' : DATA.role === 'guest' ? 'guest' : 'home');
    return;
  }
  if (el.hasAttribute('data-event')) { go('event', el.getAttribute('data-event')); return; }
  go(el.getAttribute('data-go'));
});

document.getElementById('back').addEventListener('click', function () {
  go(current === 'event' ? 'events' : (TABS[DATA.role] || [['home']])[0][0]);
});
document.getElementById('demo-btn').addEventListener('click', function () { go('demo'); });

/* ── запуск ──────────────────────────────────────────── */

function applyTheme() {
  var dark = tg && tg.colorScheme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

if (tg) {
  tg.ready();
  tg.expand();
  applyTheme();
  tg.onEvent('themeChanged', applyTheme);
  var u = tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (u && u.first_name) {
    // Только для приветствия: подпись здесь не проверена, доверять нельзя.
    DATA.member.name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  }
} else {
  applyTheme();
}

go(DATA.role === 'guest' ? 'guest' : 'home');
