import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Map as MapIcon } from "lucide-react";
import type { MapVetoSystem } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGame } from "@/hooks/use-game";

interface FormState {
  name: string;
  enabled: boolean;
  supportsBan: boolean;
  supportsPick: boolean;
  supportsDecider: boolean;
  supportsSideChoice: boolean;
  defaultRowCount: number;
  notes: string;
}

const empty: FormState = {
  name: "",
  enabled: true,
  supportsBan: true,
  supportsPick: true,
  supportsDecider: true,
  supportsSideChoice: true,
  defaultRowCount: 7,
  notes: "",
};

export function MapVetoSystemsConfiguration({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const { gameId, rosterId } = useGame();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<MapVetoSystem | undefined>(undefined);
  const [form, setForm] = useState<FormState>(empty);

  const { data: systems = [], isLoading } = useQuery<MapVetoSystem[]>({
    queryKey: ["/api/map-veto-systems", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "/api/map-veto-systems" });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/map-veto-systems", data);
      return res.json();
    },
    onSuccess: () => { invalidate(); setShowDialog(false); toast({ title: "Map Veto System added" }); },
    onError: (e: any) => toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PUT", `/api/map-veto-systems/${id}`, patch);
      return res.json();
    },
    onSuccess: () => { invalidate(); setShowDialog(false); toast({ title: "Map Veto System updated" }); },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/map-veto-systems/${id}`);
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Map Veto System deleted" }); },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(undefined); setForm(empty); setShowDialog(true); };

  const openEdit = (s: MapVetoSystem) => {
    setEditing(s);
    setForm({
      name: s.name,
      enabled: s.enabled,
      supportsBan: s.supportsBan,
      supportsPick: s.supportsPick,
      supportsDecider: s.supportsDecider,
      supportsSideChoice: s.supportsSideChoice,
      defaultRowCount: s.defaultRowCount,
      notes: s.notes ?? "",
    });
    setShowDialog(true);
  };

  const submit = () => {
    const trimmed = form.name.trim();
    if (!trimmed) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const drc = Math.max(0, Math.min(40, Number(form.defaultRowCount) || 0));
    const payload = {
      name: trimmed,
      enabled: form.enabled,
      supportsBan: form.supportsBan,
      supportsPick: form.supportsPick,
      supportsDecider: form.supportsDecider,
      supportsSideChoice: form.supportsSideChoice,
      defaultRowCount: drc,
      notes: form.notes.trim() || null,
      sortOrder: editing?.sortOrder ?? systems.length,
    };
    if (editing) updateMutation.mutate({ id: editing.id, patch: payload });
    else createMutation.mutate(payload);
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Map Veto Systems</CardTitle>
              <CardDescription data-testid="text-map-veto-systems-summary">
                {systems.length} configured · per-roster reusable presets
              </CardDescription>
            </div>
          </div>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="gap-2" data-testid="button-add-map-veto-system">
              <Plus className="h-4 w-4" />
              Add System
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Loading…</div>
        ) : systems.length === 0 ? (
          <div className="text-center py-12">
            <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No Map Veto Systems configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {systems.map((s) => (
              <div
                key={s.id}
                className={`p-3 border border-border rounded-md ${s.enabled ? "" : "opacity-60"}`}
                data-testid={`row-map-veto-system-${s.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" data-testid={`text-mvs-name-${s.id}`}>{s.name}</div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <Badge variant="outline">{s.defaultRowCount} rows</Badge>
                      {s.supportsBan && <Badge variant="outline">ban</Badge>}
                      {s.supportsPick && <Badge variant="outline">pick</Badge>}
                      {s.supportsDecider && <Badge variant="outline">decider</Badge>}
                      {s.supportsSideChoice && <Badge variant="outline">side</Badge>}
                      {!s.enabled && <Badge variant="outline">disabled</Badge>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} data-testid={`button-edit-mvs-${s.id}`}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id); }} data-testid={`button-delete-mvs-${s.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                {s.notes && <div className="text-xs text-muted-foreground mt-2">{s.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="dialog-map-veto-system" className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Map Veto System" : "Add Map Veto System"}</DialogTitle>
            <DialogDescription>
              Configure a reusable Map Veto preset for this roster. Per-game selection happens in the match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="mvs-name">Name</Label>
              <Input id="mvs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. BO3 Standard 7-step" data-testid="input-mvs-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mvs-rows">Default row count (max 40)</Label>
              <Input id="mvs-rows" type="number" min={0} max={40} value={form.defaultRowCount} onChange={(e) => setForm({ ...form, defaultRowCount: Number(e.target.value) })} data-testid="input-mvs-default-rows" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mvs-ban">Supports ban action</Label>
              <Switch id="mvs-ban" checked={form.supportsBan} onCheckedChange={(v) => setForm({ ...form, supportsBan: v })} data-testid="switch-mvs-ban" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mvs-pick">Supports pick action</Label>
              <Switch id="mvs-pick" checked={form.supportsPick} onCheckedChange={(v) => setForm({ ...form, supportsPick: v })} data-testid="switch-mvs-pick" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mvs-decider">Supports decider</Label>
              <Switch id="mvs-decider" checked={form.supportsDecider} onCheckedChange={(v) => setForm({ ...form, supportsDecider: v })} data-testid="switch-mvs-decider" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mvs-side">Supports side choice</Label>
              <Switch id="mvs-side" checked={form.supportsSideChoice} onCheckedChange={(v) => setForm({ ...form, supportsSideChoice: v })} data-testid="switch-mvs-side" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mvs-notes">Notes</Label>
              <Textarea id="mvs-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional notes" data-testid="textarea-mvs-notes" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mvs-enabled">Enabled</Label>
              <Switch id="mvs-enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} data-testid="switch-mvs-enabled" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel-mvs">Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-mvs">
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
