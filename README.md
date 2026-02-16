# Mission Control

Real-time task management for OpenClaw agents with a Vite frontend and Express + SQLite backend.

## Requirements

- Node.js 22+
- SQLite (via better-sqlite3 native bindings)

## Setup

```bash
npm install
cp .env.example .env
```

Update `.env` with a strong `JWT_SECRET` and admin credentials.

## Run the backend

```bash
npm run server
```

Development mode (auto-reload):

```bash
npm run server:dev
```

Backend defaults to `http://localhost:3002`.

## Run the frontend

```bash
npm run dev
```

Frontend runs at `http://localhost:9000/mission_control`.

## Authentication

The frontend auto-logs in using `VITE_ADMIN_USERNAME` and `VITE_ADMIN_PASSWORD` from `.env`.
To fetch a token manually:

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"patch","password":"REDACTED"}'
```

## API Overview

- `POST /api/auth/login`
- `GET /api/tasks` / `POST /api/tasks`
- `PATCH /api/tasks/:id` / `DELETE /api/tasks/:id`
- `GET /api/agents` / `PATCH /api/agents/:id`
- `GET /api/events`
- `GET /health`

All endpoints except `/api/auth/login` require a Bearer token.

## Environment variables

Backend:
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DATABASE_PATH`
- `FRONTEND_URL`

Frontend (Vite):
- `VITE_ADMIN_USERNAME`
- `VITE_ADMIN_PASSWORD`
- `VITE_API_URL`
- `VITE_SOCKET_URL`

## Notes

- SQLite file is stored at `data/mission-control.db`.
- Socket.io broadcasts task and agent changes for real-time updates.
