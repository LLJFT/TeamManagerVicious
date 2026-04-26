import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, Search, Wand2, Map as MapImageIcon } from "lucide-react";
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

function generateFromPreset(system: MapVetoSystem): Row[] {
  const total = Math.max(0, Math.min(40, system.defaultRowCount || 0));
  if (total === 0) return [];
  const rows: Row[] = [];
  const supportsBan = system.supportsBan;
  const supportsPick = system.supportsPick;
  const supportsDecider = system.supportsDecider;

  // Standard veto patterns:
  //   Only ban → all bans alternating
  //   Only pick → all picks alternating
  //   Ban + Pick (+Decider) → first half bans, second half picks, last is decider if supported
  //   None supported → all "ban" placeholders
  const usableActions: MapVetoActionType[] = [];
  if (supportsBan) usableActions.push("ban");
  if (supportsPick) usableActions.push("pick");
  if (usableActions.length === 0) usableActions.push("ban");

  const decider = supportsDecider && total >= 1 ? 1 : 0;
  const remaining = total - decider;

  let banCount = 0;
  let pickCount = 0;
  if (supportsBan && supportsPick) {
    banCount = Math.ceil(remaining / 2);
    pickCount = remaining - banCount;
  } else if (supportsBan) {
    banCount = remaining;
  } else if (supportsPick) {
    pickCount = remaining;
  } else {
    banCount = remaining;
  }

  let teamToggle = 0;
  for (let i = 0; i < banCount; i++) {
    rows.push({
      stepNumber: rows.length + 1,
      actionType: "ban",
      actingTeam: teamToggle++ % 2 === 0 ? "a" : "b",
      mapId: null,
      sideId: null,
      notes: null,
    });
  }
  for (let i = 0; i < pickCount; i++) {
    rows.push({
      stepNumber: rows.length + 1,
      actionType: "pick",
      actingTeam: teamToggle++ % 2 === 0 ? "a" : "b",
      mapId: null,
      sideId: null,
      notes: null,
    });
  }
  if (decider) {
    rows.push({
      stepNumber: rows.length + 1,
      actionType: "decider",
      actingTeam: "auto",
      mapId: null,
      sideId: null,
      notes: null,
    });
  }
  return rows;
}

export function GameMapVetoPanel({ game, maps, gameModes, sides, canEdit, onSaved }: Props) {
  const { data: systems = [] } = useQuery<MapVetoSystem[]>({
    queryKey: ["/api/map-veto-systems", { gameId: game.gameId, rosterId: game.rosterId }],
    enabled: !!game.gameId && !!game.rosterId,
  });
  const enabledSystems = useMemo(() => systems.filter(s => s.enabled), [systems]);

  const { data: serverRows = [], isFetched: rowsFetched } = useQuery<GameMapVetoRow[]>({
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
  const [dirty, setDirty] = useState(false);
  // Hydrate from server only when local rows are not dirty (no unsaved user edits).
  useEffect(() => {
    if (dirty) return;
    setRows(initialRows);
  }, [initialRows, dirty]);

  const [rowCount, setRowCount] = useState<number>(initialRows.length);
  useEffect(() => {
    if (dirty) return;
    setRowCount(initialRows.length);
  }, [initialRows.length, dirty]);

  // Auto-populate when selected, server returned empty rows, and preset has rows
  const [autoApplied, setAutoApplied] = useState(false);
  useEffect(() => {
    setAutoApplied(false);
    setDirty(false);
  }, [selectedSystem?.id, game.id]);
  useEffect(() => {
    if (!selectedSystem) return;
    if (!rowsFetched) return;
    if (autoApplied) return;
    if (dirty) return;
    if (initialRows.length > 0) return;
    const generated = generateFromPreset(selectedSystem);
    if (generated.length > 0) {
      setRows(generated);
      setRowCount(generated.length);
      setAutoApplied(true);
    }
  }, [selectedSystem, rowsFetched, initialRows.length, autoApplied, dirty]);

  const updateGameSystem = useMutation({
    mutationFn: async (mapVetoSystemId: string | null) => {
      const r = await apiRequest("PUT", `/api/games/${game.id}`, { mapVetoSystemId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "map-veto-rows"] });
      setAutoApplied(false);
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
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "map-veto-rows"] });
      onSaved("Map Veto rows saved", "success");
    },
    onError: (e: any) => onSaved(e.message || "Failed to save Map Veto rows", "error"),
  });

  if (enabledSystems.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-3 py-3 border border-dashed border-border rounded-md" data-testid={`text-no-mvs-${game.id}`}>
        No Map Veto Systems configured for this roster. Configure them in Dashboard → Map Veto.
      </div>
    );
  }

  const isSingle = enabledSystems.length === 1;

  const applyRowCount = (n: number) => {
    if (!canEdit) return;
    const clamped = Math.max(0, Math.min(40, n));
    setDirty(true);
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
    setDirty(true);
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    setRowCount(next.length);
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    if (!canEdit) return;
    setDirty(true);
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const resetToPreset = () => {
    if (!canEdit || !selectedSystem) return;
    const generated = generateFromPreset(selectedSystem);
    setRows(generated);
    setRowCount(generated.length);
    setAutoApplied(true);
    setDirty(false);
  };

  return (
    <div className="space-y-3" data-testid={`map-veto-panel-${game.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {isSingle ? (
            <div className="flex items-center gap-2">
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
              <Label htmlFor={`mvs-on-${game.id}`} className="text-sm font-medium">{enabledSystems[0].name}</Label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-sm">System</Label>
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
            <div className="flex items-center gap-1">
              <Badge variant="outline">{selectedSystem.defaultRowCount} preset rows</Badge>
              {selectedSystem.supportsBan && <Badge variant="outline">ban</Badge>}
              {selectedSystem.supportsPick && <Badge variant="outline">pick</Badge>}
              {selectedSystem.supportsDecider && <Badge variant="outline">decider</Badge>}
              {selectedSystem.supportsSideChoice && <Badge variant="outline">side</Badge>}
            </div>
          )}
        </div>
        {selectedSystem && (
          <div className="flex items-center gap-2 flex-wrap">
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
              <>
                <Button size="sm" variant="outline" onClick={resetToPreset} data-testid={`button-mvs-reset-${game.id}`}>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Reset from preset
                </Button>
                <Button size="sm" onClick={() => saveRows.mutate(rows)} disabled={saveRows.isPending} data-testid={`button-save-mvs-${game.id}`}>
                  <Save className="h-4 w-4 mr-1" />
                  {saveRows.isPending ? "Saving…" : "Save Rows"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {selectedSystem && autoApplied && initialRows.length === 0 && rows.length > 0 && (
        <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-3 py-2" data-testid={`text-mvs-auto-banner-${game.id}`}>
          Auto-populated from preset "{selectedSystem.name}". Edit any row, then click Save Rows to persist.
        </div>
      )}

      {selectedSystem && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2 w-28">Action</th>
                <th className="text-left px-3 py-2 w-32">Team</th>
                <th className="text-left px-3 py-2">Map (Mode — Map)</th>
                {selectedSystem.supportsSideChoice && <th className="text-left px-3 py-2 w-32">Side</th>}
                <th className="text-left px-3 py-2">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={selectedSystem.supportsSideChoice ? 7 : 6} className="p-4 text-center text-xs text-muted-foreground italic">
                    No rows yet. Set "Rows" above or click "Reset from preset" to begin.
                  </td>
                </tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t border-border align-middle" data-testid={`row-mvs-${game.id}-${i}`}>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Select value={r.actionType} disabled={!canEdit} onValueChange={(v) => updateRow(i, { actionType: v as MapVetoActionType })}>
                      <SelectTrigger data-testid={`select-mvs-action-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {mapVetoActionTypes
                          .filter(t => (t === "ban" ? selectedSystem.supportsBan : t === "pick" ? selectedSystem.supportsPick : selectedSystem.supportsDecider))
                          .map(t => (
                            <SelectItem key={t} value={t} data-testid={`option-mvs-action-${t}-${game.id}-${i}`}>{t}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select value={r.actingTeam} disabled={!canEdit} onValueChange={(v) => updateRow(i, { actingTeam: v as BanVetoTeamSlot })}>
                      <SelectTrigger data-testid={`select-mvs-team-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {banVetoTeamSlots.map(t => (
                          <SelectItem key={t} value={t} data-testid={`option-mvs-team-${t}-${game.id}-${i}`}>
                            {t === "a" ? "Our team" : t === "b" ? "Opponent" : "Auto"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <MapCombobox
                      value={r.mapId}
                      onChange={(id) => updateRow(i, { mapId: id })}
                      maps={maps}
                      gameModes={gameModes}
                      disabled={!canEdit}
                      testId={`combobox-mvs-map-${game.id}-${i}`}
                    />
                  </td>
                  {selectedSystem.supportsSideChoice && (
                    <td className="px-3 py-2">
                      <Select value={r.sideId || undefined} disabled={!canEdit} onValueChange={(v) => updateRow(i, { sideId: v })}>
                        <SelectTrigger data-testid={`select-mvs-side-${game.id}-${i}`}><SelectValue placeholder="Random Side" /></SelectTrigger>
                        <SelectContent>
                          {sides.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Input
                      value={r.notes || ""}
                      onChange={(e) => updateRow(i, { notes: e.target.value || null })}
                      disabled={!canEdit}
                      placeholder="optional"
                      data-testid={`input-mvs-notes-${game.id}-${i}`}
                    />
                  </td>
                  <td className="px-3 py-2">
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
            <div className="p-2 border-t border-border bg-muted/20">
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
  testId: string;
}

function MapThumb({ map, size = "h-6 w-9" }: { map?: MapType; size?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [map?.id, map?.imageUrl]);
  const showImage = map?.imageUrl && !broken;
  return (
    <div className={`${size} shrink-0 rounded-sm border border-border overflow-hidden bg-muted/40 flex items-center justify-center`}>
      {showImage ? (
        <img
          src={map!.imageUrl!}
          alt={map!.name}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <MapImageIcon className="h-3 w-3 text-muted-foreground" />
      )}
    </div>
  );
}

function MapCombobox({ value, onChange, maps, gameModes, disabled, testId }: MapComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const list = maps.map(m => {
      const mode = gameModes.find(g => g.id === m.gameModeId);
      return { map: m, label: mode ? `${mode.name} — ${m.name}` : m.name };
    });
    list.sort((a, b) => a.label.localeCompare(b.label));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(x => x.label.toLowerCase().includes(q));
  }, [maps, gameModes, query]);

  const selected = value ? maps.find(m => m.id === value) : null;
  const selectedMode = selected ? gameModes.find(g => g.id === selected.gameModeId) : undefined;
  const selectedLabel = selected
    ? (selectedMode ? `${selectedMode.name} — ${selected.name}` : selected.name)
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-start font-normal gap-2"
          data-testid={testId}
        >
          <MapThumb map={selected || undefined} size="h-6 w-9" />
          <span className="truncate text-left flex-1">{selected ? selectedLabel : <span className="text-muted-foreground">Pick map</span>}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[340px]" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Mode — Map…"
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
              key={it.map.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover-elevate ${value === it.map.id ? "font-medium" : ""}`}
              onClick={() => { onChange(it.map.id); setOpen(false); setQuery(""); }}
              data-testid={`${testId}-option-${it.map.id}`}
            >
              <MapThumb map={it.map} size="h-7 w-10" />
              <span className="flex-1 text-left truncate">{it.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
