import { describe, it, expect } from 'vitest';
import { getFilteredEvents } from '@/components/EventFeed';
import { groupEventsByLocalDate, mergeEventsById } from '@/lib/events';
import type { EventItem } from '@/lib/api';

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

  it('deduplicates initial and realtime events by their unique IDs', () => {
    const realtimeUpdate = { ...events[0], message: 'Realtime copy', timestamp: 3000 };
    const merged = mergeEventsById(events, [realtimeUpdate]);

    expect(merged).toHaveLength(2);
    expect(merged.map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(merged[0].message).toBe('Realtime copy');
  });

  it('groups events by local calendar date rather than elapsed hours', () => {
    const today = new Date(2026, 7, 29, 0, 5).getTime();
    const yesterday = new Date(2026, 7, 28, 23, 55).getTime();
    const grouped = groupEventsByLocalDate(
      [
        { ...events[0], id: 'today', timestamp: today },
        { ...events[1], id: 'yesterday', timestamp: yesterday },
      ],
      new Date(2026, 7, 29, 12).getTime(),
    );

    expect(grouped.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
    expect(grouped.map((group) => group.events.map((event) => event.id))).toEqual([
      ['today'],
      ['yesterday'],
    ]);
  });
});
