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

function agentKeyMiddleware(req, res, next) {
  // Read lazily so dotenv.config() has already run
  const AGENT_API_KEY = process.env.AGENT_API_KEY || 'mc-agent-key-change-me';
  const key = req.headers['x-api-key'] || req.headers['x-agent-key'];
  if (key === AGENT_API_KEY) {
    // Identify agent from optional headers
    const agentName = req.headers['x-agent-name'] || 'Agent';
    const agentId = req.headers['x-agent-id'] || 'agent-unknown';
    req.user = { id: agentId, name: agentName, role: 'Dev' };
    return next();
  }
  next(); // Fall through to JWT middleware
}

export { generateToken, verifyToken, authMiddleware, agentKeyMiddleware };
