import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Trophy, Target, Gamepad2, ChevronDown, ChevronRight, Map as MapIcon, Tag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { StatsSkeleton } from "@/components/PageSkeleton";
import { useGame } from "@/hooks/use-game";

interface StatAggregate {
  fieldName: string;
  total: number;
  count: number;
  avg: number;
}

interface ModeStats {
  modeName: string;
  stats: StatAggregate[];
}

interface MapStats {
  mapName: string;
  stats: StatAggregate[];
}

interface SubTypeStats {
  subTypeName: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  stats: StatAggregate[];
}

interface BreakdownEntry {
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  stats: StatAggregate[];
}

interface ModeBreakdown extends BreakdownEntry {
  modeName: string;
}

interface MapBreakdown extends BreakdownEntry {
  mapName: string;
}

interface SubTypeBreakdown extends BreakdownEntry {
  subTypeName: string;
}

interface OpponentStat {
  opponent: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  stats: StatAggregate[];
  byMode: ModeBreakdown[];
  byMap: MapBreakdown[];
  bySubType: SubTypeBreakdown[];
}

interface PlayerSummary {
  player: { id: string; name: string; role: string | null };
  gamesPlayed: number;
  stats: StatAggregate[];
  statsByMode: ModeStats[];
  statsByMap: MapStats[];
  statsBySubType?: SubTypeStats[];
  opponents: OpponentStat[];
  eventTypeGames: Record<string, number>;
}

export default function PlayerStats() {
  const { hasPermission } = useAuth();
  const { gameId, rosterId } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [statsView, setStatsView] = useState<"overall" | "byMode" | "byMap" | "bySubType">("overall");
  const [expandedOpponents, setExpandedOpponents] = useState<Set<string>>(new Set());

  if (!hasPermission("view_player_stats")) {
    return <AccessDenied />;
  }

  const rosterReady = !!(gameId && rosterId);
  const { data: summaries = [], isLoading } = useQuery<PlayerSummary[]>({
    queryKey: ["/api/player-stats-summary", { gameId, rosterId }],
    enabled: rosterReady,
  });

  const selectedPlayer = summaries.find(s => s.player.id === selectedPlayerId);
  const playersWithStats = summaries.filter(s => s.gamesPlayed > 0);

  const toggleOpponent = (opponent: string) => {
    setExpandedOpponents(prev => {
      const next = new Set(prev);
      if (next.has(opponent)) next.delete(opponent);
      else next.add(opponent);
      return next;
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Player Statistics</h1>
              <p className="text-sm text-muted-foreground">Per-player stat aggregations and opponent breakdowns</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <StatsSkeleton />
        ) : summaries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No players found. Add players first.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-players">{summaries.length}</p>
                    <p className="text-xs text-muted-foreground">Total Players</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-players-with-stats">{playersWithStats.length}</p>
                    <p className="text-xs text-muted-foreground">Players with Stats</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Target className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-games">
                      {summaries.reduce((sum, s) => sum + s.gamesPlayed, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Games Recorded</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Player Leaderboard</CardTitle>
                    <CardDescription>Games played per player</CardDescription>
                  </div>
                  <Select
                    value={selectedPlayerId || ""}
                    onValueChange={(v) => setSelectedPlayerId(v || null)}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-player">
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent>
                      {summaries.map(s => (
                        <SelectItem key={s.player.id} value={s.player.id}>
                          {s.player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {summaries
                    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
                    .map((s) => (
                      <div
                        key={s.player.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover-elevate ${
                          selectedPlayerId === s.player.id ? "bg-primary/5 border-primary/30" : ""
                        }`}
                        onClick={() => setSelectedPlayerId(s.player.id)}
                        data-testid={`player-row-${s.player.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {s.player.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{s.player.name}</span>
                            {s.player.role && (
                              <Badge variant="outline" className="text-xs py-0">{s.player.role}</Badge>
                            )}
                          </div>
                          {s.eventTypeGames && Object.keys(s.eventTypeGames).length > 0 && (
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {Object.entries(s.eventTypeGames).map(([type, count]) => (
                                <span key={type} className="text-xs text-muted-foreground">
                                  {type}: {count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-semibold">{s.gamesPlayed}</span>
                          <span className="text-xs text-muted-foreground ml-1">games</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {selectedPlayer && (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-4 border-b border-border">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-lg">
                          {selectedPlayer.player.name} - Stats
                        </CardTitle>
                        <CardDescription>
                          Across {selectedPlayer.gamesPlayed} games
                        </CardDescription>
                      </div>
                      <Tabs value={statsView} onValueChange={(v) => setStatsView(v as "overall" | "byMode" | "byMap" | "bySubType")}>
                        <TabsList>
                          <TabsTrigger value="overall" data-testid="tab-overall-stats">Overall</TabsTrigger>
                          <TabsTrigger value="byMode" data-testid="tab-bymode-stats">By Mode</TabsTrigger>
                          <TabsTrigger value="byMap" data-testid="tab-bymap-stats">By Map</TabsTrigger>
                          <TabsTrigger value="bySubType" data-testid="tab-bysubtype-stats">By Type</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {statsView === "overall" && (
                      selectedPlayer.stats.length === 0 ? (
                        <div className="p-6 text-center">
                          <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No stat data recorded for this player</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedPlayer.stats.map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`stat-row-${i}`}>
                              <span className="text-sm font-medium">{stat.fieldName}</span>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground">Total</span>
                                  <p className="text-sm font-semibold">{stat.total}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground">Avg</span>
                                  <p className="text-sm font-semibold">{stat.avg}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {statsView === "byMode" && (
                      selectedPlayer.statsByMode.length === 0 ? (
                        <div className="p-6 text-center">
                          <Gamepad2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No stats by game mode available</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {selectedPlayer.statsByMode.map((mode, mi) => (
                            <div key={mi} data-testid={`mode-group-${mi}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <Gamepad2 className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">{mode.modeName}</h3>
                              </div>
                              <div className="space-y-2 pl-6">
                                {mode.stats.map((stat, si) => (
                                  <div key={si} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                    <span className="text-sm font-medium">{stat.fieldName}</span>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <span className="text-xs text-muted-foreground">Total</span>
                                        <p className="text-sm font-semibold">{stat.total}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs text-muted-foreground">Avg</span>
                                        <p className="text-sm font-semibold">{stat.avg}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {statsView === "bySubType" && (
                      !selectedPlayer.statsBySubType || selectedPlayer.statsBySubType.length === 0 ? (
                        <div className="p-6 text-center" data-testid="empty-bysubtype">
                          <Tag className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No stats by event type available</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {selectedPlayer.statsBySubType.map((sub, si) => {
                            const swr = sub.gamesPlayed > 0 ? Math.round((sub.wins / sub.gamesPlayed) * 100) : 0;
                            return (
                              <div key={si} data-testid={`subtype-group-${si}`}>
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-semibold">{sub.subTypeName}</h3>
                                  </div>
                                  <div className="flex gap-2 text-xs text-muted-foreground items-center">
                                    <Badge variant={swr >= 50 ? "default" : "secondary"} className="text-xs">{swr}% WR</Badge>
                                    <span>{sub.gamesPlayed}G</span>
                                    <span className="text-green-600 dark:text-green-400">{sub.wins}W</span>
                                    <span className="text-red-600 dark:text-red-400">{sub.losses}L</span>
                                    {sub.draws > 0 && <span>{sub.draws}D</span>}
                                  </div>
                                </div>
                                <div className="space-y-2 pl-6">
                                  {sub.stats.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2">No stat data for this type</p>
                                  ) : sub.stats.map((stat, sti) => (
                                    <div key={sti} className="flex items-center justify-between p-3 rounded-md border border-border">
                                      <span className="text-sm font-medium">{stat.fieldName}</span>
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <span className="text-xs text-muted-foreground">Total</span>
                                          <p className="text-sm font-semibold">{stat.total}</p>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-xs text-muted-foreground">Avg</span>
                                          <p className="text-sm font-semibold">{stat.avg}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                    {statsView === "byMap" && (
                      !selectedPlayer.statsByMap || selectedPlayer.statsByMap.length === 0 ? (
                        <div className="p-6 text-center">
                          <MapIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No stats by map available</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {selectedPlayer.statsByMap.map((mapEntry, mi) => (
                            <div key={mi} data-testid={`map-group-${mi}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <MapIcon className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">{mapEntry.mapName}</h3>
                              </div>
                              <div className="space-y-2 pl-6">
                                {mapEntry.stats.map((stat, si) => (
                                  <div key={si} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                    <span className="text-sm font-medium">{stat.fieldName}</span>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <span className="text-xs text-muted-foreground">Total</span>
                                        <p className="text-sm font-semibold">{stat.total}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs text-muted-foreground">Avg</span>
                                        <p className="text-sm font-semibold">{stat.avg}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4 border-b border-border">
                    <CardTitle className="text-lg">
                      {selectedPlayer.player.name} - vs Opponents
                    </CardTitle>
                    <CardDescription>Performance and stat breakdown by opponent</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {selectedPlayer.opponents.length === 0 ? (
                      <div className="p-6 text-center">
                        <Target className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No opponent data available</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedPlayer.opponents.map((opp, i) => {
                          const winRate = opp.gamesPlayed > 0
                            ? Math.round((opp.wins / opp.gamesPlayed) * 100)
                            : 0;
                          const isExpanded = expandedOpponents.has(opp.opponent);
                          return (
                            <div key={i} className="rounded-lg border border-border" data-testid={`opponent-row-${i}`}>
                              <div
                                className="flex items-center justify-between gap-2 flex-wrap p-3 cursor-pointer hover-elevate rounded-lg"
                                onClick={() => toggleOpponent(opp.opponent)}
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="text-sm font-medium">{opp.opponent}</span>
                                  <Badge variant={winRate >= 50 ? "default" : "secondary"} className="text-xs">
                                    {winRate}% WR
                                  </Badge>
                                </div>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span>{opp.gamesPlayed} games</span>
                                  <span className="text-green-600 dark:text-green-400">{opp.wins}W</span>
                                  <span className="text-red-600 dark:text-red-400">{opp.losses}L</span>
                                  {opp.draws > 0 && <span>{opp.draws}D</span>}
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="border-t border-border p-3 bg-muted/20">
                                  <Tabs defaultValue="stats" className="w-full">
                                    <TabsList className="w-full justify-start">
                                      <TabsTrigger value="stats" data-testid={`opp-tab-stats-${i}`}>Stats</TabsTrigger>
                                      <TabsTrigger value="byMode" data-testid={`opp-tab-mode-${i}`}>By Mode</TabsTrigger>
                                      <TabsTrigger value="byMap" data-testid={`opp-tab-map-${i}`}>By Map</TabsTrigger>
                                      <TabsTrigger value="bySubType" data-testid={`opp-tab-subtype-${i}`}>By Type</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="stats" className="space-y-2 mt-2">
                                      {opp.stats && opp.stats.length > 0 ? opp.stats.map((stat, si) => (
                                        <div key={si} className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-card">
                                          <span className="text-sm font-medium">{stat.fieldName}</span>
                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <span className="text-xs text-muted-foreground">Total</span>
                                              <p className="text-sm font-semibold">{stat.total}</p>
                                            </div>
                                            <div className="text-right">
                                              <span className="text-xs text-muted-foreground">Avg</span>
                                              <p className="text-sm font-semibold">{stat.avg}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )) : (
                                        <p className="text-xs text-muted-foreground text-center py-2">No stat breakdown available</p>
                                      )}
                                    </TabsContent>
                                    <TabsContent value="byMode" className="space-y-3 mt-2">
                                      {opp.byMode && opp.byMode.length > 0 ? opp.byMode.map((mode, mi) => {
                                        const mwr = mode.gamesPlayed > 0 ? Math.round((mode.wins / mode.gamesPlayed) * 100) : 0;
                                        return (
                                          <div key={mi} className="rounded-md border border-border bg-card p-3">
                                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                              <span className="text-sm font-medium">{mode.modeName}</span>
                                              <div className="flex gap-2 text-xs text-muted-foreground">
                                                <Badge variant={mwr >= 50 ? "default" : "secondary"} className="text-xs">{mwr}% WR</Badge>
                                                <span>{mode.gamesPlayed}G</span>
                                                <span className="text-green-600 dark:text-green-400">{mode.wins}W</span>
                                                <span className="text-red-600 dark:text-red-400">{mode.losses}L</span>
                                              </div>
                                            </div>
                                            {mode.stats.length > 0 && (
                                              <div className="space-y-1">
                                                {mode.stats.map((s, si) => (
                                                  <div key={si} className="flex items-center justify-between text-xs px-2 py-1">
                                                    <span className="text-muted-foreground">{s.fieldName}</span>
                                                    <span className="font-medium">Avg: {s.avg} | Total: {s.total}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }) : (
                                        <p className="text-xs text-muted-foreground text-center py-2">No mode breakdown available</p>
                                      )}
                                    </TabsContent>
                                    <TabsContent value="byMap" className="space-y-3 mt-2">
                                      {opp.byMap && opp.byMap.length > 0 ? opp.byMap.map((map, mi) => {
                                        const mwr = map.gamesPlayed > 0 ? Math.round((map.wins / map.gamesPlayed) * 100) : 0;
                                        return (
                                          <div key={mi} className="rounded-md border border-border bg-card p-3">
                                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                              <span className="text-sm font-medium">{map.mapName}</span>
                                              <div className="flex gap-2 text-xs text-muted-foreground">
                                                <Badge variant={mwr >= 50 ? "default" : "secondary"} className="text-xs">{mwr}% WR</Badge>
                                                <span>{map.gamesPlayed}G</span>
                                                <span className="text-green-600 dark:text-green-400">{map.wins}W</span>
                                                <span className="text-red-600 dark:text-red-400">{map.losses}L</span>
                                              </div>
                                            </div>
                                            {map.stats.length > 0 && (
                                              <div className="space-y-1">
                                                {map.stats.map((s, si) => (
                                                  <div key={si} className="flex items-center justify-between text-xs px-2 py-1">
                                                    <span className="text-muted-foreground">{s.fieldName}</span>
                                                    <span className="font-medium">Avg: {s.avg} | Total: {s.total}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }) : (
                                        <p className="text-xs text-muted-foreground text-center py-2">No map breakdown available</p>
                                      )}
                                    </TabsContent>
                                    <TabsContent value="bySubType" className="space-y-3 mt-2">
                                      {opp.bySubType && opp.bySubType.length > 0 ? opp.bySubType.map((sub, si) => {
                                        const swr = sub.gamesPlayed > 0 ? Math.round((sub.wins / sub.gamesPlayed) * 100) : 0;
                                        return (
                                          <div key={si} className="rounded-md border border-border bg-card p-3">
                                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                              <span className="text-sm font-medium">{sub.subTypeName}</span>
                                              <div className="flex gap-2 text-xs text-muted-foreground">
                                                <Badge variant={swr >= 50 ? "default" : "secondary"} className="text-xs">{swr}% WR</Badge>
                                                <span>{sub.gamesPlayed}G</span>
                                                <span className="text-green-600 dark:text-green-400">{sub.wins}W</span>
                                                <span className="text-red-600 dark:text-red-400">{sub.losses}L</span>
                                              </div>
                                            </div>
                                            {sub.stats.length > 0 && (
                                              <div className="space-y-1">
                                                {sub.stats.map((s, ssi) => (
                                                  <div key={ssi} className="flex items-center justify-between text-xs px-2 py-1">
                                                    <span className="text-muted-foreground">{s.fieldName}</span>
                                                    <span className="font-medium">Avg: {s.avg} | Total: {s.total}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }) : (
                                        <p className="text-xs text-muted-foreground text-center py-2">No event type breakdown available</p>
                                      )}
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
