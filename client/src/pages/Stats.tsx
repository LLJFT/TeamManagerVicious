import { useState } from "react";
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
  Target,
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

export default function Stats() {
  const [activeTab, setActiveTab] = useState("overall");

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/all-games-stats"],
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

  const calculateStatsByEventType = () => {
    const types = ["tournament", "scrim", "vod_review"];
    return types.map(type => {
      const typeEvents = events.filter(e => e.eventType === type && e.result);
      const stats = calculateStats(typeEvents);
      return { type, ...stats };
    });
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
    if (rate >= 60) return "text-green-400";
    if (rate >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getWinRateIcon = (rate: number) => {
    if (rate >= 50) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (rate > 30) return <Minus className="h-4 w-4 text-yellow-400" />;
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  };

  const StatCard = ({ title, icon, stats }: { title: string; icon: React.ReactNode; stats: StatsSummary }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
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
            <span className="text-green-400">{stats.wins}W</span>
            <span className="text-red-400">{stats.losses}L</span>
            <span className="text-yellow-400">{stats.draws}D</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (eventsLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground">Loading stats...</div>
      </div>
    );
  }

  const overallEventStats = calculateEventStats();
  const overallGameStats = calculateGameStats();
  const statsByEventType = calculateStatsByEventType();
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
              <h1 className="text-3xl font-bold text-foreground">Team Statistics</h1>
              <p className="text-muted-foreground">Performance analytics and win rates</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="overall" data-testid="tab-overall">Overall</TabsTrigger>
            <TabsTrigger value="event-type" data-testid="tab-event-type">By Type</TabsTrigger>
            <TabsTrigger value="mode" data-testid="tab-mode">By Mode</TabsTrigger>
            <TabsTrigger value="map" data-testid="tab-map">By Map</TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                title="Event Results"
                icon={<Trophy className="h-5 w-5 text-yellow-400" />}
                stats={overallEventStats}
              />
              <StatCard
                title="Game Results"
                icon={<Gamepad2 className="h-5 w-5 text-blue-400" />}
                stats={overallGameStats}
              />
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
                    <div className="text-3xl font-bold text-green-400">{overallEventStats.wins}</div>
                    <div className="text-sm text-muted-foreground">Event Wins</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-green-400">{overallGameStats.wins}</div>
                    <div className="text-sm text-muted-foreground">Game Wins</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="event-type" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {statsByEventType.map(({ type, ...stats }) => (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base capitalize">
                      <Target className="h-5 w-5 text-primary" />
                      {type.replace("_", " ")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.total === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No data available
                      </div>
                    ) : (
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
                          <span className="text-green-400">{stats.wins}W</span>
                          <span className="text-red-400">{stats.losses}L</span>
                          <span className="text-yellow-400">{stats.draws}D</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mode" className="space-y-6">
            {statsByGameMode.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gamepad2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No game mode statistics available yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add game modes and record games to see stats here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statsByGameMode.map(({ mode, ...stats }) => (
                  <Card key={mode.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Gamepad2 className="h-5 w-5 text-blue-400" />
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
                          <span className="text-green-400">{stats.wins}W</span>
                          <span className="text-red-400">{stats.losses}L</span>
                          <span className="text-yellow-400">{stats.draws}D</span>
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
                  <p className="text-sm text-muted-foreground mt-1">
                    Add maps and record games to see stats here.
                  </p>
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
                            <MapIcon className="h-4 w-4 text-purple-400" />
                            <span className="font-semibold">{map.name}</span>
                            <Badge variant="outline" className="text-xs">{modeName}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{stats.total} games</span>
                            <span className="text-green-400">{stats.wins}W</span>
                            <span className="text-red-400">{stats.losses}L</span>
                            <span className="text-yellow-400">{stats.draws}D</span>
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
