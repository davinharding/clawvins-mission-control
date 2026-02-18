import { z } from 'zod';

const taskStatus = z.enum(['backlog', 'todo', 'in-progress', 'testing', 'done', 'archived']);
const agentRole = z.enum(['Main', 'Dev', 'Research', 'Ops']);
const agentStatus = z.enum(['online', 'offline', 'busy']);
const taskPriority = z.enum(['low', 'medium', 'high', 'critical']);

const schemas = {
  login: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  taskCreate: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    status: taskStatus.optional(),
    assignedAgent: z.string().optional(),
    priority: taskPriority.optional(),
    tags: z.array(z.string()).optional(),
  }),
  taskUpdate: z
    .object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      status: taskStatus.optional(),
      assignedAgent: z.string().nullable().optional(),
      priority: taskPriority.nullable().optional(),
      tags: z.array(z.string()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be updated',
    }),
  taskQuery: z.object({
    status: taskStatus.optional(),
    agent: z.string().optional(),
  }),
  agentUpdate: z
    .object({
      name: z.string().min(1).optional(),
      role: agentRole.optional(),
      status: agentStatus.optional(),
      avatarColor: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be updated',
    }),
  eventsQuery: z.object({
    limit: z.coerce.number().int().positive().optional(),
    since: z.coerce.number().int().optional(),
  }),
  commentCreate: z.object({
    text: z.string().min(1).max(1000),
    // authorId and authorName are intentionally excluded — server determines attribution from auth token
  }),
};

const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    const details = err.issues ?? err.errors ?? [];
    return res.status(400).json({ error: 'Invalid request body', details });
  }
};

const validateQuery = (schema) => (req, res, next) => {
  try {
    // In Express 5, req.query is read-only, so we just validate without reassigning
    schema.parse(req.query);
    next();
  } catch (err) {
    const details = err.issues ?? err.errors ?? [];
    return res.status(400).json({ error: 'Invalid query parameters', details });
  }
};

export { schemas, validateBody, validateQuery };
