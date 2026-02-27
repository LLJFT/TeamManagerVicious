import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Users, Trophy, Clock, UserCheck, UserX, CheckCircle, XCircle, LayoutDashboard, Gamepad2, ShieldCheck, Settings, Upload, Plus, ChevronDown, ChevronRight, Calendar, Image, Palette, Activity, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportedGame, OrgRole, Roster } from "@shared/schema";
import { orgRoleLabels } from "@shared/schema";
import { useGame } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import { GameIcon } from "@/components/game-icon";
import { ObjectUploader } from "@/components/ObjectUploader";

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
  const { user, hasGameAccess, hasRosterAccess, hasOrgRole } = useAuth();
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
    const canAccess = roster.id ? hasRosterAccess(game.id, roster.id) : hasGameAccess(game.id);
    if (!canAccess) return;
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

            <RosterOverviewSection dashboard={dashboard} allGames={allGames} isAdmin={isAdmin} />
            <EventOverviewSection dashboard={dashboard} allGames={allGames} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="settings" className="mt-0 space-y-6">
            <OrgSettings allGames={allGames} dashboard={dashboard} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function RosterOverviewSection({ dashboard, allGames, isAdmin }: { dashboard: any; allGames: SupportedGame[]; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!isAdmin || !dashboard?.rosterSummaries) return null;

  const summaries = dashboard.rosterSummaries.filter((rs: any) => rs.memberCount > 0 || rs.members?.length > 0);
  if (summaries.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Users className="h-5 w-5" />
        Roster Overview
      </h2>
      <div className="space-y-2">
        {summaries.map((rs: any) => {
          const game = allGames.find(g => g.id === rs.gameId);
          const key = `${rs.gameId}-${rs.rosterId}`;
          const isOpen = expanded[key] || false;
          return (
            <Card key={key}>
              <CardContent className="p-0">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover-elevate rounded-md"
                  onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  data-testid={`roster-overview-toggle-${rs.gameSlug}-${rs.rosterSlug}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {game && <GameIcon slug={game.slug} name={game.name} size="sm" />}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{rs.gameName} — {rs.rosterName}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {rs.memberCount}</span>
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-green-600" /> {rs.attendance.attended}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-yellow-600" /> {rs.attendance.late}</span>
                        <span className="flex items-center gap-1"><UserX className="h-3 w-3 text-red-600" /> {rs.attendance.absent}</span>
                      </div>
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && rs.members?.length > 0 && (
                  <div className="border-t px-4 py-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Members</p>
                    {rs.members.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between text-sm py-1">
                        <span>{m.name}</span>
                        <Badge variant="secondary" className="text-xs">{m.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EventOverviewSection({ dashboard, allGames, isAdmin }: { dashboard: any; allGames: SupportedGame[]; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!isAdmin || !dashboard?.rosterSummaries) return null;

  const withEvents = dashboard.rosterSummaries.filter((rs: any) => rs.recentResults?.length > 0 || rs.nextEvents?.length > 0);
  if (withEvents.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Event Overview
      </h2>
      <div className="space-y-2">
        {withEvents.map((rs: any) => {
          const game = allGames.find(g => g.id === rs.gameId);
          const key = `evt-${rs.gameId}-${rs.rosterId}`;
          const isOpen = expanded[key] || false;
          return (
            <Card key={key}>
              <CardContent className="p-0">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover-elevate rounded-md"
                  onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  data-testid={`event-overview-toggle-${rs.gameSlug}-${rs.rosterSlug}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {game && <GameIcon slug={game.slug} name={game.name} size="sm" />}
                    <span className="text-sm font-medium">{rs.gameName} — {rs.rosterName}</span>
                    <div className="flex flex-wrap gap-1">
                      {rs.recentResults?.slice(0, 3).map((r: any, i: number) => (
                        <Badge key={i} variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}>
                          {r.result === "win" ? "W" : r.result === "loss" ? "L" : r.result === "draw" ? "D" : "—"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="border-t px-4 py-3 space-y-3">
                    {rs.recentResults?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Recent Results</p>
                        {rs.recentResults.map((r: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1">
                            <span>{r.title || "Match"}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{r.date}</span>
                              <Badge variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}>
                                {r.result === "win" ? "Win" : r.result === "loss" ? "Loss" : r.result === "draw" ? "Draw" : r.result || "—"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {rs.nextEvents?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Upcoming Events</p>
                        {rs.nextEvents.map((e: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1">
                            <span>{e.title || "Event"}</span>
                            <span className="text-xs text-muted-foreground">{e.date}{e.time ? ` at ${e.time}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OrgSettings({ allGames, dashboard }: { allGames: SupportedGame[]; dashboard: any }) {
  const { toast } = useToast();
  const { hasOrgRole } = useAuth();
  const [orgName, setOrgName] = useState("");
  const { data: currentOrgName } = useQuery<string | null>({
    queryKey: ["/api/org-setting/org_name"],
  });
  const { data: orgLogoUrl } = useQuery<string | null>({
    queryKey: ["/api/org-setting/org_logo"],
  });
  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/org-activity-logs"],
  });

  const saveOrgNameMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/org-setting/org_name", { value: orgName }),
    onSuccess: () => {
      toast({ title: "Organization name updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_name"] });
    },
  });

  const lastUploadPathRef = useRef<string>("");

  const saveLogoMutation = useMutation({
    mutationFn: (url: string) => apiRequest("PUT", "/api/org-setting/org_logo", { value: url }),
    onSuccess: () => {
      toast({ title: "Logo updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_logo"] });
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: (colors: string) => apiRequest("PUT", "/api/org-setting/org_theme", { value: colors }),
    onSuccess: () => {
      toast({ title: "Theme applied and saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_theme"] });
    },
  });

  const changeOrgRoleMutation = useMutation({
    mutationFn: ({ userId, orgRole }: { userId: string; orgRole: string }) =>
      apiRequest("PUT", `/api/users/${userId}/org-role`, { orgRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
      toast({ title: "Role updated" });
    },
  });

  const approveUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/users/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
      toast({ title: "User approved" });
    },
  });

  const extractColorsFromLogo = () => {
    const logoUrl = orgLogoUrl;
    if (!logoUrl) {
      toast({ title: "Upload a logo first", variant: "destructive" });
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorCounts: Record<string, { r: number; g: number; b: number; count: number }> = {};
      for (let i = 0; i < data.length; i += 16) {
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i + 1] / 32) * 32;
        const b = Math.round(data[i + 2] / 32) * 32;
        const a = data[i + 3];
        if (a < 128) continue;
        if (r + g + b < 60 || r + g + b > 700) continue;
        const key = `${r},${g},${b}`;
        if (!colorCounts[key]) colorCounts[key] = { r, g, b, count: 0 };
        colorCounts[key].count++;
      }
      const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);
      if (sorted.length === 0) {
        toast({ title: "Could not extract colors", variant: "destructive" });
        return;
      }
      const dominant = sorted[0];
      const { h, s, l } = rgbToHsl(dominant.r, dominant.g, dominant.b);
      const hslStr = `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
      const fgL = l > 50 ? 10 : 98;
      const fgStr = `${Math.round(h)} ${Math.round(s * 0.1)}% ${fgL}%`;
      document.documentElement.style.setProperty("--primary", hslStr);
      document.documentElement.style.setProperty("--primary-foreground", fgStr);
      document.documentElement.style.setProperty("--sidebar-primary", hslStr);
      document.documentElement.style.setProperty("--sidebar-primary-foreground", fgStr);
      saveThemeMutation.mutate(JSON.stringify({ primary: hslStr, primaryForeground: fgStr }));
      toast({ title: "Theme generated from logo colors" });
    };
    img.onerror = () => toast({ title: "Could not load logo image", variant: "destructive" });
    img.src = logoUrl;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Organization Name
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={orgName || currentOrgName || ""}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4" />
            Organization Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt="Current Logo"
                className="h-16 w-16 rounded-md object-contain border p-1"
                data-testid="img-current-logo"
              />
            ) : (
              <div className="h-16 w-16 rounded-md border flex items-center justify-center bg-muted">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-2">
              <ObjectUploader
                onGetUploadParameters={async () => {
                  const res = await apiRequest("POST", "/api/objects/upload");
                  const data = await res.json();
                  lastUploadPathRef.current = data.normalizedPath;
                  return { method: "PUT" as const, url: data.uploadURL };
                }}
                onComplete={(result) => {
                  if (result.successful?.length && lastUploadPathRef.current) {
                    saveLogoMutation.mutate(lastUploadPathRef.current);
                  }
                }}
                buttonVariant="outline"
                buttonSize="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </ObjectUploader>
              <p className="text-xs text-muted-foreground">Replaces the shield icon in the sidebar</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Dynamic Theme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Extract colors from your logo and apply them as the platform theme.</p>
          <Button
            variant="outline"
            onClick={extractColorsFromLogo}
            disabled={saveThemeMutation.isPending}
            data-testid="button-generate-theme"
          >
            <Palette className="h-4 w-4 mr-2" />
            Generate Theme from Logo
          </Button>
        </CardContent>
      </Card>

      {dashboard?.users && (
        <Card>
          <CardHeader className="pb-3 gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manage All Users ({dashboard.users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[400px] overflow-auto">
              {dashboard.users.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 px-4 py-3" data-testid={`settings-user-row-${u.id}`}>
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-medium text-sm">{u.username}</span>
                    <Badge variant={u.status === "active" ? "default" : u.status === "pending" ? "secondary" : "destructive"}>
                      {u.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <Select
                      value={u.orgRole || "player"}
                      onValueChange={(v) => changeOrgRoleMutation.mutate({ userId: u.id, orgRole: v })}
                    >
                      <SelectTrigger className="w-[130px]" data-testid={`select-org-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="coach_analyst">Staff</SelectItem>
                        <SelectItem value="game_manager">Game Manager</SelectItem>
                        <SelectItem value="org_admin">Management</SelectItem>
                      </SelectContent>
                    </Select>
                    {u.status === "pending" && (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => approveUserMutation.mutate(u.id)}
                        disabled={approveUserMutation.isPending}
                        data-testid={`button-settings-approve-${u.id}`}>
                        <ShieldCheck className="h-3 w-3" />
                        Approve
                      </Button>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {u.games?.map((g: any) => {
                        const gameName = allGames.find(sg => sg.id === g.gameId)?.name || "Unknown";
                        return <Badge key={g.id} variant="secondary" className="text-xs">{gameName}</Badge>;
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {activityLogs.slice(0, 50).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    <span className="text-muted-foreground truncate">{log.details}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {log.actorName || "System"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { h, s: s * 100, l: l * 100 };
}
