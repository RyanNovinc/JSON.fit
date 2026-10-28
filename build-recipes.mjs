#!/usr/bin/env node
/*
 * build-recipes.mjs — generates static /r/<slug>/index.html pages from r/meals.json
 *
 * WHY: /r/?meal= is client-rendered, so iMessage/WhatsApp/Discord link previews and
 * non-JS crawlers see a generic "Recipe | Coast" card. These static pages carry
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
 * - When you're ready, point the app's share links at https://getcoast.fit/r/<slug>/
 *   for rich previews.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://getcoast.fit';
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
    author: { '@type': 'Organization', name: 'Coast', url: SITE },
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
    : `${name}: full ingredients, steps and macros. A Coast meal built for batch cooking.`;

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
<title>${esc(name)} | Coast</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${SITE}/r/${esc(slug)}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(name)} | Coast">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:url" content="${SITE}/r/${esc(slug)}/">
<meta property="og:image" content="${pngUrl(meal)}">
<meta property="og:site_name" content="Coast">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)} | Coast">
<meta name="twitter:description" content="${esc(metaDesc)}">
<meta name="twitter:image" content="${pngUrl(meal)}">
<link rel="icon" type="image/x-icon" href="/favicon-4.ico">
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
    <a href="/" class="nav-logo"><svg class="logo-ic" width="24" height="24" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="24" fill="#4ade80"/><path fill="#0a0a0b" d="M43.46 69.02Q38.42 69.02 35.23 65.62Q32.03 62.22 32.03 56.1Q32.03 51.75 33.53 47.84Q35.02 43.93 37.71 40.87Q40.4 37.81 43.9 36.04Q47.4 34.27 51.41 34.27Q53.79 34.27 55.87 35.02Q57.94 35.77 59.2 37.13Q60.46 38.49 60.39 40.32Q60.32 42.16 59.23 43.21Q58.14 44.27 56.38 44.27Q54.47 44.27 53.32 43.11Q52.16 41.96 51.48 40.46L51.07 39.3Q50.12 37.06 49.41 36.62Q48.69 36.18 46.99 37.6Q45.16 39.17 43.56 41.82Q41.96 44.47 41.01 47.67Q40.06 50.86 40.06 54.2Q40.06 59.3 42.27 61.71Q44.48 64.12 48.22 64.12Q50.66 64.12 53.04 62.56Q55.42 61 57.46 58.21L58.42 58.89Q56.99 61.54 54.74 63.85Q52.5 66.16 49.61 67.59Q46.72 69.02 43.46 69.02Z"/><circle cx="68" cy="64" r="6.5" fill="#0a0a0b"/></svg><svg class="logo-wm" width="75" height="20" viewBox="4 -63 248 66" aria-hidden="true"><path fill="currentColor" d="M21.9 1.5Q14.5 1.5 9.8 -3.5Q5.1 -8.5 5.1 -17.5Q5.1 -23.9 7.3 -29.6Q9.5 -35.4 13.5 -39.9Q17.4 -44.4 22.6 -47Q27.7 -49.6 33.6 -49.6Q37.1 -49.6 40.2 -48.5Q43.2 -47.4 45.1 -45.4Q46.9 -43.4 46.8 -40.7Q46.7 -38 45.1 -36.5Q43.5 -34.9 40.9 -34.9Q38.1 -34.9 36.4 -36.6Q34.7 -38.3 33.7 -40.5L33.1 -42.2Q31.7 -45.5 30.7 -46.2Q29.6 -46.8 27.1 -44.7Q24.4 -42.4 22.1 -38.5Q19.7 -34.6 18.3 -29.9Q16.9 -25.2 16.9 -20.3Q16.9 -12.8 20.2 -9.2Q23.4 -5.7 28.9 -5.7Q32.5 -5.7 36 -8Q39.5 -10.3 42.5 -14.4L43.9 -13.4Q41.8 -9.5 38.5 -6.1Q35.2 -2.7 31 -0.6Q26.7 1.5 21.9 1.5ZM69 1.5Q63.8 1.5 59.5 -0.6Q55.2 -2.6 52.7 -6.8Q50.2 -10.9 50.2 -17.3Q50.2 -23.7 52.4 -29.5Q54.5 -35.3 58.4 -39.9Q62.3 -44.4 67.5 -47Q72.7 -49.6 78.8 -49.6Q84.1 -49.6 88.2 -47.5Q92.4 -45.5 94.9 -41.4Q97.3 -37.3 97.3 -30.9Q97.3 -24.6 95.2 -18.8Q93 -12.9 89.2 -8.3Q85.3 -3.8 80.2 -1.2Q75 1.5 69 1.5ZM70.2 -0.5Q73.3 -0.5 75.9 -3.4Q78.4 -6.2 80.3 -11Q82.2 -15.7 83.2 -21.5Q84.2 -27.2 84.2 -32.9Q84.2 -41.2 82.5 -44.4Q80.8 -47.6 78.1 -47.6Q74.9 -47.6 72.2 -44.8Q69.5 -42 67.5 -37.3Q65.5 -32.6 64.4 -26.9Q63.3 -21.2 63.3 -15.5Q63.3 -7 65.3 -3.8Q67.3 -0.5 70.2 -0.5ZM113.2 1.5Q110.4 1.5 107.9 0.2Q105.4 -1.1 103.9 -4.1Q102.3 -7.1 102.3 -12Q102.3 -17.3 104.4 -22.6Q106.5 -28 110 -32.9Q113.5 -37.7 117.8 -41.5Q122.1 -45.2 126.7 -47.4Q131.3 -49.6 135.4 -49.6Q137.4 -49.6 139.2 -48.9Q140.9 -48.1 142.5 -46.8L150.6 -49.9L151.4 -49.4L142.7 -11.1Q142 -8.3 142 -6.5Q142 -4.4 143.9 -4.4Q145.3 -4.4 147.2 -5.7Q149 -7 151.4 -9.2L152.2 -8.4Q150.7 -6 148.5 -3.8Q146.2 -1.5 143.5 0Q140.7 1.5 137.6 1.5Q134.2 1.5 132.1 -0.6Q130 -2.6 130 -6.9Q130 -8.3 130.1 -9.6Q126.1 -5.1 121.7 -1.8Q117.2 1.5 113.2 1.5ZM114.1 -16.5Q114.1 -11.2 115.9 -8.9Q117.6 -6.5 120.5 -6.5Q122.9 -6.5 125.3 -8Q127.7 -9.5 130.5 -12.3Q130.7 -13.5 131 -14.8L137.3 -43.6Q136 -45.2 134.2 -45.8Q132.4 -46.4 131 -46.4Q126.7 -46.4 122 -41.3Q118.3 -37.2 116.2 -30.5Q114.1 -23.8 114.1 -16.5ZM170.7 1.5Q164.4 1.5 160.5 -1Q156.6 -3.5 156.6 -8.1Q156.6 -10.5 158.3 -12.3Q160 -14.1 162.7 -14.1Q167.7 -14.1 168.9 -8L169.5 -5.2Q170 -3.1 170.8 -1.8Q171.5 -0.5 173.7 -0.5Q176.2 -0.5 178.1 -2.6Q180 -4.7 180 -8.4Q180 -11.2 178.3 -13.8Q176.5 -16.4 172.4 -19.5Q168.3 -22.7 165.8 -26.2Q163.3 -29.6 163.3 -34.4Q163.3 -38.6 165.5 -42Q167.6 -45.5 171.7 -47.5Q175.8 -49.6 181.4 -49.6Q187.9 -49.6 191.7 -47Q195.4 -44.4 195.4 -40.3Q195.4 -38.1 194.1 -36.7Q192.8 -35.2 190.2 -35.2Q185.4 -35.2 183.7 -41L182.7 -43.8Q182.2 -45.8 181.5 -46.6Q180.8 -47.4 179.3 -47.4Q177.7 -47.4 176 -45.7Q174.3 -43.9 174.3 -40.1Q174.3 -36.5 176.5 -33.5Q178.6 -30.6 182.9 -27.4Q187.3 -24.1 189.4 -21Q191.4 -17.9 191.4 -13.5Q191.4 -9.4 189 -6Q186.6 -2.6 182 -0.6Q177.4 1.5 170.7 1.5ZM208.7 1.5Q205.6 1.5 203.6 -0.2Q201.5 -1.8 201.5 -5Q201.5 -7 201.9 -9.4Q202.3 -11.7 202.8 -14.4L209.7 -46H201.4L201.7 -47.2L205.3 -47.6Q208.1 -47.9 210.2 -49Q212.3 -50.1 214.2 -52.1L223.8 -61.8H225.3L222.5 -48.1H233.4L232.9 -46H222L215.1 -12.7Q214.7 -10.8 214.5 -9.4Q214.3 -8.1 214.3 -7.2Q214.3 -6.2 214.9 -5.6Q215.5 -5 216.2 -5Q217.6 -5 219.2 -6.2Q220.8 -7.3 223.2 -9.6L224.4 -8.6Q221.9 -4.9 217.9 -1.7Q213.9 1.5 208.7 1.5Z"/><path fill="#4ade80" d="M241.3 1.3Q237.9 1.3 235.8 -0.8Q233.6 -3 233.6 -6Q233.6 -9.8 236.3 -12.4Q239.1 -15 242.7 -15Q246.1 -15 248.2 -12.8Q250.4 -10.6 250.4 -7.5Q250.4 -3.8 247.7 -1.2Q244.9 1.3 241.3 1.3Z"/></svg></a>
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
    <p>Coast has a step-by-step cook mode with live timers, and builds meals like this into a week that hits your exact macros. Free.</p>
  </div>
</div>

<div class="cta-bar">
  <span>Free on iOS &middot; no ads, no accounts</span>
  <a href="${APP_STORE_URL}" onclick="gtag('event','download_click',{'button_location':'recipe_static_bar'})">Download free</a>
</div>

<footer>
  <a href="/">getcoast.fit</a><a href="/meals.html">All meals</a><a href="/privacy-policy.html">Privacy</a>
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
