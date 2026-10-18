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

/* Видимая версия. Telegram держит мини-приложения в своём кэше, и «у меня
   не изменилось» без неё не отличить от «не выложено». Поднимать при каждой
   заметной правке — вместе с ?v= в index.html и в кнопке меню бота. */
var VERSION = 'v7 · 16.10.2026';

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
    { id: 'A-15', who: '[имя члена]', at: '19:44', where: 'за стойку', pay: 'наличные',
      items: [['Колд-брю', 1]], sum: 120, state: 'making' },
    { id: 'A-14', who: '[имя члена]', at: '19:38', where: 'с собой', pay: 'со счёта',
      items: [['Пуэр', 1], ['Кокос-лайм', 1]], sum: 325, state: 'ready' },
    { id: 'A-13', who: '[имя члена]', at: '19:20', where: 'за стойку', pay: 'наличные',
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

/* Корзина и выбор в формах бара. Как и всё остальное без сервера — живёт
   до перезагрузки вкладки. */
var CART = {};
var ORDER = { where: 'за стойку', pay: 'со счёта' };
var EXP = { cat: 'закуп', pay: 'касса клуба' };
var EXP_FIELDS = ['e-what', 'e-sum'];
var ORDERSEQ = 0;

/* ── сервер клуба ──────────────────────────────────────
   Адрес зашит, а не берётся из ссылки: подпись Telegram — пропуск человека,
   и страница, которая шлёт её туда, куда скажет параметр в адресе, отдала бы
   его кому угодно.

   API_ON — выключатель. Включается, только когда на сервере встал список
   допущенных и CORS приехал той же выкладкой: CORS и есть дверь, список —
   замок. До этого клиент к серверу не ходит вовсе, и выкладка страницы с
   выключенным API ничего не открывает. Вне Telegram (initData пуста) запросов
   нет и с включённым: гостевой вход отложен (Cafe13KPG#52). */
var API = 'https://api.cafe13.club';
var API_ON = false;
var LIVE = false;          // true — данные на экране пришли с сервера, а не из DATA
var FAIL = '';             // чем кончилась неудачная попытка, для экрана apiDown
var FAIL_NET = false;      // сервер не ответил вовсе — тогда можно показать сохранённый пропуск

function api(method, path, body) {
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
  var opt = { method: method, headers: { 'X-Telegram-Init-Data': tg.initData } };
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
var ROLE_NAME = { head: 'Глава клуба', admin: 'Администратор', director: 'Директор',
                  staff: 'Касса', curator: 'Куратор направления', bar: 'Бар · исполнитель' };

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
              guest: 1, bar: 1, drink: 1, barCart: 1, barOrder: 1, topup: 1, barQueue: 1,
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
      try { localStorage.setItem(PASS_KEY, JSON.stringify(p)); } catch (e) { /* без запаса — только онлайн */ }
    } else {
      // 403 бывает двух видов: «доступа нет» (не в списке, cafe13-api#7) —
      // это отказ во входе целиком; «членство не активно» — только пропуску.
      if (r.status === 403) dropPass();
      if (r.status === 403 && r.data && r.data.detail === 'доступа нет') { go('noAccess'); return; }
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
    '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#190F26" d="' + out + '"/></svg>';
}

function passCard(p) {
  return '<div class="pass">' +
      '<div class="who">' +
        '<span class="avatar">' + esc(p.name.slice(0, 1).toUpperCase()) + '</span>' +
        '<span class="col"><b style="font-size:19px;font-family:\'Zilla Slab\',Georgia,serif">' + esc(p.name) + '</b>' +
        '<span style="font-size:12px;color:#F0DFF2">' + esc(p.level) + ' · ' + esc(p.lifelong ? 'пожизненно' : 'до ' + ruDate(p.ends)) + '</span></span>' +
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
function loadBar(done) {
  api('GET', '/directions').then(function (r) {
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
  if (BAR) { go_(); return; }
  loadBar(function (err) {
    if (current !== 'barQueue' || gen !== QUEUE_GEN) return;
    if (err) { QUEUE_FAIL = err; render(); return; }
    go_();
  });
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
  api('GET', '/bar/menu?direction_id=' + BAR.id).then(function (r) {
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

function placeOrder(items, place, pay) {
  if (BUSY) return;
  if (!BAR || !BAR.open) {
    FLASH = { text: 'Бар закрыт', note: 'Смена не открыта — заказ не отправлен.' };
    haptic('warn'); render(); return;
  }
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
      FLASH = { text: 'Заказ ' + o.id + ' отправлен на бар', note: '' };
      refreshMe();
      go('barOrder');
      return;
    }
    haptic('warn');
    var detail = r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
    if (r.status === 409 && /^на счёте/.test(detail)) {
      FLASH = { text: 'На счёте не хватает', note: detail.replace(/^на счёте/, 'На счёте') + ' ฿.' };
      refreshMe();
      go('topup');
      return;
    }
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
    FLASH = { text: 'Заказ не отправлен',
              note: detail ? detail[0].toUpperCase() + detail.slice(1) + '.' : 'Сервер ответил кодом ' + r.status + '.' };
    if (r.status === 409) loadMenu();
    render();
  });
}

function buy(id) {
  var d = findDrink(id);
  if (!d) return;
  placeOrder([{ pid: d.pid, title: d.title, n: 1 }], 'за стойку', 'account');
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
    DATA.role = me.role;
    DATA.roles = me.roles;
    DATA.barSide = me.barSide;
    DATA.consent = me.consent;
    DATA.member = me.member;
    syncPass(me);
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

/* Состояние форм. Сервера нет: созданное живёт до перезагрузки вкладки. */
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
        (DATA.barSide ? '<div class="group"><span class="label">Работа</span>' +
          '<button type="button" class="listitem accent" data-go="barQueue">' +
            '<span class="grow"><b>Заказы на баре</b><span class="small">Очередь: принять, готово, выдан</span></span>' +
            svg(ICON.chev, 'chev') + '</button></div>' : '') +
        notWired('Афиша и записи') :
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
    (FLASH ? flash() : '') +
    '<button type="button" class="btn ghost" data-action="phone">Поделиться телефоном</button>' +
    '<div class="note">' + svg(ICON.info) +
      '<span>Телефон нужен кассе, чтобы найти вас без поиска по имени. Оплата — в кассе, наличными или картой: работник отметит её, и уровень обновится здесь.</span>' +
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
    return '<p style="font-size:13px">Появится в афише клуба сразу после публикации.</p>' +

      '<div class="field"><label for="f-title">Название</label>' +
        '<input id="f-title" type="text" value="' + keep('f-title') + '" placeholder="Например: звуковая практика"></div>' +

      '<div class="row" style="gap:10px;align-items:stretch">' +
        '<div class="field" style="flex:1 1 0"><label for="f-date">День</label>' +
          '<input id="f-date" type="date" value="' + keep('f-date') + '"></div>' +
        '<div class="field" style="flex:1 1 0"><label for="f-time">Начало</label>' +
          '<input id="f-time" type="time" value="' + keep('f-time', '19:00') + '"></div>' +
      '</div>' +

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
        '<div class="field" style="flex:1 1 0"><label for="f-dur">Длительность</label>' +
          '<input id="f-dur" type="text" value="' + keep('f-dur', '90 мин') + '"></div>' +
        '<div class="field" style="flex:1 1 0"><label for="f-seats">Мест</label>' +
          '<input id="f-seats" type="number" inputmode="numeric" value="' + keep('f-seats', '12') + '"></div>' +
      '</div>' +

      '<div class="group"><span class="label">Участие</span>' +
        '<div class="seg">' +
          [['paid','Платное'],['free','Бесплатное'],['donation','Донейшн']].map(function (k) {
            return '<button type="button" data-kind="' + k[0] + '" aria-pressed="' +
              (FORM.kind === k[0]) + '">' + k[1] + '</button>';
          }).join('') +
        '</div>' +
        (paid ? '<div class="field"><label for="f-price">Цена входа, ฿</label>' +
                '<input id="f-price" type="number" inputmode="numeric" value="' + keep('f-price', '400') + '"></div>'
              : '<div class="note">' + svg(ICON.info) + '<span>' + (FORM.kind === 'free'
                  ? 'Бесплатное: человек просто записывается, место держится за ним.'
                  : 'Донейшн: сумма необязательна, и её отсутствие не мешает записаться.') +
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

      '<button type="button" class="btn dup-main" data-action="create-event">Опубликовать в афише</button>';
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
            ? 'Открыт до 23:00. Заказ уходит на бар сразу, платите со счёта или наличными.'
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
          : '<button type="button" class="btn ghost" data-action="cart-add:' + esc(d.id) + '">В заказ</button>');
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

  barCart: function () {
    var list = cartList();
    if (!list.length) {
      return '<div class="card quiet"><span class="small">Заказ пуст.</span></div>' +
        '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
    }
    var wheres = ['за стойку', 'к столу', 'с собой'];
    var pays = ['со счёта', 'наличными'];
    return '<div class="group"><span class="label">Состав</span>' +
        list.map(function (x) {
          var d = findDrink(x.id);
          return '<div class="card"><div class="row top">' +
            '<div class="col"><b>' + esc(x.title) + '</b>' +
              '<span class="small num">' + x.n + ' × ' + x.price + ' = ' + money(x.n * x.price) + ' ฿</span></div>' +
            stepper(d) + '</div></div>';
        }).join('') +
        '<div class="rows"><div><span>Итог</span><b class="num">' + money(cartSum()) + ' ฿</b></div></div>' +
      '</div>' +
      '<div class="group"><span class="label">Куда подать</span><div class="seg">' +
        wheres.map(function (w) {
          return '<button type="button" data-where="' + esc(w) + '"' +
            (ORDER.where === w ? ' aria-pressed="true"' : '') + '>' + esc(w) + '</button>';
        }).join('') + '</div></div>' +
      (LIVE
        /* Решение владельца, первая версия: на баре платят только со счёта,
           пополняют у хостес. Сервер наличные отклоняет (cafe13-api#13) —
           выбор, которого нет, не показываем. */
        ? '<div class="group"><span class="label">Оплата</span>' +
            '<span class="small">Со счёта в клубе, сразу при отправке: на счёте ' + money(DATA.member.balance) + ' ฿. Пополнить можно у хостес.</span></div>' +
          '<button type="button" class="btn dup-main" data-action="send-order">Отправить на бар</button>' +
          '<div class="note">' + svg(ICON.bell) +
            '<span>Отменить заказ может только бар — тогда деньги вернутся на счёт.</span></div>'
        :
      '<div class="group"><span class="label">Чем платите</span><div class="seg">' +
        pays.map(function (p) {
          return '<button type="button" data-pay="' + esc(p) + '"' +
            (ORDER.pay === p ? ' aria-pressed="true"' : '') + '>' + esc(p) + '</button>';
        }).join('') + '</div>' +
        '<span class="small">' + (ORDER.pay === 'со счёта'
          ? 'Спишется с вашего счёта в клубе: остаток ' + money(DATA.member.balance) + ' ฿.'
          : 'Отдадите на баре, работник внесёт в кассу при выдаче.') + '</span>' +
      '</div>' +
      '<button type="button" class="btn dup-main" data-action="send-order">Отправить на бар</button>' +
      '<div class="note">' + svg(ICON.bell) +
        '<span>Бар получит уведомление в ту же секунду. Отменить заказ можно, пока его не приняли, — дальше через работника на баре.</span>' +
      '</div>');
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
    return (FLASH ? flash() : '') +
      '<div class="card strong"><span class="label">На счёте</span>' +
        '<span class="big num">' + money(DATA.member.balance) + ' ฿</span>' +
        '<p>Счёт пополняется у хостес клуба. Деньги появятся здесь сразу, как их внесут.</p></div>' +
      '<button type="button" class="btn ghost" data-go="bar">Вернуться в меню</button>';
  },

  barQueue: function () {
    if (LIVE) {
      var q = QUEUE || [];
      var cnt = function (st) { return q.filter(function (o) { return o.state === st; }).length; };
      return (FLASH ? flash() : '') +
        '<div class="card strong"><div class="row top">' +
          '<div class="col"><h2>Заказы на баре</h2>' +
            '<span class="small">' + (BAR ? (BAR.open ? 'Смена открыта' : 'Смена не открыта — новые заказы не приходят') : '') + '</span></div>' +
          (BAR ? '<span class="pill' + (BAR.open ? ' on' : '') + '">' + (BAR.open ? 'открыт' : 'закрыт') + '</span>' : '') +
        '</div></div>' +
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
          ' · ' + money(d.revenue) + ' ฿</span></div>' +
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
        '<span>Каждый новый заказ бот присылает в чат бара — составом и кнопкой «Принял», чтобы не держать приложение открытым. Звук включается в настройках этого чата, а не в приложении. Пока сервера нет, заказы живут только в этой вкладке.</span>' +
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
        '<span>Сервера пока нет: кнопка открывает камеру, но снимок никуда не уйдёт — экран показывает порядок работы. С сервером снимок попадает в клуб, а в меню выходит уже готовая карточка.</span>' +
      '</div>';
  },

  barDay: function () {
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
    if (LIVE) {
      return '<div class="card quiet"><div class="col">' +
          '<b>Данные — с сервера клуба</b>' +
          '<span class="small">Версия приложения: <b>' + esc(VERSION) + '</b></span>' +
          '<span class="small">Роль пришла с сервера по подписи Telegram, переключить её отсюда нельзя.</span>' +
        '</div></div>';
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
        '<b>Это демонстрация без сервера</b>' +
        '<span class="small">Версия приложения: <b>' + esc(VERSION) + '</b></span>' +
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
    DATA.roles.map(function (r) {
      return '<span class="pill">' + esc(ROLE_NAME[r] || r) + '</span>';
    }).join('') +
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
    ? 'Сохранено только в этой вкладке: сервера пока нет, при перезагрузке исчезнет.'
    : t.note;
  return '<div class="card quiet"><div class="col">' +
    '<b style="font-size:13px">' + esc(text) + '</b>' +
    (note ? '<span class="small">' + esc(note) + '</span>' : '') +
  '</div></div>';
}

function eventRow(e) {
  var k = KIND[e.kind];
  return '<button type="button" class="listitem' + (e.kind === 'paid' ? ' accent' : '') + '" data-event="' + e.id + '">' +
    '<span class="time"><b>' + esc(e.time) + '</b><span>' + esc(e.part) + '</span></span>' +
    '<span class="grow"><b>' + esc(e.title) + '</b>' +
    '<span class="small">ведёт ' + esc(e.master) + ' · ' + (e.seats === e.of ? e.of + ' мест' : 'осталось ' + e.seats) + '</span></span>' +
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
    '<div class="row"><b class="num">' + money(o.sum) + ' ฿</b>' +
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
  bar: 'Бар', drink: 'Напиток', barCart: 'Ваш заказ', barOrder: 'Заказ',
  barQueue: 'Заказы на баре', topup: 'Пополнить счёт', barShot: 'Съёмка напитков', barDay: 'Отчёт за день',
  barExpense: 'Затраты направления', curator: 'Направление «Бар»',
  organizer: 'Мои мероприятия', eventNew: 'Новое мероприятие',
  eventManage: 'Мероприятие', partner: 'Моё направление', serviceNew: 'Новая услуга'
};

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
  event: 'events', eventNew: 'organizer', eventManage: 'organizer',
  serviceNew: 'partner', consentFull: 'consent',
  bar: 'guest', drink: 'bar', barCart: 'bar', barOrder: 'bar', topup: 'bar',
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
  view.innerHTML = SCREENS[LIVE && !WIRED[current] ? 'soon' : current](param);

  var root = (TABS[DATA.role] || []).some(function (t) { return t[0] === current; });
  document.getElementById('back').hidden = root || bare() && current !== 'consentFull';

  var title = document.getElementById('title');
  if (current === 'home' || current === 'guest' || bare() && current !== 'consentFull') {
    title.textContent = 'Café XIII';
    title.className = 'wordmark';
  } else {
    title.textContent = TITLES[current] || 'Café XIII';
    title.className = 'wordmark plain';
  }

  var tabs = document.getElementById('tabs');
  var list = bare() ? [] : (TABS[DATA.role] || []);
  tabs.hidden = !list.length;
  document.body.classList.toggle('no-tabs', !list.length);
  tabs.innerHTML = list.map(function (t) {
    var on = t[0] === current;
    return '<button type="button" data-go="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
      svg(t[2]) + '<span>' + t[1] + '</span></button>';
  }).join('');

  tgChrome();
  window.scrollTo(0, 0);
}

function go(screen, p) {
  if (!SCREENS[screen]) return;
  if (FLASH_SHOWN) { FLASH = null; FLASH_SHOWN = false; }
  current = screen;
  param = p || null;
  if (screen === 'pass' && LIVE && !PASS && !PASS_FAIL) loadPass();
  if ((screen === 'bar' || screen === 'drink') && LIVE && MENU_STATE === '') loadMenu();
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
  if (el.hasAttribute('data-where')) { ORDER.where = el.getAttribute('data-where'); haptic(); render(); return; }
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
      CART[arg] = (CART[arg] || 0) + 1;
      haptic(); render(); return;
    }
    if (a === 'cart-less') {
      CART[arg] = (CART[arg] || 0) - 1;
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
                note: 'Сервера нет: заказ виден только в этой вкладке. В рабочем приложении бар получает уведомление в ту же секунду.' };
      go('barOrder');
      return;
    }
    if (a === 'q-making' || a === 'q-ready' || a === 'q-served') { setState(Number(arg), a.slice(2)); return; }
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
                  note: 'Гость видит это у себя в заказе. Пока сервера нет — только в этой вкладке.' };
      }
      render(); return;
    }
    if (a === 'close-shift') {
      haptic('ok');
      FLASH = { text: 'Смена закрыта',
                note: 'Правок в закрытой смене не бывает: ошибка исправляется отменой строки и новой записью. Сервера нет — отчёт никуда не ушёл.' };
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
                note: 'Сервера нет, поэтому отметка хранится только в этом браузере. В рабочем приложении её хранит клуб — вместе с датой и версией текста.' };
      go(homeOf());
      return;
    }
    if (a === 'reset-consent') { if (LIVE) return; dropConsent(); go('consent'); return; }
    if (a === 'retry') { boot(); return; }
    if (a === 'retry-pass') { loadPass(); render(); return; }

    if (a === 'scan') { scanPass(); return; }
    if (a === 'phone') { askPhone(); return; }
    if (a === 'book')  { haptic('ok'); FLASH = 'Вы записаны'; go('bookings'); return; }
  }
}

/* Съёмка напитка и фото чека. Отправить снимок пока некуда — сервера нет;
   честный ответ лучше вида работающей отправки. */
document.addEventListener('change', function (ev) {
  var t = ev.target;
  if (!t || (t.id !== 'shot-file' && t.id !== 'bill-file')) return;
  var f = t.files && t.files[0];
  if (!f) return;
  haptic('ok');
  FLASH = { text: (t.id === 'shot-file' ? 'Снято: ' : 'Чек: ') + f.name,
            note: 'Сервера нет, отправить некуда — снимок остался в телефоне. С сервером он уйдёт в клуб: по съёмке ИИ-команда собирает карточку меню, по чеку — подтверждение затраты.' };
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
document.getElementById('demo-btn').addEventListener('click', function () { go('demo'); });

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
              note: 'Сервера нет — отметить вход пока некуда, код только показан.' };
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
              note: ok ? 'Сервера нет — сохранить его пока некуда.' : '' };
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
  if (current === 'eventNew') return { text: 'Опубликовать в афише', a: 'create-event' };
  if (current === 'serviceNew') return { text: 'Отправить на проверку', a: 'create-service' };
  if (current === 'barCart') return { text: 'Отправить на бар', a: 'send-order' };
  if (current === 'barExpense') return { text: 'Записать затрату', a: 'add-expense' };
  if (current === 'drink' && LIVE) {
    var dl = findDrink(param);
    if (!dl || BUSY || !BAR || !BAR.open || DATA.member.balance < dl.price) return null;   // кнопка на экране объяснит почему
    return { text: 'Купить за ' + money(dl.price) + ' ฿', a: 'buy:' + param };
  }
  if (current === 'drink' && !CART[param]) return { text: 'Добавить в заказ', a: 'cart-add:' + param };
  if (current === 'event') {
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
    if (BACK[current] || !(TABS[DATA.role] || []).some(function (t) { return t[0] === current; })) {
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

boot();
