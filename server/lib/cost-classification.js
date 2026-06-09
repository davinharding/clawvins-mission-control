import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NEGATIVE_SUBSCRIPTION_TYPES = new Set(['', 'none', 'no', 'false', 'free', 'unknown', 'api_key', 'apikey']);

const PROVIDER_ALIASES = {
  anthropic: 'anthropic',
  claude: 'anthropic',
  openai: 'openai',
  gpt: 'openai',
  codex: 'openai',
  chatgpt: 'openai',
  google: 'google',
  gemini: 'google',
  groq: 'groq',
  moonshot: 'moonshot',
  kimi: 'moonshot',
  venice: 'venice',
  minimax: 'minimax',
  ollama: 'ollama',
  deepseek: 'ollama',
  openrouter: 'openrouter',
  mistral: 'mistral',
  cohere: 'cohere',
  meta: 'meta',
  llama: 'meta',
};

const PROVIDER_DISPLAY_NAMES = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT / Codex',
  google: 'Google Gemini',
  groq: 'Groq',
  moonshot: 'Moonshot / Kimi',
  venice: 'Venice',
  minimax: 'MiniMax',
  ollama: 'Ollama / DeepSeek',
  openrouter: 'OpenRouter',
  mistral: 'Mistral',
  cohere: 'Cohere',
  meta: 'Meta / Llama',
  unknown: 'Unknown',
};

const OPENAI_CREDENTIAL_PATHS = [
  path.join(os.homedir(), '.config', 'openai', 'auth.json'),
  path.join(os.homedir(), '.openai', 'auth.json'),
  path.join(os.homedir(), '.codex', 'auth.json'),
  path.join(os.homedir(), '.openclaw', 'codex', 'auth.json'),
];

const ANTHROPIC_CREDENTIAL_PATHS = [
  path.join(os.homedir(), '.claude', '.credentials.json'),
  path.join(os.homedir(), '.config', 'claude', '.credentials.json'),
  path.join(os.homedir(), '.openclaw', 'claude', '.credentials.json'),
];

let subscriptionCache = null;
const SUBSCRIPTION_CACHE_TTL_MS = 30_000;

export function normalizeProviderKey(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (!normalized) return '';
  return PROVIDER_ALIASES[normalized] || normalized;
}

export function getProviderDisplayName(providerKey) {
  return PROVIDER_DISPLAY_NAMES[providerKey] || providerKey || PROVIDER_DISPLAY_NAMES.unknown;
}

export function normalizeModelProvider(model, source = '') {
  const raw = String(model || '').trim();
  const normalized = raw.toLowerCase();
  const sourceLower = String(source || '').toLowerCase();

  if (sourceLower.includes('openai-usage')) {
    return providerResult('openai');
  }

  const prefix = normalized.split('/')[0];
  if (prefix && prefix !== normalized) {
    const prefixed = normalizeProviderKey(prefix);
    if (prefixed && prefixed !== prefix) return providerResult(prefixed);
    if (PROVIDER_DISPLAY_NAMES[prefixed]) return providerResult(prefixed);
  }

  if (/\b(openrouter)\b/.test(normalized)) return providerResult('openrouter');
  if (/\b(anthropic|claude|sonnet|opus|haiku)\b/.test(normalized)) return providerResult('anthropic');
  if (/\b(openai|chatgpt|codex|gpt-?[\w.]*)\b/.test(normalized) || /\bo[1345](?:-|$)/.test(normalized) || /\bo4(?:-|$)/.test(normalized)) return providerResult('openai');
  if (/\b(google|gemini|palm|bison)\b/.test(normalized)) return providerResult('google');
  if (/\bgroq\b/.test(normalized)) return providerResult('groq');
  if (/\b(moonshot|kimi)\b/.test(normalized)) return providerResult('moonshot');
  if (/\bvenice\b/.test(normalized)) return providerResult('venice');
  if (/\bminimax\b/.test(normalized)) return providerResult('minimax');
  if (/\b(ollama|deepseek)\b/.test(normalized)) return providerResult('ollama');
  if (/\bmistral\b/.test(normalized) || /\bmixtral\b/.test(normalized)) return providerResult('mistral');
  if (/\bcohere\b/.test(normalized) || /\bcommand-[\w-]+/.test(normalized)) return providerResult('cohere');
  if (/\b(meta|llama|llama-?[\d.]+)\b/.test(normalized)) return providerResult('meta');

  return providerResult('unknown', raw || 'Unknown');
}

export function detectProviderSubscriptions(options = {}) {
  const now = Date.now();
  if (!options.forceRefresh && subscriptionCache && (now - subscriptionCache.ts) < SUBSCRIPTION_CACHE_TTL_MS) {
    return subscriptionCache.value;
  }

  const active = {};
  for (const [provider, subscription] of Object.entries(detectSubscriptionsFromEnv(process.env))) {
    active[provider] = subscription;
  }

  const openai = detectOpenAISubscriptionFromFiles(options.openaiCredentialPaths || OPENAI_CREDENTIAL_PATHS);
  if (openai) active.openai = openai;

  const anthropic = detectAnthropicSubscriptionFromFiles(options.anthropicCredentialPaths || ANTHROPIC_CREDENTIAL_PATHS);
  if (anthropic) active.anthropic = anthropic;

  const value = { active };
  subscriptionCache = { ts: now, value };
  return value;
}

export function classifyCostRecord(record, subscriptions = detectProviderSubscriptions().active) {
  const normalized = normalizeModelProvider(record?.model, record?.source);
  const providerKey = normalized.providerKey;
  const subscription = subscriptions[providerKey] || null;
  const cost = sanitizeNumber(record?.cost);
  const tokens = sanitizeInteger(record?.tokens);
  const isCovered = Boolean(subscription);

  return {
    ...record,
    model: String(record?.model || 'unknown'),
    providerKey,
    provider: normalized.provider,
    cost,
    tokens,
    coverage: isCovered ? 'covered' : 'billed',
    isCovered,
    isAnthropic: providerKey === 'anthropic',
    subscriptionType: subscription?.type || null,
  };
}

export function sanitizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export function resetSubscriptionDetectionCache() {
  subscriptionCache = null;
}

function providerResult(providerKey, fallbackDisplay) {
  return {
    providerKey,
    provider: fallbackDisplay || getProviderDisplayName(providerKey),
  };
}

function detectSubscriptionsFromEnv(env) {
  const active = {};
  const subscribedProviders = String(env.MC_SUBSCRIBED_PROVIDERS || '').split(',');

  for (const rawProvider of subscribedProviders) {
    const provider = normalizeProviderKey(rawProvider);
    if (!provider) continue;
    active[provider] = { provider, type: 'subscription', source: 'env' };
  }

  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    const match = key.match(/^MC_([A-Z0-9_]+)_SUBSCRIPTION(?:_TYPE)?$/);
    if (!match) continue;

    const provider = normalizeProviderKey(match[1]);
    const type = normalizeSubscriptionType(value);
    if (!provider) continue;

    if (isPositiveSubscription(type)) {
      active[provider] = { provider, type, source: 'env' };
    } else {
      delete active[provider];
    }
  }

  return active;
}

function detectOpenAISubscriptionFromFiles(paths) {
  for (const credentialPath of paths) {
    const data = readJsonFile(credentialPath);
    if (!data) continue;

    const authMode = getNestedString(data, ['auth_mode', 'authMode']);
    if (authMode && authMode.toLowerCase() === 'chatgpt') {
      return { provider: 'openai', type: 'chatgpt', source: 'file' };
    }

    const plan = getNestedString(data, ['subscriptionType', 'subscription_type', 'accountPlan', 'account_plan', 'plan', 'tier']);
    if (plan && isPositiveSubscription(plan)) {
      return { provider: 'openai', type: normalizeSubscriptionType(plan), source: 'file' };
    }
  }
  return null;
}

function detectAnthropicSubscriptionFromFiles(paths) {
  for (const credentialPath of paths) {
    const data = readJsonFile(credentialPath);
    if (!data) continue;

    const plan = getNestedString(data, ['subscriptionType', 'subscription_type', 'accountPlan', 'account_plan', 'plan', 'tier']);
    if (plan && isPositiveSubscription(plan)) {
      return { provider: 'anthropic', type: normalizeSubscriptionType(plan), source: 'file' };
    }
  }
  return null;
}

function readJsonFile(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getNestedString(root, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const queue = [root];

  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || typeof value !== 'object') continue;

    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase()) && typeof child === 'string' && child.trim()) {
        return child.trim();
      }
      if (child && typeof child === 'object') {
        queue.push(child);
      }
    }
  }

  return null;
}

function normalizeSubscriptionType(value) {
  return String(value || '').trim().toLowerCase();
}

function isPositiveSubscription(value) {
  return !NEGATIVE_SUBSCRIPTION_TYPES.has(normalizeSubscriptionType(value));
}
