const { chromium } = require('playwright');
const fs = require('fs');

/* ДЫМ: приложение загружается и рисует главный экран — за секунды, отдельно от батареи.
   Слово владельца 29.10.2026: «хочу видеть результат в тот момент когда готово, тест ещё может
   идти». Между правкой и его глазами стоит только этот случай; полный `live.cjs` идёт после.

   Три исхода, и они НЕ склеиваются:
     0 — страница поднялась, главный экран нарисован, ошибок страницы нет;
     1 — не загрузилось, экран пуст, ошибка страницы — СВОИМ текстом;
     2 — проверка НЕ ВЫПОЛНЕНА: нет файлов клиента или браузер не поднялся. Это не «зелёное».
   Сломанный `app.js` обязан давать 1, а не 2: поломка клиента — красное, а не «мерить нечем».

   Живой режим без живого сервера: Telegram и API подменены на маршрутах, к api.cafe13.club не
   уходит ни один запрос. Человек — роль-словом (#495), его id — 1, как в `live.cjs`.

   Запуск: docker run --rm -v $PWD:/app:ro --entrypoint node agenthost/playwright:1.59.1 /app/tools/smoke.cjs */

const ROOT = process.env.APP || '/app';
const INIT = 'query_id=AAE&user=%7B%22id%22%3A1%7D&auth_date=1760000000&hash=stub';
const ME = {
  member: { tg_user_id: 1, first_name: '[член клуба]', last_name: '', username: null, photo_url: null, pass_code: null,
            created_at: '2026-10-01T00:00:00+00:00', consent_data_at: '2026-10-18T10:00:00+00:00', consent_filming_at: null },
  membership: { level: 'member', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: true },
  memberships: [{ level: 'member', starts_at: '2026-10-01T00:00:00+00:00', ends_at: null, lifelong: true }],
  membership_active: true, membership_request: null, balance: 1000, roles: []
};
/* Признак главного экрана — СТРУКТУРА, а не надписи (поправка координатора): правка слов — законная
   работа дизайнера, и дым, единственный на пути «правка → глаза владельца», не имеет права краснеть на
   ней. Надписи уже караулят `live.cjs` и `shots.cjs`. Здесь: вход в пропуск (`data-go="pass"`) на
   экране, не ноль входов на нём и вкладка главного (`data-go="home"`) в панели.
   ⚠ Предел, названный вслух: пустую или ложную НАДПИСЬ дым не видит — он отвечает «загрузилось ли»,
   а не «верны ли слова». Дефект на этом пределе построить можно (стёртая подпись кнопки), и до глаз
   владельца он ДОЙДЁТ: батарея (`live.cjs`, ждёт слова экрана) гоняется ПОЗАДИ показа. Закрыт предел
   не прибором, а решением владельца о стадии пред-МВП («если тесты будут идти после того как я посмотрю
   глазами, то ок», Cafe13KPG#605); условие его смерти — день запуска в бой. */
const ANCHOR = '[data-go="pass"]';

function notDone(text) { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + text + ' — это НЕ «зелёное»'); process.exit(2); }
function red(lines) { console.log('КРАСНОЕ:\n' + lines.join('\n')); process.exit(1); }

(async () => {
  const t0 = Date.now();
  let src;
  try {
    if (!fs.existsSync(ROOT + '/index.html')) notDone('нет ' + ROOT + '/index.html');
    src = fs.readFileSync(ROOT + '/app.js', 'utf8');
  } catch (e) { notDone('файлы клиента не прочитаны: ' + e.message); }
  let b;
  try { b = await chromium.launch({ args: ['--no-sandbox'] }); }
  catch (e) { notDone('браузер не поднялся: ' + String(e.message).split('\n')[0]); }
  const bad = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
    await ctx.addInitScript(() => { try { localStorage.setItem('cafe13.consent', '0.1'); } catch (e) {} });
    const p = await ctx.newPage();
    const errs = [];
    // ошибка страницы обрывает ожидание СРАЗУ: сломанный клиент — красное за секунды, а не по тайм-ауту
    let failNow; const failed = new Promise(res => { failNow = res; });
    p.on('pageerror', e => { errs.push(e.message); failNow(false); });
    await p.route('https://telegram.org/**', r => r.fulfill({ contentType: 'text/javascript', body: `
      window.Telegram = { WebApp: { platform: 'ios', initData: ${JSON.stringify(INIT)}, initDataUnsafe: { user: { id: 1 } },
        colorScheme: 'light', version: '7.0', isVersionAtLeast: function () { return true; },
        openLink: function () {}, ready: function () {}, expand: function () {}, onEvent: function () {},
        HapticFeedback: { notificationOccurred: function () {}, selectionChanged: function () {} },
        BackButton: { onClick: function () {}, offClick: function () {}, show: function () {}, hide: function () {} },
        MainButton: { setText: function () {}, show: function () {}, hide: function () {}, onClick: function () {}, offClick: function () {} } } };` }));
    await p.route('**/app.js*', r => r.fulfill({ contentType: 'text/javascript', body: src }));
    await p.route('https://api.cafe13.club/**', r => {
      const u = r.request().url();
      const body = /\/me$/.test(u) ? ME : /\/pass$/.test(u) ? { pass_code: 'XIII-0001', level: 'member', lifelong: true, first_name: '[член клуба]' } : [];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await p.goto('file://' + ROOT + '/index.html', { waitUntil: 'load' });
    // главный экран ждём ПО ПРИЗНАКУ, а не паузой: зелёное приходит, как только он нарисован
    // тайм-аут 8 с ведёт в 1 («не нарисован»), а не в 2: «не выполнено» — только не поднятый браузер и нет файлов
    const seen = await Promise.race([failed,
      p.waitForFunction(a => !!document.querySelector('#view ' + a), ANCHOR, { timeout: 8000 }).then(() => true, () => false)]);
    const view = await p.evaluate(() => { const v = document.getElementById('view'); return v ? v.innerHTML.trim() : null; });
    const doors = await p.evaluate(() => document.querySelectorAll('#view [data-go]').length);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabs [data-go]')].map(x => x.getAttribute('data-go')));
    if (view === null) bad.push('на странице нет #view — клиент не собрал экран');
    else if (!view) bad.push('экран пуст — клиент не нарисовал ничего');
    else if (!seen) bad.push('главный экран не нарисован за 8 с: на экране нет входа в пропуск (' + ANCHOR + '), входов всего ' + doors);
    if (seen && tabs.indexOf('home') === -1) bad.push('нет вкладки «Клуб»: ' + JSON.stringify(tabs));
    if (errs.length) bad.push('ошибки страницы: ' + errs.join(' | '));
  } catch (e) {
    bad.push('прогон оборвался: ' + String(e.message).split('\n')[0]);
  } finally { await b.close().catch(() => {}); }
  if (bad.length) red(bad);
  console.log('ДЫМ зелёный: главный экран нарисован за ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
})();
