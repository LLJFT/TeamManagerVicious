import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Ban } from "lucide-react";
import type { HeroBanSystem } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGame } from "@/hooks/use-game";

interface FormState {
  name: string;
  enabled: boolean;
  mode: string;
  supportsLocks: boolean;
  bansPerTeam: number;
  locksPerTeam: number;
  bansTargetEnemy: boolean;
  locksSecureOwn: boolean;
  bansPerRound: number | "";
  bansEverySideSwitch: boolean;
  bansEveryTwoRounds: boolean;
  bansResetOnHalftime: boolean;
  overtimeBehavior: string;
  totalBansPerMap: number | "";
  bansAccumulate: boolean;
  notes: string;
}

const empty: FormState = {
  name: "",
  enabled: true,
  mode: "simple",
  supportsLocks: false,
  bansPerTeam: 2,
  locksPerTeam: 0,
  bansTargetEnemy: true,
  locksSecureOwn: false,
  bansPerRound: "",
  bansEverySideSwitch: false,
  bansEveryTwoRounds: false,
  bansResetOnHalftime: false,
  overtimeBehavior: "",
  totalBansPerMap: "",
  bansAccumulate: false,
  notes: "",
};

export function HeroBanSystemsConfiguration({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const { gameId, rosterId } = useGame();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<HeroBanSystem | undefined>(undefined);
  const [form, setForm] = useState<FormState>(empty);

  const { data: systems = [], isLoading } = useQuery<HeroBanSystem[]>({
    queryKey: ["/api/hero-ban-systems", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "/api/hero-ban-systems" });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/hero-ban-systems", data);
      return res.json();
    },
    onSuccess: () => { invalidate(); setShowDialog(false); toast({ title: "Hero Ban System added" }); },
    onError: (e: any) => toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PUT", `/api/hero-ban-systems/${id}`, patch);
      return res.json();
    },
    onSuccess: () => { invalidate(); setShowDialog(false); toast({ title: "Hero Ban System updated" }); },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/hero-ban-systems/${id}`);
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Hero Ban System deleted" }); },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(undefined);
    setForm(empty);
    setShowDialog(true);
  };

  const openEdit = (s: HeroBanSystem) => {
    setEditing(s);
    setForm({
      name: s.name,
      enabled: s.enabled,
      mode: s.mode,
      supportsLocks: s.supportsLocks,
      bansPerTeam: s.bansPerTeam,
      locksPerTeam: s.locksPerTeam,
      bansTargetEnemy: s.bansTargetEnemy,
      locksSecureOwn: s.locksSecureOwn,
      bansPerRound: s.bansPerRound ?? "",
      bansEverySideSwitch: s.bansEverySideSwitch,
      bansEveryTwoRounds: s.bansEveryTwoRounds,
      bansResetOnHalftime: s.bansResetOnHalftime,
      overtimeBehavior: s.overtimeBehavior ?? "",
      totalBansPerMap: s.totalBansPerMap ?? "",
      bansAccumulate: s.bansAccumulate,
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
    const payload = {
      name: trimmed,
      enabled: form.enabled,
      mode: form.mode,
      supportsLocks: form.supportsLocks,
      bansPerTeam: Number(form.bansPerTeam) || 0,
      locksPerTeam: Number(form.locksPerTeam) || 0,
      bansTargetEnemy: form.bansTargetEnemy,
      locksSecureOwn: form.locksSecureOwn,
      bansPerRound: form.bansPerRound === "" ? null : Number(form.bansPerRound),
      bansEverySideSwitch: form.bansEverySideSwitch,
      bansEveryTwoRounds: form.bansEveryTwoRounds,
      bansResetOnHalftime: form.bansResetOnHalftime,
      overtimeBehavior: form.overtimeBehavior.trim() || null,
      totalBansPerMap: form.totalBansPerMap === "" ? null : Number(form.totalBansPerMap),
      bansAccumulate: form.bansAccumulate,
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
              <Ban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Hero Ban Systems</CardTitle>
              <CardDescription data-testid="text-hero-ban-systems-summary">
                {systems.length} configured · per-roster reusable presets
              </CardDescription>
            </div>
          </div>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="gap-2" data-testid="button-add-hero-ban-system">
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
            <Ban className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No Hero Ban Systems configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {systems.map((s) => (
              <div
                key={s.id}
                className={`p-3 border border-border rounded-md ${s.enabled ? "" : "opacity-60"}`}
                data-testid={`row-hero-ban-system-${s.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" data-testid={`text-hbs-name-${s.id}`}>{s.name}</div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <Badge variant="outline" data-testid={`badge-hbs-mode-${s.id}`}>{s.mode}</Badge>
                      <Badge variant="outline">{s.bansPerTeam} bans/team</Badge>
                      {s.supportsLocks && <Badge variant="outline">{s.locksPerTeam} locks/team</Badge>}
                      {!s.enabled && <Badge variant="outline">disabled</Badge>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} data-testid={`button-edit-hbs-${s.id}`}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id); }} data-testid={`button-delete-hbs-${s.id}`}>
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
        <DialogContent data-testid="dialog-hero-ban-system" className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Hero Ban System" : "Add Hero Ban System"}</DialogTitle>
            <DialogDescription>
              Configure a reusable Hero Ban preset for this roster. Per-game selection happens in the match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="hbs-name">Name</Label>
              <Input id="hbs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard 2-Bans" data-testid="input-hbs-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hbs-mode">Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger id="hbs-mode" data-testid="select-hbs-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple" data-testid="option-hbs-mode-simple">Simple (per match)</SelectItem>
                  <SelectItem value="rainbow_flexible" data-testid="option-hbs-mode-rainbow">Rainbow-Flexible (round-based)</SelectItem>
                  <SelectItem value="custom" data-testid="option-hbs-mode-custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="hbs-bpt">Bans per team</Label>
                <Input id="hbs-bpt" type="number" min={0} value={form.bansPerTeam} onChange={(e) => setForm({ ...form, bansPerTeam: Number(e.target.value) })} data-testid="input-hbs-bans-per-team" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hbs-lpt">Locks per team</Label>
                <Input id="hbs-lpt" type="number" min={0} value={form.locksPerTeam} onChange={(e) => setForm({ ...form, locksPerTeam: Number(e.target.value) })} data-testid="input-hbs-locks-per-team" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hbs-locks">Supports locks (protects)</Label>
              <Switch id="hbs-locks" checked={form.supportsLocks} onCheckedChange={(v) => setForm({ ...form, supportsLocks: v })} data-testid="switch-hbs-supports-locks" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hbs-target">Bans target enemy heroes</Label>
              <Switch id="hbs-target" checked={form.bansTargetEnemy} onCheckedChange={(v) => setForm({ ...form, bansTargetEnemy: v })} data-testid="switch-hbs-bans-target-enemy" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hbs-secure">Locks secure own heroes</Label>
              <Switch id="hbs-secure" checked={form.locksSecureOwn} onCheckedChange={(v) => setForm({ ...form, locksSecureOwn: v })} data-testid="switch-hbs-locks-secure-own" />
            </div>

            {form.mode === "rainbow_flexible" && (
              <div className="border border-border rounded-md p-3 space-y-3">
                <div className="text-sm font-medium">Rainbow Six-style flexibility</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="hbs-bpr">Bans per round</Label>
                    <Input id="hbs-bpr" type="number" min={0} value={form.bansPerRound} onChange={(e) => setForm({ ...form, bansPerRound: e.target.value === "" ? "" : Number(e.target.value) })} data-testid="input-hbs-bans-per-round" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hbs-tbpm">Total bans per map (cap)</Label>
                    <Input id="hbs-tbpm" type="number" min={0} value={form.totalBansPerMap} onChange={(e) => setForm({ ...form, totalBansPerMap: e.target.value === "" ? "" : Number(e.target.value) })} data-testid="input-hbs-total-bans-per-map" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="hbs-ess">Bans every side switch</Label>
                  <Switch id="hbs-ess" checked={form.bansEverySideSwitch} onCheckedChange={(v) => setForm({ ...form, bansEverySideSwitch: v })} data-testid="switch-hbs-side-switch" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="hbs-e2r">Bans every two rounds</Label>
                  <Switch id="hbs-e2r" checked={form.bansEveryTwoRounds} onCheckedChange={(v) => setForm({ ...form, bansEveryTwoRounds: v })} data-testid="switch-hbs-two-rounds" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="hbs-rht">Reset bans on halftime</Label>
                  <Switch id="hbs-rht" checked={form.bansResetOnHalftime} onCheckedChange={(v) => setForm({ ...form, bansResetOnHalftime: v })} data-testid="switch-hbs-halftime" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="hbs-acc">Bans accumulate across rounds</Label>
                  <Switch id="hbs-acc" checked={form.bansAccumulate} onCheckedChange={(v) => setForm({ ...form, bansAccumulate: v })} data-testid="switch-hbs-accumulate" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hbs-ot">Overtime behavior</Label>
                  <Input id="hbs-ot" value={form.overtimeBehavior} onChange={(e) => setForm({ ...form, overtimeBehavior: e.target.value })} placeholder="e.g. carry bans / fresh bans" data-testid="input-hbs-overtime" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="hbs-notes">Notes</Label>
              <Textarea id="hbs-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional notes" data-testid="textarea-hbs-notes" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hbs-enabled">Enabled</Label>
              <Switch id="hbs-enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} data-testid="switch-hbs-enabled" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} data-testid="button-cancel-hbs">Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-hbs">
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
