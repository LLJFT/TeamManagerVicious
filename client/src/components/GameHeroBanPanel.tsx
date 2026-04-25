import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save } from "lucide-react";
import type { Game, GameHeroBanAction, Hero, HeroBanSystem, HeroBanActionType, BanVetoTeamSlot } from "@shared/schema";
import { heroBanActionTypes, banVetoTeamSlots } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

type Row = {
  stepNumber: number;
  actionType: HeroBanActionType;
  actingTeam: BanVetoTeamSlot;
  heroId: string | null;
  notes: string | null;
};

interface Props {
  game: Game;
  heroes: Hero[];
  canEdit: boolean;
  onSaved: (msg: string, type: "success" | "error") => void;
}

export function GameHeroBanPanel({ game, heroes, canEdit, onSaved }: Props) {
  const { data: systems = [] } = useQuery<HeroBanSystem[]>({
    queryKey: ["/api/hero-ban-systems", { gameId: game.gameId, rosterId: game.rosterId }],
    enabled: !!game.gameId && !!game.rosterId,
  });
  const enabledSystems = useMemo(() => systems.filter(s => s.enabled), [systems]);

  const { data: serverActions = [] } = useQuery<GameHeroBanAction[]>({
    queryKey: ["/api/games", game.id, "hero-ban-actions"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/games/${game.id}/hero-ban-actions`);
      return r.json();
    },
  });

  const selectedSystem = enabledSystems.find(s => s.id === game.heroBanSystemId) || null;
  const isOnFromSelector = !!game.heroBanSystemId && !!selectedSystem;
  const [enabled, setEnabled] = useState<boolean>(isOnFromSelector);
  useEffect(() => { setEnabled(isOnFromSelector); }, [isOnFromSelector]);

  const initialRows: Row[] = useMemo(() => {
    const rows = [...serverActions]
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map<Row>(a => ({
        stepNumber: a.stepNumber,
        actionType: (a.actionType as HeroBanActionType),
        actingTeam: (a.actingTeam as BanVetoTeamSlot),
        heroId: a.heroId,
        notes: a.notes,
      }));
    return rows;
  }, [serverActions]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  useEffect(() => { setRows(initialRows); }, [initialRows]);

  const updateGameSystem = useMutation({
    mutationFn: async (heroBanSystemId: string | null) => {
      const r = await apiRequest("PUT", `/api/games/${game.id}`, { heroBanSystemId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "hero-ban-actions"] });
    },
    onError: (e: any) => onSaved(e.message || "Failed to update Hero Ban selection", "error"),
  });

  const saveRows = useMutation({
    mutationFn: async (toSave: Row[]) => {
      const payload = toSave.map((r, idx) => ({
        stepNumber: idx + 1,
        actionType: r.actionType,
        actingTeam: r.actingTeam,
        heroId: r.heroId,
        notes: r.notes,
      }));
      const r = await apiRequest("PUT", `/api/games/${game.id}/hero-ban-actions`, payload);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "hero-ban-actions"] });
      onSaved("Hero Ban actions saved", "success");
    },
    onError: (e: any) => onSaved(e.message || "Failed to save Hero Ban actions", "error"),
  });

  if (enabledSystems.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-2 py-3 border border-dashed border-border rounded-md" data-testid={`text-no-hbs-${game.id}`}>
        No Hero Ban Systems configured for this roster. Configure them in Dashboard → Hero Ban.
      </div>
    );
  }

  const isSingle = enabledSystems.length === 1;

  const addRow = () => {
    if (!canEdit) return;
    setRows([
      ...rows,
      { stepNumber: rows.length + 1, actionType: "ban", actingTeam: "a", heroId: null, notes: null },
    ]);
  };

  const removeRow = (i: number) => {
    if (!canEdit) return;
    setRows(rows.filter((_, idx) => idx !== i));
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    if (!canEdit) return;
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-3" data-testid={`hero-ban-panel-${game.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isSingle ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={`hbs-on-${game.id}`} className="text-sm">Use "{enabledSystems[0].name}"</Label>
            <Switch
              id={`hbs-on-${game.id}`}
              checked={enabled}
              disabled={!canEdit || updateGameSystem.isPending}
              onCheckedChange={(v) => {
                setEnabled(v);
                updateGameSystem.mutate(v ? enabledSystems[0].id : null);
              }}
              data-testid={`switch-hbs-on-${game.id}`}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Label className="text-sm">Hero Ban System</Label>
            <Select
              value={game.heroBanSystemId || "__none__"}
              disabled={!canEdit || updateGameSystem.isPending}
              onValueChange={(v) => updateGameSystem.mutate(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="w-[260px]" data-testid={`select-hbs-${game.id}`}>
                <SelectValue placeholder="Select system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" data-testid={`option-hbs-none-${game.id}`}>None (off)</SelectItem>
                {enabledSystems.map(s => (
                  <SelectItem key={s.id} value={s.id} data-testid={`option-hbs-${s.id}-${game.id}`}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {selectedSystem && canEdit && (
          <Button size="sm" onClick={() => saveRows.mutate(rows)} disabled={saveRows.isPending} data-testid={`button-save-hbs-${game.id}`}>
            <Save className="h-4 w-4 mr-1" />
            {saveRows.isPending ? "Saving…" : "Save Sequence"}
          </Button>
        )}
      </div>

      {selectedSystem && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 w-12">Step</th>
                <th className="text-left p-2 w-28">Action</th>
                <th className="text-left p-2 w-28">Acting team</th>
                <th className="text-left p-2">Hero</th>
                <th className="text-left p-2">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-xs text-muted-foreground italic">No actions yet. Click "Add Step" to begin.</td>
                </tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t border-border" data-testid={`row-hbs-action-${game.id}-${i}`}>
                  <td className="p-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <Select
                      value={r.actionType}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRow(i, { actionType: v as HeroBanActionType })}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-hbs-action-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {heroBanActionTypes.map(t => (
                          <SelectItem key={t} value={t} data-testid={`option-hbs-action-${t}-${game.id}-${i}`}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select
                      value={r.actingTeam}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRow(i, { actingTeam: v as BanVetoTeamSlot })}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-hbs-team-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {banVetoTeamSlots.map(t => (
                          <SelectItem key={t} value={t} data-testid={`option-hbs-team-${t}-${game.id}-${i}`}>
                            {t === "a" ? "Our team" : t === "b" ? "Opponent" : "Auto"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select
                      value={r.heroId || "__unset__"}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRow(i, { heroId: v === "__unset__" ? null : v })}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-hbs-hero-${game.id}-${i}`}><SelectValue placeholder="Pick hero" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__" data-testid={`option-hbs-hero-none-${game.id}-${i}`}>(unset)</SelectItem>
                        {heroes.filter(h => h.isActive).map(h => (
                          <SelectItem key={h.id} value={h.id} data-testid={`option-hbs-hero-${h.id}-${game.id}-${i}`}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      value={r.notes || ""}
                      onChange={(e) => updateRow(i, { notes: e.target.value || null })}
                      disabled={!canEdit}
                      placeholder="optional"
                      data-testid={`input-hbs-notes-${game.id}-${i}`}
                    />
                  </td>
                  <td className="p-2">
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)} data-testid={`button-hbs-remove-${game.id}-${i}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div className="p-2 border-t border-border">
              <Button size="sm" variant="outline" onClick={addRow} data-testid={`button-hbs-add-${game.id}`}>
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
