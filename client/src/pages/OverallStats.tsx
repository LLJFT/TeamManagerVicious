import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  Map as MapIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from "lucide-react";
import type { Event, Game, GameMode, Map as MapType } from "@shared/schema";

interface StatsSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export default function OverallStats() {
  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: allGames = [] } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games"],
  });

  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes"],
  });

  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps"],
  });

  const calculateStats = (items: { result?: string | null }[]): StatsSummary => {
    const total = items.length;
    const wins = items.filter(i => i.result === "win").length;
    const losses = items.filter(i => i.result === "loss").length;
    const draws = items.filter(i => i.result === "draw").length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, draws, winRate };
  };

  const calculateEventStats = (): StatsSummary => {
    return calculateStats(events.filter(e => e.result));
  };

  const calculateGameStats = (): StatsSummary => {
    return calculateStats(allGames.filter(g => g.result));
  };

  const calculateStatsByGameMode = () => {
    return gameModes.map(mode => {
      const modeGames = allGames.filter(g => g.gameModeId === mode.id && g.result);
      const stats = calculateStats(modeGames);
      return { mode, ...stats };
    }).filter(s => s.total > 0);
  };

  const calculateStatsByMap = () => {
    return maps.map(map => {
      const mapGames = allGames.filter(g => g.mapId === map.id && g.result);
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
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground">Loading stats...</div>
      </div>
    );
  }

  const overallEventStats = calculateEventStats();
  const overallGameStats = calculateGameStats();
  const statsByGameMode = calculateStatsByGameMode();
  const statsByMap = calculateStatsByMap();

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
              <h1 className="text-3xl font-bold text-foreground">Overall Statistics</h1>
              <p className="text-muted-foreground">Combined performance across all events</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/stats/scrim">
              <Button variant="outline" data-testid="link-scrim-stats">Scrim Stats</Button>
            </Link>
            <Link href="/stats/tournament">
              <Button variant="outline" data-testid="link-tournament-stats">Tournament Stats</Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="overall" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="overall" data-testid="tab-overall">Overall</TabsTrigger>
            <TabsTrigger value="mode" data-testid="tab-mode">By Mode</TabsTrigger>
            <TabsTrigger value="map" data-testid="tab-map">By Map</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Event Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{overallEventStats.total}</span>
                      <div className="flex items-center gap-2">
                        {getWinRateIcon(overallEventStats.winRate)}
                        <span className={`font-semibold ${getWinRateColor(overallEventStats.winRate)}`}>
                          {overallEventStats.winRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={overallEventStats.winRate} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-500">{overallEventStats.wins}W</span>
                      <span className="text-red-500">{overallEventStats.losses}L</span>
                      <span className="text-amber-500">{overallEventStats.draws}D</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    Game Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{overallGameStats.total}</span>
                      <div className="flex items-center gap-2">
                        {getWinRateIcon(overallGameStats.winRate)}
                        <span className={`font-semibold ${getWinRateColor(overallGameStats.winRate)}`}>
                          {overallGameStats.winRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={overallGameStats.winRate} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-500">{overallGameStats.wins}W</span>
                      <span className="text-red-500">{overallGameStats.losses}L</span>
                      <span className="text-amber-500">{overallGameStats.draws}D</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Quick Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-foreground">{events.length}</div>
                    <div className="text-sm text-muted-foreground">Total Events</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-foreground">{allGames.length}</div>
                    <div className="text-sm text-muted-foreground">Total Games</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-emerald-500">{overallEventStats.wins}</div>
                    <div className="text-sm text-muted-foreground">Event Wins</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-emerald-500">{overallGameStats.wins}</div>
                    <div className="text-sm text-muted-foreground">Game Wins</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mode" className="space-y-6">
            {statsByGameMode.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gamepad2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No game mode statistics available yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statsByGameMode.map(({ mode, ...stats }) => (
                  <Card key={mode.id} className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Gamepad2 className="h-5 w-5 text-primary" />
                        {mode.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{stats.total}</span>
                          <div className="flex items-center gap-2">
                            {getWinRateIcon(stats.winRate)}
                            <span className={`font-semibold ${getWinRateColor(stats.winRate)}`}>
                              {stats.winRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <Progress value={stats.winRate} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-500">{stats.wins}W</span>
                          <span className="text-red-500">{stats.losses}L</span>
                          <span className="text-amber-500">{stats.draws}D</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            {statsByMap.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MapIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No map statistics available yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {statsByMap.map(({ map, modeName, ...stats }) => (
                  <Card key={map.id} className="hover-elevate">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <MapIcon className="h-4 w-4 text-secondary" />
                            <span className="font-semibold">{map.name}</span>
                            <Badge variant="outline" className="text-xs">{modeName}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{stats.total} games</span>
                            <span className="text-emerald-500">{stats.wins}W</span>
                            <span className="text-red-500">{stats.losses}L</span>
                            <span className="text-amber-500">{stats.draws}D</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {getWinRateIcon(stats.winRate)}
                            <span className={`text-xl font-bold ${getWinRateColor(stats.winRate)}`}>
                              {stats.winRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <Progress value={stats.winRate} className="h-1.5 mt-3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
