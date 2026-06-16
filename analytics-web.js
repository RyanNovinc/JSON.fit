// analytics-web.js — self-hosted event tracking for the json.fit website.
// Same JSON schema as the app, so everything lands in ONE pipeline.
// Load as a NORMAL script (NOT type="module") — it uses document.currentScript.
// page_viewed fires automatically on load. See EVENTS.md for the catalogue.

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

  var anonId = get('jsonfit_anon_id');
  if (!anonId) { anonId = uuid(); set('jsonfit_anon_id', anonId); }

  var sessionId, lastActivity = 0;
  function rollSession() {
    var now = Date.now();
    if (!sessionId) {
      var stored = get('jsonfit_session');
      if (stored) {
        try {
          var p = JSON.parse(stored);
          if (now - p.t < SESSION_TIMEOUT) sessionId = p.id;
        } catch (e) {}
      }
    }
    if (!sessionId || now - lastActivity > SESSION_TIMEOUT) sessionId = uuid();
    lastActivity = now;
    set('jsonfit_session', JSON.stringify({ id: sessionId, t: now }));
  }
  rollSession();

  var queue = [];

  function track(event, properties) {
    rollSession();
    queue.push({
      event: event,
      timestamp: new Date().toISOString(),
      anon_id: anonId,
      session_id: sessionId,
      properties: properties || {},
      context: {
        surface: 'web',
        platform: 'web',
        app_version: APP_VERSION,
        path: location.pathname,
        referrer: document.referrer || null
      }
    });
    if (queue.length >= 10) flush(false);
  }

  function flush(useBeacon) {
    if (queue.length === 0) return;
    var batch = queue.slice();
    queue = [];
    var body = JSON.stringify({ events: batch });

    if (useBeacon && navigator.sendBeacon) {
      // Beacon can't set custom headers, so the secret goes as a query param.
      var url = SECRET ? ENDPOINT + '?key=' + encodeURIComponent(SECRET) : ENDPOINT;
      navigator.sendBeacon(url, body);
      return;
    }

    var headers = { 'Content-Type': 'application/json' };
    if (SECRET) headers['x-analytics-key'] = SECRET;
    fetch(ENDPOINT, { method: 'POST', headers: headers, body: body, keepalive: true })
      .catch(function () { queue = batch.concat(queue); }); // requeue on failure
  }

  // Flush periodically and when the page is hidden / closed.
  setInterval(function () { flush(false); }, 10000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', function () { flush(true); });

  // Expose the API and auto-track the page view.
  window.track = track;
  track('page_viewed', { path: location.pathname, title: document.title });
})();
