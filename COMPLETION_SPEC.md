# Mission Control Backend - Completion Tasks

## What's Done (Phases 1-4)
✅ Phase 1: Database + REST API (SQLite, Express, JWT)
✅ Phase 2: WebSocket real-time updates (Socket.io)
✅ Phase 3: Frontend integration (API client, Socket.io client)
✅ Phase 4: Agent API documentation

## What Remains: Phase 5 + Testing

### Task 1: Fix Any ESM Import Issues
The server files use ESM imports. Make sure all imports are correct:
- Check `server/index.js` imports everything correctly
- Check `server/db.js` has proper `__dirname` equivalent for ESM
- Check `server/socket.js` exports correctly
- Ensure all route files export default properly

### Task 2: Add Input Validation
Currently missing validation. Add Zod schemas for:
- `POST /api/tasks` - validate title (required), status, priority
- `PATCH /api/tasks/:id` - validate at least one field present
- `POST /api/auth/login` - validate username and password present
- `PATCH /api/agents/:id` - validate status if provided

Create `server/schemas.js` with Zod schemas and use them in routes.

### Task 3: Add Seed Data
Create `server/seed.js` that populates the database with:
- 3-4 agents (Patch, Nova, Scout, Atlas) with roles and colors
- 8-10 sample tasks across all statuses
- 5-10 sample events

Make it idempotent (safe to run multiple times).

### Task 4: Add npm Scripts
Update `package.json` with:
- `"server": "node server/index.js"`
- `"server:dev": "node --watch server/index.js"`
- `"seed": "node server/seed.js"`
- `"fullstack": "npm run seed && concurrently \"npm run server:dev\" \"npm run dev\"`

Install `concurrently` if adding fullstack script.

### Task 5: Test Server Startup
1. Create `.env` file with defaults (copy from `.env.example`)
2. Run `npm run seed` to populate database
3. Start server: `npm run server`
4. Verify:
   - Server starts on port 3002
   - Health check works: `curl http://localhost:3002/health`
   - Database file created: `data/mission-control.db`
   - Login works: `curl -X POST http://localhost:3002/api/auth/login -H "Content-Type: application/json" -d '{"username":"patch","password":"patch123"}'`
   - Get tasks works (with auth token from login)

### Task 6: Update Frontend to Use Real API
The frontend was integrated but needs verification:
- Check `src/lib/api.ts` exists and has correct functions
- Check `src/lib/socket.ts` exists and connects properly
- Check `src/App.tsx` was updated to use API instead of mock data
- Verify WebSocket events are handled (task.created, task.updated, etc.)

### Task 7: Test Full Stack
1. Start backend: `npm run server` (in one terminal/background)
2. Ensure frontend build is current: `npm run build`
3. Access http://localhost:9000/mission_control
4. Login (if needed)
5. Verify:
   - Tasks load from database
   - Creating a task works
   - Moving a task updates status
   - Real-time updates work (open two browser tabs)

### Task 8: Add Logging
Add basic logging to `server/index.js`:
- Log all requests: `app.use(morgan('dev'))`
- Log server startup with timestamp
- Log WebSocket connections/disconnections
- Log errors with stack traces

Install `morgan` if needed.

### Task 9: Create README
Create `README.md` with:
- Project overview
- Setup instructions (install deps, run seed, start server)
- API documentation (link to `docs/AGENT_API.md`)
- Frontend development (how to run full stack)
- Environment variables
- Port configuration (3002 for backend, 9000 for frontend via file server)

### Task 10: Commit and Report
After all tasks complete:
1. Run `git add -A`
2. Commit: `git commit -m "feat: phase 5 - production polish, validation, seed data, testing"`
3. Report summary of what was completed

## Expected Outcome
✅ Server starts without errors
✅ Database seeded with sample data
✅ All API endpoints work
✅ Frontend connects to backend
✅ Real-time updates work
✅ Input validation in place
✅ Logging configured
✅ README documentation complete

## Working Directory
`/home/node/code/mission-control`

## Time Estimate
30-45 minutes

## Notes
- Do NOT modify `vite.config.ts` (already configured)
- Do NOT push to git (local only)
- Backend runs on port 3002
- Frontend served via file server on port 9000 at `/mission_control` route
