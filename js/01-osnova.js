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
var VERSION = 'v150 · 0.1 «Путь мастера» · 05.11.2026';

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
                  ops_director: 'Операционный директор', art_director: 'Арт-директор',
                  // держатель ответственности за пополнения: ему идут заявки на пополнение (api `notify.py`,
                  // Cafe13KPG#503). Роль общая, без направления; выдаёт глава клуба (Cafe13KPG#514).
                  // Подпись — слово владельца 29.10.2026: «все ответственности на русском, а эта из кода —
                  // „Пополнение онлайн“». Имя роли в схеме остаётся `topups`; меняется только подпись
                  topups: 'Пополнение онлайн',
                  // роль мастера (api миграция 020); без ключа печаталось сырое `master` латиницей (Cafe13KPG#682)
                  master: 'Мастер' };

/* Дата конца членства в строке имени — ЧИСЛАМИ (кадр E47p: «· до 12.11.2026»), а не словами:
   `ruDate` даёт «12 ноября 2026» и в строку рядом с именем не помещается.
   ⚠ Порог «меньше двух недель» — слово владельца 28.10.2026 («Если до конца членства остается
   менее 2х недель дата краснеет»). Считается он по ЧАСАМ КЛУБА (`TZ`), а не по поясу телефона:
   у человека в другом поясе иначе краснело бы на сутки раньше или позже. Берём сутки клуба
   у обеих дат (`en-CA` даёт YYYY-MM-DD) и вычитаем — так разница целая в днях и не зависит
   от часа, в который открыли экран. */
var TILL_SOON_DNEY = 14;
// ⚠ `clubDay` НЕ заводится заново: он уже есть ниже (сутки клуба из ISO, пустая строка на
// неразобранной дате). Моя вторая копия молча перекрывала первую — поймал сторож батареи
// «имя объявлено на верхнем уровне больше одного раза», а не чтение.
function tillWords(iso) {
  var den = clubDay(iso);
  if (!den) return null;
  var seg = clubDay();
  var ostalos = Math.round((Date.parse(den + 'T00:00:00Z') - Date.parse(seg + 'T00:00:00Z')) / 86400000);
  var ch = den.split('-');
  return { text: ch[2] + '.' + ch[1] + '.' + ch[0], soon: ostalos < TILL_SOON_DNEY };
}
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

