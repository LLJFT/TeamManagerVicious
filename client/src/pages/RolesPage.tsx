import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Plus, Trash2, Save, Pencil, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { permissionCategories, permissionLabels, type Permission } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  teamId: string;
}

type TabType = "user-roles" | "user-permissions";

// Categories shown in the Home/Platform editor: every category whose scope
// is "home" or "both". Driven entirely from shared/schema.ts so adding a new
// permission key only needs a single edit.
const HOME_CATEGORIES = permissionCategories.filter(
  (c) => c.scope === "home" || c.scope === "both"
);

function PermissionGroups({
  selected,
  onToggle,
  onSelectAllInCategory,
  testIdPrefix,
}: {
  selected: string[];
  onToggle: (perm: string) => void;
  onSelectAllInCategory: (perms: string[], allOn: boolean) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-5">
      {HOME_CATEGORIES.map((cat) => {
        const allOn = cat.permissions.every((p) => selected.includes(p));
        const someOn = cat.permissions.some((p) => selected.includes(p));
        return (
          <div key={cat.category} className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground">
                {cat.label}
              </h4>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={allOn ? true : someOn ? "indeterminate" : false}
                  onCheckedChange={() => onSelectAllInCategory(cat.permissions, allOn)}
                  data-testid={`${testIdPrefix}-select-all-${cat.category}`}
                />
                <span>Select all</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cat.permissions.map((perm) => {
                const meta = permissionLabels[perm as Permission];
                return (
                  <label
                    key={perm}
                    className="flex items-start gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(perm)}
                      onCheckedChange={() => onToggle(perm)}
                      data-testid={`${testIdPrefix}-perm-${perm}`}
                    />
                    <span className="leading-tight">
                      <span className="text-xs">{meta?.label ?? perm}</span>
                      {meta?.description && (
                        <span className="block text-[11px] text-muted-foreground">
                          {meta.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RolesPage() {
  const { t } = useTranslation();
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
      toast({ title: t("admin.roles.toasts.roleCreated") });
    },
    onError: (e: any) => toast({ title: t("admin.roles.toasts.genericError"), description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; permissions?: string[] }) => {
      await apiRequest("PUT", `/api/platform-roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-roles"] });
    },
    onError: (e: any) => toast({ title: t("admin.roles.toasts.genericError"), description: e.message, variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/platform-roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-roles"] });
      toast({ title: t("admin.roles.toasts.roleDeleted") });
    },
    onError: (e: any) => toast({ title: t("admin.roles.toasts.genericError"), description: e.message, variant: "destructive" }),
  });

  const togglePermissionAutoSave = (role: Role, perm: string) => {
    const current = role.permissions || [];
    const updated = current.includes(perm)
      ? current.filter(p => p !== perm)
      : [...current, perm];
    updateRoleMutation.mutate({ id: role.id, permissions: updated });
  };

  const selectAllInGroupAutoSave = (role: Role, groupPerms: readonly string[], allOn: boolean) => {
    const current = role.permissions || [];
    const updated = allOn
      ? current.filter((p) => !groupPerms.includes(p))
      : Array.from(new Set([...current, ...groupPerms]));
    updateRoleMutation.mutate({ id: role.id, permissions: updated });
  };

  const togglePermissionLocal = (perm: string) => {
    setNewRolePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const selectAllInGroupLocal = (groupPerms: readonly string[], allOn: boolean) => {
    setNewRolePermissions((prev) =>
      allOn
        ? prev.filter((p) => !groupPerms.includes(p))
        : Array.from(new Set([...prev, ...groupPerms]))
    );
  };

  if (isLoading) {
    return <div className="p-6"><p className="text-muted-foreground">{t("admin.roles.loadingRoles")}</p></div>;
  }

  const userRoleTypes = ["Player", "Staff", "Management"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-roles-title">{t("admin.roles.title")}</h1>
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
                <CardTitle className="text-base">{t("admin.roles.createNew")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder={t("admin.roles.nameInput")}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  data-testid="input-new-role-name"
                />
                <PermissionGroups
                  selected={newRolePermissions}
                  onToggle={togglePermissionLocal}
                  onSelectAllInCategory={selectAllInGroupLocal}
                  testIdPrefix="checkbox-role"
                />
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
                      {role.isSystem && <Badge variant="secondary" className="text-xs">{t("admin.roles.system")}</Badge>}
                      <Badge variant="outline" className="text-xs">{t("admin.roles.homePermission")}</Badge>
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
                <CardContent>
                  <PermissionGroups
                    selected={role.permissions || []}
                    onToggle={(perm) => togglePermissionAutoSave(role, perm)}
                    onSelectAllInCategory={(perms, allOn) => selectAllInGroupAutoSave(role, perms, allOn)}
                    testIdPrefix={`role-${role.id}`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
