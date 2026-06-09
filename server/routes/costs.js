import express from 'express';
import { db } from '../db.js';
import { classifyCostRecord, detectProviderSubscriptions, sanitizeInteger, sanitizeNumber } from '../lib/cost-classification.js';

const router = express.Router();

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
    const subscriptions = detectProviderSubscriptions().active;
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

    const { deduped, skipped: dedupSkipped } = dedupeCostRows(normalized);
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
