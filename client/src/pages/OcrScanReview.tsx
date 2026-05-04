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
import { ArrowLeft, CheckCircle2, Save, Trash2, Sparkles, ShieldCheck, ShieldAlert, XCircle, HelpCircle } from "lucide-react";
import type {
  ScoreboardOcrScan, OcrParsedCandidate, OcrPlayerRow,
  Player, OpponentPlayer, Hero, StatField, Game,
} from "@shared/schema";

type RowSide = "us" | "opponent" | "unknown";

export default function OcrScanReview() {
  const [, params] = useRoute("/:gameSlug/:rosterCode/ocr-scans/:id");
  const scanId = params?.id;
  const { fullSlug } = useGame();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: scan, isLoading } = useQuery<ScoreboardOcrScan>({
    queryKey: ["/api/ocr-scans", scanId],
    enabled: !!scanId,
  });

  const matchId = scan?.matchId;
  // Use an explicit fetch (no default fetcher / no URL-global appender) so the
  // game lookup is decoupled from whatever roster context is in the URL. The
  // returned game record is then the single source of truth for gameId /
  // rosterId / opponentId of every dropdown on this screen.
  const { data: game } = useQuery<Game>({
    queryKey: ["/api/games", matchId],
    queryFn: async () => {
      if (!matchId) throw new Error("matchId required");
      const res = await fetch(`/api/games/${matchId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load game: ${res.status}`);
      return res.json();
    },
    enabled: !!matchId,
  });

  // The scan's match is the source of truth for game/roster scope of every
  // dropdown on this screen. Using URL-derived gameId/rosterId from
  // useGame() is unsafe: (a) the rosterId requires /api/rosters to load,
  // racing the players query, and (b) a coach can land here from a
  // different roster context than the scan was uploaded under.
  const scanGameId = (game as any)?.gameId ?? null;
  const scanRosterId = (game as any)?.rosterId ?? null;
  const opponentId = (game as any)?.opponentId ?? null;

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players", { gameId: scanGameId, rosterId: scanRosterId }],
    queryFn: async () => {
      if (!scanGameId || !scanRosterId) return [];
      const res = await fetch(
        `/api/players?gameId=${scanGameId}&rosterId=${scanRosterId}`,
        { credentials: "include" },
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!scanGameId && !!scanRosterId,
  });
  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId: scanGameId, rosterId: scanRosterId }],
    queryFn: async () => {
      if (!scanGameId) return [];
      const url = scanRosterId
        ? `/api/heroes?gameId=${scanGameId}&rosterId=${scanRosterId}`
        : `/api/heroes?gameId=${scanGameId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!scanGameId,
  });
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
    queryKey: ["/api/opponents", opponentId, "players"],
    queryFn: async () => {
      if (!opponentId) return [];
      const res = await fetch(`/api/opponents/${opponentId}/players`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!opponentId,
  });

  const [draft, setDraft] = useState<OcrParsedCandidate | null>(null);
  const [overwriteMode, setOverwriteMode] = useState(false);
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
      if (!res.ok) throw Object.assign(new Error(body.message || body.error || "Confirm failed"), { status: res.status, body });
      return body;
    },
    onSuccess: (body: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ocr-scans", scanId] });
      // Invalidate every analytics surface that reads from the tables we
      // just wrote (player_game_stats / opponent_player_game_stats /
      // match_participants / game_heroes) so Player Leaderboard, Player
      // Stats and Team Leaderboard refresh immediately on import.
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "heroes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "participation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", matchId, "player-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-game-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opponent-player-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/match-participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-heroes"] });
      const counts = body?.counts || {};
      const skipped = body?.skipped || {};
      const skippedTotal = (skipped.participants || 0) + (skipped.heroes || 0) + (skipped.stats || 0) + (skipped.opponentStats || 0);
      const desc = body?.mode === "overwrite"
        ? `Replaced existing data with ${counts.participants ?? 0} players, ${counts.heroes ?? 0} heroes, ${(counts.stats ?? 0) + (counts.opponentStats ?? 0)} stat rows.`
        : `Added ${counts.participants ?? 0} players, ${counts.heroes ?? 0} heroes, ${(counts.stats ?? 0) + (counts.opponentStats ?? 0)} stat rows.${skippedTotal ? ` Preserved ${skippedTotal} existing rows.` : ""}`;
      toast({ title: "Imported", description: desc });
      if (game?.eventId) navigate(`/${fullSlug}/events/${game.eventId}`);
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/ocr-scans/${scanId}`),
    onSuccess: () => {
      toast({ title: "Scan discarded" });
      if (game?.eventId) navigate(`/${fullSlug}/events/${game.eventId}`);
    },
    onError: (e: any) => toast({ title: "Discard failed", description: e.message, variant: "destructive" }),
  });

  const updateRow = (idx: number, patch: Partial<OcrPlayerRow>) => {
    if (!draft) return;
    const next = { ...draft, rows: draft.rows.map((r, i) => i === idx ? { ...r, ...patch } : r) };
    setDraft(next);
  };
  // When the user flips a row's side, clear the matched id of the *other*
  // side so we never end up with both ids set at the same time.
  const setRowSide = (idx: number, side: RowSide) => {
    if (!draft) return;
    const row = draft.rows[idx];
    const patch: Partial<OcrPlayerRow> = { side };
    if (side === "us") patch.matchedOpponentPlayerId = null;
    else if (side === "opponent") patch.matchedPlayerId = null;
    else { patch.matchedPlayerId = null; patch.matchedOpponentPlayerId = null; }
    updateRow(idx, { ...row, ...patch });
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

  const indexedRows = useMemo(
    () => draft?.rows.map((r, i) => ({ r, i })) ?? [],
    [draft],
  );
  const ourRows = useMemo(
    () => indexedRows.filter(x => x.r.side === "us"),
    [indexedRows],
  );
  const oppRows = useMemo(
    () => indexedRows.filter(x => x.r.side === "opponent"),
    [indexedRows],
  );
  const unknownRows = useMemo(
    () => indexedRows.filter(x => x.r.side === "unknown"),
    [indexedRows],
  );

  // A row is "unassigned" if its side is unknown OR its side is set but the
  // corresponding player id is missing. Confirm is blocked while any row is
  // unassigned (server enforces the same rule with a 400 — this is just a
  // friendlier client-side gate).
  const unassignedCount = useMemo(() => indexedRows.filter(({ r }) => {
    if (r.side === "unknown") return true;
    if (r.side === "us" && !r.matchedPlayerId) return true;
    if (r.side === "opponent" && !r.matchedOpponentPlayerId) return true;
    return false;
  }).length, [indexedRows]);

  if (isLoading || !scan || !draft) {
    return <div className="p-6 text-muted-foreground" data-testid="text-loading">Loading scan…</div>;
  }

  const renderRow = (idx: number, row: OcrPlayerRow) => {
    const conf = typeof row.confidence === "number" ? row.confidence : 0;
    const confTone: "default" | "secondary" | "destructive" =
      conf >= 0.7 ? "default" : conf >= 0.5 ? "secondary" : "destructive";
    const isUnassigned =
      row.side === "unknown" ||
      (row.side === "us" && !row.matchedPlayerId) ||
      (row.side === "opponent" && !row.matchedOpponentPlayerId);
    // Part 3: read-only role badge for matched players. Roles come from the
    // configured player / opponent player record — never from OCR — and are
    // never required (an opponent player without a role just shows nothing).
    const matchedOurPlayer = row.matchedPlayerId
      ? players.find((p) => p.id === row.matchedPlayerId)
      : null;
    const matchedOppPlayer = row.matchedOpponentPlayerId
      ? opponentPlayers.find((p) => p.id === row.matchedOpponentPlayerId)
      : null;
    const matchedRole = matchedOurPlayer?.role || matchedOppPlayer?.role || null;
    return (
    <Card
      key={idx}
      className={`p-3 ${isUnassigned ? "border-destructive/50" : ""}`}
      data-testid={`row-ocr-${idx}`}
    >
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1" data-testid={`badge-source-${idx}`}>
              <Sparkles className="h-3 w-3" /> OCR
            </Badge>
            <Badge variant={confTone} data-testid={`badge-confidence-${idx}`}>
              {conf >= 0.8 ? "High" : conf >= 0.5 ? "Medium" : "Low"} · {Math.round(conf * 100)}%
            </Badge>
            {isUnassigned && (
              <Badge variant="destructive" className="gap-1" data-testid={`badge-needs-assignment-${idx}`}>
                <HelpCircle className="h-3 w-3" /> Needs assignment
              </Badge>
            )}
            <span>Detected: <span className="font-mono">{row.rawName}</span></span>
            {row.rawHero && <span className="font-mono">· {row.rawHero}</span>}
          </div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Side</span>
            <Select
              value={row.side}
              onValueChange={(v) => setRowSide(idx, v as RowSide)}
            >
              <SelectTrigger className="w-[140px]" data-testid={`select-side-${idx}`}>
                <SelectValue placeholder="Pick side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">Our team</SelectItem>
                <SelectItem value="opponent">Opponent</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {row.side === "us" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={row.matchedPlayerId || ""}
                onValueChange={(v) => updateRow(idx, { matchedPlayerId: v || null, matchedOpponentPlayerId: null })}
              >
                <SelectTrigger className="min-w-[200px]" data-testid={`select-player-${idx}`}><SelectValue placeholder="Pick player" /></SelectTrigger>
                <SelectContent>
                  {/* Part 4: player dropdown is scoped to current roster only. */}
                  {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {matchedRole && (
                <Badge variant="secondary" data-testid={`badge-role-${idx}`}>{matchedRole}</Badge>
              )}
            </div>
          ) : row.side === "opponent" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={row.matchedOpponentPlayerId || ""}
                onValueChange={(v) => updateRow(idx, { matchedOpponentPlayerId: v || null, matchedPlayerId: null })}
                disabled={!opponentId}
              >
                <SelectTrigger
                  className="min-w-[200px]"
                  data-testid={`select-opp-player-${idx}`}
                >
                  <SelectValue
                    placeholder={
                      !opponentId
                        ? "No opponent linked"
                        : opponentPlayers.length === 0
                          ? "No opponent players yet"
                          : "Pick opponent player"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {/* Scoped to this match's opponent only via /api/opponents/:id/players. */}
                  {opponentPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {matchedRole && (
                <Badge variant="secondary" data-testid={`badge-role-${idx}`}>{matchedRole}</Badge>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic" data-testid={`text-pick-side-first-${idx}`}>
              Pick a side above to assign a player.
            </p>
          )}
        </div>
        <div className="min-w-[200px]">
          <Select value={row.matchedHeroId || ""} onValueChange={(v) => updateRow(idx, { matchedHeroId: v || null })}>
            <SelectTrigger data-testid={`select-hero-${idx}`}>
              <SelectValue
                placeholder={heroes.length === 0 ? "No heroes configured" : "Pick hero"}
              />
            </SelectTrigger>
            <SelectContent>
              {/* Scoped to this match's game (and roster when present) so heroes
                  reflect the roster's configured pool, not the global list. */}
              {heroes.map(h => (
                <SelectItem key={h.id} value={h.id}>
                  <span className="flex items-center gap-2">
                    {h.imageUrl ? (
                      <img
                        src={h.imageUrl}
                        alt=""
                        className="h-5 w-5 rounded object-cover shrink-0"
                      />
                    ) : (
                      <span className="h-5 w-5 rounded bg-muted shrink-0" />
                    )}
                    <span>{h.name}</span>
                  </span>
                </SelectItem>
              ))}
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
  };

  const validation = (draft as any)?.validation as
    | { isScoreboard: boolean; confidence: number; reason: string; partial?: boolean }
    | undefined;
  const lowConfidenceRows = draft?.rows.filter((r) => (r.confidence ?? 0) < 0.5).length ?? 0;
  const confirmDisabled =
    confirmMutation.isPending ||
    saveMutation.isPending ||
    scan.status === "confirmed" ||
    unassignedCount > 0;

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto" data-testid="page-ocr-review">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
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
          {validation && (
            <Badge
              variant={validation.confidence >= 0.7 ? "default" : "secondary"}
              className="gap-1"
              data-testid="badge-scoreboard-validation"
            >
              <ShieldCheck className="h-3 w-3" />
              Scoreboard {Math.round(validation.confidence * 100)}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={overwriteMode}
              onChange={(e) => setOverwriteMode(e.target.checked)}
              data-testid="checkbox-overwrite-mode"
            />
            Replace existing
          </label>
          <Button
            variant="ghost"
            onClick={() => discardMutation.mutate()}
            disabled={discardMutation.isPending || scan.status === "confirmed"}
            data-testid="button-discard-scan"
          >
            <XCircle className="h-4 w-4 mr-1" />
            {discardMutation.isPending ? "Discarding…" : "Discard scan"}
          </Button>
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
            onClick={async () => {
              if (!draft) return;
              try {
                // Persist the latest in-flight edits before we attempt the
                // confirm. If save fails we surface the save error toast
                // (raised inside saveMutation.onError) and stop — confirm
                // is never fired against stale data.
                await saveMutation.mutateAsync(draft);
              } catch {
                return;
              }
              confirmMutation.mutate(overwriteMode);
            }}
            disabled={confirmDisabled}
            data-testid="button-confirm-import"
            variant={overwriteMode ? "destructive" : "default"}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {confirmMutation.isPending
              ? "Importing…"
              : unassignedCount > 0
                ? `Assign ${unassignedCount} row${unassignedCount === 1 ? "" : "s"} first`
                : overwriteMode
                  ? "Replace & import"
                  : "Confirm import (merge)"}
          </Button>
        </div>
      </div>

      {unassignedCount > 0 && (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          data-testid="banner-unassigned"
        >
          <HelpCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              Stats were extracted, but {unassignedCount} row{unassignedCount === 1 ? "" : "s"} need to be assigned manually.
            </div>
            <div className="text-xs text-muted-foreground">
              Pick a side (Our team / Opponent) and a player for each row in the &ldquo;Needs assignment&rdquo;
              section below before confirming the import. The numeric stats you see were captured from the
              scoreboard — they will not be lost.
            </div>
          </div>
        </div>
      )}

      {validation?.partial && (
        <div
          className="flex items-start gap-2 rounded-md border-amber-500/40 border bg-amber-500/5 p-3 text-sm"
          data-testid="banner-partial-extraction"
        >
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              Partial extraction — only what was visible in the image was imported.
            </div>
            <div className="text-xs text-muted-foreground">
              The scoreboard image was incomplete, cropped, or hard to read. We saved every value
              we could see and left the rest blank — nothing was guessed. Fill in any missing
              fields manually below before confirming.
            </div>
          </div>
        </div>
      )}

      {lowConfidenceRows > 0 && !validation?.partial && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
          data-testid="banner-low-confidence"
        >
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Some rows have low OCR confidence.</div>
            <div className="text-xs text-muted-foreground">
              {lowConfidenceRows} row(s) under 50%. Review the highlighted rows below before confirming —
              values shown came from OCR; any selection you change is treated as a manual correction.
            </div>
          </div>
        </div>
      )}

      {/* Match Summary (Score / Map / Side) intentionally removed from this
          screen — those values are owned by Games & Scoreboard / Rounds and
          must NOT be overwritten by the OCR import. The confirm route also
          skips writing them. */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Source image</CardTitle></CardHeader>
        <CardContent>
          <img
            src={scan.imageObjectPath}
            alt="Scoreboard source"
            className="w-full rounded-md border max-h-[500px] object-contain"
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

      {!opponentId && oppRows.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
          data-testid="banner-no-opponent-linked"
        >
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">No opponent linked to this match.</div>
            <div className="text-xs text-muted-foreground">
              Opponent player rows can&rsquo;t be assigned until you link an opponent.
              Open Game Settings for this match and pick the opponent you played against,
              then come back here to assign them.
            </div>
          </div>
        </div>
      )}

      {unknownRows.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-destructive" />
              Needs assignment ({unknownRows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unknownRows.map(({ r, i }) => renderRow(i, r))}
          </CardContent>
        </Card>
      )}

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
