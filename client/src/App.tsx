import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import Login from "@/pages/Login";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/events" component={Events} />
      <Route path="/events/:id" component={EventDetails} />
      <Route path="/results" component={EventsResults} />
      <Route path="/history" component={History} />
      <Route path="/stats" component={UnifiedStats} />
      <Route path="/compare" component={Compare} />
      <Route path="/opponents" component={OpponentStats} />
      <Route path="/players" component={Players} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/staff" component={StaffPage} />
      <Route path="/chat" component={Chat} />
      <Route path="/account" component={AccountSettings} />
      <Route path="/player-stats" component={PlayerStats} />
      <Route component={NotFound} />
    </Switch>
  );
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
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-1 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
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
