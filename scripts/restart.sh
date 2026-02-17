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

echo "🔨 Checking better-sqlite3 binding..."
BINDING=$(node -e "require('better-sqlite3'); console.log('ok')" 2>/dev/null || echo "fail")
if [ "$BINDING" != "ok" ]; then
  echo "⚙️  Rebuilding better-sqlite3..."
  cd /home/node/.openclaw/code/mission-control
  npx node-gyp rebuild --directory node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3 2>/dev/null || true
fi

echo "🚀 Starting backend..."
cd /home/node/.openclaw/code/mission-control
node server/index.js > /tmp/mc-backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

sleep 3

echo "🌐 Starting file server..."
node /home/node/.openclaw/workspace/.fileserver/server.js > /tmp/mc-fileserver.log 2>&1 &
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
