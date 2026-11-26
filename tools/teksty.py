#!/usr/bin/env python3
# ТЕКСТЫ ИНТЕРФЕЙСА ↔ ТАБЛИЦА ПЕРЕВОДОВ — шаг 41 плана, слово владельца 26.11.2026:
# «как только мы добавляем экран и добавляем какой-то текст мы делаем … перевод в этой табличке».
#
#     tools/teksty.py [<дерево>]              сверка: КРАСНОЕ, если в js/ есть текст без строки в таблице
#     tools/teksty.py [<дерево>] --собрать    дописать в таблицу недостающие строки (переводы пустые)
#     tools/teksty.py [<дерево>] --список     все найденные тексты: где ⇥ текст (для чтения глазами)
#     tools/teksty.py [<дерево>] --самопроверка
#
# Коды: 0 — каждый текст кода есть в таблице и переведён на en/th/my; 1 — КРАСНОЕ (текст без строки,
#       строка без перевода, перевод потерял подстановку {имя});
#       2 — ПРОВЕРКА НЕ ВЫПОЛНЕНА (нет таблицы, сборщик сбился, таблица битая).
#
# ⚠ ПОДЛЕЖАЩЕЕ — файлы клиента по index.html (`tools/klient.py`, тот же перечень, что у ворот), а таблица —
# `texts/perevody.tsv` того же дерева. Выложенный клиент прибор не читает.
#
# ── ПРИЗНАК «ЭТО ТЕКСТ ДЛЯ ЧЕЛОВЕКА» ─────────────────────────────────────────────────────────────
# Единица — ФРАГМЕНТ строкового литерала: '…', "…" и текстовые части `…` (без ${…}). Литерал режется на
# фрагменты по HTML-тегам (<…>) и по подстановкам; значение атрибута (aria-label="…", placeholder="…") —
# свой фрагмент. Фрагмент — текст, если в нём есть хоть одна кириллическая буква [А-Яа-яЁё]; края
# обрезаются от пробелов. Ключ таблицы для фрагмента — его текст ровно (колонка ru).
# ИСКЛЮЧАЕТСЯ, и каждое исключение печатается числом в сводке:
#   • комментарии // и /* */ — не литералы вовсе (их кириллица — проза для людей кода);
#   • литералы регулярных выражений /…/ — образец поиска, а не слово экрана (/^Сегодня/.test(…));
#   • литералы внутри скобок вызова Error(…) и console.*(…) — сообщения разработчику (PROTO: «…» не экран);
#     окно — от «(» вызова до парной «)», включая склейку через +;
#   • литералы в скобках .replace(…) — замена буквы в коде (groupKey: .replace(/ё/g, 'е')), не слово экрана;
#     нашёл переводчик части 3 на сборке 26.11.2026 — признак «кириллица в литерале» взял её за текст;
#   • литерал сразу после «VERSION =» — номер выкладки («v220 · 0.2 «Путь бизнеса» · 26.11.2026»): меняется
#     каждой версией, и прибор краснел бы на каждом подъёме номера.
# Кириллические ИМЕНА кода (var буква) — код, а не литерал; считаются отдельно.
# ЧЕГО ПРИЗНАК НЕ ВИДИТ (предел, не забывчивость):
#   • текст, который собирает рантайм: toLocaleDateString('ru-RU') — месяцы и дни недели;
#   • текст, пришедший с сервера (названия, отказы печатью сервера) — он не в js/;
#   • текст в index.html и styles.css (content: '…') — их прибор не читает;
#   • латиница для человека («OK», «Telegram») — без кириллицы не текст по признаку.
# ⚠ Инвариант сборщика (держит `--самопроверка` и каждый прогон): после вырезания литералов, шаблонов,
# регулярок и комментариев в коде НЕ остаётся ни одной кириллической буквы. Остаток значит, что разбор
# сбился (не та граница регулярки или шаблона) — это «НЕ ВЫПОЛНЕНА», а не «сошлось». Кириллическое ИМЯ кода
# допускается, только если оно объявлено (var/let/const/function) где-то в клиенте.
# ⚠ Известный предел разбора: «/» сразу после «)» условия (if (x) /re/…) читается как деление. В клиенте
# такого нет (иначе инвариант бы сработал), а появится — прибор скажет «НЕ ВЫПОЛНЕНА» строкой о месте.
#
# ── ТАБЛИЦА ───────────────────────────────────────────────────────────────────────────────────────
# TSV, первая строка — шапка: ключ ⇥ ru ⇥ en ⇥ th ⇥ my ⇥ где ⇥ экран ⇥ пометка.
#   ключ   — ключ словаря 00-slova.js, если текст оттуда; иначе `t.<8 hex sha1 текста>` (устойчив к переносу);
#   где    — файл:строка ПЕРВОГО вхождения на момент сборки (справка, сверка по нему не идёт);
#   экран  — ключ SCREENS, внутри которого текст стоит, если стоит; иначе пусто;
#   пометка — `машинный` (перевод машинный, носителем НЕ проверен) или `сверен` (проверил носитель);
#             у строки без перевода — `нет перевода`.
# Табуляция и перевод строки внутри ячейки пишутся как \t и \n.
# ⚠ Строка таблицы, текста которой в коде больше нет («лишняя»), — КРАСНОЕ (с 26.11.2026, Cafe13KPG#1130):
# мёртвая строка с переводами хуже отсутствия — тот же русский текст, вернувшись в другом смысле, молча
# получит старый перевод, и --собрать не спросит. Снял текст из кода — тем же PR удали его строку.
# Прежде лишняя строка печаталась «⚠ … не красное», и шаг 19 пропускал её зелёным (замер arhitector24,
# дерево df1247c: rc=0 при «лишних 1»).
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ME = 'teksty.py'
PH = re.compile(r'\{[A-Za-z_][A-Za-z0-9_]*\}')
TABLE = 'texts/perevody.tsv'
HEAD = ['ключ', 'ru', 'en', 'th', 'my', 'где', 'экран', 'пометка']
CYR = re.compile('[А-Яа-яЁё]')
TAG = re.compile(r'<[A-Za-z/!][^<>]*>')
ATTR = re.compile(r'''\b([a-z][a-z-]*)="([^"<>]*)(?:"|$)''')   # значение в "…"; до конца литерала, если не закрыто


class Sboy(Exception):
    pass


def itog(stroka, kod):
    print(stroka)
    sys.exit(kod)


def itog_samoproverki(kod, pochemu=''):
    if pochemu:
        print(pochemu)
    if kod == 0:
        itog(f'самопроверка {ME}: сошлась', 0)
    if kod == 1:
        itog(f'самопроверка {ME}: РАЗОШЛАСЬ — код 1', 1)
    itog(f'самопроверка {ME}: НЕ ВЫПОЛНЕНА — код {kod}', kod)


# ── разбор JS ────────────────────────────────────────────────────────────────────────────────────
# Регулярка или деление решается по предыдущему значащему токену: после значения (имя, число, «)»,
# «]», «}», литерал) «/» — деление, иначе — начало регулярки. Ключевые слова, после которых идёт
# выражение, — отдельный список.
KW_EXPR = {'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else'}
VERSION_AT = re.compile(r'\bVERSION\s*=\s*$')   # var VERSION = '…' — номер выкладки, меняется каждой версией
IDENT = re.compile(r'(?:[^\W\d]|\$)[\w$]*')


def razobrat(src, fname):
    """Возвращает (литералы, вырезки, сводка). Литерал: dict(text, line, kind, excluded_by, screen)."""
    i, n, line = 0, len(src), 1
    out = []            # литералы
    code = []           # код без литералов и комментариев — для инварианта
    prev = ''           # предыдущий значащий токен: 'val' | 'op' | имя ключевого слова
    parens = []         # стек: (callee | None)
    last_ident = []     # цепочка имён перед текущей позицией: ['console', 'log']
    braces = []         # стек открытых { с меткой экрана
    pending_screen = None
    stats = {'comment': 0, 'regex_cyr': 0, 'ident_cyr': 0, 'decl': set(), 'uses': []}
    lastw = ['']

    def excluded():
        for c in parens:
            if c and (c == 'Error' or c.startswith('console.') or c == 'replace' or c.endswith('.replace')):
                return c
        return None

    def screen():
        for s in reversed(braces):
            if s:
                return s
        return ''

    def push_lit(text, ln, kind, at=None):
        why = excluded()
        if at is not None and VERSION_AT.search(src, max(0, at - 40), at):
            why = 'VERSION'
        out.append({'text': text, 'line': ln, 'kind': kind, 'excluded_by': why, 'screen': screen()})

    def tmpl(i, line):
        """Шаблон от позиции после `; возвращает (i, line). Текстовые части — литералы."""
        buf, start_line = [], line
        while True:
            if i >= n:
                raise Sboy(f'{fname}:{start_line}: шаблон не закрыт')
            ch = src[i]
            if ch == '\\':
                buf.append(src[i:i + 2]); line += src[i:i + 2].count('\n'); code.append('\n' * src[i:i + 2].count('\n')); i += 2; continue
            if ch == '`':
                push_lit(''.join(buf), start_line, 'tmpl'); return i + 1, line
            if ch == '$' and i + 1 < n and src[i + 1] == '{':
                push_lit(''.join(buf), start_line, 'tmpl'); buf = []
                i, line = expr_until_brace(i + 2, line)
                start_line = line
                continue
            if ch == '\n':
                line += 1; code.append('\n')
            buf.append(ch); i += 1

    def expr_until_brace(i, line):
        """Код внутри ${…} до парной }. Рекурсивно тем же разбором."""
        depth = 0
        nonlocal prev
        prev = 'op'
        while True:
            if i >= n:
                raise Sboy(f'{fname}:{line}: ${{…}} не закрыт')
            ch = src[i]
            if ch == '}' and depth == 0:
                prev = 'val'
                return i + 1, line
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
            i, line = token(i, line)

    def token(i, line):
        nonlocal prev, pending_screen
        ch = src[i]
        if ch == '\n':
            code.append(ch); return i + 1, line + 1
        if ch in ' \t\r':
            code.append(ch); return i + 1, line
        if src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            stats['comment'] += 1
            return j, line
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            if j < 0:
                raise Sboy(f'{fname}:{line}: комментарий /* не закрыт')
            stats['comment'] += 1
            code.append('\n' * src[i:j + 2].count('\n'))
            return j + 2, line + src[i:j + 2].count('\n')
        if ch in '\'"':
            j, buf = i + 1, []
            while True:
                if j >= n or src[j] == '\n':
                    raise Sboy(f'{fname}:{line}: строка {ch}…{ch} не закрыта')
                if src[j] == '\\':
                    buf.append(src[j:j + 2]); j += 2; continue
                if src[j] == ch:
                    break
                buf.append(src[j]); j += 1
            push_lit(''.join(buf), line, 'str', i)
            # имя свойства перед «:» внутри SCREENS — не текст, но и кириллицы там нет; экран по ключу
            prev = 'val'; last_ident.clear(); last_ident.append('#lit:' + ''.join(buf))
            return j + 1, line
        if ch == '`':
            prev = 'op'
            i2, line2 = tmpl(i + 1, line)
            prev = 'val'; last_ident.clear()
            return i2, line2
        if ch == '/':
            if prev == 'val':
                code.append(ch); prev = 'op'; last_ident.clear(); return i + 1, line
            # регулярка
            j, in_cls = i + 1, False
            while True:
                if j >= n or src[j] == '\n':
                    raise Sboy(f'{fname}:{line}: регулярка не закрыта')
                c = src[j]
                if c == '\\':
                    j += 2; continue
                if c == '[':
                    in_cls = True
                elif c == ']':
                    in_cls = False
                elif c == '/' and not in_cls:
                    break
                j += 1
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            if CYR.search(src[i:j]):
                stats['regex_cyr'] += 1
            prev = 'val'; last_ident.clear()
            return j, line
        m = IDENT.match(src, i)
        if m:
            w = m.group(0)
            if CYR.search(w):
                # имя кода кириллицей (var буква) — код, не текст; но только ОБЪЯВЛЕННОЕ: сбитый разбор выдаёт
                # слова текста за имена, и без этой охраны инвариант молчал бы
                stats['ident_cyr'] += 1
                if lastw[0] in ('var', 'let', 'const', 'function'):
                    stats['decl'].add(w)
                stats['uses'].append((w, line))
            else:
                code.append(w)
            lastw[0] = w
            prev = w if w in KW_EXPR else 'val'
            if last_ident and last_ident[-1] == '.':
                last_ident.pop(); last_ident.append(w)
                last_ident[:] = ['.'.join(x for x in last_ident if not x.startswith('#'))]
            else:
                last_ident.clear(); last_ident.append(w)
            return m.end(), line
        if ch.isdigit():
            m = re.compile(r'[\w.]+').match(src, i)
            code.append(m.group(0)); prev = 'val'; last_ident.clear()
            return m.end(), line
        if src.startswith('++', i) or src.startswith('--', i):
            # ++/-- перед «/» — всегда постфикс (`i++ / 2`): за ним значение, и «/» — деление.
            # У префикса (`++i`) следом идёт имя, и оно само ставит 'val'. Без этой ветки
            # второй «+» давал prev='op', деление читалось регуляркой и глотало литерал (S11).
            code.append(src[i:i + 2]); prev = 'val'; last_ident.clear()
            return i + 2, line
        code.append(ch)
        if ch == '.':
            last_ident.append('.')
            return i + 1, line
        if ch == '(':
            callee = last_ident[0] if len(last_ident) == 1 and not last_ident[0].startswith('#') and prev == 'val' else None
            parens.append(callee); prev = 'op'; last_ident.clear()
            return i + 1, line
        if ch == ')':
            if parens:
                parens.pop()
            prev = 'val'; last_ident.clear()
            return i + 1, line
        if ch == ']':
            prev = 'val'; last_ident.clear(); return i + 1, line
        if ch == ':':
            # ключ свойства верхнего уровня Object.assign(SCREENS, {…}) — имя экрана для следующей {
            if len(last_ident) == 1 and braces and braces[-1] == '#SCREENS':
                k = last_ident[0]
                pending_screen = k[5:] if k.startswith('#lit:') else k
            prev = 'op'; last_ident.clear(); return i + 1, line
        if ch == '{':
            tag = None
            if pending_screen:
                tag, pending_screen = pending_screen, None
            elif scr_open[0]:
                tag = '#SCREENS'; scr_open[0] = False
            braces.append(tag); prev = 'op'; last_ident.clear()
            return i + 1, line
        if ch == '}':
            if braces:
                braces.pop()
            prev = 'val'; last_ident.clear()
            return i + 1, line
        if ch == ',':
            if braces and braces[-1] == '#SCREENS':
                pending_screen = None
        prev = 'op'; last_ident.clear()
        return i + 1, line

    # «Object.assign(SCREENS, {» и «var SCREENS = {» открывают блок экранов
    scr_open = [False]
    scr_marks = set()
    for m in re.finditer(r'Object\.assign\(\s*SCREENS\s*,\s*\{|\bSCREENS\s*=\s*\{', src):
        scr_marks.add(m.end() - 1)
    while i < n:
        if i in scr_marks:
            scr_open[0] = True
        i, line = token(i, line)
    rest = ''.join(code)
    return out, rest, stats


def fragmenty(text):
    """Режет значение литерала на фрагменты для человека: [фрагмент].
    Литерал часто несёт КУСОК тега (тег склеен из соседних литералов через +), поэтому:
      1) значение атрибута — свой фрагмент, в том числе незакрытое к концу литерала (aria-label="Выдать: ' + …);
      2) целые теги <…> — разделители;
      3) хвост тега в начале литерала (">Повторить', ' role="img">…') — разделитель, если в нём нет кириллицы;
      4) голова тега в конце литерала ('…<button class="x"') — разделитель."""
    res = []

    def attr(m):
        v = m.group(2)
        if CYR.search(v):
            res.append(v.strip())
        return '\x00'
    rest = ATTR.sub(attr, text)
    rest = TAG.sub('\x00', rest)
    rest = re.sub(r'<[A-Za-z][^<>\x00]*$', '\x00', rest)
    for part in rest.split('\x00'):
        p = re.sub(r'^[^<>А-Яа-яЁё]*>', '', part).strip()
        if CYR.search(p):
            res.append(p)
    return [r for r in res if CYR.search(r)]


def klient_files(root):
    r = subprocess.run([sys.executable, '-I', os.path.join(root, 'tools/klient.py'), root],
                       capture_output=True, text=True, cwd=root)
    if r.returncode != 0:
        raise Sboy(f'состав клиента (klient.py): {r.stderr.strip() or r.stdout.strip()}')
    return json.loads(r.stdout)


def slova_keys(root):
    """ru-словарь 00-slova.js: текст → ключ (первый). Читается тем же разбором: 'ключ': 'текст'."""
    p = os.path.join(root, 'js/00-slova.js')
    if not os.path.exists(p):
        return {}
    src = open(p, encoding='utf-8').read()
    k = src.find('ru: {')
    if k < 0:
        return {}
    res = {}
    for m in re.finditer(r"""^\s*'([A-Za-z0-9_.]+)':\s*'((?:[^'\\]|\\.)*)'""", src[k:], re.M):
        res.setdefault(m.group(2).strip(), m.group(1))
    return res


def sobrat(root):
    """Все тексты дерева: (список находок, сводка). Находка: dict(text, where, screen)."""
    files = klient_files(root)
    found, sv = [], {'files': 0, 'literals': 0, 'cyr_literals': 0, 'excl_call': 0, 'excl_call_frag': 0,
                     'comment': 0, 'regex_cyr': 0, 'ident_cyr': 0, 'frag': 0, 'by_call': {}}
    decl, uses = set(), []
    for f in files:
        src = open(os.path.join(root, f), encoding='utf-8').read()
        lits, rest, st = razobrat(src, f)
        left = CYR.search(rest)
        if left:
            ln = rest[:left.start()].count('\n') + 1
            raise Sboy(f'{f}:{ln}: кириллица вне литералов и комментариев («{rest[left.start():left.start() + 20]}») — разбор сбился')
        decl |= st['decl']
        uses += [(w, f, ln) for w, ln in st['uses']]
        sv['files'] += 1
        sv['comment'] += st['comment']
        sv['regex_cyr'] += st['regex_cyr']
        sv['ident_cyr'] += st['ident_cyr']
        for L in lits:
            sv['literals'] += 1
            if not CYR.search(L['text']):
                continue
            sv['cyr_literals'] += 1
            fr = fragmenty(L['text'])
            if L['excluded_by']:
                sv['excl_call'] += 1
                sv['excl_call_frag'] += len(fr)
                c = 'console.*' if L['excluded_by'].startswith('console.') else \
                    '.replace' if L['excluded_by'].endswith('replace') else L['excluded_by']
                sv['by_call'][c] = sv['by_call'].get(c, 0) + 1
                continue
            for t in fr:
                sv['frag'] += 1
                found.append({'text': t, 'where': f'{f}:{L["line"]}', 'screen': L['screen']})
    for w, f, ln in uses:
        if w not in decl:
            raise Sboy(f'{f}:{ln}: кириллическое имя «{w}» вне литерала и нигде не объявлено (var/let/const/function) — '
                       f'разбор сбился: слово текста прочитано как код')
    return found, sv


def svodka(sv, uniq):
    calls = ', '.join(f'{k} {v}' for k, v in sorted(sv['by_call'].items())) or 'нет'
    return (f'обошёл файлов клиента: {sv["files"]}; строковых литералов {sv["literals"]}, из них с кириллицей '
            f'{sv["cyr_literals"]}; исключено литералов {sv["excl_call"]} ({calls}); регулярок с '
            f'кириллицей вне счёта {sv["regex_cyr"]}; имён кода кириллицей вне счёта {sv["ident_cyr"]}; фрагментов текста {sv["frag"]}, разных {uniq}')


def esc_cell(s):
    return s.replace('\\', '\\\\').replace('\t', '\\t').replace('\n', '\\n')


def unesc_cell(s):
    return re.sub(r'\\(.)', lambda m: {'t': '\t', 'n': '\n', '\\': '\\'}.get(m.group(1), '\\' + m.group(1)), s)


def read_table(root):
    p = os.path.join(root, TABLE)
    if not os.path.exists(p):
        raise Sboy(f'нет таблицы {TABLE}')
    rows = []
    with open(p, encoding='utf-8') as fh:
        lines = fh.read().split('\n')
    if lines and lines[-1] == '':
        lines.pop()
    if not lines or lines[0].split('\t') != HEAD:
        raise Sboy(f'{TABLE}:1: шапка не «{" ⇥ ".join(HEAD)}»')
    seen_k, seen_ru = {}, {}
    for no, ln in enumerate(lines[1:], 2):
        cells = ln.split('\t')
        if len(cells) != len(HEAD):
            raise Sboy(f'{TABLE}:{no}: ячеек {len(cells)}, а колонок {len(HEAD)}')
        row = dict(zip(HEAD, [unesc_cell(c) for c in cells]))
        if row['ключ'] in seen_k:
            raise Sboy(f'{TABLE}:{no}: ключ «{row["ключ"]}» уже в строке {seen_k[row["ключ"]]}')
        if row['ru'] in seen_ru:
            raise Sboy(f'{TABLE}:{no}: текст «{row["ru"]}» уже в строке {seen_ru[row["ru"]]}')
        if row['пометка'] not in ('машинный', 'сверен', 'нет перевода'):
            raise Sboy(f'{TABLE}:{no}: пометка «{row["пометка"]}» — допустимы «машинный», «сверен», «нет перевода»')
        empty = [c for c in ('en', 'th', 'my') if not row[c]]
        if row['пометка'] != 'нет перевода' and empty:
            raise Sboy(f'{TABLE}:{no}: пометка «{row["пометка"]}», а перевода нет: {", ".join(empty)}')
        seen_k[row['ключ']] = no
        seen_ru[row['ru']] = no
        row['_no'] = no
        rows.append(row)
    return rows


def key_for(text, slova):
    return slova.get(text) or 't.' + hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]


def write_table(root, rows):
    p = os.path.join(root, TABLE)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write('\t'.join(HEAD) + '\n')
        for r in rows:
            fh.write('\t'.join(esc_cell(r.get(c, '')) for c in HEAD) + '\n')


def uniq_found(found):
    first = {}
    for x in found:
        first.setdefault(x['text'], x)
    return first


def sverit(root, out=print):
    """0 — сошлось; 1 — красное. Sboy — не выполнена."""
    found, sv = sobrat(root)
    rows = read_table(root)
    have = {r['ru'] for r in rows}
    first = uniq_found(found)
    missing = [x for x in found if x['text'] not in have]
    extra = [r for r in rows if r['ru'] not in first]
    out(svodka(sv, len(first)))
    out(f'таблица {TABLE}: строк {len(rows)}; машинный перевод {sum(r["пометка"] == "машинный" for r in rows)}, '
        f'сверен носителем {sum(r["пометка"] == "сверен" for r in rows)}, без перевода '
        f'{sum(r["пометка"] == "нет перевода" for r in rows)}')
    for r in extra:
        out(f'КРАСНОЕ {TABLE}:{r["_no"]}: строка без текста в коде [{r["ключ"]}]: «{r["ru"]}» — удалить строку')
    for x in missing:
        out(f'КРАСНОЕ {x["where"]}: текст без строки в {TABLE}: «{x["text"]}»')
    # строка есть, а перевода нет — тоже красное: слово владельца — «делаем перевод в этой табличке», а не «заводим строку»
    untr = [r for r in rows if r['ru'] in first and r['пометка'] == 'нет перевода']
    for r in untr:
        out(f'КРАСНОЕ {TABLE}:{r["_no"]}: строка без перевода ({first[r["ru"]]["where"]}): «{r["ru"]}»')
    # подстановки {имя} — одни и те же во всех языках: перевод, потерявший {amount}, покажет сумму пустой
    ph = []
    for r in rows:
        want = sorted(PH.findall(r['ru']))
        for c in ('en', 'th', 'my'):
            if r[c] and sorted(PH.findall(r[c])) != want:
                ph.append(r)
                out(f'КРАСНОЕ {TABLE}:{r["_no"]}: подстановки {c} {sorted(PH.findall(r[c]))} ≠ ru {want}')
    if missing:
        out(f'текстов без строки в таблице: {len(missing)} (разных {len({x["text"] for x in missing})}) — '
            f'дописать: tools/{ME} --собрать, затем перевести en/th/my')
    if untr:
        out(f'строк без перевода: {len(untr)}')
    if extra:
        out(f'лишних строк (текста в коде больше нет): {len(extra)} — удалить их тем же PR, что снял текст')
    if missing or untr or ph or extra:
        return 1
    out(f'каждый текст кода есть в таблице и переведён: {len(first)} из {len(first)}')
    return 0


def sobrat_v_tablicu(root):
    found, sv = sobrat(root)
    slova = slova_keys(root)
    p = os.path.join(root, TABLE)
    rows = read_table(root) if os.path.exists(p) else []
    have = {r['ru'] for r in rows}
    add = 0
    for t, x in uniq_found(found).items():
        if t in have:
            continue
        rows.append({'ключ': key_for(t, slova), 'ru': t, 'en': '', 'th': '', 'my': '', 'где': x['where'],
                     'экран': x['screen'], 'пометка': 'нет перевода'})
        add += 1
    keys = [r['ключ'] for r in rows]
    if len(set(keys)) != len(keys):
        raise Sboy('совпали ключи двух текстов (sha1-префикс или словарь) — разобрать руками')
    write_table(root, rows)
    print(svodka(sv, len(uniq_found(found))))
    print(f'дописано строк: {add}; всего в таблице {len(rows)}')
    return 0


# ── самопроверка ─────────────────────────────────────────────────────────────────────────────────
# Копия дерева в ~/.cache (не в /tmp: общая tmpfs). Случаи — каждый обязан дать свой код И свою строку:
#   S0 копия как есть                                           → 0
#   S1 в js/ дописан экранный текст без строки                   → 1, строка «КРАСНОЕ <файл>:<строка>» о нём
#   S2 тот же текст снят обратно                                 → 0
#   S3 текст внутри console.log(…) и throw new Error(…)          → 0 (исключение держит)
#   S4 текст в атрибуте aria-label="…" внутри разметки           → 1 (атрибут — текст)
#   S5 регулярка /«…/ с кавычкой и кириллицей перед литералом     → 1 о литерале после неё (разбор не сбился)
#   S6 из таблицы удалена строка живого текста                   → 1 о его месте
#   S7 таблица без шапки                                         → 2
#   S8 разбор сбит: регулярка после «)» условия прочитана делением → 2 (инвариант, а не тихий пропуск)
#   S9 у живой строки сняты переводы («нет перевода»)             → 1 о строке таблицы
#   S10 из th-перевода выброшена подстановка {имя}                → 1 о строке таблицы
#   S11 литерал между делениями после постфикса `i++ / 2`         → 1 о литерале (деление не прочитано регуляркой)
#   S12 в таблицу дописана строка, текста которой в коде нет       → 1 о строке таблицы с ключом
#   S13 та же строка снята                                         → 0
NEW = 'Свидетель сорок первого шага'


def run_on(root, *args):
    r = subprocess.run([sys.executable, '-I', os.path.abspath(__file__), root, *args],
                       capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def samoproverka(root):
    base = os.path.join(os.environ.get('HOME', '/nonexistent'), '.cache', 'cafe13-teksty')
    try:
        os.makedirs(base, exist_ok=True)
        w = tempfile.mkdtemp(prefix='sp-', dir=base)
    except OSError as e:
        itog_samoproverki(2, f'не создан рабочий каталог: {e}')
    bad = []
    try:
        for d in ('js', 'tools', 'texts'):
            if not os.path.isdir(os.path.join(root, d)):
                itog_samoproverki(2, f'в дереве нет {d}/')
            shutil.copytree(os.path.join(root, d), os.path.join(w, d))
        shutil.copy(os.path.join(root, 'index.html'), w)
        target = os.path.join(w, 'js/20-ekrany-sluzhebnye.js')
        orig = open(target, encoding='utf-8').read()
        nlines = orig.count('\n')
        tbl = os.path.join(w, TABLE)
        tbl_orig = open(tbl, encoding='utf-8').read()

        def case(name, want_rc, want_line=None):
            rc, log = run_on(w)
            ok = rc == want_rc and (want_line is None or any(l.startswith(want_line) for l in log.splitlines()))
            print(f'{name}: код {rc} (ждали {want_rc})' + (f', строка «{want_line}…» ' + ('есть' if ok else 'НЕТ') if want_line else '')
                  + (' — сходится' if ok else ' — РАСХОДИТСЯ'))
            if not ok:
                bad.append(name)
                print('   ' + '\n   '.join(log.strip().splitlines()[-4:]))

        case('S0 копия как есть', 0)
        with open(target, 'a', encoding='utf-8') as fh:
            fh.write(f"\nfunction svidetel41() {{ return '<p>{NEW}</p>'; }}\n")
        case('S1 новый текст без строки', 1, f'КРАСНОЕ js/20-ekrany-sluzhebnye.js:{nlines + 2}: текст без строки')
        open(target, 'w', encoding='utf-8').write(orig)
        case('S2 текст снят', 0)
        with open(target, 'a', encoding='utf-8') as fh:
            fh.write(f"\nfunction svidetel41() {{ console.log('{NEW}', 1); if (0) throw new Error('{NEW}: ' + 1); }}\n")
        case('S3 лог и ошибка исключены', 0)
        with open(target, 'w', encoding='utf-8') as fh:
            fh.write(orig + f"\nfunction svidetel41() {{ return '<button aria-label=\"{NEW}\">' + 1 + '</button>'; }}\n")
        case('S4 текст в атрибуте', 1, f'КРАСНОЕ js/20-ekrany-sluzhebnye.js:{nlines + 2}: текст без строки в {TABLE}: «{NEW}»')
        with open(target, 'w', encoding='utf-8') as fh:
            fh.write(orig + f"\nfunction svidetel41(s) {{ return /^«Да'/.test(s) ? 2 / 1 / 1 : '{NEW}'; }}\n")
        case('S5 регулярка с кавычкой', 1, f'КРАСНОЕ js/20-ekrany-sluzhebnye.js:{nlines + 2}: текст без строки в {TABLE}: «{NEW}»')
        open(target, 'w', encoding='utf-8').write(orig)
        lines = tbl_orig.split('\n')
        live = next((l for l in lines[1:] if l and '\tjs/20-ekrany-sluzhebnye.js:' in l), None)
        if live is None:
            bad.append('S6')
            print('S6: в таблице нет строки из js/20-ekrany-sluzhebnye.js — случай не поставить — РАСХОДИТСЯ')
        else:
            gde = live.split('\t')[5]
            open(tbl, 'w', encoding='utf-8').write('\n'.join(l for l in lines if l != live))
            case('S6 строка снята из таблицы', 1, f'КРАСНОЕ {gde}: текст без строки')
        lines = tbl_orig.split('\n')
        k = next(no for no, l in enumerate(lines[1:], 1) if l and l.split('\t')[7] == 'машинный' and '{' not in l)
        c = lines[k].split('\t'); c[2] = c[3] = c[4] = ''; c[7] = 'нет перевода'
        open(tbl, 'w', encoding='utf-8').write('\n'.join(lines[:k] + ['\t'.join(c)] + lines[k + 1:]))
        case('S9 строка без перевода', 1, f'КРАСНОЕ {TABLE}:{k + 1}: строка без перевода')
        k = next((no for no, l in enumerate(lines[1:], 1) if l and '{' in l.split('\t')[1] and l.split('\t')[7] == 'машинный'), None)
        if k is None:
            bad.append('S10'); print('S10: в таблице нет переведённой строки с подстановкой — случай не поставить — РАСХОДИТСЯ')
        else:
            c = lines[k].split('\t'); c[3] = PH.sub('', c[3])
            open(tbl, 'w', encoding='utf-8').write('\n'.join(lines[:k] + ['\t'.join(c)] + lines[k + 1:]))
            case('S10 перевод потерял подстановку', 1, f'КРАСНОЕ {TABLE}:{k + 1}: подстановки th')
        open(tbl, 'w', encoding='utf-8').write('\n'.join(tbl_orig.split('\n')[1:]))
        case('S7 таблица без шапки', 2)
        open(tbl, 'w', encoding='utf-8').write(tbl_orig)
        with open(target, 'w', encoding='utf-8') as fh:
            # регулярка после «)» условия — предел разбора: читается как деление, и текст регулярки уходит в код
            fh.write(orig + "\nfunction svidetel41(x, y) { if (x) /Сбой «/.test(y); }\n")
        case('S8 разбор сбит (регулярка после «)»)', 2)
        with open(target, 'w', encoding='utf-8') as fh:
            fh.write(orig + f"\nfunction svidetel41(i) {{ var k = i++ / 2; var t = '{NEW}'; var z = k / 2; return t + z; }}\n")
        case('S11 деление после постфикса ++', 1, f'КРАСНОЕ js/20-ekrany-sluzhebnye.js:{nlines + 2}: текст без строки в {TABLE}: «{NEW}»')
        open(target, 'w', encoding='utf-8').write(orig)
        n_rows = len([l for l in tbl_orig.split('\n')[1:] if l])
        dead = '\t'.join(['t.deadbeef', NEW, 'Witness', 'พยาน', 'သက်သေ', 'js/20-ekrany-sluzhebnye.js:1', '', 'машинный'])
        open(tbl, 'w', encoding='utf-8').write(tbl_orig.rstrip('\n') + '\n' + dead + '\n')
        case('S12 строка без текста в коде', 1, f'КРАСНОЕ {TABLE}:{n_rows + 2}: строка без текста в коде [t.deadbeef]')
        open(tbl, 'w', encoding='utf-8').write(tbl_orig)
        case('S13 мёртвая строка снята', 0)
    finally:
        shutil.rmtree(w, ignore_errors=True)
    if bad:
        itog_samoproverki(1, f'разошлись: {", ".join(bad)}')
    itog_samoproverki(0)


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    flags = [a for a in argv if a.startswith('--')]
    root = os.path.abspath(args[0] if args else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    known = {'--собрать', '--список', '--самопроверка'}
    if len(args) > 1 or len(flags) > 1 or (flags and flags[0] not in known):
        itog(f'ПРОВЕРКА НЕ ВЫПОЛНЕНА: tools/{ME} [<дерево>] [{"|".join(sorted(known))}]', 2)
    flag = flags[0] if flags else ''
    if flag == '--самопроверка':
        try:
            samoproverka(root)
        except (Sboy, OSError) as e:
            itog_samoproverki(2, str(e))
    try:
        if flag == '--собрать':
            sys.exit(sobrat_v_tablicu(root))
        if flag == '--список':
            found, sv = sobrat(root)
            for x in found:
                print(f'{x["where"]}\t{x["screen"]}\t{x["text"]}')
            itog(svodka(sv, len(uniq_found(found))), 0)
        rc = sverit(root)
    except (Sboy, OSError, ValueError) as e:
        itog(f'ПРОВЕРКА НЕ ВЫПОЛНЕНА: {e}', 2)
    itog('ЗЕЛЁНОЕ: тексты кода все в таблице и переведены' if rc == 0 else 'КРАСНОЕ: текст без строки, строка без перевода или строка без текста в таблице', rc)


if __name__ == '__main__':
    main(sys.argv[1:])
