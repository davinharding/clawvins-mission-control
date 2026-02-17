#!/usr/bin/env node

/**
 * Session Sync Script
 * 
 * This script should be called periodically by an OpenClaw agent to push
 * session updates to Mission Control backend.
 * 
 * Usage (from agent context):
 *   1. Call sessions_list tool to get sessions
 *   2. Run: node scripts/sync-sessions.js '<JSON_SESSIONS>' '<ADMIN_SECRET>'
 * 
 * Or use the companion push-sessions.sh script.
 */

import http from 'node:http';

const sessions = process.argv[2] ? JSON.parse(process.argv[2]) : [];
const secret = process.argv[3] || process.env.ADMIN_SECRET || 'mc-dev-secret';

const data = JSON.stringify({
  sessions: sessions,
  secret: secret,
});

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/admin/session-sync',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      console.log(`✓ Synced ${sessions.length} sessions, generated ${result.eventsGenerated} events`);
    } else {
      console.error(`✗ Sync failed: ${res.statusCode} ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error(`✗ Request error: ${error.message}`);
  process.exit(1);
});

req.write(data);
req.end();
