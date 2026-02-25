import { useQuery, useMutation } from "@tanstack/react-query";
import { ScheduleTable } from "@/components/ScheduleTable";
import { PlayerManager } from "@/components/PlayerManager";
import { AvailabilityAnalytics } from "@/components/AvailabilityAnalytics";
import { WeeklyAvailabilityOverview } from "@/components/WeeklyAvailabilityOverview";
import { format } from "date-fns";
import type { Player, PlayerAvailabilityRecord, StaffAvailabilityRecord, AvailabilitySlot, RosterRole, DayOfWeek } from "@shared/schema";
import { dayOfWeek } from "@shared/schema";
import type { PlayerAvailability, AvailabilityOption } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  teamId: string | null;
}

export default function Home() {
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const { currentGame } = useGame();
  const currentDate = format(new Date(), "MMM dd");
  const gameName = currentGame?.name || "Team";
  const canEditAll = hasPermission("edit_all_availability");
  const canEditOwn = hasPermission("edit_own_availability");
  const linkedPlayerId = user?.playerId || null;

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const { data: staffMembers = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  const { data: playerAvailabilities = [] } = useQuery<PlayerAvailabilityRecord[]>({
    queryKey: ["/api/player-availability"],
  });

  const { data: staffAvailabilities = [] } = useQuery<StaffAvailabilityRecord[]>({
    queryKey: ["/api/staff-availability"],
  });

  const { data: availabilitySlots = [] } = useQuery<AvailabilitySlot[]>({
    queryKey: ["/api/availability-slots"],
  });

  const { data: rosterRoles = [] } = useQuery<RosterRole[]>({
    queryKey: ["/api/roster-roles"],
  });

  const scheduleData: PlayerAvailability[] = players.map(player => {
    const playerAvails = playerAvailabilities.filter(pa => pa.playerId === player.id);
    const availability = dayOfWeek.reduce((acc, day) => {
      const record = playerAvails.find(pa => pa.day === day);
      acc[day] = (record?.availability || "unknown") as AvailabilityOption;
      return acc;
    }, {} as { [key in DayOfWeek]: AvailabilityOption });
    return {
      playerId: player.id,
      playerName: player.name,
      role: player.role as any,
      availability,
    };
  });

  const slotLabels = availabilitySlots.length > 0
    ? availabilitySlots.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(s => s.label)
    : ["Unknown", "18:00-20:00", "20:00-22:00", "All Blocks", "Can't"];

  const playerRoleNames = rosterRoles
    .filter(r => r.type === "player")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(r => r.name);

  const allRoleNames = rosterRoles
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(r => r.name);

  const savePlayerAvailMutation = useMutation({
    mutationFn: async ({ playerId, day, availability }: { playerId: string; day: string; availability: string }) => {
      await apiRequest("POST", "/api/player-availability", { playerId, day, availability });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player-availability"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save availability", description: err.message, variant: "destructive" });
    },
  });

  const saveStaffAvailMutation = useMutation({
    mutationFn: async ({ staffId, day, availability }: { staffId: string; day: string; availability: string }) => {
      await apiRequest("POST", "/api/staff-availability", { staffId, day, availability });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-availability"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save availability", description: err.message, variant: "destructive" });
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const res = await apiRequest("POST", "/api/players", { name, role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      toast({ title: "Player added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add player", description: err.message, variant: "destructive" });
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async ({ id, name, role }: { id: string; name: string; role: string }) => {
      await apiRequest("PUT", `/api/players/${id}`, { name, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      toast({ title: "Player updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update player", description: err.message, variant: "destructive" });
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/players/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-availability"] });
      toast({ title: "Player removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove player", description: err.message, variant: "destructive" });
    },
  });

  const handleAvailabilityChange = (playerId: string, day: DayOfWeek, availability: string) => {
    savePlayerAvailMutation.mutate({ playerId, day, availability });
  };

  const handleStaffAvailabilityChange = (staffId: string, day: DayOfWeek, availability: string) => {
    saveStaffAvailMutation.mutate({ staffId, day, availability });
  };

  const handleRoleChange = (playerId: string, role: string) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      updatePlayerMutation.mutate({ id: playerId, name: player.name, role });
    }
  };

  const handleAddPlayer = (name: string, role: string) => {
    addPlayerMutation.mutate({ name, role });
  };

  const handleRemovePlayer = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (player && window.confirm(`Remove ${player.name}?`)) {
      removePlayerMutation.mutate(playerId);
    }
  };

  const handleEditPlayer = (playerId: string, name: string, role: string) => {
    updatePlayerMutation.mutate({ id: playerId, name, role });
  };

  const staffScheduleData = staffMembers.map(s => {
    const staffAvails = staffAvailabilities.filter(sa => sa.staffId === s.id);
    const availability = dayOfWeek.reduce((acc, day) => {
      const record = staffAvails.find(sa => sa.day === day);
      acc[day] = record?.availability || "unknown";
      return acc;
    }, {} as Record<string, string>);
    return { id: s.id, name: s.name, role: s.role, availability };
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="text-page-title">
                {gameName}
              </h1>
              <p className="text-lg font-semibold text-primary" data-testid="text-week-range">
                Availability Times ({currentDate})
              </p>
            </div>
          </div>

          {hasPermission("manage_schedule_players") && (
          <div className="flex items-center gap-2 flex-wrap">
            <PlayerManager
              players={players}
              roleOptions={playerRoleNames.length > 0 ? playerRoleNames : ["Tank", "DPS", "Support", "Flex"]}
              onAddPlayer={handleAddPlayer}
              onRemovePlayer={handleRemovePlayer}
              onEditPlayer={handleEditPlayer}
            />
          </div>
          )}

          {playersLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : (
            <>
              <ScheduleTable
                players={players}
                playerAvailabilities={playerAvailabilities}
                staffMembers={staffScheduleData}
                slotLabels={slotLabels}
                roleOptions={allRoleNames.length > 0 ? allRoleNames : ["Tank", "DPS", "Support", "Flex"]}
                onAvailabilityChange={handleAvailabilityChange}
                onStaffAvailabilityChange={handleStaffAvailabilityChange}
                onRoleChange={handleRoleChange}
                isLoading={false}
                canEditAll={canEditAll}
                editablePlayerId={canEditOwn ? linkedPlayerId : null}
              />

              <WeeklyAvailabilityOverview scheduleData={scheduleData} />

              {scheduleData.length > 0 && (
                <AvailabilityAnalytics scheduleData={scheduleData} />
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .container, .container * { visibility: visible; }
          .container { position: absolute; left: 0; top: 0; }
          button, .fixed { display: none !important; }
        }
      `}</style>
    </div>
  );
}
