import { useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Lock, ChevronLeft, ChevronRight } from "lucide-react";
import type { Player, PlayerAvailabilityRecord, DayOfWeek } from "@shared/schema";
import { dayOfWeek } from "@shared/schema";

interface StaffScheduleEntry {
  id: string;
  name: string;
  role: string;
  availability: Record<string, string>;
}

interface ScheduleTableProps {
  players: Player[];
  playerAvailabilities: PlayerAvailabilityRecord[];
  staffMembers: StaffScheduleEntry[];
  slotLabels: string[];
  roleOptions: string[];
  onAvailabilityChange: (playerId: string, day: DayOfWeek, availability: string) => void;
  onStaffAvailabilityChange: (staffId: string, day: DayOfWeek, availability: string) => void;
  onRoleChange?: (playerId: string, role: string) => void;
  isLoading?: boolean;
  canEditAll?: boolean;
  editablePlayerId?: string | null;
  editableStaffId?: string | null;
}

const roleColorPalette = [
  "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20",
  "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-500/20",
  "bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-500/20",
  "bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20",
  "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border-yellow-500/20",
  "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-cyan-500/20",
  "bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border-orange-500/20",
];

function getRoleColor(role: string, allRoles: string[]): string {
  const idx = allRoles.indexOf(role);
  if (idx >= 0) return roleColorPalette[idx % roleColorPalette.length];
  return roleColorPalette[0];
}

function getAvailabilityColor(avail: string): string {
  const lower = avail.toLowerCase();
  if (lower === "unknown") return "bg-muted text-muted-foreground";
  if (lower === "can't" || lower === "cannot") return "bg-destructive/10 text-destructive dark:bg-destructive/20";
  if (lower.includes("all")) return "bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300";
  return "bg-primary/10 text-primary dark:bg-primary/20";
}

export function ScheduleTable({
  players,
  playerAvailabilities,
  staffMembers,
  slotLabels,
  roleOptions,
  onAvailabilityChange,
  onStaffAvailabilityChange,
  onRoleChange,
  isLoading,
  canEditAll = true,
  editablePlayerId = null,
  editableStaffId = null,
}: ScheduleTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const isCollapsed = (key: string) => collapsedCols.has(key);
  const toggleCol = (key: string) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const colHeaderClass = (key: string, base: string) =>
    isCollapsed(key)
      ? "border-r border-primary-border px-1 py-3 text-center text-xs font-semibold uppercase tracking-wide w-8 cursor-pointer select-none last:border-r-0"
      : `${base} cursor-pointer select-none`;

  const getPlayerAvailability = (playerId: string, day: string): string => {
    const record = playerAvailabilities.find(pa => pa.playerId === playerId && pa.day === day);
    return record?.availability || "unknown";
  };

  const groupedByRole: Record<string, Player[]> = {};
  for (const player of players) {
    const role = player.role || "Unassigned";
    if (!groupedByRole[role]) groupedByRole[role] = [];
    groupedByRole[role].push(player);
  }

  const roleOrder = roleOptions.length > 0 ? roleOptions : Object.keys(groupedByRole);
  const allRolesForColor = Array.from(new Set([...roleOptions, ...Object.keys(groupedByRole)]));

  return (
    <div className="space-y-6">
      <div className="w-full overflow-hidden rounded-lg border border-border bg-card" ref={tableRef}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th
                  className={colHeaderClass("role", "border-r border-primary-border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide")}
                  onClick={() => toggleCol("role")}
                  data-testid="th-role"
                >
                  <span className="inline-flex items-center gap-1">
                    {isCollapsed("role") ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                    {!isCollapsed("role") && "Role"}
                  </span>
                </th>
                <th
                  className={colHeaderClass("player", "border-r border-primary-border px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide min-w-[140px]")}
                  onClick={() => toggleCol("player")}
                  data-testid="th-player"
                >
                  <span className="inline-flex items-center gap-1">
                    {isCollapsed("player") ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                    {!isCollapsed("player") && "Player"}
                  </span>
                </th>
                {dayOfWeek.map((day) => (
                  <th
                    key={day}
                    className={colHeaderClass(day, "border-r border-primary-border px-3 py-3 text-center text-sm font-semibold uppercase tracking-wide min-w-[160px] last:border-r-0")}
                    onClick={() => toggleCol(day)}
                    data-testid={`th-${day}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isCollapsed(day) ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                      {!isCollapsed(day) && day}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roleOrder.map((role) => {
                const playersInRole = groupedByRole[role] || [];
                if (playersInRole.length === 0) return null;
                return playersInRole.map((player) => {
                  const canEditThis = canEditAll || editablePlayerId === player.id;
                  return (
                  <tr key={player.id} className="border-t border-border hover-elevate" data-testid={`row-player-${player.id}`}>
                    <td className={`border-r border-border bg-card ${isCollapsed("role") ? "px-1 py-2 w-8" : "px-2 py-2"}`}>
                      {isCollapsed("role") ? (
                        <div className={`h-2 w-2 rounded-full mx-auto ${getRoleColor(player.role, allRolesForColor).split(" ")[0]}`} />
                      ) : (
                        <Select
                          value={player.role}
                          onValueChange={(value: string) => onRoleChange?.(player.id, value)}
                          disabled={isLoading || !canEditAll}
                        >
                          <SelectTrigger className={`w-full h-9 text-xs font-medium ${getRoleColor(player.role, allRolesForColor)} border-0`} data-testid={`select-role-${player.id}`}>
                            <SelectValue>{player.role}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className={`border-r border-border bg-card ${isCollapsed("player") ? "px-1 py-2 w-8" : "px-4 py-2"}`}>
                      {isCollapsed("player") ? (
                        <span className="text-xs text-muted-foreground">·</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium" data-testid={`text-player-name-${player.id}`}>{player.name}</span>
                          {!canEditThis && (
                            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      )}
                    </td>
                    {dayOfWeek.map((day) => {
                      const avail = getPlayerAvailability(player.id, day);
                      const collapsed = isCollapsed(day);
                      return (
                        <td key={day} className={`border-r border-border bg-card ${collapsed ? "px-1 py-2 w-8" : "px-2 py-2"}`}>
                          {collapsed ? (
                            <div className={`h-2 w-2 rounded-full mx-auto ${getAvailabilityColor(avail).split(" ")[0]}`} title={avail} />
                          ) : (
                            <Select
                              value={avail}
                              onValueChange={(value: string) => onAvailabilityChange(player.id, day, value)}
                              disabled={isLoading || !canEditThis}
                            >
                              <SelectTrigger className={`w-full h-9 text-xs font-medium ${getAvailabilityColor(avail)} border-0`} data-testid={`select-avail-${player.id}-${day}`}>
                                <SelectValue><span className="truncate">{avail}</span></SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {slotLabels.map((label) => (
                                  <SelectItem key={label} value={label}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
                })}
              )}
            </tbody>
          </table>
        </div>

        {players.length === 0 && (
          <div className="py-12 text-center text-muted-foreground" data-testid="text-no-players">
            No players in the schedule. Add players to get started.
          </div>
        )}
      </div>

      {staffMembers.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border border-border bg-card">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" data-testid="text-staff-section-title">Staff Availability</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30">
                  <th className="border-r border-border px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide">
                    Role
                  </th>
                  <th className="border-r border-border px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide min-w-[140px]">
                    Staff
                  </th>
                  {dayOfWeek.map((day) => (
                    <th key={day} className="border-r border-border px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide min-w-[160px] last:border-r-0">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((s) => (
                  <tr key={s.id} className="border-t border-border hover-elevate" data-testid={`row-staff-${s.id}`}>
                    <td className="border-r border-border px-4 py-2 bg-card">
                      <Badge variant="secondary" className="text-xs">{s.role}</Badge>
                    </td>
                    <td className="border-r border-border px-4 py-2 bg-card">
                      <span className="text-sm font-medium" data-testid={`text-staff-name-${s.id}`}>{s.name}</span>
                    </td>
                    {dayOfWeek.map((day) => {
                      const avail = s.availability[day] || "unknown";
                      return (
                        <td key={day} className="border-r border-border px-2 py-2 bg-card">
                          <Select
                            value={avail}
                            onValueChange={(value: string) => onStaffAvailabilityChange(s.id, day as DayOfWeek, value)}
                            disabled={isLoading || !(canEditAll || editableStaffId === s.id)}
                          >
                            <SelectTrigger className={`w-full h-9 text-xs font-medium ${getAvailabilityColor(avail)} border-0`} data-testid={`select-staff-avail-${s.id}-${day}`}>
                              <SelectValue><span className="truncate">{avail}</span></SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {slotLabels.map((label) => (
                                <SelectItem key={label} value={label}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
