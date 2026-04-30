import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Opponent } from "@shared/schema";

interface OpponentAvatarProps {
  name?: string | null;
  opponents?: Opponent[];
  opponent?: Opponent | null;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP: Record<NonNullable<OpponentAvatarProps["size"]>, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function findOpponentByName(
  opponents: Opponent[] | undefined,
  name: string | null | undefined,
): Opponent | null {
  if (!opponents || !name) return null;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;
  return (
    opponents.find(
      (o) =>
        o.name.trim().toLowerCase() === trimmed ||
        (o.shortName ? o.shortName.trim().toLowerCase() === trimmed : false),
    ) || null
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const initials = parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return initials || "?";
}

export function OpponentAvatar({
  name,
  opponents,
  opponent,
  logoUrl,
  size = "md",
  className = "",
}: OpponentAvatarProps) {
  const opp = opponent ?? findOpponentByName(opponents, name);
  const displayName = opp?.name ?? name ?? "?";
  const initials = getInitials(displayName);
  const cls = `${SIZE_MAP[size]} shrink-0 ${className}`.trim();
  const testId = opp?.id ? `avatar-opponent-${opp.id}` : undefined;
  const src = logoUrl ?? opp?.logoUrl ?? null;
  return (
    <Avatar className={cls} data-testid={testId}>
      {src ? <AvatarImage src={src} alt={displayName} /> : null}
      <AvatarFallback className="font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}
