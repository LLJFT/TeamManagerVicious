import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, Plus, Search, ChevronDown, ChevronRight, ChevronUp, Users, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { orgRoleLabels, type OrgRole } from "@shared/schema";
import type { SupportedGame, Roster } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface UserData {
  id: string;
  username: string;
  orgRole: string;
  status: string;
  gameAssignments: { id: string; gameId: string; gameName: string; rosterId?: string; rosterName?: string; status: string }[];
}

function UserGameRosterCheckboxes({
  user,
  allGames,
  allRostersMap,
  onToggle,
  isPending,
}: {
  user: UserData;
  allGames: SupportedGame[];
  allRostersMap: Record<string, Roster[]>;
  onToggle: (userId: string, gameId: string, rosterId: string, grant: boolean, assignmentId?: string) => void;
  isPending: boolean;
}) {
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());

  const toggleGame = (gameId: string) => {
    setExpandedGames(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const gamesWithRosters = allGames.filter(g => (allRostersMap[g.id] || []).length > 0);

  return (
    <div className="px-3 pb-3 space-y-1">
      {gamesWithRosters.map(game => {
        const gameRosters = allRostersMap[game.id] || [];
        const isGameExpanded = expandedGames.has(game.id);
        const assignedCount = user.gameAssignments.filter(a => a.gameId === game.id).length;

        return (
          <div key={game.id} className="border rounded-md">
            <button
              type="button"
              className="flex items-center gap-2 w-full p-2 text-left hover-elevate rounded-md"
              onClick={() => toggleGame(game.id)}
              data-testid={`button-expand-game-${user.id}-${game.id}`}
            >
              {isGameExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <span className="text-sm font-medium">{game.name}</span>
              {assignedCount > 0 && (
                <Badge variant="secondary" className="text-xs">{assignedCount}/{gameRosters.length}</Badge>
              )}
            </button>
            {isGameExpanded && (
              <div className="px-4 pb-2 space-y-2">
                {gameRosters.map(roster => {
                  const assignment = user.gameAssignments.find(
                    a => a.gameId === game.id && a.rosterId === roster.id
                  );
                  const isChecked = !!assignment;

                  return (
                    <label
                      key={roster.id}
                      className="flex items-center gap-2 cursor-pointer"
                      data-testid={`checkbox-roster-${user.id}-${game.id}-${roster.id}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={isPending}
                        onCheckedChange={(checked) => {
                          onToggle(user.id, game.id, roster.id, !!checked, assignment?.id);
                        }}
                      />
                      <span className="text-sm">{roster.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function GameAccessPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRosterOption, setSelectedRosterOption] = useState<string>("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [bulkRole, setBulkRole] = useState<string>("");

  const orgRoleLabelFor = (role: string): string => {
    if (orgRoleLabels[role as OrgRole]) return orgRoleLabels[role as OrgRole];
    if (role === "management") return "Management";
    if (role === "staff") return "Staff";
    if (role === "member") return "Member";
    return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };
  const [bulkRoleExpanded, setBulkRoleExpanded] = useState<boolean>(false);
  const [bulkExpandedGames, setBulkExpandedGames] = useState<Set<string>>(new Set());
  const [bulkSelectedRosters, setBulkSelectedRosters] = useState<Set<string>>(new Set());

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<UserData[]>({
    queryKey: ["/api/all-users"],
    queryFn: async () => {
      const res = await fetch("/api/all-users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const { data: allGames = [] } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const { data: allRostersMap = {} } = useQuery<Record<string, Roster[]>>({
    queryKey: ["/api/all-rosters"],
  });

  const rosterOptions = useMemo(() => {
    const options: { value: string; gameId: string; rosterId: string; label: string }[] = [];
    allGames.forEach(game => {
      const gameRosters = allRostersMap[game.id] || [];
      gameRosters.forEach(roster => {
        options.push({
          value: `${game.id}:${roster.id}`,
          gameId: game.id,
          rosterId: roster.id,
          label: `${game.name} — ${roster.name}`,
        });
      });
    });
    return options;
  }, [allGames, allRostersMap]);

  const [usersFilterScope, setUsersFilterScope] = useState<string>("all");
  const filteredUsers = allUsers.filter(u => {
    if (searchQuery && !u.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (usersFilterScope.startsWith("game:")) {
      const gid = usersFilterScope.slice(5);
      if (!u.gameAssignments.some(a => a.gameId === gid)) return false;
    } else if (usersFilterScope.startsWith("roster:")) {
      const [gid, rid] = usersFilterScope.slice(7).split("|");
      if (!u.gameAssignments.some(a => a.gameId === gid && a.rosterId === rid)) return false;
    }
    return true;
  });

  const addAccessMutation = useMutation({
    mutationFn: async ({ userId, gameId, rosterId }: { userId: string; gameId: string; rosterId: string }) => {
      await apiRequest("POST", "/api/game-assignments", { userId, gameId, rosterId, status: "approved", assignedRole: "player" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: t("pages.gameAccess.toasts.granted") });
    },
    onError: (e: any) => toast({ title: t("pages.common.error"), description: e.message, variant: "destructive" }),
  });

  const removeAccessMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest("DELETE", `/api/game-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: t("pages.gameAccess.toasts.removed") });
    },
    onError: (e: any) => toast({ title: t("pages.common.error"), description: e.message, variant: "destructive" }),
  });

  const bulkAccessMutation = useMutation({
    mutationFn: async ({ orgRole, assignments }: { orgRole: string; assignments: { gameId: string; rosterId: string }[] }) => {
      const res = await apiRequest("POST", "/api/game-assignments/bulk", { orgRole, assignments });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      setBulkSelectedRosters(new Set());
      toast({ title: t("pages.gameAccess.toasts.bulkGranted", { users: data.users, created: data.created }) });
    },
    onError: (e: any) => toast({ title: t("pages.common.error"), description: e.message, variant: "destructive" }),
  });

  const handleAddAccess = () => {
    if (!selectedUserId || !selectedRosterOption) return;
    const [gameId, rosterId] = selectedRosterOption.split(":");
    addAccessMutation.mutate({ userId: selectedUserId, gameId, rosterId });
    setSelectedUserId("");
    setSelectedRosterOption("");
  };

  const handleToggleRoster = (userId: string, gameId: string, rosterId: string, grant: boolean, assignmentId?: string) => {
    if (grant) {
      addAccessMutation.mutate({ userId, gameId, rosterId });
    } else if (assignmentId) {
      removeAccessMutation.mutate(assignmentId);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleBulkGame = (gameId: string) => {
    setBulkExpandedGames(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const toggleBulkRoster = (key: string) => {
    setBulkSelectedRosters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBulkGrant = () => {
    if (!bulkRole || bulkSelectedRosters.size === 0) return;
    const assignments = Array.from(bulkSelectedRosters).map(key => {
      const [gameId, rosterId] = key.split(":");
      return { gameId, rosterId };
    });
    bulkAccessMutation.mutate({ orgRole: bulkRole, assignments });
  };

  const gamesWithRosters = allGames.filter(g => (allRostersMap[g.id] || []).length > 0);

  if (usersLoading) {
    return <div className="p-6"><p className="text-muted-foreground">{t("pages.common.loading")}</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-game-access-title">{t("pages.gameAccess.title")}</h1>
      </div>

      <Card className="border-l-2 border-l-primary/40">
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            {t("pages.gameAccess.grantSingleTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("pages.gameAccess.grantSingleDesc")}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">{t("pages.gameAccess.user")}</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-access-user">
                  <SelectValue placeholder={t("pages.gameAccess.selectUser")} />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">{t("pages.gameAccess.gameAndRoster")}</label>
              <Select value={selectedRosterOption} onValueChange={setSelectedRosterOption}>
                <SelectTrigger data-testid="select-access-roster">
                  <SelectValue placeholder={t("pages.gameAccess.selectGameRoster")} />
                </SelectTrigger>
                <SelectContent>
                  {rosterOptions.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddAccess}
              disabled={!selectedUserId || !selectedRosterOption || addAccessMutation.isPending}
              data-testid="button-grant-access"
            >
              <Plus className="h-4 w-4 me-2" />
              {t("pages.gameAccess.grantAccess")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-2 border-l-chart-2/60 bg-muted/30">
        <CardHeader className="pb-3 gap-2">
          <button
            type="button"
            className="flex items-center justify-between gap-2 w-full text-left hover-elevate rounded-md p-1 -m-1"
            onClick={() => setBulkRoleExpanded(v => !v)}
            data-testid="button-toggle-bulk-grant"
          >
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-chart-2" />
                {t("pages.gameAccess.bulkTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("pages.gameAccess.bulkDesc")}</p>
            </div>
            {bulkRoleExpanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>
        </CardHeader>
        {bulkRoleExpanded && (
        <CardContent className="space-y-4">
          <div className="space-y-1 max-w-xs">
            <label className="text-xs text-muted-foreground">{t("pages.common.role")}</label>
            <Select value={bulkRole} onValueChange={setBulkRole}>
              <SelectTrigger data-testid="select-bulk-role">
                <SelectValue placeholder={t("pages.gameAccess.selectRole")} />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const counts = new Map<string, number>();
                  for (const u of allUsers) {
                    const r = (u.orgRole || "").trim();
                    if (!r) continue;
                    counts.set(r, (counts.get(r) || 0) + 1);
                  }
                  const opts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
                  if (opts.length === 0) {
                    return <SelectItem value="__none" disabled>{t("pages.gameAccess.noUsersFound")}</SelectItem>;
                  }
                  return opts.map(([role, n]) => (
                    <SelectItem key={role} value={role} data-testid={`option-bulk-role-${role}`}>
                      {orgRoleLabelFor(role)} ({n})
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>

          {bulkRole && (
            <>
              <p className="text-xs text-muted-foreground">{t("pages.gameAccess.selectRostersFor", { role: orgRoleLabelFor(bulkRole) })}</p>
              <div className="space-y-1">
                {gamesWithRosters.map(game => {
                  const gameRosters = allRostersMap[game.id] || [];
                  const isBulkExpanded = bulkExpandedGames.has(game.id);
                  const selectedCount = gameRosters.filter(r => bulkSelectedRosters.has(`${game.id}:${r.id}`)).length;

                  return (
                    <div key={game.id} className="border rounded-md">
                      <button
                        type="button"
                        className="flex items-center gap-2 w-full p-2 text-left hover-elevate rounded-md"
                        onClick={() => toggleBulkGame(game.id)}
                        data-testid={`button-bulk-expand-game-${game.id}`}
                      >
                        {isBulkExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-sm font-medium">{game.name}</span>
                        {selectedCount > 0 && (
                          <Badge variant="secondary" className="text-xs">{t("pages.gameAccess.countSelected", { count: selectedCount })}</Badge>
                        )}
                      </button>
                      {isBulkExpanded && (
                        <div className="px-4 pb-2 space-y-2">
                          {gameRosters.map(roster => {
                            const key = `${game.id}:${roster.id}`;
                            return (
                              <label key={roster.id} className="flex items-center gap-2 cursor-pointer" data-testid={`checkbox-bulk-roster-${game.id}-${roster.id}`}>
                                <Checkbox
                                  checked={bulkSelectedRosters.has(key)}
                                  onCheckedChange={() => toggleBulkRoster(key)}
                                />
                                <span className="text-sm">{roster.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleBulkGrant}
                disabled={bulkSelectedRosters.size === 0 || bulkAccessMutation.isPending}
                data-testid="button-bulk-grant-access"
              >
                <Plus className="h-4 w-4 me-2" />
                {t("pages.gameAccess.grantAccess")}
              </Button>
            </>
          )}
        </CardContent>
        )}
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("pages.gameAccess.searchUsers")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-access"
        />
        <Select value={usersFilterScope} onValueChange={setUsersFilterScope}>
          <SelectTrigger className="w-[260px]" data-testid="select-users-filter-scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("pages.gameAccess.allUsers")}</SelectItem>
            {allGames.map(g => (
              <SelectItem key={`game-${g.id}`} value={`game:${g.id}`}>{t("pages.gameAccess.gamePrefix", { name: g.name })}</SelectItem>
            ))}
            {allGames.flatMap(g =>
              (allRostersMap[g.id] || []).map(r => (
                <SelectItem key={`roster-${g.id}-${r.id}`} value={`roster:${g.id}|${r.id}`}>
                  {t("pages.gameAccess.rosterPrefix", { game: g.name, roster: r.name })}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground" data-testid="text-users-count">
          {t("pages.gameAccess.usersCount", { count: filteredUsers.length })}
        </span>
      </div>

      <div className="space-y-1">
        {filteredUsers.map(user => {
          const isExpanded = expandedUsers.has(user.id);
          const assignmentCount = user.gameAssignments.length;
          return (
            <Card key={user.id}>
              <CardContent className="p-0">
                <button
                  type="button"
                  className="flex items-center justify-between gap-3 w-full p-3 text-left hover-elevate rounded-md"
                  onClick={() => toggleExpand(user.id)}
                  data-testid={`button-expand-user-${user.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-medium" data-testid={`text-access-user-${user.id}`}>{user.username}</span>
                    <Badge variant="outline" className="text-xs">{orgRoleLabels[user.orgRole as OrgRole] || user.orgRole}</Badge>
                    {assignmentCount > 0 && (
                      <span className="text-xs text-muted-foreground">{t("pages.gameAccess.assignmentsCount", { count: assignmentCount })}</span>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <UserGameRosterCheckboxes
                    user={user}
                    allGames={allGames}
                    allRostersMap={allRostersMap}
                    onToggle={handleToggleRoster}
                    isPending={addAccessMutation.isPending || removeAccessMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
