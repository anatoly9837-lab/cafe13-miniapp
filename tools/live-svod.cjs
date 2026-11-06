#!/usr/bin/env node
// СВОДКА ЧАСТЕЙ БАТАРЕИ (Cafe13KPG#912):  node tools/live-svod.cjs <часть-1.json> <часть-2.json>
//
// tools/live.cjs под `ONLY=1/2` и `ONLY=2/2` гоняет каждый свою половину случаев и пишет свидетельство в
// ONLY_OUT. Здесь судится то, что одна часть судить не может по построению:
//   • каждая часть прошла РОВНО свои случаи, вместе — все, и ни один дважды (иначе «зелёное» обеих частей
//     ничего не говорит о случае, который не прошёл никто);
//   • обе части — один и тот же live.cjs (отпечаток файла);
//   • реестр LATE_STUBS по объединению — ровно LATE_WANT (под частью его блоки в разных частях).
// Красное частей здесь НЕ повторяется — его печатает и код возврата несёт сама часть; ворота держат все три кода.
//
// Коды: 0 — сводка сошлась; 1 — КРАСНОЕ; 2 — ПРОВЕРКА НЕ ВЫПОЛНЕНА (нет свидетельства, оно битое).
'use strict';
const fs = require('fs');

const die = m => { console.error('ПРОВЕРКА НЕ ВЫПОЛНЕНА: ' + m); process.exit(2); };
const files = process.argv.slice(2);
if (files.length !== 2) die('нужны ровно два свидетельства частей: tools/live-svod.cjs <часть-1.json> <часть-2.json>');
const parts = files.map(f => {
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { die(`свидетельство части «${f}» не прочитано (${e.code || e.message}) — часть не дошла до конца или не звалась`); }
  for (const k of ['only', 'src', 'sites', 'run', 'off', 'late', 'late_want', 'skipped', 'notes'])
    if (!(k in j)) die(`в свидетельстве «${f}» нет поля ${k}`);
  return j;
});
const [a, b] = parts.slice().sort((x, y) => x.only.localeCompare(y.only));
if (a.only !== '1/2' || b.only !== '2/2') die(`части ${a.only} и ${b.only} — ждали 1/2 и 2/2`);
if (a.src !== b.src) die('части гнали РАЗНЫЕ live.cjs (отпечатки файла разошлись) — их объединение ни о чём');

const bad = [];
if (a.sites !== b.sites) bad.push(`части насчитали разное число случаев: ${a.sites} и ${b.sites}`);
const all = Array.from({ length: a.sites }, (_, i) => i + 1);
const runA = new Set(a.run), runB = new Set(b.run);
const twice = a.run.filter(n => runB.has(n));
const nobody = all.filter(n => !runA.has(n) && !runB.has(n));
if (twice.length) bad.push(`случаи №${twice.join(', ')} прошли ОБЕ части`);
if (nobody.length) bad.push(`случаи №${nobody.join(', ')} не прошла НИ ОДНА часть`);
// своё «прошла» и чужое «не прошла» обязаны быть одним списком: иначе часть врёт о себе
const same = (x, y) => x.length === y.length && x.every((n, i) => n === y[i]);
if (!same(a.run, b.off) || !same(b.run, a.off)) bad.push('«прошла» одной части не совпало с «пропустила» другой');

const late = [...new Set([...a.late, ...b.late])];
if (a.late_want !== b.late_want) bad.push(`части ждут разное число join-заглушек: ${a.late_want} и ${b.late_want}`);
if (late.length !== a.late_want)
  bad.push(`shape: ПРОВЕРКА НЕ ВЫПОЛНЕНА — join-заглушек в реестре ${late.length} (по объединению частей), ждали ${a.late_want}`);
const dupLate = a.late.filter(k => b.late.includes(k));
if (dupLate.length) bad.push(`join-заглушки ${dupLate.join(', ')} положили ОБЕ части — блок регистрации идёт дважды`);

const notes = [...new Set([...a.notes, ...b.notes])], skipped = [...new Set([...a.skipped, ...b.skipped])];
if (notes.length) console.log('НЕ СВЕРЕНО (обе части):\n  ' + notes.join('\n  '));
if (skipped.length) console.log('СНЯТО — экраны заморожены словом владельца 29.10.2026 (Cafe13KPG#510): ' + skipped.join('; '));
if (bad.length) { console.log('КРАСНОЕ (сводка частей):\n' + bad.join('\n')); process.exit(1); }
console.log(`сводка частей сошлась: случаев ${a.sites} = ${a.run.length} + ${b.run.length}, join-заглушек ${late.length}`);
