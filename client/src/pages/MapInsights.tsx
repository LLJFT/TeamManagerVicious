import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, Map as MapIcon, Trophy, TrendingUp, TrendingDown,
  Shield, Crosshair, ExternalLink, ChevronRight, Award, Target,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import {
  AnalyticsFilterBar, useAnalyticsFilters, applyAnalyticsFilters,
} from "@/components/analytics-filters";
import type {
  Event, Game, Map as MapType, Opponent, Side, GameRound,
} from "@shared/schema";

interface MatchRef {
  matchId: string;
  eventId: string;
  date: string;
  opponentName: string;
  result: string | null;
  gameCode: string;
}

interface MapStat {
  map: MapType;
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  matches: MatchRef[];
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return (n / d) * 100;
}

function wrColor(wr: number) {
  return wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
         wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
         "bg-red-500/15 text-red-700 dark:text-red-300";
}

function MatchDrillPopover({ refs, fullSlug, label }: { refs: MatchRef[]; fullSlug: string | null; label: string }) {
  if (refs.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" data-testid={`button-drill-map-${label}`}>
          <ExternalLink className="h-3 w-3" />
          {refs.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-2 border-b text-xs font-semibold">Matches: {label}</div>
        <ScrollArea className="max-h-72">
          <div className="p-1 space-y-1">
            {refs.map((m, i) => {
              const resColor = m.result === "win" ? "text-emerald-500" :
                m.result === "loss" ? "text-red-500" :
                m.result === "draw" ? "text-amber-500" : "text-muted-foreground";
              const resLabel = m.result === "win" ? "W" : m.result === "loss" ? "L" : m.result === "draw" ? "D" : "—";
              return (
                <Link
                  key={`${m.matchId}-${i}`}
                  href={fullSlug ? `/${fullSlug}/events/${m.eventId}` : "#"}
                  data-testid={`link-drill-event-${m.eventId}`}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover-elevate cursor-pointer">
                    <Badge variant="outline" className={`shrink-0 w-6 justify-center ${resColor}`}>{resLabel}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.opponentName || "Unknown opponent"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.date ? new Date(m.date).toLocaleDateString() : ""} · Map {m.gameCode}
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function MapInsights() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [opponentFilter, setOpponentFilter] = useState<string>("__all__");
  const { filters, setFilters } = useAnalyticsFilters();

  const { data: events = [], isLoading: evLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: allGames = [], isLoading: gLoading } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: sides = [] } = useQuery<Side[]>({
    queryKey: ["/api/sides", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: gameRounds = [], isLoading: rLoading } = useQuery<GameRound[]>({
    queryKey: ["/api/game-rounds", { gameId, rosterId }],
    enabled: rosterReady && hasPermission("view_statistics"),
  });

  const isLoading = evLoading || gLoading || rLoading;

  const eventById = useMemo(() => {
    const m = new Map<string, Event>();
    events.forEach(e => m.set(e.id, e));
    return m;
  }, [events]);

  const mapById = useMemo(() => {
    const m = new Map<string, MapType>();
    maps.forEach(x => m.set(x.id, x));
    return m;
  }, [maps]);

  const sideById = useMemo(() => {
    const m = new Map<string, Side>();
    sides.forEach(s => m.set(s.id, s));
    return m;
  }, [sides]);

  const allowedEventIds = useMemo(
    () => applyAnalyticsFilters(events, filters),
    [events, filters],
  );
  const scopedGames = useMemo(() => {
    return allGames.filter(g =>
      (opponentFilter === "__all__" || g.opponentId === opponentFilter) &&
      g.eventId && allowedEventIds.has(g.eventId),
    );
  }, [allGames, opponentFilter, allowedEventIds]);

  const matchRefById = useMemo(() => {
    const m = new Map<string, MatchRef>();
    scopedGames.forEach(g => {
      const ev = g.eventId ? eventById.get(g.eventId) : null;
      const opp = g.opponentId ? opponents.find(o => o.id === g.opponentId) : null;
      m.set(g.id, {
        matchId: g.id,
        eventId: g.eventId || "",
        date: ev?.date || "",
        opponentName: opp?.name || ev?.opponentName || "Unknown",
        result: g.result || null,
        gameCode: g.gameCode || "",
      });
    });
    return m;
  }, [scopedGames, eventById, opponents]);

  // Per-map W/L/D from games
  const mapStats = useMemo<MapStat[]>(() => {
    const grouped = new Map<string, MapStat>();
    scopedGames.forEach(g => {
      if (!g.mapId) return;
      const map = mapById.get(g.mapId);
      if (!map) return;
      if (!grouped.has(g.mapId)) {
        grouped.set(g.mapId, { map, total: 0, wins: 0, losses: 0, draws: 0, winRate: 0, matches: [] });
      }
      const e = grouped.get(g.mapId)!;
      e.total++;
      if (g.result === "win") e.wins++;
      else if (g.result === "loss") e.losses++;
      else if (g.result === "draw") e.draws++;
      const ref = matchRefById.get(g.id);
      if (ref) e.matches.push(ref);
    });
    const out = Array.from(grouped.values());
    out.forEach(m => { m.winRate = pct(m.wins, m.total); });
    out.sort((a, b) => b.total - a.total);
    return out;
  }, [scopedGames, mapById, matchRefById]);

  // Best/Worst (min 3 games to qualify)
  const minGames = 3;
  const qualifying = useMemo(() => mapStats.filter(m => m.total >= minGames), [mapStats]);
  const bestMap = useMemo(() => {
    if (qualifying.length === 0) return null;
    return [...qualifying].sort((a, b) => b.winRate - a.winRate || b.total - a.total)[0];
  }, [qualifying]);
  const worstMap = useMemo(() => {
    if (qualifying.length === 0) return null;
    return [...qualifying].sort((a, b) => a.winRate - b.winRate || b.total - a.total)[0];
  }, [qualifying]);

  // Side WR per map (from gameRounds)
  const scopedMatchIds = useMemo(() => new Set(scopedGames.map(g => g.id)), [scopedGames]);
  const matchToMapId = useMemo(() => {
    const m = new Map<string, string>();
    scopedGames.forEach(g => { if (g.mapId) m.set(g.id, g.mapId); });
    return m;
  }, [scopedGames]);

  interface SideMapCell {
    rounds: number;
    roundWins: number;
    matches: Set<string>;
    matchWins: Map<string, { w: number; l: number; d: number }>;
  }
  const sideMapMatrix = useMemo(() => {
    // Map -> Side -> SideMapCell
    const matrix = new Map<string, Map<string, SideMapCell>>();
    gameRounds.forEach(r => {
      if (!scopedMatchIds.has(r.matchId)) return;
      const mapId = matchToMapId.get(r.matchId);
      if (!mapId || !r.sideId) return;
      if (!matrix.has(mapId)) matrix.set(mapId, new Map());
      const sideMap = matrix.get(mapId)!;
      if (!sideMap.has(r.sideId)) sideMap.set(r.sideId, { rounds: 0, roundWins: 0, matches: new Set(), matchWins: new Map() });
      const cell = sideMap.get(r.sideId)!;
      cell.rounds++;
      if ((r.teamScore ?? 0) > (r.opponentScore ?? 0)) cell.roundWins++;
      cell.matches.add(r.matchId);
    });
    return matrix;
  }, [gameRounds, scopedMatchIds, matchToMapId]);

  // Trend over time: month -> map -> { games, wins }
  const monthlyMapTrend = useMemo(() => {
    const months = new Set<string>();
    const mapMonth = new Map<string, Map<string, { total: number; wins: number }>>();
    scopedGames.forEach(g => {
      if (!g.mapId || !g.eventId) return;
      const ev = eventById.get(g.eventId);
      if (!ev?.date) return;
      const month = ev.date.slice(0, 7);
      months.add(month);
      if (!mapMonth.has(g.mapId)) mapMonth.set(g.mapId, new Map());
      const mm = mapMonth.get(g.mapId)!;
      if (!mm.has(month)) mm.set(month, { total: 0, wins: 0 });
      const cell = mm.get(month)!;
      cell.total++;
      if (g.result === "win") cell.wins++;
    });
    const sortedMonths = Array.from(months).sort();
    return { months: sortedMonths, mapMonth };
  }, [scopedGames, eventById]);

  // vs Opponent matrix (only when "all" so it's meaningful)
  const opponentMapMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, { total: number; wins: number }>>();
    allGames.forEach(g => {
      if (!g.mapId || !g.opponentId) return;
      if (!matrix.has(g.mapId)) matrix.set(g.mapId, new Map());
      const om = matrix.get(g.mapId)!;
      if (!om.has(g.opponentId)) om.set(g.opponentId, { total: 0, wins: 0 });
      const cell = om.get(g.opponentId)!;
      cell.total++;
      if (g.result === "win") cell.wins++;
    });
    return matrix;
  }, [allGames]);

  const sortedOpponents = useMemo(
    () => [...opponents].sort((a, b) => a.name.localeCompare(b.name)),
    [opponents]
  );

  // ===== Hooks above this line — early returns below =====
  if (!hasPermission("view_statistics")) {
    return <AccessDenied />;
  }
  if (isLoading || !rosterReady) {
    return <StatsSkeleton />;
  }

  return (
    <ScrollArea className="h-screen">
      <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={fullSlug ? `/${fullSlug}/stats` : "/"}>
              <Button variant="ghost" size="icon" data-testid="button-back-stats">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapIcon className="h-6 w-6 text-primary" /> Map Insights
              </h1>
              <p className="text-sm text-muted-foreground">
                Best/worst maps, side win rate, monthly trend, and per-opponent matrix
              </p>
            </div>
          </div>
          <Select value={opponentFilter} onValueChange={setOpponentFilter}>
            <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-opponent-filter-map">
              <SelectValue placeholder="All opponents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All opponents</SelectItem>
              {sortedOpponents.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AnalyticsFilterBar
          filters={filters}
          setFilters={setFilters}
          matchesCount={scopedGames.length}
          totalCount={allGames.length}
        />

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
            <TabsTrigger value="overview" data-testid="tab-map-overview">Overview</TabsTrigger>
            <TabsTrigger value="side" data-testid="tab-map-side">Side WR</TabsTrigger>
            <TabsTrigger value="trend" data-testid="tab-map-trend">Trend</TabsTrigger>
            <TabsTrigger value="opponents" data-testid="tab-map-opponents">vs Opponent</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-best-map">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-500" /> Best Map
                  </CardTitle>
                  <CardDescription>Highest win rate (min {minGames} games)</CardDescription>
                </CardHeader>
                <CardContent>
                  {bestMap ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xl font-bold truncate">{bestMap.map.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {bestMap.wins}W · {bestMap.losses}L · {bestMap.draws}D in {bestMap.total} games
                        </div>
                      </div>
                      <Badge className={`text-base px-3 py-1 tabular-nums ${wrColor(bestMap.winRate)}`} variant="outline">
                        {bestMap.winRate.toFixed(0)}% WR
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not enough data yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-worst-map">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" /> Worst Map
                  </CardTitle>
                  <CardDescription>Lowest win rate (min {minGames} games)</CardDescription>
                </CardHeader>
                <CardContent>
                  {worstMap ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xl font-bold truncate">{worstMap.map.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {worstMap.wins}W · {worstMap.losses}L · {worstMap.draws}D in {worstMap.total} games
                        </div>
                      </div>
                      <Badge className={`text-base px-3 py-1 tabular-nums ${wrColor(worstMap.winRate)}`} variant="outline">
                        {worstMap.winRate.toFixed(0)}% WR
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not enough data yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" /> All Maps Ranked
                </CardTitle>
                <CardDescription>By games played, with win rate</CardDescription>
              </CardHeader>
              <CardContent>
                {mapStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-1 py-2">No map games recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {mapStats.map((m, i) => (
                      <div
                        key={m.map.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                        data-testid={`row-map-rank-${i}`}
                      >
                        <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                        <div className="flex-1 min-w-0 text-sm font-medium truncate">{m.map.name}</div>
                        <Badge variant="secondary" className="text-xs tabular-nums">{m.total} games</Badge>
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {m.wins}-{m.losses}-{m.draws}
                        </Badge>
                        <Badge className={`text-xs tabular-nums ${wrColor(m.winRate)}`} variant="outline">
                          {m.winRate.toFixed(0)}%
                        </Badge>
                        <MatchDrillPopover refs={m.matches} fullSlug={fullSlug} label={m.map.name} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="side" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Round Win Rate by Side per Map
                </CardTitle>
                <CardDescription>
                  Aggregated from per-round side &amp; score data. A round is a "win" when team score &gt; opponent score.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sideMapMatrix.size === 0 || sides.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No round-level side data recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Map</th>
                          {sides.map(s => (
                            <th key={s.id} className="text-center p-2 font-medium">{s.name}</th>
                          ))}
                          <th className="text-right p-2 font-medium">Total Rounds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(sideMapMatrix.entries()).map(([mapId, sideMap]) => {
                          const map = mapById.get(mapId);
                          if (!map) return null;
                          const totalRounds = Array.from(sideMap.values()).reduce((a, c) => a + c.rounds, 0);
                          return (
                            <tr key={mapId} className="border-b hover-elevate" data-testid={`row-side-map-${mapId}`}>
                              <td className="p-2 font-medium truncate max-w-[180px]">{map.name}</td>
                              {sides.map(s => {
                                const cell = sideMap.get(s.id);
                                if (!cell || cell.rounds === 0) {
                                  return <td key={s.id} className="text-center p-2 text-muted-foreground">—</td>;
                                }
                                const wr = pct(cell.roundWins, cell.rounds);
                                return (
                                  <td key={s.id} className="text-center p-2">
                                    <Badge className={`text-xs tabular-nums ${wrColor(wr)}`} variant="outline">
                                      {wr.toFixed(0)}% ({cell.roundWins}/{cell.rounds})
                                    </Badge>
                                  </td>
                                );
                              })}
                              <td className="text-right p-2 tabular-nums text-muted-foreground">{totalRounds}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Map Performance Over Time
                </CardTitle>
                <CardDescription>
                  Win rate per map per month — empty cells mean the map wasn't played that month
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyMapTrend.months.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No monthly data yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium sticky left-0 bg-card z-10">Map</th>
                          {monthlyMapTrend.months.map(m => (
                            <th key={m} className="text-center p-2 font-medium tabular-nums whitespace-nowrap">{m}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(monthlyMapTrend.mapMonth.entries()).map(([mapId, monthData]) => {
                          const map = mapById.get(mapId);
                          if (!map) return null;
                          return (
                            <tr key={mapId} className="border-b" data-testid={`row-trend-map-${mapId}`}>
                              <td className="p-2 font-medium truncate max-w-[160px] sticky left-0 bg-card">{map.name}</td>
                              {monthlyMapTrend.months.map(month => {
                                const cell = monthData.get(month);
                                if (!cell) return <td key={month} className="text-center p-2 text-muted-foreground">—</td>;
                                const wr = pct(cell.wins, cell.total);
                                return (
                                  <td key={month} className="text-center p-2">
                                    <Badge className={`text-[10px] tabular-nums ${wrColor(wr)}`} variant="outline">
                                      {wr.toFixed(0)}% ({cell.total})
                                    </Badge>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opponents" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-primary" /> Map vs Opponent Win Rate
                </CardTitle>
                <CardDescription>
                  Each cell shows our win rate &amp; games on that map against that opponent. Uses ALL games regardless of the opponent filter.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {opponentMapMatrix.size === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No opponent-tagged map data yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium sticky left-0 bg-card z-10">Map</th>
                          {sortedOpponents.map(o => (
                            <th key={o.id} className="text-center p-2 font-medium whitespace-nowrap max-w-[120px] truncate">
                              {o.shortName || o.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(opponentMapMatrix.entries()).map(([mapId, oppMap]) => {
                          const map = mapById.get(mapId);
                          if (!map) return null;
                          return (
                            <tr key={mapId} className="border-b" data-testid={`row-opp-matrix-map-${mapId}`}>
                              <td className="p-2 font-medium truncate max-w-[160px] sticky left-0 bg-card">{map.name}</td>
                              {sortedOpponents.map(o => {
                                const cell = oppMap.get(o.id);
                                if (!cell) return <td key={o.id} className="text-center p-2 text-muted-foreground">—</td>;
                                const wr = pct(cell.wins, cell.total);
                                return (
                                  <td key={o.id} className="text-center p-2">
                                    <Badge className={`text-[10px] tabular-nums ${wrColor(wr)}`} variant="outline">
                                      {wr.toFixed(0)}% ({cell.total})
                                    </Badge>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
