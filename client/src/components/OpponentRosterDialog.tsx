import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Opponent, OpponentPlayer } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OpponentPlayerForm {
  name: string;
  role: string;
  isStarter: boolean;
  notes: string;
}

const emptyOppPlayer: OpponentPlayerForm = {
  name: "",
  role: "",
  isStarter: true,
  notes: "",
};

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
    const trimmed = form.name.trim();
    if (!trimmed) {
      toast({ title: "Player name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: trimmed,
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
    setEditingPlayer(p);
    setForm({
      name: p.name,
      role: p.role ?? "",
      isStarter: p.isStarter,
      notes: p.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingPlayer(undefined);
    setForm(emptyOppPlayer);
  };

  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => Number(b.isStarter) - Number(a.isStarter) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
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
                  placeholder="Player name / IGN"
                  data-testid="input-opp-player-name"
                />
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Role (e.g. Duelist)"
                  data-testid="input-opp-player-role"
                />
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
                        {p.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate" data-testid={`text-opp-player-name-${p.id}`}>{p.name}</span>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Remove "${p.name}"?`)) deleteMutation.mutate(p.id); }} data-testid={`button-delete-opp-player-${p.id}`}>
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
