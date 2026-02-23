import * as React from "react";
import { Archive } from "lucide-react";
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
  getArchivedTasks,
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
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { KanbanColumn } from "@/components/KanbanColumn";
import { DraggableCard } from "@/components/DraggableCard";
import { ArchivePanel } from "@/components/ArchivePanel";
import { LinkifiedText } from "@/components/LinkifiedText";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BulkActionBar } from "@/components/BulkActionBar";

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
  testing: "Testing",
  done: "Done",
  archived: "Archived",
};

const columnEmojis: Record<TaskStatus, string> = {
  backlog: "📋",
  todo: "🎯",
  "in-progress": "⚡",
  testing: "🧪",
  done: "✅",
  archived: "🗄️",
};

const columnColors: Record<TaskStatus, string> = {
  backlog: "text-muted-foreground",
  todo: "text-sky-400",
  "in-progress": "text-violet-400",
  testing: "text-amber-400",
  done: "text-emerald-400",
  archived: "text-muted-foreground",
};

const columnBg: Record<TaskStatus, string> = {
  backlog: "",
  todo: "border-sky-500/20 bg-sky-500/5",
  "in-progress": "border-violet-500/20 bg-violet-500/5",
  testing: "border-amber-500/40 bg-amber-500/5",
  done: "border-emerald-500/20 bg-emerald-500/5",
  archived: "",
};

const ARCHIVE_DROP_ID = "archive-panel";

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

// Emoji avatars — keyed by agent name (first word, case-insensitive)
const agentEmojiMap: Record<string, string> = {
  clawvin: "🐾",
  patch:   "🔧",
  scout:   "🎯",
  vitals:  "💪",
  alpha:   "🔍",
  iris:    "📨",
  nova:    "✨",
  ledger:  "📒",
  atlas:   "🏋️",
};

// Category-based avatar background colors
const roleAvatarBg: Record<AgentRole, string> = {
  Main:     "bg-blue-500/20",
  Dev:      "bg-amber-500/20",
  Research: "bg-purple-500/20",
  Ops:      "bg-emerald-500/20",
};

const roleAvatarText: Record<AgentRole, string> = {
  Main:     "text-blue-300",
  Dev:      "text-amber-300",
  Research: "text-purple-300",
  Ops:      "text-emerald-300",
};

const getAgentEmoji = (name: string): string | null => {
  const key = name.split(" ")[0].toLowerCase();
  return agentEmojiMap[key] ?? null;
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

// Mobile droppable row — unique "mobile-{status}" IDs to avoid conflicts with desktop columns
function MobileDropRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `mobile-${id}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex overflow-x-auto gap-3 pb-2 scrollbar-hide min-h-[80px] rounded-lg transition-colors",
        isOver && "bg-primary/5 ring-1 ring-primary/30"
      )}
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-x pan-y"
      }}
    >
      {children}
    </div>
  );
}

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
  const [showStats, setShowStats] = React.useState(false);
  const [showEventFeed, setShowEventFeed] = React.useState(false);
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
    archived: "priority-desc",
  });
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventItem | null>(null);

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const isSelecting = selectedTaskIds.size > 0;
  const [archivedTasks, setArchivedTasks] = React.useState<Task[]>([]);
  const activeTaskIdRef = React.useRef<string | null>(null);
  const { notify } = useToast();

  // Mobile column scroll rail state
  const [activeColumn, setActiveColumn] = React.useState<TaskStatus>("backlog");
  const columnSectionRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const mobileBoardRef = React.useRef<HTMLDivElement | null>(null);

  // Login form state
  const [showLogin, setShowLogin] = React.useState(false);
  const [loginUsername, setLoginUsername] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [loginLoading, setLoginLoading] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
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

  // IntersectionObserver: track which mobile column section is visible
  React.useEffect(() => {
    const refs = columnSectionRefs.current;
    const entries = Object.entries(refs).filter(([, el]) => el != null) as [string, HTMLDivElement][];
    if (entries.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        // Find the column with highest intersection ratio
        let best: string | null = null;
        let bestRatio = -1;
        for (const entry of observed) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            best = entry.target.getAttribute("data-column");
          }
        }
        if (best) setActiveColumn(best as TaskStatus);
      },
      {
        root: mobileBoardRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
        rootMargin: "0px",
      }
    );

    for (const [, el] of entries) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  React.useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoading(true);
      setError(null);

      try {
        let activeToken = getToken();
        if (!activeToken) {
          setShowLogin(true);
          setLoading(false);
          return;
        } else {
          setTokenState(activeToken);
        }

        const [tasksResponse, agentsResponse, eventsResponse, archivedResponse] = await Promise.all([
          getTasks(),
          getAgents(),
          getEvents(),
          getArchivedTasks(),
        ]);

        if (!mounted) return;

        setTasks(tasksResponse.tasks);
        setAgents(agentsResponse.agents);
        setEvents(mergeEvents([], eventsResponse.events));
        setArchivedTasks(archivedResponse.tasks);
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
      if (payload.task.status === "archived") {
        // Move from board to archive
        setTasks((prev) => prev.filter((t) => t.id !== payload.task.id));
        setArchivedTasks((prev) => upsertById(prev, payload.task, true));
        return;
      }
      // If a task comes back from archive to any board status
      setArchivedTasks((prev) => prev.filter((t) => t.id !== payload.task.id));
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
      // Remove from bulk selection if it was selected
      setSelectedTaskIds((prev) => {
        if (!prev.has(payload.taskId)) return prev;
        const next = new Set(prev);
        next.delete(payload.taskId);
        return next;
      });
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

    socket.on("tasks.auto_archived", (payload: { count: number }) => {
      console.log('[WebSocket] Auto-archived:', payload.count, 'tasks');
      // Refresh both board tasks and archive
      Promise.all([getTasks(), getArchivedTasks()]).then(([tasksRes, archiveRes]) => {
        setTasks(tasksRes.tasks);
        setArchivedTasks(archiveRes.tasks);
        if (payload.count > 0) {
          addNotification({
            type: "task_moved",
            title: "Auto-archived",
            message: `${payload.count} task${payload.count > 1 ? 's' : ''} moved to archive`,
          });
        }
      }).catch(() => {});
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
    // Archived tasks never appear on the main board
    const boardTasks = tasks.filter((task) => task.status !== "archived");

    // Filter by category (role) — only show tasks assigned to agents in the selected category
    const visibleAgentIds = new Set(visibleAgents.map((a) => a.id));
    const roleFiltered =
      selectedRole === "All"
        ? boardTasks
        : boardTasks.filter(
            (task) => task.assignedAgent && visibleAgentIds.has(task.assignedAgent)
          );

    // Further filter by a specific selected agent
    if (!selectedAgentId) return roleFiltered;
    return roleFiltered.filter((task) => task.assignedAgent === selectedAgentId);
  }, [tasks, selectedAgentId, selectedRole, visibleAgents]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const response = await login(loginUsername, loginPassword);
      setToken(response.token);
      setTokenState(response.token);
      setShowLogin(false);
      setLoginPassword("");
      // Re-trigger bootstrap by calling it directly
      setLoading(true);
      const [tasksResponse, agentsResponse, eventsResponse, archivedResponse] = await Promise.all([
        getTasks(),
        getAgents(),
        getEvents(),
        getArchivedTasks(),
      ]);
      setTasks(tasksResponse.tasks);
      setAgents(agentsResponse.agents);
      setEvents(mergeEvents([], eventsResponse.events));
      setArchivedTasks(archivedResponse.tasks);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Invalid username or password");
    } finally {
      setLoginLoading(false);
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingTaskId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingTaskId(null);
    const { active, over } = event;
    if (!over) return;

    // Strip mobile- prefix from both active and over IDs
    const taskId = String(active.id).replace(/^mobile-/, '');

    // Handle archive drop target first
    if (over.id === ARCHIVE_DROP_ID) {
      await handleArchiveTask(taskId);
      return;
    }

    // Handle both desktop column IDs and mobile row IDs (prefixed with "mobile-")
    const overId = String(over.id);
    const newStatus = overId.replace(/^mobile-/, '') as TaskStatus;
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
    setArchivedTasks((prev) => prev.filter((task) => task.id !== taskId));
    setActiveTaskId(null);
  };

  const handleArchiveTask = async (taskId: string) => {
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) return;
    // Optimistic: remove from board
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const response = await updateTask(taskId, { status: "archived" });
      setArchivedTasks((prev) => upsertById(prev, response.task, true));
    } catch (err) {
      // Revert
      setTasks((prev) => [existing, ...prev]);
      notify({
        title: "Failed to archive task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    }
  };

  const handleRestoreTask = async (taskId: string, status: TaskStatus) => {
    const existing = archivedTasks.find((t) => t.id === taskId);
    if (!existing) return;
    // Optimistic: remove from archive
    setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const response = await updateTask(taskId, { status });
      setTasks((prev) => upsertById(prev, response.task, true));
      notify({
        title: "Task restored",
        description: `"${response.task.title}" moved to ${status}`,
        variant: "default",
      });
    } catch (err) {
      // Revert
      setArchivedTasks((prev) => [existing, ...prev]);
      notify({
        title: "Failed to restore task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    }
  };

  // ── Bulk-selection handlers ──────────────────────────────────────────────────

  const handleLongPressTask = React.useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    setLastSelectedId(taskId);
  }, []);

  const handleSelectTask = React.useCallback(
    (taskId: string, shiftKey?: boolean, columnTasks?: Task[]) => {
      if (shiftKey && lastSelectedId && columnTasks) {
        const ids = columnTasks.map((t) => t.id);
        const fromIdx = ids.indexOf(lastSelectedId);
        const toIdx = ids.indexOf(taskId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [s, e] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
          setSelectedTaskIds((prev) => {
            const next = new Set(prev);
            for (let i = s; i <= e; i++) next.add(ids[i]);
            return next;
          });
          return;
        }
      }
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
        return next;
      });
      setLastSelectedId(taskId);
    },
    [lastSelectedId]
  );

  const handleClearSelection = React.useCallback(() => {
    setSelectedTaskIds(new Set());
    setLastSelectedId(null);
  }, []);

  const handleBulkMoveTo = React.useCallback(
    async (newStatus: TaskStatus) => {
      const ids = Array.from(selectedTaskIds);
      if (!ids.length) return;
      handleClearSelection();
      setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, status: newStatus } : t)));
      try {
        await Promise.all(ids.map((id) => updateTask(id, { status: newStatus })));
      } catch (err) {
        notify({
          title: "Bulk move failed",
          description: err instanceof Error ? err.message : "Unexpected error",
          variant: "error",
        });
        try { const r = await getTasks(); setTasks(r.tasks); } catch { /* ignore */ }
      }
    },
    [selectedTaskIds, handleClearSelection, notify]
  );

  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selectedTaskIds);
    if (!ids.length) return;
    const toArchive = tasks.filter((t) => ids.includes(t.id));
    handleClearSelection();
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    try {
      const results = await Promise.all(ids.map((id) => updateTask(id, { status: "archived" })));
      setArchivedTasks((prev) => [...results.map((r) => r.task), ...prev]);
    } catch (err) {
      notify({
        title: "Bulk archive failed",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
      setTasks((prev) => [...toArchive, ...prev]);
      try { const r = await getTasks(); setTasks(r.tasks); } catch { /* ignore */ }
    }
  }, [selectedTaskIds, tasks, handleClearSelection, notify]);

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selectedTaskIds);
    if (!ids.length) return;
    handleClearSelection();
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    try {
      await Promise.all(ids.map((id) => deleteTask(id)));
    } catch (err) {
      notify({
        title: "Bulk delete failed",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
      try { const r = await getTasks(); setTasks(r.tasks); } catch { /* ignore */ }
    }
  }, [selectedTaskIds, handleClearSelection, notify]);

  // ────────────────────────────────────────────────────────────────────────────

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

  if (showLogin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Mission Control</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mc-username" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Username
              </label>
              <input
                id="mc-username"
                type="text"
                autoComplete="username"
                autoFocus
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                disabled={loginLoading}
                placeholder="username"
                className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mc-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <input
                id="mc-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                disabled={loginLoading}
                placeholder="••••••••"
                className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50"
              />
            </div>
            {loginError && (
              <p className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loginLoading || !loginUsername || !loginPassword}
              className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex-shrink-0 border-b border-border/60 bg-card/60 backdrop-blur">
        {/* ── MOBILE HEADER (lg:hidden) — 2 compact rows ── */}
        <div className="lg:hidden">
          {/* Row 1: MC V2 | CONNECTED | 🔔 | Stats▼ | ⚡Feed | + New */}
          <div className="flex items-center gap-1.5 py-2 px-3">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground mr-auto">MC V2</span>
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
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className="flex items-center gap-0.5 rounded-full border border-border/70 py-0.5 px-2 text-xs font-semibold transition hover:bg-muted/60"
            >
              Stats {showStats ? "▲" : "▼"}
            </button>
            <button
              type="button"
              onClick={() => setShowEventFeed((v) => !v)}
              className="flex items-center gap-0.5 rounded-full border border-border/70 py-0.5 px-2 text-xs font-semibold transition hover:bg-muted/60"
            >
              ⚡ Feed
            </button>
            <GlobalSearch
              compact={true}
              onOpenTask={(taskId) => {
                setActiveTaskId(taskId);
                setModalOpen(true);
              }}
            />
            <button
              type="button"
              onClick={handleAddTask}
              disabled={loading}
              className="flex items-center gap-0.5 rounded-full border border-primary/60 bg-primary/10 text-primary py-0.5 px-2 text-xs font-semibold transition hover:bg-primary/20 disabled:opacity-50"
            >
              + New
            </button>
          </div>
          {/* Collapsible stats */}
          {showStats && (
            <div className="grid grid-cols-4 gap-1.5 px-3 pb-2">
              <div className="flex flex-col items-center rounded-lg border border-border/60 bg-card/70 px-1 py-1.5">
                <span className="text-[10px] text-muted-foreground">Total</span>
                <span className="text-sm font-semibold">{stats.total}</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border/60 bg-card/70 px-1 py-1.5">
                <span className="text-[10px] text-muted-foreground">Done</span>
                <span className="text-sm font-semibold">{stats.completedToday}</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border/60 bg-card/70 px-1 py-1.5">
                <span className="text-[10px] text-muted-foreground">Agents</span>
                <span className="text-sm font-semibold">{stats.activeAgents}</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border/60 bg-card/70 px-1 py-1.5">
                <span className="text-[10px] text-muted-foreground">Avg</span>
                <span className="text-sm font-semibold">{stats.avgCompletion}h</span>
              </div>
            </div>
          )}
          {/* Row 2: Agent filter pills — horizontally scrollable */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-1 scrollbar-hide">
            {roles.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => {
                  setSelectedRole(role.value as AgentRole | "All");
                  setSelectedAgentId(null);
                }}
                className={cn(
                  "flex-shrink-0 rounded-full border py-0.5 px-2.5 text-xs font-semibold transition",
                  selectedRole === role.value
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 hover:bg-muted/60"
                )}
              >
                {role.label}
              </button>
            ))}
            <div className="flex-shrink-0 w-px bg-border/60 self-stretch my-0.5" />
            {visibleAgents.map((agent) => {
              const emoji = getAgentEmoji(agent.name);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() =>
                    setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)
                  }
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1 rounded-full border py-0.5 px-2 text-xs font-semibold transition",
                    selectedAgentId === agent.id
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 hover:bg-muted/60"
                  )}
                >
                  <span>{emoji ?? agent.name[0]}</span>
                  <span>{agent.name.split(" ")[0]}</span>
                  <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", statusColor[agent.status])} />
                </button>
              );
            })}
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground px-3 pb-1">Loading...</p>
          )}
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 mx-3 mb-2 px-3 py-1.5 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* ── DESKTOP HEADER (hidden lg:flex) ── */}
        <div className="hidden lg:flex flex-col gap-4 px-6 py-6">
          <div className="flex flex-row items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Mission Control v2
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">Agent Orchestration</h1>
            </div>
            <div className="flex flex-col items-end gap-3 text-sm">
              <div className="flex items-center gap-2">
                <GlobalSearch
                  onOpenTask={(taskId) => {
                    setActiveTaskId(taskId);
                    setModalOpen(true);
                  }}
                />
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
                <button
                  type="button"
                  onClick={() => setShowStats((v) => !v)}
                  className="flex items-center gap-1 rounded-lg border border-border/70 px-3 min-h-[44px] text-xs font-semibold transition hover:bg-muted/60"
                >
                  Stats {showStats ? "▲" : "▼"}
                </button>
              </div>
              <div className={cn("w-full flex flex-wrap gap-3 text-sm", showStats ? "flex" : "hidden")}>
                <Card className="flex items-center gap-3 px-4 py-3">
                  <div className="text-muted-foreground text-sm">Total Tasks</div>
                  <div className="text-2xl font-semibold">{stats.total}</div>
                </Card>
                <Card className="flex items-center gap-3 px-4 py-3">
                  <div className="text-muted-foreground text-sm">Done Today</div>
                  <div className="text-2xl font-semibold">{stats.completedToday}</div>
                </Card>
                <Card className="flex items-center gap-3 px-4 py-3">
                  <div className="text-muted-foreground text-sm">Active Agents</div>
                  <div className="text-2xl font-semibold">{stats.activeAgents}</div>
                </Card>
                <Card className="flex items-center gap-3 px-4 py-3">
                  <div className="text-muted-foreground text-sm">Avg Completion</div>
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
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile event feed overlay */}
        {showEventFeed && (
          <div className="fixed inset-0 z-40 lg:hidden flex flex-col bg-card/98 backdrop-blur">
            <div 
              className="flex flex-shrink-0 items-center justify-between border-b border-border/60 px-4 py-3"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Live Feed</p>
                <h3 className="text-lg font-semibold">Agent Events</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEventFeed(false)}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-border/70 text-muted-foreground hover:bg-muted/60 transition"
                aria-label="Close event feed"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {events.map((event, index) => {
                  const agent = event.agentId ? agentById[event.agentId] : null;
                  const isNew = index === 0;
                  const icon = eventIcon[event.type] ?? "⚡";
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => { setSelectedEvent(event); setShowEventFeed(false); }}
                      className={cn(
                        "flex w-full gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:bg-muted/60 min-h-[44px]",
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
                        <p className="text-xs text-muted-foreground truncate">
                          <LinkifiedText text={event.message} />
                        </p>
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
        )}

        <div className="grid flex-1 min-h-0 grid-rows-1 grid-cols-1 gap-4 sm:gap-6 px-2 sm:px-6 py-2 sm:py-6 lg:grid-cols-[240px_1fr_360px]">
          {/* LEFT SIDEBAR - Agent Filters + Status Legend (desktop only) */}
          <aside className="hidden lg:flex h-full min-h-0 flex-col gap-6">
            {/* Agent Filters Card - flex-1 to take available space, overflow hidden */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
              <div className="flex-shrink-0 space-y-3 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  Agent Filters
                </p>
                <Tabs
                  value={selectedRole}
                  onValueChange={(v) => {
                    setSelectedRole(v as AgentRole | "All");
                    setSelectedAgentId(null); // clear per-agent filter when switching category
                  }}
                  options={roles}
                />
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
                      {(() => {
                        const emoji = getAgentEmoji(agent.name);
                        return (
                          <Avatar className={cn(
                            "ring-2",
                            statusRing[agent.status],
                            roleAvatarBg[agent.role]
                          )}>
                            <AvatarFallback className={emoji ? "text-base" : roleAvatarText[agent.role]}>
                              {emoji ?? agent.name.split(" ").map((p) => p[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })()}
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
          <section className="flex h-full min-h-0 flex-col overflow-y-auto lg:overflow-hidden">
            {/* Header - desktop only (mobile uses compact header above) */}
            <div className="hidden lg:flex mb-4 flex-shrink-0 flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Kanban Board
                </p>
                <h2 className="text-2xl font-semibold">Live Task Pipeline</h2>
              </div>
              <Button onClick={handleAddTask} disabled={loading} className="min-h-[44px]">
                Add New Task
              </Button>
            </div>


            {/* ── MOBILE COLUMN SCROLL RAIL (lg:hidden) — sticky nav above board rows ── */}
            <div
              className="sticky top-0 z-10 lg:hidden flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide bg-background/95 backdrop-blur border-b border-border/40"
              style={{ touchAction: "pan-x" }}
            >
              {columns.map((status) => {
                const isActive = activeColumn === status;
                return (
                  <button
                    key={status}
                    type="button"
                    style={{ touchAction: "pan-x" }}
                    onClick={() => {
                      setActiveColumn(status);
                      const el = columnSectionRefs.current[status];
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                    className={cn(
                      "flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap",
                      isActive
                        ? "border-primary bg-primary/20 text-primary shadow-sm"
                        : "border-border/60 text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {columnEmojis[status]} {columnLabels[status]}
                  </button>
                );
              })}
            </div>

            {/* Columns Grid - flex-1 to fill remaining space, overflow hidden */}
            <DndContext
              sensors={sensors}
              modifiers={[snapCenterToCursor]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDraggingTaskId(null)}
            >
              {/* Mobile board: compressed rows — all 5 statuses visible on one screen */}
              <div
                ref={mobileBoardRef}
                className="flex flex-col gap-2 lg:hidden"
                style={{ scrollSnapType: "y mandatory", overflowY: "auto" }}
              >
                {columns.map((status) => {
                  const rowTasks = filteredTasks.filter((t) => t.status === status);
                  return (
                    <div
                      key={status}
                      data-column={status}
                      ref={(el) => { columnSectionRefs.current[status] = el; }}
                      style={{ scrollSnapAlign: "start" }}
                    >
                      {/* Compressed row header */}
                      <div className="flex items-center gap-2 px-2 py-1">
                        <span className={cn("text-xs font-bold uppercase tracking-widest", columnColors[status])}>
                          {columnEmojis[status]} {columnLabels[status]}
                        </span>
                        <span className="text-xs text-muted-foreground">{rowTasks.length}</span>
                      </div>
                      {/* Droppable horizontal card row */}
                      <MobileDropRow id={status}>
                        {rowTasks.map((task) => {
                          const agent = task.assignedAgent ? agentById[task.assignedAgent] : null;
                          const priority = (task.priority || "low") as TaskPriority;
                          const agentEmoji = agent ? getAgentEmoji(agent.name) : null;
                          const agentInitials = agent
                            ? agentEmoji ?? agent.name.split(" ").map((p) => p[0]).join("")
                            : "?";
                          const agentName = agent?.name ?? "Unassigned";
                          return (
                            <DraggableCard
                              key={task.id}
                              id={task.id}
                              isSelecting={isSelecting}
                              isSelected={selectedTaskIds.has(task.id)}
                              onSelect={(shiftKey) => handleSelectTask(task.id, shiftKey, rowTasks)}
                              onLongPress={() => handleLongPressTask(task.id)}
                            >
                              <div
                                className="min-w-[200px] max-w-[220px] flex-shrink-0 rounded-lg border border-border/60 bg-card/70 px-2.5 py-2 cursor-pointer active:opacity-70"
                                onClick={() => { if (!isSelecting) { setActiveTaskId(task.id); setModalOpen(true); } }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setActiveTaskId(task.id);
                                    setModalOpen(true);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <h3 className="text-xs font-semibold leading-tight line-clamp-2">{task.title}</h3>
                                  <Badge variant={priorityVariant[priority]} className="text-[10px] px-1.5 shrink-0">{priority}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <Avatar className={cn("h-4 w-4", agent ? roleAvatarBg[agent.role] : "")}>
                                    <AvatarFallback className={cn("text-[8px]", agentEmoji ? "text-[10px] leading-none" : (agent ? roleAvatarText[agent.role] : ""))}>
                                      {agentInitials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{agentName}</span>
                                </div>
                              </div>
                            </DraggableCard>
                          );
                        })}
                        {rowTasks.length === 0 && (
                          <div className="min-w-[160px] flex items-center justify-center text-[10px] text-muted-foreground border border-dashed border-border/40 rounded-lg h-16 flex-shrink-0">
                            Drop here
                          </div>
                        )}
                      </MobileDropRow>
                    </div>
                  );
                })}
              </div>

              {/* Desktop board: original columns grid */}
              <div className="hidden lg:grid lg:flex-1 lg:min-h-0 lg:grid-cols-5 lg:overflow-hidden lg:gap-4">
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
                        "min-w-[85vw] snap-start flex-shrink-0 min-h-[50vh]",
                        "lg:min-w-0 lg:flex-shrink lg:min-h-0 lg:overflow-hidden",
                        columnBg[column]
                      )}
                    >
                      <div data-testid={`column-${column}`} className="flex flex-col min-h-0 overflow-hidden">
                        {/* Column header - title row + sort row stacked */}
                        <div className="mb-3 flex-shrink-0 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-sm font-semibold uppercase tracking-[0.2em]",
                              columnColors[column]
                            )}>
                              {columnEmojis[column]} {columnLabels[column]}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {columnTasks.length}
                            </span>
                          </div>
                          <Select
                            aria-label={`Sort ${columnLabels[column]} tasks`}
                            value={columnSorts[column]}
                            onChange={(event) =>
                              setColumnSorts((prev) => ({
                                ...prev,
                                [column]: event.target.value as ColumnSort,
                              }))
                            }
                            className="h-6 w-full rounded-md border-border/60 bg-muted/40 px-2 text-[10px]"
                          >
                            {columnSortOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {/* Task list - scrollable */}
                        <div className="flex-1 overflow-y-auto" data-testid="task-list">
                          <div className="space-y-3">
                            {columnTasks.map((task) => {
                              const agent = task.assignedAgent ? agentById[task.assignedAgent] : null;
                              const priority = (task.priority || "low") as TaskPriority;
                              const timestamp = task.updatedAt ?? task.createdAt;
                              return (
                                <DraggableCard
                                  key={task.id}
                                  id={task.id}
                                  isSelecting={isSelecting}
                                  isSelected={selectedTaskIds.has(task.id)}
                                  onSelect={(shiftKey) => handleSelectTask(task.id, shiftKey, columnTasks)}
                                  onLongPress={() => handleLongPressTask(task.id)}
                                >
                                  <Card
                                    onClick={() => {
                                      if (!isSelecting) {
                                        setActiveTaskId(task.id);
                                        setModalOpen(true);
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (!isSelecting && (event.key === "Enter" || event.key === " ")) {
                                        event.preventDefault();
                                        setActiveTaskId(task.id);
                                        setModalOpen(true);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    className="min-h-[44px]"
                                  >
                                    <CardHeader className="space-y-2 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-sm font-semibold leading-snug">
                                          <LinkifiedText text={task.title} />
                                        </h3>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {column === "done" && (
                                            <button
                                              type="button"
                                              title="Archive task"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleArchiveTask(task.id);
                                              }}
                                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-all"
                                            >
                                              <Archive className="h-3 w-3" />
                                            </button>
                                          )}
                                          <Badge
                                            variant={priorityVariant[priority]}
                                            className="px-2 py-0.5 text-[10px] uppercase tracking-wide"
                                          >
                                            {priority}
                                          </Badge>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-3">
                                          {agent ? (() => {
                                            const emoji = getAgentEmoji(agent.name);
                                            return (
                                              <Avatar className={cn("h-7 w-7", roleAvatarBg[agent.role])}>
                                                <AvatarFallback className={cn("text-[10px]", emoji ? "text-base leading-none" : roleAvatarText[agent.role])}>
                                                  {emoji ?? agent.name.split(" ").map((p) => p[0]).join("")}
                                                </AvatarFallback>
                                              </Avatar>
                                            );
                                          })() : (
                                            <Avatar className="h-7 w-7">
                                              <AvatarFallback className="text-[10px]">?</AvatarFallback>
                                            </Avatar>
                                          )}
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
              </div>{/* end desktop board */}

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
                          {agent ? (() => {
                            const emoji = getAgentEmoji(agent.name);
                            return (
                              <Avatar className={cn("h-7 w-7", roleAvatarBg[agent.role])}>
                                <AvatarFallback className={cn("text-[10px]", emoji ? "text-base leading-none" : roleAvatarText[agent.role])}>
                                  {emoji ?? agent.name.split(" ").map((p) => p[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })() : (
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px]">?</AvatarFallback>
                            </Avatar>
                          )}
                          <span>{agent?.name ?? "Unassigned"}</span>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })() : null}
              </DragOverlay>

              {/* Archive Panel - inside DndContext so it can receive drops */}
              <div className="flex-shrink-0 mt-4 rounded-xl border border-border/60 overflow-hidden">
                <ArchivePanel
                  tasks={archivedTasks}
                  agentById={agentById}
                  onRestore={handleRestoreTask}
                  onOpenTask={(taskId) => {
                    setActiveTaskId(taskId);
                    setModalOpen(true);
                  }}
                  isLoading={loading}
                />
              </div>

              {/* Bottom spacer so cards aren't hidden behind bulk action bar */}
              {isSelecting && <div className="h-20 flex-shrink-0" />}
            </DndContext>
          </section>

          {/* RIGHT SIDEBAR - Event Feed (desktop only; mobile uses overlay) */}
          <aside className="hidden lg:flex h-full min-h-0 flex-col">
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
                          "flex w-full gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:bg-muted/60 min-h-[44px]",
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
                          <p className="text-xs text-muted-foreground truncate">
                            <LinkifiedText text={event.message} />
                          </p>
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
        onArchive={handleArchiveTask}
      />

      <EventDetailModal
        open={!!selectedEvent}
        event={selectedEvent}
        agentName={selectedEvent?.agentId ? agentById[selectedEvent.agentId]?.name : undefined}
        onClose={() => setSelectedEvent(null)}
      />

      <BulkActionBar
        selectedCount={selectedTaskIds.size}
        onClear={handleClearSelection}
        onMoveTo={handleBulkMoveTo}
        onArchive={handleBulkArchive}
        onDelete={handleBulkDelete}
      />
    </div>
  );
}
