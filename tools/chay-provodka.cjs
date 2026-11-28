// Проводка адресов шага 42 (каталог и очередь карточек) без браузера: node tools/chay-provodka.cjs <корень клиента> [мутант]
// Форма ответов — сервер cafe13-api app/routers/tea.py (бой d23e45d): _card(), GET /tea/cards → {cards, pending},
// POST /tea/cards/{id}/decide {decision, note}. Подмен api — ответ по адресу; адрес, которого сервер не держит, — 404.
// Мутанты (каждый обязан дать КРАСНОЕ и rc=1):
//   stub   — очередь на прежних адресах-заглушках (/tea/cards/requests, /approve, /reject);
//   items  — очередь читает r.data.items, а не r.data.cards;
//   list   — каталог без адреса (TEA_URL.list = null);
//   gone409 — 409 «свою карточку решает другой арт-директор» показывается как «уже решена»;
//   reload409 — на 409 очередь не перечитывается: решённая другим строка остаётся «ждущей» (П10, мутант arhitector7-a1);
//   glava   — снята проверка mayDecideTeaCards в tqAction: глава отправляет решение (П11, №125 cafe13-api#250).
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const calls = [];
const card = (id, st, over) => Object.assign({ master_id: id, name: 'Образец', about: 'Пуэр.', price: '600.00', duration_min: 90,
  shots: 0, status: st, approved_at: st === 'approved' ? '2026-11-25T21:58:34.566750Z' : null }, over || {});
const SERVER = {
  'GET /tea/masters': { status: 200, data: [card(3, 'approved'), card(1, 'approved', { price: '1500.50' })] },
  'GET /tea/masters/3': { status: 200, data: card(3, 'approved') },
  'GET /tea/masters/9': { status: 404, data: { detail: 'карточки мастера нет' } },
  'GET /tea/cards': { status: 200, data: { pending: 2, cards: [
    Object.assign(card(5, 'pending'), { id: 11, status_ru: 'ждёт решения', note: '', created_at: '2026-11-26T01:00:00Z', decided_at: null, live: null }),
    Object.assign(card(1, 'pending', { price: '700.00' }), { id: 12, status_ru: 'ждёт решения', note: '', created_at: '2026-11-26T02:00:00Z',
      decided_at: null, live: card(1, 'approved') }),
    Object.assign(card(3, 'approved'), { id: 3, status_ru: 'согласовано', note: '', created_at: '2026-11-25T01:00:00Z',
      decided_at: '2026-11-25T21:58:34Z', live: null }) ] } },
};
let decideReply = { status: 200, data: {} };
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, isFinite,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: true, current: 'teaReqs', param: undefined, FLASH: null,
  haptic() {}, render() {}, go(s) { ctx.wentTo = s; }, svg: () => '', refreshMe() {}, closed: () => false,
  failText: r => 'код ' + r.status, detailOf: r => r.data && typeof r.data.detail === 'string' ? r.data.detail : '',
  denyText: r => 'отказ ' + r.status, mayMasters: () => true,
  // №125 (cafe13-api#250): очередь видят ОД и глава, решает ОД; ROLE — кто смотрит (П11 ставит главу)
  ROLE: 'ops_director', mayTeaCards: () => ['ops_director', 'head', 'admin'].includes(ctx.ROLE), mayDecideTeaCards: () => ['ops_director', 'admin'].includes(ctx.ROLE), DATA: { member: { uid: 4242 } }, API: '',
  api(m, u, body) {
    calls.push({ m, u, body });
    const r = m === 'POST' && /^\/tea\/cards\/\d+\/decide$/.test(u) ? decideReply : SERVER[m + ' ' + u] || { status: 404, data: { detail: 'Not Found' } };
    return { then(f) { f(r); } };
  } };
vm.createContext(ctx);
for (const f of ['js/00-slova.js', 'js/10-utility.js']) vm.runInContext(fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f });
let s22 = fs.readFileSync(root + '/js/22-ekrany-chay.js', 'utf8');
let s18 = fs.readFileSync(root + '/js/18-ekrany-mastera.js', 'utf8');
const sub = (src, a, b) => { if (!src.includes(a)) throw 'подмена не применилась: ' + a.slice(0, 50); console.log('подлог наложен'); return src.replace(a, b); };
if (mutant === 'stub') s18 = sub(s18, "var TQ_API = { list: '/tea/cards', decide: '/tea/cards/{id}/decide' };",
  "var TQ_API = { list: '/tea/cards/requests', decide: '/tea/cards/requests/{id}/approve' };");
if (mutant === 'items') s18 = sub(s18, 'Array.isArray(r.data.cards) ? r.data.cards', 'Array.isArray(r.data.items) ? r.data.items');
if (mutant === 'list') s22 = sub(s22, "var TEA_URL = { list: function () { return '/tea/masters'; },", 'var TEA_URL = { list: null,');
if (mutant === 'reload409') s18 = sub(s18, 'TQ.err = detailOf(r) || failText(r); loadTeaQueue(); render(); return; }',
  'TQ.err = detailOf(r) || failText(r); render(); return; }');
if (mutant === 'glava') s18 = sub(s18, "  if (LIVE && !mayDecideTeaCards()) return true;\n", '');
if (mutant === 'gone409') s18 = sub(s18, 'if (r.status === 409) { TQ.err = detailOf(r) || failText(r); loadTeaQueue(); render(); return; }',
  'if (r.status === 409) { TQ.gone = q.id; loadTeaQueue(); render(); return; }');
vm.runInContext(s22, ctx, { filename: '22' });
// js/18 целиком тянет экраны мастеров; нужен только блок очереди карточек — от TQ_API до Object.assign(SCREENS
const a = s18.indexOf('var TQ_API'), z = s18.indexOf('Object.assign(SCREENS, {', a);
if (a < 0 || z < 0) { console.error('блок очереди в js/18 не найден'); process.exit(2); }
vm.runInContext('var WIRED = {};\n' + s18.slice(a, z), ctx, { filename: '18' });
const R = c => vm.runInContext(c, ctx);
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };

// П1: каталог приходит с сервера — оба мастера, новые согласования сверху, цена без нулевых копеек
R('teaLoadList()');
check('П1 каталог: GET /tea/masters и разбор', R('TEA.list ? TEA.list.map(function (c) { return c.id + ":" + c.price; }).join(",") : "fail:" + TEA.listFail'),
  '3:600,1:1500.50');
// П2: чужая карточка — по master_id; 404 — «сняли»
R('teaLoadCard(3)'); check('П2 карточка 3', R('TEA.card ? String(TEA.card.id) : "нет"'), '3');
R('teaLoadCard(9)'); check('П3 карточки 9 нет (404) — cardGone', String(R('TEA.cardGone')), 'true');
// П4: подача — POST /tea/card с ценой строкой
calls.length = 0; R("TEA.share = 100; TAF = teaApplyBlank(null); TAF.about = 'Пуэр'; TAF.price = '600'; TAF.h = '1'; TAF.m = '30'; teaApplySend()");
const post = calls.find(c => c.m === 'POST');
check('П4 подача уходит на /tea/card', post ? post.u : 'нет запроса', '/tea/card');
// П5: очередь — GET /tea/cards, три строки, правка узнана по live, у неё prev
R('loadTeaQueue()');
check('П5 очередь: строки и виды', R('TQ.list ? TQ.list.map(function (q) { return q.id + q.kind[0] + (q.prev ? "p" : ""); }).join(",") : "fail:" + TQ.fail'),
  '11n,12ep,3n');
check('П6 ждущих 2', String(R('TQ.pending')), '2');
// П7: согласовать — POST /tea/cards/11/decide {decision: approved}
calls.length = 0; R("tqAction('tc-yes', '11')");
const d = calls.find(c => c.m === 'POST');
check('П7 согласование', d ? d.u + ' ' + JSON.stringify(d.body) : 'нет запроса', '/tea/cards/11/decide {"decision":"approved","note":""}');
// П8: отказ — decision rejected, причина в note
calls.length = 0; R("TQ.busy = false; TQ.note = 'Нет описания места'; tqAction('tc-no', '11')");
const n = calls.find(c => c.m === 'POST');
check('П8 отказ с причиной', n ? JSON.stringify(n.body) : 'нет запроса', '{"decision":"rejected","note":"Нет описания места"}');
// П9: 409 на свою карточку — слова сервера, а строка остаётся ждущей (не «решена»)
decideReply = { status: 409, data: { detail: 'свою карточку решает другой арт-директор' } };
R("TQ.busy = false; TQ.err = ''; TQ.gone = 0; tqAction('tc-yes', '12')");
check('П9 409 «свою» — слова сервера, не «решена»', R("(TQ.err || '-') + ' / gone=' + (TQ.gone === '12' ? 'да' : 'нет')"),
  'свою карточку решает другой арт-директор / gone=нет');
// П10: 409 «уже решена» — очередь перечитывается, и второй GET /tea/cards отдаёт строку решённой (решил другой арт-директор)
const q = SERVER['GET /tea/cards'].data;
SERVER['GET /tea/cards'] = { status: 200, data: { pending: 0, cards: q.cards.map(c => c.id === 11 || c.id === 12
  ? Object.assign({}, c, { status: 'approved', status_ru: 'согласовано', decided_at: '2026-11-26T03:00:00Z', live: null }) : c) } };
decideReply = { status: 409, data: { detail: 'карточка уже решена: согласовано' } };
calls.length = 0; R("TQ.busy = false; TQ.err = ''; tqAction('tc-yes', '11')");
check('П10 409 «уже решена» — перечитка, строка решена', String(calls.filter(c => c.m === 'GET' && c.u === '/tea/cards').length) + ' / ' +
  R("tqById('11') ? tqById('11').status : 'нет'"), '1 / approved');
// П11: глава видит очередь, но решение не уходит — ни POST, ни занятости (№125, cafe13-api#250: decide только у ОД)
ctx.ROLE = 'head'; decideReply = { status: 200, data: {} };
calls.length = 0; R("TQ.busy = false; TQ.err = ''; tqAction('tc-yes', '11'); tqAction('tc-no', '11')");
check('П11 глава не решает: POST не ушёл', String(calls.filter(c => c.m === 'POST').length) + ' / busy=' + R('TQ.busy'), '0 / busy=false');
ctx.ROLE = 'ops_director';

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
