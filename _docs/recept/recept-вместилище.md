# Как собрать экран: вместилище

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

## `.box` — ящик с пунктиром: место, которое ещё не заполнено
- токены: `--muted`
- базовая геометрия: своей нет

## `.card` — карточка — вместилище одной вещи
- токены: `--card`, `--clay`, `--clay-ink`, `--deny-bg`, `--ink`, `--line`, `--muted`, `--paper`, `--surface`
- базовая геометрия: border: 1px solid var(--line); border-radius: 12px; gap: 10px; padding: 14px 16px

## `.listitem` — плашка-меню: ведёт на другой экран
- токены: `--clay`, `--deny-bg`, `--ink`, `--muted`, `--paper`, `--sage`, `--surface`
- базовая геометрия: border: 1px solid var(--muted); border-radius: 12px; font-size: 15px; gap: 12px; padding: 13px 15px

## `.note` — заметка рядом с главным
- токены: `--muted`, `--paper`, `--surface`
- базовая геометрия: border-radius: 12px; gap: 10px; padding: 13px 14px

## `.paper` — лист: длинный текст на всю ширину
- токены: `--card`, `--line`, `--sab`, `--sat`
- базовая геометрия: border: 1px solid var(--line); border-radius: 12px; min-height: 360px

## `.rows` — ряды «подпись — значение» внутри карточки
- токены: `--line`, `--paper`, `--surface`
- базовая геометрия: border: 1px solid var(--line); border-radius: 12px; gap: 1px

## `.way` — дорога к действию: подсказка с входом
- токены: `--card`, `--muted`, `--surface`
- базовая геометрия: border: 1px solid var(--muted); border-radius: 12px; gap: 10px; padding: 12px
