# Mission Control — Real-Time Improvements Spec

## Overview
Fix UI issues and implement true real-time agent activity monitoring.

## Issues to Fix

### 1. Live Feed Scroll (UI Bug)
**Problem:** Event feed is cut off vertically, doesn't scroll to show all events.

**Fix:**
- Update `src/App.tsx` or event feed component CSS
- Ensure ScrollArea has proper height constraints
- Should scroll to show all events with proper overflow handling

### 2. Agent Data Issues
**Problem:**
- "Health" agent should be "Vitals"
- Patch appears twice in the agent list

**Fix:**
- Update `server/openclaw.js` fallback agent list:
  - Change `{ id: 'agent-health-tracking', name: 'Health', role: 'Ops' }` to `{ id: 'agent-health-tracking', name: 'Vitals', role: 'Ops' }`
  - Remove duplicate Patch entry if present
- Ensure deduplication logic in seed script

### 3. Real-Time Event Streaming
**Problem:** Events are stale (all same timestamp from 3 hours ago), no new events coming in.

**Current:** Events are only seeded once at startup.

**Required:** Live event stream showing:
- Agent heartbeats
- Cron job executions
- Tool calls (exec, read, write, etc.)
- Incoming user messages
- Outgoing agent messages
- Session spawns/completions
- Any agent activity

**Implementation Options:**

**Option A: OpenClaw Gateway Event Stream (Preferred)**
- Add new backend endpoint: `GET /api/events/stream` (SSE)
- Poll OpenClaw Gateway logs or session activity
- Stream events to frontend via WebSocket
- Frontend displays events in real-time

**Option B: Session Polling**
- Poll `sessions_list` API periodically (every 5-10s)
- Track last activity timestamps per session
- Generate events for new activity
- Less real-time but simpler to implement

**Option C: Log Tailing**
- Tail OpenClaw agent logs (if accessible)
- Parse log entries into events
- Stream to frontend

**Recommendation:** Start with Option B (session polling) for MVP, then upgrade to Option A if Gateway provides event stream API.

### 4. Task Management — Real Work Tracking
**Problem:** Kanban is empty. Should show actual agent work and user todos.

**Required:**
- Populate backlog with user's todo list (tagged with user)
- Auto-create tasks for agent work (e.g., "Mission Control Development" assigned to Patch, status "in-progress")
- Agents should be able to create/update their own tasks via API

**Implementation:**
1. **Seed with current work:**
   - Create task: "Mission Control Development" (assigned to Patch, status: in-progress, priority: high)
   - Create task: "File Explorer Modernization" (assigned to Patch, status: blocked, note: "Rate limited, awaiting retry")

2. **Agent self-reporting:**
   - Add backend endpoint: `POST /api/tasks/agent-report` (authenticated)
   - Agents can report their current work via API
   - Patch can call this when starting new work

3. **User todo integration (future):**
   - Read user's todo list from memory or external source
   - Create tasks tagged with user
   - Sync periodically

### 5. Event Types to Track
Add these event types to the database schema and event generation:

```typescript
type EventType = 
  | 'agent_checkin'      // Heartbeat
  | 'agent_message'      // Outgoing message
  | 'user_message'       // Incoming request
  | 'tool_call'          // exec, read, write, etc.
  | 'cron_run'           // Scheduled job execution
  | 'session_spawn'      // Subagent spawned
  | 'session_complete'   // Subagent completed
  | 'task_created'       // New task
  | 'task_updated'       // Task status change
  | 'system_seed'        // System event
```

## Implementation Plan

### Phase 1: Fix UI and Data (Quick Wins)
- [ ] Fix live feed scroll CSS
- [ ] Fix agent data (Health → Vitals, dedupe Patch)
- [ ] Seed with real tasks (Mission Control in-progress)

### Phase 2: Real-Time Events (Core Feature)
- [ ] Implement session polling backend service
- [ ] Add event generation from session activity
- [ ] Stream events to frontend via WebSocket
- [ ] Update frontend to display real-time events

### Phase 3: Agent Task Management (Enhancement)
- [ ] Add agent self-reporting API
- [ ] Update Patch to report work status
- [ ] Auto-create tasks for agent work

## Testing
1. Live feed should scroll and show all events
2. New events should appear in real-time (within 10s)
3. Agent list should show correct names (Vitals, not Health)
4. Patch should appear only once
5. Tasks should reflect actual work (Mission Control in progress)

## Notes
- Focus on Phase 1 first (quick wins)
- Phase 2 is the core improvement (real-time events)
- Phase 3 can be deferred to later iteration
