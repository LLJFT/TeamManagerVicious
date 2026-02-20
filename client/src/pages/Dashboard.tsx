import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Pencil, Trash2, Gamepad2, Map as MapIcon,
  ChevronRight, Calendar, BarChart3, Settings, Users, Shield,
  Clock, UserCog, Check, Ban, UserCheck, Search
} from "lucide-react";
import type {
  GameMode, Map as MapType, Season, StatField, Role, Player,
  AvailabilitySlot, RosterRole, Permission
} from "@shared/schema";
import { allPermissions, permissionCategories } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserWithRole {
  id: string;
  username: string;
  status: string;
  roleId: string | null;
  playerId: string | null;
  role: Role | null;
  lastSeen: string | null;
  lastUserAgent: string | null;
  player: Player | null;
}

const gameModeFormSchema = z.object({
  name: z.string().min(1, "Game mode name is required"),
});

const mapFormSchema = z.object({
  name: z.string().min(1, "Map name is required"),
  gameModeId: z.string().min(1, "Game mode is required"),
});

const seasonFormSchema = z.object({
  name: z.string().min(1, "Season name is required"),
  description: z.string().optional(),
});

const statFieldFormSchema = z.object({
  name: z.string().min(1, "Stat field name is required"),
  gameModeId: z.string().min(1, "Game mode is required"),
});

const availabilitySlotFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  sortOrder: z.coerce.number().int().min(0),
});

const rosterRoleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["player", "staff"]),
  sortOrder: z.coerce.number().int().min(0),
});

const roleFormSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  permissions: z.array(z.string()),
});

type GameModeFormData = z.infer<typeof gameModeFormSchema>;
type MapFormData = z.infer<typeof mapFormSchema>;
type SeasonFormData = z.infer<typeof seasonFormSchema>;
type StatFieldFormData = z.infer<typeof statFieldFormSchema>;
type AvailabilitySlotFormData = z.infer<typeof availabilitySlotFormSchema>;
type RosterRoleFormData = z.infer<typeof rosterRoleFormSchema>;
type RoleFormData = z.infer<typeof roleFormSchema>;

interface ActivityLogEntry {
  id: string;
  userId: string | null;
  action: string;
  details: string | null;
  createdAt: string | null;
  actorName: string;
}

function ActivityLogTab() {
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: logs = [], isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/activity-logs"],
    refetchInterval: 15000,
  });

  const actionLabels: Record<string, string> = {
    login: "Logged in",
    user_status_change: "User status changed",
    user_role_change: "User role changed",
  };

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))), [logs]);
  const uniqueActors = useMemo(() => Array.from(new Set(logs.map(l => l.actorName))), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (userFilter !== "all" && log.actorName !== userFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchesDetails = log.details?.toLowerCase().includes(q);
        const matchesActor = log.actorName.toLowerCase().includes(q);
        const matchesAction = log.action.toLowerCase().includes(q);
        if (!matchesDetails && !matchesActor && !matchesAction) return false;
      }
      return true;
    });
  }, [logs, actionFilter, userFilter, searchText]);

  const formatLogTime = (ts: string | null) => {
    if (!ts) return "";
    try {
      return format(new Date(ts), "MMM d, h:mm a");
    } catch {
      return ts;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Activity Log</CardTitle>
              <CardDescription>Recent actions and events ({filteredLogs.length} of {logs.length})</CardDescription>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative min-w-[160px] flex-1 max-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
              data-testid="input-search-activity"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-action-filter">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a}>{actionLabels[a] || a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-user-filter">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueActors.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading activity...</p>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {logs.length === 0 ? "No activity recorded yet" : "No matching activity found"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border" data-testid={`activity-log-${log.id}`}>
                <Avatar className="h-7 w-7 mt-0.5">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {log.actorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">{log.actorName}</span>
                    <Badge variant="outline" className="text-xs py-0">
                      {actionLabels[log.action] || log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatLogTime(log.createdAt)}</span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [showGameModeDialog, setShowGameModeDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);
  const [showStatFieldDialog, setShowStatFieldDialog] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [showRosterRoleDialog, setShowRosterRoleDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);

  const [createUserUsername, setCreateUserUsername] = useState("");
  const [createUserPassword, setCreateUserPassword] = useState("");
  const [createUserRoleId, setCreateUserRoleId] = useState("");
  const [createUserStatus, setCreateUserStatus] = useState("active");

  const [editingGameMode, setEditingGameMode] = useState<GameMode | undefined>();
  const [editingMap, setEditingMap] = useState<MapType | undefined>();
  const [editingSeason, setEditingSeason] = useState<Season | undefined>();
  const [editingStatField, setEditingStatField] = useState<StatField | undefined>();
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | undefined>();
  const [editingRosterRole, setEditingRosterRole] = useState<RosterRole | undefined>();
  const [editingRole, setEditingRole] = useState<Role | undefined>();

  const [selectedModeForMaps, setSelectedModeForMaps] = useState<string | null>(null);
  const [selectedModeForStatFields, setSelectedModeForStatFields] = useState<string | null>(null);

  const { data: gameModes = [], isLoading: modesLoading } = useQuery<GameMode[]>({
    queryKey: ["/api/game-modes"],
  });

  const { data: maps = [], isLoading: mapsLoading } = useQuery<MapType[]>({
    queryKey: ["/api/maps"],
  });

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: statFields = [] } = useQuery<StatField[]>({
    queryKey: ["/api/stat-fields"],
  });

  const { data: availabilitySlots = [] } = useQuery<AvailabilitySlot[]>({
    queryKey: ["/api/availability-slots"],
  });

  const { data: rosterRoles = [] } = useQuery<RosterRole[]>({
    queryKey: ["/api/roster-roles"],
  });

  const { data: allUsers = [] } = useQuery<UserWithRole[]>({
    queryKey: ["/api/users"],
    enabled: hasPermission("manage_users"),
  });

  const { data: allRoles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const gameModeForm = useForm<GameModeFormData>({
    resolver: zodResolver(gameModeFormSchema),
    defaultValues: { name: "" },
  });

  const mapForm = useForm<MapFormData>({
    resolver: zodResolver(mapFormSchema),
    defaultValues: { name: "", gameModeId: "" },
  });

  const seasonForm = useForm<SeasonFormData>({
    resolver: zodResolver(seasonFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const statFieldForm = useForm<StatFieldFormData>({
    resolver: zodResolver(statFieldFormSchema),
    defaultValues: { name: "", gameModeId: "" },
  });

  const slotForm = useForm<AvailabilitySlotFormData>({
    resolver: zodResolver(availabilitySlotFormSchema),
    defaultValues: { label: "", sortOrder: 0 },
  });

  const rosterRoleForm = useForm<RosterRoleFormData>({
    resolver: zodResolver(rosterRoleFormSchema),
    defaultValues: { name: "", type: "player", sortOrder: 0 },
  });

  const roleForm = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", permissions: [] },
  });

  function showSuccess(msg: string) {
    toast({ title: msg });
  }
  function showError(msg: string) {
    toast({ title: msg, variant: "destructive" });
  }

  const createGameModeMutation = useMutation({
    mutationFn: async (data: GameModeFormData) => {
      const r = await apiRequest("POST", "/api/game-modes", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      setShowGameModeDialog(false);
      setEditingGameMode(undefined);
      gameModeForm.reset();
      showSuccess("Game mode created");
    },
    onError: (e: any) => showError(e.message || "Failed to create game mode"),
  });

  const updateGameModeMutation = useMutation({
    mutationFn: async (data: { id: string; gameMode: Partial<GameModeFormData> }) => {
      const r = await apiRequest("PUT", `/api/game-modes/${data.id}`, data.gameMode);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      setShowGameModeDialog(false);
      setEditingGameMode(undefined);
      gameModeForm.reset();
      showSuccess("Game mode updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update game mode"),
  });

  const deleteGameModeMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/game-modes/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      if (selectedModeForMaps) {
        const remaining = gameModes.filter(m => m.id !== selectedModeForMaps);
        setSelectedModeForMaps(remaining.length > 0 ? remaining[0].id : null);
      }
      showSuccess("Game mode deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete game mode"),
  });

  const createMapMutation = useMutation({
    mutationFn: async (data: MapFormData) => {
      const r = await apiRequest("POST", "/api/maps", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setShowMapDialog(false);
      setEditingMap(undefined);
      mapForm.reset();
      showSuccess("Map created");
    },
    onError: (e: any) => showError(e.message || "Failed to create map"),
  });

  const updateMapMutation = useMutation({
    mutationFn: async (data: { id: string; map: Partial<MapFormData> }) => {
      const r = await apiRequest("PUT", `/api/maps/${data.id}`, data.map);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setShowMapDialog(false);
      setEditingMap(undefined);
      mapForm.reset();
      showSuccess("Map updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update map"),
  });

  const deleteMapMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/maps/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      showSuccess("Map deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete map"),
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (data: SeasonFormData) => {
      const r = await apiRequest("POST", "/api/seasons", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setShowSeasonDialog(false);
      setEditingSeason(undefined);
      seasonForm.reset();
      showSuccess("Season created");
    },
    onError: (e: any) => showError(e.message || "Failed to create season"),
  });

  const updateSeasonMutation = useMutation({
    mutationFn: async (data: { id: string; season: Partial<SeasonFormData> }) => {
      const r = await apiRequest("PUT", `/api/seasons/${data.id}`, data.season);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setShowSeasonDialog(false);
      setEditingSeason(undefined);
      seasonForm.reset();
      showSuccess("Season updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update season"),
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/seasons/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      showSuccess("Season deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete season"),
  });

  const createStatFieldMutation = useMutation({
    mutationFn: async (data: StatFieldFormData) => {
      const r = await apiRequest("POST", "/api/stat-fields", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stat-fields"] });
      setShowStatFieldDialog(false);
      setEditingStatField(undefined);
      statFieldForm.reset();
      showSuccess("Stat field created");
    },
    onError: (e: any) => showError(e.message || "Failed to create stat field"),
  });

  const updateStatFieldMutation = useMutation({
    mutationFn: async (data: { id: string; statField: Partial<StatFieldFormData> }) => {
      const r = await apiRequest("PUT", `/api/stat-fields/${data.id}`, data.statField);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stat-fields"] });
      setShowStatFieldDialog(false);
      setEditingStatField(undefined);
      statFieldForm.reset();
      showSuccess("Stat field updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update stat field"),
  });

  const deleteStatFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/stat-fields/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stat-fields"] });
      showSuccess("Stat field deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete stat field"),
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data: AvailabilitySlotFormData) => {
      const r = await apiRequest("POST", "/api/availability-slots", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability-slots"] });
      setShowSlotDialog(false);
      setEditingSlot(undefined);
      slotForm.reset();
      showSuccess("Availability slot created");
    },
    onError: (e: any) => showError(e.message || "Failed to create slot"),
  });

  const updateSlotMutation = useMutation({
    mutationFn: async (data: { id: string; slot: Partial<AvailabilitySlotFormData> }) => {
      const r = await apiRequest("PUT", `/api/availability-slots/${data.id}`, data.slot);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability-slots"] });
      setShowSlotDialog(false);
      setEditingSlot(undefined);
      slotForm.reset();
      showSuccess("Availability slot updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update slot"),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/availability-slots/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability-slots"] });
      showSuccess("Availability slot deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete slot"),
  });

  const createRosterRoleMutation = useMutation({
    mutationFn: async (data: RosterRoleFormData) => {
      const r = await apiRequest("POST", "/api/roster-roles", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster-roles"] });
      setShowRosterRoleDialog(false);
      setEditingRosterRole(undefined);
      rosterRoleForm.reset();
      showSuccess("Roster role created");
    },
    onError: (e: any) => showError(e.message || "Failed to create roster role"),
  });

  const updateRosterRoleMutation = useMutation({
    mutationFn: async (data: { id: string; role: Partial<RosterRoleFormData> }) => {
      const r = await apiRequest("PUT", `/api/roster-roles/${data.id}`, data.role);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster-roles"] });
      setShowRosterRoleDialog(false);
      setEditingRosterRole(undefined);
      rosterRoleForm.reset();
      showSuccess("Roster role updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update roster role"),
  });

  const deleteRosterRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/roster-roles/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster-roles"] });
      showSuccess("Roster role deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete roster role"),
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      const r = await apiRequest("PUT", `/api/users/${data.id}/status`, { status: data.status });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      showSuccess("User status updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update user status"),
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async (data: { id: string; roleId: string }) => {
      const r = await apiRequest("PUT", `/api/users/${data.id}/role`, { roleId: data.roleId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      showSuccess("User role updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update user role"),
  });

  const updateUserPlayerMutation = useMutation({
    mutationFn: async (data: { id: string; playerId: string | null }) => {
      const r = await apiRequest("PUT", `/api/users/${data.id}/player`, { playerId: data.playerId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      showSuccess("User player link updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update user player link"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/users/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      showSuccess("User deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete user"),
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; roleId?: string; status?: string }) => {
      const r = await apiRequest("POST", "/api/users/create", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateUserDialog(false);
      setCreateUserUsername("");
      setCreateUserPassword("");
      setCreateUserRoleId("");
      setCreateUserStatus("active");
      showSuccess("User created");
    },
    onError: (e: any) => showError(e.message || "Failed to create user"),
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const r = await apiRequest("POST", "/api/roles", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowRoleDialog(false);
      setEditingRole(undefined);
      roleForm.reset();
      showSuccess("Role created");
    },
    onError: (e: any) => showError(e.message || "Failed to create role"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { id: string; role: Partial<RoleFormData> }) => {
      const r = await apiRequest("PUT", `/api/roles/${data.id}`, data.role);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowRoleDialog(false);
      setEditingRole(undefined);
      roleForm.reset();
      showSuccess("Role updated");
    },
    onError: (e: any) => showError(e.message || "Failed to update role"),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/roles/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      showSuccess("Role deleted");
    },
    onError: (e: any) => showError(e.message || "Failed to delete role"),
  });

  const handleGameModeSubmit = (data: GameModeFormData) => {
    if (editingGameMode) {
      updateGameModeMutation.mutate({ id: editingGameMode.id, gameMode: data });
    } else {
      createGameModeMutation.mutate(data);
    }
  };

  const handleMapSubmit = (data: MapFormData) => {
    if (editingMap) {
      updateMapMutation.mutate({ id: editingMap.id, map: data });
    } else {
      createMapMutation.mutate(data);
    }
  };

  const handleSeasonSubmit = (data: SeasonFormData) => {
    if (editingSeason) {
      updateSeasonMutation.mutate({ id: editingSeason.id, season: data });
    } else {
      createSeasonMutation.mutate(data);
    }
  };

  const handleStatFieldSubmit = (data: StatFieldFormData) => {
    if (editingStatField) {
      updateStatFieldMutation.mutate({ id: editingStatField.id, statField: data });
    } else {
      createStatFieldMutation.mutate(data);
    }
  };

  const handleSlotSubmit = (data: AvailabilitySlotFormData) => {
    if (editingSlot) {
      updateSlotMutation.mutate({ id: editingSlot.id, slot: data });
    } else {
      createSlotMutation.mutate(data);
    }
  };

  const handleRosterRoleSubmit = (data: RosterRoleFormData) => {
    if (editingRosterRole) {
      updateRosterRoleMutation.mutate({ id: editingRosterRole.id, role: data });
    } else {
      createRosterRoleMutation.mutate(data);
    }
  };

  const handleRoleSubmit = (data: RoleFormData) => {
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, role: data });
    } else {
      createRoleMutation.mutate(data);
    }
  };

  const getMapsByMode = (modeId: string) => maps.filter(m => m.gameModeId === modeId);
  const getStatFieldsByMode = (modeId: string) => statFields.filter(sf => sf.gameModeId === modeId);

  const selectedMode = gameModes.find(m => m.id === selectedModeForMaps);
  const selectedModeMaps = selectedModeForMaps ? getMapsByMode(selectedModeForMaps) : [];
  const selectedStatFieldMode = gameModes.find(m => m.id === selectedModeForStatFields);
  const selectedModeStatFields = selectedModeForStatFields ? getStatFieldsByMode(selectedModeForStatFields) : [];

  const canViewDashboard = hasPermission("view_dashboard");
  const canManageUsers = hasPermission("manage_users");
  const canManageRoles = hasPermission("manage_roles");
  const canManageGameConfig = hasPermission("manage_game_config");
  const canManageStatFields = hasPermission("manage_stat_fields");
  const canViewActivityLog = hasPermission("view_activity_log");

  const availableTabs: { value: string; label: string; icon: any; show: boolean }[] = [
    { value: "game-config", label: "Game Config", icon: Gamepad2, show: canManageGameConfig },
    { value: "team", label: "Team", icon: UserCog, show: canViewDashboard },
    { value: "users", label: "Users", icon: Users, show: canManageUsers },
    { value: "roles", label: "Roles", icon: Shield, show: canManageRoles },
    { value: "stat-fields", label: "Stat Fields", icon: BarChart3, show: canManageStatFields },
    { value: "activity", label: "Activity", icon: Clock, show: canViewActivityLog },
  ];

  const visibleTabs = availableTabs.filter(t => t.show);
  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].value : "game-config";

  if (!hasPermission("view_dashboard")) {
    return <AccessDenied />;
  }

  if (modesLoading || mapsLoading || seasonsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Dashboard</h1>
                <p className="text-muted-foreground">Manage your team configuration</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="flex-wrap" data-testid="dashboard-tabs">
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`}>
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 1: Game Config */}
          <TabsContent value="game-config">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="h-fit">
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Gamepad2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Game Modes</CardTitle>
                        <CardDescription>{gameModes.length} configured</CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => { setEditingGameMode(undefined); gameModeForm.reset({ name: "" }); setShowGameModeDialog(true); }} size="sm" className="gap-2" data-testid="button-add-game-mode">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {gameModes.length === 0 ? (
                    <div className="p-8 text-center">
                      <Gamepad2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No game modes configured</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {gameModes.map((mode) => {
                        const modeMaps = getMapsByMode(mode.id);
                        const isSelected = selectedModeForMaps === mode.id;
                        return (
                          <div
                            key={mode.id}
                            className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"}`}
                            onClick={() => setSelectedModeForMaps(mode.id)}
                            data-testid={`row-mode-${mode.id}`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground" data-testid={`text-mode-name-${mode.id}`}>{mode.name}</span>
                              <span className="text-xs text-muted-foreground">{modeMaps.length} {modeMaps.length === 1 ? "map" : "maps"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingGameMode(mode); gameModeForm.reset({ name: mode.name }); setShowGameModeDialog(true); }} data-testid={`button-edit-mode-${mode.id}`}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this game mode and its maps?")) deleteGameModeMutation.mutate(mode.id); }} data-testid={`button-delete-mode-${mode.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-secondary/10">
                        <MapIcon className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{selectedMode ? `${selectedMode.name} Maps` : "Maps"}</CardTitle>
                        <CardDescription>{selectedMode ? `${selectedModeMaps.length} maps in this mode` : "Select a game mode to view maps"}</CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => { setEditingMap(undefined); mapForm.reset({ name: "", gameModeId: selectedModeForMaps || "" }); setShowMapDialog(true); }} size="sm" className="gap-2" disabled={!selectedModeForMaps} data-testid="button-add-map">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {!selectedModeForMaps ? (
                    <div className="p-8 text-center">
                      <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">Select a game mode</p>
                    </div>
                  ) : selectedModeMaps.length === 0 ? (
                    <div className="p-8 text-center">
                      <MapIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No maps in this mode</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {selectedModeMaps.map((map) => (
                        <div key={map.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`row-map-${map.id}`}>
                          <div className="flex items-center gap-3">
                            <MapIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground" data-testid={`text-map-name-${map.id}`}>{map.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingMap(map); mapForm.reset({ name: map.name, gameModeId: map.gameModeId }); setShowMapDialog(true); }} data-testid={`button-edit-map-${map.id}`}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this map?")) deleteMapMutation.mutate(map.id); }} data-testid={`button-delete-map-${map.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Calendar className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Seasons</CardTitle>
                        <CardDescription>{seasons.length} configured</CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => { setEditingSeason(undefined); seasonForm.reset({ name: "", description: "" }); setShowSeasonDialog(true); }} size="sm" className="gap-2" data-testid="button-add-season">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {seasons.length === 0 ? (
                    <div className="p-8 text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No seasons configured</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {seasons.map((season) => (
                        <div key={season.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`row-season-${season.id}`}>
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground" data-testid={`text-season-name-${season.id}`}>{season.name}</span>
                              {season.description && <span className="text-xs text-muted-foreground">{season.description}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSeason(season); seasonForm.reset({ name: season.name, description: season.description || "" }); setShowSeasonDialog(true); }} data-testid={`button-edit-season-${season.id}`}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this season?")) deleteSeasonMutation.mutate(season.id); }} data-testid={`button-delete-season-${season.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Team */}
          <TabsContent value="team">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="h-fit">
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Availability Slots</CardTitle>
                        <CardDescription>{availabilitySlots.length} configured</CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => { setEditingSlot(undefined); slotForm.reset({ label: "", sortOrder: 0 }); setShowSlotDialog(true); }} size="sm" className="gap-2" data-testid="button-add-slot">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {availabilitySlots.length === 0 ? (
                    <div className="p-8 text-center">
                      <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No availability slots configured</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {[...availabilitySlots].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((slot) => (
                        <div key={slot.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`row-slot-${slot.id}`}>
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground" data-testid={`text-slot-label-${slot.id}`}>{slot.label}</span>
                              <span className="text-xs text-muted-foreground">Order: {slot.sortOrder}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSlot(slot); slotForm.reset({ label: slot.label, sortOrder: slot.sortOrder ?? 0 }); setShowSlotDialog(true); }} data-testid={`button-edit-slot-${slot.id}`}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this slot?")) deleteSlotMutation.mutate(slot.id); }} data-testid={`button-delete-slot-${slot.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-secondary/10">
                        <UserCog className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Roster Roles</CardTitle>
                        <CardDescription>{rosterRoles.length} configured</CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => { setEditingRosterRole(undefined); rosterRoleForm.reset({ name: "", type: "player", sortOrder: 0 }); setShowRosterRoleDialog(true); }} size="sm" className="gap-2" data-testid="button-add-roster-role">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {rosterRoles.length === 0 ? (
                    <div className="p-8 text-center">
                      <UserCog className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No roster roles configured</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {[...rosterRoles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((rr) => (
                        <div key={rr.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`row-roster-role-${rr.id}`}>
                          <div className="flex items-center gap-3">
                            <UserCog className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground" data-testid={`text-roster-role-name-${rr.id}`}>{rr.name}</span>
                              <span className="text-xs text-muted-foreground">Type: {rr.type} | Order: {rr.sortOrder}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="mr-2">{rr.type}</Badge>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingRosterRole(rr); rosterRoleForm.reset({ name: rr.name, type: rr.type as "player" | "staff", sortOrder: rr.sortOrder ?? 0 }); setShowRosterRoleDialog(true); }} data-testid={`button-edit-roster-role-${rr.id}`}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this roster role?")) deleteRosterRoleMutation.mutate(rr.id); }} data-testid={`button-delete-roster-role-${rr.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 3: Users */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">User Management</CardTitle>
                      <CardDescription>{allUsers.length} users</CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => { setCreateUserUsername(""); setCreateUserPassword(""); setCreateUserRoleId(""); setCreateUserStatus("active"); setShowCreateUserDialog(true); }} size="sm" className="gap-2" data-testid="button-create-user">
                    <Plus className="h-4 w-4" />
                    Create Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {allUsers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`flex flex-wrap items-center justify-between p-4 gap-3 ${user.status === "pending" ? "bg-amber-500/5" : ""}`}
                        data-testid={`row-user-${user.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground" data-testid={`text-username-${user.id}`}>{user.username}</span>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge
                                variant={user.status === "active" ? "default" : user.status === "pending" ? "secondary" : "destructive"}
                                data-testid={`badge-status-${user.id}`}
                              >
                                {user.status}
                              </Badge>
                              {user.role && (
                                <span className="text-xs text-muted-foreground" data-testid={`text-user-role-${user.id}`}>
                                  {user.role.name}
                                </span>
                              )}
                              {user.player && (
                                <span className="text-xs text-muted-foreground" data-testid={`text-user-player-${user.id}`}>
                                  Player: {user.player.name}
                                </span>
                              )}
                            </div>
                            {user.lastSeen && (
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span data-testid={`text-last-seen-${user.id}`}>
                                  Last seen: {format(new Date(user.lastSeen), "MMM d, h:mm a")}
                                </span>
                                {user.lastUserAgent && (
                                  <span data-testid={`text-device-${user.id}`} className="truncate max-w-[200px]" title={user.lastUserAgent}>
                                    {user.lastUserAgent.includes("Mobile") ? "Mobile" : "Desktop"}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {user.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => updateUserStatusMutation.mutate({ id: user.id, status: "active" })}
                              data-testid={`button-approve-user-${user.id}`}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          {user.status !== "banned" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { if (confirm("Ban this user?")) updateUserStatusMutation.mutate({ id: user.id, status: "banned" }); }}
                              data-testid={`button-ban-user-${user.id}`}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Ban
                            </Button>
                          )}
                          {user.status === "banned" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateUserStatusMutation.mutate({ id: user.id, status: "active" })}
                              data-testid={`button-unban-user-${user.id}`}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Unban
                            </Button>
                          )}
                          <Select
                            value={user.roleId || ""}
                            onValueChange={(val) => updateUserRoleMutation.mutate({ id: user.id, roleId: val })}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-user-role-${user.id}`}>
                              <SelectValue placeholder="Set role" />
                            </SelectTrigger>
                            <SelectContent>
                              {allRoles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={user.playerId || "none"}
                            onValueChange={(val) => updateUserPlayerMutation.mutate({ id: user.id, playerId: val === "none" ? null : val })}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-user-player-${user.id}`}>
                              <SelectValue placeholder="Link player" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No player</SelectItem>
                              {allPlayers.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { if (confirm("Delete this user permanently?")) deleteUserMutation.mutate(user.id); }}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Roles */}
          <TabsContent value="roles">
            <Card>
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Role Management</CardTitle>
                      <CardDescription>{allRoles.length} roles</CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => { setEditingRole(undefined); roleForm.reset({ name: "", permissions: [] }); setShowRoleDialog(true); }} size="sm" className="gap-2" data-testid="button-add-role">
                    <Plus className="h-4 w-4" />
                    Add Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {allRoles.length === 0 ? (
                  <div className="p-8 text-center">
                    <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No roles found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allRoles.map((role) => {
                      const isOwner = role.name === "Owner";
                      const isSystem = role.isSystem;
                      const perms = (role.permissions as string[]) || [];
                      return (
                        <Card key={role.id} data-testid={`card-role-${role.id}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg" data-testid={`text-role-name-${role.id}`}>{role.name}</CardTitle>
                                {isSystem && <Badge variant="secondary">System</Badge>}
                              </div>
                              <div className="flex items-center gap-1">
                                {!isOwner && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingRole(role);
                                      roleForm.reset({ name: role.name, permissions: perms });
                                      setShowRoleDialog(true);
                                    }}
                                    data-testid={`button-edit-role-${role.id}`}
                                  >
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                                {!isSystem && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { if (confirm("Delete this role?")) deleteRoleMutation.mutate(role.id); }}
                                    data-testid={`button-delete-role-${role.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          {!isOwner && (
                            <CardContent>
                              <div className="space-y-4">
                                {permissionCategories.map((cat) => (
                                  <div key={cat.category}>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">{cat.category}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                      {cat.permissions.map((perm) => (
                                        <div key={perm} className="flex items-center gap-2">
                                          <Checkbox
                                            checked={perms.includes(perm)}
                                            onCheckedChange={(checked) => {
                                              const newPerms = checked
                                                ? [...perms, perm]
                                                : perms.filter(p => p !== perm);
                                              updateRoleMutation.mutate({ id: role.id, role: { permissions: newPerms } });
                                            }}
                                            data-testid={`checkbox-perm-${role.id}-${perm}`}
                                          />
                                          <label className="text-sm text-foreground cursor-pointer">
                                            {perm.replace(/_/g, " ")}
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: Stat Fields */}
          <TabsContent value="stat-fields">
            <Card>
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Stat Fields</CardTitle>
                    <CardDescription>Define custom stat fields per game mode for player tracking</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">Select Game Mode</label>
                    {gameModes.length === 0 ? (
                      <div className="p-6 text-center border border-border rounded-lg">
                        <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">Create game modes first</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {gameModes.map((mode) => {
                          const modeStatFields = getStatFieldsByMode(mode.id);
                          const isSelected = selectedModeForStatFields === mode.id;
                          return (
                            <div
                              key={mode.id}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-primary/5 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
                              onClick={() => setSelectedModeForStatFields(mode.id)}
                              data-testid={`row-stat-mode-${mode.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className="font-medium text-foreground">{mode.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {modeStatFields.length} {modeStatFields.length === 1 ? "field" : "fields"}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-foreground">
                        {selectedStatFieldMode ? `${selectedStatFieldMode.name} Stat Fields` : "Stat Fields"}
                      </label>
                      <Button
                        onClick={() => { setEditingStatField(undefined); statFieldForm.reset({ name: "", gameModeId: selectedModeForStatFields || "" }); setShowStatFieldDialog(true); }}
                        size="sm"
                        className="gap-2"
                        disabled={!selectedModeForStatFields}
                        data-testid="button-add-stat-field"
                      >
                        <Plus className="h-4 w-4" />
                        Add Field
                      </Button>
                    </div>
                    {!selectedModeForStatFields ? (
                      <div className="p-6 text-center border border-border rounded-lg">
                        <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">Select a game mode to manage its stat fields</p>
                      </div>
                    ) : selectedModeStatFields.length === 0 ? (
                      <div className="p-6 text-center border border-border rounded-lg">
                        <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">No stat fields for this mode</p>
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg divide-y divide-border">
                        {selectedModeStatFields.map((field) => (
                          <div key={field.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors" data-testid={`row-stat-field-${field.id}`}>
                            <div className="flex items-center gap-3">
                              <BarChart3 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground" data-testid={`text-stat-field-name-${field.id}`}>{field.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setEditingStatField(field); statFieldForm.reset({ name: field.name, gameModeId: field.gameModeId }); setShowStatFieldDialog(true); }} data-testid={`button-edit-stat-field-${field.id}`}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this stat field?")) deleteStatFieldMutation.mutate(field.id); }} data-testid={`button-delete-stat-field-${field.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLogTab />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <Dialog open={showGameModeDialog} onOpenChange={setShowGameModeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGameMode ? "Edit Game Mode" : "Add Game Mode"}</DialogTitle>
              <DialogDescription>{editingGameMode ? "Update the name of this game mode." : "Create a new game mode."}</DialogDescription>
            </DialogHeader>
            <Form {...gameModeForm}>
              <form onSubmit={gameModeForm.handleSubmit(handleGameModeSubmit)} className="space-y-4">
                <FormField control={gameModeForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Mode Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Convergence, Domination" data-testid="input-game-mode-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowGameModeDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createGameModeMutation.isPending || updateGameModeMutation.isPending} data-testid="button-save-game-mode">
                    {editingGameMode ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMap ? "Edit Map" : "Add Map"}</DialogTitle>
              <DialogDescription>{editingMap ? "Update the map details." : "Add a new map."}</DialogDescription>
            </DialogHeader>
            <Form {...mapForm}>
              <form onSubmit={mapForm.handleSubmit(handleMapSubmit)} className="space-y-4">
                <FormField control={mapForm.control} name="gameModeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-map-game-mode"><SelectValue placeholder="Select game mode" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {gameModes.map((mode) => (<SelectItem key={mode.id} value={mode.id}>{mode.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={mapForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Map Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Central Park" data-testid="input-map-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowMapDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMapMutation.isPending || updateMapMutation.isPending} data-testid="button-save-map">
                    {editingMap ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showSeasonDialog} onOpenChange={setShowSeasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSeason ? "Edit Season" : "Add Season"}</DialogTitle>
              <DialogDescription>{editingSeason ? "Update the season details." : "Create a new season."}</DialogDescription>
            </DialogHeader>
            <Form {...seasonForm}>
              <form onSubmit={seasonForm.handleSubmit(handleSeasonSubmit)} className="space-y-4">
                <FormField control={seasonForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Season 5.0" data-testid="input-season-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={seasonForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Dec 2024 - Jan 2025" data-testid="input-season-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowSeasonDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createSeasonMutation.isPending || updateSeasonMutation.isPending} data-testid="button-save-season">
                    {editingSeason ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showStatFieldDialog} onOpenChange={setShowStatFieldDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStatField ? "Edit Stat Field" : "Add Stat Field"}</DialogTitle>
              <DialogDescription>{editingStatField ? "Update the stat field details." : "Create a new stat field."}</DialogDescription>
            </DialogHeader>
            <Form {...statFieldForm}>
              <form onSubmit={statFieldForm.handleSubmit(handleStatFieldSubmit)} className="space-y-4">
                <FormField control={statFieldForm.control} name="gameModeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-stat-field-mode"><SelectValue placeholder="Select game mode" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {gameModes.map((mode) => (<SelectItem key={mode.id} value={mode.id}>{mode.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={statFieldForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stat Field Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Kills, Deaths, Assists" data-testid="input-stat-field-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowStatFieldDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createStatFieldMutation.isPending || updateStatFieldMutation.isPending} data-testid="button-save-stat-field">
                    {editingStatField ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSlot ? "Edit Availability Slot" : "Add Availability Slot"}</DialogTitle>
              <DialogDescription>{editingSlot ? "Update the slot details." : "Create a new availability slot."}</DialogDescription>
            </DialogHeader>
            <Form {...slotForm}>
              <form onSubmit={slotForm.handleSubmit(handleSlotSubmit)} className="space-y-4">
                <FormField control={slotForm.control} name="label" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., 18:00-20:00 CEST" data-testid="input-slot-label" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={slotForm.control} name="sortOrder" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl><Input {...field} type="number" placeholder="0" data-testid="input-slot-sort-order" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowSlotDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createSlotMutation.isPending || updateSlotMutation.isPending} data-testid="button-save-slot">
                    {editingSlot ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showRosterRoleDialog} onOpenChange={setShowRosterRoleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRosterRole ? "Edit Roster Role" : "Add Roster Role"}</DialogTitle>
              <DialogDescription>{editingRosterRole ? "Update the roster role details." : "Create a new roster role."}</DialogDescription>
            </DialogHeader>
            <Form {...rosterRoleForm}>
              <form onSubmit={rosterRoleForm.handleSubmit(handleRosterRoleSubmit)} className="space-y-4">
                <FormField control={rosterRoleForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Tank, DPS, Coach" data-testid="input-roster-role-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={rosterRoleForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-roster-role-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={rosterRoleForm.control} name="sortOrder" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl><Input {...field} type="number" placeholder="0" data-testid="input-roster-role-sort-order" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowRosterRoleDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createRosterRoleMutation.isPending || updateRosterRoleMutation.isPending} data-testid="button-save-roster-role">
                    {editingRosterRole ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
              <DialogDescription>{editingRole ? "Update role name and permissions." : "Create a new custom role with permissions."}</DialogDescription>
            </DialogHeader>
            <Form {...roleForm}>
              <form onSubmit={roleForm.handleSubmit(handleRoleSubmit)} className="space-y-4">
                <FormField control={roleForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Moderator" data-testid="input-role-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={roleForm.control} name="permissions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissions</FormLabel>
                    <div className="space-y-4 mt-2">
                      {permissionCategories.map((cat) => (
                        <div key={cat.category}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">{cat.category}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {cat.permissions.map((perm) => (
                              <div key={perm} className="flex items-center gap-2">
                                <Checkbox
                                  checked={field.value.includes(perm)}
                                  onCheckedChange={(checked) => {
                                    const newVal = checked
                                      ? [...field.value, perm]
                                      : field.value.filter((p: string) => p !== perm);
                                    field.onChange(newVal);
                                  }}
                                  data-testid={`checkbox-role-perm-${perm}`}
                                />
                                <label className="text-sm text-foreground cursor-pointer">{perm.replace(/_/g, " ")}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createRoleMutation.isPending || updateRoleMutation.isPending} data-testid="button-save-role">
                    {editingRole ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>
              <DialogDescription>Create a new user account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={createUserUsername}
                  onChange={(e) => setCreateUserUsername(e.target.value)}
                  placeholder="Enter username"
                  data-testid="input-create-user-username"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={createUserPassword}
                  onChange={(e) => setCreateUserPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="input-create-user-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={createUserRoleId} onValueChange={setCreateUserRoleId}>
                  <SelectTrigger data-testid="select-create-user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {allRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={createUserStatus} onValueChange={setCreateUserStatus}>
                  <SelectTrigger data-testid="select-create-user-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateUserDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!createUserUsername.trim() || !createUserPassword.trim()) return;
                    createUserMutation.mutate({
                      username: createUserUsername.trim(),
                      password: createUserPassword,
                      roleId: createUserRoleId || undefined,
                      status: createUserStatus,
                    });
                  }}
                  disabled={!createUserUsername.trim() || !createUserPassword.trim() || createUserMutation.isPending}
                  data-testid="button-submit-create-user"
                >
                  Create Account
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
