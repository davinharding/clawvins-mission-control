#!/usr/bin/env node
import { getAllTasks, createTask, deleteTask, db } from './server/db.js';

console.log('Testing API filter fix...\n');

// Create test tasks
const task1 = createTask({
  title: 'Test Task 1',
  status: 'todo',
  assignedAgent: 'agent-patch',
  priority: 'high'
});
console.log('✓ Created task1:', task1.id, '(todo, agent-patch)');

const task2 = createTask({
  title: 'Test Task 2',
  status: 'todo',
  assignedAgent: 'agent-other',
  priority: 'medium'
});
console.log('✓ Created task2:', task2.id, '(todo, agent-other)');

const task3 = createTask({
  title: 'Test Task 3',
  status: 'in-progress',
  assignedAgent: 'agent-patch',
  priority: 'low'
});
console.log('✓ Created task3:', task3.id, '(in-progress, agent-patch)\n');

// Test filters
console.log('Testing filters:');

const allTasks = getAllTasks();
console.log(`  getAllTasks() => ${allTasks.length} tasks`);

const todoTasks = getAllTasks({ status: 'todo' });
console.log(`  getAllTasks({ status: 'todo' }) => ${todoTasks.length} tasks`);

const patchTasks = getAllTasks({ assignedAgent: 'agent-patch' });
console.log(`  getAllTasks({ assignedAgent: 'agent-patch' }) => ${patchTasks.length} tasks`);

const todoPatchTasks = getAllTasks({ status: 'todo', assignedAgent: 'agent-patch' });
console.log(`  getAllTasks({ status: 'todo', assignedAgent: 'agent-patch' }) => ${todoPatchTasks.length} tasks\n`);

// Verify the combined filter
const hasOurTask = todoPatchTasks.some(t => t.id === task1.id);
const hasOtherStatusTask = todoPatchTasks.some(t => t.status !== 'todo');
const hasOtherAgentTask = todoPatchTasks.some(t => t.assigned_agent !== 'agent-patch');

if (hasOurTask && !hasOtherStatusTask && !hasOtherAgentTask && todoPatchTasks.length < todoTasks.length) {
  console.log('✅ SUCCESS! Combined filter correctly filters by BOTH status AND agent');
  console.log(`   - Returns ${todoPatchTasks.length} tasks (not all ${todoTasks.length} todo tasks)`);
  console.log('   - All results have status=todo AND assignedAgent=agent-patch');
} else {
  console.log('❌ FAILED! Combined filter not working correctly');
  if (!hasOurTask) console.log('   - Missing our test task');
  if (hasOtherStatusTask) console.log('   - Found tasks with wrong status');
  if (hasOtherAgentTask) console.log('   - Found tasks with wrong agent');
  if (todoPatchTasks.length >= todoTasks.length) console.log('   - Returning too many tasks (not filtering by agent)');
}

// Cleanup
deleteTask(task1.id);
deleteTask(task2.id);
deleteTask(task3.id);
console.log('\n✓ Cleaned up test tasks');

db.close();
