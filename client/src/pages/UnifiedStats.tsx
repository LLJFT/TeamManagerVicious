import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Gamepad2,
  Map as MapIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Swords,
  Calendar,
  CalendarDays,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Event, Game, GameMode, Map as MapType, Season } from "@shared/schema";
import { useGame } from "@/hooks/use-game";
import { StatsSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";

interface StatsSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

interface MonthOption {
  value: string;
  label: string;
  year: number;
  month: number;
}

type StatsMode = "overall" | "monthly" | "seasonal";
type EventTypeFilter = "all" | "scrim" | "tournament";

export default function UnifiedStats() {
  const { gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const { hasPermission } = useAuth();
  const initialMode: StatsMode = "overall";
  const [statsMode, setStatsMode] = useState<StatsMode>(initialMode);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
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

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  const availableMonths = useMemo<MonthOption[]>(() => {
    const monthsSet = new Set<string>();
    const monthsList: MonthOption[] = [];

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
              year: date.getFullYear(),
              month: date.getMonth(),
            });
          }
        } catch (e) {
        }
      }
    });

    return monthsList.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [events]);

  const filteredEvents = useMemo(() => {
    let baseEvents = [...events];

    if (statsMode === "seasonal" && selectedSeasonId) {
      baseEvents = baseEvents.filter(e => e.seasonId === selectedSeasonId);
    } else if (statsMode === "monthly" && selectedMonth) {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      baseEvents = baseEvents.filter(event => {
        if (!event.date) return false;
        try {
          const eventDate = parseISO(event.date);
          return isWithinInterval(eventDate, { start: startDate, end: endDate });
        } catch (e) {
          return false;
        }
      });
    }

    if (eventTypeFilter === "scrim") {
      baseEvents = baseEvents.filter(e => e.eventType?.toLowerCase() === "scrim");
    } else if (eventTypeFilter === "tournament") {
      baseEvents = baseEvents.filter(e => e.eventType?.toLowerCase() === "tournament");
    }

    return baseEvents;
  }, [events, statsMode, selectedSeasonId, selectedMonth, eventTypeFilter]);

  const filteredEventIds = useMemo(() => new Set(filteredEvents.map(e => e.id)), [filteredEvents]);
  
  const filteredGames = useMemo(() => {
    let games = allGames.filter(g => filteredEventIds.has(g.eventId || ""));
    
    if (eventTypeFilter === "scrim") {
      games = games.filter(g => g.eventType?.toLowerCase() === "scrim");
    } else if (eventTypeFilter === "tournament") {
      games = games.filter(g => g.eventType?.toLowerCase() === "tournament");
    }
    
    return games;
  }, [allGames, filteredEventIds, eventTypeFilter]);

  const calculateStats = (items: { result?: string | null }[]): StatsSummary => {
    const total = items.length;
    const wins = items.filter(i => i.result === "win").length;
    const losses = items.filter(i => i.result === "loss").length;
    const draws = items.filter(i => i.result === "draw").length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, draws, winRate };
  };

  const quickStats = useMemo(() => ({
    totalEvents: filteredEvents.length,
    totalGames: filteredGames.length,
    eventWins: filteredEvents.filter(e => e.result === "win").length,
    gameWins: filteredGames.filter(g => g.result === "win").length,
    scrims: filteredEvents.filter(e => e.eventType?.toLowerCase() === "scrim").length,
    tournaments: filteredEvents.filter(e => e.eventType?.toLowerCase() === "tournament").length,
  }), [filteredEvents, filteredGames]);

  const overallEventStats = useMemo(() => calculateStats(filteredEvents.filter(e => e.result)), [filteredEvents]);
  const overallGameStats = useMemo(() => calculateStats(filteredGames.filter(g => g.result)), [filteredGames]);

  const statsByGameMode = useMemo(() => {
    return gameModes.map(mode => {
      const modeGames = filteredGames.filter(g => g.gameModeId === mode.id && g.result);
      const stats = calculateStats(modeGames);
      return { mode, ...stats };
    }).filter(s => s.total > 0);
  }, [gameModes, filteredGames]);

  const statsByMap = useMemo(() => {
    return maps.map(map => {
      const mapGames = filteredGames.filter(g => g.mapId === map.id && g.result);
      const stats = calculateStats(mapGames);
      const mode = gameModes.find(m => m.id === map.gameModeId);
      return { map, modeName: mode?.name || "Unknown", ...stats };
    }).filter(s => s.total > 0);
  }, [maps, gameModes, filteredGames]);

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return "text-emerald-500";
    if (rate >= 40) return "text-amber-500";
    return "text-red-500";
  };

  const getWinRateIcon = (rate: number) => {
    if (rate >= 50) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (rate > 30) return <Minus className="h-4 w-4 text-amber-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getModeTitle = () => {
    switch (statsMode) {
      case "monthly":
        return "Monthly Statistics";
      case "seasonal":
        return "Season Statistics";
      default:
        return "Overall Statistics";
    }
  };

  const getModeDescription = () => {
    switch (statsMode) {
      case "monthly":
        return "Performance filtered by month";
      case "seasonal":
        return "Performance filtered by season";
      default:
        return "Combined performance across all events";
    }
  };

  const getModeIcon = () => {
    switch (statsMode) {
      case "monthly":
        return <Calendar className="h-6 w-6 text-primary" />;
      case "seasonal":
        return <CalendarDays className="h-6 w-6 text-amber-500" />;
      default:
        return <BarChart3 className="h-6 w-6 text-primary" />;
    }
  };

  const selectedMonthLabel = availableMonths.find(m => m.value === selectedMonth)?.label;

  const needsSelection = (statsMode === "monthly" && !selectedMonth) || (statsMode === "seasonal" && !selectedSeasonId);
  const hasData = filteredEvents.length > 0;

  if (!hasPermission("view_statistics")) {
    return <AccessDenied />;
  }

  if (eventsLoading) {
    return <StatsSkeleton />;
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
              <div className="flex items-center gap-2">
                {getModeIcon()}
                <h1 className="text-3xl font-bold text-foreground">{getModeTitle()}</h1>
              </div>
              <p className="text-muted-foreground">{getModeDescription()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stats Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={statsMode} onValueChange={(v) => setStatsMode(v as StatsMode)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overall" className="gap-2" data-testid="tab-overall">
                    <BarChart3 className="h-4 w-4" />
                    Overall
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="gap-2" data-testid="tab-monthly">
                    <Calendar className="h-4 w-4" />
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value="seasonal" className="gap-2" data-testid="tab-seasonal">
                    <CalendarDays className="h-4 w-4" />
                    Seasonal
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Event Type Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as EventTypeFilter)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all" className="gap-2" data-testid="tab-all-events">
                    <Trophy className="h-4 w-4" />
                    All Events
                  </TabsTrigger>
                  <TabsTrigger value="scrim" className="gap-2" data-testid="tab-scrims">
                    <Swords className="h-4 w-4" />
                    Scrims
                  </TabsTrigger>
                  <TabsTrigger value="tournament" className="gap-2" data-testid="tab-tournaments">
                    <Trophy className="h-4 w-4" />
                    Tournaments
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {statsMode === "monthly" && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-primary" />
                Select Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-80" data-testid="select-month">
                  <SelectValue placeholder="Select a month..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableMonths.length === 0 && (
                <p className="text-muted-foreground text-sm mt-2">
                  No events with dates found. Add events to see monthly statistics.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {statsMode === "seasonal" && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-5 w-5 text-amber-500" />
                Select Season
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                <SelectTrigger className="w-full md:w-80" data-testid="select-season">
                  <SelectValue placeholder="Select a season..." />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      <div className="flex flex-col">
                        <span>{season.name}</span>
                        {season.description && (
                          <span className="text-xs text-muted-foreground">{season.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {seasons.length === 0 && (
                <p className="text-muted-foreground text-sm mt-2">
                  No seasons configured. Go to Settings to add seasons.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {statsMode === "monthly" && selectedMonthLabel && (
          <div className="mb-4">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {selectedMonthLabel}
            </Badge>
          </div>
        )}

        {statsMode === "seasonal" && selectedSeason && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {selectedSeason.name}
            </Badge>
            {selectedSeason.description && (
              <span className="text-muted-foreground text-sm">
                {selectedSeason.description}
              </span>
            )}
          </div>
        )}

        {needsSelection ? (
          <Card>
            <CardContent className="py-16 text-center">
              {statsMode === "monthly" ? (
                <>
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-xl font-semibold mb-2">Select a Month</h3>
                  <p className="text-muted-foreground">
                    Choose a month above to view its performance statistics
                  </p>
                </>
              ) : (
                <>
                  <CalendarDays className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-xl font-semibold mb-2">Select a Season</h3>
                  <p className="text-muted-foreground">
                    Choose a season above to view its performance statistics
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : !hasData && statsMode !== "overall" ? (
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="stat-total-events">{quickStats.totalEvents}</div>
                      <div className="text-xs text-muted-foreground">Events</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Gamepad2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="stat-total-games">{quickStats.totalGames}</div>
                      <div className="text-xs text-muted-foreground">Games</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-500" data-testid="stat-event-wins">{quickStats.eventWins}</div>
                      <div className="text-xs text-muted-foreground">Event Wins</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Trophy className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-500" data-testid="stat-game-wins">{quickStats.gameWins}</div>
                      <div className="text-xs text-muted-foreground">Game Wins</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <Swords className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="stat-scrims">{quickStats.scrims}</div>
                      <div className="text-xs text-muted-foreground">Scrims</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Trophy className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="stat-tournaments">{quickStats.tournaments}</div>
                      <div className="text-xs text-muted-foreground">Tournaments</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Event Performance</CardTitle>
                      <CardDescription>Win rate across events</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold">{overallEventStats.total}</span>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          {getWinRateIcon(overallEventStats.winRate)}
                          <span className={`text-2xl font-bold ${getWinRateColor(overallEventStats.winRate)}`}>
                            {overallEventStats.winRate.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">Win Rate</span>
                      </div>
                    </div>
                    <Progress value={overallEventStats.winRate} className="h-3" />
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-emerald-500">{overallEventStats.wins} Wins</span>
                      <span className="text-red-500">{overallEventStats.losses} Losses</span>
                      <span className="text-amber-500">{overallEventStats.draws} Draws</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <Gamepad2 className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <CardTitle>Game Performance</CardTitle>
                      <CardDescription>Win rate across games</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold">{overallGameStats.total}</span>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          {getWinRateIcon(overallGameStats.winRate)}
                          <span className={`text-2xl font-bold ${getWinRateColor(overallGameStats.winRate)}`}>
                            {overallGameStats.winRate.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">Win Rate</span>
                      </div>
                    </div>
                    <Progress value={overallGameStats.winRate} className="h-3" />
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-emerald-500">{overallGameStats.wins} Wins</span>
                      <span className="text-red-500">{overallGameStats.losses} Losses</span>
                      <span className="text-amber-500">{overallGameStats.draws} Draws</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Gamepad2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>By Game Mode</CardTitle>
                      <CardDescription>Performance breakdown by mode</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {statsByGameMode.length === 0 ? (
                    <div className="p-8 text-center">
                      <Gamepad2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No game mode data available</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {statsByGameMode.map(({ mode, ...stats }) => (
                        <div key={mode.id} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{mode.name}</span>
                            <div className="flex items-center gap-2">
                              {getWinRateIcon(stats.winRate)}
                              <span className={`font-bold ${getWinRateColor(stats.winRate)}`}>
                                {stats.winRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <Progress value={stats.winRate} className="h-1.5 mb-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{stats.total} games</span>
                            <span>{stats.wins}W - {stats.losses}L - {stats.draws}D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <MapIcon className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <CardTitle>By Map</CardTitle>
                      <CardDescription>Performance breakdown by map</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-96 overflow-y-auto">
                  {statsByMap.length === 0 ? (
                    <div className="p-8 text-center">
                      <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No map data available</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {statsByMap.map(({ map, modeName, ...stats }) => (
                        <div key={map.id} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium">{map.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">{modeName}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {getWinRateIcon(stats.winRate)}
                              <span className={`font-bold ${getWinRateColor(stats.winRate)}`}>
                                {stats.winRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <Progress value={stats.winRate} className="h-1.5 mb-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{stats.total} games</span>
                            <span>{stats.wins}W - {stats.losses}L - {stats.draws}D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
