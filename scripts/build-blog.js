/*
 * build-blog.js
 *
 * Single source of truth: posts.json
 * On each run this script:
 *   1. Works out "today" in your local timezone (Australia/Canberra).
 *   2. For every post whose date has arrived, makes sure its HTML file lives
 *      in blog/. If the file is still sitting in upcoming-blogs/, it moves it.
 *   3. Regenerates the post list and the JSON-LD schema inside blog.html,
 *      including ONLY posts whose date has arrived, newest first.
 *
 * It only edits the regions between the marker comments in blog.html, so the
 * nav, styles and footer stay hand-editable. Running it with no due changes
 * produces an identical file (nothing for git to commit).
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TZ = 'Australia/Canberra';
const SITE_URL = 'https://json.fit';
const PENDING_DIR = 'upcoming-blogs'; // where unpublished finished posts wait
const LIVE_DIR = 'blog';              // where published posts live

function todayInTZ(tz) {
  // en-CA formats as YYYY-MM-DD, which sorts and compares correctly as a string
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function prettyDate(iso) {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${months[m - 1]} ${d}, ${y}`;
}

function replaceBetween(src, name, content) {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(src)) throw new Error(`Markers for "${name}" not found in blog.html`);
  return src.replace(re, `$1\n${content}\n    $2`);
}

const today = todayInTZ(TZ);
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'posts.json'), 'utf8'));

// --- 1 & 2: publish files that are due ---
let moved = 0;
for (const p of posts) {
  if (p.date <= today) {
    const livePath = path.join(ROOT, LIVE_DIR, `${p.slug}.html`);
    const pendingPath = path.join(ROOT, PENDING_DIR, `${p.slug}.html`);
    if (!fs.existsSync(livePath) && fs.existsSync(pendingPath)) {
      fs.mkdirSync(path.dirname(livePath), { recursive: true });
      fs.renameSync(pendingPath, livePath);
      console.log(`Published file: ${p.slug}.html`);
      moved++;
    }
  }
}

// --- 3: build visible list (due posts only, newest first) ---
const live = posts
  .filter(p => p.date <= today)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const listHtml = live.map(p => `        <a href="${LIVE_DIR}/${p.slug}.html" class="post-link">
            <div class="post-meta">
                <span class="post-date">${prettyDate(p.date)}</span>
                <span class="post-meta-sep">&middot;</span>
                <span class="post-read">${escapeHtml(p.readTime)}</span>
            </div>
            <div class="post-title">${escapeHtml(p.title)}</div>
            <div class="post-desc">${escapeHtml(p.description)}</div>
        </a>`).join('\n\n');

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'JSON.fit Blog',
  description: 'Tutorials, guides, and thoughts on AI-powered fitness programming.',
  url: `${SITE_URL}/blog.html`,
  publisher: { '@type': 'Organization', name: 'JSON.fit', url: SITE_URL },
  blogPost: live.map(p => ({
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.description,
    url: `${SITE_URL}/${LIVE_DIR}/${p.slug}.html`,
    datePublished: p.date,
    author: { '@type': 'Organization', name: 'JSON.fit' }
  }))
};

const schemaHtml = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 4)}\n    </script>`;

const blogPath = path.join(ROOT, 'blog.html');
let html = fs.readFileSync(blogPath, 'utf8');
html = replaceBetween(html, 'BLOG-SCHEMA', schemaHtml);
html = replaceBetween(html, 'BLOG-LIST', listHtml);
fs.writeFileSync(blogPath, html);

console.log(`Done. Today (${TZ}): ${today}. Visible posts: ${live.length}. Files moved: ${moved}.`);
