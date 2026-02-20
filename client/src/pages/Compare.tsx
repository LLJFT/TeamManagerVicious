import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Calendar,
  CalendarDays,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Event, Game, GameMode, Map as MapType, Season } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";

interface StatsSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

interface MonthOption {
  value: string;
  label: string;
}

type CompareMode = "season" | "month";

export default function Compare() {
  const { hasPermission } = useAuth();
  const [compareMode, setCompareMode] = useState<CompareMode>("season");
  const [selection1, setSelection1] = useState<string>("");
  const [selection2, setSelection2] = useState<string>("");

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: allGames = [] } = useQuery<(Game & { eventType: string })[]>({
    queryKey: ["/api/games"],
  });

  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes"],
  });

  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps"],
  });

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const availableMonths = useMemo<MonthOption[]>(() => {
    const monthsSet = new Set<string>();
    const monthsList: MonthOption[] = [];

    events.forEach(event => {
      if (event.date) {
        try {
          const date = parseISO(event.date);
          const monthKey = format(date, "yyyy-MM");
          if (!monthsSet.has(monthKey)) {
            monthsSet.add(monthKey);
            monthsList.push({
              value: monthKey,
              label: format(date, "MMMM yyyy"),
            });
          }
        } catch (e) {}
      }
    });

    return monthsList.sort((a, b) => b.value.localeCompare(a.value));
  }, [events]);

  const getFilteredData = (selection: string) => {
    let filteredEvents: Event[] = [];

    if (compareMode === "season") {
      filteredEvents = events.filter(e => e.seasonId === selection);
    } else {
      const [year, month] = selection.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      filteredEvents = events.filter(event => {
        if (!event.date) return false;
        try {
          const eventDate = parseISO(event.date);
          return isWithinInterval(eventDate, { start: startDate, end: endDate });
        } catch {
          return false;
        }
      });
    }

    const eventIds = new Set(filteredEvents.map(e => e.id));
    const filteredGames = allGames.filter(g => eventIds.has(g.eventId || ""));

    return { events: filteredEvents, games: filteredGames };
  };

  const calculateStats = (items: { result?: string | null }[]): StatsSummary => {
    const total = items.length;
    const wins = items.filter(i => i.result === "win").length;
    const losses = items.filter(i => i.result === "loss").length;
    const draws = items.filter(i => i.result === "draw").length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, draws, winRate };
  };

  const getComparisonData = (selection: string) => {
    if (!selection) return null;
    const { events: filteredEvents, games: filteredGames } = getFilteredData(selection);

    const eventStats = calculateStats(filteredEvents.filter(e => e.result));
    const gameStats = calculateStats(filteredGames.filter(g => g.result));

    const modeStats = gameModes.map(mode => {
      const modeGames = filteredGames.filter(g => g.gameModeId === mode.id && g.result);
      return {
        mode,
        ...calculateStats(modeGames),
      };
    }).filter(s => s.total > 0).sort((a, b) => b.winRate - a.winRate);

    const mapStats = maps.map(map => {
      const mapGames = filteredGames.filter(g => g.mapId === map.id && g.result);
      const mode = gameModes.find(m => m.id === map.gameModeId);
      return {
        map,
        modeName: mode?.name || "Unknown",
        ...calculateStats(mapGames),
      };
    }).filter(s => s.total > 0).sort((a, b) => b.winRate - a.winRate);

    return {
      eventStats,
      gameStats,
      modeStats,
      mapStats,
      bestModes: modeStats.slice(0, 3),
      worstModes: [...modeStats].sort((a, b) => a.winRate - b.winRate).slice(0, 3),
      bestMaps: mapStats.slice(0, 3),
      worstMaps: [...mapStats].sort((a, b) => a.winRate - b.winRate).slice(0, 3),
    };
  };

  const data1 = getComparisonData(selection1);
  const data2 = getComparisonData(selection2);

  const getLabel = (selection: string) => {
    if (compareMode === "season") {
      return seasons.find(s => s.id === selection)?.name || selection;
    }
    return availableMonths.find(m => m.value === selection)?.label || selection;
  };

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

  const getDiff = (val1: number, val2: number) => {
    const diff = val1 - val2;
    if (Math.abs(diff) < 0.1) return null;
    return diff;
  };

  if (!hasPermission("view_compare")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  const options = compareMode === "season" ? seasons : availableMonths;

  return (
    <div className="min-h-screen bg-background">
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
                <Scale className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Compare</h1>
              </div>
              <p className="text-muted-foreground">Compare performance across time periods</p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compare Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={compareMode} onValueChange={(v) => { setCompareMode(v as CompareMode); setSelection1(""); setSelection2(""); }}>
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="season" className="gap-2" data-testid="tab-season">
                  <CalendarDays className="h-4 w-4" />
                  Season vs Season
                </TabsTrigger>
                <TabsTrigger value="month" className="gap-2" data-testid="tab-month">
                  <Calendar className="h-4 w-4" />
                  Month vs Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-primary">Selection 1</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selection1} onValueChange={setSelection1}>
                <SelectTrigger data-testid="select-1">
                  <SelectValue placeholder={`Select ${compareMode === "season" ? "season" : "month"}...`} />
                </SelectTrigger>
                <SelectContent>
                  {compareMode === "season" ? (
                    seasons.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))
                  ) : (
                    availableMonths.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-secondary">Selection 2</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selection2} onValueChange={setSelection2}>
                <SelectTrigger data-testid="select-2">
                  <SelectValue placeholder={`Select ${compareMode === "season" ? "season" : "month"}...`} />
                </SelectTrigger>
                <SelectContent>
                  {compareMode === "season" ? (
                    seasons.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))
                  ) : (
                    availableMonths.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {(!selection1 || !selection2) ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Scale className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-semibold mb-2">Select Two Periods to Compare</h3>
              <p className="text-muted-foreground">
                Choose two {compareMode === "season" ? "seasons" : "months"} above to see the comparison
              </p>
            </CardContent>
          </Card>
        ) : data1 && data2 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card className="border-primary/30">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Badge variant="outline" className="text-base px-3 py-1 border-primary text-primary">
                      {getLabel(selection1)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Event Win Rate</p>
                      <p className={`text-2xl font-bold ${getWinRateColor(data1.eventStats.winRate)}`}>
                        {data1.eventStats.winRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data1.eventStats.wins}W - {data1.eventStats.losses}L - {data1.eventStats.draws}D
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Game Win Rate</p>
                      <p className={`text-2xl font-bold ${getWinRateColor(data1.gameStats.winRate)}`}>
                        {data1.gameStats.winRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data1.gameStats.wins}W - {data1.gameStats.losses}L - {data1.gameStats.draws}D
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Best Modes</p>
                      {data1.bestModes.map(m => (
                        <div key={m.mode.id} className="flex justify-between text-sm">
                          <span>{m.mode.name}</span>
                          <span className={getWinRateColor(m.winRate)}>{m.winRate.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Best Maps</p>
                      {data1.bestMaps.slice(0, 3).map(m => (
                        <div key={m.map.id} className="flex justify-between text-sm">
                          <span>{m.map.name}</span>
                          <span className={getWinRateColor(m.winRate)}>{m.winRate.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-secondary/30">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="flex items-center gap-2 text-secondary">
                    <Badge variant="outline" className="text-base px-3 py-1 border-secondary text-secondary">
                      {getLabel(selection2)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Event Win Rate</p>
                      <p className={`text-2xl font-bold ${getWinRateColor(data2.eventStats.winRate)}`}>
                        {data2.eventStats.winRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data2.eventStats.wins}W - {data2.eventStats.losses}L - {data2.eventStats.draws}D
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Game Win Rate</p>
                      <p className={`text-2xl font-bold ${getWinRateColor(data2.gameStats.winRate)}`}>
                        {data2.gameStats.winRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data2.gameStats.wins}W - {data2.gameStats.losses}L - {data2.gameStats.draws}D
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Best Modes</p>
                      {data2.bestModes.map(m => (
                        <div key={m.mode.id} className="flex justify-between text-sm">
                          <span>{m.mode.name}</span>
                          <span className={getWinRateColor(m.winRate)}>{m.winRate.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Best Maps</p>
                      {data2.bestMaps.slice(0, 3).map(m => (
                        <div key={m.map.id} className="flex justify-between text-sm">
                          <span>{m.map.name}</span>
                          <span className={getWinRateColor(m.winRate)}>{m.winRate.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4 border-b">
                <CardTitle>Performance Trend</CardTitle>
                <CardDescription>Win rate comparison between periods</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Event Win Rate</span>
                      <div className="flex items-center gap-4">
                        <span className="text-primary">{getLabel(selection1)}: {data1.eventStats.winRate.toFixed(1)}%</span>
                        <span className="text-secondary">{getLabel(selection2)}: {data2.eventStats.winRate.toFixed(1)}%</span>
                        {getDiff(data1.eventStats.winRate, data2.eventStats.winRate) !== null && (
                          <Badge variant={getDiff(data1.eventStats.winRate, data2.eventStats.winRate)! > 0 ? "default" : "destructive"}>
                            {getDiff(data1.eventStats.winRate, data2.eventStats.winRate)! > 0 ? "+" : ""}
                            {getDiff(data1.eventStats.winRate, data2.eventStats.winRate)!.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 h-4">
                      <div 
                        className="bg-primary/70 rounded-l-sm" 
                        style={{ width: `${data1.eventStats.winRate}%` }}
                      />
                      <div 
                        className="bg-secondary/70 rounded-r-sm" 
                        style={{ width: `${data2.eventStats.winRate}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Game Win Rate</span>
                      <div className="flex items-center gap-4">
                        <span className="text-primary">{getLabel(selection1)}: {data1.gameStats.winRate.toFixed(1)}%</span>
                        <span className="text-secondary">{getLabel(selection2)}: {data2.gameStats.winRate.toFixed(1)}%</span>
                        {getDiff(data1.gameStats.winRate, data2.gameStats.winRate) !== null && (
                          <Badge variant={getDiff(data1.gameStats.winRate, data2.gameStats.winRate)! > 0 ? "default" : "destructive"}>
                            {getDiff(data1.gameStats.winRate, data2.gameStats.winRate)! > 0 ? "+" : ""}
                            {getDiff(data1.gameStats.winRate, data2.gameStats.winRate)!.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 h-4">
                      <div 
                        className="bg-primary/70 rounded-l-sm" 
                        style={{ width: `${data1.gameStats.winRate}%` }}
                      />
                      <div 
                        className="bg-secondary/70 rounded-r-sm" 
                        style={{ width: `${data2.gameStats.winRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
