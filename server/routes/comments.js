import express from 'express';
import { createComment, createEvent, getCommentsByTask, getTaskById } from '../db.js';
import { schemas, validateBody } from '../validation.js';

const router = express.Router({ mergeParams: true });

const formatComment = (comment) => ({
  id: comment.id,
  taskId: comment.task_id,
  authorId: comment.author_id,
  authorName: comment.author_name,
  text: comment.text,
  createdAt: comment.created_at,
});

router.get('/', (req, res) => {
  try {
    const task = getTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const comments = getCommentsByTask(req.params.taskId);
    res.json({ comments: comments.map(formatComment) });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validateBody(schemas.commentCreate), (req, res) => {
  try {
    const task = getTaskById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Resolve author: body override takes priority over token identity
    const resolvedAuthorId = req.body.authorId || req.user.id;
    const resolvedAuthorName = req.body.authorName || req.user.name;

    const comment = createComment({
      taskId: req.params.taskId,
      authorId: resolvedAuthorId,
      authorName: resolvedAuthorName,
      text: req.body.text,
    });

    const event = createEvent({
      type: 'comment_created',
      message: `${resolvedAuthorName} commented on task: ${task.title}`,
      agentId: resolvedAuthorId,
      taskId: task.id,
    });

    if (req.app.io) {
      req.app.io.emit('comment.created', { comment: formatComment(comment) });
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

    res.status(201).json({ comment: formatComment(comment) });
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
