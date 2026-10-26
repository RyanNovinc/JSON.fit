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
const kill = setTimeout(() => { console.log('TIMEOUT'); ch.kill('SIGKILL'); process.exit(2); }, 1200000);
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
  { name: 'default man, gym 4', sex: 'male', lift: 'consistent', route: 'lean', active: 'light', band: '3.5', meat: 'any', allergies: [], skip: [], meals: '3', snacks: 'ai_decide', dessert: 'ai_decide', picks: 0, days: '4', equip: 'commercial_gym' },
  { name: 'woman cut vegetarian home 2', sex: 'female', lift: 'new', gw: -6, route: 'lean', active: 'sedentary', band: '1.5', diet: 'high_protein', meat: 'vegetarian', allergies: ['Nuts'], typedAllergy: 'Kiwi', skip: [], search: 'cinnamon', keepLower: 'salt', meals: '4', snacks: '1', dessert: 'once_per_week', cooker: 'none', freezer: 8, picks: 0, days: '2', equip: 'home_gym', estimate: true },
  { name: 'man gain 6 days bodyweight, picks', sex: 'male', lift: 'returning', gw: +8, route: 'bulk', active: 'moderate', band: '5.5', diet: 'custom', meat: 'any', allergies: [], skip: ['mushrooms'], meals: '5', snacks: '2', dessert: '0', freezer: 60, picks: 3, days: '6', equip: 'bodyweight', imperial: true },
  { name: 'vegan, capped, basic', sex: 'female', lift: 'advanced', gw: +25, route: 'capped', active: 'heavy', band: '3.5', meat: 'vegan', allergies: ['Soy'], skip: [], meals: '2', snacks: '0', sleepSkip: true, dessert: 'ai_decide', picks: 1, days: '3', equip: 'basic_equipment' },
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
        const key = (sel, k, n) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); for(var i=0;i<${n};i++) e.dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',bubbles:true})); return 1})()`);
        await key('.ruler', 'ArrowRight', 2);
        await go(); await scr('sex'); await click(`.sexpick[data-sex="${P.sex}"]`); await go();
        await scr('bodyfat'); await overflow('bodyfat');
        if (P.estimate) { await click('#est'); await until(`!!document.querySelector('.sheet.on [data-tier]')`); await ev(`document.querySelectorAll('.sheet [data-tier]')[3].click()`); await click('#useTier'); await sleep(400); }
        await go(); await scr('height'); await go(); await scr('age'); await go();
        await scr('lifting'); await opt(P.lift); await go();
        await scr('goalweight'); await overflow('goalweight');
        if (P.gw) await key('.ruler', P.gw > 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(P.gw) * (P.imperial ? 2 : 2));
        await go(); await scr('goalbf'); await overflow('goalbf'); await go();
        // Beat 9: the route (when there is a range), then whatever that answer opens, then the plan.
        await until(`!!document.querySelector('.screen[data-screen="route"],.screen[data-screen="plan"]') && !document.querySelector('.loading')`);
        const seen9 = [];
        if (await ev(`!!document.querySelector('.screen[data-screen="route"]')`)) {
          seen9.push('route:' + P.route);
          await until(`document.querySelectorAll('.screen .ropt').length===3`); await click(`.ropt[data-v="${P.route}"]`); await sleep(300); await overflow('route');
          await until(`document.querySelector('.ropt[data-v="${P.route}"]').getAttribute('aria-pressed')==='true' && !document.querySelector('.loading')`);
          await go();
        }
        for (let k = 0; k < 6; k++) {
          await until(`(function(){var s=document.querySelector('.screen'); return !!s && !s.querySelector('.loading') && !document.querySelector('.screen.out-l,.screen.out-r') && s.children.length>0})()`);
          const id = await ev(`document.querySelector('.screen').getAttribute('data-screen')`);
          seen9.push(id); await overflow(id);
          if (id === 'summary') break;
          if (id === 'range') { await click('.stp[data-k="hi"][data-d="1"]'); await sleep(300); }
          if (id === 'bulkto') { await click('.stp[data-k="bulk"][data-d="1"]'); await sleep(300); }
          if (id === 'plan') { seen9.push('[' + (await ev(`document.querySelector('.dest').textContent`)) + ']'); const n = await ev(`document.querySelectorAll('.pc [data-node]').length`); if (n > 1) { await ev(`document.querySelectorAll('.pc [data-node]')[1].dispatchEvent(new MouseEvent('click',{bubbles:true}))`); } }
          await go();
        }
        await scr('summary'); await overflow('summary');
        const hd = await ev(`document.querySelector('.sey').textContent + ' ' + document.querySelector('.stl').textContent + ', ' + document.querySelector('.dur b').textContent`);
        console.log(`  route: ${seen9.join(' > ')} | ${hd}`);
        await go(); await until(`!!document.querySelector('.sheet.on [data-a="lock"]')`); await click('.sheet [data-a="lock"]');
        await scr('locked', 8000); await overflow('locked');
        await go(); await scr('active'); await opt(P.active); await go();
        await scr('sessions'); await opt(P.band); await go();
        // The meal questions, in the order the app asks them; conditional steps by what shows up.
        const typeIn = (sel, text) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(text)}; e.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
        const seenMeal = [];
        for (let k = 0; k < 30; k++) {
          await until(`(function(){var s=document.querySelector('.screen'); return !!s && !s.querySelector('.loading') && !document.querySelector('.screen.out-l,.screen.out-r') && s.children.length>0})()`, 45000);
          const id = await ev(`document.querySelector('.screen').getAttribute('data-screen')`);
          if (id === 'weekready') break;
          seenMeal.push(id); await overflow(id);
          if (id === 'diettype') { await opt(P.diet || 'balanced'); if (P.diet === 'custom') { await typeIn('[data-k="p"]', '30'); await typeIn('[data-k="c"]', '45'); await typeIn('[data-k="f"]', '25'); await sleep(400); } }
          else if (id === 'meat') await opt(P.meat);
          else if (id === 'allergies') { for (const x of P.allergies) await click(`[data-a="${x}"]`); if (P.typedAllergy) { await typeIn('#alIn', P.typedAllergy); await click('#alAdd'); } }
          else if (id === 'skip') { if (P.search) { await typeIn('#skQ', P.search); await until(`!!document.querySelector('.results .frow')`); await click('.results .frow'); } for (const x of P.skip) await click(`[data-tg="${x}"]`); }
          else if (id === 'keeplower') { if (P.keepLower) await click(`[data-k="${P.keepLower}"]`); }
          else if (id === 'sleep') { if (P.sleepSkip) { await click('#slSkip'); continue; } await click('[data-t="bed"][data-d="15"]'); await click('.mtap'); await sleep(200); await click('[data-m="15"]'); await sleep(200); }
          else if (id === 'eat') { await click(`[data-n="${P.meals}"]`); await click(`#sk [data-s="${P.snacks}"]`); }
          else if (id === 'snacks') { await images('snacks'); }
          else if (id === 'appetite') await opt('yes');
          else if (id === 'dessert') await opt(P.dessert);
          else if (id === 'cooker') { await click(`[data-sz="${P.cooker || '5_6l'}"]`); await click('[data-bl="yes"]'); }
          else if (id === 'freezer') await click(`[data-fz="${P.freezer || 16}"]`);
          else if (id === 'cadence') await click('[data-cd="weekly"]');
          else if (id === 'stockup') await click('[data-su="false"]');
          else if (id === 'picks') {
            await images('picks');
            if (!P.picks) { await click('#chooseMe'); continue; }
            await click('[data-tab$=":lunch"],[data-tab$=":dinner"]'); await sleep(200);
            for (let i = 0; i < P.picks; i++) { await ev(`(function(){var c=[...document.querySelectorAll('.mgrid2 .mcard:not(.on) .mtp')][0]; c.click(); return 1})()`); await sleep(150); if (await ev(`!!document.querySelector('.sheet.on [data-a="anyway"]')`)) { await click('.sheet [data-a="anyway"]'); await sleep(300); } }
            await go(); await until(`!!document.querySelector('.sheet.on #cfOk')`); await click('#cfOk'); continue;
          }
          else if (id === 'mealbuild') { await until(`!document.querySelector('.screen[data-screen="mealbuild"]')`, 60000); continue; }
          else if (id === 'mealnote') { await click('#nKeep'); continue; }
          else if (id === 'mealweek') { await click('#wUse'); continue; }
          else if (id === 'mealgap') { await until(`!!document.querySelector('#gKeep')`, 60000); await click('#gKeep'); continue; }
          if (id === 'mealsummary') { await click('#nextBtn'); continue; }
          await go();
        }
        console.log(`  meals: ${seenMeal.join(' > ')}`);
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
        await go(); await scr('mealsdone'); await overflow('mealsdone');
        await go(); await scr('days'); await opt(P.days); await go();
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
      const off = requests.filter((r) => r.method === 'GET' && !r.url.startsWith(BASE) && !r.url.startsWith('data:') && !/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com|google-analytics\.com/.test(r.url));
      for (const r of off) bad('unexpected request ' + r.url);
      for (const r of requests) if (/Kiwi|cinnamon/i.test(r.url + r.body)) bad('typed text left the page: ' + r.url);
      for (const p of posts) {
        const isAnalytics = /lambda-url|google-analytics|googletagmanager|analytics\.google/.test(p.url);
        if (!isAnalytics) bad('unexpected ' + p.method + ' ' + p.url);
        // Our own analytics: only try_step numbers and the usual page events, never answers.
        if (/lambda-url/.test(p.url) && p.body) {
          const evs = JSON.parse(p.body).events || [];
          for (const e of evs) {
            const pr = Object.assign({}, e.properties || {}); delete pr.screen; const props = JSON.stringify(pr);
            if (/kg|vegetarian|vegan|Nuts|Kiwi|cinnamon|bodyFat|goal|weight/i.test(props)) bad('analytics carries an answer: ' + props);
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
