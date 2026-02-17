/**
 * Discord/Telegram Message Client
 * Sends direct messages to agent channels if no active session
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8080';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENCLAW_REQUEST_TIMEOUT_MS || 8000);

/**
 * Agent channel mappings
 * Maps agent IDs to their Discord/Telegram channels
 */
const AGENT_CHANNELS = {
  'agent-patch': {
    type: 'discord',
    channel: '1469764170906865706', // #patch-dev-work
  },
  'agent-clawvin': {
    type: 'discord',
    channel: '1469764199470206996', // #clawvin-admin-config
  },
  'agent-alpha': {
    type: 'discord',
    channel: '1469764057685819484', // #alpha-research
  },
  'agent-nova': {
    type: 'discord',
    channel: '1469764057685819484', // #nova-content
  },
  'agent-scout': {
    type: 'discord',
    channel: '1469764057685819484', // #scout-ops
  },
  'agent-vitals': {
    type: 'discord',
    channel: '1469764057685819484', // #vitals-health
  },
  'agent-atlas': {
    type: 'discord',
    channel: '1469764057685819484', // #atlas-training
  },
  'agent-iris': {
    type: 'discord',
    channel: '1469764057685819484', // #iris-outreach
  },
  'agent-ledger': {
    type: 'discord',
    channel: '1469764057685819484', // #ledger-finance
  },
};

/**
 * Send message to agent's Discord/Telegram channel
 * @param {string} agentId - Agent identifier (e.g., 'agent-patch')
 * @param {string} message - Message to send
 * @returns {Promise<void>}
 */
export async function sendToAgentChannel(agentId, message) {
  const channelConfig = AGENT_CHANNELS[agentId];
  
  if (!channelConfig) {
    console.warn(`[Message] No channel mapping for agent: ${agentId}`);
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Use OpenClaw message API
    const response = await fetch(`${GATEWAY_URL}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        action: 'send',
        target: channelConfig.channel,
        message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send (${response.status}): ${errorText}`);
    }

    console.log(`[Message] Sent to ${channelConfig.type} channel ${channelConfig.channel}`);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[Message] Request timeout while sending to channel');
    } else {
      console.error('[Message] Failed to send to channel:', err.message);
    }
    throw err;
  }
}

/**
 * Get channel configuration for an agent
 * @param {string} agentId - Agent identifier
 * @returns {object|null} Channel configuration or null
 */
export function getAgentChannel(agentId) {
  return AGENT_CHANNELS[agentId] || null;
}

/**
 * Check if agent has a configured channel
 * @param {string} agentId - Agent identifier
 * @returns {boolean} True if channel is configured
 */
export function hasAgentChannel(agentId) {
  return agentId in AGENT_CHANNELS;
}
