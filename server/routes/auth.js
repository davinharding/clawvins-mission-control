import express from 'express';
import { generateToken } from '../auth.js';
import { getAgentById, createAgent } from '../db.js';
import { schemas, validateBody } from '../validation.js';

const router = express.Router();

const USERS = {
  [process.env.ADMIN_USERNAME || 'patch']: {
    password: process.env.ADMIN_PASSWORD || 'REDACTED',
    user: { id: 'agent-patch', name: 'Patch', role: 'Dev' },
    isAgent: true,
  },
  [process.env.DAVIN_USERNAME || 'davin']: {
    password: process.env.DAVIN_PASSWORD || 'REDACTED_PASSWORD',
    user: { id: 'user-davin', name: 'Davin', role: 'Main' },
    isAgent: false,
  },
};

router.post('/login', validateBody(schemas.login), (req, res) => {
  const { username, password } = req.body;
  // Make username lookup case-insensitive
  const entry = USERS[username.toLowerCase()];

  if (!entry || entry.password !== password) {
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
