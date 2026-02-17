# 🎯 Mission Control

A self-hosted operations dashboard for managing AI agent tasks, events, and workflows — built with React, TypeScript, and Tailwind CSS.

![Stack](https://img.shields.io/badge/React_19-TypeScript-blue) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8) ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57)

---

## ✨ Features

### Task Management
- **Kanban board** with 5 columns: Backlog → Todo → In Progress → Testing → Done
- **Drag-and-drop** reordering between columns (via `@dnd-kit`)
- **Task cards** with assignee emoji avatars, priority badges, and tag chips
- **Archive system** — archive completed tasks with a dedicated panel; auto-archives done tasks every 60 min
- **Full task editor** — title, description, priority, status, assigned agent, tags, due date

### Agent Sidebar
- **Agent list** with emoji avatars (🐾🔧🎯💪🔍📨✨📒🏋️) and color-coded categories
- **Category filter pills** — Main (blue), Dev (amber), Research (purple), Ops (emerald)
- **Status indicators** — online/offline/busy with live dot
- **Clickable links** in comments and event descriptions (`LinkifiedText` component)

### Comments & Activity
- Per-task comment threads
- Real-time event feed (agent status changes, task updates, system events)
- Event detail modal with full context
- Notification tray for unread events

### Collaboration
- **WebSocket** push updates — board reflects changes from any connected agent in real time
- Agent API — authenticated REST endpoints for agents to create/update tasks and post comments

---

## 🛠 Stack

### Frontend
| Layer | Tech |
|-------|------|
| UI Framework | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 3 |
| Components | Radix UI + shadcn/ui primitives |
| Icons | Lucide React |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| HTTP | Axios |

### Backend
| Layer | Tech |
|-------|------|
| Server | Express.js |
| Database | SQLite (`better-sqlite3`) |
| Auth | JWT (access + refresh tokens) |
| Real-time | WebSocket (`ws`) |
| Process mgmt | `keep-alive.sh` shell wrapper |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- `.env` file (see `.env.example`)

### Setup

```bash
npm install
cp .env.example .env
# Fill in JWT_SECRET, ADMIN_SECRET, AGENT_API_KEY
```

### Development

```bash
# Terminal 1 — backend
node server/index.js

# Terminal 2 — frontend
npm run dev
```

Backend: `http://localhost:3002`  
Frontend: `http://localhost:5173` (proxies API to backend)

### Production Build

```bash
npm run build
node server/index.js
```

Serves the built SPA + API from port `3002`.

### Keeping it Running

```bash
bash keep-alive.sh
```

Auto-restarts the server on crash. Logs to `/tmp/mc-server.log`.

---

## 📁 Project Structure

```
src/
├── App.tsx                  # Main shell, board, sidebar, event feed
├── components/
│   ├── KanbanColumn.tsx     # Board column with droppable zone
│   ├── DraggableCard.tsx    # Task card (drag source)
│   ├── TaskEditModal.tsx    # Full task editor modal
│   ├── CommentsSection.tsx  # Per-task comment thread
│   ├── CommentItem.tsx      # Individual comment with linkification
│   ├── ArchivePanel.tsx     # Archived tasks panel (droppable)
│   ├── EventDetailModal.tsx # Event detail overlay
│   ├── NotificationTray.tsx # Unread event notifications
│   ├── ConnectionStatus.tsx # WebSocket connection indicator
│   ├── LinkifiedText.tsx    # Auto-links URLs in text
│   └── ui/                  # Radix/shadcn primitives
├── lib/
│   └── utils.ts
└── main.tsx

server/
├── index.js                 # Express + WebSocket server
├── db.js                    # SQLite setup + migrations
├── auth.js                  # JWT middleware
└── routes/
    ├── tasks.js
    ├── agents.js
    ├── comments.js
    └── events.js
```

---

## 🔐 Authentication

| Role | How |
|------|-----|
| Admin (Davin) | Username + password → JWT |
| Agents | `AGENT_API_KEY` header |

Default admin: `davin` / set via `ADMIN_SECRET` in `.env`

---

## 📋 Task Statuses

| Status | Column | Color |
|--------|--------|-------|
| `backlog` | 📋 Backlog | Slate |
| `todo` | 🎯 Todo | Sky |
| `in-progress` | ⚡ In Progress | Violet |
| `testing` | 🧪 Testing | Amber |
| `done` | ✅ Done | Emerald |

---

## 🤖 Agent API

Agents authenticate with `X-Agent-API-Key: <AGENT_API_KEY>` and can:

```
GET    /api/tasks                    # List tasks (filter by status, assignedAgent)
POST   /api/tasks                    # Create task
PATCH  /api/tasks/:id               # Update task (status, assignedAgent, etc.)
GET    /api/tasks/:id/comments       # Get comments
POST   /api/tasks/:id/comments       # Add comment
GET    /api/agents                   # List agents
PATCH  /api/agents/:id/status        # Update agent status
POST   /api/events                   # Emit event
```

---

## 🌿 Git Workflow

| Branch | Purpose |
|--------|---------|
| `master` | Production |
| `dev` | Integration branch — all features merge here first |
| `feature/*` | Feature branches → PR → `dev` |

**Never push directly to `master`.**

---

*Part of the [Harding Labs](https://github.com/davinharding) toolchain.*
