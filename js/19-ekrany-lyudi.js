Object.assign(SCREENS, {

  // E45 очередь, E45b пусто, E45g только решённые, E45v отказ со словом
  joinQueue: function () {
    // E45zh: слова — отказа сервера (_may_decide, 403) буквой; кнопок нет — идти отсюда некуда
    if (!mayPeople()) return '<div class="card quiet"><div class="col"><b>Сюда нельзя</b>' +
      '<span class="small">Просьбы о вступлении смотрит и решает глава клуба.</span></div></div>';
    if (!JOINQ.list) return JOINQ.fail
      ? '<div class="card strong"><h2>Просьбы не загрузились</h2><p>' + esc(JOINQ.fail) + '</p>' +
        '<button type="button" class="btn" data-action="j-retry">Попробовать снова</button></div>'
      : '<div class="card quiet"><span class="small">Загружаем просьбы…</span></div>';
    var wait = JOINQ.list.filter(function (q) { return q.status === 'pending'; });
    var past = JOINQ.list.filter(function (q) { return q.status !== 'pending'; });
    var note = noteBox('Согласие одним действием впускает в приложение И создаёт членство. Отказ не отменяется: второго решения сервер не примет.');
    if (!wait.length && !past.length) return '<div class="card quiet"><div class="col"><b>Просьб нет</b>' +
      '<span class="small">Здесь появятся просьбы о доступе — от людей, которых в приложении ещё нет. Они приходят с экрана оплаты, вместе с чеком.</span></div></div>' + note;
    return (JOINQ.err ? '<div class="deny" role="alert">' + svg(ICON.info) + '<span>' + esc(JOINQ.err) + '</span></div>' : '') +
      (wait.length ? '<div class="group"><span class="label">Ждут ответа · ' + wait.length + '</span>' + wait.map(joinCard).join('') + '</div>' + note : '') +
      (past.length ? '<div class="group"><span class="label">Решённые</span>' + past.map(joinRow).join('') + '</div>' : '');
  },

  people: function () {
    if (LIVE && !mayPeople()) return '<div class="card quiet"><span class="small">Выдавать и снимать ответственность может глава клуба.</span></div>';
    if (!PEOPLE.list) return PEOPLE.fail
      ? '<div class="card quiet"><span class="small">' + esc(PEOPLE.fail) + '</span></div>' +
        '<button type="button" class="btn ghost" data-action="p-reload">Повторить</button>'
      : '<div class="card quiet"><span class="small">Загружаем людей…</span></div>';
    // E47e: поля остатка нет у сервера — прочерк объясняется ОДИН раз, над списком
    var noBal = PEOPLE.list.some(function (x) { return x.bal === undefined; });
    return (!LIVE && FLASH ? flash() : '') +
      '<div class="field"><label for="p-find">Найти по имени</label>' +
        '<input id="p-find" type="search" value="' + esc(PEOPLE.find) + '" placeholder="Имя"></div>' +
      (noBal && PEOPLE.list.length ? '<div class="card quiet"><span class="small">Остаток сервер не отдаёт — у этой ручки поля ещё нет. Прочерк здесь значит «не спросили», а не «ноль».</span></div>' : '') +
      (PEOPLE.list.length ? peopleOrder(PEOPLE.list).map(function (k) { return personCard(PEOPLE.list[k], k); }).join('')
                          : '<div class="card quiet"><span class="small">Сервер не вернул ни одного человека.</span></div>');
  },
});
