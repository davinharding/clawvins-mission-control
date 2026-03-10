import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClear: () => void;
  filteredCount: number;
  totalCount: number;
};

export function TaskSearchBar({
  query,
  onQueryChange,
  tags,
  selectedTags,
  onToggleTag,
  onClear,
  filteredCount,
  totalCount,
}: TaskSearchBarProps) {
  const [draft, setDraft] = React.useState(query);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setDraft(query);
  }, [query]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onQueryChange(draft);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, onQueryChange]);

  const activeTags = React.useMemo(
    () => new Set(selectedTags.map((tag) => tag.toLowerCase())),
    [selectedTags]
  );

  const hasFilters = Boolean(query.trim()) || selectedTags.length > 0;

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDraft("");
    onClear();
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:min-h-[40px]">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search tasks"
          className="h-10 pl-9"
          aria-label="Search tasks"
        />
      </div>

      <div className="flex-1">
        <div
          className={cn(
            "flex gap-2",
            "flex-wrap sm:flex-nowrap",
            "sm:overflow-x-auto sm:scrollbar-hide"
          )}
        >
          {tags.length === 0 && (
            <span className="text-xs text-muted-foreground">No tags yet</span>
          )}
          {tags.map((tag) => {
            const isActive = activeTags.has(tag.toLowerCase());
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                aria-pressed={isActive}
                className="flex-shrink-0"
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className={cn("cursor-pointer", !isActive && "hover:bg-muted/60")}
                >
                  {tag}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:flex-nowrap sm:justify-end">
        <span className="font-mono">
          {filteredCount} of {totalCount} tasks
        </span>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
