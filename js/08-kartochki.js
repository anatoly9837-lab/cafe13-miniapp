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
    msDemoClear();
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
  // Слово владельца 29.10.2026 (Cafe13KPG#496): «давай уберем все, что не является правдой. Но можем
  // что-то не договаривать, мы же делаем в том числе маркетинг»; на вопрос, дописать ли «исправить,
  // забрать копию, отозвать согласие — просьбой работнику», — «оставляем маркетинг без лжи». Замер api:
  // `GET /me` отдаёт ЧАСТЬ записанного («всё» было неправдой), ручек правки, выгрузки, удаления себя и
  // отзыва согласия нет — снято вместе со сроком «до 30 дней», который относился к этим просьбам.
  ['Ваши права',
   ['Посмотреть, что о вас записано.']],
  ['Как согласие фиксируется',
   // «и номер версии текста» снято (решение координатора по замеру api: в схеме два момента —
   // `consent_data_at`, `consent_filming_at`, `consent_version` 0 вхождений; номер живёт только в
   // памяти телефона). Карточка на то, чтобы сервер его хранил, — Cafe13KPG#530.
   ['Клуб сохранит дату и время вашего согласия. Если текст изменится по сути, клуб покажет новый и спросит снова.',
    'Версия этого текста: черновик 0.1 от 16 октября 2026 года.']]
];

var KIND = {
  paid:     { label: function (e) { return e.price + ' ฿'; }, pill: 'gold' },
  free:     { label: function () { return 'Бесплатно'; },     pill: '' },
  donation: { label: function () { return 'Донейшн'; },       pill: 'warm' }
};

