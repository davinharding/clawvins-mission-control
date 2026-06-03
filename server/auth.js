import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';
const JWT_EXPIRY = '7d';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

function parseAgentKeyMap() {
  if (!process.env.AGENT_API_KEYS) return {};
  try {
    const parsed = JSON.parse(process.env.AGENT_API_KEYS);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function getAgentForKey(key) {
  const perAgentKeys = parseAgentKeyMap();
  const configuredAgent = perAgentKeys[key];
  if (configuredAgent?.id && configuredAgent?.name) {
    return {
      id: configuredAgent.id,
      name: configuredAgent.name,
      role: configuredAgent.role || 'Dev',
    };
  }

  const legacyKey = process.env.AGENT_API_KEY;
  if (legacyKey && key === legacyKey) {
    return {
      id: process.env.AGENT_API_KEY_AGENT_ID || 'agent-patch',
      name: process.env.AGENT_API_KEY_AGENT_NAME || 'Patch',
      role: process.env.AGENT_API_KEY_AGENT_ROLE || 'Dev',
    };
  }

  return null;
}

function agentKeyMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['x-agent-key'];
  const agent = getAgentForKey(key);

  if (agent) {
    const requestedAgentId = req.headers['x-agent-id'];
    if (requestedAgentId && requestedAgentId !== agent.id) {
      return res.status(403).json({ error: 'Agent API key does not match requested agent identity' });
    }

    req.user = agent;
    req.agent = agent;
    return next();
  }
  next(); // Fall through to JWT middleware
}

export { generateToken, verifyToken, authMiddleware, agentKeyMiddleware, getAgentForKey };
