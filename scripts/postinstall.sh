#!/bin/sh
# Patch @opennextjs/cloudflare to externalize cloudflare:email in esbuild
BUNDLE_SERVER="node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js"
if [ -f "$BUNDLE_SERVER" ]; then
  if ! grep -q 'cloudflare:email' "$BUNDLE_SERVER"; then
    sed -i.bak 's|"./middleware/handler.mjs",|"./middleware/handler.mjs","cloudflare:email",|' "$BUNDLE_SERVER"
    rm -f "$BUNDLE_SERVER.bak"
    echo "Patched bundle-server.js to externalize cloudflare:email"
  fi
fi
