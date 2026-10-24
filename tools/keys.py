# -*- coding: utf-8 -*-
"""Форма настоящих ответов сервера — для сверки заглушек tools/live.cjs.

Снимки пишет cafe13-api: DUMP_DIR=<каталог> bash tools/check-api.sh.
В них настоящие данные (Telegram id владельца, код пропуска), а этот
репозиторий публичный, поэтому сюда попадает ТОЛЬКО форма: имена ключей и
вложенность, без единого значения. Путь запроса — без чисел (в нём id).

Снимок с отказом выглядит как валидный файл: статус не 200/201 — отказ
целиком, иначе заглушка сверилась бы с ответом «нельзя».

  python3 -I tools/keys.py <DUMP_DIR> > tools/api-keys.json
"""
import json, os, re, sys


def shape(v):
    if isinstance(v, dict):
        return {k: shape(v[k]) for k in sorted(v)}
    if isinstance(v, list):
        # форма списка — объединение форм всех элементов (merge), а не первого
        out = None
        for x in v:
            out = shape(x) if out is None else merge(out, shape(x))
        return [out] if out is not None else []
    return None


def merge(a, b):
    """Объединение двух форм. Ключ, который есть не в обеих, попадает в '?':
    у работника sum есть только в его собственном заказе, и объединение без
    пометки спрятало бы, что в чужих строках его нет."""
    if isinstance(a, dict) and isinstance(b, dict):
        ka, kb = set(a) - {'?'}, set(b) - {'?'}
        out = {k: merge(a[k], b[k]) if k in a and k in b else (a.get(k) if k in a else b.get(k))
               for k in sorted(ka | kb)}
        opt = set(a.get('?', [])) | set(b.get('?', [])) | (ka ^ kb)
        if opt:
            out['?'] = sorted(opt)
        return out
    if isinstance(a, list) and isinstance(b, list):
        if not a or not b:
            return a or b
        return [merge(a[0], b[0])]
    return a if a is not None else b


def main(src):
    out, bad = {}, []
    for name in sorted(os.listdir(src)):
        if not name.endswith('.json'):
            continue
        with open(os.path.join(src, name), encoding='utf-8') as f:
            d = json.load(f)
        st = d.get('status')
        if not isinstance(st, int):
            bad.append('%s: статус %r — не число, снимок испорчен' % (name, st))
            continue
        req = d.get('request') or {}
        out[name[:-5]] = {
            'status': st,
            'request': '%s %s' % (req.get('method'), re.sub(r'\d+', 'N', str(req.get('path')))),
            'shape': shape(d.get('body')),
        }
    if bad:
        sys.exit('снимки с испорченным статусом:\n  ' + '\n  '.join(bad))
    if not out:
        sys.exit('в %s нет снимков' % src)
    # ⚠ ОТКАЗЫ ИДУТ В ФАЙЛ СО СВОИМ СТАТУСОМ, а не отбрасываются. Прежняя
    # редакция падала на первом же снимке с кодом не 200/201 — и после
    # 22.10.2026, когда снимки стали включать отказы (409 «место занято»,
    # 403 гостю, 422 на перечне, 404 без рецепта), файл перестал
    # пересобираться ВОВСЕ: он простоял с 20.10 на 23 ручках против 39
    # успешных снимков, и клиент сверял заглушки с формой из прошлого.
    # Молчания не заметил никто, потому что падение было в генераторе, а не
    # в батарее.
    #
    # Отбрасывать отказы нельзя и по второй причине: клиент печатает
    # `detail` дословно, а форма у него РАЗНАЯ — строка у 403/409 и СПИСОК
    # объектов у 422. Это ровно то, что снимок обязан показывать.
    #
    # Защиту «заглушка не сверяется с отказом» держит потребитель
    # (`tools/live.cjs`: статус не 200/201 → «снимок — отказ»), поэтому
    # наличие отказов в файле её не ослабляет.
    otkazy = sorted(k for k, v in out.items() if v['status'] not in (200, 201))
    sys.stderr.write('снимков %d: успешных %d, отказов %d%s\n' % (
        len(out), len(out) - len(otkazy), len(otkazy),
        (' (' + ', '.join(otkazy) + ')') if otkazy else ''))
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main(sys.argv[1])
