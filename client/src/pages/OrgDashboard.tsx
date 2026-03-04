import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, CheckCircle, XCircle, Users, Trophy, Clock, KeyRound, ChevronDown, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportedGame } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface PendingAssignment {
  id: string;
  userId: string;
  gameId: string;
  rosterId?: string;
  assignedRole: string;
  status: string;
  user?: { username: string; orgRole: string };
  gameName?: string;
  rosterName?: string;
}

export default function OrgDashboard() {
  const { toast } = useToast();
  const [expandedRosters, setExpandedRosters] = useState<Set<string>>(new Set());
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});

  const { data: pending = [] } = useQuery<PendingAssignment[]>({
    queryKey: ["/api/game-assignments/pending"],
    queryFn: async () => {
      const res = await fetch("/api/game-assignments/pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/org-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/org-dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allGames = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: passwordResets = [] } = useQuery<any[]>({
    queryKey: ["/api/password-reset-requests"],
    queryFn: async () => {
      const res = await fetch("/api/password-reset-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/game-assignments/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-assignments/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: "User approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/game-assignments/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-assignments/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-dashboard"] });
      toast({ title: "User rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resolveResetMutation = useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId?: string }) => {
      if (userId) {
        const res = await apiRequest("PUT", `/api/users/${userId}/reset-password`);
        const data = await res.json();
        setTempPasswords(prev => ({ ...prev, [requestId]: data.tempPassword }));
      }
      await apiRequest("POST", `/api/password-reset-requests/${requestId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/password-reset-requests"] });
      toast({ title: "Password reset handled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleRoster = (id: string) => {
    setExpandedRosters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const rosterSummaries = dashboard?.rosterSummaries || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader className="pb-3 gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pending Registrations
              <Badge variant="destructive">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`row-pending-${p.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.user?.username || "Unknown"}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{p.gameName || allGames.find(g => g.id === p.gameId)?.name || "Unknown"}</Badge>
                    {p.rosterName && <Badge variant="outline" className="text-xs">{p.rosterName}</Badge>}
                    <Badge variant="outline" className="text-xs">{p.assignedRole}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${p.id}`}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(p.id)} disabled={rejectMutation.isPending} data-testid={`button-reject-${p.id}`}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {passwordResets.filter((r: any) => r.status === "pending").length > 0 && (
        <Card>
          <CardHeader className="pb-3 gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Password Reset Requests
              <Badge variant="destructive">{passwordResets.filter((r: any) => r.status === "pending").length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {passwordResets.filter((r: any) => r.status === "pending").map((req: any) => (
              <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`row-pw-reset-${req.id}`}>
                <div>
                  <p className="font-medium">{req.username}</p>
                  <p className="text-xs text-muted-foreground">{req.created_at && new Date(req.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tempPasswords[req.id] && (
                    <span className="font-mono text-sm font-bold" data-testid={`text-temp-pw-${req.id}`}>{tempPasswords[req.id]}</span>
                  )}
                  <Button
                    size="sm"
                    onClick={() => resolveResetMutation.mutate({ requestId: req.id })}
                    disabled={resolveResetMutation.isPending}
                    data-testid={`button-resolve-reset-${req.id}`}
                  >
                    <KeyRound className="h-4 w-4 mr-1" />
                    Generate Reset
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Roster Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rosterSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roster data available</p>
          ) : (
            rosterSummaries.map((rs: any) => {
              const game = allGames.find(g => g.id === rs.gameId);
              const isExpanded = expandedRosters.has(rs.rosterId || rs.gameId);
              return (
                <div key={rs.rosterId || rs.gameId} className="border rounded-md p-3" data-testid={`card-roster-${rs.rosterId || rs.gameId}`}>
                  <div
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onClick={() => toggleRoster(rs.rosterId || rs.gameId)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{game?.name || "Unknown"}</span>
                      {rs.rosterName && <Badge variant="secondary" className="text-xs">{rs.rosterName}</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{rs.memberCount || 0} members</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                  {isExpanded && rs.members && rs.members.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {rs.members.map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-sm p-1">
                          <span>{m.username}</span>
                          <Badge variant="outline" className="text-xs">{m.role || "Member"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
