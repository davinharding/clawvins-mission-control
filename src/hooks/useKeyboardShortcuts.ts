import * as React from "react";

type ShortcutHandlers = {
  onHelp: () => void;
  onClosePanels: () => void;
  onNewTask: () => void;
  onToggleStats: () => void;
  onToggleEvents: () => void;
  onToggleCosts: () => void;
  onJumpToColumn: (index: number) => void;
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const candidate = element ?? active;
  if (!candidate) return false;
  const tag = candidate.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  return candidate.isContentEditable;
};

export function useKeyboardShortcuts({
  onHelp,
  onClosePanels,
  onNewTask,
  onToggleStats,
  onToggleEvents,
  onToggleCosts,
  onJumpToColumn,
}: ShortcutHandlers) {
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const { key } = event;
      if (key === "?") {
        event.preventDefault();
        onHelp();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        onClosePanels();
        return;
      }
      if (key === "n" || key === "N") {
        event.preventDefault();
        onNewTask();
        return;
      }
      if (key === "s" || key === "S") {
        event.preventDefault();
        onToggleStats();
        return;
      }
      if (key === "e" || key === "E") {
        event.preventDefault();
        onToggleEvents();
        return;
      }
      if (key === "$") {
        event.preventDefault();
        onToggleCosts();
        return;
      }
      if (key >= "1" && key <= "5") {
        event.preventDefault();
        onJumpToColumn(Number(key) - 1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onHelp,
    onClosePanels,
    onNewTask,
    onToggleStats,
    onToggleEvents,
    onToggleCosts,
    onJumpToColumn,
  ]);
}
