import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import type { Event, Game, GameMode, Map as MapType, Season } from "@shared/schema";
import { useGame } from "@/hooks/use-game";
import { StatsSkeleton } from "@/components/PageSkeleton";

interface StatsSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export default function SeasonStats() {
  const { gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");

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

  const filteredEvents = selectedSeasonId
    ? events.filter(e => e.seasonId === selectedSeasonId)
    : [];

  const filteredEventIds = new Set(filteredEvents.map(e => e.id));
  const filteredGames = allGames.filter(g => filteredEventIds.has(g.eventId || ""));

  const calculateStats = (items: { result?: string | null }[]): StatsSummary => {
    const total = items.length;
    const wins = items.filter(i => i.result === "win").length;
    const losses = items.filter(i => i.result === "loss").length;
    const draws = items.filter(i => i.result === "draw").length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, draws, winRate };
  };

  const quickStats = {
    totalEvents: filteredEvents.length,
    totalGames: filteredGames.length,
    eventWins: filteredEvents.filter(e => e.result === "win").length,
    gameWins: filteredGames.filter(g => g.result === "win").length,
    scrims: filteredEvents.filter(e => e.eventType?.toLowerCase() === "scrim").length,
    tournaments: filteredEvents.filter(e => e.eventType?.toLowerCase() === "tournament").length,
  };

  const calculateEventStats = (): StatsSummary => {
    return calculateStats(filteredEvents.filter(e => e.result));
  };

  const calculateGameStats = (): StatsSummary => {
    return calculateStats(filteredGames.filter(g => g.result));
  };

  const calculateStatsByGameMode = () => {
    return gameModes.map(mode => {
      const modeGames = filteredGames.filter(g => g.gameModeId === mode.id && g.result);
      const stats = calculateStats(modeGames);
      return { mode, ...stats };
    }).filter(s => s.total > 0);
  };

  const calculateStatsByMap = () => {
    return maps.map(map => {
      const mapGames = filteredGames.filter(g => g.mapId === map.id && g.result);
      const stats = calculateStats(mapGames);
      const mode = gameModes.find(m => m.id === map.gameModeId);
      return { map, modeName: mode?.name || "Unknown", ...stats };
    }).filter(s => s.total > 0);
  };

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

  if (eventsLoading) {
    return <StatsSkeleton />;
  }

  const overallEventStats = calculateEventStats();
  const overallGameStats = calculateGameStats();
  const statsByGameMode = calculateStatsByGameMode();
  const statsByMap = calculateStatsByMap();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-amber-500" />
                <h1 className="text-3xl font-bold text-foreground">Season Statistics</h1>
              </div>
              <p className="text-muted-foreground">Performance filtered by season</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/stats/overall">
              <Button variant="outline" className="gap-2" data-testid="link-overall-stats">
                <BarChart3 className="h-4 w-4" />
                Overall
              </Button>
            </Link>
            <Link href="/stats/monthly">
              <Button variant="outline" className="gap-2" data-testid="link-monthly-stats">
                <Calendar className="h-4 w-4" />
                Monthly
              </Button>
            </Link>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-500" />
              Select Season
            </CardTitle>
            <CardDescription>Choose a season to view its statistics</CardDescription>
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

        {!selectedSeasonId ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CalendarDays className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-semibold mb-2">Select a Season</h3>
              <p className="text-muted-foreground">
                Choose a season above to view its performance statistics
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {selectedSeason && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {selectedSeason.name}
                  </Badge>
                  {selectedSeason.description && (
                    <span className="text-muted-foreground text-sm">
                      {selectedSeason.description}
                    </span>
                  )}
                </h2>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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

            {filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-xl font-semibold mb-2">No Events in This Season</h3>
                  <p className="text-muted-foreground">
                    This season doesn't have any events assigned yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <Card>
                    <CardHeader className="pb-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Trophy className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>Event Performance</CardTitle>
                          <CardDescription>Win rate across season events</CardDescription>
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
                          <CardDescription>Win rate across season games</CardDescription>
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
          </>
        )}
      </div>
    </div>
  );
}
