import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Gamepad2, Users, Trophy, Clock, UserCheck, UserX, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { SupportedGame } from "@shared/schema";

const GAME_ICONS: Record<string, string> = {
  "dota2": "Dota 2",
  "cs": "CS",
  "valorant": "VAL",
  "mlbb": "ML",
  "lol": "LoL",
  "rocket-league": "RL",
  "pubg-mobile": "PUBGM",
  "overwatch": "OW",
  "r6": "R6",
  "apex": "APEX",
  "fighting-games": "FG",
  "pubg": "PUBG",
  "hok": "HoK",
  "brawl-stars": "BS",
  "cod": "COD",
  "marvel-rivals": "MR",
  "ea-fc": "FC",
  "free-fire": "FF",
  "fortnite": "FN",
  "tft": "TFT",
  "crossfire": "CF",
  "deadlock": "DL",
  "trackmania": "TM",
  "the-finals": "TF",
};

export default function GamesHome() {
  const { user, hasGameAccess, hasOrgRole } = useAuth();
  const [, navigate] = useLocation();

  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: dashboard } = useQuery({
    queryKey: ["/api/org-dashboard"],
    enabled: hasOrgRole("org_admin"),
  });

  const { data: pendingAssignments = [] } = useQuery({
    queryKey: ["/api/game-assignments/pending"],
    enabled: hasOrgRole("org_admin", "game_manager"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Games</h1>
        <p className="text-muted-foreground text-sm mt-1">Select a game to manage your team</p>
      </div>

      {pendingAssignments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Registration Requests ({pendingAssignments.length})
            </h2>
            <div className="space-y-2">
              {(pendingAssignments as any[]).map((pa: any) => (
                <div key={pa.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50" data-testid={`pending-assignment-${pa.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{pa.username}</span>
                    <Badge variant="secondary">{pa.gameName}</Badge>
                    <Badge variant="outline">{pa.assignedRole}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-approve-${pa.id}`}
                      onClick={async () => {
                        await apiRequest("POST", `/api/game-assignments/${pa.id}/approve`);
                        queryClient.invalidateQueries({ queryKey: ["/api/game-assignments/pending"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
                      }}
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-reject-${pa.id}`}
                      onClick={async () => {
                        await apiRequest("POST", `/api/game-assignments/${pa.id}/reject`);
                        queryClient.invalidateQueries({ queryKey: ["/api/game-assignments/pending"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
                      }}
                    >
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasOrgRole("org_admin") && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(dashboard as any).gameSummaries?.filter((gs: any) => gs.playerCount > 0).map((gs: any) => (
            <Card key={gs.gameId}>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold">{gs.gameName}</h3>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{gs.playerCount} members</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-green-600" /> {gs.attendance.attended}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-yellow-600" /> {gs.attendance.late}</span>
                  <span className="flex items-center gap-1"><UserX className="h-3 w-3 text-red-600" /> {gs.attendance.absent}</span>
                </div>
                {gs.recentResults.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {gs.recentResults.map((r: any, i: number) => (
                      <Badge
                        key={i}
                        variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}
                      >
                        {r.result === "win" ? "W" : r.result === "loss" ? "L" : r.result === "draw" ? "D" : "P"}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {allGames.map((game) => {
          const hasAccess = hasGameAccess(game.id);
          const abbr = GAME_ICONS[game.slug] || game.slug.toUpperCase().slice(0, 3);

          return (
            <Card
              key={game.id}
              className={`relative cursor-pointer transition-opacity ${hasAccess ? "hover-elevate" : "opacity-50"}`}
              data-testid={`card-game-${game.slug}`}
              onClick={() => {
                if (hasAccess) navigate(`/${game.slug}`);
              }}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px] gap-2">
                {!hasAccess && (
                  <div className="absolute top-2 right-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{abbr}</span>
                </div>
                <span className="text-xs font-medium leading-tight">{game.name}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasOrgRole("org_admin") && dashboard && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              All Users ({(dashboard as any).users?.length || 0})
            </h2>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {(dashboard as any).users?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 p-2 rounded-md text-sm" data-testid={`user-row-${u.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{u.username}</span>
                    <Badge variant="outline">{u.orgRole || "player"}</Badge>
                    <Badge variant={u.status === "active" ? "default" : u.status === "pending" ? "secondary" : "destructive"}>
                      {u.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.games?.map((g: any) => {
                      const gameName = allGames.find(sg => sg.id === g.gameId)?.name || "Unknown";
                      return <Badge key={g.id} variant="secondary">{gameName}</Badge>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
