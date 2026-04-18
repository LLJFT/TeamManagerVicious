import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, ChevronLeft, ChevronRight, Pencil, Eye, Copy, X, Moon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import type { Event, OffDay, EventCategory, EventSubType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EventDialog } from "@/components/EventDialog";
import { SimpleToast } from "@/components/SimpleToast";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";
import { StatsSkeleton } from "@/components/PageSkeleton";
import { AccessDenied } from "@/components/AccessDenied";

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Greenwich)", offset: 0 },
  { value: "CET", label: "CET (UTC+1)", offset: 1 },
  { value: "CEST", label: "CEST (UTC+2)", offset: 2 },
  { value: "KSA", label: "KSA (UTC+3)", offset: 3 },
  { value: "MSK", label: "MSK (UTC+3)", offset: 3 },
  { value: "GST", label: "GST (UTC+4)", offset: 4 },
  { value: "IST", label: "IST (UTC+5:30)", offset: 5.5 },
  { value: "CST_CN", label: "CST China (UTC+8)", offset: 8 },
  { value: "KST", label: "KST (UTC+9)", offset: 9 },
  { value: "AEST", label: "AEST (UTC+10)", offset: 10 },
  { value: "EST", label: "EST (UTC-5)", offset: -5 },
  { value: "CST_US", label: "CST US (UTC-6)", offset: -6 },
  { value: "MST", label: "MST (UTC-7)", offset: -7 },
  { value: "PST", label: "PST (UTC-8)", offset: -8 },
  { value: "BRT", label: "BRT (UTC-3)", offset: -3 },
];

function shiftTime(time: string | null | undefined, offsetHours: number): string {
  if (!time) return "";
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return time;
  const totalMinutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + Math.round(offsetHours * 60);
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const min = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

interface CustomCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  eventsByDate: Record<string, Event[]>;
  offDaysByDate: Record<string, OffDay>;
  onEventDoubleClick: (event: Event) => void;
  onDayDoubleClick: (date: Date) => void;
  onToggleOffDay: (date: Date, isCurrentlyOff: boolean) => void;
  getEventColor: (eventType: string, eventSubType?: string | null) => { bg: string; border: string; text: string };
  tzOffset?: number;
}

function CustomCalendar({ selectedDate, onSelectDate, eventsByDate, offDaysByDate, onEventDoubleClick, onDayDoubleClick, onToggleOffDay, getEventColor, tzOffset = 0 }: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full" data-testid="calendar-events">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-semibold text-foreground border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate[dateStr] || [];
            const isOffDay = !!offDaysByDate[dateStr];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <div
                key={idx}
                onClick={() => onSelectDate(day)}
                onDoubleClick={() => onDayDoubleClick(day)}
                className={`
                  min-h-[180px] p-2 border-r border-b last:border-r-0
                  cursor-pointer hover-elevate active-elevate-2
                  ${!isCurrentMonth ? "bg-muted/30" : ""}
                  ${isSelected ? "bg-primary/10 border-2 border-primary" : ""}
                  ${isOffDay && dayEvents.length === 0 ? "bg-slate-700/30 dark:bg-slate-800/50" : ""}
                `}
                data-testid={`calendar-day-${dateStr}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${!isCurrentMonth ? "text-muted-foreground" : "text-foreground"}`}>
                    {format(day, "d")}
                  </span>
                  {isOffDay && dayEvents.length === 0 && (
                    <Moon className="w-3 h-3 text-slate-500" />
                  )}
                </div>
                
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[140px]">
                  {isOffDay && dayEvents.length === 0 && (
                    <div
                      className="text-xs px-2 py-1 rounded bg-slate-600/50 dark:bg-slate-700/50 text-slate-200 text-center"
                      data-testid={`calendar-offday-${dateStr}`}
                    >
                      OFF DAY
                    </div>
                  )}
                  {dayEvents.map((event, eventIdx) => {
                    const c = getEventColor(event.eventType, event.eventSubType);
                    return (
                    <div
                      key={eventIdx}
                      className="text-xs px-2 py-1 rounded truncate cursor-pointer border"
                      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                      title={`${event.title}${event.time ? ` - ${shiftTime(event.time, tzOffset)}` : ''}`}
                      data-testid={`calendar-event-${event.id}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onEventDoubleClick(event);
                      }}
                    >
                      <div className="font-semibold">{event.time ? shiftTime(event.time, tzOffset) : ""}</div>
                      <div>{event.title}</div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Events() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | undefined>(undefined);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const tzKey = rosterId ? `roster_tz_${rosterId}` : "";
  const [timezone, setTimezone] = useState<string>("UTC");
  useEffect(() => {
    if (!tzKey) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(tzKey) : null;
    setTimezone(stored || "UTC");
  }, [tzKey]);
  const handleTimezoneChange = (val: string) => {
    setTimezone(val);
    if (tzKey && typeof window !== "undefined") localStorage.setItem(tzKey, val);
  };
  const tzOffset = TIMEZONE_OPTIONS.find(t => t.value === timezone)?.offset ?? 0;

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: offDays = [] } = useQuery<OffDay[]>({
    queryKey: ["/api/off-days", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: allCategories = [] } = useQuery<EventCategory[]>({
    queryKey: ["/api/event-categories", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: allSubTypes = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/event-sub-types", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const subTypeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    allSubTypes.forEach(sub => {
      if (sub.name && sub.color) map.set(sub.name.toLowerCase().trim(), sub.color);
    });
    return map;
  }, [allSubTypes]);

  const categoryColorByName = useMemo(() => {
    const map = new Map<string, string>();
    allCategories.forEach(cat => {
      if (cat.name && cat.color) map.set(cat.name.toLowerCase().trim(), cat.color);
    });
    return map;
  }, [allCategories]);

  const categoryColorBySubTypeName = useMemo(() => {
    const map = new Map<string, string>();
    allSubTypes.forEach(sub => {
      if (!sub.name) return;
      const cat = allCategories.find(c => c.id === sub.categoryId);
      if (cat?.color) map.set(sub.name.toLowerCase().trim(), cat.color);
    });
    return map;
  }, [allSubTypes, allCategories]);

  const getEventColor = (eventType: string, eventSubType?: string | null) => {
    const key = eventSubType?.toLowerCase().trim();
    if (key) {
      const subColor = subTypeColorMap.get(key);
      if (subColor) return { bg: `${subColor}25`, border: `${subColor}50`, text: subColor };
      const parentColor = categoryColorBySubTypeName.get(key);
      if (parentColor) return { bg: `${parentColor}25`, border: `${parentColor}50`, text: parentColor };
    }
    if (eventType) {
      const catColor = categoryColorByName.get(eventType.toLowerCase().trim());
      if (catColor) return { bg: `${catColor}25`, border: `${catColor}50`, text: catColor };
    }
    return { bg: "rgba(128,128,128,0.1)", border: "rgba(128,128,128,0.2)", text: "#888" };
  };

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest("DELETE", `/api/events/${eventId}`, null);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setToastMessage("Event deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Error deleting event");
      setToastType("error");
      setShowToast(true);
    },
  });

  const duplicateEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/duplicate`, null);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setToastMessage("Event duplicated successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Error duplicating event");
      setToastType("error");
      setShowToast(true);
    },
  });

  const addOffDayMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await apiRequest("POST", "/api/off-days", { date });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/off-days"] });
      setToastMessage("OFF day marked");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Error marking OFF day");
      setToastType("error");
      setShowToast(true);
    },
  });

  const removeOffDayMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await apiRequest("DELETE", `/api/off-days/by-date/${date}`, null);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/off-days"] });
      setToastMessage("OFF day removed");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Error removing OFF day");
      setToastType("error");
      setShowToast(true);
    },
  });

  const getEventsForDate = (date: Date | undefined) => {
    if (!date) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter((event) => event.date === dateStr);
  };

  const getDatesWithEvents = () => {
    return events.map((event) => new Date(event.date));
  };

  const getEventsByDateMap = () => {
    const map: Record<string, Event[]> = {};
    events.forEach((event) => {
      if (!map[event.date]) {
        map[event.date] = [];
      }
      map[event.date].push(event);
    });
    return map;
  };

  const getOffDaysByDateMap = () => {
    const map: Record<string, OffDay> = {};
    offDays.forEach((offDay) => {
      map[offDay.date] = offDay;
    });
    return map;
  };

  const eventsForSelectedDate = getEventsForDate(selectedDate);
  const datesWithEvents = getDatesWithEvents();
  const eventsByDate = getEventsByDateMap();
  const offDaysByDate = getOffDaysByDateMap();
  
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const isSelectedDateOffDay = !!offDaysByDate[selectedDateStr];

  const handleToggleOffDay = (date: Date, isCurrentlyOff: boolean) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (isCurrentlyOff) {
      removeOffDayMutation.mutate(dateStr);
    } else {
      addOffDayMutation.mutate(dateStr);
    }
  };

  const getEventTypeBadgeVariant = (eventType: string) => {
    switch (eventType) {
      case "Tournament":
        return "default";
      case "Scrim":
        return "secondary";
      case "VOD Review":
        return "outline";
      default:
        return "outline";
    }
  };

  if (!hasPermission("view_events")) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-background" dir="ltr">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Team Events</h1>
              <p className="text-muted-foreground">Manage tournaments, scrims, and VOD reviews</p>
            </div>
          </div>
          {hasPermission("create_events") && (
          <Button
            onClick={() => {
              setEventToEdit(undefined);
              setShowEventDialog(true);
            }}
            data-testid="button-add-event"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-foreground">Calendar</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Timezone</span>
                <Select value={timezone} onValueChange={handleTimezoneChange}>
                  <SelectTrigger className="w-[200px]" data-testid="select-events-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CustomCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              eventsByDate={eventsByDate}
              offDaysByDate={offDaysByDate}
              onEventDoubleClick={(event) => {
                setEventToEdit(event);
                setShowEventDialog(true);
              }}
              onDayDoubleClick={(date) => {
                setSelectedDate(date);
                setEventToEdit(undefined);
                setShowEventDialog(true);
              }}
              onToggleOffDay={handleToggleOffDay}
              getEventColor={getEventColor}
              tzOffset={tzOffset}
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
              </h2>
              {selectedDate && eventsForSelectedDate.length === 0 && (
                <Button
                  variant={isSelectedDateOffDay ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => handleToggleOffDay(selectedDate, isSelectedDateOffDay)}
                  disabled={addOffDayMutation.isPending || removeOffDayMutation.isPending}
                  data-testid="button-toggle-off-day"
                  className="gap-2"
                >
                  <Moon className="w-4 h-4" />
                  {isSelectedDateOffDay ? "Remove OFF Day" : "Mark as OFF Day"}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="text-muted-foreground">Loading events...</div>
            ) : eventsForSelectedDate.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                {isSelectedDateOffDay ? (
                  <div className="flex flex-col items-center gap-2">
                    <Moon className="w-8 h-8 text-slate-500" />
                    <span>This is an OFF day - no practice scheduled</span>
                  </div>
                ) : (
                  "No events scheduled for this date"
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {eventsForSelectedDate.map((event) => (
                  <Card
                    key={event.id}
                    className="p-4 hover-elevate"
                    data-testid={`card-event-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={getEventTypeBadgeVariant(event.eventType)}
                            data-testid={`badge-event-type-${event.id}`}
                          >
                            {event.eventType}
                          </Badge>
                          {event.time && (
                            <span className="text-sm text-muted-foreground">
                              {event.time}
                            </span>
                          )}
                        </div>
                        <h3
                          className="font-semibold text-foreground"
                          data-testid={`text-event-title-${event.id}`}
                        >
                          {event.title}
                        </h3>
                        {event.description && (
                          <p
                            className="text-sm text-muted-foreground mt-1"
                            data-testid={`text-event-description-${event.id}`}
                          >
                            {event.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {hasPermission("view_results") && (
                        <Link href={`/${fullSlug}/events/${event.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-view-details-${event.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        )}
                        {hasPermission("edit_events") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEventToEdit(event);
                            setShowEventDialog(true);
                          }}
                          data-testid={`button-edit-event-${event.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        )}
                        {hasPermission("create_events") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateEventMutation.mutate(event.id)}
                          disabled={duplicateEventMutation.isPending}
                          data-testid={`button-duplicate-event-${event.id}`}
                          title="Duplicate event"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        )}
                        {hasPermission("delete_events") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(event.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-event-${event.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showEventDialog && (
        <EventDialog
          open={showEventDialog}
          onOpenChange={(open: boolean) => {
            setShowEventDialog(open);
            if (!open) {
              setEventToEdit(undefined);
            }
          }}
          selectedDate={selectedDate}
          eventToEdit={eventToEdit}
          onSuccess={(message: string) => {
            setToastMessage(message);
            setToastType("success");
            setShowToast(true);
            setEventToEdit(undefined);
          }}
        />
      )}

      {showToast && (
        <SimpleToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
