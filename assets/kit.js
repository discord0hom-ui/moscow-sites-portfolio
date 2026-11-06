/* Общий скрипт сайтов портфолио: меню, «открыто сейчас», форма заявки.
   Без внешних библиотек и без отправки данных на сервер: заявка уходит в WhatsApp или звонком. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- мобильное меню: <button data-nav-toggle aria-controls="nav">, <nav id="nav" data-nav> ----
  $$('[data-nav-toggle]').forEach(function (b) {
    var nav = document.getElementById(b.getAttribute('aria-controls'));
    if (!nav) return;
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('nav-open', open);
    });
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () {
        b.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open');
        document.documentElement.classList.remove('nav-open');
      });
    });
  });

  // ---- часы работы: <body data-hours='{"1":["10:00","22:00"], ... "0":["11:00","20:00"]}'> (0 — воскресенье)
  //      <span data-open-now></span> → «Открыто до 22:00» / «Закрыто, откроемся в 10:00» ----
  var DAYS = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
  function moscowNow() {
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date());
    var get = function (t) { return (p.filter(function (x) { return x.type === t; })[0] || {}).value; };
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day: wd, min: (+get('hour') % 24) * 60 + (+get('minute')) };
  }
  var toMin = function (s) { var a = s.split(':'); return +a[0] * 60 + (+a[1]); };
  function openState(hours) {
    var now = moscowNow(), today = hours[now.day];
    if (hours.all) return { open: true, text: 'Открыто круглосуточно' };
    if (today) {
      var o = toMin(today[0]), c = toMin(today[1]); if (c <= o) c += 1440;
      var m = now.min < o && c > 1440 && now.min + 1440 < c ? now.min + 1440 : now.min;
      if (m >= o && m < c) return { open: true, text: 'Открыто до ' + today[1] };
      if (m < o) return { open: false, text: 'Закрыто, откроемся в ' + today[0] };
    }
    for (var i = 1; i <= 7; i++) {
      var d = (now.day + i) % 7;
      if (hours[d]) return { open: false, text: 'Закрыто, откроемся ' + (i === 1 ? 'завтра' : DAYS[d]) + ' в ' + hours[d][0] };
    }
    return { open: false, text: '' };
  }
  var hoursAttr = document.body.getAttribute('data-hours');
  if (hoursAttr) {
    try {
      var st = openState(JSON.parse(hoursAttr));
      $$('[data-open-now]').forEach(function (el) {
        el.textContent = st.text; el.classList.add(st.open ? 'is-open' : 'is-closed');
      });
    } catch (e) { /* часы не разобрались — просто ничего не показываем */ }
  }

  // ---- форма заявки: <form data-lead data-phone="+74951234567" data-wa="74951234567" data-biz="Название"> ----
  $$('form[data-lead]').forEach(function (f) {
    var out = document.createElement('div');
    out.className = 'lead-result'; out.setAttribute('role', 'status'); out.setAttribute('aria-live', 'polite');
    f.appendChild(out);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bad = $$('[required]', f).filter(function (el) { return !el.value.trim(); });
      $$('[aria-invalid]', f).forEach(function (el) { el.removeAttribute('aria-invalid'); });
      if (bad.length) { bad.forEach(function (el) { el.setAttribute('aria-invalid', 'true'); }); bad[0].focus(); return; }
      var lines = ['Здравствуйте! Заявка с сайта «' + (f.getAttribute('data-biz') || '') + '».'];
      $$('input, select, textarea', f).forEach(function (el) {
        if (!el.name || !el.value.trim() || el.type === 'checkbox' && !el.checked) return;
        var lab = el.getAttribute('data-label') || (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : el.name);
        lines.push(lab + ': ' + el.value.trim());
      });
      var text = lines.join('\n'), wa = f.getAttribute('data-wa'), tel = f.getAttribute('data-phone');
      out.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = 'Заявка готова. Отправьте её удобным способом — так она точно дойдёт до администратора.';
      out.appendChild(p);
      var row = document.createElement('div'); row.className = 'lead-actions';
      if (wa) {
        var a = document.createElement('a');
        a.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text); a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'Отправить в WhatsApp'; a.className = 'lead-btn'; row.appendChild(a);
      }
      var mail = f.getAttribute('data-mail');
      if (mail) {
        var m = document.createElement('a');
        m.href = 'mailto:' + mail + '?subject=' + encodeURIComponent('Вопрос с сайта') + '&body=' + encodeURIComponent(text);
        m.textContent = 'Отправить письмом'; m.className = 'lead-btn'; row.appendChild(m);
      }
      if (tel) {
        var t = document.createElement('a'); t.href = 'tel:' + tel; t.textContent = 'Позвонить'; t.className = 'lead-btn lead-btn--ghost';
        row.appendChild(t);
      }
      var c = document.createElement('button'); c.type = 'button'; c.className = 'lead-btn lead-btn--ghost'; c.textContent = 'Скопировать текст';
      c.addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { c.textContent = 'Скопировано'; },
          function () { c.textContent = 'Не получилось — выделите текст вручную'; });
      });
      row.appendChild(c);
      out.appendChild(row);
      out.classList.add('is-on');
    });
  });

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---- авторы фотографий: <details class="photo-credits" data-credits><summary>Фото</summary></details> ----
  $$('[data-credits]').forEach(function (box) {
    fetch('img/credits.json').then(function (r) { return r.json(); }).then(function (c) {
      var ul = document.createElement('ul');
      Object.keys(c).forEach(function (k) {
        var it = c[k], li = document.createElement('li'), a = document.createElement('a');
        a.href = it.source || '#'; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = (it.title || k) + (it.author ? ' — ' + it.author : '');
        li.appendChild(a); li.appendChild(document.createTextNode(', ' + it.license));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }).catch(function () { box.hidden = true; });
  });
})();
