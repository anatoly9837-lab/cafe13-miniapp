/* Выкладываемый app.js ходит на сервер: выключатель включён, и он один.
   Это единственное, чем живой клиент отличается от демонстрации, поэтому
   проверка падает, а не печатает.
     node tools/api-on.cjs            — по app.js рядом
     node tools/api-on.cjs <файл>     — по другому файлу (мутации) */
const fs = require('fs');
const file = process.argv[2] || __dirname + '/../app.js';
const src = fs.readFileSync(file, 'utf8');
// Любое объявление, с любым значением и пробелами: вторая строка с false
// ниже первой выключила бы клиент, а строгий шаблон её бы не увидел.
const all = src.match(/^\s*(var|let|const)\s+API_ON\s*=.*$/gm) || [];
const fail = m => { console.error('КРАСНОЕ: ' + m); process.exit(1); };
if (all.length === 0) fail('объявления API_ON в ' + file + ' нет');
if (all.length > 1) fail('объявлений API_ON ' + all.length + ', ждали одно: ' + all.map(s => s.trim()).join(' | '));
if (all[0].trim() !== 'var API_ON = true;') fail('выключатель не включён: «' + all[0].trim() + '»');
console.log('зелёное: var API_ON = true; — одна строка');
