import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { searchTasks, type SearchResult, type TaskStatus } from "@/lib/api";

// ── Status metadata ──────────────────────────────────────────────────────────

const statusLabel: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  testing: "Testing",
  done: "Done",
  archived: "Archived",
};

const statusEmoji: Record<TaskStatus, string> = {
  backlog: "📋",
  todo: "🎯",
  "in-progress": "⚡",
  testing: "🧪",
  done: "✅",
  archived: "🗄️",
};

const statusVariant: Record<TaskStatus, "default" | "outline" | "warning" | "danger"> = {
  backlog: "outline",
  todo: "outline",
  "in-progress": "default",
  testing: "warning",
  done: "outline",
  archived: "outline",
};

// Status display order for grouping
const STATUS_ORDER: TaskStatus[] = ["in-progress", "todo", "testing", "backlog", "done"];

// ── Emoji avatar map (mirrors App.tsx) ───────────────────────────────────────

const agentEmojiMap: Record<string, string> = {
  clawvin: "🐾",
  patch:   "🔧",
  scout:   "🎯",
  vitals:  "💪",
  alpha:   "🔍",
  iris:    "📨",
  nova:    "✨",
  ledger:  "📒",
  atlas:   "🏋️",
};

const getAgentEmoji = (agentId?: string | null): string => {
  if (!agentId) return "🤖";
  const key = agentId.split("-")[0].toLowerCase();
  return agentEmojiMap[key] ?? "🤖";
};

// ── Highlight matching text ──────────────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/30 text-amber-200 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export type GlobalSearchProps = {
  onOpenTask: (taskId: string) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function GlobalSearch({ onOpenTask }: GlobalSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keyboard shortcut: Cmd/Ctrl+K ────────────────────────────────────────

  React.useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // ── Focus input when dialog opens ────────────────────────────────────────

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      // Slight delay to let the portal mount
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Debounced search ─────────────────────────────────────────────────────

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchTasks(query.trim());
        setResults(data.results);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── Group results by status ───────────────────────────────────────────────

  const grouped = React.useMemo(() => {
    const map = new Map<TaskStatus, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.status) ?? [];
      list.push(r);
      map.set(r.status, list);
    }
    // Sort groups by STATUS_ORDER
    const ordered: Array<{ status: TaskStatus; items: SearchResult[] }> = [];
    for (const s of STATUS_ORDER) {
      if (map.has(s)) ordered.push({ status: s, items: map.get(s)! });
    }
    // Any leftover statuses
    for (const [s, items] of map.entries()) {
      if (!STATUS_ORDER.includes(s)) ordered.push({ status: s, items });
    }
    return ordered;
  }, [results]);

  // Flat list for keyboard nav
  const flatResults = React.useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped]
  );

  // ── Keyboard navigation inside dialog ────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = flatResults[activeIndex];
      if (result) openResult(result);
    }
  };

  const openResult = (result: SearchResult) => {
    setOpen(false);
    onOpenTask(result.id);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Search trigger button — rendered in place (App.tsx adds it to header) */}
      <button
        type="button"
        id="global-search-trigger"
        aria-label="Search tasks (Cmd+K)"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5",
          "text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground",
          "min-w-[160px]"
        )}
      >
        <span className="text-base">🔍</span>
        <span className="flex-1 text-left">Search tasks…</span>
        <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl p-0 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <span className="text-xl flex-shrink-0">🔍</span>
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, descriptions, comments…"
              className="flex-1 border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
            {loading && (
              <span className="text-xs text-muted-foreground animate-pulse">Searching…</span>
            )}
            <kbd
              className="flex-shrink-0 rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground cursor-pointer"
              onClick={() => setOpen(false)}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[420px] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p className="text-2xl mb-2">🔍</p>
                <p>Type at least 2 characters to search across all tasks</p>
                <p className="text-xs mt-1 opacity-60">Searches titles, descriptions, and comments</p>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p className="text-2xl mb-2">😶‍🌫️</p>
                <p>No tasks found for <strong className="text-foreground">"{query}"</strong></p>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map(({ status, items }) => {
                  return (
                    <div key={status}>
                      {/* Group header */}
                      <div className="flex items-center gap-2 px-2 py-1 mb-1">
                        <span className="text-sm">{statusEmoji[status]}</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {statusLabel[status]}
                        </span>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        {items.map((result) => {
                          const flatIdx = flatResults.indexOf(result);
                          const isActive = flatIdx === activeIndex;
                          return (
                            <button
                              key={`${result.id}-${result.matchType}`}
                              type="button"
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              onClick={() => openResult(result)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                isActive
                                  ? "bg-primary/20 ring-1 ring-primary/40"
                                  : "hover:bg-muted/60"
                              )}
                            >
                              {/* Agent emoji */}
                              <span className="flex-shrink-0 text-lg mt-0.5">
                                {getAgentEmoji(result.assignedAgent)}
                              </span>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className="text-sm font-medium truncate">
                                    <HighlightMatch text={result.title} query={query} />
                                  </span>
                                  <Badge variant={statusVariant[result.status]} className="text-[10px] py-0">
                                    {statusLabel[result.status]}
                                  </Badge>
                                  {result.matchType === "comment" && (
                                    <Badge variant="outline" className="text-[10px] py-0 opacity-70">
                                      💬 comment
                                    </Badge>
                                  )}
                                </div>
                                {result.snippet && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    <HighlightMatch text={result.snippet} query={query} />
                                  </p>
                                )}
                              </div>

                              {/* Arrow hint when active */}
                              {isActive && (
                                <span className="flex-shrink-0 text-xs text-muted-foreground mt-1">↵</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="border-t border-border/60 px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open task</span>
              <span><kbd className="font-mono">ESC</kbd> close</span>
              <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
