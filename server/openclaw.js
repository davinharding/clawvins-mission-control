const DEFAULT_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || process.env.GATEWAY_URL || 'http://localhost:8080';
const DEFAULT_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.GATEWAY_TOKEN || '';
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENCLAW_REQUEST_TIMEOUT_MS || 8000);

const SESSION_ENDPOINTS = [
  '/api/sessions',
  '/api/sessions/list',
  '/api/sessions/active',
];

const statusPriority = {
  busy: 3,
  online: 2,
  offline: 1,
};

const roleLabels = ['Main', 'Dev', 'Research', 'Ops'];

const normalizeRole = (value, fallback = 'Main') => {
  if (roleLabels.includes(value)) return value;
  return fallback;
};

const inferRole = (agentId, name) => {
  const text = `${agentId ?? ''} ${name ?? ''}`.toLowerCase();
  if (text.includes('dev') || text.includes('code') || text.includes('patch')) return 'Dev';
  if (text.includes('research') || text.includes('nova') || text.includes('content')) return 'Research';
  if (text.includes('ops') || text.includes('scout') || text.includes('stage') || text.includes('deploy')) return 'Ops';
  return 'Main';
};

const normalizeStatus = (value) => {
  if (!value) return 'offline';
  const text = String(value).toLowerCase();
  if (['busy', 'running', 'active', 'working', 'in_progress', 'in-progress'].includes(text)) return 'busy';
  if (['online', 'idle', 'ready', 'available'].includes(text)) return 'online';
  return 'offline';
};

const buildHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const fetchJson = async (url, token) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(token),
      signal: controller.signal,
    });

    if (!res.ok) {
      const message = await res.text();
      const error = new Error(`OpenClaw request failed (${res.status}): ${message}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractSessions = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.sessions)) return payload.sessions;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
};

const pickAgentId = (session, index) => (
  session.agentId ||
  session.agent_id ||
  session.agent?.id ||
  session.agent?.agentId ||
  session.agent ||
  session.id ||
  `agent-${index}`
);

const pickAgentName = (session) => (
  session.agentName ||
  session.agent_name ||
  session.agent?.name ||
  session.name ||
  session.agent ||
  'Unknown Agent'
);

const pickAgentStatus = (session) => (
  session.agentStatus ||
  session.agent_status ||
  session.status ||
  session.state ||
  session.agent?.status ||
  session.agent?.state
);

const pickAvatarColor = (session) => (
  session.avatarColor ||
  session.avatar_color ||
  session.agent?.avatarColor ||
  session.agent?.avatar_color ||
  session.agent?.color
);

const pickAgentRole = (session, agentId, name) => (
  session.agentRole ||
  session.agent_role ||
  session.agent?.role ||
  session.role ||
  inferRole(agentId, name)
);

export async function getSessions() {
  const directUrl = process.env.OPENCLAW_SESSIONS_URL;
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.GATEWAY_TOKEN || '';

  if (directUrl) {
    const payload = await fetchJson(directUrl, token);
    return extractSessions(payload);
  }

  let lastError = null;
  for (const endpoint of SESSION_ENDPOINTS) {
    const url = `${DEFAULT_GATEWAY_URL}${endpoint}`;
    try {
      const payload = await fetchJson(url, token);
      const sessions = extractSessions(payload);
      if (sessions.length) return sessions;
      if (payload && Object.keys(payload).length) return sessions;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  if (lastError) {
    console.warn('  ⚠ OpenClaw Gateway API not available, using fallback agent list');
  }
  
  // Fallback: return known agents from sessions_list data
  // This is used when Gateway API is not available
  return getFallbackAgents();
}

function getFallbackAgents() {
  // Real agents from OpenClaw sessions_list (9 total):
  // Patch (coder), Clawvin, Alpha, Nova, Scout (stagesnap-business), 
  // Health (health-tracking), Atlas (training), Iris (outreach), Ledger (finance)
  return [
    { key: 'coder', name: 'Patch', role: 'Dev', status: 'online' },
    { key: 'clawvin', name: 'Clawvin', role: 'Main', status: 'online' },
    { key: 'alpha', name: 'Alpha', role: 'Research', status: 'online' },
    { key: 'nova', name: 'Nova', role: 'Research', status: 'online' },
    { key: 'stagesnap-business', name: 'Scout', role: 'Ops', status: 'online' },
    { key: 'health-tracking', name: 'Vitals', role: 'Ops', status: 'online' },
    { key: 'training', name: 'Atlas', role: 'Research', status: 'online' },
    { key: 'outreach', name: 'Iris', role: 'Ops', status: 'online' },
    { key: 'finance', name: 'Ledger', role: 'Ops', status: 'online' },
  ];
}

export async function getAgentsFromSessions() {
  let sessions = await getSessions();
  
  // If sessions is our fallback format (has 'key' property), transform it
  if (sessions.length && sessions[0]?.key?.startsWith?.('agent:')) {
    sessions = sessions.map(s => ({
      agentId: s.key.split(':')[1],
      agent: s.key.split(':')[1],
      name: s.name || s.key.split(':')[1],
      status: 'online',
    }));
  }
  
  const agentsById = new Map();

  sessions.forEach((session, index) => {
    const agentId = pickAgentId(session, index);
    const name = pickAgentName(session);
    const status = normalizeStatus(pickAgentStatus(session));
    const role = normalizeRole(pickAgentRole(session, agentId, name), inferRole(agentId, name));
    const avatarColor = pickAvatarColor(session) || null;

    const existing = agentsById.get(agentId);
    if (!existing || statusPriority[status] > statusPriority[existing.status]) {
      agentsById.set(agentId, {
        id: agentId,
        name,
        role,
        status,
        avatarColor,
      });
    }
  });

  return Array.from(agentsById.values()).sort((a, b) => a.name.localeCompare(b.name));
}
