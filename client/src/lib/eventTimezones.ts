export const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Greenwich)", offset: 0 },
  { value: "CET", label: "CET (UTC+1)", offset: 1 },
  { value: "CEST", label: "CEST (UTC+2)", offset: 2 },
  { value: "KSA", label: "KSA (UTC+3)", offset: 3 },
  { value: "MSK", label: "MSK (UTC+3)", offset: 3 },
  { value: "GST", label: "GST (UTC+4)", offset: 4 },
  { value: "IST", label: "IST (UTC+5:30)", offset: 5.5 },
  { value: "CST_CN", label: "CST China (UTC+8)", offset: 8 },
  { value: "KST", label: "KST (UTC+9)", offset: 9 },
  { value: "AEST", label: "AEST (UTC+10)", offset: 10 },
  { value: "EST", label: "EST (UTC-5)", offset: -5 },
  { value: "CST_US", label: "CST US (UTC-6)", offset: -6 },
  { value: "MST", label: "MST (UTC-7)", offset: -7 },
  { value: "PST", label: "PST (UTC-8)", offset: -8 },
  { value: "WIB", label: "WIB (UTC+7)", offset: 7 },
  { value: "SGT", label: "SGT (UTC+8)", offset: 8 },
  { value: "JST", label: "JST (UTC+9)", offset: 9 },
  { value: "NZST", label: "NZST (UTC+12)", offset: 12 },
  { value: "CAT", label: "CAT (UTC+2)", offset: 2 },
  { value: "WAT", label: "WAT (UTC+1)", offset: 1 },
  { value: "ART", label: "ART (UTC-3)", offset: -3 },
  { value: "COT", label: "COT (UTC-5)", offset: -5 },
  { value: "AKT", label: "AKT (UTC-9)", offset: -9 },
  { value: "HST", label: "HST (UTC-10)", offset: -10 },
  { value: "SAST", label: "SAST (UTC+2)", offset: 2 },
  { value: "EAT", label: "EAT (UTC+3)", offset: 3 },
  { value: "PKT", label: "PKT (UTC+5)", offset: 5 },
  { value: "BDT", label: "BDT (UTC+6)", offset: 6 },
  { value: "ICT", label: "ICT (UTC+7)", offset: 7 },
  { value: "PHT", label: "PHT (UTC+8)", offset: 8 },
  { value: "AWST", label: "AWST (UTC+8)", offset: 8 },
  { value: "TRT", label: "TRT (UTC+3)", offset: 3 },
  { value: "EET", label: "EET (UTC+2)", offset: 2 },
  { value: "BRT", label: "BRT (UTC-3)", offset: -3 },
];

export function getTzOffset(tz: string | null | undefined): number {
  return TIMEZONE_OPTIONS.find(t => t.value === tz)?.offset ?? 0;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export function shiftDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
  offsetHours: number
): { date: string; time: string } {
  if (!dateStr) return { date: "", time: "" };
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return { date: dateStr, time: timeStr || "" };
  const [h, mi] = (timeStr || "00:00").split(":").map(Number);
  const ms = Date.UTC(y, mo - 1, d, h || 0, mi || 0) + Math.round(offsetHours * 3600000);
  const u = new Date(ms);
  return {
    date: `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`,
    time: timeStr ? `${pad(u.getUTCHours())}:${pad(u.getUTCMinutes())}` : "",
  };
}

export function localToUtc(dateStr: string, timeStr: string, sourceOffsetHours: number) {
  return shiftDateTime(dateStr, timeStr, -sourceOffsetHours);
}

export function utcToLocal(dateStr: string, timeStr: string | null | undefined, displayOffsetHours: number) {
  return shiftDateTime(dateStr, timeStr, displayOffsetHours);
}
