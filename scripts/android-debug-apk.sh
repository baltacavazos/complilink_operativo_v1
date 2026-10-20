#!/usr/bin/env bash
# APK de depuración que abre el sitio en vivo. No es un bundle de Play.
set -euo pipefail

cd "$(dirname "$0")/.."

# Capacitor exige que webDir exista, pero con server.url el WebView no usa
# esos archivos como la app. Un index mínimo basta si no hay build web.
mkdir -p dist/public
if [[ ! -f dist/public/index.html ]]; then
  cat > dist/public/index.html <<'EOF'
<!doctype html>
<meta charset="utf-8">
<title>Auditapatron</title>
<p>Esta build carga https://auditapatron.com. Si ves este texto, no hay red.</p>
EOF
fi

export CAPACITOR_SERVER_URL="${CAPACITOR_SERVER_URL:-https://auditapatron.com}"
unset CAPACITOR_USE_LOCAL_ASSETS

pnpm exec cap sync android

cd android
./gradlew assembleDebug

echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
