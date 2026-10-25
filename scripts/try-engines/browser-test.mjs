// Clicks through /try/ in headless Chrome (DevTools protocol, no extra packages):
// every step, several profiles, 400 and 1280 wide. Fails on a page error, a broken
// image, a step that doesn't render, horizontal overflow, or any request that is not
// a GET for a static file (so nothing typed can leave the page; analytics events are
// listed and checked to carry no answers).
//   node scripts/try-engines/browser-test.mjs [base url]   (default http://localhost:8711)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const BASE = process.argv[2] || 'http://localhost:8711';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(path.join(os.tmpdir(), 'trytest-'));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const kill = setTimeout(() => { console.log('TIMEOUT'); ch.kill('SIGKILL'); process.exit(2); }, 240000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const wait = {}, events = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = j.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('no chrome');
}
function send(method, params = {}) {
  return new Promise((res, rej) => { const i = ++id; wait[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function until(expr, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(150); }
  throw new Error('waited for ' + expr);
}
const click = (sel) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('no ${sel.replace(/'/g, '')}'); e.click(); return true})()`);
const stepIs = (n) => until(`document.getElementById('barLbl') && document.getElementById('barLbl').textContent.indexOf('Step ${n} of')===0 && !document.querySelector('.loading')`);

const PROFILES = [
  { name: 'default man, gym 3', set: [], food: [], train: [] },
  { name: 'woman cut vegetarian home 2', set: ['[data-sex="female"]', '[data-lift="new"]', '[data-act="sedentary"]'], gw: -8, food: ['[data-diet="vegetarian"]', '[data-allergy="Nuts"]', '[data-meals="4"]'], train: ['[data-days="2"]', '[data-eq="home_gym"]'] },
  { name: 'man gain 6 days bodyweight, picks', set: ['[data-lift="consistent"]'], gw: +10, route: 'bulk', food: ['[data-meals="5"]', '[data-snack="2"]'], picks: 3, train: ['[data-days="6"]', '[data-eq="bodyweight"]'] },
  { name: 'vegan, capped', set: ['[data-sex="female"]'], gw: +4, route: 'capped', food: ['[data-diet="vegan"]', '[data-skip="mushrooms"]'], train: ['[data-days="4"]', '[data-eq="basic_equipment"]'] },
];
let fails = 0; const bad = (m) => { fails++; console.log('  FAIL ' + m); };
(async () => {
  ws = new WebSocket(await connect());
  await new Promise((r) => (ws.onopen = r));
  const requests = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && wait[d.id]) { d.error ? wait[d.id].rej(new Error(d.error.message)) : wait[d.id].res(d.result); delete wait[d.id]; return; }
    if (d.method === 'Network.requestWillBeSent') requests.push({ url: d.params.request.url, method: d.params.request.method, body: d.params.request.postData || '' });
    if (d.method === 'Runtime.exceptionThrown') events.push('exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') events.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
  };
  await send('Network.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  for (const width of [400, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const P of PROFILES) {
      console.log(`${width}px ${P.name}`);
      events.length = 0; requests.length = 0;
      await send('Page.navigate', { url: BASE + '/try/' });
      await until(`!!document.getElementById('startBtn')`);
      const overflow = async (n) => { const o = await ev(`document.documentElement.scrollWidth - window.innerWidth`); if (o > 1) bad(`step ${n}: ${o}px horizontal overflow`); };
      const images = async (n) => {
        await ev(`Promise.all([...document.images].filter(i=>i.loading!=='lazy'||true).map(i=>{i.loading='eager';return i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,4000)})}))`);
        const broken = await ev(`[...document.images].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.getAttribute('src'))`);
        if (broken.length) bad(`step ${n}: broken images ${broken.join(', ')}`);
      };
      try {
        await overflow(1);
        await click('#startBtn'); await stepIs(2); await overflow(2);
        for (const s of P.set) { await click(s); await sleep(250); }
        if (P.gw) await ev(`(function(){var e=document.getElementById('f-gw'); e.value=(parseFloat(e.value)+${P.gw}); e.dispatchEvent(new Event('change')); return 1})()`);
        await sleep(300);
        await ev(`(function(){var b=document.getElementById('bfEst'); b.click(); return 1})()`); await sleep(300);
        await click('[data-tier]:nth-child(3)'); await sleep(400);
        await click('#nextBtn'); await stepIs(3); await overflow(3);
        if (P.route) { await click(`[data-route="${P.route}"]`); await sleep(600); await stepIs(3); }
        const hd = await ev(`document.getElementById('t3').textContent`);
        const kcal = await ev(`(document.querySelector('.macros b')||{}).textContent`);
        const ph = await ev(`document.querySelectorAll('.phase').length`);
        console.log(`  route: ${hd} | ${ph} phases | ${kcal} kcal | chart ${await ev(`!!document.querySelector('.rchart .ln')`)}`);
        if (!kcal || !ph) bad('route empty');
        await click('#nextBtn'); await stepIs(4); await overflow(4);
        for (const s of P.food) { await click(s); await sleep(500); await until(`!document.querySelector('.loading')`); }
        if (P.picks) for (let i = 1; i <= P.picks; i++) { await click(`.pick:nth-child(${i})`); }
        await images(4);
        await click('#nextBtn'); await stepIs(5); await overflow(5); await images(5);
        const v = await ev(`document.querySelector('.verdict').textContent`);
        const nMeals = await ev(`document.querySelectorAll('.meal').length`);
        const cook = await ev(`(document.querySelector('.cook .kick')||{}).textContent||'no cook day'`);
        console.log(`  week: ${nMeals} meals on day 1 | ${v.slice(0, 60)} | ${cook}`);
        if (!nMeals) bad('no meals');
        for (let d = 2; d <= 7; d++) { await click(`[data-day="${d - 1}"]`); await sleep(80); }
        await images(5);
        await click('#nextBtn'); await stepIs(6); await overflow(6);
        const items = await ev(`document.querySelectorAll('.gi').length`);
        await click('.gi input');
        console.log(`  shop: ${items} items in ${await ev(`document.querySelectorAll('.aisle').length`)} aisles`);
        if (!items) bad('no shopping list');
        // Back and forward again keeps the plan.
        await click('#backBtn'); await stepIs(5); await click('#nextBtn'); await stepIs(6);
        await click('#nextBtn'); await stepIs(7); await overflow(7);
        for (const s of P.train) { await click(s); await sleep(100); }
        await click('#nextBtn'); await stepIs(8); await overflow(8); await images(8);
        const prog = await ev(`document.getElementById('t8').textContent`);
        const ex = await ev(`document.querySelectorAll('.ex').length`);
        const links = await ev(`[...document.querySelectorAll('.ex a.nm')].length`);
        console.log(`  program: ${prog} | ${ex} exercises (${links} linked) | ${await ev(`document.querySelectorAll('.vol .vr').length`)} muscle rows`);
        if (!ex) bad('no exercises');
        const wds = await ev(`document.querySelectorAll('[data-wd]').length`);
        for (let i = 1; i <= wds; i++) { await ev(`document.querySelectorAll('[data-wd]')[${i - 1}].click()`); await sleep(60); }
        await images(8);
        await click('#nextBtn'); await stepIs(9); await overflow(9);
        // Browser back goes to the previous step.
        await ev(`history.back()`); await stepIs(8);
      } catch (e) { bad(String(e.message || e)); }
      for (const e of events) bad(e);
      const posts = requests.filter((r) => r.method !== 'GET');
      const off = requests.filter((r) => r.method === 'GET' && !r.url.startsWith(BASE) && !/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com|google-analytics\.com/.test(r.url));
      for (const r of off) bad('unexpected request ' + r.url);
      for (const p of posts) {
        const isAnalytics = /lambda-url|google-analytics|googletagmanager|analytics\.google/.test(p.url);
        if (!isAnalytics) bad('unexpected ' + p.method + ' ' + p.url);
        // Our own analytics: only try_step numbers and the usual page events, never answers.
        if (/lambda-url/.test(p.url) && p.body) {
          const evs = JSON.parse(p.body).events || [];
          for (const e of evs) {
            const props = JSON.stringify(e.properties || {});
            if (/kg|vegetarian|vegan|Nuts|bodyFat|goal|weight/i.test(props)) bad('analytics carries an answer: ' + props);
          }
          console.log('  analytics events: ' + evs.map((e) => e.event + (e.event === 'try_step' ? e.properties.step : '')).join(' '));
        }
      }
    }
  }
  console.log(fails ? `${fails} failure(s)` : 'browser test OK');
  clearTimeout(kill); ch.kill('SIGKILL'); try { rmSync(prof, { recursive: true, force: true }); } catch {}
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERROR', e); ch.kill('SIGKILL'); process.exit(2); });
