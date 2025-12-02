import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  Map as MapIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Swords,
} from "lucide-react";
import type { Event, Game, GameMode, Map as MapType } from "@shared/schema";

interface StatsSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

interface OpponentData {
  name: string;
  eventStats: StatsSummary;
  gameStats: StatsSummary;
  bestModes: { mode: GameMode; winRate: number; total: number }[];
  worstMaps: { map: MapType; modeName: string; winRate: number; total: number }[];
  lastPlayed?: string;
}

export default function OpponentStats() {
  const { data: events = [], isLoading } = useQuery<Event[]>({
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

  const opponentData = useMemo<OpponentData[]>(() => {
    const opponentMap = new Map<string, Event[]>();

    events.forEach(event => {
      if (event.opponentName && event.opponentName.trim()) {
        const name = event.opponentName.trim().toLowerCase();
        if (!opponentMap.has(name)) {
          opponentMap.set(name, []);
        }
        opponentMap.get(name)!.push(event);
      }
    });

    const result: OpponentData[] = [];

    opponentMap.forEach((opponentEvents, nameLower) => {
      const displayName = opponentEvents[0].opponentName!;
      const eventIds = new Set(opponentEvents.map(e => e.id));
      const opponentGames = allGames.filter(g => eventIds.has(g.eventId || ""));

      const eventStats = calculateStats(opponentEvents.filter(e => e.result));
      const gameStats = calculateStats(opponentGames.filter(g => g.result));

      const modePerformance = gameModes.map(mode => {
        const modeGames = opponentGames.filter(g => g.gameModeId === mode.id && g.result);
        const stats = calculateStats(modeGames);
        return { mode, winRate: stats.winRate, total: stats.total };
      }).filter(m => m.total > 0);

      const mapPerformance = maps.map(map => {
        const mapGames = opponentGames.filter(g => g.mapId === map.id && g.result);
        const stats = calculateStats(mapGames);
        const mode = gameModes.find(m => m.id === map.gameModeId);
        return { map, modeName: mode?.name || "Unknown", winRate: stats.winRate, total: stats.total };
      }).filter(m => m.total > 0);

      const sortedByDate = [...opponentEvents].sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      result.push({
        name: displayName,
        eventStats,
        gameStats,
        bestModes: modePerformance.sort((a, b) => b.winRate - a.winRate).slice(0, 3),
        worstMaps: mapPerformance.sort((a, b) => a.winRate - b.winRate).slice(0, 3),
        lastPlayed: sortedByDate[0]?.date,
      });
    });

    return result.sort((a, b) => b.eventStats.total - a.eventStats.total);
  }, [events, allGames, gameModes, maps]);

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

  const getWinRateBadge = (rate: number) => {
    if (rate >= 60) return <Badge className="bg-emerald-500">Strong</Badge>;
    if (rate >= 40) return <Badge variant="secondary">Even</Badge>;
    return <Badge variant="destructive">Weak</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading opponent data...</p>
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
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Stats by Opponent</h1>
              </div>
              <p className="text-muted-foreground">Performance analysis against each team</p>
            </div>
          </div>
        </div>

        {opponentData.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-semibold mb-2">No Opponents Found</h3>
              <p className="text-muted-foreground">
                Add opponent names to your events to see performance analytics.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {opponentData.map((opponent) => (
              <Card key={opponent.name}>
                <CardHeader className="pb-4 border-b">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Swords className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{opponent.name}</CardTitle>
                        <CardDescription>
                          {opponent.eventStats.total} match{opponent.eventStats.total !== 1 ? "es" : ""} played
                          {opponent.lastPlayed && ` • Last: ${new Date(opponent.lastPlayed).toLocaleDateString()}`}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getWinRateBadge(opponent.eventStats.winRate)}
                      {getWinRateIcon(opponent.eventStats.winRate)}
                      <span className={`text-2xl font-bold ${getWinRateColor(opponent.eventStats.winRate)}`}>
                        {opponent.eventStats.winRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        Event Results
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-500">Wins</span>
                          <span className="font-medium">{opponent.eventStats.wins}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-500">Losses</span>
                          <span className="font-medium">{opponent.eventStats.losses}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-500">Draws</span>
                          <span className="font-medium">{opponent.eventStats.draws}</span>
                        </div>
                        <Progress value={opponent.eventStats.winRate} className="h-2 mt-2" />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4 text-primary" />
                        Game Results
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-500">Wins</span>
                          <span className="font-medium">{opponent.gameStats.wins}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-500">Losses</span>
                          <span className="font-medium">{opponent.gameStats.losses}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-500">Draws</span>
                          <span className="font-medium">{opponent.gameStats.draws}</span>
                        </div>
                        <Progress value={opponent.gameStats.winRate} className="h-2 mt-2" />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Best Modes vs {opponent.name}
                      </h4>
                      {opponent.bestModes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No mode data</p>
                      ) : (
                        <div className="space-y-2">
                          {opponent.bestModes.map(m => (
                            <div key={m.mode.id} className="flex justify-between text-sm">
                              <span>{m.mode.name}</span>
                              <span className={getWinRateColor(m.winRate)}>
                                {m.winRate.toFixed(0)}% ({m.total}g)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Worst Maps vs {opponent.name}
                      </h4>
                      {opponent.worstMaps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No map data</p>
                      ) : (
                        <div className="space-y-2">
                          {opponent.worstMaps.map(m => (
                            <div key={m.map.id} className="flex justify-between text-sm">
                              <span>{m.map.name}</span>
                              <span className={getWinRateColor(m.winRate)}>
                                {m.winRate.toFixed(0)}% ({m.total}g)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
