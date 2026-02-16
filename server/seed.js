import 'dotenv/config';
import { db, createAgent, createTask, createEvent } from './db.js';

// Clear existing data (optional - makes script idempotent)
function clearData() {
  console.log('Clearing existing data...');
  db.prepare('DELETE FROM events').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM agents').run();
}

// Seed agents
function seedAgents() {
  console.log('Seeding agents...');
  
  const agents = [
    {
      id: 'agent-patch',
      name: 'Patch',
      role: 'Dev',
      status: 'online',
      avatarColor: '#3b82f6',
    },
    {
      id: 'agent-nova',
      name: 'Nova',
      role: 'Research',
      status: 'online',
      avatarColor: '#8b5cf6',
    },
    {
      id: 'agent-scout',
      name: 'Scout',
      role: 'Ops',
      status: 'busy',
      avatarColor: '#10b981',
    },
    {
      id: 'agent-atlas',
      name: 'Atlas',
      role: 'Main',
      status: 'offline',
      avatarColor: '#f59e0b',
    },
  ];

  agents.forEach(agent => {
    const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent.id);
    if (!existing) {
      createAgent(agent);
      console.log(`  ✓ Created agent: ${agent.name}`);
    } else {
      console.log(`  - Agent ${agent.name} already exists, skipping`);
    }
  });
}

// Seed tasks
function seedTasks() {
  console.log('Seeding tasks...');
  
  const tasks = [
    {
      title: 'Set up Mission Control dashboard',
      description: 'Build the frontend interface for task management',
      status: 'done',
      assignedAgent: 'agent-patch',
      priority: 'high',
      tags: ['frontend', 'react'],
    },
    {
      title: 'Implement WebSocket real-time updates',
      description: 'Add Socket.io for live task updates across all clients',
      status: 'done',
      assignedAgent: 'agent-patch',
      priority: 'high',
      tags: ['backend', 'websocket'],
    },
    {
      title: 'Research AI model performance',
      description: 'Analyze latest Claude models for task planning capabilities',
      status: 'in-progress',
      assignedAgent: 'agent-nova',
      priority: 'medium',
      tags: ['research', 'ai'],
    },
    {
      title: 'Deploy to production server',
      description: 'Set up PM2 and configure production environment',
      status: 'todo',
      assignedAgent: 'agent-scout',
      priority: 'critical',
      tags: ['ops', 'deployment'],
    },
    {
      title: 'Add user authentication',
      description: 'Implement JWT-based auth system',
      status: 'done',
      assignedAgent: 'agent-patch',
      priority: 'high',
      tags: ['backend', 'security'],
    },
    {
      title: 'Create API documentation',
      description: 'Document all REST endpoints and WebSocket events',
      status: 'in-progress',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: ['docs'],
    },
    {
      title: 'Monitor system health',
      description: 'Set up health checks and alerting',
      status: 'todo',
      assignedAgent: 'agent-scout',
      priority: 'medium',
      tags: ['ops', 'monitoring'],
    },
    {
      title: 'Optimize database queries',
      description: 'Review and improve database performance',
      status: 'backlog',
      assignedAgent: null,
      priority: 'low',
      tags: ['backend', 'performance'],
    },
    {
      title: 'Design agent coordination protocol',
      description: 'Establish communication patterns between agents',
      status: 'backlog',
      assignedAgent: 'agent-atlas',
      priority: 'medium',
      tags: ['architecture', 'research'],
    },
    {
      title: 'Test multi-agent workflows',
      description: 'Verify task handoff and collaboration features',
      status: 'todo',
      assignedAgent: 'agent-nova',
      priority: 'high',
      tags: ['testing', 'qa'],
    },
  ];

  tasks.forEach(task => {
    createTask({
      ...task,
      createdBy: 'agent-patch',
    });
    console.log(`  ✓ Created task: ${task.title}`);
  });
}

// Seed events
function seedEvents() {
  console.log('Seeding events...');
  
  const events = [
    {
      type: 'agent_status_changed',
      message: 'Patch is now online',
      agentId: 'agent-patch',
    },
    {
      type: 'agent_status_changed',
      message: 'Nova is now online',
      agentId: 'agent-nova',
    },
    {
      type: 'agent_status_changed',
      message: 'Scout is now busy',
      agentId: 'agent-scout',
    },
    {
      type: 'task_created',
      message: 'Patch created task: Set up Mission Control dashboard',
      agentId: 'agent-patch',
      taskId: null,
    },
    {
      type: 'task_updated',
      message: 'Patch updated task status to done',
      agentId: 'agent-patch',
      taskId: null,
    },
    {
      type: 'task_created',
      message: 'Patch created task: Research AI model performance',
      agentId: 'agent-patch',
      taskId: null,
    },
    {
      type: 'task_updated',
      message: 'Nova started working on AI model research',
      agentId: 'agent-nova',
      taskId: null,
    },
    {
      type: 'agent_status_changed',
      message: 'Atlas is now offline',
      agentId: 'agent-atlas',
    },
    {
      type: 'task_created',
      message: 'Scout created task: Deploy to production server',
      agentId: 'agent-scout',
      taskId: null,
    },
    {
      type: 'task_updated',
      message: 'Patch completed authentication implementation',
      agentId: 'agent-patch',
      taskId: null,
    },
  ];

  events.forEach(event => {
    createEvent(event);
  });
  console.log(`  ✓ Created ${events.length} events`);
}

// Main seed function
async function seed() {
  try {
    console.log('\n🌱 Starting database seed...\n');
    
    clearData();
    seedAgents();
    seedTasks();
    seedEvents();
    
    console.log('\n✅ Database seeded successfully!\n');
    console.log('You can now start the server with: npm run server\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
}

seed();
