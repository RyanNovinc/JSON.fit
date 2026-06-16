// analytics-web.js — self-hosted event tracking for json.fit (v2, enriched).
// Adds acquisition attribution, device/locale context, new-vs-returning,
// scroll depth, engagement time, and an internal-traffic filter.
// Load as a NORMAL script (NOT type="module").

(function () {
  var script = document.currentScript;
  var ENDPOINT = script.getAttribute('data-endpoint');
  var APP_VERSION = script.getAttribute('data-app-version') || 'web';
  var SECRET = script.getAttribute('data-secret') || '';
  var SESSION_TIMEOUT = 30 * 60 * 1000;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var params = new URLSearchParams(location.search);

  // Internal-traffic flag: visit any page with ?internal=1 once to exclude
  // yourself from the data (?internal=0 to undo).
  if (params.get('internal') === '1') set('jsonfit_internal', '1');
  if (params.get('internal') === '0') { try { localStorage.removeItem('jsonfit_internal'); } catch (e) {} }
  var IS_INTERNAL = get('jsonfit_internal') === '1';

  // Identity + new-vs-returning.
  var isFirstVisit = false;
  var anonId = get('jsonfit_anon_id');
  if (!anonId) { anonId = uuid(); set('jsonfit_anon_id', anonId); isFirstVisit = true; }

  function deviceType() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua) || (w >= 768 && w < 1024)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua) || w < 768) return 'mobile';
    return 'desktop';
  }
  function timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
  }
  function lc(v) { return v ? String(v).toLowerCase() : null; }

  function currentAttribution() {
    return {
      utm_source: lc(params.get('utm_source')),
      utm_medium: lc(params.get('utm_medium')),
      utm_campaign: lc(params.get('utm_campaign')),
      utm_term: lc(params.get('utm_term')),
      utm_content: lc(params.get('utm_content')),
      referrer: document.referrer || null,
      landing_page: location.pathname
    };
  }
  var cur = currentAttribution();

  // First-touch: store once, never overwrite.
  var ftRaw = get('jsonfit_ft');
  if (!ftRaw) {
    var first = currentAttribution();
    first.ft_timestamp = new Date().toISOString();
    ftRaw = JSON.stringify(first);
    set('jsonfit_ft', ftRaw);
  }
  var firstTouch = {};
  try { firstTouch = JSON.parse(ftRaw); } catch (e) {}

  // Session (30-min inactivity window).
  var sessionId, lastActivity = 0, newSession = false;
  function rollSession() {
    var now = Date.now();
    if (!sessionId) {
      var stored = get('jsonfit_session');
      if (stored) { try { var p = JSON.parse(stored); if (now - p.t < SESSION_TIMEOUT) sessionId = p.id; } catch (e) {} }
    }
    if (!sessionId || now - lastActivity > SESSION_TIMEOUT) { sessionId = uuid(); newSession = true; }
    lastActivity = now;
    set('jsonfit_session', JSON.stringify({ id: sessionId, t: now }));
  }
  rollSession();

  var queue = [];
  function context() {
    return {
      surface: 'web',
      platform: 'web',
      app_version: APP_VERSION,
      path: location.pathname,
      referrer: document.referrer || null,
      device_type: deviceType(),
      viewport_w: window.innerWidth || null,
      viewport_h: window.innerHeight || null,
      is_internal: IS_INTERNAL || undefined
    };
  }
  function track(event, properties) {
    rollSession();
    queue.push({
      event: event,
      timestamp: new Date().toISOString(),
      anon_id: anonId,
      session_id: sessionId,
      properties: properties || {},
      context: context()
    });
    if (queue.length >= 10) flush(false);
  }
  function flush(useBeacon) {
    if (queue.length === 0) return;
    var batch = queue.slice(); queue = [];
    var body = JSON.stringify({ events: batch });
    if (useBeacon && navigator.sendBeacon) {
      var url = SECRET ? ENDPOINT + '?key=' + encodeURIComponent(SECRET) : ENDPOINT;
      navigator.sendBeacon(url, body); return;
    }
    var headers = { 'Content-Type': 'application/json' };
    if (SECRET) headers['x-analytics-key'] = SECRET;
    fetch(ENDPOINT, { method: 'POST', headers: headers, body: body, keepalive: true })
      .catch(function () { queue = batch.concat(queue); });
  }

  // One session_started per session, carrying the rich attribution + context.
  if (newSession) {
    track('session_started', {
      is_first_visit: isFirstVisit,
      utm_source: cur.utm_source, utm_medium: cur.utm_medium, utm_campaign: cur.utm_campaign,
      utm_term: cur.utm_term, utm_content: cur.utm_content,
      referrer: cur.referrer, landing_page: cur.landing_page,
      ft_source: firstTouch.utm_source || null, ft_medium: firstTouch.utm_medium || null,
      ft_campaign: firstTouch.utm_campaign || null, ft_referrer: firstTouch.referrer || null,
      ft_landing_page: firstTouch.landing_page || null, ft_timestamp: firstTouch.ft_timestamp || null,
      timezone: timezone(), language: navigator.language || null,
      device_type: deviceType(), viewport_w: window.innerWidth || null, viewport_h: window.innerHeight || null
    });
  }

  // Auto page view.
  track('page_viewed', { path: location.pathname, title: document.title });

  // Scroll depth: 25/50/75/100, once each per page.
  var marks = { 25: false, 50: false, 75: false, 100: false };
  var maxScroll = 0;
  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - doc.clientHeight;
    var top = window.scrollY || doc.scrollTop || 0;
    var pct = scrollable > 0 ? Math.min(100, Math.round((top / scrollable) * 100)) : 100;
    if (pct > maxScroll) maxScroll = pct;
    [25, 50, 75, 100].forEach(function (t) {
      if (!marks[t] && pct >= t) { marks[t] = true; track('scroll_depth', { percent: t }); }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Engagement time on first page-exit.
  var loadedAt = Date.now(), engagedSent = false;
  function onHide() {
    if (!engagedSent) {
      engagedSent = true;
      track('page_engaged', { engagement_time_ms: Date.now() - loadedAt, max_scroll_percent: maxScroll });
    }
    flush(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);

  setInterval(function () { flush(false); }, 10000);
  window.track = track;
})();
