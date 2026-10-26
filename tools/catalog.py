# -*- coding: utf-8 -*-
"""Собирает каталог экранов из снимков, сделанных tools/shots.cjs.

На входе — manifest.json рядом со снимками, на выходе два файла:
  screens.html — страница каталога (картинки берутся из screens/)
  print.html   — та же опись под печать А4, один экран на страницу

Пересборка:
  docker run --rm -v $PWD:/app:ro -v <каталог снимков>:/work -w /work \
    --entrypoint node agenthost/playwright:1.59.1 /work/shots.cjs
  python3 tools/catalog.py <каталог снимков>
"""
import io, json, os, sys

VERSION = 'v54 · 27.10.2026'
LIVE = 'https://anatoly9837-lab.github.io/cafe13-miniapp/'

GROUPS = {
    'Первый вход': 'То, что человек видит до всего остального — один раз, при первом открытии.',
    'Гость без членства': 'Без членства открыты услуги острова и бар. Клуб закрыт, и это сказано прямо, а не спрятано.',
    'Член клуба': 'Ежедневные экраны: пропуск, афиша, записи, баланс.',
    'Бар · гость заказывает': 'Первое направление клуба. Меню, заказ из приложения, состояние заказа.',
    'Бар · исполнитель': 'Рабочее место на баре: заказы, съёмка напитков, отчёт за день, затраты направления.',
    'Бар · куратор': 'Кабинет куратора: деньги месяца, доля клуба, состояние меню.',
    'Мастер': 'Член клуба, который проводит свои мероприятия и сам назначает их цену.',
    'Бизнес-партнёр': 'Член клуба со своим направлением внутри клуба и его отчётностью.',
    'Касса': 'Работник: сканировать пропуск, внести деньги.',
    'Служебное': 'Экран под солнышком. Кнопка солнышка есть только у god и god_mentor в Telegram; вне Telegram её нет ни у кого. Снимок — тот же экран в демонстрации.',
    'Ночная тема': 'Тему задаёт Telegram, а не приложение. Ночные цвета сняты с вечернего света места.',
}

INTRO = (
    'Полная опись экранов мини-приложения клуба. Каждый снимок сделан с живой страницы '
    'на экране телефона 390 × 844 — это не макет и не рисунок поверх идеи: то же самое '
    'открывается по ссылке ниже.'
)
ABSENT = [
    ('Снимки — демонстрация, а не данные клуба', 'опись снята вне Telegram, где приложение показывает демо с зашитыми числами. Внутри Telegram оно работает на сервере клуба: кабинет, пропуск, меню и заказ бара, очередь на баре. Остальные разделы там честно помечены «ещё не подключено».'),
    ('Фотографий напитков нет', 'на их месте цветные плитки и честная пометка. Картинку из каталога ставить нельзя: гость закажет не то, что увидел.'),
    ('Бар — только со счёта', 'в первой версии на баре платят со счёта в клубе, деньги списываются при заказе; пополняют счёт у хостес. Работнику бара цена не показывается.'),
    ('Имена и суммы — демонстрационные', 'в квадратных скобках то, что подставит сервер; числа дня и месяца сходятся между собой, но взяты для примера.'),
]

CSS = """
:root {
  color-scheme: light;
  --ink:#2B2A28; --paper:#FFFFFF; --surface:#F3F1EB; --line:#E8E5DE;
  --muted:#6B7276; --gold:#AF984D; --gold-ink:#8A7638; --sage:#485143;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --ink:#F5F0E6; --paper:#190F26; --surface:#241634; --line:#3A2650;
    --muted:#B4A6C4; --gold:#E0A040; --gold-ink:#E8B85E; --sage:#7FA08C;
  }
}
* { box-sizing: border-box; }
body {
  margin:0; background:var(--paper); color:var(--ink);
  font-family:Manrope,system-ui,-apple-system,sans-serif; font-size:15px; line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.wrap { max-width:1180px; margin:0 auto; padding:0 20px 80px; }
header { padding:56px 0 34px; border-bottom:1px solid var(--line); margin-bottom:34px; }
.wordmark { font-family:UnifrakturMaguntia,Georgia,serif; font-size:30px; letter-spacing:.5px; }
h1 { font-family:'Zilla Slab',Georgia,serif; font-size:40px; font-weight:600; line-height:1.1; margin:16px 0 0; text-wrap:balance; }
h2 { font-family:'Zilla Slab',Georgia,serif; font-size:25px; font-weight:600; margin:0; }
p { margin:0; color:var(--muted); max-width:62ch; }
.meta { margin-top:12px; font-size:13px; color:var(--muted); font-variant-numeric:tabular-nums; }
.meta a { color:var(--gold-ink); }
.lead { margin-top:18px; font-size:16px; }
.absent { margin-top:26px; display:grid; gap:1px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.absent div { background:var(--paper); padding:12px 15px; font-size:13px; }
.absent b { color:var(--ink); }
.absent span { color:var(--muted); }
nav { display:flex; flex-wrap:wrap; gap:8px; margin-top:26px; }
nav a {
  font-size:12px; font-weight:600; letter-spacing:.3px; text-decoration:none;
  color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:6px 12px;
}
nav a:hover { color:var(--ink); border-color:var(--ink); }
section { margin-bottom:52px; scroll-margin-top:20px; }
.head { display:flex; flex-direction:column; gap:7px; margin-bottom:20px; }
.count { font-size:11px; letter-spacing:.7px; text-transform:uppercase; color:var(--gold-ink); font-weight:700; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(216px,1fr)); gap:26px; }
figure { margin:0; display:flex; flex-direction:column; gap:11px; }
.shot {
  border:1px solid var(--line); border-radius:20px; overflow:hidden;
  background:var(--surface); box-shadow:0 2px 14px rgba(0,0,0,.07);
}
.shot img { display:block; width:100%; height:auto; }
figcaption { font-size:13px; color:var(--muted); }
figcaption b { display:block; color:var(--ink); font-size:13px; font-weight:700; margin-bottom:3px; }
figcaption b span { color:var(--gold-ink); font-variant-numeric:tabular-nums; }
footer { border-top:1px solid var(--line); padding-top:22px; font-size:13px; color:var(--muted); }
footer code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; color:var(--ink); }
"""

PRINT_CSS = """
@page { size: A4; margin: 14mm; }
* { box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
body { margin:0; background:#FFFFFF; color:#2B2A28; font-family:Manrope,system-ui,sans-serif; font-size:11pt; line-height:1.5; }
.page { page-break-after:always; break-after:page; min-height:265mm; display:flex; flex-direction:column; }
.page:last-child { page-break-after:auto; break-after:auto; }
.cover { justify-content:center; }
.cover .wordmark { font-family:UnifrakturMaguntia,Georgia,serif; font-size:34pt; }
.cover h1 { font-family:'Zilla Slab',Georgia,serif; font-size:30pt; font-weight:600; line-height:1.08; margin:10mm 0 4mm; }
.cover p { color:#6B7276; max-width:150mm; margin:0 0 4mm; }
.cover .meta { font-size:10pt; color:#6B7276; margin-top:6mm; }
.cover .absent { margin-top:10mm; border:1px solid #E8E5DE; border-radius:3mm; overflow:hidden; }
.cover .absent div { padding:3mm 4mm; font-size:9.5pt; border-top:1px solid #E8E5DE; }
.cover .absent div:first-child { border-top:none; }
.cover .absent b { color:#2B2A28; }
.cover .absent span { color:#6B7276; }
.cover .toc { margin-top:9mm; font-size:10pt; color:#6B7276; columns:2; }
.cover .toc div { break-inside:avoid; padding:1mm 0; }
.screen { flex-direction:row; gap:10mm; align-items:flex-start; }
.screen .img { flex:0 0 96mm; border:0.4mm solid #E8E5DE; border-radius:5mm; overflow:hidden; background:#F3F1EB; }
.screen .img img { display:block; width:100%; height:auto; }
.screen .text { flex:1 1 auto; padding-top:2mm; }
.screen .eyebrow { font-size:8.5pt; letter-spacing:.6pt; text-transform:uppercase; color:#8A7638; font-weight:700; }
.screen h2 { font-family:'Zilla Slab',Georgia,serif; font-size:18pt; font-weight:600; margin:2mm 0 3mm; line-height:1.15; }
.screen p { color:#6B7276; margin:0 0 3mm; }
.screen .id { font-family:ui-monospace,Menlo,monospace; font-size:8.5pt; color:#9AA0A3; }
.screen .group { margin-top:4mm; font-size:9.5pt; color:#6B7276; border-top:1px solid #E8E5DE; padding-top:3mm; }
"""

HEAD = ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>%s</title>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        'family=Zilla+Slab:wght@500;600;700&family=Manrope:wght@400;500;600;700&'
        'family=UnifrakturMaguntia&display=swap">'
        '<style>%s</style></head><body>')


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def ordered_groups(items):
    out = []
    for it in items:
        if it['group'] not in out:
            out.append(it['group'])
    return out


def web(items, prefix):
    gs = ordered_groups(items)
    o = [HEAD % ('Экраны Café XIII', CSS)]
    o.append('<div class="wrap"><header>')
    o.append('<div class="wordmark">Caf&eacute; XIII</div>')
    o.append('<h1>Экраны мини-приложения</h1>')
    o.append('<div class="meta">%s &middot; %d %s &middot; снято с живой страницы, 390&nbsp;&times;&nbsp;844 &middot; '
             '<a href="%s">открыть приложение</a></div>' % (VERSION, len(items), plural(len(items)), LIVE))
    o.append('<p class="lead">%s</p>' % esc(INTRO))
    o.append('<div class="absent">')
    for b, t in ABSENT:
        o.append('<div><b>%s</b> <span>&mdash; %s</span></div>' % (esc(b), esc(t)))
    o.append('</div><nav>')
    for g in gs:
        o.append('<a href="#g%d">%s</a>' % (gs.index(g), esc(g)))
    o.append('</nav></header>')

    n = 0
    for g in gs:
        mine = [i for i in items if i['group'] == g]
        o.append('<section id="g%d"><div class="head">' % gs.index(g))
        o.append('<span class="count">%d %s</span>' % (len(mine), plural(len(mine))))
        o.append('<h2>%s</h2>' % esc(g))
        o.append('<p>%s</p></div><div class="grid">' % esc(GROUPS.get(g, '')))
        for it in mine:
            n += 1
            o.append('<figure><div class="shot"><img loading="lazy" src="%s%s" alt="%s" width="780" height="1688"></div>'
                     % (prefix, it['file'], esc(it['caption'][:80])))
            o.append('<figcaption><b><span>%02d</span> &nbsp;%s</b>%s</figcaption></figure>'
                     % (n, esc(it['screen']), esc(it['caption'])))
        o.append('</div></section>')

    o.append('<footer>Снимки пересобираются командой <code>tools/shots.cjs</code> '
             '(она же проверяет поведение: заказ, принятие заказа, запись затраты), '
             'страница — <code>tools/catalog.py</code>. '
             'Опись обновляется вместе с приложением: версия вверху должна совпадать '
             'с версией в демо-режиме приложения.</footer></div></body></html>')
    return '\n'.join(o)


def plural(n):
    a, b = n % 10, n % 100
    return 'экран' if a == 1 and b != 11 else ('экрана' if 2 <= a <= 4 and not 10 < b < 21 else 'экранов')


def printable(items, prefix):
    gs = ordered_groups(items)
    o = [HEAD % ('Экраны Café XIII', PRINT_CSS)]
    o.append('<div class="page cover"><div class="wordmark">Caf&eacute; XIII</div>')
    o.append('<h1>Экраны мини-приложения</h1>')
    o.append('<p>%s</p>' % esc(INTRO))
    o.append('<div class="meta">%s &middot; %d %s &middot; 390 &times; 844 &middot; %s</div>'
             % (VERSION, len(items), plural(len(items)), LIVE))
    o.append('<div class="absent">')
    for b, t in ABSENT:
        o.append('<div><b>%s</b> <span>&mdash; %s</span></div>' % (esc(b), esc(t)))
    o.append('</div><div class="toc">')
    for g in gs:
        o.append('<div>%s &mdash; %d</div>' % (esc(g), len([i for i in items if i['group'] == g])))
    o.append('</div></div>')

    n = 0
    for it in items:
        n += 1
        o.append('<div class="page screen">')
        o.append('<div class="img"><img src="%s%s" alt=""></div>' % (prefix, it['file']))
        o.append('<div class="text"><div class="eyebrow">%02d &middot; %s</div>' % (n, esc(it['group'])))
        o.append('<h2>%s</h2><p>%s</p>' % (esc(title_of(it)), esc(it['caption'])))
        o.append('<div class="id">экран %s</div>' % esc(it['screen']))
        o.append('<div class="group">%s</div></div></div>' % esc(GROUPS.get(it['group'], '')))
    o.append('</body></html>')
    return '\n'.join(o)


TITLES = {
    'consent': 'Согласие на данные', 'consentFull': 'Согласие · полный текст',
    'guest': 'Услуги и бар', 'home': 'Клуб', 'pass': 'Пропуск', 'membership': 'Членство',
    'events': 'Афиша', 'event': 'Мероприятие', 'bookings': 'Мои записи',
    'bar': 'Меню бара', 'drink': 'Напиток', 'barCart': 'Заказ', 'barOrder': 'Состояние заказа',
    'barQueue': 'Заказы на баре', 'barShot': 'Съёмка напитков', 'barDay': 'Отчёт за день',
    'barExpense': 'Затраты направления', 'curator': 'Кабинет куратора',
    'organizer': 'Мои мероприятия', 'eventNew': 'Новое мероприятие', 'eventManage': 'Управление мероприятием',
    'partner': 'Моё направление', 'serviceNew': 'Новая услуга', 'staff': 'Касса', 'demo': 'Демо-режим',
}


def title_of(it):
    return TITLES.get(it['screen'], it['screen'])


if __name__ == '__main__':
    d = sys.argv[1] if len(sys.argv) > 1 else '.'
    items = json.load(io.open(os.path.join(d, 'manifest.json'), encoding='utf-8'))
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    io.open(os.path.join(repo, 'screens.html'), 'w', encoding='utf-8').write(web(items, 'screens/'))
    io.open(os.path.join(d, 'print.html'), 'w', encoding='utf-8').write(printable(items, ''))
    print('screens.html: %d экранов' % len(items))
    print('print.html:   %s/print.html' % d)
