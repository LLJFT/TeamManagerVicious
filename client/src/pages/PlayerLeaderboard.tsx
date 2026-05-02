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
  Medal, Users, ExternalLink, ChevronRight, Activity, BarChart3, Swords, ArrowLeft,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import type {
  Event, Game, Hero, Opponent, Player, StatField,
  MatchParticipant, PlayerGameStat, GameHero,
} from "@shared/schema";

interface MatchRef {
  matchId: string;
  eventId: string;
  date: string;
  opponentName: string;
  result: string | null;
  gameCode: string;
}

interface PlayerStatRow {
  player: Player;
  total: number;
  matchesPlayed: number;
  avg: number;
  matches: MatchRef[];
}

interface PlayerAttendanceRow {
  player: Player;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matches: MatchRef[];
}

interface PlayerHeroRow {
  player: Player;
  hero: Hero;
  picks: number;
  wins: number;
  losses: number;
  draws: number;
  matches: MatchRef[];
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
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-2 border-b text-xs font-semibold">Matches: {label}</div>
        <ScrollArea className="max-h-72">
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
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function PlayerChip({ player }: { player: Player }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="text-[10px] bg-muted">
          {player.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate font-medium">{player.name}</span>
      {player.role && <span className="text-[10px] text-muted-foreground shrink-0">{player.role}</span>}
    </div>
  );
}

export default function PlayerLeaderboard() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [opponentFilter, setOpponentFilter] = useState<string>("__all__");

  const opponentParam = opponentFilter === "__all__" ? undefined : opponentFilter;

  const { data: events = [], isLoading: evLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: allGames = [], isLoading: gLoading } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: statFields = [] } = useQuery<StatField[]>({
    queryKey: ["/api/stat-fields", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: participants = [], isLoading: pLoading } = useQuery<MatchParticipant[]>({
    queryKey: ["/api/match-participants", { gameId, rosterId, opponentId: opponentParam }],
    enabled: rosterReady,
  });
  const { data: pgStats = [], isLoading: sLoading } = useQuery<PlayerGameStat[]>({
    queryKey: ["/api/player-game-stats", { gameId, rosterId, opponentId: opponentParam }],
    enabled: rosterReady,
  });
  const { data: gameHeroes = [] } = useQuery<GameHero[]>({
    queryKey: ["/api/game-heroes", { gameId, rosterId, opponentId: opponentParam }],
    enabled: rosterReady,
  });

  // ===== All hooks (incl. useMemo) MUST run before any early return =====
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const heroById = useMemo(() => new Map(heroes.map(h => [h.id, h])), [heroes]);
  const opponentById = useMemo(() => new Map(opponents.map(o => [o.id, o])), [opponents]);
  const filteredGames = useMemo(() => allGames.filter(g => opponentFilter === "__all__" || g.opponentId === opponentFilter), [allGames, opponentFilter]);
  const matchById = useMemo(() => new Map(filteredGames.map(g => [g.id, g])), [filteredGames]);

  const refOf = useMemo(() => (matchId: string): MatchRef | null => {
    const g = matchById.get(matchId);
    if (!g) return null;
    const ev = eventById.get(g.eventId);
    return {
      matchId: g.id,
      eventId: g.eventId,
      date: ev?.date || "",
      opponentName: g.opponentId ? (opponentById.get(g.opponentId)?.name || ev?.opponentName || "Unknown") : (ev?.opponentName || "Unknown"),
      result: g.result || null,
      gameCode: g.gameCode || "",
    };
  }, [matchById, eventById, opponentById]);

  const attendance: PlayerAttendanceRow[] = useMemo(() => {
    const seenPair = new Set<string>();
    const buckets = new Map<string, PlayerAttendanceRow>();
    for (const part of participants) {
      if (!part.played) continue;
      if (part.side !== "us") continue;
      if (!part.playerId) continue;
      const key = `${part.matchId}::${part.playerId}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      const g = matchById.get(part.matchId);
      if (!g) continue;
      const player = playerById.get(part.playerId);
      if (!player) continue;
      let row = buckets.get(part.playerId);
      if (!row) {
        row = { player, matchesPlayed: 0, wins: 0, losses: 0, draws: 0, matches: [] };
        buckets.set(part.playerId, row);
      }
      row.matchesPlayed++;
      const ref = refOf(part.matchId);
      if (ref) row.matches.push(ref);
      if (g.result === "win") row.wins++;
      else if (g.result === "loss") row.losses++;
      else if (g.result === "draw") row.draws++;
    }
    return Array.from(buckets.values()).sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  }, [participants, matchById, playerById, refOf]);

  const statLeaderboards = useMemo(() => {
    const byField = new Map<string, Map<string, PlayerStatRow>>();
    const seenTriples = new Set<string>();
    for (const s of pgStats) {
      if (!s.playerId || !s.statFieldId) continue;
      if (!matchById.has(s.matchId)) continue;
      const triple = `${s.matchId}::${s.playerId}::${s.statFieldId}`;
      if (seenTriples.has(triple)) continue;
      seenTriples.add(triple);
      const player = playerById.get(s.playerId);
      if (!player) continue;
      const numeric = Number(s.value);
      if (!Number.isFinite(numeric)) continue;
      let perPlayer = byField.get(s.statFieldId);
      if (!perPlayer) {
        perPlayer = new Map();
        byField.set(s.statFieldId, perPlayer);
      }
      let row = perPlayer.get(s.playerId);
      if (!row) {
        row = { player, total: 0, matchesPlayed: 0, avg: 0, matches: [] };
        perPlayer.set(s.playerId, row);
      }
      row.total += numeric;
      row.matchesPlayed++;
      const ref = refOf(s.matchId);
      if (ref) row.matches.push(ref);
    }
    const out = new Map<string, PlayerStatRow[]>();
    for (const [fieldId, perPlayer] of Array.from(byField.entries())) {
      const rows = Array.from(perPlayer.values()).map(r => ({
        ...r,
        avg: r.matchesPlayed > 0 ? r.total / r.matchesPlayed : 0,
      }));
      rows.sort((a, b) => b.total - a.total);
      out.set(fieldId, rows);
    }
    return out;
  }, [pgStats, matchById, playerById, refOf]);

  const heroPerformance: PlayerHeroRow[] = useMemo(() => {
    const seen = new Set<string>();
    const buckets = new Map<string, PlayerHeroRow>();
    for (const gh of gameHeroes) {
      // playerId presence implies "us" side (opponents use opponentPlayerId)
      if (!gh.playerId || !gh.heroId) continue;
      if (!matchById.has(gh.matchId)) continue;
      const triple = `${gh.matchId}::${gh.playerId}::${gh.heroId}`;
      if (seen.has(triple)) continue;
      seen.add(triple);
      const player = playerById.get(gh.playerId);
      const hero = heroById.get(gh.heroId);
      if (!player || !hero) continue;
      const g = matchById.get(gh.matchId)!;
      const key = `${gh.playerId}::${gh.heroId}`;
      let row = buckets.get(key);
      if (!row) {
        row = { player, hero, picks: 0, wins: 0, losses: 0, draws: 0, matches: [] };
        buckets.set(key, row);
      }
      row.picks++;
      const ref = refOf(gh.matchId);
      if (ref) row.matches.push(ref);
      if (g.result === "win") row.wins++;
      else if (g.result === "loss") row.losses++;
      else if (g.result === "draw") row.draws++;
    }
    return Array.from(buckets.values()).sort((a, b) => b.picks - a.picks);
  }, [gameHeroes, matchById, playerById, heroById, refOf]);

  // ===== Early returns AFTER all hooks =====
  if (!hasPermission("view_statistics")) {
    return <AccessDenied />;
  }
  if (!rosterReady) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Select a roster to view player analytics.</p>
      </div>
    );
  }
  if (evLoading || gLoading || pLoading || sLoading) {
    return <StatsSkeleton />;
  }

  const hasAnyData = participants.length + pgStats.length + gameHeroes.length > 0;

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
                <Medal className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Player Leaderboard</h1>
              </div>
              <p className="text-muted-foreground">
                Roster-wide player performance, attendance, and hero specialization.
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
            <div className="flex items-center gap-2 ml-auto" data-testid="text-coverage">
              <Badge variant="outline" className="font-mono text-xs">{participants.length} part.</Badge>
              <Badge variant="outline" className="font-mono text-xs">{pgStats.length} stat rows</Badge>
              <Badge variant="outline" className="font-mono text-xs">{gameHeroes.length} hero plays</Badge>
            </div>
          </CardContent>
        </Card>

        {!hasAnyData && (
          <Card className="mb-6">
            <CardContent className="py-12 text-center">
              <Medal className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold mb-1">No Player Data Yet</h3>
              <p className="text-sm text-muted-foreground">
                Player participation, stats, and hero picks will appear here as matches are recorded.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList data-testid="tabs-player-leaderboard">
            <TabsTrigger value="attendance" data-testid="tab-attendance">
              <Users className="h-4 w-4 mr-2" />Attendance
            </TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">
              <BarChart3 className="h-4 w-4 mr-2" />Stat Leaders
            </TabsTrigger>
            <TabsTrigger value="heroes" data-testid="tab-heroes">
              <Swords className="h-4 w-4 mr-2" />Hero Specialization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Matches Played
                </CardTitle>
                <CardDescription>Players ranked by participation, with personal record</CardDescription>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-1 py-2">No participation recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {attendance.map((row, i) => {
                      const total = row.wins + row.losses + row.draws;
                      const wr = total > 0 ? pct(row.wins, total) : 0;
                      return (
                        <div
                          key={row.player.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-attendance-${row.player.id}`}
                        >
                          <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                          <div className="flex-1 min-w-0"><PlayerChip player={row.player} /></div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs tabular-nums" data-testid={`badge-played-${row.player.id}`}>
                              {row.matchesPlayed} played
                            </Badge>
                            <Badge variant="outline" className="text-xs tabular-nums">
                              {row.wins}-{row.losses}{row.draws ? `-${row.draws}` : ""}
                            </Badge>
                            {total > 0 && (
                              <Badge
                                className={`text-xs tabular-nums ${
                                  wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                                  wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                                  "bg-red-500/15 text-red-700 dark:text-red-300"
                                }`}
                                variant="outline"
                              >
                                {wr.toFixed(0)}% WR
                              </Badge>
                            )}
                            <MatchDrillPopover refs={row.matches} fullSlug={fullSlug} label={row.player.name} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            {statFields.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No stat fields configured for this roster.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {statFields.map(field => {
                  const rows = statLeaderboards.get(field.id) || [];
                  return (
                    <Card key={field.id}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" /> {field.name}
                        </CardTitle>
                        <CardDescription>Total · average per match</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic px-1 py-2">No data yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {rows.slice(0, 10).map((r, i) => (
                              <div
                                key={r.player.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                                data-testid={`row-stat-${field.id}-${r.player.id}`}
                              >
                                <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                                <div className="flex-1 min-w-0"><PlayerChip player={r.player} /></div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="secondary" className="text-xs tabular-nums" data-testid={`badge-total-${field.id}-${r.player.id}`}>
                                    {r.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs tabular-nums">
                                    {r.avg.toFixed(1)} avg
                                  </Badge>
                                  <MatchDrillPopover refs={r.matches} fullSlug={fullSlug} label={`${r.player.name}-${field.name}`} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="heroes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" /> Most-Picked Hero by Player
                </CardTitle>
                <CardDescription>Pairings ranked by picks, with that pairing's win rate</CardDescription>
              </CardHeader>
              <CardContent>
                {heroPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-1 py-2">No hero picks recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {heroPerformance.slice(0, 30).map((row, i) => {
                      const total = row.wins + row.losses + row.draws;
                      const wr = total > 0 ? pct(row.wins, total) : 0;
                      return (
                        <div
                          key={`${row.player.id}-${row.hero.id}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-hero-${row.player.id}-${row.hero.id}`}
                        >
                          <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                          <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                            <PlayerChip player={row.player} />
                            <span className="text-xs text-muted-foreground">on</span>
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-6 w-6 shrink-0">
                                {row.hero.imageUrl ? <AvatarImage src={row.hero.imageUrl} alt={row.hero.name} /> : null}
                                <AvatarFallback className="text-[10px] bg-muted">
                                  {row.hero.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{row.hero.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs tabular-nums">
                              {row.picks} pick{row.picks === 1 ? "" : "s"}
                            </Badge>
                            {total > 0 && (
                              <Badge
                                className={`text-xs tabular-nums ${
                                  wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                                  wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                                  "bg-red-500/15 text-red-700 dark:text-red-300"
                                }`}
                                variant="outline"
                              >
                                {wr.toFixed(0)}% WR
                              </Badge>
                            )}
                            <MatchDrillPopover refs={row.matches} fullSlug={fullSlug} label={`${row.player.name}-${row.hero.name}`} />
                          </div>
                        </div>
                      );
                    })}
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
