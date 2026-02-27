import express from 'express';
import { db } from '../db.js';

const router = express.Router();

/**
 * Fetch and store OpenAI Usage API data
 * GET /api/openai-usage/sync?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/sync', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    // Default to last 30 days if not specified
    const endDate = req.query.end_date || new Date().toISOString().split('T')[0];
    const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[OpenAI Usage] Fetching usage data from ${startDate} to ${endDate}`);

    // Fetch from OpenAI Usage API
    const url = `https://api.openai.com/v1/organization/usage?start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI Usage] API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `OpenAI API error: ${response.status}`,
        details: errorText 
      });
    }

    const usageData = await response.json();
    console.log('[OpenAI Usage] Received data:', JSON.stringify(usageData).substring(0, 200));

    // Process and store usage data as events
    let storedCount = 0;
    let skippedCount = 0;

    if (usageData.data && Array.isArray(usageData.data)) {
      for (const dailyUsage of usageData.data) {
        // Each daily usage entry has aggregation_timestamp and snapshot_id
        const timestamp = new Date(dailyUsage.aggregation_timestamp * 1000).getTime();
        
        // Check if we already have this data
        const existing = db.prepare(`
          SELECT id FROM events 
          WHERE source = 'openai-usage-api' 
          AND timestamp = ? 
          AND detail LIKE ?
        `).get(timestamp, `%"snapshot_id":"${dailyUsage.snapshot_id}"%`);

        if (existing) {
          skippedCount++;
          continue;
        }

        // Store as event
        const eventId = `openai-usage-${dailyUsage.snapshot_id}`;
        const detail = {
          snapshot_id: dailyUsage.snapshot_id,
          aggregation_timestamp: dailyUsage.aggregation_timestamp,
          n_requests: dailyUsage.n_requests,
          operation: dailyUsage.operation,
          snapshot_id: dailyUsage.snapshot_id,
          n_context_tokens_total: dailyUsage.n_context_tokens_total,
          n_generated_tokens_total: dailyUsage.n_generated_tokens_total,
          // Calculate cost if available (OpenAI doesn't directly provide cost, we may need to calculate)
          raw_data: dailyUsage,
        };

        db.prepare(`
          INSERT OR REPLACE INTO events (id, type, message, agent_id, task_id, timestamp, detail, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          eventId,
          'cost',
          `OpenAI usage: ${dailyUsage.operation}`,
          'openai-direct',
          null,
          timestamp,
          JSON.stringify(detail),
          'openai-usage-api'
        );

        storedCount++;
      }
    }

    console.log(`[OpenAI Usage] Stored ${storedCount} records, skipped ${skippedCount} duplicates`);

    res.json({
      success: true,
      stored: storedCount,
      skipped: skippedCount,
      dateRange: { start: startDate, end: endDate },
    });

  } catch (err) {
    console.error('[OpenAI Usage] Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch OpenAI usage data',
      details: err.message 
    });
  }
});

/**
 * Get stored OpenAI usage data
 * GET /api/openai-usage/data
 */
router.get('/data', (req, res) => {
  try {
    const events = db.prepare(`
      SELECT * FROM events 
      WHERE source = 'openai-usage-api'
      ORDER BY timestamp DESC
      LIMIT 1000
    `).all();

    const parsed = events.map(e => ({
      ...e,
      detail: e.detail ? JSON.parse(e.detail) : null,
    }));

    res.json({ events: parsed });
  } catch (err) {
    console.error('[OpenAI Usage] Error fetching stored data:', err);
    res.status(500).json({ error: 'Failed to fetch stored usage data' });
  }
});

export default router;
