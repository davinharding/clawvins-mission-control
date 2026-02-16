import express from 'express';
import { getAllAgents, updateAgent, createEvent } from '../db.js';
import { schemas, validateBody } from '../validation.js';

const router = express.Router();

const formatAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  role: agent.role,
  status: agent.status,
  lastActive: agent.last_active,
  avatarColor: agent.avatar_color,
});

router.get('/', (req, res) => {
  try {
    const agents = getAllAgents();
    res.json({ agents: agents.map(formatAgent) });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validateBody(schemas.agentUpdate), (req, res) => {
  try {
    const agent = updateAgent(req.params.id, {
      name: req.body.name,
      role: req.body.role,
      status: req.body.status,
      avatarColor: req.body.avatarColor,
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let event = null;
    if (req.body.status) {
      event = createEvent({
        type: 'agent_status_changed',
        message: `${agent.name} is now ${req.body.status}`,
        agentId: agent.id,
      });
    }

    if (req.app.io) {
      req.app.io.emit('agent.status_changed', { agent: formatAgent(agent) });
      if (event) {
        req.app.io.emit('event.new', {
          event: {
            id: event.id,
            type: event.type,
            message: event.message,
            agentId: event.agentId,
            taskId: event.taskId,
            timestamp: event.timestamp,
          },
        });
      }
    }

    res.json({ agent: formatAgent(agent) });
  } catch (err) {
    console.error('Error updating agent:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
