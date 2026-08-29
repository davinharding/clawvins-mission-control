import type { EventItem } from "@/lib/api";
import { getDateBucket, getDateLabel } from "@/lib/time";

export const mergeEventsById = (items: EventItem[], incoming: EventItem[]) => {
  const merged = new Map<string, EventItem>();
  items.forEach((event) => merged.set(event.id, event));
  incoming.forEach((event) => merged.set(event.id, event));

  return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
};

export const groupEventsByLocalDate = (events: EventItem[], now = Date.now()) => {
  const groups: Array<{ key: number; label: string; events: EventItem[] }> = [];

  for (const event of events) {
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
};
