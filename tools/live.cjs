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

// inside: true — Telegram с подписью; 'nosign' — Telegram есть, подписи нет; false — браузер
function tgStub(inside) {
  const signed = inside === true;
  return `window.__main = null; window.__link = null;
  window.Telegram = { WebApp: {
    platform: ${inside ? "'ios'" : "'unknown'"}, initData: ${signed ? JSON.stringify(INIT) : "''"},
    initDataUnsafe: ${signed ? '{ user: { id: 1 } }' : '{}'}, colorScheme: 'light', version: '7.0',
    openLink: function (u) { window.__link = u; },
    isVersionAtLeast: function () { return true; },
    ready: function () {}, expand: function () {}, onEvent: function () {},
    HapticFeedback: { notificationOccurred: function () {}, selectionChanged: function () {} },
    // системная «назад» запоминает обработчик и видимость — чтобы её можно было «нажать» (Cafe13KPG#458)
    BackButton: { onClick: function (f) { window.__back = f; }, offClick: function () { window.__back = null; },
                  show: function () { window.__backShown = true; }, hide: function () { window.__backShown = false; } },
    MainButton: { setText: function () {}, show: function () {}, hide: function () {},
                  onClick: function (f) { window.__main = f; }, offClick: function () { window.__main = null; } }
  } };`;
}

const OWNER = {
  member: { tg_user_id: 1, first_name: 'Тест', last_name: '', username: null, photo_url: null,
            pass_code: null, created_at: '2026-10-01T00:00:00+00:00',
            consent_data_at: '2026-10-18T10:00:00+00:00', consent_filming_at: null },
  membership: { level: 'member', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: true },
  // все членства человека (api d0a8c9f, на бою есть; Cafe13KPG#297). Клиент
  // их пока не читает — поле здесь, чтобы заглушка совпадала с боем по форме
  memberships: [{ level: 'member', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: true }],
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
// список членств: поля нет, не список, вид чужой, конечное без конца — всё «не разобран»
const msNone = clone(OWNER); delete msNone.memberships;
const msObj = clone(OWNER); msObj.memberships = msObj.membership;
const msAlien = clone(OWNER); msAlien.memberships = [{ level: 'boss', starts_at: null, ends_at: null, lifelong: true }];
const msLife = clone(OWNER); msLife.memberships[0].lifelong = 'true';   // строка, не булево
const msNoEnd = clone(OWNER); msNoEnd.memberships.push({ level: 'organizer', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: false });

/* [имя, внутри Telegram, API_ON, ответ /me, есть, нет, сколько запросов к API, после] */
const CASES = [
  ['owner-lifelong', true, true, json(200, OWNER),
    ['Пожизненно', '3 170 ฿', 'Глава клуба', 'Администратор', 'Афиша', 'В афише пока ничего нет'],
    ['Действует до', 'Звуковая практика', '1 250', 'Вы записаны', 'god_mentor', 'ещё не подключено'], 2],
  ['finite', true, true, json(200, finite), ['Действует до 14 ноября 2026'], ['Пожизненно'], 2],
  ['no-sign-401', true, true, json(401, { detail: 'подпись не принята' }),
    ['Подпись не принята'], ['Баланс', 'нет в списке'], 1],
  ['stranger-403', true, true, json(403, { detail: 'доступа нет' }),
    // + GET /join: экран просьбы спрашивает сервер сам (Cafe13KPG#459); здесь /join тоже 403
    ['Вас ещё нет в списке'], ['Баланс', 'Подпись не принята', 'Член клуба'], 2],
  ['server-500', true, true, json(500, { detail: 'x' }), ['Сервер ответил кодом 500'], ['Баланс'], 1],
  ['empty-200', true, true, json(200, {}), ['Ответ сервера не разобран'], ['Баланс'], 1],
  ['html-200', true, true, { status: 200, contentType: 'text/html', body: '<html>ok</html>' },
    ['Ответ сервера не разобран'], ['Баланс'], 1],
  ['finite-without-end', true, true, json(200, noEnd), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
  ['memberships-none', true, true, json(200, msNone), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
  ['memberships-object', true, true, json(200, msObj), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
  ['memberships-alien', true, true, json(200, msAlien), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
  ['memberships-lifelong-str', true, true, json(200, msLife), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
  ['memberships-noend', true, true, json(200, msNoEnd), ['Ответ сервера не разобран'], ['Пожизненно', 'Баланс'], 1],
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
// Главная кнопка «Новая карточка» не спрашивает mayCards(): права меняет лишь
// applyMe, перед которым списки сброшены. Довод держится на том, что DATA.grants
// присваивается в одном месте; второе присваивание — и условие надо вернуть
// (предложено designer-55, 22.10.2026). Видит только прямое присваивание:
// DATA['grants'] =, Object.assign(DATA, …) и деструктуризацию — нет.
// (?!=) не даёт посчитать сравнения == и ===: проверено их дописыванием — счёт 1.
const grantsSet = src.match(/DATA\.grants\s*=(?!=)/g) || [];
if (grantsSet.length !== 1) {
  console.error('КРАСНОЕ: app.js: DATA.grants присваивается не в одном месте (' + grantsSet.length + ') — верните mayCards() в mainFor у barCards');
  process.exit(1);
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const bad = [];
  // Исключение посреди батареи не глотает уже найденное: без этого обрыв печатал
  // только стек, и красные строки всех пройденных случаев терялись (Cafe13KPG#415).
  process.on('unhandledRejection', e => {
    console.log('КРАСНОЕ:\n' + bad.concat('БАТАРЕЯ ОБОРВАЛАСЬ исключением: ' + String(e && e.message || e).split('\n')[0]).join('\n'));
    process.exit(1);
  });
  // Счёт прогонов считается, а не вписывается: каждый случай открывает свой
  // экран через open(), поэтому здесь он и растёт. Прежняя строка складывала
  // длину таблицы с числом 180 — императивные случаи (их большинство) в неё
  // не входили, и число не менялось, сколько бы их ни добавляли.
  let ran = 0;

  async function open(inside, on, me, consentReply, passReply, saved, extra, tz, now) {
    ran += 1;
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU',
                                     ...(tz ? { timezoneId: tz } : {}) });
    // Без довода ничего не меняется: часы идут настоящие, как и были.
    if (now) await ctx.clock.setFixedTime(new Date(now));
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

  // ── отказ входа: выхода нет ни одним путём (Cafe13KPG#458) ──
  // Отказ не поднимает LIVE, и приложение оставалось демонстрацией с ролью
  // 'member': «назад» вело в демонстрационный кабинет клуба. Три пути выхода —
  // системная «назад», нарисованная (Telegram старше 6.1) и переход по data-go —
  // проверяются каждый. Пара — тот же путь при 200 и вне Telegram (витрина).
  {
    const tryAll = async (s, n, stay) => {
      const shown = await s.p.evaluate(() => window.__backShown === true);
      if (shown) bad.push(`${n}: на экране отказа показана системная «назад»`);
      await s.p.evaluate(() => window.__back && window.__back());
      await s.p.waitForTimeout(100);
      if (!(await s.view()).includes(stay)) bad.push(`${n}: системная «назад» увела с экрана отказа`);
      // Telegram старше 6.1: системной нет, рисуется своя
      await s.p.evaluate(() => { Telegram.WebApp.isVersionAtLeast = () => false; render(); });
      if (await s.p.isVisible('#back')) bad.push(`${n}: нарисованная «назад» видна на экране отказа`);
      // подсунутый переход изнутри страницы — обработчик, а не попадание мышью
      await s.p.evaluate(() => {
        const x = document.createElement('button'); x.setAttribute('data-go', 'home');
        document.getElementById('view').appendChild(x); x.click();
      });
      await s.p.waitForTimeout(100);
      if (!(await s.view()).includes(stay)) bad.push(`${n}: переход data-go увёл с экрана отказа`);
    };
    for (const [n, me, stay] of [
      ['vyhod-403', json(403, { detail: 'доступа нет' }), 'Вас ещё нет в списке'],
      ['vyhod-401', json(401, { detail: 'подпись не принята' }), 'Подпись не принята'],
      ['vyhod-500', json(500, { detail: 'x' }), 'Сервер клуба недоступен']]) {
      const s = await open(true, true, me);
      if (!(await s.view()).includes(stay)) bad.push(`${n}: ПРОВЕРКА НЕ ВЫПОЛНЕНА — нет экрана отказа «${stay}»`);
      else await tryAll(s, n, stay);
      if (s.errs.length) bad.push(`${n}: ошибки страницы ${s.errs.join('; ')}`);
      await s.ctx.close();
    }
    // пара: вошёл — «назад» с неглавного экрана жива и ведёт домой
    {
      const n = 'vyhod-200';
      const s = await open(true, true, json(200, OWNER));
      await s.p.evaluate(() => go('pass'));
      await s.p.waitForTimeout(150);
      if (!(await s.p.evaluate(() => window.__backShown === true && typeof window.__back === 'function')))
        bad.push(`${n}: после входа на «Пропуске» нет системной «назад»`);
      await s.p.evaluate(() => window.__back && window.__back());
      await s.p.waitForTimeout(150);
      if (!(await s.view()).includes('Пожизненно')) bad.push(`${n}: «назад» после входа не вернула в кабинет`);
      await s.ctx.close();
    }
    // витрина вне Telegram: демонстрация работает как прежде, нарисованная «назад» жива
    {
      const n = 'vyhod-vitrina';
      const s = await open(false, true, json(200, OWNER));
      await s.p.evaluate(() => go('pass'));
      await s.p.waitForTimeout(150);
      if (!(await s.p.isVisible('#back'))) bad.push(`${n}: на витрине у «Пропуска» нет «назад»`);
      else {
        await s.p.click('#back');
        await s.p.waitForTimeout(150);
        if (await s.p.evaluate(() => current) !== 'home') bad.push(`${n}: «назад» на витрине не вернула на главную`);
      }
      if (s.calls.length) bad.push(`${n}: витрина спросила сервер (${s.calls.length})`);
      await s.ctx.close();
    }
  }

  // ── Telegram есть, подписи нет — витрина, а не вход (условие arhitector-47 на v69) ──
  // tryLive() требует подпись; без неё boot() обязан уйти в демонстрацию, не спросив сервер.
  {
    const n = 'tg-bez-podpisi';
    const s = await open('nosign', true, json(401, { detail: 'подпись не принята' }));
    const t = await s.view();
    if (s.calls.length) bad.push(`${n}: без подписи ушло запросов к серверу: ${s.calls.length}`);
    if (t.includes('Подпись не принята') || t.includes('нет в списке')) bad.push(`${n}: без подписи — экран отказа, а не витрина`);
    if (!t.includes('1 250')) bad.push(`${n}: без подписи нет витрины (демонстрационного баланса)`);
    await s.ctx.close();
  }

  // ── просьба о вступлении вместо тупика «нет в списке» (Cafe13KPG#459, кадры E44*) ──
  {
    const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    // имя — роль-словом, ник — короче пяти знаков: такого у живого аккаунта Telegram быть не может
    const JOIN0 = { amount_thb: '3600.00', amount_usd: '130.00', period_months: 1, currency: 'THB',
                    request: null, about_token: 'tok-проверка',
                    you: { first_name: '[просящий]', last_name: '', username: 'ab' } };
    const withReq = (status, note) => Object.assign(clone(JOIN0), { request: {
      id: 7, status, said: '', created_at: '2026-10-28T08:00:00+00:00', decided_at: null,
      decision_note: note || '', status_ru: '' } });
    // ответы /join*: join — функция или ответ; post — ответ на POST /join/request
    const joinCase = async (join, post, me) => {
      const posted = [];
      const s = await open(true, true, me || json(403, { detail: 'доступа нет' }), null, null, null, q => {
        const u = q.url();
        if (/\/join\/requisites\/(promptpay|usdt)$/.test(u)) return { status: 200, contentType: 'image/png', body: PNG1 };
        if (u.endsWith('/join/request') && q.method() === 'POST') { posted.push(JSON.parse(q.postData())); return post || json(201, { id: 7, status: 'pending' }); }
        if (u.endsWith('/join')) return typeof join === 'function' ? join() : join;
        return undefined;
      });
      await s.p.waitForTimeout(200);
      return Object.assign(s, { posted });
    };
    // клик изнутри страницы: запертая или пропавшая кнопка — ничего не делает, а не обрыв по таймауту
    const tap = async (s, sel) => { await s.p.evaluate(q => { const e = document.querySelector(q); if (e) e.click(); }, sel); await s.p.waitForTimeout(200); };
    const pdf = n => ({ name: 'chek.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(n, 0x25) });
    // нет поля чека — строка «не выполнено», а не обрыв по таймауту, прячущий остальное
    const attach = async (s, n, file) => {
      if (!(await s.p.$('#join-file'))) { bad.push(`${n}: ПРОВЕРКА НЕ ВЫПОЛНЕНА — нет поля чека`); return; }
      await s.p.setInputFiles('#join-file', file, { timeout: 60000 });
    };

    // форма (E44, E44b, E44v): имя из подписи, обе цены с сервера, реквизиты по подписи, PDF как есть
    {
      const n = 'join-forma';
      let state = JOIN0;
      const s = await joinCase(() => json(200, state));
      let t = await s.view();
      for (const w of ['Вас ещё нет в списке', 'Вы входите как', '[просящий] · @ab', '3 600 ฿', 'Bangkok Bank', 'Фото или PDF, до 2 МБ'])
        if (!t.includes(w)) bad.push(`${n}: нет «${w}»`);
      if (!(await s.p.$('[data-action="join-send"][disabled]'))) bad.push(`${n}: без чека «Отправить запрос» доступна`);
      if (!(await s.p.$('.qr img'))) bad.push(`${n}: реквизиты PromptPay не показаны картинкой`);
      if (!s.calls.some(c => c.url.endsWith('/join/requisites/promptpay') && c.init === INIT))
        bad.push(`${n}: реквизиты не спрошены с подписью`);
      await tap(s, '[data-action="join-pay:usdt"]');
      t = await s.view();
      for (const w of ['130 USDT', 'сеть TRC20']) if (!t.includes(w)) bad.push(`${n}: USDT — нет «${w}»`);
      if (t.includes('3 600 USDT')) bad.push(`${n}: в USDT показана сумма в батах`);
      await s.p.fill('#join-said', 'хочу на вечера');
      await attach(s, n, pdf(1500));
      await s.p.waitForTimeout(300);
      t = await s.view();
      if (!t.includes('Чек приложен · заменить') || !t.includes('PDF · 1 КБ')) bad.push(`${n}: приложенный PDF не назван (E44b)`);
      if (await s.p.$('[data-action="join-send"][disabled]')) bad.push(`${n}: с чеком «Отправить запрос» недоступна`);
      state = withReq('pending');
      await tap(s, '[data-action="join-send"]');
      const b = s.posted[0];
      // способ выбран USDT выше — до сервера он доезжает словом сервера (pay_method)
      if (!b || b.said !== 'хочу на вечера' || b.pay_method !== 'crypto' || b.receipt_mime !== 'application/pdf' ||
          b.receipt_base64 !== pdf(1500).buffer.toString('base64'))
        bad.push(`${n}: просьба ушла так: ${JSON.stringify(b && { said: b.said, pay: b.pay_method, mime: b.receipt_mime, len: (b.receipt_base64 || '').length })}`);
      t = await s.view();
      if (!t.includes('Просьба отправлена') || !t.includes('ЖДЁТ ОТВЕТА')) bad.push(`${n}: после отправки не экран «ждёт ответа» (E44g)`);
      if (await s.p.$('[data-action="join-send"]')) bad.push(`${n}: у ждущей просьбы есть отправка`);
      if (s.errs.length) bad.push(`${n}: ошибки страницы ${s.errs.join('; ')}`);
      await s.ctx.close();
    }
    // снимок ужимается в клиенте: большой PNG уходит JPEG-ом не больше 2 МиБ
    {
      const n = 'join-szhatie';
      const s = await joinCase(json(200, JOIN0));
      // проба — непрозрачный шум 1400×1400: PNG больше потолка, но не десятки мегабайт
      // (2400×2400 с прозрачностью под нагрузкой не успевал загрузиться в поле за 30 с)
      const big = await s.p.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 1400; c.height = 1400;
        const g = c.getContext('2d'), d = g.createImageData(1400, 1400);
        // xorshift: шум не сжимается, и PNG выходит заведомо больше потолка
        let x = 1;
        for (let i = 0; i < d.data.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d.data[i] = i % 4 === 3 ? 255 : x & 255; }
        g.putImageData(d, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      });
      const buf = Buffer.from(big, 'base64');
      if (buf.length <= 2 * 1024 * 1024) bad.push(`${n}: ПРОВЕРКА НЕ ВЫПОЛНЕНА — снимок-проба ${buf.length} байт, не больше потолка`);
      await attach(s, n, { name: 'chek.png', mimeType: 'image/png', buffer: buf });
      await s.p.waitForTimeout(1500);
      await tap(s, '[data-action="join-send"]');
      const b = s.posted[0];
      const len = b ? Buffer.from(b.receipt_base64, 'base64').length : -1;
      if (!b || b.receipt_mime !== 'image/jpeg' || len > 2 * 1024 * 1024 || len <= 0)
        bad.push(`${n}: снимок ушёл так: ${JSON.stringify(b ? { mime: b.receipt_mime, bytes: len } : null)}; на экране: ${(await s.view()).slice(0, 200)}`);
      // способ по умолчанию — PromptPay, то есть перевод
      if (b && b.pay_method !== 'transfer') bad.push(`${n}: способ PromptPay ушёл как ${JSON.stringify(b.pay_method)}`);
      await s.ctx.close();
    }
    // PDF больше потолка: отказ ДО отправки, словами, отправка заперта
    {
      const n = 'join-bolshoy';
      const s = await joinCase(json(200, JOIN0));
      await attach(s, n, pdf(2 * 1024 * 1024 + 10));
      await s.p.waitForTimeout(400);
      if (!(await s.view()).includes('Чек больше 2 МБ')) bad.push(`${n}: про потолок 2 МБ не сказано до отправки`);
      if (!(await s.p.$('[data-action="join-send"][disabled]'))) bad.push(`${n}: с чеком больше потолка отправка доступна`);
      await s.ctx.close();
    }
    // отказ сервера — его словами, плашкой
    {
      const n = 'join-otkaz';
      const s = await joinCase(json(200, JOIN0), json(413, { detail: 'чек больше 2 МиБ — пришлите снимок поменьше' }));
      await attach(s, n, pdf(800));
      await s.p.waitForTimeout(300);
      await tap(s, '[data-action="join-send"]');
      if (!(await s.view()).includes('Чек больше 2 МиБ — пришлите снимок поменьше.')) bad.push(`${n}: отказ 413 не показан словами сервера`);
      await s.ctx.close();
    }
    // отказано (E44d): слово решившего плашкой и второй заход
    {
      const n = 'join-otkazano';
      const s = await joinCase(json(200, withReq('rejected', 'чек не читается')));
      let t = await s.view();
      for (const w of ['Просьба отклонена', 'ОТКАЗАНО', '«чек не читается»', '[просящий] · @ab'])
        if (!t.includes(w)) bad.push(`${n}: нет «${w}»`);
      if (await s.p.$('[data-action="join-send"]')) bad.push(`${n}: форма показана до «Попросить снова»`);
      await tap(s, '[data-action="join-again"]');
      if (!(await s.p.$('#join-file'))) bad.push(`${n}: «Попросить снова» не открыло форму`);
      await s.ctx.close();
    }
    // приняли (E44e): «Войти в клуб» перечитывает /me тем же путём, что «Попробовать снова»
    {
      const n = 'join-prinyali';
      let me = json(403, { detail: 'доступа нет' });
      const s = await joinCase(json(200, withReq('approved')), null, () => me);
      if (!(await s.view()).includes('Вас приняли в клуб')) bad.push(`${n}: нет «Вас приняли в клуб»`);
      me = json(200, OWNER);
      await tap(s, '[data-action="retry"]');
      await s.p.waitForTimeout(200);
      if (!(await s.view()).includes('Пожизненно')) bad.push(`${n}: «Войти в клуб» не впустило в кабинет`);
      await s.ctx.close();
    }
    // «О клубе» — внутри приложения (v74): рамка по СВЕЖЕМУ токену, «назад» — на экран просьбы
    {
      const n = 'about-vnutri';
      let k = 0;
      const s = await joinCase(() => json(200, Object.assign(clone(JOIN0), { about_token: ++k > 1 ? 'tok-svezhiy' : 'tok-staryy' })));
      await tap(s, '[data-action="join-about"]');
      await s.p.waitForTimeout(200);
      if (await s.p.evaluate(() => window.__link)) bad.push(`${n}: «О клубе» открыло ссылку наружу`);
      if (await s.p.evaluate(() => current) !== 'joinAbout') bad.push(`${n}: «О клубе» не открыло экран тетради`);
      else {
        const src = await s.p.evaluate(() => { const f = document.querySelector('iframe.about'); return f ? f.getAttribute('src') : null; });
        if (src === null) bad.push(`${n}: рамки тетради нет при свежем токене`);
        else if (src !== 'https://api.cafe13.club/join/about?t=tok-svezhiy') bad.push(`${n}: рамка открыта не по свежему токену: ${src}`);
        if (await s.p.evaluate(() => document.getElementById('title').textContent) !== 'О клубе') bad.push(`${n}: в шапке не «О клубе»`);
        // E49b → E49: после загрузки страницы «Открываем тетрадь клуба» уходит, рамка видна
        await s.p.waitForTimeout(300);
        if (!(await s.p.isVisible('iframe.about'))) bad.push(`${n}: рамка не показана после загрузки страницы`);
        if (await s.p.isVisible('.paper .wait')) bad.push(`${n}: «Открываем тетрадь клуба» осталось после загрузки`);
        // системная «назад» — на экран просьбы, не в кабинет
        if (!(await s.p.evaluate(() => window.__backShown === true))) bad.push(`${n}: у тетради нет системной «назад»`);
        await s.p.evaluate(() => window.__back && window.__back());
        await s.p.waitForTimeout(200);
        if (!(await s.view()).includes('Отправить запрос')) bad.push(`${n}: системная «назад» увела не на экран с «Отправить запрос»`);
        // Telegram старше 6.1: нарисованная «назад» ведёт туда же
        await tap(s, '[data-action="join-about"]');
        await s.p.evaluate(() => { Telegram.WebApp.isVersionAtLeast = () => false; render(); });
        if (!(await s.p.isVisible('#back'))) bad.push(`${n}: у тетради нет нарисованной «назад»`);
        else { await s.p.click('#back'); await s.p.waitForTimeout(200);
          if (!(await s.view()).includes('Отправить запрос')) bad.push(`${n}: нарисованная «назад» увела не на экран с «Отправить запрос»`); }
      }
      if (s.errs.length) bad.push(`${n}: ошибки страницы ${s.errs.join('; ')}`);
      await s.ctx.close();
    }
    // отказ GET /join при входе на тетрадь — нашими словами и без рамки (иначе в рамке голый JSON 403)
    {
      const n = 'about-otkaz';
      let k = 0;
      // настоящий отказ /join: 503, когда токен тетради нечем подписать (join.py, _about_token)
      const s = await joinCase(() => ++k > 1 ? json(503, { detail: 'ключ бота не задан' }) : json(200, JOIN0));
      await tap(s, '[data-action="join-about"]');
      await s.p.waitForTimeout(200);
      if (await s.p.$('iframe.about')) bad.push(`${n}: при отказе сервера рамка вставлена`);
      if (!(await s.view()).includes('Ключ бота не задан.')) bad.push(`${n}: отказ сервера не показан его словами`);
      if (!(await s.p.$('[data-action="about-retry"]'))) bad.push(`${n}: нет «Попробовать снова»`);
      if (await s.p.$('.paper')) bad.push(`${n}: при отказе показан лист тетради (E49v: листа нет)`);
      await s.ctx.close();
    }
    // реквизиты не пришли — не тупик: сказано и есть «Повторить», второй заход их показывает
    {
      const n = 'join-rekvizity';
      let up = false;
      const s = await open(true, true, json(403, { detail: 'доступа нет' }), null, null, null, q => {
        const u = q.url();
        if (u.endsWith('/join/requisites/promptpay'))
          return up ? { status: 200, contentType: 'image/png', body: PNG1 } : json(503, { detail: 'реквизиты не собраны' });
        if (u.endsWith('/join')) return json(200, JOIN0);
        return undefined;
      });
      await s.p.waitForTimeout(250);
      const t0 = await s.view();
      for (const w of ['Реквизиты не загрузились', 'суммы нет', 'Платить не по чему, пока их нет.'])
        if (!t0.includes(w)) bad.push(`${n}: нет «${w}» (E44zh)`);
      if (t0.includes('3 600 ฿')) bad.push(`${n}: без реквизитов показана сумма`);
      // и с чеком отправка заперта: платить не по чему
      await attach(s, n, pdf(600));
      await s.p.waitForTimeout(300);
      if (!(await s.p.$('[data-action="join-send"][disabled]'))) bad.push(`${n}: без реквизитов отправка доступна`);
      up = true;
      if (!(await s.p.$('[data-action="join-req-retry"]'))) bad.push(`${n}: нет «Повторить» у реквизитов`);
      else { await tap(s, '[data-action="join-req-retry"]'); if (!(await s.p.$('.qr img'))) bad.push(`${n}: после «Повторить» реквизитов нет`); }
      await s.ctx.close();
    }
    // ответ /join не разобран — так и сказано, и есть повтор; формы без цен нет
    {
      const n = 'join-ne-razobran';
      const s = await joinCase(json(200, { amount_thb: null }));
      const t = await s.view();
      if (!t.includes('Ответ сервера не разобран.')) bad.push(`${n}: неразобранный /join не назван`);
      if (await s.p.$('#join-file')) bad.push(`${n}: форма без цен показана`);
      if (!(await s.p.$('[data-action="join-retry"]'))) bad.push(`${n}: нет «Попробовать снова»`);
      await s.ctx.close();
    }
  }

  // ── вкладки — по ВСЕМ живым членствам (Cafe13KPG#410, шаг 1a) ──
  // Сервер отдаёт роль одной строкой (ORDER BY ends_at DESC LIMIT 1), и при
  // равных сроках она произвольна. Различающая пара — один и тот же список
  // членств при двух разных «выигравших» строках: вкладки обязаны совпасть.
  {
    const lv = (level, ends) => ({ level, starts_at: '2026-10-01T00:00:00+00:00', ends_at: ends, lifelong: false });
    const END = '2027-11-01T00:00:00+07:00';
    const who = (row, levels, roles) => {
      const m = clone(OWNER);
      m.membership = row ? lv(row, END) : null; m.membership_active = !!row;
      m.memberships = levels.map(l => lv(l, END)); m.roles = roles || [];
      return m;
    };
    // ⚠ ЧУЖОЙ случай (frontend-11, Cafe13KPG#410), ожидание правит frontend-upravlenie по решению
    // координатора 28.10.2026. Прежняя редакция — семь вкладок, без 'manage': до v72 вкладки
    // «Управление» не было. С v72 глава клуба (роли OWNER) получает восьмую, последней
    // (Cafe13KPG#413, кадр E46). Что она появляется только у главы и только последней, держат
    // `manage-tab` и мутация «вкладка без права», а не это ожидание.
    const ALL = ['staff', 'barQueue', 'home', 'guest', 'organizer', 'partner', 'bookings', 'manage'];
    for (const [name, me, want] of [
      ['tabs-dva-member-vyigral', who('member', ['member', 'partner']), ['home', 'guest', 'partner', 'bookings']],
      ['tabs-dva-partner-vyigral', who('partner', ['member', 'partner']), ['home', 'guest', 'partner', 'bookings']],
      ['tabs-master-partner', who('organizer', ['organizer', 'partner']), ['home', 'guest', 'organizer', 'partner', 'bookings']],
      ['tabs-tolko-member', who('member', ['member']), ['home', 'guest', 'bookings']],
      ['tabs-gost', who(null, []), ['guest', 'bookings']],
      // было `tabs-vse-sem` («все семь»): до v72 вкладок было семь. Имя без числа нарочно —
      // число в имени проверки стареет на следующей вкладке (решение координатора 28.10.2026)
      ['tabs-vse', who('partner', ['member', 'organizer', 'partner'], OWNER.roles), ALL]]) {
      const s = await open(true, true, json(200, me));
      const got = await s.p.$$eval('#tabs [data-go]', b => b.map(x => x.getAttribute('data-go')));
      if (JSON.stringify(got) !== JSON.stringify(want))
        bad.push(`${name}: вкладки ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`);
      // все вкладки в 390 px (до v72 — семь, с v72 у главы клуба восемь): ни одна не вылезла за край и не съела соседнюю
      const over = await s.p.evaluate(() => {
        const t = document.getElementById('tabs'), w = document.documentElement.clientWidth;
        return [...t.querySelectorAll('button')].filter(b => {
          const r = b.getBoundingClientRect(), g = document.createRange();
          g.selectNodeContents(b);
          const c = g.getBoundingClientRect();
          return r.right > w + 0.5 || c.width > r.width + 0.5;
        }).map(b => b.textContent);
      });
      if (over.length) bad.push(`${name}: вкладки не влезли в ширину: ${JSON.stringify(over)}`);
      // перенос подписи ширину не превышает — его видно только по числу строк текста
      // (значок svg в счёт не идёт: берутся одни текстовые узлы)
      const wrapped = await s.p.evaluate(() =>
        [...document.querySelectorAll('#tabs button')].filter(b => {
          // все текстовые узлы на любой глубине: подпись сидит в <span>, а не прямо в кнопке
          const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), tops = new Set();
          for (let n = tw.nextNode(); n; n = tw.nextNode()) {
            if (!n.textContent.trim()) continue;
            const g = document.createRange(); g.selectNodeContents(n);
            [...g.getClientRects()].forEach(x => tops.add(Math.round(x.top)));
          }
          return tops.size > 1;
        }).map(b => b.textContent));
      if (wrapped.length) bad.push(`${name}: подпись вкладки переносится на вторую строку: ${JSON.stringify(wrapped)}`);
      if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
      if (name === 'tabs-vse') await s.p.screenshot({ path: `${OUT}/live-${name}.png` });
      // что партнёр увидит за вкладкой: partner вне WIRED, сервера за ним нет (Cafe13KPG#99) —
      // снимок для решения владельца, а не проверка
      // без вкладки снимать нечего: строка о составе уже стоит выше, а клик в пустоту оборвал бы батарею
      if (name === 'tabs-dva-member-vyigral' && await s.p.$('#tabs [data-go="partner"]')) {
        await s.p.click('#tabs [data-go="partner"]');
        await s.p.waitForTimeout(150);
        await s.p.screenshot({ path: `${OUT}/live-tabs-partner.png` });
      }
      await s.ctx.close();
    }
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

  // Палитра и шрифты, принятые владельцем 21.10 (Cafe13KPG#110). Признак —
  // ВЫЧИСЛЕННЫЙ стиль подложенных частей экрана, а не текст styles.css, и
  // контраст рабочих пар, посчитанный по WCAG на этих же значениях. Темы
  // Telegram в подделке нет, поэтому видна именно фирменная палитра.
  {
    const s = await open(true, true, json(200, OWNER));
    const ACCEPTED = {
      light: { paper: '#F2F2EE', card: '#FFFFFF', ink: '#15171A', muted: '#5A5F63', accent: '#8A5F1E', accentInk: '#FFFFFF', sage: '#2F6B57', clay: '#8E3324' },
      dark:  { paper: '#121416', card: '#1C1F22', ink: '#ECEAE4', muted: '#B8B6AE', accent: '#EBC37A', accentInk: '#15171A', sage: '#7FC0A4' }
    };
    for (const mode of ['light', 'dark']) {
      const m = await s.p.evaluate(mode => {
        document.documentElement.setAttribute('data-theme', mode);
        const v = document.getElementById('view');
        const box = document.createElement('div'); box.id = 'probe';
        box.innerHTML = '<div class="card"><h1>Т</h1><h2>Т</h2><span class="small">Т</span><b class="big">1</b>' +
          '<span class="pill on">Т</span><span class="pill warm">Т</span><span class="pill gold">Т</span></div>' +
          '<button class="btn">Т</button>';
        v.appendChild(box);
        const hex = c => { const n = c.match(/\d+/g).slice(0, 3).map(Number); return '#' + n.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase(); };
        const cs = sel => getComputedStyle(box.querySelector(sel));
        const font = sel => cs(sel).fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const r = {
          paper: hex(getComputedStyle(document.body).backgroundColor), bodyInk: hex(getComputedStyle(document.body).color),
          card: hex(cs('.card').backgroundColor), muted: hex(cs('.small').color),
          accent: hex(cs('.btn').backgroundColor), accentInk: hex(cs('.btn').color),
          sage: hex(cs('.pill.on').backgroundColor), sageInk: hex(cs('.pill.on').color),
          clay: hex(cs('.pill.warm').color), gold: hex(cs('.pill.gold').color),
          fBody: font('.small'), fBtn: font('.btn'), fH1: font('h1'), fH2: font('h2'), fBig: font('.big'),
          fTitle: getComputedStyle(document.getElementById('title')).fontFamily.split(',')[0].replace(/["']/g, '').trim()
        };
        box.remove();
        return r;
      }, mode);
      const want = ACCEPTED[mode];
      for (const k of Object.keys(want)) if (m[k] !== undefined && m[k] !== want[k]) bad.push(`palette ${mode}: ${k} = ${m[k]}, принято ${want[k]}`);
      if (m.bodyInk !== want.ink) bad.push(`palette ${mode}: текст = ${m.bodyInk}, принято ${want.ink}`);
      for (const [k, f] of [['fBody', 'Golos Text'], ['fBtn', 'Golos Text'], ['fBig', 'Golos Text'], ['fH1', 'Prata'], ['fH2', 'Prata'], ['fTitle', 'Prata']])
        if (m[k] !== f) bad.push(`palette ${mode}: шрифт ${k} = ${m[k]}, принят ${f}`);
      // WCAG 2.1: рабочие пары обязаны давать не меньше 4.5
      const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      for (const [name, fg, bg] of [['текст/фон', m.bodyInk, m.paper], ['текст/карточка', m.bodyInk, m.card], ['подпись/фон', m.muted, m.paper],
                                    ['подпись/карточка', m.muted, m.card], ['кнопка', m.accentInk, m.accent], ['лист', m.sageInk, m.sage],
                                    ['глина/карточка', m.clay, m.card], ['латунь-текст/карточка', m.gold, m.card]]) {
        const r = ratio(fg, bg);
        if (r < 4.5) bad.push(`palette ${mode}: контраст ${name} ${fg} на ${bg} = ${r.toFixed(2)}, нужно ≥ 4.5`);
      }
    }
    if (s.errs.length) bad.push('palette: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // Вкладка, ещё не стоящая на сервере, — «не подключено», а не демонстрационные записи.
  {
    const s = await open(true, true, json(200, OWNER));
    await s.p.click('#tabs [data-go="bookings"]');
    const t = await s.view();
    /* Это и есть дозор по Cafe13KPG#259, и проверяет он ОДНО утверждение:
       «либо экран вне реестра, либо он не кормится из DATA». Своей живой
       ветки у экрана НЕТ вовсе — `DATA.upcoming` и `DATA.past` читаются
       безусловно, — поэтому единственное, что держит выдумку подальше от
       живого человека, это отсутствие `bookings` в `WIRED`. Снимается оно
       одной правкой в чужой строке; мутация `bookings-v-wired` её и делает,
       и случай обязан покраснеть. Отказы названы порознь: «не сказано „ещё
       не подключено“» и «показана выдуманная запись» — разные беды, и
       склеенные в один вердикт они заставляют читателя гадать. */
    /* ⚠ ЭТО ИСПРАВЛЕНИЕ ПРОВЕРКИ, А НЕ ПОДГОНКА ПОД ПРАВКУ. Прежняя редакция
       требовала «ещё не подключено» и кнопку отмены НА ЭТОМ экране. Писалась
       она против мёртвой кнопки «Отменить запись» (без `data-action`), которая
       висела в демонстрационной ветке; премисса исчезла — кнопку убрали, и
       сегодня условие требовало бы ВТОРОГО пути к отмене, то есть закрепляло
       дефект вместо его поимки (Cafe13KPG#360, условие координатора).
       Что изменено в ожидании: экран ВКЛЮЧЁН в реестр и имеет живую ветку,
       поэтому утверждения теперь про включённый экран. Фикстура `open` отдаёт
       на `/events` пустой список, значит здесь судится ПУСТОЕ состояние. */
    ['Вы никуда не записаны', 'Записывают на экране мероприятия', 'Вся афиша',
     'Прошедших записей приложение не показывает'].forEach(x => {
      if (!t.includes(x)) bad.push(`bookings: на живом экране записей нет «${x}» (кадр E40b, Cafe13KPG#360)`); });
    if (!(await s.p.$('#view [data-go="events"]')))
      bad.push('bookings: на пустом экране нет кнопки в афишу — адрес тут давать нельзя, вкладки у ролей разные (Cafe13KPG#360)');
    if (t.includes('ещё не подключено'))
      bad.push('bookings: экран записей показывает «ещё не подключено» — он выпал из WIRED или потерял живую ветку (Cafe13KPG#360)');
    ['Звуковая практика', 'Чайная церемония', 'Утренняя практика', 'Разговорный круг'].forEach(x => {
      if (t.includes(x)) bad.push(`bookings: показана демонстрационная строка «${x}» — живой человек прочитает чужую выдумку как свою историю (Cafe13KPG#259)`); });
    // Второго пути к отмене здесь быть НЕ должно: отмена живёт в карточке
    // мероприятия, и два места расходились бы молча. Положительный контроль
    // того же признака — в случае `bookings-svoi` ниже: пустой селектор сам
    // по себе не доказывает отсутствия, он так же пуст при переименованном
    // действии (условие координатора, Cafe13KPG#360).
    if (await s.p.$('#view [data-action^="book-cancel"]'))
      bad.push('bookings: на экране записей второй путь к отмене — отмена живёт в карточке мероприятия (Cafe13KPG#360)');
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
    // приветственный экран не обещает удаления себя: на сервере его нет (слово владельца 28.10)
    {
      const rows = await s.p.evaluate(() => [...document.querySelectorAll('#view .rows')].map(e => e.textContent).join(' '));
      if (/удал/i.test(rows)) bad.push('consent: строки согласия обещают удаление себя, а на сервере его нет');
      if (!rows.includes('Посмотреть о себе')) bad.push('consent: нет строки «Посмотреть о себе»');
    }
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
    // Фикстура несёт `photo_url: null` — значит здесь кружок обязан быть буквой.
    // Без этой строки «фото никогда не рисуется» было бы зелено и тогда, когда
    // клиент рисует его всегда.
    if (await s.p.evaluate(() => document.querySelectorAll('.pass .avatar.photo').length))
      bad.push('pass: фото при пустом photo_url');
    await s.ctx.close();
  }

  /* ── аватарка Telegram на пропуске (кадры E50, E50b) ──
     Решение владельца 28.10.2026 («по аватарке делаем»), три условия: фото
     только при сети, адрес НЕ кладётся в память телефона, без сети — буква.
     Второе условие проверяется не видом кружка, а СОСТАВОМ записи в
     `cafe13.pass`: экран с правильным кружком и экран, заодно сохранивший
     адрес, выглядят одинаково. Адрес в фикстуре — нули, как номера в базе
     кадров: ничьё фото, и живого адреса в публичный репозиторий не уезжает. */
  const PHOTO = 'https://t.me/i/userpic/320/obrazec.jpg';
  {
    const s = await open(true, true, json(200, OWNER), null,
                         json(200, Object.assign({}, PASS, { photo_url: PHOTO })));
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    /* Что мерим: признак `photo` на кружке, адрес в своём свойстве, и —
       главное — что ПРАВИЛО КАДРА действительно применилось: фон у
       псевдоэлемента `::after`, а не у самого кружка (фоном кружка буква
       проступила бы на лице; это первая редакция кадра, отвергнутая
       отрисовкой). Картинку в docker не загрузить — сети нет, Telegram CDN
       не ответит, — поэтому мерится РАЗМЕТКА и ПРАВИЛО, а не пиксели лица. */
    const face = await s.p.evaluate(() => {
      const el = document.querySelector('.pass .avatar');
      if (!el) return null;
      const c = getComputedStyle(el), a = getComputedStyle(el, '::after');
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: el.className, letter: el.textContent,
               prop: el.style.getPropertyValue('--photo'),
               after: a.backgroundImage, afterSize: a.backgroundSize,
               own: c.backgroundImage, pos: c.position, style: c.borderTopStyle,
               radius: c.borderRadius, w: Math.round(r.width), h: Math.round(r.height),
               imgs: document.querySelectorAll('.pass img').length };
    });
    if (!face) bad.push('pass-photo: кружка нет вовсе');
    else {
      if (!/(^| )photo( |$)/.test(face.cls)) bad.push('pass-photo: кружок без признака фото: ' + face.cls);
      if (face.prop.indexOf(PHOTO) === -1) bad.push('pass-photo: адрес не в свойстве кружка: ' + face.prop);
      if (face.after.indexOf(PHOTO) === -1) bad.push('pass-photo: правило кадра не применилось, фона у ::after нет: ' + face.after);
      if (face.afterSize !== 'cover') bad.push('pass-photo: фото не обрезается, а тянется: ' + face.afterSize);
      if (face.own !== 'none') bad.push('pass-photo: фон у САМОГО кружка — буква проступит на лице: ' + face.own);
      if (face.letter !== 'Т') bad.push('pass-photo: буквы под фото нет, терять её незачем: ' + face.letter);
      if (face.pos !== 'relative') bad.push('pass-photo: кружок не держит псевдоэлемент: ' + face.pos);
      if (face.style !== 'solid') bad.push('pass-photo: обводка фото пунктиром (заполнитель): ' + face.style);
      if (!/50%/.test(face.radius)) bad.push('pass-photo: кружок не круглый: ' + face.radius);
      if (face.w !== 54 || face.h !== 54) bad.push(`pass-photo: коробка ${face.w}x${face.h}, в кадре 54x54`);
      if (face.imgs) bad.push('pass-photo: фото вставлено тегом — при неудаче в кружке значок битого изображения');
    }
    const kept = await s.p.evaluate(() => localStorage.getItem('cafe13.pass'));
    if (!kept) bad.push('pass-photo: пропуск не сохранён — условие проверять не на чем');
    else {
      if (kept.indexOf('obrazec') !== -1 || /photo/i.test(kept))
        bad.push('pass-photo: адрес фото уехал в память телефона: ' + kept);
      if (JSON.parse(kept).code !== 'XIII-0042') bad.push('pass-photo: сохранён не тот код: ' + kept);
    }
    if (!(await s.view()).includes('XIII · 0042')) bad.push('pass-photo: код не показан рядом с фото');
    await s.p.screenshot({ path: `${OUT}/live-pass-photo.png` });
    if (s.errs.length) bad.push('pass-photo: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Негодный адрес — буква, а не `src`, которому клиент поверил. `http://`
  // здесь главный: картинка по нему пошла бы открытой сетью с устройства.
  /* ⚠ Три последних — про набор знаков, и ВЫЛАЗКА из них одна: `закрыть url`.
     Замер мой, отрисовкой: двойная кавычка выходит из `url("…")` и чужое
     правило применяется (вычисленный цвет `rgb(255,0,0)`), а апостроф и
     пробел — нет (`url("x.jpg';…")` и `%20`). Стоят они здесь потому, что
     запрет в клиенте шире измеренного нарочно, и случай сторожит ЗАПРЕТ, а
     не мою догадку об опасности каждого знака.
     ⚠ И адрес-образец БЕЗ длинного ряда цифр: первая редакция несла на
     месте номера десять нулей (сам ряд здесь не привожу — страж читает и
     эту строку), и страж номеров людей (`tools/ids-clean.cjs`)
     покраснел — верно покраснел. Он ищет СВОЙСТВО, «7 и больше цифр в одной
     лексеме», а нули от настоящего Telegram-номера по этому свойству не
     отличаются. Лечение — снять свойство, а не внести исключение в
     разрешающий список: у адреса-образца форма свободна (его никто не
     загружает), а каждое исключение в списке — дыра на будущее. */
  for (const [name, photo] of [['http', 'http://t.me/i/userpic/320/obrazec.jpg'],
                               ['пусто', ''], ['число', 7], ['null', null],
                               ['нет поля', undefined],
                               ['закрыть url', 'https://t.me/0.jpg");color:red;x:url("y'],
                               ['кавычка', "https://t.me/0'.jpg"],
                               ['пробел', 'https://t.me/0 .jpg']]) {
    const d = Object.assign({}, PASS);
    if (photo === undefined) delete d.photo_url; else d.photo_url = photo;
    const s = await open(true, true, json(200, OWNER), null, json(200, d));
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    const кружок = await s.p.evaluate(() => {
      const el = document.querySelector('.pass .avatar');
      if (!el) return null;
      return { cls: el.className, letter: el.textContent, html: el.outerHTML,
               after: getComputedStyle(el, '::after').backgroundImage };
    });
    if (!кружок) bad.push(`pass-photo-bad(${name}): кружка нет вовсе`);
    else {
      if (/(^| )photo( |$)/.test(кружок.cls)) bad.push(`pass-photo-bad(${name}): клиент поверил адресу: ` + кружок.html);
      if (кружок.after !== 'none') bad.push(`pass-photo-bad(${name}): фон у ::after есть: ` + кружок.after);
      if (кружок.letter !== 'Т') bad.push(`pass-photo-bad(${name}): в кружке не буква имени: ` + кружок.letter);
      if (/color *: *red/.test(кружок.html)) bad.push(`pass-photo-bad(${name}): чужое правило попало в разметку: ` + кружок.html);
    }
    if (!(await s.view()).includes('XIII · 0042')) bad.push(`pass-photo-bad(${name}): код не показан`);
    await s.ctx.close();
  }
  /* ⚠ ПРЕДЕЛ запрета «адрес не кладётся в память» — и случай, который его
     называет. Запрет закрывает ХРАНИЛИЩЕ, а внутри ОДНОГО запуска адрес в
     памяти приложения есть, и если карточку рисовать из него, а не из довода,
     то экран сбоя покажет фото там, где сети уже нет. Путь: вход удался, фото
     приехало, сервер умер, человек выходит из просмотра — `switchTo` уводит на
     экран сбоя с сохранённым пропуском. Без этого случая довод у `passCard`
     неотличим от чтения переменной изнутри. */
  {
    let мёртв = false;
    const s = await open(true, true, json(200, OWNER), null, null, null, q => {
      if (q.url().endsWith('/pass')) return json(200, Object.assign({}, PASS, { photo_url: PHOTO }));
      if (q.url().endsWith('/events')) return json(200, []);
      // Остальное отдаётся как в обычном случае: `undefined` — это «решай сам».
      // Умирает только `/me`, потому что на нём и стоит путь к экрану сбоя.
      if (q.url().endsWith('/me')) return мёртв ? 'abort' : json(200, OWNER);
      return undefined;
    });
    await s.p.click('[data-go="pass"]');
    await s.p.waitForTimeout(200);
    if (!(await s.p.evaluate(() => document.querySelectorAll('.pass .avatar.photo').length)))
      bad.push('pass-photo-offline: фото не приехало — предел проверять не на чем');
    мёртв = true;
    await s.p.evaluate(() => switchTo(false, null));
    await s.p.waitForTimeout(250);
    const t = await s.view();
    if (!t.includes('Сервер клуба недоступен')) bad.push('pass-photo-offline: не экран сбоя: ' + t.slice(0, 80));
    if (!t.includes('Пропуск, сохранённый на телефоне')) bad.push('pass-photo-offline: сохранённый пропуск не показан');
    if (await s.p.evaluate(() => document.querySelectorAll('.pass .avatar.photo').length))
      bad.push('pass-photo-offline: фото на экране сбоя — без сети оно не загрузится, а кружок обещает человека');
    await s.p.screenshot({ path: `${OUT}/live-pass-photo-offline.png`, fullPage: true });
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
    if (!(await s.view()).includes('Вас ещё нет в списке')) bad.push('pass-403-list: не экран «нет в списке»');
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
    const gone = clone(OWNER); gone.membership_active = false; gone.membership = null; gone.memberships = []; gone.member.pass_code = 'XIII-0042';
    const s = await open(true, true, json(200, gone), null, null, SAVED);
    if (await s.p.evaluate(() => localStorage.getItem('cafe13.pass'))) bad.push('me-inactive: запас не стёрт при неактивном членстве');
    await s.ctx.close();
  }
  // Сумма на экране — это ДЕНЬГИ, а не любые цифры: дата срока законна.
  // Признак: цифра в квадратных скобках, у ฿/$/руб или после «цена/стоимость/взнос».
  // Область — ТОЛЬКО экран членства: цены меню бара приходят с сервера и
  // законны, признак их поймал бы, поэтому на другие экраны он не наводится.
  const MONEY = /\[\s*\d[\d\s]*\]|\d[\d\s\u00a0.,]*\s*(?:฿|\$|руб)|(?:цена|стоимост|взнос)\D{0,15}\d/i;
  for (const [t, want] of [['[100] $', true], ['взнос от 13 000 ฿ в месяц', true], ['Цена: 500', true],
                           ['Действует до 24 апреля 2027 г.', false], ['Член клуба', false]])
    if (MONEY.test(t) !== want) bad.push(`самопроверка денег: «${t}» ${want ? 'не пойман' : 'пойман зря'}`);
  // Экран членства в живом режиме ВЫКЛЮЧЕН до Cafe13KPG#301: показывает
  // «ещё не подключено», ни одной суммы. Уровень на нём — из списка
  // оплаченных членств (рисуем напрямую: одиночное `membership` говорит
  // «член клуба», список — мастер и партнёр).
  {
    const two = clone(OWNER);
    two.memberships = [{ level: 'organizer', starts_at: '2026-10-01T00:00:00+00:00', ends_at: '2027-04-24T05:00:00+00:00', lifelong: false },
                       { level: 'partner', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: true }];
    const s = await open(true, true, json(200, two), null, null, null);
    await s.p.evaluate(() => go('membership'));
    const t = await s.view();
    if (!t.includes('ещё не подключено')) bad.push('membership-off: экран членства включён в живом режиме до решения #301');
    const m = t.match(MONEY);
    if (m) bad.push(`membership-off: на экране членства сумма «${m[0]}»`);
    // сам экран (тот же, что в демо и каталоге): ни сумм, ни кнопок без действия.
    // Ветка демонстрации — явно: у живой ветки цены с сервера (Cafe13KPG#415),
    // её держат случаи mreq-*.
    const [mine, drawn, dead, phone] = await s.p.evaluate(() => {
      const d = document.createElement('div');
      LIVE = false; try { d.innerHTML = SCREENS.membership(); } finally { LIVE = true; }
      return [[...d.querySelectorAll('.card')].filter(c => c.querySelector('h2'))
        .map(c => c.querySelector('h2').textContent + (c.querySelector('.pill.on') ? ':мой' : '')),
        d.textContent, [...d.querySelectorAll('button')].filter(x => !x.dataset.action && !x.dataset.go).length,
        !!d.querySelector('[data-action="phone"]')];
    });
    // якорь присутствия: «сумм нет» говорится только о тексте нужного экрана
    if (!drawn.includes('Член клуба') || !drawn.includes('Бизнес-партнёр'))
      bad.push('membership-demo: ПРОВЕРКА НЕ ВЫПОЛНЕНА — экран членства не отрисован, «сумм нет» сказать не о чем');
    const dm = drawn.match(MONEY);
    if (dm) bad.push(`membership-demo: экран членства называет сумму «${dm[0]}»`);
    if (dead) bad.push(`membership-demo: кнопок без действия на экране членства: ${dead}`);
    // телефон не собираем (Cafe13KPG#312): ни кнопки, ни обещания про него
    if (phone || /телефон/i.test(drawn)) bad.push('membership-phone: на экране членства просят телефон — контакт ушёл бы боту, хранить его негде');
    const want = ['Член клуба', 'Мастер:мой', 'Бизнес-партнёр:мой'];
    if (JSON.stringify(mine) !== JSON.stringify(want)) bad.push('membership-mine: уровни не из списка членств: ' + JSON.stringify(mine));
    if (mine.some(x => x.startsWith('Организатор'))) bad.push('membership-mine: вид назван «Организатор», а не «Мастер»');
    await s.ctx.close();
  }
  // Услуг у клуба нет (решение владельца, Cafe13KPG#102, со слов координатора): гость в живом режиме
  // видит бар и не видит обещания «Услуги острова — ещё не подключено».
  {
    const guest = clone(OWNER); guest.membership_active = false; guest.membership = null; guest.memberships = [];
    const s = await open(true, true, json(200, guest), null, null, null);
    const t = await s.view();
    if (!t.includes('Бар Café XIII')) bad.push('guest-services: ПРОВЕРКА НЕ ВЫПОЛНЕНА — гость не на своём экране');
    else if (t.includes('Услуги острова')) bad.push('guest-services: гостю обещан раздел «Услуги острова», которого у клуба нет');
    await s.ctx.close();
  }
  // И в демо услуг нет вовсе — свойство, а не имена: оба списка пусты.
  // Именной признак вторым: ловит возврат тех выдумок, что уже были.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null);
    const d = await s.p.evaluate(() => ({ a: Array.isArray(DATA.services) && Array.isArray(DATA.myServices),
      n: (DATA.services || []).length + (DATA.myServices || []).length,
      t: JSON.stringify([DATA.services, DATA.myServices]) }));
    if (!d.a) bad.push('demo-services: ПРОВЕРКА НЕ ВЫПОЛНЕНА — списков услуг в DATA нет');
    else if (d.n) bad.push(`demo-services: в демо услуги, которых у клуба нет: ${d.t}`);
    await s.ctx.close();
    const src = fs.readFileSync(`${ROOT}/app.js`, 'utf8');
    const m = src.match(/байк|массаж|Доставка воды|Помощь на дороге/i);
    if (m) bad.push(`demo-services: в клиенте выдуманная услуга «${m[0]}»`);
  }
  // Демо кассы не советует отменить строку: кнопки отмены в приложении нет
  // (Cafe13KPG#340). Мёртвые кнопки демо судит knopki-bez-dela.
  {
    const s = await open(true, false, json(200, OWNER), null, null, null);
    const t = await s.p.evaluate(() => { const w = document.createElement('div'); w.innerHTML = SCREENS.staff(); return w.textContent; });
    if (!t.includes('Внесено за смену')) bad.push('demo-staff: ПРОВЕРКА НЕ ВЫПОЛНЕНА — демонстрация кассы не отрисована, судить текст не о чем');
    else {
      if (/только отменить/.test(t)) bad.push('demo-staff: демонстрация советует отменить строку — в демо отмены нет (Cafe13KPG#340)');
      // Отмену принесла v50 («День кассы»): «пока не сделана» пережило свою правду (Cafe13KPG#373).
      if (/пока не сделана/.test(t)) bad.push('demo-staff: демонстрация говорит, что отмены в приложении нет, — её принесла v50 (Cafe13KPG#373)');
      // Положительная половина: без неё запрет зелёный и тогда, когда строки не стало вовсе.
      if (!t.includes('Запись остаётся видимой: книга клуба дописывается, а не правится.'))
        bad.push('demo-staff: у отменённой строки нет «Запись остаётся видимой: книга клуба дописывается, а не правится.» (кадр E36)');
    }
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
    items: [{ product_id: 11, title: 'Эспрессо', price: '70.00', qty: 1 }] }); delete r.ledger_id; return r; };
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
    ['261018-01', 'Эспрессо', 'новый', 'номер заказа', 'Назовите его бармену', 'Со счёта · уже списано', '70 ฿'].forEach(x => { if (!o.includes(x)) bad.push(`buy: на экране заказа нет «${x}»`); });
    if ((await s.p.$eval('#order-number', e => e.textContent).catch(() => null)) !== '261018-01') bad.push('buy: номер заказа не выделен крупно');
    if (s.calls.filter(c => c.url.endsWith('/me')).length !== 2) bad.push('buy: баланс не перезапрошен после заказа');
    if (!s.calls.some(c => c.method === 'GET' && c.url.includes('/bar/orders'))) bad.push('buy: состояние заказа не запрошено');
    await s.p.screenshot({ path: `${OUT}/live-bar-order.png` });
    if (s.errs.length) bad.push('bar: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // Поздний ответ опроса прежнего захода не откатывает состояние заказа
  // (гард поколения в pollMine). Первый опрос медленный — заказ ещё «новый»,
  // уход в меню и возврат дают второй, быстрый — «готов». Задержка — от запроса.
  {
    let n = 0, landed = false;
    const slow = () => new Promise(r => setTimeout(() => { landed = true; r(json(200, [row('new')])); }, 1500));
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ list: () => ++n === 1 ? slow() : json(200, [row('ready')]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(250);
    await s.p.evaluate(() => { go('bar'); go('barOrder'); });
    await s.p.waitForTimeout(300);
    const gets = s.calls.filter(c => c.method === 'GET' && c.url.includes('/bar/orders')).length;
    if (gets !== 2) bad.push(`order-late: возврат не перечитал заказ (запросов ${gets})`);
    if (landed) bad.push('order-late: прежний ответ пришёл раньше второго запроса — гонки не было, случай гарда не проверяет');
    await s.p.waitForTimeout(1600);
    const st = await s.p.evaluate(() => DATA.bar.mine && DATA.bar.mine.state);
    if (st !== 'ready') bad.push(`order-late: состояние заказа откатилось — «${st}» поверх «ready»`);
    else if (!(await s.view()).includes('готов')) bad.push('order-late: на экране заказа нет «готов»');
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

  // Не хватает на счёте (сервер решает) — плашка в корзине словами сервера
  // (макет E23б) и кнопка пополнения из неё. Член без права кассы видит,
  // куда идти; админ — форму внести себе.
  const NOTILL = clone(OWNER); NOTILL.roles = [];
  for (const [who, name, want] of [[NOTILL, 'topup-409', 'пополняется у хостес'], [OWNER, 'topup-409-admin', null]]) {
    const s = await open(true, true, json(200, who), null, null, null,
      bar({ order: json(409, { detail: 'на счёте 3170, не хватает 1830' }) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(250);
    if ((await s.p.$eval('.deny', e => e.textContent).catch(() => '')) !== 'на счёте 3170, не хватает 1830') bad.push(`${name}: нет плашки с текстом сервера`);
    if (!(await s.p.$('[data-go="topup"]'))) bad.push(`${name}: из плашки нехватки некуда идти`);
    else { await s.p.click('[data-go="topup"]'); await s.p.waitForTimeout(150); }
    const t = await s.view();
    (want ? [want] : []).forEach(x => { if (!t.includes(x)) bad.push(`${name}: нет «${x}»`); });
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
    if (!(await s.view()).includes('позиция снята с меню: Эспрессо')) bad.push('order-409: причина не показана');
    if (s.calls.filter(c => c.url.includes('/bar/menu')).length !== 2) bad.push('order-409: меню не перезапрошено');
    await s.ctx.close();
  }

  // Пять отказов POST /bar/orders (cafe13-api bar.py): у четырёх один код
  // 409, поэтому признак — ТЕКСТ плашки, равный тексту сервера, а не код.
  // Каждый случай: корзина из двух позиций «к столу», отказ — плашка над
  // «Купить», состав и место на месте, нажатие снова возможно.
  for (const [name, status, detail] of [
    ['deny-closed', 409, 'бар закрыт: смена не открыта, заказ принять некому'],
    ['deny-noitems', 400, 'нет таких позиций в этом меню: [12]'],
    ['deny-hidden', 409, 'позиция снята с меню: Флэт-уайт'],
    ['deny-cash', 409, 'на баре платят со счёта в клубе; пополнить можно у хостес'],
    ['deny-short', 409, 'на счёте 240, не хватает 60']]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, bar({ order: json(status, { detail }) }));
    await toBar(s);
    await s.p.click('[data-action="cart-add:11"]');
    await s.p.click('[data-action="cart-add:12"]');
    await s.p.click('[data-go="barCart"]');
    await s.p.waitForTimeout(150);
    if (await s.p.$('[data-pay]')) bad.push(`${name}: в корзине выбор оплаты, а наличные сервер не принимает`);
    await s.p.click('[data-where="к столу"]');
    // «Купить» в Telegram — главная кнопка; своя в разметке на этот случай спрятана
    if (!(await s.p.evaluate(() => typeof window.__main === 'function'))) { bad.push(`${name}: у корзины нет главной кнопки`); await s.ctx.close(); continue; }
    await s.p.evaluate(() => window.__main());
    await s.p.waitForTimeout(300);
    const pp = posts(s);
    if (pp.length !== 1 || JSON.parse(pp[0].body).pay_method !== 'account') bad.push(`${name}: ушло не одно тело со счёта: ` + JSON.stringify(pp.map(c => c.body)));
    const deny = await s.p.$eval('.deny', e => e.textContent).catch(() => null);
    if (deny !== detail) bad.push(`${name}: плашка «${deny}», сервер сказал «${detail}»`);
    // «Пополнить счёт» — выход только при нехватке; при других отказах деньги не причина
    const topup = !!(await s.p.$('.deny + [data-go="topup"]'));
    if (topup !== (name === 'deny-short')) bad.push(`${name}: кнопка «Пополнить счёт» ${topup ? 'есть' : 'нет'}, ждали ${name === 'deny-short' ? 'есть' : 'нет'}`);
    const t = await s.view();
    if (!t.includes('Эспрессо') || !t.includes('Флэт-уайт')) bad.push(`${name}: корзина потеряна после отказа`);
    if (!(await s.p.$('[data-where="к столу"][aria-pressed="true"]'))) bad.push(`${name}: выбор места потерян после отказа`);
    if (!(await s.p.evaluate(() => typeof window.__main === 'function'))) bad.push(`${name}: «Купить» не доступна после отказа`);
    // плашка стоит НАД итогом и кнопкой: в разметке раньше них
    const above = await s.p.evaluate(() => { const d = document.querySelector('.deny'), m = document.querySelector('.sum');
      return !!d && !!m && !!(d.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING); });
    if (!above) bad.push(`${name}: плашка не над кнопкой «Купить»`);
    if (name === 'deny-short') await s.p.screenshot({ path: `${OUT}/live-cart-denied.png`, fullPage: true });
    // правка состава снимает плашку: отказ относился к прежнему
    // щелчок с проверкой: потерянная корзина — уже красное выше, а не таймаут здесь
    if (await s.p.$('[data-action="cart-less:12"]')) {
      await s.p.click('[data-action="cart-less:12"]');
      if (await s.p.$('.deny')) bad.push(`${name}: плашка осталась после правки корзины`);
    }
    await s.ctx.close();
  }
  // Номер заказа — из ответа сервера, а не свой: ответ несёт другой номер.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null,
      bar({ order: json(201, Object.assign({}, ORDER, { number: '261021-05' })), list: json(200, [Object.assign(row('new'), { number: '261021-05' })]) }));
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(300);
    if ((await s.p.$eval('#order-number', e => e.textContent).catch(() => null)) !== '261021-05') bad.push('order-number: номер не из ответа сервера');
    await s.p.screenshot({ path: `${OUT}/live-order-accepted.png`, fullPage: true });
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
    items: [{ product_id: 11, title: 'Эспрессо', qty: 2 }] }, extra);
  const QUEUE = [worker(3, '261018-03', 'new', { photo_url: 'https://t.me/i/userpic/320/x.jpg' }),
                 worker(2, '261018-02', 'making'), worker(1, '261018-01', 'served')];
  const BARMAN = clone(OWNER); BARMAN.roles = [{ role: 'bar', direction_id: 7 }];
  function queue(o) {
    o = Object.assign({ list: json(200, QUEUE), state: q => json(200, { id: 3, number: '261018-03', state: JSON.parse(q.postData()).state }) }, o);
    const b = bar({ list: o.list });
    return q => (q.method() === 'POST' && /\/bar\/orders\/\d+\/state$/.test(q.url())) ? (typeof o.state === 'function' ? o.state(q) : o.state) : b(q);
  }
  const statePosts = s => s.calls.filter(c => /\/state$/.test(c.url));

  // Поздний ответ прежнего захода не ложится на свежую очередь (Cafe13KPG#214):
  // гард у ответа /bar/orders и гард у колбэка loadBar — каждый своим случаем.
  // Первый ответ медленный (задержка — от запроса), уход и возврат дают второй.
  for (const [name, step, stale, look, why] of [
    ['queue-late', 'list', json(200, [worker(9, '261018-09', 'new', { first_name: 'qzx-очередь-qzx' })]), 'qzx',
      'на экране очереди заказы прежнего захода'],
    ['queue-late-bar', 'dirs', json(503, {}), '503',
      'на экране очереди отказ прежнего захода поверх свежей очереди'],
  ]) {
    let n = 0, landed = false;
    const slow = () => new Promise(r => setTimeout(() => { landed = true; r(stale); }, 1500));
    const fresh = step === 'list' ? json(200, QUEUE) : DIR(true);
    const o = { list: json(200, QUEUE), [step]: () => ++n === 1 ? slow() : fresh };
    const s = await open(true, true, json(200, BARMAN), null, null, null, bar(o));
    await toQueue(s);
    await s.p.evaluate(() => { go('home'); go('barQueue'); });
    await s.p.waitForTimeout(300);
    if (n < 2) bad.push(`${name}: возврат не перечитал (запросов ${n})`);
    if (landed) bad.push(`${name}: прежний ответ пришёл раньше второго запроса — гонки не было, случай гарда не проверяет`);
    await s.p.waitForTimeout(1600);
    const t = await s.view();
    if (t.includes(look)) bad.push(`${name}: ${why}`);
    else if (!t.includes('261018-03')) bad.push(`${name}: свежей очереди на экране нет: ` + t.slice(0, 160));
    await s.ctx.close();
  }

  // Cafe13KPG#221: поздний отказ /directions прежнего опроса очереди не стирает
  // загруженное направление — иначе опрос своего заказа умирает молча
  // (pollMine выходит на !BAR до перевооружения таймера). Путь — работник бара
  // заказывает сам: второй заход в очередь уходит с медленным /directions,
  // человек идёт в меню и покупает; отказ приходит уже на экран заказа.
  {
    let dn = 0, ordered = false, landedAfterOrder = null, polls = 0;
    const slow = () => new Promise(r => setTimeout(() => { landedAfterOrder = ordered; r(json(503, {})); }, 2500));
    const s = await open(true, true, json(200, BARMAN), null, null, null, bar({
      dirs: () => ++dn === 2 ? slow() : DIR(true),
      order: () => { ordered = true; return json(201, ORDER); },
      list: () => { if (!ordered) return json(200, [row('new')]); polls++; return json(200, [row(polls === 1 ? 'new' : 'ready')]); } }));
    await toQueue(s);
    await s.p.evaluate(() => { go('home'); go('barQueue'); });
    await s.p.waitForTimeout(100);
    await toBar(s);
    await s.p.click('[data-action="buy:11"]');
    await s.p.waitForTimeout(3000);
    if (landedAfterOrder !== true) bad.push(`bar-stale: поздний отказ пришёл не после заказа (${landedAfterOrder}) — случай дефекта не воспроизводит`);
    await s.p.waitForTimeout(7500);
    const st = await s.p.evaluate(() => DATA.bar.mine && DATA.bar.mine.state);
    if (st !== 'ready') bad.push(`bar-stale: у заказа «${st}», хотя сервер уже отдаёт «ready» — опрос заказа умер после позднего отказа (опросов ${polls})`);
    await s.ctx.close();
  }
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
    if (!(await s.view()).includes('смена не открыта — заказ не отправлен')) bad.push('bar-closed: отказ без причины');
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
    if (!t.includes('бар закрыт: смена не открыта, заказ принять некому')) bad.push('order-409-closed: причина сервера не показана');
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
    // В запасе адреса фото нет и не бывает — значит кружок здесь всегда буква.
    if (show && await s.p.evaluate(() => document.querySelectorAll('.pass .avatar.photo').length))
      bad.push(`${name}: в сохранённом пропуске фото`);
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
  // Cafe13KPG#221, порядок ответов loadBar. Перечитывание после «Открыть смену»
  // медленное и успешное; за ним — более новые вызовы.
  //  shift-stale-ok: новее — отказ при заходе в очередь (loadQueue возвращает
  //    прежний BAR); перечитанная смена всё равно должна лечь.
  //  shift-stale-empty: новее — успех и затем отказ меню (BAR пуст); поздний
  //    успех перечитывания обязан заполнить BAR, иначе колбэк смены читает BAR.open у null.
  for (const [name, fail, why] of [
    ['shift-stale-ok', [3], 'перечитанная смена потеряна — на экране не «Смена открыта»'],
    ['shift-stale-empty', [4], 'поздний успех не заполнил пустой BAR'],
  ]) {
    let order = [];
    const slowOk = () => new Promise(r => setTimeout(() => { order.push(2); r(DIR(true)); }, 2000));
    const s = await open(true, true, json(200, OWNER), null, null, null, shift({
      dirs: n => n === 2 ? slowOk() : fail.includes(n) ? (order.push(n), json(503, {})) : (n > 2 ? (order.push(n), undefined) : undefined) }));
    await toQueue(s);
    await s.p.click('[data-action="shift-open"]');
    await s.p.waitForTimeout(150);
    await s.p.evaluate(() => { go('home'); go('barQueue'); });
    await s.p.waitForTimeout(300);
    if (name === 'shift-stale-empty') { await toBar(s); await s.p.waitForTimeout(300); }
    await s.p.waitForTimeout(2000);
    const last = Math.max(...fail);
    if (order.indexOf(2) < order.indexOf(last) || order.indexOf(last) === -1)
      bad.push(`${name}: медленный успех пришёл не последним (${JSON.stringify(order)}) — случай порядка не проверяет`);
    if (s.errs.length) bad.push(`${name}: ${why}: ошибки страницы ` + s.errs.join('; '));
    else if (name === 'shift-stale-ok' && !(await s.view()).includes('Гости могут заказывать')) bad.push(`${name}: ${why}`);
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

  // ── касса: человек по коду пропуска (Cafe13KPG#102, кадры E34) ──
  // Формы ответов — cafe13-api app/routers/till.py на боевом fa2cebc, по коду:
  // by-pass отдаёт member_id, имя, членство (queries.ACTIVE_MEMBERSHIP_SQL) и
  // остаток; POST /till — строку книги, у членства с ключом membership.
  // member_id — это tg_user_id: номер из общей выдуманной фикстуры, и он
  // не должен оказаться ни в разметке, ни в хранилище страницы.
  const PID = 200000003;
  const PERSON = { member_id: PID, first_name: 'Пробный', last_name: 'Гость', membership: null,
                   membership_active: false, balance: 0 };
  const ENDS = '2027-04-24T05:00:00+00:00';
  function cash(o) {
    o = Object.assign({ find: () => json(200, PERSON), after: null, refind: null,
      post: q => { const x = JSON.parse(q.postData());
        const row = { id: 95, at: '2026-10-24T10:00:00+00:00', kind: x.kind, amount: Number(x.amount).toFixed(2), method: x.method,
                      member_id: x.member_id, note: '' };
        if (x.kind === 'membership') row.membership = { id: 7, level: x.level, starts_at: '2026-10-24T10:00:00+00:00', ends_at: ENDS };
        return json(201, row); } }, o);
    const st = { posted: false };
    return r => {
      const u = r.url();
      if (r.method() === 'GET' && u.includes('/till/by-pass/')) {
        if (!st.posted) return o.find(r);
        if (o.refind) return o.refind(r);
        return json(200, Object.assign({}, PERSON, o.after || {}));
      }
      if (r.method() === 'POST' && u.endsWith('/till')) {
        st.posted = true;
        return o.post === 'abort' ? 'abort' : o.post(r);
      }
      return undefined;
    };
  }
  const finds = s => s.calls.filter(c => c.method === 'GET' && c.url.includes('/till/by-pass/'));
  // Номер человека — ни в разметке (с атрибутами), ни в хранилище.
  const leak = s => s.p.evaluate(id => {
    let st = ''; try { st = JSON.stringify(Object.assign({}, localStorage, sessionStorage)); } catch (e) {}
    return document.documentElement.outerHTML.includes(id) || st.includes(id);
  }, String(PID));
  async function toPerson(s, name, code) {
    if (!(await s.p.$('#tabs [data-go="staff"]'))) { bad.push(`${name}: у кассира нет вкладки «Касса»`); return false; }
    await s.p.click('#tabs [data-go="staff"]');
    await s.p.waitForTimeout(100);
    if (!(await s.p.$('#tp-code'))) { bad.push(`${name}: на кассе нет поля кода`); return false; }
    if ((await s.view()).includes('Внесено за смену')) bad.push(`${name}: на живой кассе демонстрационный блок смены`);
    await s.p.fill('#tp-code', code || '0042');
    await s.p.click('[data-action="tp-find"]');
    await s.p.waitForTimeout(300);
    return true;
  }
  async function toForm(s, name, kind) {
    if (!(await s.p.$(`[data-action="tp-open:${kind}"]`))) { bad.push(`${name}: на карточке нет «${kind}»`); return false; }
    await s.p.click(`[data-action="tp-open:${kind}"]`);
    await s.p.waitForTimeout(100);
    const want = kind === 'membership' ? ['tillMembership', 'Членство'] : ['tillTopup', 'На счёт'];
    if (await at(s) !== want[0]) bad.push(`${name}: форма «${kind}» не на экране ${want[0]}`);
    if (!(await s.p.evaluate(t => document.getElementById('title').textContent === t, want[1])))
      bad.push(`${name}: в шапке формы нет «${want[1]}»`);
    return !!(await s.p.$('#tp-amount')) || (bad.push(`${name}: нет формы приёма`), false);
  }
  const at = s => s.p.evaluate(() => current);

  // ── касса: день и отмена строки (Cafe13KPG#340, кадры E36/E36b/E36v) ──
  // Формы — cafe13-api app/routers/till.py на боевом fa2cebc, по коду (снимка
  // ручек /till/day и /till/{id}/cancel в api-keys.json нет): день — строки
  // суток без затрат, total_live и count_live; отмена — новая строка с
  // cancels_id. by_staff_id — tg_user_id: выдуманные номера, и в разметку
  // они попасть не должны.
  const STAFF = clone(OWNER); STAFF.roles = [{ role: 'staff', direction_id: null }];
  const OTHER = 200000007, GUEST = 200000009;
  const DROW = (o) => Object.assign({ id: 10, at: '2026-10-25T02:40:00+00:00', kind: 'membership', amount: '3000.00', method: 'card',
    member_id: PID, note: null, cancels_id: null, by_staff_id: 1, cancelled_by: null }, o);
  const DAY_ROWS = [
    DROW({}),
    DROW({ id: 11, at: '2026-10-25T05:05:00+00:00', kind: 'topup', amount: '500.00', method: 'cash', by_staff_id: OTHER }),
    DROW({ id: 12, at: '2026-10-25T07:20:00+00:00', kind: 'event', amount: '400.00', method: 'cash', cancelled_by: 13 }),
    DROW({ id: 13, at: '2026-10-25T07:21:00+00:00', kind: 'event', amount: '400.00', method: 'cash', cancels_id: 12, note: 'отмена строки 12' }),
    DROW({ id: 14, at: '2026-10-25T11:02:00+00:00', kind: 'service', amount: '250.00', method: 'account', member_id: GUEST, by_staff_id: GUEST, note: 'заказ бара 41' })
  ];
  const DAY_OK = { day_start: '2026-10-24T17:00:00+00:00', day_end: '2026-10-25T17:00:00+00:00', rows: DAY_ROWS, total_live: '3750.00', count_live: 3 };
  function tday(o) {
    o = Object.assign({ day: () => json(200, DAY_OK), again: null,
      cancel: (id) => json(201, DROW({ id: 15, at: '2026-10-25T12:00:00+00:00', cancels_id: id, note: 'отмена строки ' + id })) }, o);
    const st = { cancelled: false };
    return r => {
      const u = r.url();
      if (r.method() === 'GET' && u.endsWith('/till/day')) return st.cancelled && o.again ? o.again(r) : o.day(r);
      const m = /\/till\/(\d+)\/cancel$/.exec(u);
      if (r.method() === 'POST' && m) { st.cancelled = true; return o.cancel === 'abort' ? 'abort' : o.cancel(Number(m[1])); }
      return undefined;
    };
  }
  const days = s => s.calls.filter(c => c.method === 'GET' && c.url.endsWith('/till/day'));
  const cancels = s => s.calls.filter(c => c.method === 'POST' && /\/till\/\d+\/cancel$/.test(c.url));
  async function toTillDay(s, name) {
    if (!(await s.p.$('#tabs [data-go="staff"]'))) { bad.push(`${name}: у кассира нет вкладки «Касса»`); return false; }
    await s.p.click('#tabs [data-go="staff"]');
    await s.p.waitForTimeout(100);
    if (!(await s.p.$('[data-go="tillDay"]'))) { bad.push(`${name}: на кассе нет входа «День кассы»`); return false; }
    await s.p.click('[data-go="tillDay"]');
    await s.p.waitForTimeout(250);
    if (await at(s) !== 'tillDay') { bad.push(`${name}: день кассы не на своём экране`); return false; }
    return true;
  }
  // Строки дня: подпись, время и способ, сумма и пометка «тихо/отменено».
  // Текст по текстовым узлам через пробел: textContent склеил бы «Членство09:40».
  const TXT = 'el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), o = []; ' +
              'while (w.nextNode()) { const t = w.currentNode.textContent.replace(/\\s+/g, " ").trim(); if (t) o.push(t); } return o.join(" "); }';
  const dayRows = s => s.p.evaluate(T => { const txt = eval(T); return [...document.querySelectorAll('#view .group .card')].map(c =>
    txt(c) + (c.classList.contains('cancelled') ? ' [отменено]' : c.classList.contains('quiet') ? ' [тихо]' : '')); }, TXT);
  // «Отменить» у строки 0 → обязан встать вопрос; нет его — сказать словами, а не упасть на клике.
  async function askFirst(s, name) {
    await s.p.click('[data-action="td-ask:0"]');
    if (await s.p.$('[data-action="td-cancel:0"]') && await s.p.$('[data-action="td-keep"]')) return true;
    bad.push(`${name}: после «Отменить» нет вопроса «Точно отменить / Не отменять»`);
    return false;
  }
  const asks = s => s.p.evaluate(() => [...document.querySelectorAll('[data-action^="td-ask:"]')].map(b => Number(b.dataset.action.split(':')[1])));

  // День кассы (E36): у каждой живой строки «Отменить» — и у чужой: у строки
  // с хозяином сервер назовёт путь исправления (designer-55); отменённая и её
  // отмена видны без кнопки, итог — числом сервера, по способам — из строк.
  {
    const s = await open(true, true, json(200, STAFF), null, null, null, tday({}));
    if (await toTillDay(s, 'till-day')) {
      const t = await s.view();
      if (!(await s.p.evaluate(() => document.getElementById('title').textContent === 'День кассы'))) bad.push('till-day: в шапке нет «День кассы»');
      if (await s.p.evaluate(() => backTo()) !== 'staff') bad.push('till-day: «назад» ведёт не к кассе');
      for (const w of ['Через книгу за день', '3 750 ฿', 'Живых строк', 'Строки за сегодня', 'книга клуба дописывается'])
        if (!t.includes(w)) bad.push(`till-day: нет «${w}»`);
      // итог по способам: ящик — это строка «наличными», а не итог книги
      const tot = await s.p.evaluate(T => { const txt = eval(T); return [...document.querySelectorAll('#view .rows > div')].map(txt); }, TXT);
      const wantTot = ['Через книгу за день 3 750 ฿', 'наличными 500 картой 3 000 со счёта 250', 'Живых строк 3'];
      if (JSON.stringify(tot) !== JSON.stringify(wantTot)) bad.push(`till-day: итоги ${JSON.stringify(tot)}, ждали ${JSON.stringify(wantTot)}`);
      for (const w of ['Внесено за день', 'принял другой'])
        if (t.includes(w)) bad.push(`till-day: лишнее «${w}» (designer-55: подпись врёт / кнопку не прятать)`);
      const rows = await dayRows(s);
      const want = ['Членство 09:40 · карта 3 000 ฿ Отменить', 'На счёт 12:05 · наличные 500 ฿ Отменить',
        'За запись 14:20 · наличные Отменено [отменено]', 'Отмена · За запись 14:21 · наличные −400 ฿ [тихо]',
        'За услугу 18:02 · со счёта заказ бара 41 250 ฿ Отменить'];
      if (JSON.stringify(rows) !== JSON.stringify(want)) bad.push(`till-day: строки ${JSON.stringify(rows)}, ждали ${JSON.stringify(want)}`);
      // заметка — слово сервера, тушью (.verbatim), а не служебной строкой
      const vb = await s.p.evaluate(() => [...document.querySelectorAll('#view .verbatim')].map(e => e.textContent));
      if (JSON.stringify(vb) !== '["заказ бара 41"]') bad.push(`till-day: заметка строки ${JSON.stringify(vb)}, ждали дословно ["заказ бара 41"] классом verbatim`);
      if (JSON.stringify(await asks(s)) !== '[0,1,4]') bad.push(`till-day: «Отменить» у строк ${JSON.stringify(await asks(s))}, ждали у каждой живой [0,1,4]`);
      const html = await s.p.evaluate(() => document.documentElement.outerHTML);
      [OTHER, GUEST, PID].forEach(id => { if (html.includes(String(id))) bad.push(`till-day: номер человека ${id} попал в разметку`); });
      if (days(s).length !== 1) bad.push(`till-day: день спрошен ${days(s).length} раз, ждали 1`);
    }
    await s.ctx.close();
  }
  // Отмена: спрос → «Не отменять» ничего не шлёт → «Точно отменить» → POST → день перечитан.
  {
    const after = clone(DAY_OK);
    after.rows[0].cancelled_by = 15;
    after.rows.push(DROW({ id: 15, at: '2026-10-25T12:00:00+00:00', cancels_id: 10, note: 'отмена строки 10' }));
    after.total_live = '750.00'; after.count_live = 2;
    const s = await open(true, true, json(200, STAFF), null, null, null, tday({ again: () => json(200, after) }));
    if (await toTillDay(s, 'till-cancel')) {
      if (await askFirst(s, 'till-cancel')) {
        await s.p.click('[data-action="td-keep"]');
        if (cancels(s).length) bad.push('till-cancel: «Не отменять» отправило отмену');
        if (await s.p.$('[data-action="td-cancel:0"]')) bad.push('till-cancel: «Не отменять» не убрало вопрос');
        await s.p.click('[data-action="td-ask:0"]');
        await s.p.click('[data-action="td-cancel:0"]');
        await s.p.waitForTimeout(300);
        const c = cancels(s);
        if (c.length !== 1 || !c[0].url.endsWith('/till/10/cancel')) bad.push('till-cancel: ушло не то: ' + JSON.stringify(c.map(x => x.url)));
        if (days(s).length !== 2) bad.push(`till-cancel: день после отмены не перечитан (запросов дня ${days(s).length})`);
        const rows = await dayRows(s), t = await s.view();
        if (rows[0] !== 'Членство 09:40 · карта Отменено [отменено]') bad.push('till-cancel: отменённая строка не помечена: ' + rows[0]);
        if (rows[5] !== 'Отмена · Членство 19:00 · карта −3 000 ฿ [тихо]') bad.push('till-cancel: нет строки отмены: ' + rows[5]);
        if (!t.includes('750 ฿')) bad.push('till-cancel: итог не перечитан');
        if (await s.p.$('.deny')) bad.push('till-cancel: после удачной отмены висит отказ');
      }
    }
    await s.ctx.close();
  }
  // Отказы (E36v) — над той строкой, словами сервера как есть; день не перечитывается.
  // Тексты — боевого api 02f0ac6 (till.py: шапка «строку держит», хвост по виду
  // хозяина). Подмены в клиенте больше нет (Cafe13KPG#340): у ЗАПИСИ сервер сам
  // говорит, что возврата нет, и случай держит, что обещание не вернулось.
  for (const [name, code, detail, want, never] of [
    ['till-cancel-403', 403, 'эту строку принял другой человек: отменяет он сам или администратор клуба',
     'Эту строку принял другой человек: отменяет он сам или администратор клуба', null],
    // обещание у ЗАКАЗА — правда (встречная строка, BALANCE_SQL), не подменяется
    ['till-cancel-zakaz', 409, 'строку держит заказ 41: отмените сам заказ — деньги вернутся вместе с ним',
     'Строку держит заказ 41: отмените сам заказ — деньги вернутся вместе с ним', null],
    ['till-cancel-409', 409, 'строку держит членство 7: правки членства в приложении пока нет — нужен администратор клуба',
     'Строку держит членство 7: правки членства в приложении пока нет — нужен администратор клуба', null],
    ['till-cancel-zapis', 409, 'строку держит запись 17: возврата за запись в приложении пока нет — нужен администратор клуба. Снимать запись ради возврата НЕ нужно: встречной строки в книге от этого не появится, а запись станет снятой при принятых деньгах',
     'Строку держит запись 17: возврата за запись в приложении пока нет — нужен администратор клуба. Снимать запись ради возврата НЕ нужно: встречной строки в книге от этого не появится, а запись станет снятой при принятых деньгах',
     /деньги вернутся|верн[уё]т/i]
  ]) {
    const s = await open(true, true, json(200, STAFF), null, null, null, tday({ cancel: () => json(code, { detail }) }));
    if (await toTillDay(s, name)) {
      if (await askFirst(s, name)) await s.p.click('[data-action="td-cancel:0"]');
      await s.p.waitForTimeout(250);
      const d = await s.p.evaluate(() => { const x = document.querySelector('#view .deny'); return x ? x.textContent.trim() : null; });
      if (d !== want) bad.push(`${name}: отказ «${d}», ждали «${want}»`);
      if (never && d && never.test(d)) bad.push(`${name}: кассиру обещан возврат за запись, которого нет (api#70)`);
      if (await at(s) !== 'tillDay') bad.push(`${name}: после отказа ушли с дня кассы`);
      if (days(s).length !== 1) bad.push(`${name}: после отказа день перечитан — отказ бы исчез`);
      const next = await s.p.evaluate(T => { const txt = eval(T), x = document.querySelector('#view .deny'); return x && x.nextElementSibling ? txt(x.nextElementSibling) : ''; }, TXT);
      if (!next.startsWith('Членство 09:40')) bad.push(`${name}: отказ стоит не над нажатой строкой: «${next.slice(0, 40)}»`);
    }
    await s.ctx.close();
  }
  // Ответ не дошёл: день перечитывается, человек не остаётся с «неизвестно».
  {
    const s = await open(true, true, json(200, STAFF), null, null, null, tday({ cancel: 'abort' }));
    if (await toTillDay(s, 'till-cancel-lost')) {
      if (await askFirst(s, 'till-cancel-lost')) await s.p.click('[data-action="td-cancel:0"]');
      await s.p.waitForTimeout(300);
      const t = await s.view();
      if (!t.includes('Ответ сервера не дошёл')) bad.push('till-cancel-lost: нет «Ответ сервера не дошёл»');
      if (!t.includes('«Отменено» стоит')) bad.push('till-cancel-lost: не сказано, как узнать, прошла ли отмена');
      if (days(s).length !== 2) bad.push('till-cancel-lost: день не перечитан');
    }
    await s.ctx.close();
  }
  // Пустой день (E36b), неразобранный и не сходящийся — каждый своими словами.
  for (const [name, reply, want, never] of [
    ['till-day-empty', json(200, Object.assign({}, DAY_OK, { rows: [], total_live: '0.00', count_live: 0 })), 'Сегодня через кассу ничего не прошло', 'Строки за сегодня'],
    ['till-day-bad', json(200, Object.assign({}, DAY_OK, { rows: [DROW({ kind: 'expense' })] })), 'Ответ сервера не разобран', 'Через книгу за день'],
    // E36g: расхождение снимает числа, а строки (дословно из ответа) остаются
    ['till-day-sum', json(200, Object.assign({}, DAY_OK, { total_live: '9999.00' })), 'Итог дня не сходится со строками', 'Через книгу за день'],
    ['till-day-403', json(403, { detail: 'нужна роль кассы' }), 'Нужна роль кассы', 'Через книгу за день']
  ]) {
    const s = await open(true, true, json(200, STAFF), null, null, null, tday({ day: () => reply }));
    if (await toTillDay(s, name)) {
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
      if (t.includes(never)) bad.push(`${name}: лишнее «${never}»`);
      // Заголовок пустого дня и его подпись — одна пара в .col: зазор равен row-gap этого .col
      // (3 px), а не .card (10) — без обёртки объяснение про сутки отрывается от заголовка
      // (Cafe13KPG#386, форма 14 мест). Эталон — row-gap ПРАВИЛА .col, снятый с чистого пробного
      // .col в той же карточке (контекст каскада совпадает по построению), а не с этого элемента: иначе местный style="gap:…" подвинул бы эталон вместе
      // с зазором и прошёл зелёным (возврат архитектора). Правка styles.css не делает проверку
      // тихо неверной: эталон едет вместе с правилом. Число печатается и при зелёном.
      if (name === 'till-day-empty') {
        const g = await s.p.evaluate(() => {
          const b = [...document.querySelectorAll('#view .card.quiet b')].find(e => e.textContent === 'Сегодня через кассу ничего не прошло');
          const n = b && b.nextElementSibling, col = b && b.parentElement;
          return { gap: n ? Math.round(n.getBoundingClientRect().top - b.getBoundingClientRect().bottom) : null,
                   inCol: !!col && col.classList.contains('col'),
                   want: (() => { const p = document.createElement('div'); p.className = 'col'; ((b && b.closest('.card')) || document.getElementById('view')).appendChild(p);
                                  const v = Math.round(parseFloat(getComputedStyle(p).rowGap)); p.remove(); return v; })() };
        });
        console.log(`till-day-empty: зазор заголовок→подпись ${g.gap} px, row-gap правила .col ${g.want}${g.inCol ? '' : ', пара не в .col'}`);
        // Контроль прибора: правила .col нет (класс переименован) — проба даёт row-gap normal → NaN.
        if (!Number.isFinite(g.want)) bad.push('till-day-empty: НЕ ВЫПОЛНЕНО — у пробного .col нет числового row-gap, правило .col не найдено (Cafe13KPG#386)');
        else if (g.gap === null || !g.inCol || g.gap !== g.want)
          bad.push(`till-day-empty: подпись пустого дня оторвана от заголовка — зазор ${g.gap} px, у правила .col ${g.want}${g.inCol ? '' : ', пара не в .col'} (Cafe13KPG#386)`);
      }
      if (name === 'till-day-sum') {
        if ((await dayRows(s)).length !== 5) bad.push('till-day-sum: при расхождении итога сняты и строки — они из ответа дословно (E36g)');
        if (/наличными|картой/.test(t)) bad.push('till-day-sum: при расхождении итога показаны суммы по способу — они из того же разбора');
      }
    }
    await s.ctx.close();
  }
  // Продать членство: скан → карточка → форма → итог по ответу и перечитанной карточке.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, cash({ after: { balance: 0 } }));
    if (await toPerson(s, 'till-sell')) {
      let t = await s.view();
      if (await at(s) !== 'tillPerson') bad.push('till-sell: найденный человек не на своём экране');
      for (const w of ['Пробный Гость', 'Пропуск XIII-0042', 'Членства нет', 'Продать членство', 'Внести на счёт'])
        if (!t.includes(w)) bad.push(`till-sell: на карточке нет «${w}»`);
      if (finds(s)[0] && !finds(s)[0].url.endsWith('/till/by-pass/0042')) bad.push('till-sell: искали не тот код: ' + finds(s)[0].url);
      if (await s.p.evaluate(() => backTo()) !== 'staff') bad.push('till-sell: «назад» с карточки ведёт не к скану');
      if (await toForm(s, 'till-sell', 'membership')) {
        if (await s.p.evaluate(() => backTo()) !== 'tillPerson') bad.push('till-sell: «назад» с формы ведёт не к карточке');
        if (await s.p.$eval('#tp-amount', e => e.value + e.placeholder) !== '') bad.push('till-sell: в поле суммы что-то стоит до ввода');
        await s.p.click('[data-action="tp-level:organizer"]');
        await s.p.fill('#tp-months', '6');
        await s.p.fill('#tp-amount', '3000');
        await s.p.click('[data-action="tp-method:card"]');
        if (await s.p.$eval('#tp-amount', e => e.value) !== '3000') bad.push('till-sell: выбор способа стёр сумму');
        await s.p.click('[data-action="tp-send"]');
        await s.p.waitForTimeout(400);
        const tp = tillPosts(s);
        if (tp.length !== 1 || tp[0].body !== JSON.stringify({ kind: 'membership', amount: 3000, method: 'card', member_id: PID, level: 'organizer', months: 6 }))
          bad.push('till-sell: ушло не так: ' + JSON.stringify(tp.map(c => c.body)));
        t = await s.view();
        if (t.includes('Организатор')) bad.push('till-sell: вид назван «Организатор», а не «Мастер»');
        for (const w of ['Принято 3 000 ฿ картой', 'Мастер', 'до 24 апреля 2027', 'Следующий человек', 'правки членства в приложении пока нет',
                         'Строка ушла в книгу клуба. Исправить задним числом нельзя. Ошиблись — к администратору клуба.'])
          if (!t.includes(w)) bad.push(`till-sell: на итоге нет «${w}»`);
        // Кадр E34g (Cafe13KPG#374): у строки с членством хозяин, привратник отмены срабатывает
        // раньше субъектного — ни пути, ни субъекта, иначе совет вёл бы к отказу 409.
        if (/отмените|Дне кассы|тот, кто принял/.test(t)) bad.push('till-sell: итог членства зовёт отменить на «Дне кассы» — строку с членством в приложении не снимает никто (Cafe13KPG#373)');
        if (finds(s).length !== 2) bad.push(`till-sell: карточка после приёма не перечитана (запросов by-pass: ${finds(s).length})`);
        await s.p.screenshot({ path: `${OUT}/live-till-done.png`, fullPage: true });
        if (await leak(s)) bad.push('till-sell: номер человека попал в разметку или хранилище');
        await s.p.click('[data-action="tp-next"]');
        await s.p.waitForTimeout(100);
        if (await at(s) !== 'staff' || (await s.p.$eval('#tp-code', e => e.value)) !== '') bad.push('till-sell: «Следующий человек» не вернул к пустому скану');
      }
    }
    if (s.errs.length) bad.push('till-sell: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }
  // Внести на счёт: у пополнения нет «со счёта», остаток — из перечитанной карточки.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, cash({ after: { balance: '500.00' } }));
    if (await toPerson(s, 'till-topup') && await toForm(s, 'till-topup', 'topup')) {
      if (await s.p.$('[data-action="tp-method:account"]')) bad.push('till-topup: у пополнения есть «со счёта» — кнопка к верному отказу 409');
      if (await s.p.$('#tp-months')) bad.push('till-topup: у пополнения поле срока');
      if (!(await s.view()).includes('Перевести со счёта на счёт нельзя')) bad.push('till-topup: нет строки «со счёта на счёт нельзя» (кадр E34e)');
      if (await s.p.evaluate(() => backTo()) !== 'tillPerson') bad.push('till-topup: «назад» с формы ведёт не к карточке');
      await s.p.fill('#tp-amount', '500');
      await s.p.click('[data-action="tp-send"]');
      await s.p.waitForTimeout(400);
      const tp = tillPosts(s);
      if (tp.length !== 1 || tp[0].body !== JSON.stringify({ kind: 'topup', amount: 500, method: 'cash', member_id: PID }))
        bad.push('till-topup: ушло не так: ' + JSON.stringify(tp.map(c => c.body)));
      const t = await s.view();
      if (!t.includes('Принято 500 ฿ наличными') || !t.includes('500 ฿')) bad.push('till-topup: нет итога с остатком');
      if (t.includes('правки членства')) bad.push('till-topup: плашка про членство у пополнения');
      // Кадр E34m (Cafe13KPG#374): у пополнения хозяина нет, снимает тот, кто принял, на
      // «Дне кассы». Совет E34g «к администратору клуба» отправлял бы его от стойки.
      if (!t.includes('Строка ушла в книгу клуба. Исправить задним числом нельзя — ошиблись, отмените её на «Дне кассы» и внесите заново.'))
        bad.push('till-topup: итог не дословно E34m «…отмените её на «Дне кассы» и внесите заново»');
      if (t.includes('к администратору клуба')) bad.push('till-topup: итог пополнения шлёт к администратору клуба — снять строку может тот, кто принял (Cafe13KPG#373, кадр E34m)');
      if (/пока не сделана/.test(t)) bad.push('till-topup: итог говорит, что отмены в приложении нет, — её принесла v50 (Cafe13KPG#373)');
      if (await leak(s)) bad.push('till-topup: номер человека попал в разметку или хранилище');
    }
    await s.ctx.close();
  }
  // Отказы поиска — словами сервера, на скане, без перехода к карточке.
  for (const [name, find, want] of [
    ['till-422', () => json(422, { detail: 'код пропуска — четыре цифры, с «XIII-» или без' }), 'Код пропуска — четыре цифры, с «XIII-» или без'],
    ['till-404', () => json(404, { detail: 'пропуск не найден' }), 'Пропуск не найден'],
    ['till-noname', () => json(200, Object.assign({}, PERSON, { first_name: null })), 'Ответ сервера не разобран'],
    ['till-nobal', () => json(200, Object.assign({}, PERSON, { balance: null })), 'Ответ сервера не разобран'],
    ['till-noend', () => json(200, Object.assign({}, PERSON, { membership_active: true,
       membership: { level: 'member', starts_at: ENDS, ends_at: null, lifelong: false } })), 'Ответ сервера не разобран']]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, cash({ find }));
    if (await toPerson(s, name, '123')) {
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
      if (await at(s) !== 'staff') bad.push(`${name}: отказ открыл карточку`);
    }
    await s.ctx.close();
  }
  // Пожизненное членство — словом стандарта, а не датой.
  {
    const s = await open(true, true, json(200, OWNER), null, null, null, cash({ find: () => json(200, Object.assign({}, PERSON,
      { membership_active: true, membership: { level: 'partner', starts_at: ENDS, ends_at: null, lifelong: true } })) }));
    if (await toPerson(s, 'till-lifelong')) {
      const t = await s.view();
      if (!t.includes('Пожизненно') || !t.includes('Бизнес-партнёр') || t.includes('Членства нет')) bad.push('till-lifelong: пожизненное не так: ' + t.slice(0, 160));
    }
    await s.ctx.close();
  }
  // Срок и сумма не те — не отправляется.
  for (const [months, amount, want] of [['0', '100', 'от 1 до 24'], ['25', '100', 'от 1 до 24'], ['abc', '100', 'от 1 до 24'],
                                        ['6', '0', 'Сумма — число больше нуля']]) {
    const name = `till-form-${months}-${amount}`;
    const s = await open(true, true, json(200, OWNER), null, null, null, cash());
    if (await toPerson(s, name) && await toForm(s, name, 'membership')) {
      await s.p.fill('#tp-months', months);
      await s.p.fill('#tp-amount', amount);
      await s.p.click('[data-action="tp-send"]');
      await s.p.waitForTimeout(150);
      if (tillPosts(s).length || !(await s.view()).includes(want)) bad.push(`${name}: принято без «${want}»`);
    }
    await s.ctx.close();
  }
  // Приём: отказ сервера, потерянный ответ, чужая строка, карточка не перечиталась.
  for (const [name, kind, o, want, nowant] of [
    ['till-409', 'membership', { post: () => json(409, { detail: 'на счёте 0, не хватает 3000' }) }, ['На счёте 0, не хватает 3000'], ['Принято']],
    // Ответа не было (E34zh): «неизвестно» верно, совет — перечитать, подождать, позвать.
    ['till-lost', 'membership', { post: 'abort' }, ['Неизвестно, принято ли', 'Ответ сервера не дошёл.',
      'Перед приёмом: членства нет, остаток 0 ฿'], ['Принято', 'Деньги проведены', 'Ниже — перечитанная карточка']],
    // 201 — деньги в книге (E34z): «неизвестно» звало бы ко второму приёму (Cafe13KPG#333).
    // Разобранное, но не совпавшее тело — E34k/E34l, случаи till-351-* ниже.
    ['till-201-raw', 'topup', { post: () => ({ status: 201, contentType: 'text/html', body: '<html>ok</html>' }) },
      ['Деньги проведены', 'Если они не изменились, это вопрос к администратору клуба'], ['Принято', 'Неизвестно', 'не разобран']],
    // 201, а карточка не перечиталась (E34i): сверять не с чем — открыть заново по коду.
    ['till-201-noreread', 'membership', { post: () => ({ status: 201, contentType: 'text/html', body: '<html>ok</html>' }),
      refind: (() => { let n = 0; return () => n++ ? json(200, Object.assign({}, PERSON, { balance: 500 })) : json(500, { detail: 'x' }); })() },
      ['Деньги проведены', 'Откройте её заново по коду пропуска', 'Это данные ДО приёма: карточка не перечиталась'], ['Если они не изменились, это вопрос к администратору клуба', 'Неизвестно', 'Перед приёмом']],
    // Заметки не-чистых состояний пополнения — дословно кадры (Cafe13KPG#381): E34o держит адрес,
    // у E34n его нет — адрес несёт плашка ниже, второй заставил бы гадать. Текст E34n — начало
    // E34g, поэтому «дословно» здесь держат запреты, а не includes.
    ['till-noreread', 'topup', { refind: () => json(500, { detail: 'x' }) }, ['Принято 500', 'Остаток не перечитан — обновите карточку', 'Перечитать карточку',
      'Строка ушла в книгу клуба. Исправить задним числом нельзя. Ошиблись — к администратору клуба.'], ['Дне кассы']],
    ['till-nogrow', 'topup', { after: { balance: 0 } }, ['Остаток изменился не на эту сумму', 'Не вносите снова',
      'Строка ушла в книгу клуба. Исправить задним числом нельзя.'], ['Ошиблись', 'ошиблись', 'к администратору клуба', 'Дне кассы']]]) {
    const s = await open(true, true, json(200, OWNER), null, null, null, cash(o));
    if (await toPerson(s, name) && await toForm(s, name, kind)) {
      if (kind === 'membership') { await s.p.fill('#tp-months', '1'); await s.p.click('[data-action="tp-level:organizer"]'); }
      await s.p.fill('#tp-amount', kind === 'membership' ? '3000' : '500');
      await s.p.click('[data-action="tp-send"]');
      await s.p.waitForTimeout(400);
      const t = await s.view();
      for (const w of want) if (!t.includes(w)) bad.push(`${name}: нет «${w}»`);
      for (const w of nowant) if (t.includes(w)) bad.push(`${name}: есть «${w}»`);
      // Экран, а не файл: в прозе прежняя редакция с доводом храниться может.
      if (/внесите заново|внести заново/i.test(t)) bad.push(`${name}: экран велит внести заново — если платёж прошёл, это второй платёж (Cafe13KPG#333)`);
      if (name === 'till-201-noreread') {
        // Итог не отрисован (клиент упал в разборе ответа) — красное своим текстом, а не обрыв батареи на $eval.
        if (await s.p.evaluate(() => { const e = document.querySelector('#view .rows > div:last-child b'); return e ? e.textContent : null; }) !== 'не перечитан')
          bad.push('till-201-noreread: остаток прежним числом, а не «не перечитан»');
        if (!(await s.p.$('[data-action="tp-reload"]'))) bad.push('till-201-noreread: на итоге нет «Перечитать карточку»');
        else await s.p.click('[data-action="tp-reload"]');
        await s.p.waitForTimeout(250);
        const t2 = await s.view();
        if (!t2.includes('Если они не изменились, это вопрос к администратору клуба') || !t2.includes('Перед приёмом: членства нет, остаток 0 ฿'))
          bad.push('till-201-noreread: после перечитывания плашка и строка «перед приёмом» не сменились на сверку (E34z)');
        if (t2.includes('Это данные ДО приёма')) bad.push('till-201-noreread: после перечитывания карточка всё ещё названа данными ДО приёма');
      }
      // остаток — только перечитанный: прежний после приёма был бы ложью
      if (name === 'till-noreread' && await s.p.evaluate(() => { const e = document.querySelector('#view .rows > div:last-child b'); return e ? e.textContent : null; }) !== 'не перечитан')
        bad.push('till-noreread: в строке «На счёте» прежний остаток вместо «не перечитан»');
      // вес, а не только слова: неизвестный исход глиной и с громким «Перечитать» (кадр E34zh)
      // Совет E34zh (кадр на dev a47fd3c, Cafe13KPG#356) — ЧЕТЫРЕ ступени, по
      // порядку: последняя однажды потерялась при переносе, и три от четырёх
      // отличаются только тем, чего нет. Считаются числом, не словами.
      if (name === 'till-lost') {
        const note = await s.p.evaluate(() => { const n = document.querySelector('#view .note'); return n ? n.textContent : ''; });
        const STEPS = ['Нажмите «Перечитать карточку» и сверьте со строкой «Перед приёмом».', 'Изменилось — платёж прошёл, больше ничего не нужно.',
          'Не изменилось — подождите минуту и перечитайте:', 'Если и тогда не изменилось — позовите администратора клуба, а не вносите заново.'];
        const at_ = STEPS.map(x => note.indexOf(x));
        const found = at_.filter(i => i >= 0).length;
        if (found !== 4 || at_.some((i, k) => k && i < at_[k - 1]))
          bad.push(`till-lost: ступеней совета ${found} из 4 или не по порядку (${JSON.stringify(at_)}) — кадр E34zh`);
      }
      if (name === 'till-lost' || name === 'till-201-raw') {
        const g = await s.p.evaluate(() => ({
          warm: !!document.querySelector('#view .card.warm'),
          loud: [...document.querySelectorAll('#view .btn')].filter(b => !/\b(quiet|ghost)\b/.test(b.className)).map(b => b.textContent),
          sell: !!document.querySelector('[data-action="tp-open:membership"]') }));
        if (!g.warm) bad.push(`${name}: неизвестный исход не глиной — тот же вес, что у «Принято»`);
        if (g.loud.join('|') !== 'Перечитать карточку') bad.push(`${name}: громкая кнопка не «Перечитать карточку»: ` + JSON.stringify(g.loud));
        if (g.sell) bad.push(`${name}: при неизвестном исходе предложено принять снова`);
      }
      if (name === 'till-nogrow' && !(await s.p.evaluate(() => [...document.querySelectorAll('#view .deny')].some(e => e.textContent.includes('Не вносите снова')))))
        bad.push('till-nogrow: «Не вносите снова» не плашкой, а тихой подписью');
      if (name === 'till-409' && (await at(s) !== 'tillMembership' || (await s.p.$eval('#tp-amount', e => e.value)) !== '3000'))
        bad.push('till-409: после отказа ушли с формы или стёрли сумму');
    }
    await s.ctx.close();
  }
  // 201 с РАЗОБРАННЫМ, но не совпавшим телом — третье состояние (Cafe13KPG#351,
  // кадры E34k/E34l). Развилка — есть ли что поставить РЯДОМ с введённым:
  // вид, сумма, уровень → E34k, пара «Вы вводили / Сервер ответил»; человек →
  // E34l, словом, без значений (member_id — это tg_user_id); печатать нечего
  // (срок не дата, вид незнаком) → E34z как есть. Прежде till-alien и
  // till-level ждали здесь текст E34z — то самое слияние состояний из #351.
  {
    const ALIEN = 200000004;
    const bent = f => q => { const x = JSON.parse(q.postData());
      const row = { id: 95, at: '2026-10-24T10:00:00+00:00', kind: x.kind, amount: Number(x.amount).toFixed(2), method: x.method,
                    member_id: x.member_id, note: '' };
      if (x.kind === 'membership') row.membership = { id: 7, level: x.level, starts_at: '2026-10-24T10:00:00+00:00', ends_at: ENDS };
      f(row); return json(201, row); };
    const SAY2 = 'по ответу подтвердить нечем';
    // [имя, вид, подмена ответа, кадр, что ввели, что ответил сервер, номер строки, прочее для cash()]
    for (const [name, kind, f, frame, mine, theirs, id, more] of [
      ['till-351-sum', 'topup', r => { r.amount = '300.00'; }, 'E34k', '500 ฿', '300 ฿', '№ 95'],
      ['till-351-kind', 'topup', r => { r.kind = 'service'; }, 'E34k', 'На счёт', 'За услугу', '№ 95'],
      // вид разошёлся вместе с суммой — на экран пара вида, а не суммы
      ['till-351-two', 'membership', r => { r.kind = 'topup'; r.amount = '300.00'; delete r.membership; }, 'E34k', 'Членство', 'На счёт', '№ 95'],
      ['till-351-level', 'membership', r => { r.membership.level = 'member'; }, 'E34k', 'Мастер', 'Член клуба', '№ 95'],
      // номера в теле нет — строки «Строка в книге» нет, остальной кадр тот же
      ['till-351-noid', 'topup', r => { r.amount = '300.00'; delete r.id; }, 'E34k', '500 ฿', '300 ฿', null],
      ['till-351-who', 'topup', r => { r.member_id = ALIEN; }, 'E34l'],
      // сравнение строгое: тот же номер строкой расходится так же
      ['till-351-who-str', 'topup', r => { r.member_id = String(r.member_id); }, 'E34l'],
      // карточка не перечиталась — «Перед приёмом» стоит всё равно: совету E34l иначе не с чем сравнивать (возврат архитектора)
      ['till-351-who-noreread', 'topup', r => { r.member_id = ALIEN; }, 'E34l', null, null, null, { refind: () => json(500, { detail: 'x' }) }],
      // человека в ответе НЕТ — это не «другой человек»: E34l солгал бы кассиру (возврат архитектора на #82)
      ['till-351-noperson', 'topup', r => { delete r.member_id; }, 'E34z'],
      ['till-351-nullperson', 'topup', r => { r.member_id = null; }, 'E34z'],
      ['till-351-noend', 'membership', r => { r.membership.ends_at = 'когда-нибудь'; }, 'E34z'],
      // членство, всё совпало, а объекта membership в ответе нет — печатать нечего
      ['till-351-noms', 'membership', r => { delete r.membership; }, 'E34z'],
      // уровень, которого нет в LEVEL, — печатать нечем
      ['till-351-nolevel', 'membership', r => { r.membership.level = 'gold'; }, 'E34z'],
      ['till-351-nokind', 'topup', r => { r.kind = 'gift'; }, 'E34z'],
      ['till-351-nosum', 'topup', r => { r.amount = 'пятьсот'; }, 'E34z']]) {
      const s = await open(true, true, json(200, OWNER), null, null, null, cash(Object.assign({ post: bent(f) }, more)));
      if (await toPerson(s, name) && await toForm(s, name, kind)) {
        if (kind === 'membership') { await s.p.fill('#tp-months', '1'); await s.p.click('[data-action="tp-level:organizer"]'); }
        await s.p.fill('#tp-amount', kind === 'membership' ? '3000' : '500');
        await s.p.click('[data-action="tp-send"]');
        await s.p.waitForTimeout(400);
        const t = await s.view();
        const g = await s.p.evaluate(() => {
          const words = el => { if (!el) return null; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = [];
            while (tw.nextNode()) out.push(tw.currentNode.nodeValue); return out.join(' '); };
          const rows = {};
          for (const r of document.querySelectorAll('#view .rows > div')) {
            const k = r.querySelector('.small'), v = r.querySelector('b');
            if (k && v) rows[k.textContent] = v.textContent;
          }
          return { warm: words(document.querySelector('#view .card.warm')), rows,
                   reload: !!document.querySelector('[data-action="tp-reload"]') };
        });
        const w = g.warm;
        if (w === null) { bad.push(`${name}: итог не глиной — 201 с чужим телом показан как обычный приём`); await s.ctx.close(); continue; }
        if (/Принято|Неизвестно/.test(t)) bad.push(`${name}: проведённый платёж назван принятым как ввели или неизвестным`);
        if (/внесите заново|внести заново/i.test(t)) bad.push(`${name}: экран велит внести заново (Cafe13KPG#333)`);
        if (frame === 'E34k') {
          if (w.includes(SAY2)) bad.push(`${name}: расхождение названо вторым состоянием — «${SAY2}», хотя ответ разобран (Cafe13KPG#351)`);
          if (!w.includes('Проведено не то, что вводили')) bad.push(`${name}: шапка не E34k`);
          // подзаголовок предмета не называет — его называют две строки ниже (кадр E34k на b4eeba3)
          if (!w.includes('Сервер ответил «принято» — строка в книге клуба уже есть. Второй раз не принимайте: повтор дал бы в книге вторую строку.'))
            bad.push(`${name}: подзаголовок не дословно E34k: ${JSON.stringify(w)}`);
          // пара по МЕСТАМ, а не просто оба слова на экране: перепутанные строки читались бы наоборот
          if (g.rows['Вы вводили'] !== mine || g.rows['Сервер ответил'] !== theirs)
            bad.push(`${name}: на итоге нет обеих величин рядом — ждали «Вы вводили ${mine}» / «Сервер ответил ${theirs}», есть ${JSON.stringify(g.rows)} (Cafe13KPG#351)`);
          if ((g.rows['Строка в книге'] || null) !== id) bad.push(`${name}: «Строка в книге» ${JSON.stringify(g.rows['Строка в книге'])}, ждали ${JSON.stringify(id)}`);
          // так на кадре: с кнопкой и «Перед приёмом» E34k не влезает (−1 px при 712)
          if (g.reload || t.includes('Перед приёмом')) bad.push(`${name}: на E34k «Перечитать карточку» или «Перед приёмом» — кадр их не несёт`);
          if (!t.includes('Назовите администратору клуба номер строки и что с чем разошлось')) bad.push(`${name}: нет совета E34k`);
        } else if (frame === 'E34l') {
          if (!w.includes('Но человек в ответе не тот, кого вы открыли, и чья это строка — по ответу не сказать. Второй раз не принимайте: повтор дал бы вторую строку.'))
            bad.push(`${name}: подзаголовок не дословно E34l`);
          if (!w.includes('Проведено, а человек в ответе не тот')) bad.push(`${name}: разошедшийся человек не E34l — шапка ${JSON.stringify(w.slice(0, 60))}`);
          if (w.includes(SAY2)) bad.push(`${name}: расхождение названо вторым состоянием — «${SAY2}», хотя ответ разобран (Cafe13KPG#351)`);
          if (Object.keys(g.rows).some(k => k === 'Вы вводили' || k === 'Сервер ответил')) bad.push(`${name}: у человека пара значений — номер человека на экран нельзя`);
          // асимметрия совета — часть кадра: без второй половины «не изменилось» читается «не прошло»
          if (!t.includes('Не изменилось — вывода нет, и «не прошло» это тоже не значит')) bad.push(`${name}: нет второй половины совета E34l`);
          if (!g.reload || !t.includes('Перед приёмом: членства нет, остаток 0 ฿')) bad.push(`${name}: на E34l нет «Перечитать карточку» или «Перед приёмом»`);
          if (t.includes('Это данные ДО приёма')) bad.push(`${name}: на E34l «Это данные ДО приёма» вместо строки «Перед приёмом» — кадр держит её всегда`);
        } else {
          if (!w.includes(SAY2) || !w.includes('Деньги проведены')) bad.push(`${name}: неразобранный ответ назван расхождением — признак третьего состояния шире предмета`);
          if ('Вы вводили' in g.rows) bad.push(`${name}: печатать нечего, а пара на экране`);
          if (w.includes('человек в ответе не тот')) bad.push(`${name}: человека в ответе нет, а экран говорит «не тот» — E34l вместо E34z`);
        }
        if (await s.p.evaluate(id => document.documentElement.outerHTML.includes(id), String(ALIEN)))
          bad.push(`${name}: номер чужого человека из ответа попал в разметку`);
        if (await leak(s)) bad.push(`${name}: номер человека попал в разметку или хранилище`);
      }
      await s.ctx.close();
    }
  }
  // Без права кассы — вкладки нет.
  {
    const plain = clone(OWNER); plain.roles = [];
    const s = await open(true, true, json(200, plain), null, null, null, cash());
    if (await s.p.$('#tabs [data-go="staff"]')) bad.push('till-norole: вкладка «Касса» у члена клуба без права кассы');
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
  // Куратор Бара без членства: путь только через вкладку «Заказы»
  const CURATOR = clone(OWNER); CURATOR.roles = [{ role: 'curator', direction_id: 7 }];
  CURATOR.membership_active = false; CURATOR.membership = null; CURATOR.memberships = [];
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
    const s = await open(true, true, json(200, CURATOR), null, null, null, book()); s.name = 'book-curator';
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
    const s = await open(true, true, json(200, CURATOR), null, null, null, book()); s.name = 'book-hint';
    if (await toBook(s, 'book-hint') && await fillExpense(s, 'book-hint', '240', ['b-cat:ремонт'])) {
      if ((await s.view()).includes('обычно текущая трата')) bad.push('book-hint: подсказка «обычно текущая» при ремонте');
      await tap(s, '[data-action="b-cat:расходники"]');
      if (!(await s.view()).includes('Расходники — обычно текущая трата')) bad.push('book-hint: нет подсказки при расходниках');
    }
    await s.ctx.close();
  }
  // Дата задним числом (cafe13-api#28): не тронута — `at` не уходит вовсе
  // («сегодня» решает сервер); сменена — уходит ровно она, и ответ обязан
  // лечь на неё же по часам клуба. Отказ сервера — его словами.
  // Мгновение страницы заморожено, ожидаемые даты — литералы, а не тот же
  // расчёт, что в клиенте: иначе замер совпал бы сам с собой. Два мгновения,
  // потому что у границы суток три состояния: днём даты острова и UTC
  // совпадают, в 00:30 по острову (17:30Z) UTC ещё во вчера.
  for (const M of [
    { tag: 'день', now: '2026-12-02T01:00:00Z', today: '2026-12-02', min: '2026-09-03', back: '2026-11-30', words: '30 ноября' },
    { tag: '00:30 на острове', now: '2026-12-02T17:30:00Z', today: '2026-12-03', min: '2026-09-04', back: '2026-12-02', words: '2 декабря' }]) {
    const NOW = Date.parse(M.now);
    // заглушка сервера: момент — 05:00 UTC (полдень по клубу) названного дня
    const echoAt = dayOf => q => { const x = JSON.parse(q.postData());
      return json(201, Object.assign({}, EXP_ROW, { amount: money2(x.amount), expense_cat: x.expense_cat, expense_kind: x.expense_kind,
        paid_by: x.paid_by, note: x.note, at: dayOf(x) + 'T05:00:00+00:00' })); };
    const w = `(${M.tag})`;
    // не тронута
    {
      const s = await open(true, true, json(200, CURATOR), null, null, null, book(), null, NOW); s.name = 'book-date-default';
      if (await toBook(s, 'book-date-default') && await fillExpense(s, 'book-date-default', '240', ALL_PICKS)) {
        if (!(await s.p.$('#b-date'))) bad.push(`book-date-default ${w}: нет поля даты`);
        else {
          const [v, mx, mn] = await s.p.$eval('#b-date', e => [e.value, e.max, e.min]);
          if (v !== M.today) bad.push(`book-date-default ${w}: в поле ${v}, сегодня на острове ${M.today}`);
          if (mx !== M.today || mn !== M.min) bad.push(`book-date-default ${w}: границы поля ${mn}…${mx}, ждали ${M.min}…${M.today}`);
          if (await askSend(s, 'book-date-default')) {
            const bp = bookPosts(s);
            if (bp.length !== 1 || 'at' in JSON.parse(bp[0].body)) bad.push(`book-date-default ${w}: дата не тронута, а \`at\` ушло: ` + JSON.stringify(bp.map(c => c.body)));
          }
        }
      }
      await s.ctx.close();
    }
    // сменена
    {
      const s = await open(true, true, json(200, CURATOR), null, null, null, book({ exp: echoAt(x => x.at || M.today) }), null, NOW); s.name = 'book-date-back';
      if (await toBook(s, 'book-date-back') && await fillExpense(s, 'book-date-back', '240', ALL_PICKS) && await s.p.$('#b-date')) {
        await s.p.fill('#b-date', M.back);
        await s.p.waitForTimeout(100);
        let t = await s.view();
        if (!t.includes('Задним числом: запись попадёт в отчёт за ' + M.words)) bad.push(`book-date-back ${w}: нет подписи, в чей отчёт уйдёт запись`);
        await tap(s, '[data-action="b-ask"]');
        await s.p.waitForTimeout(100);
        t = await s.view();
        if (!t.includes('За ' + M.words + ' — в сегодняшний отчёт не попадёт')) bad.push(`book-date-back ${w}: подтверждение не называет дату`);
        if (M.tag === 'день') await s.p.screenshot({ path: `${OUT}/live-book-backdate.png`, fullPage: true });
        await tap(s, '[data-action="b-send"]');
        await s.p.waitForTimeout(400);
        const bp = bookPosts(s);
        if (bp.length !== 1 || JSON.parse(bp[0].body).at !== M.back) bad.push(`book-date-back ${w}: ушло не \`at\`=${M.back}: ` + JSON.stringify(bp.map(c => c.body)));
        t = await s.view();
        if (!t.includes('Расход записан за ' + M.words + ': 240 ฿')) bad.push(`book-date-back ${w}: итог не называет дату: ` + t.slice(0, 200));
        if ((await s.p.$eval('#b-date', e => e.value).catch(() => null)) !== M.today) bad.push(`book-date-back ${w}: после записи дата не вернулась к сегодняшней`);
      }
      if (s.errs.length) bad.push(`book-date-back ${w}: ошибки страницы ` + s.errs.join('; '));
      await s.ctx.close();
    }
    if (M.tag !== 'день') continue;
    // ответ лёг на другой день — не «записан»; отказ сервера — его словами
    for (const [name, exp, want] of [
      ['book-date-otherday', echoAt(() => '2026-11-27'), 'Ответ сервера не разобран'],
      ['book-date-422', () => json(422, { detail: 'дата 2026-12-05 — из будущего; сегодня в клубе 2026-12-02' }), 'Дата 2026-12-05 — из будущего']]) {
      const s = await open(true, true, json(200, CURATOR), null, null, null, book({ exp }), null, NOW); s.name = name;
      if (await toBook(s, name) && await fillExpense(s, name, '240', ALL_PICKS) && await s.p.$('#b-date')) {
        await s.p.fill('#b-date', M.back);
        await askSend(s, name);
        const t = await s.view();
        if (!t.includes(want) || t.includes('Расход записан')) bad.push(`${name}: нет «${want}»: ` + t.slice(0, 200));
      }
      await s.ctx.close();
    }
  }
  // Не сумма — не уходит.
  for (const v of ['0', 'abc', '1.234']) {
    const s = await open(true, true, json(200, CURATOR), null, null, null, book()); s.name = 'book-curator';
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
    const s = await open(true, true, json(200, CURATOR), null, null, null, book(o)); s.name = name;
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
    const tea = clone(CURATOR); tea.roles = [{ role: 'curator', direction_id: 2 }];
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
    const s = await open(true, true, json(200, CURATOR), null, null, null, dayApi()); s.name = 'day';
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
    const s = await open(true, true, json(200, CURATOR), null, null, null, dayApi(reply)); s.name = name;
    if (await toDay(s)) {
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»: ` + t.slice(0, 160));
      if (t.includes(hasnt)) bad.push(`${name}: показано «${hasnt}»`);
    }
    await s.ctx.close();
  }
  // Поздний ответ прежнего среза не ложится поверх свежего (гард поколения в
  // loadDay). Первый отчёт медленный (задержка — от самого запроса), уход на
  // «Заказы» и возврат дают второй, быстрый. Выручка прежнего среза
  // другая (1 470 вместо 1 570) и помечена нечитаемой строкой.
  {
    let n = 0, landed = false;
    const OLD = Object.assign({}, DAY_ROW, {
      income: [Object.assign({}, DAY_ROW.income[0], { amount: '1400.00', note: 'qzx-срез-qzx' }), DAY_ROW.income[1]],
      income_total: '1470.00' });
    const slow = () => new Promise(r => setTimeout(() => { landed = true; r(json(200, OLD)); }, 1500));
    const s = await open(true, true, json(200, CURATOR), null, null, null, dayApi(() => ++n === 1 ? slow() : json(200, DAY_ROW))); s.name = 'day-late';
    if (await toDay(s)) {
      // пока отчёт грузится, на экране дня кнопок нет — уход вкладкой «Заказы»
      await tap(s, '#tabs [data-go="barQueue"]'); await s.p.waitForTimeout(250);
      await tap(s, '#view [data-go="barDay"]'); await s.p.waitForTimeout(300);
      if (dayGets(s).length !== 2) bad.push(`day-late: возврат не перечитал отчёт (запросов ${dayGets(s).length})`);
      if (landed) bad.push('day-late: прежний срез пришёл раньше второго запроса — гонки не было, случай гарда не проверяет');
      await s.p.waitForTimeout(1600);
      const t = await s.view();
      if (t.includes('qzx')) bad.push('day-late: на экране дня выручка прежнего среза (1 470 ฿ вместо 1 570 ฿)');
      else if (!t.includes('1 570 ฿')) bad.push('day-late: свежей выручки 1 570 ฿ на экране нет: ' + t.slice(0, 160));
    } else bad.push('day-late: не дошли до отчёта');
    await s.ctx.close();
  }
  // Сбой обновления не стирает отчёт, а помечает.
  {
    let n = 0;
    const s = await open(true, true, json(200, CURATOR), null, null, null, dayApi(() => ++n === 1 ? json(200, DAY_ROW) : json(500, { detail: 'x' }))); s.name = 'day-stale';
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
  const TEST_CURATOR = clone(CURATOR); TEST_CURATOR.member.tg_user_id = 501; TEST_CURATOR.member.first_name = 'Образец';
  const PEOPLE = { base: 'test', people: [
    { tg_user_id: 501, first_name: 'Образец', last_name: '', roles: [{ role: 'curator', direction_id: 7, direction: 'Бар' }] },
    { tg_user_id: 502, first_name: 'Второй', last_name: '', roles: [{ role: 'curator', direction_id: 2, direction: 'Чай' }] }] };
  function testApi(o) {
    o = Object.assign({ health: 'configured', people: () => json(200, PEOPLE), as: { '501': TEST_CURATOR } }, o);
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
  // Полный путь: войти → список → глазами куратора → запись → выйти из просмотра → выйти из теста.
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
      if (!t.includes('Образец') || !t.includes('Куратор направления · Бар') || !t.includes('Второй') || !t.includes('Куратор направления · Чай'))
        bad.push('test-path: в списке нет людей словами: ' + t.slice(0, 300));
      await s.p.screenshot({ path: `${OUT}/live-test-people.png`, fullPage: true });
      if (await tap(s, '[data-action="test-as:501"]')) {
        await s.p.waitForTimeout(400);
        const me = s.calls.filter(c => c.url.endsWith('/me')).pop();
        if (!me || me.test !== '1' || me.as !== '501') bad.push('test-path: /me выбранного человека запрошен без обоих заголовков');
        const st = (await strip(s)) || '';
        if (!st.includes('Тестовая база') || !st.includes('Смотрите как Образец') || !st.includes('ненастоящие')) bad.push('test-path: полоса не говорит, чьими глазами и что база тестовая: ' + st);
        if (!(await s.p.isVisible('#demo-btn'))) bad.push('test-path: в просмотре пропало солнышко — к панели не вернуться');
        // Куратор без членства: путь к записи через «Заказы»; запись идёт с обоими заголовками
        const before = s.calls.length;
        if (await toBook(s, 'test-path') && await fillExpense(s, 'test-path', '240', ALL_PICKS) && await askSend(s, 'test-path')) {
          const w = s.calls.slice(before).filter(c => c.method === 'POST');
          if (w.length !== 1 || w[0].test !== '1' || w[0].as !== '501') bad.push('test-path: запись ушла не в тестовую базу глазами выбранного человека: ' + JSON.stringify(w.map(c => [c.url, c.test, c.as])));
          if (!((await strip(s)) || '').includes('Смотрите как Образец')) bad.push('test-path: на экране записи нет полосы');
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
    const CURATOR_MENU = [Object.assign({}, MENU[0], { id: 31, title: 'Матча' })];
    const t0 = testApi();
    const s = await open(true, true, json(200, OWNER), null, null, null, q => {
      if (q.url().includes('/bar/menu'))
        return q.headers()['x-act-as'] === '501' ? json(200, CURATOR_MENU)
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
    const s = await open(true, true, json(200, CURATOR), null, null, null, testApi()); s.name = 'test-nogod';
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
    if (!member) { who.membership_active = false; who.membership = null; who.memberships = []; }
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
  // Час запуска материалом проверки быть не может: фикстура, привязанная к
  // «сегодня», зелена утром и красна вечером. Мгновение одно и названо здесь,
  // страница видит его же (clock.setFixedTime) — остров, среда 2 декабря, 08:00.
  const NOWFIX = Date.parse('2026-12-02T01:00:00.000Z');
  const BKKNOW = new Date(NOWFIX + 7 * 3600e3);              // стенные часы острова в полях UTC
  const bkkDay = off => new Date(BKKNOW.getTime() + off * 864e5).toISOString().slice(0, 10);
  const atBkk = (off, h, m) => new Date(Date.parse(bkkDay(off) + 'T' + pad2(h) + ':' + pad2(m || 0) + ':00Z') - 7 * 3600e3).toISOString();
  const EV = over => Object.assign({
    id: 4, title: 'Вечер ханга', starts_at: atBkk(1, 19), duration_min: 90, seats: 12,
    kind: 'paid', price: '400.00', about: 'Живой звук, место у сцены', filmed: false,
    organizer_id: 500, organizer_first_name: 'Образец', organizer_last_name: '',
    taken: 0, seats_left: 12, booked_by_me: null, my_booking_id: null,
    // Место есть в КАЖДОЙ строке живого ответа (снимок 23.10.2026), и оба
    // поля бывают null сразу: по умолчанию фикстура — мероприятие без места.
    place_id: null, place_name: null
  }, over);
  const AFISHA = [
    EV({ id: 1, title: 'Утро у воды', starts_at: atBkk(0, 10), duration_min: 60, kind: 'free',
         price: '0.00', about: '', seats: 6, taken: 6, seats_left: 0, booked_by_me: false }),
    EV({ id: 4, taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 }),
    EV({ id: 7, title: 'Уже начался', starts_at: new Date(NOWFIX - 3600e3).toISOString(),
         duration_min: 180, kind: 'donation', price: '0.00', seats: 20, taken: 2, seats_left: 18 }),
    // Кончившееся сервер в афише больше НЕ отдаёт — окно считается по концу
    // события (замер по стволу api 23.10.2026). Строка оставлена нарочно:
    // между ответом сервера и взглядом человека проходит время, и пометку
    // «завершилось» клиент обязан ставить сам. Началось 2,5 часа назад, час.
    EV({ id: 8, title: 'Уже закончился', starts_at: new Date(NOWFIX - 9000e3).toISOString(),
         duration_min: 60, kind: 'free', price: '0.00', seats: 10, taken: 3, seats_left: 7 })
  ];
  const evReply = reply => q => q.url().endsWith('/events') ? reply : undefined;
  /* Сцепка обработчиков: первый, кто ответил не undefined, и отвечает.
     Нужна потому, что случаю теперь нужны ДВА адреса — афиша и места, — а
     `extra` у `open` один. */
  const chainQ = (...hs) => q => {
    for (let i = 0; i < hs.length; i++) { const x = hs[i] ? hs[i](q) : undefined; if (x !== undefined) return x; }
    return undefined;
  };
  /* Места — форма и ЗНАЧЕНИЯ из снимка `places.json` (прогон координатора
     24.10.2026 на стволе api `6332425`, метка sha рядом с каталогом): четыре
     строки, вместимость есть только у зала, у двора и сада `null` — «числа не
     называли», четвёртое место скрытое. Скрытое было и раньше, но выдуманным
     («Склад»): генератор заводил его через psql и удалял ПЕРЕД снимками, и
     до 24.10 артефакта с ним не существовало. Без скрытого места мутация,
     снявшая отбор по `state`, осталась бы зелёной — просачиваться нечему. */
  const PLACE_ROWS = [
    { id: 1, name: 'Зал', capacity: 30, state: 'active' },
    { id: 2, name: 'Сад', capacity: null, state: 'active' },
    { id: 3, name: 'Двор', capacity: null, state: 'active' },
    { id: 4, name: 'Подвал (скрыт)', capacity: null, state: 'hidden' },
    /* Состояние, которого клиент не знает. Сегодня его быть НЕ МОЖЕТ: в схеме
       стоит `CHECK (state IN ('active','hidden'))`, и `check-migrations.sh`
       проверяет, что третье состояние база отвергает (замер мой по стволу api
       `6332425`). Строка здесь не про сегодняшний ответ сервера, а про завтра:
       отбор разрешающим списком и отбор списком запретов на двух известных
       состояниях неразличимы, и без третьего выбор между ними не доказан
       ничем (нашёл архитектор на ревью #53, 23.10.2026). */
    { id: 10, name: 'Чердак', capacity: null, state: 'archived' }
  ];
  const placesReply = rows => q => q.url().endsWith('/places')
    ? json(200, rows === undefined ? PLACE_ROWS : rows) : undefined;
  // Порядок афиши — по времени начала; на главной видны два первых. Считаем
  // из самой фикстуры: имена руками зависели бы от часа запуска.
  const SOON = [...AFISHA].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).map(e => e.title);

  /* Живой экран «Записи»: берутся СВОИ и только предстоящие (Cafe13KPG#360).
     Фикстура своя, а не общая `AFISHA`: нужна строка, на которую человек
     записан И которая уже кончилась — в общей такой нет, а дописать её туда
     значило бы сдвинуть числа соседним случаям. */
  {
    const MOI = [
      EV({ id: 1, title: 'Утро у воды', starts_at: atBkk(0, 10), duration_min: 60, kind: 'free',
           price: '0.00', seats: 6, taken: 6, seats_left: 0, booked_by_me: false }),
      EV({ id: 4, taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 }),
      /* ⚠ ТРИ СВОИ ПРЕДСТОЯЩИЕ, И ДВЕ ИЗ НИХ В ОДИН ДЕНЬ. На одной записи
         раскладка по дням непроверяема: день один, и подлог «под каждым
         заголовком выводить ВСЕ записи» равен верному коду. Нашёл
         arhitector-47 своим подлогом (`mine` вместо фильтра по дню) — он
         прошёл зелёным на прежней фикстуре. Данные обязаны не давать обеим
         ветвям пройти (AGENTS §1, Cafe13KPG#384). */
      EV({ id: 10, title: 'Утро у огня', starts_at: atBkk(1, 10), duration_min: 60,
           kind: 'free', price: '0.00', seats: 8, taken: 1, seats_left: 7,
           booked_by_me: true, my_booking_id: 7 }),
      EV({ id: 11, title: 'Через три дня', starts_at: atBkk(3, 18), duration_min: 90,
           kind: 'donation', price: '0.00', seats: 20, taken: 2, seats_left: 18,
           booked_by_me: true, my_booking_id: 8 }),
      // Чужая запись В МОЙ ЖЕ ДЕНЬ: иначе «в списке только свои» проверяется
      // на дне, которого у меня нет, и ослабевает вместе с раскладкой.
      EV({ id: 12, title: 'Чужое в мой день', starts_at: atBkk(1, 15), duration_min: 60,
           kind: 'free', price: '0.00', seats: 9, taken: 0, seats_left: 9, booked_by_me: false }),
      EV({ id: 9, title: 'Своё, но прошло', starts_at: new Date(NOWFIX - 9000e3).toISOString(),
           duration_min: 60, kind: 'free', price: '0.00', seats: 10, taken: 3, seats_left: 7,
           booked_by_me: true, my_booking_id: 11 })
    ];
    const s = await open(true, true, json(200, OWNER), null, null, null, evReply(json(200, MOI)), null, NOWFIX);
    await s.p.click('#tabs [data-go="bookings"]');
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (!t.includes('Вечер ханга'))
      bad.push('bookings-svoi: своей предстоящей записи на экране нет — человек прочитает, что его не записали (Cafe13KPG#360)');
    if (t.includes('Чужое в мой день'))
      bad.push('bookings-svoi: в списке чужая запись, стоящая в ТОТ ЖЕ день, что своя — фильтр своей записи снят, а день его не прикрывает (Cafe13KPG#384)');
    if (t.includes('Утро у воды'))
      bad.push('bookings-svoi: в списке строка, на которую человек НЕ записан — чужое мероприятие выдано за свою запись (Cafe13KPG#360)');
    if (t.includes('Своё, но прошло'))
      bad.push('bookings-svoi: в «Предстоящих» кончившаяся запись — прошедшего сервер не знает, и место ей не здесь (Cafe13KPG#360)');
    if (t.includes('Вы никуда не записаны'))
      bad.push('bookings-svoi: при живой записи показано пустое состояние (Cafe13KPG#360)');
    /* ⚠ СТРАЖ ПЕРЕВЁРНУТ (было: «день обязан стоять в подстрочнике»).
       Прежнее ожидание пришло из тогдашнего кадра и было законным; кадр
       изменился после замера ОТРИСОВКОЙ: день с мастером в одной серой
       строке занимал две-три строки вместо одной (Cafe13KPG#382, #384).
       Теперь день — в заголовке группы, и в подстрочнике его быть НЕ должно.
       Судится структурно: заголовки групп против подстрочников строк, а не
       по тексту всего экрана — там день найдётся в любом из двух мест. */
    const где = await s.p.evaluate(() => {
      const день = /Сегодня,|Завтра,|\d+ [а-я]+,/;
      return {
        вЗаголовках: [...document.querySelectorAll('#view .group > .label')]
          .map(x => x.textContent).filter(x => день.test(x)),
        вПодстрочниках: [...document.querySelectorAll('#view .listitem .grow .small')]
          .map(x => x.textContent).filter(x => день.test(x)),
        заголовки: [...document.querySelectorAll('#view .group > .label')].map(x => x.textContent)
      };
    });
    /* ⚠ РАСКЛАДКА: под каждым заголовком дня стоят РОВНО его строки. Это и
       есть то, что делает правка, и на одной записи оно непроверяемо —
       подлог «выводить под каждым днём все записи» был бы равен верному
       коду. Фикстура даёт три свои предстоящие: две в один день (завтра) и
       одну через три дня (Cafe13KPG#384, возврат архитектора). */
    const раскладка = await s.p.evaluate(() => [...document.querySelectorAll('#view .group')].map(g => {
      const метка = g.querySelector(':scope > .label');
      return { метка: метка ? метка.textContent : null,
               строки: [...g.querySelectorAll('.listitem .grow > b')].map(b => b.textContent) };
    }));
    const дни = раскладка.filter(g => g.метка !== 'Прошедшие записи');
    if (дни.length !== 2)
      bad.push(`bookings-svoi: групп дней ${дни.length}, а своих предстоящих дней два (${JSON.stringify(дни.map(g => g.метка))}) — записи не разложены по дням (Cafe13KPG#384)`);
    const пара = дни.find(g => g.строки.indexOf('Вечер ханга') !== -1);
    if (!пара) bad.push('bookings-svoi: записи «Вечер ханга» нет ни под одним заголовком дня (Cafe13KPG#384)');
    else {
      if (пара.строки.indexOf('Утро у огня') === -1)
        bad.push(`bookings-svoi: две записи одного дня стоят под разными заголовками — под «${пара.метка}» только ${JSON.stringify(пара.строки)} (Cafe13KPG#384)`);
      if (пара.строки.indexOf('Через три дня') !== -1)
        bad.push(`bookings-svoi: под заголовком «${пара.метка}» стоит запись ДРУГОГО дня — раскладка по дням не работает, под каждым днём выводятся все записи (Cafe13KPG#384)`);
    }
    const все = дни.reduce((a, g) => a.concat(g.строки), []);
    const повтор = все.find((x, i) => все.indexOf(x) !== i);
    if (повтор)
      bad.push(`bookings-svoi: запись «${повтор}» стоит под двумя заголовками дней — она попала в чужой день (Cafe13KPG#384)`);
    if (дни.length === 2 && дни[0].строки.indexOf('Через три дня') !== -1)
      bad.push('bookings-svoi: дальний день стоит ПЕРЕД ближним — заголовки не по времени (Cafe13KPG#384)');
    if (!где.вЗаголовках.length)
      bad.push('bookings-svoi: дня нет в заголовке группы — «когда» отвечено половиной, а группы по дням здесь и есть ответ (кадр E40, Cafe13KPG#384)');
    if (где.вПодстрочниках.length)
      bad.push(`bookings-svoi: день остался в подстрочнике строки («${где.вПодстрочниках[0].slice(0, 40)}») — он переехал в заголовок группы, и в двух местах читался бы дважды (Cafe13KPG#384)`);
    if (где.заголовки.indexOf('Предстоящие') !== -1)
      bad.push('bookings-svoi: заголовок «Предстоящие» вернулся — его работу делают заголовки дней (Cafe13KPG#384)');
    /* Подстрочник БЕЗ статуса: на этом экране каждая строка и есть «вы
       записаны», и статус, верный всегда, не несёт ничего — он был бы шумом
       в единственной серой строке (кадр E40, Cafe13KPG#384). */
    const статусы = await s.p.evaluate(() => [...document.querySelectorAll('#view .listitem .grow .small')]
      .map(x => x.textContent)
      .filter(x => /вы записаны|осталось |мест нет|завершилось/.test(x)));
    if (статусы.length)
      bad.push(`bookings-svoi: в подстрочнике строки статус («${статусы[0].slice(0, 44)}») — на этом экране он верен всегда и не несёт ничего (кадр E40, Cafe13KPG#384)`);
    if (где.заголовки.indexOf('Прошедшие записи') === -1)
      bad.push(`bookings-svoi: второго заголовка «Прошедшие записи» нет (есть: ${JSON.stringify(где.заголовки)}) — без слова «записи» он читается четвёртым днём среди дат (Cafe13KPG#384)`);
    if (!t.includes('Прошедших записей приложение не показывает'))
      bad.push('bookings-svoi: группа «Прошедшие» без честной фразы — пустота читается как «я никуда не ходил» (кадр E40, Cafe13KPG#360)');
    ['Звуковая практика', 'Чайная церемония', 'Утренняя практика', 'Разговорный круг'].forEach(x => {
      if (t.includes(x)) bad.push(`bookings-svoi: демонстрационная строка «${x}» на ЖИВОМ экране — человек прочитает выдумку как свою историю (Cafe13KPG#360)`); });
    // Строка обязана ВЕСТИ: без этого «путей к отмене ноль» выполняется и на
    // экране, где строки мертвы, — то есть отменить запись станет нечем.
    /* ⚠ Ссылку на строку берём ОДИН раз и дальше жмём ЕЁ, а не ищем селектором
       заново. Слепой `page.click` по отсутствующему узлу ждёт 30 с и роняет
       прогон необработанным исключением: красное есть, ОТЧЁТА НЕТ — и мутация
       `ne-v-wired` именно так и умерла, без единого своего отказа. */
    const row = await s.p.$('#view [data-event="4"]');
    if (!row)
      bad.push('bookings-svoi: строка записи никуда не ведёт — отмена живёт в карточке, а попасть в неё нечем (Cafe13KPG#360)');
    if (await s.p.$('#view [data-action^="book-cancel"]'))
      bad.push('bookings-svoi: второй путь к отмене на экране записей — отмена живёт в карточке мероприятия (Cafe13KPG#360)');
    /* ⚠ ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ К УТВЕРЖДЕНИЮ ОТСУТСТВИЯ, НА ТОМ ЖЕ ПРОГОНЕ.
       Пустой селектор сам по себе не доказывает ничего: переименуют действие —
       и проверка выше позеленеет по построению, а второй путь вернётся
       незамеченным. Поэтому ТОТ ЖЕ признак спрашивается там, где крючок и
       живёт — на карточке мероприятия. Его ноль здесь означает «нечем
       спросить», и у него свой текст отказа (условие координатора). */
    if (row) {
      await row.click();
      await s.p.waitForTimeout(150);
      if (!(await s.p.$('[data-action^="book-cancel"]')))
        bad.push('bookings-svoi-kontrol: признак отмены не находит крючок И НА КАРТОЧКЕ мероприятия — значит спрашивать нечем, и «второго пути нет» выше ничего не доказывает (Cafe13KPG#360)');
    } else {
      // Невыполненный контроль — тоже ОТКАЗ со своим текстом, а не тишина:
      // иначе «второго пути нет» выше остаётся утверждением без прибора.
      bad.push('bookings-svoi-kontrol: НЕ ВЫПОЛНЕН — в карточку мероприятия не попасть, строки на экране нет; значит «второго пути к отмене нет» выше ничего не доказывает (Cafe13KPG#360)');
    }
    await s.ctx.close();
  }

  /* Вход на «Записи» МИНУЯ «Клуб»: гостя после входа уводит `go(homeOf())` на
     экран «Услуги», а загрузчик афиши в ствольном условии знал только `home`
     и `events`. Значит для него клик по вкладке «Записи» — единственное, что
     грузит афишу, и без этой строки экран остаётся в «Загружаем афишу…»
     навсегда (Cafe13KPG#360).

     ⚠ ПРЕДУСЛОВИЕ ПРОВЕРЯЕТСЯ ПРИБОРОМ, А НЕ КОММЕНТАРИЕМ. Случай доказывает
     строку, пока гость НЕ начинает с `home`: перенесут его старт туда или
     добавят загрузку афиши на старт — она окажется в памяти до входа на
     экран, и случай перестанет доказывать что-либо МОЛЧА, оставшись зелёным.
     Поэтому «гость начинает не с „Клуба“» стоит здесь отдельным отказом.
     Условие назвал координатор, Cafe13KPG#360. */
  {
    const GOST = clone(OWNER);
    // memberships пуст: на сервере оба поля стоят на одном условии живого членства (/me, LIVE_MEMBERSHIPS_SQL)
    GOST.role = 'guest'; GOST.membership = null; GOST.membership_active = false; GOST.memberships = [];
    /* Фикстура своя, БЕЗ записей: общая `AFISHA` несёт уже записанное
       событие (id 4, `booked_by_me: true`), и на ней экран показал бы строку,
       а не пустое состояние — судить пустоту на фикстуре с записью значит
       проверять не то. Поймано пробой, воспроизводившей условия батареи. */
    const NET_ZAPISEJ = [EV({ id: 1, title: 'Утро у воды', starts_at: atBkk(0, 10),
                              duration_min: 60, kind: 'free', price: '0.00', seats: 6,
                              taken: 0, seats_left: 6, booked_by_me: false })];
    const s = await open(true, true, json(200, GOST), null, null, null, evReply(json(200, NET_ZAPISEJ)), null, NOWFIX);
    const start = await s.view();
    if (start.includes('Баланс'))
      bad.push('bookings-gost: гость начинает с «Клуба» — предусловие случая снято, и он больше не доказывает, что афиша грузится при входе на «Записи» (Cafe13KPG#360)');
    await s.p.click('#tabs [data-go="bookings"]');
    await s.p.waitForTimeout(200);
    const t = await s.view();
    if (t.includes('Загружаем афишу'))
      bad.push('bookings-gost: экран записей застрял на «Загружаем афишу…» — афиша не грузится при входе сюда, а гость попадает на этот экран, минуя «Клуб» (Cafe13KPG#360)');
    if (!t.includes('Вы никуда не записаны'))
      bad.push('bookings-gost: у гостя без записей нет честного пустого состояния — вместо него осталось что-то третье (кадр E40b, Cafe13KPG#360)');
    /* Кнопка ищется ПО НАДПИСИ, а не по `data-go`: адрес — часть того, что
       проверяется, и прибор, выбирающий элемент по адресу, на подложенном
       адресе видит ноль кнопок и говорит «кнопки нет» вместо «ведёт не
       туда». Вес судится отрисованным классом. */
    const пустой = await s.p.$$eval('#view button',
      bs => bs.filter(b => b.textContent.trim() === 'Вся афиша').map(b => b.className));
    if (пустой.length !== 1)
      bad.push(`bookings-gost: кнопок «Вся афиша» на пустом экране ${пустой.length}, ждали одну — других дверей отсюда у гостя нет (кадр E40b, Cafe13KPG#371)`);
    else if (/\bquiet\b/.test(пустой[0]))
      bad.push(`bookings-gost: кнопка афиши в пустом состоянии тихая («${пустой[0]}») — кадр E40b рисует сплошную, и делать здесь больше нечего (Cafe13KPG#371)`);
    await s.ctx.close();
  }

  /* ГОСТЬ С ЗАПИСЬЮ — ЭКРАН НЕ ДОЛЖЕН БЫТЬ ТУПИКОМ. У `guest` вкладки «Клуб»
     нет, а обе кнопки «Вся афиша» живут внутри `home`; пока вход сюда стоял
     в ветке ПУСТОГО состояния, записавшийся гость терял афишу совсем —
     записался и заперся. Нашёл обходом отрисованных входов designer-55,
     перемерено мной на отрисованном экране (Cafe13KPG#371).

     ⚠ ПРЕДУСЛОВИЯ СЛУЧАЯ — ОТКАЗЫ, А НЕ КОММЕНТАРИИ. Появится у гостя вкладка
     «Клуб» — путь к афише будет и без этой кнопки, и случай перестанет
     доказывать что-либо МОЛЧА, оставшись зелёным. Уйдут записи из фикстуры —
     он начнёт судить пустое состояние, у которого свой случай выше. Поэтому
     оба стоят отдельными отказами.

     Фикстура своя: `MOI` объявлена в чужом блоке, а общая `AFISHA` несёт
     вперемешку своё и чужое — здесь нужны ровно записи гостя, и их ДВЕ,
     чтобы кнопка судилась под списком, а не под одной строкой. */
  {
    const GOST = clone(OWNER);
    // memberships пуст: на сервере оба поля стоят на одном условии живого членства (/me, LIVE_MEMBERSHIPS_SQL)
    GOST.role = 'guest'; GOST.membership = null; GOST.membership_active = false; GOST.memberships = [];
    const S_ZAPISYU = [
      EV({ id: 4, taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 }),
      EV({ id: 11, title: 'Через три дня', starts_at: atBkk(3, 18), duration_min: 90,
           kind: 'donation', price: '0.00', seats: 20, taken: 2, seats_left: 18,
           booked_by_me: true, my_booking_id: 8 }),
      EV({ id: 12, title: 'Чужое мероприятие', starts_at: atBkk(1, 15), duration_min: 60,
           kind: 'free', price: '0.00', seats: 9, taken: 0, seats_left: 9, booked_by_me: false })
    ];
    const s = await open(true, true, json(200, GOST), null, null, null, evReply(json(200, S_ZAPISYU)), null, NOWFIX);
    const вкладки = await s.p.$$eval('#tabs [data-go]', b => b.map(x => x.getAttribute('data-go')));
    if (вкладки.indexOf('home') !== -1)
      bad.push(`bookings-gost-zapert: у гостя появилась вкладка «Клуб» (${JSON.stringify(вкладки)}) — предусловие случая снято, и он больше не доказывает, что кнопка здесь единственный выход к афише (Cafe13KPG#371)`);
    await s.p.click('#tabs [data-go="bookings"]');
    await s.p.waitForTimeout(250);
    const t = await s.view();
    if (!t.includes('Вечер ханга'))
      bad.push('bookings-gost-zapert: записей гостя на экране нет — предусловие случая снято, судится пустое состояние, а у него свой случай выше (Cafe13KPG#371)');
    const двери = await s.p.$$eval('#view button',
      bs => bs.filter(b => b.textContent.trim() === 'Вся афиша').map(b => b.className));
    if (!двери.length)
      bad.push('bookings-gost-zapert: гость с записью заперт — с экрана «Записи» в афишу не ведёт ничего, а вкладки «Клуб» у него нет: записался и потерял афишу (Cafe13KPG#371)');
    else if (!/\bquiet\b/.test(двери[0]))
      bad.push(`bookings-gost-zapert: кнопка афиши при живых записях сплошная («${двери[0]}») — посреди списка она забирает экран себе, а главное здесь сами записи (Cafe13KPG#371)`);
    /* Дверь проверяется НАЖАТИЕМ: кнопка, никуда не ведущая, читается как
       путь и потому хуже отсутствия кнопки. Невыполненный контроль — свой
       отказ, а не тишина. */
    if (двери.length) {
      await s.p.locator('#view button', { hasText: 'Вся афиша' }).first().click();
      await s.p.waitForTimeout(250);
      if (!await s.p.$('#view [data-action="seg:все"]'))
        bad.push('bookings-gost-zapert: «Вся афиша» ведёт не на афишу — сегментов дня на экране нет, а гостю этот экран открыт (Cafe13KPG#371)');
    } else {
      bad.push('bookings-gost-zapert-kontrol: НЕ ВЫПОЛНЕН — нажимать нечего, значит «дверь ведёт в афишу» не проверено ничем (Cafe13KPG#371)');
    }
    await s.ctx.close();
  }


  {
    const s = await open(true, true, json(200, OWNER), null, null, null, evReply(json(200, AFISHA)), null, NOWFIX);
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
    // «Место держится 15 минут» отсюда убрано не потому, что перестало быть
    // важным, а потому, что строки больше нет НИГДЕ: запрет на несуществующее
    // не краснеет никогда. Её стережёт теперь свой случай — `demo-oplata`.
    ['Оплатить ', '400.00', 'Запись из приложения пока не включена']
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
    // Запись подключена, но на событие без мест её не предлагают: отказ,
    // полученный после нажатия, человек читает как поломку приложения.
    ['мест нет', 'Мест нет. Если кто-то снимет запись', 'Бесплатно'].forEach(x => {
      if (!f.includes(x)) bad.push(`event-card-free: нет «${x}»`); });
    ['Вы записаны', 'Записаться'].forEach(x => {
      if (f.includes(x)) bad.push(`event-card-free: есть лишнее «${x}»`); });
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('event-card-free: главная кнопка предлагает запись туда, где мест нет');
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
    const s = await open(true, true, json(200, OWNER), null, null, null, evReply(reply), null, NOWFIX);
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
      q => q.url().endsWith('/events') ? (up ? json(200, AFISHA) : json(502, {})) : undefined,
      null, NOWFIX);
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

  // ── запись на событие и отмена своей записи ──
  // Успех признаётся перечитанной афишей, а не кодом 201. Кончившееся и
  // заполненное событие записи не предлагают вовсе: отказ, полученный после
  // нажатия, человек читает как поломку приложения.
  const freeRow = () => EV({ id: 4, taken: 0, seats_left: 12, booked_by_me: null, my_booking_id: null });
  const mineRow = () => EV({ id: 4, taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 });
  // Нажать «Отменить запись» и подтвердить. false — спроса не было: случай
  // уже сказал своё, и продолжать сценарий нечем.
  const confirmCancel = async (s, name) => {
    await s.p.click('[data-action="book-cancel"]');
    await s.p.waitForTimeout(150);
    if (!(await s.p.$('[data-action="book-cancel-yes:4"]'))) {
      bad.push(`${name}: отмена не спросила подтверждения — подтверждать нечего`);
      return false;
    }
    await s.p.click('[data-action="book-cancel-yes:4"]');
    await s.p.waitForTimeout(400);
    return true;
  };

  // Принятый текст Cafe13KPG#271, дословно. Держится ОДНОЙ константой: его
  // сторожат два случая, и разъехаться им нельзя — прежняя редакция уже
  // успела уехать в опись и там смержиться (#323), пока ездила письмами.
  const FRAZA_271 = 'Место закрепляется за вами сразу. Оплата — на месте; снять запись может работник клуба.';

  const openCard = async (handler) => {
    const s = await open(true, true, json(200, OWNER), null, null, null, handler, null, NOWFIX);
    await s.p.evaluate(() => go('events'));
    await s.p.waitForTimeout(120);
    await s.p.click('[data-event="4"]');
    await s.p.waitForTimeout(120);
    return s;
  };

  /* Кнопка, которая не делает НИЧЕГО, — дефект (Cafe13KPG#338), и ловиться он
     обязан прибором: «Отменить запись» на экране записей нашлась у меня попутно,
     когда я искал другое, и лежала там не один день.

     Приговор выносит ОТРИСОВАННЫЙ экран, а не поиск по исходнику, и причина не
     в строгости: делегирование читает `closest(…)`, то есть атрибут бывает на
     ОБЁРТКЕ. Поиск по тексту ошибается в обе стороны — называет живые (атрибут
     на обёртке; `#back` со своим слушателем) и молчит о тех, кого на экране нет
     вовсе (пункт услуг рисуется из `DATA.services`, а они пусты с #69).

     Селектор берётся ИЗ САМОГО обработчика: тринадцать атрибутов, переписанные
     сюда руками, разойдутся с кодом молча — и разойдутся в сторону зелёного.

     Экран кассы не моя зона: его четыре кнопки перечислены и переданы владельцу
     зоны, поэтому стоят ИМЕНОВАННЫМ исключением. Исключение по ИМЕНИ, а не по
     экрану: новая мёртвая кнопка на кассе покраснеет. И оно обязано истечь —
     если названной кнопки больше нет, случай требует убрать строку.

     Кнопки кассы ожили (#77), список исключений пуст — и положительного
     контроля он больше не держит. Его держит ЗОНД: на экране ZOND_EKRAN,
     внутри того же шага обхода (после роли и go(), перед съёмом), в #view
     кладётся кнопка без атрибутов и слушателя, и ТОТ ЖЕ вызов детектора
     обязан назвать её ровно один раз. Не найдена — значит не сработал обход,
     роль, реестр или детектор, и зелёное ничего не значит. Зонд снимается в
     том же шаге и в отказы не попадает. */
  {
    const m = src.match(/closest\('(\[data-[^']+)'\)/);
    if (!m) bad.push('knopki-bez-dela: селектор делегирования в app.js не найден — признак строить не из чего');
    else {
      const SEL = m[1];
      const IZVESTNYE = new Map([]);
      const ZOND = 'zond-338-knopka', ZOND_ROL = 'member', ZOND_EKRAN = 'home';
      const mertvye = (sel) => s.p.evaluate((sel) => {
        const out = [];
        document.querySelectorAll('#view button, #tabs button').forEach(b => {
          if (b.closest(sel) || b.onclick || b.disabled || b.id) return;
          out.push((b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40));
        });
        return out;
      }, sel);
      let zond = null;
      const s = await open(false, true, json(200, OWNER), null, null, null, null, null, NOWFIX);
      const imena = await s.p.evaluate(() => Object.keys(window.SCREENS || {}));
      if (imena.length < 20)
        bad.push(`knopki-bez-dela: реестр экранов дал ${imena.length} имён — прибор смотрит не туда`);
      const vidal = new Set();
      for (const rol of ['guest', 'member', 'organizer', 'partner', 'staff', 'curator']) {
        for (const im of imena) {
          await s.p.evaluate(([r, n]) => { DATA.role = r; go(n); }, [rol, im]);
          await s.p.waitForTimeout(20);
          const tek = await s.p.evaluate(() => current);
          const zdes = rol === ZOND_ROL && im === ZOND_EKRAN && tek === ZOND_EKRAN;
          if (zdes) await s.p.evaluate((z) => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = z;
            document.getElementById('view').appendChild(b);
          }, ZOND);
          const mert = await mertvye(SEL);
          if (zdes) {
            zond = mert.filter(t => t === ZOND).length;
            await s.p.evaluate((z) => document.querySelectorAll('#view button').forEach(b => { if (b.textContent === z) b.remove(); }), ZOND);
          }
          mert.filter(t => t !== ZOND).forEach(t => vidal.add(tek + ' | ' + t));
        }
      }
      vidal.forEach(k => {
        if (IZVESTNYE.has(k)) return;
        const [ekran, tekst] = k.split(' | ');
        bad.push(`knopki-bez-dela: кнопка «${tekst}» на экране «${ekran}» не делает НИЧЕГО — ни атрибута делегирования на ней или обёртке, ни своего слушателя (Cafe13KPG#338)`);
      });
      // Положительный контроль и срок годности исключения разом: названная
      // кнопка обязана находиться. Не находится — либо она починена (убрать
      // строку), либо прибор ослеп, и тогда зелёное ничего не значит.
      IZVESTNYE.forEach((pochemu, k) => {
        if (!vidal.has(k))
          bad.push(`knopki-bez-dela: исключение «${k}» (${pochemu}) БОЛЬШЕ НЕ НАХОДИТСЯ — либо кнопка ожила и строку надо убрать, либо прибор перестал видеть`);
      });
      if (zond !== 1)
        bad.push(`knopki-bez-dela: ПРОВЕРКА НЕ ВЫПОЛНЕНА — зонд на «${ZOND_EKRAN}» (${ZOND_ROL}) назван ${zond === null ? 'не был: обход до экрана не дошёл' : zond + ' раз(а), ждали 1'} — обход, роль, реестр или детектор ослепли, зелёное ничего не значит`);
      if (s.errs.length) bad.push('knopki-bez-dela: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }
  }

  /* Текст принят командой ДОСЛОВНО, поэтому и сторожится целиком, а не по
     словам: «почти тот же смысл» здесь не годится — редакция уже менялась за
     один день, и прежняя успела уехать в опись. И вторая половина случая —
     КОМУ фраза не даётся: «Оплата — на месте» у бесплатного обещает платёж,
     которого нет, а у донейшна своя строка точнее. Без этой половины случай
     подтверждал бы наличие и молчал бы о лишнем. */
  {
    const ROWS = [
      EV({ id: 4 }),
      EV({ id: 10, title: 'Утро без денег', kind: 'free', price: '0.00',
           seats: 8, taken: 1, seats_left: 7 }),
      EV({ id: 11, title: 'Круг по желанию', kind: 'donation', price: '0.00',
           seats: 9, taken: 2, seats_left: 7 })
    ];
    const s = await open(true, true, json(200, OWNER), null, null, null,
                         evReply(json(200, ROWS)), null, NOWFIX);
    for (const [id, kind, zhdyom] of [[4, 'paid', true], [10, 'free', false], [11, 'donation', false]]) {
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      await s.p.click(`[data-event="${id}"]`);
      await s.p.waitForTimeout(120);
      const t = await s.view();
      const est = t.includes(FRAZA_271);
      if (zhdyom && !est)
        bad.push(`mesto-srazu: у платного нет принятой строки целиком: «${t.slice(0, 220)}»`);
      if (!zhdyom && est)
        bad.push(`mesto-srazu: строка про оплату на месте дана виду «${kind}» — платежа там нет вовсе`);
      // Про деньги при снятии не сказано НИЧЕГО, и это решение, а не недоделка:
      // ответа про возврат нет ни на сервере, ни у владельца (Cafe13KPG#290).
      if (/верн[её]м|возврат|перенесём|компенсац/i.test(t))
        bad.push(`mesto-dengi: экран вида «${kind}» обещает что-то про деньги при снятии — механизма такого нет`);
    }
    if (s.errs.length) bad.push('mesto-srazu: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-mesto-srazu.png`, fullPage: true });
    await s.ctx.close();
  }

  {
    let booked = false;
    const posts = [];
    const s = await openCard(q => {
      const u = q.url();
      if (u.endsWith('/bookings')) { posts.push(q.postData()); booked = true;
        return json(201, { id: 6, event_id: 4, state: 'booked', amount_due: '400.00' }); }
      if (/\/bookings\/\d+\/cancel$/.test(u)) { booked = false; return json(200, { id: 6, state: 'cancelled' }); }
      if (u.endsWith('/events')) return json(200, [booked ? mineRow() : freeRow()]);
      return undefined;
    });
    const card = await s.view();
    if (!card.includes('Записаться')) bad.push('book: на свободном событии не предлагают записаться');
    if (!card.includes('Оплата — на месте')) bad.push('book: у платного не сказано, что деньги берут на месте');
    if (!card.includes('При записи со счёта не списывается')) bad.push('book: не сказано, что со счёта при записи не спишут');
    // Цена названа строкой «Участие», а не подписью: дубль цены на одном экране
    // читается как два разных платежа.
    if (!card.includes('Участие')) bad.push('book: цена не названа строкой «Участие»');
    const cen = (card.match(/400 ฿/g) || []).length;
    // Форма отказа без согласования числа: «2 раз» читается как опечатка и
    // отвлекает от предмета, а отказ читают один раз — в минуту покраснения.
    if (cen !== 1) bad.push(`book: цена «400 ฿» встречается на экране ${cen} — ждали 1`);
    if (await s.p.evaluate(() => window.__main === null)) bad.push('book: на свободном событии нет главной кнопки');

    // Внутри Telegram экранная кнопка скрыта (body.has-main .dup-main), работает главная.
    await s.p.evaluate(() => window.__main());
    await s.p.waitForTimeout(400);
    const t = await s.view();
    if (posts.length !== 1) bad.push(`book: POST /bookings ушёл ${posts.length} раз, ждали 1`);
    if (posts[0] !== '{"event_id":4}') bad.push(`book: тело запроса «${posts[0]}», ждали {"event_id":4} числом`);
    if (!t.includes('Вы записаны')) bad.push('book: после записи нет «Вы записаны»');
    if (t.includes('Не получилось')) bad.push('book: удачная запись показана отказом: «' +
      t.slice(t.indexOf('Не получилось'), t.indexOf('Не получилось') + 90) + '»');
    if (t.includes('Записаться')) bad.push('book: после записи всё ещё предлагают записаться');
    const reread = s.calls.filter(c => c.url.endsWith('/events')).length;
    if (reread !== 2) bad.push(`book: запросов к /events ${reread}, ждали 2 (загрузка и перечитывание)`);
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('book: главная кнопка осталась на уже записанном событии');
    await s.p.screenshot({ path: `${OUT}/live-book-done.png` });

    // Номер записи пришёл — отмена предлагается.
    if (!(await s.p.$('[data-action="book-cancel"]'))) bad.push('book: номер записи пришёл, а кнопки отмены нет');

    // Отмена спрашивает: место уходит другому и может не вернуться.
    await s.p.click('[data-action="book-cancel"]');
    await s.p.waitForTimeout(150);
    const ask = await s.view();
    const asked = ask.includes('Отменить запись?');
    if (!asked) bad.push('cancel: отмена не спросила подтверждения, а ' +
      (s.calls.some(x => /\/cancel$/.test(x.url)) ? 'сразу ушла на сервер' : 'ничего не показала'));
    if (!ask.includes('Место вернётся в афишу')) bad.push('cancel: не сказано, чем отмена кончится');
    await s.p.screenshot({ path: `${OUT}/live-cancel-ask.png` });
    if (asked) {

    // Передумал — запись на месте, к серверу не ходили.
    await s.p.click('[data-action="book-cancel-no"]');
    await s.p.waitForTimeout(150);
    const kept = await s.view();
    if (!kept.includes('Вы записаны') || kept.includes('Отменить запись?')) bad.push('cancel: «оставить запись» не вернуло карточку');
    if (s.calls.filter(x => /\/cancel$/.test(x.url)).length) bad.push('cancel: отказ от отмены сходил на сервер');

    await s.p.click('[data-action="book-cancel"]');
    await s.p.waitForTimeout(150);
    await s.p.click('[data-action="book-cancel-yes:4"]');
    await s.p.waitForTimeout(400);
    const c = await s.view();
    if (c.includes('Вы записаны')) bad.push('cancel: после отмены запись осталась на карточке');
    if (!c.includes('Записаться')) bad.push('cancel: после отмены записаться снова нельзя');
    // Удачная отмена не кончается экраном отказа: «Не получилось» на этом шаге
    // значит, что успех разбирается не тем условием.
    if (c.includes('Не получилось')) bad.push('cancel: удачная отмена показана отказом: «' +
      c.slice(c.indexOf('Не получилось'), c.indexOf('Не получилось') + 90) + '»');
    const cancels = s.calls.filter(x => /\/bookings\/6\/cancel$/.test(x.url));
    if (cancels.length !== 1) bad.push(`cancel: запросов отмены ${cancels.length}, ждали 1`);
    if (s.calls.filter(x => x.url.endsWith('/events')).length !== 3) bad.push('cancel: афиша после отмены не перечитана');
    await s.p.screenshot({ path: `${OUT}/live-cancel-done.png` });
    }
    if (s.errs.length) bad.push('book: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // Отказ сервера — его текстом, а не «успешно». Афиша перечитывается и
  // после отказа: «мест нет» могло прийти потому, что экран устарел.
  {
    const s = await openCard(q => {
      if (q.url().endsWith('/bookings')) return json(409, { detail: 'мест нет' });
      if (q.url().endsWith('/events')) return json(200, [freeRow()]);
      return undefined;
    });
    await s.p.evaluate(() => window.__main());
    await s.p.waitForTimeout(400);
    const t = await s.view();
    if (!t.includes('Мест нет')) bad.push('book-409: текста отказа сервера на экране нет');
    if (t.includes('Вы записаны')) bad.push('book-409: отказ показан записью');
    if (s.calls.filter(c => c.url.endsWith('/events')).length !== 2) bad.push('book-409: афиша после отказа не перечитана');
    await s.p.screenshot({ path: `${OUT}/live-book-409.png` });
    await s.ctx.close();
  }

  // 201 есть, а в афише записи нет — это не успех.
  {
    const s = await openCard(q => {
      if (q.url().endsWith('/bookings')) return json(201, { id: 6, event_id: 4, state: 'booked', amount_due: '400.00' });
      if (q.url().endsWith('/events')) return json(200, [freeRow()]);
      return undefined;
    });
    await s.p.evaluate(() => window.__main());
    await s.p.waitForTimeout(400);
    const t = await s.view();
    if (!t.includes('Сервер принял, а в афише этого нет')) bad.push('book-201-pusto: 201 без подтверждения афишей показан успехом');
    if (t.includes('Вы записаны')) bad.push('book-201-pusto: показана запись, которой в афише нет');
    await s.ctx.close();
  }

  // До записи карточка не обещает отмены НИ ОДНИМ словом — ни у платного,
  // ни у бесплатного, ни у донейшна. Обещание, данное до нажатия, человек
  // прочитает как право, которого у него сегодня нет: отменять нечем.
  for (const [kind, price] of [['paid', '400.00'], ['free', '0.00'], ['donation', '0.00']]) {
    const s = await openCard(q => q.url().endsWith('/events')
      ? json(200, [EV({ id: 4, kind: kind, price: price, taken: 0, seats_left: 12, booked_by_me: null, my_booking_id: null })])
      : undefined);
    const t = await s.view();
    if (!t.includes('Записаться')) bad.push(`book-do-zapisi-${kind}: записаться не предлагают`);
    const found = t.match(/[^.!?]*отмен[^.!?]*/i);
    if (found) bad.push(`book-do-zapisi-${kind}: до записи обещана отмена — «${found[0].trim()}»`);
    if (s.errs.length) bad.push(`book-do-zapisi-${kind}: ошибки страницы ${s.errs.join('; ')}`);
    await s.ctx.close();
  }

  // Поздний ответ афиши, начатой ДО записи, не возвращает карточку в «Записаться».
  // Без охраны по поколению второе нажатие получило бы 409 «вы уже записаны».
  {
    let n = 0, booked = false;
    // Различитель: без него код 0 несёт ТРИ смысла — «гард сработал»,
    // «поздний ответ пришёл раньше перечитывания» и «не пришёл вовсе за
    // отведённое ожидание». Два последних гард не проверяют вообще.
    const mark = { late: 0, reread: 0 };
    const s = await openCard(q => {
      const u = q.url();
      if (u.endsWith('/bookings')) { booked = true;
        return json(201, { id: 6, event_id: 4, state: 'booked', amount_due: '400.00' }); }
      if (u.endsWith('/events')) {
        n += 1;
        const body = json(200, [booked ? mineRow() : freeRow()]);
        if (n === 3) mark.reread = Date.now();     // афишу перечитала запись
        // второй запрос — начатый до записи и отвечающий уже после неё
        return n === 2
          ? new Promise(r => setTimeout(() => { mark.late = Date.now(); r(body); }, 1500))
          : body;
      }
      return undefined;
    });
    await s.p.evaluate(() => loadEvents());          // медленный запрос в пути
    await s.p.waitForTimeout(100);
    await s.p.evaluate(() => window.__main());       // запись уходит и перечитывает афишу
    await s.p.waitForTimeout(2200);                  // поздний ответ успевает прийти
    const t = await s.view();
    if (!mark.late) bad.push('book-pozdniy-otvet: поздний ответ прежней афиши не пришёл за отведённое ожидание — гард не проверен');
    else if (!mark.reread) bad.push('book-pozdniy-otvet: запись афишу не перечитывала — гонке неоткуда взяться');
    else if (mark.late < mark.reread) bad.push(`book-pozdniy-otvet: гонки не было — прежняя афиша ответила за ${mark.reread - mark.late} мс ДО перечитывания записью, случай гард не проверяет`);
    if (!t.includes('Вы записаны')) bad.push('book-pozdniy-otvet: запись пропала с карточки');
    if (t.includes('Записаться')) bad.push('book-pozdniy-otvet: поздний ответ прежней афиши вернул карточку в «Записаться»');
    if (s.errs.length) bad.push('book-pozdniy-otvet: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // У кончившегося события отмены нет: сервер её примет и сотрёт сам факт
  // записи, а подтверждение обещало бы вернуть место в афишу — ложно.
  {
    const doneRow = () => EV({ id: 4, title: 'Уже закончился',
      starts_at: new Date(NOWFIX - 9000e3).toISOString(), duration_min: 60,
      taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 });
    const s = await openCard(q => q.url().endsWith('/events') ? json(200, [doneRow()]) : undefined);
    const t = await s.view();
    if (!t.includes('Вы записаны')) bad.push('cancel-konchilos: запись не показана');
    if (!t.includes('завершилось')) bad.push('cancel-konchilos: событие не помечено завершившимся');
    if (t.includes('Отмен') || t.includes('отмен')) bad.push('cancel-konchilos: у кончившегося события предложена отмена — «' +
      t.slice(Math.max(0, t.search(/[Оо]тмен/) - 20), t.search(/[Оо]тмен/) + 70) + '»');
    if (await s.p.$('[data-action="book-cancel"]')) bad.push('cancel-konchilos: кнопка отмены у кончившегося события');
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('cancel-konchilos: главная кнопка у кончившегося события');
    await s.p.screenshot({ path: `${OUT}/live-cancel-konchilos.png` });
    await s.ctx.close();
  }

  // У ИДУЩЕГО события отмена остаётся: место ещё можно отдать тому, кто придёт
  // (решение названо словами в `bookBlock`, единственное условие — `e.done`).
  // Это парное РАЗРЕШЕНИЕ к запрету выше, и без своего случая ошибка
  // «перестали предлагать отмену на идущем» прошла бы зелёной: запрет закрыт,
  // разрешение — нет. Первая проверка здесь сторожит саму фикстуру: событие
  // обязано ИДТИ, иначе случай судит кончившееся и доказывает запрет второй раз.
  {
    const START = NOWFIX - 1800e3, DUR = 180, ENDS = START + DUR * 60e3;
    const liveRow = () => EV({ id: 4, title: 'Уже начался',
      starts_at: new Date(START).toISOString(), duration_min: DUR,
      taken: 1, seats_left: 11, booked_by_me: true, my_booking_id: 6 });
    // Сторож фикстуры считает «идёт» ИЗ САМОЙ ФИКСТУРЫ — её начала, длительности
    // и мгновения прогона, — а НЕ из того, что нарисовал клиент. Иначе поломка
    // клиентского расчёта краснеет словами «фикстура не та», и чинить пойдут
    // фикстуру (увидел архитектор на мутации `done` от начала, 22.10.2026).
    if (!(NOWFIX >= START && NOWFIX < ENDS))
      bad.push(`cancel-idet: фикстура не идёт по своим числам — начало ${new Date(START).toISOString()}, конец ${new Date(ENDS).toISOString()}, мгновение прогона ${new Date(NOWFIX).toISOString()}`);
    const s = await openCard(q => q.url().endsWith('/events') ? json(200, [liveRow()]) : undefined);
    const t = await s.view();
    if (!t.includes('идёт')) bad.push('cancel-idet: идущее событие не помечено идущим — расчёт клиента, а не фикстура');
    if (t.includes('завершилось')) bad.push('cancel-idet: идущее событие помечено завершившимся');
    if (!t.includes('Вы записаны')) bad.push('cancel-idet: запись не показана');
    if (!(await s.p.$('[data-action="book-cancel"]'))) bad.push('cancel-idet: у идущего события кнопки отмены нет — своё место не снять');
    if (s.errs.length) bad.push('cancel-idet: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-cancel-idet.png` });
    await s.ctx.close();
  }

  /* Демонстрация платного мероприятия обещала механизм, которого НЕТ:
     «место держится 15 минут, пока идёт оплата» и кнопку «Оплатить … и
     записаться». В `bookings` нет ни срока, ни фонового снятия (замер по
     стволу api 24.10.2026) — место держится вечно, а оплата идёт на месте.
     Живой экран этого никогда не обещал, демонстрация обещала; по ней же
     снят кадр описи, то есть врали мы там, где по продукту судят.

     Случай сторожит ОБЕ стороны: прежние слова не вернулись, и демонстрация
     говорит ровно то, что живой экран. Сторож фикстуры считает из самой
     демонстрации: событие обязано быть платным, иначе ветка не та. */
  {
    const s = await open(true, false, json(200, OWNER), null, null, null, null, null, NOWFIX);
    const kind = await s.p.evaluate(() => {
      const e = (window.DATA && DATA.events || []).filter(x => x.id === 'sound')[0];
      return e ? e.kind : null;
    });
    await s.p.evaluate(() => go('event', 'sound'));
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (kind !== 'paid') {
      // Сторож говорит ОДИН: у бесплатной ветки подписи про оплату нет по
      // праву, и выносить ей вердикт «в демонстрации нет „К оплате“» значило
      // бы краснеть словами экрана о поломке фикстуры. Чинить пошли бы
      // экран (тот же дефект архитектор нашёл у меня на #50).
      bad.push(`demo-oplata: демонстрационное событие «sound» имеет вид «${kind}», а случай судит ПЛАТНОЕ — ветка не та, вердикт не выносится`);
    } else {
      ['Записаться', 'Участие', 'на месте', FRAZA_271].forEach(x => {
        if (!t.includes(x)) bad.push(`demo-oplata: в демонстрации нет «${x}» — она должна говорить то же, что живой экран`); });
      ['15 минут', 'возвращается в афишу', 'Оплатить 400'].forEach(x => {
        if (t.includes(x)) bad.push(`demo-oplata: демонстрация обещает «${x}» — механизма с таким поведением в системе нет`); });
    }
    if (s.errs.length) bad.push('demo-oplata: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-demo-oplata.png` });
    await s.ctx.close();
  }

  /* Место на карточке (#104). Имя приходит полем самого мероприятия, и
     отсутствие места — ОТСУТСТВИЕ строки, а не слово «не указано»: правки
     места на сервере нет, обещать её нечем. Три случая: место есть, места
     нет, пришла половина места. */
  {
    const s = await openCard(q => q.url().endsWith('/events')
      ? json(200, [EV({ id: 4, place_id: 1, place_name: 'Зал', taken: 1, seats_left: 11 })]) : undefined);
    const t = await s.view();
    if (!t.includes('Где')) bad.push('place-kartochka: на карточке нет подписи «Где»');
    if (!t.includes('Зал')) bad.push('place-kartochka: имени места на карточке нет — место пришло, а человек его не видит');
    if (s.errs.length) bad.push('place-kartochka: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-place-kartochka.png` });
    await s.ctx.close();
  }
  {
    const s = await openCard(q => q.url().endsWith('/events')
      ? json(200, [EV({ id: 4, place_id: null, place_name: null, taken: 1, seats_left: 11 })]) : undefined);
    const t = await s.view();
    // Сторож случая: карточка обязана отрисоваться. Иначе «строки „Где“ нет»
    // верно и на пустом экране, и случай доказывал бы поломку, а не запрет.
    if (!t.includes('Ведёт')) bad.push('place-net: карточка не отрисовалась — сравнивать нечего, остальные проверки слепы');
    if (t.includes('Где')) bad.push('place-net: у мероприятия без места нарисована строка «Где»');
    if (t.includes('не указано')) bad.push('place-net: пустое место названо словами «не указано» — это обещание правки, которой нет');
    if (s.errs.length) bad.push('place-net: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-place-net.png` });
    await s.ctx.close();
  }
  {
    // Половина места — номер без имени. Афиша отказывается ЦЕЛИКОМ: строка с
    // выдуманным местом отправила бы человека не туда ногами.
    const s = await open(true, true, json(200, OWNER), null, null, null,
      evReply(json(200, [EV({ id: 4, title: 'Половина места', place_id: 1, place_name: null })])), null, NOWFIX);
    await s.p.evaluate(() => go('events'));
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (t.includes('Половина места')) bad.push('place-polovina: афиша показала мероприятие с номером места без имени — порченая строка прошла');
    if (!t.includes('Ответ сервера не разобран')) bad.push(`place-polovina: отказа на экране нет, видно «${t.slice(0, 120)}»`);
    if (s.errs.length) bad.push('place-polovina: ошибки страницы ' + s.errs.join('; '));
    await s.p.screenshot({ path: `${OUT}/live-place-polovina.png` });
    await s.ctx.close();
  }

  // Отказ на отмену — словами сервера, а не «успешно».
  {
    const s = await openCard(q => {
      const u = q.url();
      if (/\/cancel$/.test(u)) return json(409, { detail: 'мероприятие отменено' });
      if (u.endsWith('/events')) return json(200, [mineRow()]);
      return undefined;
    });
    if (await confirmCancel(s, 'cancel-409')) {
    const t = await s.view();
    if (!t.includes('Мероприятие отменено')) bad.push('cancel-409: текста отказа сервера на экране нет');
    if (!t.includes('Вы записаны')) bad.push('cancel-409: запись пропала с карточки, хотя отмена не прошла');
    await s.p.screenshot({ path: `${OUT}/live-cancel-409.png` });
    }
    await s.ctx.close();
  }

  // 200 есть, а запись в афише осталась — это не отмена. Дыру нашла мутация
  // «успех по коду», которая на прежнем наборе случаев оставалась зелёной.
  {
    const s = await openCard(q => {
      const u = q.url();
      if (/\/cancel$/.test(u)) return json(200, { id: 6, state: 'cancelled' });
      if (u.endsWith('/events')) return json(200, [mineRow()]);     // сервер отвечает «отменено», афиша говорит обратное
      return undefined;
    });
    if (await confirmCancel(s, 'cancel-200-pusto')) {
    const t = await s.view();
    if (!t.includes('Сервер принял, а в афише этого нет')) bad.push('cancel-200-pusto: 200 без подтверждения афишей показан отменой');
    if (!t.includes('Вы записаны')) bad.push('cancel-200-pusto: запись пропала с карточки, хотя афиша её показывает');
    await s.p.screenshot({ path: `${OUT}/live-cancel-200-pusto.png` });
    }
    await s.ctx.close();
  }

  // Второе нажатие, пока первое в пути, второй отмены не делает.
  {
    const s = await openCard(q => {
      const u = q.url();
      if (/\/cancel$/.test(u)) return new Promise(r => setTimeout(() => r(json(200, { id: 6, state: 'cancelled' })), 800));
      if (u.endsWith('/events')) return json(200, [mineRow()]);
      return undefined;
    });
    await s.p.click('[data-action="book-cancel"]');
    await s.p.waitForTimeout(150);
    if (await s.p.$('[data-action="book-cancel-yes:4"]')) {
      await s.p.click('[data-action="book-cancel-yes:4"]');
      await s.p.evaluate(() => doAction('book-cancel-yes:4'));
    } else {
      bad.push('cancel-dvazhdy: отмена не спросила подтверждения — подтверждать нечего');
      await s.p.evaluate(() => doAction('book-cancel-yes:4'));
    }
    await s.p.waitForTimeout(1200);
    const n = s.calls.filter(x => /\/cancel$/.test(x.url)).length;
    if (n !== 1) bad.push(`cancel-dvazhdy: запросов отмены ${n}, ждали 1`);
    await s.ctx.close();
  }

  // Боевая форма ответа: поля my_booking_id в ней нет вовсе. Карточка обязана
  // работать так же — запись видна, отмена не предлагается, ошибок страницы нет.
  {
    const noId = () => { const r = mineRow(); delete r.my_booking_id; return r; };
    const s = await openCard(q => q.url().endsWith('/events') ? json(200, [noId()]) : undefined);
    const t = await s.view();
    if (!t.includes('Вы записаны')) bad.push('book-boevaya-forma: запись не показана на боевой форме ответа');
    if (!t.includes('Отменить запись из приложения пока нельзя')) bad.push('book-boevaya-forma: нет прямой строки о том, что отменить нечем');
    if (await s.p.$('[data-action="book-cancel"]')) bad.push('book-boevaya-forma: кнопка отмены есть, а номера записи нет');
    if (await s.p.evaluate(() => window.__main !== null)) bad.push('book-boevaya-forma: главная кнопка на уже записанном событии');
    if (s.errs.length) bad.push('book-boevaya-forma: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // Кончившемуся и заполненному событию записи не предлагают вовсе.
  for (const [name, row, has, hasnt] of [
    ['book-konchilos', EV({ id: 4, title: 'Уже закончился', starts_at: new Date(NOWFIX - 9000e3).toISOString(),
                            duration_min: 60, seats_left: 9, taken: 1 }),
      ['завершилось'], ['Записаться', FRAZA_271]],
    ['book-mest-net', EV({ id: 4, taken: 12, seats_left: 0 }),
      ['Мест нет'], ['Записаться', FRAZA_271]]]) {
    const s = await openCard(q => q.url().endsWith('/events') ? json(200, [row]) : undefined);
    const t = await s.view();
    has.forEach(x => { if (!t.includes(x)) bad.push(`${name}: нет «${x}»`); });
    hasnt.forEach(x => { if (t.includes(x)) bad.push(`${name}: есть лишнее «${x}»`); });
    if (await s.p.evaluate(() => window.__main !== null)) bad.push(`${name}: главная кнопка предлагает запись`);
    await s.p.screenshot({ path: `${OUT}/live-${name}.png` });
    await s.ctx.close();
  }

  // ── управление своим мероприятием (#98): видно ТОЛЬКО ведущему ──
  // Чужое событие в фикстуре стоит ПОСЛЕ своего: иначе снятый фильтр «своё»
  // остался бы зелёным — первая карточка и так своя.
  {
    const MINE = over => EV(Object.assign({ id: 4, title: 'Мой вечер', organizer_id: 1,
      starts_at: atBkk(1, 19), seats: 12, taken: 3, seats_left: 9 }, over || {}));
    const FOREIGN = EV({ id: 7, title: 'Чужой вечер', organizer_id: 500, starts_at: atBkk(1, 20) });
    const pair = (over) => json(200, [MINE(over), FOREIGN]);
    const openMine = (handler) => openCard(handler);

    /* Сначала признак, потом сценарий: если кнопки отмены нет или спрос не
       показан, случай говорит об этом своими словами, а не умирает кликом в
       пустоту. Мутация, снявшая спрос, должна краснеть текстом, а не таймаутом. */
    const askEventCancel = async (s, name) => {
      if (!(await s.p.$('[data-action="event-cancel"]'))) {
        bad.push(`${name}: кнопки «Отменить мероприятие» нет — нажимать нечего`);
        return false;
      }
      await s.p.click('[data-action="event-cancel"]');
      await s.p.waitForTimeout(150);
      if (!(await s.p.$('[data-action="event-cancel-yes:4"]'))) {
        bad.push(`${name}: отмена не спросила подтверждения — подтверждать нечего`);
        return false;
      }
      return true;
    };

    // Своё: управление есть, счёт записавшихся есть, РАЗДАЧИ ПРАВ НЕТ.
    {
      const s = await openMine(q => q.url().endsWith('/events') ? pair() : undefined);
      const t = await s.view();
      ['Управление', 'Записалось', '3 из 12'].forEach(x => {
        if (!t.includes(x)) bad.push(`manage: нет «${x}»`); });
      if (!(await s.p.$('[data-action="event-cancel"]'))) bad.push('manage: нет кнопки отмены мероприятия');
      // Ведущий — администратор своего события, а не куратор клуба.
      ['Люди и роли', 'Роли', 'Выдать право', 'Пригласить'].forEach(x => {
        if (t.includes(x)) bad.push(`manage: у ведущего появилась раздача прав — «${x}»`); });
      // Списка записавшихся нет: ручки на бою нет, пустой список выглядел бы ответом.
      ['Кто записался', 'Записавшиеся', 'Список записавшихся'].forEach(x => {
        if (t.includes(x)) bad.push(`manage: показан список записавшихся, которого сервер не отдаёт — «${x}»`); });
      await s.p.screenshot({ path: `${OUT}/live-manage.png` });
      await s.ctx.close();
    }

    // Чужое: управления нет вовсе.
    {
      const s = await open(true, true, json(200, OWNER), null, null, null,
        q => q.url().endsWith('/events') ? pair() : undefined, null, NOWFIX);
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      await s.p.click('[data-event="7"]');
      await s.p.waitForTimeout(120);
      const t = await s.view();
      if (t.includes('Управление')) bad.push('manage-chuzhoy: управление показано на ЧУЖОМ мероприятии');
      if (await s.p.$('[data-action="event-cancel"]')) bad.push('manage-chuzhoy: на чужом мероприятии предложена отмена');
      await s.ctx.close();
    }

    // Кончившееся своё: счёт виден, отмены нет — она стёрла бы записи бывших.
    {
      const s = await openMine(q => q.url().endsWith('/events')
        ? json(200, [MINE({ starts_at: new Date(NOWFIX - 9000e3).toISOString(), duration_min: 60 }), FOREIGN])
        : undefined);
      const t = await s.view();
      if (!t.includes('Управление')) bad.push('manage-konchilos: управления нет у своего кончившегося');
      if (!t.includes('отменить его уже нельзя')) bad.push('manage-konchilos: не сказано, почему отмены нет');
      if (await s.p.$('[data-action="event-cancel"]')) bad.push('manage-konchilos: у кончившегося предложена отмена');
      await s.ctx.close();
    }

    // Удачная отмена: спрос, один запрос, успех — по перечитанной афише.
    {
      const posts = [];
      let gone = false;
      const s = await openMine(q => {
        const u = q.url();
        if (/\/events\/4\/cancel$/.test(u)) { posts.push(q.postData() || ''); gone = true;
          return json(200, { id: 4, state: 'cancelled', bookings_cancelled: 3 }); }
        if (u.endsWith('/events')) return gone ? json(200, [FOREIGN]) : pair();
        return undefined;
      });
      const ok = await askEventCancel(s, 'manage-otmena');
      const ask = await s.view();
      if (ok && !ask.includes('Отменить мероприятие?')) bad.push('manage-otmena: спрос есть, а вопроса на экране нет');
      if (ok && !ask.includes('Записи всех, кто записался, будут сняты')) bad.push('manage-otmena: не сказано, чем отмена кончится для людей');
      /* Текст подтверждения принят командой и лежит АДРЕСОМ — кадр
         `E37d-event-cancel-ask.dc.html` на `Cafe13KPG` dev `8f4dc54`
         (Cafe13KPG#359). Каждая часть судится своим признаком и своим
         отказом: мутация, снимающая две разом, доказала бы только первую. */
      if (ok) for (const [chast, pochemu] of [
        ['и мероприятие уйдёт из афиши',
         'не сказано, что мероприятие пропадёт из афиши'],
        ['Вернуть его нельзя — только завести новое',
         'не сказано, что отмена необратима: вернуть не может ни мастер, ни гость'],
        ['Перепишите, кто записался: после отмены список не вернуть, а приложение гостей не предупредит',
         'нет порядка действий ДО нажатия — а после отмены список недостижим обоими путями и гостей никто не известит']])
        if (!ask.includes(chast))
          bad.push(`manage-otmena-tekst: ${pochemu}; части «${chast}» на экране нет (кадр E37d, Cafe13KPG#359)`);
      if (ok && ask.includes('сможет только каждый сам'))
        bad.push('manage-otmena-tekst: на экране прежняя ложь «вернуть их сможет только каждый сам» — вернуть не может НИКТО (Cafe13KPG#359)');
      /* ВЕС плашки — РЕШЕНИЕ кадра E37d, а не косметика: белая
         карточка читается четвёртой строкой списка, поэтому вопрос стоит
         глиной, а кнопки — ВНЕ неё. Судится СТРУКТУРНО: `classList` той
         карточки, что держит вопрос, а не регулярка по исходнику — регулярка
         описывает предмет той формой записи, которую вспомнил автор.
         Прецедент того же класса в этой же батарее — «неизвестный исход глиной»
         (кадр E34zh). Возврат архитектора по miniapp#84, Cafe13KPG#359. */
      if (ok) {
        const ves = await s.p.evaluate(() => {
          const c = [...document.querySelectorAll('#view .card')]
            .find(x => /Отменить мероприятие\?/.test(x.textContent));
          if (!c) return { est: false };
          const da = document.querySelector('#view [data-action^="event-cancel-yes"]');
          const net = document.querySelector('#view [data-action="event-cancel-no"]');
          return { est: true, warm: c.classList.contains('warm'),
                   strong: c.classList.contains('strong'),
                   vnutri: !!(da && c.contains(da)) || !!(net && c.contains(net)) };
        });
        if (!ves.est)
          bad.push('manage-otmena-ves: карточки с вопросом на экране нет — вес судить нечем (Cafe13KPG#359)');
        else {
          if (!ves.warm)
            bad.push('manage-otmena-ves: плашка вопроса не глиняная (`card warm`) — тот же вес, что у обычной карточки, и вопрос читается строкой списка (кадр E37d, Cafe13KPG#359)');
          if (ves.strong)
            bad.push('manage-otmena-ves: плашка вопроса белым весом (`card strong`) — кадр E37d держит её глиной нарочно (Cafe13KPG#359)');
          if (ves.vnutri)
            bad.push('manage-otmena-ves: кнопки «Да, отменить»/«Оставить» стоят ВНУТРИ плашки — в кадре E37d они под ней (Cafe13KPG#359)');
        }
      }
      if (posts.length) bad.push('manage-otmena: запрос ушёл на сервер ДО подтверждения');
      if (ok) {
        await s.p.click('[data-action="event-cancel-yes:4"]');
        await s.p.waitForTimeout(400);
        const t = await s.view();
        if (posts.length !== 1) bad.push(`manage-otmena: запросов отмены ${posts.length}, ждали 1`);
        if (!t.includes('больше нет')) bad.push('manage-otmena: отменённое мероприятие всё ещё на карточке: «' + t.slice(0, 80) + '»');
        if (t.includes('Не получилось')) bad.push('manage-otmena: удачная отмена показана отказом: «' +
          t.slice(t.indexOf('Не получилось'), t.indexOf('Не получилось') + 90) + '»');
        await s.p.screenshot({ path: `${OUT}/live-manage-otmena.png` });
      }
      await s.ctx.close();
    }

    // 200, а мероприятие в афише осталось — это не успех.
    {
      const s = await openMine(q => /\/events\/4\/cancel$/.test(q.url())
        ? json(200, { id: 4, state: 'cancelled', bookings_cancelled: 0 })
        : q.url().endsWith('/events') ? pair() : undefined);
      if (await askEventCancel(s, 'manage-otmena-200-pusto')) {
        await s.p.click('[data-action="event-cancel-yes:4"]');
        await s.p.waitForTimeout(400);
        const t = await s.view();
        if (!t.includes('в афише мероприятие осталось')) bad.push('manage-otmena-200-pusto: 200 без подтверждения афишей показан отменой');
      }
      await s.ctx.close();
    }

    // Отказ сервера читается словами сервера, а не нашей догадкой.
    {
      const s = await openMine(q => /\/events\/4\/cancel$/.test(q.url())
        ? json(403, { detail: 'мероприятие отменяет организатор или администратор' })
        : q.url().endsWith('/events') ? pair() : undefined);
      if (await askEventCancel(s, 'manage-otmena-403')) {
        await s.p.click('[data-action="event-cancel-yes:4"]');
        await s.p.waitForTimeout(400);
        const t = await s.view();
        if (!t.includes('Мероприятие отменяет организатор')) bad.push('manage-otmena-403: текста отказа сервера на экране нет: «' + t.slice(0, 90) + '»');
      }
      await s.ctx.close();
    }

    // Второе нажатие, пока первое в пути, второй отмены не делает.
    {
      const posts = [];
      const s = await openMine(q => {
        const u = q.url();
        if (/\/events\/4\/cancel$/.test(u)) { posts.push(1);
          return new Promise(r => setTimeout(() => r(json(200, { id: 4, state: 'cancelled', bookings_cancelled: 0 })), 800)); }
        if (u.endsWith('/events')) return pair();
        return undefined;
      });
      if (await askEventCancel(s, 'manage-otmena-dvazhdy')) {
        await s.p.click('[data-action="event-cancel-yes:4"]');
        await s.p.waitForTimeout(60);
        await s.p.evaluate(() => cancelEvent('4'));
        await s.p.waitForTimeout(900);
        if (posts.length !== 1) bad.push(`manage-otmena-dvazhdy: запросов отмены ${posts.length}, ждали 1`);
      }
      await s.ctx.close();
    }
  }

  /* ── рецепт позиции бара (#176) ──
     Формы ответа — из снимков `recipe-th.json`, `recipe-en-fallback.json`,
     `recipe-net.json`, `recipe-denied-guest.json` (прогон координатора на
     `2dedaa9`): `lang` — язык ПОКАЗАННОГО, `asked_lang` — запрошенный,
     `exact` — совпали ли; «рецепта нет» — 404 с текстом, а не пустое тело. */
  {
    const R_TH = { product_id: 11, lang: 'th', asked_lang: 'th', exact: true,
                   body: 'ชา: ใบชา 5 กรัม, น้ำ 90 องศา, 3 นาที', created_at: '2026-10-22T05:29:11.317057Z' };
    const R_RU = { product_id: 11, lang: 'ru', asked_lang: 'en', exact: false,
                   body: 'Чай: 5 г листа, вода 90°, настаивать 3 минуты', created_at: '2026-10-22T05:29:11.338467Z' };
    const who = roles => { const w = clone(OWNER); w.roles = roles; return json(200, w); };
    const BARMAN = who([{ role: 'bar', direction_id: 7 }]);      // направление «Бар» в фикстуре — 7
    const MEMBER = who([]);
    const ALIEN = who([{ role: 'curator', direction_id: 9 }]);   // куратор ЧУЖОГО направления

    const isRecipe = u => /\/bar\/products\/\d+\/recipe/.test(u);
    const withRecipe = reply => { const base = bar(); return q => isRecipe(q.url()) ? reply(q.url()) : base(q); };
    const toDrink = async (me, extra) => {
      const s = await open(true, true, me, null, null, null, extra || bar());
      await toBar(s);
      await s.p.click('[data-drink="11"]');
      await s.p.waitForTimeout(150);
      return s;
    };

    // Строку видит тот, кому отвечает СЕРВЕР: админ, бар и куратор своего
    // направления (`_needs_bar_side`, замер по боевой ревизии 880b4b6).
    for (const [name, me, want] of [
      ['recipe-knopka-bar', BARMAN, true],
      ['recipe-knopka-admin', json(200, OWNER), true],
      ['recipe-knopka-chlen', MEMBER, false],
      ['recipe-knopka-chuzhoe-napravlenie', ALIEN, false]]) {
      const s = await toDrink(me);
      const has = !!(await s.p.$('[data-action="recipe:11"]'));
      if (has !== want) bad.push(`${name}: строка «Рецепт» ${has ? 'есть' : 'нет'}, ждали ${want ? 'есть' : 'нет'}`);
      if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
      await s.ctx.close();
    }

    // Два блока целиком, и подмена языка названа своими словами.
    {
      const s = await toDrink(BARMAN, withRecipe(u => json(200, /lang=en/.test(u) ? R_RU : R_TH)));
      await s.p.click('[data-action="recipe:11"]');
      await s.p.waitForTimeout(300);
      const t = await s.view();
      ['Рецепт · สูตร', 'Recipe · English', R_TH.body, R_RU.body,
       'Рецепта на английском нет — показан на русском', 'ไม่มีภาษาอังกฤษ · แสดงภาษารัสเซีย',
       // Плашка НАЗЫВАЕТ язык («тайский»), подпись о подмене о нём говорит
       // («показан на русском») — один падеж на оба места читался как
       // «ภาษาไทย · тайском», и видно это было только на кадре.
       'ภาษาไทย · тайский'].forEach(x => {
        if (!t.includes(x)) bad.push(`recipe: нет «${x}»`); });
      // Кнопки «Отложить» нет: сервер знает making|ready|served|cancelled.
      ['Отложить', 'отложить'].forEach(x => {
        if (t.includes(x)) bad.push(`recipe: на экране «${x}», которого сервер не знает`); });
      const asked = s.calls.filter(c => isRecipe(c.url)).map(c => c.url.replace(/^.*\/bar/, '/bar'));
      if (asked.length !== 2) bad.push(`recipe: запросов рецепта ${asked.length}, ждали 2: ${JSON.stringify(asked)}`);
      if (!asked.some(u => u === '/bar/products/11/recipe'))
        bad.push(`recipe: нет запроса БЕЗ языка (его выбирает сервер по языку работника): ${JSON.stringify(asked)}`);
      if (!asked.some(u => u === '/bar/products/11/recipe?lang=en'))
        bad.push(`recipe: нет запроса на английский: ${JSON.stringify(asked)}`);
      await s.p.screenshot({ path: `${OUT}/live-recipe.png`, fullPage: true });
      await s.ctx.close();
    }

    /* У работника может быть не задан язык: Telegram не прислал
       `language_code`, `members.lang` пуст, сервер отвечает `asked_lang: ""`
       и `exact: false` — сравнивать было не с чем. Это НЕ подмена, и
       говорить о ней нельзя: «Рецепта на «» нет» — сообщение о событии,
       которого не было. (Возврат архитектора по #40.) */
    {
      // Тело — из снимка `recipe-no-lang.json` дословно (cafe13-api `71bcd40`):
      // запрос БЕЗ параметра работником с пустым `members.lang`. Номер
      // позиции здесь 11, а не 6 из снимка, — чтобы фикстура сходилась с
      // меню, по которому открывается экран; разбор его не читает.
      const R_NOLANG = { product_id: 11, lang: 'th', asked_lang: '', exact: false,
                         body: 'ชา: ใบชา 5 กรัม, น้ำ 90 องศา, 3 นาที', created_at: '2026-10-22T07:03:34.685038Z' };
      const s = await toDrink(BARMAN, withRecipe(u => json(200, /lang=en/.test(u) ? R_RU : R_NOLANG)));
      await s.p.click('[data-action="recipe:11"]');
      await s.p.waitForTimeout(300);
      const t = await s.view();
      ['Ваш язык не задан — показан на тайском', 'ไม่ได้ตั้งภาษา'].forEach(x => {
        if (!t.includes(x)) bad.push(`recipe-yazyk-ne-zadan: нет «${x}»`); });
      /* Запрет — ТОЛЬКО в первом блоке: во втором «Рецепта на английском
         нет» законно, и общий запрет покраснел бы на законном. Проверяем,
         что в блоке без языка нет НИ СЛОВА о запрошенном языке: иначе
         первая же правка текста склеит два состояния обратно. */
      const first = await s.p.evaluate(() => {
        const g = [...document.querySelectorAll('#view .group')]
          .filter(x => x.textContent.indexOf('Рецепт · ') === 0 || x.textContent.indexOf('Рецепт · สูตร') !== -1)[0];
        return g ? g.textContent : '';
      });
      if (!first) bad.push('recipe-yazyk-ne-zadan: первый блок не найден — проверять нечего');
      ['«»', 'Рецепта на', 'нет —'].forEach(x => {
        if (first.includes(x)) bad.push(`recipe-yazyk-ne-zadan: в блоке без языка сказано «${x}» — это подпись о подмене, которой не было`); });
      await s.ctx.close();
    }

    /* Поздний ответ под ПРЕЖНЮЮ позицию молчит. Цена прямая: работник открыл
       латте, передумал, открыл американо — и ответ по латте лёг бы на экран
       американо, а приготовил бы он не то. Защита стояла (`gen !==
       RECIPE.gen`), но её не проверял никто: мутация, снявшая её, была
       зелёной (возврат архитектора по #40). */
    {
      const SLOW = { product_id: 11, lang: 'th', asked_lang: 'th', exact: true,
                     body: 'ЛАТТЕ-ТЕЛО-ПЕРВОЙ-ПОЗИЦИИ', created_at: '2026-10-22T07:00:00Z' };
      const FAST = { product_id: 12, lang: 'th', asked_lang: 'th', exact: true,
                     body: 'АМЕРИКАНО-ТЕЛО-ВТОРОЙ-ПОЗИЦИИ', created_at: '2026-10-22T07:00:00Z' };
      const base = bar();
      // Тот же различитель: без него зелёное не отличает «гард работает» от
      // «поздний ответ успел прийти до ухода с экрана».
      const mark = { sentB: 0, doneA: 0 };
      const handler = q => {
        const u = q.url();
        if (/\/bar\/products\/11\/recipe/.test(u))
          return new Promise(r => setTimeout(() => { mark.doneA = Date.now(); r(json(200, SLOW)); }, 900));
        if (/\/bar\/products\/12\/recipe/.test(u)) { mark.sentB = mark.sentB || Date.now(); return json(200, FAST); }
        return base(q);
      };
      const s = await open(true, true, BARMAN, null, null, null, handler);
      await toBar(s);
      await s.p.click('[data-drink="11"]');
      await s.p.waitForTimeout(120);
      if (!(await s.p.$('[data-action="recipe:11"]'))) bad.push('recipe-pozdniy-otvet: нет строки рецепта у первой позиции');
      else {
        await s.p.click('[data-action="recipe:11"]');
        await s.p.waitForTimeout(100);                 // ответ ещё в пути
        await s.p.evaluate(() => go('bar'));
        await s.p.waitForTimeout(80);
        await s.p.click('[data-drink="12"]');
        await s.p.waitForTimeout(100);
        await s.p.click('[data-action="recipe:12"]');
        await s.p.waitForTimeout(1200);                // поздний ответ по 11 уже пришёл
        const t = await s.view();
        if (!t.includes('АМЕРИКАНО-ТЕЛО-ВТОРОЙ-ПОЗИЦИИ'))
          bad.push(`recipe-pozdniy-otvet: тела второй позиции на экране нет: «${t.slice(0, 140)}»`);
        if (t.includes('ЛАТТЕ-ТЕЛО-ПЕРВОЙ-ПОЗИЦИИ'))
          bad.push('recipe-pozdniy-otvet: поздний ответ по ПРЕЖНЕЙ позиции лёг на экран новой — работник приготовит не то');
        if (!mark.sentB || !mark.doneA)
          bad.push(`recipe-pozdniy-otvet: гонки не было — запросов ушло не два (B ${mark.sentB ? 'ушёл' : 'НЕ ушёл'}, A ${mark.doneA ? 'ответил' : 'НЕ ответил'}), случай гард не проверяет`);
        else if (mark.doneA < mark.sentB)
          bad.push(`recipe-pozdniy-otvet: гонки не было — первый ответил за ${mark.sentB - mark.doneA} мс ДО ухода на вторую позицию, случай гард не проверяет`);
      }
      await s.ctx.close();
    }

    // Отказы: «рецепта нет» и «не открылось» — разные вещи, и ни одно из них
    // не выглядит пустым блоком.
    for (const [name, reply, want, nope] of [
      // Серверный текст 404 — поручение («напишите его…»), а экран действия
      // не несёт: печатать его дословно значит упрекать того, кто пришёл
      // прочитать. Показываем состояние и кто пишет рецепт.
      ['recipe-net', json(404, { detail: 'у позиции нет живого рецепта: напишите его, иначе её нельзя вернуть в меню' }),
        'Рецепта пока нет', 'напишите его'],
      ['recipe-403', json(403, { detail: 'это делает бар или куратор направления' }),
        'Это делает бар или куратор направления', 'Рецепта нет'],
      ['recipe-set', 'abort', 'Сервер не ответил', 'Рецепта нет'],
      ['recipe-bitiy', json(200, { product_id: 11, lang: 'th', body: 'текст', created_at: 'x' }),
        'Ответ сервера не разобран', 'текст']]) {
      const s = await toDrink(BARMAN, withRecipe(() => reply));
      await s.p.click('[data-action="recipe:11"]');
      await s.p.waitForTimeout(300);
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет слов «${want}», на экране: «${t.slice(0, 160)}»`);
      if (t.includes(nope)) bad.push(`${name}: на экране лишнее «${nope}»`);
      await s.ctx.close();
    }
  }

  // ── завести мероприятие (#178, первая половина) ──
  // Право даёт либо роль клуба, либо купленный уровень — две независимые
  // ветки, и у каждой свой случай: фикстура с одной ветвью оставила бы
  // мутацию, снявшую вторую, зелёной (так было с разбором баланса строкой).
  {
    const member = clone(OWNER); member.roles = [];                       // уровень member, ролей нет
    const levelOrg = clone(OWNER); levelOrg.roles = []; levelOrg.membership.level = 'organizer';
    const curatorOnly = clone(OWNER); curatorOnly.roles = [{ role: 'curator', direction_id: 1 }];

    const newRow = over => EV(Object.assign({ id: 55, title: 'Мой новый вечер', organizer_id: 1,
      starts_at: bkkDay(1) + 'T19:00:00+07:00', duration_min: 90, seats: 12, kind: 'paid',
      price: '400.00', about: 'Живой звук', taken: 0, seats_left: 12 }, over || {}));

    // Форма открывается КНОПКОЙ с афиши: проверяется путь, а не функция.
    // Нет кнопки — случай говорит это своими словами, а не умирает кликом.
    const openForm = async (name, handler, me, tz) => {
      // Места подкладываются ВСЕМ случаям формы: без этого запрос на
      // /places падал бы в ответ по умолчанию (тело /me), и форма во всех
      // снимках говорила бы «места не пришли». Свой обработчик случая идёт
      // первым и может ответить за /places иначе — этим живёт случай отказа.
      const s = await open(true, true, me || json(200, OWNER), null, null, null,
                           chainQ(handler, placesReply(), evReply(json(200, []))), tz || null, NOWFIX);
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      if (!(await s.p.$('[data-go="eventNew"]'))) {
        bad.push(`${name}: кнопки «Создать мероприятие» на афише нет — открывать нечем`);
        return { s, ok: false };
      }
      await s.p.click('[data-go="eventNew"]');
      await s.p.waitForTimeout(120);
      if (!(await s.p.$('#f-title'))) {
        bad.push(`${name}: форма не открылась — заполнять нечего`);
        return { s, ok: false };
      }
      return { s, ok: true };
    };

    const fill = async (p, over) => {
      const v = Object.assign({ title: 'Мой новый вечер', date: bkkDay(1), time: '19:00',
                                dur: '90', seats: '12', about: 'Живой звук', price: '400' }, over || {});
      await p.fill('#f-title', v.title);
      await p.fill('#f-date', v.date);
      await p.fill('#f-time', v.time);
      await p.fill('#f-dur', v.dur);
      await p.fill('#f-seats', v.seats);
      await p.fill('#f-about', v.about);
      if (await p.$('#f-price')) await p.fill('#f-price', v.price);
    };

    /* Внутри Telegram кнопка на экране скрыта (body.has-main), настоящая —
       главная кнопка Telegram. Сначала признак, потом нажатие: иначе случай
       умирает таймаутом по невидимой кнопке вместо своего текста. */
    const publish = async (p, name) => {
      if (!(await p.evaluate(() => !!window.__main))) {
        bad.push(`${name}: главной кнопки «Опубликовать в афише» нет — нажимать нечего`);
        return false;
      }
      await p.evaluate(() => window.__main());
      return true;
    };

    // Запрос POST и перечитывание афиши на одном адресе: ответ зависит от метода.
    const sender = (created, code, body) => {
      const posts = [];
      const h = q => {
        const u = q.url();
        if (!u.endsWith('/events')) return undefined;
        if (q.method() === 'POST') { posts.push(q.postData()); return json(code || 201, body || { id: 55 }); }
        return json(200, posts.length ? [created()] : []);
      };
      return { posts, h };
    };

    // Кнопка входа — по праву из /me, и обе стороны: у кого права нет, у того
    // и кнопки нет.
    for (const [name, me, want] of [
      ['sozdat-knopka-rol', json(200, OWNER), true],
      ['sozdat-knopka-kurator', json(200, curatorOnly), true],
      ['sozdat-knopka-uroven', json(200, levelOrg), true],
      ['sozdat-knopka-chlen', json(200, member), false]]) {
      const s = await open(true, true, me, null, null, null, evReply(json(200, [])), null, NOWFIX);
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      const has = !!(await s.p.$('[data-go="eventNew"]'));
      if (has !== want) bad.push(`${name}: кнопка «Создать мероприятие» ${has ? 'есть' : 'нет'}, ждали ${want ? 'есть' : 'нет'}`);
      if (s.errs.length) bad.push(`${name}: ошибки страницы ${s.errs.join('; ')}`);
      await s.ctx.close();
    }

    // Три вида — три подписи в одном месте, а у бесплатного поля нет вовсе.
    {
      const { s, ok } = await openForm('sozdat-forma');
      if (ok) {
        const t = await s.view();
        ['Название', 'До 200 знаков', 'Время клуба', 'От 1 до 1440', 'От 1 до 500',
         'Цена входа', 'Больше нуля', 'Исправить потом нельзя'].forEach(x => {
          if (!t.includes(x)) bad.push(`sozdat-forma: нет «${x}»`); });
        await s.p.screenshot({ path: `${OUT}/live-sozdat-platnoe.png`, fullPage: true });

        await s.p.click('[data-kind="free"]');
        await s.p.waitForTimeout(100);
        const tf = await s.view();
        if (await s.p.$('#f-price')) bad.push('sozdat-forma: у бесплатного поле цены осталось на экране');
        if (!tf.includes('брать нечего')) bad.push('sozdat-forma: у бесплатного не сказано, почему поля цены нет');
        await s.p.screenshot({ path: `${OUT}/live-sozdat-besplatnoe.png`, fullPage: true });

        await s.p.click('[data-kind="donation"]');
        await s.p.waitForTimeout(100);
        const td = await s.view();
        if (!(await s.p.$('#f-price'))) bad.push('sozdat-forma: у донейшна поля ориентира нет');
        ['Ориентир', 'Можно не указывать'].forEach(x => {
          if (!td.includes(x)) bad.push(`sozdat-forma: у донейшна нет «${x}»`); });
        if (td.includes('Больше нуля')) bad.push('sozdat-forma: у донейшна осталась подпись платного «Больше нуля»');
        await s.p.screenshot({ path: `${OUT}/live-sozdat-doneyshn.png`, fullPage: true });

        // «Назад» с формы — на афишу: в живом режиме кабинет организатора
        // показывает придуманные мероприятия.
        const back = await s.p.evaluate(() => backTo());
        if (back !== 'events') bad.push(`sozdat-forma: «назад» с формы ведёт на «${back}», а не на афишу`);
      }
      await s.ctx.close();
    }

    /* Выбор места в форме (#104). Три обещания, и у каждого свой текст:
       открытые места предлагаются, скрытое — нет (назначить на него сервер
       откажет 409), вместимость показывается только там, где она есть.

       Сторожа фикстуры считают из САМОЙ фикстуры и зовут места её же
       именами: если скрытое место из фикстуры исчезнет, загорится сторож, а
       проверки экрана смолчат — им нечего будет искать. Так поломка фикстуры
       и поломка клиента краснеют разными строками (условие архитектора,
       22.10.2026). */
    {
      const { s, ok } = await openForm('forma-mesta');
      if (ok) {
        const t = await s.view();
        const act = PLACE_ROWS.filter(p => p.state === 'active');
        const hid = PLACE_ROWS.filter(p => p.state === 'hidden');
        // Незнакомое состояние — отдельный список: на нём и расходятся
        // разрешающий отбор («не active — мимо») и отбор списком запретов
        // («только hidden — мимо»). Без него обе ветки проходят одинаково.
        const unk = PLACE_ROWS.filter(p => p.state !== 'active' && p.state !== 'hidden');
        const withCap = act.filter(p => typeof p.capacity === 'number')[0];
        const noCap = act.filter(p => p.capacity === null)[0];
        if (!hid.length) bad.push('forma-mesta: в фикстуре мест нет ни одного скрытого — отбору нечего отбрасывать, проверка слепа');
        if (!unk.length) bad.push('forma-mesta: в фикстуре нет места незнакомого состояния — разрешающий отбор и список запретов на ней неразличимы');
        if (!withCap || !noCap) bad.push('forma-mesta: в фикстуре нет пары «вместимость названа / не названа» — правило о нуле не проверяется');
        ['Где', 'Без места'].forEach(x => {
          if (!t.includes(x)) bad.push(`forma-mesta: в выборе места нет «${x}»`); });
        act.forEach(p => {
          if (!t.includes(p.name)) bad.push(`forma-mesta: открытое место «${p.name}» в выборе не предложено`); });
        hid.forEach(p => {
          if (t.includes(p.name)) bad.push(`forma-mesta: скрытое место «${p.name}» предложено к выбору — назначить на него сервер откажет`); });
        unk.forEach(p => {
          if (t.includes(p.name)) bad.push(`forma-mesta: место «${p.name}» в незнакомом состоянии «${p.state}» предложено к выбору — разрешаем известное, а не запрещаем перечисленное`); });
        if (withCap) {
          await s.p.click(`[data-place="${withCap.id}"]`);
          await s.p.waitForTimeout(100);
          const th = await s.view();
          if (!th.includes('Вместимость: ' + withCap.capacity))
            bad.push(`forma-mesta: у «${withCap.name}» не показана вместимость ${withCap.capacity} из снимка`);
        }
        if (noCap) {
          await s.p.click(`[data-place="${noCap.id}"]`);
          await s.p.waitForTimeout(100);
          const tg = await s.view();
          // Числа у этого места никто не называл: ноль значил бы «мест нет».
          if (tg.includes('Вместимость'))
            bad.push(`forma-mesta: у «${noCap.name}» напечатана вместимость, которой никто не называл`);
        }
        if (s.errs.length) bad.push('forma-mesta: ошибки страницы ' + s.errs.join('; '));
        await s.p.screenshot({ path: `${OUT}/live-forma-mesta.png`, fullPage: true });
      }
      await s.ctx.close();
    }

    /* Что уходит в тело. «Без места» — ОТСУТСТВИЕ ключа `place_id`, а не
       null: отсутствие — та форма, что стоит в снимке создания без места.
       Выбранное место — числом. Проверяется по перехваченному телу POST,
       а не по экрану: экран о теле запроса ничего не знает. */
    {
      const mk = sender(() => newRow({ place_id: null, place_name: null }));
      const { s, ok } = await openForm('forma-telo', mk.h);
      if (ok) {
        await fill(s.p);
        if (await publish(s.p, 'forma-telo')) {
          await s.p.waitForTimeout(200);
          if (!mk.posts.length) bad.push('forma-telo: POST не ушёл — проверять нечего');
          else {
            const b1 = JSON.parse(mk.posts[0]);
            if ('place_id' in b1) bad.push(`forma-telo: при «без места» в теле есть place_id = ${JSON.stringify(b1.place_id)} — отправили то, чего человек не выбирал`);
          }
        }
      }
      await s.ctx.close();
    }
    {
      const mk = sender(() => newRow({ place_id: 1, place_name: 'Зал' }));
      const { s, ok } = await openForm('forma-telo-mesto', mk.h);
      if (ok) {
        await fill(s.p);
        if (!(await s.p.$('[data-place="1"]'))) bad.push('forma-telo-mesto: кнопки зала в форме нет — выбирать нечем');
        else {
          await s.p.click('[data-place="1"]');
          await s.p.waitForTimeout(100);
          if (await publish(s.p, 'forma-telo-mesto')) {
            await s.p.waitForTimeout(200);
            if (!mk.posts.length) bad.push('forma-telo-mesto: POST не ушёл — проверять нечего');
            else {
              const b2 = JSON.parse(mk.posts[0]);
              if (b2.place_id !== 1) bad.push(`forma-telo-mesto: выбран зал, а в теле place_id = ${JSON.stringify(b2.place_id)}`);
            }
          }
        }
      }
      await s.ctx.close();
    }

    /* Места не пришли — отказ назван своими словами, и мероприятие всё равно
       заводится: без места оно законно. Молчаливый пустой выбор был бы
       правдоподобным успехом — человек решил бы, что мест в клубе нет. */
    {
      const { s, ok } = await openForm('forma-mest-net',
        q => q.url().endsWith('/places') ? json(500, { detail: 'внутренняя ошибка' }) : undefined);
      if (ok) {
        const t = await s.view();
        if (!t.includes('Места не пришли')) bad.push(`forma-mest-net: об отказе по местам не сказано, видно «${t.slice(0, 140)}»`);
        if (!t.includes('Сервер ответил кодом 500')) bad.push('forma-mest-net: код отказа не назван');
        if (await s.p.$('[data-place]')) bad.push('forma-mest-net: кнопки мест нарисованы при отказе — выбирать из ничего');
        if (!(await s.p.evaluate(() => !!window.__main))) bad.push('forma-mest-net: главной кнопки нет — без места завести нельзя, хотя без места законно');
        if (s.errs.length) bad.push('forma-mest-net: ошибки страницы ' + s.errs.join('; '));
        await s.p.screenshot({ path: `${OUT}/live-forma-mest-net.png`, fullPage: true });
      }
      await s.ctx.close();
    }

    /* Отказ по местам не вечен: повторный вход спрашивает сервер снова.
       Без этого случая «места не пришли» осталось бы на форме навсегда —
       и экран врал бы о НАСТОЯЩЕМ, уже после того как сервер выздоровел.
       Счёт запросов здесь — проверка независимая от экрана: текст мог бы
       исчезнуть и по другой причине (перерисовка, сброс состояния). */
    {
      let tries = 0;
      const { s, ok } = await openForm('forma-mest-povtor', q => {
        if (!q.url().endsWith('/places')) return undefined;
        tries += 1;
        return tries === 1 ? json(500, { detail: 'внутренняя ошибка' }) : json(200, PLACE_ROWS);
      });
      if (ok) {
        const t1 = await s.view();
        if (!t1.includes('Места не пришли')) bad.push(`forma-mest-povtor: первый отказ не назван — проверять нечего, видно «${t1.slice(0, 120)}»`);
        await s.p.evaluate(() => go('events'));
        await s.p.waitForTimeout(120);
        await s.p.evaluate(() => go('eventNew'));
        await s.p.waitForTimeout(300);
        const t2 = await s.view();
        if (tries < 2) bad.push(`forma-mest-povtor: запросов к /places ${tries}, ждали 2 — на повторном входе сервер не спрошен`);
        if (t2.includes('Места не пришли')) bad.push('forma-mest-povtor: отказ по местам лежит на форме и после возврата — экран говорит о прошлом');
        const act = PLACE_ROWS.filter(p => p.state === 'active');
        act.forEach(p => { if (!t2.includes(p.name)) bad.push(`forma-mest-povtor: после возврата место «${p.name}» так и не предложено`); });
        if (s.errs.length) bad.push('forma-mest-povtor: ошибки страницы ' + s.errs.join('; '));
        await s.p.screenshot({ path: `${OUT}/live-forma-mest-povtor.png`, fullPage: true });
      }
      await s.ctx.close();
    }

    /* Эхо под днём и временем: виджет даты печатает порядок УСТРОЙСТВА, и
       «07/08» двусмысленно. Ожидание считается НЕЗАВИСИМО от кода экрана —
       по литералам месяцев и дней недели, а не тем же Intl, что в клиенте:
       иначе обе стороны ошиблись бы одинаково. */
    const MONTH_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const DOW_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    // Хвост «· время клуба» — отдельный узел, поэтому в #f-echo его нет.
    const ruWhen = (ymd, hm) => {
      const [y, m, d] = ymd.split('-').map(Number);
      return DOW_RU[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] +
             ', ' + d + ' ' + MONTH_RU[m - 1] + ' ' + y + ', ' + hm;
    };
    for (const [name, day, time, tz] of [
      ['sozdat-eho', bkkDay(1), '19:00', null],
      // Полночь по острову — это ещё предыдущие сутки и в UTC, и в Нью-Йорке:
      // если эхо считают не в поясе клуба, разойдутся и день, и день недели.
      ['sozdat-eho-polnoch', bkkDay(2), '00:30', 'America/New_York']]) {
      const { s, ok } = await openForm(name, null, null, tz);
      if (ok) {
        await s.p.fill('#f-date', day);
        await s.p.fill('#f-time', time);
        await s.p.waitForTimeout(150);
        // Сначала признак: без него снятое эхо даёт таймаут ожидания узла,
        // а не свой текст — случай умирал бы молча и долго.
        if (!(await s.p.$('#f-echo'))) {
          bad.push(`${name}: строки эха под днём и временем нет вовсе`);
          await s.ctx.close();
          continue;
        }
        const got = (await s.p.textContent('#f-echo')) || '';
        const want = ruWhen(day, time);
        if (got.trim() !== want) bad.push(`${name}: эхо «${got.trim()}», ждали «${want}»`);
        // У посчитанной даты хвост «· время клуба» виден: он и делает её
        // утверждением о поясе, а не просто датой.
        if (!(await s.p.isVisible('#f-echo-tail'))) bad.push(`${name}: хвоста «· время клуба» не видно`);
      }
      await s.ctx.close();
    }

    /* Утверждение эха о пустоте сверяется с ФАКТИЧЕСКИМ состоянием полей, а
       не с литералом: тогда случай переживёт и смену формулировок. Три
       состояния, и форма открывается во втором — день пуст, время 19:00.
       (Случай предложен designer-55; его форма ожидания сильнее моей, у меня
       было два литерала. Проверка хвоста — моя.) */
    {
      const { s, ok } = await openForm('sozdat-eho-pusto');
      if (ok) {
        for (const [day, time] of [[null, null], ['', '19:00'], [bkkDay(1), '']]) {
          if (day !== null) { await s.p.fill('#f-date', day); await s.p.fill('#f-time', time); }
          await s.p.waitForTimeout(100);
          if (!(await s.p.$('#f-echo'))) { bad.push('sozdat-eho-pusto: строки эха нет вовсе'); break; }
          const st = await s.p.evaluate(() => ({
            day: document.getElementById('f-date').value,
            time: document.getElementById('f-time').value,
            echo: ((document.getElementById('f-echo') || {}).textContent || '').trim()
          }));
          const want = !st.day ? 'Выберите день.' : !st.time ? 'Выберите время.' : ruWhen(st.day, st.time);
          if (st.echo !== want)
            bad.push(`sozdat-eho-pusto: в полях день «${st.day}» время «${st.time}», эхо «${st.echo}», ждали «${want}»`);
          // Хвост «· время клуба» принадлежит посчитанной дате, а не просьбе.
          const tail = await s.p.isVisible('#f-echo-tail');
          const needTail = !!(st.day && st.time);
          if (tail !== needTail)
            bad.push(`sozdat-eho-pusto: хвост ${tail ? 'виден' : 'скрыт'}, а день «${st.day}» время «${st.time}»`);
        }
      }
      await s.ctx.close();
    }

    // Путь ОТРИСОВКИ эха: после переключения вида экран рисуется заново, и
    // строка приходит из разметки, а не от слушателя ввода.
    {
      const { s, ok } = await openForm('sozdat-eho-otrisovka');
      if (ok) {
        await s.p.fill('#f-date', bkkDay(1));
        await s.p.fill('#f-time', '08:15');
        await s.p.click('[data-kind="free"]');
        await s.p.waitForTimeout(150);
        if (!(await s.p.$('#f-echo'))) bad.push('sozdat-eho-otrisovka: строки эха нет после перерисовки');
        else {
          const got = ((await s.p.textContent('#f-echo')) || '').trim();
          const want = ruWhen(bkkDay(1), '08:15');
          if (got !== want) bad.push(`sozdat-eho-otrisovka: после перерисовки эхо «${got}», ждали «${want}»`);
          if (!(await s.p.isVisible('#f-echo-tail'))) bad.push('sozdat-eho-otrisovka: после перерисовки хвоста не видно');
        }
      }
      await s.ctx.close();
    }

    // Введённая цена переживает переключение вида: иначе человек платит
    // вводом за то, что ткнул не туда.
    {
      const { s, ok } = await openForm('sozdat-cena-pomnit');
      if (ok) {
        await s.p.fill('#f-price', '777');
        await s.p.click('[data-kind="free"]');
        await s.p.waitForTimeout(100);
        await s.p.click('[data-kind="paid"]');
        await s.p.waitForTimeout(100);
        const got = await s.p.inputValue('#f-price');
        if (got !== '777') bad.push(`sozdat-cena-pomnit: после возврата к платному в поле «${got}», а не 777`);
      }
      await s.ctx.close();
    }

    // Отправка целиком: тело запроса сверяется полем за полем, а время —
    // в поясе КЛУБА при телефоне в третьем поясе. Успех признаётся
    // перечитанной афишей: карточка своего нового события с управлением.
    {
      const { posts, h } = sender(() => newRow());
      const { s, ok } = await openForm('sozdat-otpravka', h, null, 'America/New_York');
      if (ok) {
        await fill(s.p);
        await publish(s.p, 'sozdat-otpravka');
        await s.p.waitForTimeout(500);
        if (posts.length !== 1) bad.push(`sozdat-otpravka: POST /events ушёл ${posts.length} раз, ждали 1`);
        else {
          const b = JSON.parse(posts[0]);
          const want = { title: 'Мой новый вечер', starts_at: bkkDay(1) + 'T19:00:00+07:00',
                         duration_min: 90, seats: 12, kind: 'paid', price: 400,
                         about: 'Живой звук', filmed: false };
          Object.keys(want).forEach(k => {
            if (JSON.stringify(b[k]) !== JSON.stringify(want[k]))
              bad.push(`sozdat-otpravka: ${k} = ${JSON.stringify(b[k])}, ждали ${JSON.stringify(want[k])}`);
          });
        }
        const t = await s.view();
        if (!t.includes('Мой новый вечер')) bad.push(`sozdat-otpravka: карточка нового события не открылась: «${t.slice(0, 100)}»`);
        if (!t.includes('Управление')) bad.push('sozdat-otpravka: на своём новом событии нет управления');
        if (t.includes('Не получилось')) bad.push(`sozdat-otpravka: удачное создание показано отказом: «${t.slice(0, 120)}»`);
        await s.p.screenshot({ path: `${OUT}/live-sozdat-sozdano.png` });
      }
      await s.ctx.close();
    }

    // 201 без подтверждения афишей — не успех; и 201, под номером которого
    // в афише ДРУГОЕ событие, — тоже не успех.
    for (const [name, created, want] of [
      ['sozdat-201-pusto', null, 'в афише мероприятия нет'],
      ['sozdat-201-drugoe', () => newRow({ title: 'Совсем другое' }), 'в афише другое мероприятие']]) {
      const { posts, h } = sender(created || (() => null));
      const handler = created ? h : q => {
        const u = q.url();
        if (!u.endsWith('/events')) return undefined;
        if (q.method() === 'POST') { posts.push(q.postData()); return json(201, { id: 55 }); }
        return json(200, []);
      };
      const { s, ok } = await openForm(name, handler);
      if (ok) {
        await fill(s.p);
        await publish(s.p, name);
        await s.p.waitForTimeout(500);
        const t = await s.view();
        if (!t.includes(want)) bad.push(`${name}: нет слов «${want}», на экране: «${t.slice(0, 140)}»`);
        if (!t.includes('Не получилось')) bad.push(`${name}: неудача не названа неудачей`);
      }
      await s.ctx.close();
    }

    // Отказ сервера показывается ЕГО словами; а 422 с detail-СПИСКОМ (так
    // отвечает валидация FastAPI) не печатается как строка: «[object Object]»
    // человеку ничего не говорит.
    for (const [name, code, body, want, nope] of [
      ['sozdat-403', 403, { detail: 'мероприятия заводят организатор, партнёр и работники клуба' },
        'Мероприятия заводят организатор, партнёр и работники клуба', 'не впустили'],
      // Тот же код, другое происхождение: привратник доступа. Слово сервера
      // здесь отвечает не на тот вопрос, поэтому на экране своя строка.
      ['sozdat-403-privratnik', 403, { detail: 'доступа нет' },
        'Вас ещё не впустили в клуб', 'Доступа нет'],
      // Форма взята из снимка event-create-422.json (не подделана): в каждом
      // объекте есть input и ctx, а msg — по-английски, поэтому на экран идёт
      // имя ПОЛЯ из loc, а не msg.
      ['sozdat-422-spisok', 422, { detail: [
          { type: 'string_too_short', loc: ['body', 'title'],
            msg: 'String should have at least 1 character', input: '', ctx: { min_length: 1 } },
          { type: 'greater_than', loc: ['body', 'seats'],
            msg: 'Input should be greater than 0', input: 0, ctx: { gt: 0 } }] },
        'Сервер не принял поля: Название, Мест', 'object'],
      // Тот же код, но поле не названо: тогда честнее общий текст с кодом,
      // чем выдуманное имя поля.
      ['sozdat-422-bez-polya', 422, { detail: [{ type: 'value_error', msg: 'nope' }] },
        'Сервер ответил кодом 422', 'object']]) {
      const { posts, h } = sender(() => null, code, body);
      const { s, ok } = await openForm(name, h);
      if (ok) {
        await fill(s.p);
        await publish(s.p, name);
        await s.p.waitForTimeout(500);
        const t = await s.view();
        if (posts.length !== 1) bad.push(`${name}: POST /events ушёл ${posts.length} раз, ждали 1`);
        if (!t.includes(want)) bad.push(`${name}: нет слов «${want}», на экране: «${t.slice(0, 140)}»`);
        if (t.includes(nope)) bad.push(`${name}: на экране лишнее «${nope}»: «${t.slice(0, 140)}»`);
      }
      await s.ctx.close();
    }

    // Отказ сервера не стирает набранное: экран рисует поля из памяти формы,
    // и человек не должен набирать всё заново из-за того, в чём не виноват.
    {
      const { posts, h } = sender(() => null, 403, { detail: 'мероприятия заводят организатор, партнёр и работники клуба' });
      const { s, ok } = await openForm('sozdat-vvod-pri-otkaze', h);
      if (ok) {
        await fill(s.p, { title: 'Практика у воды', seats: '7', dur: '75', price: '350' });
        await publish(s.p, 'sozdat-vvod-pri-otkaze');
        await s.p.waitForTimeout(400);
        if (posts.length !== 1) bad.push(`sozdat-vvod-pri-otkaze: POST /events ушёл ${posts.length} раз, ждали 1`);
        for (const [sel, want] of [['#f-title', 'Практика у воды'], ['#f-date', bkkDay(1)],
                                   ['#f-time', '19:00'], ['#f-dur', '75'], ['#f-seats', '7'],
                                   ['#f-price', '350']]) {
          if (!(await s.p.$(sel))) { bad.push(`sozdat-vvod-pri-otkaze: после отказа нет поля ${sel}`); continue; }
          const got = await s.p.inputValue(sel);
          if (got !== want) bad.push(`sozdat-vvod-pri-otkaze: после отказа в ${sel} «${got}», а набрано было «${want}»`);
        }
      }
      await s.ctx.close();
    }

    // Негодная форма до сервера не доходит, и у каждого запрета свой текст.
    for (const [name, over, want] of [
      ['sozdat-bez-nazvaniya', { title: '' }, 'Без названия мероприятие в афишу не ставится'],
      ['sozdat-proshloe', { date: bkkDay(0), time: '07:00' }, 'уже прошло по часам клуба'],
      ['sozdat-dlitelnost-0', { dur: '0' }, 'от 1 до 1440 минут'],
      ['sozdat-dlitelnost-1441', { dur: '1441' }, 'от 1 до 1440 минут'],
      ['sozdat-mest-0', { seats: '0' }, 'от 1 до 500'],
      ['sozdat-mest-501', { seats: '501' }, 'от 1 до 500'],
      ['sozdat-platnoe-bez-ceny', { price: '0' }, 'цена больше нуля']]) {
      const { posts, h } = sender(() => newRow());
      const { s, ok } = await openForm(name, h);
      if (ok) {
        await fill(s.p, over);
        await publish(s.p, name);
        await s.p.waitForTimeout(250);
        const t = await s.view();
        if (!t.includes(want)) bad.push(`${name}: нет отказа «${want}», на экране: «${t.slice(0, 140)}»`);
        if (posts.length) bad.push(`${name}: негодная форма ушла на сервер (${posts.length} запрос)`);
      }
      await s.ctx.close();
    }

    // Второе нажатие, пока первое в пути, второго мероприятия не заводит.
    {
      const posts = [];
      const h = q => {
        const u = q.url();
        if (!u.endsWith('/events')) return undefined;
        if (q.method() === 'POST') { posts.push(q.postData());
          return new Promise(r => setTimeout(() => r(json(201, { id: 55 })), 800)); }
        return json(200, posts.length ? [newRow()] : []);
      };
      const { s, ok } = await openForm('sozdat-dvazhdy', h);
      if (ok) {
        await fill(s.p);
        await publish(s.p, 'sozdat-dvazhdy');
        await s.p.waitForTimeout(60);
        // Пока запрос в пути, главной кнопки нет вовсе: кнопка, молчащая по
        // нажатию, неотличима от зависшей.
        if (await s.p.evaluate(() => !!window.__main))
          bad.push('sozdat-dvazhdy: пока создание в пути, главная кнопка осталась на экране');
        await s.p.evaluate(() => createEvent());
        await s.p.waitForTimeout(1200);
        if (posts.length !== 1) bad.push(`sozdat-dvazhdy: POST /events ушёл ${posts.length} раз, ждали 1`);
      }
      await s.ctx.close();
    }

    // У человека без права нет ни формы, ни главной кнопки, и прямой вызов
    // отправки ничего не отправляет: предикат один на рисование и на путь.
    {
      const s = await open(true, true, json(200, member), null, null, null,
                           evReply(json(200, [])), null, NOWFIX);
      await s.p.evaluate(() => go('eventNew'));
      await s.p.waitForTimeout(150);
      const t = await s.view();
      if (await s.p.$('#f-title')) bad.push('sozdat-net-prava: форма открылась у человека без права');
      if (!t.includes('Мероприятия заводят не все')) {
        bad.push(`sozdat-net-prava: не сказано, кто заводит мероприятия: «${t.slice(0, 120)}»`);
      } else {
        /* Слово ВИДА членства — «мастер», а не «организатор» (решение
           координатора Cafe13KPG#102: в данных остаётся `organizer`, а
           «организатор» говорится только про конкретное мероприятие). Это
           ЕДИНСТВЕННОЕ место, где слово вида видит ЖИВОЙ человек: кабинет
           мастера в WIRED не входит, его стережёт свой случай в демонстрации.
           Суд под сторожем заголовка: не откройся экран вовсе, вердикт о
           словах краснел бы вторым и третьим текстом одной поломки. */
        if (!t.includes('Их заводят члены с уровнем «Мастер»'))
          bad.push(`sozdat-net-prava: право названо не купленным уровнем: «${t.slice(0, 200)}»`);
        if (/заводят организатор/.test(t))
          bad.push('sozdat-net-prava: вид членства назван «организатором» — это отношение к конкретному мероприятию, а не вид (Cafe13KPG#102)');
        /* РЕГИСТР: «мастер» с маленькой — тот, кто ВЕДЁТ вечер, и гостевой
           учитель без членства прочёл бы его как разрешение себе (словарь
           облика, «Мастер, мастер, организатор»; найдено архитектором на #63). */
        if (/заводят мастер/.test(t))
          bad.push('sozdat-net-prava: «мастер» с маленькой — это тот, кто ведёт вечер; право даёт КУПЛЕННЫЙ уровень «Мастер», и гостевой учитель без членства прочтёт маленькую как разрешение себе');
        /* УКАЗАТЕЛЬ НА ЭКРАН: отказ не зовёт на «Членство» — в живом режиме
           там «ещё не подключено». Довод запрета лежит В СОСЕДНЕЙ строке
           клиента (`WIRED`), и потому он сам проверяется следующим условием:
           вернётся `membership` в WIRED — запрет надо перечитать, а не держать
           вечно на истёкшем доводе (Cafe13KPG#296). */
        if (/на экране «Членство»/.test(t))
          bad.push('sozdat-net-prava: отказ зовёт на экран «Членство», а в живом режиме там «ещё не подключено»');
        if (await s.p.evaluate(() => !!(window.WIRED && WIRED.membership)))
          bad.push('sozdat-net-prava: ДОВОД ЗАПРЕТА ИСТЁК — `membership` снова в WIRED, значит указатель на этот экран снова законен: перечитать отказ формы и этот случай');
      }
      if (await s.p.evaluate(() => !!window.__main)) bad.push('sozdat-net-prava: главная кнопка Telegram осталась');
      /* Поля подкладываются руками: формы на экране нет, и без них отправку
         остановила бы проверка полей, а не проверка права — мутация, снявшая
         право, оставалась зелёной по ЧУЖОЙ причине. Теперь между вызовом и
         запросом стоит ровно одно: право. */
      await s.p.evaluate(day => {
        FORM.kind = 'free';
        document.getElementById('view').insertAdjacentHTML('beforeend',
          '<input id="f-title" value="Подложенное"><input id="f-date" value="' + day + '">' +
          '<input id="f-time" value="19:00"><input id="f-dur" value="90">' +
          '<input id="f-seats" value="5"><input id="f-about" value="">');
      }, bkkDay(1));
      await s.p.evaluate(() => createEvent());
      await s.p.waitForTimeout(250);
      const sent = s.calls.filter(c => c.method === 'POST');
      if (sent.length) bad.push(`sozdat-net-prava: прямой вызов createEvent() отправил ${sent.length} запрос`);
      if (s.errs.length) bad.push(`sozdat-net-prava: ошибки страницы ${s.errs.join('; ')}`);
      await s.ctx.close();
    }
  }

  /* Слово ВИДА в кабинете мастера (Cafe13KPG#102). Два экрана моей зоны
     говорят о виде членства, и досягаемость у них разная, поэтому и
     случаи разные: отказ формы живой (`eventNew` есть в WIRED), а кабинета
     в WIRED НЕТ — в живом режиме на его месте стоит «soon», и строку про
     уровень человек видит только в демонстрации. До этого случая кабинета
     не открывал ни один прогон: строку можно было переписать любым
     словом, и батарея осталась бы зелёной. Сторож фикстуры здесь — сам
     факт, что открылся кабинет, и говорит он ОДИН. */
  {
    const s = await open(true, false, json(200, OWNER), null, null, null, null, null, NOWFIX);
    await s.p.evaluate(() => go('organizer'));
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (!t.includes('Ваши мероприятия в этом месяце')) {
      bad.push(`slovo-master-kabinet: кабинет не открылся — судить слово не на чем: «${t.slice(0, 120)}»`);
    } else {
      if (!t.includes('за уровень «Мастер»'))
        bad.push(`slovo-master-kabinet: уровень назван не тем словом, которое человек видит на «Членстве»: «${t.slice(0, 200)}»`);
      if (/уровень организатора/.test(t))
        bad.push('slovo-master-kabinet: вид членства назван «организатором» — это отношение к конкретному мероприятию, а не вид (Cafe13KPG#102)');
    }
    if (s.errs.length) bad.push('slovo-master-kabinet: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  /* ── кабинет мастера в ЖИВОМ режиме (Cafe13KPG#98) ──
     До этого PR экран `organizer` в `WIRED` не входил и на бою не открывался
     вовсе; теперь он кормится из той же афиши, что и обзор. Фикстура даёт ТРИ
     строки: две свои (платная с двумя записями и бесплатная с одной) и одну
     ЧУЖУЮ — без чужой строки проверка «только свои» была бы зелёной при
     любом отборе, и это условие случая, а не украшение. */
  {
    const org = clone(OWNER); org.roles = []; org.membership.level = 'organizer';
    const MOI = [
      EV({ id: 21, title: 'Своё платное', organizer_id: 1, starts_at: atBkk(1, 19),
           kind: 'paid', price: '400.00', seats: 10, taken: 2, seats_left: 8 }),
      EV({ id: 22, title: 'Своё бесплатное', organizer_id: 1, starts_at: atBkk(2, 11),
           kind: 'free', price: '0.00', seats: 5, taken: 1, seats_left: 4 }),
      EV({ id: 23, title: 'Чужое вечером', organizer_id: 500, starts_at: atBkk(1, 20) })
    ];
    const openKab = async (me, reply) => {
      const s = await open(true, true, me, null, null, null,
                           chainQ(evReply(reply || json(200, MOI)), placesReply()), null, NOWFIX);
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(150);
      return s;
    };

    // Кнопка перехода есть у того, кто вправе завести, и она ведёт в кабинет.
    {
      const s = await openKab(json(200, org));
      if (!(await s.p.$('[data-go="organizer"]'))) {
        bad.push('kabinet-vhod: кнопки «Управление своими» нет у того, кто вправе завести — кабинет открывать нечем');
      } else {
        await s.p.click('[data-go="organizer"]');
        await s.p.waitForTimeout(150);
        const t = await s.view();
        if (t.includes('ещё не подключено'))
          bad.push('kabinet-vhod: кабинет в живом режиме говорит «ещё не подключено» — экрана нет в WIRED');
        else if (!t.includes('Ваши мероприятия впереди'))
          bad.push(`kabinet-vhod: кабинет не открылся: «${t.slice(0, 140)}»`);
        else {
          // Картинка здесь не украшение: кабинет живого режима в опись не
          // попадает (она снимается вне Telegram), и посмотреть на него
          // отрисованным больше негде. Стрелку «Назад», смотревшую вперёд,
          // нашли именно так.
          await s.p.screenshot({ path: `${OUT}/live-kabinet.png`, fullPage: true });
          // ТОЛЬКО СВОИ: чужое мероприятие в кабинет не попадает.
          ['Своё платное', 'Своё бесплатное'].forEach(x => {
            if (!t.includes(x)) bad.push(`kabinet-svoi: своего мероприятия «${x}» в кабинете нет`); });
          if (t.includes('Чужое вечером'))
            bad.push('kabinet-svoi: в кабинете ЧУЖОЕ мероприятие — «своё» считается не по organizer_id');
          // ЧИСЛА из живых строк, а не из демонстрации: 2 события, 3 из 15, 20 %.
          ['3 из 15', '20 %'].forEach(x => {
            if (!t.includes(x)) bad.push(`kabinet-chisla: нет «${x}» — числа считаются не из живых строк: «${t.slice(0, 200)}»`); });
          // Деньги — СЧЁТ ПО ЗАПИСЯМ: 2 записи × 400 = 800, и подпись не о собранном.
          if (!t.includes('Если все заплатят'))
            bad.push('kabinet-dengi: сумма по платным не названа предположением');
          if (/Соберёте/.test(t))
            bad.push('kabinet-dengi: «Соберёте» читается как факт о деньгах, а признака оплаты в строке афиши нет вовсе');
          if (!t.includes('800'))
            bad.push(`kabinet-dengi: нет суммы 800 (2 записи × 400): «${t.slice(0, 200)}»`);
          // Правки нет — сказано СТРОКОЙ, а не умолчанием.
          if (!t.includes('сервер правки не умеет'))
            bad.push('kabinet-pravka: отсутствие правки не названо — человек будет искать кнопку');
          if (/Править|Изменить мероприятие/.test(t))
            bad.push('kabinet-pravka: на экране обещана правка, а ручки её нет на сервере');
          // Архив сюда не крадётся: #265 владельцем не открыта.
          if (/Прошедшие|Архив/.test(t))
            bad.push('kabinet-arhiv: кабинет обещает прошедшие — это #265, афиша прошедшего не отдаёт ни при каких параметрах');
          // Пункт ведёт на ЖИВУЮ карточку, где управление уже живёт.
          if (await s.p.$('[data-manage]'))
            bad.push('kabinet-put: пункт ведёт на демонстрационный eventManage (data-manage) — два пути к одному делу');
          else if (!(await s.p.$('[data-event="21"]')))
            bad.push('kabinet-put: пункта своего мероприятия нет вовсе — открывать нечего');
          else {
            await s.p.click('[data-event="21"]');
            await s.p.waitForTimeout(200);
            const c = await s.view();
            if (!c.includes('Управление'))
              bad.push(`kabinet-put: карточка своего без блока «Управление»: «${c.slice(0, 140)}»`);
          }
        }
      }
      if (s.errs.length) bad.push('kabinet-vhod: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }

    // У того, кто завести не вправе, кнопки нет ВОВСЕ — обратная половина.
    {
      const chlen = clone(OWNER); chlen.roles = [];
      const s = await openKab(json(200, chlen));
      if (await s.p.$('[data-go="organizer"]'))
        bad.push('kabinet-prava: кнопка «Управление своими» есть у того, кто не вправе завести мероприятие');
      await s.ctx.close();
    }
  }

  /* ── кончившееся в кабинете метится (Cafe13KPG#361) ──
     Сервер прошедшего в афише не отдаёт, но ответ лежит у клиента в памяти, и
     между ним и взглядом человека проходит время: без пометки строка
     кончившегося неотличима от завтрашней, а числа кабинета считают его
     «впереди». Слово берётся из афиши, второй раз не сочиняется.

     Случай судит ОБЕ стороны — есть у кончившегося и НЕТ у будущего: иначе
     пометка, прибитая ко всем строкам, прошла бы за верную. */
  {
    const org = clone(OWNER); org.roles = []; org.membership.level = 'organizer';
    const ROWS = [
      EV({ id: 41, title: 'Своё завтра', organizer_id: 1, starts_at: atBkk(1, 19),
           kind: 'paid', price: '400.00', seats: 10, taken: 2, seats_left: 8 }),
      EV({ id: 42, title: 'Своё кончившееся', organizer_id: 1,
           starts_at: new Date(NOWFIX - 9000e3).toISOString(), duration_min: 60,
           kind: 'paid', price: '400.00', seats: 10, taken: 3, seats_left: 7 })
    ];
    const s = await open(true, true, json(200, org), null, null, null,
                         chainQ(evReply(json(200, ROWS)), placesReply()), null, NOWFIX);
    await s.p.evaluate(() => go('organizer'));
    await s.p.waitForTimeout(200);
    const rows = await s.p.evaluate(() =>
      [...document.querySelectorAll('#view .listitem')].map(e => e.textContent));
    const konch = rows.filter(t => t.includes('Своё кончившееся'));
    const zavtra = rows.filter(t => t.includes('Своё завтра'));
    if (konch.length !== 1 || zavtra.length !== 1) {
      bad.push(`kabinet-zavershilos: строк в кабинете ${rows.length}, своих ждали две — кончившуюся и завтрашнюю; судить пометку не на чем`);
    } else {
      if (!konch[0].includes('завершилось'))
        bad.push(`kabinet-zavershilos: кончившееся мероприятие стоит под «впереди» БЕЗ пометки «завершилось» — от завтрашнего его не отличить: «${konch[0].trim()}» (Cafe13KPG#361)`);
      if (zavtra[0].includes('завершилось'))
        bad.push(`kabinet-zavershilos: пометка «завершилось» стоит у БУДУЩЕГО мероприятия — метка прибита ко всем строкам, а не считается по событию: «${zavtra[0].trim()}»`);
    }
    if (s.errs.length) bad.push('kabinet-zavershilos: ошибки страницы ' + s.errs.join('; '));
    await s.ctx.close();
  }

  // ── кто записался (#178, вторая половина) ──
  // Список спрашивается только на СВОЁМ мероприятии: на чужое запроса нет
  // вовсе. Обратная проверка обязательна — иначе доказана половина.
  {
    const MY = over => EV(Object.assign({ id: 4, title: 'Мой вечер', organizer_id: 1,
      starts_at: atBkk(1, 19), seats: 12, taken: 3, seats_left: 9 }, over || {}));
    const ALIEN = EV({ id: 7, title: 'Чужой вечер', organizer_id: 500, starts_at: atBkk(1, 20) });
    const ROW = over => Object.assign({ id: 15, first_name: 'Образец', last_name: '',
      booked_at: atBkk(0, 9, 30), state: 'booked', amount_due: '400.00', paid: false }, over || {});
    const LIST = over => Object.assign({ event_id: 4, title: 'Мой вечер', starts_at: atBkk(1, 19),
      seats: 12, state: 'published', taken: 3,
      // Третья строка — `attended`: пришедший гость. Сервер это состояние
      // отдаёт, и живым оно обязано считаться наравне с `booked`.
      bookings: [ROW(), ROW({ id: 16, first_name: 'Второй' }),
                 ROW({ id: 17, first_name: 'Пришедший', state: 'attended' })] }, over || {});

    /* Базовая фикстура моделирует БОЕВОЙ ответ, а на бою снятых не приходит
       вовсе: `event_bookings` отбирает `WHERE b.event_id = %s AND b.state <> 'cancelled'`
       (api `app/routers/events.py:318`, замер по БЛОБУ боевого sha `fa2cebc`,
       снятого с `/health` 24.10.2026 в 18:44 UTC = 25.10 в 01:44 по острову; контроль признака — заведомо иное
       `WHERE b.state = 'cancelled'` в том же файле не находится). Значит ветка
       «Снятые записи» на бою НЕДОСТИЖИМА — и оставлена НАРОЧНО, защитой на
       случай, когда сервер начнёт отдавать снятых: тогда они не попадут в
       счёт живых молча. Это решение, а не недоделка, и названо именно так,
       чтобы следующий не «починил» её удалением.

       Страж ниже держит ДОВОД этого решения, а не саму ветку: как только
       базовая фикстура начнёт отдавать снятых, довод «на бою их нет» перестанет
       моделироваться, и это надо перечитать, а не держать вечно (Cafe13KPG#296).
       Единственное место, где снятая запись подкладывается нарочно, — случай
       `spisok-snyataya`: он судит гипотетическое будущее сервера, а не живой путь. */
    {
      const snyatye = LIST().bookings.filter(b => b.state === 'cancelled');
      if (snyatye.length)
        bad.push(`snyatye-dovod: базовая фикстура списка отдаёт снятых (${snyatye.length}), а она моделирует БОЕВОЙ ответ, где их нет вовсе (api events.py:318 на fa2cebc) — довод «ветка недостижима» больше не моделируется, перечитать`);
    }

    // reply === 'abort' — обрыв сети; иначе ответ ручки списка.
    const openSigned = async (reply, evOver) => {
      const s = await open(true, true, json(200, OWNER), null, null, null, q => {
        const u = q.url();
        if (/\/events\/4\/bookings$/.test(u)) return reply;
        if (u.endsWith('/events')) return json(200, [MY(evOver), ALIEN]);
        return undefined;
      }, null, NOWFIX);
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      await s.p.click('[data-event="4"]');
      await s.p.waitForTimeout(300);
      return s;
    };

    /* Оплата в списке записавшихся (#271, второй шаг). Организатор видит,
       кто уже заплатил: `paid` приходит булевым по каждой записи, и поле
       есть на бою — коммит, который его завёл, предок боевого sha.

       Сторожа считают из САМОЙ фикстуры: событие обязано быть платным, а
       среди живых записей обязаны быть и оплаченная, и неоплаченная. Иначе
       случай слеп — метку «оплачено» на одних оплаченных не отличить от
       метки, прибитой гвоздями. */
    {
      const ev = MY({ kind: 'paid' });
      const rows = [ROW({ id: 31, first_name: 'Заплатил', paid: true }),
                    ROW({ id: 32, first_name: 'Не-заплатил', paid: false }),
                    ROW({ id: 33, first_name: 'Пришедший', state: 'attended', paid: true })];
      const live = rows.filter(r => r.state !== 'cancelled');
      const s = await openSigned(json(200, LIST({ bookings: rows, taken: 3 })), { kind: 'paid' });
      const t = await s.view();
      if (ev.kind !== 'paid')
        bad.push(`signed-oplata: фикстура события имеет вид «${ev.kind}», а случай судит ПЛАТНОЕ — ветка не та, вердикт не выносится`);
      else if (!live.some(r => r.paid) || !live.some(r => !r.paid))
        bad.push('signed-oplata: в фикстуре нет обеих сторон (оплаченной и неоплаченной записи) — метку не с чем сравнить, проверка слепа');
      else {
        ['оплачено', 'не оплачено'].forEach(x => {
          if (!t.includes(x)) bad.push(`signed-oplata: в списке нет метки «${x}»`); });
        const want = 'Оплатили ' + live.filter(r => r.paid).length + ' из ' + live.length;
        if (!t.includes(want)) bad.push(`signed-oplata: нет сводки «${want}», на экране «${t.slice(t.indexOf('Оплатили'), t.indexOf('Оплатили') + 60)}»`);
        // Названо ДЕЙСТВУЮЩЕЕ ЛИЦО, а не возможность: экран читает организатор,
        // который снять чужую запись не может (замер по боевой ревизии).
        if (!t.includes('снимает работник клуба')) bad.push(`signed-oplata: не названо, КТО снимает неоплаченную запись, на экране «${t.slice(t.indexOf('Оплатили'), t.indexOf('Оплатили') + 120)}»`);
        if (t.includes('можно снять')) bad.push('signed-oplata: сводка обещает организатору снятие, которого он не может сделать — чужую запись снимает работник клуба');
      }
      if (s.errs.length) bad.push('signed-oplata: ошибки страницы ' + s.errs.join('; '));
      await s.p.screenshot({ path: `${OUT}/live-signed-oplata.png` });
      await s.ctx.close();
    }

    /* У бесплатного мероприятия метки оплаты нет вовсе: платить нечего, и
       «не оплачено» было бы упрёком ни за что. Донейшн здесь же по смыслу —
       взнос добровольный. */
    {
      const s = await openSigned(json(200, LIST({ bookings: [ROW({ paid: false })], taken: 1 })),
                                 { kind: 'free', price: '0.00', taken: 1, seats_left: 11 });
      const t = await s.view();
      ['оплачено', 'не оплачено', 'Оплатили'].forEach(x => {
        if (t.includes(x)) bad.push(`signed-oplata-free: у бесплатного мероприятия показано «${x}» — платить нечего`); });
      if (!t.includes('Образец')) bad.push('signed-oplata-free: список не отрисовался — проверять нечего');
      if (s.errs.length) bad.push('signed-oplata-free: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }

    /* `paid` разбирается строго булевым: `null` и отсутствие поля на
       правдивость прочитались бы как «не оплачено», то есть поломка сервера
       стала бы на экране обвинением человеку. Отказ целиком — честнее. */
    {
      const s = await openSigned(json(200, LIST({ bookings: [ROW({ paid: null })], taken: 1 })));
      const t = await s.view();
      if (!t.includes('Список не открылся')) bad.push(`signed-paid-null: список с нечитаемой оплатой показан как обычный: «${t.slice(0, 160)}»`);
      if (t.includes('не оплачено')) bad.push('signed-paid-null: нечитаемое поле нарисовано как «не оплачено» — обвинение человеку за поломку сервера');
      if (s.errs.length) bad.push('signed-paid-null: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }

    /* Поздний ответ под ПРЕЖНЕЕ мероприятие молчит. Защита (`gen !==
       SIGNED_GEN`) стояла в коде со дня, когда список писался, и не была
       доказана ни разу: мутация, снимавшая её, оставалась зелёной. Цена:
       ведущий ушёл с одного своего мероприятия на другое — и увидел бы
       записавшихся не на то, то есть позвал бы не тех людей.

       Оба мероприятия СВОИ (organizer_id 1): список спрашивается только на
       своём, и с чужого запроса не уходит вовсе. */
    {
      const MINE_A = MY({ id: 4, title: 'Моё первое' });
      const MINE_B = MY({ id: 8, title: 'Моё второе', starts_at: atBkk(1, 21) });
      const LIST_A = { event_id: 4, title: 'Моё первое', starts_at: atBkk(1, 19), seats: 12,
        state: 'published', taken: 1,
        bookings: [ROW({ id: 21, first_name: 'ПЕРВОГО-СОБЫТИЯ-ГОСТЬ' })] };
      const LIST_B = { event_id: 8, title: 'Моё второе', starts_at: atBkk(1, 21), seats: 12,
        state: 'published', taken: 1,
        bookings: [ROW({ id: 22, first_name: 'ВТОРОГО-СОБЫТИЯ-ГОСТЬ' })] };
      /* Различитель «гонка вообще была»: по коду возврата зелёное от
         работающего гарда неотличимо от зелёного, когда поздний ответ успел
         прийти ДО ухода с экрана. Поэтому случай сам следит за временем:
         запоминает, когда ушёл второй запрос и когда ответил первый, и
         краснеет, если первый успел ответить раньше. */
      const mark = { sentB: 0, doneA: 0 };
      const s = await open(true, true, json(200, OWNER), null, null, null, q => {
        const u = q.url();
        if (/\/events\/4\/bookings$/.test(u))
          return new Promise(r => setTimeout(() => { mark.doneA = Date.now(); r(json(200, LIST_A)); }, 900));
        if (/\/events\/8\/bookings$/.test(u)) { mark.sentB = Date.now(); return json(200, LIST_B); }
        if (u.endsWith('/events')) return json(200, [MINE_A, MINE_B]);
        return undefined;
      }, null, NOWFIX);
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      await s.p.click('[data-event="4"]');
      await s.p.waitForTimeout(100);                 // ответ по первому ещё в пути
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(80);
      await s.p.click('[data-event="8"]');
      await s.p.waitForTimeout(1200);                // поздний ответ по первому уже пришёл
      const t = await s.view();
      if (!t.includes('ВТОРОГО-СОБЫТИЯ-ГОСТЬ'))
        bad.push(`spisok-pozdniy-otvet: списка второго мероприятия на экране нет: «${t.slice(0, 140)}»`);
      if (t.includes('ПЕРВОГО-СОБЫТИЯ-ГОСТЬ'))
        bad.push('spisok-pozdniy-otvet: поздний список ПРЕЖНЕГО мероприятия лёг на карточку нового — ведущий позовёт не тех');
      if (!mark.sentB || !mark.doneA)
        bad.push(`spisok-pozdniy-otvet: гонки не было — запросов ушло не два (B ${mark.sentB ? 'ушёл' : 'НЕ ушёл'}, A ${mark.doneA ? 'ответил' : 'НЕ ответил'}), случай гард не проверяет`);
      else if (mark.doneA < mark.sentB)
        bad.push(`spisok-pozdniy-otvet: гонки не было — первый ответил за ${mark.sentB - mark.doneA} мс ДО ухода на второе, случай гард не проверяет`);
      await s.ctx.close();
    }

    // Свой: список есть, суммы подписаны записью.
    {
      const s = await openSigned(json(200, LIST()));
      const t = await s.view();
      ['Управление', 'Записалось', '3 из 12', 'Образец', 'Второй', 'Пришедший', 'записан на 400 ฿'].forEach(x => {
        if (!t.includes(x)) bad.push(`spisok: нет «${x}»`); });
      /* ⚠ Прежде здесь стоял запрет на ЛЮБОЕ слово об оплате с доводом
         «поле paid сегодня всегда false». Довод устарел, и это замер, а не
         мнение: `BOOKING_PAID` — это `(b.ledger_id IS NOT NULL)`
         (`app/queries.py:227`), а приём денег за запись (`POST /till`,
         `kind=event`) ставит `bookings.ledger_id` (`app/routers/till.py:284`).
         Коммит, который завёл эту ручку (`48a56bc`), — предок БОЕВОГО sha,
         то есть `paid` может быть true уже сегодня. Метку оплаты теперь
         судят свои случаи (`signed-oplata`, `signed-oplata-free`), а здесь
         остаются слова, которых мы не говорим НИГДЕ: «не платил» — чужая
         речь, «к оплате» — речь гостевой карточки, а не списка ведущего. */
      ['не платил', 'к оплате'].forEach(x => {
        if (t.includes(x)) bad.push(`spisok: в списке ведущего чужие слова «${x}»`); });
      // Telegram id наружу не отдаётся и на экране его быть не может
      if (/\b\d{6,}\b/.test(t)) bad.push(`spisok: на экране длинное число — не Telegram id ли: «${t.slice(0, 120)}»`);
      /* Пришедший гость — живая запись, а не снятая. Судится ПОЛОЖЕНИЕМ,
         а не наличием заголовка: прежняя редакция краснела на ЛЮБОМ
         появлении «Снятых записей» словами о attended — то есть на другом
         дефекте обвиняла бы не того. Довод снят замером: в базовой фикстуре
         снятых нет вовсе (страж `snyatye-dovod` выше), значит заголовка здесь не
         должно быть по построению, а если он появился — это два разных дефекта,
         и у каждого свой текст. */
      const posS = t.indexOf('Снятые записи'), posP = t.indexOf('Пришедший');
      if (posS !== -1 && posP > posS)
        bad.push('spisok: пришедший гость (attended) стоит ПОД заголовком «Снятые записи»');
      else if (posS !== -1)
        bad.push('spisok: заголовок «Снятые записи» есть на базовой фикстуре, где снятых нет — ветка рисуется на пустом');
      const posPr = t.indexOf('Пришедший'), posUpr = t.indexOf('Управление');
      if (posPr === -1 || posUpr === -1 || posPr < posUpr)
        bad.push('spisok: пришедшего гостя нет в списке под «Управлением»');
      await s.p.screenshot({ path: `${OUT}/live-spisok.png` });
      await s.ctx.close();
    }

    // ОБРАТНАЯ проверка: на чужом мероприятии ни списка, ни запроса.
    {
      const s = await openSigned(json(200, LIST()));
      await s.p.evaluate(() => go('events'));
      await s.p.waitForTimeout(120);
      await s.p.click('[data-event="7"]');
      await s.p.waitForTimeout(300);
      const t = await s.view();
      // «Образец» — имя ведущего, оно стоит на КАЖДОЙ карточке; признаком
      // списка могут быть только имена из самого списка.
      ['Управление', 'Второй', 'Третий', 'Снятые записи', 'Пока никто не записался'].forEach(x => {
        if (t.includes(x)) bad.push(`spisok-chuzhoy: на ЧУЖОМ мероприятии показано «${x}»`); });
      const asked = s.calls.filter(c => /\/bookings$/.test(c.url) && c.method === 'GET');
      // Запрос мог уйти при входе на СВОЁ (мы там были) — считаем после перехода
      const afterAlien = s.calls.slice(s.calls.findIndex(c => c.url.endsWith('/events')) + 1);
      if (asked.length > 1) bad.push(`spisok-chuzhoy: запросов списка ${asked.length}, на чужое уходить не должно`);
      if (afterAlien.some(c => /\/events\/7\/bookings$/.test(c.url)))
        bad.push('spisok-chuzhoy: за списком чужого мероприятия клиент всё-таки сходил');
      await s.ctx.close();
    }

    // Отказы: у каждого свой текст, и ни один не выглядит пустым списком.
    for (const [name, reply, want, nope] of [
      ['spisok-403', json(403, { detail: 'список записавшихся видит организатор мероприятия или работник клуба' }),
        'Список записавшихся видит организатор мероприятия или работник клуба', 'Пока никто не записался'],
      ['spisok-403-privratnik', json(403, { detail: 'доступа нет' }),
        'Вас ещё не впустили в клуб', 'Доступа нет'],
      ['spisok-404', json(404, { detail: 'мероприятия нет' }),
        'Сервер не знает такого мероприятия', 'Пока никто не записался'],
      ['spisok-set', 'abort', 'Сервер не ответил', 'Пока никто не записался'],
      // Поля НЕТ вовсе — отсекает проверка типа.
      ['spisok-bitiy', json(200, LIST({ bookings: [ROW({ booked_at: undefined })] })),
        'Ответ сервера не разобран', 'Второй'],
      /* Время ЧИСЛОМ: `new Date(1766000000000)` — законная дата, поэтому
         разбор его пропустит, и отсечь его может только проверка типа. Без
         этого случая мутация, снявшая проверку типа, оставалась зелёной —
         не потому, что проверка лишняя, а потому, что отсутствующее поле
         ловилось разбором даты. Числу и отсутствию нужны РАЗНЫЕ случаи. */
      ['spisok-vremya-chislom', json(200, LIST({ bookings: [ROW({ booked_at: 1766000000000 })] })),
        'Ответ сервера не разобран', 'Второй'],
      // Поле ЕСТЬ и строкой, но это не дата — проверку типа оно проходит, и
      // отсечь его может только разбор даты. Без этого случая мутация,
      // снявшая разбор, оставалась зелёной: до него прогон не доходил.
      ['spisok-vremya-ne-data', json(200, LIST({ bookings: [ROW({ booked_at: 'позавчера' })] })),
        'Ответ сервера не разобран', 'Второй'],
      // Сумма приходит строкой; строка, которая не число, — это не ноль.
      ['spisok-summa-bitaya', json(200, LIST({ bookings: [ROW({ amount_due: 'много' })] })),
        'Ответ сервера не разобран', 'записан на']]) {
      const s = await openSigned(reply);
      const t = await s.view();
      if (!t.includes('Список не открылся')) bad.push(`${name}: отказ не назван отказом`);
      if (!t.includes(want)) bad.push(`${name}: нет слов «${want}», на экране: «${t.slice(0, 160)}»`);
      if (t.includes(nope)) bad.push(`${name}: на экране лишнее «${nope}»`);
      await s.ctx.close();
    }

    // Пустой список — ответ, а не отказ, и наоборот.
    {
      const s = await openSigned(json(200, LIST({ taken: 0, bookings: [] })), { taken: 0, seats_left: 12 });
      const t = await s.view();
      if (!t.includes('Пока никто не записался')) bad.push(`spisok-pusto: пустой список не назван пустым: «${t.slice(0, 140)}»`);
      if (t.includes('Список не открылся')) bad.push('spisok-pusto: пустой список показан отказом');
      await s.ctx.close();
    }

    // Снятая запись помечена и не смешана с живыми.
    {
      const s = await openSigned(json(200, LIST({ taken: 2,
        bookings: [ROW(), ROW({ id: 16, first_name: 'Второй' }), ROW({ id: 18, first_name: 'Ушедший', state: 'cancelled' })] })),
        { taken: 2, seats_left: 10 });
      const t = await s.view();
      ['Снятые записи', 'снята', 'Ушедший'].forEach(x => {
        if (!t.includes(x)) bad.push(`spisok-snyataya: нет «${x}»`); });
      const pos = t.indexOf('Снятые записи');
      if (pos !== -1 && t.indexOf('Ушедший') < pos)
        bad.push('spisok-snyataya: снятая запись стоит СРЕДИ живых, а не под своим заголовком');
      await s.ctx.close();
    }

    // Число в афише и число в списке считает сервер в двух местах: расхождение
    // называется словами, а не прячется.
    {
      const s = await openSigned(json(200, LIST({ taken: 5 })));
      const t = await s.view();
      if (!t.includes('Афиша говорит «3», список — «5»'))
        bad.push(`spisok-raskhodyatsya: расхождение чисел не названо: «${t.slice(0, 160)}»`);
      await s.ctx.close();
    }
  }

  // Второе нажатие, пока первое в пути, второй записи не делает.
  {
    const posts = [];
    const s = await openCard(q => {
      const u = q.url();
      if (u.endsWith('/bookings')) { posts.push(q.postData());
        return new Promise(r => setTimeout(() => r(json(201, { id: 6, event_id: 4, state: 'booked', amount_due: '400.00' })), 800)); }
      if (u.endsWith('/events')) return json(200, [freeRow()]);
      return undefined;
    });
    // главной кнопкой и кнопкой на экране — оба пути ведут в одно действие
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.evaluate(() => window.__main && window.__main());
    await s.p.waitForTimeout(1200);
    if (posts.length !== 1) bad.push(`book-dvazhdy: POST /bookings ушёл ${posts.length} раз, ждали 1`);
    await s.ctx.close();
  }

  // ── время события — в поясе клуба, а не телефона и не UTC ──
  // Браузер нарочно живёт в третьем поясе (Нью-Йорк): тогда краснеют обе
  // подмены — и «считаем по телефону», и «считаем в UTC». Ожидание считается
  // НЕЗАВИСИМО: сдвигом ISO на +07:00 руками, а не тем же Intl, что в коде.
  //
  // Момент выбран так, чтобы полночь ПРОШЛА между поясами: иначе день
  // совпадает во всех трёх и проверка дня ничего не различает.
  //   Бангкок  — воскресенье 6 декабря, 01:30
  //   Нью-Йорк — суббота 5 декабря, 13:30
  //   UTC      — суббота 5 декабря, 18:30
  {
    const iso = '2026-12-05T18:30:00Z';
    const wall = new Date(Date.parse(iso) + 7 * 3600e3);
    const hm = wall.toISOString().slice(11, 16);                       // 19:00 по Бангкоку
    const dows = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const label = `${wall.getUTCDate()} ${months[wall.getUTCMonth()]}, ${dows[wall.getUTCDay()]}`;
    const s = await open(true, true, json(200, OWNER), null, null, null,
      evReply(json(200, [EV({ id: 11, title: 'Далёкое событие', starts_at: iso, duration_min: 90 })])),
      'America/New_York', NOWFIX);
    await s.p.evaluate(() => go('events'));
    await s.p.waitForTimeout(150);
    const t = await s.view();
    if (!t.includes(hm)) bad.push(`events-tz: нет времени клуба «${hm}», а есть «${t.slice(0, 80)}»`);
    if (!t.includes(label)) bad.push(`events-tz: нет дня клуба «${label}»`);
    if (t.includes('18:30')) bad.push('events-tz: на экране 18:30 — это UTC, а не пояс клуба');
    if (t.includes('13:30')) bad.push('events-tz: на экране 13:30 — это пояс телефона, а не клуба');
    // День считается там же, где время: в Бангкоке полночь уже прошла.
    if (t.includes('5 декабря')) bad.push('events-tz: на экране 5 декабря — день взят не в поясе клуба');
    if (t.includes('суббота')) bad.push('events-tz: на экране суббота — день недели взят не в поясе клуба');
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
    }, null, NOWFIX);
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
  // ── экран «Люди»: выдача и снятие ответственности (Cafe13KPG#177) ──
  // Снимка /people нет и не будет: в нём tg_user_id живых людей, и в
  // публичный репозиторий он не кладётся (cafe13-api roles.py). Форма
  // заглушки — по коду ручки на стволе 880b4b6. Люди вымышленные.
  {
    const ROSTER = { count: 3, people: [
      { tg_user_id: 701, first_name: 'Алевтина', last_name: 'Тестова', lang: 'ru',
        roles: [{ id: 31, role: 'curator', direction_id: 7, direction: 'Бар', granted_at: '2026-10-20T10:00:00+00:00' }],
        memberships: ['member'] },
      { tg_user_id: 702, first_name: 'Сомчай', last_name: null, lang: 'th', roles: [], memberships: [] },
      { tg_user_id: 703, first_name: 'Глеб', last_name: 'Главный', lang: 'ru',
        roles: [{ id: 6, role: 'admin', direction_id: null, direction: null, granted_at: '2026-10-01T10:00:00+00:00' },
                { id: 5, role: 'head', direction_id: null, direction: null, granted_at: '2026-10-01T10:00:00+00:00' }],
        memberships: ['member', 'partner'] }] };
    const DIRS = [{ id: 7, title: 'Бар', is_active: true, is_open: true }, { id: 8, title: 'Чай', is_active: true, is_open: false },
                  { id: 9, title: 'Старое', is_active: false, is_open: false }];
    const HEAD_ONLY = clone(OWNER); HEAD_ONLY.roles = [{ role: 'head', direction_id: null }];
    const MASTER = clone(OWNER); MASTER.roles = [{ role: 'curator', direction_id: 7 }];
    const peopleCase = (me, r) => open(true, true, json(200, me), null, null, null, q => {
      const u = q.url();
      if (u.endsWith('/people')) return r.people || json(200, ROSTER);
      // r.dirs бывает ФАБРИКОЙ: задержка ответа начинается в момент запроса, а не при заведении случая
      // (готовый промис истекал под нагрузкой раньше, чем случай доходил до проверки)
      // ⚠ r.dirs читается ОДИН раз: у people-late-dirs это геттер со счётчиком, и второе
      // чтение съедало «медленный» первый ответ — гонки не возникало
      if (u.endsWith('/directions')) { const d = r.dirs; return typeof d === 'function' ? d() : d || json(200, DIRS); }
      if (u.endsWith('/roles')) return r.grant || json(201, { id: 40, member_id: 702, role: 'x', direction_id: null, granted_at: '2026-10-21T10:00:00+00:00' });
      if (/\/roles\/\d+\/revoke$/.test(u)) return r.revoke || json(200, { id: 31, member_id: 701, role: 'curator', revoked_at: '2026-10-21T10:00:00+00:00' });
      // исключение (v74): ответ — как у сервера (join.py, revoke_access): строка допуска плюс число оборванных
      if (/\/access\/\d+\/revoke$/.test(u)) return r.out || json(200, { tg_user_id: Number(u.match(/access\/(\d+)/)[1]),
        revoked_at: '2026-10-28T13:00:00+00:00', memberships_ended: 1, note: '' });
      return undefined;
    });
    // вход — с вкладки «Управление» (кадр E46, Cafe13KPG#413), а не с главной: путь
    // проходится так, как его проходит глава клуба, — вкладка, потом строка
    const toPeople = async s => {
      if (!(await s.p.$('#tabs [data-go="manage"]'))) return false;
      await s.p.evaluate(() => document.querySelector('#tabs [data-go="manage"]').click());
      await s.p.waitForTimeout(250);
      if (!(await s.p.$('#view [data-go="people"]'))) return false;
      await s.p.evaluate(() => document.querySelector('#view [data-go="people"]').click());
      await s.p.waitForTimeout(250);
      return true;
    };
    // карточки знают номер строки, а не tg_user_id: 0 Алевтина, 1 Сомчай, 2 Глеб
    const card = (s, k) => `[data-person="${k}"]`;
    const note = (s, k) => s.p.$eval(`${card(s, k)} .note`, e => e.textContent).catch(() => '');
    const posts = (s, re) => s.calls.filter(c => c.method === 'POST' && re.test(c.url));
    // нет кнопки — false, а не исключение: иначе отсутствие кнопки краснело бы
    // падением прогона, а не своим текстом
    const act = (s, a) => s.p.evaluate(a => { const x = document.querySelector(`[data-action="${a}"]`); if (x) x.click(); return !!x; }, a);

    // глава видит вход и список; данные — с сервера, ни одного id на экране
    {
      const s = await peopleCase(OWNER, {});
      if (!(await toPeople(s))) bad.push('people-head: у главы клуба нет входа «Люди»');
      else {
        const t = await s.view();
        // v78 (E47z): уровни и роли — надписи-кнопки; «Ролей нет», «без членства» и «единственный глава
        // клуба» кадр не рисует (последнего главу снять не даст сервер — его отказ словами)
        ['Алевтина Тестова', 'Куратор направления · Бар', 'Сомчай', 'Член клуба', 'Бизнес-партнёр', 'Глава клуба']
          .forEach(x => { if (!t.includes(x)) bad.push(`people-head: нет «${x}»`); });
        const chips = await s.p.$$eval(`${card(s, 2)} .chip`, e => e.map(x => [x.tagName, x.className, x.textContent]));
        if (!chips.some(c => c[0] === 'SPAN' && /paid/.test(c[1]) && c[2] === 'Бизнес-партнёр')) bad.push(`people-head: уровень не чипом «paid» без крестика: ${JSON.stringify(chips)}`);
        if (chips.some(c => c[0] === 'BUTTON' && /paid/.test(c[1]))) bad.push('people-head: уровень нажимается, а ручки снятия уровня на бою нет');
        // tg_user_id — ни текстом, ни в атрибутах разметки
        if (/70[123]/.test(await s.p.evaluate(() => document.getElementById('view').innerHTML))) bad.push('people-head: tg_user_id в разметке');
        // у админа «Снять» у админа есть
        if (!(await s.p.$('[data-action="p-ask:6"]'))) bad.push('people-head: админу нечем снять администратора');
        const stored = await s.p.evaluate(() => JSON.stringify(Object.assign({}, localStorage, sessionStorage)));
        if (/70[123]|Алевтина/.test(stored)) bad.push('people-head: люди из /people легли в хранилище браузера');
        if (s.calls.filter(c => c.url.endsWith('/people')).length !== 1) bad.push('people-head: /people запрошен не один раз');
        await s.p.screenshot({ path: `${OUT}/live-people.png` });
        // поиск по имени прячет чужие карточки
        await s.p.fill('#p-find', 'алев');
        const hid = await s.p.evaluate(() => [...document.querySelectorAll('[data-person]')].map(e => e.hidden));
        if (JSON.stringify(hid) !== '[false,true,true]') bad.push('people-head: поиск «алев» оставил ' + JSON.stringify(hid));
      }
      // кадр формы выдачи: состояние без кадра — состояние, на которое никто не смотрит
      await s.p.fill('#p-find', '');
      await act(s, 'p-open:1'); await act(s, 'p-role:curator');
      await s.p.screenshot({ path: `${OUT}/live-people-form.png` });
      if (s.errs.length) bad.push('people-head: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }

    /* Крестик очистки поиска: цель нажатия, а не цвет.

       Псевдоэлемент `::-webkit-search-cancel-button` не виден ни
       getBoundingClientRect, ни elementFromPoint, ни querySelector — размер
       его измерить нечем. Поэтому цель меряется ПОПАДАНИЕМ: клик в точку и
       вопрос, очистилось ли поле. Системный крестик отзывался только в
       22…28 px от правого края; правило в styles.css даёт 44 px, то есть
       10…46. Точки 14 и 40 лежат внутри нашей цели и вне системной — на
       них проверка и стоит.

       Третья точка — отрицательный контроль: в середине поля клик обязан
       НЕ очищать. Без него прибор, очищающий поле от любого клика, выглядел
       бы исправным. */
    {
      const s = await peopleCase(OWNER, {});
      if (!(await toPeople(s))) bad.push('people-find-clear: у главы клуба нет входа «Люди»');
      else {
        const box = await s.p.evaluate(() => {
          const el = document.getElementById('p-find');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { right: r.right, cy: r.top + r.height / 2, left: r.left };
        });
        if (!box) bad.push('people-find-clear: поля поиска нет — мерить нечем');
        else {
          for (const [dx, ждём] of [[14, true], [40, true], [120, false]]) {
            // крестика не существует у поля без фокуса и без значения
            await s.p.fill('#p-find', 'алев');
            await s.p.focus('#p-find');
            await s.p.waitForTimeout(60);
            await s.p.mouse.click(box.right - dx, box.cy);
            await s.p.waitForTimeout(60);
            const пусто = (await s.p.inputValue('#p-find')) === '';
            if (пусто !== ждём) {
              bad.push(`people-find-clear: клик в ${dx} px от правого края ` +
                       `${пусто ? 'очистил' : 'не очистил'} поле, ждали ` +
                       `${ждём ? 'очистку' : 'сохранение набранного'}`);
            }
          }
        }
      }
      if (s.errs.length) bad.push('people-find-clear: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }

    // мастер (куратор направления): входа нет, и мимо входа экран не грузит людей
    {
      const s = await peopleCase(MASTER, {});
      if (await s.p.$('[data-go="people"]')) bad.push('people-master: у куратора направления есть вход «Люди»');
      if (await s.p.$('#tabs [data-go="manage"]')) bad.push('people-master: у куратора направления есть вкладка «Управление»');
      await s.p.evaluate(() => go('people'));
      await s.p.waitForTimeout(200);
      if (!(await s.view()).includes('может глава клуба')) bad.push('people-master: экран «Люди» не отказал куратору');
      if (s.calls.some(c => c.url.endsWith('/people'))) bad.push('people-master: /people запрошен у куратора');
      await s.ctx.close();
    }

    // админа выдаёт только админ: у главы без admin такой кнопки нет, у админа — есть
    for (const [name, me, want] of [['people-pick-head', HEAD_ONLY, false], ['people-pick-admin', OWNER, true]]) {
      const s = await peopleCase(me, {});
      if (!(await toPeople(s))) { bad.push(`${name}: нет входа «Люди»`); await s.ctx.close(); continue; }
      // админа снимает только админ: у главы на строке администратора кнопки нет, есть подпись
      const ask = !!(await s.p.$('[data-action="p-ask:6"]'));
      if (ask !== want) bad.push(`${name}: «Снять» у администратора ${ask ? 'есть' : 'нет'}, ждали ${want ? 'есть' : 'нет'}`);
      // без права на админа его надпись — чип без крестика, не кнопка
      if (!want && !(await s.p.$$eval('[data-person="2"] span.chip', e => e.map(x => x.textContent))).includes('Администратор')) bad.push(`${name}: надписи «Администратор» без крестика нет`);
      await act(s, 'p-open:1');
      const has = !!(await s.p.$(`${card(s, 1)} [data-action="p-role:admin"]`));
      if (has !== want) bad.push(`${name}: выбор «Администратор» ${has ? 'есть' : 'нет'}, ждали ${want ? 'есть' : 'нет'}`);
      await s.ctx.close();
    }

    // выдача роли направления: без направления не уходит; с ним — тело ровно такое
    {
      const s = await peopleCase(OWNER, { grant: json(201, { id: 40, member_id: 702, role: 'curator', direction_id: 7, granted_at: '2026-10-21T10:00:00+00:00' }) });
      await toPeople(s);
      await act(s, 'p-open:1');
      await act(s, 'p-role:curator');
      if (await s.p.$('[data-action="p-dir:9"]')) bad.push('people-grant-dir: предложено закрытое направление');
      // без направления «Выдать» не нажимается: иначе гарантированный отказ базы
      if (await s.p.evaluate(() => typeof window.__main === 'function')) bad.push('people-grant-dir: главная кнопка есть без направления');
      if (!(await s.view()).includes('Выберите направление.')) bad.push('people-grant-dir: без направления нет подсказки');
      {
        await act(s, 'p-dir:7');
        if (!(await s.p.evaluate(() => typeof window.__main === 'function'))) bad.push('people-grant-dir: с направлением нет главной кнопки');
        await s.p.evaluate(() => window.__main());
        await s.p.waitForTimeout(300);
        const pp = posts(s, /\/roles$/);
        if (pp.length !== 1 || pp[0].body !== JSON.stringify({ member_id: 702, role: 'curator', direction_id: 7 }))
          bad.push('people-grant-dir: ушло ' + JSON.stringify(pp.map(c => c.body)));
        if (!(await note(s, 1)).includes('Выдано: Куратор направления · Бар.')) bad.push('people-grant-dir: в карточке нет итога «Выдано»');
        if (s.calls.filter(c => c.url.endsWith('/people')).length !== 2) bad.push('people-grant-dir: список не перечитан после выдачи');
      }
      await s.ctx.close();
    }

    // общая роль уходит без direction_id
    {
      const s = await peopleCase(OWNER, { grant: json(201, { id: 41, member_id: 702, role: 'ops_director', direction_id: null, granted_at: '2026-10-21T10:00:00+00:00' }) });
      await toPeople(s);
      await act(s, 'p-open:1');
      await act(s, 'p-role:ops_director');
      await s.p.evaluate(() => window.__main && window.__main());
      await s.p.waitForTimeout(300);
      const pp = posts(s, /\/roles$/);
      if (pp.length !== 1 || pp[0].body !== JSON.stringify({ member_id: 702, role: 'ops_director' }))
        bad.push('people-grant-general: ушло ' + JSON.stringify(pp.map(c => c.body)));
      if (!(await note(s, 1)).includes('Выдано: Операционный директор.')) bad.push('people-grant-general: в карточке нет итога «Выдано»');
      await s.ctx.close();
    }

    // отказы — текстом сервера, в карточке того, кого касаются; успехом не притворяются
    for (const [name, step, reply, detail] of [
      ['people-grant-409', 'grant', json(409, { detail: 'такая живая роль у человека уже есть' }), 'Такая живая роль у человека уже есть.'],
      ['people-grant-403', 'grant', json(403, { detail: 'системного администратора выдаёт и снимает только администратор' }), 'Системного администратора выдаёт и снимает только администратор.'],
      ['people-revoke-last-head', 'revoke', json(409, { detail: 'это последний глава клуба: сначала назначьте другого, иначе выдавать роли станет некому' }),
        'Это последний глава клуба: сначала назначьте другого, иначе выдавать роли станет некому.']]) {
      const s = await peopleCase(OWNER, { [step]: reply });
      await toPeople(s);
      const uid = step === 'grant' ? 1 : 2;
      if (step === 'grant') {
        await act(s, 'p-open:1'); await act(s, 'p-role:director');
        await s.p.evaluate(() => window.__main && window.__main());
      } else {
        // окно отмены вместо вопроса (E47l): сначала полоса и ни одного запроса, потом — ровно один
        await s.p.evaluate(() => { UNDO_MS = 150; });
        await act(s, 'p-ask:5');
        if (posts(s, /revoke/).length) bad.push(`${name}: снятие ушло сразу, окна отмены нет`);
        if (!(await s.view()).includes('Снимаем: Глава клуба')) bad.push(`${name}: нет полосы «Снимаем: Глава клуба»`);
      }
      await s.p.waitForTimeout(300);
      if (step === 'revoke' && (posts(s, /\/roles\/5\/revoke$/).length !== 1)) bad.push(`${name}: снятие не ушло ровно один раз`);
      const deny = await s.p.$eval(`${card(s, uid)} .deny`, e => e.textContent).catch(() => null);
      if (deny !== detail) bad.push(`${name}: плашка «${deny}», ждали «${detail}»`);
      if ((await s.view()).match(/Выдано:|Снято:/)) bad.push(`${name}: отказ показан успехом`);
      await s.ctx.close();
    }

    // единственное направление ставится само: выбор из одного — формальность
    {
      const s = await peopleCase(OWNER, { dirs: json(200, [{ id: 7, title: 'Бар', is_active: true, is_open: true }]),
        grant: json(201, { id: 40, member_id: 702, role: 'bar', direction_id: 7, granted_at: '2026-10-21T10:00:00+00:00' }) });
      await toPeople(s);
      await act(s, 'p-open:1'); await act(s, 'p-role:bar');
      if (!(await s.p.$(`${card(s, 1)} [data-action="p-dir:7"][aria-pressed="true"]`))) bad.push('people-one-dir: единственное направление не выбрано само');
      await s.p.evaluate(() => window.__main && window.__main());
      await s.p.waitForTimeout(300);
      const pp = posts(s, /\/roles$/);
      if (pp.length !== 1 || pp[0].body !== JSON.stringify({ member_id: 702, role: 'bar', direction_id: 7 }))
        bad.push('people-one-dir: ушло ' + JSON.stringify(pp.map(c => c.body)));
      await s.ctx.close();
    }

    // одно направление, и роль в нём у человека уже есть: закрыта сама роль — ни 409, ни тупика
    // «выберите направление», где выбрать нечего (нашли arhitector-47 и designer-55)
    {
      const s = await peopleCase(OWNER, { dirs: json(200, [{ id: 7, title: 'Бар', is_active: true, is_open: true }]) });
      await toPeople(s);
      await act(s, 'p-open:0');
      const role = await s.p.$eval(`${card(s, 0)} [data-action="p-role:curator"]`, e => ({ off: e.disabled, t: e.textContent })).catch(() => null);
      if (!role || !role.off || !role.t.includes('уже есть')) bad.push('people-one-dir-held: «Куратор направления» не закрыт, хотя единственное направление занято: ' + JSON.stringify(role));
      await act(s, 'p-role:curator');
      if (await s.p.$(`${card(s, 0)} [data-action="p-dir:7"][aria-pressed="true"]`)) bad.push('people-one-dir-held: выбрано занятое направление');
      if (await s.p.evaluate(() => typeof window.__main === 'function')) bad.push('people-one-dir-held: «Выдать» нажимается на занятую пару');
      await s.p.evaluate(() => window.__main && window.__main()); await s.p.waitForTimeout(200);
      if (posts(s, /\/roles$/).length) bad.push('people-one-dir-held: ушёл дубль роли');
      await s.ctx.close();
    }

    // два направления: занято одно — роль открыта, само ничего не ставится;
    // заняты оба — роль закрыта (правило одно с общими ролями)
    {
      const s = await peopleCase(OWNER, {});
      await toPeople(s);
      await act(s, 'p-open:0');
      if (await s.p.$(`${card(s, 0)} [data-action="p-role:curator"][disabled]`)) bad.push('people-two-dirs-one-held: роль закрыта, хотя «Чай» свободен');
      await act(s, 'p-role:curator');
      if (await s.p.$(`${card(s, 0)} [data-action^="p-dir:"][aria-pressed="true"]`)) bad.push('people-two-dirs-one-held: направление выбрано само из двух');
      await s.ctx.close();
    }
    {
      const both = clone(ROSTER);
      both.people[0].roles.push({ id: 33, role: 'curator', direction_id: 8, direction: 'Чай', granted_at: '2026-10-20T10:00:00+00:00' });
      const s = await peopleCase(OWNER, { people: json(200, both) });
      await toPeople(s);
      await act(s, 'p-open:0');
      const role = await s.p.$eval(`${card(s, 0)} [data-action="p-role:curator"]`, e => ({ off: e.disabled, t: e.textContent })).catch(() => null);
      if (!role || !role.off || !role.t.includes('уже есть')) bad.push('people-two-dirs-held: «Куратор направления» не закрыт, хотя заняты оба направления: ' + JSON.stringify(role));
      await act(s, 'p-role:curator');
      if (await s.p.evaluate(() => typeof window.__main === 'function')) bad.push('people-two-dirs-held: «Выдать» нажимается');
      await s.ctx.close();
    }

    // направления не загрузились: роль направления НЕ закрыта («заняты все» на пустом
    // перечне — ложь), а причина видна словами
    {
      const s = await peopleCase(OWNER, { dirs: json(500, { detail: 'x' }) });
      await toPeople(s);
      await act(s, 'p-open:1');
      if (await s.p.$(`${card(s, 1)} [data-action="p-role:curator"][disabled]`)) bad.push('people-dirs-failed: роль куратора закрыта, хотя направления просто не пришли');
      await act(s, 'p-role:curator');
      if (!(await s.view()).includes('Направления не загрузились: Сервер ответил кодом 500.')) bad.push('people-dirs-failed: нет причины «Направления не загрузились»');
      if ((await s.view()).includes('открытых направлений в клубе нет')) bad.push('people-dirs-failed: ложная фраза «открытых направлений нет», а перечень просто не пришёл');
      if (await s.p.evaluate(() => typeof window.__main === 'function')) bad.push('people-dirs-failed: «Выдать» нажимается без направления');
      await s.ctx.close();
    }

    // направления ещё грузятся: роль открыта, «Загружаем…», и ни слова о том, что их нет
    {
      const s = await peopleCase(OWNER, { dirs: () => new Promise(r => setTimeout(() => r(json(200, DIRS)), 2000)) });
      await toPeople(s);
      await act(s, 'p-open:1');
      if (await s.p.$(`${card(s, 1)} [data-action="p-role:curator"][disabled]`)) bad.push('people-dirs-loading: роль куратора закрыта, пока перечень грузится');
      await act(s, 'p-role:curator');
      const t = await s.view();
      if (!t.includes('Загружаем направления…')) bad.push('people-dirs-loading: нет «Загружаем направления…»');
      if (t.includes('открытых направлений в клубе нет')) bad.push('people-dirs-loading: ложная фраза «открытых направлений нет», а перечень ещё грузится');
      // закрыть после ответа: fulfill на закрытой странице роняет прогон
      await s.p.waitForTimeout(2200);
      await s.ctx.close();
    }

    // направления пришли, но их ноль (все сняты): роль закрыта, причина словами, а не пустой сегмент
    for (const [name, dirs] of [['people-dirs-empty', []], ['people-dirs-all-closed', [{ id: 9, title: 'Старое', is_active: false, is_open: false }]]]) {
      const s = await peopleCase(OWNER, { dirs: json(200, dirs) });
      await toPeople(s);
      await act(s, 'p-open:1');
      const role = await s.p.$eval(`${card(s, 1)} [data-action="p-role:curator"]`, e => ({ off: e.disabled, t: e.textContent })).catch(() => null);
      if (!role || !role.off || !role.t.includes('направлений нет')) bad.push(`${name}: «Куратор направления» не закрыт словами: ` + JSON.stringify(role));
      if (!(await s.view()).includes('открытых направлений в клубе нет')) bad.push(`${name}: нет причины «открытых направлений нет»`);
      await act(s, 'p-role:curator');
      if ((await s.view()).includes('Выберите направление.')) bad.push(`${name}: подсказка просит выбрать из пустого перечня`);
      if (await s.p.evaluate(() => typeof window.__main === 'function')) bad.push(`${name}: «Выдать» нажимается`);
      // общая роль при этом выдаётся как обычно
      if (await s.p.$(`${card(s, 1)} [data-action="p-role:director"][disabled]`)) bad.push(`${name}: закрыта и общая роль`);
      await s.ctx.close();
    }

    // ответ 200/201, который не про это действие, — не успех: «не разобран», без «Выдано/Снято»
    for (const [name, step, reply] of [
      ['people-revoke-no-revoked-at', 'revoke', json(200, { id: 31, member_id: 701, role: 'curator' })],
      ['people-revoke-other-id', 'revoke', json(200, { id: 32, member_id: 701, role: 'curator', revoked_at: '2026-10-21T10:00:00+00:00' })],
      ['people-grant-other-role', 'grant', json(201, { id: 40, member_id: 702, role: 'director', direction_id: null, granted_at: '2026-10-21T10:00:00+00:00' })],
      ['people-grant-other-person', 'grant', json(201, { id: 40, member_id: 701, role: 'ops_director', direction_id: null, granted_at: '2026-10-21T10:00:00+00:00' })]]) {
      const s = await peopleCase(OWNER, { [step]: reply });
      await toPeople(s);
      const k = step === 'grant' ? 1 : 0;
      if (step === 'grant') { await act(s, 'p-open:1'); await act(s, 'p-role:ops_director'); await s.p.evaluate(() => window.__main && window.__main()); }
      else { await s.p.evaluate(() => { UNDO_MS = 50; }); await act(s, 'p-ask:31'); }
      await s.p.waitForTimeout(300);
      const deny = await s.p.$eval(`${card(s, k)} .deny`, e => e.textContent).catch(() => null);
      if (deny !== 'Ответ сервера не разобран.') bad.push(`${name}: плашка «${deny}», ждали «Ответ сервера не разобран.»`);
      if (/Выдано:|Снято:/.test(await s.view())) bad.push(`${name}: чужой ответ показан успехом`);
      await s.ctx.close();
    }

    // уже выданное второй раз не предлагается: общая роль закрыта, роль
    // направления закрыта только на том направлении, где она уже есть
    {
      const s = await peopleCase(OWNER, {});
      await toPeople(s);
      await act(s, 'p-open:2');
      if (!(await s.p.$(`${card(s, 2)} [data-action="p-role:head"][disabled]`))) bad.push('people-held: «Глава клуба» у главы не закрыта');
      if (await s.p.$(`${card(s, 2)} [data-action="p-role:director"][disabled]`)) bad.push('people-held: «Директор» закрыт без причины');
      await act(s, 'p-open:0'); await act(s, 'p-role:curator');
      await s.p.waitForTimeout(100);
      if (!(await s.p.$(`${card(s, 0)} [data-action="p-dir:7"][disabled]`))) bad.push('people-held: куратору Бара снова предложен Бар');
      if (await s.p.$(`${card(s, 0)} [data-action="p-role:curator"][disabled]`)) bad.push('people-held: роль куратора закрыта целиком, а другое направление законно');
      await s.ctx.close();
    }

    // #213: «Выдать»/«Снять» без ожидания ответа, уход и возврат — экран не заперт,
    // а поздний ответ прежнего захода на новый экран не ложится. Первый запрос
    // медленный, второй быстрый; тело медленного — нечитаемый маркер.
    for (const [name, step, start, again, re] of [
      ['people-late-grant', 'grant', ['p-open:1', 'p-role:ops_director', 'main'], ['p-open:1', 'p-role:ops_director', 'main'], /\/roles$/],
      ['people-late-revoke', 'revoke', ['short', 'p-ask:31'], ['short', 'p-ask:31'], /\/roles\/31\/revoke$/],
    ]) {
      // задержка считается от самого запроса: таймер, заведённый при создании
      // случая, истекал ещё до ухода с экрана, и мутация на гард оставалась зелёной
      let n = 0, landed = false;
      const slow = () => new Promise(r => setTimeout(() => { landed = true; r(json(409, { detail: 'qzx-позд-qzx' })); }, 1500));
      const r = { get [step]() { n++; return n === 1 ? slow() : undefined; } };
      const s = await peopleCase(OWNER, r);
      await toPeople(s);
      // 'short' — окно отмены в 50 мс: снятие уходит по таймеру окна, а не вторым нажатием (v78)
      const run = async steps => { for (const a of steps) { if (a === 'main') await s.p.evaluate(() => window.__main && window.__main());
        else if (a === 'short') await s.p.evaluate(() => { UNDO_MS = 50; }); else await act(s, a); } };
      await run(start);
      await s.p.waitForTimeout(100);
      await s.p.evaluate(() => { go('home'); go('people'); });
      await s.p.waitForTimeout(300);
      await run(again);
      await s.p.waitForTimeout(300);
      if (posts(s, re).length !== 2) bad.push(`${name}: после ухода и возврата запрос не ушёл — экран заперт (ушло ${posts(s, re).length})`);
      // различитель: без него зелёное на мутации гарда значит и «гонки не было»
      if (landed) bad.push(`${name}: первый ответ пришёл раньше второго запроса — гонки не было, случай гардов не проверяет`);
      await s.p.waitForTimeout(1600);
      if ((await s.view()).includes('qzx')) bad.push(`${name}: поздний ответ прежнего захода лёг на новый экран`);
      await s.ctx.close();
    }

    // #214: поздний список прежнего захода (люди или направления) не ложится на
    // свежий. Первый ответ медленный, уход и возврат дают второй, быстрый.
    // Прежний — с нечитаемой меткой в имени человека или названии направления.
    for (const [name, step, re, stale, fresh, look] of [
      ['people-late-roster', 'people', /\/people$/,
        json(200, { count: 3, people: ROSTER.people.map((x, i) => i ? x : Object.assign({}, x, { first_name: 'qzx-список-qzx' })) }),
        json(200, ROSTER), []],
      ['people-late-dirs', 'dirs', /\/directions$/,
        json(200, DIRS.map((x, i) => i ? x : Object.assign({}, x, { title: 'qzx-напр-qzx' }))),
        json(200, DIRS), ['p-open:1', 'p-role:curator']],
    ]) {
      let n = 0, landed = false;
      const slow = () => new Promise(r => setTimeout(() => { landed = true; r(stale); }, 1500));
      const r = { get [step]() { n++; return n === 1 ? slow() : fresh; } };
      const s = await peopleCase(OWNER, r);
      if (!(await toPeople(s))) { bad.push(`${name}: нет входа «Люди»`); await s.ctx.close(); continue; }
      await s.p.evaluate(() => { go('home'); go('people'); });
      await s.p.waitForTimeout(300);
      const gets = s.calls.filter(c => c.method === 'GET' && re.test(c.url)).length;
      if (gets !== 2) bad.push(`${name}: возврат не перечитал (запросов ${gets})`);
      if (landed) bad.push(`${name}: прежний ответ пришёл раньше второго запроса — гонки не было, случай гарда не проверяет`);
      await s.p.waitForTimeout(1600);
      for (const a of look) await act(s, a);
      await s.p.waitForTimeout(100);
      if ((await s.view()).includes('qzx')) bad.push(`${name}: прежний ответ лёг на свежий экран`);
      await s.ctx.close();
    }

    // #214: второй тап главной кнопки, пришедший до того, как она спряталась,
    // не отправляет второй запрос. Обработчик берётся до первого вызова и
    // зовётся дважды — так приходит тап, поставленный в очередь раньше скрытия.
    {
      const s = await peopleCase(OWNER, { grant: new Promise(() => {}) });
      await toPeople(s);
      await act(s, 'p-open:1'); await act(s, 'p-role:ops_director');
      await s.p.evaluate(() => { const f = window.__main; f && f(); f && f(); });
      await s.p.waitForTimeout(300);
      const pp = posts(s, /\/roles$/).length;
      if (pp !== 1) bad.push(`people-double: двойной тап «Выдать» отправил ${pp} запросов, а не один`);
      await s.ctx.close();
    }
    // видимая сторона блокировки: пока «Выдать» в пути — надпись «Выдаём…»,
    // кнопки карточки заперты (замечание архитектора и координатора к #46)
    {
      const s = await peopleCase(OWNER, { grant: new Promise(() => {}) });
      await toPeople(s);
      await act(s, 'p-open:1'); await act(s, 'p-role:ops_director');
      await s.p.evaluate(() => window.__main && window.__main());
      await s.p.waitForTimeout(150);
      const v = await s.p.evaluate(() => {
        const b = document.querySelector('#view [data-action="p-grant"]');
        const c = document.querySelector('#view [data-action="p-close"]');
        return { text: b && b.textContent.trim(), dis: !!(b && b.disabled), close: !!(c && c.disabled) };
      });
      if (v.text !== 'Выдаём…') bad.push(`people-busy-look: пока выдача в пути, на кнопке «${v.text}», а не «Выдаём…»`);
      if (!v.dis || !v.close) bad.push(`people-busy-look: пока выдача в пути, кнопки не заперты (Выдать ${v.dis}, Отмена ${v.close})`);
      await s.ctx.close();
    }
    // то же для «Точно снять»: два нажатия, поставленные в очередь до перерисовки
    {
      const s = await peopleCase(OWNER, { revoke: new Promise(() => {}) });
      await toPeople(s);
      await act(s, 'p-ask:31');
      await s.p.evaluate(() => { doAction('p-revoke:31'); doAction('p-revoke:31'); });
      await s.p.waitForTimeout(300);
      const pp = posts(s, /\/roles\/31\/revoke$/).length;
      if (pp !== 1) bad.push(`people-double-revoke: двойное «Точно снять» отправило ${pp} запросов, а не один`);
      // E47k: пока сервер отвечает, надпись на месте, но погашена и не нажимается
      const busy = await s.p.$eval('[data-person="0"] .chip.busy', e => [e.tagName, e.textContent]).catch(() => null);
      if (!busy || busy[0] !== 'SPAN' || !/Куратор направления/.test(busy[1])) bad.push(`people-chip-busy: снимаемая надпись не погашена на время ответа (E47k): ${JSON.stringify(busy)}`);
      await s.ctx.close();
    }

    // снятие: подтверждение → запрос → итог и перечитанный список
    {
      const s = await peopleCase(OWNER, {});
      await toPeople(s);
      await s.p.evaluate(() => { UNDO_MS = 150; });
      await act(s, 'p-ask:31');
      await act(s, 'p-keep');
      await s.p.waitForTimeout(300);              // окно истекло бы — но «Отменить» его снял
      if (posts(s, /revoke/).length) bad.push('people-revoke: «Отменить» не снял окно — снятие ушло');
      await act(s, 'p-ask:31');
      if (posts(s, /revoke/).length) bad.push('people-revoke: снятие ушло сразу, без окна отмены');
      await s.p.waitForTimeout(400);
      if (posts(s, /\/roles\/31\/revoke$/).length !== 1) bad.push('people-revoke: снятие не ушло ровно один раз');
      if (!(await note(s, 0)).includes('Снято: Куратор направления · Бар.')) bad.push('people-revoke: в карточке нет итога «Снято»');
      if (s.calls.filter(c => c.url.endsWith('/people')).length !== 2) bad.push('people-revoke: список не перечитан');
      await s.ctx.close();
    }

    // список не дали: текст отказа сервера или «не разобран», а не пустой список
    for (const [name, reply, want] of [
      ['people-403', json(403, { detail: 'роли выдаёт и снимает глава клуба' }), 'Роли выдаёт и снимает глава клуба.'],
      ['people-404', json(404, { detail: 'Not Found' }), 'Сервер ответил кодом 404.'],
      ['people-broken', json(200, { people: [{ tg_user_id: 1, first_name: 'Х', roles: [{ role: 'head' }], memberships: [] }] }), 'Ответ сервера не разобран.']]) {
      const s = await peopleCase(OWNER, { people: reply });
      await toPeople(s);
      const t = await s.view();
      if (!t.includes(want)) bad.push(`${name}: нет «${want}»`);
      if (await s.p.$('[data-person]')) bad.push(`${name}: при отказе нарисован список`);
      await s.ctx.close();
    }

    // ── «Члены клуба»: уровень, остаток, порядок (кадры E47, E47e; Cafe13KPG#413, v73) ──
    // Остатки ВЫДУМАНЫ и разные, один нулевой строкой: «0.00» — настоящий ноль, его не прячут.
    const withBal = clone(ROSTER);
    withBal.people[0].balance = '9950.00'; withBal.people[1].balance = '0.00'; withBal.people[2].balance = '250.50';
    const moneyOf = s => s.p.evaluate(() => [...document.querySelectorAll('[data-person]')]
      .map(c => [c.getAttribute('data-person'), (c.querySelector('[data-money]') || {}).textContent]));
    const BANNER = 'Остаток сервер не отдаёт';
    {
      const n = 'members-balance', s = await peopleCase(OWNER, { people: json(200, withBal) });
      await toPeople(s);
      const m = Object.fromEntries(await moneyOf(s));
      if (m['0'] !== '9 950 ฿' || m['1'] !== '0 ฿' || m['2'] !== '250.50 ฿') bad.push(`${n}: остатки ${JSON.stringify(m)}, ждали 9 950 ฿ / 0 ฿ / 250.50 ฿`);
      const t = await s.view();
      if (t.includes(BANNER)) bad.push(`${n}: плашка «сервер не отдаёт» при остатках с сервера — ноль прочитан как отсутствие`);
      // порядок: живые членства наверх, внутри — как у сервера. Сервер даёт 0 Алевтина (член),
      // 1 Сомчай (без членства), 2 Глеб (член и партнёр) — экран обязан 0, 2, 1.
      const order = await s.p.evaluate(() => [...document.querySelectorAll('[data-person]')].map(c => c.getAttribute('data-person')));
      if (JSON.stringify(order) !== '["0","2","1"]') bad.push(`${n}: порядок карточек ${JSON.stringify(order)}, ждали ["0","2","1"] — живые членства наверх`);
      // (в v73 здесь стоял запрет «Исключить» на экране — с v74 кнопка есть, её держат случаи out-*)
      await s.p.screenshot({ path: `${OUT}/live-members.png` });
      await s.ctx.close();
    }
    {
      const n = 'members-no-balance', s = await peopleCase(OWNER, {});
      await toPeople(s);
      const t = await s.view();
      if (!t.includes(BANNER)) bad.push(`${n}: поля остатка нет, а плашки «${BANNER}» нет (кадр E47e)`);
      const m = await moneyOf(s);
      if (m.length !== 3 || m.some(x => x[1] !== '—')) bad.push(`${n}: без поля остатка ждали «—» у всех трёх, есть ${JSON.stringify(m)}`);
      if (/฿/.test(m.map(x => x[1]).join(''))) bad.push(`${n}: без поля остатка показаны деньги — отсутствие стало правдоподобным нулём`);
      await s.ctx.close();
    }
    {
      const n = 'members-bad-balance', bad1 = clone(withBal); bad1.people[1].balance = 'много';
      const s = await peopleCase(OWNER, { people: json(200, bad1) });
      await toPeople(s);
      if (!(await s.view()).includes('Ответ сервера не разобран.') || await s.p.$('[data-person]')) bad.push(`${n}: остаток не числом принят — ответ обязан отвергнуться целиком`);
      await s.ctx.close();
    }

    // ── место при перерисовке (Cafe13KPG#490): тот же экран — место сохраняется, другой — сверху ──
    // Список длинный нарочно: в короткий экран прокрутке нечего беречь, и случай прошёл бы по построению.
    {
      const n = 'keep-place', long = clone(ROSTER);
      for (let i = 0; i < 12; i++) long.people.push({ tg_user_id: 710 + i, first_name: 'Запасной ' + (i + 1), last_name: null, lang: 'ru',
        roles: [{ id: 60 + i, role: 'staff', direction_id: null, direction: null, granted_at: '2026-10-20T10:00:00+00:00' }], memberships: [] });
      const s = await peopleCase(OWNER, { people: json(200, long) });
      await toPeople(s);
      const room = await s.p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      if (room < 400) bad.push(`${n}: прокручивать некуда (${room} px) — случай не проверяет место`);
      await s.p.evaluate(() => window.scrollTo(0, 600)); await s.p.waitForTimeout(100);
      const before = await s.p.evaluate(() => window.scrollY);
      // перерисовка экрана ЦЕЛИКОМ на том же экране. С v78 действия внутри карточки render() не зовут
      // (частичная перерисовка), поэтому render() зовётся прямо — иначе случай проверял бы не его
      await s.p.evaluate(() => render()); await s.p.waitForTimeout(150);
      const after = await s.p.evaluate(() => window.scrollY);
      if (before < 500) bad.push(`${n}: прокрутка не встала (${before}) — сравнивать нечего`);
      else if (Math.abs(after - before) > 2) bad.push(`${n}: после действия на том же экране место уехало: было ${before}, стало ${after}`);
      // другой экран — сверху. ⚠ Цель обязана быть ДЛИННОЙ: короткий экран (вкладка «Управление»)
      // браузер сам прижимает к нулю, и мутация «никогда наверх» проходила зелёной (mk2 на a4d35ed).
      // Тот же длинный список под другим параметром — другой экран для render(), место ему не своё.
      await s.p.evaluate(() => window.scrollTo(0, 600)); await s.p.waitForTimeout(100);
      await s.p.evaluate(() => go('people', 'другой')); await s.p.waitForTimeout(200);
      const room2 = await s.p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const other = await s.p.evaluate(() => window.scrollY);
      if (room2 < 400) bad.push(`${n}: экрану-цели некуда прокручиваться (${room2} px) — «сверху» не различить`);
      else if (other !== 0) bad.push(`${n}: другой экран открылся не сверху (${other})`);
      await s.p.evaluate(() => document.querySelector('#tabs [data-go="manage"]').click()); await s.p.waitForTimeout(200);
      if (await s.p.evaluate(() => window.scrollY) !== 0) bad.push(`${n}: вкладка открылась не сверху`);
      await s.ctx.close();
    }

    // ── частичная перерисовка (Cafe13KPG#490, v78): действие в карточке не трогает соседние ──
    // Различитель — метка, поставленная в СОСЕДНЮЮ карточку и в поле поиска: полная перерисовка её стирает.
    {
      const n = 'people-partial', s = await peopleCase(OWNER, { people: json(200, withBal) });
      await toPeople(s);
      await s.p.evaluate(() => { document.querySelector('[data-person="1"]').setAttribute('data-mark', 'x');
                                 document.getElementById('p-find').setAttribute('data-mark', 'x'); });
      await act(s, 'p-ask:31'); await s.p.waitForTimeout(150);
      if (!(await s.view()).includes('Снимаем: Куратор направления · Бар')) bad.push(`${n}: полоса отмены у своей карточки не появилась`);
      const marks = await s.p.evaluate(() => [!!document.querySelector('[data-person="1"][data-mark]'), !!document.querySelector('#p-find[data-mark]')]);
      if (!marks[0] || !marks[1]) bad.push(`${n}: действие в одной карточке перерисовало экран целиком (соседняя ${marks[0]}, поиск ${marks[1]})`);
      // и обратный ход: открыли форму у другой — у первой вопрос закрылся (перерисованы ОБЕ)
      await act(s, 'p-open:2'); await s.p.waitForTimeout(150);
      if ((await s.view()).includes('Снимаем: Куратор')) bad.push(`${n}: полоса отмены прежней карточки осталась — перерисована только новая`);
      if (!(await s.p.$('[data-person="2"] [data-action="p-close"]'))) bad.push(`${n}: форма во второй карточке не открылась`);
      await s.ctx.close();
    }

    // ── окно отмены (E47l, v78): цифра в полосе = задержка в коде; «Отменить» — запроса нет; вышло — ровно один ──
    // Задержка в случае НЕ равна 5 нарочно: при цифре, вписанной в разметку руками, «5 == 5» прошло бы по построению.
    {
      const n = 'people-undo', s = await peopleCase(OWNER, {});
      await toPeople(s);
      await s.p.evaluate(() => { UNDO_MS = 3000; });
      await act(s, 'p-ask:31'); await s.p.waitForTimeout(60);
      const sec = await s.p.$eval('.undo .sec', e => e.textContent).catch(() => null);
      if (sec !== '3') bad.push(`${n}: в полосе «${sec}», а задержка 3 с — цифра и задержка разошлись`);
      if (posts(s, /revoke/).length) bad.push(`${n}: снятие ушло сразу, окна нет`);
      if (await s.p.$('[data-person="0"] [data-action="p-ask:31"]')) bad.push(`${n}: в окне отмены надпись роли осталась нажимаемой (E47l)`);
      await act(s, 'p-keep');
      if (await s.p.$('.undo')) bad.push(`${n}: «Отменить» не убрал полосу`);
      if (!(await s.p.$('[data-person="0"] [data-action="p-ask:31"]'))) bad.push(`${n}: после «Отменить» надпись роли не вернулась`);
      await s.p.evaluate(() => { UNDO_MS = 200; });
      await act(s, 'p-ask:31'); await s.p.waitForTimeout(600);
      const pp = posts(s, /\/roles\/31\/revoke$/).length;
      if (pp !== 1) bad.push(`${n}: окно вышло — запросов ${pp}, ждали ровно 1`);
      await s.ctx.close();
    }

    // ── «Исключить» (кадры E47v, E47d, E47g, E47zh; v74) ──
    const outs = s => s.calls.filter(c => c.method === 'POST' && /\/access\/\d+\/revoke$/.test(c.url)).map(c => c.url.match(/access\/(\d+)/)[1]);
    // по ID ЧЕЛОВЕКА, а не по месту карточки: исключаем ВТОРОГО ПО ОТРИСОВКЕ (это третий в ответе, Глеб 703)
    {
      const n = 'out-by-id', s = await peopleCase(OWNER, { people: json(200, withBal) });
      await toPeople(s);
      const second = await s.p.evaluate(() => [...document.querySelectorAll('[data-person]')][1].getAttribute('data-person'));
      if (second !== '2') bad.push(`${n}: второй по отрисовке ${second}, ждали 2 — порядок не тот, случай спрашивает не того человека`);
      await act(s, 'p-out:2');
      // ждать, а не смотреть сразу: запрос уходит асинхронно, и мгновенный счёт был бы нулём всегда
      await s.p.waitForTimeout(300);
      if (outs(s).length) bad.push(`${n}: исключение ушло с первого нажатия — вопроса нет (E47v)`);
      const t = await s.view();
      if (!t.includes('Глеб Главный потеряет вход в приложение и живое членство разом')) bad.push(`${n}: в вопросе нет имени человека (E47v)`);
      await act(s, 'p-outkeep');
      if (outs(s).length || (await s.view()).includes('потеряет вход')) bad.push(`${n}: «Не исключать» не закрыл вопрос или отправил`);
      await act(s, 'p-out:2'); await act(s, 'p-outyes:2'); await s.p.waitForTimeout(300);
      if (JSON.stringify(outs(s)) !== '["703"]') bad.push(`${n}: исключение ушло на ${JSON.stringify(outs(s))}, ждали ["703"] — исключили не того`);
      const card = await s.p.$eval('[data-person="2"]', e => e.textContent).catch(() => '');
      if (!/Глеб Главный/.test(card) || !/оборвано сегодняшним днём/.test(card)) bad.push(`${n}: итога с оборванным членством нет на месте карточки (E47g): «${card}»`);
      if (s.calls.filter(c => c.url.endsWith('/people')).length !== 2) bad.push(`${n}: после исключения список не перечитан`);
      if (/70[123]/.test(await s.p.evaluate(() => document.getElementById('view').innerHTML))) bad.push(`${n}: tg_user_id в разметке`);
      await s.ctx.close();
    }
    // без членства: итог по memberships_ended = 0 (E47zh), а не по догадке
    {
      const n = 'out-nomember', s = await peopleCase(OWNER, { people: json(200, withBal),
        out: json(200, { tg_user_id: 702, revoked_at: '2026-10-28T13:00:00+00:00', memberships_ended: 0, note: '' }) });
      await toPeople(s);
      await act(s, 'p-out:1');
      // вопрос без членства — без «живое членство разом», и без рода (пола клиент не знает)
      const q = await s.view();
      if (!q.includes('Сомчай потеряет вход в приложение; живого членства нет — обрывать нечего.')) bad.push(`${n}: вопрос человеку без членства не тот`);
      if (/членство разом/.test(q)) bad.push(`${n}: человеку без членства обещан обрыв членства`);
      await act(s, 'p-outyes:1'); await s.p.waitForTimeout(300);
      if (/исключена|исключён/.test(await s.view())) bad.push(`${n}: итог с родом — пола клиент не знает`);
      if (JSON.stringify(outs(s)) !== '["702"]') bad.push(`${n}: исключение ушло на ${JSON.stringify(outs(s))}, ждали ["702"]`);
      const card = await s.p.$eval('[data-person="1"]', e => e.textContent).catch(() => '');
      if (!/обрывать было нечего/.test(card) || /оборвано сегодняшним/.test(card)) bad.push(`${n}: итог не по memberships_ended=0 (E47zh): «${card}»`);
      await s.ctx.close();
    }
    // подтверждение без вопроса не проходит: «Точно исключить» по чужому номеру
    {
      const n = 'out-forged', s = await peopleCase(OWNER, { people: json(200, withBal) });
      await toPeople(s);
      await act(s, 'p-out:0');
      await s.p.evaluate(() => { const b = document.querySelector('[data-action="p-outyes:0"]'); if (b) { b.setAttribute('data-action', 'p-outyes:2'); b.click(); } });
      await s.p.waitForTimeout(300);
      if (outs(s).length) bad.push(`${n}: исключение ушло по человеку, о котором не спрашивали: ${JSON.stringify(outs(s))}`);
      await s.ctx.close();
    }
    // три отказа — словами сервера (E47d); на 409 список перечитывается
    for (const [n, reply, want, reread] of [
      ['out-403', json(403, { detail: 'исключать из клуба вправе глава клуба' }), 'Исключать из клуба вправе глава клуба.', false],
      ['out-self', json(409, { detail: 'себя исключить нельзя' }), 'Себя исключить нельзя.', true],
      ['out-gone', json(409, { detail: 'этого человека в клубе нет' }), 'Этого человека в клубе нет.', true]]) {
      const s = await peopleCase(OWNER, { people: json(200, withBal), out: reply });
      await toPeople(s);
      await act(s, 'p-out:0'); await act(s, 'p-outyes:0'); await s.p.waitForTimeout(300);
      if (!(await s.view()).includes(want)) bad.push(`${n}: отказ не словами сервера (ждали «${want}»)`);
      const gets = s.calls.filter(c => c.url.endsWith('/people')).length;
      if (reread && gets !== 2) bad.push(`${n}: после 409 список не перечитан (запросов /people ${gets})`);
      if (await s.p.$('[data-person] [disabled]')) bad.push(`${n}: после отказа экран заперт`);
      await s.ctx.close();
    }
  }

  // ── карточки меню: конструктор и утверждение (Cafe13KPG#175) ──
  // Очередь GET /bar/products и остальные ручки — бой fa2cebc; ключи строки
  // очереди — по снимку координатора (19 ключей, причина без возврата — "",
  // не null; поля снимка — null). Ответ очереди нарочно в ОБРАТНОМ
  // порядке: группы обязаны раскладываться экраном, а не порядком сервера.
  {
    const P = (id, state, title, group, recipes, note) => ({ id, direction_id: 7, group, title, about: '', full_text: '',
      price: '180.00', mins: 5, is_alcohol: false, sort: 0, state, created_by: 1, created_at: '2026-10-21T10:00:00+00:00',
      decided_by: null, decided_at: null, decision_note: note === undefined ? '' : note, recipes,
      last_photo_state: null, last_photo_id: null, photo_id: null });
    const QUEUE_ = [P(56, 'active', 'Эспрессо', 'Кофе', ['en', 'ru', 'th']), P(55, 'hidden', 'Старый чай', 'Чай', ['ru']),
      P(54, 'hidden', 'Глинтвейн', 'Сезон', ['ru'], 'нет фото'), P(53, 'draft', 'Какао', 'Кофе', ['ru']),
      // возврат после api#66 — draft с замечанием (Cafe13KPG#307); hidden с замечанием выше — прежний вид
      P(58, 'draft', 'Тоник', 'Кофе', ['ru'], 'нет тайского рецепта'),
      P(52, 'review', 'Раф', 'Кофе', []), P(51, 'review', 'Матча-латте', 'Чай', ['ru', 'th']),
      P(57, 'active', 'Глинтвейн дома', 'Авторские напитки сезона и тёплые настойки дома', ['ru'])];
    const WORKER = clone(OWNER); WORKER.roles = [{ role: 'bar', direction_id: 7 }];
    const CUR = clone(OWNER); CUR.roles = [{ role: 'curator', direction_id: 7 }];
    const MEMBER = clone(OWNER); MEMBER.roles = [];
    const cardsCase = (me, r) => open(true, true, json(200, me), null, null, null, q => {
      const u = q.url(), m = q.method();
      if (u.endsWith('/directions')) return DIR(true);
      if (u.includes('/bar/orders') && m === 'GET') return json(200, []);
      // заведённая карточка появляется в перечитанной очереди, как на сервере
      if (/\/bar\/products\?/.test(u)) return r.list || json(200, r.made ? QUEUE_.concat([P(60, 'draft', 'Флэт-уайт', 'Кофе', [])]) : QUEUE_);
      if (/\/bar\/products\/\d+\/recipe\?lang=ru$/.test(u) && m === 'GET') return json(200, { product_id: 53, lang: 'ru', asked_lang: 'ru', exact: true, body: 'старый рецепт', created_at: '2026-10-21T10:00:00+00:00' });
      if (/\/bar\/products\/\d+\/recipe/.test(u) && m === 'GET') return json(200, { product_id: 53, lang: 'ru', asked_lang: 'th', exact: false, body: 'чужой язык', created_at: '2026-10-21T10:00:00+00:00' });
      if (/\/bar\/products\/\d+\/recipe$/.test(u)) return r.recipe || json(201, { id: 90, lang: JSON.parse(q.postData()).lang, created_at: '2026-10-21T10:00:00+00:00' });
      if (/\/bar\/products\/\d+\/state$/.test(u)) return r.state || json(200, { id: 51, state: JSON.parse(q.postData()).state, decided_at: '2026-10-21T10:00:00+00:00', decision_note: '' });
      if (/\/bar\/products$/.test(u) && m === 'POST') return (r.made = true, r.create) || json(201, { id: 60, direction_id: 7, group: 'Кофе', title: 'Флэт-уайт', price: '180.00', mins: null, state: 'draft', sort: 0 });
      return undefined;
    });
    const cposts = (s, re) => s.calls.filter(c => c.method === 'POST' && re.test(c.url));
    const click = (s, a) => s.p.evaluate(a => { const x = document.querySelector(`[data-action="${a}"]`); if (x) x.click(); return !!x; }, a);
    const toCards = async s => {
      if (!(await s.p.$('[data-go="barCards"]'))) return false;
      await s.p.evaluate(() => document.querySelector('[data-go="barCards"]').click());
      await s.p.waitForTimeout(300);
      return true;
    };
    const openCard = async (s, id) => { await click(s, 'c-open:' + id); await s.p.waitForTimeout(250); };
    // поля нет — своя строка, а не таймаут fill на 30 с, который роняет весь прогон
    const put = async (s, sel, v, name) => {
      if (await s.p.$(sel)) { await s.p.fill(sel, v); return true; }
      bad.push(`${name}: нет поля ${sel}`); return false;
    };

    // список: hidden запрошен явно, группы — экраном, причина возврата в строке
    {
      const s = await cardsCase(WORKER, {});
      if (!(await toCards(s))) bad.push('cards-list: у работника бара нет входа «Карточки меню»');
      else {
        const q = s.calls.filter(c => /\/bar\/products\?/.test(c.url));
        if (q.length !== 1 || !/direction_id=7&state=draft,review,active,hidden$/.test(decodeURIComponent(q[0].url)))
          bad.push('cards-list: очередь спрошена не так: ' + JSON.stringify(q.map(c => c.url)));
        const order = await s.p.evaluate(() => [...document.querySelectorAll('[data-cards]')].map(e => e.getAttribute('data-cards')));
        if (JSON.stringify(order) !== JSON.stringify(['Ждут утверждения', 'Возвращены', 'Черновики', 'В меню', 'Сняты']))
          bad.push('cards-list: порядок групп ' + JSON.stringify(order));
        const t = await s.view();
        ['Замечание: нет фото', 'рецепта нет', 'рецепт: ru, th', 'Направление «Бар»'].forEach(x => { if (!t.includes(x)) bad.push(`cards-list: нет «${x}»`); });
        // Вернули автору — оба вида в «Возвращены», с замечанием в строке и глиной;
        // черновик без замечания — в «Черновиках», и пустой подписи там нет (близнец, designer-55).
        const groups = await s.p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#view [data-cards]')].map(g =>
          [g.getAttribute('data-cards'), [...g.querySelectorAll('.listitem')].map(r =>
            r.querySelector('b').textContent + (r.classList.contains('warm') ? ':глина' : '') +
            (r.querySelector('.said') ? '|' + r.querySelector('.said').textContent : ''))])));
        const wantG = { 'Возвращены': ['Глинтвейн:глина|Замечание: нет фото', 'Тоник:глина|Замечание: нет тайского рецепта'],
                        'Черновики': ['Какао'], 'Сняты': ['Старый чай'] };
        for (const [g, rows] of Object.entries(wantG))
          if (JSON.stringify((groups[g] || []).slice().sort()) !== JSON.stringify(rows))
            bad.push(`cards-returned: группа «${g}» ${JSON.stringify(groups[g] || [])}, ждали ${JSON.stringify(rows)}`);
        if (!groups['Черновики']) bad.push('cards-returned: ПРОВЕРКА НЕ ВЫПОЛНЕНА — группы «Черновики» нет, близнецу не на чем стоять');
        // Цвет «рецепта нет» — глина, и проверяется ЗНАЧЕНИЕМ, а не наличием слов.
        // 22.10.2026: подмена var(--clay-ink) на системный синий оставила батарею
        // зелёной (258 из 258) — случай выше смотрел только текст строки.
        // Сравнение идёт с токеном, вычисленным на ТОЙ ЖЕ странице, а не с литералом:
        // литерал разойдётся с палитрой при первой её правке и начнёт врать.
        // (Случай — designer-55, прогнан им парно.)
        const paint = await s.p.evaluate(() => {
          const el = [...document.querySelectorAll('#view .listitem .small span')]
            .find(x => x.textContent.trim() === 'рецепта нет');
          if (!el) return null;
          const probe = document.createElement('span');
          probe.style.color = 'var(--clay-ink)';
          el.parentNode.appendChild(probe);
          const want = getComputedStyle(probe).color;
          probe.remove();
          return { got: getComputedStyle(el).color, want: want };
        });
        if (!paint) bad.push('cards-list: строки «рецепта нет» нет в разметке — цвет мерить не на чем');
        else if (paint.got !== paint.want)
          bad.push(`cards-list: «рецепта нет» набрано ${paint.got}, а глина это ${paint.want}`);
        // «Новая карточка» — под списком, а не над ним
        const below = await s.p.evaluate(() => {
          const b = document.querySelector('#view [data-action="c-new"]');
          const g = [...document.querySelectorAll('#view [data-cards]')].pop();
          return !!(b && g && (g.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
        });
        if (!below) bad.push('cards-list: «Новая карточка» стоит не под списком');
        // в Telegram «Новая карточка» — главная кнопка: длинный список не уводит её за прокрутку
        if (!(await s.p.evaluate(() => typeof window.__main === 'function'))) bad.push('cards-list: нет главной кнопки «Новая карточка»');
        else {
          await s.p.evaluate(() => window.__main());
          await s.p.waitForTimeout(150);
          if (!(await s.p.evaluate(() => !!document.querySelector('#c-title')))) bad.push('cards-list: главная кнопка не открыла новую карточку');
        }
        await s.p.screenshot({ path: `${OUT}/live-cards.png` });
      }
      if (s.errs.length) bad.push('cards-list: ошибки страницы ' + s.errs.join('; '));
      await s.ctx.close();
    }
    // карточка, возвращённая новым видом (draft + замечание): внутри — «Возвращена»
    // и замечание куратора; обычный черновик — «Черновик» без замечания
    // Плашка состояния: глина — только у возврата (ждёт действия автора); «Снята»
    // спокойная — решение куратора принято и закрыто (словарь облика, E39b)
    for (const [id, want, not, pill, warm] of [
      [58, ['Возвращена', 'Вернул куратор: нет тайского рецепта', 'Отправить на утверждение'], ['Черновик'], 'Возвращена', true],
      [53, ['Черновик', 'Отправить на утверждение'], ['Возвращена', 'Вернул куратор'], 'Черновик', false],
      [55, ['Снята'], ['Возвращена', 'Вернул куратор'], 'Снята', false]]) {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await openCard(s, id);
      const t = await s.view();
      if (!t.includes('Рецепт')) bad.push(`card-${id}: ПРОВЕРКА НЕ ВЫПОЛНЕНА — карточка не открылась`);
      else {
        want.forEach(x => { if (!t.includes(x)) bad.push(`card-${id}: нет «${x}»`); });
        not.forEach(x => { if (t.includes(x)) bad.push(`card-${id}: лишнее «${x}»`); });
        const p = await s.p.evaluate(w => { const e = [...document.querySelectorAll('#view .pill')].find(x => x.textContent.trim() === w);
          return e ? e.classList.contains('warm') : null; }, pill);
        if (p === null) bad.push(`card-${id}: плашки «${pill}» нет`);
        else if (p !== warm) bad.push(`card-${id}: плашка «${pill}» ${warm ? 'не глиной' : 'глиной, а решение закрыто'}`);
      }
      await s.ctx.close();
    }
    // «рецепта нет» глиной — только у ждущей утверждения: у черновика рецепта нет
    // по определению, и красное там читалось бы ошибкой (решение координатора, 23.10.2026)
    {
      const s = await cardsCase(WORKER, { list: json(200, [P(52, 'review', 'Раф', 'Кофе', []), P(61, 'draft', 'Какао на овсяном', 'Кофе', [])]) });
      await toCards(s);
      const c = await s.p.evaluate(() => {
        const probe = document.createElement('span'); probe.style.color = 'var(--clay-ink)';
        document.querySelector('#view').appendChild(probe);
        const clay = getComputedStyle(probe).color; probe.remove();
        const of = t => {
          const b = [...document.querySelectorAll('#view .listitem')].find(x => x.textContent.includes(t));
          const sp = b && [...b.querySelectorAll('span')].find(x => x.textContent.trim() === 'рецепта нет');
          return sp ? getComputedStyle(sp).color : null;
        };
        return { clay, review: of('Раф'), draft: of('Какао на овсяном') };
      });
      if (!c.review || !c.draft) bad.push('cards-paint: нет строки «рецепта нет» — ' + JSON.stringify(c));
      else {
        if (c.review !== c.clay) bad.push(`cards-paint: у ждущей утверждения без рецепта «рецепта нет» набрано ${c.review}, а не глиной ${c.clay}`);
        if (c.draft === c.clay) bad.push('cards-paint: у черновика без рецепта «рецепта нет» глиной — это «ещё не сделано», а не ошибка');
      }
      await s.ctx.close();
    }
    // без роли бара — входа нет, и очередь не спрашивается
    {
      const s = await cardsCase(MEMBER, {});
      if (await s.p.$('[data-go="barCards"]')) bad.push('cards-member: у члена клуба без роли есть вход «Карточки меню»');
      await s.p.evaluate(() => go('barQueue')); await s.p.waitForTimeout(200);
      if (await s.p.$('#view [data-go="barCards"]')) bad.push('cards-member: на экране заказов у члена клуба без роли есть вход «Карточки меню» (Cafe13KPG#396)');
      await s.p.evaluate(() => go('barCards')); await s.p.waitForTimeout(200);
      if (s.calls.some(c => /\/bar\/products/.test(c.url))) bad.push('cards-member: очередь спрошена без права');
      if (await s.p.evaluate(() => window.__main !== null)) bad.push('cards-member: главная кнопка без права');
      await s.ctx.close();
    }
    // Строка входа в «Клубе» у работника с членством — эталон для второй двери на «Заказах»:
    // один источник, и расхождение двух входов краснеет само (возврат архитектора по #90).
    // Сличаются разметка строки и подпись её группы — вход в «Клубе» стоит рядом с другими
    // рабочими строками, поэтому группа целиком не сравнима.
    const rowOf = () => {
      const b = document.querySelector('#view [data-go="barCards"]');
      const g = b && b.closest('.group'), l = g && g.querySelector(':scope > .label');
      return b ? { html: b.outerHTML, text: b.textContent, label: l ? l.textContent : null } : null;
    };
    let homeRow = null;
    // работник с членством входит из «Клуба» — и «назад» ведёт в «Клуб», а не в «Заказы»
    {
      const s = await cardsCase(WORKER, {});
      homeRow = await s.p.evaluate(rowOf);
      if (await toCards(s)) {
        if (await s.p.evaluate(() => backTo()) !== 'home') bad.push('cards-home-back: вошли из «Клуба», а «назад» ведёт не туда (Cafe13KPG#403)');
      } else bad.push('cards-home-back: у работника с членством нет входа в «Клубе»');
      await s.ctx.close();
    }
    // Бармен без членства: «Клуб» вкладкой не приходит, вход в карточки — на «Заказах»
    // под сменой и над счётчиками (кадр E41, Cafe13KPG#396), и «назад» ведёт обратно
    // в «Заказы», а не на услуги гостя (Cafe13KPG#403).
    {
      const BARMAN_NOMEMBER = clone(WORKER); BARMAN_NOMEMBER.membership_active = false; BARMAN_NOMEMBER.membership = null; BARMAN_NOMEMBER.memberships = [];
      const s = await cardsCase(BARMAN_NOMEMBER, {});
      const n = 'cards-queue';
      if (await s.p.$('#tabs [data-go="home"]')) bad.push(`${n}: у работника без членства есть вкладка «Клуб» — фикстура не та`);
      if (!(await s.p.$('#tabs [data-go="barQueue"]'))) bad.push(`${n}: у работника бара нет вкладки «Заказы»`);
      else {
        await s.p.click('#tabs [data-go="barQueue"]'); await s.p.waitForTimeout(250);
        const at = await s.p.evaluate(() => {
          const kids = [...document.querySelectorAll('#view > *')];
          const i = kids.findIndex(e => e.querySelector('[data-go="barCards"]'));
          const shift = kids.findIndex(e => /Смена/.test(e.textContent));
          const rows = kids.findIndex(e => e.classList.contains('rows'));
          return { i, shift, rows, cur: current };
        });
        console.log(`${n}: вход на месте ${at.i}, смена ${at.shift}, счётчики ${at.rows}`);
        if (at.cur !== 'barQueue') bad.push(`${n}: вкладка «Заказы» открыла ${at.cur}`);
        else if (at.i < 0) bad.push(`${n}: на «Заказах» нет входа «Карточки меню» — у бармена без членства другой двери нет (Cafe13KPG#396)`);
        else if (at.shift < 0 || at.rows < 0 || !(at.shift < at.i && at.i < at.rows))
          bad.push(`${n}: вход «Карточки меню» не между сменой и счётчиками: вход ${at.i}, смена ${at.shift}, счётчики ${at.rows} (кадр E41)`);
        if (at.i >= 0) {
          const qRow = await s.p.evaluate(rowOf);
          // кадр E41: те же слова, что в «Клубе», вплоть до подстрочника
          for (const w of ['Карточки меню', 'Новые позиции и утверждение'])
            if (!qRow.text.includes(w)) bad.push(`${n}: в строке входа на «Заказах» нет «${w}» (кадр E41)`);
          if (!homeRow) bad.push(`${n}: НЕ ВЫПОЛНЕНО — эталона нет, в «Клубе» у работника с членством строки входа не нашлось`);
          else {
            if (qRow.html !== homeRow.html) bad.push(`${n}: строка входа на «Заказах» разошлась со строкой в «Клубе»: «${qRow.text}» против «${homeRow.text}» (кадр E41)`);
            if (qRow.label !== homeRow.label) bad.push(`${n}: группа входа на «Заказах» подписана «${qRow.label}», в «Клубе» — «${homeRow.label}» (кадр E41)`);
          }
          await s.p.click('#view [data-go="barCards"]'); await s.p.waitForTimeout(300);
          if (await s.p.evaluate(() => current) !== 'barCards') bad.push(`${n}: вход не открыл «Карточки меню»`);
          else {
            if (await s.p.evaluate(() => backTo()) !== 'barQueue') bad.push(`${n}: «назад» из карточек ведёт не в «Заказы», откуда вошли (Cafe13KPG#403)`);
            await openCard(s, 51);
            if (await s.p.evaluate(() => current) !== 'barCard') bad.push(`${n}: карточка 51 не открылась`);
            // «назад» — тем же путём, что кнопка шапки и BackButton Telegram: go(backTo())
            await s.p.evaluate(() => go(backTo())); await s.p.waitForTimeout(250);
            const back2 = await s.p.evaluate(() => [current, backTo()]);
            if (back2[0] !== 'barCards' || back2[1] !== 'barQueue')
              bad.push(`${n}: после карточки «назад» из списка ведёт в ${back2[1]}, а не в «Заказы» (Cafe13KPG#403)`);
            await s.p.evaluate(() => go(backTo())); await s.p.waitForTimeout(250);
            if (await s.p.evaluate(() => current) !== 'barQueue') bad.push(`${n}: два «назад» привели не в «Заказы»`);
          }
        }
      }
      await s.ctx.close();
    }
    // новая карточка: предупреждение до сохранения; группа сводится к существующей без регистра
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await click(s, 'c-new'); await s.p.waitForTimeout(150);
      if (!(await s.view()).includes('Поля потом не исправить')) bad.push('cards-create: нет предупреждения до сохранения');
      // облик формы — по стандарту eventNew (ревью designer-55, 23.10.2026)
      const f = await s.p.evaluate(() => {
        const top = id => { const l = document.querySelector(`label[for="${id}"]`); return l ? l.getBoundingClientRect().top : null; };
        const save = document.querySelector('#view [data-action="c-save"]');
        const warn = [...document.querySelectorAll('#view .small')].find(x => x.textContent.startsWith('Поля потом не исправить'));
        return {
          ph: [...document.querySelectorAll('#view input[placeholder]')].map(x => x.placeholder).filter(x => !x.startsWith('Например: ')),
          tops: [top('c-price'), top('c-mins')],
          under: !!(save && warn && (save.compareDocumentPosition(warn) & Node.DOCUMENT_POSITION_FOLLOWING)),
          text: document.querySelector('#view').textContent
        };
      });
      if (f.ph.length) bad.push('cards-create: заполнитель читается введённым значением: ' + JSON.stringify(f.ph));
      if (f.tops[0] === null || f.tops[1] === null || Math.abs(f.tops[0] - f.tops[1]) > 1) bad.push('cards-create: подписи «Цена» и «Минуты» на разной высоте: ' + JSON.stringify(f.tops));
      if (!f.under) bad.push('cards-create: «Поля потом не исправить» не под кнопкой сохранения');
      ['До 200 знаков.', 'До 80 знаков.'].forEach(x => { if (!f.text.includes(x)) bad.push(`cards-create: предел поля не назван — нет «${x}»`); });
      await put(s, '#c-title', 'Флэт-уайт', 'cards'); await put(s, '#c-group', ' кофе ', 'cards'); await put(s, '#c-price', '180', 'cards');
      if (!(await s.p.evaluate(() => typeof window.__main === 'function'))) bad.push('cards-create: у формы нет главной кнопки');
      await s.p.evaluate(() => window.__main && window.__main());
      await s.p.waitForTimeout(400);
      const pp = cposts(s, /\/bar\/products$/);
      const want = { direction_id: 7, group: 'Кофе', title: 'Флэт-уайт', price: 180, about: '', is_alcohol: false };
      if (pp.length !== 1 || pp[0].body !== JSON.stringify(want)) bad.push('cards-create: ушло ' + JSON.stringify(pp.map(c => c.body)));
      const t = await s.view();
      if (!t.includes('Черновик сохранён') || !t.includes('Флэт-уайт')) bad.push('cards-create: после сохранения не открылась карточка с заметкой');
      await s.ctx.close();
    }
    // похожая группа (пробел внутри) — вопрос, без запроса; «да» — в существующую
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await click(s, 'c-new'); await s.p.waitForTimeout(150);
      await put(s, '#c-title', 'Раф', 'cards'); await put(s, '#c-group', 'Ко фе', 'cards'); await put(s, '#c-price', '200', 'cards');
      await click(s, 'c-save'); await s.p.waitForTimeout(150);
      if (!(await s.view()).includes('Это та же группа, что «Кофе»?')) bad.push('cards-group-like: нет вопроса о похожей группе');
      if (cposts(s, /\/bar\/products$/).length) bad.push('cards-group-like: карточка ушла до ответа');
      await click(s, 'c-group-theirs'); await s.p.waitForTimeout(300);
      const pp = cposts(s, /\/bar\/products$/);
      if (pp.length !== 1 || JSON.parse(pp[0].body).group !== 'Кофе') bad.push('cards-group-like: ушло ' + JSON.stringify(pp.map(c => c.body)));
      await s.ctx.close();
    }
    // вопрос о похожей группе с длинным именем не выносит экран за 390 px (designer-55: 43 знака → край 555)
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await click(s, 'c-new'); await s.p.waitForTimeout(150);
      await put(s, '#c-title', 'Глинтвейн', 'cards-group-long'); await put(s, '#c-group', 'Авторскиенапитки сезона  и тёплые настойки дома', 'cards-group-long'); await put(s, '#c-price', '250', 'cards-group-long');
      await click(s, 'c-save'); await s.p.waitForTimeout(150);
      if (!(await s.view()).includes('Это та же группа, что «Авторские напитки сезона и тёплые настойки дома»?')) bad.push('cards-group-long: нет вопроса о похожей группе');
      const w = await s.p.evaluate(() => ({ doc: document.documentElement.scrollWidth,
        right: Math.max(...[...document.querySelectorAll('[data-action="c-group-theirs"],[data-action="c-group-mine"]')].map(e => e.getBoundingClientRect().right)) }));
      if (w.doc > 390 || w.right > 390) bad.push(`cards-group-long: ряд «та же / новая» вылез за 390: документ ${w.doc}, правый край ${Math.round(w.right)}`);
      // и стоят парой: зазор между ними — шаг сегмента, а не пустая середина карточки
      const gap = await s.p.evaluate(() => { const a = document.querySelector('[data-action="c-group-theirs"]').getBoundingClientRect(),
        c = document.querySelector('[data-action="c-group-mine"]').getBoundingClientRect(); return Math.round(c.left - a.right); }).catch(() => null);
      if (gap === null || gap > 12) bad.push(`cards-group-long: «Да, та же» и «Нет, новая» разнесены на ${gap} px — парой не читаются`);
      await s.ctx.close();
    }
    // отказ сервера, затем отказ своей проверки: плашка одна — прошлая не висит рядом с новой
    {
      const s = await cardsCase(WORKER, { create: json(409, { detail: 'такая позиция уже есть' }) });
      await toCards(s); await click(s, 'c-new'); await s.p.waitForTimeout(150);
      await put(s, '#c-title', 'Раф', 'cards-deny-stale'); await put(s, '#c-group', 'Кофе', 'cards-deny-stale'); await put(s, '#c-price', '200', 'cards-deny-stale');
      await s.p.evaluate(() => window.__main && window.__main()); await s.p.waitForTimeout(300);
      await put(s, '#c-title', '', 'cards-deny-stale');
      await s.p.evaluate(() => window.__main && window.__main()); await s.p.waitForTimeout(200);
      const all = await s.p.$$eval('.deny', l => l.map(e => e.textContent));
      if (JSON.stringify(all) !== JSON.stringify(['Нужно название.'])) bad.push('cards-deny-stale: плашки ' + JSON.stringify(all) + ', ждали одну «Нужно название.»');
      await s.ctx.close();
    }
    // своя проверка формы — той же плашкой отказа, что и сервер; «Алкоголь» — строкой да/нет и уходит в теле
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await click(s, 'c-new'); await s.p.waitForTimeout(150);
      await s.p.evaluate(() => window.__main && window.__main()); await s.p.waitForTimeout(150);
      const deny = await s.p.$eval('.deny', e => e.textContent).catch(() => null);
      if (deny !== 'Нужно название.') bad.push(`cards-form-deny: отказ своей проверки «${deny}», ждали плашку «Нужно название.»`);
      if (!(await s.view()).includes('От 1 до 600, можно пусто.')) bad.push('cards-form-deny: предел минут не назван до попытки');
      await click(s, 'c-alcohol'); await s.p.waitForTimeout(100);
      if (!(await s.p.$('[data-action="c-alcohol"][aria-pressed="true"] .pill.on'))) bad.push('cards-form-deny: «Алкоголь» не показывает «да»');
      await put(s, '#c-title', 'Глинтвейн', 'cards-form-deny'); await put(s, '#c-group', 'Кофе', 'cards-form-deny'); await put(s, '#c-price', '250', 'cards-form-deny');
      await s.p.evaluate(() => window.__main && window.__main()); await s.p.waitForTimeout(300);
      const pp = cposts(s, /\/bar\/products$/);
      if (pp.length !== 1 || JSON.parse(pp[0].body).is_alcohol !== true) bad.push('cards-form-deny: «Алкоголь» не ушёл в теле: ' + JSON.stringify(pp.map(c => c.body)));
      await s.ctx.close();
    }

    // рецепт: у языка с рецептом — прежний текст и «Заменить»; новый язык — «Сохранить»; чужой язык в поле не попадает
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await openCard(s, 53); await s.p.waitForTimeout(200);
      if ((await s.p.inputValue('#c-recipe')) !== 'старый рецепт') bad.push('cards-recipe: прежний рецепт RU не в поле');
      if (!(await s.view()).includes('Заменить рецепт (RU)')) bad.push('cards-recipe: у RU с рецептом нет «Заменить»');
      await click(s, 'c-lang:th'); await s.p.waitForTimeout(200);
      if ((await s.p.inputValue('#c-recipe')) !== '') bad.push('cards-recipe: в поле TH чужой текст');
      if (!(await s.view()).includes('Сохранить рецепт (TH)')) bad.push('cards-recipe: у TH без рецепта нет «Сохранить»');
      await put(s, '#c-recipe', 'สูตร', 'cards'); await click(s, 'c-recipe:53'); await s.p.waitForTimeout(300);
      const pp = cposts(s, /\/bar\/products\/53\/recipe$/);
      if (pp.length !== 1 || pp[0].body !== JSON.stringify({ lang: 'th', body: 'สูตร' })) bad.push('cards-recipe: ушло ' + JSON.stringify(pp.map(c => c.body)));
      if (!(await s.view()).includes('Рецепт сохранён (TH).')) bad.push('cards-recipe: нет итога');
      await s.ctx.close();
    }
    // язык есть в recipes, а сервер отдал другой («что есть»): чужой текст в поле
    // не кладётся — иначе «Заменить (TH)» записало бы русский рецепт тайским
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await openCard(s, 51);
      await click(s, 'c-lang:th'); await s.p.waitForTimeout(250);
      const v = await s.p.inputValue('#c-recipe').catch(() => null);
      if (v !== '') bad.push(`cards-recipe-foreign: в поле TH «${v}», а сервер отдал рецепт на ru`);
      await s.ctx.close();
    }
    // бар: черновик — на утверждение; ждущую — утвердить нечем
    {
      const s = await cardsCase(WORKER, {});
      await toCards(s); await openCard(s, 53);
      await click(s, 'c-review:53'); await s.p.waitForTimeout(300);
      const pp = cposts(s, /\/bar\/products\/53\/state$/);
      if (pp.length !== 1 || pp[0].body !== JSON.stringify({ state: 'review' })) bad.push('cards-review: ушло ' + JSON.stringify(pp.map(c => c.body)));
      if (!(await s.view()).includes('Отправлено на утверждение')) bad.push('cards-review: нет итога');
      if (s.calls.filter(c => /\/bar\/products\?/.test(c.url)).length < 2) bad.push('cards-review: очередь не перечитана');
      await s.p.evaluate(() => go('barCard', '51')); await s.p.waitForTimeout(200);
      if (await s.p.$('[data-action^="c-approve"]')) bad.push('cards-review: работнику бара предложено «Утвердить»');
      if (!(await s.view()).includes('Ждёт решения куратора')) bad.push('cards-review: работник не видит, что ждёт куратора');
      await s.ctx.close();
    }
    // куратор: без рецепта «в меню» погашена заранее; с рецептом — уходит active
    {
      const s = await cardsCase(CUR, {});
      await toCards(s); await openCard(s, 52);
      if (await s.p.$('[data-action="c-approve:52"]')) bad.push('cards-approve: «в меню» нажимается без рецепта');
      if (!(await s.view()).includes('Сначала рецепт')) bad.push('cards-approve: нет причины, почему нельзя в меню');
      // недоступное — призраком и после объяснения: не тяжелее единственного доступного
      const off = await s.p.evaluate(() => {
        const b = [...document.querySelectorAll('#view button[disabled]')].find(x => x.textContent === 'Утвердить — в меню');
        const why = [...document.querySelectorAll('#view .small')].find(x => x.textContent.startsWith('Сначала рецепт'));
        return { ghost: !!(b && b.classList.contains('ghost')), before: !!(b && why && (why.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) };
      });
      if (!off.ghost) bad.push('cards-approve: погашенное «Утвердить — в меню» не призраком — тяжелее доступного действия');
      if (!off.before) bad.push('cards-approve: «Сначала рецепт» стоит не перед погашенной кнопкой');
      await s.p.evaluate(() => go('barCards')); await s.p.waitForTimeout(200); await openCard(s, 51);
      await click(s, 'c-approve:51'); await s.p.waitForTimeout(300);
      const pp = cposts(s, /\/bar\/products\/51\/state$/);
      if (pp.length !== 1 || pp[0].body !== JSON.stringify({ state: 'active' })) bad.push('cards-approve: ушло ' + JSON.stringify(pp.map(c => c.body)));
      if (!(await s.view()).includes('Утверждено')) bad.push('cards-approve: нет итога');
      await s.ctx.close();
    }
    // строка «Снимок» (кадр E33, Cafe13KPG#270): шесть достижимых сочетаний — каждое своим
    // заголовком, пунктир только у «фото нет», плашка-предел у всех, кроме «фото нет»;
    // недостижимое и незнакомое — без строки. Видят все, кто видит карточку (бар тоже).
    for (const [name, photo_id, last_photo_id, last_photo_state, title, none, who] of [
      ['photo-none', null, null, null, 'Фото нет', true, WORKER],
      ['photo-wait', null, 70, 'at_ai', 'Снимок ждёт утверждения', false, WORKER],
      ['photo-approved-off', null, 70, 'approved', 'Утверждён, но не в меню', false, WORKER],
      ['photo-replaced', 69, 70, 'new', 'В меню стоит прежний', false, CUR],
      ['photo-on', 70, 70, 'approved', 'Фото в меню', false, CUR],
      ['photo-other-approved', 69, 70, 'approved', 'Новый утверждён, но не в меню', false, CUR],
      ['photo-unreachable', 69, null, null, null, false, WORKER],
      ['photo-rejected', null, 70, 'rejected', null, false, WORKER]]) {
      const row = Object.assign(P(51, 'review', 'Матча-латте', 'Чай', ['ru', 'th']), { photo_id, last_photo_id, last_photo_state });
      const s = await cardsCase(who, { list: json(200, QUEUE_.map(c => c.id === 51 ? row : c)) });
      await toCards(s); await openCard(s, 51);
      const g = await s.p.evaluate(() => {
        const b = document.querySelector('#view [data-photo]');
        if (!b) return null;
        const ph = b.querySelector('.ph');
        return { title: (b.querySelector('.shot b') || {}).textContent || '', none: !!(ph && ph.classList.contains('none')),
                 limit: !!b.querySelector('.note'), recipeAfter: !!document.querySelector('#view [data-photo] ~ .group #c-recipe') };
      });
      if (title === null) { if (g) bad.push(`${name}: недостижимое сочетание нарисовано строкой «${g.title}»`); }
      else if (!g) bad.push(`${name}: строки «Снимок» нет`);
      else {
        if (g.title !== title) bad.push(`${name}: заголовок «${g.title}», ждали «${title}»`);
        if (g.none !== none) bad.push(`${name}: слот ${g.none ? 'пунктиром' : 'со снимком'}, ждали ${none ? 'пунктир' : 'снимок'}`);
        if (g.limit === none) bad.push(`${name}: плашка-предел ${g.limit ? 'есть у позиции без снимков' : 'потеряна'}`);
        if (!g.recipeAfter) bad.push(`${name}: строка «Снимок» не между шапкой и рецептом`);
        // инвариант места (замер designer-55, 23.10.2026): всё, что растёт, стоит ВЫШЕ строки,
        // поэтому «Снимок → Решение» постоянно: gap 605 px (dec.bottom − ph.top, эта фикстура, карточка
        // с описанием) при видимых 712 px (tabs.top − bar.bottom); на стенде designer-55 с пустым
        // описанием 567 px — разница от данных, не от кода. Пока gap меньше видимой высоты,
        // тот, кто долистал до «Решения», видит и снимок; вырастет рецепт — строку двигать или дублировать
        if (name === 'photo-on') {
          const d = await s.p.evaluate(() => {
            const ph = document.querySelector('#view [data-photo]');
            const dec = [...document.querySelectorAll('#view .group > .label')].find(x => x.textContent === 'Решение');
            const top = document.getElementById('bar').getBoundingClientRect().bottom, low = document.getElementById('tabs').getBoundingClientRect().top;
            return ph && dec ? { gap: Math.round(dec.getBoundingClientRect().bottom - ph.getBoundingClientRect().top), room: Math.round(low - top) } : null;
          });
          if (!d) bad.push(`${name}: нет «Снимка» или «Решения» — расстояние мерить не на чем`);
          else if (d.gap > d.room) bad.push(`${name}: от «Снимка» до «Решения» ${d.gap} px при видимых ${d.room} — у «Решения» снимок уже не в виду`);
        }
      }
      if (s.errs.length) bad.push(`${name}: ошибки страницы ` + s.errs.join('; '));
      await s.ctx.close();
    }
    // куратор возвращает: без причины — не уходит; с причиной — hidden + note.
    // Описание длинное нарочно: у короткой карточки поле причины и так в виду,
    // и случай не отличил бы прокрутку от её отсутствия (так и было: снятая
    // прокрутка оставалась зелёной; у designer-55 кнопки уходили за край, 23.10.2026).
    {
      const long = Object.assign(P(51, 'review', 'Матча-латте', 'Чай', ['ru', 'th']), { about:
        'Церемониальная матча, взбитая венчиком, на овсяном молоке. Подаём тёплой или со льдом; ' +
        'сахар и сироп — по просьбе гостя, отдельно. Без кофеина не бывает: в матче его не меньше, чем в эспрессо.' });
      const s = await cardsCase(CUR, { list: json(200, QUEUE_.map(c => c.id === 51 ? long : c)) });
      await toCards(s); await openCard(s, 51);
      await click(s, 'c-back'); await s.p.waitForTimeout(150);
      // кнопки причины — в видимой области: попадание пальцем, а не наличие в разметке
      const g = await s.p.evaluate(() => {
        const send = document.querySelector('[data-action="c-back-send:51"]'), tabs = document.getElementById('tabs');
        return {
          // где кнопка была бы без прокрутки (вкладки стоят на месте): ниже их верха — значит, случай что-то проверяет
          deep: !!(send && tabs && send.getBoundingClientRect().bottom + scrollY > tabs.getBoundingClientRect().top),
          off: ['c-back-keep', 'c-back-send:51'].filter(a => {
            const b = document.querySelector(`[data-action="${a}"]`); if (!b) return true;
            const r = b.getBoundingClientRect();
            return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== b;
          })
        };
      });
      if (!g.deep) bad.push('cards-return: кнопки причины и без прокрутки в виду — случай прокрутку не проверяет');
      if (g.off.length) bad.push('cards-return: после «Вернуть с причиной» за краем экрана ' + JSON.stringify(g.off));
      await click(s, 'c-back-send:51'); await s.p.waitForTimeout(150);
      if (cposts(s, /state$/).length) bad.push('cards-return: возврат ушёл без причины');
      await put(s, '#c-reason', 'нет фото', 'cards'); await click(s, 'c-back-send:51'); await s.p.waitForTimeout(300);
      const pp = cposts(s, /\/bar\/products\/51\/state$/);
      if (pp.length !== 1 || pp[0].body !== JSON.stringify({ state: 'hidden', note: 'нет фото' })) bad.push('cards-return: ушло ' + JSON.stringify(pp.map(c => c.body)));
      await s.ctx.close();
    }
    // отказ — текстом сервера, и список перечитан
    {
      const detail = 'карточка 51 не может работать без рецепта: сначала рецепт, потом меню';
      const s = await cardsCase(CUR, { state: json(409, { detail }) });
      await toCards(s); await openCard(s, 51);
      await click(s, 'c-approve:51'); await s.p.waitForTimeout(300);
      const deny = await s.p.$eval('.deny', e => e.textContent).catch(() => null);
      if (deny !== 'Карточка 51 не может работать без рецепта: сначала рецепт, потом меню.') bad.push(`cards-409: плашка «${deny}»`);
      if (s.calls.filter(c => /\/bar\/products\?/.test(c.url)).length < 2) bad.push('cards-409: после отказа очередь не перечитана');
      if ((await s.view()).includes('Утверждено')) bad.push('cards-409: отказ показан успехом');
      await s.ctx.close();
    }
    // битая очередь — «не разобран», а не пустой список
    {
      const s = await cardsCase(WORKER, { list: json(200, [{ id: 1, title: 'x' }]) });
      await toCards(s);
      const t = await s.view();
      if (!t.includes('Ответ сервера не разобран.')) bad.push('cards-broken: нет «не разобран»');
      if (t.includes('Карточек пока нет')) bad.push('cards-broken: битый ответ показан пустым списком');
      if (await s.p.evaluate(() => window.__main !== null)) bad.push('cards-broken: главная кнопка без загруженного списка');
      await s.ctx.close();
    }
  }

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
        /* Снимок С НЕПУСТЫМ списком той же ручки доказывает форму элемента
           лучше, чем исключение: элемент не зависит от того, кто спрашивает —
           `/me` отдаёт `c.roles`, а тот заполняется ОДНИМ запросом
           (`SELECT role, direction_id FROM roles …`, api `deps.py:126`; второе
           место, тестовый режим `deps.py:202`, несёт дословно тот же
           перечень столбцов; сверено и на боевом `fa2cebc`). Значит форма
           одна по построению, а не по совпадению, и выдуманный человек с
           ролью дал бы то же самое (решение координатора, Cafe13KPG#310).
           ⚠ Граница названа вслух: донор доказывает ФОРМУ элемента, а НЕ
           то, что у такого человека список бывает непустым. Понадобится
           поведение («член с ролью видит X») — нужен человек, и это другой
           предмет. */
        const donor = ELEM_FROM[path];
        if (donor) {
          /* Донор годится только от ТОЙ ЖЕ ручки, и теперь это проверяется, а не
             только обещается соседним комментарием: без этой строки следующая
             запись в `ELEM_FROM` может указать на ЧУЖУЮ ручку, и сверка пройдёт по
             чужой форме — зелёное на непроверенном. Найдено архитектором на
             ревью #66 (не к мерджу, сделано следующим PR). Признак — поле `request`
             самих снимков, то есть слово источника, а не догадка по имени. */
          const self = path.split('.')[0];
          const rqD = REAL[donor] && REAL[donor].request, rqS = REAL[self] && REAL[self].request;
          if (!rqD || !rqS) out.push(path + ': у снимка нет поля `request` — одна ли ручка у донора и получателя, проверить нечем');
          else if (rqD !== rqS) out.push(path + ': донор `' + donor + '` отвечает на ДРУГУЮ ручку (' + rqD + ' против ' + rqS + ') — форма была бы сверена по чужой');
          const d = REAL[donor] && REAL[donor].shape;
          const dl = d && path.split('.').slice(1).reduce((o, k) => (o || {})[k], d);
          if (!Array.isArray(dl) || !dl.length)
            out.push(path + ': снимок-донор `' + donor + '` пуст или без этого поля — форма элемента ВСЁ РАВНО не сверена');
          else diffShape(dl[0], stub[0], path + '[]', out);
        }
        else if (UNVERIFIED[path]) { USED.add(path); notes.push(path + ': не сверено — ' + UNVERIFIED[path]); }
        else out.push(path + ': в снимке пустой список, форма элемента не сверена');
      }
      if (real.length && stub.length) diffShape(real[0], stub[0], path + '[]', out);
      return out;
    }
    if (real && typeof real === 'object') {
      if (!stub || typeof stub !== 'object' || Array.isArray(stub)) { out.push(path + ': в ответе объект'); return out; }
      const opt = real['?'] || [];
      Object.keys(real).filter(k => k !== '?').forEach(k => {
        if (!(k in stub)) {
          if (opt.includes(k)) return;
          // ⚠ ИСКЛЮЧЕНИЕ РАБОТАЕТ И ЗДЕСЬ, а не только в ветке пустого
          // списка. 24.10.2026 координатор вписал пять исключений вида
          // `events-afisha[].my_booking_paid`, и прогон дал ДЕСЯТЬ строк
          // вместо пяти: прежние пять остались (эта ветка про UNVERIFIED не
          // знала), и к ним добавились пять «исключение больше не нужно» —
          // потому что ни одно не попало в USED. Замер frontend-events-9d.
          //
          // Самоуборка сохранена: исключение, попавшее в USED, живёт; как
          // только заглушка получает поле, ветка сюда не заходит, USED
          // пустеет и сторож ниже требует убрать исключение.
          const key = path + '.' + k;
          if (UNVERIFIED[key]) { USED.add(key); notes.push(key + ': не сверено — ' + UNVERIFIED[key]); }
          else out.push(key + ': нет в заглушке');
          return;
        }
        diffShape(real[k], stub[k], path + '.' + k, out);
      });
      Object.keys(stub).filter(k => k !== '?' && !(k in real)).forEach(k => out.push(path + '.' + k + ': в ответе сервера такого нет'));
    }
    return out;
  }
  const notes = [];
  /* Чей непустой список доказывает форму элемента там, где в своём снимке
     он пуст. Ключ — путь, значение — имя снимка ТОЙ ЖЕ ручки. */
  const ELEM_FROM = { 'me-member.roles': 'me-curator' };
  const UNVERIFIED = {
    // ⚠ Две строки ниже открылись 24.10.2026, когда api-keys.json пересобрали
    // после двух дней простоя (генератор падал на снимках отказов). Правка
    // их не создала — она их ПОКАЗАЛА. Тогда же открылись ещё три, с другой
    // причиной: поля на бою были, а в заглушках нет (`me-member.memberships`,
    // `items[].product_id` у заказов гостя и работника). Их сняла правка
    // заглушек (Cafe13KPG#297), а не выкладка — путать эти два случая нельзя.
    //
    // Впереди боя: поля завёл api 2c5735f, он НЕ предок боевого sha. Добавить
    // в фикстуру афиши — после выкладки api, не раньше: иначе батарея станет
    // требовать от клиента разбора полей, которых у человека нет. Зона
    // frontend-events-9d, третий шаг Cafe13KPG#271.
    'events-afisha[].my_booking_paid': 'поле есть в снимке, но НЕ на бою (api 2c5735f не предок боевого sha); фикстура — после выкладки, frontend-events-9d',
    'events-afisha[].my_amount_due': 'то же: есть в снимке, нет на бою; фикстура после выкладки, frontend-events-9d'
  };
  const USED = new Set();
  const STUBS = {
    'me-member': OWNER, 'pass-member': PASS, 'directions-guest': JSON.parse(DIR(true).body),
    'menu-guest': MENU, 'order-create': ORDER, 'orders-guest': [row('new')], 'orders-worker': QUEUE,
    'order-state-worker': { id: 3, number: '261018-03', state: 'making' },
    'till-topup': TILL_ROW, 'bar-expense': EXP_ROW, 'bar-income': INC_ROW, 'bar-day': DAY_ROW,
    'events-afisha': AFISHA, 'places': PLACE_ROWS
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

  // Контакт человека боту не уходит (Cafe13KPG#312): в исходнике нет вызова
  // requestContact. Свойство по коду, а не слово на экране — кнопку можно
  // назвать как угодно («Поделиться номером» — так её зовёт согласие).
  // Предел: обращение через строку (tg['request' + 'Contact']) мимо признака.
  {
    const CALL = /\.requestContact\s*\(|\[\s*['"]requestContact['"]\s*\]\s*\(/;
    for (const [t, want] of [['tg.requestContact(function (ok) {', true], ["tg['requestContact'](f)", true],
                             ['// requestContact отдаёт контакт боту', false]])
      if (CALL.test(t) !== want) bad.push(`самопроверка контакта: «${t}» ${want ? 'не пойман' : 'пойман зря'}`);
    const src = fs.readFileSync(`${ROOT}/app.js`, 'utf8');
    if (!/function render\(/.test(src)) bad.push('контакт: ПРОВЕРКА НЕ ВЫПОЛНЕНА — app.js прочитан не тот или пустой');
    const hit = src.split('\n').findIndex(l => CALL.test(l));
    if (hit !== -1) bad.push(`app.js:${hit + 1}: вызов requestContact — контакт человека ушёл бы боту, хранить его негде (#312)`);
  }

  // Одно имя верхнего уровня — одно объявление. Повторное `function` в обычном
  // скрипте молча перекрывает прежнее, и `node --check` этого не видит: разбор
  // человека кассы однажды назвался `fromPass`, как разбор пропуска, и
  // пропуск сломался у всех, а покраснели чужие случаи, а не касса.
  {
    const src = fs.readFileSync(`${ROOT}/app.js`, 'utf8'), seen = {};
    for (const m of src.matchAll(/^(?:function|var|let|const) ([A-Za-z_$][\w$]*)/gm)) seen[m[1]] = (seen[m[1]] || 0) + 1;
    const twice = Object.keys(seen).filter(k => seen[k] > 1);
    if (!Object.keys(seen).length) bad.push('app.js: имена верхнего уровня не найдены — проверка дублей слепа');
    if (twice.length) bad.push('app.js: имя объявлено на верхнем уровне больше одного раза, второе молча перекрывает первое: ' + twice.join(', '));
  }
  // ── членство: виды с ценой от сервера и заявки (Cafe13KPG#415) ──
  // Экраны ещё не в WIRED (сервер впереди клиента): случай включает их внутри
  // страницы. Цены в фикстуре ВЫДУМАНЫ и не совпадают с настоящими: экран с
  // ценой, вшитой в клиент, на них краснеет.
  {
    const GUEST = clone(OWNER); GUEST.membership_active = false; GUEST.membership = null; GUEST.memberships = []; GUEST.roles = [];
    const withReq = (who, st, said) => { const m = clone(who); m.membership_request = { id: 7, status: st, created_at: '2026-10-27T11:00:00+00:00',
      decided_at: st === 'pending' ? null : '2026-10-27T12:00:00+00:00', decision_note: said || '', tier_code: 'member', tier_name: 'Член клуба' }; return m; };
    const TIERS_ = { currency: 'THB', tiers: [
      // описания тоже выдуманы: слова кадра в клиенте значили бы, что текст вшит
      { code: 'member', name: 'Член клуба', about: 'Вход по пропуску.', price_thb: '1234.00', period_months: 1, trial_days: 0 },
      { code: 'organizer', name: 'Мастер', about: 'Свои вечера.', price_thb: '2345.50', period_months: 3, trial_days: 0 },
      { code: 'partner', name: 'Бизнес-партнёр', about: 'Своё дело.', price_thb: '4321.00', period_months: 1, trial_days: 0 }] };
    const REQS_ = { pending: 1, requests: [
      { id: 11, status: 'pending', note: 'хочу на вечера', decision_note: '', created_at: '2026-10-27T10:00:00+00:00', decided_at: null,
        member_id: 501, first_name: 'Вера', last_name: 'Заявкина', username: null, tier_code: 'member', tier_name: 'Член клуба', has_pass: false },
      { id: 9, status: 'approved', note: '', decision_note: 'ждём в кассе', created_at: '2026-10-26T10:00:00+00:00', decided_at: '2026-10-26T12:00:00+00:00',
        member_id: 502, first_name: 'Лев', last_name: '', username: null, tier_code: 'organizer', tier_name: 'Мастер', has_pass: true }] };
    const memCase = (me, r = {}) => {
      let meN = 0;
      return open(true, true, json(200, me), null, null, null, q => {
        const u = q.url(), m = q.method();
        if (u.endsWith('/me') && m === 'GET') { meN += 1; return meN > 1 && r.me2 ? json(200, r.me2) : json(200, me); }
        if (u.endsWith('/membership-tiers')) return r.tiers || json(200, TIERS_);
        if (/\/membership-requests\/\d+\/decide$/.test(u)) return r.decide || json(200, { id: 11, status: JSON.parse(q.postData()).decision, decided_at: '2026-10-27T13:00:00+00:00' });
        if (/\/membership-requests$/.test(u) && m === 'POST') return r.post || json(201, { id: 12, status: 'pending', created_at: '2026-10-27T13:00:00+00:00', tier: 'Мастер' });
        if (/\/membership-requests$/.test(u)) return r.list || json(200, REQS_);
        return undefined;
      });
    };
    const wire = (s, screen) => s.p.evaluate(sc => { WIRED.membership = 1; WIRED.memberRequests = 1; go(sc); }, screen).then(() => s.p.waitForTimeout(300));
    const sends = s => s.p.evaluate(() => [...document.querySelectorAll('#view [data-action^="mr-send:"]')].map(b => b.textContent));
    // нажатие с охраной: кнопки нет — своя строка, а не исключение, обрывающее батарею
    const press = async (s, n, sel) => {
      const ok = await s.p.evaluate(q => { const x = document.querySelector(q); if (x) x.click(); return !!x; }, sel);
      if (!ok) bad.push(`${n}: нет кнопки ${sel}`);
      await s.p.waitForTimeout(sel.includes('mr-send') || /mq-(ok|no)/.test(sel) ? 400 : 150);
      return ok;
    };
    const posts = (s, re) => s.calls.filter(c => c.method === 'POST' && re.test(c.url));
    const gets = (s, re) => s.calls.filter(c => c.method === 'GET' && re.test(c.url));

    // гость без заявки: виды и цены — сервера, вид выбирается, подача одним нажатием (кадр E38)
    {
      const s = await memCase(GUEST), n = 'mreq-tiers';
      await wire(s, 'membership');
      let t = await s.view();
      for (const w of ['Членства нет', 'Член клуба', '1 234 ฿', '2 345.50 ฿', 'за 3 месяца', '4 321 ฿', 'в месяц'])
        if (!t.includes(w)) bad.push(`${n}: нет «${w}» — цена не с сервера (Cafe13KPG#415)`);
      if (/3 ?316|6 ?633|9 ?950/.test(t)) bad.push(`${n}: на экране настоящая цена, а фикстура её не давала — цена вшита в клиент`);
      for (const w of ['Вход по пропуску.', 'Свои вечера.', 'Своё дело.'])
        if (!t.includes(w)) bad.push(`${n}: нет описания вида «${w}» с сервера`);
      if (/Бесплатный вход в клуб|право проводить свои мероприятия/.test(t)) bad.push(`${n}: на экране описание, которого фикстура не давала — текст вшит в клиент`);
      let b = await sends(s);
      if (b.length !== 1 || b[0] !== 'Подать заявку') bad.push(`${n}: кнопки подачи ${JSON.stringify(b)}, ждали одну «Подать заявку»`);
      await press(s, n, '[data-action="mr-pick:organizer"]');
      const on = await s.p.evaluate(() => [...document.querySelectorAll('#view [aria-pressed="true"]')].map(x => x.textContent));
      if (on.join() !== 'Мастер') bad.push(`${n}: выбран ${JSON.stringify(on)}, а нажат «Мастер»`);
      await press(s, n, '[data-action^="mr-send:"]');
      const pp = posts(s, /\/membership-requests$/);
      if (pp.length !== 1 || JSON.parse(pp[0].body).tier_code !== 'organizer') bad.push(`${n}: заявка ушла не так: ${JSON.stringify(pp.map(c => c.body))}`);
      t = await s.view();
      if (!t.includes('Заявка отправлена') || !t.includes('Мастер · отправлена')) bad.push(`${n}: после подачи нет «Заявка отправлена» на «Мастер»`);
      if ((await sends(s)).length) bad.push(`${n}: после подачи кнопка подачи осталась — вторая заявка уйдёт 409`);
      await s.ctx.close();
    }
    // состояния своей заявки из /me (кадры E38d, E38e, E38zh; прошлые — как «заявки нет»)
    for (const [st, said, want, nowant, btn] of [
      ['pending', '', ['Заявка отправлена', 'ЖДЁТ ОТВЕТА', 'Глава клуба ответит в приложении'], ['Глава клуба согласен', 'Заявка отклонена'], []],
      // ⚠ согласие — не членство: «оформлено» здесь — ложь человеку
      ['approved', 'ждём в кассе', ['Глава клуба согласен', 'СОГЛАСОВАНО', 'Членство создаст касса', '1 234 ฿ в месяц'], ['оформлен', 'Оформлен', 'Заявка отправлена'], []],
      ['rejected', 'приходите в пятницу', ['Заявка отклонена', 'ОТКАЗАНО', '«приходите в пятницу»'], ['Глава клуба согласен'], ['Подать снова']],
      ['rejected', '', ['Заявка отклонена'], ['«»'], ['Подать снова']],
      ['completed', '', ['Членства нет'], ['Заявка отправлена', 'Глава клуба согласен', 'Заявка отклонена'], ['Подать заявку']],
      ['cancelled', '', ['Членства нет'], ['Заявка отправлена', 'Глава клуба согласен', 'Заявка отклонена'], ['Подать заявку']]]) {
      const n = `mreq-${st}${said ? '' : '-bare'}`;
      const s = await memCase(withReq(GUEST, st, said));
      await wire(s, 'membership');
      const t = await s.view();
      want.forEach(w => { if (!t.includes(w)) bad.push(`${n}: нет «${w}»`); });
      nowant.forEach(w => { if (t.includes(w)) bad.push(`${n}: есть «${w}»${st === 'approved' ? ' — согласие выдано за членство (Cafe13KPG#415)' : ''}`); });
      const b = await sends(s);
      if (JSON.stringify(b) !== JSON.stringify(btn)) bad.push(`${n}: кнопки подачи ${JSON.stringify(b)}, ждали ${JSON.stringify(btn)}`);
      if (posts(s, /\/membership-requests/).length) bad.push(`${n}: заявка ушла без нажатия`);
      if (st === 'rejected' && b.length) {
        await press(s, n, '[data-action^="mr-send:"]');
        const pp = posts(s, /\/membership-requests$/);
        if (pp.length !== 1 || JSON.parse(pp[0].body).tier_code !== 'member') bad.push(`${n}: «Подать снова» ушла не на прежний вид: ${JSON.stringify(pp.map(c => c.body))}`);
      }
      await s.ctx.close();
    }
    // отказ сервера — его словами, и состояние перечитано: сервер знает новее нас
    {
      const n = 'mreq-409';
      const s = await memCase(GUEST, { post: json(409, { detail: 'ваша заявка уже отправлена и ждёт ответа' }), me2: withReq(GUEST, 'pending') });
      await wire(s, 'membership');
      await press(s, n, '[data-action^="mr-send:"]');
      const t = await s.view();
      if (!t.includes('Ваша заявка уже отправлена и ждёт ответа.')) bad.push(`${n}: отказ сервера не показан его словами`);
      if (gets(s, /\/me$/).length < 2) bad.push(`${n}: после 409 /me не перечитан`);
      if (!t.includes('ЖДЁТ ОТВЕТА')) bad.push(`${n}: перечитанная заявка не показана`);
      await s.ctx.close();
    }
    // член клуба: свой вид отмечен, подавать нечего (кадр E38b)
    {
      const n = 'mreq-member';
      const s = await memCase(OWNER);
      await wire(s, 'membership');
      const mine = await s.p.evaluate(() => [...document.querySelectorAll('#view .card.strong h2')].map(e => e.textContent));
      if (mine.join() !== 'Член клуба') bad.push(`${n}: активное членство ${JSON.stringify(mine)}, ждали «Член клуба»`);
      const has = await s.p.evaluate(() => [...document.querySelectorAll('#view .rows > div')].filter(r => r.textContent.includes('У ВАС ЕСТЬ')).map(r => r.querySelector('b').textContent));
      if (has.join() !== 'Член клуба') bad.push(`${n}: «У ВАС ЕСТЬ» у ${JSON.stringify(has)}`);
      if ((await sends(s)).length) bad.push(`${n}: у члена клуба есть кнопка подачи`);
      await s.ctx.close();
    }
    // /me без поля — сервер до выкладки заявок: приложение живёт; поле кривое — /me не разобран
    {
      const s = await memCase(GUEST);
      if (await s.p.evaluate(() => current) === 'apiDown') bad.push('mreq-oldsrv: /me без membership_request уронил приложение — до выкладки api так у всех');
      await s.ctx.close();
      const badReq = clone(GUEST); badReq.membership_request = { id: 7, status: 'paid' };
      const s2 = await memCase(badReq);
      if (await s2.p.evaluate(() => current) !== 'apiDown') bad.push('mreq-badreq: заявка с чужим статусом принята — /me должен считаться неразобранным');
      await s2.ctx.close();
    }
    // вход у главы клуба: только с правом и только когда экран включён; подпись — счёт с сервера (кадр E42g)
    {
      const n = 'mq-entry';
      const s = await memCase(OWNER);
      await s.p.evaluate(() => go('home')); await s.p.waitForTimeout(200);
      if (await s.p.$('#view [data-go="memberRequests"]')) bad.push(`${n}: строка «Заявки на членство» есть, хотя экран не включён — вела бы в заглушку`);
      await s.p.evaluate(() => { WIRED.memberRequests = 1; go('guest'); go('home'); }); await s.p.waitForTimeout(300);
      if (!(await s.p.$('#view [data-go="memberRequests"]'))) bad.push(`${n}: у главы клуба нет строки «Заявки на членство»`);
      else if (!(await s.view()).includes('Ждут ответа: 1')) bad.push(`${n}: в строке входа нет счёта ждущих с сервера (кадр E42g)`);
      // кадр E42g: одна группа «Работа»; второй группы «Клуб» нет. «Люди» в E42g стояли в той же
      // группе — с решения владельца 28.10.2026 они во вкладке «Управление» (E46, Cafe13KPG#413),
      // и на главной их быть не должно: рабочее не живёт внутри клиентского.
      const g = await s.p.evaluate(() => {
        const labels = [...document.querySelectorAll('#view .group > .label')].map(l => l.textContent);
        const r = document.querySelector('#view [data-go="memberRequests"]');
        return { work: labels.filter(l => l === 'Работа').length, club: labels.filter(l => l === 'Клуб').length,
                 people: !!document.querySelector('#view [data-go="people"]'),
                 label: r && r.closest('.group') ? r.closest('.group').querySelector(':scope > .label').textContent : null };
      });
      if (g.work !== 1 || g.club !== 0) bad.push(`${n}: групп «Работа» ${g.work}, «Клуб» ${g.club} — ждали одну «Работа» (кадр E42g)`);
      if (g.label !== 'Работа') bad.push(`${n}: «Заявки на членство» не в группе «Работа»: ${JSON.stringify(g)} (кадр E42g)`);
      if (g.people) bad.push(`${n}: на главной остался вход «Люди» — он во вкладке «Управление» (E46)`);
      await s.ctx.close();
      const MEM = clone(OWNER); MEM.roles = [];
      const s2 = await memCase(MEM);
      await s2.p.evaluate(() => { WIRED.memberRequests = 1; go('guest'); go('home'); }); await s2.p.waitForTimeout(200);
      if (await s2.p.$('#view [data-go="memberRequests"]')) bad.push(`${n}: у члена клуба без роли есть строка «Заявки на членство»`);
      await s2.p.evaluate(() => go('memberRequests')); await s2.p.waitForTimeout(200);
      if (!(await s2.view()).includes('смотрит и решает глава клуба')) bad.push(`${n}: экран заявок без права не сказал, кто решает`);
      if (gets(s2, /\/membership-requests$/).length) bad.push(`${n}: заявки спрошены без права`);
      await s2.ctx.close();
      // бармен: группа «Работа» у него есть (barSide), а права на заявки нет — внутренняя охрана строки
      const BAR_ = clone(OWNER); BAR_.roles = [{ role: 'bar', direction_id: 7 }];
      const s3 = await memCase(BAR_);
      await s3.p.evaluate(() => { WIRED.memberRequests = 1; go('guest'); go('home'); }); await s3.p.waitForTimeout(200);
      if (!(await s3.p.$('#view [data-go="barQueue"]'))) bad.push(`${n}: у бармена нет группы «Работа» — фикстура не та`);
      if (await s3.p.$('#view [data-go="memberRequests"]')) bad.push(`${n}: у бармена без права главы клуба есть строка «Заявки на членство»`);
      await s3.ctx.close();
      // Свидетели КАЖДОЙ половины права (Cafe13KPG#434). OWNER держит и head, и admin, поэтому
      // подлог, снявший одну половину `mayRequests`, на нём не виден. Свидетель годится только
      // тот, кто держит ИМЕННО снимаемую половину: глава без админа — для `grant('head')`, админ
      // без главы — для `grant('admin')`. Сервер пускает обоих (DECIDES = head, плюс is_admin).
      for (const [who, roles] of [['глава клуба без админа', [{ role: 'head', direction_id: null }]],
                                  ['админ без главы клуба', [{ role: 'admin', direction_id: null }]]]) {
        const X = clone(OWNER); X.roles = roles;
        const sx = await memCase(X);
        await sx.p.evaluate(() => { WIRED.memberRequests = 1; go('guest'); go('home'); }); await sx.p.waitForTimeout(200);
        if (!(await sx.p.$('#view [data-go="memberRequests"]'))) bad.push(`${n}: у «${who}» нет строки «Заявки на членство» — сервер его пускает`);
        await wire(sx, 'memberRequests');
        if ((await sx.view()).includes('смотрит и решает глава клуба')) bad.push(`${n}: «${who}» получил отказ на экране заявок — сервер его пускает`);
        else {
          await press(sx, n, '[data-action="mq-ok:11"]');
          if (posts(sx, /\/membership-requests\/11\/decide$/).length !== 1) bad.push(`${n}: у «${who}» согласие не ушло на сервер`);
        }
        await sx.ctx.close();
      }
    }
    // согласие — без слова; отказ — со словом, через «Точно отказать»; список перечитан (кадры E42, E42v)
    {
      const n = 'mq-decide';
      const s = await memCase(OWNER);
      await wire(s, 'memberRequests');
      let t = await s.view();
      for (const w of ['Ждут ответа · 1', 'Вера Заявкина', '1 234 ฿', 'пропуска нет', '«хочу на вечера»', 'Лев', 'СОГЛАСОВАНА', '«ждём в кассе»'])
        if (!t.includes(w)) bad.push(`${n}: нет «${w}»`);
      if (/оформлен|ОФОРМЛЕН/.test(t)) bad.push(`${n}: согласованная заявка названа оформленной`);
      await press(s, n, '[data-action="mq-ok:11"]');
      let pp = posts(s, /\/membership-requests\/11\/decide$/);
      let body = pp.length === 1 ? JSON.parse(pp[0].body) : null;
      if (!body || body.decision !== 'approved' || body.note !== '') bad.push(`${n}: согласие ушло так: ${JSON.stringify(pp.map(c => c.body))}`);
      if (gets(s, /\/membership-requests$/).length !== 2) bad.push(`${n}: после решения список не перечитан`);
      // отказ: сначала слово, «Не отказывать» ничего не шлёт
      await press(s, n, '[data-action="mq-ask:11"]');
      if (!(await s.p.$('#d-note'))) bad.push(`${n}: «Отказать» не открыло поле слова (кадр E42v)`);
      else {
        await press(s, n, '[data-action="mq-keep"]');
        if (await s.p.$('#d-note')) bad.push(`${n}: «Не отказывать» не закрыло поле`);
        await press(s, n, '[data-action="mq-ask:11"]');
        await s.p.fill('#d-note', 'приходите в четверг');
        await press(s, n, '[data-action="mq-no:11"]');
        pp = posts(s, /\/membership-requests\/11\/decide$/);
        body = pp.length === 2 ? JSON.parse(pp[1].body) : null;
        if (!body || body.decision !== 'rejected' || body.note !== 'приходите в четверг') bad.push(`${n}: отказ ушёл так: ${JSON.stringify(pp.map(c => c.body))}`);
      }
      await s.ctx.close();
    }
    {
      const n = 'mq-deny';
      const s = await memCase(OWNER, { decide: json(409, { detail: 'заявка уже отклонена' }) });
      await wire(s, 'memberRequests');
      await press(s, n, '[data-action="mq-ask:11"]');
      await press(s, n, '[data-action="mq-no:11"]');
      if (!(await s.view()).includes('Заявка уже отклонена.')) bad.push(`${n}: отказ сервера не показан его словами`);
      await s.ctx.close();
    }
    {
      const n = 'mq-empty';
      const s = await memCase(OWNER, { list: json(200, { requests: [], pending: 0 }) });
      await wire(s, 'memberRequests');
      if (!(await s.view()).includes('Заявок нет')) bad.push(`${n}: пустой список не сказал «Заявок нет» (кадр E42b)`);
      await s.ctx.close();
    }
  }
  // ── заявки на доступ: очередь главы клуба (кадры E45*, Cafe13KPG#413) ──
  // Люди ВЫДУМАНЫ, имена кадра сюда не переносятся (репозиторий публичный).
  // Суммы выдуманы тоже: число, вшитое в клиент, на них краснеет.
  // tg_user_id — 801…803: в разметку и хранилище он попадать не должен.
  {
    // 1×1 PNG — настоящий файл: objectURL от пустого тела экран честно не покажет
    const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const JREQ = { pending: 2, requests: [
      { id: 21, tg_user_id: 801, first_name: 'Ада', last_name: 'Доступова', username: null, said: 'была на трёх вечерах',
        receipt_mime: 'image/png', receipt_bytes: 3072, amount_thb: '1111.00', amount_usd: '22.00',
        status: 'pending', status_ru: 'ждёт ответа', created_at: '2026-10-27T10:00:00+00:00', decided_at: null, decision_note: '' },
      { id: 22, tg_user_id: 802, first_name: 'Борис', last_name: null, username: 'kvitancin', said: '',
        receipt_mime: 'application/pdf', receipt_bytes: 204800, amount_thb: '1111.00', amount_usd: null,
        status: 'pending', status_ru: 'ждёт ответа', created_at: '2026-10-27T09:00:00+00:00', decided_at: null, decision_note: '' },
      { id: 19, tg_user_id: 803, first_name: 'Вадим', last_name: 'Решённый', username: null, said: '',
        receipt_mime: 'image/jpeg', receipt_bytes: 1000, amount_thb: '1111.00', amount_usd: '22.00',
        status: 'rejected', status_ru: 'отклонена', created_at: '2026-10-25T09:00:00+00:00', decided_at: '2026-10-25T12:00:00+00:00',
        decision_note: 'познакомимся лично' },
      { id: 18, tg_user_id: 804, first_name: 'Галина', last_name: 'Впущенная', username: null, said: '',
        receipt_mime: 'image/webp', receipt_bytes: 1000, amount_thb: '1111.00', amount_usd: '22.00',
        status: 'approved', status_ru: 'согласована', created_at: '2026-10-24T09:00:00+00:00', decided_at: '2026-10-24T12:00:00+00:00',
        decision_note: '' }] };
    const JNOTE = 'Согласие одним действием впускает в приложение И создаёт членство.';
    const joinCase = (me, r = {}) => open(true, true, json(200, me), null, null, null, q => {
      const u = q.url();
      if (/\/join\/requests\/\d+\/receipt$/.test(u)) return r.shot || { status: 200, contentType: 'image/png', body: PNG1 };
      if (/\/join\/requests\/\d+\/decide$/.test(u)) return r.decide || json(200, { id: 21, status: JSON.parse(q.postData()).decision, decided_at: '2026-10-27T13:00:00+00:00' });
      if (/\/join\/requests$/.test(u)) return r.list || json(200, JREQ);
      return undefined;
    });
    const toJoin = s => s.p.evaluate(() => go('joinQueue')).then(() => s.p.waitForTimeout(400));
    const press = async (s, n, a) => {
      const ok = await s.p.evaluate(a => { const x = document.querySelector(`#view [data-action="${a}"]`); if (x) x.click(); return !!x; }, a);
      if (!ok) bad.push(`${n}: нет кнопки ${a}`);
      await s.p.waitForTimeout(/^j-(yes|no):/.test(a) ? 400 : 150);
      return ok;
    };
    const posts = (s, re) => s.calls.filter(c => c.method === 'POST' && re.test(c.url));
    const gets = (s, re) => s.calls.filter(c => c.method === 'GET' && re.test(c.url));

    // очередь: ждущие с чеком и суммами заявки, решённые без кнопок (E45, E45g)
    {
      const n = 'join-queue', s = await joinCase(OWNER);
      await toJoin(s);
      const t = await s.view();
      for (const w of ['Ждут ответа · 2', 'Ада Доступова', 'просит доступ', '«была на трёх вечерах»', 'PNG · 3 КБ', 'PDF · 200 КБ',
                       '1 111 ฿', '22 USDT', 'Борис', 'Решённые', 'Вадим Решённый', 'ОТКАЗАНО', '«познакомимся лично»',
                       'Галина Впущенная', 'ВПУЩЕНА', JNOTE])
        if (!t.includes(w)) bad.push(`${n}: нет «${w}»`);
      if (/открыть/.test(t)) bad.push(`${n}: у PDF стоит «открыть», а в Telegram это не проверено (#413)`);
      // у Бориса суммы в долларах нет — и строка не обещает её
      const boris = await s.p.evaluate(() => [...document.querySelectorAll('#view .card')].map(c => c.textContent).filter(x => x.includes('Борис'))[0] || '');
      if (/USDT/.test(boris)) bad.push(`${n}: у просьбы без amount_usd показана сумма в USDT`);
      // решённым нечем решать: 2 карточки × 2 кнопки
      const btn = await s.p.evaluate(() => [...document.querySelectorAll('#view [data-action^="j-"]')].map(b => b.getAttribute('data-action')));
      if (JSON.stringify(btn.sort()) !== JSON.stringify(['j-ask:21', 'j-ask:22', 'j-ok:21', 'j-ok:22']))
        bad.push(`${n}: кнопки решения ${JSON.stringify(btn)}, ждали только у ждущих 21 и 22`);
      // чек картинкой — по байтам с сервера; PDF и решённые не спрашиваются
      const shots = gets(s, /\/receipt$/).map(c => c.url.replace(/.*requests\//, ''));
      if (JSON.stringify(shots) !== JSON.stringify(['21/receipt'])) bad.push(`${n}: чеки спрошены так: ${JSON.stringify(shots)}, ждали только 21`);
      const img = await s.p.evaluate(() => { const i = document.querySelector('#view img[alt="Чек"]'); return i ? i.getAttribute('src') : null; });
      if (!img || !img.startsWith('blob:')) bad.push(`${n}: чек не показан картинкой из ответа сервера (${img})`);
      // подпись — та же, что у остальных ручек: без неё сервер чек не отдаст
      if (gets(s, /\/receipt$/).some(c => c.init !== INIT)) bad.push(`${n}: чек спрошен без подписи`);
      // адрес чека `blob:` несёт случайный UUID, и в нём «801» бывает само (Cafe13KPG#486): его вырезаем
      // ДО поиска; настоящий id в разметке по-прежнему краснит — проверяется подлогом в самом случае
      const html = await s.p.evaluate(() => document.getElementById('view').innerHTML);
      const bare = h => h.replace(/blob:[^"'\s)]*/g, '');
      if (/80[1-4]/.test(bare(html))) bad.push(`${n}: tg_user_id в разметке`);
      if (!/80[1-4]/.test(bare(html + '<span data-x="801"></span>')) || /80[1-4]/.test(bare('<img src="blob:file:///aa801bb">')))
        bad.push(`${n}: вырезка blob: слепа или шире своего предмета — признак id не различает`);
      const stored = await s.p.evaluate(() => JSON.stringify(Object.assign({}, localStorage, sessionStorage)));
      if (/80[1-4]|Доступова/.test(stored)) bad.push(`${n}: просьбы легли в хранилище браузера`);
      if (s.errs.length) bad.push(`${n}: ошибки страницы ${s.errs.join('; ')}`);
      await s.p.screenshot({ path: `${OUT}/live-join-queue.png` });
      await s.ctx.close();
    }
    // согласие необратимо: первое нажатие только спрашивает, «назад» не шлёт ничего
    {
      const n = 'join-approve', s = await joinCase(OWNER);
      await toJoin(s);
      await press(s, n, 'j-ok:21');
      if (posts(s, /\/decide$/).length) bad.push(`${n}: согласие ушло с первого нажатия — подтверждения нет (#413)`);
      if (!(await s.p.$('#view [data-action="j-yes:21"]'))) bad.push(`${n}: после «Согласиться» нет шага подтверждения`);
      // фраза E45d с v74 — новая: кнопка «Исключить» на «Членах клуба» появилась (до v74 обещала бы несуществующее)
      for (const w of ['Обратного действия у согласия нет: человека можно только ИСКЛЮЧИТЬ из клуба', 'Не соглашаться', 'Точно согласиться'])
        if (!(await s.view()).includes(w)) bad.push(`${n}: нет «${w}» (кадр E45d)`);
      // подпись под списком при раскрытом вопросе остаётся (E45d)
      if (!(await s.view()).includes(JNOTE)) bad.push(`${n}: подпись о согласии исчезла при раскрытом вопросе (кадр E45d)`);
      if ((await s.p.$('#view textarea'))) bad.push(`${n}: у согласия поле слова, а в E45d его нет`);
      await press(s, n, 'j-keep');
      if (await s.p.$('#view [data-action="j-yes:21"]')) bad.push(`${n}: «назад» не закрыл подтверждение`);
      if (posts(s, /\/decide$/).length) bad.push(`${n}: «назад» отправил решение`);
      // подтверждение чужой карточки чужим номером не проходит
      await s.p.evaluate(() => { JOINQ.ok = 22; render(); });
      await s.p.evaluate(() => { const b = document.querySelector('#view [data-action="j-yes:22"]'); b.setAttribute('data-action', 'j-yes:21'); b.click(); });
      await s.p.waitForTimeout(300);
      if (posts(s, /\/decide$/).length) bad.push(`${n}: подтверждение ушло по просьбе, о которой не спрашивали`);
      await press(s, n, 'j-keep');
      await press(s, n, 'j-ok:21');
      await press(s, n, 'j-yes:21');
      const pp = posts(s, /\/join\/requests\/21\/decide$/);
      const body = pp.length === 1 ? JSON.parse(pp[0].body) : null;
      if (!body || body.decision !== 'approved' || body.note !== '') bad.push(`${n}: согласие ушло так: ${JSON.stringify(pp.map(c => c.body))}`);
      if (gets(s, /\/join\/requests$/).length !== 2) bad.push(`${n}: после решения список не перечитан`);
      await s.ctx.close();
    }
    // отказ — со словом заявителю (E45v)
    {
      const n = 'join-reject', s = await joinCase(OWNER);
      await toJoin(s);
      await press(s, n, 'j-ask:21');
      if (!(await s.view()).includes('Слово заявителю')) bad.push(`${n}: «Отказать» не открыло поле слова (кадр E45v)`);
      for (const w of ['Не отказывать', 'Отказать и отправить']) if (!(await s.view()).includes(w)) bad.push(`${n}: нет «${w}» (кадр E45v)`);
      await s.p.fill('#j-note', 'приходите в четверг');
      await press(s, n, 'j-no:21');
      const pp = posts(s, /\/join\/requests\/21\/decide$/);
      const body = pp.length === 1 ? JSON.parse(pp[0].body) : null;
      if (!body || body.decision !== 'rejected' || body.note !== 'приходите в четверг') bad.push(`${n}: отказ ушёл так: ${JSON.stringify(pp.map(c => c.body))}`);
      await s.ctx.close();
    }
    // второе решение: 409 словами сервера, и очередь перечитана
    {
      const n = 'join-409', s = await joinCase(OWNER, { decide: json(409, { detail: 'просьба уже согласована' }) });
      await toJoin(s);
      await press(s, n, 'j-ok:21');
      await press(s, n, 'j-yes:21');
      if (!(await s.view()).includes('Просьба уже согласована.')) bad.push(`${n}: повторное решение не сказано словами сервера`);
      if (gets(s, /\/join\/requests$/).length !== 2) bad.push(`${n}: после 409 очередь не перечитана`);
      // занятость снята: кнопки снова нажимаются. Ищутся ВСЕ кнопки решения, а не j-ok:21 —
      // после 409 карточка остаётся в вопросе (j-keep / j-yes), и j-ok:21 на экране нет вовсе
      const btns = await s.p.evaluate(() => [...document.querySelectorAll('#view [data-action^="j-"]')].map(b => b.disabled));
      if (!btns.length) bad.push(`${n}: после 409 на экране нет кнопок решения — проверять занятость не на чем`);
      else if (btns.some(Boolean)) bad.push(`${n}: после отказа сервера экран заперт`);
      await s.ctx.close();
    }
    // пусто (E45b) и только решённые (E45g): подпись о согласии — только там, где решают или ждут
    {
      const n = 'join-empty', s = await joinCase(OWNER, { list: json(200, { requests: [], pending: 0 }) });
      await toJoin(s);
      const t = await s.view();
      if (!t.includes('Просьб нет') || !t.includes(JNOTE)) bad.push(`${n}: пустая очередь не по кадру E45b: ${t.slice(0, 120)}`);
      await s.ctx.close();
      const n2 = 'join-decided', s2 = await joinCase(OWNER, { list: json(200, { requests: JREQ.requests.slice(2), pending: 0 }) });
      await toJoin(s2);
      const t2 = await s2.view();
      if (!t2.includes('Решённые') || t2.includes('Ждут ответа')) bad.push(`${n2}: решённые не по кадру E45g`);
      if (t2.includes(JNOTE)) bad.push(`${n2}: подпись о согласии под одними решёнными (в E45g её нет)`);
      if (gets(s2, /\/receipt$/).length) bad.push(`${n2}: чек спрошен у решённой просьбы`);
      await s2.ctx.close();
    }
    // чек не пришёл (E45e): строка с «Повторить» вместо плитки, суммы на месте, решения живы
    {
      const n = 'join-shot-fail';
      let shotN = 0;
      const s = await joinCase(OWNER, { shot: () => (shotN += 1) === 1 ? json(500, { detail: 'x' }) : { status: 200, contentType: 'image/png', body: PNG1 } });
      await toJoin(s);
      const card21 = () => s.p.evaluate(() => [...document.querySelectorAll('#view .card')].map(c => c.textContent).filter(x => x.includes('Ада'))[0] || '');
      let c = await card21();
      for (const w of ['Чек не загрузился', 'Повторить', '1 111 ฿']) if (!c.includes(w)) bad.push(`${n}: нет «${w}» (кадр E45e)`);
      if (await s.p.$('#view img[alt="Чек"]')) bad.push(`${n}: на отказе чека показана картинка`);
      if (!(await s.p.$('#view [data-action="j-ok:21"]:not([disabled])'))) bad.push(`${n}: без чека решение заперто, а сервер его не запрещает (кадр E45e)`);
      await press(s, n, 'j-shot:21');
      await s.p.waitForTimeout(300);
      if (gets(s, /\/21\/receipt$/).length !== 2) bad.push(`${n}: «Повторить» не спросил чек снова (${gets(s, /\/21\/receipt$/).length})`);
      c = await card21();
      if (c.includes('Чек не загрузился') || !(await s.p.$('#view img[alt="Чек"]'))) bad.push(`${n}: после «Повторить» чек не показан`);
      await s.ctx.close();
    }
    // список не загрузился — форма близнеца E42; одна битая строка — отказ целиком
    {
      const n = 'join-fail', s = await joinCase(OWNER, { list: json(500, { detail: 'x' }) });
      await toJoin(s);
      if (!(await s.view()).includes('Просьбы не загрузились')) bad.push(`${n}: отказ списка не сказан`);
      await s.ctx.close();
      const broken = clone(JREQ); broken.requests[1].receipt_bytes = null;
      const s2 = await joinCase(OWNER, { list: json(200, broken) });
      await toJoin(s2);
      const t2 = await s2.view();
      if (!t2.includes('Просьбы не загрузились') || t2.includes('Ада Доступова')) bad.push(`${n}: битая строка не отвергла ответ целиком`);
      await s2.ctx.close();
    }
    // Подпись вкладки не переносится в две строки на УЗКОМ окне, 360 px. Перенос на 390 px
    // уже ловит `tabs-vse` (#410, прежде `tabs-vse-sem`) — мутация `white-space: nowrap` → `normal` краснит и его,
    // поэтому 390 здесь не повторяется. Признак — высоты подписей (форма — designer-55,
    // 28.10.2026): подпись выше самой низкой больше чем на 1 px — перенесена.
    {
      const n = 'tabs-perenos';
      const lv = l => ({ level: l, starts_at: '2026-10-01T00:00:00+00:00', ends_at: '2027-11-01T00:00:00+07:00', lifelong: false });
      const who = roles => { const m = clone(OWNER); m.membership = lv('partner'); m.membership_active = true;
        m.memberships = ['member', 'organizer', 'partner'].map(lv); m.roles = roles; return m; };
      // семь: касса и бар без права главы; восемь: роли OWNER (глава и админ) — плюс «Управление»
      for (const [k, roles, count] of [['семь', [{ role: 'staff', direction_id: null }, { role: 'bar', direction_id: 7 }], 7],
                                       ['восемь', OWNER.roles, 8]]) {
        for (const w of [360]) {
          const s = await open(true, true, json(200, who(roles)));
          await s.p.setViewportSize({ width: w, height: 844 }); await s.p.waitForTimeout(150);
          const r = await s.p.evaluate(() => {
            const sp = [...document.querySelectorAll('#tabs span')];
            const h = sp.map(e => e.getBoundingClientRect().height);
            return { n: sp.length, wrap: sp.filter(e => e.getBoundingClientRect().height > Math.min(...h) + 1).map(e => e.textContent) };
          });
          // различитель: вкладок столько, сколько задумано, — иначе спрашиваем не тот набор
          if (r.n !== count) bad.push(`${n}: ${k}, ${w} px — вкладок ${r.n}, ждали ${count}; признак переноса спрашивает не тот набор`);
          else if (r.wrap.length) bad.push(`${n}: ${k}, ${w} px — подпись в две строки: ${JSON.stringify(r.wrap)}`);
          await s.ctx.close();
        }
      }
    }
    // вкладка «Управление» (E46): последней, только у главы; до ответа сервера — не ноль
    {
      const n = 'manage-tab';
      let release;
      const held = new Promise(r => { release = r; });
      const s = await joinCase(OWNER, { list: held.then(() => json(200, JREQ)) });
      const tabs = await s.p.evaluate(() => [...document.querySelectorAll('#tabs [data-go]')].map(b => b.getAttribute('data-go')));
      if (tabs[tabs.length - 1] !== 'manage') bad.push(`${n}: «Управление» не последняя вкладка: ${JSON.stringify(tabs)} (кадр E46)`);
      await s.p.evaluate(() => document.querySelector('#tabs [data-go="manage"]').click());
      await s.p.waitForTimeout(250);
      let t = await s.view();
      // различитель: список ещё в пути — иначе случай не проверяет подпись «до счёта»
      if (gets(s, /\/join\/requests$/).length !== 1) bad.push(`${n}: вкладка не спросила очередь — счёту неоткуда взяться`);
      if (!t.includes('Кто просится в клуб')) bad.push(`${n}: пока счёт не пришёл, нет «Кто просится в клуб» (кадр E46)`);
      if (/Ждут ответа: 0/.test(t)) bad.push(`${n}: до ответа сервера показан ноль — читается как «никто не просится»`);
      for (const w of ['Кто в клубе', 'Заявки на доступ', 'Члены клуба', 'Кто в клубе и с какими уровнями'])
        if (!t.includes(w)) bad.push(`${n}: нет «${w}» (кадр E46)`);
      release();
      await s.p.waitForTimeout(400);
      t = await s.view();
      if (!t.includes('Ждут ответа: 2')) bad.push(`${n}: счёт ждущих с сервера не показан (ждали «Ждут ответа: 2»)`);
      // на вкладке чеки не качаются: только счёт
      if (gets(s, /\/receipt$/).length) bad.push(`${n}: вкладка скачала чеки`);
      await s.ctx.close();
      const MEM = clone(OWNER); MEM.roles = [];
      const s2 = await joinCase(MEM);
      if (await s2.p.$('#tabs [data-go="manage"]')) bad.push(`${n}: у члена клуба без роли есть вкладка «Управление»`);
      await s2.ctx.close();
    }
    // право: член без ролей — отказ без запроса; свидетели КАЖДОЙ половины права (#434)
    {
      const n = 'join-rights';
      const MEM = clone(OWNER); MEM.roles = [];
      const s = await joinCase(MEM);
      await toJoin(s);
      // E45zh: слова отказа сервера буквой, кнопок нет
      for (const w of ['Сюда нельзя', 'Просьбы о вступлении смотрит и решает глава клуба.'])
        if (!(await s.view()).includes(w)) bad.push(`${n}: без права нет «${w}» (кадр E45zh)`);
      if (await s.p.$('#view button')) bad.push(`${n}: на экране без права есть кнопка, а идти некуда (кадр E45zh)`);
      if (gets(s, /\/join\//).length) bad.push(`${n}: очередь спрошена без права`);
      await s.ctx.close();
      for (const [who, roles] of [['глава клуба без админа', [{ role: 'head', direction_id: null }]],
                                  ['админ без главы клуба', [{ role: 'admin', direction_id: null }]]]) {
        const X = clone(OWNER); X.roles = roles;
        const sx = await joinCase(X);
        await toJoin(sx);
        if ((await sx.view()).includes('смотрит и решает глава клуба')) bad.push(`${n}: «${who}» получил отказ — сервер его пускает`);
        else if (gets(sx, /\/join\/requests$/).length !== 1) bad.push(`${n}: у «${who}» очередь не спрошена`);
        await sx.ctx.close();
      }
    }
  }
  // Рабочие экраны в демонстрации (Cafe13KPG#409, вариант A). Три свойства, каждое своим случаем:
  // вне Telegram экран рисует СЕБЯ на демо-данных, а не отказ по праву (снимок отказа похож на
  // экран — отсюда и карточка); в живом режиме без прав — по-прежнему отказ, и демо-данные туда
  // не протекают; нажатие отправки в демонстрации не уходит на сервер и отвечает словами.
  {
    // [экран, параметр, признак экрана, признак отказа/пустоты]
    const WORK = [
      // v78: «Выдать ответственность» стала чипом, и слово «ответственность» есть и в ОТКАЗЕ
      // («Выдавать и снимать ответственность может глава клуба») — признак экрана берётся тот,
      // которого в отказе нет: подпись поля поиска
      ['people', null, 'Найти по имени', 'может глава клуба'],
      ['barCards', null, 'Ждут утверждения · 2', 'Карточки меню заводит'],
      ['barCard', '305', 'Заменить рецепт (RU)', 'Карточки меню заводит'],
      ['barRecipe', 'flat', 'Рецепта на английском нет — показан на русском', 'Рецепт — рабочая запись бара'],
      ['barMoney', null, 'Записано сейчас', 'вносит куратор'],
      ['tillPerson', null, 'Что принимаем', 'Человек не выбран'],
      ['tillMembership', null, 'Цену называет касса', 'Человек не выбран'],
      ['tillTopup', null, 'Сумму называет человек у стойки', 'Человек не выбран'],
      ['tillDay', null, 'Строки за сегодня', 'Касса — для работников']
    ];
    // нажатие с охраной: подлог, снявший кнопку, обязан дать СВОЮ строку, а не оборвать батарею
    const tapIf = async (s, sel, who) => {
      if (await s.p.$(sel)) { await s.p.click(sel); return true; }
      bad.push(`${who}: ПРОВЕРКА НЕ ВЫПОЛНЕНА — нет кнопки ${sel}`); return false;
    };
    {
      const s = await open(false, true, json(200, OWNER), null, null, null);
      for (const [scr, q, mark, deny] of WORK) {
        const before = s.calls.length;
        await s.p.evaluate(([x, y]) => go(x, y), [scr, q]); await s.p.waitForTimeout(60);
        const t = await s.view();
        if (!t.includes(mark)) bad.push(`demo-work ${scr}: нет «${mark}» — демонстрация не рисует экран (взято: ${t.slice(0, 70).replace(/\s+/g, ' ')})`);
        if (t.includes(deny)) bad.push(`demo-work ${scr}: в демонстрации отказ «${deny}» вместо экрана`);
        if (s.calls.length !== before) bad.push(`demo-work ${scr}: в демонстрации ушло запросов к серверу: ${s.calls.length - before}`);
      }
      // рецепт карточки — из данных демонстрации, а не пустое поле
      await s.p.evaluate(() => go('barCard', '305'));
      const rc = await s.p.evaluate(() => (document.getElementById('c-recipe') || {}).value);
      if (!rc || !rc.startsWith('Двойной ристретто')) bad.push('demo-work barCard: поле рецепта не из данных демонстрации: ' + JSON.stringify(rc));
      // номер человека не в разметке: карточка знает строку списка, а не tg_user_id
      await s.p.evaluate(() => go('people'));
      // номера берутся из памяти страницы, а не шаблоном: признак не зависит от вида номера
      const leak = await s.p.evaluate(() => {
        const html = document.getElementById('view').innerHTML, ids = (PEOPLE.list || []).map(x => String(x.uid));
        return ids.length ? ids.filter(id => html.includes(id)) : null;
      });
      if (leak === null) bad.push('demo-work people: ПРОВЕРКА НЕ ВЫПОЛНЕНА — список людей пуст, номера искать не в чем');
      else if (leak.length) bad.push('demo-work people: номер человека попал в разметку');
      // день кассы сходится: итог и строки демонстрации согласованы, а способы оплаты различимы
      await s.p.evaluate(() => go('tillDay'));
      const td = await s.view();
      if (td.includes('не сходится')) bad.push('demo-work tillDay: итог демонстрации не сходится со строками');
      const by = await s.p.evaluate(() => TD.data && [TD.data.by.cash, TD.data.by.card, TD.data.by.account]);
      if (!by || new Set(by).size !== 3) bad.push('demo-work tillDay: суммы по способам оплаты не различимы: ' + JSON.stringify(by));
      // отправка: «Точно отменить» в дне кассы не уходит и отвечает словами
      const n0 = s.calls.length;
      if (await tapIf(s, '[data-action="td-ask:0"]', 'demo-send tillDay') && await tapIf(s, '[data-action="td-cancel:0"]', 'demo-send tillDay')) {
        await s.p.waitForTimeout(100);
        const ts = await s.view();
        if (s.calls.length !== n0) bad.push('demo-send tillDay: «Точно отменить» в демонстрации ушло на сервер');
        if (!ts.includes('Это демонстрация')) bad.push('demo-send tillDay: на «Точно отменить» в демонстрации нет слова «Это демонстрация»');
      }
      // и запись расхода: после подтверждения «Записать» не уходит, «Записано сейчас» не растёт
      await s.p.evaluate(() => go('barMoney'));
      const k0 = await s.p.evaluate(() => BOOK.done.length);
      const W = 'demo-send barMoney';
      if (await tapIf(s, '[data-action="b-new:income"]', W)) {
        await s.p.fill('#b-amount', '700');
        const n1 = s.calls.length;
        if (await tapIf(s, '[data-action="b-method:cash"]', W) && await tapIf(s, '[data-action="b-ask"]', W) &&
            await tapIf(s, '[data-action="b-send"]', W)) {
          await s.p.waitForTimeout(100);
          if (s.calls.length !== n1) bad.push(W + ': «Записать» в демонстрации ушло на сервер');
          if (await s.p.evaluate(() => BOOK.done.length) !== k0) bad.push(W + ': «Записано сейчас» выросло без сервера');
          if (!(await s.view()).includes('Это демонстрация')) bad.push(W + ': нет слова «Это демонстрация»');
        }
      }
      if (s.errs.length) bad.push('demo-work: ошибки страницы: ' + s.errs.join(' | '));
      await s.ctx.close();
    }
    // Перебор нажатий (Cafe13KPG#444): каждая ОТРИСОВАННАЯ кнопка-действие девяти экранов в
    // демонстрации нажимается, и ни одна не уходит на сервер и не роняет страницу. Список
    // DEMO_SENDS здесь не читается нарочно: проверка, собранная из него, сверяла бы список сам с собой.
    // Три признака на каждое нажатие: не ушло на сервер, не уронило страницу, не промолчало.
    // ⚠ Предел: перебор видит только кнопки, до которых доходят нажатия на этих девяти экранах
    // (пустые поля заполняются цифрой «7»). Действие, которое рисуется от данных сервера или
    // живёт на экране вне перечня, мимо него — зелёное здесь НЕ значит «все действия покрыты».
    {
      const s = await open(false, true, json(200, OWNER), null, null, null);
      let pressed = 0;
      // к перечню — две карточки, которых список сам не открывает: новая (форма) и возвращённая
      for (const [scr, q] of WORK.concat([['barCard', 'new'], ['barCard', '303']])) {
        const seen = new Map();             // действие → сколько раз нажато
        let before = [];                      // кнопки, что были на экране ДО прошлого нажатия
        await s.p.evaluate(([x, y]) => go(x, y), [scr, q]);
        for (let step = 0; step < 80; step++) {
          if (await s.p.evaluate(x => current !== x, scr)) await s.p.evaluate(([x, y]) => go(x, y), [scr, q]);
          await s.p.evaluate(() => document.querySelectorAll('#view input:not([type]), #view input[type=text], #view textarea').forEach(i => {
            if (!i.value && !i.disabled) { i.value = '7'; i.dispatchEvent(new Event('input', { bubbles: true })); } }));
          const c0 = s.calls.length, e0 = s.errs.length;
          // слово «Это демонстрация» от прошлого нажатия снимается: иначе следующая защищённая
          // отправка оставила бы экран тем же, и немую кнопку от защищённой было бы не отличить
          await s.p.evaluate(() => { if (FLASH) { FLASH = null; render(); } });
          const h0 = await s.p.evaluate(() => document.getElementById('view').innerHTML);
          const on = await s.p.evaluate(() => [...document.querySelectorAll('#view button[data-action][aria-pressed="true"]')].map(x => x.dataset.action));
          const now = await s.p.evaluate(() => [...document.querySelectorAll('#view button[data-action]')].map(x => x.dataset.action));
          const a = await s.p.evaluate(([done, before]) => {
            const n = x => done[x.dataset.action] || 0;
            const all = [...document.querySelectorAll('#view button[data-action]:not([disabled])')];
            // сперва ПОСЛЕДНЯЯ из ненажатых, появившихся после прошлого нажатия: подтверждение
            // («Записать», «Точно отменить») стоит за «Не записывать», и первая по порядку закрыла
            // бы его; затем первая ненажатая; затем нажатая один раз — «Записать доход?» на пустой
            // форме ничего не открывает, а на заполненной открывает подтверждение
            const fresh = all.filter(x => !n(x) && !before.includes(x.dataset.action));
            const b = fresh.length ? fresh[fresh.length - 1] : all.find(x => !n(x)) || all.find(x => n(x) === 1);
            if (!b) return null; b.click(); return b.dataset.action;
          }, [Object.fromEntries(seen), before]);
          before = now;
          if (a === null) break;
          const first = !seen.has(a);
          seen.set(a, (seen.get(a) || 0) + 1); pressed++;
          await s.p.waitForTimeout(80);
          // Немая кнопка (Cafe13KPG#338): первое нажатие НЕвыбранной кнопки обязано изменить экран.
          // Без этого отправка, выпавшая из DEMO_SENDS и упёршаяся в ранний `return` (`!BAR` у
          // «Сохранить», `!canBook()` у «Записать»), не шлёт и не падает — и проходила зелёной.
          if (first && !on.includes(a) && await s.p.evaluate(x => current === x, scr) &&
              await s.p.evaluate(() => document.getElementById('view').innerHTML) === h0)
            bad.push(`demo-press ${scr}: нажатие «${a}» в демонстрации ничего не изменило на экране — немая кнопка (Cafe13KPG#338)`);
          if (s.calls.length !== c0) bad.push(`demo-press ${scr}: нажатие «${a}» в демонстрации ушло на сервер`);
          if (s.errs.length !== e0) bad.push(`demo-press ${scr}: нажатие «${a}» в демонстрации уронило страницу: ${s.errs.slice(e0).join(' | ')}`);
        }
      }
      // якорь присутствия: перебор, не нажавший почти ничего, о безопасности нажатий не говорит
      if (pressed < 30) bad.push(`demo-press: ПРОВЕРКА НЕ ВЫПОЛНЕНА — нажато действий ${pressed}, перебор не дошёл до экранов`);
      await s.ctx.close();
    }
    // живой режим, член клуба без единой роли: каждый экран — отказ или пустое место, демо-данных нет
    {
      const nobody = clone(OWNER); nobody.roles = [];
      const s = await open(true, true, json(200, nobody), null, null, null, book());
      for (const [scr, q, mark, deny] of WORK) {
        await s.p.evaluate(([x, y]) => go(x, y), [scr, q]); await s.p.waitForTimeout(250);
        const t = await s.view();
        if (!t.includes(deny)) bad.push(`live-norights ${scr}: в живом режиме без прав нет отказа «${deny}» (взято: ${t.slice(0, 70).replace(/\s+/g, ' ')})`);
        if (t.includes(mark)) bad.push(`live-norights ${scr}: в живом режиме без прав нарисован экран («${mark}»)`);
        if (/\[(имя члена|глава клуба|кассир)\]/.test(t)) bad.push(`live-norights ${scr}: в живой режим протекли люди демонстрации`);
      }
      await s.ctx.close();
    }
  }
  // Номера людей: репозиторий публичный — разрешающий список, tools/ids-clean.cjs.
  bad.push(...require('./ids-clean.cjs').idsClean(ROOT));

  await b.close();
  if (notes.length) console.log('НЕ СВЕРЕНО:\n  ' + notes.join('\n  '));
  if (bad.length) { console.log('КРАСНОЕ:\n' + bad.join('\n')); process.exit(1); }
  console.log('зелёное: ' + ran + ' прогонов экрана (из них ' + CASES.length + ' табличных)');
})();
