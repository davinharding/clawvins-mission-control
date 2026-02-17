import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useToast } from "@/lib/toast";
import { ConnectionStatus } from "@/components/ConnectionStatus";

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

const columns: TaskStatus[] = ["backlog", "todo", "in-progress", "done"];

const columnLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done"
};

const priorityVariant: Record<NonNullable<TaskPriority>, Parameters<typeof Badge>[0]["variant"]> = {
  low: "outline",
  medium: "default",
  high: "warning",
  critical: "danger"
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

const upsertById = <T extends { id: string }>(items: T[], item: T, prepend = false) => {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return prepend ? [item, ...items] : [...items, item];
  }
  const next = [...items];
  next[index] = item;
  return next;
};

const addEvent = (items: EventItem[], event: EventItem) => {
  if (items.some((existing) => existing.id === event.id)) {
    return items;
  }
  // Add new event at the beginning (newest first)
  return [event, ...items];
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
  const eventRef = React.useRef<HTMLDivElement>(null);
  const activeTaskIdRef = React.useRef<string | null>(null);
  const { notify } = useToast();

  React.useEffect(() => {
    if (!eventRef.current) return;
    eventRef.current.scrollTop = eventRef.current.scrollHeight;
  }, [events]);

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
          const username = import.meta.env.VITE_ADMIN_USERNAME || "patch";
          const password = import.meta.env.VITE_ADMIN_PASSWORD || "REDACTED";
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
        setEvents(eventsResponse.events.slice().reverse());
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
      socket.emit("authenticate", { token });
    });

    socket.on("task.created", (payload: TaskPayload) => {
      setTasks((prev) => upsertById(prev, payload.task, true));
    });

    socket.on("task.updated", (payload: TaskPayload) => {
      setTasks((prev) => upsertById(prev, payload.task));
    });

    socket.on("task.deleted", (payload: TaskDeletedPayload) => {
      setTasks((prev) => prev.filter((task) => task.id !== payload.taskId));
      const currentTaskId = activeTaskIdRef.current;
      setActiveTaskId((prev) => (prev === payload.taskId ? null : prev));
      setModalOpen((prev) => (currentTaskId === payload.taskId ? false : prev));
    });

    socket.on("agent.status_changed", (payload: AgentPayload) => {
      setAgents((prev) => upsertById(prev, payload.agent));
    });

    socket.on("event.new", (payload: EventPayload) => {
      setEvents((prev) => addEvent(prev, payload.event));
    });

    socket.on("comment.created", (payload: CommentPayload) => {
      setIncomingComment(payload.comment);
    });

    socket.on("auth_error", (payload: { error?: string }) => {
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

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
    event.dataTransfer.setData("text/plain", taskId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const existing = tasks.find((task) => task.id === taskId);
    if (!existing || existing.status === status) return;

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task))
    );

    try {
      await updateTask(taskId, { status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
      notify({
        title: "Failed to update task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: existing.status } : task
        )
      );
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
    const response = await updateTask(taskId, updates);
    setTasks((prev) => upsertById(prev, response.task));
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
    <div className="min-h-screen">
      <header className="flex flex-col gap-6 border-b border-border/60 bg-card/60 px-6 py-6 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Mission Control v2
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Agent Orchestration</h1>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm lg:items-end">
            <ConnectionStatus state={connectionState} />
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

      <main className="grid gap-6 px-6 py-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Agent Filters
              </p>
              <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AgentRole | "All")} options={roles} />
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Status Legend
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
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
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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

          <div className="grid gap-4 lg:grid-cols-4">
            {columns.map((column) => (
              <div
                key={column}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, column)}
                className="flex flex-col rounded-2xl border border-dashed border-border/70 bg-card/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {columnLabels[column]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {filteredTasks.filter((task) => task.status === column).length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  {filteredTasks
                    .filter((task) => task.status === column)
                    .map((task) => {
                      const agent = task.assignedAgent ? agentById[task.assignedAgent] : null;
                      const priority = (task.priority || "low") as TaskPriority;
                      const timestamp = task.updatedAt ?? task.createdAt;
                      return (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, task.id)}
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
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold leading-snug">
                                {task.title}
                              </h3>
                              <Badge variant={priorityVariant[priority]}>{priority}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
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
                          </CardHeader>
                        </Card>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    Live Feed
                  </p>
                  <h3 className="text-lg font-semibold">Agent Events</h3>
                </div>
                <Badge variant="outline">Realtime</Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-hidden p-4">
              <ScrollArea ref={eventRef} className="h-full pr-2">
                <div className="space-y-4">
                  {events.map((event) => {
                    const agent = event.agentId ? agentById[event.agentId] : null;
                    return (
                      <div
                        key={event.id}
                        className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                      >
                        <Avatar
                          className={cn("ring-2", statusRing[agent?.status ?? "online"])}
                        >
                          <AvatarFallback>
                            {agent?.name
                              ?.split(" ")
                              .map((part) => part[0])
                              .join("") ?? "MC"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{agent?.name ?? "System"}</p>
                          <p className="text-xs text-muted-foreground">{event.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
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
    </div>
  );
}
