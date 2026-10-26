#!/bin/sh
# Build the /try/ page's engine bundle from an app checkout.
#
#   sh scripts/try-engines/build.sh <app repo or worktree>     # from the site repo root
#
# Bundles the app's own engines (route, meal generator with the batch planner,
# shopping list, workout generator) with esbuild from the APP's node_modules,
# minified, into try/engines.min.js. The page runs it in a Web Worker.
# Nothing in the app is changed. The stubs (shared with scripts/app-meals) stand
# in for the phone-only modules the engines import but never call while building
# a plan. Run it again for each app release, then commit try/engines.min.js and
# try/meal-index.json.
set -e
APP=${1:?usage: build.sh <app dir>}
APP=$(cd "$APP" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
SITE=$(cd "$HERE/../.." && pwd)
S=$SITE/scripts/app-meals/stubs
OUT=$HERE/out
mkdir -p "$OUT"
VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$APP/app.json" | head -1)
REV=$(cd "$APP" && git rev-parse --short HEAD 2>/dev/null || echo '?')
for f in entry meals-part training-part; do sed "s#APP_DIR#$APP#g" "$HERE/$f.ts" > "$OUT/$f.ts"; done
COMMON="--bundle --log-level=warning \
  --alias:react-native=$S/rn.js --alias:@react-native-async-storage/async-storage=$S/asyncstorage.js \
  --alias:expo-notifications=$S/empty.js --alias:expo-file-system=$S/fs \
  --alias:react=$S/react.js --alias:@react-navigation/native=$S/nav.js \
  --define:process.env.EXPO_PUBLIC_BATCH_PLANNER=\"1\" --define:process.env.EXPO_PUBLIC_BATCH_LIBRARY=\"1\" \
  --define:process.env.EXPO_PUBLIC_MEAL_GENERATOR=\"1\" --define:process.env.EXPO_PUBLIC_WORKOUT_GENERATOR=\"1\" \
  --define:__DEV__=false --define:__APP_VERSION__=\"$VER\" --define:__APP_REV__=\"$REV\""
# The browser worker bundle.
(cd "$APP" && npx esbuild "$OUT/entry.ts" $COMMON --platform=browser --format=iife --minify \
  --legal-comments=none --outfile="$SITE/try/engines.min.js")
# A node build of the same entry, for the test scripts (git-ignored).
(cd "$APP" && npx esbuild "$OUT/entry.ts" $COMMON --platform=node --format=cjs --outfile="$OUT/engines.cjs")
# The slug -> photo / recipe page index the page uses for meal photos and links.
node "$HERE/meal-index.mjs" "$OUT/engines.cjs" "$SITE"
echo "try/engines.min.js from app $VER ($REV): $(wc -c < "$SITE/try/engines.min.js" | tr -d ' ') bytes, $(gzip -c "$SITE/try/engines.min.js" | wc -c | tr -d ' ') gzipped"
sh "$HERE/stamp.sh"
