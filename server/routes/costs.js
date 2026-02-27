import express from 'express';
import { db } from '../db.js';

const router = express.Router();

/**
 * Aggregate cost data by time period (hour/day/week/month)
 * GET /api/costs?period=day&limit=30
 */
router.get('/', (req, res) => {
  try {
    const period = req.query.period || 'day'; // hour, day, week, month
    const limit = parseInt(req.query.limit) || 30;

    // Get all events with cost data, including source
    const events = db.prepare(`
      SELECT 
        id,
        type,
        message,
        agent_id,
        timestamp,
        detail,
        source
      FROM events 
      WHERE detail IS NOT NULL
      ORDER BY timestamp DESC
    `).all();

    // Parse and aggregate
    const costData = [];
    const providerTotals = {};
    const agentTotals = {};
    const periodBuckets = {};
    const sourceTotals = {};

    // Deduplication: track what we've seen from openclaw-router
    const routerSeen = new Set(); // model+bucketKey combinations
    const dedupSkipped = [];

    let totalBilledCost = 0;
    let totalAnthropicCost = 0;
    let totalAnthropicTokens = 0;

    // First pass: collect all openclaw-router entries to establish deduplication baseline
    for (const event of events) {
      if (!event.detail) continue;
      
      let detail;
      try {
        detail = JSON.parse(event.detail);
      } catch {
        continue;
      }

      if (!detail.cost || detail.cost === null) continue;

      const source = event.source || 'openclaw-router';
      if (source === 'openclaw-router') {
        const model = detail.model || 'unknown';
        const bucket = getBucketKey(event.timestamp, period);
        routerSeen.add(`${model}:${bucket}`);
      }
    }

    // Second pass: aggregate, skipping deduplicated entries
    for (const event of events) {
      if (!event.detail) continue;
      
      let detail;
      try {
        detail = JSON.parse(event.detail);
      } catch {
        continue;
      }

      if (!detail.cost || detail.cost === null) continue;

      const cost = parseFloat(detail.cost) || 0;
      const model = detail.model || 'unknown';
      const tokens = parseInt(detail.tokens) || 0;
      const agentId = event.agent_id || 'unknown';
      const timestamp = event.timestamp;
      const source = event.source || 'openclaw-router';

      // Deduplication: skip openai-usage-api entries if we already have router data for this model+bucket
      const bucketKey = getBucketKey(timestamp, period);
      const dedupKey = `${model}:${bucketKey}`;
      
      if (source === 'openai-usage-api' && routerSeen.has(dedupKey)) {
        dedupSkipped.push({ model, timestamp, cost });
        console.log(`[Costs] Deduplicated: ${model} at ${new Date(timestamp).toISOString()} ($${cost}) - already in router logs`);
        continue;
      }

      // Determine if this is Anthropic (included in Max plan)
      const isAnthropic = model.toLowerCase().includes('claude') || 
                         model.toLowerCase().includes('anthropic') ||
                         model.toLowerCase().includes('sonnet') ||
                         model.toLowerCase().includes('opus') ||
                         model.toLowerCase().includes('haiku');

      if (isAnthropic) {
        totalAnthropicCost += cost;
        totalAnthropicTokens += tokens;
      } else {
        totalBilledCost += cost;
      }

      // Source aggregation
      if (!sourceTotals[source]) {
        sourceTotals[source] = { cost: 0, billedCost: 0, anthropicCost: 0, tokens: 0, count: 0 };
      }
      sourceTotals[source].cost += cost;
      sourceTotals[source].tokens += tokens;
      sourceTotals[source].count += 1;
      if (isAnthropic) {
        sourceTotals[source].anthropicCost += cost;
      } else {
        sourceTotals[source].billedCost += cost;
      }

      // Provider aggregation
      const provider = isAnthropic ? 'Anthropic (Max Plan)' : extractProvider(model);
      if (!providerTotals[provider]) {
        providerTotals[provider] = { cost: 0, tokens: 0, count: 0, isAnthropic };
      }
      providerTotals[provider].cost += cost;
      providerTotals[provider].tokens += tokens;
      providerTotals[provider].count += 1;

      // Agent aggregation
      if (!agentTotals[agentId]) {
        agentTotals[agentId] = { cost: 0, billedCost: 0, anthropicCost: 0, tokens: 0, count: 0 };
      }
      agentTotals[agentId].cost += cost;
      agentTotals[agentId].tokens += tokens;
      agentTotals[agentId].count += 1;
      if (isAnthropic) {
        agentTotals[agentId].anthropicCost += cost;
      } else {
        agentTotals[agentId].billedCost += cost;
      }

      // Time period bucketing
      const bucketKey = getBucketKey(timestamp, period);
      if (!periodBuckets[bucketKey]) {
        periodBuckets[bucketKey] = { 
          timestamp: bucketKey, 
          billedCost: 0, 
          anthropicCost: 0,
          totalCost: 0,
          count: 0 
        };
      }
      periodBuckets[bucketKey].totalCost += cost;
      periodBuckets[bucketKey].count += 1;
      if (isAnthropic) {
        periodBuckets[bucketKey].anthropicCost += cost;
      } else {
        periodBuckets[bucketKey].billedCost += cost;
      }
    }

    // Convert to arrays and sort
    const periodData = Object.entries(periodBuckets)
      .map(([key, data]) => data)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    const providerBreakdown = Object.entries(providerTotals)
      .map(([provider, data]) => ({
        provider,
        ...data,
      }))
      .sort((a, b) => b.cost - a.cost);

    const agentBreakdown = Object.entries(agentTotals)
      .map(([agentId, data]) => ({
        agentId,
        ...data,
      }))
      .sort((a, b) => b.billedCost - a.billedCost);

    const sourceBreakdown = Object.entries(sourceTotals)
      .map(([source, data]) => ({
        source,
        ...data,
      }))
      .sort((a, b) => b.cost - a.cost);

    // Calculate summary stats
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const weekStart = now - (7 * 24 * 60 * 60 * 1000);
    const monthStart = now - (30 * 24 * 60 * 60 * 1000);

    const todayCost = events
      .filter(e => e.timestamp >= todayStart)
      .reduce((sum, e) => {
        if (!e.detail) return sum;
        let detail;
        try {
          detail = JSON.parse(e.detail);
        } catch {
          return sum;
        }
        if (!detail.cost) return sum;
        const cost = parseFloat(detail.cost) || 0;
        const model = detail.model || '';
        const isAnthropic = model.toLowerCase().includes('claude') || 
                           model.toLowerCase().includes('anthropic') ||
                           model.toLowerCase().includes('sonnet') ||
                           model.toLowerCase().includes('opus') ||
                           model.toLowerCase().includes('haiku');
        return isAnthropic ? sum : sum + cost;
      }, 0);

    const weekCost = events
      .filter(e => e.timestamp >= weekStart)
      .reduce((sum, e) => {
        if (!e.detail) return sum;
        let detail;
        try {
          detail = JSON.parse(e.detail);
        } catch {
          return sum;
        }
        if (!detail.cost) return sum;
        const cost = parseFloat(detail.cost) || 0;
        const model = detail.model || '';
        const isAnthropic = model.toLowerCase().includes('claude') || 
                           model.toLowerCase().includes('anthropic') ||
                           model.toLowerCase().includes('sonnet') ||
                           model.toLowerCase().includes('opus') ||
                           model.toLowerCase().includes('haiku');
        return isAnthropic ? sum : sum + cost;
      }, 0);

    const monthCost = events
      .filter(e => e.timestamp >= monthStart)
      .reduce((sum, e) => {
        if (!e.detail) return sum;
        let detail;
        try {
          detail = JSON.parse(e.detail);
        } catch {
          return sum;
        }
        if (!detail.cost) return sum;
        const cost = parseFloat(detail.cost) || 0;
        const model = detail.model || '';
        const isAnthropic = model.toLowerCase().includes('claude') || 
                           model.toLowerCase().includes('anthropic') ||
                           model.toLowerCase().includes('sonnet') ||
                           model.toLowerCase().includes('opus') ||
                           model.toLowerCase().includes('haiku');
        return isAnthropic ? sum : sum + cost;
      }, 0);

    res.json({
      summary: {
        totalBilledCost: parseFloat(totalBilledCost.toFixed(4)),
        totalAnthropicCost: parseFloat(totalAnthropicCost.toFixed(4)),
        totalAnthropicTokens,
        todayBilledCost: parseFloat(todayCost.toFixed(4)),
        weekBilledCost: parseFloat(weekCost.toFixed(4)),
        monthBilledCost: parseFloat(monthCost.toFixed(4)),
        dedupSkipped: dedupSkipped.length,
      },
      periodData,
      providerBreakdown,
      agentBreakdown,
      sourceBreakdown,
      deduplication: {
        skipped: dedupSkipped.length,
        details: dedupSkipped.slice(0, 10), // First 10 for debugging
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
function extractProvider(model) {
  const lower = model.toLowerCase();
  if (lower.includes('gpt') || lower.includes('openai')) return 'OpenAI';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('gemini') || lower.includes('google')) return 'Google';
  if (lower.includes('llama') || lower.includes('meta')) return 'Meta';
  if (lower.includes('mistral')) return 'Mistral';
  if (lower.includes('cohere')) return 'Cohere';
  if (lower.includes('openrouter')) return 'OpenRouter';
  return model;
}

/**
 * Get bucket key for time period
 */
function getBucketKey(timestamp, period) {
  const date = new Date(timestamp);
  switch (period) {
    case 'hour':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
    case 'day':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    case 'week': {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      return new Date(date.getFullYear(), date.getMonth(), diff).getTime();
    }
    case 'month':
      return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    default:
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
}

export default router;
