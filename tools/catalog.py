# -*- coding: utf-8 -*-
"""Собирает страницу «Экраны» из снимков, стадий и видимости (Cafe13KPG#407).

На входе три файла рядом со снимками:
  manifest.json  — снимки, сделанные tools/shots.cjs;
  СТАДИИ.tsv     — стадия каждого экрана, ОДИН источник правды
                   (словарь стадий — Cafe13KPG `_docs/screen-path.md`);
  vidimost.json  — вкладки и права шести живых людей клуба,
                   снятые самим клиентом (tools/vidimost.cjs).

На выходе два файла:
  screens.html — страница (картинки берутся из screens/)
  print.html   — та же опись под печать А4, один экран на страницу

Страница показывает ТРИ вещи, а не одну: снимок, стадию (рамкой) и видимость.
Экран без снимка не прячется, а печатается строкой: стадия и видимость у него
есть, а снимка нет — и сказано, почему.

⚠ Видимость — ВЫВОД ПО КОДУ клиента, а не наблюдение под человеком: ни под
одним из шести экран не открывали. Это сказано и в самой странице.

Пересборка:
  docker run --rm -e LANG=ru_RU.UTF-8 -e LC_ALL=ru_RU.UTF-8 -v $PWD:/app:ro -v <каталог снимков>:/work -w /work \
    --entrypoint node agenthost/playwright:1.59.1 /work/shots.cjs
  python3 tools/catalog.py <каталог снимков>
"""
import hashlib, io, json, os, re, sys

VERSION = 'v77 · 28.10.2026'
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
    'Клуб · ответственность': 'Кто за что отвечает в клубе: выдать и снять роль.',
    'Нарисовано, кода ещё нет': 'Кадры базы экранов есть, кода нет. Стадия 1 по пути экрана: сначала рисуем, потом разрабатываем.',
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
# ── стадия экрана ────────────────────────────────────────────────────────
# Словарь и правило — Cafe13KPG `_docs/screen-path.md` (решение владельца
# 27.10.2026). Цвет рамки берётся ОТСЮДА и только отсюда: руками он разъехался
# бы с кодом молча. Пятая стадия, «анонсирован», рамкой не отличается от
# «рабочий»: человеку она говорит то же самое, разница — в письме людям.
СТАДИИ_ЦВЕТ = {
    'нарисован':   ('#9AA0A3', 'нарисован — кадр есть, кода нет'),
    'не готов':    ('#8E3324', 'не готов — код есть, человеку не показывается'),
    'в тесте':     ('#AF984D', 'в тесте — показывается, идёт проверка'),
    'рабочий':     ('#485143', 'рабочий — тест принят владельцем'),
    'анонсирован': ('#485143', 'анонсирован — людям сказано'),
    'служебный':   ('#9AA0A3', 'служебный — стадии не имеет'),
    '?':           ('#9AA0A3', 'стадия не поставлена'),
}

# ── чем управляется видимость экрана ─────────────────────────────────────
# Слева — экран, справа — чем человек до него доходит.
#
# ⚠ ВИДИМОСТЬ — ЭТО ПУТЬ, А НЕ ПРАВО. Право без входа никуда не ведёт, и сам
# вход числом в прозе не записывается: он рисуется условно и переезжает чужим
# мерджем. 27.10.2026 это и случилось — miniapp#90 поставил вход «Карточки
# меню» вторым, на «Заказы», и прежнее здешнее условие «право mayCards И
# вкладка „Клуб“» стало бы говорить о работнике бара ложное «не видит»
# (поправка arhitector-47). Поэтому вход берёт ОБХОД: tools/vidimost.cjs
# ходит по отрисованным `data-go` от вкладок человека, пока находятся новые
# экраны, и пишет, С КАКОГО экрана дверь.
#
# Слова условия:
#   `дверь`    — путь нашёл обход; имена и сам вход берутся у него;
#   `за:X`     — экран лежит за экраном X, но ПОСЛЕДНИЙ шаг обход не
#                подтвердил: вход рисуется строкой данных сервера или туда
#                уходит сам код. «Никто» у такого экрана значило бы «нечем
#                измерить», поэтому имена считаются по достижимости X, а
#                неподтверждённость печатается словами;
#   `право:X`  — право, которое считает сам клиент (vidimost.cjs зовёт X());
#   `все`      — виден всем; `никто` — кода нет в реестре WIRED, в живом
#                приложении экран не показывается вовсе;
#   текст в кавычках — правило, которое прибором не считается вообще.
# Список — это И: держатся все части.
УСЛОВИЕ = {
    'consent': 'все', 'consentFull': 'все',
    'loading': 'все', 'noSign': 'все', 'noAccess': 'все', 'apiDown': 'все',

    # выведено обходом: вкладка человека или дверь на отрисованном экране
    'home': 'дверь', 'pass': 'дверь', 'guest': 'дверь', 'bar': 'дверь',
    'bookings': 'дверь', 'barQueue': 'дверь', 'staff': 'дверь',
    'tillDay': 'дверь', 'barCards': 'дверь', 'barMoney': 'дверь',
    'events': 'дверь', 'eventNew': 'дверь', 'organizer': 'дверь',
    'partner': 'дверь',
    # вкладка «Управление» (E46, Cafe13KPG#413) и её два входа — обход их видит: вкладка от
    # права mayPeople, входы — кнопками на отрисованном экране вкладки
    'manage': 'дверь', 'joinQueue': 'дверь', 'people': 'дверь',

    # за экраном, но последний шаг — не кнопка на пустом стенде
    'drink': 'за:bar', 'barCart': 'за:bar', 'barOrder': 'за:barCart',
    'event': 'за:events',
    'barCard': ['право:mayCards', 'за:barCards'],
    'topup': ['право:canTopup', 'за:home'],
    'barDay': ['право:mayBook', 'за:barQueue'],
    'tillPerson': 'за:staff', 'tillMembership': 'за:tillPerson',
    'tillTopup': 'за:tillPerson',

    'barRecipe': '"админ, а бар и куратор — на своём направлении (mayRecipe; '
                 'направление приходит с сервера, прибором здесь не считается)"',
    'demo': '"кнопка солнышка — только у god и god_mentor и только в Telegram"',

    # ⚠ Экран подстановки (Cafe13KPG#405). Его показывает САМ клиент вместо
    #    любого невключённого экрана: `SCREENS[LIVE && !WIRED[current] ? 'soon'
    #    : current]`. В реестре его нет и быть не должно, обходом он не
    #    находится (дверей на него не рисует никто) — и «никто» было бы здесь
    #    ложью: его видит всякий, кто нажал вход на невключённый раздел.
    #    Замер 28.10.2026 (остров), `двери_на_невключённые()`: из девяти
    #    невключённых экранов вход ОТКРЫТ у пяти (membership, serviceNew,
    #    barShot, eventManage, partner), закрыт реестром у memberRequests,
    #    и нет вовсе у barExpense и curator. Числа держит генератор, не проза.
    'soon': '"показывается вместо любого невключённого экрана; сами входы '
            'считает генератор и печатает их у каждого такого экрана строкой '
            '«состояние» — числа в этой прозе нет нарочно, оно стареет"',

    # заявки на членство (Cafe13KPG#415): код есть, в WIRED не включён до выкладки api#74
    'memberRequests': 'никто',
    'membership': 'никто', 'eventManage': 'никто', 'serviceNew': 'никто',
    'barShot': 'никто', 'barExpense': 'никто', 'curator': 'никто',
    'занятость суток': 'никто', 'архив мероприятий': 'никто',
    'касса · оплата записи': 'никто',
}

# Почему последний шаг обход не подтвердил — по экрану. Без этой строки
# «за экраном X» читалось бы как «обход сказал: пути нет».
ПОЧЕМУ_НЕ_ПОДТВЕРЖДЁН = {
    'drink': 'в карточку ведёт строка меню, а меню без сервера пусто',
    'barCart': 'кнопка «Оформить» появляется, когда в заказе что-то есть',
    'barOrder': 'открывается ответом сервера на оформленный заказ',
    'event': 'в мероприятие ведёт строка афиши',
    'barCard': 'в карточку ведёт строка списка карточек, а список приходит с сервера',
    'topup': 'вход — кнопка «Внести себе на счёт» на экране «Клуб»',
    'barDay': 'вход — на экране заказов при открытой смене',
    'tillPerson': 'кнопки нет вовсе: туда уходит сам код, ответом на скан пропуска',
    'tillMembership': 'из карточки человека, строкой «что продать»',
    'tillTopup': 'из карточки человека, строкой «что продать»',
}

# Группа страницы для экранов, которых нет в описи снимков.
ГРУППА_БЕЗ_СНИМКА = {
    'topup': 'Член клуба',
    'manage': 'Клуб · ответственность',
    'joinQueue': 'Клуб · ответственность',
    'memberRequests': 'Клуб · ответственность',
    'loading': 'Служебное', 'noSign': 'Служебное', 'noAccess': 'Служебное', 'apiDown': 'Служебное',
    'занятость суток': 'Нарисовано, кода ещё нет',
    'архив мероприятий': 'Нарисовано, кода ещё нет',
    'касса · оплата записи': 'Нарисовано, кода ещё нет',
}

ПОДПИСЬ_БЕЗ_СНИМКА = {
    'topup': 'Пополнение своего счёта: сумма, чем платили. Деньги принимает кассир.',
    'manage': 'Вкладка главы клуба: два входа — «Заявки на доступ» и «Члены клуба». Снимка нет: вкладка стоит под правом главы клуба, а снимок делается вне Telegram.',
    'joinQueue': 'Заявки на доступ: просьбы людей, которых в приложении ещё нет, с чеком; согласие или отказ. Снимка нет: экран стоит под правом главы клуба, а снимок делается вне Telegram.',
    'memberRequests': 'Заявки на членство: кто подал, какой вид выбрал, решение. Снимка нет: вход закрыт реестром, и в демонстрации кнопки на него тоже нет.',
    'loading': 'Пока идёт первый ответ сервера.',
    'noSign': 'Подпись Telegram не дошла — войти нечем.',
    'noAccess': 'Человека нет в списке клуба: просьба о вступлении с чеком (кадры E44*).',
    'apiDown': 'Сервер клуба не отвечает.',
    'занятость суток': 'Занятость места по суткам: накладки, скрытые события, переход через полночь.',
    'архив мероприятий': 'Архив прошедших мероприятий — у работника клуба и у организатора.',
    'касса · оплата записи': 'Оплата записи на мероприятие через кассу: что оплачиваем, взнос, отказы.',
}

ПРЕДЕЛ_ВИДИМОСТИ = (
    'Стадия каждого экрана — рамкой, и берётся она из одного файла (СТАДИИ.tsv), '
    'а не ставится руками. «Видят» — это ВЫВОД ПО КОДУ приложения: от вкладок '
    'человека прибор идёт по входам на отрисованных экранах, пока находятся новые. '
    'Право без входа видимостью не считается. Где вход рисуется строкой данных '
    'сервера или туда уходит сам код, это сказано словами: «никто» у такого экрана '
    'значило бы не «пути нет», а «нечем измерить». Под каждым человеком экран '
    'никто не открывал, наблюдение — отдельный шаг. Состав ролей и членств взят '
    'из тестовой базы (замер devops5, 27.10.2026, только чтение), а в бою он другой: '
    'у владельца там бессрочное членство, и вкладка «Клуб» у него есть. '
    'Строка «состояние» у невключённого экрана отвечает на вопрос телефоном: '
    'вход в приложении открыт (человек дойдёт и увидит «Раздел ещё не подключён»), '
    'закрыт самим реестром (включится вместе с экраном) или его нет вовсе. '
    'Считается она по `app.js` ЭТОЙ редакции — по тому же файлу, с которого '
    'снята видимость, а не по выложенному: их сверяет отдельный прибор '
    '(tools/check-stages.py).'
)

ПОЧЕМУ_НЕТ_СНИМКА = ('снимок делается вне Telegram, где прав нет ни у кого: '
                     'экран живёт только при сервере клуба')
ПОЧЕМУ_НЕТ_СНИМКА_КОД = 'кода ещё нет — есть только кадры базы экранов'


def стадии(каталог):
    """Строки СТАДИИ.tsv: экран → (кадр, стадия, карточка, дата).

    Страница без стадий не собирается: стадия — не украшение, а то, ради чего
    страницу и читают. Отсутствие файла — «НЕ ВЫПОЛНЕНО», а не «стадий нет»."""
    путь = os.path.join(каталог, 'СТАДИИ.tsv')
    if not os.path.isfile(путь):
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: нет файла стадий %s — '
                 'страница без стадий не собирается' % путь)
    из = {}
    for н, строка in enumerate(io.open(путь, encoding='utf-8').read().splitlines(), 1):
        if not строка.strip() or строка.lstrip().startswith('#'):
            continue
        поля = [п.strip() for п in строка.split('\t')]
        if len(поля) != 5:
            sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: %s:%d: полей %d, а должно быть 5'
                     % (путь, н, len(поля)))
        из[поля[0]] = tuple(поля[1:])
    if not из:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: %s: ни одной строки стадии' % путь)
    нет_условия = [э for э in из if э not in УСЛОВИЕ]
    if нет_условия:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: у экранов нет условия видимости в '
                 'tools/catalog.py (УСЛОВИЕ): %s — страница соврала бы молча, '
                 'показав их всем' % ', '.join(sorted(нет_условия)))
    чужая_стадия = sorted({с[1] for с in из.values()} - set(СТАДИИ_ЦВЕТ))
    if чужая_стадия:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: в %s стадии вне словаря: %s'
                 % (путь, ', '.join(чужая_стадия)))
    return из


def свежесть(каталог, вид):
    """Файл видимости снят С ЭТОГО клиента или с другого — падающая проверка.

    ⚠ Без неё опись устаревает МОЛЧА: правят `tabList()` или вход в app.js,
    прибор не перегоняют, и страница печатает прежнее «видят», оставаясь
    зелёной. Возврат arhitector-47 27.10.2026; он же назвал признак — sha256
    того app.js, с которого снимал обход. Отсутствие хеша — «не выполнено»,
    а не «сошлось»: старый файл видимости неотличим от свежего."""
    if вид is None:
        return
    было = вид.get('клиент_sha256')
    путь = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app.js')
    if not os.path.isfile(путь):
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: нет %s — сверить видимость с клиентом нечем' % путь)
    стало = hashlib.sha256(io.open(путь, 'rb').read()).hexdigest()
    if not было:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: в %s/vidimost.json нет поля «клиент_sha256» — '
                 'файл снят прибором прежней редакции, и свежесть его проверить нечем. '
                 'Перегнать tools/vidimost.cjs' % каталог)
    if было != стало:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: видимость снята с ДРУГОГО клиента '
                 '(в файле %s…, рядом лежит %s…) — страница напечатала бы прежнее '
                 '«видят» о новом клиенте. Перегнать tools/vidimost.cjs'
                 % (было[:12], стало[:12]))


def двери_на_невключённые():
    """Для экрана ВНЕ реестра: есть ли в клиенте вход, не закрытый самим реестром.

    Это ответ на вопрос владельца «тут есть эти новые экраны?» в той форме,
    в какой он его задаёт телефоном: кнопка в приложении либо есть, либо нет.
    Если есть и не закрыта `WIRED.<имя>` — человек по ней дойдёт и увидит
    экран подстановки «Раздел ещё не подключён», а не раздел.

    Возвращает (реестр, двери): множество включённых и {экран: число входов}.

    ⚠ Признак по ФОРМЕ записи (`data-go="имя"`, `go('имя'`), и у него свой
    контроль: заведомо живой экран обязан иметь вход, иначе разбор не тот.
    Предел назван и ИЗМЕРЕН: вход, собранный из переменной, признаком не
    находится вовсе — у `home` литерального входа ноль, в клиент он попадает
    через `go(homeOf())` (замер 28.10.2026, остров). Поэтому число входов
    печатается как «не меньше», а не как «ровно», и контроль спрашивает не
    один экран, а то, что признак вообще различает входы."""
    путь = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app.js')
    исходник = io.open(путь, encoding='utf-8').read()
    тело = re.search(r'var WIRED = \{(.*?)\};', исходник, re.S)
    if not тело:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: в app.js нет объявления `var WIRED = {…}` — '
                 'реестр не разобран, это НЕ «все экраны включены»')
    реестр = {и for и, _ in re.findall(r'(\w+) *: *([^,}\s]+)', тело.group(1))}
    функции = set(re.findall(r'\n  (\w+): function', исходник))
    if len(реестр) < 10 or 'home' not in реестр or len(функции) < 20:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: реестр разобран на %d имён, экранов %d — '
                 'признак не тот, числам верить нельзя' % (len(реестр), len(функции)))
    имена_дверей = set(re.findall(r'data-go="(\w+)"', исходник)) | set(
        re.findall(r"go\('(\w+)'", исходник))
    if len(имена_дверей & функции) < 10:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: входов найдено %d на %d экранов — признак '
                 'входа не тот, «входов нет» читать нельзя'
                 % (len(имена_дверей & функции), len(функции)))
    двери = {}
    for имя in sorted(функции - реестр):
        открытых = закрытых = 0
        места = [м.start() for м in re.finditer(r'data-go="%s"' % re.escape(имя), исходник)]
        места += [м.start() for м in re.finditer(r"go\('%s'" % re.escape(имя), исходник)]
        for поз in места:
            if ('WIRED.' + имя) in исходник[max(0, поз - 420):поз]:
                закрытых += 1
            else:
                открытых += 1
        двери[имя] = (открытых, закрытых)
    return реестр, двери


def видимость(каталог):
    """vidimost.json: кто какие вкладки и права имеет. Нет файла — страница
    собирается БЕЗ колонки видимости и говорит об этом вслух."""
    путь = os.path.join(каталог, 'vidimost.json')
    if not os.path.isfile(путь):
        return None
    return json.load(io.open(путь, encoding='utf-8'))


def список(х):
    """Хозяев двери может быть несколько. Прежняя редакция обхода писала
    одного строкой; строка здесь не ошибка, а старый файл."""
    return [х] if isinstance(х, str) else list(х)


def достижим(вид, экран):
    """(список экранов, с которых дверь, только_при_данных) или (None, False).

    Два словаря обхода: `достижимо` — найдено на пустом стенде, `при_данных` —
    только когда в афишу положили демо-набор самого клиента. Второй случай
    помечается, иначе страница выдала бы за путь то, чего без сервера нет."""
    если = вид.get('достижимо', {})
    if экран in если:
        return список(если[экран]), False
    при = вид.get('при_данных', {})
    if экран in при:
        return список(при[экран]), True
    return None, False


def держится(вид, экран, стек=()):
    """Доходит ли ЭТОТ вид человека до экрана: (да/нет, хозяева двери, при_данных).

    ⚠ Рекурсия здесь не для красоты. «Карточка человека» лежит за «Кассой»,
    а продажа членства — за карточкой человека; считать только один шаг
    значило бы сказать о кассире «не видит продажу членства» — ложное
    «никто» вместо «нечем измерить». Кольцо в условиях обрывается стеком:
    лучше честное «не доходит», чем бесконечность."""
    усл = УСЛОВИЕ.get(экран)
    if усл == 'все':
        return True, set(), False
    if усл is None or усл == 'никто' or (isinstance(усл, str) and усл.startswith('"')):
        return False, set(), False
    части = [усл] if isinstance(усл, str) else усл
    хозяева, при_данных = set(), False
    for часть in части:
        if часть == 'дверь':
            о, д = достижим(вид, экран)
            if о is None:
                return False, set(), False
            хозяева.update(о)
            при_данных = при_данных or д
        elif часть.startswith('за:'):
            цель = часть[3:]
            if цель in стек:
                return False, set(), False
            о, д = достижим(вид, цель)
            if о is None:
                да, _, д = держится(вид, цель, стек + (экран,))
                if not да:
                    return False, set(), False
            при_данных = при_данных or д
        elif not bool(вид['права'].get(часть.split(':', 1)[1])):
            return False, set(), False
    return True, хозяева, при_данных


def кто_видит(экран, люди):
    """Имена тех, кто доходит до экрана, и чем он доходит.

    Возвращает (список имён или None, текст условия словами). None — условие
    прибором не считается, и вместо имён печатается само правило."""
    усл = УСЛОВИЕ.get(экран, '')
    if isinstance(усл, str):
        if усл.startswith('"'):
            return None, усл.strip('"')
        if усл == 'все':
            return [ч['имя'] for ч in люди], 'виден всем'
        if усл == 'никто':
            return [], 'в живом приложении не показывается'
    части = [усл] if isinstance(усл, str) else усл

    нашлись, откуда, при_данных = [], set(), False
    for ч in люди:
        исходы = [держится(в, экран) for в in ч['виды']]
        дошли = [и for и in исходы if и[0]]
        if not дошли:
            continue
        нашлись.append(ч['имя'] + ('' if len(дошли) == len(исходы) else ' (не всегда)'))
        for _, о, д in дошли:
            откуда.update(о)
            при_данных = при_данных or д

    словами = []
    for часть in части:
        if часть == 'дверь':
            входы = sorted(TITLES.get(о, о) for о in откуда if о != 'вкладка')
            куски = ['своя вкладка'] if 'вкладка' in откуда else []
            if входы:
                куски.append('дверь на ' + ' или '.join('«%s»' % в for в in входы))
            словами.append(' или '.join(куски) if куски else 'входа обход не нашёл')
        elif часть.startswith('за:'):
            словами.append('за экраном «%s» (%s — обходом не подтверждено)'
                           % (TITLES.get(часть[3:], часть[3:]),
                              ПОЧЕМУ_НЕ_ПОДТВЕРЖДЁН.get(экран, 'вход рисуется по данным сервера')))
        else:
            словами.append('право %s()' % часть.split(':', 1)[1])
    if при_данных:
        словами.append('путь открыт только при непустой афише')
    return нашлись, ' и '.join(словами)


def проверить_условия(ст, вид):
    """Падающая проверка СОСТАВА условий, а не их правдивости.

    Экран, объявленный выведенным из обхода, обязан быть обходом НАЙДЕН хоть
    у кого-то. Ноль здесь значит не «никто не видит», а «обход сломался или
    дверь переехала» — ровно тот случай, из-за которого условие и перестали
    записывать числом (miniapp#90)."""
    if вид is None:
        return
    люди = вид.get('люди', [])
    чужой_за = sorted({у[3:] for э in ст for у in
                       ([УСЛОВИЕ[э]] if isinstance(УСЛОВИЕ[э], str) else УСЛОВИЕ[э])
                       if isinstance(у, str) and у.startswith('за:')} - set(УСЛОВИЕ))
    if чужой_за:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: условие «за:X» ссылается на экраны, '
                 'которых нет в УСЛОВИЕ: %s' % ', '.join(чужой_за))
    глухие = []
    for э in ст:
        for у in ([УСЛОВИЕ[э]] if isinstance(УСЛОВИЕ[э], str) else УСЛОВИЕ[э]):
            if not (isinstance(у, str) and у.startswith('за:')):
                continue
            цель = УСЛОВИЕ.get(у[3:])
            цель = цель if isinstance(цель, str) else ' '.join(цель)
            if цель.startswith('"') or цель == 'никто':
                глухие.append('%s → %s' % (э, у[3:]))
    if глухие:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: «за:X» упирается в экран, путь к которому '
                 'не считается прибором (%s) — имена вышли бы пустыми, и страница '
                 'сказала бы «никто» вместо «нечем измерить»' % ', '.join(глухие))
    потерянные = []
    for э in ст:
        части = [УСЛОВИЕ[э]] if isinstance(УСЛОВИЕ[э], str) else УСЛОВИЕ[э]
        if 'дверь' not in части:
            continue
        if not any(достижим(в, э)[0] for ч in люди for в in ч['виды']):
            потерянные.append(э)
    if потерянные:
        sys.exit('ПРОВЕРКА НЕ ВЫПОЛНЕНА: экраны объявлены выведенными из обхода, '
                 'но обход не нашёл к ним входа ни у кого: %s. Либо дверь переехала '
                 'и условие надо пересмотреть, либо обход сломался — страница '
                 'показала бы «сегодня никто» вместо «нечем измерить»'
                 % ', '.join(sorted(потерянные)))



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
.shot { border-width:3px; }                      /* рамка стадии — цвет ставит СТАДИИ.tsv */
.nosh {
  border:3px dashed var(--line); border-radius:20px; background:var(--surface);
  min-height:190px; display:flex; align-items:center; justify-content:center;
  padding:18px; text-align:center; font-size:12px; color:var(--muted);
}
.stage { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.4px;
         border-radius:999px; padding:2px 9px; border:1px solid currentColor; }
.who { display:block; margin-top:5px; font-size:12px; }
.who b { display:inline; font-weight:600; color:var(--ink); }
.legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:20px; font-size:12px; color:var(--muted); }
.legend span { display:flex; align-items:center; gap:7px; }
.legend i { width:22px; height:14px; border:3px solid currentColor; border-radius:5px; }
figcaption b { display:block; color:var(--ink); font-size:13px; font-weight:700; margin-bottom:3px; }
figcaption b span { color:var(--gold-ink); font-variant-numeric:tabular-nums; }
figcaption b em { font-style:normal; font-weight:500; color:var(--muted); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; }
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


def строки_страницы(items, ст, вид):
    """Строки страницы: сперва снимки в порядке описи, затем экраны без снимка.

    Экран без снимка не выбрасывается: у него есть стадия и видимость, а это
    и есть то, ради чего страницу читают. Молчание о работающем экране —
    ровно та беда, из-за которой заведён Cafe13KPG#405."""
    люди = (вид or {}).get('люди', [])

    реестр, двери = двери_на_невключённые()

    def общее(э):
        кадр, стадия, карточка, дата = ст.get(э, ('—', '?', '—', ''))
        видят, правило = кто_видит(э, люди)
        return {'стадия': стадия, 'кадр': кадр, 'карточка': карточка,
                'видят': видят, 'правило': правило,
                'в_реестре': э in реестр, 'входов': двери.get(э)}

    вышло, снятые = [], set()
    for it in items:
        снятые.add(it['screen'])
        вышло.append(dict(it, **общее(it['screen'])))
    for э in ст:
        if э in снятые:
            continue
        о = общее(э)
        вышло.append(dict(о, file=None, screen=э,
                          group=ГРУППА_БЕЗ_СНИМКА.get(э, 'Без снимка'),
                          caption=ПОДПИСЬ_БЕЗ_СНИМКА.get(э, ''),
                          почему=(ПОЧЕМУ_НЕТ_СНИМКА_КОД if о['стадия'] == 'нарисован'
                                  else ПОЧЕМУ_НЕТ_СНИМКА)))
    return вышло


def подпись_стадии(it):
    цвет, словами = СТАДИИ_ЦВЕТ.get(it['стадия'], СТАДИИ_ЦВЕТ['?'])
    кадр = (' &middot; кадры %s' % esc(it['кадр'])) if it['кадр'] not in ('—', '') else ''
    return ('<span class="stage" style="color:%s">%s</span>%s'
            % (цвет, esc(it['стадия']), кадр))


def подпись_видимости(it):
    if it['видят'] is None:
        return '<span class="who">видимость: %s</span>' % esc(it['правило'])
    если = ', '.join(it['видят']) if it['видят'] else 'сегодня никто'
    return ('<span class="who">видят: <b>%s</b> &middot; %s</span>%s'
            % (esc(если), esc(it['правило']), подпись_включения(it)))


def подпись_включения(it):
    """Для НАПИСАННОГО, но не включённого экрана — что человек получит сегодня.

    Разница, которую владелец читает телефоном: «сделано, ждёт включения»
    против «не сделано». Экран, у которого вход в приложении ЕСТЬ, человек
    уже находит — и получает «Раздел ещё не подключён» вместо раздела
    (Cafe13KPG#405). Число входов — «не меньше»: вход, собранный из
    переменной, признаком не считается."""
    if it.get('в_реестре') or it.get('входов') is None or it['screen'] == 'soon':
        return ''
    открытых, закрытых = it['входов']
    if открытых:
        текст = ('написан, НЕ включён &middot; вход в приложении открыт (не меньше %d) '
                 'и ведёт на «Раздел ещё не подключён» — человек видит обещание, '
                 'а не раздел' % открытых)
    elif закрытых:
        текст = ('написан, ЖДЁТ ВКЛЮЧЕНИЯ &middot; вход нарисован и закрыт самим '
                 'реестром (%d) — включается вместе с экраном, одной строкой' % закрытых)
    else:
        текст = ('написан, НЕ включён &middot; входа в приложении нет вовсе — '
                 'человек до него не дойдёт')
    return '<span class="who">состояние: %s</span>' % текст


def картинка(it, prefix):
    if it.get('file'):
        цвет = СТАДИИ_ЦВЕТ.get(it['стадия'], СТАДИИ_ЦВЕТ['?'])[0]
        return ('<div class="shot" style="border-color:%s"><img loading="lazy" src="%s%s" '
                'alt="%s" width="780" height="1688"></div>'
                % (цвет, prefix, it['file'], esc(it['caption'][:80])))
    return '<div class="nosh">снимка нет: %s</div>' % esc(it.get('почему', ''))


def web(items, prefix):
    gs = ordered_groups(items)
    o = [HEAD % ('Экраны Café XIII', CSS)]
    o.append('<div class="wrap"><header>')
    o.append('<div class="wordmark">Caf&eacute; XIII</div>')
    o.append('<h1>Экраны мини-приложения</h1>')
    экранов = len({i['screen'] for i in items})
    со_снимком = len([i for i in items if i.get('file')])
    o.append('<div class="meta">%s &middot; %d %s, снимков %d &middot; '
             'снимок — с живой страницы, 390&nbsp;&times;&nbsp;844 &middot; '
             '<a href="%s">открыть приложение</a></div>'
             % (VERSION, экранов, plural(экранов), со_снимком, LIVE))
    o.append('<p class="lead">%s</p>' % esc(INTRO))
    o.append('<p class="lead">%s</p>' % esc(ПРЕДЕЛ_ВИДИМОСТИ))
    o.append('<div class="legend">')
    for стадия, (цвет, словами) in СТАДИИ_ЦВЕТ.items():
        if стадия == '?':
            continue
        o.append('<span style="color:%s"><i></i>%s</span>' % (цвет, esc(словами)))
    o.append('</div>')
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
            o.append('<figure>' + картинка(it, prefix))
            o.append('<figcaption><b><span>%02d</span> &nbsp;%s <em>%s</em></b>%s%s%s</figcaption></figure>'
                     % (n, esc(title_of(it)), esc(it['screen']), подпись_стадии(it),
                        '<span class="who">' + esc(it['caption']) + '</span>',
                        подпись_видимости(it)))
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
        o.append('<div class="img">%s</div>'
                 % ('<img src="%s%s" alt="">' % (prefix, it['file']) if it.get('file')
                    else '<div style="padding:12mm;color:#6B7276;font-size:9.5pt">снимка нет: %s</div>'
                         % esc(it.get('почему', ''))))
        o.append('<div class="text"><div class="eyebrow">%02d &middot; %s</div>' % (n, esc(it['group'])))
        o.append('<h2>%s</h2><p>%s</p>' % (esc(title_of(it)), esc(it['caption'])))
        o.append('<p>Стадия: %s%s. %s</p>'
                 % (esc(it['стадия']),
                    (', кадры ' + esc(it['кадр'])) if it['кадр'] not in ('—', '') else '',
                    ('Видимость: ' + esc(it['правило'])) if it['видят'] is None
                    else ('Видят: ' + esc(', '.join(it['видят']) or 'сегодня никто')
                          + ' (' + esc(it['правило']) + ')')))
        o.append('<div class="id">экран %s</div>' % esc(it['screen']))
        o.append('<div class="group">%s</div></div></div>' % esc(GROUPS.get(it['group'], '')))
    o.append('</body></html>')
    return '\n'.join(o)


TITLES = {
    'consent': 'Согласие на данные', 'consentFull': 'Согласие · полный текст',
    'soon': 'Раздел ещё не подключён',
    'guest': 'Услуги и бар', 'home': 'Клуб', 'pass': 'Пропуск', 'membership': 'Членство', 'memberRequests': 'Заявки на членство',
    'events': 'Афиша', 'event': 'Мероприятие', 'bookings': 'Мои ивенты',
    'bar': 'Меню бара', 'drink': 'Напиток', 'barCart': 'Заказ', 'barOrder': 'Состояние заказа',
    'barQueue': 'Заказы на баре', 'barShot': 'Съёмка напитков', 'barDay': 'Отчёт за день',
    'barExpense': 'Затраты направления', 'curator': 'Кабинет куратора',
    'organizer': 'Мои мероприятия', 'eventNew': 'Новое мероприятие', 'eventManage': 'Управление мероприятием',
    'partner': 'Моё направление', 'serviceNew': 'Новая услуга', 'staff': 'Касса', 'demo': 'Демо-режим',
    'topup': 'Свой счёт', 'barRecipe': 'Рецепт напитка', 'barCards': 'Карточки меню',
    'barCard': 'Карточка напитка', 'barMoney': 'Доход и расход бара', 'people': 'Члены клуба', 'joinQueue': 'Заявки на доступ', 'manage': 'Управление',
    'tillPerson': 'Карточка человека', 'tillMembership': 'Продажа членства',
    'tillTopup': 'Пополнение в кассе', 'tillDay': 'День кассы',
    'loading': 'Загрузка', 'noSign': 'Подпись не дошла', 'noAccess': 'Нет доступа',
    'apiDown': 'Сервер молчит',
    'занятость суток': 'Занятость суток', 'архив мероприятий': 'Архив мероприятий',
    'касса · оплата записи': 'Касса · оплата записи',
}


def title_of(it):
    return TITLES.get(it['screen'], it['screen'])


if __name__ == '__main__':
    d = sys.argv[1] if len(sys.argv) > 1 else '.'
    снимки = json.load(io.open(os.path.join(d, 'manifest.json'), encoding='utf-8'))
    ст = стадии(d)
    вид = видимость(d)
    if вид is None:
        print('⚠ нет %s/vidimost.json — страница собрана БЕЗ имён в колонке '
              '«видят»; снять: tools/vidimost.cjs' % d)
    свежесть(d, вид)
    проверить_условия(ст, вид)
    items = строки_страницы(снимки, ст, вид)
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    io.open(os.path.join(repo, 'screens.html'), 'w', encoding='utf-8').write(web(items, 'screens/'))
    io.open(os.path.join(d, 'print.html'), 'w', encoding='utf-8').write(printable(items, ''))
    по_стадиям = {}
    for i in items:
        по_стадиям[i['стадия']] = по_стадиям.get(i['стадия'], 0) + 1
    print('screens.html: %d экранов, строк %d, снимков %d'
          % (len({i['screen'] for i in items}), len(items),
             len([i for i in items if i.get('file')])))
    print('стадии: ' + ', '.join('%s — %d' % (к, в) for к, в in sorted(по_стадиям.items())))
    без_имени = sorted({i['screen'] for i in items if i['screen'] not in TITLES})
    if без_имени:
        print('⚠ без человеческого имени (в TITLES каталога): ' + ', '.join(без_имени))
    print('print.html:   %s/print.html' % d)
