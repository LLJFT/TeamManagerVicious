import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, Search } from "lucide-react";
import type {
  Game, GameMapVetoRow, GameMode, Map as MapType, Side,
  MapVetoSystem, MapVetoActionType, BanVetoTeamSlot,
} from "@shared/schema";
import { mapVetoActionTypes, banVetoTeamSlots } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

type Row = {
  stepNumber: number;
  actionType: MapVetoActionType;
  actingTeam: BanVetoTeamSlot;
  mapId: string | null;
  sideId: string | null;
  notes: string | null;
};

interface Props {
  game: Game;
  maps: MapType[];
  gameModes: GameMode[];
  sides: Side[];
  canEdit: boolean;
  onSaved: (msg: string, type: "success" | "error") => void;
}

export function GameMapVetoPanel({ game, maps, gameModes, sides, canEdit, onSaved }: Props) {
  const { data: systems = [] } = useQuery<MapVetoSystem[]>({
    queryKey: ["/api/map-veto-systems", { gameId: game.gameId, rosterId: game.rosterId }],
    enabled: !!game.gameId && !!game.rosterId,
  });
  const enabledSystems = useMemo(() => systems.filter(s => s.enabled), [systems]);

  const { data: serverRows = [] } = useQuery<GameMapVetoRow[]>({
    queryKey: ["/api/games", game.id, "map-veto-rows"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/games/${game.id}/map-veto-rows`);
      return r.json();
    },
  });

  const selectedSystem = enabledSystems.find(s => s.id === game.mapVetoSystemId) || null;
  const isOnFromSelector = !!game.mapVetoSystemId && !!selectedSystem;
  const [enabled, setEnabled] = useState<boolean>(isOnFromSelector);
  useEffect(() => { setEnabled(isOnFromSelector); }, [isOnFromSelector]);

  const initialRows: Row[] = useMemo(() => (
    [...serverRows].sort((a, b) => a.stepNumber - b.stepNumber).map<Row>(a => ({
      stepNumber: a.stepNumber,
      actionType: a.actionType as MapVetoActionType,
      actingTeam: a.actingTeam as BanVetoTeamSlot,
      mapId: a.mapId,
      sideId: a.sideId,
      notes: a.notes,
    }))
  ), [serverRows]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  useEffect(() => { setRows(initialRows); }, [initialRows]);

  const [rowCount, setRowCount] = useState<number>(initialRows.length);
  useEffect(() => { setRowCount(initialRows.length); }, [initialRows.length]);

  const updateGameSystem = useMutation({
    mutationFn: async (mapVetoSystemId: string | null) => {
      const r = await apiRequest("PUT", `/api/games/${game.id}`, { mapVetoSystemId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "map-veto-rows"] });
    },
    onError: (e: any) => onSaved(e.message || "Failed to update Map Veto selection", "error"),
  });

  const saveRows = useMutation({
    mutationFn: async (toSave: Row[]) => {
      const payload = toSave.map((r, idx) => ({
        stepNumber: idx + 1,
        actionType: r.actionType,
        actingTeam: r.actingTeam,
        mapId: r.mapId,
        sideId: r.sideId,
        notes: r.notes,
      }));
      const r = await apiRequest("PUT", `/api/games/${game.id}/map-veto-rows`, payload);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "map-veto-rows"] });
      onSaved("Map Veto rows saved", "success");
    },
    onError: (e: any) => onSaved(e.message || "Failed to save Map Veto rows", "error"),
  });

  if (enabledSystems.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-2 py-3 border border-dashed border-border rounded-md" data-testid={`text-no-mvs-${game.id}`}>
        No Map Veto Systems configured for this roster. Configure them in Dashboard → Map Veto.
      </div>
    );
  }

  const isSingle = enabledSystems.length === 1;

  const applyRowCount = (n: number) => {
    if (!canEdit) return;
    const clamped = Math.max(0, Math.min(40, n));
    setRowCount(clamped);
    if (clamped > rows.length) {
      const additions: Row[] = [];
      for (let i = rows.length; i < clamped; i++) {
        additions.push({ stepNumber: i + 1, actionType: "ban", actingTeam: "a", mapId: null, sideId: null, notes: null });
      }
      setRows([...rows, ...additions]);
    } else if (clamped < rows.length) {
      setRows(rows.slice(0, clamped));
    }
  };

  const removeRow = (i: number) => {
    if (!canEdit) return;
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    setRowCount(next.length);
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    if (!canEdit) return;
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const mapLabel = (mapId: string | null) => {
    if (!mapId) return "(unset)";
    const m = maps.find(x => x.id === mapId);
    if (!m) return "(unknown)";
    const mode = gameModes.find(g => g.id === m.gameModeId);
    return mode ? `${mode.name} -- ${m.name}` : m.name;
  };

  return (
    <div className="space-y-3" data-testid={`map-veto-panel-${game.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {isSingle ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={`mvs-on-${game.id}`} className="text-sm">Use "{enabledSystems[0].name}"</Label>
            <Switch
              id={`mvs-on-${game.id}`}
              checked={enabled}
              disabled={!canEdit || updateGameSystem.isPending}
              onCheckedChange={(v) => {
                setEnabled(v);
                updateGameSystem.mutate(v ? enabledSystems[0].id : null);
              }}
              data-testid={`switch-mvs-on-${game.id}`}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Label className="text-sm">Map Veto System</Label>
            <Select
              value={game.mapVetoSystemId || "__none__"}
              disabled={!canEdit || updateGameSystem.isPending}
              onValueChange={(v) => updateGameSystem.mutate(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="w-[260px]" data-testid={`select-mvs-${game.id}`}>
                <SelectValue placeholder="Select system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" data-testid={`option-mvs-none-${game.id}`}>None (off)</SelectItem>
                {enabledSystems.map(s => (
                  <SelectItem key={s.id} value={s.id} data-testid={`option-mvs-${s.id}-${game.id}`}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {selectedSystem && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Rows</Label>
              <Input
                type="number"
                min={0}
                max={40}
                className="w-20"
                value={rowCount}
                disabled={!canEdit}
                onChange={(e) => applyRowCount(Number(e.target.value))}
                data-testid={`input-mvs-row-count-${game.id}`}
              />
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => saveRows.mutate(rows)} disabled={saveRows.isPending} data-testid={`button-save-mvs-${game.id}`}>
                <Save className="h-4 w-4 mr-1" />
                {saveRows.isPending ? "Saving…" : "Save Rows"}
              </Button>
            )}
          </div>
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
                <th className="text-left p-2">Map (Mode -- Map)</th>
                {selectedSystem.supportsSideChoice && <th className="text-left p-2 w-32">Side</th>}
                <th className="text-left p-2">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={selectedSystem.supportsSideChoice ? 7 : 6} className="p-3 text-center text-xs text-muted-foreground italic">
                    No rows yet. Set "Rows" above to add steps.
                  </td>
                </tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t border-border" data-testid={`row-mvs-${game.id}-${i}`}>
                  <td className="p-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <Select
                      value={r.actionType}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRow(i, { actionType: v as MapVetoActionType })}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-mvs-action-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {mapVetoActionTypes
                          .filter(t => (t === "ban" ? selectedSystem.supportsBan : t === "pick" ? selectedSystem.supportsPick : selectedSystem.supportsDecider))
                          .map(t => (
                            <SelectItem key={t} value={t} data-testid={`option-mvs-action-${t}-${game.id}-${i}`}>{t}</SelectItem>
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
                      <SelectTrigger className="h-9" data-testid={`select-mvs-team-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {banVetoTeamSlots.map(t => (
                          <SelectItem key={t} value={t} data-testid={`option-mvs-team-${t}-${game.id}-${i}`}>
                            {t === "a" ? "Our team" : t === "b" ? "Opponent" : "Auto"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <MapCombobox
                      value={r.mapId}
                      onChange={(id) => updateRow(i, { mapId: id })}
                      maps={maps}
                      gameModes={gameModes}
                      disabled={!canEdit}
                      label={mapLabel(r.mapId)}
                      testId={`combobox-mvs-map-${game.id}-${i}`}
                    />
                  </td>
                  {selectedSystem.supportsSideChoice && (
                    <td className="p-2">
                      <Select
                        value={r.sideId || "__unset__"}
                        disabled={!canEdit}
                        onValueChange={(v) => updateRow(i, { sideId: v === "__unset__" ? null : v })}
                      >
                        <SelectTrigger className="h-9" data-testid={`select-mvs-side-${game.id}-${i}`}><SelectValue placeholder="Side" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">(unset)</SelectItem>
                          {sides.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  <td className="p-2">
                    <Input
                      value={r.notes || ""}
                      onChange={(e) => updateRow(i, { notes: e.target.value || null })}
                      disabled={!canEdit}
                      placeholder="optional"
                      data-testid={`input-mvs-notes-${game.id}-${i}`}
                    />
                  </td>
                  <td className="p-2">
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)} data-testid={`button-mvs-remove-${game.id}-${i}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && rows.length < 40 && (
            <div className="p-2 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => applyRowCount(rows.length + 1)} data-testid={`button-mvs-add-${game.id}`}>
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MapComboboxProps {
  value: string | null;
  onChange: (id: string | null) => void;
  maps: MapType[];
  gameModes: GameMode[];
  disabled?: boolean;
  label: string;
  testId: string;
}

function MapCombobox({ value, onChange, maps, gameModes, disabled, label, testId }: MapComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const list = maps.map(m => {
      const mode = gameModes.find(g => g.id === m.gameModeId);
      return { id: m.id, label: mode ? `${mode.name} -- ${m.name}` : m.name };
    });
    list.sort((a, b) => a.label.localeCompare(b.label));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(x => x.label.toLowerCase().includes(q));
  }, [maps, gameModes, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="w-full justify-between font-normal"
          data-testid={testId}
        >
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Mode -- Map…"
              className="pl-8 h-8"
              data-testid={`${testId}-search`}
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover-elevate"
            onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
            data-testid={`${testId}-option-unset`}
          >
            (unset)
          </button>
          {items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">No maps match.</div>
          ) : items.map(it => (
            <button
              key={it.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm hover-elevate ${value === it.id ? "font-medium" : ""}`}
              onClick={() => { onChange(it.id); setOpen(false); setQuery(""); }}
              data-testid={`${testId}-option-${it.id}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
