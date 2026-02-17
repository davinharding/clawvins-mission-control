import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  Agent,
  AgentRole,
  EventItem,
  Task,
  TaskStatus,
} from "@/lib/api";
import {
  createTask,
  getAgents,
  getEvents,
  getTasks,
  getToken,
  login,
  setToken,
  updateTask,
  deleteTask,
  type Comment
} from "@/lib/api";
import { createSocket, type ConnectionState } from "@/lib/socket";
import { TaskEditModal } from "@/components/TaskEditModal";
import { EventDetailModal } from "@/components/EventDetailModal";
import { useToast } from "@/lib/toast";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { NotificationTray, type Notification } from "@/components/NotificationTray";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { DraggableCard } from "@/components/DraggableCard";

type TaskPriority = "low" | "medium" | "high" | "critical";

type EventPayload = { event: EventItem };

type TaskPayload = { task: Task };

type TaskDeletedPayload = { taskId: string };

type AgentPayload = { agent: Agent };

type CommentPayload = { comment: Comment };

const roles: Array<{ label: string; value: AgentRole | "All" }> = [
  { label: "All", value: "All" },
  { label: "Main", value: "Main" },
  { label: "Dev", value: "Dev" },
  { label: "Research", value: "Research" },
  { label: "Ops", value: "Ops" }
];

const columns: TaskStatus[] = ["backlog", "todo", "in-progress", "testing", "done"];

const columnLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  testing: "Testing / QA",
  done: "Done"
};

const priorityVariant: Record<NonNullable<TaskPriority>, Parameters<typeof Badge>[0]["variant"]> = {
  low: "outline",
  medium: "default",
  high: "warning",
  critical: "danger"
};

type ColumnSort =
  | "priority-desc"
  | "priority-asc"
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc";

const columnSortOptions: Array<{ label: string; value: ColumnSort }> = [
  { label: "Priority (High → Low)", value: "priority-desc" },
  { label: "Priority (Low → High)", value: "priority-asc" },
  { label: "Created (Newest)", value: "created-desc" },
  { label: "Created (Oldest)", value: "created-asc" },
  { label: "Updated (Newest)", value: "updated-desc" },
  { label: "Updated (Oldest)", value: "updated-asc" },
];

const priorityWeight: Record<NonNullable<TaskPriority>, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const statusColor: Record<Agent["status"], string> = {
  online: "bg-emerald-400",
  busy: "bg-amber-400",
  offline: "bg-slate-500"
};

const statusRing: Record<Agent["status"], string> = {
  online: "ring-emerald-400/40",
  busy: "ring-amber-400/40",
  offline: "ring-slate-500/40"
};

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const eventIcon: Record<string, string> = {
  message_received: "📨",
  agent_response:   "💬",
  tool_call:        "🔧",
  task_created:     "📋",
  task_updated:     "↕️",
  task_assigned:    "👤",
  comment_created:  "💬",
  session_started:  "🟢",
};

const upsertById = <T extends { id: string }>(items: T[], item: T, prepend = false) => {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return prepend ? [item, ...items] : [...items, item];
  }
  const next = [...items];
  next[index] = item;
  return next;
};

const mergeEvents = (items: EventItem[], incoming: EventItem[]) => {
  console.log('[mergeEvents] Input items:', items.length, 'incoming:', incoming.length);
  const merged = new Map<string, EventItem>();
  items.forEach((event) => merged.set(event.id, event));
  incoming.forEach((event) => merged.set(event.id, event));
  
  // Always return new array (force React re-render)
  const result = [];
  for (const event of merged.values()) {
    result.push(event);
  }
  result.sort((a, b) => b.timestamp - a.timestamp);
  console.log('[mergeEvents] Output:', result.length, 'events');
  return result;
};

const sortTasks = (items: Task[], sort: ColumnSort) => {
  const sorted = [...items];
  const byPriority = (task: Task) => priorityWeight[(task.priority || "low") as NonNullable<TaskPriority>] ?? 0;
  const byCreated = (task: Task) => task.createdAt ?? 0;
  const byUpdated = (task: Task) => task.updatedAt ?? task.createdAt ?? 0;

  switch (sort) {
    case "priority-asc":
      sorted.sort((a, b) => byPriority(a) - byPriority(b));
      break;
    case "priority-desc":
      sorted.sort((a, b) => byPriority(b) - byPriority(a));
      break;
    case "created-asc":
      sorted.sort((a, b) => byCreated(a) - byCreated(b));
      break;
    case "created-desc":
      sorted.sort((a, b) => byCreated(b) - byCreated(a));
      break;
    case "updated-asc":
      sorted.sort((a, b) => byUpdated(a) - byUpdated(b));
      break;
    case "updated-desc":
      sorted.sort((a, b) => byUpdated(b) - byUpdated(a));
      break;
    default:
      return sorted;
  }
  return sorted;
};

export default function HomePage() {
  const [selectedRole, setSelectedRole] = React.useState<AgentRole | "All">("All");
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [token, setTokenState] = React.useState<string | null>(getToken());
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [incomingComment, setIncomingComment] = React.useState<Comment | null>(null);
  const [connectionState, setConnectionState] = React.useState<ConnectionState>("disconnected");
  const [columnSorts, setColumnSorts] = React.useState<Record<TaskStatus, ColumnSort>>({
    backlog: "priority-desc",
    todo: "priority-desc",
    "in-progress": "priority-desc",
    testing: "priority-desc",
    done: "priority-desc",
  });
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventItem | null>(null);
  const activeTaskIdRef = React.useRef<string | null>(null);
  const { notify } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const addNotification = React.useCallback(
    (n: Omit<Notification, "id" | "read" | "timestamp">) => {
      setNotifications((prev) => [
        {
          ...n,
          id: `notif-${Date.now()}-${Math.random()}`,
          read: false,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    },
    []
  );

  React.useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  React.useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setError(null);

      try {
        let activeToken = getToken();
        if (!activeToken) {
          const username = import.meta.env.VITE_DAVIN_USERNAME || import.meta.env.VITE_ADMIN_USERNAME || "davin";
          const password = import.meta.env.VITE_DAVIN_PASSWORD || import.meta.env.VITE_ADMIN_PASSWORD || "REDACTED_PASSWORD";
          const response = await login(username, password);
          setToken(response.token);
          setTokenState(response.token);
          activeToken = response.token;
        } else {
          setTokenState(activeToken);
        }

        const [tasksResponse, agentsResponse, eventsResponse] = await Promise.all([
          getTasks(),
          getAgents(),
          getEvents()
        ]);

        if (!mounted) return;

        setTasks(tasksResponse.tasks);
        setAgents(agentsResponse.agents);
        setEvents(mergeEvents([], eventsResponse.events));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load mission data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!token) return;

    const { socket, onConnectionStateChange, getConnectionState } = createSocket(token);
    setConnectionState(getConnectionState());
    const unsubscribe = onConnectionStateChange(setConnectionState);

    socket.on("connect", () => {
      console.log('[WebSocket] Connected');
    });

    socket.on("task.created", (payload: TaskPayload) => {
      console.log('[WebSocket] Task created:', payload.task.id);
      setTasks((prev) => upsertById(prev, payload.task, true));
      addNotification({
        type: "task_created",
        title: "New task created",
        message: payload.task.title,
        taskId: payload.task.id,
      });
    });

    socket.on("task.updated", (payload: TaskPayload) => {
      console.log('[WebSocket] Task updated:', payload.task.id);
      setTasks((prev) => upsertById(prev, payload.task));
      if (payload.task.status === "done") {
        addNotification({
          type: "task_completed",
          title: "Task completed",
          message: payload.task.title,
          taskId: payload.task.id,
        });
      } else if (payload.task.status === "testing") {
        addNotification({
          type: "task_moved",
          title: "Ready for QA",
          message: `"${payload.task.title}" → Testing / QA`,
          taskId: payload.task.id,
        });
      } else {
        addNotification({
          type: "task_moved",
          title: "Task moved",
          message: `"${payload.task.title}" → ${payload.task.status}`,
          taskId: payload.task.id,
        });
      }
    });

    socket.on("task.deleted", (payload: TaskDeletedPayload) => {
      console.log('[WebSocket] Task deleted:', payload.taskId);
      setTasks((prev) => prev.filter((task) => task.id !== payload.taskId));
      const currentTaskId = activeTaskIdRef.current;
      setActiveTaskId((prev) => (prev === payload.taskId ? null : prev));
      setModalOpen((prev) => (currentTaskId === payload.taskId ? false : prev));
    });

    socket.on("agent.status_changed", (payload: AgentPayload) => {
      console.log('[WebSocket] Agent status changed:', payload.agent.id, payload.agent.status);
      setAgents((prev) => upsertById(prev, payload.agent));
    });

    socket.on("event.new", (payload: EventPayload) => {
      console.log('[WebSocket] Received event.new:', payload);
      console.log('[WebSocket] Current event count before merge:', events.length);
      setEvents((prev) => {
        console.log('[State] Prev events in setter:', prev.length);
        const updated = mergeEvents(prev, [payload.event]);
        console.log('[State] Updated events count:', updated.length);
        return updated;
      });
    });

    socket.on("comment.created", (payload: CommentPayload) => {
      console.log('[WebSocket] Comment created:', payload.comment.id);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === payload.comment.taskId
            ? { ...task, commentCount: (task.commentCount ?? 0) + 1 }
            : task
        )
      );
      setIncomingComment(payload.comment);
      addNotification({
        type: "comment_added",
        title: "New comment",
        message: `${payload.comment.authorName}: ${payload.comment.text.slice(0, 60)}`,
        taskId: payload.comment.taskId,
      });
    });

    socket.on("auth_error", (payload: { error?: string }) => {
      console.error('[WebSocket] Auth error:', payload?.error);
      setError(payload?.error || "Socket authentication failed");
    });

    socket.connect();

    return () => {
      unsubscribe();
      socket.disconnect();
    };
  }, [token]);

  const visibleAgents = React.useMemo(() => {
    if (selectedRole === "All") return agents;
    return agents.filter((agent) => agent.role === selectedRole);
  }, [agents, selectedRole]);

  const filteredTasks = React.useMemo(() => {
    if (!selectedAgentId) return tasks;
    return tasks.filter((task) => task.assignedAgent === selectedAgentId);
  }, [tasks, selectedAgentId]);

  const stats = React.useMemo(() => {
    const completed = tasks.filter((task) => task.status === "done");
    const today = new Date();
    const completedToday = completed.filter((task) => {
      const date = new Date(task.updatedAt ?? task.createdAt);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
    const activeAgents = agents.filter((agent) => agent.status !== "offline").length;
    const avgCompletion = completed.length
      ? completed.reduce((sum, task) => sum + (task.updatedAt - task.createdAt), 0) /
        completed.length /
        36e5
      : 0;

    return {
      total: tasks.length,
      completedToday: completedToday.length,
      activeAgents,
      avgCompletion: avgCompletion.toFixed(1)
    };
  }, [agents, tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingTaskId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing || existing.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await updateTask(taskId, { status: newStatus });
    } catch (err) {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: existing.status } : t))
      );
      notify({
        title: "Failed to move task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    }
  };

  const handleAddTask = async () => {
    setError(null);

    try {
      const assignedAgent = agents[0]?.id ?? null;
      const response = await createTask({
        title: "New orchestration request",
        status: "todo",
        assignedAgent,
        priority: "medium",
        tags: []
      });
      setTasks((prev) => upsertById(prev, response.task, true));
      setActiveTaskId(response.task.id);
      setModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      notify({
        title: "Failed to create task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    }
  };

  const handleSaveTask = async (taskId: string, updates: Partial<Task>) => {
    const existing = tasks.find((t) => t.id === taskId);
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    try {
      const response = await updateTask(taskId, updates);
      // Confirm with server data
      setTasks((prev) => upsertById(prev, response.task));
    } catch (err) {
      // Revert on failure
      if (existing) {
        setTasks((prev) => upsertById(prev, existing));
      }
      throw err; // Re-throw so modal can show error
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const response = await deleteTask(taskId);
    if (!response.success) {
      throw new Error("Task could not be deleted");
    }
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setActiveTaskId(null);
  };

  const agentById = React.useMemo(() => {
    return agents.reduce<Record<string, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {});
  }, [agents]);

  const activeTask = React.useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-col gap-6 border-b border-border/60 bg-card/60 px-6 py-6 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Mission Control v2
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Agent Orchestration</h1>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm lg:items-end">
            <div className="flex items-center gap-2">
              <ConnectionStatus state={connectionState} />
              <NotificationTray
                notifications={notifications}
                onMarkRead={(id) =>
                  setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                  )
                }
                onMarkAllRead={() =>
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                }
                onClickNotification={(n) => {
                  if (n.taskId) {
                    setActiveTaskId(n.taskId);
                    setModalOpen(true);
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Card className="flex min-w-[160px] items-center gap-3 px-4 py-3">
                <div className="text-muted-foreground">Total Tasks</div>
                <div className="text-2xl font-semibold">{stats.total}</div>
              </Card>
              <Card className="flex min-w-[160px] items-center gap-3 px-4 py-3">
                <div className="text-muted-foreground">Completed Today</div>
                <div className="text-2xl font-semibold">{stats.completedToday}</div>
              </Card>
              <Card className="flex min-w-[160px] items-center gap-3 px-4 py-3">
                <div className="text-muted-foreground">Active Agents</div>
                <div className="text-2xl font-semibold">{stats.activeAgents}</div>
              </Card>
              <Card className="flex min-w-[200px] items-center gap-3 px-4 py-3">
                <div className="text-muted-foreground">Avg Completion</div>
                <div className="text-2xl font-semibold">{stats.avgCompletion}h</div>
              </Card>
            </div>
          </div>
        </div>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading mission data...</p>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="grid h-full grid-rows-1 grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1fr_300px] lg:grid-cols-[240px_1fr_360px]">
          {/* LEFT SIDEBAR - Agent Filters + Status Legend */}
          <aside className="flex h-full min-h-0 flex-col gap-6 md:hidden lg:flex">
            {/* Agent Filters Card - flex-1 to take available space, overflow hidden */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
              <div className="flex-shrink-0 space-y-3 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  Agent Filters
                </p>
                <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AgentRole | "All")} options={roles} />
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                  <span>Agents</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentId(null)}
                    className="text-primary"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {/* Agent List - scrollable with native overflow */}
              <div className="flex-1 overflow-y-auto px-6 pb-6" data-testid="agent-list">
                <div className="space-y-2">
                  {visibleAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                        selectedAgentId === agent.id
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/70 hover:bg-muted/60"
                      )}
                    >
                      <Avatar className={cn("ring-2", statusRing[agent.status])}>
                        <AvatarFallback>
                          {agent.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{agent.name}</span>
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              statusColor[agent.status]
                            )}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{agent.role}</p>
                      </div>
                    </button>
                  ))}
                  {!visibleAgents.length && (
                    <p className="text-xs text-muted-foreground">No agents online yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Status Legend - flex-shrink-0 to prevent shrinking, always visible */}
            <div className="flex-shrink-0 rounded-xl border bg-card p-6" data-testid="status-legend">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Status Legend
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Online
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Busy
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                  Offline
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER - Kanban Board */}
          <section className="flex h-full min-h-0 flex-col overflow-hidden">
            {/* Header - fixed height */}
            <div className="mb-4 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Kanban Board
                </p>
                <h2 className="text-2xl font-semibold">Live Task Pipeline</h2>
              </div>
              <Button onClick={handleAddTask} disabled={loading}>
                Add New Task
              </Button>
            </div>

            {/* Columns Grid - flex-1 to fill remaining space, overflow hidden */}
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
                {columns.map((column) => {
                  const columnTasks = sortTasks(
                    filteredTasks.filter((task) => task.status === column),
                    columnSorts[column]
                  );
                  return (
                    <KanbanColumn
                      key={column}
                      id={column}
                      className={cn(
                        "flex-col min-h-0 overflow-hidden",
                        column === "testing" && "border-amber-500/40 bg-amber-500/5"
                      )}
                    >
                      <div data-testid={`column-${column}`} className="flex flex-col min-h-0 overflow-hidden">
                        {/* Column header - fixed */}
                        <div className="mb-3 flex flex-shrink-0 items-center justify-between gap-2">
                          <span className={cn(
                            "text-sm font-semibold uppercase tracking-[0.2em]",
                            column === "testing" ? "text-amber-400" : "text-muted-foreground"
                          )}>
                            {column === "testing" ? "🧪 " : ""}{columnLabels[column]}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {columnTasks.length}
                            </span>
                            <Select
                              aria-label={`Sort ${columnLabels[column]} tasks`}
                              value={columnSorts[column]}
                              onChange={(event) =>
                                setColumnSorts((prev) => ({
                                  ...prev,
                                  [column]: event.target.value as ColumnSort,
                                }))
                              }
                              className="h-7 w-[160px] rounded-lg border-border/60 bg-muted/40 px-2 text-[11px]"
                            >
                              {columnSortOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                        {/* Task list - scrollable */}
                        <div className="flex-1 overflow-y-auto" data-testid="task-list">
                          <div className="space-y-3">
                            {columnTasks.map((task) => {
                              const agent = task.assignedAgent ? agentById[task.assignedAgent] : null;
                              const priority = (task.priority || "low") as TaskPriority;
                              const timestamp = task.updatedAt ?? task.createdAt;
                              return (
                                <DraggableCard key={task.id} id={task.id}>
                                  <Card
                                    onClick={() => {
                                      setActiveTaskId(task.id);
                                      setModalOpen(true);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        setActiveTaskId(task.id);
                                        setModalOpen(true);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <CardHeader className="space-y-2 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-sm font-semibold leading-snug">
                                          {task.title}
                                        </h3>
                                        <Badge
                                          variant={priorityVariant[priority]}
                                          className="px-2 py-0.5 text-[10px] uppercase tracking-wide"
                                        >
                                          {priority}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-3">
                                          <Avatar className="h-7 w-7">
                                            <AvatarFallback>
                                              {agent?.name
                                                ?.split(" ")
                                                .map((part) => part[0])
                                                .join("")}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{agent?.name ?? "Unassigned"}</span>
                                        </div>
                                        <span className="font-mono">{formatTime(timestamp)}</span>
                                      </div>
                                      {(task.commentCount ?? 0) > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <span>💬</span>
                                          <span>{task.commentCount}</span>
                                        </div>
                                      )}
                                    </CardHeader>
                                  </Card>
                                </DraggableCard>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </KanbanColumn>
                  );
                })}
              </div>

              {/* Ghost card while dragging */}
              <DragOverlay>
                {draggingTaskId ? (() => {
                  const task = tasks.find((t) => t.id === draggingTaskId);
                  const agent = task?.assignedAgent ? agentById[task.assignedAgent] : null;
                  const priority = (task?.priority || "low") as TaskPriority;
                  if (!task) return null;
                  return (
                    <Card className="rotate-2 shadow-2xl ring-2 ring-primary/60 opacity-95">
                      <CardHeader className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
                          <Badge variant={priorityVariant[priority]} className="px-2 py-0.5 text-[10px] uppercase tracking-wide">
                            {priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>
                              {agent?.name?.split(" ").map((p) => p[0]).join("") ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span>{agent?.name ?? "Unassigned"}</span>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          </section>

          {/* RIGHT SIDEBAR - Event Feed */}
          <aside className="flex h-full min-h-0 flex-col">
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
              <div className="flex-shrink-0 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                      Live Feed
                    </p>
                    <h3 className="text-lg font-semibold">Agent Events</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Realtime</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid="refresh-button"
                      onClick={async () => {
                        try {
                          console.log('[Refresh] Fetching events...');
                          const eventsResponse = await getEvents();
                          console.log('[Refresh] Received:', eventsResponse.events.length, 'events');
                          // Force complete replacement with new array reference
                          setEvents([...eventsResponse.events]);
                          console.log('[Refresh] State updated');
                        } catch (err) {
                          console.error('[Refresh] Error:', err);
                        }
                      }}
                      className="h-7 px-2"
                      aria-label="Refresh events"
                    >
                      ↻
                    </Button>
                  </div>
                </div>
              </div>
              <Separator className="flex-shrink-0" />
              {/* Event List - scrollable with native overflow */}
              <div className="flex-1 overflow-y-auto p-4" data-testid="event-feed">
                <div className="space-y-4">
                  {events.map((event, index) => {
                    const agent = event.agentId ? agentById[event.agentId] : null;
                    const isNew = index === 0; // First item is newest
                    const icon = eventIcon[event.type] ?? "⚡";
                    return (
                      <button
                        key={event.id}
                        type="button"
                        data-testid="event-item"
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          "flex w-full gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:bg-muted/60",
                          isNew && "animate-in slide-in-from-top-2 fade-in duration-300"
                        )}
                      >
                        <span className="text-base flex-shrink-0 pt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{agent?.name ?? "System"}</p>
                            {event.detail?.channelName && event.detail.channelName !== "unknown" && (
                              <span className="text-[10px] text-muted-foreground font-mono truncate">
                                {event.detail.channelName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{event.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                          {formatTime(event.timestamp)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <TaskEditModal
        open={modalOpen && !!activeTask}
        task={activeTask}
        agents={agents}
        incomingComment={incomingComment}
        onOpenChange={(nextOpen) => {
          setModalOpen(nextOpen);
          if (!nextOpen) setActiveTaskId(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />

      <EventDetailModal
        open={!!selectedEvent}
        event={selectedEvent}
        agentName={selectedEvent?.agentId ? agentById[selectedEvent.agentId]?.name : undefined}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
