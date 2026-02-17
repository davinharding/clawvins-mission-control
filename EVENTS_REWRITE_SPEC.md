# Live Events Feed — Full Rewrite Spec

## What Changed

The previous watcher watched `workspace-*/` directories which had no useful data. The real session data is at:
- `/home/node/.openclaw/agents/{agent}/sessions/sessions.json` — session index with channel/metadata
- `/home/node/.openclaw/agents/{agent}/sessions/{uuid}.jsonl` — full message transcript

Each .jsonl entry looks like:
```json
{"type":"message","id":"abc","parentId":"xyz","timestamp":"2026-02-17T03:55:22Z","message":{"role":"user","content":[{"type":"text","text":"just a test"}]}}
{"type":"message","id":"def","parentId":"abc","timestamp":"2026-02-17T03:55:30Z","message":{"role":"assistant","content":[{"type":"text","text":"👍"}],"model":"claude-opus-4-6","usage":{"totalTokens":110689}}}
```

sessions.json is keyed by session key like `agent:clawvin:discord:channel:1469762421706199143` and has `displayName`, `groupChannel`, `channel`, `sessionFile`, `updatedAt`.

---

## Step 1: Update the database schema

In `server/db.js`, add a `detail` TEXT column to the `events` table (stores JSON with full event info):

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  agent_id TEXT,
  task_id TEXT,
  timestamp INTEGER NOT NULL,
  detail TEXT  -- JSON blob: {channel, channelName, sessionKey, content, toolName, model, tokens, cost}
)
```

Add a migration at startup:
```js
db.prepare("ALTER TABLE events ADD COLUMN detail TEXT").run();
// Catch error if column already exists — that's fine
```

Update `createEvent` to accept and store `detail`:
```js
export function createEvent(data) {
  const id = data.id || nanoid();
  db.prepare(`
    INSERT INTO events (id, type, message, agent_id, task_id, timestamp, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.type, data.message, data.agentId || null, data.taskId || null, data.timestamp || Date.now(), data.detail ? JSON.stringify(data.detail) : null);
  return getEventById(id);
}
```

Update `formatEvent` in routes to include `detail`:
```js
const formatEvent = (event) => ({
  id: event.id,
  type: event.type,
  message: event.message,
  agentId: event.agent_id,
  taskId: event.task_id,
  timestamp: event.timestamp,
  detail: event.detail ? JSON.parse(event.detail) : null,
});
```

---

## Step 2: Rewrite `scripts/watch-sessions.js` from scratch

Replace the entire file with this:

```js
import fs from 'fs';
import path from 'path';
import http from 'http';
import { nanoid } from 'nanoid';

const AGENTS_DIR = '/home/node/.openclaw/agents';
const MC_API = 'http://localhost:3002';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'REDACTED_SECRET';
const POLL_INTERVAL = 5000; // 5 seconds for responsiveness
const STATE_FILE = '/tmp/mc-watcher-state.json';

// Map agent directory names to Mission Control agent IDs and display names
const AGENT_MAP = {
  'coder':           { id: 'agent-patch',    name: 'Patch' },
  'clawvin':         { id: 'agent-clawvin',  name: 'Clawvin' },
  'alpha':           { id: 'agent-alpha',    name: 'Alpha' },
  'finance':         { id: 'agent-ledger',   name: 'Ledger' },
  'health-tracking': { id: 'agent-vitals',   name: 'Vitals' },
  'main':            { id: 'agent-clawvin',  name: 'Clawvin' },
  'outreach':        { id: 'agent-iris',     name: 'Iris' },
  'nova':            { id: 'agent-nova',     name: 'Nova' },
  'scout':           { id: 'agent-scout',    name: 'Scout' },
  'atlas':           { id: 'agent-atlas',    name: 'Atlas' },
  'stagesnap-business': { id: 'agent-alpha', name: 'Alpha' },
};

// Load persisted state (tracks byte offsets per file so we don't re-read)
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { fileOffsets: {}, seenSessions: {} };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {}
}

// Get text preview from message content (first 120 chars)
function getContentPreview(content) {
  if (typeof content === 'string') return content.slice(0, 120);
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block.type === 'text' && block.text) return block.text.slice(0, 120);
    if (block.type === 'tool_use') return `[Tool: ${block.name}]`;
  }
  return '';
}

// Get all tool calls from assistant content
function getToolCalls(content) {
  if (!Array.isArray(content)) return [];
  return content.filter(b => b.type === 'tool_use').map(b => ({
    name: b.name,
    inputKeys: Object.keys(b.input || {}),
  }));
}

// POST events to Mission Control backend
function postEvents(events) {
  if (!events.length) return;
  const body = JSON.stringify({ events });
  const req = http.request({
    hostname: 'localhost',
    port: 3002,
    path: '/api/admin/session-sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-admin-secret': ADMIN_SECRET,
    },
  }, (res) => {
    if (res.statusCode !== 200) {
      console.error(`[Watcher] session-sync returned ${res.statusCode}`);
    }
  });
  req.on('error', (err) => console.error('[Watcher] POST error:', err.message));
  req.write(body);
  req.end();
}

// Parse new lines from a .jsonl file starting at offset
function readNewLines(filePath, offset) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size <= offset) return { lines: [], newOffset: offset };

    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(stat.size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);

    const text = buf.toString('utf8');
    const lines = text.split('\n').filter(l => l.trim());
    return { lines, newOffset: stat.size };
  } catch {
    return { lines: [], newOffset: offset };
  }
}

// Main scan function
async function scan(state) {
  const newEvents = [];

  // Get all agent directories
  let agentDirs;
  try {
    agentDirs = fs.readdirSync(AGENTS_DIR).filter(name => {
      try {
        return fs.statSync(path.join(AGENTS_DIR, name, 'sessions')).isDirectory();
      } catch { return false; }
    });
  } catch {
    return newEvents;
  }

  for (const agentDir of agentDirs) {
    const agent = AGENT_MAP[agentDir] || { id: `agent-${agentDir}`, name: agentDir };
    const sessionsDir = path.join(AGENTS_DIR, agentDir, 'sessions');
    const sessionsJsonPath = path.join(sessionsDir, 'sessions.json');

    // Load session metadata (channel names etc.)
    let sessionMeta = {};
    try {
      const raw = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
      // Build map from sessionId → metadata
      for (const [sessionKey, meta] of Object.entries(raw)) {
        if (meta.sessionId) {
          sessionMeta[meta.sessionId] = {
            sessionKey,
            channel: meta.channel || 'unknown',
            channelName: meta.groupChannel || meta.displayName || sessionKey,
            displayName: meta.displayName || sessionKey,
          };
        }
      }
    } catch {}

    // Scan all .jsonl files in this agent's sessions directory
    let jsonlFiles;
    try {
      jsonlFiles = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => path.join(sessionsDir, f));
    } catch { continue; }

    for (const filePath of jsonlFiles) {
      const sessionId = path.basename(filePath, '.jsonl');
      const meta = sessionMeta[sessionId] || {
        sessionKey: `${agentDir}:${sessionId}`,
        channel: 'unknown',
        channelName: 'unknown',
        displayName: sessionId,
      };

      const offset = state.fileOffsets[filePath] || 0;
      const { lines, newOffset } = readNewLines(filePath, offset);
      state.fileOffsets[filePath] = newOffset;

      for (const line of lines) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }

        if (entry.type !== 'message') continue;
        const msg = entry.message || {};
        const role = msg.role;
        const content = msg.content || [];
        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();

        if (role === 'user') {
          // Incoming message from user
          const preview = getContentPreview(content);
          // Skip empty, system-only, or very short noise
          if (!preview || preview.length < 3) continue;
          // Skip internal system events (compaction summaries etc.)
          if (preview.startsWith('[System') || preview.startsWith('Conversation info')) continue;

          newEvents.push({
            id: `evt-${entry.id || nanoid()}`,
            type: 'message_received',
            agentId: agent.id,
            message: `${agent.name} ← ${meta.channelName}: "${preview.slice(0, 80)}"`,
            timestamp: ts,
            detail: {
              channel: meta.channel,
              channelName: meta.channelName,
              sessionKey: meta.sessionKey,
              content: typeof content === 'string' ? content : getContentPreview(content),
              role: 'user',
            },
          });

        } else if (role === 'assistant') {
          const toolCalls = getToolCalls(content);
          const textPreview = getContentPreview(content);
          const model = msg.model || null;
          const tokens = msg.usage?.totalTokens || null;
          const cost = msg.usage?.cost?.total || null;

          if (toolCalls.length > 0) {
            // Tool call event — one event per distinct tool (avoid noise for many calls)
            const toolNames = [...new Set(toolCalls.map(t => t.name))].slice(0, 3).join(', ');
            newEvents.push({
              id: `evt-${entry.id || nanoid()}-tools`,
              type: 'tool_call',
              agentId: agent.id,
              message: `${agent.name} → ${toolNames}`,
              timestamp: ts,
              detail: {
                channel: meta.channel,
                channelName: meta.channelName,
                sessionKey: meta.sessionKey,
                tools: toolCalls,
                model,
                tokens,
                cost,
              },
            });
          }

          if (textPreview && textPreview.length > 5) {
            // Skip pure heartbeat acks
            if (textPreview === 'HEARTBEAT_OK' || textPreview === 'NO_REPLY') continue;

            newEvents.push({
              id: `evt-${entry.id || nanoid()}-reply`,
              type: 'agent_response',
              agentId: agent.id,
              message: `${agent.name}: "${textPreview.slice(0, 80)}"`,
              timestamp: ts,
              detail: {
                channel: meta.channel,
                channelName: meta.channelName,
                sessionKey: meta.sessionKey,
                content: textPreview,
                model,
                tokens,
                cost,
              },
            });
          }
        }
      }
    }
  }

  return newEvents;
}

// Main loop
async function main() {
  console.log('[Watcher] Starting — monitoring /home/node/.openclaw/agents/*/sessions/');
  let state = loadState();

  // On first run, set all offsets to current end-of-file (don't re-emit history)
  if (Object.keys(state.fileOffsets).length === 0) {
    console.log('[Watcher] First run — skipping historical events, watching for new ones only');
    try {
      const agentDirs = fs.readdirSync(AGENTS_DIR);
      for (const agentDir of agentDirs) {
        const sessionsDir = path.join(AGENTS_DIR, agentDir, 'sessions');
        try {
          const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
          for (const f of files) {
            const fp = path.join(sessionsDir, f);
            try {
              state.fileOffsets[fp] = fs.statSync(fp).size;
            } catch {}
          }
        } catch {}
      }
    } catch {}
    saveState(state);
    console.log(`[Watcher] Initialized offsets for ${Object.keys(state.fileOffsets).length} session files`);
  }

  setInterval(async () => {
    try {
      const events = await scan(state);
      if (events.length > 0) {
        console.log(`[Watcher] Found ${events.length} new events`);
        postEvents(events);
      }
      saveState(state);
    } catch (err) {
      console.error('[Watcher] Scan error:', err.message);
    }
  }, POLL_INTERVAL);
}

main();
```

---

## Step 3: Update `/api/admin/session-sync` route

The current endpoint accepts `{ events }` array and inserts them. Update it in `server/routes/events.js` or wherever it lives to:
1. Accept events with the new format (`{ id, type, agentId, message, timestamp, detail }`)
2. Store `detail` as JSON
3. Emit via socket: `req.app.io.emit('event.new', { event: formattedEvent })`

---

## Step 4: Update frontend `EventItem` type in `src/lib/api.ts`

```ts
export type EventDetail = {
  channel?: string;
  channelName?: string;
  sessionKey?: string;
  content?: string;
  tools?: Array<{ name: string; inputKeys: string[] }>;
  toolName?: string;
  model?: string;
  tokens?: number;
  cost?: number;
  role?: string;
};

export type EventItem = {
  id: string;
  type: string;
  message: string;
  agentId: string | null;
  taskId: string | null;
  timestamp: number;
  detail?: EventDetail | null;
};
```

---

## Step 5: Update event cards + add Event Detail Modal in `src/App.tsx`

### Event type → icon mapping
```ts
const eventIcon: Record<string, string> = {
  message_received: '📨',
  agent_response:   '💬',
  tool_call:        '🔧',
  task_created:     '📋',
  task_updated:     '↕️',
  task_assigned:    '👤',
  comment_created:  '💬',
  session_started:  '🟢',
  default:          '⚡',
};
```

### Update event card rendering (in the right sidebar event feed)

Replace the current card with:
```tsx
<button
  key={event.id}
  type="button"
  onClick={() => setSelectedEvent(event)}
  data-testid="event-item"
  className={cn(
    "flex w-full gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:bg-muted/60",
    isNew && "animate-in slide-in-from-top-2 fade-in duration-300"
  )}
>
  <span className="text-base">{eventIcon[event.type] ?? eventIcon.default}</span>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <p className="text-sm font-semibold truncate">{agent?.name ?? 'System'}</p>
      {event.detail?.channelName && (
        <span className="text-[10px] text-muted-foreground font-mono truncate">
          {event.detail.channelName}
        </span>
      )}
    </div>
    <p className="text-xs text-muted-foreground truncate">{event.message}</p>
  </div>
  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
    {formatTime(event.timestamp)}
  </span>
</button>
```

### New Event Detail Modal: `src/components/EventDetailModal.tsx`

```tsx
import * as React from "react";
import type { EventItem } from "@/lib/api";

type Props = {
  event: EventItem | null;
  agentName?: string;
  open: boolean;
  onClose: () => void;
};

export function EventDetailModal({ event, agentName, open, onClose }: Props) {
  if (!open || !event) return null;

  const detail = event.detail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {event.type.replace(/_/g, ' ')}
            </p>
            <h3 className="text-lg font-semibold">{agentName ?? 'System'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Channel */}
          {detail?.channelName && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Channel</p>
              <p className="text-sm font-mono">{detail.channelName}</p>
            </div>
          )}

          {/* Content */}
          {detail?.content && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                {event.type === 'message_received' ? 'Message' : 'Response'}
              </p>
              <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {detail.content}
              </p>
            </div>
          )}

          {/* Tool calls */}
          {detail?.tools && detail.tools.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Tools Used</p>
              <div className="space-y-1.5">
                {detail.tools.map((tool, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                    <span className="text-sm">🔧</span>
                    <span className="text-sm font-mono font-semibold">{tool.name}</span>
                    {tool.inputKeys?.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({tool.inputKeys.join(', ')})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta row: model, tokens, cost */}
          {(detail?.model || detail?.tokens || detail?.cost) && (
            <div className="flex flex-wrap gap-3 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              {detail.model && (
                <span><span className="font-semibold">Model:</span> {detail.model.split('/').pop()}</span>
              )}
              {detail.tokens && (
                <span><span className="font-semibold">Tokens:</span> {detail.tokens.toLocaleString()}</span>
              )}
              {detail.cost && (
                <span><span className="font-semibold">Cost:</span> ${detail.cost.toFixed(4)}</span>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground font-mono">
            {new Date(event.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Wire into App.tsx
```tsx
import { EventDetailModal } from "@/components/EventDetailModal";

// State:
const [selectedEvent, setSelectedEvent] = React.useState<EventItem | null>(null);

// In JSX (after TaskEditModal):
<EventDetailModal
  open={!!selectedEvent}
  event={selectedEvent}
  agentName={selectedEvent?.agentId ? agentById[selectedEvent.agentId]?.name : undefined}
  onClose={() => setSelectedEvent(null)}
/>
```

---

## Step 6: Reset watcher state on deploy

Delete `/tmp/mc-watcher-state.json` when restarting so offsets reset fresh:
```bash
# In scripts/restart.sh, add before starting backend:
rm -f /tmp/mc-watcher-state.json
```

Actually — keep the state file so we don't spam old events on restart. Only delete it when you want a fresh start.

---

## Build & Deploy

```bash
cd ~/code/mission-control
pnpm build
bash scripts/restart.sh
git add -A
git commit -m "feat: rewrite live events from real OpenClaw session files + event detail modal"
GIT_SSH_COMMAND="ssh -i /home/node/.openclaw/workspace/.ssh/clawvin-bot -o StrictHostKeyChecking=no" git push origin master
```

## Done Criteria
- [ ] Watcher reads from `/home/node/.openclaw/agents/*/sessions/*.jsonl`
- [ ] Events appear in feed within 5 seconds of any agent activity
- [ ] Events show: agent name, channel name (#general, #patch-dev-work etc.), message preview
- [ ] Event type icons: 📨 received, 💬 response, 🔧 tool call
- [ ] Clicking an event opens detail modal with full content, tool names, model, tokens, cost
- [ ] HEARTBEAT_OK and NO_REPLY responses are filtered out
- [ ] Historical events not re-emitted on restart (offsets persisted)
