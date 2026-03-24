import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkifiedText } from "@/components/LinkifiedText";
import { cn } from "@/lib/utils";
import { stripMarkdown } from "@/lib/markdown";
import { getAgentEmoji, roleAvatarBg, roleAvatarText } from "@/lib/agents";
import { priorityVariant } from "@/lib/columns";
import { formatRelativeTime } from "@/lib/time";
import type { Agent, Task } from "@/lib/api";

type TaskPriority = "low" | "medium" | "high" | "critical";

type TaskCardProps = {
  task: Task;
  agent: Agent | null;
  relativeNow: number;
  variant: "compact" | "full";
  onClick: () => void;
};

export function TaskCard({ task, agent, relativeNow, variant, onClick }: TaskCardProps) {
  const priority = (task.priority || "low") as TaskPriority;
  const isCompact = variant === "compact";

  return (
    <Card
      className={cn(
        "group border-border/80 bg-card/95 hover:bg-card/98 hover:border-border transition-all cursor-pointer",
        isCompact
          ? "min-w-[270px] max-w-[300px] active:scale-[0.99]"
          : "w-full active:scale-[0.995]"
      )}
      onClick={onClick}
    >
      <CardHeader className={cn("p-4", isCompact ? "space-y-2" : "space-y-3")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cn("font-semibold leading-snug", isCompact ? "text-sm line-clamp-2" : "text-sm")}>
              <LinkifiedText text={task.title} />
            </h3>
            {!isCompact && task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {stripMarkdown(task.description)}
              </p>
            )}
          </div>
          <Badge
            variant={priorityVariant[priority]}
            className="px-2 py-0.5 text-[10px] uppercase tracking-wide"
          >
            {priority}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            {agent ? (() => {
              const emoji = getAgentEmoji(agent.name);
              return (
                <Avatar className={cn("h-6 w-6", roleAvatarBg[agent.role])}>
                  <AvatarFallback className={cn("text-[10px]", emoji ? "text-sm leading-none" : roleAvatarText[agent.role])}>
                    {emoji ?? agent.name.split(" ").map((p) => p[0]).join("")}
                  </AvatarFallback>
                </Avatar>
              );
            })() : (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">?</AvatarFallback>
              </Avatar>
            )}
            <span className="truncate">{agent?.name ?? "Unassigned"}</span>
          </div>
          <span className="shrink-0">{formatRelativeTime(task.updatedAt, relativeNow)}</span>
        </div>

        {!isCompact && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px] rounded">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] rounded">
                +{task.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {Date.now() - task.updatedAt > 7 * 24 * 60 * 60 * 1000 && (
              <span className="text-orange-600 font-medium">Stale</span>
            )}
          </div>
          {(task.commentCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{task.commentCount}</span>
            </span>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
