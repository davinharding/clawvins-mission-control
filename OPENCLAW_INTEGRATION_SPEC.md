# Mission Control - OpenClaw Integration

## Problem
Current implementation uses dummy/fake data:
- ❌ Fake agent data (only Patch is correct)
- ❌ Fake events in live feed
- ❌ No connection to real OpenClaw system
- ❌ Incomplete agent list

## Goal
Replace all dummy data with real OpenClaw agent data and events.

## Requirements

### 1. Real Agent Data
**Source:** OpenClaw Gateway API
- Query OpenClaw for list of all configured agents
- Get real agent status (online/offline/busy)
- Get real agent metadata (name, role, avatar color)

**Implementation:**
- Backend calls OpenClaw Gateway API: `GET /api/agents` or similar
- Store agent data in Mission Control database (cache)
- Update agent status periodically (polling or webhook)

### 2. Real Event Feed
**Source:** OpenClaw event stream
- Hook into OpenClaw's existing event system
- Display real agent activity:
  - Agent started task
  - Agent completed task
  - Agent sent message
  - Agent changed status
  - Subagent spawned
  - Exec session completed

**Implementation:**
- Backend subscribes to OpenClaw event stream
- When event received, create event entry in Mission Control DB
- Broadcast to frontend via WebSocket
- Events display in real-time in live feed

### 3. WebSocket Connection Status
**UI Indicator:**
- Green dot + "Connected" when WebSocket active
- Red dot + "Disconnected" when WebSocket down
- Yellow dot + "Reconnecting..." when attempting reconnect
- Show in top-right corner of dashboard

**Implementation:**
- Frontend tracks WebSocket connection state
- Display status indicator component
- Auto-reconnect on disconnect

### 4. Complete Agent List
**All OpenClaw Agents:**
- Patch (Dev) - already correct
- Nova (if exists)
- Scout (if exists)
- Atlas (if exists)
- Any other configured agents

**Source:** `agents_list` tool or Gateway API

### 5. Remove Dummy Data
**Clean up:**
- Remove fake agent seed data from `server/seed.js`
- Remove fake events from seed data
- Keep task seed data (sample tasks are OK for demo)

## Implementation Plan

### Phase 1: Discover OpenClaw APIs
1. Check OpenClaw Gateway for available endpoints:
   - Agents API
   - Events API
   - Sessions API
2. Document authentication (if needed)
3. Document data formats

### Phase 2: Backend Integration
1. Create `server/openclaw.js` - OpenClaw API client
   - `async function getAgents()` - fetch real agents
   - `async function getEvents(since)` - fetch recent events
   - `async function subscribeToEvents(callback)` - event stream
2. Update `server/seed.js`:
   - Fetch real agents from OpenClaw
   - Insert into database
   - Remove fake agent data
3. Create event poller or webhook listener:
   - Poll OpenClaw events every 5 seconds
   - OR set up webhook to receive events
   - Create event entries in DB
   - Broadcast via WebSocket

### Phase 3: Frontend Updates
1. Create `src/components/ConnectionStatus.tsx`:
   - Display WebSocket connection state
   - Show in top-right corner
   - Auto-reconnect logic
2. Update `src/lib/socket.ts`:
   - Track connection state
   - Emit state changes
   - Auto-reconnect on disconnect
3. Update `src/App.tsx`:
   - Add ConnectionStatus component
   - Handle reconnection events

### Phase 4: Testing
1. Verify all real agents appear in agent panel
2. Verify real events appear in live feed
3. Test WebSocket disconnect/reconnect
4. Test across multiple browser tabs
5. Verify no dummy data remains

## OpenClaw Gateway Integration

### Option 1: Direct Gateway API
If Gateway exposes HTTP API:
```javascript
// server/openclaw.js
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

async function getAgents() {
  const res = await fetch(`${GATEWAY_URL}/api/agents`, {
    headers: { Authorization: `Bearer ${GATEWAY_TOKEN}` }
  });
  return res.json();
}
```

### Option 2: Use Tools from OpenClaw
If Mission Control backend runs IN OpenClaw:
```javascript
// Can use exec to call OpenClaw tools
const { exec } = require('child_process');

function getAgents() {
  return new Promise((resolve, reject) => {
    exec('openclaw agents list --json', (err, stdout) => {
      if (err) reject(err);
      else resolve(JSON.parse(stdout));
    });
  });
}
```

### Option 3: Read OpenClaw Config
If agents defined in config file:
```javascript
// Read from ~/.openclaw/config.toml or similar
const fs = require('fs');
const toml = require('toml');

function getAgents() {
  const config = toml.parse(fs.readFileSync('/home/node/.openclaw/config.toml'));
  return config.agents;
}
```

## Event Stream Integration

### Option 1: Polling
Poll Gateway API every 5 seconds:
```javascript
setInterval(async () => {
  const events = await getEvents(lastEventTimestamp);
  events.forEach(event => {
    createEvent(event);
    io.emit('event.new', event);
  });
  lastEventTimestamp = Date.now();
}, 5000);
```

### Option 2: Webhook
Set up endpoint for OpenClaw to push events:
```javascript
app.post('/api/openclaw/events', (req, res) => {
  const event = req.body;
  createEvent(event);
  io.emit('event.new', event);
  res.json({ success: true });
});
```

### Option 3: Direct Log Tail
Tail OpenClaw logs and parse events:
```javascript
const { spawn } = require('child_process');

const tail = spawn('tail', ['-f', '/home/node/.openclaw/logs/gateway.log']);
tail.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(parseLogLineAndCreateEvent);
});
```

## Agent Schema Update

Current (dummy):
```javascript
{
  id: "agent-patch",
  name: "Patch",
  role: "Dev",
  status: "online",
  lastActive: 1234567890,
  avatarColor: "#3b82f6"
}
```

Real OpenClaw data might look like:
```javascript
{
  id: "coder",
  name: "Patch",
  description: "Coding agent",
  model: "anthropic/claude-sonnet-4-5",
  status: "online",
  lastActive: 1234567890,
  sessionCount: 3,
  // ... other metadata
}
```

Update database schema if needed to match real data structure.

## Event Types to Display

Map OpenClaw events to Mission Control events:

| OpenClaw Event | Mission Control Display |
|---------------|------------------------|
| Agent started | "Patch came online" |
| Agent idle | "Patch went idle" |
| Subagent spawned | "Patch spawned subagent: task-name" |
| Subagent completed | "Patch's subagent completed: task-name" |
| Exec completed | "Patch completed: command" |
| Message sent | "Patch sent message in #channel" |
| Task created (from our API) | "Patch created task: title" |
| Task completed (from our API) | "Patch completed task: title" |

## Environment Variables

Add to `.env`:
```bash
# OpenClaw Integration
GATEWAY_URL=http://localhost:8080
GATEWAY_TOKEN=your-gateway-token-here
OPENCLAW_EVENTS_POLL_INTERVAL=5000
```

## Success Criteria

- ✅ All real agents appear in agent panel (not just Patch)
- ✅ Agent status updates in real-time (online/offline/busy)
- ✅ Live feed shows real OpenClaw events (not dummy data)
- ✅ WebSocket connection status visible in UI
- ✅ Auto-reconnect works when connection drops
- ✅ No dummy/fake data remains
- ✅ Events are real-time (5 second delay max)

## Time Estimate
60-90 minutes

## Notes
- Need to discover actual OpenClaw Gateway API first
- May need to adjust based on what APIs are available
- Some OpenClaw internals might not be exposed via API yet
- Might need to use mix of approaches (config file + logs + API)

## Working Directory
`/home/node/code/mission-control`
