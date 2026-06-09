// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyCostRecord,
  detectProviderSubscriptions,
  normalizeModelProvider,
  resetSubscriptionDetectionCache,
} from '../lib/cost-classification.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetSubscriptionDetectionCache();
});

describe('cost provider normalization', () => {
  it('recognizes current model families', () => {
    const cases = [
      ['openai/gpt-5.2', 'openai'],
      ['codex-mini-latest', 'openai'],
      ['o4-mini', 'openai'],
      ['anthropic/claude-sonnet-4-5', 'anthropic'],
      ['gemini-2.5-pro', 'google'],
      ['groq/llama-3.3-70b-versatile', 'groq'],
      ['moonshot/kimi-k2.5', 'moonshot'],
      ['venice/llama-3.3-70b', 'venice'],
      ['minimax/minimax-m2.1', 'minimax'],
      ['ollama/deepseek-r1:14b', 'ollama'],
      ['openrouter/openai/gpt-5.1', 'openrouter'],
      ['mistral-large-latest', 'mistral'],
      ['cohere/command-r-plus', 'cohere'],
      ['meta/llama-4-maverick', 'meta'],
    ];

    for (const [model, providerKey] of cases) {
      expect(normalizeModelProvider(model).providerKey, model).toBe(providerKey);
    }
  });

  it('treats OpenAI usage API events as OpenAI even when model is sparse', () => {
    expect(normalizeModelProvider('unknown', 'openai-usage-api').providerKey).toBe('openai');
  });
});

describe('subscription detection and classification', () => {
  it('uses env overrides to classify covered vs billed costs', () => {
    process.env.MC_SUBSCRIBED_PROVIDERS = 'openai,anthropic';
    process.env.MC_OPENAI_SUBSCRIPTION_TYPE = 'chatgpt-plus';
    resetSubscriptionDetectionCache();

    const subscriptions = detectProviderSubscriptions({ forceRefresh: true }).active;
    const covered = classifyCostRecord({ model: 'gpt-5.2', cost: 1.25, tokens: 1000 }, subscriptions);
    const billed = classifyCostRecord({ model: 'groq/llama-3.3-70b-versatile', cost: 0.25, tokens: 500 }, subscriptions);

    expect(covered.coverage).toBe('covered');
    expect(covered.isCovered).toBe(true);
    expect(billed.coverage).toBe('billed');
    expect(billed.isCovered).toBe(false);
  });

  it('detects OpenAI ChatGPT/Codex and Anthropic Claude credential files', () => {
    const dir = path.join(os.tmpdir(), `mc-cost-subscriptions-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const openaiPath = path.join(dir, 'openai-auth.json');
    const anthropicPath = path.join(dir, 'claude-credentials.json');
    writeFileSync(openaiPath, JSON.stringify({ auth_mode: 'chatgpt' }));
    writeFileSync(anthropicPath, JSON.stringify({ claudeAiOauth: { subscriptionType: 'max' } }));

    try {
      const subscriptions = detectProviderSubscriptions({
        forceRefresh: true,
        openaiCredentialPaths: [openaiPath],
        anthropicCredentialPaths: [anthropicPath],
      }).active;

      expect(subscriptions.openai.type).toBe('chatgpt');
      expect(subscriptions.anthropic.type).toBe('max');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hardens malformed numbers to avoid NaN totals', () => {
    const classified = classifyCostRecord({ model: 'gemini-2.5-pro', cost: { bad: true }, tokens: 'not-a-number' }, {});
    expect(classified.cost).toBe(0);
    expect(classified.tokens).toBe(0);
    expect(Number.isNaN(classified.cost)).toBe(false);
  });
});
