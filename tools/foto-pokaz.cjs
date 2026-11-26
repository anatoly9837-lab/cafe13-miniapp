// Снимки события, шаг 44, без браузера: node tools/foto-pokaz.cjs <корень клиента> [мутант]
// Рецепт `_docs/recept/ekran/foto/` (event.md, masterApply.md, eventEdit.md, sostav.md); сервер cafe13-api 4c0aae0,
// app/routers/photos.py: POST /photos — тело сам файл, ответ {id, url, width, height, bytes, sha256, squeezed}; отказ —
// {detail, code}. Клиент грузится целиком по index.html (tools/klient.cjs) в vm; DOM — заглушки.
// Случаи — по одному на каждое состояние рецепта; П0 — карточка мастера побайтно как на df86750 (решение
// координатора 26.11: её показ не меняется). Мутанты (каждый обязан дать КРАСНОЕ своей строкой и rc=1, синхронно):
//   tri — превью теряют третий кадр;  dva — вид «два кадра» снят (второй снова в ряду с пустой половиной);
//   odin — у одного кадра пустой ряд превью;  net — у события без снимков кадр-заглушка (рецепт: блока нет вовсе);
//   kvadrat — у кадра нет квадрата (aspect-ratio снят: «грузится» сдвигает карточку);
//   oshibka — не загрузившийся кадр не прячется (битая картинка вместо пустого квадрата);
//   frozen — F6 видят все, а не автор;  master — вид «два кадра» и у карточки мастера;
//   vorota — закрытый masterApply открыт в живом (карта FOTO_ON);  tri3 — «Добавить фото» при трёх;
//   bolshe8 — файл больше 8 МБ уходит на сервер;  szhat — сжатие сервером молча;  zhdyot — подача при грузящемся кадре;
//   pervym — «Сделать первым» ставит кадр в конец;  otkaz — отказ сервера переписан клиентом.
//   mV (мутант ревьюера #486; ссылка на ревью — в теле PR) — гейт `LIVE && fotoOn(form)` снят у fotoBody: правка несогласованного
//   события в бою шлёт photo_ids, а боевой EventEdit — extra="forbid" (a6d4d4c events.py:92) → 422.
//   chay — закрытый teaHold открыт в живом (снимки ушли бы на карточку ивента без просмотра);
//   obshchij — карта FOTO_ON подменена общим флагом (все экраны — как eventNew): teaHold и masterApply открываются.
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const { klient } = require(path.resolve(__dirname, 'klient.cjs'));
const MASTER_DF86750 = [
  "<div class=\"album\"><div class=\"album-frame\"><img src=\"/s1.jpg\" alt=\"\" loading=\"lazy\"></div></div><div class=\"card\"><div class=\"col\"><span class=\"label\">О мастере</span><p style=\"font-size:14px;white-space:pre-line;margin:0\">A</p></div></div><div class=\"card\"><div class=\"col\"><div class=\"row\"><span class=\"small\">Церемония · 1:30</span><b class=\"num\">600 ฿</b></div><span class=\"small\">Спишется со счёта при брони. Если арт-директор откажет, деньги вернутся полностью.</span></div></div>",
  "<div class=\"album\"><div class=\"album-frame\"><img src=\"/s1.jpg\" alt=\"\" loading=\"lazy\"></div><div class=\"album-thumbs\"><div class=\"album-frame small\"><img src=\"/s2.jpg\" alt=\"\" loading=\"lazy\"></div></div></div><div class=\"card\"><div class=\"col\"><span class=\"label\">О мастере</span><p style=\"font-size:14px;white-space:pre-line;margin:0\">A</p></div></div><div class=\"card\"><div class=\"col\"><div class=\"row\"><span class=\"small\">Церемония · 1:30</span><b class=\"num\">600 ฿</b></div><span class=\"small\">Спишется со счёта при брони. Если арт-директор откажет, деньги вернутся полностью.</span></div></div>",
  "<div class=\"album\"><div class=\"album-frame\"><img src=\"/s1.jpg\" alt=\"\" loading=\"lazy\"></div><div class=\"album-thumbs\"><div class=\"album-frame small\"><img src=\"/s2.jpg\" alt=\"\" loading=\"lazy\"></div><div class=\"album-frame small\"><img src=\"/s3.jpg\" alt=\"\" loading=\"lazy\"></div></div></div><div class=\"card\"><div class=\"col\"><span class=\"label\">О мастере</span><p style=\"font-size:14px;white-space:pre-line;margin:0\">A</p></div></div><div class=\"card\"><div class=\"col\"><div class=\"row\"><span class=\"small\">Церемония · 1:30</span><b class=\"num\">600 ฿</b></div><span class=\"small\">Спишется со счёта при брони. Если арт-директор откажет, деньги вернутся полностью.</span></div></div>"
];
const MUT = {
  tri: ['js/22-ekrany-chay.js', 'shots.slice(1).map(', 'shots.slice(2).map('],
  dva: ['js/22-ekrany-chay.js', 'if (pair && shots.length === 2)', 'if (false)'],
  odin: ['js/22-ekrany-chay.js', '(shots.length > 1 ? \'<div class="album-thumbs">\'', '(shots.length > 0 ? \'<div class="album-thumbs">\''],
  net: ['js/09-afisha.js', '(e.photos && e.photos.length ? teaAlbum(e.photos, null, true) +', "(e.photos ? teaAlbum(e.photos.length ? e.photos : [''], null, true) +"],
  oshibka: ['js/22-ekrany-chay.js', "t.style.visibility = 'hidden';", ';'],
  frozen: ['js/09-afisha.js', "(isMyEvent(e) && e.approval === 'approved' ? '<span class=\"small\">' + esc(slovo('foto.frozen'))", "(e.approval === 'approved' ? '<span class=\"small\">' + esc(slovo('foto.frozen'))"],
  master: ['js/22-ekrany-chay.js', 'function teaAlbum(shots, edit, pair) {', 'function teaAlbum(shots, edit, pair) { pair = true;'],
  vorota: ['js/09-afisha.js', 'teaHold: false, masterApply: false };', 'teaHold: false, masterApply: true };'],
  tri3: ['js/09-afisha.js', "(n < FOTO_MAX ? '<label", "(n <= FOTO_MAX ? '<label"],
  bolshe8: ['js/09-afisha.js', "if (file.size > FOTO_IN_MAX) { b.err = slovo('foto.tooBig'); fotoRedraw(form); return; }", ''],
  szhat: ['js/09-afisha.js', 'if (d.squeezed === true) f.squeezed = true;', ''],
  zhdyot: ['js/18-ekrany-mastera.js', "(fotoBusy('masterApply') && !MR.busy ? fotoWaitBtn()", "(false ? fotoWaitBtn()"],
  pervym: ['js/09-afisha.js', 'b.list.splice(b.list.indexOf(f), 1); b.list.unshift(f);', 'b.list.splice(b.list.indexOf(f), 1); b.list.push(f);'],
  otkaz: ['js/09-afisha.js', 'gone(); b.err = denyText(r); b.verb = true;', "gone(); b.err = 'Не получилось'; b.verb = true;"],
  mV: ['js/09-afisha.js', 'function fotoBody(form, body) { if (LIVE && fotoOn(form) && FOTO[form])', 'function fotoBody(form, body) { if (FOTO[form])'],
  chay: ['js/09-afisha.js', 'teaHold: false, masterApply: false };', 'teaHold: true, masterApply: false };'],
  obshchij: ['js/09-afisha.js', 'function fotoOn(form) { return FOTO_ON[form] === true; }', 'function fotoOn(form) { return FOTO_ON.eventNew === true; }'],
};
if (mutant && !MUT[mutant] && mutant !== 'kvadrat') { console.error('нет такого мутанта: ' + mutant); process.exit(2); }
let k;
try { k = klient(root); } catch (e) { console.error('НЕ ВЫПОЛНЕНО: ' + e.message); process.exit(2); }
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, setAttribute() {},
  addEventListener() {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } });
const listeners = {};
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt, parseFloat, isFinite, Promise,
  document: { addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, getElementById() { return null; }, querySelector() { return null; },
    querySelectorAll() { return []; }, createElement: el, body: el(), documentElement: el() },
  window: { Telegram: undefined, location: { search: '', hash: '' }, addEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } },
  navigator: {}, location: { search: '', hash: '' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} }, setTimeout() {}, clearTimeout() {}, setInterval() {},
  fetch() { return new Promise(() => {}); }, URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} } };
ctx.window.document = ctx.document;
vm.createContext(ctx);
for (const f of k.files) {
  let text = f.text;
  if (MUT[mutant] && MUT[mutant][0] === f.file) {
    if (!text.includes(MUT[mutant][1])) { console.error('НЕ ВЫПОЛНЕНО: подмена не применилась: ' + MUT[mutant][1].slice(0, 60)); process.exit(2); }
    text = text.replace(MUT[mutant][1], MUT[mutant][2]); console.log('подлог наложен: ' + mutant);
  }
  try { vm.runInContext(text, ctx, { filename: f.file }); } catch (e) { /* верх файлов зовёт DOM; нужное — объявления, они подняты */ }
}
for (const fn of ['eventLive', 'teaAlbum', 'teaCardHtml', 'fotoBlock', 'fotoPick', 'fotoFrom', 'doAction']) {
  if (typeof ctx[fn] !== 'function') { console.error('НЕ ВЫПОЛНЕНО: нет функции ' + fn); process.exit(2); }
}
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
if (mutant === 'kvadrat') {
  const a = '.album-frame { position: relative; aspect-ratio: 1 / 1;';
  if (!css.includes(a)) { console.error('НЕ ВЫПОЛНЕНО: подмена css не применилась'); process.exit(2); }
  css = css.replace(a, '.album-frame { position: relative;'); console.log('подлог наложен: kvadrat');
}
const R = c => vm.runInContext(c, ctx);
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const cnt = (h, re) => (h.match(re) || []).length;
// вид альбома словами: крупный/превью/пара — по разметке
const vid = h => {
  const a = h.indexOf('<div class="album'); if (a < 0) return 'блока нет';
  const pair = h.includes('class="album album-pair"'), th = h.includes('album-thumbs');
  const fr = cnt(h, /class="album-frame/g), inThumbs = th ? cnt(h.slice(h.indexOf('album-thumbs')), /class="album-frame/g) : 0;
  return (pair ? 'пара' : 'крупный') + ', кадров ' + fr + ', в ряду превью ' + inThumbs + (th && !inThumbs ? ' (пустой ряд)' : '');
};
R("LIVE = true; DATA.member = { uid: 4242 }; DATA.role = 'member';");
const ev = (photos, over) => { ctx.__raw = Object.assign({ id: 501, title: 'Звук', starts_at: '2030-01-10T19:00:00+07:00', duration_min: 120,
  organizer_id: 9, organizer_first_name: 'Ведущий', seats: 10, seats_left: 10, taken: 0, kind: 'free', price: '0', approval: 'approved' },
  photos === undefined ? {} : { photos }, over || {}); return R('fromEvents([__raw])[0]'); };
const live = e => { ctx.__e = e; return R('eventLive(__e)'); };
const P = n => [1, 2, 3].slice(0, n).map(i => ({ id: 70 + i, url: '/photos/' + (70 + i) + '/' + 'ab'.repeat(16) + '.jpg', width: 1600, height: 1200 }));

// ── показ на карточке события (event.md) ──
const e3 = ev(P(3)), e2 = ev(P(2)), e1 = ev(P(1)), e0 = ev([]), eU = ev(undefined);
check('foto-tri: три снимка — крупный и два превью', vid(live(e3)), 'крупный, кадров 3, в ряду превью 2');
check('foto-tri: адрес кадра — сервер клуба + url ответа', (live(e3).match(/<img src="([^"]+)"/) || [])[1], 'https://api.cafe13.club/photos/71/' + 'ab'.repeat(16) + '.jpg');
check('foto-dva: два снимка — рядом половинами, пустой половины нет', vid(live(e2)), 'пара, кадров 2, в ряду превью 0');
check('foto-odin: один снимок — только крупный', vid(live(e1)), 'крупный, кадров 1, в ряду превью 0');
check('foto-net: снимков нет — блока нет', vid(live(e0)), 'блока нет');
check('foto-net: старое событие без поля photos — карточка та же, что с пустым списком', live(eU) === live(e0) ? 'та же' : 'другая', 'та же');
const rule = sel => { const m = css.match(new RegExp(sel.replace(/[.]/g, '\\.') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : ''; };
check('foto-dva: правило пары — две равные колонки', /grid-template-columns:\s*1fr 1fr/.test(rule('.album.album-pair')) ? 'две равные' : 'нет', 'две равные');
check('foto-gruzitsya: кадр — квадрат --surface до прихода снимка (высота не прыгает)',
  /aspect-ratio:\s*1 \/ 1/.test(rule('.album-frame')) && /background:\s*var\(--surface\)/.test(rule('.album-frame')) ? 'квадрат' : 'нет квадрата', 'квадрат');
// не загрузился: слушатель error прячет картинку, рамка остаётся; соседние кадры не трогаются
const no = { contains: () => false };
const img = { tagName: 'IMG', style: {}, classList: no, parentNode: { classList: { contains: c => c === 'album-frame' } } };
const other = { tagName: 'IMG', style: {}, classList: no, parentNode: { classList: no } };
for (const f of listeners.error || []) { try { f({ target: img }); f({ target: other }); } catch (e) { /* чужой слушатель, не наш */ } }
check('foto-ne-zagruzilsya: битый кадр — пустой квадрат', img.style.visibility || 'видна битая', 'hidden');
check('foto-ne-zagruzilsya: картинка вне альбома не трогается', other.style.visibility || 'не тронута', 'не тронута');
const F6 = 'Фото согласованы вместе с событием';
check('foto-zamorozheny: автор согласованного — F6', live(ev(P(2), { organizer_id: 4242 })).includes(F6) ? 'есть' : 'нет', 'есть');
check('foto-zamorozheny: гость того же события — F6 нет', live(ev(P(2))).includes(F6) ? 'есть' : 'нет', 'нет');
check('foto-zamorozheny: автор ждущего — F6 нет', live(ev(P(2), { organizer_id: 4242, approval: 'pending' })).includes(F6) ? 'есть' : 'нет', 'нет');
// ── П0: карточка мастера не тронута (решение координатора 26.11) ──
ctx.__c = { id: 7, name: 'М', about: 'A', price: '600', mins: 90, status: 'approved', approvedAt: '' };
[1, 2, 3].forEach((n, i) => { ctx.__c.shots = ['/s1.jpg', '/s2.jpg', '/s3.jpg'].slice(0, n);
  check('П0 карточка мастера, кадров ' + n + ' — побайтно как df86750', R('teaCardHtml(__c,{book:false})') === MASTER_DF86750[i] ? 'та же' : 'другая', 'та же'); });

// ── ворота: в живом masterApply закрыт (арт-директор приложенного не видит; Cafe13KPG#1123) ──
R("FOTO = {};");
check('ворота: живой режим — блока «Фото» в форме нет', R("fotoBlock('masterApply', 'Добавить фото')") === '' ? 'нет' : 'есть', 'нет');
check('ворота: живой режим — photo_ids в подачу не идёт', 'photo_ids' in R("fotoBody('masterApply', {})") ? 'идёт' : 'нет', 'нет');
// ── разделение карты (Cafe13KPG#1123): в живом открыты eventNew и eventEdit, закрыты teaHold и masterApply — одним
// замером на карте как в выкладке: блок «Фото» в форме, photo_ids в подаче, снятие черновика POST /photos/{id}/delete
{
  const dropped = []; const api0 = ctx.api; ctx.api = (m, u) => { dropped.push(m + ' ' + u); return new Promise(() => {}); };
  const door = form => {
    R("FOTO = {}"); const blok = R("fotoBlock('" + form + "', 'Добавить фото')") !== '';
    R("fotoOf('" + form + "', null, [{ id: 5, url: '/x5.jpg' }])"); const ids = 'photo_ids' in R("fotoBody('" + form + "', {})");
    dropped.length = 0; R("fotoDrop('" + form + "', 5)"); const drop = dropped.length > 0;
    return form + ': ' + (blok && ids && drop ? 'открыт' : !blok && !ids && !drop ? 'закрыт' : 'вразнобой (блок ' + blok + ', ids ' + ids + ', снятие ' + drop + ')');
  };
  check('ворота-karta: живой — открыт там, где есть показ; закрыт там, где снимок уйдёт без просмотра',
    ['eventNew', 'eventEdit', 'teaHold', 'masterApply'].map(door).join('; '), 'eventNew: открыт; eventEdit: открыт; teaHold: закрыт; masterApply: закрыт');
  ctx.api = api0; R("FOTO = {}");
}

// ── форма (masterApply.md), витрина ──
R("LIVE = false; FOTO = {}; current = 'нигде';");
const frame = (id, sq) => '{ k: ' + id + ', id: ' + id + ", url: '/x" + id + ".jpg', squeezed: " + !!sq + ', loading: false, draft: true }';
const box = (...items) => R("FOTO.masterApply = { of: null, err: '', verb: false, list: [" + items.join(',') + '] }');
const blk = () => R("fotoBlock('masterApply', slovo('foto.add'))");
const order = () => R("fotoIds('masterApply').join(',')");
box(frame(1), frame(2), frame(3));
check('foto-dobavit-tri: три кадра — «Добавить фото» нет', blk().includes('Добавить фото') ? 'есть' : 'нет', 'нет');
R("fotoAction('foto-del', 'masterApply:2')");
check('foto-ubrat: убран второй из трёх — кнопка вернулась', blk().includes('Добавить фото') ? 'есть' : 'нет', 'есть');
check('foto-ubrat: порядок остальных прежний', order(), '1,3');
box(frame(1), frame(2), frame(3));
R("fotoAction('foto-first', 'masterApply:3')");
check('foto-pervym: «Сделать первым» у третьего — он первый, прежний первый — второй', order(), '3,1,2');
check('foto-pervym: у первого кадра «Сделать первым» нет', cnt(blk(), /Сделать первым/g), 2);
const SQ = 'Большие снимки уменьшили';
box(frame(1), frame(2, true));
check('foto-szhatie: сжатый кадр — P6 одной строкой', cnt(blk(), new RegExp(SQ, 'g')), 1);
R("fotoAction('foto-del', 'masterApply:2')");
check('foto-szhatie: убран сжатый — P6 нет', blk().includes(SQ) ? 'есть' : 'нет', 'нет');
// выбор файла: клиентские пределы до отправки
const calls = [];
ctx.api = (m, u, body) => { calls.push(m + ' ' + u); return Promise.resolve(ctx.__reply); };
R("fotoShrink = function (f) { return Promise.resolve({ blob: f, squeezed: !!f.big }); }");
box();
ctx.__f = { type: 'application/pdf', size: 1000 }; R("fotoPick('masterApply', __f)");
check('foto-ne-foto: не картинка — P8', blk().includes('Это не фото') ? 'P8' : 'нет P8', 'P8');

(async () => {
  // живой режим с включённой загрузкой — так, как станет после выкладки
  R("LIVE = true; FOTO_ON.masterApply = true; FOTO = {}; box = null;");
  box();
  const flush = () => new Promise(r => setImmediate(r));
  // P7 в живом: клиент судит 8 МБ до отправки — запроса нет вовсе (сервер судит тот же предел сам)
  ctx.api = (m, u) => { calls.push(m + ' ' + u); return Promise.resolve({ status: 413, data: { detail: 'снимок больше 8 МБ — выберите поменьше', code: 'photo_too_big' } }); };
  ctx.__f = { type: 'image/jpeg', size: 9 * 1024 * 1024 }; R("fotoPick('masterApply', __f)"); await flush(); await flush();
  check('foto-bolshe-8: файл 9 МБ — P7, запроса нет', (blk().includes('Снимок больше 8 МБ') ? 'P7' : 'нет P7') + ', запросов ' + calls.length, 'P7, запросов 0');
  R("FOTO.masterApply.list = []; FOTO.masterApply.err = '';");
  // грузится: кадр на месте, подача ждёт
  let hold; ctx.api = (m, u, body) => { calls.push(m + ' ' + u + (body && body.type ? ' ' + body.type : '')); return new Promise(r => { hold = r; }); };
  ctx.__f = { type: 'image/png', size: 1000 }; R("fotoPick('masterApply', __f)"); await flush();
  check('foto-gruzitsya (форма): кадр P5 на месте, «Загружаем…», «Убрать» есть', (blk().includes('Загружаем…') ? 'P5' : 'нет P5') + (blk().includes('foto-del:') ? ', убрать' : ''), 'P5, убрать');
  check('POST /photos — тело сам файл своего типа', calls[calls.length - 1], 'POST /photos image/png');
  R("MR.busy = false; MSF.title = 'Вечер';");
  let scr = ''; try { scr = R("SCREENS.masterApply()"); } catch (e) { scr = 'экран упал: ' + e.message; }
  check('foto-podacha-zhdyot: подача при P5 — «Загружаем фото…», погашена', /<button type="button" class="btn" disabled>Загружаем фото…<\/button>/.test(scr) ? 'ждёт' : 'не ждёт', 'ждёт');
  hold({ status: 201, data: { id: 91, url: '/photos/91/' + 'cd'.repeat(16) + '.jpg', width: 1600, height: 900, bytes: 1, sha256: 'x', squeezed: true } }); await flush();
  check('сжал сервер (squeezed: true) — P6 есть (решение координатора 26.11)', blk().includes(SQ) ? 'есть' : 'нет', 'есть');
  check('photo_ids в подачу — номер ответа', JSON.stringify(R("fotoBody('masterApply', {})").photo_ids), '[91]');
  // отказ сервера — словом сервера, кадр убран
  // отказ photo_busy (photos.py: 503 + Retry-After) — текст сервера дословно
  ctx.api = () => Promise.resolve({ status: 503, data: { detail: 'сервер занят другими снимками — попробуйте через минуту', code: 'photo_busy' } });
  ctx.__f = { type: 'image/png', size: 1000 }; R("fotoPick('masterApply', __f)"); await flush(); await flush();
  const b = blk();
  check('P9: отказ сервера — его слово как есть, .verbatim', /class="verbatim">Сервер занят другими снимками — попробуйте через минуту/.test(b) ? 'как есть' : 'переписан', 'как есть');
  check('P9: отказанный кадр убран', order(), '91');
  // eventEdit (eventEdit.md): согласованное — заморожено, видно до попытки
  R("LIVE = false; FOTO = {};");
  const edit = (photos, appr) => { const e = ev(photos, { approval: appr }); ctx.__e = e; R("eventList = function () { return [__e]; }; EDT.id = __e.id;"); try { return R("SCREENS.eventEdit(__e.id)"); } catch (x) { return 'экран упал: ' + x.message; } };
  let h = edit(P(2), 'pending');
  check('foto-pravka-do: не согласовано — «Добавить фото» и «Убрать» есть', (h.includes('Добавить фото') ? 'P4' : 'нет P4') + (h.includes('foto-del:') ? ', убрать' : ''), 'P4, убрать');
  R("FOTO = {};"); h = edit(P(2), 'approved');
  check('foto-pravka-zamorozheny: два снимка — альбом и F6, кнопок нет',
    vid(h) + (h.includes(F6) ? ', F6' : '') + (/Добавить фото|foto-del:|foto-first:/.test(h) ? ', кнопки' : ''), 'пара, кадров 2, в ряду превью 0, F6');
  check('foto-pravka-zamorozheny: «Сохранить» есть', h.includes('data-action="edt-save"') ? 'есть' : 'нет', 'есть');
  R("FOTO = {};"); h = edit([], 'approved');
  check('foto-pravka-zamorozheny-pusto: «Фото» и F6, альбома и P4 нет',
    (h.includes('>Фото<') ? 'P1' : 'нет P1') + (h.includes(F6) ? ', F6' : '') + (h.includes('<div class="album') ? ', альбом' : '') + (h.includes('Добавить фото') ? ', P4' : ''), 'P1, F6');
  // ── ворота правки (находка mV): в живом при закрытом eventEdit «Сохранить» несогласованного не шлёт photo_ids.
  // Экран правки зовёт fotoOf('eventEdit') без fotoForm() — набор формы в живом есть всегда; судит только гейт fotoBody.
  // В выкладке eventEdit открыт — здесь он закрыт в карте нарочно: судится сам гейт, а не значение карты.
  // свой ждущий согласования вечер ведущего с правом на события (grant curator) — экран правки открыт, «Сохранить» живо
  R("LIVE = true; FOTO_ON.eventEdit = false; FOTO = {}; DATA.grants = [{ role: 'curator' }]; render = function () {};");
  const sent = [];
  ctx.api = (m, u, body) => { sent.push({ m, u, body }); return new Promise(() => {}); };
  ctx.__e = ev(P(2), { approval: 'pending', organizer_id: 4242 });
  R("eventList = function () { return [__e]; }; eventById = function () { return __e; }; EDT.id = __e.id;");
  check('ворота-pravka: живой — экран правки своего ждущего открыт', /data-action="edt-save"/.test(R("SCREENS.eventEdit(__e.id)")) ? 'открыт' : 'отказ', 'открыт');
  R("EDT.busy = false; EDT.seats = '10'; EDT.about = ''; EDT.price = '0'; editSave();");
  const post = sent.find(c => c.m === 'POST' && /^\/events\/\d+\/edit$/.test(c.u));
  check('ворота-pravka: живой, eventEdit закрыт — набор формы есть (гейт держит один fotoBody)', R("FOTO.eventEdit ? 'есть' : 'нет'"), 'есть');
  check('ворота-pravka: живой, eventEdit закрыт — правка несогласованного: photo_ids не уходит',
    post ? ('photo_ids' in post.body ? 'уходит (бой: 422 extra=forbid)' : 'не уходит') : 'запроса правки нет', 'не уходит');
  const red = ok.filter(x => !x).length;
  console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
  process.exit(red ? 1 : 0);
})().catch(e => { console.error('НЕ ВЫПОЛНЕНО: ' + e.message); process.exit(2); });
