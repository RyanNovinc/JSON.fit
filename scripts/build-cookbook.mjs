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
 *
 * Print friendly: white pages throughout. The photos are cut out of their black studio
 * background by scripts/cookbook-white-photos.mjs (cookbook/build/white-photos/); the few the
 * cut-out can't do cleanly (KEEP_BLACK) stay as framed photos on their black background.
 *   --cover white|dark   white cover (default) or the dark one, the book's only dark page
 *   --out <file.pdf>     write the PDF somewhere else (to review before replacing the live one)
 *
 * Print on demand (IngramSpark case laminate hardcover, 8.5 x 11 in). Neither touches the live PDF
 * or cookbook/build/cookbook.html (the site preview reads that one):
 *   --print letter       the interior: 8.5 x 11 in trim plus 0.125 in bleed on the top, bottom and
 *                        outside edge (none on the bind edge), so a recto sheet is trim + bleed on the
 *                        right and a verso trim + bleed on the left. Wider inside margin for the gutter,
 *                        a title page and an imprint page in place of the cover, blank pages at the end
 *                        to a multiple of 4. --isbn <13 digits> prints it on the imprint page.
 *                        Default out: cookbook/build/cookbook-print-letter.pdf
 *   --print wrap         the case laminate cover wrap (back + spine + front) at IngramSpark's case size:
 *                        width 0.625 + board + 0.5 hinge + spine + 0.5 hinge + board + 0.625, height
 *                        0.625 + board + 0.625; board = trim width - 0.185 in by trim height + 0.25 in.
 *                        --spine <in> (default 0.375): take it from IngramSpark's cover template.
 *                        --guides also draws trim, fold, hinge and safe lines (preview only, never print).
 *                        Default out: cookbook/build/cookbook-cover-wrap.pdf
 *   --check              with --print: writes <out>.check.json (overflow past the safe area, image ppi)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const TITLE = 'The One Cook Cookbook';
const SUBTITLE = 'Batch meals that cover your week';

const ROOT = process.cwd();
const all = Object.values(JSON.parse(readFileSync(path.join(ROOT, 'r/meals.json'), 'utf8')));
const OUT_DIR = path.join(ROOT, 'cookbook/build');
const argv = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const PRINT = argv('--print');
if (PRINT && !['letter', 'wrap'].includes(PRINT)) throw new Error('--print letter|wrap');
const PDF = argv('--out') ? path.resolve(argv('--out'))
  : PRINT ? path.join(OUT_DIR, PRINT === 'wrap' ? 'cookbook-cover-wrap.pdf' : 'cookbook-print-letter.pdf')
  : path.join(ROOT, 'cookbook/bulking-cookbook.pdf');
const COVER = argv('--cover') === 'dark' ? 'dark' : 'white';
// Print: the imprint page and title page add one page before the contents, so every page number moves up one.
const OFF = PRINT === 'letter' ? 1 : 0;
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

// Print: the photos "on white" are 253-254 white, which a printer can lay as a faint box of ink.
// Their near-whites are eased up to paper white (240 and below untouched), saved in cookbook/build/print-white/.
const PRINT_WHITE = new Map();
const printWhite = (f) => PRINT_WHITE.get(f) || f;
if (PRINT) {
  const sharp = (await import('sharp')).default;
  const dir = path.join(OUT_DIR, 'print-white'); mkdirSync(dir, { recursive: true });
  const lut = new Uint8Array(256).map((_, v) => (v <= 240 ? v : Math.min(255, Math.round(240 + (v - 240) * 1.6))));
  for (const n of readdirSync(path.join(ROOT, 'images/cookbook/white')).filter((n) => n.endsWith('.jpg'))) {
    const src = path.join(ROOT, 'images/cookbook/white', n), out = path.join(dir, n);
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs) {
      const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i++) data[i] = lut[data[i]];
      await sharp(data, { raw: info }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(out);
    }
    PRINT_WHITE.set(src, out);
  }
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
// Photos the automatic cut-out can't do cleanly (glass stems, mug handles, dark pans and plates
// that are part of the dish): shown as a framed photo on black, until a photo shot on white is saved
// as images/cookbook/white/<stem>.jpg.
const KEEP_BLACK = new Set(['batch-massaman-beef', 'chocolate-protein-mousse', 'chocolate-protein-mug-cake', 'cottage-cheese-ice-cream', 'fudgy-protein-brownies', 'raspberry-rip', 'smoked-salmon-bagel']);
// The photo for a white page: { src, cut } (cut = the cut-out on white with its shadow baked in, else the black original).
const photoFor = (m) => {
  const cands = [m.image_filename, (m.plates[0] || {}).image_filename, m.slug].map(stem).filter(Boolean);
  for (const c of cands) {
    // A photo shot on white (images/cookbook/white/<stem>.jpg) beats the automatic cut-out.
    const shot = path.join(ROOT, 'images/cookbook/white', c + '.jpg');
    if (existsSync(shot)) return { src: 'file://' + (PRINT ? printWhite(shot) : shot), cut: true };
    const w = path.join(OUT_DIR, 'white-photos', c + '.jpg');
    if (!KEEP_BLACK.has(c) && existsSync(w)) return { src: 'file://' + w, cut: true };
  }
  return { src: imgFor(m), cut: false };
};
const photo = (m, cls = '') => { const p = photoFor(m); return `<img class="${p.cut ? 'cut' : 'framed'}${cls ? ' ' + cls : ''}" src="${p.src}" alt="">`; };
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
  'Slow cooker': 'About ten minutes of work, then the pot does the rest. One cook makes 8 tubs: the next 3 days in the fridge, the rest in the freezer. Any 5.5 L slow cooker works. Not sponsored, no commission: the Contempo 5.5 L is $24 at Big W (bigw.com.au), cheaper than one week of prepared meals.',
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
let page = 6 + OFF;
for (const s of sections) { s.page = page; page += 1; for (const m of s.meals) { m.page = page; page += 1; } }
const CLOSING_PAGE = page;
// Print: blank pages after the closing page, at least one (the printer's own page goes last), to a multiple of 4.
const BLANKS = PRINT === 'letter' ? 4 - (CLOSING_PAGE % 4) : 0;
const TOTAL = CLOSING_PAGE + BLANKS;

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
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
/* photos on white: cut-outs float with a soft shadow; the few that keep their black studio sit in a rounded frame */
img.cut{object-fit:contain!important;mix-blend-mode:multiply}
img.framed{object-fit:cover;border-radius:3.5mm;background:#08080b}
.page:last-child{page-break-after:auto;break-after:auto}
.dark{background:#08080b;color:#f2f2f4}
.mono{font-family:'DM Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;font-size:7.5pt}
.serif{font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:600;font-variation-settings:"opsz" 144;letter-spacing:-.01em}
.g{color:#16a34a}.dark .g{color:#4ade80}
.dim{color:#6f6f7a}.dark .dim{color:#8a8a95}
.foot{position:absolute;left:14mm;right:14mm;bottom:9mm;display:flex;justify-content:space-between;align-items:baseline;font-family:'DM Mono',monospace;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:#8a8a95}
.foot b{font-weight:500;color:#15151a}.dark .foot b{color:#f2f2f4}
/* cover: big title, big food, nothing small to read */
.cover.white .food{top:96mm;grid-template-rows:1.35fr 1fr 1fr;gap:2mm 6mm}
.cover.white .food div{background:none;overflow:hidden;border-radius:0;min-height:0;min-width:0}
.cover.white .food img{transform:none;object-fit:contain!important;mix-blend-mode:multiply}
.cover.white .food div:first-child img{height:100%;transform:scale(.96)}
.cover.white .badge{z-index:2}
.cover.white .food img.framed{transform:none}
.cover.white h1{color:#15151a}
.cover.white .badge{left:2mm;top:0}
.cover{padding:16mm 14mm}
.cover .brand{display:flex;align-items:center;gap:4mm;font-weight:600;font-size:13pt}
.cover .brand img{width:9mm;height:9mm;border-radius:2.2mm}
.cover .brand .wm{display:block;height:7.5mm;width:auto}
.cover h1{font-size:72pt;line-height:.92;margin:10mm 0 0;letter-spacing:-.02em}
.cover h1 span{display:block}
.cover .food{position:absolute;left:14mm;right:14mm;top:92mm;bottom:14mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1.3fr 1fr 1fr;gap:4mm}
.cover .food div{border-radius:5mm;overflow:hidden;background:#111;position:relative}
.cover .food div:first-child{grid-column:1/-1}
.cover .food img{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.32)}
.cover .food div:first-child img{transform:scale(1.18)}
.cover .badge{position:absolute;left:6mm;top:6mm;z-index:2;display:inline-flex;align-items:center;gap:2.5mm;padding:3mm 5.5mm;border-radius:99px;background:#4ade80;color:#06210f;font-weight:800;font-size:15pt;letter-spacing:.01em}
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
.start img.cut{padding:2mm 3mm 0}
.start img.framed{border-radius:0}
.start .b{padding:3.5mm 4mm 4mm}
.start .b b{display:block;font-size:12pt;line-height:1.2}
.start .b small{display:block;font-family:'DM Mono',monospace;font-size:7.5pt;color:#6f6f7a;margin-top:1.2mm;letter-spacing:.04em}
.start .b p{font-size:8.8pt;line-height:1.4;margin:1.5mm 0 0;color:#3b3b44;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.start.wide{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}
.start.wide img{height:100%}
/* divider */
.divider{padding:18mm 16mm;display:flex;flex-direction:column;justify-content:flex-end}
.divider h2{font-size:64pt;line-height:.95;margin:0 0 6mm}
.divider p{font-size:12pt;line-height:1.5;max-width:140mm;color:#3b3b44;margin:0 0 12mm}
.divider .wall{position:absolute;left:14mm;right:14mm;top:14mm;height:168mm;display:grid;grid-template-columns:repeat(2,1fr);grid-auto-rows:54mm;gap:3mm 8mm}
.divider .wall img{width:100%;height:100%;object-fit:contain;display:block}
.divider .wall img.framed{object-fit:cover;height:48mm;margin-top:3mm}
.divider h2 .g,.closing h2 .g{color:#16a34a}
/* recipe */
.recipe .photo{height:84mm;overflow:hidden;background:#fff;position:relative;padding:7mm 14mm 0}
.recipe .photo img{width:100%;height:100%;object-fit:cover;display:block}
.recipe .photo img.cut{height:calc(100% - 7mm)}
.recipe .photo img.framed{height:calc(100% - 9mm)}
.recipe .photo .tag{position:absolute;left:14mm;bottom:1mm;color:#6f6f7a;font-family:'DM Mono',monospace;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase}
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
.closing p{font-size:12pt;line-height:1.5;max-width:135mm;color:#3b3b44;margin:0 0 5mm}
.closing ul{margin:0 0 10mm;padding:0;list-style:none;font-size:11pt;line-height:1.8;color:#15151a}
.closing ul li::before{content:"✓";color:#16a34a;margin-right:3mm}
.closing .qr{display:flex;align-items:center;gap:6mm}
.appnote{display:flex;align-items:center;gap:5mm;margin-top:9mm;padding:4mm 5mm;border:1px solid #e3e1da;border-radius:3mm;background:#f7faf8}
.appnote img{width:20mm;height:20mm;flex:none;background:#fff;padding:1.5mm;border-radius:2mm}
.appnote span{font-size:9.5pt;line-height:1.5;color:#3b3b44}
.appnote span b{display:block;color:#15151a;font-size:11pt;margin-bottom:1mm}
.closing .qr img{width:30mm;height:30mm;background:#fff;padding:2mm;border-radius:2.5mm;border:1px solid #e3e1da}
.closing .qr span{font-size:10.5pt;line-height:1.5;color:#3b3b44}
.closing .qr span b{display:block;color:#15151a;font-size:13pt}
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

// The Coast wordmark (DM Serif Display italic, outlined so the PDF needs no web font).
const WORDMARK = `<svg class="wm" viewBox="4 -63 248 66" role="img" aria-label="Coast"><path fill="currentColor" d="M21.9 1.5Q14.5 1.5 9.8 -3.5Q5.1 -8.5 5.1 -17.5Q5.1 -23.9 7.3 -29.6Q9.5 -35.4 13.5 -39.9Q17.4 -44.4 22.6 -47Q27.7 -49.6 33.6 -49.6Q37.1 -49.6 40.2 -48.5Q43.2 -47.4 45.1 -45.4Q46.9 -43.4 46.8 -40.7Q46.7 -38 45.1 -36.5Q43.5 -34.9 40.9 -34.9Q38.1 -34.9 36.4 -36.6Q34.7 -38.3 33.7 -40.5L33.1 -42.2Q31.7 -45.5 30.7 -46.2Q29.6 -46.8 27.1 -44.7Q24.4 -42.4 22.1 -38.5Q19.7 -34.6 18.3 -29.9Q16.9 -25.2 16.9 -20.3Q16.9 -12.8 20.2 -9.2Q23.4 -5.7 28.9 -5.7Q32.5 -5.7 36 -8Q39.5 -10.3 42.5 -14.4L43.9 -13.4Q41.8 -9.5 38.5 -6.1Q35.2 -2.7 31 -0.6Q26.7 1.5 21.9 1.5ZM69 1.5Q63.8 1.5 59.5 -0.6Q55.2 -2.6 52.7 -6.8Q50.2 -10.9 50.2 -17.3Q50.2 -23.7 52.4 -29.5Q54.5 -35.3 58.4 -39.9Q62.3 -44.4 67.5 -47Q72.7 -49.6 78.8 -49.6Q84.1 -49.6 88.2 -47.5Q92.4 -45.5 94.9 -41.4Q97.3 -37.3 97.3 -30.9Q97.3 -24.6 95.2 -18.8Q93 -12.9 89.2 -8.3Q85.3 -3.8 80.2 -1.2Q75 1.5 69 1.5ZM70.2 -0.5Q73.3 -0.5 75.9 -3.4Q78.4 -6.2 80.3 -11Q82.2 -15.7 83.2 -21.5Q84.2 -27.2 84.2 -32.9Q84.2 -41.2 82.5 -44.4Q80.8 -47.6 78.1 -47.6Q74.9 -47.6 72.2 -44.8Q69.5 -42 67.5 -37.3Q65.5 -32.6 64.4 -26.9Q63.3 -21.2 63.3 -15.5Q63.3 -7 65.3 -3.8Q67.3 -0.5 70.2 -0.5ZM113.2 1.5Q110.4 1.5 107.9 0.2Q105.4 -1.1 103.9 -4.1Q102.3 -7.1 102.3 -12Q102.3 -17.3 104.4 -22.6Q106.5 -28 110 -32.9Q113.5 -37.7 117.8 -41.5Q122.1 -45.2 126.7 -47.4Q131.3 -49.6 135.4 -49.6Q137.4 -49.6 139.2 -48.9Q140.9 -48.1 142.5 -46.8L150.6 -49.9L151.4 -49.4L142.7 -11.1Q142 -8.3 142 -6.5Q142 -4.4 143.9 -4.4Q145.3 -4.4 147.2 -5.7Q149 -7 151.4 -9.2L152.2 -8.4Q150.7 -6 148.5 -3.8Q146.2 -1.5 143.5 0Q140.7 1.5 137.6 1.5Q134.2 1.5 132.1 -0.6Q130 -2.6 130 -6.9Q130 -8.3 130.1 -9.6Q126.1 -5.1 121.7 -1.8Q117.2 1.5 113.2 1.5ZM114.1 -16.5Q114.1 -11.2 115.9 -8.9Q117.6 -6.5 120.5 -6.5Q122.9 -6.5 125.3 -8Q127.7 -9.5 130.5 -12.3Q130.7 -13.5 131 -14.8L137.3 -43.6Q136 -45.2 134.2 -45.8Q132.4 -46.4 131 -46.4Q126.7 -46.4 122 -41.3Q118.3 -37.2 116.2 -30.5Q114.1 -23.8 114.1 -16.5ZM170.7 1.5Q164.4 1.5 160.5 -1Q156.6 -3.5 156.6 -8.1Q156.6 -10.5 158.3 -12.3Q160 -14.1 162.7 -14.1Q167.7 -14.1 168.9 -8L169.5 -5.2Q170 -3.1 170.8 -1.8Q171.5 -0.5 173.7 -0.5Q176.2 -0.5 178.1 -2.6Q180 -4.7 180 -8.4Q180 -11.2 178.3 -13.8Q176.5 -16.4 172.4 -19.5Q168.3 -22.7 165.8 -26.2Q163.3 -29.6 163.3 -34.4Q163.3 -38.6 165.5 -42Q167.6 -45.5 171.7 -47.5Q175.8 -49.6 181.4 -49.6Q187.9 -49.6 191.7 -47Q195.4 -44.4 195.4 -40.3Q195.4 -38.1 194.1 -36.7Q192.8 -35.2 190.2 -35.2Q185.4 -35.2 183.7 -41L182.7 -43.8Q182.2 -45.8 181.5 -46.6Q180.8 -47.4 179.3 -47.4Q177.7 -47.4 176 -45.7Q174.3 -43.9 174.3 -40.1Q174.3 -36.5 176.5 -33.5Q178.6 -30.6 182.9 -27.4Q187.3 -24.1 189.4 -21Q191.4 -17.9 191.4 -13.5Q191.4 -9.4 189 -6Q186.6 -2.6 182 -0.6Q177.4 1.5 170.7 1.5ZM208.7 1.5Q205.6 1.5 203.6 -0.2Q201.5 -1.8 201.5 -5Q201.5 -7 201.9 -9.4Q202.3 -11.7 202.8 -14.4L209.7 -46H201.4L201.7 -47.2L205.3 -47.6Q208.1 -47.9 210.2 -49Q212.3 -50.1 214.2 -52.1L223.8 -61.8H225.3L222.5 -48.1H233.4L232.9 -46H222L215.1 -12.7Q214.7 -10.8 214.5 -9.4Q214.3 -8.1 214.3 -7.2Q214.3 -6.2 214.9 -5.6Q215.5 -5 216.2 -5Q217.6 -5 219.2 -6.2Q220.8 -7.3 223.2 -9.6L224.4 -8.6Q221.9 -4.9 217.9 -1.7Q213.9 1.5 208.7 1.5Z"/><path fill="#4ade80" d="M241.3 1.3Q237.9 1.3 235.8 -0.8Q233.6 -3 233.6 -6Q233.6 -9.8 236.3 -12.4Q239.1 -15 242.7 -15Q246.1 -15 248.2 -12.8Q250.4 -10.6 250.4 -7.5Q250.4 -3.8 247.7 -1.2Q244.9 1.3 241.3 1.3Z"/></svg>`;
const foot = (p, left) => `<div class="foot"><span>${left || `${TITLE} · <b>getcoast.fit</b>`}</span><span>${PRINT ? p : `${p} / ${TOTAL}`}</span></div>`;
const per = (m) => (m.batch ? 'per tub' : 'per serve');

const coverPlates = ['butter_chicken_and_rice', 'spaghetti_bolognese', 'bbq_pulled_pork_bowl_or_burger', 'massaman_beef', 'teriyaki_chicken_and_rice'].map((s) => meals.find((m) => m.slug === s)).filter(Boolean);
const coverDark = `<section class="page dark cover">
  <div class="brand"><img src="file://${path.join(ROOT, 'icon-180-4.png')}" alt="">${WORDMARK}</div>
  <h1 class="serif"><span>The One Cook</span><span class="g">Cookbook.</span></h1>
  <div class="food">${coverPlates.map((m, i) => `<div>${i === 0 ? '<span class="badge">10 min hands-on</span>' : ''}<img src="${imgFor(m)}" alt=""></div>`).join('')}</div>
</section>`;
const coverWhite = `<section class="page cover white">
  <div class="brand"><img src="file://${path.join(ROOT, 'icon-180-4.png')}" alt="">${WORDMARK}</div>
  <h1 class="serif"><span>The One Cook</span><span class="g">Cookbook.</span></h1>
  <div class="food">${coverPlates.map((m) => (photoFor(m).cut ? m : meals.find((x) => x.slug === 'chicken_mac_and_cheese_bake') || m)).map((m, i) => `<div>${i === 0 ? '<span class="badge">10 min hands-on</span>' : ''}${photo(m)}</div>`).join('')}</div>
</section>`;
const cover = COVER === 'dark' ? coverDark : coverWhite;

const contents = `<section class="page text">
  <p class="mono g">Contents</p>
  <h2 class="serif">What's inside.</h2>
  <p>${batchMeals.length} batch meals, each one cook for 8 tubs. ${batchTen} of them take 10 minutes or less of hands-on work; the slow cooker or the oven does the rest. ${freezes} recipes in the book freeze. Each recipe is one page: the plate, the numbers, the ingredients, the method and how it keeps.</p>
  <div class="toc">
    <div class="row"><span class="n">01</span><span class="t">Skim it</span><span class="c">every meal, time and kcal</span><span class="p">${3 + OFF}</span></div>
    <div class="row"><span class="n">02</span><span class="t">Start with these</span><span class="c">one from each section</span><span class="p">${5 + OFF}</span></div>
    ${sections.map((s, i) => `<div class="row"><span class="n">0${i + 3}</span><span class="t">${s.name}</span><span class="c">${s.meals.length} recipes</span><span class="p">${s.page}</span></div>`).join('')}
    <div class="row"><span class="n">0${sections.length + 3}</span><span class="t">Let the app build your week</span><span class="c">the same meals, planned</span><span class="p">${CLOSING_PAGE}</span></div>
  </div>
  <div class="appnote"><img src="file://${path.join(ROOT, 'images/qr-cookbook.svg')}" alt="QR code"><span><b>Every meal here is in the Coast app.</b>Pick the ones you like and it builds your week to your macros, with one shopping list. Scan to get it.</span></div>
  ${foot(2 + OFF)}
</section>`;

const skimHalf = (secs, p, first) => `<section class="page text">
  ${first ? `<p class="mono g">Skim it</p><h2 class="serif">The whole book at a glance.</h2><p class="dim" style="font-size:8.5pt">hands-on minutes / total time · kcal per tub or serve · F = freezes</p>` : `<p class="mono g">Skim it</p><h2 class="serif">Continued.</h2>`}
  <div class="skim">${secs.map((s) => `<h3>${s.name}</h3>${s.meals.map((m) => `<div class="r"><span>${esc(m.display_name)}</span><span>${activeMin(m)}m / ${shortTime(totalMin(m))} · ${kcalFmt(macros(m).kcal)}${prepFlags(m) ? ' · ' + prepFlags(m) : ''} · p${m.page}</span></div>`).join('')}`).join('')}</div>
  ${foot(p)}
</section>`;
const skim = skimHalf(sections.slice(0, 2), 3 + OFF, true) + skimHalf(sections.slice(2), 4 + OFF, false);

const startHere = `<section class="page text">
  <p class="mono g">Start here</p>
  <h2 class="serif">Start with these.</h2>
  <p>New to batch cooking? One from each section, the least hands-on work in it. Cook one batch this week and you have lunch or dinner sorted for days.</p>
  <div class="starts">${picks.map((m, i) => `<div class="start${i === 0 ? ' wide' : ''}">${photo(m)}<div class="b"><b>${esc(m.display_name)}</b><small>${SECTION(m)} · ${activeMin(m)} min hands-on · ${fmtTime(totalMin(m))} total · ${kcalFmt(macros(m).kcal)} kcal · ${Math.round(macros(m).protein_g)} g protein · p${m.page}</small><p>${esc(defaultPlate(m).description || '')}</p></div></div>`).join('')}</div>
  ${foot(5 + OFF)}
</section>`;

const divider = (s) => `<section class="page divider">
  <div class="wall">${s.meals.filter((m) => photoFor(m).cut).concat(s.meals.filter((m) => !photoFor(m).cut)).slice(0, 6).map((m) => photo(m)).join('')}</div>
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
  <div class="photo">${photo(m)}<div class="tag">${esc(kicker)}</div></div>
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

const closing = `<section class="page closing">
  <p class="mono dim">These meals are in the Coast app</p>
  <h2 class="serif">Pick the meals you like. <span class="g">Coast builds your week.</span></h2>
  <p>Every recipe in this book is in the app, ready to plan with.</p>
  <ul><li>Choose your favourites from this book</li><li>Coast builds them into a week that hits your macros, with one shopping list and a prep guide</li><li>Swap any meal and the week rebalances</li><li>Your training and your cut or bulk plan come with it</li></ul>
  <div class="qr"><img src="file://${path.join(ROOT, 'images/qr-cookbook.svg')}" alt="QR code"><span><b>getcoast.fit/app</b>Point your phone's camera here, or search Coast on the App Store or Google Play.<br>No ads · No account</span></div>
  ${foot(CLOSING_PAGE)}
</section>`;

// ---------- Print on demand (--print letter | wrap) ----------
const mmIn = (v) => `${v}in`;
const SPINE = +(argv('--spine') || 0.375);
// IngramSpark case laminate, 8.5 x 11 in trim (File Creation Guide, custom trim / case laminate page).
const TRIM_W = 8.5, TRIM_H = 11, BLEED = 0.125;
const BOARD_W = TRIM_W - 0.185, BOARD_H = TRIM_H + 0.25, WRAP = 0.625, HINGE = 0.5;
const WRAP_W = WRAP + BOARD_W + HINGE + SPINE + HINGE + BOARD_W + WRAP;
const WRAP_H = WRAP + BOARD_H + WRAP;

// The interior: one sheet per page, trim + bleed on the outside edge, top and bottom. Odd pages are
// rectos (bind edge on the left), even pages versos. Inside margin 19 mm for the hardcover gutter,
// outside 14 mm, nothing within 12.7 mm (0.5 in) of the trim.
// Print fonts: static instances (scripts/print-fonts/, OFL) so the PDF embeds real TrueType fonts.
// Google's variable Outfit and Fraunces come out of Chrome as Type 3 fonts, which printers reject.
const FONT_DIR = path.join(ROOT, 'scripts/print-fonts');
const printFonts = [400, 500, 600, 700, 800].map((w) => `@font-face{font-family:'Outfit';font-weight:${w};src:url('file://${FONT_DIR}/Outfit-${w}.ttf')}`).join('\n')
  + '\n' + [500, 600, 700].map((w) => `@font-face{font-family:'Fraunces';font-style:italic;font-weight:${w};src:url('file://${FONT_DIR}/Fraunces144-Italic-${w}.ttf')}`).join('\n')
  + '\n.serif{font-variation-settings:normal}\n';
const printHead = (extraCss, fonts = '') => head.replace('&family=Fraunces:ital,opsz,wght@1,9..144,500..700&family=Outfit:wght@400;500;600;700', fonts).replace('<style>', '<style>' + printFonts).replace('</style>', extraCss + '</style>');
// Chrome rounds the page size, so it gets a slightly bigger page and setMediaBox() trims it to the exact size.
const PAD = 0.03;
const printCss = `@page{size:${TRIM_W + BLEED + PAD}in ${TRIM_H + 2 * BLEED + PAD}in;margin:0}
.sheet{width:${TRIM_W + BLEED}in;height:${TRIM_H + 2 * BLEED}in;position:relative;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
.sheet:last-of-type{break-after:auto;page-break-after:auto}
.sheet .page{position:absolute;top:${BLEED}in;width:${TRIM_W}in;height:${TRIM_H}in;break-after:auto;page-break-after:auto}
.sheet.r .page{left:0;--pl:19mm;--pr:14mm}
.sheet.v .page{left:${BLEED}in;--pl:14mm;--pr:19mm}
/* no transparency in a print file: the cut-outs are already on white, so multiply changed nothing */
img.cut,.cover.white .food img{mix-blend-mode:normal}
.foot{left:var(--pl);right:var(--pr);bottom:13mm}
.sheet.v .foot{flex-direction:row-reverse}
.text{padding:15mm var(--pr) 0 var(--pl)}
.closing{padding:15mm var(--pr) 26mm var(--pl)}
.divider{padding:15mm var(--pr) 24mm var(--pl)}
.divider .wall{left:var(--pl);right:var(--pr);top:14mm;height:150mm;grid-auto-rows:48mm}
.divider .wall img.framed{height:42mm}
.divider p{margin-bottom:6mm}
/* DM Mono has no bold: a synthetic bold comes out as a Type 3 font */
.skim h3{font-weight:500}
.recipe .photo{padding:14mm var(--pr) 0 var(--pl);height:82mm}
.recipe .photo .tag{left:var(--pl)}
.recipe .body{padding:6mm var(--pr) 0 var(--pl)}
.recipe.long .photo{height:69mm}
.recipe.short .photo{height:101mm}
.recipe.xlong .photo{height:55mm}
.recipe.xlong .body{padding-top:4mm}
/* title page and imprint */
.titlep{padding:20mm var(--pr) 0 var(--pl)}
.titlep h1{font-size:66pt}
.titlep .sub{font-size:13pt;color:#3b3b44;margin:6mm 0 0}
.titlep .hero{position:absolute;left:var(--pl);right:var(--pr);top:118mm;bottom:36mm}
.titlep .hero img{width:100%;height:100%;object-fit:contain;display:block}
.titlep .hero img.framed{object-fit:cover}
.titlep .meta{position:absolute;left:var(--pl);right:var(--pr);bottom:20mm;text-align:center}
.imp{position:absolute;left:var(--pl);right:var(--pr);bottom:24mm;font-size:8pt;line-height:1.55;color:#3b3b44;max-width:120mm}
.imp p{margin:0 0 3mm}
.imp b{color:#15151a;font-weight:600}
`;
// Recipe pages: shrink the photo until the method clears the footer (never below 40 mm), or grow it into spare room.
const fitScript = `<script>
(function(){
  var MM = 96 / 25.4;
  function fit(){
    document.querySelectorAll('.recipe').forEach(function(pg){
      var ph = pg.querySelector('.photo'), foot = pg.querySelector('.foot');
      var limit = foot.getBoundingClientRect().top - 3 * MM;
      for (var i = 0; i < 40; i++) {
        var b = 0; pg.querySelectorAll('.body *').forEach(function(e){ var r = e.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom); });
        var over = b - limit, h = ph.getBoundingClientRect().height;
        // room to spare: give it to the photo (up to 92 mm), keeping 2 mm of the slack
        if (over < -2 * MM) { var gh = Math.min(Math.max(h, 92 * MM), h - over - 2 * MM); if (gh - h < 1) break; ph.style.height = gh + 'px'; continue; }
        if (over <= 0) break;
        var nh = Math.max(40 * MM, h - over);
        if (nh >= h) { pg.setAttribute('data-overflow', (over / MM).toFixed(1)); break; }
        ph.style.height = nh + 'px';
      }
    });
    document.documentElement.setAttribute('data-fit', '1');
  }
  window.addEventListener('load', function(){ document.fonts.ready.then(fit); });
})();
</script>`;
// --check: what's past the safe area and each photo's effective ppi, read back with --dump-dom.
const checkScript = `<script>
(function(){
  var MM = 96 / 25.4;
  function run(){
    var out = [];
    document.querySelectorAll('.page').forEach(function(pg, i){
      var P = pg.getBoundingClientRect(), safe = 12.7 * MM, foot = pg.querySelector('.foot');
      var limit = foot ? foot.getBoundingClientRect().top - 2 * MM : P.bottom - safe;
      var bad = [];
      var test = function(r, what){
        var o = [];
        if (r.bottom > limit + 0.5) o.push('bottom ' + ((r.bottom - limit) / MM).toFixed(1));
        if (r.top < P.top + safe - 0.5) o.push('top ' + ((P.top + safe - r.top) / MM).toFixed(1));
        if (r.left < P.left + safe - 0.5) o.push('left ' + ((P.left + safe - r.left) / MM).toFixed(1));
        if (r.right > P.right - safe + 0.5) o.push('right ' + ((r.right - P.right + safe) / MM).toFixed(1));
        if (o.length) bad.push(what + ': ' + o.join(','));
      };
      // text: every line box of every text node (not the boxes around it)
      var tw = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT), n;
      while ((n = tw.nextNode())) {
        if (!n.textContent.trim() || (foot && foot.contains(n)) || n.parentElement.closest('.guide')) continue;
        var rg = document.createRange(); rg.selectNodeContents(n);
        Array.prototype.forEach.call(rg.getClientRects(), function(r){ if (r.width && r.height) test(r, '"' + n.textContent.trim().slice(0, 24) + '"'); });
      }
      // pictures: the part actually drawn (object-fit, and clipped by its frame)
      pg.querySelectorAll('img, svg').forEach(function(im){
        if (im.closest('.guide') || (foot && foot.contains(im)) || (im.tagName.toLowerCase() === 'svg' && im.closest('svg') !== im)) return;
        var r = im.getBoundingClientRect(); if (!r.width) return;
        var R = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        if (im.tagName === 'IMG' && im.naturalWidth) {
          var f = getComputedStyle(im).objectFit;
          if (f === 'contain') { var sc = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc; R = { left: r.left + (r.width - w) / 2, right: r.left + (r.width + w) / 2, top: r.top + (r.height - h) / 2, bottom: r.top + (r.height + h) / 2 }; }
        }
        var cl = im.parentElement.closest('.food div, .photo, .wall, .start, .hero');
        if (cl) { var c = cl.getBoundingClientRect(); R = { left: Math.max(R.left, c.left), right: Math.min(R.right, c.right), top: Math.max(R.top, c.top), bottom: Math.min(R.bottom, c.bottom) }; }
        test(R, (im.getAttribute('src') || 'svg').split('/').pop());
      });
      var imgs = [];
      pg.querySelectorAll('img').forEach(function(im){
        if (/\\.svg/.test(im.src)) return;
        var r = im.getBoundingClientRect(), fitm = getComputedStyle(im).objectFit;
        var tr = new DOMMatrix(getComputedStyle(im).transform === 'none' ? undefined : getComputedStyle(im).transform).a || 1;
        var sx = r.width / im.naturalWidth, sy = r.height / im.naturalHeight;
        var sc = fitm === 'contain' ? Math.min(sx, sy) : fitm === 'cover' ? Math.max(sx, sy) : sx;
        imgs.push({ src: im.src.split('/').pop(), ppi: Math.round(im.naturalWidth / (im.naturalWidth * sc / 96)), mmW: Math.round(im.naturalWidth * sc / MM) });
      });
      out.push({ page: i + 1, cls: pg.className, overflow: pg.getAttribute('data-overflow'), bad: bad, imgs: imgs });
    });
    var pre = document.createElement('pre'); pre.id = '__check'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  }
  window.addEventListener('load', function(){ document.fonts.ready.then(function(){ setTimeout(run, 50); }); });
})();
</script>`;

const titlePage = `<section class="page cover white titlep">
  <div class="brand"><img src="file://${path.join(ROOT, 'icon-180-4.png')}" alt="">${WORDMARK}</div>
  <h1 class="serif"><span>The One Cook</span><span class="g">Cookbook.</span></h1>
  <p class="sub">${SUBTITLE}</p>
  <div class="hero">${photo(meals.find((m) => m.slug === 'butter_chicken_and_rice'))}</div>
  <p class="mono dim meta">${meals.length} recipes · ${batchMeals.length} big-batch meals · getcoast.fit</p>
</section>`;
const isbn = argv('--isbn');
const imprintPage = `<section class="page imprint"><div class="imp">
  <p><b>${TITLE}.</b><br>${SUBTITLE}</p>
  <p>Copyright © ${new Date().getFullYear()} Coast. All rights reserved. No part of this book may be copied or shared without permission, except short quotes in a review.</p>
  <p>Macros are per tub or per serve, worked out from the ingredients and amounts listed. They are estimates: brands and portions vary. If you cook for someone with an allergy, check every label.</p>
  ${isbn ? `<p>ISBN ${esc(isbn)}</p>` : ''}
  <p>getcoast.fit</p>
</div></section>`;
const blankPage = `<section class="page blank"></section>`;
const sheets = (body) => body.split('<section class="page').slice(1).map((p, i) => `<div class="sheet ${i % 2 ? 'v' : 'r'}"><section class="page${p.trimEnd()}</div>`).join('\n');

// The cover wrap: back board | hinge | spine | hinge | front board, 0.625 in wrapped round every edge.
const wrapCss = `@page{size:${WRAP_W + PAD}in ${WRAP_H + PAD}in;margin:0}
.wrap{break-after:auto;page-break-after:auto;position:relative;width:${WRAP_W}in;height:${WRAP_H}in;overflow:hidden;background:#fff}
.board{position:absolute;top:${WRAP}in;width:${BOARD_W}in;height:${BOARD_H}in}
.board.back{left:${WRAP}in}
.board.front{left:${WRAP + BOARD_W + HINGE + SPINE + HINGE}in}
.board.front .page{width:${BOARD_W}in;height:${BOARD_H}in;break-after:auto;page-break-after:auto}
.cover.white .food img{mix-blend-mode:normal}
.spine{position:absolute;top:0;height:${WRAP_H}in;left:${WRAP + BOARD_W + HINGE}in;width:${SPINE}in;background:linear-gradient(90deg,#0c2f1b,#166534 30%,#1a7a40 55%,#0f3d22)}
.spine .t{position:absolute;left:0;right:0;top:${WRAP}in;height:${BOARD_H}in;display:flex;align-items:center;justify-content:center}
.spine .t b{writing-mode:vertical-rl;font-family:'DM Serif Display',Georgia,serif;font-style:italic;font-weight:400;color:#f2f7f3;font-size:${(SPINE * 72 * 0.46).toFixed(2)}pt;line-height:1;letter-spacing:.01em;white-space:nowrap}
.spine .t b i{color:#4ade80;font-style:inherit}
.spine .wm{position:absolute;left:50%;bottom:${WRAP + 0.45}in;height:${(SPINE * 0.26).toFixed(4)}in;width:auto;transform:translateX(-50%) rotate(90deg);transform-origin:50% 50%;color:#fff;display:block}
.back .in{position:absolute;inset:0;padding:22mm 18mm 0}
.back h2{font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:600;font-size:38pt;line-height:1;letter-spacing:-.01em;margin:4mm 0 7mm;color:#15151a}
.back h2 .g,.back p.g{color:#16a34a}
.back p{font-size:11.5pt;line-height:1.5;color:#3b3b44;margin:0 0 5mm;max-width:150mm}
.back .sys{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:8mm 0 8mm}
.back .sys div{border:1px solid #e3e1da;border-radius:2.5mm;padding:3.5mm 3.5mm 3mm}
.back .sys b{display:block;font-size:17pt;font-weight:600;letter-spacing:-.02em;color:#15151a}
.back .sys div:first-child b{color:#16a34a}
.back .sys span{font-family:'DM Mono',monospace;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:#6f6f7a}
.back .qr{display:flex;align-items:center;gap:6mm;margin-top:10mm}
.back .qr img{width:34mm;height:34mm;padding:2.5mm;background:#fff;border:1px solid #e3e1da;border-radius:2.5mm;flex:none}
.back .qr span{font-size:10.5pt;line-height:1.5;color:#3b3b44}
.back .qr span b{display:block;font-size:13pt;color:#15151a;margin-bottom:.5mm}
.back .mark{position:absolute;left:18mm;bottom:20mm;display:flex;align-items:center;gap:3mm}
.back .mark img{width:7mm;height:7mm;border-radius:1.7mm}
.back .mark .wm{height:5.5mm;width:auto;color:#15151a;display:block}
/* the barcode box: 2 x 1.2 in, kept clear in the lower right, 0.375 in inside the board's spine edge and 0.5 in up */
.back .barcode{position:absolute;right:0.375in;bottom:0.5in;width:2in;height:1.2in;background:#fff}
.guide{position:absolute;pointer-events:none;z-index:50}
.guide.l{border:0 dashed}
.guide.lab{font:600 9pt/1.2 'DM Mono',monospace;color:#e11d48;background:rgba(255,255,255,.85);padding:1px 3px}
`;
const sections_ = sections; // (same order as the book)
const back = `<div class="board back"><div class="in">
  <p class="mono g">${TITLE}</p>
  <h2>Every meal here is<br>in the <span class="g">Coast app.</span></h2>
  <p>One cook on the weekend fills 8 tubs: the next 3 days in the fridge, the rest in the freezer. About 10 minutes of hands-on work, then the slow cooker or the oven does the rest. Every recipe gives the macros per tub or serve.</p>
  <div class="sys"><div><b>1 cook</b><span>covers the week</span></div><div><b>8 tubs</b><span>fridge and freezer</span></div><div><b>~10 min</b><span>hands-on</span></div><div><b>Macros</b><span>per serve</span></div></div>
  <p>${meals.length} recipes: ${batchMeals.length} big-batch meals for the slow cooker and the oven, plus ${sections_.filter((s) => !/Slow|Oven/.test(s.name)).map((s) => s.name.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>
  <p>Pick the meals you like from this book. Coast builds them into a week that hits your macros, with one shopping list and a prep guide.</p>
  <div class="qr"><img src="file://${path.join(ROOT, 'images/qr-cookbook.svg')}" alt="QR code"><span><b>Scan to get Coast</b>getcoast.fit/app<br>On the App Store and Google Play</span></div>
</div>
  <div class="mark"><img src="file://${path.join(ROOT, 'icon-180-4.png')}" alt="">${WORDMARK}</div>
  <div class="barcode"></div>
</div>`;
const spine = `<div class="spine"><div class="t"><b>The One Cook <i>Cookbook.</i></b></div>${WORDMARK.replace('<path fill="currentColor"', '<path fill="#ffffff"')}</div>`;
const front = `<div class="board front">${coverWhite}</div>`;
// Guides (preview only): fold lines (board edges), hinge, spine, IngramSpark's pink safe area (0.125 in
// inside the folds, outside the hinge) and the recommended 0.25 in, plus the barcode box.
const gLine = (x, y, w, h, color, style = 'solid') => `<div class="guide" style="left:${x}in;top:${y}in;width:${w}in;height:${h}in;border:1.5px ${style} ${color}"></div>`;
const gLab = (x, y, t) => `<div class="guide lab" style="left:${x}in;top:${y}in">${t}</div>`;
const FX = WRAP + BOARD_W + HINGE + SPINE + HINGE, SX = WRAP + BOARD_W + HINGE;
const guides = [
  gLine(WRAP, WRAP, BOARD_W, BOARD_H, '#2563eb'), gLine(FX, WRAP, BOARD_W, BOARD_H, '#2563eb'),
  gLine(WRAP + BOARD_W, WRAP, HINGE, BOARD_H, '#9333ea', 'dashed'), gLine(SX + SPINE, WRAP, HINGE, BOARD_H, '#9333ea', 'dashed'),
  gLine(SX, 0, SPINE, WRAP_H, '#f59e0b', 'dashed'),
  gLine(WRAP + 0.125, WRAP + 0.125, BOARD_W - 0.25, BOARD_H - 0.25, '#ec4899', 'dashed'), gLine(FX + 0.125, WRAP + 0.125, BOARD_W - 0.25, BOARD_H - 0.25, '#ec4899', 'dashed'),
  gLine(WRAP + 0.25, WRAP + 0.25, BOARD_W - 0.5, BOARD_H - 0.5, '#ec4899', 'dotted'), gLine(FX + 0.25, WRAP + 0.25, BOARD_W - 0.5, BOARD_H - 0.5, '#ec4899', 'dotted'),
  gLine(SX + 0.0625, WRAP + 0.25, SPINE - 0.125, BOARD_H - 0.5, '#ec4899', 'dotted'),
  gLine(WRAP + BOARD_W - 0.375 - 2, WRAP + BOARD_H - 0.5 - 1.2, 2, 1.2, '#e11d48'),
  gLab(WRAP + BOARD_W - 0.375 - 2 + 0.08, WRAP + BOARD_H - 0.5 - 1.2 + 0.08, 'ISBN barcode area<br>2 x 1.2 in, keep clear'),
  gLab(WRAP + 0.3, 0.2, `back board ${BOARD_W} x ${BOARD_H} in (blue = fold/board edge)`),
  gLab(FX + 0.3, 0.2, 'front board (pink dashed = safe 0.125 in, dotted = 0.25 in)'),
  gLab(SX - 1.1, WRAP_H - 0.45, `hinge 0.5 | spine ${SPINE} in | hinge 0.5`),
  gLab(0.05, WRAP_H - 0.45, `${WRAP_W.toFixed(3)} x ${WRAP_H} in, 0.625 in wrap`),
].join('');

if (PRINT === 'letter') {
  const body = titlePage + imprintPage + contents + skim + startHere + sections.map((s) => divider(s) + s.meals.map(recipe).join('')).join('') + closing + blankPage.repeat(BLANKS);
  // Outfit has no 1/3 or 2/3 glyph (Chrome would fall back to a system font and a Type 3 font)
  const pages = sheets(body).replace(/⅓/g, '1/3').replace(/⅔/g, '2/3');
  const p = path.join(OUT_DIR, 'cookbook-print-letter.html');
  writeFileSync(p, printHead(printCss) + pages + fitScript + '</body></html>');
  writeFileSync(p.replace('.html', '.check.html'), printHead(printCss) + pages + fitScript + checkScript + '</body></html>');
  printPdf(p, TRIM_W + BLEED, TRIM_H + 2 * BLEED, `${TOTAL} pages, ${TRIM_W} x ${TRIM_H} in trim + ${BLEED} in bleed (sheet ${TRIM_W + BLEED} x ${TRIM_H + 2 * BLEED} in)`);
} else if (PRINT === 'wrap') {
  const wrapHead = printHead(wrapCss, '&family=DM+Serif+Display:ital@1');
  const wrapBody = wrapHead + `<section class="page wrap">${back}${spine}${front}${process.argv.includes('--guides') ? guides : ''}</section>`;
  const p = path.join(OUT_DIR, 'cookbook-cover-wrap.html');
  writeFileSync(p, wrapBody + '</body></html>');
  writeFileSync(p.replace('.html', '.check.html'), wrapBody + checkScript + '</body></html>');
  printPdf(p, WRAP_W, WRAP_H, `cover wrap ${WRAP_W.toFixed(3)} x ${WRAP_H} in (spine ${SPINE} in, board ${BOARD_W} x ${BOARD_H} in)`);
}
function printPdf(p, wIn, hIn, what) {
  console.log(what);
  if (process.argv.includes('--check')) {
    const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=20000', '--window-size=1400,1200', '--dump-dom', 'file://' + p.replace('.html', '.check.html')], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const m = dom.match(/<pre id="__check">([\s\S]*?)<\/pre>/);
    writeFileSync(PDF.replace(/\.pdf$/, '') + '.check.json', m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '[]');
    console.log('check written');
  }
  if (!process.argv.includes('--html')) {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=20000', `--print-to-pdf=${PDF}`, 'file://' + p], { stdio: 'ignore' });
    setMediaBox(PDF, wIn * 72, hIn * 72);
    console.log(`wrote ${PDF}`);
  }
}
// Every page's MediaBox to the exact size (Chrome's PDFs have one classic xref table: shift its offsets).
function setMediaBox(file, w, h) {
  const s = readFileSync(file).toString('latin1');
  const box = `/MediaBox [0 0 ${+w.toFixed(3)} ${+h.toFixed(3)}]`;
  const edits = []; let out = '', last = 0;
  for (const m of s.matchAll(/\/MediaBox \[0 0 [\d.]+ [\d.]+\]/g)) { out += s.slice(last, m.index) + box; edits.push([m.index, box.length - m[0].length]); last = m.index + m[0].length; }
  out += s.slice(last);
  const shift = (o) => o + edits.filter(([i]) => i < o).reduce((a, [, d]) => a + d, 0);
  const sx = s.lastIndexOf('startxref'), xref = +s.slice(sx + 9).trim().split(/\s/)[0];
  if (s.slice(xref, xref + 4) !== 'xref') throw new Error('unexpected PDF xref in ' + file);
  const nx = shift(xref);
  const head_ = out.slice(0, nx), rest = out.slice(nx);
  const fixed = rest.replace(/^(\d{10}) (\d{5}) n/gm, (_, o, g) => String(shift(+o)).padStart(10, '0') + ' ' + g + ' n').replace(/startxref\s+\d+/, 'startxref\n' + nx);
  writeFileSync(file, Buffer.from(head_ + fixed, 'latin1'));
}

if (!PRINT) {
const html = head + cover + contents + skim + startHere + sections.map((s) => divider(s) + s.meals.map(recipe).join('')).join('') + closing + '</body></html>';
const htmlPath = path.join(OUT_DIR, 'cookbook.html');
if (process.argv.includes('--preview')) {
  const pick = (slug) => meals.find((m) => m.slug === slug);
  const one = { cover, 'cover-dark': coverDark, 'cover-white': coverWhite, contents, start: startHere, closing, mains: divider(sections[0]), 'page-breakfast': recipe(pick('protein_pancakes')), 'page-main': recipe(pick('butter_chicken_and_rice')), 'page-dessert': recipe(pick('fudgy_protein_brownies')) };
  for (const [k, v] of Object.entries(one)) writeFileSync(path.join(OUT_DIR, `preview-${k}.html`), head + v + '</body></html>');
  console.log('preview-*.html written');
}
writeFileSync(htmlPath, html);
console.log(`cookbook.html: ${TOTAL} pages expected (${meals.length} recipes: ${sections.map((s) => `${s.meals.length} ${s.name.toLowerCase()}`).join(', ')}), missing images: ${meals.filter((m) => !imgFor(m)).map((m) => m.slug).join(', ') || 'none'}`);

if (!process.argv.includes('--html')) {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=20000', `--print-to-pdf=${PDF}`, 'file://' + htmlPath], { stdio: 'ignore' });
  console.log(`wrote ${path.relative(ROOT, PDF)}`);
}
}
