# CRITICAL: Mission Control Scroll & Real-Time Fixes

## Current State (Broken - Screenshot Evidence)

### 🔴 Issue 1: Event Feed Scroll BROKEN
**Problem:** Event feed shows ~8 events but more exist. No scrollbar, content is cutoff.
**Root Cause:** Parent container not constraining height, ScrollArea not working
**Expected:** Should scroll within its card, max height = viewport minus header/padding

### 🔴 Issue 2: Kanban Columns Cutoff
**Problem:** Backlog column shows 3 tasks, more exist (12 total). No scroll, cutoff.
**Root Cause:** Column div not constrained, overflow not enabled
**Expected:** Each column independently scrollable, fits viewport height

### 🔴 Issue 3: Parent Containers Run Off Page
**Problem:** Entire grid runs beyond viewport bottom
**Root Cause:** Main grid not using flex-1 properly, no height constraints
**Expected:** All 3 columns (sidebar, board, feed) fit viewport with proper flexbox

### 🔴 Issue 4: Status Legend Cutoff
**Problem:** Status Legend partially visible at bottom left, cutoff
**Root Cause:** Left sidebar not properly splitting space between agent list + legend
**Expected:** Both agent list and status legend visible, agent list scrolls if needed

### 🔴 Issue 5: Real-Time Events Not Updating
**Problem:** WebSocket fires "ok" but no new events appear in UI
**Root Cause:** State not updating or event deduplication broken
**Expected:** New events appear within 10 seconds, slide in at top

### 🔴 Issue 6: Refresh Button Does Nothing
**Problem:** Click refresh → network request → no UI update
**Root Cause:** API call works but state update fails
**Expected:** Click → fetch latest → events update immediately

## Required Architecture

### HTML Structure (EXACT hierarchy needed):

```html
<div class="flex h-screen flex-col">  <!-- Root: fill viewport -->
  
  <header class="flex-shrink-0">     <!-- Header: fixed height -->
    <!-- stats, connection, etc -->
  </header>
  
  <main class="flex-1 overflow-hidden"> <!-- Main: fills remaining space -->
    <div class="grid h-full gap-6 px-6 py-6 lg:grid-cols-[240px_1fr_360px]">
      
      <!-- LEFT SIDEBAR: 240px fixed width -->
      <aside class="flex h-full flex-col gap-6">
        
        <!-- Agent Filters Card: flex-1 (takes available space) -->
        <div class="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <div class="flex-shrink-0 p-6"> <!-- Header: fixed -->
            <p>Agent Filters</p>
            <Tabs />
          </div>
          
          <!-- Agent List: scrollable area -->
          <div class="flex-1 overflow-y-auto px-6 pb-6">
            <div class="space-y-2">
              {agents.map(...)}
            </div>
          </div>
        </div>
        
        <!-- Status Legend Card: flex-shrink-0 (fixed size) -->
        <div class="flex-shrink-0 rounded-xl border bg-card p-6">
          <p>Status Legend</p>
          <div class="space-y-2">
            <!-- legend items -->
          </div>
        </div>
        
      </aside>
      
      <!-- CENTER BOARD: 1fr (fills remaining) -->
      <section class="flex h-full flex-col">
        
        <!-- Board Header: fixed -->
        <div class="flex-shrink-0 mb-4">
          <h2>Live Task Pipeline</h2>
          <button>Add New Task</button>
        </div>
        
        <!-- Columns Grid: fills remaining space -->
        <div class="grid flex-1 gap-4 overflow-hidden lg:grid-cols-4">
          
          <!-- Each Column: independent scroll -->
          {columns.map((column) => (
            <div class="flex flex-col overflow-hidden rounded-xl border bg-card/40 p-3">
              
              <!-- Column Header: fixed -->
              <div class="flex-shrink-0 mb-3">
                <span>BACKLOG</span>
                <select>Sort</select>
              </div>
              
              <!-- Task List: scrollable -->
              <div class="flex-1 overflow-y-auto">
                <div class="space-y-3">
                  {tasks.map(...)}
                </div>
              </div>
              
            </div>
          ))}
          
        </div>
      </section>
      
      <!-- RIGHT FEED: 360px fixed width -->
      <aside class="flex h-full flex-col">
        
        <div class="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          <!-- Header: fixed -->
          <div class="flex-shrink-0 p-6">
            <h3>Agent Events</h3>
            <button>Refresh</button>
          </div>
          
          <!-- Separator: fixed -->
          <div class="flex-shrink-0 h-px bg-border"></div>
          
          <!-- Event List: scrollable -->
          <div class="flex-1 overflow-y-auto p-4">
            <div class="space-y-4">
              {events.map(...)}
            </div>
          </div>
        </div>
        
      </aside>
      
    </div>
  </main>
  
</div>
```

### Key Principles:

1. **Root container:** `h-screen flex flex-col` (fills viewport, column direction)
2. **Header:** `flex-shrink-0` (don't shrink)
3. **Main:** `flex-1 overflow-hidden` (fills remaining, clips overflow)
4. **Grid:** `h-full` (fills main's height)
5. **Each column:** `h-full flex flex-col` (fills grid cell, column layout)
6. **Scrollable areas:** `flex-1 overflow-y-auto` (fills available space, scrolls)
7. **Fixed elements:** `flex-shrink-0` (headers, buttons, separators)

## Critical Fixes Required

### Fix 1: Event Feed Scroll

**Current (BROKEN):**
```tsx
<CardContent className="flex-1 overflow-hidden p-4">
  <ScrollArea ref={eventRef} className="h-full pr-2">
    <div className="space-y-4">
      {events.map(...)}
    </div>
  </ScrollArea>
</CardContent>
```

**Problem:** ScrollArea with `h-full` inside `overflow-hidden` doesn't work properly.

**Fix:**
```tsx
<CardContent className="flex-1 overflow-y-auto p-4">
  <div className="space-y-4">
    {events.map((event) => (
      <div key={event.id} className="...">
        {/* event content */}
      </div>
    ))}
  </div>
</CardContent>
```

**Why it works:**
- `flex-1` makes CardContent fill available space
- `overflow-y-auto` enables scrolling
- Native scrolling is more reliable than ScrollArea component

### Fix 2: Kanban Column Scroll

**Current (BROKEN):**
```tsx
<div className="flex flex-1 flex-col gap-3">
  {filteredTasks.map(...)}
</div>
```

**Problem:** No overflow property, no height constraint.

**Fix:**
```tsx
<div className="flex flex-col overflow-hidden">
  <div className="flex-shrink-0 mb-3">
    {/* column header */}
  </div>
  <div className="flex-1 overflow-y-auto">
    <div className="space-y-3">
      {filteredTasks.map(...)}
    </div>
  </div>
</div>
```

### Fix 3: Left Sidebar Layout

**Current (BROKEN):**
```tsx
<aside className="space-y-6">
  <Card>Agent Filters</Card>
  <Card>Status Legend</Card>
</aside>
```

**Problem:** No height constraints, cards grow infinitely.

**Fix:**
```tsx
<aside className="flex h-full flex-col gap-6">
  {/* Agent Filters: takes remaining space, scrolls */}
  <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
    <div className="flex-shrink-0 p-6">
      {/* header */}
    </div>
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      {/* agent list */}
    </div>
  </div>
  
  {/* Status Legend: fixed size */}
  <div className="flex-shrink-0 rounded-xl border bg-card p-6">
    {/* legend */}
  </div>
</aside>
```

### Fix 4: Real-Time Event Updates

**Problem:** Events broadcast but don't appear in UI

**Debug Steps:**
1. Add console.log in WebSocket handler
2. Check if `mergeEvents` is actually called
3. Verify state setter is called
4. Check if React re-renders

**Current Code:**
```tsx
socket.on("event.new", (payload: EventPayload) => {
  setEvents((prev) => mergeEvents(prev, [payload.event]));
});
```

**Enhanced with Logging:**
```tsx
socket.on("event.new", (payload: EventPayload) => {
  console.log('[WebSocket] Received event:', payload);
  console.log('[WebSocket] Current event count:', events.length);
  
  setEvents((prev) => {
    console.log('[State] Prev events:', prev.length);
    const updated = mergeEvents(prev, [payload.event]);
    console.log('[State] Updated events:', updated.length);
    return updated;
  });
});
```

**Possible Issues:**
- `mergeEvents` returning same reference (React won't re-render)
- Event deduplication too aggressive
- State update batching issues

**Fix (Force New Array):**
```tsx
const mergeEvents = (items: EventItem[], incoming: EventItem[]) => {
  const merged = new Map<string, EventItem>();
  items.forEach((event) => merged.set(event.id, event));
  incoming.forEach((event) => merged.set(event.id, event));
  
  // Always return new array (don't use Array.from which might return same ref)
  const result = [];
  for (const event of merged.values()) {
    result.push(event);
  }
  result.sort((a, b) => b.timestamp - a.timestamp);
  return result;
};
```

### Fix 5: Refresh Button

**Current (BROKEN):**
```tsx
onClick={async () => {
  try {
    const eventsResponse = await getEvents();
    setEvents(eventsResponse.events);
  } catch (err) {
    console.error('Failed to refresh events:', err);
  }
}}
```

**Problem:** Might be using wrong state setter or merging incorrectly.

**Fix:**
```tsx
onClick={async () => {
  try {
    console.log('[Refresh] Fetching events...');
    const eventsResponse = await getEvents();
    console.log('[Refresh] Received:', eventsResponse.events.length, 'events');
    
    // Force complete replacement (don't merge)
    setEvents([...eventsResponse.events]);
    console.log('[Refresh] State updated');
  } catch (err) {
    console.error('[Refresh] Error:', err);
  }
}}
```

## Testing Requirements (MANDATORY)

### Automated Tests (Playwright)

```typescript
// tests/scroll.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mission Control Scrolling', () => {
  
  test('Event feed scrolls properly', async ({ page }) => {
    await page.goto('http://localhost:9000/mission_control/');
    await page.waitForSelector('[data-testid="event-feed"]');
    
    const feed = page.locator('[data-testid="event-feed"]');
    
    // Should have scrollable overflow
    const overflowY = await feed.evaluate(el => 
      window.getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');
    
    // Should be able to scroll
    const scrollHeight = await feed.evaluate(el => el.scrollHeight);
    const clientHeight = await feed.evaluate(el => el.clientHeight);
    
    if (scrollHeight > clientHeight) {
      // Has overflow, test scrolling
      await feed.evaluate(el => el.scrollTop = 100);
      const scrollTop = await feed.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }
  });
  
  test('Kanban columns scroll independently', async ({ page }) => {
    await page.goto('http://localhost:9000/mission_control/');
    
    const backlogColumn = page.locator('[data-testid="column-backlog"]');
    const backlogList = backlogColumn.locator('[data-testid="task-list"]');
    
    // Should have overflow
    const overflowY = await backlogList.evaluate(el => 
      window.getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');
    
    // Test scrolling
    const scrollHeight = await backlogList.evaluate(el => el.scrollHeight);
    const clientHeight = await backlogList.evaluate(el => el.clientHeight);
    
    if (scrollHeight > clientHeight) {
      await backlogList.evaluate(el => el.scrollTop = 50);
      const scrollTop = await backlogList.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }
  });
  
  test('All content fits viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:9000/mission_control/');
    
    // No horizontal scroll
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(windowWidth);
    
    // Main container fits viewport
    const main = page.locator('main');
    const mainBox = await main.boundingBox();
    expect(mainBox!.y + mainBox!.height).toBeLessThanOrEqual(1080);
  });
  
  test('Status legend visible', async ({ page }) => {
    await page.goto('http://localhost:9000/mission_control/');
    
    const legend = page.locator('text=Status Legend');
    await expect(legend).toBeVisible();
    
    const legendBox = await legend.boundingBox();
    const viewport = page.viewportSize()!;
    
    // Should be within viewport
    expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(viewport.height);
  });
  
  test('Real-time events appear', async ({ page }) => {
    await page.goto('http://localhost:9000/mission_control/');
    
    // Count initial events
    const initialCount = await page.locator('[data-testid="event-item"]').count();
    console.log('Initial event count:', initialCount);
    
    // Trigger backend to generate event
    await page.evaluate(() => {
      return fetch('http://localhost:3002/api/admin/session-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: [{
            key: `playwright-test-${Date.now()}`,
            updatedAt: Date.now(),
            messages: [],
            agent: 'test'
          }],
          secret: 'REDACTED_SECRET'
        })
      });
    });
    
    // Wait max 10 seconds for new event
    await page.waitForTimeout(2000); // Give it 2 seconds
    
    const newCount = await page.locator('[data-testid="event-item"]').count();
    console.log('New event count:', newCount);
    
    expect(newCount).toBeGreaterThan(initialCount);
  });
  
  test('Refresh button works', async ({ page }) => {
    await page.goto('http://localhost:9000/mission_control/');
    
    const initialCount = await page.locator('[data-testid="event-item"]').count();
    
    // Click refresh
    await page.locator('[data-testid="refresh-button"]').click();
    await page.waitForTimeout(1000);
    
    const newCount = await page.locator('[data-testid="event-item"]').count();
    
    // Count should be >= initial (might have new events)
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });
  
});
```

### Manual Testing Checklist

**Before marking complete, verify ALL of these:**

- [ ] Open Mission Control in 1920x1080 viewport
- [ ] Event feed shows scrollbar when >8 events
- [ ] Can scroll event feed smoothly with mouse wheel
- [ ] Backlog column shows scrollbar when >6 tasks
- [ ] Can scroll backlog column independently
- [ ] In Progress column scrolls independently
- [ ] Agent list shows scrollbar when >10 agents
- [ ] Status legend fully visible at bottom left
- [ ] No content cutoff anywhere
- [ ] No horizontal scrollbar on page
- [ ] Click refresh button → events update immediately
- [ ] WebSocket event arrives → appears in feed <10 sec
- [ ] Resize window to 1280x720 → still works
- [ ] All 3 columns fit viewport at all times

## Implementation Checklist

- [ ] Replace ALL ScrollArea components with native `overflow-y-auto`
- [ ] Add `data-testid` attributes to all testable elements
- [ ] Fix root container to `h-screen flex flex-col`
- [ ] Fix main to `flex-1 overflow-hidden`
- [ ] Fix left sidebar to `flex h-full flex-col gap-6`
- [ ] Fix agent card to `flex-1` with `overflow-y-auto` on list
- [ ] Fix status legend to `flex-shrink-0`
- [ ] Fix board section to `flex h-full flex-col`
- [ ] Fix column grid to `flex-1 overflow-hidden`
- [ ] Fix each column to have `overflow-y-auto` on task list
- [ ] Fix event feed card content to `flex-1 overflow-y-auto`
- [ ] Add comprehensive logging to WebSocket handler
- [ ] Fix `mergeEvents` to always return new array
- [ ] Fix refresh button to force state update
- [ ] Install Playwright: `npm install -D @playwright/test`
- [ ] Write all Playwright tests
- [ ] Run `npx playwright test`
- [ ] Fix any test failures
- [ ] Run manual testing checklist
- [ ] Confirm all 14 checklist items pass
- [ ] Take screenshots proving it works

## Success Criteria (ALL must pass)

1. ✅ Playwright tests pass (6/6)
2. ✅ Manual checklist complete (14/14)
3. ✅ Event feed scrolls smoothly
4. ✅ Kanban columns scroll independently
5. ✅ Status legend fully visible
6. ✅ All content fits viewport
7. ✅ Real-time events appear <10 sec
8. ✅ Refresh button works immediately
9. ✅ No console errors
10. ✅ Screenshots provided as proof

## Notes

- **Remove ALL ScrollArea components** - they're broken, use native scrolling
- **Test with 20+ events** to verify scroll works
- **Test with 15+ tasks per column** to verify scroll works
- **Don't use max-height** - use flex-1 instead
- **Always return new arrays** from state setters (React needs new reference)
- **Add data-testid everywhere** for testing
- **Run tests MULTIPLE times** to ensure consistency
- **Take screenshots** of passing tests

## CRITICAL: Don't Return Until Complete

Run the tests. If they fail, fix and run again. Repeat until ALL tests pass. Only then mark the task complete and provide proof (screenshots + test output).
