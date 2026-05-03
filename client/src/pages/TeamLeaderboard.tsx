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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Crown, Trophy, Map as MapIcon, Target, ExternalLink,
  ChevronRight, CalendarDays, Layers, ArrowLeft, Users,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import {
  AnalyticsFilterBar, useAnalyticsFilters, applyAnalyticsFilters,
} from "@/components/analytics-filters";
import { StatsSkeleton } from "@/components/PageSkeleton";
import type {
  Event, Game, Map as MapType, GameMode, Opponent,
} from "@shared/schema";

interface MatchRef {
  matchId: string;
  eventId: string;
  date: string;
  opponentName: string;
  result: string | null;
  gameCode: string;
}

interface RankRow<T> {
  item: T;
  matches: MatchRef[];
  wins: number;
  losses: number;
  draws: number;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return (n / d) * 100;
}

function MatchDrillPopover({
  refs, fullSlug, label,
}: { refs: MatchRef[]; fullSlug: string | null; label: string }) {
  if (refs.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" data-testid={`button-drill-${label}`}>
          <ExternalLink className="h-3 w-3" />
          {refs.length} match{refs.length === 1 ? "" : "es"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain">
        <div className="p-2 border-b text-xs font-semibold sticky top-0 bg-popover z-10">Matches: {label}</div>
        <div className="p-1 space-y-1">
          {refs.map((m, i) => {
            const resColor =
              m.result === "win" ? "text-emerald-500" :
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
      </PopoverContent>
    </Popover>
  );
}

function RankList<T>({
  rows, max, renderItem, fullSlug, labelOf,
}: {
  rows: RankRow<T>[];
  max: number;
  renderItem: (item: T) => React.ReactNode;
  fullSlug: string | null;
  labelOf: (item: T) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-1 py-2">No data yet.</p>;
  }
  const top = rows.slice(0, max);
  return (
    <div className="space-y-1.5">
      {top.map((r, i) => {
        const total = r.wins + r.losses + r.draws;
        const wr = total > 0 ? pct(r.wins, total) : 0;
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
            data-testid={`rank-row-${i}`}
          >
            <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
            <div className="flex-1 min-w-0">{renderItem(r.item)}</div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs tabular-nums" data-testid={`badge-record-${i}`}>
                {r.wins}-{r.losses}{r.draws ? `-${r.draws}` : ""}
              </Badge>
              {total > 0 && (
                <Badge
                  className={`text-xs tabular-nums ${
                    wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                    wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                    "bg-red-500/15 text-red-700 dark:text-red-300"
                  }`}
                  variant="outline"
                  data-testid={`badge-winrate-${i}`}
                >
                  {wr.toFixed(0)}% WR
                </Badge>
              )}
              <MatchDrillPopover refs={r.matches} fullSlug={fullSlug} label={labelOf(r.item)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TeamLeaderboard() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [opponentFilter, setOpponentFilter] = useState<string>("__all__");
  const { filters, setFilters } = useAnalyticsFilters();

  const { data: events = [], isLoading: evLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: allGames = [], isLoading: gLoading } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: rosterReady,
  });

  // ===== All hooks (incl. useMemo) MUST run before any early return =====
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const mapById = useMemo(() => new Map(maps.map(m => [m.id, m])), [maps]);
  const modeById = useMemo(() => new Map(gameModes.map(m => [m.id, m])), [gameModes]);
  const opponentById = useMemo(() => new Map(opponents.map(o => [o.id, o])), [opponents]);

  const allowedEventIds = useMemo(
    () => applyAnalyticsFilters(events, filters),
    [events, filters],
  );

  const filteredGames = useMemo(() => allGames.filter(g => {
    if (opponentFilter !== "__all__" && g.opponentId !== opponentFilter) return false;
    if (!g.eventId || !allowedEventIds.has(g.eventId)) return false;
    return true;
  }), [allGames, opponentFilter, allowedEventIds]);

  const refOf = useMemo(() => (g: typeof allGames[number]): MatchRef => {
    const ev = eventById.get(g.eventId);
    return {
      matchId: g.id,
      eventId: g.eventId,
      date: ev?.date || "",
      opponentName: g.opponentId ? (opponentById.get(g.opponentId)?.name || ev?.opponentName || "Unknown") : (ev?.opponentName || "Unknown"),
      result: g.result || null,
      gameCode: g.gameCode || "",
    };
  }, [eventById, opponentById]);

  function buildAggregate<T>(getKey: (g: typeof allGames[number]) => string | null | undefined, lookup: (key: string) => T | undefined): RankRow<T>[] {
    const buckets = new Map<string, { item: T; matches: MatchRef[]; wins: number; losses: number; draws: number }>();
    for (const g of filteredGames) {
      const key = getKey(g);
      if (!key) continue;
      const item = lookup(key);
      if (!item) continue;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { item, matches: [], wins: 0, losses: 0, draws: 0 };
        buckets.set(key, bucket);
      }
      bucket.matches.push(refOf(g));
      if (g.result === "win") bucket.wins++;
      else if (g.result === "loss") bucket.losses++;
      else if (g.result === "draw") bucket.draws++;
    }
    return Array.from(buckets.values()).sort((a, b) => {
      const aTotal = a.wins + a.losses + a.draws;
      const bTotal = b.wins + b.losses + b.draws;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return b.wins - a.wins;
    });
  }

  const byOpponent = useMemo(() => buildAggregate(g => g.opponentId, k => opponentById.get(k)), [filteredGames, opponentById, refOf]);
  const byMap = useMemo(() => buildAggregate(g => g.mapId, k => mapById.get(k)), [filteredGames, mapById, refOf]);
  const byMode = useMemo(() => buildAggregate(g => g.gameModeId, k => modeById.get(k)), [filteredGames, modeById, refOf]);

  const byEventType = useMemo(() => {
    const buckets = new Map<string, { item: { name: string }; matches: MatchRef[]; wins: number; losses: number; draws: number }>();
    for (const g of filteredGames) {
      const ev = eventById.get(g.eventId);
      const key = ev?.eventType || "unknown";
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { item: { name: key }, matches: [], wins: 0, losses: 0, draws: 0 };
        buckets.set(key, bucket);
      }
      bucket.matches.push(refOf(g));
      if (g.result === "win") bucket.wins++;
      else if (g.result === "loss") bucket.losses++;
      else if (g.result === "draw") bucket.draws++;
    }
    return Array.from(buckets.values()).sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws));
  }, [filteredGames, eventById, refOf]);

  const byEventSubType = useMemo(() => {
    const buckets = new Map<string, { item: { name: string }; matches: MatchRef[]; wins: number; losses: number; draws: number }>();
    for (const g of filteredGames) {
      const ev = eventById.get(g.eventId);
      const sub = (ev?.eventSubType || "").trim();
      if (!sub) continue;
      const key = sub.toLowerCase();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { item: { name: sub }, matches: [], wins: 0, losses: 0, draws: 0 };
        buckets.set(key, bucket);
      }
      bucket.matches.push(refOf(g));
      if (g.result === "win") bucket.wins++;
      else if (g.result === "loss") bucket.losses++;
      else if (g.result === "draw") bucket.draws++;
    }
    return Array.from(buckets.values()).sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws));
  }, [filteredGames, eventById, refOf]);

  const overall = useMemo(() => {
    let wins = 0, losses = 0, draws = 0;
    for (const g of filteredGames) {
      if (g.result === "win") wins++;
      else if (g.result === "loss") losses++;
      else if (g.result === "draw") draws++;
    }
    const total = wins + losses + draws;
    return { wins, losses, draws, total, wr: total > 0 ? pct(wins, total) : 0 };
  }, [filteredGames]);

  // ===== Early returns AFTER all hooks =====
  if (!hasPermission("view_statistics")) {
    return <AccessDenied />;
  }
  if (!rosterReady) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Select a roster to view team analytics.</p>
      </div>
    );
  }
  if (evLoading || gLoading) {
    return <StatsSkeleton />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href={`/${fullSlug}`}>
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Team Leaderboard</h1>
              </div>
              <p className="text-muted-foreground">
                Roster-wide records ranked by opponent, map, mode, and event type.
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Opponent:</span>
              <Select value={opponentFilter} onValueChange={setOpponentFilter}>
                <SelectTrigger className="w-[220px]" data-testid="select-opponent-filter">
                  <SelectValue placeholder="All opponents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All opponents</SelectItem>
                  {opponents.slice().sort((a, b) => a.name.localeCompare(b.name)).map(o => (
                    <SelectItem key={o.id} value={o.id} data-testid={`option-opponent-${o.id}`}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AnalyticsFilterBar
              filters={filters}
              setFilters={setFilters}
              matchesCount={filteredGames.length}
              totalCount={allGames.length}
              className="w-full"
            />
            <div className="flex items-center gap-2 ml-auto" data-testid="text-coverage">
              <Badge variant="secondary" className="text-sm tabular-nums" data-testid="badge-overall-record">
                {overall.wins}W · {overall.losses}L{overall.draws ? ` · ${overall.draws}D` : ""}
              </Badge>
              {overall.total > 0 && (
                <Badge
                  className={`text-sm tabular-nums ${
                    overall.wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                    overall.wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                    "bg-red-500/15 text-red-700 dark:text-red-300"
                  }`}
                  variant="outline"
                  data-testid="badge-overall-winrate"
                >
                  {overall.wr.toFixed(0)}% WR
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-xs">{overall.total} matches</Badge>
            </div>
          </CardContent>
        </Card>

        {filteredGames.length === 0 && (
          <Card className="mb-6">
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold mb-1">No Matches Yet</h3>
              <p className="text-sm text-muted-foreground">
                Matches recorded on this roster will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="opponents" className="w-full">
          <TabsList data-testid="tabs-team-leaderboard">
            <TabsTrigger value="opponents" data-testid="tab-opponents">
              <Target className="h-4 w-4 mr-2" />By Opponent
            </TabsTrigger>
            <TabsTrigger value="maps" data-testid="tab-maps">
              <MapIcon className="h-4 w-4 mr-2" />By Map
            </TabsTrigger>
            <TabsTrigger value="modes" data-testid="tab-modes">
              <Layers className="h-4 w-4 mr-2" />By Mode
            </TabsTrigger>
            <TabsTrigger value="event-type" data-testid="tab-event-type">
              <CalendarDays className="h-4 w-4 mr-2" />By Event Type
            </TabsTrigger>
            <TabsTrigger value="event-sub-type" data-testid="tab-event-sub-type">
              <CalendarDays className="h-4 w-4 mr-2" />By Event Sub Type
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opponents" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Opponent Records
                </CardTitle>
                <CardDescription>Win rate against each opponent — sorted by matches played</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  rows={byOpponent}
                  max={50}
                  renderItem={(o) => (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0">
                        {o.logoUrl ? <AvatarImage src={o.logoUrl} alt={o.name} /> : null}
                        <AvatarFallback className="text-[10px] bg-muted">
                          {o.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate font-medium">{o.name}</span>
                      {o.region && <span className="text-[10px] text-muted-foreground shrink-0">{o.region}</span>}
                    </div>
                  )}
                  fullSlug={fullSlug}
                  labelOf={(o) => `vs ${o.name}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maps" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapIcon className="h-4 w-4 text-primary" /> Map Records
                </CardTitle>
                <CardDescription>Win rate per map</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  rows={byMap}
                  max={50}
                  renderItem={(m) => (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0 rounded-md">
                        {m.imageUrl ? <AvatarImage src={m.imageUrl} alt={m.name} className="object-cover" /> : null}
                        <AvatarFallback className="text-[10px] bg-muted rounded-md">
                          {m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate font-medium">{m.name}</span>
                    </div>
                  )}
                  fullSlug={fullSlug}
                  labelOf={(m) => `Map · ${m.name}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Game Mode Records
                </CardTitle>
                <CardDescription>Win rate per game mode</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  rows={byMode}
                  max={50}
                  renderItem={(m) => (
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium">{m.name}</span>
                    </div>
                  )}
                  fullSlug={fullSlug}
                  labelOf={(m) => `Mode · ${m.name}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="event-type" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Event Type Records
                </CardTitle>
                <CardDescription>Performance breakdown by scrim, tournament, etc.</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  rows={byEventType}
                  max={20}
                  renderItem={(t) => (
                    <div className="flex items-center gap-2 min-w-0">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium capitalize">{t.name.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  fullSlug={fullSlug}
                  labelOf={(t) => `Event · ${t.name}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="event-sub-type" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Event Sub Type Records
                </CardTitle>
                <CardDescription>Performance breakdown by sub-categories like Best of 3, Best of 5, Group Stage, etc.</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  rows={byEventSubType}
                  max={20}
                  renderItem={(t) => (
                    <div className="flex items-center gap-2 min-w-0">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium capitalize">{t.name.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  fullSlug={fullSlug}
                  labelOf={(t) => `Sub · ${t.name}`}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
