/* Выкладываемый клиент ходит на сервер: выключатель включён, и он один — во ВСЕХ файлах клиента вместе.
   Это единственное, чем живой клиент отличается от демонстрации, поэтому
   проверка падает, а не печатает.
     node tools/api-on.cjs            — по клиенту рядом: склейка файлов в порядке index.html (Cafe13KPG#806)
     node tools/api-on.cjs <файл>     — по другому файлу (мутации) */
const fs = require('fs');
const file = process.argv[2] || null;
let src;
if (file) src = fs.readFileSync(file, 'utf8');
else {
  // второе объявление в ДРУГОМ файле перекрыло бы первое так же, как в одном: область у <script> общая
  try { src = require('./klient.cjs').klient(__dirname + '/..').text; }
  catch (e) { console.error('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + e.message); process.exit(2); }
}
// Любое объявление, с любым значением и пробелами: вторая строка с false
// ниже первой выключила бы клиент, а строгий шаблон её бы не увидел.
const all = src.match(/^\s*(var|let|const)\s+API_ON\s*=.*$/gm) || [];
const fail = m => { console.error('КРАСНОЕ: ' + m); process.exit(1); };
if (all.length === 0) fail('объявления API_ON в ' + (file || 'клиенте') + ' нет');
if (all.length > 1) fail('объявлений API_ON ' + all.length + ', ждали одно: ' + all.map(s => s.trim()).join(' | '));
if (all[0].trim() !== 'var API_ON = true;') fail('выключатель не включён: «' + all[0].trim() + '»');
console.log('зелёное: var API_ON = true; — одна строка');
