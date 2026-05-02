import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Opponent, OpponentPlayer, RosterRole } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OpponentPlayerForm {
  name: string;
  ign: string;
  role: string;
  isStarter: boolean;
  notes: string;
}

const emptyOppPlayer: OpponentPlayerForm = {
  name: "",
  ign: "",
  role: "",
  isStarter: true,
  notes: "",
};

// Mirrors the template-apply convention in server/storage.ts:
// applyGameTemplate stores opponent players as `"DisplayName (ign)"` in
// `opponent_players.name` (no separate IGN column). Parse that back into
// separate fields for editing, then re-bake on save.
function splitNameAndIgn(stored: string): { name: string; ign: string } {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(stored ?? "");
  if (m) return { name: m[1].trim(), ign: m[2].trim() };
  return { name: stored ?? "", ign: "" };
}

function combineNameAndIgn(name: string, ign: string): string {
  const n = name.trim();
  const i = ign.trim();
  return i ? `${n} (${i})` : n;
}

export function OpponentRosterDialog({
  opponent,
  canEdit,
  onClose,
}: {
  opponent: Opponent | undefined;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<OpponentPlayerForm>(emptyOppPlayer);
  const [editingPlayer, setEditingPlayer] = useState<OpponentPlayer | undefined>();

  const playersKey = ["/api/opponents", opponent?.id, "players"];

  const { data: players = [], isLoading } = useQuery<OpponentPlayer[]>({
    queryKey: playersKey,
    enabled: !!opponent,
    queryFn: async () => {
      const r = await fetch(`/api/opponents/${opponent!.id}/players`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load players");
      return r.json();
    },
  });

  // Roster-roles for the role dropdown — same pattern as the Dashboard
  // and the template editor's "View Roster" dialog. The default fetcher
  // injects gameId/rosterId from the current roster context.
  const { data: rosterRoles = [] } = useQuery<RosterRole[]>({
    queryKey: ["/api/roster-roles", { gameId: opponent?.gameId, rosterId: opponent?.rosterId }],
    enabled: !!opponent,
  });
  const playerRoles = useMemo(
    () => rosterRoles.filter(r => (r.type ?? "player") === "player").map(r => r.name),
    [rosterRoles],
  );
  // Preserve the currently-selected role even when it's not in the roster's
  // configured rosterRoles list (e.g. legacy data, or role typed before
  // rosterRoles existed). Otherwise the Select would render empty and the
  // value would silently flip on save.
  const roleOptions = useMemo(() => {
    const r = form.role.trim();
    if (r && !playerRoles.includes(r)) return [r, ...playerRoles];
    return playerRoles;
  }, [playerRoles, form.role]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/opponents/${opponent!.id}/players`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playersKey });
      setForm(emptyOppPlayer);
      toast({ title: "Player added" });
    },
    onError: (e: any) => toast({ title: "Failed to add player", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PUT", `/api/opponent-players/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playersKey });
      setEditingPlayer(undefined);
      setForm(emptyOppPlayer);
    },
    onError: (e: any) => toast({ title: "Failed to update player", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/opponent-players/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playersKey });
      toast({ title: "Player removed" });
    },
    onError: (e: any) => toast({ title: "Failed to delete player", description: e.message, variant: "destructive" }),
  });

  const handleAddOrUpdate = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({ title: "Player name is required", variant: "destructive" });
      return;
    }
    // Bake "Display (ign)" so the existing template-apply convention is preserved.
    const bakedName = combineNameAndIgn(trimmedName, form.ign);
    const payload = {
      name: bakedName,
      role: form.role.trim() || null,
      isStarter: form.isStarter,
      notes: form.notes.trim() || null,
      sortOrder: editingPlayer?.sortOrder ?? players.length,
    };
    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, patch: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (p: OpponentPlayer) => {
    const split = splitNameAndIgn(p.name);
    setEditingPlayer(p);
    setForm({
      name: split.name,
      ign: split.ign,
      role: p.role ?? "",
      isStarter: p.isStarter,
      notes: p.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingPlayer(undefined);
    setForm(emptyOppPlayer);
  };

  // Pre-split players so the displayed name and IGN match the template editor's split fields.
  const sortedPlayers = useMemo(() =>
    [...players]
      .map(p => ({ ...p, _split: splitNameAndIgn(p.name) }))
      .sort((a, b) => Number(b.isStarter) - Number(a.isStarter) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  [players]);

  return (
    <Dialog open={!!opponent} onOpenChange={(v) => { if (!v) { cancelEdit(); onClose(); } }}>
      <DialogContent className="max-w-2xl" data-testid="dialog-opponent-roster">
        <DialogHeader>
          <DialogTitle>{opponent?.name} – Roster</DialogTitle>
          <DialogDescription>
            Manage the opponent team's players. Used for per-player matchup analytics.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {canEdit && (
            <div className="border border-border rounded-md p-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {editingPlayer ? "Edit Player" : "Add Player"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Player name"
                  data-testid="input-opp-player-name"
                />
                <Input
                  value={form.ign}
                  onChange={(e) => setForm({ ...form, ign: e.target.value })}
                  placeholder="IGN (optional)"
                  data-testid="input-opp-player-ign"
                />
              </div>
              <div>
                {roleOptions.length > 0 ? (
                  <Select
                    value={form.role || "__none__"}
                    onValueChange={(v) => setForm({ ...form, role: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger data-testid="select-opp-player-role"><SelectValue placeholder="Role (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(none)</SelectItem>
                      {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Role (e.g. Duelist)"
                    data-testid="input-opp-player-role"
                  />
                )}
              </div>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes (signature heroes, tendencies...)"
                rows={2}
                className="resize-none border text-sm"
                data-testid="textarea-opp-player-notes"
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={form.isStarter}
                    onCheckedChange={(v) => setForm({ ...form, isStarter: v })}
                    data-testid="switch-opp-player-starter"
                  />
                  Starter
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {editingPlayer && (
                    <Button variant="outline" size="sm" onClick={cancelEdit} data-testid="button-opp-player-cancel">
                      Cancel
                    </Button>
                  )}
                  <Button size="sm" onClick={handleAddOrUpdate} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-opp-player-save">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {editingPlayer ? "Save" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Players ({players.length})
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : players.length === 0 ? (
              <div className="text-sm text-muted-foreground italic px-2 py-3 border border-dashed border-border rounded-md">
                No players added yet.
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {sortedPlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2 border border-border rounded-md" data-testid={`row-opp-player-${p.id}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {p._split.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate" data-testid={`text-opp-player-name-${p.id}`}>{p._split.name}</span>
                        {p._split.ign && (
                          <Badge variant="outline" data-testid={`badge-opp-player-ign-${p.id}`}>{p._split.ign}</Badge>
                        )}
                        {p.isStarter ? (
                          <Badge variant="secondary" data-testid={`badge-opp-player-starter-${p.id}`}>Starter</Badge>
                        ) : (
                          <Badge variant="outline" data-testid={`badge-opp-player-sub-${p.id}`}>Sub</Badge>
                        )}
                        {p.role && (
                          <Badge variant="outline" data-testid={`badge-opp-player-role-${p.id}`}>{p.role}</Badge>
                        )}
                      </div>
                      {p.notes && <div className="text-xs text-muted-foreground truncate">{p.notes}</div>}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p)} data-testid={`button-edit-opp-player-${p.id}`}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Remove "${p._split.name}"?`)) deleteMutation.mutate(p.id); }} data-testid={`button-delete-opp-player-${p.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { cancelEdit(); onClose(); }} data-testid="button-close-opp-roster">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
