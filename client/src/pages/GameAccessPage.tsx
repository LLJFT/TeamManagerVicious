import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { KeyRound, Plus, Trash2, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportedGame, Roster } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  username: string;
  orgRole: string;
  status: string;
  gameAssignments: { id: string; gameId: string; gameName: string; rosterId?: string; rosterName?: string; status: string }[];
}

export default function GameAccessPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRosterOption, setSelectedRosterOption] = useState<string>("");

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

  const filteredUsers = allUsers.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addAccessMutation = useMutation({
    mutationFn: async ({ userId, gameId, rosterId }: { userId: string; gameId: string; rosterId: string }) => {
      await apiRequest("POST", "/api/game-assignments", { userId, gameId, rosterId, status: "approved", assignedRole: "player" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      setSelectedUserId("");
      setSelectedRosterOption("");
      toast({ title: "Access granted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeAccessMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest("DELETE", `/api/game-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-users"] });
      toast({ title: "Access removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAddAccess = () => {
    if (!selectedUserId || !selectedRosterOption) return;
    const [gameId, rosterId] = selectedRosterOption.split(":");
    addAccessMutation.mutate({ userId: selectedUserId, gameId, rosterId });
  };

  if (usersLoading) {
    return <div className="p-6"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-6 w-6" />
        <h1 className="text-2xl font-bold" data-testid="text-game-access-title">Game Access</h1>
      </div>

      <Card>
        <CardHeader className="pb-3 gap-2">
          <CardTitle className="text-base">Grant Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-access-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Game + Roster</label>
              <Select value={selectedRosterOption} onValueChange={setSelectedRosterOption}>
                <SelectTrigger data-testid="select-access-roster">
                  <SelectValue placeholder="Select game + roster" />
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
              <Plus className="h-4 w-4 mr-2" />
              Grant Access
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-access"
        />
      </div>

      <div className="space-y-2">
        {filteredUsers.filter(u => u.gameAssignments.length > 0).map(user => (
          <Card key={user.id}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <span className="font-medium" data-testid={`text-access-user-${user.id}`}>{user.username}</span>
                <Badge variant="outline" className="text-xs">{user.orgRole}</Badge>
              </div>
              <div className="space-y-1">
                {user.gameAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded border" data-testid={`row-access-${a.id}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm">{a.gameName}</span>
                      {a.rosterName && <Badge variant="secondary" className="text-xs">{a.rosterName}</Badge>}
                      <Badge variant={a.status === "approved" ? "default" : "secondary"} className="text-xs">{a.status}</Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { if (confirm("Remove this access?")) removeAccessMutation.mutate(a.id); }}
                      data-testid={`button-remove-access-${a.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
