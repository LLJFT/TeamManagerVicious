import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ArrowLeft, Check, X, Clock, UserPlus, Users, Send } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { Player, Attendance, AttendanceStatus, TeamNotes as TeamNotesType, RosterRole } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SimpleToast } from "@/components/SimpleToast";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";

const playerFormSchema = z.object({
  name: z.string().min(1, "Nickname is required"),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  snapchat: z.string().optional(),
  role: z.string().min(1, "Role is required"),
});

const attendanceFormSchema = z.object({
  playerId: z.string().min(1, "Player is required"),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["attended", "late", "absent"]),
  notes: z.string().optional(),
  ringer: z.string().optional(),
});

const teamNoteFormSchema = z.object({
  senderName: z.string().min(1, "Your name is required"),
  message: z.string().min(1, "Message is required"),
  timestamp: z.string(),
});

type PlayerFormData = z.infer<typeof playerFormSchema>;
type AttendanceFormData = z.infer<typeof attendanceFormSchema>;
type TeamNoteFormData = z.infer<typeof teamNoteFormSchema>;

export default function Players() {
  const { hasPermission } = useAuth();
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();
  const [editingAttendance, setEditingAttendance] = useState<Attendance | undefined>();
  const [selectedPlayer, setSelectedPlayer] = useState<string | undefined>();
  const [playerToDelete, setPlayerToDelete] = useState<Player | undefined>();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const { data: allAttendance = [], isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance"],
  });

  const { data: teamNotes = [] } = useQuery<TeamNotesType[]>({
    queryKey: ["/api/team-notes"],
  });

  const { data: rosterRoles = [] } = useQuery<RosterRole[]>({
    queryKey: ["/api/roster-roles"],
  });

  const playerRoleOptions = rosterRoles
    .filter(r => r.type === "player")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(r => r.name);
  const allRoleOptions = rosterRoles
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(r => r.name);
  const roleOptions = allRoleOptions.length > 0 ? allRoleOptions : ["Tank", "DPS", "Support", "Flex"];

  const playerForm = useForm<PlayerFormData>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      name: "",
      fullName: "",
      phone: "",
      snapchat: "",
      role: "DPS",
    },
  });

  const attendanceForm = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      playerId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      status: "attended",
      notes: "",
      ringer: "",
    },
  });

  const teamNoteForm = useForm<TeamNoteFormData>({
    resolver: zodResolver(teamNoteFormSchema),
    defaultValues: {
      senderName: "",
      message: "",
      timestamp: "",
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: async (data: PlayerFormData) => {
      const response = await apiRequest("POST", "/api/players", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setShowPlayerDialog(false);
      setEditingPlayer(undefined);
      playerForm.reset();
      setToastMessage("Player added successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to add player");
      setToastType("error");
      setShowToast(true);
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async (data: { id: string; player: Partial<PlayerFormData> }) => {
      const response = await apiRequest("PUT", `/api/players/${data.id}`, data.player);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setShowPlayerDialog(false);
      setEditingPlayer(undefined);
      playerForm.reset();
      setToastMessage("Player updated successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update player");
      setToastType("error");
      setShowToast(true);
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/players/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      setShowDeleteDialog(false);
      setPlayerToDelete(undefined);
      setToastMessage("Player deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete player");
      setToastType("error");
      setShowToast(true);
    },
  });

  const createAttendanceMutation = useMutation({
    mutationFn: async (data: AttendanceFormData) => {
      const response = await apiRequest("POST", "/api/attendance", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setShowAttendanceDialog(false);
      setEditingAttendance(undefined);
      attendanceForm.reset();
      setToastMessage("Attendance record added successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to add attendance");
      setToastType("error");
      setShowToast(true);
    },
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async (data: { id: string; attendance: Partial<AttendanceFormData> }) => {
      const response = await apiRequest("PUT", `/api/attendance/${data.id}`, data.attendance);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setShowAttendanceDialog(false);
      setEditingAttendance(undefined);
      attendanceForm.reset();
      setToastMessage("Attendance record updated successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to update attendance");
      setToastType("error");
      setShowToast(true);
    },
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/attendance/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setToastMessage("Attendance record deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete attendance");
      setToastType("error");
      setShowToast(true);
    },
  });

  const addTeamNoteMutation = useMutation({
    mutationFn: async (data: TeamNoteFormData) => {
      const response = await apiRequest("POST", "/api/team-notes", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-notes"] });
      teamNoteForm.reset({
        senderName: "",
        message: "",
        timestamp: new Date().toISOString(),
      });
      setToastMessage("Team note sent successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to send team note");
      setToastType("error");
      setShowToast(true);
    },
  });

  const deleteTeamNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/team-notes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-notes"] });
      setToastMessage("Team note deleted successfully");
      setToastType("success");
      setShowToast(true);
    },
    onError: (error: any) => {
      setToastMessage(error.message || "Failed to delete team note");
      setToastType("error");
      setShowToast(true);
    },
  });

  const handleAddPlayer = () => {
    setEditingPlayer(undefined);
    playerForm.reset({
      name: "",
      fullName: "",
      phone: "",
      snapchat: "",
      role: "DPS",
    });
    setShowPlayerDialog(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    playerForm.reset({
      name: player.name,
      fullName: player.fullName || "",
      phone: player.phone || "",
      snapchat: player.snapchat || "",
      role: player.role as "Tank" | "DPS" | "Support" | "Analyst" | "Coach",
    });
    setShowPlayerDialog(true);
  };

  const handleDeletePlayer = (player: Player) => {
    setPlayerToDelete(player);
    setShowDeleteDialog(true);
  };

  const handlePlayerSubmit = (data: PlayerFormData) => {
    if (editingPlayer) {
      updatePlayerMutation.mutate({ id: editingPlayer.id, player: data });
    } else {
      createPlayerMutation.mutate(data);
    }
  };

  const handleAddAttendance = (playerId: string) => {
    setSelectedPlayer(playerId);
    setEditingAttendance(undefined);
    attendanceForm.reset({
      playerId,
      date: format(new Date(), "yyyy-MM-dd"),
      status: "attended",
      notes: "",
      ringer: "",
    });
    setShowAttendanceDialog(true);
  };

  const handleEditAttendance = (attendance: Attendance) => {
    setEditingAttendance(attendance);
    attendanceForm.reset({
      playerId: attendance.playerId,
      date: attendance.date,
      status: attendance.status as "attended" | "late" | "absent",
      notes: attendance.notes || "",
      ringer: attendance.ringer || "",
    });
    setShowAttendanceDialog(true);
  };

  const handleAttendanceSubmit = (data: AttendanceFormData) => {
    if (editingAttendance) {
      // Exclude playerId when updating (it shouldn't change)
      const { playerId, ...updateData } = data;
      updateAttendanceMutation.mutate({ id: editingAttendance.id, attendance: updateData });
    } else {
      createAttendanceMutation.mutate(data);
    }
  };

  const handleTeamNoteSubmit = (data: TeamNoteFormData) => {
    addTeamNoteMutation.mutate({
      ...data,
      timestamp: new Date().toISOString(),
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      attended: { label: "Attended", variant: "default" as const, icon: Check, color: "bg-green-500" },
      late: { label: "Late", variant: "secondary" as const, icon: Clock, color: "bg-yellow-500" },
      absent: { label: "Absent", variant: "destructive" as const, icon: X, color: "bg-red-500" },
    };
    
    const config = statusMap[status as keyof typeof statusMap] || statusMap.attended;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleColors = {
      Tank: "bg-blue-500",
      DPS: "bg-red-500",
      Support: "bg-green-500",
      Analyst: "bg-purple-500",
      Coach: "bg-yellow-500",
    };
    return (
      <Badge className={roleColors[role as keyof typeof roleColors] || "bg-gray-500"}>
        {role}
      </Badge>
    );
  };

  const getPlayerStats = (playerId: string) => {
    const playerAttendance = allAttendance.filter(a => a.playerId === playerId);
    return {
      attended: playerAttendance.filter(a => a.status === "attended").length,
      late: playerAttendance.filter(a => a.status === "late").length,
      absent: playerAttendance.filter(a => a.status === "absent").length,
      total: playerAttendance.length,
    };
  };

  if (!hasPermission("view_players")) {
    return <AccessDenied />;
  }

  if (playersLoading || attendanceLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" className="gap-2" data-testid="button-back-schedule">
                <ArrowLeft className="h-4 w-4" />
                Back to Schedule
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Player Management</h1>
              <p className="text-muted-foreground">Manage player information and attendance records</p>
            </div>
          </div>
          <Button onClick={handleAddPlayer} className="gap-2" data-testid="button-add-player">
            <UserPlus className="h-4 w-4" />
            Add Player
          </Button>
        </div>

        {/* Team Notes Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...teamNoteForm}>
              <form onSubmit={teamNoteForm.handleSubmit(handleTeamNoteSubmit)} className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={teamNoteForm.control}
                    name="senderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your name"
                            data-testid="input-sender-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={teamNoteForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Type your message..."
                            className="min-h-[60px]"
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="gap-2" data-testid="button-send-note">
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </form>
            </Form>

            {/* Team Notes Table */}
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-primary/10">
                  <tr>
                    <th className="text-left p-3 font-semibold text-foreground">Sender</th>
                    <th className="text-left p-3 font-semibold text-foreground">Message</th>
                    <th className="text-left p-3 font-semibold text-foreground">Time</th>
                    <th className="text-right p-3 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamNotes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        No team notes yet. Send the first message!
                      </td>
                    </tr>
                  ) : (
                    teamNotes.map((note) => (
                      <tr key={note.id} className="border-t border-border hover-elevate">
                        <td className="p-3 font-medium text-foreground">{note.senderName}</td>
                        <td className="p-3 text-foreground whitespace-pre-wrap">{note.message}</td>
                        <td className="p-3 text-muted-foreground text-sm">
                          <div>{format(new Date(note.timestamp), "MMM dd, yyyy")}</div>
                          <div className="text-xs">{format(new Date(note.timestamp), "hh:mm:ss a")}</div>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTeamNoteMutation.mutate(note.id)}
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Statistics Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Attendance Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold text-foreground">Player</th>
                    <th className="text-left p-3 font-semibold text-foreground">Role</th>
                    <th className="text-center p-3 font-semibold text-green-600">Attended</th>
                    <th className="text-center p-3 font-semibold text-yellow-600">Late</th>
                    <th className="text-center p-3 font-semibold text-red-600">Absent</th>
                    <th className="text-center p-3 font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => {
                    const stats = getPlayerStats(player.id);
                    return (
                      <tr key={player.id} className="border-b border-border hover-elevate">
                        <td className="p-3 font-medium text-foreground">{player.name}</td>
                        <td className="p-3">{getRoleBadge(player.role)}</td>
                        <td className="p-3 text-center text-green-600 font-semibold">{stats.attended}</td>
                        <td className="p-3 text-center text-yellow-600 font-semibold">{stats.late}</td>
                        <td className="p-3 text-center text-red-600 font-semibold">{stats.absent}</td>
                        <td className="p-3 text-center font-semibold text-foreground">{stats.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Players List */}
        <div className="space-y-4">
          {players.map((player) => {
            const playerAttendance = allAttendance.filter(a => a.playerId === player.id);
            
            return (
              <Card key={player.id} className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-primary">{player.name}</h3>
                      {getRoleBadge(player.role)}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPlayer(player)}
                        data-testid={`button-edit-player-${player.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePlayer(player)}
                        data-testid={`button-delete-player-${player.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleAddAttendance(player.id)}
                      className="gap-2"
                      data-testid={`button-add-attendance-${player.id}`}
                    >
                      <Plus className="h-4 w-4" />
                      Add Attendance
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Full Name:</span> {player.fullName || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span> {player.phone || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Snapchat:</span> {player.snapchat || "—"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="text-lg font-semibold mb-3 text-primary">Attendance Records</h4>
                  {playerAttendance.length === 0 ? (
                    <p className="text-muted-foreground">No attendance records found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-2 font-semibold text-foreground">Date</th>
                            <th className="text-left p-2 font-semibold text-foreground">Status</th>
                            <th className="text-left p-2 font-semibold text-foreground">Notes</th>
                            <th className="text-left p-2 font-semibold text-foreground">Ringer</th>
                            <th className="text-right p-2 font-semibold text-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerAttendance.map((attendance) => (
                            <tr key={attendance.id} className="border-b border-border">
                              <td className="p-2 text-foreground">
                                {format(new Date(attendance.date), "MMM dd, yyyy")}
                              </td>
                              <td className="p-2">{getStatusBadge(attendance.status)}</td>
                              <td className="p-2 text-muted-foreground">{attendance.notes || "—"}</td>
                              <td className="p-2 text-foreground">{attendance.ringer || "—"}</td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditAttendance(attendance)}
                                    data-testid={`button-edit-attendance-${attendance.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteAttendanceMutation.mutate(attendance.id)}
                                    data-testid={`button-delete-attendance-${attendance.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add/Edit Player Dialog */}
        <Dialog open={showPlayerDialog} onOpenChange={setShowPlayerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlayer ? "Edit Player" : "Add New Player"}</DialogTitle>
            </DialogHeader>
            <Form {...playerForm}>
              <form onSubmit={playerForm.handleSubmit(handlePlayerSubmit)} className="space-y-4">
                <FormField
                  control={playerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Player nickname" data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={playerForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full name" data-testid="input-fullname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={playerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1234567890" data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={playerForm.control}
                  name="snapchat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Snapchat</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="@username" data-testid="input-snapchat" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={playerForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleOptions.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit">
                    {editingPlayer ? "Save Changes" : "Add Player"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Attendance Dialog */}
        <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAttendance ? "Edit Attendance Record" : "Add Attendance Record"}</DialogTitle>
            </DialogHeader>
            <Form {...attendanceForm}>
              <form onSubmit={attendanceForm.handleSubmit(handleAttendanceSubmit)} className="space-y-4">
                <FormField
                  control={attendanceForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={attendanceForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="attended">Attended</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={attendanceForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional notes..." data-testid="textarea-attendance-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={attendanceForm.control}
                  name="ringer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ringer</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ringer name (if applicable)" data-testid="input-ringer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit">
                    {editingAttendance ? "Save Changes" : "Add Record"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Player Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Player</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">{playerToDelete?.name}</span>?
                This will also delete all attendance records for this player. This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => playerToDelete && deletePlayerMutation.mutate(playerToDelete.id)}
                data-testid="button-confirm-delete"
              >
                Delete Player
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showToast && (
          <SimpleToast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </div>
  );
}
