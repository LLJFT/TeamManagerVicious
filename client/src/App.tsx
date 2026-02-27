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
import NotFound from "@/pages/not-found";

function GameRoutes({ slug }: { slug: string }) {
  return (
    <Switch>
      <Route path={`/${slug}`} component={Home} />
      <Route path={`/${slug}/events`} component={Events} />
      <Route path={`/${slug}/events/:id`} component={EventDetails} />
      <Route path={`/${slug}/results`} component={EventsResults} />
      <Route path={`/${slug}/history`} component={History} />
      <Route path={`/${slug}/stats`} component={UnifiedStats} />
      <Route path={`/${slug}/compare`} component={Compare} />
      <Route path={`/${slug}/opponents`} component={OpponentStats} />
      <Route path={`/${slug}/players`} component={Players} />
      <Route path={`/${slug}/dashboard`} component={Dashboard} />
      <Route path={`/${slug}/staff`} component={StaffPage} />
      <Route path={`/${slug}/chat`} component={Chat} />
      <Route path={`/${slug}/player-stats`} component={PlayerStats} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GameAccessGate({ slug }: { slug: string }) {
  const { hasGameAccess } = useAuth();
  const { currentGame } = useGame();
  const [, navigate] = useLocation();

  if (currentGame && !hasGameAccess(currentGame.id)) {
    navigate("/", { replace: true });
    return null;
  }

  return <GameRoutes slug={slug} />;
}

function MainContent() {
  const { currentGame, gameSlug, allGames, isLoading } = useGame();

  if (currentGame && gameSlug) {
    return <GameAccessGate slug={gameSlug} />;
  }

  return (
    <Switch>
      <Route path="/" component={GamesHome} />
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
                  <NotificationBell />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto">
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
