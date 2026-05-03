import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "subscriptionBanner.dismissedUntil";
const WARN_THRESHOLD_DAYS = 14;

export function SubscriptionCountdownBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      return Date.now() < Number(raw);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  if (!user) return null;
  if (user.orgRole === "super_admin") return null;

  const sub = user.subscription;
  if (!sub || sub.bypass) return null;
  if (sub.status !== "active") return null;
  if (sub.manualActiveOverride === true) return null;
  const days = sub.daysRemaining;
  if (typeof days !== "number") return null;
  if (days > WARN_THRESHOLD_DAYS) return null;
  if (dismissed) return null;

  const urgent = days <= 3;
  const Icon = urgent ? AlertTriangle : Clock;
  const label =
    days < 0
      ? "Your subscription has expired"
      : days === 0
      ? "Your subscription expires today"
      : days === 1
      ? "Your subscription expires tomorrow"
      : `Your subscription expires in ${days} days`;
  const planLabel = sub.type === "trial" ? "trial" : "plan";

  const onDismiss = () => {
    try {
      const until = Date.now() + 1000 * 60 * 60 * 12;
      sessionStorage.setItem(DISMISS_KEY, String(until));
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      className={`sticky top-0 z-40 flex items-center gap-2 px-4 py-2 text-sm border-b backdrop-blur ${
        urgent
          ? "bg-destructive/15 border-destructive/30"
          : "bg-amber-500/15 border-amber-500/30"
      }`}
      data-testid="banner-subscription-countdown"
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${urgent ? "text-destructive" : "text-amber-600 dark:text-amber-500"}`} />
      <span className="flex-1 min-w-0" data-testid="text-banner-countdown">
        <span className="font-medium">{label}.</span>{" "}
        <span className="text-muted-foreground">
          Contact The Bootcamp to renew your {planLabel} before access is suspended.
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        title="Dismiss"
        data-testid="button-dismiss-countdown"
        className="h-7 w-7"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
