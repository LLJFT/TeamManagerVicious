import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { EventsSkeleton } from "@/components/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  ExternalLink,
  Search,
  Calendar,
  Trophy,
  Gamepad2,
  Map as MapIcon,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Event, Game, GameMode, Map as MapType } from "@shared/schema";
import { useGame } from "@/hooks/use-game";

const ITEMS_PER_PAGE = 10;

export default function EventsHistory() {
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/all-games"],
    queryFn: async () => {
      const eventsList = await fetch("/api/events").then(r => r.json());
      const gamesPromises = eventsList.map((e: Event) => 
        fetch(`/api/events/${e.id}/games`).then(r => r.json())
      );
      const allGamesArrays = await Promise.all(gamesPromises);
      return allGamesArrays.flat();
    },
  });

  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const getModeName = (modeId: string | null) => {
    if (!modeId) return null;
    return gameModes.find(m => m.id === modeId)?.name || null;
  };

  const getMapName = (mapId: string | null) => {
    if (!mapId) return null;
    return maps.find(m => m.id === mapId)?.name || null;
  };

  const getEventGames = (eventId: string) => {
    return allGames.filter(g => g.eventId === eventId);
  };

  const filteredEvents = events
    .filter(event => {
      const eventDate = new Date(event.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastEvent = eventDate < today;
      
      const eventGames = allGames.filter(g => g.eventId === event.id);
      const hasCompletedGames = eventGames.some(g => 
        g.result === "win" || g.result === "loss" || g.result === "draw"
      );
      
      if (!isPastEvent || !hasCompletedGames) {
        return false;
      }
      
      const matchesSearch = searchTerm === "" ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.opponentName && event.opponentName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = eventTypeFilter === "all" || 
        event.eventType.toLowerCase() === eventTypeFilter.toLowerCase();
      const matchesResult = resultFilter === "all" || event.result === resultFilter;
      return matchesSearch && matchesType && matchesResult;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const getResultBadge = (result: string | null) => {
    switch (result) {
      case "win":
        return <Badge variant="default">Win</Badge>;
      case "loss":
        return <Badge variant="destructive">Loss</Badge>;
      case "draw":
        return <Badge variant="secondary">Draw</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return null;
    }
  };

  const getGameResultBadge = (result: string | null) => {
    switch (result) {
      case "win":
        return <Badge variant="default" className="text-xs">W</Badge>;
      case "loss":
        return <Badge variant="destructive" className="text-xs">L</Badge>;
      case "draw":
        return <Badge variant="secondary" className="text-xs">D</Badge>;
      default:
        return null;
    }
  };

  const getEventTypeBadge = (type: string) => {
    const typeLower = type.toLowerCase();
    const colors: Record<string, string> = {
      tournament: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      scrim: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      vod_review: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return (
      <Badge variant="outline" className={colors[typeLower] || ""}>
        {type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  if (eventsLoading) {
    return <EventsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Events History</h1>
              <p className="text-muted-foreground">{filteredEvents.length} events found</p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Select
                value={eventTypeFilter}
                onValueChange={(v) => {
                  setEventTypeFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tournament">Tournament</SelectItem>
                  <SelectItem value="scrim">Scrim</SelectItem>
                  <SelectItem value="vod_review">VOD Review</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={resultFilter}
                onValueChange={(v) => {
                  setResultFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger data-testid="select-result">
                  <SelectValue placeholder="Result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="win">Wins</SelectItem>
                  <SelectItem value="loss">Losses</SelectItem>
                  <SelectItem value="draw">Draws</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Page {currentPage} of {totalPages || 1}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {paginatedEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No events found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {paginatedEvents.map((event) => {
              const eventGames = getEventGames(event.id);
              const isExpanded = expandedEvents.has(event.id);
              
              return (
                <Collapsible key={event.id} open={isExpanded} onOpenChange={() => toggleEventExpansion(event.id)}>
                  <Card className="overflow-hidden">
                    <div className="flex items-center justify-between p-4 hover-elevate">
                      <div className="flex items-center gap-4 flex-1">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-expand-${event.id}`}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <span className="font-semibold text-foreground" data-testid={`text-event-title-${event.id}`}>
                              {event.title}
                            </span>
                            {getEventTypeBadge(event.eventType)}
                            {getResultBadge(event.result)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span>{format(parseISO(event.date), "MMM dd, yyyy")}</span>
                            {event.time && <span>{event.time}</span>}
                            {event.opponentName && (
                              <span>vs {event.opponentName}</span>
                            )}
                            <span className="text-xs">
                              {eventGames.length} {eventGames.length === 1 ? "game" : "games"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link href={`/${fullSlug}/events/${event.id}`}>
                        <Button variant="outline" size="sm" className="gap-2" data-testid={`button-view-${event.id}`}>
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </Link>
                    </div>
                    
                    <CollapsibleContent>
                      <div className="border-t border-border">
                        {eventGames.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No games recorded for this event.
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {eventGames.map((game) => (
                              <div
                                key={game.id}
                                className="p-3 pl-14 flex items-center justify-between hover-elevate"
                                data-testid={`row-game-${game.id}`}
                              >
                                <div className="flex items-center gap-4 flex-1 flex-wrap">
                                  <span className="font-medium w-16">{game.gameCode}</span>
                                  <span className="font-semibold">{game.score}</span>
                                  {getGameResultBadge(game.result)}
                                  {getModeName(game.gameModeId) && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                      <Gamepad2 className="h-3 w-3" />
                                      <span>{getModeName(game.gameModeId)}</span>
                                    </div>
                                  )}
                                  {getMapName(game.mapId) && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                      <MapIcon className="h-3 w-3" />
                                      <span>{getMapName(game.mapId)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {game.link && (
                                    <a href={game.link} target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" variant="ghost">
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              data-testid="button-first-page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="icon"
                    onClick={() => setCurrentPage(page)}
                    data-testid={`button-page-${page}`}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              data-testid="button-last-page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
