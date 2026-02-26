import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Users, Trophy, Clock, UserCheck, UserX, CheckCircle, XCircle, LayoutDashboard, Gamepad2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportedGame } from "@shared/schema";
import {
  SiValorant, SiLeagueoflegends, SiCounterstrike, SiDota2, SiPubg,
} from "react-icons/si";

const GAME_COLORS: Record<string, string> = {
  "valorant":     "#FF4655",
  "lol":          "#C89B3C",
  "cs":           "#F0A03E",
  "dota2":        "#9B1C1F",
  "pubg":         "#F5A623",
  "pubg-mobile":  "#F5A623",
  "overwatch":    "#FA9C1E",
  "apex":         "#CD3333",
  "fortnite":     "#00C3FF",
  "rocket-league":"#0066FF",
  "r6":           "#009BDE",
  "cod":          "#8CC63F",
  "mlbb":         "#1A7EC6",
  "hok":          "#FFB800",
  "brawl-stars":  "#FF2A6D",
  "marvel-rivals":"#E62429",
  "ea-fc":        "#00B2FF",
  "free-fire":    "#FF6B00",
  "tft":          "#C8AA6E",
  "crossfire":    "#00A1E0",
  "deadlock":     "#6B4226",
  "trackmania":   "#009DDC",
  "the-finals":   "#FFD700",
  "fighting-games":"#9333EA",
};

const SI_ICONS: Record<string, any> = {
  "valorant": SiValorant,
  "lol":      SiLeagueoflegends,
  "cs":       SiCounterstrike,
  "dota2":    SiDota2,
  "pubg":     SiPubg,
  "pubg-mobile": SiPubg,
};

function GameIcon({ slug, name }: { slug: string; name: string }) {
  const SIIcon = SI_ICONS[slug];
  const color = GAME_COLORS[slug] || "#6B7280";
  const abbr = name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();

  if (SIIcon) {
    return (
      <div className="h-10 w-10 rounded-md flex items-center justify-center" style={{ background: `${color}20` }}>
        <SIIcon style={{ color, fontSize: 22 }} />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 rounded-md flex items-center justify-center font-bold text-xs" style={{ background: `${color}20`, color }}>
      {abbr}
    </div>
  );
}

export default function GamesHome() {
  const { user, hasGameAccess, hasOrgRole } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = hasOrgRole("org_admin");

  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/org-dashboard"],
    enabled: isAdmin,
  });

  const { data: pendingAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/game-assignments/pending"],
    enabled: hasOrgRole("org_admin", "game_manager"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/game-assignments/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-assignments/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/game-assignments/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-assignments/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
    },
  });

  const approveUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/users/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading games...</div>
      </div>
    );
  }

  const showDashboardTab = hasOrgRole("org_admin", "game_manager");

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Tabs defaultValue="games">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Home</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Select a game to manage your team</p>
          </div>
          {showDashboardTab && (
            <TabsList>
              <TabsTrigger value="games" className="gap-2">
                <Gamepad2 className="h-4 w-4" />
                Games
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
                {pendingAssignments.length > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 text-[10px]">{pendingAssignments.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          )}
        </div>

        <TabsContent value="games" className="mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {allGames.map((game) => {
              const hasAccess = hasGameAccess(game.id);
              return (
                <Card
                  key={game.id}
                  className={`relative cursor-pointer transition-opacity ${hasAccess ? "hover-elevate" : "opacity-40"}`}
                  data-testid={`card-game-${game.slug}`}
                  onClick={() => { if (hasAccess) navigate(`/${game.slug}`); }}
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px] gap-2">
                    {!hasAccess && (
                      <div className="absolute top-2 right-2">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <GameIcon slug={game.slug} name={game.name} />
                    <span className="text-xs font-medium leading-tight">{game.name}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {showDashboardTab && (
          <TabsContent value="dashboard" className="mt-0 space-y-6">
            {pendingAssignments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Registrations ({pendingAssignments.length})
                </h2>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    {pendingAssignments.map((pa: any) => (
                      <div key={pa.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50" data-testid={`pending-assignment-${pa.id}`}>
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="font-medium">{pa.username}</span>
                          <Badge variant="secondary">{pa.gameName}</Badge>
                          <Badge variant="outline">{pa.assignedRole}</Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" data-testid={`button-approve-${pa.id}`}
                            onClick={() => approveMutation.mutate(pa.id)} disabled={approveMutation.isPending}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" data-testid={`button-reject-${pa.id}`}
                            onClick={() => rejectMutation.mutate(pa.id)} disabled={rejectMutation.isPending}>
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {isAdmin && dashboard?.gameSummaries && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Active Games
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboard.gameSummaries.filter((gs: any) => gs.playerCount > 0).map((gs: any) => {
                    const game = allGames.find(g => g.id === gs.gameId);
                    return (
                      <Card key={gs.gameId}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            {game && <GameIcon slug={game.slug} name={game.name} />}
                            <h3 className="font-semibold">{gs.gameName}</h3>
                          </div>
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
                                <Badge key={i} variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}>
                                  {r.result === "win" ? "W" : r.result === "loss" ? "L" : r.result === "draw" ? "D" : "P"}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {isAdmin && dashboard?.users && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Users ({dashboard.users.length})
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-[400px] overflow-auto">
                      {dashboard.users.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between gap-2 px-4 py-3" data-testid={`user-row-${u.id}`}>
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-medium">{u.username}</span>
                            <Badge variant="outline">{u.orgRole || "player"}</Badge>
                            <Badge variant={u.status === "active" ? "default" : u.status === "pending" ? "secondary" : "destructive"}>
                              {u.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <div className="flex flex-wrap gap-1">
                              {u.games?.map((g: any) => {
                                const gameName = allGames.find(sg => sg.id === g.gameId)?.name || "Unknown";
                                return <Badge key={g.id} variant="secondary" className="text-xs">{gameName}</Badge>;
                              })}
                            </div>
                            {u.status === "pending" && isAdmin && (
                              <Button size="sm" variant="outline" className="gap-1"
                                onClick={() => approveUserMutation.mutate(u.id)}
                                disabled={approveUserMutation.isPending}
                                data-testid={`button-approve-user-${u.id}`}>
                                <ShieldCheck className="h-3 w-3" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
