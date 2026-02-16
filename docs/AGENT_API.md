# Mission Control Agent API

Mission Control exposes a REST API (plus real-time Socket.io events) that agents can call directly or through a thin tool wrapper.

## Required Environment Variables

```
MISSION_CONTROL_URL=http://localhost:3002
MISSION_CONTROL_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

`MISSION_CONTROL_TOKEN` is a JWT returned by the login endpoint and should be stored securely by the agent runtime.

## Authentication

Obtain a token:

```bash
curl -X POST "$MISSION_CONTROL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"patch","password":"REDACTED"}'
```

Use the returned token for all API calls:

```bash
curl -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  "$MISSION_CONTROL_URL/api/tasks"
```

## Task Endpoints

Create a task:

```bash
curl -X POST "$MISSION_CONTROL_URL/api/tasks" \
  -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix auth bug","status":"todo","priority":"critical","assignedAgent":"agent-patch","tags":["bug","auth"]}'
```

Update a task:

```bash
curl -X PATCH "$MISSION_CONTROL_URL/api/tasks/task-123" \
  -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}'
```

Delete a task:

```bash
curl -X DELETE "$MISSION_CONTROL_URL/api/tasks/task-123" \
  -H "Authorization: Bearer $MISSION_CONTROL_TOKEN"
```

List tasks (filter by status or agent):

```bash
curl -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  "$MISSION_CONTROL_URL/api/tasks?status=todo&agent=agent-patch"
```

## Agent Endpoints

List agents:

```bash
curl -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  "$MISSION_CONTROL_URL/api/agents"
```

Update agent status:

```bash
curl -X PATCH "$MISSION_CONTROL_URL/api/agents/agent-patch" \
  -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"busy"}'
```

## Event Feed

Fetch latest events:

```bash
curl -H "Authorization: Bearer $MISSION_CONTROL_TOKEN" \
  "$MISSION_CONTROL_URL/api/events?limit=25"
```

## Optional Tool Wrapper (Recommended)

A thin tool wrapper can translate high-level actions into API calls.

Example usage:

```javascript
mission_control({
  action: "create_task",
  title: "Fix auth bug",
  description: "Users cannot log in",
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
  action: "list_tasks",
  status: "todo"
})
```

The wrapper should:
- Read `MISSION_CONTROL_URL` and `MISSION_CONTROL_TOKEN` from the environment.
- Map actions to REST endpoints.
- Return parsed JSON responses to the calling agent.
