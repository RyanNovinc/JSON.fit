#!/usr/bin/env node
/**
 * build-landing.mjs
 *
 * Builds the niche landing pages (/meal-prep/, /fifo/, /protein-first/) from the home page.
 * Same design, same sections; only the message changes: title and descriptions, hero, tags,
 * one intro line, the meals paragraph, the FAQ (and its JSON-LD) and the closing line.
 *
 * Run after any change to index.html so the landing pages pick it up:
 *   node scripts/build-landing.mjs
 *
 * Each page tags its analytics events with page_variant (see analytics-web.js) and sends
 * "Build my free plan" to /try/?v=<variant>. appStorePpid: paste the App Store Custom Product
 * Page id for that page once it exists in App Store Connect (empty = the normal store page).
 *
 * Copy rules: no em dashes, no made-up numbers, no prescription medicine names (TGA).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://getcoast.fit';

const SLOW_COOKER_FAQ = {
  q: 'Do I need a slow cooker?',
  a: 'For 29 of the 37 batch meals, yes. The other 8 are oven bakes. Any 5.5 L slow cooker works: <a href="https://www.bigw.com.au/product/contempo-slow-cooker-5-5l/p/263539" rel="nofollow noopener" target="_blank">this one is $24 at Big W</a>. Not sponsored, no commission.',
};
const SAME_THING_FAQ = {
  q: "Won't I get sick of eating the same thing?",
  a: 'One cook covers different meals across the week, not one dish seven times. Swap any meal for another you like and the app re-balances the day so it still lands on your macros.',
};
const COST_FAQ = {
  q: 'How much does Coast cost?',
  a: 'Coast is free: meal plans, training programs, shopping lists and meal prep, with no ads and no account.',
};

const PAGES = [
  {
    variant: 'meal-prep',
    phoneLine: 'One shop, one cook, 8 tubs on your macros. About 10 minutes hands-on.', // shown under the headline on phones only (the sub-heading is hidden there)
    startScene: 1, // phone preview opens on the meals scene (0 route, 1 meals, 2 training)
    appStorePpid: '', // TODO: Custom Product Page id for /meal-prep/ (App Store Connect)
    title: 'High Protein Meal Prep on Your Macros: Cook Once a Week | Coast',
    description: 'High protein meal prep for people who already train. One shop, one slow cooker cook, 8 tubs on your macros. Free app, no ads, no account.',
    ogTitle: 'Cook once. Eat on your macros all week.',
    ogDescription: 'You already train. Coast plans your food: one shop, one cook, 8 high protein tubs on your macros. Plus your route and a 1-year program. Free.',
    label: 'For people who already train',
    h1: 'You already train.<em>Your food falls apart by Wednesday.</em>',
    h1Long: true,
    sub: 'One shop and one cook on Sunday, about 10 minutes hands-on, and the slow cooker does the rest. 8 tubs on your macros, ready for the week. Your route and a 1-year training program come with it, free.',
    chips: [
      ['When to cut, when to bulk', ''],
      ['8 tubs, one cook', 'on your macros'],
      ['1-year program', 'included'],
    ],
    perksSub: 'One cook replaces a week of deciding, shopping and cooking. That\'s about <a class="six" href="/time/" title="See how we worked it out">6 hours a week</a> back.',
    mealsP: 'Built for slow cooker meal prep: 29 slow cooker meals and 8 oven bakes, each cooked once for 8 tubs, most with 10 minutes or less of hands-on work. The app picks which ones, writes one shopping list and plans each day around them, so every day adds up to your macros and your protein.',
    faq: [
      { q: 'I already train. Why is my food the problem?', a: 'Training is a few sessions a week. Food is every day: deciding, shopping, cooking and guessing the macros. Coast plans it once. One shopping list, one cook, and each day already adds up to your calories and protein.' },
      { q: 'Is this high protein meal prep?', a: 'Yes. Your protein target comes from the research (see the <a href="/research/">42 sources</a>), and every day is planned to hit it. The batch meals are built around chicken, beef, pork, lamb, fish or plant protein.' },
      SLOW_COOKER_FAQ,
      SAME_THING_FAQ,
      { q: 'Can I use it to cut, not just bulk?', a: 'Yes. Set your goal weight and body fat and your route plans the phases: a cut, a build or both, in the right order. Your calories and meals follow the phase you are in.' },
      COST_FAQ,
    ],
    finalH2: 'Cook once.<br><em>Eat well all week.</em>',
  },
  {
    variant: 'fifo',
    phoneLine: 'Camp food on site. At home, one cook covers your week on your macros.', // shown under the headline on phones only (the sub-heading is hidden there)
    startScene: 1, // phone preview opens on the meals scene (0 route, 1 meals, 2 training)
    appStorePpid: '', // TODO: Custom Product Page id for /fifo/ (App Store Connect)
    title: 'FIFO Meal Prep and Workout Plan for Your Home Weeks | Coast',
    description: 'FIFO meal prep and a workout plan for your weeks at home. One cook covers your home week, on your macros. Free app, no ads, no account.',
    ogTitle: 'Back from swing? Your week is already planned.',
    ogDescription: 'For FIFO and shift workers: one shop and one cook covers your home week, on your macros, plus training at the gym, at home or bodyweight only. Free.',
    label: 'For FIFO and shift workers',
    h1: 'Back from swing.<em>Your week, already planned.</em>',
    h1Long: true,
    sub: 'On site it\'s camp food. At home, Coast has it covered: one shop and one cook on your first day back, 8 tubs on your macros, and a training plan for the gym, at home or bodyweight only, 1 to 6 days a week.',
    chips: [
      ['When to cut, when to bulk', ''],
      ['8 tubs, one cook', 'for your home weeks'],
      ['Gym, home or bodyweight', '1 to 6 days'],
    ],
    perksSub: 'Your days at home are short. Spend them living, not planning: save about <a class="six" href="/time/" title="See how we worked it out">6 hours a week</a> on food alone.',
    mealsP: 'Cook once when you get home and the fridge and freezer are sorted. Every batch meal makes 8 tubs, keeps 3 days in the fridge and freezes, and most take 10 minutes or less of hands-on work while the slow cooker or oven does the rest. The app picks which ones and builds each day around your macros.',
    faq: [
      { q: 'Does it plan my food on site?', a: 'Not yet. On swing you eat what the camp serves. Coast plans your home weeks: one shopping list, one cook, 8 tubs on your macros. Your calorie and protein targets are in the app, so you know what to aim for at the camp mess too.' },
      { q: 'Can the training fit around my roster?', a: 'You pick 1 to 6 training days a week and where you train: a gym, at home or bodyweight only. Bodyweight sessions need no equipment, so they work anywhere, camp room included.' },
      { q: "I'm only home for a week. Is batch cooking worth it?", a: 'Yes. One cook makes 8 tubs, about 4 days of lunches and dinners, and every batch meal freezes, so anything left over waits for your next week home.' },
      SLOW_COOKER_FAQ,
      { q: 'Is it for losing weight or building muscle?', a: "Either, or both. You set the goal weight and body fat, and your route plans the phases in between: when to cut, when to build, and how long each one takes." },
      COST_FAQ,
    ],
    finalH2: 'Make your home weeks<br><em>count.</em>',
  },
  {
    variant: 'protein-first',
    phoneLine: 'High protein meals on your macros, a steady cut and strength training, planned for you.', // shown under the headline on phones only (the sub-heading is hidden there)
    startScene: 1, // phone preview opens on the meals scene (0 route, 1 meals, 2 training)
    appStorePpid: '', // TODO: Custom Product Page id for /protein-first/ (App Store Connect)
    title: 'High Protein Meal Plan to Keep Muscle While Losing Weight | Coast',
    description: 'Lose weight and keep your muscle: a high protein meal plan on your macros, a steady cut and strength training. Free app, no ads, no account.',
    ogTitle: 'Lose the fat. Keep the muscle.',
    ogDescription: 'A high protein meal plan on your macros, a cut paced to keep muscle and a strength program, all planned for you. Cook once a week. Free.',
    label: 'Losing weight, keeping muscle',
    h1: 'Lose the fat.<em>Keep the muscle.</em>',
    h1Long: false,
    sub: 'A high protein meal plan built to your macros, a cut paced so you hold onto muscle, and a strength program to give it a reason to stay. Cook once a week: 8 tubs, about 10 minutes hands-on.',
    chips: [
      ['A steady cut', 'paced to keep muscle'],
      ['High protein meals', 'on your macros'],
      ['Strength training', 'to keep muscle'],
    ],
    perksSub: 'Eating enough protein shouldn\'t mean cooking every night. Save about <a class="six" href="/time/" title="See how we worked it out">6 hours a week</a> on food alone.',
    mealsP: 'Every day is planned to your protein target, and on a cut that target goes up, as the research recommends. The batch meals are cooked once for 8 tubs, mostly in a slow cooker with 10 minutes or less of hands-on work, so hitting your protein is the easy part of the week.',
    faq: [
      { q: 'How do I keep muscle while losing weight?', a: 'Three things the research agrees on: enough protein, strength training, and not cutting too fast. Coast plans all three: your protein target, a program that keeps you lifting, and a pace of about 0.5% of your body weight a week.' },
      { q: 'How much protein do I need?', a: 'It depends on your weight and your goal, and it is higher on a cut. The app works it out from published studies and plans every day to hit it. The studies are on the <a href="/research/">research page</a>.' },
      { q: "I've never lifted. Will the training work for me?", a: 'Yes. Pick 1 to 6 days a week and train at a gym, at home or with bodyweight only. Every exercise shows how to do it, and the program tells you how hard to push on every set.' },
      SLOW_COOKER_FAQ,
      SAME_THING_FAQ,
      COST_FAQ,
    ],
    finalH2: 'Lose the fat.<br><em>Keep what you built.</em>',
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => html.replace(/<[^>]+>/g, '');

function replaceOnce(src, re, to, label) {
  const m = src.match(re);
  if (!m) throw new Error(`build-landing: "${label}" not found in index.html`);
  if (re.global) throw new Error('use a non-global regex');
  const all = src.split(m[0]).length - 1;
  if (all !== 1) throw new Error(`build-landing: "${label}" matched ${all} times`);
  return src.replace(re, typeof to === 'function' ? to : () => to);
}

function build(page, home) {
  let s = home;
  const url = `${SITE}/${page.variant}/`;
  const r = (re, to, label) => { s = replaceOnce(s, re, to, label); };

  r(/<meta name="page-variant" content="[^"]*">/, `<meta name="page-variant" content="${page.variant}">`, 'page-variant meta');
  r(/gtag\('set', \{'page_variant': '[^']*'\}\);/, `gtag('set', {'page_variant': '${page.variant}'});`, 'gtag page_variant');
  r(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`, 'title');
  r(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(page.description)}">`, 'description');
  r(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(page.ogTitle)}">`, 'og:title');
  r(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(page.ogDescription)}">`, 'og:description');
  r(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  r(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(page.ogTitle)}">`, 'twitter:title');
  r(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(page.ogDescription)}">`, 'twitter:description');
  r(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`, 'canonical');

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: text(f.a) } })),
  };
  r(/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema.org",\s*"@type": "FAQPage"[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${JSON.stringify(faqLd, null, 2)}\n</script>`, 'FAQ JSON-LD');

  r(/(<div class="hcopy">\s*<p class="label">)[^<]*(<\/p>)/, (m, a, b) => a + page.label + b, 'hero label');
  r(/<h1 id="h1">[\s\S]*?<\/h1>/, `<h1 id="h1"${page.h1Long ? ' class="long"' : ''}>${page.h1}</h1>`, 'h1');
  r(/(<h1 id="h1"[^>]*>[\s\S]*?<\/h1>\s*<p class="sub">)[\s\S]*?(<\/p>)/, (m, a, b) => a + page.sub + b, 'hero sub');
  if (page.phoneLine) r(/(<h1 id="h1"[^>]*>[\s\S]*?<\/h1>)/, (m, a) => `${a}\n      <p class="msub">${page.phoneLine}</p>`, 'phone line');
  if (page.startScene) {
    r(/<div class="mprev" role="img"/, `<div class="mprev" data-start="${page.startScene}" role="img"`, 'preview start');
    // Mark the lead scene in the markup too, so the first paint already shows it (no flash of the route).
    let n = 0;
    s = s.replace(/<div class="mp-scene( on)?" aria-hidden="true">/g, () => `<div class="mp-scene${n++ === page.startScene ? ' on' : ''}" aria-hidden="true">`);
    if (n !== 3) throw new Error(`build-landing: expected 3 preview scenes, found ${n}`);
    const pips = [0, 1, 2].map((i) => `<i${i < page.startScene ? ' class="done"' : i === page.startScene ? ' class="on"' : ''}></i>`).join('');
    r(/<div class="mp-pips" aria-hidden="true">[\s\S]*?<\/div>/, `<div class="mp-pips" aria-hidden="true">${pips}</div>`, 'preview pips');
  }

  const chipCls = ['chip a on', 'chip b', 'chip c2'];
  page.chips.forEach(([b, span], i) => {
    const re = new RegExp(`(<button type="button" class="${chipCls[i]}" data-i="${i}"><i [^>]*><\\/i>)[\\s\\S]*?(<\\/button>)`);
    r(re, (m, a, z) => a + `<b>${b}</b>` + (span ? `<span>${span}</span>` : '') + z, `chip ${i}`);
  });

  r(/<p class="perks-sub">[\s\S]*?<\/p>/, `<p class="perks-sub">${page.perksSub}</p>`, 'perks-sub');
  r(/(<h2 id="meals-h"[^>]*>[\s\S]*?<\/h2>\s*<p>)[\s\S]*?(<\/p>)/, (m, a, b) => a + page.mealsP + b, 'meals paragraph');

  const faqHtml = page.faq.map((f) => `      <details><summary>${f.q}</summary><div class="a">${f.a}</div></details>`).join('\n');
  r(/(<div class="faq">\n)[\s\S]*?(\n    <\/div>)/, (m, a, b) => a + faqHtml + b, 'FAQ');
  r(/<h2 id="dl-h">[\s\S]*?<\/h2>/, `<h2 id="dl-h">${page.finalH2}</h2>`, 'closing h2');

  const tries = s.split('href="/try/?v=home#start"').length - 1;
  if (tries < 1) throw new Error('build-landing: no /try/?v=home#start links');
  s = s.split('href="/try/?v=home#start"').join(`href="/try/?v=${page.variant}#start"`);
  r(/var VARIANT_PPID='[^']*';/, `var VARIANT_PPID='${page.appStorePpid}';`, 'VARIANT_PPID');

  // The page lives one folder down: make the home page's relative URLs absolute.
  s = s.replace(/(\s(?:src|href|poster)=")(?!https?:|\/|#|data:|mailto:|tel:|javascript:)([^"]+)"/g, '$1/$2"');
  s = s.replace(/(\ssrcset=")([^"]+)"/g, (m, a, v) => a + v.split(',').map((part) => {
    const t = part.trim(); return /^(https?:|\/|data:)/.test(t) ? t : '/' + t;
  }).join(', ') + '"');
  s = s.replace(/url\((['"]?)(?!https?:|\/|data:|#)([^)'"]+)\1\)/g, 'url($1/$2$1)');

  const banner = `<!-- GENERATED by scripts/build-landing.mjs from index.html (variant: ${page.variant}). Edit the config there and rerun; don't edit this file. -->\n`;
  s = s.replace(/^<!DOCTYPE html>\n/i, (d) => d + banner);

  for (const bad of ['—', 'Ozempic', 'Wegovy', 'Mounjaro', 'semaglutide', 'tirzepatide', 'powered by AI', 'fat burning', 'meal replacement']) {
    const visible = [page.phoneLine || '', page.title, page.description, page.ogTitle, page.ogDescription, page.label, page.h1, page.sub, page.perksSub, page.mealsP, page.finalH2, ...page.chips.flat(), ...page.faq.flatMap((f) => [f.q, f.a])].join(' ');
    if (visible.toLowerCase().includes(bad.toLowerCase())) throw new Error(`build-landing: "${bad}" in ${page.variant} copy`);
  }
  if (page.description.length > 160) throw new Error(`build-landing: ${page.variant} description is ${page.description.length} chars`);
  return s;
}

const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const page of PAGES) {
  const out = build(page, home);
  const dir = path.join(ROOT, page.variant);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), out);
  console.log(`wrote /${page.variant}/index.html (${out.length.toLocaleString()} bytes)`);
}
