/* ── карточки меню: конструктор и утверждение ──────────  #175
   Бар заводит карточку черновиком, пишет рецепт и отправляет на утверждение;
   куратор ставит её в меню или возвращает с причиной. Ручки — cafe13-api
   bar.py: POST /bar/products, …/recipe, …/state и очередь GET /bar/products.
   ⚠ Очередь без state не отдаёт hidden — просим все четыре явно, иначе
   «снятых нет» значило бы «не спрашивали».
   ⚠ Группы раскладываются здесь, а не порядком ответа: очередь куратора
   обязана стоять сверху при любой сортировке сервера.
   ⚠ Правка — только у ЧЕРНОВИКА (`PATCH /bar/products/{id}`, cafe13-api#147, шаг 15): в теле только
   изменённые поля, замечание куратора правка не стирает. Рецепт языка ЗАМЕНЯЕТСЯ, а не добавляется версией.
   ⚠ Шаг 15 (Cafe13KPG#546, рецепт `_docs/recept/ekran/15/`): карточки ведёт и РАБОТНИК бизнеса (`worker`) —
   направление тогда из его РОЛИ, а не из `BAR`: `fromDirections` ищет клубный бар литералом названия, а бизнес
   партнёра зовётся словом его заявки. Вне черновика работнику сервер не отдаёт даже чтения рецепта (403), поэтому
   группы «Рецепт» у него там нет вовсе. Экран знает ОДИН бизнес: с двумя ролями `worker` — первая.
   ⚠ «В меню» без рецепта откажет триггер базы; экран знает про рецепт по
   полю recipes и гасит кнопку заранее. Отказы — текстом сервера. */
var CARD_STATES = ['draft', 'review', 'active', 'hidden'];
var CARD_LANGS = [['ru', 'RU'], ['en', 'EN'], ['th', 'TH']];
var CARD_FIELDS = ['c-title', 'c-group', 'c-price', 'c-mins', 'c-about'];
var CARDS = { list: null, fail: '', gen: 0, from: '', dir: null, lost: false, partner: false };   // partner — вошёл дверью партнёра (шаг 16)   // dir — { id, title } направления карточек
var CARD = { v: {}, alcohol: false, lang: 'ru', text: {}, body: {}, err: '', deny: '', note: '',
             busy: false, back: false, reason: '', hideAsk: false, groupAsk: '', edit: 0, carry: null, press: '' };   // edit — номер черновика в правке
// carry — что переживает переход с предпросмотра на рождённую карточку (шаг 44): заметка, отказ и НЕСОХРАНЁННЫЕ рецепты;
// press — какая из двух кнопок предпросмотра нажата ('add' | 'off'), чтобы «Сохраняем…» стояло на ней, а не на обеих

function cardReset() {
  CARD.v = {}; CARD.alcohol = false; CARD.lang = 'ru'; CARD.text = {}; CARD.body = {}; CARD.err = '';
  CARD.deny = ''; CARD.note = ''; CARD.back = false; CARD.reason = ''; CARD.hideAsk = false; CARD.groupAsk = ''; CARD.edit = 0;
  CARD.carry = null; CARD.press = '';
}
function mayCards() { return LIVE && (grant('admin') || grant('bar') || grant('curator') || grant('worker') || !!cardPartnerDir()); }
// шаг 16 (Cafe13KPG#547): партнёр — по ВЛАДЕНИЮ направлением (`GET /partner/directions`), не по роли. Первый бизнес:
// переключателя в 0.2 нет, как у работника
function cardPartnerDir() { var d = (BW.dirs || [])[0]; return d ? { id: d.id, title: d.title } : null; }
function cardPartner() { return !!CARDS.dir && (BW.dirs || []).some(function (d) { return d.id === CARDS.dir.id; }); }
// только партнёр ЭТОГО направления: не бар, не куратор и не работник его — решает, но карточку не ведёт
function cardPartnerOnly() { var w = cardWorkerDir(); return LIVE && cardPartner() && !cardBarSide() && !(w && CARDS.dir && w.dir === CARDS.dir.id); }
// замечание возврата: «Вернуть» и подпись — на ВВОДЕ, без перерисовки (как prNoteSync), иначе набор терял бы фокус
function cardReasonSync() {
  var f = document.getElementById('c-reason'); if (!f) return;
  CARD.reason = f.value;
  var empty = !CARD.reason.trim(), b = document.querySelector('#view [data-action^="c-back-send:"]');
  if (b) b.disabled = empty || CARD.busy;
  var w = document.getElementById('c-reason-why'), l = document.getElementById('c-reason-last');
  if (w) w.hidden = !empty; if (l) l.hidden = empty;
}
document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'c-reason') cardReasonSync(); });
// свои направления для двери на «Клубе» — только список: выбор бизнеса и работники — дело экрана шага 14
function loadPartnerDirs() {
  if (!LIVE) return;
  api('GET', '/partner/directions').then(function (r) {
    var l = r.status === 200 ? fromMyBiz(r.data) : null;
    if (!l) return;
    // шаг 20: свежий список ЗАМЕНЯЕТ прежний — в нём остаток счёта, и на «Клубе» он не должен замёрзнуть
    BW.dirs = l;
    if (current === 'home') { loadPartnerCards(); render(); }
  });
}
// счётчик двери «Карточки на согласовании»: по СПИСКУ (`review`), null — не посчитано, а не ноль
var PCARDS = { n: null, gen: 0 };
function loadPartnerCards() {
  var d = cardPartnerDir(); if (!LIVE || !d) return;
  var gen = ++PCARDS.gen;
  api('GET', '/bar/products?direction_id=' + d.id + '&state=review').then(function (r) {
    if (gen !== PCARDS.gen) return;
    var l = r.status === 200 ? fromCards(r.data) : null;
    PCARDS.n = l ? l.filter(function (c) { return c.state === 'review'; }).length : null;
    if (current === 'home') render();
  });
}
// роль работника с направлением — первая: переключателя бизнесов в 0.2 нет (слово владельца)
function cardWorkerDir() {
  return (DATA.grants || []).filter(function (g) { return g.role === 'worker' && typeof g.dir === 'number'; })[0] || null;
}
// направление из РОЛИ — когда пришли дверью работника («Услуги») или барной стороны у человека нет вовсе
function cardsByRole() {
  return !!cardWorkerDir() && (CARDS.from === 'guest' || !(grant('admin') || grant('bar') || grant('curator')));
}
function cardCurator() { return !!CARDS.dir && (grant('admin') || grant('curator', CARDS.dir.id) || cardPartner()); }
// барная сторона ЭТОГО направления; без неё зритель — работник: ведёт карточку, пока она черновик
function cardBarSide() { return !!CARDS.dir && (grant('admin') || grant('bar', CARDS.dir.id) || grant('curator', CARDS.dir.id)); }
function cardWorkerOnly() { return LIVE && !cardBarSide(); }
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
  CARDS.fail = ''; CARDS.lost = false;
  var show = function () { if (current === 'barCards' || current === 'barCard') render(); };
  var go2 = function (dir) {
    // другое направление — прежний список не его: не показывать чужие карточки до ответа
    if (CARDS.dir && CARDS.dir.id !== dir.id) CARDS.list = null;
    CARDS.dir = dir;
    api('GET', '/bar/products?direction_id=' + dir.id + '&state=' + CARD_STATES.join(',')).then(function (r) {
      if (gen !== CARDS.gen || who !== WHO) return;
      var list = r.status === 200 ? fromCards(r.data) : null;
      if (list) CARDS.list = list;
      else { CARDS.list = null; CARDS.fail = r.status === 403 ? denyText(r) : failText(r); }
      show();
    });
  };
  // партнёр — направление и название из `GET /partner/directions`: слово сервера, не литерал
  if (CARDS.partner && cardPartnerDir()) { go2(cardPartnerDir()); return; }
  if (cardsByRole()) {
    var w = cardWorkerDir();
    // название бизнеса — словом сервера: `GET /directions` открыта любому допущенному
    api('GET', '/directions').then(function (r) {
      if (gen !== CARDS.gen || who !== WHO) return;
      var all = r.status === 200 && Array.isArray(r.data) ? r.data : null;
      if (!all) { CARDS.list = null; CARDS.fail = r.status === 403 ? denyText(r) : failText(r); show(); return; }
      var d = all.filter(function (x) { return x && x.id === w.dir && typeof x.title === 'string'; })[0];
      // роль пережила закрытие направления — состояние законное, молчать о нём нельзя
      if (!d) { CARDS.list = null; CARDS.dir = null; CARDS.lost = true; show(); return; }
      go2({ id: d.id, title: d.title });
    });
    return;
  }
  if (BAR) { go2({ id: BAR.id, title: BAR.title }); return; }
  loadBar(function (err) {
    if (gen !== CARDS.gen) return;
    if (err) { CARDS.fail = err; show(); return; }
    go2({ id: BAR.id, title: BAR.title });
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
  // форма заведения (шаг 44): рецепт всех трёх языков сразу — по полю на язык, а не переключателем
  CARD_LANGS.forEach(function (l) { var r = document.getElementById('c-rec-' + l[0]); if (r) CARD.text[l[0]] = r.value; });
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
// группа меню: та же без регистра — берём заведённую; похожая — спрашиваем. null — вопрос задан, ждём ответа
function cardGroup(sure) {
  var g = CARD.v['c-group'].trim().replace(/\s+/g, ' ');
  var same = groupsOf().filter(function (x) { return x.toLowerCase() === g.toLowerCase(); })[0];
  var like = groupsOf().filter(function (x) { return groupKey(x) === groupKey(g); })[0];
  if (same) g = same;
  else if (like && !sure) { CARD.groupAsk = like; render(); return null; }
  if (sure === 'theirs') g = CARD.groupAsk;
  CARD.groupAsk = '';
  return g;
}
/* Шаг 44 (рецепт `_docs/recept/ekran/44/barCard.md`, слово владельца 26.11): форма со всем → «Создать» →
   предпросмотр → «Добавить в меню» | «Создать выключенной». «Создать» запроса НЕ шлёт: своя проверка формы и вопрос
   «та же группа?» — здесь, а карточка рождается только кнопкой предпросмотра. Группа на предпросмотре — уже сведённая
   к заведённой, поэтому гость видит ту строку, под которой позиция встанет. */
function cardPreview(sure) {
  if (CARD.busy || !CARDS.dir) return;
  grabCard();
  CARD.deny = '';                             // прошлый отказ сервера не висит рядом с новым своим
  CARD.err = cardMissing();
  if (CARD.err) { haptic('warn'); render(); return; }
  var g = cardGroup(sure);
  if (g === null) return;
  CARD.v['c-group'] = g;
  haptic();
  go('barCard', 'preview');
}
// языки с непустым рецептом — по порядку CARD_LANGS; «в меню» без хотя бы одного не пустит база (триггер 009, №100 «а»)
function cardRecipeLangs() {
  return CARD_LANGS.map(function (l) { return l[0]; }).filter(function (l) { return !!(CARD.text[l] || '').trim(); });
}
function cardNewBody() {
  var body = { direction_id: CARDS.dir.id, group: CARD.v['c-group'], title: CARD.v['c-title'].trim(),
               price: Number(String(CARD.v['c-price']).replace(',', '.')),
               about: (CARD.v['c-about'] || '').trim(), is_alcohol: CARD.alcohol };
  var m = String(CARD.v['c-mins'] || '').trim();
  if (m) body.mins = +m;
  return body;
}
/* Цепочка рождения: POST /bar/products (сервер заводит ТОЛЬКО черновиком, bar.py create_product) → рецепт на каждый
   заполненный язык → для «в меню» смена состояния: active партнёру (№99 «б», тот же признак, что c-approve у черновика),
   review остальным. ⚠ После 201 карточка УЖЕ есть: обрыв дальше не прячется — открывается сама карточка, заметка
   говорит, что сделано, отказ — печатью, а несохранённые рецепты переезжают в её поле (carry), чтобы не пропасть. */
function cardCreate(menu) {
  if (CARD.busy || !CARDS.dir || cardMissing()) return;
  var langs = cardRecipeLangs();
  if (menu && !langs.length) return;          // кнопка погашена; Telegram-кнопки в этом состоянии нет (mainFor)
  var body = cardNewBody(), target = menu ? (cardPartnerOnly() ? 'active' : 'review') : '';
  var text = {}; langs.forEach(function (l) { text[l] = CARD.text[l].trim(); });
  // сторож цепочки — ЛИЧНОСТЬ (WHO), не свежесть списка (CARDS.gen): после 201 карточка уже есть на сервере, и уход в
  // список (loadCards двигает gen) не должен молча терять её рецепты; при смене личности цепочка обрывается
  var who = WHO;
  CARD.busy = true; CARD.press = menu ? 'add' : 'off'; CARD.deny = ''; CARD.err = ''; render();
  api('POST', '/bar/products', body).then(function (r) {
    if (who !== WHO) { CARD.busy = false; return; }
    var ok = r.status === 201 && r.data && typeof r.data.id === 'number' && r.data.state === 'draft';
    if (!ok) { CARD.busy = false; CARD.press = ''; CARD.deny = denyText(r); haptic('warn'); render(); return; }
    var id = r.data.id, saved = [];
    // карточка из ответа — до перечитывания, чтобы экран не моргнул «не найдена»
    CARDS.list = (CARDS.list || []).concat([{ id: id, title: body.title, group: body.group, price: body.price,
      mins: body.mins || null, about: body.about, alcohol: body.is_alcohol, state: 'draft', recipes: [], note: '' }]);
    var land = function (note, deny) {
      var rest = {}, first = '';
      langs.forEach(function (l) { if (saved.indexOf(l) === -1) { rest[l] = text[l]; if (!first) first = l; } });
      var body2 = {}; saved.forEach(function (l) { body2[l] = text[l]; });
      CARD.busy = false; CARD.press = '';
      CARD.carry = { note: note, deny: deny || '', text: rest, body: body2, lang: first || 'ru' };
      haptic(deny ? 'warn' : 'ok');
      go('barCard', String(id));
      loadCards();
    };
    var mark = function (st) { CARDS.list = (CARDS.list || []).map(function (x) { return x.id !== id ? x : Object.assign({}, x, { state: st || x.state, recipes: saved.slice() }); }); };
    var next = function () {
      if (who !== WHO) { CARD.busy = false; return; }
      if (saved.length < langs.length) {
        var l = langs[saved.length];
        api('POST', '/bar/products/' + id + '/recipe', { lang: l, body: text[l] }).then(function (rr) {
          if (who !== WHO) { CARD.busy = false; return; }
          if (!(rr.status === 201 && rr.data && rr.data.lang === l)) { mark(); land(slovo('barCard.part.recipe', { lang: l.toUpperCase() }), denyText(rr)); return; }
          saved.push(l); next();
        });
        return;
      }
      mark();
      if (!target) { land(slovo('barCard.done.off')); return; }
      api('POST', '/bar/products/' + id + '/state', { state: target }).then(function (rs) {
        if (who !== WHO) { CARD.busy = false; return; }
        if (!(rs.status === 200 && rs.data && rs.data.state === target)) { land(target === 'active' ? slovo('barCard.part.active') : slovo('barCard.part.review'), denyText(rs)); return; }
        mark(target);
        land(target === 'active' ? slovo('barCard.done.active') : slovo('barCard.done.review'));
      });
    };
    next();
  });
}
/* Правка черновика (шаг 15): форма открывается полями карточки, в PATCH уходят ТОЛЬКО изменённые — сервер пишет
   присланное, и неизменённое поле в теле перезаписало бы правку соседа той же строкой из старого списка. Ничего не
   изменено — запроса нет: на пустое тело сервер ответит 422, а сказать человеку тут нечего. */
function cardEditStart(id) {
  var c = cardBy(id);
  if (!c || c.state !== 'draft') return;
  CARD.edit = c.id; CARD.err = ''; CARD.deny = ''; CARD.note = ''; CARD.groupAsk = '';
  CARD.v = { 'c-title': c.title, 'c-group': c.group, 'c-price': String(c.price), 'c-mins': c.mins ? String(c.mins) : '', 'c-about': c.about };
  CARD.alcohol = c.alcohol;
}
function cardEditSave(id, sure) {
  var c = cardBy(id);
  if (CARD.busy || !c) return;
  grabCard();
  CARD.deny = '';
  CARD.err = cardMissing();
  if (CARD.err) { haptic('warn'); render(); return; }
  var g = cardGroup(sure);
  if (g === null) return;
  var now = { group: g, title: CARD.v['c-title'].trim(), price: Number(String(CARD.v['c-price']).replace(',', '.')),
              about: (CARD.v['c-about'] || '').trim(), is_alcohol: CARD.alcohol };
  var m = String(CARD.v['c-mins'] || '').trim();
  now.mins = m ? +m : null;
  var was = { group: c.group, title: c.title, price: c.price, about: c.about, is_alcohol: c.alcohol, mins: c.mins || null };
  var body = {};
  Object.keys(now).forEach(function (k) { if (now[k] !== was[k]) body[k] = now[k]; });
  if (!Object.keys(body).length) { CARD.edit = 0; CARD.v = {}; render(); return; }
  var gen = CARDS.gen;
  CARD.busy = true; render();
  api('PATCH', '/bar/products/' + id, body).then(function (r) {
    CARD.busy = false;
    if (gen !== CARDS.gen) return;
    // после любого нажатия список перечитывается: состояние могло смениться рукой куратора (409 — ровно это)
    if (!(r.status === 200 && r.data && r.data.id === id && r.data.state === 'draft')) {
      CARD.deny = denyText(r); haptic('warn'); loadCards(); render(); return;
    }
    haptic('ok');
    var d = r.data;
    // карточка из ответа — до перечитывания; замечание куратора правка не стирает (так и отвечает сервер)
    CARDS.list = (CARDS.list || []).map(function (x) {
      return x.id !== id ? x : Object.assign({}, x, { title: d.title, group: d.group, price: num(d.price), mins: d.mins || null,
        about: d.about || '', alcohol: !!d.is_alcohol });
    });
    CARD.edit = 0; CARD.v = {}; CARD.groupAsk = '';
    CARD.note = 'Изменения сохранены.';
    loadCards(); render();
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
    '<span class="grow"><b class="clamp1">' + esc(c.title) + '</b><span class="small">' + esc(c.group) + ' · ' + money(c.price) + ' ฿' +
      // глина — только там, где это запрет (review без рецепта отобьёт триггер базы);
      // у черновика рецепта нет по определению — это «ещё не сделано», не ошибка
      (rec ? ' · ' + esc(rec) : ' · <span' + (c.state === 'review' ? ' style="color:var(--clay-ink)"' : '') + '>рецепта нет</span>') + '</span>' +
      // замечание живёт до следующей смены состояния — читать его до нажатия
      (back ? '<span class="said clamp2">Замечание: ' + esc(c.note) + '</span>' : '') +
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
// Время заказа демо-бара — по поясу клуба (bkk() из js/09-afisha.js), а не телефона (Cafe13KPG#193).
function nowHM() { return bkk(new Date()).hm; }
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

