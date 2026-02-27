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

export async function getEvents(params?: { limit?: number; since?: number }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.since) search.set('since', String(params.since));
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
// Agents can send x-agent-id and x-agent-name headers for identity.
// Use setAgentIdentity() to set the agent's identity before making API calls.
export async function createComment(taskId: string, text: string) {
  const agentIdentity = getAgentIdentity();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
  };
  
  // Add agent identity headers if set - this enables agent attribution in comments
  if (agentIdentity) {
    headers['x-agent-key'] = 'mc-agent-2026-z3x6c9v2b5n8m1k4';
    headers['x-agent-id'] = agentIdentity.agentId;
    headers['x-agent-name'] = agentIdentity.agentName;
  }
  
  return request<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
}

export type CostSummary = {
  totalBilledCost: number;
  totalAnthropicCost: number;
  totalAnthropicTokens: number;
  todayBilledCost: number;
  weekBilledCost: number;
  monthBilledCost: number;
};

export type PeriodData = {
  timestamp: number;
  billedCost: number;
  anthropicCost: number;
  totalCost: number;
  count: number;
};

export type ProviderBreakdown = {
  provider: string;
  cost: number;
  tokens: number;
  count: number;
  isAnthropic: boolean;
};

export type AgentBreakdown = {
  agentId: string;
  cost: number;
  billedCost: number;
  anthropicCost: number;
  tokens: number;
  count: number;
};

export type CostData = {
  summary: CostSummary;
  periodData: PeriodData[];
  providerBreakdown: ProviderBreakdown[];
  agentBreakdown: AgentBreakdown[];
};

export async function getCosts(params?: { period?: 'hour' | 'day' | 'week' | 'month'; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.period) search.set('period', params.period);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return request<CostData>(`/costs${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
}
