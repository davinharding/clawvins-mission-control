import { createHash } from 'node:crypto';

const BLOCKED_TAGS = new Set(['blocked', 'on-hold', 'on_hold', 'waiting-external']);
const BLOCKER_PATTERN = /(?:^|\b)(?:blocked|on[ -]hold|waiting (?:for|on)|external blocker|cannot proceed|need(?:s)? (?:user|operator|approval|access))\b/i;

export function commentTimeMs(comment) {
  const raw = comment.createdAt ?? comment.created_at ?? comment.createdAtMs ?? comment.timestamp ?? comment.updatedAt;
  const time = typeof raw === 'number' ? raw : Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
}

export function evidenceKey(task, comments = []) {
  const latest = [...comments].sort((a, b) => commentTimeMs(b) - commentTimeMs(a))[0];
  return stableHash({
    status: task.status,
    assignedAgent: task.assignedAgent,
    updatedAt: task.updatedAt,
    tags: [...(task.tags || [])].sort(),
    latestComment: latest && {
      id: latest.id,
      author: latest.authorId ?? latest.author_id ?? latest.agentId,
      text: latest.text ?? latest.content,
      at: commentTimeMs(latest),
    },
  });
}

export function blockedEvidence(task, comments = []) {
  const blockedTag = (task.tags || []).find((tag) => BLOCKED_TAGS.has(String(tag).toLowerCase()));
  if (blockedTag) return { source: 'tag', value: blockedTag };

  const ordered = [...comments].sort((a, b) => commentTimeMs(b) - commentTimeMs(a));
  const blocker = ordered.find((comment) => {
    const author = comment.authorId ?? comment.author_id ?? comment.agentId ?? '';
    const text = comment.text ?? comment.content ?? '';
    return author === task.assignedAgent && BLOCKER_PATTERN.test(text);
  });
  if (!blocker) return null;

  const blockerAt = commentTimeMs(blocker);
  const supersededByComment = ordered.some((comment) => commentTimeMs(comment) > blockerAt);
  const supersededByTaskUpdate = Number(task.updatedAt || 0) > blockerAt;
  if (supersededByComment || supersededByTaskUpdate) return null;
  return { source: 'comment', value: blocker.id || blockerAt };
}

export function matchRule(task, rules) {
  const matches = rules.filter((rule) => rule.status === task.status);
  return matches.find((rule) => rule.assignedAgent === task.assignedAgent)
    || matches.find((rule) => !rule.assignedAgent)
    || null;
}

export function evaluateTask({ task, comments = [], routing, now, defaultStaleMs }) {
  const directRule = matchRule(task, routing.rules);
  if (directRule) {
    return {
      kind: 'direct',
      jobStatus: task.status,
      rule: directRule,
      evidenceKey: evidenceKey(task),
    };
  }

  if (task.status !== 'in-progress' || !task.assignedAgent) return null;

  const staleMs = Number(routing.staleInProgressMs || defaultStaleMs);
  if (now - Number(task.updatedAt || 0) < staleMs) return null;

  const blocker = blockedEvidence(task, comments);
  if (blocker) {
    return { kind: 'blocked', evidenceKey: evidenceKey(task, comments), blocker };
  }

  const newestComment = [...comments].sort((a, b) => commentTimeMs(b) - commentTimeMs(a))[0];
  const newestCommentAuthor = newestComment?.authorId ?? newestComment?.author_id ?? newestComment?.agentId ?? '';
  const newestCommentAt = newestComment ? commentTimeMs(newestComment) : 0;
  const recentAgentComment = newestCommentAuthor === task.assignedAgent
    && newestCommentAt >= Number(task.updatedAt || 0)
    && now - newestCommentAt < staleMs;
  if (recentAgentComment) return null;

  const resumeRule = matchRule({ ...task, status: 'todo' }, routing.rules);
  if (!resumeRule) return null;

  return {
    kind: 'stale-resume',
    jobStatus: 'in-progress-stale',
    evidenceKey: evidenceKey(task, comments),
    rule: {
      ...resumeRule,
      role: `${resumeRule.role} stale-resume`,
      message: `STALE IN-PROGRESS RESUME: Resume this task only if its evidence is still unchanged. Do not post another pickup or blocker message when the same state was already reported.\n\n${resumeRule.message}`,
    },
  };
}

export function hasPendingJobForTask(jobNames, taskId) {
  const prefix = `dispatch-${taskId}-`;
  return jobNames.some((name) => typeof name === 'string' && name.startsWith(prefix));
}

export function wasAlreadyDispatched(task, candidate, previous) {
  const last = previous?.lastDispatch;
  if (last?.evidenceKey === candidate.evidenceKey) return true;

  // Upgrade the v1 runtime state without re-waking work that was already handed off.
  if (!last && previous?.status === candidate.jobStatus && previous.taskUpdatedAt === task.updatedAt) {
    return true;
  }
  return false;
}

export function recordDispatch(previous, candidate, task, wakeAgentId, now) {
  return {
    ...previous,
    lastDispatch: {
      kind: candidate.kind,
      status: candidate.jobStatus,
      evidenceKey: candidate.evidenceKey,
      taskUpdatedAt: task.updatedAt,
      wakeAgentId,
      dispatchedAtMs: now,
    },
    lastObserved: {
      evidenceKey: candidate.evidenceKey,
      disposition: 'dispatched',
      observedAtMs: now,
    },
  };
}

export function recordBlocked(previous, candidate, now) {
  return {
    ...previous,
    lastObserved: {
      evidenceKey: candidate.evidenceKey,
      disposition: 'blocked',
      blocker: candidate.blocker,
      observedAtMs: now,
    },
  };
}
