const { chromium } = require('playwright');
const fs = require('fs');

/* Признак экрана берётся из СОДЕРЖИМОГО #view, а не из шапки: шапка у разных
   экранов показывает одну и ту же марку, и такой контроль их не различал бы.
   Сравнение по textContent, а не innerText: .label набран uppercase через CSS,
   и innerText вернул бы его заглавными. */
const SHOTS = [
  ['01-consent',     'consent',  null,    0,    'Клуб запомнит вас',            'Первый вход', 'Согласие на данные. Первый экран до всего остального: без вкладок и «назад», уйти можно только решением.'],
  ['02-consent-full','consentFull',null,  0,    'Как клуб хранит данные',       'Первый вход', 'Полный текст согласия разделами. Черновик — перед открытием для людей со стороны его смотрит тайский юрист.'],
  ['03-guest',       'guest',    null,    0,    'Клуб закрыт для гостей',       'Гость без членства', 'Услуги и бар видны всем, клуб — нет. Бар стоит первой строкой: это первое направление клуба.'],
  ['04-home',        'home',     null,    0,    'Баланс',                       'Член клуба', 'Главный экран: уровень, срок, баланс, ближайшая запись.'],
  ['05-pass',        'pass',     null,    0,    'Код постоянный',               'Член клуба', 'Пропуск. Работает без интернета, сеть нужна тому, кто сканирует.'],
  ['06-membership',  'membership',null,   0,    'Вход в пространство без оплаты', 'Член клуба', 'Уровни членства и что каждый даёт. Без сумм: цены называет владелец.'],
  ['07-events',      'events',   null,    0,    'Звуковая практика',            'Член клуба', 'Афиша по дням.'],
  ['08-event',       'event',    'sound', 0,    'Звуковая практика',            'Член клуба', 'Мероприятие: цена, места, съёмка, запись.'],
  ['09-bookings',    'bookings', null,    0,    'Предстоящие',                  'Член клуба', 'Свои записи — предстоящие и прошедшие.'],

  ['10-bar',         'bar',      null,    0,    'Бар Café XIII',                'Бар · гость заказывает', 'Раздел «Бар» в услугах. Открыт или закрыт — видно сразу, заказ закрытому бару не уйдёт.'],
  ['11-bar-menu',    'bar',      null,    700,  'Авторские',                    'Бар · гость заказывает', 'Меню группами. Позиции без фотографии честно помечены: картинок из каталогов не будет.'],
  ['12-drink',       'drink',    'flat',  0,    'Флэт-уайт',                    'Бар · гость заказывает', 'Карточка напитка — место, куда попадает фотография после съёмки.'],
  ['13-bar-cart',    'barCart',  null,    0,    'Куда подать',                  'Бар · гость заказывает', 'Заказ: состав, куда подать, итог и «Купить». Оплата только со счёта в клубе — наличные бар не принимает; отказ сервера показывается его словами над кнопкой, корзина остаётся.'],
  ['14-bar-order',   'barOrder', null,    0,    'Бар принял',                   'Бар · гость заказывает', 'Состояние заказа. Те же пять шагов видит бар — расхождения быть не может.'],

  ['15-bar-queue',   'barQueue', null,    0,    'Смена открыта',                'Бар · исполнитель', 'Заказы на баре: новый → принят → готов → выдан. Уведомление о новом заказе приходит в чат бара.'],
  ['16-bar-shot',    'barShot',  null,    0,    'Как напиток попадает в меню',  'Бар · исполнитель', 'Визуализатор: снимок с бара уходит ИИ-команде, та собирает карточку меню, куратор утверждает.'],
  ['17-bar-shot-how','barShot',  null,    620,  'Ждут фотографии',              'Бар · исполнитель', 'Правила съёмки и список позиций без фотографии.'],
  ['18-bar-day',     'barDay',   null,    0,    'Что заказывали',               'Бар · исполнитель', 'Отчёт за день: выручка наличными и со счетов, чеки, средний чек.'],
  ['19-bar-day-end', 'barDay',   null,    900,  'Наличных в кассе бара',        'Бар · исполнитель', 'Расход дня и сверка наличных. Закрытая смена не правится.'],
  ['20-bar-expense', 'barExpense',null,   0,    'Внести затрату',               'Бар · исполнитель', 'Учёт затрат направления: что, сколько, категория, чем платили, фото чека.'],

  ['21-curator',     'curator',  null,    0,    'Первое направление клуба',     'Бар · куратор', 'Кабинет куратора: месяц, чистая прибыль, доля клуба — и сколько вышло бы по второму способу, 13 % с вала.'],
  ['22-curator-days','curator',  null,    820,  'Меню и фотографии',            'Бар · куратор', 'Выручка по дням и состояние меню: сколько позиций без фотографии.'],

  ['23-organizer',   'organizer',null,    0,    'Создать мероприятие',          'Мастер', 'Свои мероприятия и наполненность.'],
  ['24-event-new',   'eventNew', null,    0,    'Участие',                      'Мастер', 'Создание мероприятия.'],
  ['25-event-manage','eventManage','sound',0,   'Кто идёт',                     'Мастер', 'Управление своим мероприятием и список записавшихся.'],

  ['26-partner',     'partner',  null,    0,    'Отчётность направления',       'Бизнес-партнёр', 'Своё направление и его отчётность.'],
  ['27-service-new', 'serviceNew',null,   0,    'Появится в разделе',           'Бизнес-партнёр', 'Новая услуга — на проверку директору.'],

  ['28-staff',       'staff',    null,    0,    'Сканировать пропуск',          'Касса', 'Касса: сканировать пропуск, принять деньги.'],
  ['29-demo',        'demo',     null,    0,    'Это демонстрация', 'Служебное', 'Демо-режим: переключение роли и версия приложения.']
];
const ROLE = { guest: 'guest', staff: 'staff', barQueue: 'bar', barShot: 'bar', barDay: 'bar',
               barExpense: 'bar', curator: 'curator', organizer: 'organizer', eventNew: 'organizer',
               eventManage: 'organizer', partner: 'partner', serviceNew: 'partner' };
const DARK = [['30-home-dark', 'home', 'Баланс', 'Ночная тема', 'Главный экран ночью. Тему даёт Telegram, не приложение.'],
              ['31-bar-dark', 'bar', 'Бар Café XIII', 'Ночная тема', 'Меню бара ночью — вечерние цвета места.'],
              ['32-bar-queue-dark', 'barQueue', 'Смена открыта', 'Ночная тема', 'Заказы на баре ночью: новый заказ выделен рамкой и золотой полосой.']];

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [], bad = [], manifest = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));

  const text = () => p.evaluate(() => document.getElementById('view').textContent);
  const shot = async (n) => { await p.waitForTimeout(260); await p.screenshot({ path: `/work/${n}.png` }); };

  await p.goto('file:///app/index.html', { waitUntil: 'networkidle' });
  console.log('control: clientWidth =', await p.evaluate(() => document.documentElement.clientWidth), '(ждём 390)');

  // ── функциональные проверки до съёмки: разметка без действий ничего не значит
  await p.evaluate(() => { giveConsent(); DATA.role = 'member'; go('bar'); });
  await p.click('text=В заказ');
  const n1 = await p.evaluate(() => cartCount());
  if (n1 !== 1) bad.push('клик «В заказ» не положил позицию в заказ: cartCount = ' + n1);
  await p.evaluate(() => go('barCart'));
  // на экране корзины, а не после отправки: там выбора оплаты нет в любом случае
  if ((await text()).indexOf('Куда подать') === -1) bad.push('проверка оплаты смотрит не на корзину');
  if (await p.evaluate(() => !!document.querySelector('[data-pay]'))) bad.push('в заказе есть выбор оплаты — на баре платят только со счёта');
  await p.click('text=к столу');
  await p.click('[data-action="send-order"]');
  const sent = await p.evaluate(() => DATA.bar.mine && DATA.bar.mine.id + '|' + DATA.bar.mine.where + '|' + DATA.bar.mine.pay + '|' + DATA.bar.mine.state);
  if (sent !== 'A-17|к столу|со счёта|new') bad.push('заказ ушёл не тем, чем выбрали: ' + sent);
  if (await p.evaluate(() => cartCount()) !== 0) bad.push('после отправки заказ не опустел');
  // решения владельца: у бара цены нет, на баре платят только со счёта
  await p.evaluate(() => { DATA.role = 'bar'; go('barQueue'); });
  if ((await text()).indexOf('฿') !== -1) bad.push('в очереди бара видна цена: работнику её не показываем');
  // бар принимает: состояние должно смениться у ОБОИХ
  await p.evaluate(() => { DATA.role = 'bar'; go('barQueue'); });
  await p.click('text=Принять');
  const st = await p.evaluate(() => DATA.bar.orders[0].state + '|' + DATA.bar.mine.state);
  if (st !== 'making|making') bad.push('«Принять» не сменило состояние заказа у гостя и бара: ' + st);
  // отрицательный контроль: признак одного экрана не должен находиться на другом
  await p.evaluate(() => go('barExpense'));
  if ((await text()).indexOf('Что заказывали') !== -1) bad.push('признак отчёта найден на экране затрат — признаки не различают экраны');
  await p.evaluate(() => go('barDay'));
  if ((await text()).indexOf('Что заказывали') === -1) bad.push('признак отчёта НЕ найден на самом отчёте');
  // затрата
  await p.evaluate(() => go('barExpense'));
  await p.fill('#e-what', 'Пробная затрата');
  await p.fill('#e-sum', '55');
  await p.click('text=ремонт');
  await p.click('text=Записать затрату');
  const ex = await p.evaluate(() => DATA.bar.expenses[0].what + '|' + DATA.bar.expenses[0].sum + '|' + DATA.bar.expenses[0].cat);
  if (ex !== 'Пробная затрата|55|ремонт') bad.push('затрата записалась не тем, что ввели: ' + ex);
  console.log(bad.length ? 'ПОВЕДЕНИЕ — ОТКАЗЫ:\n  ' + bad.join('\n  ') : '✓ поведение: заказ, принятие, затрата — все проверки прошли');

  // ── съёмка: страница перезагружается, чтобы данные были исходными
  await p.goto('file:///app/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => { giveConsent(); });
  for (const [name, screen, prm, scroll, marker, group, caption] of SHOTS) {
    const role = ROLE[screen] || 'member';
    await p.evaluate(([r, s, q]) => { DATA.role = r; dropConsent(); if (s !== 'consent' && s !== 'consentFull') giveConsent(); go(s, q); }, [role, screen, prm]);
    if (screen === 'barOrder') await p.evaluate(() => { DATA.bar.mine = DATA.bar.orders[1]; go('barOrder'); });
    // корзина пуста после перезагрузки — экран заказа без позиций показал бы не то
    if (screen === 'barCart') await p.evaluate(() => { CART = { flat: 2, puer: 1 }; go('barCart'); });
    if (screen === 'drink' || screen === 'bar') await p.evaluate(() => { CART = {}; render(); });
    if (scroll) await p.evaluate((y) => window.scrollTo(0, y), scroll);
    const t = await text();
    if (t.indexOf(marker) === -1) bad.push(name + ': признака «' + marker + '» на экране нет (взято: ' + t.slice(0, 60).replace(/\s+/g, ' ') + '…)');
    await shot(name);
    manifest.push({ file: name + '.png', group, caption, screen });
  }
  for (const [name, screen, marker, group, caption] of DARK) {
    await p.evaluate((s) => { DATA.role = s === 'barQueue' ? 'bar' : 'member'; giveConsent(); go(s); document.documentElement.setAttribute('data-theme', 'dark'); }, screen);
    const t = await text();
    if (t.indexOf(marker) === -1) bad.push(name + ': признака «' + marker + '» нет');
    await shot(name);
    manifest.push({ file: name + '.png', group, caption, screen });
  }
  fs.writeFileSync('/work/manifest.json', JSON.stringify(manifest, null, 1));

  console.log(errs.length ? 'ОШИБКИ КОНСОЛИ:\n  ' + errs.join('\n  ') : '✓ ошибок консоли нет');
  console.log(bad.length ? '\nОТКАЗЫ (' + bad.length + '):\n  ' + bad.join('\n  ') : '\n✓ все ' + manifest.length + ' снимков прошли проверку признака');
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
