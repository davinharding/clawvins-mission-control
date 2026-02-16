import express from 'express';
import { getRecentEvents, getEventsSince } from '../db.js';
import { schemas, validateQuery } from '../validation.js';

const router = express.Router();

const formatEvent = (event) => ({
  id: event.id,
  type: event.type,
  message: event.message,
  agentId: event.agent_id,
  taskId: event.task_id,
  timestamp: event.timestamp,
});

router.get('/', validateQuery(schemas.eventsQuery), (req, res) => {
  try {
    const limit = req.query.limit ?? 50;
    const since = req.query.since ?? null;

    const events = since ? getEventsSince(since) : getRecentEvents(limit);
    res.json({ events: events.map(formatEvent) });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
