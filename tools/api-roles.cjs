/* tools/api-roles.cjs — страж «какие роли api обход видимости НЕ обошёл».
 *
 * Обход tools/vidimost.cjs меряет ЖИВЫХ людей club_test (замер 27.10.2026),
 * и это его смысл — правило Cafe13KPG#871: строку о человеке ставит только
 * замер состава. Поэтому роли, которых у этих людей нет, не выдумываются, а
 * НАЗЫВАЮТСЯ: перечень берётся из кода api (снимок tools/api-roles.json, его
 * пишет tools/api-roles.py с sha api), и всё, что в нём не покрыто людьми,
 * печатается строкой «не обойдены» (Cafe13KPG#788).
 *
 * Приговоры:
 *   НЕ ВЫПОЛНЕНО — снимка нет, он не разбирается, отпечаток api пуст или не
 *     40 hex, перечень ролей пуст/с повтором, ИЛИ у людей обхода роль, которой
 *     в api нет (снимок или люди устарели — сверять нечем);
 *   иначе — список «не обойдены» (может быть и пустым; пустой — тоже ответ).
 * ⚠ Пустое значение отпечатка — НЕ успех: '' проходило бы любую проверку
 *   «поле есть». Проверяется форма, а не наличие.
 *
 *   node tools/api-roles.cjs --самопроверка   — 0 сошлась, 1 разошлась
 */
'use strict';
const fs = require('fs');

class NeVypolneno extends Error {}

function prochest(путь) {
  let сырьё;
  try { сырьё = fs.readFileSync(путь, 'utf8'); }
  catch (e) { throw new NeVypolneno(`снимок ролей api ${путь} не прочитан: ${e.code || e.message}`); }
  try { return JSON.parse(сырьё); }
  catch (e) { throw new NeVypolneno(`снимок ролей api ${путь} не разобрался: ${e.message}`); }
}

/* снимок — объект из api-roles.json; люди — [{имя, роли: [...]}].
   Возвращает {api_sha, источник, всего, обойдены, не_обойдены}. */
function proverit(снимок, люди) {
  if (!снимок || typeof снимок !== 'object')
    throw new NeVypolneno('снимок ролей api — не объект');
  const sha = снимок.api_sha;
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha))
    throw new NeVypolneno(`отпечаток api в снимке ролей не 40 hex: ${JSON.stringify(sha)}`);
  if (typeof снимок.источник !== 'string' || !снимок.источник.trim())
    throw new NeVypolneno('в снимке ролей нет источника (файл:строка миграции)');
  const роли = снимок.роли;
  if (!Array.isArray(роли) || !роли.length)
    throw new NeVypolneno('перечень ролей api пуст');
  if (роли.some((р) => typeof р !== 'string' || !р) || new Set(роли).size !== роли.length)
    throw new NeVypolneno('перечень ролей api с пустой или повторной ролью');
  const есть = new Set();
  for (const ч of люди) for (const р of ч.роли) есть.add(р);
  const чужие = [...есть].filter((р) => !роли.includes(р));
  if (чужие.length)
    throw new NeVypolneno(`у людей обхода роли, которых нет в api ${sha.slice(0, 12)}: ` +
                          чужие.join(', ') + ' — снимок ролей или люди устарели');
  return {
    api_sha: sha, источник: снимок.источник, всего: роли.length,
    обойдены: роли.filter((р) => есть.has(р)),
    не_обойдены: роли.filter((р) => !есть.has(р))
  };
}

function samoproverka() {
  const SHA = 'a'.repeat(40);
  const хор = { api_sha: SHA, источник: 'migrations/x.up.sql:1', роли: ['admin', 'curator', 'master'] };
  const люди = [{ имя: 'к', роли: ['curator'] }, { имя: 'в', роли: ['admin', 'admin'] }];
  const случаи = [
    ['контроль: всё сходится → не обойдён master', хор, люди, ['master']],
    ['все обойдены → пустой список, не отказ', хор,
     люди.concat([{ имя: 'м', роли: ['master'] }]), []],
    ['пустой отпечаток → НЕ ВЫПОЛНЕНО', { ...хор, api_sha: '' }, люди, 'отпечаток'],
    ['отпечаток короче 40 → НЕ ВЫПОЛНЕНО', { ...хор, api_sha: 'a'.repeat(12) }, люди, 'отпечаток'],
    ['отпечатка нет → НЕ ВЫПОЛНЕНО', { ...хор, api_sha: undefined }, люди, 'отпечаток'],
    ['пустой источник → НЕ ВЫПОЛНЕНО', { ...хор, источник: ' ' }, люди, 'источника'],
    ['пустой перечень → НЕ ВЫПОЛНЕНО', { ...хор, роли: [] }, люди, 'пуст'],
    ['повтор в перечне → НЕ ВЫПОЛНЕНО', { ...хор, роли: ['admin', 'admin', 'curator'] }, люди, 'повторной'],
    ['у людей роль вне api → НЕ ВЫПОЛНЕНО', { ...хор, роли: ['admin', 'master'] }, люди, 'curator']
  ];
  let плохо = 0;
  for (const [имя, сн, лю, ждём] of случаи) {
    let итог;
    try { итог = proverit(сн, лю).не_обойдены; } catch (e) {
      if (!(e instanceof NeVypolneno)) throw e;
      итог = 'НЕ ВЫПОЛНЕНО: ' + e.message;
    }
    const сошлось = Array.isArray(ждём)
      ? Array.isArray(итог) && итог.join() === ждём.join()
      : typeof итог === 'string' && итог.includes(ждём);
    console.log((сошлось ? '  сошлось: ' : '  РАЗОШЛОСЬ: ') + имя + ' → ' + JSON.stringify(итог));
    if (!сошлось) плохо++;
  }
  console.log(плохо ? `самопроверка: РАЗОШЛАСЬ (${плохо})` : 'самопроверка: сошлась');
  return плохо ? 1 : 0;
}

module.exports = { proverit, prochest, NeVypolneno };

if (require.main === module) {
  if (process.argv.includes('--самопроверка')) process.exit(samoproverka());
  console.log('запуск: node tools/api-roles.cjs --самопроверка');
  process.exit(2);
}
