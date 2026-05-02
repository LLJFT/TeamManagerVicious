import { useState } from "react";
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
  UserCog, ClipboardList, ArrowLeft, LayoutDashboard,
  ShieldCheck, Gamepad2, KeyRound, Layers, Image as ImageIcon,
  Swords,
} from "lucide-react";
import type { Permission, OrgRole } from "@shared/schema";
import { orgRoleLabels } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { GameBadge } from "@/components/game-icon";

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
      { title: "Draft Stats", url: `${prefix}/draft-stats`, icon: Swords, permission: "view_statistics" as Permission },
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
  const { user, logout, hasPermission, hasOrgRole } = useAuth();
  const { currentGame, gameSlug, fullSlug, currentRoster } = useGame();

  const { data: orgLogoUrl } = useQuery<string | null>({
    queryKey: ["/api/org-setting/org_logo"],
    staleTime: 1000 * 60 * 5,
  });
  const { data: orgName } = useQuery<string | null>({
    queryKey: ["/api/org-setting/org_name"],
    staleTime: 1000 * 60 * 5,
  });
  const [logoError, setLogoError] = useState(false);

  const inGameContext = !!currentGame && !!gameSlug;
  const prefix = inGameContext ? `/${fullSlug || gameSlug}` : "";
  const navItems = inGameContext ? makeGameItems(prefix) : null;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        {inGameContext ? (
          <div className="space-y-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 -ml-2" data-testid="button-back-home">
                {orgLogoUrl && !logoError ? (
                  <img src={orgLogoUrl} alt="Logo" className="h-5 w-5 rounded object-contain flex-shrink-0" onError={() => setLogoError(true)} />
                ) : (
                  <ArrowLeft className="h-4 w-4" />
                )}
                <span>All Games</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <GameBadge slug={currentGame.slug} name={currentGame.name} />
              <span className="text-sm font-bold truncate">{currentGame.name}</span>
            </div>
            {currentRoster && (
              <Badge variant="secondary" className="text-xs w-fit" data-testid="badge-roster-name">
                {currentRoster.name}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {orgLogoUrl && !logoError ? (
              <img
                src={orgLogoUrl}
                alt="Organization Logo"
                className="h-8 w-8 rounded object-contain flex-shrink-0"
                data-testid="img-org-logo"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Shield className="h-6 w-6 text-primary flex-shrink-0" />
            )}
            <span className="text-lg font-bold truncate">{orgName || "Vicious"}</span>
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
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/" || location === ""}>
                      <Link href="/">
                        <Gamepad2 className="h-4 w-4" />
                        <span>Games</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {hasOrgRole("super_admin" as any, "org_admin" as any, "management" as any) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                        <Link href="/dashboard">
                          <LayoutDashboard className="h-4 w-4" />
                          <span>Overview</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {hasPermission("view_calendar" as Permission) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/calendar"}>
                        <Link href="/calendar">
                          <Calendar className="h-4 w-4" />
                          <span>Calendar</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {(hasPermission("view_users_tab" as Permission) || hasPermission("view_roles_tab" as Permission) || hasPermission("view_game_access" as Permission)) && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {hasPermission("view_users_tab" as Permission) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/users"}>
                          <Link href="/users">
                            <Users className="h-4 w-4" />
                            <span>Users</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasPermission("view_roles_tab" as Permission) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/roles"}>
                          <Link href="/roles">
                            <ShieldCheck className="h-4 w-4" />
                            <span>Roles</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasPermission("view_game_access" as Permission) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/game-access"}>
                          <Link href="/game-access">
                            <KeyRound className="h-4 w-4" />
                            <span>Game Access</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasOrgRole("super_admin" as any) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/game-templates" || location.startsWith("/game-templates/")}
                          data-testid="link-game-templates"
                        >
                          <Link href="/game-templates">
                            <Layers className="h-4 w-4" />
                            <span>Game Templates</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasOrgRole("super_admin" as any) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/media-library"}
                          data-testid="link-media-library"
                        >
                          <Link href="/media-library">
                            <ImageIcon className="h-4 w-4" />
                            <span>Media Library</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {(user?.orgRole === "management" || user?.orgRole === "super_admin") && (
              <SidebarGroup>
                <SidebarGroupLabel>Communication</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/org-chat"}>
                        <Link href="/org-chat">
                          <MessageSquare className="h-4 w-4" />
                          <span>Management Chat</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {hasPermission("view_settings" as Permission) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings"}>
                        <Link href="/settings">
                          <Settings className="h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
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
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{orgRoleLabels[(user?.orgRole as OrgRole) || "player"] || user?.role?.name}</p>
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
