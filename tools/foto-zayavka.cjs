// Снимки заявки мастера у того, кто её решает, шаг 44, без браузера: node tools/foto-zayavka.cjs <корень клиента> [мутант]
// Рецепт `_docs/recept/ekran/foto/masterReq.md`; сервер cafe13-api b9ba0e7, app/routers/master.py:237–249 (`ROW_SQL`
// несёт `photos` у `/master/requests`, `/master/requests/mine` и ответа подачи). Клиент грузится целиком по index.html
// (tools/klient.cjs) в vm, DOM — заглушки, как в tools/foto-pokaz.cjs. Мутанты (каждый обязан дать КРАСНОЕ своей строкой
// и rc=1, синхронно):
//   chit — разборщик заявки не читает `photos` (как до шага: арт-директор приложенного не видит);
//   pokaz — экран решения альбом не рисует;  flag — показ подвешен на флаг загрузки FOTO_ON.masterApply;
//   poryadok — альбом стоит ПОСЛЕ кнопки «Согласовать» (решение раньше, чем снимки видны);
//   uronit — битый кадр роняет всю заявку (а с ней очередь целиком: fromMasterList);
//   pusto — альбом рисуется и без снимков (рецепт: блока нет);  para — у двух кадров снят вид «пара».
'use strict';
const vm = require('vm'), path = require('path');
const root = process.argv[2], mutant = process.argv[3] || '';
if (!root) { console.error('корень клиента первым аргументом'); process.exit(2); }
const { klient } = require(path.resolve(__dirname, 'klient.cjs'));
const ALB = "(q.photos && q.photos.length ? teaAlbum(q.photos, null, true) : '') +";
const MUT = {
  chit: ['js/07-mastera.js', 'r.photos = fotoFrom(x.photos);', 'r.photos = [];'],
  pokaz: ['js/18-ekrany-mastera.js', ALB, ''],
  flag: ['js/18-ekrany-mastera.js', ALB, "(fotoOn('masterApply') && q.photos && q.photos.length ? teaAlbum(q.photos, null, true) : '') +"],
  poryadok: ['js/18-ekrany-mastera.js', ALB, "'' +"],
  uronit: ['js/07-mastera.js', 'r.photos = fotoFrom(x.photos);', 'r.photos = fotoFrom(x.photos); if (Array.isArray(x.photos) && r.photos.length !== x.photos.length) return null;'],
  pusto: ['js/18-ekrany-mastera.js', ALB, "teaAlbum(q.photos && q.photos.length ? q.photos : [''], null, true) +"],
  para: ['js/18-ekrany-mastera.js', ALB, "(q.photos && q.photos.length ? teaAlbum(q.photos, null, false) : '') +"],
};
// poryadok: альбом переносится к концу экрана — вторая подмена ниже, по месту кнопок
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
let applied = 0;
for (const f of k.files) {
  let text = f.text;
  if (MUT[mutant] && MUT[mutant][0] === f.file) {
    if (!text.includes(MUT[mutant][1])) { console.error('НЕ ВЫПОЛНЕНО: подмена не применилась: ' + MUT[mutant][1].slice(0, 60)); process.exit(2); }
    text = text.replace(MUT[mutant][1], MUT[mutant][2]); applied++;
    if (mutant === 'poryadok') {
      const tail = "'<span class=\"small\">Деньги вернутся мастеру на счёт.</span>');";
      if (!text.includes(tail)) { console.error('НЕ ВЫПОЛНЕНО: вторая подмена poryadok не применилась'); process.exit(2); }
      text = text.replace(tail, "'<span class=\"small\">Деньги вернутся мастеру на счёт.</span>') + " + ALB.slice(0, -2) + ';');
    }
    console.log('подлог наложен: ' + mutant);
  }
  try { vm.runInContext(text, ctx, { filename: f.file }); } catch (e) { /* верх файлов зовёт DOM; нужное — объявления, они подняты */ }
}
if (mutant && !applied) { console.error('НЕ ВЫПОЛНЕНО: файл мутанта не загружен'); process.exit(2); }
for (const fn of ['fromMasterReq', 'fromMasterList', 'fotoFrom', 'teaAlbum']) {
  if (typeof ctx[fn] !== 'function') { console.error('НЕ ВЫПОЛНЕНО: нет функции ' + fn); process.exit(2); }
}
const R = c => vm.runInContext(c, ctx);
if (typeof R('SCREENS.masterReq') !== 'function') { console.error('НЕ ВЫПОЛНЕНО: нет экрана masterReq'); process.exit(2); }
const ok = [];
const check = (name, got, want) => { ok.push(got === want); console.log((got === want ? '✓ ' : '✗ ') + name + ' — ' + got + (got === want ? '' : ', ждали ' + want)); };
const cnt = (h, re) => (h.match(re) || []).length;
const vid = h => {
  if (h.indexOf('<div class="album') < 0) return 'блока нет';
  const pair = h.includes('class="album album-pair"'), th = h.includes('album-thumbs');
  return (pair ? 'пара' : 'крупный') + ', кадров ' + cnt(h, /class="album-frame/g) + (th ? ', ряд превью' : '');
};
const P = n => [1, 2, 3].slice(0, n).map(i => ({ id: 80 + i, url: '/photos/' + (80 + i) + '/' + 'cd'.repeat(16) + '.jpg', width: 1600, height: 1200 }));
// строка очереди арт-директора — форма ROW_SQL + имя (master.py:511–524)
const raw = (photos, over) => Object.assign({ id: 610, title: 'Звуковая практика', about: 'Чаши и гонг.', seats: 8, place_name: 'Зал',
  occupancy: 'event', weekday: 3, start_local: '18:30', hours: 2, hours_extra: 0, amount: '100.00', status: 'pending',
  status_ru: 'ждёт решения', decision_note: null, created_at: '2030-01-01T10:00:00+07:00', decided_at: null,
  starts_at: '2030-01-09T18:30:00+07:00', first_name: 'Мастер', last_name: null, username: null },
  photos === undefined ? {} : { photos }, over || {});
const parse = (photos, over) => { ctx.__raw = raw(photos, over); return R('fromMasterReq(__raw, true)'); };
const screen = r => { ctx.__r = r; R('MR.q = [__r]; MR.mine = []; MR.ask = null; MR.busy = false; MR.qErr = ""; FLASH = null;'); return R('SCREENS.masterReq(' + r.id + ')'); };

// ── разбор ответа ──
const r3 = parse(P(3));
const nph = r => r ? (Array.isArray(r.photos) ? String(r.photos.length) : 'поля photos нет') : 'заявки нет';
check('zayavka-chit: три снимка дошли до заявки', nph(r3), '3');
check('zayavka-chit: адрес — сервер клуба + url ответа, порядок автора', r3 && r3.photos && r3.photos.length ? r3.photos.map(p => p.id).join(',') + ' ' + r3.photos[0].url : 'снимков нет',
  '81,82,83 https://api.cafe13.club/photos/81/' + 'cd'.repeat(16) + '.jpg');
const rU = parse(undefined);
check('zayavka-bez-polya: сервер без photos — заявка жива, снимков 0', nph(rU), '0');
const rB = parse([P(1)[0], { id: 'x', url: 5 }]);
check('zayavka-bityj: битый кадр отброшен, заявка жива', nph(rB), '1');
ctx.__list = { requests: [raw([{ id: 'x' }]), raw(P(2), { id: 611 })], pending: 2 };
check('zayavka-bityj: очередь с битым кадром не пропала', String((R('fromMasterList(__list, true)') || { list: [] }).list.length), '2');

// ── экран решения арт-директора ──
const h3 = screen(r3);
check('zayavka-tri: экран решения — крупный и два превью', vid(h3), 'крупный, кадров 3, ряд превью');
const ia = h3.indexOf('<div class="album'), iy = h3.indexOf('data-action="ms-yes:'), it = h3.indexOf('Звуковая практика');
check('zayavka-poryadok: снимки после названия и ДО «Согласовать»', ia > it && iy > ia ? 'до кнопки' : 'альбом ' + ia + ', кнопка ' + iy, 'до кнопки');
check('zayavka-dva: два снимка — пара', vid(screen(parse(P(2)))), 'пара, кадров 2');
check('zayavka-odin: один снимок — крупный', vid(screen(parse(P(1)))), 'крупный, кадров 1');
check('zayavka-net: снимков нет — блока нет', vid(screen(parse([]))), 'блока нет');
check('zayavka-net: старый сервер без поля — экран как с пустым списком', screen(parse(undefined)) === screen(parse([])) ? 'тот же' : 'другой', 'тот же');
check('zayavka-chay: заявка церемонии (occupancy tea) — снимки видны', vid(screen(parse(P(3), { occupancy: 'tea' }))), 'крупный, кадров 3, ряд превью');
check('zayavka-resheno: согласованная — снимки видны и после решения',
  vid(screen(parse(P(1), { status: 'approved', status_ru: 'одобрена', decided_at: '2030-01-02T10:00:00+07:00' }))), 'крупный, кадров 1');
R("FOTO_ON.masterApply = false; FOTO_ON.teaHold = false; FOTO_ON.eventNew = false; FOTO_ON.eventEdit = false;");
check('zayavka-flag: все флаги загрузки закрыты — показ тот же', vid(screen(parse(P(2)))), 'пара, кадров 2');
R("FOTO_ON.masterApply = true;");
check('zayavka-flag: флаг загрузки открыт — показ тот же', vid(screen(parse(P(2)))), 'пара, кадров 2');
R("FOTO_ON.masterApply = false;");

const red = ok.filter(x => !x).length;
console.log(red ? `КРАСНОЕ: ${red} из ${ok.length}` : `ЗЕЛЁНОЕ: ${ok.length} из ${ok.length}`);
process.exit(red ? 1 : 0);
