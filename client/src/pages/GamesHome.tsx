import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Clock } from "lucide-react";
import type { SupportedGame, Roster } from "@shared/schema";
import { useGame, rosterUrlSlug } from "@/hooks/use-game";
import { GameIcon } from "@/components/game-icon";
import { Calendar } from "@/components/ui/calendar";

const ROSTER_TYPE_LABELS: Record<string, string> = {
  "first-team": "First Team",
  "academy": "Academy",
  "women": "Women",
  "main": "First Team",
};

function RosterBadge({ slug }: { slug: string }) {
  const colors: Record<string, string> = {
    "first-team": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "academy": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    "women": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    "main": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  const label = ROSTER_TYPE_LABELS[slug] || slug;
  const cls = colors[slug] || "bg-muted text-muted-foreground";
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

interface RosterCardData {
  game: SupportedGame;
  roster: Roster;
}

export default function GamesHome() {
  const { hasGameAccess, hasRosterAccess } = useAuth();
  const [, navigate] = useLocation();
  const { setRosterId } = useGame();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: allRosters = [] } = useQuery<Record<string, Roster[]>>({
    queryKey: ["/api/all-rosters"],
  });

  const { data: allEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/all-events"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading games...</div>
      </div>
    );
  }

  const rosterCards: RosterCardData[] = [];
  for (const game of allGames) {
    const gameRosters = (allRosters as any)?.[game.id] || [];
    if (gameRosters.length === 0) {
      rosterCards.push({ game, roster: { id: "", teamId: "", gameId: game.id, name: "First Team", slug: "first-team", sortOrder: 0 } as Roster });
    } else {
      for (const roster of gameRosters) {
        rosterCards.push({ game, roster });
      }
    }
  }

  const handleRosterCardClick = (game: SupportedGame, roster: Roster) => {
    const canAccess = roster.id ? hasRosterAccess(game.id, roster.id) : hasGameAccess(game.id);
    if (!canAccess) return;
    setRosterId(roster.id || null);
    const url = `/${rosterUrlSlug(game.slug, roster.slug)}`;
    navigate(url);
  };

  const eventsByDate = (() => {
    const map: Record<string, any[]> = {};
    for (const evt of allEvents) {
      if (!evt.date) continue;
      const key = evt.date;
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    }
    return map;
  })();

  const datesWithEvents = Object.keys(eventsByDate).map(d => new Date(d + "T00:00:00"));

  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";
  const selectedEvents = selectedDateStr ? (eventsByDate[selectedDateStr] || []) : [];

  const today = new Date().toISOString().split("T")[0];
  const upcomingEvents = allEvents
    .filter(e => e.date && e.date >= today)
    .sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""))
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Home</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Select a roster to manage</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {allGames.map((game) => {
            const gameRosterCards = rosterCards.filter(rc => rc.game.id === game.id);
            if (gameRosterCards.length === 0) return null;
            return (
              <div key={game.id}>
                <div className="flex items-center gap-2 mb-2">
                  <GameIcon slug={game.slug} name={game.name} size="sm" />
                  <h2 className="text-sm font-semibold text-muted-foreground">{game.name}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {gameRosterCards.map(({ roster }) => {
                    const hasAccess = roster.id ? hasRosterAccess(game.id, roster.id) : hasGameAccess(game.id);
                    return (
                      <Card
                        key={`${game.id}-${roster.slug}`}
                        className={`relative cursor-pointer transition-opacity ${hasAccess ? "hover-elevate" : "opacity-40"}`}
                        data-testid={`card-roster-${game.slug}-${roster.slug}`}
                        onClick={() => handleRosterCardClick(game, roster)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          {!hasAccess && (
                            <div className="absolute top-2 right-2">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <GameIcon slug={game.slug} name={game.name} />
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-sm font-medium leading-tight">{game.name}</span>
                            <RosterBadge slug={roster.slug} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-4 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{ hasEvent: datesWithEvents }}
                modifiersClassNames={{ hasEvent: "ring-2 ring-primary/40 ring-inset" }}
                data-testid="calendar-widget"
              />
            </CardContent>
            {selectedEvents.length > 0 && (
              <CardContent className="pt-0 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Events on {selectedDate?.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
                {selectedEvents.map((evt: any, i: number) => (
                  <div key={evt.id || i} className="flex items-center justify-between gap-2 text-sm py-1" data-testid={`calendar-event-${evt.id || i}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-medium truncate">{evt.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{evt.gameName}</Badge>
                    </div>
                    {evt.time && <span className="text-xs text-muted-foreground flex-shrink-0">{evt.time}</span>}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Upcoming Events
              </h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((evt: any, i: number) => (
                    <div key={evt.id || i} className="flex items-center justify-between gap-2 text-sm" data-testid={`upcoming-event-${evt.id || i}`}>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium truncate">{evt.title}</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{evt.gameName}</Badge>
                          {evt.rosterName && <Badge variant="outline" className="text-[10px]">{evt.rosterName}</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{evt.date}</span>
                        {evt.time && <span className="text-[10px] text-muted-foreground">{evt.time}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
