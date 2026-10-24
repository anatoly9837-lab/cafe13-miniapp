/* Страж номеров людей: репозиторий ПУБЛИЧНЫЙ, а tg_user_id живого человека —
   это его Telegram. Настоящие номера живут только в приватных репозиториях
   (Cafe13KPG, cafe13-api); здесь — выдуманные из общей фикстуры.

   Проверка РАЗРЕШАЮЩАЯ, а не поиск известного: краснеет любая цепочка из
   7+ цифр, которой нет в списке ниже. Поиск по известным номерам пропустил
   бы как раз тот, о котором не знали. 7, а не 8, как в api
   (tools/check-dumps-clean.sh): у ранних аккаунтов Telegram номер короче
   восьми знаков, а кассир с правами вносит ровно такие.

   Запуск сам по себе: node tools/ids-clean.cjs [корень], код 0 — чисто,
   1 — нашлось, 2 — проверить нечем. Батарея (live.cjs) зовёт его в конце. */

const fs = require('fs');
const path = require('path');

// Каждое число — с причиной: список без причин разрастается молча.
const ALLOW = {
  '86400000': 'миллисекунд в сутках',
  '1103515245': 'множитель генератора псевдослучайных (app.js)',
  '2147483648': '2^31, модуль того же генератора',
  '1760000000': 'auth_date в выдуманной initData (live.cjs)',
  '1766000000000': 'время числом — случай spisok-vremya-chislom (live.cjs)',
  '6332425': 'sha коммита cafe13-api в комментарии (live.cjs)',
};
// Общая фикстура людей у api и клиента: 200000001…200000014.
for (let i = 1; i <= 14; i++) ALLOW[String(2e8 + i)] = 'выдуманный человек общей фикстуры';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor']);
const TEXT = /\.(js|cjs|mjs|json|html|css|md|py|sh|txt|svg)$/i;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (TEXT.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

// → строки «файл:строка: число — …» про каждое неразрешённое число.
function idsClean(root) {
  const files = walk(root, []);
  if (!files.length) throw new Error('в ' + root + ' нет ни одного текстового файла — проверять нечего');
  const bad = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?<![0-9])[0-9]{7,}(?![0-9])/g)) {
        if (!ALLOW[m[0]]) bad.push(`${path.relative(root, f)}:${i + 1}: число ${m[0]} не в разрешённом списке tools/ids-clean.cjs — номер человека в публичный репозиторий не кладём; если это не человек, внесите в список с причиной`);
      }
    });
  }
  return bad;
}

module.exports = { idsClean };

if (require.main === module) {
  let bad;
  try { bad = idsClean(process.argv[2] || path.join(__dirname, '..')); }
  catch (e) { console.log('ids-clean: проверка НЕ ВЫПОЛНЕНА — ' + e.message); process.exit(2); }
  if (bad.length) { console.log('КРАСНОЕ:\n' + bad.join('\n')); process.exit(1); }
  console.log('ids-clean: чисто');
}
