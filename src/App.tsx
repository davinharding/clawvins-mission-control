import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type AgentRole = "Main" | "Dev" | "Research" | "Ops";

type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  status: "online" | "offline" | "busy";
};

type TaskStatus = "Backlog" | "Pending" | "In Progress" | "Done";

type Task = {
  id: string;
  title: string;
  agentId: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "critical";
  timestamp: string;
  completionHours?: number;
};

type EventItem = {
  id: string;
  agentId: string;
  text: string;
  timestamp: string;
};

const roles: Array<{ label: string; value: string }> = [
  { label: "All", value: "All" },
  { label: "Main", value: "Main" },
  { label: "Dev", value: "Dev" },
  { label: "Research", value: "Research" },
  { label: "Ops", value: "Ops" }
];

const columns: TaskStatus[] = ["Backlog", "Pending", "In Progress", "Done"];

const initialAgents: Agent[] = [
  { id: "a1", name: "Orion", role: "Main", status: "online" },
  { id: "a2", name: "Nyx", role: "Dev", status: "busy" },
  { id: "a3", name: "Kepler", role: "Research", status: "online" },
  { id: "a4", name: "Vega", role: "Ops", status: "offline" },
  { id: "a5", name: "Nova", role: "Dev", status: "online" }
];

const now = new Date();
const iso = (date: Date) => date.toISOString();

const initialTasks: Task[] = [
  {
    id: "t1",
    title: "Route priority signals to orchestrator",
    agentId: "a1",
    status: "Backlog",
    priority: "medium",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 60 * 6))
  },
  {
    id: "t2",
    title: "Draft retry policy for flaky toolchain",
    agentId: "a3",
    status: "Pending",
    priority: "high",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 45))
  },
  {
    id: "t3",
    title: "Instrument live agent presence stream",
    agentId: "a2",
    status: "In Progress",
    priority: "critical",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 12))
  },
  {
    id: "t4",
    title: "Reconcile webhook delivery backlog",
    agentId: "a4",
    status: "Backlog",
    priority: "low",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 90))
  },
  {
    id: "t5",
    title: "Finalize agent heartbeat UI states",
    agentId: "a5",
    status: "Done",
    priority: "medium",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 25)),
    completionHours: 2.1
  },
  {
    id: "t6",
    title: "Deploy kanban state snapshot sync",
    agentId: "a1",
    status: "Done",
    priority: "high",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 130)),
    completionHours: 3.4
  }
];

const initialEvents: EventItem[] = [
  {
    id: "e1",
    agentId: "a2",
    text: "Started task: Instrument live agent presence stream",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 10))
  },
  {
    id: "e2",
    agentId: "a3",
    text: "Queued task: Draft retry policy for flaky toolchain",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 25))
  },
  {
    id: "e3",
    agentId: "a5",
    text: "Completed task: Finalize agent heartbeat UI states",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 32))
  },
  {
    id: "e4",
    agentId: "a1",
    text: "Synced backlog with control plane",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 50))
  },
  {
    id: "e5",
    agentId: "a4",
    text: "Agent offline: awaiting ops approval",
    timestamp: iso(new Date(now.getTime() - 1000 * 60 * 70))
  }
];

const priorityVariant: Record<Task["priority"], Parameters<typeof Badge>[0]["variant"]> = {
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

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function HomePage() {
  const [selectedRole, setSelectedRole] = React.useState("All");
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [events, setEvents] = React.useState<EventItem[]>(initialEvents);
  const eventRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!eventRef.current) return;
    eventRef.current.scrollTop = eventRef.current.scrollHeight;
  }, [events]);

  const agents = React.useMemo(() => initialAgents, []);

  const visibleAgents = React.useMemo(() => {
    if (selectedRole === "All") return agents;
    return agents.filter((agent) => agent.role === selectedRole);
  }, [agents, selectedRole]);

  const filteredTasks = React.useMemo(() => {
    if (!selectedAgentId) return tasks;
    return tasks.filter((task) => task.agentId === selectedAgentId);
  }, [tasks, selectedAgentId]);

  const stats = React.useMemo(() => {
    const completed = tasks.filter((task) => task.status === "Done");
    const today = new Date();
    const completedToday = completed.filter((task) => {
      const date = new Date(task.timestamp);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
    const activeAgents = agents.filter((agent) => agent.status !== "offline").length;
    const avgCompletion = completed.length
      ? completed.reduce((sum, task) => sum + (task.completionHours ?? 0), 0) / completed.length
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

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task))
    );
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `t${tasks.length + 1}`,
      title: "New orchestration request",
      agentId: agents[0]?.id ?? "a1",
      status: "Pending",
      priority: "medium",
      timestamp: new Date().toISOString()
    };
    setTasks((prev) => [newTask, ...prev]);
    setEvents((prev) => [
      ...prev,
      {
        id: `e${prev.length + 1}`,
        agentId: newTask.agentId,
        text: `Queued task: ${newTask.title}`,
        timestamp: newTask.timestamp
      }
    ]);
  };

  const agentById = React.useMemo(() => {
    return agents.reduce<Record<string, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {});
  }, [agents]);

  return (
    <div className="min-h-screen">
      <header className="flex flex-col gap-6 border-b border-border/60 bg-card/60 px-6 py-6 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Mission Control v2
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Agent Orchestration</h1>
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
      </header>

      <main className="grid gap-6 px-6 py-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Agent Filters
              </p>
              <Tabs value={selectedRole} onValueChange={setSelectedRole} options={roles} />
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
            <Button onClick={handleAddTask}>Add New Task</Button>
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
                    {column}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {filteredTasks.filter((task) => task.status === column).length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  {filteredTasks
                    .filter((task) => task.status === column)
                    .map((task) => {
                      const agent = agentById[task.agentId];
                      return (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, task.id)}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold leading-snug">
                                {task.title}
                              </h3>
                              <Badge variant={priorityVariant[task.priority]}>
                                {task.priority}
                              </Badge>
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
                              <span className="font-mono">{formatTime(task.timestamp)}</span>
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
            <CardContent className="flex-1">
              <ScrollArea ref={eventRef} className="h-[420px] space-y-4 pr-2">
                <div className="space-y-4">
                  {events.map((event) => {
                    const agent = agentById[event.agentId];
                    return (
                      <div
                        key={event.id}
                        className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                      >
                        <Avatar className={cn("ring-2", statusRing[agent?.status ?? "online"]) }>
                          <AvatarFallback>
                            {agent?.name
                              ?.split(" ")
                              .map((part) => part[0])
                              .join("") ?? "MC"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{agent?.name ?? "System"}</p>
                          <p className="text-xs text-muted-foreground">{event.text}</p>
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
    </div>
  );
}
