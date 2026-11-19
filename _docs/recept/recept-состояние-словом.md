# Как собрать экран: состояние словом

Вид над реестром (`tools/reestr-oblika.py`). Правка — в
`styles.css` и `_docs/oblik-roli.json`, не здесь.

⚠ Геометрия ниже — БАЗОВАЯ, из одиночного правила класса.
Доводка под место (`.card .chip`, `.listitem .grow`) в реестре
НЕ живёт: он берёт её только из одиночных правил. Отступ кнопки
отсюда не значит «везде такой» — внутри карточки он другой.

⚠ И это то, что НАПИСАНО в стилях, а не то, что видно на
отрисовке: без Golos Text подпись расходится на 3–6 px.

⚠ Путь экрана (кадр раньше кода, строка в реестре, снимок,
ворота) сюда НЕ переписан — он в СОСЕДНЕМ репозитории:
`Cafe13KPG`, файл `_docs/screen-path.md`.

## `.cancelled` — отменённое: зачёркнуто и приглушено
- токены: `--muted`, `--surface`
- базовая геометрия: своей нет

## `.chip` — признак предмета словом: уровень, состояние
- токены: `--accent`, `--gold`, `--ink`, `--muted`, `--paper`, `--surface`
- базовая геометрия: border: 1px solid var(--muted); border-radius: 8px; font-size: 12px; gap: 6px; padding: 5px 8px

## `.deny` — отказ с причиной, глиной
- токены: `--clay`, `--clay-ink`, `--deny-bg`
- базовая геометрия: border: 1px solid var(--clay); border-radius: 12px; gap: 10px; padding: 12px 14px

## `.grant` — выданная ответственность в строке
- токены: `--muted`, `--paper`, `--surface`
- базовая геометрия: border: 1px solid var(--muted); border-radius: 9px; gap: 10px; padding: 9px 12px

## `.pill` — плашка-признак у строки списка
- токены: `--clay`, `--clay-ink`, `--gold`, `--gold-ink`, `--line`, `--muted`, `--on-accent`, `--sage`
- базовая геометрия: border: 1px solid var(--line); border-radius: 5px; font-size: 11px; font-weight: 700; padding: 4px 8px

## `.sending` — идёт отправка, ответа ещё нет
- токены: `--muted`
- базовая геометрия: font-size: 12px

## `.st` — состояние строки словом
- токены: `--clay-ink`, `--muted`, `--sage`
- базовая геометрия: font-size: 12px; font-weight: 600

## `.till` — состояние кассовой строки
- токены: `--clay-ink`, `--muted`
- базовая геометрия: font-size: 12px; font-weight: 400
