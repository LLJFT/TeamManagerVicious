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
import {
  Layers, Users, Shield, ExternalLink, Filter, X, Calendar as CalendarIcon,
  Swords, Target, Trophy,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import type {
  Event, Game, Hero, Opponent, OpponentPlayer, Player, GameHero,
} from "@shared/schema";

type Side = "ours" | "opponents";

interface CompSlot {
  participantId: string;
  participantName: string;
  isOurs: boolean;
  heroes: Hero[];
}

interface Comp {
  matchId: string;
  eventId: string | null;
  date: string;
  subType: string | null;
  result: string | null;
  gameCode: string;
  opponentId: string | null;
  opponentName: string;
  opponentLogoUrl: string | null;
  ourSlots: CompSlot[];
  oppSlots: CompSlot[];
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

function SlotRow({ slot }: { slot: CompSlot }) {
  return (
    <div className="flex items-start gap-2 py-1" data-testid={`row-slot-${slot.participantId}`}>
      <div className="w-28 shrink-0">
        <div className="text-xs font-medium truncate" data-testid={`text-participant-${slot.participantId}`}>
          {slot.participantName}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 min-w-0 flex-1">
        {slot.heroes.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">No heroes recorded</span>
        ) : (
          slot.heroes.map(h => <HeroPill key={h.id} hero={h} />)
        )}
      </div>
    </div>
  );
}

function CompCard({ comp, side, fullSlug }: { comp: Comp; side: Side; fullSlug: string }) {
  const slots = side === "ours" ? comp.ourSlots : comp.oppSlots;
  const dateStr = comp.date ? new Date(comp.date).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  }) : "—";

  return (
    <Card className="hover-elevate" data-testid={`card-comp-${comp.matchId}-${side}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {comp.opponentLogoUrl ? (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={comp.opponentLogoUrl} alt={comp.opponentName} />
                  <AvatarFallback className="text-[10px] bg-muted">
                    {comp.opponentName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <CardTitle className="text-sm" data-testid={`text-opponent-${comp.matchId}`}>
                vs {comp.opponentName}
              </CardTitle>
              {resultBadge(comp.result)}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                <span data-testid={`text-date-${comp.matchId}`}>{dateStr}</span>
              </span>
              <Badge variant="outline" className="text-[10px]">{comp.gameCode}</Badge>
              {comp.subType && (
                <Badge variant="secondary" className="text-[10px]" data-testid={`badge-subtype-${comp.matchId}`}>
                  {comp.subType}
                </Badge>
              )}
            </div>
          </div>
          {comp.eventId && (
            <Button asChild size="sm" variant="ghost" data-testid={`button-open-event-${comp.matchId}`}>
              <Link href={`/${fullSlug}/events/${comp.eventId}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {slots.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No {side === "ours" ? "team" : "opponent"} hero data for this game.</div>
        ) : (
          slots.map(s => <SlotRow key={s.participantId} slot={s} />)
        )}
      </CardContent>
    </Card>
  );
}

export default function TeamComps() {
  const { hasPermission } = useAuth();
  const { gameId, rosterId, fullSlug, currentRoster } = useGame();
  const rosterReady = !!(gameId && rosterId);

  const canView = hasPermission("view_statistics");

  const [tab, setTab] = useState<Side>("ours");
  const [subTypeFilter, setSubTypeFilter] = useState<string>("__all__");
  const [opponentFilter, setOpponentFilter] = useState<string>("__all__");
  const [heroFilter, setHeroFilter] = useState<string>("__all__");
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

  const subTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => { if (e.eventSubType) set.add(e.eventSubType); });
    return Array.from(set).sort();
  }, [events]);

  // Build comps grouped by matchId
  const comps: Comp[] = useMemo(() => {
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

    const out: Comp[] = [];
    for (const g of games) {
      if (!matchIdsWithHeroes.has(g.id)) continue;
      const ev = g.eventId ? eventById.get(g.eventId) : undefined;

      // Resolve opponent via 3-way fallback
      let resolvedOpp: Opponent | undefined;
      if (g.opponentId) resolvedOpp = opponentById.get(g.opponentId);
      if (!resolvedOpp && ev?.opponentId) resolvedOpp = opponentById.get(ev.opponentId);
      if (!resolvedOpp && ev?.opponentName) {
        resolvedOpp = opponentByLowerName.get(ev.opponentName.toLowerCase());
      }
      const opponentName = resolvedOpp?.name || ev?.opponentName || "Unknown";

      // Build slots for our side
      const ourSlots: CompSlot[] = [];
      const ourPlayerIdsInMatch = new Set<string>();
      gameHeroRows.forEach(r => {
        if (r.matchId === g.id && r.playerId) ourPlayerIdsInMatch.add(r.playerId);
      });
      for (const pid of ourPlayerIdsInMatch) {
        const p = playerById.get(pid);
        if (!p) continue;
        ourSlots.push({
          participantId: p.id,
          participantName: p.name,
          isOurs: true,
          heroes: heroByMatchAndPlayer.get(`${g.id}::${p.id}`) || [],
        });
      }
      ourSlots.sort((a, b) => a.participantName.localeCompare(b.participantName));

      // Opponent side
      const oppSlots: CompSlot[] = [];
      const oppPlayerIdsInMatch = new Set<string>();
      gameHeroRows.forEach(r => {
        if (r.matchId === g.id && r.opponentPlayerId) oppPlayerIdsInMatch.add(r.opponentPlayerId);
      });
      for (const opid of oppPlayerIdsInMatch) {
        const op = oppPlayerById.get(opid);
        if (!op) continue;
        oppSlots.push({
          participantId: op.id,
          participantName: op.name,
          isOurs: false,
          heroes: heroByMatchAndOppPlayer.get(`${g.id}::${op.id}`) || [],
        });
      }
      oppSlots.sort((a, b) => a.participantName.localeCompare(b.participantName));

      out.push({
        matchId: g.id,
        eventId: g.eventId,
        date: ev?.date || "",
        subType: ev?.eventSubType || null,
        result: g.result || null,
        gameCode: g.gameCode,
        opponentId: resolvedOpp?.id || g.opponentId || ev?.opponentId || null,
        opponentName,
        opponentLogoUrl: resolvedOpp?.logoUrl || null,
        ourSlots,
        oppSlots,
      });
    }
    out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return out;
  }, [games, gameHeroRows, heroById, playerById, oppPlayerById, opponentById, opponentByLowerName, eventById]);

  const filteredComps = useMemo(() => {
    return comps.filter(c => {
      if (subTypeFilter !== "__all__" && (c.subType || "") !== subTypeFilter) return false;
      if (opponentFilter !== "__all__") {
        const matches = c.opponentId === opponentFilter ||
          (c.opponentName.toLowerCase() === (opponentById.get(opponentFilter)?.name || "").toLowerCase());
        if (!matches) return false;
      }
      if (resultFilter !== "__all__") {
        if (normResult(c.result) !== resultFilter) return false;
      }
      if (dateFrom && (c.date || "") < dateFrom) return false;
      if (dateTo && (c.date || "") > dateTo) return false;
      if (heroFilter !== "__all__") {
        const slots = tab === "ours" ? c.ourSlots : c.oppSlots;
        const has = slots.some(s => s.heroes.some(h => h.id === heroFilter));
        if (!has) return false;
      }
      // Hide cards on the active tab if that side has no hero data at all.
      const sideSlots = tab === "ours" ? c.ourSlots : c.oppSlots;
      const sideHasAny = sideSlots.some(s => s.heroes.length > 0);
      if (!sideHasAny) return false;
      return true;
    });
  }, [comps, subTypeFilter, opponentFilter, resultFilter, dateFrom, dateTo, heroFilter, tab, opponentById]);

  const filtersActive =
    subTypeFilter !== "__all__" || opponentFilter !== "__all__" || heroFilter !== "__all__" ||
    resultFilter !== "__all__" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setSubTypeFilter("__all__"); setOpponentFilter("__all__"); setHeroFilter("__all__");
    setResultFilter("__all__"); setDateFrom(""); setDateTo("");
  };

  if (!canView) return <AccessDenied />;
  if (!rosterReady) return <StatsSkeleton />;

  const totalAnyHero = comps.length;
  const showEmpty = !isLoading && totalAnyHero === 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto" data-testid="page-team-comps">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Team Comps
          </h1>
          <p className="text-sm text-muted-foreground">
            Hero lineups per game{currentRoster ? ` — ${currentRoster.name}` : ""}.
          </p>
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
            <X className="h-3.5 w-3.5 mr-1" /> Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            <Select value={subTypeFilter} onValueChange={setSubTypeFilter}>
              <SelectTrigger data-testid="select-subtype"><SelectValue placeholder="Sub type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sub types</SelectItem>
                {subTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={opponentFilter} onValueChange={setOpponentFilter}>
              <SelectTrigger data-testid="select-opponent"><SelectValue placeholder="Opponent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All opponents</SelectItem>
                {opponents.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={heroFilter} onValueChange={setHeroFilter}>
              <SelectTrigger data-testid="select-hero"><SelectValue placeholder="Hero" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any hero</SelectItem>
                {heroes.filter(h => h.isActive).slice().sort((a, b) => a.name.localeCompare(b.name)).map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger data-testid="select-result"><SelectValue placeholder="Result" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any result</SelectItem>
                <SelectItem value="W">Win</SelectItem>
                <SelectItem value="L">Loss</SelectItem>
                <SelectItem value="D">Draw</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              placeholder="From" aria-label="Date from" data-testid="input-date-from"
            />
            <Input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              placeholder="To" aria-label="Date to" data-testid="input-date-to"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={v => setTab(v as Side)}>
        <TabsList>
          <TabsTrigger value="ours" data-testid="tab-ours">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Our Comps
          </TabsTrigger>
          <TabsTrigger value="opponents" data-testid="tab-opponents">
            <Swords className="h-3.5 w-3.5 mr-1.5" /> Opponent Comps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ours" className="mt-3">
          {isLoading ? (
            <StatsSkeleton />
          ) : showEmpty ? (
            <EmptyState />
          ) : filteredComps.length === 0 ? (
            <NoMatchState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredComps.map(c => (
                <CompCard key={`${c.matchId}-ours`} comp={c} side="ours" fullSlug={fullSlug || ""} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="opponents" className="mt-3">
          {isLoading ? (
            <StatsSkeleton />
          ) : showEmpty ? (
            <EmptyState />
          ) : filteredComps.length === 0 ? (
            <NoMatchState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredComps.map(c => (
                <CompCard key={`${c.matchId}-opp`} comp={c} side="opponents" fullSlug={fullSlug || ""} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <Card data-testid="empty-no-hero-data">
      <CardContent className="py-12 text-center">
        <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <div className="text-sm font-medium">No hero data yet</div>
        <div className="text-xs text-muted-foreground mt-1">
          Add heroes in the Match Stats editor to start building comp history.
        </div>
      </CardContent>
    </Card>
  );
}

function NoMatchState() {
  return (
    <Card data-testid="empty-no-match">
      <CardContent className="py-10 text-center">
        <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <div className="text-sm">No comps match the current filters.</div>
      </CardContent>
    </Card>
  );
}
