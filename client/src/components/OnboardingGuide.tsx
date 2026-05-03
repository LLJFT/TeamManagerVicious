import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, BarChart3, Users, Settings, MessageSquare, ClipboardList, HelpCircle, ChevronRight, ChevronLeft } from "lucide-react";

const ONBOARDING_KEY = "bootcamp_onboarding_seen";
const HELP_EVENT = "bootcamp_show_help";

const steps = [
  {
    icon: Calendar,
    title: "Events & Calendar",
    description: "Create and manage events like tournaments, scrims, and practices. Track results with game-by-game scoring and VOD links. Use the calendar view to see upcoming events at a glance.",
  },
  {
    icon: Users,
    title: "Players & Staff",
    description: "Add players and staff to your roster. Assign roster roles and track availability for upcoming events. Mark attendance (Present, Late, Absent) on each event.",
  },
  {
    icon: BarChart3,
    title: "Statistics & Analytics",
    description: "Record per-game player stats. View performance breakdowns by game mode, map, opponent, and player. Compare time periods to track improvement.",
  },
  {
    icon: Settings,
    title: "Dashboard & Config",
    description: "Configure game modes, maps, seasons, stat fields, and event types from the Dashboard. Manage users, roles, and permissions to control access.",
  },
  {
    icon: MessageSquare,
    title: "Chat & Communication",
    description: "Use team chat channels to communicate with your roster. Create channels with custom permissions for different groups.",
  },
  {
    icon: ClipboardList,
    title: "Sharing & Results",
    description: "Share event results with a single click using the share button on completed events. Results are formatted and copied to your clipboard ready to paste anywhere.",
  },
];

export function OnboardingGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      setOpen(true);
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
  }, []);

  const handleHelpEvent = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(HELP_EVENT, handleHelpEvent);
    return () => window.removeEventListener(HELP_EVENT, handleHelpEvent);
  }, [handleHelpEvent]);

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[460px]" data-testid="dialog-onboarding">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Getting Started
          </DialogTitle>
          <p className="sr-only" id="onboarding-desc">Step-by-step guide to using the platform</p>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="text-center font-semibold text-base mb-2">{currentStep.title}</h3>
          <p className="text-center text-sm text-muted-foreground leading-relaxed px-2">
            {currentStep.description}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                onClick={() => setStep(i)}
                data-testid={`button-onboarding-dot-${i}`}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            data-testid="button-onboarding-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="text-xs text-muted-foreground">
            {step + 1} / {steps.length}
          </div>
          {step < steps.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              data-testid="button-onboarding-next"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setOpen(false)}
              data-testid="button-onboarding-done"
            >
              Get Started
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HelpButton() {
  const [, navigate] = useLocation();
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/help")}
          data-testid="button-help"
          aria-label="Help & Guide"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Help & Guide</TooltipContent>
    </Tooltip>
  );
}
