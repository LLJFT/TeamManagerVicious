import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Copy, Check, Search, ImageIcon } from "lucide-react";

export type MediaItem = { id: string; name: string; url: string; rosterId: string | null };
export type MediaCategoryKey = "maps" | "heroes" | "opponents" | "scoreboards";
export type MediaGame = {
  gameId: string;
  gameSlug: string;
  gameName: string;
  gameIconUrl: string | null;
  sortOrder: number;
  categories: Record<MediaCategoryKey, MediaItem[]>;
};

const CATEGORY_LABELS: Record<MediaCategoryKey, string> = {
  maps: "Maps",
  heroes: "Heroes",
  opponents: "Opponents",
  scoreboards: "Scoreboard Uploads",
};
const CATEGORY_ORDER: MediaCategoryKey[] = ["maps", "heroes", "opponents", "scoreboards"];

interface BrowserProps {
  /** When provided, only show this game and skip the per-game collapsible. */
  filterGameId?: string;
  /** When set, clicking an image calls this with the URL (e.g. fill into form). */
  onSelect?: (url: string) => void;
  /** Default state for category collapsibles. */
  defaultOpen?: boolean;
  /** Limit the visible categories. */
  categories?: MediaCategoryKey[];
  /**
   * When true (default), wraps the list in a height-capped ScrollArea — appropriate
   * for dialog usage. Set false on full-page usage so the page scrolls naturally.
   */
  capHeight?: boolean;
}

export function MediaLibraryBrowser({
  filterGameId,
  onSelect,
  defaultOpen = false,
  categories = CATEGORY_ORDER,
  capHeight = true,
}: BrowserProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data: library = [], isLoading } = useQuery<MediaGame[]>({
    queryKey: ["/api/media-library"],
  });

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
      }))
      .filter(g =>
        Object.values(g.categories).some(arr => arr.length > 0),
      );
  }, [library, search, filterGameId]);

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

  return (
    <div className="flex flex-col gap-3" data-testid="media-library-browser">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by image name…"
          className="pl-8"
          data-testid="input-media-search"
        />
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground" data-testid="text-media-loading">Loading library…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2" data-testid="text-media-empty">
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm">No images found.</span>
        </div>
      ) : (
        (() => {
          const list = (
            <div className="flex flex-col gap-3">
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

function GameSection({
  game,
  categories,
  onSelect,
  onCopy,
  copiedUrl,
  hideGameHeader,
  defaultCategoryOpen,
}: {
  game: MediaGame;
  categories: MediaCategoryKey[];
  onSelect?: (url: string) => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
  hideGameHeader: boolean;
  defaultCategoryOpen: boolean;
}) {
  const [open, setOpen] = useState(hideGameHeader);
  const total = categories.reduce((acc, k) => acc + game.categories[k].length, 0);
  if (total === 0) return null;

  const body = (
    <div className="flex flex-col gap-2 pt-2">
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
