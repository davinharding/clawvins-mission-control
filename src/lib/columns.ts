import type { TaskStatus } from "@/lib/api";
import type { Badge } from "@/components/ui/badge";

type TaskPriority = "low" | "medium" | "high" | "critical";

export const columns: TaskStatus[] = ["backlog", "todo", "in-progress", "testing", "done"];

export const columnLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  testing: "Testing",
  done: "Done",
  archived: "Archived",
};

export const columnEmojis: Record<TaskStatus, string> = {
  backlog: "📋",
  todo: "🎯",
  "in-progress": "⚡",
  testing: "🧪",
  done: "✅",
  archived: "🗄️",
};

export const columnColors: Record<TaskStatus, string> = {
  backlog: "text-muted-foreground",
  todo: "text-sky-400",
  "in-progress": "text-violet-400",
  testing: "text-amber-400",
  done: "text-emerald-400",
  archived: "text-muted-foreground",
};

export const columnBg: Record<TaskStatus, string> = {
  backlog: "",
  todo: "border-sky-500/20 bg-sky-500/5",
  "in-progress": "border-violet-500/20 bg-violet-500/5",
  testing: "border-amber-500/40 bg-amber-500/5",
  done: "border-emerald-500/20 bg-emerald-500/5",
  archived: "",
};

export const emptyColumnMessages: Record<TaskStatus, string> = {
  backlog: "No items in backlog",
  todo: "Nothing queued up",
  "in-progress": "No active work",
  testing: "Nothing being tested",
  done: "No completed tasks",
  archived: "No archived tasks",
};

export const priorityVariant: Record<NonNullable<TaskPriority>, Parameters<typeof Badge>[0]["variant"]> = {
  low: "outline",
  medium: "default",
  high: "warning",
  critical: "danger",
};

export const priorityWeight: Record<NonNullable<TaskPriority>, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
