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
// `topups` (v86, Cafe13KPG#514): схема и `POST /roles` роль принимали, а выдать её было нечем —
// держателя пополнений не назначить, и уведомление о заявке не приходило никому
var ROLE_PICK = ['ops_director', 'art_director', 'director', 'staff', 'topups', 'curator', 'bar'];
var ROLE_GREY = [['god_mentor', 'Чужими глазами'], ['admin', 'Администратор']];
// head, god_mentor и admin на карточке — ОДИН бейдж «Глава клуба» без крестика (слово владельца
// 28.10.2026, кадр E47z `.chip.fixed`). Общий ROLE_NAME не трогается: им живёт кабинет.
var HEAD_ROLES = ['head', 'god_mentor', 'admin'];
var DIR_ROLES = ['curator', 'bar'];
var PEOPLE = { list: null, fail: '', dirs: null, dirsFail: '', gen: 0,
               // ⚠ `card` — ключ СВЁРТКИ (#493), и он НЕ то же, что `open`: `open` — форма выдачи
               // ВНУТРИ раскрытой карточки. Два смысла на одном ключе разошлись бы молча:
               // «форма закрыта» и «карточка свёрнута» — разные состояния экрана.
               card: null,
               open: null, role: '', give: null, busy: false, deny: null, done: null, find: '',
               out: null, gone: null, sending: null, land: null,
               lvAsk: null, lvSending: null, back: null };
/* Окно отмены ДО отправки — теперь ТОЛЬКО у уровня членства (v91). У ролей окна нет: слово
   владельца 29.10.2026 «снятие происходит сразу; отмена активна, пока мы не ушли с экрана или не
   выбрали другую карточку; с выдано можно делать так же» — роль уходит сразу, «Отменить» —
   ОБРАТНОЕ действие (`backSend`). Уровень так не может: сервер срок не хранит (`revoke_level`,
   `ends_at = now()`), вернуть его нечем — поэтому у уровня окно остаётся (решение координатора).
   Цифра в полосе считается ОТСЮДА ЖЕ — разойтись с задержкой ей нечем. */
var UNDO_MS = 5000;
/* Окно отмены ДО отправки — ОДНО на приложение и общее для всех мест, где сервер назад не умеет:
   снятие уровня членства (E47y, v91) и продление мастера (E59b). Своей копии у места нет: одна беда —
   одна форма, копия разошлась бы при первой правке (кадр E59b, решение координатора 29.10.2026).
   Механика здесь — таймер, отсчёт, кто ждёт; ЧТО ждёт и что значит «ушло» — у места (`send`). */
var UNDO = { key: null, at: 0, timer: null, tick: null, screen: null, send: null, leave: 'send' };
function undoStop() {
  if (UNDO.timer) clearTimeout(UNDO.timer);
  if (UNDO.tick) clearInterval(UNDO.tick);
  UNDO.timer = UNDO.tick = null; UNDO.key = null; UNDO.screen = null; UNDO.send = null;
}
function undoLeft() { return Math.max(0, Math.ceil((UNDO.at + UNDO_MS - Date.now()) / 1000)); }
/* key — что ждёт отправки; send(key) — отправка по истечении окна (гард «ключ не сменился» — здесь).
   opts.leave — что делать, если человек УШЁЛ с экрана в окне: 'send' — отправить (снятие уровня: денег нет,
   решение принято) или 'cancel' — не отправлять (продление: 2 600 ฿ за нажатие, возврата нет). Решение
   координатора 29.10.2026 по слову владельца 28.10: «закрыл приложение в эти секунды — действие НЕ
   произошло» — при деньгах ошибаться в сторону «ничего не сделали». Политика — ПАРАМЕТР, а не вторая копия окна. */
function undoStart(key, send, opts) {
  undoStop();
  UNDO.key = key; UNDO.at = Date.now(); UNDO.screen = current; UNDO.send = send;
  UNDO.leave = opts && opts.leave === 'cancel' ? 'cancel' : 'send';
  UNDO.timer = setTimeout(function () {
    if (UNDO.key !== key) return;
    send(key);
  }, UNDO_MS);
  // отсчёт меняет только цифру, экран не перерисовывается
  UNDO.tick = setInterval(function () {
    var el = document.querySelector('.undo .sec');
    if (el) el.textContent = String(undoLeft());
  }, 250);
}
// lv — ключ уровня членства «k.level» (v86). Окно вышло — снятие уходит НЕ через вход действий: там
// `PEOPLE.busy`, и если в эту секунду в пути выдача у другой карточки, снятие тихо потерялось бы (v91)
function lvAskStart(lv) {
  PEOPLE.lvAsk = lv; PEOPLE.deny = null;
  undoStart(lv, lvSend);
}

function mayPeople() { return LIVE && (grant('head') || grant('admin')); }
/* Блокировка снимается вместе с состоянием экрана: вход на экран и смена роли
   поднимают PEOPLE.gen, и ответ, который снял бы её сам, отбрасывается гардом —
   без этой строки экран оставался запертым до перезапуска (Cafe13KPG#213). */
function peopleReset() {
  PEOPLE.busy = false;
  PEOPLE.open = null; PEOPLE.role = ''; PEOPLE.give = null; PEOPLE.deny = null; PEOPLE.done = null;
  PEOPLE.out = null; PEOPLE.gone = null;
  // ⚠ Окно отмены уровня здесь НЕ закрывается (v91). Прежде закрывалось БЕЗ отправки — и любое
  // действие с карточкой в эти секунды («+ ответственность», минус, свернуть) ТИХО отменяло
  // снятие: человек видел полосу и думал, что снял (замер 29.10.2026 по жалобе владельца).
  // Теперь окно кончается только отправкой (таймер, уход с карточки, уход с экрана) или «Отменить».
  // и погашенная надпись прежнего захода гаснуть перестаёт: ответ на тот запрос отброшен гардом,
  // и без этой строки надпись оставалась погашенной и не нажималась до перезапуска (people-late-revoke)
  PEOPLE.sending = null; PEOPLE.lvSending = null;     // то же у погашенного уровня (v86)
  // ⚠ `PEOPLE.card` здесь НЕ сбрасывается НАРОЧНО: после выдачи, снятия и отказа список
  // перечитывается этим же путём, и человек, которого настраивают, обязан остаться
  // раскрытым — иначе итог («Выдано: …») показался бы в карточке, которая тут же схлопнулась.
  // Снимается свёртка только на входе на экран и при смене роли — там, где поднимается `gen`.
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
    /* ⚠ `nearest`, а НЕ `start` — замер по жалобе владельца 29.10.2026 («Плашка прыгает и
       улетает вверх»). `start` тянет карточку к верху окна ДАЖЕ когда она целиком видна:
       на списке из двадцати и видимой карточке экран уезжал на 379 px, при `nearest` — на 0.
       То есть дефект был не в отступе и не в выросшей высоте строки, а в том, что экран
       двигался там, где двигать незачем. Место по-прежнему держится ЧЕЛОВЕКОМ (список после
       действия перечитывается и прокрутка прижимается к нулю), но экран дёргается только
       тогда, когда карточка иначе осталась бы за краем. */
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    return;
  }
}
/* Направление — СКОБКАМИ, а не « · » (Cafe13KPG#869): подпись роли сама бывает с точкой-разделителем
   («Бар · исполнитель»), и «Бар · исполнитель · Кофейня» не говорит, где кончается роль. Слова ролей не меняются */
function roleWords(role, dirTitle) { return (ROLE_NAME[role] || role) + (dirTitle ? ' (' + dirTitle + ')' : ''); }

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
      // слова сервера по тем же местам, что `lv`: снятие уровня берёт уровень СЛОВОМ (v86)
      lvKeys: p.memberships.slice(),
      bal: bal,
      // Конец живого членства (слово владельца 29.10.2026: «после имени сделай не большим
      // шрифтом дату окончания членства», плюс «поставь мне значек бесконечности» 28.10).
      // ⚠ Состояний ЧЕТЫРЕ, а не два, и признак — наличие КЛЮЧА, тот же класс, что у остатка:
      //   поля нет вовсе      → `till === undefined`: старый сервер, рисовать нечего;
      //   `lifelong: true`    → бессрочно, знак ∞ (сервер шлёт `ends_at: null` вместе с ним);
      //   дата строкой        → срок;
      //   `null` без lifelong → живого членства нет, и это НЕ то же, что «не спросили».
      // Сервер (`roles.py` на боевом `e545973`): `NULLIF(max(ends_at),'infinity')` и
      // `bool_or(ends_at='infinity')`, то есть поля ПЛОСКИЕ — один конец на человека.
      till: 'ends_at' in p ? { iso: typeof p.ends_at === 'string' ? p.ends_at : null,
                               inf: p.lifelong === true } : undefined,
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
  var detail = detailOf(r);
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
    // обратный ход — снять только что выданную (v91, «с выдано можно делать так же»); id — из ответа
    if (typeof r.data.id === 'number')
      PEOPLE.back = { uid: p.uid, kind: 'granted', rid: r.data.id, words: roleWords(body.role, dir ? dir.title : '') };
    loadRoster(); render();
  });
}
function revokeSend(rid) {
  var p = (PEOPLE.list || []).filter(function (x) { return x.roles.some(function (y) { return y.id === rid; }); })[0];
  if (!p || PEOPLE.busy) return;
  var role = p.roles.filter(function (y) { return y.id === rid; })[0];
  var gen = PEOPLE.gen;
  PEOPLE.busy = true; PEOPLE.deny = null; PEOPLE.sending = rid; render();
  api('POST', '/roles/' + rid + '/revoke').then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false; PEOPLE.sending = null;
    var ok = r.status === 200 && r.data && r.data.id === rid && !!r.data.revoked_at;
    if (!ok) { PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn'); render(); return; }
    haptic('ok');
    peopleReset();
    PEOPLE.land = p.uid;
    PEOPLE.done = { uid: p.uid, text: 'Снято: ' + role.words + '. Снятая роль остаётся в истории на сервере.' };
    // обратный ход — выдать ту же роль снова (v91); живёт, пока не выбрана другая карточка
    PEOPLE.back = { uid: p.uid, kind: 'revoked', role: role.role, dir: role.dir, words: role.words };
    loadRoster(); render();
  });
}
/* «Отменить» у выдачи и снятия роли (v91) — ОБРАТНОЕ действие, а не «не отправлять»: роль уже на
   сервере. Снятую выдаём снова (новая строка роли, снятая остаётся историей), выданную снимаем.
   Живёт, пока человек не выбрал другую карточку и не ушёл с экрана; держится по tg_user_id в
   памяти, а не по номеру строки — после перечитывания списка номер может уехать. */
function backSend() {
  var b = PEOPLE.back;
  if (!b || PEOPLE.busy) return;
  var gen = PEOPLE.gen;
  var body = { member_id: b.uid, role: b.role };
  if (b.kind === 'revoked' && b.dir !== null) body.direction_id = b.dir;
  PEOPLE.busy = true; PEOPLE.deny = null; render();
  (b.kind === 'revoked' ? api('POST', '/roles', body) : api('POST', '/roles/' + b.rid + '/revoke')).then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.busy = false; PEOPLE.back = null;
    var ok = b.kind === 'revoked'
      ? r.status === 201 && r.data && r.data.member_id === b.uid && r.data.role === b.role
      : r.status === 200 && r.data && r.data.id === b.rid && !!r.data.revoked_at;
    if (!ok) { PEOPLE.deny = { uid: b.uid, text: denyText(r) }; haptic('warn'); render(); return; }
    haptic('ok');
    peopleReset();
    PEOPLE.land = b.uid;
    // слова designer-55 (кадр E47c): вторая фраза ИСПРАВЛЯЕТ обещание первой — на сервере теперь
    // две записи. Кнопки в этом состоянии нет: отменять нечего
    PEOPLE.done = { uid: b.uid, text: b.kind === 'revoked'
      ? 'Возвращено: ' + b.words + '. В истории останутся обе записи — и снятие, и возврат.'
      : 'Отменено: ' + b.words + '. В истории останутся обе записи — и выдача, и снятие.' };
    loadRoster(); render();
  });
}
/* Снятие ОДНОГО уровня членства (v86, слово владельца 28.10.2026: «отменить его партнерство или
   мастерство»; надписи уровней — кнопки). Ручка `POST /memberships/{tg_user_id}/revoke` на бою с
   `d1fa661`: уровень — СЛОВОМ в теле, обрывается ровно одно живое членство этого вида.
   ⚠ Обратного хода нет: сервер ставит `ends_at = now()` и прежний срок не хранит. Поэтому «Отменить»
   — окно ДО отправки (`undoStart`), а не откат; закрыл приложение в окне — снятие не случилось.
   Отказы — словами сервера (`denyText`): 403 не глава, 409 свои уровни, 409 «этого уровня нет». */
// ⚠ БЕЗ `PEOPLE.busy` (v91): снятие уровня уходит и досрочно — когда человек уже нажал что-то у
// другой карточки, — и это нажатие не должно ни ждать, ни теряться. От двойной отправки держит
// сама метка окна: отправка её снимает первой строкой, вторая отправка того же ключа не пройдёт.
function lvSend(key) {
  if (PEOPLE.lvAsk !== key) return;
  undoStop(); PEOPLE.lvAsk = null;
  // в демонстрации снятие не уходит — через вход действий, где её перехват
  if (!LIVE) { doAction('p-lvrevoke:' + key); return; }
  var m = /^(\d+)\.(member|organizer|partner)$/.exec(String(key));
  var p = m && PEOPLE.list && PEOPLE.list[Number(m[1])];
  if (!p || p.lvKeys.indexOf(m[2]) === -1) return;
  var level = m[2], words = LEVEL[level] || level;
  var gen = PEOPLE.gen;
  PEOPLE.lvSending = key; if (current === 'people') peopleRedraw([Number(m[1])]);
  api('POST', '/memberships/' + p.uid + '/revoke', { level: level }).then(function (r) {
    if (gen !== PEOPLE.gen) return;
    PEOPLE.lvSending = null;
    var ok = r.status === 200 && r.data && r.data.level === level && r.data.memberships_ended > 0;
    if (!ok) {
      PEOPLE.deny = { uid: p.uid, text: denyText(r) }; haptic('warn');
      // «этого уровня членства у человека нет» — список устарел: уровень снял кто-то другой
      if (r.status === 409) { PEOPLE.land = p.uid; loadRoster(); }
      render(); return;
    }
    haptic('ok');
    // ⚠ Без peopleReset и без перечитывания списка (v91): снятие могло уйти досрочно, пока
    // человек уже у другой карточки, — сброс стёр бы ЕГО действие, а перечитывание укоротило бы
    // страницу и сдёрнуло прокрутку. Сервер подтвердил ровно этот уровень — он убирается из
    // своей строки на месте, и перерисовывается только своя карточка.
    var before = peopleTouched(), at = p.lvKeys.indexOf(level);
    if (at !== -1) { p.lvKeys.splice(at, 1); p.lv.splice(at, 1); p.levels = p.lv.join(' · '); }
    // слова designer-55: непоправимость ВПЕРЁД, механизм следом — у роли вторая фраза утешает
    // («остаётся в истории»), здесь наоборот, и это главное, что человек должен унести
    PEOPLE.done = { uid: p.uid, text: 'Снято: ' + words + '. Вернуть прежний срок нечем — членство оборвано сегодняшним днём.' };
    if (current === 'people') { before.push(Number(m[1])); peopleRedraw(before); }
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
/* Хвост строки имени: дата конца живого членства или ∞ (кадр E47p). Четыре состояния поля
   разобраны в `fromRoster`, здесь они только рисуются — и «поля нет» с «членства нет» дают
   ПУСТО по разным причинам: у первого рисовать нечем, у второго нечего. */
function tillTail(p) {
  if (!p.till) return '';                                   // старый сервер: поля нет вовсе
  if (p.till.inf) return '<span class="till"> · <span class="inf">∞</span></span>';
  if (!p.till.iso) return '';                               // живого членства нет
  var t = tillWords(p.till.iso);
  if (!t) return '';                                        // дата не разобралась — молчим, а не врём
  return '<span class="till' + (t.soon ? ' soon' : '') + '"> · до ' + esc(t.text) + '</span>';
}
function personCard(p, k) {
  var lock = PEOPLE.busy ? ' disabled' : '';
  var open = PEOPLE.open === k;
  var X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // Кадры E47z/E47k/E47l: доступ — надпись-кнопка («размер оставить»), крестик снимает без вопроса.
  // Уровень членства (v86) — надпись-кнопка с крестиком, как доступ: ручка снятия уровня
  // `POST /memberships/{tg_user_id}/revoke` на бою с `d1fa661`. Уровень она берёт СЛОВОМ в теле и
  // обрывает ровно одно живое членство названного вида — обратного хода нет, срок не сохраняется,
  // поэтому окно отмены — ДО отправки (`lvSend`).
  //
  // ДВА РЯДА, а не один (слово владельца 29.10.2026, Cafe13KPG#502 п.2): «разделим 2 уровня —
  // клубный доступ (глава клуба, член клуба, партнер, мастер) и ответственность (арт директор,
  // работник…); клубный доступ первой строчкой и одной, ответственность со второй». Раскол
  // ложится на уже существующие наборы, а не на новое правило: доступ — это `p.lv` (виды
  // членства) плюс бейдж по HEAD_ROLES, ответственность — все прочие роли и вход «+».
  // ⚠ Ряд доступа у человека без членства и без главенства ПУСТ, и тогда его не рисуем вовсе:
  // пустой `.chips` даёт свой `gap` и лишний отступ там, где смотреть не на что.
  /* ⚠ КРЕСТИК У УРОВНЯ ПОГАШЕН — ЭТО РЕШЕНИЕ, А НЕ НЕДОДЕЛКА (слово владельца 29.10.2026:
     «гаси»). В v86 уровень стал надписью-кнопкой с крестиком, и крестик уже был у него на
     экране, а ручка под ним работает по-старому: `UPDATE memberships SET ends_at = now()`
     СТИРАЕТ прежний срок. Каждое нажатие теряло дату окончания уровня — восстановимо только
     разбором по `ledger_id` и `starts_at`. Нашёл `arhitector-47`, владелец выбрал гасить.
     Возвращается вместе с `Cafe13KPG#519` (ручке нужен «атрибут отменено + дата отмены», а не
     затирание срока) — там же вернуть случаи батареи, снятые с причиной `lvOff`.
     ⚠ Чипы уровней остаются КАК ЕСТЬ: гасится только вход в снятие, а не показ уровня.
     Состояние (`lvAsk`, `lvSending`) и обработчик не трогаются нарочно: они целы и ждут
     возврата крестика; снимать их значило бы писать v86 заново. */
  var dostup = p.lv.map(function (l) {
    return '<span class="chip paid fixed">' + esc(l) + '</span>';
  }).join('') +
    (p.roles.some(function (r) { return HEAD_ROLES.indexOf(r.role) !== -1; }) ? '<span class="chip fixed">Глава клуба</span>' : '');
  var rows = (dostup ? '<div class="chips" data-chips="access">' + dostup + '</div>' : '') +
    '<div class="chips" data-chips="duty">' +
    p.roles.filter(function (r) { return HEAD_ROLES.indexOf(r.role) === -1; }).map(function (r) {
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
  var askRole = null;                                   // окно отмены — только у уровня (v91)
  p.lvKeys.forEach(function (c, i) { if (PEOPLE.lvAsk === k + '.' + c) askRole = { words: p.lv[i] }; });
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
  // v91: у итога выдачи и снятия роли справа «Отменить» — обратное действие (слово владельца:
  // «на плашку со „снято…“ повесим кнопку отмены в правой части»). Живёт, пока не выбрана
  // другая карточка и не покинут экран. Облик — кадры E47f/E47h (Cafe13KPG#521): `btn mini quiet`
  // справа ПРАВИЛОМ `.note.act`, а не длиной фразы (на коротком итоге кнопка вставала за словами).
  var backBtn = PEOPLE.back && PEOPLE.back.uid === p.uid
    ? '<button type="button" class="btn mini quiet" data-action="p-back"' + lock + '>Отменить</button>' : '';
  var done = mine(PEOPLE.done) ? '<div class="note' + (backBtn ? ' act' : '') + '" role="status">' + svg(ICON.info) + '<span>' + esc(PEOPLE.done.text) + '</span>' + backBtn + '</div>' : '';
  var q = PEOPLE.find.trim().toLowerCase();
  // E47g/E47zh: исключённый — итогом на месте своей карточки
  if (PEOPLE.gone && PEOPLE.gone.uid === p.uid)
    return '<div class="card quiet" data-person="' + k + '" role="status"><span class="small">' + esc(PEOPLE.gone.text) + '</span></div>';
  var outAsk = PEOPLE.out === k;
  var hid = q && p.name.toLowerCase().indexOf(q) === -1 ? ' hidden' : '';
  /* СВЁРНУТАЯ строка (слово владельца 28.10.2026, Cafe13KPG#493): «самое идеальное когда они
     свернуты и по клику разворачиваются с настройками… большой список, по которому удобно
     искать, и фокус только на настройки одного человека». Раскрыта РОВНО ОДНА.
     ⚠ Структура — решение designer-55 по моему возражению: плашка остаётся НАСТОЯЩЕЙ кнопкой,
     а минус лежит её СОСЕДОМ поверх (`.fold-wrap`), а не внутри. Вложенные кнопки невалидны,
     а нажимаемых НЕ-кнопок в этом клиенте нет ни одной (`tabindex` 0, `role="button"` 0) —
     то есть цель во всю плашку и правило клиента целы разом. Минус в свёрнутой строке — его
     же слово, данное при виде цены («целиком видно 7 из 8 вместо 8»).
     ⚠ Внутри кнопки только строчное: `.row`/`.col` вешаются на `span`, иначе разметка невалидна.
     ⚠ `data-person` стоит на ОБЁРТКЕ: по нему живут посадка на карточку (`peopleLand`),
     частичная перерисовка и поиск по имени — все трое ищут корень, а не кнопку. */
  if (PEOPLE.card !== k)
    return '<div class="fold-wrap" data-person="' + k + '"' + hid + '>' +
      '<button type="button" class="card dense fold" data-action="p-card:' + k + '" aria-expanded="false"' + lock + '>' +
        '<span class="row"><span class="col"><b>' + esc(p.name) + tillTail(p) + '</b>' +
          '<span class="small">' + (p.lv.length ? esc(p.lv.join(' · ')) : 'без членства') + '</span>' +
        '</span><span data-money style="font-variant-numeric:tabular-nums;white-space:nowrap">' +
          (p.bal === undefined ? '—' : money(p.bal % 1 ? p.bal.toFixed(2) : p.bal) + ' ฿') + '</span></span>' +
      '</button>' +
      '<button type="button" class="outbtn" data-action="p-out:' + k + '" aria-label="Исключить из клуба"' + lock + '>[ - ]</button>' +
    '</div>';
  return '<div class="card dense open" data-person="' + k + '"' + hid + '>' +
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
      '<button type="button" class="outbtn" data-action="p-out:' + k + '" aria-label="Исключить из клуба"' + lock + '>[ - ]</button>' +
      '<b>' + esc(p.name) + tillTail(p) + '</b></div></div><span data-money style="font-variant-numeric:tabular-nums;white-space:nowrap">' +
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
  // ⚠ Ключи ОБЪЕДИНЕНЫ при слиянии: `card` — свёртка карточек, `lvAsk`/`lvSending` — снятие
  // уровня (v86). Потерять любой значит оставить его карточку неперерисованной.
  [PEOPLE.card, PEOPLE.open, PEOPLE.out,
   PEOPLE.lvAsk !== null ? Number(String(PEOPLE.lvAsk).split('.')[0]) : null,
   PEOPLE.lvSending !== null ? Number(String(PEOPLE.lvSending).split('.')[0]) : null,
   PEOPLE.back && at(PEOPLE.back.uid),
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

/* ── заявки на пополнение: очередь держателя «Пополнения онлайн» ──  Cafe13KPG#583, кадры E56*
   Нашёл владелец 29.10.2026: «у меня в управлении не вижу вкладки запросы на пополнение» — ручки
   сервера были (`app/routers/topup.py`), клиента не было вовсе. Право — ответственность `topups`
   или администратор (`_may_decide`).
   ⚠ В ответе очереди есть `member_id` (это tg_user_id) и `username` — в разметку не идут: свою
   заявку узнаём сравнением с tgUid() В ПАМЯТИ, решение — по номеру заявки.
   ⚠ Свою заявку сервер решить не даёт (409 «свою заявку решает другой ответственный»), поэтому
   у своей строки кнопок НЕТ вовсе, а не погашены (кадр E56e): у владельца роль одна, и своя
   заявка появится у него в первом же тесте.
   ⚠ «Зачислить» необратимо — строка в книгу, и шага подтверждения (E56g) у него НЕТ: слово владельца
   31.10.2026 (Cafe13KPG#695) — «Промах правит касса», то есть встречной строкой через
   `POST /till/{entry_id}/cancel`. Поэтому сумма стоит на самой кнопке: другой защиты от промаха здесь нет.
   ⚠ Пустая причина отказа — не пустота: сервер ставит «Мы не получили деньги». Подсказка под
   полем говорит это вслух (E56d), иначе «необязательно» читалось бы как «причины не будет». */
var TOPQ = { list: null, pending: null, fail: '', gen: 0, busy: false, err: '', step: '', note: '', shot: {}, who: 0, done: '' };
var TOPQ_ST = { pending: 'wait', approved: 'ok', rejected: 'no' };
var TOPQ_WAY = { transfer: 'Перевод' };         // единственный способ: CHECK в миграции 019
function mayTopups() { return LIVE && (grant('topups') || grant('admin')); }

/* шаг 3 — право ровно как у сервера: решают `art_director` и админ (`_may_decide`, cafe13-api
   app/routers/master.py:91, на бою `bbf09f8`). Главы здесь нет: сервер ответил бы ему 403. */
function mayMasters() { return LIVE && (grant('art_director') || grant('admin')); }
/* шаг 12 — операционный директор (Cafe13KPG#877): право ровно как у сервера (`_is_ops`, cafe13-api#876):
   `ops_director` и админ. Главы здесь нет: выдаёт роль глава, но бизнесы видит не он. */
function mayOps() { return LIVE && (grant('ops_director') || grant('admin')); }

/* «Бизнесы клуба» (кадры E75/E75b/E75v) — `GET /directions`. Партнёра сервер отдаёт только тем, кому
   `_is_ops`: тремя ключами `partner_id`, `partner_first_name`, `partner_last_name`. ДОЛЕЙ НА ЭКРАНЕ НЕТ:
   `share_*` операционному директору не приходят, а у админа приходят доли СТАРОЙ модели, которые заменит
   шаг 21 — разборщик их не читает вовсе. Закрытые бизнесы (`is_active: false`) в список не идут: кадр E75b
   «бизнесов нет» — и до первого, и после закрытия всех.
   ⚠ Ключа партнёра нет — отказ целиком, а не «партнёра нет»: так выглядит ответ сервера без #876, и
   правдоподобное «ни у кого нет партнёра» было бы ложью (§4). Партнёра нет — это `partner_id: null`. */
var BIZ = { list: null, fail: '', gen: 0 };
function fromBusinesses(d) {
  if (!Array.isArray(d)) return null;
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var x = d[i];
    if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.is_active !== 'boolean' ||
        typeof x.is_open !== 'boolean' || !('partner_id' in x)) return null;
    var who = null;
    if (x.partner_id === null) {
      if (x.partner_first_name != null || x.partner_last_name != null) return null;
    } else {
      if (typeof x.partner_id !== 'number' || typeof x.partner_first_name !== 'string' ||
          typeof x.partner_last_name !== 'string') return null;
      who = (x.partner_first_name + ' ' + x.partner_last_name).trim();
    }
    if (x.is_active) out.push({ id: x.id, title: x.title, open: x.is_open, partner: x.partner_id !== null, who: who });
  }
  return out;
}
function loadBusinesses() {
  if (!LIVE || !mayOps()) return;
  var gen = ++BIZ.gen; BIZ.fail = '';
  api('GET', '/directions').then(function (r) {
    if (gen !== BIZ.gen) return;
    var list = r.status === 200 ? fromBusinesses(r.data) : null;
    BIZ.list = list; BIZ.fail = list ? '' : r.status === 403 ? denyText(r) : failText(r);
    if (current === 'businesses') render();
  });
}
/* ── шаг 13: заявка в партнёры (Cafe13KPG#889, сервер cafe13-api#143, снимки partner-* — cafe13-miniapp#256) ──
   Образец — заявка мастера: деньги первого месяца списываются при подаче, отказ возвращает их встречной строкой,
   согласие операционного директора СОЗДАЁТ бизнес. Разборщик строгий: одна битая строка — отказ целиком (§4).
   ⚠ Рецептов шага 13 в стволе нет (#887): слова и раскладка — по образцу мастера и сверяются, когда рецепт ляжет. */
/* Цена месяца — ТОЛЬКО от сервера, `GET /partner/price` → {amount} (рецепт R1, «Заказ серверу»; Cafe13KPG#902).
   ⚠ На 06.11.2026 этой ручки НЕТ (`PRICE_MONTH` — константа внутри partner.py): сервер отвечает 404, экран говорит
   «Цену не удалось узнать у сервера.», кнопка погашена — экран есть, купить нельзя. Число в разметке соврало бы при
   первой смене цены. Ручка ляжет — экран оживёт без правки клиента: это и есть отрицательный контроль заплатки
   (случаи `partner-cena-404` и `partner-cena-200`). `price`: undefined — не спрашивали, 'loading', число, null — не узнать */
var PR = { mine: null, mineState: '', mineGen: 0, q: null, pending: null, qFail: '', qGen: 0, price: undefined, priceGen: 0,
           busy: false, ask: 0, note: '', qErr: '', title: '', about: '', err: '' };
function loadPartnerPrice() {
  if (!LIVE || PR.price === 'loading') return;
  var gen = ++PR.priceGen; PR.price = 'loading';
  api('GET', '/partner/price').then(function (r) {
    if (gen !== PR.priceGen) return;
    PR.price = r.status === 200 && r.data && typeof r.data.amount === 'string' && /^\d+(\.\d+)?$/.test(r.data.amount) ? Number(r.data.amount) : null;
    if (current === 'partnerApply') prGrab();   // набранное в полях — до перерисовки
    if ({ home: 1, partnerApply: 1 }[current]) render();
  });
}
// «до ДД.ММ.ГГГГ» — день МОМЕНТА `paid_till` по часам клуба, без вычитания дня: «до» читается исключающе (рецепт R1)
function prTill(iso) { var x = bkk(new Date(iso)).ymd.split('-'); return x[2] + '.' + x[1] + '.' + x[0]; }
// блок «Свой бизнес в клубе» на «Клубе» (рецепт R1): у гостя и вне Telegram — пусто
function partnerOffer() {
  if (!LIVE || DATA.role === 'guest') return '';
  if (PR.mineState === '') loadMinePartner();
  if (PR.price === undefined) loadPartnerPrice();
  if (PR.mineState === 'loading' && !PR.mine) return '';
  if (PR.mineState !== 'ok' && !PR.mine) return '<div class="card quiet"><div class="row"><span class="small">Заявки в партнёры не загрузились: ' +
      esc(PR.mineState) + '</span><button type="button" class="btn quiet" data-action="pr-retry-mine">Повторить</button></div></div>';
  var head = function (q, st) {
    return '<div class="row"><div class="col"><b>Заявка в партнёры</b><span class="small">' + esc(topupDay(q.done || q.iso, !q.done)) + '</span></div>' +
      '<span class="st ' + st + '">' + esc(q.word) + '</span></div>';
  };
  // согласованных бывает больше одного: бизнесов у человека может быть два (шапка partner.py)
  var yes = PR.mine.filter(function (q) { return q.status === 'approved'; }).map(function (q) {
    return '<div class="card"><div class="col"><b class="clamp2">Вы партнёр бизнеса «' + esc(q.title) + '»</b>' +
      (q.till ? '<span class="small">Оплачено до ' + esc(prTill(q.till)) + '</span>' : '') + '</div></div>';
  }).join('');
  var last = PR.mine[0];
  if (last && last.status === 'pending') return yes + '<div class="card quiet">' + head(last, 'wait') +
      '<span class="small">Списано ' + money(last.amount) + ' ฿.</span></div>' +
    '<div class="note">' + svg(ICON.info) + '<span>Решение принимает операционный директор. Если он откажет, деньги вернутся на счёт.</span></div>';
  if (yes) return yes;
  if (last && last.status === 'rejected') return '<div class="card quiet">' + head(last, 'no') +
      (last.note ? '<span class="said">' + esc(last.note) + '</span>' : '') +
      '<span class="small">' + money(last.amount) + ' ฿ вернулись на счёт.</span></div>' +
    '<button type="button" class="btn" data-action="pr-apply">Подать заново</button>';
  var p = PR.price, bal = msBalance(), short = typeof p === 'number' && bal < p;
  return '<div class="card"><div class="col"><b>Свой бизнес в клубе</b>' +
      '<span class="small">Название, описание и оплаченный месяц. Что в бизнесе появится дальше — следующий шаг.</span></div>' +
      '<span class="small">' + (typeof p !== 'number' ? (p === null ? 'Цену не удалось узнать у сервера.' : 'Узнаём цену…')
        : short ? 'Не хватает ' + money(p - bal) + ' ฿: нужно ' + money(p) + ' ฿, на счёте ' + money(bal) + ' ฿'
        : money(p) + ' ฿ в месяц') + '</span>' +
      '<span class="small">Месяц идёт от даты оплаты. Продлевается оплатой, без новой заявки.</span>' +
      '<button type="button" class="btn" data-action="pr-apply"' + (typeof p !== 'number' || short ? ' disabled' : '') + '>Я партнёр</button></div>' +
    (short ? '<div class="note">' + svg(ICON.info) + '<span>Пополнить счёт можно на вкладке «Клуб» — кошельком в шапке.</span></div>' : '');
}
// набранное в полях — в PR перед любой перерисовкой, иначе текст пропадёт
function prGrab() {
  var t = document.getElementById('pr-title'), a = document.getElementById('pr-about');
  if (t) PR.title = t.value;
  if (a) PR.about = a.value;
}
// причина отказа: кнопка гаснет и включается на ВВОДЕ, без перерисовки — иначе набор терял бы фокус (как `msNoteSync`)
function prNoteSync() {
  var t = document.getElementById('pr-note'); if (!t) return;
  PR.note = t.value;
  var b = document.querySelector('#view [data-action^="pr-no:"]'), w = document.getElementById('pr-why'), empty = !PR.note.trim();
  if (b) { b.disabled = empty || PR.busy; b.setAttribute('aria-disabled', String(b.disabled)); }
  if (w) w.hidden = !empty;
}
document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'pr-note') prNoteSync(); });
function prMoment(v) {
  return typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:?\d\d)$/.test(v) && !isNaN(Date.parse(v));
}
/* Заявка: снимки partner-request-201, partner-requests-mine, partner-requests-ops-director. Сумма — строкой.
   Согласие и бизнес идут парой: `approved` без `direction_id` (или наоборот) — не та форма, что пишет сервер.
   `paid_till` — ключ обязателен: null законен (бизнеса нет), пропавший ключ — нет. Номер человека в разметку не идёт. */
function fromPartnerReq(x, queue) {
  if (!x || typeof x.id !== 'number' || typeof x.title !== 'string' || typeof x.about !== 'string') return null;
  var amount = typeof x.amount === 'string' && /^\d+(\.\d+)?$/.test(x.amount) ? Number(x.amount) : NaN;
  if (!isFinite(amount) || !{ pending: 1, approved: 1, rejected: 1 }[x.status] || typeof x.status_ru !== 'string') return null;
  if (!prMoment(x.created_at) || !(x.decided_at === null || prMoment(x.decided_at))) return null;
  if (!(x.decision_note === null || typeof x.decision_note === 'string') || typeof x.active !== 'boolean') return null;
  if (!(x.direction_id === null || typeof x.direction_id === 'number') || (x.status === 'approved') !== (x.direction_id !== null)) return null;
  if (!('paid_till' in x) || !(x.paid_till === null || prMoment(x.paid_till))) return null;
  var r = { id: x.id, title: x.title, about: x.about, amount: amount, status: x.status, word: x.status_ru,
            note: x.decision_note || '', iso: x.created_at, done: x.decided_at, biz: x.direction_id, till: x.paid_till, active: x.active };
  if (queue) {
    if (typeof x.member_id !== 'number' || typeof x.first_name !== 'string' || typeof x.last_name !== 'string' ||
        !(x.username === null || typeof x.username === 'string')) return null;
    r.who = msName(x);
  }
  return r;
}
function fromPartnerList(d, queue) {
  if (!d || !Array.isArray(d.requests) || queue && typeof d.pending !== 'number') return null;
  var out = d.requests.map(function (x) { return fromPartnerReq(x, queue); });
  if (out.some(function (x) { return !x; })) return null;
  return { list: out, pending: queue ? d.pending : null };
}
function loadMinePartner() {
  if (!LIVE) return;
  var gen = ++PR.mineGen; PR.mineState = 'loading';
  api('GET', '/partner/requests/mine').then(function (r) {
    if (gen !== PR.mineGen) return;
    var d = r.status === 200 ? fromPartnerList(r.data, false) : null;
    PR.mine = d ? d.list : null; PR.mineState = d ? 'ok' : failText(r);
    if (current === 'partnerApply') prGrab();   // набранное в полях — до перерисовки
    if ({ home: 1, partnerApply: 1 }[current]) render();
  });
}
function loadPartnerQueue() {
  if (!LIVE || !mayOps()) return;
  var gen = ++PR.qGen; PR.qFail = '';
  api('GET', '/partner/requests').then(function (r) {
    if (gen !== PR.qGen) return;
    var d = r.status === 200 ? fromPartnerList(r.data, true) : null;
    if (d) { PR.q = d.list; PR.pending = d.pending; } else { PR.q = null; PR.qFail = r.status === 403 ? denyText(r) : failText(r); }
    if ({ manage: 1, partnerReqs: 1, partnerReq: 1 }[current]) render();
  });
}
function sendPartner() {
  if (PR.busy) return;
  prGrab();
  // пустое и сверх предела — отказ ДО отправки: схема сервера ответила бы 422 без слов («Сервер не принял запрос»).
  // Поле не обрезается (рецепт R2): набранное остаётся, видно, что править
  PR.err = typeof PR.price !== 'number' ? 'Цена ещё не пришла от сервера.' : PR.price > msBalance() ? 'Не хватает денег на счёте.' : !PR.title.trim() ? 'Назовите бизнес.' : PR.title.trim().length > 200 ? 'Название — не длиннее 200 знаков.'
    : PR.about.length > 2000 ? 'О бизнесе — не длиннее 2000 знаков.' : '';
  if (PR.err) { render(); return; }
  if (!LIVE) return;
  PR.busy = true; render();
  api('POST', '/partner/request', { title: PR.title.trim(), about: PR.about }).then(function (r) {
    PR.busy = false;
    var got = r.status === 201 ? fromPartnerReq(r.data, false) : null;
    // деньги могли уйти и при неразобранном ответе — свою заявку и остаток перечитываем ВСЕГДА
    loadMinePartner(); refreshMe();
    if (got) {
      PR.title = ''; PR.about = ''; PR.err = '';
      FLASH = { text: 'Заявка отправлена', note: 'Списано ' + money(got.amount) + ' ฿. Решение примет операционный директор; если он откажет, деньги вернутся на счёт.' };
      go('home'); return;
    }
    PR.err = denyText(r);
    if (current === 'partnerApply') render();
  });
}
// ответ decide — только статус и `direction_id` (названия и `paid_till` в нём нет, Cafe13KPG#902)
function decidePartner(id, decision) {
  var note = decision === 'rejected' ? PR.note.trim() : '';
  if (PR.busy || !LIVE || !mayOps() || decision === 'rejected' && (PR.ask !== id || !note)) return;
  PR.busy = true; PR.qErr = ''; render();
  api('POST', '/partner/requests/' + id + '/decide', { decision: decision, note: note }).then(function (r) {
    PR.busy = false;
    if (r.status === 200 && r.data && r.data.status === decision) {
      // название — из уже загруженной очереди: ответ decide его не несёт (рецепт R5)
      var q = (PR.q || []).filter(function (x) { return x.id === id; })[0];
      FLASH = { text: decision === 'approved' ? 'Согласовано' : 'Отказано',
                note: decision === 'approved' ? (q ? 'Бизнес «' + q.title + '» создан.' : 'Бизнес создан.') : 'Деньги вернулись на счёт заявителя.' };
      PR.ask = 0; PR.note = '';
      loadPartnerQueue(); loadBusinesses(); go('partnerReqs'); return;
    }
    PR.qErr = denyText(r);
    if (r.status === 409) loadPartnerQueue();
    if (current === 'partnerReq') render();
  });
}

// плашка прототипа — механизм на будущее: сейчас PROTO пуст, шаг 3 подключён (v109)
function protoStrip() {
  return '<div class="proto-strip" role="note"><b>Прототип</b><span class="small">Данные примерные, нажатия ничего не отправляют.</span></div>';
}
/* Время слота «с — до» (слово владельца 29.10.2026: «Время только с, нету до, надо»). Конец не хранится, а
   ВЫЧИСЛЯЕТСЯ из `hours` сервера (снимки master-*, cafe13-api#96). Тире — с пробелами, как в мерке
   дизайнера («10:00 – 11:30»). */
function msSpan(day, start, hours) {
  var m = /^(\d\d):(\d\d)$/.exec(start); if (!m) return day + ', ' + start;
  var end = (Number(m[1]) * 60 + Number(m[2]) + hours * 60) % (24 * 60);
  var hh = function (x) { return (x < 10 ? '0' : '') + x; };
  return day + ', ' + start + ' – ' + hh(Math.floor(end / 60)) + ':' + hh(end % 60);
}

