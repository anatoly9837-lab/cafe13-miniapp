# -*- coding: utf-8 -*-
"""Снимок перечня ролей людей из кода cafe13-api — для стража tools/api-roles.cjs.

Источник — миграции api, а не база: последнее по имени `*.up.sql`, где стоит
`CHECK (role IN (...))` с ролью 'admin' (это ограничение роли ЧЕЛОВЕКА; у
счетов клуба и выплат свои CHECK без 'admin', они сюда не берутся).
Читается коммит, а не рабочее дерево: `git show <sha>:<путь>` — чтобы sha в
снимке был тем, с чего снято, а не «примерно оттуда» (Cafe13KPG#788).

  python3 -I tools/api-roles.py <клон cafe13-api> <sha> > ~/.cache/roles.tmp; rc=$?
  [ $rc -eq 0 ] && [ -s ~/.cache/roles.tmp ] && mv ~/.cache/roles.tmp tools/api-roles.json

⚠ При отказе вывод ПУСТ и код 2: `>` прямо в tools/api-roles.json затёр бы
снимок пустым файлом — поэтому через временный.
"""
import json, re, subprocess, sys

ROLE_CHECK = re.compile(r"CHECK\s*\(\s*role\s+IN\s*\(([^)]*)\)\s*\)", re.S)


def отказ(текст):
    sys.stderr.write('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + текст + '\n')
    sys.exit(2)


def git(api, *доводы):
    r = subprocess.run(['git', '-C', api] + list(доводы), capture_output=True)
    if r.returncode != 0:
        отказ('git ' + ' '.join(доводы) + ': ' +
              r.stderr.decode('utf-8', 'replace').strip())
    return r.stdout.decode('utf-8')


def main(доводы):
    if len(доводы) != 2:
        отказ('нужно два довода: <клон cafe13-api> <sha>')
    api, sha = доводы
    полный = git(api, 'rev-parse', '--verify', sha + '^{commit}').strip()
    if not re.fullmatch(r'[0-9a-f]{40}', полный):
        отказ(f'sha не разобрался: {полный!r}')
    файлы = sorted(п for п in git(api, 'ls-tree', '-r', '--name-only', полный,
                                   'migrations/').split('\n')
                   if п.endswith('.up.sql'))
    if not файлы:
        отказ(f'в {полный[:12]} нет migrations/*.up.sql')
    найдено = None
    for п in файлы:
        текст = git(api, 'show', f'{полный}:{п}')
        for m in ROLE_CHECK.finditer(текст):
            роли = re.findall(r"'([^']*)'", m.group(1))
            if 'admin' in роли:
                строка = текст.count('\n', 0, m.start()) + 1
                найдено = (п, строка, роли)
    if not найдено:
        отказ('CHECK (role IN (...)) с ролью admin не нашёлся ни в одной миграции')
    п, строка, роли = найдено
    if len(set(роли)) != len(роли) or '' in роли:
        отказ(f'{п}:{строка}: роли с повтором или пустая: {роли}')
    print(json.dumps({'api_sha': полный, 'источник': f'{п}:{строка}',
                      'роли': роли}, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
