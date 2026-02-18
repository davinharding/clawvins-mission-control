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

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
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

export async function createComment(taskId: string, text: string) {
  // Author attribution is determined server-side from the auth token — do not send author fields
  return request<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ text }),
  });
}
