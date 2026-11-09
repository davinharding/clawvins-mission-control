# Mission Control - Diagnostic & Fix

## Issues to Fix

### 1. WebSocket Connection Stuck on "Reconnecting"
**Symptom:** Connection status in top-left shows "Reconnecting..." and never connects.

**Diagnosis:**
- Check if WebSocket server is initialized correctly in `server/socket.js`
- Verify Socket.io client connection in `src/lib/socket.ts`
- Check if backend is emitting connection events
- Verify CORS and port configuration

**Fix:**
- Debug Socket.io connection in both client and server
- Ensure WebSocket is properly attached to HTTP server
- Test connection with browser console
- Fix any CORS or connection issues

### 2. New Task Modal Doesn't Pop on Initial Click
**Symptom:** Clicking "Add Task" button doesn't open the modal immediately.

**Diagnosis:**
- Check if modal state is initialized properly in `src/App.tsx`
- Verify button click handler
- Check if there's a race condition or state issue
- Look for any console errors

**Fix:**
- Ensure modal state is properly initialized
- Fix click handler to immediately show modal
- Test that modal appears on first click

### 3. Agent Feed Has No Events
**Symptom:** Live event feed is empty, no agent activity is shown.

**Diagnosis:**
- Check if events are being created in the database
- Verify `GET /api/events` endpoint returns events
- Check if frontend is fetching events correctly
- Verify WebSocket is broadcasting new events

**Fix:**
- Ensure seed creates initial events
- Create real events when tasks are created/updated/completed
- Verify frontend displays events from API
- Test real-time event updates via WebSocket

### 4. Tasks Appear to Be Fake Data
**Symptom:** Tasks on board are seed data, not real tasks created by agents.

**Diagnosis:**
- Check what tasks exist in database
- Verify seed data vs real tasks
- Check if tasks are properly linked to real agents

**Fix:**
- Clear fake seed tasks or mark them clearly
- Ensure new tasks created via API are real
- Link tasks to actual agents (not fake agent IDs)
- Test creating/editing/deleting tasks

## Implementation Plan

### Phase 1: WebSocket Connection (Priority 1)
1. Debug Socket.io server initialization
2. Check HTTP server setup in `server/index.js`
3. Verify Socket.io client connection
4. Test connection status updates
5. Fix any CORS or port issues

### Phase 2: Modal Fix (Priority 2)
1. Check modal state initialization in App.tsx
2. Fix button click handler
3. Test immediate modal popup
4. Ensure modal can be closed and reopened

### Phase 3: Event Feed (Priority 3)
1. Create initial events in seed
2. Add event creation when tasks change
3. Verify events API returns data
4. Test WebSocket event broadcasting
5. Verify frontend displays events

### Phase 4: Real Task Data (Priority 4)
1. Review current seed tasks
2. Remove or mark fake tasks
3. Ensure task CRUD operations work
4. Test with real agent assignments

## Testing Checklist

After fixes:
- [ ] WebSocket shows "Connected" in green
- [ ] Clicking "Add Task" opens modal immediately
- [ ] Event feed shows at least seed events
- [ ] New task creation adds event to feed
- [ ] Tasks can be moved between columns
- [ ] Task edit modal works
- [ ] Real agents are assigned to tasks
- [ ] No fake/dummy data visible

## Key Files to Check

**WebSocket:**
- `server/index.js` - HTTP server + Socket.io setup
- `server/socket.js` - Socket.io event handlers
- `src/lib/socket.ts` - Client Socket.io connection
- `src/components/ConnectionStatus.tsx` - Status display

**Modal:**
- `src/App.tsx` - Modal state and handlers
- `src/components/TaskEditModal.tsx` - Modal component

**Events:**
- `server/routes/events.js` - Events API
- `server/seed.js` - Seed events
- `server/socket.js` - Event broadcasting
- `src/App.tsx` - Event fetching and display

**Tasks:**
- `server/routes/tasks.js` - Task CRUD
- `server/seed.js` - Seed tasks
- `src/App.tsx` - Task management

## Notes

- Frontend URL: http://localhost:9000/mission_control
- Backend API: http://localhost:3002
- WebSocket: ws://localhost:3002 (Socket.io)
- Database: ~/code/mission-control/data/mission-control.db

## Working Directory
`/home/node/code/mission-control`
