import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, LogIn, Clock, Check, Lock } from "lucide-react";
import type { SupportedGame, Roster } from "@shared/schema";
import { GAME_ABBREVIATIONS } from "@shared/schema";

type RegisterRole = "player" | "staff" | "management";

export default function Login() {
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
    ? (selectedRosterObj.slug === "academy" ? `${gameAbbrev}_AC` : selectedRosterObj.slug === "women" ? `${gameAbbrev}_W` : gameAbbrev)
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
          toast({ title: "Select at least one game", variant: "destructive" });
          setLoading(false);
          return;
        }
        await register(username, password, needsGameSelection ? selectedGames : [], selectedRole, needsGameSelection && selectedRosterId ? selectedRosterId : undefined);
        setMode("pending");
      }
    } catch (err: any) {
      const msg = err?.message || "An error occurred";
      toast({ title: "Error", description: msg, variant: "destructive" });
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
        throw new Error(data.message || "Failed to submit request");
      }
      setMode("forgot-sent");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-forgot-title">Forgot Password</CardTitle>
            <CardDescription>
              Enter your username and an admin will reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-username">Username</Label>
                <Input
                  id="forgot-username"
                  data-testid="input-forgot-username"
                  placeholder="Enter your username"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !forgotUsername.trim()} data-testid="button-forgot-submit">
                {loading ? "Submitting..." : "Request Password Reset"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button type="button" className="text-sm text-primary underline" onClick={() => setMode("login")} data-testid="button-back-to-login-forgot">
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "forgot-sent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-forgot-sent-title">Request Submitted</CardTitle>
            <CardDescription>
              Your password reset request has been submitted. An admin will generate a new temporary password for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => { setMode("login"); setForgotUsername(""); }} data-testid="button-back-to-login-after-forgot">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle data-testid="text-pending-title">Request Under Review</CardTitle>
            <CardDescription>
              Your registration has been submitted. An admin or game manager will review your request shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              You will be notified once your access is approved.
            </p>
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
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle data-testid="text-auth-title">
            {mode === "login" ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Enter your credentials to access the platform"
              : "Register for access to the platform"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={(v) => handleRoleChange(v as RegisterRole)}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedRole === "management" && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>Management gets access to all active games after approval.</span>
                  </div>
                )}

                {needsGameSelection && (
                  <div className="space-y-2">
                    <Label>
                      {selectedRole === "player" ? "Select Game (choose one)" : "Select Game(s)"}
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
                      <p className="text-xs text-muted-foreground">{selectedGames.length} game(s) selected</p>
                    )}
                  </div>
                )}

                {needsGameSelection && selectedGames.length > 0 && selectedGameRosters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Roster</Label>
                    <Select value={selectedRosterId} onValueChange={setSelectedRosterId}>
                      <SelectTrigger data-testid="select-roster-type">
                        <SelectValue placeholder="Select a roster" />
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
                      <span className="text-muted-foreground">Display name:</span>
                      <span className="font-medium" data-testid="text-username-preview">{previewUsername}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">You will log in with your original username: <strong>{username.trim()}</strong></p>
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
                "Please wait..."
              ) : mode === "login" ? (
                <><LogIn className="mr-2 h-4 w-4" /> Sign In</>
              ) : (
                <><UserPlus className="mr-2 h-4 w-4" /> Register</>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
            {mode === "login" ? (
              <>
                <div>
                  Need an account?{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setMode("register")}
                    data-testid="button-switch-register"
                  >
                    Register
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setMode("forgot")}
                    data-testid="button-forgot-password"
                  >
                    Forgot Password?
                  </button>
                </div>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setMode("login")}
                  data-testid="button-switch-login"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
