import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Home, Calendar, Users, BarChart3, Settings, MessageSquare,
  LogOut, Trophy, Clock, GitCompare, Target, Shield,
  UserCog, ClipboardList, ArrowLeft,
} from "lucide-react";
import {
  SiValorant, SiLeagueoflegends, SiCounterstrike, SiDota2, SiPubg,
} from "react-icons/si";
import type { Permission } from "@shared/schema";

const GAME_COLORS: Record<string, string> = {
  "valorant":     "#FF4655",
  "lol":          "#C89B3C",
  "cs":           "#F0A03E",
  "dota2":        "#9B1C1F",
  "pubg":         "#F5A623",
  "pubg-mobile":  "#F5A623",
  "overwatch":    "#FA9C1E",
  "apex":         "#CD3333",
  "fortnite":     "#00C3FF",
  "rocket-league":"#0066FF",
  "r6":           "#009BDE",
  "cod":          "#8CC63F",
  "mlbb":         "#1A7EC6",
  "hok":          "#FFB800",
  "brawl-stars":  "#FF2A6D",
  "marvel-rivals":"#E62429",
  "ea-fc":        "#00B2FF",
  "free-fire":    "#FF6B00",
  "tft":          "#C8AA6E",
  "crossfire":    "#00A1E0",
  "deadlock":     "#6B4226",
  "trackmania":   "#009DDC",
  "the-finals":   "#FFD700",
  "fighting-games":"#9333EA",
};

const SI_ICONS: Record<string, any> = {
  "valorant": SiValorant,
  "lol":      SiLeagueoflegends,
  "cs":       SiCounterstrike,
  "dota2":    SiDota2,
  "pubg":     SiPubg,
  "pubg-mobile": SiPubg,
};

function GameBadge({ slug, name }: { slug: string; name: string }) {
  const SIIcon = SI_ICONS[slug];
  const color = GAME_COLORS[slug] || "#6B7280";
  if (SIIcon) {
    return (
      <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <SIIcon style={{ color, fontSize: 14 }} />
      </div>
    );
  }
  const abbr = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="h-6 w-6 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${color}20`, color }}>
      {abbr}
    </div>
  );
}

function makeGameItems(prefix: string) {
  return {
    main: [
      { title: "Schedule", url: `${prefix}`, icon: Home, permission: "view_schedule" as Permission },
      { title: "Events", url: `${prefix}/events`, icon: Calendar, permission: "view_events" as Permission },
      { title: "Results", url: `${prefix}/results`, icon: Trophy, permission: "view_results" as Permission },
      { title: "Players", url: `${prefix}/players`, icon: Users, permission: "view_players" as Permission },
    ],
    stats: [
      { title: "Statistics", url: `${prefix}/stats`, icon: BarChart3, permission: "view_statistics" as Permission },
      { title: "Player Stats", url: `${prefix}/player-stats`, icon: ClipboardList, permission: "view_player_stats" as Permission },
      { title: "History", url: `${prefix}/history`, icon: Clock, permission: "view_history" as Permission },
      { title: "Compare", url: `${prefix}/compare`, icon: GitCompare, permission: "view_compare" as Permission },
      { title: "Opponents", url: `${prefix}/opponents`, icon: Target, permission: "view_opponents" as Permission },
    ],
    management: [
      { title: "Dashboard", url: `${prefix}/dashboard`, icon: Settings, permission: "view_dashboard" as Permission },
      { title: "Staff", url: `${prefix}/staff`, icon: UserCog, permission: "view_staff" as Permission },
      { title: "Chat", url: `${prefix}/chat`, icon: MessageSquare, permission: "view_chat" as Permission },
    ],
  };
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { currentGame, gameSlug } = useGame();

  const { data: orgLogoUrl } = useQuery<string | null>({
    queryKey: ["/api/org-setting/org_logo"],
    staleTime: 1000 * 60 * 5,
  });

  const inGameContext = !!currentGame && !!gameSlug;
  const prefix = inGameContext ? `/${gameSlug}` : "";
  const navItems = inGameContext ? makeGameItems(prefix) : null;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        {inGameContext ? (
          <div className="space-y-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 -ml-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                <span>All Games</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <GameBadge slug={currentGame.slug} name={currentGame.name} />
              <span className="text-sm font-bold truncate">{currentGame.name}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt="Organization Logo"
                className="h-8 w-8 rounded object-contain flex-shrink-0"
                data-testid="img-org-logo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <Shield className="h-6 w-6 text-primary flex-shrink-0" />
            )}
            <span className="text-lg font-bold truncate">Vicious</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {inGameContext && navItems ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Main</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.main.filter(item => hasPermission(item.permission)).map(item => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url || (item.url === prefix && location === prefix)}>
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Analytics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.stats.filter(item => hasPermission(item.permission)).map(item => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.management.filter(item => hasPermission(item.permission)).map(item => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url}>
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/"}>
                    <Link href="/">
                      <Home className="h-4 w-4" />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/account"}>
                    <Link href="/account">
                      <UserCog className="h-4 w-4" />
                      <span>Account</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.orgRole || user?.role?.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            data-testid="button-logout"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
