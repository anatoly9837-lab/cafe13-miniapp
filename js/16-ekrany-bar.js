/* Экран, которому меню приходит со стороны (`drink`, `barRecipe`), обязан отличать «меню ещё нет»
   от «такой позиции нет»: слово о ПРЕДМЕТЕ правдиво только при `MENU_STATE === 'ok'` (рецепты
   витрины, Cafe13KPG#269; один приём на семью — решение координатора). Своего загрузчика нет:
   читается состояние бара. Пустая строка — меню пришло, решает сам экран. */
function menuGate() {
  if (MENU_STATE === '' || MENU_STATE === 'loading')
    return '<div class="card quiet"><span class="small">Загружаем меню…</span></div>';
  if (MENU_STATE !== 'ok')
    return '<div class="card strong"><h2>Меню не загрузилось</h2><p>' + esc(MENU_STATE) + '</p>' +
      '<button type="button" class="btn" data-action="retry-menu">Повторить</button></div>';
  return '';
}
function noDrink() {
  return '<div class="card quiet"><span class="small">Такой позиции в меню нет.</span></div>' +
    '<button type="button" class="btn ghost" data-go="bar">Открыть меню</button>';
}
/* Тот же приём для своего заказа: отказ опроса — это «заказ не загрузился», а не «заказа нет»,
   и у него есть выход (рецепт `barOrder`). Прежний заказ, если он был, стоит ниже. */
/* Дверь к своему заказу на меню (шаг 23, рецепт 23/barOrder `R1`/`R2`): стоит всегда. Номер и состояние —
   из ответа сервера; «заказов нет» — только когда сервер ответил, что своих в окне нет. Пока ответа нет
   (или он отказ) — строка без подписи: дверь ведёт на `barOrder`, где видно и отказ, и «Повторить». */
/* Выдан — подтвердите получение (`R4`/`R5`) или получение подтверждено (`R6`), шаг 23. Кнопки до `served`
   нет; кто выдал, члену клуба не показывается (`served_by` сервер не отдаёт). Отказ — печатью сервера. */
function servedRow(o) {
  if (o.state !== 'served') return '';
  var at = o.servedAt ? ' в ' + esc(o.servedAt) : '';
  if (o.got) return '<span class="small" id="order-got">Получение подтверждено. Выдан' + at + '.</span>';
  return '<span class="small" id="order-served">Выдан' + at + '. Заберите и подтвердите получение.</span>' +
    (RCV.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(RCV.deny) + '</span></div>' : '') +
    '<button type="button" class="btn" data-action="order-received"' + (RCV.busy ? ' disabled' : '') + '>Подтвердить получение</button>';
}
function mineDoor() {
  var o = DATA.bar.mine;
  var sub = o ? '№' + esc(o.id) + ' · ' + OSTATE[o.state].label : MINE_NONE ? 'заказов нет' : '';
  return '<div class="card quiet"><button type="button" class="listitem" data-go="barOrder">' +
    '<span class="grow"><b>Мой заказ</b>' + (sub ? '<span class="small">' + sub + '</span>' : '') + '</span>' +
    svg(ICON.chev, 'chev') + '</button></div>';
}
function mineFail() {
  return '<div class="card quiet"><div class="col"><b>Заказ не загрузился</b>' +
    '<span class="small">' + esc(MINE_FAIL) + '</span></div>' +
    '<button type="button" class="btn" data-action="retry-mine">Повторить</button></div>';
}

Object.assign(SCREENS, {

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
            '<button type="button" class="btn" data-action="retry-menu">Повторить</button></div>'
        : !DATA.bar.menu.length
        ? '<div class="card quiet"><span class="small">В меню пока ни одной позиции.</span></div>'
        : DATA.bar.menu.map(function (g) {
            return '<div class="group"><span class="label">' + esc(g.group) + '</span>' +
              g.items.map(barRow).join('') + '</div>';
          }).join('');
      return (FLASH ? flash() : '') +
        '<div class="card strong"><div class="row top">' +
          '<div class="col"><h2 class="clamp2">' + esc(BAR ? BAR.title : '') + '</h2>' +
            '<span class="small">' + (BAR && !BAR.open
              ? 'Сейчас закрыт: смена не открыта, заказ не отправится. Меню видно и так.'
              : '«Купить» — заказ на одну позицию со счёта, подадут за стойку. Несколько позиций или другое место — через «в заказ».') + '</span></div>' +
          (BAR ? '<span class="pill' + (BAR.open ? ' on' : '') + '">' + (BAR.open ? 'открыт' : 'закрыт') + '</span>' : '') +
        '</div>' +
        '<div class="row"><span class="small">На счёте</span><b class="num">' + money(DATA.member.balance) + ' ฿</b></div></div>' +
        mineDoor() +
        (n ? '<div class="card accent"><div class="row">' +
          '<div class="col"><b>В заказе ' + n + ' ' + plural(n, ['позиция', 'позиции', 'позиций']) + '</b>' +
            '<span class="small num">на ' + money(cartSum()) + ' ฿</span></div>' +
          '<button type="button" class="btn quiet" data-go="barCart">Оформить</button>' +
        '</div></div>' : '') +
        body;
    }
    return (FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top">' +
        '<div class="col"><h2 class="clamp2">' + esc(DATA.bar.title) + '</h2>' +
          '<span class="small">' + (DATA.bar.open
            // часов в демо нет (слово владельца 24.11.2026, Cafe13KPG#999 №9): постоянная обещала бы то, чего демо не знает
            ? 'Заказ уходит на бар сразу и оплачивается со счёта в клубе.'
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
    var d = findDrink(id) || (LIVE ? null : drinks()[0]);
    if (LIVE && !d) return menuGate() || noDrink();
    var n = CART[d.id] || 0;
    if (LIVE) {
      return (FLASH ? flash() : '') + tile(d, true) +
        '<div class="group"><h1 class="clamp2">' + esc(d.title) + '</h1><p>' + esc(d.full || d.about) + '</p></div>' +
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
      (d ? '<div class="col"><h1 class="clamp2">' + esc(d.title) + '</h1>' +
             '<span class="small">' + esc(d.full || d.about || '') + '</span></div>'
         : (LIVE && menuGate()) || noDrink()) +
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
            '<div class="col"><b class="clamp1">' + esc(x.title) + '</b>' +
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
              (DENY_CODE === 'insufficient_funds' ? '<button type="button" class="btn quiet" data-go="topup">Пополнить счёт</button>' : '') : '') +
      '<div class="sum"><span class="small">Итого</span><b class="big num">' + money(cartSum()) + ' ฿</b></div>' +
      '<button type="button" class="btn dup-main" data-action="send-order"' + (BUSY ? ' disabled' : '') + '>' + (BUSY ? 'Отправляем…' : 'Купить') + '</button>';
  },

  barOrder: function () {
    var o = DATA.bar.mine;
    if (LIVE && !o) {
      return (FLASH ? flash() : '') +
        (MINE_FAIL ? mineFail()
                   : '<div class="card quiet"><span class="small">За сегодня и вчера заказов нет.</span></div>') +
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
        servedRow(o) +
        '<div class="group"><h2>Что заказано</h2><div class="rows">' + o.items.map(function (i) {
          return '<div><span class="clamp1">' + esc(i[0]) + '</span><span class="small num">' + i[1] + ' шт</span></div>';
        }).join('') + '</div></div>' +
        (MINE_FAIL ? mineFail() : '') +
        '<button type="button" class="btn ghost" data-go="bar">Вернуться в меню</button>';
    }
    var line = ['new', 'making', 'ready', 'served'];
    var at = line.indexOf(o.state);
    var steps = [
      ['Отправлен на бар', o.at],
      ['Бар принял', 'видно, когда работник нажмёт «Принять»'],
      ['Готовится', 'обычно 3–5 минут'],
      ['Готов', o.where === 'за стойку' ? 'забирайте у стойки' : 'подадут ' + o.where],
      ['Выдан', 'заказ у вас в руках; подтвердите получение']
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
  /* Пополнение — ТОЛЬКО заявкой (слово владельца 30.10.2026: «Не должен человек вносить себе на счёт. Все
     пополнения — только заявка → пополнение»; «Пополнение возможно через заявку. Других путей нет», Cafe13KPG#677).
     Прямое внесение себе работником с правом кассы (`POST /till` со своим id) снято: у него тот же путь заявки,
     что у всех. ⚠ Сервер этот путь НЕ запрещает — `POST /till kind=topup` кассир по-прежнему может звать со своим
     id; запрет клиентский, серверная половина — решение координатора (касса за шагом 4). */
  topup: function () {
    // Пополнение члена клуба (Cafe13KPG#500): ПЕРЕПИСАННАЯ ветка этого же экрана, а не новый; кадры E52*
    return (FLASH ? flash() : '') + topupMember() +
      // «Вернуться в меню» — только у «чужими глазами» (E52d); у остальных выход — «назад» оболочки
      (TEST.on && TEST.as ? '<button type="button" class="btn ghost" data-go="home">Вернуться в меню</button>' : '');
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
        // смена — того бизнеса, чья очередь на экране: BAR бывает выбранным на «Услугах» чужим (шаг 22, queueDir)
        (BAR && BAR.id === queueDir() ? shiftBlock() : '<div class="card strong"><h2>Заказы на баре</h2></div>') +
        (canBook() ? '<div class="row" style="gap:8px"><button type="button" class="btn ghost" data-go="barMoney">Доход и расход</button>' +
                     '<button type="button" class="btn ghost" data-go="barDay">Отчёт за день</button></div>' : '') +
        // Вход в карточки — здесь, а не только в «Клубе»: «Клуб» приходит вкладкой лишь
        // при живом членстве, а «Заказы» работник бара видит всегда (barSide). Кадр E41,
        // Cafe13KPG#396. Строка та же, что в группе «Работа» на home.
        (mayCards() && !workerOnly() ? '<div class="group"><span class="label">Работа</span>' +
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
        // шаг 22, слово Q6 рецепта 22/barQueue: письмо уходит каждому работнику и может не дойти (Telegram отказывает молча)
        '<span>Новые заказы появляются на этом экране сами. Бот, если Telegram ему позволяет, ещё и пишет о них работникам направления. Принять, отметить готовым и выданным — кнопками здесь.</span>' +
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
    // отказ права — своими словами, без печати: до сервера дело не дошло. Работник назван (шаг 15, `ROLE_NAME.worker`)
    if (LIVE && !mayCards()) return '<div class="card quiet"><span class="small">Карточки меню заводит бар, работник бизнеса, партнёр направления или его куратор.</span></div>';
    if (CARDS.lost) return '<div class="card quiet"><span class="small">Бизнес не нашёлся: роль работника есть, направления по ней нет.</span></div>';
    if (!CARDS.list) return CARDS.fail
      ? '<div class="card quiet"><span class="verbatim">' + esc(CARDS.fail) + '</span></div>' +
        '<button type="button" class="btn ghost" data-action="c-reload">Повторить</button>'
      : '<div class="card quiet"><span class="small">Загружаем карточки…</span></div>';
    var L = CARDS.list;
    // черновики и возвраты — ВСЕ по бизнесу, без фильтра по автору: «бар — общая кухня» (bar.products, api)
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
      // название — словом сервера (`GET /directions`), а не литералом: бизнес работника «Баром» не зовётся (шаг 15)
      (CARDS.dir ? '<div class="card quiet"><span class="small">Бизнес «' + esc(CARDS.dir.title) + '»</span></div>' : '') +
      parts.filter(function (x) { return x[1].length; }).map(function (x) {
        return '<div class="group" data-cards="' + esc(x[0]) + '"><span class="label">' + esc(x[0]) + ' · ' + x[1].length + '</span>' +
          x[1].map(cardRow).join('') + '</div>';
      }).join('') +
      (L.length ? '' : '<div class="card quiet"><span class="small">Карточек пока нет — ни в меню, ни в работе.</span></div>') +
      '<button type="button" class="btn ghost dup-main" data-action="c-new">Новая карточка</button>';
  },

  barCard: function (id) {
    if (LIVE && !mayCards()) return '<div class="card quiet"><span class="small">Карточки меню заводит бар, работник бизнеса, партнёр направления или его куратор.</span></div>';
    var lock = CARD.busy ? ' disabled' : '';
    // отказ сервера — печатью (`.verbatim`): клиент его не пересказывает
    var deny = CARD.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span class="verbatim">' + esc(CARD.deny) + '</span></div>' : '';
    var note = CARD.note ? '<div class="note" role="status">' + svg(ICON.info) + '<span>' + esc(CARD.note) + '</span></div>' : '';
    // ФОРМА — два вида одним телом: заведение (`new`) и правка черновика (шаг 15, `PATCH /bar/products/{id}`)
    var form = function (act, word) {
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
        '<button type="button" class="btn dup-main" data-action="' + act + '"' + lock + '>' + (CARD.busy ? 'Сохраняем…' : word) + '</button>' +
        // с ручкой правки «поля потом не исправить» стало бы ложью (шаг 15); партнёр полей не правит даже у своего черновика (PATCH 403, шаг 17)
        (cardPartnerOnly() ? '<span class="small">Поля сохранённого черновика правит тот, кто ведёт карточки бизнеса, — проверьте их до сохранения. Рецепт замените в любой момент.</span>'
          : '<span class="small">Пока карточка в работе, поля можно исправить. Утверждённую не правит никто — с меню её снимает тот, кто утверждает карточки бизнеса.</span>') +
      '</div>';
    };
    if (id === 'new') return form('c-save', 'Сохранить черновик');
    if (CARDS.lost) return '<div class="card quiet"><span class="small">Бизнес не нашёлся: роль работника есть, направления по ней нет.</span></div>';
    if (!CARDS.list) return CARDS.fail ? '<div class="card quiet"><span class="verbatim">' + esc(CARDS.fail) + '</span></div>'
                                       : '<div class="card quiet"><span class="small">Загружаем карточку…</span></div>';
    var c = cardBy(id);
    if (!c) return '<div class="card quiet"><span class="small">Карточки нет в списке направления.</span></div>';
    // правит ТОЛЬКО черновик: сменилось состояние, пока форма была открыта, — формы больше нет
    if (CARD.edit === c.id && c.state === 'draft') return form('c-edit-save:' + c.id, 'Сохранить изменения');
    var cur = cardCurator(), has = c.recipes.indexOf(CARD.lang) !== -1;
    // работник ведёт карточку, пока она черновик: вне его сервер не отдаёт даже ЧТЕНИЯ рецепта (403) — группы нет вовсе
    // партнёр: правки полей и «на утверждение» нет (403), рецепт — в любом состоянии (шаг 17, put_recipe)
    var po = cardPartnerOnly(), wo = cardWorkerOnly() && !po, recipe = po || !wo || c.state === 'draft';
    if (has && recipe) recipeLoad(c.id, CARD.lang);     // заменяя рецепт, человек видит прежний
    var back = cardReturned(c);
    var STATE_WORDS = { draft: back ? 'Возвращена' : 'Черновик', review: 'Ждёт утверждения', active: 'В меню', hidden: back ? 'Возвращена' : 'Снята' };
    var langs = '<div class="seg">' + CARD_LANGS.map(function (l) {
      return '<button type="button" data-action="c-lang:' + l[0] + '"' + (CARD.lang === l[0] ? ' aria-pressed="true"' : '') + lock + '>' +
        l[1] + (c.recipes.indexOf(l[0]) !== -1 ? ' ·' : '') + '</button>';
    }).join('') + '</div>';
    var text = CARD.text[CARD.lang] !== undefined ? CARD.text[CARD.lang] : '';
    var waiting = has && CARD.body[CARD.lang] === null;
    var acts = '';
    // из `hidden` на проверку возвращает только барная сторона: работнику сервер ответит 403 (prava-rabotnika.md)
    if (!po && (c.state === 'draft' || (c.state === 'hidden' && !wo)))
      acts += '<button type="button" class="btn" data-action="c-review:' + c.id + '"' + lock + '>Отправить на утверждение</button>';
    // шаг 17: свой черновик партнёр ставит в меню сам; без рецепта — погашена (знание из списка), отказ базы — печатью
    if (po && c.state === 'draft')
      acts += (c.recipes.length ? '' : '<span class="small">Сначала рецепт — без него позиция не попадёт в меню.</span>') +
        '<button type="button" class="btn' + (c.recipes.length ? '" data-action="c-approve:' + c.id + '"' + lock : ' ghost" disabled') + '>В меню</button>';
    // половина куратора — шаг 16; работнику её режет cardCurator() (права куратора на этом направлении у него нет)
    if (cur && c.state === 'review') {
      acts += c.recipes.length
        ? '<button type="button" class="btn" data-action="c-approve:' + c.id + '"' + lock + '>Утвердить — в меню</button>'
        // запрет верный, вес — нет: недоступное не тяжелее единственного доступного (designer-55)
        : '<span class="small">Сначала рецепт — без него позиция не попадёт в меню.</span><button type="button" class="btn ghost" disabled>Утвердить — в меню</button>';
      acts += CARD.back
        ? '<div class="field"><label for="c-reason">Почему возвращаете</label><input id="c-reason" type="text" maxlength="500" value="' + esc(CARD.reason) + '" placeholder="Например: нет фото, цена выше соседних"' + lock + '></div>' +
          '<div class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="c-back-keep"' + lock + '>Не возвращать</button>' +
          // шаг 16: без замечания «Вернуть» погашена; истории замечаний на сервере нет — прежнее затирается (рецепт 16/barCard)
          '<button type="button" class="btn quiet" data-action="c-back-send:' + c.id + '"' + (CARD.busy || !CARD.reason.trim() ? ' disabled' : '') + '>Вернуть</button></div>' +
          // обе подписи в разметке, видна одна: на вводе их переключает cardReasonSync без перерисовки (фокус в поле)
          '<span class="small" id="c-reason-why"' + (CARD.reason.trim() ? ' hidden' : '') + '>Без замечания не вернуть — автор не узнает, что исправить.</span>' +
          '<span class="small" id="c-reason-last"' + (CARD.reason.trim() ? '' : ' hidden') + '>Автор увидит только последнее замечание — прежнее затрётся.</span>'
        : '<button type="button" class="btn quiet" data-action="c-back">Вернуть с причиной</button>';
    }
    if (cur && c.state === 'active')
      acts += CARD.hideAsk
        ? '<span class="small">Гости перестанут видеть позицию в меню сразу.</span><div class="row" style="gap:6px">' +
          '<button type="button" class="btn quiet" data-action="c-hide-keep"' + lock + '>Оставить</button>' +
          '<button type="button" class="btn quiet" data-action="c-hide:' + c.id + '"' + lock + '>Точно снять</button></div>'
        : '<button type="button" class="btn quiet" data-action="c-hide-ask">Снять с меню</button>';
    // шаг 18: снятую возвращает в меню тот, кто утверждает (партнёр — set_product_state, bar.py:514); без рецепта — погашена, отказ базы — печатью
    if (cur && c.state === 'hidden')
      acts += c.recipes.length
        ? '<button type="button" class="btn" data-action="c-approve:' + c.id + '"' + lock + '>Вернуть в меню</button>'
        : '<span class="small">Сначала рецепт — без него позиция не попадёт в меню.</span><button type="button" class="btn ghost" disabled>Вернуть в меню</button>';
    if (!acts && c.state === 'review') acts = '<span class="small">Ждёт решения того, кто утверждает карточки бизнеса.</span>';
    // вне черновика у работника — одна строка на состояние: КТО может и чего ждать, а не общее «Действий нет.»
    if (!acts && wo && c.state === 'active') acts = '<span class="small">В меню. Рецепт ведёт бар или тот, кто её утверждает, с меню снимает тот, кто утверждает карточки бизнеса.</span>';
    if (!acts && wo && c.state === 'hidden') acts = '<span class="small">Снята с меню. Вернуть её в работу может тот, кто утверждает карточки бизнеса.</span>';
    return (!LIVE && FLASH ? flash() : '') +
      '<div class="card strong"><div class="row top"><div class="col"><h2 class="clamp2">' + esc(c.title) + '</h2>' +
        '<span class="small">' + esc(c.group) + ' · ' + money(c.price) + ' ฿' + (c.mins ? ' · ' + c.mins + ' мин' : '') + (c.alcohol ? ' · алкоголь' : '') + '</span></div>' +
        '<span class="pill' + (c.state === 'active' ? ' on' : back ? ' warm' : '') + '">' + esc(STATE_WORDS[c.state]) + '</span></div>' +
        (c.about ? '<span class="small clamp2">' + esc(c.about) + '</span>' : '') +
        (back ? '<div class="note">' + svg(ICON.info) + '<span>Вернул куратор: ' + esc(c.note) + '</span></div>' : '') +
        // правка — только у черновика; у прочих двери нет и слов об этом нет: отсутствие двери не объясняют
        (c.state === 'draft' && !po ? '<button type="button" class="btn ghost" data-action="c-edit:' + c.id + '"' + lock + '>Изменить карточку</button>' : '') +
      '</div>' + note + photoBlock(c) +
      (recipe ? '<div class="group"><span class="label">Рецепт</span>' + langs +
        '<div class="field"><label for="c-recipe">Рецепт (' + CARD.lang.toUpperCase() + ')' + (has ? '' : ' — пока нет') + '</label>' +
          '<textarea id="c-recipe" rows="6"' + (waiting ? ' disabled' : lock) + '>' + esc(text) + '</textarea></div>' +
        (CARD.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(CARD.err) + '</span></div>' : '') +
        '<span class="small">Рецепт видит только бар, гость — нет.</span>' +
        '<button type="button" class="btn ghost" data-action="c-recipe:' + c.id + '"' + (waiting ? ' disabled' : lock) + '>' +
          (has ? 'Заменить рецепт (' : 'Сохранить рецепт (') + CARD.lang.toUpperCase() + ')</button>' +
      '</div>' : '') +
      '<div class="group"><span class="label">Решение</span>' + deny + (acts || '<span class="small">Действий нет.</span>') + '</div>';
  },
});
