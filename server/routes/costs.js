import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { classifyCostRecord, detectProviderSubscriptions, sanitizeInteger, sanitizeNumber } from '../lib/cost-classification.js';

const router = express.Router();

const AGENTS_DIR = process.env.OPENCLAW_AGENTS_DIR || '/home/node/.openclaw/agents';
const OPENAI_SUBSCRIPTION_TYPE = process.env.MC_OPENAI_SUBSCRIPTION_TYPE || 'pro-lite';
const OPENAI_EQUIVALENT_PRICING = {
  'gpt-5.5': {
    inputPerMTok: numberFromEnv('MC_OPENAI_GPT_55_INPUT_PER_MTOK', 0.75),
    outputPerMTok: numberFromEnv('MC_OPENAI_GPT_55_OUTPUT_PER_MTOK', 10),
    cacheReadPerMTok: numberFromEnv('MC_OPENAI_GPT_55_CACHE_READ_PER_MTOK', 0),
    cacheWritePerMTok: numberFromEnv('MC_OPENAI_GPT_55_CACHE_WRITE_PER_MTOK', 0),
  },
  default: {
    inputPerMTok: numberFromEnv('MC_OPENAI_DEFAULT_INPUT_PER_MTOK', 0.75),
    outputPerMTok: numberFromEnv('MC_OPENAI_DEFAULT_OUTPUT_PER_MTOK', 10),
    cacheReadPerMTok: numberFromEnv('MC_OPENAI_DEFAULT_CACHE_READ_PER_MTOK', 0),
    cacheWritePerMTok: numberFromEnv('MC_OPENAI_DEFAULT_CACHE_WRITE_PER_MTOK', 0),
  },
};

const AGENT_MAP = {
  coder: { id: 'agent-patch', name: 'Patch' },
  clawvin: { id: 'agent-clawvin', name: 'Clawvin' },
  main: { id: 'agent-clawvin', name: 'Clawvin' },
  alpha: { id: 'agent-alpha', name: 'Alpha' },
  qa: { id: 'agent-cypress', name: 'Cypress' },
  nova: { id: 'agent-nova', name: 'Nova' },
  'stagesnap-business': { id: 'agent-scout', name: 'Scout' },
  training: { id: 'agent-atlas', name: 'Atlas' },
  finance: { id: 'agent-ledger', name: 'Ledger' },
  'health-tracking': { id: 'agent-vitals', name: 'Vitals' },
  outreach: { id: 'agent-iris', name: 'Iris' },
  iris: { id: 'agent-iris', name: 'Iris' },
  content: { id: 'agent-content', name: 'Content' },
};

/**
 * Aggregate cost data by time period (hour/day/week/month)
 * GET /api/costs?period=day&limit=30
 */
router.get('/', (req, res) => {
  try {
    const period = normalizePeriod(req.query.period || 'day'); // hour, day, week, month
    const limit = parseInt(req.query.limit, 10) || 30;

    const now = Date.now();
    const defaultFrom = now - (30 * 24 * 60 * 60 * 1000);
    const from = normalizeEpochMs(req.query.from, defaultFrom);
    const to = normalizeEpochMs(req.query.to, now);
    const fromTs = Math.min(from, to);
    const toTs = Math.max(from, to);

    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const weekStart = now - (7 * 24 * 60 * 60 * 1000);
    const monthStart = now - (30 * 24 * 60 * 60 * 1000);

    const baseQuery = `
        SELECT
          id,
          COALESCE(agent_id, 'unknown') AS agent_id,
          timestamp,
          COALESCE(json_extract(detail, '$.source'), source, 'openclaw-router') AS source,
          json_extract(detail, '$.cost') AS cost,
          COALESCE(json_extract(detail, '$.tokens'), 0) AS tokens,
          COALESCE(json_extract(detail, '$.model'), 'unknown') AS model,
          CASE ?
            WHEN 'hour' THEN CAST(strftime('%s', datetime(timestamp / 1000, 'unixepoch', 'localtime', 'start of hour', 'utc')) AS INTEGER) * 1000
            WHEN 'day' THEN CAST(strftime('%s', datetime(timestamp / 1000, 'unixepoch', 'localtime', 'start of day', 'utc')) AS INTEGER) * 1000
            WHEN 'week' THEN CAST(strftime('%s', datetime(timestamp / 1000, 'unixepoch', 'localtime', '-' || ((CAST(strftime('%w', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) + 6) % 7) || ' days', 'start of day', 'utc')) AS INTEGER) * 1000
            WHEN 'month' THEN CAST(strftime('%s', datetime(timestamp / 1000, 'unixepoch', 'localtime', 'start of month', 'utc')) AS INTEGER) * 1000
            ELSE CAST(strftime('%s', datetime(timestamp / 1000, 'unixepoch', 'localtime', 'start of day', 'utc')) AS INTEGER) * 1000
          END AS bucket_key
        FROM events
        WHERE detail IS NOT NULL
          AND json_valid(detail) = 1
          AND timestamp >= ?
          AND timestamp <= ?
          AND json_extract(detail, '$.cost') IS NOT NULL
        ORDER BY timestamp DESC
    `;

    const rawRows = db.prepare(baseQuery).all(period, fromTs, toTs);
    const subscriptions = {
      ...detectProviderSubscriptions().active,
      openai: detectProviderSubscriptions().active.openai || {
        provider: 'openai',
        type: OPENAI_SUBSCRIPTION_TYPE,
        source: 'openclaw-session-usage',
      },
    };
    const normalized = rawRows
      .map((row) => classifyCostRecord({
        id: row.id,
        agentId: row.agent_id || 'unknown',
        timestamp: sanitizeInteger(row.timestamp),
        source: String(row.source || 'openclaw-router'),
        cost: row.cost,
        tokens: row.tokens,
        model: row.model,
        bucketKey: sanitizeInteger(row.bucket_key),
      }, subscriptions))
      .filter((row) => row.cost > 0 && row.bucketKey > 0);
    const sessionUsageRows = loadOpenClawSessionUsageRows({ period, fromTs, toTs, subscriptions });

    const { deduped, skipped: dedupSkipped } = dedupeCostRows([...normalized, ...sessionUsageRows]);
    const summary = buildSummary(deduped, { todayStart, weekStart, monthStart });
    const periodData = buildPeriodData(deduped, limit);
    const providerBreakdown = buildGroupedBreakdown(deduped, (row) => row.provider, (row) => ({
      provider: row.provider,
      providerKey: row.providerKey,
      coverage: row.coverage,
      isCovered: row.isCovered,
      isAnthropic: row.isAnthropic,
      subscriptionType: row.subscriptionType,
    }));
    const agentBreakdown = buildGroupedBreakdown(deduped, (row) => row.agentId, (row) => ({
      agentId: row.agentId,
    }));
    const modelBreakdown = buildGroupedBreakdown(deduped, (row) => `${row.model}\n${row.provider}`, (row) => ({
      model: row.model,
      provider: row.provider,
      providerKey: row.providerKey,
      coverage: row.coverage,
      isCovered: row.isCovered,
    }));
    const sourceBreakdown = buildGroupedBreakdown(deduped, (row) => row.source, (row) => ({
      source: row.source,
    }));

    res.json({
      summary: {
        totalBilledCost: roundCost(summary.totalBilledCost),
        totalCoveredCost: roundCost(summary.totalCoveredCost),
        totalCoveredTokens: summary.totalCoveredTokens,
        totalAnthropicCost: roundCost(summary.totalCoveredCost),
        totalAnthropicTokens: summary.totalAnthropicTokens,
        todayBilledCost: roundCost(summary.todayBilledCost),
        weekBilledCost: roundCost(summary.weekBilledCost),
        monthBilledCost: roundCost(summary.monthBilledCost),
        todayCoveredCost: roundCost(summary.todayCoveredCost),
        weekCoveredCost: roundCost(summary.weekCoveredCost),
        monthCoveredCost: roundCost(summary.monthCoveredCost),
        todayAnthropicCost: roundCost(summary.todayCoveredCost),
        weekAnthropicCost: roundCost(summary.weekCoveredCost),
        monthAnthropicCost: roundCost(summary.monthCoveredCost),
        todayTotalCost: roundCost(summary.todayBilledCost + summary.todayCoveredCost),
        weekTotalCost: roundCost(summary.weekBilledCost + summary.weekCoveredCost),
        monthTotalCost: roundCost(summary.monthBilledCost + summary.monthCoveredCost),
        subscriptions,
        dedupSkipped: dedupSkipped.length,
      },
      periodData,
      providerBreakdown,
      agentBreakdown,
      modelBreakdown,
      sourceBreakdown,
      deduplication: {
        skipped: dedupSkipped.length,
        details: dedupSkipped.slice(0, 10).map((row) => ({
          model: row.model,
          timestamp: row.timestamp,
          cost: row.cost,
          source: row.source,
        })),
      },
    });
  } catch (err) {
    console.error('Error fetching cost data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Extract provider name from model string
 */
function normalizeEpochMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePeriod(value) {
  const normalized = String(value || '').toLowerCase();
  if (['hour', 'day', 'week', 'month'].includes(normalized)) {
    return normalized;
  }
  return 'day';
}

function loadOpenClawSessionUsageRows({ period, fromTs, toTs, subscriptions }) {
  const rows = [];
  const seenSessionIds = new Set();

  let agentDirs = [];
  try {
    agentDirs = fs.readdirSync(AGENTS_DIR);
  } catch {
    return rows;
  }

  for (const agentDir of agentDirs) {
    const sessionsDir = path.join(AGENTS_DIR, agentDir, 'sessions');
    if (!isDirectory(sessionsDir)) continue;

    const agent = AGENT_MAP[agentDir] || { id: `agent-${agentDir}`, name: agentDir };
    const sessionMeta = readSessionMeta(sessionsDir);

    let files = [];
    try {
      files = fs.readdirSync(sessionsDir)
        .filter((file) => file.endsWith('.jsonl') && !file.endsWith('.trajectory.jsonl'))
        .map((file) => path.join(sessionsDir, file));
    } catch {
      continue;
    }

    for (const filePath of files) {
      const sessionId = path.basename(filePath, '.jsonl');
      const stat = safeStat(filePath);
      if (stat && stat.mtimeMs < fromTs - 24 * 60 * 60 * 1000) continue;

      const meta = sessionMeta.bySessionId.get(sessionId) || {};
      const records = readSessionUsageRecords(filePath, {
        agent,
        agentDir,
        sessionId,
        sessionKey: meta.sessionKey || `${agentDir}:${sessionId}`,
        period,
        fromTs,
        toTs,
        subscriptions,
      });

      if (records.length > 0) {
        seenSessionIds.add(sessionId);
        rows.push(...records);
      }
    }

    for (const [sessionKey, meta] of sessionMeta.bySessionKey.entries()) {
      if (!meta.sessionId || seenSessionIds.has(meta.sessionId)) continue;
      const record = buildAggregateSessionUsageRecord({
        agent,
        agentDir,
        sessionKey,
        meta,
        period,
        fromTs,
        toTs,
        subscriptions,
      });
      if (record) rows.push(record);
    }
  }

  return rows;
}

function readSessionUsageRecords(filePath, context) {
  const rows = [];
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return rows;
  }

  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'message') continue;
    const message = entry.message || {};
    if (message.role !== 'assistant') continue;

    const usage = normalizeUsage(message.usage);
    if (!usage || usage.totalTokens <= 0) continue;

    const timestamp = normalizeTimestamp(entry.timestamp || message.timestamp);
    if (timestamp < context.fromTs || timestamp > context.toTs) continue;

    const model = String(message.model || entry.model || 'unknown');
    if (!isOpenAIModel(model, message.provider || entry.provider)) continue;

    const cost = calculateOpenAIEquivalentCost(model, usage);
    rows.push(classifyCostRecord({
      id: `openclaw-session-${context.sessionId}-${entry.id || timestamp}`,
      agentId: context.agent.id,
      timestamp,
      source: 'openclaw-session-usage',
      cost,
      tokens: usage.totalTokens,
      model,
      bucketKey: bucketKeyForTimestamp(timestamp, context.period),
    }, context.subscriptions));
  }

  return rows;
}

function buildAggregateSessionUsageRecord({ agent, agentDir, sessionKey, meta, period, fromTs, toTs, subscriptions }) {
  const timestamp = sanitizeInteger(meta.updatedAt || meta.lastInteractionAt || meta.sessionStartedAt);
  if (timestamp < fromTs || timestamp > toTs) return null;

  const usage = normalizeUsage({
    input: meta.inputTokens,
    output: meta.outputTokens,
    cacheRead: meta.cacheRead,
    cacheWrite: meta.cacheWrite,
    totalTokens: meta.totalTokens,
  });
  if (!usage || usage.totalTokens <= 0) return null;

  const model = String(meta.model || 'unknown');
  if (!isOpenAIModel(model, meta.modelProvider || meta.provider)) return null;

  const explicitCost = sanitizeNumber(meta.estimatedCostUsd);
  const cost = explicitCost > 0 ? explicitCost : calculateOpenAIEquivalentCost(model, usage);
  return classifyCostRecord({
    id: `openclaw-session-aggregate-${agentDir}-${meta.sessionId || sessionKey}`,
    agentId: agent.id,
    timestamp,
    source: 'openclaw-session-aggregate',
    cost,
    tokens: usage.totalTokens,
    model,
    bucketKey: bucketKeyForTimestamp(timestamp, period),
  }, subscriptions);
}

function readSessionMeta(sessionsDir) {
  const bySessionId = new Map();
  const bySessionKey = new Map();
  const filePath = path.join(sessionsDir, 'sessions.json');
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { bySessionId, bySessionKey };
  }

  for (const [sessionKey, meta] of Object.entries(data)) {
    const value = { ...meta, sessionKey };
    bySessionKey.set(sessionKey, value);
    if (meta?.sessionId) bySessionId.set(meta.sessionId, value);
  }
  return { bySessionId, bySessionKey };
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const input = sanitizeInteger(usage.input ?? usage.inputTokens ?? usage.prompt_tokens);
  const output = sanitizeInteger(usage.output ?? usage.outputTokens ?? usage.completion_tokens);
  const cacheRead = sanitizeInteger(usage.cacheRead ?? usage.cache_read ?? usage.cachedInputTokens);
  const cacheWrite = sanitizeInteger(usage.cacheWrite ?? usage.cache_write);
  const totalTokens = sanitizeInteger(usage.totalTokens ?? usage.total_tokens ?? input + output + cacheRead + cacheWrite);

  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens: totalTokens || input + output + cacheRead + cacheWrite,
  };
}

function calculateOpenAIEquivalentCost(model, usage) {
  const pricing = getOpenAIPricing(model);
  return (
    usage.input * pricing.inputPerMTok +
    usage.output * pricing.outputPerMTok +
    usage.cacheRead * pricing.cacheReadPerMTok +
    usage.cacheWrite * pricing.cacheWritePerMTok
  ) / 1_000_000;
}

function getOpenAIPricing(model) {
  const normalized = String(model || '').trim().toLowerCase();
  if (normalized.includes('gpt-5.5')) return OPENAI_EQUIVALENT_PRICING['gpt-5.5'];
  return OPENAI_EQUIVALENT_PRICING.default;
}

function isOpenAIModel(model, provider = '') {
  const text = `${model || ''} ${provider || ''}`.toLowerCase();
  return /\b(openai|codex|chatgpt|gpt-?[\w.]*)\b/.test(text);
}

function bucketKeyForTimestamp(timestamp, period) {
  const date = new Date(timestamp);
  if (period === 'hour') {
    date.setMinutes(0, 0, 0);
    return date.getTime();
  }
  if (period === 'week') {
    const day = date.getDay();
    const diff = (day + 6) % 7;
    date.setDate(date.getDate() - diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  if (period === 'month') {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function normalizeTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function dedupeCostRows(rows) {
  const routerKeys = new Set(
    rows
      .filter((row) => row.source === 'openclaw-router')
      .map((row) => `${row.providerKey}|${row.model.toLowerCase()}|${row.bucketKey}`)
  );

  const deduped = [];
  const skipped = [];

  for (const row of rows) {
    const isOpenAIUsage = row.source === 'openai-usage-api';
    const duplicateKey = `${row.providerKey}|${row.model.toLowerCase()}|${row.bucketKey}`;
    if (isOpenAIUsage && routerKeys.has(duplicateKey)) {
      skipped.push(row);
      continue;
    }
    deduped.push(row);
  }

  return { deduped, skipped };
}

function buildSummary(rows, windows) {
  const summary = {
    totalBilledCost: 0,
    totalCoveredCost: 0,
    totalCoveredTokens: 0,
    totalAnthropicTokens: 0,
    todayBilledCost: 0,
    weekBilledCost: 0,
    monthBilledCost: 0,
    todayCoveredCost: 0,
    weekCoveredCost: 0,
    monthCoveredCost: 0,
  };

  for (const row of rows) {
    addCoverage(summary, row, '');
    if (row.timestamp >= windows.todayStart) addCoverage(summary, row, 'today');
    if (row.timestamp >= windows.weekStart) addCoverage(summary, row, 'week');
    if (row.timestamp >= windows.monthStart) addCoverage(summary, row, 'month');
    if (row.isCovered) summary.totalCoveredTokens += row.tokens;
    if (row.isAnthropic) summary.totalAnthropicTokens += row.tokens;
  }

  return summary;
}

function addCoverage(target, row, prefix) {
  const name = prefix ? `${prefix}${row.isCovered ? 'CoveredCost' : 'BilledCost'}` : `total${row.isCovered ? 'CoveredCost' : 'BilledCost'}`;
  target[name] += row.cost;
}

function buildPeriodData(rows, limit) {
  const byBucket = new Map();
  for (const row of rows) {
    const current = byBucket.get(row.bucketKey) || emptyBreakdown({ timestamp: row.bucketKey });
    addRowTotals(current, row);
    byBucket.set(row.bucketKey, current);
  }

  return [...byBucket.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(roundBreakdown);
}

function buildGroupedBreakdown(rows, getKey, initFromRow) {
  const groups = new Map();
  for (const row of rows) {
    const key = getKey(row);
    const current = groups.get(key) || emptyBreakdown(initFromRow(row));
    addRowTotals(current, row);
    if (row.isCovered) current.isCovered = true;
    if (row.isAnthropic) current.isAnthropic = true;
    groups.set(key, current);
  }

  return [...groups.values()]
    .sort((a, b) => b.cost - a.cost)
    .map(roundBreakdown);
}

function emptyBreakdown(base) {
  return {
    ...base,
    cost: 0,
    billedCost: 0,
    coveredCost: 0,
    anthropicCost: 0,
    tokens: 0,
    count: 0,
    isCovered: false,
    isAnthropic: false,
  };
}

function addRowTotals(target, row) {
  target.cost += row.cost;
  target.totalCost = target.cost;
  target.tokens += row.tokens;
  target.count += 1;
  if (row.isCovered) {
    target.coveredCost += row.cost;
    target.anthropicCost += row.cost;
  } else {
    target.billedCost += row.cost;
  }
}

function roundBreakdown(item) {
  return {
    ...item,
    cost: roundCost(item.cost),
    totalCost: roundCost(item.totalCost ?? item.cost),
    billedCost: roundCost(item.billedCost),
    coveredCost: roundCost(item.coveredCost),
    anthropicCost: roundCost(item.anthropicCost),
  };
}

function roundCost(value) {
  return parseFloat(sanitizeNumber(value).toFixed(4));
}

export default router;
