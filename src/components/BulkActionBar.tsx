import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/api";

const moveOptions: Array<{ label: string; value: TaskStatus }> = [
  { label: "📋 Backlog", value: "backlog" },
  { label: "🎯 To Do", value: "todo" },
  { label: "⚡ In Progress", value: "in-progress" },
  { label: "🧪 Testing", value: "testing" },
  { label: "✅ Done", value: "done" },
];

interface Props {
  selectedCount: number;
  onClear: () => void;
  onMoveTo: (status: TaskStatus) => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function BulkActionBar({ selectedCount, onClear, onMoveTo, onArchive, onDelete }: Props) {
  const [showMoveMenu, setShowMoveMenu] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Close move menu when deselected
  React.useEffect(() => {
    if (selectedCount === 0) {
      setShowMoveMenu(false);
      setConfirmDelete(false);
    }
  }, [selectedCount]);

  // Close move menu on outside click
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!showMoveMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoveMenu]);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-sm shadow-2xl">
      {/* Safe area padding for PWA / iOS */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-wrap"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {/* Clear */}
        <button
          type="button"
          onClick={() => { onClear(); }}
          className="flex items-center gap-1 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/60 transition min-h-[36px]"
        >
          ✕ Clear
        </button>

        {/* Count */}
        <span className="text-xs font-semibold text-foreground">
          {selectedCount} {selectedCount === 1 ? "task" : "tasks"} selected
        </span>

        <div className="w-px bg-border/60 self-stretch mx-1" />

        {/* Move to... */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => { setShowMoveMenu((v) => !v); setConfirmDelete(false); }}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition min-h-[36px]",
              showMoveMenu
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/70 hover:bg-muted/60"
            )}
          >
            📦 Move to… ▾
          </button>
          {showMoveMenu && (
            <div className="absolute bottom-full mb-1 left-0 z-[60] rounded-lg border border-border/60 bg-card shadow-xl min-w-[148px] py-1">
              {moveOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onMoveTo(opt.value);
                    setShowMoveMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/60 transition"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Archive */}
        <button
          type="button"
          onClick={() => { onArchive(); setShowMoveMenu(false); setConfirmDelete(false); }}
          className="flex items-center gap-1 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60 transition min-h-[36px]"
        >
          🗄 Archive
        </button>

        {/* Delete — inline confirm */}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-destructive">
              Delete {selectedCount}?
            </span>
            <button
              type="button"
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              className="rounded-md bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition min-h-[36px]"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60 transition min-h-[36px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setConfirmDelete(true); setShowMoveMenu(false); }}
            className="flex items-center gap-1 rounded-md border border-destructive/50 text-destructive px-2.5 py-1.5 text-xs font-semibold hover:bg-destructive/10 transition min-h-[36px]"
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}
