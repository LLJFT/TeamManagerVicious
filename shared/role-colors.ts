export const DEFAULT_ROLE_PALETTE: string[] = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export const FALLBACK_ROLE_COLOR = "#000000";

export function defaultColorForSortOrder(sortOrder: number): string {
  if (typeof sortOrder !== "number" || sortOrder < 0) return FALLBACK_ROLE_COLOR;
  return DEFAULT_ROLE_PALETTE[sortOrder] ?? FALLBACK_ROLE_COLOR;
}

export function isValidHexColor(input: unknown): input is string {
  return typeof input === "string" && /^#[0-9a-fA-F]{6}$/.test(input);
}

export function normalizeColor(input: unknown, fallback: string = FALLBACK_ROLE_COLOR): string {
  if (isValidHexColor(input)) return (input as string).toLowerCase();
  return fallback;
}

export function readableTextColor(hex: string): string {
  const c = isValidHexColor(hex) ? hex : FALLBACK_ROLE_COLOR;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

export function softBackgroundFromColor(hex: string, alpha: number = 0.18): string {
  const c = isValidHexColor(hex) ? hex : FALLBACK_ROLE_COLOR;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
