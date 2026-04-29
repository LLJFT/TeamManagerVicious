import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Shield, Search, Image as ImageIcon, ArrowUp, ArrowDown, Settings2, Check, X,
} from "lucide-react";
import type { Hero, HeroRoleConfig } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useGame } from "@/hooks/use-game";

interface HeroFormState {
  name: string;
  role: string;
  imageUrl: string | null;
  isActive: boolean;
}

const emptyForm: HeroFormState = {
  name: "",
  role: "",
  imageUrl: null,
  isActive: true,
};

const ROLE_COLORS: Record<string, string> = {
  Duelist: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  Vanguard: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  Strategist: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  Damage: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  Tank: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  Support: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export function HeroesConfiguration({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const { gameId, rosterId } = useGame();
  const [showDialog, setShowDialog] = useState(false);
  const [editingHero, setEditingHero] = useState<Hero | undefined>(undefined);
  const [form, setForm] = useState<HeroFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [activeRoleTab, setActiveRoleTab] = useState<string>("all");

  const { data: heroes = [], isLoading } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: roleConfigs = [], isLoading: roleConfigsLoading } = useQuery<HeroRoleConfig[]>({
    queryKey: ["/api/hero-role-configs", { gameId }],
    enabled: !!gameId,
  });

  const heroRoles = useMemo(
    () => [...roleConfigs]
      .filter(r => r.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(r => r.name),
    [roleConfigs]
  );

  const invalidateHeroes = () =>
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "/api/heroes" });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/heroes", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateHeroes();
      toast({ title: "Hero added" });
      setShowDialog(false);
    },
    onError: (e: any) => toast({ title: "Failed to add hero", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PUT", `/api/heroes/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      invalidateHeroes();
    },
    onError: (e: any) => toast({ title: "Failed to update hero", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/heroes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateHeroes();
      toast({ title: "Hero deleted" });
    },
    onError: (e: any) => toast({ title: "Failed to delete hero", description: e.message, variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      const res = await apiRequest("PUT", "/api/heroes/reorder", items);
      return res.json();
    },
    onSuccess: () => {
      invalidateHeroes();
    },
  });

  // ===== Hero Role Configs (per-game) =====
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [deleteConflict, setDeleteConflict] = useState<{ role: HeroRoleConfig; heroesAffected: number; reassignTo: string } | null>(null);

  const sortedRoleConfigs = useMemo(
    () => [...roleConfigs].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [roleConfigs]
  );

  const invalidateRoleConfigs = () =>
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "/api/hero-role-configs" });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; sortOrder: number; isActive: boolean }) => {
      const res = await apiRequest("POST", "/api/hero-role-configs", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRoleConfigs();
      setNewRoleName("");
      toast({ title: "Role added" });
    },
    onError: (e: any) => toast({ title: "Failed to add role", description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<{ name: string; isActive: boolean; sortOrder: number }> }) => {
      const res = await apiRequest("PUT", `/api/hero-role-configs/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      invalidateRoleConfigs();
      invalidateHeroes();
    },
    onError: (e: any) => toast({ title: "Failed to update role", description: e.message, variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async ({ id, reassignTo }: { id: string; reassignTo?: string }) => {
      const path = reassignTo ? `/api/hero-role-configs/${id}?reassignTo=${reassignTo}` : `/api/hero-role-configs/${id}`;
      const res = await fetch(path, { method: "DELETE", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    },
    onSuccess: (result, vars) => {
      if (result.status === 409) {
        const target = roleConfigs.find(r => r.id === vars.id);
        if (target) setDeleteConflict({ role: target, heroesAffected: result.body?.heroesAffected || 0, reassignTo: "" });
        return;
      }
      if (result.status >= 400) {
        toast({ title: "Failed to delete role", description: result.body?.error || `HTTP ${result.status}`, variant: "destructive" });
        return;
      }
      invalidateRoleConfigs();
      invalidateHeroes();
      setDeleteConflict(null);
      const reassigned = result.body?.heroesReassigned || 0;
      toast({ title: "Role deleted", description: reassigned > 0 ? `${reassigned} hero(es) reassigned to "${result.body?.replacement}"` : undefined });
    },
    onError: (e: any) => toast({ title: "Failed to delete role", description: e.message, variant: "destructive" }),
  });

  const moveRole = (index: number, direction: -1 | 1) => {
    const target = sortedRoleConfigs[index + direction];
    const current = sortedRoleConfigs[index];
    if (!target || !current) return;
    updateRoleMutation.mutate({ id: current.id, patch: { sortOrder: target.sortOrder } });
    updateRoleMutation.mutate({ id: target.id, patch: { sortOrder: current.sortOrder } });
  };

  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    const maxOrder = sortedRoleConfigs.reduce((m, r) => Math.max(m, r.sortOrder), -1);
    createRoleMutation.mutate({ name, sortOrder: maxOrder + 1, isActive: true });
  };

  const startEditRole = (r: HeroRoleConfig) => {
    setEditingRoleId(r.id);
    setEditingRoleName(r.name);
  };

  const saveEditRole = () => {
    const id = editingRoleId;
    const name = editingRoleName.trim();
    if (!id || !name) { setEditingRoleId(null); return; }
    const original = roleConfigs.find(r => r.id === id);
    if (original && original.name !== name) {
      updateRoleMutation.mutate({ id, patch: { name } }, { onSuccess: () => { setEditingRoleId(null); } });
    } else {
      setEditingRoleId(null);
    }
  };

  const requestDeleteRole = (r: HeroRoleConfig) => {
    if (!confirm(`Delete role "${r.name}"? Heroes using it will need to be reassigned.`)) return;
    deleteRoleMutation.mutate({ id: r.id });
  };

  const confirmReassignDelete = () => {
    if (!deleteConflict || !deleteConflict.reassignTo) return;
    deleteRoleMutation.mutate({ id: deleteConflict.role.id, reassignTo: deleteConflict.reassignTo });
  };

  const heroesByRole = useMemo(() => {
    const groups: Record<string, Hero[]> = {};
    for (const role of heroRoles) groups[role] = [];
    const others: Hero[] = [];
    const roleSet = new Set(heroRoles);
    for (const h of heroes) {
      if (roleSet.has(h.role)) {
        groups[h.role].push(h);
      } else {
        others.push(h);
      }
    }
    for (const role of Object.keys(groups)) {
      groups[role].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    if (others.length) groups["Other"] = others.sort((a, b) => a.sortOrder - b.sortOrder);
    return groups;
  }, [heroes, heroRoles]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result: Record<string, Hero[]> = {};
    for (const [role, list] of Object.entries(heroesByRole)) {
      const filtered = term ? list.filter(h => h.name.toLowerCase().includes(term)) : list;
      if (filtered.length || !term) result[role] = filtered;
    }
    return result;
  }, [heroesByRole, search]);

  const totalCount = heroes.length;
  const activeCount = heroes.filter(h => h.isActive).length;

  const openCreate = () => {
    setEditingHero(undefined);
    setForm({ ...emptyForm, role: heroRoles[0] || "" });
    setShowDialog(true);
  };

  const openEdit = (hero: Hero) => {
    setEditingHero(hero);
    setForm({
      name: hero.name,
      role: hero.role,
      imageUrl: hero.imageUrl,
      isActive: hero.isActive,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    const trimmed = form.name.trim();
    if (!trimmed) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: trimmed,
      role: form.role,
      imageUrl: form.imageUrl,
      isActive: form.isActive,
      sortOrder: editingHero?.sortOrder ?? heroes.length,
    };
    if (editingHero) {
      updateMutation.mutate({ id: editingHero.id, patch: payload }, {
        onSuccess: () => {
          toast({ title: "Hero updated" });
          setShowDialog(false);
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const moveHero = (role: string, index: number, direction: -1 | 1) => {
    const list = filteredGroups[role] || [];
    const target = list[index + direction];
    const current = list[index];
    if (!target || !current) return;
    reorderMutation.mutate([
      { id: current.id, sortOrder: target.sortOrder },
      { id: target.id, sortOrder: current.sortOrder },
    ]);
  };

  const toggleActive = (hero: Hero) => {
    updateMutation.mutate({ id: hero.id, patch: { isActive: !hero.isActive } });
  };

  const renderRoleSection = (role: string, list: Hero[]) => (
    <div key={role} className="space-y-2" data-testid={`group-heroes-${role.toLowerCase()}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={ROLE_COLORS[role] || ""} data-testid={`badge-role-${role.toLowerCase()}`}>
            {role}
          </Badge>
          <span className="text-xs text-muted-foreground" data-testid={`text-role-count-${role.toLowerCase()}`}>
            {list.length} {list.length === 1 ? "hero" : "heroes"}
          </span>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-2 py-3 border border-dashed border-border rounded-md">
          No heroes in this role
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {list.map((hero, idx) => (
            <div
              key={hero.id}
              className={`flex items-center gap-2 p-2 border border-border rounded-md ${hero.isActive ? "" : "opacity-60"}`}
              data-testid={`row-hero-${hero.id}`}
            >
              <Avatar className="h-9 w-9 shrink-0">
                {hero.imageUrl ? (
                  <AvatarImage src={hero.imageUrl} alt={hero.name} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {hero.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" data-testid={`text-hero-name-${hero.id}`}>{hero.name}</div>
                <div className="text-xs text-muted-foreground">{hero.isActive ? "Active" : "Inactive"}</div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0 || reorderMutation.isPending} onClick={() => moveHero(role, idx, -1)} data-testid={`button-hero-up-${hero.id}`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === list.length - 1 || reorderMutation.isPending} onClick={() => moveHero(role, idx, 1)} data-testid={`button-hero-down-${hero.id}`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={hero.isActive}
                      onCheckedChange={() => toggleActive(hero)}
                      data-testid={`switch-hero-active-${hero.id}`}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(hero)} data-testid={`button-edit-hero-${hero.id}`}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Delete hero "${hero.name}"?`)) deleteMutation.mutate(hero.id); }} data-testid={`button-delete-hero-${hero.id}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const visibleRoles = activeRoleTab === "all"
    ? Object.keys(filteredGroups)
    : Object.keys(filteredGroups).filter(r => r === activeRoleTab);

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Heroes Configuration</CardTitle>
              <CardDescription data-testid="text-heroes-summary">
                {totalCount} total · {activeCount} active
              </CardDescription>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setShowRolesDialog(true)} size="sm" className="gap-2" data-testid="button-manage-hero-roles">
                <Settings2 className="h-4 w-4" />
                Manage Roles
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-2" data-testid="button-add-hero">
                <Plus className="h-4 w-4" />
                Add Hero
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search heroes..."
              className="pl-8"
              data-testid="input-hero-search"
            />
          </div>
        </div>
        <Tabs value={activeRoleTab} onValueChange={setActiveRoleTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all" data-testid="tab-role-all">All</TabsTrigger>
            {heroRoles.map(role => (
              <TabsTrigger key={role} value={role} data-testid={`tab-role-${role.toLowerCase()}`}>
                {role}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={activeRoleTab} className="mt-4 space-y-6">
            {isLoading || roleConfigsLoading ? (
              <div className="text-center text-sm text-muted-foreground py-8">Loading heroes...</div>
            ) : totalCount === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">No heroes configured for this roster yet.</p>
                {canEdit && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Marvel Rivals rosters are auto-seeded with the default hero pool. For other games, click "Add Hero".
                  </p>
                )}
              </div>
            ) : visibleRoles.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No heroes match your search.</div>
            ) : (
              visibleRoles.map(role => renderRoleSection(role, filteredGroups[role] || []))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="dialog-hero">
          <DialogHeader>
            <DialogTitle>{editingHero ? "Edit Hero" : "Add Hero"}</DialogTitle>
            <DialogDescription>
              Configure the hero name, role, and image. Heroes are scoped to this roster only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hero-name">Name</Label>
              <Input
                id="hero-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Hero name"
                data-testid="input-hero-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger id="hero-role" data-testid="select-hero-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {heroRoles.map(role => (
                    <SelectItem key={role} value={role} data-testid={`option-hero-role-${role.toLowerCase()}`}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hero Image</Label>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 shrink-0">
                  {form.imageUrl ? <AvatarImage src={form.imageUrl} alt={form.name || "preview"} /> : null}
                  <AvatarFallback>
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <ObjectUploader
                    onUploaded={(r) => setForm(f => ({ ...f, imageUrl: r.url }))}
                    onError={(msg) => toast({ title: "Upload failed", description: msg, variant: "destructive" })}
                  >
                    {form.imageUrl ? "Replace Image" : "Upload Image"}
                  </ObjectUploader>
                  {form.imageUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, imageUrl: null }))} data-testid="button-hero-image-remove">
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
              <Input
                value={form.imageUrl || ""}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value || null })}
                placeholder="…or paste image URL"
                data-testid="input-hero-image-url"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hero-active" className="cursor-pointer">Active</Label>
              <Switch
                id="hero-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                data-testid="switch-hero-active-form"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel-hero">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-hero">
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRolesDialog} onOpenChange={(open) => { setShowRolesDialog(open); if (!open) { setEditingRoleId(null); setNewRoleName(""); setDeleteConflict(null); } }}>
        <DialogContent data-testid="dialog-manage-hero-roles">
          <DialogHeader>
            <DialogTitle>Manage Hero Roles</DialogTitle>
            <DialogDescription>
              Define the role set used by heroes in this game. Roles are scoped to the current game and used by Add/Edit Hero.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {canEdit && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-role-name">New role name</Label>
                  <Input
                    id="new-role-name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRole(); } }}
                    placeholder="e.g. Damage, Tank, Support"
                    data-testid="input-new-role-name"
                  />
                </div>
                <Button onClick={handleAddRole} disabled={!newRoleName.trim() || createRoleMutation.isPending} data-testid="button-add-role">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              {roleConfigsLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading roles...</div>
              ) : sortedRoleConfigs.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                  No roles configured yet. Add one above to get started.
                </div>
              ) : (
                sortedRoleConfigs.map((r, idx) => (
                  <div key={r.id} className={`flex items-center gap-2 p-2 border border-border rounded-md ${r.isActive ? "" : "opacity-60"}`} data-testid={`row-role-${r.id}`}>
                    {editingRoleId === r.id ? (
                      <Input
                        value={editingRoleName}
                        onChange={(e) => setEditingRoleName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEditRole(); } if (e.key === "Escape") setEditingRoleId(null); }}
                        autoFocus
                        className="flex-1"
                        data-testid={`input-edit-role-name-${r.id}`}
                      />
                    ) : (
                      <Badge variant="outline" className={`${ROLE_COLORS[r.name] || ""} text-sm`} data-testid={`text-role-name-${r.id}`}>{r.name}</Badge>
                    )}
                    <span className="flex-1" />
                    {canEdit && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {editingRoleId === r.id ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditRole} data-testid={`button-save-role-${r.id}`}>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoleId(null)} data-testid={`button-cancel-edit-role-${r.id}`}>
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0 || updateRoleMutation.isPending} onClick={() => moveRole(idx, -1)} data-testid={`button-role-up-${r.id}`}>
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === sortedRoleConfigs.length - 1 || updateRoleMutation.isPending} onClick={() => moveRole(idx, 1)} data-testid={`button-role-down-${r.id}`}>
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Switch
                              checked={r.isActive}
                              onCheckedChange={(v) => updateRoleMutation.mutate({ id: r.id, patch: { isActive: v } })}
                              data-testid={`switch-role-active-${r.id}`}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditRole(r)} data-testid={`button-edit-role-${r.id}`}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => requestDeleteRole(r)} data-testid={`button-delete-role-${r.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRolesDialog(false)} data-testid="button-close-manage-roles">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConflict} onOpenChange={(open) => { if (!open) setDeleteConflict(null); }}>
        <DialogContent data-testid="dialog-reassign-role">
          <DialogHeader>
            <DialogTitle>Reassign heroes before deleting</DialogTitle>
            <DialogDescription>
              {deleteConflict ? `${deleteConflict.heroesAffected} hero(es) currently use the "${deleteConflict.role.name}" role. Pick a replacement role to migrate them to.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reassign-target">Replacement role</Label>
            <Select
              value={deleteConflict?.reassignTo || ""}
              onValueChange={(v) => setDeleteConflict(c => c ? { ...c, reassignTo: v } : c)}
            >
              <SelectTrigger id="reassign-target" data-testid="select-reassign-target">
                <SelectValue placeholder="Select replacement role" />
              </SelectTrigger>
              <SelectContent>
                {sortedRoleConfigs
                  .filter(r => r.id !== deleteConflict?.role.id)
                  .map(r => (
                    <SelectItem key={r.id} value={r.id} data-testid={`option-reassign-${r.id}`}>{r.name}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConflict(null)} data-testid="button-cancel-reassign">Cancel</Button>
            <Button onClick={confirmReassignDelete} disabled={!deleteConflict?.reassignTo || deleteRoleMutation.isPending} data-testid="button-confirm-reassign-delete">
              {deleteRoleMutation.isPending ? "Deleting..." : "Reassign & Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
