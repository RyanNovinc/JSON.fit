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
  { name: 'default man, meals first from the finish line (no plan, training yes)', mealsFirst: true, sex: 'male', lift: 'consistent', route: 'lean', active: 'light', training: 'yes', meat: 'any', allergies: [], skip: [], meals: '3', snacks: 'ai_decide', dessert: 'ai_decide', picks: 0, days: '4', length: '8_weeks', volume: '12-16', rep: 'classic' },
  { name: 'woman cut vegetarian home 2, training edited at the summary', editTraining: 'no', sex: 'female', lift: 'new', gw: -6, route: 'lean', active: 'sedentary', diet: 'high_protein', meat: 'vegetarian', allergies: ['Nuts'], typedAllergy: 'Kiwi', skip: [], search: 'cinnamon', keepLower: 'salt', meals: '4', snacks: '1', dessert: 'once_per_week', cooker: 'none', freezer: 8, picks: 0, days: '2', length: '12_weeks', volume: '4-8', rep: 'higher', preset: 1, estimate: true, editSummary: true },
  { name: 'man gain 6 days bodyweight, picks', sex: 'male', lift: 'returning', gw: +8, route: 'bulk', active: 'moderate', diet: 'custom', meat: 'any', allergies: [], skip: ['mushrooms'], meals: '5', snacks: '2', dessert: '0', freezer: 60, picks: 3, days: '6', length: '1_year', volume: '16-20', rep: 'mix', imperial: true },
  { name: 'vegan, capped, basic', sex: 'female', lift: 'advanced', gw: +25, route: 'capped', active: 'heavy', meat: 'vegan', allergies: ['Soy'], skip: [], meals: '2', snacks: '0', sleepSkip: true, dessert: 'ai_decide', picks: 1, days: '3', length: '4_weeks', volume: '12-16', custom: 14, rep: 'heavier', preset: 3, weekSheet: true },
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
    // The plan pass: on a computer the end screen saves the plan to the share API by itself.
    // Never hit the real API from a test; answer it here with a fake share id.
    if (d.method === 'Fetch.requestPaused') {
      const cors = [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' }, { name: 'Content-Type', value: 'application/json' }];
      const body = d.params.request.method === 'OPTIONS' ? '' : JSON.stringify({ shareId: 'TESTpass', expiresAt: Math.floor(Date.now() / 1000) + 7 * 86400 });
      send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: d.params.request.method === 'OPTIONS' ? 204 : 200, responseHeaders: cors, body: Buffer.from(body).toString('base64') }).catch(() => {});
      return;
    }
    if (d.method === 'Runtime.exceptionThrown') events.push('exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') events.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
  };
  await send('Network.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*execute-api*/shares*' }] }); await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  // The intro is full screen like the questions: no site menu or footer, one viewport with no
  // page scroll and the button in view; a short viewport (a phone on its side) scrolls instead.
  for (const [w, h, lock] of [[400, 800, true], [1280, 800, true], [800, 400, false]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await send('Page.navigate', { url: BASE + '/try/' });
    await until(`!!document.querySelector('.screen[data-screen="start"] .ip-card')`);
    await sleep(600);
    const r = JSON.parse(await ev(`JSON.stringify({nav:getComputedStyle(document.querySelector('.site-nav')).display, foot:getComputedStyle(document.querySelector('.site-foot')).display, x:document.documentElement.scrollWidth-innerWidth, y:document.documentElement.scrollHeight-innerHeight, lock:document.documentElement.classList.contains('ip-lock'), btn:document.getElementById('nextBtn').getBoundingClientRect().bottom<=innerHeight, label:document.getElementById('nextBtn').textContent, exit:!!document.getElementById('exitBtn').offsetParent, back:!!document.getElementById('backBtn').offsetParent, trust:[...document.querySelectorAll('#ctaTrust span')].map(function(e){return e.textContent}).join(' ')})`));
    console.log(`intro ${w}x${h}: ` + JSON.stringify(r));
    if (r.nav !== 'none' || r.foot !== 'none') bad(`intro ${w}x${h}: site menu or footer showing`);
    if (r.x > 1) bad(`intro ${w}x${h}: ${r.x}px horizontal overflow`);
    if (lock && (r.y > 1 || !r.lock)) bad(`intro ${w}x${h}: ${r.y}px vertical overflow, lock ${r.lock}`);
    if (!lock && r.lock) bad(`intro ${w}x${h}: scroll locked on a short viewport`);
    if (!r.btn) bad(`intro ${w}x${h}: button below the fold`);
    if (r.label !== 'Build my free plan' || !r.exit || r.back) bad(`intro ${w}x${h}: button/X/back wrong`);
    if (!/FREE NO SIGN-UP NO ADS 42 SOURCES/i.test(r.trust)) bad(`intro ${w}x${h}: trust row ` + r.trust);
    if (await ev(`/Runs on this page/.test(document.body.innerText)`)) bad('intro: old privacy line still showing');
  }
  // From a "Build my free plan" button (/try/#start): straight to question 1, "About N min" under it,
  // time left in the bar, the #start dropped from the address; Back goes to the intro.
  await send('Page.navigate', { url: BASE + '/try/?v=home#start' });
  await until(`!!document.querySelector('.screen[data-screen="weight"] .big') && !document.querySelector('.screen.out-l,.screen.out-r')`);
  {
    const r = await ev(`(function(){var e=document.querySelector('.screen[data-screen="weight"] .eta');return {eta:e?e.textContent:'',left:(document.querySelector('#segLbl .sl-t')||{}).textContent||'',hash:location.hash,intro:document.documentElement.classList.contains('ip-intro')}})()`);
    if (!/^About \d+ min$/.test(r.eta)) bad('#start: no "About N min" on question 1: ' + r.eta);
    if (!/^\d+ min left$/.test(r.left)) bad('#start: no time left in the bar: ' + r.left);
    if (r.hash) bad('#start: hash kept in the address');
    if (r.intro) bad('#start: intro styling still on');
    await click('#backBtn');
    await until(`!!document.querySelector('.screen[data-screen="start"]')`);
  }
  // The X on the intro goes straight home, no sheet.
  await click('#exitBtn'); await until(`location.pathname === '/'`);
  for (const width of [400, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const P of PROFILES) {
      console.log(`${width}px ${P.name}`);
      events.length = 0; requests.length = 0;
      // A saved plan pass would land on "welcome back"; each profile starts fresh.
      await ev(`(function(){try{localStorage.removeItem('jsonfit_plan_pass')}catch(e){};return 1})()`).catch(() => {});
      await send('Page.navigate', { url: BASE + '/try/' });
      await until(`!!document.querySelector('.screen[data-screen="start"]')`);
      const overflow = async (n) => { const o = await ev(`document.documentElement.scrollWidth - window.innerWidth`); if (o > 1) bad(`step ${n}: ${o}px horizontal overflow`); if (await ev(`/\u2014/.test(document.body.innerText) || /meal replacement/i.test(document.body.innerText)`)) bad(`step ${n}: an em dash or a banned phrase on screen`); };
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
        // The finish line sends training first ("Next: my training"); the meals row is the other way in.
        const lockedCta = await ev(`document.getElementById('nextBtn').textContent`);
        if (lockedCta !== 'Next: my training') bad('finish line CTA: ' + lockedCta);
        const lockedRows = await ev(`[...document.querySelectorAll('.spine .sb b')].map(x=>x.textContent).join(' > ')`);
        console.log(`  finish line: ${lockedRows} | ${lockedCta}`);
        if (!P.mealsFirst) {
        // Training: the app's workout questions (Volume, Days, How long, Refinements), the build, the results.
        await go(); await scr('volume');
        // The one-at-a-time picker: opens on the tier For you; − Less / More + step; the stage keeps its place while the hours land.
        // 27 Oct: no "For you" kicker, no explainer; the question, hours big, growth small, Less / More.
        if (await ev(`!!document.getElementById('vtag') || !!document.getElementById('vPct') || !!document.querySelector('.screen .sub, .vst + .reas')`)) bad('volume: explainer, kicker or % link still showing');
        if (!/How much time do you have\?$/.test(await ev(`document.querySelector('.screen .qh').textContent`))) bad('volume: title');
        // Layout positions (offsetTop ignores the screen's rise-in transform).
        const vlay = `(function(){var y=function(e){var t=0;for(;e;e=e.offsetParent)t+=e.offsetTop;return t};return [document.getElementById('vnm'),document.getElementById('vt'),document.getElementById('vdots'),document.querySelector('.vsteps'),document.querySelector('.vlinks'),document.querySelector('.vgr')].map(y).join(',')})()`;
        const vlay0 = await ev(vlay);
        await until(`!!document.querySelector('#vt') && /h$/.test(document.getElementById('vt').textContent) && !document.querySelector('#vt .sk')`, 30000);
        const vlay1 = await ev(vlay);
        if (vlay0 !== vlay1) bad(`volume: layout moved as the hours landed (${vlay0} -> ${vlay1})`);
        const TIER = { '4-8': 'Minimum', '8-12': 'Conservative', '12-16': 'Moderate', '16-20': 'High' };
        for (let k = 0; k < 5 && (await ev(`document.querySelector('#vnm b').textContent`)) !== TIER[P.volume]; k++) {
          const order = Object.values(TIER), now = await ev(`document.querySelector('#vnm b').textContent`);
          await click(`.vsb[data-dir="${order.indexOf(TIER[P.volume]) < order.indexOf(now) ? -1 : 1}"]`); await sleep(120);
        }
        if ((await ev(`document.querySelector('#vnm b').textContent`)) !== TIER[P.volume]) bad('volume: could not step to ' + TIER[P.volume]);
        await until(`/h$/.test(document.getElementById('vt').textContent) && !document.querySelector('#vt.held') && !document.querySelector('#vt .sk')`, 30000);
        if ((await ev(vlay)) !== vlay1) bad('volume: layout moved on a step');
        const pct = '';
        if (P.custom) {
          await click('#vOwn'); await until(`!!document.querySelector('.sheet.on #oR')`);
          await ev(`(function(){var r=document.getElementById('oR'); r.value=${P.custom}; r.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
          await until(`/h$/.test(document.getElementById('oT').textContent) && !document.querySelector('#oT.held')`, 30000); await overflow('set my own');
          const own = await ev(`[...document.querySelectorAll('.ownr b')].map(x=>x.textContent).join(' ') + ' | ' + document.getElementById('oUse').textContent`);
          await click('#oUse'); await sleep(400);
          if ((await ev(`document.querySelector('#vnm b').textContent`)) !== 'Custom') bad('volume: Set my own did not pick Custom');
          await until(`/h$/.test(document.getElementById('vt').textContent) && !document.querySelector('#vt.held') && !document.querySelector('#vt .sk')`, 30000);
          console.log(`  set my own: ${own} | dots ${await ev(`document.querySelectorAll('#vdots i').length`)}`);
        }
        await overflow('volume');
        const vol = await ev(`document.querySelector('#vnm b').textContent + ' ' + document.getElementById('vg').textContent + ' ' + document.getElementById('vt').textContent + ' a week'`);
        await go(); await scr('days');
        if (!/can you lift\?$/.test(await ev(`document.querySelector('.screen .qh').textContent`))) bad('days: title');
        // The minutes arrive without moving anything: the week line, the week card and the session card keep their place and height.
        const lay = `[document.getElementById('wtot').offsetHeight, document.getElementById('wkc').offsetTop, document.getElementById('dsc').offsetHeight].join(',')`;
        const lay0 = await ev(lay);
        await click(`.dt[data-v="${P.days}"]`);
        await until(`document.querySelectorAll('.dt small').length===5 && !document.querySelector('#dsc.working') && !!document.querySelector('#dsh b') && !document.querySelector('#dsl .sk') && !document.querySelector('#wtot .sk') && !document.querySelector('#wtot b.held')`, 30000);
        const lay1 = await ev(lay);
        if (lay0 !== lay1) bad(`days: layout moved as the minutes landed (${lay0} -> ${lay1})`);
        await overflow('days');
        const days = await ev(`document.getElementById('wtot').textContent + ' | ' + document.querySelector('.dt[aria-pressed="true"]').textContent + ': ' + document.querySelector('#dsh b').textContent + ', ' + document.getElementById('dsl').textContent`);
        await go(); await scr('length'); await click(`.qc[data-v="${P.length}"]`); await overflow('length');
        await go(); await scr('refine');
        if (P.preset) await click(`.presets .preset:nth-child(${P.preset}) .pmain`);
        await click(`.rep[data-rep="${P.rep}"]`); await sleep(300);
        await click('#repWhy'); await until(`!!document.querySelector('.sheet.on [data-dec]')`); await ev(`document.querySelector('.sheet [data-close]').click()`); await sleep(400);
        await click('.pinfo'); await until(`!!document.querySelector('.sheet.on .ppick')`); await ev(`document.querySelector('.sheet [data-close]').click()`); await sleep(400);
        await until(`!!document.querySelector('#slpin .slr b') && document.querySelector('#slpin .slr b').textContent.indexOf('About')===0`, 20000); await overflow('refine');
        // Refinements -> "Here's your week" -> the build.
        await go(); await scr('trainsummary'); await overflow('trainsummary');
        const panelDone = `!!document.querySelector('#sumPanel .slp .slh b') && !document.querySelector('#sumPanel .slp.working') && !document.querySelector('#sumPanel .slh .slu')`;
        await until(panelDone, 30000);
        const sumRows = () => ev(`document.querySelector('.screen .qh').textContent + ' | ' + [...document.querySelectorAll('.tsum .srow2')].map(x=>x.querySelector('small').textContent + ': ' + x.querySelector('b').textContent).join(', ') + ' | ' + document.querySelector('#sumPanel .slh b').textContent + ' | ' + document.getElementById('nextBtn').textContent`);
        let sum = await sumRows();
        if (!/^Here’s your week \| Volume: /.test(sum) || !/Build my plan$/.test(sum)) bad('summary: ' + sum);
        if (P.editSummary) {
          // A row opens its question in edit mode; Save comes back with the change.
          await click('[data-ed="volume"]'); await scr('volume');
          if ((await ev(`document.getElementById('nextBtn').textContent`)) !== 'Save') bad('volume edit CTA');
          await click('.vsb[data-dir="1"]'); await sleep(150); await go(); await scr('trainsummary'); await until(panelDone, 30000);
          const after = await sumRows();
          console.log(`  summary edit: ${sum.split(' | ')[1].split(', ')[0]} -> ${after.split(' | ')[1].split(', ')[0]}, ${await ev(`(document.querySelector('#sumPanel .sld')||{}).textContent||''`)}`);
          sum = after;
        }
        if (P.weekSheet) {
          await click('#wkRow'); await until(`!!document.querySelector('.sheet.on #wkSave')`); await overflow('week sheet');
          await click('.sheet [data-t="morning"]'); await sleep(100);
          await click('#wkSave'); await sleep(400); await scr('trainsummary'); await until(panelDone, 30000);
          sum = await sumRows();
          if (!/Training week: [^,]+(, [A-Z][a-z]{2})*/.test(sum)) bad('summary week row: ' + sum);
          console.log(`  week sheet: ${await ev(`document.querySelector('#wkRow em').textContent`)}`);
        }
        console.log(`  summary: ${sum}`);
        await go(); await scr('progbuild'); await overflow('progbuild');
        await scr('program', 30000); await overflow('program'); await images('program');
        const prog = await ev(`document.querySelector('.hpl').textContent + ' | ' + document.querySelector('.hmt').textContent + ' | ' + document.querySelectorAll('.scard').length + ' sessions'`);
        await click('#planRow'); await scr('blocks'); await overflow('blocks'); await images('blocks');
        await click('#pBuilt'); await until(`!!document.querySelector('.sheet.on [data-dec]')`); await ev(`document.querySelector('.sheet [data-dec]').click()`); await sleep(200); await ev(`document.querySelector('.sheet [data-close]').click()`); await sleep(400);
        await go(); await scr('trainweek'); await overflow('trainweek'); await images('trainweek');
        await click('.nexth'); await scr('session'); await overflow('session'); await images('session');
        const ses = await ev(`document.querySelector('.xov').textContent + ' | ' + document.querySelectorAll('.xr .rir').length + ' RIR labels'`);
        if (await ev(`!!document.querySelector('.xcue')`)) { await click('.xcue'); await until(`!!document.querySelector('.sheet.on .cst')`); await ev(`dismiss=document.querySelector('.sheet-bg'); dismiss && dismiss.click()`); await sleep(400); }
        await click('[data-menu="0"]'); await until(`!!document.querySelector('.sheet.on [data-m="scheme"]')`); await ev(`document.querySelector('.sheet [data-m="scheme"]').click()`); await until(`!!document.querySelector('.sheet.on .rtab')`); await ev(`document.querySelector('.sheet [data-close]').click()`); await sleep(400);
        await go(); await until(`!!document.querySelector('.sheet.on [data-start]')`); await overflow('pace sheet');
        const pace = await ev(`document.querySelector('.sheet [data-start]').textContent`);
        await click('.sheet [data-start]');
        console.log(`  training: ${vol} | ${days} | ${prog} | ${ses} | ${pace}`);
        await scr('traindone'); await overflow('traindone');
        const tdCta = await ev(`document.getElementById('nextBtn').textContent`);
        const tdLine = await ev(`document.querySelector('.ftl').textContent + ' | ' + [...document.querySelectorAll('.spine .sp')].map(x=>x.className.split(' ')[1] + ':' + x.querySelector('b').textContent).join(', ') + ' | ' + document.querySelector('.spine .sp.goal small').textContent`);
        console.log(`  after training: ${tdLine} | ${tdCta}`);
        if (tdCta !== 'Next: my meals') bad('finish line after training CTA: ' + tdCta);
        // Back returns to the session; starting it again comes back here.
        await ev(`history.back()`); await scr('session');
        await go(); await until(`!!document.querySelector('.sheet.on [data-start]')`); await click('.sheet [data-start]'); await scr('traindone');
        }
        // The meal questions. With a workout plan the training question is left out and every step number moves up one.
        if (P.mealsFirst) await click('.spine [data-to="active"]'); else await go();
        await scr('active'); await overflow('active');
        const activeStep = await ev(`document.querySelector('.screen .qh').textContent`);
        await opt(P.active); await go();
        if (P.mealsFirst) {
          await scr('sessions'); await overflow('sessions');
          const tq = await ev(`document.querySelector('.screen .qh').textContent + ' | ' + [...document.querySelectorAll('.screen .opt')].map(x=>x.textContent).join(' / ')`);
          console.log(`  ${activeStep} | training question: ${tq}`);
          await opt(P.training); await go();
        } else {
          await until(`(function(){var s=document.querySelector('.screen'); return !!s && !s.querySelector('.loading') && !document.querySelector('.screen.out-l,.screen.out-r') && s.children.length>0})()`, 45000);
          const next = await ev(`document.querySelector('.screen').getAttribute('data-screen') + ' ' + document.querySelector('.screen .qh').textContent`);
          console.log(`  ${activeStep} | next: ${next}`);
          if (!/^diettype /.test(next)) bad('training question not skipped with a plan: ' + next);
        }
        const typeIn = (sel, text) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(text)}; e.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
        const seenMeal = []; let edited = false;
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
          if (id === 'mealsummary') {
            const trRow = () => ev(`[...document.querySelectorAll('.srow2')].find(x=>x.textContent.indexOf('Training')===0).querySelector('b').textContent`);
            const tr = await trRow();
            if (P.editTraining && !edited) {
              // The Training row opens the question in edit mode; Save writes it at the summary.
              edited = true;
              await click('[data-ed="sessions"]'); await scr('sessions'); await overflow('sessions edit');
              await opt(P.editTraining); await go(); await scr('mealsummary');
              console.log(`  summary Training row: ${tr} -> ${await trRow()}`);
            } else console.log(`  summary Training row: ${tr}`);
            await click('#nextBtn'); continue;
          }
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
        // Back on the finish line: 100% with both plans, else training is still to do.
        await go(); await scr('alldone'); await overflow('alldone');
        const ad = await ev(`document.querySelector('.fov').textContent + ' | ' + document.querySelector('.ftl').textContent + ' | ' + document.querySelector('.spine .sp.goal small').textContent + ' | ' + document.getElementById('nextBtn').textContent`);
        console.log(`  after meals: ${ad}`);
        const wantCta = P.mealsFirst ? 'Next: my training' : 'Go to my plan';
        if (!ad.endsWith(wantCta)) bad('finish line after meals: ' + ad);
        if (P.mealsFirst) await click('.later [data-to="keep"]'); else await go();
        await scr('keep'); await overflow('keep');
            } catch (e) { bad(String(e.message || e)); }
      for (const e of events) bad(e);
      const posts = requests.filter((r) => r.method !== 'GET');
      const off = requests.filter((r) => r.method === 'GET' && !r.url.startsWith(BASE) && !r.url.startsWith('data:') && !/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com|google-analytics\.com/.test(r.url));
      for (const r of off) bad('unexpected request ' + r.url);
      for (const r of requests) if (/Kiwi|cinnamon/i.test(r.url + r.body)) bad('typed text left the page: ' + r.url);
      for (const p of posts) {
        const isAnalytics = /lambda-url|google-analytics|googletagmanager|analytics\.google/.test(p.url) || /execute-api.*\/shares$/.test(p.url);
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
