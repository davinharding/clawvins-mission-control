#!/usr/bin/env node
/**
 * Pure Node.js session watcher - NO AGENT CALLS
 * 
 * Watches OpenClaw workspace dirs for session activity and pushes to backend
 * Uses file system monitoring, not sessions_list tool
 */

import fs from 'node:fs/promises';
import { accessSync } from 'node:fs';
import path from 'node:path';

const ALL_WATCH_DIRS = [
  '/home/node/.openclaw/workspace-coder',
  '/home/node/.openclaw/workspace',
  '/home/node/.openclaw/workspace-main',
  '/home/node/.openclaw/workspace-alpha',
  '/home/node/.openclaw/workspace-atlas',
  '/home/node/.openclaw/workspace-nova',
  '/home/node/.openclaw/workspace-scout',
  '/home/node/.openclaw/workspace-finance',
  '/home/node/.openclaw/workspace-health',
  '/home/node/.openclaw/workspace-iris',
];

// Only watch directories that actually exist
const WATCH_DIRS = ALL_WATCH_DIRS.filter(dir => {
  try { accessSync(dir); return true; } catch { return false; }
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002/api/admin/session-sync';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'REDACTED_SECRET';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000', 10);

const sessionCache = new Map(); // `${dir}:${file}` -> last mtime

async function scanDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    const sessions = [];

    for (const file of jsonlFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const stats = await fs.stat(filePath);
        const sessionKey = path.basename(file, '.jsonl');
        const cacheKey = `${dirPath}:${file}`;

        // Check if file was modified
        const lastMtime = sessionCache.get(cacheKey);
        if (!lastMtime || stats.mtimeMs > lastMtime) {
          console.log(`[Watcher] Detected change: ${file} in ${dirPath} (${new Date(stats.mtimeMs).toISOString()})`);
          sessionCache.set(cacheKey, stats.mtimeMs);

          // Read all lines to get session data
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n').filter(Boolean);

          if (lines.length > 0) {
            try {
              const lastLine = JSON.parse(lines[lines.length - 1]);
              const agent = extractAgent(sessionKey, lastLine);

              sessions.push({
                key: sessionKey,
                updatedAt: stats.mtimeMs,
                messages: lines.map(l => {
                  try { return JSON.parse(l); } catch { return null; }
                }).filter(Boolean),
                agent,
              });
              console.log(`[Watcher] Added session: ${sessionKey} (agent: ${agent}, ${lines.length} messages)`);
            } catch (err) {
              console.warn(`[Watcher] Failed to parse JSON in ${file}:`, err.message);
            }
          }
        }
      } catch (err) {
        console.warn(`[Watcher] Failed to read ${file}:`, err.message);
      }
    }

    return sessions;
  } catch (err) {
    console.warn(`[Watcher] Cannot scan ${dirPath}:`, err.message);
    return [];
  }
}

async function scanSessions() {
  try {
    console.log(`[Watcher] Scanning ${WATCH_DIRS.length} workspace dirs...`);

    const allSessions = [];
    for (const dir of WATCH_DIRS) {
      const sessions = await scanDirectory(dir);
      allSessions.push(...sessions);
    }

    if (allSessions.length > 0) {
      console.log(`[Watcher] Pushing ${allSessions.length} updated sessions to backend`);
      await pushSessions(allSessions);
    } else {
      console.log('[Watcher] No session changes detected');
    }
  } catch (err) {
    console.error('[Watcher] Scan error:', err.message);
  }
}

function extractAgent(sessionKey, lastMessage) {
  // Try to extract agent from session key
  // e.g. "agent:coder:discord:channel:123" -> "coder"
  if (sessionKey.includes('agent:')) {
    const parts = sessionKey.split(':');
    if (parts.length > 1) return parts[1];
  }
  return 'unknown';
}

async function pushSessions(sessions) {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions, secret: ADMIN_SECRET }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.eventsGenerated > 0) {
        console.log(`[Watcher] Pushed ${sessions.length} sessions, generated ${data.eventsGenerated} events`);
      }
    }
  } catch (err) {
    console.error('[Watcher] Push error:', err.message);
  }
}

// Start polling
console.log(`[Watcher] Starting session monitor (polling every ${POLL_INTERVAL}ms)`);
console.log(`[Watcher] Watching ${WATCH_DIRS.length} dirs: ${WATCH_DIRS.join(', ')}`);

// Initial scan
scanSessions();

// Poll every N seconds
setInterval(scanSessions, POLL_INTERVAL);
