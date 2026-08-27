# Mission Control dispatcher

The versioned dispatcher lives in `dispatcher/`. The runtime copy is normally
installed at `/home/node/.openclaw/workspace/.dispatcher/dispatch.mjs`, with
`core.mjs` beside it. `routing.json`, `state.json`, and `heartbeat` remain
runtime-owned files and are not committed.

## Eligibility and blocked work

Dispatch is evidence-driven, not cooldown-driven. A task/status handoff is
recorded with a fingerprint of its status, assignee, update timestamp, tags,
and (for stale work) latest comment. The same evidence is never handed off
twice, including after 30 minutes or a dispatcher restart.

For supported on-hold behavior, use one of these forms:

- Move non-active work to `backlog`.
- Add a `blocked`, `on-hold`, `on_hold`, or `waiting-external` tag.
- Leave the task `in-progress` and add an assignee comment beginning with a
  clear blocker such as `Blocked:` or `On hold:`.

An unchanged blocker leaves dispatch eligibility. Stale work becomes eligible
again only when the task fields change, a newer comment supplies evidence, or
an operator explicitly moves/reassigns it. Pending cron jobs are checked by
task ID, so a `todo` wake and an `in-progress-stale` wake cannot overlap.

## Authentication

The dispatcher never reads `.env` and never parses `AGENT_API_KEYS`. It calls
the existing auth-safe helper instead:

```json
{
  "mcHelperPath": "/home/node/.openclaw/bin/mc-tasks",
  "mcHelperAgentId": "agent-patch"
}
```

Those values are optional; the paths above are the defaults. A replacement
helper must support `HELPER AGENT_ID GET /api/path` and print one JSON response.

## Test and install

```bash
pnpm exec vitest run server/__tests__/dispatcher.test.mjs
node --check dispatcher/dispatch.mjs
node --check dispatcher/core.mjs
```

Install atomically without touching runtime routing/state:

```bash
install -m 0644 dispatcher/core.mjs /home/node/.openclaw/workspace/.dispatcher/core.mjs.new
mv /home/node/.openclaw/workspace/.dispatcher/core.mjs.new /home/node/.openclaw/workspace/.dispatcher/core.mjs
install -m 0755 dispatcher/dispatch.mjs /home/node/.openclaw/workspace/.dispatcher/dispatch.mjs.new
mv /home/node/.openclaw/workspace/.dispatcher/dispatch.mjs.new /home/node/.openclaw/workspace/.dispatcher/dispatch.mjs
```

The supervisor must restart the dispatcher process to load the installed code.
Do not restart the OpenClaw gateway for this change.

## Rollback

Before installation, copy the two runtime files to timestamped `.rollback`
files in the same directory. To roll back, atomically move or install those
copies back to `core.mjs` and `dispatch.mjs`, then restart only the dispatcher
process. The v2 state file is backward-safe to retain; removing `state.json`
is not required and would discard durable dedupe history.
