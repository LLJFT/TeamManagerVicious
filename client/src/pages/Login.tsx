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
import type { SupportedGame } from "@shared/schema";
import { GAME_ABBREVIATIONS } from "@shared/schema";

type RegisterRole = "player" | "staff" | "management";
type RosterType = "first_team" | "academy" | "women";

export default function Login() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register" | "pending">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<RegisterRole>("player");
  const [selectedRosterType, setSelectedRosterType] = useState<RosterType>("first_team");
  const [loading, setLoading] = useState(false);

  const needsGameSelection = selectedRole === "player" || selectedRole === "staff";

  const { data: allGames = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
    enabled: mode === "register",
  });

  const toggleGame = (gameId: string) => {
    if (selectedRole === "player") {
      setSelectedGames(prev => prev.includes(gameId) ? [] : [gameId]);
    } else {
      setSelectedGames(prev =>
        prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
      );
    }
  };

  const handleRoleChange = (r: RegisterRole) => {
    setSelectedRole(r);
    setSelectedGames([]);
    setSelectedRosterType("first_team");
  };

  const selectedGameSlug = needsGameSelection && selectedGames.length > 0
    ? allGames.find(g => g.id === selectedGames[0])?.slug || ""
    : "";
  const gameAbbrev = selectedGameSlug ? (GAME_ABBREVIATIONS[selectedGameSlug] || selectedGameSlug.toUpperCase()) : "";
  const rosterSuffix = selectedRosterType === "academy" ? `${gameAbbrev}_AC` : selectedRosterType === "women" ? `${gameAbbrev}_W` : gameAbbrev;
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
        await register(username, password, needsGameSelection ? selectedGames : [], selectedRole, needsGameSelection ? selectedRosterType : undefined);
        setMode("pending");
      }
    } catch (err: any) {
      const msg = err?.message || "An error occurred";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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

                {needsGameSelection && selectedGames.length > 0 && (
                  <div className="space-y-2">
                    <Label>Roster</Label>
                    <Select value={selectedRosterType} onValueChange={(v) => setSelectedRosterType(v as RosterType)}>
                      <SelectTrigger data-testid="select-roster-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first_team">First Team</SelectItem>
                        <SelectItem value="academy">Academy</SelectItem>
                        <SelectItem value="women">Women</SelectItem>
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
                (mode === "register" && needsGameSelection && selectedGames.length === 0)
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
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setMode("register")}
                  data-testid="button-switch-register"
                >
                  Register
                </button>
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
