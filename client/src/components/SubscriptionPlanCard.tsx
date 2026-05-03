import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ShieldCheck, AlertCircle, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@shared/schema";

interface SubscriptionPlanCardProps {
  showManageLink?: boolean;
  className?: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function SubscriptionPlanCard({ showManageLink = false, className }: SubscriptionPlanCardProps) {
  const { user, hasOrgRole } = useAuth();
  const isSuperAdmin = user?.orgRole === "super_admin";

  const { data: liveStatus, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscriptions/me"],
    staleTime: 1000 * 30,
  });

  const sub = liveStatus || user?.subscription;
  const canSeeAdminLink = showManageLink && hasOrgRole("super_admin" as any);

  if (isLoading && !sub) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>My Plan</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading subscription details…</p>
        </CardContent>
      </Card>
    );
  }

  const active = sub?.status === "active";
  const bypass = sub?.bypass === true;
  const planType = sub?.type || (bypass ? "Admin bypass" : "—");
  const statusLabel = bypass
    ? "Active (Admin)"
    : active
    ? "Active"
    : "Inactive";

  const statusVariant: "default" | "secondary" | "destructive" | "outline" =
    bypass ? "secondary" : active ? "default" : "destructive";

  const days = sub?.daysRemaining;

  return (
    <Card className={className} data-testid="card-subscription-plan">
      <CardHeader className="pb-3 gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {isSuperAdmin ? "Subscription (Admin)" : "My Plan"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="text-base font-semibold flex items-center gap-2 mt-0.5">
              <Badge variant={statusVariant} data-testid="badge-plan-status">{statusLabel}</Badge>
              {sub?.manualActiveOverride === true && (
                <Badge variant="outline" className="text-xs">Manual override</Badge>
              )}
              {sub?.manualActiveOverride === false && (
                <Badge variant="outline" className="text-xs">Forced inactive</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan type</p>
            <p className="text-base font-semibold capitalize mt-0.5" data-testid="text-plan-type">
              {planType === "trial" ? "Trial" : planType === "paid" ? "Paid" : planType}
            </p>
          </div>
        </div>

        {bypass ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium">Super admin bypass</p>
              <p className="text-muted-foreground">
                Your account always has full access regardless of subscription state.
              </p>
            </div>
          </div>
        ) : sub?.hasSubscription ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="font-medium" data-testid="text-plan-start">{formatDate(sub.startDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Ends</p>
                <p className="font-medium" data-testid="text-plan-end">{formatDate(sub.endDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Time remaining</p>
                <p className="font-medium" data-testid="text-plan-days-remaining">
                  {typeof days === "number"
                    ? days < 0
                      ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
                      : days === 0
                      ? "Expires today"
                      : `${days} day${days === 1 ? "" : "s"} remaining`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">No active subscription</p>
              <p className="text-muted-foreground">
                Contact The Bootcamp to start a trial or activate a paid plan.
              </p>
            </div>
          </div>
        )}

        {canSeeAdminLink && (
          <div className="pt-2 border-t">
            <Button asChild variant="outline" size="sm" data-testid="link-manage-subscriptions">
              <Link href="/subscriptions">
                <SettingsIcon className="h-4 w-4" />
                Manage all subscriptions
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
