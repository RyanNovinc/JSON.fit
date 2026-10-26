#!/bin/sh
# Stamps try/index.html with content hashes of engines.min.js, try.js and try.css
# (?v=...), so browsers holding an old copy fetch the new one. Run after any change
# to those files, before committing.   sh scripts/try-engines/stamp.sh
set -e
cd "$(dirname "$0")/../../try"
h() { md5 -q "$1" 2>/dev/null | cut -c1-8 || md5sum "$1" | cut -c1-8; }
E=$(h engines.min.js); J=$(h try.js); C=$(h try.css)
sed -i '' -E "s#engines\.min\.js(\?v=[0-9a-f]+)?#engines.min.js?v=$E#g; s#try\.css(\?v=[0-9a-f]+)?\"#try.css?v=$C\"#; s#try\.js(\?v=[0-9a-f]+)?\"#try.js?v=$J\"#" index.html
grep -o '[a-z.]*?v=[0-9a-f]*' index.html
