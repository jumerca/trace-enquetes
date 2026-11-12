#!/usr/bin/env bash
# Assemble Animopolis : concatène les morceaux de parts/ dans animopolis/index.html,
# date la version (APP_BUILD), écrit version.json et sw.js.
#   ./build.sh                       -> build daté de maintenant
#   VERSION=2.2 ./build.sh           -> change le numéro de version (sinon fichier VERSION)
#   BUILD=202611120921 OUT=/tmp/x ./build.sh   -> build reproductible vers un autre dossier
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-$HERE/../animopolis}"
VERSION="${VERSION:-$(tr -d '[:space:]' < "$HERE/VERSION")}"
BUILD="${BUILD:-$(date -u +%Y%m%d%H%M)}"
mkdir -p "$OUT"
{ cat "$HERE/head.html"; echo "<script>"; cat "$HERE"/parts/*.js; cat "$HERE/tail.html"; } > "$OUT/index.html"
sed -i "s/__BUILD__/$BUILD/g;s/__VERSION__/$VERSION/g" "$OUT/index.html"
sed "s/__BUILD__/$BUILD/g" "$HERE/sw.tpl.js" > "$OUT/sw.js"
printf '{"version":"%s","build":"%s"}\n' "$VERSION" "$BUILD" > "$OUT/version.json"
echo "Animopolis $VERSION build $BUILD -> $OUT"
