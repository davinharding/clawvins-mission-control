# Mission Control

A self-hosted operations dashboard for AI agent tasks, sessions, and cost telemetry. Mission Control combines a real-time Kanban board with OpenClaw session ingest, task automation, and cost reporting in a single React + Express + SQLite stack.

![Stack](https://img.shields.io/badge/React_19-TypeScript-blue) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8) ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57)

---

## Highlights

### Task & Workflow Management
- Kanban board with five active statuses (backlog, todo, in-progress, testing, done).
- Drag-and-drop across columns plus drag-to-archive.
- Multi-select mode with bulk move, archive, and delete actions.
- Rich task editor: title, description, priority, status, tags, assignee, due date.
- Comments per task with linkification and a real-time activity stream.
- Archive panel with restore-to-status controls and auto-archive after 24 hours in done.

### Realtime Ops View
- Live event feed with detail modal (session channel, model, tokens, cost, tool calls).
- Notification tray for unread events.
- Connection status indicator with reconnect states (Socket.io).

### Search & Navigation
- Global search across tasks and comments (Cmd/Ctrl+K).
- Results grouped by status with quick jump to task.

### Agent + OpenClaw Integration
- Agent sync from OpenClaw gateway on startup and every 5 minutes.
- Session watcher reads OpenClaw jsonl logs and posts session events to Mission Control.
- Task assignment webhook notifies agents via active OpenClaw session or channel.

### Cost Reporting
- Cost dashboard with hourly/daily/weekly/monthly rollups.
- Provider and agent breakdowns, with Anthropic usage tracked separately.
- Optional OpenAI Usage API sync endpoint for backfilling usage data.

---

## Architecture

```
React UI (Vite)  <--REST/Socket.io-->  Express API  --> SQLite (better-sqlite3)
       |                                      |
       |                                      +-- Auto-archive + agent sync
       |
       +-- Global search, bulk actions, cost dashboard

OpenClaw sessions -> scripts/watch-sessions.js -> /api/admin/session-sync
OpenClaw gateway  -> /api/admin/sync-agents (ADMIN_SECRET)
```

Key modules:
- Frontend: `src/App.tsx`, `src/components/*`, `src/lib/*`
- Backend: `server/index.js`, `server/routes/*`, `server/db.js`
- Session ingest: `scripts/watch-sessions.js`, `server/session-monitor.js`

---

## Getting Started

### Prerequisites
- Node.js 18+
- SQLite (via `better-sqlite3`)

### Install

```bash
npm install
cp .env.example .env
```

### Environment Variables (required)
- `JWT_SECRET`: signing secret for auth tokens
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: admin login
- `DAVIN_USERNAME`, `DAVIN_PASSWORD`: secondary admin login
- `ADMIN_SECRET`: protects admin-only endpoints
- `AGENT_API_KEY`: shared key for agent API access
- `FRONTEND_URL`: used in webhook notifications (default http://localhost:3001)
- `VITE_API_URL`: backend API base for the frontend

### Optional Integrations
- OpenClaw gateway:
  - `OPENCLAW_GATEWAY_URL`
  - `OPENCLAW_GATEWAY_TOKEN`
  - `OPENCLAW_REQUEST_TIMEOUT_MS`
- OpenAI Usage API:
  - `OPENAI_API_KEY`
- Socket URL override:
  - `VITE_SOCKET_URL`

---

## Run Locally

### Development (recommended)

```bash
# Terminal 1 - backend with reload
npm run server:dev

# Terminal 2 - frontend
npm run dev
```

By default the Vite dev server runs on `http://localhost:3001/mission_control/`.
If the backend is on a different origin, set `VITE_API_URL=http://localhost:3002/api`.

### Full stack (seed + dev servers)

```bash
npm run fullstack
```

### Production Build

```bash
npm run build
npm run server
```

### Keep Alive (local process manager)

```bash
bash keep-alive.sh
```

Starts backend, Vite preview (port 3001), and the session watcher. Logs to `/tmp/mc-server.log`.

---

## API Overview

### Auth
```
POST /api/auth/login
```

### Tasks
```
GET    /api/tasks
GET    /api/tasks/archived
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments
```

### Agents & Events
```
GET    /api/agents
PATCH  /api/agents/:id
GET    /api/events
```

### Agent-Specific
```
GET    /api/agent-tasks/mine
GET    /api/agent-tasks/:taskId
PATCH  /api/agent-tasks/:taskId
PATCH  /api/agent-tasks/:taskId/status
POST   /api/agent-tasks/:taskId/comment
```

### Search
```
GET    /api/search?q=...
```

### Cost & Usage
```
GET    /api/costs?period=day&limit=30
GET    /api/openai-usage/sync?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
GET    /api/openai-usage/data
```

### Admin (requires ADMIN_SECRET)
```
POST   /api/admin/sync-agents
POST   /api/admin/session-sync
```

---

## Authentication

- JWT Bearer tokens for the UI and admin API.
- Agents can authenticate with `X-API-Key` or `X-Agent-Key`.
- Optional agent identity headers: `X-Agent-Id`, `X-Agent-Name`.

---

## Project Structure

```
src/
  App.tsx
  components/
  lib/
server/
  index.js
  db.js
  routes/
  socket.js
scripts/
  watch-sessions.js
```

---

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `master` | Production |
| `dev` | Integration branch |
| `feature/*` | Feature branches |

Never push directly to `master`.

---

Part of the Harding Labs toolchain.
