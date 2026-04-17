import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGame } from "@/hooks/use-game";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Trophy,
  Swords,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isBefore, isToday, parse } from "date-fns";
import type { Event, Game, GameMode, Map as MapType, Season } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { MultiSelectEventTypeFilter } from "@/components/MultiSelectEventTypeFilter";

const ITEMS_PER_PAGE = 10;

export default function History() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [selectedSubTypes, setSelectedSubTypes] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [expandedFilterCats, setExpandedFilterCats] = useState<Set<string>>(new Set());
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [selectedMap, setSelectedMap] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [showPastOnly, setShowPastOnly] = useState(true);

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: allGames = [] } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ["/api/seasons", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const monthsList: { value: string; label: string }[] = [];

    events.forEach(event => {
      if (event.date) {
        try {
          const date = parseISO(event.date);
          const monthKey = format(date, "yyyy-MM");
          if (!monthsSet.has(monthKey)) {
            monthsSet.add(monthKey);
            monthsList.push({
              value: monthKey,
              label: format(date, "MMMM yyyy"),
            });
          }
        } catch (e) {}
      }
    });

    return monthsList.sort((a, b) => b.value.localeCompare(a.value));
  }, [events]);

  const isPastEvent = (event: Event) => {
    if (!event.date) return false;
    try {
      const eventDate = parseISO(event.date);
      if (event.time) {
        const [hours, minutes] = event.time.split(":").map(Number);
        eventDate.setHours(hours, minutes);
        return isBefore(eventDate, new Date());
      }
      return isBefore(eventDate, new Date()) && !isToday(eventDate);
    } catch {
      return false;
    }
  };

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (selectedSubTypes.size > 0) {
      result = result.filter(e => e.eventSubType && selectedSubTypes.has(e.eventSubType));
    }

    if (showPastOnly) {
      result = result.filter(isPastEvent);
    }

    if (selectedSeason !== "all") {
      result = result.filter(e => e.seasonId === selectedSeason);
    }

    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      result = result.filter(e => {
        if (!e.date) return false;
        try {
          const eventDate = parseISO(e.date);
          return isWithinInterval(eventDate, { start: startDate, end: endDate });
        } catch {
          return false;
        }
      });
    }

    if (selectedMode !== "all" || selectedMap !== "all") {
      const eventIdsWithMatchingGames = new Set<string>();
      allGames.forEach(game => {
        let matches = true;
        if (selectedMode !== "all" && game.gameModeId !== selectedMode) {
          matches = false;
        }
        if (selectedMap !== "all" && game.mapId !== selectedMap) {
          matches = false;
        }
        if (matches && game.eventId) {
          eventIdsWithMatchingGames.add(game.eventId);
        }
      });
      result = result.filter(e => eventIdsWithMatchingGames.has(e.id));
    }

    result.sort((a, b) => {
      const dateA = a.date ? parseISO(a.date).getTime() : 0;
      const dateB = b.date ? parseISO(b.date).getTime() : 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [events, allGames, selectedSeason, selectedMonth, selectedMode, selectedMap, sortOrder, showPastOnly, selectedSubTypes]);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getEventGames = (eventId: string) => {
    return allGames.filter(g => g.eventId === eventId);
  };

  const getResultBadge = (result?: string | null) => {
    switch (result) {
      case "win":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Win</Badge>;
      case "loss":
        return <Badge variant="destructive">Loss</Badge>;
      case "draw":
        return <Badge variant="secondary">Draw</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getEventTypeBadge = (eventType?: string | null) => {
    switch (eventType?.toLowerCase()) {
      case "tournament":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Tournament</Badge>;
      case "scrim":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Scrim</Badge>;
      case "vod review":
        return <Badge className="bg-purple-500 hover:bg-purple-600">VOD Review</Badge>;
      default:
        return <Badge variant="outline">{eventType || "Event"}</Badge>;
    }
  };

  const resetFilters = () => {
    setSelectedSeason("all");
    setSelectedMonth("all");
    setSelectedMode("all");
    setSelectedMap("all");
    setSortOrder("newest");
    setCurrentPage(1);
  };

  if (!hasPermission("view_history")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Event History</h1>
              <p className="text-muted-foreground">Browse and filter past events</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showPastOnly ? "default" : "outline"}
              onClick={() => setShowPastOnly(!showPastOnly)}
              data-testid="toggle-past-only"
            >
              {showPastOnly ? "Past Only" : "All Events"}
            </Button>
            <Button variant="outline" onClick={resetFilters} data-testid="button-reset-filters">
              <Filter className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        </div>

        <MultiSelectEventTypeFilter
          selectedSubTypes={selectedSubTypes}
          onChange={setSelectedSubTypes}
          showFilter={showFilter}
          onToggleShow={() => setShowFilter(s => !s)}
          expandedCategories={expandedFilterCats}
          onToggleCategory={(c) => {
            const next = new Set(expandedFilterCats);
            if (next.has(c)) next.delete(c); else next.add(c);
            setExpandedFilterCats(next);
          }}
        />

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Season</label>
                <Select value={selectedSeason} onValueChange={(v) => { setSelectedSeason(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-season">
                    <SelectValue placeholder="All Seasons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Seasons</SelectItem>
                    {seasons.map(season => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Month</label>
                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-month">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {availableMonths.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Game Mode</label>
                <Select value={selectedMode} onValueChange={(v) => { setSelectedMode(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-mode">
                    <SelectValue placeholder="All Modes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    {gameModes.map(mode => (
                      <SelectItem key={mode.id} value={mode.id}>
                        {mode.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Map</label>
                <Select value={selectedMap} onValueChange={(v) => { setSelectedMap(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-map">
                    <SelectValue placeholder="All Maps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Maps</SelectItem>
                    {maps.map(map => (
                      <SelectItem key={map.id} value={map.id}>
                        {map.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Sort Order</label>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
                  <SelectTrigger data-testid="filter-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
          </p>
        </div>

        {filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
              <p className="text-muted-foreground">
                No events match the current filter criteria.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedEvents.map((event) => {
                const eventGames = getEventGames(event.id);
                const gameWins = eventGames.filter(g => g.result === "win").length;
                const gameLosses = eventGames.filter(g => g.result === "loss").length;
                const season = seasons.find(s => s.id === event.seasonId);

                return (
                  <Card key={event.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-3 min-w-16">
                            {event.date ? (
                              <>
                                <span className="text-xs text-muted-foreground uppercase">
                                  {format(parseISO(event.date), "MMM")}
                                </span>
                                <span className="text-2xl font-bold">
                                  {format(parseISO(event.date), "dd")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(event.date), "yyyy")}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">No date</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getEventTypeBadge(event.eventType)}
                              {getResultBadge(event.result)}
                              {season && (
                                <Badge variant="outline">{season.name}</Badge>
                              )}
                            </div>
                            {event.opponentName && (
                              <p className="font-medium">vs {event.opponentName}</p>
                            )}
                            {event.time && (
                              <p className="text-sm text-muted-foreground">
                                {event.time}
                              </p>
                            )}
                            {eventGames.length > 0 && (
                              <p className="text-sm text-muted-foreground">
                                {eventGames.length} game{eventGames.length !== 1 ? "s" : ""} • 
                                <span className="text-emerald-500 ml-1">{gameWins}W</span> - 
                                <span className="text-red-500 ml-1">{gameLosses}L</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <Link href={`/${fullSlug}/events/${event.id}`}>
                          <Button variant="outline" size="sm" className="gap-2" data-testid={`button-view-event-${event.id}`}>
                            <Eye className="h-4 w-4" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
