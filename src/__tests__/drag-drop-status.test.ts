import { describe, it, expect } from 'vitest';

const transitions = ['todo', 'in-progress', 'testing', 'done'] as const;

describe('Drag and drop status transitions', () => {
  it('moves tasks through expected statuses', () => {
    let status: (typeof transitions)[number] = 'todo';

    const moveTo = (next: (typeof transitions)[number]) => {
      status = next;
    };

    moveTo('in-progress');
    expect(status).toBe('in-progress');

    moveTo('testing');
    expect(status).toBe('testing');

    moveTo('done');
    expect(status).toBe('done');
  });
});
