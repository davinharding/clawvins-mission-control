# Mission Control Phase 3 Spec

Work in `~/code/mission-control`. Implement all 5 items below.

---

## 1. Fix Comment Attribution (Davin vs Patch)

### Problem
All comments show as "Patch" because the frontend always logs in with username "patch".

### Fix in `server/routes/auth.js`

Add a second user: Davin. The UI will log in as Davin; agents use Patch via API.

```js
// Replace the single-user auth with multi-user:
const USERS = {
  [process.env.ADMIN_USERNAME || 'patch']: {
    password: process.env.ADMIN_PASSWORD || 'REDACTED',
    user: { id: 'agent-patch', name: 'Patch', role: 'Dev' },
  },
  [process.env.DAVIN_USERNAME || 'davin']: {
    password: process.env.DAVIN_PASSWORD || 'davin-password-here',
    user: { id: 'user-davin', name: 'Davin', role: 'Main' },
  },
};

router.post('/login', validateBody(schemas.login), (req, res) => {
  const { username, password } = req.body;
  const entry = USERS[username];
  if (!entry || entry.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Ensure user exists in agents table if they're an agent
  // (skip for davin since he's not an agent)
  const token = generateToken(entry.user);
  res.json({ token, user: entry.user });
});
```

### Fix in `.env`
Add:
```
DAVIN_USERNAME=davin
DAVIN_PASSWORD=REDACTED_PASSWORD
```

### Fix in `src/App.tsx` (frontend login)
Change the default login to use Davin:
```ts
const username = import.meta.env.VITE_DAVIN_USERNAME || import.meta.env.VITE_ADMIN_USERNAME || "davin";
const password = import.meta.env.VITE_DAVIN_PASSWORD || import.meta.env.VITE_ADMIN_PASSWORD || "REDACTED_PASSWORD";
```

### Fix in `src/.env` or `src/.env.local`
Add:
```
VITE_DAVIN_USERNAME=davin
VITE_DAVIN_PASSWORD=REDACTED_PASSWORD
```
(create `.env` in the root if not exists — Vite reads it automatically)

---

## 2. Comment Count Badge on Task Cards

### Problem
No indication on task cards that there are comments.

### Backend Fix: Add comment_count to task queries in `server/db.js`

In `getTaskById` and `getAllTasks`, add a subquery for comment count:
```sql
SELECT t.*, 
  (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
FROM tasks t
WHERE ...
```

### Backend Fix: Include in `formatTask` in `server/routes/tasks.js`
```js
const formatTask = (task) => ({
  ...
  commentCount: task.comment_count ?? 0,
});
```

### Frontend Fix: Show on task card in `src/App.tsx`
In the task card section, after the agent/timestamp row, add a comment count indicator:
```tsx
{(task.commentCount ?? 0) > 0 && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <span>💬</span>
    <span>{task.commentCount}</span>
  </div>
)}
```

Also update the `Task` type in `src/lib/api.ts` to include `commentCount?: number`.

### Real-time update
When a comment is created (via WebSocket `comment.created` event), increment the comment count on the matching task in the tasks state:
```ts
socket.on("comment.created", (payload: CommentPayload) => {
  setTasks((prev) =>
    prev.map((task) =>
      task.id === payload.comment.taskId
        ? { ...task, commentCount: (task.commentCount ?? 0) + 1 }
        : task
    )
  );
  setIncomingComment(payload.comment);
});
```

---

## 3. In-App Notification Tray

### Overview
A bell icon in the header that shows a badge with unread count. Clicking opens a slide-out panel listing notifications. Notifications are read/unread. Each notification links to the relevant task.

### New file: `src/components/NotificationTray.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Notification = {
  id: string;
  type: "task_moved" | "task_completed" | "comment_added" | "task_assigned" | "task_created";
  title: string;
  message: string;
  taskId?: string;
  read: boolean;
  timestamp: number;
};

type Props = {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClickNotification: (n: Notification) => void;
};

export function NotificationTray({ notifications, onMarkRead, onMarkAllRead, onClickNotification }: Props) {
  const [open, setOpen] = React.useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:bg-muted"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
              {notifications.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    onMarkRead(n.id);
                    onClickNotification(n);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/60",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span className="mt-0.5 text-base">
                    {n.type === "comment_added" ? "💬" :
                     n.type === "task_completed" ? "✅" :
                     n.type === "task_moved" ? "↕️" :
                     n.type === "task_assigned" ? "👤" : "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### Wire into `src/App.tsx`

1. Add state:
```ts
const [notifications, setNotifications] = React.useState<Notification[]>([]);
```

2. Helper to add notification:
```ts
const addNotification = (n: Omit<Notification, "id" | "read" | "timestamp">) => {
  setNotifications((prev) => [
    { ...n, id: `notif-${Date.now()}-${Math.random()}`, read: false, timestamp: Date.now() },
    ...prev,
  ]);
};
```

3. Trigger notifications from WebSocket events:
```ts
// In socket.on("task.updated"):
if (payload.task.status === "done") {
  addNotification({
    type: "task_completed",
    title: "Task completed",
    message: payload.task.title,
    taskId: payload.task.id,
  });
} else if (/* status changed */) {
  addNotification({
    type: "task_moved",
    title: "Task moved",
    message: `"${payload.task.title}" → ${payload.task.status}`,
    taskId: payload.task.id,
  });
}

// In socket.on("comment.created"):
addNotification({
  type: "comment_added",
  title: `New comment`,
  message: `${payload.comment.authorName}: ${payload.comment.text.slice(0, 60)}`,
  taskId: payload.comment.taskId,
});

// In socket.on("task.created"):
addNotification({
  type: "task_created",
  title: "New task created",
  message: payload.task.title,
  taskId: payload.task.id,
});
```

4. Add to header (next to ConnectionStatus):
```tsx
import { NotificationTray, type Notification } from "@/components/NotificationTray";

// In header JSX:
<NotificationTray
  notifications={notifications}
  onMarkRead={(id) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }
  onMarkAllRead={() =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }
  onClickNotification={(n) => {
    if (n.taskId) {
      setActiveTaskId(n.taskId);
      setModalOpen(true);
    }
  }}
/>
```

---

## 4. Expand Event Watcher to All Agent Workspaces

### Problem
Session watcher only monitors `workspace-coder`. Messages sent to any other agent via Discord (Clawvin, Nova, Scout, etc.) and any activity they trigger never appear in the feed.

### Fix in `scripts/watch-sessions.js`

Change the watched directories from just `workspace-coder` to ALL agent workspaces:

```js
const WATCH_DIRS = [
  '/home/node/.openclaw/workspace-coder',
  '/home/node/.openclaw/workspace',        // Clawvin (main)
  '/home/node/.openclaw/workspace-main',
  '/home/node/.openclaw/workspace-alpha',
  '/home/node/.openclaw/workspace-atlas',
  '/home/node/.openclaw/workspace-nova',
  '/home/node/.openclaw/workspace-scout',
  '/home/node/.openclaw/workspace-finance',
  '/home/node/.openclaw/workspace-health',
  '/home/node/.openclaw/workspace-iris',
].filter(dir => {
  try { require('fs').accessSync(dir); return true; } catch { return false; }
});
```

When syncing, send all sessions from all directories. The session key prefix identifies which agent:
- `agent:coder:*` → Patch
- `agent:main:*` or `agent:clawvin:*` → Clawvin  
- `agent:alpha:*` → Alpha
- etc.

Update `extractAgentName` in `server/session-monitor.js` to map all agent prefixes correctly.

---

## 5. Agent Autonomous Task Control (API Key)

### Overview
Agents need to be able to update tasks autonomously. This requires them to authenticate with Mission Control. Use a shared API key (simpler than per-agent JWT).

### Backend: Add API key middleware in `server/auth.js`

```js
const AGENT_API_KEY = process.env.AGENT_API_KEY || 'mc-agent-key-change-me';

export function agentKeyMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['x-agent-key'];
  if (key === AGENT_API_KEY) {
    // Allow — set a generic agent user
    // Try to identify agent from header
    const agentName = req.headers['x-agent-name'] || 'Agent';
    const agentId = req.headers['x-agent-id'] || 'agent-unknown';
    req.user = { id: agentId, name: agentName, role: 'Dev' };
    return next();
  }
  next(); // Fall through to JWT middleware
}
```

### Backend: Apply to task routes
In `server/routes/tasks.js`, before `authMiddleware`, try agent key:
```js
import { authMiddleware, agentKeyMiddleware } from '../auth.js';

// Combined middleware: accept either JWT or API key
const flexAuth = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key) return agentKeyMiddleware(req, res, next);
  return authMiddleware(req, res, next);
};

router.use(flexAuth);
```

### Add to `.env`
```
AGENT_API_KEY=REDACTED_AGENT_KEY
```

### Agents can now update tasks with:
```bash
curl -X PATCH http://localhost:3002/api/tasks/{taskId} \
  -H "x-api-key: REDACTED_AGENT_KEY" \
  -H "x-agent-name: Patch" \
  -H "x-agent-id: agent-patch" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

Document this in README.md with example curl commands.

---

## Build & Deploy

```bash
cd ~/code/mission-control

# Rebuild frontend
pnpm build

# Restart services (kills orphans first)
bash scripts/restart.sh

# Push to GitHub
git add -A
git commit -m "feat: comment attribution, comment badges, notification tray, multi-workspace events, agent API key"
GIT_SSH_COMMAND="ssh -i /home/node/.openclaw/workspace/.ssh/clawvin-bot -o StrictHostKeyChecking=no" git push origin master
```

## Done Criteria
- [ ] Comments made via UI show as "Davin" not "Patch"
- [ ] Task cards show 💬 count badge when they have comments
- [ ] Bell icon in header with unread badge
- [ ] Notification panel shows task moves, completions, comments (read/unread)
- [ ] Clicking a notification opens that task's modal
- [ ] Session watcher picks up events from ALL 9 agent workspaces
- [ ] Agents can PATCH tasks with x-api-key header
