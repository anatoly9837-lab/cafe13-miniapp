// Прибор на СВОЮ правку: вырезаю diffShape из живого файла и гоняю три исхода.
// Батарею целиком прогнать не могу (нет playwright), но логику, которую я
// изменил, проверить обязан — иначе я сдаю непроверенное.
const fs = require('fs');
const src = fs.readFileSync('/home/orca/projects/cafe13-miniapp/tools/live.cjs', 'utf8');
const start = src.indexOf('  function diffShape(');
if (start < 0) { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: diffShape не найден'); process.exit(2); }
// конец — по строке «    return out;\n  }» первой после начала
const endMark = '\n  }\n';
const end = src.indexOf(endMark, src.indexOf('Object.keys(stub).filter', start));
if (end < 0) { console.log('ПРОВЕРКА НЕ ВЫПОЛНЕНА: конец diffShape не найден'); process.exit(2); }
const body = src.slice(start, end + endMark.length);
let notes = [], USED = new Set(), UNVERIFIED = {};
const make = new Function('notesRef', 'USEDRef', 'UNVERIFIEDRef', `
  const notes = notesRef, USED = USEDRef, UNVERIFIED = UNVERIFIEDRef;
  ${body}
  return diffShape;`);
const diffShape = make(notes, USED, UNVERIFIED);

function run(label, real, stub, excl) {
  notes.length = 0; USED.clear();
  Object.keys(UNVERIFIED).forEach(k => delete UNVERIFIED[k]);
  Object.assign(UNVERIFIED, excl || {});
  const out = diffShape(real, stub, 'x', []);
  console.log(`${label}: красных ${out.length}, заметок ${notes.length}, USED ${USED.size}`);
  return { out, notes: notes.slice(), used: new Set(USED) };
}
const real = { a: null, b: null }, stubFull = { a: 1, b: 2 }, stubShort = { a: 1 };
const r1 = run('ключа нет, исключения нет   ', real, stubShort, {});
const r2 = run('ключа нет, исключение есть  ', real, stubShort, { 'x.b': 'причина, карточка #N' });
const r3 = run('ключ есть (контроль)        ', real, stubFull, {});
let bad = 0;
if (!(r1.out.length === 1 && /x\.b: нет в заглушке/.test(r1.out[0]))) { console.log('КРАСНОЕ: без исключения строка не та'); bad++; }
if (!(r2.out.length === 0 && r2.notes.length === 1 && r2.used.has('x.b'))) { console.log('КРАСНОЕ: исключение не сработало или не попало в USED'); bad++; }
if (r3.out.length !== 0 || r3.notes.length !== 0) { console.log('КРАСНОЕ: ложная тревога на здоровой заглушке'); bad++; }
console.log(bad ? `ИТОГ: расхождений ${bad}` : 'ИТОГ: три исхода совпали с ожиданием');
process.exit(bad ? 1 : 0);
