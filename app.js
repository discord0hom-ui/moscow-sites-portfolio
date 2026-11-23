(function () {
  "use strict";

  var site = window.SITE || {};

  // Имя в шапке и подвале
  if (site.name) {
    document.querySelectorAll("[data-site-name]").forEach(function (el) {
      el.textContent = site.name;
    });
  }

  // Год в подвале
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // Каналы связи: показываем только заполненные
  var map = {
    telegram: site.telegram ? "https://t.me/" + String(site.telegram).replace(/^@/, "") : null,
    whatsapp: site.whatsapp ? "https://wa.me/" + String(site.whatsapp).replace(/\D/g, "") : null,
    email: site.email ? "mailto:" + site.email : null,
    github: site.github || null
  };

  var visible = 0;
  document.querySelectorAll("[data-channel]").forEach(function (el) {
    var key = el.getAttribute("data-channel");
    var href = map[key];
    if (!href) {
      el.remove();
      return;
    }
    el.setAttribute("href", href);
    if (key === "telegram" || key === "whatsapp" || key === "github") {
      el.setAttribute("rel", "noopener");
      el.setAttribute("target", "_blank");
    }
    el.hidden = false;
    visible += 1;
  });

  var empty = document.querySelector(".channels-empty");
  if (empty && visible === 0) empty.hidden = false;

  // Тень у шапки при прокрутке
  var head = document.querySelector(".site-head");
  if (head) {
    var onScroll = function () {
      head.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Мягкое появление блоков
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  var targets = document.querySelectorAll(
    ".section-head, .service, .work, .steps li, .price, .faq details, .contact-in > *, .facts"
  );

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  targets.forEach(function (el, i) {
    el.classList.add("reveal");
    el.style.transitionDelay = (i % 3) * 60 + "ms";
    io.observe(el);
  });
})();
