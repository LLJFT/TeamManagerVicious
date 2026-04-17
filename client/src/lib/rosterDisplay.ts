export interface RosterLike {
  name: string;
  customName?: string | null;
}

export function getRosterDisplayName(roster: RosterLike | null | undefined): string {
  if (!roster) return "";
  return (roster.customName && roster.customName.trim()) || roster.name;
}
