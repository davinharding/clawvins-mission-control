import * as React from "react";

const SHORTCUTS = [
  { key: "?", label: "Open help" },
  { key: "Esc", label: "Close panels" },
  { key: "N", label: "New task" },
  { key: "S", label: "Toggle stats" },
  { key: "E", label: "Toggle events" },
  { key: "$", label: "Toggle costs" },
  { key: "1–5", label: "Jump to column" },
];

type KeyboardShortcutsProps = {
  open: boolean;
  onClose: () => void;
};

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Keyboard shortcuts
            </p>
            <h2 className="text-lg font-semibold text-foreground">Quick commands</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border/70 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label="Close shortcuts"
          >
            Esc
          </button>
        </div>

        <div className="mt-5 grid grid-cols-[auto,1fr] items-center gap-x-4 gap-y-3">
          {SHORTCUTS.map((shortcut) => (
            <React.Fragment key={shortcut.key}>
              <kbd className="rounded-md border border-border/70 bg-muted/70 px-2 py-1 text-xs font-mono text-muted-foreground">
                {shortcut.key}
              </kbd>
              <span className="text-sm text-muted-foreground">
                {shortcut.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
