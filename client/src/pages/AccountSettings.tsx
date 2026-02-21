import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Lock, Save, Monitor, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";

interface SessionInfo {
  sid: string;
  isCurrent: boolean;
  deviceInfo: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}

function SessionsCard() {
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useQuery<SessionInfo[]>({
    queryKey: ["/api/sessions"],
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (sid: string) => {
      const r = await apiRequest("DELETE", `/api/sessions/${sid}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session terminated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Active Sessions
        </CardTitle>
        <CardDescription>Manage your active login sessions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active sessions found</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.sid} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border" data-testid={`session-${session.sid}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{session.deviceInfo || "Unknown device"}</span>
                      {session.isCurrent && <Badge variant="secondary">Current</Badge>}
                    </div>
                    {session.expiresAt && (
                      <span className="text-xs text-muted-foreground">Expires: {new Date(session.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => terminateSessionMutation.mutate(session.sid)}
                    disabled={terminateSessionMutation.isPending}
                    data-testid={`button-terminate-session-${session.sid}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [username, setUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/auth/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Settings updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    if (username.trim() !== user?.username) {
      updateSettingsMutation.mutate({ username: username.trim() });
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast({ title: "Please fill in all password fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 3) {
      toast({ title: "Password must be at least 3 characters", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-border">
          <Link href="/">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Account Settings</h1>
              <p className="text-muted-foreground">Manage your account</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-primary">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{user?.username}</p>
                  <Badge variant="secondary">{user?.role?.name || "Member"}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-settings-username"
                />
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={username.trim() === user?.username || !username.trim() || updateSettingsMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || updateSettingsMutation.isPending}
                data-testid="button-change-password"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            </CardContent>
          </Card>

          <SessionsCard />
        </div>
      </div>
    </div>
  );
}
