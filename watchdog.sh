#!/bin/bash
# Mission Control watchdog — keeps the server alive
# Run via system crontab every 2 minutes

MC_DIR="/home/node/.openclaw/code/mission-control"
LOG="/tmp/mc-server.log"
PIDFILE="/tmp/mc-server.pid"

# Check if server is responding
if curl -sf -m 5 http://localhost:3002/health > /dev/null 2>&1; then
    exit 0
fi

# Server is down — kill any zombie process
if [ -f "$PIDFILE" ]; then
    kill $(cat "$PIDFILE") 2>/dev/null
    rm -f "$PIDFILE"
fi
pkill -f "node server/index.js" 2>/dev/null
sleep 1

# Restart
cd "$MC_DIR"
nohup node server/index.js >> "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "$(date): Mission Control restarted (PID: $!)" >> "$LOG"
