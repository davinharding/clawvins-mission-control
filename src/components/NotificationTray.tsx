import * as React from "react";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  type: "task_moved" | "task_completed" | "comment_added" | "task_assigned" | "task_created";
  title: string;
  message: string;
  taskId?: string;
  read: boolean;
  timestamp: number;
};

type Props = {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClickNotification: (n: Notification) => void;
};

export function NotificationTray({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClickNotification,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:bg-muted"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute right-4 top-11 z-50 w-[calc(100vw-2rem)] max-w-[340px] rounded-xl border border-border bg-slate-950/95 backdrop-blur-sm shadow-2xl">
            <div 
              className="flex items-center justify-between border-b border-border/60 px-4 py-3"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
            >
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
              {notifications.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    onMarkRead(n.id);
                    onClickNotification(n);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/60",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span className="mt-0.5 text-base">
                    {n.type === "comment_added"
                      ? "💬"
                      : n.type === "task_completed"
                      ? "✅"
                      : n.type === "task_moved"
                      ? "↕️"
                      : n.type === "task_assigned"
                      ? "👤"
                      : "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                      {new Date(n.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
