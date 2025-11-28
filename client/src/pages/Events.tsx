import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, ChevronLeft, ChevronRight, Pencil, Eye } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import type { Event } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EventDialog } from "@/components/EventDialog";
import { SimpleToast } from "@/components/SimpleToast";

interface CustomCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  eventsByDate: Record<string, Event[]>;
  onEventDoubleClick: (event: Event) => void;
  onDayDoubleClick: (date: Date) => void;
}

function CustomCalendar({ selectedDate, onSelectDate, eventsByDate, onEventDoubleClick, onDayDoubleClick }: CustomCalendarProps) {
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
                `}
                data-testid={`calendar-day-${dateStr}`}
              >
                <div className={`text-sm font-semibold mb-2 ${!isCurrentMonth ? "text-muted-foreground" : "text-foreground"}`}>
                  {format(day, "d")}
                </div>
                
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[140px]">
                  {dayEvents.map((event, eventIdx) => (
                    <div
                      key={eventIdx}
                      className={`text-xs px-2 py-1 rounded truncate cursor-pointer ${
                        event.eventType === "Tournament"
                          ? "bg-amber-500 dark:bg-amber-600 text-white"
                          : event.eventType === "Scrim"
                          ? "bg-primary text-primary-foreground"
                          : "bg-violet-500 dark:bg-violet-600 text-white"
                      }`}
                      title={`${event.title}${event.time ? ` - ${event.time}` : ''}`}
                      data-testid={`calendar-event-${event.id}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onEventDoubleClick(event);
                      }}
                    >
                      <div className="font-semibold">{event.time || ""}</div>
                      <div>{event.title}</div>
                    </div>
                  ))}
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | undefined>(undefined);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

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

  const eventsForSelectedDate = getEventsForDate(selectedDate);
  const datesWithEvents = getDatesWithEvents();
  const eventsByDate = getEventsByDateMap();

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
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-6 text-foreground">Calendar</h2>
            <CustomCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              eventsByDate={eventsByDate}
              onEventDoubleClick={(event) => {
                setEventToEdit(event);
                setShowEventDialog(true);
              }}
              onDayDoubleClick={(date) => {
                setSelectedDate(date);
                setEventToEdit(undefined);
                setShowEventDialog(true);
              }}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
            </h2>

            {isLoading ? (
              <div className="text-muted-foreground">Loading events...</div>
            ) : eventsForSelectedDate.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                No events scheduled for this date
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
                      <div className="flex gap-2">
                        <Link href={`/events/${event.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-view-details-${event.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(event.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-event-${event.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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
