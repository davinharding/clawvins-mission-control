import { Activity, CheckCircle2, MessageSquare, UserCircle2, Circle } from "lucide-react";
import type { Event, Agent } from "@/lib/api";

interface TaskActivityTabProps {
  events: Event[];
  agents: Agent[];
  loading: boolean;
}

const EVENT_ICON_MAP: Record<string, typeof Activity> = {
  task_status_changed: CheckCircle2,
  task_updated: Activity,
  comment_created: MessageSquare,
  task_assigned: UserCircle2,
};

function getRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function getAgentName(agentId: string | null | undefined, agents: Agent[]) {
  if (!agentId) return "System";
  return agents.find((agent) => agent.id === agentId)?.name ?? "Unknown Agent";
}

export function TaskActivityTab({ events, agents, loading }: TaskActivityTabProps) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading activity…</div>;
  }

  if (events.length === 0) {
    return <div className="text-sm text-muted-foreground">No activity yet for this task.</div>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const Icon = EVENT_ICON_MAP[event.type] ?? Circle;
        const agentName = getAgentName(event.agentId, agents);

        return (
          <div key={event.id} className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
            <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground break-words">{event.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {agentName} · {getRelativeTime(event.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
