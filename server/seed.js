import 'dotenv/config';
import { db, createAgent, createTask } from './db.js';
import { getAgentsFromSessions } from './openclaw.js';

// Clear existing data (optional - makes script idempotent)
function clearData() {
  console.log('Clearing existing data...');
  db.prepare('DELETE FROM events').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM agents').run();
}

// Seed agents
async function seedAgents() {
  console.log('Seeding agents from OpenClaw sessions API...');

  const agents = await getAgentsFromSessions();

  if (!agents.length) {
    console.warn('  ⚠ No OpenClaw agents returned from sessions API.');
    return [];
  }

  agents.forEach(agent => {
    const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent.id);
    if (!existing) {
      createAgent(agent);
      console.log(`  ✓ Created agent: ${agent.name}`);
    } else {
      console.log(`  - Agent ${agent.name} already exists, skipping`);
    }
  });

  return agents;
}

// Seed tasks
function seedTasks(agents) {
  console.log('Seeding tasks...');

  const agentByName = new Map(
    (agents || []).map((agent) => [agent.name.toLowerCase(), agent.id])
  );
  const defaultAgentId = agents?.[0]?.id ?? null;
  const resolveAgentId = (name) => {
    if (!name) return defaultAgentId;
    return agentByName.get(name.toLowerCase()) ?? defaultAgentId;
  };
  
  const tasks = [
    {
      title: 'Set up Mission Control dashboard',
      description: 'Build the frontend interface for task management',
      status: 'done',
      assignedAgent: resolveAgentId('Patch'),
      priority: 'high',
      tags: ['frontend', 'react'],
    },
    {
      title: 'Implement WebSocket real-time updates',
      description: 'Add Socket.io for live task updates across all clients',
      status: 'done',
      assignedAgent: resolveAgentId('Patch'),
      priority: 'high',
      tags: ['backend', 'websocket'],
    },
    {
      title: 'Research AI model performance',
      description: 'Analyze latest Claude models for task planning capabilities',
      status: 'in-progress',
      assignedAgent: resolveAgentId('Nova'),
      priority: 'medium',
      tags: ['research', 'ai'],
    },
    {
      title: 'Deploy to production server',
      description: 'Set up PM2 and configure production environment',
      status: 'todo',
      assignedAgent: resolveAgentId('Scout'),
      priority: 'critical',
      tags: ['ops', 'deployment'],
    },
    {
      title: 'Add user authentication',
      description: 'Implement JWT-based auth system',
      status: 'done',
      assignedAgent: resolveAgentId('Patch'),
      priority: 'high',
      tags: ['backend', 'security'],
    },
    {
      title: 'Create API documentation',
      description: 'Document all REST endpoints and WebSocket events',
      status: 'in-progress',
      assignedAgent: resolveAgentId('Patch'),
      priority: 'medium',
      tags: ['docs'],
    },
    {
      title: 'Monitor system health',
      description: 'Set up health checks and alerting',
      status: 'todo',
      assignedAgent: resolveAgentId('Scout'),
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
      assignedAgent: resolveAgentId('Atlas'),
      priority: 'medium',
      tags: ['architecture', 'research'],
    },
    {
      title: 'Test multi-agent workflows',
      description: 'Verify task handoff and collaboration features',
      status: 'todo',
      assignedAgent: resolveAgentId('Nova'),
      priority: 'high',
      tags: ['testing', 'qa'],
    },
  ];

  tasks.forEach(task => {
    createTask({
      ...task,
      createdBy: resolveAgentId('Patch'),
    });
    console.log(`  ✓ Created task: ${task.title}`);
  });
}

// Main seed function
async function seed() {
  try {
    console.log('\n🌱 Starting database seed...\n');
    
    clearData();
    const agents = await seedAgents();
    seedTasks(agents);
    
    console.log('\n✅ Database seeded successfully!\n');
    console.log('You can now start the server with: npm run server\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
}

seed();
