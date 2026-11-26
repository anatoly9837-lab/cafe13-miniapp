// Шаг 44, заведение карточки товара одной формой и предпросмотром, без браузера: node tools/karta-44.cjs <корень клиента> [мутант]
// Рецепт `_docs/recept/ekran/44/barCard.md` (случаи — его раздел «Проверки»); сервер cafe13-api 913eeef, app/routers/bar.py:
// POST /bar/products заводит ТОЛЬКО черновиком (201 {id, state: 'draft', …}); POST …/{id}/recipe {lang, body} → 201 {lang};
// POST …/{id}/state {state} → 200 {state}; в меню без рецепта не пускает триггер базы (009_recipes.up.sql:80–95).
// Клиент грузится целиком по index.html (tools/klient.cjs) в vm, DOM — заглушки, api — подставной с записью вызовов.
// ⚠ Предикат партнёра (cardPartnerOnly) здесь ПОДСТАВЛЯЕТСЯ: он не правлен шагом и судится live.cjs; судится то, что шаг
// с ним делает. Поля формы кладутся в CARD.v/CARD.text прямо: grabCard без DOM ничего не читает.
// Мутанты (каждый обязан дать КРАСНОЕ своей строкой и rc=1):
//   mR — «в меню» без рецепта: кнопка горит;          mG — то же в цепочке: без рецепта уходит смена состояния;
//   mP — партнёр отправляет на утверждение, а не в меню (№99 «б»);   mB — в предпросмотре «Купить» гостя;
//   mN — «Создать» шлёт запрос сам;                    mZ — «назад» с предпросмотра — в список, а не на форму;
//   mS — переход форма→предпросмотр стирает набранное; mK — после обрыва рецепта несохранённый рецепт пропадает;
//   mL — в форме один язык рецепта вместо трёх;        mO — «Создать выключенной» шлёт ещё и смену состояния.
//   mW — цепочку сторожит свежесть списка (CARDS.gen), а не личность (ревью #496 п.2);  mC — carry теряется, если ушли в список;
//   mW3, mW4 — снята охрана WHO после ответа на рецепт / на смену состояния;
//   mF — предпросмотр не выводит FLASH: в демонстрации «в меню»/«выключенной» немые (ворота #496 a0b6fe5);
//   mU — в бою до ответа нажатая кнопка предпросмотра не говорит «Сохраняем…»;
//   mI — цепочка не слышит смену личности (WHO);  mD — в демонстрации «та же группа?» формы заведения — «Это демонстрация» (100e4a9 снят).
'use strict';
const vm = require('vm'), path = require('path');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const { klient } = require(path.resolve(__dirname, 'klient.cjs'));
const MUT = {
  mR: ['js/16-ekrany-bar.js', 'has = cardRecipeLangs().length > 0;', 'has = true;'],
  mG: ['js/08-kartochki.js', 'if (menu && !langs.length) return;', ';'],
  mP: ['js/08-kartochki.js', "target = menu ? (cardPartnerOnly() ? 'active' : 'review') : '';", "target = menu ? 'review' : '';"],
  mB: ['js/16-ekrany-bar.js', "'<b class=\"num\">' + money(d.price) + ' ฿</b></span></span></div></div>' +", "'<b class=\"num\">' + money(d.price) + ' ฿</b></span></span>' + buyBtn(d) + '</div></div>' +"],
  mN: ['js/21-navigaciya.js', "if (a === 'c-create') { cardPreview(); return; }", "if (a === 'c-create') { cardCreate(false); return; }"],
  mZ: ['js/21-navigaciya.js', "barCard: function () { return String(param) === 'preview' ? { s: 'barCard', p: 'new' } : 'barCards'; },", "barCard: 'barCards',"],
  mS: ['js/21-navigaciya.js', '!(current === \'barCard\' && cardPair(param) && cardPair(p))) {', 'true) {'],
  mK: ['js/21-navigaciya.js', 'if (keep.text) {', 'if (false) {'],
  mW: ['js/08-kartochki.js', "if (who !== WHO) { CARD.busy = false; return; }\n    var ok =", "if (who !== WHO || current !== 'barCard') { CARD.busy = false; return; }\n    var ok ="],
  mI: ['js/08-kartochki.js', "if (who !== WHO) { CARD.busy = false; return; }\n    var ok =", "\n    var ok ="],
  mC: ['js/21-navigaciya.js', "var keep = CARD.carry || (current === 'barCard' ? { note: CARD.note } : null);", "var keep = current === 'barCard' ? (CARD.carry || { note: CARD.note }) : null;"],
  mW3: ['js/08-kartochki.js', "if (who !== WHO) { CARD.busy = false; return; }\n          if (!(rr.status", "\n          if (!(rr.status"],
  mW4: ['js/08-kartochki.js', "if (who !== WHO) { CARD.busy = false; return; }\n        if (!(rs.status", "\n        if (!(rs.status"],
  mF: ['js/16-ekrany-bar.js', "  return (!LIVE && FLASH ? flash() : '') +\n    '<div class=\"note\">'", "  return '' +\n    '<div class=\"note\">'"],
  mU: ['js/16-ekrany-bar.js', "return CARD.busy && CARD.press === k ? slovo('barCard.preview.busy') : word;", 'return word;'],
  mD: ['js/21-navigaciya.js', " && !(/^c-group-(theirs|mine)$/.test(a) && !CARD.edit)) {", ") {"],
  mL: ['js/16-ekrany-bar.js', 'CARD_LANGS.map(function (l) {\n            return \'<div class="field"><label for="c-rec-\'', 'CARD_LANGS.slice(0, 1).map(function (l) {\n            return \'<div class="field"><label for="c-rec-\''],
  mO: ['js/08-kartochki.js', "if (!target) { land(slovo('barCard.done.off')); return; }", ';'],
};
if (mutant && !MUT[mutant]) { console.error('нет такого мутанта: ' + mutant); process.exit(2); }
let k;
try { k = klient(root); } catch (e) { console.error('НЕ ВЫПОЛНЕНО: ' + e.message); process.exit(2); }
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, setAttribute() {},
  addEventListener() {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } });
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, parseFloat, isFinite, Promise,
  document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; },
    querySelectorAll() { return []; }, createElement: el, body: el(), documentElement: el() },
  window: { Telegram: undefined, location: { search: '', hash: '' }, addEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } },
  navigator: {}, location: { search: '', hash: '' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} }, setTimeout() {}, clearTimeout() {}, setInterval() {},
  fetch() { return new Promise(() => {}); }, URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} } };
ctx.window.document = ctx.document;
vm.createContext(ctx);
let applied = !mutant;
for (const f of k.files) {
  let text = f.text;
  if (MUT[mutant] && MUT[mutant][0] === f.file) {
    if (!text.includes(MUT[mutant][1])) { console.error('НЕ ВЫПОЛНЕНО: подмена не применилась: ' + MUT[mutant][1].slice(0, 60)); process.exit(2); }
    text = text.replace(MUT[mutant][1], MUT[mutant][2]); applied = true; console.log('подлог наложен: ' + mutant);
  }
  try { vm.runInContext(text, ctx, { filename: f.file }); } catch (e) { /* верх файлов зовёт DOM; нужное — объявления, они подняты */ }
}
if (!applied) { console.error('НЕ ВЫПОЛНЕНО: файла подлога нет в клиенте'); process.exit(2); }
for (const fn of ['cardPreview', 'cardCreate', 'cardPreviewHtml', 'doAction', 'go', 'backTo', 'mainFor']) {
  if (typeof ctx[fn] !== 'function') { console.error('НЕ ВЫПОЛНЕНО: нет функции ' + fn); process.exit(2); }
}
const R = c => vm.runInContext(c, ctx);
const ok = [];
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); ok.push(g === w);
  console.log((g === w ? '✓ ' : '✗ ') + name + ' — ' + g + (g === w ? '' : ', ждали ' + w)); };
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
let calls = [], replies = {};
// ответ по виду запроса: продукт, рецепт языка, смена состояния; GET (перечитывание списка) — висит, как в пути
ctx.api = (m, u, body) => {
  if (m === 'GET') return new Promise(() => {});
  calls.push({ m, u, body });
  const kind = /\/recipe$/.test(u) ? 'recipe:' + body.lang : /\/state$/.test(u) ? 'state' : 'product';
  const r = replies[kind] || (kind === 'product' ? { status: 201, data: { id: 501, state: 'draft' } }
    : kind === 'state' ? { status: 200, data: { state: body.state } } : { status: 201, data: { lang: body.lang } });
  return Promise.resolve(r);
};
R("LIVE = true; render = function () {}; haptic = function () {}; noEntry = function () { return false; };" +
  "mayCards = function () { return true; }; loadCards = function () {}; DATA.grants = [{ role: 'worker', dir: 7 }];");
const html = () => R('SCREENS.barCard(param)');
const start = (partner, fill) => {
  calls = []; replies = {};
  R("cardPartnerOnly = function () { return " + !!partner + "; }; CARDS.dir = { id: 7, title: 'Бар' }; CARDS.list = []; CARDS.gen = 1;" +
    "current = 'barCards'; param = null; go('barCard', 'new');");
  if (fill !== false) R("CARD.v = { 'c-title': 'Флэт-уайт', 'c-group': 'Кофе', 'c-price': '180', 'c-mins': '4', 'c-about': 'двойной ристретто' };");
};
const posts = () => calls.map(c => c.u.replace(/^\/bar\/products/, 'P') + (c.body && c.body.lang ? ' ' + c.body.lang : '') + (c.body && c.body.state ? ' ' + c.body.state : ''));
const btn = (h, a) => { const m = h.match(new RegExp('<button[^>]*data-action="' + a + '"[^>]*>')); return m ? m[0] : null; };

(async () => {
  // card44-odin-ekran: форма несёт рецепт трёх языков и «Создать»; нажатие — без запроса, открыт предпросмотр
  start(false);
  let h = html();
  check('card44-odin-ekran: поля рецепта RU/EN/TH на форме', ['ru', 'en', 'th'].map(l => h.includes('id="c-rec-' + l + '"')), [true, true, true]);
  check('card44-odin-ekran: кнопка формы — «Создать» (c-create)', !!btn(h, 'c-create') && !h.includes('Сохранить черновик'), true);
  check('card44-odin-ekran: главная Telegram на форме', R('JSON.stringify(mainFor())'), JSON.stringify({ text: 'Создать', a: 'c-create' }));
  R("CARD.text = { ru: 'эспрессо 2 шота, молоко 150', th: 'สูตร' };");
  R("doAction('c-create')"); await tick();
  check('card44-odin-ekran: «Создать» запросов не шлёт', posts(), []);
  check('card44-odin-ekran: открыт предпросмотр', R('current + ":" + param'), 'barCard:preview');

  // card44-predprosmotr: вид гостя без действий гостя
  h = html();
  check('card44-predprosmotr: название, группа, цена, минуты, описание', ['Флэт-уайт', '>Кофе<', '180 ฿', '4 мин', 'двойной ристретто'].map(x => h.includes(x)), [true, true, true, true, true]);
  check('card44-predprosmotr: действий гостя нет (buy:, cart-add:, data-drink, data-go)', /data-action="(buy|cart-add|cart-less)|data-drink=|data-go=/.test(h), false);
  check('card44-predprosmotr: две кнопки и «Изменить»', ['c-add', 'c-off', 'c-fix'].map(a => !!btn(h, a)), [true, true, true]);
  // любая кнопка гостя — и погашенная «Закрыто» без data-action (buyBtn при закрытом баре) — лишняя: кнопок ровно три
  check('card44-predprosmotr: кнопок ровно три — других нет', (h.match(/<button/g) || []).length, 3);
  check('card44-predprosmotr: не партнёру — «Отправить на утверждение»', /data-action="c-add"[^>]*>Отправить на утверждение</.test(h), true);

  // card44-nazad: «назад» с предпросмотра — на форму, набранное на месте
  check('card44-nazad: backTo с предпросмотра', R('JSON.stringify(backTo())'), JSON.stringify({ s: 'barCard', p: 'new' }));
  R('goBack()');
  check('card44-nazad: после «назад» — форма', R('current + ":" + param'), 'barCard:new');
  check('card44-nazad: поля и рецепты на месте', R("[CARD.v['c-title'], CARD.text.ru, CARD.text.th].join('|')"), 'Флэт-уайт|эспрессо 2 шота, молоко 150|สูตร');
  h = html();
  check('card44-nazad: рецепт TH снова в поле формы', h.includes('>สูตร</textarea>'), true);
  R("go('barCard', 'preview'); doAction('c-fix')");
  check('card44-nazad: «Изменить» — на форму, набранное на месте', R("current + ':' + param + ':' + CARD.v['c-title']"), 'barCard:new:Флэт-уайт');
  check('card44-nazad: из формы «назад» — в список', R('backTo()'), 'barCards');

  // card44-bez-recepta: без рецепта «в меню» погашена, «выключенной» работает и шлёт ОДИН запрос
  start(false); R("go('barCard', 'preview')");
  h = html();
  check('card44-bez-recepta: главная погашена', /<button type="button" class="btn ghost" disabled>Отправить на утверждение</.test(h) && !btn(h, 'c-add'), true);
  check('card44-bez-recepta: строка «Сначала рецепт»', h.includes('Сначала рецепт — без него позиция не попадёт в меню.'), true);
  check('card44-bez-recepta: Telegram-кнопки нет', R('mainFor()'), null);
  R("doAction('c-add')"); await tick();
  check('card44-bez-recepta: c-add без рецепта не шлёт', posts(), []);
  R("doAction('c-off')"); await tick();
  check('card44-bez-recepta: «Создать выключенной» — один POST продукта', posts(), ['P']);
  check('card44-bez-recepta: тело продукта', calls[0] && calls[0].body, { direction_id: 7, group: 'Кофе', title: 'Флэт-уайт', price: 180, about: 'двойной ристретто', is_alcohol: false, mins: 4 });
  check('card44-bez-recepta: открыта карточка с заметкой', R("current + ':' + param + ':' + CARD.note"), 'barCard:501:Карточка создана выключенной: в меню её нет.');

  // card44-vyklyuchennaya-s-receptom: рецепт сохраняется, состояние не меняется
  start(false); R("CARD.text = { en: 'espresso' }; go('barCard', 'preview'); doAction('c-off')"); await tick();
  check('card44-vyklyuchennaya: продукт и рецепт EN, без смены состояния', posts(), ['P', 'P/501/recipe en']);

  // card44-v-menu-partner: партнёр — в меню сразу
  start(true); R("CARD.text = { ru: 'рецепт', th: 'สูตร' }; go('barCard', 'preview')");
  h = html();
  check('card44-v-menu-partner: надпись «Добавить в меню»', /data-action="c-add"[^>]*>Добавить в меню</.test(h), true);
  check('card44-v-menu-partner: Telegram-кнопка', R('JSON.stringify(mainFor())'), JSON.stringify({ text: 'Добавить в меню', a: 'c-add' }));
  R("doAction('c-add')"); await tick();
  check('card44-v-menu-partner: цепочка', posts(), ['P', 'P/501/recipe ru', 'P/501/recipe th', 'P/501/state active']);
  check('card44-v-menu-partner: заметка', R('CARD.note'), 'Карточка в меню: гость её уже видит.');
  check('card44-v-menu-partner: в списке — active с рецептами ru, th', R("JSON.stringify(cardBy(501) && [cardBy(501).state, cardBy(501).recipes])"), JSON.stringify(['active', ['ru', 'th']]));

  // card44-na-utverzhdenie: не партнёр — на утверждение
  start(false); R("CARD.text = { ru: 'рецепт' }; go('barCard', 'preview'); doAction('c-add')"); await tick();
  check('card44-na-utverzhdenie: цепочка', posts(), ['P', 'P/501/recipe ru', 'P/501/state review']);
  check('card44-na-utverzhdenie: заметка', R('CARD.note'), 'Карточка создана и отправлена на утверждение.');

  // card44-obryv-recepta: второй рецепт отказан — карточка открыта, отказ печатью, несохранённое в поле
  start(true); replies['recipe:en'] = { status: 422, data: { detail: 'рецепт длиннее 4000 знаков' } };
  R("CARD.text = { ru: 'рецепт', en: 'too long', th: 'สูตร' }; go('barCard', 'preview'); doAction('c-add')"); await tick();
  check('card44-obryv-recepta: цепочка встала на EN, состояния нет', posts(), ['P', 'P/501/recipe ru', 'P/501/recipe en']);
  check('card44-obryv-recepta: открыта карточка 501', R("current + ':' + param"), 'barCard:501');
  check('card44-obryv-recepta: заметка и отказ', R("CARD.note + ' / ' + CARD.deny"), 'Карточка создана выключенной, но рецепт EN не сохранился — он остался в поле. / Рецепт длиннее 4000 знаков.');
  check('card44-obryv-recepta: несохранённые EN и TH в поле, язык EN', R("JSON.stringify([CARD.lang, CARD.text.en, CARD.text.th, CARD.text.ru === undefined])"), JSON.stringify(['en', 'too long', 'สูตร', true]));

  // card44-obryv-sostoyaniya: смена состояния отказана — сказано, что карточка выключенная
  start(false); replies.state = { status: 403, data: { detail: 'на проверку отправляет бар направления' } };
  R("CARD.text = { ru: 'рецепт' }; go('barCard', 'preview'); doAction('c-add')"); await tick();
  check('card44-obryv-sostoyaniya: заметка и отказ', R("CARD.note + ' / ' + CARD.deny"), 'Карточка создана выключенной, но на утверждение не ушла. / На проверку отправляет бар направления.');

  // card44-otkaz-do-rozhdeniya: продукт отказан — остаёмся на предпросмотре, набранное на месте
  start(false); replies.product = { status: 409, data: { detail: 'такая позиция уже есть' } };
  R("CARD.text = { ru: 'рецепт' }; go('barCard', 'preview'); doAction('c-add')"); await tick();
  check('card44-otkaz-do-rozhdeniya: один POST, рецептов нет', posts(), ['P']);
  check('card44-otkaz-do-rozhdeniya: предпросмотр, отказ словами сервера (denyText), рецепт на месте', R("[current, param, CARD.deny, CARD.text.ru, CARD.busy].join('|')"), 'barCard|preview|Такая позиция уже есть.|рецепт|false');
  check('card44-otkaz-do-rozhdeniya: отказ нарисован .verbatim', html().includes('<span class="verbatim">Такая позиция уже есть.</span>'), true);

  // card44-pustoj-predprosmotr: прямой вход без формы
  start(false, false); R("go('barCard', 'preview')");
  h = html();
  check('card44-pustoj: «Карточка не заполнена» и «К форме», кнопок рождения нет', [h.includes('Карточка не заполнена.'), !!btn(h, 'c-fix'), !btn(h, 'c-add'), !btn(h, 'c-off')], [true, true, true, true]);

  // card44-uhod-v-cepochke (ревью #496, п.2): человек ушёл в список, пока цепочка шла, — loadCards двигает CARDS.gen.
  // Карточка после 201 уже на сервере: цепочка доходит до конца и открывает её с итогом, рецепты не пропадают молча
  const api0 = ctx.api;
  start(true); R("CARD.text = { ru: 'рецепт', en: 'recipe' }; go('barCard', 'preview')");
  ctx.api = (m, u, body) => { const p = api0(m, u, body);
    return /\/bar\/products$/.test(u) ? p.then(r => { R("current = 'barCards'; param = null; CARDS.gen++;"); return r; }) : p; };
  R("doAction('c-add')"); await tick(); ctx.api = api0;
  check('card44-uhod-v-cepochke: цепочка дошла до конца', posts(), ['P', 'P/501/recipe ru', 'P/501/recipe en', 'P/501/state active']);
  check('card44-uhod-v-cepochke: открыта рождённая карточка с итогом, busy снят', R("[current, param, CARD.note, CARD.busy].join('|')"), 'barCard|501|' + R("slovo('barCard.done.active')") + '|false');
  // то же, но рецепт EN отказан: несохранённый рецепт переезжает в поле карточки и после ухода в список
  start(true); replies['recipe:en'] = { status: 422, data: { detail: 'Слишком длинно.' } };
  R("CARD.text = { ru: 'рецепт', en: 'recipe' }; go('barCard', 'preview')");
  ctx.api = (m, u, body) => { const p = api0(m, u, body);
    return /\/bar\/products$/.test(u) ? p.then(r => { R("current = 'barCards'; param = null; CARDS.gen++;"); return r; }) : p; };
  R("doAction('c-add')"); await tick(); ctx.api = api0;
  check('card44-uhod-v-cepochke: обрыв на EN — карточка 501, рецепт EN в поле, отказ показан', R("[current, param, CARD.text.en, !!CARD.deny].join('|')"), 'barCard|501|recipe|true');

  // card44-smena-lichnosti: смена личности (WHO++) посреди цепочки — цепочка обрывается, чужой карточки не открывает
  start(true); R("CARD.text = { ru: 'рецепт' }; go('barCard', 'preview')");
  ctx.api = (m, u, body) => { const p = api0(m, u, body);
    return /\/bar\/products$/.test(u) ? p.then(r => { R("WHO++; CARDS.list = null; current = 'home'; param = null;"); return r; }) : p; };
  R("doAction('c-add')"); await tick(); ctx.api = api0;
  check('card44-smena-lichnosti: после 201 запросов нет, экран не уведён, busy снят', [posts(), R("current + ':' + CARD.busy")], [['P'], 'home:false']);
  // список новой личности не получает чужую рождённую карточку (смена личности обнуляет CARDS.list, js/05)
  check('card44-smena-lichnosti: в списке новой личности чужой карточки нет', R('CARDS.list'), null);
  // то же на двух поздних охранах (ревью #496, arhitector23-e9): смена личности в ответе на рецепт (EN отказан) и в
  // ответе на смену состояния — новой личности не открыта чужая рождённая карточка
  start(true); replies['recipe:en'] = { status: 422, data: { detail: 'x' } };
  R("CARD.text = { ru: 'рецепт', en: 'recipe' }; go('barCard', 'preview')");
  ctx.api = (m, u, body) => { const p = api0(m, u, body);
    return /\/recipe$/.test(u) && body && body.lang === 'en' ? p.then(r => { R("WHO++; CARDS.list = null; current = 'home'; param = null;"); return r; }) : p; };
  R("doAction('c-add')"); await tick(); ctx.api = api0;
  check('card44-smena-lichnosti-na-recepte: экран не уведён, список новой личности пуст', [R('current'), R('CARDS.list')], ['home', null]);
  start(true); R("CARD.text = { ru: 'рецепт' }; go('barCard', 'preview')");
  ctx.api = (m, u, body) => { const p = api0(m, u, body);
    return /\/state$/.test(u) ? p.then(r => { R("WHO++; CARDS.list = null; current = 'home'; param = null;"); return r; }) : p; };
  R("doAction('c-add')"); await tick(); ctx.api = api0;
  check('card44-smena-lichnosti-na-state: экран не уведён, список новой личности пуст', [R('current'), R('CARDS.list')], ['home', null]);

  // card44-demo-gruppa (ревью #496, п.3; правка 100e4a9): в демонстрации ответ «та же группа?» формы ЗАВЕДЕНИЯ ничего
  // не шлёт и ведёт на предпросмотр; у правки черновика (CARD.edit) он шлёт PATCH — там «Это демонстрация»
  start(false);
  R("LIVE = false; FLASH = null; CARDS.list = [{ id: 9, title: 'Латте', group: 'Кофе', price: 200, state: 'active', recipes: ['ru'] }];" +
    "CARD.v['c-group'] = 'Ко фе'; doAction('c-create')");
  check('card44-demo-gruppa: вопрос о похожей группе', R("CARD.groupAsk + ':' + current + ':' + param"), 'Кофе:barCard:new');
  R("doAction('c-group-theirs')"); await tick();
  check('card44-demo-gruppa: «Да, та же» — предпросмотр со сведённой группой, без «Это демонстрация»', R("[current, param, CARD.v['c-group'], FLASH ? FLASH.text : ''].join('|')"), 'barCard|preview|Кофе|');
  R("FLASH = null; CARD.edit = 9; doAction('c-group-mine')");
  check('card44-demo-gruppa: у правки черновика — «Это демонстрация»', R("FLASH ? FLASH.text : ''"), 'Это демонстрация');
  check('card44-demo-gruppa: запросов нет', posts(), []);
  R("LIVE = true; FLASH = null; CARD.edit = 0;");

  // card44-demo-predprosmotr (ворота #496 a0b6fe5, шаг 1 demo-press, Cafe13KPG#338): в демонстрации «в меню» и
  // «выключенной» отвечают на ПРЕДПРОСМОТРЕ плашкой «Это демонстрация» — разметка экрана меняется, запросов нет.
  // Без вывода FLASH в cardPreviewHtml нажатие не меняло экран (немая кнопка) — так ворота и покраснели.
  for (const a of ['c-add', 'c-off']) {
    start(false); R("LIVE = false; FLASH = null; CARD.text = { ru: 'рецепт' }; go('barCard', 'preview')");
    const h0 = html();
    R("doAction('" + a + "')"); await tick();
    const h1 = html();
    check('card44-demo-predprosmotr: «' + a + '» — экран тот же, разметка сменилась, плашка «Это демонстрация» на нём',
      [R('current + ":" + param'), h1 !== h0, h1.includes('Это демонстрация') && !h0.includes('Это демонстрация')], ['barCard:preview', true, true]);
    check('card44-demo-predprosmotr: «' + a + '» — запросов нет', posts(), []);
  }
  R("LIVE = true; FLASH = null;");

  // card44-zhivoe-nazhatie (вопрос coordinator-3 к воротам a0b6fe5: демо-случай не судит живой путь): в бою, ДО ответа
  // сервера, нажатая кнопка говорит «Сохраняем…», все три кнопки погашены, Telegram-кнопки нет, ушёл один POST
  for (const a of ['c-add', 'c-off']) {
    start(false); R("CARD.text = { ru: 'рецепт' }; go('barCard', 'preview')");
    const h0 = html(), keep = ctx.api;
    ctx.api = (m, u, body) => { if (m !== 'GET') calls.push({ m, u, body }); return new Promise(() => {}); };
    R("doAction('" + a + "')"); await tick();
    const h1 = html(); ctx.api = keep;
    const word = R("slovo('barCard.preview.busy')");
    check('card44-zhivoe-nazhatie: «' + a + '» до ответа — экран тот же, разметка сменилась, на кнопке «' + word + '»',
      [R('current + ":" + param'), h1 !== h0, (btn(h1, a) || '') !== '' && h1.split(btn(h1, a))[1].startsWith(word)], ['barCard:preview', true, true]);
    check('card44-zhivoe-nazhatie: «' + a + '» до ответа — c-add, c-off, c-fix погашены, Telegram-кнопки нет',
      [['c-add', 'c-off', 'c-fix'].map(x => /\sdisabled/.test(btn(h1, x) || '')), R('JSON.stringify(mainFor())')], [[true, true, true], 'null']);
    check('card44-zhivoe-nazhatie: «' + a + '» — ушёл один POST продукта', posts(), ['P']);
    R("CARD.busy = false; CARD.press = '';");
  }

  const bad = ok.filter(x => !x).length;
  console.log((bad ? 'КРАСНОЕ: ' + bad : 'ЗЕЛЁНОЕ: 0') + ' из ' + ok.length);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('НЕ ВЫПОЛНЕНО: ' + (e && e.stack || e)); process.exit(2); });
