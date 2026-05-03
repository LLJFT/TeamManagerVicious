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
import {
  ArrowLeft, TrendingUp, Activity, Flame, Snowflake, Shield,
  ArrowUpDown, Trophy,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend,
} from "recharts";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import {
  AnalyticsFilterBar, useAnalyticsFilters, applyAnalyticsFilters,
} from "@/components/analytics-filters";
import type { Event, Game, Opponent, Side, GameRound } from "@shared/schema";

function pct(n: number, d: number) {
  if (!d) return 0;
  return (n / d) * 100;
}

function wrColor(wr: number) {
  return wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
         wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
         "bg-red-500/15 text-red-700 dark:text-red-300";
}

function parseScore(s: string | null | undefined): { us: number; them: number } | null {
  if (!s) return null;
  const m = s.match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/);
  if (!m) return null;
  return { us: parseInt(m[1], 10), them: parseInt(m[2], 10) };
}

export default function Trends() {
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
    const filtered = (opponentFilter === "__all__"
      ? allGames
      : allGames.filter(g => g.opponentId === opponentFilter)
    ).filter(g => g.eventId && allowedEventIds.has(g.eventId));
    // Sort by event date asc for chronological streak / chart logic
    return filtered
      .map(g => ({ g, ev: g.eventId ? eventById.get(g.eventId) : null }))
      .filter(x => x.ev?.date)
      .sort((a, b) => (a.ev!.date || "").localeCompare(b.ev!.date || ""));
  }, [allGames, opponentFilter, eventById, allowedEventIds]);

  // Monthly aggregation
  const monthlySeries = useMemo(() => {
    const monthMap = new Map<string, { month: string; total: number; wins: number; losses: number; draws: number }>();
    scopedGames.forEach(({ g, ev }) => {
      const month = (ev!.date || "").slice(0, 7);
      if (!month) return;
      if (!monthMap.has(month)) monthMap.set(month, { month, total: 0, wins: 0, losses: 0, draws: 0 });
      const cell = monthMap.get(month)!;
      cell.total++;
      if (g.result === "win") cell.wins++;
      else if (g.result === "loss") cell.losses++;
      else if (g.result === "draw") cell.draws++;
    });
    return Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(c => ({ ...c, winRate: pct(c.wins, c.total) }));
  }, [scopedGames]);

  // Per-event aggregation (one row per event)
  const eventResults = useMemo(() => {
    const grouped = new Map<string, { event: Event; results: string[] }>();
    scopedGames.forEach(({ g, ev }) => {
      if (!ev) return;
      if (!grouped.has(ev.id)) grouped.set(ev.id, { event: ev, results: [] });
      if (g.result) grouped.get(ev.id)!.results.push(g.result);
    });
    return Array.from(grouped.values())
      .map(({ event, results }) => {
        const w = results.filter(r => r === "win").length;
        const l = results.filter(r => r === "loss").length;
        const d = results.filter(r => r === "draw").length;
        let outcome: "win" | "loss" | "draw" | null = null;
        if (event.result === "win" || event.result === "loss" || event.result === "draw") outcome = event.result as any;
        else if (w > l) outcome = "win";
        else if (l > w) outcome = "loss";
        else if (w + l > 0) outcome = "draw";
        return { event, w, l, d, outcome };
      })
      .filter(e => e.outcome !== null)
      .sort((a, b) => (a.event.date || "").localeCompare(b.event.date || ""));
  }, [scopedGames]);

  // Streaks (event-level)
  const streaks = useMemo(() => {
    let currentSign: "win" | "loss" | null = null;
    let currentLen = 0;
    let longestW = 0;
    let longestL = 0;
    let runW = 0;
    let runL = 0;
    eventResults.forEach(({ outcome }) => {
      if (outcome === "win") {
        runW++; runL = 0;
        longestW = Math.max(longestW, runW);
      } else if (outcome === "loss") {
        runL++; runW = 0;
        longestL = Math.max(longestL, runL);
      } else {
        runW = 0; runL = 0;
      }
    });
    // Current streak: walk backward
    for (let i = eventResults.length - 1; i >= 0; i--) {
      const o = eventResults[i].outcome;
      if (o === "draw" || o === null) {
        if (currentSign === null) continue;
        break;
      }
      if (currentSign === null) {
        currentSign = o as "win" | "loss";
        currentLen = 1;
      } else if (currentSign === o) {
        currentLen++;
      } else {
        break;
      }
    }
    return { currentSign, currentLen, longestW, longestL };
  }, [eventResults]);

  // Avg score per match (parses "X-Y" format)
  const scoreStats = useMemo(() => {
    let totalUs = 0, totalThem = 0, count = 0;
    let bestDiff = -Infinity, worstDiff = Infinity;
    let bestMatch: { event: Event; score: string; diff: number } | null = null;
    let worstMatch: { event: Event; score: string; diff: number } | null = null;
    scopedGames.forEach(({ g, ev }) => {
      const parsed = parseScore(g.score);
      if (!parsed || !ev) return;
      totalUs += parsed.us;
      totalThem += parsed.them;
      count++;
      const diff = parsed.us - parsed.them;
      if (diff > bestDiff) { bestDiff = diff; bestMatch = { event: ev, score: g.score, diff }; }
      if (diff < worstDiff) { worstDiff = diff; worstMatch = { event: ev, score: g.score, diff }; }
    });
    return {
      avgUs: count > 0 ? totalUs / count : 0,
      avgThem: count > 0 ? totalThem / count : 0,
      avgDiff: count > 0 ? (totalUs - totalThem) / count : 0,
      count,
      bestMatch,
      worstMatch,
    };
  }, [scopedGames]);

  // By-Side overall stats from gameRounds
  const sideStats = useMemo(() => {
    const scopedMatchIds = new Set(scopedGames.map(x => x.g.id));
    const m = new Map<string, { side: Side; rounds: number; wins: number }>();
    gameRounds.forEach(r => {
      if (!scopedMatchIds.has(r.matchId)) return;
      if (!r.sideId) return;
      const side = sideById.get(r.sideId);
      if (!side) return;
      if (!m.has(r.sideId)) m.set(r.sideId, { side, rounds: 0, wins: 0 });
      const cell = m.get(r.sideId)!;
      cell.rounds++;
      if ((r.teamScore ?? 0) > (r.opponentScore ?? 0)) cell.wins++;
    });
    return Array.from(m.values())
      .sort((a, b) => b.rounds - a.rounds)
      .map(c => ({ ...c, wr: pct(c.wins, c.rounds) }));
  }, [gameRounds, scopedGames, sideById]);

  const sortedOpponents = useMemo(
    () => [...opponents].sort((a, b) => a.name.localeCompare(b.name)),
    [opponents]
  );

  const totalGames = scopedGames.length;
  const totalWins = scopedGames.filter(x => x.g.result === "win").length;
  const overallWR = pct(totalWins, totalGames);

  // ===== Hooks above this line =====
  if (!hasPermission("view_statistics")) {
    return <AccessDenied />;
  }
  if (isLoading || !rosterReady) {
    return <StatsSkeleton />;
  }

  const streakBadge = (() => {
    if (!streaks.currentSign || streaks.currentLen === 0) {
      return <Badge variant="outline" className="text-base px-3 py-1">No active streak</Badge>;
    }
    const isWin = streaks.currentSign === "win";
    return (
      <Badge
        className={`text-base px-3 py-1 tabular-nums ${
          isWin ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                  "bg-red-500/15 text-red-700 dark:text-red-300"
        }`}
        variant="outline"
      >
        {isWin ? <Flame className="h-4 w-4 mr-1 inline" /> : <Snowflake className="h-4 w-4 mr-1 inline" />}
        {streaks.currentLen}-event {isWin ? "win" : "loss"} streak
      </Badge>
    );
  })();

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
                <TrendingUp className="h-6 w-6 text-primary" /> Trends &amp; Streaks
              </h1>
              <p className="text-sm text-muted-foreground">
                Win rate over time, current/longest streaks, average score, and side stats
              </p>
            </div>
          </div>
          <Select value={opponentFilter} onValueChange={setOpponentFilter}>
            <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-opponent-filter-trends">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card data-testid="card-summary-games">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Games in scope</div>
              <div className="text-2xl font-bold tabular-nums">{totalGames}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-summary-wr">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Game win rate</div>
              <div className="text-2xl font-bold tabular-nums">{overallWR.toFixed(0)}%</div>
            </CardContent>
          </Card>
          <Card data-testid="card-summary-streak">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Current streak</div>
              <div className="mt-1">{streakBadge}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-summary-longest">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Longest W / L</div>
              <div className="text-2xl font-bold tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">{streaks.longestW}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-red-600 dark:text-red-400">{streaks.longestL}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overTime">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
            <TabsTrigger value="overTime" data-testid="tab-trends-time">WR Over Time</TabsTrigger>
            <TabsTrigger value="periods" data-testid="tab-trends-periods">Best/Worst Periods</TabsTrigger>
            <TabsTrigger value="score" data-testid="tab-trends-score">Avg Score</TabsTrigger>
            <TabsTrigger value="side" data-testid="tab-trends-side">By Side</TabsTrigger>
          </TabsList>

          <TabsContent value="overTime" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Monthly Win Rate
                </CardTitle>
                <CardDescription>Win rate per month with games played underneath</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlySeries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No monthly data yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="h-64 w-full" data-testid="chart-monthly-wr">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlySeries}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                          <RTooltip
                            contentStyle={{
                              fontSize: 12,
                              background: "hsl(var(--popover))",
                              borderColor: "hsl(var(--border))",
                              color: "hsl(var(--popover-foreground))",
                            }}
                            formatter={(v: any) => [`${(v as number).toFixed(0)}%`, "Win Rate"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="winRate"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-48 w-full" data-testid="chart-monthly-games">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySeries}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RTooltip
                            contentStyle={{
                              fontSize: 12,
                              background: "hsl(var(--popover))",
                              borderColor: "hsl(var(--border))",
                              color: "hsl(var(--popover-foreground))",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="wins" stackId="r" fill="#10b981" name="Wins" />
                          <Bar dataKey="losses" stackId="r" fill="#ef4444" name="Losses" />
                          <Bar dataKey="draws" stackId="r" fill="#f59e0b" name="Draws" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periods" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" /> Best &amp; Worst Months
                </CardTitle>
                <CardDescription>Sorted by win rate (min 2 games)</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlySeries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No monthly data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...monthlySeries]
                      .filter(m => m.total >= 2)
                      .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
                      .map((m, i) => (
                        <div
                          key={m.month}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-period-${m.month}`}
                        >
                          <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                          <div className="flex-1 min-w-0 text-sm font-medium">{m.month}</div>
                          <Badge variant="secondary" className="text-xs tabular-nums">{m.total} games</Badge>
                          <Badge variant="outline" className="text-xs tabular-nums">
                            {m.wins}-{m.losses}-{m.draws}
                          </Badge>
                          <Badge className={`text-xs tabular-nums ${wrColor(m.winRate)}`} variant="outline">
                            {m.winRate.toFixed(0)}%
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="score" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card data-testid="card-avg-us">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg points scored</div>
                  <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {scoreStats.avgUs.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-avg-them">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg points conceded</div>
                  <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {scoreStats.avgThem.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-avg-diff">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg margin</div>
                  <div className={`text-2xl font-bold tabular-nums ${
                    scoreStats.avgDiff > 0 ? "text-emerald-600 dark:text-emerald-400" :
                    scoreStats.avgDiff < 0 ? "text-red-600 dark:text-red-400" :
                    "text-muted-foreground"
                  }`}>
                    {scoreStats.avgDiff >= 0 ? "+" : ""}{scoreStats.avgDiff.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-primary" /> Score Extremes
                </CardTitle>
                <CardDescription>From {scoreStats.count} games with parseable scores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {scoreStats.bestMatch ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-card" data-testid="row-best-margin">
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" variant="outline">
                      Largest Win
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {(scoreStats.bestMatch as any).event.title || "Event"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {(scoreStats.bestMatch as any).event.date} · score {(scoreStats.bestMatch as any).score}
                      </div>
                    </div>
                    <Badge variant="outline" className="tabular-nums">
                      +{(scoreStats.bestMatch as any).diff}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No parseable scores yet.</p>
                )}
                {scoreStats.worstMatch && scoreStats.worstMatch !== scoreStats.bestMatch && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-card" data-testid="row-worst-margin">
                    <Badge className="bg-red-500/15 text-red-700 dark:text-red-300" variant="outline">
                      Largest Loss
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {(scoreStats.worstMatch as any).event.title || "Event"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {(scoreStats.worstMatch as any).event.date} · score {(scoreStats.worstMatch as any).score}
                      </div>
                    </div>
                    <Badge variant="outline" className="tabular-nums">
                      {(scoreStats.worstMatch as any).diff}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="side" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Round Win Rate by Side
                </CardTitle>
                <CardDescription>Aggregated across all maps in scope</CardDescription>
              </CardHeader>
              <CardContent>
                {sideStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No round-level side data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sideStats.map((s, i) => (
                      <div
                        key={s.side.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                        data-testid={`row-side-${s.side.id}`}
                      >
                        <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                        <div className="flex-1 min-w-0 text-sm font-medium truncate">{s.side.name}</div>
                        <Badge variant="secondary" className="text-xs tabular-nums">{s.rounds} rounds</Badge>
                        <Badge variant="outline" className="text-xs tabular-nums">{s.wins} wins</Badge>
                        <Badge className={`text-xs tabular-nums ${wrColor(s.wr)}`} variant="outline">
                          {s.wr.toFixed(0)}% WR
                        </Badge>
                      </div>
                    ))}
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
