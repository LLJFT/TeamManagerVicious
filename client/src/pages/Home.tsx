import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScheduleTable } from "@/components/ScheduleTable";
import { WeekSelector } from "@/components/WeekSelector";
import { PlayerManager } from "@/components/PlayerManager";
import { SyncStatus } from "@/components/SyncStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvailabilityAnalytics } from "@/components/AvailabilityAnalytics";
import { WeeklyAvailabilityOverview } from "@/components/WeeklyAvailabilityOverview";
import { SimpleToast } from "@/components/SimpleToast";
import { Save, Share2, Calendar, Users, Trophy, Settings, History, BarChart3, Scale, Target } from "lucide-react";
import { format } from "date-fns";
import type { PlayerAvailability, DayOfWeek, AvailabilityOption, RoleType } from "@shared/schema";
import { dayOfWeek } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";

export default function Home() {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [scheduleData, setScheduleData] = useState<PlayerAvailability[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>();

  // Use a fixed identifier for the permanent schedule
  const scheduleId = "permanent-schedule";
  const currentDate = format(new Date(), "MMM dd"); // e.g., "Nov 01"

  const { data: fetchedSchedule, isLoading } = useQuery<any>({
    queryKey: [`/api/schedule?weekStartDate=${scheduleId}&weekEndDate=${scheduleId}`],
  });

  useEffect(() => {
    if (fetchedSchedule && fetchedSchedule.scheduleData?.players) {
      setScheduleData(fetchedSchedule.scheduleData.players);
      setHasChanges(false);
      setLastSyncTime(new Date());
    } else if (fetchedSchedule && !fetchedSchedule.scheduleData?.players) {
      setScheduleData([]);
      setHasChanges(false);
      setLastSyncTime(new Date());
    }
  }, [fetchedSchedule]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log("[Save Mutation] Starting save...");
      const response = await apiRequest("POST", "/api/schedule", {
        weekStartDate: scheduleId,
        weekEndDate: scheduleId,
        scheduleData: { players: scheduleData },
      });
      const data = await response.json();
      console.log("[Save Mutation] Save completed:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("[Save Mutation] onSuccess called with data:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setHasChanges(false);
      setLastSyncTime(new Date());
      console.log("[Save Mutation] Showing success toast");
      setToastMessage("Successfully saved to Google Sheets");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      console.log("[Save Mutation] onError called:", error);
      setToastMessage(error.message || "Error saving schedule");
      setToastType("error");
      setShowToast(true);
    },
  });


  const handleAvailabilityChange = (playerId: string, day: DayOfWeek, availability: AvailabilityOption) => {
    setScheduleData((prev) =>
      prev.map((player) =>
        player.playerId === playerId
          ? {
              ...player,
              availability: {
                ...player.availability,
                [day]: availability,
              },
            }
          : player
      )
    );
    setHasChanges(true);
  };

  const handleRoleChange = (playerId: string, role: RoleType) => {
    setScheduleData((prev) =>
      prev.map((player) =>
        player.playerId === playerId
          ? { ...player, role }
          : player
      )
    );
    setHasChanges(true);
  };

  const handlePlayerNameChange = (playerId: string, name: string) => {
    setScheduleData((prev) =>
      prev.map((player) =>
        player.playerId === playerId
          ? { ...player, playerName: name }
          : player
      )
    );
    setHasChanges(true);
  };

  const handleAddPlayer = (name: string, role: RoleType) => {
    const newPlayer: PlayerAvailability = {
      playerId: nanoid(),
      playerName: name,
      role,
      availability: dayOfWeek.reduce((acc, day) => {
        acc[day] = "unknown";
        return acc;
      }, {} as { [key in DayOfWeek]: AvailabilityOption }),
    };
    setScheduleData((prev) => [...prev, newPlayer]);
    setHasChanges(true);
    setToastMessage(`Added ${name} to schedule`);
    setToastType("success");
    setShowToast(true);
  };

  const handleRemovePlayer = (playerId: string) => {
    const player = scheduleData.find((p) => p.playerId === playerId);
    if (player) {
      const confirm = window.confirm(`Remove ${player.playerName}?`);
      if (!confirm) return;
      
      setScheduleData((prev) => prev.filter((p) => p.playerId !== playerId));
      setHasChanges(true);
      setToastMessage(`Removed ${player.playerName} from schedule`);
      setToastType("success");
      setShowToast(true);
    }
  };

  const handleEditPlayer = (playerId: string, name: string, role: RoleType) => {
    setScheduleData((prev) =>
      prev.map((player) =>
        player.playerId === playerId
          ? { ...player, playerName: name, role }
          : player
      )
    );
    setHasChanges(true);
    setToastMessage(`Updated ${name}`);
    setToastType("success");
    setShowToast(true);
  };

  const handleShare = async () => {
    try {
      const response = await fetch('/api/spreadsheet-info');
      const data = await response.json();
      
      if (!response.ok || !data.url) {
        throw new Error('Failed to get spreadsheet URL');
      }
      
      await navigator.clipboard.writeText(data.url);
      setToastMessage("Google Sheets link copied");
      setToastType("success");
      setShowToast(true);
    } catch (error) {
      console.error('Share error:', error);
      setToastMessage("Failed to copy link");
      setToastType("error");
      setShowToast(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="text-page-title">
                Marvel Rivals
              </h1>
              <p className="text-lg font-semibold text-primary" data-testid="text-week-range">
                The Vicious Availability Times ({currentDate})
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SyncStatus
                isSyncing={saveMutation.isPending}
                lastSyncTime={lastSyncTime}
                hasError={saveMutation.isError}
              />
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex items-center gap-2 flex-wrap">
              <PlayerManager
                players={scheduleData}
                onAddPlayer={handleAddPlayer}
                onRemovePlayer={handleRemovePlayer}
                onEditPlayer={handleEditPlayer}
              />
              <Link href="/events">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-events"
                >
                  <Calendar className="h-4 w-4" />
                  Events
                </Button>
              </Link>
              <Link href="/results">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-results"
                >
                  <Trophy className="h-4 w-4" />
                  Results
                </Button>
              </Link>
              <Link href="/history">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-history"
                >
                  <History className="h-4 w-4" />
                  History
                </Button>
              </Link>
              <Link href="/stats">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-stats"
                >
                  <BarChart3 className="h-4 w-4" />
                  Stats
                </Button>
              </Link>
              <Link href="/compare">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-compare"
                >
                  <Scale className="h-4 w-4" />
                  Compare
                </Button>
              </Link>
              <Link href="/opponents">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-opponent-stats"
                >
                  <Target className="h-4 w-4" />
                  Opponents
                </Button>
              </Link>
              <Link href="/players">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-players"
                >
                  <Users className="h-4 w-4" />
                  Players
                </Button>
              </Link>
              <Link href="/settings">
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-settings"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleShare}
                className="gap-2"
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button
                variant="default"
                onClick={() => saveMutation.mutate()}
                disabled={!hasChanges || saveMutation.isPending}
                className="gap-2"
                data-testid="button-save"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : (
            <>
              <ScheduleTable
                scheduleData={scheduleData}
                onAvailabilityChange={handleAvailabilityChange}
                onRoleChange={handleRoleChange}
                onPlayerNameChange={handlePlayerNameChange}
                isLoading={saveMutation.isPending}
              />

              <WeeklyAvailabilityOverview scheduleData={scheduleData} />

              {scheduleData.length > 0 && (
                <AvailabilityAnalytics scheduleData={scheduleData} />
              )}
            </>
          )}

          {hasChanges && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
                <span className="text-sm font-medium">You have unsaved changes</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-floating"
                >
                  Save Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showToast && (
        <SimpleToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .container, .container * {
            visibility: visible;
          }
          .container {
            position: absolute;
            left: 0;
            top: 0;
          }
          button, .fixed {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
