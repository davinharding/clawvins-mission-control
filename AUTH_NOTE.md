# ⚠️ Mission Control Authentication — READ BEFORE CHANGING

## How Auth Works
Mission Control reads credentials from `/home/node/.openclaw/code/mission-control/.env`.
OpenClaw agents read credentials from container env vars `MC_USER` and `MC_PASS`.

## Critical Rule
**These MUST stay in sync.** If you change one, change the other.

- `MC_USER` / `MC_PASS` → set in `docker-compose.override.yml` → passed into container
- `DAVIN_USERNAME` / `DAVIN_PASSWORD` → set in `.env` in this directory → read by MC server

If they don't match, every agent (Patch, Scout, Vitals, etc.) loses the ability to
check Mission Control for tasks, breaking the entire task pipeline.

## What Broke (March 2026)
The host agent changed the container env vars but didn't update MC's `.env` file.
Result: all agents got "Invalid credentials" for ~24 hours. Nightly improver created
tasks but Patch couldn't see them.

## If You Need to Rotate Credentials
1. Update `docker-compose.override.yml` with new password
2. Update `/home/node/.openclaw/code/mission-control/.env` with same password
3. Restart MC server (`kill` the `node server/index.js` process, keep-alive restarts it)
4. Restart OpenClaw gateway to pick up new env vars
