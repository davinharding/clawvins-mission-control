# Agent Task Integration

This document describes the agent task integration feature that enables agents to receive task assignments and manage their tasks from Discord/Telegram.

## Overview

When a task is assigned to an agent in Mission Control, the system automatically notifies the agent via:
1. **OpenClaw session** (if agent has an active session) - direct message to agent
2. **Discord/Telegram channel** (fallback) - message posted to agent's dedicated channel

Agents can then query and update their tasks using:
- **Agent Task API** - RESTful endpoints optimized for agent automation
- **Task Commands** - Natural language commands (e.g., "task start task-123")

## Architecture

```
Mission Control UI
    ↓ (assign task to agent)
    ↓ PATCH /api/tasks/:id
Task Routes Handler
    ↓ calls notifyAgentOfTask()
Webhook Handler
    ↓ tries sessions_send first
OpenClaw Gateway
    ↓ (if no active session)
    ↓ falls back to Discord/Telegram
Agent receives notification
    ↓ (responds with commands or API calls)
Agent Task API
    ↓ updates task + broadcasts WebSocket
Mission Control UI updates in real-time
```

## Components

### 1. Webhook Handler
**File:** `server/webhooks/task-assigned.js`

Handles task assignment notifications:
- Formats task assignment message
- Tries to send via OpenClaw session (sessions_send)
- Falls back to Discord/Telegram channel if no session
- Logs notification status

### 2. Agent Task API
**File:** `server/routes/agent-tasks.js`

RESTful endpoints for agents:
- `GET /api/agent-tasks/mine` - Get tasks assigned to agent
- `GET /api/agent-tasks/:taskId` - Get task details
- `PATCH /api/agent-tasks/:taskId/status` - Update task status
- `POST /api/agent-tasks/:taskId/comment` - Add comment to task
- `PATCH /api/agent-tasks/:taskId` - Full task update

All endpoints require authentication and emit WebSocket events for real-time updates.

### 3. OpenClaw Client
**File:** `server/lib/openclaw-client.js`

Helper functions for OpenClaw Gateway API:
- `findAgentSession(agentId)` - Find active session for agent
- `sendToAgentSession(sessionKey, message)` - Send message to session
- `getAllSessions()` - Get all active sessions

### 4. Message Client
**File:** `server/lib/message-client.js`

Discord/Telegram messaging:
- `sendToAgentChannel(agentId, message)` - Send to agent's channel
- `getAgentChannel(agentId)` - Get channel configuration
- `hasAgentChannel(agentId)` - Check if channel is configured

**Agent Channel Mappings:**
```javascript
{
  'agent-patch': { type: 'discord', channel: '1469764170906865706' },
  'agent-clawvin': { type: 'discord', channel: '1469764199470206996' },
  // ... more agents
}
```

### 5. Task Command Parser
**File:** `server/lib/task-command-parser.js`

Parse natural language task commands:
- `parseTaskCommand(message)` - Parse command from message
- `formatCommandResponse(task, action)` - Format response
- `validateCommand(command)` - Validate command
- `getTaskCommandHelp()` - Get help message

**Supported Commands:**
```
task show task-abc123
task start task-abc123
task complete task-abc123
task status task-abc123 in-progress
task comment task-abc123 Your comment here
```

## API Endpoints

### GET /api/agent-tasks/mine
Get all tasks assigned to authenticated agent.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-abc123",
      "title": "Build feature X",
      "description": "...",
      "status": "in-progress",
      "assignedAgent": "agent-patch",
      "priority": "high",
      "createdAt": 1234567890,
      "updatedAt": 1234567890,
      "createdBy": "admin",
      "tags": ["feature", "backend"]
    }
  ],
  "count": 1
}
```

### GET /api/agent-tasks/:taskId
Get specific task details.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "task": {
    "id": "task-abc123",
    "title": "Build feature X",
    // ... full task object
  }
}
```

### PATCH /api/agent-tasks/:taskId/status
Update task status (simplified endpoint).

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "status": "in-progress"
}
```

**Valid statuses:** `backlog`, `todo`, `in-progress`, `done`

**Response:**
```json
{
  "task": { /* updated task */ },
  "message": "Task status updated to in-progress"
}
```

### POST /api/agent-tasks/:taskId/comment
Add comment to task.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "content": "Made good progress on this feature"
}
```

**Response:**
```json
{
  "comment": {
    "id": "cmt-xyz789",
    "taskId": "task-abc123",
    "authorId": "agent-patch",
    "authorName": "Patch",
    "text": "Made good progress on this feature",
    "createdAt": 1234567890
  },
  "message": "Comment added successfully"
}
```

### PATCH /api/agent-tasks/:taskId
Full task update (status, priority, description).

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "status": "in-progress",
  "priority": "high",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "task": { /* updated task */ },
  "message": "Task updated successfully"
}
```

## Task Commands

Agents can respond to task notifications with natural language commands:

### Show Task Details
```
task show task-abc123
```

### Start Working on Task
```
task start task-abc123
```
→ Updates status to `in-progress`

### Complete Task
```
task complete task-abc123
```
→ Updates status to `done`

### Update Task Status
```
task status task-abc123 in-progress
task status task-abc123 done
```

### Add Comment
```
task comment task-abc123 Added authentication middleware
task comment task-abc123 Fixed bug in validation logic
```

## Notification Messages

### Task Assignment
When a task is assigned, the agent receives:

```
🟠 **New Task Assigned**

**Build Agent Task Integration**
Priority: HIGH
Status: backlog
ID: task-abc123

Enable agents to receive task assignments and manage tasks from Discord/Telegram

**Actions:**
- View details: Reply "task show task-abc123"
- Start work: Reply "task start task-abc123"
- Update status: Reply "task status task-abc123 in-progress"
- Add comment: Reply "task comment task-abc123 Your comment here"

Mission Control: http://localhost:9000/mission_control/
```

Priority emojis:
- 🔴 CRITICAL
- 🟠 HIGH
- 🟡 MEDIUM
- 🟢 LOW

## Configuration

### Environment Variables
**File:** `.env`

```bash
# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=http://localhost:8080
OPENCLAW_GATEWAY_TOKEN=your-gateway-token-here
OPENCLAW_REQUEST_TIMEOUT_MS=8000

# Frontend URL (for notification links)
FRONTEND_URL=http://localhost:9000
```

### Agent Channel Mappings
**File:** `server/lib/message-client.js`

Update `AGENT_CHANNELS` object to add/modify agent channels:

```javascript
const AGENT_CHANNELS = {
  'agent-patch': {
    type: 'discord',
    channel: '1469764170906865706',
  },
  'agent-your-agent': {
    type: 'discord',
    channel: '1234567890123456789',
  },
};
```

## Testing

### Automated Tests
Run the integration test script:

```bash
node test-agent-integration.js
```

This tests:
1. Task creation
2. Task assignment → notification
3. Agent task retrieval
4. Status updates via agent API
5. Comment creation via agent API
6. Task completion

### Manual Testing

1. **Start the server:**
   ```bash
   npm run server:dev
   ```

2. **Open Mission Control UI:**
   ```
   http://localhost:9000/mission_control/
   ```

3. **Create and assign a task:**
   - Create a new task
   - Assign it to an agent (e.g., Patch)
   - Check Discord #patch-dev-work for notification

4. **Test agent API:**
   ```bash
   # Get auth token
   curl -X POST http://localhost:3002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"patch","password":"REDACTED"}'
   
   # Get agent tasks
   curl http://localhost:3002/api/agent-tasks/mine \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Update task status
   curl -X PATCH http://localhost:3002/api/agent-tasks/task-abc123/status \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status":"in-progress"}'
   
   # Add comment
   curl -X POST http://localhost:3002/api/agent-tasks/task-abc123/comment \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content":"Working on this now"}'
   ```

5. **Verify real-time updates:**
   - Open Mission Control UI in browser
   - Use API to update task
   - Verify UI updates immediately (WebSocket)

## WebSocket Events

All agent task updates trigger WebSocket broadcasts:

### task.updated
Emitted when task status/priority/description changes:
```javascript
{
  task: { /* full task object */ }
}
```

### comment.created
Emitted when comment is added:
```javascript
{
  comment: { /* full comment object */ }
}
```

### event.new
Emitted for all task events (created, updated, assigned, etc.):
```javascript
{
  event: {
    id: "evt-xyz789",
    type: "task_updated",
    message: "Patch started working on 'Build feature X'",
    agentId: "agent-patch",
    taskId: "task-abc123",
    timestamp: 1234567890
  }
}
```

## Agent Integration in AGENTS.md

Add to agent workspace files:

```markdown
## Mission Control Tasks

When tasks are assigned to you, you'll receive a notification in your channel.

### Task Commands
- `task show <taskId>` - View task details
- `task start <taskId>` - Start working (→ in-progress)
- `task complete <taskId>` - Mark as done
- `task status <taskId> <status>` - Update status
- `task comment <taskId> <message>` - Add comment

### Task API
Use the agent task API endpoints with your auth token:
- GET /api/agent-tasks/mine - Get your tasks
- PATCH /api/agent-tasks/:id/status - Update status
- POST /api/agent-tasks/:id/comment - Add comment

Example:
```bash
curl http://localhost:3002/api/agent-tasks/mine \
  -H "Authorization: Bearer YOUR_TOKEN"
```
```

## Troubleshooting

### Agent not receiving notifications

1. **Check OpenClaw Gateway connection:**
   ```bash
   curl http://localhost:8080/health
   ```

2. **Verify environment variables:**
   ```bash
   echo $OPENCLAW_GATEWAY_URL
   echo $OPENCLAW_GATEWAY_TOKEN
   ```

3. **Check server logs:**
   ```
   [Webhook] Found active session for agent-patch: agent:coder:discord:channel:1234567890
   [Webhook] ✅ Sent task notification to agent-patch via session
   ```
   or
   ```
   [Webhook] No active session found for agent-patch
   [Webhook] ✅ Sent task notification to agent-patch via channel
   ```

4. **Verify agent channel mapping:**
   - Check `server/lib/message-client.js` for correct Discord channel ID
   - Test Discord channel permissions

### API requests failing

1. **Check authentication:**
   - Verify token is valid (not expired)
   - Check `Authorization: Bearer TOKEN` header

2. **Check request format:**
   - Use `Content-Type: application/json`
   - Verify JSON body is valid

3. **Check server logs:**
   ```
   [AgentTasks] Error updating task status: ...
   ```

### WebSocket updates not working

1. **Check Socket.IO connection:**
   - Open browser console
   - Look for Socket.IO connection logs

2. **Verify CORS configuration:**
   - Check `server/index.js` CORS settings
   - Ensure frontend URL is in allowed origins

3. **Check io.emit calls:**
   - Verify `req.app.io` is available in route handlers
   - Check server logs for emit events

## Future Enhancements

- [ ] Task command webhook endpoint (for agent chat integration)
- [ ] Task priority change notifications
- [ ] Task deadline reminders
- [ ] Bulk task operations
- [ ] Task search/filter API
- [ ] Agent performance metrics
- [ ] Task templates
- [ ] Automated task assignment (based on agent availability)
- [ ] Task dependencies and blocking
- [ ] SLA tracking and notifications
