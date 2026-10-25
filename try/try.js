/* json.fit /try/: answers in, the app's own engines out.
 *
 * Everything is built in a Web Worker from engines.min.js (the app's route,
 * meal plan, shopping list and workout code, see scripts/try-engines/). The
 * answers live in this tab's memory only: nothing typed here is sent, stored
 * or put in the URL. The only events sent are the step numbers reached
 * (track('try_step', {step})), through the site's own analytics.
 *
 * ?step=N&demo=1 (or demo=2, a second profile) fills the answers and jumps to a
 * step, for screenshots.
 */
(function () {
  'use strict';

  var STEPS = 9;
  var ACC = { 1: '#fff', 2: '#c084fc', 3: '#c084fc', 4: '#4ade80', 5: '#4ade80', 6: '#4ade80', 7: '#22d3ee', 8: '#22d3ee', 9: '#22d3ee' };
  var LABEL = { 1: 'Start', 2: 'About you', 3: 'Your route', 4: 'Your food', 5: 'Your week', 6: 'Shopping list', 7: 'Your training', 8: 'Your program', 9: 'Keep it' };
  var APP_STORE = 'https://apps.apple.com/au/app/json-fit/id6758357834';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.RyanNovinc.JSON';

  var stage = document.getElementById('stage');
  var bar = document.getElementById('bar');
  var navBtns = document.getElementById('navBtns');
  var backBtn = document.getElementById('backBtn');
  var nextBtn = document.getElementById('nextBtn');

  /* ---------------- engines (Web Worker) ---------------- */
  var worker = null, seq = 0, pending = {};
  function startWorker() {
    if (worker) return;
    try {
      worker = new Worker('engines.min.js');
    } catch (e) { worker = null; return; }
    worker.onmessage = function (ev) {
      var d = ev.data || {}, p = pending[d.id];
      if (!p) return;
      delete pending[d.id]; clearTimeout(p.t);
      d.ok ? p.res(d.result) : p.rej(new Error(d.error || 'failed'));
    };
    worker.onerror = function (ev) {
      // A crashed worker fails everything in flight; the next call starts a fresh one.
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
      var t = setTimeout(function () { delete pending[id]; rej(new Error('timed out')); try { worker.terminate(); } catch (e) {} worker = null; }, 25000);
      pending[id] = { res: res, rej: rej, t: t };
      worker.postMessage({ id: id, cmd: cmd, args: args });
    });
  }

  /* ---------------- state (memory only) ---------------- */
  var S = {
    step: 1,
    units: 'metric',
    about: null,          // filled from the engines' defaults on first visit to step 2
    aboutTouched: {},     // fields the person changed (goal weight follows the others until touched)
    bfMode: 'number',     // 'number' | 'estimate'
    food: { mealsPerDay: 3, snackFrequency: 'ai_decide', dessertFrequency: 'ai_decide', dietPattern: 'any', allergies: [], skip: [], picks: [] },
    training: { days: 3, equipment: 'commercial_gym' },
    defaults: null, foodOptions: null, grid: null, gridKey: '', routeOpts: null, routeOptsKey: '',
    route: null, routeKey: '', meals: null, mealsKey: '', program: null, programKey: '',
    day: 0, wday: null, ticks: {}, maxStep: 1,
  };

  var seen = {};
  function trackStep(n) {
    if (seen[n]) return; seen[n] = 1;
    try { if (window.track) window.track('try_step', { step: n }); } catch (e) {}
  }

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(html) { stage.innerHTML = html; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function kgToLb(kg) { return kg * 2.20462; }
  function fmtW(kg) { return S.units === 'imperial' ? Math.round(kgToLb(kg)) + ' lb' : r1(kg) + ' kg'; }
  function ftIn(cm) { var t = Math.round(cm / 2.54); return Math.floor(t / 12) + ' ft ' + (t % 12) + ' in'; }
  function months(a, b) {
    var f = function (x) { return x < 1 ? '<1' : String(Math.round(x)); };
    if (b < 1) return 'Under a month';
    var lo = f(a), hi = f(b);
    if (lo === hi) return (lo === '1' ? 'About 1 month' : 'About ' + lo + ' months');
    return lo + ' to ' + hi + ' months';
  }
  function years(y) {
    var f = function (x) { return x < 1 ? Math.round(x * 12) + ' months' : (Math.round(x * 10) / 10) + (x === 1 ? ' year' : ' years'); };
    if (!y) return '';
    if (y[1] < 1) return Math.round(y[0] * 12) + ' to ' + Math.round(y[1] * 12) + ' months';
    return (Math.round(y[0] * 10) / 10) + ' to ' + (Math.round(y[1] * 10) / 10) + ' years';
  }
  var KIND = { trim: 'Trim', build: 'Build', recomp: 'Recomp', reveal: 'The reveal' };
  var SHORT = { trim: 'TRIM', build: 'BUILD', recomp: 'RECOMP', reveal: 'REVEAL' };
  function setAcc() {
    var a = ACC[S.step];
    document.documentElement.style.setProperty('--acc', a);
    bar.style.setProperty('--acc', a);
  }
  function errBox(msg, retry) {
    return '<div class="err" role="alert"><b>That didn’t build.</b><p>' + esc(msg || 'Something went wrong on this device.') + ' Nothing was sent anywhere. Try again, or change an answer.</p><button type="button" class="btn-sm" data-retry="' + retry + '">Try again</button></div>';
  }
  function loadingBox(text) { return '<div class="loading"><div class="spin"></div>' + esc(text) + '</div>'; }
  function keyOf(o) { return JSON.stringify(o); }

  /* ---------------- step frame ---------------- */
  function go(n, push) {
    n = Math.max(1, Math.min(STEPS, n));
    S.step = n;
    if (n > S.maxStep) S.maxStep = n;
    if (push !== false) { try { depth++; history.pushState({ step: n, depth: depth }, ''); } catch (e) {} }
    setAcc();
    bar.hidden = n === 1;
    document.getElementById('barLbl').textContent = 'Step ' + n + ' of ' + STEPS + ' · ' + LABEL[n];
    document.getElementById('barFill').style.width = (n / STEPS * 100) + '%';
    document.getElementById('barTrack').setAttribute('aria-valuenow', n);
    stage.classList.toggle('wide', n === 5 || n === 8);
    trackStep(n);
    render();
    window.scrollTo(0, 0);
  }
  var depth = 0;
  window.addEventListener('popstate', function (e) {
    var n = e.state && e.state.step ? e.state.step : 1;
    depth = e.state && e.state.depth ? e.state.depth : 0;
    go(n, false);
  });

  function buttons(opts) {
    if (!opts) { navBtns.hidden = true; return; }
    navBtns.hidden = false;
    backBtn.hidden = !!opts.noBack;
    nextBtn.textContent = opts.next || 'Continue';
    nextBtn.disabled = !!opts.disabled;
    nextBtn.onclick = opts.onNext || function () { go(S.step + 1); };
  }
  backBtn.addEventListener('click', function () {
    if (S.step <= 1) return;
    // Pages this visit pushed go back through history (so the browser's Back agrees); a deep link steps down in place.
    if (depth > 0) history.back();
    else { try { history.replaceState({ step: S.step - 1, depth: 0 }, ''); } catch (e) {} go(S.step - 1, false); }
  });

  function render() {
    var f = [null, rStart, rAbout, rRoute, rFood, rWeek, rShop, rTrain, rProgram, rKeep][S.step];
    f();
  }

  /* ---------------- 1. Start ---------------- */
  function rStart() {
    h('<section class="step start" aria-labelledby="t1">' +
      '<p class="kick">Try JSON.fit</p>' +
      '<h1 class="big" id="t1">See your plan<br><em>in 60 seconds.</em></h1>' +
      '<p class="lead">No sign-up. Answer a few questions and see your route to your goal, a week of meals on your macros with the shopping list, and your training program.</p>' +
      '<button type="button" class="go" id="startBtn" style="--acc:#fff">Start</button>' +
      '<div><span class="privacy"><i></i>Runs on this page. Nothing you enter is sent anywhere.</span></div>' +
      '<div class="three"><div><span class="kick v">01 Route</span><b>Your phases</b><span>When to cut, when to build, and your daily macros.</span></div>' +
      '<div><span class="kick g">02 Food</span><b>Your week of meals</b><span>Every day planned, one cook day, one shopping list.</span></div>' +
      '<div><span class="kick c">03 Training</span><b>Your program</b><span>Sets, reps, rest and how hard to push.</span></div></div>' +
      '</section>');
    buttons(null);
    document.getElementById('startBtn').onclick = function () { go(2); };
    startWorker();
  }

  /* ---------------- 2. About you ---------------- */
  function ensureAbout() {
    if (S.about) return Promise.resolve();
    return call('defaults', 'male').then(function (d) {
      S.defaults = d;
      S.about = {
        sex: 'male', ageYears: d.ageYears, heightCm: d.heightCm, weightKg: d.weightKg, bodyFatPct: d.bodyFatPct, bodyFatSource: 'reported',
        goalWeightKg: d.goalWeightKg, goalBodyFatPct: d.goalBodyFatPct, trainingState: 'consistent', activityLevel: 'light', trainingSessionsPerWeek: 3.5, route: 'lean',
      };
    });
  }
  /** On a sex change the untouched seeds follow (height, body fat, goal body fat), then the goal weight. */
  function refreshDefaults() {
    var a = S.about, t = S.aboutTouched;
    return call('defaults', a.sex).then(function (d) {
      S.defaults = d;
      if (!t.heightCm) a.heightCm = d.heightCm;
      if (!t.bodyFatPct) { a.bodyFatPct = d.bodyFatPct; a.bodyFatSource = 'reported'; }
      if (!t.goalBodyFatPct) a.goalBodyFatPct = d.goalBodyFatPct;
      if (!t.goalWeightKg) return goalWeightFor(a);
    });
  }
  /** RouteScreen's default goal weight for these numbers (the engine's formula), until the person sets one. */
  function goalWeightFor(a) {
    return call('goalWeightAt', a.sex, a.heightCm, a.weightKg, a.goalBodyFatPct).then(function (w) { a.goalWeightKg = w; }, function () {});
  }

  var LIFT = [
    ['new', 'Just starting', 'New to lifting, or under a year in'],
    ['returning', 'Coming back', 'Trained before, had time off'],
    ['consistent', 'In the groove', 'Training regularly and still progressing'],
    ['advanced', 'Advanced', 'Years of hard, structured training. Gains come slowly now'],
  ];
  var ACTIVE = [
    ['sedentary', 'Mostly sitting'], ['light', 'On my feet a bit'], ['moderate', 'On my feet a lot'], ['heavy', 'Physical work'], ['extreme', 'Hard physical work'],
  ];
  function numField(id, label, value, unit, step, min, max, hint) {
    return '<div class="num"><label for="' + id + '">' + esc(label) + '</label><div class="row">' +
      '<button type="button" class="pm" data-pm="' + id + '" data-d="-' + step + '" aria-label="Less">−</button>' +
      '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(value) + '" data-min="' + min + '" data-max="' + max + '">' +
      '<button type="button" class="pm" data-pm="' + id + '" data-d="' + step + '" aria-label="More">+</button></div>' +
      '<span class="hint">' + esc(unit) + (hint ? ' · ' + esc(hint) : '') + '</span></div>';
  }
  function heightField() {
    if (S.units === 'metric') return numField('f-height', 'Height', Math.round(S.about.heightCm), 'cm', 1, 120, 220);
    var opts = '', cur = Math.round(S.about.heightCm / 2.54);
    for (var i = 48; i <= 86; i++) opts += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + Math.floor(i / 12) + '′ ' + (i % 12) + '″</option>';
    return '<div class="num"><label for="f-height">Height</label><div class="row"><select id="f-height">' + opts + '</select></div><span class="hint">ft in</span></div>';
  }
  function wVal(kg) { return S.units === 'imperial' ? Math.round(kgToLb(kg)) : r1(kg); }
  function wUnit() { return S.units === 'imperial' ? 'lb' : 'kg'; }

  function rAbout() {
    h(loadingBox('Getting ready…'));
    buttons(null);
    ensureAbout().then(drawAbout, function (e) { h(errBox(e.message, 'about')); });
  }
  function drawAbout() {
    var a = S.about, d = S.defaults;
    var tiers = d.tiers.map(function (t, i) {
      var range = i === d.tiers.length - 1 ? t.range[0] + '%+' : t.range[0] + '–' + t.range[1] + '%';
      var on = a.bodyFatSource === 'visual' && a.bodyFatPct === t.pct;
      return '<button type="button" class="opt" data-tier="' + t.pct + '" aria-pressed="' + on + '"><b>' + range + '</b><small>' + esc(t.description) + '</small></button>';
    }).join('');
    h('<section class="step" aria-labelledby="t2">' +
      '<p class="kick v">About you</p><h2 class="big" id="t2">Where you are <em>now.</em></h2>' +
      '<p class="lead">Your numbers today. You set the goal below, and the plan works out how to get there.</p>' +
      '<div class="q"><div class="qt">Sex</div><div class="opts two" role="group" aria-label="Sex">' +
        ['male', 'female'].map(function (s) { return '<button type="button" class="opt" data-sex="' + s + '" aria-pressed="' + (a.sex === s) + '"><b>' + (s === 'male' ? 'Male' : 'Female') + '</b></button>'; }).join('') + '</div></div>' +
      '<div class="q"><div class="qt" style="display:flex;justify-content:space-between;align-items:center;gap:10px">Body <span class="seg" role="group" aria-label="Units"><button type="button" data-units="metric" aria-pressed="' + (S.units === 'metric') + '">kg, cm</button><button type="button" data-units="imperial" aria-pressed="' + (S.units === 'imperial') + '">lb, ft</button></span></div>' +
        '<div class="nums">' + numField('f-weight', 'Weight', wVal(a.weightKg), wUnit(), S.units === 'imperial' ? 1 : 0.5, S.units === 'imperial' ? 77 : 35, S.units === 'imperial' ? 440 : 200) +
        heightField() + numField('f-age', 'Age', a.ageYears, 'years', 1, 16, 100) +
        numField('f-bf', 'Body fat', r1(a.bodyFatPct), '%', 0.5, 5, 45, a.bodyFatSource === 'visual' ? 'estimate' : '') + '</div>' +
        '<button type="button" class="link-btn" id="bfEst">' + (S.bfMode === 'estimate' ? 'Hide the estimate' : 'Not sure? Estimate it') + '</button>' +
        (S.bfMode === 'estimate' ? '<p class="note">Pick the closest. A rough match is fine. Lands within a few points for most people.</p><div class="tiers">' + tiers + '</div>' : '') +
      '</div>' +
      '<div class="q"><div class="qt">Your goal</div><div class="qs">You choose where you want to end up.</div><div class="nums">' +
        numField('f-gw', 'Goal weight', wVal(a.goalWeightKg), wUnit(), S.units === 'imperial' ? 1 : 0.5, S.units === 'imperial' ? 77 : 35, S.units === 'imperial' ? 440 : 200, deltaText()) +
        numField('f-gbf', 'Goal body fat', r1(a.goalBodyFatPct), '%', 0.5, 5, 45) + '</div></div>' +
      '<div class="q"><div class="qt">Where are you with lifting?</div><div class="opts" role="group">' +
        LIFT.map(function (o) { return '<button type="button" class="opt" data-lift="' + o[0] + '" aria-pressed="' + (a.trainingState === o[0]) + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">How active are you outside the gym?</div><div class="opts chips" role="group">' +
        ACTIVE.map(function (o) { return '<button type="button" class="opt" data-act="' + o[0] + '" aria-pressed="' + (a.activityLevel === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">How much do you train?</div><div class="opts chips" role="group">' +
        d.trainingBands.map(function (o) { return '<button type="button" class="opt" data-band="' + o.value + '" aria-pressed="' + (a.trainingSessionsPerWeek === o.value) + '">' + esc(o.label) + '</button>'; }).join('') + '</div></div>' +
      '</section>');
    buttons({ next: 'See my route', onNext: function () { if (readAbout()) go(3); } });
    wireAbout();
  }
  function deltaText() {
    var a = S.about, dkg = a.goalWeightKg - a.weightKg;
    if (Math.abs(dkg) < 0.05) return 'the same as now';
    var v = S.units === 'imperial' ? Math.round(kgToLb(Math.abs(dkg))) + ' lb' : r1(Math.abs(dkg)) + ' kg';
    return (dkg > 0 ? '+' : '−') + v + ' from now';
  }
  function clampNum(el) {
    var v = parseFloat(String(el.value).replace(',', '.'));
    var min = +el.getAttribute('data-min'), max = +el.getAttribute('data-max');
    if (!isFinite(v)) return null;
    return Math.max(min, Math.min(max, v));
  }
  /** Reads every field into S.about; false (and a focus) when one is not a number. */
  function readAbout() {
    var a = S.about, ok = true;
    function rd(id, fn) {
      var el = document.getElementById(id); if (!el) return;
      if (el.tagName === 'SELECT') { fn(+el.value); return; }
      var v = clampNum(el); if (v == null) { ok = false; el.focus(); return; }
      el.value = v; fn(v);
    }
    var imp = S.units === 'imperial';
    rd('f-weight', function (v) { a.weightKg = imp ? v / 2.20462 : v; });
    rd('f-height', function (v) { a.heightCm = imp ? v * 2.54 : v; });
    rd('f-age', function (v) { a.ageYears = Math.round(v); });
    rd('f-bf', function (v) { if (Math.abs(v - a.bodyFatPct) > 0.01) a.bodyFatSource = 'reported'; a.bodyFatPct = v; });
    rd('f-gw', function (v) { a.goalWeightKg = imp ? v / 2.20462 : v; });
    rd('f-gbf', function (v) { a.goalBodyFatPct = v; });
    return ok;
  }
  function wireAbout() {
    var a = S.about;
    stage.querySelectorAll('[data-sex]').forEach(function (b) {
      b.onclick = function () { readAbout(); var prev = a.sex; a.sex = b.getAttribute('data-sex'); if (prev !== a.sex) refreshDefaults().then(drawAbout, drawAbout); };
    });
    stage.querySelectorAll('[data-units]').forEach(function (b) { b.onclick = function () { readAbout(); S.units = b.getAttribute('data-units'); drawAbout(); }; });
    stage.querySelectorAll('[data-lift]').forEach(function (b) { b.onclick = function () { a.trainingState = b.getAttribute('data-lift'); mark('[data-lift]', b); }; });
    stage.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function () { a.activityLevel = b.getAttribute('data-act'); mark('[data-act]', b); }; });
    stage.querySelectorAll('[data-band]').forEach(function (b) { b.onclick = function () { a.trainingSessionsPerWeek = +b.getAttribute('data-band'); mark('[data-band]', b); }; });
    stage.querySelectorAll('[data-tier]').forEach(function (b) {
      b.onclick = function () { readAbout(); a.bodyFatPct = +b.getAttribute('data-tier'); a.bodyFatSource = 'visual'; S.aboutTouched.bodyFatPct = true; afterBody(); };
    });
    document.getElementById('bfEst').onclick = function () { readAbout(); S.bfMode = S.bfMode === 'estimate' ? 'number' : 'estimate'; drawAbout(); };
    var FIELD = { 'f-weight': 'weightKg', 'f-height': 'heightCm', 'f-age': 'ageYears', 'f-bf': 'bodyFatPct', 'f-gw': 'goalWeightKg', 'f-gbf': 'goalBodyFatPct' };
    stage.querySelectorAll('[data-pm]').forEach(function (b) {
      b.onclick = function () {
        var el = document.getElementById(b.getAttribute('data-pm'));
        var v = clampNum(el); if (v == null) v = 0;
        el.value = r1(Math.max(+el.getAttribute('data-min'), Math.min(+el.getAttribute('data-max'), v + parseFloat(b.getAttribute('data-d')))));
        changed(el.id);
      };
    });
    Object.keys(FIELD).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('change', function () { changed(id); });
    });
    function changed(id) {
      S.aboutTouched[FIELD[id]] = true;
      if (!readAbout()) return;
      if (id === 'f-gw') { var hEl = document.querySelector('#f-gw').closest('.num').querySelector('.hint'); hEl.textContent = wUnit() + ' · ' + deltaText(); return; }
      if (id === 'f-age') return;
      afterBody();
    }
    function afterBody() {
      // The default goal weight follows the body numbers and the goal body fat until it is touched.
      if (S.aboutTouched.goalWeightKg) { drawAbout(); return; }
      goalWeightFor(a).then(drawAbout, drawAbout);
    }
  }
  function mark(sel, on) { stage.querySelectorAll(sel).forEach(function (b) { b.setAttribute('aria-pressed', b === on ? 'true' : 'false'); }); }

  /* ---------------- 3. Your route ---------------- */
  var ROUTES = [
    ['lean', 'Stay lean the whole way'],
    ['bulk', 'Grow now, cut at the end'],
    ['capped', 'Grow now, up to a limit'],
  ];
  var CUT_WORDS = ['No cuts', 'One cut', 'Two cuts', 'Three cuts', 'Four cuts', 'Five cuts', 'Six cuts'];
  function routeLine(id, o) {
    if (id === 'lean') return o && o.opensWithCut ? 'More defined and a sharper jawline, but a smaller frame while you get there.' : 'More defined the whole way, and never a long stretch of being soft.';
    if (id === 'bulk') return 'Bigger sooner and filling out shirts, but softer the whole way.';
    return 'Bigger sooner without going past a number you pick, but cutting back each time you get there.';
  }
  function needRoute() {
    if (!S.about) return Promise.reject(new Error('Start from About you.'));
    var k = keyOf(S.about);
    var jobs = [];
    if (S.routeKey !== k) jobs.push(call('buildRoute', S.about).then(function (r) { S.route = r; S.routeKey = k; }));
    var ok = keyOf([S.about.sex, S.about.ageYears, S.about.heightCm, S.about.weightKg, S.about.bodyFatPct, S.about.goalWeightKg, S.about.goalBodyFatPct, S.about.trainingState]);
    if (S.routeOptsKey !== ok) jobs.push(call('routeOptions', S.about).then(function (o) { S.routeOpts = o; S.routeOptsKey = ok; }));
    return Promise.all(jobs);
  }
  function rRoute() {
    if (!S.route || S.routeKey !== keyOf(S.about)) h(loadingBox('Planning your route…'));
    buttons({ next: 'Plan my food', disabled: true });
    needRoute().then(drawRoute, function (e) { h(errBox(e.message, 'route')); buttons({ next: 'Plan my food', disabled: true }); });
  }
  function chart(r) {
    var c = r.curve; if (!c || !c.points || c.points.length < 2) return '';
    var pts = c.points, nodes = c.nodes, T = c.totalMonths || 1;
    var bfs = pts.map(function (p) { return p.bodyFatPct; });
    var hi = Math.max.apply(null, bfs), lo = Math.min.apply(null, bfs);
    if (hi - lo < 2) { hi += 1; lo -= 1; }
    var X0 = 24, X1 = 416, Y0 = 26, Y1 = 138;
    var x = function (m) { return X0 + (m / T) * (X1 - X0); };
    var y = function (b) { return Y1 - ((b - lo) / (hi - lo)) * (Y1 - Y0); };
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.month).toFixed(1) + ' ' + y(p.bodyFatPct).toFixed(1); }).join(' ');
    // Grid lines: today, the goal, then the top and bottom of the curve, skipping any too close to one already drawn.
    var gl = '', used = [];
    [nodes[0].bodyFatPct, nodes[nodes.length - 1].bodyFatPct, hi, lo].forEach(function (b) {
      var yy = y(b); if (used.some(function (u) { return Math.abs(u - yy) < 16; })) return; used.push(yy);
      gl += '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="g"/><text x="' + (X1 + 10) + '" y="' + (yy + 3).toFixed(1) + '" class="ax">' + (Math.round(b * 10) / 10) + '%</text>';
    });
    var dots = nodes.map(function (n, i) {
      var last = i === nodes.length - 1;
      return '<circle cx="' + x(n.month).toFixed(1) + '" cy="' + y(n.bodyFatPct).toFixed(1) + '" r="' + (i === 0 || last ? 5 : 3) + '" class="' + (last ? 'end' : 'pt') + '"/>';
    }).join('');
    var labels = '';
    for (var i = 1; i < nodes.length; i++) {
      var a = x(nodes[i - 1].month), b = x(nodes[i].month), k = nodes[i].kind;
      var lx = (a + b) / 2, anchor = '';
      if (b - a < 34) {
        // Too narrow to centre a label: the last phase still gets one, right-aligned at the end.
        if (i !== nodes.length - 1) continue;
        lx = X1; anchor = ' style="text-anchor:end"';
      }
      var cls = k === 'trim' ? 'pl t' : k === 'reveal' ? 'pl r' : k === 'recomp' ? 'pl x' : 'pl';
      labels += '<text x="' + lx.toFixed(1) + '" y="170" class="' + cls + '"' + anchor + '>' + (SHORT[k] || '') + '</text>';
    }
    var end = nodes[nodes.length - 1], ex = x(end.month), ey = y(end.bodyFatPct);
    var goal = fmtW(S.about.goalWeightKg), pw = goal.length * 7 + 16;
    var pillX = Math.min(ex - pw / 2, X1 - pw + 8), pillY = ey > 110 ? ey - 32 : ey + 10;
    var startTxt = fmtW(S.about.weightKg), sy = y(nodes[0].bodyFatPct);
    return '<svg class="rchart" viewBox="0 0 450 180" role="img" aria-label="Your route: body fat from ' + r1(nodes[0].bodyFatPct) + '% to ' + r1(end.bodyFatPct) + '% over about ' + Math.round(T) + ' months">' +
      '<defs><linearGradient id="rfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a855f7" stop-opacity=".28"/><stop offset="1" stop-color="#a855f7" stop-opacity="0"/></linearGradient></defs>' +
      gl + '<path d="' + d + ' L' + X1 + ' 150 L' + X0 + ' 150 Z" fill="url(#rfill)"/><path d="' + d + '" class="ln"/>' + dots +
      '<text x="' + (X0 + 8) + '" y="' + (sy > 40 ? sy - 10 : sy + 18).toFixed(1) + '" class="nl">' + esc(startTxt) + '</text>' +
      '<rect x="' + pillX.toFixed(1) + '" y="' + pillY.toFixed(1) + '" width="' + pw + '" height="20" rx="10" class="endpill"/><text x="' + (pillX + pw / 2).toFixed(1) + '" y="' + (pillY + 14).toFixed(1) + '" class="nl c">' + esc(goal) + '</text>' +
      labels + '</svg>';
  }
  function drawRoute() {
    var r = S.route, a = S.about, o = S.routeOpts || {};
    var m = r.macros;
    var rows = r.phases.map(function (p, i) {
      var w = p.exitWeightKg != null ? ', ' + fmtW(p.exitWeightKg) : '';
      return '<div class="phase"><i class="' + p.kind + '"></i><div><b>Phase ' + (i + 1) + ' · ' + (KIND[p.kind] || p.kind) + '</b><small>' + esc(p.title) + '. To ' + r1(p.exitBodyFatPct) + '% body fat' + w + '.</small></div><span class="numr">' + months(p.estMonths[0], p.estMonths[1]) + '</span></div>';
    }).join('');
    var opts = ROUTES.map(function (x) {
      var oo = o[x[0]];
      return '<button type="button" class="opt" data-route="' + x[0] + '" aria-pressed="' + (a.route === x[0]) + '"><b>' + x[1] + '</b><small>' + routeLine(x[0], oo) + (oo ? ' ' + CUT_WORDS[Math.min(6, oo.cuts)] + '.' : '') + '</small></button>';
    }).join('');
    h('<section class="step" aria-labelledby="t3">' +
      '<p class="kick v">Your route to your goal</p>' +
      '<p class="hd" id="t3">' + esc(fmtW(a.weightKg)) + ' <span>→</span> ' + esc(fmtW(a.goalWeightKg)) + ' <span>at ' + r1(a.goalBodyFatPct) + '% BF</span></p>' +
      '<div class="card" style="margin-top:16px">' + chart(r) +
      '<div class="phases">' + rows + '</div>' +
      '<p class="note">All up: about ' + years(r.roadmap.estYears) + '. Estimates from published rates of fat loss and muscle gain. In the app the route updates as you check in.</p></div>' +
      (m ? '<div class="card"><p class="kick v">Phase 1, every day</p><div class="macros"><div><b>' + m.calories.toLocaleString('en-AU') + '</b><span>kcal</span></div><div><b>' + m.protein + ' g</b><span>Protein</span></div><div><b>' + m.carbs + ' g</b><span>Carbs</span></div><div><b>' + m.fat + ' g</b><span>Fat</span></div></div><p class="note">Your macros for phase 1. Your meal plan is built to land on them each day.</p></div>' : '') +
      '<div class="q"><div class="qt">Do you want to stay lean while you grow?</div><div class="qs">You are at ' + r1(a.bodyFatPct) + '% body fat today. All three finish at ' + r1(a.goalBodyFatPct) + '%.</div><div class="opts">' + opts + '</div></div>' +
      '</section>');
    stage.querySelectorAll('[data-route]').forEach(function (b) {
      b.onclick = function () {
        a.route = b.getAttribute('data-route');
        mark('[data-route]', b);
        var y = window.scrollY;
        needRoute().then(function () { drawRoute(); window.scrollTo(0, y); }, function (e) { h(errBox(e.message, 'route')); });
      };
    });
    buttons({ next: 'Plan my food', disabled: !m, onNext: function () { go(4); } });
  }

  /* ---------------- 4. Food questions ---------------- */
  var MEALS = [[2, 'Two bigger meals. Fewer dishes, simpler prep.'], [3, 'Classic: breakfast, lunch and dinner.'], [4, 'Four solid meals. Good for higher intakes.'], [5, 'Five smaller meals spread across the day.'], [6, 'Frequent eating. Demands more prep.']];
  var SNACKS = [['0', 'None'], ['1', '1 snack'], ['2', '2 snacks'], ['3+', '3+ snacks'], ['ai_decide', 'Let the plan decide']];
  var DESSERT = [['0', 'No desserts'], ['once_per_week', 'Once a week'], ['few_per_week', 'A few nights a week'], ['most_nights', 'Most nights'], ['every_night', 'Every night'], ['ai_decide', 'Let the plan decide']];
  var ALLERGENS = ['Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Gluten/Wheat', 'Soy', 'Fish', 'Sesame'];
  var INDEX = null, EXINDEX = null;
  function loadIndex() {
    if (INDEX) return Promise.resolve();
    return Promise.all([
      fetch('meal-index.json').then(function (r) { return r.json(); }).then(function (j) { INDEX = j; }),
      fetch('exercise-index.json').then(function (r) { return r.json(); }).then(function (j) { EXINDEX = j; }),
    ]);
  }
  function photo(slug, alt) {
    var e = INDEX && INDEX[slug];
    if (e && e.i) return '<img src="/images/meals/' + e.i + '.webp" alt="' + esc(alt || '') + '" loading="lazy" decoding="async" width="300" height="300">';
    return '<span aria-hidden="true">' + esc((alt || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }
  function rFood() {
    h(loadingBox('Loading the meals…'));
    buttons(null);
    var jobs = [loadIndex()];
    if (!S.foodOptions) jobs.push(call('foodOptions').then(function (o) { S.foodOptions = o; }));
    Promise.all(jobs).then(function () { return needGrid(); }).then(drawFood, function (e) { h(errBox(e.message, 'food')); });
  }
  function needGrid() {
    var f = S.food, k = keyOf([f.dietPattern, f.allergies, f.skip]);
    if (S.gridKey === k) return Promise.resolve();
    return call('mainsGrid', { dietPattern: f.dietPattern, allergies: f.allergies, skip: f.skip }).then(function (g) {
      S.grid = g; S.gridKey = k;
      var ok = {}; g.meals.forEach(function (m) { ok[m.slug] = 1; });
      f.picks = f.picks.filter(function (s) { return ok[s]; });
    });
  }
  function drawFood() {
    var f = S.food, o = S.foodOptions, g = S.grid;
    var sel = function (attr, val, cur, label, small) { return '<button type="button" class="opt" data-' + attr + '="' + esc(val) + '" aria-pressed="' + (cur) + '">' + (small != null ? '<b>' + label + '</b><small>' + esc(small) + '</small>' : label) + '</button>'; };
    h('<section class="step" aria-labelledby="t4">' +
      '<p class="kick g">Your food</p><h2 class="big" id="t4">How you <em>like to eat.</em></h2>' +
      '<p class="lead">Every answer has a default. Change what matters to you and the plan fills in the rest.</p>' +
      '<div class="q"><div class="qt">Meals a day</div><div class="opts chips" role="group">' + MEALS.map(function (m) { return sel('meals', m[0], f.mealsPerDay === m[0], String(m[0])); }).join('') + '</div><div class="qs" id="mealHint" style="margin-top:8px">' + esc((MEALS.filter(function (m) { return m[0] === f.mealsPerDay; })[0] || [])[1] || '') + '</div></div>' +
      '<div class="q"><div class="qt">Snacks</div><div class="opts chips" role="group">' + SNACKS.map(function (s) { return sel('snack', s[0], f.snackFrequency === s[0], s[1]); }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">Want dessert in your plan?</div><div class="opts chips" role="group">' + DESSERT.map(function (s) { return sel('dessert', s[0], f.dessertFrequency === s[0], s[1]); }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">Do you eat meat?</div><div class="opts" role="group">' + o.dietPatterns.map(function (p) { return sel('diet', p.value, f.dietPattern === p.value, esc(p.label), p.hint); }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">Any allergies?</div><div class="qs">Meals with these never go in your plan.</div><div class="opts chips" role="group">' + ALLERGENS.map(function (x) { return sel('allergy', x, f.allergies.indexOf(x) > -1, esc(x)); }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">Anything you won’t eat?</div><div class="qs">Meals with these go lower down.</div><div class="opts chips" role="group">' + o.popularFoods.map(function (x) { return sel('skip', x.id, f.skip.indexOf(x.id) > -1, esc(x.name)); }).join('') + '</div></div>' +
      '<div class="q" id="pickQ"><div class="qt">Pick meals you like <span style="color:var(--text-3);font-weight:500">(optional)</span></div><div class="qs">Batch mains: one cook makes 8 tubs. ' + esc(g.recommendLine) + ' Skip it and the plan picks for you.</div>' +
        '<div class="pickbar"><span id="pickCount"></span><button type="button" class="link-btn" id="pickClear" style="--acc:var(--green-text)">Clear</button></div>' +
        '<div class="picks">' + g.meals.map(function (m) {
          return '<button type="button" class="pick' + (m.skipped ? ' low' : '') + '" data-pick="' + m.slug + '" aria-pressed="' + (f.picks.indexOf(m.slug) > -1) + '">' + photo(m.slug, m.name) + '<span class="ck" aria-hidden="true"></span><span class="t">' + esc(m.name) + '<small>' + m.minutes + ' min hands-on' + (m.skipped ? ' · has a food you skip' : '') + '</small></span></button>';
        }).join('') + (g.meals.length ? '' : '<p class="note">No batch mains fit these answers. The plan still builds the rest of your week.</p>') + '</div></div>' +
      '</section>');
    var count = function () {
      var n = f.picks.length;
      document.getElementById('pickCount').textContent = n ? n + ' picked' + (n < g.recommend ? ', we recommend ' + g.recommend : '') : 'None picked, the plan chooses';
    };
    count();
    var redraw = function () { var y = window.scrollY; needGrid().then(function () { drawFood(); window.scrollTo(0, y); }, function (e) { h(errBox(e.message, 'food')); }); };
    stage.querySelectorAll('[data-meals]').forEach(function (b) { b.onclick = function () { f.mealsPerDay = +b.getAttribute('data-meals'); mark('[data-meals]', b); document.getElementById('mealHint').textContent = MEALS.filter(function (m) { return m[0] === f.mealsPerDay; })[0][1]; }; });
    stage.querySelectorAll('[data-snack]').forEach(function (b) { b.onclick = function () { f.snackFrequency = b.getAttribute('data-snack'); mark('[data-snack]', b); }; });
    stage.querySelectorAll('[data-dessert]').forEach(function (b) { b.onclick = function () { f.dessertFrequency = b.getAttribute('data-dessert'); mark('[data-dessert]', b); }; });
    stage.querySelectorAll('[data-diet]').forEach(function (b) { b.onclick = function () { f.dietPattern = b.getAttribute('data-diet'); redraw(); }; });
    var toggle = function (arr, v) { var i = arr.indexOf(v); i > -1 ? arr.splice(i, 1) : arr.push(v); };
    stage.querySelectorAll('[data-allergy]').forEach(function (b) { b.onclick = function () { toggle(f.allergies, b.getAttribute('data-allergy')); redraw(); }; });
    stage.querySelectorAll('[data-skip]').forEach(function (b) { b.onclick = function () { toggle(f.skip, b.getAttribute('data-skip')); redraw(); }; });
    stage.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { toggle(f.picks, b.getAttribute('data-pick')); b.setAttribute('aria-pressed', f.picks.indexOf(b.getAttribute('data-pick')) > -1); count(); }; });
    document.getElementById('pickClear').onclick = function () { f.picks = []; stage.querySelectorAll('[data-pick]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); count(); };
    buttons({ next: 'Build my week', onNext: function () { go(5); } });
  }

  /* ---------------- 5. Your week ---------------- */
  var SLOT = { breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch', second_lunch: 'Lunch', early_dinner: 'Dinner', dinner: 'Dinner', dessert: 'Dessert', pre_workout: 'Before training', post_workout: 'After training', morning_snack: 'Snack', afternoon_snack: 'Snack', evening_snack: 'Snack', snack: 'Snack' };
  function needMeals() {
    var k = keyOf([S.about, S.food]);
    var jobs = [loadIndex()];
    if (S.mealsKey !== k) jobs.push(call('buildMeals', S.about, S.food).then(function (m) { S.meals = m; S.mealsKey = k; S.day = 0; S.ticks = {}; }));
    return Promise.all(jobs);
  }
  function inBand(d, t) {
    return {
      kcal: d.kcal >= t.kcalLo && d.kcal <= t.kcalHi,
      protein: d.protein >= t.proteinLo && d.protein <= t.proteinHi,
      carbs: d.carbs >= t.carbsLo && d.carbs <= t.carbsHi,
      fat: d.fat >= t.fatLo && d.fat <= t.fatHi,
    };
  }
  function allIn(b) { return b.kcal && b.protein && b.carbs && b.fat; }
  function rWeek() {
    if (!S.meals || S.mealsKey !== keyOf([S.about, S.food])) h(loadingBox('Building your week of meals…'));
    buttons({ next: 'See the shopping list', disabled: true });
    needMeals().then(drawWeek, function (e) { h(errBox(e.message, 'week')); });
  }
  function dayLabel(date) {
    var p = date.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()], long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()], d: d.getUTCDate(), mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] };
  }
  function mealName(slug) {
    var e = INDEX && INDEX[slug];
    return e && e.r ? e.r : null;
  }
  function drawWeek() {
    var M = S.meals, t = M.report.targets;
    var dates = Object.keys(M.plan.dailyMeals).sort();
    var byDate = {}; M.report.days.forEach(function (d) { byDate[d.date] = d; });
    var okDays = dates.filter(function (d) { return byDate[d] && allIn(inBand(byDate[d], t)); }).length;
    var i = Math.min(S.day, dates.length - 1), date = dates[i], day = M.plan.dailyMeals[date], tot = byDate[date], band = tot ? inBand(tot, t) : {};
    var strip = dates.map(function (d, j) {
      var L = dayLabel(d), ok = byDate[d] && allIn(inBand(byDate[d], t));
      return '<button type="button" class="day" data-day="' + j + '" aria-pressed="' + (j === i) + '"><small>' + L.dow + '</small><b>' + L.d + '</b><span class="dot' + (ok ? ' ok' : '') + '" aria-label="' + (ok ? 'on your macros' : 'outside a macro range') + '"></span></button>';
    }).join('');
    var meals = day.meals.map(function (m) {
      var page = mealName(m.curated_meal_slug);
      var tag = '';
      var tags = m.tags || [];
      if (tags.indexOf('tub') > -1) tag = m.tubFrom === 'freezer' || m.tubFrom === 'thawing' ? 'Tub from the freezer' : 'Tub from the fridge';
      else if (tags.indexOf('add_on') > -1) tag = 'Add-on';
      else if (tags.indexOf('adjuster') > -1) tag = 'Top-up';
      var nm = page ? '<a class="nm" href="../r/' + page + '/" target="_blank" rel="noopener">' + esc(m.name) + '</a>' : '<span class="nm">' + esc(m.name) + '</span>';
      return '<div class="meal"><div class="ph">' + photo(m.curated_meal_slug, m.name) + '</div><div><span class="sl">' + esc(SLOT[m.type] || m.type) + (m.time ? ' · ' + esc(m.time) : '') + '</span>' + nm + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div><div class="kc"><b>' + Math.round(m.calories) + '</b>kcal<br>' + Math.round(m.macros.protein) + ' g P</div></div>';
    }).join('');
    var T = function (k, val, lo, hi, unit, label) { return '<div class="tot' + (band[k] ? ' ok' : '') + '"><b>' + Math.round(val).toLocaleString('en-AU') + unit + '</b><span>' + label + ' · ' + Math.round(lo) + '–' + Math.round(hi) + '</span></div>'; };
    var verdict = okDays === dates.length
      ? '<p class="verdict"><i></i><span><b style="color:#fff">Every day lands on your macros.</b> Each day’s kcal, protein, carbs and fat sit inside your ranges.</span></p>'
      : '<p class="verdict"><i class="part"></i><span><b style="color:#fff">' + okDays + ' of ' + dates.length + ' days land inside all four macro ranges.</b> The dots show which. In the app you can swap a meal and the day rebalances.</span></p>';
    var L0 = dayLabel(date);
    var cook = M.cook ? (function () {
      var C = M.cook, L = dayLabel(C.date);
      var pots = C.pots.map(function (p) {
        var where = (p.toFridge ? p.toFridge + ' to the fridge' : '') + (p.toFridge && p.toFreezer ? ', ' : '') + (p.toFreezer ? p.toFreezer + ' to the freezer' : '');
        var page = mealName(p.recipe) || mealName(p.fullRecipe);
        var nm = page ? '<a class="nm" href="../r/' + page + '/" target="_blank" rel="noopener" style="color:#fff;font-weight:700">' + esc(p.name) + '</a>' : '<b>' + esc(p.name) + '</b>';
        return '<div class="pot"><div class="ph">' + photo(p.recipe, p.name) + '</div><div>' + nm + '<small>' + p.tubs + ' tubs' + (where ? ': ' + where : '') + '</small></div></div>';
      }).join('');
      return '<div class="card cook"><p class="kick g">Cook day · ' + L.long + ' ' + L.d + ' ' + L.mon + '</p>' +
        '<div class="stat3"><div><b>' + C.pots.length + '</b><span>' + (C.pots.length === 1 ? 'Pot' : 'Pots') + '</span></div><div><b>' + C.handsOnMinutes + '</b><span>Min hands-on</span></div><div><b>' + C.tubs + '</b><span>Tubs</span></div></div>' +
        '<div style="margin-top:8px">' + pots + '</div>' + (M.week && M.week.headline ? '<p class="note">This week: ' + esc(M.week.headline) + (M.week.foot ? ' ' + esc(M.week.foot) : '') + '</p>' : '') + '</div>';
    })() : '';
    h('<section class="step" aria-labelledby="t5">' +
      '<p class="kick g">Your week of meals</p><h2 class="big" id="t5">Every day, <em>planned.</em></h2>' +
      verdict +
      '<div class="days" role="group" aria-label="Days">' + strip + '</div>' +
      '<div class="card" style="margin-top:10px"><p class="kick">' + L0.long + ' ' + L0.d + ' ' + L0.mon + '</p><div style="margin-top:6px">' + meals + '</div>' +
      (tot ? '<div class="totals">' + T('kcal', tot.kcal, t.kcalLo, t.kcalHi, '', 'kcal') + T('protein', tot.protein, t.proteinLo, t.proteinHi, ' g', 'P') + T('carbs', tot.carbs, t.carbsLo, t.carbsHi, ' g', 'C') + T('fat', tot.fat, t.fatLo, t.fatHi, ' g', 'F') + '</div><p class="note">Day total against your range. Macros are hit across the day, not per meal.</p>' : '') + '</div>' +
      cook + '</section>');
    stage.querySelectorAll('[data-day]').forEach(function (b) { b.onclick = function () { S.day = +b.getAttribute('data-day'); var y = window.scrollY; drawWeek(); window.scrollTo(0, y); }; });
    buttons({ next: 'See the shopping list', onNext: function () { go(6); } });
  }

  /* ---------------- 6. Shopping list ---------------- */
  function shortName(n) { return String(n).split(/[,(\[]/)[0].trim(); }
  function rShop() {
    if (!S.meals || S.mealsKey !== keyOf([S.about, S.food])) h(loadingBox('Writing your shopping list…'));
    buttons({ next: 'Plan my training', disabled: true });
    needMeals().then(drawShop, function (e) { h(errBox(e.message, 'shop')); });
  }
  function drawShop() {
    var G = S.meals.grocery;
    // The app lists a batch plan's shop by cook; here it is by aisle, so a food bought for two cooks shows once with both amounts.
    var merged = [], byName = {};
    G.rows.forEach(function (r) {
      var k = r.category + '|' + shortName(r.name).toLowerCase();
      if (byName[k]) { byName[k].amount += ' + ' + r.amount; byName[k].keys.push(r.key); return; }
      byName[k] = { key: r.key, keys: [r.key], name: r.name, amount: r.amount, category: r.category };
      merged.push(byName[k]);
    });
    var groups = G.categoryOrder.map(function (c) { return { c: c, name: G.categoryNames[c], rows: merged.filter(function (r) { return r.category === c; }) }; }).filter(function (g) { return g.rows.length; });
    var html = groups.map(function (g) {
      return '<div class="aisle"><h3>' + esc(g.name) + '</h3>' + g.rows.map(function (r) {
        var id = 'g-' + r.key.replace(/[^a-z0-9]/gi, '_'), done = !!S.ticks[r.key];
        return '<label class="gi' + (done ? ' done' : '') + '" for="' + id + '"><input type="checkbox" id="' + id + '" data-tick="' + esc(r.key) + '"' + (done ? ' checked' : '') + '><div><span>' + esc(shortName(r.name)) + '</span><small>' + esc(r.amount) + '</small></div></label>';
      }).join('') + '</div>';
    }).join('');
    h('<section class="step" aria-labelledby="t6">' +
      '<p class="kick g">Shopping list</p><h2 class="big" id="t6">One shop for <em>the week.</em></h2>' +
      '<p class="lead">' + merged.length + ' items for this week’s plan, cook day included, grouped by aisle.' + (G.freezerLine ? ' ' + esc(G.freezerLine) : '') + '</p>' +
      html + '<p class="note">Tick things off as you go. In the app the list also splits by cook, lets you set your own pack sizes, and remembers what you bought.</p></section>');
    stage.querySelectorAll('[data-tick]').forEach(function (b) {
      b.onchange = function () { S.ticks[b.getAttribute('data-tick')] = b.checked; b.closest('.gi').classList.toggle('done', b.checked); };
    });
    buttons({ next: 'Plan my training', onNext: function () { go(7); } });
  }

  /* ---------------- 7. Training questions ---------------- */
  var EQUIP = [
    ['commercial_gym', 'Commercial gym', 'Machines, cables, barbells and dumbbells.'],
    ['home_gym', 'Home gym', 'Barbell, dumbbells, a bench and a pull-up bar.'],
    ['basic_equipment', 'Basic equipment', 'Dumbbells and a bench.'],
    ['bodyweight', 'Bodyweight only', 'A pull-up bar and a bench at most.'],
  ];
  function rTrain() {
    var t = S.training, a = S.about;
    if (!a) { go(2); return; }
    var days = [1, 2, 3, 4, 5, 6];
    h('<section class="step" aria-labelledby="t7">' +
      '<p class="kick c">Your training</p><h2 class="big" id="t7">How you <em>train.</em></h2>' +
      '<div class="q"><div class="qt">Days a week</div><div class="opts chips" role="group">' + days.map(function (d) { return '<button type="button" class="opt" data-days="' + d + '" aria-pressed="' + (t.days === d) + '" aria-label="' + d + (d === 1 ? ' day' : ' days') + ' a week">' + d + '</button>'; }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">Where do you train?</div><div class="opts" role="group">' + EQUIP.map(function (e) { return '<button type="button" class="opt" data-eq="' + e[0] + '" aria-pressed="' + (t.equipment === e[0]) + '"><b>' + e[1] + '</b><small>' + e[2] + (e[0] !== 'commercial_gym' ? ' Coming to the app soon.' : '') + '</small></button>'; }).join('') + '</div></div>' +
      '<div class="q"><div class="qt">Where are you with lifting?</div><div class="opts" role="group">' + LIFT.map(function (o) { return '<button type="button" class="opt" data-lift="' + o[0] + '" aria-pressed="' + (a.trainingState === o[0]) + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') + '</div></div>' +
      '</section>');
    stage.querySelectorAll('[data-days]').forEach(function (b) { b.onclick = function () { t.days = +b.getAttribute('data-days'); mark('[data-days]', b); }; });
    stage.querySelectorAll('[data-eq]').forEach(function (b) { b.onclick = function () { t.equipment = b.getAttribute('data-eq'); mark('[data-eq]', b); }; });
    stage.querySelectorAll('[data-lift]').forEach(function (b) { b.onclick = function () { a.trainingState = b.getAttribute('data-lift'); mark('[data-lift]', b); }; });
    buttons({ next: 'Build my program', onNext: function () { go(8); } });
  }

  /* ---------------- 8. Your program ---------------- */
  function needProgram() {
    var k = keyOf([S.about, S.training]);
    var jobs = [loadIndex()];
    if (S.programKey !== k) jobs.push(call('buildProgram', S.about, S.training).then(function (p) { S.program = p; S.programKey = k; S.wday = null; }));
    return Promise.all(jobs);
  }
  function rProgram() {
    if (!S.program || S.programKey !== keyOf([S.about, S.training])) h(loadingBox('Building your program…'));
    buttons({ next: 'Keep it', disabled: true });
    needProgram().then(drawProgram, function (e) { h(errBox(e.message, 'program')); });
  }
  function rest(sec) {
    if (!sec) return '';
    if (sec < 60) return sec + ' s';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ' min' + (s ? ' ' + s + ' s' : '');
  }
  function drawProgram() {
    var P = S.program, prog = P.program, b0 = prog.blocks[0];
    var sched = b0.weekly_schedule || [];
    var dayByName = {}; b0.days.forEach(function (d) { dayByName[d.day_name] = d; });
    var trainIdx = sched.filter(function (s) { return s.type === 'training'; });
    if (S.wday == null && trainIdx.length) S.wday = trainIdx[0].day_number;
    var DOW = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    var week = sched.map(function (s, i) {
      var d = dayByName[s.day_name];
      if (s.type !== 'training' || !d) return '<div class="wd rest"><small>' + DOW[i] + '</small><b>Rest</b></div>';
      return '<button type="button" class="wd" data-wd="' + s.day_number + '" aria-pressed="' + (S.wday === s.day_number) + '"><small>' + DOW[i] + '</small><b>' + esc(s.day_name) + '</b><small>' + d.exercises.length + ' exercises · ~' + d.estimated_duration + ' min</small></button>';
    }).join('');
    var cur = sched.filter(function (s) { return s.day_number === S.wday; })[0];
    var day = cur && dayByName[cur.day_name];
    var sx = S.about.sex === 'female' ? 'pink' : 'blue';
    var exs = day ? day.exercises.map(function (e) {
      var slug = EXINDEX && EXINDEX[e.exercise];
      var sets = (e.sets_weekly && e.sets_weekly['1']) || e.sets;
      var reps = e.reps_weekly && e.reps_weekly['1'] ? e.reps_weekly['1'] : e.reps;
      var rir = e.rir_weekly && e.rir_weekly['1'];
      var nm = slug ? '<a class="nm ex-l" href="../exercises/#' + slug + '" target="_blank" rel="noopener">' + esc(e.exercise) + '</a>' : '<span class="nm">' + esc(e.exercise) + '</span>';
      var img = slug ? '<img src="/images/exercises/' + slug + '/' + sx + '/start.webp" alt="" loading="lazy" decoding="async" width="128" height="128">' : '';
      return '<div class="ex"><div class="ph">' + img + '</div><div>' + nm + '<div class="meta"><span><b>' + sets + ' × ' + esc(e.reps) + '</b> reps</span>' + (e._restSec ? '<span>Rest ' + rest(e._restSec) + '</span>' : '') + (rir ? '<span>RIR ' + esc(rir) + '</span>' : '') + '</div><div class="meta" style="color:var(--text-3)">Week 1: ' + esc(reps) + '</div></div></div>';
    }).join('') : '';
    var vol = P.volume || {};
    var vrows = (P.targets || []).filter(function (t) { return t.kind === 'standard' || (vol[t.row] || 0) >= 4; }).map(function (t) {
      var v = vol[t.row] || 0, max = Math.max(24, t.hi || 0, v);
      var band = t.kind === 'standard' ? '<i style="left:' + (t.lo / max * 100) + '%;width:' + ((t.hi - t.lo) / max * 100) + '%"></i>' : '';
      return '<div class="vr"><span>' + esc(t.row) + '</span><span class="vb">' + band + '<s style="left:calc(' + Math.min(100, v / max * 100) + '% - 2px)"></s></span><span class="vn">' + (Math.round(v * 2) / 2) + (t.kind === 'standard' ? ' / ' + t.lo + '–' + t.hi : '') + '</span></div>';
    }).join('');
    var deload = prog.blocks.map(function (b) { return (b.deload_weeks || []).length ? b.block_name + ': week ' + b.deload_weeks.join(', ') + ' is a deload' : ''; }).filter(Boolean).join('. ');
    h('<section class="step" aria-labelledby="t8">' +
      '<p class="kick c">Your program</p><h2 class="big" id="t8">' + esc(prog.routine_name.replace(/ Program$/, '')) + '</h2>' +
      '<p class="lead">' + prog.blocks.length + (prog.blocks.length === 1 ? ' block' : ' blocks') + ', ' + prog.days_per_week + ' days a week. Weights and reps climb week to week.' + (deload ? ' ' + esc(deload) + '.' : '') + '</p>' +
      (P.appBuildsGym ? '<p class="verdict"><i class="part"></i><span>Home and bodyweight programs are coming to the app. Today the app builds gym programs, so it would build this one for a gym.</span></p>' : '') +
      '<div class="week" role="group" aria-label="Your week">' + week + '</div>' +
      (day ? '<div class="card" style="margin-top:14px"><p class="kick c">' + esc(day.day_name) + ' · week 1</p>' + exs + '<p class="note">Sets × rep range, rest between sets, and RIR: reps left in the tank on each set. Tap an exercise to see how to do it.</p></div>' : '') +
      (vrows ? '<div class="card vol"><p class="kick c">Effective sets per muscle, week 1</p><p class="note" style="margin:4px 0 8px">A muscle’s main lifts count a full set, lifts where it helps count half. The shaded band is your target.</p>' + vrows + '</div>' : '') +
      '</section>');
    stage.querySelectorAll('[data-wd]').forEach(function (b) { b.onclick = function () { S.wday = +b.getAttribute('data-wd'); var y = window.scrollY; drawProgram(); window.scrollTo(0, y); }; });
    buttons({ next: 'Keep it', onNext: function () { go(9); } });
  }

  /* ---------------- 9. Keep it ---------------- */
  function rKeep() {
    h('<section class="step keep" aria-labelledby="t9">' +
      '<p class="kick c">Keep it</p><h2 class="big" id="t9">Your plan<br><em>is ready.</em></h2>' +
      '<p class="lead">The app runs the same engines, and does the rest every day.</p>' +
      '<ul class="why">' +
      '<li><div><b>Cook mode with timers</b><span>Every step on screen, timers set for you.</span></div></li>' +
      '<li><div><b>Prep day reminders</b><span>A reminder when it is time to cook, so the week stays on track.</span></div></li>' +
      '<li><div><b>Swap any meal, your macros hold</b><span>The day rebalances around the swap.</span></div></li>' +
      '<li><div><b>Log workouts and see last time</b><span>What you lifted last session, right beside this one.</span></div></li>' +
      '<li><div><b>The route updates as you check in</b><span>Log your weight and the phases adjust.</span></div></li>' +
      '</ul>' +
      '<div class="badges">' +
        '<a class="badge" href="' + APP_STORE + '" data-loc="try_end"><svg width="22" height="26" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg><div><small>Download on the</small><span>App Store</span></div></a>' +
        '<a class="badge ghost" href="' + PLAY + '" data-loc="try_end"><svg width="22" height="24" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg><div><small>Get it on</small><span>Google Play</span></div></a>' +
      '</div>' +
      '<p class="trust" style="margin-top:16px;font-family:var(--mono);font-size:.74rem;color:var(--text-3)"><b style="color:var(--text)">Free</b> · No ads · No account</p>' +
      '<p class="honest">This plan stays on this page. It doesn’t carry over to the app: answer the same questions there and the app builds it again in about a minute.</p>' +
      '</section>');
    buttons({ next: 'Start again', onNext: function () { S.maxStep = 1; go(2); } });
  }

  /* ---------------- retry + boot ---------------- */
  stage.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-retry]');
    if (b) render();
  });

  var params = new URLSearchParams(location.search);
  var demo = params.get('demo');
  var want = parseInt(params.get('step') || '1', 10) || 1;
  if (demo) {
    document.documentElement.classList.add('still');
    // Screenshot / test mode: fill the answers and jump. demo=2 is a vegetarian woman training at home.
    var boot = function () {
      if (demo === '2') {
        return call('defaults', 'female').then(function (d) {
          S.defaults = d;
          S.about = { sex: 'female', ageYears: 36, heightCm: 166, weightKg: 72, bodyFatPct: 32, bodyFatSource: 'reported', goalWeightKg: 64, goalBodyFatPct: 25, trainingState: 'new', activityLevel: 'light', trainingSessionsPerWeek: 1.5, route: 'lean' };
          S.food = { mealsPerDay: 3, snackFrequency: 'ai_decide', dessertFrequency: 'once_per_week', dietPattern: 'vegetarian', allergies: ['Nuts'], skip: [], picks: [] };
          S.training = { days: 3, equipment: 'home_gym' };
        });
      }
      return ensureAbout();
    };
    boot().then(function () { history.replaceState({ step: want }, ''); go(want, false); }, function (e) { h(errBox(e.message, 'about')); });
  } else {
    try { history.replaceState({ step: 1 }, ''); } catch (e) {}
    go(1, false);
  }
})();
