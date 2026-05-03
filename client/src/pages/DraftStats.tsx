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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft, Swords, Ban, Lock, Map as MapIcon, Trophy,
  ExternalLink, Users, ChevronRight,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import {
  AnalyticsFilterBar, useAnalyticsFilters, applyAnalyticsFilters,
} from "@/components/analytics-filters";
import type {
  Event, Game, Hero, Map as MapType, GameMode, Opponent,
  GameHeroBanAction, GameMapVetoRow, GameHero, OpponentPlayer, Player,
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
  count: number;
  matches: MatchRef[];
  // For picks/heroes-played: win rate when this happened
  wins?: number;
  losses?: number;
  draws?: number;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return (n / d) * 100;
}

function HeroChip({ hero }: { hero?: Hero }) {
  if (!hero) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">?</AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground italic truncate">Unknown</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-7 w-7 shrink-0">
        {hero.imageUrl ? <AvatarImage src={hero.imageUrl} alt={hero.name} /> : null}
        <AvatarFallback className="text-[10px] bg-muted">
          {hero.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate font-medium">{hero.name}</span>
      {hero.role && <span className="text-[10px] text-muted-foreground shrink-0">{hero.role}</span>}
    </div>
  );
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
  rows, max, renderItem, totalCount, fullSlug, labelOf, showWinRate,
}: {
  rows: RankRow<T>[];
  max: number;
  renderItem: (item: T) => React.ReactNode;
  totalCount: number;
  fullSlug: string | null;
  labelOf: (item: T) => string;
  showWinRate?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground italic px-1 py-2">No data yet.</p>;
  }
  const top = rows.slice(0, max);
  return (
    <div className="space-y-1.5">
      {top.map((r, i) => {
        const total = (r.wins ?? 0) + (r.losses ?? 0) + (r.draws ?? 0);
        const wr = showWinRate && total > 0 ? pct(r.wins ?? 0, total) : null;
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
            data-testid={`rank-row-${i}`}
          >
            <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
            <div className="flex-1 min-w-0">{renderItem(r.item)}</div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs tabular-nums">
                {r.count} ({pct(r.count, totalCount).toFixed(0)}%)
              </Badge>
              {wr !== null && (
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
              <MatchDrillPopover refs={r.matches} fullSlug={fullSlug} label={labelOf(r.item)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DraftStats() {
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
  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }],
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
  const { data: heroBanRows = [], isLoading: hbLoading } = useQuery<GameHeroBanAction[]>({
    queryKey: ["/api/hero-ban-actions", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: vetoRows = [], isLoading: vrLoading } = useQuery<GameMapVetoRow[]>({
    queryKey: ["/api/map-veto-rows", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: gameHeroRows = [], isLoading: ghLoading } = useQuery<GameHero[]>({
    queryKey: ["/api/game-heroes", { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const isLoading = evLoading || gLoading || hbLoading || vrLoading || ghLoading;

  // ---- index helpers --------------------------------------------------------
  const heroById = useMemo(() => {
    const m = new Map<string, Hero>();
    heroes.forEach(h => m.set(h.id, h));
    return m;
  }, [heroes]);

  const mapById = useMemo(() => {
    const m = new Map<string, MapType>();
    maps.forEach(x => m.set(x.id, x));
    return m;
  }, [maps]);

  const modeById = useMemo(() => {
    const m = new Map<string, GameMode>();
    gameModes.forEach(x => m.set(x.id, x));
    return m;
  }, [gameModes]);

  const eventById = useMemo(() => {
    const m = new Map<string, Event>();
    events.forEach(e => m.set(e.id, e));
    return m;
  }, [events]);

  const playerIds = useMemo(() => new Set(players.map(p => p.id)), [players]);

  const allowedEventIds = useMemo(
    () => applyAnalyticsFilters(events, filters),
    [events, filters],
  );

  // Filter scope: which match IDs are in scope (after opponent + analytics filters)
  const scopedGames = useMemo(() => {
    return allGames.filter(g =>
      (opponentFilter === "__all__" || g.opponentId === opponentFilter) &&
      g.eventId && allowedEventIds.has(g.eventId),
    );
  }, [allGames, opponentFilter, allowedEventIds]);

  const scopedMatchIds = useMemo(() => new Set(scopedGames.map(g => g.id)), [scopedGames]);

  // Build a quick lookup for matchRef metadata
  const matchRefById = useMemo(() => {
    const m = new Map<string, MatchRef>();
    scopedGames.forEach(g => {
      const ev = g.eventId ? eventById.get(g.eventId) : null;
      const opp = g.opponentId ? opponents.find(o => o.id === g.opponentId) : null;
      const oppName = opp?.name || ev?.opponentName || "Unknown";
      m.set(g.id, {
        matchId: g.id,
        eventId: g.eventId || "",
        date: ev?.date || "",
        opponentName: oppName,
        result: g.result || null,
        gameCode: g.gameCode || "",
      });
    });
    return m;
  }, [scopedGames, eventById, opponents]);

  // ============ HERO BAN ANALYTICS ===========================================
  const filteredBanRows = useMemo(() => {
    return heroBanRows.filter(r => scopedMatchIds.has(r.matchId));
  }, [heroBanRows, scopedMatchIds]);

  const filteredHeroPlays = useMemo(() => {
    return gameHeroRows.filter(r => scopedMatchIds.has(r.matchId));
  }, [gameHeroRows, scopedMatchIds]);

  function rankHeroes(
    rows: GameHeroBanAction[],
    actor: "a" | "b" | "any",
    actionTypes: ("ban" | "lock" | "protect")[],
  ): { rows: RankRow<Hero>[]; total: number } {
    const matching = rows.filter(r =>
      (actor === "any" || r.actingTeam === actor) &&
      r.heroId &&
      actionTypes.includes(r.actionType as any)
    );
    const grouped = new Map<string, { count: number; matches: Map<string, MatchRef> }>();
    matching.forEach(r => {
      const key = r.heroId!;
      if (!grouped.has(key)) grouped.set(key, { count: 0, matches: new Map() });
      const entry = grouped.get(key)!;
      entry.count++;
      const ref = matchRefById.get(r.matchId);
      if (ref) entry.matches.set(r.matchId, ref);
    });
    const out: RankRow<Hero>[] = [];
    grouped.forEach((v, heroId) => {
      const hero = heroById.get(heroId);
      if (!hero) return;
      out.push({
        item: hero,
        count: v.count,
        matches: Array.from(v.matches.values()).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      });
    });
    out.sort((a, b) => b.count - a.count);
    return { rows: out, total: matching.length };
  }

  const heroesBannedByUs = useMemo(
    () => rankHeroes(filteredBanRows, "a", ["ban"]),
    [filteredBanRows, heroById, matchRefById]
  );
  const heroesBannedByOpp = useMemo(
    () => rankHeroes(filteredBanRows, "b", ["ban"]),
    [filteredBanRows, heroById, matchRefById]
  );
  const heroesProtectedByUs = useMemo(
    () => rankHeroes(filteredBanRows, "a", ["lock", "protect"]),
    [filteredBanRows, heroById, matchRefById]
  );
  const heroesProtectedByOpp = useMemo(
    () => rankHeroes(filteredBanRows, "b", ["lock", "protect"]),
    [filteredBanRows, heroById, matchRefById]
  );

  // Heroes-played: from gameHeroes, splitting by player vs opponentPlayer attribution.
  // Count = unique (matchId, heroId, playerId/opponentPlayerId) tuples so that multiple
  // round-rows for the same player+hero+match aren't double-counted.
  const heroesPlayedByUs = useMemo(() => {
    const grouped = new Map<string, { picks: Set<string>; w: number; l: number; d: number; matches: Map<string, MatchRef> }>();
    const totalPicks = new Set<string>();
    filteredHeroPlays.forEach(r => {
      if (!r.playerId || r.opponentPlayerId) return;
      if (!playerIds.has(r.playerId)) return;
      const tuple = `${r.matchId}::${r.heroId}::${r.playerId}`;
      totalPicks.add(tuple);
      const key = r.heroId;
      if (!grouped.has(key)) grouped.set(key, { picks: new Set(), w: 0, l: 0, d: 0, matches: new Map() });
      const entry = grouped.get(key)!;
      entry.picks.add(tuple);
      const ref = matchRefById.get(r.matchId);
      if (ref && !entry.matches.has(r.matchId)) {
        entry.matches.set(r.matchId, ref);
        if (ref.result === "win") entry.w++;
        else if (ref.result === "loss") entry.l++;
        else if (ref.result === "draw") entry.d++;
      }
    });
    const out: RankRow<Hero>[] = [];
    grouped.forEach((v, heroId) => {
      const hero = heroById.get(heroId);
      if (!hero) return;
      out.push({
        item: hero,
        count: v.picks.size,
        wins: v.w, losses: v.l, draws: v.d,
        matches: Array.from(v.matches.values()).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      });
    });
    out.sort((a, b) => b.count - a.count);
    return { rows: out, total: totalPicks.size };
  }, [filteredHeroPlays, playerIds, heroById, matchRefById]);

  const heroesPlayedByOpp = useMemo(() => {
    const grouped = new Map<string, { picks: Set<string>; w: number; l: number; d: number; matches: Map<string, MatchRef> }>();
    const totalPicks = new Set<string>();
    filteredHeroPlays.forEach(r => {
      if (!r.opponentPlayerId) return;
      const tuple = `${r.matchId}::${r.heroId}::${r.opponentPlayerId}`;
      totalPicks.add(tuple);
      const key = r.heroId;
      if (!grouped.has(key)) grouped.set(key, { picks: new Set(), w: 0, l: 0, d: 0, matches: new Map() });
      const entry = grouped.get(key)!;
      entry.picks.add(tuple);
      const ref = matchRefById.get(r.matchId);
      if (ref && !entry.matches.has(r.matchId)) {
        entry.matches.set(r.matchId, ref);
        if (ref.result === "win") entry.w++;
        else if (ref.result === "loss") entry.l++;
        else if (ref.result === "draw") entry.d++;
      }
    });
    const out: RankRow<Hero>[] = [];
    grouped.forEach((v, heroId) => {
      const hero = heroById.get(heroId);
      if (!hero) return;
      out.push({
        item: hero,
        count: v.picks.size,
        wins: v.w, losses: v.l, draws: v.d,
        matches: Array.from(v.matches.values()).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      });
    });
    out.sort((a, b) => b.count - a.count);
    return { rows: out, total: totalPicks.size };
  }, [filteredHeroPlays, heroById, matchRefById]);

  // ============ MAP VETO ANALYTICS ===========================================
  const filteredVetoRows = useMemo(() => {
    return vetoRows.filter(r => scopedMatchIds.has(r.matchId));
  }, [vetoRows, scopedMatchIds]);

  function rankMaps(
    rows: GameMapVetoRow[],
    actor: "a" | "b" | "auto" | "any",
    actionTypes: ("ban" | "pick" | "decider")[],
    includeWinRate = false,
  ): { rows: RankRow<MapType>[]; total: number } {
    const matching = rows.filter(r =>
      (actor === "any" || r.actingTeam === actor) &&
      r.mapId &&
      actionTypes.includes(r.actionType as any)
    );
    const grouped = new Map<string, { count: number; w: number; l: number; d: number; matches: Map<string, MatchRef> }>();
    matching.forEach(r => {
      const key = r.mapId!;
      if (!grouped.has(key)) grouped.set(key, { count: 0, w: 0, l: 0, d: 0, matches: new Map() });
      const entry = grouped.get(key)!;
      entry.count++;
      const ref = matchRefById.get(r.matchId);
      if (ref && !entry.matches.has(r.matchId)) {
        entry.matches.set(r.matchId, ref);
        if (includeWinRate) {
          if (ref.result === "win") entry.w++;
          else if (ref.result === "loss") entry.l++;
          else if (ref.result === "draw") entry.d++;
        }
      }
    });
    const out: RankRow<MapType>[] = [];
    grouped.forEach((v, mapId) => {
      const map = mapById.get(mapId);
      if (!map) return;
      out.push({
        item: map,
        count: v.count,
        wins: includeWinRate ? v.w : undefined,
        losses: includeWinRate ? v.l : undefined,
        draws: includeWinRate ? v.d : undefined,
        matches: Array.from(v.matches.values()).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      });
    });
    out.sort((a, b) => b.count - a.count);
    return { rows: out, total: matching.length };
  }

  const mapBansByUs = useMemo(() => rankMaps(filteredVetoRows, "a", ["ban"]), [filteredVetoRows, mapById, matchRefById]);
  const mapBansByOpp = useMemo(() => rankMaps(filteredVetoRows, "b", ["ban"]), [filteredVetoRows, mapById, matchRefById]);
  const mapPicksByUs = useMemo(() => rankMaps(filteredVetoRows, "a", ["pick"], true), [filteredVetoRows, mapById, matchRefById]);
  const mapPicksByOpp = useMemo(() => rankMaps(filteredVetoRows, "b", ["pick"], true), [filteredVetoRows, mapById, matchRefById]);
  const mapDeciders = useMemo(() => rankMaps(filteredVetoRows, "any", ["decider"], true), [filteredVetoRows, mapById, matchRefById]);

  // ----- coverage summary (top of page) --------------------------------------
  const summary = useMemo(() => {
    const matchesWithVeto = new Set(filteredVetoRows.map(r => r.matchId)).size;
    const matchesWithBans = new Set(filteredBanRows.map(r => r.matchId)).size;
    const matchesWithPlays = new Set(filteredHeroPlays.map(r => r.matchId)).size;
    return {
      totalMatches: scopedGames.length,
      matchesWithVeto,
      matchesWithBans,
      matchesWithPlays,
      totalBanActions: filteredBanRows.length,
      totalVetoRows: filteredVetoRows.length,
    };
  }, [filteredBanRows, filteredVetoRows, filteredHeroPlays, scopedGames]);

  const renderHero = (h: Hero) => <HeroChip hero={h} />;
  const renderMap = (m: MapType) => {
    const mode = m.gameModeId ? modeById.get(m.gameModeId) : null;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-7 w-7 shrink-0 rounded-md">
          {m.imageUrl ? <AvatarImage src={m.imageUrl} alt={m.name} className="object-cover" /> : null}
          <AvatarFallback className="text-[10px] bg-muted rounded-md">
            <MapIcon className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm truncate font-medium">{m.name}</span>
        {mode && <span className="text-[10px] text-muted-foreground shrink-0">{mode.name}</span>}
      </div>
    );
  };

  if (!hasPermission("view_statistics")) {
    return <AccessDenied />;
  }
  if (!rosterReady) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Select a roster to view draft analytics.</p>
      </div>
    );
  }
  if (isLoading) {
    return <StatsSkeleton />;
  }

  // Filter empty state
  const hasAnyDraftData = heroBanRows.length + vetoRows.length + gameHeroRows.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href={`/${fullSlug}`}>
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Swords className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Draft Stats</h1>
              </div>
              <p className="text-muted-foreground">
                Map veto, hero bans &amp; protects, and hero pool insights for this roster.
              </p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
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
              className="w-full"
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto" data-testid="text-coverage">
              <Badge variant="outline" className="font-mono">{summary.totalMatches} maps</Badge>
              <Badge variant="outline" className="font-mono">{summary.matchesWithVeto} w/ veto</Badge>
              <Badge variant="outline" className="font-mono">{summary.matchesWithBans} w/ bans</Badge>
              <Badge variant="outline" className="font-mono">{summary.matchesWithPlays} w/ heroes</Badge>
            </div>
          </CardContent>
        </Card>

        {!hasAnyDraftData && (
          <Card className="mb-6">
            <CardContent className="py-12 text-center">
              <Swords className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold mb-1">No Draft Data Yet</h3>
              <p className="text-sm text-muted-foreground">
                Hero bans and map vetoes recorded on matches will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="maps" className="w-full">
          <TabsList data-testid="tabs-draft-stats">
            <TabsTrigger value="maps" data-testid="tab-maps">
              <MapIcon className="h-4 w-4 mr-2" />Map Veto / Pick
            </TabsTrigger>
            <TabsTrigger value="heroes" data-testid="tab-heroes">
              <Swords className="h-4 w-4 mr-2" />Hero Bans &amp; Pool
            </TabsTrigger>
          </TabsList>

          <TabsContent value="maps" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" /> Maps Banned by Us
                  </CardTitle>
                  <CardDescription>What our team takes off the board</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={mapBansByUs.rows}
                    totalCount={mapBansByUs.total}
                    max={10}
                    renderItem={renderMap}
                    fullSlug={fullSlug}
                    labelOf={(m) => `Banned by us · ${m.name}`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4 text-amber-500" /> Maps Banned by Opponents
                  </CardTitle>
                  <CardDescription>What gets banned against us</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={mapBansByOpp.rows}
                    totalCount={mapBansByOpp.total}
                    max={10}
                    renderItem={renderMap}
                    fullSlug={fullSlug}
                    labelOf={(m) => `Banned by opponent · ${m.name}`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-500" /> Maps Picked by Us
                  </CardTitle>
                  <CardDescription>Our picks &amp; how they perform</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={mapPicksByUs.rows}
                    totalCount={mapPicksByUs.total}
                    max={10}
                    renderItem={renderMap}
                    fullSlug={fullSlug}
                    labelOf={(m) => `Picked by us · ${m.name}`}
                    showWinRate
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-rose-500" /> Maps Picked by Opponents
                  </CardTitle>
                  <CardDescription>Their picks &amp; our record on them</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={mapPicksByOpp.rows}
                    totalCount={mapPicksByOpp.total}
                    max={10}
                    renderItem={renderMap}
                    fullSlug={fullSlug}
                    labelOf={(m) => `Picked by opponent · ${m.name}`}
                    showWinRate
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-primary" /> Decider Maps
                  </CardTitle>
                  <CardDescription>Maps that ended up as the decider step &amp; our record</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={mapDeciders.rows}
                    totalCount={mapDeciders.total}
                    max={12}
                    renderItem={renderMap}
                    fullSlug={fullSlug}
                    labelOf={(m) => `Decider · ${m.name}`}
                    showWinRate
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="heroes" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" /> Heroes Banned by Us
                  </CardTitle>
                  <CardDescription>Who we take away from opponents</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={heroesBannedByUs.rows}
                    totalCount={heroesBannedByUs.total}
                    max={12}
                    renderItem={renderHero}
                    fullSlug={fullSlug}
                    labelOf={(h) => `Banned by us · ${h.name}`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4 text-amber-500" /> Heroes Banned by Opponents
                  </CardTitle>
                  <CardDescription>Who opponents target against us</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={heroesBannedByOpp.rows}
                    totalCount={heroesBannedByOpp.total}
                    max={12}
                    renderItem={renderHero}
                    fullSlug={fullSlug}
                    labelOf={(h) => `Banned by opponent · ${h.name}`}
                  />
                </CardContent>
              </Card>

              {(heroesProtectedByUs.total > 0 || heroesProtectedByOpp.total > 0) && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="h-4 w-4 text-emerald-500" /> Locked / Protected by Us
                      </CardTitle>
                      <CardDescription>Heroes we secure for our team</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RankList
                        rows={heroesProtectedByUs.rows}
                        totalCount={heroesProtectedByUs.total}
                        max={10}
                        renderItem={renderHero}
                        fullSlug={fullSlug}
                        labelOf={(h) => `Protected by us · ${h.name}`}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="h-4 w-4 text-rose-500" /> Locked / Protected by Opponents
                      </CardTitle>
                      <CardDescription>Heroes opponents secure for themselves</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RankList
                        rows={heroesProtectedByOpp.rows}
                        totalCount={heroesProtectedByOpp.total}
                        max={10}
                        renderItem={renderHero}
                        fullSlug={fullSlug}
                        labelOf={(h) => `Protected by opponent · ${h.name}`}
                      />
                    </CardContent>
                  </Card>
                </>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-500" /> Heroes Played by Us
                  </CardTitle>
                  <CardDescription>Our hero pool with win rate per pick</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={heroesPlayedByUs.rows}
                    totalCount={heroesPlayedByUs.total}
                    max={12}
                    renderItem={renderHero}
                    fullSlug={fullSlug}
                    labelOf={(h) => `Our pick · ${h.name}`}
                    showWinRate
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-rose-500" /> Heroes Played by Opponents
                  </CardTitle>
                  <CardDescription>Opponent hero pool &amp; our record vs each</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={heroesPlayedByOpp.rows}
                    totalCount={heroesPlayedByOpp.total}
                    max={12}
                    renderItem={renderHero}
                    fullSlug={fullSlug}
                    labelOf={(h) => `Opponent pick · ${h.name}`}
                    showWinRate
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
