import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Save, Copy, Upload, ImageIcon, X, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import { MediaLibraryBrowser } from "@/components/MediaLibraryBrowser";
import type { GameTemplate, GameTemplateConfig, SupportedGame } from "@shared/schema";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type Cfg = Required<{
  singleModeGame: boolean;
  gameModes: NonNullable<GameTemplateConfig["gameModes"]>;
  maps: NonNullable<GameTemplateConfig["maps"]>;
  heroes: NonNullable<GameTemplateConfig["heroes"]>;
  statFields: NonNullable<GameTemplateConfig["statFields"]>;
  eventCategories: NonNullable<GameTemplateConfig["eventCategories"]>;
  availabilitySlots: NonNullable<GameTemplateConfig["availabilitySlots"]>;
  opponents: NonNullable<GameTemplateConfig["opponents"]>;
}>;

function emptyCfg(): Cfg {
  return {
    singleModeGame: false,
    gameModes: [],
    maps: [],
    heroes: [],
    statFields: [],
    eventCategories: [],
    availabilitySlots: [],
    opponents: [],
  };
}

function normalizeCfg(input: any): Cfg {
  const c = emptyCfg();
  if (!input || typeof input !== "object") return c;
  c.singleModeGame = !!input.singleModeGame;
  c.gameModes = Array.isArray(input.gameModes) ? input.gameModes : [];
  c.maps = Array.isArray(input.maps) ? input.maps : [];
  c.heroes = Array.isArray(input.heroes) ? input.heroes : [];
  c.statFields = Array.isArray(input.statFields) ? input.statFields : [];
  c.eventCategories = Array.isArray(input.eventCategories) ? input.eventCategories : [];
  c.availabilitySlots = Array.isArray(input.availabilitySlots) ? input.availabilitySlots : [];
  c.opponents = Array.isArray(input.opponents) ? input.opponents : [];
  // Heal: ensure every row has a tempId.
  c.gameModes.forEach(m => { if (!m.tempId) m.tempId = uid(); });
  c.maps.forEach(m => { if (!m.tempId) m.tempId = uid(); });
  c.heroes.forEach(h => { if (!h.tempId) h.tempId = uid(); });
  c.statFields.forEach(s => { if (!s.tempId) s.tempId = uid(); });
  c.eventCategories.forEach(e => { if (!e.tempId) e.tempId = uid(); });
  c.availabilitySlots.forEach(s => { if (!s.tempId) s.tempId = uid(); });
  c.opponents.forEach(o => { if (!o.tempId) o.tempId = uid(); });
  return c;
}

export default function GameTemplateEditorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams();
  const id = params.id!;

  if (user?.orgRole !== "super_admin") {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Game Templates are restricted to Super Admins.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: template, isLoading } = useQuery<GameTemplate>({
    queryKey: ["/api/game-templates", id],
  });
  const { data: games = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const [name, setName] = useState("");
  const [cfg, setCfg] = useState<Cfg>(emptyCfg());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setCfg(normalizeCfg(template.config));
    setDirty(false);
  }, [template?.id]);

  const game = useMemo(() => games.find(g => g.id === template?.gameId), [games, template]);

  const updateCfg = (fn: (prev: Cfg) => Cfg) => {
    setCfg(fn);
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/game-templates/${id}`, { name, config: cfg });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-templates", id] });
      setDirty(false);
      toast({ title: "Template saved" });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !template) {
    return <div className="p-8 text-muted-foreground" data-testid="text-loading">Loading template…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/game-templates")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-editor">Edit Template</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {game && <Badge variant="outline">{game.name}</Badge>}
              <span className="font-mono">{template.code}</span>
              <Button
                size="icon" variant="ghost" className="h-5 w-5"
                onClick={() => { navigator.clipboard.writeText(template.code); toast({ title: "Code copied" }); }}
                data-testid="button-copy-code"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending} data-testid="button-save">
          <Save className="h-4 w-4 mr-1" />
          {saveMutation.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Template name</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            data-testid="input-template-name"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="modes" data-testid="tab-modes">Game Modes</TabsTrigger>
          <TabsTrigger value="maps" data-testid="tab-maps">Maps</TabsTrigger>
          <TabsTrigger value="heroes" data-testid="tab-heroes">Heroes</TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">Stat Fields</TabsTrigger>
          <TabsTrigger value="score" data-testid="tab-score">Score Config</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">Event Categories</TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
          <TabsTrigger value="opponents" data-testid="tab-opponents">Opponents</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Layout</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label htmlFor="single-mode" className="text-sm font-medium">Single-mode game</Label>
                <p className="text-xs text-muted-foreground">Hides the Game Mode dimension on Maps, Stat Fields, and Score Config.</p>
              </div>
              <Switch
                id="single-mode"
                checked={cfg.singleModeGame}
                onCheckedChange={(v) => updateCfg(p => ({ ...p, singleModeGame: v }))}
                data-testid="switch-single-mode"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modes">
          <ModesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="maps">
          <MapsTab cfg={cfg} update={updateCfg} gameId={template.gameId} />
        </TabsContent>

        <TabsContent value="heroes">
          <HeroesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="stats">
          <StatFieldsTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="score">
          <ScoreTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="opponents">
          <OpponentsTab cfg={cfg} update={updateCfg} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab components — each operates on the local Cfg via update(). Saves are
// triggered by the parent's Save button.
// ─────────────────────────────────────────────────────────────────────────────

type TabProps = { cfg: Cfg; update: (fn: (prev: Cfg) => Cfg) => void };

function ModesTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    gameModes: [...p.gameModes, { tempId: uid(), name: "", sortOrder: "0" }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Game Modes</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-mode"><Plus className="h-4 w-4 mr-1" />Add Mode</Button>
      </CardHeader>
      <CardContent>
        {cfg.gameModes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modes yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-32">Sort Order</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {cfg.gameModes.map((m, i) => (
                <TableRow key={m.tempId} data-testid={`row-mode-${i}`}>
                  <TableCell>
                    <Input value={m.name} onChange={(e) => update(p => {
                      const list = [...p.gameModes]; list[i] = { ...list[i], name: e.target.value }; return { ...p, gameModes: list };
                    })} data-testid={`input-mode-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={m.sortOrder ?? "0"} onChange={(e) => update(p => {
                      const list = [...p.gameModes]; list[i] = { ...list[i], sortOrder: e.target.value }; return { ...p, gameModes: list };
                    })} data-testid={`input-mode-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p,
                      gameModes: p.gameModes.filter((_, j) => j !== i),
                      maps: p.maps.map(mp => mp.gameModeTempId === m.tempId ? { ...mp, gameModeTempId: null } : mp),
                      statFields: p.statFields.map(s => s.gameModeTempId === m.tempId ? { ...s, gameModeTempId: null } : s),
                    }))} data-testid={`button-remove-mode-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ModePicker({ value, onChange, modes, testId }: {
  value: string | null; onChange: (v: string | null) => void;
  modes: Cfg["gameModes"]; testId: string;
}) {
  return (
    <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger data-testid={testId}><SelectValue placeholder="Pick mode" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— None —</SelectItem>
        {modes.map(m => <SelectItem key={m.tempId} value={m.tempId}>{m.name || "(unnamed)"}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function MapsTab({ cfg, update, gameId }: TabProps & { gameId: string | null }) {
  const { toast } = useToast();
  const [libraryOpenForRow, setLibraryOpenForRow] = useState<number | null>(null);

  const add = () => update(p => ({
    ...p,
    maps: [...p.maps, { tempId: uid(), name: "", gameModeTempId: null, imageUrl: null, sortOrder: "0" }],
  }));
  const setImage = (i: number, url: string | null) => update(p => {
    const list = [...p.maps]; list[i] = { ...list[i], imageUrl: url }; return { ...p, maps: list };
  });
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Maps</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setLibraryOpenForRow(-1)} data-testid="button-browse-library">
            <FolderOpen className="h-4 w-4 mr-1" />Browse Library
          </Button>
          <Button size="sm" onClick={add} data-testid="button-add-map"><Plus className="h-4 w-4 mr-1" />Add Map</Button>
        </div>
      </CardHeader>
      <CardContent>
        {cfg.maps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No maps yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {!cfg.singleModeGame && <TableHead className="w-48">Game Mode</TableHead>}
                <TableHead className="w-[280px]">Image</TableHead>
                <TableHead className="w-24">Sort</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cfg.maps.map((m, i) => (
                <TableRow key={m.tempId} data-testid={`row-map-${i}`}>
                  <TableCell>
                    <Input value={m.name} onChange={(e) => update(p => {
                      const list = [...p.maps]; list[i] = { ...list[i], name: e.target.value }; return { ...p, maps: list };
                    })} data-testid={`input-map-name-${i}`} />
                  </TableCell>
                  {!cfg.singleModeGame && (
                    <TableCell>
                      <ModePicker
                        value={m.gameModeTempId} modes={cfg.gameModes}
                        onChange={(v) => update(p => {
                          const list = [...p.maps]; list[i] = { ...list[i], gameModeTempId: v }; return { ...p, maps: list };
                        })}
                        testId={`select-map-mode-${i}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <MapImageCell
                      value={m.imageUrl}
                      onChange={(url) => setImage(i, url)}
                      onBrowse={() => setLibraryOpenForRow(i)}
                      onUploadError={(err) => toast({ title: "Upload failed", description: err, variant: "destructive" })}
                      onUploaded={() => toast({ title: "Image uploaded" })}
                      testIdPrefix={`map-image-${i}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input value={m.sortOrder ?? "0"} onChange={(e) => update(p => {
                      const list = [...p.maps]; list[i] = { ...list[i], sortOrder: e.target.value }; return { ...p, maps: list };
                    })} data-testid={`input-map-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, maps: p.maps.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-map-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={libraryOpenForRow !== null} onOpenChange={(open) => { if (!open) setLibraryOpenForRow(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media Library</DialogTitle>
          </DialogHeader>
          <MediaLibraryBrowser
            filterGameId={gameId ?? undefined}
            onSelect={(url) => {
              if (libraryOpenForRow !== null && libraryOpenForRow >= 0) {
                setImage(libraryOpenForRow, url);
                toast({ title: "Image selected" });
              } else {
                navigator.clipboard.writeText(url).then(() => toast({ title: "URL copied" })).catch(() => {});
              }
              setLibraryOpenForRow(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MapImageCell({
  value,
  onChange,
  onBrowse,
  onUploaded,
  onUploadError,
  testIdPrefix,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  onBrowse: () => void;
  onUploaded: () => void;
  onUploadError: (err: string) => void;
  testIdPrefix: string;
}) {
  const hasImage = !!value;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 shrink-0 rounded-sm border border-border bg-muted flex items-center justify-center overflow-hidden">
          {hasImage ? (
            <img
              src={value!}
              alt=""
              className="object-cover w-full h-full"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              data-testid={`thumb-${testIdPrefix}`}
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <ObjectUploader
          buttonSize="sm"
          buttonVariant={hasImage ? "ghost" : "outline"}
          onUploaded={(r) => { onChange(r.url); onUploaded(); }}
          onError={onUploadError}
        >
          <span className="flex items-center"><Upload className="h-3.5 w-3.5 mr-1" />{hasImage ? "Replace" : "Upload"}</span>
        </ObjectUploader>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onBrowse}
          data-testid={`button-${testIdPrefix}-browse`}
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1" />Library
        </Button>
        {hasImage && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onChange(null)}
            data-testid={`button-${testIdPrefix}-remove`}
            title="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Input
        value={value ?? ""}
        placeholder="Or paste image URL…"
        onChange={(e) => onChange(e.target.value || null)}
        data-testid={`input-${testIdPrefix}`}
        className="text-xs"
      />
    </div>
  );
}

const HERO_ROLES = ["Tank", "Damage", "Support", "Duelist", "Vanguard", "Strategist", "Flex", "Other"];

function HeroesTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    heroes: [...p.heroes, { tempId: uid(), name: "", role: "Damage", imageUrl: null, isActive: true, sortOrder: 0 }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Heroes</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-hero"><Plus className="h-4 w-4 mr-1" />Add Hero</Button>
      </CardHeader>
      <CardContent>
        {cfg.heroes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No heroes yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-40">Role</TableHead>
              <TableHead>Image URL</TableHead><TableHead className="w-24">Sort</TableHead>
              <TableHead className="w-24">Active</TableHead><TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.heroes.map((h, i) => (
                <TableRow key={h.tempId} data-testid={`row-hero-${i}`}>
                  <TableCell>
                    <Input value={h.name} onChange={(e) => update(p => {
                      const list = [...p.heroes]; list[i] = { ...list[i], name: e.target.value }; return { ...p, heroes: list };
                    })} data-testid={`input-hero-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Select value={h.role} onValueChange={(v) => update(p => {
                      const list = [...p.heroes]; list[i] = { ...list[i], role: v }; return { ...p, heroes: list };
                    })}>
                      <SelectTrigger data-testid={`select-hero-role-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HERO_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={h.imageUrl ?? ""} placeholder="(optional)" onChange={(e) => update(p => {
                      const list = [...p.heroes]; list[i] = { ...list[i], imageUrl: e.target.value || null }; return { ...p, heroes: list };
                    })} data-testid={`input-hero-image-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={h.sortOrder ?? 0} onChange={(e) => update(p => {
                      const list = [...p.heroes]; list[i] = { ...list[i], sortOrder: Number(e.target.value) || 0 }; return { ...p, heroes: list };
                    })} data-testid={`input-hero-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={h.isActive ?? true} onCheckedChange={(v) => update(p => {
                      const list = [...p.heroes]; list[i] = { ...list[i], isActive: v }; return { ...p, heroes: list };
                    })} data-testid={`switch-hero-active-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, heroes: p.heroes.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-hero-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatFieldsTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    statFields: [...p.statFields, { tempId: uid(), name: "", gameModeTempId: null }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Stat Fields</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-stat"><Plus className="h-4 w-4 mr-1" />Add Field</Button>
      </CardHeader>
      <CardContent>
        {cfg.statFields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stat fields yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              {!cfg.singleModeGame && <TableHead className="w-48">Game Mode</TableHead>}
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.statFields.map((s, i) => (
                <TableRow key={s.tempId} data-testid={`row-stat-${i}`}>
                  <TableCell>
                    <Input value={s.name} onChange={(e) => update(p => {
                      const list = [...p.statFields]; list[i] = { ...list[i], name: e.target.value }; return { ...p, statFields: list };
                    })} data-testid={`input-stat-name-${i}`} />
                  </TableCell>
                  {!cfg.singleModeGame && (
                    <TableCell>
                      <ModePicker
                        value={s.gameModeTempId} modes={cfg.gameModes}
                        onChange={(v) => update(p => {
                          const list = [...p.statFields]; list[i] = { ...list[i], gameModeTempId: v }; return { ...p, statFields: list };
                        })}
                        testId={`select-stat-mode-${i}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, statFields: p.statFields.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-stat-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

const SCORE_TYPES = ["numeric", "rounds", "rounds_per_side"];

function ScoreTab({ cfg, update }: TabProps) {
  if (cfg.gameModes.length === 0) {
    return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Add at least one Game Mode first.</CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Score Config</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Mode</TableHead><TableHead className="w-44">Score Type</TableHead>
            <TableHead className="w-28">Max Score</TableHead><TableHead className="w-28">Max Round Wins</TableHead>
            <TableHead className="w-32">Max Rounds / Game</TableHead><TableHead className="w-40">Max Score / Round / Side</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {cfg.gameModes.map((m, i) => {
              const upd = (patch: Partial<typeof m>) => update(p => {
                const list = [...p.gameModes]; list[i] = { ...list[i], ...patch }; return { ...p, gameModes: list };
              });
              const numField = (key: keyof typeof m, testId: string) => (
                <Input
                  type="number"
                  value={(m[key] as number | null) ?? ""}
                  onChange={(e) => upd({ [key]: e.target.value === "" ? null : Number(e.target.value) } as any)}
                  data-testid={testId}
                />
              );
              return (
                <TableRow key={m.tempId} data-testid={`row-score-${i}`}>
                  <TableCell className="font-medium">{m.name || "(unnamed)"}</TableCell>
                  <TableCell>
                    <Select value={m.scoreType ?? "numeric"} onValueChange={(v) => upd({ scoreType: v })}>
                      <SelectTrigger data-testid={`select-score-type-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCORE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{numField("maxScore", `input-max-score-${i}`)}</TableCell>
                  <TableCell>{numField("maxRoundWins", `input-max-round-wins-${i}`)}</TableCell>
                  <TableCell>{numField("maxRoundsPerGame", `input-max-rounds-${i}`)}</TableCell>
                  <TableCell>{numField("maxScorePerRoundPerSide", `input-max-score-side-${i}`)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CategoriesTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    eventCategories: [...p.eventCategories, { tempId: uid(), name: "", color: "#3b82f6" }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Event Categories</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-category"><Plus className="h-4 w-4 mr-1" />Add Category</Button>
      </CardHeader>
      <CardContent>
        {cfg.eventCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-32">Color</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {cfg.eventCategories.map((c, i) => (
                <TableRow key={c.tempId} data-testid={`row-cat-${i}`}>
                  <TableCell>
                    <Input value={c.name} onChange={(e) => update(p => {
                      const list = [...p.eventCategories]; list[i] = { ...list[i], name: e.target.value }; return { ...p, eventCategories: list };
                    })} data-testid={`input-cat-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="color" value={c.color ?? "#3b82f6"} onChange={(e) => update(p => {
                      const list = [...p.eventCategories]; list[i] = { ...list[i], color: e.target.value }; return { ...p, eventCategories: list };
                    })} data-testid={`input-cat-color-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, eventCategories: p.eventCategories.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-cat-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AvailabilityTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    availabilitySlots: [...p.availabilitySlots, { tempId: uid(), label: "", sortOrder: p.availabilitySlots.length }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Availability Times</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-slot"><Plus className="h-4 w-4 mr-1" />Add Slot</Button>
      </CardHeader>
      <CardContent>
        {cfg.availabilitySlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No availability slots yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead className="w-24">Sort</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {cfg.availabilitySlots.map((s, i) => (
                <TableRow key={s.tempId} data-testid={`row-slot-${i}`}>
                  <TableCell>
                    <Input value={s.label} onChange={(e) => update(p => {
                      const list = [...p.availabilitySlots]; list[i] = { ...list[i], label: e.target.value }; return { ...p, availabilitySlots: list };
                    })} data-testid={`input-slot-label-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={s.sortOrder ?? 0} onChange={(e) => update(p => {
                      const list = [...p.availabilitySlots]; list[i] = { ...list[i], sortOrder: Number(e.target.value) || 0 }; return { ...p, availabilitySlots: list };
                    })} data-testid={`input-slot-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, availabilitySlots: p.availabilitySlots.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-slot-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OpponentsTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    opponents: [...p.opponents, { tempId: uid(), name: "", shortName: null, logoUrl: null, region: null, notes: null, isActive: true, sortOrder: p.opponents.length }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Opponents</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-opp"><Plus className="h-4 w-4 mr-1" />Add Opponent</Button>
      </CardHeader>
      <CardContent>
        {cfg.opponents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No opponents yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-32">Short</TableHead>
              <TableHead className="w-32">Region</TableHead><TableHead>Logo URL</TableHead>
              <TableHead className="w-24">Active</TableHead><TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.opponents.map((o, i) => (
                <TableRow key={o.tempId} data-testid={`row-opp-${i}`}>
                  <TableCell>
                    <Input value={o.name} onChange={(e) => update(p => {
                      const list = [...p.opponents]; list[i] = { ...list[i], name: e.target.value }; return { ...p, opponents: list };
                    })} data-testid={`input-opp-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={o.shortName ?? ""} placeholder="(opt)" onChange={(e) => update(p => {
                      const list = [...p.opponents]; list[i] = { ...list[i], shortName: e.target.value || null }; return { ...p, opponents: list };
                    })} data-testid={`input-opp-short-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={o.region ?? ""} placeholder="(opt)" onChange={(e) => update(p => {
                      const list = [...p.opponents]; list[i] = { ...list[i], region: e.target.value || null }; return { ...p, opponents: list };
                    })} data-testid={`input-opp-region-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={o.logoUrl ?? ""} placeholder="(opt)" onChange={(e) => update(p => {
                      const list = [...p.opponents]; list[i] = { ...list[i], logoUrl: e.target.value || null }; return { ...p, opponents: list };
                    })} data-testid={`input-opp-logo-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={o.isActive ?? true} onCheckedChange={(v) => update(p => {
                      const list = [...p.opponents]; list[i] = { ...list[i], isActive: v }; return { ...p, opponents: list };
                    })} data-testid={`switch-opp-active-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, opponents: p.opponents.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-opp-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
