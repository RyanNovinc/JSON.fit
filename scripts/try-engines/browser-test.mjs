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
const stepIsOld = (n) => until(`document.getElementById('barLbl') && document.getElementById('barLbl').textContent.indexOf('Step ${n} of')===0 && !document.querySelector('.loading')`);

const PROFILES = [
  { name: 'default man, gym 4', sex: 'male', lift: 'consistent', route: 'lean', active: 'light', band: '3.5', meat: 'any', allergies: [], skip: [], meals: '3', dessert: 'ai_decide', picks: 0, days: '4', equip: 'commercial_gym' },
  { name: 'woman cut vegetarian home 2', sex: 'female', lift: 'new', gw: -6, route: 'lean', active: 'sedentary', band: '1.5', meat: 'vegetarian', allergies: ['Nuts'], skip: [], meals: '4', dessert: 'once_per_week', picks: 0, days: '2', equip: 'home_gym', estimate: true },
  { name: 'man gain 6 days bodyweight, picks', sex: 'male', lift: 'returning', gw: +8, route: 'bulk', active: 'moderate', band: '5.5', meat: 'any', allergies: [], skip: ['mushrooms'], meals: '5', dessert: '0', picks: 3, days: '6', equip: 'bodyweight', imperial: true },
  { name: 'vegan, capped, basic', sex: 'female', lift: 'advanced', gw: +3, route: 'capped', active: 'heavy', band: '3.5', meat: 'vegan', allergies: ['Soy'], skip: [], meals: '2', dessert: 'ai_decide', picks: 1, days: '3', equip: 'basic_equipment' },
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
      await until(`!!document.querySelector('.screen[data-screen="start"]')`);
      const overflow = async (n) => { const o = await ev(`document.documentElement.scrollWidth - window.innerWidth`); if (o > 1) bad(`step ${n}: ${o}px horizontal overflow`); };
      const images = async (n) => {
        await ev(`Promise.all([...document.images].filter(i=>i.loading!=='lazy'||true).map(i=>{i.loading='eager';return i.complete?0:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,4000)})}))`);
        const broken = await ev(`[...document.images].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.getAttribute('src'))`);
        if (broken.length) bad(`step ${n}: broken images ${broken.join(', ')}`);
      };
      const scr = (id, ms) => until(`(function(){var s=document.querySelector('.screen[data-screen="${id}"]'); return !!s && !s.querySelector('.loading') && !document.querySelector('.screen.out-l,.screen.out-r')})()`, ms || 20000);
      const go = async () => { await until(`!document.getElementById('nextBtn').disabled && !document.getElementById('cta').hidden`); await click('#nextBtn'); };
      const opt = async (v) => { await click(`.screen .opt[data-v="${v}"]`); };
      const steps = [];
      try {
        await overflow('start');
        await click('#nextBtn'); await scr('weight'); await overflow('weight');
        if (P.imperial) { await click('[data-u="imperial"]'); await sleep(150); }
        await click('.pm button[data-d="1"]'); await click('.pm button[data-d="1"]');
        await go(); await scr('sex'); await opt(P.sex);
        await scr('bodyfat'); await overflow('bodyfat');
        if (P.estimate) { await click('#est'); await until(`!!document.querySelector('.sheet.on [data-tier]')`); await ev(`document.querySelectorAll('.sheet [data-tier]')[3].click()`); await sleep(500); }
        await go(); await scr('height'); await go(); await scr('age'); await go();
        await scr('lifting'); await opt(P.lift);
        await scr('goalweight'); await overflow('goalweight');
        if (P.gw) await ev(`(function(){var e=document.querySelector('.big input'); e.value=(parseFloat(e.value)+${P.gw}); e.dispatchEvent(new Event('change')); return 1})()`);
        await go(); await scr('goalbf'); await go();
        await scr('route'); await until(`document.querySelectorAll('.screen .opt').length===3`); await opt(P.route); await overflow('route'); await go();
        await scr('active'); await opt(P.active);
        await scr('sessions'); await opt(P.band); await go();
        await scr('routebuild');
        const t0 = Date.now(); await scr('routereveal', 20000); steps.push('route build ' + (Date.now() - t0) + ' ms');
        await overflow('routereveal');
        const hd = await ev(`document.querySelector('.goalline').textContent`);
        await go(); await scr('phase1'); await overflow('phase1');
        const kcal = await ev(`(document.querySelector('.mac b')||{}).getAttribute && document.querySelector('.mac b').getAttribute('data-c')`);
        const ph = await ev(`document.querySelectorAll('.prow').length`);
        await click('.prow'); 
        console.log(`  route: ${hd.replace(/\s+/g, ' ').trim()} | ${ph} phases | ${kcal} kcal | ${steps[0]}`);
        if (!kcal || !ph) bad('route empty');
        await go(); await scr('meat'); await opt(P.meat);
        await scr('allergies'); for (const x of P.allergies) await opt(x); await go();
        await scr('skip'); for (const x of P.skip) await opt(x); await go();
        await scr('eat'); await opt(P.meals); await go();
        await scr('dessert'); await opt(P.dessert);
        await scr('picks'); await images('picks'); await overflow('picks');
        for (let i = 1; i <= P.picks; i++) await click(`.pick:nth-child(${i})`);
        await go(); await scr('mealbuild');
        // Skip by tapping, once the step list is showing.
        await until(`!!document.querySelector('.act2.on')`, 20000); await click('.screen.bm');
        await scr('weekready', 20000); await overflow('weekready'); await images('weekready');
        const ready = await ev(`document.querySelector('.screen .sub').textContent`);
        await go(); await scr('today'); await overflow('today'); await images('today');
        const nMeals = await ev(`document.querySelectorAll('.mc').length`);
        console.log(`  week: ${ready} | ${nMeals} cards on day 1`);
        if (!nMeals) bad('no meals');
        for (let d = 2; d <= 7; d++) { await click(`[data-day="${d - 1}"]`); await sleep(60); }
        await images('today');
        await click('#shopBtn'); await scr('shop'); await overflow('shop');
        const aisles = await ev(`document.querySelectorAll('.aisle').length`);
        await click('[data-aisle]'); await click('.aisle[data-open="true"] .gi input');
        const amts = await ev(`[...document.querySelectorAll('.aisle .gi small')].map(x=>x.textContent).join(' | ')`);
        if (/Woolworths|Coles|McKenzie|\d{2,} ?tsp/.test(amts)) bad('shop amounts: ' + amts.slice(0, 200));
        console.log(`  shop: ${aisles} aisles`);
        // Back returns to the day.
        await click('#backBtn'); await scr('today'); await click('#shopBtn'); await scr('shop');
        await go(); await scr('days'); await opt(P.days);
        await scr('equip'); await opt(P.equip);
        await scr('progbuild'); await scr('program', 20000); await overflow('program'); await images('program');
        const prog = await ev(`document.querySelector('.screen .ov').textContent`);
        const wds = await ev(`document.querySelectorAll('[data-wd]').length`);
        for (let i = 0; i < wds; i++) { await ev(`document.querySelectorAll('[data-wd]')[${i}].click()`); await sleep(80); await images('program day'); }
        const ex = await ev(`document.querySelectorAll('.wd[data-open="true"] .ex').length`);
        await click('#volBtn');
        console.log(`  program: ${prog} | ${wds} training days | ${ex} exercises on the last | flag ${await ev(`!!document.querySelector('.flag')`)}`);
        if (!ex) bad('no exercises');
        await go(); await scr('keep'); await overflow('keep');
        await ev(`history.back()`); await scr('program');
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
            const pr = Object.assign({}, e.properties || {}); delete pr.screen; const props = JSON.stringify(pr);
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
