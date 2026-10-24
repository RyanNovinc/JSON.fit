#!/usr/bin/env node
/**
 * build-cookbook.mjs: "The One Cook Cookbook" (working title) from r/meals.json.
 *
 *   node scripts/build-cookbook.mjs                 # writes cookbook/build/cookbook.html + the PDF
 *   node scripts/build-cookbook.mjs --html          # HTML only
 *   node scripts/build-cookbook.mjs --preview       # also cookbook/build/preview-*.html (landing page images)
 *
 * Photos: put print-sized JPEGs (1100 px) in cookbook/build/img/<stem>.jpg first, or the PDF is huge.
 * Batch mains come from the app's full-size PNGs, everything else from images/meals/*.png:
 *   node scripts/build-cookbook.mjs --images --app ~/Desktop/Claude/worktrees/<app worktree>
 * cookbook/build/ is git-ignored; the PDF is the artefact.
 *
 * Built from r/meals.json (scripts/refresh-offered-meals.mjs), the meals the app offers:
 * the batch mains (slow cooker, then oven bakes), the breakfasts, the desserts and a short
 * backup meals section (the smoothies) at the end. One A4 page per meal: the photo, the
 * macros per tub or serve, the ingredients, the method and how it keeps.
 *
 * The PDF keeps its old path, cookbook/bulking-cookbook.pdf, so links already sent by
 * email keep working. Rename it (and the link in cookbook/index.html) once the title is final.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const TITLE = 'The One Cook Cookbook';
const SUBTITLE = 'Batch meals that cover your week';

const ROOT = process.cwd();
const all = Object.values(JSON.parse(readFileSync(path.join(ROOT, 'r/meals.json'), 'utf8')));
const OUT_DIR = path.join(ROOT, 'cookbook/build');
const PDF = path.join(ROOT, 'cookbook/bulking-cookbook.pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(path.join(OUT_DIR, 'img'), { recursive: true });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stem = (s) => String(s || '').replace(/\.(png|jpe?g|webp)$/i, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// --images: make the print-sized JPEGs (1100 px wide) the book uses.
if (process.argv.includes('--images')) {
  const APP = process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : null;
  for (const m of all) {
    const out = path.join(OUT_DIR, 'img', stem(m.image_filename) + '.jpg');
    let src = null;
    if (m.batch && APP && m.app_image_filename) src = path.join(APP, 'src/assets/meals', m.app_image_filename);
    if (!src || !existsSync(src)) {
      for (const ext of ['png', 'jpg', 'webp']) {
        const p = path.join(ROOT, 'images/meals', stem(m.image_filename) + '.' + ext);
        if (existsSync(p)) { src = p; break; }
      }
    }
    if (!src) { console.warn('no photo for', m.slug); continue; }
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '66', '--resampleWidth', '1100', src, '--out', out], { stdio: 'ignore' });
  }
  console.log('print images in cookbook/build/img/');
}

const imgFor = (m) => {
  const cands = [m.image_filename, (m.plates[0] || {}).image_filename, m.slug].map(stem).filter(Boolean);
  for (const c of cands) {
    const j = path.join(OUT_DIR, 'img', c + '.jpg');
    if (existsSync(j)) return 'file://' + j;
    const f = path.join(ROOT, 'images/meals', c + '.webp'); if (existsSync(f)) return 'file://' + f;
  }
  return null;
};
const fmtTime = (mins) => { mins = +mins || 0; if (mins >= 60) { const h = Math.floor(mins / 60), r = mins % 60; return r ? `${h} h ${r} min` : `${h} h`; } return `${mins} min`; };
const shortTime = (mins) => { mins = +mins || 0; if (mins >= 60) { const h = Math.floor(mins / 60), r = mins % 60; return r ? `${h}h ${r}m` : `${h}h`; } return `${mins}m`; };
const frac = (n) => {
  const w = Math.floor(n), f = n - w;
  const t = [[0, ''], [0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4'], [1, '']];
  let best = t[0], bd = 9; for (const x of t) { const d = Math.abs(f - x[0]); if (d < bd) { bd = d; best = x; } }
  const W = best[0] === 1 ? w + 1 : w; const F = best[0] === 1 ? '' : best[1];
  if (!W && !F) return String(Math.round(n * 100) / 100);
  return F ? (W ? `${W} ${F}` : F) : String(W);
};
const amount = (i) => {
  const n = Math.round(i.base_amount * 100) / 100;
  if (i.unit === 'g' || i.unit === 'ml') return `${n} ${i.unit}`;
  if (i.unit === 'count' || !i.unit) return frac(n);
  if (i.unit === 'cloves') return `${frac(n)} ${n === 1 ? 'clove' : 'cloves'}`;
  return `${frac(n)} ${i.unit}`;
};
const kcalFmt = (n) => Math.round(n).toLocaleString('en-AU');

// Sections: the batch mains split by how they cook, then breakfasts, desserts, backup meals.
const SECTION = (m) => {
  const s = (m.site || {}).section;
  if (s === 'batch') return m.batch.method === 'oven' ? 'Oven bakes' : 'Slow cooker';
  return { breakfast: 'Breakfast', dessert: 'Desserts', backup: 'Backup meals' }[s] || 'Desserts';
};
const ORDER = ['Slow cooker', 'Oven bakes', 'Breakfast', 'Desserts', 'Backup meals'];
const BLURB = {
  'Slow cooker': 'About ten minutes of work, then the pot does the rest. One cook makes 8 tubs: the next 3 days in the fridge, the rest in the freezer.',
  'Oven bakes': 'One dish or tray into the oven, then cut into 8 and into tubs. The same week of food, no pot to watch.',
  Breakfast: 'Most take five minutes or are made once and kept. The rest are cooked fresh when you have the time.',
  Desserts: 'Protein in the one place you were going to have something sweet anyway. Several are made once for the week.',
  'Backup meals': 'Didn\'t get to a meal? Blend one of these in about 4 minutes instead.',
};
const meals = all.slice();
const sections = ORDER.map((name) => ({ name, meals: meals.filter((m) => SECTION(m) === name) }));
const batchMeals = meals.filter((m) => m.batch);

for (const s of sections) s.meals.sort((a, b) => a.display_name.localeCompare(b.display_name));

// Page numbering: cover 1, contents 2, skim 3-4, start here 5, then per section a divider + one page per meal, closing page last.
let page = 6;
for (const s of sections) { s.page = page; page += 1; for (const m of s.meals) { m.page = page; page += 1; } }
const CLOSING_PAGE = page;
const TOTAL = page;

const method0 = (m) => m.methods[0];
const activeMin = (m) => (m.batch ? m.batch.hands_on_minutes : method0(m).time_active_minutes || method0(m).time_total_minutes || 0);
const totalMin = (m) => (m.batch ? m.batch.total_minutes : method0(m).time_total_minutes || 0);
const prepFlags = (m) => { const st = (m.meal_prep || {}).storage || {}; return st.freeze_months ? 'F' : ''; };
const defaultPlate = (m) => m.plates.find((p) => p.id === 'standard') || m.plates[0];
const macros = (m) => defaultPlate(m).plate_macros || {};

// Start-here picks: one per section (not the backup meals), the least hands-on time, then the most protein.
const picks = sections.filter((s) => s.name !== 'Backup meals').map((s) => s.meals.slice().sort((a, b) => activeMin(a) - activeMin(b) || macros(b).protein_g - macros(a).protein_g)[0]).filter(Boolean);
const batchTen = batchMeals.filter((m) => activeMin(m) <= 10).length;
const freezes = meals.filter((m) => ((m.meal_prep || {}).storage || {}).freeze_months).length;

const css = `@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Outfit',-apple-system,sans-serif;color:#15151a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#faf9f6}
.page:last-child{page-break-after:auto;break-after:auto}
.dark{background:#08080b;color:#f2f2f4}
.mono{font-family:'DM Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;font-size:7.5pt}
.serif{font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:600;font-variation-settings:"opsz" 144;letter-spacing:-.01em}
.g{color:#16a34a}.dark .g{color:#4ade80}
.dim{color:#6f6f7a}.dark .dim{color:#8a8a95}
.foot{position:absolute;left:14mm;right:14mm;bottom:9mm;display:flex;justify-content:space-between;align-items:baseline;font-family:'DM Mono',monospace;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:#8a8a95}
.foot b{font-weight:500;color:#15151a}.dark .foot b{color:#f2f2f4}
/* cover */
.cover{padding:18mm 16mm}
.cover .brand{display:flex;align-items:center;gap:4mm;font-weight:600;font-size:12pt}
.cover .brand img{width:9mm;height:9mm;border-radius:2.2mm}
.cover h1{font-size:50pt;line-height:.98;margin:5mm 0 8mm;max-width:160mm}
.cover p.lede{font-size:13pt;line-height:1.45;max-width:135mm;color:#c7c7cf;margin:0 0 10mm}
.cover .plates{position:absolute;left:16mm;right:16mm;bottom:28mm;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
.cover .plate{border-radius:4mm;overflow:hidden;height:46mm;position:relative;background:#111}
.cover .plate img{width:100%;height:100%;object-fit:cover;display:block}
.cover .plate span{position:absolute;left:0;right:0;bottom:0;padding:8mm 3.5mm 3mm;background:linear-gradient(180deg,rgba(8,8,11,0),rgba(8,8,11,.92));font-size:8.5pt;font-weight:600}
.cover .plate small{display:block;font-family:'DM Mono',monospace;font-weight:400;font-size:7pt;color:#a3a3ad;margin-top:.6mm;letter-spacing:.04em}
.cover .trust{position:absolute;left:16mm;bottom:16mm;font-size:10pt;color:#a3a3ad}.cover .trust b{color:#f2f2f4}
/* text pages */
.text{padding:18mm 16mm}
.text h2{font-size:30pt;line-height:1;margin:3mm 0 5mm}
.text p{font-size:10.5pt;line-height:1.5;max-width:150mm;margin:0 0 3mm}
.toc{margin-top:10mm}
.toc .row{display:grid;grid-template-columns:12mm 1fr auto auto;gap:5mm;align-items:baseline;padding:4mm 0;border-top:1px solid #e3e1da}
.toc .row:last-child{border-bottom:1px solid #e3e1da}
.toc .n{font-family:'DM Mono',monospace;font-size:9pt;color:#8a8a95}
.toc .t{font-size:18pt;font-weight:600}
.toc .c{font-family:'DM Mono',monospace;font-size:8pt;color:#6f6f7a}
.toc .p{font-family:'DM Mono',monospace;font-size:10pt}
.skim{columns:2;column-gap:8mm;margin-top:5mm}
.skim h3{break-after:avoid;font-family:'DM Mono',monospace;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;color:#16a34a;margin:4mm 0 1.5mm}
.skim h3:first-child{margin-top:0}
.skim .r{display:flex;justify-content:space-between;gap:3mm;font-size:8.6pt;line-height:1.35;padding:.9mm 0;border-top:1px solid #ebe9e3;break-inside:avoid}
.skim .r span:last-child{font-family:'DM Mono',monospace;font-size:7.2pt;color:#6f6f7a;white-space:nowrap}
.starts{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:6mm}
.start{border-radius:3.5mm;overflow:hidden;background:#fff;border:1px solid #e3e1da;break-inside:avoid}
.start img{width:100%;height:34mm;object-fit:cover;display:block}
.start .b{padding:3.5mm 4mm 4mm}
.start .b b{display:block;font-size:12pt;line-height:1.2}
.start .b small{display:block;font-family:'DM Mono',monospace;font-size:7.5pt;color:#6f6f7a;margin-top:1.2mm;letter-spacing:.04em}
.start .b p{font-size:8.8pt;line-height:1.4;margin:1.5mm 0 0;color:#3b3b44;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.start.wide{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}
.start.wide img{height:100%}
/* divider */
.divider{padding:18mm 16mm;display:flex;flex-direction:column;justify-content:flex-end}
.divider h2{font-size:64pt;line-height:.95;margin:0 0 6mm}
.divider p{font-size:12pt;line-height:1.5;max-width:130mm;color:#c7c7cf;margin:0 0 12mm}
.divider .wall{position:absolute;left:0;right:0;top:0;height:150mm;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:75mm}
.divider .wall img{width:100%;height:100%;object-fit:cover;display:block}
.divider .wall::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,8,11,.05),rgba(8,8,11,.25) 60%,#08080b 100%)}
/* recipe */
.recipe .photo{height:84mm;overflow:hidden;background:#111;position:relative}
.recipe .photo img{width:100%;height:100%;object-fit:cover;display:block}
.recipe .photo .tag{position:absolute;left:14mm;bottom:5mm;color:#fff;font-family:'DM Mono',monospace;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.recipe .body{padding:7mm 14mm 0}
.recipe h2{font-size:24pt;line-height:1.02;margin:0 0 2mm;max-width:150mm}
.recipe .desc{font-size:9.6pt;line-height:1.45;color:#3b3b44;margin:0 0 4mm;max-width:170mm}
.macros{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin:0 0 4.5mm}
.macros div{background:#fff;border:1px solid #e3e1da;border-radius:2.5mm;padding:2.6mm 3mm 2.2mm}
.macros b{display:block;font-size:17pt;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.macros span{font-family:'DM Mono',monospace;font-size:6.8pt;letter-spacing:.14em;text-transform:uppercase;color:#6f6f7a}
.macros .k b{color:#16a34a}
.cols{display:grid;grid-template-columns:62mm 1fr;gap:8mm}
.lbl{font-family:'DM Mono',monospace;font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:#16a34a;margin:0 0 2mm}
.ing{list-style:none;margin:0;padding:0}
.ing li{display:flex;justify-content:space-between;gap:3mm;font-size:8.8pt;line-height:1.3;padding:1.5mm 0;border-top:1px solid #e8e6df}
.ing li:first-child{border-top:0;padding-top:0}
.ing li span:last-child{font-family:'DM Mono',monospace;font-size:7.6pt;color:#3b3b44;white-space:nowrap;font-variant-numeric:tabular-nums}
.ing li small{display:block;color:#8a8a95;font-size:7.6pt;line-height:1.3}
.ing .sub{font-family:'DM Mono',monospace;font-size:6.6pt;letter-spacing:.14em;text-transform:uppercase;color:#8a8a95;padding:3mm 0 1mm}
.steps{list-style:none;margin:0;padding:0;counter-reset:s}
.steps li{position:relative;padding:0 0 2.4mm 8mm;font-size:9.3pt;line-height:1.42}
.steps li::before{counter-increment:s;content:counter(s);position:absolute;left:0;top:.3mm;width:5.2mm;height:5.2mm;border-radius:50%;background:#16a34a;color:#fff;font-family:'DM Mono',monospace;font-size:7pt;display:flex;align-items:center;justify-content:center}
.notes{margin-top:3mm;padding-top:2.5mm;border-top:1px solid #e3e1da;font-size:8.2pt;line-height:1.45;color:#3b3b44}
.notes b{font-weight:600;color:#15151a}
.ways{margin:0 0 3mm;font-size:8.2pt;color:#3b3b44;line-height:1.45}
.ways b{font-weight:600}
.recipe.long .steps li{font-size:8.7pt;line-height:1.36;padding-bottom:1.8mm}
.recipe.long .ing li{font-size:8.3pt;padding:1.1mm 0}
.recipe.long .photo{height:70mm}
.recipe.long .desc{display:none}
.recipe.short .photo{height:108mm}
/* closing */
.closing{padding:18mm 16mm;display:flex;flex-direction:column;justify-content:center}
.closing h2{font-size:44pt;line-height:1;margin:0 0 6mm}
.closing p{font-size:12pt;line-height:1.5;max-width:135mm;color:#c7c7cf;margin:0 0 5mm}
.closing ul{margin:0 0 10mm;padding:0;list-style:none;font-size:11pt;line-height:1.8;color:#f2f2f4}
.closing ul li::before{content:"✓";color:#4ade80;margin-right:3mm}
.closing .qr{display:flex;align-items:center;gap:6mm}
.closing .qr img{width:30mm;height:30mm;background:#fff;padding:2mm;border-radius:2.5mm}
.closing .qr span{font-size:10.5pt;line-height:1.5;color:#c7c7cf}
.closing .qr span b{display:block;color:#f2f2f4;font-size:13pt}
.steps li b{font-weight:600}
.recipe.xlong .photo{height:54mm}
.recipe.xlong .body{padding-top:5mm}
.recipe.xlong h2{font-size:20pt}
.recipe.xlong .macros{margin-bottom:3mm}
.recipe.xlong .macros div{padding:1.8mm 3mm 1.6mm}
.recipe.xlong .macros b{font-size:14pt}
.recipe.xlong .cols{grid-template-columns:66mm 1fr;gap:6mm}
.recipe.xlong .steps li{font-size:8.1pt;line-height:1.32;padding-bottom:1.4mm}
.recipe.xlong .ing li{font-size:7.9pt;padding:.9mm 0}
.recipe.xlong .ing li small{font-size:6.9pt}
.recipe.xlong .notes{font-size:7.6pt}
`;

const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@1,9..144,500..700&family=Outfit:wght@400;500;600;700&display=swap">
<style>${css}</style></head><body>`;

const foot = (p, left) => `<div class="foot"><span>${left || `${TITLE} · <b>json.fit</b>`}</span><span>${p} / ${TOTAL}</span></div>`;
const per = (m) => (m.batch ? 'per tub' : 'per serve');

const coverPlates = ['butter_chicken_and_rice', 'spaghetti_bolognese', 'teriyaki_chicken_and_rice'].map((s) => meals.find((m) => m.slug === s)).filter(Boolean);
const cover = `<section class="page dark cover">
  <div class="brand"><img src="file://${path.join(ROOT, 'icon-180-3.png')}" alt=""><span>JSON.fit</span></div>
  <p class="mono dim" style="margin:104mm 0 0">The free cookbook</p>
  <h1 class="serif">The One Cook <span class="g">Cookbook.</span></h1>
  <p class="lede">${SUBTITLE}. ${batchMeals.length} batch meals you cook once for 8 tubs, plus breakfasts, desserts and backup meals. Every ingredient, every step and the macros for each one.</p>
  <div class="plates">${coverPlates.map((m) => `<div class="plate"><img src="${imgFor(m)}" alt=""><span>${esc(m.display_name)}<small>${activeMin(m)} min hands-on · ${m.batch.tubs} tubs</small></span></div>`).join('')}</div>
  <p class="trust"><b>Free</b> · No ads · No account · json.fit</p>
</section>`;

const contents = `<section class="page text">
  <p class="mono g">Contents</p>
  <h2 class="serif">What's inside.</h2>
  <p>${batchMeals.length} batch meals, each one cook for 8 tubs. ${batchTen} of them take 10 minutes or less of hands-on work; the slow cooker or the oven does the rest. ${freezes} recipes in the book freeze. Each recipe is one page: the plate, the numbers, the ingredients, the method and how it keeps.</p>
  <div class="toc">
    <div class="row"><span class="n">01</span><span class="t">Skim it</span><span class="c">every meal, time and kcal</span><span class="p">3</span></div>
    <div class="row"><span class="n">02</span><span class="t">Start with these</span><span class="c">one from each section</span><span class="p">5</span></div>
    ${sections.map((s, i) => `<div class="row"><span class="n">0${i + 3}</span><span class="t">${s.name}</span><span class="c">${s.meals.length} recipes</span><span class="p">${s.page}</span></div>`).join('')}
    <div class="row"><span class="n">0${sections.length + 3}</span><span class="t">Now let the app do it</span><span class="c">the same meals, planned</span><span class="p">${CLOSING_PAGE}</span></div>
  </div>
  ${foot(2)}
</section>`;

const skimHalf = (secs, p, first) => `<section class="page text">
  ${first ? `<p class="mono g">Skim it</p><h2 class="serif">The whole book at a glance.</h2><p class="dim" style="font-size:8.5pt">hands-on minutes / total time · kcal per tub or serve · F = freezes</p>` : `<p class="mono g">Skim it</p><h2 class="serif">Continued.</h2>`}
  <div class="skim">${secs.map((s) => `<h3>${s.name}</h3>${s.meals.map((m) => `<div class="r"><span>${esc(m.display_name)}</span><span>${activeMin(m)}m / ${shortTime(totalMin(m))} · ${kcalFmt(macros(m).kcal)}${prepFlags(m) ? ' · ' + prepFlags(m) : ''} · p${m.page}</span></div>`).join('')}`).join('')}</div>
  ${foot(p)}
</section>`;
const skim = skimHalf(sections.slice(0, 2), 3, true) + skimHalf(sections.slice(2), 4, false);

const startHere = `<section class="page text">
  <p class="mono g">Start here</p>
  <h2 class="serif">Start with these.</h2>
  <p>New to batch cooking? One from each section, the least hands-on work in it. Cook one batch this week and you have lunch or dinner sorted for days.</p>
  <div class="starts">${picks.map((m, i) => `<div class="start${i === 0 ? ' wide' : ''}"><img src="${imgFor(m)}" alt=""><div class="b"><b>${esc(m.display_name)}</b><small>${SECTION(m)} · ${activeMin(m)} min hands-on · ${fmtTime(totalMin(m))} total · ${kcalFmt(macros(m).kcal)} kcal · ${Math.round(macros(m).protein_g)} g protein · p${m.page}</small><p>${esc(defaultPlate(m).description || '')}</p></div></div>`).join('')}</div>
  ${foot(5)}
</section>`;

const divider = (s) => `<section class="page dark divider">
  <div class="wall">${s.meals.slice(0, 6).map((m) => `<img src="${imgFor(m)}" alt="">`).join('')}</div>
  <p class="mono dim">${s.meals.length} recipes · pages ${s.meals[0].page} to ${s.meals[s.meals.length - 1].page}</p>
  <h2 class="serif">${s.name}<span class="g">.</span></h2>
  <p>${BLURB[s.name]}</p>
  ${foot(s.page)}
</section>`;

const stepText = (s) => (typeof s === 'string' ? esc(s) : (s.title ? `<b>${esc(s.title)}.</b> ` : '') + esc(s.summary || ''));
const ingRow = (i, each, batch) => {
  const pack = batch && i.pack && i.pack !== 'pantry' ? i.pack : '';
  const sub = batch ? (pack ? `Buy: ${pack}` : i.pack === 'pantry' ? 'pantry' : '') : (i.notes || '');
  return `<li><span>${esc(i.display_name)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span>${amount(i)}${each ? ' each' : ''}</span></li>`;
};

const recipe = (m) => {
  const method = method0(m);
  const plate = defaultPlate(m);
  const pm = plate.plate_macros;
  const batch = !!m.batch;
  const ings = method.ingredients;
  const extra = plate.additional_ingredients || [];
  const cook = method.instructions;
  const day = plate.additional_instructions || [];
  const words = cook.concat(day).map((s) => s.summary || '').join(' ').split(/\s+/).length;
  const packWords = batch ? ings.concat(extra).map((i) => i.pack || '').join(' ').split(/\s+/).length : 0;
  const lines = ings.length + extra.length;
  const xlong = words + packWords * 0.6 > 330 || lines > 15;
  const long = !xlong && (words > 150 || lines > 11 || cook.length + day.length > 6);
  const short = !long && !xlong && words < 95 && lines <= 7;
  const otherPlates = m.plates.filter((p) => p !== plate);
  const prep = m.meal_prep || {};
  const st = prep.storage || {};
  const storage = [st.fridge_days ? `fridge ${st.fridge_days} days` : null, st.freeze_months ? `freezer ${st.freeze_months} month${st.freeze_months === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
  const notes = [];
  if (storage) notes.push(`<b>Keeps:</b> ${esc(storage)}.`);
  if (batch && m.batch.freezer_note) notes.push(esc(m.batch.freezer_note));
  if (batch && m.batch.side) notes.push(`<b>With it:</b> ${esc(m.batch.side.replace(/\.?$/, '.'))}`);
  if (!batch && prep.prep_note && prep.storage) notes.push(esc(prep.prep_note));
  const other = m.methods.slice(1);
  if (other.length) notes.push(`<b>Or:</b> ${other.map((o) => `${esc(o.display_name)}, ${fmtTime(o.time_total_minutes)}`).join('; ')}. Steps in the app.`);
  const yieldTxt = batch ? `${m.batch.tubs} tubs` : (m.produces_servings || 1) > 1 ? `makes ${m.produces_servings}` : '';
  const kicker = [SECTION(m), `${activeMin(m)} min hands-on`, `${fmtTime(totalMin(m))} total`, yieldTxt, batch ? null : method.display_name].filter(Boolean).join(' · ');
  const ingLbl = batch ? `Ingredients · whole pot, ${m.batch.tubs} tubs` : (m.produces_servings || 1) > 1 ? `Ingredients · makes ${m.produces_servings}` : 'Ingredients · 1 serve';
  const stepsHtml = batch && day.length
    ? `<ol class="steps">${cook.map((s) => `<li>${stepText(s)}</li>`).join('')}</ol><p class="lbl" style="margin-top:2mm">On the day</p><ol class="steps" style="counter-reset:s ${cook.length}">${day.map((s) => `<li>${esc(s.summary)}</li>`).join('')}</ol>`
    : `<ol class="steps">${cook.concat(day).map((s) => `<li>${stepText(s)}</li>`).join('')}</ol>`;
  return `<section class="page recipe${xlong ? ' long xlong' : long ? ' long' : short ? ' short' : ''}">
  <div class="photo"><img src="${imgFor(m)}" alt=""><div class="tag">${esc(kicker)}</div></div>
  <div class="body">
    <h2 class="serif">${esc(m.display_name)}</h2>
    <p class="desc">${esc(plate.description || '')}</p>
    <div class="macros"><div class="k"><b>${kcalFmt(pm.kcal)}</b><span>kcal ${per(m)}</span></div><div><b>${Math.round(pm.protein_g)} g</b><span>protein</span></div><div><b>${Math.round(pm.carbs_g)} g</b><span>carbs</span></div><div><b>${Math.round(pm.fat_g)} g</b><span>fat</span></div></div>
    ${otherPlates.length ? `<p class="ways"><b>${m.plates.length} ways to serve.</b> ${otherPlates.map((p) => `${esc(p.display_name)} ${kcalFmt(p.plate_macros.kcal)} kcal / ${Math.round(p.plate_macros.protein_g)} g`).join(' · ')}. Recipes for each in the app.</p>` : ''}
    <div class="cols">
      <div><p class="lbl">${ingLbl}</p><ul class="ing">${ings.map((i) => ingRow(i, false, batch)).join('')}${extra.length ? `<li class="sub">${batch ? 'On the day, per tub' : 'To plate it up'}</li>${extra.map((i) => ingRow(i, false, batch)).join('')}` : ''}</ul></div>
      <div><p class="lbl">Method</p>${stepsHtml}${notes.length ? `<div class="notes">${notes.join(' ')}</div>` : ''}</div>
    </div>
  </div>
  ${foot(m.page, `${esc(SECTION(m))} · <b>${esc(m.display_name)}</b>`)}
</section>`;
};

const closing = `<section class="page dark closing">
  <p class="mono dim">JSON.fit for iPhone and Android</p>
  <h2 class="serif">Now let the app <span class="g">do it.</span></h2>
  <p>The book is the static version. The app takes these same ${meals.length} meals and builds your week around your numbers: which batch to cook, which tubs go in the fridge and which in the freezer, one shopping list, one cook.</p>
  <ul><li>Your calorie and protein targets, worked out from your goal</li><li>A week of meals that lands on them. Swap any meal, the day rebalances.</li><li>One grocery list by aisle, one cook for the week</li><li>Cook mode with a timer on every step</li><li>Training programmed to match</li></ul>
  <div class="qr"><img src="file://${path.join(ROOT, 'images/qr-app.svg')}" alt="QR code"><span><b>json.fit/app</b>Point your phone's camera here, or search JSON.fit on the App Store or Google Play.<br>Free · No ads · No account</span></div>
  ${foot(CLOSING_PAGE)}
</section>`;

const html = head + cover + contents + skim + startHere + sections.map((s) => divider(s) + s.meals.map(recipe).join('')).join('') + closing + '</body></html>';
const htmlPath = path.join(OUT_DIR, 'cookbook.html');
if (process.argv.includes('--preview')) {
  const pick = (slug) => meals.find((m) => m.slug === slug);
  const one = { cover, start: startHere, closing, mains: divider(sections[0]), 'page-breakfast': recipe(pick('protein_pancakes')), 'page-main': recipe(pick('butter_chicken_and_rice')), 'page-dessert': recipe(pick('fudgy_protein_brownies')) };
  for (const [k, v] of Object.entries(one)) writeFileSync(path.join(OUT_DIR, `preview-${k}.html`), head + v + '</body></html>');
  console.log('preview-*.html written');
}
writeFileSync(htmlPath, html);
console.log(`cookbook.html: ${TOTAL} pages expected (${meals.length} recipes: ${sections.map((s) => `${s.meals.length} ${s.name.toLowerCase()}`).join(', ')}), missing images: ${meals.filter((m) => !imgFor(m)).map((m) => m.slug).join(', ') || 'none'}`);

if (!process.argv.includes('--html')) {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=20000', `--print-to-pdf=${PDF}`, 'file://' + htmlPath], { stdio: 'ignore' });
  console.log(`wrote ${path.relative(ROOT, PDF)}`);
}
