import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import type { Event, Game, GameMode, Map as MapType, Opponent, Hero, GameHeroBanAction, GameMapVetoRow, GameHero } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Swords, Ban, Lock } from "lucide-react";
import { OpponentAvatar, findOpponentByName } from "@/components/OpponentAvatar";
import { OpponentRosterDialog } from "@/components/OpponentRosterDialog";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { OpponentsSkeleton } from "@/components/PageSkeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface ScoutingItem<T> {
  item: T;
  count: number;
}

interface OpponentData {
  name: string;
  eventStats: StatsSummary;
  gameStats: StatsSummary;
  bestModes: { mode: GameMode; winRate: number; total: number }[];
  worstMaps: { map: MapType; modeName: string; winRate: number; total: number }[];
  lastPlayed?: string;
  eventDetails: EventDetail[];
  // Scouting insights — only populated when draft data is present for this opponent
  scouting: {
    bannedByThem: ScoutingItem<Hero>[];
    protectedByThem: ScoutingItem<Hero>[];
    heroesPlayedByThem: ScoutingItem<Hero>[];
    mapsPickedByThem: ScoutingItem<MapType>[];
    mapsBannedByThem: ScoutingItem<MapType>[];
    totalBanRows: number;
    totalVetoRows: number;
    totalPlayRows: number;
  };
}

type SortOption = "matches" | "winRate" | "name" | "lastPlayed";

export default function OpponentStats() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const { fullSlug, gameId, rosterId } = useGame();
  const canManageOpponents = hasPermission("manage_game_config");
  const rosterReady = !!(gameId && rosterId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("matches");
  const [expandedOpponents, setExpandedOpponents] = useState<Set<string>>(new Set());
  const [rosterDialogOpp, setRosterDialogOpp] = useState<Opponent | undefined>();

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

  const { data: opponentRoster = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: heroBanRows = [] } = useQuery<GameHeroBanAction[]>({
    queryKey: ["/api/hero-ban-actions", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: vetoRows = [] } = useQuery<GameMapVetoRow[]>({
    queryKey: ["/api/map-veto-rows", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const { data: gameHeroRows = [] } = useQuery<GameHero[]>({
    queryKey: ["/api/game-heroes", { gameId, rosterId }],
    enabled: rosterReady,
  });

  // Lazy-create an opponent record on demand when the user opens View Roster
  // for an opponent that exists only as text on past events. This NEVER
  // touches existing event/history rows — it just adds a new opponents row
  // (so the roster sub-table can hang off it) using the same name/scope.
  const ensureOpponentMutation = useMutation({
    mutationFn: async (name: string): Promise<Opponent> => {
      const res = await apiRequest("POST", "/api/opponents", {
        name,
        isActive: true,
        sortOrder: 0,
      });
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "/api/opponents" });
      setRosterDialogOpp(created);
    },
    onError: (e: any) => toast({ title: "Failed to open roster", description: e.message, variant: "destructive" }),
  });

  const openRoster = (name: string) => {
    const existing = findOpponentByName(opponentRoster, name);
    if (existing) {
      setRosterDialogOpp(existing);
    } else {
      ensureOpponentMutation.mutate(name);
    }
  };

  const calculateStats = (items: { result?: string | null }[]): StatsSummary => {
    const total = items.length;
    const wins = items.filter(i => i.result === "win").length;
    const losses = items.filter(i => i.result === "loss").length;
    const draws = items.filter(i => i.result === "draw").length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, draws, winRate };
  };

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

  const opponentData = useMemo<OpponentData[]>(() => {
    // Bucket events + games by a stable opponent key. Prefer the FK
    // (event.opponentId / game.opponentId) so linked-only opponents (no
    // free-text name on the event) still appear. Fall back to a normalized
    // text name for legacy rows that only have opponentName.
    const opponentById = new Map<string, Opponent>();
    const opponentByLowerName = new Map<string, Opponent>();
    opponentRoster.forEach(o => {
      opponentById.set(o.id, o);
      opponentByLowerName.set(o.name.trim().toLowerCase(), o);
    });

    type Bucket = { key: string; displayName: string; events: Event[]; games: typeof allGames };
    const buckets = new Map<string, Bucket>();

    // Canonicalize: text names that match a roster opponent (case-insensitive)
    // collapse into the FK bucket so mixed text+FK rows for the same real team
    // aggregate together instead of fragmenting.
    const canonical = (oppId: string | null | undefined, oppName: string | null | undefined):
      { key: string; displayName: string } | null => {
      if (oppId && opponentById.has(oppId)) {
        return { key: `id:${oppId}`, displayName: opponentById.get(oppId)!.name };
      }
      const txt = (oppName || "").trim();
      if (!txt) return null;
      const matched = opponentByLowerName.get(txt.toLowerCase());
      if (matched) return { key: `id:${matched.id}`, displayName: matched.name };
      return { key: `name:${txt.toLowerCase()}`, displayName: txt };
    };

    const ensureBucket = (key: string, displayName: string): Bucket => {
      let b = buckets.get(key);
      if (!b) { b = { key, displayName, events: [], games: [] }; buckets.set(key, b); }
      return b;
    };

    const eventIdToBucket = new Map<string, Bucket>();
    events.forEach(event => {
      const k = canonical(event.opponentId, event.opponentName);
      if (!k) return;
      const b = ensureBucket(k.key, k.displayName);
      b.events.push(event);
      eventIdToBucket.set(event.id, b);
    });

    allGames.forEach(g => {
      // Prefer the game's own opponent FK when present (most authoritative);
      // fall back to the parent event's bucket only when the game has no FK.
      const fromFk = canonical(g.opponentId, null);
      if (fromFk) {
        const b = ensureBucket(fromFk.key, fromFk.displayName);
        b.games.push(g);
        return;
      }
      const viaEvent = g.eventId ? eventIdToBucket.get(g.eventId) : undefined;
      if (viaEvent) viaEvent.games.push(g);
    });

    const result: OpponentData[] = [];

    buckets.forEach((bucket) => {
      const opponentEvents = bucket.events;
      const displayName = bucket.displayName;
      const opponentGames = bucket.games;
      const matchIds = new Set(opponentGames.map(g => g.id));

      // ---- Scouting computation ----
      const oppBanRows = heroBanRows.filter(r => matchIds.has(r.matchId));
      const oppVetoRows = vetoRows.filter(r => matchIds.has(r.matchId));
      const oppPlayRows = gameHeroRows.filter(r => matchIds.has(r.matchId));

      const tally = <T,>(rows: { key: string }[], lookup: Map<string, T>): ScoutingItem<T>[] => {
        const counts = new Map<string, number>();
        rows.forEach(r => { counts.set(r.key, (counts.get(r.key) || 0) + 1); });
        const out: ScoutingItem<T>[] = [];
        counts.forEach((count, key) => {
          const item = lookup.get(key);
          if (item) out.push({ item, count });
        });
        out.sort((a, b) => b.count - a.count);
        return out;
      };

      const bannedByThem = tally<Hero>(
        oppBanRows.filter(r => r.actingTeam === "b" && r.actionType === "ban" && r.heroId).map(r => ({ key: r.heroId! })),
        heroById,
      );
      const protectedByThem = tally<Hero>(
        oppBanRows.filter(r => r.actingTeam === "b" && (r.actionType === "lock" || r.actionType === "protect") && r.heroId).map(r => ({ key: r.heroId! })),
        heroById,
      );
      const heroPlaysSeen = new Set<string>();
      const heroesPlayedByThem = tally<Hero>(
        oppPlayRows
          .filter(r => !!r.opponentPlayerId)
          .filter(r => {
            const t = `${r.matchId}::${r.heroId}::${r.opponentPlayerId}`;
            if (heroPlaysSeen.has(t)) return false;
            heroPlaysSeen.add(t);
            return true;
          })
          .map(r => ({ key: r.heroId })),
        heroById,
      );
      const mapsPickedByThem = tally<MapType>(
        oppVetoRows.filter(r => r.actingTeam === "b" && r.actionType === "pick" && r.mapId).map(r => ({ key: r.mapId! })),
        mapById,
      );
      const mapsBannedByThem = tally<MapType>(
        oppVetoRows.filter(r => r.actingTeam === "b" && r.actionType === "ban" && r.mapId).map(r => ({ key: r.mapId! })),
        mapById,
      );

      const scouting = {
        bannedByThem,
        protectedByThem,
        heroesPlayedByThem,
        mapsPickedByThem,
        mapsBannedByThem,
        totalBanRows: oppBanRows.length,
        totalVetoRows: oppVetoRows.length,
        totalPlayRows: oppPlayRows.length,
      };

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
        scouting,
      });
    });

    return result;
  }, [events, allGames, gameModes, maps, heroBanRows, vetoRows, gameHeroRows, heroById, mapById, opponentRoster]);

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
                      <OpponentAvatar
                        name={opponent.name}
                        opponents={opponentRoster}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-xl">{opponent.name}</CardTitle>
                          {canManageOpponents && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 px-2"
                              onClick={(e) => { e.stopPropagation(); openRoster(opponent.name); }}
                              disabled={ensureOpponentMutation.isPending}
                              data-testid={`button-view-roster-${opponent.name}`}
                              title="View roster"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span className="text-xs">View Roster</span>
                            </Button>
                          )}
                        </div>
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
                    {(opponent.scouting.totalBanRows > 0 || opponent.scouting.totalVetoRows > 0 || opponent.scouting.totalPlayRows > 0) && (
                      <div className="p-4 border-b border-border bg-muted/20">
                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Swords className="h-4 w-4 text-primary" />
                            Scouting Insights vs {opponent.name}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Badge variant="outline" className="font-mono">{opponent.scouting.totalBanRows} ban rows</Badge>
                            <Badge variant="outline" className="font-mono">{opponent.scouting.totalVetoRows} veto rows</Badge>
                            <Badge variant="outline" className="font-mono">{opponent.scouting.totalPlayRows} hero rows</Badge>
                            <Link href={`/${fullSlug}/draft-stats`}>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" data-testid={`link-draft-stats-${opponent.name}`}>
                                Full draft stats <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {opponent.scouting.heroesPlayedByThem.length > 0 && (
                            <div className="bg-card border border-border rounded p-2.5">
                              <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                                <Trophy className="h-3.5 w-3.5 text-rose-500" /> Heroes They Play
                              </div>
                              <div className="space-y-1">
                                {opponent.scouting.heroesPlayedByThem.slice(0, 5).map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Avatar className="h-5 w-5 shrink-0">
                                      {s.item.imageUrl ? <AvatarImage src={s.item.imageUrl} alt={s.item.name} /> : null}
                                      <AvatarFallback className="text-[8px] bg-muted">{s.item.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate flex-1">{s.item.name}</span>
                                    <Badge variant="secondary" className="text-[10px] tabular-nums">{s.count}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {opponent.scouting.bannedByThem.length > 0 && (
                            <div className="bg-card border border-border rounded p-2.5">
                              <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                                <Ban className="h-3.5 w-3.5 text-amber-500" /> Heroes They Ban
                              </div>
                              <div className="space-y-1">
                                {opponent.scouting.bannedByThem.slice(0, 5).map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Avatar className="h-5 w-5 shrink-0">
                                      {s.item.imageUrl ? <AvatarImage src={s.item.imageUrl} alt={s.item.name} /> : null}
                                      <AvatarFallback className="text-[8px] bg-muted">{s.item.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate flex-1">{s.item.name}</span>
                                    <Badge variant="secondary" className="text-[10px] tabular-nums">{s.count}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {opponent.scouting.protectedByThem.length > 0 && (
                            <div className="bg-card border border-border rounded p-2.5">
                              <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5 text-emerald-500" /> Heroes They Protect
                              </div>
                              <div className="space-y-1">
                                {opponent.scouting.protectedByThem.slice(0, 5).map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Avatar className="h-5 w-5 shrink-0">
                                      {s.item.imageUrl ? <AvatarImage src={s.item.imageUrl} alt={s.item.name} /> : null}
                                      <AvatarFallback className="text-[8px] bg-muted">{s.item.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate flex-1">{s.item.name}</span>
                                    <Badge variant="secondary" className="text-[10px] tabular-nums">{s.count}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {opponent.scouting.mapsPickedByThem.length > 0 && (
                            <div className="bg-card border border-border rounded p-2.5">
                              <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                                <Trophy className="h-3.5 w-3.5 text-rose-500" /> Maps They Pick
                              </div>
                              <div className="space-y-1">
                                {opponent.scouting.mapsPickedByThem.slice(0, 5).map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Avatar className="h-5 w-5 shrink-0 rounded-sm">
                                      {s.item.imageUrl ? <AvatarImage src={s.item.imageUrl} alt={s.item.name} className="object-cover" /> : null}
                                      <AvatarFallback className="text-[8px] bg-muted rounded-sm">{s.item.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate flex-1">{s.item.name}</span>
                                    <Badge variant="secondary" className="text-[10px] tabular-nums">{s.count}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {opponent.scouting.mapsBannedByThem.length > 0 && (
                            <div className="bg-card border border-border rounded p-2.5">
                              <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                                <Ban className="h-3.5 w-3.5 text-amber-500" /> Maps They Ban
                              </div>
                              <div className="space-y-1">
                                {opponent.scouting.mapsBannedByThem.slice(0, 5).map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Avatar className="h-5 w-5 shrink-0 rounded-sm">
                                      {s.item.imageUrl ? <AvatarImage src={s.item.imageUrl} alt={s.item.name} className="object-cover" /> : null}
                                      <AvatarFallback className="text-[8px] bg-muted rounded-sm">{s.item.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate flex-1">{s.item.name}</span>
                                    <Badge variant="secondary" className="text-[10px] tabular-nums">{s.count}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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

      <OpponentRosterDialog
        opponent={rosterDialogOpp}
        canEdit={canManageOpponents}
        onClose={() => setRosterDialogOpp(undefined)}
      />
    </ScrollArea>
  );
}
