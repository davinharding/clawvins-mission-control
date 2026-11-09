import jwt from 'jsonwebtoken';
import { getAgentById } from './db.js';
import { requireEnv, safeEqual } from './lib/secrets.js';

const JWT_SECRET = requireEnv('JWT_SECRET');
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

function agentKeyMiddleware(req, res, next) {
  // No key configured means agent-key auth is disabled (JWT still works).
  const key = req.headers['x-api-key'] || req.headers['x-agent-key'];
  if (safeEqual(key, process.env.AGENT_API_KEY)) {
    // Try to look up agent by id header for accurate name/role
    const agentId = req.headers['x-agent-id'] || 'agent-unknown';
    const agentName = req.headers['x-agent-name'] || 'Agent';
    let resolvedName = agentName;
    let resolvedRole = 'Dev';
    try {
      const agentRecord = getAgentById(agentId);
      if (agentRecord) {
        resolvedName = agentRecord.name;
        resolvedRole = agentRecord.role;
      }
    } catch (_) {
      // DB lookup failed — fall back to header values
    }
    req.user = { id: agentId, name: resolvedName, role: resolvedRole };
    return next();
  }
  next(); // Fall through to JWT middleware
}

export { generateToken, verifyToken, authMiddleware, agentKeyMiddleware };
