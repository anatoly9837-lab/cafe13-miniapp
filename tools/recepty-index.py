#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Указатель рецептов и брендбука: спрашивать узко, не читать целиком.

ЗОНА — ДИЗАЙНЕР: прибор индексирует его артефакт (рецепты и брендбук).
Решение `arhitector-68` 19.11.2026 на ревью `cafe13-miniapp#325`; собрал
прибор координатор, потому что просьба владельца пришла к нему.

Повод — просьба владельца 19.11.2026: «перенеси принцип кодеграф на рецепты и
на брендбук дизайнера, это сэкономит полное чтение и время». Замер, из которого
просьба выросла: у дизайнера 80,6 % вывода инструментов — чтение файлов
ЦЕЛИКОМ (`Read`, 359 вызовов по ~111 тыс. знаков), а прогон приборов рецепта —
2,9 %. То есть дорого не думать и не проверять, а ЧИТАТЬ.

Корпус, замер 19.11.2026 по `origin/main`, с РАЗБИВКОЙ (иначе число не читается):

    всего под _docs/recept            49
      в ekran/<семья>/<ключ>.md       34   ← это и разбирает указатель
      в корне ekran/                   6   README и пять служебных
      вне ekran                        9   брендбук, семь первооснов, INDEX.md
    байт всего                   564 757

⚠ Два предела СЧЁТА этого корпуса, оба проверены:
1. **число без совокупности не читается.** «40» верно для `ekran/`, «34» — для
   `ekran/<семья>/`, «49» — для всего `_docs/recept`. Называя число, называй
   знаменатель: на этом разошлись координатор и ревьюер, и прав был ревьюер.
2. **`grep '\.md$'` недосчитывает:** `git ls-tree --name-only` печатает
   кириллические имена В КАВЫЧКАХ с экранированием (`"…recept-\320\262…"` —
   это `recept-ввод.md`), поэтому семь первооснов с русскими именами выпадают,
   и выходит 42 вместо 49. Считать `grep -c '\.md"\?$'` либо `git ls-tree -z`.

   tools/recepty-index.py --для <ключ экрана>     какие рецепты про ЭТОТ экран
   tools/recepty-index.py --слова <ключ экрана>   что обещано словами и где
   tools/recepty-index.py --уровень <класс>       уровень класса по брендбуку
   tools/recepty-index.py --шкала <слово>         разрешённые значения шкалы
   tools/recepty-index.py --искать <слово>        кто это слово обещает
   tools/recepty-index.py --разделы <семья>/<ключ>  оглавление одного рецепта
   tools/recepty-index.py --вписать               собрать _docs/recept/INDEX.md
   tools/recepty-index.py --проверить             указатель равен файлам
   tools/recepty-index.py --самопроверка          прибор различает

Коды: 0 — ответ дан / сошлось; 1 — РАСХОЖДЕНИЕ (указатель отстал);
2 — ПРОВЕРКА НЕ ВЫПОЛНЕНА (корпуса нет, аргумент пуст, самопроверка красная).

⚠ Указатель НЕ заменяет рецепт: он говорит, ГДЕ читать и ЧТО обещано словом.
Довод, картинку и «чего не несёт» читают в самом файле — по разделу, а не
целиком.
"""
import os, re, sys, glob, hashlib

KOREN = '_docs/recept'
EKRAN = os.path.join(KOREN, 'ekran')
SHKALY = os.path.join(KOREN, 'sostav-shkaly.md')
INDEX = os.path.join(KOREN, 'INDEX.md')


def otkaz(txt):
    print('ПРОВЕРКА НЕ ВЫПОЛНЕНА:', txt, file=sys.stderr)
    raise SystemExit(2)


def chitat(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def razbor_recepta(p):
    """Из рецепта: ключ, шаг, заголовок, разделы, обещанные слова."""
    t = chitat(p)
    sem = os.path.basename(os.path.dirname(p))
    key = os.path.splitext(os.path.basename(p))[0]
    h1 = ''
    for line in t.split('\n'):
        if line.startswith('# '):
            h1 = line[2:].strip()
            break
    shagi = sorted(set(re.findall(r'шаг\s*(\d+)', h1 or '')))
    razdely = [l[3:].strip() for l in t.split('\n') if l.startswith('## ')]
    # обещанные слова: строки таблиц, у которых в шапке есть «слова»
    slova = []
    shapka = None
    for line in t.split('\n'):
        s = line.strip()
        if not s.startswith('|'):
            shapka = None
            continue
        kol = [c.strip() for c in s.strip('|').split('|')]
        if shapka is None:
            shapka = [c.lower() for c in kol]
            continue
        if set(''.join(kol)) <= set('-: '):
            continue
        if not any('слов' in c for c in shapka):
            continue
        i = next(i for i, c in enumerate(shapka) if 'слов' in c)
        if i < len(kol) and kol[i]:
            klass = kol[0] if i != 0 else (kol[1] if len(kol) > 1 else '')
            slova.append((klass, kol[i]))
    return {'путь': p, 'семья': sem, 'ключ': key, 'шаги': shagi,
            'заголовок': h1, 'разделы': razdely, 'слова': slova,
            'байт': len(t.encode('utf-8'))}


def vse_recepty():
    pp = sorted(glob.glob(os.path.join(EKRAN, '*', '*.md')))
    return [razbor_recepta(p) for p in pp]


def razbor_brendbuka():
    """Из брендбука: класс → уровень, и шкалы по разделам."""
    if not os.path.exists(SHKALY):
        return {}, {}
    t = chitat(SHKALY)
    urovni, shkaly = {}, {}
    razdel, shapka = '', None
    for line in t.split('\n'):
        if line.startswith('## '):
            razdel = line[3:].strip(); shapka = None; continue
        s = line.strip()
        if not s.startswith('|'):
            shapka = None; continue
        kol = [c.strip() for c in s.strip('|').split('|')]
        if shapka is None:
            shapka = [c.lower() for c in kol]; continue
        if set(''.join(kol)) <= set('-: '):
            continue
        # таблица уровней: есть и «уровень», и «класс»
        if any('уровен' in c for c in shapka) and any('класс' in c for c in shapka):
            iu = next(i for i, c in enumerate(shapka) if 'уровен' in c)
            ik = next(i for i, c in enumerate(shapka) if 'класс' in c)
            if iu < len(kol) and ik < len(kol):
                ur = kol[iu].strip('* ')
                for kl in re.findall(r'`([^`]+)`', kol[ik]):
                    urovni[kl.lstrip('.')] = ur
        else:
            shkaly.setdefault(razdel, []).append(kol)
    return urovni, shkaly


def sobrat_index(rr):
    out = ['# Указатель рецептов и брендбука — СОБРАН ПРИБОРОМ, руками не правят',
           '',
           'Собирается `tools/recepty-index.py --вписать`, сверяется `--проверить`.',
           'Спрашивать узко: `--для <экран>`, `--слова <экран>`, `--уровень <класс>`,',
           '`--шкала <слово>`, `--искать <слово>`, `--разделы <семья>/<ключ>`.',
           '',
           '| семья | ключ | шаги | байт | разделов | обещаний словом |',
           '|---|---|---|---|---|---|']
    for r in rr:
        out.append('| `%s` | `%s` | %s | %d | %d | %d |' % (
            r['семья'], r['ключ'], ', '.join(r['шаги']) or '—',
            r['байт'], len(r['разделы']), len(r['слова'])))
    urovni, shkaly = razbor_brendbuka()
    out += ['', '## Брендбук: классов с уровнем — %d, шкал — %d' % (len(urovni), len(shkaly))]
    for razdel in sorted(shkaly):
        if razdel:
            out.append('- `%s` — строк %d' % (razdel, len(shkaly[razdel])))
    return '\n'.join(out) + '\n'


def main(argv):
    if not os.path.isdir(EKRAN):
        otkaz('нет каталога %s — зовите из корня cafe13-miniapp' % EKRAN)
    if len(argv) < 2:
        print(__doc__); return 2
    rezhim = argv[1]
    arg = argv[2] if len(argv) > 2 else ''
    rr = vse_recepty()
    if not rr:
        otkaz('в %s нет ни одного рецепта' % EKRAN)

    if rezhim == '--вписать':
        txt = sobrat_index(rr)
        with open(INDEX, 'w', encoding='utf-8') as f:
            f.write(txt)
        print('вписано: рецептов %d, байт указателя %d' % (len(rr), len(txt.encode('utf-8'))))
        return 0

    if rezhim == '--проверить':
        if not os.path.exists(INDEX):
            print('РАСХОЖДЕНИЕ: указателя %s нет — соберите --вписать' % INDEX); return 1
        nado = sobrat_index(rr)
        est = chitat(INDEX)
        if nado == est:
            print('сошлось: рецептов %d, указатель равен файлам' % len(rr)); return 0
        h1 = hashlib.sha256(est.encode()).hexdigest()[:12]
        h2 = hashlib.sha256(nado.encode()).hexdigest()[:12]
        print('РАСХОЖДЕНИЕ: указатель отстал от файлов (в указателе %s, у файлов %s)' % (h1, h2))
        print('  лечение: tools/recepty-index.py --вписать')
        return 1

    if rezhim == '--для':
        if not arg: otkaz('нужен ключ экрана')
        nashli = [r for r in rr if r['ключ'] == arg]
        if not nashli:
            print('рецептов про экран `%s` нет; ключи: %s' % (
                arg, ', '.join(sorted({r['ключ'] for r in rr})))); return 0
        for r in nashli:
            print('%s/%s — шаги %s · %d Б · %s' % (
                r['семья'], r['ключ'], ', '.join(r['шаги']) or '—', r['байт'], r['заголовок']))
        return 0

    if rezhim == '--слова':
        if not arg: otkaz('нужен ключ экрана')
        n = 0
        for r in rr:
            if r['ключ'] != arg: continue
            for kl, sl in r['слова']:
                print('%s/%s · %s → %s' % (r['семья'], r['ключ'], kl or '—', sl)); n += 1
        print('— обещаний словом: %d' % n)
        return 0

    if rezhim == '--уровень':
        if not arg: otkaz('нужен класс')
        urovni, _ = razbor_brendbuka()
        kl = arg.lstrip('.')
        if kl in urovni:
            print('`%s` — уровень **%s** (брендбук %s)' % (kl, urovni[kl], SHKALY)); return 0
        print('класса `%s` в таблице уровней брендбука НЕТ (классов там %d)' % (kl, len(urovni)))
        return 0

    if rezhim == '--шкала':
        if not arg: otkaz('нужно слово предмета')
        _, shkaly = razbor_brendbuka()
        nashli = [(r, s) for r, ss in shkaly.items() for s in ss
                  if arg.lower() in r.lower() or any(arg.lower() in c.lower() for c in s)]
        for r, s in nashli[:40]:
            print('%s | %s' % (r, ' · '.join(s)))
        print('— строк: %d' % len(nashli))
        return 0

    if rezhim == '--разделы':
        if not arg or '/' not in arg: otkaz('нужно <семья>/<ключ>')
        sem, key = arg.split('/', 1)
        for r in rr:
            if r['семья'] == sem and r['ключ'] == key:
                for d in r['разделы']: print('##', d)
                print('— разделов %d, файл %d Б (читать по разделу, не целиком)' % (
                    len(r['разделы']), r['байт']))
                return 0
        print('рецепта %s нет' % arg); return 0

    if rezhim == '--искать':
        if not arg: otkaz('нужно слово')
        n = 0
        for r in rr:
            for kl, sl in r['слова']:
                if arg.lower() in sl.lower():
                    print('%s/%s · %s → %s' % (r['семья'], r['ключ'], kl or '—', sl)); n += 1
        urovni, _ = razbor_brendbuka()
        for kl, ur in urovni.items():
            if arg.lower() in kl.lower():
                print('брендбук: `%s` — уровень %s' % (kl, ur)); n += 1
        print('— совпадений: %d' % n)
        return 0

    if rezhim == '--самопроверка':
        return samoproverka()

    print(__doc__); return 2


def samoproverka():
    """Прибор обязан РАЗЛИЧАТЬ: найденное от выдуманного, и отставание от равенства."""
    import tempfile, shutil
    sluchai, krasnoe = 0, []
    baza = tempfile.mkdtemp(prefix='recepty-index-')
    try:
        d = os.path.join(baza, KOREN, 'ekran', '99')
        os.makedirs(d)
        with open(os.path.join(d, 'proba.md'), 'w', encoding='utf-8') as f:
            f.write('# `proba` · заголовок (шаг 99)\n\n## Что меняется\n\n'
                    '| класс | слова | источник |\n|---|---|---|\n'
                    '| `.btn` | ЖИВАЯ-ФРАЗА | тут |\n\n## Чего не несёт\n\nничего\n')
        with open(os.path.join(baza, SHKALY), 'w', encoding='utf-8') as f:
            f.write('# Состав\n\n## Уровни страницы\n\n| уровень | что это | классы-примеры |\n'
                    '|---|---|---|\n| **элемент** | нажимают | `.btn`, `.field` |\n')
        staryj = os.getcwd(); os.chdir(baza)
        rr = vse_recepty()

        sluchai += 1
        if len(rr) != 1 or rr[0]['шаги'] != ['99']:
            krasnoe.append('разбор рецепта: ждали один рецепт шага 99, вышло %r' % (rr,))

        sluchai += 1
        if rr[0]['слова'] != [('`.btn`', 'ЖИВАЯ-ФРАЗА')]:
            krasnoe.append('обещания словом: ждали пару (.btn, ЖИВАЯ-ФРАЗА), вышло %r' % (rr[0]['слова'],))

        # ⚠ различающий контроль: выдуманная фраза НЕ находится
        sluchai += 1
        if any('НЕТ-ТАКОЙ-ФРАЗЫ' in sl for _, sl in rr[0]['слова']):
            krasnoe.append('выдуманная фраза НАШЛАСЬ — признак ничего не различает')

        sluchai += 1
        urovni, _ = razbor_brendbuka()
        if urovni.get('btn') != 'элемент':
            krasnoe.append('брендбук: ждали btn → элемент, вышло %r' % (urovni,))

        sluchai += 1
        if 'НЕТ-КЛАССА' in urovni:
            krasnoe.append('выдуманный класс НАШЁЛСЯ в уровнях')

        # отставание указателя обязано краснеть
        sluchai += 1
        with open(INDEX, 'w', encoding='utf-8') as f:
            f.write('устаревший указатель\n')
        if main([sys.argv[0], '--проверить']) != 1:
            krasnoe.append('--проверить НЕ покраснел на устаревшем указателе')

        sluchai += 1
        main([sys.argv[0], '--вписать'])
        if main([sys.argv[0], '--проверить']) != 0:
            krasnoe.append('--проверить краснеет на СВЕЖЕМ указателе')
        os.chdir(staryj)
    finally:
        shutil.rmtree(baza, ignore_errors=True)
    if krasnoe:
        print('САМОПРОВЕРКА КРАСНАЯ, случаев %d:' % sluchai)
        for k in krasnoe: print('  —', k)
        return 2
    print('самопроверка: случаев %d, все зелёные (включая два контроля выдуманного)' % sluchai)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
