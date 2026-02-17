#!/bin/bash
# Mission Control keep-alive — runs in background, checks every 60s
# Uses PID files + port checks to prevent duplicate spawns
MC_DIR="/home/node/.openclaw/code/mission-control"
LOG="/tmp/mc-server.log"
PID_BACKEND="/tmp/mc-backend.pid"
PID_FRONTEND="/tmp/mc-frontend.pid"
PID_WATCHER="/tmp/mc-watcher.pid"

is_running() {
  local pidfile="$1"
  [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null
}

while true; do
    # Backend (3002)
    if ! is_running "$PID_BACKEND" || ! curl -sf -m 5 -o /dev/null http://localhost:3002/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"davin","password":"REDACTED_PASSWORD"}' 2>/dev/null; then

        # Kill old if pid exists
        [ -f "$PID_BACKEND" ] && kill "$(cat "$PID_BACKEND")" 2>/dev/null && sleep 1
        echo "$(date): MC backend starting..." >> "$LOG"
        cd "$MC_DIR"
        nohup node server/index.js >> "$LOG" 2>&1 &
        echo $! > "$PID_BACKEND"
        echo "$(date): MC backend started (PID: $!)" >> "$LOG"
        sleep 3
    fi

    # Frontend (3001)
    if ! is_running "$PID_FRONTEND" || ! curl -sf -m 5 -o /dev/null http://localhost:3001/ 2>/dev/null; then

        [ -f "$PID_FRONTEND" ] && kill "$(cat "$PID_FRONTEND")" 2>/dev/null && sleep 1
        # Kill any orphan vite on 3001
        lsof -ti:3001 2>/dev/null | xargs kill 2>/dev/null; sleep 1
        echo "$(date): MC frontend starting..." >> "$LOG"
        cd "$MC_DIR"
        nohup npx vite preview --port 3001 --host >> /tmp/mc-frontend.log 2>&1 &
        echo $! > "$PID_FRONTEND"
        echo "$(date): MC frontend started (PID: $!)" >> "$LOG"
        sleep 3
    fi

    # Session watcher
    if ! is_running "$PID_WATCHER"; then
        echo "$(date): MC watcher starting..." >> "$LOG"
        cd "$MC_DIR"
        nohup node scripts/watch-sessions.js >> /tmp/mc-watcher.log 2>&1 &
        echo $! > "$PID_WATCHER"
        echo "$(date): MC watcher started (PID: $!)" >> "$LOG"
    fi

    sleep 60
done
