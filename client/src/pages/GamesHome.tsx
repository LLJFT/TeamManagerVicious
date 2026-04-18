import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import type { SupportedGame, Roster } from "@shared/schema";
import { useGame, rosterUrlSlug } from "@/hooks/use-game";
import { GameIcon } from "@/components/game-icon";

function RosterBadge({ name }: { name: string }) {
  return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{name}</span>;
}

interface RosterCardData {
  game: SupportedGame;
  roster: Roster;
}

export default function GamesHome() {
  const { hasGameAccess, hasRosterAccess } = useAuth();
  const [, navigate] = useLocation();
  const { setRosterId } = useGame();

  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: allRosters = [] } = useQuery<Record<string, Roster[]>>({
    queryKey: ["/api/all-rosters"],
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 gap-4" data-testid="loading-spinner">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-1.5 rounded-full border-2 border-t-transparent border-r-primary/60 border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading games...</p>
      </div>
    );
  }

  const rosterCards: RosterCardData[] = [];
  for (const game of allGames) {
    const gameRosters = (allRosters as any)?.[game.id] || [];
    for (const roster of gameRosters) {
      rosterCards.push({ game, roster });
    }
  }

  const handleRosterCardClick = (game: SupportedGame, roster: Roster) => {
    const canAccess = roster.id ? hasRosterAccess(game.id, roster.id) : hasGameAccess(game.id);
    if (!canAccess) return;
    setRosterId(roster.id || null);
    const url = `/${rosterUrlSlug(game.slug, roster)}`;
    navigate(url);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Home</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Select a roster to manage</p>
      </div>

      <div className="space-y-6">
        {allGames.map((game) => {
          const gameRosterCards = rosterCards.filter(rc => rc.game.id === game.id);
          if (gameRosterCards.length === 0) return null;
          return (
            <div key={game.id}>
              <div className="flex items-center gap-2 mb-2">
                <GameIcon slug={game.slug} name={game.name} size="sm" />
                <h2 className="text-sm font-semibold text-muted-foreground">{game.name}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {gameRosterCards.map(({ roster }) => {
                  const hasAccess = roster.id ? hasRosterAccess(game.id, roster.id) : hasGameAccess(game.id);
                  return (
                    <Card
                      key={`${game.id}-${roster.id}`}
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
                          <RosterBadge name={roster.name} />
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
    </div>
  );
}
