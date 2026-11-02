"""Клиент по index.html (Cafe13KPG#806) — близнец tools/klient.cjs.

Клиент — несколько обычных <script>, и ЕДИНСТВЕННЫЙ источник правды о составе и порядке — index.html.
Отдаёт files [(файл, текст)] в порядке подключения, склейку text и where(смещение) → «файл:строка».
Только локальные src, «?v=…» срезается, внешние пропускаются, vendor/ — сторонний код, не клиент.
Стражи — НеВыполнено: ноль скриптов клиента; файла из index.html нет; .js в js/ без ссылки из index.html (модуль-сирота).

Оба близнеца обязаны отдавать один перечень в одном порядке — сверка в воротах (форма frontend-11, 02.11.2026).
"""
import os
import re
import sys
import json


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


if __name__ == '__main__':
    # `python3 -I tools/klient.py <корень>` — перечень файлов JSON-ом (для сверки с близнецом на JS)
    try:
        print(json.dumps([f for f, _ in клиент(sys.argv[1] if len(sys.argv) > 1 else '.').files], ensure_ascii=False, separators=(',', ':')))
    except НеВыполнено as e:
        print('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + str(e), file=sys.stderr)
        sys.exit(2)
