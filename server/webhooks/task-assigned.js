/**
 * Task Assignment Webhook
 * Notifies agents when tasks are assigned to them
 */

import { findAgentSession, sendToAgentSession } from '../lib/openclaw-client.js';
import { sendToAgentChannel, hasAgentChannel } from '../lib/message-client.js';

/**
 * Format task assignment message for agents
 * @param {object} task - Task object
 * @returns {string} Formatted message
 */
function formatTaskAssignmentMessage(task) {
  const priority = task.priority?.toUpperCase() || 'MEDIUM';
  const priorityEmoji = {
    'CRITICAL': '🔴',
    'HIGH': '🟠',
    'MEDIUM': '🟡',
    'LOW': '🟢',
  }[priority] || '🟡';

  return `${priorityEmoji} **New Task Assigned**

**${task.title}**
Priority: ${priority}
Status: ${task.status}
ID: ${task.id}

${task.description || 'No description provided'}

**Actions:**
- View details: Reply "task show ${task.id}"
- Start work: Reply "task start ${task.id}"
- Update status: Reply "task status ${task.id} in-progress"
- Add comment: Reply "task comment ${task.id} Your comment here"

Mission Control: ${process.env.FRONTEND_URL || 'http://localhost:9000'}/mission_control/`;
}

/**
 * Notify agent of task assignment
 * Tries sessions_send first, falls back to Discord/Telegram channel
 * @param {object} task - Task object
 * @param {string} agentId - Agent identifier (e.g., 'agent-patch')
 * @returns {Promise<void>}
 */
export async function notifyAgentOfTask(task, agentId) {
  if (!agentId) {
    console.warn('[Webhook] No agent assigned to task, skipping notification');
    return;
  }

  const message = formatTaskAssignmentMessage(task);
  let notificationSent = false;

  // Try to find and send to agent's active session first
  try {
    const sessionKey = await findAgentSession(agentId);
    
    if (sessionKey) {
      console.log(`[Webhook] Found active session for ${agentId}: ${sessionKey}`);
      await sendToAgentSession(sessionKey, message);
      console.log(`[Webhook] ✅ Sent task notification to ${agentId} via session`);
      notificationSent = true;
    } else {
      console.log(`[Webhook] No active session found for ${agentId}`);
    }
  } catch (err) {
    console.error(`[Webhook] Failed to send via session for ${agentId}:`, err.message);
  }

  // If session notification failed or no session, try Discord/Telegram channel
  if (!notificationSent && hasAgentChannel(agentId)) {
    try {
      await sendToAgentChannel(agentId, message);
      console.log(`[Webhook] ✅ Sent task notification to ${agentId} via channel`);
      notificationSent = true;
    } catch (err) {
      console.error(`[Webhook] Failed to send via channel for ${agentId}:`, err.message);
    }
  }

  if (!notificationSent) {
    console.warn(`[Webhook] ⚠️  Could not notify ${agentId} - no session or channel available`);
  }
}

/**
 * Format task status update message for agents
 * @param {object} task - Task object
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @returns {string} Formatted message
 */
export function formatTaskUpdateMessage(task, oldStatus, newStatus) {
  const statusEmoji = {
    'backlog': '📋',
    'todo': '📝',
    'in-progress': '⚡',
    'done': '✅',
  };

  return `${statusEmoji[newStatus] || '📌'} **Task Updated**

**${task.title}**
Status: ${oldStatus} → ${newStatus}
ID: ${task.id}

Mission Control: ${process.env.FRONTEND_URL || 'http://localhost:9000'}/mission_control/`;
}
