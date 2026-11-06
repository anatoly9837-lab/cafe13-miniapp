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

/* Слово сервера — `detail` строкой, и только оно. Фраза кода ответа по стандарту HTTP («Not Found»
   на 404, «Method Not Allowed» на 405) словом сервера НЕ является: её подставляет сам FastAPI/
   Starlette, когда ручки нет или метод не тот, — сервер клуба так не отвечает нигде (ast-проход по
   боевой a1984f2: 178 HTTPException, без detail 0, с фразой своего кода 0; Cafe13KPG#649). Печатать
   её — сказать человеку по-английски о причине, которой нет; такой ответ идёт в failText («кодом N»).
   ⚠ Перечень — ВПИСАННЫЙ, и это законно: фразы задаёт внешний стандарт (RFC 9110, таблица
   http.HTTPStatus), а не наше состояние, поэтому он не стареет молча, как перечни экранов. Обходным
   признаком («латиница», «короче N») его НЕ заменять: тот погасит законный отказ. Где стандарт фразу
   переименовал (RFC 7231 → 9110), стоят обе: какую напечатает сервер, решает версия его Python. */
var HTTP_PHRASE = {
  400: ['Bad Request'], 401: ['Unauthorized'], 402: ['Payment Required'], 403: ['Forbidden'],
  404: ['Not Found'], 405: ['Method Not Allowed'], 406: ['Not Acceptable'],
  407: ['Proxy Authentication Required'], 408: ['Request Timeout'], 409: ['Conflict'], 410: ['Gone'],
  411: ['Length Required'], 412: ['Precondition Failed'],
  413: ['Content Too Large', 'Request Entity Too Large'], 414: ['URI Too Long', 'Request-URI Too Long'],
  415: ['Unsupported Media Type'], 416: ['Range Not Satisfiable', 'Requested Range Not Satisfiable'],
  417: ['Expectation Failed'], 418: ["I'm a Teapot"], 421: ['Misdirected Request'],
  422: ['Unprocessable Content', 'Unprocessable Entity'], 423: ['Locked'], 424: ['Failed Dependency'],
  425: ['Too Early'], 426: ['Upgrade Required'], 428: ['Precondition Required'], 429: ['Too Many Requests'],
  431: ['Request Header Fields Too Large'], 451: ['Unavailable For Legal Reasons'],
  500: ['Internal Server Error'], 501: ['Not Implemented'], 502: ['Bad Gateway'], 503: ['Service Unavailable'],
  504: ['Gateway Timeout'], 505: ['HTTP Version Not Supported'], 506: ['Variant Also Negotiates'],
  507: ['Insufficient Storage'], 508: ['Loop Detected'], 510: ['Not Extended'], 511: ['Network Authentication Required']
};
function detailOf(r) {
  var d = r && r.data && typeof r.data.detail === 'string' ? r.data.detail : '';
  var stock = (HTTP_PHRASE[r && r.status] || []).map(function (s) { return s.toLowerCase(); });
  return d && stock.indexOf(d.trim().replace(/\.$/, '').toLowerCase()) !== -1 ? '' : d;
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
      if (current === 'bar' || current === 'drink' || current === 'barRecipe') render();
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
    var detail = detailOf(r);
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

/* Ветка члена клуба на экране пополнения — кадры E52 (пути), E52b (форма «Онлайн»),
   E52v/E52g (история), E52d (чужими глазами); Cafe13KPG#509, голова 73e7457.
   Состояние экрана одно из трёх: пути → форма или история. Слова — с кадров;
   статус и причина отказа — слова сервера (status_ru, decision_note), как пришли. */
// «отменено» — тихий цвет, НЕ цвет отказа: у отказа денег не было вовсе, у отмены они пришли и ушли; судьбу
// денег говорит подстрочник (кадр E52v, designer-55, Cafe13KPG#591)
var TUP_ST = { pending: 'wait', approved: 'ok', rejected: 'no', cancelled: 'off' };
function topupMember() {
  // чужими глазами деньги не вносятся: сервер откажет 403 (_not_acting), экран говорит это сразу (E52d)
  if (TEST.on && TEST.as) return '<div class="card quiet"><span class="small">Чужими глазами пополнение недоступно: деньги вносит только сам человек.</span></div>';
  if (!LIVE && TUP.mine === null) TUP.mine = [];      // демонстрация к серверу не ходит: истории нет
  var bal = '<div class="card strong"><span class="label">На счёте</span>' +
    '<span class="big num">' + money(DATA.member.balance) + ' ฿</span></div>';
  if (TUP.online) {
    var amt = tupAmount(TUP.amount), f = TUP.file, img = JOIN.img.promptpay;
    return '<div class="field"><label for="tu-amount">Сколько пополнить, ฿</label>' +
        '<input id="tu-amount" type="text" inputmode="decimal" value="' + esc(TUP.amount) + '"' + (TUP.busy ? ' disabled' : '') + '>' +
        // порог держит СЕРВЕР (MIN_AMOUNT, отказ «пополнение от 500 ฿»); клиент только говорит его заранее,
        // своего запрета не ставит — слово владельца «порог на сервере», слова кадра E52b (Cafe13KPG#574, #579)
        '<span class="small">от 500 ฿</span></div>' +
      // реквизиты — картинка сервера по подписи (кадр места не рисует: «не знает чужих счетов»)
      '<div class="card quiet"><span class="label">Куда перевести</span>' +
        (img === 'fail' ? '<div class="row"><span class="small">Реквизиты не загрузились</span>' +
            '<button type="button" class="btn quiet mini" data-action="join-req-retry">Повторить</button></div>'
         : img && img !== 'loading' ? '<div class="qr"><div><div class="place img"><img src="' + esc(img) + '" alt="Реквизиты PromptPay"></div></div></div>'
         : '<span class="small">Загружаем реквизиты…</span>') + '</div>' +
      '<div class="field"><label for="tu-file">Чек</label>' +
        '<label class="box dashed" for="tu-file">' + svg(f ? ICON.check : ICON.cam) + '<span>' +
          (f ? 'Чек приложен · заменить' : 'Приложить чек') + '</span>' +
          '<input id="tu-file" type="file" accept="' + RECEIPT_TYPES.join(',') + '" hidden></label>' +
        // до чека — предел СЛОВАМИ кадра E52b (#579): иначе о нём узнают отказом 413 после выбора файла
        '<span class="small">' + (f ? (f.pdf ? 'PDF' : 'Фото') + ' · ' + money(Math.max(1, Math.round(f.size / 1024))) + ' КБ'
          : 'снимок или PDF, до 2 МиБ') + '</span></div>' +
      (TUP.fileErr ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TUP.fileErr) + '</span></div>' : '') +
      (TUP.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TUP.err) + '</span></div>' : '') +
      '<button type="button" class="btn" id="tu-send" data-action="tu-send"' + (amt === null || !f || TUP.busy || img === 'fail' ? ' disabled' : '') + '>' +
        (TUP.busy ? '…' : 'Отправить на проверку') + '</button>' +
      '<div class="note">' + svg(ICON.info) + '<span>Деньги появятся на счёте, когда пополнение подтвердят. Обычно это занимает время, а не секунду.</span></div>';
  }
  if (TUP.hist) {
    var mine = TUP.mine || [];
    return bal + (TUP.fail ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TUP.fail) + '</span></div>' +
          '<button type="button" class="btn ghost" data-action="tu-retry">Повторить</button>'
       : TUP.mine === null ? '<div class="card quiet"><span class="small">Загружаем…</span></div>'
       : !mine.length ? '<div class="card quiet"><span class="small">Пополнений ещё не было.</span></div>'
       : mine.map(function (q) {
           return '<div class="card quiet hist"><div class="row"><div class="col"><b>' + money(q.amount) + ' ฿</b>' +
               '<span class="small">' + esc([q.when, q.from].filter(Boolean).join(' · ')) + '</span></div><span class="st ' + TUP_ST[q.status] + '">' + esc(q.word) + '</span></div>' +
             (q.status === 'rejected' && q.note ? '<span class="small">' + esc(q.note) + '</span>'
               : q.status === 'cancelled' ? '<span class="small">Зачисление отменено, деньги списаны обратно</span>' : '') + '</div>';
         }).join(''));
  }
  var way = function (name, sub, on) {
    return on ? '<button type="button" class="way" data-action="tu-online"><span class="col"><b>' + name + '</b>' +
        '<span class="small">' + sub + '</span></span>' + svg(ICON.chev, 'chev') + '</button>'
      : '<div class="way off"><span class="col"><b>' + name + '</b><span class="small">' + sub + '</span></span></div>';
  };
  return bal + way('Онлайн', 'перевод по реквизитам клуба, с чеком', true) +
    // касса (POST /till вид topup) в живом заморожена (Cafe13KPG#513, весь till* во FROZEN): путь не
    // обещается — подпись по состоянию, слова designer-55; строка серая в обоих (слово владельца, #501)
    way('Касса', closed('tillTopup') ? 'появится позже' : 'в кассе клуба', false) + way('USDT', 'пока только баты', false) +
    '<button type="button" class="btn ghost" data-action="tu-hist">История пополнений</button>';
}

/* Пополнение переводом (Cafe13KPG#500, ручки #503, бой d1fa661). Путь — как у
   просьбы о вступлении: реквизиты PromptPay → человек переводит сам → чек →
   заявка; решает держатель ответственности «пополнения», согласие кладёт
   РОВНО сумму заявки на счёт. Только баты (слово владельца). Своя история —
   GET /topup/requests/mine, ключ `history` (Cafe13KPG#582, бой api 6b797fc):
   КНИГА плюс заявки без строки книги — взнос за вступление и касса заявок не
   имеют, и по одним заявкам (`requests`, прежний ключ) история у только что
   вступившего пуста. Источник — подпись сервера `source_ru`; на `source` не
   ветвимся (предел сервера: чужой путь способом кассы подписан «касса»).
   Причина отказа — слово сервера (по умолчанию владельца: «Мы не получили
   деньги»). TUP.online — форма, hist — история (оба выключены — пути);
   mine — история (null — не загружена). */
var TUP_STATES = { pending: 1, approved: 1, rejected: 1, cancelled: 1 };
var TUP = { online: false, amount: '', file: null, fileErr: '', busy: false, err: '',
            mine: null, fail: '', gen: 0, hist: false };
function fromTopups(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.history)) return null;
  var out = [];
  for (var i = 0; i < d.history.length; i++) {
    var q = d.history[i], amt = q && num(q.amount);
    // строка — либо книги (ledger_id), либо заявки без книги (request_id): хоть один номер обязан быть
    if (!q || (typeof q.ledger_id !== 'number' && typeof q.request_id !== 'number') || !TUP_STATES[q.status] ||
        !(amt > 0) || typeof q.status_ru !== 'string' || typeof q.source_ru !== 'string') return null;
    // hint сервер больше не отдаёт (api#87, слово владельца) — не читаем; note книги члену не отдаётся вовсе
    out.push({ status: q.status, word: q.status_ru, amount: amt, from: q.source_ru,
               when: askedWhen(q.at, true),
               note: typeof q.decision_note === 'string' ? q.decision_note.trim() : '' });
  }
  return out;
}
function loadTopups() {
  var gen = ++TUP.gen;
  TUP.fail = '';
  api('GET', '/topup/requests/mine').then(function (r) {
    if (gen !== TUP.gen) return;
    var got = r.status === 200 ? fromTopups(r.data) : null;
    if (got) TUP.mine = got;
    else { TUP.mine = null; TUP.fail = r.status === 200 ? failText(r) : denyText(r); }
    if (current === 'topup') render();
  });
}
// сумма — целые баты или с копейками через точку/запятую; иначе null
function tupAmount(v) {
  var t = String(v || '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  var n = Number(t);
  return n > 0 ? n : null;
}
function sendTopup() {
  var amt = tupAmount(TUP.amount);
  if (TUP.busy || !TUP.file || amt === null) return;
  TUP.busy = true; TUP.err = ''; render();
  api('POST', '/topup/request', { amount: amt.toFixed(2), receipt_mime: TUP.file.mime,
                                  receipt_base64: TUP.file.b64 }).then(function (r) {
    TUP.busy = false;
    if (r.status === 201 && r.data && typeof r.data.id === 'number') {
      // «ждёт проверки» рисует перечитанная история, а не наша догадка
      TUP.file = null; TUP.amount = ''; TUP.online = false; TUP.hist = true;
    } else TUP.err = denyText(r);
    loadTopups();
    if (current === 'topup') render();
  });
}
var TILL = ['admin', 'head', 'director', 'staff'];

function canTopup() {
  return LIVE && TILL.some(function (r) { return grant(r); });
}
function topupAmount(v) {
  var t = String(v || '').trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) && Number(t) > 0 ? Number(t) : null;
}

