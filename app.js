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
   не изменилось» без неё не отличить от «не выложено». Поднимать при каждой
   заметной правке — вместе с ?v= в index.html и в кнопке меню бота. */
var VERSION = 'v31 · 22.10.2026';

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
  services: [
    { title: 'Аренда байка', about: 'По дням, с залогом и доставкой' },
    { title: 'Доставка воды', about: 'Разово или по расписанию' },
    { title: 'Помощь на дороге', about: 'Сантехник, электрик, механик' }
  ],
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
  myServices: [
    { title: 'Аренда байка', about: 'По дням, с залогом и доставкой', price: '250 ฿/день', state: 'работает' }
  ]
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

var LEVEL = { member: 'Член клуба', organizer: 'Организатор', partner: 'Бизнес-партнёр' };
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
  var p = d.member;
  return {
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
      balance: bal,
      number: p.pass_code || null
    }
  };
}

function untilText(m) {
  return m.lifelong ? 'Пожизненно' : 'Действует до ' + m.until;
}

/* Экраны, которые уже стоят на данных сервера. Остальные в живом режиме
   показывают «ещё не подключено»: демонстрационная афиша рядом с настоящим
   балансом выглядела бы так же настоящей. */
var WIRED = { home: 1, pass: 1, consent: 1, consentFull: 1, membership: 1, demo: 1,
              guest: 1, bar: 1, drink: 1, barCart: 1, barOrder: 1, topup: 1, barQueue: 1, barMoney: 1, barDay: 1,
              events: 1, event: 1, eventNew: 1, barRecipe: 1, people: 1,
              loading: 1, noSign: 1, noAccess: 1, apiDown: 1 };

/* ── пропуск ───────────────────────────────────────────
   Код выдаёт сервер (GET /pass) один раз и больше не меняет, поэтому его
   можно держать на телефоне: у двери вечером сети может не быть, а экран
   обещает, что код работает без интернета. Сохраняется только код и подпись
   под ним — по самому коду никто не войдёт, у сканирующего на экране фото. */
var PASS = null;           // пропуск с сервера в этом запуске
var PASS_FAIL = '';        // почему пропуска нет: текст для экрана
var PASS_KEY = 'cafe13.pass';

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

function passCard(p) {
  return '<div class="pass">' +
      '<div class="who">' +
        '<span class="avatar">' + esc(p.name.slice(0, 1).toUpperCase()) + '</span>' +
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
function loadBar(done) {
  var who = WHO;
  api('GET', '/directions').then(function (r) {
    if (who !== WHO) return;
    var b = r.status === 200 ? fromDirections(r.data) : undefined;
    BAR = b || null;
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
   полосой над каждым экраном — иначе запись глазами Александры легко
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
    peopleReset(); PEOPLE.list = null; PEOPLE.fail = ''; PEOPLE.gen++;
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
var ROLE_PICK = ['head', 'ops_director', 'art_director', 'director', 'staff', 'curator', 'bar', 'admin'];
var DIR_ROLES = ['curator', 'bar'];
var PEOPLE = { list: null, fail: '', dirs: null, dirsFail: '', gen: 0,
               open: null, role: '', dir: null, ask: null, busy: false, deny: null, done: null, find: '' };

function mayPeople() { return LIVE && (grant('head') || grant('admin')); }
/* Блокировка снимается вместе с состоянием экрана: вход на экран и смена роли
   поднимают PEOPLE.gen, и ответ, который снял бы её сам, отбрасывается гардом —
   без этой строки экран оставался запертым до перезапуска (Cafe13KPG#213). */
function peopleReset() {
  PEOPLE.busy = false;
  PEOPLE.open = null; PEOPLE.role = ''; PEOPLE.dir = null; PEOPLE.ask = null; PEOPLE.deny = null; PEOPLE.done = null;
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
    out.push({
      uid: p.tg_user_id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Без имени',
      levels: p.memberships.map(function (l) { return LEVEL[l] || l; }).join(', '),
      roles: roles
    });
  }
  return out;
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
    if (current === 'people') render();
  });
  if (PEOPLE.dirs) return;
  api('GET', '/directions').then(function (r) {
    if (gen !== PEOPLE.gen) return;
    var dirs = r.status === 200 ? fromDirList(r.data) : null;
    PEOPLE.dirs = dirs; PEOPLE.dirsFail = dirs ? '' : failText(r);
    if (current === 'people') render();
  });
}
function grantMissing() {
  if (!PEOPLE.role) return 'Выберите, что поручить.';
  if (DIR_ROLES.indexOf(PEOPLE.role) !== -1 && PEOPLE.dir === null) return 'Выберите направление.';
  return '';
}
function holds(p, role, dir) {
  return p.roles.some(function (r) { return r.role === role && (dir === undefined || r.dir === dir); });
}
function grantSend() {
  var p = PEOPLE.list && PEOPLE.list[PEOPLE.open];
  if (!p || PEOPLE.busy || grantMissing()) return;
  var body = { member_id: p.uid, role: PEOPLE.role };
  var dir = null;
  if (DIR_ROLES.indexOf(PEOPLE.role) !== -1) {
    body.direction_id = PEOPLE.dir;
    dir = (PEOPLE.dirs || []).filter(function (x) { return x.id === PEOPLE.dir; })[0];
  }
  var gen = PEOPLE.gen;
  PEOPLE.busy = true; PEOPLE.deny = null; render();
  api('POST', '/roles', body).then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false;
    var ok = r.status === 201 && r.data && r.data.member_id === p.uid && r.data.role === body.role;
    if (!ok) { PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn'); render(); return; }
    haptic('ok');
    peopleReset();
    PEOPLE.done = { uid: p.uid, text: 'Выдано: ' + roleWords(body.role, dir ? dir.title : '') + '. Кто выдал и когда — записано на сервере.' };
    loadRoster(); render();
  });
}
function revokeSend(rid) {
  var p = (PEOPLE.list || []).filter(function (x) { return x.roles.some(function (y) { return y.id === rid; }); })[0];
  if (!p || PEOPLE.busy) return;
  var role = p.roles.filter(function (y) { return y.id === rid; })[0];
  var gen = PEOPLE.gen;
  PEOPLE.busy = true; PEOPLE.deny = null; render();
  api('POST', '/roles/' + rid + '/revoke').then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false; PEOPLE.ask = null;
    var ok = r.status === 200 && r.data && r.data.id === rid && !!r.data.revoked_at;
    if (!ok) { PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn'); render(); return; }
    haptic('ok');
    peopleReset();
    PEOPLE.done = { uid: p.uid, text: 'Снято: ' + role.words + '. Снятая роль остаётся в истории на сервере.' };
    loadRoster(); render();
  });
}
/* Карточка знает номер строки списка (k), а не tg_user_id: id в разметке
   уехал бы в снимок экрана и дальше. */
function personCard(p, k) {
  var lock = PEOPLE.busy ? ' disabled' : '';
  var open = PEOPLE.open === k;
  var heads = PEOPLE.list.filter(function (x) { return holds(x, 'head'); }).length;
  var rows = p.roles.map(function (r) {
    var asking = PEOPLE.ask === r.id;
    // админа снимает только админ (roles.py _may_touch_admin) — кнопки, которая
    // гарантированно кончится отказом, нет; вместо неё — кто может
    var btn = r.role === 'admin' && !grant('admin') ? '<span class="small">снимает только администратор</span>'
      : asking ? '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="p-keep"' + lock + '>Не снимать</button>' +
                 '<button type="button" class="btn quiet" data-action="p-revoke:' + r.id + '"' + lock + '>Точно снять</button></span>'
      : '<button type="button" class="btn quiet" data-action="p-ask:' + r.id + '"' + lock + '>Снять</button>';
    // роль и направление — два факта: длинное название направления не рвёт имя роли
    var under = [r.dirTitle, r.role === 'head' && heads === 1 ? 'единственный глава клуба' : ''].filter(Boolean).join(' · ');
    return '<div class="row role-row"><span class="col"><span>' + esc(r.name) + '</span>' +
        (under ? '<span class="small">' + esc(under) + '</span>' : '') + '</span>' + btn + '</div>' +
      (asking ? '<span class="small">Снять «' + esc(r.words) + '» у ' + esc(p.name) + '? Права пропадут сразу.</span>' : '');
  }).join('');
  var form = '';
  if (open) {
    var seg = function (label, list, cur, act) {
      return '<div class="group"><span class="label">' + label + '</span><div class="seg wrap">' +
        list.map(function (x) {
          return '<button type="button" data-action="' + act + ':' + esc(String(x[0])) + '"' +
            (String(cur) === String(x[0]) ? ' aria-pressed="true"' : '') + (x[2] ? ' disabled' : lock) + '>' + esc(x[1]) + '</button>';
        }).join('') + '</div></div>';
    };
    // админа выдаёт только админ — кнопку, которую сервер отвергнет, не рисуем.
    // Общую роль, которая уже есть, второй раз не выдать (409). Роль направления
    // закрыта целиком, только если человек занял ВСЕ её направления — иначе выбор
    // вёл бы в тупик «выберите направление», где выбрать нечего; занято не всё —
    // роль открыта, закрыты лишь занятые направления. Состояний перечня три:
    // грузится или не пришёл — роль открыта, под ней причина словами; пришёл
    // ПУСТЫМ (все направления сняты) — роль закрыта «· направлений нет»: выбрать
    // нечего никогда. «Заняты все» на пустом перечне не считаем: [].every истинно.
    var picks = ROLE_PICK.filter(function (r) { return r !== 'admin' || grant('admin'); })
      .map(function (r) {
        var dirRole = DIR_ROLES.indexOf(r) !== -1;
        var none = dirRole && !!PEOPLE.dirs && PEOPLE.dirs.length === 0;
        var have = !dirRole ? holds(p, r)
          : !!PEOPLE.dirs && PEOPLE.dirs.length > 0 && PEOPLE.dirs.every(function (d) { return holds(p, r, d.id); });
        return [r, (ROLE_NAME[r] || r) + (have ? ' · уже есть' : none ? ' · направлений нет' : ''), have || none];
      });
    var needDir = DIR_ROLES.indexOf(PEOPLE.role) !== -1;
    var miss = grantMissing();
    form = seg('Что поручить', picks, PEOPLE.role, 'p-role') +
      (PEOPLE.dirs && !PEOPLE.dirs.length ? '<span class="small">Куратора и бара выдать некуда: открытых направлений в клубе нет.</span>' : '') +
      (!needDir ? ''
       : PEOPLE.dirs ? seg('Направление', PEOPLE.dirs.map(function (d) {
           var have = holds(p, PEOPLE.role, d.id);
           return [d.id, d.title + (have ? ' · уже есть' : ''), have];
         }), PEOPLE.dir, 'p-dir')
       : '<span class="small">' + (PEOPLE.dirsFail ? 'Направления не загрузились: ' + esc(PEOPLE.dirsFail) : 'Загружаем направления…') + '</span>') +
      '<span class="small">Кто выдал и когда — запишется на сервере.</span>' +
      // почему «Выдать» не нажимается — своей строкой у кнопки, а не хвостом заметки
      (miss ? '<span class="small" role="status"><b>' + esc(miss) + '</b></span>' : '') +
      '<div class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="p-close"' + lock + '>Отмена</button>' +
      '<button type="button" class="btn dup-main" data-action="p-grant"' + (miss ? ' disabled' : lock) + '>' + (PEOPLE.busy ? 'Выдаём…' : 'Выдать') + '</button></div>';
  }
  var mine = function (x) { return x && x.uid === p.uid; };
  var deny = mine(PEOPLE.deny) ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(PEOPLE.deny.text) + '</span></div>' : '';
  var done = mine(PEOPLE.done) ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(PEOPLE.done.text) + '</span></div>' : '';
  var q = PEOPLE.find.trim().toLowerCase();
  return '<div class="card" data-person="' + k + '"' +
    (q && p.name.toLowerCase().indexOf(q) === -1 ? ' hidden' : '') + '>' +
    '<div class="row top"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.levels || 'без членства') + '</span></div>' +
    (rows || '<span class="small">Ролей нет</span>') + done + deny + form +
    (open ? '' : '<button type="button" class="btn ghost" data-action="p-open:' + k + '"' + lock + '>Выдать ответственность</button>') +
  '</div>';
}
function peopleFilter() {
  var q = PEOPLE.find.trim().toLowerCase();
  [].forEach.call(document.querySelectorAll('[data-person]'), function (el) {
    var p = PEOPLE.list && PEOPLE.list[Number(el.getAttribute('data-person'))];
    el.hidden = !!q && !!p && p.name.toLowerCase().indexOf(q) === -1;
  });
}

function applyMe(me) {
  DATA.role = me.role;
  DATA.roles = me.roles;
  DATA.barSide = me.barSide;
  DATA.grants = me.grants;
  DATA.consent = me.consent;
  DATA.member = me.member;
  // запас пропуска — только свой и только боевой: чужой код на своём телефоне — чужое платёжное средство
  if (!TEST.on) syncPass(me);
}

function boot() {
  if (!API_ON || !inTelegram() || !tg.initData) { go(startScreen()); return; }
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
var FORM = { kind: 'paid', filmed: false, v: {} };
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
   его отсутствие ответ не портит — просто отменять нечем. Афиша отдаёт и
   то, что началось до трёх часов назад: «идёт» — состояние события, а не
   мусор в ответе. */
var EVENTS = null;          // афиша с сервера или null, пока не пришла
var EVENTS_STATE = '';      // '' — не грузили, 'loading', 'ok', иначе текст отказа
var EVENTS_GEN = 0;         // ответ старого запроса, пришедший позже, молчит
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
      // Сервер отдаёт и то, что началось до трёх часов назад. «Идёт» верно
      // только до конца события: часовая практика, начавшаяся два часа
      // назад, идущей не является — это было бы правдоподобной ложью.
      part: now.getTime() >= start.getTime() && now.getTime() < ends ? 'идёт' : partOf(p.hm),
      done: now.getTime() >= ends,
      master: [e.organizer_first_name, e.organizer_last_name].filter(Boolean).join(' ') || 'Без имени',
      by: e.organizer_id,       // Telegram id ведущего: по нему и только по нему «своё»
      seats: e.seats_left, of: e.seats,
      kind: e.kind, price: price,
      about: typeof e.about === 'string' ? e.about : '',
      filmed: !!e.filmed,
      booked: !!e.booked_by_me,
      // номер своей записи — им отменяют; читать его будет следующий шаг
      bookingId: typeof e.my_booking_id === 'number' ? e.my_booking_id : null
    });
  }
  return out.sort(function (a, b) { return a.at - b.at; });
}

function loadEvents() {
  EVENTS_STATE = 'loading';
  var gen = ++EVENTS_GEN;
  api('GET', '/events').then(function (r) {
    if (gen !== EVENTS_GEN) return;
    var list = r.status === 200 ? fromEvents(r.data) : null;
    if (list) { EVENTS = list; EVENTS_STATE = 'ok'; }
    else EVENTS_STATE = failText(r);
    if (current === 'home' || current === 'events' || current === 'event') render();
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
   людьми клуба. Списка записавшихся тоже нет — ручки «кто записался» на бою
   ещё нет, а пустой список выглядел бы ответом. */
/* ── кто записался ─────────────────────────────────────
   Ручка отдаёт имя, время записи, сумму и признак оплаты; телефонов и
   Telegram id в ответе нет вовсе — и не надо.

   ⚠ Графы «оплатил» здесь НЕТ, хотя поле `paid` в ответе есть: сегодня оно
   всегда false — касса пишет в книгу номер мероприятия, а связи с записью
   не ставит (карточка #103). Колонка по такому полю говорила бы «не
   платил» про тех, кто заплатил, то есть врала бы по всей таблице.

   Сумма подписана «записан на N ฿», а не «к оплате»: `amount_due` ничем не
   гасится, и после оплаты он остался бы прежним.

   Снятые записи не смешиваются с живыми в одном счёте: они показаны
   отдельно и помечены. Иначе ведущий считал бы пришедших по длине списка.
   ⚠ Сегодня сервер снятых не отдаёт вовсе (`WHERE b.state <> 'cancelled'`,
   замер по боевой ревизии `880b4b6`), то есть эта ветка на бою недостижима.
   Она оставлена не ради вида, а как защита от изменения на сервере: если
   снятые однажды поедут, они не попадут в счёт живых молча. Случай в
   прогоне это и сторожит — доказательством живого пути он не является. */
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
    var p = bkk(when);
    out.push({
      id: b.id,
      name: [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Без имени',
      when: dayLabel(p, now) + ', ' + p.hm,
      sum: sum,
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

function signedRow(p, kind, off) {
  return '<div class="card"><div class="row">' +
      '<div class="col"><b>' + esc(p.name) + '</b>' +
        '<span class="small">' + esc(p.when) +
          (p.sum > 0 && kind === 'paid' ? ' · записан на ' + money(p.sum) + ' ฿' : '') +
        '</span></div>' +
      (off ? '<span class="pill">снята</span>' : '') +
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
  return spor + live.map(function (p) { return signedRow(p, e.kind, false); }).join('') +
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
  if (EV_ASK) return head + '<div class="card strong"><div class="col">' +
      '<b style="font-size:13px">Отменить мероприятие?</b>' +
      '<span class="small">Записи всех, кто записался, будут сняты. Вернуть их сможет только каждый сам.</span></div>' +
      '<button type="button" class="btn ghost" data-action="event-cancel-yes:' + esc(e.id) + '">Да, отменить</button>' +
      '<button type="button" class="btn quiet" data-action="event-cancel-no">Оставить</button></div></div>';
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
  return { body: { title: title, starts_at: starts, duration_min: dur, seats: seats,
                   kind: FORM.kind, price: price,
                   about: val('f-about'), filmed: !!FORM.filmed } };
}

/* Имена полей запроса по-русски: 422 называет поле в `loc`, и это
   единственное, что в его теле годится человеку — `msg` приходит
   по-английски. Поля, которого здесь нет, мы не отправляем вовсе: тогда
   честнее общий текст с кодом, чем выдуманное имя. */
var FIELD_RU = { title: 'Название', starts_at: 'Начало', duration_min: 'Длительность',
                 seats: 'Мест', price: 'Цена', about: 'Описание', kind: 'Вид участия',
                 filmed: 'Съёмка' };

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
      FORM = { kind: 'paid', filmed: false, v: {} };
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

/* Карточка события на живых данных. Кнопки записи здесь пока нет: запись —
   следующим шагом, а кнопка, которая ничего не делает, хуже её отсутствия. */
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
  // Подпись говорит только о деньгах — о том, чего человек не знает и что
  // решает за него сервер. Про отмену здесь не сказано ни слова: отменить
  // из приложения сегодня нечем, а обещание, данное ДО записи, человек
  // прочитает как право, которого у него не будет.
  var hint = e.kind === 'paid'
    ? 'К оплате ' + money(e.price) + ' ฿ на месте: при записи со счёта не списывается.'
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
function byId(id) { return DATA.events.filter(function (e) { return e.id === id; })[0]; }
function isMember() { return ['member', 'organizer', 'partner'].indexOf(DATA.role) !== -1; }

var ICON = {
  home: '<path d="M4 10l8-6 8 6v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z"/>',
  plus: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  cal:  '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>',
  till: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M3 12h18"/>',
  cam:  '<path d="M3 7h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  star: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18"/>',
  cup:  '<path d="M5 8h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5z"/><path d="M16 9h2.4a2.4 2.4 0 010 4.8H16"/><path d="M4 21h13"/>',
  bell: '<path d="M18.5 16.5h-13L7 14.1V10a5 5 0 0110 0v4.1z"/><path d="M10 19.5a2 2 0 004 0"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  coin: '<ellipse cx="12" cy="7" rx="8" ry="3.2"/><path d="M4 7v10c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V7"/><path d="M4 12.2c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2"/>',
  chev: '<path d="M9 6l6 6-6 6"/>'
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
        '<span class="small" style="text-align:right;max-width:130px">Пополняется в кассе</span>' +
      '</div></div>' +

      (next ? '<div class="group"><span class="label">Вы записаны</span>' +
        '<button type="button" class="listitem accent" data-go="bookings">' +
          '<span class="grow"><b>' + esc(next.title) + '</b><span class="small">' + esc(next.when) + '</span></span>' +
          svg(ICON.chev, 'chev') +
        '</button></div>' : '') +

      rolePanel() +

      (LIVE ? myRoles() +
        (canTopup() ? '<button type="button" class="btn ghost" data-go="topup">Внести себе на счёт</button>' : '') +
        (DATA.barSide ? '<div class="group"><span class="label">Работа</span>' +
          '<button type="button" class="listitem accent" data-go="barQueue">' +
            '<span class="grow"><b>Заказы на баре</b><span class="small">Очередь: принять, готово, выдан</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' +
          (mayBook() ? '<button type="button" class="listitem" data-go="barMoney">' +
            '<span class="grow"><b>Доход и расход бара</b><span class="small">Выручка и затраты руками, с комментарием</span></span>' +
            svg(ICON.chev, 'chev') + '</button>' : '') +
          '</div>' : '') +
        (mayPeople() ? '<div class="group"><span class="label">Клуб</span>' +
          '<button type="button" class="listitem accent" data-go="people">' +
            '<span class="grow"><b>Люди и ответственность</b><span class="small">Кто за что отвечает: выдать и снять</span></span>' +
            svg(ICON.chev, 'chev') + '</button></div>' : '') +
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
        '</div>' + notWired('Услуги острова');
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
    if (LIVE) {
      if (PASS) return passCard(PASS) +
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
    (FLASH ? flash() : '') +
    '<button type="button" class="btn ghost" data-action="phone">Поделиться телефоном</button>' +
    '<div class="note">' + svg(ICON.info) +
      '<span>Телефон нужен кассе, чтобы найти вас без поиска по имени. Оплата — в кассе, наличными или картой: работник отметит её, и уровень обновится здесь.</span>' +
    '</div>';
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
        svg('<path d="M12 5v14M5 12h14"/>') + 'Создать мероприятие</button>' : '');
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
      foot = '<button type="button" class="btn dup-main" data-action="book">Оплатить ' + e.price + ' ฿ и записаться</button>' +
             '<span class="small" style="text-align:center">Место держится 15 минут, пока идёт оплата. Не оплачено — место возвращается в афишу.</span>';
    } else if (e.kind === 'free') {
      foot = '<button type="button" class="btn dup-main" data-action="book">Записаться</button>' +
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
    return (FLASH ? flash() : '') +
      '<button type="button" class="btn" data-action="scan">' + svg(ICON.till) + 'Сканировать пропуск</button>' +
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

  organizer: function () {
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
        '<span>Цену своего мероприятия назначаете вы. Клуб берёт за уровень организатора, а не долю со входа.</span>' +
      '</div>';
  },

  eventNew: function () {
    var paid = FORM.kind === 'paid';
    // У человека без права формы нет вовсе: форма, отказывающая по нажатию,
    // хуже прямой строки о том, кто заводит мероприятия.
    if (LIVE && !mayCreateEvent())
      return '<div class="card quiet"><div class="col">' +
        '<b style="font-size:13px">Мероприятия заводят не все</b>' +
        '<span class="small">Их заводят организатор, бизнес-партнёр и работники клуба. Свой уровень членства видно на экране «Членство».</span>' +
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
        '<input id="s-title" type="text" placeholder="Например: аренда байка"></div>' +
      '<div class="field"><label for="s-about">Коротко, что это</label>' +
        '<input id="s-about" type="text" placeholder="По дням, с залогом и доставкой"></div>' +
      '<div class="field"><label for="s-price">Цена</label>' +
        '<input id="s-price" type="text" placeholder="250 ฿/день"></div>' +
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
        '<div><span>Посмотреть и удалить о себе</span><span class="pill gold">в любой момент</span></div>' +
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
    if (!mayRecipe()) return '<div class="card quiet"><div class="col">' +
      '<b style="font-size:13px">Рецепт — рабочая запись бара</b>' +
      '<span class="small">Его показывают бару и куратору направления: гостю сервер его не отдаёт вовсе.</span>' +
      '</div></div>';
    return '<div class="col"><h1>' + esc(d ? d.title : 'Позиция ' + id) + '</h1>' +
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
      '<div class="card strong"><span class="label">На счёте</span>' +
        '<span class="big num">' + money(DATA.member.balance) + ' ฿</span>' +
        '<p>Счёт пополняется у хостес клуба. Деньги появятся здесь сразу, как их внесут.</p></div>' +
      '<button type="button" class="btn ghost" data-go="bar">Вернуться в меню</button>';
  },

  barMoney: function () {
    if (!BAR) return (FLASH ? flash() : '') +
      (BOOK_FAIL ? '<div class="card quiet"><span class="small">' + esc(BOOK_FAIL) + '</span></div>' +
                   '<button type="button" class="btn ghost" data-action="book-retry">Повторить</button>'
                 : '<div class="card quiet"><span class="small">Загружаем направление…</span></div>');
    if (!canBook()) return '<div class="card quiet"><span class="small">Доход и расход Бара вносит куратор направления.</span></div>';
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

  people: function () {
    if (!mayPeople()) return '<div class="card quiet"><span class="small">Выдавать и снимать ответственность может глава клуба.</span></div>';
    if (!PEOPLE.list) return PEOPLE.fail
      ? '<div class="card quiet"><span class="small">' + esc(PEOPLE.fail) + '</span></div>' +
        '<button type="button" class="btn ghost" data-action="p-reload">Повторить</button>'
      : '<div class="card quiet"><span class="small">Загружаем людей…</span></div>';
    return '<div class="field"><label for="p-find">Найти по имени</label>' +
        '<input id="p-find" type="search" value="' + esc(PEOPLE.find) + '" placeholder="Имя"></div>' +
      (PEOPLE.list.length ? PEOPLE.list.map(personCard).join('')
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

  noAccess: function () {
    return '<div class="card strong"><h2>Вас нет в списке</h2>' +
      '<p>Приложение клуба пока открыто только для тех, кого внёс владелец. Подпись Telegram в порядке — дело не в ней.</p>' +
      '<p class="small">Если вам нужен доступ, напишите владельцу клуба.</p></div>';
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
      ['organizer', 'Организатор', 'то же плюс свои мероприятия'],
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

function eventRow(e) {
  var k = KIND[e.kind];
  return '<button type="button" class="listitem' + (e.kind === 'paid' ? ' accent' : '') + '" data-event="' + esc(e.id) + '">' +
    '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.part) + '</span></span>' +
    '<span class="grow"><b>' + esc(e.title) + '</b>' +
    '<span class="small">ведёт ' + esc(e.master) + ' · ' + (e.done ? 'завершилось'
      : e.booked ? 'вы записаны'
      : e.seats === 0 ? 'мест нет' : e.seats === e.of ? e.of + ' мест' : 'осталось ' + e.seats) + '</span></span>' +
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
  guest:     [['guest', 'Услуги', ICON.plus], ['bookings', 'Записи', ICON.cal]],
  member:    [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus], ['bookings', 'Записи', ICON.cal]],
  organizer: [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus],
              ['organizer', 'События', ICON.star], ['bookings', 'Записи', ICON.cal]],
  partner:   [['home', 'Клуб', ICON.home], ['guest', 'Услуги', ICON.plus],
              ['partner', 'Моё дело', ICON.case], ['bookings', 'Записи', ICON.cal]],
  staff:     [['staff', 'Касса', ICON.till], ['home', 'Клуб', ICON.home]],
  bar:       [['barQueue', 'Заказы', ICON.bell], ['barShot', 'Съёмка', ICON.cam],
              ['barDay', 'День', ICON.chart], ['barExpense', 'Затраты', ICON.coin]],
  curator:   [['curator', 'Бар', ICON.cup], ['barDay', 'День', ICON.chart],
              ['barExpense', 'Затраты', ICON.coin], ['home', 'Клуб', ICON.home]]
};
var TITLES = {
  pass: 'Пропуск', membership: 'Членство', events: 'Афиша',
  event: 'Мероприятие', bookings: 'Мои записи', staff: 'Касса', demo: 'Демо-режим',
  consentFull: 'Подробно',
  bar: 'Бар', drink: 'Напиток', barCart: 'Ваш заказ', barOrder: 'Заказ', barRecipe: 'Рецепт',
  barQueue: 'Заказы на баре', topup: 'Пополнить счёт', barShot: 'Съёмка напитков', barDay: 'Отчёт за день',
  barExpense: 'Затраты направления', curator: 'Направление «Бар»', barMoney: 'Доход и расход',
  organizer: 'Мои мероприятия', eventNew: 'Новое мероприятие',
  eventManage: 'Мероприятие', partner: 'Моё направление', serviceNew: 'Новая услуга',
  people: 'Люди'
};

/* Вкладки идут от уровня членства, а рабочая — от роли с сервера: бармен
   без членства — гость по уровню, и без этого до очереди он не доходил
   (вход был только кнопкой на главной, а главной у гостя нет). */
function tabList() {
  var t = (TABS[DATA.role] || []).slice();
  if (LIVE && DATA.barSide && !t.some(function (x) { return x[0] === 'barQueue'; }))
    t.unshift(['barQueue', 'Заказы', ICON.bell]);
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
  people: 'home',
  serviceNew: 'partner', consentFull: 'consent',
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

/* Экраны без вкладок: уйти с них можно решением, а не переключением. */
var BARE = { consent: 1, consentFull: 1, loading: 1, noSign: 1, noAccess: 1, apiDown: 1 };
function bare() { return !!BARE[current]; }

var current = 'home';
var param = null;

function render() {
  var view = document.getElementById('view');
  view.innerHTML = (bare() ? '' : testStrip()) + SCREENS[LIVE && !WIRED[current] ? 'soon' : current](param);

  var root = tabList().some(function (t) { return t[0] === current; });
  document.getElementById('back').hidden = root || bare() && current !== 'consentFull';

  var title = document.getElementById('title');
  if (current === 'home' || current === 'guest' || bare() && current !== 'consentFull') {
    title.textContent = 'Café XIII';
    title.className = 'wordmark';
  } else {
    title.textContent = LIVE && current === 'demo' ? 'Просмотр' : TITLES[current] || 'Café XIII';
    title.className = 'wordmark plain';
  }

  var tabs = document.getElementById('tabs');
  var list = bare() ? [] : tabList();
  tabs.hidden = !list.length;
  document.body.classList.toggle('no-tabs', !list.length);
  tabs.innerHTML = list.map(function (t) {
    var on = t[0] === current;
    return '<button type="button" data-go="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');

  sunButton();
  tgChrome();
  window.scrollTo(0, 0);
}

function go(screen, p) {
  if (!SCREENS[screen]) return;
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
  current = screen;
  param = p || null;
  if (screen === 'barMoney' && LIVE && !BAR) bookLoad();
  if (screen === 'barDay' && LIVE) loadDay();
  if (screen === 'pass' && LIVE && !PASS && !PASS_FAIL) loadPass();
  if ((screen === 'bar' || screen === 'drink') && LIVE && MENU_STATE === '') loadMenu();
  if ((screen === 'home' || screen === 'events') && LIVE && EVENTS_STATE === '') loadEvents();
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
  var el = ev.target.closest('[data-go],[data-event],[data-role],[data-kind],[data-toggle],[data-manage],[data-action],[data-drink],[data-where],[data-pay],[data-exp],[data-expay]');
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
  if (el.hasAttribute('data-toggle')) {
    grabForm(EVENT_FIELDS); FORM.filmed = !FORM.filmed; haptic(); saveDraft(); render(); return;
  }
  if (el.hasAttribute('data-manage')) { go('eventManage', el.getAttribute('data-manage')); return; }

  if (el.hasAttribute('data-action')) { doAction(el.getAttribute('data-action')); return; }
  if (el.hasAttribute('data-event')) { go('event', el.getAttribute('data-event')); return; }
  go(el.getAttribute('data-go'));
});

function doAction(a) {
  /* Действия бара несут аргумент через двоеточие: cart-add:flat, order-make:A-16.
     Разбор здесь, чтобы разметка оставалась одними атрибутами. */
  var arg = null, c = a.indexOf(':');
  if (c !== -1) { arg = a.slice(c + 1); a = a.slice(0, c); }

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
    if (a.slice(0, 2) === 'p-' && current === 'people') {
      if (PEOPLE.busy) return;
      if (a === 'p-reload') { loadRoster(); render(); return; }
      if (a === 'p-grant') { grantSend(); return; }
      if (a === 'p-revoke') { revokeSend(Number(arg)); return; }
      if (a === 'p-open') { peopleReset(); PEOPLE.open = Number(arg); }
      if (a === 'p-close') peopleReset();
      if (a === 'p-role' && ROLE_PICK.indexOf(arg) !== -1) {
        PEOPLE.role = arg; PEOPLE.dir = null;
        // выбор из одного — не выбор: единственное направление ставится само
        // (занятое единственное направление сюда не доходит: такая роль закрыта в форме)
        if (DIR_ROLES.indexOf(arg) !== -1 && PEOPLE.dirs && PEOPLE.dirs.length === 1) PEOPLE.dir = PEOPLE.dirs[0].id;
      }
      if (a === 'p-dir') PEOPLE.dir = Number(arg);
      if (a === 'p-ask') { PEOPLE.ask = Number(arg); PEOPLE.deny = null; }
      if (a === 'p-keep') PEOPLE.ask = null;
      haptic(); render();
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
      FORM = { kind: 'paid', filmed: false, v: {} };
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
    if (a === 'retry-pass') { loadPass(); render(); return; }

    if (a === 'scan') { scanPass(); return; }
    if (a === 'phone') { askPhone(); return; }
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
});

document.addEventListener('change', function (ev) {
  var t = ev.target;
  // смена даты сразу показывает, в чей отчёт уйдёт запись
  if (t && t.id === 'b-date' && current === 'barMoney' && !BOOK.busy) { bookGrab(); render(); return; }
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
    haptic('ok');
    FLASH = { text: 'Пропуск прочитан: ' + String(text).slice(0, 40),
              note: 'Отметить вход пока некуда: на сервере для этого ещё нет ручки — код только показан.' };
    tg.closeScanQrPopup();
    render();
    return true;
  });
}

function askPhone() {                          // 6.9
  if (!tgHas('6.9') || !tg.requestContact) {
    FLASH = 'Телефон запрашивается только внутри Telegram';
    render();
    return;
  }
  tg.requestContact(function (ok) {
    haptic(ok ? 'ok' : 'warn');
    FLASH = { text: ok ? 'Телефон получен' : 'Без телефона тоже можно',
              note: ok ? 'Сохранить его пока некуда: на сервере для телефона ещё нет места.' : '' };
    render();
  });
}

/* Черновик формы: CloudStorage, 6.9. ⚠ Он виден только этому человеку и
   не заменяет сервер — бармен в нём ничего не увидит. */
function saveDraft() {
  if (!tgHas('6.9') || !tg.CloudStorage) return;
  var d = JSON.stringify({ v: FORM.v, kind: FORM.kind, filmed: FORM.filmed });
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
  if (current === 'people' && PEOPLE.open !== null && !PEOPLE.busy && !grantMissing()) return { text: 'Выдать', a: 'p-grant' };
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
    if (BACK[current] || !tabList().some(function (t) { return t[0] === current; })) {
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
