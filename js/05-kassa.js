/* ── касса: человек по коду пропуска ────────────────────
   Цепочка экранов (staff → tillPerson → tillMembership | tillTopup), чтобы системная
   «назад» Telegram вела с формы к карточке, а с карточки — к скану: у
   вкладки staff своей записи в BACK нет, и состояние внутри одного экрана
   «назад» не получило бы вовсе (кадры E34, designer-55).
   member_id из by-pass — это tg_user_id человека. Он живёт только здесь,
   в памяти, на время одной операции: не в разметку, не в data-атрибуты,
   не во флэш и не в хранилище. Репозиторий публичный — tools/ids-clean.cjs.
   Цен членства на сервере нет: сумму называет касса, подсказки нет, пока
   владелец не назовёт прейскурант. Срок — тоже касса, 1…24 по серверу. */
var TP = { code: '', who: null, gen: 0, busy: false, deny: '', kind: '',
           level: 'member', months: '', amount: '', method: 'cash', err: '', done: null };

function tillReset() {
  TP.gen++; TP.who = null; TP.busy = false; TP.deny = ''; TP.done = null; TP.err = '';
}

// Ответ by-pass → карточка. Чего не хватает — отказ целиком: человек с
// пустым именем или остаток 0 вместо неразобранного выглядели бы найденными.
function fromTillPerson(d, code) {
  if (!d || typeof d !== 'object' || typeof d.member_id !== 'number') return null;
  if (typeof d.first_name !== 'string' || typeof d.membership_active !== 'boolean') return null;
  var bal = num(d.balance), ms = d.membership, until = null, lifelong = false;
  if (!isFinite(bal)) return null;
  if (d.membership_active) {
    if (!ms || typeof ms !== 'object' || !LEVEL[ms.level] || typeof ms.lifelong !== 'boolean') return null;
    lifelong = ms.lifelong;
    if (!lifelong && !(until = ms.ends_at ? ruDate(ms.ends_at) : null)) return null;
  }
  var m = /^(?:XIII-)?(\d{4})$/.exec(code.trim().toUpperCase());
  return { id: d.member_id,
           name: [d.first_name, typeof d.last_name === 'string' ? d.last_name : ''].filter(Boolean).join(' ') || 'Без имени',
           code: m ? 'XIII-' + m[1] : code.trim().toUpperCase(),
           level: d.membership_active ? ms.level : '', until: until, lifelong: lifelong, balance: bal };
}

// Ответ сервера с текстом — текст дословно, с заглавной; иначе — код ответа.
function said(r) {
  var t = detailOf(r);
  return t ? t[0].toUpperCase() + t.slice(1) : failText(r);
}

/* Найти по коду. Ответ, вернувшийся после «следующего человека» или смены
   человека в тестовом режиме, молчит: иначе карточка прежнего встала бы
   под новым кодом. done(rec | null, r) — для перечитывания после приёма. */
function tillLookup(code, done) {
  var gen = TP.gen;
  api('GET', '/till/by-pass/' + encodeURIComponent(code.trim())).then(function (r) {
    if (gen !== TP.gen) return;
    done(r.status === 200 ? fromTillPerson(r.data, code) : null, r);
  });
}

function tillFind(code) {
  if (TP.busy) return;
  TP.code = String(code || '').trim();
  if (!TP.code) return;
  tillReset(); TP.busy = true;
  render();
  tillLookup(TP.code, function (rec, r) {
    TP.busy = false;
    if (rec) { TP.who = rec; haptic('ok'); go('tillPerson'); return; }
    TP.deny = r.status === 200 ? 'Ответ сервера не разобран.' : said(r);
    haptic('warn');
    if (current === 'staff') render();
  });
}

function tillPrep(kind) {
  TP.kind = kind === 'membership' ? 'membership' : 'topup';
  TP.months = ''; TP.amount = ''; TP.err = ''; TP.deny = '';
  TP.level = TP.who.level || 'member';
  TP.method = 'cash';
}
function tillOpen(kind) {
  if (!TP.who) return;
  tillPrep(kind);
  go(TP.kind === 'membership' ? 'tillMembership' : 'tillTopup');
}

var PAY_HOW = { cash: 'наличными', card: 'картой', account: 'со счёта' };

/* 201 с разобранным, но не совпавшим телом (Cafe13KPG#351, кадры E34k/E34l).
   Развилка — не тяжесть, а есть ли что поставить РЯДОМ с введённым:
   человек разошёлся → E34l (значений нет: member_id — это tg_user_id);
   вид, сумма, уровень разошлись и ответ печатаем → E34k, одна пара;
   печатать нечего (тела нет, membership не пришёл, сумма не число, вид или
   уровень незнакомы) → null, остаётся E34z. Срок в пару не идёт: кассир
   вводит месяцы, сервер отвечает датой (месяцев в ответе нет вовсе). Пара
   выбирается по причине, а не по следствию — вид, сумма, уровень: другой вид
   почти всегда несёт и другую сумму. Слова — те же словари, что у дня
   кассы и карточки (TD_KIND, LEVEL), второй словарь разошёлся бы молча. */
function tillOdd(d, sent) {
  if (!d || typeof d !== 'object') return null;
  if (d.member_id != null && d.member_id !== sent.who) return { person: true };
  var ms = d.membership;
  var pair = d.kind !== sent.kind
      ? (TD_KIND[d.kind] ? ['kind', TD_KIND[sent.kind], TD_KIND[d.kind]] : null)
    : num(d.amount) !== sent.amt
      ? (isFinite(num(d.amount)) ? ['amount', money(sent.amt) + ' ฿', money(num(d.amount)) + ' ฿'] : null)
    : sent.kind === 'membership' && ms && typeof ms === 'object' && ms.level !== sent.level
      ? (LEVEL[ms.level] ? ['level', LEVEL[sent.level], LEVEL[ms.level]] : null)
    : null;
  return pair && { mine: pair[1], theirs: pair[2], id: Number.isInteger(d.id) ? d.id : null };
}

function tillSend() {
  if (TP.busy || !TP.who) return;
  var who = TP.who, kind = TP.kind, level = TP.level, method = TP.method, amt = topupAmount(TP.amount);
  var months = /^\d{1,2}$/.test(TP.months.trim()) ? Number(TP.months.trim()) : 0;
  TP.err = kind === 'membership' && (months < 1 || months > 24) ? 'Срок — целое число месяцев, от 1 до 24.'
         : amt === null ? 'Сумма — число больше нуля, например 500.' : '';
  TP.deny = '';
  if (TP.err) { render(); return; }
  var body = { kind: kind, amount: amt, method: method, member_id: who.id };
  if (kind === 'membership') { body.level = level; body.months = months; }
  else if (method === 'account') return;            // у пополнения этой кнопки нет
  TP.busy = true;
  render();
  var gen = TP.gen;
  api('POST', '/till', body).then(function (r) {
    if (gen !== TP.gen) return;
    var d = r.data, ms = d && d.membership;
    var ok = r.status === 201 && !!d && d.kind === kind && num(d.amount) === amt && d.member_id === who.id &&
             (kind !== 'membership' || !!ms && ms.level === level && !!ruDate(ms.ends_at));
    if (r.status !== 0 && r.status !== 201) {
      TP.busy = false; TP.deny = said(r); haptic('warn'); render(); return;
    }
    // Принято или неизвестно — карточка перечитывается в обоих случаях:
    // остаток после оплаты со счёта иначе остался бы прежним, то есть ложным.
    tillLookup(who.code, function (rec) {
      TP.busy = false;
      if (ok) {
        var now = rec || Object.assign({}, who, { balance: null });
        if (kind === 'membership') {
          now.level = ms.level; now.until = ruDate(ms.ends_at); now.lifelong = false;
        }
        TP.who = now;
        var grew = kind !== 'topup' || !rec || Math.abs(rec.balance - who.balance - amt) < 0.005;
        TP.done = { kind: kind, text: 'Принято ' + money(amt) + ' ฿ ' + PAY_HOW[method],
                    /* Совет по виду строки и состоянию — четыре кадра (Cafe13KPG#374, #381, карточка
                       #373). В till.cancel привратник хозяина (409 «правки членства … нет») стоит
                       раньше субъектного: строку с членством в приложении не снимает никто — E34g,
                       «к администратору клуба». У пополнения хозяина нет, и снять его может тот, кто
                       принял, на «Дне кассы» — E34m; общая фраза отправляла бы его от стойки.
                       ⚠ Совет E34m исполним только здесь: итог читает тот, кто ТОЛЬКО ЧТО принял, и
                       субъектный привратник («…принял другой человек: отменяет он сам») для него не
                       срабатывает. Там, где строку читает другой (список «Дня кассы», отчёт), эта
                       фраза — ложь того же рода, что снятая в шаге 1; туда её не переносить.
                       Ветви: `kind` здесь — TP.kind, а он только 'membership' или 'topup' (tillOpen),
                       и ok требует d.kind === kind; третьего вида в эту развилку не приходит.
                       E34m — только у ЧИСТОГО приёма: карточка перечитана (rec) и остаток вырос на
                       сумму (grew). Проверок две, потому что grew при rec = null — истина
                       (`|| !rec` выше). Не вырос (!grew бывает только у topup с rec) — E34n, без
                       адреса: адрес несёт плашка «Не вносите снова — сверьте с администратором
                       клуба», и второй, расплывчатее, заставил бы гадать, одно это поручение или два.
                       Не перечитан — E34o, то есть E34g с адресом: у плашки «Перечитать» адреса нет.
                       «Внесите заново» в обоих не-чистых спорило бы с плашкой или с #333. */
                    note: kind === 'topup' && rec && grew
                      ? 'Строка ушла в книгу клуба. Исправить задним числом нельзя — ошиблись, отмените её на «Дне кассы» и внесите заново.'
                      : !grew
                      ? 'Строка ушла в книгу клуба. Исправить задним числом нельзя.'
                      : 'Строка ушла в книгу клуба. Исправить задним числом нельзя. Ошиблись — к администратору клуба.',
                    warn: grew ? '' : 'Остаток изменился не на эту сумму: было ' + money(who.balance) +
                                      ' ฿. Не вносите снова — сверьте с администратором клуба.' };
        haptic(grew ? 'ok' : 'warn');
      } else {
        // прежний остаток не показывается как нынешний: его могли уже списать
        TP.who = rec || Object.assign({}, who, { balance: null });
        /* Два исхода с ПРОТИВОПОЛОЖНЫМ советом (Cafe13KPG#333, кадры E34zh/E34z/E34i,
           слова координатора). Ответа не было (status 0) — прошло или нет,
           неизвестно. 201 — транзакция закоммичена, строка в книге уже есть, и
           «неизвестно» звало бы ко второму приёму: второе членство ДОБАВЛЯЕТ
           период, второе пополнение — деньги. Причину непрохождения ok при 201
           (тело не разобрано / не совпало) делит tillOdd (#351, E34k/E34l). */
        var odd = r.status === 201 ? tillOdd(d, { who: who.id, kind: kind, amt: amt, level: level }) : null;
        var ms0 = who.level ? (who.lifelong ? 'членство пожизненно' : 'членство до ' + who.until) : 'членства нет';
        TP.done = odd && odd.person
          ? { kind: '', unsure: true, sent: true, reread: !!rec, person: true, text: 'Проведено, а человек в ответе не тот',
              before: 'Перед приёмом: ' + ms0 + ', остаток ' + money(who.balance) + ' ฿',
              note: 'Сервер ответил «принято» — строка в книге клуба уже есть. Но человек в ответе не тот, кого вы открыли, ' +
                    'и чья это строка — по ответу не сказать. Второй раз не принимайте: повтор дал бы вторую строку.' }
          : odd
          ? { kind: '', unsure: true, sent: true, reread: !!rec, odd: odd, text: 'Проведено не то, что вводили',
              note: 'Сервер ответил «принято» — строка в книге клуба уже есть. Второй раз не принимайте: повтор дал бы в книге вторую строку.' }
          : r.status === 201
          ? { kind: '', unsure: true, sent: true, reread: !!rec, text: 'Деньги проведены',
              before: 'Перед приёмом: ' + ms0 + ', остаток ' + money(who.balance) + ' ฿',
              note: 'Сервер ответил «принято» — строка в книге клуба уже есть. Что в ней записано, по ответу подтвердить нечем: ' +
                    'ни сумму, ни срок. Второй раз не принимайте: повтор дал бы в книге вторую строку.' }
          : { kind: '', unsure: true, sent: false, reread: !!rec, text: 'Неизвестно, принято ли',
              before: 'Перед приёмом: ' + ms0 + ', остаток ' + money(who.balance) + ' ฿',
              note: 'Ответ сервера не дошёл.' };
        haptic('warn');
      }
      go('tillPerson');
    });
  });
}

function tillForm(kind) {
  var w = TP.who;
  if (!w || TP.kind !== kind) return '<div class="card quiet"><span class="small">Человек не выбран.</span></div>' +
    '<button type="button" class="btn" data-go="staff">К скану пропуска</button>';
  var lock = TP.busy ? ' disabled' : '', mem = kind === 'membership';
  var seg = function (act, list, on) {
    return list.map(function (x) {
      return '<button type="button" data-action="' + act + ':' + x[0] + '"' + (on === x[0] ? ' aria-pressed="true"' : '') + lock + '>' + x[1] + '</button>';
    }).join('');
  };
  var ways = [['cash', 'Наличные'], ['card', 'Карта']].concat(mem ? [['account', 'Со счёта']] : []);
  return (!LIVE && FLASH ? flash() : '') +
    '<div class="card quiet"><div class="row"><div class="col"><span class="small">Кому</span><b>' + esc(w.name) + '</b></div>' +
      '<span class="small num">' + esc(w.code) + '</span></div></div>' +
    (mem ? '<div class="group"><span class="label">Вид членства</span><div class="seg wrap">' +
             seg('tp-level', [['member', LEVEL.member], ['organizer', LEVEL.organizer], ['partner', LEVEL.partner]], TP.level) + '</div></div>' +
           '<div class="group"><span class="label">Срок</span><div class="field"><label for="tp-months">Месяцев</label>' +
             '<input id="tp-months" type="text" inputmode="numeric" autocomplete="off" value="' + esc(TP.months) + '"' + lock + '></div>' +
             '<span class="small">От 1 до 24.</span></div>' : '') +
    '<div class="field"><label for="tp-amount">Сумма, ฿</label>' +
      '<input id="tp-amount" type="text" inputmode="decimal" autocomplete="off" value="' + esc(TP.amount) + '"' + lock + '>' +
      '<span class="small">' + (mem ? 'Цену называет касса: прейскуранта на сервере нет.' : 'Сумму называет человек у стойки.') + '</span></div>' +
    '<div class="group"><span class="label">Чем платят</span><div class="seg">' + seg('tp-method', ways, TP.method) + '</div></div>' +
    (TP.err ? '<span class="small" style="color:var(--clay)">' + esc(TP.err) + '</span>' : '') +
    (TP.deny ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TP.deny) + '</span></div>' : '') +
    '<button type="button" class="btn" data-action="tp-send"' + lock + '>' + (TP.busy ? 'Вносим…' : 'Внести') + '</button>' +
    (mem ? '' : '<div class="note">' + svg(ICON.info) + '<span>Перевести со счёта на счёт нельзя — только наличные или карта.</span></div>');
}

function tillCard(w) {
  var ms = w.level ? (w.lifelong ? 'Пожизненно' : 'до ' + w.until) : 'нет';
  return '<div class="card strong"><div class="row top"><div class="col"><h2>' + esc(w.name) + '</h2>' +
      '<span class="small num">Пропуск ' + esc(w.code) + '</span></div>' +
      '<span class="pill' + (w.level ? ' on' : '') + '">' + esc(w.level ? LEVEL[w.level] : 'Членства нет') + '</span></div>' +
    '<div class="rows"><div><span class="small">Членство</span><b class="num">' + esc(ms) + '</b></div>' +
      '<div><span class="small">На счёте</span><b class="num">' +
        (w.balance === null ? 'не перечитан' : money(w.balance) + ' ฿') + '</b></div></div></div>';
}

/* ── касса: день (кадры E36/E36b/E36v, Cafe13KPG#340) ──────
   GET /till/day — книга суток клуба без затрат; POST /till/{id}/cancel —
   отмена строки, она встаёт НОВОЙ строкой, отменённая остаётся видимой.
   Кнопка стоит у КАЖДОЙ живой строки, и чужой тоже: у строки с хозяином
   (заказ бара, членство, запись) сервер отвечает 409 и называет путь
   исправления, и этот отказ стоит ПЕРЕД отказом «принял другой». Спрятав
   кнопку по by_staff_id, экран спрятал бы путь именно там, где он есть
   (слово designer-55). by_staff_id и member_id — tg_user_id; из разбора
   они не выходят вовсе. */
var TD = { gen: 0, data: null, fail: '', ask: -1, busy: -1, deny: null };
var TD_KIND = { membership: 'Членство', topup: 'На счёт', event: 'За запись', service: 'За услугу' };
var TD_HOW = { cash: 'наличные', card: 'карта', account: 'со счёта' };

/* Отказ отмены — словами сервера как есть, у всех четырёх видов хозяина.
   До выкладки api `02f0ac6` сервер у строки ЗАПИСИ обещал «деньги вернутся
   вместе с ней», а возврата нет, и клиент подменял этот текст (Cafe13KPG#340).
   На бою `02f0ac6` сервер говорит правду сам (`till.py`: «возврата за запись в
   приложении пока нет…»), подмена снята — о выкладке сказал сторож батареи. */

// Строка без чего-нибудь нужного — отказ целиком: день с выпавшей строкой
// выглядит полным. Итог, не сходящийся со строками, снимает только ЧИСЛА
// (итог и суммы по способу — производные), а строки остаются: они печатаются
// из ответа дословно (кадр E36g, designer-55).
function fromTillDay(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.rows) || typeof d.count_live !== 'number') return null;
  var total = num(d.total_live), rows = [], sum = 0, live = 0, by = { cash: 0, card: 0, account: 0 };
  if (!isFinite(total)) return null;
  for (var i = 0; i < d.rows.length; i++) {
    var r = d.rows[i], amt = r && num(r.amount);
    if (!r || typeof r.id !== 'number' || !TD_KIND[r.kind] || !TD_HOW[r.method] || !(amt >= 0) || !hm(r.at)) return null;
    if ((r.cancels_id !== null && typeof r.cancels_id !== 'number') ||
        (r.cancelled_by !== null && typeof r.cancelled_by !== 'number') ||
        (r.note !== null && typeof r.note !== 'string')) return null;
    // заметка строки — дословно и только у услуги: «заказ бара N» там
    // соглашение, а не схема, его может набрать и кассир (designer-55)
    var row = { id: r.id, kind: r.kind, amount: amt, time: hm(r.at), how: TD_HOW[r.method],
                note: r.kind === 'service' && r.note ? r.note : '',
                undo: r.cancels_id !== null, gone: r.cancelled_by !== null };
    if (!row.undo && !row.gone) { live++; sum += amt; by[r.method] = Math.round((by[r.method] + amt) * 100) / 100; }
    rows.push(row);
  }
  return { rows: rows, total: total, count: live, by: by,
           odd: live !== d.count_live || Math.abs(sum - total) > 0.005 };
}

function tillDayLoad() {
  var gen = ++TD.gen;
  TD.fail = '';
  api('GET', '/till/day').then(function (r) {
    if (gen !== TD.gen) return;
    var d = r.status === 200 ? fromTillDay(r.data) : null;
    if (d) TD.data = d;
    else TD.fail = r.status === 200 ? 'Ответ сервера не разобран.' : said(r);
    if (current === 'tillDay') render();
  });
}

function tillCancel(i) {
  var row = TD.data && TD.data.rows[i];
  if (!row || row.undo || row.gone || TD.busy !== -1) return;
  TD.busy = i; TD.ask = -1; TD.deny = null;
  render();
  var gen = TD.gen;
  api('POST', '/till/' + row.id + '/cancel').then(function (r) {
    if (gen !== TD.gen) return;
    TD.busy = -1;
    var ok = r.status === 201 && !!r.data && r.data.cancels_id === row.id;
    // Отказ — словами сервера, над той строкой, у которой нажали.
    if (r.status !== 0 && r.status !== 201) { TD.deny = { i: i, text: said(r) }; haptic('warn'); render(); return; }
    // Отменено или неизвестно — день перечитывается в обоих случаях: что
    // строка отменена, говорит перечитанная книга, а не ответ на нажатие.
    if (ok) haptic('ok');
    else TD.deny = { i: i, text: (r.status === 0 ? 'Ответ сервера не дошёл. ' : 'Ответ сервера не разобран. ') +
                                 'Смотрите строку после перечитывания: «Отменено» стоит — отмена прошла.' };
    tillDayLoad();
    render();
  });
}

function tillDayRow(r, i) {
  var label = (r.undo ? 'Отмена · ' : '') + TD_KIND[r.kind];
  var when = r.time + ' · ' + r.how;
  var note = r.note ? '<span class="verbatim">' + esc(r.note) + '</span>' : '';
  var deny = TD.deny && TD.deny.i === i ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(TD.deny.text) + '</span></div>' : '';
  if (r.gone) return deny + '<div class="card cancelled"><div class="row"><div class="col"><b class="strike">' + esc(label) + '</b>' +
    '<span class="small num">' + esc(when) + '</span></div><span class="pill gold">Отменено</span></div></div>';
  if (r.undo) return deny + '<div class="card quiet"><div class="row"><div class="col"><b>' + esc(label) + '</b>' +
    '<span class="small num">' + esc(when) + '</span></div><b class="num">−' + money(r.amount) + ' ฿</b></div></div>';
  var btn = TD.busy === i ? '<button type="button" class="btn quiet" disabled>…</button>'
    : TD.ask === i ? '<span class="row" style="gap:6px"><button type="button" class="btn quiet" data-action="td-keep">Не отменять</button>' +
                     '<button type="button" class="btn quiet" data-action="td-cancel:' + i + '">Точно отменить</button></span>'
    : '<button type="button" class="btn quiet" data-action="td-ask:' + i + '"' + (TD.busy !== -1 ? ' disabled' : '') + '>Отменить</button>';
  return deny + '<div class="card"><div class="row"><div class="col"><b>' + esc(label) + '</b><span class="small num">' + esc(when) + '</span>' + note + '</div>' +
    '<div style="display:flex;align-items:center;gap:10px"><b class="num">' + money(r.amount) + ' ฿</b>' + btn + '</div></div></div>';
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
    var detail = detailOf(r);
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
      var detail = detailOf(r);
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
      var detail = detailOf(r);
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
    var detail = detailOf(r);
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
    /* Половина `current !== 'barOrder'` недостижима (мутация зелёная, 22.10.2026):
       current пишет только go(), а go() на входе в barOrder зовёт pollMine и
       поднимает POLL_GEN — поздний ответ ловит вторая половина; MINE_FAIL и
       DATA.bar.mine рисуются только на barOrder; switchTo гасит таймер и
       поднимает POLL_GEN. ОЖИВЁТ, если: в barOrder войдут мимо go() (или go
       перестанет звать pollMine); свой заказ начнут рисовать на другом экране
       (плашка «заказ готов» в шапке, на вкладке «Бар»); pollMine перестанет
       поднимать POLL_GEN на входе. Тогда — случай на неё. */
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

var ME_GEN = 0;
function refreshMe() {
  // поздний ответ прежнего перечитывания молчит: свежее уже в пути
  var gen = ++ME_GEN;
  api('GET', '/me').then(function (r) {
    if (gen !== ME_GEN) return;
    var me = r.status === 200 ? fromMe(r.data) : null;
    // не ответил — остаток остаётся прежним, а не обнуляется: известное не затирается пустым (Cafe13KPG#638)
    if (!me || !DATA.member) return;
    var was = DATA.member.balance;
    DATA.member.balance = me.member.balance;
    if (was === me.member.balance) return;
    // форма мастера держит набранное в полях — забрать его ДО перерисовки, иначе текст пропадёт
    if (current === 'masterApply') msfGrab();
    // экраны, где остаток считает что-то кроме шапки, — целиком; остальные — только шапка (остаток в ней)
    // остаток сменился — «хватит ли» на продление спросить у сервера заново (предпросмотр — снимок, не обещание)
    if (current === 'masterRenew') RNW.key = '';
    if ({ bar: 1, topup: 1, barOrder: 1, barCart: 1, drink: 1, home: 1, masterApply: 1, masterRenew: 1, event: 1 }[current]) render();
    else { var right = document.getElementById('bar-right'); if (right) right.innerHTML = barRight(); }
  });
}
/* Возврат в приложение — перечитать остаток (слово владельца 29.10.2026: «деньги у члена клуба появляются
   только после перезегрузки приложения. Нужно бесшовно», Cafe13KPG#638). Сервер событие в открытое
   приложение не толкает, поэтому «бесшовно» = «как только человек вернулся», а не «в ту же секунду». Таймера
   нет нарочно: шум запросов ради того, кто смотрит в открытое приложение и ждёт (решение координатора).
   Признаков возврата три, и они приходят парой: `visibilitychange` браузера, `focus` окна и `activated`
   Telegram (Bot API 8.0; в живом Telegram не мерено). Поэтому чаще раза в 2 с не спрашиваем. */
var BACK_AT = 0;
// приложение ушло в фон в окне с политикой 'cancel' — не отправлять: таймер в фоне мог бы сработать
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden' && UNDO.key && UNDO.leave === 'cancel') { undoStop(); if (current === 'masterRenew') render(); }
});
function onReturn() {
  if (!LIVE || noEntry() || document.visibilityState === 'hidden') return;
  var now = Date.now();
  if (now - BACK_AT < 2000) return;
  BACK_AT = now;
  refreshMe();
  // своя история пополнений на экране пополнения — тоже снимок момента входа
  if (current === 'topup' && !(TEST.on && TEST.as)) loadTopups();
}
document.addEventListener('visibilitychange', onReturn);
window.addEventListener('focus', onReturn);

/* ── тестовый режим и просмотр чужими глазами ─────────
   Только у богов (солнышко). X-Test-Mode: 1 — запрос обслуживает тестовая
   база: нажимать можно всё, настоящих денег там нет. X-Act-As: id — ответ
   собирается так, как его увидел бы этот человек; без тестового режима
   сервер его отвергает. Кто сейчас на экране и что база тестовая, видно
   полосой над каждым экраном — иначе запись глазами куратора легко
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
    var detail = detailOf(r);
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
      var detail = detailOf(r);
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
    tillReset();
    peopleReset(); PEOPLE.card = null; PEOPLE.list = null; PEOPLE.fail = ''; PEOPLE.gen++;
    cardReset(); CARDS.list = null; CARDS.fail = ''; CARDS.gen++;
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

