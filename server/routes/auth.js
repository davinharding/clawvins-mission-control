import express from 'express';
import { generateToken } from '../auth.js';
import { getAgentById, createAgent } from '../db.js';
import { schemas, validateBody } from '../validation.js';

const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'patch';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'REDACTED';

const DEFAULT_USER = {
  id: 'agent-patch',
  name: 'Patch',
  role: 'Dev',
};

router.post('/login', validateBody(schemas.login), (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const existing = getAgentById(DEFAULT_USER.id);
  if (!existing) {
    createAgent({
      id: DEFAULT_USER.id,
      name: DEFAULT_USER.name,
      role: DEFAULT_USER.role,
      status: 'online',
      avatarColor: '#3b82f6',
    });
  }

  const token = generateToken(DEFAULT_USER);

  res.json({
    token,
    user: DEFAULT_USER,
  });
});

export default router;
