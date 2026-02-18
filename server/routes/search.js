import express from 'express';
import { db } from '../db.js';
import { authMiddleware, agentKeyMiddleware } from '../auth.js';

const router = express.Router();

// flexAuth: accept either JWT or Agent API key
const flexAuth = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.headers['x-agent-key'];
  if (key) {
    return agentKeyMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (req.user) return next();
      return authMiddleware(req, res, next);
    });
  }
  return authMiddleware(req, res, next);
};

// GET /api/search?q=<query>&limit=20
router.get('/', flexAuth, (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const query = q.trim();
    const likePattern = `%${query}%`;
    const maxLimit = Math.min(Number(limit) || 20, 100);

    // Search tasks by title, description, status, assigned_agent
    const taskResults = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.assigned_agent,
        t.priority,
        'task' AS match_type,
        CASE
          WHEN t.title LIKE ? THEN t.title
          WHEN t.description LIKE ? THEN t.description
          ELSE t.title
        END AS snippet
      FROM tasks t
      WHERE
        t.status != 'archived'
        AND (
          t.title LIKE ?
          OR t.description LIKE ?
          OR t.assigned_agent LIKE ?
        )
      ORDER BY
        CASE t.status
          WHEN 'in-progress' THEN 1
          WHEN 'todo' THEN 2
          WHEN 'testing' THEN 3
          WHEN 'backlog' THEN 4
          WHEN 'done' THEN 5
          ELSE 6
        END,
        t.updated_at DESC
      LIMIT ?
    `).all(likePattern, likePattern, likePattern, likePattern, likePattern, maxLimit);

    // Search comments and join to tasks
    const commentResults = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.assigned_agent,
        t.priority,
        'comment' AS match_type,
        c.text AS snippet
      FROM comments c
      JOIN tasks t ON c.task_id = t.id
      WHERE
        t.status != 'archived'
        AND c.text LIKE ?
      ORDER BY
        CASE t.status
          WHEN 'in-progress' THEN 1
          WHEN 'todo' THEN 2
          WHEN 'testing' THEN 3
          WHEN 'backlog' THEN 4
          WHEN 'done' THEN 5
          ELSE 6
        END,
        c.created_at DESC
      LIMIT ?
    `).all(likePattern, maxLimit);

    // Merge and deduplicate (prefer task matches over comment matches for same task)
    const seen = new Set();
    const merged = [];

    for (const row of taskResults) {
      seen.add(row.id);
      merged.push({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        assignedAgent: row.assigned_agent,
        priority: row.priority,
        matchType: row.match_type,
        snippet: truncateSnippet(row.snippet, query),
      });
    }

    for (const row of commentResults) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push({
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          assignedAgent: row.assigned_agent,
          priority: row.priority,
          matchType: row.match_type,
          snippet: truncateSnippet(row.snippet, query),
        });
      }
    }

    res.json({ results: merged.slice(0, maxLimit), query });
  } catch (err) {
    console.error('[Search] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Truncate a snippet to ~100 chars centered around the first match.
 */
function truncateSnippet(text, query) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 60);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

export default router;
