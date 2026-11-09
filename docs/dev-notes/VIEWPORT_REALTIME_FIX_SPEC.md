# Mission Control - Viewport & Real-Time Fixes (Critical)

## Context
Mission Control has critical layout and real-time streaming issues that need thorough fixing and testing.

## Current Problems (from screenshot analysis)

### 1. **Agent Sidebar Layout Issues** 🚨
- Agent list overflows parent container
- Status Legend is cut off at bottom (not visible in screenshot)
- Both need to fit in viewport with scrolling

### 2. **Live Feed Not Updating** 🔴
- Events stopped at 8:40 PM (screenshot shows 8:50 PM current time)
- No new events streaming in for 10+ minutes
- Real-time updates completely broken

### 3. **Viewport Height Not Fully Working**
- Columns don't properly fill viewport height
- Overflow scrolling not working inside containers
- Margins/padding causing layout issues

### 4. **Animation Missing**
- No slide/fade-in animation for new events
- Events should animate in at the top smoothly

## Required Fixes (All Must Work)

### Fix 1: Agent Sidebar Layout ✅
**Goal:** Agent list + Status Legend both visible, scrollable if needed

**Requirements:**
- Agent Filters card should have fixed height and internal scrolling
- Agent list should scroll if it exceeds available space
- Status Legend must always be visible below agent list
- Total sidebar height = viewport height minus header minus padding
- Both cards should fit in allocated space

**Implementation:**
```tsx
// Left sidebar structure
<aside className="flex h-full flex-col gap-6">
  <Card className="flex-1 flex flex-col overflow-hidden">
    {/* Agent Filters Header */}
    <CardHeader>...</CardHeader>
    {/* Agent List - scrollable */}
    <CardContent className="flex-1 overflow-y-auto">
      <ScrollArea className="h-full">
        {/* agent buttons */}
      </ScrollArea>
    </CardContent>
  </Card>
  
  {/* Status Legend - always visible, no scroll needed */}
  <Card className="flex-shrink-0">
    <CardHeader>Status Legend</CardHeader>
    <CardContent>
      {/* legend items */}
    </CardContent>
  </Card>
</aside>
```

### Fix 2: Live Feed Scrolling ✅
**Goal:** Event feed scrolls within parent, fills viewport height

**Requirements:**
- Feed card fills remaining height of right column
- Events scroll inside card
- No overflow outside parent
- Card extends to bottom of viewport with padding

**Implementation:**
```tsx
<aside className="flex h-full flex-col">
  <Card className="flex flex-1 flex-col overflow-hidden">
    <CardHeader>...</CardHeader>
    <Separator />
    <CardContent className="flex-1 overflow-hidden p-4">
      <ScrollArea className="h-full pr-2">
        {/* events */}
      </ScrollArea>
    </CardContent>
  </Card>
</aside>
```

### Fix 3: Kanban Board Columns ✅
**Goal:** All 4 columns fit viewport, scroll individually

**Requirements:**
- Board section uses flex-1 to fill available height
- Each column scrolls its task list independently
- Columns don't grow beyond viewport
- Maintains horizontal 4-column layout on desktop

**Implementation:**
```tsx
<section className="flex h-full flex-col">
  {/* Header with Add Task button */}
  <div className="mb-4">...</div>
  
  {/* Columns grid - fills remaining space */}
  <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-4">
    {columns.map((column) => (
      <div className="flex flex-col overflow-hidden">
        {/* Column header */}
        <div className="mb-3">...</div>
        
        {/* Task list - scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {/* tasks */}
          </div>
        </div>
      </div>
    ))}
  </div>
</section>
```

### Fix 4: Real-Time Event Streaming 🔴 CRITICAL
**Goal:** Events stream in real-time without any delays

**Root Cause Analysis Needed:**
1. Check if watcher script is actually running and detecting changes
2. Check if backend is receiving session updates
3. Check if backend is emitting WebSocket events
4. Check if frontend is receiving WebSocket events
5. Check if state updates are triggering re-renders

**Debug Steps:**
1. Add console logging to watcher script:
   ```js
   console.log('[Watcher] Detected changes:', sessions.length);
   ```

2. Add logging to backend SessionMonitor:
   ```js
   console.log('[SessionMonitor] Processing sessions:', sessions.length);
   console.log('[SessionMonitor] Generated events:', events.length);
   console.log('[SessionMonitor] Broadcasting to', this.io.sockets.sockets.size, 'clients');
   ```

3. Add logging to frontend WebSocket listener:
   ```tsx
   socket.on("event.new", (payload) => {
     console.log('[WebSocket] Received event:', payload);
     setEvents((prev) => {
       const updated = mergeEvents(prev, [payload.event]);
       console.log('[State] Event count:', updated.length);
       return updated;
     });
   });
   ```

4. Test by creating a new session:
   ```bash
   # Trigger a new session to generate events
   echo "test" > /home/node/.openclaw/workspace-coder/test-session.jsonl
   ```

**Fixes to Implement:**
- Ensure watcher is monitoring correct directory
- Ensure watcher successfully POSTs to backend
- Ensure backend emits to all connected clients
- Ensure frontend listener is attached before any events arrive
- Ensure `mergeEvents` doesn't break state updates

### Fix 5: Slide/Fade Animation ✅
**Goal:** New events smoothly animate in at the top

**Requirements:**
- Smooth slide-in from top (translate-y)
- Fade in opacity (0 → 1)
- 300-500ms duration
- Only animates the newest event (first in list)

**Implementation:**
```tsx
// Use Framer Motion or Tailwind animate
<div
  key={event.id}
  className={cn(
    "flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 transition-all",
    index === 0 && "animate-in slide-in-from-top-2 fade-in duration-300"
  )}
>
  {/* event content */}
</div>
```

Or with Framer Motion:
```tsx
import { motion } from "framer-motion";

<motion.div
  key={event.id}
  initial={index === 0 ? { opacity: 0, y: -20 } : false}
  animate={index === 0 ? { opacity: 1, y: 0 } : false}
  transition={{ duration: 0.3 }}
  className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4"
>
  {/* event content */}
</motion.div>
```

## Testing Protocol (MANDATORY)

### Automated Browser Testing
Use Playwright or similar to verify:

```javascript
// Test 1: Viewport layout
test('All columns fit viewport height', async ({ page }) => {
  await page.goto('http://localhost:9000/mission_control/');
  
  const viewport = await page.viewportSize();
  const leftSidebar = await page.locator('aside').first().boundingBox();
  const mainBoard = await page.locator('section').boundingBox();
  const rightFeed = await page.locator('aside').last().boundingBox();
  
  // All should fit within viewport height
  expect(leftSidebar.height).toBeLessThanOrEqual(viewport.height);
  expect(mainBoard.height).toBeLessThanOrEqual(viewport.height);
  expect(rightFeed.height).toBeLessThanOrEqual(viewport.height);
});

// Test 2: Agent list scrolls
test('Agent list is scrollable', async ({ page }) => {
  await page.goto('http://localhost:9000/mission_control/');
  
  const agentList = page.locator('[data-testid="agent-list"]');
  const scrollHeight = await agentList.evaluate(el => el.scrollHeight);
  const clientHeight = await agentList.evaluate(el => el.clientHeight);
  
  expect(scrollHeight).toBeGreaterThan(clientHeight); // Has overflow
  
  // Should be able to scroll
  await agentList.evaluate(el => el.scrollTop = 100);
  const scrollTop = await agentList.evaluate(el => el.scrollTop);
  expect(scrollTop).toBe(100);
});

// Test 3: Status legend visible
test('Status legend is visible', async ({ page }) => {
  await page.goto('http://localhost:9000/mission_control/');
  
  const legend = page.locator('text=Status Legend');
  await expect(legend).toBeVisible();
  
  const legendBox = await legend.boundingBox();
  const viewport = await page.viewportSize();
  
  // Should be within viewport
  expect(legendBox.y + legendBox.height).toBeLessThanOrEqual(viewport.height);
});

// Test 4: Real-time events
test('Events stream in real-time', async ({ page }) => {
  await page.goto('http://localhost:9000/mission_control/');
  
  // Count initial events
  const initialCount = await page.locator('[data-testid="event-item"]').count();
  
  // Trigger a new event (simulate session activity)
  await page.evaluate(() => {
    // This should trigger watcher to detect change
    fetch('/api/admin/session-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessions: [{
          key: 'test-session-' + Date.now(),
          updatedAt: Date.now(),
          messages: [],
          agent: 'test'
        }],
        secret: 'REDACTED_SECRET'
      })
    });
  });
  
  // Wait for new event to appear (max 5 seconds)
  await page.waitForSelector('[data-testid="event-item"]', { 
    state: 'attached',
    timeout: 5000 
  });
  
  const newCount = await page.locator('[data-testid="event-item"]').count();
  expect(newCount).toBeGreaterThan(initialCount);
});

// Test 5: Animation on new event
test('New events animate in', async ({ page }) => {
  await page.goto('http://localhost:9000/mission_control/');
  
  const firstEvent = page.locator('[data-testid="event-item"]').first();
  
  // Should have animation class
  const classes = await firstEvent.getAttribute('class');
  expect(classes).toContain('animate-in');
});
```

### Manual Testing Checklist
- [ ] All columns (left sidebar, board, right feed) fit viewport height
- [ ] Agent list scrolls smoothly within its card
- [ ] Status legend is fully visible below agent list
- [ ] Event feed scrolls smoothly within its card
- [ ] Kanban columns scroll independently
- [ ] Create a test session → new event appears within 10 seconds
- [ ] New event slides in from top with fade animation
- [ ] Refresh button still works
- [ ] Sort dropdowns still work
- [ ] No console errors
- [ ] Layout responsive on tablet/mobile

## Implementation Plan

### Phase 1: Layout Fixes (30 min)
1. Fix agent sidebar (agent list + status legend)
2. Fix event feed scrolling
3. Fix kanban column heights
4. Test viewport fit

### Phase 2: Real-Time Debugging (45 min)
5. Add comprehensive logging to watcher, backend, frontend
6. Test event flow end-to-end
7. Fix any broken WebSocket connections
8. Fix any state update issues
9. Verify events appear in <10 seconds

### Phase 3: Animation & Polish (15 min)
10. Add slide/fade-in animation for new events
11. Test animation timing
12. Polish transitions

### Phase 4: Automated Testing (30 min)
13. Write Playwright tests
14. Run full test suite
15. Fix any failures
16. Document passing tests

### Phase 5: Manual Verification (15 min)
17. Go through manual checklist
18. Test on different viewport sizes
19. Confirm all requirements met
20. Get sign-off from user

## Success Criteria

✅ **All must be true:**
1. Agent list + Status Legend both visible in viewport
2. All columns scroll independently within viewport
3. Events stream in real-time (<10 second latency)
4. New events animate smoothly at top
5. No layout overflow or cut-off content
6. All Playwright tests pass
7. Manual testing checklist 100% complete
8. No console errors
9. Works on desktop (1920x1080)
10. Works on tablet (768x1024)

## Files to Modify
- `src/App.tsx` - layout structure, scrolling, animation
- `server/session-monitor.js` - add logging, verify emit
- `scripts/watch-sessions.js` - add logging, verify detection
- Add `src/lib/socket.ts` logging
- Create `tests/viewport.spec.ts` - Playwright tests
- Update `package.json` - add Playwright if needed

## Notes
- Use `data-testid` attributes for testing
- Keep existing drag-drop functionality working
- Don't break existing sort/filter features
- Test with 10+ agents and 20+ events to ensure scrolling works
- Be aggressive with logging - we need to see what's failing

## CRITICAL: Don't Stop Until It Works
- Run the Playwright tests multiple times
- If tests fail, debug and fix
- If real-time events don't appear, keep debugging
- If layout breaks on resize, fix it
- Only mark complete when user confirms it works

This is a high-priority fix. Take the time to do it right.
