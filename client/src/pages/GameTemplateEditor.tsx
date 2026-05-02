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
import { Plus, Trash2, ArrowLeft, Save, Copy, Upload, ImageIcon, X, FolderOpen, Users } from "lucide-react";
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
  players: NonNullable<GameTemplateConfig["players"]>;
  sides: NonNullable<GameTemplateConfig["sides"]>;
  rosterRoles: NonNullable<GameTemplateConfig["rosterRoles"]>;
  heroRoles: NonNullable<GameTemplateConfig["heroRoles"]>;
  eventSubTypes: NonNullable<GameTemplateConfig["eventSubTypes"]>;
  heroBanSystems: NonNullable<GameTemplateConfig["heroBanSystems"]>;
  mapVetoSystems: NonNullable<GameTemplateConfig["mapVetoSystems"]>;
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
    players: [],
    sides: [],
    rosterRoles: [],
    heroRoles: [],
    eventSubTypes: [],
    heroBanSystems: [],
    mapVetoSystems: [],
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
  c.players = Array.isArray(input.players) ? input.players : [];
  c.sides = Array.isArray(input.sides) ? input.sides : [];
  c.rosterRoles = Array.isArray(input.rosterRoles) ? input.rosterRoles : [];
  c.heroRoles = Array.isArray(input.heroRoles) ? input.heroRoles : [];
  c.eventSubTypes = Array.isArray(input.eventSubTypes) ? input.eventSubTypes : [];
  c.heroBanSystems = Array.isArray(input.heroBanSystems) ? input.heroBanSystems : [];
  c.mapVetoSystems = Array.isArray(input.mapVetoSystems) ? input.mapVetoSystems : [];
  // Heal: ensure every row has a tempId.
  c.gameModes.forEach(m => { if (!m.tempId) m.tempId = uid(); });
  c.maps.forEach(m => { if (!m.tempId) m.tempId = uid(); });
  c.heroes.forEach(h => { if (!h.tempId) h.tempId = uid(); });
  c.statFields.forEach(s => { if (!s.tempId) s.tempId = uid(); });
  c.eventCategories.forEach(e => { if (!e.tempId) e.tempId = uid(); });
  c.availabilitySlots.forEach(s => { if (!s.tempId) s.tempId = uid(); });
  c.opponents.forEach(o => { if (!o.tempId) o.tempId = uid(); });
  // Drop any player rows whose opponentTempId no longer matches an
  // existing opponent (e.g. opponent was deleted). Heal missing tempIds.
  const oppTempIds = new Set(c.opponents.map(o => o.tempId));
  c.players = c.players.filter(p => p.opponentTempId && oppTempIds.has(p.opponentTempId));
  c.players.forEach(p => { if (!p.tempId) p.tempId = uid(); });
  c.sides.forEach(s => { if (!s.tempId) s.tempId = uid(); });
  c.rosterRoles.forEach(r => { if (!r.tempId) r.tempId = uid(); });
  c.heroRoles.forEach(r => { if (!r.tempId) r.tempId = uid(); });
  c.eventSubTypes.forEach(s => { if (!s.tempId) s.tempId = uid(); });
  c.heroBanSystems.forEach(h => { if (!h.tempId) h.tempId = uid(); });
  c.mapVetoSystems.forEach(v => { if (!v.tempId) v.tempId = uid(); });
  return c;
}

export default function GameTemplateEditorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams();
  const id = params.id!;

  // ── ALL HOOKS MUST RUN IN THE SAME ORDER EVERY RENDER ──
  // The super_admin gate cannot be an early return BEFORE hooks — when
  // useAuth resolves async (null → user object), the hook order changes
  // between renders, which corrupts useState slots. (This was the
  // "everything I added disappears" persistence bug — the load useEffect
  // got assigned to the wrong slot and never wrote into cfg.) Run every
  // hook unconditionally, then conditionally render at the end.
  const { data: template, isLoading } = useQuery<GameTemplate>({
    queryKey: ["/api/game-templates", id],
    enabled: !!id && user?.orgRole === "super_admin",
  });
  const { data: games = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const [name, setName] = useState("");
  const [cfg, setCfg] = useState<Cfg>(emptyCfg());
  const [dirty, setDirty] = useState(false);
  // Track which template id we've loaded into local state. Lets the load
  // effect run reliably even when React Query swaps cached objects (same
  // id) while preserving in-progress edits across re-renders.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!template) return;
    if (loadedFor === template.id) return;
    setName(template.name);
    setCfg(normalizeCfg(template.config));
    setDirty(false);
    setLoadedFor(template.id);
  }, [template, loadedFor]);

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

  // ── Conditional rendering AFTER hooks ──
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
          <TabsTrigger value="hero-roles" data-testid="tab-hero-roles">Hero Roles</TabsTrigger>
          <TabsTrigger value="hero-ban" data-testid="tab-hero-ban">Hero Ban</TabsTrigger>
          <TabsTrigger value="map-veto" data-testid="tab-map-veto">Map Veto</TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">Stat Fields</TabsTrigger>
          <TabsTrigger value="score" data-testid="tab-score">Score Config</TabsTrigger>
          <TabsTrigger value="sides" data-testid="tab-sides">Sides</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">Event Categories</TabsTrigger>
          <TabsTrigger value="sub-types" data-testid="tab-sub-types">Sub Types</TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
          <TabsTrigger value="roster-roles" data-testid="tab-roster-roles">Roster Roles</TabsTrigger>
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
          <HeroesTab cfg={cfg} update={updateCfg} gameId={template.gameId} />
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
          <OpponentsTab cfg={cfg} update={updateCfg} gameId={template.gameId} />
        </TabsContent>

        <TabsContent value="sides">
          <SidesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="roster-roles">
          <RosterRolesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="hero-roles">
          <HeroRolesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="sub-types">
          <SubTypesTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="hero-ban">
          <HeroBanTab cfg={cfg} update={updateCfg} />
        </TabsContent>

        <TabsContent value="map-veto">
          <MapVetoTab cfg={cfg} update={updateCfg} />
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
            // key={value} forces a fresh <img> each time the URL changes,
            // so a previous failed-to-load state never permanently hides
            // the preview when the user keeps editing the URL.
            <img
              key={value!}
              src={value!}
              alt=""
              className="object-cover w-full h-full"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
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

const FALLBACK_HERO_ROLES = ["Other"];

function HeroesTab({ cfg, update, gameId }: TabProps & { gameId: string | null }) {
  const { toast } = useToast();
  const [libraryOpenForRow, setLibraryOpenForRow] = useState<number | null>(null);
  const heroRoles = cfg.heroRoles.length > 0
    ? cfg.heroRoles.map(r => r.name).filter(n => !!n)
    : FALLBACK_HERO_ROLES;
  const defaultRole = heroRoles[0] ?? "Other";
  const add = () => update(p => ({
    ...p,
    heroes: [...p.heroes, { tempId: uid(), name: "", role: defaultRole, imageUrl: null, isActive: true, sortOrder: 0 }],
  }));
  const setImage = (i: number, url: string | null) => update(p => {
    const list = [...p.heroes]; list[i] = { ...list[i], imageUrl: url }; return { ...p, heroes: list };
  });
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Heroes</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setLibraryOpenForRow(-1)} data-testid="button-browse-library-heroes">
            <FolderOpen className="h-4 w-4 mr-1" />Browse Library
          </Button>
          <Button size="sm" onClick={add} data-testid="button-add-hero"><Plus className="h-4 w-4 mr-1" />Add Hero</Button>
        </div>
      </CardHeader>
      <CardContent>
        {cfg.heroes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No heroes yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-40">Role</TableHead>
              <TableHead className="w-[280px]">Image</TableHead><TableHead className="w-24">Sort</TableHead>
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
                    <Select value={heroRoles.includes(h.role) ? h.role : defaultRole} onValueChange={(v) => update(p => {
                      const list = [...p.heroes]; list[i] = { ...list[i], role: v }; return { ...p, heroes: list };
                    })}>
                      <SelectTrigger data-testid={`select-hero-role-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {heroRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <MapImageCell
                      value={h.imageUrl}
                      onChange={(url) => setImage(i, url)}
                      onBrowse={() => setLibraryOpenForRow(i)}
                      onUploadError={(err) => toast({ title: "Upload failed", description: err, variant: "destructive" })}
                      onUploaded={() => toast({ title: "Image uploaded" })}
                      testIdPrefix={`hero-image-${i}`}
                    />
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

function OpponentsTab({ cfg, update, gameId }: TabProps & { gameId: string | null }) {
  const { toast } = useToast();
  const [libraryOpenForRow, setLibraryOpenForRow] = useState<number | null>(null);
  const [rosterOpenFor, setRosterOpenFor] = useState<string | null>(null);
  const add = () => update(p => ({
    ...p,
    opponents: [...p.opponents, { tempId: uid(), name: "", shortName: null, logoUrl: null, region: null, notes: null, isActive: true, sortOrder: p.opponents.length }],
  }));
  const setLogo = (i: number, url: string | null) => update(p => {
    const list = [...p.opponents]; list[i] = { ...list[i], logoUrl: url }; return { ...p, opponents: list };
  });
  const removeOpp = (tempId: string) => update(p => ({
    ...p,
    opponents: p.opponents.filter(o => o.tempId !== tempId),
    // Cascade: drop any template players that referenced this opponent.
    players: p.players.filter(pl => pl.opponentTempId !== tempId),
  }));
  // Roles for the opponent-roster Role dropdown. Prefer the template's
  // own player-type roster roles; fall back to free text when none.
  const playerRoles = cfg.rosterRoles
    .filter(r => (r.type ?? "player") === "player")
    .map(r => r.name)
    .filter(n => !!n);
  const openRoster = rosterOpenFor
    ? cfg.opponents.find(o => o.tempId === rosterOpenFor) ?? null
    : null;
  const oppPlayers = openRoster
    ? cfg.players.filter(p => p.opponentTempId === openRoster.tempId)
    : [];
  const addPlayer = (oppTempId: string) => update(p => ({
    ...p,
    players: [
      ...p.players,
      {
        tempId: uid(),
        opponentTempId: oppTempId,
        name: "",
        ign: null,
        role: null,
        notes: null,
        isStarter: true,
        sortOrder: p.players.filter(pl => pl.opponentTempId === oppTempId).length,
      },
    ],
  }));
  const updatePlayer = (tempId: string, patch: Partial<Cfg["players"][number]>) => update(p => ({
    ...p,
    players: p.players.map(pl => pl.tempId === tempId ? { ...pl, ...patch } : pl),
  }));
  const removePlayer = (tempId: string) => update(p => ({
    ...p,
    players: p.players.filter(pl => pl.tempId !== tempId),
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Opponents</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setLibraryOpenForRow(-1)} data-testid="button-browse-library-opps">
            <FolderOpen className="h-4 w-4 mr-1" />Browse Library
          </Button>
          <Button size="sm" onClick={add} data-testid="button-add-opp"><Plus className="h-4 w-4 mr-1" />Add Opponent</Button>
        </div>
      </CardHeader>
      <CardContent>
        {cfg.opponents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No opponents yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-32">Short</TableHead>
              <TableHead className="w-32">Region</TableHead>
              <TableHead className="w-[280px]">Logo</TableHead>
              <TableHead className="w-32">Roster</TableHead>
              <TableHead className="w-24">Active</TableHead><TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.opponents.map((o, i) => {
                const playerCount = cfg.players.filter(p => p.opponentTempId === o.tempId).length;
                return (
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
                    <MapImageCell
                      value={o.logoUrl}
                      onChange={(url) => setLogo(i, url)}
                      onBrowse={() => setLibraryOpenForRow(i)}
                      onUploadError={(err) => toast({ title: "Upload failed", description: err, variant: "destructive" })}
                      onUploaded={() => toast({ title: "Logo uploaded" })}
                      testIdPrefix={`opp-logo-${i}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRosterOpenFor(o.tempId)}
                      data-testid={`button-view-roster-${i}`}
                    >
                      <Users className="h-4 w-4 mr-1" />View Roster
                      {playerCount > 0 && (
                        <Badge variant="secondary" className="ml-2">{playerCount}</Badge>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Switch checked={o.isActive ?? true} onCheckedChange={(v) => update(p => {
                      const list = [...p.opponents]; list[i] = { ...list[i], isActive: v }; return { ...p, opponents: list };
                    })} data-testid={`switch-opp-active-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeOpp(o.tempId)} data-testid={`button-remove-opp-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
              })}
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
                setLogo(libraryOpenForRow, url);
                toast({ title: "Logo selected" });
              } else {
                navigator.clipboard.writeText(url).then(() => toast({ title: "URL copied" })).catch(() => {});
              }
              setLibraryOpenForRow(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={rosterOpenFor !== null} onOpenChange={(open) => { if (!open) setRosterOpenFor(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {openRoster ? `Roster — ${openRoster.name || "(unnamed opponent)"}` : "Roster"}
            </DialogTitle>
          </DialogHeader>
          {openRoster && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Template-scoped players. Loaded into this opponent's roster when the template is applied.
                </p>
                <Button size="sm" onClick={() => addPlayer(openRoster.tempId)} data-testid="button-add-opp-player">
                  <Plus className="h-4 w-4 mr-1" />Add Player
                </Button>
              </div>
              {oppPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No players in this opponent's roster yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-40">IGN</TableHead>
                      <TableHead className="w-44">Role</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-24">Starter</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oppPlayers.map((p, i) => (
                      <TableRow key={p.tempId} data-testid={`row-opp-player-${i}`}>
                        <TableCell>
                          <Input
                            value={p.name}
                            onChange={(e) => updatePlayer(p.tempId, { name: e.target.value })}
                            data-testid={`input-opp-player-name-${i}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={p.ign ?? ""}
                            placeholder="(opt)"
                            onChange={(e) => updatePlayer(p.tempId, { ign: e.target.value || null })}
                            data-testid={`input-opp-player-ign-${i}`}
                          />
                        </TableCell>
                        <TableCell>
                          {playerRoles.length > 0 ? (
                            <Select
                              value={p.role ?? "__none__"}
                              onValueChange={(v) => updatePlayer(p.tempId, { role: v === "__none__" ? null : v })}
                            >
                              <SelectTrigger data-testid={`select-opp-player-role-${i}`}><SelectValue placeholder="(none)" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">(none)</SelectItem>
                                {playerRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={p.role ?? ""}
                              placeholder="(opt)"
                              onChange={(e) => updatePlayer(p.tempId, { role: e.target.value || null })}
                              data-testid={`input-opp-player-role-${i}`}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={p.notes ?? ""}
                            placeholder="(opt)"
                            onChange={(e) => updatePlayer(p.tempId, { notes: e.target.value || null })}
                            data-testid={`input-opp-player-notes-${i}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={p.isStarter ?? true}
                            onCheckedChange={(v) => updatePlayer(p.tempId, { isStarter: v })}
                            data-testid={`switch-opp-player-starter-${i}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removePlayer(p.tempId)}
                            data-testid={`button-remove-opp-player-${i}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── New tabs (template-only — applied via /api/game-templates/apply) ────────

function SidesTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    sides: [...p.sides, { tempId: uid(), name: "", sortOrder: String(p.sides.length) }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Sides</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-side"><Plus className="h-4 w-4 mr-1" />Add Side</Button>
      </CardHeader>
      <CardContent>
        {cfg.sides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sides yet. Examples: Attack / Defense, Blue / Red.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-32">Sort Order</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {cfg.sides.map((s, i) => (
                <TableRow key={s.tempId} data-testid={`row-side-${i}`}>
                  <TableCell>
                    <Input value={s.name} onChange={(e) => update(p => {
                      const list = [...p.sides]; list[i] = { ...list[i], name: e.target.value }; return { ...p, sides: list };
                    })} data-testid={`input-side-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={s.sortOrder ?? "0"} onChange={(e) => update(p => {
                      const list = [...p.sides]; list[i] = { ...list[i], sortOrder: e.target.value }; return { ...p, sides: list };
                    })} data-testid={`input-side-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, sides: p.sides.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-side-${i}`}>
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

const ROSTER_ROLE_TYPES = ["player", "coach", "manager", "analyst", "substitute", "staff"];

function RosterRolesTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    rosterRoles: [...p.rosterRoles, { tempId: uid(), name: "", type: "player", sortOrder: p.rosterRoles.length }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Roster Roles</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-roster-role"><Plus className="h-4 w-4 mr-1" />Add Role</Button>
      </CardHeader>
      <CardContent>
        {cfg.rosterRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roster roles yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-40">Type</TableHead>
              <TableHead className="w-24">Sort</TableHead><TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.rosterRoles.map((r, i) => (
                <TableRow key={r.tempId} data-testid={`row-roster-role-${i}`}>
                  <TableCell>
                    <Input value={r.name} onChange={(e) => update(p => {
                      const list = [...p.rosterRoles]; list[i] = { ...list[i], name: e.target.value }; return { ...p, rosterRoles: list };
                    })} data-testid={`input-roster-role-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Select value={r.type ?? "player"} onValueChange={(v) => update(p => {
                      const list = [...p.rosterRoles]; list[i] = { ...list[i], type: v }; return { ...p, rosterRoles: list };
                    })}>
                      <SelectTrigger data-testid={`select-roster-role-type-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROSTER_ROLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={r.sortOrder ?? 0} onChange={(e) => update(p => {
                      const list = [...p.rosterRoles]; list[i] = { ...list[i], sortOrder: Number(e.target.value) || 0 }; return { ...p, rosterRoles: list };
                    })} data-testid={`input-roster-role-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, rosterRoles: p.rosterRoles.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-roster-role-${i}`}>
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

function HeroRolesTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    heroRoles: [...p.heroRoles, { tempId: uid(), name: "", color: "#3b82f6", isActive: true, sortOrder: p.heroRoles.length }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Hero Roles</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Used by the Heroes tab role select. Applied to the team's hero role registry (additive — never deletes).</p>
        </div>
        <Button size="sm" onClick={add} data-testid="button-add-hero-role"><Plus className="h-4 w-4 mr-1" />Add Role</Button>
      </CardHeader>
      <CardContent>
        {cfg.heroRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hero roles yet. Add roles like Tank, Damage, Support so heroes can be categorized.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-32">Color</TableHead>
              <TableHead className="w-24">Sort</TableHead><TableHead className="w-24">Active</TableHead><TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.heroRoles.map((r, i) => (
                <TableRow key={r.tempId} data-testid={`row-hero-role-${i}`}>
                  <TableCell>
                    <Input value={r.name} onChange={(e) => update(p => {
                      const list = [...p.heroRoles]; list[i] = { ...list[i], name: e.target.value }; return { ...p, heroRoles: list };
                    })} data-testid={`input-hero-role-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="color" value={r.color ?? "#3b82f6"} onChange={(e) => update(p => {
                      const list = [...p.heroRoles]; list[i] = { ...list[i], color: e.target.value }; return { ...p, heroRoles: list };
                    })} data-testid={`input-hero-role-color-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={r.sortOrder ?? 0} onChange={(e) => update(p => {
                      const list = [...p.heroRoles]; list[i] = { ...list[i], sortOrder: Number(e.target.value) || 0 }; return { ...p, heroRoles: list };
                    })} data-testid={`input-hero-role-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.isActive ?? true} onCheckedChange={(v) => update(p => {
                      const list = [...p.heroRoles]; list[i] = { ...list[i], isActive: v }; return { ...p, heroRoles: list };
                    })} data-testid={`switch-hero-role-active-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, heroRoles: p.heroRoles.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-hero-role-${i}`}>
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

function SubTypesTab({ cfg, update }: TabProps) {
  if (cfg.eventCategories.length === 0) {
    return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Add at least one Event Category first.</CardContent></Card>;
  }
  const add = () => update(p => ({
    ...p,
    eventSubTypes: [...p.eventSubTypes, {
      tempId: uid(),
      categoryTempId: p.eventCategories[0]!.tempId,
      name: "",
      color: null,
      sortOrder: p.eventSubTypes.length,
    }],
  }));
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Event Sub Types</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-sub-type"><Plus className="h-4 w-4 mr-1" />Add Sub Type</Button>
      </CardHeader>
      <CardContent>
        {cfg.eventSubTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sub types yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead className="w-48">Category</TableHead>
              <TableHead className="w-32">Color</TableHead><TableHead className="w-24">Sort</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cfg.eventSubTypes.map((s, i) => (
                <TableRow key={s.tempId} data-testid={`row-sub-type-${i}`}>
                  <TableCell>
                    <Input value={s.name} onChange={(e) => update(p => {
                      const list = [...p.eventSubTypes]; list[i] = { ...list[i], name: e.target.value }; return { ...p, eventSubTypes: list };
                    })} data-testid={`input-sub-type-name-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Select value={s.categoryTempId} onValueChange={(v) => update(p => {
                      const list = [...p.eventSubTypes]; list[i] = { ...list[i], categoryTempId: v }; return { ...p, eventSubTypes: list };
                    })}>
                      <SelectTrigger data-testid={`select-sub-type-cat-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cfg.eventCategories.map(c => <SelectItem key={c.tempId} value={c.tempId}>{c.name || "(unnamed)"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="color" value={s.color ?? "#3b82f6"} onChange={(e) => update(p => {
                      const list = [...p.eventSubTypes]; list[i] = { ...list[i], color: e.target.value }; return { ...p, eventSubTypes: list };
                    })} data-testid={`input-sub-type-color-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={s.sortOrder ?? 0} onChange={(e) => update(p => {
                      const list = [...p.eventSubTypes]; list[i] = { ...list[i], sortOrder: Number(e.target.value) || 0 }; return { ...p, eventSubTypes: list };
                    })} data-testid={`input-sub-type-sort-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({
                      ...p, eventSubTypes: p.eventSubTypes.filter((_, j) => j !== i),
                    }))} data-testid={`button-remove-sub-type-${i}`}>
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

const HBS_MODES = ["simple", "rainbow_flexible", "custom"];

function HeroBanTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    heroBanSystems: [...p.heroBanSystems, {
      tempId: uid(),
      name: "",
      enabled: true,
      mode: "simple",
      supportsLocks: false,
      bansPerTeam: 0,
      locksPerTeam: 0,
      bansTargetEnemy: true,
      locksSecureOwn: false,
      bansPerRound: null,
      bansEverySideSwitch: false,
      bansEveryTwoRounds: false,
      bansResetOnHalftime: false,
      overtimeBehavior: null,
      totalBansPerMap: null,
      bansAccumulate: false,
      notes: null,
      sortOrder: p.heroBanSystems.length,
    }],
  }));
  const upd = (i: number, patch: Partial<Cfg["heroBanSystems"][number]>) => update(p => {
    const list = [...p.heroBanSystems]; list[i] = { ...list[i], ...patch }; return { ...p, heroBanSystems: list };
  });
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Hero Ban Systems</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-hbs"><Plus className="h-4 w-4 mr-1" />Add System</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {cfg.heroBanSystems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hero ban systems yet.</p>
        ) : (
          cfg.heroBanSystems.map((h, i) => (
            <Card key={h.tempId} data-testid={`row-hbs-${i}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <Input
                    value={h.name}
                    placeholder="System name"
                    className="max-w-xs"
                    onChange={(e) => upd(i, { name: e.target.value })}
                    data-testid={`input-hbs-name-${i}`}
                  />
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`hbs-enabled-${i}`} className="text-xs">Enabled</Label>
                    <Switch id={`hbs-enabled-${i}`} checked={h.enabled ?? true} onCheckedChange={(v) => upd(i, { enabled: v })} data-testid={`switch-hbs-enabled-${i}`} />
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({ ...p, heroBanSystems: p.heroBanSystems.filter((_, j) => j !== i) }))} data-testid={`button-remove-hbs-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Mode</Label>
                    <Select value={h.mode ?? "simple"} onValueChange={(v) => upd(i, { mode: v })}>
                      <SelectTrigger data-testid={`select-hbs-mode-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HBS_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Bans / Team</Label>
                    <Input type="number" value={h.bansPerTeam ?? 0} onChange={(e) => upd(i, { bansPerTeam: Number(e.target.value) || 0 })} data-testid={`input-hbs-bans-per-team-${i}`} />
                  </div>
                  <div>
                    <Label className="text-xs">Locks / Team</Label>
                    <Input type="number" value={h.locksPerTeam ?? 0} onChange={(e) => upd(i, { locksPerTeam: Number(e.target.value) || 0 })} data-testid={`input-hbs-locks-per-team-${i}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={h.supportsLocks ?? false} onCheckedChange={(v) => upd(i, { supportsLocks: v })} data-testid={`switch-hbs-supports-locks-${i}`} />
                    <Label className="text-xs">Supports Locks</Label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={h.bansTargetEnemy ?? true} onCheckedChange={(v) => upd(i, { bansTargetEnemy: v })} data-testid={`switch-hbs-target-enemy-${i}`} />
                      <Label className="text-xs">Bans Target Enemy</Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      ON: each team bans heroes from the other team. OFF: bans remove heroes from their own pool.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={h.locksSecureOwn ?? false} onCheckedChange={(v) => upd(i, { locksSecureOwn: v })} data-testid={`switch-hbs-locks-secure-${i}`} />
                    <Label className="text-xs">Locks Secure Own</Label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={h.bansAccumulate ?? false} onCheckedChange={(v) => upd(i, { bansAccumulate: v })} data-testid={`switch-hbs-accumulate-${i}`} />
                      <Label className="text-xs">Bans Persist Across Rounds</Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      When enabled, any hero banned in any round remains banned for the rest of the entire match.
                    </p>
                  </div>
                </div>
                {h.mode === "rainbow_flexible" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
                    <div>
                      <Label className="text-xs">Bans / Round</Label>
                      <Input type="number" value={h.bansPerRound ?? ""} onChange={(e) => upd(i, { bansPerRound: e.target.value === "" ? null : Number(e.target.value) })} data-testid={`input-hbs-bans-per-round-${i}`} />
                    </div>
                    <div>
                      <Label className="text-xs">Total Bans / Map</Label>
                      <Input type="number" value={h.totalBansPerMap ?? ""} onChange={(e) => upd(i, { totalBansPerMap: e.target.value === "" ? null : Number(e.target.value) })} data-testid={`input-hbs-total-bans-${i}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={h.bansEverySideSwitch ?? false} onCheckedChange={(v) => upd(i, { bansEverySideSwitch: v })} data-testid={`switch-hbs-every-side-${i}`} />
                      <Label className="text-xs">Every Side Switch</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={h.bansEveryTwoRounds ?? false} onCheckedChange={(v) => upd(i, { bansEveryTwoRounds: v })} data-testid={`switch-hbs-every-two-${i}`} />
                      <Label className="text-xs">Every 2 Rounds</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={h.bansResetOnHalftime ?? false} onCheckedChange={(v) => upd(i, { bansResetOnHalftime: v })} data-testid={`switch-hbs-reset-half-${i}`} />
                      <Label className="text-xs">Reset on Halftime</Label>
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Overtime Behavior</Label>
                      <Input value={h.overtimeBehavior ?? ""} onChange={(e) => upd(i, { overtimeBehavior: e.target.value || null })} data-testid={`input-hbs-overtime-${i}`} />
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input value={h.notes ?? ""} onChange={(e) => upd(i, { notes: e.target.value || null })} data-testid={`input-hbs-notes-${i}`} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MapVetoTab({ cfg, update }: TabProps) {
  const add = () => update(p => ({
    ...p,
    mapVetoSystems: [...p.mapVetoSystems, {
      tempId: uid(),
      name: "",
      enabled: true,
      supportsBan: true,
      supportsPick: true,
      supportsDecider: true,
      supportsSideChoice: true,
      defaultRowCount: 7,
      notes: null,
      sortOrder: p.mapVetoSystems.length,
    }],
  }));
  const upd = (i: number, patch: Partial<Cfg["mapVetoSystems"][number]>) => update(p => {
    const list = [...p.mapVetoSystems]; list[i] = { ...list[i], ...patch }; return { ...p, mapVetoSystems: list };
  });
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Map Veto Systems</CardTitle>
        <Button size="sm" onClick={add} data-testid="button-add-mvs"><Plus className="h-4 w-4 mr-1" />Add System</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {cfg.mapVetoSystems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No map veto systems yet.</p>
        ) : (
          cfg.mapVetoSystems.map((v, i) => (
            <Card key={v.tempId} data-testid={`row-mvs-${i}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <Input
                    value={v.name}
                    placeholder="System name"
                    className="max-w-xs"
                    onChange={(e) => upd(i, { name: e.target.value })}
                    data-testid={`input-mvs-name-${i}`}
                  />
                  <div className="flex items-center gap-3">
                    <Label className="text-xs">Enabled</Label>
                    <Switch checked={v.enabled ?? true} onCheckedChange={(val) => upd(i, { enabled: val })} data-testid={`switch-mvs-enabled-${i}`} />
                    <Button size="icon" variant="ghost" onClick={() => update(p => ({ ...p, mapVetoSystems: p.mapVetoSystems.filter((_, j) => j !== i) }))} data-testid={`button-remove-mvs-${i}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={v.supportsBan ?? true} onCheckedChange={(val) => upd(i, { supportsBan: val })} data-testid={`switch-mvs-ban-${i}`} />
                    <Label className="text-xs">Supports Ban</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={v.supportsPick ?? true} onCheckedChange={(val) => upd(i, { supportsPick: val })} data-testid={`switch-mvs-pick-${i}`} />
                    <Label className="text-xs">Supports Pick</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={v.supportsDecider ?? true} onCheckedChange={(val) => upd(i, { supportsDecider: val })} data-testid={`switch-mvs-decider-${i}`} />
                    <Label className="text-xs">Supports Decider</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={v.supportsSideChoice ?? true} onCheckedChange={(val) => upd(i, { supportsSideChoice: val })} data-testid={`switch-mvs-side-choice-${i}`} />
                    <Label className="text-xs">Supports Side Choice</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Default Row Count</Label>
                    <Input type="number" min={1} max={40} value={v.defaultRowCount ?? 7} onChange={(e) => upd(i, { defaultRowCount: Math.max(1, Math.min(40, Number(e.target.value) || 7)) })} data-testid={`input-mvs-rows-${i}`} />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input value={v.notes ?? ""} onChange={(e) => upd(i, { notes: e.target.value || null })} data-testid={`input-mvs-notes-${i}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
