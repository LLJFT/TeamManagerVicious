import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BarChart3, Save, Check, ChevronsUpDown, X, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  Game,
  Player,
  StatField,
  Hero,
  PlayerGameStat,
  GameHero,
  Opponent,
  OpponentPlayer,
  MatchParticipant,
  OpponentPlayerGameStat,
} from "@shared/schema";

interface Props {
  game: Game;
  opponentId: string | null;
  ourPlayers: Player[];
  statFields: StatField[];
  heroes: Hero[];
  isSaving: boolean;
  onSavedToast: (msg: string, type: "success" | "error") => void;
}

type RowKey = string;
type RowState = {
  played: boolean;
  heroIds: string[];
  stats: Record<string, string>;
};

function HeroMultiSelect({
  heroes,
  value,
  onChange,
  testIdPrefix,
  disabled,
}: {
  heroes: Hero[];
  value: string[];
  onChange: (next: string[]) => void;
  testIdPrefix: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = heroes.filter(h => value.includes(h.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          disabled={disabled}
          className={cn("min-w-[160px] justify-between font-normal", value.length === 0 && "text-muted-foreground")}
          data-testid={`${testIdPrefix}-trigger`}
        >
          <span className="truncate">
            {value.length === 0 ? "Select heroes..." : `${value.length} selected`}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search heroes..." />
          <CommandList>
            <CommandEmpty>No heroes found.</CommandEmpty>
            <CommandGroup>
              {heroes.map(h => {
                const isSelected = value.includes(h.id);
                return (
                  <CommandItem
                    key={h.id}
                    value={h.name}
                    onSelect={() => {
                      onChange(isSelected ? value.filter(id => id !== h.id) : [...value, h.id]);
                    }}
                    data-testid={`${testIdPrefix}-option-${h.id}`}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{h.name}</span>
                    {h.role && <span className="ml-2 text-xs text-muted-foreground">{h.role}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MatchSidesEditor({
  game,
  opponentId,
  ourPlayers,
  statFields,
  heroes,
  isSaving,
  onSavedToast,
}: Props) {
  const matchId = game.id;

  const { data: opponentPlayers = [] } = useQuery<OpponentPlayer[]>({
    queryKey: ["/api/opponents", opponentId, "players"],
    enabled: !!opponentId,
    queryFn: async () => {
      const r = await fetch(`/api/opponents/${opponentId}/players`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load opponent players");
      return r.json();
    },
  });

  const { data: participants = [], isSuccess: participantsLoaded } = useQuery<MatchParticipant[]>({
    queryKey: ["/api/games", matchId, "participation"],
    queryFn: async () => {
      const r = await fetch(`/api/games/${matchId}/participation`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load participation");
      return r.json();
    },
  });

  const { data: ourStats = [], isSuccess: ourStatsLoaded } = useQuery<PlayerGameStat[]>({
    queryKey: ["/api/games", matchId, "player-stats"],
    queryFn: async () => {
      const r = await fetch(`/api/games/${matchId}/player-stats`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: oppStats = [], isSuccess: oppStatsLoaded } = useQuery<OpponentPlayerGameStat[]>({
    queryKey: ["/api/games", matchId, "opponent-player-stats"],
    enabled: !!opponentId,
    queryFn: async () => {
      const r = await fetch(`/api/games/${matchId}/opponent-player-stats`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load opponent stats");
      return r.json();
    },
  });

  const { data: gameHeroes = [], isSuccess: heroesLoaded } = useQuery<GameHero[]>({
    queryKey: ["/api/games", matchId, "heroes"],
    queryFn: async () => {
      const r = await fetch(`/api/games/${matchId}/heroes`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load game heroes");
      return r.json();
    },
  });

  const [ourRows, setOurRows] = useState<Record<RowKey, RowState>>({});
  const [oppRows, setOppRows] = useState<Record<RowKey, RowState>>({});
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const initKey = `${matchId}|${opponentId || ""}|${opponentPlayers.length}|${ourPlayers.length}`;

  useEffect(() => {
    if (!participantsLoaded || !ourStatsLoaded || !heroesLoaded) return;
    if (opponentId && !oppStatsLoaded) return;
    if (initializedFor === initKey) return;

    const our: Record<RowKey, RowState> = {};
    for (const p of ourPlayers) {
      const part = participants.find(x => x.side === "us" && x.playerId === p.id);
      our[p.id] = {
        played: part ? part.played : true,
        heroIds: gameHeroes.filter(h => h.playerId === p.id).map(h => h.heroId),
        stats: {},
      };
    }
    for (const s of ourStats) {
      if (!s.playerId || !s.statFieldId) continue;
      if (!our[s.playerId]) our[s.playerId] = { played: true, heroIds: [], stats: {} };
      our[s.playerId].stats[s.statFieldId] = s.value;
    }
    setOurRows(our);

    const opp: Record<RowKey, RowState> = {};
    for (const op of opponentPlayers) {
      const part = participants.find(x => x.side === "opponent" && x.opponentPlayerId === op.id);
      opp[op.id] = {
        played: part ? part.played : true,
        heroIds: gameHeroes.filter(h => h.opponentPlayerId === op.id).map(h => h.heroId),
        stats: {},
      };
    }
    for (const s of oppStats) {
      if (!s.opponentPlayerId) continue;
      if (!opp[s.opponentPlayerId]) opp[s.opponentPlayerId] = { played: true, heroIds: [], stats: {} };
      if (s.statFieldId) opp[s.opponentPlayerId].stats[s.statFieldId] = s.value;
    }
    setOppRows(opp);

    setInitializedFor(initKey);
  }, [participants, participantsLoaded, ourStats, ourStatsLoaded, oppStats, oppStatsLoaded, gameHeroes, heroesLoaded, ourPlayers, opponentPlayers, opponentId, initKey, initializedFor]);

  const updateOur = (playerId: string, patch: Partial<RowState>) => {
    setOurRows(prev => ({ ...prev, [playerId]: { ...(prev[playerId] || { played: true, heroIds: [], stats: {} }), ...patch } }));
  };
  const updateOpp = (oppPlayerId: string, patch: Partial<RowState>) => {
    setOppRows(prev => ({ ...prev, [oppPlayerId]: { ...(prev[oppPlayerId] || { played: true, heroIds: [], stats: {} }), ...patch } }));
  };

  const saveAll = useMutation({
    mutationFn: async () => {
      const partRows: any[] = [];
      const heroRows: any[] = [];
      const ourStatRows: any[] = [];
      const oppStatRows: any[] = [];

      for (const p of ourPlayers) {
        const r = ourRows[p.id];
        if (!r) continue;
        partRows.push({ side: "us", playerId: p.id, opponentPlayerId: null, played: r.played });
        for (const hid of r.heroIds) {
          heroRows.push({ playerId: p.id, opponentPlayerId: null, heroId: hid });
        }
        for (const fId of Object.keys(r.stats)) {
          const v = r.stats[fId];
          if (v && v.trim() !== "") {
            ourStatRows.push({ gameId: matchId, playerId: p.id, statFieldId: fId, value: v });
          }
        }
      }

      for (const op of opponentPlayers) {
        const r = oppRows[op.id];
        if (!r) continue;
        partRows.push({ side: "opponent", playerId: null, opponentPlayerId: op.id, played: r.played });
        for (const hid of r.heroIds) {
          heroRows.push({ playerId: null, opponentPlayerId: op.id, heroId: hid });
        }
        for (const fId of Object.keys(r.stats)) {
          const v = r.stats[fId];
          if (v && v.trim() !== "") {
            oppStatRows.push({ opponentPlayerId: op.id, statFieldId: fId, value: v });
          }
        }
      }

      await apiRequest("PUT", `/api/games/${matchId}/participation`, partRows);
      await apiRequest("PUT", `/api/games/${matchId}/heroes`, heroRows);
      await apiRequest("POST", `/api/games/${matchId}/player-stats`, { stats: ourStatRows });
      if (opponentId) {
        await apiRequest("POST", `/api/games/${matchId}/opponent-player-stats`, oppStatRows);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "participation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "player-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "opponent-player-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "heroes"] });
      onSavedToast("Match stats saved", "success");
    },
    onError: (err: any) => {
      onSavedToast(err.message || "Failed to save match stats", "error");
    },
  });

  if (statFields.length === 0 && heroes.length === 0) {
    return (
      <Card className="mt-3">
        <CardContent className="p-4 text-sm text-muted-foreground">
          No stat fields or heroes configured for this game mode.
        </CardContent>
      </Card>
    );
  }

  const renderRows = (
    side: "us" | "opponent",
    rosterRows: { id: string; name: string; role?: string | null }[],
    rowState: Record<RowKey, RowState>,
    onUpdate: (id: string, patch: Partial<RowState>) => void,
  ) => {
    if (rosterRows.length === 0) {
      return (
        <div className="p-4 text-sm text-muted-foreground text-center">
          {side === "opponent" ? "No opponent players configured. Add players via the Opponents tab." : "No players configured."}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left font-semibold">Player</th>
              <th className="p-2 text-center font-semibold w-20">Played</th>
              <th className="p-2 text-left font-semibold">Heroes</th>
              {statFields.map(f => (
                <th key={f.id} className="p-2 text-center font-semibold whitespace-nowrap">{f.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rosterRows.map(p => {
              const r = rowState[p.id] || { played: true, heroIds: [], stats: {} };
              const dnp = !r.played;
              return (
                <tr key={p.id} className="border-t border-border" data-testid={`row-${side}-${p.id}`}>
                  <td className="p-2 whitespace-nowrap">
                    <div className="font-medium">{p.name}</div>
                    {p.role && <div className="text-xs text-muted-foreground">{p.role}</div>}
                  </td>
                  <td className="p-2 text-center">
                    <Switch
                      checked={r.played}
                      onCheckedChange={(v) => onUpdate(p.id, { played: !!v })}
                      data-testid={`switch-played-${side}-${p.id}`}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <HeroMultiSelect
                        heroes={heroes}
                        value={r.heroIds}
                        onChange={(next) => onUpdate(p.id, { heroIds: next })}
                        testIdPrefix={`heroes-${side}-${p.id}`}
                        disabled={dnp}
                      />
                      {r.heroIds.slice(0, 3).map(hid => {
                        const h = heroes.find(x => x.id === hid);
                        if (!h) return null;
                        return (
                          <Badge key={hid} variant="secondary" className="text-xs">
                            {h.name}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={() => onUpdate(p.id, { heroIds: r.heroIds.filter(id => id !== hid) })}
                              className="ml-1 cursor-pointer opacity-70 hover:opacity-100"
                              data-testid={`badge-hero-remove-${side}-${p.id}-${hid}`}
                            >
                              <X className="h-3 w-3" />
                            </span>
                          </Badge>
                        );
                      })}
                      {r.heroIds.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{r.heroIds.length - 3}</Badge>
                      )}
                    </div>
                  </td>
                  {statFields.map(f => (
                    <td key={f.id} className="p-2">
                      <Input
                        value={r.stats[f.id] || ""}
                        disabled={dnp}
                        onChange={(e) => onUpdate(p.id, { stats: { ...r.stats, [f.id]: e.target.value } })}
                        className="w-20 text-center"
                        placeholder="0"
                        data-testid={`stat-${side}-${p.id}-${f.id}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Card className="mt-3" data-testid={`match-sides-editor-${matchId}`}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Match Stats — {game.gameCode}</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => saveAll.mutate()}
            disabled={saveAll.isPending || isSaving}
            data-testid={`button-save-match-${matchId}`}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveAll.isPending ? "Saving..." : "Save Match"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="border border-border rounded-md">
          <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/50">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Our Team</span>
          </div>
          {renderRows("us", ourPlayers.map(p => ({ id: p.id, name: p.name, role: p.role })), ourRows, updateOur)}
        </div>

        {opponentId && (
          <div className="border border-border rounded-md">
            <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/50">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Opponent Team</span>
            </div>
            {renderRows("opponent", opponentPlayers.map(p => ({ id: p.id, name: p.name, role: p.role })), oppRows, updateOpp)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
