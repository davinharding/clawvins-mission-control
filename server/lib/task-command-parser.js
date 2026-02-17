/**
 * Task Command Parser
 * Parse natural language task commands from agents
 */

/**
 * Parse task command from message
 * @param {string} message - Message text
 * @returns {object|null} Parsed command or null if not a task command
 */
export function parseTaskCommand(message) {
  if (!message || typeof message !== 'string') {
    return null;
  }

  const text = message.trim();
  
  // Match: task <action> <taskId> [args]
  // Examples:
  // - task start task-abc123
  // - task complete task-abc123
  // - task show task-abc123
  // - task status task-abc123 in-progress
  // - task comment task-abc123 Added auth middleware
  const match = text.match(/^task\s+(start|complete|show|status|comment)\s+(task-[\w-]+)(?:\s+(.+))?/i);
  
  if (!match) {
    return null;
  }

  const [, action, taskId, args] = match;

  switch (action.toLowerCase()) {
    case 'start':
      return {
        type: 'status',
        taskId,
        status: 'in-progress',
        action: 'start',
      };

    case 'complete':
      return {
        type: 'status',
        taskId,
        status: 'done',
        action: 'complete',
      };

    case 'show':
      return {
        type: 'show',
        taskId,
        action: 'show',
      };

    case 'status':
      if (!args) {
        return null; // Status requires an argument
      }
      return {
        type: 'status',
        taskId,
        status: args.trim(),
        action: 'status',
      };

    case 'comment':
      if (!args) {
        return null; // Comment requires content
      }
      return {
        type: 'comment',
        taskId,
        content: args.trim(),
        action: 'comment',
      };

    default:
      return null;
  }
}

/**
 * Format task command response
 * @param {object} task - Task object
 * @param {string} action - Action performed
 * @returns {string} Formatted response message
 */
export function formatCommandResponse(task, action) {
  const actionMessages = {
    'start': '✅ Task started',
    'complete': '✅ Task completed',
    'show': '📋 Task details',
    'status': '✅ Status updated',
    'comment': '✅ Comment added',
  };

  const emoji = {
    'backlog': '📋',
    'todo': '📝',
    'in-progress': '⚡',
    'done': '✅',
  }[task.status] || '📌';

  let response = `${actionMessages[action] || '✅ Action completed'}\n\n`;
  response += `**${task.title}**\n`;
  response += `${emoji} Status: ${task.status}\n`;
  response += `Priority: ${task.priority?.toUpperCase() || 'MEDIUM'}\n`;
  response += `ID: ${task.id}\n`;

  if (action === 'show' && task.description) {
    response += `\n${task.description}\n`;
  }

  return response;
}

/**
 * Validate task command
 * @param {object} command - Parsed command
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
export function validateCommand(command) {
  if (!command) {
    return { valid: false, error: 'Invalid command format' };
  }

  if (command.type === 'status') {
    const validStatuses = ['backlog', 'todo', 'in-progress', 'testing', 'done'];
    if (!validStatuses.includes(command.status)) {
      return {
        valid: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      };
    }
  }

  if (command.type === 'comment' && !command.content) {
    return { valid: false, error: 'Comment content is required' };
  }

  return { valid: true };
}

/**
 * Get help message for task commands
 * @returns {string} Help message
 */
export function getTaskCommandHelp() {
  return `**Task Commands**

Available commands:
- \`task show <taskId>\` - Show task details
- \`task start <taskId>\` - Start working on task (status → in-progress)
- \`task complete <taskId>\` - Mark task as done (status → done)
- \`task status <taskId> <status>\` - Update task status (backlog|todo|in-progress|testing|done)
- \`task comment <taskId> <message>\` - Add comment to task

Examples:
- \`task show task-abc123\`
- \`task start task-abc123\`
- \`task complete task-abc123\`
- \`task status task-abc123 in-progress\`
- \`task comment task-abc123 Added authentication middleware\``;
}
