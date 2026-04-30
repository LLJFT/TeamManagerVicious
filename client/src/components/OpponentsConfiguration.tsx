import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Pencil, Trash2, Users, Search, Image as ImageIcon, ChevronRight, UserPlus,
} from "lucide-react";
import type { Opponent, OpponentPlayer } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useGame } from "@/hooks/use-game";
import { OpponentRosterDialog } from "@/components/OpponentRosterDialog";

interface OpponentForm {
  name: string;
  shortName: string;
  logoUrl: string | null;
  region: string;
  notes: string;
  isActive: boolean;
}

interface OpponentPlayerForm {
  name: string;
  role: string;
  isStarter: boolean;
  notes: string;
}

const emptyOpponent: OpponentForm = {
  name: "",
  shortName: "",
  logoUrl: null,
  region: "",
  notes: "",
  isActive: true,
};

const emptyOppPlayer: OpponentPlayerForm = {
  name: "",
  role: "",
  isStarter: true,
  notes: "",
};

export function OpponentsConfiguration({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const { gameId, rosterId } = useGame();
  const [search, setSearch] = useState("");
  const [showOppDialog, setShowOppDialog] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opponent | undefined>();
  const [oppForm, setOppForm] = useState<OpponentForm>(emptyOpponent);
  const [rosterDialogOpp, setRosterDialogOpp] = useState<Opponent | undefined>();

  const { data: opponents = [], isLoading } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const invalidateOpps = () => queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === "/api/opponents",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/opponents", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateOpps();
      toast({ title: "Opponent added" });
      setShowOppDialog(false);
    },
    onError: (e: any) => toast({ title: "Failed to add opponent", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest("PUT", `/api/opponents/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      invalidateOpps();
    },
    onError: (e: any) => toast({ title: "Failed to update opponent", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/opponents/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateOpps();
      toast({ title: "Opponent deleted" });
    },
    onError: (e: any) => toast({ title: "Failed to delete opponent", description: e.message, variant: "destructive" }),
  });

  const filteredOpponents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...opponents].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    if (!term) return sorted;
    return sorted.filter(o =>
      o.name.toLowerCase().includes(term) || (o.shortName || "").toLowerCase().includes(term)
    );
  }, [opponents, search]);

  const totalCount = opponents.length;
  const activeCount = opponents.filter(o => o.isActive).length;

  const openCreate = () => {
    setEditingOpp(undefined);
    setOppForm(emptyOpponent);
    setShowOppDialog(true);
  };

  const openEdit = (opp: Opponent) => {
    setEditingOpp(opp);
    setOppForm({
      name: opp.name,
      shortName: opp.shortName ?? "",
      region: (opp as any).region ?? "",
      logoUrl: opp.logoUrl,
      notes: opp.notes ?? "",
      isActive: opp.isActive,
    });
    setShowOppDialog(true);
  };

  const handleSubmit = () => {
    const trimmed = oppForm.name.trim();
    if (!trimmed) {
      toast({ title: "Opponent name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: trimmed,
      shortName: oppForm.shortName.trim() || null,
      logoUrl: oppForm.logoUrl,
      region: oppForm.region.trim() || null,
      notes: oppForm.notes.trim() || null,
      isActive: oppForm.isActive,
      sortOrder: editingOpp?.sortOrder ?? opponents.length,
    };
    if (editingOpp) {
      updateMutation.mutate({ id: editingOpp.id, patch: payload }, {
        onSuccess: () => {
          toast({ title: "Opponent updated" });
          setShowOppDialog(false);
        },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleActive = (opp: Opponent) => {
    updateMutation.mutate({ id: opp.id, patch: { isActive: !opp.isActive } });
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Opponents Configuration</CardTitle>
              <CardDescription data-testid="text-opponents-summary">
                {totalCount} total · {activeCount} active
              </CardDescription>
            </div>
          </div>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="gap-2" data-testid="button-add-opponent">
              <Plus className="h-4 w-4" />
              Add Opponent
            </Button>
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
              placeholder="Search opponents..."
              className="pl-8"
              data-testid="input-opponent-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Loading opponents...</div>
        ) : totalCount === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No opponents configured for this roster yet.</p>
            {canEdit && (
              <p className="text-xs text-muted-foreground mt-2">
                Add opponent teams here to link them to events and games for richer analytics.
              </p>
            )}
          </div>
        ) : filteredOpponents.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">No opponents match your search.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredOpponents.map((opp) => (
              <div
                key={opp.id}
                className={`flex items-center gap-2 p-2 border border-border rounded-md ${opp.isActive ? "" : "opacity-60"}`}
                data-testid={`row-opponent-${opp.id}`}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  {opp.logoUrl ? (
                    <AvatarImage src={opp.logoUrl} alt={opp.name} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {opp.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" data-testid={`text-opponent-name-${opp.id}`}>
                    {opp.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {opp.shortName ? `${opp.shortName} · ` : ""}{(opp as any).region ? `${(opp as any).region} · ` : ""}{opp.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => setRosterDialogOpp(opp)} data-testid={`button-opponent-roster-${opp.id}`} title="View roster">
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="text-xs hidden sm:inline">View Roster</span>
                  </Button>
                  {canEdit && (
                    <>
                      <Switch
                        checked={opp.isActive}
                        onCheckedChange={() => toggleActive(opp)}
                        data-testid={`switch-opponent-active-${opp.id}`}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(opp)} data-testid={`button-edit-opponent-${opp.id}`}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Delete opponent "${opp.name}"? This will also remove their roster.`)) deleteMutation.mutate(opp.id); }} data-testid={`button-delete-opponent-${opp.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit opponent dialog */}
      <Dialog open={showOppDialog} onOpenChange={setShowOppDialog}>
        <DialogContent data-testid="dialog-opponent">
          <DialogHeader>
            <DialogTitle>{editingOpp ? "Edit Opponent" : "Add Opponent"}</DialogTitle>
            <DialogDescription>
              Configure the opponent team. Opponents are scoped to this roster.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="opp-name">Name</Label>
              <Input
                id="opp-name"
                value={oppForm.name}
                onChange={(e) => setOppForm({ ...oppForm, name: e.target.value })}
                placeholder="Opponent team name"
                data-testid="input-opponent-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="opp-short">Short name (optional)</Label>
                <Input
                  id="opp-short"
                  value={oppForm.shortName}
                  onChange={(e) => setOppForm({ ...oppForm, shortName: e.target.value })}
                  placeholder="e.g. NRG, T1"
                  data-testid="input-opponent-short-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opp-region">Region (optional)</Label>
                <Input
                  id="opp-region"
                  value={oppForm.region}
                  onChange={(e) => setOppForm({ ...oppForm, region: e.target.value })}
                  placeholder="EMEA, NA, APAC..."
                  data-testid="input-opponent-region"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 shrink-0">
                  {oppForm.logoUrl ? <AvatarImage src={oppForm.logoUrl} alt={oppForm.name || "preview"} /> : null}
                  <AvatarFallback>
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <ObjectUploader
                    onUploaded={(r) => setOppForm(f => ({ ...f, logoUrl: r.url }))}
                    onError={(msg) => toast({ title: "Upload failed", description: msg, variant: "destructive" })}
                  >
                    {oppForm.logoUrl ? "Replace Logo" : "Upload Logo"}
                  </ObjectUploader>
                  {oppForm.logoUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setOppForm(f => ({ ...f, logoUrl: null }))} data-testid="button-opponent-logo-remove">
                      Remove logo
                    </Button>
                  )}
                </div>
              </div>
              <Input
                value={oppForm.logoUrl || ""}
                onChange={(e) => setOppForm({ ...oppForm, logoUrl: e.target.value || null })}
                placeholder="…or paste logo URL"
                data-testid="input-opponent-logo-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opp-notes">Notes (optional)</Label>
              <Textarea
                id="opp-notes"
                value={oppForm.notes}
                onChange={(e) => setOppForm({ ...oppForm, notes: e.target.value })}
                placeholder="Region, playstyle, history..."
                rows={3}
                className="resize-none border text-sm"
                data-testid="textarea-opponent-notes"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="opp-active" className="cursor-pointer">Active</Label>
              <Switch
                id="opp-active"
                checked={oppForm.isActive}
                onCheckedChange={(v) => setOppForm({ ...oppForm, isActive: v })}
                data-testid="switch-opponent-active-form"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOppDialog(false)} data-testid="button-cancel-opponent">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-opponent">
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster sub-management dialog */}
      <OpponentRosterDialog
        opponent={rosterDialogOpp}
        canEdit={canEdit}
        onClose={() => setRosterDialogOpp(undefined)}
      />
    </Card>
  );
}
