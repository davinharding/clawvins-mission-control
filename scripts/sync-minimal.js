#!/usr/bin/env node
/**
 * Minimal session sync - designed to run from OpenClaw cron
 * Uses sessions_list and immediately POSTs to backend
 * No separate processes, minimal overhead
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002/api/admin/session-sync';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'REDACTED_SECRET';

// This will be called with sessions JSON as first arg
const sessionsData = process.argv[2];

if (!sessionsData) {
  console.error('Usage: sync-minimal.js <sessions_json>');
  process.exit(1);
}

const sessions = JSON.parse(sessionsData);

fetch(BACKEND_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessions, secret: ADMIN_SECRET }),
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    // Silent success - no output needed
    process.exit(0);
  } else {
    console.error('Sync failed:', data);
    process.exit(1);
  }
})
.catch(err => {
  console.error('Sync error:', err.message);
  process.exit(1);
});
