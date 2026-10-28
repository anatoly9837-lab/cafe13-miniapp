'use strict';

/* Клиент мини-приложения Café XIII.
 *
 * Секретов здесь нет и быть не может: эту страницу скачивает браузер каждого
 * гостя. Токен бота живёт только на сервере, который проверяет подпись
 * initData. Вне Telegram — демонстрация на DATA; в Telegram DATA заполняет сервер, разметку не
 * трогая.
 *
 * ⚠ tg.initDataUnsafe НЕ проверен подписью. Имя отсюда годится, чтобы
 * поздороваться, и не годится, чтобы впустить в клуб: это решает сервер.
 */

/* Видимая версия. Telegram держит мини-приложения в своём кэше, и «у меня
   не изменилось» без неё не отличить от «не выложено».

   Поднимается при каждой заметной правке КЛИЕНТА, в ПЯТИ местах (четыре файла, в `index.html` две строки — счёт вхождениями, как в самом правиле) и все
   они в репозитории (правило команды — Cafe13KPG#308, ссылаться на номер,
   а не на пересказ): здесь, две строки в `index.html` и `tools/catalog.py` — из его
   константы собирается `screens.html`, руками опись не правится. Проверка
   одной строкой, N — новый номер:

     N=<номер>; grep -cE "(\?v=|['>]v)$N([^0-9]|$)" app.js index.html tools/catalog.py screens.html

   Ожидается 1/2/1/1, на прежнем номере — 0/0/0/0 (без второго счёта ноль
   нечитаем). Признак привязан к ВИДУ записи: сменится вид — даст ноль
   на здоровом файле, и читать это надо как сломанный признак, а не как
   неподнятый номер. Тесты без правки клиента номера НЕ поднимают.

   ⚠ Кнопка меню бота в этот счёт НЕ входит и решается не здесь: она вне
   репозитория, зона бота и devops5. Измерено про неё одно: Pages строку
   запроса не читает вовсе (контроль — заведомо невозможное значение
   отдаёт ту же версию). Этого НЕ довольно, чтобы сказать «кнопку не
   правят»: держит ли Telegram СВОЙ кэш по неизменному адресу — вопрос к
   устройству, а не к серверу, и он НЕ ИЗМЕРЕН (возврат архитектора на #63,
   принят: мой вывод был шире замера). Замер — выложить номер, не меняя
   кнопки, и посмотреть номер в Telegram без перезапуска; до него кнопку
   трогают по слову devops5, а не по этой строке. */
var VERSION = 'v85 · 29.10.2026';

var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

var DATA = {
  role: 'member',            // guest | member | organizer | staff — ставит сервер
  member: {
    name: '[ваше имя]',   // вне Telegram; внутри — имя из initDataUnsafe, только для приветствия
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
  // Выдуманные услуги не показываем и в демо — решение владельца,
  // anatoly9837-lab/Cafe13KPG#102 (со слов координатора, 21.10.2026).
  services: [],
  // что ведёт организатор
  myEvents: [
    { id: 'sound', title: 'Звуковая практика', day: 'Сегодня, четверг', time: '19:00',
      signed: 10, of: 14, kind: 'paid', price: 400, state: 'опубликовано' }
  ],
  signed: [
    { name: '[имя члена]', when: 'записался 14:02', paid: true },
    { name: '[имя члена]', when: 'записался 13:40', paid: true },
    { name: '[имя члена]', when: 'записался 11:15', paid: false }
  ],
  // что ведёт бизнес-партнёр
  myServices: []
};

/* ── бар: первый бизнес-юнит клуба ─────────────────────
   Решение владельца 16.10.2026: первое направление — бар. У него куратор
   (отвечает за направление и его отчётность) и исполнитель на баре
   (принимает заказы, снимает напитки, вносит затраты). Состав меню и цены
   ниже — черновик: их ведёт куратор, а не код. */
DATA.bar = {
  open: true,
  curator: '[куратор бара]',
  staff: '[исполнитель на баре]',
  menu: [
    { group: 'Кофе', items: [
      { id: 'espresso', title: 'Эспрессо', price: 70, mins: '2', tone: 'dark', shot: 'ready',
        about: 'Двойной, местная обжарка',
        full: 'Двойной эспрессо из зерна тайской обжарки. Берут, когда нужно коротко и сразу.' },
      { id: 'flat', title: 'Флэт-уайт', price: 110, mins: '3–4', tone: 'milk', shot: 'ready',
        about: 'Молоко обычное или кокосовое',
        full: 'Двойная база и молоко без пены. Кокосовое — без доплаты, спросите на баре.' },
      { id: 'cold', title: 'Колд-брю', price: 120, mins: '1', tone: 'coffee', shot: 'ai',
        about: '16 часов на холодной воде',
        full: 'Настаивается сутки без нагрева, поэтому мягче горячего. Готов заранее — наливается сразу.' }
    ] },
    { group: 'Чай', items: [
      { id: 'puer', title: 'Пуэр', price: 150, mins: '5', tone: 'tea', shot: 'ready',
        about: 'Проливами, хватает на двоих',
        full: 'Подаётся проливами в гайвани. Один заказ спокойно делится на двоих — скажите, и дадут вторую пиалу.' },
      { id: 'gaba', title: 'Габа', price: 140, mins: '5', tone: 'green', shot: 'none',
        about: 'Тайваньская, мягкая',
        full: 'Мягкий чай без горечи, хорошо идёт вечером.' }
    ] },
    { group: 'Авторские', items: [
      { id: 'coco', title: 'Кокос-лайм', price: 175, mins: '4', tone: 'citrus', shot: 'shot',
        about: 'Кокос, лайм, лёд, щепотка соли',
        full: 'Кокосовая вода с лаймом и солью — то, что на острове пьют после жары.' },
      { id: 'chia', title: 'Чиа-ягода', price: 165, mins: '4', tone: 'berry', shot: 'none',
        about: 'Чиа, ягоды, вода',
        full: 'Семена чиа, замоченные с утра, и ягодное пюре. Сытно — заменяет перекус.' }
    ] }
  ],
  orders: [
    { id: 'A-16', who: '[имя члена]', at: '19:51', where: 'к столу 3', pay: 'со счёта',
      items: [['Флэт-уайт', 2], ['Эспрессо', 1]], sum: 290, state: 'new' },
    { id: 'A-15', who: '[имя члена]', at: '19:44', where: 'за стойку', pay: 'со счёта',
      items: [['Колд-брю', 1]], sum: 120, state: 'making' },
    { id: 'A-14', who: '[имя члена]', at: '19:38', where: 'с собой', pay: 'со счёта',
      items: [['Пуэр', 1], ['Кокос-лайм', 1]], sum: 325, state: 'ready' },
    { id: 'A-13', who: '[имя члена]', at: '19:20', where: 'за стойку', pay: 'со счёта',
      items: [['Эспрессо', 2]], sum: 140, state: 'served' }
  ],
  mine: null,
  /* День сходится по числам: 640 + 1200 = 1840; позиции ниже дают ту же
     сумму и те же 16 позиций. Если правите одно — пересчитайте всё. */
  day: {
    date: 'Четверг, 16 октября', revenue: 1840, cash: 640, account: 1200,
    checks: 14, items: 16, avg: 131, cashOut: 80, cashBox: 560,
    top: [
      ['Флэт-уайт', 5, 550], ['Колд-брю', 3, 360], ['Эспрессо', 4, 280],
      ['Пуэр', 2, 300], ['Кокос-лайм', 2, 350]
    ],
    spend: [['Молоко и кокосовое', 'касса клуба', 240], ['Лёд', 'наличные бара', 80],
            ['Салфетки, трубочки', 'касса клуба', 100]],
    spendSum: 420,
    loss: 'Один стакан — бой, записан списанием'
  },
  /* 12 480 − 5 310 = 7 170; 30 % от чистой = 2 151, направлению 5 019.
     13 % с вала дали бы 1 622 — второй способ владельца. */
  month: {
    name: 'Октябрь', shifts: 11, revenue: 12480, spend: 5310, net: 7170,
    club: 2151, own: 5019, perShift: 1135, gross13: 1622, mode: 'net',
    days: [['16.10', 1840], ['15.10', 1220], ['14.10', 980], ['13.10', 1560], ['12.10', 2040]]
  },
  expenses: [
    { what: 'Молоко и кокосовое', cat: 'закуп', pay: 'касса клуба', sum: 240, when: '16.10 · [кто внёс]' },
    { what: 'Лёд', cat: 'закуп', pay: 'наличные бара', sum: 80, when: '16.10 · [кто внёс]' },
    { what: 'Салфетки, трубочки', cat: 'расходники', pay: 'касса клуба', sum: 100, when: '16.10 · [кто внёс]' },
    { what: 'Кофе, 1 кг', cat: 'закуп', pay: 'касса клуба', sum: 950, when: '14.10 · [кто внёс]' },
    { what: 'Ремонт кофемолки', cat: 'ремонт', pay: 'наличные бара', sum: 600, when: '11.10 · [кто внёс]' }
  ]
};

/* Цвет плитки напитка — пока вместо фотографии. Фотография появляется,
   когда снимок прошёл путь из экрана «Съёмка»: снято → ИИ-команда →
   куратор утвердил. Рисовать правдоподобную картинку из каталога нельзя:
   гость закажет не то, что увидит. */
var TONE = {
  dark:   'linear-gradient(145deg,#4A332A,#171009)',
  coffee: 'linear-gradient(145deg,#7A5334,#33200F)',
  milk:   'linear-gradient(145deg,#D2B38A,#8E6B45)',
  tea:    'linear-gradient(145deg,#A07A33,#4C3812)',
  green:  'linear-gradient(145deg,#8FAE98,#3F5A49)',
  citrus: 'linear-gradient(145deg,#E0AC42,#A3661B)',
  berry:  'linear-gradient(145deg,#A9506E,#5A2037)'
};
var SHOT = {
  ready: { label: 'в меню',               pill: ' on' },
  ai:    { label: 'у ИИ-команды',          pill: ' gold' },
  shot:  { label: 'снято, не отправлено',  pill: ' warm' },
  none:  { label: 'нужна съёмка',          pill: '' }
};
var OSTATE = {
  new:    { label: 'новый',     pill: ' gold', next: 'make',  action: 'Принять' },
  making: { label: 'готовится', pill: ' warm', next: 'ready', action: 'Готово' },
  ready:  { label: 'готов',     pill: ' on',   next: 'serve', action: 'Выдан' },
  served: { label: 'выдан',     pill: '',      next: null,    action: '' },
  cancelled: { label: 'отменён', pill: '',      next: null,    action: '' }
};

/* Корзина и выбор в формах бара — на телефоне, до перезагрузки вкладки:
   на сервер уходит только отправленный заказ. */
var CART = {};
var ORDER = { where: 'за стойку', pay: 'со счёта' };
var EXP = { cat: 'закуп', pay: 'касса клуба' };
var EXP_FIELDS = ['e-what', 'e-sum'];
var ORDERSEQ = 0;

/* ── сервер клуба ──────────────────────────────────────
   Адрес зашит, а не берётся из ссылки: подпись Telegram — пропуск человека,
   и страница, которая шлёт её туда, куда скажет параметр в адресе, отдала бы
   его кому угодно.

   API_ON — выключатель. Включён с v8, когда на сервере встал список
   допущенных и CORS приехал той же выкладкой: CORS — дверь, список — замок.
   Выключить = вернуть демонстрацию без единого запроса. Вне Telegram
   (initData пуста) запросов нет и с включённым: гостевой вход отложен
   (Cafe13KPG#52). */
var API = 'https://api.cafe13.club';
var API_ON = true;
var LIVE = false;          // true — данные на экране пришли с сервера, а не из DATA
var FAIL = '';             // чем кончилась неудачная попытка, для экрана apiDown
var FAIL_NET = false;      // сервер не ответил вовсе — тогда можно показать сохранённый пропуск

function api(method, path, body) {
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
  var opt = { method: method, headers: { 'X-Telegram-Init-Data': tg.initData } };
  // Тестовый режим — на КАЖДОМ запросе, иначе часть экрана придёт из боевой базы.
  if (TEST.on) opt.headers['X-Test-Mode'] = '1';
  if (TEST.on && TEST.as) opt.headers['X-Act-As'] = String(TEST.as.id);
  if (ctl) opt.signal = ctl.signal;
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  // Сеть упала, CORS не пустил, вышел срок — всё это status 0, а не «пусто».
  // Неразобранное тело — data undefined: 200 с HTML вместо JSON не данные.
  return fetch(API + path, opt).then(function (r) {
    return r.text().then(function (t) {
      var data;
      try { data = JSON.parse(t); } catch (e) { data = undefined; }
      return { status: r.status, data: data };
    });
  }, function () {
    return { status: 0, data: undefined };
  }).then(function (res) {
    if (timer) clearTimeout(timer);
    return res;
  });
}

// «Мастер» с большой — ВИД членства; «мастер» с маленькой — тот, кто ВЕДЁТ
// вечер; «организатор» — кто вечер завёл. Регистр несёт смысл, это не
// опечатка. Определение одно и живёт в Cafe13KPG, _docs/design/obliq-slovar.md,
// раздел «Мастер, мастер, организатор»; слово данных остаётся `organizer`.
var LEVEL = { member: 'Член клуба', organizer: 'Мастер', partner: 'Бизнес-партнёр' };
// Имена ролей — только тех, смысл которых записан; остальные показываются кодом.
var ROLE_NAME = { head: 'Глава клуба', god_mentor: 'Глава клуба', god: 'Наследник',
                  admin: 'Администратор', director: 'Директор',
                  staff: 'Касса', curator: 'Куратор направления', bar: 'Бар · исполнитель',
                  ops_director: 'Операционный директор', art_director: 'Арт-директор' };

function ruDate(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
}

/* Ответ /me → то, что рисуют экраны. Всё, чего не хватает, — отказ целиком
   (null), а не подстановка: баланс 0 вместо неразобранного и «до —» вместо
   срока выглядели бы данными. Единственное законное пустое место — ends_at
   при lifelong: true, это пожизненное членство владельца. */
function fromMe(d) {
  if (!d || typeof d !== 'object' || !d.member || typeof d.member !== 'object') return null;
  if (typeof d.member.tg_user_id !== 'number' || !Array.isArray(d.roles)) return null;
  if (typeof d.membership_active !== 'boolean') return null;
  var bal = typeof d.balance === 'number' ? d.balance
          : typeof d.balance === 'string' && /^-?\d+(\.\d+)?$/.test(d.balance) ? Number(d.balance) : NaN;
  if (!isFinite(bal)) return null;

  var ms = d.membership, until = null, lifelong = false;
  if (d.membership_active) {
    if (!ms || typeof ms !== 'object' || !LEVEL[ms.level] || typeof ms.lifelong !== 'boolean') return null;
    lifelong = ms.lifelong;
    if (!lifelong) {
      until = ms.ends_at ? ruDate(ms.ends_at) : null;
      if (!until) return null;          // конечное членство без конца — не разобрано
    }
  }
  // Все живые членства, по одному на вид (виды не старше друг друга). Поля
  // нет или оно не список — ответ не разобран целиком: пустой список значит
  // «членств нет», и подменять им неразобранное нельзя.
  if (!Array.isArray(d.memberships)) return null;
  var all = [];
  for (var i = 0; i < d.memberships.length; i++) {
    var m = d.memberships[i];
    if (!m || typeof m !== 'object' || !LEVEL[m.level] || typeof m.lifelong !== 'boolean') return null;
    var mu = m.lifelong ? null : m.ends_at ? ruDate(m.ends_at) : null;
    if (!m.lifelong && !mu) return null;
    all.push({ level: m.level, until: mu, lifelong: m.lifelong });
  }
  // Своя заявка на членство (Cafe13KPG#415). Поля нет — сервер до выкладки
  // заявок, это «не знаем», а не отказ: остальной /me от него не зависит.
  var req = d.membership_request === undefined ? null : fromRequest(d.membership_request);
  if (req === undefined) return null;
  var p = d.member;
  return {
    request: req,
    role: d.membership_active ? ms.level : 'guest',
    roles: d.roles.map(function (r) { return r && r.role; }).filter(Boolean),
    barSide: d.roles.some(function (r) { return r && (r.role === 'admin' || r.role === 'bar' || r.role === 'curator'); }),
    // роль с направлением: куратор бара — не куратор вообще
    grants: d.roles.filter(function (r) { return r && r.role; })
      .map(function (r) { return { role: r.role, dir: r.direction_id }; }),
    consent: !!p.consent_data_at,
    member: {
      uid: p.tg_user_id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || (p.username ? '@' + p.username : 'Без имени'),
      level: d.membership_active ? LEVEL[ms.level] : '',
      until: until,
      ends: d.membership_active && !lifelong ? ms.ends_at : null,   // ISO — для запаса пропуска
      lifelong: lifelong,
      memberships: all,
      balance: bal,
      number: p.pass_code || null
    }
  };
}

function untilText(m) {
  return m.lifelong ? 'Пожизненно' : 'Действует до ' + m.until;
}

/* ── членство: виды и заявки (Cafe13KPG#415) ──────────
   Виды с ценой — с сервера: вшитые в клиент цены уже снимались по слову
   владельца (Cafe13KPG#102), а цену на экране не проверить ничем.
   ⚠ `approved` — согласие главы клуба, а не членство. Членство создаёт
   касса, приняв деньги, и она же переводит заявку в `completed`. Экран,
   написавший после `approved` «оформлено», соврал бы человеку. */
var REQ_STATES = { pending: 1, approved: 1, rejected: 1, cancelled: 1, completed: 1 };
// null — заявки нет; undefined — ответ не разобран
function fromRequest(r) {
  if (r === null) return null;
  if (!r || typeof r !== 'object' || typeof r.id !== 'number' || !REQ_STATES[r.status]) return undefined;
  return { id: r.id, status: r.status,
           tier: typeof r.tier_name === 'string' ? r.tier_name : '',
           code: typeof r.tier_code === 'string' ? r.tier_code : '',
           said: typeof r.decision_note === 'string' ? r.decision_note.trim() : '',
           at: r.created_at ? ruDate(r.created_at) : null,
           decided: r.decided_at ? ruDate(r.decided_at) : null };
}

var TIERS = { list: null, fail: '', gen: 0 };
function fromTiers(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.tiers) || d.currency !== 'THB') return null;
  var out = [];
  for (var i = 0; i < d.tiers.length; i++) {
    var t = d.tiers[i], price = t && num(t.price_thb);
    if (!t || typeof t.code !== 'string' || !/^[a-z_]+$/.test(t.code) || typeof t.name !== 'string' || !t.name) return null;
    if (!isFinite(price) || price < 0) return null;
    if (typeof t.period_months !== 'number' || t.period_months < 1 || Math.floor(t.period_months) !== t.period_months) return null;
    // описание вида — слова владельца с сервера (api f06d01c); в клиенте их нет, как и цен
    out.push({ code: t.code, name: t.name, about: typeof t.about === 'string' ? t.about.trim() : '', price: price, months: t.period_months,
               trial: typeof t.trial_days === 'number' && t.trial_days > 0 ? t.trial_days : 0 });
  }
  return out;
}
function loadTiers() {
  var gen = ++TIERS.gen, who = WHO;
  TIERS.fail = '';
  api('GET', '/membership-tiers').then(function (r) {
    if (gen !== TIERS.gen || who !== WHO) return;
    var list = r.status === 200 ? fromTiers(r.data) : null;
    if (list) TIERS.list = list;
    else { TIERS.list = null; TIERS.fail = r.status === 403 ? denyText(r) : failText(r); }
    if (current === 'membership' || current === 'memberRequests') render();
  });
}

// Подача: busy — запрос в пути, err — отказ сервера его словами
var MREQ = { busy: false, err: '', pick: '' };
function sendRequest(code) {
  if (MREQ.busy) return;
  MREQ.busy = true; MREQ.err = ''; render();
  var who = WHO;
  api('POST', '/membership-requests', { tier_code: code }).then(function (r) {
    if (who !== WHO) return;
    MREQ.busy = false;
    var d = r.data;
    if (r.status === 201 && d && typeof d.id === 'number' && d.status === 'pending') {
      DATA.request = { id: d.id, status: 'pending', tier: typeof d.tier === 'string' ? d.tier : '', code: code,
                       said: '', at: d.created_at ? ruDate(d.created_at) : null };
    } else {
      MREQ.err = denyText(r);
      // «уже отправлена» и «уже есть» — состояние у сервера новее нашего: перечитать
      if (r.status === 409) rereadRequest();
    }
    if (current === 'membership') render();
  });
}
function rereadRequest() {
  var who = WHO;
  api('GET', '/me').then(function (r) {
    if (who !== WHO) return;
    var me = r.status === 200 ? fromMe(r.data) : null;
    if (!me) return;
    DATA.request = me.request;
    if (current === 'membership') render();
  });
}

/* Заявки для главы клуба. Право то же, что у «Людей и ответственности»:
   глава клуба или администратор (сервер: DECIDES = head, плюс is_admin). */
function mayRequests() { return LIVE && (grant('head') || grant('admin')); }
var MREQS = { list: null, pending: null, fail: '', gen: 0, busy: 0, err: '', note: '', ask: 0 };
function fromRequests(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.requests) || typeof d.pending !== 'number') return null;
  var out = [];
  for (var i = 0; i < d.requests.length; i++) {
    var q = d.requests[i];
    if (!q || typeof q.id !== 'number' || !REQ_STATES[q.status]) return null;
    out.push({ id: q.id, status: q.status,
               name: [q.first_name, q.last_name].filter(Boolean).join(' ') || (q.username ? '@' + q.username : 'Без имени'),
               tier: typeof q.tier_name === 'string' ? q.tier_name : '',
               note: typeof q.note === 'string' ? q.note.trim() : '',
               said: typeof q.decision_note === 'string' ? q.decision_note.trim() : '',
               code: typeof q.tier_code === 'string' ? q.tier_code : '',
               iso: typeof q.created_at === 'string' ? q.created_at : '',
               done: typeof q.decided_at === 'string' ? q.decided_at : '',
               pass: q.has_pass === true });
  }
  return { list: out, pending: d.pending };
}
function loadRequests() {
  var gen = ++MREQS.gen, who = WHO;
  MREQS.fail = '';
  api('GET', '/membership-requests').then(function (r) {
    if (gen !== MREQS.gen || who !== WHO) return;
    var got = r.status === 200 ? fromRequests(r.data) : null;
    if (got) { MREQS.list = got.list; MREQS.pending = got.pending; }
    else { MREQS.list = null; MREQS.fail = r.status === 403 ? denyText(r) : failText(r); }
    if (current === 'memberRequests' || current === 'home') render();
  });
}
function decideRequest(id, decision) {
  if (MREQS.busy) return;
  MREQS.busy = id; MREQS.err = ''; render();
  var who = WHO;
  api('POST', '/membership-requests/' + id + '/decide', { decision: decision, note: decision === 'rejected' ? MREQS.note.trim() : '' }).then(function (r) {
    if (who !== WHO) return;
    MREQS.busy = 0;
    if (r.status === 200 && r.data && r.data.status === decision) { MREQS.note = ''; MREQS.ask = 0; }
    else MREQS.err = denyText(r);
    // и после отказа: «уже не ждёт ответа» значит, что список устарел
    loadRequests();
    if (current === 'memberRequests') render();
  });
}

/* ── просьба о вступлении (Cafe13KPG#459, кадры E44*) ─────────────
   Экран того, кого нет в списке допущенных: `/me` ответил 403. Ручки /join*
   висят на ПОДПИСИ, а не на допуске (api#78, app/routers/join.py), —
   поэтому они отвечают ровно тому, кому отказал /me. Экран — `noAccess`, он
   в BARE, и охрана входа (noEntry, #458) его пускает.

   Деньги приложение не принимает: человек платит своим путём ДО просьбы, и
   просьба без чека не уходит (сервер: receipt NOT NULL, 422).

   Сумм в клиенте нет: обе приходят с сервера (`amount_thb`, `amount_usd`),
   и это две назначенные цены, а не одна с курсом (слово владельца). Реквизиты —
   картинки с сервера по подписи: на них имя живого человека, в публичном
   клиенте им не место. */
var JOIN_STATES = { pending: 1, approved: 1, rejected: 1 };
var RECEIPT_MAX = 2 * 1024 * 1024;   // потолок сервера (MAX_RECEIPT); проверяем ДО отправки
var RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
/* method — слово сервера для способа (pay_method, api eba22fb): без него согласие
   главы клуба не пишет деньги в книгу и не кладёт человеку на счёт его долю. */
var JOIN_PAY = {
  promptpay: { name: 'PromptPay', method: 'transfer', where: 'Bangkok Bank · Thai QR', cur: '฿',
               hint: 'QR суммы не несёт — её вводят руками.' },
  usdt:      { name: 'USDT', method: 'crypto', where: 'Binance · сеть TRC20', cur: 'USDT',
               hint: 'Перевод в другой сети не возвращается.' }
};

// «Вы входите как …» — кем увидел сервер по подписи: у человека бывает два аккаунта
function joinWho() {
  var j = JOIN.info;
  if (!j || !j.name) return '';
  return '<span class="small">Вы входите как <b>' + esc(j.name) + (j.nick ? ' · ' + esc(j.nick) : '') + '</b></span>';
}
// Ответ GET /join → то, что рисует экран; null — не разобран целиком
function fromJoin(d) {
  if (!d || typeof d !== 'object') return null;
  var thb = num(d.amount_thb), usd = num(d.amount_usd);
  if (!(thb > 0) || !(usd > 0) || d.currency !== 'THB') return null;
  if (typeof d.about_token !== 'string' || !d.about_token) return null;
  var y = d.you;
  if (!y || typeof y !== 'object' || typeof y.first_name !== 'string') return null;
  var q = d.request, req = null;
  if (q !== null) {
    if (!q || typeof q !== 'object' || typeof q.id !== 'number' || !JOIN_STATES[q.status]) return null;
    req = { id: q.id, status: q.status,
            note: typeof q.decision_note === 'string' ? q.decision_note.trim() : '' };
  }
  return {
    thb: thb, usd: usd, request: req, token: d.about_token,
    name: [y.first_name, typeof y.last_name === 'string' ? y.last_name : ''].filter(Boolean).join(' '),
    nick: typeof y.username === 'string' && y.username ? '@' + y.username : ''
  };
}

/* pay — выбранный способ; img — адреса картинок реквизитов (blob:), 'fail' —
   не загрузилась; file — приложенный чек {mime, b64, size}; again — после
   отказа человек попросил снова и видит форму. */
var JOIN = { info: null, fail: '', gen: 0, pay: 'promptpay', img: {}, said: '',
             file: null, fileErr: '', busy: false, err: '', again: false };

// при КАЖДОМ входе на экран: ссылка «О клубе» живёт час, и с прошлого входа она могла умереть
function loadJoin() {
  var gen = ++JOIN.gen;
  JOIN.fail = '';
  api('GET', '/join').then(function (r) {
    if (gen !== JOIN.gen) return;
    var got = r.status === 200 ? fromJoin(r.data) : null;
    if (got) JOIN.info = got;
    else { JOIN.info = null; JOIN.fail = r.status === 200 ? failText(r) : denyText(r); }
    if (got) loadRequisites(JOIN.pay);
    if (current === 'noAccess') render();
  });
}

/* Картинка реквизитов — по подписи, поэтому не <img src>: браузер заголовка
   не пошлёт. Забираем сами и показываем адресом blob:. */
function loadRequisites(name) {
  if (JOIN.img[name]) return;
  JOIN.img[name] = 'loading';
  var opt = { headers: { 'X-Telegram-Init-Data': tg.initData } };
  fetch(API + '/join/requisites/' + name, opt).then(function (r) {
    var type = r.headers.get('Content-Type') || '';
    if (r.status !== 200 || type.indexOf('image/') !== 0) throw new Error('requisites ' + r.status);
    return r.blob();
  }).then(function (b) {
    JOIN.img[name] = URL.createObjectURL(b);
  }, function () {
    JOIN.img[name] = 'fail';
  }).then(function () {
    if (current === 'noAccess') render();
  });
}

// чек → base64 без префикса data:; снимок ужимается, PDF идёт как есть
function readAsB64(blob) {
  return new Promise(function (ok, no) {
    var fr = new FileReader();
    fr.onload = function () { var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = no;
    fr.readAsDataURL(blob);
  });
}
/* Снимок с телефона легко больше 2 МиБ, а отказ 413 приходит после долгой
   загрузки и после того, как человек уже заплатил. Поэтому снимок ужимается
   здесь: длинная сторона не больше 1600 px, JPEG; не влез — качество ниже,
   ступенями. 2 МиБ — потолок, а не цель. */
function shrink(file) {
  return new Promise(function (ok, no) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var steps = [0.85, 0.7, 0.5];
      (function next() {
        c.toBlob(function (b) {
          if (!b) return no(new Error('toBlob'));
          if (b.size > RECEIPT_MAX && steps.length > 1) { steps.shift(); return next(); }
          ok(b);
        }, 'image/jpeg', steps[0]);
      })();
    };
    img.onerror = function () { URL.revokeObjectURL(url); no(new Error('image')); };
    img.src = url;
  });
}
function attachReceipt(file) {
  JOIN.fileErr = ''; JOIN.err = '';
  if (RECEIPT_TYPES.indexOf(file.type) === -1) {
    JOIN.file = null; JOIN.fileErr = 'Чек — фото или PDF. Выберите другой файл.'; render(); return;
  }
  var pdf = file.type === 'application/pdf';
  (pdf ? Promise.resolve(file) : shrink(file)).then(function (b) {
    if (b.size > RECEIPT_MAX) throw new Error('big');
    return readAsB64(b).then(function (s) {
      JOIN.file = { mime: pdf ? 'application/pdf' : 'image/jpeg', b64: s, size: b.size, pdf: pdf };
    });
  }).catch(function (e) {
    JOIN.file = null;
    JOIN.fileErr = e && e.message === 'big' ? 'Чек больше 2 МБ — приложите файл поменьше.' : 'Чек не прочитался — приложите его снова.';
  }).then(function () {
    if (current === 'noAccess') render();
  });
}

/* Тетрадь клуба в рамке. Отказ сервера приходит JSON-ом (403 на устаревшем
   токене), а у кросс-доменной рамки нет события «не загрузилось»: onload
   срабатывает и на странице отказа. Поэтому решение — ДО рамки: перечитать
   GET /join за свежим токеном (живёт час) и вставлять рамку только по нему;
   нет токена — отказ нашими словами, а не голый JSON в рамке (designer-55). */
var ABOUT = { url: '', fail: '', gen: 0, loaded: false };
// рамка дочитала страницу — убрать «Открываем…» (E49b); перерисовка помнит это через loaded
function aboutLoaded() {
  ABOUT.loaded = true;
  var f = document.querySelector('iframe.about'), w = document.querySelector('.paper .wait');
  if (f) f.hidden = false;
  if (w) w.hidden = true;
}
function loadAbout() {
  var gen = ++ABOUT.gen;
  ABOUT.url = ''; ABOUT.fail = ''; ABOUT.loaded = false;
  api('GET', '/join').then(function (r) {
    if (gen !== ABOUT.gen) return;
    var got = r.status === 200 ? fromJoin(r.data) : null;
    if (got) { JOIN.info = got; ABOUT.url = API + '/join/about?t=' + encodeURIComponent(got.token); }
    else ABOUT.fail = r.status === 200 ? failText(r) : denyText(r);
    if (current === 'joinAbout') render();
  });
}

function sendJoin() {
  if (JOIN.busy || !JOIN.file) return;
  var said = document.getElementById('join-said');
  if (said) JOIN.said = said.value;
  JOIN.busy = true; JOIN.err = ''; render();
  api('POST', '/join/request', { said: JOIN.said.trim(), pay_method: JOIN_PAY[JOIN.pay].method, receipt_mime: JOIN.file.mime,
                                 receipt_base64: JOIN.file.b64 }).then(function (r) {
    JOIN.busy = false;
    if (r.status === 201 && r.data && typeof r.data.id === 'number') {
      // экран «ждёт ответа» рисует ответ сервера, а не наша догадка: перечитать
      JOIN.file = null; JOIN.said = ''; JOIN.again = false;
      loadJoin();
    } else {
      JOIN.err = denyText(r);
      // «уже ждёт ответа» — состояние у сервера новее нашего
      if (r.status === 409) loadJoin();
    }
    if (current === 'noAccess') render();
  });
}

/* Экраны, которые уже стоят на данных сервера. Остальные в живом режиме
   показывают «ещё не подключено»: демонстрационная афиша рядом с настоящим
   балансом выглядела бы так же настоящей. */
// `membership` нет нарочно: экран обещал суммы-заглушки в скобках, кнопки
// без действия и путь через кассу, который новичку сегодня не пройти
// (Cafe13KPG#301). Вернётся кадром E38 после слова владельца.
var WIRED = { home: 1, pass: 1, consent: 1, consentFull: 1, demo: 1, topup: 1, people: 1, joinQueue: 1, manage: 1,
              loading: 1, noSign: 1, noAccess: 1, apiDown: 1, joinAbout: 1 };
/* Заморожено словом владельца 29.10.2026 (Cafe13KPG#510): «есть 2 роли, с которыми мы работаем —
   член клуба и я… все экраны кроме тех, с которыми мы работаем, сделать серыми и заблокировать у
   всех»; «не удаляем — делаем временно недоступным». Экраны ниже были в `WIRED` и стоят на данных
   сервера; вернуть экран — перенести строку обратно в `WIRED`. Код, кадры и серверные ручки не
   тронуты. Только в живом режиме, как и сам `WIRED`: демонстрация и опись показывают всё. */
var FROZEN = { organizer: 1, guest: 1, events: 1, event: 1, eventNew: 1, bookings: 1,
               bar: 1, drink: 1, barCart: 1, barOrder: 1, barRecipe: 1, barQueue: 1, barMoney: 1, barDay: 1,
               barCards: 1, barCard: 1, staff: 1, tillPerson: 1, tillMembership: 1, tillTopup: 1, tillDay: 1 };
function frozen(screen) { return LIVE && !!FROZEN[screen]; }
// куда в живом режиме не войти: замороженное И никогда не подключённое («Моё дело» партнёра, членство) —
// по слову владельца серым гаснет всё, кроме двух ролей, а не только то, что было включено
function closed(screen) { return LIVE && (!!FROZEN[screen] || !WIRED[screen]); }

/* ── пропуск ───────────────────────────────────────────
   Код выдаёт сервер (GET /pass) один раз и больше не меняет, поэтому его
   можно держать на телефоне: у двери вечером сети может не быть, а экран
   обещает, что код работает без интернета. Сохраняется только код и подпись
   под ним — по самому коду никто не войдёт, у сканирующего на экране фото. */
var PASS = null;           // пропуск с сервера в этом запуске
var PASS_FAIL = '';        // почему пропуска нет: текст для экрана
var PASS_KEY = 'cafe13.pass';
/* Адрес фото Telegram — ОТДЕЛЬНОЙ переменной, а не полем пропуска, и это не
   вкус, а условие решения владельца 28.10.2026 («по аватарке делаем»): в
   память телефона адрес фотографии человека не кладётся. Пропуск пишется в
   `localStorage` из двух мест, и одно из них — `loadPass` — кладёт разобранный
   объект ЦЕЛИКОМ; поле внутри пропуска уехало бы в хранилище само, без чьей-то
   ошибки. Здесь запрет держится ПОСТРОЕНИЕМ: класть нечего. Живёт один
   запуск — значит без сети адреса нет, и кружок берёт букву имени (кадр E50b). */
var PASS_PHOTO = null;

function fromPass(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.pass_code !== 'string' || !/^XIII-\d{4}$/.test(d.pass_code)) return null;
  if (!LEVEL[d.level] || typeof d.lifelong !== 'boolean') return null;
  // Срок хранится как пришёл, в ISO: по «14 ноября 2026» истёкший запас от
  // живого не отличить. В слова он переводится только при отрисовке.
  if (!d.lifelong && !(d.valid_until && ruDate(d.valid_until))) return null;
  return {
    code: d.pass_code,
    name: [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Без имени',
    level: LEVEL[d.level], ends: d.lifelong ? null : d.valid_until, lifelong: d.lifelong
  };
}

/* Чей пропуск, сверяется по id из initDataUnsafe. Подписью он не проверен, но
   здесь и не впускает: только не показывает чужой код, если телефоном
   пользуются двое. */
function tgUid() {
  var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  return u && typeof u.id === 'number' ? u.id : null;
}
function savedPass() {
  try { return fromSaved(JSON.parse(localStorage.getItem(PASS_KEY))); } catch (e) { return null; }
}
function fromSaved(p) {
  // то же правило, что и для ответа сервера: битая запись — не пропуск;
  // истёкший — тоже: без сети его некому отклонить, кроме нас
  return p && p.uid !== null && p.uid === tgUid() &&
    typeof p.code === 'string' && /^XIII-\d{4}$/.test(p.code) && p.level &&
    (p.lifelong === true || typeof p.ends === 'string' && new Date(p.ends).getTime() > Date.now()) ? p : null;
}
/* Сервер сказал «нет» — запас стирается: офлайн-пропуск того, кого больше не
   пускают, показывал бы доступ, которого нет. */
function dropPass() {
  PASS = null;
  try { localStorage.removeItem(PASS_KEY); } catch (e) { /* нечего стирать */ }
}

/* Запас переписывается при КАЖДОМ удачном входе, а не только на экране
   пропуска: продливший членство и не открывавший пропуск увидел бы у двери
   без сети старый срок — или ничего, когда тот истечёт. Решение владельца:
   в пропуске зашита дата окончания (membership-and-roles.md §9). */
function syncPass(me) {
  if (me.role === 'guest') { dropPass(); return; }        // членство не активно
  if (!me.member.number) return;                         // код ещё не выдавали — писать нечего
  try {
    localStorage.setItem(PASS_KEY, JSON.stringify({
      code: me.member.number, name: me.member.name, level: me.member.level,
      ends: me.member.ends, lifelong: me.member.lifelong, uid: tgUid()
    }));
  } catch (e) { /* без запаса — только онлайн */ }
}

function loadPass() {
  PASS_FAIL = '';
  api('GET', '/pass').then(function (r) {
    var p = r.status === 200 ? fromPass(r.data) : null;
    /* Адрес: строка, только `https://` — и НАБОР ЗНАКОВ УЖЕ, чем у списка
       людей. Причина не в осторожности, а в месте употребления: в списке
       адрес идёт в `src`, и разметочного экранирования там довольно, а здесь
       он попадает в `url()` ВНУТРИ атрибута `style`, то есть в чужой язык.
       Экранирование разметки от этого не спасает: `esc` превратит кавычку в
       `&quot;`, а разборщик атрибута вернёт её обратно, и `url("…")` можно
       закрыть, дописав своё правило. Замер мой, отрисовкой, шесть входов:
       опасна РОВНО двойная кавычка — на ней `color:red` применяется
       (вычисленный цвет `rgb(255,0,0)`); апостроф, обратный слэш, пробел и
       скобка внутри `url("…")` наружу НЕ выходят. Запрет шире измеренного
       НАРОЧНО: у законного адреса этих знаков не бывает, а гадать, какой
       знак окажется ограничителем после чьей-то правки шаблона, дороже.
       Адрес считается ДО ветвления и обнуляется вместе с пропуском: когда
       сервер отказал, `p` пустой — значит и фото нет, и прошлое не остаётся. */
    PASS_PHOTO = p && typeof r.data.photo_url === 'string' &&
                 /^https:\/\/[^\s"'()\\<>]+$/.test(r.data.photo_url)
               ? r.data.photo_url : null;
    if (p) {
      PASS = p;
      p.uid = tgUid();
      if (!TEST.on) try { localStorage.setItem(PASS_KEY, JSON.stringify(p)); } catch (e) { /* без запаса — только онлайн */ }
    } else {
      // 403 бывает двух видов: «доступа нет» (не в списке, cafe13-api#7) —
      // это отказ во входе целиком; «членство не активно» — только пропуску.
      if (r.status === 403 && !TEST.on) dropPass();
      if (r.status === 403 && r.data && r.data.detail === 'доступа нет' && !TEST.on) { go('noAccess'); return; }
      PASS_FAIL = r.status === 403 && r.data && r.data.detail === 'членство не активно'
                ? 'Членство не активно — пропуск выдаётся только при живом членстве.'
                : r.status === 403 ? 'Сервер отказал в пропуске.'
                : r.status === 0 ? 'Сервер не ответил.'
                : r.status === 200 ? 'Ответ сервера не разобран.'
                : 'Сервер ответил кодом ' + r.status + '.';
    }
    if (current === 'pass') render();
  });
}

/* Настоящий QR из кода пропуска. Внутри — только сам код (XIII-0042):
   кого он означает, знает сервер, а не картинка. */
function qrSvg(text) {
  var q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  var n = q.getModuleCount(), m = 2, out = '';
  for (var y = 0; y < n; y++) {
    for (var x = 0; x < n; x++) {
      if (q.isDark(y, x)) out += 'M' + (x + m) + ' ' + (y + m) + 'h1v1h-1z';
    }
  }
  return '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" role="img" aria-label="Код пропуска ' + esc(text) +
    '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#15171A" d="' + out + '"/></svg>';
}

/* Фото — ВТОРЫМ доводом, а не из `PASS_PHOTO` изнутри: карточку рисуют два
   места, и у второго — экрана сбоя — фото не бывает по сути, он показывает
   запас с телефона, а в запасе фото нет. Довод делает это видимым в месте
   вызова: «без сети — буква» выходит из того, что передать нечего, а не из
   проверки сети, которой в клиенте нет и заводить её незачем.

   БУКВА СТОИТ В РАЗМЕТКЕ ВСЕГДА, а фото накрывает её псевдоэлементом —
   правило семейства `.avatar` из кадров E50/E50b (`designer-55`, замер
   отрисовкой трёх случаев рядом). Состояний у кружка не два, а три, и третье
   — «сеть есть, адрес есть, картинка не пришла»: картинка тегом даёт в кружке
   значок битого изображения, а псевдоэлемент не даёт ничего, и под ним
   остаётся буква. Поэтому ни `onerror`, ни второй ветки здесь нет: все три
   состояния закрывает одно правило. Адрес уходит в своё свойство `--photo`,
   потому что он у каждого свой и в таблице стилей ему места нет. */
function passCard(p, photo) {
  var буква = esc(p.name.slice(0, 1).toUpperCase());
  return '<div class="pass">' +
      '<div class="who">' +
        (photo
          ? '<span class="avatar photo" style="--photo:url(&quot;' + esc(photo) + '&quot;)">' + буква + '</span>'
          : '<span class="avatar">' + буква + '</span>') +
        '<span class="col"><b style="font-size:19px;font-family:Prata,Georgia,serif">' + esc(p.name) + '</b>' +
        '<span style="font-size:12px;color:#B8B6AE">' + esc(p.level) + ' · ' + esc(p.lifelong ? 'пожизненно' : 'до ' + ruDate(p.ends)) + '</span></span>' +
      '</div>' +
      '<div class="code-box">' + qrSvg(p.code) + '</div>' +
      '<span class="num-big">' + esc(p.code.replace('-', ' · ')) + '</span>' +
    '</div>';
}

/* ── бар на сервере ────────────────────────────────────
   Главный путь гостя — «Купить»: одно нажатие создаёт заказ на одну позицию,
   со счёта, за стойку. Корзина остаётся для нескольких позиций, но
   второстепенна. Решение владельца: списание при СОЗДАНИИ заказа, поэтому
   гостю, которому не хватает, кнопка ведёт к пополнению, а меню он видит
   целиком. Сумму считает сервер, клиент шлёт только позиции. */

/* Направление «Бар» берётся по названию из GET /directions, а не числом в
   коде: id назначает база, и после переноса константа указала бы на чужое
   направление — меню пришло бы пустым и выглядело бы честным «пусто».
   Открыт бар или нет, сервер считает по открытой смене. */
var BAR = null;            // { id, open } после /directions

function fromDirections(d) {
  if (!Array.isArray(d)) return undefined;
  for (var i = 0; i < d.length; i++) {
    var x = d[i];
    if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' ||
        typeof x.is_active !== 'boolean' || typeof x.is_open !== 'boolean') return undefined;
  }
  var b = d.filter(function (x) { return x.title === 'Бар' && x.is_active; });
  return b.length === 1 ? { id: b[0].id, open: b[0].is_open } : null;   // ни одного или два — не угадываем
}

var MENU_STATE = '';       // '' — не грузили, 'loading', 'ok', иначе текст отказа
var BUSY = false;          // заказ в пути: второе нажатие не создаёт второй заказ
var POLL = null;

function num(v) {
  return typeof v === 'number' ? v
       : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

/* Ответ /bar/menu → группы в том виде, что рисует экран. Одна битая
   позиция — отказ целиком: меню с пропавшей строкой выглядит полным. */
function fromMenu(d) {
  if (!Array.isArray(d)) return null;
  var groups = [], by = {};
  for (var i = 0; i < d.length; i++) {
    var p = d[i];
    if (!p || typeof p.id !== 'number' || typeof p.title !== 'string' || !p.title ||
        typeof p.group !== 'string' || !(num(p.price) >= 0)) return null;
    if (!by[p.group]) { by[p.group] = { group: p.group, items: [] }; groups.push(by[p.group]); }
    by[p.group].items.push({
      id: String(p.id), pid: p.id, title: p.title, about: p.about || '', full: p.full_text || '',
      price: num(p.price), mins: p.mins ? String(p.mins) : '', photo: !!p.photo_file_id, shot: 'none'
    });
  }
  return groups;
}

function failText(r) {
  return r.status === 0 ? 'Сервер не ответил.'
       : r.status === 200 ? 'Ответ сервера не разобран.'
       : 'Сервер ответил кодом ' + r.status + '.';
}

/* Направление «Бар» — общее для меню и очереди. done(текст отказа | '') */
/* WHO — поколение «под кого собрано»: растёт при смене человека в тестовом
   режиме. Ответ, ушедший под прежнего и вернувшийся после смены, молчит —
   иначе экран нового человека получил бы направление или меню прежнего. */
var WHO = 0;
/* Вызовы loadBar идут внахлёст (опрос очереди, меню, смена, касса), и ответы
   приходят не по порядку. BAR_SEQ — номер вызова; BAR_SEEN — новейший
   отвеченный; BAR_OK — новейший успешный.
   Отказ обнуляет BAR, только если он новее всех ответов: поздний отказ
   прежнего вызова стирал направление при любом гарде вызывающего, и опрос
   своего заказа умирал молча — pollMine выходит на !BAR до перевооружения
   (Cafe13KPG#221). Свежий отказ обнуляет по-прежнему: после смены
   «не перечиталось» значит «не знаем».
   Успех применяется, если он новее прежнего успеха — даже после более
   нового отказа (loadQueue при отказе возвращает прежний BAR, и без этого
   перечитанная смена потерялась бы), — или если BAR пуст: done('') обещает
   вызывающему непустой BAR (смена читает BAR.open). */
var BAR_SEQ = 0, BAR_SEEN = 0, BAR_OK = 0;
function loadBar(done) {
  var who = WHO, seq = ++BAR_SEQ;
  api('GET', '/directions').then(function (r) {
    if (who !== WHO) return;
    var b = r.status === 200 ? fromDirections(r.data) : undefined;
    if (b) { if (seq > BAR_OK || !BAR) { BAR = b; BAR_OK = Math.max(BAR_OK, seq); } }
    else if (seq > BAR_SEEN) BAR = null;
    BAR_SEEN = Math.max(BAR_SEEN, seq);
    done(b ? '' : b === null ? 'На сервере не нашлось направления «Бар».' : failText(r));
  });
}

function loadMenu() {
  MENU_STATE = 'loading';
  loadBar(function (err) {
    if (err) {
      DATA.bar.menu = [];
      MENU_STATE = err;
      if (current === 'bar' || current === 'drink') render();
      return;
    }
    loadBarMenu();
  });
}

/* ── очередь на баре ───────────────────────────────────
   Цены здесь нет и взять её неоткуда: работнику сервер не отдаёт sum и
   price ни одним полем (решение владельца). Куратору и админу отдаёт —
   поэтому сумма рисуется построчно, только если поле пришло. Решает
   сервер, а не экран: по роли на клиенте не гадаем. */
var QUEUE = null;          // строки очереди или null, пока не пришли
var QUEUE_FAIL = '';
var QUEUE_GEN = 0, QUEUE_POLL = null;
var STATE_BUSY = {};       // id заказа → нажатие в пути
var CANCEL_ASK = null;     // id заказа, у которого спросили «точно отменить?»

function fromQueue(d) {
  if (!Array.isArray(d)) return null;
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var o = fromOrder(d[i]);
    if (!o || typeof d[i].member_id !== 'number') return null;    // битая строка — отказ целиком
    o.who = [d[i].first_name, d[i].last_name].filter(Boolean).join(' ') || 'Без имени';
    o.photo = typeof d[i].photo_url === 'string' && /^https:\/\//.test(d[i].photo_url) ? d[i].photo_url : null;
    out.push(o);
  }
  // в работе — сверху и по порядку прихода; закрытые — ниже
  var open = { new: 1, making: 1, ready: 1 };
  return out.filter(function (o) { return open[o.state]; }).reverse()
    .concat(out.filter(function (o) { return !open[o.state]; }));
}

function loadQueue() {
  if (QUEUE_POLL) { clearTimeout(QUEUE_POLL); QUEUE_POLL = null; }
  if (!LIVE || current !== 'barQueue') return;
  var gen = ++QUEUE_GEN;
  var go_ = function () {
    api('GET', '/bar/orders?direction_id=' + BAR.id).then(function (r) {
      if (current !== 'barQueue' || gen !== QUEUE_GEN) return;
      var q = r.status === 200 ? fromQueue(r.data) : null;
      if (q) { QUEUE = q; QUEUE_FAIL = ''; }
      else {
        QUEUE_FAIL = r.status === 403 ? 'Очередь видна бару и куратору направления.'
                   : (QUEUE ? 'Не обновилось: ' : '') + failText(r);
      }
      render();
      if (r.status !== 403) QUEUE_POLL = setTimeout(loadQueue, 8000);
    });
  };
  // Смену может открыть другой человек с другого телефона — состояние бара
  // перечитывается с каждым опросом. Сбой при уже известном баре не стирает
  // его, а помечает: «не обновилось» честнее, чем пропавшая строка смены.
  var known = BAR;
  loadBar(function (err) {
    if (current !== 'barQueue' || gen !== QUEUE_GEN) return;
    if (err && !known) { QUEUE_FAIL = err; render(); return; }
    if (err) BAR = known;
    BAR_FAIL = err;
    go_();
  });
}
var BAR_FAIL = '';

/* ── смена ─────────────────────────────────────────────
   Без открытой смены сервер не принимает заказов, поэтому смена открывается
   отсюда, а не правкой базы. Открывает куратор направления или админ — на
   себя: выбирать работника не из чего, списка людей у клиента нет.
   Закрывает бар или куратор. Полей наличных и часов нет: владелец про них не
   решил, а сервер их не требует. Что смена открылась, говорит не ответ на
   нажатие, а перечитанное направление. */
var SHIFT_BUSY = false, SHIFT_ASK = false;

function grant(role, dir) {
  return (DATA.grants || []).some(function (g) {
    return g.role === role && (dir === undefined || g.dir === dir);
  });
}
function canOpenShift() { return !!BAR && (grant('admin') || grant('curator', BAR.id)); }
function canCloseShift() { return canOpenShift() || (!!BAR && grant('bar', BAR.id)); }

function shiftAct(open) {
  if (SHIFT_BUSY || !BAR) return;
  SHIFT_BUSY = true; SHIFT_ASK = false;
  render();
  var dir = BAR.id;
  var req = open ? api('POST', '/shifts/open', { direction_id: dir, member_id: DATA.member.uid })
                 : api('POST', '/shifts/close?direction_id=' + dir, {});
  req.then(function (r) {
    var ok = r.status === (open ? 201 : 200);
    var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
    loadBar(function (err) {
      SHIFT_BUSY = false;
      if (err) {
        // ответа о смене нет — не говорим ни «открыта», ни «нет»
        FLASH = { text: ok ? 'Сервер принял, но состояние бара не перечиталось' : (open ? 'Смена не открылась' : 'Смена не закрылась'),
                  note: err + ' Обновите экран.' };
      } else if (BAR.open === open) {
        FLASH = open ? { text: 'Смена открыта', note: 'Гости могут заказывать.' }
                     : { text: 'Смена закрыта', note: 'Новые заказы не принимаются. Заказы в работе остались в очереди.' };
      } else {
        FLASH = { text: open ? 'Смена не открылась' : 'Смена не закрылась',
                  note: detail ? detail[0].toUpperCase() + detail.slice(1) + '.'
                      : ok ? 'Сервер ответил «принято», но бар по-прежнему ' + (BAR.open ? 'открыт.' : 'закрыт.')
                      : failText(r) };
      }
      haptic(!err && BAR.open === open ? 'ok' : 'warn');
      loadQueue();
    });
  });
}

/* ── внести себе на счёт ──────────────────────────────
   Самый короткий путь к первому заказу: человек с правом кассы вносит
   СЕБЕ, без поиска по коду пропуска. Сервер пускает в POST /till кассу,
   директора, главу клуба и админа — клиент показывает экран им же.
   Ответ мог потеряться после записи: «повторите» тогда — двойное
   внесение, поэтому вместо него — перечитанный баланс и просьба сверить.
   «Внесено» — только когда перечитанный баланс вырос ровно на сумму: сервер
   отвечает 201 и на строку, которая в баланс не попала (способ оплаты,
   который баланс не считает), и такой 201 — правдоподобный успех. */
var TOPUP = { amount: '', method: 'cash', ask: false, busy: false, err: '', from: 'bar' };
var TILL = ['admin', 'head', 'director', 'staff'];

function canTopup() {
  return LIVE && TILL.some(function (r) { return grant(r); });
}
function topupAmount(v) {
  var t = String(v || '').trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) && Number(t) > 0 ? Number(t) : null;
}
function topupSend() {
  if (TOPUP.busy) return;
  var amt = topupAmount(TOPUP.amount);
  if (amt === null) return;
  TOPUP.busy = true; TOPUP.ask = false;
  render();
  var before = DATA.member.balance, uid = DATA.member.uid;
  api('POST', '/till', { kind: 'topup', amount: amt, method: TOPUP.method, member_id: uid }).then(function (r) {
    var d = r.data;
    var ok = r.status === 201 && !!d && d.kind === 'topup' && num(d.amount) === amt && d.member_id === uid;
    var detail = d && typeof d.detail === 'string' ? d.detail : '';
    api('GET', '/me').then(function (m) {
      var me = m.status === 200 ? fromMe(m.data) : null;
      if (me) DATA.member.balance = me.member.balance;
      var now = me ? 'На счёте сейчас ' + money(me.member.balance) + ' ฿.' : 'Баланс не перечитался — откройте экран заново.';
      var grew = !!me && Math.abs(me.member.balance - before - amt) < 0.005;
      TOPUP.busy = false;
      if (ok && grew) {
        TOPUP.amount = '';
        FLASH = { text: 'Внесено ' + money(amt) + ' ฿', note: now };
        haptic('ok');
      } else if (ok && !me) {
        FLASH = { text: 'Записано, но баланс не перечитался',
                  note: 'Сервер принял внесение, а баланс прочитать не удалось. Было ' + money(before) +
                        ' ฿. Откройте экран заново. Сверьте, прежде чем вносить снова.' };
        haptic('warn');
      } else if (ok && me) {
        FLASH = { text: 'Записано, но на счёт не попало',
                  note: 'Сервер принял внесение, а баланс не вырос: было ' + money(before) + ' ฿. ' + now +
                        ' Не вносите снова — сообщите администратору клуба.' };
        haptic('warn');
      } else if (r.status === 0 || r.status === 201) {
        FLASH = { text: 'Неизвестно, внесено ли',
                  note: (r.status === 0 ? 'Сервер не ответил. ' : 'Ответ сервера не разобран. ') + now +
                        ' Было ' + money(before) + ' ฿. Сверьте, прежде чем вносить снова.' };
        haptic('warn');
      } else {
        FLASH = { text: 'Не внесено', note: detail ? detail[0].toUpperCase() + detail.slice(1) + '.' : failText(r) };
        haptic('warn');
      }
      if (current === 'topup') render();
    });
  });
}

/* ── касса: человек по коду пропуска ────────────────────
   Цепочка экранов (staff → tillPerson → tillMembership | tillTopup), чтобы системная
   «назад» Telegram вела с формы к карточке, а с карточки — к скану: у
   вкладки staff своей записи в BACK нет, и состояние внутри одного экрана
   «назад» не получило бы вовсе (кадры E34, designer-55).
   member_id из by-pass — это tg_user_id человека. Он живёт только здесь,
   в памяти, на время одной операции: не в разметку, не в data-атрибуты,
   не во флэш и не в хранилище. Репозиторий публичный — tools/ids-clean.cjs.
   Цен членства на сервере нет: сумму называет касса, подсказки нет, пока
   владелец не назовёт прейскурант. Срок — тоже касса, 1…24 по серверу. */
var TP = { code: '', who: null, gen: 0, busy: false, deny: '', kind: '',
           level: 'member', months: '', amount: '', method: 'cash', err: '', done: null };

function tillReset() {
  TP.gen++; TP.who = null; TP.busy = false; TP.deny = ''; TP.done = null; TP.err = '';
}

// Ответ by-pass → карточка. Чего не хватает — отказ целиком: человек с
// пустым именем или остаток 0 вместо неразобранного выглядели бы найденными.
function fromTillPerson(d, code) {
  if (!d || typeof d !== 'object' || typeof d.member_id !== 'number') return null;
  if (typeof d.first_name !== 'string' || typeof d.membership_active !== 'boolean') return null;
  var bal = num(d.balance), ms = d.membership, until = null, lifelong = false;
  if (!isFinite(bal)) return null;
  if (d.membership_active) {
    if (!ms || typeof ms !== 'object' || !LEVEL[ms.level] || typeof ms.lifelong !== 'boolean') return null;
    lifelong = ms.lifelong;
    if (!lifelong && !(until = ms.ends_at ? ruDate(ms.ends_at) : null)) return null;
  }
  var m = /^(?:XIII-)?(\d{4})$/.exec(code.trim().toUpperCase());
  return { id: d.member_id,
           name: [d.first_name, typeof d.last_name === 'string' ? d.last_name : ''].filter(Boolean).join(' ') || 'Без имени',
           code: m ? 'XIII-' + m[1] : code.trim().toUpperCase(),
           level: d.membership_active ? ms.level : '', until: until, lifelong: lifelong, balance: bal };
}

// Ответ сервера с текстом — текст дословно, с заглавной; иначе — код ответа.
function said(r) {
  var t = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  return t ? t[0].toUpperCase() + t.slice(1) : failText(r);
}

/* Найти по коду. Ответ, вернувшийся после «следующего человека» или смены
   человека в тестовом режиме, молчит: иначе карточка прежнего встала бы
   под новым кодом. done(rec | null, r) — для перечитывания после приёма. */
function tillLookup(code, done) {
  var gen = TP.gen;
  api('GET', '/till/by-pass/' + encodeURIComponent(code.trim())).then(function (r) {
    if (gen !== TP.gen) return;
    done(r.status === 200 ? fromTillPerson(r.data, code) : null, r);
  });
}

function tillFind(code) {
  if (TP.busy) return;
  TP.code = String(code || '').trim();
  if (!TP.code) return;
  tillReset(); TP.busy = true;
  render();
  tillLookup(TP.code, function (rec, r) {
    TP.busy = false;
    if (rec) { TP.who = rec; haptic('ok'); go('tillPerson'); return; }
    TP.deny = r.status === 200 ? 'Ответ сервера не разобран.' : said(r);
    haptic('warn');
    if (current === 'staff') render();
  });
}

function tillPrep(kind) {
  TP.kind = kind === 'membership' ? 'membership' : 'topup';
  TP.months = ''; TP.amount = ''; TP.err = ''; TP.deny = '';
  TP.level = TP.who.level || 'member';
  TP.method = 'cash';
}
function tillOpen(kind) {
  if (!TP.who) return;
  tillPrep(kind);
  go(TP.kind === 'membership' ? 'tillMembership' : 'tillTopup');
}

var PAY_HOW = { cash: 'наличными', card: 'картой', account: 'со счёта' };

/* 201 с разобранным, но не совпавшим телом (Cafe13KPG#351, кадры E34k/E34l).
   Развилка — не тяжесть, а есть ли что поставить РЯДОМ с введённым:
   человек разошёлся → E34l (значений нет: member_id — это tg_user_id);
   вид, сумма, уровень разошлись и ответ печатаем → E34k, одна пара;
   печатать нечего (тела нет, membership не пришёл, сумма не число, вид или
   уровень незнакомы) → null, остаётся E34z. Срок в пару не идёт: кассир
   вводит месяцы, сервер отвечает датой (месяцев в ответе нет вовсе). Пара
   выбирается по причине, а не по следствию — вид, сумма, уровень: другой вид
   почти всегда несёт и другую сумму. Слова — те же словари, что у дня
   кассы и карточки (TD_KIND, LEVEL), второй словарь разошёлся бы молча. */
function tillOdd(d, sent) {
  if (!d || typeof d !== 'object') return null;
  if (d.member_id != null && d.member_id !== sent.who) return { person: true };
  var ms = d.membership;
  var pair = d.kind !== sent.kind
      ? (TD_KIND[d.kind] ? ['kind', TD_KIND[sent.kind], TD_KIND[d.kind]] : null)
    : num(d.amount) !== sent.amt
      ? (isFinite(num(d.amount)) ? ['amount', money(sent.amt) + ' ฿', money(num(d.amount)) + ' ฿'] : null)
    : sent.kind === 'membership' && ms && typeof ms === 'object' && ms.level !== sent.level
      ? (LEVEL[ms.level] ? ['level', LEVEL[sent.level], LEVEL[ms.level]] : null)
    : null;
  return pair && { mine: pair[1], theirs: pair[2], id: Number.isInteger(d.id) ? d.id : null };
}

function tillSend() {
  if (TP.busy || !TP.who) return;
  var who = TP.who, kind = TP.kind, level = TP.level, method = TP.method, amt = topupAmount(TP.amount);
  var months = /^\d{1,2}$/.test(TP.months.trim()) ? Number(TP.months.trim()) : 0;
  TP.err = kind === 'membership' && (months < 1 || months > 24) ? 'Срок — целое число месяцев, от 1 до 24.'
         : amt === null ? 'Сумма — число больше нуля, например 500.' : '';
  TP.deny = '';
  if (TP.err) { render(); return; }
  var body = { kind: kind, amount: amt, method: method, member_id: who.id };
  if (kind === 'membership') { body.level = level; body.months = months; }
  else if (method === 'account') return;            // у пополнения этой кнопки нет
  TP.busy = true;
  render();
  var gen = TP.gen;
  api('POST', '/till', body).then(function (r) {
    if (gen !== TP.gen) return;
    var d = r.data, ms = d && d.membership;
    var ok = r.status === 201 && !!d && d.kind === kind && num(d.amount) === amt && d.member_id === who.id &&
             (kind !== 'membership' || !!ms && ms.level === level && !!ruDate(ms.ends_at));
    if (r.status !== 0 && r.status !== 201) {
      TP.busy = false; TP.deny = said(r); haptic('warn'); render(); return;
    }
    // Принято или неизвестно — карточка перечитывается в обоих случаях:
    // остаток после оплаты со счёта иначе остался бы прежним, то есть ложным.
    tillLookup(who.code, function (rec) {
      TP.busy = false;
      if (ok) {
        var now = rec || Object.assign({}, who, { balance: null });
        if (kind === 'membership') {
          now.level = ms.level; now.until = ruDate(ms.ends_at); now.lifelong = false;
        }
        TP.who = now;
        var grew = kind !== 'topup' || !rec || Math.abs(rec.balance - who.balance - amt) < 0.005;
        TP.done = { kind: kind, text: 'Принято ' + money(amt) + ' ฿ ' + PAY_HOW[method],
                    /* Совет по виду строки и состоянию — четыре кадра (Cafe13KPG#374, #381, карточка
                       #373). В till.cancel привратник хозяина (409 «правки членства … нет») стоит
                       раньше субъектного: строку с членством в приложении не снимает никто — E34g,
                       «к администратору клуба». У пополнения хозяина нет, и снять его может тот, кто
                       принял, на «Дне кассы» — E34m; общая фраза отправляла бы его от стойки.
                       ⚠ Совет E34m исполним только здесь: итог читает тот, кто ТОЛЬКО ЧТО принял, и
                       субъектный привратник («…принял другой человек: отменяет он сам») для него не
                       срабатывает. Там, где строку читает другой (список «Дня кассы», отчёт), эта
                       фраза — ложь того же рода, что снятая в шаге 1; туда её не переносить.
                       Ветви: `kind` здесь — TP.kind, а он только 'membership' или 'topup' (tillOpen),
                       и ok требует d.kind === kind; третьего вида в эту развилку не приходит.
                       E34m — только у ЧИСТОГО приёма: карточка перечитана (rec) и остаток вырос на
                       сумму (grew). Проверок две, потому что grew при rec = null — истина
                       (`|| !rec` выше). Не вырос (!grew бывает только у topup с rec) — E34n, без
                       адреса: адрес несёт плашка «Не вносите снова — сверьте с администратором
                       клуба», и второй, расплывчатее, заставил бы гадать, одно это поручение или два.
                       Не перечитан — E34o, то есть E34g с адресом: у плашки «Перечитать» адреса нет.
                       «Внесите заново» в обоих не-чистых спорило бы с плашкой или с #333. */
                    note: kind === 'topup' && rec && grew
                      ? 'Строка ушла в книгу клуба. Исправить задним числом нельзя — ошиблись, отмените её на «Дне кассы» и внесите заново.'
                      : !grew
                      ? 'Строка ушла в книгу клуба. Исправить задним числом нельзя.'
                      : 'Строка ушла в книгу клуба. Исправить задним числом нельзя. Ошиблись — к администратору клуба.',
                    warn: grew ? '' : 'Остаток изменился не на эту сумму: было ' + money(who.balance) +
                                      ' ฿. Не вносите снова — сверьте с администратором клуба.' };
        haptic(grew ? 'ok' : 'warn');
      } else {
        // прежний остаток не показывается как нынешний: его могли уже списать
        TP.who = rec || Object.assign({}, who, { balance: null });
        /* Два исхода с ПРОТИВОПОЛОЖНЫМ советом (Cafe13KPG#333, кадры E34zh/E34z/E34i,
           слова координатора). Ответа не было (status 0) — прошло или нет,
           неизвестно. 201 — транзакция закоммичена, строка в книге уже есть, и
           «неизвестно» звало бы ко второму приёму: второе членство ДОБАВЛЯЕТ
           период, второе пополнение — деньги. Причину непрохождения ok при 201
           (тело не разобрано / не совпало) делит tillOdd (#351, E34k/E34l). */
        var odd = r.status === 201 ? tillOdd(d, { who: who.id, kind: kind, amt: amt, level: level }) : null;
        var ms0 = who.level ? (who.lifelong ? 'членство пожизненно' : 'членство до ' + who.until) : 'членства нет';
        TP.done = odd && odd.person
          ? { kind: '', unsure: true, sent: true, reread: !!rec, person: true, text: 'Проведено, а человек в ответе не тот',
              before: 'Перед приёмом: ' + ms0 + ', остаток ' + money(who.balance) + ' ฿',
              note: 'Сервер ответил «принято» — строка в книге клуба уже есть. Но человек в ответе не тот, кого вы открыли, ' +
                    'и чья это строка — по ответу не сказать. Второй раз не принимайте: повтор дал бы вторую строку.' }
          : odd
          ? { kind: '', unsure: true, sent: true, reread: !!rec, odd: odd, text: 'Проведено не то, что вводили',
              note: 'Сервер ответил «принято» — строка в книге клуба уже есть. Второй раз не принимайте: повтор дал бы в книге вторую строку.' }
          : r.status === 201
          ? { kind: '', unsure: true, sent: true, reread: !!rec, text: 'Деньги проведены',
              before: 'Перед приёмом: ' + ms0 + ', остаток ' + money(who.balance) + ' ฿',
              note: 'Сервер ответил «принято» — строка в книге клуба уже есть. Что в ней записано, по ответу подтвердить нечем: ' +
                    'ни сумму, ни срок. Второй раз не принимайте: повтор дал бы в книге вторую строку.' }
          : { kind: '', unsure: true, sent: false, reread: !!rec, text: 'Неизвестно, принято ли',
              before: 'Перед приёмом: ' + ms0 + ', остаток ' + money(who.balance) + ' ฿',
              note: 'Ответ сервера не дошёл.' };
        haptic('warn');
      }
      go('tillPerson');
    });
  });
}

function tillForm(kind) {
  var w = TP.who;
  if (!w || TP.kind !== kind) return '<div class="card quiet"><span class="small">Человек не выбран.</span></div>' +
    '<button type="button" class="btn" data-go="staff">К скану пропуска</button>';
  var lock = TP.busy ? ' disabled' : '', mem = kind === 'membership';
  var seg = function (act, list, on) {
    return list.map(function (x) {
      return '<button type="button" data-action="' + act + ':' + x[0] + '"' + (on === x[0] ? ' aria-pressed="true"' : '') + lock + '>' + x[1] + '</button>';
    }).join('');
  };
  var ways = [['cash', 'Наличные'], ['card', 'Карта']].concat(mem ? [['account', 'Со счёта']] : []);
  return (!LIVE && FLASH ? flash() : '') +
    '<div class="card quiet"><div class="row"><div class="col"><span class="small">Кому</span><b>' + esc(w.name) + '</b></div>' +
      '<span class="small num">' + esc(w.code) + '</span></div></div>' +
    (mem ? '<div class="group"><span class="label">Вид членства</span><div class="seg wrap">' +
             seg('tp-level', [['member', LEVEL.member], ['organizer', LEVEL.organizer], ['partner', LEVEL.partner]], TP.level) + '</div></div>' +
           '<div class="group"><span class="label">Срок</span><div class="field"><label for="tp-months">Месяцев</label>' +
             '<input id="tp-months" type="text" inputmode="numeric" autocomplete="off" value="' + esc(TP.months) + '"' + lock + '></div>' +
             '<span class="small">От 1 до 24.</span></div>' : '') +
    '<div class="field"><label for="tp-amount">Сумма, ฿</label>' +
      '<input id="tp-amount" type="text" inputmode="decimal" autocomplete="off" value="' + esc(TP.amount) + '"' + lock + '>' +
      '<span class="small">' + (mem ? 'Цену называет касса: прейскуранта на сервере нет.' : 'Сумму называет человек у стойки.') + '</span></div>' +
    '<div class="group"><span class="label">Чем платят</span><div class="seg">' + seg('tp-method', ways, TP.method) + '</div></div>' +
    (TP.err ? '<span class="small" style="color:var(--clay)">' + esc(TP.err) + '</span>' : '') +
    (TP.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TP.deny) + '</span></div>' : '') +
    '<button type="button" class="btn" data-action="tp-send"' + lock + '>' + (TP.busy ? 'Вносим…' : 'Внести') + '</button>' +
    (mem ? '' : '<div class="note">' + svg(ICON.info) + '<span>Перевести со счёта на счёт нельзя — только наличные или карта.</span></div>');
}

function tillCard(w) {
  var ms = w.level ? (w.lifelong ? 'Пожизненно' : 'до ' + w.until) : 'нет';
  return '<div class="card strong"><div class="row top"><div class="col"><h2>' + esc(w.name) + '</h2>' +
      '<span class="small num">Пропуск ' + esc(w.code) + '</span></div>' +
      '<span class="pill' + (w.level ? ' on' : '') + '">' + esc(w.level ? LEVEL[w.level] : 'Членства нет') + '</span></div>' +
    '<div class="rows"><div><span class="small">Членство</span><b class="num">' + esc(ms) + '</b></div>' +
      '<div><span class="small">На счёте</span><b class="num">' +
        (w.balance === null ? 'не перечитан' : money(w.balance) + ' ฿') + '</b></div></div></div>';
}

/* ── касса: день (кадры E36/E36b/E36v, Cafe13KPG#340) ──────
   GET /till/day — книга суток клуба без затрат; POST /till/{id}/cancel —
   отмена строки, она встаёт НОВОЙ строкой, отменённая остаётся видимой.
   Кнопка стоит у КАЖДОЙ живой строки, и чужой тоже: у строки с хозяином
   (заказ бара, членство, запись) сервер отвечает 409 и называет путь
   исправления, и этот отказ стоит ПЕРЕД отказом «принял другой». Спрятав
   кнопку по by_staff_id, экран спрятал бы путь именно там, где он есть
   (слово designer-55). by_staff_id и member_id — tg_user_id; из разбора
   они не выходят вовсе. */
var TD = { gen: 0, data: null, fail: '', ask: -1, busy: -1, deny: null };
var TD_KIND = { membership: 'Членство', topup: 'На счёт', event: 'За запись', service: 'За услугу' };
var TD_HOW = { cash: 'наличные', card: 'карта', account: 'со счёта' };

/* Отказ отмены — словами сервера как есть, у всех четырёх видов хозяина.
   До выкладки api `02f0ac6` сервер у строки ЗАПИСИ обещал «деньги вернутся
   вместе с ней», а возврата нет, и клиент подменял этот текст (Cafe13KPG#340).
   На бою `02f0ac6` сервер говорит правду сам (`till.py`: «возврата за запись в
   приложении пока нет…»), подмена снята — о выкладке сказал сторож батареи. */

// Строка без чего-нибудь нужного — отказ целиком: день с выпавшей строкой
// выглядит полным. Итог, не сходящийся со строками, снимает только ЧИСЛА
// (итог и суммы по способу — производные), а строки остаются: они печатаются
// из ответа дословно (кадр E36g, designer-55).
function fromTillDay(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.rows) || typeof d.count_live !== 'number') return null;
  var total = num(d.total_live), rows = [], sum = 0, live = 0, by = { cash: 0, card: 0, account: 0 };
  if (!isFinite(total)) return null;
  for (var i = 0; i < d.rows.length; i++) {
    var r = d.rows[i], amt = r && num(r.amount);
    if (!r || typeof r.id !== 'number' || !TD_KIND[r.kind] || !TD_HOW[r.method] || !(amt >= 0) || !hm(r.at)) return null;
    if ((r.cancels_id !== null && typeof r.cancels_id !== 'number') ||
        (r.cancelled_by !== null && typeof r.cancelled_by !== 'number') ||
        (r.note !== null && typeof r.note !== 'string')) return null;
    // заметка строки — дословно и только у услуги: «заказ бара N» там
    // соглашение, а не схема, его может набрать и кассир (designer-55)
    var row = { id: r.id, kind: r.kind, amount: amt, time: hm(r.at), how: TD_HOW[r.method],
                note: r.kind === 'service' && r.note ? r.note : '',
                undo: r.cancels_id !== null, gone: r.cancelled_by !== null };
    if (!row.undo && !row.gone) { live++; sum += amt; by[r.method] = Math.round((by[r.method] + amt) * 100) / 100; }
    rows.push(row);
  }
  return { rows: rows, total: total, count: live, by: by,
           odd: live !== d.count_live || Math.abs(sum - total) > 0.005 };
}

function tillDayLoad() {
  var gen = ++TD.gen;
  TD.fail = '';
  api('GET', '/till/day').then(function (r) {
    if (gen !== TD.gen) return;
    var d = r.status === 200 ? fromTillDay(r.data) : null;
    if (d) TD.data = d;
    else TD.fail = r.status === 200 ? 'Ответ сервера не разобран.' : said(r);
    if (current === 'tillDay') render();
  });
}

function tillCancel(i) {
  var row = TD.data && TD.data.rows[i];
  if (!row || row.undo || row.gone || TD.busy !== -1) return;
  TD.busy = i; TD.ask = -1; TD.deny = null;
  render();
  var gen = TD.gen;
  api('POST', '/till/' + row.id + '/cancel').then(function (r) {
    if (gen !== TD.gen) return;
    TD.busy = -1;
    var ok = r.status === 201 && !!r.data && r.data.cancels_id === row.id;
    // Отказ — словами сервера, над той строкой, у которой нажали.
    if (r.status !== 0 && r.status !== 201) { TD.deny = { i: i, text: said(r) }; haptic('warn'); render(); return; }
    // Отменено или неизвестно — день перечитывается в обоих случаях: что
    // строка отменена, говорит перечитанная книга, а не ответ на нажатие.
    if (ok) haptic('ok');
    else TD.deny = { i: i, text: (r.status === 0 ? 'Ответ сервера не дошёл. ' : 'Ответ сервера не разобран. ') +
                                 'Смотрите строку после перечитывания: «Отменено» стоит — отмена прошла.' };
    tillDayLoad();
    render();
  });
}

function tillDayRow(r, i) {
  var label = (r.undo ? 'Отмена · ' : '') + TD_KIND[r.kind];
  var when = r.time + ' · ' + r.how;
  var note = r.note ? '<span class="verbatim">' + esc(r.note) + '</span>' : '';
  var deny = TD.deny && TD.deny.i === i ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TD.deny.text) + '</span></div>' : '';
  if (r.gone) return deny + '<div class="card cancelled"><div class="row"><div class="col"><b class="strike">' + esc(label) + '</b>' +
    '<span class="small num">' + esc(when) + '</span></div><span class="pill gold">Отменено</span></div></div>';
  if (r.undo) return deny + '<div class="card quiet"><div class="row"><div class="col"><b>' + esc(label) + '</b>' +
    '<span class="small num">' + esc(when) + '</span></div><b class="num">−' + money(r.amount) + ' ฿</b></div></div>';
  var btn = TD.busy === i ? '<button type="button" class="btn quiet" disabled>…</button>'
    : TD.ask === i ? '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="td-keep">Не отменять</button>' +
                     '<button type="button" class="btn quiet" data-action="td-cancel:' + i + '">Точно отменить</button></span>'
    : '<button type="button" class="btn quiet" data-action="td-ask:' + i + '"' + (TD.busy !== -1 ? ' disabled' : '') + '>Отменить</button>';
  return deny + '<div class="card"><div class="row"><div class="col"><b>' + esc(label) + '</b><span class="small num">' + esc(when) + '</span>' + note + '</div>' +
    '<div style="display:flex;align-items:center;gap:10px"><b class="num">' + money(r.amount) + ' ฿</b>' + btn + '</div></div></div>';
}

function shiftBlock() {
  if (!BAR) return '';
  var btn = SHIFT_BUSY ? '<button type="button" class="btn quiet" disabled>…</button>'
    : BAR.open
      ? (!canCloseShift() ? ''
         : SHIFT_ASK
           ? '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="shift-keep">Не закрывать</button>' +
             '<button type="button" class="btn quiet" data-action="shift-close">Точно закрыть</button></span>'
           : '<button type="button" class="btn quiet" data-action="shift-ask">Закрыть смену</button>')
      : (canOpenShift() ? '<button type="button" class="btn mini" data-action="shift-open">Открыть смену на себя</button>' : '');
  return '<div class="card strong"><div class="row top">' +
      '<div class="col"><h2>Заказы на баре</h2>' +
        '<span class="small">' + (BAR.open ? 'Смена открыта' : 'Смена не открыта — гости не могут заказать') +
          (BAR_FAIL ? ' · не обновилось: ' + esc(BAR_FAIL) : '') + '</span></div>' +
      '<span class="pill' + (BAR.open ? ' on' : '') + '">' + (BAR.open ? 'открыт' : 'закрыт') + '</span>' +
    '</div>' +
    (SHIFT_ASK && BAR.open ? '<span class="small">Новые заказы перестанут приниматься. Заказы в работе останутся в очереди.</span>' : '') +
    (btn ? '<div class="row">' + (!BAR.open && !canOpenShift() ? '' : '<span></span>') + btn + '</div>'
         : !BAR.open ? '<span class="small">Смену открывает куратор направления.</span>' : '') +
  '</div>';
}

/* ── доход и расход бара ──────────────────────────────
   Пока заказы не идут через приложение, куратор вносит выручку и затраты
   руками. Сервер пускает куратора Бара и админа. Категорию, вид затраты и
   чем платили не подставляем: вид решает, сколько клуб возьмёт с чистой,
   и выбор по умолчанию был бы решением, которого человек не принимал.
   Списка записей с сервера нет — под формой только то, на что сервер
   ответил здесь и сейчас. Успех — 201 и строка, совпавшая с отправленной:
   201 с чужими полями — «неизвестно», иначе вторая запись тех же денег. */
var BOOK = { kind: '', amount: '', method: '', cat: '', ekind: '', paid: '', note: '', date: '',
             ask: false, busy: false, err: '', from: 'home', done: [] };
var BOOK_FAIL = '';
// «со счёта» сервер не принимает: остатка у направления нет, деньги посчитались бы дважды
var INCOME_HOW = [['cash', 'Наличные'], ['card', 'Карта']];
var EXP_CATS = ['закуп', 'расходники', 'зарплата', 'ремонт'];
// Словами человека, а не учёта: первую настоящую затрату (продукты) записали
// вложением — подпись «из доли направления» ничего не объясняла, а ошибка
// стоила партнёру денег.
var EXP_KINDS = [['opex', 'Текущая трата', 'продукты, расходники, зарплата, мелкий ремонт: уменьшает прибыль месяца'],
                 ['invest', 'Вложение', 'оборудование, ремонт помещения: не уменьшает прибыль, возвращается партнёру по плану возврата']];
var USUALLY_OPEX = ['закуп', 'расходники'];
var PAID_BY = [['club_till', 'Касса клуба'], ['bar_cash', 'Наличные бара'], ['partner', 'Свои']];

function pick(list, code) {
  for (var i = 0; i < list.length; i++) if (list[i][0] === code) return list[i];
  return null;
}
function mayBook() { return LIVE && (grant('admin') || grant('curator')); }
function canBook() { return mayBook() && !!BAR && (grant('admin') || grant('curator', BAR.id)); }

function bookLoad() {
  BOOK_FAIL = '';
  loadBar(function (err) {
    BOOK_FAIL = err;
    if (current === 'barMoney') render();
  });
}
/* Дата события (cafe13-api#28). Пусто — сегодня, и тогда `at` не уходит
   вовсе: «сегодня» решает сервер по часам клуба. Отправляется только дата,
   которую человек сменил сам. Границы (не из будущего, не старше 90 дней)
   проверяет сервер, его отказ показывается его словами. */
var BACKDATE_DAYS = 90;
function clubDay(iso) {                       // 'YYYY-MM-DD' по часам клуба
  var d = iso ? new Date(iso) : new Date();
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}
function daysBefore(day, n) {
  var d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function dayWords(day) {
  return new Date(day + 'T12:00:00Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
function bookGrab() {
  var a = document.getElementById('b-amount'), n = document.getElementById('b-note'), t = document.getElementById('b-date');
  if (a) BOOK.amount = a.value;
  if (n) BOOK.note = n.value;
  if (t) BOOK.date = /^\d{4}-\d{2}-\d{2}$/.test(t.value) && t.value !== clubDay() ? t.value : '';
}
function bookMissing() {
  if (topupAmount(BOOK.amount) === null) return 'Сумма — число больше нуля, например 240.';
  if (BOOK.kind === 'income') return BOOK.method ? '' : 'Выберите, чем заплатили.';
  var miss = [];
  if (!BOOK.cat) miss.push('категорию');
  if (!BOOK.ekind) miss.push('вид затраты');
  if (!BOOK.paid) miss.push('чем платили');
  return miss.length ? 'Выберите ' + miss.join(', ') + '.' : '';
}
function bookSend() {
  if (BOOK.busy || !canBook()) return;
  var amt = topupAmount(BOOK.amount);
  if (amt === null || bookMissing()) return;
  var inc = BOOK.kind === 'income', note = BOOK.note.trim();
  var body = inc ? { direction_id: BAR.id, amount: amt, method: BOOK.method, note: note }
                 : { direction_id: BAR.id, amount: amt, expense_cat: BOOK.cat, expense_kind: BOOK.ekind,
                     paid_by: BOOK.paid, note: note };
  if (BOOK.date) body.at = BOOK.date;
  BOOK.busy = true; BOOK.ask = false;
  render();
  api('POST', inc ? '/bar/income' : '/bar/expenses', body).then(function (r) {
    var d = r.data;
    var ok = r.status === 201 && !!d && typeof d.id === 'number' && num(d.amount) === amt && d.note === note &&
      (!body.at || clubDay(d.at) === body.at) &&
      (inc ? d.method === body.method
           : d.expense_cat === body.expense_cat && d.expense_kind === body.expense_kind && d.paid_by === body.paid_by);
    var detail = d && typeof d.detail === 'string' ? d.detail : '';
    var what = inc ? 'Доход' : 'Расход';
    BOOK.busy = false;
    if (ok) {
      BOOK.done.unshift({ inc: inc, amount: amt, at: body.at ? 'за ' + dayWords(clubDay(d.at)) : hm(d.at), note: note,
                          how: inc ? pick(INCOME_HOW, body.method)[1].toLowerCase()
                                   : body.expense_cat + ' · ' + pick(EXP_KINDS, body.expense_kind)[1].toLowerCase() +
                                     ' · ' + pick(PAID_BY, body.paid_by)[1].toLowerCase() });
      BOOK.amount = ''; BOOK.note = ''; BOOK.method = ''; BOOK.cat = ''; BOOK.ekind = ''; BOOK.paid = ''; BOOK.date = '';
      FLASH = { text: what + ' записан' + (body.at ? ' за ' + dayWords(body.at) : '') + ': ' + money(amt) + ' ฿',
                note: body.at ? 'В сегодняшнем отчёте его нет — он в отчёте того дня.' : '' };
      haptic('ok');
    } else if (r.status === 0 || r.status === 201) {
      FLASH = { text: 'Неизвестно, записано ли',
                note: (r.status === 0 ? 'Сервер не ответил. ' : 'Ответ сервера не разобран. ') +
                      'Не записывайте снова, пока не сверите: списка записей в приложении ещё нет — спросите администратора клуба.' };
      haptic('warn');
    } else {
      FLASH = { text: 'Не записано', note: detail ? detail[0].toUpperCase() + detail.slice(1) + '.' : failText(r) };
      haptic('warn');
    }
    if (current === 'barMoney') render();
  });
}

/* ── отчёт за день ─────────────────────────────────────
   GET /bar/day: заказы, ручной доход и затраты строками, открытая смена.
   Сутки — по Пхангану, границы приходят в ответе. Суммы сверяются со
   строками: итог, не сошедшийся со своими строками, — не отчёт, а отказ
   (показать его значило бы назвать человеку неверные деньги). */
var DAY = { data: null, fail: '', from: 'barMoney', gen: 0 };
function sumOf(rows) {
  return Math.round(rows.reduce(function (a, r) { return a + r.amount; }, 0) * 100) / 100;
}
function fromDay(d) {
  if (!d || typeof d !== 'object') return null;
  var start = new Date(d.day_start), end = new Date(d.day_end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  var n = {};
  var keys = ['served_total', 'cash_total', 'income_total', 'expense_total', 'expense_opex', 'expense_invest'];
  for (var i = 0; i < keys.length; i++) { n[keys[i]] = num(d[keys[i]]); if (!(n[keys[i]] >= 0)) return null; }
  if (!Array.isArray(d.income) || !Array.isArray(d.expenses) || !Array.isArray(d.positions)) return null;
  var income = [], expenses = [], positions = [];
  for (i = 0; i < d.income.length; i++) {
    var x = d.income[i];
    if (!x || typeof x.id !== 'number' || !(num(x.amount) > 0) || !pick(INCOME_HOW, x.method) || typeof x.note !== 'string') return null;
    income.push({ at: hm(x.at), amount: num(x.amount), how: pick(INCOME_HOW, x.method)[1].toLowerCase(), note: x.note });
  }
  for (i = 0; i < d.expenses.length; i++) {
    var e = d.expenses[i];
    if (!e || typeof e.id !== 'number' || !(num(e.amount) > 0) || EXP_CATS.indexOf(e.expense_cat) === -1 ||
        !pick(EXP_KINDS, e.expense_kind) || !pick(PAID_BY, e.paid_by) || typeof e.note !== 'string') return null;
    expenses.push({ at: hm(e.at), amount: num(e.amount), kind: e.expense_kind, note: e.note,
                    how: e.expense_cat + ' · ' + pick(EXP_KINDS, e.expense_kind)[1].toLowerCase() + ' · ' + pick(PAID_BY, e.paid_by)[1].toLowerCase() });
  }
  for (i = 0; i < d.positions.length; i++) {
    var q = d.positions[i];
    if (!q || typeof q.title !== 'string' || typeof q.qty !== 'number' || !(num(q.total) >= 0)) return null;
    positions.push([q.title, q.qty, num(q.total)]);
  }
  var opex = sumOf(expenses.filter(function (r) { return r.kind === 'opex'; }));
  var invest = sumOf(expenses.filter(function (r) { return r.kind === 'invest'; }));
  if (sumOf(income) !== n.income_total || sumOf(expenses) !== n.expense_total ||
      opex !== n.expense_opex || invest !== n.expense_invest || n.cash_total > n.served_total) return 'mismatch';
  var sh = d.open_shift;
  if (sh !== null && (!sh || isNaN(new Date(sh.opened_at).getTime()))) return null;
  return { date: start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bangkok' }),
           orders: n.served_total, cash: n.cash_total, manual: n.income_total,
           spend: n.expense_total, opex: n.expense_opex, invest: n.expense_invest,
           income: income, expenses: expenses, positions: positions,
           shift: sh ? hm(sh.opened_at) : null };
}
function loadDay() {
  var gen = ++DAY.gen;
  DAY.fail = '';
  var go_ = function () {
    api('GET', '/bar/day?direction_id=' + BAR.id).then(function (r) {
      if (gen !== DAY.gen) return;
      var d = r.status === 200 ? fromDay(r.data) : null;
      var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
      if (d && d !== 'mismatch') DAY.data = d;
      else DAY.fail = d === 'mismatch' ? 'Суммы отчёта не сходятся со строками — показывать их нельзя. Сообщите администратору клуба.'
                    : r.status === 403 ? 'Отчёт за день видит куратор направления.'
                    : detail ? detail[0].toUpperCase() + detail.slice(1) + '.' : failText(r);
      if (current === 'barDay') render();
    });
  };
  if (BAR) { go_(); return; }
  /* Гард ниже недостижим (мутация на него зелёная, 22.10.2026, Cafe13KPG#214):
     loadDay() зовётся только под LIVE, а живые входы в отчёт — barQueue и
     barMoney — рисуют кнопку лишь при загруженном BAR. Входов с кнопкой четыре:
     два других — демо barQueue и экран куратора, у которого живой ветки нет.
     ОЖИВЁТ, когда экран куратора станет живым: он рисует «Отчёт за день» без
     опоры на BAR. Тогда — случай на этот гард; до того на него не опираться. */
  loadBar(function (err) {
    if (gen !== DAY.gen) return;
    if (err) { DAY.fail = err; if (current === 'barDay') render(); return; }
    go_();
  });
}
function liveDay() {
  if (!DAY.data) return (FLASH ? flash() : '') +
    (DAY.fail ? '<div class="card quiet"><span class="small">' + esc(DAY.fail) + '</span></div>' +
                '<button type="button" class="btn ghost" data-action="day-reload">Повторить</button>'
              : '<div class="card quiet"><span class="small">Загружаем отчёт…</span></div>');
  var d = DAY.data;
  var line = function (x, sign) {
    return '<div class="card"><div class="row top"><div class="col"><b>' + esc(x.note || 'без комментария') + '</b>' +
      '<span class="small">' + esc(x.how) + (x.at ? ' · ' + esc(x.at) : '') + '</span></div>' +
      '<b class="num">' + sign + money(x.amount) + ' ฿</b></div></div>';
  };
  return (FLASH ? flash() : '') +
    '<div class="card strong"><div class="row top"><div class="col"><h2>Сегодня, ' + esc(d.date) + '</h2>' +
      '<span class="small">' + (d.shift ? 'Смена открыта с ' + esc(d.shift) : 'Смена не открыта') + ' · сутки по Пхангану</span></div></div></div>' +
    (DAY.fail ? '<div class="card quiet"><span class="small">Не обновилось: ' + esc(DAY.fail) + '</span></div>' : '') +
    '<div class="group"><span class="label">Доход</span><div class="rows">' +
      '<div><span>Всего</span><b class="num">' + money(d.orders + d.manual) + ' ฿</b></div>' +
      '<div><span class="small">Внесено руками</span><b class="num">' + money(d.manual) + ' ฿</b></div>' +
      '<div><span class="small">Заказы в приложении</span><b class="num">' + money(d.orders) + ' ฿</b></div>' +
      '<div><span class="small">из них наличными</span><b class="num">' + money(d.cash) + ' ฿</b></div>' +
    '</div></div>' +
    (d.income.length ? '<div class="group"><span class="label">Внесено руками</span>' + d.income.map(function (x) { return line(x, ''); }).join('') + '</div>' : '') +
    '<div class="group"><span class="label">Расход</span><div class="rows">' +
      '<div><span>Всего</span><b class="num">' + money(d.spend) + ' ฿</b></div>' +
      '<div><span class="small">Текущие — вычитаются до доли клуба</span><b class="num">' + money(d.opex) + ' ฿</b></div>' +
      '<div><span class="small">Вложения — из доли направления</span><b class="num">' + money(d.invest) + ' ฿</b></div>' +
    '</div></div>' +
    (d.expenses.length ? '<div class="group"><span class="label">Затраты</span>' + d.expenses.map(function (x) { return line(x, '−'); }).join('') + '</div>' : '') +
    (d.positions.length ? '<div class="group"><span class="label">Что заказывали в приложении</span><div class="rows">' +
      d.positions.map(function (t) {
        return '<div><span>' + esc(t[0]) + '<span class="small"> · ' + t[1] + ' ' + plural(t[1], ['штука', 'штуки', 'штук']) + '</span></span>' +
          '<b class="num">' + money(t[2]) + ' ฿</b></div>';
      }).join('') + '</div></div>' : '') +
    (canBook() ? '<button type="button" class="btn ghost" data-go="barMoney">Внести доход или расход</button>' : '') +
    '<button type="button" class="btn quiet" data-action="day-reload">Обновить</button>' +
    '<div class="note">' + svg(ICON.info) +
      '<span>Ошибочную запись отменяет администратор клуба — отменённое в отчёт не входит.</span></div>';
}

function setState(oid, state) {
  if (STATE_BUSY[oid]) return;
  STATE_BUSY[oid] = true;
  CANCEL_ASK = null;
  render();
  api('POST', '/bar/orders/' + oid + '/state', { state: state }).then(function (r) {
    delete STATE_BUSY[oid];
    // Из ответа берём только состояние: всё остальное — не дело работника.
    if (r.status === 200 && r.data && r.data.state === state) {
      (QUEUE || []).forEach(function (o) { if (o.oid === oid) o.state = state; });
      haptic('ok');
    } else {
      haptic('warn');
      var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
      FLASH = { text: 'Не изменилось',
                note: detail ? detail[0].toUpperCase() + detail.slice(1) + '.' : failText(r) };
    }
    loadQueue();
  });
}

function loadBarMenu() {
  var who = WHO;
  api('GET', '/bar/menu?direction_id=' + BAR.id).then(function (r) {
    if (who !== WHO) return;
    var m = r.status === 200 ? fromMenu(r.data) : null;
    if (m) { DATA.bar.menu = m; MENU_STATE = 'ok'; }
    else { DATA.bar.menu = []; MENU_STATE = failText(r); }
    if (current === 'bar' || current === 'drink') render();
  });
}

function hm(iso) {
  var d = new Date(iso);
  return isNaN(d.getTime()) ? '' :
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
}

/* Заказ с сервера → то, что рисует экран заказа. Состав приходит либо из
   ответа /bar/orders (items), либо из того, что гость сам нажал. */
/* Всё — из ответа сервера, а не из эха своего запроса: записанное сервером
   и отправленное однажды разойдутся. Без места или оплаты — отказ: «подадут
   undefined» хуже, чем «не разобрано». Суммы может не быть в строке: чужой
   заказ работнику сервер отдаёт без неё (правило построчное). */
var PLACES = { 'за стойку': 1, 'к столу': 1, 'с собой': 1 };
function fromOrder(d, items) {
  if (!d || typeof d.id !== 'number' || typeof d.number !== 'string' || !OSTATE[d.state]) return null;
  if (d.sum !== undefined && !(num(d.sum) >= 0)) return null;
  var list = items || (Array.isArray(d.items) ? d.items.map(function (i) { return [i.title, i.qty]; }) : null);
  if (!list || !PLACES[d.place] || (d.pay_method !== 'account' && d.pay_method !== 'cash')) return null;
  return { id: d.number, oid: d.id, at: hm(d.created_at), where: d.place,
           pay: d.pay_method === 'cash' ? 'наличными' : 'со счёта',
           sum: d.sum === undefined ? null : num(d.sum), state: d.state, items: list };
}

/* Отказ «Купить» — состояние корзины, а не экран (макет E23б): плашка над
   кнопкой, текст сервера как есть, выбор человека не теряется. Отказ при
   покупке в одно нажатие из меню переносит позицию в корзину — там видно
   и причину, и что именно не купилось. */
var DENY = '';
function denyInCart(items, text) {
  DENY = text;
  if (current !== 'barCart') {
    CART = {};
    items.forEach(function (x) { CART[x.id] = x.n; });
    go('barCart');
  } else render();
}

function placeOrder(items, place, pay) {
  if (BUSY) return;
  if (!BAR || !BAR.open) {
    haptic('warn');
    denyInCart(items, 'Бар закрыт: смена не открыта — заказ не отправлен.');
    return;
  }
  DENY = '';
  BUSY = true;
  render();
  api('POST', '/bar/orders', {
    direction_id: BAR.id, place: place, pay_method: pay,
    items: items.map(function (x) { return { product_id: x.pid, qty: x.n }; })
  }).then(function (r) {
    BUSY = false;
    var o = r.status === 201 ? fromOrder(r.data, items.map(function (x) { return [x.title, x.n]; })) : null;
    if (o) {
      DATA.bar.mine = o;
      CART = {};
      haptic('ok');
      FLASH = null;
      refreshMe();
      go('barOrder');
      return;
    }
    haptic('warn');
    var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
    if (r.status === 0 || r.status === 201) {
      // Ответ мог потеряться ПОСЛЕ того, как заказ создан, или прийти неразобранным:
      // объявить заказ несозданным — значит подтолкнуть ко второму. Спрашиваем сервер.
      FLASH = r.status === 0
        ? { text: 'Связь оборвалась', note: 'Неизвестно, дошёл ли заказ. Ниже — то, что знает сервер; прежде чем заказывать снова, проверьте.' }
        : { text: 'Заказ принят, но ответ не разобран', note: 'Ниже — то, что знает сервер.' };
      DATA.bar.mine = null;
      go('barOrder');
      return;
    }
    // нехватка — баланс мог устареть; закрытый бар и снятая позиция — меню и смена
    if (/^на счёте/.test(detail)) refreshMe();
    if (r.status === 409) loadMenu();
    denyInCart(items, detail || 'Заказ не отправлен: сервер ответил кодом ' + r.status + '.');
  });
}

function buy(id) {
  var d = findDrink(id);
  if (!d) return;
  placeOrder([{ id: d.id, pid: d.pid, title: d.title, n: 1 }], 'за стойку', 'account');
}

/* Состояние заказа гость видит у себя: пока заказ не выдан, раз в 8 секунд
   спрашиваем сервер. Уходит с экрана — опрос прекращается. */
var POLL_GEN = 0;
function pollMine() {
  if (POLL) { clearTimeout(POLL); POLL = null; }
  if (!LIVE || current !== 'barOrder' || !BAR) return;
  var gen = ++POLL_GEN;              // запрос старой цепочки, вернувшийся позже, молчит
  api('GET', '/bar/orders?direction_id=' + BAR.id).then(function (r) {
    /* Половина `current !== 'barOrder'` недостижима (мутация зелёная, 22.10.2026):
       current пишет только go(), а go() на входе в barOrder зовёт pollMine и
       поднимает POLL_GEN — поздний ответ ловит вторая половина; MINE_FAIL и
       DATA.bar.mine рисуются только на barOrder; switchTo гасит таймер и
       поднимает POLL_GEN. ОЖИВЁТ, если: в barOrder войдут мимо go() (или go
       перестанет звать pollMine); свой заказ начнут рисовать на другом экране
       (плашка «заказ готов» в шапке, на вкладке «Бар»); pollMine перестанет
       поднимать POLL_GEN на входе. Тогда — случай на неё. */
    if (current !== 'barOrder' || gen !== POLL_GEN) return;
    if (r.status === 200 && Array.isArray(r.data)) {
      var mine = DATA.bar.mine;
      // Админу и бару сервер отдаёт всю очередь — свой заказ ищем по своему id,
      // иначе после обрыва связи гость увидел бы чужой заказ как свой.
      var own = r.data.filter(function (x) { return x && x.member_id === DATA.member.uid; });
      var row = mine ? own.filter(function (x) { return x.id === mine.oid; })[0]
                     : own.filter(function (x) { return x.state !== 'served' && x.state !== 'cancelled'; })[0];
      var o = row ? fromOrder(row) : null;
      if (o) DATA.bar.mine = o;
      MINE_FAIL = '';
    } else {
      MINE_FAIL = r.status === 0 ? 'Сервер не ответил — состояние может быть устаревшим.'
                : 'Сервер ответил кодом ' + r.status + ' — состояние может быть устаревшим.';
    }
    render();
    var st = DATA.bar.mine && DATA.bar.mine.state;
    if (st !== 'served' && st !== 'cancelled') POLL = setTimeout(pollMine, 8000);
    if (st === 'cancelled') refreshMe();        // возврат уже в книге — показать настоящий баланс
  });
}
var MINE_FAIL = '';

function refreshMe() {
  api('GET', '/me').then(function (r) {
    var me = r.status === 200 ? fromMe(r.data) : null;
    if (me) { DATA.member.balance = me.member.balance; if ({ bar: 1, topup: 1, barOrder: 1, barCart: 1, drink: 1 }[current]) render(); }
  });
}

/* ── тестовый режим и просмотр чужими глазами ─────────
   Только у богов (солнышко). X-Test-Mode: 1 — запрос обслуживает тестовая
   база: нажимать можно всё, настоящих денег там нет. X-Act-As: id — ответ
   собирается так, как его увидел бы этот человек; без тестового режима
   сервер его отвергает. Кто сейчас на экране и что база тестовая, видно
   полосой над каждым экраном — иначе запись глазами куратора легко
   принять за настоящую.
   Право на солнышко — по СВОИМ ролям (SELF), а не по ролям того, чьими
   глазами смотрим: иначе из просмотра куратора не вернуться. */
var TEST = { on: false, as: null, people: null, fail: '', health: '', busy: false };
var SELF = [];

function personWords(p) {
  var roles = (p.roles || []).map(function (r) {
    // cafe13-api#24: {role, direction_id, direction}; до него — строка
    if (typeof r === 'string') return ROLE_NAME[r] || r;
    return (ROLE_NAME[r.role] || r.role) + (r.direction ? ' · ' + r.direction : '');
  }).filter(function (n, i, all) { return all.indexOf(n) === i; });
  return roles.length ? roles.join(', ') : 'без ролей';
}
function fromPeople(d) {
  if (!d || d.base !== 'test' || !Array.isArray(d.people)) return null;   // список не из тестовой базы — не список
  for (var i = 0; i < d.people.length; i++) {
    var p = d.people[i];
    if (!p || typeof p.tg_user_id !== 'number' || typeof p.first_name !== 'string' || !Array.isArray(p.roles)) return null;
  }
  return d.people.map(function (p) {
    return { id: p.tg_user_id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Без имени', what: personWords(p) };
  });
}
function loadHealth() {
  TEST.health = 'loading';
  api('GET', '/health').then(function (r) {
    var t = r.status === 200 && r.data ? r.data.test_db : undefined;
    TEST.health = t === 'configured' || t === 'unset' ? t : failText(r);
    if (current === 'demo') render();
  });
}
function loadPeople() {
  TEST.people = null; TEST.fail = '';
  api('GET', '/act-as/people').then(function (r) {
    var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
    var ppl = r.status === 200 ? fromPeople(r.data) : null;
    if (ppl) TEST.people = ppl;
    else TEST.fail = r.status === 403 ? 'Вам просмотр не положен' + (detail ? ': ' + detail + '.' : '.')
                   : r.status === 503 ? 'Тестовая база не подключена.'
                   : failText(r);
    if (current === 'demo') render();
  });
}
/* Смена того, кто на экране: перечитать /me с новыми заголовками и сбросить
   всё, что было собрано для прежнего. Не вышло — остаёмся, кем были:
   экран прежнего человека под плашкой нового — худшее, что тут может быть. */
function switchTo(on, as) {
  if (TEST.busy) return;
  var was = { on: TEST.on, as: TEST.as };
  TEST.busy = true; TEST.on = on; TEST.as = as;
  render();
  api('GET', '/me').then(function (r) {
    TEST.busy = false;
    var me = r.status === 200 ? fromMe(r.data) : null;
    if (!me) {
      var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
      TEST.on = was.on; TEST.as = was.as;
      if (!was.on && on === false) { FAIL = failText(r); FAIL_NET = r.status === 0; go('apiDown'); return; }
      FLASH = { text: 'Не переключилось', note: detail ? detail[0].toUpperCase() + detail.slice(1) + '.' : failText(r) };
      haptic('warn'); render(); return;
    }
    if (QUEUE_POLL) { clearTimeout(QUEUE_POLL); QUEUE_POLL = null; }
    if (POLL) { clearTimeout(POLL); POLL = null; }
    QUEUE_GEN++; POLL_GEN++; WHO++;
    BAR = null; BAR_FAIL = ''; MENU_STATE = ''; QUEUE = null; QUEUE_FAIL = ''; MINE_FAIL = '';
    PASS = null; PASS_FAIL = ''; CART = {}; DATA.bar.mine = null;
    BOOK.done = []; BOOK.kind = ''; BOOK.ask = false;
    DAY.data = null; DAY.fail = ''; DAY.gen++;
    TOPUP.amount = ''; TOPUP.ask = false;
    tillReset();
    peopleReset(); PEOPLE.list = null; PEOPLE.fail = ''; PEOPLE.gen++;
    cardReset(); CARDS.list = null; CARDS.fail = ''; CARDS.gen++;
    if (!on) TEST.people = null;
    applyMe(me);
    haptic('ok');
    go(startScreen());
  });
}
function testStrip() {
  if (!LIVE || !TEST.on) return '';
  return '<div class="test-strip"><span class="col"><b>Тестовая база</b><span class="small">' +
    (TEST.as ? 'Смотрите как ' + esc(TEST.as.name) + ' · ' + esc(TEST.as.what) : 'Вы сами') +
    ' · деньги ненастоящие</span></span>' +
    (TEST.busy ? '' : TEST.as ? '<button type="button" class="btn mini" data-action="test-self">Выйти из просмотра</button>'
                              : '<button type="button" class="btn mini" data-action="test-off">Выйти из теста</button>') +
  '</div>';
}

/* ── люди и ответственность ────────────────────────────  #177
   Единственный экран, который раздаёт права, — поэтому вход в него только у
   главы клуба и админа, и решает это сервер: GET /people отвечает остальным
   403, а экран показывает его текст. Перечень ролей — из NewRole.role
   (cafe13-api app/routers/roles.py), а не из письма. Направление нужно ровно
   у curator и bar — это CHECK базы (002_directions.up.sql:36): остальным его
   не предлагаем, а этим двум без него «Выдать» не нажимается.
   ⚠ В ответе /people есть tg_user_id живых людей: он живёт только в памяти
   страницы — ни в разметке (карточки и кнопки знают номер строки списка, а не
   id), ни в localStorage, ни в снимках. Своей таблицы людей у клиента нет.
   Успех — сама перечитанная карточка и строка-заметка в ней, а не плашка
   сверху: изменение видно там, где оно произошло.
   Отказы 403 и 409 показываются текстом сервера: «последнего главу не снять»
   и «админа выдаёт только админ» — правила сервера, пересказ завёл бы копию. */
// Что выдаётся ОТСЮДА. «Главы клуба» здесь нет НИКОГДА (слово владельца 28.10.2026: не выдаётся
// из приложения); «Администратор» и «Чужими глазами» — в ROLE_GREY: видны СЕРЫМИ, не выдаются.
var ROLE_PICK = ['ops_director', 'art_director', 'director', 'staff', 'curator', 'bar'];
var ROLE_GREY = [['god_mentor', 'Чужими глазами'], ['admin', 'Администратор']];
// head, god_mentor и admin на карточке — ОДИН бейдж «Глава клуба» без крестика (слово владельца
// 28.10.2026, кадр E47z `.chip.fixed`). Общий ROLE_NAME не трогается: им живёт кабинет.
var HEAD_ROLES = ['head', 'god_mentor', 'admin'];
var DIR_ROLES = ['curator', 'bar'];
var PEOPLE = { list: null, fail: '', dirs: null, dirsFail: '', gen: 0,
               open: null, role: '', give: null, ask: null, busy: false, deny: null, done: null, find: '',
               out: null, gone: null, askAt: 0, askTimer: null, askTick: null, sending: null, land: null };
/* Окно отмены вместо второго подтверждения (слово владельца 28.10.2026: «убери двойное
   подтверждение… оставь кнопку отмены на несколько секунд»; 5 секунд — число координатора,
   кадр E47l). Цифра в полосе считается ОТСЮДА ЖЕ — разойтись с задержкой ей нечем. */
var UNDO_MS = 5000;
function undoStop() {
  if (PEOPLE.askTimer) clearTimeout(PEOPLE.askTimer);
  if (PEOPLE.askTick) clearInterval(PEOPLE.askTick);
  PEOPLE.askTimer = PEOPLE.askTick = null;
}
function undoLeft() { return Math.max(0, Math.ceil((PEOPLE.askAt + UNDO_MS - Date.now()) / 1000)); }
function undoStart(rid) {
  undoStop();
  PEOPLE.ask = rid; PEOPLE.askAt = Date.now(); PEOPLE.deny = null;
  PEOPLE.askTimer = setTimeout(function () {
    if (PEOPLE.ask !== rid) return;
    undoStop(); PEOPLE.ask = null;
    // окно вышло — ровно один запрос, через общий вход действий: там защита от двойного нажатия
    // и демонстрация (в ней снятие не уходит). Ушли с экрана до конца окна — не уходит тоже.
    doAction('p-revoke:' + rid);
  }, UNDO_MS);
  // отсчёт меняет только цифру, экран не перерисовывается
  PEOPLE.askTick = setInterval(function () {
    var el = document.querySelector('.undo .sec');
    if (el) el.textContent = String(undoLeft());
  }, 250);
}

function mayPeople() { return LIVE && (grant('head') || grant('admin')); }
/* Блокировка снимается вместе с состоянием экрана: вход на экран и смена роли
   поднимают PEOPLE.gen, и ответ, который снял бы её сам, отбрасывается гардом —
   без этой строки экран оставался запертым до перезапуска (Cafe13KPG#213). */
function peopleReset() {
  PEOPLE.busy = false;
  PEOPLE.open = null; PEOPLE.role = ''; PEOPLE.give = null; PEOPLE.ask = null; PEOPLE.deny = null; PEOPLE.done = null;
  PEOPLE.out = null; PEOPLE.gone = null;
  // окно отмены, открытое на прежнем заходе, закрывается БЕЗ отправки: снятие не случается само
  undoStop();
  // и погашенная надпись прежнего захода гаснуть перестаёт: ответ на тот запрос отброшен гардом,
  // и без этой строки надпись оставалась погашенной и не нажималась до перезапуска (people-late-revoke)
  PEOPLE.sending = null;
  // ⚠ И занятость СТРОКИ выдачи (PEOPLE.give) — там же и по той же причине: ключ её не id
  // (роли ещё нет, её только собираются выдать), а пара «роль + направление», и без сброса
  // «Выдаём…» осталось бы в строке прежнего захода — ровно то, что уже случалось с надписью
  // снятия. Ключ стоит в строке выше, в общем присваивании.
  PEOPLE.land = null;
}
/* Встать на карточку того, по кому нажали (слово владельца 28.10.2026, Cafe13KPG#502 п.1).
   После выдачи, снятия и исключения список перечитывается, и на время загрузки страница
   короче экрана: прокрутка прижимается к нулю, и возврат «где было» (render) возвращал уже
   прижатое место. Поэтому место берётся не числом пикселей, а ЧЕЛОВЕКОМ — по tg_user_id в
   памяти: строка его в новом списке может стоять иначе (живые членства наверх). */
function peopleLand() {
  var uid = PEOPLE.land, L = PEOPLE.list;
  PEOPLE.land = null;
  if (uid === null || !L) return;
  for (var k = 0; k < L.length; k++) if (L[k].uid === uid) {
    var el = document.querySelector('[data-person="' + k + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
    return;
  }
}
function roleWords(role, dirTitle) { return (ROLE_NAME[role] || role) + (dirTitle ? ' · ' + dirTitle : ''); }

/* Один битый человек — отказ целиком: список с пропавшей строкой выглядит полным. */
function fromRoster(d) {
  if (!d || !Array.isArray(d.people)) return null;
  var out = [];
  for (var i = 0; i < d.people.length; i++) {
    var p = d.people[i];
    if (!p || typeof p.tg_user_id !== 'number' || typeof p.first_name !== 'string' ||
        !Array.isArray(p.roles) || !Array.isArray(p.memberships)) return null;
    var roles = [];
    for (var j = 0; j < p.roles.length; j++) {
      var r = p.roles[j];
      if (!r || typeof r.id !== 'number' || typeof r.role !== 'string') return null;
      var dt = typeof r.direction === 'string' ? r.direction : '';
      roles.push({ id: r.id, role: r.role, dir: typeof r.direction_id === 'number' ? r.direction_id : null,
                   name: ROLE_NAME[r.role] || r.role, dirTitle: dt, words: roleWords(r.role, dt) });
    }
    // Остаток (требование владельца 28.10.2026, кадры E47/E47e): поля НЕТ — «не спросили»,
    // undefined; поле есть, но не число — ответ битый целиком. Признак — наличие ключа, а не
    // `!p.balance`: у настоящего нуля остаток тоже ложный. null сервер не отдаёт (ноль ставит сам).
    var bal;
    if ('balance' in p) { bal = num(p.balance); if (!isFinite(bal)) return null; }
    out.push({
      uid: p.tg_user_id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Без имени',
      // уровни через « · », в порядке сервера: виды не старше друг друга (кадр E47)
      levels: p.memberships.map(function (l) { return LEVEL[l] || l; }).join(' · '),
      lv: p.memberships.map(function (l) { return LEVEL[l] || l; }),
      bal: bal,
      roles: roles
    });
  }
  return out;
}
/* Живые членства — наверх (решение по #413), внутри групп порядок сервера. Сортируется
   ПОРЯДОК ОТРИСОВКИ, а не список: карточка знает номер строки в ответе (k), и все действия
   (p-open:k, data-person) указывают на того же человека, как бы строки ни стояли. */
function peopleOrder(list) {
  return list.map(function (x, i) { return i; })
    .sort(function (a, b) { return (!list[a].levels - !list[b].levels) || a - b; });
}
function fromDirList(d) {
  if (!Array.isArray(d)) return null;
  for (var i = 0; i < d.length; i++)
    if (!d[i] || typeof d[i].id !== 'number' || typeof d[i].title !== 'string' || typeof d[i].is_active !== 'boolean') return null;
  return d.filter(function (x) { return x.is_active; }).map(function (x) { return { id: x.id, title: x.title }; });
}
function denyText(r) {
  var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  // 201 с чужим телом — тоже «не разобран», а не «ответил кодом 201»: код успеха отказом не назвать
  return detail ? cap(detail) + '.' : r.status === 422 ? 'Сервер не принял запрос (код 422).'
       : r.status >= 200 && r.status < 300 ? 'Ответ сервера не разобран.' : failText(r);
}
function loadRoster() {
  var gen = ++PEOPLE.gen;
  PEOPLE.list = null; PEOPLE.fail = '';
  api('GET', '/people').then(function (r) {
    if (gen !== PEOPLE.gen) return;
    var list = r.status === 200 ? fromRoster(r.data) : null;
    if (list) PEOPLE.list = list;
    else PEOPLE.fail = r.status === 403 ? denyText(r) : failText(r);
    if (current === 'people') { render(); peopleLand(); }
  });
  if (PEOPLE.dirs) return;
  api('GET', '/directions').then(function (r) {
    if (gen !== PEOPLE.gen) return;
    var dirs = r.status === 200 ? fromDirList(r.data) : null;
    PEOPLE.dirs = dirs; PEOPLE.dirsFail = dirs ? '' : failText(r);
    if (current === 'people') render();
  });
}
/* `grantMissing()` снят ЦЕЛИКОМ (#502 п.4), а не наполовину. Обе его причины стали
   недостижимы: «что поручить» задаёт сама строка, направление — строка направления под ней.
   Оставленная проверка, которая не умеет покраснеть, — это третий смысл зелёного («условие
   в прогоне не возникает»), и он дороже снятых строк. Текст «Выберите направление.» остался
   ПОДПИСЬЮ раскрытой роли: его держат два случая батареи. */
function holds(p, role, dir) {
  return p.roles.some(function (r) { return r.role === role && (dir === undefined || r.dir === dir); });
}
/* Роль и направление приходят ИЗ СТРОКИ, по которой нажали, а не из состояния экрана:
   выбранного больше нет вовсе (#502 п.4). Ключ занятости — та же пара, им «Выдаём…» встаёт
   в слот кружка ТОЙ строки, а остальные кружки не гаснут (слово designer-55). */
function giveKey(role, dirId) { return dirId === null ? role : role + ':' + dirId; }
function grantSend(role, dirId) {
  var p = PEOPLE.list && PEOPLE.list[PEOPLE.open];
  var dirRole = DIR_ROLES.indexOf(role) !== -1;
  if (!p || PEOPLE.busy || ROLE_PICK.indexOf(role) === -1) return;
  // Роль направления БЕЗ направления и общая роль С направлением не отправляются: первое
  // сервер отвергнет проверкой базы, второе он примет — но не тем, о чём просили.
  if (dirRole !== (dirId !== null)) return;
  var body = { member_id: p.uid, role: role };
  var dir = null;
  if (dirRole) {
    body.direction_id = dirId;
    dir = (PEOPLE.dirs || []).filter(function (x) { return x.id === dirId; })[0];
  }
  var gen = PEOPLE.gen;
  PEOPLE.busy = true; PEOPLE.deny = null; PEOPLE.give = giveKey(role, dirId); render();
  api('POST', '/roles', body).then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false; PEOPLE.give = null;
    var ok = r.status === 201 && r.data && r.data.member_id === p.uid && r.data.role === body.role;
    if (!ok) { PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn'); render(); return; }
    haptic('ok');
    peopleReset();
    PEOPLE.land = p.uid;
    PEOPLE.done = { uid: p.uid, text: 'Выдано: ' + roleWords(body.role, dir ? dir.title : '') + '. Кто выдал и когда — записано на сервере.' };
    loadRoster(); render();
  });
}
function revokeSend(rid) {
  var p = (PEOPLE.list || []).filter(function (x) { return x.roles.some(function (y) { return y.id === rid; }); })[0];
  if (!p || PEOPLE.busy) return;
  var role = p.roles.filter(function (y) { return y.id === rid; })[0];
  var gen = PEOPLE.gen;
  // отправка закрывает окно отмены сама — кто бы её ни позвал
  undoStop(); PEOPLE.ask = null;
  PEOPLE.busy = true; PEOPLE.deny = null; PEOPLE.sending = rid; render();
  api('POST', '/roles/' + rid + '/revoke').then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false; PEOPLE.ask = null; PEOPLE.sending = null;
    var ok = r.status === 200 && r.data && r.data.id === rid && !!r.data.revoked_at;
    if (!ok) { PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn'); render(); return; }
    haptic('ok');
    peopleReset();
    PEOPLE.land = p.uid;
    PEOPLE.done = { uid: p.uid, text: 'Снято: ' + role.words + '. Снятая роль остаётся в истории на сервере.' };
    loadRoster(); render();
  });
}
/* «Исключить» (кадры E47v, E47d, E47g, E47zh; Cafe13KPG#413, v74). Человек берётся по НОМЕРУ
   СТРОКИ ОТВЕТА (k), а не по месту карточки на экране: порядок отрисовки свой (peopleOrder),
   и «исключили не того» стоило бы человеку входа и членства. tg_user_id живёт только в адресе
   запроса — в разметку не попадает. Итог выбирается по `memberships_ended` из ответа, не догадкой.
   Слова без рода («больше не в клубе», «живого членства нет»): пола человека клиент не знает. */
function outSend(k) {
  var p = PEOPLE.list && PEOPLE.list[k];
  if (!p || PEOPLE.busy) return;
  var gen = PEOPLE.gen;
  PEOPLE.busy = true; PEOPLE.deny = null; render();
  api('POST', '/access/' + p.uid + '/revoke', { note: '' }).then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false; PEOPLE.out = null;
    var ok = r.status === 200 && r.data && typeof r.data.memberships_ended === 'number';
    if (!ok) {
      PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn');
      // «этого человека в клубе нет» — список устарел: его исключил кто-то другой (E47d)
      if (r.status === 409) { PEOPLE.land = p.uid; loadRoster(); }
      render(); return;
    }
    haptic('ok');
    peopleReset();
    PEOPLE.land = p.uid;
    PEOPLE.gone = { uid: p.uid, text: r.data.memberships_ended > 0
      ? p.name + ' больше не в клубе. Вход закрыт, живое членство оборвано сегодняшним днём.'
      : p.name + ' больше не в клубе. Вход закрыт; живых членств не было — обрывать было нечего.' };
    loadRoster(); render();
  });
}
/* Карточка знает номер строки списка (k), а не tg_user_id: id в разметке
   уехал бы в снимок экрана и дальше. */
function personCard(p, k) {
  var lock = PEOPLE.busy ? ' disabled' : '';
  var open = PEOPLE.open === k;
  var X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // Кадры E47z/E47k/E47l: доступ — надпись-кнопка («размер оставить»), крестик снимает без вопроса.
  // Уровень членства — чип БЕЗ крестика и не нажимается НАРОЧНО: ручка снятия уровня
  // (POST /memberships/{tg_user_id}/revoke, api `join.py`) в стволе api ЕСТЬ, а на бою её нет
  // (замер по блобам 29.10.2026). Кнопка не обещает того, чего сервер не делает; крестик
  // приедет с v86, когда ручку выложат (номер по карте #324 на 29.10.2026; был назван v84). Уровень она берёт СЛОВОМ в теле, то есть обрывает
  // ровно одно живое членство названного вида — обратного хода нет, срок не сохраняется.
  //
  // ДВА РЯДА, а не один (слово владельца 29.10.2026, Cafe13KPG#502 п.2): «разделим 2 уровня —
  // клубный доступ (глава клуба, член клуба, партнер, мастер) и ответственность (арт директор,
  // работник…); клубный доступ первой строчкой и одной, ответственность со второй». Раскол
  // ложится на уже существующие наборы, а не на новое правило: доступ — это `p.lv` (виды
  // членства) плюс бейдж по HEAD_ROLES, ответственность — все прочие роли и вход «+».
  // ⚠ Ряд доступа у человека без членства и без главенства ПУСТ, и тогда его не рисуем вовсе:
  // пустой `.chips` даёт свой `gap` и лишний отступ там, где смотреть не на что.
  var dostup = p.lv.map(function (l) { return '<span class="chip paid fixed">' + esc(l) + '</span>'; }).join('') +
    (p.roles.some(function (r) { return HEAD_ROLES.indexOf(r.role) !== -1; }) ? '<span class="chip fixed">Глава клуба</span>' : '');
  var rows = (dostup ? '<div class="chips" data-chips="access">' + dostup + '</div>' : '') +
    '<div class="chips" data-chips="duty">' +
    p.roles.filter(function (r) { return HEAD_ROLES.indexOf(r.role) === -1; }).map(function (r) {
      if (PEOPLE.ask === r.id) return '';                  // в окне отмены надписи нет (E47l)
      if (PEOPLE.sending === r.id) return '<span class="chip busy">' + esc(r.words) + X + '</span>';  // E47k
      return '<button type="button" class="chip" data-action="p-ask:' + r.id + '"' + lock + '>' + esc(r.words) + X + '</button>';
    }).join('') +
    // ⚠ Вход «+ ответственность» остаётся ВИДИМЫМ и при раскрытой форме (так он стоит в кадре
    // E47s), и в этом состоянии он её СКЛАДЫВАЕТ. Это не украшение: нижний ряд с кнопкой
    // «Отмена» снят вместе с «Выдать», и без этого закрыть раскрытую форму стало бы нечем —
    // увидел только отрисовкой, разметка молчала.
    '<button type="button" class="chip add" data-action="' + (open ? 'p-close' : 'p-open:' + k) + '"' +
      ' aria-expanded="' + (open ? 'true' : 'false') + '"' + lock + '>' +
      '<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>ответственность</button>' +
  '</div>';
  var askRole = null;
  p.roles.forEach(function (r) { if (PEOPLE.ask === r.id) askRole = r; });
  var undo = askRole ? '<div class="undo" data-undo-of="' + k + '"><span class="small">Снимаем: ' + esc(askRole.words) + '</span>' +
    '<span class="sec">' + undoLeft() + '</span><button type="button" data-action="p-keep">Отменить</button></div>' : '';
  var form = '';
  if (open) {
    /* ВЫДАЧА — КРУЖКОМ В СТРОКЕ РОЛИ (слово владельца 29.10.2026, #502 п.4: «Кнопку выдать
       сделай круглишком с галочкой зеленым, тоже жирным»; там же про отмену: «отмену так же
       замени минималистичной кнопкой»). Форма — кадр E47s (#509): строки `.grant`, кружок
       справа, погашенная строка БЕЗ кружка.
       ⚠ Погашенная строка — это ОТСУТСТВИЕ кружка, а не `disabled` у него, и это не вкус:
       чужие случаи `out-403`/`out-self`/`out-gone` красят экран запертым, если внутри
       `[data-person]` нашёлся `[disabled]`. Так запрет держится ПОСТРОЕНИЕМ, а не договором.
       ⚠ Нижний ряд «Отмена · Выдать» ушёл целиком, и вместе с ним ветка `current === 'people'`
       в `mainFor()`: главной кнопке Telegram обещать нечем — у неё нет строки, по которой
       нажали. Закрыть форму — тем же входом «+ ответственность» (`p-close` остался у него).
       ⚠ Направление — ВТОРОЙ шаг, и это замер, а не упрощение: перечня направлений кадр не
       рисует вовсе (слова «направление» в E47s нет ни разу), а сервер без `direction_id`
       отвечает отказом базы. Поэтому у куратора и бара в строке стоит указатель, он
       раскрывает направления строками, и выдаёт кружок В СТРОКЕ НАПРАВЛЕНИЯ — один тап,
       но после выбора. «Один тап всегда» — вопрос к владельцу, он у координатора с ценой.
       ⚠ `disabled` в этом блоке не ставится НИГДЕ, в том числе при занятости: кружки соседних
       строк не гаснут (слово designer-55). От двойного нажатия остаётся одна линия — проверка
       `PEOPLE.busy` во входе действий; снятие её обязано краснить `people-double`. */
    var CHECK = '<svg viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7"/></svg>';
    var CHEV = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
    // Отступы встроены — тот же долг Cafe13KPG#484, что у остатка в строке имени.
    var grow = function (label, small, right, off) {
      return '<div class="grant' + (off ? ' off' : '') + '"><span class="col"><span>' + esc(label) + '</span>' +
        (small ? '<span class="small">' + esc(small) + '</span>' : '') + '</span>' + (right || '') + '</div>';
    };
    // «Выдаём…» стоит в слоте кружка ТОЙ строки, по которой нажали, и держится до ответа:
    // дальше список перечитывается, форма закрыта, и итог говорит заметка в карточке.
    var give = function (key, words) {
      if (PEOPLE.give === key) return '<span class="sending">Выдаём…</span>';
      return '<button type="button" class="round yes" data-action="p-give:' + key + '"' +
        ' aria-label="Выдать: ' + esc(words) + '">' + CHECK + '</button>';
    };
    var grants = ROLE_PICK.map(function (r) {
      var label = ROLE_NAME[r] || r;
      // Общую роль, которая уже есть, второй раз не выдать (409) — строка гаснет и теряет кружок.
      if (DIR_ROLES.indexOf(r) === -1)
        return holds(p, r) ? grow(label, 'уже есть', '', true) : grow(label, '', give(r, label), false);
      // Роль направления. Состояний перечня три: грузится или не пришёл — строка гаснет, но
      // причина названа словами; пришёл ПУСТЫМ (все направления сняты) — «направлений нет»,
      // выбрать нечего никогда; занято ВСЁ — «уже есть». Занято не всё — роль открыта, а
      // закрыты лишь занятые строки: иначе выбор вёл бы в тупик, где выбрать нечего.
      // «Заняты все» на пустом перечне не считаем: [].every истинно.
      if (!PEOPLE.dirs)
        return grow(label, PEOPLE.dirsFail ? 'Направления не загрузились: ' + PEOPLE.dirsFail : 'Загружаем направления…', '', true);
      if (!PEOPLE.dirs.length) return grow(label, 'направлений нет', '', true);
      if (PEOPLE.dirs.every(function (d) { return holds(p, r, d.id); })) return grow(label, 'уже есть', '', true);
      var shown = PEOPLE.role === r;
      var head = grow(label, shown ? 'Выберите направление.' : '',
        '<button type="button" class="round go" data-action="p-role:' + r + '"' +
        ' aria-label="Направления: ' + esc(label) + '" aria-expanded="' + (shown ? 'true' : 'false') + '">' + CHEV + '</button>', false);
      if (!shown) return head;
      return head + '<div class="grants" style="margin-left:14px">' + PEOPLE.dirs.map(function (d) {
        return holds(p, r, d.id) ? grow(d.title, 'уже есть', '', true)
          : grow(d.title, '', give(r + ':' + d.id, label + ' · ' + d.title), false);
      }).join('') + '</div>';
    }).join('') +
      // серые: «есть, но не сейчас» — отличие от отсутствующей «Главы клуба» (слово владельца)
      ROLE_GREY.map(function (g) { return grow(g[1], 'выдаётся не из приложения', '', true); }).join('');
    form = '<div class="grants">' + grants + '</div>' +
      '<span class="small">Кто выдал и когда — запишется на сервере.</span>';
  }
  var mine = function (x) { return x && x.uid === p.uid; };
  var deny = mine(PEOPLE.deny) ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(PEOPLE.deny.text) + '</span></div>' : '';
  var done = mine(PEOPLE.done) ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(PEOPLE.done.text) + '</span></div>' : '';
  var q = PEOPLE.find.trim().toLowerCase();
  // E47g/E47zh: исключённый — итогом на месте своей карточки
  if (PEOPLE.gone && PEOPLE.gone.uid === p.uid)
    return '<div class="card quiet" data-person="' + k + '" role="status"><span class="small">' + esc(PEOPLE.gone.text) + '</span></div>';
  var outAsk = PEOPLE.out === k;
  return '<div class="card dense' + (open || outAsk ? ' open' : '') + '" data-person="' + k + '"' +
    (q && p.name.toLowerCase().indexOf(q) === -1 ? ' hidden' : '') + '>' +
    // Кадр E47: уровень — предмет строки, остаток справа. Стили встроены — долг Cafe13KPG#484
    // (класса .money в styles.css нет; .namerow и .round заведены этой правкой).
    // E47z: в строке имени — имя и остаток; уровень ушёл в надписи ниже (чип «paid»)
    //
    // МИНУС ПЕРЕД ИМЕНЕМ вместо ряда «Исключить» (слово владельца 29.10.2026, #502 п.3:
    // «кнопка исключить занимает целую строку — перенеси её перед именем и сделай жирным
    // красным минусом в кружке; те минималистичная кнопка, которой почти никогда не
    // пользуются»). Развилку он закрыл сам рисунком поверх живого экрана и услышал цену
    // числом («целиком видно 7 человек из 8 вместо 8»). Форма — кадр E47r/E47u (#509).
    // ⚠ Действие НЕ меняется: вход в вопрос тот же `p-out:k`, и двойное подтверждение
    // остаётся его же словом. Кружок — только вход, а не «нажал и исключил».
    '<div class="row"><div class="col"><div class="namerow">' +
      '<button type="button" class="round out" data-action="p-out:' + k + '" aria-label="Исключить из клуба"' + lock + '>' +
        '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button>' +
      '<b>' + esc(p.name) + '</b></div></div><span data-money style="font-variant-numeric:tabular-nums;white-space:nowrap">' +
      (p.bal === undefined ? '—' : money(p.bal % 1 ? p.bal.toFixed(2) : p.bal) + ' ฿') + '</span></div>' +
    rows + done + deny + form +
    // E47v: вопрос во всю карточку, с ИМЕНЕМ; «себя нельзя» — отказом сервера, кнопку не прячем (E47)
    (outAsk ? '<span class="small">' + esc(p.levels
        ? p.name + ' потеряет вход в приложение и живое членство разом: оплаченное членство обрывается сегодняшним днём. Обратного действия у этой кнопки нет.'
        : p.name + ' потеряет вход в приложение; живого членства нет — обрывать нечего. Обратного действия у этой кнопки нет.') + '</span>' +
      // Кадр E47u: само действие СЛОВОМ, отказ — кружком. Довод дизайнера взят как есть:
      // кружок это «нажал и сделал», и для исключения человека такой жест слишком дёшев,
      // а для отказа в самый раз. Порядок «слово, потом кружок» — тоже из кадра.
      // ⚠ Доступное имя кружка — то же слово, что стояло на кнопке («Не исключать»):
      // читающий разметку обязан найти в ней слово из кода, иначе действие и его имя
      // расходятся молча. Случай ведёт батарея действием `p-outkeep`, подпись она не судит.
      '<div class="rounds"><button type="button" class="btn quiet" data-action="p-outyes:' + k + '"' + lock + '>Точно исключить</button>' +
      '<button type="button" class="round no" data-action="p-outkeep" aria-label="Не исключать"' + lock + '>' +
        '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button></div>'
    // Своего ряда у «Исключить» больше нет — вход переехал минусом в строку имени (#502 п.3).
    // ⚠ ТЕКСТ вопроса остался клиентским, и это проверено: первая редакция кадра E47u его
    // переписывала — без имени человека, без различения «с живым членством / без» и без
    // «обратного действия нет», то есть отменяла три правила, которые держат случаи
    // `out-by-id` и `out-nomember`. Назвал дизайнеру, он вернул обе редакции дословно
    // (голова кадров 006abce). Добавку кадра «записи и платежи останутся» не беру: она
    // верна (на бою `revoke_access` правит только `app_access` и `memberships`, замеры мои
    // и его), но это новое обещание человеку, и его место — отдельной правкой текста.
    : '') +
  '</div>' + undo;
}
/* Частичная перерисовка (слово владельца 28.10.2026: «перерисовывай только элемент»,
   Cafe13KPG#490). Действия ВНУТРИ карточки — открыть форму, выбрать роль и направление,
   вопрос «Снять» и «Исключить» — меняют только те карточки, у которых было или стало своё
   состояние; их и перерисовываем, а экран целиком — нет: соседняя карточка, поле поиска и
   место прокрутки остаются как были. */
function peopleTouched() {
  var ks = [], L = PEOPLE.list || [];
  var at = function (uid) { for (var i = 0; i < L.length; i++) if (L[i].uid === uid) return i; return null; };
  [PEOPLE.open, PEOPLE.out,
   PEOPLE.ask !== null ? (function () { for (var i = 0; i < L.length; i++) if (L[i].roles.some(function (r) { return r.id === PEOPLE.ask; })) return i; return null; })() : null,
   PEOPLE.deny && at(PEOPLE.deny.uid), PEOPLE.done && at(PEOPLE.done.uid), PEOPLE.gone && at(PEOPLE.gone.uid)]
    .forEach(function (k) { if (typeof k === 'number' && ks.indexOf(k) === -1) ks.push(k); });
  return ks;
}
function peopleRedraw(before) {
  var ks = before.slice();
  peopleTouched().forEach(function (k) { if (ks.indexOf(k) === -1) ks.push(k); });
  for (var i = 0; i < ks.length; i++) {
    var el = document.querySelector('[data-person="' + ks[i] + '"]');
    // карточки нет на экране (список перечитан, экран другой) — честная полная перерисовка
    if (!el || !PEOPLE.list || !PEOPLE.list[ks[i]] || current !== 'people') { render(); return; }
    var tail = el.nextElementSibling;
    if (tail && tail.getAttribute('data-undo-of') === String(ks[i])) tail.remove();   // полоса отмены — сосед карточки (E47l)
    el.outerHTML = personCard(PEOPLE.list[ks[i]], ks[i]);
  }
  tgChrome();   // BACK и главная кнопка: «Выдать» у неё больше нет, но состояние экрана могло смениться
}
function peopleFilter() {
  var q = PEOPLE.find.trim().toLowerCase();
  [].forEach.call(document.querySelectorAll('[data-person]'), function (el) {
    var p = PEOPLE.list && PEOPLE.list[Number(el.getAttribute('data-person'))];
    el.hidden = !!q && !!p && p.name.toLowerCase().indexOf(q) === -1;
  });
}

/* ── заявки на доступ ──────────────────────────────────  Cafe13KPG#413
   Кадры E45*: очередь просьб от людей, которых в приложении ещё нет.
   Право — то же, что у «Людей» (сервер: _may_decide — head или is_admin).
   ⚠ Согласие одной транзакцией даёт допуск И членство, отмены нет: второе
   решение сервер отвергает 409 («просьба уже согласована»). Поэтому у
   «Согласиться» есть шаг подтверждения, хотя E45 его не рисует, —
   решение координатора в #413.
   ⚠ В ответе /join/requests есть tg_user_id просителя — разбор его НЕ берёт
   вовсе: решение идёт по номеру просьбы, а репозиторий публичный.
   Чек отдаётся файлом и только с подписью в заголовке, поэтому <img src>
   на ручку не годится: байты берутся fetch'ем и показываются objectURL. */
var JOIN_MIME = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'application/pdf': 'PDF' };
var JOIN_PILL = { pending: 'ЖДЁТ', approved: 'ВПУЩЕНА', rejected: 'ОТКАЗАНО' };
var JOINQ = { list: null, fail: '', gen: 0, busy: 0, err: '', ok: 0, no: 0, note: '', shot: {}, who: 0 };

/* Одна битая просьба — отказ целиком: очередь с пропавшей строкой выглядит полной. */
function fromJoinQueue(d) {
  if (!d || !Array.isArray(d.requests) || typeof d.pending !== 'number') return null;
  var out = [];
  for (var i = 0; i < d.requests.length; i++) {
    var q = d.requests[i];
    if (!q || typeof q.id !== 'number' || !JOIN_PILL[q.status] || !JOIN_MIME[q.receipt_mime] ||
        typeof q.receipt_bytes !== 'number' || !isFinite(num(q.amount_thb))) return null;
    var usd = q.amount_usd === null || q.amount_usd === undefined ? null : num(q.amount_usd);
    if (usd !== null && !isFinite(usd)) return null;
    out.push({ id: q.id, status: q.status,
               name: [q.first_name, q.last_name].filter(Boolean).join(' ') || (q.username ? '@' + q.username : 'Без имени'),
               said: typeof q.said === 'string' ? q.said.trim() : '',
               answer: typeof q.decision_note === 'string' ? q.decision_note.trim() : '',
               mime: q.receipt_mime, kb: Math.max(1, Math.round(q.receipt_bytes / 1024)),
               thb: num(q.amount_thb), usd: usd,
               iso: typeof q.created_at === 'string' ? q.created_at : '',
               done: typeof q.decided_at === 'string' ? q.decided_at : '' });
  }
  return out;
}
function loadJoinQueue() {
  var gen = ++JOINQ.gen, who = WHO;
  // чек неизменен, но смотрит его другой человек (тестовый режим «глазами») — кэш его не переживает
  if (JOINQ.who !== WHO) { joinDropShots(); JOINQ.who = WHO; }
  JOINQ.fail = '';
  api('GET', '/join/requests').then(function (r) {
    if (gen !== JOINQ.gen || who !== WHO) return;
    var list = r.status === 200 ? fromJoinQueue(r.data) : null;
    if (list) JOINQ.list = list;
    else { JOINQ.list = null; JOINQ.fail = r.status === 403 ? denyText(r) : failText(r); }
    // чек нужен только тому, о ком ещё решают, и только на самой очереди (на «Управлении» —
    // один счёт); PDF показать нечем — его байты не берутся вовсе
    if (current === 'joinQueue')
      (JOINQ.list || []).forEach(function (q) { if (q.status === 'pending' && q.mime !== 'application/pdf') joinShot(q.id); });
    if (current === 'joinQueue' || current === 'manage') render();
  });
}
function joinDropShots() {
  Object.keys(JOINQ.shot).forEach(function (k) { if (JOINQ.shot[k].url) URL.revokeObjectURL(JOINQ.shot[k].url); });
  JOINQ.shot = {};
}
/* Заголовки — те же, что у api(): без тестового режима чек пришёл бы из боевой базы. */
function joinShot(id) {
  if (JOINQ.shot[id]) return;
  var s = JOINQ.shot[id] = { url: '', fail: false }, who = WHO;
  var h = { 'X-Telegram-Init-Data': tg.initData };
  if (TEST.on) h['X-Test-Mode'] = '1';
  if (TEST.on && TEST.as) h['X-Act-As'] = String(TEST.as.id);
  fetch(API + '/join/requests/' + id + '/receipt', { headers: h })
    .then(function (r) { return r.ok ? r.blob() : null; }, function () { return null; })
    .then(function (b) {
      if (who !== WHO || JOINQ.shot[id] !== s) return;
      if (b && b.size) s.url = URL.createObjectURL(b); else s.fail = true;
      if (current === 'joinQueue') render();
    }, function () { s.fail = true; if (current === 'joinQueue') render(); });
}
function decideJoin(id, decision) {
  if (JOINQ.busy) return;
  JOINQ.busy = id; JOINQ.err = ''; render();
  var who = WHO;
  api('POST', '/join/requests/' + id + '/decide', { decision: decision, note: decision === 'rejected' ? JOINQ.note.trim() : '' }).then(function (r) {
    // занятость гасится ДО гарда: иначе ответ, пришедший после смены человека, запер бы экран (#213)
    JOINQ.busy = 0;
    if (who !== WHO) return;
    if (r.status === 200 && r.data && r.data.status === decision) { JOINQ.ok = 0; JOINQ.no = 0; JOINQ.note = ''; haptic('ok'); }
    else { JOINQ.err = denyText(r); haptic('warn'); }
    // и после отказа: 409 значит, что очередь устарела — решение уже кем-то принято
    loadJoinQueue();
    if (current === 'joinQueue') render();
  });
}
function joinTile(q) {
  var s = JOINQ.shot[q.id] || {}, pdf = q.mime === 'application/pdf';
  var box = 'flex:0 0 auto;width:72px;aspect-ratio:3/4;border-radius:9px;border:1px dashed var(--line);' +
            'background:var(--surface);display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;' +
            (!pdf && s.url ? 'padding:0' : 'padding:6px');
  var inner = !pdf && s.url
    ? '<img src="' + s.url + '" alt="Чек" style="width:100%;height:100%;object-fit:cover">'
    : '<span style="font-size:10px;color:var(--muted)">' + (pdf ? 'PDF<br>показать<br>нечем' : 'чек<br>с сервера') + '</span>';
  // «открыть» у PDF, как в E45, нет нарочно: открывается ли objectURL в Telegram-вебвью,
  // не проверено, а обещание, которого может не быть, хуже отсутствующей кнопки (#413)
  var kind = JOIN_MIME[q.mime] + ' · ' + q.kb + ' КБ';
  var sums = '<span class="small">Просили по заявке: <b class="num">' + money(q.thb) + ' ฿</b>' +
    (q.usd !== null ? ' или <b class="num">' + money(q.usd) + ' USDT</b>' : '') + '</span>';
  // E45e: чек не пришёл — место плитки занимает строка с «Повторить» (на 72 px пара рвётся);
  // суммы остаются, они из строки очереди. Решения не запираются: сервер чека не спрашивает.
  if (s.fail) return '<div class="col"><div class="row"><span class="small">Чек не загрузился</span>' +
      '<button type="button" class="btn quiet" data-action="j-shot:' + q.id + '">Повторить</button></div>' + sums + '</div>';
  return '<div style="display:flex;gap:10px;align-items:flex-start"><div style="' + box + '">' + inner + '</div>' +
    '<div class="col" style="flex:1 1 auto"><span class="small">' + kind + '</span>' + sums + '</div></div>';
}
function joinCard(q) {
  var busy = JOINQ.busy ? ' disabled' : '';
  var row = '<div class="row" style="justify-content:flex-start;gap:8px">';
  return '<div class="card"><div class="row top"><div class="col"><b>' + esc(q.name) + '</b>' +
      '<span class="small">' + esc(['просит доступ', askedWhen(q.iso, true)].filter(Boolean).join(' · ')) + '</span></div>' +
      '<span class="pill">' + JOIN_PILL.pending + '</span></div>' +
    (q.said ? '<span class="small">«' + esc(q.said) + '»</span>' : '') +
    joinTile(q) +
    (JOINQ.no === q.id
      ? '<div class="field"><label for="j-note">Слово заявителю</label>' +
          '<textarea id="j-note" rows="3" maxlength="500">' + esc(JOINQ.note) + '</textarea></div>' + row +
          '<button type="button" class="btn quiet" data-action="j-keep"' + busy + '>Не отказывать</button>' +
          '<button type="button" class="btn quiet" data-action="j-no:' + q.id + '"' + busy + '>Отказать и отправить</button></div>'
      : JOINQ.ok === q.id
      // E45d: имени в вопросе нет нарочно — оно строкой выше, в той же карточке
      ? '<span class="small">Согласие впустит человека в приложение и создаст членство — одним действием. Обратного действия у согласия нет: человека можно только ИСКЛЮЧИТЬ из клуба — кнопкой на «Членах клуба», и тогда он теряет вход и живое членство разом.</span>' + row +
          '<button type="button" class="btn quiet" data-action="j-keep"' + busy + '>Не соглашаться</button>' +
          '<button type="button" class="btn quiet" data-action="j-yes:' + q.id + '"' + busy + '>Точно согласиться</button></div>'
      : row +
          '<button type="button" class="btn quiet" data-action="j-ok:' + q.id + '"' + busy + '>Согласиться</button>' +
          '<button type="button" class="btn quiet" data-action="j-ask:' + q.id + '"' + busy + '>Отказать</button></div>') +
  '</div>';
}
function joinRow(q) {
  return '<div class="card quiet"><div class="row top"><div class="col"><b>' + esc(q.name) + '</b>' +
      '<span class="small">' + esc(askedWhen(q.done || q.iso, false)) + '</span></div>' +
      '<span class="pill' + (q.status === 'rejected' ? ' warm' : '') + '">' + JOIN_PILL[q.status] + '</span></div>' +
    (q.answer ? '<span class="small">«' + esc(q.answer) + '»</span>' : '') + '</div>';
}
document.addEventListener('input', function (ev) {
  if (ev.target && ev.target.id === 'j-note') JOINQ.note = ev.target.value;
});

/* ── карточки меню: конструктор и утверждение ──────────  #175
   Бар заводит карточку черновиком, пишет рецепт и отправляет на утверждение;
   куратор ставит её в меню или возвращает с причиной. Ручки — cafe13-api
   bar.py: POST /bar/products, …/recipe, …/state и очередь GET /bar/products.
   ⚠ Очередь без state не отдаёт hidden — просим все четыре явно, иначе
   «снятых нет» значило бы «не спрашивали».
   ⚠ Группы раскладываются здесь, а не порядком ответа: очередь куратора
   обязана стоять сверху при любой сортировке сервера.
   ⚠ Правки карточки на сервере нет: поля пишутся один раз, и это сказано до
   сохранения. Рецепт языка ЗАМЕНЯЕТСЯ, а не добавляется версией.
   ⚠ «В меню» без рецепта откажет триггер базы; экран знает про рецепт по
   полю recipes и гасит кнопку заранее. Отказы — текстом сервера. */
var CARD_STATES = ['draft', 'review', 'active', 'hidden'];
var CARD_LANGS = [['ru', 'RU'], ['en', 'EN'], ['th', 'TH']];
var CARD_FIELDS = ['c-title', 'c-group', 'c-price', 'c-mins', 'c-about'];
var CARDS = { list: null, fail: '', gen: 0, from: '' };
var CARD = { v: {}, alcohol: false, lang: 'ru', text: {}, body: {}, err: '', deny: '', note: '',
             busy: false, back: false, reason: '', hideAsk: false, groupAsk: '' };

function cardReset() {
  CARD.v = {}; CARD.alcohol = false; CARD.lang = 'ru'; CARD.text = {}; CARD.body = {}; CARD.err = '';
  CARD.deny = ''; CARD.note = ''; CARD.back = false; CARD.reason = ''; CARD.hideAsk = false; CARD.groupAsk = '';
}
function mayCards() { return LIVE && (grant('admin') || grant('bar') || grant('curator')); }
function cardCurator() { return !!BAR && (grant('admin') || grant('curator', BAR.id)); }
function fromCards(d) {
  if (!Array.isArray(d)) return null;
  for (var i = 0; i < d.length; i++) {
    var x = d[i];
    if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.group !== 'string' ||
        !(num(x.price) >= 0) || CARD_STATES.indexOf(x.state) === -1 || !Array.isArray(x.recipes)) return null;
  }
  return d.map(function (x) {
    return { id: x.id, title: x.title, group: x.group, price: num(x.price), mins: x.mins || null,
             about: x.about || '', alcohol: !!x.is_alcohol, state: x.state, recipes: x.recipes.slice(),
             note: typeof x.decision_note === 'string' ? x.decision_note.trim() : '',
             photo: typeof x.photo_id === 'number' ? x.photo_id : null,
             lastPhoto: typeof x.last_photo_id === 'number' ? x.last_photo_id : null,
             lastState: typeof x.last_photo_state === 'string' ? x.last_photo_state : null };
  });
}
function loadCards() {
  var gen = ++CARDS.gen, who = WHO;
  CARDS.fail = '';
  var go2 = function () {
    api('GET', '/bar/products?direction_id=' + BAR.id + '&state=' + CARD_STATES.join(',')).then(function (r) {
      if (gen !== CARDS.gen || who !== WHO) return;
      var list = r.status === 200 ? fromCards(r.data) : null;
      if (list) CARDS.list = list;
      else { CARDS.list = null; CARDS.fail = r.status === 403 ? denyText(r) : failText(r); }
      if (current === 'barCards' || current === 'barCard') render();
    });
  };
  if (BAR) { go2(); return; }
  loadBar(function (err) {
    if (gen !== CARDS.gen) return;
    if (err) { CARDS.fail = err; if (current === 'barCards' || current === 'barCard') render(); return; }
    go2();
  });
}
function cardBy(id) { return (CARDS.list || []).filter(function (c) { return String(c.id) === String(id); })[0] || null; }
// Группа гостю — заголовок меню по строке: «Кофе», «кофе» и «Кофе » дали бы три.
function groupKey(g) { return g.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ''); }
function groupsOf() {
  var out = [];
  (CARDS.list || []).forEach(function (c) { if (out.indexOf(c.group) === -1) out.push(c.group); });
  return out;
}
function grabCard() {
  CARD_FIELDS.forEach(function (id) { var el = document.getElementById(id); if (el) CARD.v[id] = el.value; });
  var t = document.getElementById('c-recipe');
  if (t) CARD.text[CARD.lang] = t.value;
  var w = document.getElementById('c-reason');
  if (w) CARD.reason = w.value;
}
function cardMissing() {
  var v = CARD.v;
  if (!(v['c-title'] || '').trim()) return 'Нужно название.';
  if (!(v['c-group'] || '').trim()) return 'Нужна группа меню.';
  if (topupAmount(v['c-price'] || '') === null && String(v['c-price'] || '').trim() !== '0') return 'Цена — число, например 180.';
  var m = String(v['c-mins'] || '').trim();
  if (m && !(/^\d+$/.test(m) && +m > 0 && +m <= 600)) return 'Минуты — целое число от 1 до 600 или пусто.';
  return '';
}
function cardSave(sure) {
  if (CARD.busy || !BAR) return;
  grabCard();
  CARD.deny = '';                             // прошлый отказ сервера не висит рядом с новым своим
  CARD.err = cardMissing();
  if (CARD.err) { haptic('warn'); render(); return; }
  var g = CARD.v['c-group'].trim().replace(/\s+/g, ' ');
  var same = groupsOf().filter(function (x) { return x.toLowerCase() === g.toLowerCase(); })[0];
  var like = groupsOf().filter(function (x) { return groupKey(x) === groupKey(g); })[0];
  if (same) g = same;
  else if (like && !sure) { CARD.groupAsk = like; render(); return; }
  if (sure === 'theirs') g = CARD.groupAsk;
  CARD.groupAsk = '';
  var body = { direction_id: BAR.id, group: g, title: CARD.v['c-title'].trim(),
               price: Number(String(CARD.v['c-price']).replace(',', '.')),
               about: (CARD.v['c-about'] || '').trim(), is_alcohol: CARD.alcohol };
  var m = String(CARD.v['c-mins'] || '').trim();
  if (m) body.mins = +m;
  var gen = CARDS.gen;
  CARD.busy = true; CARD.deny = ''; render();
  api('POST', '/bar/products', body).then(function (r) {
    CARD.busy = false;
    if (gen !== CARDS.gen) return;
    var ok = r.status === 201 && r.data && typeof r.data.id === 'number' && r.data.state === 'draft';
    if (!ok) { CARD.deny = denyText(r); haptic('warn'); render(); return; }
    haptic('ok');
    var id = r.data.id;
    cardReset();
    CARD.note = 'Черновик сохранён. Теперь рецепт — без него карточку не поставить в меню.';
    // карточка из ответа — до перечитывания, чтобы экран не моргнул «не найдена»
    CARDS.list = (CARDS.list || []).concat([{ id: id, title: body.title, group: body.group, price: body.price,
      mins: body.mins || null, about: body.about, alcohol: body.is_alcohol, state: 'draft', recipes: [], note: '' }]);
    go('barCard', String(id));
    loadCards();
  });
}
function recipeLoad(id, lang) {
  if (CARD.body[lang] !== undefined) return;
  if (!LIVE) {
    CARD.body[lang] = (DATA.work.cardRecipes[id] || {})[lang] || '';
    if (CARD.text[lang] === undefined && CARD.body[lang]) CARD.text[lang] = CARD.body[lang];
    return;
  }
  CARD.body[lang] = null;                     // в пути
  var gen = CARDS.gen;
  api('GET', '/bar/products/' + id + '/recipe?lang=' + lang).then(function (r) {
    if (gen !== CARDS.gen) return;
    // ручка отдаёт «что есть», если нужного языка нет: чужой язык в поле не кладём
    CARD.body[lang] = r.status === 200 && r.data && r.data.lang === lang && typeof r.data.body === 'string' ? r.data.body : '';
    if (CARD.text[lang] === undefined && CARD.body[lang]) CARD.text[lang] = CARD.body[lang];
    if (current === 'barCard') render();
  });
}
function recipeSave(id) {
  if (CARD.busy) return;
  grabCard();
  var lang = CARD.lang, text = (CARD.text[lang] || '').trim();
  if (!text) { CARD.deny = ''; CARD.err = 'Рецепт пуст.'; haptic('warn'); render(); return; }
  var gen = CARDS.gen, had = (cardBy(id) || { recipes: [] }).recipes.indexOf(lang) !== -1;
  CARD.busy = true; CARD.deny = ''; CARD.err = ''; render();
  api('POST', '/bar/products/' + id + '/recipe', { lang: lang, body: text }).then(function (r) {
    CARD.busy = false;
    if (gen !== CARDS.gen) return;
    if (!(r.status === 201 && r.data && r.data.lang === lang)) { CARD.deny = denyText(r); haptic('warn'); render(); return; }
    haptic('ok');
    CARD.body[lang] = text;
    CARD.note = (had ? 'Рецепт заменён' : 'Рецепт сохранён') + ' (' + lang.toUpperCase() + ').';
    loadCards(); render();
  });
}
function cardState(id, state, note) {
  if (CARD.busy) return;
  var body = { state: state };
  if (note) body.note = note;
  var gen = CARDS.gen;
  CARD.busy = true; CARD.deny = ''; render();
  api('POST', '/bar/products/' + id + '/state', body).then(function (r) {
    CARD.busy = false;
    if (gen !== CARDS.gen) return;
    // после любого нажатия список перечитывается: состояние из старого списка — не истина
    if (!(r.status === 200 && r.data && r.data.state === state)) { CARD.deny = denyText(r); haptic('warn'); loadCards(); render(); return; }
    haptic('ok');
    CARD.back = false; CARD.reason = ''; CARD.hideAsk = false;
    CARD.note = state === 'review' ? 'Отправлено на утверждение куратору.'
              : state === 'active' ? 'Утверждено: позиция в меню.'
              : note ? 'Возвращено с причиной.' : 'Снято с меню.';
    loadCards(); render();
  });
}
/* Строка «Снимок» (кадр E33, Cafe13KPG#270): шесть достижимых сочетаний
   photo_id × последний (нет / ждёт / утверждён) × «последний — тот же, что в
   меню». photo_id без последнего недостижим: ставится только из снимка этой
   позиции, удалять снимки нечем; rejected не присваивает ни одна ручка.
   Недостижимое и незнакомое — без строки: молчание честнее умолчания. */
var PHOTO_WAIT = ['new', 'at_ai', 'ready'];
function photoView(c) {
  if (c.lastPhoto === null) return c.photo === null
    ? { none: true, title: 'Фото нет', sub: 'Снимков у позиции нет. В меню она пойдёт без фото.' } : null;
  if (PHOTO_WAIT.indexOf(c.lastState) !== -1) return c.photo === null
    ? { title: 'Снимок ждёт утверждения', sub: 'В меню его пока нет: гость увидит фото только после утверждения.' }
    : { title: 'В меню стоит прежний', sub: 'Пришёл новый, ждёт утверждения. Гость пока видит прежний.' };
  if (c.lastState !== 'approved') return null;
  if (c.photo === null) return { title: 'Утверждён, но не в меню', sub: 'Снимок утверждён, но в меню не поставлен: гость фото не видит.' };
  return c.photo === c.lastPhoto
    ? { title: 'Фото в меню', sub: 'Гость видит этот снимок.' }
    : { title: 'Новый утверждён, но не в меню', sub: 'В меню остался прежний снимок — его гость и видит.' };
}
function photoBlock(c) {
  var v = photoView(c);
  if (!v) return '';
  return '<div class="group" data-photo><div class="monhead"><span class="label">Снимок</span><span class="small">последний из присланных</span></div>' +
    '<div class="shot"><div class="ph' + (v.none ? ' none' : '') + '">' + svg(ICON.cam) + '</div>' +
      '<span class="grow"><b>' + v.title + '</b><span class="small">' + v.sub + '</span></span></div>' +
    // предел ручки: она отдаёт один снимок — у позиции без снимков прятать нечего
    (v.none ? '' : '<div class="note">' + svg(ICON.info) + '<span>Показан только последний присланный снимок: прежние неутверждённые через этот экран не открыть. Это решение, а не недоделка — разобрано в карточке направления.</span></div>') +
  '</div>';
}
/* Вернули автору (Cafe13KPG#307, кадр E39). Два вида одного события:
   `draft` + замечание — после api#66; `hidden` + замечание — прежний способ,
   и такие строки в базе остаются. `hidden` с замечанием читается возвратом
   ПО СОГЛАШЕНИЮ: единственный путь в такие данные — наша кнопка «Вернуть с
   причиной» у карточки на проверке («Снять с меню» замечания не шлёт). Придёт
   такой `hidden` извне клиента — подпись соврёт. */
function cardReturned(c) {
  return !!c.note && (c.state === 'draft' || c.state === 'hidden');
}
function cardRow(c) {
  var rec = c.recipes.length ? 'рецепт: ' + c.recipes.join(', ') : '';
  var back = cardReturned(c);
  return '<button type="button" class="listitem' + (back ? ' warm' : '') + '" data-action="c-open:' + c.id + '">' +
    '<span class="grow"><b>' + esc(c.title) + '</b><span class="small">' + esc(c.group) + ' · ' + money(c.price) + ' ฿' +
      // глина — только там, где это запрет (review без рецепта отобьёт триггер базы);
      // у черновика рецепта нет по определению — это «ещё не сделано», не ошибка
      (rec ? ' · ' + esc(rec) : ' · <span' + (c.state === 'review' ? ' style="color:var(--clay-ink)"' : '') + '>рецепта нет</span>') + '</span>' +
      // замечание живёт до следующей смены состояния — читать его до нажатия
      (back ? '<span class="said">Замечание: ' + esc(c.note) + '</span>' : '') +
    '</span>' + svg(ICON.chev, 'chev') + '</button>';
}

function applyMe(me) {
  DATA.role = me.role;
  DATA.roles = me.roles;
  DATA.barSide = me.barSide;
  DATA.grants = me.grants;
  DATA.consent = me.consent;
  DATA.member = me.member;
  DATA.request = me.request;
  // запас пропуска — только свой и только боевой: чужой код на своём телефоне — чужое платёжное средство
  if (!TEST.on) syncPass(me);
}

/* Вход не состоялся (Cafe13KPG#458): Telegram и подпись есть, сервер спрошен, а
   в приложение не пустил — или ещё не ответил. Условие то же, по которому boot()
   идёт к серверу, поэтому витрину вне Telegram (и Telegram без подписи) оно не
   задевает. Пока оно верно, с экрана нет выхода — ни системной «назад», ни
   перехода (нарисованную прячет BARE: экраны входа все в нём). Отказ уводил
   в демонстрационный кабинет клуба: LIVE не поднят, DATA.role по умолчанию
   'member'. Свойство, а не список экранов: новый экран отказа закроется сам. */
function tryLive() { return API_ON && inTelegram() && !!tg.initData; }
function noEntry() { return tryLive() && !LIVE; }

function boot() {
  if (!tryLive()) { go(startScreen()); return; }
  go('loading');
  api('GET', '/me').then(function (r) {
    // 401 и 403 — разные люди: первому не дошла подпись, второго нет в списке.
    if (r.status === 401) { dropPass(); go('noSign'); return; }
    if (r.status === 403) { dropPass(); go('noAccess'); return; }
    var me = r.status === 200 ? fromMe(r.data) : null;
    if (!me) {
      FAIL_NET = r.status === 0;
      FAIL = r.status === 0 ? 'Сервер не ответил.'
           : r.status === 200 ? 'Ответ сервера не разобран.'
           : 'Сервер ответил кодом ' + r.status + '.';
      go('apiDown');
      return;
    }
    LIVE = true;
    SELF = me.roles;
    applyMe(me);
    go(startScreen());
  });
}

function startScreen() {
  return !consentGiven() ? 'consent' : homeOf();
}

function drinks() {
  var out = [];
  DATA.bar.menu.forEach(function (g) { out = out.concat(g.items); });
  return out;
}
function findDrink(id) {
  return drinks().filter(function (d) { return d.id === id; })[0];
}
function cartList() {
  return drinks().filter(function (d) { return CART[d.id]; }).map(function (d) {
    return { id: d.id, pid: d.pid, title: d.title, price: d.price, n: CART[d.id] };
  });
}
function cartCount() { return cartList().reduce(function (a, x) { return a + x.n; }, 0); }
function cartSum()   { return cartList().reduce(function (a, x) { return a + x.n * x.price; }, 0); }
function plural(n, f) {
  var a = n % 10, b = n % 100;
  return f[a === 1 && b !== 11 ? 0 : (a >= 2 && a <= 4 && (b < 10 || b > 20) ? 1 : 2)];
}
function nowHM() {
  var d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
function orderById(id) {
  return DATA.bar.orders.filter(function (o) { return o.id === id; })[0];
}
function shotsNeeded() {
  return drinks().filter(function (d) { return d.shot !== 'ready'; });
}

/* Доли спроса по времени суток — наш замер 04.09.2026: 522 позиции дайджеста
   острова за 19 дней. Организатору это нужнее любой подсказки про цену. */
var DEMAND = [
  { part: 'утро',  hours: '08–12', share: 19 },
  { part: 'день',  hours: '12–16', share: 17 },
  { part: 'вечер', hours: '16–24', share: 62 }
];

/* Состояние форм. В демонстрации созданное живёт до перезагрузки вкладки. */
var FORM = { kind: 'paid', filmed: false, place: null, v: {} };
var FLASH = null;
/* Сообщение живёт до следующего перехода, а не до первой отрисовки: в живом
   режиме ответ сервера перерисовывает экран, и «Заказ отправлен» исчезал
   через долю секунды после того, как появился. */
var FLASH_SHOWN = false;

/* ── согласие на обработку данных ─────────────────────
   В рабочем приложении факт согласия хранит сервер (`consent_version`,
   `consent_at`), и версия сверяется с серверной: текст изменился по сути —
   спрашиваем заново, молча подменять согласие нельзя. Здесь, без сервера, —
   метка в localStorage, только чтобы экран не возникал на каждой
   перезагрузке. Хранилище может быть недоступно (приватное окно, закрытые
   данные сайта) и бросает прямо на обращении, поэтому каждое в try/catch:
   недоступное хранилище означает «согласия нет», а не поломку страницы. */
var CONSENT_VERSION = '0.1';
var CONSENT_KEY = 'cafe13.consent';

function consentGiven() {
  if (LIVE) return DATA.consent;
  try { return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION; }
  catch (e) { return false; }
}
function giveConsent() {
  try { localStorage.setItem(CONSENT_KEY, CONSENT_VERSION); } catch (e) { /* не сохранилось — спросим снова */ }
}
function dropConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch (e) { /* нечего убирать */ }
}

/* Полный текст — `_docs/consent-text.md` в репозитории проекта. Здесь он
   разделами, чтобы читался с телефона, а не стеной. */
var CONSENT_FULL = [
  ['Кто обрабатывает данные',
   ['Клуб Café XIII, Тонгсала, Ко Пханган, Таиланд. Ответственный за данные и связь с ним будут названы здесь, когда клуб оформит юрлицо.']],
  ['Что клуб сохраняет',
   ['Из Telegram, сразу при первом входе: номер вашего аккаунта, имя и фамилию, имя пользователя, язык, фотографию профиля, если она открыта.',
    'Вы сообщаете сами: номер телефона — только если нажали «Поделиться номером»; имя, под которым вас называть в клубе.',
    'Клуб записывает по ходу: номер члена клуба, уровень членства и срок, ваши роли, записи на мероприятия и отмены, время, когда ваш пропуск отсканировали у входа, движение денег по счёту и остаток.']],
  ['Зачем',
   ['Опознать вас у двери. Вести членство и напомнить, когда оно заканчивается. Держать за вами место на мероприятии. Вести ваш счёт, чтобы вы и клуб видели одно и то же.',
    'Клубные итоги считаются обезличенными числами, а не вашими записями поимённо. Данные не используются для рекламы, не продаются и не передаются наружу — кроме требования тайского закона.']],
  ['Кто внутри клуба это видит',
   ['Работник на входе и в кассе — имя, фотографию, номер, действует ли членство, остаток в момент операции.',
    'Организатор — имена записавшихся на его мероприятие. Бизнес-партнёр — имена записавшихся на его услугу.',
    'Администратор и глава клуба — все записи, по необходимости учёта. Другие члены клуба ваших данных не видят.']],
  ['Сколько хранится',
   ['Пока вы член клуба и год после окончания — чтобы вернуться, не заводя всё заново.',
    'Записи о деньгах — дольше, по требованиям учёта; потом в книге остаётся сумма и дата без вашего имени.']],
  ['Ваши права',
   ['Посмотреть всё, что о вас записано. Исправить неверное. Забрать копию файлом.',
    'Удалить себя: клуб удалит имя, фотографию, телефон и ваши записи. В книге денег останутся обезличенные суммы — без них не сходится бухгалтерия клуба.',
    'Отозвать согласие. Тогда приложение перестанет вас узнавать, но членства вы не теряете: ваш учёт работник будет вести вручную.',
    'Срок исполнения просьбы — до 30 дней.']],
  ['Как согласие фиксируется',
   ['Клуб сохранит дату, время и номер версии текста, который вы видели. Если текст изменится по сути, клуб покажет новый и спросит снова.',
    'Версия этого текста: черновик 0.1 от 16 октября 2026 года.']]
];

var KIND = {
  paid:     { label: function (e) { return e.price + ' ฿'; }, pill: 'gold' },
  free:     { label: function () { return 'Бесплатно'; },     pill: '' },
  donation: { label: function () { return 'Донейшн'; },       pill: 'warm' }
};

/* ── афиша ────────────────────────────────────
   Живая афиша и демонстрационная не смешиваются: EVENTS — то, что прислал
   сервер, DATA.events — зашитые примеры. Подменять вторую первой нельзя:
   демонстрацию открывают поверх живого режима.

   Что видно в снимке ответа и чего не видно по письму: цена приходит
   строкой («400.00»); booked_by_me у события, на которое не записался
   никто, приходит null, а не false, — поэтому поле проверяется на
   правдивость, а не на равенство; my_booking_id появился позже остальных и
   его отсутствие ответ не портит — просто отменять нечем.

   Место приходит ДВУМЯ полями, `place_id` и `place_name`, и оба бывают
   null сразу: мероприятия, заведённые до миграции мест, места не имеют и
   получить его не могут — ручки правки события на сервере нет вовсе.
   Половина места (номер без имени или имя без номера) — порченая строка, и
   афиша отказывается целиком: за выдуманным местом человек поедет ногами.

   Афиша отдаёт только то, что ещё НЕ кончилось — окно сервер считает по
   КОНЦУ события (`NOT (starts_at + duration_min <= now())`, замер по
   стволу api 23.10.2026). Поэтому «идёт» — обычное состояние строки, а
   «завершилось» попадает на экран лишь в щель между ответом сервера и
   взглядом человека. Пометка всё равно нужна: за эту щель жмут
   «Записаться». */
var EVENTS = null;          // афиша с сервера или null, пока не пришла
var EVENTS_STATE = '';      // '' — не грузили, 'loading', 'ok', иначе текст отказа
var EVENTS_GEN = 0;         // ответ старого запроса, пришедший позже, молчит
var EV_PLACES = null;       // места клуба для формы или null, пока не пришли
var EV_PLACES_STATE = '';   // '' — не спрашивали, 'loading', 'ok', иначе отказ
var EV_PLACES_GEN = 0;      // ответ старого запроса, пришедший позже, молчит
var SEG = 'все';            // выбранная часть дня на экране афиши
var TZ = 'Asia/Bangkok';    // афиша клуба живёт по острову, а не по поясу телефона

var SEGS = [['все', 'Все'], ['утро', 'Утро'], ['день', 'День'], ['вечер', 'Вечер']];
var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
              'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/* Время события — в поясе клуба. 'en-CA' взят не ради языка, а ради формы
   YYYY-MM-DD: в ней даты сравниваются строками, без сдвигов руками. */
function bkk(d) {
  return {
    ymd: d.toLocaleDateString('en-CA', { timeZone: TZ }),
    hm: d.toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
    dow: d.toLocaleDateString('ru-RU', { timeZone: TZ, weekday: 'long' })
  };
}

function dayLabel(p, now) {
  if (p.ymd === bkk(now).ymd) return 'Сегодня, ' + p.dow;
  if (p.ymd === bkk(new Date(now.getTime() + 86400000)).ymd) return 'Завтра, ' + p.dow;
  var x = p.ymd.split('-');
  return Number(x[2]) + ' ' + (MONTHS[Number(x[1]) - 1] || '') + ', ' + p.dow;
}

/* Ответ /events → строки, которые рисует экран: имена полей те же, что у
   демонстрационных событий, чтобы разметка осталась одна. Битое событие —
   отказ целиком: афиша с пропавшей строкой выглядит полной. */
function fromEvents(d) {
  if (!Array.isArray(d)) return null;
  var now = new Date(), out = [];
  for (var i = 0; i < d.length; i++) {
    var e = d[i];
    if (!e || typeof e.id !== 'number' || typeof e.title !== 'string' || !e.title) return null;
    if (!KIND[e.kind] || typeof e.duration_min !== 'number' || !(e.duration_min > 0)) return null;
    if (typeof e.seats !== 'number' || typeof e.seats_left !== 'number' || typeof e.taken !== 'number') return null;
    if (typeof e.organizer_id !== 'number') return null;
    // Место: отсутствие приходит null'ом в ОБОИХ полях. Пустая строка в
    // имени — не место, а след поломки, поэтому имя требуется непустым.
    var pid = e.place_id === undefined ? null : e.place_id;
    var pname = e.place_name === undefined ? null : e.place_name;
    if (!(pid === null || typeof pid === 'number')) return null;
    if (!(pname === null || typeof pname === 'string' && pname)) return null;
    if ((pid === null) !== (pname === null)) return null;
    var price = num(e.price);
    if (!(price >= 0)) return null;
    var start = new Date(e.starts_at);
    if (isNaN(start.getTime())) return null;
    var ends = start.getTime() + e.duration_min * 60000;
    var p = bkk(start), fin = bkk(new Date(ends));
    out.push({
      id: String(e.id), eid: e.id, at: start.getTime(),
      title: e.title, day: dayLabel(p, now), time: p.hm, until: fin.hm,
      seg: partOf(p.hm),
      // «Идёт» верно только до конца события: часовая практика,
      // начавшаяся два часа назад, идущей не является — это было бы
      // правдоподобной ложью. Кончившееся сервер в афише уже не отдаёт, но
      // считать конец всё равно нам: между его ответом и этим взглядом
      // проходит время.
      part: now.getTime() >= start.getTime() && now.getTime() < ends ? 'идёт' : partOf(p.hm),
      done: now.getTime() >= ends,
      master: [e.organizer_first_name, e.organizer_last_name].filter(Boolean).join(' ') || 'Без имени',
      by: e.organizer_id,       // Telegram id ведущего: по нему и только по нему «своё»
      seats: e.seats_left, of: e.seats,
      kind: e.kind, price: price,
      about: typeof e.about === 'string' ? e.about : '',
      filmed: !!e.filmed,
      booked: !!e.booked_by_me,
      // номер своей записи — им отменяют; его читает `bookBlock`: нет номера — нет и кнопки
      bookingId: typeof e.my_booking_id === 'number' ? e.my_booking_id : null,
      place: pname, placeId: pid
    });
  }
  return out.sort(function (a, b) { return a.at - b.at; });
}

/* Список мест нужен только форме: в афише место приходит полями самого
   мероприятия, и отдельный запрос там был бы вторым источником правды.

   Порядок — по имени, здесь: сервер своего порядка не обещает, а чем
   сортировать сетку, решает владелец (Cafe13KPG#250) — это одна строка.
   `capacity: null` в снимке стоит у двора и сада: число никто не называл.
   Ноль вместо него был бы «мест нет» — ложь противоположного смысла. */
function fromPlaces(d) {
  if (!Array.isArray(d)) return null;
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var p = d[i];
    if (!p || typeof p.id !== 'number' || typeof p.name !== 'string' || !p.name) return null;
    if (typeof p.state !== 'string' || !p.state) return null;
    var cap = p.capacity === undefined ? null : p.capacity;
    if (!(cap === null || typeof cap === 'number' && cap > 0)) return null;
    // В выбор идёт только 'active': на скрытое место сервер назначить
    // откажет (409 «место … сейчас не используется»), а кнопка, ведущая к
    // верному отказу, обманывает дважды. Незнакомое состояние — тоже мимо:
    // разрешаем известное, а не запрещаем перечисленное.
    if (p.state !== 'active') continue;
    out.push({ id: p.id, name: p.name, capacity: typeof cap === 'number' ? cap : null });
  }
  return out.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
}

function loadPlaces() {
  EV_PLACES_STATE = 'loading';
  var gen = ++EV_PLACES_GEN;
  api('GET', '/places').then(function (r) {
    if (gen !== EV_PLACES_GEN) return;
    var list = r.status === 200 ? fromPlaces(r.data) : null;
    if (list) { EV_PLACES = list; EV_PLACES_STATE = 'ok'; }
    else { EV_PLACES = null; EV_PLACES_STATE = failText(r); }
    if (current === 'eventNew') render();
  });
}

function loadEvents() {
  EVENTS_STATE = 'loading';
  var gen = ++EVENTS_GEN;
  api('GET', '/events').then(function (r) {
    if (gen !== EVENTS_GEN) return;
    var list = r.status === 200 ? fromEvents(r.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; }
    else EVENTS_STATE = failText(r);
    /* Перерисовать надо и «Записи»: экран строится из этого же ответа, и
       без него человек, вошедший сюда сразу после записи, остаётся в
       «Загружаем афишу…» навсегда — данные пришли, а экран их не показал.
       Поймал случай `bookings-gost`: запустить загрузку и перерисовать по
       ответу — ДВА разных перечня экранов, и добавить надо в оба. */
    if (current === 'home' || current === 'events' || current === 'event'
        || current === 'bookings') render();
  });
}

/* ── запись на событие ─────────────────────────────────
   Деньги при записи не берутся вовсе: платное оплачивается в кассе, взнос
   донейшна — дело добровольное. Поэтому «записаться» — это только место.

   Успех признаётся ПЕРЕЧИТАННОЙ афишей, а не кодом 201: код говорит, что
   сервер принял, а человеку нужно то, что сервер теперь отдаёт.

   Отмена идёт по номеру своей записи (my_booking_id). Сервер отдаёт его не
   всегда: пока ручка не выложена, номера нет — и тогда отмена не
   предлагается вовсе, вместо кнопки стоит прямая строка. Кнопка,
   отказывающая по нажатию, хуже своего отсутствия. */
var BOOK_BUSY = false;     // запись или отмена в пути: второе нажатие молчит
var BOOK_ERR = '';         // чем кончилась неудачная попытка — текст на карточке
var BOOK_ASK = false;      // у отмены спрашивают: место уходит другому и может не вернуться

function cap(t) { return t ? t[0].toUpperCase() + t.slice(1) : ''; }

function canBookEvent(e) { return !!e && !e.booked && !e.done && e.seats > 0 && !BOOK_BUSY; }

function bookEvent(id) {
  var e = eventById(id);
  if (!LIVE || !canBookEvent(e)) return;
  BOOK_BUSY = true; BOOK_ERR = ''; render();
  api('POST', '/bookings', { event_id: e.eid }).then(function (r) {
    afterBooking(r, id, true);
  });
}

/* Отмена своей записи. Номер берётся из афиши: своего номера у клиента нет
   и выдумывать его нельзя — нет номера, нет и кнопки. */
function cancelBooking(id) {
  var e = eventById(id);
  if (!LIVE || BOOK_BUSY || !e || !e.booked || typeof e.bookingId !== 'number') return;
  BOOK_BUSY = true; BOOK_ERR = ''; BOOK_ASK = false; render();
  api('POST', '/bookings/' + e.bookingId + '/cancel').then(function (r) {
    afterBooking(r, id, false);
  });
}

/* Чем бы ни ответил сервер, афиша перечитывается: и отказ «мест нет», и
   обрыв связи могли случиться потому, что экран устарел. Состоялось ли
   задуманное, решает перечитанное, а не код ответа. */
function afterBooking(r, id, want) {
  var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  api('GET', '/events').then(function (g) {
    var list = g.status === 200 ? fromEvents(g.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
    BOOK_BUSY = false;
    var e = eventById(id);
    if (!e) BOOK_ERR = 'Этого события в афише больше нет.';
    else if (!!e.booked === want) {
      haptic('ok');            // успех виден самой карточкой: она нарисована по перечитанной афише
    } else if (r.status === 200 || r.status === 201) {
      BOOK_ERR = 'Сервер принял, а в афише этого нет. Откройте экран заново и проверьте, прежде чем нажимать снова.';
      haptic('warn');
    } else if (r.status === 0) {
      BOOK_ERR = 'Сервер не ответил, и в афише ничего не изменилось. Можно попробовать ещё раз.';
      haptic('warn');
    } else {
      BOOK_ERR = detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
      haptic('warn');
    }
    if (current === 'event' || current === 'events' || current === 'home') render();
  });
}

var EV_BUSY = false;       // отмена мероприятия в пути: второе нажатие молчит
var EV_ERR = '';           // чем кончилась неудачная отмена — текст на карточке
var EV_ASK = false;        // спрашиваем: отмена мероприятия снимает записи людей

/* «Своё» мероприятие — это organizer_id из афиши против своего tg id из /me.
   Сервер отдаёт в organizer_id именно Telegram id (миграция 004: bigint NOT
   NULL REFERENCES members(tg_user_id)), поэтому сравнение идёт с uid, а не с
   номером члена: ошибиться здесь — показать чужое управление. */
function isMyEvent(e) {
  return !!e && LIVE && typeof e.by === 'number' && !!DATA.member &&
         typeof DATA.member.uid === 'number' && e.by === DATA.member.uid;
}

function canCancelEvent(e) { return isMyEvent(e) && !e.done && !EV_BUSY; }

/* Отмена своего мероприятия. У кончившегося её нет: оно уже состоялось, и
   отмена стёрла бы записи тех, кто на нём был. */
function cancelEvent(id) {
  var e = eventById(id);
  if (!LIVE || !canCancelEvent(e)) return;
  EV_BUSY = true; EV_ERR = ''; EV_ASK = false; render();
  api('POST', '/events/' + e.eid + '/cancel').then(function (r) { afterEventCancel(r, id); });
}

/* Успех — не код ответа, а перечитанная афиша: отменённое мероприятие в ней
   не публикуется, поэтому исчезновение и есть подтверждение. */
function afterEventCancel(r, id) {
  var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  api('GET', '/events').then(function (g) {
    var list = g.status === 200 ? fromEvents(g.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
    EV_BUSY = false;
    var e = eventById(id);
    if (!e) { EV_ERR = ''; haptic('ok'); }
    else if (r.status === 200) {
      EV_ERR = 'Сервер принял, а в афише мероприятие осталось. Откройте экран заново и проверьте, прежде чем нажимать снова.';
      haptic('warn');
    } else if (r.status === 0) {
      EV_ERR = 'Сервер не ответил, и в афише ничего не изменилось. Можно попробовать ещё раз.';
      haptic('warn');
    } else {
      EV_ERR = detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
      haptic('warn');
    }
    if (current === 'event' || current === 'events' || current === 'home') render();
  });
}

/* Управление видно ТОЛЬКО ведущему и только на его мероприятии. Раздачи прав
   здесь нет и быть не должно: ведущий распоряжается своим событием, а не
   людьми клуба. Список записавшихся, наоборот, ЕСТЬ: ручка на бою живая, и
   `signedBlock` рисует его с графой оплаты (Cafe13KPG#271, шаг 2). Прежняя
   редакция этой шапки говорила «списка тоже нет» и пережила тот PR, которым
   он появился. */
/* ── кто записался ─────────────────────────────────────
   Ручка отдаёт имя, время записи, сумму и признак оплаты; телефонов и
   Telegram id в ответе нет вовсе — и не надо.

   Графа «оплатил» здесь ЕСТЬ — у платного мероприятия. Прежняя редакция
   этого пояснения её ЗАПРЕЩАЛА: «поле `paid` в ответе есть, но сегодня
   оно всегда false — касса пишет в книгу номер мероприятия, а связи с
   записью не ставит (карточка #103); колонка по такому полю говорила бы
   „не платил“ про тех, кто заплатил». Сам запрет был верен — истёк его
   ДОВОД: приём денег за запись (`POST /till`, `kind=event`) теперь ставит
   `bookings.ledger_id` (api `app/routers/till.py:284`), а признак оплаты — это
   ровно `(b.ledger_id IS NOT NULL)` (`app/queries.py:227`, одно место на
   три ручки). Коммит, заведший связь, — `48a56bc` «Оплата записи
   доходит до записи (#103)», и он ПРЕДОК боевого `fa2cebc`: замер
   мой, 24.10.2026. Поэтому графа говорит о деньгах в книге, а не о
   нуле в `amount_due`.

   Сумма подписана «записан на N ฿», а не «к оплате»: `amount_due` ничем не
   гасится, и после оплаты он остался бы прежним.

   Снятые записи не смешиваются с живыми в одном счёте: они показаны
   отдельно и помечены. Иначе ведущий считал бы пришедших по длине списка.
   ⚠ **На бою эта ветка НЕДОСТИЖИМА, и оставлена она НАРОЧНО.**
   Сервер снятых не отдаёт вовсе: `event_bookings` отбирает
   `WHERE b.event_id = %s AND b.state <> 'cancelled'` — api `app/routers/events.py:318`,
   замер по БЛОБУ боевого sha `fa2cebc`, снятого с `/health` 24.10.2026 в 18:44 UTC = 25.10 в 01:44 по острову
   (контроль признака: заведомо иное `WHERE b.state = 'cancelled'` в том же
   файле не находится). Ветка — защита на случай изменения сервера: если
   снятые однажды поедут, они не попадут в счёт живых молча. Удалить её
   как «мёртвый код» — именно тот ремонт, от которого эта фраза и стоит.

   Что сторожит что, разведено: случай `spisok-snyataya` судит саму ветку
   (подкладывая снятую запись нарочно — то есть гипотетическое будущее
   сервера, а не живой путь), а страж `snyatye-dovod` сторожит ДОВОД:
   базовая фикстура моделирует боевой ответ, и появись в ней снятые —
   утверждение «на бою их нет» перестало бы моделироваться, и его надо
   перечитать, а не держать вечно (правило команды Cafe13KPG#296).

   Прежняя редакция этой строки говорила то же, но со ссылкой на ревизию
   `880b4b6` и без номера строки; довод не снят, а ПЕРЕМЕРЕН на том sha,
   который лежит на бою СЕГОДНЯ: ссылка на старую ревизию верна по сути
   и непроверяема читателем, у которого на руках другой бой. */
var SIGNED = { eid: null, state: '', taken: 0, rows: null };
var SIGNED_GEN = 0;

function fromSigned(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.event_id !== 'number' || typeof d.taken !== 'number') return null;
  if (!Array.isArray(d.bookings)) return null;
  var now = new Date(), out = [];
  for (var i = 0; i < d.bookings.length; i++) {
    var b = d.bookings[i];
    if (!b || typeof b.id !== 'number') return null;
    if (typeof b.first_name !== 'string' || typeof b.last_name !== 'string') return null;
    if (typeof b.booked_at !== 'string' || typeof b.state !== 'string' || !b.state) return null;
    var when = new Date(b.booked_at);
    if (isNaN(when.getTime())) return null;
    var sum = num(b.amount_due);
    if (!(sum >= 0)) return null;           // сумма строкой, как все деньги в этом API
    // Оплата читается СТРОГО булевой. На правдивость её проверять нельзя:
    // `null` и отсутствие поля прочитались бы как «не оплачено», то есть
    // поломка сервера стала бы на экране обвинением человеку. Поле на бою
    // есть (замер: коммит, который его завёл, — предок боевого sha).
    if (typeof b.paid !== 'boolean') return null;
    var p = bkk(when);
    out.push({
      id: b.id,
      name: [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Без имени',
      when: dayLabel(p, now) + ', ' + p.hm,
      sum: sum,
      paid: b.paid,
      // Живая запись — ВСЁ, кроме снятой: у записи три состояния
      // (`CHECK (state IN ('booked','cancelled','attended'))`, замер по
      // боевой ревизии 880b4b6), и `attended` — это пришедший гость.
      // Сравнение с 'booked' отправляло бы его в «снятые».
      live: b.state !== 'cancelled'
    });
  }
  return { taken: d.taken, rows: out };
}

function signedFail(r) {
  var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  // Привратник доступа и отказ прав приходят одним кодом; у них разные
  // следующие шаги, поэтому и строки разные.
  if (r.status === 403 && /доступа нет/.test(detail))
    return 'Вас ещё не впустили в клуб — список поэтому и не открылся.';
  if (r.status === 404) return 'Сервер не знает такого мероприятия.';
  return detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
}

function loadSigned(e) {
  // Список спрашивается ТОЛЬКО на своём мероприятии: на чужое запроса нет
  // вовсе, а не отказ по ответу. Один предикат с показом «Управления».
  if (!LIVE || !isMyEvent(e)) return;
  var gen = ++SIGNED_GEN;
  SIGNED = { eid: e.eid, state: 'loading', taken: 0, rows: null };
  api('GET', '/events/' + e.eid + '/bookings').then(function (r) {
    if (gen !== SIGNED_GEN) return;        // ответ под прежнее событие молчит
    var got = r.status === 200 ? fromSigned(r.data) : null;
    if (got) SIGNED = { eid: e.eid, state: 'ok', taken: got.taken, rows: got.rows };
    else SIGNED = { eid: e.eid, state: signedFail(r), taken: 0, rows: null };
    if (current === 'event') render();
  });
}

/* Метка оплаты — только у ПЛАТНОГО мероприятия: у бесплатного платить нечего,
   а у донейшна взнос добровольный, и «не оплачено» там было бы упрёком за то,
   что человек имел право не делать. Это решение, а не недосмотр. */
function signedRow(p, kind, off) {
  return '<div class="card"><div class="row">' +
      '<div class="col"><b>' + esc(p.name) + '</b>' +
        '<span class="small">' + esc(p.when) +
          (p.sum > 0 && kind === 'paid' ? ' · записан на ' + money(p.sum) + ' ฿' : '') +
        '</span></div>' +
      (off ? '<span class="pill">снята</span>'
           : kind === 'paid' ? '<span class="pill' + (p.paid ? ' on' : '') + '">' +
             (p.paid ? 'оплачено' : 'не оплачено') + '</span>' : '') +
    '</div></div>';
}

function signedBlock(e) {
  /* ⚠ Сверка номера здесь — ВТОРАЯ линия, и она недостижима, пока жива
     первая: `go()` синхронно зовёт `loadSigned`, тот сбрасывает состояние в
     `{eid: текущее, loading}`, и только потом идёт `render()`. Мутация,
     снимающая эту сверку при живом гарде поколения, остаётся зелёной
     (замер 22.10.2026), поэтому доказательством она не прикрыта.

     Оставлена намеренно — но не как «защита вдвойне»: если снять гард
     `gen !== SIGNED_GEN` в `loadSigned`, эта строка НЕ спасёт экран, а
     оставит его в «Читаем, кто записался…» навсегда. Снимать первую,
     полагаясь на вторую, нельзя. */
  if (SIGNED.eid !== e.eid || SIGNED.state === 'loading')
    return '<div class="card quiet"><span class="small">Читаем, кто записался…</span></div>';
  if (SIGNED.state !== 'ok')
    return '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Список не открылся</b>' +
      '<span class="small">' + esc(SIGNED.state) + '</span></div></div>';

  var live = [], off = [];
  SIGNED.rows.forEach(function (p) { (p.live ? live : off).push(p); });
  // Число в афише и число в списке считает сервер в двух местах. Разойдутся —
  // сказать прямо: ведущий и гость иначе будут спорить о числе, а не о записи.
  var spor = SIGNED.taken !== (e.of - e.seats)
    ? '<div class="card quiet"><span class="small">Афиша говорит «' + (e.of - e.seats) +
      '», список — «' + SIGNED.taken + '». Откройте экран заново: одно из чисел устарело.</span></div>'
    : '';
  if (!live.length && !off.length)
    return spor + '<div class="card quiet"><span class="small">Пока никто не записался.</span></div>';
  // Сводка по оплате — у платного и только по ЖИВЫМ записям: снятая запись
  // денег не ждёт. Считается из тех же строк, что нарисованы ниже, поэтому
  // разойтись с ними не может.
  var paidN = 0;
  live.forEach(function (p) { if (p.paid) paidN += 1; });
  var itog = e.kind === 'paid' && live.length
    ? '<div class="card quiet"><span class="small">Оплатили ' + paidN + ' из ' + live.length +
      // Кто может снять — словами сервера, а не «можно снять»: чужую запись
      // снимает РАБОТНИК КЛУБА (`own or staff`, где staff — админ либо
      // director/staff/head; организатора там нет, отказ звучит «чужую
      // запись снимает работник клуба»). Этот экран читает организатор, и
      // «можно снять» обещало бы ему действие, которого у него нет — а
      // кнопки снятия здесь нет вовсе ни у кого.
      (paidN < live.length ? '. Неоплаченную запись снимает работник клуба — место вернётся в афишу.' : '.') +
      '</span></div>'
    : '';
  return spor + itog + live.map(function (p) { return signedRow(p, e.kind, false); }).join('') +
    (off.length ? '<span class="label">Снятые записи</span>' +
      off.map(function (p) { return signedRow(p, e.kind, true); }).join('') : '');
}

function manageBlock(e) {
  if (!isMyEvent(e)) return '';
  var err = EV_ERR ? '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Не получилось</b><span class="small">' + esc(EV_ERR) + '</span>' +
    '</div></div>' : '';
  var head = '<div class="group"><span class="label">Управление</span>' +
    '<div class="rows"><div><span class="small">Записалось</span>' +
      '<b class="num">' + (e.of - e.seats) + ' из ' + e.of + '</b></div></div>' +
    signedBlock(e) + err;
  if (EV_BUSY) return head + '<div class="card quiet"><span class="small">Отправляем…</span></div></div>';
  // Один предикат на оба пути: рисование и отправку. Пока их было два,
  // мутация, снявшая запрет у кончившегося, оставалась зелёной — кнопка
  // не рисовалась по своему, отдельному условию.
  if (!canCancelEvent(e)) return head + '<div class="card quiet"><span class="small">' +
    (e.done ? 'Мероприятие завершилось: отменить его уже нельзя.'
            : 'Отменить это мероприятие сейчас нельзя.') + '</span></div></div>';
  /* Текст принят командой и лежит адресом — кадр `E37d-event-cancel-ask.dc.html`
     на `Cafe13KPG` dev `8f4dc54`; здесь он стоит ДОСЛОВНО, и менять его тут
     нельзя. Прежняя редакция обещала «вернуть их сможет только каждый сам» —
     вернуть не может НИКТО: отмена уводит событие в `state='cancelled'`, афиша
     отбирает только `published`, запись на такое сервер отклоняет 409, а
     дороги назад нет вовсе — на бою `fa2cebc` по всему `app/` ровно один
     `UPDATE events`, и он только в `'cancelled'` (Cafe13KPG#359).

     Фраза про список — порядок действий ДО нажатия, а не сожаление после:
     после отмены список записавшихся недостижим обоими путями (карточка
     исчезает из афиши, а ручка отдаёт 200 с ПУСТЫМ списком — отмена снимает
     все записи, а запрос отбирает неснятые).

     Про деньги здесь НЕТ НИ СЛОВА нарочно: отмена к книге не прикасается
     (вхождений `ledger` в `cancel_event` — 0), то есть оплаченная запись
     становится снятой при живой строке дохода. Что об этом сказать человеку —
     решение владельца, Cafe13KPG#367; денежная строка приедет отдельной
     правкой, а не домыслом здесь.

     Плашка ГЛИНЯНАЯ (`card warm`), а кнопки стоят ПОД ней, а не внутри: так
     в кадре — на прежней отрисовке вопрос читался четвёртой строкой списка.
     Фраза держится одним литералом: разорванная переносом, она даёт ноль на
     построчном признаке, хотя на экране цела. */
  if (EV_ASK) return head + '<div class="card warm"><div class="col">' +
      '<b style="font-size:13px">Отменить мероприятие?</b>' +
      '<span class="small">Записи всех, кто записался, будут сняты, и мероприятие уйдёт из афиши. Вернуть его нельзя — только завести новое. Перепишите, кто записался: после отмены список не вернуть, а приложение гостей не предупредит.</span></div></div>' +
      '<button type="button" class="btn ghost" data-action="event-cancel-yes:' + esc(e.id) + '">Да, отменить</button>' +
      '<button type="button" class="btn quiet" data-action="event-cancel-no">Оставить</button></div>';
  return head + '<button type="button" class="btn ghost" data-action="event-cancel">Отменить мероприятие</button></div>';
}

/* ── завести мероприятие ───────────────────────────────
   Право даёт либо роль клуба, либо КУПЛЕННЫЙ уровень членства: уровень
   покупается и кончается сроком, роль выдаётся главой. Роли «мастер» в базе
   нет вовсе, поэтому признак здесь только из /me — и при приведении ролей к
   модели меняется список значений, а не логика экрана.

   Правок у мероприятия не существует: исправить можно лишь снятием, а
   снятие гости видят как отмену. Поэтому форма говорит это ДО отправки —
   после неё сказать уже некому.

   Успех — перечитанная афиша И совпадение с отправленным: код 201 обещает
   только, что сервер принял. */
var EVN_BUSY = false;      // создание в пути: второе нажатие молчит
var EVN_ERR = '';          // чем кончилась неудачная попытка — текст на форме

function mayCreateEvent() {
  return LIVE && (grant('admin') || grant('director') || grant('staff') ||
                  grant('head') || grant('curator') ||
                  DATA.role === 'organizer' || DATA.role === 'partner');
}

/* Форма → тело запроса. Пределы здесь те же, что в подписях полей: подпись
   говорит до ввода, проверка — после, и расходиться им нельзя. */
function eventForm() {
  var title = val('f-title');
  if (!title) return { err: 'Без названия мероприятие в афишу не ставится.' };
  if (title.length > 200) return { err: 'Название длиннее 200 знаков: сократите.' };
  var day = val('f-date'), time = val('f-time');
  if (!day || !time) return { err: 'Укажите день и время начала.' };
  // Пояс клуба стоит в строке явно: иначе сутки считает телефон ведущего, а
  // он может быть где угодно. Перехода на лето в Таиланде нет, смещение
  // постоянное — поэтому литерал, а не вычисление по часам телефона.
  var starts = day + 'T' + time + ':00+07:00';
  var at = Date.parse(starts);
  if (isNaN(at)) return { err: 'День и время не разобраны: проверьте поля.' };
  if (at <= Date.now()) return { err: 'Это время уже прошло по часам клуба.' };
  var dur = parseInt(val('f-dur'), 10);
  if (!(dur >= 1 && dur <= 1440)) return { err: 'Длительность — от 1 до 1440 минут.' };
  var seats = parseInt(val('f-seats'), 10);
  if (!(seats >= 1 && seats <= 500)) return { err: 'Мест — от 1 до 500.' };
  if (!KIND[FORM.kind]) return { err: 'Выберите вид участия.' };
  var price = 0, raw = val('f-price');
  if (FORM.kind === 'paid') {
    price = parseInt(raw, 10);
    if (!(price > 0)) return { err: 'У платного мероприятия цена больше нуля.' };
  } else if (FORM.kind === 'donation' && raw) {
    price = parseInt(raw, 10);
    if (!(price >= 0)) return { err: 'Ориентир — число или пустое поле.' };
  }
  var body = { title: title, starts_at: starts, duration_min: dur, seats: seats,
               kind: FORM.kind, price: price,
               about: val('f-about'), filmed: !!FORM.filmed };
  // «Без места» уходит ОТСУТСТВИЕМ ключа, а не null: обе формы сервер
  // принимает, но отсутствие — та, что стоит в снимке создания без места.
  if (typeof FORM.place === 'number') body.place_id = FORM.place;
  return { body: body };
}

/* Имена полей запроса по-русски: 422 называет поле в `loc`, и это
   единственное, что в его теле годится человеку — `msg` приходит
   по-английски. Поля, которого здесь нет, мы не отправляем вовсе: тогда
   честнее общий текст с кодом, чем выдуманное имя. */
var FIELD_RU = { title: 'Название', starts_at: 'Начало', duration_min: 'Длительность',
                 seats: 'Мест', price: 'Цена', about: 'Описание', kind: 'Вид участия',
                 filmed: 'Съёмка', place_id: 'Место' };

/* Места демонстрации: те же три, что отдаёт сервер клуба, и у двух из них
   вместимость неизвестна — демонстрация обязана показывать ту же форму
   данных, иначе снимок описи обещает не то, что увидит человек. */
var DEMO_PLACES = [{ id: 3, name: 'Двор', capacity: null },
                   { id: 1, name: 'Зал', capacity: 30 },
                   { id: 2, name: 'Сад', capacity: null }];

/* Выбор места в форме. Состояний у этого куска ПЯТЬ, и каждое говорит
   своё: не спрашивали, спрашиваем, отказ сервера, пустой список активных
   мест, список пришёл. Пустой список — не «выбирайте»: сервер назвал ноль
   мест, и честнее это сказать, чем показать одну кнопку «без места» и
   промолчать о причине.

   Вместимость показываем только там, где она есть: у двора и сада в снимке
   `capacity: null` — «числа никто не называл». Ноль нарисовать нельзя, он
   значит ровно обратное. */
function placeSeg() {
  // Вне Telegram приложение показывает демонстрацию, и места в ней зашиты,
  // как числа афиши: спрашивать сервер там некого, а «места не пришли» на
  // демонстрационном экране — отказ без отказа.
  var list = LIVE ? EV_PLACES : DEMO_PLACES;
  if (LIVE && (EV_PLACES_STATE === 'loading' || EV_PLACES_STATE === ''))
    return '<div class="note">' + svg(ICON.info) + '<span>Спрашиваем места у сервера…</span></div>';
  if (!list)
    return '<div class="note">' + svg(ICON.info) + '<span>Места не пришли: ' +
      esc(EV_PLACES_STATE) + ' Мероприятие заводится и без места — в афише у него просто не будет строки «где».</span></div>';
  if (!list.length)
    return '<div class="note">' + svg(ICON.info) +
      '<span>Сервер не назвал ни одного открытого места. Заводите без места: место потом не поменять — ручки правки события нет.</span></div>';
  var sel = null;
  for (var i = 0; i < list.length; i++) if (list[i].id === FORM.place) sel = list[i];
  var hint = FORM.place === null
    ? 'Без места — тоже ответ: в афише не будет строки «где».'
    : sel ? (sel.capacity
        ? 'Вместимость: ' + sel.capacity + '. Если место в это время занято, сервер скажет — с названием и временем того, что уже стоит.'
        : 'Сколько человек влезает, нам не называли — числа здесь нет. Если место занято, сервер скажет чем.')
      : 'Это место больше не предлагается — выберите другое или заводите без места.';
  return '<div class="seg wrap"><button type="button" data-place="" aria-pressed="' +
      (FORM.place === null) + '">Без места</button>' +
    list.map(function (p) {
      return '<button type="button" data-place="' + esc(String(p.id)) +
        '" aria-pressed="' + (FORM.place === p.id) + '">' + esc(p.name) + '</button>';
    }).join('') + '</div>' +
    '<span class="small" style="margin-top:6px;display:block">' + esc(hint) + '</span>';
}

function badFields(d) {
  if (!Array.isArray(d)) return [];
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var loc = d[i] && d[i].loc;
    var ru = Array.isArray(loc) && loc.length ? FIELD_RU[loc[loc.length - 1]] : null;
    if (ru && out.indexOf(ru) === -1) out.push(ru);
  }
  return out;
}

/* Эхо под полями дня и времени.

   Виджет даты рисуется в формате УСТРОЙСТВА, а не страницы: при русской
   странице система по-английски печатает «mm/dd/yyyy» и «07:00 PM» (замер
   на кадре 390px). Первые двенадцать дней месяца такой порядок двусмыслен —
   «07/08» это и 8 июля, и 7 августа, — и подписью это не лечится: подпись
   спорила бы с виджетом. Поэтому строка повторяет ПОНЯТОЕ нами нашими
   словами: месяц словом, год числом, время в поясе клуба.

   И это не украшение: «Время клуба, остров» — обещание, а эхо — посчитанный
   факт. Потеряется пояс — разойдётся эхо, и видно это будет на кадре. */
function cur(id, dflt) {
  var x = FORM.v[id];
  return x === undefined || x === '' ? (dflt || '') : x;
}

/* Возвращает {text, ok}: ok — «это посчитанная дата», а не просьба. Хвост
   «· время клуба» дорисовывается отдельным узлом и прячется у просьбы:
   «Выберите день · время клуба» было бы бессмыслицей.

   ⚠ Пустые поля называются ПООТДЕЛЬНОСТИ. Общая фраза «День и время не
   заполнены» верна только когда пусты оба, а форма открывается с пустым
   днём и временем 19:00 — и плашка спорила с полем в сантиметре от себя
   (нашёл designer-55 на кадре каталога, 22.10.2026). Мои случаи этого не
   видели: оба заполняли ОБА поля. */
function echoText(day, time) {
  if (!day) return { text: 'Выберите день.', ok: false };
  if (!time) return { text: 'Выберите время.', ok: false };
  var d = new Date(day + 'T' + time + ':00+07:00');
  if (isNaN(d.getTime())) return { text: 'День и время не разобраны.', ok: false };
  // День собирается из ymd ПОЯСА КЛУБА и своего списка месяцев, а не из
  // toLocaleDateString: тот добавляет «г.» и вообще волен менять вид.
  var p = bkk(d), x = p.ymd.split('-'), mon = MONTHS[Number(x[1]) - 1];
  if (!mon) return { text: 'День и время не разобраны.', ok: false };
  return { text: p.dow + ', ' + Number(x[2]) + ' ' + mon + ' ' + x[0] + ', ' + p.hm, ok: true };
}

function echoLine(eh) {
  return '<div class="small" style="margin-top:-2px">' +
      '<span id="f-echo" style="color:var(--ink)">' + esc(eh.text) + '</span>' +
      '<span id="f-echo-tail"' + (eh.ok ? '' : ' hidden') + '> · время клуба</span>' +
    '</div>';
}

function createEvent() {
  // Один предикат на рисование и на отправку: у человека без права кнопки
  // нет, но и путь закрыт здесь же — иначе мутация, снявшая кнопку,
  // осталась бы зелёной.
  if (!mayCreateEvent() || EVN_BUSY) return;
  // Снять введённое ДО первой перерисовки: экран рисует поля из FORM.v, и без
  // этого отказ сервера стирал всё набранное — человек платил вводом за то, в
  // чём не виноват. Нашлось мутацией: второе нажатие не заводило второго
  // мероприятия не из-за запрета, а потому что поля к тому времени были пусты,
  // то есть запрет был зелёным по чужой причине.
  grabForm(EVENT_FIELDS);
  var f = eventForm();
  if (f.err) { EVN_ERR = f.err; haptic('warn'); render(); return; }
  EVN_BUSY = true; EVN_ERR = ''; render();
  api('POST', '/events', f.body).then(function (r) { afterEventCreate(r, f.body); });
}

/* Мало того, что событие нашлось под выданным номером: оно должно совпасть
   с отправленным. Чужое событие под своим номером — правдоподобный успех. */
function sameAsSent(e, sent) {
  return e.title === sent.title && e.of === sent.seats && e.kind === sent.kind &&
         e.at === Date.parse(sent.starts_at) &&
         (sent.kind === 'paid' ? e.price === sent.price : true);
}

function afterEventCreate(r, sent) {
  var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  var id = r.data && typeof r.data.id === 'number' ? String(r.data.id) : null;
  api('GET', '/events').then(function (g) {
    var list = g.status === 200 ? fromEvents(g.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; EVENTS_GEN++; }
    EVN_BUSY = false;
    var e = id ? eventById(id) : null;
    if (e && sameAsSent(e, sent)) {
      EVN_ERR = '';
      FORM = { kind: 'paid', filmed: false, place: null, v: {} };
      dropDraft();
      haptic('ok');
      // Человека уводим на карточку его события только если он всё ещё на
      // форме: уйти с неё — тоже решение, и отменять его нечем.
      if (current === 'eventNew') { go('event', id); return; }
      render(); return;
    }
    if (r.status === 201 || r.status === 200) {
      EVN_ERR = e ? 'Сервер принял, а под этим номером в афише другое мероприятие. Откройте афишу и проверьте, прежде чем заводить снова.'
                  : 'Сервер принял, а в афише мероприятия нет. Откройте афишу и проверьте, прежде чем заводить снова.';
      haptic('warn');
    } else if (r.status === 0) {
      EVN_ERR = 'Сервер не ответил, и в афише ничего не появилось. Можно попробовать ещё раз.';
      haptic('warn');
    } else if (r.status === 422) {
      // Пределы на экране и модель сервера разошлись: клиент эти же поля
      // проверяет до отправки, поэтому 422 — не ошибка человека, а
      // расхождение, и его надо назвать, а не спрятать за кодом.
      var ff = badFields(r.data && r.data.detail);
      EVN_ERR = ff.length
        ? 'Сервер не принял ' + (ff.length > 1 ? 'поля' : 'поле') + ': ' + ff.join(', ') +
          '. На экране они проверяются иначе — сообщите в клуб, это расхождение.'
        : failText(r);
      haptic('warn');
    } else if (r.status === 403 && /доступа нет/.test(detail)) {
      // 403 приходит ДВУХ происхождений, и по коду они неразличимы: отказ
      // прав («мероприятия заводят организатор, партнёр и работники клуба»)
      // и привратник доступа («доступа нет»). Во втором случае слово сервера
      // отвечает не на тот вопрос: человек прочитал бы «Доступа нет» посреди
      // формы и стал бы править поля. Сравнение по ВХОЖДЕНИЮ: текст
      // привратника может обрасти уточнением, и точное равенство тогда молча
      // перестанет узнавать свой случай.
      EVN_ERR = 'Вас ещё не впустили в клуб — дело не в форме. Напишите тому, кто вас приглашал.';
      haptic('warn');
    } else {
      EVN_ERR = detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r);
      haptic('warn');
    }
    render();
  });
}

/* ── рецепт позиции бара (#176) ─────────────────────
   Только ЧТЕНИЕ: конструктор карточки и общие функции бара — чужая зона,
   поэтому здесь своё состояние и свои помощники.

   Построчной пары «тайская строка / английская под ней» не бывает: сервер
   хранит один живой рецепт НА ЯЗЫК, целым текстом, и записи независимы —
   число шагов и порядок у них разные. Поэтому два блока целиком.

   ⚠ Ручка на отсутствующий язык отдаёт ЛЮБОЙ живой рецепт, и единственная
   защита от молчаливой подмены — поля ответа: `lang` — язык ПОКАЗАННОГО,
   `asked_lang` — запрошенный, `exact` — совпали ли они (снимки
   `recipe-th.json` и `recipe-en-fallback.json`). При `exact: false` блок
   обязан сказать, на каком языке текст на самом деле, иначе экран соврёт
   ровно в том, ради чего заведён.

   Языка работника клиент не знает: в `/me` поля `lang` нет (замер по
   снимку `me-member.json`). Поэтому первый блок спрашивается БЕЗ `lang` —
   язык выбирает сервер по `members.lang`, — а какой это оказался язык,
   видно из `asked_lang` в ответе. Подписи двуязычные: кто читает экран,
   клиент не знает. */
var RECIPE = { pid: null, gen: 0, me: null, en: null };
// Два падежа: в плашке язык НАЗЫВАЮТ («тайский»), в подписи о подмене о нём
// говорят («показан на русском»). Один список на оба места давал «ภาษาไทย ·
// тайском» — видно только на отрисованном экране, в коде это незаметно.
var LANG_RU = { ru: 'русский', en: 'английский', th: 'тайский' };
var LANG_NA = { ru: 'русском', en: 'английском', th: 'тайском' };
var LANG_TH = { ru: 'ภาษารัสเซีย', en: 'ภาษาอังกฤษ', th: 'ภาษาไทย' };

function langRu(code) { return LANG_RU[code] || ('«' + code + '»'); }
function langNa(code) { return LANG_NA[code] || ('«' + code + '»'); }
function langTh(code) { return LANG_TH[code] || ('«' + code + '»'); }

function mayRecipe() {
  // Ровно то, что пропускает сервер (`_needs_bar_side`, замер по боевой
  // ревизии 880b4b6): админ, а бар и куратор — на СВОЁМ направлении.
  // `BAR` до загрузки направлений null, и `grant(role, undefined)` сняло бы
  // проверку направления совсем — поэтому обе скобки обязательны.
  return LIVE && (grant('admin') || (!!BAR && (grant('bar', BAR.id) || grant('curator', BAR.id))));
}

function fromRecipe(d) {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.lang !== 'string' || !d.lang) return null;
  if (typeof d.body !== 'string' || !d.body) return null;
  if (typeof d.exact !== 'boolean') return null;
  return { lang: d.lang, asked: typeof d.asked_lang === 'string' ? d.asked_lang : '',
           exact: d.exact, body: d.body };
}

function recipeFail(r) {
  var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  // «Рецепта нет» и «не открылось» — разные вещи: первое чинится письмом
  // рецепта, второе — правами или сетью.
  //
  // ⚠ Текст сервера на 404 («напишите его, иначе её нельзя вернуть в меню»)
  // дословно НЕ печатается: это поручение, а этот экран действия не несёт —
  // записи рецепта здесь нет вовсе (решение координатора, 22.10.2026).
  // Поручение без кнопки читается как упрёк.
  if (r.status === 404) return { none: true,
    text: 'Рецепта пока нет. Его пишет бар или куратор направления.' };
  return { none: false, text: detail ? cap(detail) + (/[.!?]$/.test(detail) ? '' : '.') : failText(r) };
}

function loadRecipe(pid) {
  if (!LIVE || !mayRecipe()) return;
  var gen = ++RECIPE.gen;
  RECIPE = { pid: pid, gen: gen, me: { state: 'loading' }, en: { state: 'loading' } };
  ask('', 'me');
  ask('en', 'en');
  function ask(lang, slot) {
    api('GET', '/bar/products/' + pid + '/recipe' + (lang ? '?lang=' + lang : '')).then(function (r) {
      if (gen !== RECIPE.gen) return;         // ответ под прежнюю позицию молчит
      var got = r.status === 200 ? fromRecipe(r.data) : null;
      RECIPE[slot] = got ? { state: 'ok', r: got } : { state: 'fail', fail: recipeFail(r) };
      if (current === 'barRecipe') render();
    });
  }
}

/* Подпись о подменённом языке — на обоих языках сразу и с НАЗВАНИЕМ того,
   что показано: «нет на английском, показан русский». Неизвестный код языка
   печатается как есть, выдумывать названия нельзя. */
function recipeSwap(asked, lang) {
  return 'Рецепта на ' + langNa(asked) + ' нет — показан на ' + langNa(lang) + '. · ' +
         'ไม่มี' + langTh(asked) + ' · แสดง' + langTh(lang);
}

function recipeBlock(head, slot, want) {
  var s = RECIPE[slot], top = '<div class="group"><span class="label">' + esc(head) + '</span>';
  if (!s || s.state === 'loading') return top + '<div class="card quiet"><span class="small">Читаем рецепт…</span></div></div>';
  if (s.state === 'fail') return top + '<div class="card' + (s.fail.none ? ' quiet' : ' strong') + '"><div class="col">' +
      '<b style="font-size:13px">' + (s.fail.none ? 'Рецепта нет' : 'Рецепт не открылся') + '</b>' +
      '<span class="small">' + esc(s.fail.text) + '</span></div></div></div>';
  var r = s.r;
  var asked = want || r.asked;
  // Три случая, а не два. `exact: false` бывает и БЕЗ подмены: у работника
  // может быть не задан язык (Telegram не прислал language_code), тогда
  // сервер отвечает `asked_lang: ""` — сравнивать было не с чем. Писать
  // «Рецепта на «» нет» значит сообщать о подмене, которой не было.
  var note = r.exact
    ? '<span class="pill on">' + esc(langTh(r.lang)) + ' · ' + esc(langRu(r.lang)) + '</span>'
    : !asked
      ? '<span class="pill">' + esc('Ваш язык не задан — показан на ' + langNa(r.lang) + '. · ' +
          'ไม่ได้ตั้งภาษา · แสดง' + langTh(r.lang)) + '</span>'
      : '<span class="pill warm">' + esc(recipeSwap(asked, r.lang)) + '</span>';
  return top + '<div class="card"><div class="col">' + note +
      '<p style="font-size:14px;white-space:pre-line">' + esc(r.body) + '</p>' +
    '</div></div></div>';
}

function eventList() { return LIVE ? EVENTS : DATA.events; }
function eventById(id) {
  var list = eventList() || [];
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
  return null;
}
function segOf(e) { return e.seg || partOf(e.time); }

/* «Афиша не открылась» — это состояние, а не пустая афиша: отказ сервера и
   ноль событий одинаково выглядят только у вруна. */
function eventsWait() {
  return EVENTS_STATE === 'loading' || EVENTS_STATE === ''
    ? '<div class="card quiet"><span class="small">Загружаем афишу…</span></div>'
    : '<div class="card strong"><h2>Афиша не открылась</h2><p>' + esc(EVENTS_STATE) + '</p>' +
      '<button type="button" class="btn" data-action="retry-events">Попробовать снова</button></div>';
}

/* Вход в афишу с главной. Занимает место, где до сих пор стояло «ещё не
   подключено». */
function afishaHome() {
  if (!EVENTS) return eventsWait();
  if (!EVENTS.length) return '<div class="group"><span class="label">Афиша</span>' +
    '<div class="card quiet"><span class="small">В афише пока ничего нет.</span></div></div>';
  return '<div class="group"><div class="row"><span class="label">Афиша</span>' +
    '<button type="button" class="btn quiet" data-go="events">Вся афиша</button></div>' +
    EVENTS.slice(0, 2).map(eventRow).join('') + '</div>';
}

/* Карточка события на живых данных. Запись и отмена здесь ЕСТЬ: обе живут в
   `bookBlock`, который эта функция и зовёт последним. Прежняя редакция шапки
   говорила «кнопки записи здесь пока нет» и пережила тот PR, которым запись
   появилась, — следующий читатель завёл бы второй путь к записи. */
function eventLive(e) {
  return '<div class="col"><h1>' + esc(e.title) + '</h1>' +
      '<span class="small">' + esc(e.day) + ' · ' + esc(e.time) + '–' + esc(e.until) +
        (e.done ? ' · завершилось' : e.part === 'идёт' ? ' · уже идёт' : '') + '</span></div>' +
    (e.booked ? '<div class="card accent"><div class="row">' +
        '<div class="col"><b>Вы записаны</b>' +
          '<span class="small">Место держится за вами.</span></div>' +
        '<span class="pill on">записаны</span>' +
      '</div></div>' : '') +
    '<div class="rows">' +
      '<div><span class="small">Ведёт</span><b>' + esc(e.master) + '</b></div>' +
      // Места нет — строки нет вовсе. «Место не указано» обещало бы, что
      // его когда-нибудь укажут: ручки правки события на сервере нет.
      (e.place ? '<div><span class="small">Где</span><b>' + esc(e.place) + '</b></div>' : '') +
      '<div><span class="small">Мест осталось</span><b class="num">' +
        (e.seats === 0 ? 'мест нет' : e.seats + ' из ' + e.of) + '</b></div>' +
      '<div><span class="small">Участие</span><b class="num">' + KIND[e.kind].label(e) + '</b></div>' +
    '</div>' +
    (e.about ? '<p style="font-size:14px">' + esc(e.about) + '</p>' : '') +
    '<div class="note">' + svg(ICON.cam) + '<span>' + (e.filmed
      ? 'На этом событии ведётся съёмка. Согласие даётся отдельно и его можно не давать — запись останется в силе.'
      : 'Съёмки на этом событии нет.') + '</span></div>' +
    manageBlock(e) +
    bookBlock(e);
}

/* Что можно сделать с событием. Кончившееся и заполненное не предлагают
   записи вовсе: отказ сервера, полученный после нажатия, человек читает как
   поломку приложения. */
function bookBlock(e) {
  if (BOOK_BUSY) return '<div class="card quiet"><span class="small">Отправляем…</span></div>';
  var err = BOOK_ERR ? '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Не получилось</b><span class="small">' + esc(BOOK_ERR) + '</span>' +
    '</div></div>' : '';
  if (e.booked) {
    // У кончившегося события отменять нечего: сервер такую отмену примет и
    // сотрёт сам факт записи, а подтверждение обещало бы вернуть место в
    // афишу — обещание заведомо ложное. Идущее событие отменить можно:
    // место ещё можно отдать тому, кто придёт.
    if (e.done) return err;
    // Номера своей записи сервер может не отдать — тогда отменять нечем, и
    // это сказано прямо, а не спрятано за кнопкой, которая откажет.
    if (typeof e.bookingId !== 'number')
      return err + '<div class="card quiet"><span class="small">Отменить запись из приложения пока нельзя.</span></div>';
    if (BOOK_ASK)
      return err + '<div class="card strong"><div class="col">' +
          '<b>Отменить запись?</b>' +
          '<span class="small">Место вернётся в афишу и может достаться другому.</span></div>' +
          '<button type="button" class="btn ghost" data-action="book-cancel-yes:' + esc(e.id) + '">Да, отменить</button>' +
          '<button type="button" class="btn quiet" data-action="book-cancel-no">Оставить запись</button>' +
        '</div>';
    return err + '<button type="button" class="btn ghost" data-action="book-cancel">Отменить запись</button>';
  }
  if (!canBookEvent(e)) {
    // Объяснение — там, где человек мог ждать кнопку: мест нет. Кончившемуся
    // событию объяснять нечего, у него всё сказано карточкой.
    return err + (!e.done && e.seats === 0
      ? '<div class="card quiet"><span class="small">Мест нет. Если кто-то снимет запись, место вернётся в афишу.</span></div>'
      : '');
  }
  /* Подпись отвечает на то, чего человек не знает и что решает за него
     сервер: достанется ли место сразу, когда платить и кто может запись
     снять. Текст платного принят командой дословно и лежит адресом в
     Cafe13KPG#271, а не в переписке; менять его здесь нельзя.

     Прежняя редакция этого комментария говорила: «Про отмену здесь не
     сказано ни слова: отменить из приложения сегодня нечем, а обещание,
     данное ДО записи, человек прочитает как право, которого у него не
     будет». Решение осталось верным, и снято с него только одно: речь шла
     о ПРАВЕ ЧЕЛОВЕКА отменить, которого нет. «Снять запись может работник
     клуба» — не право, а предупреждение, и оно шире, чем было: на бою
     `POST /bookings/{id}/cancel` в ветке `_is_staff` условия «только
     неоплаченную» НЕТ (замер designer-55 по боевому fa2cebc, 25.10.2026),
     то есть снять могут и оплаченную.

     Про деньги при снятии не сказано НИЧЕГО, и это решение, а не недоделка:
     ответа про возврат нет ни на сервере, ни у владельца (Cafe13KPG#290 в
     Backlog, им не открыта), а фраза про возврат была бы обещанием
     механизма — тем самым, что этот экран и снимает.

     Цены в подписи НЕТ нарочно: она уже названа строкой «Участие» выше
     (`:2840` в живой ветке, `:3292` в демонстрационной), и второе предложение
     стоит ровно так, как в кадре описи E37g (`Cafe13KPG` dev `ab7fb83`, замер
     мой): «При записи со счёта не списывается». Своя, третья редакция этой
     фразы здесь была и снята возвратом архитектора — клиент и опись обязаны
     говорить одними словами, иначе чинить буквы придётся дважды.

     Бесплатному и донейшну фраза НЕ даётся: «Оплата — на месте» у
     бесплатного обещает платёж, которого нет, а у донейшна своя строка
     точнее — взнос по желанию и на запись не влияет. */
  var hint = e.kind === 'paid'
    ? 'Место закрепляется за вами сразу. Оплата — на месте; снять запись может работник клуба. При записи со счёта не списывается.'
    : e.kind === 'donation'
    ? 'Взнос — по желанию и на запись не влияет: передать можно мастеру на месте.'
    : '';
  return err +
    '<div class="group">' +
      '<button type="button" class="btn dup-main" data-action="book:' + esc(e.id) + '">Записаться</button>' +
      (hint ? '<span class="small" style="text-align:center">' + hint + '</span>' : '') +
    '</div>';
}

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
  var signed = 0, seats = 0, dueIfPaid = 0;
  mine.forEach(function (e) {
    var t = e.of - e.seats;
    signed += t; seats += e.of;
    if (e.kind === 'paid') dueIfPaid += t * e.price;
  });
  return (FLASH ? flash() : '') +
    '<div class="group"><span class="label">Ваши мероприятия впереди</span>' +
      '<div class="rows">' +
        '<div><span class="small">Событий</span><b class="num">' + mine.length + '</b></div>' +
        '<div><span class="small">Записалось</span><b class="num">' + signed + ' из ' + seats + '</b></div>' +
        '<div><span class="small">Наполненность</span><b class="num">' +
          (seats ? Math.round(signed / seats * 100) : 0) + ' %</b></div>' +
        '<div><span class="small">Если все заплатят</span><b class="num">' + money(dueIfPaid) + ' ฿</b></div>' +
      '</div>' +
    '</div>' +
    '<div class="group"><span class="label">Свои в афише</span>' +
      (mine.length ? mine.map(function (e) {
        return '<button type="button" class="listitem" data-event="' + esc(e.id) + '">' +
          '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.day.split(',')[0]) + '</span></span>' +
          '<span class="grow"><b>' + esc(e.title) + '</b>' +
          '<span class="small">записалось ' + (e.of - e.seats) + ' из ' + e.of +
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
      '<span>Список записавшихся и отмена — внутри мероприятия. Изменить назначенное нельзя: сервер правки не умеет, можно только снять.</span>' +
    '</div>';
}

var SCREENS = {

  home: function () {
    var m = DATA.member;
    var next = LIVE ? null : DATA.upcoming[0];
    return (FLASH ? flash() : '') +
      '<div class="card strong">' +
        '<div class="row top">' +
          '<div class="col"><h2>' + esc(m.level) + '</h2><span class="small">' + esc(untilText(m)) + '</span></div>' +
          '<span class="pill on">Активно</span>' +
        '</div>' +
        '<button type="button" class="btn" data-go="pass">' + svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/>') + 'Показать пропуск</button>' +
      '</div>' +

      '<div class="card quiet"><div class="row">' +
        '<div class="col"><span class="label">Баланс</span><span class="big num">' + money(m.balance) + ' ฿</span></div>' +
        // подпись называет ПУТЬ, а заморозка путь снимает (Cafe13KPG#510, #513): пока «На счёт» в кассе
        // закрыт, путь не обещается, но и не снят: «Через кассу — позже» — слова designer-55, измерены в слоте
        // (одна строка, 124 px из 130); прежнее «Пополнение временно недоступно» шло в две и стирало кассу
        '<span class="small" style="text-align:right;max-width:130px">' +
          (closed('tillTopup') ? 'Через кассу — позже' : 'Пополняется в кассе') + '</span>' +
      '</div></div>' +

      (next ? '<div class="group"><span class="label">Вы записаны</span>' +
        '<button type="button" class="listitem accent" data-go="bookings">' +
          '<span class="grow"><b>' + esc(next.title) + '</b><span class="small">' + esc(next.when) + '</span></span>' +
          svg(ICON.chev, 'chev') +
        '</button></div>' : '') +

      rolePanel() +

      (LIVE ? myRoles() +
        (canTopup() ? '<button type="button" class="btn ghost" data-go="topup">Внести себе на счёт</button>' : '') +
        // Одна группа «Работа»: бар и «Заявки на членство» (кадр E42g, Cafe13KPG#428) —
        // при барной роли строка главы клуба встаёт в ту же группу, а не во вторую «Работу».
        // «Люди» отсюда уехали во вкладку «Управление» (E46, Cafe13KPG#413): рабочее
        // не живёт внутри клиентского; в E42g они стояли здесь — кадр старше решения.
        (DATA.barSide || mayRequests() && WIRED.memberRequests ? '<div class="group"><span class="label">Работа</span>' +
          (DATA.barSide ? '<button type="button" class="listitem accent" data-go="barQueue">' +
            '<span class="grow"><b>Заказы на баре</b><span class="small">Очередь: принять, готово, выдан</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' +
          (mayCards() ? '<button type="button" class="listitem" data-go="barCards">' +
            '<span class="grow"><b>Карточки меню</b><span class="small">Новые позиции и утверждение</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') +
          (mayBook() ? '<button type="button" class="listitem" data-go="barMoney">' +
            '<span class="grow"><b>Доход и расход бара</b><span class="small">Выручка и затраты руками, с комментарием</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') : '') +
          // строка — только когда экран включён: до выкладки api заявок она вела бы в заглушку;
          // счёт ждущих — словами в подстрочнике, пилюли внутри .listitem у клиента нет
          (mayRequests() && WIRED.memberRequests ? '<button type="button" class="listitem" data-go="memberRequests">' +
            '<span class="grow"><b>Заявки на членство</b><span class="small">' +
              (MREQS.pending !== null ? 'Ждут ответа: ' + MREQS.pending : 'Согласие или отказ, со словом заявителю') + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') +
          '</div>' : '') +
        afishaHome() :
      '<div class="group">' +
        '<div class="row"><span class="label">На этой неделе</span>' +
        '<button type="button" class="btn quiet" data-go="events">Вся афиша</button></div>' +
        DATA.events.slice(0, 2).map(eventRow).join('') +
      '</div>');
  },

  guest: function () {
    if (LIVE) {
      return '<div class="group"><span class="label">Бар клуба</span>' +
          '<button type="button" class="listitem accent" data-go="bar">' +
            '<span class="grow"><b>Бар Café XIII</b><span class="small">Кофе, чай, авторские · заказ из приложения</span></span>' +
            svg(ICON.chev, 'chev') +
          '</button>' +
        '</div>';
      // «Услуги острова — ещё не подключено» снято: оно обещало раздел, которого
      // у клуба нет (решение владельца, Cafe13KPG#102, со слов координатора).
      // Вернуть, когда у клуба появятся настоящие услуги и ручка под них.
    }
    return '' +
      '<div class="group"><span class="label">Бар клуба</span>' +
        '<button type="button" class="listitem accent" data-go="bar">' +
          '<span class="grow"><b>Бар Café XIII</b>' +
          '<span class="small">' + (DATA.bar.open
            ? 'Кофе, чай, авторские · заказ из приложения'
            : 'Сейчас закрыт') + '</span></span>' +
          '<span class="pill' + (DATA.bar.open ? ' on' : '') + '">' +
            (DATA.bar.open ? 'открыт' : 'закрыт') + '</span>' +
        '</button>' +
      '</div>' +
      '<div class="group"><span class="label">Услуги острова</span>' +
        (DATA.services.length ? DATA.services.map(function (s) {
          return '<button type="button" class="listitem">' +
            '<span class="grow"><b>' + esc(s.title) + '</b><span class="small">' + esc(s.about) + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>';
        }).join('') : '<div class="card quiet"><span class="small">Пока ни одной.</span></div>') +
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
    if (LIVE) {
      if (PASS) return passCard(PASS, PASS_PHOTO) +
        '<div class="note">' + svg(ICON.info) +
          '<span>Код постоянный и <b>сохранён на этом телефоне</b>: если у двери нет сети, приложение покажет его без сервера. Код — это номер, а не секрет: переслать его кому-то — всё равно что отдать пропуск.</span>' +
        '</div>';
      if (PASS_FAIL) return '<div class="card strong"><h2>Пропуска нет</h2><p>' + esc(PASS_FAIL) + '</p>' +
        '<button type="button" class="btn" data-action="retry-pass">Попробовать снова</button></div>';
      return '<div class="card quiet"><div class="col"><b>Получаем пропуск…</b>' +
        '<span class="small">Сервер клуба выдаёт код один раз — дальше он не меняется.</span></div></div>';
    }
    var m = DATA.member;
    return '' +
      '<div class="pass">' +
        '<div class="who">' +
          '<span class="avatar">' + esc((m.name || '?').slice(0, 1).toUpperCase()) + '</span>' +
          '<span class="col"><b style="font-size:19px;font-family:Prata,Georgia,serif">' + esc(m.name) + '</b>' +
          '<span style="font-size:12px;color:#B8B6AE">' + esc(m.level) + ' · до ' + esc(m.until) + '</span></span>' +
        '</div>' +
        '<div class="code-box">' + pattern(m.number) + '</div>' +
        '<span class="num-big">' + esc(m.number) + '</span>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Код постоянный и <b>работает без интернета</b>. Сеть нужна тому, кто сканирует: у него на экране ваше фото и имя — переслать код другому бесполезно.</span>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Узор выше — демонстрационный. Настоящий код выдаёт сервер клуба: в Telegram здесь будет он.</span>' +
      '</div>';
  },

  membership: function () {
    if (LIVE) return membershipLive();
    // уровень — из оплаченных членств (/me), а не из роли; в демо их нет
    var have = DATA.member && DATA.member.memberships;
    var mine = function (k) { return have ? have.some(function (m) { return m.level === k; }) : DATA.role === k; };
    var tiers = [
      { name: LEVEL.member, about: 'Вход в пространство без оплаты. Афиша, записи, жизнь клуба.', mine: mine('member') },
      { name: LEVEL.organizer, about: 'Всё, что у члена клуба, плюс право проводить свои мероприятия и назначать их цену.', mine: mine('organizer') },
      { name: LEVEL.partner, about: 'Всё, что у члена клуба, плюс своё направление внутри клуба и его отчётность.', mine: mine('partner') }
    ];
    // Ни одной суммы и ни одной кнопки без действия — и в демо тоже: цен
    // владелец не называл, а демо показывают ему (решение координатора 24.10).
    return tiers.map(function (t) {
      return '<div class="card' + (t.mine ? ' strong' : '') + '">' +
        '<div class="row"><h2>' + esc(t.name) + '</h2></div>' +
        '<p style="font-size:13px">' + esc(t.about) + '</p>' +
        (t.mine ? '<span class="pill on" style="align-self:flex-start">Ваш уровень</span>' : '') +
      '</div>';
    }).join('') +
    (FLASH ? flash() : '') +
    // Кнопки «Поделиться телефоном» нет (Cafe13KPG#312): requestContact отдаёт
    // контакт БОТУ, приложению его хранить негде, а касса по телефону не ищет.
    // Вернётся, только если владелец решит собирать телефоны.
    '<div class="note">' + svg(ICON.info) +
      '<span>Оплата — в кассе, наличными или картой: работник отметит её, и уровень обновится здесь.</span>' +
    '</div>';
  },

  memberRequests: function () {
    if (!mayRequests()) return '<div class="card quiet"><span class="small">Заявки на членство смотрит и решает глава клуба.</span></div>';
    if (!MREQS.list) return MREQS.fail
      ? '<div class="card strong"><h2>Заявки не загрузились</h2><p>' + esc(MREQS.fail) + '</p>' +
        '<button type="button" class="btn" data-action="mq-retry">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем заявки…</span></div>';
    var wait = MREQS.list.filter(function (q) { return q.status === 'pending'; });
    var past = MREQS.list.filter(function (q) { return q.status !== 'pending'; });
    if (!wait.length && !past.length) return '<div class="card quiet"><div class="col"><b>Заявок нет</b>' +
      '<span class="small">Здесь появятся просьбы о членстве — из приложения, с экрана «Членство». Решение принимает глава клуба, деньги принимает касса.</span></div></div>';
    return (MREQS.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(MREQS.err) + '</span></div>' : '') +
      (wait.length ? '<div class="group"><span class="label">Ждут ответа · ' + wait.length + '</span>' + wait.map(requestCard).join('') + '</div>' : '') +
      (past.length ? '<div class="group"><span class="label">Решённые</span>' + past.map(requestRow).join('') + '</div>' : '') +
      (MREQS.ask ? noteBox('Отказ не закрывает дорогу: отклонённая заявка закрыта, и человек может подать новую. Согласие членства не создаёт — его создаёт касса, приняв деньги.') : '');
  },

  events: function () {
    var list = eventList();
    if (!list) return eventsWait();
    var shown = list.filter(function (e) { return SEG === 'все' || segOf(e) === SEG; });
    var days = [];
    shown.forEach(function (e) { if (days.indexOf(e.day) === -1) days.push(e.day); });
    return '<div class="seg">' + SEGS.map(function (s) {
        return '<button type="button" data-action="seg:' + s[0] + '" aria-pressed="' +
          (SEG === s[0]) + '">' + s[1] + '</button>';
      }).join('') + '</div>' +
      (shown.length ? days.map(function (d) {
        return '<div class="group"><span class="label">' + esc(d) + '</span>' +
          shown.filter(function (e) { return e.day === d; }).map(eventRow).join('') +
        '</div>';
      }).join('')
      : '<div class="card quiet"><span class="small">' +
        (list.length ? 'На эту часть дня ничего не назначено.' : 'В афише пока ничего нет.') +
        '</span></div>') +
      // Вход в форму стоит у того, кто имеет право завести: гостю кнопка не
      // показывается вовсе, а не отказывает по нажатию.
      (mayCreateEvent() ? '<button type="button" class="btn" data-go="eventNew">' +
        svg('<path d="M12 5v14M5 12h14"/>') + 'Создать мероприятие</button>' : '') +
      /* Переключатель в режим управления стоит ЗДЕСЬ, а не отдельной
         вкладкой: решение владельца 21.10.2026 — вкладка становится «двойной»,
         из обзора переход в администрирование (`_docs/STAGE.md` в стволе
         Cafe13KPG, со слов координатора — первоисточник в шлюзе не поднимается).
         Право то же, что у формы: кто не может завести, тому и управлять нечем,
         и кнопки он не видит вовсе, а не получает отказ по нажатию. */
      (mayCreateEvent() ? '<button type="button" class="btn ghost" data-go="organizer">' +
        svg(ICON.star) + 'Управление своими</button>' : '');
  },

  event: function (id) {
    if (LIVE) {
      if (!EVENTS) return eventsWait();
      var le = eventById(id);
      return le ? eventLive(le)
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
      foot = '<button type="button" class="btn dup-main" data-action="book">Записаться</button>' +
             '<span class="small" style="text-align:center">' +
             // Фраза держится ОДНИМ литералом нарочно: разорванная переносом, она
             // даёт ноль на построчном признаке, хотя на экране цела.
             'Место закрепляется за вами сразу. Оплата — на месте; снять запись может работник клуба. При записи со счёта не списывается.</span>';
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

       ПРОШЕДШИЕ — фраза, а не пустое место: `/events/history` отбирает
       `e.organizer_id`, то есть мастеру отдаёт ЕГО мероприятия, а члену клуба
       пустой список; «моей прошедшей записи» сервер не знает вовсе. Пустота
       читалась бы как «я никуда не ходил», и это неправда. Архив — #265.

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
        '<div class="group"><span class="label">Прошедшие записи</span>' +
        '<div class="card quiet"><span class="small">Прошедших записей приложение не показывает' +
        ' — их не отдаёт сервер. Пустое место здесь не значит, что вы никуда не ходили.</span></div></div>';
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

  tillMembership: function () { return tillForm('membership'); },
  tillTopup: function () { return tillForm('topup'); },

  organizer: function () {
    if (LIVE) return organizerLive();
    var signed = DATA.myEvents.reduce(function (a, e) { return a + e.signed; }, 0);
    var seats = DATA.myEvents.reduce(function (a, e) { return a + e.of; }, 0);
    var due = DATA.myEvents.reduce(function (a, e) {
      return a + (e.kind === 'paid' ? e.signed * e.price : 0);
    }, 0);
    return (FLASH ? flash() : '') +
      '<div class="group"><span class="label">Ваши мероприятия в этом месяце</span>' +
        '<div class="rows">' +
          '<div><span class="small">Событий</span><b class="num">' + DATA.myEvents.length + '</b></div>' +
          '<div><span class="small">Записалось</span><b class="num">' + signed + ' из ' + seats + '</b></div>' +
          '<div><span class="small">Наполненность</span><b class="num">' +
            (seats ? Math.round(signed / seats * 100) : 0) + ' %</b></div>' +
          '<div><span class="small">Соберёте с платных</span><b class="num">' + money(due) + ' ฿</b></div>' +
        '</div>' +
        '<span class="small">Наполненность события — сильнее любой цены: по нашему расчёту рост с 5 до 15 человек меняет картину вдвое больше, чем правка тарифа.</span>' +
      '</div>' +
      '<button type="button" class="btn" data-go="eventNew">' +
        svg('<path d="M12 5v14M5 12h14"/>') + 'Создать мероприятие</button>' +
      '<div class="group"><span class="label">Мои мероприятия</span>' +
        (DATA.myEvents.length ? DATA.myEvents.map(function (e) {
          return '<button type="button" class="listitem" data-manage="' + esc(e.id) + '">' +
            '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.day.split(',')[0]) + '</span></span>' +
            '<span class="grow"><b>' + esc(e.title) + '</b>' +
            '<span class="small">записалось ' + e.signed + ' из ' + e.of + ' · ' + esc(e.state) + '</span></span>' +
            svg(ICON.chev, 'chev') + '</button>';
        }).join('') : '<div class="card quiet"><span class="small">Пока ни одного. Создайте первое.</span></div>') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Цену своего мероприятия назначаете вы. Клуб берёт за уровень «Мастер», а не долю со входа.</span>' +
      '</div>';
  },

  eventNew: function () {
    var paid = FORM.kind === 'paid';
    // У человека без права формы нет вовсе: форма, отказывающая по нажатию,
    // хуже прямой строки о том, кто заводит мероприятия.
    if (LIVE && !mayCreateEvent())
      return '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Мероприятия заводят не все</b>' +
        // Слово вида — с БОЛЬШОЙ: тут речь о праве по кУПЛЕННОМУ уровню, а не о ремесле
      // (словарь облика, раздел «Мастер, мастер, организатор»): «мастер» с маленькой —
      // тот, кто ВЕДЁТ вечер, и гостевой учитель без членства прочёл бы
      // маленькую как разрешение себе (находка архитектора на #63). Сервер спрашивает
      // ровно купленное: `has_live_membership(…, ("organizer", "partner"))` либо роль
      // клуба, и отказ звучит «мероприятия заводят организатор, партнёр и
      // работники клуба» (api `events.py`, замер мой).
      //
      // УКАЗАТЕЛЯ НА ЭКРАН ЗДЕСЬ НЕТ НАРОЧНО. Прежняя редакция добавляла
      // «Свой уровень членства видно на экране «Членство»» — и отправляла на
      // ВЫКЛЮЧЕННЫЙ экран: `membership` вышло из WIRED, и в живом режиме там
      // «ещё не подключено». Нового указателя не ставлю: читатели у этого
      // отказа РАЗНЫЕ — член без права и гость без членства вовсе, и у
      // гостя вкладки «Клуб» нет (`TABS.guest`), то есть любой адрес был бы
      // верен одному и ложен другому.
        '<span class="small">Их заводят члены с уровнем «Мастер» или «Бизнес-партнёр» и работники клуба.</span>' +
      '</div></div>';
    return '<p style="font-size:13px">Появится в афише клуба сразу после публикации.</p>' +

      (EVN_ERR ? '<div class="card strong"><div class="col">' +
        '<b style="font-size:13px">Не получилось</b><span class="small">' + esc(EVN_ERR) + '</span>' +
      '</div></div>' : '') +

      '<div class="field"><label for="f-title">Название</label>' +
        '<input id="f-title" type="text" value="' + keep('f-title') + '" placeholder="Например: звуковая практика">' +
        '<span class="small">До 200 знаков.</span></div>' +

      '<div class="row" style="gap:10px;align-items:stretch">' +
        '<div class="field" style="flex:1 1 0"><label for="f-date">День</label>' +
          '<input id="f-date" type="date" value="' + keep('f-date') + '"></div>' +
        '<div class="field" style="flex:1 1 0"><label for="f-time">Начало</label>' +
          '<input id="f-time" type="time" value="' + keep('f-time', '19:00') + '">' +
          '<span class="small">Время клуба, остров.</span></div>' +
      '</div>' +

      // Не плашка-совет: эхо — ответ поля, а не подсказка. В `.note` оно
      // вдобавок начиналось на 28 px левее соседних плашек (у тех значок,
      // у него не было). Дата — тушью, хвост — подписью: разные голоса.
      echoLine(echoText(cur('f-date'), cur('f-time', '19:00'))) +

      '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Когда на острове ходят на события</b>' +
        '<span class="small">Доли спроса по 522 позициям афиши острова за 19 дней, наш замер.</span>' +
        '<div class="rows" style="margin-top:6px">' +
          DEMAND.map(function (d) {
            return '<div><span class="small">' + d.part + ' · ' + d.hours + '</span>' +
              '<b class="num">' + d.share + ' %</b></div>';
          }).join('') +
        '</div>' +
        '<span class="small" style="margin-top:6px">Пик — 19:00: каждое шестое событие острова.</span>' +
      '</div></div>' +

      '<div class="row" style="gap:10px;align-items:stretch">' +
        '<div class="field" style="flex:1 1 0"><label for="f-dur">Длительность, мин</label>' +
          // В старом черновике здесь лежит «90 мин»: числовое поле с такой
          // строкой рисуется ПУСТЫМ, и человек решил бы, что стёрлось само.
          '<input id="f-dur" type="number" inputmode="numeric" value="' +
            keep('f-dur', '90').replace(/\D+/g, '') + '">' +
          '<span class="small">От 1 до 1440.</span></div>' +
        '<div class="field" style="flex:1 1 0"><label for="f-seats">Мест</label>' +
          '<input id="f-seats" type="number" inputmode="numeric" value="' + keep('f-seats', '12') + '">' +
          '<span class="small">От 1 до 500.</span></div>' +
      '</div>' +

      '<div class="group"><span class="label">Где</span>' +
        placeSeg() +
      '</div>' +

      '<div class="group"><span class="label">Участие</span>' +
        '<div class="seg">' +
          [['paid','Платное'],['free','Бесплатное'],['donation','Донейшн']].map(function (k) {
            return '<button type="button" data-kind="' + k[0] + '" aria-pressed="' +
              (FORM.kind === k[0]) + '">' + k[1] + '</button>';
          }).join('') +
        '</div>' +
        // Три вида — не три состояния одного поля, а разная ПОДПИСЬ в одном
        // месте: у платного «Цена», у донейшна «Ориентир». У бесплатного
        // поля нет в раскладке вовсе — серое поле, которое нельзя заполнить,
        // выглядит работающим и молчит о причине.
        (FORM.kind === 'free'
          ? '<div class="note">' + svg(ICON.info) +
            '<span>Бесплатное: человек просто записывается, место держится за ним. Поля цены здесь нет — брать нечего.</span></div>'
          : '<div class="field"><label for="f-price">' + (paid ? 'Цена входа, ฿' : 'Ориентир, ฿') + '</label>' +
            '<input id="f-price" type="number" inputmode="numeric" value="' +
              keep('f-price', paid ? '400' : '') + '" placeholder="' + (paid ? '400' : '— ฿') + '">' +
            '<span class="small">' + (paid
              ? 'Больше нуля.'
              : 'Можно не указывать: взнос добровольный, и его отсутствие не мешает записаться.') +
            '</span></div>') +
      '</div>' +

      '<div class="field"><label for="f-about">Описание</label>' +
        '<input id="f-about" type="text" value="' + keep('f-about') + '" placeholder="Что будет и что взять с собой"></div>' +

      '<button type="button" class="listitem" data-toggle="filmed" aria-pressed="' + FORM.filmed + '">' +
        svg(ICON.cam, 'chev') +
        '<span class="grow"><b>Ведётся съёмка</b>' +
        '<span class="small">' + (FORM.filmed
          ? 'Участники увидят это и дадут согласие отдельно'
          : 'Отметьте, если снимаете: согласие участники дают отдельно') + '</span></span>' +
        '<span class="pill' + (FORM.filmed ? ' on' : '') + '">' + (FORM.filmed ? 'да' : 'нет') + '</span>' +
      '</button>' +

      (EVN_BUSY
        ? '<div class="card quiet"><span class="small">Отправляем…</span></div>'
        : '<button type="button" class="btn dup-main" data-action="create-event">Опубликовать в афише</button>') +
      // Единственное место, где человек ещё может перечитать поля: правок у
      // мероприятия не существует, исправляют снятием.
      '<span class="small" style="text-align:center">Исправить потом нельзя: только снять, а снятие гости видят как отмену. Перечитайте поля.</span>';
  },

  eventManage: function (id) {
    var e = DATA.myEvents.filter(function (x) { return x.id === id; })[0] || DATA.myEvents[0];
    if (!e) return '<div class="card quiet"><span class="small">Мероприятие не найдено.</span></div>';
    var paidCount = DATA.signed.filter(function (p) { return p.paid; }).length;
    return '<div class="col"><h1>' + esc(e.title) + '</h1>' +
        '<span class="small">' + esc(e.day) + ' · ' + esc(e.time) + '</span></div>' +
      '<div class="rows">' +
        '<div><span class="small">Записалось</span><b class="num">' + e.signed + ' из ' + e.of + '</b></div>' +
        (e.kind === 'paid'
          ? '<div><span class="small">Оплатили</span><b class="num">' + paidCount + ' из ' + DATA.signed.length + '</b></div>' +
            '<div><span class="small">Соберёте</span><b class="num">' + money(paidCount * e.price) + ' ฿</b></div>'
          : '<div><span class="small">Участие</span><b>' + (e.kind === 'free' ? 'Бесплатно' : 'Донейшн') + '</b></div>') +
      '</div>' +
      '<div class="group"><span class="label">Кто идёт</span>' +
        DATA.signed.map(function (p) {
          return '<div class="card"><div class="row">' +
            '<div class="col"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.when) + '</span></div>' +
            '<span class="pill' + (p.paid ? ' on' : '') + '">' + (p.paid ? 'оплачено' : 'не оплачено') + '</span>' +
          '</div></div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="btn ghost" data-action="cancel-event">Отменить мероприятие</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Отменить можно, стереть — нет: запись об отмене останется, и записавшиеся получат уведомление.</span>' +
      '</div>';
  },

  partner: function () {
    return (FLASH ? flash() : '') +
      '<button type="button" class="btn" data-go="serviceNew">' +
        svg('<path d="M12 5v14M5 12h14"/>') + 'Добавить услугу</button>' +
      '<div class="group"><span class="label">Мои услуги</span>' +
        (DATA.myServices.length ? DATA.myServices.map(function (x) {
          return '<div class="card"><div class="row top">' +
            '<div class="col"><b>' + esc(x.title) + '</b><span class="small">' + esc(x.about) + '</span></div>' +
            '<span class="pill' + (x.state === 'работает' ? ' on' : '') + '">' + esc(x.state) + '</span>' +
          '</div><div class="row"><span class="small">Цена</span><b class="num">' + esc(x.price) + '</b></div></div>';
        }).join('') : '<div class="card quiet"><span class="small">Пока ни одной.</span></div>') +
      '</div>' +
      '<div class="group"><span class="label">Отчётность направления</span>' +
        '<div class="rows">' +
          '<div><span class="small">Выручка за месяц</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Расходы и закуп</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Чистая прибыль</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Ваши 70 %</span><b class="num">[сумма]</b></div>' +
          '<div><span class="small">Клубу 30 %</span><b class="num">[сумма]</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Суммы собираются из кассы: каждая строка внесена работником и может быть отменена, но не исправлена задним числом.</span>' +
      '</div>';
  },

  serviceNew: function () {
    return '<p style="font-size:13px">Появится в разделе «Услуги» после проверки директором.</p>' +
      '<div class="field"><label for="s-title">Название</label>' +
        '<input id="s-title" type="text" placeholder="Как её назовут гости"></div>' +
      '<div class="field"><label for="s-about">Коротко, что это</label>' +
        '<input id="s-about" type="text" placeholder="Одной строкой"></div>' +
      '<div class="field"><label for="s-price">Цена</label>' +
        '<input id="s-price" type="text" placeholder="Цена в батах"></div>' +
      '<div class="field"><label for="s-contact">Кто выполняет</label>' +
        '<input id="s-contact" type="text" placeholder="Вы сами или ваш работник"></div>' +
      '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Фотографии</b>' +
        '<span class="small">Прикладываются после проверки. Снимки должны быть ваши: чужие из каталогов публиковать нельзя.</span>' +
      '</div></div>' +
      '<button type="button" class="btn dup-main" data-action="create-service">Отправить на проверку</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Новые направления в клубе принимает директор — он же назначает бизнес-партнёров.</span>' +
      '</div>';
  },

  /* Первый экран, пока согласия нет. Вкладки и «назад» на нём скрыты: уйти
     отсюда можно только решением, иначе согласие становится формальностью,
     которую проскакивают. Отказ при этом не наказывается — об этом прямо
     сказано внизу. */
  consent: function () {
    return (FLASH ? flash() : '') + '<div class="group">' +
        '<h1>Клуб запомнит вас</h1>' +
        '<p>Чтобы вести членство, записи на мероприятия и ваш счёт, клуб сохранит имя из Telegram, номер члена клуба и всё, что вы сделаете в приложении: записи, посещения, движение денег по счёту.</p>' +
      '</div>' +
      '<div class="rows">' +
        '<div><span>Данные остаются внутри клуба</span><span class="pill on">не передаём</span></div>' +
        '<div><span>Реклама и продажа данных</span><span class="pill">нет</span></div>' +
        // «и удалить» снято словом владельца 28.10: удаления себя на сервере нет — обещание было ложным
        '<div><span>Посмотреть о себе</span><span class="pill gold">в любой момент</span></div>' +
      '</div>' +
      '<button type="button" class="btn dup-main" data-action="accept-consent">Принимаю</button>' +
      '<button type="button" class="btn ghost" data-go="consentFull">Подробно</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Не согласны — просто не пользуйтесь приложением: членства вы не теряете, ваш учёт работник будет вести вручную.</span>' +
      '</div>';
  },

  consentFull: function () {
    return '<div class="group">' +
        '<h1>Как клуб хранит данные</h1>' +
        '<p>Черновик. Текст написан до проверки юристом — перед тем как открыть клуб для людей со стороны, он будет уточнён.</p>' +
      '</div>' +
      CONSENT_FULL.map(function (sec) {
        return '<div class="card"><div class="col">' +
          '<h2>' + esc(sec[0]) + '</h2>' +
          sec[1].map(function (t) { return '<p class="small">' + esc(t) + '</p>'; }).join('') +
        '</div></div>';
      }).join('') +
      '<button type="button" class="btn dup-main" data-action="accept-consent">Принимаю</button>';
  },

  /* ── бар ───────────────────────────────────────────────
     Семь требований владельца от 16.10.2026 разложены так: меню и заказ —
     bar, drink, barCart, barOrder; уведомление и работа на баре — barQueue;
     визуализатор напитка — barShot; отчёт за день — barDay; затраты —
     barExpense; кабинет куратора — curator. */

  bar: function () {
    var n = cartCount();
    if (LIVE) {
      var body = MENU_STATE === 'loading' || MENU_STATE === ''
        ? '<div class="card quiet"><span class="small">Загружаем меню…</span></div>'
        : MENU_STATE !== 'ok'
        ? '<div class="card strong"><h2>Меню не загрузилось</h2><p>' + esc(MENU_STATE) + '</p>' +
            '<button type="button" class="btn" data-action="retry-menu">Попробовать снова</button></div>'
        : !DATA.bar.menu.length
        ? '<div class="card quiet"><span class="small">В меню пока ни одной позиции — его заводит куратор бара.</span></div>'
        : DATA.bar.menu.map(function (g) {
            return '<div class="group"><span class="label">' + esc(g.group) + '</span>' +
              g.items.map(barRow).join('') + '</div>';
          }).join('');
      return (FLASH ? flash() : '') +
        '<div class="card strong"><div class="row top">' +
          '<div class="col"><h2>Бар Café XIII</h2>' +
            '<span class="small">' + (BAR && !BAR.open
              ? 'Сейчас закрыт: смена не открыта, заказ не отправится. Меню видно и так.'
              : '«Купить» — заказ на одну позицию со счёта, подадут за стойку. Несколько позиций или другое место — через «в заказ».') + '</span></div>' +
          (BAR ? '<span class="pill' + (BAR.open ? ' on' : '') + '">' + (BAR.open ? 'открыт' : 'закрыт') + '</span>' : '') +
        '</div>' +
        '<div class="row"><span class="small">На счёте</span><b class="num">' + money(DATA.member.balance) + ' ฿</b></div></div>' +
        (n ? '<div class="card accent"><div class="row">' +
          '<div class="col"><b>В заказе ' + n + ' ' + plural(n, ['позиция', 'позиции', 'позиций']) + '</b>' +
            '<span class="small num">на ' + money(cartSum()) + ' ฿</span></div>' +
          '<button type="button" class="btn quiet" data-go="barCart">Оформить</button>' +
        '</div></div>' : '') +
        body;
    }
    return (FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top">' +
        '<div class="col"><h2>Бар Café XIII</h2>' +
          '<span class="small">' + (DATA.bar.open
            ? 'Открыт до 23:00. Заказ уходит на бар сразу и оплачивается со счёта в клубе.'
            : 'Сейчас закрыт — заказ не отправится.') + '</span></div>' +
        '<span class="pill' + (DATA.bar.open ? ' on' : '') + '">' +
          (DATA.bar.open ? 'открыт' : 'закрыт') + '</span>' +
      '</div></div>' +
      (n ? '<div class="card accent"><div class="row">' +
        '<div class="col"><b>В заказе ' + n + ' ' + plural(n, ['позиция', 'позиции', 'позиций']) + '</b>' +
          '<span class="small num">на ' + money(cartSum()) + ' ฿</span></div>' +
        '<button type="button" class="btn quiet" data-go="barCart">Оформить</button>' +
      '</div></div>' : '') +
      DATA.bar.menu.map(function (g) {
        return '<div class="group"><span class="label">' + esc(g.group) + '</span>' +
          g.items.map(barRow).join('') + '</div>';
      }).join('') +
      '<div class="note">' + svg(ICON.info) +
        '<span>Меню ведёт куратор бара: состав, цены и фотографии — его решение, а не правка кода. Позиции без фотографии ждут съёмки — её делают на баре.</span>' +
      '</div>';
  },

  drink: function (id) {
    var d = findDrink(id) || drinks()[0];
    if (LIVE && !d) return '<div class="card quiet"><span class="small">Такой позиции в меню нет.</span></div>' +
      '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
    var n = CART[d.id] || 0;
    if (LIVE) {
      return (FLASH ? flash() : '') + tile(d, true) +
        '<div class="group"><h1>' + esc(d.title) + '</h1><p>' + esc(d.full || d.about) + '</p></div>' +
        '<div class="rows">' +
          '<div><span class="small">Цена</span><b class="num">' + money(d.price) + ' ฿</b></div>' +
          (d.mins ? '<div><span class="small">Готовится</span><b class="num">' + esc(d.mins) + ' мин</b></div>' : '') +
          '<div><span class="small">На счёте</span><b class="num">' + money(DATA.member.balance) + ' ฿</b></div>' +
        '</div>' +
        buyBtn(d, true) +
        (n ? '<div class="card"><div class="row"><div class="col"><b>В заказе</b>' +
              '<span class="small num">' + n + ' × ' + money(d.price) + ' = ' + money(n * d.price) + ' ฿</span></div>' +
              stepper(d) + '</div></div>' +
            '<button type="button" class="btn ghost" data-go="barCart">Оформить заказ</button>'
          : '<button type="button" class="btn ghost" data-action="cart-add:' + esc(d.id) + '">В заказ</button>') +
        // Строка рецепта — рабочая, не гостевая: право ровно такое, какое
        // пропускает сервер. Стоит ПОСЛЕ блока заказа, чтобы не двигать
        // «Купить» и «В заказ». (Экран drink — зона frontend-11, строка
        // поставлена с его согласия, 22.10.2026.)
        // Ведущего значка нет: остальные `.listitem` в файле его не имеют, а
        // класс `chev` везде стоит только у стрелки справа — чашка получала
        // бы стили стрелки (заметил frontend-11 на ревью).
        (mayRecipe() ? '<button type="button" class="listitem" data-action="recipe:' + esc(d.id) + '">' +
            '<span class="grow"><b>Рецепт</b>' +
            '<span class="small">Как готовить · สูตร</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '');
    }
    return tile(d, true) +
      '<div class="group"><h1>' + esc(d.title) + '</h1><p>' + esc(d.full || d.about) + '</p></div>' +
      '<div class="rows">' +
        '<div><span class="small">Цена</span><b class="num">' + d.price + ' ฿</b></div>' +
        '<div><span class="small">Готовится</span><b class="num">' + esc(d.mins) + ' мин</b></div>' +
        '<div><span class="small">Фотография</span><span class="pill' + SHOT[d.shot].pill + '">' +
          SHOT[d.shot].label + '</span></div>' +
      '</div>' +
      (n
        ? '<div class="card"><div class="row"><div class="col"><b>В заказе</b>' +
            '<span class="small num">' + n + ' × ' + d.price + ' = ' + money(n * d.price) + ' ฿</span></div>' +
            stepper(d) + '</div></div>' +
          '<button type="button" class="btn" data-go="barCart">Оформить заказ</button>'
        : '<button type="button" class="btn dup-main" data-action="cart-add:' + esc(d.id) + '">Добавить в заказ</button>') +
      '<div class="note">' + svg(ICON.info) +
        '<span>Фотографию в меню делают из своего снимка: на баре снимают напиток, ИИ-команда собирает карточку, куратор утверждает. Чужих картинок из каталогов здесь не будет — гость должен получить то, что увидел.</span>' +
      '</div>';
  },

  /* Экран рецепта (#176). Два блока целиком, построчной пары нет: сервер
     хранит один живой рецепт на язык, и записи независимы. Кнопки
     «Отложить заказ» здесь нет — сервер знает только making|ready|served|
     cancelled, а отмена — это деньги гостя, и называется она отменой. */
  barRecipe: function (id) {
    var d = findDrink(id);
    if (LIVE && !mayRecipe()) return '<div class="card quiet"><div class="col">' +
      '<b style="font-size:13px">Рецепт — рабочая запись бара</b>' +
      '<span class="small">Его показывают бару и куратору направления: гостю сервер его не отдаёт вовсе.</span>' +
      '</div></div>';
    return (!LIVE && FLASH ? flash() : '') +
      '<div class="col"><h1>' + esc(d ? d.title : 'Позиция ' + id) + '</h1>' +
        (d ? '<span class="small">' + esc(d.full || d.about || '') + '</span>' : '') +
      '</div>' +
      recipeBlock('Рецепт · สูตร', 'me', '') +
      recipeBlock('Recipe · English', 'en', 'en') +
      '<div class="note">' + svg(ICON.info) +
        '<span>Рецепт пишет бар: это инструкция работнику, а не карточка гостю. Нет нужного языка — попросите старшего дописать.</span>' +
      '</div>';
  },

  barCart: function () {
    var list = cartList();
    if (!list.length) {
      return '<div class="card quiet"><span class="small">Заказ пуст.</span></div>' +
        '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
    }
    var wheres = ['за стойку', 'к столу', 'с собой'];
    return '<div class="group"><span class="label">Состав</span>' +
        list.map(function (x) {
          var d = findDrink(x.id);
          return '<div class="card"><div class="row top">' +
            '<div class="col"><b>' + esc(x.title) + '</b>' +
              '<span class="small num">' + x.n + ' × ' + x.price + ' = ' + money(x.n * x.price) + ' ฿</span></div>' +
            stepper(d) + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="group"><span class="label">Куда подать</span><div class="seg">' +
        wheres.map(function (w) {
          return '<button type="button" data-where="' + esc(w) + '"' +
            (ORDER.where === w ? ' aria-pressed="true"' : '') + '>' + esc(w) + '</button>';
        }).join('') + '</div></div>' +
      /* Решение владельца, первая версия: на баре платят только со счёта,
         пополняют у хостес. Сервер наличные отклоняет (cafe13-api#13) —
         выбор, которого нет, не показываем ни в живом режиме, ни в демо. */
      '<div class="group"><span class="label">Оплата</span>' +
        '<div class="rows"><div><span>Со счёта в клубе</span><b class="num">на счёте ' + money(DATA.member.balance) + ' ฿</b></div></div>' +
        '<div class="note">' + svg(ICON.info) +
          '<span>Спишем со счёта сразу, когда заказ создан, — не при выдаче. Наличные бар не принимает. Пополнить можно у хостес. Отменить заказ может только бар — тогда деньги вернутся на счёт.</span></div></div>' +
      (DENY ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(DENY) + '</span></div>' +
              (/^на счёте/.test(DENY) ? '<button type="button" class="btn quiet" data-go="topup">Пополнить счёт</button>' : '') : '') +
      '<div class="sum"><span class="small">Итого</span><b class="big num">' + money(cartSum()) + ' ฿</b></div>' +
      '<button type="button" class="btn dup-main" data-action="send-order"' + (BUSY ? ' disabled' : '') + '>' + (BUSY ? 'Отправляем…' : 'Купить') + '</button>';
  },

  barOrder: function () {
    var o = DATA.bar.mine;
    if (LIVE && !o) {
      return (FLASH ? flash() : '') +
        (MINE_FAIL ? '<div class="card quiet"><span class="small">' + esc(MINE_FAIL) + '</span></div>'
                   : '<div class="card quiet"><span class="small">Открытого заказа на сервере нет.</span></div>') +
        '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
    }
    if (LIVE && o.state === 'cancelled') {
      return (FLASH ? flash() : '') +
        '<div class="card strong"><div class="row top"><div class="col"><h2>' + esc(o.id) + '</h2>' +
          '<span class="small">Заказ отменён.' + (o.pay === 'со счёта' ? ' Деньги вернулись на счёт: на счёте ' + money(DATA.member.balance) + ' ฿.' : '') +
          '</span></div><span class="pill">отменён</span></div></div>' +
        '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
    }
    if (!o) {
      return '<div class="card quiet"><span class="small">Открытого заказа нет.</span></div>' +
        '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
    }
    /* Макет E24: номер — главный элемент, им человек ищет заказ у бармена;
       номер, состояние и сумма — из ответа сервера, не из своего запроса. */
    if (LIVE) {
      return (FLASH ? flash() : '') +
        '<div class="num-wrap">' +
          '<span class="label">номер заказа</span>' +
          '<b class="num-big" id="order-number">' + esc(o.id) + '</b>' +
          '<span class="small">Назовите его бармену</span>' +
        '</div>' +
        '<div class="rows">' +
          '<div><span class="small">Статус заказа</span><span class="pill' + OSTATE[o.state].pill + '">' + OSTATE[o.state].label + '</span></div>' +
          '<div><span class="small">Куда</span><b>' + esc(o.where) + '</b></div>' +
          '<div><span class="small">Оплата</span><b>' + (o.pay === 'со счёта' ? 'Со счёта · уже списано' : esc(o.pay)) + '</b></div>' +
          (o.sum === null ? '' : '<div><span class="small">Сумма</span><b class="num">' + money(o.sum) + ' ฿</b></div>') +
        '</div>' +
        '<div class="group"><h2>Что заказано</h2><div class="rows">' + o.items.map(function (i) {
          return '<div><span>' + esc(i[0]) + '</span><span class="small num">' + i[1] + ' шт</span></div>';
        }).join('') + '</div></div>' +
        (MINE_FAIL ? '<div class="card quiet"><span class="small">' + esc(MINE_FAIL) + '</span></div>' : '') +
        '<button type="button" class="btn ghost" data-go="bar">Вернуться в меню</button>';
    }
    var line = ['new', 'making', 'ready', 'served'];
    var at = line.indexOf(o.state);
    var steps = [
      ['Отправлен на бар', o.at],
      ['Бар принял', 'видно, когда работник нажмёт «Принять»'],
      ['Готовится', 'обычно 3–5 минут'],
      ['Готов', o.where === 'за стойку' ? 'забирайте у стойки' : 'подадут ' + o.where],
      ['Выдан', 'заказ закрыт, строка ушла в книгу клуба']
    ];
    return (FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top">' +
        '<div class="col"><h2>' + esc(o.id) + '</h2>' +
          '<span class="small">' + esc(o.where) + ' · ' + esc(o.pay) + (o.sum === null ? '' : ' · ' + money(o.sum) + ' ฿') + '</span></div>' +
        '<span class="pill' + OSTATE[o.state].pill + '">' + OSTATE[o.state].label + '</span>' +
      '</div>' +
        '<div class="col">' + o.items.map(function (i) {
          return '<span class="small">' + i[1] + ' × ' + esc(i[0]) + '</span>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="steps">' + steps.map(function (s, i) {
        var cls = i < at + 1 ? 'done' : (i === at + 1 ? 'now' : '');
        return '<div class="' + cls + '"><i></i><span class="col"><b>' + esc(s[0]) + '</b>' +
          '<span class="small">' + esc(s[1]) + '</span></span></div>';
      }).join('') + '</div>' +
      (LIVE && MINE_FAIL ? '<div class="card quiet"><span class="small">' + esc(MINE_FAIL) + '</span></div>' : '') +
      '<button type="button" class="btn ghost" data-go="bar">Заказать ещё</button>';
  },

  /* Пополнения в приложении нет: деньги принимает касса клуба. Экран честно
     говорит, где пополнить, а не показывает выключенную кнопку без причины. */
  topup: function () {
    if (canTopup()) {
      var amt = topupAmount(TOPUP.amount);
      var how = TOPUP.method === 'card' ? 'картой' : 'наличными';
      return (FLASH ? flash() : '') +
        '<div class="card strong"><span class="label">На счёте</span>' +
          '<span class="big num">' + money(DATA.member.balance) + ' ฿</span></div>' +
        '<div class="field"><label for="t-amount">Сколько внести себе, ฿</label>' +
          '<input id="t-amount" type="text" inputmode="decimal" value="' + esc(TOPUP.amount) + '" placeholder="500"' +
          (TOPUP.ask || TOPUP.busy ? ' disabled' : '') + '></div>' +
        (TOPUP.err ? '<span class="small" style="color:var(--clay)">' + esc(TOPUP.err) + '</span>' : '') +
        '<div class="group"><span class="label">Чем</span><div class="seg">' +
          [['cash', 'Наличные'], ['card', 'Карта']].map(function (x) {
            return '<button type="button" data-action="t-method:' + x[0] + '"' +
              (TOPUP.method === x[0] ? ' aria-pressed="true"' : '') + (TOPUP.ask || TOPUP.busy ? ' disabled' : '') + '>' + x[1] + '</button>';
          }).join('') + '</div></div>' +
        (TOPUP.busy ? '<button type="button" class="btn" disabled>Вносим…</button>'
         : TOPUP.ask && amt !== null
           ? '<div class="card"><b>Внести ' + money(amt) + ' ฿ ' + how + ' на свой счёт?</b>' +
               '<span class="small">Это настоящая запись в книге клуба: внесли вы, себе.</span>' +
               '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="t-keep">Не вносить</button>' +
               '<button type="button" class="btn" data-action="t-send">Внести</button></span></div>'
           : '<button type="button" class="btn" data-action="t-ask">Внести себе на счёт</button>') +
        '<div class="note">' + svg(ICON.info) +
          '<span>Ошибочную запись отменяет касса отменой строки — в приложении этого пока нет.</span></div>' +
        (TOPUP.from === 'home' ? '' : '<button type="button" class="btn ghost" data-go="bar">Вернуться в меню</button>');
    }
    return (FLASH ? flash() : '') +
      // Пополнение члена клуба (Cafe13KPG#500): ПЕРЕПИСАННАЯ ветка этого же экрана, а не новый.
      // Все три пути сегодня серые и называют причину: ручек просьбы о пополнении ещё нет
      // (#503), а реквизиты без них обещали бы «отправьте деньги» без «и мы зачислим».
      // ⚠ Слова — черновые до кадра, кроме «Пока только баты» (слово владельца).
      '<div class="card strong"><span class="label">На счёте</span>' +
        '<span class="big num">' + money(DATA.member.balance) + ' ฿</span></div>' +
      '<div class="group"><span class="label">Как пополнить</span>' +
        [['Онлайн', 'Приём онлайн-пополнений ещё не включён.'],
         // у хостес пополнить МОЖНО уже сейчас (касса, POST /till вид topup) — серая только кнопка в приложении
         ['Касса', 'Сейчас — у хостес клуба; из приложения позже.'],
         ['USDT', 'Пока только баты.']].map(function (x) {
          return '<button type="button" class="btn ghost" disabled>' + x[0] + '</button>' +
            '<span class="small" style="text-align:center">' + x[1] + '</span>';
        }).join('') + '</div>' +
      '<button type="button" class="btn ghost" data-go="bar">Вернуться в меню</button>';
  },

  barMoney: function () {
    if (LIVE && !BAR) return (FLASH ? flash() : '') +
      (BOOK_FAIL ? '<div class="card quiet"><span class="small">' + esc(BOOK_FAIL) + '</span></div>' +
                   '<button type="button" class="btn ghost" data-action="book-retry">Повторить</button>'
                 : '<div class="card quiet"><span class="small">Загружаем направление…</span></div>');
    if (LIVE && !canBook()) return '<div class="card quiet"><span class="small">Доход и расход Бара вносит куратор направления.</span></div>';
    var inc = BOOK.kind === 'income', lock = BOOK.ask || BOOK.busy ? ' disabled' : '';
    var seg = function (label, list, cur, act) {
      return '<div class="group"><span class="label">' + label + '</span><div class="seg wrap">' +
        list.map(function (x) {
          return '<button type="button" data-action="' + act + ':' + esc(x[0]) + '"' +
            (cur === x[0] ? ' aria-pressed="true"' : '') + lock + '>' + esc(x[1]) + '</button>';
        }).join('') + '</div></div>';
    };
    var form = '';
    if (BOOK.kind) {
      var amt = topupAmount(BOOK.amount), k = pick(EXP_KINDS, BOOK.ekind);
      form =
        '<div class="field"><label for="b-amount">Сколько, ฿</label>' +
          '<input id="b-amount" type="text" inputmode="decimal" value="' + esc(BOOK.amount) + '" placeholder="240"' + lock + '></div>' +
        (inc ? seg('Чем заплатили', INCOME_HOW, BOOK.method, 'b-method')
             : seg('Категория', EXP_CATS.map(function (c) { return [c, c]; }), BOOK.cat, 'b-cat') +
               seg('Вид затраты', EXP_KINDS, BOOK.ekind, 'b-kind') +
               (USUALLY_OPEX.indexOf(BOOK.cat) !== -1
                 ? '<span class="small"><b>' + esc(BOOK.cat[0].toUpperCase() + BOOK.cat.slice(1)) + ' — обычно текущая трата.</b></span>' : '') +
               '<span class="small">' + (k ? esc(k[1]) + ' — ' + esc(k[2]) + '.'
                 : esc(EXP_KINDS[0][1]) + ' — ' + esc(EXP_KINDS[0][2]) + '. ' + esc(EXP_KINDS[1][1]) + ' — ' + esc(EXP_KINDS[1][2]) + '.') + '</span>' +
               seg('Чем платили', PAID_BY, BOOK.paid, 'b-paid')) +
        '<div class="field"><label for="b-note">Комментарий</label>' +
          '<input id="b-note" type="text" maxlength="500" value="' + esc(BOOK.note) + '" placeholder="' +
            (inc ? 'Например: выручка за вечер, 14 чеков' : 'Например: молоко, 6 литров') + '"' + lock + '></div>' +
        '<div class="field"><label for="b-date">Когда это было</label>' +
          '<input id="b-date" type="date" value="' + esc(BOOK.date || clubDay()) + '" max="' + clubDay() +
            '" min="' + daysBefore(clubDay(), BACKDATE_DAYS) + '"' + lock + '></div>' +
        (BOOK.date ? '<span class="small">Задним числом: запись попадёт в отчёт за ' + esc(dayWords(BOOK.date)) +
                       ', а не в сегодняшний.</span>' : '') +
        (BOOK.err ? '<span class="small" style="color:var(--clay)">' + esc(BOOK.err) + '</span>' : '') +
        (BOOK.busy ? '<button type="button" class="btn" disabled>Записываем…</button>'
         : BOOK.ask && amt !== null
           ? '<div class="card"><b>Записать ' + (inc ? 'доход' : 'расход') + ' ' + money(amt) + ' ฿?</b>' +
               '<span class="small">' + esc(inc ? pick(INCOME_HOW, BOOK.method)[1]
                 : BOOK.cat + ' · ' + k[1].toLowerCase() + ' · ' + pick(PAID_BY, BOOK.paid)[1].toLowerCase()) +
                 (BOOK.note.trim() ? ' · ' + esc(BOOK.note.trim()) : '') + '</span>' +
               (BOOK.date ? '<b>За ' + esc(dayWords(BOOK.date)) + ' — в сегодняшний отчёт не попадёт.</b>' : '') +
               '<span class="small">Это настоящая запись в книге клуба.</span>' +
               '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="b-keep">Не записывать</button>' +
               '<button type="button" class="btn" data-action="b-send">Записать</button></span></div>'
           : '<button type="button" class="btn" data-action="b-ask">Записать ' + (inc ? 'доход' : 'расход') + '</button>');
    }
    return (FLASH ? flash() : '') +
      '<div class="seg">' +
        '<button type="button" data-action="b-new:income"' + (inc ? ' aria-pressed="true"' : '') + lock + '>Доход</button>' +
        '<button type="button" data-action="b-new:expense"' + (BOOK.kind === 'expense' ? ' aria-pressed="true"' : '') + lock + '>Расход</button>' +
      '</div>' + form +
      (BOOK.done.length ? '<div class="group"><span class="label">Записано сейчас</span>' +
        BOOK.done.map(function (x) {
          return '<div class="card"><div class="row top">' +
            '<div class="col"><b>' + (x.inc ? 'Доход' : 'Расход') + '</b>' +
              '<span class="small">' + esc(x.how) + (x.at ? ' · ' + esc(x.at) : '') + '</span>' +
              (x.note ? '<span class="small">' + esc(x.note) + '</span>' : '') + '</div>' +
            '<b class="num">' + (x.inc ? '' : '−') + money(x.amount) + ' ฿</b>' +
          '</div></div>';
        }).join('') + '</div>' : '') +
      '<div class="note">' + svg(ICON.info) +
        '<span>Здесь — записанное с этого телефона сейчас. Все записи за день, с чьего угодно телефона, — в отчёте за день. Ошибочную запись отменяет администратор клуба.</span></div>' +
      '<button type="button" class="btn quiet" data-go="barDay">Отчёт за день</button>';
  },

  barQueue: function () {
    if (LIVE) {
      var q = QUEUE || [];
      var cnt = function (st) { return q.filter(function (o) { return o.state === st; }).length; };
      return (FLASH ? flash() : '') +
        (BAR ? shiftBlock() : '<div class="card strong"><h2>Заказы на баре</h2></div>') +
        (canBook() ? '<div class="row" style="gap:8px"><button type="button" class="btn ghost" data-go="barMoney">Доход и расход</button>' +
                     '<button type="button" class="btn ghost" data-go="barDay">Отчёт за день</button></div>' : '') +
        // Вход в карточки — здесь, а не только в «Клубе»: «Клуб» приходит вкладкой лишь
        // при живом членстве, а «Заказы» работник бара видит всегда (barSide). Кадр E41,
        // Cafe13KPG#396. Строка та же, что в группе «Работа» на home.
        (mayCards() ? '<div class="group"><span class="label">Работа</span>' +
          '<button type="button" class="listitem" data-go="barCards">' +
            '<span class="grow"><b>Карточки меню</b><span class="small">Новые позиции и утверждение</span></span>' +
            svg(ICON.chev, 'chev') + '</button></div>' : '') +
        (QUEUE_FAIL ? '<div class="card quiet"><span class="small">' + esc(QUEUE_FAIL) + '</span></div>' : '') +
        (QUEUE === null ? (QUEUE_FAIL ? '' : '<div class="card quiet"><span class="small">Загружаем очередь…</span></div>') :
          '<div class="rows">' +
            '<div><span class="small">Новых</span><b class="num">' + cnt('new') + '</b></div>' +
            '<div><span class="small">Готовится</span><b class="num">' + cnt('making') + '</b></div>' +
            '<div><span class="small">Ждут на выдаче</span><b class="num">' + cnt('ready') + '</b></div>' +
          '</div>' +
          (q.length ? '<div class="group"><span class="label">Заказы</span>' + q.map(liveCard).join('') + '</div>'
                    : '<div class="card quiet"><span class="small">Заказов за сегодня и вчера нет.</span></div>'));
    }
    var by = function (st) {
      return DATA.bar.orders.filter(function (o) { return o.state === st; }).length;
    };
    var d = DATA.bar.day;
    return (FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top">' +
        '<div class="col"><h2>Смена открыта</h2>' +
          '<span class="small">с 16:00 · ' + d.checks + ' ' + plural(d.checks, ['чек', 'чека', 'чеков']) +
          '</span></div>' +
        '<button type="button" class="btn quiet" data-go="barDay">Отчёт</button>' +
      '</div></div>' +
      '<div class="rows">' +
        '<div><span class="small">Новых</span><b class="num">' + by('new') + '</b></div>' +
        '<div><span class="small">Готовится</span><b class="num">' + by('making') + '</b></div>' +
        '<div><span class="small">Ждут на выдаче</span><b class="num">' + by('ready') + '</b></div>' +
      '</div>' +
      '<div class="group"><span class="label">Заказы</span>' +
        DATA.bar.orders.map(queueCard).join('') +
      '</div>' +
      '<div class="note">' + svg(ICON.bell) +
        '<span>Каждый новый заказ бот присылает в чат бара — составом и кнопкой «Принял», чтобы не держать приложение открытым. Звук включается в настройках этого чата, а не в приложении. В демонстрации заказы живут только в этой вкладке.</span>' +
      '</div>';
  },

  barShot: function () {
    var need = shotsNeeded();
    var how = [
      ['Днём у окна', 'без вспышки и без верхнего света'],
      ['Фон однотонный', 'дерево стойки или тёмная ткань'],
      ['Стекло протереть', 'на снимке видны все пальцы и капли'],
      ['Три кадра', 'сверху, под углом, сбоку'],
      ['Видео 5 секунд', 'как наливают или как тает лёд']
    ];
    return (FLASH ? flash() : '') +
      '<div class="group"><h1>Как напиток попадает в меню</h1>' +
        '<div class="steps">' +
          '<div class="done"><i></i><span class="col"><b>Снимаете на баре</b>' +
            '<span class="small">телефоном, по правилам ниже — три кадра и короткое видео</span></span></div>' +
          '<div class="now"><i></i><span class="col"><b>Отправляете в клуб</b>' +
            '<span class="small">снимок уходит ИИ-команде, она собирает карточку меню</span></span></div>' +
          '<div><i></i><span class="col"><b>Куратор утверждает</b>' +
            '<span class="small">после этого карточку видят гости в меню</span></span></div>' +
        '</div>' +
      '</div>' +
      '<label class="btn" for="shot-file">' + svg(ICON.cam) + 'Снять напиток' +
        '<input id="shot-file" type="file" accept="image/*,video/*" capture="environment" hidden></label>' +
      '<div class="group"><span class="label">Как снимать</span><div class="rows">' +
        how.map(function (h) {
          return '<div><span>' + esc(h[0]) + '</span><span class="small">' + esc(h[1]) + '</span></div>';
        }).join('') + '</div></div>' +
      '<div class="group"><span class="label">Ждут фотографии · ' + need.length + '</span>' +
        (need.length ? need.map(function (dr) {
          return '<div class="card"><div class="row top">' + tile(dr) +
            '<div class="col" style="flex:1 1 auto"><b>' + esc(dr.title) + '</b>' +
              '<span class="small">' + esc(dr.about) + '</span></div>' +
            '<span class="pill' + SHOT[dr.shot].pill + '">' + SHOT[dr.shot].label + '</span>' +
          '</div></div>';
        }).join('') : '<div class="card quiet"><span class="small">Все позиции с фотографиями.</span></div>') +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Приёма снимков на сервере пока нет: кнопка открывает камеру, но снимок никуда не уйдёт — экран показывает порядок работы. Потом снимок попадёт в клуб, а в меню выйдет уже готовая карточка.</span>' +
      '</div>';
  },

  barDay: function () {
    if (LIVE) return liveDay();
    var d = DATA.bar.day;
    var max = d.top.reduce(function (a, t) { return Math.max(a, t[2]); }, 0);
    return (FLASH ? flash() : '') +
      '<div class="group"><span class="label">' + esc(d.date) + '</span><div class="rows">' +
        '<div><span class="small">Выручка</span><b class="num">' + money(d.revenue) + ' ฿</b></div>' +
        '<div><span class="small">Наличными</span><b class="num">' + money(d.cash) + ' ฿</b></div>' +
        '<div><span class="small">Со счетов членов</span><b class="num">' + money(d.account) + ' ฿</b></div>' +
        '<div><span class="small">Чеков</span><b class="num">' + d.checks + '</b></div>' +
        '<div><span class="small">Позиций</span><b class="num">' + d.items + '</b></div>' +
        '<div><span class="small">Средний чек</span><b class="num">' + d.avg + ' ฿</b></div>' +
      '</div></div>' +
      '<div class="group"><span class="label">Что заказывали</span>' +
        d.top.map(function (t) {
          return '<div class="card"><div class="row">' +
            '<div class="col" style="flex:1 1 auto"><b>' + esc(t[0]) + '</b>' +
              '<span class="small num">' + t[1] + ' ' + plural(t[1], ['штука', 'штуки', 'штук']) + '</span>' +
              '<span class="meter"><span style="width:' + Math.round(t[2] / max * 100) + '%"></span></span></div>' +
            '<b class="num">' + money(t[2]) + ' ฿</b>' +
          '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="group"><span class="label">Расход за день</span><div class="rows">' +
        d.spend.map(function (s) {
          return '<div><span>' + esc(s[0]) + '<span class="small"> · ' + esc(s[1]) + '</span></span>' +
            '<b class="num">' + money(s[2]) + ' ฿</b></div>';
        }).join('') +
        '<div><span>Итого расход</span><b class="num">' + money(d.spendSum) + ' ฿</b></div>' +
      '</div>' +
      '<span class="small">' + esc(d.loss) + '</span></div>' +
      '<div class="rows">' +
        '<div><span>Наличных в кассе бара</span><b class="num">' + money(d.cashBox) + ' ฿</b></div>' +
        '<div><span class="small">получено ' + money(d.cash) + ' − выдано ' + money(d.cashOut) + '</span>' +
          '<span class="small">сверяется при закрытии</span></div>' +
      '</div>' +
      '<button type="button" class="btn" data-action="close-shift">Закрыть смену</button>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Закрытая смена не правится. Ошибку исправляют отменой строки в кассе и новой записью — обе остаются видны. Отчёт уходит куратору и в книгу событий клуба.</span>' +
      '</div>';
  },

  barExpense: function () {
    var cats = ['закуп', 'расходники', 'зарплата', 'ремонт'];
    var pays = ['касса клуба', 'наличные бара', 'свои'];
    return (FLASH ? flash() : '') +
      '<div class="group"><span class="label">Внести затрату</span>' +
        '<div class="field"><label for="e-what">Что купили</label>' +
          '<input id="e-what" type="text" value="' + keep('e-what') + '" placeholder="Например: молоко, 6 литров"></div>' +
        '<div class="field"><label for="e-sum">Сколько, ฿</label>' +
          '<input id="e-sum" type="number" inputmode="numeric" value="' + keep('e-sum') + '" placeholder="240"></div>' +
        '<div class="group"><span class="label">Категория</span><div class="seg">' +
          cats.map(function (c) {
            return '<button type="button" data-exp="' + esc(c) + '"' +
              (EXP.cat === c ? ' aria-pressed="true"' : '') + '>' + esc(c) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="group"><span class="label">Чем платили</span><div class="seg">' +
          pays.map(function (p) {
            return '<button type="button" data-expay="' + esc(p) + '"' +
              (EXP.pay === p ? ' aria-pressed="true"' : '') + '>' + esc(p) + '</button>';
          }).join('') + '</div></div>' +
        '<label class="btn ghost" for="bill-file">' + svg(ICON.cam) + 'Фото чека' +
          '<input id="bill-file" type="file" accept="image/*" capture="environment" hidden></label>' +
        '<button type="button" class="btn dup-main" data-action="add-expense">Записать затрату</button>' +
      '</div>' +
      '<div class="group"><span class="label">Последние затраты</span>' +
        DATA.bar.expenses.map(function (x) {
          return '<div class="card"><div class="row top">' +
            '<div class="col"><b>' + esc(x.what) + '</b>' +
              '<span class="small">' + esc(x.cat) + ' · ' + esc(x.pay) + ' · ' + esc(x.when) + '</span></div>' +
            '<b class="num">' + money(x.sum) + ' ฿</b>' +
          '</div></div>';
        }).join('') +
        '<div class="rows"><div><span>За ' + esc(DATA.bar.month.name.toLowerCase()) + '</span>' +
          '<b class="num">' + money(DATA.bar.month.spend) + ' ฿</b></div></div>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Затраты направления определяют чистую прибыль, а от неё клуб берёт свои 30 %. Если направление считается с вала, затраты всё равно нужны — но на долю клуба они не влияют. Способ выбран при заведении направления.</span>' +
      '</div>';
  },

  curator: function () {
    var m = DATA.bar.month;
    var max = m.days.reduce(function (a, d) { return Math.max(a, d[1]); }, 0);
    var all = drinks().length, withShot = drinks().filter(function (d) { return d.shot === 'ready'; }).length;
    var atAi = drinks().filter(function (d) { return d.shot === 'ai'; }).length;
    return (FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top">' +
        '<div class="col"><h2>Бар</h2>' +
          '<span class="small">Первое направление клуба · куратор ' + esc(DATA.bar.curator) +
          ' · на баре ' + esc(DATA.bar.staff) + '</span></div>' +
        '<span class="pill on">работает</span>' +
      '</div></div>' +
      '<div class="group"><span class="label">' + esc(m.name) + ' · ' + m.shifts + ' ' +
        plural(m.shifts, ['смена', 'смены', 'смен']) + '</span><div class="rows">' +
        '<div><span class="small">Выручка</span><b class="num">' + money(m.revenue) + ' ฿</b></div>' +
        '<div><span class="small">Затраты направления</span><b class="num">' + money(m.spend) + ' ฿</b></div>' +
        '<div><span class="small">Чистая прибыль</span><b class="num">' + money(m.net) + ' ฿</b></div>' +
        '<div><span class="small">Клубу · 30 % от чистой</span><b class="num">' + money(m.club) + ' ฿</b></div>' +
        '<div><span class="small">Направлению</span><b class="num">' + money(m.own) + ' ฿</b></div>' +
        '<div><span class="small">В среднем за смену</span><b class="num">' + money(m.perShift) + ' ฿</b></div>' +
      '</div>' +
      '<span class="small">Способ расчёта — 30 % от чистой прибыли. По второму способу клуба, 13 % с вала, вышло бы ' +
        money(m.gross13) + ' ฿: он разумен там, где чистую считать тяжело или незачем. Способ выбирается при заведении направления и определяет, что направление обязано показывать.</span></div>' +
      '<div class="group"><span class="label">По дням</span>' +
        m.days.map(function (d) {
          return '<div class="card"><div class="row">' +
            '<div class="col" style="flex:1 1 auto"><b class="num">' + esc(d[0]) + '</b>' +
              '<span class="meter"><span style="width:' + Math.round(d[1] / max * 100) + '%"></span></span></div>' +
            '<b class="num">' + money(d[1]) + ' ฿</b>' +
          '</div></div>';
        }).join('') +
        '<button type="button" class="btn quiet" data-go="barDay">Отчёт за день</button>' +
      '</div>' +
      '<div class="group"><span class="label">Меню и фотографии</span><div class="rows">' +
        '<div><span class="small">Позиций в меню</span><b class="num">' + all + '</b></div>' +
        '<div><span class="small">С фотографией</span><b class="num">' + withShot + '</b></div>' +
        '<div><span class="small">У ИИ-команды</span><b class="num">' + atAi + '</b></div>' +
        '<div><span class="small">Нужна съёмка</span><b class="num">' + (all - withShot - atAi) + '</b></div>' +
      '</div>' +
        '<button type="button" class="btn quiet" data-go="barShot">Съёмка и фотографии</button>' +
        '<button type="button" class="btn quiet" data-go="bar">Меню как у гостя</button>' +
      '</div>' +
      '<div class="note">' + svg(ICON.info) +
        '<span>Числа собираются из кассы и книги событий клуба: каждую строку внёс человек, её можно отменить, но не исправить задним числом. Поэтому отчёт куратора и отчёт клуба сходятся по построению.</span>' +
      '</div>';
  },

  barCards: function () {
    if (LIVE && !mayCards()) return '<div class="card quiet"><span class="small">Карточки меню заводит бар или куратор направления.</span></div>';
    if (!CARDS.list) return CARDS.fail
      ? '<div class="card quiet"><span class="small">' + esc(CARDS.fail) + '</span></div>' +
        '<button type="button" class="btn ghost" data-action="c-reload">Повторить</button>'
      : '<div class="card quiet"><span class="small">Загружаем карточки…</span></div>';
    var L = CARDS.list;
    var parts = [
      ['Ждут утверждения', L.filter(function (c) { return c.state === 'review'; })],
      ['Возвращены', L.filter(cardReturned)],
      ['Черновики', L.filter(function (c) { return c.state === 'draft' && !c.note; })],
      // рабочее меню — над снятым: у бара «В меню» самая длинная группа (решение координатора, 23.10.2026)
      ['В меню', L.filter(function (c) { return c.state === 'active'; })],
      ['Сняты', L.filter(function (c) { return c.state === 'hidden' && !c.note; })]
    ];
    // «Новая карточка» — под списком: работа здесь — очередь утверждения,
    // а заведение карточки случается реже (designer-55, 22.10.2026). В Telegram
    // её место — главная кнопка (mainFor), доступная при любой длине списка.
    return (!LIVE && FLASH ? flash() : '') +
      '<div class="card quiet"><span class="small">Направление «Бар»</span></div>' +
      parts.filter(function (x) { return x[1].length; }).map(function (x) {
        return '<div class="group" data-cards="' + esc(x[0]) + '"><span class="label">' + esc(x[0]) + ' · ' + x[1].length + '</span>' +
          x[1].map(cardRow).join('') + '</div>';
      }).join('') +
      (L.length ? '' : '<div class="card quiet"><span class="small">Карточек пока нет — ни в меню, ни в работе.</span></div>') +
      '<button type="button" class="btn ghost dup-main" data-action="c-new">Новая карточка</button>';
  },

  barCard: function (id) {
    if (LIVE && !mayCards()) return '<div class="card quiet"><span class="small">Карточки меню заводит бар или куратор направления.</span></div>';
    var lock = CARD.busy ? ' disabled' : '';
    var deny = CARD.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(CARD.deny) + '</span></div>' : '';
    var note = CARD.note ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(CARD.note) + '</span></div>' : '';
    if (id === 'new') {
      var v = function (k) { return esc(CARD.v[k] || ''); };
      var groups = groupsOf();
      return (!LIVE && FLASH ? flash() : '') +
        '<div class="card">' +
        '<div class="field"><label for="c-title">Название</label><input id="c-title" type="text" maxlength="200" value="' + v('c-title') + '" placeholder="Например: раф на овсяном"' + lock + '>' +
          '<span class="small">До 200 знаков.</span></div>' +
        '<div class="field"><label for="c-group">Группа меню</label><input id="c-group" type="text" maxlength="80" value="' + v('c-group') + '" placeholder="Например: кофе"' + lock + '>' +
          '<span class="small">До 80 знаков.</span></div>' +
        (groups.length ? '<div class="seg wrap">' + groups.map(function (g) {
          return '<button type="button" data-action="c-group:' + esc(g) + '"' + ((CARD.v['c-group'] || '') === g ? ' aria-pressed="true"' : '') + lock + '>' + esc(g) + '</button>';
        }).join('') + '</div>' : '') +
        (CARD.groupAsk ? '<div class="note">' + svg(ICON.info) + '<span>Это та же группа, что «' + esc(CARD.groupAsk) + '»?</span></div>' +
          // имя группы — в вопросе строкой выше, не в кнопке: длинное имя вынесло бы ряд за край
          // два ответа на один вопрос — пополам, как любой выбор из двух (.seg), а не по краям ряда
          '<div class="seg"><button type="button" data-action="c-group-theirs">Да, та же</button>' +
          '<button type="button" data-action="c-group-mine">Нет, новая</button></div>' : '') +
        // stretch — как в eventNew: под «Минутами» подпись, и без перебивки .row центрует поля, разводя подписи
        '<div class="row" style="gap:10px;align-items:stretch"><div class="field"><label for="c-price">Цена, ฿</label><input id="c-price" type="text" inputmode="decimal" value="' + v('c-price') + '"' + lock + '></div>' +
        '<div class="field"><label for="c-mins">Минуты</label><input id="c-mins" type="text" inputmode="numeric" value="' + v('c-mins') + '"' + lock + '>' +
          '<span class="small">От 1 до 600, можно пусто.</span></div></div>' +
        '<div class="field"><label for="c-about">Описание для гостя</label><input id="c-about" type="text" value="' + v('c-about') + '" placeholder="Например: двойной ристретто, молоко"' + lock + '></div>' +
        // тот же жест, что «Ведётся съёмка» в форме мероприятия: строка с пометкой да/нет
        '<button type="button" class="listitem" data-action="c-alcohol" aria-pressed="' + CARD.alcohol + '"' + lock + '>' +
          '<span class="grow"><b>Алкоголь</b><span class="small">Отметьте, если в составе есть алкоголь</span></span>' +
          '<span class="pill' + (CARD.alcohol ? ' on' : '') + '">' + (CARD.alcohol ? 'да' : 'нет') + '</span></button>' +
        (CARD.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(CARD.err) + '</span></div>' : '') +
        deny +
        '<button type="button" class="btn dup-main" data-action="c-save"' + lock + '>' + (CARD.busy ? 'Сохраняем…' : 'Сохранить черновик') + '</button>' +
        '<span class="small">Поля потом не исправить — только снять карточку и завести заново.</span>' +
      '</div>';
    }
    if (!CARDS.list) return CARDS.fail ? '<div class="card quiet"><span class="small">' + esc(CARDS.fail) + '</span></div>'
                                       : '<div class="card quiet"><span class="small">Загружаем карточку…</span></div>';
    var c = cardBy(id);
    if (!c) return '<div class="card quiet"><span class="small">Карточки нет в списке направления.</span></div>';
    var cur = cardCurator(), has = c.recipes.indexOf(CARD.lang) !== -1;
    if (has) recipeLoad(c.id, CARD.lang);     // заменяя рецепт, человек видит прежний
    var back = cardReturned(c);
    var STATE_WORDS = { draft: back ? 'Возвращена' : 'Черновик', review: 'Ждёт утверждения', active: 'В меню', hidden: back ? 'Возвращена' : 'Снята' };
    var langs = '<div class="seg">' + CARD_LANGS.map(function (l) {
      return '<button type="button" data-action="c-lang:' + l[0] + '"' + (CARD.lang === l[0] ? ' aria-pressed="true"' : '') + lock + '>' +
        l[1] + (c.recipes.indexOf(l[0]) !== -1 ? ' ·' : '') + '</button>';
    }).join('') + '</div>';
    var text = CARD.text[CARD.lang] !== undefined ? CARD.text[CARD.lang] : '';
    var waiting = has && CARD.body[CARD.lang] === null;
    var acts = '';
    if ((c.state === 'draft' || c.state === 'hidden'))
      acts += '<button type="button" class="btn" data-action="c-review:' + c.id + '"' + lock + '>Отправить на утверждение</button>';
    if (cur && c.state === 'review') {
      acts += c.recipes.length
        ? '<button type="button" class="btn" data-action="c-approve:' + c.id + '"' + lock + '>Утвердить — в меню</button>'
        // запрет верный, вес — нет: недоступное не тяжелее единственного доступного (designer-55)
        : '<span class="small">Сначала рецепт — без него позиция не попадёт в меню.</span><button type="button" class="btn ghost" disabled>Утвердить — в меню</button>';
      acts += CARD.back
        ? '<div class="field"><label for="c-reason">Почему возвращаете</label><input id="c-reason" type="text" maxlength="500" value="' + esc(CARD.reason) + '" placeholder="Например: нет фото, цена выше соседних"' + lock + '></div>' +
          '<div class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="c-back-keep"' + lock + '>Не возвращать</button>' +
          '<button type="button" class="btn quiet" data-action="c-back-send:' + c.id + '"' + lock + '>Вернуть</button></div>'
        : '<button type="button" class="btn quiet" data-action="c-back">Вернуть с причиной</button>';
    }
    if (cur && c.state === 'active')
      acts += CARD.hideAsk
        ? '<span class="small">Гости перестанут видеть позицию в меню сразу.</span><div class="row" style="gap:6px">' +
          '<button type="button" class="btn quiet" data-action="c-hide-keep"' + lock + '>Оставить</button>' +
          '<button type="button" class="btn quiet" data-action="c-hide:' + c.id + '"' + lock + '>Точно снять</button></div>'
        : '<button type="button" class="btn quiet" data-action="c-hide-ask">Снять с меню</button>';
    if (!acts && c.state === 'review') acts = '<span class="small">Ждёт решения куратора направления.</span>';
    return (!LIVE && FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top"><div class="col"><h2>' + esc(c.title) + '</h2>' +
        '<span class="small">' + esc(c.group) + ' · ' + money(c.price) + ' ฿' + (c.mins ? ' · ' + c.mins + ' мин' : '') + (c.alcohol ? ' · алкоголь' : '') + '</span></div>' +
        '<span class="pill' + (c.state === 'active' ? ' on' : back ? ' warm' : '') + '">' + esc(STATE_WORDS[c.state]) + '</span></div>' +
        (c.about ? '<span class="small">' + esc(c.about) + '</span>' : '') +
        (back ? '<div class="note">' + svg(ICON.info) + '<span>Вернул куратор: ' + esc(c.note) + '</span></div>' : '') +
      '</div>' + note + photoBlock(c) +
      '<div class="group"><span class="label">Рецепт</span>' + langs +
        '<div class="field"><label for="c-recipe">Рецепт (' + CARD.lang.toUpperCase() + ')' + (has ? '' : ' — пока нет') + '</label>' +
          '<textarea id="c-recipe" rows="6"' + (waiting ? ' disabled' : lock) + '>' + esc(text) + '</textarea></div>' +
        (CARD.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(CARD.err) + '</span></div>' : '') +
        '<span class="small">Рецепт видит только бар, гость — нет.</span>' +
        '<button type="button" class="btn ghost" data-action="c-recipe:' + c.id + '"' + (waiting ? ' disabled' : lock) + '>' +
          (has ? 'Заменить рецепт (' : 'Сохранить рецепт (') + CARD.lang.toUpperCase() + ')</button>' +
      '</div>' +
      '<div class="group"><span class="label">Решение</span>' + deny + (acts || '<span class="small">Действий нет.</span>') + '</div>';
  },

  // E46: ровно два входа — решение владельца 28.10.2026 (#413). «Заявки на членство» (E42)
  // остаются на главной: это другая очередь, для уже допущенных.
  manage: function () {
    if (!mayPeople()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Просьбы о вступлении смотрит и решает глава клуба.</span></div></div>';
    // пока счёт не пришёл — не ноль: ноль значил бы «никто не просится» (кадр E46)
    var wait = JOINQ.list ? JOINQ.list.filter(function (q) { return q.status === 'pending'; }).length : null;
    return '<div class="group"><span class="label">Кто в клубе</span>' +
      '<button type="button" class="listitem" data-go="joinQueue"><span class="grow"><b>Заявки на доступ</b>' +
        '<span class="small">' + (wait !== null ? 'Ждут ответа: ' + wait : 'Кто просится в клуб') + '</span></span>' +
        svg(ICON.chev, 'chev') + '</button>' +
      '<button type="button" class="listitem" data-go="people"><span class="grow"><b>Члены клуба</b>' +
        '<span class="small">Кто в клубе и с какими уровнями</span></span>' + svg(ICON.chev, 'chev') + '</button>' +
    '</div>';
  },

  // E45 очередь, E45b пусто, E45g только решённые, E45v отказ со словом
  joinQueue: function () {
    // E45zh: слова — отказа сервера (_may_decide, 403) буквой; кнопок нет — идти отсюда некуда
    if (!mayPeople()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Просьбы о вступлении смотрит и решает глава клуба.</span></div></div>';
    if (!JOINQ.list) return JOINQ.fail
      ? '<div class="card strong"><h2>Просьбы не загрузились</h2><p>' + esc(JOINQ.fail) + '</p>' +
        '<button type="button" class="btn" data-action="j-retry">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем просьбы…</span></div>';
    var wait = JOINQ.list.filter(function (q) { return q.status === 'pending'; });
    var past = JOINQ.list.filter(function (q) { return q.status !== 'pending'; });
    var note = noteBox('Согласие одним действием впускает в приложение И создаёт членство. Отказ не отменяется: второго решения сервер не примет.');
    if (!wait.length && !past.length) return '<div class="card quiet"><div class="col"><b>Просьб нет</b>' +
      '<span class="small">Здесь появятся просьбы о доступе — от людей, которых в приложении ещё нет. Они приходят с экрана оплаты, вместе с чеком.</span></div></div>' + note;
    return (JOINQ.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOINQ.err) + '</span></div>' : '') +
      (wait.length ? '<div class="group"><span class="label">Ждут ответа · ' + wait.length + '</span>' + wait.map(joinCard).join('') + '</div>' + note : '') +
      (past.length ? '<div class="group"><span class="label">Решённые</span>' + past.map(joinRow).join('') + '</div>' : '');
  },

  people: function () {
    if (LIVE && !mayPeople()) return '<div class="card quiet"><span class="small">Выдавать и снимать ответственность может глава клуба.</span></div>';
    if (!PEOPLE.list) return PEOPLE.fail
      ? '<div class="card quiet"><span class="small">' + esc(PEOPLE.fail) + '</span></div>' +
        '<button type="button" class="btn ghost" data-action="p-reload">Повторить</button>'
      : '<div class="card quiet"><span class="small">Загружаем людей…</span></div>';
    // E47e: поля остатка нет у сервера — прочерк объясняется ОДИН раз, над списком
    var noBal = PEOPLE.list.some(function (x) { return x.bal === undefined; });
    return (!LIVE && FLASH ? flash() : '') +
      '<div class="field"><label for="p-find">Найти по имени</label>' +
        '<input id="p-find" type="search" value="' + esc(PEOPLE.find) + '" placeholder="Имя"></div>' +
      (noBal && PEOPLE.list.length ? '<div class="card quiet"><span class="small">Остаток сервер не отдаёт — у этой ручки поля ещё нет. Прочерк здесь значит «не спросили», а не «ноль».</span></div>' : '') +
      (PEOPLE.list.length ? peopleOrder(PEOPLE.list).map(function (k) { return personCard(PEOPLE.list[k], k); }).join('')
                          : '<div class="card quiet"><span class="small">Сервер не вернул ни одного человека.</span></div>');
  },

  /* Состояния входа. Каждое — свой экран со своей причиной: пустой кабинет
     у незнакомого выглядел бы как «вы в клубе, просто денег нет». */
  loading: function () {
    return '<div class="card quiet"><div class="col"><b>Узнаём вас…</b>' +
      '<span class="small">Сервер клуба проверяет подпись Telegram.</span></div></div>';
  },

  noSign: function () {
    return '<div class="card strong"><h2>Подпись не принята</h2>' +
      '<p>Сервер клуба не смог убедиться, что вход идёт из Telegram. Так бывает, если приложение открыто давно или не через бота.</p>' +
      '<p class="small">Закройте приложение и откройте его снова кнопкой меню в чате с ботом.</p></div>';
  },

  // Тетрадь клуба внутри приложения (v74): рамка только по свежему токену
  // кадры E49 (тетрадь), E49b (пока грузится), E49v (отказ — листа нет вовсе: отказ приходит JSON-ом)
  joinAbout: function () {
    if (ABOUT.fail) return '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(ABOUT.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="about-retry">Попробовать снова</button>' +
        '<span class="small" style="text-align:center">Тетрадь живёт на сервере клуба — без него её не показать.</span>';
    return '<div class="paper">' +
        '<div class="wait"' + (ABOUT.loaded ? ' hidden' : '') + '><span>Открываем тетрадь клуба</span>' +
          '<span class="small" style="text-align:center">Страница большая — это занимает секунду</span></div>' +
        (ABOUT.url ? '<iframe class="about" src="' + esc(ABOUT.url) + '" title="О клубе"' + (ABOUT.loaded ? '' : ' hidden') +
          ' onload="aboutLoaded()"></iframe>' : '') +
      '</div>';
  },

  // Кого нет в списке: просьба о вступлении (кадры E44*, Cafe13KPG#459)
  noAccess: function () {
    var j = JOIN.info, note = '<div class="note">' + svg(ICON.info) +
      '<span>Приложение денег не принимает: оплата идёт прямо в клуб.</span></div>';
    var head = '<h2>Вас ещё нет в списке</h2>' + joinWho() +
      '<p>Приложение открыто тем, кого внёс владелец. Попасть в список можно отсюда.</p>';
    if (!j) return '<div class="card strong">' + head +
      (JOIN.fail ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.fail) + '</span></div>' +
        '<button type="button" class="btn" data-action="join-retry">Попробовать снова</button>' : '') + '</div>';
    var q = j.request;
    // E44g: ждёт ответа — отправки нет, вторую сервер отвергнет
    if (q && q.status === 'pending') return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2>Просьба отправлена</h2>' + joinWho() + '</div><span class="pill">ЖДЁТ ОТВЕТА</span></div>' +
        '<p>Глава клуба посмотрит чек и ответит здесь же. Второй раз просить не нужно: сервер отвечает «ваша просьба уже ждёт ответа».</p></div>' + note;
    // E44e: согласовано, а /me читался при старте — войти тем же путём, что «Попробовать снова»
    if (q && q.status === 'approved') return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2>Вас приняли в клуб</h2>' + joinWho() + '</div><span class="pill">СОГЛАСОВАНО</span></div>' +
        '<p>Членство уже создано. Осталось войти — приложение перечитает вас с сервера.</p>' +
        '<button type="button" class="btn" data-action="retry">Войти в клуб</button>' +
        '<span class="small" style="text-align:center">Если клуб всё ещё не открылся — закройте приложение и откройте снова.</span></div>';
    // E44d: отказано — слово решившего плашкой, это чужая прямая речь
    if (q && q.status === 'rejected' && !JOIN.again) return '<div class="card strong"><div class="row top"><div class="col">' +
        '<h2 style="color:var(--clay-ink)">Просьба отклонена</h2>' + joinWho() + '</div><span class="pill warm">ОТКАЗАНО</span></div>' +
        '<p>Можно попросить снова — например, с другим чеком.</p>' +
        (q.note ? '<div class="deny">' + svg(ICON.info) + '<span>«' + esc(q.note) + '»</span></div>' : '') +
        '<button type="button" class="btn" data-action="join-again">Попросить снова</button></div>';
    // E44, E44b, E44v: просьбы нет — форма
    var m = JOIN_PAY[JOIN.pay], img = JOIN.img[JOIN.pay], f = JOIN.file, gone = img === 'fail';
    return '<div class="card strong">' + head +
        '<button type="button" class="btn quiet" data-action="join-about">О клубе</button></div>' +
      '<div class="group"><span class="label">Чем платить</span><div class="seg">' +
        Object.keys(JOIN_PAY).map(function (k) {
          return '<button type="button" data-action="join-pay:' + k + '" aria-pressed="' + (JOIN.pay === k) + '">' + JOIN_PAY[k].name + '</button>';
        }).join('') + '</div>' +
        '<div class="qr"><div>' +
          // E44zh: реквизитов нет — строка вместо квадрата (сообщению нужна ширина), суммы нет, платить не по чему
          (gone ? '<div class="row"><span class="small">Реквизиты не загрузились</span>' +
                  '<button type="button" class="btn quiet mini" data-action="join-req-retry">Повторить</button></div>' +
                '<div class="row"><span class="small">' + m.where + '</span><span class="small">суммы нет</span></div>' +
                '<span class="small">Платить не по чему, пока их нет.</span>'
           : (img && img !== 'loading' ? '<div class="place img"><img src="' + esc(img) + '" alt="Реквизиты ' + m.name + '"></div>'
              : '<div class="place"><span>Загружаем реквизиты…</span></div>') +
            '<div class="row"><span class="small">' + m.where + '</span><b class="num">' +
              money(JOIN.pay === 'usdt' ? j.usd : j.thb) + ' ' + m.cur + '</b></div>' +
            '<span class="small">' + m.hint + '</span>') + '</div></div></div>' +
      '<div class="field"><label for="join-said">Пара слов о себе <span class="small">— необязательно</span></label>' +
        '<textarea id="join-said" maxlength="1000" placeholder="Кто вы и почему хотите в клуб">' + esc(JOIN.said) + '</textarea></div>' +
      // близнец «Фото чека» затрат, но без камеры по умолчанию: чек уже лежит в телефоне (кадр E44)
      '<label class="btn ghost" for="join-file">' + svg(f ? ICON.check : ICON.cam) + (f ? 'Чек приложен · заменить' : 'Приложить чек') +
        '<input id="join-file" type="file" accept="' + RECEIPT_TYPES.join(',') + '" hidden></label>' +
      '<span class="small" style="text-align:center">' +
        (f ? (f.pdf ? 'PDF' : 'Фото') + ' · ' + money(Math.max(1, Math.round(f.size / 1024))) + ' КБ' : 'Фото или PDF, до 2 МБ') + '</span>' +
      (JOIN.fileErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.fileErr) + '</span></div>' : '') +
      (JOIN.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOIN.err) + '</span></div>' : '') +
      '<button type="button" class="btn" data-action="join-send"' + (!f || gone || JOIN.busy ? ' disabled' : '') + '>' +
        (JOIN.busy ? '…' : 'Отправить запрос') + '</button>' + note;
  },

  apiDown: function () {
    // Без сети пропуск, сохранённый раньше, всё равно нужен у двери.
    var p = FAIL_NET ? savedPass() : null;
    return '<div class="card strong"><h2>Сервер клуба недоступен</h2>' +
      '<p>' + esc(FAIL) + ' Показывать вместо ваших данных примерные мы не будем.</p>' +
      '<button type="button" class="btn" data-action="retry">Попробовать снова</button></div>' +
      (p ? '<div class="group"><span class="label">Пропуск, сохранённый на телефоне</span>' + passCard(p) + '</div>' : '');
  },

  soon: function () {
    return notWired(TITLES[current] || 'Этот раздел');
  },

  // не `notWired`: тот говорит «работает только в демонстрации… подключат к серверу», а
  // замороженный экран был подключён — для него это неправда (Cafe13KPG#510)
  frozen: function () {
    return '<div class="card quiet"><div class="col">' +
      '<b style="font-size:13px">' + esc(TITLES[current] || 'Этот раздел') + ' — временно недоступно</b>' +
      // текст designer-55: «данные на месте» — первое, о чём думает человек, увидевший пустоту на месте своей работы
      '<span class="small">Раздел выключен в приложении, данные на сервере на месте. Вернётся, когда дойдут руки.</span>' +
    '</div></div>';
  },

  demo: function () {
    // В Telegram это не демонстрация: данные настоящие. Панель — тестовый
    // режим и просмотр чужими глазами; список людей даёт сервер, своей
    // таблицы людей в публичном клиенте нет.
    if (LIVE) {
      var ver = '<span class="small">Версия приложения: <b>' + esc(VERSION) + '</b></span>';
      if (TEST.busy) return '<div class="card quiet"><span class="small">Переключаемся…</span></div>' + ver;
      if (TEST.as) return (FLASH ? flash() : '') +
        '<div class="card quiet"><div class="col"><b>Смотрите как ' + esc(TEST.as.name) + '</b>' +
          '<span class="small">Чтобы выбрать другого, выйдите из просмотра.</span></div></div>' +
        '<button type="button" class="btn" data-action="test-self">Выйти из просмотра</button>' + ver;
      if (TEST.on) return (FLASH ? flash() : '') +
        '<div class="group"><span class="label">Смотреть как</span>' +
          (TEST.fail ? '<div class="card quiet"><span class="small">' + esc(TEST.fail) + '</span></div>'
           : TEST.people === null ? '<div class="card quiet"><span class="small">Загружаем список…</span></div>'
           : !TEST.people.length ? '<div class="card quiet"><span class="small">В тестовой базе некого выбрать.</span></div>'
           : TEST.people.map(function (p) {
               return '<button type="button" class="listitem" data-action="test-as:' + p.id + '">' +
                 '<span class="grow"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.what) + '</span></span>' +
                 svg(ICON.chev, 'chev') + '</button>';
             }).join('')) +
        '</div>' +
        '<span class="small">Нажатия в тестовом режиме записываются в тестовую базу: деньги и записи там ненастоящие, боевая база не меняется.</span>' +
        '<button type="button" class="btn ghost" data-action="test-off">Выйти из тестового режима</button>' + ver;
      return (FLASH ? flash() : '') +
        '<div class="card quiet"><div class="col"><b>Тестовый режим</b>' +
          (TEST.health === 'configured'
            ? '<span class="small">Приложение переключится на тестовую базу: можно смотреть глазами любого человека из списка и нажимать всё — деньги там ненастоящие.</span>' +
              '<button type="button" class="btn" data-action="test-on">Войти в тестовый режим</button>'
            : TEST.health === 'unset' ? '<span class="small">Тестовая база ещё не выложена — режим недоступен.</span>'
            : TEST.health === 'loading' || TEST.health === '' ? '<span class="small">Проверяем, выложена ли тестовая база…</span>'
            : '<span class="small">Не удалось узнать, выложена ли тестовая база: ' + esc(TEST.health) + '</span>' +
              '<button type="button" class="btn ghost" data-action="test-health">Проверить снова</button>') +
        '</div></div>' + ver;
    }
    var roles = [
      ['guest', 'Гость', 'без членства: только услуги'],
      ['member', 'Член клуба', 'пропуск, афиша, записи'],
      ['organizer', LEVEL.organizer, 'то же плюс свои мероприятия'],
      ['partner', 'Бизнес-партнёр', 'то же плюс своё направление и его отчётность'],
      ['staff', 'Работник', 'касса: внести и отменить'],
      ['bar', 'Бар · исполнитель', 'заказы, съёмка напитков, затраты, смена'],
      ['curator', 'Куратор направления', 'отчётность бара и доля клуба']
    ];
    return '<div class="card quiet"><div class="col">' +
        '<b>Это демонстрация</b>' +
        '<span class="small">Версия приложения: <b>' + esc(VERSION) + '</b></span>' +
        '<span class="small">Страница открыта вне Telegram: членство, события и баланс зашиты в страницу, роль переключается вручную. В Telegram приложение работает на сервере клуба, и роль приходит оттуда.</span>' +
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
      '</div>' +
      '<div class="group"><span class="label">Согласие на данные</span>' +
        '<button type="button" class="btn quiet" data-action="reset-consent">Показать экран согласия заново</button>' +
        '<span class="small">Согласие спрашивается один раз. Кнопка стирает отметку в этом браузере, чтобы экран можно было посмотреть ещё раз.</span>' +
      '</div>';
  }
};

function notWired(what) {
  return '<div class="card quiet"><div class="col">' +
    '<b style="font-size:13px">' + esc(what) + ' — ещё не подключено</b>' +
    '<span class="small">Этот раздел пока работает только в демонстрации. Здесь будут настоящие данные клуба, как только раздел подключат к серверу.</span>' +
  '</div></div>';
}

function myRoles() {
  if (!DATA.roles || !DATA.roles.length) return '';
  return '<div class="group"><span class="label">Ваши роли</span><div class="card quiet"><div class="row" style="flex-wrap:wrap;gap:6px;justify-content:flex-start">' +
    // head и god_mentor у владельца — одно и то же звание: одна плашка
    DATA.roles.map(function (r) { return ROLE_NAME[r] || r; })
      .filter(function (n, i, all) { return all.indexOf(n) === i; })
      .map(function (n) { return '<span class="pill">' + esc(n) + '</span>'; }).join('') +
  '</div></div></div>';
}

/* У каждой роли свои действия. Пересечений нет: организатор не заводит
   услуги, партнёр не создаёт мероприятия. */
function rolePanel() {
  // у организатора и партнёра есть собственная вкладка — на главной клуба
  // их рабочие кнопки не дублируются
  return '';
}

/* FLASH может быть строкой или парой {text, note}: не всякое сообщение
   что-то сохраняет, и писать «сохранено» под результатом сканирования —
   значит утверждать неверное. */
function flash() {
  var t = FLASH; FLASH_SHOWN = true;
  var text = typeof t === 'string' ? t : t.text;
  var note = typeof t === 'string'
    ? 'Это демонстрация: сохранено только в этой вкладке, при перезагрузке исчезнет.'
    : t.note;
  return '<div class="card quiet"><div class="col">' +
    '<b style="font-size:13px">' + esc(text) + '</b>' +
    (note ? '<span class="small">' + esc(note) + '</span>' : '') +
  '</div></div>';
}

function eventRow(e, o) {
  var k = KIND[e.kind];
  /* Подстрочник строки зависит от ЭКРАНА, а разметка одна. На афише день
     даёт заголовок группы, поэтому в строке стоит «ведёт <имя> · <статус>»;
     на экране «Записи» групп по дням нет вовсе, и день переезжает в строку —
     так в кадре E40 (`Cafe13KPG` ствол `dev` `051bfa3`).

     ⚠ Слова берутся у `dayLabel` — того же помощника, что у афиши, — ради
     единства: в двух местах один день писался бы по-разному. Форма полная —
     «6 декабря, воскресенье» (`MONTHS` родительным падежом плюс `weekday: 'long'`),
     и смерженный кадр показывает её так же (`Cafe13KPG` ствол `dev` `051bfa3`).

     Прежняя редакция этого комментария говорила, что образец кадра короче
     живого вывода и расхождение решается в Cafe13KPG#380. Ссылка была НЕВЕРНАЯ:
     форма дня — это Cafe13KPG#382, и она СНЯТА кадром (кадр исправлен под
     живой вывод, карточка смержена). А #380 — про ДРУГОЕ и ОТКРЫТА: широкая
     пилюля поджимает НАЗВАНИЕ в строке афиши (пилюля 81 → `.grow` 171 → название
     в две строки, замер дизайнера). Этой правкой название короче не становится,
     то есть #380 остаётся; укороченный подстрочник может снять её вторую
     половину, но это меряется ПОСЛЕ выкладки, а не объявляется сейчас. И второй вызов помощника стоит не в кассе,
     как стояло здесь с чужих слов, а в `fromSigned` — списке записавшихся на экране
     мероприятия (перемерено мной: `dayLabel` зовут два места — строка афиши
     и `fromSigned`).
     Второй разметки для этого не завожу: два места расходятся молча.

     ⚠ Второй аргумент читается ТОЛЬКО как объект, потому что три места
     зовут строку через `.map(eventRow)`, а `map` передаёт вторым параметром
     ИНДЕКС. Сам по себе индекс здесь безвреден: `o && o.day` при `o = 1`
     даёт `undefined`, у числа нет такого поля, — проверено node: 0→0,
     1→undefined, 2→undefined, {day:true}→true. Прежняя редакция этого
     комментария утверждала, что без проверки строки афиши сменили бы
     подстрочник; это была НЕПРАВДА, нашёл её arhitector-47 на ревью #87.

     Проверка стоит не против индекса, а против УПРОЩЕНИЯ этой строки:
     перепишет кто-нибудь условие на `!!o` или `o !== undefined` — и индекс
     станет истинным (у `!!o` с единицы, у второго даже при нуле), то есть
     день появится там, где его не просили. Опасность в ФОРМЕ проверки, а
     не в `map`. */
  var bez = o && typeof o === 'object' && o.bezStatusa;
  return '<button type="button" class="listitem' + (e.kind === 'paid' ? ' accent' : '') + '" data-event="' + esc(e.id) + '">' +
    '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.part) + '</span></span>' +
    '<span class="grow"><b>' + esc(e.title) + '</b>' +
    '<span class="small">' + (bez
      ? 'ведёт ' + esc(e.master)
      : 'ведёт ' + esc(e.master) + ' · ' + (e.done ? 'завершилось'
        : e.booked ? 'вы записаны'
        : e.seats === 0 ? 'мест нет' : e.seats === e.of ? e.of + ' мест' : 'осталось ' + e.seats)) + '</span></span>' +
    '<span class="pill ' + k.pill + '">' + k.label(e) + '</span>' +
  '</button>';
}

/* Плитка вместо фотографии напитка. Пока снимок не прошёл путь съёмки,
   честнее показать цветное поле с буквой и словом «без фото», чем картинку
   из каталога: гость закажет не то, что увидел. */
function tile(d, big) {
  var cls = 'tile' + (big ? ' big' : '');
  if (d.shot === 'ready') {
    return '<span class="' + cls + '" style="background:' + TONE[d.tone] + '" aria-hidden="true">' +
      esc(d.title.slice(0, 1).toUpperCase()) + '</span>';
  }
  // В живом меню photo — это файл в Telegram: показать его браузеру нечем, и
  // писать «без фото», когда фото есть, было бы неправдой.
  return '<span class="' + cls + ' empty">' +
    (d.photo ? 'фото не показано' : d.shot === 'none' ? 'без фото' : 'фото готовится') + '</span>';
}

function stepper(d) {
  var n = CART[d.id] || 0;
  return '<span class="stepper">' +
    '<button type="button" data-action="cart-less:' + esc(d.id) + '" aria-label="Убрать одну">−</button>' +
    '<b class="num">' + n + '</b>' +
    '<button type="button" data-action="cart-add:' + esc(d.id) + '" aria-label="Добавить одну">+</button>' +
  '</span>';
}

/* Главная кнопка позиции. Не хватает на счёте — ведёт к пополнению и говорит,
   сколько не хватает; заказ в пути — ждёт, второго не создаёт. */
function buyBtn(d, wide) {
  var cls = 'btn' + (wide ? '' : ' mini');
  if (BUSY) return '<button type="button" class="' + cls + '" disabled>Отправляем…</button>';
  if (!BAR || !BAR.open) return '<button type="button" class="' + cls + '" disabled>Бар закрыт</button>';
  if (DATA.member.balance < d.price) {
    return '<button type="button" class="' + cls + ' quiet" data-go="topup">Не хватает ' +
      money(d.price - DATA.member.balance) + ' ฿</button>';
  }
  return '<button type="button" class="' + cls + '" data-action="buy:' + esc(d.id) + '">Купить' +
    (wide ? ' за ' + money(d.price) + ' ฿' : '') + '</button>';
}

function barRow(d) {
  var n = CART[d.id] || 0;
  if (LIVE) {
    return '<div class="card"><div class="row top">' +
      '<button type="button" class="plain drinkbtn" data-drink="' + esc(d.id) + '">' + tile(d) +
        '<span class="col"><b>' + esc(d.title) + '</b>' +
          '<span class="small">' + esc(d.about) + '</span>' +
          '<b class="num">' + money(d.price) + ' ฿</b></span>' +
      '</button>' +
      '<span class="col" style="gap:6px;align-items:flex-end">' + buyBtn(d) +
        (n ? stepper(d) : '<button type="button" class="btn ghost mini" data-action="cart-add:' + esc(d.id) + '">в заказ</button>') +
      '</span>' +
    '</div></div>';
  }
  return '<div class="card"><div class="row top">' +
    '<button type="button" class="plain drinkbtn" data-drink="' + esc(d.id) + '">' + tile(d) +
      '<span class="col"><b>' + esc(d.title) + '</b>' +
        '<span class="small">' + esc(d.about) + '</span>' +
        '<b class="num">' + d.price + ' ฿</b></span>' +
    '</button>' +
    (n ? stepper(d)
       : '<button type="button" class="btn quiet" data-action="cart-add:' + esc(d.id) + '">В заказ</button>') +
  '</div></div>';
}

/* Карточка очереди в живом режиме. Фото гостя — чтобы знать, кому несёшь;
   без фото так и сказано. Суммы нет, если сервер её не прислал. */
var NEXT = { new: ['making', 'Принять'], making: ['ready', 'Готово'], ready: ['served', 'Выдан'] };
function liveCard(o) {
  var st = OSTATE[o.state], nx = NEXT[o.state], busy = STATE_BUSY[o.oid];
  var face = o.photo
    ? '<img class="avatar" src="' + esc(o.photo) + '" alt="" referrerpolicy="no-referrer">'
    : '<span class="avatar" title="фото нет">' + esc(o.who.slice(0, 1).toUpperCase()) + '</span>';
  var canCancel = o.state === 'new' || o.state === 'making';
  return '<div class="card' + (o.state === 'new' ? ' strong accent' : '') + '">' +
    '<div class="row top">' + face +
      '<div class="col grow"><b>' + esc(o.id) + ' · ' + esc(o.where) + '</b>' +
        '<span class="small">' + esc(o.at) + ' · ' + esc(o.who) + (o.photo ? '' : ' · фото нет') + ' · ' + esc(o.pay) + '</span></div>' +
      '<span class="pill' + st.pill + '">' + st.label + '</span>' +
    '</div>' +
    '<div class="col">' + o.items.map(function (i) {
      return '<span class="small"><b class="num">' + i[1] + ' ×</b> ' + esc(i[0]) + '</span>';
    }).join('') + '</div>' +
    '<div class="row">' + (o.sum === null ? '<span></span>' : '<b class="num">' + money(o.sum) + ' ฿</b>') +
      (busy ? '<button type="button" class="btn quiet" disabled>…</button>'
       : CANCEL_ASK === o.oid
         ? '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="q-keep">Не отменять</button>' +
           '<button type="button" class="btn quiet" data-action="q-cancel:' + o.oid + '">Точно отменить</button></span>'
       : nx ? '<span class="row" style="gap:6px">' +
           (canCancel ? '<button type="button" class="btn quiet" data-action="q-ask:' + o.oid + '">Отменить</button>' : '') +
           '<button type="button" class="btn mini" data-action="q-' + nx[0] + ':' + o.oid + '">' + nx[1] + '</button></span>'
       : '<span class="small">' + (o.state === 'cancelled' ? 'отменён' : 'выдан') + '</span>') +
    '</div></div>';
}

function queueCard(o) {
  var st = OSTATE[o.state];
  return '<div class="card' + (o.state === 'new' ? ' strong accent' : '') + '">' +
    '<div class="row top">' +
      '<div class="col"><b>' + esc(o.id) + ' · ' + esc(o.where) + '</b>' +
        '<span class="small">' + esc(o.at) + ' · ' + esc(o.who) + ' · ' + esc(o.pay) + '</span></div>' +
      '<span class="pill' + st.pill + '">' + st.label + '</span>' +
    '</div>' +
    '<div class="col">' + o.items.map(function (i) {
      return '<span class="small"><b class="num">' + i[1] + ' ×</b> ' + esc(i[0]) + '</span>';
    }).join('') + '</div>' +
    // работнику бара цены нет ни одним полем — решение владельца
    '<div class="row"><span></span>' +
      (st.next
        ? '<button type="button" class="btn quiet" data-action="order-' + st.next + ':' + esc(o.id) + '">' +
            st.action + '</button>'
        : '<span class="small">закрыт, строка ушла в книгу</span>') +
    '</div></div>';
}

/* ── навигация ───────────────────────────────────────── */

var TABS = {
  guest:     [['guest', 'Услуги', ICON.plus], ['bookings', 'Ивенты', ICON.cal]],
  member:    [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus], ['bookings', 'Ивенты', ICON.cal]],
  organizer: [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus],
              ['organizer', 'События', ICON.star], ['bookings', 'Ивенты', ICON.cal]],
  partner:   [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus],
              ['partner', 'Моё дело', ICON.case], ['bookings', 'Ивенты', ICON.cal]],
  staff:     [['staff', 'Касса', ICON.till], ['home', 'Клуб', ICON.home]],
  bar:       [['barQueue', 'Заказы', ICON.bell], ['barShot', 'Съёмка', ICON.cam],
              ['barDay', 'День', ICON.chart], ['barExpense', 'Затраты', ICON.coin]],
  curator:   [['curator', 'Бар', ICON.cup], ['barDay', 'День', ICON.chart],
              ['barExpense', 'Затраты', ICON.coin], ['home', 'Клуб', ICON.home]]
};
// порядок вкладок у человека с несколькими членствами: оба своих экрана — между «Услугами» и «Записями»
var TAB_ORDER = ['home', 'guest', 'organizer', 'partner', 'bookings'];
var TITLES = {
  pass: 'Пропуск', membership: 'Членство', memberRequests: 'Заявки на членство', events: 'Афиша',
  event: 'Мероприятие', bookings: 'Мои ивенты', staff: 'Касса', demo: 'Демо-режим',
  consentFull: 'Подробно', joinAbout: 'О клубе',
  bar: 'Бар', drink: 'Напиток', barCart: 'Ваш заказ', barOrder: 'Заказ', barRecipe: 'Рецепт',
  barQueue: 'Заказы на баре', topup: 'Пополнить счёт', barShot: 'Съёмка напитков', barDay: 'Отчёт за день',
  barExpense: 'Затраты направления', curator: 'Направление «Бар»', barMoney: 'Доход и расход',
  organizer: 'Мои мероприятия', eventNew: 'Новое мероприятие',
  eventManage: 'Мероприятие', partner: 'Моё направление', serviceNew: 'Новая услуга',
  people: 'Члены клуба', manage: 'Управление', joinQueue: 'Заявки на доступ', barCards: 'Карточки меню', barCard: 'Карточка',
  tillPerson: 'Карточка человека', tillMembership: 'Членство', tillTopup: 'На счёт',
  tillDay: 'День кассы'
};

/* Вкладки идут от уровня членства, а рабочая — от роли с сервера: бармен
   без членства — гость по уровню, и без этого до очереди он не доходил
   (вход был только кнопкой на главной, а главной у гостя нет). */
function tabList() {
  var t = (TABS[DATA.role] || []).slice();
  // В живом режиме — объединением по ВСЕМ живым членствам, а не по DATA.role:
  // сервер отдаёт роль одной строкой, и при равных сроках двух членств она
  // произвольна — вкладка «Моё дело» то была, то нет (Cafe13KPG#410, шаг 1a).
  // DATA.role здесь не правится: его читают homeOf, isMember, касса.
  if (LIVE) {
    var on = {};
    ((DATA.member && DATA.member.memberships) || []).map(function (m) { return m.level; })
      .concat(DATA.role).forEach(function (l) {
        (TABS[l] || []).forEach(function (x) { on[x[0]] = x; });
      });
    t = TAB_ORDER.filter(function (k) { return on[k]; }).map(function (k) { return on[k]; });
  }
  if (LIVE && DATA.barSide && !t.some(function (x) { return x[0] === 'barQueue'; }))
    t.unshift(['barQueue', 'Заказы', ICON.bell]);
  // касса — от права, а не от уровня: кассир с членством — член клуба по уровню
  if (canTopup() && !t.some(function (x) { return x[0] === 'staff'; }))
    t.unshift(['staff', 'Касса', ICON.till]);
  // «Управление» — от права главы клуба, а не от уровня; последней, как в кадре E46 (Cafe13KPG#413)
  if (mayPeople() && !t.some(function (x) { return x[0] === 'manage'; }))
    t.push(['manage', 'Управление', ICON.people]);
  return t;
}

/* Куда ведёт «назад» с каждого экрана. Без карты всё падало на первую
   вкладку, и из мероприятия человек улетал на главную вместо списка. */
function homeOf() {
  if (DATA.role === 'guest') return 'guest';
  if (DATA.role === 'staff') return 'staff';
  if (DATA.role === 'bar') return 'barQueue';
  if (DATA.role === 'curator') return 'curator';
  return 'home';
}
var BACK = {
  event: 'events',
  // В живом режиме форма открывается с афиши, в демонстрации — из кабинета.
  // Без этого «назад» уводило на демонстрационный кабинет, где лежат
  // придуманные мероприятия: рядом с живой афишей они выглядели бы живыми.
  eventNew: function () { return LIVE ? 'events' : 'organizer'; },
  eventManage: 'organizer',
  people: 'manage', joinQueue: 'manage', memberRequests: 'home',
  tillPerson: 'staff', tillMembership: 'tillPerson', tillTopup: 'tillPerson', tillDay: 'staff',
  // homeOf() работника без членства — 'guest', экран услуг: из карточек он уезжал бы
  // туда, а не в «Заказы», откуда вошёл (Cafe13KPG#403)
  barCards: function () { return CARDS.from || homeOf(); }, barCard: 'barCards',
  serviceNew: 'partner', consentFull: 'consent',
  // тетрадь клуба открыта с экрана просьбы — туда и возврат (решение владельца 28.10, Cafe13KPG#324 v74)
  joinAbout: 'noAccess',
  bar: 'guest', drink: 'bar', barCart: 'bar', barOrder: 'bar',
  barRecipe: function () { return 'drink'; },
  topup: function () { return TOPUP.from === 'home' ? 'home' : 'bar'; },
  barMoney: function () { return BOOK.from; },
  barDay: function () { return LIVE ? DAY.from : homeOf(); },
  // съёмка открывается и с бара, и из кабинета куратора — «назад» зависит от роли
  barShot: function () { return DATA.role === 'curator' ? 'curator' : 'barQueue'; }
};
function backTo() {
  var b = BACK[current];
  if (typeof b === 'function') b = b();
  return b || homeOf();
}

/* Баланс в шапке (Cafe13KPG#500, слово владельца): справа на уровне «Café XIII»,
   по умолчанию СКРЫТ; тап показывает, повторный прячет. Рядом — кошелёк с плюсом,
   вход в пополнение. Число — то же DATA.member.balance, что из корня /me.
   На экранах входа (BARE) шапка пустая: человека ещё нет. */
var BAL = { shown: false };
function barRight() {
  if (bare() || !DATA.member || typeof DATA.member.balance !== 'number') return '';
  return '<button type="button" class="bal" id="bal" data-action="bal-toggle" aria-pressed="' + BAL.shown + '"' +
      ' aria-label="' + (BAL.shown ? 'Скрыть баланс' : 'Показать баланс') + '">' +
      (BAL.shown ? money(DATA.member.balance) + ' ฿' : '••• ฿') + '</button>' +
    '<button type="button" class="icon-btn" id="wallet" data-go="topup" aria-label="Пополнить счёт">' + svg(ICON.wallet) + '</button>';
}

/* Экраны без вкладок: уйти с них можно решением, а не переключением. */
var BARE = { consent: 1, consentFull: 1, loading: 1, noSign: 1, noAccess: 1, apiDown: 1, joinAbout: 1 };
function bare() { return !!BARE[current]; }

var current = 'home';
var param = null;

/* Какой экран нарисован последним: «тот же экран» сохраняет место прокрутки, другой — сверху.
   Слово владельца 28.10.2026: «каждое действие и каждый клик дергает экран… после обновления
   возвращайся где было» (Cafe13KPG#490). Раньше render() кончался безусловным scrollTo(0, 0). */
var RENDERED = null;
function render() {
  var view = document.getElementById('view');
  var here = current + '|' + String(param), y = window.scrollY || 0;
  var same = RENDERED === here;
  RENDERED = here;
  view.innerHTML = (bare() ? '' : testStrip()) +
    SCREENS[frozen(current) ? 'frozen' : LIVE && !WIRED[current] ? 'soon' : current](param);
  // вход на замороженный экран гаснет ПО СВОЙСТВУ, а не перечнем кнопок: любой [data-go] туда
  // (Cafe13KPG#510); облик — общий .btn[disabled]
  if (LIVE) [].forEach.call(view.querySelectorAll('[data-go]'), function (b) {
    if (!closed(b.getAttribute('data-go'))) return;
    b.disabled = true; b.setAttribute('aria-disabled', 'true');
    // причина ЗАМЕНЯЕТ подстрочник (designer-55, по снимку): описание того, куда не войти, — шум, а
    // приписка через «·» переносила строку на вторую; серое без причины читается как поломка
    var sub = b.classList.contains('listitem') && b.querySelector('.grow .small');
    if (sub) sub.textContent = 'временно недоступно';
  });

  var root = tabList().some(function (t) { return t[0] === current; });
  // экран входа без вкладок, но со своим «назад» (consentFull, joinAbout) — стрелка и своё имя в шапке
  var away = bare() && !BACK[current];
  document.getElementById('back').hidden = root || away;

  var title = document.getElementById('title');
  if (current === 'home' || current === 'guest' || away) {
    title.textContent = 'Café XIII';
    title.className = 'wordmark';
  } else {
    title.textContent = LIVE && current === 'demo' ? 'Просмотр' : TITLES[current] || 'Café XIII';
    title.className = 'wordmark plain';
  }
  var right = document.getElementById('bar-right');
  if (right) right.innerHTML = barRight();

  var tabs = document.getElementById('tabs');
  var list = bare() ? [] : tabList();
  tabs.hidden = !list.length;
  document.body.classList.toggle('no-tabs', !list.length);
  tabs.innerHTML = list.map(function (t) {
    var on = t[0] === current;
    // замороженная вкладка — серая и не нажимается, а не спрятана (буква владельца, Cafe13KPG#510)
    return '<button type="button" data-go="' + t[0] + '"' + (on ? ' aria-current="page"' : '') +
      (closed(t[0]) ? ' disabled aria-disabled="true"' : '') + '>' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');

  sunButton();
  tgChrome();
  // место берётся ДО подмены разметки: после неё высота страницы другая, и браузер уже сдвинул бы его
  window.scrollTo(0, same ? y : 0);
}

/* ── рабочие экраны в демонстрации (Cafe13KPG#409) ─────
   Вне Telegram девять экранов бара, кассы и «Людей» рисовали отказ по праву:
   все права начинаются с LIVE, а опись снимает вне Telegram. Права НЕ
   ослаблены — у самих экранов гард стал `LIVE && !право()`. Данные ниже — в
   ФОРМЕ ОТВЕТА СЕРВЕРА и проходят те же разборщики, что живой ответ:
   демонстрация не может показать то, чего живой экран не разобрал бы.

   Входов на эти экраны в демонстрации нет — главная гостя и члена клуба не
   меняется, руками до них не дойти; их показывает опись (решение
   координатора по #409, вариант A). Люди — роли в скобках, как во всей
   демонстрации; номера — выдуманные из общей фикстуры (tools/ids-clean.cjs).
   Где смысл экрана в различии (наличные, карта, со счёта; доход и расход;
   остаток и платёж), числа нарочно разные: равные числа такую ошибку прячут. */
DATA.work = {
  dirs: [{ id: 1, title: 'Бар', is_active: true }],
  people: { people: [
    { tg_user_id: 200000001, first_name: '[глава клуба]', roles: [{ id: 11, role: 'head' }], memberships: ['partner'], balance: '3170.00' },
    { tg_user_id: 200000002, first_name: '[куратор бара]', roles: [{ id: 12, role: 'curator', direction_id: 1, direction: 'Бар' }], memberships: ['member'], balance: '0.00' },
    { tg_user_id: 200000003, first_name: '[исполнитель на баре]', roles: [{ id: 13, role: 'bar', direction_id: 1, direction: 'Бар' }], memberships: ['member'], balance: '420.00' },
    { tg_user_id: 200000004, first_name: '[кассир]', roles: [{ id: 14, role: 'staff' }], memberships: [], balance: '0.00' },
    { tg_user_id: 200000005, first_name: '[имя члена]', roles: [], memberships: ['member'], balance: '640.00' }
  ] },
  cards: [
    { id: 301, title: 'Тыквенный латте', group: 'Кофе', price: '135.00', mins: 4, about: 'Тыква, корица, двойной эспрессо', is_alcohol: false,
      state: 'review', recipes: ['ru'], decision_note: null, photo_id: null, last_photo_id: 91, last_photo_state: 'pending' },
    { id: 302, title: 'Манго-ласси', group: 'Авторские', price: '160.00', mins: 3, about: 'Манго, йогурт, кардамон', is_alcohol: false,
      state: 'review', recipes: [], decision_note: null, photo_id: null, last_photo_id: null, last_photo_state: null },
    { id: 303, title: 'Матча-тоник', group: 'Авторские', price: '150.00', mins: 2, about: 'Матча, тоник, лёд', is_alcohol: false,
      state: 'draft', recipes: ['ru'], decision_note: 'Нет фото, цена выше соседних', photo_id: null, last_photo_id: null, last_photo_state: null },
    { id: 304, title: 'Какао на кокосовом', group: 'Кофе', price: '125.00', mins: null, about: '', is_alcohol: false,
      state: 'draft', recipes: [], decision_note: null, photo_id: null, last_photo_id: null, last_photo_state: null },
    { id: 305, title: 'Флэт-уайт', group: 'Кофе', price: '110.00', mins: 4, about: 'Молоко обычное или кокосовое', is_alcohol: false,
      state: 'active', recipes: ['ru', 'en'], decision_note: null, photo_id: 92, last_photo_id: 92, last_photo_state: 'approved' },
    { id: 306, title: 'Эспрессо', group: 'Кофе', price: '70.00', mins: 2, about: 'Двойной, местная обжарка', is_alcohol: false,
      state: 'active', recipes: ['ru'], decision_note: null, photo_id: 93, last_photo_id: 93, last_photo_state: 'approved' },
    { id: 307, title: 'Габа', group: 'Чай', price: '140.00', mins: 5, about: 'Тайваньская, мягкая', is_alcohol: false,
      state: 'hidden', recipes: ['ru'], decision_note: null, photo_id: null, last_photo_id: null, last_photo_state: null }
  ],
  cardRecipes: {
    301: { ru: 'Тыквенное пюре 30 г, корица на кончике ножа, двойной эспрессо, молоко 150 мл.' },
    303: { ru: 'Матча 2 г взбить в 40 мл воды, лёд доверху, тоник 120 мл.' },
    305: { ru: 'Двойной ристретто, молоко 120 мл без пены, рисунок не обязателен.',
           en: 'Double ristretto, 120 ml milk with no foam, latte art optional.' },
    306: { ru: 'Двойной эспрессо, 36 г на выходе за 27 секунд.' },
    307: { ru: 'Гайвань, 5 г, вода 85 °C, первый пролив слить.' }
  },
  // экран рецепта: русский есть, английского нет — сервер отдаёт русский с exact: false
  recipe: {
    me: { lang: 'ru', asked_lang: 'ru', exact: true, body: 'Двойной ристретто, молоко 120 мл без пены, рисунок не обязателен.' },
    en: { lang: 'ru', asked_lang: 'en', exact: false, body: 'Двойной ристретто, молоко 120 мл без пены, рисунок не обязателен.' }
  },
  // «Записано сейчас» на экране дохода и расхода — уже разобранный вид, как его кладёт bookSend
  book: [
    { inc: true, amount: 2340, at: '21:05', note: 'выручка за вечер, 14 чеков', how: 'наличные' },
    { inc: false, amount: 480, at: '16:20', note: 'молоко, 6 литров', how: 'закуп · текущая трата · наличные бара' }
  ],
  tillCode: 'XIII-0137',
  tillWho: { member_id: 200000005, first_name: '[имя члена]', last_name: null, membership_active: true,
             membership: { level: 'member', lifelong: false, ends_at: '2026-12-03T00:00:00+07:00' }, balance: '640.00' },
  tillDay: { count_live: 3, total_live: '4475.00', rows: [
    { id: 45, kind: 'service', method: 'account', amount: '175.00', at: '2026-10-27T19:24:00+07:00', note: 'заказ бара 14', cancels_id: null, cancelled_by: null },
    { id: 44, kind: 'event', method: 'account', amount: '400.00', at: '2026-10-27T17:43:00+07:00', note: null, cancels_id: 43, cancelled_by: null },
    { id: 43, kind: 'event', method: 'account', amount: '400.00', at: '2026-10-27T17:40:00+07:00', note: null, cancels_id: null, cancelled_by: 44 },
    { id: 42, kind: 'topup', method: 'cash', amount: '1000.00', at: '2026-10-27T16:51:00+07:00', note: null, cancels_id: null, cancelled_by: null },
    { id: 41, kind: 'membership', method: 'card', amount: '3300.00', at: '2026-10-27T16:12:00+07:00', note: null, cancels_id: null, cancelled_by: null }
  ] }
};

// Кладёт данные демонстрации туда, где их ждёт экран, — один раз за вход
// и только если места пусты: переходы внутри экрана их не сбрасывают.
function demoWork(screen, p) {
  var W = DATA.work;
  if (screen === 'people' && !PEOPLE.list) { PEOPLE.list = fromRoster(W.people); PEOPLE.dirs = fromDirList(W.dirs); }
  if ((screen === 'barCards' || screen === 'barCard') && !CARDS.list) CARDS.list = fromCards(W.cards);
  if (screen === 'barRecipe' && RECIPE.pid !== p)
    RECIPE = { pid: p, gen: RECIPE.gen, me: { state: 'ok', r: fromRecipe(W.recipe.me) }, en: { state: 'ok', r: fromRecipe(W.recipe.en) } };
  if (screen === 'barMoney' && !BOOK.done.length) BOOK.done = W.book.slice();
  if (/^till(Person|Membership|Topup)$/.test(screen) && !TP.who) TP.who = fromTillPerson(W.tillWho, W.tillCode);
  if (screen === 'tillMembership' && TP.kind !== 'membership') tillPrep('membership');
  if (screen === 'tillTopup' && TP.kind !== 'topup') tillPrep('topup');
  if (screen === 'tillDay' && !TD.data) TD.data = fromTillDay(W.tillDay);
}

/* Отправки и перечитывания рабочих экранов. В демонстрации они не уходят:
   сервера нет, а «ничего не случилось» на нажатие — дефект, уже бывший у нас
   (Cafe13KPG#338). Поэтому нажатие отвечает словами, что это демонстрация. */
var DEMO_SENDS = ['p-give', 'p-revoke', 'p-outyes', 'p-reload', 'c-save', 'c-group-theirs', 'c-group-mine', 'c-recipe',
                  'c-review', 'c-approve', 'c-hide', 'c-back-send', 'c-reload', 'b-send', 'book-retry',
                  'tp-send', 'tp-reload', 'td-cancel', 'td-reload'];

function go(screen, p) {
  if (!SCREENS[screen]) return;
  if (noEntry() && !BARE[screen]) return;      // вход не состоялся — только экраны входа
  if (screen === 'noAccess' && current !== 'noAccess') { JOIN.err = ''; JOIN.fileErr = ''; loadJoin(); }
  if (screen === 'joinAbout' && current !== 'joinAbout') loadAbout();
  if (screen === 'demo' && LIVE && !isGod()) return;
  if (screen === 'demo' && LIVE && !TEST.on && TEST.health !== 'configured' && TEST.health !== 'loading') loadHealth();
  if (FLASH_SHOWN) { FLASH = null; FLASH_SHOWN = false; }
  if (screen === 'topup' && current !== 'topup') {
    TOPUP.from = current === 'home' ? 'home' : 'bar';
    TOPUP.ask = false; TOPUP.err = '';
  }
  if (screen === 'barDay' && current !== 'barDay')
    DAY.from = current === 'barQueue' || current === 'barMoney' ? current : homeOf();
  if (screen === 'barMoney' && current !== 'barMoney') {
    BOOK.from = current === 'barQueue' ? 'barQueue' : homeOf();
    BOOK.ask = false; BOOK.err = '';
  }
  if (screen === 'people' && current !== 'people') { peopleReset(); if (mayPeople()) loadRoster(); }
  if (screen === 'manage' && current !== 'manage' && mayPeople()) loadJoinQueue();
  if (screen === 'joinQueue' && current !== 'joinQueue') { JOINQ.err = ''; JOINQ.ok = 0; JOINQ.no = 0; JOINQ.note = ''; if (mayPeople()) loadJoinQueue(); }
  if (screen === 'membership' && current !== 'membership' && LIVE) { MREQ.err = ''; loadTiers(); }
  if (screen === 'memberRequests' && current !== 'memberRequests' && mayRequests()) { MREQS.err = ''; MREQS.ask = 0; loadRequests(); if (!TIERS.list) loadTiers(); }
  if (screen === 'home' && current !== 'home' && mayRequests() && WIRED.memberRequests) loadRequests();
  // с самой карточки в список возвращаются — это не новый вход, «откуда» не трогать
  if (screen === 'barCards' && current !== 'barCards' && current !== 'barCard')
    CARDS.from = current === 'barQueue' ? 'barQueue' : homeOf();
  if (screen === 'barCards' && current !== 'barCards' && mayCards()) loadCards();
  if (screen === 'barCard' && (current !== 'barCard' || String(param) !== String(p))) {
    // заметка «черновик сохранён» переживает переход с формы на саму карточку
    var keepNote = current === 'barCard' ? CARD.note : '';
    cardReset(); CARD.note = keepNote;
  }
  current = screen;
  param = p || null;
  if (!LIVE) demoWork(screen, p);
  if (screen === 'barMoney' && LIVE && !BAR) bookLoad();
  if (screen === 'barDay' && LIVE) loadDay();
  if (screen === 'tillDay' && LIVE && canTopup()) { TD.ask = -1; TD.deny = null; tillDayLoad(); }
  if (screen === 'pass' && LIVE && !PASS && !PASS_FAIL) loadPass();
  if ((screen === 'bar' || screen === 'drink') && LIVE && MENU_STATE === '') loadMenu();
  /* «Записи» строятся из ответа афиши, поэтому грузить её надо и при входе
     сюда: человек попадает на этот экран сразу после записи (`go('bookings')`),
     минуя афишу, и без этой строки `EVENTS` остался бы `null` навсегда —
     экран сказал бы «вы никуда не записаны» тому, кто только что записался. */
  if ((screen === 'home' || screen === 'events' || screen === 'bookings') && LIVE && EVENTS_STATE === '') loadEvents();
  // Места спрашиваются ЗАНОВО, если прошлый ответ списка не принёс: иначе
  // отказ, случившийся однажды, лежит на форме навсегда — человек читает
  // «места не пришли» уже после того, как сервер выздоровел. Пустой
  // список при этом второй раз не просим: `[]` — ответ, а не отказ.
  if (screen === 'eventNew' && LIVE && EV_PLACES_STATE !== 'loading' && !EV_PLACES) loadPlaces();
  if (screen !== 'event') { BOOK_ERR = ''; BOOK_ASK = false; EV_ERR = ''; EV_ASK = false; }
  // Список записавшихся спрашивается при входе на карточку СВОЕГО события:
  // loadSigned сам молчит на чужом, поэтому предикат один и здесь.
  if (screen === 'event' && LIVE) loadSigned(eventById(param));
  if (screen === 'barRecipe' && LIVE) loadRecipe(param);
  if (screen !== 'eventNew') EVN_ERR = '';
  render();
  if (screen === 'barOrder' && LIVE) pollMine();
  if (screen === 'barQueue' && LIVE) loadQueue();
  if (screen === 'eventNew') {
    loadDraft(function (restored) {
      if (restored && current === 'eventNew') {
        FLASH = 'Черновик восстановлен';
        render();
      }
    });
  }
}

/* Эхо дня и времени правится НА МЕСТЕ, без перерисовки экрана: перерисовка
   на каждую нажатую клавишу уводила бы курсор из поля. Заодно набранное
   сразу ложится в память формы — тогда и отказ сервера его не сотрёт. */
document.addEventListener('input', function (ev) {
  var t = ev.target;
  if (!t || (t.id !== 'f-date' && t.id !== 'f-time')) return;
  FORM.v[t.id] = t.value;
  var eh = echoText(val('f-date'), val('f-time'));
  var e = document.getElementById('f-echo');
  if (e) e.textContent = eh.text;
  var tail = document.getElementById('f-echo-tail');
  if (tail) tail.hidden = !eh.ok;
});

document.addEventListener('click', function (ev) {
  var el = ev.target.closest('[data-go],[data-event],[data-role],[data-kind],[data-place],[data-toggle],[data-manage],[data-action],[data-drink],[data-where],[data-pay],[data-exp],[data-expay]');
  if (!el) return;

  if (el.hasAttribute('data-role')) {
    if (LIVE) return;                  // роль ставит сервер
    DATA.role = el.getAttribute('data-role');
    go(homeOf());
    return;
  }
  if (el.hasAttribute('data-drink')) { go('drink', el.getAttribute('data-drink')); return; }
  if (el.hasAttribute('data-where')) { ORDER.where = el.getAttribute('data-where'); DENY = ''; haptic(); render(); return; }
  if (el.hasAttribute('data-pay'))   { ORDER.pay   = el.getAttribute('data-pay');   haptic(); render(); return; }
  // грабим введённое ДО перерисовки: иначе выбор категории стирал набранный текст
  if (el.hasAttribute('data-exp'))   { grabForm(EXP_FIELDS); EXP.cat = el.getAttribute('data-exp');   haptic(); render(); return; }
  if (el.hasAttribute('data-expay')) { grabForm(EXP_FIELDS); EXP.pay = el.getAttribute('data-expay'); haptic(); render(); return; }
  if (el.hasAttribute('data-kind')) {
    grabForm(EVENT_FIELDS); FORM.kind = el.getAttribute('data-kind'); haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-place')) {
    // Пустая строка в data-place — это «без места», а не поломка: числа
    // у места начинаются с единицы, и Number('') дал бы ноль-мероприятие.
    var pv = el.getAttribute('data-place');
    grabForm(EVENT_FIELDS); FORM.place = pv ? Number(pv) : null;
    haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-toggle')) {
    grabForm(EVENT_FIELDS); FORM.filmed = !FORM.filmed; haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-manage')) { go('eventManage', el.getAttribute('data-manage')); return; }

  if (el.hasAttribute('data-action')) { doAction(el.getAttribute('data-action')); return; }
  if (el.hasAttribute('data-event')) { go('event', el.getAttribute('data-event')); return; }
  // погашенный вход не ведёт никуда, даже если щелчок дошёл до него сквозь дочерний элемент
  if (el.disabled) return;
  go(el.getAttribute('data-go'));
});

function doAction(a) {
  /* Действия бара несут аргумент через двоеточие: cart-add:flat, order-make:A-16.
     Разбор здесь, чтобы разметка оставалась одними атрибутами. */
  var arg = null, c = a.indexOf(':');
  if (c !== -1) { arg = a.slice(c + 1); a = a.slice(0, c); }
  if (!LIVE && DEMO_SENDS.indexOf(a) !== -1) {
    if (a.slice(0, 2) === 'c-') grabCard();     // набранное в карточке не теряется
    FLASH = { text: 'Это демонстрация', note: 'В Telegram это ушло бы на сервер клуба. Здесь ничего не отправлено и не записано.' };
    haptic('warn'); render(); return;
  }

    if (a === 'buy') { buy(arg); return; }
    if (a === 'retry-menu') { loadMenu(); render(); return; }
    if (a === 'send-order' && LIVE) {
      var live = cartList();
      if (!live.length) { FLASH = { text: 'Заказ пуст', note: 'Добавьте что-нибудь в меню.' }; render(); return; }
      placeOrder(live, ORDER.where, 'account');
      return;
    }
    if (a === 'cart-add') {
      CART[arg] = (CART[arg] || 0) + 1; DENY = '';
      haptic(); render(); return;
    }
    if (a === 'cart-less') {
      CART[arg] = (CART[arg] || 0) - 1; DENY = '';
      if (CART[arg] <= 0) delete CART[arg];
      haptic(); render(); return;
    }
    if (a === 'send-order') {
      var olist = cartList();
      if (!olist.length) {
        FLASH = { text: 'Заказ пуст', note: 'Добавьте что-нибудь в меню.' };
        haptic('warn'); render(); return;
      }
      ORDERSEQ += 1;
      var o = { id: 'A-' + (16 + ORDERSEQ), who: DATA.member.name, at: nowHM(),
                where: ORDER.where, pay: ORDER.pay, sum: cartSum(), state: 'new',
                items: olist.map(function (x) { return [x.title, x.n]; }) };
      DATA.bar.orders.unshift(o);
      DATA.bar.mine = o;
      CART = {};
      haptic('ok');
      FLASH = { text: 'Заказ ' + o.id + ' отправлен на бар',
                note: 'Это демонстрация: заказ виден только в этой вкладке. В Telegram бар получает его в ту же секунду.' };
      go('barOrder');
      return;
    }
    if (a === 'q-making' || a === 'q-ready' || a === 'q-served') { setState(Number(arg), a.slice(2)); return; }
    if ((a === 't-method' || a === 't-ask') && document.getElementById('t-amount'))
      TOPUP.amount = document.getElementById('t-amount').value;
    if (a === 't-method') { TOPUP.method = arg === 'card' ? 'card' : 'cash'; render(); return; }
    if (a === 't-ask') {
      TOPUP.err = topupAmount(TOPUP.amount) === null ? 'Сумма — число больше нуля, например 500.' : '';
      TOPUP.ask = !TOPUP.err; render(); return;
    }
    if (a === 't-keep') { TOPUP.ask = false; render(); return; }
    if (a === 'tp-find') { tillFind(val('tp-code')); return; }
    if (a === 'tp-next') { tillReset(); TP.code = ''; go('staff'); return; }
    if (a === 'tp-open') { TP.done = null; tillOpen(arg); return; }
    if (a === 'tp-level' && LEVEL[arg] && !TP.busy) { TP.level = arg; render(); return; }
    if (a === 'tp-method' && PAY_HOW[arg] && !TP.busy && (arg !== 'account' || TP.kind === 'membership')) { TP.method = arg; render(); return; }
    if (a === 'tp-send') { tillSend(); return; }
    if (a === 'td-ask' && TD.busy === -1) { TD.ask = Number(arg); TD.deny = null; render(); return; }
    if (a === 'td-keep') { TD.ask = -1; render(); return; }
    if (a === 'td-cancel') { tillCancel(Number(arg)); return; }
    if (a === 'td-reload') { tillDayLoad(); render(); return; }
    if (a === 'tp-reload' && TP.who && !TP.busy) {
      TP.busy = true; render();
      tillLookup(TP.who.code, function (rec, r) {
        TP.busy = false;
        if (rec) { TP.who = rec; if (TP.done) TP.done.reread = true; }
        else FLASH = { text: 'Карточка не перечиталась', note: said(r) };
        render();
      });
      return;
    }
    if (a === 'book-retry') { bookLoad(); render(); return; }
    if (a === 'test-health') { loadHealth(); render(); return; }
    if (a === 'day-reload') { loadDay(); render(); return; }
    if (a === 'test-on' && isGod()) { switchTo(true, null); loadPeople(); return; }
    if (a === 'test-as' && isGod() && TEST.on && TEST.people) {
      var who = TEST.people.filter(function (x) { return String(x.id) === arg; })[0];
      if (who) switchTo(true, who);
      return;
    }
    if (a === 'test-self' && TEST.on) { switchTo(true, null); loadPeople(); return; }
    if (a === 'test-off' && TEST.on) { switchTo(false, null); return; }
    if (a.slice(0, 2) === 'b-') {
      if (BOOK.busy) return;
      bookGrab();
      if (a === 'b-new') { BOOK.kind = arg === 'income' ? 'income' : 'expense'; BOOK.ask = false; BOOK.err = ''; }
      if (a === 'b-method' && pick(INCOME_HOW, arg)) BOOK.method = arg;
      if (a === 'b-cat' && EXP_CATS.indexOf(arg) !== -1) BOOK.cat = arg;
      if (a === 'b-kind' && pick(EXP_KINDS, arg)) BOOK.ekind = arg;
      if (a === 'b-paid' && pick(PAID_BY, arg)) BOOK.paid = arg;
      if (a === 'b-ask') { BOOK.err = bookMissing(); BOOK.ask = !BOOK.err; }
      if (a === 'b-keep') BOOK.ask = false;
      if (a === 'b-send') { bookSend(); return; }
      if (BOOK.err && a !== 'b-ask') BOOK.err = bookMissing() && BOOK.err;
      haptic(); render(); return;
    }
    if (a === 't-send') { topupSend(); return; }
    if (a.slice(0, 2) === 'c-' && (current === 'barCards' || current === 'barCard')) {
      if (CARD.busy) return;
      grabCard();
      if (a === 'c-reload') { loadCards(); render(); return; }
      if (a === 'c-new') { go('barCard', 'new'); return; }
      if (a === 'c-open') { go('barCard', arg); return; }
      if (a === 'c-save') { cardSave(); return; }
      if (a === 'c-group-theirs') { cardSave('theirs'); return; }
      if (a === 'c-group-mine') { cardSave('mine'); return; }
      if (a === 'c-recipe') { recipeSave(Number(arg)); return; }
      if (a === 'c-review') { cardState(Number(arg), 'review'); return; }
      if (a === 'c-approve') { cardState(Number(arg), 'active'); return; }
      if (a === 'c-hide') { cardState(Number(arg), 'hidden'); return; }
      if (a === 'c-back-send') {
        if (!CARD.reason.trim()) { CARD.err = ''; CARD.deny = 'Напишите причину — её прочтёт бар.'; haptic('warn'); render(); return; }
        cardState(Number(arg), 'hidden', CARD.reason.trim()); return;
      }
      if (a === 'c-group') { CARD.v['c-group'] = arg; CARD.groupAsk = ''; }
      if (a === 'c-alcohol') CARD.alcohol = !CARD.alcohol;
      if (a === 'c-lang' && CARD_LANGS.some(function (l) { return l[0] === arg; })) { CARD.lang = arg; CARD.err = ''; }
      if (a === 'c-back') CARD.back = true;
      if (a === 'c-back-keep') { CARD.back = false; CARD.reason = ''; }
      if (a === 'c-hide-ask') CARD.hideAsk = true;
      if (a === 'c-hide-keep') CARD.hideAsk = false;
      haptic(); render();
      // поле причины и его кнопки — в вид: иначе они открылись бы за нижним краем
      var rf = a === 'c-back' && document.getElementById('c-reason');
      if (rf && rf.scrollIntoView) rf.scrollIntoView({ block: 'start' });
      return;
    }
    if (a.slice(0, 2) === 'p-' && current === 'people') {
      // Против двойного нажатия две линии: эта и своя проверка busy в
      // grantSend/revokeSend. Они прикрывают друг друга: снятие любой одной
      // зелёное, обеих — красное (people-double, people-double-revoke;
      // Cafe13KPG#214, 22.10.2026). Снимать можно одну, не обе. Эта ещё и
      // держит p-open/p-close: peopleReset снимает блокировку.
      if (PEOPLE.busy) return;
      var before = peopleTouched();
      if (a === 'p-reload') { loadRoster(); render(); return; }
      if (a === 'p-give') {
        // Ключ строки — «роль» или «роль:направление». Приставку `p-` разобрал doAction,
        // здесь режется ПЕРВОЕ двоеточие остатка; у общей роли его нет вовсе.
        var cutg = String(arg).indexOf(':');
        grantSend(cutg === -1 ? arg : arg.slice(0, cutg), cutg === -1 ? null : Number(arg.slice(cutg + 1)));
        return;
      }
      if (a === 'p-revoke') { revokeSend(Number(arg)); return; }
      if (a === 'p-outyes') { if (PEOPLE.out === Number(arg)) outSend(Number(arg)); return; }
      if (a === 'p-out') { peopleReset(); PEOPLE.out = Number(arg); }
      if (a === 'p-outkeep') PEOPLE.out = null;
      if (a === 'p-open') { peopleReset(); PEOPLE.open = Number(arg); }
      if (a === 'p-close') peopleReset();
      // `p-role` больше не ВЫБИРАЕТ, а раскрывает направления, и спрашивается только у
      // DIR_ROLES: у роли без направления раскрывать нечего, а состояние, которое ничего не
      // рисует, не заводится. Второе нажатие складывает обратно — у указателя это его
      // единственный обратный ход, и `aria-expanded` в разметке обещает ровно это.
      // Самоподстановка единственного направления снята вместе с выбором: выдаёт СТРОКА, и
      // «выбранного» направления больше не существует.
      // `p-dir` снят: строка направления теперь выдаёт, и делает это `p-give` с парным ключом.
      if (a === 'p-role' && DIR_ROLES.indexOf(arg) !== -1) PEOPLE.role = PEOPLE.role === arg ? '' : arg;
      // крестик у роли: окно отмены вместо вопроса; второе окно поверх первого не открывается
      if (a === 'p-ask') { if (PEOPLE.ask !== null) return; undoStart(Number(arg)); }
      if (a === 'p-keep') { undoStop(); PEOPLE.ask = null; }
      haptic(); peopleRedraw(before);
      // раскрытая форма — в вид: иначе она открылась бы за нижним краем
      var f = a === 'p-open' && document.querySelector('[data-person="' + PEOPLE.open + '"]');
      if (f && f.scrollIntoView) f.scrollIntoView({ block: 'start' });
      return;
    }
    if (a === 'shift-open') { shiftAct(true); return; }
    if (a === 'shift-ask') { SHIFT_ASK = true; render(); return; }
    if (a === 'shift-keep') { SHIFT_ASK = false; render(); return; }
    if (a === 'shift-close') { shiftAct(false); return; }
    if (a === 'q-ask') { CANCEL_ASK = Number(arg); render(); return; }
    if (a === 'q-keep') { CANCEL_ASK = null; render(); return; }
    if (a === 'q-cancel') { setState(Number(arg), 'cancelled'); return; }
    if (a === 'order-make' || a === 'order-ready' || a === 'order-serve') {
      var ord = orderById(arg);
      if (ord) {
        ord.state = a === 'order-make' ? 'making' : a === 'order-ready' ? 'ready' : 'served';
        if (DATA.bar.mine && DATA.bar.mine.id === ord.id) DATA.bar.mine.state = ord.state;
        haptic('ok');
        FLASH = { text: ord.id + ' · ' + OSTATE[ord.state].label,
                  note: 'Гость видит это у себя в заказе. В демонстрации — только в этой вкладке.' };
      }
      render(); return;
    }
    if (a === 'close-shift') {
      haptic('ok');
      FLASH = { text: 'Смена закрыта',
                note: 'Правок в закрытой смене не бывает: ошибка исправляется отменой строки и новой записью. В демонстрации отчёт никуда не ушёл.' };
      render(); return;
    }
    if (a === 'add-expense') {
      var ew = val('e-what') || 'Без названия';
      var es = parseInt(val('e-sum'), 10) || 0;
      DATA.bar.expenses.unshift({ what: ew, cat: EXP.cat, pay: EXP.pay, sum: es,
                                  when: 'сегодня · ' + DATA.member.name });
      DATA.bar.month.spend += es;
      EXP_FIELDS.forEach(function (f) { delete FORM.v[f]; });
      haptic('ok');
      FLASH = 'Затрата записана: ' + ew + ' · ' + money(es) + ' ฿';
      render(); return;
    }

  {
    if (a === 'seg' && SEGS.some(function (s) { return s[0] === arg; })) {
      SEG = arg; haptic(); render(); return;
    }
    if (a === 'retry-events') { loadEvents(); render(); return; }
    if (a === 'recipe' && LIVE) { go('barRecipe', arg); return; }

    if (a === 'create-event' && LIVE) { createEvent(); return; }

    if (a === 'create-event') {
      var title = (val('f-title') || 'Без названия');
      var time = val('f-time') || '19:00';
      var seats = parseInt(val('f-seats'), 10) || 12;
      var price = parseInt(val('f-price'), 10) || 0;
      var id = 'own-' + Date.now();
      DATA.myEvents.unshift({ id: id, title: title, day: dayWord(val('f-date')), time: time,
        signed: 0, of: seats, kind: FORM.kind, price: price, state: 'опубликовано' });
      DATA.events.push({ id: id, title: title, day: dayWord(val('f-date')), time: time,
        part: partOf(time), until: '', master: DATA.member.name, seats: seats, of: seats,
        kind: FORM.kind, price: price, filmed: FORM.filmed,
        about: val('f-about') || 'Описание не заполнено.' });
      FLASH = 'Мероприятие «' + title + '» опубликовано в афише';
      haptic('ok');
      FORM = { kind: 'paid', filmed: false, place: null, v: {} };
      dropDraft();
      go('organizer');
      return;
    }

    if (a === 'cancel-event') {
      FLASH = 'Мероприятие отменено. Запись об отмене осталась.';
      haptic('warn');
      go('organizer');
      return;
    }

    if (a === 'create-service') {
      var st = val('s-title') || 'Без названия';
      DATA.myServices.unshift({ title: st, about: val('s-about') || '—',
        price: val('s-price') || '[цена]', state: 'на проверке' });
      DATA.services.push({ title: st, about: val('s-about') || '—' });
      FLASH = 'Услуга «' + st + '» отправлена директору на проверку';
      haptic('ok');
      go('partner');
      return;
    }

    if (a === 'accept-consent' && LIVE) {
      api('POST', '/me/consent', { data: true }).then(function (r) {
        if (r.status === 200 && r.data && r.data.consent_data_at) {
          DATA.consent = true;
          haptic('ok');
          FLASH = { text: 'Согласие принято', note: 'Клуб записал его с датой.' };
          go(homeOf());
        } else {
          haptic('warn');
          FLASH = { text: 'Согласие не записано',
                    note: r.status ? 'Сервер ответил кодом ' + r.status + '. Попробуйте ещё раз.' : 'Сервер не ответил. Попробуйте ещё раз.' };
          render();
        }
      });
      return;
    }
    if (a === 'accept-consent') {
      giveConsent();
      haptic('ok');
      FLASH = { text: 'Согласие принято',
                note: 'Это демонстрация, поэтому отметка хранится только в этом браузере. В Telegram её хранит клуб — с датой.' };
      go(homeOf());
      return;
    }
    if (a === 'reset-consent') { if (LIVE) return; dropConsent(); go('consent'); return; }
    if (a === 'retry') { boot(); return; }
    if (a === 'bal-toggle') { BAL.shown = !BAL.shown; render(); return; }
    // просьба о вступлении: до входа LIVE ложно, поэтому без «&& LIVE»
    if (a === 'join-retry') { loadJoin(); render(); return; }
    if (a === 'join-pay' && JOIN_PAY[arg]) { JOIN.pay = arg; loadRequisites(arg); render(); return; }
    if (a === 'join-req-retry') { delete JOIN.img[JOIN.pay]; loadRequisites(JOIN.pay); render(); return; }
    if (a === 'join-again') { JOIN.again = true; JOIN.err = ''; render(); return; }
    if (a === 'join-send') { sendJoin(); return; }
    // тетрадь клуба — браузером по токену на час: заголовка подписи браузер не шлёт
    // тетрадь — внутри приложения, со стрелкой назад на экран просьбы (слово владельца 28.10)
    if (a === 'join-about') { go('joinAbout'); return; }
    if (a === 'about-retry') { loadAbout(); render(); return; }
    if (a === 'retry-pass') { loadPass(); render(); return; }
    if (a === 'mr-send' && LIVE) { sendRequest(arg); return; }
    if (a === 'mr-retry' && LIVE) { loadTiers(); render(); return; }
    if (a === 'mr-pick' && LIVE) { MREQ.pick = arg; render(); return; }
    if (a === 'mq-ok' && mayRequests()) { decideRequest(Number(arg), 'approved'); return; }
    if (a === 'mq-ask' && mayRequests()) { MREQS.ask = Number(arg); MREQS.note = ''; render(); return; }
    if (a === 'mq-keep') { MREQS.ask = 0; MREQS.note = ''; render(); return; }
    if (a === 'mq-no' && mayRequests()) { decideRequest(Number(arg), 'rejected'); return; }
    if (a === 'mq-retry' && mayRequests()) { loadRequests(); render(); return; }
    // заявки на доступ: согласие — только вторым нажатием (j-ok спрашивает, j-yes решает)
    if (a === 'j-ok' && mayPeople()) { JOINQ.ok = Number(arg); JOINQ.no = 0; JOINQ.err = ''; render(); return; }
    if (a === 'j-yes' && mayPeople() && JOINQ.ok === Number(arg)) { decideJoin(Number(arg), 'approved'); return; }
    if (a === 'j-ask' && mayPeople()) { JOINQ.no = Number(arg); JOINQ.ok = 0; JOINQ.note = ''; JOINQ.err = ''; render(); return; }
    if (a === 'j-keep') { JOINQ.ok = 0; JOINQ.no = 0; JOINQ.note = ''; render(); return; }
    if (a === 'j-no' && mayPeople() && JOINQ.no === Number(arg)) { decideJoin(Number(arg), 'rejected'); return; }
    if (a === 'j-retry' && mayPeople()) { loadJoinQueue(); render(); return; }
    if (a === 'j-shot' && mayPeople()) { delete JOINQ.shot[Number(arg)]; joinShot(Number(arg)); render(); return; }

    if (a === 'scan') { scanPass(); return; }
    if (a === 'book' && LIVE) { bookEvent(arg); return; }
    if (a === 'event-cancel' && LIVE) { EV_ASK = true; EV_ERR = ''; haptic(); render(); return; }
    if (a === 'event-cancel-yes' && LIVE) { cancelEvent(arg); return; }
    if (a === 'event-cancel-no') { EV_ASK = false; haptic(); render(); return; }
    if (a === 'book-cancel' && LIVE) { BOOK_ASK = true; BOOK_ERR = ''; haptic(); render(); return; }
    if (a === 'book-cancel-yes' && LIVE) { cancelBooking(arg); return; }
    if (a === 'book-cancel-no') { BOOK_ASK = false; haptic(); render(); return; }
    if (a === 'book')  { haptic('ok'); FLASH = 'Вы записаны'; go('bookings'); return; }
  }
}

/* Съёмка напитка и фото чека. Отправить снимок пока некуда — приёма снимков на сервере ещё нет;
   честный ответ лучше вида работающей отправки. */
document.addEventListener('input', function (ev) {
  if (ev.target && ev.target.id === 'p-find') { PEOPLE.find = ev.target.value; peopleFilter(); }
  if (ev.target && ev.target.id === 'd-note') MREQS.note = ev.target.value;
  if (ev.target && ev.target.id === 'join-said') JOIN.said = ev.target.value;
});

// Касса: набранное сразу в память формы — перерисовка от выбора способа или
// отказ сервера иначе стёрли бы сумму и срок.
document.addEventListener('input', function (ev) {
  var t = ev.target, f = t && { 'tp-code': 'code', 'tp-months': 'months', 'tp-amount': 'amount' }[t.id];
  if (f) TP[f] = t.value;
});

document.addEventListener('change', function (ev) {
  var t = ev.target;
  // смена даты сразу показывает, в чей отчёт уйдёт запись
  if (t && t.id === 'b-date' && current === 'barMoney' && !BOOK.busy) { bookGrab(); render(); return; }
  if (t && t.id === 'join-file') { if (t.files && t.files[0]) attachReceipt(t.files[0]); return; }
  if (!t || (t.id !== 'shot-file' && t.id !== 'bill-file')) return;
  var f = t.files && t.files[0];
  if (!f) return;
  haptic('ok');
  FLASH = { text: (t.id === 'shot-file' ? 'Снято: ' : 'Чек: ') + f.name,
            note: 'Отправить пока некуда: приёма снимков на сервере ещё нет, снимок остался в телефоне. Потом он уйдёт в клуб: по съёмке ИИ-команда собирает карточку меню, по чеку — подтверждение затраты.' };
  render();
});

/* Фото гостя не загрузилось — пустой кружок выглядел бы как «так и есть».
   Бармену нужно знать, что сверять не по чему. error не всплывает, поэтому
   ловим на погружении. */
document.addEventListener('error', function (ev) {
  var img = ev.target;
  if (!img || img.tagName !== 'IMG' || !img.classList.contains('avatar')) return;
  var span = document.createElement('span');
  span.className = 'avatar';
  span.textContent = '?';
  span.title = 'фото не загрузилось';
  var note = document.createElement('span');
  note.className = 'small';
  note.textContent = 'фото не загрузилось';
  img.parentNode.insertBefore(note, img.nextSibling);
  img.replaceWith(span);
}, true);

document.getElementById('back').addEventListener('click', function () {
  go(backTo());
});
/* Солнышко — только у богов (god, god_mentor), решение владельца 20.10:
   у остальных переключение работало некорректно. Кнопки нет в разметке
   вовсе: её создаёт render(), когда /me принёс божественную роль, и убирает,
   когда нет. Скрытая стилем осталась бы нажимаемой из консоли. Вне Telegram
   (демонстрация) — тоже нет: там некому быть богом. */
var GODS = ['god', 'god_mentor'];
function isGod() {
  return LIVE && SELF.some(function (r) { return GODS.indexOf(r) !== -1; });
}
var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>';
function sunButton() {
  var el = document.getElementById('demo-btn');
  if (isGod() && !el) {
    el = document.createElement('button');
    el.type = 'button'; el.className = 'icon-btn'; el.id = 'demo-btn';
    el.setAttribute('aria-label', 'Просмотр');
    el.innerHTML = SUN;
    el.addEventListener('click', function () { go('demo'); });
    document.getElementById('bar').appendChild(el);
  } else if (!isGod() && el) {
    el.parentNode.removeChild(el);
  }
}

/* ── запуск ──────────────────────────────────────────── */

/* ── нативное в Telegram ──────────────────────────────
   Каждая возможность появилась в своей версии Bot API, и у человека может
   стоять клиент постарше: спрашиваем isVersionAtLeast, а не наличие метода.
   Вне Telegram всё это молча выключено, и страница работает как обычная. */

/* ⚠ Скрипт Telegram подключается на любой странице, и вне Telegram он всё
   равно отдаёт MainButton и прочее — вызовы проходят вхолостую. Поэтому
   «SDK есть» и «мы внутри Telegram» — разные вопросы: вне клиента platform
   равен 'unknown'. Без этой проверки своя кнопка пряталась под несуществующую
   нативную, и действие становилось недоступно в обычном браузере. */
function inTelegram() {
  return !!(tg && tg.platform && tg.platform !== 'unknown');
}

function tgHas(v) {
  return !!(inTelegram() && tg.isVersionAtLeast && tg.isVersionAtLeast(v));
}

function haptic(kind) {                       // 6.1
  if (!tgHas('6.1') || !tg.HapticFeedback) return;
  try {
    if (kind === 'ok') tg.HapticFeedback.notificationOccurred('success');
    else if (kind === 'warn') tg.HapticFeedback.notificationOccurred('warning');
    else tg.HapticFeedback.selectionChanged();
  } catch (e) { /* старый клиент — тишина вместо падения */ }
}

function scanPass() {                         // 6.4
  if (!tgHas('6.4') || !tg.showScanQrPopup) {
    FLASH = { text: 'Сканер доступен в приложении Telegram', note: 'Эта страница открыта в обычном браузере.' };
    render();
    return;
  }
  tg.showScanQrPopup({ text: 'Наведите на код пропуска' }, function (text) {
    if (LIVE && canTopup()) {          // в QR пропуска ровно код: XIII-0042
      tg.closeScanQrPopup();
      TP.code = String(text).slice(0, 40);
      tillFind(TP.code);
      return true;
    }
    haptic('ok');
    FLASH = { text: 'Пропуск прочитан: ' + String(text).slice(0, 40),
              note: 'Отметить вход пока некуда: на сервере для этого ещё нет ручки — код только показан.' };
    tg.closeScanQrPopup();
    render();
    return true;
  });
}


/* Черновик формы: CloudStorage, 6.9. ⚠ Он виден только этому человеку и
   не заменяет сервер — бармен в нём ничего не увидит. */
function saveDraft() {
  if (!tgHas('6.9') || !tg.CloudStorage) return;
  var d = JSON.stringify({ v: FORM.v, kind: FORM.kind, filmed: FORM.filmed, place: FORM.place });
  if (d.length > 4096) return;                 // предел значения
  try { tg.CloudStorage.setItem('draft_event', d, function () {}); } catch (e) {}
}
function loadDraft(done) {
  if (!tgHas('6.9') || !tg.CloudStorage) { done(false); return; }
  try {
    tg.CloudStorage.getItem('draft_event', function (err, value) {
      if (err || !value) { done(false); return; }
      try {
        var d = JSON.parse(value);
        FORM.v = d.v || {}; FORM.kind = d.kind || 'paid'; FORM.filmed = !!d.filmed;
        FORM.place = typeof d.place === 'number' ? d.place : null;
        done(true);
      } catch (e) { done(false); }
    });
  } catch (e) { done(false); }
}
function dropDraft() {
  if (!tgHas('6.9') || !tg.CloudStorage) return;
  try { tg.CloudStorage.removeItem('draft_event', function () {}); } catch (e) {}
}

/* Главная кнопка внизу — там, где у экрана есть одно главное действие. */
function mainFor() {
  if (current === 'consent' || current === 'consentFull') return { text: 'Принимаю', a: 'accept-consent' };
  if (bare() || LIVE && !WIRED[current]) return null;
  // Пока запрос в пути или права нет, главной кнопки Telegram тоже нет:
  // кнопка, которая молчит по нажатию, неотличима от зависшей.
  if (current === 'eventNew')
    return LIVE && (!mayCreateEvent() || EVN_BUSY) ? null
         : { text: 'Опубликовать в афише', a: 'create-event' };
  if (current === 'serviceNew') return { text: 'Отправить на проверку', a: 'create-service' };
  if (current === 'barCart') return { text: 'Купить', a: 'send-order' };
  // Право отдельно не спрашивается: список грузится только при mayCards(), а права
  // меняет лишь applyMe, перед которым список сброшен. Мутация на mayCards() здесь
  // осталась зелёной — проверка была недостижимой. Что DATA.grants присваивается
  // в одном месте, сторожит tools/live.cjs до первого случая.
  if (current === 'barCards' && LIVE && CARDS.list) return { text: 'Новая карточка', a: 'c-new' };
  if (current === 'barCard' && param === 'new' && !CARD.busy) return { text: 'Сохранить черновик', a: 'c-save' };
  // Ветки «Выдать» здесь больше нет (#502 п.4): выдаёт кружок в строке роли, а главной
  // кнопке Telegram обещать нечем — строки, по которой нажали, у неё нет. Экранного дубля
  // она на этом экране и лишилась вместе с нижним рядом, где стоял `.dup-main`.
  if (current === 'barExpense') return { text: 'Записать затрату', a: 'add-expense' };
  if (current === 'drink' && LIVE) {
    var dl = findDrink(param);
    if (!dl || BUSY || !BAR || !BAR.open || DATA.member.balance < dl.price) return null;   // кнопка на экране объяснит почему
    return { text: 'Купить за ' + money(dl.price) + ' ฿', a: 'buy:' + param };
  }
  if (current === 'drink' && !CART[param]) return { text: 'Добавить в заказ', a: 'cart-add:' + param };
  if (current === 'event') {
    if (LIVE) {
      var le = eventById(param);
      if (!canBookEvent(le)) return null;              // кончилось, занято, уже записан — кнопки нет
      return { text: le.kind === 'paid' ? 'Записаться · ' + money(le.price) + ' ฿ на месте' : 'Записаться',
               a: 'book:' + le.id };
    }
    var e = byId(param) || DATA.events[0];
    return { text: e && e.kind === 'paid' ? 'Оплатить ' + e.price + ' ฿ и записаться' : 'Записаться', a: 'book' };
  }
  return null;
}

var mainHandler = null;
var backHandler = null;

function tgChrome() {
  if (!inTelegram()) return;

  // системная «назад» вместо нарисованной
  if (tg.BackButton && tgHas('6.1')) {
    document.getElementById('back').hidden = true;
    if (backHandler) { tg.BackButton.offClick(backHandler); backHandler = null; }
    // до входа «назад» есть, только если она ведёт на экран входа: свойство, а не список экранов (#458, v74)
    if ((!noEntry() || BARE[backTo()]) && (BACK[current] || !tabList().some(function (t) { return t[0] === current; }))) {
      backHandler = function () { go(backTo()); };
      tg.BackButton.onClick(backHandler);
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  }

  var mb = tg.MainButton;
  if (!mb || !mb.setText) return;
  if (mainHandler) { mb.offClick(mainHandler); mainHandler = null; }
  var m = mainFor();
  if (m) {
    mainHandler = function () { doAction(m.a); };
    mb.setText(m.text);
    mb.onClick(mainHandler);
    mb.show();
    document.body.classList.add('has-main');
  } else {
    mb.hide();
    document.body.classList.remove('has-main');
  }
}

/* ── тема человека и безопасные зоны ──────────────────  #101
   Платформа просит подстраиваться под приложение человека в реальном
   времени, а интерфейс — уважать безопасные зоны, «to avoid overlapping
   with control elements» (core.telegram.org/bots/webapps).

   Роли цвета ложатся на поля themeParams. Фирменная палитра остаётся
   фолбэком в styles.css: поля нет — токен не трогаем вовсе, и экран
   красится как раньше.
   ⚠ Статусы (лист, глина) фирменные и такими остаются: их контраст
   посчитан против НАШЕГО фона, а про чужой мы ничего не знаем.
   ⚠ Снятая форма: делать это на CSS-переменных --tg-theme-*, которые
   публикует сам telegram-web-app.js. Отвергнута потому, что стенд
   подменяет весь telegram.org (tools/live.cjs:108) и переменные
   расставлял бы он же — замер, совпадающий с самим собой. */
var THEME_ROLES = [
  ['--paper',      'bg_color'],
  ['--surface',    'secondary_bg_color'],
  ['--ink',        'text_color'],
  ['--muted',      'hint_color'],
  ['--accent',     'button_color'],
  ['--accent-ink', 'button_text_color']
];

/* ⚠ Привратник на КАЖДОМ чтении, а не на первом: в подделке стенда
   themeParams нет вовсе, и одно незащищённое чтение убивает инициализацию
   целиком — молчащим TypeError, а не красной проверкой. Значение вдобавок
   сверяется с формой #RRGGBB: мусор, пришедший правдоподобной строкой,
   отсеивается ДО того, как попадёт в токен. */
function themeColor(field) {
  var p = tg && tg.themeParams;
  var v = p && p[field];
  return /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : null;
}

function applySafeArea() {                    // 8.0
  var root = document.documentElement;
  [['--tg-sat', 'safeAreaInset', 'top'], ['--tg-sab', 'safeAreaInset', 'bottom'],
   ['--tg-cat', 'contentSafeAreaInset', 'top'], ['--tg-cab', 'contentSafeAreaInset', 'bottom']
  ].forEach(function (r) {
    var o = tgHas('8.0') ? tg[r[1]] : null;
    var v = o && o[r[2]];
    /* Ноль здесь — осмысленное значение, поэтому проверяется ТИП, а не
       истинность: `!v` выбросил бы верный нуль вместе с отсутствующим. */
    if (typeof v === 'number' && v >= 0) root.style.setProperty(r[0], v + 'px');
    else root.style.removeProperty(r[0]);
  });
}

function applyTheme() {
  var dark = tg && tg.colorScheme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

  var root = document.documentElement;
  THEME_ROLES.forEach(function (r) {
    var c = themeColor(r[1]);
    /* Отсутствующее поле СНИМАЕТ токен, а не оставляет прежний: человек мог
       вернуться к теме, где этого поля нет, и застрявший цвет дал бы
       помесь двух палитр. */
    if (c) root.style.setProperty(r[0], c);
    else root.style.removeProperty(r[0]);
  });

  /* Шапка и фон за нашей страницей — ключевым СЛОВОМ, а не цветом: до
     Bot API 6.9 сеттеры принимали только 'bg_color'/'secondary_bg_color',
     и hex там был бы отказом. Слово вдобавок само следует за темой.
     Ворота двойные (версия И наличие), как у haptic: SDK один на все
     клиенты, и наличие метода не обещает поддержки. try/catch — на
     неизвестное, привратники отвечают только за известное. */
  if (tgHas('6.1')) {
    try {
      if (tg.setHeaderColor) tg.setHeaderColor('bg_color');
      if (tg.setBackgroundColor) tg.setBackgroundColor('bg_color');
    } catch (e) { /* старый клиент — тишина вместо падения */ }
  }

  applySafeArea();
}

if (tg) {
  tg.ready();
  tg.expand();
  applyTheme();
  tg.onEvent('themeChanged', applyTheme);
  tg.onEvent('safeAreaChanged', applySafeArea);              // 8.0
  tg.onEvent('contentSafeAreaChanged', applySafeArea);       // 8.0
  var u = tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (u && u.first_name) {
    // Только для приветствия: подпись здесь не проверена, доверять нельзя.
    DATA.member.name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  }
} else {
  applyTheme();
}

boot();
