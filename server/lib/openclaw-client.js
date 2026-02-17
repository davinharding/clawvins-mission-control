/**
 * OpenClaw Gateway API Client
 * Provides helper functions to interact with OpenClaw Gateway API
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENCLAW_REQUEST_TIMEOUT_MS || 8000);

/**
 * Find active session for an agent
 * @param {string} agentId - Agent identifier (e.g., 'agent-patch')
 * @returns {Promise<string|null>} Session key or null if not found
 */
export async function findAgentSession(agentId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${GATEWAY_URL}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[OpenClaw] Failed to fetch sessions: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const sessions = data.sessions || data.data || data || [];

    // Find session for this agent
    // Session keys typically look like: agent:coder:discord:channel:1234567890
    const agentKey = agentId.replace('agent-', ''); // 'agent-patch' -> 'patch' -> 'coder'
    
    // Map agent names to their actual agent keys
    const agentKeyMap = {
      'patch': 'coder',
      'clawvin': 'clawvin',
      'alpha': 'alpha',
      'nova': 'nova',
      'scout': 'stagesnap-business',
      'vitals': 'health-tracking',
      'atlas': 'training',
      'iris': 'outreach',
      'ledger': 'finance',
    };
    
    const actualKey = agentKeyMap[agentKey] || agentKey;

    const agentSession = sessions.find(s => {
      const sessionKey = s.key || s.sessionKey || '';
      return sessionKey.includes(`agent:${actualKey}:`) || 
             s.agentId === agentId ||
             s.agent === actualKey;
    });

    return agentSession?.key || agentSession?.sessionKey || null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[OpenClaw] Request timeout while finding agent session');
    } else {
      console.error('[OpenClaw] Failed to find agent session:', err.message);
    }
    return null;
  }
}

/**
 * Send message to agent session via sessions_send API
 * @param {string} sessionKey - Session key
 * @param {string} message - Message to send
 * @returns {Promise<object>} Response from Gateway
 */
export async function sendToAgentSession(sessionKey, message) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${GATEWAY_URL}/api/sessions/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        sessionKey,
        message,
        timeoutSeconds: 30,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout while sending to session');
    }
    console.error('[OpenClaw] Failed to send to session:', err.message);
    throw err;
  }
}

/**
 * Get all active sessions
 * @returns {Promise<Array>} List of sessions
 */
export async function getAllSessions() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${GATEWAY_URL}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[OpenClaw] Failed to fetch sessions: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.sessions || data.data || data || [];
  } catch (err) {
    console.error('[OpenClaw] Failed to fetch sessions:', err.message);
    return [];
  }
}
