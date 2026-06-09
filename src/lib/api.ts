export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'testing' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type AgentRole = 'Main' | 'Dev' | 'Research' | 'Ops';
export type AgentStatus = 'online' | 'offline' | 'busy';

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assignedAgent?: string | null;
  priority?: TaskPriority | null;
  createdAt: number;
  updatedAt: number;
  createdBy?: string | null;
  tags: string[];
  commentCount?: number;
};

export type TaskStatusCounts = Record<Exclude<TaskStatus, 'archived'>, number>;

export type DailyCompletion = {
  date: string;
  count: number;
};

export type TaskStatsResponse = {
  statusCounts: TaskStatusCounts;
  dailyCompletions: DailyCompletion[];
  thisWeekTotal: number;
  prevWeekTotal: number;
};

export type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  lastActive: number;
  avatarColor?: string | null;
};

export type EventDetail = {
  channel?: string;
  channelName?: string;
  sessionKey?: string;
  content?: string;
  tools?: Array<{ name: string; inputKeys: string[] }>;
  toolName?: string;
  model?: string;
  tokens?: number;
  cost?: number;
  role?: string;
};

export type EventItem = {
  id: string;
  type: string;
  message: string;
  agentId?: string | null;
  taskId?: string | null;
  timestamp: number;
  detail?: EventDetail | null;
};

export type Event = EventItem;

export type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
};

export type LoginResponse = {
  token: string;
  user: { id: string; name: string; role: AgentRole };
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'missionControlToken';
const REFRESH_TOKEN_KEY = 'missionControlRefreshToken';
const AGENT_ID_KEY = 'missionControlAgentId';
const AGENT_NAME_KEY = 'missionControlAgentName';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AGENT_ID_KEY);
  localStorage.removeItem(AGENT_NAME_KEY);
};

// Agent identity for comments - allows agents to post comments with their own identity
export const setAgentIdentity = (agentId: string, agentName: string) => {
  localStorage.setItem(AGENT_ID_KEY, agentId);
  localStorage.setItem(AGENT_NAME_KEY, agentName);
};

export const getAgentIdentity = (): { agentId: string; agentName: string } | null => {
  const agentId = localStorage.getItem(AGENT_ID_KEY);
  const agentName = localStorage.getItem(AGENT_NAME_KEY);
  if (!agentId || !agentName) return null;
  return { agentId, agentName };
};

let refreshPromise: Promise<string | null> | null = null;

// Store credentials for token refresh
export const storeCredentials = (username: string, password: string) => {
  // Store base64 encoded credentials for refresh
  const encoded = btoa(`${username}:${password}`);
  localStorage.setItem(REFRESH_TOKEN_KEY, encoded);
};

export const getStoredCredentials = (): { username: string; password: string } | null => {
  const encoded = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!encoded) return null;
  try {
    const decoded = atob(encoded);
    const [username, password] = decoded.split(':');
    return { username, password };
  } catch {
    return null;
  }
};

// Attempt to refresh the token using stored credentials
async function tryRefreshToken(): Promise<string | null> {
  const creds = getStoredCredentials();
  if (!creds) return null;
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    setToken(data.token);
    return data.token;
  } catch {
    return null;
  }
}

// Get a valid token, refreshing if necessary
async function getValidToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  return token;
}

export type AuthError = { code: 'EXPIRED' | 'INVALID' | 'NETWORK' };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getValidToken();
  const headers = {
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token once
  if (res.status === 401 && !path.includes('/auth/login')) {
    // Prevent infinite loops
    if (refreshPromise) {
      const newToken = await refreshPromise;
      if (newToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        const retryRes = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
        if (!retryRes.ok) {
          const message = await retryRes.text();
          throw new Error(message || `Request failed with ${retryRes.status}`);
        }
        return retryRes.json() as Promise<T>;
      }
    }
    
    refreshPromise = tryRefreshToken();
    const newToken = await refreshPromise;
    refreshPromise = null;
    
    if (newToken) {
      // Retry with new token
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
      if (!retryRes.ok) {
        const message = await retryRes.text();
        throw new Error(message || `Request failed with ${retryRes.status}`);
      }
      return retryRes.json() as Promise<T>;
    } else {
      // Refresh failed - clear token and show friendly error
      clearToken();
      throw new Error('SESSION_EXPIRED');
    }
  }

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string, agentIdentity?: { agentId: string; agentName: string }) {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  // If agentIdentity is provided (e.g., for agent-patch, agent-cypress), set it for comment attribution
  if (agentIdentity) {
    setAgentIdentity(agentIdentity.agentId, agentIdentity.agentName);
  }
  
  return response;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getTasks(params?: { status?: TaskStatus; agent?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.agent) search.set('agent', params.agent);
  const query = search.toString();
  return request<{ tasks: Task[] }>(`/tasks${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
}

export async function getTaskStats() {
  return request<TaskStatsResponse>('/tasks/stats', {
    headers: authHeaders(),
  });
}

export async function createTask(task: Partial<Task>) {
  return request<{ task: Task }>('/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(task),
  });
}

export async function updateTask(id: string, updates: Partial<Task>) {
  return request<{ task: Task }>(`/tasks/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(id: string) {
  return request<{ success: boolean }>(`/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export async function getArchivedTasks() {
  return request<{ tasks: Task[]; count: number }>('/tasks/archived', {
    headers: authHeaders(),
  });
}

export async function archiveTask(id: string) {
  return updateTask(id, { status: 'archived' });
}

export async function restoreTask(id: string, status: TaskStatus = 'backlog') {
  return updateTask(id, { status });
}

export async function getAgents() {
  return request<{ agents: Agent[] }>('/agents', {
    headers: authHeaders(),
  });
}

export async function updateAgent(id: string, updates: Partial<Agent>) {
  return request<{ agent: Agent }>(`/agents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(updates),
  });
}

export async function getTaskEvents(taskId: string, limit = 50): Promise<Event[]> {
  const params = new URLSearchParams({ taskId, limit: String(limit) });
  const response = await request<{ events: Event[] }>(`/events?${params.toString()}`, {
    headers: authHeaders(),
  });
  return response.events;
}

export async function getEvents(params?: { limit?: number; since?: number; before?: number }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.since) search.set('since', String(params.since));
  if (params?.before !== undefined) search.set('before', String(params.before));
  const query = search.toString();
  return request<{ events: EventItem[] }>(`/events${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
}

export async function getComments(taskId: string) {
  return request<{ comments: Comment[] }>(`/tasks/${taskId}/comments`, {
    headers: authHeaders(),
  });
}

export type SearchResult = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assignedAgent?: string | null;
  priority?: TaskPriority | null;
  matchType: 'task' | 'comment';
  snippet?: string | null;
};

export async function searchTasks(query: string, limit = 20): Promise<{ results: SearchResult[]; query: string }> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return request<{ results: SearchResult[]; query: string }>(`/search?${params}`, {
    headers: authHeaders(),
  });
}

// Author is determined server-side from the auth token.
// Browser code must not carry agent API keys; agents should call server APIs directly.
export async function createComment(taskId: string, text: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
  };

  return request<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
}

export type CostSummary = {
  totalBilledCost: number;
  totalCoveredCost: number;
  totalCoveredTokens: number;
  totalAnthropicCost: number;
  totalAnthropicTokens: number;
  todayBilledCost: number;
  weekBilledCost: number;
  todayCoveredCost: number;
  weekCoveredCost: number;
  monthCoveredCost: number;
  todayAnthropicCost: number;
  weekAnthropicCost: number;
  monthAnthropicCost: number;
  todayTotalCost: number;
  weekTotalCost: number;
  monthTotalCost: number;
  monthBilledCost: number;
};

export type PeriodData = {
  timestamp: number;
  billedCost: number;
  coveredCost: number;
  anthropicCost: number;
  totalCost: number;
  count: number;
};

export type ProviderBreakdown = {
  provider: string;
  providerKey?: string;
  cost: number;
  tokens: number;
  count: number;
  coverage?: 'covered' | 'billed';
  isCovered?: boolean;
  isAnthropic: boolean;
  coveredCost?: number;
  billedCost?: number;
  anthropicCost?: number;
};

export type AgentBreakdown = {
  agentId: string;
  cost: number;
  billedCost: number;
  coveredCost?: number;
  anthropicCost: number;
  tokens: number;
  count: number;
};

export type ModelBreakdown = {
  model: string;
  provider: string;
  providerKey?: string;
  cost: number;
  billedCost: number;
  coveredCost?: number;
  anthropicCost: number;
  tokens: number;
  count: number;
  coverage?: 'covered' | 'billed';
  isCovered?: boolean;
};

export type SourceBreakdown = {
  source: string;
  cost: number;
  billedCost: number;
  coveredCost?: number;
  anthropicCost: number;
  tokens: number;
  count: number;
};

export type DeduplicationInfo = {
  skipped: number;
  details: Array<{ model: string; timestamp: number; cost: number }>;
};

export type CostData = {
  summary: CostSummary & { dedupSkipped?: number; subscriptions?: Record<string, unknown> };
  periodData: PeriodData[];
  providerBreakdown: ProviderBreakdown[];
  agentBreakdown: AgentBreakdown[];
  modelBreakdown?: ModelBreakdown[];
  sourceBreakdown?: SourceBreakdown[];
  deduplication?: DeduplicationInfo;
};

export async function getCosts(params?: { period?: 'hour' | 'day' | 'week' | 'month'; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.period) search.set('period', params.period);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  const data = await request<CostData>(`/costs${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
  return normalizeCostData(data);
}

function normalizeCostData(data: CostData): CostData {
  const summary = data?.summary ?? ({} as CostSummary);
  const coveredCost = finite(summary.totalCoveredCost ?? summary.totalAnthropicCost);
  const todayCoveredCost = finite(summary.todayCoveredCost ?? summary.todayAnthropicCost);
  const weekCoveredCost = finite(summary.weekCoveredCost ?? summary.weekAnthropicCost);
  const monthCoveredCost = finite(summary.monthCoveredCost ?? summary.monthAnthropicCost);

  return {
    summary: {
      ...summary,
      totalBilledCost: finite(summary.totalBilledCost),
      totalCoveredCost: coveredCost,
      totalCoveredTokens: finite(summary.totalCoveredTokens ?? summary.totalAnthropicTokens),
      totalAnthropicCost: coveredCost,
      totalAnthropicTokens: finite(summary.totalAnthropicTokens),
      todayBilledCost: finite(summary.todayBilledCost),
      weekBilledCost: finite(summary.weekBilledCost),
      monthBilledCost: finite(summary.monthBilledCost),
      todayCoveredCost,
      weekCoveredCost,
      monthCoveredCost,
      todayAnthropicCost: todayCoveredCost,
      weekAnthropicCost: weekCoveredCost,
      monthAnthropicCost: monthCoveredCost,
      todayTotalCost: finite(summary.todayTotalCost ?? finite(summary.todayBilledCost) + todayCoveredCost),
      weekTotalCost: finite(summary.weekTotalCost ?? finite(summary.weekBilledCost) + weekCoveredCost),
      monthTotalCost: finite(summary.monthTotalCost ?? finite(summary.monthBilledCost) + monthCoveredCost),
      dedupSkipped: finite(summary.dedupSkipped),
    },
    periodData: array(data?.periodData).map((item) => normalizeBreakdown(item) as PeriodData),
    providerBreakdown: array(data?.providerBreakdown).map((item) => ({
      ...normalizeBreakdown(item),
      provider: text(item.provider, 'Unknown'),
      providerKey: typeof item.providerKey === 'string' ? item.providerKey : undefined,
      coverage: item.coverage === 'covered' ? 'covered' : 'billed',
      isCovered: Boolean(item.isCovered ?? item.isAnthropic),
      isAnthropic: Boolean(item.isAnthropic),
    }) as ProviderBreakdown),
    agentBreakdown: array(data?.agentBreakdown).map((item) => ({
      ...normalizeBreakdown(item),
      agentId: text(item.agentId, 'unknown'),
    }) as AgentBreakdown),
    modelBreakdown: array(data?.modelBreakdown).map((item) => ({
      ...normalizeBreakdown(item),
      model: text(item.model, 'unknown'),
      provider: text(item.provider, 'Unknown'),
      providerKey: typeof item.providerKey === 'string' ? item.providerKey : undefined,
      coverage: item.coverage === 'covered' ? 'covered' : 'billed',
      isCovered: Boolean(item.isCovered ?? item.anthropicCost),
    }) as ModelBreakdown),
    sourceBreakdown: array(data?.sourceBreakdown).map((item) => ({
      ...normalizeBreakdown(item),
      source: text(item.source, 'unknown'),
    }) as SourceBreakdown),
    deduplication: data?.deduplication,
  };
}

function normalizeBreakdown<T extends Record<string, unknown>>(item: T) {
  const coveredCost = finite(item.coveredCost ?? item.anthropicCost);
  const cost = finite(item.cost ?? item.totalCost);
  return {
    ...item,
    timestamp: finite(item.timestamp),
    cost,
    totalCost: finite(item.totalCost ?? cost),
    billedCost: finite(item.billedCost),
    coveredCost,
    anthropicCost: coveredCost,
    tokens: finite(item.tokens),
    count: finite(item.count),
  };
}

function array<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function finite(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
