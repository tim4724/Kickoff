#!/bin/sh
# Entrypoint script for client container
# Injects server URL into HTML at runtime

SERVER_URL=${SERVER_URL:-}

# If SERVER_URL is provided, normalize to websocket protocol; otherwise leave blank to use runtime fallback
if [ -n "$SERVER_URL" ]; then
  WS_URL=$(echo "$SERVER_URL" | sed 's|^http://|ws://|' | sed 's|^https://|wss://|')
  if [ -z "$(echo "$WS_URL" | grep -E '^(ws|wss)://')" ]; then
    WS_URL="ws://${WS_URL}"
  fi
else
  WS_URL=""
fi

# Inject runtime resolver into index.html before </head>
cat >/tmp/inject_server_url.js <<EOF
<script>
(function() {
  var envUrl = "${WS_URL}";
  var resolved = envUrl;
  if (!resolved || resolved.indexOf("localhost") !== -1) {
    var proto = window.location.protocol === "https:" ? "wss://" : "ws://";
    var port = "3000";
    resolved = proto + window.location.hostname + ":" + port;
  }
  window.__SERVER_URL__ = resolved;
  var meta = document.createElement("meta");
  meta.name = "server-url";
  meta.content = resolved;
  document.head.appendChild(meta);
})();
</script>
EOF

INJECT_SINGLE_LINE=$(tr '\n' ' ' < /tmp/inject_server_url.js)
ESCAPED_INJECT=$(echo "$INJECT_SINGLE_LINE" | sed 's/[\/&]/\\&/g')
sed -i "s|</head>|${ESCAPED_INJECT}</head>|" /usr/share/nginx/html/index.html

# Start nginx
exec nginx -g "daemon off;"
