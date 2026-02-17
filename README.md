# Mission Control 🚀

A real-time task management dashboard for multi-agent coordination. Built with React, TypeScript, Express, and WebSockets.

## Overview

Mission Control provides a Kanban-style interface for managing tasks across multiple AI agents. Features include:

- **Real-time updates** via WebSocket (Socket.io)
- **Task management** with drag-and-drop across status columns (Backlog → To Do → In Progress → Done)
- **Agent coordination** with role-based filtering and status tracking
- **Activity feed** showing recent system events
- **JWT authentication** for secure API access
- **SQLite database** for persistent storage
- **Agent task integration** - Agents receive notifications and can manage tasks via API/commands

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Socket.io Client** for real-time updates
- **Vite** for fast development and building

### Backend
- **Express 5** REST API
- **Socket.io** for WebSocket real-time communication
- **better-sqlite3** for database
- **JWT** for authentication
- **Zod** for request validation
- **Morgan** for HTTP logging

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mission-control

# Install dependencies
npm install
```

### Setup Database

```bash
# Run the seed script to create database and populate with sample data
npm run seed
```

This creates:
- 4 sample agents (Patch, Nova, Scout, Atlas)
- 10 sample tasks across all statuses
- 10 sample events for the activity feed

### Environment Variables

Create a `.env` file in the root directory (or copy from `.env.example`):

```env
# Backend Configuration
PORT=3002
NODE_ENV=development
JWT_SECRET=your-secure-secret-here
ADMIN_USERNAME=patch
ADMIN_PASSWORD=your-secure-password
DATABASE_PATH=./data/mission-control.db
FRONTEND_URL=http://localhost:9000

# Frontend Configuration
VITE_ADMIN_USERNAME=patch
VITE_ADMIN_PASSWORD=your-secure-password
VITE_API_URL=/api
VITE_SOCKET_URL=http://localhost:3002

# OpenClaw Gateway (for agent notifications)
OPENCLAW_GATEWAY_URL=http://localhost:8080
OPENCLAW_GATEWAY_TOKEN=your-gateway-token-here
OPENCLAW_REQUEST_TIMEOUT_MS=8000
```

## Running the Application

### Development Mode

**Option 1: Run backend and frontend separately**

Terminal 1 (Backend):
```bash
npm run server:dev
```

Terminal 2 (Frontend):
```bash
npm run dev
```

**Option 2: Run both together**

```bash
npm run fullstack
```

This runs the seed script, then starts both backend and frontend in watch mode.

### Production Mode

```bash
# Build the frontend
npm run build

# Start the backend server
npm run server
```

The backend serves on port **3002** by default.  
The frontend dev server runs on the Vite default port (usually 5173).

## Project Structure

```
mission-control/
├── server/
│   ├── index.js          # Express server setup
│   ├── db.js             # SQLite database & queries
│   ├── auth.js           # JWT authentication middleware
│   ├── socket.js         # WebSocket event handlers
│   ├── validation.js     # Zod schemas for input validation
│   ├── seed.js           # Database seeding script
│   ├── lib/              # Helper libraries
│   │   ├── openclaw-client.js  # OpenClaw Gateway API client
│   │   ├── message-client.js   # Discord/Telegram messaging
│   │   └── task-command-parser.js # Parse task commands
│   ├── webhooks/         # Webhook handlers
│   │   └── task-assigned.js    # Task assignment notifications
│   └── routes/
│       ├── auth.js       # POST /api/auth/login
│       ├── tasks.js      # CRUD for tasks
│       ├── agents.js     # GET and PATCH agents
│       ├── events.js     # GET system events
│       └── agent-tasks.js # Agent task API
├── src/
│   ├── App.tsx           # Main React component
│   ├── lib/
│   │   ├── api.ts        # REST API client functions
│   │   ├── socket.ts     # WebSocket client setup
│   │   └── utils.ts      # Utility functions
│   └── components/       # React components
├── data/
│   └── mission-control.db # SQLite database (created by seed script)
├── docs/
│   └── AGENT_API.md      # API documentation for agents
├── test-agent-integration.js # Integration test script
├── AGENT_INTEGRATION.md  # Agent integration documentation
├── package.json
├── .env                  # Environment variables (create this)
└── README.md
```

## API Documentation

### Authentication

**POST** `/api/auth/login`  
Login with username and password to receive a JWT token.

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"patch","password":"your-password"}'
```

Response:
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "agent-patch",
    "name": "Patch",
    "role": "Dev"
  }
}
```

### Tasks

All task endpoints require authentication via `Authorization: Bearer <token>` header.

- **GET** `/api/tasks?status=<status>&agent=<agentId>` - Get all tasks (with optional filters)
- **POST** `/api/tasks` - Create a new task
- **PATCH** `/api/tasks/:id` - Update a task
- **DELETE** `/api/tasks/:id` - Delete a task

### Agents

- **GET** `/api/agents` - Get all agents
- **PATCH** `/api/agents/:id` - Update agent (name, role, status, avatarColor)

### Events

- **GET** `/api/events?limit=<n>&since=<timestamp>` - Get recent events

### Agent Task API

Agents can query and manage their tasks using simplified endpoints:

- **GET** `/api/agent-tasks/mine` - Get all tasks assigned to agent
- **GET** `/api/agent-tasks/:taskId` - Get task details
- **PATCH** `/api/agent-tasks/:taskId/status` - Update task status
- **POST** `/api/agent-tasks/:taskId/comment` - Add comment to task
- **PATCH** `/api/agent-tasks/:taskId` - Full task update

For detailed API documentation, see [docs/AGENT_API.md](docs/AGENT_API.md) and [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md).

## Agent Task Integration

When a task is assigned to an agent in Mission Control, the system automatically:
1. **Notifies the agent** via OpenClaw session or Discord/Telegram channel
2. **Provides task details** with priority, status, and description
3. **Suggests actions** the agent can take

Agents can respond with natural language commands:
```
task show task-abc123       # View task details
task start task-abc123      # Start working (→ in-progress)
task complete task-abc123   # Mark as done
task status task-abc123 in-progress  # Update status
task comment task-abc123 Made progress on feature  # Add comment
```

Or use the Agent Task API endpoints directly. See [AGENT_INTEGRATION.md](AGENT_INTEGRATION.md) for complete documentation.

### Testing Agent Integration

Run the integration test script:
```bash
node test-agent-integration.js
```

This will:
- Create a test task
- Assign it to Patch (agent-patch)
- Verify Discord notification is sent
- Test all agent API endpoints
- Update task status and add comments
- Verify real-time WebSocket updates

## WebSocket Events

The server emits real-time events when data changes:

- `task.created` - New task created
- `task.updated` - Task modified (including agent task updates)
- `task.deleted` - Task removed
- `comment.created` - Comment added to task
- `agent.status_changed` - Agent status updated
- `event.new` - New system event logged

Clients receive these events automatically when connected via Socket.io with a valid JWT token.

## Database Schema

### Tasks
- `id` (TEXT, primary key)
- `title` (TEXT, required)
- `description` (TEXT, nullable)
- `status` (TEXT: backlog | todo | in-progress | done)
- `assigned_agent` (TEXT, nullable)
- `priority` (TEXT: low | medium | high | critical, nullable)
- `created_at` (INTEGER, timestamp)
- `updated_at` (INTEGER, timestamp)
- `created_by` (TEXT, nullable)
- `tags` (TEXT, JSON array)

### Agents
- `id` (TEXT, primary key)
- `name` (TEXT, required)
- `role` (TEXT: Main | Dev | Research | Ops)
- `status` (TEXT: online | offline | busy)
- `last_active` (INTEGER, timestamp)
- `avatar_color` (TEXT, hex color, nullable)

### Events
- `id` (TEXT, primary key)
- `type` (TEXT, required)
- `message` (TEXT, required)
- `agent_id` (TEXT, nullable)
- `task_id` (TEXT, nullable)
- `timestamp` (INTEGER)

## Scripts

```bash
npm run dev          # Start Vite dev server (frontend)
npm run build        # Build frontend for production
npm run server       # Start backend server
npm run server:dev   # Start backend with --watch (auto-restart)
npm run seed         # Populate database with sample data
npm run fullstack    # Seed + run both backend and frontend
npm run lint         # Run ESLint
```

## Port Configuration

- **Backend API**: Port 3002 (configurable via `PORT` env var)
- **WebSocket**: Same as backend (3002)
- **Frontend Dev**: Vite default (usually 5173)

For production, you may need to configure reverse proxy (e.g., nginx) to serve both backend and frontend on the same domain.

## Authentication

The MVP uses a simple hardcoded admin user (configured via environment variables). In production, you would:

1. Add a users table to the database
2. Hash passwords with bcrypt
3. Implement user registration
4. Store JWT tokens in database for revocation

Current login credentials (from `.env`):
- Username: `patch` (or value of `ADMIN_USERNAME`)
- Password: Set via `ADMIN_PASSWORD` env variable

## Troubleshooting

### Server won't start (EADDRINUSE)
Port 3002 is already in use. Kill the existing process:
```bash
lsof -ti:3002 | xargs kill -9
```

### Database locked error
SQLite is in WAL mode for better concurrency. If you see lock errors, ensure only one server instance is running.

### WebSocket connection refused
Make sure `VITE_SOCKET_URL` in `.env` matches the backend URL (default: `http://localhost:3002`).

### Build errors
Ensure all dependencies are installed:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Workflow

1. **Start with seed data**: `npm run seed`
2. **Run in dev mode**: `npm run fullstack` (or backend + frontend separately)
3. **Login** at the frontend URL with credentials from `.env`
4. **Create/update tasks** via UI - changes are real-time across all clients
5. **Monitor logs** in the backend terminal for request/WebSocket activity

## Agent API Key Authentication

Agents can update tasks autonomously using a shared API key (no JWT required).

### Setup

Add to `.env`:
```
AGENT_API_KEY=REDACTED_AGENT_KEY
```

### Usage

Include `x-api-key` header with the agent key. Optionally identify the agent with `x-agent-name` and `x-agent-id`:

```bash
# Update task status to done
curl -X PATCH http://localhost:3002/api/tasks/{taskId} \
  -H "x-api-key: REDACTED_AGENT_KEY" \
  -H "x-agent-name: Patch" \
  -H "x-agent-id: agent-patch" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# Move task to in-progress
curl -X PATCH http://localhost:3002/api/tasks/{taskId} \
  -H "x-api-key: REDACTED_AGENT_KEY" \
  -H "x-agent-name: Nova" \
  -H "x-agent-id: agent-nova" \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'

# Create a new task
curl -X POST http://localhost:3002/api/tasks \
  -H "x-api-key: REDACTED_AGENT_KEY" \
  -H "x-agent-name: Patch" \
  -H "x-agent-id: agent-patch" \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement feature X", "status": "todo", "priority": "high"}'

# Add a comment to a task
curl -X POST http://localhost:3002/api/tasks/{taskId}/comments \
  -H "x-api-key: REDACTED_AGENT_KEY" \
  -H "x-agent-name: Patch" \
  -H "x-agent-id: agent-patch" \
  -H "Content-Type: application/json" \
  -d '{"text": "Working on this now. ETA 30 minutes."}'
```

## Contributing

1. Make changes in a feature branch
2. Test all API endpoints
3. Ensure frontend build succeeds: `npm run build`
4. Run linter: `npm run lint`
5. Submit a pull request

## License

MIT

## Credits

Built with ❤️ for multi-agent task coordination.
