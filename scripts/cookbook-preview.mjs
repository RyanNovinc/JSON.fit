// Renders the flip-through preview pages on /cookbook/free-cookbook.html from the built
// cookbook (cookbook/build/cookbook.html, made by build-cookbook.mjs) with headless Chrome,
// one A4 page per image, then webp via sharp into images/cookbook/preview/.
//   node scripts/build-cookbook.mjs --html     # refresh cookbook/build/cookbook.html first
//   node scripts/cookbook-preview.mjs
// Pages are picked by what's on them (cover, contents, start here, dividers, five recipes),
// so they follow the book when page numbers move. The last page of the preview is HTML on the site.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'cookbook/build/cookbook.html');
const OUT = path.join(ROOT, 'images/cookbook/preview');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// [file name, how to find the page]
const PICKS = [
  ['01-cover', (t, c) => /\bcover\b/.test(c)],
  ['02-contents', (t) => /^Contents/.test(t)],
  ['03-start-here', (t) => /^Start here/.test(t)],
  ['04-slow-cooker', (t, c) => /divider/.test(c) && /Slow cooker/.test(t)],
  ['05-butter-chicken', (t, c) => /recipe/.test(c) && /Butter Chicken &(amp;)? Rice/.test(t)],
  ['06-bolognese', (t, c) => /recipe/.test(c) && /Spaghetti Bolognese/.test(t)],
  ['07-pulled-pork', (t, c) => /recipe/.test(c) && /BBQ Pulled Pork/.test(t)],
  ['08-massaman', (t, c) => /recipe/.test(c) && /Massaman Beef/.test(t)],
  ['09-teriyaki', (t, c) => /recipe/.test(c) && /Teriyaki Chicken &(amp;)? Rice/.test(t)],
  ['10-oven-bakes', (t, c) => /divider/.test(c) && /Oven bakes/.test(t)],
  ['11-garlic-butter', (t, c) => /recipe/.test(c) && /Garlic Butter Chicken/.test(t)],
];

const html = readFileSync(SRC, 'utf8');
const secs = html.split(/(?=<section class="page)/).slice(1);
const pageOf = (re) => secs.findIndex((s) => { const c = s.match(/<section class="([^"]+)"/)[1]; const t = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300); return re(t, c); });
const idx = PICKS.map(([name, re]) => { const i = pageOf(re); if (i < 0) throw new Error('page not found: ' + name); return [name, i]; });

const PORT = 9800 + Math.floor(Math.random() * 400);
const prof = mkdtempSync(path.join(os.tmpdir(), 'cbprev-'));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const wait = {};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.value; }

try {
  let url;
  for (let i = 0; i < 50 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!url) await sleep(200); }
  ws = new WebSocket(url); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { d.error ? wait[d.id].rej(new Error(d.error.message)) : wait[d.id].res(d.result); delete wait[d.id]; } };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + SRC });
  await sleep(1500);
  await ev(`document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}))))`);
  mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [name, i] of idx) {
    const r = await ev(`(function(){var s=document.querySelectorAll('section.page')[${i}];s.scrollIntoView();var b=s.getBoundingClientRect();return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height}})()`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    const file = path.join(OUT, name + '.webp');
    await sharp(Buffer.from(shot.data, 'base64')).resize({ width: 794 }).webp({ quality: 72 }).toFile(file);
    total += statSync(file).size;
    console.log(`${name}: book page ${i + 1}`);
  }
  console.log(`preview: ${idx.length} pages, ${Math.round(total / 1024)} KB`);
} finally {
  ch.kill('SIGKILL'); await sleep(300); try { rmSync(prof, { recursive: true, force: true }); } catch {}
}
