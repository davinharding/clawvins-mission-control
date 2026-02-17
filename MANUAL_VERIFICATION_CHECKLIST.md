# Manual Verification Checklist
## Mission Control Viewport & Real-Time Fixes

**Test Date:** $(date +%Y-%m-%d)  
**Tested By:** _____________  

---

## Prerequisites
- [ ] Backend server running on port 3002
- [ ] Frontend accessible (check vite/build setup)
- [ ] Browser console open (F12)
- [ ] Browser viewport: 1920x1080 (desktop)

---

## Test 1: Agent Sidebar Layout ✅

### Requirements:
- Agent list should scroll within its card
- Status Legend should be visible below agent list
- Both should fit in viewport without page scroll

### Steps:
1. Open Mission Control
2. Look at left sidebar
3. Verify agent list has scroll if needed
4. Scroll down in agent list
5. Verify Status Legend is visible at bottom

### Checkpoints:
- [ ] Agent Filters card has internal scrolling
- [ ] Status Legend card is visible (shows Online/Busy/Offline)
- [ ] Both cards fit in left sidebar without overflow
- [ ] No vertical scrollbar on page itself

### Expected Layout:
```
┌─ Left Sidebar ─────────────┐
│ Agent Filters              │
│ ┌────────────────────────┐ │
│ │ [Tabs: All/Main/Dev]   │ │
│ │                        │ │
│ │ Agent List (scrolls)   │ │
│ │  • Agent 1             │ │
│ │  • Agent 2             │ │
│ │  • ...                 │ │
│ │                        │ │
│ └────────────────────────┘ │
│                            │
│ Status Legend              │
│ ┌────────────────────────┐ │
│ │ ● Online               │ │
│ │ ● Busy                 │ │
│ │ ● Offline              │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

---

## Test 2: Kanban Board Columns ✅

### Requirements:
- All 4 columns visible without horizontal scroll
- Each column scrolls tasks independently
- Columns fill viewport height

### Steps:
1. Look at center Kanban board
2. Verify all 4 columns visible: Backlog, To Do, In Progress, Done
3. Add multiple tasks to one column (use "Add New Task" button)
4. Scroll within that column
5. Verify other columns don't scroll

### Checkpoints:
- [ ] All 4 columns visible side-by-side (desktop)
- [ ] Each column header is fixed (doesn't scroll)
- [ ] Task lists scroll independently within each column
- [ ] Columns extend to bottom of viewport
- [ ] Drag-and-drop still works between columns

---

## Test 3: Event Feed Scrolling ✅

### Requirements:
- Event feed scrolls within its card
- Feed extends to bottom of viewport
- Card doesn't overflow parent

### Steps:
1. Look at right sidebar (Live Feed)
2. Verify events are scrollable
3. Scroll to bottom of event list
4. Verify "Realtime" badge and refresh button visible

### Checkpoints:
- [ ] Event feed card fills right sidebar
- [ ] Header ("Live Feed") is fixed
- [ ] Events scroll within card
- [ ] Realtime badge and refresh button always visible
- [ ] Events don't overflow outside card

---

## Test 4: Real-Time Event Streaming 🔴 CRITICAL

### Requirements:
- New events appear within 10 seconds
- Events stream without manual refresh
- Console logs confirm WebSocket delivery

### Steps:
1. Open browser console (F12)
2. Watch for console logs with `[WebSocket]` and `[State]` prefixes
3. Run test script: `./test-realtime.sh`
4. Wait up to 10 seconds
5. Verify new event appears at top of feed

### Checkpoints:
- [ ] Console shows: `[WebSocket] Received event.new:`
- [ ] Console shows: `[State] Event count after merge:`
- [ ] New event appears in feed within 10 seconds
- [ ] Event has correct timestamp
- [ ] Event has agent avatar and name

### Debugging if fails:
```bash
# Check backend logs
cd ~/code/mission-control
pm2 logs server --lines 50 | grep -E "\[Watcher\]|\[SessionMonitor\]"

# Check watcher is running
ps aux | grep watch-sessions | grep -v grep

# Manually trigger event
curl -X POST http://localhost:3002/api/admin/session-sync \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "REDACTED_SECRET",
    "sessions": [{
      "key": "manual-test-'$(date +%s)'",
      "updatedAt": '$(date +%s000)',
      "messages": [{"test": true}],
      "agent": "test"
    }]
  }'

# Should respond with: {"success":true,"eventsGenerated":2,...}
```

### Expected Console Output:
```
[WebSocket] Received event.new: {event: {id: "...", type: "session_start", ...}}
[State] Event count after merge: 15
```

---

## Test 5: Event Animation ✅

### Requirements:
- New events slide in from top with fade
- Animation is smooth (300ms duration)
- Only the newest event animates

### Steps:
1. Trigger a new event (use test script or manual curl)
2. Watch the event feed
3. Verify the new event animates in at the top

### Checkpoints:
- [ ] New event slides down from top edge
- [ ] Event fades in (opacity 0 → 1)
- [ ] Animation is smooth, not jarring
- [ ] Animation duration feels appropriate (~300ms)
- [ ] Only the first (newest) event has animation
- [ ] Older events are static

### CSS Classes to Verify:
- New events should have: `animate-in slide-in-from-top-2 fade-in duration-300`
- Inspect first event in list, check classes in devtools

---

## Test 6: Responsive Layout (Bonus)

### Requirements:
- Layout adapts to tablet viewport
- All content remains accessible

### Steps:
1. Resize browser to 768x1024 (tablet)
2. Verify layout doesn't break
3. Check all sections are still usable

### Checkpoints:
- [ ] Content doesn't overflow
- [ ] Cards remain readable
- [ ] Touch targets are accessible
- [ ] No horizontal scroll

---

## Test 7: Backend Logging Verification

### Requirements:
- Watcher logs session changes
- SessionMonitor logs event generation
- Events are broadcast to connected clients

### Steps:
1. SSH into server or check logs
2. Create a test session file
3. Watch logs for detection and broadcasting

### Expected Log Output:
```
[Watcher] Scanning 5 session files in /home/node/.openclaw/workspace-coder
[Watcher] Detected change: test-session-123.jsonl (2026-02-17T02:34:00.000Z)
[Watcher] Added session: test-session-123 (agent: test, 2 messages)
[Watcher] Pushing 1 updated sessions to backend
[SessionMonitor] Processing 1 sessions
[SessionMonitor] Generated 2 events
[SessionMonitor] Broadcasting event: session_start - "Test started a session" to 1 client(s)
[SessionMonitor] Completed processing. Cache size: 1
```

### Checkpoints:
- [ ] Watcher detects file changes
- [ ] Watcher successfully POSTs to backend
- [ ] SessionMonitor processes sessions
- [ ] SessionMonitor generates events
- [ ] Events are broadcast to connected clients
- [ ] Client count > 0 (you're connected)

---

## Performance Checks

### Memory & CPU:
- [ ] No memory leaks (check browser task manager)
- [ ] CPU usage reasonable (<10% idle)
- [ ] No console errors
- [ ] WebSocket stays connected

### Interaction:
- [ ] Drag-and-drop is responsive
- [ ] Clicking tasks opens modal quickly
- [ ] Scrolling is smooth in all containers
- [ ] No visual glitches or layout shifts

---

## Known Issues / Notes

_Use this section to document any issues found:_

1. Issue: _____________________
   Impact: ____________________
   Workaround: ________________

2. Issue: _____________________
   Impact: ____________________
   Workaround: ________________

---

## Sign-Off

All critical tests passing (Tests 1-5):
- [ ] YES - ready for production
- [ ] NO - see issues above

**Tester Signature:** _____________  
**Date:** _____________  
**Time:** _____________  

---

## Quick Test Commands

```bash
# Start backend (if not running)
cd ~/code/mission-control
npm run server:dev

# Start watcher (if not running)
node scripts/watch-sessions.js

# Trigger test event
./test-realtime.sh

# Check logs
tail -f /proc/$(pgrep -f "node server/index.js")/fd/1

# Clean up test files
rm /home/node/.openclaw/workspace-coder/test-session-*.jsonl
```

---

## Automated Test Commands (Future)

```bash
# Install Playwright (when working)
npm install -D @playwright/test
npx playwright install

# Run tests
npx playwright test tests/viewport.spec.ts

# Run in UI mode
npx playwright test --ui
```
