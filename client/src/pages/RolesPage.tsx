import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Plus, Trash2, Save, Pencil, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { allPermissions, type Permission } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const HOME_PERMISSION_GROUPS: Record<string, Permission[]> = {
  "Dashboard": ["view_dashboard", "manage_users", "manage_roles", "manage_game_config", "manage_stat_fields", "view_activity_log"],
};

const GAME_PERMISSION_GROUPS: Record<string, Permission[]> = {
  "Schedule": ["view_schedule", "edit_own_availability", "edit_all_availability", "manage_schedule_players"],
  "Events": ["view_events", "create_events", "edit_events", "delete_events"],
  "Results": ["view_results", "add_results", "edit_results", "delete_results"],
  "Players": ["view_players", "manage_players_tab"],
  "Statistics": ["view_statistics", "view_player_stats", "view_history", "view_compare", "view_opponents"],
  "Chat": ["view_chat", "send_messages", "delete_own_messages", "delete_any_message", "manage_channels"],
  "Staff": ["view_staff", "manage_staff"],
};

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  teamId: string;
}

export default function RolesPage() {
  const { toast } = useToast();
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

  const renderPermissionSection = (
    title: string,
    groups: Record<string, Permission[]>,
    perms: string[],
    onToggle: (perm: string) => void,
    testPrefix: string,
  ) => (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {Object.entries(groups).map(([group, groupPerms]) => (
        <div key={group}>
          <p className="text-sm font-medium mb-2">{group}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {groupPerms.map(perm => (
              <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={perms.includes(perm)}
                  onCheckedChange={() => onToggle(perm)}
                  data-testid={`${testPrefix}-perm-${perm}`}
                />
                <span className="text-xs">{perm.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCreatePermissionEditor = (perms: string[], setter: (p: string[]) => void, testPrefix: string) => (
    <div className="space-y-4 mt-4">
      {renderPermissionSection("Home Permissions", HOME_PERMISSION_GROUPS, perms, (perm) => togglePermission(perms, perm, setter), testPrefix)}
      <div className="border-t pt-4" />
      {renderPermissionSection("Game Permissions", GAME_PERMISSION_GROUPS, perms, (perm) => togglePermission(perms, perm, setter), testPrefix)}
    </div>
  );

  if (isLoading) {
    return <div className="p-6"><p className="text-muted-foreground">Loading roles...</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-roles-title">Platform Roles</h1>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-create-role">
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3 gap-2">
            <CardTitle className="text-base">Create New Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              data-testid="input-new-role-name"
            />
            {renderCreatePermissionEditor(newRolePermissions, setNewRolePermissions, "new-role")}
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
              {renderPermissionSection(
                "Home Permissions",
                HOME_PERMISSION_GROUPS,
                role.permissions || [],
                (perm) => togglePermissionAutoSave(role, perm),
                `role-${role.id}`,
              )}
              <div className="border-t pt-4" />
              {renderPermissionSection(
                "Game Permissions",
                GAME_PERMISSION_GROUPS,
                role.permissions || [],
                (perm) => togglePermissionAutoSave(role, perm),
                `role-${role.id}`,
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
