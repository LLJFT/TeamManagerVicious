import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Filter, X } from "lucide-react";
import type { Event } from "@shared/schema";

export type AnalyticsEventTypeFilter = "all" | "Tournament" | "Scrim" | "VOD Review";

export type AnalyticsDateScope =
  | "all"
  | "this-month"
  | "last-month"
  | "last-30"
  | "last-60"
  | "this-season";

export interface AnalyticsFiltersState {
  eventType: AnalyticsEventTypeFilter;
  dateScope: AnalyticsDateScope;
}

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFiltersState = {
  eventType: "all",
  dateScope: "all",
};

const DATE_SCOPE_LABEL: Record<AnalyticsDateScope, string> = {
  "all": "All time",
  "this-month": "This month",
  "last-month": "Last month",
  "last-30": "Last 30 days",
  "last-60": "Last 60 days",
  "this-season": "This season",
};

const EVENT_TYPE_LABEL: Record<AnalyticsEventTypeFilter, string> = {
  "all": "All event types",
  "Tournament": "Tournament / Official",
  "Scrim": "Scrim",
  "VOD Review": "VOD Review / Practice",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateBoundsForScope(
  scope: AnalyticsDateScope,
  events: Event[],
): { from?: string; to?: string; seasonId?: string } {
  const now = new Date();
  switch (scope) {
    case "all":
      return {};
    case "this-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: ymd(from), to: ymd(to) };
    }
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(from), to: ymd(to) };
    }
    case "last-30": {
      const from = new Date(now); from.setDate(now.getDate() - 30);
      return { from: ymd(from), to: ymd(now) };
    }
    case "last-60": {
      const from = new Date(now); from.setDate(now.getDate() - 60);
      return { from: ymd(from), to: ymd(now) };
    }
    case "this-season": {
      // Pick the seasonId of the most recent (by date) event that has one.
      // This is roster-scoped — events are already roster-scoped upstream.
      const withSeason = events
        .filter(e => e.seasonId && e.date)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const seasonId = withSeason[0]?.seasonId || undefined;
      return { seasonId };
    }
  }
}

/**
 * Returns the set of event IDs that pass the current filter combination.
 * Pages then intersect their `games` (or other event-keyed data) against this set.
 */
export function applyAnalyticsFilters(
  events: Event[],
  filters: AnalyticsFiltersState,
): Set<string> {
  const { from, to, seasonId } = dateBoundsForScope(filters.dateScope, events);
  const allowed = new Set<string>();
  for (const e of events) {
    if (filters.eventType !== "all" && e.eventType !== filters.eventType) continue;
    if (from && (!e.date || e.date < from)) continue;
    if (to && (!e.date || e.date > to)) continue;
    if (seasonId && e.seasonId !== seasonId) continue;
    allowed.add(e.id);
  }
  return allowed;
}

export function isAnalyticsFilterActive(filters: AnalyticsFiltersState): boolean {
  return filters.eventType !== "all" || filters.dateScope !== "all";
}

export function useAnalyticsFilters(): {
  filters: AnalyticsFiltersState;
  setFilters: (s: AnalyticsFiltersState) => void;
  reset: () => void;
} {
  const [filters, setFilters] = useState<AnalyticsFiltersState>(DEFAULT_ANALYTICS_FILTERS);
  return {
    filters,
    setFilters,
    reset: () => setFilters(DEFAULT_ANALYTICS_FILTERS),
  };
}

/**
 * Compact filter bar to drop into the header of every analytics page.
 * Self-contained: calling pages just pass `filters` + `setFilters`.
 */
export function AnalyticsFilterBar({
  filters,
  setFilters,
  matchesCount,
  totalCount,
  className,
}: {
  filters: AnalyticsFiltersState;
  setFilters: (s: AnalyticsFiltersState) => void;
  matchesCount?: number;
  totalCount?: number;
  className?: string;
}) {
  const active = isAnalyticsFilterActive(filters);
  const hint = useMemo(() => {
    if (matchesCount === undefined || totalCount === undefined) return null;
    if (!active) return `${totalCount} match${totalCount === 1 ? "" : "es"}`;
    return `${matchesCount} of ${totalCount} match${totalCount === 1 ? "" : "es"}`;
  }, [matchesCount, totalCount, active]);

  return (
    <div
      className={`flex items-center gap-2 flex-wrap ${className || ""}`}
      data-testid="analytics-filter-bar"
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filters:
      </div>

      <Select
        value={filters.eventType}
        onValueChange={(v) => setFilters({ ...filters, eventType: v as AnalyticsEventTypeFilter })}
      >
        <SelectTrigger className="h-8 w-[180px]" data-testid="select-analytics-event-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(EVENT_TYPE_LABEL) as AnalyticsEventTypeFilter[]).map(k => (
            <SelectItem key={k} value={k}>{EVENT_TYPE_LABEL[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.dateScope}
        onValueChange={(v) => setFilters({ ...filters, dateScope: v as AnalyticsDateScope })}
      >
        <SelectTrigger className="h-8 w-[160px]" data-testid="select-analytics-date-scope">
          <Calendar className="h-3.5 w-3.5 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(DATE_SCOPE_LABEL) as AnalyticsDateScope[]).map(k => (
            <SelectItem key={k} value={k}>{DATE_SCOPE_LABEL[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => setFilters(DEFAULT_ANALYTICS_FILTERS)}
          data-testid="button-analytics-filters-reset"
        >
          <X className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      )}

      {hint !== null && (
        <Badge variant="secondary" className="ml-auto" data-testid="badge-analytics-match-count">
          {hint}
        </Badge>
      )}
    </div>
  );
}
