// Checks the home page and the niche landing pages in headless Chrome (DevTools protocol, no packages):
// at 1440 and 390 wide, no page errors, no broken images, no sideways scroll, the right headline,
// "Build my free plan" links carrying ?v=<variant>, and analytics events tagged with page_variant,
// including on /try/ after arriving from a landing page. Analytics and Google requests are blocked
// (read, then failed), so the test sends nothing to the real endpoints.
//   node scripts/landing-test.mjs [base url]   (default http://localhost:8712)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8712';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(path.join(os.tmpdir(), 'landtest-'));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const killer = setTimeout(() => { console.log('TIMEOUT'); ch.kill('SIGKILL'); process.exit(2); }, 300000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const wait = {}; const errors = []; const beacons = [];

async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = j.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('no chrome');
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function go(url, w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { await sleep(150); if (await ev('document.readyState') === 'complete') break; }
  await sleep(1200);
}

const PAGES = [
  { path: '/', variant: 'home', h1: 'Fitness,' },
  { path: '/meal-prep/', variant: 'meal-prep', h1: 'You already train.' },
  { path: '/fifo/', variant: 'fifo', h1: 'Back from swing.' },
  { path: '/protein-first/', variant: 'protein-first', h1: 'Lose the fat.' },
];
let fails = 0; const bad = (m) => { fails++; console.log('  FAIL ' + m); };

(async () => {
  ws = new WebSocket(await connect());
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && wait[d.id]) { d.error ? wait[d.id].rej(new Error(d.error.message)) : wait[d.id].res(d.result); delete wait[d.id]; return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/googletagmanager|google-analytics|lambda-url|ERR_FAILED|net::ERR_/.test(d.params.entry.text + (d.params.entry.url || ''))) errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
    if (d.method === 'Fetch.requestPaused') {
      const rq = d.params.request, rid = d.params.requestId;
      if (!/lambda-url/.test(rq.url)) { send('Fetch.failRequest', { requestId: rid, errorReason: 'BlockedByClient' }).catch(() => {}); return; }
      // Answer the analytics endpoint ourselves (CORS preflight + the POST) so nothing reaches it.
      const cors = [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' }];
      (async () => {
        if (rq.method === 'POST') {
          let body = rq.postData;
          if (!body) { try { body = (await send('Fetch.getRequestPostData', { requestId: rid })).postData; } catch {} }
          if (body) beacons.push(body);
        }
        await send('Fetch.fulfillRequest', { requestId: rid, responseCode: rq.method === 'OPTIONS' ? 204 : 200, responseHeaders: cors, body: '' });
      })().catch(() => {});
    }
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*lambda-url*' }, { urlPattern: '*googletagmanager*' }, { urlPattern: '*google-analytics*' }] });

  for (const p of PAGES) {
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      errors.length = 0;
      await go(BASE + p.path + '?utm_source=test&utm_campaign=landing', w, h);
      console.log(`${p.path} @${w}`);
      const r = await ev(`(function(){
        var imgs=[].slice.call(document.images).filter(function(i){return i.complete&&i.naturalWidth===0&&i.getAttribute('loading')!=='lazy'}).map(function(i){return i.src});
        var tries=[].slice.call(document.querySelectorAll('a[data-try]')).map(function(a){return a.getAttribute('href')});
        return {h1:document.getElementById('h1').textContent, over:document.documentElement.scrollWidth-window.innerWidth, imgs:imgs, tries:tries,
          meta:(document.querySelector('meta[name="page-variant"]')||{}).content, canon:document.querySelector('link[rel=canonical]').href,
          ss:sessionStorage.getItem('jf_page_variant')};
      })()`);
      if (!r.h1.startsWith(p.h1)) bad(`h1 "${r.h1}"`);
      if (r.over > 1) bad(`horizontal overflow ${r.over}px`);
      if (r.imgs.length) bad('broken images ' + r.imgs.join(' '));
      if (r.meta !== p.variant || r.ss !== p.variant) bad(`variant meta=${r.meta} session=${r.ss}`);
      if (!r.tries.length || r.tries.some((t) => !t.includes(`v=${p.variant}`) || !t.includes('utm_source=test'))) bad('try links ' + r.tries.join(' '));
      if (errors.length) bad(errors.join(' | '));
      // Every <img> on the page, lazy ones included, must exist on the server.
      const srcs = await ev(`[].slice.call(document.images).map(function(i){return i.currentSrc||i.src}).filter(function(s){return s.indexOf(location.origin)===0})`);
      for (const s of [...new Set(srcs)]) { const st = (await fetch(s, { method: 'HEAD' })).status; if (st !== 200) bad(`image ${st} ${s}`); }
    }
    // Analytics: fire a burst so the queue flushes now, then read what would have been sent.
    beacons.length = 0;
    await ev(`(function(){for(var i=0;i<10;i++)window.track('landing_test',{i:i});return true})()`);
    await sleep(800);
    const evs = beacons.flatMap((b) => { try { const j = JSON.parse(b); return j.events || j; } catch { return []; } });
    const tagged = evs.filter((e) => e.properties && e.properties.page_variant === p.variant);
    if (!evs.length) bad('no analytics batch captured'); else if (tagged.length !== evs.length) bad(`page_variant on ${tagged.length}/${evs.length} events`);
    else console.log(`  analytics: ${evs.length} events, all page_variant=${p.variant} (${[...new Set(evs.map((e) => e.event))].join(', ')})`);
  }

  // /try/ keeps the variant it was sent with.
  await go(BASE + '/try/?v=fifo', 1440, 900);
  beacons.length = 0;
  await ev(`(function(){for(var i=0;i<10;i++)window.track('landing_test',{i:i});return true})()`);
  await sleep(800);
  const tevs = beacons.flatMap((b) => { try { const j = JSON.parse(b); return j.events || j; } catch { return []; } });
  const steps = tevs.filter((e) => e.event === 'try_step');
  if (!tevs.length || tevs.some((e) => e.properties.page_variant !== 'fifo')) bad('try page events not tagged fifo');
  else console.log(`/try/?v=fifo: ${tevs.length} events tagged fifo (try_step: ${steps.length})`);

  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  clearTimeout(killer); ws.close(); ch.kill('SIGKILL'); try { rmSync(prof, { recursive: true, force: true }); } catch {}
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); ch.kill('SIGKILL'); process.exit(2); });
