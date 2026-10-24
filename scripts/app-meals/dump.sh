#!/bin/sh
# Dump the app's offered meals (BATCH_LIBRARY=1, BATCH_PLANNER=1) to JSON.
#
#   sh scripts/app-meals/dump.sh <app repo or worktree>    # from the site repo root
#   node scripts/refresh-offered-meals.mjs                  # then rebuild r/meals.json
#
# Bundles the app's own offeredMeals() with esbuild (from the app's node_modules) so the
# list is exactly what the app shows, not a re-implementation. The stubs stand in for
# the React Native modules the import chain touches at load. Output (git-ignored):
# scripts/app-meals/out/offered.json
set -e
APP=${1:?usage: dump.sh <app dir>}
APP=$(cd "$APP" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HERE/out"
sed "s#APP_DIR#$APP#g" "$HERE/entry.ts" > "$HERE/out/entry.ts"
S=$HERE/stubs
(cd "$APP" && npx esbuild "$HERE/out/entry.ts" --bundle --platform=node --format=cjs --outfile="$HERE/out/dump.cjs" --log-level=warning \
  --alias:react-native=$S/rn.js --alias:@react-native-async-storage/async-storage=$S/asyncstorage.js \
  --alias:expo-notifications=$S/empty.js --alias:expo-file-system=$S/fs \
  --alias:react=$S/react.js --alias:@react-navigation/native=$S/nav.js \
  --define:process.env.EXPO_PUBLIC_BATCH_PLANNER='"1"' --define:process.env.EXPO_PUBLIC_BATCH_LIBRARY='"1"' \
  --define:process.env.EXPO_PUBLIC_MEAL_GENERATOR='"1"' --define:process.env.EXPO_PUBLIC_WORKOUT_GENERATOR='"1"' --define:__DEV__=false)
node "$HERE/out/dump.cjs" > "$HERE/out/offered.json"
echo "wrote scripts/app-meals/out/offered.json ($(cd "$APP" && git rev-parse --short HEAD 2>/dev/null || echo '?'))"
