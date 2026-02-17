#!/bin/bash
# This script is called FROM a system event to push session updates
# It doesn't spawn agents - it just formats and sends data

ADMIN_SECRET="${ADMIN_SECRET:-REDACTED_SECRET}"
BACKEND_URL="http://localhost:3002/api/admin/session-sync"

# Get sessions from stdin (passed by cron systemEvent)
SESSIONS_JSON="$1"

if [ -z "$SESSIONS_JSON" ]; then
  echo "Usage: $0 '<sessions_json>'"
  exit 1
fi

# POST to backend
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"sessions\":$SESSIONS_JSON,\"secret\":\"$ADMIN_SECRET\"}" \
  "$BACKEND_URL"
