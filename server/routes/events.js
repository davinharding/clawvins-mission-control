import express from 'express';
import { getRecentEvents, getEventsSince } from '../db.js';

const router = express.Router();

// GET /api/events
router.get('/', (req, res) => {
  try {
    const { limit = 50, since } = req.query;
    
    let events;
    if (since) {
      events = getEventsSince(parseInt(since, 10));
    } else {
      events = getRecentEvents(parseInt(limit, 10));
    }
    
    // Transform to camelCase for frontend
    const formatted = events.map(e => ({
      id: e.id,
      type: e.type,
      message: e.message,
      agentId: e.agent_id,
      taskId: e.task_id,
      timestamp: e.timestamp,
    }));
    
    res.json({ events: formatted });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
