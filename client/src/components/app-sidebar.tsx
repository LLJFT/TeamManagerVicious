import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";
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
import { Badge } from "@/components/ui/badge";
import {
  Home, Calendar, Users, BarChart3, Settings, MessageSquare,
  LogOut, Trophy, Clock, GitCompare, Target, Shield,
  UserCog, ClipboardList, ArrowLeft, Gamepad2,
} from "lucide-react";
import type { Permission } from "@shared/schema";

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
              <Gamepad2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold">{currentGame.name}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Vicious</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {inGameContext && navItems ? (
          <>
            {(() => {
              const visibleMain = navItems.main.filter(item => hasPermission(item.permission));
              const visibleStats = navItems.stats.filter(item => hasPermission(item.permission));
              const visibleMgmt = navItems.management.filter(item => hasPermission(item.permission));
              return (
                <>
                  {visibleMain.length > 0 && (
                    <SidebarGroup>
                      <SidebarGroupLabel>Main</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {visibleMain.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild isActive={location === item.url}>
                                <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <item.icon />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  )}
                  {visibleStats.length > 0 && (
                    <SidebarGroup>
                      <SidebarGroupLabel>Analytics</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {visibleStats.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild isActive={location === item.url}>
                                <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <item.icon />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  )}
                  {visibleMgmt.length > 0 && (
                    <SidebarGroup>
                      <SidebarGroupLabel>Management</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {visibleMgmt.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild isActive={location === item.url}>
                                <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <item.icon />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/"}>
                    <Link href="/" data-testid="nav-home">
                      <Home />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/account"}>
                    <Link href="/account" data-testid="nav-account">
                      <Settings />
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <Badge variant="secondary" className="text-xs">{user?.orgRole || "player"}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/account">
              <Button size="icon" variant="ghost" data-testid="button-account-settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
