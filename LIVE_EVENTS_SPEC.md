# Mission Control — Live Event Streaming Implementation

## Phase 1: Session Polling (Current)

### Overview
Poll OpenClaw `sessions_list` API every 10 seconds, track session updates, and generate real-time events.

### Architecture

**Backend Service:**
```javascript
// server/session-monitor.js
class SessionMonitor {
  constructor(io) {
    this.io = io;
    this.sessionCache = new Map(); // sessionKey -> { lastUpdate, lastMessageCount }
    this.pollInterval = 10000; // 10 seconds
  }

  async start() {
    await this.poll();
    setInterval(() => this.poll(), this.pollInterval);
  }

  async poll() {
    // 1. Call sessions_list API
    // 2. Compare with cache
    // 3. Detect changes (new session, updated session, ended session)
    // 4. Generate events
    // 5. Broadcast via WebSocket
    // 6. Store in database
  }
}
```

### Event Types to Detect

| Activity | Detection Method | Event Type | Example |
|----------|------------------|------------|---------|
| Agent heartbeat | Session `updatedAt` changed, no message count change | `agent_checkin` | "Patch checked in" |
| New message | `updatedAt` changed + message count increased | `agent_message` | "Clawvin sent a message" |
| Session started | New session key appears | `session_start` | "Alpha started research task" |
| Session ended | Session key disappeared | `session_end` | "Nova completed analysis" |
| Subagent spawned | New session with label, kind=other | `subagent_spawn` | "Patch spawned file-explorer-modern" |

### OpenClaw API Integration

**Endpoint:** Use existing `sessions_list` tool (internal API)
- Available via `sessions_list({ limit: 50, activeMinutes: 60 })`
- Returns: session keys, updatedAt, messageLimit, etc.

**Data Structure:**
```javascript
{
  key: "agent:coder:discord:channel:123",
  kind: "group",
  updatedAt: 1771288000000,
  totalTokens: 50000,
  model: "claude-sonnet-4-5",
  lastChannel: "discord",
  messages: [...]
}
```

### Implementation Steps

1. **Create `server/session-monitor.js`:**
   - SessionMonitor class
   - Poll loop with interval
   - Cache previous state
   - Diff detection logic
   - Event generation

2. **Update `server/index.js`:**
   - Import SessionMonitor
   - Start monitor after server starts
   - Pass Socket.io instance

3. **Database:**
   - Events table already exists
   - Just insert new events via `createEvent()`

4. **WebSocket:**
   - Broadcast events via `io.emit('event:new', event)`
   - Frontend already listens for these

5. **Frontend (no changes needed):**
   - Already has real-time event listener
   - Already displays events in feed

### Configuration

Add to `.env`:
```
SESSION_POLL_INTERVAL=10000  # milliseconds
SESSION_POLL_LIMIT=50        # max sessions to track
```

### Testing

1. Start backend
2. Trigger activity (send message, run command, etc.)
3. Verify event appears in feed within 10 seconds
4. Check WebSocket network tab for event broadcasts

---

## Phase 2: Transcript Tailing (Future)

### Overview
Watch session transcript files for real-time tool calls and messages.

### Architecture

**File Watcher:**
```javascript
// server/transcript-monitor.js
class TranscriptMonitor {
  constructor(io) {
    this.io = io;
    this.watchers = new Map();
    this.transcriptDir = '/home/node/.openclaw/agents/*/sessions/';
  }

  async start() {
    // Watch all .jsonl files in agent session dirs
    // Tail new lines
    // Parse tool calls, messages, errors
    // Emit as events
  }
}
```

### Events to Extract

| Source | Event Type | Example |
|--------|-----------|---------|
| Tool call: exec | `tool_exec` | "Patch ran: git commit" |
| Tool call: read | `tool_read` | "Alpha read MEMORY.md" |
| Tool call: write | `tool_write` | "Patch created spec.md" |
| Tool call: web_search | `tool_search` | "Nova searched: 'Claude benchmarks'" |
| Message (assistant) | `agent_message` | "Clawvin responded" |
| Error | `agent_error` | "Patch: command failed" |

### Implementation

1. Use `chokidar` for file watching
2. Parse `.jsonl` lines incrementally
3. Extract tool call details from JSON
4. Generate rich events with context
5. Store in database + broadcast

### Privacy & Filtering

- Skip sensitive content (API keys, passwords)
- Allow agents to opt-out via config
- Filter by event type (user preference)

---

## Future Enhancements

- **Filters:** Show only specific agents or event types
- **Search:** Full-text search through event history
- **Export:** Download event log as JSON/CSV
- **Alerts:** Notify on errors or critical events
- **Analytics:** Agent activity heatmap, tool usage stats
