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
        if d.get('status') not in (200, 201):
            bad.append('%s: статус %r' % (name, d.get('status')))
            continue
        req = d.get('request') or {}
        out[name[:-5]] = {
            'status': d['status'],
            'request': '%s %s' % (req.get('method'), re.sub(r'\d+', 'N', str(req.get('path')))),
            'shape': shape(d.get('body')),
        }
    if bad:
        sys.exit('снимки с отказом вместо ответа:\n  ' + '\n  '.join(bad))
    if not out:
        sys.exit('в %s нет снимков' % src)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main(sys.argv[1])
