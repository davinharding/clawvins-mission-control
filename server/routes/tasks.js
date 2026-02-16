import express from 'express';
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask, createEvent } from '../db.js';

const router = express.Router();

// GET /api/tasks
router.get('/', (req, res) => {
  try {
    const { status, agent } = req.query;
    const tasks = getAllTasks({ status, agent });
    
    // Transform to camelCase for frontend
    const formatted = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      assignedAgent: t.assigned_agent,
      priority: t.priority,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      createdBy: t.created_by,
      tags: JSON.parse(t.tags || '[]'),
    }));
    
    res.json({ tasks: formatted });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks
router.post('/', (req, res) => {
  try {
    const task = createTask({
      title: req.body.title,
      description: req.body.description,
      status: req.body.status || 'backlog',
      assignedAgent: req.body.assignedAgent,
      priority: req.body.priority,
      tags: req.body.tags,
      createdBy: req.user.id,
    });
    
    // Create event
    createEvent({
      type: 'task_created',
      message: `${req.user.name} created task: ${task.title}`,
      agentId: req.user.id,
      taskId: task.id,
    });
    
    // Broadcast to WebSocket (handled by socket.js)
    if (req.app.io) {
      req.app.io.emit('task.created', {
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          assignedAgent: task.assigned_agent,
          priority: task.priority,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          createdBy: task.created_by,
          tags: JSON.parse(task.tags || '[]'),
        },
      });
    }
    
    res.status(201).json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        assignedAgent: task.assigned_agent,
        priority: task.priority,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        createdBy: task.created_by,
        tags: JSON.parse(task.tags || '[]'),
      },
    });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', (req, res) => {
  try {
    const task = updateTask(req.params.id, {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      assignedAgent: req.body.assignedAgent,
      priority: req.body.priority,
      tags: req.body.tags,
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Create event
    createEvent({
      type: 'task_updated',
      message: `${req.user.name} updated task: ${task.title}`,
      agentId: req.user.id,
      taskId: task.id,
    });
    
    // Broadcast to WebSocket
    if (req.app.io) {
      req.app.io.emit('task.updated', {
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          assignedAgent: task.assigned_agent,
          priority: task.priority,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          createdBy: task.created_by,
          tags: JSON.parse(task.tags || '[]'),
        },
      });
    }
    
    res.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        assignedAgent: task.assigned_agent,
        priority: task.priority,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        createdBy: task.created_by,
        tags: JSON.parse(task.tags || '[]'),
      },
    });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  try {
    const task = getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const deleted = deleteTask(req.params.id);
    
    // Create event
    createEvent({
      type: 'task_deleted',
      message: `${req.user.name} deleted task: ${task.title}`,
      agentId: req.user.id,
      taskId: task.id,
    });
    
    // Broadcast to WebSocket
    if (req.app.io) {
      req.app.io.emit('task.deleted', { taskId: req.params.id });
    }
    
    res.json({ success: deleted });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
