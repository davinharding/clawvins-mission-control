import express from 'express';
import { generateToken } from '../auth.js';
import { getAgentById, createAgent } from '../db.js';
import { schemas, validateBody } from '../validation.js';
import { safeEqual } from '../lib/secrets.js';

const router = express.Router();

// Accounts are defined entirely by environment variables. An account whose
// password is not set is disabled; there are no built-in default passwords.
const USERS = {};
if (process.env.ADMIN_PASSWORD) {
  USERS[process.env.ADMIN_USERNAME || 'patch'] = {
    password: process.env.ADMIN_PASSWORD,
    user: { id: 'agent-patch', name: 'Patch', role: 'Dev' },
    isAgent: true,
  };
}
if (process.env.DAVIN_PASSWORD) {
  USERS[process.env.DAVIN_USERNAME || 'davin'] = {
    password: process.env.DAVIN_PASSWORD,
    user: { id: 'user-davin', name: 'Davin', role: 'Main' },
    isAgent: false,
  };
}
if (Object.keys(USERS).length === 0) {
  console.warn('[auth] No login accounts configured. Set DAVIN_PASSWORD and/or ADMIN_PASSWORD in .env.');
}

router.post('/login', validateBody(schemas.login), (req, res) => {
  const { username, password } = req.body;
  const entry = Object.hasOwn(USERS, username) ? USERS[username] : undefined;

  if (!entry || !safeEqual(password, entry.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Ensure agent exists in agents table if they're an agent
  if (entry.isAgent) {
    const existing = getAgentById(entry.user.id);
    if (!existing) {
      createAgent({
        id: entry.user.id,
        name: entry.user.name,
        role: entry.user.role,
        status: 'online',
        avatarColor: '#3b82f6',
      });
    }
  }

  const token = generateToken(entry.user);

  res.json({
    token,
    user: entry.user,
  });
});

export default router;
