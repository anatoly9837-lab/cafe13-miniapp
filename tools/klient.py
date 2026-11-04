"""Клиент по index.html (Cafe13KPG#806) — близнец tools/klient.cjs.

Клиент — несколько обычных <script>, и ЕДИНСТВЕННЫЙ источник правды о составе и порядке — index.html.
Отдаёт files [(файл, текст)] в порядке подключения, склейку text и where(смещение) → «файл:строка».
Только локальные src, «?v=…» срезается, внешние пропускаются, vendor/ — сторонний код, не клиент.
Стражи — НеВыполнено: ноль скриптов клиента; файла из index.html нет; .js в js/ без ссылки из index.html (модуль-сирота).

Оба близнеца обязаны отдавать один перечень в одном порядке — сверка в воротах (форма frontend-11, 02.11.2026).
"""
import io
import os
import re
import sys
import json
import hashlib


class НеВыполнено(Exception):
    pass


def srcs_of(html):
    out = []
    for s in re.findall(r'<script\s+src="([^"]+)"', html):
        if re.match(r'^[a-z][a-z0-9+.-]*:', s, re.I) or s.startswith('//'):
            continue
        s = re.sub(r'[?#].*$', '', s)
        if s.startswith('vendor/'):
            continue
        out.append(s)
    return out


class Клиент:
    def __init__(self, files):
        self.files = files
        self.text = ''.join(t for _, t in files)
        self._starts = []
        off = 0
        for _, t in files:
            self._starts.append(off)
            off += len(t)

    def where(self, off):
        i = len(self._starts) - 1
        while i > 0 and self._starts[i] > off:
            i -= 1
        name, t = self.files[i]
        return f'{name}:{t[:off - self._starts[i]].count(chr(10)) + 1}'


def клиент(root):
    html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
    srcs = srcs_of(html)
    if not srcs:
        raise НеВыполнено('в index.html нет ни одного скрипта клиента')
    files = []
    for f in srcs:
        p = os.path.join(root, f)
        if not os.path.exists(p):
            raise НеВыполнено(f'index.html подключает «{f}», а файла нет')
        files.append((f, open(p, encoding='utf-8').read()))
    d = os.path.join(root, 'js')
    if os.path.isdir(d):
        orphans = sorted('js/' + f for f in os.listdir(d) if f.endswith('.js') and 'js/' + f not in srcs)
        if orphans:
            raise НеВыполнено('модуль-сирота: ' + ', '.join(orphans) + ' — в index.html не подключён')
    return Клиент(files)


# ── Слепки страницы (свежесть описи, Cafe13KPG#806) ──────────────────────────
# Опись — ОТРИСОВКА, а не код: на неё влияет всё, что грузит страница, —
# разметка, стиль, водяной знак, сторонний QR. Поэтому у свежести описи состав
# ШИРЕ, чем у `клиент()`: тот отдаёт только скрипты клиента (склейку для
# приборов кода), а здесь нужны ВСЕ ссылки разметки плюс сама разметка.
# ⚠ До #806 свежесть мерилась одним sha256 `app.js`, и правка `index.html`,
# `styles.css` или водяного знака опись НЕ ОБНОВЛЯЛА — страница печатала
# прежнее «видят», оставаясь зелёной. После разбивки тот признак умирает
# совсем: файла `app.js` нет, и чтение его дало бы «не выполнено».
ССЫЛКА = re.compile(r'\b(?:src|href)="([^"]*)"')
ОДИНАРНАЯ = re.compile(r"\b(?:src|href)='")
ВНЕ_ДЕРЕВА = '— вне дерева (сеть)'


def внешняя(ссылка):
    return bool(re.match(r'^[a-z][a-z0-9+.-]*:', ссылка, re.I)) or ссылка.startswith('//')


def слепки_страницы(читатель):
    """{файл: sha256} по index.html, прочитанному ЧИТАТЕЛЕМ, в порядке разметки.

    `читатель(путь) -> bytes | None` — чтобы один и тот же состав считался и по
    дереву, и по `git show`, и по выложенным Pages файлам. Своего списка файлов
    здесь нет НАРОЧНО: список разошёлся бы с тем, что грузит страница.

    Внешние (`https://…`, `//…`) входят строкой со значением `ВНЕ_ДЕРЕВА`:
    хешировать их нечем — они приходят по сети и в дерево не входят, — но
    пропасть или сменить адрес они могут, и это обязано быть видно."""
    сырьё = читатель('index.html')
    if not сырьё:
        raise НеВыполнено('index.html не прочитался — состав страницы взять негде')
    html = сырьё.decode('utf-8', 'replace')
    # ⚠ Признак видит только ДВОЙНЫЕ кавычки. Одинарные он пропустил бы МОЛЧА,
    # и файл выпал бы из слепков, оставив опись зелёной, — поэтому запрет
    # построением, а не пополнение шаблона.
    if ОДИНАРНАЯ.search(html):
        raise НеВыполнено('в index.html ссылка в ОДИНАРНЫХ кавычках — признак слепков '
                          'её не видит, и файл выпал бы из состава молча')
    карта = {'index.html': hashlib.sha256(сырьё).hexdigest()}
    for ссылка in ССЫЛКА.findall(html):
        if внешняя(ссылка):
            карта.setdefault(ссылка, ВНЕ_ДЕРЕВА)
            continue
        путь = re.sub(r'[?#].*$', '', ссылка)
        if not путь or путь in карта:
            continue
        байты = читатель(путь)
        if байты is None:
            raise НеВыполнено(f'index.html ссылается на «{путь}», а файла нет — '
                              'слепки страницы неполны')
        карта[путь] = hashlib.sha256(байты).hexdigest()
    # Сверка с близнецом ПО ТОМУ ЖЕ ФАЙЛУ: скрипты, которые видит `srcs_of`,
    # обязаны быть и в слепках. Разойдутся — значит один из двух признаков
    # разметки сломался, и молчать об этом нельзя.
    нет = [с for с in srcs_of(html) if с not in карта]
    if нет:
        raise НеВыполнено('скрипты клиента есть в составе, а в слепках их нет: '
                          + ', '.join(нет) + ' — признаки разметки разошлись')
    return карта


def свод(карта):
    """Одно сравнимое значение слепков — для трёхстороннего сличения описи.

    Меняется и от содержимого файла, и от СОСТАВА, и от его порядка: порядок
    подключения у клиента значащий (склейка), и переставленные файлы — другая
    страница."""
    return hashlib.sha256(''.join('%s %s\n' % (ф, з) for ф, з in карта.items())
                          .encode('utf-8')).hexdigest()


def читатель_дерева(корень):
    def читать(путь):
        п = os.path.join(корень, путь)
        return io.open(п, 'rb').read() if os.path.isfile(п) else None
    return читать


if __name__ == '__main__':
    # `python3 -I tools/klient.py <корень>` — перечень файлов JSON-ом (для сверки с близнецом на JS)
    # `--where`: для каждого файла — where() от смещения его ПЕРВОГО байта; у обоих близнецов обязано быть «файл:1»
    try:
        арг = [a for a in sys.argv[1:] if not a.startswith('--')]
        корень = арг[0] if арг else '.'
        if '--слепки' in sys.argv:
            # `--слепки`: карта файл→sha256 и свод — для сверки с близнецом на JS
            к = слепки_страницы(читатель_дерева(корень))
            print(json.dumps({'слепки': к, 'свод': свод(к)}, ensure_ascii=False,
                             separators=(',', ':'), sort_keys=False))
            raise SystemExit(0)
        к = клиент(корень)
        if '--where' in sys.argv:
            off, out = 0, []
            for _, t in к.files:
                out.append(к.where(off))
                off += len(t)
        else:
            out = [f for f, _ in к.files]
        print(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    except НеВыполнено as e:
        print('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + str(e), file=sys.stderr)
        sys.exit(2)
