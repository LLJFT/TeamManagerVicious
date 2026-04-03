import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, CheckCircle, XCircle, Users, Trophy, Clock,
  KeyRound, ChevronDown, ChevronRight, TrendingUp, Calendar, UserCheck,
  AlertCircle, Gamepad2,
} from "lucide-react";
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
  const totalMembers = rosterSummaries.reduce((sum: number, rs: any) => sum + (rs.memberCount || 0), 0);
  const totalEvents = rosterSummaries.reduce((sum: number, rs: any) => sum + (rs.nextEvents?.length || 0), 0);
  const pendingResets = passwordResets.filter((r: any) => r.status === "pending");

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Gamepad2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-stat-games">{allGames.length}</p>
              <p className="text-xs text-muted-foreground">Active Games</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-stat-members">{totalMembers}</p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-500/10">
              <Trophy className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-stat-rosters">{rosterSummaries.length}</p>
              <p className="text-xs text-muted-foreground">Rosters</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-orange-500/10">
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-stat-upcoming">{totalEvents}</p>
              <p className="text-xs text-muted-foreground">Upcoming Events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {(pending.length > 0 || pendingResets.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pending.length > 0 && (
            <Card>
              <CardHeader className="pb-3 gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Pending Registrations
                  <Badge variant="destructive">{pending.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pending.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`row-pending-${p.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{(p as any).username || p.user?.username || "Unknown"}</p>
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

          {pendingResets.length > 0 && (
            <Card>
              <CardHeader className="pb-3 gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Password Reset Requests
                  <Badge variant="destructive">{pendingResets.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingResets.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-md border" data-testid={`row-pw-reset-${req.id}`}>
                    <div>
                      <p className="font-medium text-sm">{req.username}</p>
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
        </div>
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
              const totalAtt = (rs.attendance?.attended || 0) + (rs.attendance?.late || 0) + (rs.attendance?.absent || 0);
              const attendanceRate = totalAtt > 0 ? Math.round(((rs.attendance?.attended || 0) / totalAtt) * 100) : 0;

              return (
                <div key={rs.rosterId || rs.gameId} className="border rounded-md" data-testid={`card-roster-${rs.rosterId || rs.gameId}`}>
                  <div
                    className="flex items-center justify-between gap-2 p-3 cursor-pointer hover-elevate rounded-md"
                    onClick={() => toggleRoster(rs.rosterId || rs.gameId)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{game?.name || "Unknown"}</span>
                      {rs.rosterName && <Badge variant="secondary" className="text-xs">{rs.rosterName}</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{rs.memberCount || 0}</span>
                      </div>
                      {totalAtt > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>{attendanceRate}%</span>
                        </div>
                      )}
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-3">
                      {totalAtt > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 rounded-md bg-green-500/10">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{rs.attendance?.attended || 0}</p>
                            <p className="text-xs text-muted-foreground">Attended</p>
                          </div>
                          <div className="text-center p-2 rounded-md bg-yellow-500/10">
                            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{rs.attendance?.late || 0}</p>
                            <p className="text-xs text-muted-foreground">Late</p>
                          </div>
                          <div className="text-center p-2 rounded-md bg-red-500/10">
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">{rs.attendance?.absent || 0}</p>
                            <p className="text-xs text-muted-foreground">Absent</p>
                          </div>
                        </div>
                      )}

                      {rs.recentResults && rs.recentResults.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recent Results</p>
                          <div className="space-y-1">
                            {rs.recentResults.map((r: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">{r.title}</span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-muted-foreground">{r.date}</span>
                                  <Badge
                                    variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    {r.result || "pending"}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rs.nextEvents && rs.nextEvents.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Upcoming Events</p>
                          <div className="space-y-1">
                            {rs.nextEvents.map((e: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate">{e.title}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-muted-foreground">{e.date}</span>
                                  {e.time && <span className="text-xs text-muted-foreground">{e.time}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rs.members && rs.members.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Members</p>
                          <div className="grid grid-cols-2 gap-1">
                            {rs.members.map((m: any) => (
                              <div key={m.id} className="flex items-center justify-between gap-2 text-sm p-1.5 rounded-md">
                                <span className="truncate">{m.name}</span>
                                <Badge variant="outline" className="text-xs">{m.role || "Member"}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
