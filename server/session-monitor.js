import { createEvent } from './db.js';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || process.env.GATEWAY_URL || 'http://localhost:8080';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.GATEWAY_TOKEN || '';

export class SessionMonitor {
  constructor(io) {
    this.io = io;
    this.sessionCache = new Map(); // sessionKey -> { updatedAt, messageCount, agent }
    this.pollInterval = parseInt(process.env.SESSION_POLL_INTERVAL || '10000', 10);
    this.pollingTimer = null;
  }

  /**
   * Start polling - NOTE: Polling disabled
   * OpenClaw sessions API is not accessible from inside container
   * Use cron-based push instead (agent calls sessions_list and POSTs here)
   */
  startPolling() {
    console.log('[SessionMonitor] Polling not enabled (use cron-based push instead)');
  }

  /**
   * Stop polling
   */
  stopPolling() {
    console.log('[SessionMonitor] No polling to stop');
  }

  /**
   * Process session updates from external source (e.g., agent cron job)
   * This is called when we receive new session data
   */
  processSessions(sessions) {
    if (!Array.isArray(sessions)) {
      console.warn('SessionMonitor: Invalid sessions data');
      return;
    }

    const events = [];
    const currentKeys = new Set();

    sessions.forEach(session => {
      const key = session.key;
      if (!key) return;

      currentKeys.add(key);
      const cached = this.sessionCache.get(key);
      const updatedAt = session.updatedAt || Date.now();
      const messageCount = session.messages?.length || 0;
      const agent = this.extractAgentName(session);

      if (!cached) {
        // New session started
        events.push(this.createSessionStartEvent(session, agent));
        this.sessionCache.set(key, { updatedAt, messageCount, agent });
      } else {
        // Session updated
        if (updatedAt > cached.updatedAt) {
          if (messageCount > cached.messageCount) {
            // New message activity
            events.push(this.createMessageEvent(session, agent));
          } else {
            // Heartbeat / other activity
            events.push(this.createCheckinEvent(session, agent));
          }
          this.sessionCache.set(key, { updatedAt, messageCount, agent });
        }
      }
    });

    // Detect ended sessions (keys that were cached but not in current list)
    this.sessionCache.forEach((cached, key) => {
      if (!currentKeys.has(key)) {
        events.push(this.createSessionEndEvent(key, cached.agent));
        this.sessionCache.delete(key);
      }
    });

    // Store and broadcast events
    events.forEach(event => {
      try {
        const stored = createEvent(event);
        this.io.emit('event.new', { event: stored });
        console.log(`[SessionMonitor] Event: ${event.type} - ${event.message} (broadcast to ${this.io.sockets.sockets.size} clients)`);
      } catch (err) {
        console.error('[SessionMonitor] Failed to create event:', err.message);
      }
    });

    return events.length;
  }

  extractAgentName(session) {
    // Extract agent name from session key or displayName
    // Examples:
    // "agent:coder:discord:channel:123" -> "Patch" (coder)
    // "agent:clawvin:main" -> "Clawvin"
    const agentMap = {
      'coder': 'Patch',
      'clawvin': 'Clawvin',
      'alpha': 'Alpha',
      'nova': 'Nova',
      'stagesnap-business': 'Scout',
      'health-tracking': 'Vitals',
      'training': 'Atlas',
      'outreach': 'Iris',
      'finance': 'Ledger',
    };

    if (session.key) {
      const parts = session.key.split(':');
      if (parts.length >= 2 && parts[0] === 'agent') {
        const agentId = parts[1];
        return agentMap[agentId] || agentId;
      }
    }

    return 'Unknown';
  }

  extractAgentId(session) {
    // Return agent-{name} format for agentId
    const agentIdMap = {
      'coder': 'agent-patch',
      'clawvin': 'agent-clawvin',
      'alpha': 'agent-alpha',
      'nova': 'agent-nova',
      'stagesnap-business': 'agent-scout',
      'health-tracking': 'agent-vitals',
      'training': 'agent-atlas',
      'outreach': 'agent-iris',
      'finance': 'agent-ledger',
    };

    if (session.key) {
      const parts = session.key.split(':');
      if (parts.length >= 2 && parts[0] === 'agent') {
        const agentId = parts[1];
        return agentIdMap[agentId] || `agent-${agentId}`;
      }
    }

    return null;
  }

  createSessionStartEvent(session, agentName) {
    const label = session.label || '';
    const isSubagent = session.kind === 'other' && label;
    
    return {
      type: isSubagent ? 'subagent_spawn' : 'session_start',
      message: isSubagent 
        ? `${agentName} spawned subagent: ${label}`
        : `${agentName} started a session`,
      agentId: this.extractAgentId(session),
    };
  }

  createMessageEvent(session, agentName) {
    return {
      type: 'agent_message',
      message: `${agentName} sent a message`,
      agentId: this.extractAgentId(session),
    };
  }

  createCheckinEvent(session, agentName) {
    return {
      type: 'agent_checkin',
      message: `${agentName} is active`,
      agentId: this.extractAgentId(session),
    };
  }

  createSessionEndEvent(sessionKey, agentName) {
    return {
      type: 'session_end',
      message: `${agentName} ended a session`,
      agentId: null, // Don't have the agentId anymore since session is gone
    };
  }

  getStats() {
    return {
      cachedSessions: this.sessionCache.size,
      pollInterval: this.pollInterval,
    };
  }
}
