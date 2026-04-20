import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import { format, parseISO, differenceInSeconds } from "date-fns";
import type { Event, EventCategory, EventSubType } from "@shared/schema";

interface Props {
  gameId: string | null;
  rosterId: string | null;
  enabled: boolean;
}

function formatCountdown(target: Date, now: Date): string {
  const total = differenceInSeconds(target, now);
  if (total <= 0) return "Started";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function UpcomingCountdown({ gameId, rosterId, enabled }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled,
  });
  const { data: subTypes = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/event-sub-types"],
    enabled,
  });
  const { data: categories = [] } = useQuery<EventCategory[]>({
    queryKey: ["/api/event-categories"],
    enabled,
  });

  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 60_000;
    return events
      .map(e => {
        if (!e.date) return null;
        try {
          const dt = parseISO(e.date);
          if (e.time) {
            const [h, m] = e.time.split(":").map(Number);
            dt.setHours(h || 0, m || 0, 0, 0);
          }
          return { event: e, when: dt };
        } catch {
          return null;
        }
      })
      .filter((x): x is { event: Event; when: Date } => !!x && x.when.getTime() > cutoff)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, 3);
  }, [events]);

  if (upcoming.length === 0) return null;

  // Resolve event_sub_type (UUID or legacy name) to the actual sub-type record
  const resolveSubType = (value?: string | null): EventSubType | null => {
    if (!value) return null;
    const byId = subTypes.find(s => s.id === value);
    if (byId) return byId;
    const lower = value.toLowerCase().trim();
    return subTypes.find(s => (s.name || "").toLowerCase().trim() === lower) || null;
  };

  const colorFor = (value?: string | null): string | undefined => {
    const st = resolveSubType(value);
    if (!st) return undefined;
    if (st.color) return st.color;
    if (st.categoryId) return categories.find(c => c.id === st.categoryId)?.color || undefined;
    return undefined;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="section-upcoming-countdown">
      {upcoming.map(({ event, when }) => {
        const color = colorFor(event.eventSubType);
        const subTypeName = resolveSubType(event.eventSubType)?.name;
        return (
          <Card key={event.id} className="hover-elevate" data-testid={`card-countdown-${event.id}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color || "hsl(var(--muted-foreground))" }} />
                {subTypeName && (
                  <Badge variant="outline" className="text-xs" data-testid={`badge-subtype-${event.id}`}>
                    {subTypeName}
                  </Badge>
                )}
                {event.opponentName && (
                  <span className="text-xs text-muted-foreground">vs {event.opponentName}</span>
                )}
              </div>
              <div className="font-semibold text-sm truncate" data-testid={`text-event-title-${event.id}`}>
                {event.title || "Untitled Event"}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(when, "MMM d")}
                </span>
                {event.time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </span>
                )}
              </div>
              <div className="text-lg font-mono font-bold tabular-nums text-primary" data-testid={`text-countdown-${event.id}`}>
                {formatCountdown(when, now)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
