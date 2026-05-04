import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  ChevronDown, ChevronRight, Copy, Check, Search, ImageIcon,
  FolderPlus, Trash2, Upload, Folder,
} from "lucide-react";
import type { Permission } from "@shared/schema";

export type MediaItem = { id: string; name: string; url: string; rosterId?: string | null };
export type MediaCategoryKey = "maps" | "heroes" | "opponents" | "scoreboards";
/** Recursive folder node with optional subfolders. */
export type CustomFolder = {
  id: string;
  name: string;
  sortOrder: number;
  items: { id: string; name: string; url: string }[];
  /** Server now always sends this; default to [] for back-compat. */
  subfolders?: CustomFolder[];
};
export type MediaGame = {
  gameId: string;
  gameSlug: string;
  gameName: string;
  gameIconUrl: string | null;
  sortOrder: number;
  categories: Record<MediaCategoryKey, MediaItem[]>;
  /** Custom subfolders attached to this game. Server adds — default to []. */
  customFolders?: CustomFolder[];
};
export type MediaLibraryResponse = {
  games: MediaGame[];
  customFolders: CustomFolder[];
};

const CATEGORY_LABELS: Record<MediaCategoryKey, string> = {
  maps: "Maps",
  heroes: "Heroes",
  opponents: "Opponents",
  scoreboards: "Scoreboard Uploads",
};
const CATEGORY_ORDER: MediaCategoryKey[] = ["maps", "heroes", "opponents", "scoreboards"];

interface BrowserProps {
  filterGameId?: string;
  onSelect?: (url: string) => void;
  defaultOpen?: boolean;
  categories?: MediaCategoryKey[];
  capHeight?: boolean;
  showCustomFolders?: boolean;
}

// ── Search helpers ────────────────────────────────────────────────────────────

/**
 * Filter a folder tree by a free-text query. Returns a new tree containing
 * only branches that match (folder name match OR any descendant item match),
 * with non-matching items removed from leaves.
 */
function filterFolderTree(folders: CustomFolder[], q: string): CustomFolder[] {
  if (!q) return folders;
  const out: CustomFolder[] = [];
  for (const f of folders) {
    const subs = filterFolderTree(f.subfolders ?? [], q);
    const items = f.items.filter(it => it.name.toLowerCase().includes(q));
    const folderMatches = f.name.toLowerCase().includes(q);
    if (folderMatches || items.length > 0 || subs.length > 0) {
      out.push({
        ...f,
        items: folderMatches ? f.items : items,
        subfolders: subs,
      });
    }
  }
  return out;
}

function countAll(folders: CustomFolder[]): number {
  let n = 0;
  for (const f of folders) {
    n += f.items.length + countAll(f.subfolders ?? []);
  }
  return n;
}

export function MediaLibraryBrowser({
  filterGameId,
  onSelect,
  defaultOpen = false,
  categories = CATEGORY_ORDER,
  capHeight = true,
  showCustomFolders = true,
}: BrowserProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery<MediaLibraryResponse>({
    queryKey: ["/api/media-library"],
  });
  const library: MediaGame[] = Array.isArray(data) ? data : (data?.games ?? []);
  const customFolders: CustomFolder[] = Array.isArray(data) ? [] : (data?.customFolders ?? []);

  const filtered = useMemo(() => {
    let games = filterGameId ? library.filter(g => g.gameId === filterGameId) : library;
    games = games.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games
      .map(g => ({
        ...g,
        categories: Object.fromEntries(
          (Object.keys(g.categories) as MediaCategoryKey[]).map(k => [
            k,
            g.categories[k].filter(it => it.name.toLowerCase().includes(q)),
          ]),
        ) as MediaGame["categories"],
        customFolders: filterFolderTree(g.customFolders ?? [], q),
      }))
      .filter(g =>
        Object.values(g.categories).some(arr => arr.length > 0)
        || (g.customFolders ?? []).length > 0,
      );
  }, [library, search, filterGameId]);

  const filteredCustom = useMemo(() => {
    if (filterGameId) return [];
    const q = search.trim().toLowerCase();
    return q ? filterFolderTree(customFolders, q) : customFolders;
  }, [customFolders, search, filterGameId]);

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast({ title: "URL copied" });
      setTimeout(() => setCopiedUrl(null), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const showCustom = showCustomFolders && !filterGameId;
  const hasNothing = filtered.length === 0 && (!showCustom || filteredCustom.length === 0);

  return (
    <div className="flex flex-col gap-3" data-testid="media-library-browser">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by image or folder name…"
            className="pl-8"
            data-testid="input-media-search"
          />
        </div>
        {showCustom && <NewFolderButton scopeLabel="Custom Folder" />}
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground" data-testid="text-media-loading">Loading library…</div>
      ) : hasNothing ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2" data-testid="text-media-empty">
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm">No images found.</span>
        </div>
      ) : (
        (() => {
          const list = (
            <div className="flex flex-col gap-3">
              {showCustom && (
                <CustomFoldersSection
                  folders={filteredCustom}
                  onSelect={onSelect}
                  onCopy={handleCopy}
                  copiedUrl={copiedUrl}
                  defaultOpen={defaultOpen}
                />
              )}
              {filtered.map((g) => (
                <GameSection
                  key={g.gameId}
                  game={g}
                  categories={categories}
                  onSelect={onSelect}
                  onCopy={handleCopy}
                  copiedUrl={copiedUrl}
                  hideGameHeader={!!filterGameId}
                  defaultCategoryOpen={!!filterGameId || defaultOpen}
                  showFolderManagement={showCustom}
                />
              ))}
            </div>
          );
          return capHeight ? (
            <ScrollArea className="max-h-[60vh] pr-3">{list}</ScrollArea>
          ) : (
            list
          );
        })()
      )}
    </div>
  );
}

// ── New Folder dialog (used as both top-level & subfolder creator) ───────────

function NewFolderButton({
  scopeLabel,
  parentId,
  gameId,
  size = "sm",
  variant = "default",
  iconOnly = false,
  testIdSuffix,
}: {
  /** Human label shown inside the dialog. */
  scopeLabel: string;
  parentId?: string | null;
  gameId?: string | null;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
  iconOnly?: boolean;
  testIdSuffix?: string;
}) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("manage_media" as Permission) || hasPermission("upload_media" as Permission);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const tid = testIdSuffix ?? `${gameId ?? "root"}-${parentId ?? "top"}`;

  const create = useMutation({
    mutationFn: async (body: { name: string; sortOrder: number; parentId?: string | null; gameId?: string | null }) =>
      apiRequest("POST", "/api/media-folders", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media-library"] });
      toast({ title: "Folder created" });
      setOpen(false);
      setName("");
      setSortOrder("0");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!canCreate) return null;

  const trigger = iconOnly ? (
    <Button
      size="icon"
      variant={variant}
      data-testid={`button-new-folder-${tid}`}
      title={`New ${scopeLabel}`}
    >
      <FolderPlus className="h-4 w-4" />
    </Button>
  ) : (
    <Button size={size} variant={variant} data-testid={`button-new-folder-${tid}`}>
      <FolderPlus className="h-4 w-4 mr-1" /> New {scopeLabel}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New {scopeLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Folder Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ORG > T1 ORGS"
              data-testid={`input-new-folder-name-${tid}`}
            />
          </div>
          <div>
            <Label className="text-xs">Sort Order</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              data-testid={`input-new-folder-sort-${tid}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} data-testid={`button-new-folder-cancel-${tid}`}>Cancel</Button>
          <Button
            onClick={() => create.mutate({
              name: name.trim(),
              sortOrder: Number(sortOrder) || 0,
              parentId: parentId ?? null,
              gameId: gameId ?? null,
            })}
            disabled={!name.trim() || create.isPending}
            data-testid={`button-new-folder-save-${tid}`}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Custom Folders (recursive) ──────────────────────────────────────────────

function CustomFoldersSection({
  folders,
  onSelect,
  onCopy,
  copiedUrl,
  defaultOpen,
}: {
  folders: CustomFolder[];
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
  defaultOpen: boolean;
}) {
  if (folders.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide px-1">
        <Folder className="h-3.5 w-3.5" />
        <span>Custom Folders</span>
      </div>
      {folders.map((f) => (
        <CustomFolderCard
          key={f.id}
          folder={f}
          onSelect={onSelect}
          onCopy={onCopy}
          copiedUrl={copiedUrl}
          defaultOpen={defaultOpen}
          depth={0}
        />
      ))}
    </div>
  );
}

function CustomFolderCard({
  folder,
  onSelect,
  onCopy,
  copiedUrl,
  defaultOpen,
  depth,
}: {
  folder: CustomFolder;
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
  defaultOpen: boolean;
  depth: number;
}) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canUpload = hasPermission("upload_media" as Permission) || hasPermission("manage_media" as Permission);
  const canDelete = hasPermission("delete_media" as Permission) || hasPermission("manage_media" as Permission);
  const [open, setOpen] = useState(defaultOpen);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subfolders = folder.subfolders ?? [];
  const totalItems = folder.items.length + countAll(subfolders);

  const addItem = useMutation({
    mutationFn: async (body: { folderId: string; name: string; url: string; sortOrder: number }) =>
      apiRequest("POST", "/api/media-items", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media-library"] });
      toast({ title: "Image added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteFolder = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/media-folders/${folder.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media-library"] });
      toast({ title: "Folder deleted" });
      setConfirmDelete(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/media-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media-library"] });
      toast({ title: "Image removed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card
      className="p-3"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 12}px` : undefined }}
      data-testid={`card-custom-folder-${folder.id}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-start h-auto py-2 min-w-0"
              data-testid={`toggle-custom-folder-${folder.id}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-semibold truncate">{folder.name}</span>
                <Badge variant="secondary">{totalItems}</Badge>
              </span>
            </Button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1 shrink-0">
            <NewFolderButton
              scopeLabel="Subfolder"
              parentId={folder.id}
              variant="ghost"
              iconOnly
              testIdSuffix={`sub-${folder.id}`}
            />
            {canUpload && (
              <ObjectUploader
                buttonSize="sm"
                buttonVariant="outline"
                multiple
                onUploaded={(r) => {
                  const url = r.url;
                  // Prefer the original filename (minus extension) over the
                  // randomized object-storage path so the gallery thumbnails
                  // are actually identifiable when batch-uploading.
                  const original = r.file?.name?.replace(/\.[^.]+$/, "");
                  const fallback = url.split("/").pop()?.replace(/\.[^.]+$/, "") || "image";
                  // Use a small monotonic increment per batch so files keep
                  // their pick order. NEVER stamp with Date.now() — the
                  // sort_order column is a Postgres int4 and overflows past
                  // 2^31-1 (2147483647), which trips drizzle-zod validation
                  // and rejects the upload as "too_big".
                  addItem.mutate({
                    folderId: folder.id,
                    name: original || fallback,
                    url,
                    sortOrder: folder.items.length + r.index,
                  });
                }}
                onError={(msg) => toast({ title: "Upload failed", description: msg, variant: "destructive" })}
              >
                <span className="flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Upload</span>
              </ObjectUploader>
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                data-testid={`button-delete-folder-${folder.id}`}
                title="Delete folder"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CollapsibleContent>
          {folder.items.length === 0 && subfolders.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3 px-2">
              Empty — use Upload to add an image, or the folder icon to add a subfolder.
            </div>
          ) : (
            <>
              {folder.items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2">
                  {folder.items.map((it) => (
                    <CustomImageTile
                      key={it.id}
                      item={it}
                      onSelect={onSelect}
                      onCopy={onCopy}
                      copied={copiedUrl === it.url}
                      onDelete={() => deleteItem.mutate(it.id)}
                      testId={`tile-custom-${folder.id}-${it.id}`}
                    />
                  ))}
                </div>
              )}
              {subfolders.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {subfolders.map((sub) => (
                    <CustomFolderCard
                      key={sub.id}
                      folder={sub}
                      onSelect={onSelect}
                      onCopy={onCopy}
                      copiedUrl={copiedUrl}
                      defaultOpen={defaultOpen}
                      depth={depth + 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{folder.name}", any subfolders, and all {totalItems} image(s) inside.
              The underlying uploaded files will remain in object storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-delete-folder-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFolder.mutate()}
              data-testid="button-confirm-delete-folder"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CustomImageTile({
  item, onSelect, onCopy, copied, onDelete, testId,
}: {
  item: { id: string; name: string; url: string };
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copied: boolean;
  onDelete: () => void;
  testId: string;
}) {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission("delete_media" as Permission) || hasPermission("manage_media" as Permission);
  const handleClick = () => {
    if (onSelect) onSelect(item.url);
    else onCopy(item.url);
  };
  return (
    <Card className="overflow-hidden p-2 flex flex-col gap-1 hover-elevate cursor-pointer" data-testid={testId}>
      <button
        type="button"
        onClick={handleClick}
        className="aspect-square overflow-hidden rounded-sm bg-muted flex items-center justify-center"
        title={onSelect ? "Use this image" : "Copy URL"}
      >
        <img
          src={item.url}
          alt={item.name}
          className="object-cover w-full h-full"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </button>
      <div className="text-xs font-medium truncate" title={item.name}>{item.name}</div>
      <div className="flex items-center gap-1">
        <code className="text-[10px] text-muted-foreground truncate flex-1" title={item.url}>{item.url}</code>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); onCopy(item.url); }}
          data-testid={`button-copy-${testId}`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
        {canDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            data-testid={`button-delete-${testId}`}
            title="Remove image"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── Built-in (game-scoped) sections ──────────────────────────────────────────

function GameSection({
  game,
  categories,
  onSelect,
  onCopy,
  copiedUrl,
  hideGameHeader,
  defaultCategoryOpen,
  showFolderManagement,
}: {
  game: MediaGame;
  categories: MediaCategoryKey[];
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
  hideGameHeader: boolean;
  defaultCategoryOpen: boolean;
  showFolderManagement: boolean;
}) {
  const [open, setOpen] = useState(hideGameHeader);
  const built = categories.reduce((acc, k) => acc + game.categories[k].length, 0);
  const customs = game.customFolders ?? [];
  const total = built + countAll(customs);
  if (total === 0) return null;

  const body = (
    <div className="flex flex-col gap-2 pt-2">
      {showFolderManagement && (
        <div className="flex items-center justify-end px-1">
          <NewFolderButton
            scopeLabel={`Folder in ${game.gameName}`}
            gameId={game.gameId}
            size="sm"
            variant="outline"
            testIdSuffix={`game-${game.gameSlug}`}
          />
        </div>
      )}
      {customs.length > 0 && (
        <div className="flex flex-col gap-2">
          {customs.map((f) => (
            <CustomFolderCard
              key={f.id}
              folder={f}
              onSelect={onSelect}
              onCopy={onCopy}
              copiedUrl={copiedUrl}
              defaultOpen={defaultCategoryOpen}
              depth={0}
            />
          ))}
        </div>
      )}
      {categories.map((k) => (
        <CategorySection
          key={k}
          gameSlug={game.gameSlug}
          categoryKey={k}
          items={game.categories[k]}
          onSelect={onSelect}
          onCopy={onCopy}
          copiedUrl={copiedUrl}
          defaultOpen={defaultCategoryOpen}
        />
      ))}
    </div>
  );

  if (hideGameHeader) return body;

  return (
    <Card className="p-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-2"
            data-testid={`toggle-game-${game.gameSlug}`}
          >
            <span className="flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-semibold">{game.gameName}</span>
              <Badge variant="secondary">{total}</Badge>
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>{body}</CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CategorySection({
  gameSlug,
  categoryKey,
  items,
  onSelect,
  onCopy,
  copiedUrl,
  defaultOpen,
}: {
  gameSlug: string;
  categoryKey: MediaCategoryKey;
  items: MediaItem[];
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-auto py-1"
          data-testid={`toggle-category-${gameSlug}-${categoryKey}`}
        >
          {open ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
          <span>{CATEGORY_LABELS[categoryKey]}</span>
          <Badge variant="secondary" className="ml-2">{items.length}</Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2">
          {items.map((it) => (
            <ImageTile
              key={`${categoryKey}-${it.id}`}
              item={it}
              onSelect={onSelect}
              onCopy={onCopy}
              copied={copiedUrl === it.url}
              testId={`tile-${gameSlug}-${categoryKey}-${it.id}`}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ImageTile({
  item,
  onSelect,
  onCopy,
  copied,
  testId,
}: {
  item: MediaItem;
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copied: boolean;
  testId: string;
}) {
  const handleClick = () => {
    if (onSelect) onSelect(item.url);
    else onCopy(item.url);
  };
  return (
    <Card className="overflow-hidden p-2 flex flex-col gap-1 hover-elevate cursor-pointer" data-testid={testId}>
      <button
        type="button"
        onClick={handleClick}
        className="aspect-square overflow-hidden rounded-sm bg-muted flex items-center justify-center"
        title={onSelect ? "Use this image" : "Copy URL"}
      >
        <img
          src={item.url}
          alt={item.name}
          className="object-cover w-full h-full"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </button>
      <div className="text-xs font-medium truncate" title={item.name}>{item.name}</div>
      <div className="flex items-center gap-1">
        <code className="text-[10px] text-muted-foreground truncate flex-1" title={item.url}>{item.url}</code>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); onCopy(item.url); }}
          data-testid={`button-copy-${testId}`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </Card>
  );
}
