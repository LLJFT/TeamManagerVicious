import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Clock, Filter } from "lucide-react";
import { format, isSameDay, isAfter, startOfDay } from "date-fns";
import type { SupportedGame, Roster } from "@shared/schema";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [rosterFilter, setRosterFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/all-events"],
  });

  const { data: allGames = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: allRostersMap = {} } = useQuery<Record<string, Roster[]>>({
    queryKey: ["/api/all-rosters"],
  });

  const allRosters = useMemo(() => {
    return Object.values(allRostersMap).flat();
  }, [allRostersMap]);

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    allEvents.forEach(e => { if (e.type) types.add(e.type); });
    return Array.from(types);
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      if (gameFilter !== "all" && event.gameId !== gameFilter) return false;
      if (rosterFilter !== "all" && event.rosterId !== rosterFilter) return false;
      if (typeFilter !== "all" && event.type !== typeFilter) return false;
      if (searchQuery && !event.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allEvents, gameFilter, rosterFilter, typeFilter, searchQuery]);

  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    filteredEvents.forEach(event => {
      if (event.date) {
        dates.add(format(new Date(event.date), "yyyy-MM-dd"));
      }
    });
    return dates;
  }, [filteredEvents]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return filteredEvents.filter(event => {
      if (!event.date) return false;
      return isSameDay(new Date(event.date), selectedDate);
    });
  }, [filteredEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredEvents
      .filter(event => event.date && isAfter(new Date(event.date), today))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 20);
  }, [filteredEvents]);

  const getGameName = (gameId: string) => allGames.find(g => g.id === gameId)?.name || "Unknown";
  const getRosterName = (rosterId: string) => allRosters.find(r => r.id === rosterId)?.name || "";

  const rosterOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [];
    allGames.forEach(game => {
      const gameRosters = allRostersMap[game.id] || [];
      gameRosters.forEach(roster => {
        options.push({ id: roster.id, label: `${game.name} — ${roster.name}` });
      });
    });
    return options;
  }, [allGames, allRostersMap]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-calendar-title">Calendar</h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-game-filter">
            <SelectValue placeholder="All Games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Games</SelectItem>
            {allGames.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rosterFilter} onValueChange={setRosterFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-roster-filter">
            <SelectValue placeholder="All Rosters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rosters</SelectItem>
            {rosterOptions.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {eventTypes.length > 0 && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {eventTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-[200px]"
          data-testid="input-event-search"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{
                  hasEvent: (date) => eventDates.has(format(date, "yyyy-MM-dd")),
                }}
                modifiersClassNames={{
                  hasEvent: "bg-primary/20 font-bold text-primary",
                }}
                className="rounded-md"
                data-testid="calendar-widget"
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedDate && (
            <Card>
              <CardHeader className="pb-3 gap-2">
                <CardTitle className="text-base" data-testid="text-selected-date">
                  Events on {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-events">No events on this date</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedDateEvents.map((event, idx) => (
                      <div key={event.id || idx} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`card-event-${event.id || idx}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{event.title}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <Badge variant="secondary" className="text-xs">{getGameName(event.gameId)}</Badge>
                            {event.rosterId && <Badge variant="outline" className="text-xs">{getRosterName(event.rosterId)}</Badge>}
                            {event.type && <Badge variant="outline" className="text-xs">{event.type}</Badge>}
                          </div>
                        </div>
                        {event.time && (
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{event.time}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3 gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {upcomingEvents.map((event, idx) => (
                    <div key={event.id || idx} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`card-upcoming-${event.id || idx}`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{event.title}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <Badge variant="secondary" className="text-xs">{getGameName(event.gameId)}</Badge>
                          {event.rosterId && <Badge variant="outline" className="text-xs">{getRosterName(event.rosterId)}</Badge>}
                          {event.type && <Badge variant="outline" className="text-xs">{event.type}</Badge>}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {event.date && format(new Date(event.date), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
