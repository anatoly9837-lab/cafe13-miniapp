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

