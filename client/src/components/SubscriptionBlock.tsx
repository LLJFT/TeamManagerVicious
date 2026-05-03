import { Lock, LogOut } from "lucide-react";
import { SiDiscord, SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SubscriptionStatus } from "@shared/schema";

interface SubscriptionBlockProps {
  subscription?: SubscriptionStatus;
  username?: string | null;
  onLogout: () => void;
}

const DISCORD_URL = "https://discord.gg/HrGFwMxaD";
const TWITTER_URL = "https://x.com/The__BootCamp";

export function SubscriptionBlock({ subscription, username, onLogout }: SubscriptionBlockProps) {
  const expired =
    subscription?.hasSubscription &&
    subscription.manualActiveOverride !== false &&
    typeof subscription.daysRemaining === "number" &&
    subscription.daysRemaining < 0;

  const headline = expired ? "Your subscription has expired" : "Subscription required";
  const subline = subscription?.hasSubscription
    ? expired
      ? `Your ${subscription.type === "trial" ? "trial" : "plan"} ended on ${formatDate(subscription.endDate)}.`
      : "Your account is currently inactive. Please contact The Bootcamp to reactivate."
    : "Your account does not have an active subscription yet. Reach out to The Bootcamp to get started.";

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
      data-testid="subscription-block"
    >
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-6 px-6 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-block-headline">{headline}</h1>
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-block-subline">{subline}</p>
          </div>

          {username && (
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{username}</span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
            <Button
              asChild
              className="flex-1"
              data-testid="button-block-discord"
            >
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
                <SiDiscord className="h-4 w-4" />
                Join our Discord
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1"
              data-testid="button-block-twitter"
            >
              <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer">
                <SiX className="h-4 w-4" />
                Follow on X
              </a>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            data-testid="button-block-logout"
            className="mt-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
