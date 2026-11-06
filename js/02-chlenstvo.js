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
    out.push({ code: t.code, name: t.name, about: typeof t.about === 'string' ? t.about.trim() : '', price: price, months: t.period_months });
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
             file: null, fileErr: '', busy: false, err: '', again: false, seen: {} };

/* ВРЕМЕННАЯ ЗАГЛУШКА петли (Cafe13KPG#853, 0.1 «Путь мастера»). На этом экране человек, которого сервер в клуб не
   пускает (/me 403) или пускает без живого членства. GET /join отдаёт его ПОСЛЕДНЮЮ просьбу без проверки допуска:
   исключённому и тому, у кого членство кончилось, — давно согласованную. Экран рисовал «Вас приняли… Осталось войти»,
   «Войти» перечитывало /me и возвращало сюда же — выхода нет, а слова ложные. Согласию верим, только если ЭТУ
   просьбу видели ждущей в этом же запуске: тогда ответ пришёл, пока человек ждал, и вход его впустит. Иначе
   согласие — прошлое, и человек видит форму новой просьбы. Снять, когда сервер перестанет отдавать такую просьбу. */
function joinTrust(got) {
  var q = got && got.request;
  if (q && q.status === 'pending') JOIN.seen[q.id] = 1;
  if (q && q.status === 'approved' && !JOIN.seen[q.id]) got.request = null;
  return got;
}

// при КАЖДОМ входе на экран: ссылка «О клубе» живёт час, и с прошлого входа она могла умереть
function loadJoin() {
  var gen = ++JOIN.gen;
  JOIN.fail = '';
  api('GET', '/join').then(function (r) {
    if (gen !== JOIN.gen) return;
    var got = r.status === 200 ? joinTrust(fromJoin(r.data)) : null;
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
    // те же реквизиты показывает и пополнение (Cafe13KPG#500: «как оплата членства»)
    if (current === 'noAccess' || current === 'topup') render();
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
// чек в форму: box — состояние формы (JOIN — просьба о вступлении, TUP — пополнение), screen — её экран
function attachReceipt(file, box, screen) {
  box.fileErr = ''; box.err = '';
  if (RECEIPT_TYPES.indexOf(file.type) === -1) {
    box.file = null; box.fileErr = 'Чек — фото или PDF. Выберите другой файл.'; render(); return;
  }
  var pdf = file.type === 'application/pdf';
  (pdf ? Promise.resolve(file) : shrink(file)).then(function (b) {
    if (b.size > RECEIPT_MAX) throw new Error('big');
    return readAsB64(b).then(function (s) {
      box.file = { mime: pdf ? 'application/pdf' : 'image/jpeg', b64: s, size: b.size, pdf: pdf };
    });
  }).catch(function (e) {
    box.file = null;
    box.fileErr = e && e.message === 'big' ? 'Чек больше 2 МБ — приложите файл поменьше.' : 'Чек не прочитался — приложите его снова.';
  }).then(function () {
    if (current === screen) render();
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
    var got = r.status === 200 ? joinTrust(fromJoin(r.data)) : null;
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
              topupQueue: 1, topupReq: 1,
              // шаг 3 (v109): мастера на ручках сервера — бой `bbf09f8`, миграция 020 накачена
              masters: 1, masterReqs: 1, masterReq: 1, masterEvents: 1, masterEvent: 1, masterList: 1, masterApply: 1, masterRenew: 1,
              // шаг 4 (слово владельца 30.10.2026, Cafe13KPG#670): афиша доступна всем — из FROZEN обратно сюда
              events: 1, event: 1,
              // шаг 4, пункт третий — «Свои ивенты» мастеру и правка недели (кадры E55k/E55l, ручка `POST /events/{id}/edit`)
              organizer: 1, eventEdit: 1,
              // шаг 7, часть А (Cafe13KPG#755, решение координатора 02.11.2026 по слову владельца в #510 «как дойдём до этих
              // вкладок — посмотрим и настроим»): «Записи» — дверь к благодарности за прошедшее; экран «Поблагодарить мастера» (E65)
              bookings: 1, thanks: 1,
              // шаг 11 (Cafe13KPG#857): «Распределить деньги» арт-директора — на ручках cafe13-api#136
              payouts: 1, payout: 1,
              // шаг 12 (Cafe13KPG#877): «Бизнесы клуба» операционного директора — на `GET /directions` с партнёром (cafe13-api#876)
              businesses: 1,
              // шаг 13 (Cafe13KPG#889): заявка в партнёры — на ручках cafe13-api#143; рецепт cafe13-miniapp#257
              partnerApply: 1, partnerReqs: 1, partnerReq: 1,
              loading: 1, noSign: 1, noAccess: 1, apiDown: 1, joinAbout: 1 };
/* Заморожено словом владельца 29.10.2026 (Cafe13KPG#510): «есть 2 роли, с которыми мы работаем —
   член клуба и я… все экраны кроме тех, с которыми мы работаем, сделать серыми и заблокировать у
   всех»; «не удаляем — делаем временно недоступным». Экраны ниже были в `WIRED` и стоят на данных
   сервера; вернуть экран — перенести строку обратно в `WIRED`. Код, кадры и серверные ручки не
   тронуты. Только в живом режиме, как и сам `WIRED`: демонстрация и опись показывают всё. */
var FROZEN = { guest: 1, eventNew: 1,
               bar: 1, drink: 1, barCart: 1, barOrder: 1, barRecipe: 1, barQueue: 1, barMoney: 1, barDay: 1,
               barCards: 1, barCard: 1, staff: 1, tillPerson: 1, tillMembership: 1, tillTopup: 1, tillDay: 1 };
function frozen(screen) { return LIVE && !!FROZEN[screen]; }
// куда в живом режиме не войти: замороженное И никогда не подключённое («Моё дело» партнёра, членство) —
// по слову владельца серым гаснет всё, кроме двух ролей, а не только то, что было включено
function closed(screen) { return LIVE && (!!FROZEN[screen] || (!WIRED[screen] && !PROTO[screen])); }
/* ПРОТОТИП — третье состояние экрана, кроме «подключено» и «закрыто» (Cafe13KPG#605: показ раньше
   проверки; решение координатора 29.10.2026). Экраны шага 3 — арт-директор и мастера (кадры E55*) —
   стоят на примерных данных из кадров, потому что серверных ручек под ними ещё нет. Владелец обязан
   отличить такой экран от настоящего глазом, поэтому:
     • над экраном НЕСНИМАЕМАЯ плашка (render), снять её нечем, кроме переноса экрана в WIRED;
     • в коде экрана нет `api(` — запрет ПОСТРОЕНИЕМ: кнопки отвечают «В прототипе не отправляется».
   Сторож ниже, после SCREENS: экран не бывает в PROTO и WIRED сразу, в теле экрана нет `api(`, и в
   PROTO живут только экраны шага 3 (имя с `master`) — иначе флаг расползётся вторым FROZEN без хозяина.
   ⚠ Предел сторожа: он читает ТЕЛО экрана, а не помощники, которые тело зовёт. */
// v109: экраны шага 3 подключены к ручкам и ушли в WIRED; флаг и сторож остаются механизмом на следующий прототип
var PROTO = {};
/* Витрина вне Telegram (Cafe13KPG#637): экраны шага 3 рисуются на демо-наборе, а не отказом и не
   «Загружаем…». Над ними — плашка прототипа: данные примерные, нажатия ничего не отправляют (загрузчики и
   отправки модуля мастеров вне LIVE возвращаются, не позвав сервер). Демо-человек — МАСТЕР со своим
   согласованным слотом (решение координатора): живы «Клуб» с «Продлить», продление и «Вы мастер».
   Форму E54b и «Заявка уже ждёт решения» снимает опись своей фикстурой (`MR.mine = []` / `[pending]`). */
var MS_DEMO = { masters: 1, masterList: 1, masterReqs: 1, masterReq: 1, masterEvents: 1, masterEvent: 1, masterApply: 1, masterRenew: 1,
               payouts: 1, payout: 1, businesses: 1 };

