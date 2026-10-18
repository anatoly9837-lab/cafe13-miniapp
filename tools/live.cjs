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
    ['Пожизненно', '3 170 ฿', 'Глава клуба', 'Администратор', 'god_mentor', 'ещё не подключено'],
    ['Действует до', 'Звуковая практика', '1 250', 'Вы записаны'], 1],
  ['finite', true, true, json(200, finite), ['Действует до 14 ноября 2026'], ['Пожизненно'], 1],
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
  ['outside-telegram', false, true, json(200, OWNER), ['Действует до 14 ноября', '1 250'], ['Пожизненно'], 0],
  ['api-off', true, false, json(200, OWNER), ['Действует до 14 ноября', '1 250'], ['Пожизненно'], 0]
];

// Экраны отказа — списком, а не регуляркой по имени: регулярка молча
// пропускала network-down.
const REFUSAL = new Set(['no-sign-401', 'stranger-403', 'server-500', 'empty-200', 'html-200',
                         'finite-without-end', 'network-down']);
// Опечатка в имени молча выключила бы проверку для случая — ловим здесь.
REFUSAL.forEach(n => { if (!CASES.some(c => c[0] === n)) throw new Error('REFUSAL: нет случая ' + n); });

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const bad = [];
  const src = fs.readFileSync(ROOT + '/app.js', 'utf8');
  if (!src.includes('var API_ON = false;')) bad.push('app.js: выключатель API_ON не найден в выключенном виде');

  async function open(inside, on, me, consentReply, passReply, saved, extra) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
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
      body: on ? src.replace('var API_ON = false;', 'var API_ON = true;') : src }));
    await p.route('https://api.cafe13.club/**', async r => {
      const q = r.request();
      calls.push({ method: q.method(), url: q.url(), init: q.headers()['x-telegram-init-data'], body: q.postData() });
      const x = extra ? extra(q) : undefined;
      if (x instanceof Promise) return r.fulfill(await x);
      const reply = x !== undefined ? x
                  : q.url().endsWith('/me/consent') ? consentReply : q.url().endsWith('/pass') ? passReply : me;
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
    if (s.calls.length !== n) bad.push(`${name}: запросов к API ${s.calls.length}, ждали ${n}`);
    s.calls.forEach(c => { if (c.init !== INIT) bad.push(`${name}: заголовок подписи «${c.init}»`); });
    if (REFUSAL.has(name) && await s.tabsShown())
      bad.push(`${name}: на экране отказа видны вкладки`);
    if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
    await s.p.screenshot({ path: `${OUT}/live-${name}.png` });
    await s.ctx.close();
  }

  // Вкладка, ещё не стоящая на сервере, — «не подключено», а не демонстрационные записи.
  {
    const s = await open(true, true, json(200, OWNER));
    await s.p.click('#tabs [data-go="bookings"]');
    const t = await s.view();
    if (!t.includes('ещё не подключено') || t.includes('Звуковая практика')) bad.push('bookings: показаны демонстрационные записи');
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('bookings: главная кнопка на неподключённом экране');
    await s.p.click('#demo-btn');
    const d = await s.view();
    if (!d.includes('Данные — с сервера клуба') || d.includes('Смотреть как')) bad.push('demo: в живом режиме доступно переключение роли');
    // Кнопок роли в живом режиме нет, но и подсунутая в разметку не должна сработать.
    await s.p.evaluate(() => {
      const x = document.createElement('button'); x.setAttribute('data-role', 'bar'); x.id = 'fake-role';
      document.getElementById('view').appendChild(x);
    });
    await s.p.click('#fake-role');
    if ((await s.p.evaluate(() => document.getElementById('tabs').textContent)).includes('Заказы'))
      bad.push('role: в живом режиме роль переключилась из браузера');
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
    if (s.calls.length !== 2) bad.push(`retry: запросов ${s.calls.length}, ждали 2`);
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
  const ORDER = { id: 5, number: '261018-01', state: 'new', sum: '70.00', created_at: '2026-10-18T12:00:00+00:00',
                  place: 'за стойку', pay_method: 'account' };
  const row = st => Object.assign({}, ORDER, { state: st, member_id: 1, first_name: 'Тест', last_name: '',
                                               items: [{ title: 'Эспрессо', price: '70.00', qty: 1 }] });
  // id 7, а не 1: так видно, что он взят с сервера, а не угадан
  const DIR = (open, extra) => json(200, [{ id: 7, title: 'Бар', share_mode: 'net', share_club: '30.00',
    share_partner: '70.00', is_active: true, is_open: open }].concat(extra || []));
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
  {
    const s = await open(true, true, json(200, OWNER), null, null, null,
      bar({ order: json(409, { detail: 'на счёте 3170, не хватает 1830' }) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(250);
    const t = await s.view();
    ['На счёте не хватает', 'не хватает 1830', 'пополняется в кассе'].forEach(x => { if (!t.includes(x)) bad.push(`topup-409: нет «${x}»`); });
    await s.p.screenshot({ path: `${OUT}/live-topup.png` });
    await s.ctx.close();
  }
  // Кнопка «Не хватает» ведёт туда же без запроса.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar());
    await toBar(s);
    await s.p.click('[data-go="topup"]');
    if (!(await s.view()).includes('пополняется в кассе')) bad.push('topup: кнопка «Не хватает» не ведёт к пополнению');
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

  // Корзина: несколько позиций, место и оплата — как выбрал гость.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar());
    await toBar(s);
    await s.p.click('[data-action="cart-add:11"]');
    await s.p.click('[data-action="cart-add:12"]');
    await s.p.click('[data-go="barCart"]');
    await s.p.click('[data-where="с собой"]');
    await s.p.click('[data-pay="наличными"]');
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.waitForTimeout(250);
    const pp = posts(s);
    const want = { direction_id: 7, place: 'с собой', pay_method: 'cash', items: [{ product_id: 11, qty: 1 }, { product_id: 12, qty: 1 }] };
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

  await b.close();
  if (bad.length) { console.log('КРАСНОЕ:\n' + bad.join('\n')); process.exit(1); }
  console.log('зелёное: ' + (CASES.length + 45) + ' случаев');
})();
