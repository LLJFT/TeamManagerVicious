import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Filter, Search } from "lucide-react";
import {
  format,
  isSameDay,
  isAfter,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isToday,
  isSameMonth,
} from "date-fns";
import type { SupportedGame, Roster, EventCategory, EventSubType } from "@shared/schema";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  const { data: allCategories = [] } = useQuery<EventCategory[]>({
    queryKey: ["/api/all-event-categories"],
  });

  const { data: allSubTypes = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/all-event-sub-types"],
  });

  const allRosters = useMemo(() => Object.values(allRostersMap).flat(), [allRostersMap]);

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    allEvents.forEach(e => { if (e.eventType) types.add(e.eventType); });
    return Array.from(types);
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      if (gameFilter !== "all" && event.gameId !== gameFilter) return false;
      if (rosterFilter !== "all" && event.rosterId !== rosterFilter) return false;
      if (typeFilter !== "all" && event.eventType !== typeFilter) return false;
      if (searchQuery && !event.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allEvents, gameFilter, rosterFilter, typeFilter, searchQuery]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredEvents.forEach(event => {
      if (event.date) {
        const key = format(new Date(event.date), "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
      }
    });
    return map;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const selectedDateEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(key) || [];
  }, [eventsByDate, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredEvents
      .filter(event => event.date && isAfter(new Date(event.date), today))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
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

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const subTypeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    allSubTypes.forEach(sub => {
      if (sub.name && sub.color) map.set(sub.name.toLowerCase(), sub.color);
    });
    return map;
  }, [allSubTypes]);

  const getEventColor = (eventType: string, eventSubType?: string) => {
    if (eventSubType) {
      const subColor = subTypeColorMap.get(eventSubType.toLowerCase());
      if (subColor) return { bg: `${subColor}25`, border: `${subColor}50`, text: subColor };
    }
    return { bg: "rgba(128,128,128,0.1)", border: "rgba(128,128,128,0.2)", text: "#888" };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 pb-2 flex items-center justify-between gap-2 flex-wrap border-b">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <h1 className="text-xl font-bold" data-testid="text-calendar-title">Calendar</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-game-filter">
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
            <SelectTrigger className="w-[180px]" data-testid="select-roster-filter">
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
              <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
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
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[160px] pl-8"
              data-testid="input-event-search"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0 border-r">
          <div className="flex items-center justify-between gap-2 p-3 border-b">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentMonth(new Date());
                  setSelectedDate(new Date());
                }}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7">
            {weekDays.map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                {day}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-0 overflow-y-auto">
            {calendarDays.map((day, i) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate.get(dayKey) || [];
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={i}
                  className={`border-b border-r p-1 min-h-[80px] cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5 ring-1 ring-primary/30 ring-inset" : "hover-elevate"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  onClick={() => setSelectedDate(day)}
                  data-testid={`cell-day-${dayKey}`}
                >
                  <div className={`text-xs font-medium mb-0.5 ${
                    isToday(day) ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center" : ""
                  }`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={event.id || idx}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded border truncate"
                        style={{
                          backgroundColor: getEventColor(event.eventType, event.eventSubType).bg,
                          borderColor: getEventColor(event.eventType, event.eventSubType).border,
                          color: getEventColor(event.eventType, event.eventSubType).text,
                        }}
                        data-testid={`event-dot-${event.id || idx}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-[340px] flex-shrink-0 flex flex-col min-h-0 overflow-hidden">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm" data-testid="text-selected-date">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedDateEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-events">
                No events on this date
              </p>
            ) : (
              selectedDateEvents.map((event, idx) => (
                <Card key={event.id || idx} className="overflow-visible" data-testid={`card-event-${event.id || idx}`}>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <Badge variant="secondary" className="text-xs">{getGameName(event.gameId)}</Badge>
                      {event.rosterId && <Badge variant="outline" className="text-xs">{getRosterName(event.rosterId)}</Badge>}
                      {event.eventType && (
                        <Badge variant="outline" className="text-xs" style={{
                          backgroundColor: getEventColor(event.eventType, event.eventSubType).bg,
                          borderColor: getEventColor(event.eventType, event.eventSubType).border,
                          color: getEventColor(event.eventType, event.eventSubType).text,
                        }}>{event.eventType}</Badge>
                      )}
                    </div>
                    {event.time && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {upcomingEvents.length > 0 && (
            <div className="border-t p-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Upcoming
              </h4>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {upcomingEvents.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="flex items-center justify-between gap-2 text-sm cursor-pointer rounded p-1.5 hover-elevate"
                    onClick={() => {
                      const eventDate = new Date(event.date);
                      setSelectedDate(eventDate);
                      setCurrentMonth(eventDate);
                    }}
                    data-testid={`card-upcoming-${event.id || idx}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{event.title}</p>
                      <p className="text-[10px] text-muted-foreground">{getGameName(event.gameId)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(event.date), "MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
