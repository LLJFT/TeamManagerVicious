import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Search, Wand2 } from "lucide-react";
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

const roleColor = (role?: string) => {
  switch (role) {
    case "Duelist": return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "Vanguard": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "Strategist": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
};

function HeroAvatar({ hero, size = "h-7 w-7" }: { hero?: Hero; size?: string }) {
  return (
    <Avatar className={`${size} shrink-0`}>
      {hero?.imageUrl ? <AvatarImage src={hero.imageUrl} alt={hero.name} /> : null}
      <AvatarFallback className={`text-[10px] font-medium ${roleColor(hero?.role)}`}>
        {hero ? hero.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
      </AvatarFallback>
    </Avatar>
  );
}

function generateFromPreset(system: HeroBanSystem): Row[] {
  const rows: Row[] = [];
  const cap = (n: number) => Math.max(0, Math.min(40, n));
  let step = 1;
  if (system.mode === "rainbow_flexible") {
    const total = system.totalBansPerMap ? cap(system.totalBansPerMap) : cap((system.bansPerTeam || 0) * 2);
    for (let i = 0; i < total && rows.length < 40; i++) {
      rows.push({
        stepNumber: step++,
        actionType: "ban",
        actingTeam: i % 2 === 0 ? "a" : "b",
        heroId: null,
        notes: null,
      });
    }
    return rows;
  }
  // simple / custom: alternating bans (a,b,a,b...) for bansPerTeam each, then locks
  const bansPerTeam = cap(system.bansPerTeam || 0);
  for (let i = 0; i < bansPerTeam; i++) {
    if (rows.length >= 40) break;
    rows.push({ stepNumber: step++, actionType: "ban", actingTeam: "a", heroId: null, notes: null });
    if (rows.length >= 40) break;
    rows.push({ stepNumber: step++, actionType: "ban", actingTeam: "b", heroId: null, notes: null });
  }
  if (system.supportsLocks) {
    const locksPerTeam = cap(system.locksPerTeam || 0);
    for (let i = 0; i < locksPerTeam; i++) {
      if (rows.length >= 40) break;
      rows.push({ stepNumber: step++, actionType: "lock", actingTeam: "a", heroId: null, notes: null });
      if (rows.length >= 40) break;
      rows.push({ stepNumber: step++, actionType: "lock", actingTeam: "b", heroId: null, notes: null });
    }
  }
  return rows;
}

export function GameHeroBanPanel({ game, heroes, canEdit, onSaved }: Props) {
  const { data: systems = [] } = useQuery<HeroBanSystem[]>({
    queryKey: ["/api/hero-ban-systems", { gameId: game.gameId, rosterId: game.rosterId }],
    enabled: !!game.gameId && !!game.rosterId,
  });
  const enabledSystems = useMemo(() => systems.filter(s => s.enabled), [systems]);

  const { data: serverActions = [], isFetched: actionsFetched } = useQuery<GameHeroBanAction[]>({
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
    return [...serverActions]
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map<Row>(a => ({
        stepNumber: a.stepNumber,
        actionType: a.actionType as HeroBanActionType,
        actingTeam: a.actingTeam as BanVetoTeamSlot,
        heroId: a.heroId,
        notes: a.notes,
      }));
  }, [serverActions]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [dirty, setDirty] = useState(false);
  // Hydrate from server only when local rows are not dirty (no unsaved user edits).
  useEffect(() => {
    if (dirty) return;
    setRows(initialRows);
  }, [initialRows, dirty]);

  // Auto-populate when a system is selected, server returned empty rows, and the preset has steps.
  const [autoApplied, setAutoApplied] = useState(false);
  useEffect(() => {
    setAutoApplied(false);
    setDirty(false);
  }, [selectedSystem?.id, game.id]);
  useEffect(() => {
    if (!selectedSystem) return;
    if (!actionsFetched) return;
    if (autoApplied) return;
    if (dirty) return;
    if (initialRows.length > 0) return;
    const generated = generateFromPreset(selectedSystem);
    if (generated.length > 0) {
      setRows(generated);
      setAutoApplied(true);
    }
  }, [selectedSystem, actionsFetched, initialRows.length, autoApplied, dirty]);

  const updateGameSystem = useMutation({
    mutationFn: async (heroBanSystemId: string | null) => {
      const r = await apiRequest("PUT", `/api/games/${game.id}`, { heroBanSystemId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "hero-ban-actions"] });
      setAutoApplied(false);
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
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/games", game.id, "hero-ban-actions"] });
      onSaved("Hero Ban actions saved", "success");
    },
    onError: (e: any) => onSaved(e.message || "Failed to save Hero Ban actions", "error"),
  });

  if (enabledSystems.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-3 py-3 border border-dashed border-border rounded-md" data-testid={`text-no-hbs-${game.id}`}>
        No Hero Ban Systems configured for this roster. Configure them in Dashboard → Hero Ban.
      </div>
    );
  }

  const isSingle = enabledSystems.length === 1;

  const addRow = () => {
    if (!canEdit) return;
    if (rows.length >= 40) return;
    setDirty(true);
    setRows([...rows, { stepNumber: rows.length + 1, actionType: "ban", actingTeam: "a", heroId: null, notes: null }]);
  };

  const removeRow = (i: number) => {
    if (!canEdit) return;
    setDirty(true);
    setRows(rows.filter((_, idx) => idx !== i));
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    if (!canEdit) return;
    setDirty(true);
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const resetToPreset = () => {
    if (!canEdit || !selectedSystem) return;
    setRows(generateFromPreset(selectedSystem));
    setAutoApplied(true);
    setDirty(false);
  };

  return (
    <div className="space-y-3" data-testid={`hero-ban-panel-${game.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {isSingle ? (
            <div className="flex items-center gap-2">
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
              <Label htmlFor={`hbs-on-${game.id}`} className="text-sm font-medium">{enabledSystems[0].name}</Label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-sm">System</Label>
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
          {selectedSystem && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Badge variant="outline">{selectedSystem.mode}</Badge>
              <Badge variant="outline">{selectedSystem.bansPerTeam} bans/team</Badge>
              {selectedSystem.supportsLocks && <Badge variant="outline">{selectedSystem.locksPerTeam} locks/team</Badge>}
            </div>
          )}
        </div>
        {selectedSystem && canEdit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={resetToPreset} data-testid={`button-hbs-reset-${game.id}`}>
              <Wand2 className="h-4 w-4 mr-1" />
              Reset from preset
            </Button>
            <Button size="sm" onClick={() => saveRows.mutate(rows)} disabled={saveRows.isPending} data-testid={`button-save-hbs-${game.id}`}>
              <Save className="h-4 w-4 mr-1" />
              {saveRows.isPending ? "Saving…" : "Save Sequence"}
            </Button>
          </div>
        )}
      </div>

      {selectedSystem && autoApplied && initialRows.length === 0 && rows.length > 0 && (
        <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-3 py-2" data-testid={`text-hbs-auto-banner-${game.id}`}>
          Auto-populated from preset "{selectedSystem.name}". Edit any step, then click Save Sequence to persist.
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
                <th className="text-left px-3 py-2">Hero</th>
                <th className="text-left px-3 py-2">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-xs text-muted-foreground italic">
                    No actions yet. Click "Add Step" or "Reset from preset" to begin.
                  </td>
                </tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t border-border align-middle" data-testid={`row-hbs-action-${game.id}-${i}`}>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Select value={r.actionType} disabled={!canEdit} onValueChange={(v) => updateRow(i, { actionType: v as HeroBanActionType })}>
                      <SelectTrigger data-testid={`select-hbs-action-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {heroBanActionTypes.map(t => (
                          <SelectItem key={t} value={t} data-testid={`option-hbs-action-${t}-${game.id}-${i}`}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select value={r.actingTeam} disabled={!canEdit} onValueChange={(v) => updateRow(i, { actingTeam: v as BanVetoTeamSlot })}>
                      <SelectTrigger data-testid={`select-hbs-team-${game.id}-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {banVetoTeamSlots.map(t => (
                          <SelectItem key={t} value={t} data-testid={`option-hbs-team-${t}-${game.id}-${i}`}>
                            {t === "a" ? "Our team" : t === "b" ? "Opponent" : "Auto"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <HeroCombobox
                      value={r.heroId}
                      onChange={(id) => updateRow(i, { heroId: id })}
                      heroes={heroes}
                      disabled={!canEdit}
                      testId={`combobox-hbs-hero-${game.id}-${i}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={r.notes || ""}
                      onChange={(e) => updateRow(i, { notes: e.target.value || null })}
                      disabled={!canEdit}
                      placeholder="optional"
                      data-testid={`input-hbs-notes-${game.id}-${i}`}
                    />
                  </td>
                  <td className="px-3 py-2">
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
          {canEdit && rows.length < 40 && (
            <div className="p-2 border-t border-border bg-muted/20">
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

interface HeroComboboxProps {
  value: string | null;
  onChange: (id: string | null) => void;
  heroes: Hero[];
  disabled?: boolean;
  testId: string;
}

function HeroCombobox({ value, onChange, heroes, disabled, testId }: HeroComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = useMemo(() => heroes.filter(h => h.isActive), [heroes]);
  const items = useMemo(() => {
    const list = [...active].sort((a, b) => a.name.localeCompare(b.name));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(h => h.name.toLowerCase().includes(q) || (h.role || "").toLowerCase().includes(q));
  }, [active, query]);
  const selected = value ? heroes.find(h => h.id === value) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-start font-normal gap-2"
          data-testid={testId}
        >
          <HeroAvatar hero={selected || undefined} size="h-6 w-6" />
          <span className="truncate text-left flex-1">{selected ? selected.name : <span className="text-muted-foreground">Pick hero</span>}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hero…"
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
            <div className="px-3 py-2 text-xs text-muted-foreground italic">No heroes match.</div>
          ) : items.map(h => (
            <button
              key={h.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover-elevate ${value === h.id ? "font-medium" : ""}`}
              onClick={() => { onChange(h.id); setOpen(false); setQuery(""); }}
              data-testid={`${testId}-option-${h.id}`}
            >
              <HeroAvatar hero={h} size="h-6 w-6" />
              <span className="flex-1 text-left truncate">{h.name}</span>
              <span className="text-[10px] text-muted-foreground">{h.role}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
