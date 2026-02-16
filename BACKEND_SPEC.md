# Mission Control Backend Specification

## Overview
Build a real-time backend API for Mission Control that enables:
- Persistent task storage (SQLite)
- WebSocket real-time updates (Socket.io)
- OpenClaw agent integration (REST API + tool)
- Simple authentication (JWT)

## Tech Stack
- **Runtime:** Node.js (v22+)
- **Framework:** Express
- **Database:** SQLite (better-sqlite3)
- **WebSocket:** Socket.io
- **Auth:** JWT (jsonwebtoken)
- **Validation:** Zod

## Project Structure
```
mission-control/
├── src/              # Frontend (existing Vite app)
├── server/
│   ├── index.js      # Express server + Socket.io setup
│   ├── db.js         # SQLite database setup + queries
│   ├── auth.js       # JWT middleware
│   ├── routes/
│   │   ├── tasks.js      # Task CRUD endpoints
│   │   ├── agents.js     # Agent status endpoints
│   │   ├── events.js     # Event feed endpoints
│   │   └── auth.js       # Authentication endpoints
│   └── socket.js     # Socket.io event handlers
├── data/
│   └── mission-control.db  # SQLite database
└── package.json
```

## Database Schema

### Tables

#### tasks
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('backlog', 'todo', 'in-progress', 'done')),
  assigned_agent TEXT,
  priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  tags TEXT -- JSON array
);
```

#### agents
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Main', 'Dev', 'Research', 'Ops')),
  status TEXT NOT NULL CHECK(status IN ('online', 'offline', 'busy')),
  last_active INTEGER NOT NULL,
  avatar_color TEXT
);
```

#### events
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  agent_id TEXT,
  task_id TEXT,
  timestamp INTEGER NOT NULL
);
```

#### auth_tokens
```sql
CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

## REST API Endpoints

### Authentication

#### POST /api/auth/login
**Request:**
```json
{
  "username": "patch",
  "password": "your-secure-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "agent-patch",
    "name": "Patch",
    "role": "Dev"
  }
}
```

**Notes:**
- For MVP, use hardcoded credentials (env vars)
- JWT expires in 7 days
- Store token in localStorage on frontend

---

### Tasks

#### GET /api/tasks
**Auth:** Required  
**Query params:** 
- `status` (optional): filter by status
- `agent` (optional): filter by assigned agent

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Build rate limiter",
      "description": "Implement Redis-based rate limiting",
      "status": "in-progress",
      "assignedAgent": "agent-patch",
      "priority": "high",
      "createdAt": 1708099200000,
      "updatedAt": 1708099200000,
      "createdBy": "agent-nova",
      "tags": ["backend", "security"]
    }
  ]
}
```

#### POST /api/tasks
**Auth:** Required  
**Request:**
```json
{
  "title": "Build rate limiter",
  "description": "Implement Redis-based rate limiting",
  "status": "backlog",
  "assignedAgent": "agent-patch",
  "priority": "high",
  "tags": ["backend", "security"]
}
```

**Response:**
```json
{
  "task": { /* full task object */ }
}
```

**Side effects:**
- Emit `task.created` WebSocket event
- Create event log entry

#### PATCH /api/tasks/:id
**Auth:** Required  
**Request:**
```json
{
  "status": "done",
  "assignedAgent": "agent-nova"
}
```

**Response:**
```json
{
  "task": { /* updated task object */ }
}
```

**Side effects:**
- Emit `task.updated` WebSocket event
- Create event log entry

#### DELETE /api/tasks/:id
**Auth:** Required  
**Response:**
```json
{
  "success": true
}
```

**Side effects:**
- Emit `task.deleted` WebSocket event
- Create event log entry

---

### Agents

#### GET /api/agents
**Auth:** Required  
**Response:**
```json
{
  "agents": [
    {
      "id": "agent-patch",
      "name": "Patch",
      "role": "Dev",
      "status": "online",
      "lastActive": 1708099200000,
      "avatarColor": "#3b82f6"
    }
  ]
}
```

#### PATCH /api/agents/:id
**Auth:** Required  
**Request:**
```json
{
  "status": "busy"
}
```

**Response:**
```json
{
  "agent": { /* updated agent object */ }
}
```

**Side effects:**
- Emit `agent.status_changed` WebSocket event

---

### Events

#### GET /api/events
**Auth:** Required  
**Query params:**
- `limit` (optional, default 50): max events to return
- `since` (optional): timestamp - only events after this

**Response:**
```json
{
  "events": [
    {
      "id": "evt-1",
      "type": "task_created",
      "message": "Patch created task: Build rate limiter",
      "agentId": "agent-patch",
      "taskId": "task-1",
      "timestamp": 1708099200000
    }
  ]
}
```

---

## WebSocket Events (Socket.io)

### Client → Server

#### `authenticate`
**Payload:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `authenticated` or `auth_error`

---

### Server → Client

#### `task.created`
**Payload:**
```json
{
  "task": { /* full task object */ }
}
```

#### `task.updated`
**Payload:**
```json
{
  "task": { /* updated task object */ }
}
```

#### `task.deleted`
**Payload:**
```json
{
  "taskId": "task-1"
}
```

#### `agent.status_changed`
**Payload:**
```json
{
  "agent": { /* updated agent object */ }
}
```

#### `event.new`
**Payload:**
```json
{
  "event": { /* event object */ }
}
```

---

## OpenClaw Integration

### Approach 1: New OpenClaw Tool (Preferred)
Create a `mission_control` tool that agents can use:

```javascript
// Example usage from an agent:
mission_control({
  action: "create_task",
  title: "Fix auth bug",
  description: "Users can't log in",
  status: "todo",
  assignedAgent: "agent-patch",
  priority: "critical",
  tags: ["bug", "auth"]
})

mission_control({
  action: "update_task",
  taskId: "task-123",
  status: "done"
})

mission_control({
  action: "move_task",
  taskId: "task-123",
  newStatus: "in-progress"
})

mission_control({
  action: "list_tasks",
  status: "todo"
})
```

### Approach 2: Direct API Calls
Agents can use `exec` with `curl` to hit the API:

```bash
curl -X POST http://localhost:3002/api/tasks \
  -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix auth bug","status":"todo","priority":"critical"}'
```

**Decision:** Implement both, but recommend Approach 1 for better UX.

---

## Frontend Changes

### 1. Replace Mock Data
- Remove hardcoded `MOCK_TASKS`, `MOCK_AGENTS`, `MOCK_EVENTS`
- Fetch from API on mount
- Use WebSocket for real-time updates

### 2. Add API Client
Create `src/lib/api.ts`:
```typescript
export async function getTasks() {
  const res = await fetch('/api/tasks', {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return res.json();
}

export async function createTask(task: NewTask) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(task)
  });
  return res.json();
}

// ... similar for update, delete, etc.
```

### 3. Add WebSocket Client
Create `src/lib/socket.ts`:
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3002', {
  auth: { token: getToken() }
});

socket.on('task.created', (data) => {
  // Update local state
});

socket.on('task.updated', (data) => {
  // Update local state
});

// ... handle other events
```

### 4. Update UI Components
- `App.tsx`: Replace mock data with API calls + WebSocket subscriptions
- Add loading states while fetching
- Add error handling for failed API calls

---

## Implementation Steps

### Phase 1: Database + Basic API (Milestone 1)
1. Install dependencies: `express`, `better-sqlite3`, `jsonwebtoken`, `zod`, `cors`
2. Create `server/db.js` with schema + basic queries
3. Create `server/index.js` with Express setup
4. Implement auth middleware (`server/auth.js`)
5. Implement `/api/tasks` CRUD endpoints
6. Implement `/api/agents` endpoints
7. Implement `/api/events` endpoint
8. Implement `/api/auth/login` endpoint
9. Test all endpoints with curl

**Milestone 1 deliverable:** REST API fully functional, tested with curl.

---

### Phase 2: WebSocket Real-time Updates (Milestone 2)
1. Install `socket.io`
2. Create `server/socket.js` with event handlers
3. Integrate Socket.io with Express server
4. Emit events when tasks/agents change
5. Test WebSocket events with a simple HTML client

**Milestone 2 deliverable:** Real-time updates working, tested with basic client.

---

### Phase 3: Frontend Integration (Milestone 3)
1. Install `socket.io-client` in frontend
2. Create `src/lib/api.ts` with API client functions
3. Create `src/lib/socket.ts` with WebSocket client
4. Update `App.tsx` to use real API data instead of mocks
5. Add loading/error states
6. Test full stack: create task in UI, see it in DB and broadcast to other clients

**Milestone 3 deliverable:** Full-stack working - UI connected to backend, real-time updates functional.

---

### Phase 4: OpenClaw Integration (Milestone 4)
1. Create OpenClaw tool definition (if Approach 1)
2. Document API usage for agents (if Approach 2)
3. Add environment variable for `MISSION_CONTROL_TOKEN`
4. Update agent system prompts to include Mission Control usage examples
5. Test: agent creates task via tool/API, see it appear in UI

**Milestone 4 deliverable:** Agents can create/update tasks programmatically.

---

### Phase 5: Polish + Production Ready (Milestone 5)
1. Add input validation (Zod schemas)
2. Add rate limiting (express-rate-limit)
3. Add CORS configuration
4. Add database migrations system
5. Add health check endpoint (`GET /health`)
6. Add graceful shutdown handling
7. Add logging (pino or winston)
8. Update README with setup instructions
9. Create environment variable template (`.env.example`)

**Milestone 5 deliverable:** Production-ready backend with proper error handling, logging, and security.

---

## Environment Variables

```bash
# .env
PORT=3002
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-in-production
ADMIN_USERNAME=patch
ADMIN_PASSWORD=REDACTED
DATABASE_PATH=./data/mission-control.db
FRONTEND_URL=http://localhost:9000
```

---

## Running the Backend

### Development
```bash
cd mission-control
npm run server:dev  # nodemon server/index.js
```

### Production
```bash
npm run server:start  # node server/index.js
```

Backend runs on port 3002 by default.

---

## Serving Frontend + Backend Together

The file server (port 9000) can proxy API requests:

Update `/home/node/.openclaw/workspace/.fileserver/server.js`:
```javascript
// Add proxy for /api/* requests
if (urlPath.startsWith('/api/')) {
  // Proxy to backend at localhost:3002
  const backendUrl = `http://localhost:3002${urlPath}`;
  // ... implement simple proxy
}
```

This way:
- `http://localhost:9000/mission_control` → serves frontend
- `http://localhost:9000/api/*` → proxies to backend on :3002

---

## Testing Plan

### Unit Tests
- Database queries (CRUD operations)
- Auth middleware (JWT validation)
- API endpoint logic

### Integration Tests
- Full API workflows (create task → update → delete)
- WebSocket event broadcasts
- Authentication flow

### Manual Testing
- Create task in UI → verify in DB
- Update task status → verify WebSocket broadcast
- Agent creates task via API → verify UI updates
- Multiple browser tabs → verify real-time sync

---

## Security Considerations

1. **JWT Secret:** Use strong random secret, store in env var
2. **Password Hashing:** Use bcrypt for stored passwords (future enhancement)
3. **CORS:** Only allow requests from trusted origins
4. **Rate Limiting:** Prevent API abuse
5. **Input Validation:** Validate all inputs with Zod
6. **SQL Injection:** Use parameterized queries (better-sqlite3 handles this)
7. **XSS:** Sanitize user inputs before displaying

---

## Future Enhancements (Post-MVP)

- [ ] Task comments/discussion threads
- [ ] File attachments on tasks
- [ ] Task dependencies (blocked by X)
- [ ] Time tracking (estimated vs actual)
- [ ] User roles & permissions (admin, agent, viewer)
- [ ] Audit log (who changed what when)
- [ ] Email notifications
- [ ] Slack/Discord integration
- [ ] GraphQL API (alternative to REST)
- [ ] Task templates
- [ ] Sprint/milestone grouping
- [ ] Analytics dashboard
- [ ] Export to CSV/JSON

---

## Success Criteria

✅ **Backend API:**
- All CRUD endpoints working
- JWT authentication functional
- SQLite database persisting data

✅ **Real-time Updates:**
- Socket.io broadcasting events
- Multiple clients stay in sync
- No stale data in UI

✅ **OpenClaw Integration:**
- Agents can create tasks via API
- Tasks appear immediately in UI
- Event feed shows agent activity

✅ **Production Ready:**
- Error handling in place
- Input validation working
- Logging configured
- README documentation complete

---

## Codex Execution Notes

**Working Directory:** `/home/node/code/mission-control`

**Codex Command:**
```bash
codex exec --full-auto "
Build the Mission Control backend according to BACKEND_SPEC.md.

Work through all 5 phases in order:
1. Database + Basic API
2. WebSocket real-time updates
3. Frontend integration
4. OpenClaw integration  
5. Polish + production ready

After completing each milestone:
- Test the functionality
- Commit changes with a clear message
- Continue to next phase

Use the exact file structure, database schema, and API endpoints specified in the spec.

For the frontend integration (Phase 3), update the existing React app in src/ to consume the new API.

Do NOT push changes or create PRs - I will handle deployment.
"
```

**Expected Duration:** 2-4 hours (depends on Codex performance)

**Checkpoints:**
- Milestone 1: ~30min (REST API)
- Milestone 2: ~20min (WebSocket)
- Milestone 3: ~45min (Frontend integration)
- Milestone 4: ~30min (OpenClaw tool)
- Milestone 5: ~45min (Polish)

---

## Notes for Patch

When Codex completes each milestone, I will:
1. Test the functionality
2. Post update to Discord #patch-dev-work
3. Continue to next milestone or fix issues

If Codex gets stuck or produces errors, I will intervene and steer it back on track.

After all milestones complete, I will:
1. Run full integration tests
2. Update documentation
3. Create a demo video/screenshots
4. Ship to production
