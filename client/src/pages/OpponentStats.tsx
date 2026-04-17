import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Swords,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import type { Event, Game, GameMode, Map as MapType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { OpponentsSkeleton } from "@/components/PageSkeleton";

interface StatsSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

interface EventDetail {
  eventId: string;
  title: string;
  date: string;
  result: string;
  score: string;
}

interface OpponentData {
  name: string;
  eventStats: StatsSummary;
  gameStats: StatsSummary;
  bestModes: { mode: GameMode; winRate: number; total: number }[];
  worstMaps: { map: MapType; modeName: string; winRate: number; total: number }[];
  lastPlayed?: string;
  eventDetails: EventDetail[];
}

type SortOption = "matches" | "winRate" | "name" | "lastPlayed";

export default function OpponentStats() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("matches");
  const [expandedOpponents, setExpandedOpponents] = useState<Set<string>>(new Set());

  const toggleExpanded = (name: string) => {
    setExpandedOpponents(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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

      const eventDetails: EventDetail[] = sortedByDate.map(e => {
        const eGames = opponentGames.filter(g => g.eventId === e.id);
        const gWins = eGames.filter(g => g.result === "win").length;
        const gLosses = eGames.filter(g => g.result === "loss").length;
        return {
          eventId: e.id,
          title: e.title || "Untitled Event",
          date: e.date || "",
          result: e.result || "pending",
          score: eGames.length > 0 ? `${gWins}-${gLosses}` : "",
        };
      });

      result.push({
        name: displayName,
        eventStats,
        gameStats,
        bestModes: modePerformance.sort((a, b) => b.winRate - a.winRate).slice(0, 3),
        worstMaps: mapPerformance.sort((a, b) => a.winRate - b.winRate).slice(0, 3),
        lastPlayed: sortedByDate[0]?.date,
        eventDetails,
      });
    });

    return result;
  }, [events, allGames, gameModes, maps]);

  const filteredAndSorted = useMemo(() => {
    let filtered = opponentData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o => o.name.toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "winRate": return b.eventStats.winRate - a.eventStats.winRate;
        case "name": return a.name.localeCompare(b.name);
        case "lastPlayed": {
          const aDate = a.lastPlayed ? new Date(a.lastPlayed).getTime() : 0;
          const bDate = b.lastPlayed ? new Date(b.lastPlayed).getTime() : 0;
          return bDate - aDate;
        }
        default: return b.eventStats.total - a.eventStats.total;
      }
    });
  }, [opponentData, searchQuery, sortBy]);

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

  if (!hasPermission("view_opponents")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return <OpponentsSkeleton />;
  }

  return (
    <ScrollArea className="h-full">
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
              <p className="text-muted-foreground">Performance analysis against each team ({opponentData.length} opponents)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search opponents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-opponents"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]" data-testid="select-sort-opponents">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="matches">Most Matches</SelectItem>
              <SelectItem value="winRate">Win Rate</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="lastPlayed">Last Played</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredAndSorted.length === 0 ? (
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
            {filteredAndSorted.map((opponent) => (
              <Card key={opponent.name}>
                <CardHeader className="pb-4 border-b">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-1 rounded cursor-pointer hover-elevate"
                        onClick={() => toggleExpanded(opponent.name)}
                        data-testid={`button-expand-${opponent.name}`}
                      >
                        {expandedOpponents.has(opponent.name) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
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
                {expandedOpponents.has(opponent.name) && (
                  <div className="border-t border-border">
                    <div className="p-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        Event History vs {opponent.name}
                      </h4>
                      {opponent.eventDetails.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No events recorded</p>
                      ) : (
                        <div className="space-y-2">
                          {opponent.eventDetails.map(ed => {
                            const resultColors: Record<string, string> = {
                              win: "text-emerald-500",
                              loss: "text-red-500",
                              draw: "text-amber-500",
                            };
                            const resultLabels: Record<string, string> = {
                              win: "W",
                              loss: "L",
                              draw: "D",
                            };
                            return (
                              <div key={ed.eventId} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border text-sm" data-testid={`event-detail-${ed.eventId}`}>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <Badge
                                    variant={ed.result === "win" ? "default" : "secondary"}
                                    className={`shrink-0 ${ed.result === "win" ? "" : ed.result === "loss" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}
                                  >
                                    {resultLabels[ed.result] || "?"}
                                  </Badge>
                                  <span className="truncate font-medium">{ed.title}</span>
                                  {ed.score && <span className="text-muted-foreground shrink-0">{ed.score}</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-muted-foreground">
                                    {ed.date ? new Date(ed.date).toLocaleDateString() : ""}
                                  </span>
                                  <Link href={`/${fullSlug}/events/${ed.eventId}`}>
                                    <Button variant="ghost" size="icon" data-testid={`link-event-${ed.eventId}`}>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
