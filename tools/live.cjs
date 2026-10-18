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

  async function open(inside, on, me, consentReply, passReply, saved) {
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
      const reply = q.url().endsWith('/me/consent') ? consentReply : q.url().endsWith('/pass') ? passReply : me;
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
  console.log('зелёное: ' + (CASES.length + 20) + ' случаев');
})();
