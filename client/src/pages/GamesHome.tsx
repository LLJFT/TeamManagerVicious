import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Users, Trophy, Clock, UserCheck, UserX, CheckCircle, XCircle, LayoutDashboard, Gamepad2, ShieldCheck, Settings, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportedGame, OrgRole, Roster } from "@shared/schema";
import { orgRoleLabels } from "@shared/schema";
import {
  SiValorant, SiLeagueoflegends, SiCounterstrike, SiDota2, SiPubg,
  SiEa, SiActivision, SiEpicgames, SiUbisoft, SiRiotgames,
} from "react-icons/si";
import { useGame } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";

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
  "cod-mobile":   "#8CC63F",
  "mlbb":         "#1A7EC6",
  "hok":          "#FFB800",
  "hok-mobile":   "#FFB800",
  "brawl-stars":  "#FF2A6D",
  "marvel-rivals":"#E62429",
  "ea-fc":        "#00B2FF",
  "free-fire":    "#FF6B00",
  "free-fire-mobile": "#FF6B00",
  "tft":          "#C8AA6E",
  "crossfire":    "#00A1E0",
  "deadlock":     "#6B4226",
  "trackmania":   "#009DDC",
  "the-finals":   "#FFD700",
  "fighting-games":"#9333EA",
  "warzone":      "#8CC63F",
  "efootball":    "#1D5BA4",
};

const SI_ICONS: Record<string, any> = {
  "valorant":     SiValorant,
  "lol":          SiLeagueoflegends,
  "cs":           SiCounterstrike,
  "dota2":        SiDota2,
  "pubg":         SiPubg,
  "pubg-mobile":  SiPubg,
  "ea-fc":        SiEa,
  "cod":          SiActivision,
  "cod-mobile":   SiActivision,
  "warzone":      SiActivision,
  "fortnite":     SiEpicgames,
  "r6":           SiUbisoft,
  "tft":          SiRiotgames,
};

export function GameIcon({ slug, name, size = "md" }: { slug: string; name: string; size?: "sm" | "md" }) {
  const SIIcon = SI_ICONS[slug];
  const color = GAME_COLORS[slug] || "#6B7280";
  const abbr = name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  const dim = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const iconSize = size === "sm" ? 14 : 22;
  const textSize = size === "sm" ? "text-[9px]" : "text-xs";

  if (SIIcon) {
    return (
      <div className={`${dim} rounded-md flex items-center justify-center flex-shrink-0`} style={{ background: `${color}20` }}>
        <SIIcon style={{ color, fontSize: iconSize }} />
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-md flex items-center justify-center font-bold ${textSize} flex-shrink-0`} style={{ background: `${color}20`, color }}>
      {abbr}
    </div>
  );
}

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
  const { user, hasGameAccess, hasOrgRole } = useAuth();
  const [, navigate] = useLocation();
  const { setRosterId } = useGame();
  const { toast } = useToast();
  const isAdmin = hasOrgRole("org_admin");

  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: allRosters = [] } = useQuery<Record<string, Roster[]>>({
    queryKey: ["/api/all-rosters"],
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
    mutationFn: ({ id, type }: { id: string; type: "game" | "org" }) =>
      apiRequest("POST", `/api/game-assignments/${id}/approve-${type}`),
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
    if (!hasGameAccess(game.id)) return;
    setRosterId(roster.id || null);
    navigate(`/${game.slug}`);
  };

  const showDashboardTab = hasOrgRole("org_admin", "game_manager");

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Tabs defaultValue="games">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Home</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Select a roster to manage</p>
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
              {isAdmin && (
                <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>
          )}
        </div>

        <TabsContent value="games" className="mt-0">
          <div className="space-y-6">
            {allGames.map((game) => {
              const gameRosters = rosterCards.filter(rc => rc.game.id === game.id);
              if (gameRosters.length === 0) return null;
              return (
                <div key={game.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <GameIcon slug={game.slug} name={game.name} size="sm" />
                    <h2 className="text-sm font-semibold text-muted-foreground">{game.name}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {gameRosters.map(({ roster }) => {
                      const hasAccess = hasGameAccess(game.id);
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
                          {pa.rosterName && <Badge variant="outline">{pa.rosterName}</Badge>}
                          <Badge variant="outline">{pa.assignedRole}</Badge>
                          {pa.approvalGameStatus === "approved" && (
                            <Badge variant="default" className="text-[10px]">Game Approved</Badge>
                          )}
                          {pa.approvalOrgStatus === "approved" && (
                            <Badge variant="default" className="text-[10px]">Org Approved</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isAdmin && pa.approvalOrgStatus !== "approved" && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs"
                              onClick={() => approveMutation.mutate({ id: pa.id, type: "org" })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-org-${pa.id}`}>
                              <ShieldCheck className="h-3 w-3" />
                              Org Approve
                            </Button>
                          )}
                          {pa.approvalGameStatus !== "approved" && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs"
                              onClick={() => approveMutation.mutate({ id: pa.id, type: "game" })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-game-${pa.id}`}>
                              <CheckCircle className="h-3 w-3" />
                              Game Approve
                            </Button>
                          )}
                          <Button size="icon" variant="ghost"
                            onClick={() => rejectMutation.mutate(pa.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-${pa.id}`}>
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
                  Roster Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboard.gameSummaries.filter((gs: any) => gs.playerCount > 0).map((gs: any) => {
                    const game = allGames.find(g => g.id === gs.gameId);
                    return (
                      <Card key={gs.gameId}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            {game && <GameIcon slug={game.slug} name={game.name} size="sm" />}
                            <h3 className="font-semibold text-sm">{gs.gameName}</h3>
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
                              {gs.recentResults.slice(0, 3).map((r: any, i: number) => (
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
                            <Badge variant="outline">{orgRoleLabels[(u.orgRole as OrgRole) || "player"] || u.orgRole}</Badge>
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

        {isAdmin && (
          <TabsContent value="settings" className="mt-0 space-y-6">
            <OrgSettings allGames={allGames} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function OrgSettings({ allGames }: { allGames: SupportedGame[] }) {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const { data: currentOrgName } = useQuery<any>({
    queryKey: ["/api/org-setting/org_name"],
  });

  const saveOrgNameMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/org-setting/org_name", { value: orgName }),
    onSuccess: () => {
      toast({ title: "Organization name updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_name"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Organization Settings
        </h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization Name</label>
              <div className="flex items-center gap-2">
                <Input
                  value={orgName || currentOrgName?.value || ""}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  data-testid="input-org-name"
                />
                <Button
                  onClick={() => saveOrgNameMutation.mutate()}
                  disabled={saveOrgNameMutation.isPending}
                  data-testid="button-save-org-name"
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Shown as "[Org Name] Availability Times" in game pages</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
