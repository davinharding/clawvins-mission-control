import express from 'express';
import { getAllAgents, getAgentById, updateAgent, createEvent } from '../db.js';

const router = express.Router();

// GET /api/agents
router.get('/', (req, res) => {
  try {
    const agents = getAllAgents();
    
    // Transform to camelCase for frontend
    const formatted = agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
      lastActive: a.last_active,
      avatarColor: a.avatar_color,
    }));
    
    res.json({ agents: formatted });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/agents/:id
router.patch('/:id', (req, res) => {
  try {
    const agent = updateAgent(req.params.id, {
      status: req.body.status,
      name: req.body.name,
      role: req.body.role,
      avatarColor: req.body.avatarColor,
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Create event if status changed
    if (req.body.status) {
      createEvent({
        type: 'agent_status_changed',
        message: `${agent.name} is now ${req.body.status}`,
        agentId: agent.id,
      });
    }
    
    // Broadcast to WebSocket
    if (req.app.io) {
      req.app.io.emit('agent.status_changed', {
        agent: {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          lastActive: agent.last_active,
          avatarColor: agent.avatar_color,
        },
      });
    }
    
    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        lastActive: agent.last_active,
        avatarColor: agent.avatar_color,
      },
    });
  } catch (err) {
    console.error('Error updating agent:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
