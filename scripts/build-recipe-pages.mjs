#!/usr/bin/env node
/*
 * build-recipe-pages.mjs — one static page per PLATE at /r/<meal-slug>/<plate-id>/
 *
 * WHY: /r/?meal=X&plate=Y is client-rendered and GitHub Pages serves the same
 * file for every query string, so iMessage/WhatsApp/Messenger/Facebook — none of
 * which run JS — scrape one generic card for all 109 plates. These pages carry
 * a fully static head (og:title with the real macros, og:image, canonical,
 * Recipe JSON-LD) so the preview is correct without a line of JS executing.
 *
 * HOW: r/index.html is the template, not a thing to duplicate. We read it,
 * swap the block between BUILD:HEAD-START/END for the static head, and drop the
 * meal object into BUILD:DATA. The body, CSS and renderer are byte-identical to
 * the interactive page — edit r/index.html and re-run, never edit the output.
 *
 * The same pass writes the ROUTES table back into r/index.html so the
 * query-string page can bounce ?meal=&plate= straight to the static URL, and
 * refreshes the recipe block in sitemap.xml.
 *
 * USAGE (from the repo root):
 *     npm run build:recipes
 * Run npm run build:social first if images/meals/ changed — the og:image URLs
 * written here assume images/social/ is current.
 *
 * Then commit r/<meal-slug>/, r/index.html and sitemap.xml.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://json.fit';
const MEALS_JSON = path.resolve('r/meals.json');
const TEMPLATE = path.resolve('r/index.html');
const OUT_ROOT = path.resolve('r');
const SITEMAP = path.resolve('sitemap.xml');
const SOCIAL_DIR = path.resolve('images/social');
const FALLBACK_OG_IMAGE = `${SITE}/og-image.png`;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const titleCase = (s) => String(s || '').replace(/(^|[\s_-])(\w)/g, (_, sep, ch) => sep.replace(/[_-]/, ' ') + ch.toUpperCase());

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// Inlined into a <script>. A closing script tag or "<!--" inside a description
// would end the block early, and raw U+2028/U+2029 are line terminators to a JS
// parser — escape all four so any string in meals.json embeds verbatim.
const jsonForScript = (obj) => JSON.stringify(obj)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

function slugifyImage(f) {
  if (!f) return '';
  const ext = (f.match(/\.(png|jpe?g|webp)$/i) || ['', 'png'])[1].toLowerCase();
  const base = f.replace(/\.(png|jpe?g|webp)$/i, '');
  const slug = base
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-')
    .toLowerCase();
  return slug + '.' + ext;
}

/* ---------- meal / plate accessors (field names match r/meals.json) ---------- */

const platesOf = (meal) => (Array.isArray(meal.plates) ? meal.plates : []);

// Same rule the renderer uses, so /r/<slug>/ and a bare ?meal= land on the
// plate the interactive page would have opened.
function canonicalPlate(meal) {
  const ps = platesOf(meal);
  return ps.find((p) => p.display_name === meal.display_name)
    || ps.find((p) => !p.is_stunt_plate)
    || ps[0]
    || null;
}

// "On the table in N minutes" has to be true of at least one route through the
// recipe, so it's the QUICKEST method — not methods[0]. Butter chicken is 45min
// from scratch and 245 in the slow cooker, but 15 with jar sauce; 15 is the
// honest headline. Plate assembly time is on top of whichever you pick.
function totalMinutes(meal, plate) {
  const times = (meal.methods || [])
    .map((m) => num(m.time_total_minutes))
    .filter((t) => t != null && t > 0);
  const cook = times.length ? Math.min(...times) : 0;
  const assembly = num(plate.assembly_time_minutes) || 0;
  return Math.round(cook + assembly);
}

function fastestMethod(meal) {
  const ms = (meal.methods || []).filter((m) => num(m.time_total_minutes) != null);
  if (!ms.length) return (meal.methods || [])[0] || null;
  return ms.reduce((a, b) => (b.time_total_minutes < a.time_total_minutes ? b : a));
}

// Per-plate social card if build-social-images.mjs made one, else the meal's.
function ogImage(slug, plate) {
  const perPlate = path.join(SOCIAL_DIR, slug, `${plate.id}.jpg`);
  if (existsSync(perPlate)) return `${SITE}/images/social/${slug}/${plate.id}.jpg`;
  const perMeal = path.join(SOCIAL_DIR, `${slug}.jpg`);
  if (existsSync(perMeal)) return `${SITE}/images/social/${slug}.jpg`;
  return FALLBACK_OG_IMAGE;
}

// The in-page hero photo (not the social card) — mirrors imageUrl() in the renderer.
function heroImage(meal, plate) {
  const hosted = plate.photo_url || meal.photo_url;
  if (hosted) return hosted;
  const file = plate.image_filename || meal.image_filename;
  return file ? `${SITE}/images/meals/${slugifyImage(file)}` : '';
}

const ingName = (ing) => ing.display_name || ing.name || titleCase(ing.ingredient_id || ing.id || 'Ingredient');
const stepText = (s) => (typeof s === 'string' ? s : (s && (s.summary || s.text)) || '');

/* ---------- head + schema ---------- */

function recipeSchema(meal, plate, url) {
  const method = fastestMethod(meal);
  const m = plate.plate_macros || {};
  const img = heroImage(meal, plate);

  const ingredients = ((method && method.ingredients) || meal.ingredients || [])
    .concat(plate.additional_ingredients || [])
    .map(ingName);

  const steps = ((method && method.instructions) || meal.instructions || [])
    .concat(plate.additional_instructions || [])
    .map(stepText).filter(Boolean)
    .map((text) => ({ '@type': 'HowToStep', text }));

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: plate.display_name || meal.display_name,
    url,
    author: { '@type': 'Organization', name: 'JSON.fit', url: SITE },
  };
  if (img) data.image = [img];
  if (plate.description) data.description = plate.description;
  if (meal.cuisine) data.recipeCuisine = titleCase(meal.cuisine);
  const mins = totalMinutes(meal, plate);
  if (mins > 0) data.totalTime = `PT${mins}M`;
  if (ingredients.length) data.recipeIngredient = ingredients;
  if (steps.length) data.recipeInstructions = steps;

  const nut = { '@type': 'NutritionInformation' };
  if (m.kcal != null) nut.calories = `${Math.round(m.kcal)} kcal`;
  if (m.protein_g != null) nut.proteinContent = `${Math.round(m.protein_g)} g`;
  if (m.carbs_g != null) nut.carbohydrateContent = `${Math.round(m.carbs_g)} g`;
  if (m.fat_g != null) nut.fatContent = `${Math.round(m.fat_g)} g`;
  if (m.fiber_g != null) nut.fiberContent = `${Math.round(m.fiber_g)} g`;
  if (Object.keys(nut).length > 1) data.nutrition = nut;

  return data;
}

function buildHead(meal, plate, slug, mealCount) {
  const m = plate.plate_macros || {};
  const url = `${SITE}/r/${slug}/${plate.id}/`;
  const name = plate.display_name || meal.display_name;
  const image = ogImage(slug, plate);

  // "<Plate> · <kcal> cal · <protein>g protein" — the macros ARE the hook, so
  // they go in the title where every scraper shows them, not the description.
  const bits = [name];
  if (m.kcal != null) bits.push(`${Math.round(m.kcal)} cal`);
  if (m.protein_g != null) bits.push(`${Math.round(m.protein_g)}g protein`);
  const ogTitle = bits.join(' · ');

  const description =
    `On the table in ${totalMinutes(meal, plate)} minutes, every step written. ` +
    `One of ${mealCount} bulking meals for skinny guys who struggle to eat big. Free.`;

  const schema = recipeSchema(meal, plate, url);

  return `<title>${esc(name)} — JSON.fit</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="JSON.fit">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
<meta property="og:image:alt" content="${esc(name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(name)}">
<script type="application/ld+json" id="recipe-schema">
${JSON.stringify(schema, null, 2)}
</script>`;
}

/* ---------- template surgery ---------- */

function replaceRegion(html, marker, replacement, file, keepMarkers = false) {
  const start = `<!-- BUILD:${marker}-START`;
  const end = `<!-- BUILD:${marker}-END -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    console.error(`Missing BUILD:${marker} markers in ${file}. Re-add them or the build can't run.`);
    process.exit(1);
  }
  // keepMarkers: writing back into the template itself, so the region has to
  // stay findable next run. Otherwise (a generated page) drop the markers —
  // their text describes the template, and repeating it on 109 outputs would
  // just invite someone to edit a file that gets overwritten.
  if (keepMarkers) {
    const startCommentEnd = html.indexOf('-->', i) + 3;
    return html.slice(0, startCommentEnd) + '\n' + replacement + '\n' + html.slice(j);
  }
  return html.slice(0, i) + replacement + html.slice(j + end.length);
}

/* ---------- main ---------- */

let meals;
try {
  meals = JSON.parse(readFileSync(MEALS_JSON, 'utf8'));
} catch (e) {
  console.error(`Could not read ${MEALS_JSON}: ${e.message}`);
  console.error('Run this from the repo root (the folder that contains r/meals.json).');
  process.exit(1);
}

const template = readFileSync(TEMPLATE, 'utf8');
const slugs = Object.keys(meals);
const mealCount = slugs.length;

const routes = {};
const sitemapUrls = [];
let pages = 0, redirects = 0, missingImages = 0;

for (const slug of slugs) {
  const meal = meals[slug];
  const plates = platesOf(meal);
  if (!meal || !plates.length) {
    console.warn(`  skipped ${slug} — no plates`);
    continue;
  }

  const canon = canonicalPlate(meal);
  routes[slug] = { canonical: canon.id, plates: plates.map((p) => p.id) };

  for (const plate of plates) {
    const outDir = path.join(OUT_ROOT, slug, plate.id);
    const url = `${SITE}/r/${slug}/${plate.id}/`;

    const banner = `<!-- GENERATED by scripts/build-recipe-pages.mjs from r/index.html + r/meals.json. Do not edit. -->\n`;
    let html = replaceRegion(template, 'HEAD', banner + buildHead(meal, plate, slug, mealCount), 'r/index.html');
    html = replaceRegion(
      html,
      'DATA',
      `<script>window.__ROUTES__=null;window.__RECIPE__=${jsonForScript({ slug, plateId: plate.id, meal })};</script>`,
      'r/index.html',
    );

    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

    if (ogImage(slug, plate) === FALLBACK_OG_IMAGE) missingImages++;
    sitemapUrls.push(url);
    pages++;
  }

  // /r/<meal-slug>/ with no plate would 404 otherwise. Cheap bounce to the
  // canonical plate; deliberately noindex so it can't compete with the real page.
  writeFileSync(
    path.join(OUT_ROOT, slug, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${SITE}/r/${slug}/${canon.id}/">
<meta http-equiv="refresh" content="0;url=/r/${slug}/${canon.id}/">
<title>${esc(meal.display_name)} — JSON.fit</title>
</head>
<body><script>location.replace('/r/${slug}/${canon.id}/');</script>
<p>Redirecting to <a href="/r/${slug}/${canon.id}/">${esc(meal.display_name)}</a>.</p></body>
</html>
`,
    'utf8',
  );
  redirects++;
}

/* ---------- write the ROUTES table back into the query-string page ---------- */

const indexOut = replaceRegion(
  template,
  'DATA',
  `<script>window.__ROUTES__=${jsonForScript(routes)};window.__RECIPE__=null;</script>`,
  'r/index.html',
  true, // keep the markers — this file is the template for the next run
);
writeFileSync(TEMPLATE, indexOut, 'utf8');

/* ---------- sitemap ---------- */

let sitemapNote = 'sitemap.xml not found — skipped';
if (existsSync(SITEMAP)) {
  const today = new Date().toISOString().slice(0, 10);
  const block = sitemapUrls.map((loc) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
  ).join('\n');

  let xml = readFileSync(SITEMAP, 'utf8');
  const START = '  <!-- BUILD:RECIPES-START -->';
  const END = '  <!-- BUILD:RECIPES-END -->';
  if (xml.includes(START) && xml.includes(END)) {
    xml = xml.slice(0, xml.indexOf(START) + START.length) + '\n' + block + '\n' + xml.slice(xml.indexOf(END));
  } else {
    xml = xml.replace('</urlset>', `${START}\n${block}\n${END}\n</urlset>`);
  }
  writeFileSync(SITEMAP, xml, 'utf8');
  sitemapNote = `sitemap.xml — ${sitemapUrls.length} recipe URLs`;
}

/* ---------- stale output ---------- */

// Renaming a plate leaves its old directory behind, still indexed and still
// serving a page. Report rather than delete — this is a committed site, and a
// stray rm here would be a silent content loss in someone's git history.
const expected = new Set();
for (const [slug, entry] of Object.entries(routes)) {
  expected.add(slug);
  for (const id of entry.plates) expected.add(`${slug}/${id}`);
}
const stale = [];
for (const slug of readdirSync(OUT_ROOT, { withFileTypes: true })) {
  if (!slug.isDirectory()) continue;
  if (!expected.has(slug.name)) { stale.push(`r/${slug.name}/`); continue; }
  for (const plate of readdirSync(path.join(OUT_ROOT, slug.name), { withFileTypes: true })) {
    if (plate.isDirectory() && !expected.has(`${slug.name}/${plate.name}`)) {
      stale.push(`r/${slug.name}/${plate.name}/`);
    }
  }
}

/* ---------- report ---------- */

console.log(`\n${pages} plate pages across ${redirects} meals.`);
console.log(`  r/<meal-slug>/<plate-id>/index.html   static head + inlined meal`);
console.log(`  r/<meal-slug>/index.html              -> canonical plate (noindex)`);
console.log(`  r/index.html                          ROUTES table refreshed`);
console.log(`  ${sitemapNote}`);
if (missingImages) {
  console.warn(`\n⚠ ${missingImages} page(s) fell back to ${FALLBACK_OG_IMAGE} — run "npm run build:social" first.`);
}
if (stale.length) {
  console.warn(`\n⚠ ${stale.length} director${stale.length === 1 ? 'y is' : 'ies are'} no longer in meals.json — delete by hand if intended:`);
  for (const s of stale) console.warn(`    ${s}`);
}
console.log('\nCommit r/, sitemap.xml and images/social/.');
