import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { GameProvider, useGame } from "@/hooks/use-game";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { HelpButton, OnboardingGuide } from "@/components/OnboardingGuide";
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { Moon, Loader2 } from "lucide-react";
import Login from "@/pages/Login";
import GamesHome from "@/pages/GamesHome";
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import EventsResults from "@/pages/EventsResults";
import History from "@/pages/History";
import UnifiedStats from "@/pages/UnifiedStats";
import Compare from "@/pages/Compare";
import OpponentStats from "@/pages/OpponentStats";
import Players from "@/pages/Players";
import Dashboard from "@/pages/Dashboard";
import StaffPage from "@/pages/Staff";
import Chat from "@/pages/Chat";
import AccountSettings from "@/pages/AccountSettings";
import PlayerStats from "@/pages/PlayerStats";
import OrgDashboard from "@/pages/OrgDashboard";
import CalendarPage from "@/pages/CalendarPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";
import GameAccessPage from "@/pages/GameAccessPage";
import OrgChat from "@/pages/OrgChat";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

function GameRoutes({ slug }: { slug: string }) {
  const basePath = `/${slug}`;
  return (
    <Switch>
      <Route path={basePath} component={Home} />
      <Route path={`${basePath}/events`} component={Events} />
      <Route path={`${basePath}/events/:id`} component={EventDetails} />
      <Route path={`${basePath}/results`} component={EventsResults} />
      <Route path={`${basePath}/history`} component={History} />
      <Route path={`${basePath}/stats`} component={UnifiedStats} />
      <Route path={`${basePath}/compare`} component={Compare} />
      <Route path={`${basePath}/opponents`} component={OpponentStats} />
      <Route path={`${basePath}/players`} component={Players} />
      <Route path={`${basePath}/dashboard`} component={Dashboard} />
      <Route path={`${basePath}/staff`} component={StaffPage} />
      <Route path={`${basePath}/chat`} component={Chat} />
      <Route path={`${basePath}/player-stats`} component={PlayerStats} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GameAccessGate({ slug }: { slug: string }) {
  const { hasGameAccess, hasRosterAccess, user } = useAuth();
  const { currentGame, currentRoster, rosterId, rostersLoading, rosterCodeInvalid } = useGame();
  const [, navigate] = useLocation();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!currentGame || rostersLoading) return;

    if (rosterCodeInvalid) {
      setDenied(true);
      const t = setTimeout(() => navigate("/", { replace: true }), 2000);
      return () => clearTimeout(t);
    }

    if (user?.orgRole === "super_admin" || user?.orgRole === "org_admin") return;

    if (!hasGameAccess(currentGame.id)) {
      setDenied(true);
      const t = setTimeout(() => navigate("/", { replace: true }), 2000);
      return () => clearTimeout(t);
    }
    if (rosterId && !hasRosterAccess(currentGame.id, rosterId)) {
      setDenied(true);
      const t = setTimeout(() => navigate("/", { replace: true }), 2000);
      return () => clearTimeout(t);
    }
  }, [currentGame, rosterId, rostersLoading, user, rosterCodeInvalid]);

  if (denied) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="access-denied">
        <div className="text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">
            {rosterCodeInvalid ? "Page Not Found" : "Access Denied"}
          </h2>
          <p className="text-muted-foreground">
            {rosterCodeInvalid
              ? "The roster you're looking for doesn't exist. Redirecting..."
              : "You don't have permission to access this roster. Redirecting..."}
          </p>
        </div>
      </div>
    );
  }

  if (currentGame && (user?.orgRole !== "super_admin" && user?.orgRole !== "org_admin")) {
    if (!hasGameAccess(currentGame.id)) return null;
    if (rosterId && !hasRosterAccess(currentGame.id, rosterId)) return null;
  }

  return <GameRoutes slug={slug} />;
}

function MainContent() {
  const { currentGame, gameSlug, fullSlug, allGames, isLoading } = useGame();

  if (currentGame && fullSlug) {
    return <GameAccessGate slug={fullSlug} />;
  }

  return (
    <Switch>
      <Route path="/" component={GamesHome} />
      <Route path="/dashboard" component={OrgDashboard} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/roles" component={RolesPage} />
      <Route path="/game-access" component={GameAccessPage} />
      <Route path="/org-chat" component={OrgChat} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/account" component={AccountSettings} />
      <Route>
        {() => {
          if (isLoading) {
            return (
              <div className="flex items-center justify-center h-full p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            );
          }
          return <NotFound />;
        }}
      </Route>
    </Switch>
  );
}

function AfkOverlay() {
  const [isAfk, setIsAfk] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AFK_TIMEOUT = 10 * 60 * 1000;

  const resetTimer = useCallback(() => {
    if (isAfk) setIsAfk(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsAfk(true), AFK_TIMEOUT);
  }, [isAfk]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    timerRef.current = setTimeout(() => setIsAfk(true), AFK_TIMEOUT);
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  if (!isAfk) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm cursor-pointer"
      onClick={resetTimer}
      data-testid="afk-overlay"
    >
      <Moon className="h-16 w-16 text-muted-foreground mb-6 animate-pulse" />
      <h2 className="text-2xl font-bold text-foreground mb-2">You appear to be away</h2>
      <p className="text-muted-foreground">Click anywhere or press any key to return</p>
    </div>
  );
}

function DynamicThemeLoader() {
  const { data: themeData } = useQuery<string | null>({
    queryKey: ["/api/org-setting/org_theme"],
  });

  useEffect(() => {
    if (!themeData) return;
    try {
      const colors = JSON.parse(themeData);
      if (colors.primary) {
        document.documentElement.style.setProperty("--primary", colors.primary);
        document.documentElement.style.setProperty("--sidebar-primary", colors.primary);
      }
      if (colors.primaryForeground) {
        document.documentElement.style.setProperty("--primary-foreground", colors.primaryForeground);
        document.documentElement.style.setProperty("--sidebar-primary-foreground", colors.primaryForeground);
      }
    } catch {}
  }, [themeData]);

  return null;
}

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <>
      <AfkOverlay />
      <GameProvider>
        <DynamicThemeLoader />
        <SidebarProvider style={style as CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center justify-between gap-1 p-2 border-b sticky top-0 z-50 bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-1">
                  <HelpButton />
                  <NotificationBell />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <OnboardingGuide />
                <MainContent />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </GameProvider>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultStyle="default-dark">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AuthenticatedApp />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
