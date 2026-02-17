/**
 * Agent Task API Routes
 * Simplified endpoints for agents to query and update their tasks
 */

import express from 'express';
import {
  getAllTasks,
  getTaskById,
  updateTask,
  createComment,
  createEvent,
} from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

/**
 * Format task for API response
 */
const formatTask = (task) => ({
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
});

/**
 * GET /api/agent-tasks/mine
 * Get all tasks assigned to authenticated agent
 */
router.get('/mine', authMiddleware, (req, res) => {
  try {
    const agentId = req.user.id;
    const tasks = getAllTasks({ agent: agentId });
    
    res.json({
      tasks: tasks.map(formatTask),
      count: tasks.length,
    });
  } catch (err) {
    console.error('[AgentTasks] Error fetching agent tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agent-tasks/:taskId
 * Get specific task details
 */
router.get('/:taskId', authMiddleware, (req, res) => {
  try {
    const task = getTaskById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Allow any authenticated agent to view tasks
    // In production, you might want to restrict this to assigned agent only
    res.json({ task: formatTask(task) });
  } catch (err) {
    console.error('[AgentTasks] Error fetching task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/agent-tasks/:taskId/status
 * Update task status (simplified for agents)
 */
router.patch('/:taskId/status', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['backlog', 'todo', 'in-progress', 'testing', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const oldTask = getTaskById(req.params.taskId);
    if (!oldTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = updateTask(req.params.taskId, { status });

    // Create event
    const statusMessages = {
      'backlog': 'moved to backlog',
      'todo': 'moved to todo',
      'in-progress': 'started working on',
      'done': 'completed',
    };

    createEvent({
      type: 'task_updated',
      message: `${req.user.name} ${statusMessages[status]} "${task.title}"`,
      agentId: req.user.id,
      taskId: task.id,
    });

    // Broadcast WebSocket update
    if (req.app.io) {
      req.app.io.emit('task.updated', { task: formatTask(task) });
    }

    res.json({ 
      task: formatTask(task),
      message: `Task status updated to ${status}`,
    });
  } catch (err) {
    console.error('[AgentTasks] Error updating task status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/agent-tasks/:taskId/comment
 * Add comment to task (simplified for agents)
 */
router.post('/:taskId/comment', authMiddleware, (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const task = getTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const comment = createComment({
      taskId: req.params.taskId,
      authorId: req.user.id,
      authorName: req.user.name,
      text: content.trim(),
    });

    // Create event
    createEvent({
      type: 'comment_created',
      message: `${req.user.name} commented on "${task.title}"`,
      agentId: req.user.id,
      taskId: task.id,
    });

    // Broadcast WebSocket update
    if (req.app.io) {
      req.app.io.emit('comment.created', {
        comment: {
          id: comment.id,
          taskId: comment.task_id,
          authorId: comment.author_id,
          authorName: comment.author_name,
          text: comment.text,
          createdAt: comment.created_at,
        },
      });
    }

    res.status(201).json({
      comment: {
        id: comment.id,
        taskId: comment.task_id,
        authorId: comment.author_id,
        authorName: comment.author_name,
        text: comment.text,
        createdAt: comment.created_at,
      },
      message: 'Comment added successfully',
    });
  } catch (err) {
    console.error('[AgentTasks] Error creating comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/agent-tasks/:taskId
 * Update task (full update for agents)
 */
router.patch('/:taskId', authMiddleware, (req, res) => {
  try {
    const task = getTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.priority) updates.priority = req.body.priority;
    if (req.body.description !== undefined) updates.description = req.body.description;

    const updatedTask = updateTask(req.params.taskId, updates);

    // Create event
    createEvent({
      type: 'task_updated',
      message: `${req.user.name} updated task: ${updatedTask.title}`,
      agentId: req.user.id,
      taskId: updatedTask.id,
    });

    // Broadcast WebSocket update
    if (req.app.io) {
      req.app.io.emit('task.updated', { task: formatTask(updatedTask) });
    }

    res.json({ 
      task: formatTask(updatedTask),
      message: 'Task updated successfully',
    });
  } catch (err) {
    console.error('[AgentTasks] Error updating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
