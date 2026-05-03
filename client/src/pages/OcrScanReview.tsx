import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import { useGame } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, AlertTriangle, Save, Trash2 } from "lucide-react";
import type {
  ScoreboardOcrScan, OcrParsedCandidate, OcrPlayerRow,
  Player, OpponentPlayer, Hero, StatField, Map as MapType, Side, Game,
} from "@shared/schema";

export default function OcrScanReview() {
  const [, params] = useRoute("/:gameSlug/:rosterCode/ocr-scans/:id");
  const scanId = params?.id;
  const { fullSlug, gameId, rosterId } = useGame();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: scan, isLoading } = useQuery<ScoreboardOcrScan>({
    queryKey: ["/api/ocr-scans", scanId],
    enabled: !!scanId,
  });

  const matchId = scan?.matchId;
  const { data: game } = useQuery<Game>({
    queryKey: ["/api/games", matchId],
    enabled: !!matchId,
  });

  const { data: players = [] } = useQuery<Player[]>({ queryKey: ["/api/players"], enabled: !!gameId });
  const { data: heroes = [] } = useQuery<Hero[]>({ queryKey: ["/api/heroes"], enabled: !!gameId });
  const { data: maps = [] } = useQuery<MapType[]>({ queryKey: ["/api/maps"], enabled: !!gameId });
  const { data: sides = [] } = useQuery<Side[]>({ queryKey: ["/api/sides"], enabled: !!gameId });
  const { data: statFields = [] } = useQuery<StatField[]>({
    queryKey: ["/api/stat-fields", game?.gameModeId],
    queryFn: async () => {
      if (!game?.gameModeId) return [];
      const res = await fetch(`/api/stat-fields?gameModeId=${game.gameModeId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!game?.gameModeId,
  });
  const { data: opponentPlayers = [] } = useQuery<OpponentPlayer[]>({
    queryKey: ["/api/opponents", (game as any)?.opponentId, "players"],
    queryFn: async () => {
      const oid = (game as any)?.opponentId;
      if (!oid) return [];
      const res = await fetch(`/api/opponents/${oid}/players`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(game as any)?.opponentId,
  });

  const [draft, setDraft] = useState<OcrParsedCandidate | null>(null);
  useEffect(() => {
    if (scan && !draft) {
      const c = (scan.editedCandidate || scan.parsedCandidate) as OcrParsedCandidate | null;
      setDraft(c ? structuredClone(c) : { rows: [] });
    }
  }, [scan, draft]);

  const saveMutation = useMutation({
    mutationFn: async (editedCandidate: OcrParsedCandidate) => {
      return apiRequest("PATCH", `/api/ocr-scans/${scanId}`, { editedCandidate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ocr-scans", scanId] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async (overwrite: boolean) => {
      const res = await fetch(`/api/ocr-scans/${scanId}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite }),
      });
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error(body.error || "Confirm failed"), { status: res.status, body });
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "heroes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "participation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "player-stats"] });
      toast({ title: "Imported", description: "Scoreboard data saved." });
      // Bounce back to the event the game belongs to.
      if (game?.eventId) navigate(`/${fullSlug}/events/${game.eventId}`);
    },
    onError: (err: any) => {
      if (err.status === 409) {
        toast({
          title: "Existing data found",
          description: "Match already has stats. Click Overwrite to replace.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Import failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const updateRow = (idx: number, patch: Partial<OcrPlayerRow>) => {
    if (!draft) return;
    const next = { ...draft, rows: draft.rows.map((r, i) => i === idx ? { ...r, ...patch } : r) };
    setDraft(next);
  };
  const removeRow = (idx: number) => {
    if (!draft) return;
    setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== idx) });
  };
  const updateStat = (idx: number, statId: string, value: string) => {
    if (!draft) return;
    const row = draft.rows[idx];
    const stats = { ...(row.stats || {}), [statId]: value };
    updateRow(idx, { stats });
  };

  const ourRows = useMemo(() => draft?.rows.map((r, i) => ({ r, i })).filter(x => x.r.side === "us") ?? [], [draft]);
  const oppRows = useMemo(() => draft?.rows.map((r, i) => ({ r, i })).filter(x => x.r.side === "opponent") ?? [], [draft]);

  if (isLoading || !scan || !draft) {
    return <div className="p-6 text-muted-foreground" data-testid="text-loading">Loading scan…</div>;
  }

  const renderRow = (idx: number, row: OcrPlayerRow) => (
    <Card key={idx} className="p-3" data-testid={`row-ocr-${idx}`}>
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs text-muted-foreground mb-1">
            Detected: <span className="font-mono">{row.rawName}</span>
            {row.rawHero && <> · <span className="font-mono">{row.rawHero}</span></>}
          </div>
          {row.side === "us" ? (
            <Select
              value={row.matchedPlayerId || ""}
              onValueChange={(v) => updateRow(idx, { matchedPlayerId: v || null, matchedOpponentPlayerId: null })}
            >
              <SelectTrigger data-testid={`select-player-${idx}`}><SelectValue placeholder="Pick player" /></SelectTrigger>
              <SelectContent>
                {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={row.matchedOpponentPlayerId || ""}
              onValueChange={(v) => updateRow(idx, { matchedOpponentPlayerId: v || null, matchedPlayerId: null })}
            >
              <SelectTrigger data-testid={`select-opp-player-${idx}`}><SelectValue placeholder="Pick opponent player" /></SelectTrigger>
              <SelectContent>
                {opponentPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="min-w-[180px]">
          <Select value={row.matchedHeroId || ""} onValueChange={(v) => updateRow(idx, { matchedHeroId: v || null })}>
            <SelectTrigger data-testid={`select-hero-${idx}`}><SelectValue placeholder="Pick hero" /></SelectTrigger>
            <SelectContent>
              {heroes.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          {statFields.map(sf => (
            <div key={sf.id} className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">{sf.name}</span>
              <Input
                className="w-20"
                value={String(row.stats?.[sf.id] ?? "")}
                onChange={(e) => updateStat(idx, sf.id, e.target.value)}
                data-testid={`input-stat-${sf.id}-${idx}`}
              />
            </div>
          ))}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => removeRow(idx)}
            data-testid={`button-remove-row-${idx}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto" data-testid="page-ocr-review">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {game?.eventId && (
            <Link href={`/${fullSlug}/events/${game.eventId}`}>
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </Link>
          )}
          <h1 className="text-xl font-semibold">Review Scoreboard Scan</h1>
          <Badge variant={scan.status === "confirmed" ? "default" : "secondary"} data-testid="status-scan">
            {scan.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => draft && saveMutation.mutate(draft)}
            disabled={saveMutation.isPending}
            data-testid="button-save-draft"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "Saving…" : "Save draft"}
          </Button>
          <Button
            onClick={() => draft && saveMutation.mutateAsync(draft).then(() => confirmMutation.mutate(false))}
            disabled={confirmMutation.isPending || saveMutation.isPending || scan.status === "confirmed"}
            data-testid="button-confirm-import"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {confirmMutation.isPending ? "Importing…" : "Confirm import"}
          </Button>
          {confirmMutation.isError && (confirmMutation.error as any)?.status === 409 && (
            <Button
              variant="destructive"
              onClick={() => confirmMutation.mutate(true)}
              data-testid="button-overwrite-import"
            >
              <AlertTriangle className="h-4 w-4 mr-1" /> Overwrite
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Source image</CardTitle></CardHeader>
          <CardContent>
            <img
              src={scan.imageObjectPath}
              alt="Scoreboard source"
              className="w-full rounded-md border"
              data-testid="img-source"
            />
            {scan.errorMessage && (
              <p className="text-xs text-destructive mt-2" data-testid="text-ocr-error">{scan.errorMessage}</p>
            )}
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw OCR text</summary>
              <pre className="whitespace-pre-wrap p-2 bg-muted rounded mt-1" data-testid="text-raw-ocr">
                {(scan.rawOcr as any)?.text || ""}
              </pre>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Match summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Score:</span>
              <Input
                className="w-20"
                value={draft.ourScore ?? ""}
                onChange={(e) => setDraft({ ...draft, ourScore: e.target.value === "" ? null : parseInt(e.target.value, 10) || 0 })}
                data-testid="input-our-score"
              />
              <span>-</span>
              <Input
                className="w-20"
                value={draft.opponentScore ?? ""}
                onChange={(e) => setDraft({ ...draft, opponentScore: e.target.value === "" ? null : parseInt(e.target.value, 10) || 0 })}
                data-testid="input-opp-score"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12">Map:</span>
              <Select
                value={draft.matchedMapId || ""}
                onValueChange={(v) => setDraft({ ...draft, matchedMapId: v || null })}
              >
                <SelectTrigger data-testid="select-map"><SelectValue placeholder="Pick map" /></SelectTrigger>
                <SelectContent>
                  {maps.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12">Side:</span>
              <Select
                value={draft.matchedSideId || ""}
                onValueChange={(v) => setDraft({ ...draft, matchedSideId: v || null })}
              >
                <SelectTrigger data-testid="select-side"><SelectValue placeholder="Pick side" /></SelectTrigger>
                <SelectContent>
                  {sides.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              Our team ({ourRows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ourRows.length === 0 && <p className="text-xs text-muted-foreground">No rows on our side.</p>}
            {ourRows.map(({ r, i }) => renderRow(i, r))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Opponent ({oppRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {oppRows.length === 0 && <p className="text-xs text-muted-foreground">No rows on opponent side.</p>}
            {oppRows.map(({ r, i }) => renderRow(i, r))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
