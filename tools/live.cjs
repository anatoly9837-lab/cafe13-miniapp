const { chromium } = require('playwright');
const fs = require('fs');

/* Живой режим без живого сервера: Telegram и API подменены на маршрутах
   страницы, к api.cafe13.club отсюда не уходит ни один запрос. Каждый случай
   проверяет признак В СОДЕРЖИМОМ #view и то, чего там быть НЕ должно, —
   иначе экран с демонстрационными числами прошёл бы за настоящий.

   API_ON в app.js выключен до замка на сервере; здесь он включается подменой
   текста при отдаче файла, а файл в репозитории остаётся выключенным.

   Запуск: docker run --rm -v $PWD:/app:ro -v <снимки>:/work -w /work \
     --entrypoint node agenthost/playwright:1.59.1 /app/tools/live.cjs */

const ROOT = process.env.APP || '/app';
const OUT = process.env.OUT || '/work';
const INIT = 'query_id=AAE&user=%7B%22id%22%3A1%7D&auth_date=1760000000&hash=stub';

function tgStub(inside) {
  return `window.__main = null;
  window.Telegram = { WebApp: {
    platform: ${inside ? "'ios'" : "'unknown'"}, initData: ${inside ? JSON.stringify(INIT) : "''"},
    initDataUnsafe: ${inside ? '{ user: { id: 1 } }' : '{}'}, colorScheme: 'light', version: '7.0',
    isVersionAtLeast: function () { return true; },
    ready: function () {}, expand: function () {}, onEvent: function () {},
    HapticFeedback: { notificationOccurred: function () {}, selectionChanged: function () {} },
    BackButton: { onClick: function () {}, offClick: function () {}, show: function () {}, hide: function () {} },
    MainButton: { setText: function () {}, show: function () {}, hide: function () {},
                  onClick: function (f) { window.__main = f; }, offClick: function () { window.__main = null; } }
  } };`;
}

const OWNER = {
  member: { tg_user_id: 1, first_name: 'Тест', last_name: '', username: null, photo_url: null,
            pass_code: null, created_at: '2026-10-01T00:00:00+00:00',
            consent_data_at: '2026-10-18T10:00:00+00:00', consent_filming_at: null },
  membership: { level: 'member', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: true },
  membership_active: true,
  balance: 3170,                      // не 1250: 1250 — демонстрационный баланс, его не спутать
  roles: [{ role: 'head', direction_id: null }, { role: 'admin', direction_id: null },
          { role: 'god_mentor', direction_id: null }]
};
const clone = o => JSON.parse(JSON.stringify(o));
const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const finite = clone(OWNER);
finite.membership.ends_at = '2026-11-14T10:00:00+07:00'; finite.membership.lifelong = false;
const noEnd = clone(OWNER); noEnd.membership.lifelong = false;          // конечное без конца
const noConsent = clone(OWNER); noConsent.member.consent_data_at = null;

/* [имя, внутри Telegram, API_ON, ответ /me, есть, нет, сколько запросов к API, после] */
const CASES = [
  ['owner-lifelong', true, true, json(200, OWNER),
    ['Пожизненно', '3 170 ฿', 'Глава клуба', 'Администратор', 'Афиша', 'В афише пока ничего нет'],
    ['Действует до', 'Звуковая практика', '1 250', 'Вы записаны', 'god_mentor', 'ещё не подключено'], 2],
  ['finite', true, true, json(200, finite), ['Действует до 14 ноября 2026'], ['Пожизненно'], 2],
  ['no-sign-401', true, true, json(401, { detail: 'подпись не принята' }),
    ['Подпись не принята'], ['Баланс', 'Вас нет в списке'], 1],
  ['stranger-403', true, true, json(403, { detail: 'доступа нет' }),
    ['Вас нет в списке'], ['Баланс', 'Подпись не принята', 'Член клуба'], 1],
  ['server-500', true, true, json(500, { detail: 'x' }), ['Сервер ответил кодом 500'], ['Баланс'], 1],
  ['empty-200', true, true, json(200, {}), ['Ответ сервера не разобран'], ['Баланс'], 1],
  ['html-200', true, true, { status: 200, contentType: 'text/html', body: '<html>ok</html>' },
    ['Ответ сервера не разобран'], ['Баланс'], 1],
  ['finite-without-end', true, true, json(200, noEnd), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
  ['network-down', true, true, 'abort', ['Сервер не ответил'], ['Баланс'], 1],
  ['outside-telegram', false, true, json(200, OWNER),
    ['Действует до 14 ноября', '1 250', 'Звуковая практика'], ['Пожизненно'], 0],
  ['api-off', true, false, json(200, OWNER), ['Действует до 14 ноября', '1 250'], ['Пожизненно'], 0]
];

// Экраны отказа — списком, а не регуляркой по имени: регулярка молча
// пропускала network-down.
const REFUSAL = new Set(['no-sign-401', 'stranger-403', 'server-500', 'empty-200', 'html-200',
                         'finite-without-end', 'network-down']);
// Опечатка в имени молча выключила бы проверку для случая — ловим здесь.
REFUSAL.forEach(n => { if (!CASES.some(c => c[0] === n)) throw new Error('REFUSAL: нет случая ' + n); });

// выключатель ищется в любом положении: тест сам ставит нужное. Не один —
// падаем сразу и своим текстом, а не таймаутом на подменённой странице.
// Что в выкладке он включён — tools/api-on.cjs.
const src = fs.readFileSync(ROOT + '/app.js', 'utf8');
const SW = /var API_ON = (true|false);/;
const decl = src.match(/^\s*(var|let|const)\s+API_ON\s*=.*$/gm) || [];
if (decl.length !== 1 || !SW.test(decl[0])) {
  console.error('КРАСНОЕ: app.js: выключатель API_ON не найден ровно один раз (' + decl.length + ')');
  process.exit(1);
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const bad = [];

  async function open(inside, on, me, consentReply, passReply, saved, extra, tz) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU',
                                     ...(tz ? { timezoneId: tz } : {}) });
    // Локальная отметка согласия стоит ВСЕГДА: демо без неё открылось бы
    // согласием, а живой режим обязан её не слушать — решает сервер.
    await ctx.addInitScript(saved => {
      try {
        localStorage.setItem('cafe13.consent', '0.1');
        if (saved) localStorage.setItem('cafe13.pass', saved);
      } catch (e) {}
    }, saved ? JSON.stringify(saved) : null);
    const p = await ctx.newPage();
    const calls = [], errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('https://telegram.org/**', r => r.fulfill({ contentType: 'text/javascript', body: tgStub(inside) }));
    await p.route('**/app.js*', r => r.fulfill({ contentType: 'text/javascript',
      body: src.replace(SW, 'var API_ON = ' + (on ? 'true' : 'false') + ';') }));
    await p.route('https://api.cafe13.club/**', async r => {
      const q = r.request();
      calls.push({ method: q.method(), url: q.url(), init: q.headers()['x-telegram-init-data'], body: q.postData(),
                   test: q.headers()['x-test-mode'], as: q.headers()['x-act-as'] });
      const x = extra ? extra(q) : undefined;
      if (x instanceof Promise) return r.fulfill(await x);
      const reply = x !== undefined ? x
                  : q.url().endsWith('/me/consent') ? consentReply : q.url().endsWith('/pass') ? passReply
                  : q.url().endsWith('/events') ? json(200, []) : me;
      if (reply === 'abort') return r.abort();
      return r.fulfill(typeof reply === 'function' ? reply() : reply);
    });
    await p.goto('file://' + ROOT + '/index.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(150);
    const view = () => p.evaluate(() => document.getElementById('view').textContent);
    const tabsShown = () => p.evaluate(() => !document.getElementById('tabs').hidden);
    return { ctx, p, calls, errs, view, tabsShown };
  }

  for (const [name, inside, on, me, has, hasnt, n] of CASES) {
    const s = await open(inside, on, me);
    const t = await s.view();
    has.forEach(x => { if (!t.includes(x)) bad.push(`${name}: нет «${x}»`); });
    hasnt.forEach(x => { if (t.includes(x)) bad.push(`${name}: есть лишнее «${x}»`); });
    // head и god_mentor — одно звание: плашка одна, а не две
    const pills = await s.p.evaluate(() => [...document.querySelectorAll('#view .pill')].map(e => e.textContent));
    if (name === 'owner-lifelong' && pills.filter(x => x === 'Глава клуба').length !== 1)
      bad.push(`${name}: плашек «Глава клуба» ${pills.filter(x => x === 'Глава клуба').length}, ждали 1`);
    if (s.calls.length !== n) bad.push(`${name}: запросов к API ${s.calls.length}, ждали ${n}`);
    s.calls.forEach(c => { if (c.init !== INIT) bad.push(`${name}: заголовок подписи «${c.init}»`); });
    if (REFUSAL.has(name) && await s.tabsShown())
      bad.push(`${name}: на экране отказа видны вкладки`);
    if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
    await s.p.screenshot({ path: `${OUT}/live-${name}.png` });
    await s.ctx.close();
  }

  // ── солнышко только у богов ──
  // Признак — наличие #demo-btn в DOM, а не видимость: скрытая стилем кнопка
  // нажимается. Обе стороны: без бога кнопки нет, с богом — есть.
  for (const [name, roles, inside, want] of [
    ['sun-admin-head', [{ role: 'admin', direction_id: null }, { role: 'head', direction_id: null }], true, false],
    ['sun-curator', [{ role: 'curator', direction_id: 7 }], true, false],
    ['sun-none', [], true, false],
    ['sun-god', [{ role: 'god', direction_id: null }], true, true],
    ['sun-god-mentor', [{ role: 'god_mentor', direction_id: null }], true, true],
    ['sun-outside', OWNER.roles, false, false]]) {
    const who = clone(OWNER); who.roles = roles;
    const s = await open(inside, true, json(200, who));
    const has = !!(await s.p.$('#demo-btn'));
    if (has !== want) bad.push(`${name}: кнопка солнышка ${has ? 'есть' : 'нет'}, ждали ${want ? 'есть' : 'нет'}`);
    // и мимо кнопки — вызовом из консоли — экран переключения не открывается
    if (!want && inside) {
      await s.p.evaluate(() => go('demo'));
      if ((await s.view()).includes('Тестовый режим')) bad.push(`${name}: экран солнышка открылся вызовом go('demo')`);
    }
    if (want && !(await s.p.isVisible('#demo-btn'))) bad.push(`${name}: кнопка солнышка в DOM, но не видна`);
    else if (want) {
      await s.p.click('#demo-btn');
      if (!(await s.view()).includes('Версия приложения')) bad.push(`${name}: солнышко не открывает экран`);
    }
    if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
    await s.ctx.close();
  }

  // Вкладка, ещё не стоящая на сервере, — «не подключено», а не демонстрационные записи.
  {
    const s = await open(true, true, json(200, OWNER));
    await s.p.click('#tabs [data-go="bookings"]');
    const t = await s.view();
    if (!t.includes('ещё не подключено') || t.includes('Звуковая практика')) bad.push('bookings: показаны демонстрационные записи');
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('bookings: главная кнопка на неподключённом экране');
    if (await s.p.isVisible('#demo-btn')) await s.p.click('#demo-btn');
    else bad.push('demo: у владельца (god_mentor) нет видимого солнышка');
    const d = await s.view();
    if (!d.includes('Тестовый режим') || d.includes('Смотреть как')) bad.push('demo: в живом режиме доступно переключение роли');
    if (/демонстрац|Демо/.test(d + await s.p.evaluate(() => document.getElementById('title').textContent)))
      bad.push('demo: в живом режиме панель называет себя демонстрацией');
    // Кнопок роли в живом режиме нет, но и подсунутая в разметку не должна сработать.
    // признак — набор вкладок до и после, а не «Заказы»: у админа эта вкладка своя
    const tabsText = () => s.p.evaluate(() => document.getElementById('tabs').textContent);
    const before = await tabsText();
    // Клик изнутри страницы: проверяется обработчик, а не попадание мышью.
    // p.click ждал «стабильности» пустой кнопки и раз в 5 прогонов висел 30 с,
    // роняя весь прогон чужим таймаутом.
    await s.p.evaluate(() => {
      const x = document.createElement('button'); x.setAttribute('data-role', 'bar'); x.id = 'fake-role';
      document.getElementById('view').appendChild(x);
      x.click();
    });
    await s.p.waitForTimeout(100);
    if (await tabsText() !== before)
      bad.push('role: в живом режиме роль переключилась из браузера: «' + before + '» → «' + (await tabsText()) + '»');
    await s.ctx.close();
  }

  // Согласие: нет на сервере → экран согласия → POST {data:true} → кабинет.
  {
    const s = await open(true, true, json(200, noConsent), json(200, { consent_data_at: '2026-10-18T12:00:00+00:00', consent_filming_at: null }));
    if (!(await s.view()).includes('Клуб запомнит вас')) bad.push('consent: экран согласия не показан');
    await s.p.screenshot({ path: `${OUT}/live-consent.png` });
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.waitForTimeout(150);
    const post = s.calls.filter(c => c.method === 'POST');
    if (post.length !== 1 || !post[0].url.endsWith('/me/consent') || post[0].body !== '{"data":true}')
      bad.push('consent: POST /me/consent не ушёл как {"data":true}: ' + JSON.stringify(post));
    const t = await s.view();
    if (!t.includes('Согласие принято') || !t.includes('Пожизненно')) bad.push('consent: после согласия не кабинет');
    await s.ctx.close();
  }
  {
    const s = await open(true, true, json(200, noConsent), json(500, { detail: 'x' }));
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (!t.includes('Согласие не записано') || !t.includes('Клуб запомнит вас')) bad.push('consent-500: отказ не показан или ушли с экрана');
    await s.ctx.close();
  }

  // «Попробовать снова»: сервер ожил — кабинет.
  {
    let up = false;
    const s = await open(true, true, () => up ? json(200, OWNER) : json(502, {}));
    up = true;
    await s.p.click('[data-action="retry"]');
    await s.p.waitForTimeout(150);
    if (!(await s.view()).includes('Пожизненно')) bad.push('retry: после повтора не кабинет');
    if (s.calls.length !== 3) bad.push(`retry: запросов ${s.calls.length}, ждали 3 (/me, /me, /events)`);
    await s.ctx.close();
  }

  // Пропуск: настоящий код с сервера, а не демонстрационный узор.
  const PASS = { pass_code: 'XIII-0042', first_name: 'Тест', last_name: '', photo_url: null,
                 level: 'member', valid_until: null, lifelong: true };
  {
    const s = await open(true, true, json(200, OWNER), null, json(200, PASS));
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    const t = await s.view();
    ['XIII · 0042', 'пожизненно', 'сохранён на этом телефоне'].forEach(x => { if (!t.includes(x)) bad.push(`pass: нет «${x}»`); });
    if (/демонстрационн/i.test(t)) bad.push('pass: в живом режиме демонстрационный узор');
    const label = await s.p.evaluate(() => { const g = document.querySelector('.code-box svg'); return g && g.getAttribute('aria-label'); });
    if (label !== 'Код пропуска XIII-0042') bad.push('pass: QR не из кода сервера: ' + label);
    // Подпись строится отдельно от узора — сверяем сами модули. Что библиотека
    // кодирует верно, проверено независимым декодером (OpenCV) по снимку, см. PR.
    const same = await s.p.evaluate(() => {
      const q = qrcode(0, 'M'); q.addData('XIII-0042'); q.make();
      const path = document.querySelector('.code-box svg path');
      if (!path) return false;
      const d = path.getAttribute('d');
      const want = []; const n = q.getModuleCount();
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) want.push('M' + (x + 2) + ' ' + (y + 2) + 'h1v1h-1z');
      return d === want.join('');
    });
    if (!same) bad.push('pass: модули QR не совпадают с кодом XIII-0042');
    const kept = await s.p.evaluate(() => localStorage.getItem('cafe13.pass'));
    if (!kept || JSON.parse(kept).code !== 'XIII-0042' || JSON.parse(kept).uid !== 1) bad.push('pass: не сохранён на телефоне: ' + kept);
    if (s.calls.filter(c => c.url.endsWith('/pass')).length !== 1) bad.push('pass: /pass запрошен не один раз');
    await s.p.screenshot({ path: `${OUT}/live-pass.png` });
    // второй заход на экран — без нового запроса: код не меняется
    await s.p.click('[data-go="home"]'); await s.p.click('[data-go="pass"]'); await s.p.waitForTimeout(100);
    if (s.calls.filter(c => c.url.endsWith('/pass')).length !== 1) bad.push('pass: повторный запрос при втором заходе');
    if (s.errs.length) bad.push('pass: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  const SAVED = { code: 'XIII-0042', name: 'Тест', level: 'Член клуба', ends: null, lifelong: true, uid: 1 };
  for (const [name, reply, want, wiped] of [
    ['pass-403', json(403, { detail: 'членство не активно' }), 'Членство не активно', true],
    ['pass-403-other', json(403, { detail: 'нужна роль' }), 'Сервер отказал в пропуске', true],
    ['pass-bad', json(200, { pass_code: '0042', level: 'member', lifelong: true }), 'Ответ сервера не разобран', false],
    ['pass-down', 'abort', 'Сервер не ответил', false]]) {
    const s = await open(true, true, json(200, OWNER), null, reply, SAVED);
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    const t = await s.view();
    if (!t.includes('Пропуска нет') || !t.includes(want)) bad.push(`${name}: нет отказа «${want}»`);
    if (await s.p.evaluate(() => !!document.querySelector('.code-box'))) bad.push(`${name}: код нарисован без пропуска`);
    const kept = await s.p.evaluate(() => localStorage.getItem('cafe13.pass'));
    if (wiped && kept) bad.push(`${name}: запас не стёрт после отказа`);
    if (!wiped && (!kept || JSON.parse(kept).code !== 'XIII-0042')) bad.push(`${name}: запас испорчен без отказа сервера: ${kept}`);
    await s.ctx.close();
  }

  // «доступа нет» на /pass — отказ во входе целиком, а не «пропуска нет».
  {
    const s = await open(true, true, json(200, OWNER), null, json(403, { detail: 'доступа нет' }), SAVED);
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    if (!(await s.view()).includes('Вас нет в списке')) bad.push('pass-403-list: не экран «нет в списке»');
    if (await s.p.evaluate(() => localStorage.getItem('cafe13.pass'))) bad.push('pass-403-list: запас не стёрт');
    await s.ctx.close();
  }
  // Отказ /me стирает запас.
  for (const [name, me] of [['me-401-wipes', json(401, {})], ['me-403-wipes', json(403, { detail: 'доступа нет' })]]) {
    const s = await open(true, true, me, null, null, SAVED);
    if (await s.p.evaluate(() => localStorage.getItem('cafe13.pass'))) bad.push(`${name}: запас не стёрт`);
    await s.ctx.close();
  }
  // Конечный срок сохраняется в ISO и рисуется словами.
  {
    const s = await open(true, true, json(200, finite), null,
      json(200, Object.assign({}, PASS, { lifelong: false, valid_until: '2026-11-14T10:00:00+07:00' })));
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    if (!(await s.view()).includes('до 14 ноября 2026')) bad.push('pass-finite: срок не показан словами');
    const kept = JSON.parse(await s.p.evaluate(() => localStorage.getItem('cafe13.pass')) || 'null');
    if (!kept || kept.ends !== '2026-11-14T10:00:00+07:00') bad.push('pass-finite: срок сохранён не в ISO: ' + JSON.stringify(kept));
    await s.ctx.close();
  }

  // Запас переписывается из каждого удачного /me — без захода на экран пропуска.
  {
    const withCode = clone(finite); withCode.member.pass_code = 'XIII-0042';
    const s = await open(true, true, json(200, withCode), null, null,
      Object.assign({}, SAVED, { lifelong: false, ends: '2020-01-01T00:00:00+07:00' }));
    const kept = JSON.parse(await s.p.evaluate(() => localStorage.getItem('cafe13.pass')) || 'null');
    if (!kept || kept.code !== 'XIII-0042' || kept.ends !== '2026-11-14T10:00:00+07:00' || kept.lifelong !== false || kept.uid !== 1)
      bad.push('me-sync: запас не переписан из /me: ' + JSON.stringify(kept));
    if (s.calls.some(c => c.url.endsWith('/pass'))) bad.push('me-sync: лишний запрос /pass');
    await s.ctx.close();
  }
  {
    const s = await open(true, true, json(200, OWNER), null, null, null);     // pass_code: null
    if (await s.p.evaluate(() => localStorage.getItem('cafe13.pass'))) bad.push('me-no-code: запас записан без кода');
    await s.ctx.close();
  }
  {
    const life = clone(OWNER); life.member.pass_code = 'XIII-0042';
    const s = await open(true, true, json(200, life), null, null, null);
    const kept = JSON.parse(await s.p.evaluate(() => localStorage.getItem('cafe13.pass')) || 'null');
    if (!kept || kept.lifelong !== true || kept.ends !== null) bad.push('me-sync-lifelong: ' + JSON.stringify(kept));
    await s.ctx.close();
  }
  {
    const gone = clone(OWNER); gone.membership_active = false; gone.membership = null; gone.member.pass_code = 'XIII-0042';
    const s = await open(true, true, json(200, gone), null, null, SAVED);
    if (await s.p.evaluate(() => localStorage.getItem('cafe13.pass'))) bad.push('me-inactive: запас не стёрт при неактивном членстве');
    await s.ctx.close();
  }
  // /pass без даты и без lifelong — не пропуск (пустая дата законна только при lifelong: true).
  {
    const s = await open(true, true, json(200, OWNER), null,
      json(200, Object.assign({}, PASS, { lifelong: false, valid_until: null })));
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    const t = await s.view();
    if (!t.includes('Ответ сервера не разобран') || await s.p.evaluate(() => !!document.querySelector('.code-box')))
      bad.push('pass-no-date: пропуск без срока показан');
    await s.ctx.close();
  }

  // ── бар ──
  const MENU = [
    { id: 11, group: 'Кофе', title: 'Эспрессо', about: 'Двойной', full_text: 'Коротко и сразу.', price: '70.00',
      mins: 2, is_alcohol: false, sort: 1, photo_file_id: null },
    { id: 12, group: 'Кофе', title: 'Флэт-уайт', about: 'На молоке', full_text: '', price: '110.00',
      mins: 3, is_alcohol: false, sort: 2, photo_file_id: 'AgACAgIAAxk' },
    { id: 21, group: 'Чай', title: 'Пуэр', about: 'Проливами', full_text: '', price: '5000.00',
      mins: 5, is_alcohol: false, sort: 1, photo_file_id: null }];
  // Формы ответов — по cafe13-api app/routers/bar.py: POST отдаёт RETURNING
  // (id, number, state, sum, created_at) плюс place и pay_method из тела;
  // GET /bar/orders — строки очереди с member_id и items.
  const ORDER = { id: 5, number: '261018-01', state: 'new', sum: '70.00', created_at: '2026-10-18T12:00:00+00:00',
                  place: 'за стойку', pay_method: 'account', ledger_id: 41 };
  const row = st => { const r = Object.assign({}, ORDER, { state: st, member_id: 1, first_name: 'Тест', last_name: '',
    photo_url: null, accepted_at: null, ready_at: null, served_at: null,
    items: [{ title: 'Эспрессо', price: '70.00', qty: 1 }] }); delete r.ledger_id; return r; };
  // id 7, а не 1: так видно, что он взят с сервера, а не угадан
  // гостю — без долей направления (их видит только куратор): так отдаёт сервер
  const DIR = (open, extra) => json(200, [{ id: 7, title: 'Бар', is_active: true, is_open: open }].concat(extra || []));
  function bar(o) {
    o = Object.assign({ dirs: DIR(true), menu: json(200, MENU), order: json(201, ORDER), list: json(200, [row('new')]) }, o);
    return q => {
      const u = q.url();
      if (u.endsWith('/directions')) return typeof o.dirs === 'function' ? o.dirs() : o.dirs;
      if (u.includes('/bar/menu')) return typeof o.menu === 'function' ? o.menu() : o.menu;
      if (u.includes('/bar/orders') && q.method() === 'POST') return typeof o.order === 'function' ? o.order() : o.order;
      if (u.includes('/bar/orders')) return typeof o.list === 'function' ? o.list() : o.list;
      return undefined;
    };
  }
  const open_ = extra => open(true, true, json(200, OWNER), null, null, null, extra);
  const posts = s => s.calls.filter(c => c.method === 'POST' && c.url.includes('/bar/orders'));
  async function toBar(s) {
    await s.p.click('#tabs [data-go="guest"]');
    await s.p.click('[data-go="bar"]');
    await s.p.waitForTimeout(150);
  }

  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar());
    await toBar(s);
    const t = await s.view();
    ['Эспрессо', 'Флэт-уайт', 'Пуэр', '70 ฿', '5 000 ฿', 'фото не показано', 'без фото', 'Купить', 'Не хватает 1 830 ฿', 'На счёте']
      .forEach(x => { if (!t.includes(x)) bad.push(`bar-menu: нет «${x}»`); });
    ['Колд-брю', 'Открыт до 23:00'].forEach(x => { if (t.includes(x)) bad.push(`bar-menu: демонстрационное «${x}»`); });
    const m = s.calls.filter(c => c.url.includes('/bar/menu'));
    if (m.length !== 1 || !m[0].url.endsWith('/bar/menu?direction_id=7')) bad.push('bar-menu: запрос меню ' + JSON.stringify(m.map(c => c.url)));
    await s.p.screenshot({ path: `${OUT}/live-bar.png`, fullPage: true });

    // одно нажатие — один заказ: одна позиция, со счёта, за стойку, без суммы в теле
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(250);
    const pp = posts(s);
    const want = { direction_id: 7, place: 'за стойку', pay_method: 'account', items: [{ product_id: 11, qty: 1 }] };
    if (pp.length !== 1 || JSON.stringify(JSON.parse(pp[0].body)) !== JSON.stringify(want))
      bad.push('buy: тело заказа ' + JSON.stringify(pp.map(c => c.body)));
    const o = await s.view();
    ['261018-01', 'Эспрессо', 'новый', 'отправлен на бар'].forEach(x => { if (!o.includes(x)) bad.push(`buy: на экране заказа нет «${x}»`); });
    if (s.calls.filter(c => c.url.endsWith('/me')).length !== 2) bad.push('buy: баланс не перезапрошен после заказа');
    if (!s.calls.some(c => c.method === 'GET' && c.url.includes('/bar/orders'))) bad.push('buy: состояние заказа не запрошено');
    await s.p.screenshot({ path: `${OUT}/live-bar-order.png` });
    if (s.errs.length) bad.push('bar: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // Двойное нажатие, пока заказ в пути, — один заказ.
  {
    const slow = () => new Promise(res => setTimeout(() => res(json(201, ORDER)), 600));
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ order: slow }));
    await toBar(s);
    await s.p.evaluate(() => { doAction('buy:11'); doAction('buy:11'); doAction('buy:12'); });
    if (!(await s.view()).includes('Отправляем…')) bad.push('busy: нет «Отправляем…», пока заказ в пути');
    await s.p.waitForTimeout(900);
    if (posts(s).length !== 1) bad.push(`busy: ${posts(s).length} заказов за три нажатия`);
    await s.ctx.close();
  }

  // Состояние заказа подтягивается с сервера.
  {
    let st = 'new';
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ list: () => json(200, [row(st)]) }));
    await toBar(s);
    st = 'ready';
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    if (!(await s.view()).includes('готов')) bad.push('poll: состояние с сервера не показано');
    await s.ctx.close();
  }

  // Не хватает на счёте (сервер решает) — экран пополнения, а не немой отказ.
  // Член без права кассы видит, куда идти; админ — форму внести себе.
  const NOTILL = clone(OWNER); NOTILL.roles = [];
  for (const [who, name, want] of [[NOTILL, 'topup-409', 'пополняется у хостес'], [OWNER, 'topup-409-admin', null]]) {
    const s = await open(true, true, json(200, who), null, null, null,
      bar({ order: json(409, { detail: 'на счёте 3170, не хватает 1830' }) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(250);
    const t = await s.view();
    ['На счёте не хватает', 'не хватает 1830'].concat(want ? [want] : []).forEach(x => { if (!t.includes(x)) bad.push(`${name}: нет «${x}»`); });
    if (!want && !(await s.p.$('#t-amount'))) bad.push(`${name}: админу нет формы внесения`);
    if (want && (await s.p.$('#t-amount'))) bad.push(`${name}: форма внесения без права кассы`);
    await s.p.screenshot({ path: `${OUT}/live-${name}.png` });
    await s.ctx.close();
  }
  // Кнопка «Не хватает» ведёт туда же без запроса.
  {
    const s = await open(true, true, json(200, NOTILL), null, null, null, bar());
    await toBar(s);
    await s.p.click('[data-go="topup"]');
    if (!(await s.view()).includes('пополняется у хостес')) bad.push('topup: кнопка «Не хватает» не ведёт к пополнению');
    if (posts(s).length) bad.push('topup: заказ ушёл при нехватке');
    await s.ctx.close();
  }

  // Связь оборвалась на заказе — не повторять вслепую, а спросить сервер.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ order: 'abort', list: json(200, [row('making')]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    const t = await s.view();
    ['Связь оборвалась', '261018-01', 'готовится'].forEach(x => { if (!t.includes(x)) bad.push(`order-down: нет «${x}»`); });
    if (posts(s).length !== 1) bad.push('order-down: заказ повторён');
    await s.ctx.close();
  }

  // Позиция снята с меню — причина на экране, меню перезапрошено.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null,
      bar({ order: json(409, { detail: 'позиция снята с меню: Эспрессо' }) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(250);
    if (!(await s.view()).includes('Позиция снята с меню: Эспрессо')) bad.push('order-409: причина не показана');
    if (s.calls.filter(c => c.url.includes('/bar/menu')).length !== 2) bad.push('order-409: меню не перезапрошено');
    await s.ctx.close();
  }

  // Меню: битое — отказ, пустое — честное «пусто».
  for (const [name, menu, want, nope] of [
    ['menu-bad', json(200, [{ id: 'x', title: 'Эспрессо' }]), 'не разобран', '[data-action^="buy:"]'],
    ['menu-500', json(500, {}), 'кодом 500', '[data-action^="buy:"]'],
    ['menu-empty', json(200, []), 'ни одной позиции', '[data-action^="buy:"]']]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ menu }));
    await toBar(s);
    const t = await s.view();
    if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
    if (await s.p.evaluate(sel => !!document.querySelector(sel), nope)) bad.push(`${name}: есть кнопка ${nope}`);
    await s.ctx.close();
  }

  // 201, но без place и pay_method: не «undefined» и не «не создан» (гость заказал бы
  // второй), а то, что записал сервер, — из очереди.
  {
    const bare = Object.assign({}, ORDER); delete bare.place; delete bare.pay_method;
    const srv = Object.assign(row('new'), { place: 'к столу', pay_method: 'cash' });
    const s = await open_(bar({ order: json(201, bare), list: json(200, [srv]) }));
    await toBar(s);
    await s.p.click('[data-action="cart-add:11"]');
    await s.p.click('[data-go="barCart"]');
    await s.p.click('[data-where="к столу"]');
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.waitForTimeout(250);
    const t = await s.view();
    if (t.includes('undefined')) bad.push('order-bare: на экране «undefined»');
    if (!t.includes('ответ не разобран') || !t.includes('к столу · наличными'))  // наличные — из ответа сервера, как он записал bad.push('order-bare: не показано записанное сервером: ' + t.slice(0, 160));
    if (posts(s).length !== 1) bad.push('order-bare: заказ повторён');
    await s.ctx.close();
  }
  // Очередь целиком (админ, бар): чужой открытый заказ своим не становится;
  // строка без суммы (так её видит работник бара) рисуется без суммы.
  {
    const other = Object.assign(row('making'), { id: 9, number: '261018-02', member_id: 2 });
    const s = await open_(bar({ order: 'abort', list: json(200, [other]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    const t = await s.view();
    if (t.includes('261018-02')) bad.push('queue-other: чужой заказ показан своим');
    await s.ctx.close();
  }
  {
    const nosum = row('making'); delete nosum.sum; nosum.items = [{ title: 'Эспрессо', qty: 1 }];
    const s = await open_(bar({ order: 'abort', list: json(200, [nosum]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    const t = await s.view();
    if (!t.includes('261018-01') || !t.includes('готовится')) bad.push('queue-nosum: свой заказ без суммы не показан');
    if (/NaN|undefined|null ฿/.test(t)) bad.push('queue-nosum: мусор вместо суммы');
    await s.ctx.close();
  }
  {
    const noplace = row('making'); delete noplace.place;
    const s = await open_(bar({ order: 'abort', list: json(200, [noplace]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    const t = await s.view();
    if (t.includes('undefined') || t.includes('готовится')) bad.push('queue-noplace: строка без места принята');
    await s.ctx.close();
  }

  // ── очередь на баре (шаг 5) ──
  // Работнику чужие строки приходят без sum и без items[].price (cafe13-api#11).
  const worker = (id, number, st, extra) => Object.assign({ id, number, state: st, place: 'к столу', pay_method: 'account',
    created_at: '2026-10-18T12:0' + id + ':00+00:00', accepted_at: null, ready_at: null, served_at: null,
    member_id: 50 + id, first_name: 'Гость' + id, last_name: '', photo_url: null,
    items: [{ title: 'Эспрессо', qty: 2 }] }, extra);
  const QUEUE = [worker(3, '261018-03', 'new', { photo_url: 'https://t.me/i/userpic/320/x.jpg' }),
                 worker(2, '261018-02', 'making'), worker(1, '261018-01', 'served')];
  const BARMAN = clone(OWNER); BARMAN.roles = [{ role: 'bar', direction_id: 7 }];
  function queue(o) {
    o = Object.assign({ list: json(200, QUEUE), state: q => json(200, { id: 3, number: '261018-03', state: JSON.parse(q.postData()).state }) }, o);
    const b = bar({ list: o.list });
    return q => (q.method() === 'POST' && /\/bar\/orders\/\d+\/state$/.test(q.url())) ? (typeof o.state === 'function' ? o.state(q) : o.state) : b(q);
  }
  const statePosts = s => s.calls.filter(c => /\/state$/.test(c.url));
  async function toQueue(s) {
    await s.p.click('[data-go="barQueue"]');
    await s.p.waitForTimeout(250);
  }
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null, queue());
    await s.p.route('https://t.me/**', r => r.fulfill({ contentType: 'image/png', body: PNG }));
    if (!(await s.view()).includes('Заказы на баре')) bad.push('queue: нет входа на главной у роли bar');
    await toQueue(s);
    const t = await s.view();
    ['261018-03', '261018-02', 'Гость3', 'Гость2', 'фото нет', 'Принять', 'Готово', 'Смена открыта', '2 ×']
      .forEach(x => { if (!t.includes(x)) bad.push(`queue: нет «${x}»`); });
    if (/฿/.test(t)) bad.push('queue: у работника на экране есть цена: ' + (t.match(/.{0,20}฿/) || [''])[0]);
    if (/NaN|undefined/.test(t)) bad.push('queue: мусор на экране');
    if (await s.p.evaluate(() => (document.querySelector('img.avatar') || {}).src) !== 'https://t.me/i/userpic/320/x.jpg') bad.push('queue: фото гостя не показано');
    // в работе — по порядку прихода: 02 раньше 03
    if (t.indexOf('261018-02') > t.indexOf('261018-03')) bad.push('queue: порядок не по приходу');
    await s.p.screenshot({ path: `${OUT}/live-queue.png`, fullPage: true });

    await s.p.click('[data-action="q-making:3"]');
    await s.p.waitForTimeout(250);
    const sp = statePosts(s);
    if (sp.length !== 1 || !sp[0].url.endsWith('/bar/orders/3/state') || sp[0].body !== '{"state":"making"}')
      bad.push('queue: «Принять» ушло не так: ' + JSON.stringify(sp.map(c => [c.url, c.body])));
    if (s.calls.filter(c => c.method === 'GET' && c.url.includes('/bar/orders')).length < 2) bad.push('queue: после нажатия очередь не перезапрошена');
    if (s.errs.length) bad.push('queue: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Фото не загрузилось — сказано явно, а не пустой кружок.
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null, queue());
    await s.p.route('https://t.me/**', r => r.fulfill({ status: 404, body: '' }));
    await toQueue(s);
    await s.p.waitForTimeout(200);
    if (!(await s.view()).includes('фото не загрузилось')) bad.push('queue-photo-404: не сказано, что фото не загрузилось');
    await s.ctx.close();
  }
  // Строка без member_id — отказ целиком.
  {
    const nomid = worker(3, '261018-03', 'new'); delete nomid.member_id;
    const s = await open(true, true, json(200, BARMAN), null, null, null, queue({ list: json(200, [nomid]) }));
    await toQueue(s);
    if (!(await s.view()).includes('не разобран')) bad.push('queue-nomid: строка без member_id принята');
    await s.ctx.close();
  }

  // Отмена — в два нажатия; первое ничего не отправляет.
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null, queue());
    await toQueue(s);
    await s.p.click('[data-action="q-ask:3"]');
    if (statePosts(s).length) bad.push('cancel: отменено с первого нажатия');
    if (!(await s.view()).includes('Точно отменить')) bad.push('cancel: нет подтверждения');
    await s.p.click('[data-action="q-keep"]');
    if (statePosts(s).length || (await s.view()).includes('Точно отменить')) bad.push('cancel: «Не отменять» не сработало');
    await s.p.click('[data-action="q-ask:3"]');
    await s.p.click('[data-action="q-cancel:3"]');
    await s.p.waitForTimeout(200);
    const sp = statePosts(s);
    if (sp.length !== 1 || sp[0].body !== '{"state":"cancelled"}') bad.push('cancel: ' + JSON.stringify(sp.map(c => c.body)));
    await s.ctx.close();
  }
  // Двойное нажатие — одна смена состояния.
  {
    const slow = () => new Promise(res => setTimeout(() => res(json(200, { id: 3, state: 'making' })), 500));
    const s = await open(true, true, json(200, BARMAN), null, null, null, queue({ state: slow }));
    await toQueue(s);
    await s.p.evaluate(() => { doAction('q-making:3'); doAction('q-making:3'); });
    await s.p.waitForTimeout(800);
    if (statePosts(s).length !== 1) bad.push(`queue-busy: ${statePosts(s).length} нажатий ушло`);
    await s.ctx.close();
  }
  // Сервер отказал — причина как есть, не «готово».
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null,
      queue({ state: json(409, { detail: 'на счёте гостя не хватает — он пополняет у хостес' }) }));
    await toQueue(s);
    await s.p.click('[data-action="q-ready:2"]');
    await s.p.waitForTimeout(250);
    if (!(await s.view()).includes('На счёте гостя не хватает — он пополняет у хостес')) bad.push('queue-409: причина не показана');
    await s.ctx.close();
  }
  // Куратор/админ: суммы, если пришли, видны построчно.
  {
    const withSum = QUEUE.map(r => Object.assign({}, r, { sum: '140.00' }));
    const s = await open(true, true, json(200, OWNER), null, null, null, queue({ list: json(200, withSum) }));
    await toQueue(s);
    if (!(await s.view()).includes('140 ฿')) bad.push('queue-boss: сумма, присланная сервером, не показана');
    await s.ctx.close();
  }
  // Без роли бара — входа нет; сервер 403 — сказано почему; битая строка — отказ целиком.
  {
    const plain = clone(OWNER); plain.roles = [];
    const s = await open(true, true, json(200, plain), null, null, null, queue());
    if ((await s.view()).includes('Заказы на баре')) bad.push('queue-norole: вход есть у человека без роли');
    await s.ctx.close();
  }
  for (const [name, list, want] of [
    ['queue-403', json(403, { detail: 'нет' }), 'Очередь видна бару и куратору'],
    ['queue-bad', json(200, [Object.assign(worker(3, '261018-03', 'new'), { place: undefined })]), 'не разобран']]) {
    const s = await open(true, true, json(200, BARMAN), null, null, null, queue({ list }));
    await toQueue(s);
    const t = await s.view();
    if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
    if (await s.p.evaluate(() => !!document.querySelector('[data-action^="q-"]'))) bad.push(`${name}: кнопки без очереди`);
    await s.ctx.close();
  }

  // Отменённый бар заказ: деньги вернулись — экран говорит это и показывает свежий баланс.
  {
    let mes = 0;
    const s = await open(true, true, () => { mes += 1; return json(200, OWNER); },
      null, null, null, bar({ list: json(200, [row('cancelled')]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(400);
    const t = await s.view();
    if (!t.includes('Деньги вернулись на счёт')) bad.push('cancelled: не сказано, что деньги вернулись');
    if (s.calls.filter(c => c.url.endsWith('/me')).length < 3) bad.push('cancelled: баланс не перезапрошен после отмены');
    await s.ctx.close();
  }

  // Бар закрыт (смена не открыта): меню видно, заказ не уходит, причина названа.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ dirs: DIR(false) }));
    await toBar(s);
    const t = await s.view();
    ['Эспрессо', 'закрыт', 'Бар закрыт'].forEach(x => { if (!t.includes(x)) bad.push(`bar-closed: нет «${x}»`); });
    if (await s.p.evaluate(() => !!document.querySelector('[data-action^="buy:"]'))) bad.push('bar-closed: есть кнопка «Купить»');
    await s.p.evaluate(() => doAction('buy:11'));
    await s.p.waitForTimeout(150);
    if (posts(s).length) bad.push('bar-closed: заказ ушёл в закрытый бар');
    if (!(await s.view()).includes('Смена не открыта')) bad.push('bar-closed: отказ без причины');
    await s.ctx.close();
  }
  // Экран думал «открыт», а смену успели закрыть: сервер отказал — причина как есть,
  // направления перезапрошены, и экран становится «закрыт».
  {
    let open = true;
    const s = await open_(bar({ dirs: () => DIR(open),
      order: () => { open = false; return json(409, { detail: 'бар закрыт: смена не открыта, заказ принять некому' }); } }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    const t = await s.view();
    if (!t.includes('Бар закрыт: смена не открыта, заказ принять некому')) bad.push('order-409-closed: причина сервера не показана');
    if (await s.p.evaluate(() => !!document.querySelector('[data-action^="buy:"]'))) bad.push('order-409-closed: «Купить» осталась');
    await s.ctx.close();
  }

  // Направление не найдено / найдено дважды / ответ битый — отказ, а не пустое меню.
  for (const [name, dirs, want] of [
    ['dirs-none', json(200, [{ id: 3, title: 'Кухня', is_active: true, is_open: true }]), 'не нашлось направления'],
    ['dirs-two', DIR(true, [{ id: 8, title: 'Бар', is_active: true, is_open: true }]), 'не нашлось направления'],
    ['dirs-inactive', json(200, [{ id: 7, title: 'Бар', is_active: false, is_open: true }]), 'не нашлось направления'],
    ['dirs-bad', json(200, [{ id: 7, title: 'Бар' }]), 'не разобран'],
    ['dirs-500', json(500, {}), 'кодом 500']]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ dirs }));
    await toBar(s);
    const t = await s.view();
    if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
    if (s.calls.some(c => c.url.includes('/bar/menu'))) bad.push(`${name}: меню запрошено по угаданному направлению`);
    if (t.includes('ни одной позиции')) bad.push(`${name}: показано «меню пустое»`);
    await s.ctx.close();
  }

  // Корзина: несколько позиций и место — как выбрал гость; оплата только со счёта
  // (cafe13-api#13: наличные на баре сервер отклоняет), выбора «наличными» нет.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar());
    await toBar(s);
    await s.p.click('[data-action="cart-add:11"]');
    await s.p.click('[data-action="cart-add:12"]');
    await s.p.click('[data-go="barCart"]');
    await s.p.click('[data-where="с собой"]');
    if (await s.p.evaluate(() => !!document.querySelector('[data-pay]'))) bad.push('cart: есть выбор оплаты, которого нет');
    if (!(await s.view()).includes('Пополнить можно у хостес')) bad.push('cart: не сказано, где пополнить');
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.waitForTimeout(250);
    const pp = posts(s);
    const want = { direction_id: 7, place: 'с собой', pay_method: 'account', items: [{ product_id: 11, qty: 1 }, { product_id: 12, qty: 1 }] };
    if (pp.length !== 1 || JSON.stringify(JSON.parse(pp[0].body)) !== JSON.stringify(want))
      bad.push('cart: тело заказа ' + JSON.stringify(pp.map(c => c.body)));
    await s.ctx.close();
  }

  // Карточка напитка: главная кнопка — «Купить», при нехватке её нет.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar());
    await toBar(s);
    await s.p.click('[data-drink="11"]');
    if (!(await s.view()).includes('Купить за 70 ฿')) bad.push('drink: нет «Купить за 70 ฿»');
    if (!(await s.p.evaluate(() => !!window.__main))) bad.push('drink: главная кнопка не «Купить»');
    await s.p.click('[data-go="bar"]').catch(() => {});
    await s.p.evaluate(() => go('drink', '21'));
    if (await s.p.evaluate(() => !!window.__main)) bad.push('drink-21: главная кнопка «Купить» при нехватке');
    if (!(await s.view()).includes('Не хватает')) bad.push('drink-21: нехватка не названа');
    await s.ctx.close();
  }

  // Сети нет — сохранённый пропуск этого человека виден на экране сбоя.
  for (const [name, me, saved, show] of [
    ['offline-pass', 'abort', SAVED, true],
    ['offline-other-user', 'abort', Object.assign({}, SAVED, { uid: 2 }), false],
    ['server-500-saved', json(500, {}), SAVED, false],
    ['offline-broken-saved', 'abort', Object.assign({}, SAVED, { code: 'XIII-42' }), false],
    ['offline-expired', 'abort', Object.assign({}, SAVED, { lifelong: false, ends: '2020-01-01T00:00:00+07:00' }), false],
    ['offline-finite-live', 'abort', Object.assign({}, SAVED, { lifelong: false, ends: '2099-01-01T00:00:00+07:00' }), true],
    ['offline-old-format', 'abort', Object.assign({}, SAVED, { lifelong: false, until: '14 ноября 2026' }), false]]) {
    const s = await open(true, true, me, null, null, saved);
    const t = await s.view();
    // «показан» — по заголовку блока, а не по коду: битая запись показала бы не тот код
    const has = t.includes('Пропуск, сохранённый на телефоне');
    if (has !== show) bad.push(`${name}: сохранённый пропуск ${has ? 'показан' : 'не показан'}`);
    if (show && !t.includes('XIII · 0042')) bad.push(`${name}: показан не тот код`);
    if (!t.includes('Сервер клуба недоступен')) bad.push(`${name}: нет экрана сбоя`);
    if (name === 'offline-pass') await s.p.screenshot({ path: `${OUT}/live-offline-pass.png`, fullPage: true });
    await s.ctx.close();
  }

  // ── смена ──
  // Без открытой смены сервер не принимает заказов (409 «бар закрыт»).
  // Состояние бара — только из /directions: заглушка переключает is_open,
  // когда «сервер» принял нажатие, и не переключает, когда «соврал».
  function shift(o) {
    o = Object.assign({ open: false, openReply: 201, closeReply: 200, flips: true, detail: null }, o);
    const st = { open: o.open, dirsCalls: 0 };
    const q = queue({ list: json(200, QUEUE) });
    const fn = r => {
      const u = r.url();
      if (u.endsWith('/directions')) {
        st.dirsCalls++;
        if (o.dirs) { const x = o.dirs(st.dirsCalls, st); if (x !== undefined) return x; }
        return DIR(st.open);
      }
      if (r.method() === 'POST' && u.includes('/shifts/open')) {
        if (o.openReply < 300 && o.flips) st.open = true;
        return json(o.openReply, o.openReply < 300 ? { id: 1 } : { detail: o.detail });
      }
      if (r.method() === 'POST' && u.includes('/shifts/close')) {
        if (o.closeReply < 300 && o.flips) st.open = false;
        return json(o.closeReply, o.closeReply < 300 ? { id: 1 } : { detail: o.detail });
      }
      return q(r);
    };
    fn.st = st;
    return fn;
  }
  const shiftPosts = s => s.calls.filter(c => c.method === 'POST' && c.url.includes('/shifts/'));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Админ открывает смену на себя; двойное нажатие — один запрос.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null,
      (() => { const f = shift(); return r => r.method() === 'POST' && r.url().includes('/shifts/open')
        ? sleep(400).then(() => f(r)) : f(r); })());
    await toQueue(s);
    let t = await s.view();
    if (!t.includes('Смена не открыта') || !t.includes('Открыть смену на себя')) bad.push('shift-open: нет кнопки открытия у админа при закрытом баре');
    await s.p.click('[data-action="shift-open"]');
    await s.p.click('[data-action="shift-open"]').catch(() => {});
    await s.p.waitForTimeout(900);
    const sp = shiftPosts(s);
    if (sp.length !== 1 || !sp[0].url.endsWith('/shifts/open') ||
        sp[0].body !== JSON.stringify({ direction_id: 7, member_id: OWNER.member.tg_user_id }))
      bad.push('shift-open: ушло не так: ' + JSON.stringify(sp.map(c => [c.url, c.body])));
    t = await s.view();
    if (!t.includes('Гости могут заказывать') || !t.includes('Закрыть смену')) bad.push('shift-open: после открытия не видно открытой смены');
    if (s.errs.length) bad.push('shift-open: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-shift-open.png`, fullPage: true });
    await s.ctx.close();
  }
  // Бармен: открыть не может (это куратор), закрыть — в два нажатия.
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null, shift({ open: true }));
    await toQueue(s);
    const has = sel => s.p.$(sel).then(Boolean);
    if (!(await has('[data-action="shift-ask"]'))) { bad.push('shift-close: у бармена нет кнопки закрытия'); await s.ctx.close(); }
    else {
    await s.p.click('[data-action="shift-ask"]');
    await s.p.waitForTimeout(200);
    if (shiftPosts(s).length || !(await has('[data-action="shift-keep"]'))) bad.push('shift-close: закрыто с первого нажатия');
    else {
    if (!(await s.view()).includes('Новые заказы перестанут приниматься')) bad.push('shift-close: нет предупреждения');
    await s.p.click('[data-action="shift-keep"]');
    if (shiftPosts(s).length || (await s.view()).includes('Точно закрыть')) bad.push('shift-close: «Не закрывать» не сработало');
    await s.p.click('[data-action="shift-ask"]');
    await s.p.click('[data-action="shift-close"]');
    await s.p.waitForTimeout(400);
    const sp = shiftPosts(s);
    if (sp.length !== 1 || !sp[0].url.endsWith('/shifts/close?direction_id=7') || sp[0].body !== '{}')
      bad.push('shift-close: ушло не так: ' + JSON.stringify(sp.map(c => [c.url, c.body])));
    const t = await s.view();
    if (!t.includes('Смена закрыта') || !t.includes('Смена не открыта')) bad.push('shift-close: после закрытия бар не закрыт на экране');
    if (t.includes('Открыть смену на себя')) bad.push('shift-barman: бармену предложено открыть смену');
    if (!t.includes('Смену открывает куратор направления')) bad.push('shift-barman: не сказано, кто открывает');
    }
    await s.ctx.close();
    }
  }
  // Куратор ДРУГОГО направления — не куратор бара: ни открыть, ни закрыть.
  {
    const other = clone(OWNER); other.roles = [{ role: 'curator', direction_id: 8 }, { role: 'bar', direction_id: 8 }];
    const s = await open(true, true, json(200, other), null, null, null, shift());
    await toQueue(s);
    const t = await s.view();
    if (!t.includes('Смена не открыта')) bad.push('shift-other: экран смены не показан');
    if (t.includes('Открыть смену на себя')) bad.push('shift-other: куратору чужого направления предложено открыть смену');
    await s.ctx.close();
  }
  // Сервер отказал — его причина на экране, бар остаётся закрытым.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null,
      shift({ openReply: 403, detail: 'нужна роль curator в направлении 7' }));
    await toQueue(s);
    await s.p.click('[data-action="shift-open"]');
    await s.p.waitForTimeout(400);
    const t = await s.view();
    if (!t.includes('Смена не открылась') || !t.includes('Нужна роль curator в направлении 7')) bad.push('shift-403: отказ без причины');
    if (t.includes('Гости могут заказывать')) bad.push('shift-403: успех при отказе');
    await s.ctx.close();
  }
  // «Принято», а бар по-прежнему закрыт — верим перечитанному, а не ответу.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, shift({ flips: false }));
    await toQueue(s);
    await s.p.click('[data-action="shift-open"]');
    await s.p.waitForTimeout(400);
    const t = await s.view();
    if (!t.includes('Смена не открылась') || !t.includes('по-прежнему закрыт')) bad.push('shift-lie: «принято» без открытия выдано за успех');
    await s.ctx.close();
  }
  // Смену открыли с другого телефона — экран узнаёт при опросе; сбой
  // опроса не стирает известное состояние, а помечает его.
  {
    const f = shift({ dirs: (n, st) => { if (n === 2) st.open = true; if (n >= 3) return 'abort'; } });
    const s = await open(true, true, json(200, BARMAN), null, null, null, f);
    await toQueue(s);
    if (!(await s.view()).includes('Смена не открыта')) bad.push('shift-poll: начальное состояние не то');
    await s.p.waitForTimeout(8400);
    if (!(await s.view()).includes('Смена открыта')) bad.push('shift-poll: открытие с другого телефона не замечено');
    await s.p.waitForTimeout(8400);
    const t = await s.view();
    if (!t.includes('Смена открыта') || !t.includes('не обновилось')) bad.push('shift-poll: сбой опроса стёр или скрыл состояние смены');
    await s.ctx.close();
  }

  // ── внести себе на счёт ──
  // POST /till отвечает строкой книги (RETURNING id, at, kind, amount,
  // method, member_id, note — cafe13-api app/routers/till.py, по коду, не
  // по снимку). Баланс после — только из перечитанного /me.
  const TILL_ROW = { id: 90, at: '2026-10-20T10:00:00+00:00', kind: 'topup', amount: '500.00', method: 'card', member_id: 1, note: '' };
  function till(o) {
    o = Object.assign({ reply: q => json(201, Object.assign({}, TILL_ROW,
                                                           (({ amount, method, member_id }) => ({ amount: String(amount) + '.00', method, member_id }))(JSON.parse(q.postData())))),
                        after: 3670 }, o);
    const st = { posted: false };
    return r => {
      const u = r.url();
      if (r.method() === 'POST' && u.endsWith('/till')) {
        if (o.reply === 'abort') { st.posted = true; return 'abort'; }
        const x = o.reply(r); st.posted = r.postData && x.status < 300; return x;
      }
      if (u.endsWith('/me') && st.posted) {
        if (o.meFail) return json(500, { detail: 'x' });
        const m = clone(o.who || OWNER); m.balance = o.after; return json(200, m);
      }
      return undefined;
    };
  }
  const tillPosts = s => s.calls.filter(c => c.method === 'POST' && c.url.endsWith('/till'));
  async function toTopup(s, amount) {
    if (!(await s.p.$('#view [data-go="topup"]'))) { bad.push('topup: на главной нет «Внести себе на счёт»'); return false; }
    await s.p.click('#view [data-go="topup"]');
    await s.p.waitForTimeout(150);
    if (!(await s.p.$('#t-amount'))) { bad.push('topup: нет поля суммы'); return false; }
    await s.p.fill('#t-amount', amount);
    return true;
  }
  // Админ вносит себе картой: два нажатия, одно тело, баланс — из /me.
  for (const _ of [0]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, till());
    if (await toTopup(s, '500')) {
      await s.p.click('[data-action="t-method:card"]');
      await s.p.click('[data-action="t-ask"]');
      await s.p.waitForTimeout(150);
      if (tillPosts(s).length || !(await s.p.$('[data-action="t-keep"]'))) { bad.push('topup: внесено с первого нажатия'); await s.ctx.close(); continue; }
      let t = await s.view();
      if (!t.includes('Внести 500 ฿ картой на свой счёт?')) bad.push('topup: подтверждение не называет сумму и способ: ' + t.slice(0, 200));
      await s.p.click('[data-action="t-keep"]');
      if (tillPosts(s).length || (await s.p.$('[data-action="t-send"]'))) bad.push('topup: «Не вносить» не сработало');
      await s.p.click('[data-action="t-ask"]');
      await s.p.click('[data-action="t-send"]');
      await s.p.waitForTimeout(400);
      const tp = tillPosts(s);
      if (tp.length !== 1 || tp[0].body !== JSON.stringify({ kind: 'topup', amount: 500, method: 'card', member_id: OWNER.member.tg_user_id }))
        bad.push('topup: ушло не так: ' + JSON.stringify(tp.map(c => c.body)));
      t = await s.view();
      if (!t.includes('Внесено 500 ฿') || !t.includes('На счёте сейчас 3 670 ฿')) bad.push('topup: нет итога с перечитанным балансом');
      await s.p.screenshot({ path: `${OUT}/live-topup-form.png`, fullPage: true });
    }
    if (s.errs.length) bad.push('topup: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Не сумма — не отправляется.
  for (const bad_ of ['abc', '0', '-5', '1.234']) {
    const s = await open(true, true, json(200, OWNER), null, null, null, till());
    if (await toTopup(s, bad_)) {
      await s.p.click('[data-action="t-ask"]');
      if (!(await s.view()).includes('Сумма — число больше нуля') || (await s.p.$('[data-action="t-send"]')))
        bad.push(`topup-amount: «${bad_}» принято как сумма`);
    }
    await s.ctx.close();
  }
  // Ответ потерян — «неизвестно», не «внесено» и не «повторите».
  for (const [name, reply, want] of [
    ['topup-lost', 'abort', 'Сервер не ответил'],
    // 201, баланс вырос, но строка не та — каждое поле своим случаем:
    // иначе проверка поля перекрыта соседней и мутация её не видит.
    ['topup-alien', q => json(201, Object.assign({}, TILL_ROW, { member_id: 2 })), 'Ответ сервера не разобран'],
    ['topup-kind', q => json(201, Object.assign({}, TILL_ROW, { kind: 'membership' })), 'Ответ сервера не разобран'],
    ['topup-sum', q => json(201, Object.assign({}, TILL_ROW, { amount: '5000.00' })), 'Ответ сервера не разобран'],
    // записано, а /me не ответил — не «ответ не разобран»: разобран был /till
    ['topup-nome', 'nome', 'баланс прочитать не удалось'],
    ['topup-403', q => json(403, { detail: 'нужна роль staff' }), 'Нужна роль staff'],
    // 201 с верными полями, а баланс не вырос (так сервер обходится с
    // method=cash/card, замер архитектора к #15): не «Внесено».
    ['topup-nogrow', undefined, 'на счёт не попало']]) {
    const s = await open(true, true, json(200, OWNER), null, null, null,
      till(Object.assign({ after: name === 'topup-403' || name === 'topup-nogrow' ? 3170 : 3670, meFail: reply === 'nome' },
                         reply && reply !== 'nome' ? { reply } : {})));
    if (await toTopup(s, '500')) {
      await s.p.click('[data-action="t-ask"]');
      await s.p.waitForTimeout(150);
      if (!(await s.p.$('[data-action="t-send"]'))) { bad.push(`${name}: нет подтверждения перед внесением`); await s.ctx.close(); continue; }
      await s.p.click('[data-action="t-send"]');
      await s.p.waitForTimeout(400);
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
      if (t.includes('Внесено 500')) bad.push(`${name}: выдано за успех`);
      if (['topup-lost', 'topup-alien', 'topup-kind', 'topup-sum', 'topup-nome'].includes(name)) { if (!t.includes('Сверьте, прежде чем вносить снова')) bad.push(`${name}: не предупреждено о двойном внесении`); }
      if (name === 'topup-nogrow' && !t.includes('Не вносите снова')) bad.push(`${name}: не предупреждено о двойном внесении`);
      if (name === 'topup-403' && !t.includes('Не внесено')) bad.push(`${name}: отказ не назван`);
    }
    await s.ctx.close();
  }
  // Без права кассы — прежний текст и никакой формы.
  {
    const poor = clone(BARMAN); poor.balance = 0;
    const s = await open(true, true, json(200, poor), null, null, null, bar());
    if (await s.p.$('#view [data-go="topup"]')) bad.push('topup-norole: бармену предложено вносить');
    await toBar(s);
    if (!(await s.p.$('#view [data-go="topup"]'))) bad.push('topup-norole: при нуле нет пути к пополнению');
    else {
      await s.p.click('#view [data-go="topup"]');
      await s.p.waitForTimeout(100);
      if (await s.p.$('#t-amount')) bad.push('topup-norole: форма внесения у бармена');
      if (!(await s.view()).includes('у хостес')) bad.push('topup-norole: нет прежнего текста');
    }
    await s.ctx.close();
  }

  // ── доход и расход бара ──
  // Формы ответов — снимки bar-expense и bar-income (сверка ниже, в shape).
  // Заглушка по умолчанию отвечает строкой, собранной из отправленного, —
  // как сервер; каждое поле, которое клиент сверяет, ломается своим случаем.
  const EXP_ROW = { id: 9029, at: '2026-10-20T11:41:43+00:00', amount: '240.00', expense_cat: 'закуп',
                    expense_kind: 'opex', paid_by: 'club_till', note: 'молоко' };
  const INC_ROW = { id: 9031, at: '2026-10-20T12:00:00+00:00', amount: '1500.00', method: 'card',
                    direction_id: 7, member_id: null, note: 'вечер' };
  const money2 = v => Number(v).toFixed(2);
  function book(o) {
    o = Object.assign({
      exp: q => { const x = JSON.parse(q.postData()); return json(201, Object.assign({}, EXP_ROW, { amount: money2(x.amount),
               expense_cat: x.expense_cat, expense_kind: x.expense_kind, paid_by: x.paid_by, note: x.note })); },
      inc: q => { const x = JSON.parse(q.postData()); return json(201, Object.assign({}, INC_ROW, { amount: money2(x.amount),
               method: x.method, direction_id: x.direction_id, note: x.note })); } }, o);
    const b = queue();
    return q => {
      const u = q.url();
      const f = q.method() === 'POST' && u.endsWith('/bar/expenses') ? o.exp : q.method() === 'POST' && u.endsWith('/bar/income') ? o.inc : null;
      if (f) return f === 'abort' ? 'abort' : f(q);
      return b(q);
    };
  }
  // Щелчок с проверкой: нет кнопки или она выключена — своим текстом, а не таймаутом.
  async function tap(s, sel) {
    const e = await s.p.$(sel);
    if (!e || !(await e.isVisible()) || !(await e.isEnabled())) { bad.push(`${s.name || 'book'}: нет доступной кнопки ${sel}`); return false; }
    await e.click(); return true;
  }
  const bookPosts = s => s.calls.filter(c => c.method === 'POST' && /\/bar\/(expenses|income)$/.test(c.url));
  // Саша — куратор Бара без членства: путь только через вкладку «Заказы»
  const SASHA = clone(OWNER); SASHA.roles = [{ role: 'curator', direction_id: 7 }];
  SASHA.membership_active = false; SASHA.membership = null;
  async function toBook(s, name) {
    for (const sel of ['#tabs [data-go="barQueue"]', '#view [data-go="barQueue"]']) {
      if (await s.p.$(sel)) { await tap(s, sel); await s.p.waitForTimeout(250); break; }
    }
    if (!(await s.p.$('#view [data-go="barMoney"]'))) { bad.push(`${name}: в очереди нет «Доход и расход»`); return false; }
    await tap(s, '#view [data-go="barMoney"]');
    await s.p.waitForTimeout(250);
    return true;
  }
  async function fillExpense(s, name, amount, picks) {
    if (!(await s.p.$('[data-action="b-new:expense"]'))) { bad.push(`${name}: нет кнопки «Расход»`); return false; }
    await tap(s, '[data-action="b-new:expense"]');
    if (!(await s.p.$('#b-amount'))) { bad.push(`${name}: нет поля суммы`); return false; }
    await s.p.fill('#b-amount', amount);
    await s.p.fill('#b-note', 'молоко');
    for (const a of picks) {
      if (!(await s.p.$(`[data-action="${a}"]`))) { bad.push(`${name}: нет выбора ${a}`); return false; }
      await tap(s, `[data-action="${a}"]`);
    }
    return true;
  }
  const ALL_PICKS = ['b-cat:закуп', 'b-kind:opex', 'b-paid:club_till'];
  async function askSend(s, name) {
    await tap(s, '[data-action="b-ask"]');
    await s.p.waitForTimeout(100);
    if (!(await s.p.$('[data-action="b-send"]'))) { bad.push(`${name}: нет подтверждения перед записью`); return false; }
    await tap(s, '[data-action="b-send"]');
    await s.p.waitForTimeout(400);
    return true;
  }
  // Расход: без выбора не уходит; подтверждение; одно тело; итог из ответа.
  {
    const s = await open(true, true, json(200, SASHA), null, null, null, book()); s.name = 'book-sasha';
    if (await toBook(s, 'book-expense') && await fillExpense(s, 'book-expense', '240', [])) {
      // признак «не подставлено молча»: ни одна категория/вид/оплата не нажата
      if (await s.p.$('[data-action^="b-cat"][aria-pressed="true"], [data-action^="b-kind"][aria-pressed="true"], [data-action^="b-paid"][aria-pressed="true"]'))
        bad.push('book-expense: категория, вид или оплата выбраны за человека');
      await tap(s, '[data-action="b-ask"]');
      await s.p.waitForTimeout(100);
      let t = await s.view();
      if (!t.includes('Выберите категорию, вид затраты, чем платили') || (await s.p.$('[data-action="b-send"]')))
        bad.push('book-expense: без категории, вида и оплаты дошло до записи');
      if ((await s.p.inputValue('#b-amount')) !== '240' || (await s.p.inputValue('#b-note')) !== 'молоко')
        bad.push('book-expense: выбор стёр введённое');
      for (const a of ALL_PICKS) await tap(s, `[data-action="${a}"]`);
      await tap(s, '[data-action="b-ask"]');
      await s.p.waitForTimeout(100);
      t = await s.view();
      if (!t.includes('Записать расход 240 ฿?') || !t.includes('закуп · текущая трата · касса клуба · молоко'))
        bad.push('book-expense: подтверждение не называет сумму и выбор: ' + t.slice(0, 300));
      if (bookPosts(s).length) bad.push('book-expense: записано с первого нажатия');
      // вид затраты — словами человека, с подсказкой при закупе
      if (!t.includes('Закуп — обычно текущая трата') || !t.includes('продукты, расходники')) bad.push('book-expense: нет подсказки «обычно текущая трата» или подписи словами');
      await s.p.screenshot({ path: `${OUT}/live-book-confirm.png`, fullPage: true });
      if (await s.p.$('[data-action="b-keep"]')) await tap(s, '[data-action="b-keep"]');
      if (bookPosts(s).length || (await s.p.$('[data-action="b-send"]'))) bad.push('book-expense: «Не записывать» не сработало');
      if (await askSend(s, 'book-expense')) {
        const bp = bookPosts(s);
        const want = JSON.stringify({ direction_id: 7, amount: 240, expense_cat: 'закуп', expense_kind: 'opex', paid_by: 'club_till', note: 'молоко' });
        if (bp.length !== 1 || !bp[0].url.endsWith('/bar/expenses') || bp[0].body !== want) bad.push('book-expense: ушло не так: ' + JSON.stringify(bp.map(c => c.body)));
        t = await s.view();
        if (!t.includes('Расход записан: 240 ฿') || !t.includes('Записано сейчас') || !t.includes('−240 ฿')) bad.push('book-expense: нет итога записи');
        if (await s.p.$('[data-action^="b-cat"][aria-pressed="true"]')) bad.push('book-expense: выбор прошлой записи перенесён в следующую');
        await s.p.screenshot({ path: `${OUT}/live-book-expense.png`, fullPage: true });
      }
    }
    if (s.errs.length) bad.push('book-expense: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Доход: админ с главной; «со счёта» нет; без способа не уходит.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, book()); s.name = 'book-owner';
    if (!(await s.p.$('#view [data-go="barMoney"]'))) bad.push('book-income: на главной у админа нет «Доход и расход бара»');
    else {
      await tap(s, '#view [data-go="barMoney"]');
      await s.p.waitForTimeout(250);
      if (!(await s.p.$('[data-action="b-new:income"]'))) bad.push('book-income: нет кнопки «Доход»');
      else {
        await tap(s, '[data-action="b-new:income"]');
        const how = await s.p.$$eval('[data-action^="b-method"]', e => e.map(x => x.getAttribute('data-action')));
        if (JSON.stringify(how) !== JSON.stringify(['b-method:cash', 'b-method:card'])) bad.push('book-income: способы ' + JSON.stringify(how));
        await s.p.fill('#b-amount', '1500');
        await s.p.fill('#b-note', 'вечер');
        await tap(s, '[data-action="b-ask"]');
        if (!(await s.view()).includes('Выберите, чем заплатили') || (await s.p.$('[data-action="b-send"]'))) bad.push('book-income: без способа дошло до записи');
        await tap(s, '[data-action="b-method:card"]');
        if (await askSend(s, 'book-income')) {
          const bp = bookPosts(s);
          if (bp.length !== 1 || !bp[0].url.endsWith('/bar/income') || bp[0].body !== JSON.stringify({ direction_id: 7, amount: 1500, method: 'card', note: 'вечер' }))
            bad.push('book-income: ушло не так: ' + JSON.stringify(bp.map(c => c.body)));
          if (!(await s.view()).includes('Доход записан: 1 500 ฿')) bad.push('book-income: нет итога записи');
          await s.p.screenshot({ path: `${OUT}/live-book-income.png`, fullPage: true });
        }
      }
    }
    if (s.errs.length) bad.push('book-income: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Подсказка — только при закупе и расходниках, не при ремонте: иначе она шум.
  {
    const s = await open(true, true, json(200, SASHA), null, null, null, book()); s.name = 'book-hint';
    if (await toBook(s, 'book-hint') && await fillExpense(s, 'book-hint', '240', ['b-cat:ремонт'])) {
      if ((await s.view()).includes('обычно текущая трата')) bad.push('book-hint: подсказка «обычно текущая» при ремонте');
      await tap(s, '[data-action="b-cat:расходники"]');
      if (!(await s.view()).includes('Расходники — обычно текущая трата')) bad.push('book-hint: нет подсказки при расходниках');
    }
    await s.ctx.close();
  }
  // Не сумма — не уходит.
  for (const v of ['0', 'abc', '1.234']) {
    const s = await open(true, true, json(200, SASHA), null, null, null, book()); s.name = 'book-sasha';
    if (await toBook(s, 'book-amount') && await fillExpense(s, 'book-amount', v, ALL_PICKS)) {
      await tap(s, '[data-action="b-ask"]');
      if (!(await s.view()).includes('Сумма — число больше нуля') || (await s.p.$('[data-action="b-send"]'))) bad.push(`book-amount: «${v}» принято как сумма`);
    }
    await s.ctx.close();
  }
  // Ответ не тот или потерян — «неизвестно» и «не записывайте снова», не «записан».
  const alt = (row, k, v) => q => json(201, Object.assign({}, row, JSON.parse(q.postData()), { [k]: v }, k === 'amount' ? {} : { amount: money2(JSON.parse(q.postData()).amount) }));
  for (const [name, o, want, inc] of [
    ['book-lost', { exp: 'abort' }, 'Сервер не ответил'],
    ['book-sum', { exp: alt(EXP_ROW, 'amount', '2400.00') }, 'Ответ сервера не разобран'],
    ['book-cat', { exp: alt(EXP_ROW, 'expense_cat', 'ремонт') }, 'Ответ сервера не разобран'],
    ['book-kind', { exp: alt(EXP_ROW, 'expense_kind', 'invest') }, 'Ответ сервера не разобран'],
    ['book-paid', { exp: alt(EXP_ROW, 'paid_by', 'partner') }, 'Ответ сервера не разобран'],
    ['book-note', { exp: alt(EXP_ROW, 'note', '') }, 'Ответ сервера не разобран'],
    ['book-noid', { exp: alt(EXP_ROW, 'id', null) }, 'Ответ сервера не разобран'],
    ['book-inc-method', { inc: alt(INC_ROW, 'method', 'cash') }, 'Ответ сервера не разобран', true],
    ['book-403', { exp: () => json(403, { detail: 'нужна роль curator' }) }, 'Нужна роль curator']]) {
    const s = await open(true, true, json(200, SASHA), null, null, null, book(o)); s.name = name;
    let ready = false;
    if (inc) {
      if (await toBook(s, name) && await s.p.$('[data-action="b-new:income"]')) {
        await tap(s, '[data-action="b-new:income"]');
        await s.p.fill('#b-amount', '1500'); await s.p.fill('#b-note', 'вечер');
        await tap(s, '[data-action="b-method:card"]');
        ready = true;
      } else bad.push(`${name}: не дошли до формы дохода`);
    } else ready = await toBook(s, name) && await fillExpense(s, name, '240', ALL_PICKS);
    if (ready && await askSend(s, name)) {
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
      if (/записан:/.test(t) || t.includes('Записано сейчас')) bad.push(`${name}: выдано за успех`);
      if (want !== 'Нужна роль curator' && !t.includes('Не записывайте снова'))
        bad.push(`${name}: не предупреждено о двойной записи`);
      if (want === 'Нужна роль curator' && !t.includes('Не записано')) bad.push(`${name}: отказ не назван`);
    }
    await s.ctx.close();
  }
  // Без права: бармен не видит входа; куратор другого направления получает отказ, а не форму.
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null, book()); s.name = 'book-barman';
    if (await s.p.$('#view [data-go="barMoney"]')) bad.push('book-norole: бармену на главной предложено вносить');
    await toQueue(s);
    if (await s.p.$('#view [data-go="barMoney"]')) bad.push('book-norole: бармену в очереди предложено вносить');
    await s.p.evaluate(() => go('barMoney'));
    await s.p.waitForTimeout(250);
    if (await s.p.$('#b-amount') || await s.p.$('[data-action="b-new:expense"]')) bad.push('book-norole: форма у бармена');
    await s.ctx.close();
  }
  {
    const tea = clone(SASHA); tea.roles = [{ role: 'curator', direction_id: 2 }];
    const s = await open(true, true, json(200, tea), null, null, null, book()); s.name = 'book-tea';
    await s.p.evaluate(() => go('barMoney'));
    await s.p.waitForTimeout(250);
    const t = await s.view();
    if (await s.p.$('[data-action="b-new:expense"]') || !t.includes('вносит куратор')) bad.push('book-other-dir: куратору другого направления дана форма Бара');
    if (bookPosts(s).length) bad.push('book-other-dir: ушла запись');
    await s.ctx.close();
  }

  // ── отчёт за день ──
  // Форма — снимок bar-day (сверка в shape). Числа подобраны так, чтобы итоги
  // сходились со строками; ломается каждый итог своим случаем.
  const DAY_ROW = {
    day_start: '2026-10-19T17:00:00Z', day_end: '2026-10-20T17:00:00Z',
    by_state: [{ state: 'served', pay_method: 'account', orders: 2, total: '140.00' }, { state: 'served', pay_method: 'cash', orders: 1, total: '70.00' }],
    served_total: '210.00', cash_total: '70.00',
    positions: [{ title: 'Эспрессо', qty: 3, total: '210.00' }],
    income: [{ id: 1, at: '2026-10-20T12:00:00Z', amount: '1500.00', method: 'cash', note: 'выручка вечера' },
             { id: 2, at: '2026-10-20T12:05:00Z', amount: '70.00', method: 'card', note: 'картой' }],
    income_total: '1570.00',
    expenses: [{ id: 3, at: '2026-10-20T09:00:00Z', amount: '240.00', expense_cat: 'закуп', expense_kind: 'opex', paid_by: 'bar_cash', note: 'молоко' },
               { id: 4, at: '2026-10-20T10:00:00Z', amount: '25000.00', expense_cat: 'ремонт', expense_kind: 'invest', paid_by: 'partner', note: 'кофемашина' }],
    expense_total: '25240.00', expense_opex: '240.00', expense_invest: '25000.00',
    open_shift: { id: 7, member_id: 2, opened_at: '2026-10-20T09:30:00Z', cash_start: '0.00' }
  };
  function dayApi(reply) {
    const b = book();
    return q => q.url().includes('/bar/day') ? (typeof reply === 'function' ? reply(q) : reply || json(200, DAY_ROW)) : b(q);
  }
  const dayGets = s => s.calls.filter(c => c.url.includes('/bar/day'));
  async function toDay(s) {
    if (await s.p.$('#tabs [data-go="barQueue"]')) { await s.p.click('#tabs [data-go="barQueue"]'); await s.p.waitForTimeout(250); }
    if (!(await tap(s, '#view [data-go="barDay"]'))) return false;
    await s.p.waitForTimeout(300);
    return true;
  }
  {
    const s = await open(true, true, json(200, SASHA), null, null, null, dayApi()); s.name = 'day';
    if (await toDay(s)) {
      const t = await s.view();
      ['Сегодня, 20 октября', 'Смена открыта с 16:30', '1 780 ฿', '1 570 ฿', '210 ฿', 'выручка вечера', 'наличные · 19:00',
       '25 240 ฿', '−240 ฿', '−25 000 ฿', 'закуп · текущая трата · наличные бара', 'ремонт · вложение · свои', 'Эспрессо']
        .forEach(x => { if (!t.includes(x)) bad.push(`day: нет «${x}»`); });
      ['Средний чек', 'Чеков', '1 840', 'NaN', 'undefined'].forEach(x => { if (t.includes(x)) bad.push(`day: есть лишнее «${x}»`); });
      const g = dayGets(s);
      if (g.length !== 1 || !g[0].url.endsWith('/bar/day?direction_id=7')) bad.push('day: запрос не тот: ' + JSON.stringify(g.map(c => c.url)));
      await s.p.screenshot({ path: `${OUT}/live-day.png`, fullPage: true });
      // повторное открытие — свежий запрос: запись с другого телефона видна
      await tap(s, '#view [data-go="barMoney"]'); await s.p.waitForTimeout(200);
      await tap(s, '#view [data-go="barDay"]'); await s.p.waitForTimeout(300);
      if (dayGets(s).length !== 2) bad.push('day: повторное открытие не перечитало отчёт');
    }
    if (s.errs.length) bad.push('day: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  const dayWith = o => json(200, Object.assign({}, DAY_ROW, o));
  for (const [name, reply, want, hasnt] of [
    ['day-income-sum', dayWith({ income_total: '1600.00' }), 'Суммы отчёта не сходятся', '1 600'],
    ['day-expense-sum', dayWith({ expense_total: '240.00' }), 'Суммы отчёта не сходятся', 'кофемашина'],
    // каждый итог ломается в одиночку: две поломки сразу прикрыли бы проверки друг другом
    ['day-opex', dayWith({ expense_opex: '300.00' }), 'Суммы отчёта не сходятся', 'кофемашина'],
    ['day-invest', dayWith({ expense_invest: '24940.00' }), 'Суммы отчёта не сходятся', 'кофемашина'],
    ['day-cash', dayWith({ cash_total: '500.00' }), 'Суммы отчёта не сходятся', 'Эспрессо'],
    ['day-row', dayWith({ income: [Object.assign({}, DAY_ROW.income[0], { method: 'account' }), DAY_ROW.income[1]] }), 'Ответ сервера не разобран', 'выручка вечера'],
    ['day-noshift', dayWith({ open_shift: null }), 'Смена не открыта', 'Смена открыта с'],
    ['day-403', json(403, { detail: 'деньги направления смотрит куратор' }), 'Отчёт за день видит куратор направления', 'Доход']]) {
    const s = await open(true, true, json(200, SASHA), null, null, null, dayApi(reply)); s.name = name;
    if (await toDay(s)) {
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»: ` + t.slice(0, 160));
      if (t.includes(hasnt)) bad.push(`${name}: показано «${hasnt}»`);
    }
    await s.ctx.close();
  }
  // Сбой обновления не стирает отчёт, а помечает.
  {
    let n = 0;
    const s = await open(true, true, json(200, SASHA), null, null, null, dayApi(() => ++n === 1 ? json(200, DAY_ROW) : json(500, { detail: 'x' }))); s.name = 'day-stale';
    if (await toDay(s) && await tap(s, '[data-action="day-reload"]')) {
      await s.p.waitForTimeout(300);
      const t = await s.view();
      if (!t.includes('Не обновилось') || !t.includes('1 780 ฿')) bad.push('day-stale: сбой обновления стёр отчёт или не назван');
    }
    await s.ctx.close();
  }
  // Бармену — ни входа, ни запроса.
  {
    const s = await open(true, true, json(200, BARMAN), null, null, null, dayApi()); s.name = 'day-barman';
    await toQueue(s);
    if (await s.p.$('#view [data-go="barDay"]')) bad.push('day-barman: бармену предложен отчёт с деньгами');
    if (dayGets(s).length) bad.push('day-barman: отчёт запрошен');
    await s.ctx.close();
  }

  // ── тестовый режим и просмотр чужими глазами ──
  // Сервер (cafe13-api deps.caller): X-Test-Mode: 1 — тестовая база, X-Act-As —
  // чужие глаза, только вместе с тестовым режимом. Заглушка ведёт себя так же:
  // без X-Test-Mode список людей — 403, чужой /me — только с обоими.
  const TEST_SASHA = clone(SASHA); TEST_SASHA.member.tg_user_id = 501; TEST_SASHA.member.first_name = 'Александра';
  const PEOPLE = { base: 'test', people: [
    { tg_user_id: 501, first_name: 'Александра', last_name: '', roles: [{ role: 'curator', direction_id: 7, direction: 'Бар' }] },
    { tg_user_id: 502, first_name: 'Юра', last_name: '', roles: [{ role: 'curator', direction_id: 2, direction: 'Чай' }] }] };
  function testApi(o) {
    o = Object.assign({ health: 'configured', people: () => json(200, PEOPLE), as: { '501': TEST_SASHA } }, o);
    const b = book();
    return q => {
      const u = q.url(), h = q.headers(), t = h['x-test-mode'] === '1', as = h['x-act-as'];
      if (u.endsWith('/health')) return json(200, { status: 'ok', version: '0.1.0', build_sha: 'x', db: 'configured', test_db: o.health });
      if (as && !t) return json(403, { detail: 'смотреть чужими глазами можно только в тестовом режиме' });
      if (u.endsWith('/act-as/people')) return !t ? json(403, { detail: 'список для просмотра чужими глазами есть только в тестовом режиме' })
                                               : as ? json(403, { detail: 'выйдите из просмотра, чтобы выбрать другого' }) : o.people();
      if (u.endsWith('/me') && as) return o.as[as] ? json(200, o.as[as]) : json(404, { detail: 'такого человека в тестовой базе нет' });
      return b(q);
    };
  }
  async function toPanel(s) {
    if (!(await s.p.isVisible('#demo-btn'))) { bad.push(`${s.name}: нет солнышка`); return false; }
    await s.p.click('#demo-btn');
    await s.p.waitForTimeout(250);
    return true;
  }
  const strip = s => s.p.evaluate(() => { const e = document.querySelector('#view .test-strip'); return e ? e.textContent : null; });
  // Тестовая база не выложена — честная надпись, входа нет.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, testApi({ health: 'unset' })); s.name = 'test-unset';
    if (await toPanel(s)) {
      if (!(await s.view()).includes('Тестовая база ещё не выложена') || await s.p.$('[data-action="test-on"]')) bad.push('test-unset: нет надписи «не выложена» или есть вход');
    }
    if (s.calls.some(c => c.test || c.as)) bad.push('test-unset: тестовые заголовки ушли без входа в режим');
    await s.ctx.close();
  }
  // Полный путь: войти → список → глазами Александры → запись → выйти из просмотра → выйти из теста.
  {
    const saved = { code: 'XIII-0001', name: 'Тест', level: 'Член клуба', ends: null, lifelong: true, uid: 1 };
    const s = await open(true, true, json(200, OWNER), null, null, saved, testApi()); s.name = 'test-path';
    let ok = await toPanel(s);
    if (ok && !(await tap(s, '[data-action="test-on"]'))) ok = false;
    if (ok) {
      await s.p.waitForTimeout(300);
      const pc = s.calls.filter(c => c.url.endsWith('/act-as/people'));
      if (pc.length !== 1 || pc[0].test !== '1' || pc[0].as) bad.push('test-path: список запрошен не тем: ' + JSON.stringify(pc.map(c => [c.test, c.as])));
      // после входа сам за себя — на главной, полоса «Вы сами»
      if (!((await strip(s)) || '').includes('Вы сами')) bad.push('test-path: после входа нет полосы «Тестовая база · Вы сами»');
      await s.p.click('#demo-btn'); await s.p.waitForTimeout(200);
      const t = await s.view();
      if (!t.includes('Александра') || !t.includes('Куратор направления · Бар') || !t.includes('Юра') || !t.includes('Куратор направления · Чай'))
        bad.push('test-path: в списке нет людей словами: ' + t.slice(0, 300));
      await s.p.screenshot({ path: `${OUT}/live-test-people.png`, fullPage: true });
      if (await tap(s, '[data-action="test-as:501"]')) {
        await s.p.waitForTimeout(400);
        const me = s.calls.filter(c => c.url.endsWith('/me')).pop();
        if (!me || me.test !== '1' || me.as !== '501') bad.push('test-path: /me Александры запрошен без обоих заголовков');
        const st = (await strip(s)) || '';
        if (!st.includes('Тестовая база') || !st.includes('Смотрите как Александра') || !st.includes('ненастоящие')) bad.push('test-path: полоса не говорит, чьими глазами и что база тестовая: ' + st);
        if (!(await s.p.isVisible('#demo-btn'))) bad.push('test-path: в просмотре пропало солнышко — к панели не вернуться');
        // Саша без членства: путь к записи через «Заказы»; запись идёт с обоими заголовками
        const before = s.calls.length;
        if (await toBook(s, 'test-path') && await fillExpense(s, 'test-path', '240', ALL_PICKS) && await askSend(s, 'test-path')) {
          const w = s.calls.slice(before).filter(c => c.method === 'POST');
          if (w.length !== 1 || w[0].test !== '1' || w[0].as !== '501') bad.push('test-path: запись ушла не в тестовую базу глазами Александры: ' + JSON.stringify(w.map(c => [c.url, c.test, c.as])));
          if (!((await strip(s)) || '').includes('Смотрите как Александра')) bad.push('test-path: на экране записи нет полосы');
          await s.p.screenshot({ path: `${OUT}/live-test-as.png` });
        }
        const after = s.calls.slice(before);
        if (after.some(c => c.test !== '1' || c.as !== '501')) bad.push('test-path: в просмотре ушёл запрос без заголовков: ' + JSON.stringify(after.filter(c => c.test !== '1' || c.as !== '501').map(c => c.url)));
        const kept = JSON.parse(await s.p.evaluate(() => localStorage.getItem('cafe13.pass')) || 'null');
        if (!kept || kept.code !== 'XIII-0001') bad.push('test-path: запас пропуска владельца переписан в тестовом режиме: ' + JSON.stringify(kept));
        if (await tap(s, '#view .test-strip [data-action="test-self"]')) {
          await s.p.waitForTimeout(400);
          const me2 = s.calls.filter(c => c.url.endsWith('/me')).pop();
          if (me2.test !== '1' || me2.as) bad.push('test-path: выход из просмотра не вернул «сам в тестовой базе»');
          if (!((await strip(s)) || '').includes('Вы сами')) bad.push('test-path: после выхода из просмотра полоса не «Вы сами»');
          if (await tap(s, '#view .test-strip [data-action="test-off"]')) {
            await s.p.waitForTimeout(400);
            const n0 = s.calls.length;
            if ((await strip(s)) !== null) bad.push('test-path: после выхода из теста полоса осталась');
            const me3 = s.calls.filter(c => c.url.endsWith('/me')).pop();
            if (me3.test || me3.as) bad.push('test-path: выход из теста перечитал /me с тестовыми заголовками');
            await s.p.click('#tabs [data-go="barQueue"]').catch(() => {}); await s.p.waitForTimeout(300);
            if (s.calls.slice(n0).some(c => c.test || c.as)) bad.push('test-path: после выхода запросы с тестовыми заголовками');
          }
        }
      }
    }
    if (s.errs.length) bad.push('test-path: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Отказы: не бог на сервере (403), база не та, человек не найден.
  for (const [name, o, act, want] of [
    ['test-403', { people: () => json(403, { detail: 'тестовый режим — у главы клуба и наследника' }) }, null, 'Вам просмотр не положен: тестовый режим — у главы клуба и наследника'],
    ['test-base', { people: () => json(200, Object.assign({}, PEOPLE, { base: 'live' })) }, null, 'Ответ сервера не разобран'],
    ['test-404', { as: {} }, '[data-action="test-as:501"]', 'Такого человека в тестовой базе нет']]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, testApi(o)); s.name = name;
    if (await toPanel(s) && await tap(s, '[data-action="test-on"]')) {
      await s.p.waitForTimeout(300);
      await s.p.click('#demo-btn'); await s.p.waitForTimeout(200);
      if (act) { if (await tap(s, act)) await s.p.waitForTimeout(300); }
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»: ` + t.slice(0, 200));
      if (name === 'test-base' && await s.p.$('[data-action^="test-as:"]')) bad.push('test-base: список не из тестовой базы показан');
      if (name === 'test-404' && ((await strip(s)) || '').includes('Смотрите как')) bad.push('test-404: полоса «смотрите как» при отказе');
    }
    await s.ctx.close();
  }
  // Гонка: меню, запрошенное под прежним человеком, вернулось после смены —
  // оно не должно лечь на экран нового.
  {
    const SASHA_MENU = [Object.assign({}, MENU[0], { id: 31, title: 'Матча' })];
    const t0 = testApi();
    const s = await open(true, true, json(200, OWNER), null, null, null, q => {
      if (q.url().includes('/bar/menu'))
        return q.headers()['x-act-as'] === '501' ? json(200, SASHA_MENU)
             : new Promise(res => setTimeout(() => res(json(200, MENU)), 1500));
      return t0(q);
    }); s.name = 'test-race';
    if (await toPanel(s) && await tap(s, '[data-action="test-on"]')) {
      await s.p.waitForTimeout(400);
      await s.p.evaluate(() => go('bar'));                 // меню владельца — в полёте
      await s.p.waitForTimeout(150);
      await s.p.evaluate(() => doAction('test-as:501'));
      await s.p.waitForTimeout(400);
      await s.p.evaluate(() => go('bar'));
      await s.p.waitForTimeout(2000);                      // ответ владельца вернулся
      const m = await s.p.evaluate(() => JSON.stringify(DATA.bar.menu));
      if (!m.includes('Матча') || m.includes('Эспрессо')) bad.push('test-race: меню прежнего человека легло на экран нового: ' + m.slice(0, 120));
    }
    await s.ctx.close();
  }
  // Не бог: никаких тестовых заголовков, даже вызовом действия из консоли.
  {
    const s = await open(true, true, json(200, SASHA), null, null, null, testApi()); s.name = 'test-nogod';
    await s.p.evaluate(() => { doAction('test-on'); doAction('test-as:501'); });
    await s.p.waitForTimeout(300);
    if (s.calls.some(c => c.test || c.as)) bad.push('test-nogod: не бог включил тестовый режим');
    await s.ctx.close();
  }

  // ── вход в очередь по роли, а не по уровню членства ──
  // Бармен без членства и бармен с членством — обе ветки уровня; оба
  // обязаны дойти до очереди за нажатия, без знания адресов.
  for (const [name, member] of [['barman-guest', false], ['barman-member', true]]) {
    const who = clone(OWNER); who.roles = [{ role: 'bar', direction_id: 7 }];
    if (!member) { who.membership_active = false; who.membership = null; }
    const s = await open(true, true, json(200, who), null, null, null, queue());
    let reached = false;
    for (const sel of ['#tabs [data-go="barQueue"]', '#view [data-go="barQueue"]']) {
      if (await s.p.$(sel)) { await s.p.click(sel); await s.p.waitForTimeout(250); reached = true; break; }
    }
    const t = await s.view();
    if (!reached || !t.includes('261018-03')) bad.push(`${name}: бармен не дошёл до очереди`);
    await s.ctx.close();
  }

  // ── афиша на живых данных ──
  // В живом режиме афиша — только с сервера: при любом отказе на экране
  // отказ, а не зашитые «Звуковая практика» и «Чайная церемония». Цена
  // приходит строкой («400.00»), booked_by_me у события, на которое не
  // записался никто, — null, а не false, и своей записью он не становится.
  const pad2 = n => String(n).padStart(2, '0');
  const BKKNOW = new Date(Date.now() + 7 * 3600e3);          // стенные часы острова в полях UTC
  const bkkDay = off => new Date(BKKNOW.getTime() + off * 864e5).toISOString().slice(0, 10);
  const atBkk = (off, h, m) => new Date(Date.parse(bkkDay(off) + 'T' + pad2(h) + ':' + pad2(m || 0) + ':00Z') - 7 * 3600e3).toISOString();
  const EV = over => Object.assign({
    id: 4, title: 'Вечер ханга', starts_at: atBkk(1, 19), duration_min: 90, seats: 12,
    kind: 'paid', price: '400.00', about: 'Живой звук, место у сцены', filmed: false,
    organizer_id: 500, organizer_first_name: 'Образец', organizer_last_name: '',
    taken: 0, seats_left: 12, booked_by_me: null, my_booking_id: null
  }, over);
  const AFISHA = [
    EV({ id: 1, title: 'Утро у воды', starts_at: atBkk(0, 10), duration_min: 60, kind: 'free',
         price: '0.00', about: '', seats: 6, taken: 6, seats_left: 0, booked_by_me: false }),
    EV({ id: 4, taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 }),
    EV({ id: 7, title: 'Уже начался', starts_at: new Date(Date.now() - 3600e3).toISOString(),
         duration_min: 180, kind: 'donation', price: '0.00', seats: 20, taken: 2, seats_left: 18 }),
    // Сервер отдаёт и то, что кончилось: началось 2,5 часа назад, длилось час.
    EV({ id: 8, title: 'Уже закончился', starts_at: new Date(Date.now() - 9000e3).toISOString(),
         duration_min: 60, kind: 'free', price: '0.00', seats: 10, taken: 3, seats_left: 7 })
  ];
  const evReply = reply => q => q.url().endsWith('/events') ? reply : undefined;
  // Порядок афиши — по времени начала; на главной видны два первых. Считаем
  // из самой фикстуры: имена руками зависели бы от часа запуска.
  const SOON = [...AFISHA].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).map(e => e.title);

  {
    const s = await open(true, true, json(200, OWNER), null, null, null, evReply(json(200, AFISHA)));
    const home = await s.view();
    ['Афиша', 'Вся афиша', SOON[0], SOON[1]].forEach(x => {
      if (!home.includes(x)) bad.push(`events-home: нет «${x}»`); });
    if (home.includes(SOON[SOON.length - 1]))
      bad.push(`events-home: на главной больше двух ближайших — есть «${SOON[SOON.length - 1]}»`);
    ['ещё не подключено', 'Звуковая практика', 'Чайная церемония'].forEach(x => {
      if (home.includes(x)) bad.push(`events-home: есть лишнее «${x}»`); });

    await s.p.click('[data-go="events"]');
    await s.p.waitForTimeout(100);
    const t = await s.view();
    ['Сегодня,', 'Завтра,', 'Утро у воды', 'Вечер ханга', 'Уже начался', '400 ฿', 'Бесплатно',
     'Донейшн', 'вы записаны', 'мест нет', 'идёт', 'Образец'].forEach(x => {
      if (!t.includes(x)) bad.push(`events: нет «${x}»`); });
    ['400.00', 'Звуковая практика', 'Утренняя практика', '[мастер]', 'ещё не подключено'].forEach(x => {
      if (t.includes(x)) bad.push(`events: есть лишнее «${x}»`); });
    // Чужая запись и «ничья» (booked_by_me null) своей не становятся.
    const mine = await s.p.evaluate(() => [...document.querySelectorAll('#view .listitem')]
      .filter(e => e.textContent.includes('вы записаны')).length);
    if (mine !== 1) bad.push(`events: строк «вы записаны» ${mine}, ждали 1`);
    // Кончившееся событие идущим не называется: «идёт» верно только до конца.
    const rowOf = t => s.p.evaluate(x => {
      const e = [...document.querySelectorAll('#view .listitem')].find(n => n.textContent.includes(x));
      return e ? e.textContent : '';
    }, t);
    const done = await rowOf('Уже закончился'), live = await rowOf('Уже начался');
    if (!/завершилось/.test(done)) bad.push('events: кончившееся событие не помечено завершённым: «' + done.slice(0, 70) + '»');
    if (/идёт/.test(done)) bad.push('events: кончившееся событие показано идущим: «' + done.slice(0, 70) + '»');
    if (!/идёт/.test(live)) bad.push('events: идущее событие не помечено идущим: «' + live.slice(0, 70) + '»');
    await s.p.screenshot({ path: `${OUT}/live-events.png` });

    // Сегмент дня фильтрует, а не подсвечивается: вечернее из «Утра» уходит.
    await s.p.click('[data-action="seg:утро"]');
    await s.p.waitForTimeout(100);
    const m = await s.view();
    if (!m.includes('Утро у воды') || m.includes('Вечер ханга')) bad.push('events: сегмент «Утро» не отфильтровал');
    await s.p.click('[data-action="seg:все"]');
    await s.p.waitForTimeout(100);

    // Карточка — из той же выдачи, без обещаний демонстрации.
    await s.p.click('[data-event="4"]');
    await s.p.waitForTimeout(100);
    const c = await s.view();
    ['Вечер ханга', 'Вы записаны', '400 ฿', 'Живой звук', 'Съёмки на этом событии нет', 'Образец', '11 из 12']
      .forEach(x => { if (!c.includes(x)) bad.push(`event-card: нет «${x}»`); });
    ['Оплатить', 'Место держится 15 минут', '400.00', 'Запись из приложения пока не включена']
      .forEach(x => { if (c.includes(x)) bad.push(`event-card: есть лишнее «${x}»`); });
    // Главной кнопки Telegram на живой карточке нет: записи ещё нет, а
    // «Оплатить 400 ฿ и записаться» считалось бы по демонстрационному событию.
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('event-card: главная кнопка на карточке без записи');
    await s.p.screenshot({ path: `${OUT}/live-event-card.png` });

    // «Назад» внутри Telegram — системная кнопка, в заглушке её нет: идём вкладками.
    await s.p.click('#tabs [data-go="home"]');
    await s.p.waitForTimeout(100);
    await s.p.click('#view [data-go="events"]');
    await s.p.waitForTimeout(100);
    await s.p.click('[data-event="1"]');
    await s.p.waitForTimeout(100);
    const f = await s.view();
    ['мест нет', 'Запись из приложения пока не включена', 'Бесплатно'].forEach(x => {
      if (!f.includes(x)) bad.push(`event-card-free: нет «${x}»`); });
    ['Вы записаны', 'Записаться'].forEach(x => {
      if (f.includes(x)) bad.push(`event-card-free: есть лишнее «${x}»`); });
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('event-card-free: главная кнопка на карточке без записи');
    // Афиша берётся один раз за запуск, а не на каждом переходе.
    const got = s.calls.filter(x => x.url.endsWith('/events')).length;
    if (got !== 1) bad.push(`events: /events запрошен ${got} раз, ждали 1`);
    if (s.errs.length) bad.push('events: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // Пустая афиша, отказы и битый ответ — каждый своим экраном, и ни в одном
  // не всплывают демонстрационные события.
  for (const [name, reply, has, hasnt] of [
    ['events-empty', json(200, []), ['В афише пока ничего нет'], ['Звуковая практика', 'Загружаем афишу']],
    ['events-500', json(500, { detail: 'x' }),
      ['Афиша не открылась', 'Сервер ответил кодом 500', 'Попробовать снова'], ['Звуковая практика']],
    ['events-down', 'abort', ['Афиша не открылась', 'Сервер не ответил'], ['Звуковая практика']],
    ['events-html', { status: 200, contentType: 'text/html', body: '<html>ok</html>' },
      ['Афиша не открылась', 'Ответ сервера не разобран'], ['Звуковая практика']],
    ['events-broken', json(200, [EV({}), EV({ id: 9, title: 'Битое', seats_left: 'много' })]),
      ['Афиша не открылась', 'Ответ сервера не разобран'], ['Вечер ханга', 'Битое']]]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, evReply(reply));
    // Отказ виден на главной: входа в афишу при нём нет вовсе — поэтому сам
    // экран афиши открываем вызовом, иначе его подмена демонстрацией
    // осталась бы непроверенной.
    const h = await s.view();
    has.forEach(x => { if (!h.includes(x)) bad.push(`${name}: на главной нет «${x}»`); });
    hasnt.forEach(x => { if (h.includes(x)) bad.push(`${name}: на главной есть лишнее «${x}»`); });
    await s.p.evaluate(() => go('events'));
    await s.p.waitForTimeout(100);
    const t = await s.view();
    has.forEach(x => { if (!t.includes(x)) bad.push(`${name}: нет «${x}»`); });
    hasnt.forEach(x => { if (t.includes(x)) bad.push(`${name}: есть лишнее «${x}»`); });
    if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
    await s.p.screenshot({ path: `${OUT}/live-${name}.png` });
    await s.ctx.close();
  }

  // «Попробовать снова»: сервер ожил — афиша появилась, а не осталась отказом.
  {
    let up = false;
    const s = await open(true, true, json(200, OWNER), null, null, null,
      q => q.url().endsWith('/events') ? (up ? json(200, AFISHA) : json(502, {})) : undefined);
    if (!(await s.view()).includes('Афиша не открылась')) bad.push('events-retry: отказ не показан на главной');
    up = true;
    await s.p.click('[data-action="retry-events"]');
    await s.p.waitForTimeout(200);
    // На главной видны два ближайших события, а не все: «Вечер ханга» завтра.
    const back = await s.view();
    [SOON[0], SOON[1], 'Вся афиша'].forEach(x => {
      if (!back.includes(x)) bad.push(`events-retry: после повтора нет «${x}»`); });
    if (back.includes('Афиша не открылась')) bad.push('events-retry: отказ остался после удачного повтора');
    const got = s.calls.filter(x => x.url.endsWith('/events')).length;
    if (got !== 2) bad.push(`events-retry: запросов к /events ${got}, ждали 2`);
    await s.ctx.close();
  }

  // ── время события — в поясе клуба, а не телефона и не UTC ──
  // Браузер нарочно живёт в третьем поясе (Нью-Йорк): тогда краснеют обе
  // подмены — и «считаем по телефону», и «считаем в UTC». Ожидание считается
  // НЕЗАВИСИМО: сдвигом ISO на +07:00 руками, а не тем же Intl, что в коде.
  {
    const iso = '2026-12-05T12:00:00Z';
    const wall = new Date(Date.parse(iso) + 7 * 3600e3);
    const hm = wall.toISOString().slice(11, 16);                       // 19:00 по Бангкоку
    const dows = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const label = `${wall.getUTCDate()} ${months[wall.getUTCMonth()]}, ${dows[wall.getUTCDay()]}`;
    const s = await open(true, true, json(200, OWNER), null, null, null,
      evReply(json(200, [EV({ id: 11, title: 'Далёкое событие', starts_at: iso, duration_min: 90 })])),
      'America/New_York');
    await s.p.evaluate(() => go('events'));
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (!t.includes(hm)) bad.push(`events-tz: нет времени клуба «${hm}», а есть «${t.slice(0, 80)}»`);
    if (!t.includes(label)) bad.push(`events-tz: нет дня клуба «${label}»`);
    if (t.includes('12:00')) bad.push('events-tz: на экране 12:00 — это UTC, а не пояс клуба');
    if (t.includes('07:00')) bad.push('events-tz: на экране 07:00 — это пояс телефона, а не клуба');
    if (s.errs.length) bad.push('events-tz: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-events-tz.png` });
    await s.ctx.close();
  }

  // ── поздний ответ прежнего запроса не затирает свежий ──
  // Второй запрос нарочно медленный, третий уходит, пока он в пути: без
  // охраны по номеру поколения афиша откатилась бы на старые данные.
  {
    let n = 0;
    const s = await open(true, true, json(200, OWNER), null, null, null, q => {
      if (!q.url().endsWith('/events')) return undefined;
      n += 1;
      if (n === 2) return new Promise(r => setTimeout(() =>
        r(json(200, [EV({ id: 21, title: 'Поздний ответ' })])), 1500));
      return json(200, [EV({ id: 20 + n, title: n === 1 ? 'Первый ответ' : 'Свежий ответ' })]);
    });
    await s.p.evaluate(() => loadEvents());
    await s.p.waitForTimeout(100);
    await s.p.evaluate(() => loadEvents());
    await s.p.waitForTimeout(2500);
    const t = await s.view();
    if (!t.includes('Свежий ответ')) bad.push('events-gen: свежего ответа на экране нет: «' + t.slice(0, 80) + '»');
    if (t.includes('Поздний ответ')) bad.push('events-gen: поздний ответ прежнего запроса затёр свежий');
    if (n !== 3) bad.push(`events-gen: запросов к /events ${n}, ждали 3`);
    if (s.errs.length) bad.push('events-gen: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // ── заглушки против настоящих ответов ──
  // tools/api-keys.json — форма ответов из снимков cafe13-api (DUMP_DIR,
  // tools/keys.py): только ключи, без значений. Заглушка, придумавшая поле
  // или потерявшая обязательное, краснеет здесь, а не на проде.
  const REAL = JSON.parse(fs.readFileSync(ROOT + '/tools/api-keys.json', 'utf8'));
  function shapeOf(v) {
    if (Array.isArray(v)) { let o; v.forEach(x => { o = o === undefined ? shapeOf(x) : mergeShape(o, shapeOf(x)); }); return o === undefined ? [] : [o]; }
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { if (v[k] !== undefined) o[k] = shapeOf(v[k]); }); return o; }
    return null;
  }
  function mergeShape(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return !a.length || !b.length ? (a.length ? a : b) : [mergeShape(a[0], b[0])];
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const ka = Object.keys(a).filter(k => k !== '?'), kb = Object.keys(b).filter(k => k !== '?'), o = {};
      new Set([...ka, ...kb]).forEach(k => { o[k] = k in a && k in b ? mergeShape(a[k], b[k]) : (k in a ? a[k] : b[k]); });
      const opt = new Set([...(a['?'] || []), ...(b['?'] || []), ...ka.filter(k => !kb.includes(k)), ...kb.filter(k => !ka.includes(k))]);
      if (opt.size) o['?'] = [...opt].sort();
      return o;
    }
    return a !== null && a !== undefined ? a : b;
  }
  function diffShape(real, stub, path, out) {
    if (Array.isArray(real)) {
      if (!Array.isArray(stub)) { out.push(path + ': в ответе список'); return out; }
      // Пустой список в снимке — форма элемента ни с чем не сверена. Молча
      // пропустить значит потерять проверку при пересъёмке; исключение —
      // только явное, с причиной (UNVERIFIED), и оно печатается.
      if (!real.length && stub.length) {
        if (UNVERIFIED[path]) { USED.add(path); notes.push(path + ': не сверено — ' + UNVERIFIED[path]); }
        else out.push(path + ': в снимке пустой список, форма элемента не сверена');
      }
      if (real.length && stub.length) diffShape(real[0], stub[0], path + '[]', out);
      return out;
    }
    if (real && typeof real === 'object') {
      if (!stub || typeof stub !== 'object' || Array.isArray(stub)) { out.push(path + ': в ответе объект'); return out; }
      const opt = real['?'] || [];
      Object.keys(real).filter(k => k !== '?').forEach(k => {
        if (!(k in stub)) { if (!opt.includes(k)) out.push(path + '.' + k + ': нет в заглушке'); }
        else diffShape(real[k], stub[k], path + '.' + k, out);
      });
      Object.keys(stub).filter(k => k !== '?' && !(k in real)).forEach(k => out.push(path + '.' + k + ': в ответе сервера такого нет'));
    }
    return out;
  }
  const notes = [];
  const UNVERIFIED = {
    'me-member.roles': 'у вымышленного члена в снимках cafe13-api ролей нет; попросить координатора дать ему роль'
  };
  const USED = new Set();
  const STUBS = {
    'me-member': OWNER, 'pass-member': PASS, 'directions-guest': JSON.parse(DIR(true).body),
    'menu-guest': MENU, 'order-create': ORDER, 'orders-guest': [row('new')], 'orders-worker': QUEUE,
    'order-state-worker': { id: 3, number: '261018-03', state: 'making' },
    'till-topup': TILL_ROW, 'bar-expense': EXP_ROW, 'bar-income': INC_ROW, 'bar-day': DAY_ROW,
    'events-afisha': AFISHA
  };
  Object.keys(STUBS).forEach(name => {
    if (!REAL[name]) { bad.push(`shape ${name}: снимка нет в api-keys.json`); return; }
    if (REAL[name].status !== 200 && REAL[name].status !== 201) bad.push(`shape ${name}: снимок — отказ ${REAL[name].status}`);
    diffShape(REAL[name].shape, shapeOf(STUBS[name]), name, []).forEach(x => bad.push('shape ' + x));
  });
  // Исключение не переживает свою причину: список в снимке стал непустым —
  // исключение лишнее, и молча лежать ему нельзя.
  Object.keys(UNVERIFIED).filter(k => !USED.has(k)).forEach(k => bad.push(`shape ${k}: исключение больше не нужно — убрать из UNVERIFIED`));
  // Решения владельца, видимые в самих снимках: работнику денег нет, куратору есть.
  const row0 = n => (REAL[n] && REAL[n].shape[0]) || {};
  if ('sum' in REAL['order-state-worker'].shape || 'ledger_id' in REAL['order-state-worker'].shape) bad.push('shape: работнику в ответе на смену состояния пришли деньги');
  if (!(row0('orders-worker')['?'] || []).includes('sum')) bad.push('shape: у работника sum не помечен необязательным — либо утечка, либо снимок без своего заказа');
  if ((row0('orders-curator')['?'] || []).includes('sum') || !('sum' in row0('orders-curator'))) bad.push('shape: у куратора суммы не в каждой строке');
  if ('share_club' in row0('directions-guest') || !('share_club' in row0('directions-curator'))) bad.push('shape: доли направления видны не тем');

  await b.close();
  if (notes.length) console.log('НЕ СВЕРЕНО:\n  ' + notes.join('\n  '));
  if (bad.length) { console.log('КРАСНОЕ:\n' + bad.join('\n')); process.exit(1); }
  console.log('зелёное: ' + (CASES.length + 120) + ' случаев');
})();
