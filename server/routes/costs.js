import express from 'express';
import { db } from '../db.js';

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

    const baseCte = `
      WITH base AS (
        SELECT
          id,
          COALESCE(agent_id, 'unknown') AS agent_id,
          timestamp,
          COALESCE(source, 'openclaw-router') AS source,
          CAST(json_extract(detail, '$.cost') AS REAL) AS cost,
          CAST(COALESCE(json_extract(detail, '$.tokens'), 0) AS INTEGER) AS tokens,
          COALESCE(json_extract(detail, '$.model'), 'unknown') AS model,
          LOWER(COALESCE(json_extract(detail, '$.model'), '')) AS model_lower,
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
      ),
      normalized AS (
        SELECT
          id,
          agent_id,
          timestamp,
          source,
          cost,
          tokens,
          model,
          bucket_key,
          CASE
            WHEN model_lower LIKE '%claude%' OR model_lower LIKE '%anthropic%' OR model_lower LIKE '%sonnet%' OR model_lower LIKE '%opus%' OR model_lower LIKE '%haiku%'
            THEN 1
            ELSE 0
          END AS is_anthropic,
          CASE
            WHEN model_lower LIKE '%claude%' OR model_lower LIKE '%anthropic%' OR model_lower LIKE '%sonnet%' OR model_lower LIKE '%opus%' OR model_lower LIKE '%haiku%'
            THEN 'Anthropic (Max Plan)'
            WHEN model_lower LIKE '%gpt%' OR model_lower LIKE '%openai%'
            THEN 'OpenAI'
            WHEN model_lower LIKE '%deepseek%'
            THEN 'DeepSeek'
            WHEN model_lower LIKE '%gemini%' OR model_lower LIKE '%google%'
            THEN 'Google'
            WHEN model_lower LIKE '%llama%' OR model_lower LIKE '%meta%'
            THEN 'Meta'
            WHEN model_lower LIKE '%mistral%'
            THEN 'Mistral'
            WHEN model_lower LIKE '%cohere%'
            THEN 'Cohere'
            WHEN model_lower LIKE '%openrouter%'
            THEN 'OpenRouter'
            ELSE model
          END AS provider
        FROM base
      ),
      deduped AS (
        SELECT *
        FROM normalized n
        WHERE NOT (
          n.source = 'openai-usage-api'
          AND EXISTS (
            SELECT 1 FROM normalized r
            WHERE r.source = 'openclaw-router'
              AND r.model = n.model
              AND r.bucket_key = n.bucket_key
          )
        )
      )
    `;

    const summary = db.prepare(`
      ${baseCte}
      SELECT
        COALESCE(SUM(CASE WHEN is_anthropic = 0 THEN cost ELSE 0 END), 0) AS totalBilledCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 1 THEN cost ELSE 0 END), 0) AS totalAnthropicCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 1 THEN tokens ELSE 0 END), 0) AS totalAnthropicTokens,
        COALESCE(SUM(CASE WHEN is_anthropic = 0 AND timestamp >= ? THEN cost ELSE 0 END), 0) AS todayBilledCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 0 AND timestamp >= ? THEN cost ELSE 0 END), 0) AS weekBilledCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 0 AND timestamp >= ? THEN cost ELSE 0 END), 0) AS monthBilledCost
      FROM deduped
    `).get(period, fromTs, toTs, todayStart, weekStart, monthStart);

    const periodData = db.prepare(`
      ${baseCte}
      SELECT
        bucket_key AS timestamp,
        COALESCE(SUM(CASE WHEN is_anthropic = 0 THEN cost ELSE 0 END), 0) AS billedCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 1 THEN cost ELSE 0 END), 0) AS anthropicCost,
        COALESCE(SUM(cost), 0) AS totalCost,
        COUNT(*) AS count
      FROM deduped
      GROUP BY bucket_key
      ORDER BY bucket_key DESC
      LIMIT ?
    `).all(period, fromTs, toTs, limit);

    const providerBreakdown = db.prepare(`
      ${baseCte}
      SELECT
        provider,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(tokens), 0) AS tokens,
        COUNT(*) AS count,
        MAX(is_anthropic) AS isAnthropic
      FROM deduped
      GROUP BY provider
      ORDER BY cost DESC
    `).all(period, fromTs, toTs);

    const agentBreakdown = db.prepare(`
      ${baseCte}
      SELECT
        agent_id AS agentId,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(tokens), 0) AS tokens,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN is_anthropic = 1 THEN cost ELSE 0 END), 0) AS anthropicCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 0 THEN cost ELSE 0 END), 0) AS billedCost
      FROM deduped
      GROUP BY agent_id
      ORDER BY billedCost DESC
    `).all(period, fromTs, toTs);

    const sourceBreakdown = db.prepare(`
      ${baseCte}
      SELECT
        source,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(tokens), 0) AS tokens,
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN is_anthropic = 1 THEN cost ELSE 0 END), 0) AS anthropicCost,
        COALESCE(SUM(CASE WHEN is_anthropic = 0 THEN cost ELSE 0 END), 0) AS billedCost
      FROM deduped
      GROUP BY source
      ORDER BY cost DESC
    `).all(period, fromTs, toTs);

    const dedupSkipped = db.prepare(`
      ${baseCte}
      SELECT model, timestamp, cost
      FROM normalized n
      WHERE n.source = 'openai-usage-api'
        AND EXISTS (
          SELECT 1 FROM normalized r
          WHERE r.source = 'openclaw-router'
            AND r.model = n.model
            AND r.bucket_key = n.bucket_key
        )
      ORDER BY timestamp DESC
      LIMIT 10
    `).all(period, fromTs, toTs);

    const dedupSkippedCount = db.prepare(`
      ${baseCte}
      SELECT COUNT(*) AS count
      FROM normalized n
      WHERE n.source = 'openai-usage-api'
        AND EXISTS (
          SELECT 1 FROM normalized r
          WHERE r.source = 'openclaw-router'
            AND r.model = n.model
            AND r.bucket_key = n.bucket_key
        )
    `).get(period, fromTs, toTs).count;

    res.json({
      summary: {
        totalBilledCost: parseFloat(summary.totalBilledCost.toFixed(4)),
        totalAnthropicCost: parseFloat(summary.totalAnthropicCost.toFixed(4)),
        totalAnthropicTokens: summary.totalAnthropicTokens,
        todayBilledCost: parseFloat(summary.todayBilledCost.toFixed(4)),
        weekBilledCost: parseFloat(summary.weekBilledCost.toFixed(4)),
        monthBilledCost: parseFloat(summary.monthBilledCost.toFixed(4)),
        dedupSkipped: dedupSkippedCount,
      },
      periodData,
      providerBreakdown,
      agentBreakdown,
      sourceBreakdown,
      deduplication: {
        skipped: dedupSkippedCount,
        details: dedupSkipped,
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

export default router;
