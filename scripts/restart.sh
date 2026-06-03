#!/bin/bash
# restart.sh — Kill all MC processes and start fresh

echo "🛑 Killing existing processes..."
pkill -f "server/index.js" 2>/dev/null
pkill -f "watch-sessions.js" 2>/dev/null
pkill -f "fileserver/server.js" 2>/dev/null
pkill -f ".fileserver/server.js" 2>/dev/null
pkill -f "vite.js" 2>/dev/null
pkill -f "pnpm run dev" 2>/dev/null
sleep 2

NODE_BIN="/usr/local/bin/node"
NPM_BIN="/usr/local/bin/npm"

echo "🔨 Checking better-sqlite3 binding..."
BINDING=$("$NODE_BIN" -e "require('better-sqlite3'); console.log('ok')" 2>/dev/null || echo "fail")
if [ "$BINDING" != "ok" ]; then
  echo "⚙️  Rebuilding better-sqlite3..."
  cd /home/node/.openclaw/code/mission-control
  "$NPM_BIN" rebuild better-sqlite3
fi

echo "🚀 Starting backend..."
cd /home/node/.openclaw/code/mission-control
"$NODE_BIN" server/index.js > /tmp/mc-backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

sleep 3

echo "🌐 Starting file server..."
"$NODE_BIN" /home/node/.openclaw/workspace/.fileserver/server.js > /tmp/mc-fileserver.log 2>&1 &
FS_PID=$!
echo "  File server PID: $FS_PID"

sleep 2

# Verify
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
  echo "✅ Backend healthy"
else
  echo "❌ Backend not responding — check /tmp/mc-backend.log"
fi

if curl -s http://localhost:9000/mission_control/ > /dev/null 2>&1; then
  echo "✅ Frontend healthy at http://localhost:9000/mission_control"
else
  echo "❌ File server not responding — check /tmp/mc-fileserver.log"
fi

echo "Done."
