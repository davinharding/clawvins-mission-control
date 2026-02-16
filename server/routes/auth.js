import express from 'express';
import { generateToken } from '../auth.js';

const router = express.Router();

// Hardcoded user for MVP (would use database in production)
const ADMIN_USER = {
  id: 'agent-patch',
  name: 'Patch',
  role: 'Dev',
  username: process.env.ADMIN_USERNAME || 'patch',
  password: process.env.ADMIN_PASSWORD || 'dev-password',
};

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Simple credential check (MVP - would check database in production)
    if (username !== ADMIN_USER.username || password !== ADMIN_USER.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(ADMIN_USER);
    
    res.json({
      token,
      user: {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        role: ADMIN_USER.role,
      },
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
