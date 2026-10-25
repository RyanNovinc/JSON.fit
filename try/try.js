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

  /* ================= engines (Web Worker) ================= */
  var worker = null, seq = 0, pending = {};
  function startWorker() {
    if (worker) return;
    try { worker = new Worker('engines.min.js'); } catch (e) { worker = null; return; }
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
    { id: 'weight', sec: 'route', r: rWeight },
    { id: 'sex', sec: 'route', r: rSex },
    { id: 'bodyfat', sec: 'route', r: rBodyFat },
    { id: 'height', sec: 'route', r: rHeight },
    { id: 'age', sec: 'route', r: rAge },
    { id: 'lifting', sec: 'route', r: rLifting },
    { id: 'goalweight', sec: 'route', r: rGoalWeight },
    { id: 'goalbf', sec: 'route', r: rGoalBf },
    { id: 'route', sec: 'route', r: rRouteChoice },
    { id: 'active', sec: 'route', r: rActive },
    { id: 'sessions', sec: 'route', r: rSessions },
    { id: 'routebuild', sec: 'route', r: rRouteBuild, build: true },
    { id: 'routereveal', sec: 'route', r: rRouteReveal },
    { id: 'phase1', sec: 'route', r: rPhase1 },
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
    document.getElementById('segLbl').textContent = SEC_NAME[s.sec] || '';
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
  function next() { var i = cur + 1; while (SCREENS[i] && SCREENS[i].side) i++; go(i); }
  function back() {
    if (!stack.length) return;
    var i = stack.pop();
    if (i < 0) i = 0;
    while (SCREENS[i] && SCREENS[i].build && i > 0) i--; // never land back on a build
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
  /** Single choice that moves on by itself, as the app's option screens do. */
  function autoNext(my) { setTimeout(function () { if (my === token) next(); }, RM ? 60 : 260); }

  /* ---------- the ruler (the app's ScaleRuler) ---------- */
  function ruler(el, o) {
    // o: min, max, step, px (px per unit), major (label every), value, fmt(value) for labels, onChange(v)
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
    ticks.style.background = 'repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 2px,transparent 2px ' + majorPx + 'px) 0 0/100% 34px no-repeat,repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 1.5px,transparent 1.5px ' + minorPx + 'px) 0 12px/100% 22px no-repeat';
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
    sc.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); api.set(val + o.step, true); o.onChange(val, false); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); api.set(val - o.step, true); o.onChange(val, false); }
    });
    var api = { set: function (v, smooth) { val = snap(v); sc.setAttribute('aria-valuenow', val); place(val, smooth); }, get: function () { return val; } };
    return api;
  }
  /** A number beat: label, the big number (type to edit), the ruler, and plus/minus. */
  function numBeat(el, o) {
    el.classList.add('beat');
    el.insertAdjacentHTML('beforeend', '<p class="ov rise" style="--i:0">' + o.label + '</p>' + (o.q ? '<h1 class="qh rise" style="--i:1;font-size:clamp(1.5rem,6vw,2rem)">' + o.q + '</h1>' : '') +
      (o.units ? '<div class="unit-tog rise" style="--i:1" role="group" aria-label="Units"><button type="button" data-u="metric" aria-pressed="' + (S.units === 'metric') + '">' + o.units[0] + '</button><button type="button" data-u="imperial" aria-pressed="' + (S.units === 'imperial') + '">' + o.units[1] + '</button></div>' : '') +
      '<div class="big rise" style="--i:2">' + (o.readout ? '<span class="ro" aria-live="polite"></span>' : '<input type="text" inputmode="decimal" aria-label="' + esc(o.aria) + '">') + '<span class="u">' + esc(o.unit) + '</span></div><p class="delta rise" style="--i:2"></p>');
    var input = $('.big input', el), ro = $('.big .ro', el), delta = $('.delta', el);
    var show = function (v) { if (input) { input.value = o.disp ? o.disp(v) : v; input.style.width = (String(input.value).length * 0.62 + 0.2) + 'em'; } if (ro) ro.textContent = o.disp ? o.disp(v) : v; if (o.delta) delta.textContent = o.delta(v); };
    show(o.value);
    var r = ruler(el, { min: o.min, max: o.max, step: o.step, px: o.px, major: o.major, tick: o.tick, fmt: o.fmt, value: o.value, aria: o.aria, onChange: function (v) { show(v); o.onChange(v); } });
    el.insertAdjacentHTML('beforeend', '<div class="pm rise" style="--i:4"><button type="button" data-d="-1" aria-label="Less">−</button><button type="button" data-d="1" aria-label="More">+</button></div>');
    $$('.pm button', el).forEach(function (b) {
      b.onclick = function () { var v = r.get() + (+b.getAttribute('data-d')) * (o.bump || o.step); r.set(v, true); show(r.get()); o.onChange(r.get()); };
    });
    if (input) {
      input.addEventListener('change', function () {
        var v = parseFloat(String(input.value).replace(',', '.'));
        if (!isFinite(v)) { show(r.get()); return; }
        r.set(o.parse ? o.parse(v) : v, true); show(r.get()); o.onChange(r.get());
      });
      input.addEventListener('focus', function () { input.select(); });
    }
    $$('.unit-tog button', el).forEach(function (b) { b.onclick = function () { S.units = b.getAttribute('data-u'); SCREENS[cur].r(rerender(el), token); }; });
    return { ruler: r, show: show };
  }
  function rerender(el) { el.innerHTML = ''; el.className = 'screen'; return el; }

  /* ================= intro ================= */
  function rStart(el) {
    el.classList.add('start');
    el.innerHTML = '<p class="ov rise" style="--i:0;color:#22d3ee">Try JSON.fit</p>' +
      '<h1 class="qh rise" style="--i:1">See your plan<br><em style="color:#c084fc;text-transform:none">in 60 seconds.</em></h1>' +
      '<p class="sub rise" style="--i:2">No sign-up. Answer a few questions, then watch the app’s engines build your route, your week of meals and your training.</p>' +
      '<div class="rise" style="--i:3"><span class="privacy"><i></i>Runs on this page. Nothing you enter is sent anywhere.</span></div>' +
      '<div class="trio rise" style="--i:4"><div><i style="background:rgba(192,132,252,.14);color:#c084fc">01</i><p><b>Your route</b><span>Your goal, your phases, your daily macros.</span></p></div>' +
      '<div><i style="background:rgba(74,222,128,.14);color:#4ade80">02</i><p><b>Your food</b><span>A week of meals, one cook day, one shop.</span></p></div>' +
      '<div><i style="background:rgba(34,211,238,.14);color:#22d3ee">03</i><p><b>Your training</b><span>Sets, reps, rest and how hard to push.</span></p></div></div>';
    primary('Start', function () { startWorker(); ensureAbout().then(function () { go('weight'); }, function (e) { el.insertAdjacentHTML('beforeend', errBox(e.message)); }); });
    startWorker();
  }

  /* ================= about you (RouteScreen beats) ================= */
  function ensureAbout() {
    if (S.about) return Promise.resolve();
    return call('defaults', 'male').then(function (d) {
      S.defaults = d;
      S.about = {
        sex: null, ageYears: d.ageYears, heightCm: d.heightCm, weightKg: d.weightKg, bodyFatPct: d.bodyFatPct, bodyFatSource: 'visual',
        goalWeightKg: d.goalWeightKg, goalBodyFatPct: d.goalBodyFatPct, trainingState: null, activityLevel: null, trainingSessionsPerWeek: null, route: 'lean',
      };
    });
  }
  function needAbout(el, my, fn) {
    if (S.about) { fn(); return; }
    el.innerHTML = '<div class="loading"><div class="spin"></div></div>';
    ensureAbout().then(function () { if (my === token) { el.innerHTML = ''; fn(); } });
  }
  var imp = function () { return S.units === 'imperial'; };
  function rWeight(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      numBeat(el, {
        label: 'Current weight', aria: 'Current weight', units: ['kg', 'lbs'], unit: imp() ? 'lbs' : 'kg',
        value: imp() ? Math.round(kgToLb(a.weightKg)) : r1(a.weightKg), min: imp() ? 77 : 35, max: imp() ? 440 : 200, step: imp() ? 1 : 0.1, tick: imp() ? 1 : 0.5, px: imp() ? 6 : 13, major: imp() ? 10 : 5,
        disp: function (v) { return imp() ? v : v.toFixed(1); },
        onChange: function (v) { a.weightKg = imp() ? v / 2.20462 : v; S.touched.weightKg = true; },
      });
      primary('Continue');
    });
  }
  function rSex(el, my) {
    needAbout(el, my, function () {
      head(el, 'Sex', 'What’s your sex?', 'Sets your energy needs and the body fat ranges.');
      cards(el, [{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }], S.about.sex, function (v) {
        var changed = S.about.sex !== v; S.about.sex = v; enable(true);
        (changed ? refreshForSex() : Promise.resolve()).then(function () { autoNext(my); });
      });
      primary('Continue', null, !S.about.sex);
    });
  }
  /** Seeds that follow sex until touched (RouteScreen: heightSeed, placeholderBodyFat, defaultGoalBodyFatFor). */
  function refreshForSex() {
    var a = S.about, t = S.touched;
    return call('defaults', a.sex).then(function (d) {
      S.defaults = d;
      if (!t.heightCm) a.heightCm = d.heightCm;
      if (!t.bodyFatPct) a.bodyFatPct = d.bodyFatPct;
      if (!t.goalBodyFatPct) a.goalBodyFatPct = d.goalBodyFatPct;
    });
  }
  function rBodyFat(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      var b = numBeat(el, {
        label: 'Current body fat', aria: 'Current body fat', unit: '%', value: a.bodyFatPct, min: 5, max: 45, step: 0.5, px: 14, major: 5,
        onChange: function (v) { a.bodyFatPct = v; a.bodyFatSource = 'reported'; S.touched.bodyFatPct = true; },
      });
      el.insertAdjacentHTML('beforeend', '<p class="rise" style="--i:5;text-align:center"><span style="color:var(--text-2)">Not sure? </span><button type="button" class="linkb" id="est">Estimate it</button></p>');
      $('#est', el).onclick = function () {
        var d = S.defaults;
        openSheet('<p class="ov">Body fat</p><h2 class="qh" style="font-size:1.8rem">Pick the closest.</h2><p class="sub">A rough match is fine. Lands within a few points for most people.</p><div class="opts">' +
          d.tiers.map(function (t, i) {
            var range = i === d.tiers.length - 1 ? t.range[0] + '%+' : t.range[0] + '–' + t.range[1] + '%';
            return '<button type="button" class="opt" data-tier="' + t.pct + '" aria-pressed="' + (a.bodyFatSource === 'visual' && a.bodyFatPct === t.pct) + '"><b>' + range + '</b><small>' + esc(t.description) + '</small></button>';
          }).join('') + '</div>', function (sh) {
          $$('[data-tier]', sh).forEach(function (x) {
            x.onclick = function () {
              a.bodyFatPct = +x.getAttribute('data-tier'); a.bodyFatSource = 'visual'; S.touched.bodyFatPct = true;
              $$('[data-tier]', sh).forEach(function (y) { y.setAttribute('aria-pressed', y === x ? 'true' : 'false'); });
              setTimeout(function () { closeSheet(); b.ruler.set(a.bodyFatPct, true); b.show(a.bodyFatPct); }, 220);
            };
          });
        });
      };
      primary('Continue');
    });
  }
  function rHeight(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      var inch = function (cm) { return Math.round(cm / 2.54); };
      var ftin = function (i) { return Math.floor(i / 12) + '′' + (i % 12) + '″'; };
      numBeat(el, {
        label: 'Height', aria: 'Height', units: ['cm', 'ft in'], unit: imp() ? '' : 'cm', readout: imp(),
        value: imp() ? inch(a.heightCm) : Math.round(a.heightCm), min: imp() ? 48 : 120, max: imp() ? 86 : 220, step: 1, px: imp() ? 14 : 9, major: imp() ? 12 : 10,
        fmt: imp() ? function (v) { return Math.floor(v / 12) + '′'; } : null, disp: imp() ? ftin : null,
        onChange: function (v) { a.heightCm = imp() ? v * 2.54 : v; S.touched.heightCm = true; },
      });
      primary('Continue');
    });
  }
  function rAge(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      numBeat(el, { label: 'Age', aria: 'Age', unit: 'years', value: a.ageYears, min: 16, max: 100, step: 1, px: 14, major: 5, onChange: function (v) { a.ageYears = v; } });
      el.insertAdjacentHTML('beforeend', '<p class="note rise" style="--i:5;text-align:center">Sets your calorie targets when you build a meal plan.</p>');
      primary('Continue');
    });
  }
  var LIFT = [
    { v: 'new', l: 'Just starting', h: 'New to lifting, or under a year in' },
    { v: 'returning', l: 'Coming back', h: 'Trained before, had time off' },
    { v: 'consistent', l: 'In the groove', h: 'Training regularly and still progressing' },
    { v: 'advanced', l: 'Advanced', h: 'Years of hard, structured training. Gains come slowly now' },
  ];
  function rLifting(el, my) {
    needAbout(el, my, function () {
      head(el, 'Experience', 'Where are you with lifting?');
      cards(el, LIFT, S.about.trainingState, function (v) { S.about.trainingState = v; enable(true); autoNext(my); });
      primary('Continue', null, !S.about.trainingState);
    });
  }
  function rGoalWeight(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      var draw = function () {
        numBeat(el, {
          label: 'Goal weight', aria: 'Goal weight', q: 'Where do you want to end up?', unit: imp() ? 'lbs' : 'kg',
          value: imp() ? Math.round(kgToLb(a.goalWeightKg)) : Math.round(a.goalWeightKg * 2) / 2, min: imp() ? 77 : 35, max: imp() ? 440 : 200, step: imp() ? 1 : 0.5, tick: imp() ? 1 : 0.5, px: imp() ? 6 : 13, major: imp() ? 10 : 5,
          disp: function (v) { return imp() ? v : v.toFixed(1); },
          delta: function (v) {
            var kg = imp() ? v / 2.20462 : v, d = kg - a.weightKg;
            if (Math.abs(d) < 0.05) return 'the same as you weigh now';
            return (d > 0 ? '+' : '−') + (imp() ? Math.round(kgToLb(Math.abs(d))) + ' lbs' : Math.abs(d).toFixed(1) + ' kg') + ' from where you are now';
          },
          onChange: function (v) { a.goalWeightKg = imp() ? v / 2.20462 : v; S.touched.goalWeightKg = true; },
        });
        el.insertAdjacentHTML('beforeend', '<p class="note rise" style="--i:5;text-align:center">You set the goal. The app works out how to get there.</p>');
      };
      if (S.touched.goalWeightKg) { draw(); primary('Continue'); return; }
      // RouteScreen's default goal weight, at the goal body fat for this sex.
      call('goalWeightAt', a.sex || 'male', a.heightCm, a.weightKg, a.goalBodyFatPct).then(function (w) { a.goalWeightKg = w; }, function () {}).then(function () { if (my === token) { draw(); primary('Continue'); } });
    });
  }
  function rGoalBf(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      numBeat(el, { label: 'Goal body fat', aria: 'Goal body fat', q: 'How lean do you want to be?', unit: '%', value: a.goalBodyFatPct, min: 5, max: 45, step: 0.5, px: 14, major: 5, onChange: function (v) { a.goalBodyFatPct = v; S.touched.goalBodyFatPct = true; } });
      primary('Continue');
    });
  }
  var ROUTES = [
    { v: 'lean', l: 'Stay lean the whole way' },
    { v: 'bulk', l: 'Grow now, cut at the end' },
    { v: 'capped', l: 'Grow now, up to a limit' },
  ];
  var CUT_WORDS = ['No cuts', 'One cut', 'Two cuts', 'Three cuts', 'Four cuts', 'Five cuts', 'Six cuts'];
  function routeLine(id, o) {
    if (id === 'lean') return o && o.opensWithCut ? 'More defined and a sharper jawline, but a smaller frame while you get there.' : 'More defined the whole way, and never a long stretch of being soft.';
    if (id === 'bulk') return 'Bigger sooner and filling out shirts, but softer the whole way.';
    return 'Bigger sooner without going past a number you pick, but cutting back each time you get there.';
  }
  function aboutForEngine() { var a = S.about; return Object.assign({}, a, { sex: a.sex || 'male', trainingState: a.trainingState || 'consistent', activityLevel: a.activityLevel || 'light', trainingSessionsPerWeek: a.trainingSessionsPerWeek == null ? 3.5 : a.trainingSessionsPerWeek }); }
  function rRouteChoice(el, my) {
    needAbout(el, my, function () {
      var a = S.about;
      head(el, 'How you get there', 'Do you want to stay lean while you grow?', 'You are at ' + r1(a.bodyFatPct) + '% body fat today. All three finish at ' + r1(a.goalBodyFatPct) + '%.');
      var draw = function () {
        var o = S.routeOpts || {};
        cards(el, ROUTES.map(function (x) { var oo = o[x.v]; return { v: x.v, l: x.l, h: routeLine(x.v, oo) + (oo ? ' ' + CUT_WORDS[Math.min(6, oo.cuts)] + '.' : '') }; }), a.route, function (v) { a.route = v; });
      };
      var k = keyOf([a.sex, a.ageYears, a.heightCm, a.weightKg, a.bodyFatPct, a.goalWeightKg, a.goalBodyFatPct, a.trainingState]);
      if (S.routeOptsKey === k) draw();
      else call('routeOptions', aboutForEngine()).then(function (o) { S.routeOpts = o; S.routeOptsKey = k; }, function () {}).then(function () { if (my === token) draw(); });
      primary('Continue');
    });
  }
  var ACTIVE = [
    { v: 'sedentary', l: 'Mostly sitting', h: 'Desk work, driving, not much walking' },
    { v: 'light', l: 'On my feet a bit', h: 'Some walking through the day' },
    { v: 'moderate', l: 'On my feet a lot', h: 'Teaching, retail, hospitality' },
    { v: 'heavy', l: 'Physical work', h: 'Trades, warehouse, nursing' },
    { v: 'extreme', l: 'Hard physical work', h: 'Labouring all day, every day' },
  ];
  function rActive(el, my) {
    needAbout(el, my, function () {
      head(el, 'Your day', 'How active are you outside the gym?', 'Work, errands, getting around. Your sessions are the next question, so leave them out here.');
      cards(el, ACTIVE, S.about.activityLevel, function (v) { S.about.activityLevel = v; enable(true); autoNext(my); });
      primary('Continue', null, !S.about.activityLevel);
    });
  }
  function rSessions(el, my) {
    needAbout(el, my, function () {
      head(el, 'Your training', 'How much do you train?', 'Structured sessions: lifting, classes, sport.');
      cards(el, S.defaults.trainingBands.map(function (b) { return { v: b.value, l: b.label, h: b.hint }; }), S.about.trainingSessionsPerWeek, function (v) { S.about.trainingSessionsPerWeek = v; enable(true); });
      primary('Build my route', function () { go('routebuild'); }, S.about.trainingSessionsPerWeek == null);
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

  /* ---------- route ---------- */
  function needRoute() {
    var k = keyOf(aboutForEngine());
    if (S.routeKey === k && S.route) return Promise.resolve(S.route);
    return call('buildRoute', aboutForEngine()).then(function (r) { S.route = r; S.routeKey = k; return r; });
  }
  function chart(r, animated) {
    var c = r.curve; if (!c || !c.points || c.points.length < 2) return '';
    var pts = c.points, nodes = c.nodes, T = c.totalMonths || 1;
    var bfs = pts.map(function (p) { return p.bodyFatPct; });
    var hi = Math.max.apply(null, bfs), lo = Math.min.apply(null, bfs);
    if (hi - lo < 2) { hi += 1; lo -= 1; }
    var X0 = 24, X1 = 416, Y0 = 26, Y1 = 138;
    var x = function (m) { return X0 + (m / T) * (X1 - X0); };
    var y = function (b) { return Y1 - ((b - lo) / (hi - lo)) * (Y1 - Y0); };
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.month).toFixed(1) + ' ' + y(p.bodyFatPct).toFixed(1); }).join(' ');
    var gl = '', used = [];
    [nodes[0].bodyFatPct, nodes[nodes.length - 1].bodyFatPct, hi, lo].forEach(function (b) {
      var yy = y(b); if (used.some(function (u) { return Math.abs(u - yy) < 16; })) return; used.push(yy);
      gl += '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="g"/><text x="' + (X1 + 10) + '" y="' + (yy + 3).toFixed(1) + '" class="ax">' + r1(b) + '%</text>';
    });
    var dots = nodes.map(function (n, i) {
      var last = i === nodes.length - 1;
      return '<circle style="--d:' + (n.month / T).toFixed(2) + '" cx="' + x(n.month).toFixed(1) + '" cy="' + y(n.bodyFatPct).toFixed(1) + '" r="' + (i === 0 || last ? 5 : 3) + '" class="' + (last ? 'end' : 'pt') + '"/>';
    }).join('');
    var labels = '';
    for (var i = 1; i < nodes.length; i++) {
      var a = x(nodes[i - 1].month), b = x(nodes[i].month), k = nodes[i].kind, lx = (a + b) / 2, anchor = '';
      if (b - a < 34) { if (i !== nodes.length - 1) continue; lx = X1; anchor = ';text-anchor:end'; }
      var cls = k === 'trim' ? 'pl t' : k === 'reveal' ? 'pl r' : k === 'recomp' ? 'pl x' : 'pl';
      labels += '<text x="' + lx.toFixed(1) + '" y="170" class="' + cls + '" style="--d:' + (nodes[i].month / T).toFixed(2) + anchor + '">' + (SHORT[k] || '') + '</text>';
    }
    var end = nodes[nodes.length - 1], ex = x(end.month), ey = y(end.bodyFatPct);
    var goal = fmtW(S.about.goalWeightKg), pw = goal.length * 7 + 16;
    var pillX = Math.min(ex - pw / 2, X1 - pw + 8), pillY = ey > 110 ? ey - 32 : ey + 10;
    var sy = y(nodes[0].bodyFatPct);
    return '<svg class="rchart" viewBox="0 0 450 180" role="img" aria-label="Your route: body fat from ' + r1(nodes[0].bodyFatPct) + '% to ' + r1(end.bodyFatPct) + '% over about ' + Math.round(T) + ' months">' +
      '<defs><linearGradient id="rfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a855f7" stop-opacity=".28"/><stop offset="1" stop-color="#a855f7" stop-opacity="0"/></linearGradient></defs>' +
      gl + '<path class="ar" d="' + d + ' L' + X1 + ' 150 L' + X0 + ' 150 Z" fill="url(#rfill)"/><path d="' + d + '" class="ln" pathLength="1"/>' + dots +
      '<text style="--d:0" x="' + (X0 + 8) + '" y="' + (sy > 40 ? sy - 10 : sy + 18).toFixed(1) + '" class="nl">' + esc(fmtW(S.about.weightKg)) + '</text>' +
      '<rect style="--d:1" x="' + pillX.toFixed(1) + '" y="' + pillY.toFixed(1) + '" width="' + pw + '" height="20" rx="10" class="endpill"/><text style="--d:1" x="' + (pillX + pw / 2).toFixed(1) + '" y="' + (pillY + 14).toFixed(1) + '" class="nl c">' + esc(goal) + '</text>' +
      labels + '</svg>';
  }
  function kindsLine(r) {
    var seen = [], out = [];
    r.phases.forEach(function (p) { var w = KIND[p.kind] || p.kind; if (out[out.length - 1] !== w) out.push(w); });
    return out.join(', ');
  }
  function rRouteBuild(el, my) {
    var a = S.about;
    buildMoment(el, my, {
      word: 'your route.', sub: fmtW(a.weightKg) + ' → ' + fmtW(a.goalWeightKg) + ' at ' + r1(a.goalBodyFatPct) + '%',
      work: needRoute,
      over: function () { return 'Your route to your goal'; },
      steps: function (r) {
        return [
          { label: 'Reading your body', value: fmtW(a.weightKg) + ' · ' + r1(a.bodyFatPct) + '%' },
          { label: 'Setting your goal', value: fmtW(a.goalWeightKg) + ' at ' + r1(a.goalBodyFatPct) + '%' },
          { label: 'Working out your phases', value: kindsLine(r) },
          { label: 'Timing each phase', value: years(r.roadmap.estYears) },
          { label: 'Setting phase 1 macros', value: r.macros ? n0(r.macros.calories) + ' kcal' : '' , count: r.macros ? { to: r.macros.calories, suffix: ' kcal' } : null },
        ];
      },
      visual: function () { return '<div class="rvis" style="min-height:120px"></div>'; },
      onStep: function (i, r, box) { if (i === 2) $('.rvis', box).innerHTML = chart(r); },
      done: function () { replaceWith('routereveal'); },
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
  function rRouteReveal(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needRoute, 'Planning your route…', function (r) {
        var a = S.about;
        el.innerHTML = '<p class="ov rise" style="--i:0">Your route to your goal</p>' +
          '<p class="goalline rise" style="--i:1"><span class="cw"></span> <span>→</span> <b class="gw" style="color:#fff"></b></p>' +
          '<p class="goalbf rise" style="--i:2">at ' + r1(a.goalBodyFatPct) + '% body fat</p>' + chart(r) +
          '<div class="years rise" style="--i:6"><b>' + esc(years(r.roadmap.estYears)) + '</b><span>About, from published rates</span></div>';
        var unit = imp() ? ' lb' : ' kg', f = function (v) { return (imp() ? Math.round(v) : r1(v)) + unit; };
        countUp($('.cw', el), imp() ? kgToLb(a.weightKg) : a.weightKg, 700, f);
        countUp($('.gw', el), imp() ? kgToLb(a.goalWeightKg) : a.goalWeightKg, 1400, f);
        primary('See phase 1', function () { go('phase1'); });
      });
    });
  }
  function rPhase1(el, my) {
    needAbout(el, my, function () {
      withData(el, my, needRoute, 'Planning your route…', function (r) {
        var p = r.phases[0], m = r.macros;
        el.innerHTML = '<p class="ov rise" style="--i:0">Phase 1 of ' + r.phases.length + '</p>' +
          '<h1 class="qh rise" style="--i:1">' + esc(KIND[p.kind] || p.kind) + '.<br><em>' + esc(p.title) + '.</em></h1>' +
          '<p class="sub rise" style="--i:2">' + r1(S.about.bodyFatPct) + ' → ' + r1(p.exitBodyFatPct) + '% body fat' + (p.exitWeightKg != null ? ', ' + fmtW(p.exitWeightKg) : '') + '. ' + months(p.estMonths[0], p.estMonths[1]) + '.</p>' +
          (m ? '<div class="ph1 rise" style="--i:3"><p class="k">Every day in this phase</p><div class="mac"><div><b data-c="' + m.calories + '">0</b><span>kcal</span></div><div><b data-c="' + m.protein + '" data-g="1">0</b><span>Protein</span></div><div><b data-c="' + m.carbs + '" data-g="1">0</b><span>Carbs</span></div><div><b data-c="' + m.fat + '" data-g="1">0</b><span>Fat</span></div></div></div>' : '') +
          '<p class="lbl rise" style="--i:4">All your phases</p><div class="rise" style="--i:5">' + r.phases.map(function (q, i) {
            return '<button type="button" class="prow" aria-expanded="false"><i class="' + q.kind + '"></i><span><b>' + (i + 1) + '. ' + esc(KIND[q.kind] || q.kind) + '</b></span><small>' + esc(months(q.estMonths[0], q.estMonths[1])) + '</small><span class="more">' + esc(q.title) + '. To ' + r1(q.exitBodyFatPct) + '% body fat' + (q.exitWeightKg != null ? ', ' + fmtW(q.exitWeightKg) : '') + '.</span></button>';
          }).join('') + '</div><p class="note rise" style="--i:6">In the app the route updates as you check in.</p>';
        $$('[data-c]', el).forEach(function (b) { countUp(b, +b.getAttribute('data-c'), 900, function (v) { return n0(v) + (b.getAttribute('data-g') ? ' g' : ''); }); });
        $$('.prow', el).forEach(function (b) { b.onclick = function () { b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); }; });
        primary('Plan my food', function () { go('meat'); });
      });
    });
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
      cards(el, S.foodOptions.dietPatterns.map(function (p) { return { v: p.value, l: p.label, h: p.hint }; }), S.food.dietPattern, function (v) { S.food.dietPattern = v; enable(true); autoNext(my); });
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
    cards(el, DESSERT, S.food.dessertFrequency, function (v) { S.food.dessertFrequency = v; enable(true); autoNext(my); });
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
      cards(el, [1, 2, 3, 4, 5, 6].map(function (d) { return { v: d, l: String(d) }; }), S.training.days, function (v) { S.training.days = v; enable(true); autoNext(my); }, { tiles: true });
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
  var sheetEls = null;
  function openSheet(html, onMount) {
    closeSheet(true);
    var bg = document.createElement('div'); bg.className = 'sheet-bg';
    var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab"></div><div class="sheet-in">' + html + '</div>';
    document.body.appendChild(bg); document.body.appendChild(sh);
    sheetEls = [bg, sh];
    bg.onclick = function () { closeSheet(); };
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    onMount && onMount(sh);
  }
  function closeSheet(now) {
    if (!sheetEls) return;
    var els = sheetEls; sheetEls = null;
    els.forEach(function (e) { e.classList.remove('on'); });
    setTimeout(function () { els.forEach(function (e) { e.remove(); }); }, now ? 0 : 340);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

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
    fill().then(function () { for (var k = 0; k < target; k++) if (!SCREENS[k].build) stack.push(k); show(target, 0); }, function (e) { stage.innerHTML = errBox(e.message); });
  } else {
    show(0, 0);
  }
})();
