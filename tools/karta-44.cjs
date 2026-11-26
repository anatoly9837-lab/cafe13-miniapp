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

  const bad = ok.filter(x => !x).length;
  console.log((bad ? 'КРАСНОЕ: ' + bad : 'ЗЕЛЁНОЕ: 0') + ' из ' + ok.length);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('НЕ ВЫПОЛНЕНО: ' + (e && e.stack || e)); process.exit(2); });
