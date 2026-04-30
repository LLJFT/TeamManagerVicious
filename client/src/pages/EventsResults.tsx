import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Event, Game, Opponent } from "@shared/schema";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { Calendar, Trophy, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";
import { StatsSkeleton } from "@/components/PageSkeleton";
import { AccessDenied } from "@/components/AccessDenied";
import { ShareButton } from "@/components/ShareButton";

export default function EventsResults() {
  const { hasPermission } = useAuth();
  const { fullSlug, currentGame, currentRoster, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/games", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: opponentRoster = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  
  const isEventUpcoming = (event: Event) => {
    const eventDate = parseISO(event.date);
    if (event.time) {
      const [hours, minutes] = event.time.split(':').map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
      return isAfter(eventDate, now);
    }
    return isAfter(eventDate, todayStart) || eventDate.getTime() === todayStart.getTime();
  };

  const upcomingEvents = events.filter(isEventUpcoming)
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA.getTime() - dateB.getTime();
    });

  const pastEvents = events.filter((event) => !isEventUpcoming(event))
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateB.getTime() - dateA.getTime();
    });

  const getResultBadgeVariant = (result: string) => {
    switch (result) {
      case "win":
        return "default";
      case "loss":
        return "destructive";
      case "draw":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getResultText = (result: string) => {
    switch (result) {
      case "win":
        return "Win";
      case "loss":
        return "Loss";
      case "draw":
        return "Draw";
      case "pending":
        return "Pending";
      default:
        return "TBD";
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "Tournament":
        return "bg-yellow-500";
      case "Scrim":
        return "bg-blue-500";
      case "VOD Review":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!hasPermission("view_results")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Events & Results</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <CardTitle>Upcoming Events ({upcomingEvents.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {upcomingEvents.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  No upcoming events
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border rounded-lg p-4 hover-elevate"
                      data-testid={`upcoming-event-${event.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg" data-testid={`event-title-${event.id}`}>
                              {event.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`${getEventTypeColor(event.eventType)} text-white`}
                            >
                              {event.eventType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(parseISO(event.date), "MMM dd, yyyy")}
                            </span>
                            {event.time && <span>{event.time}</span>}
                          </div>
                          {event.opponentName && (
                            <div className="flex items-center gap-2">
                              <OpponentAvatar name={event.opponentName} opponents={opponentRoster} size="xs" />
                              <p className="text-sm">
                                <span className="text-muted-foreground">vs </span>
                                <span className="font-medium">{event.opponentName}</span>
                              </p>
                            </div>
                          )}
                          {event.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <Link href={`/${fullSlug}/events/${event.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-view-${event.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <CardTitle>Past Events ({pastEvents.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {pastEvents.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  No past events
                </div>
              ) : (
                <div className="space-y-3">
                  {pastEvents.map((event) => (
                    <div
                      key={event.id}
                      className="border rounded-lg p-4 hover-elevate"
                      data-testid={`past-event-${event.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg" data-testid={`event-title-${event.id}`}>
                              {event.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`${getEventTypeColor(event.eventType)} text-white`}
                            >
                              {event.eventType}
                            </Badge>
                            {event.result && (
                              <Badge
                                variant={getResultBadgeVariant(event.result)}
                                data-testid={`result-${event.id}`}
                              >
                                {getResultText(event.result)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(parseISO(event.date), "MMM dd, yyyy")}
                            </span>
                            {event.time && <span>{event.time}</span>}
                          </div>
                          {event.opponentName && (
                            <div className="flex items-center gap-2">
                              <OpponentAvatar name={event.opponentName} opponents={opponentRoster} size="xs" />
                              <p className="text-sm">
                                <span className="text-muted-foreground">vs </span>
                                <span className="font-medium">{event.opponentName}</span>
                              </p>
                            </div>
                          )}
                          {event.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {event.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Link href={`/${fullSlug}/events/${event.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-view-${event.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          {event.result && event.result !== "pending" && (() => {
                            const rosterName = `${currentGame?.name || ""} ${currentRoster?.name || ""}`.trim();
                            const eventGames = allGames.filter(g => g.eventId === event.id);
                            const gWins = eventGames.filter(g => g.result === "win").length;
                            const gLosses = eventGames.filter(g => g.result === "loss").length;
                            const gameScore = eventGames.length > 0 ? `${gWins}-${gLosses}` : (event.score || "");
                            const resultText = getResultText(event.result).toUpperCase();
                            const dateStr = format(parseISO(event.date), "MMMM d, yyyy");
                            const eventUrl = `${window.location.origin}/${fullSlug}/events/${event.id}`;
                            const shareText = `${rosterName}${event.opponentName ? ` vs ${event.opponentName}` : ""} - ${gameScore} - ${resultText} | ${dateStr}\n${eventUrl}`;
                            return <ShareButton text={shareText} />;
                          })()}
                        </div>
                      </div>
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
