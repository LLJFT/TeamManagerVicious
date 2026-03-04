import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Upload, Palette, Activity, Shield, Gamepad2, Plus, Trash2, Pencil, Save, X, Image, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportedGame, Roster, Permission } from "@shared/schema";
import { allPermissions } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

const PERMISSION_GROUPS: Record<string, string[]> = {
  "Schedule": ["view_schedule", "edit_own_availability", "edit_all_availability", "manage_schedule_players"],
  "Events": ["view_events", "create_events", "edit_events", "delete_events"],
  "Results": ["view_results", "add_results", "edit_results", "delete_results"],
  "Players": ["view_players", "manage_players_tab"],
  "Statistics": ["view_statistics", "view_player_stats", "view_history", "view_compare", "view_opponents"],
  "Chat": ["view_chat", "send_messages", "delete_own_messages", "delete_any_message", "manage_channels"],
  "Staff": ["view_staff", "manage_staff"],
  "Dashboard": ["view_dashboard", "manage_users", "manage_roles", "manage_game_config", "manage_stat_fields", "view_activity_log"],
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const lastUploadPathRef = useRef<string>("");
  const [addGameName, setAddGameName] = useState("");
  const [addGameSlug, setAddGameSlug] = useState("");
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [editGameName, setEditGameName] = useState("");
  const [addRosterFor, setAddRosterFor] = useState<string | null>(null);
  const [newRosterName, setNewRosterName] = useState("");
  const [editingRoster, setEditingRoster] = useState<string | null>(null);
  const [editRosterName, setEditRosterName] = useState("");
  const [editingMgmtPerms, setEditingMgmtPerms] = useState(false);
  const [mgmtPermissions, setMgmtPermissions] = useState<string[]>([]);

  const { data: currentOrgName } = useQuery<string | null>({ queryKey: ["/api/org-setting/org_name"] });
  const { data: orgLogoUrl } = useQuery<string | null>({ queryKey: ["/api/org-setting/org_logo"] });
  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/org-activity-logs"],
    queryFn: async () => {
      const res = await fetch("/api/org-activity-logs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: allGames = [] } = useQuery<SupportedGame[]>({ queryKey: ["/api/supported-games"] });
  const { data: allRostersMap = {} } = useQuery<Record<string, Roster[]>>({ queryKey: ["/api/all-rosters"] });
  const { data: platformRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/platform-roles"],
    queryFn: async () => {
      const res = await fetch("/api/platform-roles", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const managementRole = useMemo(() => platformRoles.find(r => r.name === "Management" || r.name === "Owner"), [platformRoles]);

  const saveOrgNameMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/org-setting/org_name", { value: orgName }),
    onSuccess: () => { toast({ title: "Organization name updated" }); queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_name"] }); },
  });

  const saveLogoMutation = useMutation({
    mutationFn: (url: string) => apiRequest("PUT", "/api/org-setting/org_logo", { value: url }),
    onSuccess: () => { toast({ title: "Logo updated" }); queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_logo"] }); },
  });

  const saveThemeMutation = useMutation({
    mutationFn: (colors: string) => apiRequest("PUT", "/api/org-setting/org_theme", { value: colors }),
    onSuccess: () => { toast({ title: "Theme applied" }); queryClient.invalidateQueries({ queryKey: ["/api/org-setting/org_theme"] }); },
  });

  const addGameMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/supported-games", { name: addGameName, slug: addGameSlug || addGameName.toLowerCase().replace(/[^a-z0-9]/g, '-') });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supported-games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-rosters"] });
      setAddGameName(""); setAddGameSlug("");
      toast({ title: "Game added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editGameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiRequest("PUT", `/api/supported-games/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supported-games"] });
      setEditingGame(null);
      toast({ title: "Game updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/supported-games/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supported-games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-rosters"] });
      toast({ title: "Game deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addRosterMutation = useMutation({
    mutationFn: async ({ gameId, name }: { gameId: string; name: string }) => {
      await apiRequest("POST", `/api/supported-games/${gameId}/rosters`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-rosters"] });
      setAddRosterFor(null); setNewRosterName("");
      toast({ title: "Roster added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renameRosterMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiRequest("PUT", `/api/rosters/${id}/rename`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-rosters"] });
      setEditingRoster(null);
      toast({ title: "Roster renamed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRosterMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rosters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-rosters"] });
      toast({ title: "Roster deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMgmtPermsMutation = useMutation({
    mutationFn: async (perms: string[]) => {
      if (!managementRole) return;
      await apiRequest("PUT", `/api/platform-roles/${managementRole.id}`, { permissions: perms });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-roles"] });
      setEditingMgmtPerms(false);
      toast({ title: "Management permissions updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const extractColorsFromLogo = () => {
    if (!orgLogoUrl) { toast({ title: "Upload a logo first", variant: "destructive" }); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorCounts: Record<string, { r: number; g: number; b: number; count: number }> = {};
      for (let i = 0; i < data.length; i += 16) {
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i + 1] / 32) * 32;
        const b = Math.round(data[i + 2] / 32) * 32;
        const a = data[i + 3];
        if (a < 128 || r + g + b < 60 || r + g + b > 700) continue;
        const key = `${r},${g},${b}`;
        if (!colorCounts[key]) colorCounts[key] = { r, g, b, count: 0 };
        colorCounts[key].count++;
      }
      const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);
      if (sorted.length === 0) { toast({ title: "Could not extract colors", variant: "destructive" }); return; }
      const dom = sorted[0];
      const { h, s, l } = rgbToHsl(dom.r, dom.g, dom.b);
      const hslStr = `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
      const fgL = l > 50 ? 10 : 98;
      const fgStr = `${Math.round(h)} ${Math.round(s * 0.1)}% ${fgL}%`;
      document.documentElement.style.setProperty("--primary", hslStr);
      document.documentElement.style.setProperty("--primary-foreground", fgStr);
      document.documentElement.style.setProperty("--sidebar-primary", hslStr);
      document.documentElement.style.setProperty("--sidebar-primary-foreground", fgStr);
      saveThemeMutation.mutate(JSON.stringify({ primary: hslStr, primaryForeground: fgStr }));
    };
    img.onerror = () => toast({ title: "Could not load logo image", variant: "destructive" });
    img.src = orgLogoUrl;
  };

  const togglePerm = (perm: string) => {
    setMgmtPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
      </div>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Organization Name
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              value={orgName || currentOrgName || ""}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Enter organization name"
              data-testid="input-org-name"
            />
            <Button onClick={() => saveOrgNameMutation.mutate()} disabled={saveOrgNameMutation.isPending} data-testid="button-save-org-name">
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4" />
            Organization Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {orgLogoUrl ? (
              <img src={orgLogoUrl} alt="Current Logo" className="h-16 w-16 rounded-md object-contain border p-1" data-testid="img-current-logo" />
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
          <Button variant="outline" onClick={extractColorsFromLogo} disabled={saveThemeMutation.isPending} data-testid="button-generate-theme">
            <Palette className="h-4 w-4 mr-2" />
            Generate Theme from Logo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Management Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Configure what Management role users can do. They start with no permissions — assign exactly what you want.</p>
          {managementRole && (
            <>
              {editingMgmtPerms ? (
                <div className="space-y-4">
                  {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                    <div key={group}>
                      <p className="text-sm font-medium mb-2">{group}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {perms.map(perm => (
                          <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={mgmtPermissions.includes(perm)} onCheckedChange={() => togglePerm(perm)} data-testid={`mgmt-perm-${perm}`} />
                            <span className="text-xs">{perm.replace(/_/g, " ")}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button onClick={() => updateMgmtPermsMutation.mutate(mgmtPermissions)} disabled={updateMgmtPermsMutation.isPending} data-testid="button-save-mgmt-perms">
                      <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                    <Button variant="outline" onClick={() => setEditingMgmtPerms(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(managementRole.permissions || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No permissions assigned</p>
                    ) : (
                      (managementRole.permissions || []).map((perm: string) => (
                        <Badge key={perm} variant="outline" className="text-xs">{perm.replace(/_/g, " ")}</Badge>
                      ))
                    )}
                  </div>
                  <Button variant="outline" onClick={() => { setMgmtPermissions([...(managementRole.permissions || [])]); setEditingMgmtPerms(true); }} data-testid="button-edit-mgmt-perms">
                    <Pencil className="h-4 w-4 mr-2" /> Edit Permissions
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gamepad2 className="h-4 w-4" />
            Game Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Game Name</label>
              <Input value={addGameName} onChange={(e) => setAddGameName(e.target.value)} placeholder="e.g., Rocket League" data-testid="input-add-game-name" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Slug</label>
              <Input value={addGameSlug} onChange={(e) => setAddGameSlug(e.target.value)} placeholder="e.g., rocket-league" data-testid="input-add-game-slug" />
            </div>
            <Button onClick={() => addGameMutation.mutate()} disabled={!addGameName || addGameMutation.isPending} data-testid="button-add-game">
              <Plus className="h-4 w-4 mr-2" /> Add Game
            </Button>
          </div>

          <div className="space-y-3">
            {allGames.map(game => {
              const gameRosters = allRostersMap[game.id] || [];
              return (
                <div key={game.id} className="border rounded-md p-3 space-y-2" data-testid={`card-game-${game.id}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {editingGame === game.id ? (
                      <div className="flex items-center gap-2">
                        <Input value={editGameName} onChange={(e) => setEditGameName(e.target.value)} className="w-[200px]" data-testid={`input-edit-game-${game.id}`} />
                        <Button size="sm" onClick={() => editGameMutation.mutate({ id: game.id, name: editGameName })} disabled={editGameMutation.isPending}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingGame(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{game.name}</span>
                    )}
                    <div className="flex items-center gap-1">
                      {editingGame !== game.id && (
                        <Button size="icon" variant="ghost" onClick={() => { setEditingGame(game.id); setEditGameName(game.name); }} data-testid={`button-edit-game-${game.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${game.name}"?`)) deleteGameMutation.mutate(game.id); }} data-testid={`button-delete-game-${game.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="pl-4 space-y-1">
                    {gameRosters.map(roster => (
                      <div key={roster.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`row-roster-${roster.id}`}>
                        {editingRoster === roster.id ? (
                          <div className="flex items-center gap-2">
                            <Input value={editRosterName} onChange={(e) => setEditRosterName(e.target.value)} className="w-[160px]" />
                            <Button size="sm" onClick={() => renameRosterMutation.mutate({ id: roster.id, name: editRosterName })}>
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingRoster(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span>{roster.name}</span>
                        )}
                        <div className="flex items-center gap-1">
                          {editingRoster !== roster.id && (
                            <Button size="icon" variant="ghost" onClick={() => { setEditingRoster(roster.id); setEditRosterName(roster.name); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete roster "${roster.name}"?`)) deleteRosterMutation.mutate(roster.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {addRosterFor === game.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input value={newRosterName} onChange={(e) => setNewRosterName(e.target.value)} placeholder="Roster name" className="w-[160px]" data-testid={`input-add-roster-${game.id}`} />
                        <Button size="sm" onClick={() => addRosterMutation.mutate({ gameId: game.id, name: newRosterName })} disabled={!newRosterName}>
                          Add
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddRosterFor(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setAddRosterFor(game.id)} className="mt-1" data-testid={`button-add-roster-${game.id}`}>
                        <Plus className="h-3 w-3 mr-1" /> Add Roster
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {activityLogs.slice(0, 50).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    <span className="text-muted-foreground truncate">{log.details}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{log.actorName || "System"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
