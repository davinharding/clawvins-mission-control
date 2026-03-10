import { describe, it, expect } from 'vitest';
import { getFilteredEvents } from '@/components/EventFeed';
import type { Agent, EventItem } from '@/lib/api';

const agents: Agent[] = [
  { id: 'a1', name: 'Ada Lovelace', role: 'Dev', status: 'online', lastActive: 1 },
  { id: 'a2', name: 'Grace Hopper', role: 'Main', status: 'busy', lastActive: 2 },
];

const agentById = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

const events: EventItem[] = [
  {
    id: 'e1',
    type: 'task_created',
    message: 'Created task',
    agentId: 'a1',
    timestamp: 1000,
  },
  {
    id: 'e2',
    type: 'tool_call',
    message: 'Tool used',
    agentId: 'a2',
    timestamp: 2000,
  },
];

describe('Event feed', () => {
  it('renders events and filters by type', () => {
    const filtered = getFilteredEvents(events, 'tasks', 'all');
    expect(filtered.map((event) => event.id)).toEqual(['e1']);
  });

  it('filters events by agent', () => {
    const filtered = getFilteredEvents(events, 'all', 'a2');
    expect(filtered.map((event) => event.id)).toEqual(['e2']);
  });
});
