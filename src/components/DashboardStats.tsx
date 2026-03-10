import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TaskStatsResponse, TaskStatus } from "@/lib/api";

const STATUS_ORDER: Array<Exclude<TaskStatus, "archived">> = [
  "backlog",
  "todo",
  "in-progress",
  "testing",
  "done",
];

const STATUS_LABELS: Record<Exclude<TaskStatus, "archived">, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  testing: "Testing",
  done: "Done",
};

const STATUS_BG: Record<Exclude<TaskStatus, "archived">, string> = {
  backlog: "bg-muted-foreground/40",
  todo: "bg-sky-400",
  "in-progress": "bg-violet-400",
  testing: "bg-amber-400",
  done: "bg-emerald-400",
};

const STATUS_TEXT: Record<Exclude<TaskStatus, "archived">, string> = {
  backlog: "text-muted-foreground",
  todo: "text-sky-400",
  "in-progress": "text-violet-400",
  testing: "text-amber-400",
  done: "text-emerald-400",
};

const getSparklineValues = (stats: TaskStatsResponse | null) => {
  const values = stats?.dailyCompletions?.map((entry) => entry.count) ?? [];
  if (values.length >= 7) return values.slice(-7);
  const padding = Array.from({ length: 7 - values.length }, () => 0);
  return [...padding, ...values];
};

const buildSparklinePoints = (values: number[], width: number, height: number) => {
  const padding = 2;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1
        ? padding + innerWidth / 2
        : padding + (innerWidth * index) / (values.length - 1);
      const y = padding + innerHeight - (value / max) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

type DashboardStatsProps = {
  stats: TaskStatsResponse | null;
  activeAgents: number;
  completedToday: number;
  variant?: "compact" | "full";
  className?: string;
};

export function DashboardStats({
  stats,
  activeAgents,
  completedToday,
  variant = "full",
  className,
}: DashboardStatsProps) {
  const statusCounts = React.useMemo(() => {
    const fallback = {
      backlog: 0,
      todo: 0,
      "in-progress": 0,
      testing: 0,
      done: 0,
    };
    return stats?.statusCounts ?? fallback;
  }, [stats]);

  const total = STATUS_ORDER.reduce(
    (sum, status) => sum + (statusCounts[status] ?? 0),
    0
  );
  const normalizedTotal = total || STATUS_ORDER.length;

  const sparklineValues = React.useMemo(() => getSparklineValues(stats), [stats]);
  const sparklinePoints = React.useMemo(
    () => buildSparklinePoints(sparklineValues, 80, 24),
    [sparklineValues]
  );

  const thisWeekTotal = stats?.thisWeekTotal ?? 0;
  const prevWeekTotal = stats?.prevWeekTotal ?? 0;
  const delta = thisWeekTotal - prevWeekTotal;
  const deltaLabel = delta === 0 ? "—0" : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
  const deltaClass =
    delta > 0
      ? "text-emerald-400"
      : delta < 0
        ? "text-rose-400"
        : "text-muted-foreground";

  const valueClass = variant === "compact" ? "text-sm font-semibold" : "text-2xl font-semibold";
  const labelClass = variant === "compact" ? "text-[10px]" : "text-sm";
  const wrapperClass = variant === "compact"
    ? "rounded-lg border border-border/60 bg-card/70 px-2 py-2"
    : "px-4 py-3";

  const StatWrapper = ({ children, className: extraClass }: { children: React.ReactNode; className?: string }) =>
    variant === "compact" ? (
      <div className={cn(wrapperClass, extraClass)}>{children}</div>
    ) : (
      <Card className={cn(wrapperClass, extraClass)}>{children}</Card>
    );

  return (
    <div
      className={cn(
        variant === "compact"
          ? "grid grid-cols-2 gap-1.5"
          : "flex flex-wrap gap-3 text-sm",
        className
      )}
    >
      <StatWrapper className={variant === "compact" ? "col-span-2" : "min-w-[260px]"}>
        <div className={cn("text-muted-foreground font-semibold", labelClass)}>Task Status</div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted/40">
          {STATUS_ORDER.map((status) => {
            const count = statusCounts[status] ?? 0;
            const width = `${(total ? count / total : 1 / STATUS_ORDER.length) * 100}%`;
            return (
              <div
                key={status}
                className={cn("h-full", STATUS_BG[status], total ? "opacity-100" : "opacity-40")}
                style={{ width }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_BG[status])} />
              <span className={cn(STATUS_TEXT[status])}>{STATUS_LABELS[status]}</span>
              <span className="text-foreground/80">{statusCounts[status] ?? 0}</span>
            </div>
          ))}
        </div>
      </StatWrapper>

      <StatWrapper>
        <div className={cn("text-muted-foreground font-semibold", labelClass)}>Done Today</div>
        <div className={valueClass}>{completedToday}</div>
      </StatWrapper>

      <StatWrapper>
        <div className={cn("text-muted-foreground font-semibold", labelClass)}>Active Agents</div>
        <div className={valueClass}>{activeAgents}</div>
      </StatWrapper>

      <StatWrapper className={variant === "compact" ? "col-span-2" : "min-w-[260px]"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={cn("text-muted-foreground font-semibold", labelClass)}>
              Completed This Week
            </div>
            <div className="flex items-baseline gap-2">
              <div className={valueClass}>{thisWeekTotal}</div>
              <div className={cn("text-xs font-semibold", deltaClass)}>{deltaLabel}</div>
            </div>
            <div className="text-[10px] text-muted-foreground">vs prev week</div>
          </div>
          <svg
            width={80}
            height={24}
            viewBox="0 0 80 24"
            fill="none"
            className="text-emerald-400"
            aria-hidden="true"
          >
            <polyline
              points={sparklinePoints}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </StatWrapper>
    </div>
  );
}
