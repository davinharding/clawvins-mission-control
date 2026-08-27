#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTask,
  hasPendingJobForTask,
  recordBlocked,
  recordDispatch,
  wasAlreadyDispatched,
} from './core.mjs';

const DISPATCH_DIR = process.env.DISPATCH_DIR || '/home/node/.openclaw/workspace/.dispatcher';
const ROUTING_PATH = process.env.DISPATCH_ROUTING || `${DISPATCH_DIR}/routing.json`;
const STATE_PATH = process.env.DISPATCH_STATE || `${DISPATCH_DIR}/state.json`;
const HEARTBEAT_PATH = process.env.DISPATCH_HEARTBEAT || `${DISPATCH_DIR}/heartbeat`;
const POLL_INTERVAL_MS = Number(process.env.DISPATCH_POLL_MS || 300_000);
const STALE_IN_PROGRESS_MS = Number(process.env.DISPATCH_STALE_IN_PROGRESS_MS || 45 * 60_000);
const LOCK_STALE_MS = Number(process.env.DISPATCH_LOCK_STALE_MS || 30 * 60_000);
const DRY_RUN = process.env.DISPATCH_DRY_RUN === '1';
const RUN_ONCE = process.env.DISPATCH_ONCE === '1';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const DEFAULT_MC_HELPER = '/home/node/.openclaw/bin/mc-tasks';

const log = (...args) => console.log(new Date().toISOString(), ...args);

function routingConfig() {
  return JSON.parse(readFileSync(ROUTING_PATH, 'utf8'));
}

function helperRequest(routing, apiPath) {
  const helper = routing.mcHelperPath || process.env.DISPATCH_MC_HELPER || DEFAULT_MC_HELPER;
  const agentId = routing.mcHelperAgentId || process.env.DISPATCH_MC_AGENT_ID || 'agent-patch';
  const result = spawnSync(helper, [agentId, 'GET', apiPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Mission Control helper failed for ${apiPath}: ${(result.stderr || '').trim().slice(0, 300)}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Mission Control helper returned invalid JSON for ${apiPath}: ${error.message}`);
  }
}

function readBoard(routing) {
  return helperRequest(routing, '/api/tasks').tasks || [];
}

function readComments(routing, taskId) {
  return helperRequest(routing, `/api/tasks/${encodeURIComponent(taskId)}/comments`).comments || [];
}

function listPendingDispatchJobs() {
  const result = spawnSync(OPENCLAW_BIN, ['cron', 'list', '--json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    log('WARN cron list failed:', (result.stderr || '').trim().slice(0, 300));
    return [];
  }
  try {
    return (JSON.parse(result.stdout).jobs || []).map((job) => job.name).filter(Boolean);
  } catch (error) {
    log('WARN cron list parse:', error.message);
    return [];
  }
}

function loadState() {
  if (!existsSync(STATE_PATH)) return { version: 2, tasks: {} };
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    if (parsed.version === 2 && parsed.tasks) return parsed;
    return { version: 2, tasks: parsed.dispatched || {} };
  } catch {
    return { version: 2, tasks: {} };
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const temporary = `${STATE_PATH}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, STATE_PATH);
}

function acquireCycleLock(now) {
  const lockPath = `${STATE_PATH}.lock`;
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    try {
      const owner = JSON.parse(readFileSync(`${lockPath}/owner.json`, 'utf8'));
      if (now - owner.acquiredAtMs <= LOCK_STALE_MS) return null;
    } catch {
      return null;
    }
    rmSync(lockPath, { recursive: true });
    mkdirSync(lockPath);
  }
  writeFileSync(`${lockPath}/owner.json`, JSON.stringify({ pid: process.pid, acquiredAtMs: now }));
  return () => rmSync(lockPath, { recursive: true });
}

function renderMessage(template, task, routing) {
  const discordTarget = routing.discordTargets?.[task.assignedAgent] || '';
  return template
    .replaceAll('{{taskId}}', task.id)
    .replaceAll('{{title}}', task.title || task.id)
    .replaceAll('{{assignedAgent}}', task.assignedAgent || '')
    .replaceAll('{{status}}', task.status)
    .replaceAll('{{discordTarget}}', discordTarget);
}

function enqueueWake(jobName, rule, wakeAgentId, task, routing) {
  const args = [
    'cron', 'add', '--name', jobName, '--agent', wakeAgentId,
    '--at', new Date(Date.now() + 15_000).toISOString(),
    '--message', renderMessage(rule.message, task, routing),
    '--session', 'isolated', '--wake', 'now', '--delete-after-run', '--no-deliver',
    '--light-context', '--timeout-seconds', String(rule.timeoutSeconds || 1200), '--json',
  ];
  if (DRY_RUN) {
    log(`[DRY] would enqueue ${jobName} -> agent=${wakeAgentId} (${rule.role})`);
    return true;
  }
  const result = spawnSync(OPENCLAW_BIN, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    log(`ERROR enqueue ${jobName}:`, (result.stderr || result.stdout || '').trim().slice(0, 300));
    return false;
  }
  log(`enqueued ${jobName} -> agent=${wakeAgentId} (${rule.role})`);
  return true;
}

export function runOnce(routing = routingConfig()) {
  const now = Date.now();
  const releaseLock = acquireCycleLock(now);
  if (!releaseLock) {
    log('cycle skipped: another dispatcher owns the state lock');
    return;
  }

  try {
    const tasks = readBoard(routing);
    const state = loadState();
    let pendingJobs = listPendingDispatchJobs();
    let actionable = 0;
    let dispatched = 0;

    for (const task of tasks) {
      let comments = [];
      if (task.status === 'in-progress' && !routing.rules.some((rule) => rule.status === task.status)) {
        try {
          comments = readComments(routing, task.id);
        } catch (error) {
          log(`WARN comments check failed for ${task.id}:`, error.message);
          continue;
        }
      }

      const candidate = evaluateTask({
        task,
        comments,
        routing,
        now,
        defaultStaleMs: STALE_IN_PROGRESS_MS,
      });
      if (!candidate) continue;

      const previous = state.tasks[task.id];
      if (candidate.kind === 'blocked') {
        if (previous?.lastObserved?.evidenceKey !== candidate.evidenceKey) {
          state.tasks[task.id] = recordBlocked(previous, candidate, now);
          log(`holding ${task.id}: unchanged external blocker (${candidate.blocker.source})`);
        }
        continue;
      }

      const wakeAgentId = candidate.rule.wakeAgentId || routing.agentIdMap?.[task.assignedAgent];
      if (!wakeAgentId) continue;
      actionable += 1;

      if (hasPendingJobForTask(pendingJobs, task.id)) continue;
      if (wasAlreadyDispatched(task, candidate, previous)) {
        if (!previous?.lastDispatch) {
          state.tasks[task.id] = recordDispatch(previous, candidate, task, wakeAgentId, previous.dispatchedAtMs || now);
        }
        continue;
      }

      // Re-read immediately before enqueue so a job created by another operator or
      // dispatcher cycle cannot overlap this task under a different status name.
      pendingJobs = listPendingDispatchJobs();
      if (hasPendingJobForTask(pendingJobs, task.id)) continue;

      const jobName = `dispatch-${task.id}-${candidate.jobStatus}`;
      if (enqueueWake(jobName, candidate.rule, wakeAgentId, task, routing)) {
        if (!DRY_RUN) state.tasks[task.id] = recordDispatch(previous, candidate, task, wakeAgentId, now);
        pendingJobs.push(jobName);
        dispatched += 1;
      }
    }

    if (!DRY_RUN) {
      saveState(state);
      writeFileSync(HEARTBEAT_PATH, String(now));
    }
    log(`cycle done tasks=${tasks.length} actionable=${actionable} dispatched=${dispatched}${DRY_RUN ? ' (dry-run)' : ''}`);
  } finally {
    releaseLock();
  }
}

async function main() {
  log(`dispatcher starting dryRun=${DRY_RUN} once=${RUN_ONCE} interval=${POLL_INTERVAL_MS}ms`);
  for (;;) {
    try {
      runOnce();
    } catch (error) {
      log('ERROR cycle:', error.message);
    }
    if (RUN_ONCE) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
