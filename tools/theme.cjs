const { chromium } = require('playwright');
const fs = require('fs');

/* Стенд темы и безопасных зон (#101). Доказывает НЕ «экран изменился», а что
   цвет на отрисованном кадре равен ЗАПРОШЕННОМУ: переключение colorScheme
   меняет вид и без чтения themeParams, поэтому «кадры различаются» — проверка,
   которую данные не различают.

   Чем он отличается от tools/live.cjs, и почему это отдельный файл:
   — там подделка Telegram отвечает isVersionAtLeast() → true на ЛЮБУЮ версию,
     а полей темы в ней нет вовсе; здесь проверка версии ЧЕСТНАЯ (сравнивает),
     и это даёт случай «клиент постарше» как отдельный приговор;
   — там двадцать с лишним случаев идут через одну инициализацию, и поля темы,
     добавленные в общую подделку, изменили бы условия всех чужих случаев;
   — живой режим проверяет ТЕКСТ, а облик он не проверяет вовсе: во всём
     live.cjs слово color встречается один раз.

   ⚠ Настоящий telegram-web-app.js здесь, как и там, подменён — значит
   CSS-переменные --tg-theme-*, которые публикует он, в стенде не появляются
   и проверить решение, опирающееся на них, этим стендом нельзя (замер
   совпал бы с самим собой). Поэтому цвета читает JS, а не CSS.

   Запуск: docker run --rm -v $PWD:/app:ro -v <снимки>:/work -w /work \
     --entrypoint node agenthost/playwright:1.59.1 /app/tools/theme.cjs */

const ROOT = process.env.APP || '/app';
const OUT = process.env.OUT || '/work';

/* Фикстуры заведомо ненейтральные и РАЗНЫЕ, иначе сравниваются два нуля.
   Цвета нарочно переставлены между ролями: #FF00FF — фон у A и действие у B.
   Раскладка, перепутавшая поля, на такой фикстуре краснеет, а на «фон серый,
   действие серое» прошла бы. */
const FIX = {
  A: { bg_color: '#FF00FF', secondary_bg_color: '#FFEE00', text_color: '#001133',
       hint_color: '#445566', button_color: '#00FF88', button_text_color: '#220011' },
  B: { bg_color: '#00FF88', secondary_bg_color: '#110022', text_color: '#FFEE00',
       hint_color: '#99AABB', button_color: '#FF00FF', button_text_color: '#FFFFFF' }
};
const SAFE = { safeAreaInset:        { top: 44, bottom: 34, left: 0, right: 0 },
               contentSafeAreaInset: { top: 56, bottom: 0,  left: 0, right: 0 } };

/* Ожидаемая геометрия считается ЗДЕСЬ, по той же формуле, что в styles.css,
   но записанной отдельно: совпадение — это сверка двух независимых записей
   правила, а не копия одной. Вырез берётся максимумом из env() (в прогоне 0)
   и safeAreaInset, зона контента прибавляется. */
const BAR  = 58 + Math.max(0, SAFE.safeAreaInset.top)    + SAFE.contentSafeAreaInset.top;
const TABS = 74 + Math.max(0, SAFE.safeAreaInset.bottom) + SAFE.contentSafeAreaInset.bottom;

function tgStub(theme, safe, ver, scheme) {
  return `window.__tgCalls = [];
  window.Telegram = { WebApp: {
    platform: 'ios', version: ${JSON.stringify(ver)},
    initData: 'query_id=AAE&hash=stub', initDataUnsafe: { user: { id: 1 } },
    colorScheme: ${JSON.stringify(scheme)},
    ${theme ? 'themeParams: ' + JSON.stringify(theme) + ',' : ''}
    ${safe ? 'safeAreaInset: ' + JSON.stringify(safe.safeAreaInset) + ',' : ''}
    ${safe ? 'contentSafeAreaInset: ' + JSON.stringify(safe.contentSafeAreaInset) + ',' : ''}
    /* Честно, а не «true на всё»: иначе случай со старым клиентом непроверяем. */
    isVersionAtLeast: function (v) { return parseFloat(${JSON.stringify(ver)}) >= parseFloat(v); },
    /* Шпионы, а не пустышки: приговор выносится по ЗНАЧЕНИЮ аргумента. */
    setHeaderColor: function (c) { window.__tgCalls.push('setHeaderColor:' + c); },
    setBackgroundColor: function (c) { window.__tgCalls.push('setBackgroundColor:' + c); },
    ready: function () {}, expand: function () {}, onEvent: function () {},
    HapticFeedback: { notificationOccurred: function () {}, selectionChanged: function () {} },
    BackButton: { onClick: function () {}, offClick: function () {}, show: function () {}, hide: function () {} },
    MainButton: { setText: function () {}, show: function () {}, hide: function () {},
                  onClick: function () {}, offClick: function () {} }
  } };`;
}

/* Выключатель ищется ровно один раз — как в live.cjs: опечатка в шаблоне
   иначе молча оставила бы живой режим и увела стенд на сервер. */
const src = fs.readFileSync(ROOT + '/app.js', 'utf8');
const decl = src.match(/^\s*(var|let|const)\s+API_ON\s*=.*$/gm) || [];
if (decl.length !== 1) {
  console.error('КРАСНОЕ: app.js: объявление API_ON найдено ' + decl.length + ' раз, ждали 1');
  process.exit(1);
}
const demo = src.replace(/var API_ON = (true|false);/, 'var API_ON = false;');

/* Мутации. Каждая обязана ПРИМЕНИТЬСЯ (иначе «не покраснело» — ложь прибора)
   и обязана покраснить ИМЕННО названные проверки, а не любые. */
const MUT = {
  colors: { find: 'if (c) root.style.setProperty(r[0], c);',
            put:  'if (c) { /* мутация: раскладка цвета снята */ }',
            reddens: ['токен --paper', 'токен --ink', 'токен --accent', 'токен --surface', 'пиксель фона'] },
  safe:   { find: "if (typeof v === 'number' && v >= 0) root.style.setProperty(r[0], v + 'px');",
            put:  "if (typeof v === 'number' && v >= 0) { /* мутация: зоны сняты */ }",
            reddens: ['высота шапки', 'высота панели'] },
  header: { find: "if (tg.setHeaderColor) tg.setHeaderColor('bg_color');",
            put:  "if (tg.setHeaderColor) { /* мутация: шапка не красится */ }",
            reddens: ['вызов setHeaderColor'] }
};

function body(mut) {
  if (!mut) return demo;
  const m = MUT[mut];
  const n = demo.split(m.find).length - 1;
  if (n !== 1) {
    console.error('КРАСНОЕ: мутация «' + mut + '» не применилась: образец найден ' + n + ' раз, ждали 1');
    process.exit(1);
  }
  return demo.replace(m.find, m.put);
}

/* Пиксель читается с ОТРИСОВАННОГО кадра, а не из getComputedStyle: два экрана
   уже уезжали на показ с чёрным квадратом вместо логотипа, потому что смотрели
   в исходник. Декодирует кадр сам браузер — в пустой странице через canvas. */
async function pixel(ctx, png, x, y) {
  const p = await ctx.newPage();
  const rgb = await p.evaluate(async d => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = d; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const q = c.getContext('2d').getImageData(window.__x, window.__y, 1, 1).data;
    return '#' + [q[0], q[1], q[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  }, 'data:image/png;base64,' + png.toString('base64'));
  await p.close();
  return rgb.toUpperCase();
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const bad = [], reached = new Set();

  /* deviceScaleFactor 1 — чтобы пиксель кадра и CSS-пиксель были одним и тем
     же числом: иначе арифметика кадра тихо разойдётся с геометрией. */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
                                   deviceScaleFactor: 1, locale: 'ru-RU' });
  await ctx.addInitScript(() => { try { localStorage.setItem('cafe13.consent', '0.1'); } catch (e) {} });
  await ctx.addInitScript(() => { window.__x = 5; window.__y = 5; });

  async function open({ theme, safe, ver = '8.0', mut = null, scheme = 'light' }) {
    const p = await ctx.newPage();
    const errs = [], calls = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('https://telegram.org/**', r =>
      r.fulfill({ contentType: 'text/javascript', body: tgStub(theme, safe, ver, scheme) }));
    await p.route('**/app.js*', r =>
      r.fulfill({ contentType: 'text/javascript', body: body(mut) }));
    /* Сервера здесь нет вовсе: любой запрос наружу — сам по себе отказ. */
    await p.route('https://api.cafe13.club/**', r => { calls.push(r.request().url()); return r.abort(); });
    await p.goto('file://' + ROOT + '/index.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(150);
    return { p, errs, calls };
  }

  /* Проверка называет СВОЙСТВО и печатает оба значения — приговор по тексту,
     а не по слову «покраснело». reached помечает, что прогон до неё дошёл. */
  function eq(name, got, want, where) {
    reached.add(name);
    if (String(got).toUpperCase() !== String(want).toUpperCase())
      bad.push(`${where}: ${name} = ${got}, запрошено ${want}`);
  }

  async function measure(o, name) {
    const s = await open(o);
    const css = await s.p.evaluate(() => {
      const r = getComputedStyle(document.documentElement);
      const box = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect();
                          return { h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
      return { scheme: document.documentElement.getAttribute('data-theme'),
               paper: r.getPropertyValue('--paper').trim(), ink: r.getPropertyValue('--ink').trim(),
               accent: r.getPropertyValue('--accent').trim(), surface: r.getPropertyValue('--surface').trim(),
               bar: box('bar'), tabs: box('tabs'),
               calls: (window.__tgCalls || []).slice() };
    });
    const png = await s.p.screenshot();
    fs.writeFileSync(OUT + '/' + name + '.png', png);
    const px = await pixel(ctx, png, 5, 5);
    await s.p.close();
    return { css, px, errs: s.errs, calls: s.calls };
  }

  /* ── 1. цвета читаются и равны запрошенным, на двух разных фикстурах ── */
  for (const k of ['A', 'B']) {
    const m = await measure({ theme: FIX[k], safe: SAFE }, 'theme-' + k);
    const w = `фикстура ${k}`;
    eq('токен --paper', m.css.paper, FIX[k].bg_color, w);
    eq('токен --ink', m.css.ink, FIX[k].text_color, w);
    eq('токен --accent', m.css.accent, FIX[k].button_color, w);
    eq('токен --surface', m.css.surface, FIX[k].secondary_bg_color, w);
    eq('пиксель фона', m.px, FIX[k].bg_color, w);
    eq('вызов setHeaderColor', m.css.calls.includes('setHeaderColor:bg_color'), true, w);
    eq('вызов setBackgroundColor', m.css.calls.includes('setBackgroundColor:bg_color'), true, w);
    eq('высота шапки', m.css.bar.h, BAR, w);
    eq('высота панели', m.css.tabs.h, TABS, w);
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}»`);
    if (m.calls.length) bad.push(`${w}: запросов наружу ${m.calls.length}, ждали 0`);
  }

  /* ── 2. поля нет — токен СНЯТ, а не застрял: фолбэк, а не помесь палитр ── */
  {
    const part = { bg_color: '#FF00FF' };                 // только фон, остального нет
    const m = await measure({ theme: part, safe: SAFE }, 'theme-partial');
    const w = 'фикстура «только фон»';
    eq('токен --paper', m.css.paper, '#FF00FF', w);
    eq('фолбэк --accent', m.css.accent, '#2B2A28', w);    // фирменная тушь из styles.css
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}»`);
  }

  /* ── 3. клиент постарше: ворота закрыты, и это не падение ── */
  {
    const m = await measure({ theme: FIX.A, safe: SAFE, ver: '6.0' }, 'theme-old-client');
    const w = 'клиент 6.0';
    reached.add('старый клиент без зон');
    if (m.css.bar.h !== 58) bad.push(`${w}: высота шапки ${m.css.bar.h}, ждали 58 (зоны 8.0 недоступны)`);
    if (m.css.calls.length) bad.push(`${w}: вызовов ${m.css.calls.length}, ждали 0 (сеттеры с 6.1)`);
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}»`);
    /* Цвета при этом читаться ОБЯЗАНЫ: themeParams версии не требует. */
    eq('токен --paper', m.css.paper, FIX.A.bg_color, w);
  }

  /* ── 4. темы нет вовсе (обычный браузер): фирменная палитра целиком ── */
  {
    const m = await measure({ theme: null, safe: null }, 'theme-none');
    const w = 'без темы';
    eq('фолбэк --paper', m.css.paper, '#FFFFFF', w);
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}» — незащищённое чтение themeParams`);
    if (m.css.bar.h !== 58) bad.push(`${w}: высота шапки ${m.css.bar.h}, ждали 58`);
  }

  /* ── 4а. тёмная схема БЕЗ цветов человека: день/ночь клиент держал и до
     #101, и обязан держать после. Это та самая ветка, на которой проверка
     «экран изменился» зеленеет, ничего не доказав. ── */
  {
    const m = await measure({ theme: null, safe: null, scheme: 'dark' }, 'theme-dark-brand');
    const w = 'тёмная схема без темы';
    eq('признак data-theme', m.css.scheme, 'dark', w);
    eq('фолбэк --paper тёмный', m.css.paper, '#190F26', w);
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}»`);
  }

  /* ── 4б. тёмная схема И цвета человека: выигрывает человек, а не наша
     тёмная палитра — иначе чужая тема видна только в светлой. ── */
  {
    const m = await measure({ theme: FIX.B, safe: SAFE, scheme: 'dark' }, 'theme-dark-user');
    const w = 'тёмная схема с темой';
    eq('признак data-theme', m.css.scheme, 'dark', w);
    eq('токен --paper', m.css.paper, FIX.B.bg_color, w);
    eq('пиксель фона', m.px, FIX.B.bg_color, w);
  }

  /* ── 5. снятие проверяемого: каждая мутация обязана покраснить ИМЕННО
     свои проверки — и не покраснить лишние. Покраснело лишнее — значит
     прогон упал раньше проверяемого места, и красное получено обманом. ── */
  const WANT = { 'токен --paper': FIX.A.bg_color, 'токен --ink': FIX.A.text_color,
                 'токен --accent': FIX.A.button_color, 'токен --surface': FIX.A.secondary_bg_color,
                 'пиксель фона': FIX.A.bg_color, 'высота шапки': BAR, 'высота панели': TABS,
                 'вызов setHeaderColor': true };

  for (const name of Object.keys(MUT)) {
    const m = await measure({ theme: FIX.A, safe: SAFE, mut: name }, 'mut-' + name);
    const got = { 'токен --paper': m.css.paper, 'токен --ink': m.css.ink,
                  'токен --accent': m.css.accent, 'токен --surface': m.css.surface,
                  'пиксель фона': m.px, 'высота шапки': m.css.bar.h, 'высота панели': m.css.tabs.h,
                  'вызов setHeaderColor': m.css.calls.includes('setHeaderColor:bg_color') };
    const texts = [];
    for (const k of Object.keys(WANT)) {
      const red = String(got[k]).toUpperCase() !== String(WANT[k]).toUpperCase();
      const should = MUT[name].reddens.includes(k);
      if (red) texts.push(`${k} = ${got[k]}, запрошено ${WANT[k]}`);
      if (should && !red)
        bad.push(`мутация «${name}»: ${k} НЕ покраснел (${got[k]}) — проверка ничего не проверяет`);
      if (!should && red)
        bad.push(`мутация «${name}»: покраснело лишнее — ${k} = ${got[k]}, ждали ${WANT[k]}`);
    }
    if (m.errs.length) bad.push(`мутация «${name}»: ошибка страницы «${m.errs[0]}» — прогон умер, а не покраснел`);
    console.log(`мутация «${name}» краснеет текстом: ${texts.length ? texts.join(' | ') : 'НИЧЕМ'}`);
  }

  await ctx.close();
  await b.close();

  console.log('проверок дошло: ' + reached.size + ' — ' + [...reached].join(' · '));
  if (bad.length) { console.log('КРАСНОЕ:'); bad.forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('ЗЕЛЁНОЕ: тема и безопасные зоны читаются, значения равны запрошенным');
})().catch(e => { console.error('ПРОГОН УПАЛ: ' + e.message); process.exit(2); });
