// Случаи режима «выбрать» календаря (шаг 43) без браузера: node tools/kalendar-vybor.cjs <корень клиента> [band-press]
// band-press — мутант «закрытую полосу удалось нажать»: обязан дать КРАСНОЕ и rc=1.
const vm = require('vm'), fs = require('fs');
const root = process.argv[2], mutant = process.argv[3] || '';
const ctx = { console, Date, Math, JSON, Object, Number, String, Array, RegExp, isNaN, parseInt,
  document: { addEventListener() {}, getElementById() { return null; } }, window: {},
  SCREENS: {}, TITLES: {}, LIVE: false, EVENTS: null, EVENTS_STATE: 'ok', haptic() {}, render() {}, go() {},
  eventRow: e => '<button data-event="' + e.id + '">' + e.title + '</button>', svg: () => '' };
vm.createContext(ctx);
let src23 = fs.readFileSync(root + '/js/23-kalendar.js', 'utf8');
if (mutant === 'band-press') {   // мутант: закрытая полоса получает действие нажатия
  const a = `'<div class="tband off" aria-disabled="true">'`, b = `'<button type="button" class="tband off" data-action="cal-band:' + calHm(sg.s) + '@' + (sg.e >= 1440 ? '24:00' : calHm(sg.e)) + '">'`;
  if (!src23.includes(a)) throw 'подмена не применилась';
  src23 = src23.replace(a, b);
  const a2 = `  if (!sg || sg.why) return;\n`; if (!src23.includes(a2)) throw 'подмена 2 не применилась'; src23 = src23.replace(a2, '');
  console.log('подлог наложен');
}
for (const f of ['js/00-slova.js', 'js/10-utility.js', 'js/09-afisha.js']) { try { vm.runInContext(fs.readFileSync(root + '/' + f, 'utf8'), ctx, { filename: f }); } catch (e) { console.log('load', f, e.message); } }
ctx.LIVE = false;
vm.runInContext(src23, ctx, { filename: '23' });
const R = c => vm.runInContext(c, ctx);
// данные: завтра ивент 18:00–20:00, четыре церемонии 15:00–16:00 при ёмкости 4
R(`var TOM = ymdAdd(bkk(new Date()).ymd, 1);
   function AT(hm, d) { return Date.parse((d || TOM) + 'T' + hm + ':00+07:00'); }
   eventList = function () { return [{ id: 'e1', title: 'Вечер', at: AT('18:00'), mins: 120, time: '18:00' }, { id: 'e2', title: 'Ночь', at: AT('00:30', ymdAdd(TOM, 1)), mins: 60 }]; };
   var TEA_N = 4;
   teaDemo = function () { var o = []; for (var i = 0; i < TEA_N; i++) o.push({ id: 't' + i, vis: i ? 'private' : 'open', title: 'Ц' + i, at: AT('15:00'), mins: 60, master: i === 0 ? 'm1' : 'm9' });
     o.push({ id: 'mm', vis: 'open', title: 'Мастерская', at: AT('12:00'), mins: 60, master: 'm1' }); return o; };`);
const out = {};
R(`calGo('calendar', { pick: 'teaHold', day: TOM })`);
let h = R('SCREENS.calendar()');
out.title = R('TITLES.calendar');
out.offEvent = /tband off[^>]*>18:00–20:00 · занято ивентом «Вечер»/.test(h);
out.offFull = /tband off[^>]*>15:00–16:00 · церемоний в это время уже 4 из 4/.test(h);
out.svobodno = h.includes('свободно');
out.offAction = /class="tband off"[^>]*data-action/.test(h);   // у закрытой полосы нет действия вовсе
// нажатие закрытой полосы ивента не меняет С
R(`CAL.from = '10:00'`);
R(`calAction('cal-band', '18:00@20:00')`); out.pressClosed = R('CAL.from');
// перекрытие 17:30–18:30
R(`CAL.from='17:30'; CAL.to='18:30'`); h = R('SCREENS.calendar()');
out.deny = (/<div class="deny"><span>([^<]*)/.exec(h) || [])[1]; out.chooseOff = /data-action="cal-choose" disabled/.test(h);
// три из четырёх — открыто
R(`TEA_N = 3`); h = R('SCREENS.calendar()'); out.tri = /<button[^>]*tband[^>]*>15:00–16:00 · можно выбрать · церемоний 3 из 4/.test(h);
// любая минута и через полночь
R(`CAL.from='20:07'; CAL.to='21:48'`); h = R('SCREENS.calendar()'); out.minutaOk = !/cal-choose" disabled/.test(h) && !h.includes('class="deny"');
R(`calAction('cal-choose')`); out.picked = R('JSON.stringify(calPicked("teaHold"))');
R(`CAL.from='23:00'; CAL.to='01:00'`); h = R('SCREENS.calendar()'); out.polnoch = (/<div class="deny"><span>([^<]*)/.exec(h) || [])[1]; out.nextDay = h.includes('заканчивается');
R(`CAL.from='23:00'; CAL.to='00:15'`); h = R('SCREENS.calendar()'); out.polnochOk = !h.includes('class="deny"') && h.includes('заканчивается');
// teaBook: мастер m1 занят 12:00–13:00 и 15:00–16:00; другой мастер — нет
R(`calGo('calendar', { pick: 'teaBook', day: TOM, master: { id: 'm1', name: 'Анна', mins: 90 } })`); h = R('SCREENS.calendar()');
out.master = /tband off[^>]*>12:00–13:00 · у мастера другая церемония/.test(h);
R(`CAL.from='19:07'`); h = R('SCREENS.calendar()'); out.dlit = (/до \d\d:\d\d/.exec(h) || [])[0];
R(`calGo('calendar', { pick: 'teaBook', day: TOM, master: { id: 'm2', name: 'Б', mins: 60 } })`); h = R('SCREENS.calendar()');
out.otherMaster = /<button[^>]*tband[^>]*>12:00–13:00/.test(h) || /<button[^>]*tband[^>]*>\d\d:\d\d–1[5-9]:\d\d · можно выбрать[^<]*<\/button>/.test(h);
// прошлое
R(`calGo('calendar', { pick: 'teaHold', day: ymdAdd(TOM, -3) })`); h = R('SCREENS.calendar()'); out.past = (h.match(/tband/g) || []).length + ' ' + /уже прошло/.test(h);
// живой режим без ручки — L17
R(`LIVE = true; calGo('calendar', { pick: 'teaHold', day: TOM })`); h = R('SCREENS.calendar()'); out.live = h.includes('Не удалось узнать'); R('LIVE = false');
console.log(JSON.stringify(out, null, 1));
const bad = [!out.offEvent && 'offEvent', !out.offFull && 'offFull', out.svobodno && 'svobodno', out.pressClosed !== '10:00' && 'ЗАКРЫТУЮ ПОЛОСУ УДАЛОСЬ НАЖАТЬ', out.offAction && 'у закрытой полосы есть data-action', !out.chooseOff && 'chooseOff', !out.tri && 'tri', !out.minutaOk && 'minuta', !out.master && 'master', out.dlit !== 'до 20:37' && 'dlit', !out.live && 'live', !out.polnochOk && 'polnochOk', !out.polnoch && 'polnoch'].filter(Boolean);
console.log(bad.length ? 'КРАСНОЕ: ' + bad.join(', ') : 'ЗЕЛЁНОЕ'); process.exit(bad.length ? 1 : 0);
