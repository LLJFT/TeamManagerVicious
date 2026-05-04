import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

function parseEndOfDay(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
    return d.getTime();
  }
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function formatRemaining(msLeft: number): { text: string; tone: "normal" | "warn" | "expired" } {
  if (msLeft <= 0) return { text: "Expired", tone: "expired" };
  const totalMinutes = Math.floor(msLeft / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) {
    return { text: `${days}d ${hours}h ${minutes}m`, tone: "normal" };
  }
  if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, tone: "normal" };
  }
  return { text: `${minutes}m left`, tone: "warn" };
}

export function SubscriptionStatusPill() {
  const { user } = useAuth();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!user) return null;
  if (user.orgRole === "super_admin") return null;
  const sub = user.subscription;
  if (!sub) return null;
  if (sub.bypass) return null;
  if (!sub.hasSubscription) return null;
  if (sub.status !== "active") return null;
  if (!sub.endDate) return null;
  if (!sub.type) return null;

  const endMs = parseEndOfDay(sub.endDate);
  const msLeft = endMs - now;
  const { text, tone } = formatRemaining(msLeft);

  if (tone === "expired") {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-destructive/15 border border-destructive/30 text-destructive"
        data-testid="pill-subscription-status"
      >
        <span data-testid="text-subscription-countdown">Subscription expired</span>
      </div>
    );
  }

  const isTrial = sub.type === "trial";
  const badgeClass = isTrial
    ? "bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950"
    : "bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white";
  const countdownClass = tone === "warn" ? "text-destructive font-semibold" : "text-foreground/80";

  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs"
      data-testid="pill-subscription-status"
    >
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide leading-none ${badgeClass}`}
        data-testid="text-subscription-type"
      >
        {isTrial ? "TRIAL" : "PAID"}
      </span>
      <span className={`tabular-nums leading-none ${countdownClass}`} data-testid="text-subscription-countdown">
        {text}
      </span>
    </div>
  );
}
