/* ==========================================================================
   Farvex AI — shared behaviour
   Theme, language, navigation, disclosure widgets, consent.
   No dependencies. Loaded with `defer` on every page.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- storage helpers (private browsing can throw) ---------------- */
  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* non-fatal */ }
  }

  /* ---------- theme -------------------------------------------------------
     v2 key: the legacy `farvex_theme` holds matrix/obsidian/titanium, which
     are not palettes any more. Reading it would strand returning visitors on
     an undefined theme, so we use a new key and validate what we read.      */
  var THEME_KEY = 'farvex_theme_v2';
  var THEMES = ['light', 'dark'];

  function preferredTheme() {
    var stored = read(THEME_KEY);
    if (THEMES.indexOf(stored) !== -1) return stored;
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) { /* fall through */ }
    return 'light';
  }

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      var label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }

  function setTheme(theme) {
    applyTheme(theme);
    write(THEME_KEY, theme);
  }

  /* ---------- language ---------------------------------------------------- */
  var LANG_KEY = 'farvex_lang';
  var LANGS = ['en', 'nl'];

  function preferredLang() {
    var stored = read(LANG_KEY);
    if (LANGS.indexOf(stored) !== -1) return stored;
    return 'en';
  }

  function applyLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = 'en';
    var dict = (window.FARVEX_I18N && window.FARVEX_I18N[lang]) || null;

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);

    if (dict) {
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        var value = dict[el.getAttribute('data-i18n')];
        if (typeof value === 'string') el.textContent = value;
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        var value = dict[el.getAttribute('data-i18n-placeholder')];
        if (typeof value === 'string') el.setAttribute('placeholder', value);
      });
      document.querySelectorAll('[data-i18n-label]').forEach(function (el) {
        var value = dict[el.getAttribute('data-i18n-label')];
        if (typeof value === 'string') el.setAttribute('aria-label', value);
      });
    }

    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      var active = btn.getAttribute('data-lang-btn') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.dispatchEvent(new CustomEvent('farvex:langchange', { detail: { lang: lang } }));
  }

  function setLang(lang) {
    applyLang(lang);
    write(LANG_KEY, lang);
  }

  /* ---------- mobile navigation ------------------------------------------- */
  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var drawer = document.querySelector('[data-nav-drawer]');
    if (!toggle || !drawer) return;

    function close() {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('fx-noscroll');
    }
    function open() {
      drawer.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('fx-noscroll');
    }

    toggle.addEventListener('click', function () {
      if (drawer.classList.contains('is-open')) close(); else open();
    });

    drawer.addEventListener('click', function (event) {
      if (event.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) close();
    });
  }

  /* ---------- accordion ---------------------------------------------------
     Markup: .fx-accordion > .fx-accordion__item
               > button.fx-accordion__trigger[aria-expanded][aria-controls]
               > div.fx-accordion__panel[id]                                  */
  function initAccordions() {
    document.querySelectorAll('.fx-accordion__trigger').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var item = trigger.closest('.fx-accordion__item');
        var panel = document.getElementById(trigger.getAttribute('aria-controls'));
        if (!item || !panel) return;

        var isOpen = trigger.getAttribute('aria-expanded') === 'true';
        var group = trigger.closest('.fx-accordion');

        if (group && !isOpen) {
          group.querySelectorAll('.fx-accordion__trigger[aria-expanded="true"]').forEach(function (other) {
            var otherPanel = document.getElementById(other.getAttribute('aria-controls'));
            other.setAttribute('aria-expanded', 'false');
            other.closest('.fx-accordion__item').classList.remove('is-open');
            if (otherPanel) otherPanel.style.maxHeight = '';
          });
        }

        trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        item.classList.toggle('is-open', !isOpen);
        panel.style.maxHeight = isOpen ? '' : panel.scrollHeight + 'px';
      });
    });
  }

  /* ---------- cookie notice ------------------------------------------------ */
  function initConsent() {
    var banner = document.querySelector('[data-consent]');
    if (!banner) return;

    if (!read('farvex_cookie_consent')) {
      window.setTimeout(function () { banner.classList.add('is-visible'); }, 900);
    }

    banner.querySelectorAll('[data-consent-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var all = btn.getAttribute('data-consent-choice') === 'all';
        write('farvex_cookie_consent', all ? 'all' : 'essential');
        write('farvex_cookie_telemetry', all ? 'true' : 'false');
        banner.classList.remove('is-visible');
      });
    });
  }

  /* ---------- header elevation on scroll ----------------------------------- */
  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------- reveal on scroll (opt-in, respects reduced motion) ----------- */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    var reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* assume motion is fine */ }

    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    targets.forEach(function (el) { observer.observe(el); });
  }


  /* ---------- motion layer (added 2026-09-18) ------------------------------
     Scroll reveal above handles [data-reveal]. This adds staggered groups,
     count-up numerals, parallax drift and the scroll progress bar.

     Everything here is opt-in by attribute. Counters in particular must never
     be discovered by scanning for digits: several numbers on this site are
     owned and recomputed by page scripts (the savings calculator, the pipeline
     status, the checklist pills) and animating those would fight their owner
     on every input event and on every language switch.
     ----------------------------------------------------------------------- */
  function motionReduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  /* Staggered groups reuse the same is-revealed class the CSS keys off. */
  function initStagger() {
    var groups = document.querySelectorAll('[data-stagger]');
    if (!groups.length) return;

    if (motionReduced() || !('IntersectionObserver' in window)) {
      groups.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    groups.forEach(function (el) { observer.observe(el); });
  }

  /* Count-up.
     data-count-to  = the final numeric value
     The element's existing text is the template: whatever sits around the
     number (%, ms, €, +, <) is preserved, so "99.98%" counts to 99.98 and
     keeps its percent sign. Decimal places are inferred from the target. */
  function formatCount(value, decimals, locale) {
    return value.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function initCounters() {
    var els = document.querySelectorAll('[data-count-to]');
    if (!els.length) return;

    var locale = (document.documentElement.getAttribute('data-lang') === 'nl') ? 'nl-NL' : 'en-US';

    els.forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count-to'));
      if (isNaN(target)) return;

      // Remember the surrounding characters once, before any animation runs.
      if (!el.hasAttribute('data-count-tpl')) {
        var raw = el.textContent.trim();
        var m = raw.match(/^(\D*)([\d.,\s]+)(\D*)$/);
        el.setAttribute('data-count-pre', m ? m[1] : '');
        el.setAttribute('data-count-post', m ? m[3] : '');
        el.setAttribute('data-count-tpl', '1');
      }
    });

    function paint(el, value) {
      var dec = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
      el.textContent = (el.getAttribute('data-count-pre') || '') +
        formatCount(value, dec, locale) +
        (el.getAttribute('data-count-post') || '');
    }

    // With motion reduced, land on the final value rather than leaving a zero.
    if (motionReduced() || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { paint(el, parseFloat(el.getAttribute('data-count-to'))); });
      return;
    }

    els.forEach(function (el) { paint(el, 0); });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        observer.unobserve(el);

        var target = parseFloat(el.getAttribute('data-count-to'));
        var started = null;
        var dur = 1100;

        function frame(now) {
          if (started === null) started = now;
          var p = Math.min((now - started) / dur, 1);
          // ease-out cubic: fast start, settles onto the number
          var eased = 1 - Math.pow(1 - p, 3);
          paint(el, target * eased);
          if (p < 1) window.requestAnimationFrame(frame);
          else paint(el, target);
        }
        window.requestAnimationFrame(frame);
      });
    }, { threshold: 0.4 });

    els.forEach(function (el) { observer.observe(el); });

    // Re-render in the new locale when the visitor switches language.
    document.addEventListener('farvex:langchange', function () {
      locale = (document.documentElement.getAttribute('data-lang') === 'nl') ? 'nl-NL' : 'en-US';
      els.forEach(function (el) { paint(el, parseFloat(el.getAttribute('data-count-to'))); });
    });
  }

  /* Parallax drift and the scroll progress bar share one rAF-throttled pass. */
  function initScrollFx() {
    var bar = document.querySelector('[data-progress-bar]');
    var layers = document.querySelectorAll('[data-parallax]');
    if (!bar && !layers.length) return;
    if (motionReduced()) {
      if (bar) bar.style.transform = 'scaleX(0)';
      return;
    }

    var ticking = false;

    function update() {
      ticking = false;

      if (bar) {
        var doc = document.documentElement;
        var max = doc.scrollHeight - doc.clientHeight;
        var p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
        bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      }

      for (var i = 0; i < layers.length; i++) {
        var el = layers[i];
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        var box = el.getBoundingClientRect();
        // Offset from the viewport centre, so the drift reverses as it passes.
        var fromCentre = (box.top + box.height / 2) - window.innerHeight / 2;
        el.style.setProperty('--fx-par', (-fromCentre * speed).toFixed(1) + 'px');
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ---------- misc --------------------------------------------------------- */
  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function initControls() {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
    });

    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-lang-btn'));
      });
    });

    // Follow the OS only while the visitor has expressed no preference.
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (event) {
        if (!read(THEME_KEY)) applyTheme(event.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { /* no matchMedia */ }
  }

  function boot() {
    applyTheme(preferredTheme());
    applyLang(preferredLang());
    initControls();
    initNav();
    initAccordions();
    initConsent();
    initHeader();
    initReveal();
    initStagger();
    initCounters();
    initScrollFx();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Exposed for page-local scripts and legacy inline handlers. */
  window.Farvex = {
    setTheme: setTheme,
    setLang: setLang,
    getLang: preferredLang,
    applyLang: applyLang,
    read: read,
    write: write
  };
})();
