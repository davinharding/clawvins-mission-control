#!/usr/bin/env node
/**
 * Pure Node.js session watcher - NO AGENT CALLS
 * 
 * Watches OpenClaw workspace for session activity and pushes to backend
 * Uses file system monitoring, not sessions_list tool
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { watch } from 'node:fs';

const WORKSPACE_DIR = '/home/node/.openclaw/workspace-coder';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002/api/admin/session-sync';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'REDACTED_SECRET';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000', 10);

const sessionCache = new Map(); // file -> last mtime

async function scanSessions() {
  try {
    const files = await fs.readdir(WORKSPACE_DIR);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    const sessions = [];
    
    for (const file of jsonlFiles) {
      const filePath = path.join(WORKSPACE_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        const sessionKey = path.basename(file, '.jsonl');
        
        // Check if file was modified
        const lastMtime = sessionCache.get(file);
        if (!lastMtime || stats.mtimeMs > lastMtime) {
          sessionCache.set(file, stats.mtimeMs);
          
          // Read last few lines to get agent info
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
            } catch (err) {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        // Skip files we can't read
      }
    }
    
    if (sessions.length > 0) {
      await pushSessions(sessions);
    }
  } catch (err) {
    console.error('[Watcher] Scan error:', err.message);
  }
}

function extractAgent(sessionKey, lastMessage) {
  // Try to extract agent from session key or message
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
console.log(`[Watcher] Watching: ${WORKSPACE_DIR}`);

// Initial scan
scanSessions();

// Poll every N seconds
setInterval(scanSessions, POLL_INTERVAL);
