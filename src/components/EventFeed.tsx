import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { LinkifiedText } from "@/components/LinkifiedText";
import { getDateBucket, getDateLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Agent, EventItem } from "@/lib/api";

const eventIcon: Record<string, string> = {
  message_received: "📨",
  agent_response: "💬",
  tool_call: "🔧",
  task_created: "📋",
  task_updated: "↕️",
  task_assigned: "👤",
  comment_created: "💬",
  session_started: "🟢",
};

const taskEventTypes = new Set([
  "task_created",
  "task_updated",
  "task_assigned",
  "task_deleted",
]);

const messageEventTypes = new Set(["message_received", "agent_response"]);

const toolEventTypes = new Set(["tool_call"]);

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type EventFeedProps = {
  events: EventItem[];
  agentById: Record<string, Agent>;
  onSelectEvent: (event: EventItem) => void;
  onRefresh: () => Promise<void>;
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  isLoadingMore: boolean;
};

export type FilterType = "all" | "tasks" | "messages" | "tools" | "system";

export const filterEventsByAgent = (events: EventItem[], selectedAgent: string) => {
  if (selectedAgent === "all") return events;
  return events.filter((event) => event.agentId === selectedAgent);
};

export const filterEventsByType = (events: EventItem[], selectedType: FilterType) => {
  if (selectedType === "all") return events;
  if (selectedType === "tasks") {
    return events.filter((event) => taskEventTypes.has(event.type));
  }
  if (selectedType === "messages") {
    return events.filter((event) => messageEventTypes.has(event.type));
  }
  if (selectedType === "tools") {
    return events.filter((event) => toolEventTypes.has(event.type));
  }
  return events.filter(
    (event) =>
      !taskEventTypes.has(event.type) &&
      !messageEventTypes.has(event.type) &&
      !toolEventTypes.has(event.type)
  );
};

export const getFilteredEvents = (
  events: EventItem[],
  selectedType: FilterType,
  selectedAgent: string
) => filterEventsByType(filterEventsByAgent(events, selectedAgent), selectedType);

export function EventFeed({
  events,
  agentById,
  onSelectEvent,
  onRefresh,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: EventFeedProps) {
  const [selectedType, setSelectedType] = React.useState<FilterType>("all");
  const [selectedAgent, setSelectedAgent] = React.useState("all");

  const agentOptions = React.useMemo(() => {
    const agents = Object.values(agentById).sort((a, b) => a.name.localeCompare(b.name));
    return [
      { value: "all", label: "All Agents" },
      ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
    ];
  }, [agentById]);

  const agentFilteredEvents = React.useMemo(
    () => filterEventsByAgent(events, selectedAgent),
    [events, selectedAgent]
  );

  const counts = React.useMemo(() => {
    let tasks = 0;
    let messages = 0;
    let tools = 0;
    let system = 0;

    for (const event of agentFilteredEvents) {
      if (taskEventTypes.has(event.type)) tasks += 1;
      else if (messageEventTypes.has(event.type)) messages += 1;
      else if (toolEventTypes.has(event.type)) tools += 1;
      else system += 1;
    }

    return {
      all: agentFilteredEvents.length,
      tasks,
      messages,
      tools,
      system,
    };
  }, [agentFilteredEvents]);

  const tabs = React.useMemo(
    () => [
      { value: "all", label: `All (${counts.all})` },
      { value: "tasks", label: `Tasks (${counts.tasks})` },
      { value: "messages", label: `Messages (${counts.messages})` },
      { value: "tools", label: `Tools (${counts.tools})` },
      { value: "system", label: `System (${counts.system})` },
    ],
    [counts]
  );

  const filteredEvents = React.useMemo(
    () => filterEventsByType(agentFilteredEvents, selectedType),
    [agentFilteredEvents, selectedType]
  );

  const groupedEvents = React.useMemo(() => {
    const now = Date.now();
    const groups: Array<{ key: number; label: string; events: EventItem[] }> = [];

    for (const event of filteredEvents) {
      const bucket = getDateBucket(event.timestamp);
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.key !== bucket) {
        groups.push({
          key: bucket,
          label: getDateLabel(event.timestamp, now),
          events: [event],
        });
      } else {
        lastGroup.events.push(event);
      }
    }

    return groups;
  }, [filteredEvents]);

  const handleRefresh = React.useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-shrink-0 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Live Feed
            </p>
            <h3 className="text-lg font-semibold">Agent Events</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Realtime</Badge>
            <Button
              size="sm"
              variant="ghost"
              data-testid="refresh-button"
              onClick={handleRefresh}
              className="h-7 px-2"
              aria-label="Refresh events"
            >
              ↻
            </Button>
          </div>
        </div>
      </div>
      <Separator className="flex-shrink-0" />
      <div className="flex-shrink-0 space-y-4 p-4 sm:p-6">
        <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value as FilterType)} options={tabs} />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Agent
          </p>
          <Select
            value={selectedAgent}
            onChange={(event) => setSelectedAgent(event.target.value)}
            className="h-9"
          >
            {agentOptions.map((agent) => (
              <option key={agent.value} value={agent.value}>
                {agent.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Separator className="flex-shrink-0" />
      <div className="flex-1 overflow-y-auto p-4" data-testid="event-feed">
        <div className="space-y-4">
          {groupedEvents.map((group, groupIndex) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/80">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="space-y-3">
                {group.events.map((event, index) => {
                  const agent = event.agentId ? agentById[event.agentId] : null;
                  const isNew = groupIndex === 0 && index === 0;
                  const icon = eventIcon[event.type] ?? "⚡";
                  return (
                    <button
                      key={event.id}
                      type="button"
                      data-testid="event-item"
                      onClick={() => onSelectEvent(event)}
                      className={cn(
                        "flex w-full gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:bg-muted/60 min-h-[44px]",
                        isNew && "animate-in slide-in-from-top-2 fade-in duration-300"
                      )}
                    >
                      <span className="text-base flex-shrink-0 pt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {agent?.name ?? "System"}
                          </p>
                          {event.detail?.channelName && event.detail.channelName !== "unknown" && (
                            <span className="text-[10px] text-muted-foreground font-mono truncate">
                              {event.detail.channelName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          <LinkifiedText text={event.message} />
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                        {formatTime(event.timestamp)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!filteredEvents.length && (
            <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
              No events match these filters.
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="border border-border/70 text-muted-foreground hover:bg-muted/60"
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
