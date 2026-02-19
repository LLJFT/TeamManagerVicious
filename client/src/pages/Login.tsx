import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, LogIn } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password);
        toast({
          title: "Registration submitted",
          description: "Your account is pending approval by an admin.",
        });
        setMode("login");
        setUsername("");
        setPassword("");
      }
    } catch (err: any) {
      const msg = err?.message || "An error occurred";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle data-testid="text-auth-title">
            {mode === "login" ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Enter your credentials to access the team manager"
              : "Register a new account (requires admin approval)"}
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
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !username.trim() || !password.trim()}
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
