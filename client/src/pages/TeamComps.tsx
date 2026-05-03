import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  Swords, Target, ArrowLeft, ChevronDown, ChevronUp, Search, Trophy, Grid3x3,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import { Paginator, paginate } from "@/components/Paginator";
import type {
  Event, Game, Hero, Opponent, OpponentPlayer, Player, GameHero, Map as MapType, GameMode, EventSubType,
} from "@shared/schema";

type Mode = "ours" | "opponents" | "ours-matchups" | "opponents-matchups" | "h2h";

interface PerGame {
  matchId: string;
  eventId: string | null;
  date: string;
  subType: string | null; // human-readable name (resolved)
  result: string | null;
  gameCode: string;
  mapName: string | null;
  modeName: string | null;
  ourHeroes: Hero[];
  oppHeroes: Hero[];
  ourKey: string; // sorted hero ids joined; "" if no heroes
  oppKey: string;
}

interface GroupedComp {
  key: string;
  heroes: Hero[];
  plays: PerGame[];
  wins: number;
  losses: number;
  draws: number;
}

interface Matchup {
  primaryKey: string;
  primaryHeroes: Hero[];
  primaryPlays: number;
  primaryWins: number;
  primaryLosses: number;
  primaryDraws: number;
  vsList: {
    opposingKey: string;
    opposingHeroes: Hero[];
    plays: PerGame[];
    wins: number;
    losses: number;
    draws: number;
  }[];
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

function wrTone(wr: number) {
  if (wr >= 60) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (wr >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-red-500/15 text-red-700 dark:text-red-300";
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

function HeroPillRow({ heroes }: { heroes: Hero[] }) {
  if (heroes.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No heroes recorded</span>;
  }
  return <div className="flex flex-wrap gap-1.5 min-w-0">{heroes.map(h => <HeroPill key={h.id} hero={h} />)}</div>;
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

function WrBadge({ wins, losses, draws, testId }: { wins: number; losses: number; draws: number; testId?: string }) {
  const total = wins + losses + draws;
  if (total === 0) return null;
  const wr = (wins / total) * 100;
  return (
    <Badge variant="outline" className={`text-xs tabular-nums ${wrTone(wr)}`} data-testid={testId}>
      {wins}-{losses}{draws ? `-${draws}` : ""} · {wr.toFixed(0)}%
    </Badge>
  );
}

function PlayRow({ p, fullSlug }: { p: PerGame; fullSlug: string }) {
  const dateStr = p.date ? new Date(p.date).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  }) : "—";
  return (
    <div
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
}

function GroupedCompCard({
  group, side, fullSlug,
}: { group: GroupedComp; side: "ours" | "opponents"; fullSlug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card data-testid={`card-grouped-${side}-${group.key}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0"><HeroPillRow heroes={group.heroes} /></div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs tabular-nums" data-testid={`badge-plays-${group.key}`}>
                {group.plays.length} {group.plays.length === 1 ? "play" : "plays"}
              </Badge>
              <WrBadge wins={group.wins} losses={group.losses} draws={group.draws} testId={`badge-wr-${group.key}`} />
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
            {group.plays.map(p => <PlayRow key={p.matchId} p={p} fullSlug={fullSlug} />)}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function MatchupVsRow({
  vs, primarySide, fullSlug,
}: {
  vs: Matchup["vsList"][number];
  primarySide: "ours" | "opponents";
  fullSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const opposingSideLabel = primarySide === "ours" ? "their" : "our";
  return (
    <div
      className="rounded border border-border bg-card"
      data-testid={`row-matchup-vs-${vs.opposingKey || "unknown"}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
            vs {opposingSideLabel}
          </span>
          <div className="flex-1 min-w-0">
            <HeroPillRow heroes={vs.opposingHeroes} />
          </div>
          <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
            {vs.plays.length} {vs.plays.length === 1 ? "game" : "games"}
          </Badge>
          <WrBadge wins={vs.wins} losses={vs.losses} draws={vs.draws} />
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              data-testid={`button-toggle-matchup-vs-${vs.opposingKey || "unknown"}`}
              aria-label={open ? "Hide games" : "Show games"}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="px-2 pb-2 space-y-1.5">
            {vs.plays.map(p => <PlayRow key={p.matchId} p={p} fullSlug={fullSlug} />)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function MatchupCard({
  matchup, primarySide, fullSlug,
}: { matchup: Matchup; primarySide: "ours" | "opponents"; fullSlug: string }) {
  const [open, setOpen] = useState(true);
  const ownerLabel = primarySide === "ours" ? "Our comp" : "Their comp";
  return (
    <Card data-testid={`card-matchup-${primarySide}-${matchup.primaryKey}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{ownerLabel}</div>
              <HeroPillRow heroes={matchup.primaryHeroes} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs tabular-nums">
                {matchup.primaryPlays} {matchup.primaryPlays === 1 ? "play" : "plays"}
              </Badge>
              <WrBadge
                wins={matchup.primaryWins}
                losses={matchup.primaryLosses}
                draws={matchup.primaryDraws}
              />
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid={`button-toggle-matchup-${matchup.primaryKey}`}
                  aria-label={open ? "Hide matchups" : "Show matchups"}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {matchup.vsList.length} unique opposing comp{matchup.vsList.length === 1 ? "" : "s"}
            </div>
            {matchup.vsList.map(vs => (
              <MatchupVsRow
                key={vs.opposingKey || "unknown"}
                vs={vs}
                primarySide={primarySide}
                fullSlug={fullSlug}
              />
            ))}
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

  const [selectedOpponentKey, setSelectedOpponentKey] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ours");
  const [opponentSearch, setOpponentSearch] = useState("");
  const [opponentsPage, setOpponentsPage] = useState(1);
  const [groupsPage, setGroupsPage] = useState(1);

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
  const { data: eventSubTypeDefs = [] } = useQuery<EventSubType[]>({
    queryKey: ["/api/event-sub-types", { gameId, rosterId }], enabled: rosterReady,
  });

  const isLoading = evLoading || gLoading || ghLoading;

  const heroById = useMemo(() => new Map(heroes.map(h => [h.id, h])), [heroes]);
  const opponentById = useMemo(() => new Map(opponents.map(o => [o.id, o])), [opponents]);
  const opponentByLowerName = useMemo(() => {
    const m = new Map<string, Opponent>();
    opponents.forEach(o => m.set((o.name || "").toLowerCase(), o));
    return m;
  }, [opponents]);
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const mapById = useMemo(() => new Map(maps.map(m => [m.id, m])), [maps]);
  const modeById = useMemo(() => new Map(gameModes.map(m => [m.id, m])), [gameModes]);

  // Sub-type name resolver — events.eventSubType is a free-text field that
  // sometimes stores the EventSubType.id (UUID) and sometimes the literal name.
  // Always render the human-readable name when we can resolve it.
  const subTypeNameById = useMemo(() => {
    const m = new Map<string, string>();
    eventSubTypeDefs.forEach(s => m.set(s.id, s.name));
    return m;
  }, [eventSubTypeDefs]);
  const resolveSubTypeName = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    return subTypeNameById.get(raw) || raw;
  };

  // Build per-game enriched plays with opponent resolution + ourKey/oppKey
  const allPlays: (PerGame & { opponent: Opponent | null; syntheticName: string; syntheticKey: string })[] = useMemo(() => {
    if (!games.length) return [];

    const ourHeroByMatch = new Map<string, Map<string, Hero>>();
    const oppHeroByMatch = new Map<string, Map<string, Hero>>();
    for (const r of gameHeroRows) {
      const hero = heroById.get(r.heroId);
      if (!hero) continue;
      if (r.playerId) {
        const m = ourHeroByMatch.get(r.matchId) || new Map();
        m.set(hero.id, hero);
        ourHeroByMatch.set(r.matchId, m);
      } else if (r.opponentPlayerId) {
        const m = oppHeroByMatch.get(r.matchId) || new Map();
        m.set(hero.id, hero);
        oppHeroByMatch.set(r.matchId, m);
      }
    }
    const matchIdsWithHeroes = new Set<string>(gameHeroRows.map(r => r.matchId));

    const out: (PerGame & { opponent: Opponent | null; syntheticName: string; syntheticKey: string })[] = [];
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

      const ourHeroesArr = Array.from((ourHeroByMatch.get(g.id) || new Map<string, Hero>()).values())
        .sort((a, b) => a.name.localeCompare(b.name));
      const oppHeroesArr = Array.from((oppHeroByMatch.get(g.id) || new Map<string, Hero>()).values())
        .sort((a, b) => a.name.localeCompare(b.name));
      const ourKey = ourHeroesArr.map(h => h.id).sort().join("|");
      const oppKey = oppHeroesArr.map(h => h.id).sort().join("|");

      out.push({
        matchId: g.id,
        eventId: g.eventId,
        date: ev?.date || "",
        subType: resolveSubTypeName(ev?.eventSubType ?? null),
        result: g.result || null,
        gameCode: g.gameCode,
        mapName: g.mapId ? (mapById.get(g.mapId)?.name || null) : null,
        modeName: g.gameModeId ? (modeById.get(g.gameModeId)?.name || null) : null,
        ourHeroes: ourHeroesArr,
        oppHeroes: oppHeroesArr,
        ourKey,
        oppKey,
        opponent: resolvedOpp,
        syntheticName,
        syntheticKey,
      });
    }
    return out;
  }, [games, gameHeroRows, heroById, opponentById, opponentByLowerName, eventById, mapById, modeById, subTypeNameById]);

  // Distinct sub-type filter options (resolved name + raw value pair)
  const subTypeOptions = useMemo(() => {
    const m = new Map<string, string>(); // rawValue -> displayName
    events.forEach(e => {
      if (!e.eventSubType) return;
      m.set(e.eventSubType, resolveSubTypeName(e.eventSubType) || e.eventSubType);
    });
    return Array.from(m.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [events, subTypeNameById]);

  // Opponent landing summaries
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

  const selectedSummary = useMemo(
    () => opponentSummaries.find(s => s.syntheticKey === selectedOpponentKey) || null,
    [opponentSummaries, selectedOpponentKey],
  );

  // Filtered plays for the selected opponent
  const opponentPlays = useMemo(() => {
    if (!selectedOpponentKey) return [];
    return allPlays.filter(p => p.syntheticKey === selectedOpponentKey).filter(p => {
      if (subTypeFilter !== "__all__") {
        // Match either raw value or resolved name (handles legacy data)
        const resolved = (p.subType || "").toLowerCase();
        const rawMatch = events.find(e => e.id === p.eventId)?.eventSubType || "";
        if (rawMatch !== subTypeFilter && resolved !== (resolveSubTypeName(subTypeFilter) || subTypeFilter).toLowerCase()) return false;
      }
      if (resultFilter !== "__all__" && normResult(p.result) !== resultFilter) return false;
      if (dateFrom && (p.date || "") < dateFrom) return false;
      if (dateTo && (p.date || "") > dateTo) return false;
      return true;
    });
  }, [allPlays, selectedOpponentKey, subTypeFilter, resultFilter, dateFrom, dateTo, events, subTypeNameById]);

  // Helper: group plays by hero key on a given side
  function groupComps(plays: PerGame[], side: "ours" | "opponents"): GroupedComp[] {
    const groups = new Map<string, GroupedComp>();
    for (const play of plays) {
      const key = side === "ours" ? play.ourKey : play.oppKey;
      const heroes = side === "ours" ? play.ourHeroes : play.oppHeroes;
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = { key, heroes, plays: [], wins: 0, losses: 0, draws: 0 };
        groups.set(key, g);
      }
      g.plays.push(play);
      const r = normResult(play.result);
      const eff = side === "ours" ? r : (r === "W" ? "L" : r === "L" ? "W" : r);
      if (eff === "W") g.wins++;
      else if (eff === "L") g.losses++;
      else if (eff === "D") g.draws++;
    }
    const arr = Array.from(groups.values());
    arr.forEach(g => g.plays.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    arr.sort((a, b) => {
      if (b.plays.length !== a.plays.length) return b.plays.length - a.plays.length;
      return (b.plays[0]?.date || "").localeCompare(a.plays[0]?.date || "");
    });
    return arr;
  }

  const ourGroupedComps = useMemo(() => groupComps(opponentPlays, "ours"), [opponentPlays]);
  const oppGroupedComps = useMemo(() => groupComps(opponentPlays, "opponents"), [opponentPlays]);

  // Build matchups: primary side comp -> opposing side comps with stats
  function buildMatchups(plays: PerGame[], primary: "ours" | "opponents"): Matchup[] {
    const byPrimary = new Map<string, {
      heroes: Hero[];
      vs: Map<string, { heroes: Hero[]; plays: PerGame[]; w: number; l: number; d: number }>;
      totalW: number; totalL: number; totalD: number; totalPlays: number;
    }>();
    for (const p of plays) {
      const pKey = primary === "ours" ? p.ourKey : p.oppKey;
      const pHeroes = primary === "ours" ? p.ourHeroes : p.oppHeroes;
      const oKey = primary === "ours" ? p.oppKey : p.ourKey;
      const oHeroes = primary === "ours" ? p.oppHeroes : p.ourHeroes;
      if (!pKey) continue;
      let primEntry = byPrimary.get(pKey);
      if (!primEntry) {
        primEntry = { heroes: pHeroes, vs: new Map(), totalW: 0, totalL: 0, totalD: 0, totalPlays: 0 };
        byPrimary.set(pKey, primEntry);
      }
      const r = normResult(p.result);
      const eff = primary === "ours" ? r : (r === "W" ? "L" : r === "L" ? "W" : r);
      primEntry.totalPlays++;
      if (eff === "W") primEntry.totalW++;
      else if (eff === "L") primEntry.totalL++;
      else if (eff === "D") primEntry.totalD++;

      let vsEntry = primEntry.vs.get(oKey);
      if (!vsEntry) {
        vsEntry = { heroes: oHeroes, plays: [], w: 0, l: 0, d: 0 };
        primEntry.vs.set(oKey, vsEntry);
      }
      vsEntry.plays.push(p);
      if (eff === "W") vsEntry.w++;
      else if (eff === "L") vsEntry.l++;
      else if (eff === "D") vsEntry.d++;
    }
    const out: Matchup[] = [];
    byPrimary.forEach((entry, primaryKey) => {
      const vsList = Array.from(entry.vs.entries())
        .map(([opposingKey, v]) => ({
          opposingKey,
          opposingHeroes: v.heroes,
          plays: v.plays.sort((a, b) => (b.date || "").localeCompare(a.date || "")),
          wins: v.w, losses: v.l, draws: v.d,
        }))
        .sort((a, b) => b.plays.length - a.plays.length);
      out.push({
        primaryKey,
        primaryHeroes: entry.heroes,
        primaryPlays: entry.totalPlays,
        primaryWins: entry.totalW,
        primaryLosses: entry.totalL,
        primaryDraws: entry.totalD,
        vsList,
      });
    });
    out.sort((a, b) => b.primaryPlays - a.primaryPlays);
    return out;
  }

  const ourMatchups = useMemo(() => buildMatchups(opponentPlays, "ours"), [opponentPlays]);
  const oppMatchups = useMemo(() => buildMatchups(opponentPlays, "opponents"), [opponentPlays]);

  // H2H matrix: top N our comps × top N opp comps
  const H2H_LIMIT = 8;
  const h2hMatrix = useMemo(() => {
    const ourTop = ourGroupedComps.slice(0, H2H_LIMIT);
    const oppTop = oppGroupedComps.slice(0, H2H_LIMIT);
    const cells = new Map<string, { plays: number; w: number; l: number; d: number }>();
    for (const p of opponentPlays) {
      if (!p.ourKey || !p.oppKey) continue;
      if (!ourTop.find(g => g.key === p.ourKey)) continue;
      if (!oppTop.find(g => g.key === p.oppKey)) continue;
      const k = `${p.ourKey}@@${p.oppKey}`;
      const c = cells.get(k) || { plays: 0, w: 0, l: 0, d: 0 };
      c.plays++;
      const r = normResult(p.result);
      if (r === "W") c.w++;
      else if (r === "L") c.l++;
      else if (r === "D") c.d++;
      cells.set(k, c);
    }
    return { ourTop, oppTop, cells };
  }, [ourGroupedComps, oppGroupedComps, opponentPlays]);

  if (!canView) return <AccessDenied />;
  if (!rosterReady) return <StatsSkeleton />;

  const selectOpponent = (key: string | null) => {
    setSelectedOpponentKey(key);
    setGroupsPage(1);
    setSubTypeFilter("__all__");
    setResultFilter("__all__");
    setDateFrom("");
    setDateTo("");
    setMode("ours");
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
              Pick an opponent to view comps, matchups, and head-to-head stats.
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
                              <Badge variant="outline" className={`text-[10px] tabular-nums ${wrTone(wr)}`}>
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

  // ---- Detail view ----
  const total = selectedSummary ? selectedSummary.wins + selectedSummary.losses + selectedSummary.draws : 0;
  const wr = total > 0 && selectedSummary ? (selectedSummary.wins / total) * 100 : 0;
  const filtersActive =
    subTypeFilter !== "__all__" || resultFilter !== "__all__" || !!dateFrom || !!dateTo;
  const oppName = selectedSummary?.syntheticName || "Unknown";

  // Decide which collection drives the active tab's pagination
  let activeGrouped: GroupedComp[] | null = null;
  let activeMatchups: Matchup[] | null = null;
  if (mode === "ours") activeGrouped = ourGroupedComps;
  else if (mode === "opponents") activeGrouped = oppGroupedComps;
  else if (mode === "ours-matchups") activeMatchups = ourMatchups;
  else if (mode === "opponents-matchups") activeMatchups = oppMatchups;

  const noPlays = opponentPlays.length === 0;

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
        <OpponentLogo opp={selectedSummary?.opponent ?? { name: oppName }} size={12} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold truncate" data-testid="text-detail-opp-name">
            vs {oppName}
          </h1>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>{selectedSummary?.matches || 0} {selectedSummary?.matches === 1 ? "game" : "games"}</span>
            {total > 0 && selectedSummary && (
              <Badge variant="outline" className={`text-xs tabular-nums ${wrTone(wr)}`}>
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
                {subTypeOptions.map(s => (
                  <SelectItem key={s.value} value={s.value} data-testid={`option-subtype-${s.value}`}>
                    {s.label}
                  </SelectItem>
                ))}
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

      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setGroupsPage(1); }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ours" data-testid="tab-ours">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Our Comps
          </TabsTrigger>
          <TabsTrigger value="opponents" data-testid="tab-opponents">
            <Swords className="h-3.5 w-3.5 mr-1.5" /> Their Comps
          </TabsTrigger>
          <TabsTrigger value="ours-matchups" data-testid="tab-ours-matchups">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Our Comp Matchups
          </TabsTrigger>
          <TabsTrigger value="opponents-matchups" data-testid="tab-opponents-matchups">
            <Swords className="h-3.5 w-3.5 mr-1.5" /> Their Comp Matchups
          </TabsTrigger>
          <TabsTrigger value="h2h" data-testid="tab-h2h">
            <Grid3x3 className="h-3.5 w-3.5 mr-1.5" /> Head-to-Head Matrix
          </TabsTrigger>
        </TabsList>

        {/* Our / Their grouped comps */}
        {(mode === "ours" || mode === "opponents") && (
          <TabsContent value={mode} className="mt-3 space-y-3">
            {isLoading ? (
              <StatsSkeleton />
            ) : noPlays ? (
              <Card data-testid="empty-no-plays">
                <CardContent className="py-10 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm">No games match the current filters.</div>
                </CardContent>
              </Card>
            ) : !activeGrouped || activeGrouped.length === 0 ? (
              <Card data-testid="empty-no-side-data">
                <CardContent className="py-10 text-center">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm">
                    No {mode === "ours" ? "team" : "opponent"} hero data recorded for this opponent.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {activeGrouped.length} unique comp{activeGrouped.length === 1 ? "" : "s"} across {opponentPlays.length} game{opponentPlays.length === 1 ? "" : "s"}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {paginate(activeGrouped, groupsPage).map(g => (
                    <GroupedCompCard key={g.key} group={g} side={mode === "ours" ? "ours" : "opponents"} fullSlug={fullSlug || ""} />
                  ))}
                </div>
                <Paginator
                  page={groupsPage}
                  total={activeGrouped.length}
                  onPageChange={setGroupsPage}
                  testId="grouped-comps"
                />
              </>
            )}
          </TabsContent>
        )}

        {/* Matchups (per primary side) */}
        {(mode === "ours-matchups" || mode === "opponents-matchups") && (
          <TabsContent value={mode} className="mt-3 space-y-3">
            {isLoading ? (
              <StatsSkeleton />
            ) : noPlays ? (
              <Card data-testid="empty-no-plays-matchups">
                <CardContent className="py-10 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm">No games match the current filters.</div>
                </CardContent>
              </Card>
            ) : !activeMatchups || activeMatchups.length === 0 ? (
              <Card data-testid="empty-no-matchups">
                <CardContent className="py-10 text-center">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm">
                    No matchup data for the {mode === "ours-matchups" ? "team" : "opponent"} comps yet.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {activeMatchups.length} {mode === "ours-matchups" ? "of our comps" : "of their comps"} have matchup data
                </div>
                <div className="space-y-3">
                  {paginate(activeMatchups, groupsPage).map(m => (
                    <MatchupCard
                      key={m.primaryKey}
                      matchup={m}
                      primarySide={mode === "ours-matchups" ? "ours" : "opponents"}
                      fullSlug={fullSlug || ""}
                    />
                  ))}
                </div>
                <Paginator
                  page={groupsPage}
                  total={activeMatchups.length}
                  onPageChange={setGroupsPage}
                  testId="matchups"
                />
              </>
            )}
          </TabsContent>
        )}

        {/* H2H Matrix */}
        {mode === "h2h" && (
          <TabsContent value="h2h" className="mt-3 space-y-3">
            {isLoading ? (
              <StatsSkeleton />
            ) : noPlays ? (
              <Card data-testid="empty-no-plays-h2h">
                <CardContent className="py-10 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm">No games match the current filters.</div>
                </CardContent>
              </Card>
            ) : h2hMatrix.ourTop.length === 0 || h2hMatrix.oppTop.length === 0 ? (
              <Card data-testid="empty-no-h2h">
                <CardContent className="py-10 text-center">
                  <Grid3x3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm">Need both team and opponent hero data to render the matrix.</div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="text-xs text-muted-foreground mb-3">
                    Top {h2hMatrix.ourTop.length} of our comps × Top {h2hMatrix.oppTop.length} of their comps. Each cell shows games played and our win rate.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="border-separate border-spacing-1 text-xs" data-testid="table-h2h">
                      <thead>
                        <tr>
                          <th className="text-left text-[10px] uppercase tracking-wide text-muted-foreground p-1.5 align-bottom">
                            Our \ Their
                          </th>
                          {h2hMatrix.oppTop.map(opp => (
                            <th key={opp.key} className="p-1.5 align-bottom min-w-[140px] max-w-[180px]">
                              <div className="flex flex-wrap gap-1 justify-start">
                                {opp.heroes.slice(0, 6).map(h => <HeroPill key={h.id} hero={h} />)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {h2hMatrix.ourTop.map(our => (
                          <tr key={our.key}>
                            <th className="text-left p-1.5 align-top min-w-[160px] max-w-[220px]">
                              <div className="flex flex-wrap gap-1">
                                {our.heroes.slice(0, 6).map(h => <HeroPill key={h.id} hero={h} />)}
                              </div>
                            </th>
                            {h2hMatrix.oppTop.map(opp => {
                              const cell = h2hMatrix.cells.get(`${our.key}@@${opp.key}`);
                              if (!cell || cell.plays === 0) {
                                return (
                                  <td
                                    key={opp.key}
                                    className="p-2 text-center align-middle bg-muted/30 rounded text-muted-foreground"
                                    data-testid={`cell-h2h-${our.key}-${opp.key}-empty`}
                                  >
                                    —
                                  </td>
                                );
                              }
                              const wr2 = (cell.w / cell.plays) * 100;
                              return (
                                <td
                                  key={opp.key}
                                  className={`p-2 text-center align-middle rounded ${wrTone(wr2)}`}
                                  data-testid={`cell-h2h-${our.key}-${opp.key}`}
                                >
                                  <div className="font-medium tabular-nums">{wr2.toFixed(0)}%</div>
                                  <div className="text-[10px] tabular-nums opacity-80">
                                    {cell.w}-{cell.l}{cell.d ? `-${cell.d}` : ""} · {cell.plays}g
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
