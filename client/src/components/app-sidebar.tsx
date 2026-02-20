import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
  UserCog, ClipboardList,
} from "lucide-react";

const mainNavItems = [
  { title: "Schedule", url: "/", icon: Home, permission: "view_schedule" as const },
  { title: "Events", url: "/events", icon: Calendar, permission: "view_events" as const },
  { title: "Results", url: "/results", icon: Trophy, permission: "view_results" as const },
  { title: "Players", url: "/players", icon: Users, permission: "view_players" as const },
];

const statsNavItems = [
  { title: "Statistics", url: "/stats", icon: BarChart3, permission: "view_statistics" as const },
  { title: "Player Stats", url: "/player-stats", icon: ClipboardList, permission: "view_player_stats" as const },
  { title: "History", url: "/history", icon: Clock, permission: "view_history" as const },
  { title: "Compare", url: "/compare", icon: GitCompare, permission: "view_compare" as const },
  { title: "Opponents", url: "/opponents", icon: Target, permission: "view_opponents" as const },
];

const managementNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Settings, permission: "view_dashboard" as const },
  { title: "Staff", url: "/staff", icon: UserCog, permission: "view_staff" as const },
  { title: "Chat", url: "/chat", icon: MessageSquare, permission: "view_chat" as const },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, hasPermission } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Team Manager</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {(() => {
          const visibleMain = mainNavItems.filter(item => hasPermission(item.permission));
          const visibleStats = statsNavItems.filter(item => hasPermission(item.permission));
          const visibleMgmt = managementNavItems.filter(item => hasPermission(item.permission));
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
                          <SidebarMenuButton asChild isActive={location === item.url || (item.url === "/dashboard" && location === "/settings")}>
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
              <Badge variant="secondary" className="text-xs">{user?.role?.name || "Member"}</Badge>
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
