import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EventsSkeleton } from "@/components/PageSkeleton";
import { useGame } from "@/hooks/use-game";
import type { Event, EventResult, Game, InsertGame, GameMode, Map as MapType, Player, StatField, PlayerGameStat, Attendance, Staff } from "@shared/schema";
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
import { ArrowLeft, Plus, Trash2, Save, Upload, Eye, ExternalLink, Gamepad2, Map as MapIcon, BarChart3, UserCheck, Clock as ClockIcon, UserX } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";

function GameStatsEditor({ game, players, statFields, onSave, isSaving }: {
  game: Game;
  players: Player[];
  statFields: StatField[];
  onSave: (stats: { gameId: string; playerId: string; statFieldId: string; value: string }[]) => void;
  isSaving: boolean;
}) {
  const [localStats, setLocalStats] = useState<Record<string, Record<string, string>>>({});
  const [initializedForGameId, setInitializedForGameId] = useState<string | null>(null);

  const { data: existingStats = [], isSuccess } = useQuery<PlayerGameStat[]>({
    queryKey: ["/api/games", game.id, "player-stats"],
    queryFn: async () => {
      const response = await fetch(`/api/games/${game.id}/player-stats`);
      if (!response.ok) throw new Error("Failed to fetch player stats");
      return response.json();
    },
  });

  useEffect(() => {
    if (isSuccess && initializedForGameId !== game.id) {
      const statsMap: Record<string, Record<string, string>> = {};
      for (const stat of existingStats) {
        if (!statsMap[stat.playerId]) statsMap[stat.playerId] = {};
        statsMap[stat.playerId][stat.statFieldId] = stat.value;
      }
      setLocalStats(statsMap);
      setInitializedForGameId(game.id);
    }
  }, [existingStats, isSuccess, game.id, initializedForGameId]);

  const handleSave = () => {
    const stats: { gameId: string; playerId: string; statFieldId: string; value: string }[] = [];
    for (const playerId of Object.keys(localStats)) {
      for (const fieldId of Object.keys(localStats[playerId])) {
        const val = localStats[playerId][fieldId];
        if (val && val.trim() !== "") {
          stats.push({ gameId: game.id, playerId, statFieldId: fieldId, value: val });
        }
      }
    }
    onSave(stats);
  };

  if (statFields.length === 0 || players.length === 0) return null;

  return (
    <Card className="mt-3">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Player Stats - {game.gameCode}</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid={`button-save-stats-${game.id}`}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Stats"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left font-semibold text-sm">Player</th>
                {statFields.map((field) => (
                  <th key={field.id} className="p-2 text-center font-semibold text-sm">
                    {field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-t border-border">
                  <td className="p-2 text-sm font-medium whitespace-nowrap">
                    {player.name}
                  </td>
                  {statFields.map((field) => (
                    <td key={field.id} className="p-2">
                      <Input
                        value={localStats[player.id]?.[field.id] || ""}
                        onChange={(e) => {
                          const updated = { ...localStats };
                          if (!updated[player.id]) updated[player.id] = {};
                          updated[player.id] = { ...updated[player.id], [field.id]: e.target.value };
                          setLocalStats(updated);
                        }}
                        className="w-20 text-center text-sm"
                        placeholder="0"
                        data-testid={`edit-stat-${game.id}-${player.id}-${field.id}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventDetails() {
  const [, params] = useRoute("/:slug/events/:id");
  const eventId = params?.id || "";
  const { fullSlug, currentGame, currentRoster } = useGame();

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

  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [uploadingImageForGame, setUploadingImageForGame] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

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
    queryKey: ["/api/game-modes"],
  });

  const { data: allMaps = [] } = useQuery<MapType[]>({
    queryKey: ["/api/maps"],
  });

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const { data: allStatFields = [] } = useQuery<StatField[]>({
    queryKey: ["/api/stat-fields"],
  });

  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
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

  const [newGamePlayerStats, setNewGamePlayerStats] = useState<Record<string, Record<string, string>>>({});
  const [editGamePlayerStats, setEditGamePlayerStats] = useState<Record<string, Record<string, string>>>({});
  const [expandedGameStats, setExpandedGameStats] = useState<string | null>(null);

  const getStatFieldsByMode = (modeId: string) => {
    return allStatFields.filter(sf => sf.gameModeId === modeId);
  };

  const savePlayerStatsMutation = useMutation({
    mutationFn: async (data: { gameId: string; stats: { gameId: string; playerId: string; statFieldId: string; value: string }[] }) => {
      const response = await apiRequest("POST", `/api/games/${data.gameId}/player-stats`, { stats: data.stats });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", variables.gameId, "player-stats"] });
      setToastMessage("Player stats saved");
      setToastType("success");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to save player stats");
      setToastType("error");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
  });

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
      const modeStatFields = newGameModeId ? getStatFieldsByMode(newGameModeId) : [];
      if (modeStatFields.length > 0 && Object.keys(newGamePlayerStats).length > 0) {
        const stats: { gameId: string; playerId: string; statFieldId: string; value: string }[] = [];
        for (const playerId of Object.keys(newGamePlayerStats)) {
          for (const fieldId of Object.keys(newGamePlayerStats[playerId])) {
            const val = newGamePlayerStats[playerId][fieldId];
            if (val && val.trim() !== "") {
              stats.push({ gameId: newGame.id, playerId, statFieldId: fieldId, value: val });
            }
          }
        }
        if (stats.length > 0) {
          await savePlayerStatsMutation.mutateAsync({ gameId: newGame.id, stats });
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
    setNewGamePlayerStats({});
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

  const renderPlayerStatsTable = (
    modeId: string,
    statsState: Record<string, Record<string, string>>,
    setStatsState: (state: Record<string, Record<string, string>>) => void,
    testIdPrefix: string
  ) => {
    const modeStatFields = getStatFieldsByMode(modeId);
    if (modeStatFields.length === 0 || allPlayers.length === 0) return null;

    return (
      <div className="border border-border rounded-lg overflow-x-auto" data-testid={`${testIdPrefix}-stats-table`}>
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/50">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Player Stats</span>
          <span className="text-xs text-muted-foreground">({modeStatFields.length} fields)</span>
        </div>
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left font-semibold text-sm">Player</th>
              {modeStatFields.map((field) => (
                <th key={field.id} className="p-2 text-center font-semibold text-sm" data-testid={`th-stat-${field.id}`}>
                  {field.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPlayers.map((player) => (
              <tr key={player.id} className="border-t border-border">
                <td className="p-2 text-sm font-medium whitespace-nowrap" data-testid={`${testIdPrefix}-player-name-${player.id}`}>
                  {player.name}
                </td>
                {modeStatFields.map((field) => (
                  <td key={field.id} className="p-2">
                    <Input
                      value={statsState[player.id]?.[field.id] || ""}
                      onChange={(e) => {
                        const updated = { ...statsState };
                        if (!updated[player.id]) updated[player.id] = {};
                        updated[player.id] = { ...updated[player.id], [field.id]: e.target.value };
                        setStatsState(updated);
                      }}
                      className="w-20 text-center text-sm"
                      placeholder="0"
                      data-testid={`${testIdPrefix}-stat-${player.id}-${field.id}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
                const gameScore = games.length > 0 ? `${gameWins}-${gameLosses}` : (event.score || "");
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
              <label className="block text-sm font-medium mb-2">Opponent Name</label>
              <Input
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="Enter opponent team name"
                data-testid="input-opponent"
              />
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
                <Input
                  value={newGameScore}
                  onChange={(e) => setNewGameScore(e.target.value)}
                  placeholder="Score (e.g., 2-1)"
                  data-testid="input-new-game-score"
                />
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
              {newGameModeId && renderPlayerStatsTable(
                newGameModeId,
                newGamePlayerStats,
                setNewGamePlayerStats,
                "new-game"
              )}
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
                      <tr key={game.id} className="border-t hover-elevate" data-testid={`row-game-${game.id}`}>
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
                                {game.gameModeId && getStatFieldsByMode(game.gameModeId).length > 0 && (
                                  <Button
                                    size="sm"
                                    variant={expandedGameStats === game.id ? "default" : "outline"}
                                    onClick={() => setExpandedGameStats(expandedGameStats === game.id ? null : game.id)}
                                    data-testid={`button-stats-game-${game.id}`}
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </Button>
                                )}
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
                    ))}
                  </tbody>
                </table>
              </div>

                {expandedGameStats && (() => {
                  const game = games.find(g => g.id === expandedGameStats);
                  if (!game || !game.gameModeId) return null;
                  return (
                    <GameStatsEditor
                      game={game}
                      players={allPlayers}
                      statFields={getStatFieldsByMode(game.gameModeId)}
                      onSave={(stats) => savePlayerStatsMutation.mutate({ gameId: game.id, stats })}
                      isSaving={savePlayerStatsMutation.isPending}
                    />
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
