# Как собрать экран: действие

Вид над реестром (`tools/reestr-oblika.py`). Правка — в
`styles.css` и `_docs/oblik-roli.json`, не здесь.

⚠ Геометрия ниже — БАЗОВАЯ, из одиночного правила класса.
Доводка под место (`.card .chip`, `.listitem .grow`) в реестре
НЕ живёт: он берёт её только из одиночных правил. Отступ кнопки
отсюда не значит «везде такой» — внутри карточки он другой.

⚠ И это то, что НАПИСАНО в стилях, а не то, что видно на
отрисовке: без Golos Text подпись расходится на 3–6 px.

⚠ Путь экрана (кадр раньше кода, строка в реестре, снимок,
ворота) сюда НЕ переписан — он в `_docs/screen-path.md`.

## `.btn` — действие — главное и тихое, вид решает вариант
- токены: `--accent`, `--accent-ink`, `--ink`, `--muted`, `--surface`
- базовая геометрия: border: none; border-radius: 11px; font-size: 15px; font-weight: 700; gap: 9px; min-height: 50px; padding: 0 16px

## `.icon-btn` — действие значком, без слова (назад, закрыть)
- токены: `--ink`, `--surface`
- базовая геометрия: border: none; border-radius: 10px

## `.outbtn` — действие снятия в строке человека
- токены: `--clay`, `--muted`, `--paper`
- базовая геометрия: border: 1px solid var(--muted); border-radius: 8px; font-size: 12px; font-weight: 700; padding: 5px 8px

## `.round` — действие кружком в строке: да, нет, отмена
- токены: `--card`, `--ink`, `--muted`, `--sage`
- базовая геометрия: border: 0; border-radius: 50%

## `.undo` — отмена только что сделанного
- токены: `--ink`, `--muted`, `--paper`, `--surface`
- базовая геометрия: border-radius: 10px; gap: 10px; padding: 8px 10px 8px 12px
