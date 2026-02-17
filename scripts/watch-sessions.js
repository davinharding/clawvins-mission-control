#!/usr/bin/env node
/**
 * watch-sessions.js — Real OpenClaw session watcher
 *
 * Reads from /home/node/.openclaw/agents/{agent}/sessions/*.jsonl
 * Tracks byte offsets to only emit NEW lines (not historical).
 * Posts events to Mission Control backend via /api/admin/session-sync.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

const AGENTS_DIR = '/home/node/.openclaw/agents';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'REDACTED_SECRET';
const POLL_INTERVAL = 5000; // 5 seconds
const STATE_FILE = '/tmp/mc-watcher-state.json';

// Map agent directory names → Mission Control agent IDs and display names
const AGENT_MAP = {
  'coder':              { id: 'agent-patch',   name: 'Patch' },
  'clawvin':            { id: 'agent-clawvin', name: 'Clawvin' },
  'alpha':              { id: 'agent-alpha',   name: 'Alpha' },
  'finance':            { id: 'agent-ledger',  name: 'Ledger' },
  'health-tracking':    { id: 'agent-vitals',  name: 'Vitals' },
  'main':               { id: 'agent-clawvin', name: 'Clawvin' },
  'outreach':           { id: 'agent-iris',    name: 'Iris' },
  'nova':               { id: 'agent-nova',    name: 'Nova' },
  'scout':              { id: 'agent-scout',   name: 'Scout' },
  'atlas':              { id: 'agent-atlas',   name: 'Atlas' },
  'stagesnap-business': { id: 'agent-alpha',   name: 'Alpha' },
};

// ── State persistence ──────────────────────────────────────────────────────

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { fileOffsets: {} };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {}
}

// ── Content helpers ────────────────────────────────────────────────────────

function getContentPreview(content, maxLen = 200) {
  if (typeof content === 'string') return content.slice(0, maxLen);
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block.type === 'text' && block.text) return block.text.slice(0, maxLen);
  }
  return '';
}

function getToolCalls(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter(b => b.type === 'tool_use')
    .map(b => ({ name: b.name, inputKeys: Object.keys(b.input || {}) }));
}

// ── File reading ────────────────────────────────────────────────────────────

function readNewLines(filePath, offset) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size <= offset) return { lines: [], newOffset: offset };

    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(stat.size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);

    const lines = buf.toString('utf8').split('\n').filter(l => l.trim());
    return { lines, newOffset: stat.size };
  } catch {
    return { lines: [], newOffset: offset };
  }
}

// ── HTTP POST to backend ────────────────────────────────────────────────────

function postEvents(events) {
  if (!events.length) return;
  const body = JSON.stringify({ events });
  const req = http.request(
    {
      hostname: 'localhost',
      port: 3002,
      path: '/api/admin/session-sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-admin-secret': ADMIN_SECRET,
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        console.error(`[Watcher] session-sync returned ${res.statusCode}`);
      }
    }
  );
  req.on('error', (err) => console.error('[Watcher] POST error:', err.message));
  req.write(body);
  req.end();
}

// ── Session metadata loader ─────────────────────────────────────────────────

function loadSessionMeta(sessionsDir) {
  const sessionsJsonPath = path.join(sessionsDir, 'sessions.json');
  const meta = {};
  try {
    const raw = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
    for (const [sessionKey, m] of Object.entries(raw)) {
      if (m.sessionId) {
        meta[m.sessionId] = {
          sessionKey,
          channel: m.channel || 'unknown',
          channelName: m.groupChannel || m.displayName || sessionKey,
          displayName: m.displayName || sessionKey,
        };
      }
    }
  } catch {}
  return meta;
}

// ── Main scan ───────────────────────────────────────────────────────────────

function scan(state) {
  const newEvents = [];

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
    const sessionMeta = loadSessionMeta(sessionsDir);

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
        const entryId = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (role === 'user') {
          const preview = getContentPreview(content);
          if (!preview || preview.length < 3) continue;
          if (
            preview.startsWith('[System') ||
            preview.startsWith('Conversation info') ||
            preview === 'HEARTBEAT_OK' ||
            preview === 'NO_REPLY'
          ) continue;

          newEvents.push({
            id: `evt-${entryId}`,
            type: 'message_received',
            agentId: agent.id,
            message: `${agent.name} ← ${meta.channelName}: "${preview.slice(0, 80)}"`,
            timestamp: ts,
            detail: {
              channel: meta.channel,
              channelName: meta.channelName,
              sessionKey: meta.sessionKey,
              content: preview,
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
            const toolNames = [...new Set(toolCalls.map(t => t.name))].slice(0, 3).join(', ');
            newEvents.push({
              id: `evt-${entryId}-tools`,
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
            if (textPreview === 'HEARTBEAT_OK' || textPreview === 'NO_REPLY') continue;

            newEvents.push({
              id: `evt-${entryId}-reply`,
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

// ── Bootstrap ───────────────────────────────────────────────────────────────

function main() {
  console.log('[Watcher] Starting — monitoring /home/node/.openclaw/agents/*/sessions/');
  const state = loadState();

  // First run: set all offsets to current EOF so we don't re-emit history
  if (Object.keys(state.fileOffsets).length === 0) {
    console.log('[Watcher] First run — initializing offsets (skipping history)');
    try {
      const agentDirs = fs.readdirSync(AGENTS_DIR);
      for (const agentDir of agentDirs) {
        const sessionsDir = path.join(AGENTS_DIR, agentDir, 'sessions');
        try {
          const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
          for (const f of files) {
            const fp = path.join(sessionsDir, f);
            try { state.fileOffsets[fp] = fs.statSync(fp).size; } catch {}
          }
        } catch {}
      }
    } catch {}
    saveState(state);
    console.log(`[Watcher] Initialized ${Object.keys(state.fileOffsets).length} session file offsets`);
  }

  setInterval(() => {
    try {
      const events = scan(state);
      if (events.length > 0) {
        console.log(`[Watcher] ${events.length} new event(s)`);
        postEvents(events);
      }
      saveState(state);
    } catch (err) {
      console.error('[Watcher] Scan error:', err.message);
    }
  }, POLL_INTERVAL);
}

main();
