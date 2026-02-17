import * as React from "react";
import { Archive, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Task, Agent, TaskStatus } from "@/lib/api";

const RESTORE_STATUSES: Array<{ label: string; value: TaskStatus }> = [
  { label: "Backlog", value: "backlog" },
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in-progress" },
  { label: "Testing", value: "testing" },
];

type Props = {
  tasks: Task[];
  agentById: Record<string, Agent>;
  onRestore: (taskId: string, status: TaskStatus) => Promise<void>;
  onOpenTask: (taskId: string) => void;
  isLoading?: boolean;
};

export function ArchivePanel({ tasks, agentById, onRestore, onOpenTask, isLoading }: Props) {
  const [open, setOpen] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [restoreMenuId, setRestoreMenuId] = React.useState<string | null>(null);

  const { isOver, setNodeRef } = useDroppable({ id: "archive-panel" });

  // Auto-expand when a task is dragged over the archive panel
  React.useEffect(() => {
    if (isOver) setOpen(true);
  }, [isOver]);

  const handleRestore = async (taskId: string, status: TaskStatus) => {
    setRestoringId(taskId);
    setRestoreMenuId(null);
    try {
      await onRestore(taskId, status);
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-t border-border/60 bg-card/20 transition-colors",
        isOver && "border-primary/60 bg-primary/5"
      )}
    >
      {/* Toggle Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/30",
          isOver && "bg-primary/10"
        )}
        aria-expanded={open}
      >
        <Archive className={cn("h-4 w-4 flex-shrink-0", isOver ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("flex-1 text-sm font-medium", isOver ? "text-primary" : "text-muted-foreground")}>
          Archive
        </span>
        {isOver && (
          <span className="text-xs font-medium text-primary animate-pulse">
            Drop to archive
          </span>
        )}
        {!isOver && tasks.length > 0 && (
          <Badge variant="outline" className="text-xs font-mono">
            {tasks.length}
          </Badge>
        )}
        {!isOver && isLoading && (
          <span className="text-xs text-muted-foreground animate-pulse">loading…</span>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Drop zone indicator when closed but hovering */}
      {isOver && !open && (
        <div className="mx-6 mb-3 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-sm text-primary/70">
          Release to archive this task
        </div>
      )}

      {/* Archive Content */}
      {open && (
        <div className="px-6 pb-6">
          {isOver && (
            <div className="mb-4 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-sm text-primary/70">
              Release to archive this task
            </div>
          )}
          {tasks.length === 0 && !isOver ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Archive className="h-8 w-8 opacity-30" />
              <p className="text-sm">No archived tasks</p>
              <p className="text-xs opacity-60">
                Tasks in "Done" for 24+ hours are archived automatically
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {tasks.map((task) => {
                const agent = task.assignedAgent ? agentById[task.assignedAgent] : null;
                const isRestoring = restoringId === task.id;
                const showRestoreMenu = restoreMenuId === task.id;

                return (
                  <Card
                    key={task.id}
                    className={cn(
                      "relative opacity-75 transition-opacity hover:opacity-100",
                      isRestoring && "opacity-50 pointer-events-none"
                    )}
                  >
                    <CardHeader className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          className="flex-1 text-left"
                        >
                          <h3 className="text-xs font-semibold leading-snug line-clamp-2 text-muted-foreground hover:text-foreground transition-colors">
                            {task.title}
                          </h3>
                        </button>

                        {/* Restore button + menu */}
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            title="Restore task"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRestoreMenuId(showRestoreMenu ? null : task.id);
                            }}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                              "text-muted-foreground hover:text-foreground hover:bg-muted",
                              showRestoreMenu && "bg-muted text-foreground"
                            )}
                            disabled={isRestoring}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>

                          {showRestoreMenu && (
                            <div
                              className="absolute right-0 top-7 z-50 min-w-[130px] rounded-lg border border-border bg-card shadow-lg"
                              onMouseLeave={() => setRestoreMenuId(null)}
                            >
                              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Restore to…
                              </div>
                              {RESTORE_STATUSES.map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => handleRestore(task.id, s.value)}
                                  className="flex w-full items-center px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px]">
                              {agent?.name
                                ?.split(" ")
                                .map((p) => p[0])
                                .join("") ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[70px]">
                            {agent?.name ?? "Unassigned"}
                          </span>
                        </div>
                        <span className="font-mono opacity-60 flex-shrink-0">
                          {formatDate(task.updatedAt)}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Small inline button for the board header to toggle archive visibility.
 * Used to show the count at a glance.
 */
type ArchiveButtonProps = {
  count: number;
  onClick: () => void;
};

export function ArchiveCountBadge({ count, onClick }: ArchiveButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <Archive className="h-3.5 w-3.5" />
      Archive
      {count > 0 && (
        <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono">
          {count}
        </Badge>
      )}
    </Button>
  );
}
