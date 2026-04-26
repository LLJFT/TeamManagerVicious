import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EventsSkeleton } from "@/components/PageSkeleton";
import { useGame } from "@/hooks/use-game";
import type { Event, EventResult, Game, InsertGame, GameMode, Map as MapType, Player, StatField, PlayerGameStat, Attendance, Staff, Side, GameRound, Hero, Opponent } from "@shared/schema";
import { MatchSidesEditor, saveMatchSidesDraft, type MatchSidesDraft } from "@/components/MatchSidesEditor";
import type { OpponentPlayer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Save, Upload, Eye, ExternalLink, Gamepad2, Map as MapIcon, BarChart3, UserCheck, Clock as ClockIcon, UserX, ChevronDown, ChevronUp, Ban } from "lucide-react";
import { GameHeroBanPanel } from "@/components/GameHeroBanPanel";
import { GameMapVetoPanel } from "@/components/GameMapVetoPanel";
import { ShareButton } from "@/components/ShareButton";
import { useState, useEffect, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";

export default function EventDetails() {
  const [, params] = useRoute("/:gameSlug/:rosterCode/events/:id");
  const eventId = params?.id || "";
  const { fullSlug, currentGame, currentRoster, gameId, rosterId } = useGame();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [eventResult, setEventResult] = useState<EventResult | "">("");
  const [opponentName, setOpponentName] = useState("");
  const [eventNotes, setEventNotes] = useState("");

  const [newGameCode, setNewGameCode] = useState("");
  const [newGameScore, setNewGameScore] = useState("");
  const [newGameImageUrl, setNewGameImageUrl] = useState("");
  const [newGameModeId, setNewGameModeId] = useState("");
  const [newGameMapId, setNewGameMapId] = useState("");
  const [newGameResult, setNewGameResult] = useState<"win" | "loss" | "draw" | "">("");
  const [newGameLink, setNewGameLink] = useState("");
  const [uploadingImageForNewGame, setUploadingImageForNewGame] = useState(false);

  type RoundDraft = { sideId: string | null; teamScore: number; opponentScore: number };
  const [newGameRounds, setNewGameRounds] = useState<RoundDraft[]>([
    { sideId: null, teamScore: 0, opponentScore: 0 },
  ]);
  const [editingRoundsForGame, setEditingRoundsForGame] = useState<string | null>(null);
  const [editingRounds, setEditingRounds] = useState<RoundDraft[]>([]);

  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [uploadingImageForGame, setUploadingImageForGame] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const [newGameMatchStats, setNewGameMatchStats] = useState<MatchSidesDraft>({ our: {}, opp: {} });
  const [matchStatsDraftInitFor, setMatchStatsDraftInitFor] = useState<string | null>(null);
  const [expandedMatchStats, setExpandedMatchStats] = useState<Record<string, boolean>>({});
  const [expandedHeroBan, setExpandedHeroBan] = useState<Record<string, boolean>>({});
  const [expandedMapVeto, setExpandedMapVeto] = useState<Record<string, boolean>>({});

  const toggleHeroBanExpanded = (id: string) => setExpandedHeroBan(s => ({ ...s, [id]: !s[id] }));
  const toggleMapVetoExpanded = (id: string) => setExpandedMapVeto(s => ({ ...s, [id]: !s[id] }));

  const onPanelSavedToast = (msg: string, type: "success" | "error") => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Event not found");
      const foundEvent: Event = await response.json();
      
      setEventResult((foundEvent.result as EventResult) || "");
      setOpponentName(foundEvent.opponentName || "");
      setEventNotes(foundEvent.notes || "");
      
      return foundEvent;
    },
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/events", eventId, "games"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/games`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: gameModes = [] } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: sidesList = [] } = useQuery<Side[]>({
    queryKey: ["/api/sides", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: allMaps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: editingRoundsData, isSuccess: editingRoundsLoaded } = useQuery<GameRound[]>({
    queryKey: ["/api/games", editingRoundsForGame, "rounds"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/games/${editingRoundsForGame}/rounds`);
      return res.json();
    },
    enabled: !!editingRoundsForGame,
  });

  const [roundsInitializedFor, setRoundsInitializedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!editingRoundsForGame) {
      setRoundsInitializedFor(null);
      return;
    }
    if (roundsInitializedFor === editingRoundsForGame) return;
    if (!editingRoundsLoaded) return;
    const data = editingRoundsData ?? [];
    if (data.length > 0) {
      setEditingRounds(data.map(r => ({
        sideId: r.sideId,
        teamScore: r.teamScore,
        opponentScore: r.opponentScore,
      })));
    } else {
      setEditingRounds([{ sideId: null, teamScore: 0, opponentScore: 0 }]);
    }
    setRoundsInitializedFor(editingRoundsForGame);
  }, [editingRoundsData, editingRoundsLoaded, editingRoundsForGame, roundsInitializedFor]);

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["/api/players", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: allStatFields = [] } = useQuery<StatField[]>({
    queryKey: ["/api/stat-fields", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: allHeroes = [] } = useQuery<Hero[]>({
    queryKey: ["/api/heroes", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });

  const { data: allOpponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/opponents", { gameId, rosterId }],
    enabled: !!gameId && !!rosterId,
  });
  const linkedOpponent = allOpponents.find(o => o.id === (event?.opponentId || ""));

  const draftOpponentId = event?.opponentId || null;
  const { data: draftOpponentPlayers = [] } = useQuery<OpponentPlayer[]>({
    queryKey: ["/api/opponents", draftOpponentId, "players"],
    enabled: !!draftOpponentId,
    queryFn: async () => {
      const r = await fetch(`/api/opponents/${draftOpponentId}/players`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load opponent players");
      return r.json();
    },
  });

  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/events", eventId, "attendance"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/attendance`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: !!eventId,
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async (data: { playerId?: string; staffId?: string; status: string }) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/attendance`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update attendance");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

  const getPlayerAttendanceStatus = (playerId: string) => {
    const record = attendanceRecords.find(a => a.playerId === playerId);
    return record?.status || null;
  };

  const getStaffAttendanceStatus = (staffId: string) => {
    const record = attendanceRecords.find(a => a.staffId === staffId);
    return record?.status || null;
  };

  const getStatFieldsByMode = (modeId: string) => {
    return allStatFields.filter(sf => sf.gameModeId === modeId);
  };

  const getMapsByMode = (modeId: string) => {
    return allMaps.filter(map => map.gameModeId === modeId);
  };

  const getModeName = (modeId: string | null) => {
    if (!modeId) return null;
    return gameModes.find(m => m.id === modeId)?.name || null;
  };

  const getMapName = (mapId: string | null) => {
    if (!mapId) return null;
    return allMaps.find(m => m.id === mapId)?.name || null;
  };

  const updateEventMutation = useMutation({
    mutationFn: async (data: { result: string; opponentName: string; notes: string }) => {
      const response = await apiRequest("PUT", `/api/events/${eventId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      setToastMessage("Event details saved");
      setToastType("success");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to save details");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

  const addGameMutation = useMutation({
    mutationFn: async (data: InsertGame) => {
      const response = await apiRequest("POST", "/api/games", data);
      return response.json();
    },
    onSuccess: async (newGame: Game) => {
      // Save rounds if any have been configured
      const roundsToSave = newGameRounds.filter(r =>
        r.sideId !== null || r.teamScore !== 0 || r.opponentScore !== 0
      );
      if (roundsToSave.length > 0) {
        const payload = roundsToSave.map((r, i) => ({
          rosterId: newGame.rosterId,
          matchId: newGame.id,
          roundNumber: i + 1,
          sideId: r.sideId,
          teamScore: r.teamScore,
          opponentScore: r.opponentScore,
        }));
        try {
          await apiRequest("PUT", `/api/games/${newGame.id}/rounds`, payload);
        } catch (err) {
          // non-fatal; user can edit rounds afterwards
          console.error("Failed to save rounds for new game:", err);
        }
      }
      // Save the inline Match Stats draft (participation, heroes, our stats, opponent stats)
      const hasDraftData =
        Object.keys(newGameMatchStats.our).length > 0 ||
        Object.keys(newGameMatchStats.opp).length > 0;
      if (hasDraftData) {
        try {
          await saveMatchSidesDraft({
            matchId: newGame.id,
            opponentId: newGame.opponentId || event?.opponentId || null,
            draft: newGameMatchStats,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/games", newGame.id, "participation"] });
          queryClient.invalidateQueries({ queryKey: ["/api/games", newGame.id, "player-stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/games", newGame.id, "opponent-player-stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/games", newGame.id, "heroes"] });
        } catch (err: any) {
          console.error("Failed to save match stats for new game:", err);
          setToastMessage(err.message || "Game saved but match stats failed");
          setToastType("error");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "games"] });
      resetNewGameForm();
      setToastMessage("Game added successfully");
      setToastType("success");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to add game");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async (data: { id: string; game: Partial<InsertGame> }) => {
      const response = await apiRequest("PUT", `/api/games/${data.id}`, data.game);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "games"] });
      setEditingGame(null);
      setToastMessage("Game updated successfully");
      setToastType("success");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update game");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/games/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "games"] });
      setToastMessage("Game deleted successfully");
      setToastType("success");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete game");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

  const handleNewGameImageUploaded = (result: { url: string; path: string }) => {
    const imagePath = result.url || result.path;
    setNewGameImageUrl(imagePath);
    setUploadingImageForNewGame(false);
    setToastMessage("Image uploaded successfully");
    setToastType("success");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleEditGameImageUploaded = (result: { url: string; path: string }) => {
    const imagePath = result.url || result.path;
    if (editingGame) {
      setEditingGame({ ...editingGame, imageUrl: imagePath });
    }
    setUploadingImageForGame(null);
    setToastMessage("Image uploaded successfully");
    setToastType("success");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSaveEventDetails = () => {
    updateEventMutation.mutate({
      result: eventResult,
      opponentName: opponentName,
      notes: eventNotes,
    });
  };

  const handleAddGame = () => {
    if (!newGameCode.trim() || !newGameScore.trim()) {
      setToastMessage("Please enter game code and score");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    addGameMutation.mutate({
      eventId: eventId,
      gameCode: newGameCode,
      score: newGameScore,
      imageUrl: newGameImageUrl.trim() || undefined,
      gameModeId: newGameModeId || undefined,
      mapId: newGameMapId || undefined,
      result: newGameResult || undefined,
      link: newGameLink.trim() || undefined,
    });
  };

  const resetNewGameForm = () => {
    setNewGameCode("");
    setNewGameScore("");
    setNewGameImageUrl("");
    setNewGameModeId("");
    setNewGameMapId("");
    setNewGameResult("");
    setNewGameLink("");
    setNewGameRounds([{ sideId: null, teamScore: 0, opponentScore: 0 }]);
    setNewGameMatchStats({ our: {}, opp: {} });
    setMatchStatsDraftInitFor(null);
  };

  // Initialize the inline Match Stats draft with default rows for our roster + opponent players
  // whenever a Game Mode is selected (and re-initialize when the mode changes).
  useEffect(() => {
    if (!newGameModeId) {
      setMatchStatsDraftInitFor(null);
      return;
    }
    const initKey = `${newGameModeId}|${draftOpponentId || ""}|${allPlayers.length}|${draftOpponentPlayers.length}`;
    if (matchStatsDraftInitFor === initKey) return;
    const our: MatchSidesDraft["our"] = {};
    for (const p of allPlayers) {
      our[p.id] = { played: true, heroIds: [], stats: {} };
    }
    const opp: MatchSidesDraft["opp"] = {};
    for (const op of draftOpponentPlayers) {
      opp[op.id] = { played: true, heroIds: [], stats: {} };
    }
    setNewGameMatchStats({ our, opp });
    setMatchStatsDraftInitFor(initKey);
  }, [newGameModeId, draftOpponentId, allPlayers, draftOpponentPlayers, matchStatsDraftInitFor]);

  const toggleMatchStatsExpanded = (gameId: string) => {
    setExpandedMatchStats(prev => ({ ...prev, [gameId]: !prev[gameId] }));
  };

  const saveRoundsMutation = useMutation({
    mutationFn: async (data: { gameId: string; rounds: RoundDraft[]; rosterId: string | null }) => {
      const payload = data.rounds.map((r, i) => ({
        rosterId: data.rosterId,
        matchId: data.gameId,
        roundNumber: i + 1,
        sideId: r.sideId,
        teamScore: r.teamScore,
        opponentScore: r.opponentScore,
      }));
      const res = await apiRequest("PUT", `/api/games/${data.gameId}/rounds`, payload);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", vars.gameId, "rounds"] });
      setEditingRoundsForGame(null);
      setEditingRounds([]);
      setToastMessage("Rounds saved");
      setToastType("success");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to save rounds");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

  const getModeForGame = (gameModeId: string | null): GameMode | undefined => {
    if (!gameModeId) return undefined;
    return gameModes.find(m => m.id === gameModeId);
  };

  const renderRoundEditor = (
    rounds: RoundDraft[],
    setRounds: (r: RoundDraft[]) => void,
    modeId: string,
    keyPrefix: string
  ) => {
    const mode = getModeForGame(modeId);
    const scoreType = (mode as any)?.scoreType || "numeric";
    const maxScore = (mode as any)?.maxScore ?? 13;
    const maxRoundWins = (mode as any)?.maxRoundWins ?? 7;
    const maxRoundsPerGame = Math.max(1, Math.min(40, (mode as any)?.maxRoundsPerGame ?? 15));
    const maxScorePerRoundPerSide = (mode as any)?.maxScorePerRoundPerSide ?? (scoreType === "rounds" ? maxRoundWins : maxScore);
    const maxAllowed = maxScorePerRoundPerSide;

    const updateRound = (idx: number, patch: Partial<RoundDraft>) => {
      const next = rounds.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      setRounds(next);
    };
    const addRound = () => {
      if (rounds.length >= maxRoundsPerGame) return;
      setRounds([...rounds, { sideId: null, teamScore: 0, opponentScore: 0 }]);
    };
    const removeRound = (idx: number) => {
      if (rounds.length <= 1) return;
      setRounds(rounds.filter((_, i) => i !== idx));
    };

    const clamp = (n: number) => Math.max(0, Math.min(maxAllowed, isNaN(n) ? 0 : n));

    return (
      <div className="space-y-3 border border-border rounded-md p-3 bg-muted/30" data-testid={`rounds-editor-${keyPrefix}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Rounds ({rounds.length}/{maxRoundsPerGame})</span>
            {mode && (
              <Badge variant="outline" className="text-xs">
                Max {maxScorePerRoundPerSide} per side / round
              </Badge>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addRound}
            disabled={rounds.length >= maxRoundsPerGame}
            data-testid={`button-add-round-${keyPrefix}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Round
          </Button>
        </div>
        <div className="space-y-2">
          {rounds.map((round, idx) => (
            <div key={idx} className="grid grid-cols-12 items-center gap-2" data-testid={`row-round-${keyPrefix}-${idx}`}>
              <div className="col-span-1 text-xs text-muted-foreground text-center">#{idx + 1}</div>
              <div className="col-span-4">
                <Select
                  value={round.sideId || "none"}
                  onValueChange={(v) => updateRound(idx, { sideId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid={`select-round-side-${keyPrefix}-${idx}`}>
                    <SelectValue placeholder="Side" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No side —</SelectItem>
                    {sidesList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={0}
                  max={maxAllowed}
                  value={round.teamScore}
                  onChange={(e) => updateRound(idx, { teamScore: clamp(parseInt(e.target.value || "0", 10)) })}
                  placeholder="Us"
                  className="h-9 text-sm text-center"
                  data-testid={`input-round-team-${keyPrefix}-${idx}`}
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={0}
                  max={maxAllowed}
                  value={round.opponentScore}
                  onChange={(e) => updateRound(idx, { opponentScore: clamp(parseInt(e.target.value || "0", 10)) })}
                  placeholder="Them"
                  className="h-9 text-sm text-center"
                  data-testid={`input-round-opp-${keyPrefix}-${idx}`}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRound(idx)}
                  disabled={rounds.length <= 1}
                  data-testid={`button-remove-round-${keyPrefix}-${idx}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleUpdateGame = (game: Game) => {
    if (!editingGame) return;
    updateGameMutation.mutate({
      id: game.id,
      game: {
        gameCode: editingGame.gameCode,
        score: editingGame.score,
        imageUrl: editingGame.imageUrl || undefined,
        gameModeId: editingGame.gameModeId || undefined,
        mapId: editingGame.mapId || undefined,
        result: editingGame.result || undefined,
        link: editingGame.link || undefined,
      },
    });
  };

  const getGameResultBadge = (result: string | null) => {
    if (!result) return null;
    switch (result) {
      case "win":
        return <Badge variant="default">W</Badge>;
      case "loss":
        return <Badge variant="destructive">L</Badge>;
      case "draw":
        return <Badge variant="secondary">D</Badge>;
      default:
        return null;
    }
  };

  const handleDeleteGame = (id: string) => {
    if (confirm("Are you sure you want to delete this game?")) {
      deleteGameMutation.mutate(id);
    }
  };

  const getResultBadgeVariant = (result: string) => {
    switch (result) {
      case "win":
        return "default";
      case "loss":
        return "destructive";
      case "draw":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getResultText = (result: string) => {
    switch (result) {
      case "win":
        return "Win";
      case "loss":
        return "Loss";
      case "draw":
        return "Draw";
      case "pending":
        return "Pending";
      default:
        return "Not Set";
    }
  };

  if (eventLoading || gamesLoading) {
    return <EventsSkeleton />;
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg">Event not found</div>
        <Link href={`/${fullSlug}/events`}>
          <Button data-testid="button-back-to-events">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {showToast && (
          <div
            className={`fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
              toastType === "success" ? "bg-green-600" : "bg-red-600"
            } text-white`}
            data-testid="toast-message"
          >
            {toastMessage}
          </div>
        )}

        {viewingImage && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setViewingImage(null)}
          >
            <div className="max-w-4xl max-h-full">
              <img
                src={viewingImage}
                alt="Scoreboard"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link href={`/${fullSlug}/events`}>
            <Button variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-event-title">
              {event.title}
            </CardTitle>
            <div className="flex gap-2 items-center flex-wrap">
              <Badge variant="outline" data-testid="badge-event-type">
                {event.eventType}
              </Badge>
              <Badge variant="outline" data-testid="badge-event-date">
                {format(new Date(event.date), "MMM dd, yyyy")}
              </Badge>
              {event.time && (
                <Badge variant="outline" data-testid="badge-event-time">
                  {event.time}
                </Badge>
              )}
              {event.result && (
                <Badge variant={getResultBadgeVariant(event.result)} data-testid="badge-event-result">
                  {getResultText(event.result)}
                </Badge>
              )}
              {event.result && event.result !== "pending" && (() => {
                const rosterName = `${currentGame?.name || ""} ${currentRoster?.name || ""}`.trim();
                const gameWins = games.filter(g => g.result === "win").length;
                const gameLosses = games.filter(g => g.result === "loss").length;
                const gameScore = games.length > 0 ? `${gameWins}-${gameLosses}` : "";
                const resultText = getResultText(event.result).toUpperCase();
                const dateStr = format(new Date(event.date), "MMMM d, yyyy");
                const eventUrl = `${window.location.origin}/${fullSlug}/events/${event.id}`;
                const shareText = `${rosterName}${event.opponentName ? ` vs ${event.opponentName}` : ""} - ${gameScore} - ${resultText} | ${dateStr}\n${eventUrl}`;
                return <ShareButton text={shareText} />;
              })()}
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-event-description">
                {event.description}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Event Result</label>
              <Select
                value={eventResult}
                onValueChange={(value) => setEventResult(value as EventResult)}
              >
                <SelectTrigger data-testid="select-result">
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="draw">Draw</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Opponent</label>
              {linkedOpponent ? (
                <div className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/40" data-testid="display-linked-opponent">
                  <Badge variant="secondary">Linked</Badge>
                  <span className="text-sm font-medium">{linkedOpponent.name}</span>
                  {linkedOpponent.shortName && <span className="text-xs text-muted-foreground">[{linkedOpponent.shortName}]</span>}
                  <span className="text-xs text-muted-foreground ml-2">Edit on the event itself to change.</span>
                </div>
              ) : (
                <Input
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                  placeholder="Enter opponent team name (or link an opponent via Edit Event)"
                  data-testid="input-opponent"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <Textarea
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                placeholder="Enter any notes about the event..."
                rows={4}
                data-testid="textarea-notes"
              />
            </div>

            <Button
              onClick={handleSaveEventDetails}
              disabled={updateEventMutation.isPending}
              data-testid="button-save-details"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateEventMutation.isPending ? "Saving..." : "Save Details"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Games & Scoreboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <label className="block text-sm font-medium">Add New Game</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  value={newGameCode}
                  onChange={(e) => setNewGameCode(e.target.value)}
                  placeholder="Game Code"
                  data-testid="input-new-game-code"
                />
                {newGameModeId ? (() => {
                  const mode = getModeForGame(newGameModeId);
                  const scoreType = (mode as any)?.scoreType || "numeric";
                  const maxScore = (mode as any)?.maxScore ?? 13;
                  const maxRoundWins = (mode as any)?.maxRoundWins ?? 7;
                  const maxAllowed = scoreType === "rounds" ? maxRoundWins : maxScore;
                  const [usStr, themStr] = (newGameScore || "-").split("-");
                  const us = parseInt(usStr || "0", 10) || 0;
                  const them = parseInt(themStr || "0", 10) || 0;
                  const clamp = (n: number) => Math.max(0, Math.min(maxAllowed, isNaN(n) ? 0 : n));
                  const setScorePair = (u: number, t: number) => setNewGameScore(`${clamp(u)}-${clamp(t)}`);
                  return (
                    <div className="flex items-center gap-2" data-testid="group-new-game-score">
                      <Input
                        type="number"
                        min={0}
                        max={maxAllowed}
                        value={us}
                        onChange={(e) => setScorePair(parseInt(e.target.value || "0", 10), them)}
                        placeholder="Us"
                        className="text-center"
                        data-testid="input-new-game-score-us"
                      />
                      <span className="text-muted-foreground font-medium">-</span>
                      <Input
                        type="number"
                        min={0}
                        max={maxAllowed}
                        value={them}
                        onChange={(e) => setScorePair(us, parseInt(e.target.value || "0", 10))}
                        placeholder="Them"
                        className="text-center"
                        data-testid="input-new-game-score-them"
                      />
                    </div>
                  );
                })() : (
                  <div className="flex items-center px-3 text-xs text-muted-foreground border border-dashed border-border rounded-md" data-testid="text-score-hint">
                    Select a Game Mode to enter the score
                  </div>
                )}
                <Select
                  value={newGameResult}
                  onValueChange={(v) => setNewGameResult(v as "win" | "loss" | "draw")}
                >
                  <SelectTrigger data-testid="select-new-game-result">
                    <SelectValue placeholder="Game Result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="win">Win</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                    <SelectItem value="draw">Draw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  value={newGameModeId}
                  onValueChange={(v) => {
                    setNewGameModeId(v);
                    setNewGameMapId("");
                  }}
                >
                  <SelectTrigger data-testid="select-new-game-mode">
                    <SelectValue placeholder="Game Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameModes.map((mode) => (
                      <SelectItem key={mode.id} value={mode.id}>{mode.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={newGameMapId}
                  onValueChange={setNewGameMapId}
                  disabled={!newGameModeId}
                >
                  <SelectTrigger data-testid="select-new-game-map">
                    <SelectValue placeholder={newGameModeId ? "Select Map" : "Select Mode First"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getMapsByMode(newGameModeId).map((map) => (
                      <SelectItem key={map.id} value={map.id}>{map.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={newGameLink}
                  onChange={(e) => setNewGameLink(e.target.value)}
                  placeholder="VOD Link (optional)"
                  data-testid="input-new-game-link"
                />
              </div>
              {renderRoundEditor(newGameRounds, setNewGameRounds, newGameModeId, "new-game")}
              <div className="flex gap-2 flex-wrap">
                <ObjectUploader
                  accept="image/*"
                  onUploaded={handleNewGameImageUploaded}
                  buttonVariant="outline"
                  buttonSize="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {newGameImageUrl ? "Change Image" : "Upload Scoreboard"}
                </ObjectUploader>
                {newGameImageUrl && (
                  <Badge variant="outline" className="text-xs">
                    Image uploaded
                  </Badge>
                )}
                <Button
                  onClick={handleAddGame}
                  disabled={addGameMutation.isPending}
                  data-testid="button-add-game"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Game
                </Button>
              </div>

              {newGameModeId && (
                <div className="mt-2 border-t border-border pt-3" data-testid="section-match-stats-new-game">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Match Stats — New Game
                      {getModeName(newGameModeId) && (
                        <span className="text-xs text-muted-foreground ml-2">({getModeName(newGameModeId)})</span>
                      )}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Fill in match stats now — they'll be saved together when you click Add Game.
                  </p>
                  <MatchSidesEditor
                    game={null}
                    opponentId={draftOpponentId}
                    ourPlayers={allPlayers}
                    statFields={getStatFieldsByMode(newGameModeId)}
                    heroes={allHeroes}
                    isSaving={addGameMutation.isPending}
                    draft={newGameMatchStats}
                    onDraftChange={setNewGameMatchStats}
                    hideHeader
                    hideSaveButton
                    testIdSuffix="new-game"
                  />
                </div>
              )}
            </div>

            {games.length === 0 ? (
              <div className="text-center text-muted-foreground py-8" data-testid="text-no-games">
                No games recorded
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border rounded-md overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left font-semibold">Game</th>
                      <th className="p-3 text-left font-semibold">Mode / Map</th>
                      <th className="p-3 text-left font-semibold">Score</th>
                      <th className="p-3 text-left font-semibold">Result</th>
                      <th className="p-3 text-left font-semibold">Media</th>
                      <th className="p-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => (
                      <Fragment key={game.id}>
                      <tr className="border-t hover-elevate" data-testid={`row-game-${game.id}`}>
                        <td className="p-3">
                          {editingGame?.id === game.id ? (
                            <Input
                              value={editingGame.gameCode}
                              onChange={(e) =>
                                setEditingGame({ ...editingGame, gameCode: e.target.value })
                              }
                              className="w-24"
                              data-testid={`input-edit-code-${game.id}`}
                            />
                          ) : (
                            <span className="font-medium" data-testid={`text-game-code-${game.id}`}>{game.gameCode}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {editingGame?.id === game.id ? (
                            <div className="space-y-2">
                              <Select
                                value={editingGame.gameModeId || ""}
                                onValueChange={(v) => setEditingGame({ ...editingGame, gameModeId: v, mapId: null })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  {gameModes.map((mode) => (
                                    <SelectItem key={mode.id} value={mode.id}>{mode.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={editingGame.mapId || ""}
                                onValueChange={(v) => setEditingGame({ ...editingGame, mapId: v })}
                                disabled={!editingGame.gameModeId}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Map" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getMapsByMode(editingGame.gameModeId || "").map((map) => (
                                    <SelectItem key={map.id} value={map.id}>{map.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {getModeName(game.gameModeId) && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Gamepad2 className="h-3 w-3 text-muted-foreground" />
                                  <span>{getModeName(game.gameModeId)}</span>
                                </div>
                              )}
                              {getMapName(game.mapId) && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <MapIcon className="h-3 w-3" />
                                  <span>{getMapName(game.mapId)}</span>
                                </div>
                              )}
                              {!getModeName(game.gameModeId) && !getMapName(game.mapId) && (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {editingGame?.id === game.id ? (
                            <Input
                              value={editingGame.score}
                              onChange={(e) =>
                                setEditingGame({ ...editingGame, score: e.target.value })
                              }
                              className="w-20"
                              data-testid={`input-edit-score-${game.id}`}
                            />
                          ) : (
                            <span data-testid={`text-game-score-${game.id}`}>{game.score}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {editingGame?.id === game.id ? (
                            <Select
                              value={editingGame.result || ""}
                              onValueChange={(v) => setEditingGame({ ...editingGame, result: v })}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue placeholder="Result" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="win">Win</SelectItem>
                                <SelectItem value="loss">Loss</SelectItem>
                                <SelectItem value="draw">Draw</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            getGameResultBadge(game.result) || <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {editingGame?.id === game.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editingGame.link || ""}
                                  onChange={(e) => setEditingGame({ ...editingGame, link: e.target.value })}
                                  placeholder="VOD Link"
                                  className="w-32"
                                />
                                <div className="flex gap-2 flex-wrap">
                                  <ObjectUploader
                                    accept="image/*"
                                    onUploaded={handleEditGameImageUploaded}
                                    buttonVariant="outline"
                                    buttonSize="sm"
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {editingGame.imageUrl ? "Change" : "Upload"}
                                  </ObjectUploader>
                                </div>
                              </div>
                            ) : (
                              <>
                                {game.imageUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setViewingImage(game.imageUrl || null)}
                                    data-testid={`button-view-image-${game.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                {game.link && (
                                  <a href={game.link.match(/^https?:\/\//) ? game.link : `https://${game.link}`} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" data-testid={`button-vod-link-${game.id}`}>
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </a>
                                )}
                                {!game.imageUrl && !game.link && (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 flex-wrap">
                            {editingGame?.id === game.id ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateGame(game)}
                                  disabled={updateGameMutation.isPending}
                                  data-testid={`button-save-game-${game.id}`}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingGame(null)}
                                  data-testid={`button-cancel-edit-${game.id}`}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingGame(game)}
                                  data-testid={`button-edit-game-${game.id}`}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant={editingRoundsForGame === game.id ? "default" : "outline"}
                                  onClick={() => {
                                    if (editingRoundsForGame === game.id) {
                                      setEditingRoundsForGame(null);
                                      setEditingRounds([]);
                                    } else {
                                      setEditingRoundsForGame(game.id);
                                    }
                                  }}
                                  data-testid={`button-rounds-game-${game.id}`}
                                  title="Rounds"
                                >
                                  Rounds
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteGame(game.id)}
                                  disabled={deleteGameMutation.isPending}
                                  data-testid={`button-delete-game-${game.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {(() => {
                        const isHbsExpanded = !!expandedHeroBan[game.id];
                        return (
                          <tr className="border-t border-border bg-muted/10" data-testid={`row-hero-ban-${game.id}`}>
                            <td colSpan={6} className="p-3">
                              <button
                                type="button"
                                onClick={() => toggleHeroBanExpanded(game.id)}
                                aria-expanded={isHbsExpanded}
                                className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover-elevate text-left"
                                data-testid={`button-toggle-hero-ban-${game.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Ban className="h-4 w-4 text-primary" />
                                  <h3 className="text-sm font-semibold">Hero Ban — {game.gameCode}</h3>
                                </div>
                                {isHbsExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" data-testid={`icon-chevron-up-hbs-${game.id}`} />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" data-testid={`icon-chevron-down-hbs-${game.id}`} />
                                )}
                              </button>
                              {isHbsExpanded && (
                                <div className="mt-2" data-testid={`content-hero-ban-${game.id}`}>
                                  <GameHeroBanPanel
                                    game={game}
                                    heroes={allHeroes}
                                    canEdit={true}
                                    onSaved={onPanelSavedToast}
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const isMvsExpanded = !!expandedMapVeto[game.id];
                        return (
                          <tr className="border-t border-border bg-muted/10" data-testid={`row-map-veto-${game.id}`}>
                            <td colSpan={6} className="p-3">
                              <button
                                type="button"
                                onClick={() => toggleMapVetoExpanded(game.id)}
                                aria-expanded={isMvsExpanded}
                                className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover-elevate text-left"
                                data-testid={`button-toggle-map-veto-${game.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <MapIcon className="h-4 w-4 text-primary" />
                                  <h3 className="text-sm font-semibold">Map Veto — {game.gameCode}</h3>
                                </div>
                                {isMvsExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" data-testid={`icon-chevron-up-mvs-${game.id}`} />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" data-testid={`icon-chevron-down-mvs-${game.id}`} />
                                )}
                              </button>
                              {isMvsExpanded && (
                                <div className="mt-2" data-testid={`content-map-veto-${game.id}`}>
                                  <GameMapVetoPanel
                                    game={game}
                                    maps={allMaps}
                                    gameModes={gameModes}
                                    sides={sidesList}
                                    canEdit={true}
                                    onSaved={onPanelSavedToast}
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })()}
                      {game.gameModeId && (() => {
                        const isExpanded = !!expandedMatchStats[game.id];
                        return (
                          <tr className="border-t border-border bg-muted/20" data-testid={`row-match-stats-${game.id}`}>
                            <td colSpan={6} className="p-3">
                              <div data-testid={`section-match-stats-${game.id}`}>
                                <button
                                  type="button"
                                  onClick={() => toggleMatchStatsExpanded(game.id)}
                                  aria-expanded={isExpanded}
                                  className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover-elevate text-left"
                                  data-testid={`button-toggle-match-stats-${game.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-semibold">
                                      Match Stats — {game.gameCode}
                                      {getModeName(game.gameModeId) && (
                                        <span className="text-xs text-muted-foreground ml-2">({getModeName(game.gameModeId)})</span>
                                      )}
                                    </h3>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" data-testid={`icon-chevron-up-${game.id}`} />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" data-testid={`icon-chevron-down-${game.id}`} />
                                  )}
                                </button>
                                {isExpanded && (
                                  <div className="mt-2" data-testid={`content-match-stats-${game.id}`}>
                                    <MatchSidesEditor
                                      game={game}
                                      opponentId={game.opponentId || event?.opponentId || null}
                                      ourPlayers={allPlayers}
                                      statFields={getStatFieldsByMode(game.gameModeId)}
                                      heroes={allHeroes}
                                      isSaving={false}
                                      hideHeader
                                      onSavedToast={(msg, type) => {
                                        setToastMessage(msg);
                                        setToastType(type);
                                        setShowToast(true);
                                        setTimeout(() => setShowToast(false), 3000);
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

                {editingRoundsForGame && (() => {
                  const game = games.find(g => g.id === editingRoundsForGame);
                  if (!game) return null;
                  return (
                    <Card className="mt-3">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">Rounds — {game.gameCode}</CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditingRoundsForGame(null); setEditingRounds([]); }}
                              data-testid={`button-cancel-rounds-${game.id}`}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveRoundsMutation.mutate({ gameId: game.id, rounds: editingRounds, rosterId: game.rosterId })}
                              disabled={saveRoundsMutation.isPending}
                              data-testid={`button-save-rounds-${game.id}`}
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {saveRoundsMutation.isPending ? "Saving..." : "Save Rounds"}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {renderRoundEditor(editingRounds, setEditingRounds, game.gameModeId || "", `edit-${game.id}`)}
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(allPlayers.length === 0 && allStaff.length === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-4">No players or staff to track attendance for.</p>
            ) : (
              <div className="space-y-4">
                {allPlayers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Players</h4>
                    <div className="divide-y divide-border rounded-md border">
                      {allPlayers.map((player) => {
                        const status = getPlayerAttendanceStatus(player.id);
                        return (
                          <div key={player.id} className="flex items-center justify-between p-3" data-testid={`attendance-player-${player.id}`}>
                            <span className="font-medium text-sm">{player.name}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={status === "attended" ? "default" : "outline"}
                                onClick={() => updateAttendanceMutation.mutate({ playerId: player.id, status: "attended" })}
                                disabled={updateAttendanceMutation.isPending}
                                data-testid={`button-attendance-present-${player.id}`}
                              >
                                <UserCheck className="h-3 w-3 mr-1" />
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "late" ? "default" : "outline"}
                                onClick={() => updateAttendanceMutation.mutate({ playerId: player.id, status: "late" })}
                                disabled={updateAttendanceMutation.isPending}
                                data-testid={`button-attendance-late-${player.id}`}
                              >
                                <ClockIcon className="h-3 w-3 mr-1" />
                                Late
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "absent" ? "destructive" : "outline"}
                                onClick={() => updateAttendanceMutation.mutate({ playerId: player.id, status: "absent" })}
                                disabled={updateAttendanceMutation.isPending}
                                data-testid={`button-attendance-absent-${player.id}`}
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                Absent
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {allStaff.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Staff</h4>
                    <div className="divide-y divide-border rounded-md border">
                      {allStaff.map((member) => {
                        const status = getStaffAttendanceStatus(member.id);
                        return (
                          <div key={member.id} className="flex items-center justify-between p-3" data-testid={`attendance-staff-${member.id}`}>
                            <span className="font-medium text-sm">{member.name}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={status === "attended" ? "default" : "outline"}
                                onClick={() => updateAttendanceMutation.mutate({ staffId: member.id, status: "attended" })}
                                disabled={updateAttendanceMutation.isPending}
                                data-testid={`button-attendance-present-staff-${member.id}`}
                              >
                                <UserCheck className="h-3 w-3 mr-1" />
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "late" ? "default" : "outline"}
                                onClick={() => updateAttendanceMutation.mutate({ staffId: member.id, status: "late" })}
                                disabled={updateAttendanceMutation.isPending}
                                data-testid={`button-attendance-late-staff-${member.id}`}
                              >
                                <ClockIcon className="h-3 w-3 mr-1" />
                                Late
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "absent" ? "destructive" : "outline"}
                                onClick={() => updateAttendanceMutation.mutate({ staffId: member.id, status: "absent" })}
                                disabled={updateAttendanceMutation.isPending}
                                data-testid={`button-attendance-absent-staff-${member.id}`}
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                Absent
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
