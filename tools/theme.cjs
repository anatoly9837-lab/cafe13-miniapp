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

   ⚠ Чего стенд НЕ проверяет, и это предел прибора, а не недоделка:
   в headless env(safe-area-inset-*) равен нулю, поэтому max(env, tg) и
   env + tg дают здесь одно и то же число. Выбор максимума взят из текста
   документации (env знает про вырез, зоны Telegram — про свои элементы
   управления) и мутацией не подтверждён: отличить эти две формулы можно
   только на клиенте с настоящим вырезом.

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
/* Четыре числа РАЗНЫЕ и ни одно не ноль. Ноль в contentSafeAreaInset.bottom
   делал нижнюю ветвь неотличимой: слагаемое var(--tg-cab) можно было убрать,
   и высота панели не менялась — мутация зеленела на сравнении двух нулей.
   Карточка #101 требует, чтобы мутировалась КАЖДАЯ ветвь, а ветвь мутируема
   только тогда, когда видна в числе. */
/* Роль действия, заданная НАПОЛОВИНУ: цвет кнопки человека есть, цвета
   текста на ней нет. Ни одна прежняя фикстура этого не давала — в A и B
   заданы оба поля, в «только фон» ни одного, — и фолбэк текста кнопки
   поэтому не проверялся вовсе (Cafe13KPG#136). Пробел ОБЕИХ редакций:
   и когда фолбэком был var(--paper), и когда стал литералом. */
const HALF = { bg_color: '#FF00FF', button_color: '#00FF88' };

const SAFE = { safeAreaInset:        { top: 44, bottom: 34, left: 0, right: 0 },
               contentSafeAreaInset: { top: 56, bottom: 21, left: 0, right: 0 } };

/* Фирменные значения из styles.css, названные ОДИН раз: «фолбэк» в десяти
   местах разными литералами — десять мест, где опечатка выглядит как факт. */
const BRAND = { ink: '#15171A', paper: '#F2F2EE', surface: '#EDEDE8', muted: '#5A5F63',
                accent: '#8A5F1E', accentInk: '#FFFFFF', darkPaper: '#121416' };   // палитра #110

/* Ожидаемая геометрия считается ЗДЕСЬ, по той же формуле, что в styles.css,
   но записанной отдельно: совпадение — это сверка двух независимых записей
   правила, а не копия одной. Вырез берётся максимумом из env() (в прогоне 0)
   и safeAreaInset, зона контента прибавляется — см. предел про max и сумму
   в шапке файла. */
const BAR  = 58 + Math.max(0, SAFE.safeAreaInset.top)    + SAFE.contentSafeAreaInset.top;
const TABS = 74 + Math.max(0, SAFE.safeAreaInset.bottom) + SAFE.contentSafeAreaInset.bottom;

function tgStub(theme, safe, ver, scheme) {
  return `window.__tgCalls = []; window.__tgOn = {};
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
    ready: function () {}, expand: function () {},
    /* Обработчики ЗАПОМИНАЮТСЯ, а не глотаются: без этого themeChanged внутри
       одной страницы не позвать — а значит, застрявший токен не отличить от
       снятого, потому что оба видны только ПОСЛЕ смены темы. */
    onEvent: function (e, f) { (window.__tgOn[e] = window.__tgOn[e] || []).push(f); },
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
const cssSrc = fs.readFileSync(ROOT + '/styles.css', 'utf8');

/* Мутации. Каждая обязана ПРИМЕНИТЬСЯ (иначе «не покраснело» — ложь прибора)
   и обязана покраснить ИМЕННО названные проверки, а не любые. */
const MUT = {
  colors: { find: 'if (c) root.style.setProperty(r[0], c);',
            put:  'if (c) { /* мутация: раскладка цвета снята */ }',
            reddens: ['токен --paper', 'токен --ink', 'токен --muted', 'токен --accent',
                      'токен --accent-ink', 'токен --surface', 'пиксель фона',
                      'кнопка фон', 'кнопка текст'] },

  /* Подмена ПОЛЯ, а не снятие раскладки: роль, списанная с соседней роли,
     работает (экран не пустой, цвет человека виден) и ловится только тем,
     что фикстура даёт этим полям разные цвета. */
  hint:   { find: "['--muted',      'hint_color'],",
            put:  "['--muted',      'text_color'],",
            reddens: ['токен --muted'] },
  accink: { find: "['--accent-ink', 'button_text_color']",
            put:  "['--accent-ink', 'bg_color']",
            reddens: ['токен --accent-ink', 'кнопка текст'] },

  /* Застрявший токен виден не на одной теме, а на ПЕРЕХОДЕ между двумя:
     поле, которого в новой теме нет, обязано снять цвет, а не оставить
     прежний. Поэтому у мутации своя вторая тема (after) и свои ожидания
     (want) — после перехода честные значения уже фирменные, не фикстурные. */
  stuck:  { find: 'if (c) root.style.setProperty(r[0], c);\n    else root.style.removeProperty(r[0]);',
            put:  'if (c) root.style.setProperty(r[0], c);\n    /* мутация: снятие токена убрано */',
            after: { bg_color: '#FF00FF' },
            want: { 'токен --ink': BRAND.ink, 'токен --muted': BRAND.muted,
                    'токен --accent': BRAND.accent, 'токен --accent-ink': BRAND.accentInk,
                    'токен --surface': BRAND.surface,
                    'кнопка фон': BRAND.accent, 'кнопка текст': BRAND.accentInk },
            reddens: ['токен --ink', 'токен --muted', 'токен --accent',
                      'токен --accent-ink', 'токен --surface',
                      'кнопка фон', 'кнопка текст'] },

  safe:   { find: "if (typeof v === 'number' && v >= 0) root.style.setProperty(r[0], v + 'px');",
            put:  "if (typeof v === 'number' && v >= 0) { /* мутация: зоны сняты */ }",
            reddens: ['высота шапки', 'высота панели'] },

  /* Ветви инсетов снимаются ПООТДЕЛЬНОСТИ и живут в styles.css: «зоны сняты»
     целиком краснеет и там, где сложение двух источников потеряно, а потеря
     одного слагаемого — отдельная поломка с отдельным приговором. */
  cat:    { file: 'css', find: 'var(--tg-sat)) + var(--tg-cat))', put: 'var(--tg-sat)))',
            reddens: ['высота шапки'] },
  cab:    { file: 'css', find: 'var(--tg-sab)) + var(--tg-cab))', put: 'var(--tg-sab)))',
            reddens: ['высота панели'] },

  /* Эта мутация видна ТОЛЬКО на половинной фикстуре: на полной теме поле
     задано и фолбэк не участвует — потому и своё поле fix. */
  halfink: { file: 'css', find: '--accent-ink: #FFFFFF;', put: '--accent-ink: var(--paper);',
             fix: 'HALF',
             want: { 'токен --paper': HALF.bg_color, 'токен --ink': BRAND.ink,
                     'токен --muted': BRAND.muted, 'токен --accent': HALF.button_color,
                     'токен --accent-ink': BRAND.accentInk, 'токен --surface': BRAND.surface,
                     'кнопка фон': HALF.button_color, 'кнопка текст': BRAND.accentInk,
                     'пиксель фона': HALF.bg_color },
             reddens: ['токен --accent-ink', 'кнопка текст'] },

  header: { find: "if (tg.setHeaderColor) tg.setHeaderColor('bg_color');",
            put:  "if (tg.setHeaderColor) { /* мутация: шапка не красится */ }",
            reddens: ['вызов setHeaderColor'] },

  /* Цвет крестика очистки. Мутация — тот самый системный синий, которым он
     и приходил: правка «цвет в токен» без этой проверки держалась на слове,
     попадание цвет не меряет ничем (нашёл arhitector-47 на ревью #37). */
  xcolor: { file: 'css',
            find: 'background: var(--muted);',
            put:  'background: #0a84ff;',
            reddens: ['крестик: синих пикселей', 'крестик: краска подписью'] }
};

function patch(which, mut) {
  const base = which === 'css' ? cssSrc : demo;
  if (!mut) return base;
  const m = MUT[mut];
  if ((m.file || 'js') !== which) return base;
  const n = base.split(m.find).length - 1;
  if (n !== 1) {
    console.error('КРАСНОЕ: мутация «' + mut + '» не применилась: образец найден ' + n + ' раз, ждали 1');
    process.exit(1);
  }
  return base.replace(m.find, m.put);
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

/* Область кадра в числах — тем же канвасом, что и одиночный пиксель выше.
   Два счёта: «синих» (b заметно больше r) называет ровно тот дефект, с
   которого всё началось, а «краска цвета подписи» ловит и его, и белый
   системный крестик тёмной темы, который синим не является. */
async function region(ctx, png, muted) {
  const p = await ctx.newPage();
  // ⚠ muted передаётся ДОВОДОМ: region открывает свою страницу, и значение,
  // положенное в window страницы приложения, здесь не существует.
  const r = await p.evaluate(async a => {
    const d = a.d;
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = d; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const q = c.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    const mu = a.muted.replace('#', '').match(/../g).map(x => parseInt(x, 16));
    let blue = 0, ink = 0;
    for (let i = 0; i < q.length; i += 4) {
      const R = q[i], G = q[i + 1], B = q[i + 2];
      if (B > R + 40 && B > 120) blue++;
      if (Math.abs(R - mu[0]) + Math.abs(G - mu[1]) + Math.abs(B - mu[2]) <= 60) ink++;
    }
    return { blue: blue, ink: ink };
  }, { d: 'data:image/png;base64,' + png.toString('base64'), muted: muted });
  await p.close();
  return r;
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

  async function open({ theme, safe, ver = '8.0', mut = null, scheme = 'light', after = null }) {
    const p = await ctx.newPage();
    const errs = [], calls = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('https://telegram.org/**', r =>
      r.fulfill({ contentType: 'text/javascript', body: tgStub(theme, safe, ver, scheme) }));
    await p.route('**/app.js*', r =>
      r.fulfill({ contentType: 'text/javascript', body: patch('js', mut) }));
    await p.route('**/styles.css*', r =>
      r.fulfill({ contentType: 'text/css', body: patch('css', mut) }));
    /* Сервера здесь нет вовсе: любой запрос наружу — сам по себе отказ. */
    await p.route('https://api.cafe13.club/**', r => { calls.push(r.request().url()); return r.abort(); });
    await p.goto('file://' + ROOT + '/index.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(150);

    /* Вторая тема в ТОЙ ЖЕ странице: человек меняет тему на ходу, и новая
       страница этого случая не воспроизводит — там любой токен выставляется
       с нуля. Число обработчиков проверяется ПАДАЮЩЕ: ноль подписок дал бы
       «ничего не изменилось», и мутация застрявшего токена позеленела бы
       не потому, что код прав, а потому, что переход не случился. */
    if (after) {
      const n = await p.evaluate(t => {
        window.Telegram.WebApp.themeParams = t;
        const h = window.__tgOn.themeChanged || [];
        h.forEach(f => f());
        return h.length;
      }, after);
      if (n !== 1) {
        console.error('КРАСНОЕ: обработчиков themeChanged ' + n + ', ждали 1 — переход между темами непроверяем');
        process.exit(1);
      }
      await p.waitForTimeout(50);
    }
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
      /* Кнопка — пробный элемент .btn: роль «текст на действии» обязана
         доходить до ПРАВИЛА, а не только до токена; токен, который никто
         не читает, покрасил бы проверку в зелёный и экран ни во что.
         Это правило таблицы стилей, а не кнопка живого экрана — предел
         назван в теле PR. Цвет приводится к hex: computed отдаёт rgb(). */
      const hex = v => { const q = String(v).match(/\d+/g);
                         return q ? '#' + q.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : String(v); };
      const probe = document.createElement('button');
      probe.className = 'btn'; probe.textContent = 'проба';
      document.body.appendChild(probe);
      const pb = getComputedStyle(probe);
      const btn = { bg: hex(pb.backgroundColor), fg: hex(pb.color) };
      probe.remove();
      return { scheme: document.documentElement.getAttribute('data-theme'),
               paper: r.getPropertyValue('--paper').trim(), ink: r.getPropertyValue('--ink').trim(),
               accent: r.getPropertyValue('--accent').trim(), surface: r.getPropertyValue('--surface').trim(),
               muted: r.getPropertyValue('--muted').trim(),
               accentInk: r.getPropertyValue('--accent-ink').trim(),
               btn: btn,
               bar: box('bar'), tabs: box('tabs'),
               calls: (window.__tgCalls || []).slice() };
    });
    /* Крестик очистки поиска. Его цвет не читается НИЧЕМ, кроме пикселей:
       getComputedStyle(el, '::-webkit-search-cancel-button') возвращает стиль
       самого поля (проверено: ширина 358px — это ширина инпута), а
       getBoundingClientRect и elementFromPoint псевдоэлемент не видят вовсе.
       Поле пробное, как и кнопка выше: проверяется ПРАВИЛО таблицы стилей. */
    const pr = await s.p.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      wrap.style.cssText = 'position:fixed;left:10px;top:10px;width:300px;z-index:9999';
      wrap.innerHTML = '<input id="x-probe" type="search" value="проба">';
      document.body.appendChild(wrap);
      const e = document.getElementById('x-probe'), q = e.getBoundingClientRect();
      const mu = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
      return { x: q.right - 46, y: q.top + 3, w: 44, h: q.height - 6, muted: mu };
    });
    const clip = { x: pr.x, y: pr.y, width: pr.w, height: pr.h };
    // крестика не существует у поля без фокуса и без значения
    await s.p.focus('#x-probe'); await s.p.waitForTimeout(120);
    const full = await region(ctx, await s.p.screenshot({ clip: clip }), pr.muted);
    await s.p.fill('#x-probe', ''); await s.p.focus('#x-probe'); await s.p.waitForTimeout(120);
    const empty = await region(ctx, await s.p.screenshot({ clip: clip }), pr.muted);
    await s.p.evaluate(() => document.getElementById('x-probe').parentNode.remove());
    /* Краска считается РАЗНОСТЬЮ с тем же полем без значения, а не абсолютом:
       в полосе есть и своя постоянная краска (кольцо фокуса, обводка), и при
       --muted, случайно близком к ней, абсолютный счёт краснел бы без всякого
       крестика. Это поймала мутация «hint» — отрицательный контроль обязан
       вычитаться, а не стоять отдельной проверкой. */
    const x = { blue: full.blue, ink: full.ink - empty.ink > 8 ? 'есть' : 'нет' };

    const png = await s.p.screenshot();
    fs.writeFileSync(OUT + '/' + name + '.png', png);
    const px = await pixel(ctx, png, 5, 5);
    await s.p.close();
    return { css, px, x, errs: s.errs, calls: s.calls };
  }

  /* ── 1. цвета читаются и равны запрошенным, на двух разных фикстурах ── */
  for (const k of ['A', 'B']) {
    const m = await measure({ theme: FIX[k], safe: SAFE }, 'theme-' + k);
    const w = `фикстура ${k}`;
    eq('токен --paper', m.css.paper, FIX[k].bg_color, w);
    eq('токен --ink', m.css.ink, FIX[k].text_color, w);
    eq('токен --accent', m.css.accent, FIX[k].button_color, w);
    eq('токен --surface', m.css.surface, FIX[k].secondary_bg_color, w);
    eq('токен --muted', m.css.muted, FIX[k].hint_color, w);
    eq('токен --accent-ink', m.css.accentInk, FIX[k].button_text_color, w);
    eq('кнопка фон', m.css.btn.bg, FIX[k].button_color, w);
    eq('кнопка текст', m.css.btn.fg, FIX[k].button_text_color, w);
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
    eq('фолбэк --accent', m.css.accent, BRAND.accent, w);    // латунь из styles.css (#110)
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}»`);
  }

  /* ── 2б. ПЕРЕХОД между темами в одной странице: ушедшее поле снимает свой
     токен, и остаётся фирменный цвет, а не прежний чужой. Раздел 2 этого не
     ловит: там неполная тема приходит сразу, и снимать нечего. ── */
  {
    const m = await measure({ theme: FIX.A, safe: SAFE, after: { bg_color: '#FF00FF' } }, 'theme-switch');
    const w = 'переход на «только фон»';
    eq('токен --paper', m.css.paper, '#FF00FF', w);
    eq('токен --ink', m.css.ink, BRAND.ink, w);
    eq('токен --muted', m.css.muted, BRAND.muted, w);
    eq('токен --accent', m.css.accent, BRAND.accent, w);
    eq('токен --surface', m.css.surface, BRAND.surface, w);
    /* С #110 у действия своя пара — латунь и белое, — и она не следует за
       чужим фоном: белое по латуни посчитано (5.62), по чужому фону — нет. */
    eq('токен --accent-ink', m.css.accentInk, BRAND.accentInk, w);
    eq('кнопка фон', m.css.btn.bg, BRAND.accent, w);
    eq('кнопка текст', m.css.btn.fg, BRAND.accentInk, w);
    if (m.errs.length) bad.push(`${w}: ошибка страницы «${m.errs[0]}»`);
  }

  /* ── 2в. роль действия задана НАПОЛОВИНУ: цвет кнопки берётся у человека,
     цвет текста на ней — фирменный, и он НЕ следует за чужим фоном. ── */
  {
    const m = await measure({ theme: HALF, safe: SAFE }, 'theme-half-accent');
    const w = 'фикстура «кнопка без текста кнопки»';
    eq('токен --accent', m.css.accent, HALF.button_color, w);
    eq('токен --accent-ink', m.css.accentInk, BRAND.accentInk, w);
    eq('кнопка фон', m.css.btn.bg, HALF.button_color, w);
    eq('кнопка текст', m.css.btn.fg, BRAND.accentInk, w);
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
    eq('фолбэк --paper', m.css.paper, BRAND.paper, w);
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
    eq('фолбэк --paper тёмный', m.css.paper, BRAND.darkPaper, w);
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

  /* ── 4б. крестик очистки поиска красится токеном подписи, а не системой.
     Два признака, потому что системный крестик разный в двух темах: в
     светлой он синий, в тёмной белый. «Синих пикселей» называет первый,
     «краска подписью» ловит оба — белое от --muted отличается так же
     хорошо, как синее. Отрицательный контроль встроен в сам признак: краска
     считается разностью с тем же полем БЕЗ значения, где крестика нет. ── */
  for (const scheme of ['light', 'dark']) {
    const m = await measure({ theme: FIX.A, safe: SAFE, scheme: scheme }, 'theme-x-' + scheme);
    const w = 'крестик поиска, тема ' + scheme;
    eq('крестик: синих пикселей', m.x.blue, 0, w);
    eq('крестик: краска подписью', m.x.ink, 'есть', w);
  }

  /* ── 5. снятие проверяемого: каждая мутация обязана покраснить ИМЕННО
     свои проверки — и не покраснить лишние. Покраснело лишнее — значит
     прогон упал раньше проверяемого места, и красное получено обманом. ── */
  const WANT = { 'токен --paper': FIX.A.bg_color, 'токен --ink': FIX.A.text_color,
                 'токен --muted': FIX.A.hint_color, 'токен --accent': FIX.A.button_color,
                 'токен --accent-ink': FIX.A.button_text_color,
                 'токен --surface': FIX.A.secondary_bg_color,
                 'кнопка фон': FIX.A.button_color, 'кнопка текст': FIX.A.button_text_color,
                 'крестик: синих пикселей': 0, 'крестик: краска подписью': 'есть',
                 'пиксель фона': FIX.A.bg_color, 'высота шапки': BAR, 'высота панели': TABS,
                 'вызов setHeaderColor': true };

  for (const name of Object.keys(MUT)) {
    /* У мутации может быть свой второй шаг (after) и тогда свои честные
       значения (want): после перехода на тему без полей правильный ответ —
       фирменный цвет, а не фикстурный. Таблица ожиданий СОБИРАЕТСЯ, а не
       переписывается: ключ, который мутация не трогает, остаётся общим. */
    const theme = MUT[name].fix === 'HALF' ? HALF : FIX.A;
    const m = await measure({ theme: theme, safe: SAFE, mut: name, after: MUT[name].after || null },
                            'mut-' + name);
    const want = Object.assign({}, WANT, MUT[name].want || {});
    const got = { 'токен --paper': m.css.paper, 'токен --ink': m.css.ink,
                  'токен --muted': m.css.muted, 'токен --accent': m.css.accent,
                  'токен --accent-ink': m.css.accentInk, 'токен --surface': m.css.surface,
                  'кнопка фон': m.css.btn.bg, 'кнопка текст': m.css.btn.fg,
                  'крестик: синих пикселей': m.x.blue, 'крестик: краска подписью': m.x.ink,
                  'пиксель фона': m.px, 'высота шапки': m.css.bar.h, 'высота панели': m.css.tabs.h,
                  'вызов setHeaderColor': m.css.calls.includes('setHeaderColor:bg_color') };
    const texts = [];
    for (const k of Object.keys(want)) {
      const red = String(got[k]).toUpperCase() !== String(want[k]).toUpperCase();
      const should = MUT[name].reddens.includes(k);
      if (red) texts.push(`${k} = ${got[k]}, запрошено ${want[k]}`);
      if (should && !red)
        bad.push(`мутация «${name}»: ${k} НЕ покраснел (${got[k]}) — проверка ничего не проверяет`);
      if (!should && red)
        bad.push(`мутация «${name}»: покраснело лишнее — ${k} = ${got[k]}, ждали ${want[k]}`);
    }
    /* Список покрасневших ОБЯЗАН совпасть с заявленным — не только по
       «каждый названный покраснел», но и по длине: лишний ключ в reddens,
       которого нет в таблице ожиданий, иначе не нашёлся бы вовсе. */
    const unknown = MUT[name].reddens.filter(k => !(k in want));
    if (unknown.length)
      bad.push(`мутация «${name}»: в reddens имена, которых нет среди проверок: ${unknown.join(', ')}`);
    if (m.errs.length) bad.push(`мутация «${name}»: ошибка страницы «${m.errs[0]}» — прогон умер, а не покраснел`);
    console.log(`мутация «${name}» краснеет текстом: ${texts.length ? texts.join(' | ') : 'НИЧЕМ'}`);
  }

  await ctx.close();
  await b.close();

  console.log('проверок дошло: ' + reached.size + ' — ' + [...reached].join(' · '));
  if (bad.length) { console.log('КРАСНОЕ:'); bad.forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('ЗЕЛЁНОЕ: тема и безопасные зоны читаются, значения равны запрошенным');
})().catch(e => { console.error('ПРОГОН УПАЛ: ' + e.message); process.exit(2); });
