#!/bin/bash
cd /home/node/.openclaw/code/mission-control
# Kill existing if running
pkill -f "node server/index.js" 2>/dev/null
sleep 1
nohup node server/index.js > /tmp/mc-server.log 2>&1 &
echo "Mission Control started (PID: $!)"
