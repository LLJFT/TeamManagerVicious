import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Gamepad2, Map as MapIcon, RotateCcw, ChevronRight, Calendar } from "lucide-react";
import type { GameMode, Map as MapType, Season } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SimpleToast } from "@/components/SimpleToast";

const gameModeFormSchema = z.object({
  name: z.string().min(1, "Game mode name is required"),
});

const mapFormSchema = z.object({
  name: z.string().min(1, "Map name is required"),
  gameModeId: z.string().min(1, "Game mode is required"),
});

const seasonFormSchema = z.object({
  name: z.string().min(1, "Season name is required"),
  description: z.string().optional(),
});

type GameModeFormData = z.infer<typeof gameModeFormSchema>;
type MapFormData = z.infer<typeof mapFormSchema>;
type SeasonFormData = z.infer<typeof seasonFormSchema>;

export default function Settings() {
  const [showGameModeDialog, setShowGameModeDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);
  const [editingGameMode, setEditingGameMode] = useState<GameMode | undefined>();
  const [editingMap, setEditingMap] = useState<MapType | undefined>();
  const [editingSeason, setEditingSeason] = useState<Season | undefined>();
  const [selectedModeForMaps, setSelectedModeForMaps] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: gameModes = [], isLoading: modesLoading } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes"],
  });

  const { data: maps = [], isLoading: mapsLoading } = useQuery<MapType[]>({
    queryKey: ["/api/maps"],
  });

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const gameModeForm = useForm<GameModeFormData>({
    resolver: zodResolver(gameModeFormSchema),
    defaultValues: { name: "" },
  });

  const mapForm = useForm<MapFormData>({
    resolver: zodResolver(mapFormSchema),
    defaultValues: { name: "", gameModeId: "" },
  });

  const seasonForm = useForm<SeasonFormData>({
    resolver: zodResolver(seasonFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const createGameModeMutation = useMutation({
    mutationFn: async (data: GameModeFormData) => {
      const response = await apiRequest("POST", "/api/game-modes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      setShowGameModeDialog(false);
      setEditingGameMode(undefined);
      gameModeForm.reset();
      setToastMessage("Game mode created successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to create game mode");
      setToastType("error");
      setShowToast(true);
    },
  });

  const updateGameModeMutation = useMutation({
    mutationFn: async (data: { id: string; gameMode: Partial<GameModeFormData> }) => {
      const response = await apiRequest("PUT", `/api/game-modes/${data.id}`, data.gameMode);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      setShowGameModeDialog(false);
      setEditingGameMode(undefined);
      gameModeForm.reset();
      setToastMessage("Game mode updated successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update game mode");
      setToastType("error");
      setShowToast(true);
    },
  });

  const deleteGameModeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/game-modes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      if (selectedModeForMaps) {
        const remainingModes = gameModes.filter(m => m.id !== selectedModeForMaps);
        if (remainingModes.length > 0) {
          setSelectedModeForMaps(remainingModes[0].id);
        } else {
          setSelectedModeForMaps(null);
        }
      }
      setToastMessage("Game mode deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete game mode");
      setToastType("error");
      setShowToast(true);
    },
  });

  const createMapMutation = useMutation({
    mutationFn: async (data: MapFormData) => {
      const response = await apiRequest("POST", "/api/maps", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setShowMapDialog(false);
      setEditingMap(undefined);
      mapForm.reset();
      setToastMessage("Map created successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to create map");
      setToastType("error");
      setShowToast(true);
    },
  });

  const updateMapMutation = useMutation({
    mutationFn: async (data: { id: string; map: Partial<MapFormData> }) => {
      const response = await apiRequest("PUT", `/api/maps/${data.id}`, data.map);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setShowMapDialog(false);
      setEditingMap(undefined);
      mapForm.reset();
      setToastMessage("Map updated successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update map");
      setToastType("error");
      setShowToast(true);
    },
  });

  const deleteMapMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/maps/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setToastMessage("Map deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete map");
      setToastType("error");
      setShowToast(true);
    },
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (data: SeasonFormData) => {
      const response = await apiRequest("POST", "/api/seasons", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setShowSeasonDialog(false);
      setEditingSeason(undefined);
      seasonForm.reset();
      setToastMessage("Season created successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to create season");
      setToastType("error");
      setShowToast(true);
    },
  });

  const updateSeasonMutation = useMutation({
    mutationFn: async (data: { id: string; season: Partial<SeasonFormData> }) => {
      const response = await apiRequest("PUT", `/api/seasons/${data.id}`, data.season);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setShowSeasonDialog(false);
      setEditingSeason(undefined);
      seasonForm.reset();
      setToastMessage("Season updated successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update season");
      setToastType("error");
      setShowToast(true);
    },
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/seasons/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setToastMessage("Season deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete season");
      setToastType("error");
      setShowToast(true);
    },
  });

  const resetToDefaultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reset-defaults");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setSelectedModeForMaps(null);
      setToastMessage("Reset to Marvel Rivals defaults successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to reset to defaults");
      setToastType("error");
      setShowToast(true);
    },
  });

  const handleResetToDefaults = () => {
    if (confirm("This will delete all existing game modes and maps and replace them with Marvel Rivals defaults. Are you sure?")) {
      resetToDefaultsMutation.mutate();
    }
  };

  const handleAddGameMode = () => {
    setEditingGameMode(undefined);
    gameModeForm.reset({ name: "" });
    setShowGameModeDialog(true);
  };

  const handleEditGameMode = (mode: GameMode) => {
    setEditingGameMode(mode);
    gameModeForm.reset({ name: mode.name });
    setShowGameModeDialog(true);
  };

  const handleDeleteGameMode = (id: string) => {
    if (confirm("Are you sure? This will delete all maps associated with this game mode.")) {
      deleteGameModeMutation.mutate(id);
    }
  };

  const handleGameModeSubmit = (data: GameModeFormData) => {
    if (editingGameMode) {
      updateGameModeMutation.mutate({ id: editingGameMode.id, gameMode: data });
    } else {
      createGameModeMutation.mutate(data);
    }
  };

  const handleAddMap = (gameModeId?: string) => {
    setEditingMap(undefined);
    mapForm.reset({ name: "", gameModeId: gameModeId || selectedModeForMaps || "" });
    setShowMapDialog(true);
  };

  const handleEditMap = (map: MapType) => {
    setEditingMap(map);
    mapForm.reset({ name: map.name, gameModeId: map.gameModeId });
    setShowMapDialog(true);
  };

  const handleDeleteMap = (id: string) => {
    if (confirm("Are you sure you want to delete this map?")) {
      deleteMapMutation.mutate(id);
    }
  };

  const handleMapSubmit = (data: MapFormData) => {
    if (editingMap) {
      updateMapMutation.mutate({ id: editingMap.id, map: data });
    } else {
      createMapMutation.mutate(data);
    }
  };

  const handleAddSeason = () => {
    setEditingSeason(undefined);
    seasonForm.reset({ name: "", description: "" });
    setShowSeasonDialog(true);
  };

  const handleEditSeason = (season: Season) => {
    setEditingSeason(season);
    seasonForm.reset({ name: season.name, description: season.description || "" });
    setShowSeasonDialog(true);
  };

  const handleDeleteSeason = (id: string) => {
    if (confirm("Are you sure you want to delete this season? Events assigned to this season will still exist but won't be linked to any season.")) {
      deleteSeasonMutation.mutate(id);
    }
  };

  const handleSeasonSubmit = (data: SeasonFormData) => {
    if (editingSeason) {
      updateSeasonMutation.mutate({ id: editingSeason.id, season: data });
    } else {
      createSeasonMutation.mutate(data);
    }
  };

  const getMapsByMode = (modeId: string) => {
    return maps.filter(map => map.gameModeId === modeId);
  };

  const selectedMode = gameModes.find(m => m.id === selectedModeForMaps);
  const selectedModeMaps = selectedModeForMaps ? getMapsByMode(selectedModeForMaps) : [];

  if (modesLoading || mapsLoading || seasonsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {showToast && (
          <SimpleToast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Configure game modes, maps, and seasons</p>
            </div>
          </div>
          <Button
            onClick={handleResetToDefaults}
            variant="outline"
            className="gap-2"
            disabled={resetToDefaultsMutation.isPending}
            data-testid="button-reset-defaults"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Marvel Rivals Defaults
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="h-fit">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Game Modes</CardTitle>
                    <CardDescription>{gameModes.length} configured</CardDescription>
                  </div>
                </div>
                <Button onClick={handleAddGameMode} size="sm" className="gap-2" data-testid="button-add-game-mode">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {gameModes.length === 0 ? (
                <div className="p-8 text-center">
                  <Gamepad2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No game modes configured</p>
                  <p className="text-muted-foreground text-xs mt-1">Click "Add" to create your first game mode</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {gameModes.map((mode) => {
                    const modeMaps = getMapsByMode(mode.id);
                    const isSelected = selectedModeForMaps === mode.id;
                    
                    return (
                      <div
                        key={mode.id}
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedModeForMaps(mode.id)}
                        data-testid={`row-mode-${mode.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground" data-testid={`text-mode-name-${mode.id}`}>
                              {mode.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {modeMaps.length} {modeMaps.length === 1 ? "map" : "maps"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditGameMode(mode);
                            }}
                            data-testid={`button-edit-mode-${mode.id}`}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGameMode(mode.id);
                            }}
                            data-testid={`button-delete-mode-${mode.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <MapIcon className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {selectedMode ? `${selectedMode.name} Maps` : "Maps"}
                    </CardTitle>
                    <CardDescription>
                      {selectedMode 
                        ? `${selectedModeMaps.length} maps in this mode`
                        : "Select a game mode to view maps"
                      }
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  onClick={() => handleAddMap()} 
                  size="sm" 
                  className="gap-2"
                  disabled={!selectedModeForMaps}
                  data-testid="button-add-map"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedModeForMaps ? (
                <div className="p-8 text-center">
                  <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Select a game mode</p>
                  <p className="text-muted-foreground text-xs mt-1">Click on a game mode to view its maps</p>
                </div>
              ) : selectedModeMaps.length === 0 ? (
                <div className="p-8 text-center">
                  <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No maps in this mode</p>
                  <p className="text-muted-foreground text-xs mt-1">Click "Add" to create a map</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {selectedModeMaps.map((map) => (
                    <div
                      key={map.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      data-testid={`row-map-${map.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <MapIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground" data-testid={`text-map-name-${map.id}`}>
                          {map.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditMap(map)}
                          data-testid={`button-edit-map-${map.id}`}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMap(map.id)}
                          data-testid={`button-delete-map-${map.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Calendar className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Seasons</CardTitle>
                    <CardDescription>{seasons.length} configured</CardDescription>
                  </div>
                </div>
                <Button onClick={handleAddSeason} size="sm" className="gap-2" data-testid="button-add-season">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {seasons.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No seasons configured</p>
                  <p className="text-muted-foreground text-xs mt-1">Click "Add" to create your first season</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {seasons.map((season) => (
                    <div
                      key={season.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      data-testid={`row-season-${season.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-amber-500" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground" data-testid={`text-season-name-${season.id}`}>
                            {season.name}
                          </span>
                          {season.description && (
                            <span className="text-xs text-muted-foreground">
                              {season.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSeason(season)}
                          data-testid={`button-edit-season-${season.id}`}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSeason(season.id)}
                          data-testid={`button-delete-season-${season.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={showGameModeDialog} onOpenChange={setShowGameModeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGameMode ? "Edit Game Mode" : "Add Game Mode"}</DialogTitle>
              <DialogDescription>
                {editingGameMode 
                  ? "Update the name of this game mode."
                  : "Create a new game mode for tracking statistics."
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...gameModeForm}>
              <form onSubmit={gameModeForm.handleSubmit(handleGameModeSubmit)} className="space-y-4">
                <FormField
                  control={gameModeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Game Mode Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Convergence, Domination, Convoy"
                          data-testid="input-game-mode-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowGameModeDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createGameModeMutation.isPending || updateGameModeMutation.isPending}
                    data-testid="button-save-game-mode"
                  >
                    {editingGameMode ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMap ? "Edit Map" : "Add Map"}</DialogTitle>
              <DialogDescription>
                {editingMap 
                  ? "Update the map details."
                  : "Add a new map to track statistics."
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...mapForm}>
              <form onSubmit={mapForm.handleSubmit(handleMapSubmit)} className="space-y-4">
                <FormField
                  control={mapForm.control}
                  name="gameModeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Game Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-game-mode">
                            <SelectValue placeholder="Select game mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {gameModes.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={mapForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Map Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Central Park, Krakoa"
                          data-testid="input-map-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowMapDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMapMutation.isPending || updateMapMutation.isPending}
                    data-testid="button-save-map"
                  >
                    {editingMap ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showSeasonDialog} onOpenChange={setShowSeasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSeason ? "Edit Season" : "Add Season"}</DialogTitle>
              <DialogDescription>
                {editingSeason 
                  ? "Update the season details."
                  : "Create a new season label to track events by season."
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...seasonForm}>
              <form onSubmit={seasonForm.handleSubmit(handleSeasonSubmit)} className="space-y-4">
                <FormField
                  control={seasonForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Season 5.0, Season 5.5, Season 6.0"
                          data-testid="input-season-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={seasonForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Dec 2024 - Jan 2025"
                          data-testid="input-season-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowSeasonDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createSeasonMutation.isPending || updateSeasonMutation.isPending}
                    data-testid="button-save-season"
                  >
                    {editingSeason ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
