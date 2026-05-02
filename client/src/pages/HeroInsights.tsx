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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft, Swords, Ban, Trophy, ShieldAlert, Activity, UserSquare,
  Sparkles, Target, ZapOff,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import type {
  Event, Game, Hero, Opponent, Player,
  GameHero, GameHeroBanAction,
} from "@shared/schema";

function pct(n: number, d: number) {
  if (!d) return 0;
  return (n / d) * 100;
}

function wrColor(wr: number) {
  return wr >= 60 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
         wr >= 40 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
         "bg-red-500/15 text-red-700 dark:text-red-300";
}

function HeroChip({ hero }: { hero: Hero }) {
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

export default function HeroInsights() {
  const { hasPermission } = useAuth();
  const { fullSlug, gameId, rosterId } = useGame();
  const rosterReady = !!(gameId && rosterId);
  const [opponentFilter, setOpponentFilter] = useState<string>("__all__");

  const { data: events = [], isLoading: evLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: allGames = [], isLoading: gLoading } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: gameHeroRows = [], isLoading: ghLoading } = useQuery<GameHero[]>({
    queryKey: ["/api/game-heroes", { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: heroBanRows = [], isLoading: hbLoading } = useQuery<GameHeroBanAction[]>({
    queryKey: ["/api/hero-ban-actions", { gameId, rosterId }], enabled: rosterReady,
  });

  const isLoading = evLoading || gLoading || ghLoading || hbLoading;

  const heroById = useMemo(() => {
    const m = new Map<string, Hero>();
    heroes.forEach(h => m.set(h.id, h));
    return m;
  }, [heroes]);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const playerIds = useMemo(() => new Set(players.map(p => p.id)), [players]);

  const scopedGames = useMemo(() => {
    if (opponentFilter === "__all__") return allGames;
    return allGames.filter(g => g.opponentId === opponentFilter);
  }, [allGames, opponentFilter]);
  const scopedMatchIds = useMemo(() => new Set(scopedGames.map(g => g.id)), [scopedGames]);
  const totalScopedMatches = scopedGames.length;

  const scopedBans = useMemo(() => heroBanRows.filter(r => scopedMatchIds.has(r.matchId)), [heroBanRows, scopedMatchIds]);
  const scopedPlays = useMemo(() => gameHeroRows.filter(r => scopedMatchIds.has(r.matchId)), [gameHeroRows, scopedMatchIds]);

  const matchResultById = useMemo(() => {
    const m = new Map<string, string | null>();
    scopedGames.forEach(g => m.set(g.id, g.result || null));
    return m;
  }, [scopedGames]);

  // Per-hero counters for priority + meta presence
  const heroAggregates = useMemo(() => {
    type Agg = {
      hero: Hero;
      picksUs: number; pickWinsUs: number; pickLossesUs: number; pickDrawsUs: number;
      picksOpp: number; pickWinsOpp: number;
      bansByUs: number;
      bansByOpp: number;
      matchesAppearedIn: Set<string>;
    };
    const agg = new Map<string, Agg>();
    const ensure = (heroId: string): Agg | null => {
      const hero = heroById.get(heroId);
      if (!hero) return null;
      if (!agg.has(heroId)) {
        agg.set(heroId, {
          hero,
          picksUs: 0, pickWinsUs: 0, pickLossesUs: 0, pickDrawsUs: 0,
          picksOpp: 0, pickWinsOpp: 0,
          bansByUs: 0, bansByOpp: 0,
          matchesAppearedIn: new Set(),
        });
      }
      return agg.get(heroId)!;
    };

    // Picks — dedupe per (matchId, heroId, playerId or oppPlayerId)
    const seenUs = new Set<string>();
    const seenOpp = new Set<string>();
    scopedPlays.forEach(r => {
      const e = ensure(r.heroId);
      if (!e) return;
      e.matchesAppearedIn.add(r.matchId);
      const result = matchResultById.get(r.matchId) || null;
      if (r.playerId && !r.opponentPlayerId && playerIds.has(r.playerId)) {
        const tuple = `${r.matchId}::${r.heroId}::${r.playerId}`;
        if (seenUs.has(tuple)) return;
        seenUs.add(tuple);
        e.picksUs++;
        if (result === "win") e.pickWinsUs++;
        else if (result === "loss") e.pickLossesUs++;
        else if (result === "draw") e.pickDrawsUs++;
      } else if (r.opponentPlayerId) {
        const tuple = `${r.matchId}::${r.heroId}::${r.opponentPlayerId}`;
        if (seenOpp.has(tuple)) return;
        seenOpp.add(tuple);
        e.picksOpp++;
        if (result === "win") e.pickWinsOpp++;
      }
    });

    // Bans
    scopedBans.forEach(r => {
      if (!r.heroId || r.actionType !== "ban") return;
      const e = ensure(r.heroId);
      if (!e) return;
      if (r.actingTeam === "a") e.bansByUs++;
      else if (r.actingTeam === "b") e.bansByOpp++;
    });

    return Array.from(agg.values());
  }, [scopedPlays, scopedBans, heroById, playerIds, matchResultById]);

  // Priority Score = pickRate% + banRate% (out of total scoped matches)
  const prioritized = useMemo(() => {
    if (totalScopedMatches === 0) return [];
    return heroAggregates.map(h => {
      const totalPicks = h.picksUs + h.picksOpp;
      const totalBans = h.bansByUs + h.bansByOpp;
      const pickRate = pct(totalPicks, totalScopedMatches);
      const banRate = pct(totalBans, totalScopedMatches);
      const presence = pct(h.matchesAppearedIn.size, totalScopedMatches);
      return {
        hero: h.hero,
        totalPicks, totalBans,
        pickRate, banRate, presence,
        priority: pickRate + banRate,
        ourWR: h.picksUs > 0 ? pct(h.pickWinsUs, h.picksUs - h.pickDrawsUs) : 0,
        ourPicks: h.picksUs,
        oppPicks: h.picksOpp,
      };
    }).sort((a, b) => b.priority - a.priority);
  }, [heroAggregates, totalScopedMatches]);

  // Heroes never played (in any match in scope, by anyone)
  const neverPlayed = useMemo(() => {
    const everPlayed = new Set<string>();
    scopedPlays.forEach(r => everPlayed.add(r.heroId));
    return heroes
      .filter(h => !everPlayed.has(h.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [heroes, scopedPlays]);

  // Always banned (by us or them) but never played by US in scope
  const alwaysBannedNeverPlayed = useMemo(() => {
    const playedByUs = new Set<string>();
    scopedPlays.forEach(r => {
      if (r.playerId && !r.opponentPlayerId && playerIds.has(r.playerId)) playedByUs.add(r.heroId);
    });
    return heroAggregates
      .filter(h => (h.bansByUs + h.bansByOpp) > 0 && !playedByUs.has(h.hero.id))
      .map(h => ({
        hero: h.hero,
        bansByUs: h.bansByUs,
        bansByOpp: h.bansByOpp,
        total: h.bansByUs + h.bansByOpp,
      }))
      .sort((a, b) => b.total - a.total);
  }, [heroAggregates, scopedPlays, playerIds]);

  // Ban Efficiency = avg WR of heroes WE ban (when those heroes were played by anyone elsewhere)
  // and conversely for opponent bans applied to us.
  const banEfficiency = useMemo(() => {
    const heroOurWR = new Map<string, { picks: number; wins: number }>();
    const heroOppWR = new Map<string, { picks: number; wins: number }>();
    // Dedupe per (matchId, heroId, playerId|opponentPlayerId) to avoid multi-round inflation.
    const seen = new Set<string>();
    scopedPlays.forEach(r => {
      const slot = r.playerId || r.opponentPlayerId || "?";
      const key = `${r.matchId}|${r.heroId}|${slot}`;
      if (seen.has(key)) return;
      seen.add(key);
      const result = matchResultById.get(r.matchId) || null;
      if (r.playerId && !r.opponentPlayerId && playerIds.has(r.playerId)) {
        if (!heroOurWR.has(r.heroId)) heroOurWR.set(r.heroId, { picks: 0, wins: 0 });
        const e = heroOurWR.get(r.heroId)!;
        e.picks++;
        if (result === "win") e.wins++;
      } else if (r.opponentPlayerId) {
        if (!heroOppWR.has(r.heroId)) heroOppWR.set(r.heroId, { picks: 0, wins: 0 });
        const e = heroOppWR.get(r.heroId)!;
        e.picks++;
        if (result === "loss") e.wins++; // opponent "wins" with this hero when we lose
      }
    });
    // Bans BY US target opponent heroes — efficiency = avg opponent WR on those heroes
    const ourBansList: { hero: Hero; bans: number; oppWR: number; oppPicks: number }[] = [];
    heroAggregates.forEach(h => {
      if (h.bansByUs === 0) return;
      const opp = heroOppWR.get(h.hero.id);
      ourBansList.push({
        hero: h.hero, bans: h.bansByUs,
        oppWR: opp && opp.picks > 0 ? pct(opp.wins, opp.picks) : 0,
        oppPicks: opp?.picks || 0,
      });
    });
    ourBansList.sort((a, b) => b.bans - a.bans);
    // Bans BY OPP target our heroes — efficiency = avg our WR on those heroes
    const oppBansList: { hero: Hero; bans: number; ourWR: number; ourPicks: number }[] = [];
    heroAggregates.forEach(h => {
      if (h.bansByOpp === 0) return;
      const ours = heroOurWR.get(h.hero.id);
      oppBansList.push({
        hero: h.hero, bans: h.bansByOpp,
        ourWR: ours && ours.picks > 0 ? pct(ours.wins, ours.picks) : 0,
        ourPicks: ours?.picks || 0,
      });
    });
    oppBansList.sort((a, b) => b.bans - a.bans);
    return { ourBansList, oppBansList };
  }, [heroAggregates, scopedPlays, playerIds, matchResultById]);

  // Hero Pool by Player (our players only) + best/worst hero
  const heroPoolByPlayer = useMemo(() => {
    const playerData = new Map<string, {
      player: Player;
      heroes: Map<string, { picks: number; wins: number; losses: number }>;
    }>();
    players.forEach(p => playerData.set(p.id, { player: p, heroes: new Map() }));

    const seen = new Set<string>();
    scopedPlays.forEach(r => {
      if (!r.playerId || r.opponentPlayerId) return;
      if (!playerIds.has(r.playerId)) return;
      const tuple = `${r.matchId}::${r.heroId}::${r.playerId}`;
      if (seen.has(tuple)) return;
      seen.add(tuple);
      const p = playerData.get(r.playerId);
      if (!p) return;
      if (!p.heroes.has(r.heroId)) p.heroes.set(r.heroId, { picks: 0, wins: 0, losses: 0 });
      const cell = p.heroes.get(r.heroId)!;
      cell.picks++;
      const result = matchResultById.get(r.matchId);
      if (result === "win") cell.wins++;
      else if (result === "loss") cell.losses++;
    });

    return Array.from(playerData.values())
      .map(({ player, heroes: hMap }) => {
        const items = Array.from(hMap.entries()).map(([heroId, c]) => ({
          hero: heroById.get(heroId),
          picks: c.picks,
          wins: c.wins,
          losses: c.losses,
          total: c.wins + c.losses,
          wr: c.wins + c.losses > 0 ? pct(c.wins, c.wins + c.losses) : 0,
        })).filter(it => it.hero);
        const totalPicks = items.reduce((a, c) => a + c.picks, 0);
        const ranked = items.filter(it => it.total >= 2)
          .sort((a, b) => b.wr - a.wr || b.total - a.total);
        return {
          player,
          poolSize: items.length,
          totalPicks,
          best: ranked[0],
          worst: ranked[ranked.length - 1],
          mostPlayed: [...items].sort((a, b) => b.picks - a.picks)[0],
        };
      })
      .filter(p => p.totalPicks > 0)
      .sort((a, b) => b.poolSize - a.poolSize);
  }, [players, scopedPlays, playerIds, heroById, matchResultById]);

  const sortedOpponents = useMemo(
    () => [...opponents].sort((a, b) => a.name.localeCompare(b.name)),
    [opponents]
  );

  // ===== Hooks above this line =====
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
                <Sparkles className="h-6 w-6 text-primary" /> Hero Insights
              </h1>
              <p className="text-sm text-muted-foreground">
                Priority targets, meta presence, ban efficiency, and per-player hero pool
              </p>
            </div>
          </div>
          <Select value={opponentFilter} onValueChange={setOpponentFilter}>
            <SelectTrigger className="w-full sm:w-[260px]" data-testid="select-opponent-filter-hero">
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

        <Tabs defaultValue="priority">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
            <TabsTrigger value="priority" data-testid="tab-hero-priority">Priority</TabsTrigger>
            <TabsTrigger value="absent" data-testid="tab-hero-absent">Never/Banned</TabsTrigger>
            <TabsTrigger value="banEff" data-testid="tab-hero-ban-eff">Ban Efficiency</TabsTrigger>
            <TabsTrigger value="meta" data-testid="tab-hero-meta">Meta Presence</TabsTrigger>
            <TabsTrigger value="pool" data-testid="tab-hero-pool">Hero Pool</TabsTrigger>
          </TabsList>

          <TabsContent value="priority" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Hero Priority Score
                </CardTitle>
                <CardDescription>
                  Pick% + Ban% across all draft phases. The most contested heroes — high score = high target priority.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prioritized.length === 0 || totalScopedMatches === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No draft data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {prioritized.slice(0, 30).map((p, i) => (
                      <div
                        key={p.hero.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                        data-testid={`row-hero-priority-${i}`}
                      >
                        <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                        <div className="flex-1 min-w-0"><HeroChip hero={p.hero} /></div>
                        <Badge variant="secondary" className="text-xs tabular-nums">
                          {p.pickRate.toFixed(0)}% pick
                        </Badge>
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {p.banRate.toFixed(0)}% ban
                        </Badge>
                        <Badge className={`text-xs tabular-nums ${wrColor(p.priority / 2)}`} variant="outline">
                          {p.priority.toFixed(0)} priority
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="absent" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ZapOff className="h-4 w-4 text-muted-foreground" /> Heroes Never Played
                  </CardTitle>
                  <CardDescription>Available heroes that haven't appeared in any scoped match — by anyone</CardDescription>
                </CardHeader>
                <CardContent>
                  {neverPlayed.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Every hero has been played at least once.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {neverPlayed.map((h, i) => (
                        <div
                          key={h.id}
                          className="px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-hero-never-${i}`}
                        >
                          <HeroChip hero={h} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500" /> Always Banned, Never Played by Us
                  </CardTitle>
                  <CardDescription>Heroes that are banned in scope but our roster never picked</CardDescription>
                </CardHeader>
                <CardContent>
                  {alwaysBannedNeverPlayed.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No qualifying heroes.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {alwaysBannedNeverPlayed.slice(0, 20).map((r, i) => (
                        <div
                          key={r.hero.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-hero-banned-never-${i}`}
                        >
                          <div className="flex-1 min-w-0"><HeroChip hero={r.hero} /></div>
                          <Badge variant="outline" className="text-xs tabular-nums">us {r.bansByUs}</Badge>
                          <Badge variant="outline" className="text-xs tabular-nums">opp {r.bansByOpp}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="banEff" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" /> Our Bans — Opponent's WR on those Heroes
                  </CardTitle>
                  <CardDescription>
                    The higher the opponent's win rate on a hero we banned, the more efficient the ban.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {banEfficiency.ourBansList.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No bans recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {banEfficiency.ourBansList.slice(0, 15).map((r, i) => (
                        <div
                          key={r.hero.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-our-ban-eff-${i}`}
                        >
                          <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                          <div className="flex-1 min-w-0"><HeroChip hero={r.hero} /></div>
                          <Badge variant="secondary" className="text-xs tabular-nums">{r.bans} bans</Badge>
                          {r.oppPicks > 0 ? (
                            <Badge className={`text-xs tabular-nums ${wrColor(r.oppWR)}`} variant="outline">
                              opp {r.oppWR.toFixed(0)}% in {r.oppPicks}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">no data</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ban className="h-4 w-4 text-amber-500" /> Their Bans — Our WR on those Heroes
                  </CardTitle>
                  <CardDescription>
                    If our WR on a hero is high, the opponent ban hurts us more.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {banEfficiency.oppBansList.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No opponent bans recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {banEfficiency.oppBansList.slice(0, 15).map((r, i) => (
                        <div
                          key={r.hero.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-opp-ban-eff-${i}`}
                        >
                          <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                          <div className="flex-1 min-w-0"><HeroChip hero={r.hero} /></div>
                          <Badge variant="secondary" className="text-xs tabular-nums">{r.bans} bans</Badge>
                          {r.ourPicks > 0 ? (
                            <Badge className={`text-xs tabular-nums ${wrColor(r.ourWR)}`} variant="outline">
                              us {r.ourWR.toFixed(0)}% in {r.ourPicks}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">no data</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="meta" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Meta Presence
                </CardTitle>
                <CardDescription>
                  % of scoped matches in which a hero was picked or banned by either side. {totalScopedMatches} total matches.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prioritized.length === 0 || totalScopedMatches === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No meta data yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...prioritized]
                      .sort((a, b) => b.presence - a.presence)
                      .slice(0, 30)
                      .map((p, i) => (
                        <div
                          key={p.hero.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card"
                          data-testid={`row-hero-meta-${i}`}
                        >
                          <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                          <div className="flex-1 min-w-0"><HeroChip hero={p.hero} /></div>
                          <Badge variant="secondary" className="text-xs tabular-nums">
                            {p.totalPicks} picks
                          </Badge>
                          <Badge variant="outline" className="text-xs tabular-nums">
                            {p.totalBans} bans
                          </Badge>
                          <Badge className={`text-xs tabular-nums ${wrColor(p.presence)}`} variant="outline">
                            {p.presence.toFixed(0)}% presence
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pool" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserSquare className="h-4 w-4 text-primary" /> Hero Pool by Player
                </CardTitle>
                <CardDescription>
                  Unique heroes per player + most played + best &amp; worst by win rate (min 2 games)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {heroPoolByPlayer.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No player picks recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {heroPoolByPlayer.map((p, i) => (
                      <div
                        key={p.player.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 rounded border border-border bg-card"
                        data-testid={`row-pool-player-${p.player.id}`}
                      >
                        <div className="flex items-center gap-2 sm:w-44 shrink-0">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs bg-muted">
                              {p.player.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{p.player.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {p.player.role} · {p.poolSize} heroes · {p.totalPicks} picks
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                          {p.mostPlayed && p.mostPlayed.hero && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-background min-w-0">
                              <span className="text-[10px] text-muted-foreground">Most</span>
                              <div className="min-w-0"><HeroChip hero={p.mostPlayed.hero} /></div>
                              <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
                                {p.mostPlayed.picks}x
                              </Badge>
                            </div>
                          )}
                          {p.best && p.best.hero && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-background min-w-0">
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Best</span>
                              <div className="min-w-0"><HeroChip hero={p.best.hero} /></div>
                              <Badge className={`text-[10px] tabular-nums shrink-0 ${wrColor(p.best.wr)}`} variant="outline">
                                {p.best.wr.toFixed(0)}%
                              </Badge>
                            </div>
                          )}
                          {p.worst && p.worst.hero && p.worst.hero.id !== p.best?.hero?.id && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-background min-w-0">
                              <span className="text-[10px] text-red-600 dark:text-red-400">Worst</span>
                              <div className="min-w-0"><HeroChip hero={p.worst.hero} /></div>
                              <Badge className={`text-[10px] tabular-nums shrink-0 ${wrColor(p.worst.wr)}`} variant="outline">
                                {p.worst.wr.toFixed(0)}%
                              </Badge>
                            </div>
                          )}
                        </div>
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
