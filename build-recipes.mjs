#!/usr/bin/env node
/*
 * build-recipes.mjs — generates static /r/<slug>/index.html pages from r/meals.json
 *
 * WHY: /r/?meal= is client-rendered, so iMessage/WhatsApp/Discord link previews and
 * non-JS crawlers see a generic "Recipe — JSON.fit" card. These static pages carry
 * the real title, dish photo, description, canonical and Recipe JSON-LD in plain
 * HTML — no JS needed for the preview or the schema.
 *
 * USAGE (from the repo root):
 *     node build-recipes.mjs
 * Then commit the generated r/<slug>/ folders. Re-run whenever r/meals.json changes.
 *
 * NOTES:
 * - The interactive page at /r/?meal=<slug> keeps working unchanged; each static
 *   page links to it for portion scaling and plate switching.
 * - og:image points at the .png (some scrapers still choke on webp); the visible
 *   <img> uses .webp with a .png fallback.
 * - Field names are read defensively (see ACCESSORS below). If a section comes out
 *   empty for a meal, the page still ships with full head metadata — adjust the
 *   accessor for your schema and re-run.
 * - When you're ready, point the app's share links at https://json.fit/r/<slug>/
 *   for rich previews.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://json.fit';
const APP_STORE_URL = 'https://apps.apple.com/au/app/json-fit/id6758357834';
const IMAGE_BASE = SITE + '/images/meals/';
const MEALS_JSON = path.resolve('r/meals.json');
const OUT_ROOT = path.resolve('r');
const GA_ID = 'G-3C38HP30JG';

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const titleCase = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Image filenames are the slug with hyphens (pulled_pork -> pulled-pork.webp)
const imageStem = (meal) =>
  String(meal.image || meal.slug || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const webpUrl = (meal) => IMAGE_BASE + imageStem(meal) + '.webp';
const pngUrl = (meal) => IMAGE_BASE + imageStem(meal) + '.png';

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : (v != null && v !== '' && isFinite(+v) ? +v : null));

const formatAmount = (n) => {
  if (n == null) return '';
  const r = Math.round(n * 100) / 100;
  return String(Number.isInteger(r) ? r : r);
};

const formatTime = (t) => {
  if (t == null || t === '') return '';
  if (typeof t === 'string' && !isFinite(+t)) return t;
  const mins = +t;
  if (!isFinite(mins) || mins <= 0) return '';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m} min`;
};

const isoDuration = (t) => {
  const mins = num(t);
  return mins && mins > 0 ? `PT${Math.round(mins)}M` : null;
};

const stepText = (s) => (typeof s === 'string' ? s : (s && (s.summary || s.text || s.step || s.instruction)) || '');

/* ---------- ACCESSORS (adjust here if your meals.json fields differ) ---------- */

const plates = (meal) => (Array.isArray(meal.plates) ? meal.plates : []);

const canonicalPlate = (meal) => {
  const ps = plates(meal);
  if (!ps.length) return null;
  return (
    ps.find((p) => p && p.display_name === meal.display_name) ||
    ps.find((p) => p && !p.stunt && !p.is_stunt) ||
    ps[0]
  );
};

const macrosOf = (meal, plate) => {
  const m = (plate && (plate.plate_macros || plate.macros)) || meal.macros || meal.plate_macros || {};
  return {
    kcal: num(m.kcal ?? m.calories ?? m.kcals),
    protein: num(m.protein ?? m.protein_g ?? m.p),
    carbs: num(m.carbs ?? m.carbs_g ?? m.c),
    fat: num(m.fat ?? m.fat_g ?? m.f),
  };
};

const descriptionOf = (meal, plate) => (plate && plate.description) || meal.description || '';

const methodsOf = (meal, plate) =>
  (Array.isArray(meal.methods) && meal.methods) ||
  (plate && Array.isArray(plate.methods) && plate.methods) || [];

const baseIngredients = (meal, method) =>
  (method && Array.isArray(method.ingredients) && method.ingredients) ||
  (Array.isArray(meal.ingredients) && meal.ingredients) || [];

const plateIngredients = (plate) => (plate && Array.isArray(plate.ingredients) ? plate.ingredients : []);

const producesServings = (meal, method) =>
  num((method && method.produces_servings) ?? meal.produces_servings) || 1;

const ingName = (ing) => (typeof ing === 'string' ? ing : (ing && (ing.name || ing.ingredient || ing.item)) || '');

const ingLine = (ing, servingsDivisor) => {
  if (typeof ing === 'string') return ing;
  const name = ingName(ing);
  if (!name) return '';
  const amt = num(ing.base_amount ?? ing.amount);
  const unit = ing.unit ? String(ing.unit) : '';
  if (amt == null) return name;
  const perPortion = amt / (servingsDivisor || 1);
  return `${formatAmount(perPortion)}${unit ? ' ' + unit : ''} ${name}`.trim();
};

/* ---------- page template ---------- */

const CSS = `
:root{--green:#22c55e;--green-soft:rgba(34,197,94,0.08);--green-glow:rgba(34,197,94,0.32);--bg:#050508;--surface:#0a0a0f;--surface-2:#111116;--border:rgba(255,255,255,0.06);--border-green:rgba(34,197,94,0.18);--text:#f0f0f2;--text-2:#9898a4;--text-3:#7a7a86}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6;font-size:16px;padding-bottom:84px}
.green{color:var(--green)}
nav{position:sticky;top:0;z-index:100;padding:0 1.5rem;height:56px;display:flex;align-items:center;justify-content:space-between;background:rgba(5,5,8,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid var(--border)}
.nav-left{display:flex;align-items:center;gap:.6rem}
.nav-back{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;border:1px solid var(--border);color:var(--text-2);text-decoration:none}
.nav-logo{font-family:'DM Mono',monospace;font-weight:500;font-size:1rem;color:var(--text);text-decoration:none;display:flex;align-items:center;gap:.4rem}
.nav-cta{background:var(--green);color:#001b08;padding:.4rem 1rem;border-radius:8px;font-weight:600;font-size:.78rem;text-decoration:none}
.hero{max-width:760px;margin:0 auto;padding:1.25rem 1.5rem 0}
.hero img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:16px;border:1px solid var(--border);background:var(--surface-2);display:block}
.wrap{max-width:760px;margin:0 auto;padding:1.25rem 1.5rem 3rem}
.cuisine{font-family:'DM Mono',monospace;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:.4rem}
h1{font-size:clamp(1.6rem,5vw,2.3rem);font-weight:800;letter-spacing:-.02em;line-height:1.1;margin-bottom:1rem}
.macros{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:1.25rem}
.macro{background:var(--surface);padding:.8rem .5rem;text-align:center}
.macro b{display:block;font-family:'DM Mono',monospace;font-size:1.05rem;font-weight:500;color:var(--green)}
.macro span{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.desc{color:var(--text-2);font-size:.95rem;margin-bottom:1rem}
.timeline{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text-3);letter-spacing:.04em;margin-bottom:1.75rem}
.eyebrow{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--green);display:block;margin:1.5rem 0 .75rem}
.ing{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid var(--border);font-size:.92rem;color:var(--text)}
.ing:last-child{border-bottom:none}
.note{margin-top:.9rem;padding:.8rem 1rem;border:1px solid var(--border-green);background:var(--green-soft);border-radius:10px;font-size:.85rem;color:var(--text-2)}
ol.steps{list-style:none;counter-reset:s;margin-top:.25rem}
ol.steps li{counter-increment:s;display:flex;gap:.9rem;padding:.7rem 0;border-bottom:1px solid var(--border);font-size:.93rem;color:var(--text-2)}
ol.steps li::before{content:counter(s);flex-shrink:0;width:24px;height:24px;border-radius:50%;border:1px solid var(--border-green);color:var(--green);font-family:'DM Mono',monospace;font-size:.7rem;display:flex;align-items:center;justify-content:center}
ol.steps li:last-child{border-bottom:none}
.alt-link{display:inline-block;margin-top:1.5rem;color:var(--green);text-decoration:none;font-weight:600;font-size:.92rem}
.teaser{margin-top:2rem;padding:1.4rem;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.teaser h2{font-size:1.1rem;font-weight:800;margin-bottom:.35rem}
.teaser p{color:var(--text-2);font-size:.88rem}
.cta-bar{position:fixed;left:0;right:0;bottom:0;z-index:90;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.8rem 1.25rem;background:rgba(5,5,8,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid var(--border)}
.cta-bar span{font-size:.8rem;color:var(--text-2)}
.cta-bar a{flex-shrink:0;background:var(--green);color:#001b08;padding:.6rem 1.2rem;border-radius:10px;font-weight:700;font-size:.85rem;text-decoration:none}
footer{border-top:1px solid var(--border);padding:1.5rem;text-align:center;font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text-3)}
footer a{color:var(--text-3);text-decoration:none;margin:0 .6rem}
`.trim();

function recipeSchema(meal, plate, method, slug, name, desc, macros) {
  const servings = producesServings(meal, method);
  // Base batch amounts are for the whole batch (divide by servings); plate-up
  // ingredients are already per portion.
  const ings = baseIngredients(meal, method).map((i) => ingLine(i, servings))
    .concat(plateIngredients(plate).map((i) => ingLine(i, 1)));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name,
    url: `${SITE}/r/${slug}/`,
    image: [pngUrl(meal)],
    author: { '@type': 'Organization', name: 'JSON.fit', url: SITE },
  };
  if (desc) schema.description = desc;
  if (meal.cuisine) schema.recipeCuisine = titleCase(meal.cuisine);
  const iso = method && isoDuration(method.time ?? method.total_time ?? method.totalTime ?? method.minutes);
  if (iso) schema.totalTime = iso;
  if (ings.length) schema.recipeIngredient = ings.filter(Boolean);
  const steps = (method && Array.isArray(method.steps) ? method.steps : []).map(stepText).filter(Boolean);
  if (steps.length) schema.recipeInstructions = steps.map((t) => ({ '@type': 'HowToStep', text: t }));
  const nutrition = {};
  if (macros.kcal != null) nutrition.calories = `${macros.kcal} calories`;
  if (macros.protein != null) nutrition.proteinContent = `${macros.protein} g`;
  if (macros.carbs != null) nutrition.carbohydrateContent = `${macros.carbs} g`;
  if (macros.fat != null) nutrition.fatContent = `${macros.fat} g`;
  if (Object.keys(nutrition).length) schema.nutrition = { '@type': 'NutritionInformation', ...nutrition };
  return schema;
}

function renderPage(meal) {
  const slug = meal.slug;
  const plate = canonicalPlate(meal);
  const name = (plate && plate.display_name) || meal.display_name;
  const macros = macrosOf(meal, plate);
  const desc = descriptionOf(meal, plate);
  const methods = methodsOf(meal, plate);
  const method = methods[0] || null;
  const servings = producesServings(meal, method);
  const baseIngs = baseIngredients(meal, method);
  const extraIngs = plateIngredients(plate);
  const steps = (method && Array.isArray(method.steps) ? method.steps : []).map(stepText).filter(Boolean);
  const reserve = (method && (method.reserve || method.reserve_note)) || meal.reserve || '';
  const timeStr = method ? formatTime(method.time ?? method.total_time ?? method.totalTime ?? method.minutes) : '';
  const waysCount = plates(meal).length;
  const metaDesc = desc
    ? String(desc).slice(0, 155)
    : `${name} — full ingredients, steps and macros. A calorie-dense JSON.fit meal built for eating big.`;

  const ingRows = (list, divisor) =>
    list.map((i) => {
      const nm = ingName(i) || (typeof i === 'string' ? i : '');
      if (!nm) return '';
      const amt = typeof i === 'object' ? num(i.base_amount ?? i.amount) : null;
      const unit = typeof i === 'object' && i.unit ? String(i.unit) : '';
      const right = amt != null ? `${formatAmount(amt / (divisor || 1))}${unit ? ' ' + unit : ''}` : '';
      return `<div class="ing"><span>${esc(nm)}</span><span style="color:var(--text-2);font-family:'DM Mono',monospace;font-size:.82rem">${esc(right)}</span></div>`;
    }).join('\n      ');

  const schema = recipeSchema(meal, plate, method, slug, name, desc, macros);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)} — JSON.fit</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${SITE}/r/${esc(slug)}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(name)} — JSON.fit">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:url" content="${SITE}/r/${esc(slug)}/">
<meta property="og:image" content="${pngUrl(meal)}">
<meta property="og:site_name" content="JSON.fit">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)} — JSON.fit">
<meta name="twitter:description" content="${esc(metaDesc)}">
<meta name="twitter:image" content="${pngUrl(meal)}">
<link rel="icon" type="image/x-icon" href="/favicon-3.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
<style>
${CSS}
</style>
</head>
<body>
<nav>
  <div class="nav-left">
    <a href="/meals.html" class="nav-back" aria-label="Back to meal library"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></a>
    <a href="/" class="nav-logo"><svg width="18" height="12" viewBox="0 0 22 14" fill="none"><rect x="0" y="3" width="4" height="8" rx="1.5" fill="#22c55e"/><rect x="18" y="3" width="4" height="8" rx="1.5" fill="#22c55e"/><rect x="4" y="5" width="14" height="4" rx="2" fill="#22c55e"/></svg>JSON<span class="green">.fit</span></a>
  </div>
  <a href="${APP_STORE_URL}" class="nav-cta" onclick="gtag('event','download_click',{'button_location':'recipe_static_nav'})">Get the app</a>
</nav>

<div class="hero">
  <img src="${webpUrl(meal)}" alt="${esc(name)}" fetchpriority="high" onerror="this.onerror=null;this.src='${pngUrl(meal)}'">
</div>

<div class="wrap">
  <div class="cuisine">${esc(titleCase(meal.cuisine || 'Meal'))}${waysCount > 1 ? ` &middot; ${waysCount} ways to serve` : ''}</div>
  <h1>${esc(name)}</h1>

  <div class="macros">
    <div class="macro"><b>${macros.kcal != null ? macros.kcal : '&mdash;'}</b><span>kcal</span></div>
    <div class="macro"><b>${macros.protein != null ? macros.protein + 'g' : '&mdash;'}</b><span>protein</span></div>
    <div class="macro"><b>${macros.carbs != null ? macros.carbs + 'g' : '&mdash;'}</b><span>carbs</span></div>
    <div class="macro"><b>${macros.fat != null ? macros.fat + 'g' : '&mdash;'}</b><span>fat</span></div>
  </div>
${desc ? `\n  <p class="desc">${esc(desc)}</p>` : ''}${timeStr ? `\n  <div class="timeline">&#9202; ${esc(timeStr)} total</div>` : ''}
${baseIngs.length ? `
  <span class="eyebrow">${extraIngs.length ? 'For the base' : 'Ingredients'}<span style="color:var(--text-3);letter-spacing:.04em"> &middot; per portion</span></span>
  <div>
      ${ingRows(baseIngs, servings)}
  </div>` : ''}
${extraIngs.length ? `
  <span class="eyebrow">To plate it up</span>
  <div>
      ${ingRows(extraIngs, 1)}
  </div>` : ''}
${reserve ? `\n  <div class="note">${esc(reserve)}</div>` : ''}
${steps.length ? `
  <span class="eyebrow">Method</span>
  <ol class="steps">
${steps.map((t) => `    <li><span>${esc(t)}</span></li>`).join('\n')}
  </ol>` : ''}

  <a class="alt-link" href="/r/?meal=${encodeURIComponent(slug)}">Portion scaling${waysCount > 1 ? ` &amp; ${waysCount} ways to serve` : ' &amp; more'} &#8594;</a>

  <div class="teaser">
    <h2>Cook it in the app.</h2>
    <p>JSON.fit has a step-by-step cook mode with live timers, and builds meals like this into a week that hits your exact macros. Free.</p>
  </div>
</div>

<div class="cta-bar">
  <span>Free on iOS &middot; no ads, no accounts</span>
  <a href="${APP_STORE_URL}" onclick="gtag('event','download_click',{'button_location':'recipe_static_bar'})">Download free</a>
</div>

<footer>
  <a href="/">json.fit</a><a href="/meals.html">All meals</a><a href="/privacy-policy.html">Privacy</a>
</footer>
</body>
</html>
`;
}

/* ---------- main ---------- */

let raw;
try {
  raw = JSON.parse(readFileSync(MEALS_JSON, 'utf8'));
} catch (e) {
  console.error(`Could not read ${MEALS_JSON}: ${e.message}`);
  console.error('Run this from the repo root (the folder that contains r/meals.json).');
  process.exit(1);
}

const meals = Array.isArray(raw) ? raw : raw.meals || raw.data || [];
if (!Array.isArray(meals) || !meals.length) {
  console.error('No meals found in r/meals.json — expected an array (or {meals:[...]}).');
  process.exit(1);
}

let built = 0, skipped = 0;
for (const meal of meals) {
  if (!meal || !meal.slug || !meal.display_name) { skipped++; continue; }
  const outDir = path.join(OUT_ROOT, meal.slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), renderPage(meal), 'utf8');
  const plate = canonicalPlate(meal);
  const method = methodsOf(meal, plate)[0] || null;
  const flags = [
    baseIngredients(meal, method).length ? 'ingredients' : null,
    method && (method.steps || []).length ? 'steps' : null,
    macrosOf(meal, plate).kcal != null ? 'macros' : null,
  ].filter(Boolean).join(', ') || 'head metadata only';
  console.log(`  r/${meal.slug}/index.html  (${flags})`);
  built++;
}

console.log(`\nBuilt ${built} static recipe page${built === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} without slug/display_name` : ''}.`);
console.log('Commit the r/<slug>/ folders. Re-run after editing r/meals.json.');
