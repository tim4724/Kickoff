#!/bin/sh
# Entrypoint script for client container
# Injects server URL into HTML at runtime

SERVER_URL=${SERVER_URL:-http://localhost:3000}

# Convert HTTP/HTTPS to WebSocket protocol
WS_URL=$(echo "$SERVER_URL" | sed 's|^http://|ws://|' | sed 's|^https://|wss://|')

# Ensure WebSocket protocol if no protocol specified
if [ -z "$(echo "$WS_URL" | grep -E '^(ws|wss)://')" ]; then
  WS_URL="ws://${WS_URL}"
fi

# Inject server URL into index.html before </head>
# Escape special characters for sed
ESCAPED_WS_URL=$(echo "$WS_URL" | sed 's/[[\.*^$()+?{|]/\\&/g')
sed -i "s|</head>|<meta name=\"server-url\" content=\"${ESCAPED_WS_URL}\"><script>window.__SERVER_URL__='${ESCAPED_WS_URL}';</script></head>|" /usr/share/nginx/html/index.html

# Start nginx
exec nginx -g "daemon off;"

