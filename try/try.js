/* json.fit /try/: the app's onboarding on the web.
 *
 * One question per screen, then a build moment and the result a piece at a
 * time, for the route, the week of meals and the training program. Every plan
 * is built in a Web Worker by engines.min.js: the app's own route, meal plan,
 * shopping list and workout code (scripts/try-engines/). The answers live in
 * this tab's memory only. Nothing typed here is sent, stored or put in the
 * URL; the only events are the screens reached (track('try_step', {step, screen})).
 *
 * ?step=<number or screen id>&demo=1 (or demo=2) fills the answers and opens a
 * screen, for screenshots and tests.
 */
(function () {
  'use strict';

  var APP_STORE = 'https://apps.apple.com/au/app/json-fit/id6758357834';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.RyanNovinc.JSON';
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.getElementById('try');
  var stage = document.getElementById('stage');
  var prog = document.getElementById('prog');
  var cta = document.getElementById('cta');
  var nextBtn = document.getElementById('nextBtn');
  var backBtn = document.getElementById('backBtn');
  var infoBtn = document.getElementById('infoBtn');

  /* ================= engines (Web Worker) ================= */
  var worker = null, seq = 0, pending = {};
  function startWorker() {
    if (worker) return;
    try { worker = new Worker(window.TRY_ENGINES || 'engines.min.js'); } catch (e) { worker = null; return; }
    worker.onmessage = function (ev) {
      var d = ev.data || {}, p = pending[d.id];
      if (!p) return;
      delete pending[d.id]; clearTimeout(p.t);
      d.ok ? p.res(d.result) : p.rej(new Error(d.error || 'failed'));
    };
    worker.onerror = function (ev) {
      Object.keys(pending).forEach(function (k) { clearTimeout(pending[k].t); pending[k].rej(new Error(ev && ev.message || 'worker error')); });
      pending = {}; try { worker.terminate(); } catch (e) {} worker = null;
    };
  }
  function call(cmd) {
    var args = Array.prototype.slice.call(arguments, 1);
    startWorker();
    if (!worker) return Promise.reject(new Error('This browser could not start the plan builder.'));
    var id = ++seq;
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { delete pending[id]; rej(new Error('It took too long.')); try { worker.terminate(); } catch (e) {} worker = null; }, 25000);
      pending[id] = { res: res, rej: rej, t: t };
      worker.postMessage({ id: id, cmd: cmd, args: args });
    });
  }

  /* ================= state (memory only) ================= */
  var S = {
    units: 'metric',
    about: null, touched: {}, defaults: null,
    food: { mealsPerDay: 3, snackFrequency: 'ai_decide', dessertFrequency: null, dietPattern: null, allergies: [], skip: [], picks: [] },
    training: { days: null, equipment: null },
    foodOptions: null, grid: null, gridKey: '', routeOpts: null, routeOptsKey: '',
    route: null, routeKey: '', meals: null, mealsKey: '', program: null, programKey: '',
    day: 0, ticks: {}, openDay: null, openAisle: null,
  };
  var INDEX = null, EXINDEX = null;
  function loadIndex() {
    if (INDEX) return Promise.resolve();
    return Promise.all([
      fetch('meal-index.json').then(function (r) { return r.json(); }).then(function (j) { INDEX = j; }),
      fetch('exercise-index.json').then(function (r) { return r.json(); }).then(function (j) { EXINDEX = j; }),
    ]);
  }

  /* ================= helpers ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function kgToLb(kg) { return kg * 2.20462; }
  function fmtW(kg) { return S.units === 'imperial' ? Math.round(kgToLb(kg)) + ' lb' : r1(kg) + ' kg'; }
  function n0(n) { return Math.round(n).toLocaleString('en-AU'); }
  function keyOf(o) { return JSON.stringify(o); }
  function $(sel, el) { return (el || stage).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || stage).querySelectorAll(sel)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function months(a, b) {
    if (b < 1) return 'Under a month';
    var f = function (x) { return x < 1 ? '<1' : String(Math.round(x)); };
    var lo = f(a), hi = f(b);
    if (lo === hi) return lo === '1' ? 'About a month' : 'About ' + lo + ' months';
    return lo + ' to ' + hi + ' months';
  }
  function years(y) {
    if (!y) return '';
    if (y[1] < 1) return Math.round(y[0] * 12) + ' to ' + Math.round(y[1] * 12) + ' months';
    var a = Math.round(y[0] * 10) / 10, b = Math.round(y[1] * 10) / 10;
    return a === b ? 'About ' + a + (a === 1 ? ' year' : ' years') : a + ' to ' + b + ' years';
  }
  /** Counts a number up in an element (instant with reduced motion). */
  function countUp(el, to, ms, fmt) {
    fmt = fmt || n0;
    if (!el) return;
    if (RM || root.classList.contains('still')) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), from = 0;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  var KIND = { trim: 'Trim', build: 'Build', recomp: 'Recomp', reveal: 'The reveal' };
  var SHORT = { trim: 'TRIM', build: 'BUILD', recomp: 'RECOMP', reveal: 'REVEAL' };
  var ICONS = {
    snack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7c-1.5-2-5-2.2-6.5.3C4 10 5.5 17 8.5 19c1.2.8 2.3.4 3.5-.2 1.2.6 2.3 1 3.5.2 3-2 4.5-9 3-11.7C17 4.8 13.5 5 12 7z"/><path d="M12 7c0-1.5.5-3 2-4"/></svg>',
    breakfast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5"/></svg>',
    addon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    meal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11"/></svg>',
  };
  var CHEV = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function iconFor(slug) {
    var s = String(slug || '');
    if (/^myfood_sn_/.test(s)) return ICONS.snack;
    if (/^myfood_bf_/.test(s)) return ICONS.breakfast;
    if (/^myfood_ao_/.test(s)) return ICONS.addon;
    return ICONS.meal;
  }
  function photo(slug, alt) {
    var e = INDEX && INDEX[slug];
    if (e && e.i) return '<img src="/images/meals/' + e.i + '.webp" alt="' + esc(alt || '') + '" loading="lazy" decoding="async" width="300" height="300">';
    return iconFor(slug);
  }
  function recipe(slug) { var e = INDEX && INDEX[slug]; return e && e.r ? e.r : null; }
  function errBox(msg) {
    return '<div class="err" role="alert"><b>That didn’t build.</b><p>' + esc(msg || 'Something went wrong on this device.') + ' Nothing was sent anywhere. Try again, or go back and change an answer.</p><button type="button" data-retry="1">Try again</button></div>';
  }

  /* ================= screens ================= */
  var SCREENS = [
    { id: 'start', sec: 'intro', r: rStart },
    { id: 'weight', sec: 'route', grp: 'About you', r: rWeight },
    { id: 'sex', sec: 'route', grp: 'About you', r: rSex },
    { id: 'bodyfat', sec: 'route', grp: 'About you', r: rBodyFat },
    { id: 'height', sec: 'route', grp: 'About you', r: rHeight },
    { id: 'age', sec: 'route', grp: 'About you', r: rAge },
    { id: 'lifting', sec: 'route', grp: 'About you', r: rLifting },
    { id: 'goalweight', sec: 'route', grp: 'Your goal', r: rGoalWeight },
    { id: 'goalbf', sec: 'route', grp: 'Your goal', r: rGoalBf },
    { id: 'route', sec: 'route', grp: 'How you get there', r: rRouteChoice, when: 'route' },
    { id: 'bulkto', sec: 'route', grp: 'How you get there', r: rBulkTo, when: 'bulkto' },
    { id: 'range', sec: 'route', grp: 'How you get there', r: rRange, when: 'range' },
    { id: 'wayin', sec: 'route', grp: 'How you get there', r: rWayIn, when: 'wayin' },
    { id: 'plan', sec: 'route', grp: 'How you get there', r: rPlan, when: 'plan' },
    { id: 'summary', sec: 'route', grp: '', r: rSummary },
    { id: 'locked', sec: 'route', grp: '', r: rLocked, noBack: true },
    { id: 'active', sec: 'food', r: rActive },
    { id: 'sessions', sec: 'food', r: rSessions },
    { id: 'meat', sec: 'food', r: rMeat },
    { id: 'allergies', sec: 'food', r: rAllergies },
    { id: 'skip', sec: 'food', r: rSkip },
    { id: 'eat', sec: 'food', r: rEat },
    { id: 'dessert', sec: 'food', r: rDessert },
    { id: 'picks', sec: 'food', r: rPicks },
    { id: 'mealbuild', sec: 'food', r: rMealBuild, build: true },
    { id: 'weekready', sec: 'food', r: rWeekReady },
    { id: 'today', sec: 'food', r: rToday },
    { id: 'shop', sec: 'food', r: rShop, side: true },
    { id: 'days', sec: 'train', r: rDays },
    { id: 'equip', sec: 'train', r: rEquip },
    { id: 'progbuild', sec: 'train', r: rProgBuild, build: true },
    { id: 'program', sec: 'train', r: rProgram },
    { id: 'keep', sec: 'done', r: rKeep },
  ];
  var IDX = {}; SCREENS.forEach(function (s, i) { IDX[s.id] = i; });
  var SECS = ['route', 'food', 'train'];
  var SEC_NAME = { route: 'Your route', food: 'Your food', train: 'Training', done: 'Done', intro: '' };

  var cur = -1, stack = [], seen = {}, token = 0, holdBuild = false;
  function trackScreen(i) {
    if (seen[i]) return; seen[i] = 1;
    try { if (window.track) window.track('try_step', { step: i + 1, screen: SCREENS[i].id }); } catch (e) {}
  }
  function progress(i) {
    var s = SCREENS[i];
    prog.hidden = s.sec === 'intro';
    root.setAttribute('data-sec', s.sec);
    var fills = $$('.segs i', prog);
    SECS.forEach(function (sec, k) {
      var ids = SCREENS.filter(function (x) { return x.sec === sec && !x.side; });
      var first = IDX[ids[0].id], last = IDX[ids[ids.length - 1].id];
      var w = i > last || s.sec === 'done' ? 100 : i < first ? 0 : Math.round(((Math.min(i, last) - first + 1) / ids.length) * 100);
      fills[k].style.width = w + '%';
    });
    // Route screens carry the app's own section names (RouteScreen SECTIONS); the summary is quiet.
    document.getElementById('segLbl').textContent = s.grp != null ? s.grp : (SEC_NAME[s.sec] || '');
    backBtn.style.visibility = s.noBack ? 'hidden' : '';
  }
  /** Shows screen i. dir: 1 forward, -1 back, 0 replace in place. */
  function show(i, dir) {
    var my = ++token;
    var old = stage.querySelector('.screen');
    var mk = function () {
      if (my !== token) return;
      cur = i;
      var el = document.createElement('section');
      el.className = 'screen ' + (dir < 0 ? 'in-l' : 'in-r');
      el.setAttribute('data-screen', SCREENS[i].id);
      stage.innerHTML = '';
      stage.appendChild(el);
      progress(i);
      trackScreen(i);
      window.scrollTo(0, 0);
      setHelp(null);
      SCREENS[i].r(el, my);
    };
    closeSheet();
    if (old && !RM && !root.classList.contains('still')) {
      old.classList.add(dir < 0 ? 'out-r' : 'out-l');
      setTimeout(mk, 170);
    } else mk();
  }
  function go(id) {
    var i = typeof id === 'number' ? id : IDX[id];
    stack.push(cur);
    try { history.pushState({ t: 1, d: stack.length }, ''); } catch (e) {}
    show(i, 1);
  }
  /** After a build: the result replaces the build screen, so Back skips it. */
  function replaceWith(id) { show(IDX[id], 1); }
  /** Whether screen i is shown for these answers (beat 9's steps exist only for some routes). */
  function applies(i) { var s = SCREENS[i]; return !!s && !s.side && (!s.when || WHEN[s.when]()); }
  function next() {
    var adv = function () { var i = cur + 1; while (SCREENS[i] && !applies(i)) i++; go(i); };
    // The route's steps depend on the plan, so the engine answers before the next one is picked.
    if (SCREENS[cur + 1] && SCREENS[cur + 1].when) { enable(false); needRV().then(adv, adv); } else adv();
  }
  function back() {
    if (!stack.length) return;
    var i = stack.pop();
    if (i < 0) i = 0;
    // Never land back on a build, or on a route step these answers no longer have.
    while (i > 0 && SCREENS[i] && (SCREENS[i].build || (SCREENS[i].when && !applies(i)))) i = stack.length ? stack.pop() : i - 1;
    show(i, -1);
  }
  backBtn.addEventListener('click', function () {
    if (!stack.length) return;
    // Screens this visit pushed go back through history, so the browser's Back agrees; a deep link steps back in place.
    if (history.state && history.state.t === 1) history.back(); else back();
  });
  window.addEventListener('popstate', function () { back(); });

  function primary(label, onClick, disabled) {
    if (!label) { cta.hidden = true; return; }
    cta.hidden = false;
    nextBtn.textContent = label;
    nextBtn.disabled = !!disabled;
    nextBtn.onclick = onClick || next;
  }
  function enable(on) { nextBtn.disabled = !on; }

  /* ---------- option cards ---------- */
  function cards(el, list, current, onPick, opts) {
    opts = opts || {};
    var html = '<div class="opts' + (opts.chips ? ' chips' : '') + (opts.tiles ? ' tiles' : '') + '" role="group">' + list.map(function (o, k) {
      var on = opts.multi ? current.indexOf(o.v) > -1 : current === o.v;
      return '<button type="button" class="opt rise' + (opts.multi ? ' multi' : '') + '" style="--i:' + (k + 2) + '" data-v="' + esc(o.v) + '" aria-pressed="' + on + '"><b>' + esc(o.l) + '</b>' + (o.h ? '<small>' + esc(o.h) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
    el.insertAdjacentHTML('beforeend', html);
    $$('.opt', el).forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute('data-v');
        var item = list.filter(function (o) { return String(o.v) === v; })[0];
        if (opts.multi) {
          b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        } else {
          $$('.opt', el).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        }
        onPick(item.v, b);
      };
    });
  }
  function head(el, ov, q, sub) {
    el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">' + ov + '</p><h1 class="qh rise" style="--i:1">' + q + '</h1>' + (sub ? '<p class="sub rise" style="--i:1">' + sub + '</p>' : ''));
  }

  /* ---------- the ruler (the app's ScaleRuler) ---------- */
  function ruler(el, o) {
    // o: min, max, step, px (px per unit), major (label every), value, fmt(value) for labels,
    // tickColor(v) (optional, the body fat zones), onChange(v)
    var wrap = document.createElement('div');
    wrap.className = 'ruler-wrap rise'; wrap.style.setProperty('--i', 3);
    wrap.innerHTML = '<div class="ruler" tabindex="0" role="slider" aria-valuemin="' + o.min + '" aria-valuemax="' + o.max + '" aria-label="' + esc(o.aria || '') + '"><div class="track"><div class="ticks"></div></div></div><div class="needle"></div>';
    el.appendChild(wrap);
    var sc = $('.ruler', wrap), track = $('.track', wrap), ticks = $('.ticks', wrap);
    var half = Math.round(sc.clientWidth / 2) || 200;
    var span = (o.max - o.min) * o.px;
    track.style.width = (span + half * 2) + 'px';
    ticks.style.left = half + 'px'; ticks.style.width = span + 'px';
    var minorPx = o.px * (o.tick || o.step), majorPx = o.px * o.major;
    var isMajor = o.isMajor || function (v) { return Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6; };
    if (o.tickColor) {
      // Zones carried in the ticks themselves (RouteBodyFatField's tickColor).
      var t = '', step = o.tick || o.step;
      for (var tv = o.min; tv <= o.max + 1e-9; tv += step) {
        var tx = ((tv - o.min) * o.px).toFixed(1), mj = isMajor(tv);
        t += '<line x1="' + tx + '" x2="' + tx + '" y1="' + (mj ? 0 : 12) + '" y2="34" stroke="' + o.tickColor(tv) + '" stroke-opacity="' + (mj ? 0.9 : 0.5) + '" stroke-width="' + (mj ? 2 : 1.5) + '"/>';
      }
      ticks.innerHTML = '<svg width="' + (span + 2) + '" height="34" style="overflow:visible;display:block">' + t + '</svg>';
    } else {
      ticks.style.background = 'repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 2px,transparent 2px ' + majorPx + 'px) 0 0/100% 34px no-repeat,repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 1.5px,transparent 1.5px ' + minorPx + 'px) 0 12px/100% 22px no-repeat';
    }
    var labels = '';
    for (var v = Math.ceil(o.min / o.major) * o.major; v <= o.max + 1e-9; v += o.major) labels += '<span class="ml" style="left:' + (half + (v - o.min) * o.px) + 'px">' + esc(o.fmt ? o.fmt(v) : v) + '</span>';
    track.insertAdjacentHTML('beforeend', labels);
    var dec = String(o.step).indexOf('.') > -1 ? String(o.step).split('.')[1].length : 0;
    var val = o.value, quiet = false, raf = 0, endT = 0;
    function snap(v) { v = Math.round((v - o.min) / o.step) * o.step + o.min; v = Math.max(o.min, Math.min(o.max, v)); return +v.toFixed(dec); }
    function place(v, smooth) { quiet = true; sc.scrollTo({ left: (v - o.min) * o.px, behavior: smooth && !RM ? 'smooth' : 'auto' }); setTimeout(function () { quiet = false; }, smooth ? 350 : 30); }
    place(val, false);
    sc.setAttribute('aria-valuenow', val);
    sc.addEventListener('scroll', function () {
      if (quiet) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var v = snap(o.min + sc.scrollLeft / o.px);
        if (v !== val) { val = v; sc.setAttribute('aria-valuenow', v); o.onChange(v, true); }
      });
      clearTimeout(endT); endT = setTimeout(function () { place(val, true); }, 140);
    }, { passive: true });
    // Mouse drag on desktop (touch scrolls natively).
    var dx = null, sl = 0;
    sc.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; dx = e.clientX; sl = sc.scrollLeft; sc.setPointerCapture(e.pointerId); sc.style.cursor = 'grabbing'; });
    sc.addEventListener('pointermove', function (e) { if (dx == null) return; sc.scrollLeft = sl - (e.clientX - dx); });
    sc.addEventListener('pointerup', function () { dx = null; sc.style.cursor = ''; });
    var kstep = o.keyStep || o.step;
    sc.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); api.set(val + kstep, false); o.onChange(val, false); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); api.set(val - kstep, false); o.onChange(val, false); }
    });
    var api = { set: function (v, smooth) { val = snap(v); sc.setAttribute('aria-valuenow', val); place(val, smooth); }, get: function () { return val; } };
    return api;
  }
  /**
   * A number beat, RouteScreen's instrument panel: the field label, the big
   * number, the ScaleRuler, and under it either the unit toggle or one line.
   * o.input makes the number typeable (only the body fat beat is, in the app).
   */
  function numBeat(el, o) {
    el.classList.add('beat');
    el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">' + o.label + '</p>' +
      '<div class="big rise" style="--i:1">' + (o.input ? '<input type="text" inputmode="decimal" maxlength="4" aria-label="' + esc(o.aria) + '">' : '<span class="ro" aria-live="polite"></span>') + '<span class="u">' + esc(o.unit) + '</span></div>');
    var input = $('.big input', el), ro = $('.big .ro', el), unitEl = $('.big .u', el);
    var show = function (v) {
      if (ro) ro.textContent = o.disp ? o.disp(v) : v;
      if (o.unitFor) unitEl.textContent = o.unitFor(v);
      if (o.under) $('.under', el).textContent = o.under(v);
    };
    var r = ruler(el, { min: o.min, max: o.max, step: o.step, px: o.px, major: o.major, tick: o.tick, isMajor: o.isMajor, fmt: o.fmt, tickColor: o.tickColor, keyStep: o.keyStep, value: o.value, aria: o.aria, onChange: function (v) { show(v); o.onChange(v); } });
    if (o.units) {
      el.insertAdjacentHTML('beforeend', '<div class="rise" style="--i:4"><div class="unit-tog" role="group" aria-label="Units"><button type="button" data-u="metric" aria-pressed="' + (S.units === 'metric') + '">' + o.units[0] + '</button><button type="button" data-u="imperial" aria-pressed="' + (S.units === 'imperial') + '">' + o.units[1] + '</button></div></div>');
      $$('.unit-tog button', el).forEach(function (b) { b.onclick = function () { if (S.units === b.getAttribute('data-u')) return; S.units = b.getAttribute('data-u'); SCREENS[cur].r(rerender(el), token); }; });
    }
    if (o.under) el.insertAdjacentHTML('beforeend', '<p class="under rise" style="--i:4"></p>');
    show(o.value);
    return { ruler: r, show: show, input: input };
  }
  function rerender(el) { el.innerHTML = ''; el.className = 'screen norise'; return el; }

  /* ================= intro ================= */
  function rStart(el) {
    el.classList.add('start');
    el.innerHTML = '<p class="ov rise" style="--i:0;color:var(--text-3)">Try JSON.fit</p>' +
      '<h1 class="qh rise" style="--i:1">See your plan<br><em style="color:var(--cyan);text-transform:none">in 60 seconds.</em></h1>' +
      '<p class="sub rise" style="--i:2">No sign-up. Answer a few questions, then watch the app’s engines build your route, your week of meals and your training.</p>' +
      '<div class="rise" style="--i:3"><span class="privacy"><i></i>Runs on this page. Nothing you enter is sent anywhere.</span></div>' +
      '<div class="trio rise" style="--i:4"><div><i>01</i><p><b>Your route</b><span>Your goal, your phases, how long it takes.</span></p></div>' +
      '<div><i>02</i><p><b>Your food</b><span>A week of meals, one cook day, one shop.</span></p></div>' +
      '<div><i>03</i><p><b>Your training</b><span>Sets, reps, rest and how hard to push.</span></p></div></div>';
    primary('Start', function () { startWorker(); ensureAbout().then(function () { go('weight'); }, function (e) { el.insertAdjacentHTML('beforeend', errBox(e.message)); }); });
    startWorker();
  }

  /* ================= your route (RouteScreen.tsx, beat by beat) =================
   * The app's walk: 1 weight, 2 sex, 3 body fat, 4 height, 6 age, 5 experience,
   * 7 goal weight, 8 goal body fat, 9 the route (with the questions each answer
   * opens: the capped peak, the range, the way in, then the plan), 10 the summary
   * and the lock, then the celebration and RouteReveal's finish line. Copy is the
   * app's, word for word, except where the README of each function says otherwise.
   */
  function ensureAbout() {
    if (S.about) return Promise.resolve();
    return call('defaults', 'male').then(function (d) {
      S.defaults = d;
      S.about = {
        sex: null, ageYears: d.ageYears, heightCm: d.heightCm, weightKg: d.weightKg, bodyFatPct: d.bodyFatPct, bodyFatSource: 'visual', bfText: '',
        goalWeightKg: null, goalBodyFatPct: d.goalBodyFatPct, belowFloorOk: false, trainingState: null, activityLevel: null, trainingSessionsPerWeek: null,
        route: 'lean', bottom: null, top: null, bulkTo: null, wayIn: 'cut',
      };
    });
  }
  function needAbout(el, my, fn) {
    if (S.about) { fn(); return; }
    el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
    ensureAbout().then(function () { if (my === token) { el.innerHTML = ''; fn(); } });
  }
  var imp = function () { return S.units === 'imperial'; };
  var LB = 2.2046226218;
  /** RouteScreen's provisionalGoalW: the stored goal weight, or the default for this frame at the goal body fat. */
  function goalW() {
    var a = S.about;
    if (a.goalWeightKg != null) return a.goalWeightKg;
    var m = a.heightCm / 100, fem = a.sex === 'female';
    var lean = function (n) { return (n - 6.3 * (1.8 - m)) * m * m; };
    var w = function (l) { return l / (1 - a.goalBodyFatPct / 100); };
    return Math.round(((w(lean(fem ? 16 : 19)) + w(lean(fem ? 21 : 24))) / 2) * 2) / 2;
  }
  /** "Pick one to continue" while a choice beat has no answer, as the app's CTA says. */
  function pickCta(on) { primary(on ? 'Continue' : 'Pick one to continue', null, !on); }

  /* ---------- help, the (i) in the top bar (RouteScreen helpFor) ---------- */
  var HELP_SEX = {
    title: 'Why we ask',
    body: 'Body fat ranges and muscle limits differ between male and female bodies, so your answer changes the numbers this app works from. It is used for those calculations and nothing else.',
  };
  var HELP_GOALBF_M = {
    title: 'Why this range',
    body: 'Lean enough that the muscle you have built actually shows. Shoulders, arms, the taper at the waist. Ratings peak here and fall away on both sides, so going leaner past it stops paying off.\n\nIt shows in your face as well: the jaw and cheekbones come out as the fat over them goes.\n\nWhere that happens for you depends on where you store fat, so this is a range rather than a number.',
    sources: 'Xia et al. 2025, Personality and Individual Differences, 283 raters, DXA measured · Coetzee et al. 2009, Perception · de Jager et al. 2018, Frontiers in Psychology · Brierley et al. 2016, PLOS ONE',
  };
  var HELP_GOALBF_F = {
    title: 'Why nothing is marked',
    body: 'The male research lands on a clear peak. The research on women does not, so there is no single figure to mark and this app will not invent one.\n\nLeaning out still shows the same way: the body first, and the face after it.\n\nOne finding worth knowing. When female faces were rated, the level judged most attractive was leaner than the level judged healthiest.',
    sources: 'Wang et al., PLOS ONE, ten populations, DXA measured · Coetzee et al. 2011, Body Image · de Jager et al. 2018, Frontiers in Psychology',
  };
  var HELP_ROUTE = {
    title: 'Same finish either way',
    body: 'Same muscle, same total time either way. What you are choosing is how you look while you get there.',
    groups: [
      { title: 'Stay lean the whole way', points: ['Defined the whole way, and it shows in your face first', 'A surplus started leaner adds less fat', 'Cost: a smaller frame while you get there, and more cuts to hold it'] },
      { title: 'Grow now, cut at the end', points: ['Bigger sooner, and never smaller than you are today', 'Stop early and you finish bigger, not just leaner', 'Cost: softer the whole way through, and one long cut at the end'] },
      { title: 'What is not known', points: ['No trial has compared the two', 'Growing lean and growing soft have not been shown to build different amounts of muscle', 'Reasoned defaults, not proven ones'] },
    ],
    sources: 'Helms 2023 · Garthe 2013 · Murphy and Koehler 2022 · Galgani 2025',
  };
  var HELP_WAYIN = {
    title: 'Getting into your range',
    body: 'All three arrive at the same body fat with the same muscle, and the plan finishes at the same time whichever you pick. What differs is what the scale reads on the way, and how long you stay soft.',
    groups: [
      { title: 'Hold your weight', points: ['Fat leaves only as fast as muscle arrives, so the scale sits still while the shape changes', 'Eating at maintenance, which is the easiest of the three to keep to', 'Cost: soft for longer, and nothing you can measure at home confirms it is working'] },
      { title: 'Ease it down', points: ['A small deficit. In the one small trial that tested it, the same muscle was gained and more fat was lost than holding weight, though the gap was not statistically significant', 'Cost: a deficit that small is inside most people’s tracking error, so it is really letting the scale drift'] },
      { title: 'Cut', points: ['Lean soonest, and the one the scale can confirm within a few weeks', 'Cost: the harder stretch of eating, and a smaller frame until the build brings it back'] },
      { title: 'What is not known', points: ['No trial has followed any of the three through a whole plan', 'The one trial comparing a small deficit with maintenance ran ten weeks with ten people per arm'] },
    ],
    sources: 'Vargas-Molina 2026 · Garthe 2011 · Murphy and Koehler 2022',
  };
  function helpSheet(h) {
    openSheet('<p class="sh-ov">Why we ask</p><h2 class="sh-t">' + esc(h.title) + '</h2>' +
      h.body.split('\n\n').map(function (p) { return '<p class="sh-b">' + esc(p) + '</p>'; }).join('') +
      (h.groups || []).map(function (g) { return '<div class="hg"><p class="hg-t">' + esc(g.title) + '</p><ul>' + g.points.map(function (pt) { return '<li>' + esc(pt) + '</li>'; }).join('') + '</ul></div>'; }).join('') +
      (h.sources ? '<p class="sh-src">' + esc(h.sources) + '</p>' : '') +
      '<button type="button" class="sh-ghost" data-close="1">Got it</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
  }
  function setHelp(h) {
    infoBtn.hidden = !h;
    infoBtn.onclick = h ? function () { helpSheet(typeof h === 'function' ? h() : h); } : null;
  }

  /* ---------- BodyPictogram.tsx: the restroom-sign body, widening with body fat ---------- */
  function pictogram(bf, sex, h, color) {
    var fem = sex === 'female', t = Math.min(1, Math.max(0, (bf - (6 + (fem ? 9 : 0))) / 28)), CX = 60;
    var sh = (fem ? 22 : 27) + t * 9, wa = (fem ? 19 : 22) + t * 13, hip = (fem ? 30 : 22) + t * 13, lo = (fem ? 15 : 16) + t * 6;
    var body = fem
      ? 'M' + (CX - sh) + ' 48 Q' + CX + ' 39 ' + (CX + sh) + ' 48 L' + (CX + wa) + ' 104 L' + (CX + hip) + ' 118 L' + (CX - hip) + ' 118 L' + (CX - wa) + ' 104 Z'
      : 'M' + (CX - sh) + ' 48 Q' + CX + ' 39 ' + (CX + sh) + ' 48 L' + (CX + wa) + ' 104 L' + (CX + wa * 0.94) + ' 118 L' + (CX - wa * 0.94) + ' 118 L' + (CX - wa) + ' 104 Z';
    var leg = function (s) { return 'M' + (CX + s * lo) + ' 118 L' + (CX + s * 3.5) + ' 118 L' + (CX + s * 3.5) + ' 186 L' + (CX + s * (lo - 2)) + ' 186 Z'; };
    return '<svg width="' + (h * 0.6).toFixed(0) + '" height="' + h + '" viewBox="0 0 120 200" aria-hidden="true" fill="' + color + '"><circle cx="60" cy="26" r="13"/><path d="' + body + '"/><path d="' + leg(-1) + '"/><path d="' + leg(1) + '"/></svg>';
  }

  /* ---------- beat 1: CURRENT WEIGHT ---------- */
  function rWeight(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      numBeat(el, {
        label: 'Current weight', aria: 'Current weight', units: ['kg', 'lbs'], unit: imp() ? 'lbs' : 'kg',
        value: imp() ? Math.round(a.weightKg * LB) : r1(a.weightKg), min: imp() ? 77 : 35, max: imp() ? 440 : 200, step: imp() ? 1 : 0.1, tick: imp() ? 1 : 0.5, px: imp() ? 6 : 13, major: imp() ? 10 : 5, keyStep: 1,
        disp: function (v) { return imp() ? v : v.toFixed(1); },
        onChange: function (v) { a.weightKg = imp() ? v / LB : v; },
      });
      primary('Continue');
    });
  }
  /* ---------- beat 2: SEX ---------- */
  function rSex(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      el.classList.add('beat');
      el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">Sex</p><div class="sexpair rise" style="--i:1" role="group">' +
        [['male', 'Male', 14], ['female', 'Female', 23]].map(function (x) {
          return '<button type="button" class="sexpick" data-sex="' + x[0] + '" aria-pressed="' + (a.sex === x[0]) + '"><span class="fig" data-bf="' + x[2] + '"></span><b>' + x[1] + '</b></button>';
        }).join('') + '</div>');
      var paint = function () {
        $$('.sexpick', el).forEach(function (b) {
          var on = a.sex === b.getAttribute('data-sex');
          b.setAttribute('aria-pressed', on);
          $('.fig', b).innerHTML = pictogram(+$('.fig', b).getAttribute('data-bf'), b.getAttribute('data-sex'), 72, on ? 'var(--acc)' : '#52525b');
        });
      };
      paint();
      $$('.sexpick', el).forEach(function (b) {
        b.onclick = function () {
          // Continue waits for the sex-dependent defaults to reload; no auto-advance.
          var v = b.getAttribute('data-sex'), changed = a.sex !== v;
          a.sex = v; paint(); enable(!changed);
          nextBtn.textContent = 'Continue';
          if (changed) refreshForSex().then(function () { if (my === token) enable(true); });
        };
      });
      setHelp(HELP_SEX);
      pickCta(!!a.sex);
    });
  }
  /** Seeds that follow sex until answered (RouteScreen: heightSeed, placeholderBodyFat, defaultGoalBodyFatFor). */
  function refreshForSex() {
    var a = S.about, t = S.touched;
    return call('defaults', a.sex).then(function (d) {
      S.defaults = d;
      if (!t.heightCm) a.heightCm = d.heightCm;
      if (!t.bodyFatPct) a.bodyFatPct = d.bodyFatPct;
      if (!t.goalBodyFatPct) a.goalBodyFatPct = d.goalBodyFatPct;
    });
  }
  /* ---------- beat 3: CURRENT BODY FAT (RouteBodyFatField) ---------- */
  var BF_ZONES = [{ to: 12, label: 'Lean', c: '#38bdf8' }, { to: 16, label: 'Athletic', c: '#34d399' }, { to: 22, label: 'Average', c: '#f0b429' }, { to: Infinity, label: 'Higher', c: '#a1a1aa' }];
  function bfZone(pct, sex) {
    var sh = sex === 'female' ? 9 : 0;
    for (var i = 0; i < BF_ZONES.length; i++) if (pct < BF_ZONES[i].to + (BF_ZONES[i].to === Infinity ? 0 : sh)) return BF_ZONES[i];
    return BF_ZONES[BF_ZONES.length - 1];
  }
  function tierPick(t, last) { return last ? t.range[0] + 6 : Math.round((t.range[0] + t.range[1]) / 2); }
  function rBodyFat(el, my) {
    needAbout(el, my, function () {
      var a = S.about, sex = a.sex;
      var b = numBeat(el, {
        label: 'Current body fat', aria: 'Body fat', unit: '%', input: true, value: Math.round(a.bodyFatPct), min: 5, max: 45, step: 1, px: 13, major: 5,
        tickColor: function (v) { return bfZone(v, sex).c; },
        onChange: function (v) { a.bodyFatPct = v; a.bodyFatSource = 'reported'; a.bfText = String(v); S.touched.bodyFatPct = true; paint(); },
      });
      el.insertAdjacentHTML('beforeend', '<p class="zone rise" style="--i:4"></p><p class="notsure rise" style="--i:5"><span>Not sure? </span><button type="button" class="linkb" id="est">Estimate it</button></p>');
      var input = b.input;
      // The placeholder is today's figure in full colour: Continue takes it as the answer.
      input.placeholder = String(Math.round(a.bodyFatPct));
      var paint = function () {
        input.value = a.bfText || '';
        input.placeholder = String(Math.round(a.bodyFatPct));
        fit();
        var z = bfZone(a.bodyFatPct, sex), zl = $('.zone', el);
        zl.textContent = z.label; zl.style.color = z.c;
      };
      function fit() { input.style.width = (Math.max(1, (input.value || input.placeholder).length) * 0.62 + 0.15) + 'em'; }
      paint();
      input.addEventListener('input', function () {
        fit();
        var t = input.value.replace(',', '.').replace(/[^0-9.]/g, '');
        input.value = t;
        var v = parseFloat(t);
        if (!isFinite(v) || v < 3 || v > 60) return;
        a.bodyFatPct = v; a.bodyFatSource = 'reported'; a.bfText = t; S.touched.bodyFatPct = true;
        b.ruler.set(Math.round(Math.min(45, Math.max(5, v))), true);
        var z = bfZone(v, sex), zl = $('.zone', el); zl.textContent = z.label; zl.style.color = z.c;
      });
      input.addEventListener('focus', function () { input.select(); });
      $('#est', el).onclick = function () {
        var tiers = S.defaults.tiers, n = tiers.length;
        var pending = (function () { for (var i = 0; i < n; i++) if (a.bodyFatPct <= tiers[i].range[1]) return i; return n - 1; })();
        openSheet('<p class="sh-ov">Body fat</p><h2 class="sh-t">Pick the closest.</h2><p class="sh-lede">A rough match is fine. Lands within a few points for most people.</p><div class="tiers">' +
          tiers.map(function (t, i) {
            var last = i === n - 1;
            return '<button type="button" class="tier" data-tier="' + i + '" aria-pressed="false" aria-label="' + esc(t.description) + '"><span class="tf"></span><b>' + (last ? t.range[0] + '%+' : t.range[0] + '–' + t.range[1] + '%') + '</b><small>' + esc(t.description) + '</small></button>';
          }).join('') + '</div><button type="button" class="sh-go" id="useTier"></button>', function (sh) {
          var paintT = function () {
            $$('[data-tier]', sh).forEach(function (x, i) {
              var on = i === pending;
              x.setAttribute('aria-pressed', on);
              $('.tf', x).innerHTML = pictogram(tierPick(tiers[i], i === n - 1), sex, 82, on ? 'var(--acc)' : '#52525b');
            });
            $('#useTier', sh).textContent = 'Use ' + tierPick(tiers[pending], pending === n - 1) + '%';
          };
          paintT();
          $$('[data-tier]', sh).forEach(function (x) { x.onclick = function () { pending = +x.getAttribute('data-tier'); paintT(); }; });
          $('#useTier', sh).onclick = function () {
            var v = tierPick(tiers[pending], pending === n - 1);
            a.bodyFatPct = v; a.bodyFatSource = 'visual'; a.bfText = String(v); S.touched.bodyFatPct = true;
            closeSheet(); b.ruler.set(v, true); paint();
          };
        });
      };
      primary('Continue', function () { S.touched.bodyFatPct = true; next(); });
    });
  }
  /* ---------- beat 4: HEIGHT ---------- */
  function rHeight(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      var ftin = function (i) { i = Math.round(i); return Math.floor(i / 12) + '\'' + (i % 12); };
      numBeat(el, {
        label: 'Height', aria: 'Height', units: ['cm', 'ft in'], unit: imp() ? '"' : 'cm',
        value: imp() ? Math.round(a.heightCm / 2.54) : Math.round(a.heightCm), min: imp() ? 48 : 120, max: imp() ? 86 : 220, step: 1, px: imp() ? 20 : 13, major: imp() ? 6 : 5,
        fmt: imp() ? function (v) { return ftin(v) + '"'; } : null, disp: imp() ? ftin : null,
        onChange: function (v) { a.heightCm = imp() ? v * 2.54 : v; S.touched.heightCm = true; },
      });
      primary('Continue', function () { S.touched.heightCm = true; next(); });
    });
  }
  /* ---------- beat 6: AGE ---------- */
  function rAge(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      numBeat(el, { label: 'Age', aria: 'Age', unit: 'years', value: a.ageYears, min: 13, max: 100, step: 1, px: 14, major: 5, onChange: function (v) { a.ageYears = v; }, under: function () { return 'Sets your calorie targets when you build a meal plan.'; } });
      primary('Continue');
    });
  }
  /* ---------- beat 5: EXPERIENCE ---------- */
  var LIFT = [
    { v: 'new', l: 'Just starting', h: 'New to lifting, or under a year in' },
    { v: 'returning', l: 'Coming back', h: 'Trained before, had time off' },
    { v: 'consistent', l: 'In the groove', h: 'Training regularly and still progressing' },
    { v: 'advanced', l: 'Advanced', h: 'Years of hard, structured training. Gains come slowly now' },
  ];
  function rLifting(el, my) {
    needAbout(el, my, function () {
      el.classList.add('beat');
      el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">Experience</p><h1 class="expq rise" style="--i:1">Where are you with lifting?</h1>');
      cards(el, LIFT, S.about.trainingState, function (v) { S.about.trainingState = v; pickCta(true); });
      pickCta(!!S.about.trainingState);
    });
  }
  /* ---------- beat 7: GOAL WEIGHT ---------- */
  function rGoalWeight(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      var w = goalW();
      numBeat(el, {
        label: 'Goal weight', aria: 'Goal weight', unit: imp() ? 'lbs' : 'kg',
        value: imp() ? Math.round(w * LB) : Math.round(w * 2) / 2, min: imp() ? 77 : 35, max: imp() ? 440 : 200, step: imp() ? 1 : 0.5, tick: imp() ? 1 : 0.5, px: imp() ? 6 : 13, major: imp() ? 10 : 5, keyStep: imp() ? 1 : 0.5,
        disp: function (v) { return imp() ? v : v.toFixed(1); },
        under: function (v) {
          var kg = imp() ? v / LB : v, d = kg - a.weightKg;
          if (Math.abs(d) < 0.05) return 'the same as you weigh now';
          return imp() ? (d > 0 ? '+' : '') + (d * LB).toFixed(0) + ' lbs from where you are now' : (d > 0 ? '+' : '') + d.toFixed(1) + ' kg from where you are now';
        },
        onChange: function (v) { a.goalWeightKg = imp() ? v / LB : v; },
      });
      primary('Continue');
    });
  }
  /* ---------- beat 8: GOAL BODY FAT (LeanGauge) ---------- */
  function rGoalBf(el, my) {
    needAbout(el, my, function () {
      leanGauge(el, S.about);
      setHelp(function () { return S.about.sex === 'female' ? HELP_GOALBF_F : HELP_GOALBF_M; });
      // The commitment point: the goal weight shown is the one the plan keeps.
      primary('Continue', function () { S.about.goalWeightKg = goalW(); S.touched.goalBodyFatPct = true; next(); });
    });
  }
  /* ---------- the app's LeanGauge (src/components/route/LeanGauge.tsx) ----------
   * Body fat axis 6 to 30% (women +9). The curve is illustrative: how ordinary the
   * muscle this goal weight implies is, peaking halfway between untrained and the
   * drug-free limit (FFMI). Shaded left of the ceiling: lean enough at this weight
   * that the muscle would be past what has been recorded drug free. Most aesthetic
   * band 10 to 15% (men only, ATTRACTIVE_BF_RANGE). Health floor leanStopFor: 12% men,
   * 22% women; letting go below it asks first (RouteScreen's ConfirmSheet). While no
   * goal weight is set, the goal weight follows the goal body fat (provisionalGoalW),
   * so the curve moves with the pin, as in the app. */
  function leanGauge(el, a) {
    var fem = a.sex === 'female', sh = fem ? 9 : 0, lo = 6 + sh, hi = 30 + sh;
    var floor = fem ? 22 : 12, AES = [10, 15], AES_C = 13;
    var lim = fem ? { ok: 21, edge: 22 } : { ok: 24, edge: 25.5 }, untr = fem ? 16 : 19;
    var peak = (untr + lim.ok) / 2, sig = Math.max(1, (lim.ok - untr) / 2.6);
    var W = 320, H = 150, X0 = 20, X1 = 300, Y0 = 16, YB = 110;
    var m = a.heightCm / 100;
    var xOf = function (bf) { return X0 + Math.min(1, Math.max(0, (bf - lo) / (hi - lo))) * (X1 - X0); };
    el.classList.add('beat');
    el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">Goal body fat</p>' +
      '<div class="big rise" style="--i:1"><span class="ro" aria-live="polite"></span><span class="u">%</span></div>' +
      '<div class="rise lgw" style="--i:2"><svg class="lg" viewBox="0 0 ' + W + ' ' + H + '" role="slider" tabindex="0" aria-label="Goal body fat" aria-valuemin="' + lo + '" aria-valuemax="' + hi + '"></svg></div>' +
      '<div class="snap rise" style="--i:3"></div>');
    var g = $('svg.lg', el), ro = $('.big .ro', el), snap = $('.snap', el);
    function draw(pinBf) {
      var gw = goalW();
      var nAt = function (bf) { var lean = gw * (1 - bf / 100); return lean / (m * m) + 6.3 * (1.8 - m); };
      var yAt = function (bf) { var z = (nAt(bf) - peak) / sig; return YB - (YB - Y0) * Math.exp(-0.5 * z * z); };
      var edge = null; for (var b = lo; b <= hi; b += 0.1) { if (nAt(b) <= lim.edge) { edge = b; break; } }
      var path = function (f, t, n) { var d = ''; for (var i = 0; i <= n; i++) { var bf = f + (t - f) * i / n; d += (i ? ' L' : 'M') + xOf(bf).toFixed(1) + ' ' + yAt(bf).toFixed(1); } return d; };
      var curve = path(lo, hi, 90);
      var px = xOf(pinBf).toFixed(1);
      g.innerHTML = '<defs><linearGradient id="lgB" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0a0a0b" stop-opacity="0"/><stop offset="1" stop-color="#0a0a0b" stop-opacity=".72"/></linearGradient></defs>' +
        '<path d="' + curve + ' L' + X1 + ' ' + YB + ' L' + X0 + ' ' + YB + ' Z" fill="#fff" opacity=".035"/>' +
        (fem ? '' : '<path d="' + path(AES[0], AES[1], 30) + ' L' + xOf(AES[1]).toFixed(1) + ' ' + YB + ' L' + xOf(AES[0]).toFixed(1) + ' ' + YB + ' Z" class="aes"/>') +
        '<path d="' + curve + '" fill="none" stroke="#4b4b52" stroke-width="1.8" stroke-linecap="round"/><line x1="' + X0 + '" x2="' + X1 + '" y1="' + YB + '" y2="' + YB + '" stroke="#232327"/>' +
        (edge != null && edge > lo + 0.2 ? '<rect x="' + X0 + '" y="' + Y0 + '" width="' + Math.max(0, xOf(edge) - X0).toFixed(1) + '" height="' + (YB - Y0) + '" fill="url(#lgB)"/><line x1="' + xOf(edge).toFixed(1) + '" x2="' + xOf(edge).toFixed(1) + '" y1="' + (Y0 - 4) + '" y2="' + YB + '" stroke="#52525b" stroke-dasharray="3 4"/><text x="' + Math.max(X0 + 46, xOf(edge) - 46).toFixed(1) + '" y="' + (YB + 17) + '" class="lgt">Past the ceiling</text>' : '') +
        (floor > lo && floor < hi ? '<line x1="' + xOf(floor) + '" x2="' + xOf(floor) + '" y1="' + (Y0 + 2) + '" y2="' + YB + '" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="2 3"/><text x="' + xOf(floor) + '" y="' + (Y0 - 2) + '" class="lgt fl">Health floor ' + floor + '%</text>' : '') +
        (fem ? '' : '<text x="' + ((xOf(AES[0]) + xOf(AES[1])) / 2).toFixed(1) + '" y="' + (YB + 17) + '" class="lgt ae">Most aesthetic</text>') +
        '<line class="pin" x1="' + px + '" x2="' + px + '" y1="' + (Y0 - 6) + '" y2="' + YB + '"/><circle class="pind" r="5.5" cx="' + px + '" cy="' + yAt(pinBf).toFixed(1) + '"/>';
    }
    // The slot under the gauge has a fixed height, like the app's snapSlot, so nothing jumps.
    function note() {
      var v = a.goalBodyFatPct;
      if (v < floor && !a.belowFloorOk) {
        snap.innerHTML = '<button type="button" class="snapbtn">Your plan stops at ' + floor + '%. Go lower?</button>';
        $('.snapbtn', snap).onclick = function () { ask(v); };
      } else if (!fem && (v < AES[0] || v > AES[1])) {
        snap.innerHTML = '<button type="button" class="snapbtn">Take me to most aesthetic</button>';
        $('.snapbtn', snap).onclick = function () { set(AES_C); };
      } else snap.innerHTML = '';
    }
    function set(v, live) {
      a.goalBodyFatPct = v; S.touched.goalBodyFatPct = true;
      ro.textContent = v.toFixed(1); g.setAttribute('aria-valuenow', v);
      draw(live != null ? live : v);
      note();
    }
    /** RouteScreen's floor ConfirmSheet: one explicit yes. Any other way out keeps the floor. */
    function ask(pct) {
      openSheet('<div class="cf"><span class="chip"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span>' +
        '<h2 class="sh-t c">Plan below ' + floor + '%?</h2><p class="sh-b c">' + (fem
          ? 'Below about ' + floor + '% body fat, periods can stop and bone health starts to suffer, so this is where the app stops a plan by default. You can still aim for ' + pct + '% and the plan will take you there. It is worth doing with a doctor in the loop.'
          : 'Below about ' + floor + '% body fat, hormones, sleep and recovery tend to suffer and it is hard to hold, so this is where the app stops a plan by default. You can still aim for ' + pct + '% and the plan will take you there.') +
        '</p><button type="button" class="sh-go" data-a="go">Plan to ' + pct + '%</button><button type="button" class="sh-sec" data-a="keep">Keep ' + floor + '%</button></div>', function (sh) {
        $('[data-a="go"]', sh).onclick = function () { a.belowFloorOk = true; closeSheet(); set(pct); };
        $('[data-a="keep"]', sh).onclick = function () { closeSheet(); set(floor); };
      }, function () { set(floor); });
    }
    function commit(v) {
      if (v < floor && !a.belowFloorOk) { set(v); ask(v); return; }
      if (v >= floor) a.belowFloorOk = false;
      set(v);
    }
    var drag = false, last = a.goalBodyFatPct;
    function at(e) { var r = g.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width * W - X0) / (X1 - X0); return lo + Math.min(1, Math.max(0, t)) * (hi - lo); }
    function move(e) { var raw = at(e); last = Math.min(hi, Math.max(lo, Math.round(raw))); set(last, raw); }
    g.addEventListener('pointerdown', function (e) { drag = true; g.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
    g.addEventListener('pointermove', function (e) { if (drag) move(e); });
    var up = function () { if (drag) { drag = false; commit(last); } };
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    g.addEventListener('keydown', function (e) { var d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (d) { commit(Math.min(hi, Math.max(lo, Math.round(a.goalBodyFatPct) + d))); e.preventDefault(); } });
    set(a.goalBodyFatPct);
  }

  /* ---------- beat 9: the route, and the questions each answer opens ---------- */
  function needRV() {
    var k = keyOf(aboutForEngine());
    if (S.rvKey === k && S.rv) return Promise.resolve(S.rv);
    if (S.rvP && S.rvPKey === k) return S.rvP;
    S.rvPKey = k;
    S.rvP = call('routeView', aboutForEngine()).then(function (v) { if (S.rvPKey === k) { S.rv = v; S.rvKey = k; S.rvP = null; } return v; }, function (e) { if (S.rvPKey === k) S.rvP = null; throw e; });
    return S.rvP;
  }
  /** Redraws a beat 9 screen after a tap, once the engine has the new plan; the old content holds until then. */
  function redraw(el, my) { needRV().then(function () { if (my === token) SCREENS[cur].r(rerender(el), my); }, function () {}); }
  var ROUTES = [
    { v: 'lean', l: 'Stay lean the whole way' },
    { v: 'bulk', l: 'Grow now, cut at the end' },
    { v: 'capped', l: 'Grow now, up to a limit' },
  ];
  var CUT_WORDS = ['No cuts', 'One cut', 'Two cuts', 'Three cuts', 'Four cuts', 'Five cuts', 'Six cuts'];
  var cutWords = function (n) { return CUT_WORDS[n] || n + ' cuts'; };
  function routeLine(id, openingCut) {
    if (id === 'lean') return openingCut ? 'More defined and a sharper jawline, but a smaller frame while you get there.' : 'More defined the whole way, and never a long stretch of being soft.';
    if (id === 'bulk') return 'Bigger sooner and filling out shirts, but softer the whole way.';
    return 'Bigger sooner without going past a number you pick, but cutting back each time you get there.';
  }
  function aboutForEngine() { var a = S.about; return Object.assign({}, a, { sex: a.sex || 'male', goalWeightKg: goalW(), trainingState: a.trainingState || 'consistent', activityLevel: a.activityLevel || 'light', trainingSessionsPerWeek: a.trainingSessionsPerWeek == null ? 3.5 : a.trainingSessionsPerWeek }); }
  function withRV(el, my, fn) { withData(el, my, needRV, '', function (rv) { setHelp(HELP_ROUTE); fn(rv); }); }
  /** Beat 9's "Continue", or "See the whole plan" once the range has nothing left to ask. */
  function wayCta(label) { primary(label, function () { enable(false); needRV().then(next, next); }); }
  function rRouteChoice(el, my) {
    needAbout(el, my, function () {
      withRV(el, my, function (rv) {
        var a = S.about;
        el.insertAdjacentHTML('beforeend', '<h1 class="rq rise" style="--i:0">Do you want to stay lean while you grow?</h1><p class="rs rise" style="--i:1">You are at ' + Math.round(a.bodyFatPct) + '% body fat today. Both finish at ' + Math.round(a.goalBodyFatPct) + '%.</p>' +
          '<div class="opts rise" style="--i:2" role="radiogroup">' + ROUTES.map(function (x) {
            var pv = rv.previews[x.v], on = a.route === x.v;
            return '<button type="button" class="opt ropt" role="radio" data-v="' + x.v + '" aria-checked="' + on + '" aria-pressed="' + on + '">' +
              (pv ? '<span class="mini">' + journeyChart(a.bodyFatPct, pv, { compact: true, band: x.v !== 'bulk', color: on ? 'var(--acc)' : '#54545e' }) + '</span>' : '') +
              '<span class="om"><b>' + esc(x.l) + '</b><small>' + esc(routeLine(x.v, rv.openingCut)) + '</small><i>' + esc(cutWords(pv ? pv.cuts : 0)) + '</i></span></button>';
          }).join('') + '</div>');
        $$('.ropt', el).forEach(function (b) {
          b.onclick = function () {
            var v = b.getAttribute('data-v');
            if (v === a.route) return;
            a.route = v;
            if (v === 'capped' && a.bulkTo == null) a.bulkTo = rv.defaultBulkTo;
            $$('.ropt', el).forEach(function (x) { var on = x === b; x.setAttribute('aria-pressed', on); x.setAttribute('aria-checked', on); });
            redraw(el, my);
          };
        });
        wayCta(rv.rangeMatters ? 'Continue' : 'See the whole plan');
      });
    });
  }
  /** Shared by the bulk-to and range screens: a hairline row with a value between − and +. */
  function edgeRow(key, label, val, minusOff) {
    return '<div class="erow"><span class="ek">' + label + '</span><span class="ectl"><button type="button" class="stp" data-k="' + key + '" data-d="-1"' + (minusOff ? ' disabled' : '') + ' aria-label="Lower the ' + label.toLowerCase() + '">−</button><b>' + val + '%</b><button type="button" class="stp" data-k="' + key + '" data-d="1" aria-label="Raise the ' + label.toLowerCase() + '">+</button></span></div>';
  }
  /* The capped answer's question: how big before the first cut. */
  function rBulkTo(el, my) {
    needAbout(el, my, function () {
      withRV(el, my, function (rv) {
        var a = S.about, at = a.bulkTo != null ? a.bulkTo : rv.defaultBulkTo;
        el.insertAdjacentHTML('beforeend', '<h1 class="rq rise" style="--i:0">How big do you get before your first cut?</h1><p class="rs rise" style="--i:1">You grow from where you are today up to this point, then cut back.</p>' +
          '<div class="rise" style="--i:2">' + journeyChart(a.bodyFatPct, rv.roadmap, { bare: true, bandOnly: true, frame: true, targetPct: at }) + '</div>' +
          '<div class="erows rise" style="--i:3">' + edgeRow('bulk', 'Bulk up to', at, at <= rv.bulkFloor) + '</div>');
        $$('.stp', el).forEach(function (b) {
          b.onclick = function () {
            var nx = Math.max(rv.bulkFloor, Math.round((at + (+b.getAttribute('data-d')) * 0.5) * 2) / 2);
            if (nx === at) return;
            a.bulkTo = nx; $('.erow b', el).textContent = nx + '%'; redraw(el, my);
          };
        });
        wayCta('Continue');
      });
    });
  }
  /* The range: both edges, with the recommendation as the button. */
  function rRange(el, my) {
    needAbout(el, my, function () {
      withRV(el, my, function (rv) {
        var a = S.about, r = rv.range, lo = r.bottom, hi = r.top;
        var atStop = lo <= r.leanStop, atMin = hi - lo <= r.minWidth, onSug = lo === r.suggestedBottom && hi === r.suggestedTop;
        el.insertAdjacentHTML('beforeend', '<h1 class="rq rise" style="--i:0">What body fat do you want to sit at?</h1>' +
          '<button type="button" class="rec rise" style="--i:1"' + (onSug ? ' disabled' : '') + '><span>We recommend ' + r.suggestedBottom + ' to ' + r.suggestedTop + '%</span><b>' + (onSug ? 'In use' : 'Use') + '</b></button>' +
          '<div class="rise" style="--i:2">' + journeyChart(a.bodyFatPct, rv.roadmap, { bare: true, bandOnly: true, frame: true, leanStopPct: rv.leanStop }) + '</div>' +
          '<div class="erows rise" style="--i:3">' + edgeRow('hi', 'Top', hi, atMin) + edgeRow('lo', 'Bottom', lo, atStop) + '</div>' +
          // Both limit lines have their room reserved, so the screen never grows when one appears.
          '<div class="limits rise" style="--i:4">' +
          (atStop ? '<button type="button" class="lim" data-ev="lean-stop"><i></i><span>' + rv.leanStop + '% is as lean as this goes. <em>Why?</em></span></button>' : '') +
          (atMin ? '<button type="button" class="lim" data-ev="range-width"><i></i><span>' + rv.minWidth + ' points is as narrow as it goes. <em>Why?</em></span></button>' : '') + '</div>');
        $('.rec', el).onclick = function () { a.bottom = r.suggestedBottom; a.top = r.suggestedTop; redraw(el, my); };
        $$('.stp', el).forEach(function (b) {
          b.onclick = function () {
            var by = (+b.getAttribute('data-d')) * 0.5;
            if (b.getAttribute('data-k') === 'lo') {
              var nx = Math.min(Math.max(r1(lo + by), r.leanStop), Math.max(r.leanStop, r.topStop));
              a.bottom = nx;
              // The top follows rather than blocking the bottom.
              if (hi - nx < r.minWidth) a.top = r1(nx + r.minWidth);
            } else {
              a.top = Math.max(r1(hi + by), r1(lo + r.minWidth));
            }
            redraw(el, my);
          };
        });
        $$('[data-ev]', el).forEach(function (b) { b.onclick = function () { evidenceSheet(b.getAttribute('data-ev'), rv); }; });
        wayCta('Continue');
      });
    });
  }
  /* EvidenceSheet.tsx, the two topics the range screen opens: level one, then where it comes from. */
  var EVIDENCE = {
    'lean-stop': function (rv) {
      return { title: rv.leanStop + '% is as lean as the plan goes', lines: ['Below this your fat store cannot release energy fast enough to cover a normal deficit, so the difference starts coming off muscle instead.', 'The number itself is a margin rather than a measured line, set well above where anything has been recorded going wrong.'],
        blocks: [
          { k: 'What actually binds first', g: 'Theoretical model [B]', b: 'Alpert put a limit on how fast fat can release energy, and the app uses a deliberately conservative figure. Set the deficit a rate needs equal to what a fat store can supply and the bodyweight cancels out, leaving a single body fat percentage: about 11% at the slow rate this app plans, and about 23% at the fast one. That is why the faster option disappears as you lean out.' },
          { k: 'Why the stop is higher than that', b: 'Because the arithmetic above is sex blind, and the lean end is not. For women the stop sits at 22%, near where menstrual function is documented as maintained, and a plan that returns someone to that line every cycle for years is a different proposition from one that visits it once.' },
          { k: 'Where harm has actually been measured', g: 'Case study [B]', b: 'One drug-free man taken from 15% to 4.5% lost most of his testosterone and had not fully recovered his strength six months later. That is far below this stop, which is the point: the margin is wide on purpose.' },
          { k: 'What it doesn’t tell you', b: 'Nothing about you specifically, and nothing about being leaner than this briefly. It is where the app will keep putting you for years, which is a higher bar than where a person can visit.' },
        ], src: 'Alpert 2005, J Theor Biol 233(1):1-13 · Rossow et al. 2013, PMID 23412685 · Fagerberg 2018, Int J Sport Nutr Exerc Metab · Mursu, Hulmi et al. 2023, Nutrients 15(2):382' };
    },
    'range-width': function (rv) {
      return { title: rv.minWidth + ' points is as narrow as it goes', lines: ['A tighter range means each stretch of building and each cut finishes before a bathroom scale could show it worked.', 'Nothing is wrong with living in a one point range. The app just could not tell you whether you were on track, so it will not plan one.'],
        blocks: [
          { k: 'Measured in this app', g: 'Our own model, not a trial', b: 'Same lifter, widening the range: half a point gives ten cuts and twenty phases, ten of them too short to read on a scale. One point gives six cuts and five. Two points gives four cuts and one, and the one is the final cut, which is short at every width. Two and a half gives none.' },
          { k: 'Why shortness is the problem', b: 'A phase ends on a body fat number, and body fat is measured with error. A phase that finishes inside that error cannot be confirmed as finished, so the app would be moving you between phases on noise.' },
          { k: 'What width is not', g: 'Preference [B]', b: 'Nothing says a narrow range builds less muscle or takes longer. The closest trial ran interrupted against continuous restriction in trained lifters and found them identical on strength, hormones, sleep and lean mass, with the interrupted arm reporting less hunger. Width is a preference with a real cost on both sides, and this limit is only about what can be verified.' },
        ], src: 'Peos et al. 2021, Med Sci Sports Exerc 53(8):1685-1698 · phase counts from this app’s own roadmap model, not from a trial' };
    },
  };
  function evidenceSheet(topic, rv) {
    var e = EVIDENCE[topic](rv);
    var one = '<p class="sh-ov amber">Your route</p><h2 class="sh-t">' + esc(e.title) + '</h2>' + e.lines.map(function (l) { return '<p class="sh-b">' + esc(l) + '</p>'; }).join('') +
      '<button type="button" class="sh-more" data-more="1">Where this comes from<span aria-hidden="true">›</span></button><button type="button" class="sh-ghost" data-close="1">Got it</button>';
    var two = '<button type="button" class="sh-back" data-less="1">‹ Where this comes from</button><h2 class="sh-t">' + esc(e.title) + '</h2>' +
      e.blocks.map(function (b) { return '<div class="eb"><p class="ek2">' + esc(b.k) + (b.g ? ' <span>' + esc(b.g) + '</span>' : '') + '</p><p class="sh-b">' + esc(b.b) + '</p></div>'; }).join('') +
      '<p class="sh-src">' + esc(e.src) + '</p><button type="button" class="sh-ghost" data-close="1">Got it</button>';
    openSheet('<div class="evs">' + one + '</div>', function (sh) {
      var box = $('.evs', sh);
      var wire = function () {
        var m = $('[data-more]', box), l = $('[data-less]', box);
        if (m) m.onclick = function () { box.innerHTML = two; wire(); };
        if (l) l.onclick = function () { box.innerHTML = one; wire(); };
        $('[data-close]', box).onclick = function () { closeSheet(); };
      };
      wire();
    });
  }
  /* WayInChart.tsx: what the scale does on the way into the range, to scale against the deepest option. */
  function wayInMini(id, w, exitW, deepest, color) {
    var X0 = 4, X1 = 110, YT = 22, YD = 58, N = 20, span = Math.max(0.1, w - deepest);
    var yOf = function (x) { return YT + ((w - x) / span) * (YD - YT); };
    var end = Math.max(YT, Math.min(YD, yOf(exitW))), pts = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, x = X0 + (X1 - X0) * t, y = id === 'hold' ? YT : id === 'cut' ? yOf(w * Math.pow(exitW / w, t)) : YT + (end - YT) * t;
      pts.push((i ? 'L' : 'M') + x.toFixed(1) + ',' + Math.min(YD, y).toFixed(1));
    }
    return '<svg width="116" height="70" viewBox="0 0 116 70" aria-hidden="true"><line x1="0" y1="' + YT + '" x2="116" y2="' + YT + '" stroke="#2a2a30" stroke-dasharray="2 3"/><path d="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + X1 + '" cy="' + end.toFixed(1) + '" r="3" fill="' + (color === '#54545e' ? '#0a0a0b' : color) + '" stroke="' + color + '" stroke-width="1.6"/></svg>';
  }
  var WAY_IN = [
    { v: 'hold', l: 'Hold your weight' },
    { v: 'ease', l: 'Ease it down' },
    { v: 'cut', l: 'Cut' },
  ];
  function wtShort(kg) { return imp() ? Math.round(kg * LB) + ' lbs' : Math.round(kg) + ' kg'; }
  /* The lean answer's second question, only when the plan opens with a cut. */
  function rWayIn(el, my) {
    needAbout(el, my, function () {
      withRV(el, my, function (rv) {
        setHelp(HELP_WAYIN);
        var a = S.about, lo = rv.range.bottom, opts = rv.wayIn || [];
        var deepest = Math.min.apply(null, opts.map(function (o) { return o.exitWeightKg; }));
        el.insertAdjacentHTML('beforeend', '<h1 class="rq rise" style="--i:0">How do you get down to ' + lo + '%?</h1><p class="rs rise" style="--i:1">Your goal takes about the same time either way. What changes is how soon you reach ' + lo + '%.</p>' +
          '<div class="opts rise" style="--i:2" role="radiogroup">' + WAY_IN.map(function (x) {
            var o = opts.filter(function (y) { return y.id === x.v; })[0];
            if (!o) return '';
            var on = a.wayIn === x.v, where = (x.v === 'hold' ? 'Stays at ' : 'Down to ') + wtShort(o.exitWeightKg);
            var ml = Math.round(o.months[0]), mh = Math.round(o.months[1]);
            var mo = ml === mh ? ml + ' month' + (ml === 1 ? '' : 's') : ml + ' to ' + mh + ' months';
            var stops = Math.abs(o.exitBodyFatPct - lo) > 0.2 ? ' to ' + Math.round(o.exitBodyFatPct) + '%' : '';
            return '<button type="button" class="opt ropt" role="radio" data-v="' + x.v + '" aria-checked="' + on + '" aria-pressed="' + on + '"><span class="mini">' + wayInMini(x.v, a.weightKg, o.exitWeightKg, deepest, on ? 'var(--acc)' : '#54545e') + '</span><span class="om"><b>' + x.l + '</b><small>' + esc(where + stops + ' · ' + mo) + '</small></span></button>';
          }).join('') + '</div>');
        $$('.ropt', el).forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-v'); if (v === a.wayIn) return; a.wayIn = v; redraw(el, my); }; });
        wayCta('Continue');
      });
    });
  }
  var rvOk = function () { return !!S.rv; };
  var WHEN = {
    route: function () { return rvOk() && S.rv.rangeMatters; },
    bulkto: function () { return rvOk() && S.rv.rangeMatters && S.about.route === 'capped'; },
    range: function () { return rvOk() && S.rv.rangeMatters && S.about.route !== 'bulk'; },
    wayin: function () { return rvOk() && S.rv.rangeMatters && S.about.route === 'lean' && S.rv.wayInApplies && !!S.rv.wayIn; },
    plan: function () { return true; },
  };

  /* ================= the meal questions that used to sit here =================
   * N4Activity and N4bTraining are the meal questionnaire's first two questions in
   * the app, so they open the food section here. */
  var ACTIVE = [
    { v: 'sedentary', l: 'Mostly sitting', h: 'Desk work, driving, not much walking' },
    { v: 'light', l: 'On my feet a bit', h: 'Some walking through the day' },
    { v: 'moderate', l: 'On my feet a lot', h: 'Teaching, retail, hospitality' },
    { v: 'heavy', l: 'Physical work', h: 'Trades, warehouse, nursing' },
    { v: 'extreme', l: 'Hard physical work', h: 'Labouring all day, every day' },
  ];
  function rActive(el, my) {
    needAbout(el, my, function () {
      head(el, 'Your food', 'How active are you outside the gym?', 'Work, errands, getting around. Your sessions are the next question, so leave them out here.');
      cards(el, ACTIVE, S.about.activityLevel, function (v) { S.about.activityLevel = v; enable(true); });
      primary('Continue', null, !S.about.activityLevel);
    });
  }
  function rSessions(el, my) {
    needAbout(el, my, function () {
      head(el, 'Your food', 'How much do you train?', 'Structured sessions: lifting, classes, sport. This is added on top of your day-to-day activity, so count it here and nowhere else.');
      cards(el, S.defaults.trainingBands.map(function (b) { return { v: b.value, l: b.label, h: b.hint }; }), S.about.trainingSessionsPerWeek, function (v) { S.about.trainingSessionsPerWeek = v; enable(true); });
      primary('Continue', null, S.about.trainingSessionsPerWeek == null);
    });
  }

  /* ================= build moments ================= */
  /**
   * The app's build screens: act 1 (ring draws, dots orbit, "Building your ...")
   * while the engine works, then act 2: a step list where each line runs and
   * ticks with the real number from the result, while the visual fills in.
   * Tap anywhere to skip. Reduced motion: the finished list at once.
   */
  function buildMoment(el, my, o) {
    // o: word ('your week.'), sub, work (Promise -> data), steps(data) -> [{label,value,count?}], visual(data) -> html, onStep(i, data, el), done(data)
    el.classList.add('bm');
    el.innerHTML = '<div class="act1"><div class="ring"><div class="glow"></div><svg viewBox="0 0 140 140"><circle class="r" cx="70" cy="70" r="60"/></svg><div class="orbit">' +
      [0, 1, 2, 3].map(function (k) { var ang = k * Math.PI / 2 - Math.PI / 2; return '<b style="left:' + (65 + Math.cos(ang) * 60) + 'px;top:' + (65 + Math.sin(ang) * 60) + 'px;animation-delay:' + (0.5 + k * 0.14) + 's"></b>'; }).join('') +
      '</div></div><p class="launch">Building<br><span>' + o.word + '</span></p><p class="sub" style="margin:8px auto 0;text-align:center">' + esc(o.sub || '') + '</p><div class="charge"><i></i></div></div><div class="act2" aria-live="polite"></div>';
    primary(null);
    var act1 = $('.act1', el), act2 = $('.act2', el);
    var skip = false, finished = false, data = null;
    var instant = RM || root.classList.contains('still');
    var t0 = performance.now();
    el.addEventListener('click', function (e) { if (e.target.closest('[data-retry]')) return; skip = true; });
    function finish() {
      if (finished || my !== token) return; finished = true;
      if (holdBuild) return; // ?demo with a build screen asked for: stay on it for the screenshot
      setTimeout(function () { if (my === token) o.done(data); }, instant ? 0 : 450);
    }
    o.work().then(function (d) {
      data = d;
      if (my !== token) return;
      var hold = instant ? 0 : Math.max(0, 1500 - (performance.now() - t0));
      return wait(hold).then(function () {
        if (my !== token) return;
        var steps = o.steps(d);
        act1.classList.add('gone');
        setTimeout(function () { act1.style.display = 'none'; }, instant ? 0 : 420);
        act2.innerHTML = '<p class="ov">' + esc(o.over(d)) + '</p><p class="wt">Building <span>' + o.word + '</span></p><div class="vis">' + o.visual(d) + '</div><div class="steps">' +
          steps.map(function (s) { return '<div class="st"><span class="dot"></span><span class="l">' + esc(s.label) + '</span><span class="v">' + esc(s.value) + '</span></div>'; }).join('') + '</div>' +
          (instant ? '' : '<button type="button" class="skip">Tap to skip</button>');
        requestAnimationFrame(function () { act2.classList.add('on'); });
        var rows = $$('.st', act2);
        if (instant) {
          rows.forEach(function (r, i) { r.classList.add('ok'); o.onStep && o.onStep(i, d, act2, true); });
          if (RM && !root.classList.contains('still')) primary('Continue', function () { o.done(data); });
          else finish();
          return;
        }
        var i = 0, STEP = 430;
        (function stepOn() {
          if (my !== token) return;
          if (skip) { rows.forEach(function (r, k) { if (!r.classList.contains('ok')) { r.classList.remove('run'); r.classList.add('ok'); o.onStep && o.onStep(k, d, act2, true); } }); finish(); return; }
          if (i >= rows.length) { setTimeout(finish, 350); return; }
          var r = rows[i], k = i;
          r.classList.add('run');
          o.onStep && o.onStep(k, d, act2, false);
          setTimeout(function () {
            if (my !== token) return;
            r.classList.remove('run'); r.classList.add('ok');
            var s = steps[k];
            if (s.count) countUp($('.v', r), s.count.to, 500, function (x) { return n0(x) + (s.count.suffix || ''); });
          }, STEP - 90);
          i++;
          setTimeout(stepOn, STEP);
        })();
      });
    }, function (e) {
      if (my !== token) return;
      el.classList.remove('bm');
      el.innerHTML = errBox(e.message);
      $('[data-retry]', el).onclick = function () { show(cur, 0); };
      primary(null);
    });
  }

  function withData(el, my, work, text, fn) {
    el.innerHTML = '<div class="loading"><div class="spin"></div>' + esc(text) + '</div>';
    primary(null);
    work().then(function (d) { if (my === token) { el.innerHTML = ''; fn(d); } }, function (e) {
      if (my !== token) return;
      el.innerHTML = errBox(e.message);
      $('[data-retry]', el).onclick = function () { show(cur, 0); };
    });
  }
  /* ---------- JourneyChart.tsx: body fat from today to the goal, inside the range ----------
   * Same geometry as the app (320 wide viewBox, X0 30 to X1 308, the line sampled
   * from planCurve at 96 fixed points). Modes used by the route: compact (the
   * option miniatures), bandOnly + frame (the bulk-to and range screens), and bare
   * + frame + yearLines + tappable nodes with the flag (the plan). No morph between
   * plans: the line is redrawn. */
  var JC = { X0: 30, X1: 308, Y0: 14, Y1: 104, N: 96 };
  function journeyChart(startBf, rm, o) {
    o = o || {};
    var X0 = JC.X0, X1 = JC.X1, Y0 = JC.Y0, Y1 = JC.Y1, N = JC.N;
    var color = o.color || 'var(--acc)', band = o.band !== false, compact = !!o.compact, bandOnly = !!o.bandOnly;
    var phases = rm.phases, start = startBf != null ? startBf : rm.band.ceiling + 2;
    var goal = phases[phases.length - 1].exitBodyFatPct, floor = rm.band.floor, ceiling = rm.band.ceiling;
    var exits = bandOnly ? [] : phases.map(function (p) { return p.exitBodyFatPct; });
    var marks = o.leanStopPct != null ? [o.leanStopPct] : [];
    var edges = band ? [ceiling, floor] : [];
    var lineHi = Math.max.apply(null, [start].concat(exits, marks, edges)), lineLo = Math.min.apply(null, [goal].concat(exits, marks, edges));
    var hi = compact ? lineHi + 0.6 : Math.ceil((lineHi + 2) / 2) * 2, lo = compact ? lineLo - 0.6 : Math.floor((lineLo - 2) / 2) * 2;
    var yTop = compact ? 8 : Y0, yBot = compact ? 62 : Y1;
    var yOf = function (bf) { var y = yTop + ((hi - bf) / (hi - lo)) * (yBot - yTop); return isFinite(y) ? y : (yTop + yBot) / 2; };
    var yAt = function (bf) { return Y0 + ((hi - bf) / (hi - lo)) * (Y1 - Y0); };
    var mid = function (m) { return (m[0] + m[1]) / 2; };
    var way = [];
    phases.forEach(function (p) { for (var i = 0; i < Math.max(1, p.repeats || 1); i++) way.push([mid(p.estMonths), p.exitBodyFatPct]); });
    var total = way.reduce(function (s, w) { return s + w[0]; }, 0) || 1;
    var curve = rm.curve, ys = [];
    if (curve && curve.points.length > 1 && curve.totalMonths > 0) {
      var pts = curve.points, k = 1;
      for (var i = 0; i < N; i++) {
        var atM = (i / (N - 1)) * curve.totalMonths;
        while (k < pts.length - 1 && pts[k].month < atM) k++;
        var pa = pts[k - 1], pb = pts[k], f = pb.month === pa.month ? 0 : (atM - pa.month) / (pb.month - pa.month);
        ys.push(yOf(pa.bodyFatPct + (pb.bodyFatPct - pa.bodyFatPct) * f));
      }
    } else {
      var nd = [[0, start]], tt = 0;
      way.forEach(function (w) { tt += w[0] / total; nd.push([tt, w[1]]); });
      for (var j = 0; j < N; j++) {
        var ti = j / (N - 1), kk = 1;
        while (kk < nd.length - 1 && nd[kk][0] < ti) kk++;
        var fr = nd[kk][0] === nd[kk - 1][0] ? 0 : (ti - nd[kk - 1][0]) / (nd[kk][0] - nd[kk - 1][0]);
        ys.push(yOf(nd[kk - 1][1] + (nd[kk][1] - nd[kk - 1][1]) * fr));
      }
    }
    var monthsT = curve ? curve.totalMonths : total;
    var nodes = curve && monthsT > 0 ? curve.nodes.map(function (n) { return { x: X0 + (n.month / monthsT) * (X1 - X0), y: yOf(n.bodyFatPct), month: n.month, bodyFatPct: n.bodyFatPct, weightKg: n.weightKg }; }) : [];
    var xOf = function (i) { return X0 + (i / (N - 1)) * (X1 - X0); };
    var d = 'M' + xOf(0).toFixed(1) + ' ' + ys[0].toFixed(1);
    for (var q = 1; q < N - 1; q++) d += ' Q' + xOf(q).toFixed(1) + ' ' + ys[q].toFixed(1) + ' ' + ((xOf(q) + xOf(q + 1)) / 2).toFixed(1) + ' ' + ((ys[q] + ys[q + 1]) / 2).toFixed(1);
    d += ' L' + xOf(N - 1).toFixed(1) + ' ' + ys[N - 1].toFixed(1);
    var H = bandOnly ? 132 : compact ? (o.muscleKg != null ? 96 : 72) : o.muscleKg != null ? 158 : 124;
    var flagRoom = o.nodeFlag ? 30 : 0;
    var s = '';
    if (band) s += '<rect x="' + X0 + '" y="' + yOf(ceiling).toFixed(1) + '" width="' + (X1 - X0) + '" height="' + Math.max(0, yOf(floor) - yOf(ceiling)).toFixed(1) + '" rx="8" fill="' + color + '" fill-opacity=".1"/>';
    if (o.yearLines && monthsT > 12) for (var yr = 1; yr <= Math.floor(monthsT / 12); yr++) { var yx = X0 + ((yr * 12) / monthsT) * (X1 - X0); s += '<line x1="' + yx.toFixed(1) + '" y1="' + Y0 + '" x2="' + yx.toFixed(1) + '" y2="' + Y1 + '" stroke="#1e1e24"/><text x="' + (yx + 3).toFixed(1) + '" y="' + (Y1 - 4) + '" font-size="8" fill="#3f3f46">' + yr + 'y</text>'; }
    if (o.targetPct != null) {
      var off = o.targetPct > hi, ty = off ? Y0 : yAt(o.targetPct);
      s += '<line x1="' + X0 + '" y1="' + ty.toFixed(1) + '" x2="' + X1 + '" y2="' + ty.toFixed(1) + '" stroke="' + color + '" stroke-width="1.5" stroke-opacity="' + (off ? 0.55 : 1) + '"/><text x="' + (X1 - 2) + '" y="' + (ty - 5).toFixed(1) + '" font-size="8.5" fill="' + color + '" fill-opacity="' + (off ? 0.75 : 1) + '" text-anchor="end">' + (off ? '▲ ' : '') + o.targetPct + '%</text>';
    }
    if (bandOnly) {
      if (o.leanStopPct != null) s += '<line x1="' + X0 + '" y1="' + yAt(o.leanStopPct).toFixed(1) + '" x2="' + X1 + '" y2="' + yAt(o.leanStopPct).toFixed(1) + '" stroke="#8a6b28"/>';
      [[startBf, 'TODAY'], [goal, 'GOAL']].forEach(function (mk) {
        if (mk[0] == null) return;
        var my = yAt(mk[0]).toFixed(1);
        s += '<line x1="' + X0 + '" y1="' + my + '" x2="' + X1 + '" y2="' + my + '" stroke="#2c2c31" stroke-dasharray="2 5"/><text x="' + (X0 + 4) + '" y="' + (my - 5) + '" font-size="7.6" fill="#4b4b52" letter-spacing="1.15">' + mk[1] + ' ' + Math.round(mk[0]) + '%</text>';
      });
    }
    if (o.frame) s += '<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X0 + '" y2="' + Y1 + '" stroke="#232328"/><line x1="' + X0 + '" y1="' + Y1 + '" x2="' + X1 + '" y2="' + Y1 + '" stroke="#232328"/>';
    if ((o.bare || bandOnly) && !compact) for (var t4 = 0; t4 < 4; t4++) { var pct = hi - ((hi - lo) * t4) / 3; s += '<text x="' + (X0 - 4) + '" y="' + (yAt(pct) + 3).toFixed(1) + '" font-size="8.5" fill="#3f3f46" text-anchor="end">' + Math.round(pct) + '%</text>'; }
    if (!bandOnly) s += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (compact ? 2.2 : 2.5) + '" stroke-linejoin="round" stroke-linecap="round"/>';
    if (!compact && !bandOnly) s += '<circle cx="' + X0 + '" cy="' + yOf(start).toFixed(1) + '" r="8" fill="' + color + '" fill-opacity=".18"/><circle cx="' + X0 + '" cy="' + yOf(start).toFixed(1) + '" r="4.5" fill="' + color + '"/><circle cx="' + X1 + '" cy="' + ys[N - 1].toFixed(1) + '" r="3.5" fill="#131316" stroke="#8e8e93" stroke-width="1.5"/>';
    if (o.selectable && !bandOnly) nodes.forEach(function (n, i) {
      var on = o.selected === i;
      s += '<circle cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) + '" r="' + (on ? 5 : 3.2) + '" fill="' + (on ? color : '#0a0a0b') + '" stroke="' + color + '" stroke-width="' + (on ? 0 : 1.6) + '"/><circle class="hit" data-node="' + i + '" cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) + '" r="17" fill="transparent"/>';
    });
    var fn = o.nodeFlag && o.selected != null ? nodes[o.selected] : null;
    if (fn) {
      var label = (imp() ? Math.round(fn.weightKg * LB) + ' lbs' : fn.weightKg.toFixed(1) + ' kg') + ' · ' + fn.bodyFatPct.toFixed(1) + '% · ' + (fn.month < 0.5 ? 'Now' : 'Month ' + Math.round(fn.month));
      var em = 0; for (var c = 0; c < label.length; c++) { var ch = label[c]; em += ch >= '0' && ch <= '9' ? 0.56 : ch === ' ' || ch === '.' ? 0.28 : ch === '·' ? 0.34 : ch === '%' ? 0.86 : ch >= 'A' && ch <= 'Z' ? 0.66 : 0.52; }
      var fw = Math.min(X1 - X0, em * 11 + 22), fh = 21, ftop = -flagRoom + 4, bx = Math.min(Math.max(fn.x - fw / 2, X0), X1 - fw);
      s += '<line x1="' + fn.x.toFixed(1) + '" y1="' + (ftop + fh) + '" x2="' + fn.x.toFixed(1) + '" y2="' + (fn.y - 7).toFixed(1) + '" stroke="' + color + '" stroke-opacity=".45"/><rect x="' + bx.toFixed(1) + '" y="' + ftop + '" width="' + fw.toFixed(1) + '" height="' + fh + '" rx="10.5" fill="#0a0a0b" stroke="#2c2c33"/><text x="' + (bx + fw / 2).toFixed(1) + '" y="' + (ftop + 14.5) + '" font-size="11" font-weight="600" fill="#e8e8ea" text-anchor="middle">' + esc(label) + '</text>';
    }
    if (o.muscleKg != null) {
      var span = (function () {
        var tot = phases.reduce(function (sum, p) { return sum + mid(p.estMonths) * (p.repeats || 1); }, 0), at = 0, l = null, h = 0;
        if (tot <= 0) return null;
        phases.forEach(function (p) { var w = (mid(p.estMonths) * (p.repeats || 1)) / tot; if (p.kind === 'build') { if (l == null) l = at; h = at + w; } at += w; });
        return l == null ? null : { lo: l, hi: h };
      })();
      if (span) {
        var bx1 = X0 + span.lo * (X1 - X0), bx2 = X0 + span.hi * (X1 - X0), by = (compact ? 62 : Y1) + 12;
        s += '<g stroke="' + color + '" stroke-opacity=".38"><line x1="' + bx1.toFixed(1) + '" y1="' + by + '" x2="' + bx2.toFixed(1) + '" y2="' + by + '"/><line x1="' + bx1.toFixed(1) + '" y1="' + (by - 4) + '" x2="' + bx1.toFixed(1) + '" y2="' + (by + 4) + '"/><line x1="' + bx2.toFixed(1) + '" y1="' + (by - 4) + '" x2="' + bx2.toFixed(1) + '" y2="' + (by + 4) + '"/></g><text x="' + ((bx1 + bx2) / 2).toFixed(1) + '" y="' + (by + 16) + '" font-size="11" fill="' + color + '" text-anchor="middle">+' + o.muscleKg + ' kg muscle</text>';
      }
    }
    var cls = compact ? 'jc mini-c' : 'jc';
    return '<svg class="' + cls + '" viewBox="0 ' + (-flagRoom) + ' 320 ' + (H + flagRoom) + '"' + (compact ? ' width="116" height="72"' : '') + ' role="img" aria-label="Body fat from ' + Math.round(start) + '% to ' + Math.round(goal) + '%">' + s + '</svg>';
  }
  /* ---------- PhaseLine.tsx: the whole journey dim, phase 1 lit and drawn in ---------- */
  function phaseLine(startBf, rm) {
    var W = 308, H = 96, X0 = 4, X1 = 304, Y0 = 12, YB = 84;
    var legs = rm.expanded.map(function (p) { return { m: (p.estMonths[0] + p.estMonths[1]) / 2, bf: p.exitBodyFatPct }; });
    var start = startBf != null ? startBf : rm.band.ceiling + 2, total = legs.reduce(function (s, l) { return s + l.m; }, 0) || 1;
    var all = [start].concat(legs.map(function (l) { return l.bf; })), hi = Math.max.apply(null, all) + 1.5, lo = Math.min.apply(null, all) - 1.5;
    var yOf = function (bf) { return Y0 + ((hi - bf) / (hi - lo || 1)) * (YB - Y0); };
    var nodes = [{ x: X0, y: yOf(start) }], acc = 0;
    legs.forEach(function (l) { acc += l.m; nodes.push({ x: X0 + (acc / total) * (X1 - X0), y: yOf(l.bf) }); });
    var toPath = function (p) { return p.map(function (n, i) { return (i ? 'L' : 'M') + n.x.toFixed(1) + ' ' + n.y.toFixed(1); }).join(' '); };
    var lit = nodes.slice(0, 2), runEnd = lit[lit.length - 1].x;
    var lp = toPath(lit);
    return '<svg class="pline" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><defs><linearGradient id="phaseRun" gradientUnits="userSpaceOnUse" x1="' + X0 + '" y1="0" x2="' + runEnd.toFixed(1) + '" y2="0"><stop offset="0" stop-color="var(--acc)" stop-opacity=".1"/><stop offset="0" stop-color="var(--acc)" stop-opacity=".95"/><stop offset="1" stop-color="var(--acc)"/></linearGradient></defs>' +
      '<path d="' + toPath(nodes) + '" fill="none" stroke="#26262b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="' + lp + '" fill="none" stroke="url(#phaseRun)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="sweep" d="' + lp + '" pathLength="1" fill="none" stroke="var(--acc)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      head(9, '.18') + head(4.5, '1') + '</svg>';
    // The head runs along the lit leg (an SVG motion path from the start node); still screens get it at the end.
    function head(r, op) {
      var still = RM || root.classList.contains('still'), p = still ? lit[1] : lit[0];
      return '<circle r="' + r + '" fill="var(--acc)" opacity="' + op + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '">' + (still ? '' : '<animateMotion dur="0.9s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".33 1 .68 1" path="M0 0 L' + (lit[1].x - lit[0].x).toFixed(1) + ' ' + (lit[1].y - lit[0].y).toFixed(1) + '"/>') + '</circle>';
    }
  }
  var KIND_LABEL = { trim: 'Trim', build: 'Build', recomp: 'Recomp', reveal: 'The reveal' };
  var INTENT = {
    build: ['Gain weight on purpose', 'You eat above maintenance, so the scale climbs. Some of that is fat, and that is the trade. Muscle goes on faster this way.'],
    trim: ['Lose fat, keep the muscle', 'You eat below maintenance and keep lifting hard. The scale falls, and the job is making sure what leaves is fat.'],
    recomp: ['Hold your weight', 'Muscle up, fat down, the scale roughly still. It is the one phase where both move at once.'],
    reveal: ['Bring it down to the finish', 'The last stretch. Fat comes off and what you have built underneath shows.'],
  };
  function wtOne(kg) { return imp() ? Math.round(kg * LB) + ' lbs' : kg.toFixed(1) + ' kg'; }
  function varianceSheet(y) {
    openSheet('<p class="sh-ov">Estimate · ' + y[0] + ' to ' + y[1] + ' years</p><h2 class="sh-t">Why the range?</h2>' +
      '<p class="sh-b">People respond differently to the same training. Two lifters running the identical program can build at quite different rates, and there is no way to know which you are until you start. The fast end assumes you respond well, the slow end assumes you do not.</p>' +
      '<p class="sh-b">How fast the scale follows your calories moves it too. Each trim is timed from the deficit your meal plan sets: the short end is exactly that pace, and the long end allows for the scale coming down more slowly than the numbers say, which it often does. It is a smaller part of the total.</p>' +
      '<p class="sh-b">Not following the plan is not in this range. Missed sessions and off-plan weeks do not put you at the slow end. They put you outside it. The estimate assumes you train and eat as planned throughout.</p>' +
      '<button type="button" class="sh-ghost" data-close="1">Got it</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
  }
  /* ---------- beat 9, the plan: no controls, each row jumps back to its question ---------- */
  function rPlan(el, my) {
    needAbout(el, my, function () {
      withRV(el, my, function (rv) {
        var a = S.about, rm = rv.roadmap;
        if (!rm) { el.innerHTML = errBox('No plan came back for these numbers.'); $('[data-retry]', el).onclick = function () { show(cur, 0); }; return; }
        var y = rm.estYears, gw = goalW(), lb = imp();
        var big = function (kg) { return (lb ? Math.round(kg * LB) : Math.round(kg)) + '<small>' + (lb ? 'lbs' : 'kg') + '</small>'; };
        var name = ROUTES.filter(function (x) { return x.v === a.route; })[0].l;
        var rows = '';
        if (rv.rangeMatters) {
          rows += '<button type="button" class="crow" data-to="route"><span><i>How you grow</i><b>' + esc(name + ' · ' + cutWords(rm.cuts).toLowerCase()) + '</b></span><em>Change</em></button>';
          if (a.route === 'capped') rows += '<button type="button" class="crow" data-to="bulkto"><span><i>Bulk up to</i><b>' + (a.bulkTo != null ? a.bulkTo : rv.defaultBulkTo) + '%</b></span><em>Change</em></button>';
          if (a.route !== 'bulk' && rv.range) rows += '<button type="button" class="crow" data-to="range"><span><i>' + (a.route === 'capped' ? 'Then you sit in' : 'Your range') + '</i><b>' + rv.range.bottom + ' to ' + rv.range.top + '%</b></span><em>Change</em></button>';
          if (WHEN.wayin()) {
            var p0 = rm.phases[0], wn = WAY_IN.filter(function (x) { return x.v === a.wayIn; })[0] || WAY_IN[2];
            if (p0 && p0.exitWeightKg != null) rows += '<button type="button" class="crow" data-to="wayin"><span><i>Getting in</i><b>' + esc(wn.l + ' · ' + (p0.kind === 'recomp' ? 'stays at ' : 'down to ') + wtShort(p0.exitWeightKg)) + '</b></span><em>Change</em></button>';
          }
          rows = '<div class="erows">' + rows + '</div>';
        } else {
          rows = '<p class="nonote">' + ((rm.gapKg || 0) > 0 ? 'You are already leaner than your goal, so there is nothing to cut first. One long build.' : 'You already carry the muscle your goal needs, so this is one stretch of fat loss.') + '</p>';
        }
        var sel = a.bodyFatPct != null ? 0 : null;
        var muscle = rm.gapKg != null && rm.gapKg > 0 ? Math.round(rm.gapKg) : null;
        var drawChart = function () { $('.pc', el).innerHTML = journeyChart(a.bodyFatPct, rm, { bare: true, frame: true, yearLines: true, band: a.route !== 'bulk', selectable: true, selected: sel, nodeFlag: true, muscleKg: muscle }); };
        el.insertAdjacentHTML('beforeend', '<div class="dest rise" style="--i:0"><div><i>Today</i><b>' + big(a.weightKg) + '</b><span>' + Math.round(a.bodyFatPct) + '% body fat</span></div><em>→</em><div class="r"><i>Goal</i><b class="g">' + big(gw) + '</b><span>' + Math.round(a.goalBodyFatPct) + '% body fat</span></div></div>' +
          '<div class="pc wipe"></div><div class="cends"><span>Today</span><span>' + y[0] + '–' + y[1] + ' yr</span></div><p class="whyr"><button type="button" class="linkb small" id="whyR">why the range?</button></p>' + rows);
        drawChart();
        $('.pc', el).addEventListener('click', function (e) { var h = e.target.closest && e.target.closest('[data-node]'); if (!h) return; var i = +h.getAttribute('data-node'); sel = sel === i ? null : i; drawChart(); });
        $('#whyR', el).onclick = function () { varianceSheet(y); };
        $$('[data-to]', el).forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-to')); }; });
        primary('See the whole plan');
      });
    });
  }
  /* ---------- beat 10: the summary, phase 1, and the lock ---------- */
  function rSummary(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needRV, '', function (rv) {
        var a = S.about, rm = rv.roadmap;
        if (!rm) { el.innerHTML = errBox('No plan came back for these numbers.'); $('[data-retry]', el).onclick = function () { show(cur, 0); }; return; }
        var first = rm.phases[0], intent = INTENT[first.kind] || ['Keep going', 'Log your weight each week and the plan adjusts around it.'];
        var gw = goalW(), lb = imp();
        var leanHeld = rm.leanNowKg != null ? rm.leanNowKg / (1 - a.goalBodyFatPct / 100) : null;
        var sheds = first.kind === 'reveal' && leanHeld != null && leanHeld > gw;
        var title = sheds ? 'A big cut, and some muscle goes too' : intent[0];
        var detail = sheds ? 'Reaching ' + (lb ? Math.round(gw * LB) + ' lbs' : Math.round(gw) + ' kg') + ' at ' + Math.round(first.exitBodyFatPct) + '% means about ' + (lb ? Math.round((leanHeld - gw) * LB) + ' lbs' : Math.round(leanHeld - gw) + ' kg') + ' of lean mass comes off alongside the fat. Lifting hard and eating enough protein keeps that as small as it can be.' : intent[1];
        var endKg = first.exitWeightKg != null ? first.exitWeightKg : null;
        el.classList.add('summ');
        el.innerHTML = '<p class="sey rise" style="--i:0">Phase 1 of ' + rm.expanded.length + '</p><h1 class="stl rise" style="--i:1">' + esc(KIND_LABEL[first.kind] || first.kind) + '</h1>' +
          '<p class="spair rise" style="--i:2"><b class="f">0</b><span>→</span><b class="t">0</b><small>% body fat</small></p>' +
          '<p class="dur rise" style="--i:3"><b>' + first.estMonths[0] + ' to ' + first.estMonths[1] + ' months</b><span>Estimate</span></p>' +
          '<div class="intent"><i>This phase</i><b>' + esc(title) + '</b><p>' + esc(detail) + '</p>' + (endKg != null ? '<p class="sc">Ends around <b>' + wtOne(endKg) + '</b>, at ' + Math.round(first.exitBodyFatPct) + '%</p>' : '') + '</div>' +
          (rm.plausibility === 'beyond' ? '<p class="limit"><i></i><span><b>Past the drug-free range. </b>The plan still works, but the last stretch may not. A few kilos off your goal weight brings it back in range.</span></p>' : '') +
          (rm.holdsAtGoalBodyFat ? '<p class="holdn">You’re already at your goal body fat, so we’ll hold your weight steady while you build.</p>' : '') +
          '<div class="schart">' + phaseLine(a.bodyFatPct, rm) + '</div>' +
          '<a class="proof rise" style="--i:4" href="/research/" target="_blank" rel="noopener"><span><b>Built on ' + (S.defaults.papers || 'the') + ' published papers</b><small>See how we worked this out</small></span><em aria-hidden="true">›</em></a>';
        countUp($('.spair .f', el), Math.round(a.bodyFatPct), 750, function (v) { return Math.round(v); });
        countUp($('.spair .t', el), Math.round(first.exitBodyFatPct), 750, function (v) { return Math.round(v); });
        primary('Lock in my plan', function () { lockSheet(rv); });
      });
    });
  }
  function lockSheet(rv) {
    var a = S.about, rm = rv.roadmap, y = rm.estYears;
    openSheet('<div class="cf"><span class="chip"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>' +
      '<p class="sh-ov acc c">Last step</p><h2 class="sh-t c big">Lock this plan in?</h2>' +
      '<p class="sh-b c">This sets your goal and builds the phase sequence around it. In the app you can change it later in Goals and stats, but the plans get rebuilt when you do.</p>' +
      '<div class="recap"><div><i>Goal</i><b>' + wtOne(goalW()) + ' at ' + Math.round(a.goalBodyFatPct) + '%</b></div><div><i>Route</i><span><b>' + esc(rm.phases.map(function (p) { return KIND_LABEL[p.kind] || p.kind; }).join(' → ')) + '</b><small>' + y[0] + ' to ' + y[1] + ' years</small></span></div></div>' +
      '<button type="button" class="sh-go" data-a="lock">Lock it in</button><button type="button" class="sh-sec" data-a="no">Not yet</button></div>', function (sh) {
      $('[data-a="no"]', sh).onclick = function () { closeSheet(); };
      $('[data-a="lock"]', sh).onclick = function () { closeSheet(true); celebrate(function () { go('locked'); }); };
    });
  }
  /* Motion.tsx Celebration: two rings, the badge, the tick, "Locked in.", then on. */
  function celebrate(done) {
    var c = document.createElement('div');
    c.className = 'cele';
    c.innerHTML = '<i class="ring1"></i><i class="ring2"></i><span class="badge2"><svg width="52" height="52" viewBox="0 0 52 52"><path d="M15 27l8 8 15-17" stroke="#04141a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span><b>Locked in.</b>';
    document.body.appendChild(c);
    primary(null);
    var still = RM || root.classList.contains('still');
    setTimeout(function () { c.classList.add('out'); done(); setTimeout(function () { c.remove(); }, 300); }, still ? 700 : 2100);
  }
  /* ---------- RouteReveal's finish line ---------- */
  function rLocked(el) {
    el.classList.add('finish');
    var t = new Date(); t.setDate(t.getDate() + 1);
    var day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.getDay()];
    var row = function (mark, num, title, sub, meta, to) {
      return '<' + (to ? 'button type="button" data-to="' + to + '"' : 'div') + ' class="sp ' + mark + '"><span class="sd">' + (mark === 'done' ? '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 12.5l4 4 8-9" fill="none" stroke="#0a0a0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : mark === 'goal' ? '<i></i>' : num) + '</span><span class="sb"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span>' + (meta ? '<em>' + meta + '</em>' : '') + '</' + (to ? 'button' : 'div') + '>';
    };
    el.innerHTML = '<p class="fov rise" style="--i:0">You’re 60% of the way</p><div class="fbar rise" style="--i:0"><i></i></div>' +
      '<h1 class="ftl rise" style="--i:1">Two short steps<br>to day one.</h1><div class="spine">' +
      '<div class="rise" style="--i:2">' + row('done', 0, 'Your route', 'Goal, timeline and phases set', 'DONE') + '</div>' +
      '<div class="rise" style="--i:3">' + row('next', 2, 'Your meals', 'Diet, allergies, the meals you like', '~3 MIN', 'active') + '</div>' +
      '<div class="rise" style="--i:4">' + row('todo', 3, 'Your training', 'Days, length, volume, extras', '~1 MIN', 'days') + '</div>' +
      '<div class="rise" style="--i:5">' + row('goal', 0, 'Day one: ' + day, 'Your first session and your first day of meals, ready to follow.', '') + '</div></div>' +
      '<p class="free rise" style="--i:6">Free to build. Nothing to pay at the end.</p><p class="later rise" style="--i:7"><button type="button" class="linkb small" data-to="keep">I’ll do this later</button></p>';
    requestAnimationFrame(function () { var f = $('.fbar i', el); if (f) f.style.transform = 'scaleX(.6)'; });
    $$('[data-to]', el).forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-to')); }; });
    primary('Next: my meals', function () { go('active'); });
  }

  /* ================= food (the meal questions) ================= */
  function needFoodOptions() {
    var jobs = [loadIndex()];
    if (!S.foodOptions) jobs.push(call('foodOptions').then(function (o) { S.foodOptions = o; }));
    return Promise.all(jobs);
  }
  function rMeat(el, my) {
    withData(el, my, needFoodOptions, '', function () {
      head(el, 'Your food', 'Do you eat meat?', 'We only show you meals that fit.');
      cards(el, S.foodOptions.dietPatterns.map(function (p) { return { v: p.value, l: p.label, h: p.hint }; }), S.food.dietPattern, function (v) { S.food.dietPattern = v; enable(true); });
      primary('Continue', null, !S.food.dietPattern);
    });
  }
  var ALLERGENS = ['Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Gluten/Wheat', 'Soy', 'Fish', 'Sesame'];
  function toggle(arr, v) { var i = arr.indexOf(v); i > -1 ? arr.splice(i, 1) : arr.push(v); }
  function rAllergies(el) {
    head(el, 'Your food', 'Any allergies?', 'Meals with these are left out of your plan. Always check ingredient labels yourself. Skip if none apply.');
    cards(el, ALLERGENS.map(function (x) { return { v: x, l: x }; }), S.food.allergies, function (v) { toggle(S.food.allergies, v); primary(S.food.allergies.length ? 'Continue' : 'None of these'); }, { chips: true, multi: true });
    primary(S.food.allergies.length ? 'Continue' : 'None of these');
  }
  function rSkip(el, my) {
    withData(el, my, needFoodOptions, '', function () {
      head(el, 'Your food', 'Anything you won’t eat?', 'Those meals still show, just lower down and marked.');
      cards(el, S.foodOptions.popularFoods.map(function (x) { return { v: x.id, l: x.name }; }), S.food.skip, function (v) { toggle(S.food.skip, v); primary(S.food.skip.length ? 'Continue' : 'I eat all of these'); }, { chips: true, multi: true });
      primary(S.food.skip.length ? 'Continue' : 'I eat all of these');
    });
  }
  var MEALS = [{ v: 2, l: '2', h: 'Two bigger meals' }, { v: 3, l: '3', h: 'Classic' }, { v: 4, l: '4', h: 'Four solid meals' }, { v: 5, l: '5', h: 'Five smaller' }, { v: 6, l: '6', h: 'Frequent eating' }];
  var SNACKS = [{ v: '0', l: 'None' }, { v: '1', l: '1 snack' }, { v: '2', l: '2 snacks' }, { v: '3+', l: '3+ snacks' }, { v: 'ai_decide', l: 'Let the plan decide' }];
  function rEat(el) {
    head(el, 'Your food', 'How do you like to eat?', 'Sets the shape of your day. We’ll handle hitting your targets.');
    el.insertAdjacentHTML('beforeend', '<p class="lbl rise" style="--i:2">Meals a day</p>');
    var box1 = document.createElement('div'); el.appendChild(box1);
    cards(box1, MEALS, S.food.mealsPerDay, function (v) { S.food.mealsPerDay = v; }, { tiles: true });
    el.insertAdjacentHTML('beforeend', '<p class="lbl rise" style="--i:4">Snacks</p>');
    var box2 = document.createElement('div'); el.appendChild(box2);
    cards(box2, SNACKS, S.food.snackFrequency, function (v) { S.food.snackFrequency = v; }, { chips: true });
    primary('Continue');
  }
  var DESSERT = [
    { v: '0', l: 'No desserts', h: 'Skip desserts entirely.' },
    { v: 'once_per_week', l: 'Once a week', h: 'One night per week. An occasional treat.' },
    { v: 'few_per_week', l: 'A few nights a week', h: '2 or 3 nights. A treat, not an expectation.' },
    { v: 'most_nights', l: 'Most nights', h: '4 to 6 nights a week.' },
    { v: 'every_night', l: 'Every night', h: 'A nightly treat after dinner.' },
    { v: 'ai_decide', l: 'Let the plan decide', h: 'We’ll fit them in where they make sense.' },
  ];
  function rDessert(el, my) {
    head(el, 'Your food', 'Want dessert in your plan?', 'A small treat on top of your meals: protein ice cream, mug cakes.');
    cards(el, DESSERT, S.food.dessertFrequency, function (v) { S.food.dessertFrequency = v; enable(true); });
    primary('Continue', null, !S.food.dessertFrequency);
  }
  function needGrid() {
    var f = S.food, k = keyOf([f.dietPattern, f.allergies, f.skip]);
    if (S.gridKey === k) return loadIndex();
    return Promise.all([loadIndex(), call('mainsGrid', { dietPattern: f.dietPattern || 'any', allergies: f.allergies, skip: f.skip }).then(function (g) {
      S.grid = g; S.gridKey = k;
      var ok = {}; g.meals.forEach(function (m) { ok[m.slug] = 1; });
      f.picks = f.picks.filter(function (s) { return ok[s]; });
    })]);
  }
  function rPicks(el, my) {
    withData(el, my, needGrid, 'Loading the meals…', function () {
      var f = S.food, g = S.grid;
      head(el, 'Your food', 'Pick meals you <em>like.</em>', 'One cook makes 8 tubs. ' + esc(g.recommendLine));
      el.insertAdjacentHTML('beforeend', '<p class="pickc rise" style="--i:2" id="pc"></p><div class="picks">' + g.meals.map(function (m, k) {
        return '<button type="button" class="pick rise' + (m.skipped ? ' low' : '') + '" style="--i:' + Math.min(k + 3, 12) + '" data-pick="' + m.slug + '" aria-pressed="' + (f.picks.indexOf(m.slug) > -1) + '">' + photo(m.slug, m.name) + '<span class="ck" aria-hidden="true"></span><span class="t">' + esc(m.name) + '<small>' + m.minutes + ' min hands-on</small></span></button>';
      }).join('') + '</div>' + (g.meals.length ? '' : '<p class="note">No batch mains fit these answers. The plan still builds the rest of your week.</p>'));
      var upd = function () {
        var n = f.picks.length;
        $('#pc', el).textContent = n ? n + ' picked' + (n < g.recommend ? ', we recommend ' + g.recommend : '') : 'Pick some, or let the plan choose';
        primary(n ? 'Build my week' : 'Let the plan choose', function () { go('mealbuild'); });
      };
      $$('[data-pick]', el).forEach(function (b) { b.onclick = function () { toggle(f.picks, b.getAttribute('data-pick')); b.setAttribute('aria-pressed', f.picks.indexOf(b.getAttribute('data-pick')) > -1); upd(); }; });
      upd();
    });
  }
  function foodForEngine() { var f = S.food; return Object.assign({}, f, { dietPattern: f.dietPattern || 'any', dessertFrequency: f.dessertFrequency || 'ai_decide' }); }
  function needMeals() {
    var k = keyOf([aboutForEngine(), foodForEngine()]);
    return loadIndex().then(function () {
      if (S.mealsKey === k && S.meals) return S.meals;
      return call('buildMeals', aboutForEngine(), foodForEngine()).then(function (m) { S.meals = m; S.mealsKey = k; S.day = 0; S.ticks = {}; S.openAisle = null; return m; });
    });
  }
  /** The app's grocery amounts, without shop and brand names (and no "100 tsp" for spices). */
  function cleanAmount(r) {
    if (r.negligible) return '';
    var s = String(r.amount || '').replace(/\s*\([^)]*\)/g, '');
    if (s.indexOf(':') > -1) s = s.split(':')[0];
    if (/(^|\D)(\d{2,})\s*(tsp|tbsp)\b/.test(s)) return '';
    return s.replace(/\s+/g, ' ').trim();
  }
  function shopRows(G) {
    var merged = [], by = {};
    G.rows.forEach(function (r) {
      var k = r.category + '|' + shortName(r.name).toLowerCase(), a = cleanAmount(r);
      if (by[k]) { if (a && by[k].amount.indexOf(a) < 0) by[k].amount += (by[k].amount ? ' + ' : '') + a; return; }
      by[k] = { key: r.key, name: shortName(r.name), amount: a, category: r.category };
      merged.push(by[k]);
    });
    return merged;
  }
  function shortName(n) { return String(n).split(/[,(\[]/)[0].trim(); }
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dl(date) { var p = date.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return { dow: DOW[d.getUTCDay()], long: DOWL[d.getUTCDay()], d: d.getUTCDate(), mon: MON[d.getUTCMonth()] }; }
  function rMealBuild(el, my) {
    var f = foodForEngine();
    buildMoment(el, my, {
      word: 'your week.', sub: f.picks.length ? f.picks.length + ' favourites' : 'Your answers',
      work: needMeals,
      over: function (M) { return M.plan.name || 'Your week'; },
      steps: function (M) {
        var R = M.report, c = R.counts, t = R.targets, av = R.avg, b = R.batch;
        var kcalOff = (R.misses && R.misses.kcal) || 0;
        var list = [];
        list.push({ label: 'Setting your macros', value: n0(t.kcal) + ' kcal \u00b7 ' + t.protein + ' g protein' });
        list.push(f.picks.length ? { label: 'Reading your ' + f.picks.length + ' favourite' + (f.picks.length === 1 ? '' : 's'), value: f.picks.length + ' meal' + (f.picks.length === 1 ? '' : 's') } : { label: 'Choosing meals for you', value: 'from the library' });
        list.push({ label: 'Placing ' + c.meals + ' meals across ' + c.days + ' days', value: c.meals + ' / ' + c.meals });
        list.push(kcalOff ? { label: 'Balancing kcal across the week', value: n0(av.kcal) + ' a day' } : { label: 'Hitting ' + n0(t.kcal) + ' kcal every day', value: n0(av.kcal), count: { to: av.kcal } });
        if (b) {
          list.push({ label: 'Planning your cook', value: 'cook ' + b.potsToCook + ' pot' + (b.potsToCook === 1 ? '' : 's') });
          list.push({ label: 'Filling your freezer', value: b.tubsBanked ? b.tubsBanked + ' tub' + (b.tubsBanked === 1 ? '' : 's') + ' banked' : b.tubsFromStock ? b.tubsFromStock + ' from the freezer' : 'all in the fridge' });
        }
        list.push({ label: 'Balancing protein', value: Math.round(av.protein) + ' / ' + t.protein + ' g', count: { to: Math.round(av.protein), suffix: ' / ' + t.protein + ' g' } });
        if ((R.kept || []).indexOf('fibre') > -1 && av.fiber) list.push({ label: 'Checking fibre', value: Math.round(av.fiber) + ' g a day' });
        list.push({ label: 'Building your shopping list', value: shopRows(M.grocery).length + ' items' });
        return list;
      },
      visual: function (M) {
        var dates = Object.keys(M.plan.dailyMeals).sort(), max = 0;
        dates.forEach(function (d) { max = Math.max(max, mealCards(M.plan.dailyMeals[d].meals).length); });
        return '<div class="wgrid">' + dates.map(function (d) {
          var cards = mealCards(M.plan.dailyMeals[d].meals), day = (M.report.days.filter(function (x) { return x.date === d; })[0] || {});
          var fill = Math.max(0, Math.min(1, (day.kcal || 0) / M.report.targets.kcal));
          return '<div class="wcol"><span class="dl">' + dl(d).dow.charAt(0) + '</span>' + cards.map(function (c) { return '<div class="cell"><div class="in">' + (INDEX && INDEX[c.slug] && INDEX[c.slug].i ? '<img src="/images/meals/' + INDEX[c.slug].i + '.webp" alt="" width="60" height="60">' : '<div class="ic">' + iconFor(c.slug) + '</div>') + '</div></div>'; }).join('') +
            new Array(max - cards.length + 1).join('<div class="cell"></div>') + '<div class="dbar"><i data-f="' + fill.toFixed(3) + '"></i></div></div>';
        }).join('') + '</div>';
      },
      onStep: function (i, M, box, now) {
        var label = ($$('.st .l', box)[i] || {}).textContent || '';
        if (/^Placing/.test(label)) {
          var cells = $$('.cell', box).filter(function (c) { return c.firstChild; });
          cells.forEach(function (c, k) { now ? c.classList.add('on') : setTimeout(function () { c.classList.add('on'); }, k * 12); });
        }
        if (/kcal/.test(label)) $$('.dbar i', box).forEach(function (b, k) { var go = function () { b.style.transform = 'scaleX(' + b.getAttribute('data-f') + ')'; }; now ? go() : setTimeout(go, k * 45); });
      },
      done: function () { replaceWith('weekready'); },
    });
  }
  /** One card per eating moment: a combo (two foods eaten together) is one card; an add-on rides under its main ("+ Wrap"). */
  function mealCards(meals) {
    var out = [], combos = {};
    meals.forEach(function (m) {
      var tags = m.tags || [];
      if (m.combo_id) {
        if (combos[m.combo_id]) { var c = combos[m.combo_id]; c.kcal += m.calories; c.protein += m.macros.protein; return; }
        combos[m.combo_id] = { slug: m.curated_meal_slug, name: m.combo_name || m.name, type: m.type, time: m.time, kcal: m.calories, protein: m.macros.protein, plus: [], tags: tags, tubFrom: m.tubFrom, combo: true };
        out.push(combos[m.combo_id]); return;
      }
      if (tags.indexOf('add_on') > -1 && out.length) {
        var host = out.filter(function (x) { return x.type === m.type; }).pop() || out[out.length - 1];
        host.plus.push(m.name); host.kcal += m.calories; host.protein += m.macros.protein; return;
      }
      out.push({ slug: m.curated_meal_slug, name: m.name, type: m.type, time: m.time, kcal: m.calories, protein: m.macros.protein, plus: [], tags: tags, tubFrom: m.tubFrom });
    });
    return out;
  }
  function rWeekReady(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needMeals, 'Building your week…', function (M) {
        var cooks = M.cooks || [];
        var tubs = 0, mins = 0; cooks.forEach(function (c) { tubs += c.tubs; mins += c.handsOnMinutes; });
        el.innerHTML = '<p class="ov rise" style="--i:0">Your week of meals</p><h1 class="qh rise" style="--i:1">Your week is <em>ready.</em></h1>' +
          '<p class="sub rise" style="--i:2">' + M.report.counts.meals + ' meals across ' + M.report.counts.days + ' days' + (cooks.length ? ', from ' + (cooks.length === 1 ? 'one cook' : cooks.length + ' cooks') + ': ' + mins + ' minutes hands-on, ' + tubs + ' tubs.' : '.') + '</p>' +
          cooks.map(function (C, k) {
            var L = dl(C.date);
            return '<div class="cookcard rise" style="--i:' + (3 + k) + '"><div class="hero">' + C.pots.map(function (p) { return photo(p.recipe, p.name); }).join('') + '</div><div class="body"><p class="when">' + L.long + ' ' + L.d + ' ' + L.mon + ' · cook</p>' +
              C.pots.map(function (p) { var pg = recipe(p.recipe) || recipe(p.fullRecipe); return '<h3>' + (pg ? '<a href="../r/' + pg + '/" target="_blank" rel="noopener">' + esc(p.name) + '</a>' : esc(p.name)) + '</h3>'; }).join('') +
              '<div class="chips3"><span><b>' + C.pots.length + '</b> pot' + (C.pots.length === 1 ? '' : 's') + '</span><span><b>' + C.handsOnMinutes + '</b> min hands-on</span><span><b>' + C.tubs + '</b> tubs</span></div></div></div>';
          }).join('');
        primary('See today’s meals', function () { go('today'); });
      });
    });
  }
  var SLOT = { breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', second_lunch: 'Lunch', early_dinner: 'Dinner', dinner: 'Dinner', dessert: 'Dessert', pre_workout: 'Before training', post_workout: 'After training', morning_snack: 'Snack', afternoon_snack: 'Snack', evening_snack: 'Snack', snack: 'Snack' };
  function rToday(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needMeals, 'Building your week…', function (M) {
        var dates = Object.keys(M.plan.dailyMeals).sort();
        var draw = function (anim) {
          var i = Math.min(S.day, dates.length - 1), date = dates[i], L = dl(date);
          var day = M.report.days.filter(function (x) { return x.date === date; })[0];
          var cards = mealCards(M.plan.dailyMeals[date].meals);
          el.innerHTML = '<p class="ov' + (anim ? ' rise' : '') + '" style="--i:0">Your week of meals</p><h1 class="qh' + (anim ? ' rise' : '') + '" style="--i:1">' + (i === 0 ? 'Day one.' : L.long + '.') + '</h1>' +
            '<div class="days" role="group" aria-label="Days">' + dates.map(function (d, j) { var x = dl(d); return '<button type="button" class="day" data-day="' + j + '" aria-pressed="' + (j === i) + '"><small>' + x.dow + '</small><b>' + x.d + '</b></button>'; }).join('') + '</div>' +
            '<div class="mcards">' + cards.map(function (c, k) {
              var pg = c.combo ? null : recipe(c.slug);
              var tag = c.tags.indexOf('tub') > -1 ? (c.tubFrom === 'freezer' || c.tubFrom === 'thawing' ? 'from the freezer' : 'tub') : '';
              return '<div class="mc" style="--i:' + k + '"><div class="tile">' + photo(c.slug, c.name) + '</div><div><span class="sl">' + esc(SLOT[c.type] || c.type) + (c.time ? ' · ' + esc(c.time) : '') + '</span>' +
                (pg ? '<a class="nm" href="../r/' + pg + '/" target="_blank" rel="noopener">' + esc(c.name) + '</a>' : '<span class="nm">' + esc(c.name) + '</span>') +
                c.plus.map(function (p) { return '<span class="plus">+ ' + esc(p) + '</span>'; }).join('') +
                '<span class="kc">' + n0(c.kcal) + ' kcal · ' + Math.round(c.protein) + ' g protein' + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</span></div></div>';
            }).join('') + '</div>' +
            (day ? '<div class="daytot"><div><b>' + n0(day.kcal) + ' kcal · ' + Math.round(day.protein) + ' g protein</b><br><span>Your target: ' + n0(M.report.targets.kcal) + ' kcal · ' + M.report.targets.protein + ' g</span></div></div>' : '') +
            '<button type="button" class="btn2" id="shopBtn">Shopping list <small>' + shopRows(M.grocery).length + ' items ›</small></button>';
          $$('[data-day]', el).forEach(function (b) { b.onclick = function () { S.day = +b.getAttribute('data-day'); var y = window.scrollY; draw(false); window.scrollTo(0, y); }; });
          $('#shopBtn', el).onclick = function () { go('shop'); };
        };
        draw(true);
        primary('Plan my training', function () { go('days'); });
      });
    });
  }
  function rShop(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needMeals, 'Writing your shopping list…', function (M) {
        var G = M.grocery, rows = shopRows(G);
        var groups = G.categoryOrder.map(function (c) { return { c: c, name: G.categoryNames[c], rows: rows.filter(function (r) { return r.category === c; }) }; }).filter(function (g) { return g.rows.length; });
        el.innerHTML = '<p class="ov rise" style="--i:0">Shopping list</p><h1 class="qh rise" style="--i:1">One shop for <em>the week.</em></h1><p class="sub rise" style="--i:2">' + rows.length + ' items, cook day included. Tap an aisle.</p>' +
          '<div class="rise" style="--i:3;margin-top:18px">' + groups.map(function (g) {
            return '<div class="aisle" data-open="' + (S.openAisle === g.c) + '"><button type="button" data-aisle="' + g.c + '" aria-expanded="' + (S.openAisle === g.c) + '"><span>' + esc(g.name) + '<small>' + g.rows.length + '</small></span>' + CHEV + '</button><div class="items">' +
              g.rows.map(function (r) { var id = 'g-' + r.key.replace(/[^a-z0-9]/gi, '_'), on = !!S.ticks[r.key]; return '<label class="gi' + (on ? ' done' : '') + '" for="' + id + '"><input type="checkbox" id="' + id + '" data-tick="' + esc(r.key) + '"' + (on ? ' checked' : '') + '><div><span>' + esc(r.name) + '</span>' + (r.amount ? '<small>' + esc(r.amount) + '</small>' : '') + '</div></label>'; }).join('') + '</div></div>';
          }).join('') + '</div><p class="note">In the app the list also splits by cook, takes your own pack sizes, and remembers what you bought.</p>';
        $$('[data-aisle]', el).forEach(function (b) { b.onclick = function () { var box = b.parentNode, open = box.getAttribute('data-open') !== 'true'; $$('.aisle', el).forEach(function (x) { x.setAttribute('data-open', 'false'); }); box.setAttribute('data-open', open); b.setAttribute('aria-expanded', open); S.openAisle = open ? b.getAttribute('data-aisle') : null; }; });
        $$('[data-tick]', el).forEach(function (b) { b.onchange = function () { S.ticks[b.getAttribute('data-tick')] = b.checked; b.closest('.gi').classList.toggle('done', b.checked); }; });
        primary('Plan my training', function () { go('days'); });
      });
    });
  }

  /* ================= training ================= */
  function rDays(el, my) {
    needAbout(el, my, function () {
      head(el, 'Your training', 'How many days a week?', 'From 2 days up, the same weekly sets and growth. Days mostly change how long each session is.');
      cards(el, [1, 2, 3, 4, 5, 6].map(function (d) { return { v: d, l: String(d) }; }), S.training.days, function (v) { S.training.days = v; enable(true); }, { tiles: true });
      primary('Continue', null, !S.training.days);
    });
  }
  var EQUIP = [
    { v: 'commercial_gym', l: 'Commercial gym', h: 'Machines, cables, barbells and dumbbells.' },
    { v: 'home_gym', l: 'Home gym', h: 'Barbell, dumbbells, a bench and a pull-up bar. Coming to the app soon.' },
    { v: 'basic_equipment', l: 'Basic equipment', h: 'Dumbbells and a bench. Coming to the app soon.' },
    { v: 'bodyweight', l: 'Bodyweight only', h: 'A pull-up bar and a bench at most. Coming to the app soon.' },
  ];
  function rEquip(el, my) {
    needAbout(el, my, function () {
      head(el, 'Your training', 'What’s available to you?', 'Decides which exercises your plan can use.');
      cards(el, EQUIP, S.training.equipment, function (v) { S.training.equipment = v; enable(true); setTimeout(function () { if (my === token) go('progbuild'); }, RM ? 60 : 260); });
      primary('Build my program', function () { go('progbuild'); }, !S.training.equipment);
    });
  }
  function trainForEngine() { return { days: S.training.days || 3, equipment: S.training.equipment || 'commercial_gym' }; }
  function needProgram() {
    var k = keyOf([aboutForEngine(), trainForEngine()]);
    return loadIndex().then(function () {
      if (S.programKey === k && S.program) return S.program;
      return call('buildProgram', aboutForEngine(), trainForEngine()).then(function (p) { S.program = p; S.programKey = k; S.openDay = null; return p; });
    });
  }
  function exImg(name) {
    var slug = EXINDEX && EXINDEX[name];
    var sx = S.about && S.about.sex === 'female' ? 'pink' : 'blue';
    return slug ? '<img src="/images/exercises/' + slug + '/' + sx + '/start.webp" alt="" loading="lazy" decoding="async" width="112" height="112">' : '';
  }
  function rProgBuild(el, my) {
    var t = trainForEngine();
    buildMoment(el, my, {
      word: 'your program.', sub: t.days + ' days a week · 8 weeks',
      work: needProgram,
      over: function (P) { return P.program.routine_name; },
      steps: function (P) { return P.view.steps; },
      visual: function (P) {
        return '<p class="note" style="margin:0 0 10px">Week 1' + (P.view.weeks > 1 ? ' of ' + P.view.weeks : '') + '</p><div class="drows">' + P.view.days.map(function (d) {
          return '<div class="drow"><span class="n">' + esc(d.name) + '</span><span class="th">' + d.exercises.map(function (x) { return '<span>' + exImg(x) + '</span>'; }).join('') + '</span></div>';
        }).join('') + '</div>';
      },
      onStep: function (i, P, box, now) {
        if (i !== 1) return;
        $$('.drow', box).forEach(function (row, r) {
          $$('.th span', row).forEach(function (s, k) { now ? s.classList.add('on') : setTimeout(function () { s.classList.add('on'); }, r * 70 + k * 35); });
        });
      },
      done: function () { replaceWith('program'); },
    });
  }
  function rest(sec) { if (!sec) return ''; if (sec < 60) return sec + ' s'; var m = Math.floor(sec / 60), s = sec % 60; return m + ' min' + (s ? ' ' + s + ' s' : ''); }
  function rProgram(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needProgram, 'Building your program…', function (P) {
        var prog = P.program, b0 = prog.blocks[0], sched = b0.weekly_schedule || [];
        var byName = {}; b0.days.forEach(function (d) { byName[d.day_name] = d; });
        var sx = S.about.sex === 'female' ? 'pink' : 'blue';
        el.innerHTML = '<p class="ov rise" style="--i:0">' + esc(prog.routine_name) + '</p><h1 class="qh rise" style="--i:1">Your <em>week.</em></h1>' +
          '<p class="sub rise" style="--i:2">' + prog.days_per_week + ' days a week. Tap a day to see the session.</p>' +
          (P.appBuildsGym ? '<p class="flag rise" style="--i:2"><i></i><span>Home and bodyweight programs are coming to the app. Today the app builds gym programs.</span></p>' : '') +
          '<div class="wk">' + sched.map(function (s, k) {
            var d = byName[s.day_name];
            if (s.type !== 'training' || !d) return '<div class="wd rest" style="--i:' + k + '"><button type="button" tabindex="-1"><span class="dn">DAY ' + (k + 1) + '</span><span><b>Rest</b></span><span></span></button></div>';
            return '<div class="wd" style="--i:' + k + '" data-open="' + (S.openDay === k) + '"><button type="button" data-wd="' + k + '" aria-expanded="' + (S.openDay === k) + '"><span class="dn">DAY ' + (k + 1) + '</span><span><b>' + esc(s.day_name) + '</b><small>' + d.exercises.length + ' exercises · ~' + d.estimated_duration + ' min</small></span>' + CHEV + '</button><div class="exs">' +
              d.exercises.map(function (e, j) {
                var slug = EXINDEX && EXINDEX[e.exercise];
                var sets = (e.sets_weekly && e.sets_weekly['1']) || e.sets, rir = e.rir_weekly && e.rir_weekly['1'];
                return '<div class="ex" style="--i:' + j + '"><div class="im">' + (slug ? '<img src="/images/exercises/' + slug + '/' + sx + '/start.webp" alt="" loading="lazy" decoding="async" width="112" height="112">' : '') + '</div><div>' +
                  (slug ? '<a class="nm" href="../exercises/#' + slug + '" target="_blank" rel="noopener">' + esc(e.exercise) + '</a>' : '<span class="nm">' + esc(e.exercise) + '</span>') +
                  '<div class="meta"><span><b>' + sets + ' × ' + esc(e.reps) + '</b></span>' + (e._restSec ? '<span>Rest ' + rest(e._restSec) + '</span>' : '') + (rir ? '<span>RIR ' + esc(rir) + '</span>' : '') + '</div></div></div>';
              }).join('') + '<p class="note">Sets × reps, rest between sets, and RIR: reps left in the tank on each set. Week 1.</p></div></div>';
          }).join('') + '</div>' +
          '<button type="button" class="btn2 rise" style="--i:8" id="volBtn" aria-expanded="false">Sets per muscle <small>week 1 ›</small></button><div id="vol" class="vol" hidden></div>';
        $$('[data-wd]', el).forEach(function (b) {
          b.onclick = function () {
            var k = +b.getAttribute('data-wd'), box = b.parentNode, open = box.getAttribute('data-open') !== 'true';
            $$('.wd', el).forEach(function (x) { x.setAttribute('data-open', 'false'); });
            box.setAttribute('data-open', open); b.setAttribute('aria-expanded', open); S.openDay = open ? k : null;
          };
        });
        $('#volBtn', el).onclick = function () {
          var v = $('#vol', el), open = v.hidden;
          if (open && !v.innerHTML) {
            var vol = P.volume || {};
            v.innerHTML = '<p class="note" style="margin-bottom:6px">Main lifts count a full set, lifts where the muscle helps count half. The shaded band is your target.</p>' + (P.targets || []).filter(function (t) { return t.kind === 'standard'; }).map(function (t) {
              var x = vol[t.row] || 0, max = Math.max(24, t.hi, x);
              return '<div class="vr"><span>' + esc(t.row) + '</span><span class="vb"><i style="left:' + (t.lo / max * 100) + '%;width:' + ((t.hi - t.lo) / max * 100) + '%"></i><s style="left:calc(' + Math.min(100, x / max * 100) + '% - 2px)"></s></span><span class="vn">' + (Math.round(x * 2) / 2) + '</span></div>';
            }).join('');
          }
          v.hidden = !open; this.setAttribute('aria-expanded', open);
        };
        primary('Keep it', function () { go('keep'); });
      });
    });
  }

  /* ================= keep it ================= */
  function rKeep(el) {
    el.classList.add('keep');
    el.innerHTML = '<p class="ov rise" style="--i:0">Your plan is ready</p><h1 class="qh rise" style="--i:1">All of it is decided <em>for you.</em></h1>' +
      '<p class="sub rise" style="--i:2">The app runs these same engines, and does the rest every day.</p>' +
      '<ul class="decided rise" style="--i:3">' +
      '<li><div><b>Cook mode with timers</b><span>Every step on screen, timers set for you.</span></div></li>' +
      '<li><div><b>Prep day reminders</b><span>A reminder when it is time to cook.</span></div></li>' +
      '<li><div><b>Swap any meal, your macros hold</b><span>The day rebalances around the swap.</span></div></li>' +
      '<li><div><b>Log workouts and see last time</b><span>Last session’s weights, right beside this one.</span></div></li>' +
      '<li><div><b>The route updates as you check in</b><span>Log your weight and the phases adjust.</span></div></li></ul>' +
      '<p class="closer rise" style="--i:4">You just show up and follow it.</p>' +
      '<div class="badges rise" style="--i:5">' +
        '<a class="badge" href="' + APP_STORE + '" data-loc="try_end"><svg width="22" height="26" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg><div><small>Download on the</small><span>App Store</span></div></a>' +
        '<a class="badge ghost" href="' + PLAY + '" data-loc="try_end"><svg width="22" height="24" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg><div><small>Get it on</small><span>Google Play</span></div></a>' +
      '</div><p class="trust rise" style="--i:6"><b>Free</b> · No ads · No account</p>' +
      '<p class="honest rise" style="--i:6">This plan stays on this page. It doesn’t carry over to the app: answer the same questions there and the app builds it again in about a minute.</p>';
    primary('Start again', function () { stack = []; go('weight'); });
  }

  /* ================= sheet ================= */
  var sheetEls = null, sheetDismiss = null;
  /** onDismiss runs when the sheet is closed by the backdrop or Escape, not by its own buttons. */
  function openSheet(html, onMount, onDismiss) {
    closeSheet(true);
    sheetDismiss = onDismiss || null;
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab"></div><div class="sheet-in">' + html + '</div>';
    // The sheet sits outside .try, so it takes the section's accent from it.
    try { sh.style.setProperty('--acc', getComputedStyle(root).getPropertyValue('--acc').trim() || '#c084fc'); } catch (e) {}
    document.body.appendChild(bg); document.body.appendChild(sh);
    sheetEls = [bg, sh];
    bg.onclick = dismissSheet;
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    onMount && onMount(sh);
  }
  function dismissSheet() { var f = sheetDismiss; closeSheet(); if (f) f(); }
  function closeSheet(now) {
    sheetDismiss = null;
    if (!sheetEls) return;
    var els = sheetEls; sheetEls = null;
    els.forEach(function (e) { e.classList.remove('on'); });
    setTimeout(function () { els.forEach(function (e) { e.remove(); }); }, now ? 0 : 340);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetEls) dismissSheet(); });

  /* ================= boot ================= */
  var params = new URLSearchParams(location.search);
  var demo = params.get('demo');
  var want = params.get('step') || '';
  var target = /^\d+$/.test(want) ? Math.max(0, Math.min(SCREENS.length - 1, +want - 1)) : (IDX[want] != null ? IDX[want] : 0);
  try { history.replaceState({ t: 0 }, ''); } catch (e) {}
  if (demo) {
    root.classList.add('still');
    holdBuild = !!SCREENS[target].build;
    document.documentElement.classList.add('still');
    var fill = demo === '2'
      ? function () {
          return call('defaults', 'female').then(function (d) {
            S.defaults = d;
            S.about = { sex: 'female', ageYears: 36, heightCm: 166, weightKg: 72, bodyFatPct: 32, bodyFatSource: 'reported', goalWeightKg: 64, goalBodyFatPct: 25, trainingState: 'new', activityLevel: 'light', trainingSessionsPerWeek: 1.5, route: 'lean' };
            S.touched = { goalWeightKg: true, goalBodyFatPct: true, heightCm: true, bodyFatPct: true };
            S.food = { mealsPerDay: 3, snackFrequency: 'ai_decide', dessertFrequency: 'once_per_week', dietPattern: 'vegetarian', allergies: ['Nuts'], skip: [], picks: [] };
            S.training = { days: 3, equipment: 'home_gym' };
          });
        }
      : function () {
          return ensureAbout().then(function () {
            var a = S.about; a.sex = 'male'; a.trainingState = 'consistent'; a.activityLevel = 'light'; a.trainingSessionsPerWeek = 3.5;
            S.food.dietPattern = 'any'; S.food.dessertFrequency = 'ai_decide';
            S.training = { days: 4, equipment: 'commercial_gym' };
          });
        };
    fill().then(function () { if (params.get('route')) S.about.route = params.get('route'); for (var k = 0; k < target; k++) if (!SCREENS[k].build) stack.push(k); show(target, 0); }, function (e) { stage.innerHTML = errBox(e.message); });
  } else {
    show(0, 0);
  }
})();
