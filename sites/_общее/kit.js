/* Общий скрипт сайтов: появление блоков, мобильное меню, счётчики и виджет записи.
   Данные для каждого сайта задаются в window.SITE (услуги, мастера, часы, WhatsApp). */
(function () {
  'use strict';
  var S = window.SITE || {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Появление блоков при прокрутке ---------- */
  var reveals = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Счётчики (data-count="120") ---------- */
  var counters = document.querySelectorAll('[data-count]');
  if (!reduce && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, end = parseFloat(el.getAttribute('data-count')), suffix = el.getAttribute('data-suffix') || '';
        var t0 = null, dur = 1400;
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
          el.textContent = v + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || ''); });
  }

  /* ---------- Мобильное меню ---------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Виджет записи ---------- */
  var root = document.querySelector('[data-booking]');
  if (!root || !S.services || !S.services.length) return;

  var DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var hours = S.hours || [10, 20];            // [открытие, закрытие] в часах
  var step = S.step || 60;                    // шаг записи, минут
  var closed = S.closedDays || [0];           // выходные: 0 = воскресенье
  var masters = S.masters || [];
  var state = { svc: 0, master: 0, day: null, time: null, name: '', phone: '', done: false, error: '' };

  // Ближайшие рабочие дни (до 14 дней вперёд)
  var days = [];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  for (var i = 0; i <= 14 && days.length < 9; i++) {
    var d = new Date(today); d.setDate(today.getDate() + i);
    if (closed.indexOf(d.getDay()) === -1) days.push(d);
  }
  state.day = 0;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function dayLabel(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }

  // Демо-занятость: часть слотов «уже занята», но детерминированно, чтобы выглядело живо.
  function busy(dayIdx, m) { return ((dayIdx * 7 + m * 13 + state.svc * 3 + state.master * 5) % 6) === 0; }

  function slots() {
    var list = [], dur = S.services[state.svc].minutes || 60;
    for (var m = hours[0] * 60; m + dur <= hours[1] * 60; m += step) list.push(m);
    return list;
  }

  function masterName() { return masters.length ? masters[state.master].name : 'любой мастер'; }

  function summaryText() {
    var svc = S.services[state.svc];
    return 'Здравствуйте! Хочу записаться: ' + svc.name + ', ' + masterName() + ', ' +
      dayLabel(days[state.day]) + ' в ' + hhmm(state.time) + '. Меня зовут ' + state.name + ', телефон ' + state.phone + '.';
  }

  function waLink() {
    if (!S.whatsapp) return '';
    return 'https://wa.me/' + String(S.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(summaryText());
  }

  function render() {
    var svc = S.services[state.svc];
    var h = '';

    if (state.done) {
      h += '<div class="bk-summary"><b>Заявка собрана.</b><br>' + esc(summaryText()) + '</div>';
      h += '<p class="bk-note">Это демо-форма: данные не уходят в календарь. На живом сайте заявка попадает в CRM или календарь мастера.</p>';
      h += '<div class="bk-actions">';
      if (S.whatsapp) h += '<a class="btn" href="' + esc(waLink()) + '" target="_blank" rel="noopener">Отправить в WhatsApp</a>';
      h += '<button type="button" class="btn btn-ghost" data-restart>Начать заново</button></div>';
      root.innerHTML = h;
      return;
    }

    h += '<div class="bk-step"><div class="bk-title"><span>1</span>Услуга</div><div class="bk-opts">';
    S.services.forEach(function (s, i) {
      h += '<button type="button" class="bk-opt' + (i === state.svc ? ' on' : '') + '" data-svc="' + i + '">' +
        '<b>' + esc(s.name) + '</b><small>' + esc(s.minutes) + ' мин · ' + esc(s.price) + '</small></button>';
    });
    h += '</div></div>';

    if (masters.length) {
      h += '<div class="bk-step"><div class="bk-title"><span>2</span>Мастер</div><div class="bk-chips">';
      masters.forEach(function (m, i) {
        h += '<button type="button" class="bk-chip' + (i === state.master ? ' on' : '') + '" data-master="' + i + '">' + esc(m.name) + '<small>' + esc(m.role) + '</small></button>';
      });
      h += '</div></div>';
    }

    h += '<div class="bk-step"><div class="bk-title"><span>' + (masters.length ? 3 : 2) + '</span>Дата</div><div class="bk-chips">';
    days.forEach(function (d, i) {
      h += '<button type="button" class="bk-chip' + (i === state.day ? ' on' : '') + '" data-day="' + i + '">' + DAYS[d.getDay()] + '<small>' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + '</small></button>';
    });
    h += '</div></div>';

    var list = slots();
    h += '<div class="bk-step"><div class="bk-title"><span>' + (masters.length ? 4 : 3) + '</span>Время</div><div class="bk-chips">';
    list.forEach(function (m) {
      var off = busy(state.day, m);
      if (state.time === m && off) state.time = null;
      h += '<button type="button" class="bk-chip' + (state.time === m ? ' on' : '') + '" data-time="' + m + '"' + (off ? ' disabled' : '') + '>' + hhmm(m) + '</button>';
    });
    h += '</div></div>';

    h += '<div class="bk-step"><div class="bk-title"><span>' + (masters.length ? 5 : 4) + '</span>Контакты</div>';
    h += '<form class="bk-form" data-form novalidate>';
    h += '<label>Имя<input name="name" autocomplete="name" value="' + esc(state.name) + '" required></label>';
    h += '<label>Телефон<input name="phone" type="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="' + esc(state.phone) + '" required></label>';
    h += '<div class="bk-err" data-err>' + esc(state.error) + '</div>';
    h += '<div class="bk-full bk-actions"><button type="submit" class="btn" ' + (state.time === null ? 'disabled style="opacity:.5"' : '') + '>Записаться</button>';
    h += '<span class="bk-note" style="margin:0;align-self:center">' + esc(svc.name) + ' · ' + esc(svc.price) + '</span></div>';
    h += '</form></div>';

    root.innerHTML = h;
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-svc],[data-master],[data-day],[data-time],[data-restart]');
    if (!t) return;
    if (t.hasAttribute('data-svc')) { state.svc = +t.getAttribute('data-svc'); state.time = null; }
    else if (t.hasAttribute('data-master')) { state.master = +t.getAttribute('data-master'); state.time = null; }
    else if (t.hasAttribute('data-day')) { state.day = +t.getAttribute('data-day'); state.time = null; }
    else if (t.hasAttribute('data-time')) { state.time = +t.getAttribute('data-time'); state.error = ''; }
    else if (t.hasAttribute('data-restart')) { state.done = false; state.time = null; state.error = ''; }
    render();
  });

  root.addEventListener('input', function (e) {
    if (e.target.name === 'name') state.name = e.target.value;
    if (e.target.name === 'phone') state.phone = e.target.value;
  });

  root.addEventListener('submit', function (e) {
    e.preventDefault();
    var digits = state.phone.replace(/\D/g, '');
    if (state.time === null) state.error = 'Выберите время.';
    else if (state.name.trim().length < 2) state.error = 'Укажите имя.';
    else if (digits.length < 10) state.error = 'Проверьте номер телефона.';
    else { state.error = ''; state.done = true; }
    render();
  });

  render();
})();
