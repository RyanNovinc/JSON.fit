/* json.fit /try/: the app's onboarding on the web.
 *
 * One question per screen, then a build moment and the result a piece at a
 * time, for the route, the week of meals and the training program. Every plan
 * is built in a Web Worker by engines.min.js: the app's own route, meal plan,
 * shopping list and workout code (scripts/try-engines/). The answers live in
 * this tab's memory only. Nothing typed here is sent, stored or put in the
 * URL; the only events are the screens reached (track('try_step', {step, screen})).
 *
 * ?step=<number or screen id>&demo=1 (or demo=2, or demo=3 with allergies, skipped foods and salt) fills the answers and opens a
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
    food: freshFood(), mv: null, copy: null, cat: null, pk: null, edit: false, accepted: null,
    training: { days: null, length: null, volume: null, refine: null },
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
    { id: 'volume', sec: 'train', r: rVolume },
    { id: 'days', sec: 'train', r: rDays },
    { id: 'length', sec: 'train', r: rLength },
    { id: 'refine', sec: 'train', r: rRefine },
    { id: 'progbuild', sec: 'train', r: rProgBuild, build: true },
    { id: 'program', sec: 'train', r: rProgram },
    { id: 'blocks', sec: 'train', r: rBlocks, side: true },
    { id: 'trainweek', sec: 'train', r: rTrainWeek, side: true },
    { id: 'session', sec: 'train', r: rSession, side: true },
    { id: 'traindone', sec: 'train', grp: '', r: rFinish, noBack: true },
    { id: 'active', sec: 'food', r: rActive },
    { id: 'sessions', sec: 'food', r: rSessions, when: 'sessions' },
    { id: 'diettype', sec: 'food', r: rDietType },
    { id: 'meat', sec: 'food', r: rMeat },
    { id: 'allergies', sec: 'food', r: rAllergies },
    { id: 'skip', sec: 'food', r: rSkip },
    { id: 'keeplower', sec: 'food', r: rKeepLower },
    { id: 'sleep', sec: 'food', r: rSleep },
    { id: 'eat', sec: 'food', r: rEat },
    { id: 'snacks', sec: 'food', r: rSnacks, when: 'snacks' },
    { id: 'appetite', sec: 'food', r: rAppetite, when: 'appetite' },
    { id: 'dessert', sec: 'food', r: rDessert },
    { id: 'cooker', sec: 'food', r: rCooker },
    { id: 'freezer', sec: 'food', r: rFreezer },
    { id: 'cadence', sec: 'food', r: rCadence },
    { id: 'stockup', sec: 'food', r: rStockUp, when: 'stockup' },
    { id: 'planlength', sec: 'food', r: rPlanLength },
    { id: 'picks', sec: 'food', r: rPicks },
    { id: 'mealsummary', sec: 'food', r: rSummary2 },
    { id: 'mealbuild', sec: 'food', r: rMealBuild, build: true },
    { id: 'mealnote', sec: 'food', r: rMealNote, when: 'mealnote', side: true },
    { id: 'mealweek', sec: 'food', r: rMealWeek, when: 'mealweek', side: true },
    { id: 'mealgap', sec: 'food', r: rMealGap, when: 'mealgap', side: true },
    { id: 'weekready', sec: 'food', r: rWeekReady },
    { id: 'today', sec: 'food', r: rToday },
    { id: 'shop', sec: 'food', r: rShop, side: true },
    { id: 'alldone', sec: 'food', grp: '', r: rFinish, noBack: true },
    { id: 'keep', sec: 'done', r: rKeep },
  ];
  var IDX = {}; SCREENS.forEach(function (s, i) { IDX[s.id] = i; });
  var SECS = ['route', 'train', 'food'];
  var SEC_NAME = { route: 'Your route', food: 'Your food', train: 'Training', done: 'Done', intro: '' };

  var cur = -1, stack = [], seen = {}, token = 0, holdBuild = false;
  function trackScreen(i) {
    if (seen[i]) return; seen[i] = 1;
    try { if (window.track) window.track('try_step', { step: i + 1, screen: SCREENS[i].id }); } catch (e) {}
  }
  function progress(i) {
    var s = SCREENS[i];
    prog.hidden = s.sec === 'intro';
    // Once the questions start, the site's menu and footer go, so it reads like the app.
    document.body.classList.toggle('immersive', s.sec !== 'intro');
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
      ctaNote('');
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
  function appliesBack(i) { var s = SCREENS[i]; return !!s && (!s.when || WHEN[s.when]()); }
  function next() {
    var adv = function () { var i = cur + 1; while (SCREENS[i] && !applies(i)) i++; go(i); };
    // The route's steps depend on the plan, so the engine answers before the next one is picked.
    if (SCREENS[cur + 1] && SCREENS[cur + 1].when && SCREENS[cur + 1].sec === 'route') { enable(false); needRV().then(adv, adv); } else adv();
  }
  function back() {
    if (!stack.length) return;
    var i = stack.pop();
    if (i < 0) i = 0;
    // Never land back on a build, or on a route step these answers no longer have.
    while (i > 0 && SCREENS[i] && (SCREENS[i].build || (SCREENS[i].when && !appliesBack(i)))) i = stack.length ? stack.pop() : i - 1;
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
        goalWeightKg: null, goalBodyFatPct: d.goalBodyFatPct, belowFloorOk: false, trainingState: null, activityLevel: null, trainingChoice: null,
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
  /** trainingChoice is N4bTraining's answer in the flow ('yes' | 'no'), trainingEdit the one from the meal summary's
   *  Training row (written at the summary, as the app does); unanswered, the engine counts the app's no-plan default. */
  function aboutForEngine() { var a = S.about; return Object.assign({}, a, { sex: a.sex || 'male', goalWeightKg: goalW(), trainingState: a.trainingState || 'consistent', activityLevel: a.activityLevel || 'light', trainingChoice: a.trainingChoice || null, trainingEdit: a.trainingEdit || null }); }
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
    // beginNutritionSteps: N4bTraining is left out when the workout plan already says how much you train.
    sessions: function () { return !(S.mv && S.mv.trainingKnown); },
    // The meal flow's conditional steps (nutritionSteps): no snacks a day steps over the checklist,
    // the appetite question is for gaining, stock up needs a freezer that holds a week.
    snacks: function () { return S.food.snackFrequency !== '0'; },
    appetite: function () { return !!(S.mv && S.mv.gaining); },
    stockup: function () { return !(S.mv && S.mv.stockUpShows === false); },
    mealnote: function () { return !!(S.meals && S.meals.note); },
    mealweek: function () { return !!(S.meals && S.meals.week); },
    mealgap: function () { return !!(S.meals && S.meals.gap); },
  };

  /* ================= your meals (the app's meal questions, screen by screen) =================
   * The app's walk after the workout plan, the finish line's second step
   * (questionnaireRouting.continueNutritionFlow, nutritionSteps with
   * BATCH_PLANNER and BATCH_LIBRARY on): N4Activity, N4bTraining (only with no
   * plan: with one, its sessions and minutes a week are saved and the step is
   * left out, so every number after it moves up one), N5DietType, N5aDietPattern, N5bAllergies, N5dSkipFoods,
   * N5eKeepLower, N5cSleep, N6MealsSnacking, N6gSnacks, N6eAppetite (gaining),
   * N6aDessert, the meal prep part (N6bSlowCooker, N6cFreezer, N6dShopCadence,
   * N6fStockUp), N9PlanLength, then CuratedFavorites ("Foods you like"), the
   * summary ("Looking good."), MealBuildScreen and its batch note, week list and
   * gap. Copy is the app's word for word; the engine replays every answer
   * through the app's own storage writes (scripts/try-engines/meals-part.ts),
   * so each screen reads what the app's screen reads and the week is the
   * app's week. */
  var FOOD_STEPS = ['active', 'sessions', 'diettype', 'meat', 'allergies', 'skip', 'keeplower', 'sleep', 'eat', 'snacks', 'appetite', 'dessert', 'cooker', 'freezer', 'cadence', 'stockup', 'planlength'];
  var PREP_STEPS = ['cooker', 'freezer', 'cadence', 'stockup'];
  /** nutritionStepsFor + withoutStep: the steps this person sees, as the app numbers them on screen `id`. */
  function stepList(id) {
    var at = FOOD_STEPS.indexOf(id), f = S.food, mv = S.mv || {};
    return FOOD_STEPS.filter(function (s) {
      if (s === 'sessions') return !mv.trainingKnown;
      if (s === 'appetite') return !!mv.gaining;
      // N6gSnacks steps aside (navigation.replace with the step gone) once "None" is the answer.
      if (s === 'snacks') return !(f.snackFrequency === '0' && at > FOOD_STEPS.indexOf('eat'));
      // N6dShopCadence numbers itself as if stock up were gone when it will be skipped.
      if (s === 'stockup') return !(mv.stockUpShows === false && at >= FOOD_STEPS.indexOf('cadence'));
      return true;
    });
  }
  function stepLine(id, editLabel, optional) {
    if (S.edit) return editLabel;
    var l = stepList(id);
    return 'Step · ' + (l.indexOf(id) + 1) + ' of ' + l.length + (optional ? ' · Optional' : '');
  }
  /** "MEAL PREP · 2 OF 3" (nutritionSteps.mealPrepPosition). */
  function prepLine(id, editLabel) {
    if (S.edit) return editLabel;
    var l = stepList(id).filter(function (s) { return PREP_STEPS.indexOf(s) > -1; });
    return 'Meal prep · ' + (l.indexOf(id) + 1) + ' of ' + l.length;
  }
  /** The engine's view of one screen, after replaying every earlier answer the way the app saves it. */
  function mealView(screen) {
    return call('mealView', aboutForEngine(), foodForEngine(), screen).then(function (v) {
      S.mv = S.mv || {};
      S.mv.gaining = v.gaining;
      S.mv.trainingKnown = !!v.trainingKnown;
      if (v.stockUpShows != null && screen === 'cadence') S.mv.stockUpShows = v.stockUpShows;
      return v;
    });
  }
  function needCopy() {
    if (S.copy) return Promise.resolve(S.copy);
    return call('mealCopy').then(function (c) { S.copy = c; return c; });
  }
  function needCatalogue() {
    if (S.cat) return Promise.resolve(S.cat);
    return call('foodCatalogueView').then(function (c) { S.cat = c; return c; });
  }
  /** The answers as the engine takes them: exactly what each screen would have saved. */
  function foodForEngine() {
    var f = S.food, c = f.customMacros, sl = f.sleep, p = f.picks;
    return {
      dietType: f.dietType,
      customMacros: f.dietType === 'custom' ? { protein: parseInt(c.p, 10), carbs: parseInt(c.c, 10), fat: parseInt(c.f, 10) } : null,
      dietPattern: f.dietPattern, allergies: f.allergies.slice(), skip: f.skip.slice(), keepLower: f.keepLower,
      sleep: sl.skipped ? { skipped: true } : { bed: sl.bed, wake: sl.wake, strictness: sl.strictness, overrides: sl.overrides },
      mealsPerDay: f.mealsPerDay, snackFrequency: f.snackFrequency, mealVariety: f.mealVariety,
      snacks: { ticked: f.snacks.ticked || [], own: f.snacks.own.slice() },
      lowAppetite: f.lowAppetite, dessertFrequency: f.dessertFrequency, dessertDays: f.dessertDays.slice(),
      slowCooker: f.slowCooker, slowCookerCount: f.slowCookerCount, blender: f.blender, freezerTubs: f.freezerTubs,
      shopCadence: f.shopCadence, stockUp: f.stockUp, startDate: f.startDate,
      picks: { saved: p.saved, keys: p.keys.slice(), allergenOk: p.allergenOk, versionChoices: p.versionChoices, useUp: p.useUp.slice() },
      // The workout plan built first (the program as the importer saved it): calories count its minutes.
      plan: S.program ? { program: S.program.program, totalTrainingDays: S.training.days } : null,
    };
  }
  function freshFood() {
    return {
      dietType: null, customMacros: { p: '', c: '', f: '' }, dietPattern: null, allergies: [], skip: [], keepLower: null,
      sleep: { bed: 22 * 60 + 30, wake: 6 * 60 + 30, strictness: 'moderate', overrides: {}, touched: false, skipped: false },
      mealsPerDay: null, snackFrequency: null, mealVariety: 'balanced', snacks: { ticked: null, own: [] }, lowAppetite: null,
      dessertFrequency: null, dessertDays: [], slowCooker: null, slowCookerCount: 1, blender: null, freezerTubs: null,
      shopCadence: null, stockUp: null, startDate: 'tomorrow',
      picks: { saved: false, keys: [], allergenOk: {}, versionChoices: {}, useUp: [] },
    };
  }
  /** One question screen: the mono step line, the question, the line under it. */
  function qhead(el, line, q, sub) {
    el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">' + esc(line) + '</p><h1 class="qh rise" style="--i:0">' + q + '</h1>' + (sub ? '<p class="sub rise" style="--i:1">' + sub + '</p>' : '<div style="height:16px"></div>'));
  }
  /** The CTA in edit mode (opened from the summary's rows) reads "Save" and goes back there. */
  function foodCta(label, disabled, onClick) {
    primary(S.edit ? 'Save' : label, function () {
      if (S.edit) { S.edit = false; go('mealsummary'); return; }
      (onClick || next)();
    }, disabled);
  }
  function ctaNote(html) { var n = document.getElementById('ctaNote'); if (!n) return; n.innerHTML = html || ''; n.hidden = !html; }
  var CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var XS = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var MINUS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var INFO = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor"/></svg>';
  var WARN = '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M12 3l10 18H2z" fill="currentColor"/></svg>';
  var CHEVR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /** A meal photo by the app's image filename (plates have their own). */
  function photoFile(file, alt) {
    var stem = INDEX && INDEX.__files && INDEX.__files[file];
    if (stem) return '<img src="/images/meals/' + stem + '.webp" alt="' + esc(alt || '') + '" loading="lazy" decoding="async">';
    return '<span class="noimg">' + ICONS.meal + '</span>';
  }
  /** allergenCatch.allergenWord / allergenList. */
  function allergenWord(l) { var n = String(l).trim().toLowerCase(); return n === 'gluten/wheat' ? 'gluten' : n; }
  function allergenList(labels) {
    var w = []; labels.forEach(function (l) { var x = allergenWord(l); if (w.indexOf(x) < 0) w.push(x); });
    return w.length <= 1 ? (w[0] || '') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* ---------- N4Activity ---------- */
  var ACTIVE = [
    { v: 'sedentary', l: 'Mostly sitting', h: 'Desk work, driving, not much walking' },
    { v: 'light', l: 'On my feet a bit', h: 'Some walking through the day' },
    { v: 'moderate', l: 'On my feet a lot', h: 'Teaching, retail, hospitality' },
    { v: 'heavy', l: 'Physical work', h: 'Trades, warehouse, nursing' },
    { v: 'extreme', l: 'Hard physical work', h: 'Labouring all day, every day' },
  ];
  function rActive(el, my) {
    needAbout(el, my, function () {
      withData(el, my, function () { return Promise.all([loadIndex(), mealView('active')]); }, '', function () {
        qhead(el, stepLine('active', 'Activity'), 'How active are you<br>outside the gym?', 'Work, errands, getting around. Leave out your training. We count that separately.');
        cards(el, ACTIVE, S.about.activityLevel, function (v) { S.about.activityLevel = v; enable(true); });
        foodCta('Continue', !S.about.activityLevel);
      });
    });
  }
  /* ---------- N4bTraining (no workout plan, or the summary's Training row) ---------- */
  function rSessions(el, my) {
    needAbout(el, my, function () {
      withData(el, my, function () { return mealView('sessions'); }, '', function (v) {
        var tr = v.training, plan = tr.plan, a = S.about;
        qhead(el, stepLine('sessions', 'Training'), 'Are you training<br>right now?', 'Lifting, classes or sport. Your calories count the time you train each week, on top of your day-to-day activity.');
        // An earlier answer opens selected. From the summary's row the answer is saved there (trainingEdit).
        var key = S.edit ? 'trainingEdit' : 'trainingChoice';
        var shown = S.edit ? a.trainingEdit || a.trainingChoice : a.trainingChoice;
        if (shown == null) {
          if (typeof tr.knownMinutes === 'number') shown = tr.knownMinutes > 0 ? 'yes' : 'no';
          else if (typeof tr.knownSessions === 'number') shown = tr.knownSessions > 0 ? 'yes' : 'no';
        }
        var pick = shown || null;
        var opts = [
          { v: 'yes', l: 'Yes, most weeks', h: plan ? 'Your workout plan: ' + plan.label.toLowerCase() : 'We count about 3 hours a week until you build a workout plan' },
          { v: 'no', l: 'Not right now', h: 'No structured sessions' },
        ];
        cards(el, opts, pick, function (x) { pick = x; enable(true); });
        if (plan) el.insertAdjacentHTML('beforeend', '<p class="nfoot plnote">' + IC.bar + '<span>Worked out from your plan\'s sessions. It updates whenever your plan changes.</span></p>');
        // Saved on Continue / Save only, as handleNext writes it (Back leaves the answer as it was).
        primary(S.edit ? 'Save' : 'Continue', function () {
          a[key] = pick;
          if (S.edit) { S.edit = false; go('mealsummary'); return; }
          next();
        }, pick == null);
      });
    });
  }

  /* ---------- N5DietType, with the MacroDonut ---------- */
  var DIETS = [
    { v: 'balanced', t: 'Balanced', s: '20% protein · 50% carbs · 30% fat. A solid default.', split: [20, 50, 30], tail: ' A solid default.' },
    { v: 'high_protein', t: 'High protein', s: '30% protein · 40% carbs · 30% fat. Great for building.', split: [30, 40, 30], tail: ' Great for building.' },
    { v: 'low_carb', t: 'Low carb', s: '25% protein · 25% carbs · 50% fat.', split: [25, 25, 50], tail: '' },
    { v: 'keto', t: 'Keto', s: '20% protein · 5% carbs · 75% fat.', split: [20, 5, 75], tail: '' },
    { v: 'custom', t: 'Custom', s: 'Set your own protein / carb / fat split.' },
  ];
  var MACRO_COLOURS = ['var(--acc)', '#60a5fa', '#f59e0b'];
  function donut(split, proteinG, footer) {
    var r = 52, c = 2 * Math.PI * r, p = split && split[0] + split[1] + split[2] === 100 ? split : null, off = 0, arcs = '';
    (p || [0, 0, 0]).forEach(function (v, i) {
      var len = (v / 100) * c, a = Math.max(0, len - (v > 1 ? 3 : len));
      arcs += '<circle cx="66" cy="66" r="52" fill="none" stroke="' + MACRO_COLOURS[i] + '" stroke-width="18" stroke-dasharray="' + a.toFixed(1) + ' ' + c.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '"/>';
      off += len;
    });
    return '<div class="ficard"><div class="donut"><svg viewBox="0 0 132 132" width="132" height="132" style="transform:rotate(-90deg)"><circle cx="66" cy="66" r="52" fill="none" stroke="#1c1c20" stroke-width="18"/>' + arcs + '</svg><div class="legend">' +
      ['Protein', 'Carbs', 'Fat'].map(function (n, i) { return '<div class="lr"><i style="background:' + MACRO_COLOURS[i] + '"></i><span class="ln">' + n + '</span>' + (i === 0 && p && proteinG ? '<span class="lgg">' + proteinG + ' g</span>' : '') + '<b>' + (p ? p[i] + '%' : '–') + '</b></div>'; }).join('') +
      '</div></div>' + (footer ? '<div class="dfoot">' + footer + '</div>' : '') + '</div>';
  }
  function rDietType(el, my) {
    var f = S.food;
    withData(el, my, function () { return mealView('diettype'); }, '', function (v) {
      qhead(el, stepLine('diettype', 'How you eat'), 'How do you want to eat?', 'Sets how your calories split across protein, carbs, and fat.');
      var box = document.createElement('div'); box.className = 'rise'; box.style.setProperty('--i', 2); el.appendChild(box);
      var list = document.createElement('div'); list.className = 'opts'; el.appendChild(list);
      var custom = document.createElement('div'); el.appendChild(custom);
      var draw = function () {
        var pv = v.previews, sel = f.dietType, sp = sel ? pv[sel] : null;
        var cm = f.customMacros, cp = parseInt(cm.p, 10) || 0, cc = parseInt(cm.c, 10) || 0, cf = parseInt(cm.f, 10) || 0;
        var split = sp ? sp.pct : sel === 'custom' ? [cp, cc, cf] : sel ? DIETS.filter(function (d) { return d.v === sel; })[0].split : null;
        box.innerHTML = donut(split, sp ? sp.proteinG : null, v.floor ? '<span class="shield">' + CHECK + '</span><span>' + esc(v.floor.phrase) + ', protein stays at <b>' + v.floor.g + ' g or more</b>, whichever style you pick.</span>' : '');
        list.innerHTML = DIETS.map(function (d) {
          var p = pv[d.v], s = esc(d.s);
          if (p && p.raised && d.split) s = '<s>' + d.split[0] + '%</s> <b class="accb">' + p.pct[0] + '% protein</b> · ' + p.pct[1] + '% carbs · ' + p.pct[2] + '% fat.' + esc(d.tail);
          return '<button type="button" class="opt" data-v="' + d.v + '" aria-pressed="' + (sel === d.v) + '"><b>' + d.t + '</b><small>' + s + '</small></button>';
        }).join('');
        $$('.opt', list).forEach(function (b) { b.onclick = function () { f.dietType = b.getAttribute('data-v'); draw(); }; });
        var total = cp + cc + cf;
        custom.innerHTML = sel === 'custom' ? '<div class="custom"><div class="ch"><b>Your split</b><span style="color:' + (total === 100 ? 'var(--acc)' : '#ef4444') + '">' + total + '% / 100%</span></div>' +
          [['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat']].map(function (r) { return '<label class="cmrow"><span>' + r[1] + '</span><span class="cin"><input inputmode="numeric" maxlength="3" placeholder="0" data-k="' + r[0] + '" value="' + esc(cm[r[0]]) + '" aria-label="' + r[1] + ' percent"><i>%</i></span></label>'; }).join('') + '</div>' : '';
        $$('input', custom).forEach(function (inp) {
          inp.oninput = function () {
            cm[inp.getAttribute('data-k')] = inp.value.replace(/[^0-9]/g, '').slice(0, 3);
            var t = (parseInt(cm.p, 10) || 0) + (parseInt(cm.c, 10) || 0) + (parseInt(cm.f, 10) || 0);
            $('.ch span', custom).textContent = t + '% / 100%'; $('.ch span', custom).style.color = t === 100 ? 'var(--acc)' : '#ef4444';
            clearTimeout(inp._t);
            inp._t = setTimeout(function () { mealView('diettype').then(function (nv) { if (my !== token) return; v = nv; var pv2 = nv.previews.custom; var cpv = [parseInt(cm.p, 10) || 0, parseInt(cm.c, 10) || 0, parseInt(cm.f, 10) || 0]; box.innerHTML = donut(pv2 ? pv2.pct : cpv, pv2 ? pv2.proteinG : null, v.floor ? '<span class="shield">' + CHECK + '</span><span>' + esc(v.floor.phrase) + ', protein stays at <b>' + v.floor.g + ' g or more</b>, whichever style you pick.</span>' : ''); valid(); }); }, 160);
            valid();
          };
        });
        valid();
      };
      var valid = function () {
        var cm = f.customMacros, ok = f.dietType != null;
        if (f.dietType === 'custom') ok = [cm.p, cm.c, cm.f].every(function (x) { return /^\d+$/.test(x); }) && (+cm.p + +cm.c + +cm.f) === 100;
        foodCta('Continue', !ok);
      };
      draw();
    });
  }

  /* ---------- N5aDietPattern ---------- */
  function rMeat(el, my) {
    withData(el, my, needCopy, '', function (c) {
      qhead(el, stepLine('meat', 'Diet'), 'Do you eat meat?', 'We only show you meals that fit.');
      cards(el, c.dietPatterns.map(function (p) { return { v: p.value, l: p.label, h: p.hint }; }), S.food.dietPattern, function (v) { S.food.dietPattern = v; enable(true); });
      foodCta('Continue', !S.food.dietPattern);
    });
  }

  /* ---------- N5bAllergies ---------- */
  var ALLERGENS = ['Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Gluten/Wheat', 'Soy', 'Fish', 'Sesame'];
  var LABEL_REMINDER = 'Check the labels. Products change, so always check ingredients for your allergies.';
  function rAllergies(el) {
    var f = S.food;
    qhead(el, stepLine('allergies', 'Allergies'), 'Any allergies?', 'Meals with these are left out of your plan. Always check ingredient labels yourself. Skip if none apply.');
    el.insertAdjacentHTML('beforeend', '<div class="chipwrap rise" style="--i:2" id="alChips"></div>' +
      '<div class="addf rise" style="--i:3"><input type="text" id="alIn" placeholder="Add another allergy" maxlength="40" autocomplete="off" aria-label="Add another allergy"><button type="button" id="alAdd" aria-label="Add">' + PLUS + '</button></div>' +
      '<p class="remind" id="alRem"><span>' + INFO + '</span>' + LABEL_REMINDER + '</p>');
    var draw = function () {
      var custom = f.allergies.filter(function (a) { return ALLERGENS.indexOf(a) < 0; });
      $('#alChips', el).innerHTML = ALLERGENS.map(function (a) { return '<button type="button" class="fchip" data-a="' + esc(a) + '" aria-pressed="' + (f.allergies.indexOf(a) > -1) + '">' + esc(a) + '</button>'; }).join('') +
        custom.map(function (a) { return '<button type="button" class="fchip" data-a="' + esc(a) + '" aria-pressed="true">' + esc(a) + ' <i>' + XS + '</i></button>'; }).join('');
      $$('[data-a]', el).forEach(function (b) { b.onclick = function () { toggle(f.allergies, b.getAttribute('data-a')); draw(); }; });
      // LabelReminder: shown once anything is ticked; its line is reserved so nothing below jumps.
      $('#alRem', el).style.visibility = f.allergies.length ? 'visible' : 'hidden';
      foodCta(f.allergies.length ? 'Continue' : 'None of these');
    };
    var inp = $('#alIn', el), add = $('#alAdd', el);
    var typed = function () { var t = inp.value.trim().length > 0; add.classList.toggle('on', t); inp.parentNode.classList.toggle('on', t); };
    var submit = function () {
      var v = inp.value.trim(); if (!v) return;
      if (!f.allergies.some(function (x) { return x.toLowerCase() === v.toLowerCase(); })) f.allergies.push(v);
      inp.value = ''; typed(); draw();
    };
    inp.oninput = typed;
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    add.onclick = submit;
    typed(); draw();
  }

  /* ---------- N5dSkipFoods ---------- */
  function rSkip(el, my) {
    var f = S.food, q = '';
    withData(el, my, needCatalogue, '', function (cat) {
      qhead(el, stepLine('skip', 'Foods you skip', true), 'Anything you<br>won’t eat?', 'Those meals still show, just lower down and marked. Allergies are the step before.');
      el.insertAdjacentHTML('beforeend', '<div class="search rise" style="--i:3"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="#71717a" stroke-width="2"/><path d="M16 16l4 4" stroke="#71717a" stroke-width="2" stroke-linecap="round"/></svg><input type="text" id="skQ" placeholder="Search any food, like cinnamon" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Search foods"><button type="button" id="skX" aria-label="Clear search" hidden>' + XS + '</button></div><div id="skBody"></div>');
      var body = $('#skBody', el), inp = $('#skQ', el), clr = $('#skX', el), results = [], seq2 = 0;
      var row = function (r, last) {
        var got = f.skip.indexOf(r.id) > -1, nm = esc(r.name);
        if (q) { var i = r.name.toLowerCase().indexOf(q.trim().toLowerCase()); if (i > -1) nm = esc(r.name.slice(0, i)) + '<b>' + esc(r.name.slice(i, i + q.trim().length)) + '</b>' + esc(r.name.slice(i + q.trim().length)); }
        return '<button type="button" class="frow' + (last ? ' last' : '') + (got ? ' got' : '') + '" data-id="' + esc(r.id) + '" aria-pressed="' + got + '"><span class="ft"><span class="fn">' + nm + '</span>' + (r.alias ? '<small>' + esc(String(r.alias).replace(/\s*\([^)]*\)\s*/g, ' ').trim().toLowerCase()) + '</small>' : '') + '</span><span class="fc">in ' + plural(r.meals, 'meal') + '</span><span class="fp">' + (got ? CHECK : PLUS) + '</span></button>';
      };
      var draw = function () {
        var typing = q.trim().length > 0, h = '';
        if (typing) h += '<div class="results">' + (results.length ? results.map(function (r, i) { return row(r, i === results.length - 1); }).join('') : '<p class="nores">No meals use “' + esc(q.trim()) + '”, so there’s nothing to skip.</p>') + '</div>';
        if (f.skip.length) h += '<div class="chipwrap">' + f.skip.map(function (id) { return '<button type="button" class="fchip on" data-rm="' + esc(id) + '" aria-label="' + esc(cat.names[id] || id) + ', skipped. Tap to remove">' + esc(cat.names[id] || id) + ' <i>' + XS + '</i></button>'; }).join('') + '</div>';
        var pop = cat.popular.filter(function (x) { return f.skip.indexOf(x.id) < 0; });
        if (pop.length) h += '<p class="ovs">Common ones</p><div class="chipwrap">' + pop.map(function (x) { return '<button type="button" class="fchip" data-tg="' + esc(x.id) + '">' + esc(x.name) + '</button>'; }).join('') + '</div>';
        if (!typing) {
          var groups = cat.groups.filter(function (g) { return f.skip.indexOf(g.id) < 0; });
          if (groups.length) h += '<p class="ovs">Whole groups</p><div class="chipwrap">' + groups.map(function (g) { return '<button type="button" class="fchip" data-tg="' + esc(g.id) + '">' + esc(g.name) + '</button>'; }).join('') + '</div>';
          h += '<p class="ovs">Every food in JSON.fit · ' + cat.count + '</p><div class="alist">' + cat.sections.map(function (s) { return '<p class="letter">' + s.letter + '</p>' + s.items.map(function (r, i) { return row(r, i === s.items.length - 1); }).join(''); }).join('') + '</div>';
        }
        body.innerHTML = h;
        $$('.frow', body).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-id'); if (typing && f.skip.indexOf(id) < 0) { f.skip.push(id); q = ''; inp.value = ''; clr.hidden = true; } else toggle(f.skip, id); draw(); }; });
        $$('[data-rm]', body).forEach(function (b) { b.onclick = function () { toggle(f.skip, b.getAttribute('data-rm')); draw(); }; });
        $$('[data-tg]', body).forEach(function (b) { b.onclick = function () { toggle(f.skip, b.getAttribute('data-tg')); draw(); }; });
        foodCta(f.skip.length ? 'Continue' : 'Nothing to skip');
        impact();
      };
      var impact = function () {
        if (!f.skip.length) { ctaNote('<p class="impact">Nothing skipped yet. Fine to leave it that way.</p>'); return; }
        var k = f.skip.join('|');
        call('skipImpact', f.skip.slice()).then(function (m) {
          if (my !== token || f.skip.join('|') !== k || !m) return;
          ctaNote('<p class="impact"><b>' + plural(m.lower, 'meal') + '</b> move' + (m.lower === 1 ? 's' : '') + ' lower' + (m.kept ? ', and <b>' + m.kept + '</b>' + (m.kept === 1 ? ' keeps its place without it.' : ' keep their place without it.') : '.') + '</p>');
        });
      };
      inp.oninput = function () {
        q = inp.value; clr.hidden = !q.trim();
        inp.parentNode.classList.toggle('on', !!q.trim());
        var my2 = ++seq2;
        if (!q.trim()) { results = []; draw(); return; }
        call('foodSearch', q).then(function (r) { if (my2 !== seq2 || my !== token) return; results = r; draw(); inp.focus(); });
      };
      inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); if (results[0] && f.skip.indexOf(results[0].id) < 0) { f.skip.push(results[0].id); q = ''; inp.value = ''; clr.hidden = true; draw(); } else inp.blur(); } };
      clr.onclick = function () { q = ''; inp.value = ''; clr.hidden = true; inp.parentNode.classList.remove('on'); results = []; draw(); inp.focus(); };
      draw();
    });
  }

  /* ---------- N5eKeepLower ---------- */
  function rKeepLower(el, my) {
    var f = S.food, help = false;
    withData(el, my, needCopy, '', function (c) {
      qhead(el, stepLine('keeplower', 'Keep lower'), 'Anything to keep lower?', 'Optional. Tick any that apply.');
      var box = document.createElement('div'); el.appendChild(box);
      var draw = function () {
        var picked = f.keepLower;
        box.innerHTML = '<div class="opts">' + c.keepLower.map(function (o) { return '<button type="button" class="opt multi" data-k="' + o.value + '" aria-pressed="' + !!(picked && picked.indexOf(o.value) > -1) + '"><b>' + esc(o.label) + '</b><small>' + esc(o.hint) + '</small></button>'; }).join('') +
          '<button type="button" class="opt" data-k="none" aria-pressed="' + !!(picked && !picked.length) + '"><b>Nothing</b></button></div>' +
          '<p class="nfoot">Follow your doctor\'s advice if you have a condition.</p><button type="button" class="linkb small" id="klHelp">How this works</button>' +
          (help ? c.keepLowerHelp.map(function (l) { return '<p class="nfoot">' + esc(l) + '</p>'; }).join('') : '');
        $$('[data-k]', box).forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-k');
            if (k === 'none') f.keepLower = [];
            else { var l = (f.keepLower || []).slice(); toggle(l, k); f.keepLower = l; }
            draw();
          };
        });
        $('#klHelp', box).onclick = function () { help = !help; draw(); };
        foodCta(f.keepLower == null ? 'Skip' : 'Continue');
      };
      draw();
    });
  }

  /* ---------- N5cSleep ---------- */
  var STRICT = [
    { v: 'minimal', t: 'Performance', d: 'Light meals up to 1 h before bed' },
    { v: 'moderate', t: 'Balanced', d: 'Larger meals 2 h before bed' },
    { v: 'maximum', t: 'Sleep-first', d: 'All food 3 h before bed' },
  ];
  var CUTOFF = { minimal: [1, 'Light meals'], moderate: [2, 'Larger meals'], maximum: [3, 'All food'] };
  var MEAL_TIMES_GUIDE = 'These times are a guide, not rules. Eat when it suits you. What matters most is getting the whole day’s food in.';
  function clockUpper(m) { var d = ((m % 1440) + 1440) % 1440, h = Math.floor(d / 60); return (h % 12 || 12) + ':' + String(d % 60).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
  function clockLower(m) { return clockUpper(m).replace('AM', 'am').replace('PM', 'pm'); }
  function dur(min) { var h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? ' ' + m + 'm' : ''); }
  function parseClock(s) { var m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i); if (!m) return null; var h = +m[1]; if (m[3] && m[3].toLowerCase() === 'pm' && h < 12) h += 12; if (m[3] && m[3].toLowerCase() === 'am' && h === 12) h = 0; return h * 60 + +m[2]; }
  function rSleep(el, my) {
    var f = S.food, sl = f.sleep, open = null, shape = null, BED_MIN = 1080, BED_MAX = 1620, WAKE_MIN = 180, WAKE_MAX = 720;
    withData(el, my, function () { return mealView('sleep'); }, '', function (v) {
      shape = v.shape;
      qhead(el, stepLine('sleep', 'Sleep'), 'When do you sleep?', 'Your meals are timed around it, and the big ones finish before bed.');
      el.insertAdjacentHTML('beforeend', '<div class="tpair rise" style="--i:2"></div><div class="barcard rise" style="--i:3"></div>' +
        '<div class="rise" style="--i:4"><p class="flbl">Meal timing</p><div class="seg"></div></div>' +
        '<div class="rise" style="--i:5"><p class="ov" style="margin-top:26px">Your day</p><p class="dtitle">Your meal times</p><p class="dsub">Worked out from these times. Tap one to move it.</p><div class="mtl"></div><p class="guide">' + MEAL_TIMES_GUIDE + '</p></div>');
      var len = function () { return sl.wake + 1440 - sl.bed; };
      var canBed = function (d) { var n = sl.bed + d, l = sl.wake + 1440 - n; return n >= BED_MIN && n <= BED_MAX && l >= 240 && l <= 840; };
      var canWake = function (d) { var n = sl.wake + d, l = n + 1440 - sl.bed; return n >= WAKE_MIN && n <= WAKE_MAX && l >= 240 && l <= 840; };
      var touch = function () { sl.touched = true; sl.skipped = false; };
      var pct = function (a) { return Math.min(100, Math.max(0, ((a - 1080) / 1080) * 100)) + '%'; };
      var drawTimes = function () {
        var card = function (lbl, val, can, k, name) {
          return '<div class="tcard"><p class="tl">' + lbl + '</p><p class="tv">' + clockLower(val) + '</p><div class="tst">' +
            '<button type="button" data-t="' + k + '" data-d="-15"' + (can(-15) ? '' : ' disabled') + ' aria-label="' + name + ' 15 minutes earlier">' + MINUS + '</button>' +
            '<button type="button" data-t="' + k + '" data-d="15"' + (can(15) ? '' : ' disabled') + ' aria-label="' + name + ' 15 minutes later">' + PLUS + '</button></div></div>';
        };
        $('.tpair', el).innerHTML = card('BED', sl.bed, canBed, 'bed', 'Bedtime') + card('UP', sl.wake, canWake, 'wake', 'Wake time');
        $$('[data-t]', el).forEach(function (b) {
          b.onclick = function () {
            var d = +b.getAttribute('data-d');
            if (b.getAttribute('data-t') === 'bed') { if (!canBed(d)) return; sl.bed += d; } else { if (!canWake(d)) return; sl.wake += d; }
            touch(); drawAll();
          };
        });
        var c = CUTOFF[sl.strictness], cutAt = sl.bed - c[0] * 60;
        $('.barcard', el).innerHTML = '<p class="bh"><b>' + dur(len()) + '</b><span>of sleep</span></p><div class="track2"><i class="span" style="left:' + pct(sl.bed) + ';width:' + (len() / 1080 * 100) + '%"></i><i class="mark" style="left:' + pct(cutAt) + '"></i></div>' +
          '<div class="tk"><span>6P</span><span>12A</span><span>6A</span><span>12P</span></div><p class="lg2"><i></i>' + c[1] + ' done by <b>' + clockLower(cutAt) + '</b></p>';
        $('.seg', el).innerHTML = STRICT.map(function (o) { return '<button type="button" data-s="' + o.v + '" aria-pressed="' + (sl.strictness === o.v) + '"><b>' + o.t + '</b><small>' + o.d + '</small></button>'; }).join('');
        $$('[data-s]', el).forEach(function (b) { b.onclick = function () { sl.strictness = b.getAttribute('data-s'); touch(); drawAll(); }; });
      };
      var drawList = function () {
        var sleepLike = { bedtime: clockUpper(sl.bed), wakeTime: clockUpper(sl.wake), optimizationLevel: sl.strictness };
        call('dayTimes', sleepLike, shape, sl.overrides).then(function (d) {
          if (my !== token) return;
          var axis = function (m) { return m < d.wake ? m + 1440 : m; };
          var can = function (m, x) { var a = axis(m) + x; return a >= d.wake && a <= d.bed; };
          $('.mtl', el).innerHTML = d.rows.map(function (r, i) {
            var isOpen = open === r.slot;
            var sub = r.slot === 'dessert' && d.dessertDinner != null ? '<small>Dinner moves to ' + clockLower(d.dessertDinner) + ' that night</small>' : r.overridden ? '<small class="acc">Your time</small>' : '';
            return '<div class="mtrow' + (i ? ' sep' : '') + '"><button type="button" class="mtap" data-slot="' + r.slot + '" aria-expanded="' + isOpen + '" aria-label="' + esc(r.label) + ' at ' + clockLower(r.minute) + '. Change"><span class="ms"><b>' + esc(r.label) + '</b>' + sub + '</span><span class="mt' + (isOpen ? ' acc' : '') + '">' + clockLower(r.minute) + '</span>' + (isOpen ? CHEV : CHEVR) + '</button>' +
              (isOpen ? '<div class="med"><button type="button" data-m="-15"' + (can(r.minute, -15) ? '' : ' disabled') + ' aria-label="' + esc(r.label) + ' 15 minutes earlier">' + MINUS + '</button><div class="mmid"><b>' + clockLower(r.minute) + '</b>' +
                (r.overridden ? '<button type="button" class="reset" data-reset="1">Use suggested (' + clockLower(r.baseMinute) + ')</button>' : '<small>15 minutes a tap</small>') + '</div><button type="button" data-m="15"' + (can(r.minute, 15) ? '' : ' disabled') + ' aria-label="' + esc(r.label) + ' 15 minutes later">' + PLUS + '</button></div>' : '') + '</div>';
          }).join('');
          $$('.mtap', el).forEach(function (b) { b.onclick = function () { var s = b.getAttribute('data-slot'); open = open === s ? null : s; drawList(); }; });
          var row = d.rows.filter(function (r) { return r.slot === open; })[0];
          $$('[data-m]', el).forEach(function (b) {
            b.onclick = function () {
              var x = +b.getAttribute('data-m'); if (!row || !can(row.minute, x)) return;
              var nx = (((row.minute + x) % 1440) + 1440) % 1440;
              if (nx === row.baseMinute) delete sl.overrides[row.slot]; else sl.overrides[row.slot] = clockUpper(nx);
              touch(); drawList(); setCta();
            };
          });
          $$('[data-reset]', el).forEach(function (b) { b.onclick = function () { delete sl.overrides[row.slot]; touch(); drawList(); }; });
        });
      };
      var setCta = function () {
        foodCta('Continue', false, function () { sl.skipped = false; next(); });
        // Skip: the quiet action under the pill, before anything is touched.
        ctaNote(!S.edit && !sl.touched ? '<button type="button" class="skipb" id="slSkip">Skip</button>' : '');
        var sk = document.getElementById('slSkip'); if (sk) sk.onclick = function () { sl.skipped = true; sl.overrides = {}; next(); };
      };
      var drawAll = function () { drawTimes(); drawList(); setCta(); };
      drawAll();
    });
  }

  /* ---------- N6MealsSnacking, with DayShape ---------- */
  var MEAL_HINTS = { 2: 'Two bigger meals. Fewer dishes, simpler prep.', 3: 'Classic: breakfast, lunch and dinner.', 4: 'Four solid meals. Good for higher intakes.', 5: 'Five smaller meals spread across the day.', 6: 'Frequent eating. Demands more prep.' };
  var SNACK_OPTS = [{ v: '0', l: 'None' }, { v: '1', l: '1 snack' }, { v: '2', l: '2 snacks' }, { v: '3+', l: '3+ snacks' }, { v: 'ai_decide', l: 'Let the plan decide' }];
  var SNACK_NOTE = "Snacks you'd like built in. We'll add a small top-up if needed, always removable.";
  var VARIETY = [
    { v: 'convenience', l: 'Cook once, repeat', h: 'Cook a few meals and repeat them through the week. Least effort, least shopping.' },
    { v: 'balanced', l: 'A bit of both', h: "Some repeats for easy prep, some variety so it doesn't get boring." },
    { v: 'variety', l: 'Keep it varied', h: 'Different meals through the week. More cooking and shopping.' },
  ];
  function toHours(t) { var m = String(t || '').match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return null; return (+m[1] % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0) + +m[2] / 60; }
  function fmtHours(h) { h = ((h % 24) + 24) % 24; var hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh = (hh + 1) % 24; mm = 0; } return (hh % 12 || 12) + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (hh >= 12 ? 'PM' : 'AM'); }
  function dayShape(wake, bed, meals, snackFreq) {
    var end = bed <= wake ? bed + 24 : bed, pos = function (h) { return (0.04 + ((h - wake) / (end - wake)) * 0.92) * 100; };
    var a = wake + 0.75, b = end - 2.5, n = meals || 0, times = [];
    for (var i = 0; i < n; i++) times.push(n === 1 ? (a + b) / 2 : a + (i * (b - a)) / (n - 1));
    var gaps = times.slice(0, -1).map(function (t, i) { return (t + times[i + 1]) / 2; });
    var sn = { '0': 0, '1': 1, '2': 2, '3+': 3, ai_decide: 2 }[snackFreq || ''] || 0, snacks = [];
    if (gaps.length) for (var k = 0; k < sn; k++) snacks.push(gaps[k % gaps.length] + Math.floor(k / gaps.length) * 0.6);
    var ai = snackFreq === 'ai_decide';
    return '<div class="ficard"><div class="fcap"><span>Your day</span><b>' + fmtHours(wake) + ' – ' + fmtHours(bed) + '</b></div><div class="dshape"><i class="rule"></i>' +
      times.map(function (t) { return '<i class="md" style="left:' + pos(t).toFixed(2) + '%"></i><span class="mtm" style="left:' + pos(t).toFixed(2) + '%">' + fmtHours(Math.round(t * 2) / 2).replace(':00', '') + '</span>'; }).join('') +
      snacks.map(function (t) { return '<i class="sndot' + (ai ? ' ai' : '') + '" style="left:' + pos(t).toFixed(2) + '%"></i>'; }).join('') + '</div></div>';
  }
  function rEat(el, my) {
    var f = S.food;
    withData(el, my, function () { return mealView('eat'); }, '', function (v) {
      var ss = v.savedSleep, wake = (ss && toHours(ss.wakeTime)) != null ? toHours(ss.wakeTime) : 7, bed = (ss && toHours(ss.bedtime)) != null ? toHours(ss.bedtime) : 23;
      qhead(el, stepLine('eat', 'Meals & snacks'), 'How do you like to eat?', "Sets the shape of your day. We'll handle hitting your targets.");
      el.insertAdjacentHTML('beforeend', '<div class="rise" style="--i:2" id="dsh"></div><p class="flbl">Meals per day</p><div class="mgrid"></div><div class="hint" id="mh"></div>' +
        '<p class="flbl" style="margin-top:28px">Snacks per day</p><div class="snk" id="sk"></div><div class="hint"><span>' + INFO + '</span>' + esc(SNACK_NOTE) + '</div>' +
        '<p class="flbl" style="margin-top:28px">Variety</p><div class="snk" id="vr"></div><div class="hint" id="vh"></div>');
      var draw = function () {
        $('#dsh', el).innerHTML = dayShape(wake, bed, f.mealsPerDay, f.snackFrequency);
        $('.mgrid', el).innerHTML = [2, 3, 4, 5, 6].map(function (n) { return '<button type="button" data-n="' + n + '" aria-pressed="' + (f.mealsPerDay === n) + '">' + n + '</button>'; }).join('');
        // The hint box keeps its place before a pick (no jump when it fills).
        $('#mh', el).innerHTML = '<span>' + INFO + '</span>' + esc(MEAL_HINTS[f.mealsPerDay] || MEAL_HINTS[3]);
        $('#mh', el).style.visibility = f.mealsPerDay ? 'visible' : 'hidden';
        $('#sk', el).innerHTML = SNACK_OPTS.map(function (o) { return '<button type="button" data-s="' + o.v + '" aria-pressed="' + (f.snackFrequency === o.v) + '">' + o.l + '</button>'; }).join('');
        $('#vr', el).innerHTML = VARIETY.map(function (o) { return '<button type="button" data-vr="' + o.v + '" aria-pressed="' + (f.mealVariety === o.v) + '">' + o.l + '</button>'; }).join('');
        $('#vh', el).innerHTML = '<span>' + INFO + '</span>' + esc(VARIETY.filter(function (o) { return o.v === f.mealVariety; })[0].h);
        $$('[data-n]', el).forEach(function (b) { b.onclick = function () { f.mealsPerDay = +b.getAttribute('data-n'); draw(); }; });
        $$('[data-s]', el).forEach(function (b) { b.onclick = function () { f.snackFrequency = b.getAttribute('data-s'); draw(); }; });
        $$('[data-vr]', el).forEach(function (b) { b.onclick = function () { f.mealVariety = b.getAttribute('data-vr'); draw(); }; });
        foodCta('Continue', !(f.mealsPerDay != null && f.snackFrequency != null));
      };
      draw();
    });
  }

  /* ---------- N6gSnacks: SnackChecklist ---------- */
  function whySheet(why) {
    openSheet('<h2 class="sh-t">Why ' + why.n + '?</h2><p class="sh-b">' + esc(why.lead) + '</p>' +
      why.rows.map(function (r) { return '<div class="whyrow"><b>' + esc(r.title) + '</b><span>' + esc(r.text) + '</span></div>'; }).join('') +
      '<p class="sh-lede" style="margin-top:14px">' + esc(why.foot) + '</p><button type="button" class="sh-go" data-close="1">Got it</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
  }
  function pickCountLine(count, rec, what) {
    if (count === rec) return null;
    if (count < rec) return what === 'mains' ? 'Fewer picks means meals repeat more.' : what === 'snacks' ? 'Fewer picks means the same snacks repeat more.' : 'Fewer picks means the same breakfast most days.';
    return what === 'mains' ? 'More picks is fine. Each one comes round less often.' : 'More picks is fine. Each one shows up less often.';
  }
  function addOwnSheet(onSave) {
    var kinds = [['snack', 'Snack'], ['breakfast', 'Breakfast'], ['drink', 'Drink']], kind = 'snack', two = false;
    var field = function (k, label, ph, num, half) { return '<label class="af' + (half ? ' half' : '') + '"><span>' + label + '</span><input data-f="' + k + '" placeholder="' + esc(ph) + '"' + (num ? ' inputmode="decimal"' : '') + ' maxlength="60" autocomplete="off"></label>'; };
    openSheet('<h2 class="sh-t">Add your own</h2><p class="sh-lede">One serve, numbers from the pack.</p>' +
      field('name', 'Name', 'Chobani yoghurt pot') + field('serve', 'Serve', '1 pot, 170 g') +
      '<div class="af2">' + field('kcal', 'kcal', '120', true, true) + field('protein', 'Protein (g)', '15', true, true) + '</div>' +
      '<div class="af2">' + field('carbs', 'Carbs (g), optional', '', true, true) + field('fat', 'Fat (g), optional', '', true, true) + '</div>' +
      '<div class="kinds">' + kinds.map(function (k) { return '<button type="button" data-kd="' + k[0] + '" aria-pressed="' + (k[0] === kind) + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      '<label class="swr" id="afTwo"><span>I sometimes have 2</span><input type="checkbox"></label>' + field('shop', 'Shopping list line, optional', 'Yoghurt pots, 4-pack') +
      '<p class="aferr" id="afErr"></p><button type="button" class="sh-go" id="afSave">Add to My foods</button>', function (sh) {
      var num = function (k) { var s = $('[data-f="' + k + '"]', sh).value, n = Number(String(s).replace(',', '.').trim()); return s.trim() !== '' && isFinite(n) && n >= 0 ? n : undefined; };
      $$('[data-kd]', sh).forEach(function (b) { b.onclick = function () { kind = b.getAttribute('data-kd'); $$('[data-kd]', sh).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); $('#afTwo', sh).style.display = kind === 'breakfast' ? 'none' : ''; }; });
      $('#afSave', sh).onclick = function () {
        var name = $('[data-f="name"]', sh).value.trim(), k = num('kcal'), p = num('protein');
        var missing = !name ? 'Add a name.' : k == null ? 'Add the kcal per serve.' : p == null ? 'Add the protein per serve (0 is fine).' : null;
        if (missing) { $('#afErr', sh).textContent = missing; return; }
        two = $('#afTwo input', sh).checked;
        onSave({ name: name, serve: $('[data-f="serve"]', sh).value.trim() || undefined, kcal: k, protein: p, carbs: num('carbs'), fat: num('fat'), kind: kind, canDouble: kind !== 'breakfast' && two, shoppingLine: $('[data-f="shop"]', sh).value.trim() || undefined });
        closeSheet();
      };
    });
  }
  function rSnacks(el, my) {
    var f = S.food;
    withData(el, my, function () { return mealView('snacks'); }, '', function (v) {
      var sv = v.snacks;
      if (f.snacks.ticked == null) f.snacks.ticked = sv.initial.slice();
      el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">' + esc(stepLine('snacks', 'Snacks')) + '</p><h1 class="qh rise" style="--i:0">Snacks you already eat</h1>' +
        '<p class="sub rise" style="--i:1">We recommend ' + sv.recommended + ' for the best results.</p><button type="button" class="linkb small whyl rise" style="--i:1" id="snWhy">Why ' + sv.recommended + '? ›</button><div id="snList"></div>');
      $('#snWhy', el).onclick = function () { whySheet(sv.why); };
      var box = $('#snList', el);
      var draw = function () {
        var t = f.snacks.ticked, own = f.snacks.own.filter(function (o) { return o.kind !== 'breakfast'; });
        box.innerHTML = sv.groups.map(function (g) {
          return '<div class="sgroup"><p class="sgt">' + esc(g.label) + '</p>' + g.items.map(function (s) {
            var on = t.indexOf(s.id) > -1;
            return '<button type="button" class="srow" data-sn="' + s.id + '" role="checkbox" aria-checked="' + on + '"><span class="st2"><b>' + esc(s.name) + '</b><small>' + esc(s.serve) + ' · ' + Math.round(s.kcal) + ' kcal · ' + Math.round(s.protein) + ' g protein' + (s.canDouble ? ' · 2 at once is fine' : '') + (s.needsPrep ? ' · needs prep' : '') + '</small>' + (s.clash ? '<em>Contains ' + esc(s.allergens.join(', ')) + '</em>' : '') + '</span><span class="sring">' + (on ? CHECK : '') + '</span></button>';
          }).join('') + '</div>';
        }).join('') +
          (own.length ? '<div class="sgroup"><p class="sgt">Your own</p>' + own.map(function (o) { return '<div class="srow"><span class="st2"><b>' + esc(o.name) + '</b><small>' + esc(o.serve || '1 serve') + ' · ' + Math.round(o.kcal) + ' kcal · ' + Math.round(o.protein) + ' g protein</small></span><span class="sring on">' + CHECK + '</span></div>'; }).join('') + '</div>' : '') +
          '<button type="button" class="addown" id="snAdd">' + PLUS + ' Add your own</button>';
        $$('[data-sn]', box).forEach(function (b) { b.onclick = function () { toggle(f.snacks.ticked, b.getAttribute('data-sn')); draw(); }; });
        $('#snAdd', box).onclick = function () { addOwnSheet(function (input) { f.snacks.own.push(input); draw(); }); };
        var count = t.length + own.length, line = pickCountLine(count, sv.recommended, 'snacks');
        ctaNote('<p class="gentle"' + (line ? '' : ' style="visibility:hidden"') + '>' + esc(line || '.') + '</p>');
        foodCta('Continue · ' + count + ' of ' + sv.recommended);
      };
      draw();
    });
  }

  /* ---------- N6eAppetite ---------- */
  function rAppetite(el) {
    qhead(el, stepLine('appetite', 'Eating enough'), 'Is eating enough hard for you?', "Gaining takes a lot of food. Tell us if that's a struggle.");
    cards(el, [{ v: 'yes', l: 'Yes', h: "Most days it's hard to finish what you need. We lean on denser food." }, { v: 'no', l: 'No', h: 'Big plates are fine.' }],
      S.food.lowAppetite == null ? null : S.food.lowAppetite ? 'yes' : 'no', function (v) { S.food.lowAppetite = v === 'yes'; enable(true); });
    foodCta('Continue', S.food.lowAppetite == null);
  }

  /* ---------- N6aDessert, with DessertNights ---------- */
  var DESSERT = [
    { v: '0', l: 'No desserts', h: 'Skip desserts entirely. Clean bulk territory.' },
    { v: 'once_per_week', l: 'Once a week', h: 'One night per week. An occasional treat.' },
    { v: 'few_per_week', l: 'A few nights a week', h: '2 or 3 nights. A treat, not an expectation.' },
    { v: 'most_nights', l: 'Most nights', h: '4 to 6 nights a week.' },
    { v: 'every_night', l: 'Every night', h: 'A nightly treat after dinner.' },
    { v: 'ai_decide', l: 'Let the plan decide', h: "We'll fit them in where they make sense." },
  ];
  var SPREAD = { '0': [], once_per_week: [6], few_per_week: [2, 4, 6], most_nights: [1, 2, 4, 5, 6], every_night: [0, 1, 2, 3, 4, 5, 6] };
  var MON_FIRST = [1, 2, 3, 4, 5, 6, 0], DSHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], DLET = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], NIGHT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function freqForCount(n) { return n <= 0 ? '0' : n === 1 ? 'once_per_week' : n <= 3 ? 'few_per_week' : n <= 6 ? 'most_nights' : 'every_night'; }
  function cleanDays(d) { var o = []; d.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o.sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); }); }
  function rDessert(el) {
    var f = S.food;
    if (!f.dessertDays.length && f.dessertFrequency) f.dessertDays = (SPREAD[f.dessertFrequency] || []).slice();
    qhead(el, stepLine('dessert', 'Dessert'), 'Want dessert in your plan?', 'A small treat on top of your meals: protein ice cream, mug cakes. Tap the nights you want it, or pick how often.');
    el.insertAdjacentHTML('beforeend', '<div class="rise" style="--i:2" id="dn"></div><div id="dopts"></div>');
    var draw = function () {
      var sel = f.dessertFrequency, ai = sel === 'ai_decide', nights = sel && !ai && sel !== '0' ? f.dessertDays : [];
      var shown = sel ? nights : null;
      var cap = ai ? 'The plan picks the nights. Tap one to choose yourself.' : shown == null ? 'Tap your nights, or pick how often below' : !shown.length ? 'No dessert nights' : shown.length === 7 ? 'Every night' : shown.length + ' night' + (shown.length === 1 ? '' : 's') + ' · ' + MON_FIRST.filter(function (d) { return shown.indexOf(d) > -1; }).map(function (d) { return NIGHT[d]; }).join(', ');
      $('#dn', el).innerHTML = '<div class="ficard"><div class="wrow">' + MON_FIRST.map(function (d) {
        var lit = !ai && (shown || []).indexOf(d) > -1, maybe = ai && (d === 3 || d === 6);
        return '<button type="button" class="dnc" data-dow="' + d + '" aria-pressed="' + lit + '" aria-label="' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d] + ', ' + (lit ? 'dessert' : 'no dessert') + '"><small' + (lit ? ' class="acc"' : '') + '>' + DSHORT[d] + '</small><span class="night' + (lit ? ' lit' : '') + (maybe ? ' maybe' : '') + '">' + (lit ? CHECK : maybe ? '?' : DLET[d]) + '</span></button>';
      }).join('') + '</div><p class="idisc">' + cap + '</p></div>';
      $('#dopts', el).innerHTML = '<div class="opts">' + DESSERT.map(function (o) { return '<button type="button" class="opt" data-v="' + o.v + '" aria-pressed="' + (sel === o.v) + '"><b>' + esc(o.l) + '</b><small>' + esc(o.h) + '</small></button>'; }).join('') + '</div>';
      $$('[data-dow]', el).forEach(function (b) {
        b.onclick = function () {
          var dow = +b.getAttribute('data-dow'), base = f.dessertFrequency === 'ai_decide' ? [] : f.dessertDays.slice();
          var nx = cleanDays(base.indexOf(dow) > -1 ? base.filter(function (x) { return x !== dow; }) : base.concat([dow]));
          f.dessertDays = nx; f.dessertFrequency = freqForCount(nx.length); draw();
        };
      });
      $$('#dopts .opt', el).forEach(function (b) {
        b.onclick = function () {
          var val = b.getAttribute('data-v'), prev = f.dessertFrequency;
          f.dessertFrequency = val;
          if (!(val !== 'ai_decide' && freqForCount(f.dessertDays.length) === val && prev !== 'ai_decide')) f.dessertDays = (SPREAD[val] || []).slice();
          draw();
        };
      });
      foodCta('Continue', !f.dessertFrequency);
    };
    draw();
  }

  /* ---------- Meal prep: N6bSlowCooker, N6cFreezer, N6dShopCadence, N6fStockUp ---------- */
  function pillRow(title, opts, value, note, key) {
    return '<div class="pillblk"><p class="pilt">' + esc(title) + '</p><div class="pills">' + opts.map(function (o) { return '<button type="button" data-' + key + '="' + o.value + '" aria-pressed="' + (String(value) === String(o.value)) + '">' + esc(o.label) + '</button>'; }).join('') + '</div>' + (note ? '<p class="nfoot">' + esc(note) + '</p>' : '') + '</div>';
  }
  function rCooker(el, my) {
    var f = S.food;
    withData(el, my, function () { return Promise.all([needCopy(), mealView('cooker')]); }, '', function (r) {
      var c = r[0];
      qhead(el, prepLine('cooker', 'Slow cooker'), 'How big is your slow cooker?');
      var box = document.createElement('div'); el.appendChild(box);
      var draw = function () {
        box.innerHTML = '<div class="opts">' + c.cookers.map(function (o) { return '<button type="button" class="opt" data-sz="' + o.value + '" aria-pressed="' + (f.slowCooker === o.value) + '"><b>' + esc(o.label) + '</b><small>' + esc(o.hint) + '</small></button>'; }).join('') + '</div>' +
          // "How many?" only with a cooker; its room is kept so the blender row never jumps.
          '<div style="visibility:' + (f.slowCooker && f.slowCooker !== 'none' ? 'visible' : 'hidden') + '">' + pillRow('How many?', c.cookerCounts, f.slowCookerCount, c.cookerCountNote, 'ct') + '</div>' +
          pillRow(c.blender.title, c.blender.options, f.blender, c.blender.note, 'bl');
        $$('[data-sz]', box).forEach(function (b) { b.onclick = function () { f.slowCooker = b.getAttribute('data-sz'); draw(); }; });
        $$('[data-ct]', box).forEach(function (b) { b.onclick = function () { f.slowCookerCount = +b.getAttribute('data-ct'); draw(); }; });
        $$('[data-bl]', box).forEach(function (b) { b.onclick = function () { f.blender = b.getAttribute('data-bl'); draw(); }; });
        foodCta('Continue', !f.slowCooker);
      };
      draw();
    });
  }
  var FRIDGE_ICONS = {
    8: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 14h14M9 17h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    16: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 10h14M8 6v2M8 13v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    30: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 8h14M5 13.5h14M8 5v1.2M8 10.5v1.2M8 16v1.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    60: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="9" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M10 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  function rFreezer(el, my) {
    var f = S.food;
    withData(el, my, function () { return Promise.all([needCopy(), mealView('freezer')]); }, '', function (r) {
      var c = r[0];
      qhead(el, prepLine('freezer', 'Freezer'), 'How much freezer space do you have?');
      var box = document.createElement('div'); el.appendChild(box);
      var draw = function () {
        box.innerHTML = '<div class="opts">' + c.freezers.map(function (o) { return '<button type="button" class="opt iconopt" data-fz="' + o.value + '" aria-pressed="' + (f.freezerTubs === o.value) + '"><span class="itile">' + FRIDGE_ICONS[o.value] + '</span><span><b>' + esc(o.label) + '</b><small>' + esc(o.hint) + '</small></span></button>'; }).join('') + '</div>';
        $$('[data-fz]', box).forEach(function (b) { b.onclick = function () { f.freezerTubs = +b.getAttribute('data-fz'); draw(); }; });
        foodCta('Continue', !f.freezerTubs);
      };
      draw();
    });
  }
  function rCadence(el, my) {
    var f = S.food;
    withData(el, my, function () { return Promise.all([needCopy(), mealView('cadence')]); }, '', function (r) {
      var c = r[0], v = r[1];
      qhead(el, prepLine('cadence', 'How often you shop'), 'How often do you want to shop?');
      var box = document.createElement('div'); el.appendChild(box);
      var draw = function () {
        var picked = f.shopCadence && !v.blocked[f.shopCadence] ? f.shopCadence : null;
        box.innerHTML = '<div class="opts">' + c.cadences.map(function (o) { var why = v.blocked[o.value]; return '<button type="button" class="opt" data-cd="' + o.value + '" aria-pressed="' + (picked === o.value) + '"' + (why ? ' disabled' : '') + '><b>' + esc(o.label) + '</b><small>' + esc(why || o.hint) + '</small></button>'; }).join('') + '</div>';
        $$('[data-cd]', box).forEach(function (b) { b.onclick = function () { f.shopCadence = b.getAttribute('data-cd'); draw(); }; });
        foodCta(v.stockUpShows ? 'Continue' : 'Done', !picked, function () { if (!v.stockUpShows) f.stockUp = false; next(); });
      };
      draw();
    });
  }
  function rStockUp(el, my) {
    var f = S.food;
    withData(el, my, function () { return Promise.all([needCopy(), mealView('stockup')]); }, '', function (r) {
      var c = r[0], v = r[1];
      qhead(el, prepLine('stockup', 'Stock up'), esc(c.stockUp.title), esc(c.stockUp.intro));
      var box = document.createElement('div'); el.appendChild(box);
      var draw = function () {
        var value = v.stockUpCard ? f.stockUp : false;
        box.innerHTML = '<div class="opts">' + c.stockUp.options.filter(function (o) { return v.stockUpCard || !o.value; }).map(function (o) { return '<button type="button" class="opt" data-su="' + o.value + '" aria-pressed="' + (value === o.value) + '"><b>' + esc(o.label) + '</b><small>' + esc(o.value ? v.stockUpHint : o.hint) + '</small></button>'; }).join('') + '</div>' +
          (v.stockUpCard ? '<div class="sucard"><span>' + CHECK + '</span><div><b>' + esc(v.stockUpCard.title) + '</b><small>' + esc(v.stockUpCard.sub) + '</small></div></div>' : '<p class="nfoot">Your freezer is too small to stock up.</p>') +
          '<p class="nfoot">' + esc(c.stockUp.foot) + '</p>';
        $$('[data-su]', box).forEach(function (b) { b.onclick = function () { f.stockUp = b.getAttribute('data-su') === 'true'; draw(); }; });
        foodCta('Done', value == null);
      };
      draw();
    });
  }

  /* ---------- N9PlanLength, with PlanDates ---------- */
  var MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function midnight(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function startOffset(v) { if (v === 'today') return 0; if (v === 'tomorrow') return 1; if (/^\d{4}-\d{2}-\d{2}$/.test(v || '')) { var p = v.split('-'); return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - midnight(new Date())) / 864e5); } return null; }
  function startValue(off) { return off <= 0 ? 'today' : off === 1 ? 'tomorrow' : ymd(addDays(midnight(new Date()), off)); }
  function rangeText(start, days) {
    var end = addDays(start, Math.max(1, days) - 1), head = WD[start.getDay()] + ' ' + start.getDate(), tail = WD[end.getDay()] + ' ' + end.getDate() + ' ' + MONS[end.getMonth()];
    return start.getMonth() === end.getMonth() ? head + ' → ' + tail : head + ' ' + MONS[start.getMonth()] + ' → ' + tail;
  }
  function rPlanLength(el, my) {
    var f = S.food;
    var off0 = startOffset(f.startDate); if (!(off0 != null && off0 >= 0 && off0 <= 6)) f.startDate = 'tomorrow';
    withData(el, my, function () { return mealView('planlength'); }, '', function (v) {
      qhead(el, stepLine('planlength', 'Plan length'), 'How long a plan?', 'Sets the days your plan covers.');
      el.insertAdjacentHTML('beforeend', '<div class="fact rise" style="--i:2"><b>' + v.planDays.days + ' days</b><span>' + esc(v.planDays.line) + '</span></div><div class="rise" style="--i:3" id="pd"></div>');
      var draw = function () {
        var today = midnight(new Date()), off = startOffset(f.startDate), days = v.planDays.days;
        $('#pd', el).innerHTML = '<div class="ficard"><div class="fcap"><span>Start on</span><b>' + (off != null ? rangeText(addDays(today, off), days) : 'Pick a start day') + '</b></div><div class="wrow">' +
          [0, 1, 2, 3, 4, 5, 6].map(function (i) {
            var d = addDays(today, i), isStart = off === i, cov = off != null && i > off && i < off + days;
            return '<button type="button" class="sdt' + (isStart ? ' dstart' : cov ? ' cov' : '') + '" data-off="' + i + '" aria-pressed="' + isStart + '" aria-label="Start ' + (i === 0 ? 'today' : i === 1 ? 'tomorrow' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]) + ' ' + d.getDate() + '"><small>' + (i === 0 ? 'TODAY' : DSHORT[d.getDay()]) + '</small><b>' + d.getDate() + '</b></button>';
          }).join('') + '</div><p class="idisc">Today, tomorrow or any day this week. Tap to choose.</p></div>';
        $$('[data-off]', el).forEach(function (b) { b.onclick = function () { f.startDate = startValue(+b.getAttribute('data-off')); draw(); }; });
      };
      draw();
      foodCta('Continue', false, function () { go('picks'); });
    });
  }

  /* ================= build moments ================= */
  /**
   * The app's build screens: act 1 (ring draws, dots orbit, "Building your ...")
   * while the engine works, then act 2: a step list where each line runs and
   * ticks with the real number from the result, while the visual fills in.
   * No skip: watching each step land is what makes the plan feel worked out
   * (MealBuildScreen, 11 Oct 2026). Reduced motion: the finished list at once.
   */
  function buildMoment(el, my, o) {
    // o: word ('your week.'), sub, work (Promise -> data), steps(data) -> [{label,value,count?}], visual(data) -> html, onStep(i, data, el), done(data)
    el.classList.add('bm');
    el.innerHTML = (o.wall ? '<div class="wall" aria-hidden="true">' + (o.wall0 || []).map(function (f) { return '<span>' + photoFile(f, '') + '</span>'; }).join('') + '</div>' : '') + '<div class="act1"><div class="ring"><div class="glow"></div><svg viewBox="0 0 140 140"><circle class="r" cx="70" cy="70" r="60"/></svg><div class="orbit">' +
      [0, 1, 2, 3].map(function (k) { var ang = k * Math.PI / 2 - Math.PI / 2; return '<b style="left:' + (65 + Math.cos(ang) * 60) + 'px;top:' + (65 + Math.sin(ang) * 60) + 'px;animation-delay:' + (0.5 + k * 0.14) + 's"></b>'; }).join('') +
      '</div></div><p class="launch">Building<br><span>' + o.word + '</span></p><p class="sub" style="margin:8px auto 0;text-align:center">' + esc(o.sub || '') + '</p><div class="charge"><i></i></div></div><div class="act2" aria-live="polite"></div>';
    primary(null);
    var act1 = $('.act1', el), act2 = $('.act2', el);
    var finished = false, data = null;
    var instant = RM || root.classList.contains('still');
    var t0 = performance.now();
    function finish() {
      if (finished || my !== token) return; finished = true;
      if (holdBuild) return; // ?demo with a build screen asked for: stay on it for the screenshot
      setTimeout(function () { if (my === token) o.done(data); }, instant ? 0 : 450);
    }
    o.work().then(function (d) {
      data = d;
      if (my !== token) return;
      if (o.wall) { var wl = $('.wall', el); if (wl) wl.innerHTML = o.wall(d).concat(o.wall(d)).slice(0, 12).map(function (f) { return '<span>' + photoFile(f, '') + '</span>'; }).join(''); }
      var hold = instant ? 0 : Math.max(0, (o.hold || 1500) - (performance.now() - t0));
      return wait(hold).then(function () {
        if (my !== token) return;
        var steps = o.steps(d);
        act1.classList.add('gone'); el.classList.add('a2');
        setTimeout(function () { act1.style.display = 'none'; }, instant ? 0 : 420);
        act2.innerHTML = '<p class="ov">' + esc(o.over(d)) + '</p><p class="wt">Building <span>' + o.word + '</span></p><div class="vis">' + o.visual(d) + '</div><div class="steps">' +
          steps.map(function (s) { return '<div class="st' + (s.warn ? ' warn' : '') + '"><span class="dot"></span><span class="l">' + esc(s.label) + '</span><span class="v">' + esc(s.value) + '</span></div>'; }).join('') + '</div>';
        requestAnimationFrame(function () { act2.classList.add('on'); });
        var rows = $$('.st', act2);
        if (instant) {
          rows.forEach(function (r, i) { r.classList.add('ok'); o.onStep && o.onStep(i, d, act2, true); });
          if (RM && !root.classList.contains('still')) primary('Continue', function () { o.done(data); });
          else finish();
          return;
        }
        var i = 0, STEP = o.stepMs || 430;
        (function stepOn() {
          if (my !== token) return;
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
      '<div class="rise" style="--i:3">' + row('next', 2, 'Your training', 'Days, length, volume, extras', '~1 MIN', 'volume') + '</div>' +
      '<div class="rise" style="--i:4">' + row('todo', 3, 'Your meals', 'Diet, allergies, the meals you like', '~3 MIN', 'active') + '</div>' +
      '<div class="rise" style="--i:5">' + row('goal', 0, 'Day one: ' + day, 'Your first session and your first day of meals, ready to follow.', '') + '</div></div>' +
      '<p class="free rise" style="--i:6">Free to build. Nothing to pay at the end.</p><p class="later rise" style="--i:7"><button type="button" class="linkb small" data-to="keep">I’ll do this later</button></p>';
    requestAnimationFrame(function () { var f = $('.fbar i', el); if (f) f.style.transform = 'scaleX(.6)'; });
    $$('[data-to]', el).forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-to')); }; });
    // finishLineFor: training first, then meals.
    primary('Next: my training', function () { go('volume'); });
  }

  function toggle(arr, v) { var i = arr.indexOf(v); i > -1 ? arr.splice(i, 1) : arr.push(v); }
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

  /* ---------- CuratedFavorites: "Foods you like" ---------- */
  function tabRhythm(t, dessertFreq) {
    if (t.kind === 'core' && t.shelf === 'snacks') return 'mix';
    if (t.kind === 'core' && t.shelf === 'dessert') return dessertFreq === 'every_night' ? 'daily' : 'mix';
    if (t.kind === 'exotic' && /^(morning|afternoon|evening)_snack$/.test(t.slot)) return 'mix';
    return 'daily';
  }
  var WHEN_CORE = { breakfast: 'every morning', lunch: 'every lunchtime', dinner: 'every evening', snacks: 'your go-to snack', dessert: 'your dessert' };
  var WHEN_SLOT = { brunch: 'every late morning', second_lunch: 'every afternoon', early_dinner: 'every early evening', morning_snack: 'your morning snack', afternoon_snack: 'your afternoon snack', evening_snack: 'your evening snack', pre_workout: 'before every workout', post_workout: 'after every workout' };
  var NOUN = { breakfast: 'breakfasts', lunch: 'lunches', dinner: 'dinners', snacks: 'snacks', dessert: 'desserts' };
  function singularWhen(t) { return t.kind === 'core' ? WHEN_CORE[t.shelf] || 'every day' : WHEN_SLOT[t.slot] || 'every day'; }
  function tabNoun(t) { return t.kind === 'core' ? NOUN[t.shelf] : t.label.toLowerCase() + ' options'; }
  function isShelf(t, s) { return t.kind === 'core' && t.shelf === s; }
  /** CuratedFavoritesScreen.slotSentence. */
  function slotSentence(t, units, dessertFreq, variety, inSheet) {
    var n = units.length, rhythm = tabRhythm(t, dessertFreq), noun = tabNoun(t), isDessert = isShelf(t, 'dessert');
    var isSnacks = isShelf(t, 'snacks') || (t.kind === 'exotic' && /^(morning|afternoon|evening)_snack$/.test(t.slot));
    if (n === 0) {
      if (inSheet) return isDessert ? "We'll keep dessert covered for you." : "We'll pick your " + noun + ' for you.';
      return isDessert ? "Dessert's covered either way. Pick favourites to make it yours." : "We'll choose your " + noun + '. Pick anything to take over.';
    }
    if (n === 1) return units[0].name + ', ' + singularWhen(t) + '.';
    if (units.every(function (u) { return u.slug === units[0].slug; })) return units[0].name + ', ' + n + ' ways. ' + (rhythm === 'daily' ? "We'll rotate them." : "We'll mix them in.");
    if (rhythm === 'daily') {
      if (variety === 'convenience') return n + ' ' + noun + " picked. We'll keep the week simple and repeat what works.";
      if (variety === 'variety') return n + ' ' + noun + ". We'll rotate through all of them.";
      return n + ' ' + noun + " on rotation. We'll set the order.";
    }
    return n + ' ' + noun + ' to mix in.';
  }
  function batchMainsFooter(n) { return n <= 0 ? "We'll pick your mains. Pick anything to take over." : n === 1 ? "1 main for your tubs. We'll plan the cooks." : n + " mains for your tubs. We'll plan the cooks."; }
  function batchMainsRecap(n) { return n <= 0 ? "We'll pick your mains for you." : n === 1 ? "1 main for lunch and dinner. We'll plan the cooks." : n + " mains for lunch and dinner. We'll plan the cooks."; }
  function uniq(units) { var seen = {}; return units.filter(function (u) { if (seen[u.slug]) return false; seen[u.slug] = 1; return true; }); }

  function rPicks(el, my) {
    var f = S.food, P = f.picks;
    S.pk = S.pk || { tab: null, filter: 'all' };
    var V = null, toastT = 0;
    var load = function () { return Promise.all([needCatalogue(), mealView('picks'), loadIndex()]).then(function (r) { V = r[1].picker; return V; }); };
    withData(el, my, load, 'Loading the meals…', function () {
      el.classList.add('pk');
      var keysHas = function (k) { return P.keys.indexOf(k) > -1; };
      var unitsFor = function (t) {
        var out = [];
        t.eligible.forEach(function (slug) {
          var m = V.meals[slug];
          if (keysHas(t.planSlot + '|' + slug)) out.push({ slug: slug, name: m.name, image: m.image });
          m.plates.forEach(function (p) { if (keysHas(t.planSlot + '|' + slug + ':' + p.id)) out.push({ slug: slug, name: m.name, image: p.image || m.image }); });
        });
        return out;
      };
      S.pkMeals = V.meals;
      var activeTab = function () { return V.tabs.filter(function (t) { return t.id === S.pk.tab; })[0] || V.tabs[0]; };
      var mainsPicked = function () { var s = {}; V.tabs.forEach(function (t) { unitsFor(t).forEach(function (u) { if (V.meals[u.slug].full) s[u.slug] = 1; }); }); return Object.keys(s).length; };
      var hasAny = function () { return V.tabs.some(function (t) { return unitsFor(t).length > 0; }); };
      var mealKeys = function (slot, slug) { return P.keys.filter(function (k) { return k === slot + '|' + slug || k.indexOf(slot + '|' + slug + ':') === 0; }); };
      var plateClash = function (m, plateId) { var p = m.plates.filter(function (x) { return x.id === plateId; })[0]; return p ? p.clash : []; };
      var heroKey = function (slot, m) { return m.plates.length > 1 ? slot + '|' + m.slug + ':' + m.plates[0].id : slot + '|' + m.slug; };
      var pickHero = function (slot, m) { var k = heroKey(slot, m); toggle(P.keys, k); };
      var refetch = function () { return load().then(function () { if (my === token) draw(); }); };

      var onCard = function (slug) {
        var t = activeTab(), slot = t.planSlot, m = V.meals[slug], keys = mealKeys(slot, slug);
        if (keys.length) {
          P.keys = P.keys.filter(function (k) { return keys.indexOf(k) < 0; });
          var still = P.keys.some(function (k) { var key = k.slice(k.indexOf('|') + 1); return key === slug || key.indexOf(slug + ':') === 0; });
          if (!still && P.allergenOk[slug]) { delete P.allergenOk[slug]; return refetch(); }
          return draw();
        }
        if (m.catch && plateClash(m, m.hero).length > 0 && !(P.allergenOk[slug] && P.allergenOk[slug].mode === 'anyway')) return catchSheet(m, slot);
        if (m.skip && m.skip.kind === 'version' && m.skip.safe) { P.versionChoices[slug] = m.skip.variantId; pickHero(slot, m); return refetch(); }
        pickHero(slot, m); draw();
      };

      var catchSheet = function (m, slot) {
        var c = m.catch, o = c.offer, words = c.heroWords, culprits = c.culprits;
        var plur = function (n) { return n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };
        var ov = culprits.length ? 'Contains ' + words + ' · ' + (culprits.length === 1 ? 'the ' + culprits[0] : culprits.length + ' ingredients') : 'Contains ' + words;
        var l1 = o.kind === 'leave_out' ? 'It’s topped with <b>' + esc(plur(o.names)) + '</b>.' : culprits.length ? 'The <b>' + esc(plur(culprits)) + '</b> ' + (culprits.length === 1 ? 'has' : 'have') + ' ' + esc(words) + '.' : 'It’s labelled as containing ' + esc(words) + '.';
        var l2 = '', why = '', yes = 'Leave it out';
        if (o.kind === 'plate') { l2 = 'The ' + o.plateName.toLowerCase() + ' doesn’t.'; why = 'Same meal, served another way' + (o.variantName ? ', made ' + o.variantName.toLowerCase() : '') + '.'; yes = 'Pick the ' + o.plateName.toLowerCase(); }
        else if (o.kind === 'variant') { l2 = 'Made ' + o.variantName.toLowerCase() + ', it doesn’t.'; why = o.extraActiveMinutes > 0 ? 'Same plate. About ' + o.extraActiveMinutes + ' more minutes hands-on.' : 'Same plate, no extra work.'; yes = 'Pick it ' + o.variantName.toLowerCase(); }
        else if (o.kind === 'leave_out') { l2 = 'Without it, it’s safe.'; why = 'It’s only a topping, so your macros barely change. Leave it off when you plate up.'; yes = 'Pick it without the ' + plur(o.names); }
        else why = 'There’s no ' + words + '-free version of this one yet, so it stays out of your plan unless you say otherwise.';
        var alt = o.kind === 'plate' ? m.plates.filter(function (p) { return p.id === o.ref.plateId; })[0] : null;
        var strike = o.kind === 'leave_out' ? '+ ' + plur(o.names) : culprits[0] || words;
        openSheet('<div class="cphoto">' + photoFile(m.image, m.name) + (alt && alt.image && alt.image !== m.image ? '<div class="cwipe">' + photoFile(alt.image, alt.name) + '</div>' : '') + '<span class="strike">' + WARN + '<s' + (o.kind === 'none' ? ' class="no"' : '') + '>' + esc(strike) + '</s></span></div>' +
          '<p class="sh-ov amber">' + esc(ov) + '</p><p class="cl1">' + l1 + '</p>' + (l2 ? '<p class="cl2"><span>' + CHECK + '</span>' + esc(l2) + '</p>' : '') + '<p class="sh-lede">' + esc(why) + '</p>' +
          '<button type="button" class="sh-go" data-a="safe">' + esc(yes) + '</button><button type="button" class="sh-ghost two" data-a="anyway">' + (o.kind === 'none' ? 'Pick it anyway' : 'Pick the original anyway') + '<small>I have a safe swap at home</small></button>', function (sh) {
          $$('[data-a]', sh).forEach(function (b) {
            b.onclick = function () {
              var a = b.getAttribute('data-a'); closeSheet();
              if (a === 'safe' && o.kind === 'none') return;
              if (a === 'anyway') { P.allergenOk[m.slug] = { mode: 'anyway' }; pickHero(slot, m); return refetch(); }
              if (o.kind === 'leave_out') { P.allergenOk[m.slug] = { mode: 'leave_out', leaveOut: o.ingredientIds }; pickHero(slot, m); }
              else if (o.kind === 'variant') { if (o.ref.variantId) P.versionChoices[m.slug] = o.ref.variantId; pickHero(slot, m); }
              else if (o.kind === 'plate') { if (o.ref.variantId && o.ref.variantId !== c.heroVariant) P.versionChoices[m.slug] = o.ref.variantId; toggle(P.keys, slot + '|' + m.slug + ':' + o.ref.plateId); }
              refetch();
            };
          });
        });
      };

      var plateSheet = function (slug) {
        var t = activeTab(), slot = t.planSlot, m = V.meals[slug];
        var body = function () {
          return '<p class="sh-ov acc">Pick a plate</p><h2 class="sh-t">' + esc(m.name) + '</h2><p class="sh-lede">How would you eat it? Pick one or a few. A few ways keeps one batch interesting.</p>' +
            m.plates.map(function (p, i) {
              var on = keysHas(slot + '|' + slug + ':' + p.id), notes = [];
              if (p.clash.length) notes.push('<small class="amber">Has ' + esc(allergenList(p.clash)) + '</small>');
              if (p.skipHas) notes.push('<small>Has ' + esc(p.skipHas) + '</small>');
              return '<button type="button" class="plrow' + (on ? ' on' : '') + '" data-pl="' + esc(p.id) + '" aria-pressed="' + on + '"><span class="plth">' + photoFile(p.image || m.image, p.name) + '</span><span class="plb"><span class="pn"><b>' + esc(p.name) + '</b>' + (p.stunt ? '<i class="treat">treat</i>' : '') + (i === 0 ? '<i class="herop">in the photo</i>' : '') + '</span><small>' + p.kcal + ' cal · ' + p.protein + 'g protein</small>' + notes.join('') + '</span><span class="pck">' + (on ? CHECK : '') + '</span></button>';
            }).join('') + '<button type="button" class="sh-go" data-close="1">Done</button>';
        };
        openSheet('<div id="plBody">' + body() + '</div>', function (sh) {
          var wire = function () {
            $$('[data-pl]', sh).forEach(function (b) {
              b.onclick = function () {
                var id = b.getAttribute('data-pl'), k = slot + '|' + slug + ':' + id, turningOn = !keysHas(k);
                if (turningOn && plateClash(m, id).length && !P.allergenOk[slug]) P.allergenOk[slug] = { mode: 'anyway' };
                toggle(P.keys, k); $('#plBody', sh).innerHTML = body(); wire(); draw();
              };
            });
            $('[data-close]', sh).onclick = function () { closeSheet(); };
          };
          wire();
        });
      };

      var notesFor = function (m, view) {
        var out = [], c = m.catch;
        if (c) {
          var picked = [];
          view.forEach(function (k) { if (k === m.slug) picked.push(m.hero); else if (k.indexOf(m.slug + ':') === 0) picked.push(k.slice(m.slug.length + 1)); });
          if (picked.length) {
            var unsafe = picked.some(function (pid) { return plateClash(m, pid).length > 0; });
            out.push(unsafe ? ['amber', 'Has ' + c.words + ' · your call'] : ['green', 'No ' + c.words]);
          } else {
            var hc = plateClash(m, m.hero);
            out.push(hc.length ? ['amber', 'Has ' + allergenList(hc)] : ['green', 'No ' + c.words]);
          }
        }
        var v = m.skip;
        if (v && v.kind === 'has') out.push(['plain', 'Has ' + v.foods]);
        else if (v && v.kind === 'leave_out') out.push(['green', 'No ' + v.foods]);
        else if (v && v.kind === 'version') { var nm = String(v.variantName).toLowerCase(); out.push(['green', nm.charAt(0).toUpperCase() + nm.slice(1) + ': no ' + v.foods]); }
        return out;
      };
      var cardHtml = function (slug, view, salt) {
        var m = V.meals[slug], multi = m.plates.length > 1, picks = 0, ov = null;
        if (view.indexOf(slug) > -1) picks++;
        view.forEach(function (k) { if (k.indexOf(slug + ':') === 0) picks++; });
        if (m.catch) { var pk = view.filter(function (k) { return k.indexOf(slug + ':') === 0; }); if (pk.length === 1) { var pl = m.plates.filter(function (p) { return slug + ':' + p.id === pk[0]; })[0]; if (pl && pl.id !== m.hero) ov = pl; } }
        var notes = notesFor(m, view);
        if (salt != null) notes.push(['plain', String(Math.round(salt)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' mg sodium a tub']);
        var label = !multi ? '' : (function () { var p = m.plates.filter(function (x) { return view.indexOf(slug + ':' + x.id) > -1; }); return p.length === 0 ? m.plates.length + ' ways' : p.length === 1 ? p[0].name : p.length + ' of ' + m.plates.length + ' ways'; })();
        var rp = recipe(slug);
        return '<div class="mcard' + (picks ? ' on' : '') + (m.skip && m.skip.kind === 'has' && !picks ? ' mdim' : '') + '"><button type="button" class="mtp" data-card="' + slug + '" aria-pressed="' + (picks > 0) + '" aria-label="' + esc((ov ? ov.name : m.name) + ', ' + (m.effort === 0 ? 'no cooking' : m.effort + ' minutes hands-on') + ', ' + m.ings + ' ingredients' + notes.map(function (n) { return ', ' + n[1]; }).join('')) + '">' +
          '<span class="mimg">' + photoFile(ov ? ov.image : m.image, '') + '</span>' +
          (notes.length ? '<span class="notes2">' + notes.map(function (n) { return '<span class="np ' + n[0] + '">' + (n[0] === 'amber' ? WARN : n[0] === 'green' ? CHECK : '') + esc(n[1]) + '</span>'; }).join('') + '</span>' : '') +
          '<span class="cb">' + (picks ? (multi && picks > 1 ? '<b>' + picks + '</b>' : CHECK) : '') + '</span><span class="mt2">' + esc(ov ? ov.name : m.name) + '</span>' +
          '<span class="pst"><span class="mp' + (m.ings >= 11 ? ' warn' : '') + '">' + m.ings + ' ings</span><span class="mp">' + (m.effort === 0 ? 'No cook' : m.effort + ' min') + '</span></span></button>' +
          (multi ? '<button type="button" class="mfoot" data-ways="' + slug + '">' + esc(label) + CHEVR + '</button>' : '') +
          (rp ? '<a class="minfo" href="../r/' + rp + '/" target="_blank" rel="noopener" aria-label="More about ' + esc(m.name) + '">' + INFO + '</a>' : '') + '</div>';
      };

      var draw = function () {
        var t = activeTab(); S.pk.tab = t.id;
        var view = P.keys.filter(function (k) { return k.indexOf(t.planSlot + '|') === 0; }).map(function (k) { return k.slice(t.planSlot.length + 1); });
        var L = t.lists[S.pk.filter], rows = [];
        var chunk = function (slugs) {
          var quick = slugs.filter(function (s) { return V.meals[s].quick; }), slow = slugs.filter(function (s) { return !V.meals[s].quick; });
          if (!slow.length) { rows.push(['grid', slugs]); return; }
          if (quick.length) { rows.push(['head', 'Quick or made ahead', 'About 5 minutes with no stove, or made once and kept for the week.', true]); rows.push(['grid', quick]); }
          rows.push(['div', 'Cooked fresh, 10 min or more']); rows.push(['grid', slow]);
        };
        var saltMg = {};
        if (L.goal.length || L.salt.length) {
          var on = {}; L.goal.concat(L.salt).forEach(function (x) { on[x.slug] = 1; });
          if (L.goal.length) { rows.push(['head', V.shelf.title, V.shelf.sub, true, true]); chunk(L.goal.map(function (x) { return x.slug; })); }
          if (L.salt.length) { L.salt.forEach(function (x) { saltMg[x.slug] = x.mg; }); rows.push(['head', 'Lower in salt', 'Least sodium a tub, made with salt-reduced tins and sauces.', true]); chunk(L.salt.map(function (x) { return x.slug; })); }
          rows.push(['div', 'All mains']); chunk(L.top.filter(function (s) { return !on[s]; }));
          if (L.low.length) rows.push(['div', 'Has foods you skip · ' + L.low.length]);
          rows.push(['grid', L.low]);
        } else if (L.low.length) { chunk(L.top); rows.push(['div', 'Has foods you skip · ' + L.low.length]); rows.push(['grid', L.low]); }
        else chunk(L.top);
        var have = P.useUp.map(function (id) { return { id: id, name: S.cat.names[id] }; });
        var extra = have.filter(function (h) { return !S.cat.quickUseUp.some(function (q) { return q.id === h.id; }); });
        var chip = function (label, id) { return '<button type="button" class="fchip sm" data-uu="' + esc(id) + '" aria-pressed="' + (P.useUp.indexOf(id) > -1) + '">' + esc(label) + '</button>'; };
        var shortName = function (n) { return String(n).split(/[,(]/)[0].trim().split(' ')[0].toLowerCase(); };
        var y = window.scrollY;
        el.innerHTML = '<div class="pktop"><span></span><button type="button" class="linkb small" id="chooseMe" aria-label="Choose for me. Skip picking and let the app choose your meals">Choose for me</button></div>' +
          '<h1 class="ptitle">Foods you like</h1><p class="sub">Pick what you’ll eat this week.</p>' +
          (V.mainsRec != null ? '<p class="sub" style="margin-top:2px">' + esc(V.mainsLine) + '</p><button type="button" class="linkb small whyl" id="whyN">Why ' + V.mainsRec + '? ›</button>' : '') +
          (V.avoid ? '<p class="avoid"><span>You avoid</span><i></i>' + esc(V.avoid) + '</p>' : '') +
          V.unlabelled.map(function (a) { return '<p class="unl">' + esc(a) + " isn't on our meal labels. Check ingredients yourself.</p>"; }).join('') +
          '<div class="tabs" role="tablist">' + V.tabs.map(function (x) { var hp = unitsFor(x).length > 0; return '<button type="button" role="tab" data-tab="' + x.id + '" aria-selected="' + (x.id === t.id) + '">' + esc(x.label) + '<i class="' + (hp ? 'on' : '') + '"></i></button>'; }).join('') + '</div>' +
          '<div class="uucard"><div class="uuh"><b>Got food to use up?</b><button type="button" class="linkb small" id="allFoods">All foods ›</button></div><p>Tap what\'s in your fridge or pantry. Meals that use it go first.</p><div class="uuchips">' +
            extra.map(function (h) { return chip(h.name, h.id); }).join('') + S.cat.quickUseUp.map(function (q) { return chip(q.label, q.id); }).join('') + '</div>' +
            (have.length ? '<div class="uuse"><span>Using <b>' + esc(have.slice(0, 3).map(function (h) { return shortName(h.name); }).join(', ') + (have.length > 3 ? ' +' + (have.length - 3) : '')) + '</b></span><button type="button" id="fillWeek">Fill my week</button></div>' : '') + '</div>' +
          (t.useUp.length ? '<p class="rowt">Uses what you have</p><div class="mtrowx">' + t.useUp.map(function (u) { var m = V.meals[u.slug], pk = view.some(function (k) { return k === u.slug || k.indexOf(u.slug + ':') === 0; }); return '<button type="button" class="mcmini' + (pk ? ' on' : '') + '" data-card="' + u.slug + '"><span class="mimg">' + photoFile(m.image, '') + '<span class="cb">' + (pk ? CHECK : '') + '</span></span><b>' + esc(m.name) + '</b><small>' + esc(u.sub) + '</small></button>'; }).join('') + '</div>' : '') +
          '<div class="filt">' + [['all', 'All'], ['quick', 'Quick'], ['no_cook', 'No-cook'], ['batch', 'Big batch']].map(function (q) { return '<button type="button" data-qf="' + q[0] + '" aria-pressed="' + (S.pk.filter === q[0]) + '">' + q[1] + '</button>'; }).join('') + '</div>' +
          (L.top.length + L.low.length === 0 ? '<div class="pempty"><p>No matches with this filter.</p><button type="button" class="linkb small" id="clrF">Clear filter</button></div>' :
            rows.map(function (r) {
              if (r[0] === 'grid') return '<div class="mgrid2">' + r[1].map(function (s) { return cardHtml(s, view, saltMg[s]); }).join('') + '</div>';
              if (r[0] === 'div') return '<p class="sdiv"><span>' + esc(r[1]) + '</span><i></i></p>';
              return '<div class="shead"><p class="sdiv acc"><span>' + esc(r[1]) + '</span><i></i>' + (r[4] ? '<button type="button" class="linkb small" id="whyThese">Why these ›</button>' : '') + '</p><small>' + esc(r[2]) + '</small></div>';
            }).join(''));
        window.scrollTo(0, y);
        $$('[data-tab]', el).forEach(function (b) { b.onclick = function () { S.pk.tab = b.getAttribute('data-tab'); draw(); window.scrollTo(0, 0); }; });
        $$('[data-card]', el).forEach(function (b) { b.onclick = function () { onCard(b.getAttribute('data-card')); }; });
        $$('[data-ways]', el).forEach(function (b) { b.onclick = function () { plateSheet(b.getAttribute('data-ways')); }; });
        $$('[data-qf]', el).forEach(function (b) { b.onclick = function () { S.pk.filter = b.getAttribute('data-qf'); draw(); }; });
        $$('[data-uu]', el).forEach(function (b) { b.onclick = function () { toggle(P.useUp, b.getAttribute('data-uu')); refetch(); }; });
        var cf = $('#clrF', el); if (cf) cf.onclick = function () { S.pk.filter = 'all'; draw(); };
        var wn = $('#whyN', el); if (wn) wn.onclick = function () { whySheet(V.mainsWhy); };
        var wt = $('#whyThese', el); if (wt) wt.onclick = function () {
          var L2 = activeTab().lists[S.pk.filter];
          openSheet('<h2 class="sh-t">' + esc(V.shelf.title) + '</h2><p class="sh-lede">' + esc(V.shelf.sub) + '</p>' + L2.goal.map(function (x) { return '<div class="whyrow"><b>' + esc(V.meals[x.slug].name) + '</b><span>' + esc(x.reason) + '</span></div>'; }).join('') + '<button type="button" class="sh-go" data-close="1">Done</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
        };
        $('#chooseMe', el).onclick = function () { P.saved = false; go('mealsummary'); };
        $('#allFoods', el).onclick = allFoods;
        var fw = $('#fillWeek', el); if (fw) fw.onclick = function () {
          call('fillWeek', aboutForEngine(), foodForEngine()).then(function (r) {
            if (my !== token) return;
            P.keys = r.keys; draw();
            toast(r.added ? 'Picked ' + plural(r.added, 'meal') + ' that use ' + r.names + '. The build fills the rest and keeps your macros.' : 'Nothing new to fill: every tab has picks, or no meal uses those foods.');
          });
        };
        footer();
      };
      var toast = function (text) {
        var old = document.querySelector('.ptoast'); if (old) old.remove();
        var d = document.createElement('div'); d.className = 'ptoast'; d.innerHTML = '<span>' + CHECK + '</span>' + esc(text); document.body.appendChild(d);
        clearTimeout(toastT); toastT = setTimeout(function () { d.remove(); }, 4200);
      };
      var allFoods = function () {
        var q = '';
        var body = function () {
          var query = q.trim().toLowerCase();
          var groups = S.cat.aisles.map(function (a) { return { label: a.label, items: a.items.filter(function (r) { return !query || r.name.toLowerCase().indexOf(query) > -1 || (r.syn || []).some(function (s) { return s.toLowerCase().indexOf(query) > -1; }); }) }; }).filter(function (g) { return g.items.length; });
          return groups.length ? groups.map(function (g) { return '<p class="letter">' + esc(g.label) + '</p>' + g.items.map(function (r) { var on = P.useUp.indexOf(r.id) > -1; return '<button type="button" class="frow' + (on ? ' got' : '') + '" data-af="' + esc(r.id) + '" role="checkbox" aria-checked="' + on + '"><span class="ft"><span class="fn">' + esc(r.name) + '</span></span><span class="fc">in ' + plural(r.meals, 'meal') + '</span><span class="fp">' + (on ? CHECK : '') + '</span></button>'; }).join(''); }).join('') : '<p class="nores">Nothing matches “' + esc(q.trim()) + "”. Our meals don't use it.</p>";
        };
        openSheet('<h2 class="sh-t">What\'s in your kitchen?</h2><p class="sh-lede">Every food our meals use, by aisle. Tick what you want to use up.</p><div class="search"><input type="text" id="afQ" placeholder="Filter, like spin" autocomplete="off" aria-label="Filter foods"></div><div id="afL" class="alist"></div><button type="button" class="sh-go" data-close="1">Done</button>', function (sh) {
          var wire = function () { $('#afL', sh).innerHTML = body(); $$('[data-af]', sh).forEach(function (b) { b.onclick = function () { toggle(P.useUp, b.getAttribute('data-af')); wire(); }; }); };
          $('#afQ', sh).oninput = function () { q = this.value; wire(); };
          $('[data-close]', sh).onclick = function () { closeSheet(); refetch(); };
          wire();
        }, function () { refetch(); });
      };
      var footer = function () {
        var t = activeTab(), units = unitsFor(t), rhythm = tabRhythm(t, V.dessertFrequency);
        var dot = function (u, i, overlap) { return '<span class="sdot' + (u ? '' : ' empty') + (overlap && i > 0 ? ' ov' : '') + '">' + (u ? photoFile(u.image, '') : '') + '</span>'; };
        var dots = rhythm === 'daily' ? [0, 1, 2, 3, 4, 5, 6].map(function (i) { return dot(units.length ? units[i % units.length] : null, i, false); }).join('') : (units.length ? units.slice(0, 5) : [null, null, null]).map(function (u, i) { return dot(u, i, true); }).join('');
        var mainsTabs = V.tabs.filter(function (x) { return isShelf(x, 'lunch') || isShelf(x, 'dinner'); });
        var batchN = V.batchPlanOn && (isShelf(t, 'lunch') || isShelf(t, 'dinner')) ? uniq([].concat.apply([], mainsTabs.map(unitsFor))).length : null;
        var any = hasAny(), mp = mainsPicked(), line = V.mainsRec != null && any ? pickCountLine(mp, V.mainsRec, 'mains') : null;
        ctaNote('<div class="strip"><div class="sdots">' + dots + '</div><p>' + esc(batchN != null ? batchMainsFooter(batchN) : slotSentence(t, units, V.dessertFrequency, V.mealVariety, false)) + '</p></div><p class="gentle"' + (line ? '' : ' style="visibility:hidden"') + '>' + esc(line || '.') + '</p>');
        primary(V.mainsRec != null && any ? 'Save · ' + mp + ' of ' + V.mainsRec : 'Save', confirm, !any);
      };
      var confirm = function () {
        var tabs = V.tabs.filter(function (x) { return !(V.batchPlanOn && isShelf(x, 'dinner') && V.tabs.some(function (y) { return isShelf(y, 'lunch'); })); });
        openSheet('<p class="sh-ov acc">Before we build</p><h2 class="sh-t">Your week, then.</h2><div class="rcap">' + tabs.map(function (x) {
          var mainsRow = V.batchPlanOn && isShelf(x, 'lunch');
          var units = mainsRow ? uniq(unitsFor(x).concat([].concat.apply([], V.tabs.filter(function (y) { return isShelf(y, 'dinner'); }).map(unitsFor)))) : unitsFor(x);
          var rhythm = tabRhythm(x, V.dessertFrequency);
          var mini = rhythm === 'daily' ? [0, 1, 2, 3, 4, 5, 6].map(function (i) { return units.length ? units[i % units.length] : null; }) : units.length ? units.slice(0, 5) : [null, null, null];
          var nUniq = Object.keys(units.reduce(function (o, u) { o[u.slug] = 1; return o; }, {})).length;
          return '<div class="rrow"><p class="rl">' + esc(mainsRow ? 'Lunch and dinner' : x.label) + '</p><div><div class="rdots' + (rhythm === 'mix' ? ' mix' : '') + '">' + mini.map(function (u) { return '<span>' + (u ? photoFile(u.image, '') : '') + '</span>'; }).join('') + '</div><p class="rsn">' + esc(mainsRow ? batchMainsRecap(nUniq) : slotSentence(x, units, V.dessertFrequency, V.mealVariety, true)) + '</p></div></div>';
        }).join('') + '</div><button type="button" class="sh-go" id="cfOk">Looks good</button><button type="button" class="sh-sec" data-close="1">Keep editing</button>', function (sh) {
          $('#cfOk', sh).onclick = function () { closeSheet(); P.saved = true; S.pk.tab = null; go('mealsummary'); };
          $('[data-close]', sh).onclick = function () { closeSheet(); };
        });
      };
      draw();
    });
  }

  /* ---------- NutritionSummary: "Looking good." ---------- */
  var ACTIVITY_LABELS = { sedentary: 'Mostly sitting', light: 'On my feet a bit', moderate: 'On my feet a lot', heavy: 'Physical work', extreme: 'Hard physical work' };
  var DIET_LABELS = { balanced: 'Balanced', high_protein: 'High protein', low_carb: 'Low carb', keto: 'Keto', custom: 'Custom' };
  function startLabel(v) {
    if (v === 'today') return 'starts today'; if (v === 'tomorrow') return 'starts tomorrow';
    var off = startOffset(v); if (off == null) return '';
    var d = addDays(midnight(new Date()), off); return 'starts ' + WD[d.getDay()] + ' ' + d.getDate() + ' ' + MONS[d.getMonth()];
  }
  /** PhaseTargetNote.noteFor (em dashes in two app strings read as commas here). */
  function phaseNote(n, m) {
    var pace = function (dir) {
      var dd = m ? Math.abs(m.tdee - m.calories) : null;
      if (dd != null && dd > 0) return dir + ' about ' + ((dd * 7) / 7700).toFixed(2) + ' kg a week';
      if (n.seedPct == null) return dir === 'Up' ? 'A small surplus, deliberately' : 'A steady deficit';
      return dir + ' ' + n.seedPct + '% a week' + (n.weightKg ? ' (' + ((n.weightKg * n.seedPct) / 100).toFixed(2) + ' kg)' : '');
    };
    if (n.phase === 'recomp' || n.phase === 'maintain') {
      var fav = n.trainingState === 'new' || n.trainingState === 'returning' || (n.bf != null && n.bf >= 18);
      return { value: 'Hold steady, fat down, muscle up', title: 'What decides this', head: 'The scale is meant to sit still.', body: 'Your weight is meant to stay put. Fat comes down and muscle goes up while the scale sits still, so three weeks without movement is the plan working.\n\n' + (fav ? 'This works best for people new to lifting, coming back after a break, or carrying more body fat, which describes you, so it should move well.' : 'This works best for people new to lifting, coming back after a break, or carrying more body fat. You are past that stage, so it still works, just slowly. A cut and then a build might get you there sooner.'), src: 'Barakat et al., Strength & Conditioning Journal, 2020' };
    }
    if (n.phase === 'bulk' || n.phase === 'lean_bulk') return { value: pace('Up'), title: 'Why not eat more?', head: 'A small surplus, deliberately.', body: 'That is the pace your body can turn into muscle, and food does not raise it. When lifters were put on a large surplus instead of a small one, the extra weight was mostly fat, and strength and muscle came out much the same.\n\nSo your target is the smallest surplus that still covers the muscle you can build. Eating more would only add fat you would have to trim off later.', src: 'Helms et al., Sports Medicine – Open, 2023' };
    return { value: pace('Down'), title: 'What decides this', head: 'A steady deficit, on purpose.', body: 'Your route runs this phase as a cut, and this is the pace it plans for: the slower end of what is safe. At this pace lifters in the research got stronger and added muscle while losing fat; a faster group shed it in about half the time but gained neither, on a much harder diet.\n\nYour fat stores can only release so much energy a day, and the leaner you get the lower that limit goes. The pace is checked against it every time your plan is built, so it follows your body rather than a number you chose once.' +
      (m && m.raisedForEnergyAvailability ? '\n\nThe calories were raised above what that pace asked for, because a deficit that deep would not leave enough energy to run on after training. The pace shown is the one the raised target actually delivers.' : '') +
      (m && m.raisedToAbsoluteFloor ? '\n\nThe calories were raised to the minimum the app will set for an unsupervised diet. A lower target is a decision for a doctor or dietitian, not an app.' : '') +
      (m && m.heldForAge ? '\n\nBecause you are under 18, the app holds the target at maintenance rather than a deficit. Changing your intake while you are still growing is something to decide with a doctor, dietitian or parent.' : ''), src: 'Garthe et al., Int J Sport Nutr Exerc Metab, 2011 · Alpert, J Theor Biol, 2005' };
  }
  function rSummary2(el, my) {
    S.edit = false;
    withData(el, my, function () { return mealView('summary'); }, 'Loading your answers', function (v) {
      var sm = v.summary, a = sm.answers, m = sm.macros, L = sm.labels;
      var snack = a.snackFrequency === '0' ? 'no snacks' : a.snackFrequency === '3+' ? '3+ snacks' : a.snackFrequency === 'ai_decide' ? 'plan picks snacks' : a.snackFrequency ? a.snackFrequency + ' snack' + (a.snackFrequency === '1' ? '' : 's') : '';
      var dess = { '0': 'None', every_night: 'Every night', most_nights: 'Most nights', once_per_week: 'Once a week', few_per_week: 'A few nights a week', ai_decide: 'Let the plan decide' };
      var rows = [
        ['Age', null, a.age != null ? String(a.age) : 'Not set'],
        ['Day-to-day activity', 'active', a.activityLevel ? ACTIVITY_LABELS[a.activityLevel] || a.activityLevel : 'Not set'],
        ['Training', 'sessions', L.training],
        ['Diet', 'diettype', a.dietType ? DIET_LABELS[a.dietType] || a.dietType : 'Not set'],
        ['Meat', 'meat', L.meat],
        ['Keep lower', 'keeplower', L.keepLower],
        ['Meals & snacking', 'eat', a.mealsPerDay == null ? 'Not set' : a.mealsPerDay + ' meals' + (snack ? ' · ' + snack : '')],
      ];
      if (L.appetite != null) rows.push(['Eating enough is hard', 'appetite', L.appetite]);
      rows.push(['Variety', 'eat', a.mealVariety === 'convenience' ? 'Cook once, repeat' : a.mealVariety === 'variety' ? 'Keep it varied' : 'A bit of both']);
      rows.push(['Desserts', 'dessert', !a.dessertFrequency || a.dessertFrequency === '0' ? 'None' : dess[a.dessertFrequency] || 'Not set']);
      rows.push(['Slow cooker', 'cooker', L.cooker], ['Blender', 'cooker', L.blender], ['Freezer space', 'freezer', L.freezer], ['How often you shop', 'cadence', L.cadence]);
      if (L.stockUp != null) rows.push(['Stock up', 'stockup', L.stockUp]);
      rows.push(['Plan length', 'planlength', a.planDuration == null ? 'Not set' : L.planDays + ' days' + (startLabel(a.startDate) ? ' · ' + startLabel(a.startDate) : '')]);
      rows.push(['Allergies', 'allergies', a.allergies && a.allergies.length ? a.allergies.join(', ') : 'None']);
      rows.push(['Foods you skip', 'skip', sm.skip || 'None']);
      var lvl = sm.sleep ? (sm.sleep.level === 'minimal' ? 'Performance-focused' : sm.sleep.level === 'maximum' ? 'Sleep-first' : 'Balanced') : '';
      rows.push(['Sleep & meal timing', 'sleep', sm.sleep ? sm.sleep.bedtime + ' – ' + sm.sleep.wakeTime + ' · ' + lvl : 'Not set']);
      rows.push(['Eating challenges', a.goal === 'gain_weight' ? 'appetite' : null, a.eatingChallenges && a.eatingChallenges.length ? a.eatingChallenges.join(', ') : 'None']);
      var note = sm.note ? phaseNote(sm.note, m) : null;
      var pC = (m.protein || 0) * 4, cC = (m.carbs || 0) * 4, fC = (m.fat || 0) * 9, tot = pC + cC + fC, pc = function (x) { return tot > 0 ? Math.round((x / tot) * 100) : 0; };
      el.innerHTML = '<p class="ov rise" style="--i:0">Your meal plan</p><h1 class="qh rise" style="--i:0">Looking good.</h1><p class="sub rise" style="--i:1">Everything your plan is built from. Tap any row to change it.</p>' +
        '<div class="mcardx rise" style="--i:2"><p class="kcal1"><b>' + n0(m.calories) + '</b><span>kcal / day</span></p>' +
        [['Protein', m.protein, pc(pC), 'var(--acc)'], ['Carbs', m.carbs, pc(cC), '#fbbf24'], ['Fat', m.fat, pc(fC), '#f472b6']].map(function (x) { return '<div class="mbar"><span>' + x[0] + '</span><div><i style="width:' + x[2] + '%;background:' + x[3] + '"></i></div><b>' + Math.round(x[1]) + ' g</b><small>' + x[2] + '%</small></div>'; }).join('') +
        (note ? '<button type="button" class="srow2 note" id="ptn"><span><small>Weight target</small><b>' + esc(note.value) + '</b></span>' + CHEVR + '</button>' : '') + '</div>' +
        '<p class="sumh">Build your plan around</p><button type="button" class="fyl rise' + (sm.favCount ? ' on' : '') + '" style="--i:3" id="fyl"><span class="hrt">' + (sm.favCount ? '♥' : '♡') + '</span><span><b>Foods you like</b><small>' + (sm.favCount ? plural(sm.favCount, 'pick') : "We'll choose your meals for you. Tap to take over.") + '</small></span>' + CHEVR + '</button>' +
        '<p class="sumh">Your answers</p><div class="ans">' + rows.map(function (r, i) {
          var tap = r[1] && r[1] !== 'N3Age';
          return '<' + (tap ? 'button type="button" data-ed="' + r[1] + '"' : 'div') + ' class="srow2 rise" style="--i:' + Math.min(4 + i, 12) + '"><span><small>' + esc(r[0]) + '</small><b>' + esc(r[2]) + '</b></span>' + (tap ? CHEVR : '') + '</' + (tap ? 'button' : 'div') + '>';
        }).join('') + '</div><p class="restart"><button type="button" class="linkb small" id="restart">Restart questionnaire</button></p>';
      if (note) $('#ptn', el).onclick = function () {
        openSheet('<p class="sh-ov acc">Weight target · ' + esc(note.title) + '</p><h2 class="sh-t">' + esc(note.head) + '</h2>' + note.body.split('\n\n').map(function (p) { return '<p class="sh-b">' + esc(p) + '</p>'; }).join('') + '<p class="sh-src">' + esc(note.src) + '</p><button type="button" class="sh-ghost" data-close="1">Got it</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
      };
      $('#fyl', el).onclick = function () { go('picks'); };
      $$('[data-ed]', el).forEach(function (b) { b.onclick = function () { S.edit = true; go(b.getAttribute('data-ed')); }; });
      $('#restart', el).onclick = function () {
        openSheet('<h2 class="sh-t">Restart questionnaire?</h2><p class="sh-b">This clears all your answers and starts the questionnaire from the beginning.</p><button type="button" class="sh-go danger" id="rsOk">Restart</button><button type="button" class="sh-sec" data-close="1">Cancel</button>', function (sh) {
          $('#rsOk', sh).onclick = function () { closeSheet(); S.food = freshFood(); S.about.trainingChoice = null; S.about.trainingEdit = null; S.mv = null; S.meals = null; S.mealsKey = ''; go('active'); };
          $('[data-close]', sh).onclick = function () { closeSheet(); };
        });
      };
      primary('Build my meal plan', function () { go('mealbuild'); });
    });
  }

  /* ---------- MealBuildScreen ---------- */
  function needMeals(opts) {
    var k = keyOf([aboutForEngine(), foodForEngine(), opts && opts.accepted || null]);
    return loadIndex().then(function () {
      if (S.mealsKey === k && S.meals) return S.meals;
      return call('buildMeals', aboutForEngine(), foodForEngine(), opts || {}).then(function (m) { S.meals = m; S.mealsKey = k; S.accepted = opts && opts.accepted || null; S.day = 0; S.ticks = {}; S.openAisle = null; return m; });
    });
  }
  /** MealBuildScreen.stepsFor + batchSteps: every number is the plan's own. */
  function buildSteps(M) {
    var R = M.report, c = R.counts, av = R.avg, t = R.targets, kcalOff = (R.misses && R.misses.kcal) || 0, fav = M.favourites;
    var short = av.protein < t.proteinLo - 0.5, farOver = av.protein > t.proteinHi * 1.2;
    var out = [
      fav > 0 ? { label: 'Reading your ' + fav + ' favourite' + (fav === 1 ? '' : 's'), value: fav + ' meal' + (fav === 1 ? '' : 's') } : { label: 'Choosing meals for you', value: 'from the library' },
      { label: 'Placing ' + c.meals + ' meals across ' + c.days + ' days', value: c.meals + ' / ' + c.meals },
      { label: 'Hitting ' + n0(t.kcal) + ' kcal every day', value: kcalOff ? kcalOff + ' day' + (kcalOff === 1 ? '' : 's') + ' off' : n0(av.kcal), count: kcalOff ? null : { to: av.kcal }, warn: kcalOff > 0 },
    ];
    var b = R.batch;
    if (b) {
      out.push({ label: 'Planning your cook', value: 'cook ' + b.potsToCook + ' pot' + (b.potsToCook === 1 ? '' : 's') });
      out.push({ label: 'Filling your freezer', value: b.tubsBanked ? b.tubsBanked + ' tub' + (b.tubsBanked === 1 ? '' : 's') + ' banked' : b.tubsFromStock ? b.tubsFromStock + ' from the freezer' : 'all in the fridge' });
      if (b.status !== 'ok') out.push({ label: 'Tubs a day', value: b.tubsPerDay + ' of ' + b.ownTubsPerDay, warn: true });
    } else {
      out.push({ label: 'Planning your prep', value: c.batchCooks + ' batch cook' + (c.batchCooks === 1 ? '' : 's') });
      out.push({ label: 'Checking fridge life', value: c.freezePortions ? c.freezePortions + ' to freeze' : 'all fresh' });
    }
    out.push({ label: 'Balancing protein', value: Math.round(av.protein) + ' / ' + t.protein + ' g', count: { to: Math.round(av.protein), suffix: ' / ' + t.protein + ' g' }, warn: short || farOver });
    (R.dropped || []).forEach(function (d) { out.push({ label: 'No safe ' + d.word + ' in the library', value: d.slot === 'dessert' ? 'nights off' : 'left out', warn: true }); });
    out.push({ label: 'Building your shopping list', value: c.groceryItems + ' items' });
    return out;
  }
  function rMealBuild(el, my) {
    var favN = S.food.picks.saved ? S.food.picks.keys.length : 0;
    buildMoment(el, my, {
      word: 'your week.', sub: favN ? favN + ' favourites' : 'Your favourites', stepMs: 520, hold: 2700,
      wall0: S.food.picks.saved && S.pkMeals ? S.food.picks.keys.map(function (k) { var key = k.slice(k.indexOf('|') + 1), ci = key.indexOf(':'), m = S.pkMeals[ci < 0 ? key : key.slice(0, ci)]; if (!m) return null; var pl = ci < 0 ? null : m.plates.filter(function (p) { return p.id === key.slice(ci + 1); })[0]; return (pl && pl.image) || m.image; }).filter(Boolean) : [],
      wall: function (M) { return M.wall; },
      work: function () { return needMeals(S.accepted ? { accepted: S.accepted } : null); },
      over: function (M) { return M.plan.name || 'Your week'; },
      steps: buildSteps,
      visual: function (M) {
        return '<div class="wgrid g2">' + M.grid.days.map(function (d) { return '<span class="dl">' + d + '</span>'; }).join('') +
          M.grid.cells.map(function (c) { return '<div class="cell' + (c.batch ? ' b' : '') + (c.frozen ? ' fz' : '') + '"><div class="in">' + (c.image ? photoFile(c.image, '') : '') + '</div>' + (c.frozen ? '<i class="snow"></i>' : '') + '</div>'; }).join('') + '</div>';
      },
      onStep: function (i, M, box, now) {
        if (i === 1) $$('.cell', box).forEach(function (c, k) { now ? c.classList.add('on') : setTimeout(function () { c.classList.add('on'); }, k * 20); });
        if (i === 3) box.classList.add('mark-b');
        if (i === 4) box.classList.add('mark-f');
      },
      done: function (M) { replaceWith(M.note ? 'mealnote' : M.week ? 'mealweek' : M.gap ? 'mealgap' : 'weekready'); },
    });
  }
  /** After the week list: the gap, else the hand-off. */
  function afterWeek() { var M = S.meals; if (M && M.gap) go('mealgap'); else handoffMeals(); }
  function handoffMeals() { call('handoff').then(function () {}, function () {}); go('weekready'); }

  /* ---------- BatchNotePanel ---------- */
  function rMealNote(el, my) {
    withData(el, my, needMeals, '', function (M) {
      var n = M.note, w = M.plan.startDate, kick = 'Your week';
      if (w) { var d = new Date(w + 'T00:00:00'); kick = 'Week of ' + WD[d.getDay()] + ' ' + d.getDate() + ' ' + MONS[d.getMonth()]; }
      el.innerHTML = '<div class="panel"><p class="ov rise" style="--i:0">' + esc(kick) + '</p><h1 class="qh rise" style="--i:0">' + esc(n.headline) + '</h1>' + n.lines.map(function (l) { return '<p class="sub rise" style="--i:1">' + esc(l) + '</p>'; }).join('') +
        (n.offer ? '<div class="ncard rise" style="--i:2">' + esc(n.offer.line) + '</div>' : '') +
        '<div class="pbtns">' + (n.offer ? '<button type="button" class="pgo" id="nAdd">' + esc(n.offer.cta) + '</button>' : n.empty ? '<button type="button" class="pgo" id="nCh">Change my mains</button>' : '') +
        (n.offer && n.empty ? '<button type="button" class="pghost" id="nCh">Change my mains</button>' : '') +
        '<button type="button" class="' + (n.offer || n.empty ? 'pghost' : 'pgo') + '" id="nKeep">' + esc(n.keepLabel) + '</button></div></div>';
      primary(null);
      var add = $('#nAdd', el); if (add) add.onclick = function () { add.disabled = true; S.accepted = n.offer.recipe; S.mealsKey = ''; go('mealbuild'); };
      var ch = $('#nCh', el); if (ch) ch.onclick = function () { go('picks'); };
      $('#nKeep', el).onclick = function () { var M2 = S.meals; if (M2.week) go('mealweek'); else afterWeek(); };
    });
  }
  /* ---------- WeekListPanel ("Your week") ---------- */
  function rMealWeek(el, my) {
    withData(el, my, needMeals, '', function (M) {
      var L = M.week;
      el.innerHTML = '<div class="panel"><h1 class="whead rise" style="--i:0">' + esc(L.headline) + '</h1>' + L.weeks.map(function (w, wi) {
        return '<div class="wkb rise" style="--i:' + (1 + wi) + '"><p class="wkt"><span class="ov">' + esc(w.title) + '</span>' + (w.verdict && w.balanced ? '<em>' + esc(w.verdict) + '</em>' : '') + '</p>' +
          w.days.map(function (d) { return '<div class="wrow2"><b class="' + (d.cook ? 'cookd' : '') + '">' + esc(d.label) + '</b><div>' + (d.cook ? '<p class="wcook">' + esc(d.cook) + '</p>' : '') + '<p class="wm">' + d.meals.map(function (m, i) { return (i ? ' · ' : '') + '<span' + (m.frozen ? ' class="fz"' : '') + '>' + esc(m.name) + '</span>'; }).join('') + '</p></div></div>'; }).join('') + '</div>';
      }).join('') + (L.anyFrozen || L.foot ? '<p class="wfoot">' + (L.anyFrozen ? '<i></i><span class="fz">From the freezer.</span>' + (L.foot ? ' ' : '') : '') + esc(L.foot || '') + '</p>' : '') +
        '<div class="pbtns"><button type="button" class="pgo" id="wUse">Use this plan</button><button type="button" class="pghost" id="wCh">Change mains</button></div></div>';
      primary(null);
      $('#wUse', el).onclick = function () { this.disabled = true; afterWeek(); };
      $('#wCh', el).onclick = function () { go('picks'); };
    });
  }
  /* ---------- GapPanel ---------- */
  function rMealGap(el, my) {
    withData(el, my, needMeals, '', function (M) {
      var R = M.report, target = M.gap || 'protein', kg = R.kcalGap, isK = target === 'kcal' && !!kg, t = R.targets;
      var now = isK ? kg.now : Math.round(R.avg.protein), lo = isK ? t.kcalLo : t.proteinLo, hi = isK ? t.kcalHi : t.proteinHi, mid = isK ? t.kcal : t.protein, unit = isK ? 'kcal' : 'g';
      var fmt = function (n) { return isK ? n0(n) : String(Math.round(n)); }, over = isK && kg.dir === 'over';
      var top = Math.max(hi * (isK ? 1.25 : 1.12), now * 1.1), pct = function (g) { return Math.min(100, Math.max(0, (g / top) * 100)) + '%'; };
      var someDays = isK && kg.cause === 'some_days', dessertNight = someDays && kg.extraSlots.indexOf('dessert') > -1, nDays = isK ? kg.days.length : 0;
      var overline = isK ? (dessertNight ? 'Calories · your dessert night' + (nDays > 1 ? 's' : '') : someDays ? 'Calories · ' + nDays + ' day' + (nDays === 1 ? '' : 's') + ' a week' : 'Calories · every day') : 'Protein · your week';
      var why = !isK ? 'Your favourites top out at about ' + (R.proteinCeiling != null ? R.proteinCeiling : now) + ' g a day.' : someDays ? (dessertNight ? 'Your dessert night' + (nDays > 1 ? 's land' : ' lands') : nDays + ' day' + (nDays === 1 ? ' lands' : 's land')) + ' at about ' + fmt(now) + ' kcal, ' + fmt(Math.abs(now - (over ? hi : lo))) + ' ' + (over ? 'over your' : 'under your') + ' ' + fmt(over ? hi : lo) + ' ' + (over ? 'max' : 'minimum') + '.' : over ? 'Even the smallest portions of your favourites come to about ' + fmt(Math.min(kg.bound, now)) + ' kcal a day, over your ' + fmt(hi) + ' max.' : 'Your favourites top out at about ' + fmt(Math.max(kg.bound, now)) + ' kcal a day, under your ' + fmt(lo) + ' minimum.';
      var options = null, picked = null;
      // GapPanel.fixName: calorie swaps say what they replace.
      var SLOT_NOUN = { dessert: 'dessert', breakfast: 'breakfast', brunch: 'brunch', lunch: 'lunch', dinner: 'dinner', snack: 'snack', second_lunch: 'second lunch', early_dinner: 'early dinner' };
      var replaced = function (slot) {
        var dates = Object.keys(M.plan.dailyMeals).sort(), days = isK && kg.days.length ? kg.days : dates.map(function (_, i) { return i; }), found = [];
        days.forEach(function (d) { ((M.plan.dailyMeals[dates[d]] || {}).meals || []).forEach(function (m) { if ((m.type === slot || (slot === 'snack' && /_snack$/.test(m.type))) && (m.tags || []).indexOf('adjuster') < 0) found.push({ name: m.name, kcal: m.calories }); }); });
        if (!found.length) return null;
        return found.sort(function (a, b) { return over ? b.kcal - a.kcal : a.kcal - b.kcal; })[0];
      };
      var fixName = function (x) {
        if (isK && x.kind === 'add_meal') { var r = replaced(x.slot); return (over ? 'Lighter ' : 'Bigger ') + (SLOT_NOUN[x.slot] || x.slot) + ': ' + x.name + (r ? ' instead of ' + r.name : ''); }
        return x.title;
      };
      var draw = function () {
        var chosen = options && options.filter(function (o) { return o.i === picked; })[0];
        var after = chosen ? (isK && (chosen.inRange || chosen.otherMiss) ? mid : chosen.value) : null;
        var landed = !!chosen && (chosen.inRange || !!chosen.otherMiss);
        var basis = landed ? now : after != null ? after : now;
        var amount = isK ? Math.max(1, Math.round(over ? basis - hi : lo - basis)) : Math.max(1, Math.round(lo - basis));
        var anyIn = (options || []).some(function (o) { return o.inRange || o.otherMiss; });
        var lead = options == null ? why + ' Rebuilding your week with each possible fix to see which really work.' : !options.length ? why + ' We tried the best changes in the library and none of them gets your week closer.' : anyIn ? why + ' We rebuilt your week with each of these. Pick one:' : why + ' Nothing in the library gets you all the way. These get closest:';
        var res = function (o) { if (o.inRange) return isK ? ['✓ Every day in range', '', true] : ['✓ ' + o.value + ' g a day', ' · in range', true]; if (o.otherMiss) return ['✓ ' + (isK ? 'Calories' : 'Protein') + ' in range', ' · ' + o.otherMiss, true]; return isK ? [fmt(o.value) + ' kcal', ' ' + (someDays ? 'that night' : 'a day') + ' · closer', false] : [o.value + ' g a day', ' · closer', false]; };
        el.innerHTML = '<div class="panel gapp"><p class="ov" style="color:#fbbf24">' + (landed ? '&nbsp;' : esc(overline)) + '</p><h1 class="qh">' + (landed ? '<span style="color:#4ade80">' + (chosen.inRange ? 'In range.' : isK ? 'Calories fixed.' : 'Protein fixed.') + '</span>' : '<span style="color:#fbbf24">' + fmt(amount) + '</span> ' + (isK ? (over ? 'kcal over.' : 'kcal under.') : 'g short.')) + '</h1>' +
          '<div class="gmeter"><i class="gband" style="left:' + pct(lo) + ';width:' + pct(hi - lo) + '"></i>' + (after != null ? '<i class="ghost" style="width:' + pct(after) + '"></i>' : '') + '<i class="fill" style="width:' + pct(now) + '"></i><i class="tick" style="left:' + pct(mid) + '"></i></div>' +
          '<div class="mscale"><span><b>' + fmt(now) + ' ' + unit + '</b>' + (someDays ? ' that night' : ' a day') + (chosen ? '<em class="' + (landed ? 'ok' : '') + '">' + (landed && isK ? '  →  in range' : '  →  ' + fmt(chosen.value)) + '</em>' : '') + '</span><span>range ' + fmt(lo) + '–' + fmt(hi) + ' ' + unit + '</span></div>' +
          '<p class="sub">' + esc(lead) + '</p>' +
          (options == null ? '<div class="think"><span class="tdots"><i></i><i></i><i></i></span><b>Finding what fixes it</b><small>Looking through the library…</small></div>' : '<div class="fixes">' + options.map(function (o) {
            var r = res(o), on = picked === o.i, f0 = o.fixes[0];
            return '<button type="button" class="fopt' + (on ? ' on' : '') + '" data-o="' + o.i + '" role="radio" aria-checked="' + on + '"><span class="fimg">' + (f0.image ? photoFile(f0.image, '') : '<b>' + (f0.kind === 'fewer_desserts' ? '−1' : '−') + '</b>') + '</span><span class="ftx"><b>' + esc(o.fixes.map(fixName).join(' + ')) + '</b><small><em class="' + (r[2] ? 'ok' : 'amb') + '">' + esc(r[0]) + '</em>' + esc(r[1]) + '</small></span><span class="rad"></span></button>';
          }).join('') + '</div>') +
          (options != null ? '<div class="pbtns">' + (chosen ? '<button type="button" class="pgo" id="gUse">Use this plan</button>' : '<button type="button" class="pgo" id="gFav">Choose other favourites</button>') +
            '<button type="button" class="pghost two" id="gKeep">' + (someDays ? 'Keep it as it is' : 'Keep my picks as they are') + '<small>' + (someDays ? 'it’s ' + nDays + ' night' + (nDays === 1 ? '' : 's') + ' a week' : isK ? 'and land around ' + fmt(now) + ' kcal a day' : 'and aim for about ' + now + ' g this week') + '</small></button>' +
            (chosen ? '<button type="button" class="linkb small" id="gFav2">Choose other favourites</button>' : '') + '</div>' : '') + '</div>';
        $$('[data-o]', el).forEach(function (b) { b.onclick = function () { picked = +b.getAttribute('data-o'); draw(); }; });
        var u = $('#gUse', el); if (u) u.onclick = function () { u.disabled = true; call('useGapOption', picked).then(function (r) { S.meals = Object.assign({}, S.meals, r, { note: null, week: null, gap: null }); handoffMeals(); }, function (e) { el.insertAdjacentHTML('beforeend', errBox(e.message)); }); };
        [$('#gFav', el), $('#gFav2', el)].forEach(function (b) { if (b) b.onclick = function () { go('picks'); }; });
        var kp = $('#gKeep', el); if (kp) kp.onclick = function () { handoffMeals(); };
      };
      draw();
      primary(null);
      var t0 = performance.now();
      call('gapOptions').then(function (list) {
        return wait(Math.max(0, 1600 - (performance.now() - t0))).then(function () { if (my !== token) return; options = list; picked = list[0] ? list[0].i : null; draw(); });
      }, function () { if (my !== token) return; options = []; draw(); });
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
        primary('Continue', function () { go('alldone'); });
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
        primary('Continue', function () { go('alldone'); });
      });
    });
  }

  /* ---------- RouteReveal's finish line, back from a build (finishLineFor + dayOnePreview) ---------- */
  function rFinish(el) {
    el.classList.add('finish');
    var workoutBuilt = !!S.program, mealsBuilt = !!S.meals;
    var built = (workoutBuilt ? 1 : 0) + (mealsBuilt ? 1 : 0), left = 2 - built, pct = 60 + built * 20;
    var next = !workoutBuilt ? 'workout' : !mealsBuilt ? 'nutrition' : null;
    var headline = left === 2 ? 'Two short steps<br>to day one.' : left === 1 ? 'One short step<br>to day one.' : 'Ready for<br>day one.';
    // dayOnePreview: the meal plan's first day (else tomorrow), the plan's first session and the first meal.
    var M = S.meals, dates = M ? Object.keys(M.plan.dailyMeals).sort() : [], first = dates.length ? M.plan.dailyMeals[dates[0]] : null;
    var t = new Date(); t.setDate(t.getDate() + 1);
    var day = first && first.dayName ? first.dayName : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.getDay()];
    var parts = [], d0 = workoutBuilt && S.program.program.blocks[0] && S.program.program.blocks[0].days[0];
    if (d0 && d0.day_name) { var n = Array.isArray(d0.exercises) ? d0.exercises.length : 0; parts.push(n > 0 ? d0.day_name + ', ' + n + ' ' + (n === 1 ? 'exercise' : 'exercises') + '.' : d0.day_name + '.'); }
    var meal = first && (first.meals || []).filter(function (m) { return m && m.name; })[0];
    if (meal) { var type = typeof meal.type === 'string' ? meal.type.replace(/_/g, ' ') : ''; parts.push(type ? type.charAt(0).toUpperCase() + type.slice(1) + ' is ' + meal.name + '.' : 'First meal: ' + meal.name + '.'); }
    var line = parts.length ? parts.join(' ') : 'Your first session and your first day of meals, ready to follow.';
    var row = function (mark, num, title, sub, meta, to) {
      return '<' + (to ? 'button type="button" data-to="' + to + '"' : 'div') + ' class="sp ' + mark + '"><span class="sd">' + (mark === 'done' ? '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 12.5l4 4 8-9" fill="none" stroke="#0a0a0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : mark === 'goal' ? '<i></i>' : num) + '</span><span class="sb"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span>' + (meta ? '<em>' + meta + '</em>' : '') + '</' + (to ? 'button' : 'div') + '>';
    };
    var mark = function (isBuilt, id) { return isBuilt ? 'done' : next === id ? 'next' : 'todo'; };
    el.innerHTML = '<p class="fov rise" style="--i:0">' + (next ? 'You’re ' + pct + '% of the way' : 'You’re all set') + '</p><div class="fbar rise" style="--i:0"><i></i></div>' +
      '<h1 class="ftl rise" style="--i:1">' + headline + '</h1><div class="spine">' +
      '<div class="rise" style="--i:2">' + row('done', 0, 'Your route', 'Goal, timeline and phases set', 'DONE') + '</div>' +
      '<div class="rise" style="--i:3">' + row(mark(workoutBuilt, 'workout'), 2, 'Your training', 'Days, length, volume, extras', workoutBuilt ? 'DONE' : '~1 MIN', workoutBuilt ? 'program' : 'volume') + '</div>' +
      '<div class="rise" style="--i:4">' + row(mark(mealsBuilt, 'nutrition'), 3, 'Your meals', 'Diet, allergies, the meals you like', mealsBuilt ? 'DONE' : '~3 MIN', mealsBuilt ? 'today' : 'active') + '</div>' +
      '<div class="rise" style="--i:5">' + row('goal', 0, 'Day one: ' + day, line, '') + '</div></div>' +
      // Both built: no free note, and the pill already goes to the plan.
      (next ? '<p class="free rise" style="--i:6">Free to build. Nothing to pay at the end.</p><p class="later rise" style="--i:7"><button type="button" class="linkb small" data-to="keep">I’ll do this later</button></p>' : '');
    requestAnimationFrame(function () { var f = $('.fbar i', el); if (f) f.style.transform = 'scaleX(' + pct / 100 + ')'; });
    $$('[data-to]', el).forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-to')); }; });
    if (next === 'workout') primary('Next: my training', function () { go('volume'); });
    else if (next === 'nutrition') primary('Next: my meals', function () { go('active'); });
    else primary('Go to my plan', function () { go('keep'); });
  }

  /* ================= training =================
   * The app's workout questions from onboarding's finish line, screen for screen
   * (the next build: release 1.0.44 + release/integration, workout generator on):
   * Volume (Q6VolumePreferenceScreen, first since 24 Oct 2026), Days
   * (Q3DaysPerWeekScreen, 2 to 6 with each count's minutes), How long
   * (Q4ProgramDurationScreen), Refinements (RefinementsScreen), then
   * WorkoutBuildScreen. Equipment is not asked: the app
   * took it out of the flow (only "Commercial gym" can be built) and How long saves
   * the default. Every number on these screens (session minutes, sets per muscle,
   * the presets) comes from the app's own code in the engine bundle, and the
   * answers are saved and read back the way the screens save them
   * (scripts/try-engines/training-part.ts). */
  var T = S.training;
  // Engine calls for training run one at a time: they share the worker's storage.
  var tq = Promise.resolve();
  function tcall() {
    var args = arguments;
    var p = tq.then(function () { return call.apply(null, args); });
    tq = p.catch(function () {});
    return p;
  }
  function needTrain() {
    var k = keyOf(aboutForEngine());
    if (T.start && T.startKey === k) return Promise.resolve(T.start);
    return tcall('trainingStart', aboutForEngine()).then(function (st) {
      T.start = st; T.startKey = k;
      // Days opens on the stored week, else the meal side's sessions, else 4, kept to 2 to 6 (daysScreenStart, estimateDays).
      if (T.days == null) { T.days = st.start.selected; T.week = st.start.days; T.varies = st.start.varies; T.time = st.start.time; T.daysTouched = st.start.touched; T.hadWeek = st.start.hadWeek; }
      return st;
    });
  }
  function withTrain(el, my, fn) { needAbout(el, my, function () { withData(el, my, needTrain, '', fn); }); }
  /** The answers saved so far, field by field, as the screens save them (questionnaireStorage). */
  function savedThrough(step) {
    var q = {};
    if (step >= 1) q.volumePreference = T.volume;
    if (step >= 2) q.totalTrainingDays = T.days;
    if (step >= 3) { q.programDuration = T.length; q.selectedEquipment = T.start.defaultEquipment; }
    if (step >= 4) {
      var r = T.refine || (T.refine = { priority: [], aux: [], avoid: [], core: true, rep: 'classic', active: [], open: {} });
      q.refinementPresets = r.active; q.priorityMuscleGroups = r.priority; q.auxiliaryMuscles = r.aux; q.movementLimitations = r.avoid;
      if (T.start.sex) q.gender = T.start.sex;
      q.includeDirectCore = r.core; q.repStyle = r.rep;
    }
    return q;
  }
  function trainStepLine(i) { return T.start.steps[i]; }

  /* ---------- Ionicons the screens use, as inline SVG ---------- */
  var IC = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    calF: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 2.5a1 1 0 0 1 1 1V5h6V3.5a1 1 0 1 1 2 0V5h1a3 3 0 0 1 3 3v1.5H3V8a3 3 0 0 1 3-3h1V3.5a1 1 0 0 1 1-1zM3 11h18v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/></svg>',
    calC: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 2.5a1 1 0 0 1 1 1V5h6V3.5a1 1 0 1 1 2 0V5h1a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h1V3.5a1 1 0 0 1 1-1zm-3 8V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5z"/></svg>',
    calN: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M10 12.5l2-1.5v6"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15z"/><path d="M5 19l8-8"/></svg>',
    speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4-4"/><circle cx="12" cy="13" r="1.3" fill="currentColor"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-4.3-3.6-6.5-4.4-10.3-2.3 1.5-3.4 3.6-3.1 6.1C9.6 9.7 9 8.5 9 7c-2 1.7-3.5 4.4-3.5 7.8C5.5 18.4 8 21 12 21z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM13.2 17h-2.4v-6h2.4z"/></svg>',
    infoO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4 4 9-9"/></svg>',
    bar: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="4.5" y="6.5" width="3.2" height="11" rx="1"/><rect x="7.7" y="11" width="8.6" height="2" rx="1"/><rect x="16.3" y="6.5" width="3.2" height="11" rx="1"/><rect x="20" y="9" width="3" height="6" rx="1"/></svg>',
    checkC: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 7.3-5.4 6.3a1 1 0 0 1-1.5.1l-2.6-2.6 1.4-1.4 1.8 1.8 4.8-5.5z"/></svg>',
    time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  };
  /** QuestionCard.tsx: icon box, title (with an optional pill), subtitle always shown, a check when picked (or `aside` on the right in both states). */
  function qcards(el, list, current, onPick) {
    el.insertAdjacentHTML('beforeend', '<div class="qcs rise" style="--i:3" role="radiogroup">' + list.map(function (o) {
      var on = current === o.v;
      return '<button type="button" class="qc" role="radio" data-v="' + esc(o.v) + '" aria-checked="' + on + '" aria-pressed="' + on + '"><span class="qi">' + o.icon + '</span><span class="qt"><span class="qr"><b>' + esc(o.l) + '</b>' + (o.badge ? '<em>' + esc(o.badge) + '</em>' : '') + '</span><small>' + esc(o.h) + '</small></span>' + (o.aside ? '<span class="qa">' + o.aside + '</span>' : '<span class="qk">' + IC.check + '</span>') + '</button>';
    }).join('') + '</div>');
    $$('.qc', el).forEach(function (b) {
      b.onclick = function () {
        $$('.qc', el).forEach(function (x) { var on = x === b; x.setAttribute('aria-pressed', on); x.setAttribute('aria-checked', on); });
        onPick(b.getAttribute('data-v'));
      };
    });
  }
  /** The CTA. */
  function trainCta(ok, onNext) { primary('Continue', onNext, !ok); }

  /* ---------- SessionLengthPanel.tsx, compact (Refinements) ---------- */
  /**
   * The live session length pinned above Continue on Refinements: block 1 of the
   * real build for the answers so far, and the change line. 250 ms after an answer
   * changes; the last result stays up, dimmed, until the new one lands, and the
   * pulsing dot shows once a build has taken a moment. o: { saved, answers(),
   * value(), kind }.
   */
  function sessionPanel(box, my, o) {
    var shown = null, timer = 0, run = 0;
    function draw(res, loading) {
      if (!res) { box.innerHTML = '<div class="slc"><div class="slr"><span>Sessions</span><em class="slv"><i class="pdot"></i><b>Working it out</b></em></div></div>'; return; }
      var est = res.est, AMB = '#fbbf24';
      var head = res.tone === 'ok' ? '#fff' : AMB;
      var dc = res.delta ? (res.delta.tone === 'longer' ? AMB : res.delta.tone === 'shorter' ? '#4ade80' : '#a1a1aa') : '';
      box.innerHTML = '<div class="slc"><div class="slr"><span>' + (res.repStyle === 'mix' ? 'Block 1 sessions' : 'Sessions') + '</span><em class="slv">' + (loading ? '<i class="pdot late"></i>' : '') + '<b class="' + (loading ? 'dim' : '') + '" style="color:' + head + '">About ' + est.headline + ' min</b></em></div>' +
        (res.delta ? '<p class="sld' + (loading ? ' dim' : '') + '" style="color:' + dc + '">' + esc(res.delta.text) + '</p>' : '') + '</div>';
    }
    function update() {
      var value = o.value();
      var id = ++run;
      if (shown) draw(shown.res, true); else draw(null);
      clearTimeout(timer);
      timer = setTimeout(function () {
        var delta = shown ? { kind: o.kind, prev: shown.value, prevAvg: shown.res.est.average } : null;
        tcall('sessionPanel', aboutForEngine(), o.saved, o.answers(), value, [], delta).then(function (res) {
          if (id !== run || my !== token || !res) return;
          if (shown && keyOf(shown.value) === keyOf(value) && !res.delta) res.delta = shown.res.delta;
          shown = { value: value, res: res };
          draw(res, false);
        }).catch(function () {});
      }, 250);
    }
    update();
    return update;
  }

  /* ---------- useSessionEstimates.ts ---------- */
  /**
   * Session estimates for several versions of the answers at once: Volume's
   * weekly time per tier, Days' minutes per day count. Each variant is the saved
   * answers + answersSoFar + its override, built as block 1 of the real
   * generator (the engine's sessionEstimate). They run one at a time, in the
   * order given (the picked one first), 250 ms after the list changes; a new list
   * stops the old run before its next build; results are kept by profile, so a
   * variant built before is instant. Returns read(saved, answers, variants) ->
   * { key: estimate | null }; onLand runs as each one lands.
   */
  var ESTS = {}, estRun = 0;
  function estimator(my, onLand) {
    var last = null;
    return function (saved, answers, variants) {
      var about = keyOf(aboutForEngine()), out = {}, missing = [];
      variants.forEach(function (v) {
        var k = keyOf([about, saved, answers, v.override]);
        out[v.key] = ESTS[k] || null;
        if (!ESTS[k]) missing.push({ v: v, k: k });
      });
      var list = keyOf([about, saved, answers, variants]);
      if (list !== last) {
        last = list;
        var id = ++estRun;
        if (missing.length) setTimeout(function () {
          (function step(i) {
            if (id !== estRun || my !== token || i >= missing.length) return;
            var m = missing[i];
            if (ESTS[m.k]) { step(i + 1); return; }
            tcall('sessionEstimate', aboutForEngine(), saved, answers, m.v.override).then(function (e) {
              if (e) ESTS[m.k] = e;
              if (id !== estRun || my !== token) return;
              if (e) onLand();
              step(i + 1);
            }, function () { if (id === estRun && my === token) step(i + 1); });
          })(0);
        }, 250);
      }
      return out;
    };
  }
  /** WorkingMotion.tsx's skeleton: a grey bar a highlight crosses while it builds. */
  function skel(cls) { return '<i class="sk ' + (cls || '') + '" aria-hidden="true"></i>'; }

  /* ---------- Q6: How hard should we push? (first since 24 Oct 2026) ---------- */
  var VOLUMES = [
    { v: '8-12', l: 'Conservative', h: 'Most of the growth, least time', icon: IC.leaf },
    { v: '12-16', l: 'Moderate', h: 'The best fit for most people', icon: IC.speed },
    { v: '16-20', l: 'High', h: 'A bit more growth, more time', icon: IC.flame },
  ];
  /** PlanInstruments VolumeCurve: an illustrative diminishing-returns curve, the pick's zone lit. */
  function volumeCurve(v) {
    var W = 320, H = 140, x0 = 18, x1 = 306, y0 = 16, y1 = 108;
    var X = function (s) { return x0 + (s / 24) * (x1 - x0); }, Y = function (s) { return y1 - (1 - Math.exp(-s / 8)) * (y1 - y0); };
    var path = function (a, b) { var d = ''; for (var t = a; t <= b + 0.001; t += 0.5) d += (d ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(t).toFixed(1); return d; };
    var Z = [['8-12', 8, 12], ['12-16', 12, 16], ['16-20', 16, 20]], sel = Z.filter(function (z) { return z[0] === v; })[0];
    return '<div class="icard"><svg class="vcurve" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + Z.map(function (z) {
      var on = sel && sel[0] === z[0];
      return '<rect x="' + X(z[1]) + '" y="' + y0 + '" width="' + (X(z[2]) - X(z[1]) - 2) + '" height="' + (y1 - y0) + '" rx="6" fill="' + (on ? 'var(--acc)' : '#18181b') + '" fill-opacity="' + (on ? 0.22 : 1) + '"/>';
    }).join('') + '<path d="' + path(0, 24) + '" stroke="#3f3f46" stroke-width="2.5" fill="none"/>' +
      (sel ? '<path d="' + path(sel[1], sel[2]) + '" stroke="var(--acc)" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="' + X((sel[1] + sel[2]) / 2) + '" cy="' + Y((sel[1] + sel[2]) / 2) + '" r="6" fill="var(--acc)"/>' : '') +
      [8, 12, 16, 20].map(function (t) { return '<text x="' + X(t) + '" y="' + (y1 + 16) + '" fill="#71717a" font-size="10.5" text-anchor="middle">' + t + '</text>'; }).join('') +
      '<text x="' + x0 + '" y="10" fill="#71717a" font-size="10">MORE GROWTH</text><text x="' + x1 + '" y="10" fill="#71717a" font-size="10" text-anchor="end">ILLUSTRATIVE</text>' +
      '<text x="' + ((x0 + x1) / 2) + '" y="' + (y1 + 31) + '" fill="#71717a" font-size="10" text-anchor="middle">SETS PER MUSCLE PER WEEK</text></svg></div>';
  }
  function rVolume(el, my) {
    withTrain(el, my, function (st) {
      // The saved answers when the screen opens (none yet from the finish line), and its answersSoFar.
      var saved = null, answers = {};
      withData(el, my, function () { return tcall('volumeLines', aboutForEngine(), saved, answers); }, '', function (VL) {
        var rec = st.recommendedVolume;
        // The recommended tier is picked when nothing is answered, so most people just tap Continue.
        if (!T.volume) T.volume = rec;
        head(el, trainStepLine(0), 'How hard should we <em>push?</em>', 'We’ve marked the one that fits you.');
        qcards(el, VOLUMES.map(function (o) {
          return { v: o.v, l: o.l, h: o.h, icon: o.icon, badge: o.v === rec ? 'For you' : null, aside: '<span class="qtime" data-t="' + o.v + '"></span>' };
        }), T.volume, function (v) { T.volume = v; enable(true); paint(); if (!$('#whyB', el).hidden) whyBody(); });
        el.insertAdjacentHTML('beforeend', '<div class="reas rise" style="--i:4"><span>' + IC.check + '</span><p>' + (st.rampsIn ? 'Your first two weeks start lighter, and you can change this any time.' : 'You can change this any time.') + '</p></div>' +
          '<button type="button" class="why rise" style="--i:4" id="whyV" aria-expanded="false">How we set this' + CHEV + '</button><div class="whyb" id="whyB" hidden></div>');
        function whyBody() {
          $('#whyB', el).innerHTML = volumeCurve(T.volume) +
            '<p class="lead">' + esc(st.volumeLabel[T.volume]) + ': ' + esc(VL.lines[T.volume].replace(/^Most/, 'most')) + '</p>' +
            '<p>Each extra set adds a little less growth than the one before. About 10 sets a week gives a muscle roughly two-thirds of what 20 would.</p>' +
            '<p>In one study of trained lifters, 12, 18 and 24 sets a week built about the same thigh muscle over 8 weeks, though other studies found more sets helped a little. High is for lifters who have stopped progressing on Moderate, and it needs the sleep and food to recover from.</p>' +
            '<p>A long session you skip or rush builds less than a shorter one you finish well. Next you’ll pick how many days to spread this over.</p>' +
            '<a class="whyl" href="/research/" target="_blank" rel="noopener">The research behind it</a>';
        }
        $('#whyV', el).onclick = function () { var b = $('#whyB', el), open = b.hidden; if (open) whyBody(); b.hidden = !open; this.setAttribute('aria-expanded', open); };
        // Each tier's weekly time at the days saved so far (4 before Days): the picked tier builds first.
        var read = estimator(my, function () { paint(); });
        function paint() {
          var order = [T.volume, rec].concat(VOLUMES.map(function (o) { return o.v; })).filter(function (v, k, a) { return a.indexOf(v) === k; });
          var ests = read(saved, answers, order.map(function (v) { return { key: v, override: { volumePreference: v, totalTrainingDays: st.volumeDays } }; }));
          $$('.qtime', el).forEach(function (t) {
            var e = ests[t.getAttribute('data-t')], html = e ? '<b>' + esc(e.hours) + '</b><small>a week</small>' : skel('skt') + '<small>a week</small>';
            if (t.getAttribute('data-h') !== (e ? e.hours : '')) { t.innerHTML = html; t.setAttribute('data-h', e ? e.hours : ''); }
            t.setAttribute('aria-label', e ? 'about ' + e.hours + ' a week' : 'Working out the time');
          });
        }
        paint();
        trainCta(!!T.volume, function () { if (!T.volume) return; go('days'); });
      });
    });
  }

  /* ---------- Q3: How many days a week? (second since 24 Oct 2026) ---------- */
  var LIMIT_NOTE_MS = 2600, UNDO_MS = 4000, SHOW_WORKING_MS = 120;
  var MON_FIRST = [1, 2, 3, 4, 5, 6, 0], DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function rDays(el, my) {
    withTrain(el, my, function (st) {
      if (!T.week) { tcall('weekFor', T.days).then(function (w) { if (my !== token) return; T.week = w; redrawTrain(el, my); }); return; }
      // What Volume saved, and the answers it passed on (DaysScreen's base and answersSoFar).
      var saved = savedThrough(1), answers = { volumePreference: T.volume };
      head(el, trainStepLine(1), 'How many days a <em>week?</em>', 'Your muscles grow the same from 2 days up. It’s only about how you like your week.');
      el.insertAdjacentHTML('beforeend', '<div class="dtiles rise" style="--i:2" role="radiogroup">' + st.dayOptions.map(function (n) {
        return '<button type="button" class="dt" data-v="' + n + '" role="radio"><b>' + n + '</b><span class="dm"></span></button>';
      }).join('') + '</div><div class="dscale rise" style="--i:2"><span>‹ Fewer, longer sessions</span><span>More, shorter ›</span></div>' +
        '<div class="dsc rise" style="--i:3" id="dsc"><i class="dsw" aria-hidden="true"></i>' +
        '<div class="dsh" id="dsh"></div>' +
        '<div class="dss"><span>a session · <span id="dvl"></span> · </span><button type="button" class="chg" id="chg">Change</button><span class="upd" id="upd" aria-hidden="true"><i class="pdot"></i><span></span></span></div>' +
        '<div class="dsl" id="dsl"></div>' +
        '<button type="button" class="each" id="each" aria-expanded="false"><span>See each day</span>' + CHEV + '</button><div class="dsb" id="dsb" hidden></div></div>' +
        '<div id="wkc" class="rise" style="--i:4"></div><p class="dlim" id="dlim" aria-live="polite">&nbsp;</p>');
      var C = { lastEst: null, lastLine: null, busy: false, working: false, wt: 0, prevHead: null, open: false, barsKey: '' };
      var read = estimator(my, function () { paint(); });
      var ests = {};
      function volLabel() { return st.volumeLabel[T.volume] || 'Moderate'; }
      // DaysScreen's one suggestion: fewest extra days under 90 min, else one step
      // less volume, else one more day if it saves enough. Null while what it needs builds.
      function line() {
        var sel = T.days, est = ests['d' + sel], down = st.lowerVolume[T.volume];
        if (!est) return null;
        if (est.average < st.longMin) return { kind: 'calm' };
        for (var n = sel + 1; n <= st.maxDays; n++) {
          var e = ests['d' + n];
          if (!e) return null;
          if (e.average < st.longMin) return { kind: 'suggest', strong: n + ' days', minutes: e.headline, act: 'days', n: n };
        }
        if (down) {
          if (!ests.down) return null;
          if (est.average - ests.down.average >= st.fixMinSaving) return { kind: 'suggest', strong: st.volumeLabel[down], minutes: ests.down.headline, act: 'down', v: down };
        }
        var nx = sel < st.maxDays ? ests['d' + (sel + 1)] : null;
        if (nx && est.average - nx.average >= st.fixMinSaving) return { kind: 'suggest', strong: (sel + 1) + ' days', minutes: nx.headline, act: 'days', n: sel + 1 };
        return { kind: 'long' };
      }
      function paint() {
        var sel = T.days, down = st.lowerVolume[T.volume];
        var byDistance = st.dayOptions.slice().sort(function (a, b) { return Math.abs(a - sel) - Math.abs(b - sel) || b - a; });
        var variants = byDistance.map(function (n) { return { key: 'd' + n, override: { totalTrainingDays: n, volumePreference: T.volume } }; });
        if (down) variants.splice(2, 0, { key: 'down', override: { totalTrainingDays: sel, volumePreference: down } });
        ests = read(saved, answers, variants);
        // The tiles: each count's minutes, a skeleton while it builds.
        $$('.dt', el).forEach(function (b) {
          var n = +b.getAttribute('data-v'), e = ests['d' + n], on = n === sel;
          b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on);
          b.setAttribute('aria-label', n + ' days a week' + (e ? ', about ' + e.headline + ' minutes a session' : ''));
          var m = $('.dm', b), h = e ? String(e.headline) : '';
          if (m.getAttribute('data-h') !== h || !m.firstChild) { m.innerHTML = e ? '<small>' + e.headline + 'm</small>' : skel('skd'); m.setAttribute('data-h', h); }
        });
        card();
        weekCard();
      }
      /** DaysSessionCard.tsx: one height while it updates; the last number and line stay up, faded, until new ones land. */
      function card() {
        var est = ests['d' + T.days] || null, ln = line();
        if (est) C.lastEst = est;
        if (ln) C.lastLine = ln;
        var shownEst = est || C.lastEst, shownLine = ln || C.lastLine, estBusy = !est, busy = estBusy || !ln;
        if (busy !== C.busy) {
          C.busy = busy; clearTimeout(C.wt);
          if (!busy) C.working = false;
          else C.wt = setTimeout(function () { if (my === token && C.busy) { C.working = true; card(); } }, SHOW_WORKING_MS);
        }
        var animating = C.working || !shownEst, box = $('#dsc', el);
        box.classList.toggle('working', animating);
        box.setAttribute('aria-label', shownEst ? 'About ' + shownEst.headline + ' minutes a session at ' + volLabel() + ' volume' : 'Working out your session length');
        // The number fades up when it changes.
        var hd = $('#dsh', el), headNow = est ? est.headline : null;
        if (shownEst) {
          var long = shownEst.average >= st.longMin;
          if (!hd.firstChild || hd.firstChild.tagName !== 'B' || (headNow != null && headNow !== C.prevHead)) {
            hd.innerHTML = '<b class="' + (headNow != null && !RM ? 'fade' : '') + '">About ' + shownEst.headline + ' min</b>';
          }
          hd.firstChild.style.color = long ? '#fbbf24' : '#fff';
          hd.firstChild.classList.toggle('held', C.working && estBusy);
        } else if (!hd.firstChild || hd.firstChild.tagName === 'B') hd.innerHTML = skel('skh');
        C.prevHead = headNow;
        $('#dvl', el).textContent = volLabel();
        $('#chg', el).setAttribute('aria-label', 'Change volume, now ' + volLabel());
        var upd = $('#upd', el); upd.classList.toggle('on', C.working); $('span', upd).textContent = estBusy ? 'Updating' : 'Checking';
        // The line under the number is always there.
        var L = $('#dsl', el), lkey = shownLine ? keyOf(shownLine) + busy : '';
        L.classList.toggle('held', C.working);
        if (L.getAttribute('data-k') !== lkey || !L.firstChild) {
          L.setAttribute('data-k', lkey);
          if (!shownLine) L.innerHTML = skel('skl');
          else if (shownLine.kind === 'calm') L.innerHTML = '<p class="dlr"><span class="ok">' + IC.checkC + '</span>A comfortable session length.</p>';
          else if (shownLine.kind === 'long') L.innerHTML = '<p class="dlr"><span class="amb">' + IC.time + '</span>A long session. The summary shows other ways to shorten it.</p>';
          else {
            L.innerHTML = '<button type="button" class="dlr sug" id="sug"' + (busy ? ' disabled' : '') + ' aria-label="Want shorter sessions? ' + esc(shownLine.strong) + ' brings it to about ' + shownLine.minutes + ' minutes"><span>Want shorter sessions? <b>' + esc(shownLine.strong) + '</b> brings it to about ' + shownLine.minutes + ' min.</span>' + IC.chev + '</button>';
            var s = shownLine;
            $('#sug', el).onclick = function () { if (s.act === 'down') lowerTo(s.v); else pickCount(s.n, true); };
          }
        }
        // "See each day": the split's bars, the only thing that changes the card's height.
        var eb = $('#each', el), bars = $('#dsb', el);
        eb.setAttribute('aria-expanded', C.open); $('span', eb).textContent = C.open ? 'Hide each day' : 'See each day';
        bars.hidden = !(C.open && shownEst);
        if (C.open && shownEst) {
          var scale = Math.max(120, Math.max.apply(null, shownEst.days.map(function (d) { return d.minutes; })));
          var names = shownEst.days.map(function (d) { return d.name; }).join('|');
          if (C.barsKey !== names + shownEst.days.length) {
            C.barsKey = names + shownEst.days.length;
            bars.innerHTML = shownEst.days.map(function (d) { return '<div class="slrow"><span class="n">' + esc(d.name) + '</span><span class="tr"><i style="width:0"></i></span><span class="m"></span></div>'; }).join('');
            bars.offsetWidth; // a new split's bars grow in from empty
          }
          $$('.slrow', bars).forEach(function (r, i) { var d = shownEst.days[i]; $('.tr i', r).style.width = Math.round(d.minutes / scale * 1000) / 10 + '%'; $('.m', r).textContent = d.minutes; });
          bars.classList.toggle('held', C.working && estBusy);
        }
      }
      function weekCard() {
        var shownDays = T.varies ? (st.spreads && st.spreads[T.days]) || [] : T.week || [];
        $('#wkc', el).innerHTML = '<div class="icard"><div class="cap"><span>Your week</span><b>' + esc(T.varies ? 'Any ' + T.days + ' days' : T.weekLabel || '') + '</b></div><div class="wkrow">' + MON_FIRST.map(function (dow) {
          var on = shownDays.indexOf(dow) > -1;
          return '<button type="button" class="wkd' + (on ? ' on' : '') + (T.varies ? ' loose' : '') + '" data-dow="' + dow + '" aria-pressed="' + on + '" aria-label="' + DOW_LONG[dow] + '"><span class="dw">' + DOW_SHORT[dow] + '</span><span class="dc">' + (T.varies ? '<i></i>' : on ? IC.bar : 'Rest') + '</span></button>';
        }).join('') + '</div><p class="disc">' + (T.varies ? 'Train whenever suits. The app learns your days.' : 'Tap a day to change it') + '</p></div>';
        $$('.wkd', el).forEach(function (b) { b.onclick = function () { toggleDay(+b.getAttribute('data-dow')); }; });
      }
      function relabel() {
        tcall('weekLabel', T.week, T.days).then(function (l) { if (my !== token) return; T.weekLabel = l; weekCard(); });
      }
      // Tapping a weekday adds or drops it and the count follows, within 2 to 6.
      var limT = 0;
      function limit(text) {
        var p = $('#dlim', el); p.textContent = text; p.classList.add('on');
        clearTimeout(limT); limT = setTimeout(function () { p.classList.remove('on'); }, LIMIT_NOTE_MS);
      }
      function toggleDay(dow) {
        tcall('toggleDay', T.week || [], dow).then(function (next) {
          if (my !== token) return;
          if (next.length < st.minDays) { limit('At least ' + st.minDays + ' days a week'); return; }
          if (next.length > st.maxDays) { limit('Up to ' + st.maxDays + ' days, so you keep a rest day'); return; }
          T.daysTouched = true; T.varies = false; T.week = next; T.days = next.length;
          paint(); relabel();
        });
      }
      function pickCount(n, fromSuggestion) {
        var prev = { days: T.days, week: T.week };
        T.daysTouched = true;
        T.days = n;
        tcall('weekFor', n).then(function (w) {
          if (my !== token) return;
          T.week = w; paint(); relabel();
          if (fromSuggestion) undoBar('Switched to ' + n + ' days', function () { T.days = prev.days; T.week = prev.week; paint(); relabel(); });
        });
      }
      // A lower volume is saved straight away, so Volume shows it on the way back.
      function lowerTo(v) {
        var prev = T.volume;
        T.volume = v; paint();
        undoBar('Switched to ' + st.volumeLabel[v], function () { T.volume = prev; paint(); });
      }
      var undoT = 0;
      function undoBar(text, run) {
        var u = $('.undo', el);
        if (!u) { el.insertAdjacentHTML('beforeend', '<div class="undo" role="status"><span></span><button type="button">Undo</button></div>'); u = $('.undo', el); }
        $('span', u).textContent = text;
        $('button', u).onclick = function () { clearTimeout(undoT); u.remove(); run(); };
        clearTimeout(undoT); undoT = setTimeout(function () { u.remove(); }, UNDO_MS);
      }
      $$('.dt', el).forEach(function (b) { b.onclick = function () { pickCount(+b.getAttribute('data-v')); }; });
      $('#each', el).onclick = function () { C.open = !C.open; card(); };
      // "Change" goes back to Volume, the screen before.
      $('#chg', el).onclick = function () { back(); };
      // The spreads "My days change week to week" shows (set on the summary in the app; kept here).
      if (T.varies && !st.spreads) {
        st.spreads = {};
        Promise.all(st.dayOptions.map(function (n) { return tcall('weekFor', n).then(function (w) { st.spreads[n] = w; }); })).then(function () { if (my === token) weekCard(); });
      }
      paint(); relabel();
      trainCta(!!T.days, function () {
        if (!T.days) return;
        T.weekSaved = { daysTouched: !!T.daysTouched, timeTouched: false, hadWeek: !!T.hadWeek, varies: !!T.varies, days: T.week, selected: T.days, time: T.time };
        go('length');
      });
    });
  }

  /* ---------- Q4: How long should it run? (third since 24 Oct 2026) ---------- */
  var LENGTHS = [
    { v: '4_weeks', l: '4 weeks', h: 'Quick reset. One block.', icon: IC.cal, w: 4 },
    { v: '8_weeks', l: '8 weeks', h: 'Real, measurable results.', icon: IC.calF, w: 8 },
    { v: '12_weeks', l: '12 weeks', h: 'A full progression cycle.', icon: IC.calC, w: 12 },
    { v: '6_months', l: '6 months', h: 'Several phases. Lasting change.', icon: IC.cal, w: 26 },
    { v: '1_year', l: '1 year', h: 'A full year, fully planned.', icon: IC.calN, w: 52 },
  ];
  /** PlanInstruments LengthTimeline: today to a year, filled to the pick. */
  function lengthTimeline(v) {
    var w = (LENGTHS.filter(function (x) { return x.v === v; })[0] || {}).w || 0;
    return '<div class="icard"><div class="cap"><span>From today</span><b>' + (w ? w + ' weeks' : '') + '</b></div><div class="ltrack">' + [4, 8, 12, 26].map(function (t) { return '<s style="left:' + (t / 52 * 100) + '%"></s>'; }).join('') +
      '<i style="width:' + (w / 52 * 100) + '%"></i></div><div class="tlbl"><span>TODAY</span><span>6 MO</span><span>1 YEAR</span></div></div>';
  }
  function rLength(el, my) {
    withTrain(el, my, function () {
      head(el, trainStepLine(2), 'How long should it <em>run?</em>', 'Longer programs build deeper adaptations.');
      el.insertAdjacentHTML('beforeend', '<div id="ltl" class="rise" style="--i:2">' + lengthTimeline(T.length) + '</div>');
      qcards(el, LENGTHS, T.length, function (v) {
        T.length = v; enable(true);
        var f = $('#ltl .ltrack i', el), c = $('#ltl .cap b', el), w = LENGTHS.filter(function (x) { return x.v === v; })[0].w;
        f.style.width = (w / 52 * 100) + '%'; c.textContent = w + ' weeks';
        $('#lnote', el).hidden = !(v === '6_months' || v === '1_year');
      });
      el.insertAdjacentHTML('beforeend', '<p class="tnote" id="lnote"' + (T.length === '6_months' || T.length === '1_year' ? '' : ' hidden') + '><span>' + IC.info + '</span>Long plans run as a series of training blocks, each one building on the last.</p>');
      trainCta(!!T.length, function () { if (!T.length) return; go('refine'); });
    });
  }
  function redrawTrain(el, my) { if (my === token) { el.innerHTML = ''; SCREENS[cur].r(el, my); } }

  /* ---------- Refinements: Want to refine further? ---------- */
  var PRIORITY = ['Chest', 'Lats', 'Upper Back', 'Traps', 'Front Delts', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
  var AUX_LOOKS = [{ v: 'neck', l: 'Neck' }, { v: 'forearms', l: 'Forearms' }, { v: 'obliques', l: 'Obliques' }, { v: 'serratus', l: 'Serratus' }];
  var AUX_STRENGTH = [{ v: 'lower_back', l: 'Lower back' }, { v: 'hip_abductors', l: 'Hip abductors' }, { v: 'hip_adductors', l: 'Hip adductors' }, { v: 'shins', l: 'Shins' }];
  var AVOID = ['Overhead pressing', 'Heavy squats', 'Heavy deadlifts', 'High-impact moves', 'Jumping & plyometrics', 'Inversions'];
  function countLabel(n) { return n === 0 ? 'none picked' : n + ' picked'; }
  function rRefine(el, my) {
    withTrain(el, my, function (st) {
      if (!T.refine) T.refine = { priority: [], aux: [], avoid: [], core: true, rep: 'classic', active: [], open: {} };
      var R = T.refine, saved = savedThrough(3);
      el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">Optional</p><h1 class="qh rise" style="--i:1">Want to refine <em>further?</em></h1><div id="rbody"></div><div class="slpin" id="slpin"></div>');
      var body = $('#rbody', el);
      function chips(list, picked, key) {
        return '<div class="rchips">' + list.map(function (o) { var v = o.v || o, l = o.l || o; return '<button type="button" class="rchip" data-g="' + key + '" data-v="' + esc(v) + '" aria-pressed="' + (picked.indexOf(v) > -1) + '">' + esc(l) + '</button>'; }).join('') + '</div>';
      }
      function group(key, label, n, inner) {
        return '<button type="button" class="rgrp" data-open-g="' + key + '" aria-expanded="' + !!R.open[key] + '"><span>' + label + '</span><small>' + countLabel(n) + '</small>' + CHEV + '</button>' + (R.open[key] ? inner : '');
      }
      function draw() {
        // A group with picks opens on its own.
        if (R.priority.length) R.open.priority = true;
        if (AUX_LOOKS.some(function (x) { return R.aux.indexOf(x.v) > -1; })) R.open.looks = true;
        if (AUX_STRENGTH.some(function (x) { return R.aux.indexOf(x.v) > -1; })) R.open.strength = true;
        if (R.avoid.length) R.open.avoid = true;
        var looksN = AUX_LOOKS.filter(function (o) { return R.aux.indexOf(o.v) > -1; }).length, strN = AUX_STRENGTH.filter(function (o) { return R.aux.indexOf(o.v) > -1; }).length;
        body.innerHTML = '<p class="rlab">Optimise for</p><div class="presets">' + st.presets.map(function (p) {
          var on = R.active.indexOf(p.id) > -1;
          return '<div class="preset' + (on ? ' on' : '') + '"><button type="button" class="pmain" data-preset="' + p.id + '" aria-pressed="' + on + '"><b>' + esc(p.label) + '</b><small>' + esc(p.description) + '</small></button><button type="button" class="pinfo" data-ev="' + p.id + '" aria-label="Evidence for ' + esc(p.label) + '">' + IC.infoO + '</button>' + (on ? '<span class="pchk">' + IC.check + '</span>' : '') + '</div>';
        }).join('') + '</div>' +
          '<p class="rlab">Rep style</p><p class="rlead">' + esc(st.repLead) + '</p><div class="reps">' + st.repStyles.map(function (o) {
            var on = R.rep === o.value;
            return '<button type="button" class="rep' + (on ? ' on' : '') + '" data-rep="' + o.value + '" role="radio" aria-checked="' + on + '"><span class="rtop"><b>' + esc(o.label) + '</b><em>' + esc(o.tag) + '</em><span class="rk">' + (on ? IC.check : '') + '</span></span>' +
              (on ? '<span class="rdet"><span><i class="acc">PROS</i>' + esc(o.pros) + '</span><span><i>CONS</i>' + esc(o.cons) + '</span></span>' : '') + '</button>';
          }).join('') + '<button type="button" class="rwhy" id="repWhy"><span>' + IC.infoO + '</span>Why</button></div>' +
          group('priority', 'More volume', R.priority.length, chips(PRIORITY, R.priority, 'priority')) +
          group('looks', 'Extra work · for looks', looksN, chips(AUX_LOOKS, R.aux, 'aux')) +
          group('strength', 'Extra work · for strength and injury prevention', strN, chips(AUX_STRENGTH, R.aux, 'aux')) +
          group('avoid', 'Avoid', R.avoid.length, chips(AVOID, R.avoid, 'avoid')) +
          '<div class="core"><span>Direct core work</span><button type="button" class="sw" id="coreSw" role="switch" aria-checked="' + R.core + '" aria-label="Direct core work"><i></i></button></div>';
        $$('[data-preset]', body).forEach(function (b) {
          b.onclick = function () {
            tcall('presetToggle', b.getAttribute('data-preset'), st.sexKey, { priorityMuscles: R.priority, auxiliaryMuscles: R.aux, includeDirectCore: R.core }).then(function (n) {
              R.priority = n.priorityMuscles; R.aux = n.auxiliaryMuscles; R.core = n.includeDirectCore; changed();
            });
          };
        });
        $$('[data-ev]', body).forEach(function (b) { b.onclick = function () { presetSheet(st, b.getAttribute('data-ev')); }; });
        $$('[data-rep]', body).forEach(function (b) { b.onclick = function () { R.rep = b.getAttribute('data-rep'); changed(); }; });
        $('#repWhy', body).onclick = function () { repProof(st); };
        $$('[data-open-g]', body).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-open-g'); R.open[k] = !R.open[k]; draw(); }; });
        $$('.rchip', body).forEach(function (b) {
          b.onclick = function () {
            var g = b.getAttribute('data-g'), v = b.getAttribute('data-v'), arr = g === 'priority' ? R.priority : g === 'aux' ? R.aux : R.avoid;
            var i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v);
            changed();
          };
        });
        $('#coreSw', body).onclick = function () { R.core = !R.core; changed(); };
      }
      function changed() {
        tcall('activePresets', st.sexKey, { priorityMuscles: R.priority, auxiliaryMuscles: R.aux }).then(function (ids) { R.active = ids; if (my === token) draw(); });
        draw(); panel();
      }
      var panel = sessionPanel($('#slpin', el), my, {
        kind: 'refine', compact: true, saved: saved, answers: function () { return saved; },
        value: function () { return { priorityMuscleGroups: R.priority.slice(), auxiliaryMuscles: R.aux.slice(), movementLimitations: R.avoid.slice(), includeDirectCore: R.core, repStyle: R.rep }; },
      });
      changed();
      primary('Continue', function () { go('progbuild'); });
    });
  }
  /** PresetEvidenceSheet.tsx: what the preset picks for this sex and why, then the studies. */
  var AUX_LABELS = { neck: 'Neck', forearms: 'Forearms', obliques: 'Obliques', serratus: 'Serratus', lower_back: 'Lower back', hip_abductors: 'Hip abductors', hip_adductors: 'Hip adductors', shins: 'Shins' };
  var GRADE = { strong: 'STRONG EVIDENCE', moderate: 'MODERATE EVIDENCE', weak: 'WEAK EVIDENCE' };
  var SEX_LINE = { male: 'Selections for men', female: 'Selections for women', unspecified: 'Selections when sex is not set' };
  function presetSheet(st, id) {
    var p = st.presets.filter(function (x) { return x.id === id; })[0], sel = p.selections[st.sexKey], n = p.studies.length;
    var picks = sel.priorityMuscles.map(function (m) { return { l: m, why: p.muscleRationale[m] }; }).concat(sel.auxiliaryMuscles.map(function (m) { return { l: AUX_LABELS[m] || m, why: p.muscleRationale[m] }; }));
    var one = '<p class="sh-ov acc">Preset · based on ' + n + ' ' + (n === 1 ? 'study' : 'studies') + '</p><h2 class="sh-t big">' + esc(p.label) + '</h2><p><span class="grade ' + p.evidenceGrade + '">' + GRADE[p.evidenceGrade] + '</span></p>' +
      p.summary.map(function (l) { return '<p class="sh-b">' + esc(l) + '</p>'; }).join('') + '<p class="ek2">' + SEX_LINE[st.sexKey] + '</p>' +
      picks.map(function (x) { return '<div class="ppick"><b>' + esc(x.l) + '</b>' + (x.why ? '<span>' + esc(x.why) + '</span>' : '') + '</div>'; }).join('') +
      '<button type="button" class="sh-more" data-more="1">Based on ' + n + ' ' + (n === 1 ? 'study' : 'studies') + '<span aria-hidden="true">›</span></button><button type="button" class="sh-go" data-close="1">Got it</button>';
    var two = '<button type="button" class="sh-back" data-less="1">‹ ' + esc(p.label) + '</button><p class="ek2">The studies</p>' + p.studies.map(function (s) {
      return '<a class="study" href="' + esc(s.url) + '" target="_blank" rel="noopener"><span class="sc">' + esc(s.authors) + ' (' + s.year + '). ' + esc(s.journal) + '.</span><b>' + esc(s.title) + '</b><span>' + esc(s.summary) + '</span>' +
        (s.supports.length ? '<small>Supports: ' + esc(s.supports.map(function (m) { return AUX_LABELS[m] || m; }).join(', ')) + '</small>' : '') + '</a>';
    }).join('') + (p.caveats.length ? '<p class="ek2">What it doesn’t tell you</p>' + p.caveats.map(function (c) { return '<p class="sh-b">' + esc(c) + '</p>'; }).join('') : '');
    pagedSheet(one, two);
  }
  /** RepStyleProofSheet: the shared proof sheet, limited to the rep style decisions. */
  function repProof(st) {
    var chip = function (c, long) { var l = st.confidenceLabel[c]; return '<span class="conf ' + c + '">' + esc((long && c !== 'estimate' ? l + ' evidence' : l).toUpperCase()) + '</span>'; };
    var src = function (d) { var c = d.sources.map(function (s) { return s.cite; }); return c.length > 2 ? c.slice(0, 2).join(' · ') + ' · and more' : c.join(' · '); };
    var list = '<p class="sh-ov acc">Rep style</p><h2 class="sh-t big">Why any rep<br>range works.</h2>' + st.repEvidence.map(function (d, k) {
      return '<button type="button" class="pdec" data-dec="' + k + '"><span class="pt"><b>' + esc(d.title) + '</b>' + chip(d.confidence) + '</span><span class="pw">' + esc(d.why) + '</span><small>' + esc(src(d)) + '</small></button>';
    }).join('') + '<button type="button" class="sh-ghost" data-close="1">Got it</button>';
    var page = function (k) {
      var d = st.repEvidence[k];
      return '<button type="button" class="sh-back" data-less="1">‹ Back</button><p class="sh-ov acc">Why</p><h2 class="sh-t">' + esc(d.title) + '</h2><p class="sh-b">' + esc(d.why) + '</p><p class="ek2">What the studies found</p><p class="sh-b">' + esc(d.found) + '</p>' +
        d.sources.map(function (s) { return '<a class="study" href="' + esc(s.url) + '" target="_blank" rel="noopener"><b>' + esc(s.cite) + '</b><span>' + esc(s.journal + ' · ' + s.design) + (s.checked === 'secondary' ? ' · abstract not available, from press coverage' : '') + '</span></a>'; }).join('') +
        (d.forYou ? '<div class="fy"><p class="ek2">For you</p><p class="sh-b">' + esc(d.forYou) + '</p></div>' : '') + '<p>' + chip(d.confidence, true) + '</p><button type="button" class="sh-ghost" data-close="1">Got it</button>';
    };
    openSheet('<div class="evs">' + list + '</div>', function (sh) {
      var box = $('.evs', sh);
      var wire = function () {
        $$('[data-dec]', box).forEach(function (b) { b.onclick = function () { box.innerHTML = page(+b.getAttribute('data-dec')); wire(); }; });
        var l = $('[data-less]', box); if (l) l.onclick = function () { box.innerHTML = list; wire(); };
        $$('[data-close]', box).forEach(function (b) { b.onclick = function () { closeSheet(); }; });
      };
      wire();
    });
  }
  function pagedSheet(one, two) {
    openSheet('<div class="evs">' + one + '</div>', function (sh) {
      var box = $('.evs', sh);
      var wire = function () {
        var m = $('[data-more]', box), l = $('[data-less]', box);
        if (m) m.onclick = function () { box.innerHTML = two; wire(); };
        if (l) l.onclick = function () { box.innerHTML = one; wire(); };
        $$('[data-close]', box).forEach(function (b) { b.onclick = function () { closeSheet(); }; });
      };
      wire();
    });
  }

  /* ---------- WorkoutBuildScreen ---------- */
  var LENGTH_WORDS = { '4_weeks': '4 weeks', '8_weeks': '8 weeks', '12_weeks': '12 weeks', '6_months': '6 months', '1_year': '1 year' };
  function needProgram() {
    return Promise.all([loadIndex(), needTrain()]).then(function () {
      var saved = savedThrough(4), k = keyOf([aboutForEngine(), saved, T.weekSaved]);
      if (S.programKey === k && S.program) return S.program;
      return tcall('buildProgramFrom', aboutForEngine(), saved, T.weekSaved).then(function (p) { S.program = p; S.programKey = k; T.landed = false; T.log = 0; return p; });
    });
  }
  /** Exercise start frames, in the app's default (cyan) theme. */
  function exSrc(name) { var slug = EXINDEX && EXINDEX[name]; return slug ? '/images/exercises/' + slug + '/blue/start.webp' : null; }
  function exImg(name) { var s = exSrc(name); return s ? '<img src="' + s + '" alt="" loading="lazy" decoding="async" width="112" height="112">' : ''; }
  function rProgBuild(el, my) {
    // Act 1's line under "Building your program." is the answers it reads (WorkoutBuildScreen profileLine).
    var sub = [T.days ? T.days + ' days a week' : null, LENGTH_WORDS[T.length]].filter(Boolean).join(' · ');
    buildMoment(el, my, {
      word: 'your program.', sub: sub,
      work: needProgram,
      over: function (P) { return P.program.routine_name; },
      steps: function (P) { return P.view.steps; },
      visual: function (P) {
        var dl = P.view.deloads.length ? 'deload ' + (P.view.deloads.length === 1 ? 'week' : 'weeks') + ' ' + P.view.deloads.join(', ') : '';
        return '<p class="note" style="margin:0 0 10px">Week 1' + (P.view.weeks > 1 ? ' of ' + P.view.weeks : '') + (dl ? ' · ' + dl : '') + '</p><div class="drows">' + P.view.days.map(function (d) {
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

  /* ---------- The Workouts tab (HomeScreen), the program just landed ---------- */
  function sectionHead(label, link, id) { return '<div class="shd"><span>' + esc(label) + '</span>' + (link ? '<button type="button" class="shl"' + (id ? ' id="' + id + '"' : '') + '>' + esc(link) + '</button>' : '') + '</div>'; }
  function rProgram(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needProgram, 'Building your program…', function (P) {
        var V = P.views, card = V.blockCard, nx = V.hero.next;
        var segs = (V.weekDays || V.sessions.length);
        el.innerHTML = '<p class="dline rise" style="--i:0"><button type="button" id="dateLn">' + esc(V.dateLine) + '</button></p><h1 class="wtitle rise" style="--i:0">Workouts</h1>' +
          '<button type="button" class="hero rise" style="--i:1" id="heroBtn"><span class="hbg">' + exImg(nx.first) + '</span><span class="hsg">' + Array.apply(null, Array(segs)).map(function () { return '<i></i>'; }).join('') + '</span>' +
          '<span class="hbt"><span class="htd"><b>' + esc(V.hero.label.toUpperCase()) + '</b>' + (V.hero.pill ? '<em>' + esc(V.hero.pill) + '</em>' : '') + '</span><span class="hnm">' + esc(nx.name) + '</span><span class="hpl">' + esc(V.name) + '</span><span class="hmt">' + nx.exercises + ' ' + (nx.exercises === 1 ? 'exercise' : 'exercises') + ' · ' + sessionLen(nx.minutes) + '</span></span><span class="hplay" id="playBtn"><svg viewBox="0 0 24 24" width="24" height="24" fill="#0a0a0b"><path d="M8 5.5v13l11-6.5z"/></svg></span></button>' +
          '<div class="rise" style="--i:2">' + sectionHead('This week · 0 of ' + V.sessions.length, V.weekLink) + '<div class="scards">' + V.sessions.map(function (s, i) {
            var ring = s.kind === 'today' || s.kind === 'now' || s.kind === 'next';
            return '<button type="button" class="scard' + (ring ? ' ring' : '') + '" data-log="' + i + '"><span class="si">' + (exImg(s.first) || IC.bar) + '</span><span class="sl">' + esc(s.label || '') + '</span><b>' + esc(s.name) + '</b></button>';
          }).join('') + '</div></div>' +
          (card ? '<div class="rise" style="--i:3">' + sectionHead('Your block') + '<button type="button" class="bcard" id="bcard"><span class="bct"><b>' + esc(card.title) + '</b>' + (card.deloadLine ? '<em>' + esc(card.deloadLine) + '</em>' : '') + '</span><span class="bsegs">' + card.segments.map(function (g) {
            return '<i class="' + g.state + (g.deload ? ' dl' : '') + '"></i>';
          }).join('') + '</span>' + (card.muscles.length ? '<span class="bov">Focus muscles · sets this week</span>' + card.muscles.map(function (m) {
            var t = m.target || 0;
            return '<span class="bmr"><span>' + esc(m.label) + '</span><span class="bmb"><i style="width:' + (t ? Math.min(100, m.done / t * 100) : 0) + '%"></i></span><span class="bmv">' + fmtSets(m.done) + ' / ' + (m.target == null ? '–' : fmtSets(m.target)) + '</span></span>';
          }).join('') : '') + '</button></div>' : '') +
          '<div class="rise" style="--i:4">' + sectionHead('Your plans', '+ New plan', 'newPlan') + '<button type="button" class="prow" id="planRow"><span class="pth">' + exImg(nx.first) + '</span><span class="ptx"><i>CURRENT</i><b>' + esc(V.name) + '</b><small>' + esc(V.plansSub) + '</small><span class="pbar"><s style="width:' + (100 / V.totalWeeks) + '%"></s></span></span></button></div>' +
''; // the app's theme tip and its later cards (last session, getting stronger) need logged workouts
        if (!T.landed) { T.landed = true; toast(el, 'Added to Workouts'); }
        $('#heroBtn', el).onclick = function (e) { if (e.target.closest('#playBtn')) { T.log = 0; go('session'); return; } go('blocks'); };
        $('#planRow', el).onclick = function () { go('blocks'); };
        $('#dateLn', el).onclick = function () { go('trainweek'); };
        if ($('#bcard', el)) $('#bcard', el).onclick = function () { go('trainweek'); };
        $$('[data-log]', el).forEach(function (b) { b.onclick = function () { T.log = +b.getAttribute('data-log'); go('session'); }; });
        primary('Continue', function () { go('traindone'); });
      });
    });
  }
  /** WorkoutCover formatSessionLength: "about 55 min", from two hours "about 2 h". */
  function sessionLen(min) { if (min == null) return ''; if (min < 120) return 'about ' + Math.round(min / 5) * 5 + ' min'; var h = Math.round(min / 30) / 2; return 'about ' + h + ' h'; }
  function fmtSets(n) { return String(Math.round(n * 2) / 2); }
  function toast(el, text) {
    if (RM || root.classList.contains('still')) return;
    var t = document.createElement('div'); t.className = 'ttoast'; t.innerHTML = '<span>' + IC.check + '</span>' + esc(text);
    el.appendChild(t); setTimeout(function () { t.classList.add('off'); }, 2200); setTimeout(function () { t.remove(); }, 2700);
  }

  /* ---------- BlocksScreen ---------- */
  function rBlocks(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needProgram, '', function (P) {
        var V = P.views, B = V.blocks;
        el.innerHTML = '<div class="pcover rise" style="--i:0"><span class="pci">' + exImg(V.hero.next.first) + '</span><span class="pco"><span class="ov">' + esc(B.overline) + '</span><b>' + esc(V.name) + '</b><span class="pbar"><s style="width:' + (B.fill * 100) + '%"></s></span><small>' + esc(B.meta) + '</small></span></div>' +
          '<div class="rise" style="--i:1">' +
          '<button type="button" class="proofr" id="pBuilt"><span class="pb">' + IC.check + '</span><span><b>How this was built</b><small>The research behind your sets and rests</small></span>' + IC.chev + '</button>' +
          '<button type="button" class="proofr" id="pRep"><span class="pb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg></span><span><b>Rep style</b><small>' + esc(B.repStyleSub) + '</small></span>' + IC.chev + '</button></div>' +
          '<div class="brows rise" style="--i:2">' + B.rows.map(function (r, i) {
            return '<button type="button" class="brow' + (r.current ? ' cur' : '') + '" data-blk="' + i + '"' + (r.current ? '' : ' disabled') + '><span class="ov">' + esc(r.overline) + '</span><b>' + esc(r.title) + '</b><small>' + esc(r.meta) + '</small>' + (r.current ? IC.chev : '') + '</button>';
          }).join('') + '</div>' +
          '<p class="note">In the app you can also add a block, rebuild from Your setup, and open later blocks as you reach them.</p>';
        $('#pBuilt', el).onclick = function () { builtProof(B.proof); };
        $('#pRep', el).onclick = function () { repStyleSheet(B); };
        $$('[data-blk]', el).forEach(function (b) { b.onclick = function () { go('trainweek'); }; });
        primary('Open this week', function () { go('trainweek'); });
      });
    });
  }
  /** ProofSheet for area 'training', the Blocks screen's "How this was built". */
  function builtProof(pr) {
    var rows = pr.featured.length ? pr.featured : pr.all;
    proofSheet('How your training was built', 'Why these<br>sets and rests.', rows, pr.all.length > rows.length ? pr.all : null);
  }
  function proofSheet(over, headHtml, rows, allRows) {
    var st = T.start;
    var chip = function (c, long) { var l = st.confidenceLabel[c]; return '<span class="conf ' + c + '">' + esc((long && c !== 'estimate' ? l + ' evidence' : l).toUpperCase()) + '</span>'; };
    var src = function (d) { var c = d.sources.map(function (s) { return s.cite; }); return c.length > 2 ? c.slice(0, 2).join(' · ') + ' · and more' : c.join(' · '); };
    var shown = rows;
    var list = function () {
      return '<p class="sh-ov acc">' + esc(over) + '</p><h2 class="sh-t big">' + headHtml + '</h2>' + shown.map(function (d, k) {
        return '<button type="button" class="pdec" data-dec="' + k + '"><span class="pt"><b>' + esc(d.title) + '</b>' + chip(d.confidence) + '</span><span class="pw">' + esc(d.why) + '</span><small>' + esc(src(d)) + '</small></button>';
      }).join('') + (allRows && shown !== allRows ? '<button type="button" class="sh-more" data-all="1">Show all ' + allRows.length + ' decisions<span aria-hidden="true">›</span></button>' : '') + '<button type="button" class="sh-ghost" data-close="1">Got it</button>';
    };
    var page = function (k) {
      var d = shown[k];
      return '<button type="button" class="sh-back" data-less="1">‹ Back</button><p class="sh-ov acc">Why</p><h2 class="sh-t">' + esc(d.title) + '</h2><p class="sh-b">' + esc(d.why) + '</p><p class="ek2">What the studies found</p><p class="sh-b">' + esc(d.found) + '</p>' +
        d.sources.map(function (s) { return '<a class="study" href="' + esc(s.url) + '" target="_blank" rel="noopener"><b>' + esc(s.cite) + '</b><span>' + esc(s.journal + ' · ' + s.design) + (s.checked === 'secondary' ? ' · abstract not available, from press coverage' : '') + '</span></a>'; }).join('') +
        (d.forYou ? '<div class="fy"><p class="ek2">For you</p><p class="sh-b">' + esc(d.forYou) + '</p></div>' : '') + '<p>' + chip(d.confidence, true) + '</p><button type="button" class="sh-ghost" data-close="1">Got it</button>';
    };
    openSheet('<div class="evs">' + list() + '</div>', function (sh) {
      var box = $('.evs', sh);
      var wire = function () {
        $$('[data-dec]', box).forEach(function (b) { b.onclick = function () { box.innerHTML = page(+b.getAttribute('data-dec')); wire(); }; });
        var l = $('[data-less]', box); if (l) l.onclick = function () { box.innerHTML = list(); wire(); };
        var a = $('[data-all]', box); if (a) a.onclick = function () { shown = allRows; box.innerHTML = list(); wire(); };
        $$('[data-close]', box).forEach(function (b) { b.onclick = function () { closeSheet(); }; });
      };
      wire();
    });
  }
  /** RepStylePlanRow's sheet: the style for later blocks (view only here: nothing is saved on this page). */
  function repStyleSheet(B) {
    var st = T.start, cur = T.refine ? T.refine.rep : 'classic';
    openSheet('<p class="sh-ov acc">Applies from your next block</p><h2 class="sh-t big">Rep style</h2><p class="sh-b">' + esc(st.repLead) + '</p><div class="reps">' + st.repStyles.map(function (o) {
      var on = cur === o.value;
      return '<div class="rep' + (on ? ' on' : '') + '"><span class="rtop"><b>' + esc(o.label) + '</b><em>' + esc(o.tag) + '</em><span class="rk">' + (on ? IC.check : '') + '</span></span>' + (on ? '<span class="rdet"><span><i class="acc">PROS</i>' + esc(o.pros) + '</span><span><i>CONS</i>' + esc(o.cons) + '</span></span>' : '') + '</div>';
    }).join('') + '</div><p class="sh-lede">' + (B.laterBlock ? 'Your current block stays as it is. The change starts at block ' + B.laterBlock + '.' : 'This plan has no later block, so it applies to your next plan.') + '</p><button type="button" class="sh-ghost" data-close="1">Got it</button>', function (sh) {
      $('[data-close]', sh).onclick = function () { closeSheet(); };
    });
  }

  /* ---------- DaysScreen: the block's week ---------- */
  function rTrainWeek(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needProgram, '', function (P) {
        var Wk = P.views.week, days = Wk.days.filter(function (d) { return !d.rest; });
        var next = days[0], rest = days.slice(1);
        var workIdx = function (d) { return Wk.days.filter(function (x) { return !x.rest; }).indexOf(d); };
        el.innerHTML = '<p class="ov rise" style="--i:0">' + esc(Wk.label) + '</p><h1 class="wkh rise" style="--i:0">Week ' + Wk.week + '<span> of ' + Wk.of + '</span></h1>' +
          (Wk.deload ? '<p class="wbadge amb">DELOAD WEEK</p><p class="wsub">Reduced volume, recover and back off</p>' : '') +
          (Wk.ramp ? '<p class="wbadge">EASING IN</p><p class="wsub">Lighter week ' + (Wk.rampWeeks.indexOf(Wk.week) + 1) + ' of ' + Wk.rampWeeks.length + ' while you ease in. Full sets from week ' + (Math.max.apply(null, Wk.rampWeeks) + 1) + '.</p>' : '') +
          '<p class="wcount rise" style="--i:1"><b>0</b> OF ' + Wk.workouts + ' DONE THIS WEEK</p>' +
          '<div class="wstrip rise" style="--i:1">' + Array.apply(null, Array(Wk.of)).map(function (_, i) {
            var w = i + 1, dl = Wk.deloads.indexOf(w) > -1;
            return '<span class="wc' + (w === Wk.week ? ' cur' : '') + '"><b class="' + (dl ? 'dl' : '') + '">W' + w + '</b><span>' + days.map(function () { return '<i></i>'; }).join('') + '</span></span>';
          }).join('') + '</div>' +
          '<button type="button" class="nexth rise" style="--i:2" data-day="' + workIdx(next) + '"><span class="nhi">' + exImg(next.first) + '</span><span class="nhc"><span class="nchips"><em>UP NEXT</em><em class="g">DAY ' + next.pos + ' OF ' + Wk.days.length + '</em></span><b>' + esc(next.name) + '</b><span class="nmu">' + esc(next.muscles.join(' · ')) + '</span><span class="nmt">' + next.exercises + ' ' + (next.exercises === 1 ? 'exercise' : 'exercises') + ' · ~' + next.minutes + ' min</span><span class="nst">Start workout</span></span></button>' +
          '<div class="rise" style="--i:3">' + sectionHead('Coming up', rest.length + ' ' + (rest.length === 1 ? 'day' : 'days') + ' left') + rest.map(function (d) {
            return '<button type="button" class="drw" data-day="' + workIdx(d) + '"><span class="dth">' + (exImg(d.first) || workIdx(d) + 1) + '</span><span><b>' + esc(d.name) + '</b><small>' + d.exercises + ' ' + (d.exercises === 1 ? 'exercise' : 'exercises') + ' · ~' + d.minutes + ' min</small></span>' + IC.chev + '</button>';
          }).join('') + '</div>';
        $$('.shd .shl', el).forEach(function (b) { b.disabled = true; });
        $$('[data-day]', el).forEach(function (b) { b.onclick = function () { T.log = +b.getAttribute('data-day'); go('session'); }; });
        primary('Start workout', function () { T.log = workIdx(next); go('session'); });
      });
    });
  }

  /* ---------- WorkoutLog, before Start ---------- */
  function rSession(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needProgram, '', function (P) {
        var L = P.views.logs[T.log || 0] || P.views.logs[0], exs = L.exercises, W = P.views.week.week;
        el.innerHTML = '<div class="xticks rise" style="--i:0">' + exs.map(function (_, i) { return '<i' + (i === 0 ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' +
          '<div class="xpager rise" style="--i:0" id="xpager">' + exs.map(function (e, i) {
            return '<article class="xcard"><div class="xim">' + (exImg(e.name) || '<span class="xno">' + IC.bar + 'No preview</span>') + '<button type="button" class="xmore" data-menu="' + i + '" aria-label="More">⋯</button></div>' +
              '<p class="xov">' + e.sets + ' × ' + esc(e.reps) + (e.rirSummary ? ' · ' + esc(e.rirSummary) : '') + ' · WEEK ' + W + '</p><h2 class="xnm">' + esc(e.name) + '</h2><p class="xmu">' + esc(e.muscles.join(' · ')) + '</p>' +
              (e.cue ? '<button type="button" class="xcue" data-cue="' + i + '"><i></i><span>' + esc(e.cue.quickCue) + '</span>' + IC.chev + '</button>' : '') +
              '<div class="xsets"><div class="xh"><span>SET</span><span>KG</span><span>REPS</span><span>✓</span></div>' + e.rirSets.map(function (r, k) {
                var reps = String(e.reps).split(',')[k];
                return '<div class="xr"><span class="n">' + (k + 1) + '</span><span class="in"></span><span class="in"><em>' + esc((reps || '').trim()) + '</em></span><span class="ck"></span>' + (r != null ? '<span class="rir">RIR ' + esc(r) + '</span>' : '') + '</div>';
              }).join('') + '</div></article>';
          }).join('') + '</div>' +
          '<div class="rise" style="--i:1"><p class="ov upn">Up next</p>' + exs.map(function (e, i) {
            var sup = e.superset && exs[i + 1] && exs[i + 1].superset === e.superset;
            return '<button type="button" class="upc' + (i === 0 ? ' cur' : '') + '" data-up="' + i + '"><span class="ut">' + exImg(e.name) + '</span><span><b>' + esc(e.name) + '</b><small>' + e.sets + ' × ' + esc(e.reps) + '</small></span>' + (i === 0 ? '<em>CURRENT</em>' : '') + '</button>' + (sup ? '<p class="ssup">SUPERSET</p>' : '');
          }).join('') + '</div><p class="note">Logging sets, the rest timer and your weights live in the app.</p>';
        var pager = $('#xpager', el), ticks = $$('.xticks i', el), ups = $$('.upc', el);
        var at = function (i) {
          ticks.forEach(function (t, k) { t.className = k === i ? 'on' : k < i ? 'done' : ''; });
          ups.forEach(function (u, k) { u.classList.toggle('cur', k === i); var em = u.querySelector('em'); if (em) em.remove(); if (k === i) u.insertAdjacentHTML('beforeend', '<em>CURRENT</em>'); });
        };
        pager.addEventListener('scroll', function () { at(Math.round(pager.scrollLeft / pager.clientWidth)); }, { passive: true });
        $$('[data-up]', el).forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-up'); pager.scrollTo({ left: i * pager.clientWidth, behavior: RM ? 'auto' : 'smooth' }); at(i); window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); }; });
        $$('[data-cue]', el).forEach(function (b) { b.onclick = function () { cueSheet(exs[+b.getAttribute('data-cue')]); }; });
        $$('[data-menu]', el).forEach(function (b) { b.onclick = function () { exMenu(L, exs[+b.getAttribute('data-menu')], W); }; });
        primary('Start Workout', function () { paceSheet(L, P.views.pace); });
      });
    });
  }
  /** ExerciseCueModal: "How to do it". */
  function cueSheet(e) {
    var c = e.cue, steps = function (l) { return '<ol class="cst">' + l.map(function (s, i) { return '<li><b>' + (i + 1) + '</b><span>' + esc(s) + '</span></li>'; }).join('') + '</ol>'; };
    openSheet('<div class="cueh">' + exImg(e.name) + '</div><p class="sh-ov acc">How to do it</p><h2 class="sh-t big">' + esc(e.name) + '</h2><p class="sh-lede">' + esc(c.target) + '</p><p class="sh-b">' + esc(c.quickCue) + '</p>' +
      (c.why ? '<p class="ek2">Why it’s done this way</p><p class="sh-b">' + esc(c.why) + '</p>' : '') +
      '<p class="ek2">Setup</p>' + steps(c.setup) + '<p class="ek2">Execution</p>' + steps(c.execution) +
      '<p class="ek2">What it should feel like</p><p class="sh-b">' + esc(c.feel) + '</p><p class="ek2">Watch out for</p><p class="sh-b wo">' + esc(c.mistake) + '</p>' +
      '<a class="sh-ghost sh-link" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(e.name + ' technique') + '" target="_blank" rel="noopener">Watch a technique video</a>', function () {});
  }
  /** The exercise's ⋯ menu: the two sheets that explain the numbers. */
  function exMenu(L, e, W) {
    openSheet('<p class="sh-ov">' + esc(L.name + ' · ' + e.name) + '</p><button type="button" class="mrow" data-m="scheme">Rep scheme</button>' + (e.cue ? '<button type="button" class="mrow" data-m="cue">How to do it</button>' : '') + '<button type="button" class="mrow" data-m="how">How the app works</button>', function (sh) {
      $$('[data-m]', sh).forEach(function (b) {
        b.onclick = function () { var m = b.getAttribute('data-m'); if (m === 'scheme') schemeSheet(e, W); else if (m === 'cue') cueSheet(e); else howSheet(); };
      });
    });
  }
  /** RepSchemeModal: this week's reps and sets, and every week's reps and RIR. */
  function rirFeel(r) { var s = String(r || '').trim(); if (!s || s.indexOf(',') > -1) return ''; if (s === '0') return 'To failure'; if (s === '0-1') return 'Near failure'; if (s === '1') return '1 rep left'; return /^\d+$/.test(s) ? s + ' reps left' : ''; }
  function schemeSheet(e, W) {
    var weeks = Object.keys(e.repsWeekly).map(Number).sort(function (a, b) { return a - b; });
    openSheet('<p class="sh-ov acc">Rep scheme · week ' + W + '</p><h2 class="sh-t">' + esc(e.name) + '</h2><div class="tiles2"><span><small>TARGET REPS</small><b>' + esc(e.reps) + '</b></span><span><small>SETS</small><b>' + e.sets + '</b></span></div>' +
      '<p class="ek2">RIR progression</p><div class="rtab"><div class="rth"><span>WEEK</span><span>REPS</span><span>RIR</span><span>FEEL</span></div>' + weeks.map(function (w) {
        return '<div class="rtr' + (w === W ? ' cur' : '') + '"><span>' + w + '</span><span>' + esc(e.repsWeekly[w] || '–') + '</span><span>' + esc(e.rirWeekly[w] || '–') + '</span><span>' + esc(rirFeel(e.rirWeekly[w])) + '</span></div>';
      }).join('') + '</div><p class="sh-src">RIR = reps in reserve. How many reps you could still do before failure. Lower RIR means you’re closer to failure and lifting harder.</p><button type="button" class="sh-go" data-close="1">Got it</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
  }
  /** HowItWorksModal. */
  function howSheet() {
    var sec = function (n, t, b) { return '<div class="hw"><p class="ek2">' + n + '</p><b>' + t + '</b><p class="sh-b">' + b + '</p></div>'; };
    openSheet('<p class="sh-ov acc">How the app works</p><h2 class="sh-t big">You pick the weight.<br><span class="mut">We set the target.</span></h2><p class="sh-lede">Your plan gives you a rep target and an RIR target for every set. You choose the weight. Here is how to make those numbers work for you.</p>' +
      sec('01', 'Picking your weight', 'The app never sets your weight, because only you know what you can lift on the day. For each set, pick a load that lets you hit the rep target at the listed RIR. If a movement is new to you, start lighter than you think and build up. The first session is just for finding your numbers.') +
      sec('02', 'What is RIR?', 'RIR means reps in reserve. It is how many more reps you could have done before failing. So RIR 2 means you stopped with about two clean reps still in the tank, and RIR 0 means you took the set all the way to failure. A lower number means you pushed closer to your limit, so the set was harder.') +
      '<div class="meter">' + [['4', 'Easy'], ['3', 'Light'], ['2', 'Working'], ['1', 'Hard'], ['0', 'Failure']].map(function (x, i) { return '<span style="--k:' + i + '"><b>' + x[0] + '</b><small>' + x[1] + '</small></span>'; }).join('') + '</div><p class="sh-lede">The number on top is the RIR. The word under it is roughly how the set should feel.</p>' +
      sec('03', 'When to add weight', 'Hold the same weight until you can hit every rep target at the prescribed RIR with clean form. Once a weight feels under control across all of your sets, nudge it up a little next time. Earn the jump before you take it. Adding load too early just buries your reps and your technique.') +
      sec('04', 'Week to week', 'Across a block the rep targets usually come down, and the RIR target comes down with them. Fewer reps at a lower RIR means you are grinding closer to failure, which is the signal that the weight is ready to move up.') +
      '<div class="sh-src"><b>FOR EXAMPLE</b><br>Week one asks for 10 reps at RIR 2 on the curl and you get 9. You fell a rep short, so you hold the weight. Week two asks for 8 reps at RIR 1. That same weight will feel easier at 8 reps, so now you have earned the right to push it up. Keep the effort high and let the numbers guide the load.</div>' +
      sec('05', 'Blocks', 'A block is a run of weeks that build on each other. You open a block with a weight you can manage, then chase the shifting rep and RIR targets until it ends. The next block resets to fresh targets, ideally with you a little stronger than where you started.') +
      '<button type="button" class="sh-go" data-close="1">Got it</button>', function (sh) { $('[data-close]', sh).onclick = function () { closeSheet(); }; });
  }
  /** RestPaceSheet: Start Workout asks how long to rest, with each pace's minutes. */
  function paceSheet(L, PC) {
    var pick = 'moderate', clock = function (m) { var d = new Date(Date.now() + m * 60000); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    var view = function () {
      return '<p class="sh-ov acc">Rest pace · ' + esc(L.name) + ' <button type="button" class="pinfo2" data-info="1">What these mean</button></p><h2 class="sh-t big">How long do you<br>want to rest?</h2>' + PC.explainers.map(function (x) {
        var on = pick === x.pace;
        return '<button type="button" class="pace' + (on ? ' on' : '') + '" data-pace="' + x.pace + '"><span><b>' + esc(x.label) + '</b><small>' + esc(x.body) + '</small></span><span class="pm"><b>' + L.paces[x.pace] + ' min</b><small>done ' + esc(clock(L.paces[x.pace])) + '</small></span></button>';
      }).join('') + '<button type="button" class="sh-go" data-start="1">Start workout · ' + L.paces[pick] + ' min</button><p class="sh-lede" style="margin-top:12px;text-align:center">Logging the workout happens in the app.</p>';
    };
    var info = function () {
      return '<button type="button" class="sh-back" data-less="1">‹ Rest pace</button><h2 class="sh-t">What the paces mean</h2>' + PC.explainers.map(function (x) { return '<p class="sh-b"><b>' + esc(x.label) + '</b><br>' + esc(x.body) + '</p>'; }).join('') +
        '<p class="sh-b">' + esc(PC.footer) + '</p><p class="sh-lede">' + esc(PC.switchNote) + '</p><p class="ek2">References</p>' + PC.refs.map(function (r) { return '<a class="study" href="' + esc(r.url) + '" target="_blank" rel="noopener"><b>' + esc(r.cite) + '</b><span>' + esc(r.topic) + ' · ' + esc(r.journal) + '</span></a>'; }).join('');
    };
    var same = L.paces.optimal === L.paces.moderate && L.paces.moderate === L.paces.minimal;
    if (same) { go('traindone'); return; }
    openSheet('<div class="evs">' + view() + '</div>', function (sh) {
      var box = $('.evs', sh);
      var wire = function () {
        $$('[data-pace]', box).forEach(function (b) { b.onclick = function () { pick = b.getAttribute('data-pace'); box.innerHTML = view(); wire(); }; });
        var i = $('[data-info]', box); if (i) i.onclick = function () { box.innerHTML = info(); wire(); };
        var l = $('[data-less]', box); if (l) l.onclick = function () { box.innerHTML = view(); wire(); };
        var s = $('[data-start]', box); if (s) s.onclick = function () { closeSheet(); go('traindone'); };
      };
      wire();
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

  /* ================= leave ================= */
  document.getElementById('exitBtn').onclick = function () {
    var leave = function () { location.href = '/'; };
    if (SCREENS[cur] && SCREENS[cur].id === 'keep') { leave(); return; }
    openSheet('<div class="cf"><h2 class="sh-t c">Leave your plan?</h2><p class="sh-b c">Nothing is saved on this page, so you would start again next time.</p>' +
      '<button type="button" class="sh-go" data-a="stay">Keep going</button><button type="button" class="sh-sec" data-a="leave">Leave</button></div>', function (sh) {
      $('[data-a="stay"]', sh).onclick = function () { closeSheet(); };
      $('[data-a="leave"]', sh).onclick = leave;
    });
  };

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
            S.about = { sex: 'female', ageYears: 36, heightCm: 166, weightKg: 72, bodyFatPct: 32, bodyFatSource: 'reported', goalWeightKg: 64, goalBodyFatPct: 25, trainingState: 'new', activityLevel: 'light', route: 'lean' };
            S.touched = { goalWeightKg: true, goalBodyFatPct: true, heightCm: true, bodyFatPct: true };
            S.food = Object.assign(freshFood(), { dietType: 'high_protein', dietPattern: 'vegetarian', allergies: ['Nuts'], keepLower: ['salt'], mealsPerDay: 3, snackFrequency: '1', dessertFrequency: 'once_per_week', dessertDays: [6], slowCooker: 'none', blender: 'no', freezerTubs: 8, shopCadence: 'weekly', stockUp: false });
            Object.assign(S.training, { days: 3, length: '8_weeks', volume: '8-12', refine: { priority: ['Glutes'], aux: [], avoid: [], core: true, rep: 'classic', active: [], open: {} } });
          });
        }
      : function () {
          return ensureAbout().then(function () {
            var a = S.about; a.sex = 'male'; a.trainingState = 'consistent'; a.activityLevel = 'light';
            S.food = Object.assign(freshFood(), demo === '3' ? { allergies: ['Gluten/Wheat', 'Dairy'], skip: ['mushrooms'], keepLower: ['salt'], snacks: { ticked: null, own: [{ name: 'Protein bar', kcal: 210, protein: 20, serve: '1 bar', kind: 'snack' }] } } : {}, { dietType: 'balanced', dietPattern: 'any', keepLower: demo === '3' ? ['salt'] : [], mealsPerDay: 3, snackFrequency: '2', dessertFrequency: 'few_per_week', dessertDays: [2, 4, 6], slowCooker: '5_6l', blender: 'yes', freezerTubs: 16, shopCadence: 'weekly', stockUp: false });
            Object.assign(S.training, { days: 4, length: '12_weeks', volume: '12-16' });
          });
        };
    // Past the workout build, the demo's plan is built first, as the finish line orders it (training, then meals).
    var planFirst = function () { return target > IDX.progbuild && !params.get('noplan') ? needProgram() : null; };
    fill().then(function () { if (params.get('route')) S.about.route = params.get('route'); return planFirst(); }).then(function () { for (var k = 0; k < target; k++) if (!SCREENS[k].build) stack.push(k); show(target, 0); }, function (e) { stage.innerHTML = errBox(e.message); });
  } else {
    show(0, 0);
  }
})();
