// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  evaluateTask,
  hasPendingJobForTask,
  recordDispatch,
  wasAlreadyDispatched,
} from '../../dispatcher/core.mjs';

const staleMs = 45 * 60_000;
const rule = { status: 'todo', role: 'Patch', wakeAgentId: 'coder', message: 'work {{taskId}}' };
const routing = { rules: [rule] };
const task = {
  id: 'task-loop',
  title: 'Loop',
  status: 'in-progress',
  assignedAgent: 'agent-patch',
  updatedAt: 1_000,
  tags: [],
};

describe('dispatcher stale resume durability', () => {
  it('does not repeat the same stale resume after the old 30-minute cooldown', () => {
    const firstNow = task.updatedAt + staleMs + 1;
    const first = evaluateTask({ task, comments: [], routing, now: firstNow, defaultStaleMs: staleMs });
    expect(first.kind).toBe('stale-resume');
    const state = recordDispatch(undefined, first, task, 'coder', firstNow);

    const thirtyMinutesLater = firstNow + 30 * 60_000 + 1;
    const repeated = evaluateTask({
      task,
      comments: [],
      routing,
      now: thirtyMinutesLater,
      defaultStaleMs: staleMs,
    });
    expect(wasAlreadyDispatched(task, repeated, state)).toBe(true);
  });

  it('holds an unchanged blocker and resumes only after newer evidence', () => {
    const blockedAt = task.updatedAt + 100;
    const blocker = {
      id: 'comment-blocked',
      authorId: 'agent-patch',
      text: 'Blocked: waiting for operator approval',
      createdAt: blockedAt,
    };
    const now = task.updatedAt + staleMs + 1;
    const blocked = evaluateTask({ task, comments: [blocker], routing, now, defaultStaleMs: staleMs });
    expect(blocked.kind).toBe('blocked');

    const explicitUserAction = {
      id: 'comment-unblock',
      authorId: 'user-davin',
      text: 'Approval granted; please resume.',
      createdAt: blockedAt + 1,
    };
    const resumed = evaluateTask({
      task,
      comments: [blocker, explicitUserAction],
      routing,
      now,
      defaultStaleMs: staleMs,
    });
    expect(resumed.kind).toBe('stale-resume');
    expect(resumed.evidenceKey).not.toBe(blocked.evidenceKey);
  });
});

describe('dispatcher task-wide dedupe', () => {
  it('recognizes a pending job for the task across status suffixes', () => {
    const jobs = ['dispatch-task-loop-todo'];
    expect(hasPendingJobForTask(jobs, 'task-loop')).toBe(true);
    expect(hasPendingJobForTask(jobs, 'task-other')).toBe(false);
  });

  it('migrates v1 state without immediately duplicating the wake', () => {
    const directTask = { ...task, status: 'todo' };
    const candidate = evaluateTask({
      task: directTask,
      comments: [],
      routing,
      now: 99_000,
      defaultStaleMs: staleMs,
    });
    const legacy = { status: 'todo', taskUpdatedAt: directTask.updatedAt, dispatchedAtMs: 50_000 };
    expect(wasAlreadyDispatched(directTask, candidate, legacy)).toBe(true);
  });
});
