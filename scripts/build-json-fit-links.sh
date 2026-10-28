#!/bin/bash
# Builds the small json.fit site (repo RyanNovinc/json-fit-links) from this one.
#
# The main site lives at getcoast.fit. json.fit has to keep serving, for app versions
# that still use it:
#   - .well-known/ (Apple universal links + Android app links must be served by json.fit itself)
#   - /p/... plan and share pages (opened by QR codes and shared links)
#   - the prompt / reference .md files, prompts/ and programs/*.json the app fetches
# Every other page redirects to the same path on getcoast.fit.
#
# Usage: scripts/build-json-fit-links.sh <path to the json-fit-links clone>
# Run it after changing any of the files above, then commit and push that repo too.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: build-json-fit-links.sh <json-fit-links clone>}"
[ -d "$OUT" ] || { echo "no such folder: $OUT"; exit 1; }

# clear previous build output, keeping the clone's .git
find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

cd "$SRC"
cp -R .well-known p prompts "$OUT/"
mkdir -p "$OUT/programs" "$OUT/assets" "$OUT/images"
cp programs/*.json "$OUT/programs/"
cp *.md *.txt "$OUT/" 2>/dev/null || true
cp 404.html .nojekyll analytics-web.js favicon-4.ico icon-32-4.png icon-180-4.png icon-192-4.png en_badge_web_generic.png "$OUT/"
cp assets/site.css assets/site.js "$OUT/assets/"
cp images/App_Store.svg "$OUT/images/"
printf 'json.fit\n' > "$OUT/CNAME"

# 404.html serves /p/<id> share pages; anything else goes to the same page on getcoast.fit
REDIRECT='<script>if(!/^\/p(\/|$)/.test(location.pathname))location.replace("https://getcoast.fit"+location.pathname+location.search+location.hash)</script><meta name="robots" content="noindex">'
python3 - "$OUT/404.html" "$REDIRECT" <<'EOF'
import sys
p, snippet = sys.argv[1], sys.argv[2]
s = open(p).read()
i = s.lower().find('<head>')
assert i >= 0, 'no <head> in 404.html'
s = s[:i + 6] + snippet + s[i + 6:]
open(p, 'w').write(s)
EOF
# p/index.html keeps working as is

cat > "$OUT/index.html" <<'EOF'
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Coast</title>
<meta name="robots" content="noindex"><link rel="canonical" href="https://getcoast.fit/">
<meta http-equiv="refresh" content="0;url=https://getcoast.fit/">
<script>location.replace("https://getcoast.fit/"+location.search+location.hash)</script>
</head><body><p>JSON.fit is now Coast: <a href="https://getcoast.fit/">getcoast.fit</a></p></body></html>
EOF

echo "built json.fit links site in $OUT ($(find "$OUT" -type f ! -path '*/.git/*' | wc -l | tr -d ' ') files)"
