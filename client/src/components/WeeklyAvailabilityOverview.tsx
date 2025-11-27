import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import type { DayOfWeek, AvailabilityOption, PlayerAvailability } from "@shared/schema";

const DAYS: DayOfWeek[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface WeeklyAvailabilityOverviewProps {
  scheduleData: PlayerAvailability[];
}

export function WeeklyAvailabilityOverview({ scheduleData }: WeeklyAvailabilityOverviewProps) {
  const schedule = scheduleData || [];

  const getAvailabilityStatus = (availability: AvailabilityOption): "available" | "unavailable" | "unknown" => {
    if (availability === "cannot") return "unavailable";
    if (availability === "unknown") return "unknown";
    return "available";
  };

  const calculateDaySummary = (day: DayOfWeek) => {
    let available = 0;
    let unavailable = 0;
    let unknown = 0;

    schedule.forEach(player => {
      const status = getAvailabilityStatus(player.availability[day]);
      if (status === "available") available++;
      else if (status === "unavailable") unavailable++;
      else unknown++;
    });

    const total = schedule.length;
    const availablePercent = total > 0 ? Math.round((available / total) * 100) : 0;

    return { available, unavailable, unknown, total, availablePercent };
  };

  const calculateOverallStats = () => {
    const totalSlots = schedule.length * 7;
    let availableSlots = 0;

    schedule.forEach(player => {
      DAYS.forEach(day => {
        const status = getAvailabilityStatus(player.availability[day]);
        if (status === "available") availableSlots++;
      });
    });

    const averageAvailability = totalSlots > 0 ? Math.round((availableSlots / totalSlots) * 100) : 0;

    return { totalSlots, availableSlots, averageAvailability };
  };

  const getCoverageStatus = (percent: number) => {
    if (percent >= 80) return { text: "Excellent", color: "text-emerald-600 dark:text-emerald-400" };
    if (percent >= 60) return { text: "Good", color: "text-cyan-600 dark:text-cyan-400" };
    if (percent >= 40) return { text: "Needs Work", color: "text-amber-600 dark:text-amber-400" };
    return { text: "Critical", color: "text-red-600 dark:text-red-400" };
  };

  const playerCount = schedule.length;

  if (playerCount === 0) {
    return null;
  }
  const overallStats = calculateOverallStats();
  const coverageStatus = getCoverageStatus(overallStats.averageAvailability);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Weekly Availability Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Player-Day Slots
            </div>
            <div className="text-2xl font-bold">
              {overallStats.availableSlots}/{overallStats.totalSlots}
            </div>
            <div className="text-xs text-muted-foreground">
              Available slots (7 days × {playerCount} players)
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              {overallStats.averageAvailability >= 50 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Average Availability
            </div>
            <div className="text-2xl font-bold">
              {overallStats.averageAvailability}%
            </div>
            <div className="text-xs text-muted-foreground">
              Across all days of week
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4" />
              Status
            </div>
            <div className={`text-2xl font-bold ${coverageStatus.color}`}>
              {coverageStatus.text}
            </div>
            <div className="text-xs text-muted-foreground">
              Team coverage
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Daily Breakdown</h4>
          {DAYS.map(day => {
            const summary = calculateDaySummary(day);
            const availableWidth = summary.total > 0 ? (summary.available / summary.total) * 100 : 0;
            const unknownWidth = summary.total > 0 ? (summary.unknown / summary.total) * 100 : 0;
            const unavailableWidth = summary.total > 0 ? (summary.unavailable / summary.total) * 100 : 0;

            return (
              <div key={day} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium">{day}</div>
                <div className="flex-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex h-6 w-full rounded overflow-hidden bg-slate-200 dark:bg-slate-700">
                          {summary.available > 0 && (
                            <div
                              className="bg-emerald-500 flex items-center justify-center text-xs text-white font-medium"
                              style={{ width: `${availableWidth}%` }}
                            >
                              {summary.available}
                            </div>
                          )}
                          {summary.unknown > 0 && (
                            <div
                              className="bg-slate-400 dark:bg-slate-500 flex items-center justify-center text-xs text-white font-medium"
                              style={{ width: `${unknownWidth}%` }}
                            >
                              {summary.unknown}
                            </div>
                          )}
                          {summary.unavailable > 0 && (
                            <div
                              className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                              style={{ width: `${unavailableWidth}%` }}
                            >
                              {summary.unavailable}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <div className="text-emerald-400">{summary.available} Available</div>
                          <div className="text-slate-400">{summary.unknown} Unknown</div>
                          <div className="text-red-400">{summary.unavailable} Unavailable</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Badge 
                  variant={summary.availablePercent >= 60 ? "default" : summary.availablePercent >= 40 ? "secondary" : "destructive"}
                  className="w-14 justify-center"
                >
                  {summary.availablePercent}%
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-slate-400 dark:bg-slate-500" />
            <span>Unknown</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Unavailable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
