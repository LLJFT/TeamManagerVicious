import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Layers, Shield, ExternalLink, Filter, X, Calendar as CalendarIcon,
  Swords, Target, ArrowLeft, ChevronDown, ChevronUp, Search, Trophy,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import { Paginator, paginate, DEFAULT_PAGE_SIZE } from "@/components/Paginator";
import type {
  Event, Game, Hero, Opponent, OpponentPlayer, Player, GameHero, Map as MapType, GameMode,
} from "@shared/schema";

type Side = "ours" | "opponents";

interface CompSlot {
  participantId: string;
  participantName: string;
  heroes: Hero[];
}

interface GamePlay {
  matchId: string;
  eventId: string | null;
  date: string;
  subType: string | null;
  result: string | null;
  gameCode: string;
  mapName: string | null;
  modeName: string | null;
  ourSlots: CompSlot[];
  oppSlots: CompSlot[];
}

interface GroupedComp {
  key: string;
  heroes: Hero[];
  plays: GamePlay[];
  wins: number;
  losses: number;
  draws: number;
}

interface OpponentSummary {
  opponent: Opponent | null;
  syntheticName: string;
  syntheticKey: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
}

function resultBadge(r: string | null) {
  const v = (r || "").toUpperCase();
  if (v === "W" || v === "WIN") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">W</Badge>;
  if (v === "L" || v === "LOSS") return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">L</Badge>;
  if (v === "D" || v === "DRAW" || v === "TIE") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">D</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function normResult(r: string | null): "W" | "L" | "D" | null {
  const v = (r || "").toUpperCase();
  if (v === "W" || v === "WIN") return "W";
  if (v === "L" || v === "LOSS") return "L";
  if (v === "D" || v === "DRAW" || v === "TIE") return "D";
  return null;
}

function HeroPill({ hero }: { hero: Hero }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1 min-w-0"
      data-testid={`pill-hero-${hero.id}`}
    >
      <Avatar className="h-6 w-6 shrink-0">
        {hero.imageUrl ? <AvatarImage src={hero.imageUrl} alt={hero.name} /> : null}
        <AvatarFallback className="text-[9px] bg-muted">
          {hero.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium truncate">{hero.name}</span>
      {hero.role && (
        <span className="text-[10px] text-muted-foreground shrink-0">{hero.role}</span>
      )}
    </div>
  );
}

function OpponentLogo({ opp, size = 10 }: { opp: { name: string; logoUrl?: string | null } | null; size?: number }) {
  const name = opp?.name || "Unknown";
  const logo = opp?.logoUrl || null;
  const sz = `h-${size} w-${size}`;
  return (
    <Avatar className={`${sz} shrink-0`}>
      {logo ? <AvatarImage src={logo} alt={name} /> : null}
      <AvatarFallback className="text-xs bg-muted">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function GroupedCompCard({
  group, side, fullSlug,
}: { group: GroupedComp; side: Side; fullSlug: string }) {
  const [open, setOpen] = useState(false);
  const total = group.wins + group.losses + group.draws;
  const wr = total > 0 ? (group.wins / total) * 100 : 0;
  return (
    <Card data-testid={`card-grouped-${side}-${group.key}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
              {group.heroes.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No heroes recorded</span>
              ) : group.heroes.map(h => <HeroPill key={h.id} hero={h} />)}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs tabular-nums" data-testid={`badge-plays-${group.key}`}>
                {group.plays.length} {group.plays.length === 1 ? "play" : "plays"}
              </Badge>
              {total > 0 && (
                <Badge
                  variant="outline"
                  className={`text-xs tabular-nums ${
                    wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                    wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                    "bg-red-500/15 text-red-700 dark:text-red-300"
                  }`}
                  data-testid={`badge-wr-${group.key}`}
                >
                  {group.wins}-{group.losses}{group.draws ? `-${group.draws}` : ""} · {wr.toFixed(0)}%
                </Badge>
              )}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid={`button-toggle-comp-${group.key}`}
                  aria-label={open ? "Hide games" : "Show games"}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-1.5">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide pt-1">
              Played in {group.plays.length} {group.plays.length === 1 ? "game" : "games"}
            </div>
            {group.plays.map(p => {
              const dateStr = p.date ? new Date(p.date).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
              }) : "—";
              return (
                <div
                  key={p.matchId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card flex-wrap"
                  data-testid={`row-play-${p.matchId}`}
                >
                  {resultBadge(p.result)}
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                      <span data-testid={`text-play-date-${p.matchId}`}>{dateStr}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">{p.gameCode}</Badge>
                    {p.modeName && <Badge variant="secondary" className="text-[10px]">{p.modeName}</Badge>}
                    {p.mapName && <Badge variant="outline" className="text-[10px]">{p.mapName}</Badge>}
                    {p.subType && <Badge variant="secondary" className="text-[10px]">{p.subType}</Badge>}
                  </div>
                  {p.eventId && (
                    <Button asChild size="sm" variant="ghost" data-testid={`button-open-event-${p.matchId}`}>
                      <Link href={`/${fullSlug}/events/${p.eventId}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function TeamComps() {
  const { hasPermission } = useAuth();
  const { gameId, rosterId, fullSlug, currentRoster } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const canView = hasPermission("view_statistics");

  // Detail view state
  const [selectedOpponentKey, setSelectedOpponentKey] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("ours");
  const [opponentSearch, setOpponentSearch] = useState("");
  const [opponentsPage, setOpponentsPage] = useState(1);
  const [groupsPage, setGroupsPage] = useState(1);

  // Detail filters
  const [subTypeFilter, setSubTypeFilter] = useState<string>("__all__");
  const [resultFilter, setResultFilter] = useState<string>("__all__");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: events = [], isLoading: evLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: games = [], isLoading: gLoading } = useQuery<Game[]>({
    queryKey: ["/api/games", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: gameHeroRows = [], isLoading: ghLoading } = useQuery<GameHero[]>({
    queryKey: ["/api/game-heroes", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: opponentPlayers = [] } = useQuery<OpponentPlayer[]>({
    queryKey: ["/api/opponent-players", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes", { gameId, rosterId }], enabled: rosterReady,
  });

  const isLoading = evLoading || gLoading || ghLoading;

  const heroById = useMemo(() => new Map(heroes.map(h => [h.id, h])), [heroes]);
  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const oppPlayerById = useMemo(() => new Map(opponentPlayers.map(p => [p.id, p])), [opponentPlayers]);
  const opponentById = useMemo(() => new Map(opponents.map(o => [o.id, o])), [opponents]);
  const opponentByLowerName = useMemo(() => {
    const m = new Map<string, Opponent>();
    opponents.forEach(o => m.set((o.name || "").toLowerCase(), o));
    return m;
  }, [opponents]);
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const mapById = useMemo(() => new Map(maps.map(m => [m.id, m])), [maps]);
  const modeById = useMemo(() => new Map(gameModes.map(m => [m.id, m])), [gameModes]);

  const subTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => { if (e.eventSubType) set.add(e.eventSubType); });
    return Array.from(set).sort();
  }, [events]);

  // Build per-game enriched plays with opponent resolution
  const allPlays: (GamePlay & { opponent: Opponent | null; syntheticName: string; syntheticKey: string })[] = useMemo(() => {
    if (!games.length) return [];

    const heroByMatchAndPlayer = new Map<string, Hero[]>();
    const heroByMatchAndOppPlayer = new Map<string, Hero[]>();
    for (const r of gameHeroRows) {
      const hero = heroById.get(r.heroId);
      if (!hero) continue;
      if (r.playerId) {
        const k = `${r.matchId}::${r.playerId}`;
        const list = heroByMatchAndPlayer.get(k) || [];
        if (!list.find(h => h.id === hero.id)) list.push(hero);
        heroByMatchAndPlayer.set(k, list);
      } else if (r.opponentPlayerId) {
        const k = `${r.matchId}::${r.opponentPlayerId}`;
        const list = heroByMatchAndOppPlayer.get(k) || [];
        if (!list.find(h => h.id === hero.id)) list.push(hero);
        heroByMatchAndOppPlayer.set(k, list);
      }
    }
    const matchIdsWithHeroes = new Set<string>();
    gameHeroRows.forEach(r => matchIdsWithHeroes.add(r.matchId));

    const out: (GamePlay & { opponent: Opponent | null; syntheticName: string; syntheticKey: string })[] = [];
    for (const g of games) {
      if (!matchIdsWithHeroes.has(g.id)) continue;
      const ev = g.eventId ? eventById.get(g.eventId) : undefined;

      let resolvedOpp: Opponent | null = null;
      if (g.opponentId) resolvedOpp = opponentById.get(g.opponentId) || null;
      if (!resolvedOpp && ev?.opponentId) resolvedOpp = opponentById.get(ev.opponentId) || null;
      if (!resolvedOpp && ev?.opponentName) {
        resolvedOpp = opponentByLowerName.get(ev.opponentName.toLowerCase()) || null;
      }
      const syntheticName = resolvedOpp?.name || ev?.opponentName || "Unknown";
      const syntheticKey = resolvedOpp?.id || `name:${syntheticName.toLowerCase()}`;

      const ourPlayerIds = new Set<string>();
      const oppPlayerIds = new Set<string>();
      gameHeroRows.forEach(r => {
        if (r.matchId !== g.id) return;
        if (r.playerId) ourPlayerIds.add(r.playerId);
        if (r.opponentPlayerId) oppPlayerIds.add(r.opponentPlayerId);
      });

      const ourSlots: CompSlot[] = [];
      ourPlayerIds.forEach(pid => {
        const p = playerById.get(pid);
        if (!p) return;
        ourSlots.push({
          participantId: p.id,
          participantName: p.name,
          heroes: heroByMatchAndPlayer.get(`${g.id}::${p.id}`) || [],
        });
      });
      ourSlots.sort((a, b) => a.participantName.localeCompare(b.participantName));

      const oppSlots: CompSlot[] = [];
      oppPlayerIds.forEach(opid => {
        const op = oppPlayerById.get(opid);
        if (!op) return;
        oppSlots.push({
          participantId: op.id,
          participantName: op.name,
          heroes: heroByMatchAndOppPlayer.get(`${g.id}::${op.id}`) || [],
        });
      });
      oppSlots.sort((a, b) => a.participantName.localeCompare(b.participantName));

      out.push({
        matchId: g.id,
        eventId: g.eventId,
        date: ev?.date || "",
        subType: ev?.eventSubType || null,
        result: g.result || null,
        gameCode: g.gameCode,
        mapName: g.mapId ? (mapById.get(g.mapId)?.name || null) : null,
        modeName: g.gameModeId ? (modeById.get(g.gameModeId)?.name || null) : null,
        ourSlots,
        oppSlots,
        opponent: resolvedOpp,
        syntheticName,
        syntheticKey,
      });
    }
    return out;
  }, [games, gameHeroRows, heroById, playerById, oppPlayerById, opponentById, opponentByLowerName, eventById, mapById, modeById]);

  // Build opponent summary list (for landing grid)
  const opponentSummaries: OpponentSummary[] = useMemo(() => {
    const map = new Map<string, OpponentSummary>();
    for (const p of allPlays) {
      let s = map.get(p.syntheticKey);
      if (!s) {
        s = {
          opponent: p.opponent,
          syntheticName: p.syntheticName,
          syntheticKey: p.syntheticKey,
          matches: 0, wins: 0, losses: 0, draws: 0,
        };
        map.set(p.syntheticKey, s);
      }
      s.matches++;
      const r = normResult(p.result);
      if (r === "W") s.wins++;
      else if (r === "L") s.losses++;
      else if (r === "D") s.draws++;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      return a.syntheticName.localeCompare(b.syntheticName);
    });
  }, [allPlays]);

  const filteredOpponentSummaries = useMemo(() => {
    const q = opponentSearch.trim().toLowerCase();
    if (!q) return opponentSummaries;
    return opponentSummaries.filter(s => s.syntheticName.toLowerCase().includes(q));
  }, [opponentSummaries, opponentSearch]);

  // Selected opponent's plays (with detail filters applied)
  const selectedSummary = useMemo(
    () => opponentSummaries.find(s => s.syntheticKey === selectedOpponentKey) || null,
    [opponentSummaries, selectedOpponentKey],
  );

  const opponentPlays = useMemo(() => {
    if (!selectedOpponentKey) return [];
    return allPlays.filter(p => p.syntheticKey === selectedOpponentKey).filter(p => {
      if (subTypeFilter !== "__all__" && (p.subType || "") !== subTypeFilter) return false;
      if (resultFilter !== "__all__" && normResult(p.result) !== resultFilter) return false;
      if (dateFrom && (p.date || "") < dateFrom) return false;
      if (dateTo && (p.date || "") > dateTo) return false;
      return true;
    });
  }, [allPlays, selectedOpponentKey, subTypeFilter, resultFilter, dateFrom, dateTo]);

  // Group selected opponent plays by sorted hero IDs per side
  const groupedComps: GroupedComp[] = useMemo(() => {
    const groups = new Map<string, GroupedComp>();
    for (const play of opponentPlays) {
      const slots = side === "ours" ? play.ourSlots : play.oppSlots;
      const heroIds = new Set<string>();
      slots.forEach(s => s.heroes.forEach(h => heroIds.add(h.id)));
      if (heroIds.size === 0) continue;
      const sortedIds = Array.from(heroIds).sort();
      const key = sortedIds.join("|");
      let g = groups.get(key);
      if (!g) {
        const heroObjs = sortedIds.map(id => heroById.get(id)).filter((h): h is Hero => !!h);
        heroObjs.sort((a, b) => a.name.localeCompare(b.name));
        g = { key, heroes: heroObjs, plays: [], wins: 0, losses: 0, draws: 0 };
        groups.set(key, g);
      }
      g.plays.push(play);
      // Result is from our POV; flip for opponent comp WR so "wins" = times opp won
      const r = normResult(play.result);
      const eff = side === "ours" ? r : (r === "W" ? "L" : r === "L" ? "W" : r);
      if (eff === "W") g.wins++;
      else if (eff === "L") g.losses++;
      else if (eff === "D") g.draws++;
    }
    // Sort groups by play count desc; then most recent play; then hero count
    const arr = Array.from(groups.values());
    arr.forEach(g => g.plays.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    arr.sort((a, b) => {
      if (b.plays.length !== a.plays.length) return b.plays.length - a.plays.length;
      return (b.plays[0]?.date || "").localeCompare(a.plays[0]?.date || "");
    });
    return arr;
  }, [opponentPlays, side, heroById]);

  if (!canView) return <AccessDenied />;
  if (!rosterReady) return <StatsSkeleton />;

  // Reset detail page when opponent or side changes
  const selectOpponent = (key: string | null) => {
    setSelectedOpponentKey(key);
    setGroupsPage(1);
    setSubTypeFilter("__all__");
    setResultFilter("__all__");
    setDateFrom("");
    setDateTo("");
    setSide("ours");
  };

  // ---- Landing view: opponent grid ----
  if (!selectedOpponentKey) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto" data-testid="page-team-comps">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Layers className="h-6 w-6" />
              Team Comps by Opponent
            </h1>
            <p className="text-sm text-muted-foreground">
              Pick an opponent to view our comps used against them and their comps used against us.
              {currentRoster ? ` — ${currentRoster.name}` : ""}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search opponents…"
                value={opponentSearch}
                onChange={e => { setOpponentSearch(e.target.value); setOpponentsPage(1); }}
                data-testid="input-opponent-search"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <StatsSkeleton />
        ) : opponentSummaries.length === 0 ? (
          <Card data-testid="empty-no-hero-data">
            <CardContent className="py-12 text-center">
              <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm font-medium">No hero data yet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Add heroes in the Match Stats editor to start building comp history.
              </div>
            </CardContent>
          </Card>
        ) : filteredOpponentSummaries.length === 0 ? (
          <Card data-testid="empty-no-match">
            <CardContent className="py-10 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm">No opponents match "{opponentSearch}".</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginate(filteredOpponentSummaries, opponentsPage).map(s => {
                const total = s.wins + s.losses + s.draws;
                const wr = total > 0 ? (s.wins / total) * 100 : 0;
                return (
                  <Card
                    key={s.syntheticKey}
                    className="hover-elevate active-elevate-2 cursor-pointer"
                    onClick={() => selectOpponent(s.syntheticKey)}
                    data-testid={`card-opponent-${s.syntheticKey}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <OpponentLogo opp={s.opponent ?? { name: s.syntheticName }} size={12} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate" data-testid={`text-opp-name-${s.syntheticKey}`}>
                            {s.syntheticName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] tabular-nums">
                              {s.matches} {s.matches === 1 ? "game" : "games"}
                            </Badge>
                            {total > 0 && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] tabular-nums ${
                                  wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                                  wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                                  "bg-red-500/15 text-red-700 dark:text-red-300"
                                }`}
                              >
                                {s.wins}-{s.losses}{s.draws ? `-${s.draws}` : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Paginator
              page={opponentsPage}
              total={filteredOpponentSummaries.length}
              onPageChange={setOpponentsPage}
              testId="opponents"
            />
          </div>
        )}
      </div>
    );
  }

  // ---- Detail view: selected opponent ----
  const total = selectedSummary ? selectedSummary.wins + selectedSummary.losses + selectedSummary.draws : 0;
  const wr = total > 0 && selectedSummary ? (selectedSummary.wins / total) * 100 : 0;
  const filtersActive =
    subTypeFilter !== "__all__" || resultFilter !== "__all__" || !!dateFrom || !!dateTo;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto" data-testid="page-team-comps-detail">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="icon"
          onClick={() => selectOpponent(null)}
          data-testid="button-back-opponents"
          aria-label="Back to opponents"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <OpponentLogo opp={selectedSummary?.opponent ?? { name: selectedSummary?.syntheticName || "" }} size={12} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold truncate" data-testid="text-detail-opp-name">
            vs {selectedSummary?.syntheticName || "Unknown"}
          </h1>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>{selectedSummary?.matches || 0} {selectedSummary?.matches === 1 ? "game" : "games"}</span>
            {total > 0 && selectedSummary && (
              <Badge
                variant="outline"
                className={`text-xs tabular-nums ${
                  wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                  wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                  "bg-red-500/15 text-red-700 dark:text-red-300"
                }`}
              >
                <Trophy className="h-3 w-3 mr-1" />
                {selectedSummary.wins}-{selectedSummary.losses}{selectedSummary.draws ? `-${selectedSummary.draws}` : ""} · {wr.toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  setSubTypeFilter("__all__"); setResultFilter("__all__");
                  setDateFrom(""); setDateTo(""); setGroupsPage(1);
                }}
                data-testid="button-clear-filters"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select value={subTypeFilter} onValueChange={(v) => { setSubTypeFilter(v); setGroupsPage(1); }}>
              <SelectTrigger data-testid="select-subtype"><SelectValue placeholder="Sub type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sub types</SelectItem>
                {subTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setGroupsPage(1); }}>
              <SelectTrigger data-testid="select-result"><SelectValue placeholder="Result" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any result</SelectItem>
                <SelectItem value="W">Win</SelectItem>
                <SelectItem value="L">Loss</SelectItem>
                <SelectItem value="D">Draw</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setGroupsPage(1); }}
              aria-label="Date from" data-testid="input-date-from"
            />
            <Input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setGroupsPage(1); }}
              aria-label="Date to" data-testid="input-date-to"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={side} onValueChange={(v) => { setSide(v as Side); setGroupsPage(1); }}>
        <TabsList>
          <TabsTrigger value="ours" data-testid="tab-ours">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Our Comps vs {selectedSummary?.syntheticName}
          </TabsTrigger>
          <TabsTrigger value="opponents" data-testid="tab-opponents">
            <Swords className="h-3.5 w-3.5 mr-1.5" /> Their Comps vs Us
          </TabsTrigger>
        </TabsList>

        <TabsContent value={side} className="mt-3 space-y-3">
          {isLoading ? (
            <StatsSkeleton />
          ) : opponentPlays.length === 0 ? (
            <Card data-testid="empty-no-plays">
              <CardContent className="py-10 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm">No games match the current filters.</div>
              </CardContent>
            </Card>
          ) : groupedComps.length === 0 ? (
            <Card data-testid="empty-no-side-data">
              <CardContent className="py-10 text-center">
                <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm">
                  No {side === "ours" ? "team" : "opponent"} hero data recorded for this opponent.
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                {groupedComps.length} unique comp{groupedComps.length === 1 ? "" : "s"} across {opponentPlays.length} game{opponentPlays.length === 1 ? "" : "s"}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {paginate(groupedComps, groupsPage).map(g => (
                  <GroupedCompCard key={g.key} group={g} side={side} fullSlug={fullSlug || ""} />
                ))}
              </div>
              <Paginator
                page={groupsPage}
                total={groupedComps.length}
                onPageChange={setGroupsPage}
                testId="grouped-comps"
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
