import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Plus, Trash2, Save, Pencil, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Permission } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const HOME_PERMISSIONS: { label: string; value: string }[] = [
  { label: "View Dashboard", value: "view_dashboard" },
  { label: "View Calendar", value: "view_calendar" },
  { label: "View Upcoming Events", value: "view_upcoming_events" },
  { label: "View Users Tab", value: "view_users_tab" },
  { label: "Manage Users", value: "manage_users" },
  { label: "View Roles Tab", value: "view_roles_tab" },
  { label: "Manage Roles", value: "manage_roles" },
  { label: "View Game Access Tab", value: "view_game_access" },
  { label: "Manage Game Access", value: "manage_game_config" },
  { label: "View Chat", value: "view_chat" },
  { label: "Send Messages in Chat", value: "send_messages" },
  { label: "View Settings", value: "view_settings" },
  { label: "Manage Settings", value: "manage_settings" },
  { label: "View Activity Log", value: "view_activity_log" },
];

const GAME_PERMISSION_GROUPS: Record<string, { label: string; value: string }[]> = {
  "Schedule": [
    { label: "View Schedule", value: "view_schedule" },
    { label: "Edit Own Availability", value: "edit_own_availability" },
    { label: "Edit All Availability", value: "edit_all_availability" },
    { label: "Manage Schedule Players", value: "manage_schedule_players" },
  ],
  "Events": [
    { label: "View Events", value: "view_events" },
    { label: "Create Events", value: "create_events" },
    { label: "Edit Events", value: "edit_events" },
    { label: "Delete Events", value: "delete_events" },
  ],
  "Results": [
    { label: "View Results", value: "view_results" },
    { label: "Add Results", value: "add_results" },
    { label: "Edit Results", value: "edit_results" },
    { label: "Delete Results", value: "delete_results" },
  ],
  "Players": [
    { label: "View Players", value: "view_players" },
    { label: "Manage Players Tab", value: "manage_players_tab" },
  ],
  "Statistics": [
    { label: "View Statistics", value: "view_statistics" },
    { label: "View Player Stats", value: "view_player_stats" },
    { label: "View History", value: "view_history" },
    { label: "View Compare", value: "view_compare" },
    { label: "View Opponents", value: "view_opponents" },
  ],
  "Chat": [
    { label: "View Chat", value: "view_chat" },
    { label: "Send Messages", value: "send_messages" },
    { label: "Delete Own Messages", value: "delete_own_messages" },
    { label: "Delete Any Message", value: "delete_any_message" },
    { label: "Manage Channels", value: "manage_channels" },
  ],
  "Staff": [
    { label: "View Staff", value: "view_staff" },
    { label: "Manage Staff", value: "manage_staff" },
  ],
};

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  teamId: string;
}

type TabType = "user-roles" | "user-permissions";

export default function RolesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("user-roles");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);

  const { data: platformRoles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["/api/platform-roles"],
    queryFn: async () => {
      const res = await fetch("/api/platform-roles", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      await apiRequest("POST", "/api/platform-roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-roles"] });
      setNewRoleName("");
      setNewRolePermissions([]);
      setShowCreateForm(false);
      toast({ title: "Role created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; permissions?: string[] }) => {
      await apiRequest("PUT", `/api/platform-roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-roles"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/platform-roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-roles"] });
      toast({ title: "Role deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePermissionAutoSave = (role: Role, perm: string) => {
    const current = role.permissions || [];
    const updated = current.includes(perm)
      ? current.filter(p => p !== perm)
      : [...current, perm];
    updateRoleMutation.mutate({ id: role.id, permissions: updated });
  };

  const togglePermission = (perms: string[], perm: string, setter: (p: string[]) => void) => {
    if (perms.includes(perm)) {
      setter(perms.filter(p => p !== perm));
    } else {
      setter([...perms, perm]);
    }
  };

  if (isLoading) {
    return <div className="p-6"><p className="text-muted-foreground">Loading roles...</p></div>;
  }

  const userRoleTypes = ["Player", "Staff", "Management"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-roles-title">Roles & Permissions</h1>
      </div>

      <div className="flex gap-1 border-b">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "user-roles" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover-elevate"}`}
          onClick={() => setActiveTab("user-roles")}
          data-testid="tab-user-roles"
        >
          User Roles
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "user-permissions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover-elevate"}`}
          onClick={() => setActiveTab("user-permissions")}
          data-testid="tab-user-permissions"
        >
          User Permissions
        </button>
      </div>

      {activeTab === "user-roles" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These define what type of user someone is when they register. They describe the user's function within the organization.
          </p>
          <div className="space-y-2">
            {userRoleTypes.map(role => (
              <Card key={role}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{role}</span>
                    <Badge variant="secondary" className="text-xs">
                      {role === "Player" ? "Auto-assigned Member permission" :
                       role === "Staff" ? "Auto-assigned Member permission" :
                       "Auto-assigned Management permission"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            On approval: Players and Staff receive "Member" home permission. Management receives "Management" home permission.
          </p>
        </div>
      )}

      {activeTab === "user-permissions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Control what each permission level can access on the home platform. Changes save automatically.
            </p>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-create-role">
              <Plus className="h-4 w-4 mr-2" />
              Add Permission Role
            </Button>
          </div>

          {showCreateForm && (
            <Card>
              <CardHeader className="pb-3 gap-2">
                <CardTitle className="text-base">Create New Permission Role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Permission role name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  data-testid="input-new-role-name"
                />
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Home Permissions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {HOME_PERMISSIONS.map(perm => (
                      <label key={perm.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={newRolePermissions.includes(perm.value)}
                          onCheckedChange={() => togglePermission(newRolePermissions, perm.value, setNewRolePermissions)}
                          data-testid={`new-role-perm-${perm.value}`}
                        />
                        <span className="text-xs">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => createRoleMutation.mutate({ name: newRoleName, permissions: newRolePermissions })}
                    disabled={!newRoleName || createRoleMutation.isPending}
                    data-testid="button-save-new-role"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)} data-testid="button-cancel-create-role">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {platformRoles.map(role => (
              <Card key={role.id}>
                <CardHeader className="pb-3 gap-2">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      {editingRole === role.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-[200px]"
                            data-testid={`input-edit-role-name-${role.id}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              updateRoleMutation.mutate({ id: role.id, name: editName });
                              setEditingRole(null);
                            }}
                            disabled={updateRoleMutation.isPending || !editName.trim()}
                            data-testid={`button-save-role-name-${role.id}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingRole(null)} data-testid={`button-cancel-edit-${role.id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <CardTitle className="text-base">{role.name}</CardTitle>
                      )}
                      {role.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                      <Badge variant="outline" className="text-xs">Home Permission</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {editingRole !== role.id && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => { setEditingRole(role.id); setEditName(role.name); }} data-testid={`button-edit-role-${role.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!role.isSystem && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { if (confirm("Delete this role?")) deleteRoleMutation.mutate(role.id); }}
                              data-testid={`button-delete-role-${role.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Home Permissions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HOME_PERMISSIONS.map(perm => (
                        <label key={perm.value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={(role.permissions || []).includes(perm.value)}
                            onCheckedChange={() => togglePermissionAutoSave(role, perm.value)}
                            data-testid={`role-${role.id}-perm-${perm.value}`}
                          />
                          <span className="text-xs">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
