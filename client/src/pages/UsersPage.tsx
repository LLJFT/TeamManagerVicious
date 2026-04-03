import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Ban, Trash2, LogOut, Pencil, KeyRound, UserPlus, Search, Shield, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { orgRoleLabels, type OrgRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  username: string;
  displayName?: string;
  orgRole: string;
  status: string;
  lastSeen?: string;
  lastUserAgent?: string;
  role?: { id: string; name: string; permissions: string[] } | null;
  gameAssignments: { id: string; gameId: string; gameName: string; rosterId?: string; rosterName?: string; status: string }[];
}

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newOrgRole, setNewOrgRole] = useState("player");
  const [renamingUser, setRenamingUser] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [tempPasswordUser, setTempPasswordUser] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState("");

  const { data: allUsers = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/all-users"],
    queryFn: async () => {
      const res = await fetch("/api/all-users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const filteredUsers = allUsers.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.displayName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; selectedRole?: string }) => {
      await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      setShowCreateForm(false);
      setNewUsername("");
      setNewPassword("");
      setNewOrgRole("player");
      toast({ title: "Account created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const banMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "ban" | "unban" }) => {
      await apiRequest("PUT", `/api/users/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: "User status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: "User deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/users/${id}/force-logout`);
    },
    onSuccess: () => {
      toast({ title: "User logged out" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, username }: { id: string; username: string }) => {
      await apiRequest("PUT", `/api/users/${id}/rename`, { username });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      setRenamingUser(null);
      setNewName("");
      toast({ title: "Username updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, orgRole }: { id: string; orgRole: string }) => {
      await apiRequest("PUT", `/api/users/${id}/org-role`, { orgRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/users/${id}/reset-password`);
      return res.json();
    },
    onSuccess: (data, id) => {
      setTempPasswordUser(id);
      setTempPassword(data.tempPassword);
      toast({ title: "Password reset" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveAllAssignmentsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const user = allUsers.find(u => u.id === userId);
      if (!user) return;
      const pendingAssignments = user.gameAssignments.filter(a => a.status === "pending");
      for (const assignment of pendingAssignments) {
        await apiRequest("POST", `/api/game-assignments/${assignment.id}/approve`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: "User approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge variant="default" className="text-xs">Active</Badge>;
    if (status === "banned") return <Badge variant="destructive" className="text-xs">Banned</Badge>;
    if (status === "pending") return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  if (isLoading) {
    return <div className="p-6"><p className="text-muted-foreground">Loading users...</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-users-title">User Management</h1>
          <Badge variant="secondary">{allUsers.length}</Badge>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-create-user">
          <UserPlus className="h-4 w-4 mr-2" />
          Create Account
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3 gap-2">
            <CardTitle className="text-base">Create New Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                data-testid="input-new-username"
              />
              <Input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
              <Select value={newOrgRole} onValueChange={setNewOrgRole}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="coach_analyst">Staff</SelectItem>
                  <SelectItem value="game_manager">Game Manager</SelectItem>
                  <SelectItem value="org_admin">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createUserMutation.mutate({ username: newUsername, password: newPassword, selectedRole: newOrgRole })}
                disabled={!newUsername || !newPassword || createUserMutation.isPending}
                data-testid="button-submit-create-user"
              >
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tempPasswordUser && (
        <Card className="border-primary">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium">Temporary Password Generated</p>
                <p className="text-lg font-mono font-bold" data-testid="text-temp-password">{tempPassword}</p>
                <p className="text-xs text-muted-foreground">Share this with the user. They should change it after logging in.</p>
              </div>
              <Button variant="outline" onClick={() => { setTempPasswordUser(null); setTempPassword(""); }}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-users"
        />
      </div>

      <div className="space-y-2">
        {filteredUsers.map(user => (
          <Card key={user.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renamingUser === user.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-[180px]"
                          data-testid={`input-rename-${user.id}`}
                        />
                        <Button size="sm" onClick={() => renameMutation.mutate({ id: user.id, username: newName })} disabled={renameMutation.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRenamingUser(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium" data-testid={`text-username-${user.id}`}>{user.username}</span>
                    )}
                    {getStatusBadge(user.status)}
                    <Badge variant="outline" className="text-xs">
                      {orgRoleLabels[user.orgRole as OrgRole] || user.orgRole}
                    </Badge>
                    {user.role && <Badge variant="secondary" className="text-xs">{user.role.name}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    {user.lastSeen && <span>Last seen: {new Date(user.lastSeen).toLocaleString()}</span>}
                    {user.lastUserAgent && <span>{user.lastUserAgent}</span>}
                    {user.gameAssignments.length > 0 && (
                      <span>Games: {user.gameAssignments.map(a => `${a.gameName}${a.rosterName ? ` (${a.rosterName})` : ""}`).join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {user.status === "pending" && user.gameAssignments.some(a => a.status === "pending") && (
                    <Button
                      size="sm"
                      onClick={() => approveAllAssignmentsMutation.mutate(user.id)}
                      disabled={approveAllAssignmentsMutation.isPending}
                      data-testid={`button-approve-${user.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  )}
                  <Select value={user.orgRole} onValueChange={(value) => changeRoleMutation.mutate({ id: user.id, orgRole: value })}>
                    <SelectTrigger className="w-[140px]" data-testid={`select-role-${user.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="coach_analyst">Staff</SelectItem>
                      <SelectItem value="game_manager">Game Manager</SelectItem>
                      <SelectItem value="org_admin">Management</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Rename"
                    onClick={() => { setRenamingUser(user.id); setNewName(user.username); }}
                    data-testid={`button-rename-${user.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Reset Password"
                    onClick={() => resetPasswordMutation.mutate(user.id)}
                    data-testid={`button-reset-pw-${user.id}`}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Force Logout"
                    onClick={() => forceLogoutMutation.mutate(user.id)}
                    data-testid={`button-force-logout-${user.id}`}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title={user.status === "banned" ? "Unban" : "Ban"}
                    onClick={() => banMutation.mutate({ id: user.id, action: user.status === "banned" ? "unban" : "ban" })}
                    data-testid={`button-ban-${user.id}`}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    onClick={() => { if (confirm(`Delete user "${user.username}"? This cannot be undone.`)) deleteMutation.mutate(user.id); }}
                    data-testid={`button-delete-${user.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
