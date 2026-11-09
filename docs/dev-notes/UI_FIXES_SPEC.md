# Mission Control UI Fixes - Phase 2

## Context
Mission Control is a real-time Kanban board for agent orchestration. Several UI/UX issues need fixing.

## Current State
- Frontend: Vite + React + TypeScript at `/home/node/code/mission-control/src`
- Backend: Express + Socket.io at `/home/node/code/mission-control/server`
- Event watcher: Pure Node.js script at `/home/node/code/mission-control/scripts/watch-sessions.js`
- Database: SQLite at `/home/node/code/mission-control/data/mission-control.db`

## Issues to Fix

### 1. Refresh Button Not Working ❌
**Location:** Event feed refresh button (↻) in `src/App.tsx`

**Problem:** 
- Button sends network request (visible in network tab)
- But events don't update in UI
- Likely state update issue

**Expected behavior:**
- Click refresh button → fetch latest events → update event list immediately

**Files to check:**
- `src/App.tsx` - refresh button onClick handler
- `src/lib/api.ts` - getEvents function
- State management around `events` array

### 2. Add Sort Options for Each Column 🔽
**Location:** Kanban board columns in `src/App.tsx`

**Requirements:**
- Each column (Backlog, In Progress, Review, Done) needs a sort dropdown
- At minimum: Sort by Priority (High → Low, Low → High)
- Nice to have: Sort by Created Date, Updated Date
- Sort should be per-column, not global
- Default: Priority (High → Low)

**UI Design:**
- Small dropdown in column header, next to task count
- Use existing UI components (shadcn/ui Select)
- Persist sort choice in component state (no need for backend)

**Implementation:**
- Add sort state for each column (4 separate states or single object)
- Filter tasks by column as usual
- Apply sort before rendering
- Priority order: high > medium > low

### 3. Responsive Design Improvements 📱
**Current issues:**
- Three-column grid (`lg:grid-cols-[260px_1fr_320px]`) breaks on smaller screens
- Agent sidebar too wide on tablets
- Event feed too narrow on desktop
- Kanban board columns not responsive

**Target breakpoints:**
- Mobile (<640px): Single column, stack everything
- Tablet (640-1024px): Two columns (hide agent filters, show event feed)
- Desktop (>1024px): Current three-column layout but better proportions

**Suggested grid changes:**
- Mobile: `grid-cols-1` - stack sidebar, board, feed
- Tablet: `md:grid-cols-[1fr_300px]` - board + feed, hide agent sidebar
- Desktop: `lg:grid-cols-[240px_1fr_360px]` - more space for board/feed

**Kanban columns:**
- Mobile: Single column, collapsible
- Tablet: 2x2 grid
- Desktop: 1x4 row (current)

### 4. Fix Item Padding/Spacing 🎨
**Current issues (from screenshot):**
- Task cards have inconsistent padding
- Too much vertical space between task title and metadata
- Avatar/assignee spacing looks cramped
- Priority badges too close to card edges

**Target fixes:**
- Task card: `p-4` instead of `p-3`
- Title and description: `space-y-2` for better breathing room
- Avatar + name row: `gap-3` instead of `gap-2`
- Priority badge: Add proper margin/padding
- Time stamp: Better alignment

**Files to update:**
- `src/App.tsx` - task card rendering (in column mapping)
- Possibly create a separate `TaskCard` component for cleaner code

### 5. Real-Time Event Streaming Broken 🔴
**Problem:**
- Events not streaming in despite watcher running
- WebSocket connection working (see "Client connected" in logs)
- Backend emits events but frontend doesn't receive

**Debug steps:**
1. Check browser console for WebSocket errors
2. Verify `socket.on('event.new')` listener in `src/App.tsx`
3. Check if `addEvent` function is called when new events arrive
4. Verify backend is actually emitting events (add logging)

**Likely causes:**
- Event listener not attached properly
- Event payload structure mismatch
- State update not triggering re-render
- WebSocket reconnection issue

**Expected flow:**
1. Watcher detects session change → POST to `/api/admin/session-sync`
2. Backend `SessionMonitor.processSessions()` → creates events
3. Backend emits `io.emit('event.new', { event })` 
4. Frontend `socket.on('event.new', ...)` → `addEvent(event)`
5. UI updates immediately

**Files to check:**
- `server/session-monitor.js` - verify emit is called
- `src/App.tsx` - verify socket listener is attached
- `src/lib/socket.ts` - check socket setup

## Implementation Plan

### Phase 1: Debug & Quick Fixes (30 min)
1. Fix refresh button (likely simple state issue)
2. Fix real-time streaming (debug WebSocket flow)
3. Fix padding/spacing (CSS updates)

### Phase 2: Feature Adds (1 hour)
4. Add sort dropdowns to columns
5. Improve responsive layout

## Testing Checklist
- [ ] Refresh button updates event feed immediately
- [ ] Sort by priority works in all 4 columns
- [ ] Layout responsive on mobile (< 640px)
- [ ] Layout responsive on tablet (640-1024px)
- [ ] Desktop layout improved (> 1024px)
- [ ] Task cards have better spacing/padding
- [ ] New events stream in real-time without refresh
- [ ] WebSocket connection stable
- [ ] No console errors

## Files to Modify
- `src/App.tsx` - main component (refresh, sort, layout, padding)
- `server/session-monitor.js` - verify event emission (add logging)
- `src/lib/socket.ts` - verify socket setup
- Possibly create `src/components/TaskCard.tsx` for cleaner code
- Possibly create `src/components/ColumnSort.tsx` for sort dropdown

## Success Criteria
1. ✅ Refresh button works instantly
2. ✅ Can sort tasks by priority in each column
3. ✅ Layout works well on mobile, tablet, desktop
4. ✅ Task cards look polished with proper spacing
5. ✅ Events stream in real-time as they happen

## Notes
- Use existing shadcn/ui components (Select, DropdownMenu)
- Keep styling consistent with current design (dark theme, purple accents)
- Don't break existing features (drag-drop, edit modal, comments)
- Test on actual mobile device if possible (or Chrome DevTools)
