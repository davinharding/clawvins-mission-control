import 'dotenv/config';
import { db, createAgent, createEvent, createTask } from './db.js';
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
  if (process.env.SEED_SAMPLE_TASKS !== 'true') {
    console.log('Skipping sample task seeding (set SEED_SAMPLE_TASKS=true to enable).');
    return;
  }

  console.log('Seeding sample tasks...');

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
      title: 'Mission Control Development',
      description: 'Real-time agent orchestration dashboard with WebSocket, task management, and live event feed',
      status: 'in-progress',
      assignedAgent: resolveAgentId('Patch'),
      priority: 'high',
      tags: ['frontend', 'backend', 'realtime'],
    },
    {
      title: 'File Explorer Modernization',
      description: 'Rebuild file explorer with Vite + React + TypeScript (blocked: rate limit)',
      status: 'backlog',
      assignedAgent: resolveAgentId('Patch'),
      priority: 'medium',
      tags: ['frontend'],
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

function seedEvents(agents) {
  console.log('Seeding events...');

  createEvent({
    type: 'system_seed',
    message: `Mission Control synced ${agents.length} agents from OpenClaw.`,
  });

  agents.slice(0, 6).forEach((agent) => {
    createEvent({
      type: 'agent_checkin',
      message: `${agent.name} checked in.`,
      agentId: agent.id,
    });
  });
}

// Main seed function
async function seed() {
  try {
    console.log('\n🌱 Starting database seed...\n');
    
    clearData();
    const agents = await seedAgents();
    seedEvents(agents);
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
