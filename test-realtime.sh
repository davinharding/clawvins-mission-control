#!/bin/bash
# Test Real-Time Event Streaming
# This script creates a dummy session file to trigger the watcher

WORKSPACE_DIR="/home/node/.openclaw/workspace-coder"
SESSION_FILE="$WORKSPACE_DIR/test-session-$(date +%s).jsonl"

echo "=== Testing Real-Time Event Streaming ==="
echo ""
echo "Creating test session file: $SESSION_FILE"

# Create a test session file
cat > "$SESSION_FILE" << 'EOF'
{"role":"user","content":"Test message","timestamp":1234567890}
{"role":"assistant","content":"Test response","timestamp":1234567891}
EOF

echo "✓ Test session file created"
echo ""
echo "Watch the backend logs for:"
echo "  [Watcher] Detected change: test-session-*.jsonl"
echo "  [SessionMonitor] Broadcasting event..."
echo ""
echo "Watch the browser console for:"
echo "  [WebSocket] Received event.new:"
echo "  [State] Event count after merge:"
echo ""
echo "The event should appear in Mission Control within 10 seconds."
echo ""
echo "To clean up: rm $SESSION_FILE"
