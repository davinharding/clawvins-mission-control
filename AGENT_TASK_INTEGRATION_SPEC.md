# Mission Control - Agent Task Integration

## Goal
Enable agents to receive task assignments and manage their tasks directly from their Discord/Telegram channels.

## Architecture Overview

```
Mission Control Backend
    ↓ (task assigned)
    ↓ POST /webhook/task-assigned
OpenClaw Gateway
    ↓ sessions_send
Agent Session
    ↓ receives notification
Agent responds with commands
    ↓ POST /api/tasks/:id/update
Mission Control Backend
    ↓ updates task + broadcasts WebSocket
Frontend updates in real-time
```

## Components to Build

### 1. Task Assignment Webhook
**File:** `server/webhooks/task-assigned.js`

**Purpose:** When task is assigned, notify the agent

**Flow:**
1. Task update endpoint detects assignment change
2. Calls webhook handler
3. Webhook determines agent's session key
4. Uses `sessions_send` to notify agent (if using OpenClaw API)
5. OR sends Discord/Telegram message directly (if using message channels)

**Implementation:**
```javascript
// server/webhooks/task-assigned.js
export async function notifyAgentOfTask(task, agentId) {
  // Determine notification channel
  // Option 1: Try sessions_send (if agent has active session)
  // Option 2: Send Discord/Telegram message directly
  
  const message = formatTaskAssignmentMessage(task);
  
  // Try to find agent's session
  const agentSessionKey = await findAgentSession(agentId);
  
  if (agentSessionKey) {
    // Send via OpenClaw sessions_send API
    await sendToSession(agentSessionKey, message);
  } else {
    // Send via Discord/Telegram channel
    await sendToChannel(agentId, message);
  }
}

function formatTaskAssignmentMessage(task) {
  return `📋 **New Task Assigned**

**${task.title}**
Priority: ${task.priority?.toUpperCase() || 'MEDIUM'}
Status: ${task.status}

${task.description}

**Actions:**
- View details: Reply "task show ${task.id}"
- Start work: Reply "task start ${task.id}"
- Update status: Reply "task status ${task.id} in-progress"

Mission Control: http://localhost:9000/mission_control/`;
}
```

### 2. Agent Task Commands API
**File:** `server/routes/agent-tasks.js`

**Purpose:** API endpoints for agents to query and update their tasks

**Endpoints:**

#### GET `/api/agent-tasks/mine`
Get all tasks assigned to authenticated agent
```javascript
router.get('/mine', authMiddleware, (req, res) => {
  const agentId = req.user.id;
  const tasks = getAllTasks({ agent: agentId });
  res.json({ tasks: tasks.map(formatTask) });
});
```

#### GET `/api/agent-tasks/:taskId`
Get specific task details
```javascript
router.get('/:taskId', authMiddleware, (req, res) => {
  const task = getTaskById(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  // Check if agent is assigned or allow all agents to view
  res.json({ task: formatTask(task) });
});
```

#### PATCH `/api/agent-tasks/:taskId/status`
Update task status (simplified endpoint for agents)
```javascript
router.patch('/:taskId/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const task = updateTask(req.params.taskId, { status });
  
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  // Create event
  createEvent({
    type: 'task_updated',
    message: `${req.user.name} moved task to ${status}`,
    agentId: req.user.id,
    taskId: task.id,
  });
  
  // Broadcast
  if (req.app.io) {
    req.app.io.emit('task.updated', { task: formatTask(task) });
  }
  
  res.json({ task: formatTask(task) });
});
```

#### POST `/api/agent-tasks/:taskId/comment`
Add comment to task (simplified endpoint for agents)
```javascript
router.post('/:taskId/comment', authMiddleware, (req, res) => {
  const { content } = req.body;
  
  const comment = createComment(req.params.taskId, {
    content,
    authorId: req.user.id,
    authorName: req.user.name,
  });
  
  // Broadcast
  if (req.app.io) {
    req.app.io.emit('comment.created', { comment });
  }
  
  res.json({ comment });
});
```

### 3. OpenClaw Integration Helper
**File:** `server/lib/openclaw-client.js`

**Purpose:** Helper functions to interact with OpenClaw Gateway API

**Functions:**

#### Find Agent Session
```javascript
export async function findAgentSession(agentId) {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}` }
    });
    
    const data = await response.json();
    const sessions = data.sessions || [];
    
    // Find session for this agent
    const agentSession = sessions.find(s => 
      s.key?.includes(`agent:${agentId}:`) || 
      s.agentId === agentId
    );
    
    return agentSession?.key || null;
  } catch (err) {
    console.error('[OpenClaw] Failed to find agent session:', err);
    return null;
  }
}
```

#### Send to Agent Session
```javascript
export async function sendToAgentSession(sessionKey, message) {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/sessions/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`
      },
      body: JSON.stringify({
        sessionKey,
        message,
        timeoutSeconds: 30
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('[OpenClaw] Failed to send to session:', err);
    throw err;
  }
}
```

### 4. Discord/Telegram Fallback
**File:** `server/lib/message-client.js`

**Purpose:** Send direct Discord/Telegram messages if agent has no active session

**Agent Channel Mapping:**
```javascript
const AGENT_CHANNELS = {
  'agent-patch': { 
    type: 'discord', 
    channel: '1469764170906865706' // #patch-dev-work
  },
  'agent-clawvin': { 
    type: 'discord', 
    channel: '1469764199470206996' // #clawvin-admin-config
  },
  'agent-scout': { 
    type: 'discord', 
    channel: '1469764057685819484' // #scout-ops or similar
  },
  'agent-vitals': { 
    type: 'discord', 
    channel: '1469764057685819484' // #vitals-health-tracking
  },
  // Add mappings for all agents
};

export async function sendToAgentChannel(agentId, message) {
  const channel = AGENT_CHANNELS[agentId];
  if (!channel) {
    console.warn(`[Message] No channel mapping for agent: ${agentId}`);
    return;
  }
  
  // Use OpenClaw message tool via API
  try {
    const response = await fetch(`${GATEWAY_URL}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`
      },
      body: JSON.stringify({
        action: 'send',
        channel: channel.type,
        target: channel.channel,
        message
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send: ${response.status}`);
    }
  } catch (err) {
    console.error('[Message] Failed to send to channel:', err);
  }
}
```

### 5. Update Task Routes
**File:** `server/routes/tasks.js`

**Modify:** Add webhook call when task assigned

```javascript
router.patch('/:id', validateBody(schemas.taskUpdate), async (req, res) => {
  try {
    const oldTask = getTaskById(req.params.id);
    const task = updateTask(req.params.id, {
      // ... existing update logic
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if agent assignment changed
    const assignmentChanged = oldTask && 
      oldTask.assigned_agent !== task.assigned_agent &&
      task.assigned_agent; // New assignment (not unassignment)
    
    if (assignmentChanged) {
      // Notify agent asynchronously (don't block response)
      notifyAgentOfTask(task, task.assigned_agent).catch(err => {
        console.error('[Webhook] Failed to notify agent:', err);
      });
    }

    // ... rest of existing code
  } catch (err) {
    // ... error handling
  }
});
```

### 6. Agent Command Parser (Optional Enhancement)
**File:** `server/lib/task-command-parser.js`

**Purpose:** Parse natural language task commands from agents

**Examples:**
- "task start task-abc123" → PATCH /api/agent-tasks/task-abc123/status {status: 'in-progress'}
- "task complete task-abc123" → PATCH /api/agent-tasks/task-abc123/status {status: 'done'}
- "task comment task-abc123 Added auth middleware" → POST /api/agent-tasks/task-abc123/comment
- "task show task-abc123" → GET /api/agent-tasks/task-abc123

```javascript
export function parseTaskCommand(message) {
  const match = message.match(/^task\s+(start|complete|show|status|comment)\s+(task-[\w-]+)(?:\s+(.+))?/i);
  
  if (!match) return null;
  
  const [, action, taskId, args] = match;
  
  switch (action.toLowerCase()) {
    case 'start':
      return { type: 'status', taskId, status: 'in-progress' };
    case 'complete':
      return { type: 'status', taskId, status: 'done' };
    case 'show':
      return { type: 'show', taskId };
    case 'status':
      return { type: 'status', taskId, status: args?.trim() };
    case 'comment':
      return { type: 'comment', taskId, content: args?.trim() };
    default:
      return null;
  }
}
```

### 7. Agent Heartbeat Integration (Future)
**File:** Agent workspace AGENTS.md update

**Purpose:** Show assigned tasks in agent heartbeat

**Example addition to AGENTS.md:**
```markdown
## Mission Control Tasks

Check assigned tasks:
1. Call GET /api/agent-tasks/mine with your auth token
2. If tasks in 'in-progress' status, report status
3. If tasks in 'backlog' and high priority, consider starting
4. Update task status as you complete work
```

## Environment Variables
**File:** `.env`

Add required configuration:
```bash
# OpenClaw Gateway (for sessions_send and message API)
OPENCLAW_GATEWAY_URL=http://localhost:8080
OPENCLAW_GATEWAY_TOKEN=your-token-here

# Agent channel mappings (if using direct messaging)
DISCORD_PATCH_CHANNEL=1469764170906865706
DISCORD_CLAWVIN_CHANNEL=1469764199470206996
# ... etc
```

## Database Schema (Already Exists)
No changes needed - existing schema supports this:
- `tasks.assigned_agent` - agent ID
- `comments.author_id` - agent ID
- `events.agent_id` - agent ID

## Testing Plan

### Manual Testing
1. Create task in Mission Control UI
2. Assign to agent (e.g., Patch)
3. Verify agent receives Discord/Telegram notification
4. Agent replies: "task start task-xyz123"
5. Verify task moves to "in-progress" in Mission Control
6. Agent replies: "task comment task-xyz123 Made good progress"
7. Verify comment appears in Mission Control
8. Agent replies: "task complete task-xyz123"
9. Verify task moves to "done" in Mission Control

### API Testing
```bash
# Get my tasks
curl -H "Authorization: Bearer <token>" http://localhost:3002/api/agent-tasks/mine

# Update task status
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}' \
  http://localhost:3002/api/agent-tasks/task-xyz123/status

# Add comment
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Working on this now"}' \
  http://localhost:3002/api/agent-tasks/task-xyz123/comment
```

## Implementation Checklist
- [ ] Create `server/webhooks/task-assigned.js`
- [ ] Create `server/routes/agent-tasks.js`
- [ ] Create `server/lib/openclaw-client.js`
- [ ] Create `server/lib/message-client.js`
- [ ] Create `server/lib/task-command-parser.js` (optional)
- [ ] Update `server/routes/tasks.js` - add webhook call
- [ ] Update `server/index.js` - register agent-tasks routes
- [ ] Update `.env.example` - add OpenClaw config
- [ ] Add agent channel mapping config
- [ ] Test task assignment notification
- [ ] Test agent status updates
- [ ] Test agent comments
- [ ] Document agent commands in AGENTS.md

## Success Criteria
1. ✅ Agent receives notification when task assigned
2. ✅ Agent can query their tasks via API
3. ✅ Agent can update task status via API or command
4. ✅ Agent can add comments via API or command
5. ✅ All updates broadcast to Mission Control in real-time
6. ✅ Both session-based and channel-based notifications work
7. ✅ No breaking changes to existing UI functionality

## Notes
- Start with Discord notifications (easier to test)
- Add Telegram support after Discord works
- Consider rate limiting agent API endpoints
- Log all agent task actions for debugging
- Make agent channel mappings configurable (not hardcoded)
