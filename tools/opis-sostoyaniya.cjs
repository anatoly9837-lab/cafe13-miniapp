/* Сколько состояний экранов опись НЕ показывает.

   Состоянием считается РАЗЛИЧИМЫЙ НА ЭКРАНЕ текст, а не ветка в коде: ветка,
   дающая тот же текст, для описи состоянием не является, а ветка, в кадр не
   попавшая, — является, даже если автор о ней помнит.

   ЗАПУСК: node tools/opis-sostoyaniya.cjs [корень]   (по умолчанию /app)
   Коды: 0 — замер сделан; 2 — мерить нечем (нет манифеста, пустой реестр).
   Ненулевого «нашлось» здесь НЕТ нарочно: неснятое состояние — не дефект
   клиента, а вопрос к составу описи, и решает его владелец описи.

   ⚠ ПРЕДЕЛ ПЕРВЫЙ: число «без кадра» СЫРОЕ. Признак — текст экрана, а текст
   меняет и ПЕРЕЕЗЖАЮЩАЯ МЕТКА: «сейчас» у другой роли на `demo`, «Ваш
   уровень» у другого уровня на `membership`. Такие виды — один экран, а не
   новое состояние. Поэтому рядом с каждым лишним видом печатается ПОЗИЦИЯ
   первого расхождения и два куска текста вокруг неё: по ним видно за секунду,
   метка это переехала или экран правда другой. Замер 25.10.2026: сырое 26,
   после сверки расхождений — 18.

   ⚠ ПРЕДЕЛ ВТОРОЙ: прибор зовёт `go(экран)` и больше ничего. Экраны, которым
   нужен ПРЕДШЕСТВУЮЩИЙ шаг (скан пропуска, выбор карточки), показывают при
   этом пустую заглушку — «Человек не выбран», «Загружаем направление…».
   Для них «кадра нет» честно, но прибор НЕ отличает «состояние не снято» от
   «состояние недостижимо без шага, которого прибор не делает». Отличить это
   может только съёмка с проходом, как в `tools/shots.cjs`. */
const { chromium } = require('playwright');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = process.argv[2] || process.env.APP || '/app';
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

(async () => {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(ROOT + '/screens/manifest.json', 'utf8'));
  } catch (e) {
    console.log('ЗАМЕР НЕ ВЫПОЛНЕН: манифеста описи нет — ' + e.message);
    process.exit(2);
  }
  const snjato = new Map();
  manifest.forEach(r => {
    if (!snjato.has(r.screen)) snjato.set(r.screen, 0);
    snjato.set(r.screen, snjato.get(r.screen) + 1);
  });

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + ROOT + '/index.html', { waitUntil: 'networkidle' });
  const shirina = await p.evaluate(() => document.documentElement.clientWidth);
  console.log('control: clientWidth =', shirina, '(ждём 390)');

  const imena = await p.evaluate(() => Object.keys(window.SCREENS || {}));
  if (imena.length < 20) {
    console.log(`ЗАМЕР НЕ ВЫПОЛНЕН: реестр экранов дал ${imena.length} имён — прибор смотрит не туда`);
    await b.close();
    process.exit(2);
  }
  const arnost = await p.evaluate(() => {
    const o = {};
    Object.keys(window.SCREENS).forEach(k => { o[k] = window.SCREENS[k].length; });
    return o;
  });
  // Параметры берутся из самих демо-данных, а не выдумываются.
  const idy = await p.evaluate(() => {
    const out = [];
    Object.keys(window.DATA).forEach(k => {
      const v = window.DATA[k];
      if (Array.isArray(v)) v.forEach(x => { if (x && x.id !== undefined) out.push(String(x.id)); });
    });
    return [...new Set(out)];
  });

  const roli = ['guest', 'member', 'organizer', 'partner', 'staff', 'curator'];
  const vidy = new Map();
  for (const im of imena) {
    const pary = arnost[im] > 0 ? idy : [null];
    for (const rol of roli) {
      for (const par of pary) {
        try {
          await p.evaluate(([r, n, x]) => { DATA.role = r; x === null ? go(n) : go(n, x); }, [rol, im, par]);
        } catch (e) { continue; }
        await p.waitForTimeout(15);
        const [tek, txt] = await p.evaluate(() => [
          current,
          (document.getElementById('view').innerText || '').replace(/\s+/g, ' ').trim()
        ]);
        if (tek !== im || !txt) continue;
        if (!vidy.has(im)) vidy.set(im, new Map());
        const m = vidy.get(im);
        if (!m.has(hash(txt))) m.set(hash(txt), { rol, par, txt });
      }
    }
  }
  await b.close();

  console.log('экранов в реестре:', imena.length, '| с параметром:', imena.filter(n => arnost[n] > 0).length,
              '| id в DATA:', idy.length, '| ошибок страницы:', errs.length);

  let vsego = 0, bez = 0;
  console.log('\nЭКРАН · видов · кадров');
  [...vidy.keys()].sort().forEach(im => {
    const v = vidy.get(im), k = snjato.get(im) || 0;
    vsego += v.size;
    const lishnih = Math.max(0, v.size - k);
    bez += lishnih;
    console.log(`${im.padEnd(15)} ${String(v.size).padStart(2)} ${String(k).padStart(3)}  ${k === 0 ? 'КАДРА НЕТ ВОВСЕ' : (lishnih ? 'не сняты ' + lishnih : 'покрыт')}`);
    if (!lishnih) return;
    const spisok = [...v.values()];
    const baza = spisok[0].txt;
    spisok.forEach((x, i) => {
      if (i === 0) { console.log(`      [${x.rol}/${x.par}] «${x.txt.slice(0, 70)}»`); return; }
      let j = 0;
      while (j < baza.length && j < x.txt.length && baza[j] === x.txt[j]) j++;
      console.log(`      [${x.rol}/${x.par}] расхождение с ${j}-го знака:`);
      console.log(`          первый: …${baza.slice(Math.max(0, j - 20), j + 45)}`);
      console.log(`          этот:   …${x.txt.slice(Math.max(0, j - 20), j + 45)}`);
    });
  });
  console.log(`\nИТОГО: видов ${vsego}; кадров ${manifest.length}; без кадра ${bez}`);
})();
