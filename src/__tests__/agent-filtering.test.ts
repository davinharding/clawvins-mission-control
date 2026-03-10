import { describe, it, expect } from 'vitest';
import type { Agent, Task } from '@/lib/api';

const agents: Agent[] = [
  { id: 'a1', name: 'Ada Lovelace', role: 'Dev', status: 'online', lastActive: 1 },
  { id: 'a2', name: 'Grace Hopper', role: 'Main', status: 'busy', lastActive: 2 },
  { id: 'a3', name: 'Linus Torvalds', role: 'Ops', status: 'offline', lastActive: 3 },
];

const tasks: Task[] = [
  {
    id: 't1',
    title: 'Task 1',
    status: 'todo',
    assignedAgent: 'a1',
    createdAt: 1,
    updatedAt: 1,
    tags: [],
  },
  {
    id: 't2',
    title: 'Task 2',
    status: 'in-progress',
    assignedAgent: 'a2',
    createdAt: 2,
    updatedAt: 2,
    tags: [],
  },
  {
    id: 't3',
    title: 'Task 3',
    status: 'testing',
    assignedAgent: 'a3',
    createdAt: 3,
    updatedAt: 3,
    tags: [],
  },
];

describe('Agent filtering', () => {
  it('filters tasks by agent', () => {
    const selectedAgentId = 'a2';
    const visibleAgents = agents;
    const visibleAgentIds = new Set(visibleAgents.map((agent) => agent.id));

    const baseFiltered = tasks.filter((task) =>
      selectedAgentId ? task.assignedAgent === selectedAgentId : task.assignedAgent && visibleAgentIds.has(task.assignedAgent)
    );

    expect(baseFiltered.map((task) => task.id)).toEqual(['t2']);
  });

  it('filters tasks by role', () => {
    const selectedRole: Agent['role'] = 'Dev';
    const visibleAgents = agents.filter((agent) => agent.role === selectedRole);
    const visibleAgentIds = new Set(visibleAgents.map((agent) => agent.id));

    const roleFiltered = tasks.filter((task) => task.assignedAgent && visibleAgentIds.has(task.assignedAgent));

    expect(roleFiltered.map((task) => task.id)).toEqual(['t1']);
  });
});
