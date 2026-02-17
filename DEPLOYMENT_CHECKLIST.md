# Agent Task Integration - Deployment Checklist

## Pre-Deployment

- [x] Code implementation complete
- [x] All files created and tested
- [x] Server starts without errors
- [x] API endpoints functional
- [x] Documentation written

## Configuration

- [ ] Set `OPENCLAW_GATEWAY_TOKEN` in `.env`
- [ ] Verify `OPENCLAW_GATEWAY_URL=http://localhost:8080`
- [ ] Update agent channel mappings in `server/lib/message-client.js`:
  - [x] agent-patch → #patch-dev-work (1469764170906865706)
  - [x] agent-clawvin → #clawvin-admin-config (1469764199470206996)
  - [ ] agent-alpha → (add Discord channel ID)
  - [ ] agent-nova → (add Discord channel ID)
  - [ ] agent-scout → (add Discord channel ID)
  - [ ] agent-vitals → (add Discord channel ID)
  - [ ] agent-atlas → (add Discord channel ID)
  - [ ] agent-iris → (add Discord channel ID)
  - [ ] agent-ledger → (add Discord channel ID)

## Testing

Run automated test:
```bash
node test-agent-integration.js
```

Manual tests:
- [ ] Create task in UI
- [ ] Assign to Patch
- [ ] Verify Discord notification in #patch-dev-work
- [ ] Test `GET /api/agent-tasks/mine`
- [ ] Test `PATCH /api/agent-tasks/:id/status`
- [ ] Test `POST /api/agent-tasks/:id/comment`
- [ ] Verify Mission Control UI updates in real-time

## Gateway Integration

- [ ] Start OpenClaw Gateway: `openclaw gateway start`
- [ ] Verify Gateway accessible at http://localhost:8080
- [ ] Test session notification (agent with active session)
- [ ] Test channel notification (agent without session)
- [ ] Verify webhook logs show successful sends

## Agent Documentation

Update each agent's AGENTS.md with:
```markdown
## Mission Control Tasks

When tasks are assigned, you'll receive a notification.

### Task Commands
- `task show <taskId>` - View details
- `task start <taskId>` - Start work (→ in-progress)
- `task complete <taskId>` - Mark as done
- `task status <taskId> <status>` - Update status
- `task comment <taskId> <message>` - Add comment

### Task API
GET /api/agent-tasks/mine - Get your tasks
PATCH /api/agent-tasks/:id/status - Update status
POST /api/agent-tasks/:id/comment - Add comment

Auth token in req.user from OpenClaw session context.
```

- [ ] Update AGENTS.md for Patch (coder)
- [ ] Update AGENTS.md for Clawvin
- [ ] Update AGENTS.md for other agents

## Monitoring

After deployment, monitor:
- [ ] Server logs for webhook errors
- [ ] OpenClaw Gateway logs
- [ ] Discord for notification delivery
- [ ] Mission Control UI for real-time updates
- [ ] Database for task/comment/event creation

## Rollback Plan

If issues occur:
1. Comment out webhook call in `server/routes/tasks.js` line ~67
2. Restart server
3. Agent task API still works, just no notifications

## Success Criteria

- [ ] Agents receive notifications when assigned
- [ ] Agents can query tasks via API
- [ ] Agents can update status via API
- [ ] Agents can add comments via API
- [ ] Mission Control updates in real-time
- [ ] No errors in server logs

## Post-Deployment

- [ ] Document any issues encountered
- [ ] Update agent channel mappings if needed
- [ ] Monitor notification success rate
- [ ] Gather agent feedback on UX

## Notes

**Current Status:** Implementation complete, ready for Gateway integration

**Documentation:**
- AGENT_INTEGRATION.md - Complete integration guide
- IMPLEMENTATION_SUMMARY.md - Implementation details
- README.md - Updated with agent integration section

**Test Command:**
```bash
npm run server:dev  # Start server
node test-agent-integration.js  # Run tests
```
