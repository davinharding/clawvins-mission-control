import express from 'express';
import {
  getAllTasks,
  getArchivedTasks,
  getArchivedCount,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  createEvent,
} from '../db.js';
import { schemas, validateBody, validateQuery } from '../validation.js';
import commentsRoutes from './comments.js';
import { notifyAgentOfTask } from '../webhooks/task-assigned.js';
const router = express.Router();

router.use('/:taskId/comments', commentsRoutes);

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
  commentCount: task.comment_count ?? 0,
});

router.get('/', validateQuery(schemas.taskQuery), (req, res) => {
  try {
    const { status, agent } = req.query;
    const tasks = getAllTasks({ status, agent });
    res.json({ tasks: tasks.map(formatTask) });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/archived', (req, res) => {
  try {
    const tasks = getArchivedTasks();
    const count = getArchivedCount();
    res.json({ tasks: tasks.map(formatTask), count });
  } catch (err) {
    console.error('Error fetching archived tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validateBody(schemas.taskCreate), (req, res) => {
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

    const event = createEvent({
      type: 'task_created',
      message: `${req.user.name} created task: ${task.title}`,
      agentId: req.user.id,
      taskId: task.id,
    });

    if (req.app.io) {
      req.app.io.emit('task.created', { task: formatTask(task) });
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

    res.status(201).json({ task: formatTask(task) });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validateBody(schemas.taskUpdate), (req, res) => {
  try {
    const oldTask = getTaskById(req.params.id);
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

    // Check if agent assignment changed
    const assignmentChanged = oldTask && oldTask.assigned_agent !== task.assigned_agent;
    
    const event = createEvent({
      type: assignmentChanged ? 'task_assigned' : 'task_updated',
      message: assignmentChanged 
        ? `${task.title} assigned to ${task.assigned_agent || 'unassigned'}`
        : `${req.user.name} updated task: ${task.title}`,
      agentId: task.assigned_agent || req.user.id,
      taskId: task.id,
    });

    if (req.app.io) {
      req.app.io.emit('task.updated', { task: formatTask(task) });
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

    // Notify agent if newly assigned (don't block response)
    if (assignmentChanged && task.assigned_agent) {
      notifyAgentOfTask(task, task.assigned_agent).catch(err => {
        console.error('[Tasks] Failed to notify agent:', err);
      });
    }

    res.json({ task: formatTask(task) });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const task = getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const deleted = deleteTask(req.params.id);

    const event = createEvent({
      type: 'task_deleted',
      message: `${req.user.name} deleted task: ${task.title}`,
      agentId: req.user.id,
      taskId: task.id,
    });

    if (req.app.io) {
      req.app.io.emit('task.deleted', { taskId: req.params.id });
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

    res.json({ success: deleted });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
