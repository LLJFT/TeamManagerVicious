import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Gamepad2, Map as MapIcon, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import type { GameMode, Map as MapType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SimpleToast } from "@/components/SimpleToast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const gameModeFormSchema = z.object({
  name: z.string().min(1, "Game mode name is required"),
});

const mapFormSchema = z.object({
  name: z.string().min(1, "Map name is required"),
  gameModeId: z.string().min(1, "Game mode is required"),
});

type GameModeFormData = z.infer<typeof gameModeFormSchema>;
type MapFormData = z.infer<typeof mapFormSchema>;

export default function Settings() {
  const [showGameModeDialog, setShowGameModeDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [editingGameMode, setEditingGameMode] = useState<GameMode | undefined>();
  const [editingMap, setEditingMap] = useState<MapType | undefined>();
  const [expandedModes, setExpandedModes] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: gameModes = [], isLoading: modesLoading } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes"],
  });

  const { data: maps = [], isLoading: mapsLoading } = useQuery<MapType[]>({
    queryKey: ["/api/maps"],
  });

  const gameModeForm = useForm<GameModeFormData>({
    resolver: zodResolver(gameModeFormSchema),
    defaultValues: { name: "" },
  });

  const mapForm = useForm<MapFormData>({
    resolver: zodResolver(mapFormSchema),
    defaultValues: { name: "", gameModeId: "" },
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

  const resetToDefaultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reset-defaults");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
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
    mapForm.reset({ name: "", gameModeId: gameModeId || "" });
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

  const toggleModeExpansion = (modeId: string) => {
    setExpandedModes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(modeId)) {
        newSet.delete(modeId);
      } else {
        newSet.add(modeId);
      }
      return newSet;
    });
  };

  const getMapsByMode = (modeId: string) => {
    return maps.filter(map => map.gameModeId === modeId);
  };

  if (modesLoading || mapsLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-5xl">
        {showToast && (
          <SimpleToast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Manage game modes and maps</p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <CardTitle>Game Modes & Maps</CardTitle>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleAddGameMode} className="gap-2" data-testid="button-add-game-mode">
                <Plus className="h-4 w-4" />
                Add Game Mode
              </Button>
              <Button onClick={() => handleAddMap()} variant="outline" className="gap-2" data-testid="button-add-map">
                <Plus className="h-4 w-4" />
                Add Map
              </Button>
              <Button
                onClick={handleResetToDefaults}
                variant="secondary"
                className="gap-2"
                disabled={resetToDefaultsMutation.isPending}
                data-testid="button-reset-defaults"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to Marvel Rivals Defaults
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {gameModes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No game modes created yet.</p>
                <p className="text-sm">Click "Add Game Mode" to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gameModes.map((mode) => {
                  const modeMaps = getMapsByMode(mode.id);
                  const isExpanded = expandedModes.has(mode.id);
                  
                  return (
                    <Collapsible key={mode.id} open={isExpanded} onOpenChange={() => toggleModeExpansion(mode.id)}>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-card hover-elevate">
                          <div className="flex items-center gap-3">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-expand-mode-${mode.id}`}>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Gamepad2 className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-foreground" data-testid={`text-mode-name-${mode.id}`}>
                                {mode.name}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {modeMaps.length} {modeMaps.length === 1 ? "map" : "maps"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAddMap(mode.id)}
                              data-testid={`button-add-map-to-${mode.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditGameMode(mode)}
                              data-testid={`button-edit-mode-${mode.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteGameMode(mode.id)}
                              data-testid={`button-delete-mode-${mode.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        <CollapsibleContent>
                          <div className="border-t border-border">
                            {modeMaps.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                No maps for this game mode. Click + to add one.
                              </div>
                            ) : (
                              <div className="divide-y divide-border">
                                {modeMaps.map((map) => (
                                  <div
                                    key={map.id}
                                    className="flex items-center justify-between p-3 pl-14 hover-elevate"
                                    data-testid={`row-map-${map.id}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <MapIcon className="h-4 w-4 text-muted-foreground" />
                                      <span data-testid={`text-map-name-${map.id}`}>{map.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditMap(map)}
                                        data-testid={`button-edit-map-${map.id}`}
                                      >
                                        <Pencil className="h-4 w-4" />
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
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showGameModeDialog} onOpenChange={setShowGameModeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGameMode ? "Edit Game Mode" : "Add Game Mode"}</DialogTitle>
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
                          placeholder="e.g., Shin-Shibuya, Tokyo 2099"
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
      </div>
    </div>
  );
}
