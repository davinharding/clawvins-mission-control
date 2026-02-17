#!/usr/bin/env node

/**
 * Test Agent Task Integration
 * Comprehensive test script for agent task notification and API
 */

import fetch from 'node:fetch';

const API_URL = process.env.API_URL || 'http://localhost:3002';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'patch';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'REDACTED';

let authToken = null;

async function login() {
  console.log('\n🔐 Logging in...');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  authToken = data.token;
  console.log('✅ Logged in successfully');
  return authToken;
}

async function createTestTask() {
  console.log('\n📝 Creating test task...');
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      title: 'Test Agent Integration',
      description: 'Testing agent notification and API integration',
      status: 'backlog',
      priority: 'high',
      tags: ['test', 'integration'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ Created task: ${data.task.id}`);
  return data.task;
}

async function assignTaskToAgent(taskId, agentId) {
  console.log(`\n👤 Assigning task ${taskId} to ${agentId}...`);
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      assignedAgent: agentId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to assign task: ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ Assigned task to ${agentId}`);
  console.log('   → Agent should receive notification now');
  return data.task;
}

async function getAgentTasks() {
  console.log('\n📋 Fetching agent tasks...');
  const response = await fetch(`${API_URL}/api/agent-tasks/mine`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agent tasks: ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ Retrieved ${data.count} tasks`);
  data.tasks.forEach(task => {
    console.log(`   - ${task.id}: ${task.title} (${task.status})`);
  });
  return data.tasks;
}

async function updateTaskStatus(taskId, status) {
  console.log(`\n⚡ Updating task ${taskId} status to ${status}...`);
  const response = await fetch(`${API_URL}/api/agent-tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update status: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`✅ Updated task status to ${status}`);
  return data.task;
}

async function addComment(taskId, content) {
  console.log(`\n💬 Adding comment to task ${taskId}...`);
  const response = await fetch(`${API_URL}/api/agent-tasks/${taskId}/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add comment: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`✅ Added comment: ${data.comment.text}`);
  return data.comment;
}

async function getTaskDetails(taskId) {
  console.log(`\n🔍 Fetching task details for ${taskId}...`);
  const response = await fetch(`${API_URL}/api/agent-tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch task: ${response.status}`);
  }

  const data = await response.json();
  console.log(`✅ Task: ${data.task.title}`);
  console.log(`   Status: ${data.task.status}`);
  console.log(`   Priority: ${data.task.priority}`);
  console.log(`   Assigned to: ${data.task.assignedAgent || 'unassigned'}`);
  return data.task;
}

async function runTests() {
  try {
    console.log('🚀 Starting Agent Task Integration Tests');
    console.log(`   API URL: ${API_URL}`);

    // 1. Login
    await login();

    // 2. Create test task
    const task = await createTestTask();

    // 3. Assign to Patch (agent-patch)
    await assignTaskToAgent(task.id, 'agent-patch');
    console.log('\n⏳ Waiting 2 seconds for notification to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Get agent tasks
    const agentTasks = await getAgentTasks();

    // 5. Update task status
    await updateTaskStatus(task.id, 'in-progress');

    // 6. Add comment
    await addComment(task.id, 'Started working on this integration test');

    // 7. Get updated task details
    await getTaskDetails(task.id);

    // 8. Complete task
    await updateTaskStatus(task.id, 'done');

    console.log('\n✅ All tests passed!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Task created');
    console.log('   ✓ Task assigned to agent');
    console.log('   ✓ Agent notified (check Discord #patch-dev-work)');
    console.log('   ✓ Agent tasks retrieved via API');
    console.log('   ✓ Task status updated via agent API');
    console.log('   ✓ Comment added via agent API');
    console.log('   ✓ Task details retrieved');
    console.log('   ✓ Task marked as complete');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Check Discord #patch-dev-work for task notification');
    console.log('   2. Check Mission Control UI for real-time updates');
    console.log('   3. Verify WebSocket broadcasts are working');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
