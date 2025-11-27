import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import EventsResults from "@/pages/EventsResults";
import EventsHistory from "@/pages/EventsHistory";
import Stats from "@/pages/Stats";
import Players from "@/pages/Players";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/events" component={Events} />
      <Route path="/events/:id" component={EventDetails} />
      <Route path="/results" component={EventsResults} />
      <Route path="/history" component={EventsHistory} />
      <Route path="/stats" component={Stats} />
      <Route path="/players" component={Players} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

const APP_PASSWORD = "1975";

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      localStorage.setItem("site_authed", "true"); // Trust device
      onUnlock();
    } else {
      setError("Wrong password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="border border-border rounded-xl p-6 w-full max-w-sm space-y-4 bg-card"
      >
        <h1 className="text-xl font-bold text-center">Enter Password</h1>
        <input
          type="password"
          className="w-full border rounded px-3 py-2 bg-background"
          placeholder="Password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          className="w-full rounded px-3 py-2 bg-yellow-500 text-black font-semibold"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("site_authed") === "true") {
      setAuthed(true);
    }
  }, []);

  if (!authed) {
    return <PasswordGate onUnlock={() => setAuthed(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
