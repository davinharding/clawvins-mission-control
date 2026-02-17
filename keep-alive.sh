#!/bin/bash
# Mission Control keep-alive — runs in background, checks every 60s
MC_DIR="/home/node/.openclaw/code/mission-control"
LOG="/tmp/mc-server.log"

while true; do
    # Check backend (3002)
    if ! curl -sf -X POST http://localhost:3002/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"davin","password":"REDACTED_PASSWORD"}' > /dev/null 2>&1; then
        
        echo "$(date): MC backend down, restarting..." >> "$LOG"
        pkill -f "node server/index.js" 2>/dev/null
        sleep 1
        cd "$MC_DIR"
        nohup node server/index.js >> "$LOG" 2>&1 &
        echo "$(date): MC backend restarted (PID: $!)" >> "$LOG"
    fi

    # Check frontend (3001)
    if ! curl -sf -o /dev/null http://localhost:3001/ 2>/dev/null; then
        echo "$(date): MC frontend down, restarting..." >> "$LOG"
        pkill -f "vite preview.*3001" 2>/dev/null
        sleep 1
        cd "$MC_DIR"
        nohup npx vite preview --port 3001 --host >> /tmp/mc-frontend.log 2>&1 &
        echo "$(date): MC frontend restarted (PID: $!)" >> "$LOG"
    fi

    sleep 60
done
