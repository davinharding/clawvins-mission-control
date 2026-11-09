# SCROLL + LIVE EVENTS FIX SPEC

Work in `~/code/mission-control`. Fix exactly 2 things.

---

## FIX 1: Kanban Column Vertical Scroll

### Problem
Kanban columns don't scroll — when there are many tasks the column just overflows the page.

### Root Cause
The main 3-column layout grid (`grid h-full grid-cols-[240px_1fr_360px]`) uses `grid-auto-rows: auto` (the default). This means the single row's height = the tallest item's content height, not the grid container's defined height. Grid items grow with their content, ignoring `overflow-hidden`.

### Required Fix in `src/App.tsx`

**1. Add `grid-rows-1` to the main layout grid** (the outer `<div>` inside `<main>`):
```jsx
// BEFORE
<div className="grid h-full grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1fr_300px] lg:grid-cols-[240px_1fr_360px]">

// AFTER
<div className="grid h-full grid-rows-1 grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1fr_300px] lg:grid-cols-[240px_1fr_360px]">
```
`grid-rows-1` = `grid-template-rows: repeat(1, minmax(0, 1fr))` — forces the single row to fill the grid's defined height, constraining all columns.

**2. Add `min-h-0` to the left aside, center section, and right aside** (direct grid children need this to allow shrinking below content size):
```jsx
// LEFT ASIDE
<aside className="flex h-full min-h-0 flex-col gap-6 md:hidden lg:flex">

// CENTER SECTION
<section className="flex h-full min-h-0 flex-col overflow-hidden">

// RIGHT ASIDE
<aside className="flex h-full min-h-0 flex-col">
```

**3. Add `min-h-0` to the kanban columns grid** (inside center section):
```jsx
// BEFORE
<div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-4">

// AFTER
<div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
```

**4. Add `min-h-0` to each kanban column div**:
```jsx
// BEFORE
<div className="flex flex-col overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/40 p-3">

// AFTER
<div className="flex flex-col min-h-0 overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/40 p-3">
```

---

## FIX 2: Live Events Not Showing in Real-Time

### Problem
New events from the backend don't appear in the Live Feed in real-time — you have to manually click Refresh.

### Root Cause Analysis

Check these things in order:

**A. Frontend socket connection path:**
In `src/lib/socket.ts`, the socket connects to `window.location.origin` (port 9000). But the file server at port 9000 must proxy WebSocket connections to port 3002.

Check `server.js` (the file server at `/home/node/.openclaw/workspace/.fileserver/server.js`) — does it proxy WebSocket upgrades to port 3002? If not, Socket.io connections will fail silently.

**Fix for file server WebSocket proxy** (if missing):
The file server uses `http-proxy-middleware`. Ensure the `/socket.io` path is proxied with `ws: true`:
```js
// In /home/node/.openclaw/workspace/.fileserver/server.js
// Ensure this exists and has ws:true:
const wsProxy = createProxyMiddleware({
  target: 'http://localhost:3002',
  ws: true,
  changeOrigin: true,
});
app.use('/socket.io', wsProxy);
// AND the server must proxy the upgrade event:
server.on('upgrade', wsProxy.upgrade);
```

**B. Remove redundant `authenticate` emit from frontend:**
In `App.tsx`, the socket connect handler has:
```js
socket.on("connect", () => {
  socket.emit("authenticate", { token }); // REMOVE THIS LINE
});
```
The server already authenticates via the handshake middleware (`socket.handshake.auth.token`). This redundant emit is harmless but confusing. Remove it.

**C. Verify events are actually being emitted from the backend:**
In `server/routes/events.js` (or wherever events are created via POST), check that `req.app.io.emit('event.new', { event })` is called after each event is saved to DB.

Also check `server/session-monitor.js` — when it creates events during session sync, does it call `app.io.emit('event.new', ...)` or `req.app.io.emit(...)`? If it doesn't have access to `io`, events get saved to DB but never broadcast.

**Fix:** In `server/session-monitor.js`, make sure `io` is passed in and events are emitted:
```js
// When creating a new event in session-monitor.js, emit it:
if (app && app.io) {
  app.io.emit('event.new', { event: newEvent });
}
```

**D. Verify in browser console:**
After fixes, open http://localhost:9000/mission_control in browser. Check console for:
- `[WebSocket] Connected` — confirms socket connected
- `[WebSocket] Received event.new:` — confirms events are received

---

## Implementation Order

1. Fix `src/App.tsx` (CSS `min-h-0` + `grid-rows-1` changes)
2. Fix file server WebSocket proxy in `/home/node/.openclaw/workspace/.fileserver/server.js`
3. Remove `socket.emit("authenticate", ...)` from `App.tsx`
4. Verify `server/routes/events.js` and `server/session-monitor.js` emit events via `app.io`
5. Run `pnpm build` in `~/code/mission-control` to rebuild frontend
6. Restart servers: `bash scripts/restart.sh`
7. Test: open the page, check browser console for WebSocket connection, trigger a POST to `/api/admin/session-sync` and confirm a new event appears in the feed

## Build & Restart
```bash
cd ~/code/mission-control
pnpm build
bash scripts/restart.sh
```

## Done Criteria
- [ ] Kanban columns have internal scrollbars when tasks overflow
- [ ] New events appear instantly in the Live Feed without clicking Refresh
- [ ] Browser console shows `[WebSocket] Connected` and `[WebSocket] Received event.new:`
