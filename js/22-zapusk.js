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
      return { text: bookWord(le), a: 'book:' + le.id };
    }
    var e = byId(param) || DATA.events[0];
    return { text: e && e.kind === 'paid' ? 'Записаться за ' + money(e.price) + ' ฿' : 'Записаться', a: 'book' };
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
    // экран входа без своей записи в BACK — без «назад» и в живом (0.1, слово владельца «видит только её»): прежде
    // у человека без членства на просьбе стояла системная «назад», ведущая через homeOf() на ту же просьбу
    if ((!noEntry() || BARE[backTo()]) && !(bare() && !BACK[current]) &&
        (BACK[current] || !tabList().some(function (t) { return t[0] === current; }))) {
      backHandler = goBack;
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
  tg.onEvent('activated', onReturn);                         // 8.0: приложение снова на экране
  var u = tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (u && u.first_name) {
    // Только для приветствия: подпись здесь не проверена, доверять нельзя.
    DATA.member.name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  }
} else {
  applyTheme();
}

boot();
