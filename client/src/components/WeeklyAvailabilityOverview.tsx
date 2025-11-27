import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X, HelpCircle, Clock, Users } from "lucide-react";
import type { PlayerAvailability, DayOfWeek, AvailabilityOption } from "@shared/schema";
import { dayOfWeek } from "@shared/schema";

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

interface GroupedAvailability {
  [role: string]: {
    [playerName: string]: {
      [day: string]: AvailabilityOption;
    };
  };
}

export function WeeklyAvailabilityOverview() {
  const { data: schedule = [], isLoading } = useQuery<PlayerAvailability[]>({
    queryKey: ["/api/schedule"],
  });

  const groupedByRole = schedule.reduce<GroupedAvailability>((acc, item) => {
    const role = item.role || "Unassigned";
    if (!acc[role]) acc[role] = {};
    if (!acc[role][item.playerName]) {
      acc[role][item.playerName] = {};
    }
    acc[role][item.playerName][item.dayOfWeek] = item.availability;
    return acc;
  }, {});

  const getAvailabilityIcon = (availability: AvailabilityOption | undefined) => {
    switch (availability) {
      case "available":
        return <Check className="h-3 w-3 text-green-400" />;
      case "unavailable":
        return <X className="h-3 w-3 text-red-400" />;
      case "maybe":
        return <HelpCircle className="h-3 w-3 text-yellow-400" />;
      default:
        return <span className="w-3 h-3" />;
    }
  };

  const getAvailabilityColor = (availability: AvailabilityOption | undefined) => {
    switch (availability) {
      case "available":
        return "bg-green-500/20 border-green-500/30";
      case "unavailable":
        return "bg-red-500/20 border-red-500/30";
      case "maybe":
        return "bg-yellow-500/20 border-yellow-500/30";
      default:
        return "bg-muted border-transparent";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "tank":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "dps":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "support":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const calculateDaySummary = (day: DayOfWeek) => {
    let available = 0;
    let unavailable = 0;
    let maybe = 0;

    Object.values(groupedByRole).forEach(players => {
      Object.values(players).forEach(playerDays => {
        const status = playerDays[day];
        if (status === "available") available++;
        else if (status === "unavailable") unavailable++;
        else if (status === "maybe") maybe++;
      });
    });

    return { available, unavailable, maybe };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading availability...</p>
        </CardContent>
      </Card>
    );
  }

  const playerCount = new Set(schedule.map(s => s.playerName)).size;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Weekly Availability Overview
          <Badge variant="outline" className="ml-2">
            {playerCount} {playerCount === 1 ? "player" : "players"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-8 gap-1 text-xs">
            <div className="font-semibold text-muted-foreground px-2 py-1">Player</div>
            {DAYS.map(day => (
              <div key={day} className="font-semibold text-center text-muted-foreground py-1">
                {DAY_LABELS[day]}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-1 text-xs border-b border-border pb-2 mb-2">
            <div className="font-medium text-muted-foreground px-2">Summary</div>
            {DAYS.map(day => {
              const summary = calculateDaySummary(day);
              return (
                <TooltipProvider key={day}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-green-400">{summary.available}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-yellow-400">{summary.maybe}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-400">{summary.unavailable}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <div className="text-green-400">{summary.available} Available</div>
                        <div className="text-yellow-400">{summary.maybe} Maybe</div>
                        <div className="text-red-400">{summary.unavailable} Unavailable</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {Object.entries(groupedByRole).map(([role, players]) => (
            <div key={role} className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={getRoleColor(role)}>
                  {role}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {Object.keys(players).length} {Object.keys(players).length === 1 ? "player" : "players"}
                </span>
              </div>
              
              {Object.entries(players).map(([playerName, availability]) => (
                <div
                  key={playerName}
                  className="grid grid-cols-8 gap-1 items-center"
                  data-testid={`row-player-${playerName}`}
                >
                  <div
                    className="text-sm font-medium truncate px-2"
                    title={playerName}
                    data-testid={`text-player-name-${playerName}`}
                  >
                    {playerName}
                  </div>
                  {DAYS.map(day => {
                    const status = availability[day];
                    return (
                      <TooltipProvider key={day}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex items-center justify-center h-7 rounded border ${getAvailabilityColor(status)}`}
                              data-testid={`cell-${playerName}-${day}`}
                            >
                              {getAvailabilityIcon(status)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">
                              {playerName}: {status || "Not set"} on {DAY_LABELS[day]}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          {Object.keys(groupedByRole).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No player availability data yet.</p>
              <p className="text-sm mt-1">Add players and set their availability to see the overview here.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-border text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-green-400" />
            </div>
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <HelpCircle className="h-2.5 w-2.5 text-yellow-400" />
            </div>
            <span className="text-muted-foreground">Maybe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <X className="h-2.5 w-2.5 text-red-400" />
            </div>
            <span className="text-muted-foreground">Unavailable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
