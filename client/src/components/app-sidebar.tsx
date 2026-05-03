import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
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
  UserCog, ClipboardList, ArrowLeft, ArrowRight, LayoutDashboard,
  ShieldCheck, Gamepad2, KeyRound, Layers, Image as ImageIcon,
  Swords, Medal, Crown, Map as MapIcon, Sparkles, TrendingUp,
  Layers as LayersIcon,
} from "lucide-react";
import { SiDiscord, SiX } from "react-icons/si";
import { VicLogo } from "@/components/VicLogo";
import type { Permission, OrgRole } from "@shared/schema";
import { orgRoleLabels } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { GameBadge } from "@/components/game-icon";
import { isRtl } from "@/i18n";

function makeGameItems(prefix: string, t: (k: string) => string) {
  return {
    main: [
      { key: "schedule", title: t("nav.schedule"), url: `${prefix}`, icon: Home, permission: "view_schedule" as Permission },
      { key: "events", title: t("nav.events"), url: `${prefix}/events`, icon: Calendar, permission: "view_events" as Permission },
      { key: "results", title: t("nav.results"), url: `${prefix}/results`, icon: Trophy, permission: "view_results" as Permission },
      { key: "players", title: t("nav.players"), url: `${prefix}/players`, icon: Users, permission: "view_players" as Permission },
    ],
    stats: [
      { key: "statistics", title: t("nav.statistics"), url: `${prefix}/stats`, icon: BarChart3, permission: "view_statistics" as Permission },
      { key: "playerStats", title: t("nav.playerStats"), url: `${prefix}/player-stats`, icon: ClipboardList, permission: "view_player_stats" as Permission },
      { key: "history", title: t("nav.history"), url: `${prefix}/history`, icon: Clock, permission: "view_history" as Permission },
      { key: "compare", title: t("nav.compare"), url: `${prefix}/compare`, icon: GitCompare, permission: "view_compare" as Permission },
      { key: "opponents", title: t("nav.opponents"), url: `${prefix}/opponents`, icon: Target, permission: "view_opponents" as Permission },
      { key: "draftStats", title: t("nav.draftStats"), url: `${prefix}/draft-stats`, icon: Swords, permission: "view_statistics" as Permission },
      { key: "mapInsights", title: t("nav.mapInsights"), url: `${prefix}/map-insights`, icon: MapIcon, permission: "view_statistics" as Permission },
      { key: "heroInsights", title: t("nav.heroInsights"), url: `${prefix}/hero-insights`, icon: Sparkles, permission: "view_statistics" as Permission },
      { key: "trends", title: t("nav.trends"), url: `${prefix}/trends`, icon: TrendingUp, permission: "view_statistics" as Permission },
      { key: "teamLeaderboard", title: t("nav.teamLeaderboard"), url: `${prefix}/team-leaderboard`, icon: Crown, permission: "view_statistics" as Permission },
      { key: "playerLeaderboard", title: t("nav.playerLeaderboard"), url: `${prefix}/player-leaderboard`, icon: Medal, permission: "view_statistics" as Permission },
      { key: "teamComps", title: t("nav.teamComps"), url: `${prefix}/comps`, icon: LayersIcon, permission: "view_statistics" as Permission },
    ],
    management: [
      { key: "dashboard", title: t("nav.dashboard"), url: `${prefix}/dashboard`, icon: Settings, permission: "view_dashboard" as Permission },
      { key: "staff", title: t("nav.staff"), url: `${prefix}/staff`, icon: UserCog, permission: "view_staff" as Permission },
      { key: "chat", title: t("nav.chat"), url: `${prefix}/chat`, icon: MessageSquare, permission: "view_chat" as Permission },
    ],
  };
}

export function AppSidebar() {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
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
  const navItems = inGameContext ? makeGameItems(prefix, t) : null;
  const BackIcon = rtl ? ArrowRight : ArrowLeft;

  return (
    <Sidebar side={rtl ? "right" : "left"}>
      <SidebarHeader className="p-4">
        {inGameContext ? (
          <div className="space-y-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 -ms-2" data-testid="button-back-home">
                {orgLogoUrl && !logoError ? (
                  <img src={orgLogoUrl} alt="Logo" className="h-5 w-5 rounded object-contain flex-shrink-0" onError={() => setLogoError(true)} />
                ) : (
                  <BackIcon className="h-4 w-4" />
                )}
                <span>{t("nav.allGames")}</span>
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
              <VicLogo size={24} className="text-primary flex-shrink-0" />
            )}
            <span className="text-lg font-extrabold tracking-[0.18em] lowercase truncate">{orgName || "the bootcamp"}</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {inGameContext && navItems ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>{t("nav.main")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.main.filter(item => hasPermission(item.permission)).map(item => (
                    <SidebarMenuItem key={item.key}>
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
              <SidebarGroupLabel>{t("nav.analytics")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.stats.filter(item => hasPermission(item.permission)).map(item => (
                    <SidebarMenuItem key={item.key}>
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
              <SidebarGroupLabel>{t("nav.management")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.management.filter(item => hasPermission(item.permission)).map(item => (
                    <SidebarMenuItem key={item.key}>
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
              <SidebarGroupLabel>{t("nav.navigation")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/" || location === ""}>
                      <Link href="/">
                        <Gamepad2 className="h-4 w-4" />
                        <span>{t("nav.games")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {hasOrgRole("super_admin" as any, "org_admin" as any, "management" as any) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                        <Link href="/dashboard">
                          <LayoutDashboard className="h-4 w-4" />
                          <span>{t("nav.overview")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {hasPermission("view_calendar" as Permission) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/calendar"}>
                        <Link href="/calendar">
                          <Calendar className="h-4 w-4" />
                          <span>{t("nav.calendar")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {(hasPermission("view_users_tab" as Permission) || hasPermission("view_roles_tab" as Permission) || hasPermission("view_game_access" as Permission)) && (
              <SidebarGroup>
                <SidebarGroupLabel>{t("nav.administration")}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {hasPermission("view_users_tab" as Permission) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/users"}>
                          <Link href="/users">
                            <Users className="h-4 w-4" />
                            <span>{t("nav.users")}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasPermission("view_roles_tab" as Permission) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/roles"}>
                          <Link href="/roles">
                            <ShieldCheck className="h-4 w-4" />
                            <span>{t("nav.roles")}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasPermission("view_game_access" as Permission) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/game-access"}>
                          <Link href="/game-access">
                            <KeyRound className="h-4 w-4" />
                            <span>{t("nav.gameAccess")}</span>
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
                            <span>{t("nav.gameTemplates")}</span>
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
                            <span>{t("nav.mediaLibrary")}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {hasOrgRole("super_admin" as any) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/subscriptions"}
                          data-testid="link-subscriptions"
                        >
                          <Link href="/subscriptions">
                            <ShieldCheck className="h-4 w-4" />
                            <span>{t("nav.subscriptions")}</span>
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
                <SidebarGroupLabel>{t("nav.communication")}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/org-chat"}>
                        <Link href="/org-chat">
                          <MessageSquare className="h-4 w-4" />
                          <span>{t("nav.managementChat")}</span>
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
                          <span>{t("nav.settings")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/account"}>
                      <Link href="/account">
                        <UserCog className="h-4 w-4" />
                        <span>{t("nav.account")}</span>
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
        <div className="flex items-center justify-center gap-1 pb-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            title={t("social.discord")}
            aria-label={t("social.discord")}
            data-testid="link-sidebar-discord"
          >
            <a href="https://discord.gg/HrGFwMxaD" target="_blank" rel="noopener noreferrer">
              <SiDiscord className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            title={t("social.twitter")}
            aria-label={t("social.twitter")}
            data-testid="link-sidebar-twitter"
          >
            <a href="https://x.com/The__BootCamp" target="_blank" rel="noopener noreferrer">
              <SiX className="h-4 w-4" />
            </a>
          </Button>
        </div>
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
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
