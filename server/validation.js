import { z } from 'zod';

// Agents identify themselves by their OpenClaw agent id ("coder", "content"),
// but the board's canonical ids are the agent-* ids the dispatcher and UI key
// on. Normalize at the API boundary so mis-keyed assignments can't strand a
// task where the dispatcher never finds it.
const OPENCLAW_TO_MC_AGENT = {
  clawvin: 'agent-clawvin',
  coder: 'agent-patch',
  qa: 'agent-cypress',
  alpha: 'agent-alpha',
  'stagesnap-business': 'agent-scout',
  'health-tracking': 'agent-vitals',
  content: 'agent-nova',
  outreach: 'agent-iris',
  finance: 'agent-ledger',
  training: 'agent-atlas',
};

const canonicalAgentId = (id) => {
  if (id == null) return id;
  return OPENCLAW_TO_MC_AGENT[id] || id;
};

const taskStatus = z.enum(['backlog', 'todo', 'in-progress', 'testing', 'done', 'archived']);
const agentRole = z.enum(['Main', 'Dev', 'Research', 'Ops']);
const agentStatus = z.enum(['online', 'offline', 'busy']);
const taskPriority = z.enum(['low', 'medium', 'high', 'critical']);

const isFixtureTask = ({ title = '', description = '', tags = [] }) => {
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = (description || '').toLowerCase();
  const normalizedTags = tags.map((tag) => String(tag).toLowerCase());

  const hasMobileOverflowTitle =
    normalizedTitle.startsWith('mobile overflow verification') ||
    normalizedTitle.startsWith('mobile overflow screenshot');
  const hasMobileOverflowTags =
    normalizedTags.includes('mobile') && normalizedTags.includes('overflow');
  const hasSyntheticWorkspaceCoderPath =
    normalizedDescription.includes('/workspace-coder/') &&
    normalizedDescription.includes('/task-') &&
    normalizedDescription.includes('abcdefghijklmnopqrstuvwxyz0123456789');

  return (hasMobileOverflowTitle && hasMobileOverflowTags) || hasSyntheticWorkspaceCoderPath;
};

const schemas = {
  login: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  taskCreate: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(10000).optional(),
    status: taskStatus.optional(),
    assignedAgent: z.string().transform(canonicalAgentId).optional(),
    priority: taskPriority.optional(),
    tags: z.array(z.string()).optional(),
  }).refine((data) => !isFixtureTask(data), {
    message: 'Verification fixtures must not be created as live Mission Control tasks',
  }),
  taskUpdate: z
    .object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(10000).nullable().optional(),
      status: taskStatus.optional(),
      assignedAgent: z.string().transform(canonicalAgentId).nullable().optional(),
      priority: taskPriority.nullable().optional(),
      tags: z.array(z.string()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be updated',
    }),
  taskQuery: z.object({
    status: taskStatus.optional(),
    assignedAgent: z.string().optional(),
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
    before: z.coerce.number().int().optional(),
  }),
  commentCreate: z.object({
    text: z.string().trim().min(1).max(1000),
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
