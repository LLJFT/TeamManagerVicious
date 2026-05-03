import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, LogIn, Clock, Check, Lock } from "lucide-react";
import { VicLogo } from "@/components/VicLogo";
import type { SupportedGame, Roster } from "@shared/schema";
import { GAME_ABBREVIATIONS } from "@shared/schema";
import { LanguageSelector } from "@/components/LanguageSelector";

type RegisterRole = "player" | "staff" | "management";

export default function Login() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register" | "pending" | "forgot" | "forgot-sent">("login");
  const [forgotUsername, setForgotUsername] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<RegisterRole>("player");
  const [selectedRosterId, setSelectedRosterId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const needsGameSelection = selectedRole === "player" || selectedRole === "staff";

  const { data: allGames = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
    enabled: mode === "register",
  });

  const { data: allRostersMap = {} } = useQuery<Record<string, Roster[]>>({
    queryKey: ["/api/public-rosters"],
    enabled: mode === "register",
  });

  const selectedGameRosters = selectedGames.length > 0 ? (allRostersMap[selectedGames[0]] || []) : [];

  const toggleGame = (gameId: string) => {
    if (selectedRole === "player") {
      setSelectedGames(prev => prev.includes(gameId) ? [] : [gameId]);
    } else {
      setSelectedGames(prev =>
        prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
      );
    }
    setSelectedRosterId("");
  };

  const handleRoleChange = (r: RegisterRole) => {
    setSelectedRole(r);
    setSelectedGames([]);
    setSelectedRosterId("");
  };

  const selectedGameSlug = needsGameSelection && selectedGames.length > 0
    ? allGames.find(g => g.id === selectedGames[0])?.slug || ""
    : "";
  const gameAbbrev = selectedGameSlug ? (GAME_ABBREVIATIONS[selectedGameSlug] || selectedGameSlug.toUpperCase()) : "";
  const selectedRosterObj = selectedRosterId ? selectedGameRosters.find(r => r.id === selectedRosterId) : null;
  const rosterSuffix = selectedRosterObj
    ? (selectedRosterObj.name !== "Team 1" ? `${gameAbbrev}_T${selectedRosterObj.sortOrder !== undefined ? selectedRosterObj.sortOrder + 1 : ''}` : gameAbbrev)
    : gameAbbrev;
  const previewUsername = username.trim() && gameAbbrev ? `${username.trim()}_${rosterSuffix}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else if (mode === "register") {
        if (needsGameSelection && selectedGames.length === 0) {
          toast({ title: t("login.toastSelectGame"), variant: "destructive" });
          setLoading(false);
          return;
        }
        await register(username, password, needsGameSelection ? selectedGames : [], selectedRole, needsGameSelection && selectedRosterId ? selectedRosterId : undefined);
        setMode("pending");
      }
    } catch (err: any) {
      const msg = err?.message || t("login.toastErrorGeneric");
      toast({ title: t("login.toastError"), description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("login.toastFailedRequest"));
      }
      setMode("forgot-sent");
    } catch (err: any) {
      toast({ title: t("login.toastError"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const LangCorner = () => (
    <div className="absolute top-3 end-3">
      <LanguageSelector />
    </div>
  );

  if (mode === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <LangCorner />
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-forgot-title">{t("login.forgotTitle")}</CardTitle>
            <CardDescription>{t("login.forgotDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-username">{t("login.usernameLabel")}</Label>
                <Input
                  id="forgot-username"
                  data-testid="input-forgot-username"
                  placeholder={t("login.enterUsernamePh")}
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !forgotUsername.trim()} data-testid="button-forgot-submit">
                {loading ? t("login.forgotSubmitting") : t("login.forgotSubmit")}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button type="button" className="text-sm text-primary underline" onClick={() => setMode("login")} data-testid="button-back-to-login-forgot">
                {t("login.backToSignIn")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "forgot-sent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <LangCorner />
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-forgot-sent-title">{t("login.forgotSentTitle")}</CardTitle>
            <CardDescription>{t("login.forgotSentDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => { setMode("login"); setForgotUsername(""); }} data-testid="button-back-to-login-after-forgot">
              {t("login.backToSignIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <LangCorner />
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-pending-title">{t("login.pendingTitle")}</CardTitle>
            <CardDescription>{t("login.pendingDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">{t("login.pendingNotified")}</p>
            <Button
              variant="outline"
              onClick={() => {
                setMode("login");
                setUsername("");
                setPassword("");
                setSelectedGames([]);
              }}
              data-testid="button-back-to-login"
            >
              {t("login.backToSignIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <LangCorner />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex flex-col items-center gap-2">
            <VicLogo size={56} className="text-primary" />
            <span className="text-2xl font-extrabold tracking-[0.18em] lowercase" data-testid="text-brand-bootcamp">the bootcamp</span>
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Esports · Team Platform</span>
          </div>
          <CardTitle data-testid="text-auth-title">
            {mode === "login" ? t("login.signInTitle") : t("login.registerTitle")}
          </CardTitle>
          <CardDescription>
            {mode === "login" ? t("login.signInDesc") : t("login.registerDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("login.usernameLabel")}</Label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder={t("login.usernamePh")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("login.passwordLabel")}</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder={t("login.passwordPh")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label>{t("login.roleLabel")}</Label>
                  <Select value={selectedRole} onValueChange={(v) => handleRoleChange(v as RegisterRole)}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">{t("login.rolePlayer")}</SelectItem>
                      <SelectItem value="staff">{t("login.roleStaff")}</SelectItem>
                      <SelectItem value="management">{t("login.roleManagement")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedRole === "management" && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>{t("login.managementNote")}</span>
                  </div>
                )}

                {needsGameSelection && (
                  <div className="space-y-2">
                    <Label>
                      {selectedRole === "player" ? t("login.selectGameOne") : t("login.selectGames")}
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-auto border rounded-md p-2">
                      {allGames.map(game => {
                        const isSelected = selectedGames.includes(game.id);
                        return (
                          <button
                            key={game.id}
                            type="button"
                            className={`flex items-center gap-1.5 p-1.5 rounded-md text-xs text-left transition-colors ${
                              isSelected ? "bg-primary/10 text-primary" : "hover-elevate"
                            }`}
                            onClick={() => toggleGame(game.id)}
                            data-testid={`toggle-game-${game.slug}`}
                          >
                            {isSelected && <Check className="h-3 w-3 flex-shrink-0" />}
                            <span className="truncate">{game.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedGames.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("login.gamesSelected", { count: selectedGames.length })}
                      </p>
                    )}
                  </div>
                )}

                {needsGameSelection && selectedGames.length > 0 && selectedGameRosters.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t("login.rosterLabel")}</Label>
                    <Select value={selectedRosterId} onValueChange={setSelectedRosterId}>
                      <SelectTrigger data-testid="select-roster-type">
                        <SelectValue placeholder={t("login.rosterPh")} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedGameRosters.map(roster => (
                          <SelectItem key={roster.id} value={roster.id}>{roster.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {previewUsername && (
                  <div className="p-3 rounded-md bg-muted/50 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{t("login.displayName")}</span>
                      <span className="font-medium" data-testid="text-username-preview">{previewUsername}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("login.loginWithOriginal")} <strong>{username.trim()}</strong>
                    </p>
                  </div>
                )}
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                !username.trim() ||
                !password.trim() ||
                (mode === "register" && needsGameSelection && selectedGames.length === 0) ||
                (mode === "register" && needsGameSelection && selectedGames.length > 0 && selectedGameRosters.length > 0 && !selectedRosterId)
              }
              data-testid="button-auth-submit"
            >
              {loading ? (
                t("login.pleaseWait")
              ) : mode === "login" ? (
                <><LogIn className="me-2 h-4 w-4" /> {t("login.signInBtn")}</>
              ) : (
                <><UserPlus className="me-2 h-4 w-4" /> {t("login.registerBtn")}</>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
            {mode === "login" ? (
              <>
                <div>
                  {t("login.needAccount")}{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setMode("register")}
                    data-testid="button-switch-register"
                  >
                    {t("login.registerLink")}
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setMode("forgot")}
                    data-testid="button-forgot-password"
                  >
                    {t("login.forgotLink")}
                  </button>
                </div>
              </>
            ) : (
              <>
                {t("login.alreadyHave")}{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setMode("login")}
                  data-testid="button-switch-login"
                >
                  {t("login.signInBtn")}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
