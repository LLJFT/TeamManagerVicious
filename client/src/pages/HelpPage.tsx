import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HelpCircle,
  Calendar,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  CreditCard,
  LifeBuoy,
  Search,
  ExternalLink,
  Bell,
  Share2,
  ArrowRight,
} from "lucide-react";
import { SiDiscord, SiX } from "react-icons/si";

interface HelpSection {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  blurb: string;
  topics: { q: string; a: string }[];
}

const SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: HelpCircle,
    blurb: "The basics of signing in, switching games and rosters, and finding your way around.",
    topics: [
      {
        q: "Signing in",
        a: "Use the username and password your team admin provided on the Login page. If you forget your password, ask a Management user or the Boss account to reset it from the Users page.",
      },
      {
        q: "Switching games and rosters",
        a: "Use the sidebar to pick a game (Marvel Rivals, Overwatch, Valorant, etc.). Inside a game, the roster picker at the top of the sidebar lets you jump between teams. Your access controls which rosters you can see.",
      },
      {
        q: "Sidebar navigation",
        a: "The left sidebar is grouped by area: roster pages (Schedule, Events, Players, Stats, Chat), org-wide pages (Calendar, Org Chat), and an Administration section that only Management/Admin users see. Hover any icon for a quick tooltip.",
      },
      {
        q: "Header controls",
        a: "Top-right of every page you'll find Help (this guide), Notifications (bell), and the theme switcher (palette). Hover each one for a tooltip describing what it does.",
      },
    ],
  },
  {
    id: "schedule-events",
    title: "Schedule & events",
    icon: Calendar,
    blurb: "Create scrims, tournaments and practices, mark attendance, and record results.",
    topics: [
      {
        q: "Creating an event",
        a: "Open Schedule or Events in the sidebar and click \"New Event\". Pick the type (Scrim, Tournament, Practice, etc.), the date/time, and the opponent if it applies. Save and the event shows up on the calendar.",
      },
      {
        q: "Marking attendance",
        a: "Open an event and click \"Attendance\". Mark each player as Present, Late, or Absent. You can also add ringers and notes. Stats roll up on the Players page under \"Attendance Statistics\".",
      },
      {
        q: "Recording results",
        a: "On a finished event, open it and use the \"Games\" section to enter the score for each map/round. Add VOD links and per-game player stats so the analytics pages have data to work with.",
      },
      {
        q: "Sharing results",
        a: "Every completed event has a Share button (the share icon) — it copies a formatted summary of the result to your clipboard so you can paste it straight into Discord or X.",
      },
    ],
  },
  {
    id: "players-staff",
    title: "Players & staff",
    icon: Users,
    blurb: "Manage your roster: players, staff, roles, and team notes.",
    topics: [
      {
        q: "Adding a player",
        a: "Open Players → use the \"Add Player\" form at the top. Pick a roster role (Tank, DPS, Support, Flex, etc.) and save. Players appear in the roster table and become selectable for events.",
      },
      {
        q: "Editing or removing",
        a: "Each player and attendance row has small icon buttons on the right — pencil to edit, trash to remove. Hover them for tooltips. Removing a player keeps their historical stats intact.",
      },
      {
        q: "Staff",
        a: "The Staff page works the same as Players but for non-playing roles (coach, analyst, manager). Staff also get attendance tracking on events.",
      },
      {
        q: "Team notes",
        a: "On the Players page you'll find a Team Notes table. Anyone with access can post a note that the whole roster sees. Use it for shoutouts, reminders, or scrim notes.",
      },
    ],
  },
  {
    id: "stats",
    title: "Statistics & analytics",
    icon: BarChart3,
    blurb: "Per-game stats, comparisons, leaderboards, and trend analysis.",
    topics: [
      {
        q: "Recording per-game stats",
        a: "Inside an event's Games section, expand a game and fill in stat fields per player (kills, deaths, healing, etc. — fields are configured per game on the Dashboard).",
      },
      {
        q: "Stats vs. Compare",
        a: "Stats shows aggregated per-player and per-team performance with filters (date range, map, mode, opponent). Compare lets you put two players (or two time ranges) side-by-side.",
      },
      {
        q: "Leaderboards",
        a: "Player Leaderboard ranks individuals on the roster by any tracked stat. Team Leaderboard ranks the team across opponents and seasons.",
      },
      {
        q: "Insights",
        a: "Hero Insights, Map Insights, Draft Stats, Trends, and Team Comps each focus on one slice — pick heroes, maps, draft order, time trends, or full comps — and surface win-rate and usage patterns.",
      },
    ],
  },
  {
    id: "communication",
    title: "Chat & notifications",
    icon: MessageSquare,
    blurb: "Talk to your roster and stay on top of what's happening.",
    topics: [
      {
        q: "Roster chat",
        a: "Each roster has its own Chat page with channels. Admins can create channels and limit them to specific roles (e.g. coaches only).",
      },
      {
        q: "Org chat",
        a: "Org Chat (in the sidebar) is for cross-roster conversation and is visible to everyone in the organization with the org_chat permission.",
      },
      {
        q: "Notifications",
        a: "The bell icon in the header shows unread mentions, event reminders, and admin announcements. Click it to read or mark all as read.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard & configuration",
    icon: Settings,
    blurb: "Per-roster configuration: game data, users, roles, and game-specific systems.",
    topics: [
      {
        q: "Game Config",
        a: "On the roster Dashboard, the Game Config tab is where you tune game-specific data: heroes, maps, modes, and seasons. Changes apply only to that game.",
      },
      {
        q: "Opponents, Hero Ban, Map Veto",
        a: "Each of these tabs lets you maintain the lists used elsewhere — opponents that show up on the Schedule, the hero ban order shown during draft, and the map-veto flow shown on tournament events.",
      },
      {
        q: "Users, Roles, Event Types, Stat Fields",
        a: "The Users tab lists everyone with access to this roster. Roles defines org-level permissions. Event Types controls what kind of events you can create. Stat Fields controls which numbers are recorded per game.",
      },
      {
        q: "Activity & Reset",
        a: "Activity shows a timeline of changes on the roster (audit log). Reset Roster is a destructive action gated to super_admin — wipes data with confirmation.",
      },
    ],
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    icon: CreditCard,
    blurb: "How access is gated and where to check your plan.",
    topics: [
      {
        q: "Plan status",
        a: "Open the home page and switch to the \"My Plan\" tab, or open any roster Dashboard and switch to the \"Plan\" tab. You'll see status (Active / Inactive), plan type (Trial / Paid), start and end dates, and days remaining.",
      },
      {
        q: "Countdown banner",
        a: "When a plan is within 14 days of expiring you'll see a sticky banner at the top of every page. It turns red within 3 days. Click the X to dismiss for 12 hours. Super admins never see this banner.",
      },
      {
        q: "Managing subscriptions (super_admin)",
        a: "Open Subscriptions in the sidebar Administration group. From there you can create, edit, delete, or override (force active / force inactive) any user's subscription.",
      },
      {
        q: "Locked out?",
        a: "If your plan lapses you'll see a block screen on every page except this Help guide and the subscription endpoints. Contact a super_admin or the Boss account to renew.",
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    icon: LifeBuoy,
    blurb: "Where to ask for help, report issues, or stay in the loop.",
    topics: [
      {
        q: "Discord",
        a: "Join our Discord for real-time help, feature requests, and community. The link is also in the sidebar.",
      },
      {
        q: "X (Twitter)",
        a: "Follow @The__BootCamp for product updates and announcements. The link is in the sidebar too.",
      },
      {
        q: "Reporting a bug",
        a: "Drop a message in the #support channel on Discord with a quick description and a screenshot if you can. Include the page URL — it helps us reproduce the issue fast.",
      },
    ],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS
      .map(section => ({
        ...section,
        topics: section.topics.filter(
          t => t.q.toLowerCase().includes(q) || t.a.toLowerCase().includes(q),
        ),
      }))
      .filter(s => s.topics.length > 0 || s.title.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.find(s => s.id === activeId)) {
      setActiveId(filtered[0].id);
    }
  }, [filtered, activeId]);

  const scrollTo = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(`help-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-2">
        <HelpCircle className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Help & Guide</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        Everything you need to use the platform — from creating your first event to reading the
        analytics pages. Use the search box or jump to a section.
      </p>

      <div className="relative max-w-md mb-6">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search help topics…"
          className="pl-9"
          data-testid="input-help-search"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <nav className="md:sticky md:top-20 self-start space-y-1" data-testid="nav-help-toc">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                onClick={() => scrollTo(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover-elevate ${isActive ? "bg-accent font-medium" : "text-muted-foreground"}`}
                data-testid={`link-help-toc-${section.id}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{section.title}</span>
              </button>
            );
          })}
          <div className="pt-3 mt-3 border-t space-y-1">
            <a
              href="https://discord.gg/HrGFwMxaD"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover-elevate"
              data-testid="link-help-discord"
            >
              <SiDiscord className="h-4 w-4" />
              <span>Discord</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
            <a
              href="https://x.com/The__BootCamp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover-elevate"
              data-testid="link-help-x"
            >
              <SiX className="h-4 w-4" />
              <span>X / Twitter</span>
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
          </div>
        </nav>

        <div className="space-y-6 min-w-0">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground" data-testid="text-help-no-results">
                No help topics match "{query}". Try a different search term.
              </CardContent>
            </Card>
          ) : (
            filtered.map(section => {
              const Icon = section.icon;
              return (
                <Card key={section.id} id={`help-${section.id}`} data-testid={`section-help-${section.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{section.blurb}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {section.topics.length} {section.topics.length === 1 ? "topic" : "topics"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.topics.map((topic, idx) => (
                      <div key={idx} className="border-t pt-4 first:border-t-0 first:pt-0" data-testid={`topic-${section.id}-${idx}`}>
                        <h3 className="text-sm font-semibold text-foreground mb-1">{topic.q}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{topic.a}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}

          <Card data-testid="section-help-quicklinks">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                Quick links
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              <Link href="/" data-testid="link-quick-home">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" /> Back to home
                </Button>
              </Link>
              <Link href="/account" data-testid="link-quick-account">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" /> Account settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
