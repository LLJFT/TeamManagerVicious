import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Copy, Layers, ArrowLeft } from "lucide-react";
import type { GameTemplate, SupportedGame } from "@shared/schema";
import { useTranslation } from "react-i18next";

const GAME_ABBR: Record<string, string> = {
  overwatch: "OW",
  "marvel-rivals": "MR",
  valorant: "VAL",
  "rainbow-six-siege": "R6",
};

function makeCode(slug: string): string {
  const abbr = (GAME_ABBR[slug] || slug.slice(0, 3)).toUpperCase();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${abbr}-${suffix}`;
}

export default function GameTemplatesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  // Hooks must run unconditionally — gating below.
  const { data: templates = [], isLoading } = useQuery<GameTemplate[]>({
    queryKey: ["/api/game-templates"],
    enabled: user?.orgRole === "super_admin",
  });

  const { data: games = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const gameById = new Map(games.map(g => [g.id, g]));

  const createMutation = useMutation({
    mutationFn: async (vars: { name: string; gameId: string }) => {
      const game = gameById.get(vars.gameId);
      if (!game) throw new Error(t("templates.toasts.pickGame"));
      const code = makeCode(game.slug);
      const res = await apiRequest("POST", "/api/game-templates", {
        name: vars.name,
        gameId: vars.gameId,
        code,
        config: {},
      });
      return await res.json();
    },
    onSuccess: (tpl: GameTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-templates"] });
      toast({ title: t("templates.toasts.created"), description: `"${tpl.name}" — ${tpl.code}` });
      setCreateOpen(false);
      navigate(`/game-templates/${tpl.id}`);
    },
    onError: (err: any) => {
      toast({ title: t("templates.toasts.couldNotCreate"), description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/game-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-templates"] });
      toast({ title: t("templates.toasts.deleted") });
    },
    onError: (err: any) => {
      toast({ title: t("templates.toasts.deleteFailed"), description: err.message, variant: "destructive" });
    },
  });

  if (user?.orgRole !== "super_admin") {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive font-medium" data-testid="text-access-denied">
              Game Templates are restricted to Super Admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Layers className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-game-templates">{t("templates.title")}</h1>
            <p className="text-sm text-muted-foreground">
              Reusable per-game configuration packs. Apply by code on a roster's Reset tab.
            </p>
          </div>
        </div>
        <CreateTemplateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          games={games}
          onCreate={(name, gameId) => createMutation.mutate({ name, gameId })}
          isPending={createMutation.isPending}
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm" data-testid="text-loading">{t("templates.loading")}</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground" data-testid="text-empty">
            No templates yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(tpl => {
            const game = gameById.get(tpl.gameId);
            return (
              <Card key={tpl.id} className="hover-elevate" data-testid={`card-template-${tpl.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base" data-testid={`text-name-${tpl.id}`}>{tpl.name}</CardTitle>
                    {game && <Badge variant="outline" data-testid={`badge-game-${tpl.id}`}>{game.name}</Badge>}
                  </div>
                  <CardDescription className="font-mono text-xs flex items-center gap-1">
                    <span data-testid={`text-code-${tpl.id}`}>{tpl.code}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => {
                        navigator.clipboard.writeText(tpl.code);
                        toast({ title: t("templates.toasts.codeCopied"), description: tpl.code });
                      }}
                      data-testid={`button-copy-${tpl.id}`}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Button asChild size="sm" variant="default" data-testid={`button-edit-${tpl.id}`}>
                    <Link href={`/game-templates/${tpl.id}`}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid={`button-delete-${tpl.id}`}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("templates.deleteThis")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{tpl.name}" ({tpl.code}) will be removed permanently. Rosters that
                          previously had this template applied keep their existing config.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(tpl.id)}
                          data-testid={`button-confirm-delete-${tpl.id}`}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTemplateDialog({
  open, onOpenChange, games, onCreate, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  games: SupportedGame[];
  onCreate: (name: string, gameId: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setName(""); setGameId(""); } }}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("templates.newTemplate")}</DialogTitle>
          <DialogDescription>Pick the game and a friendly name. You'll edit the config on the next page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="tpl-name">{t("templates.name")}</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("templates.namePlaceholder")}
              data-testid="input-template-name"
            />
          </div>
          <div>
            <Label>{t("templates.game")}</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger data-testid="select-template-game">
                <SelectValue placeholder={t("templates.pickGame")} />
              </SelectTrigger>
              <SelectContent>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id} data-testid={`option-game-${g.slug}`}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onCreate(name.trim(), gameId)}
            disabled={!name.trim() || !gameId || isPending}
            data-testid="button-confirm-create"
          >
            {isPending ? t("templates.creating") : t("templates.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
