#!/bin/sh
# Entrypoint script for client container
# Emits a small /usr/share/nginx/html/env.js to provide runtime config to the client.
# Order of precedence for server URL:
#   1) SERVER_URL env (normalized to ws/wss)
#   2) Fallback: current host + port 3000, protocol matched to page (wss under https)

set -eu

SERVER_URL="${SERVER_URL:-}"

# Normalize to ws/wss if provided
normalize_ws() {
  local url="$1"
  url=$(echo "$url" | sed 's|^http://|ws://|' | sed 's|^https://|wss://|')
  if ! echo "$url" | grep -Eq '^(ws|wss)://'; then
    url="ws://${url}"
  fi
  echo "$url"
}

WS_URL=""
if [ -n "$SERVER_URL" ]; then
  WS_URL="$(normalize_ws "$SERVER_URL")"
fi

# Write env.js used by the client at runtime
cat >/usr/share/nginx/html/env.js <<EOF
(function() {
  var envUrl = "${WS_URL}";
  var resolved = envUrl;
  if (!resolved) {
    var proto = window.location.protocol === "https:" ? "wss://" : "ws://";
    resolved = proto + window.location.hostname + ":3000";
  }
  if (window.location.protocol === "https:" && resolved.indexOf("ws://") === 0) {
    resolved = "wss://" + resolved.substring(5);
  }
  window.__SERVER_URL__ = resolved;
})();
EOF

# Inject a single script tag for env.js if not already present
if ! grep -q 'src="/env.js"' /usr/share/nginx/html/index.html; then
  sed -i 's|</head>|<script src="/env.js"></script></head>|' /usr/share/nginx/html/index.html
fi

exec nginx -g "daemon off;"
