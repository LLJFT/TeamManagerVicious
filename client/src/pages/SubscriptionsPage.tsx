import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ShieldCheck, Search, X, Loader2, ChevronsUpDown } from "lucide-react";
import type { Subscription } from "@shared/schema";
import { useTranslation } from "react-i18next";

type SubRow = Subscription & {
  username?: string | null;
  displayName?: string | null;
  orgRole?: string | null;
};

interface UserOption {
  id: string;
  username: string;
  displayName?: string | null;
  orgRole?: string | null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function plusDaysIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function computeDaysRemaining(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(endDate);
  const end = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(endDate);
  if (isNaN(end.getTime())) return null;
  end.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

interface FormState {
  userId: string;
  selectedUser: UserOption | null;
  type: "trial" | "paid";
  startDate: string;
  endDate: string;
  manualOverride: "auto" | "force_active" | "force_inactive";
  notes: string;
}

const blankForm: FormState = {
  userId: "",
  selectedUser: null,
  type: "trial",
  startDate: todayIso(),
  endDate: plusDaysIso(30),
  manualOverride: "auto",
  notes: "",
};

/**
 * Server-side searchable user picker. Replaces the previous plain dropdown
 * that loaded all 1400+ users on mount. Uses a 300ms debounce, only queries
 * after 2+ chars typed, never preloads the full list.
 */
function UserSearchPicker({
  value,
  selected,
  onSelect,
  disabled,
}: {
  value: string;
  selected: UserOption | null;
  onSelect: (u: UserOption | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 300ms debounce
  useEffect(() => {
    const id = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  // Server-side search — only when 2+ characters typed AND popover open.
  const { data: results = [], isFetching } = useQuery<UserOption[]>({
    queryKey: ["/api/users/search", { q: debounced, limit: 20 }],
    queryFn: async () => {
      const url = `/api/users/search?q=${encodeURIComponent(debounced)}&limit=20`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      return res.json();
    },
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  // Focus the input when the popover opens.
  useEffect(() => {
    if (open) {
      // Defer to next tick so the popover content has mounted.
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setInput("");
      setDebounced("");
    }
  }, [open]);

  const display = selected
    ? `${selected.username}${selected.orgRole ? ` — ${selected.orgRole.replace(/_/g, " ")}` : ""}`
    : value
      ? value.slice(0, 8)
      : t("subs.selectUser");

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
            data-testid="select-sub-user"
          >
            <span className={selected || value ? "" : "text-muted-foreground"}>
              {display}
            </span>
            <span className="flex items-center gap-1">
              {selected && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  className="opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onSelect(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSelect(null); } }}
                  data-testid="button-clear-sub-user"
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[16rem]"
          align="start"
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search users..."
                className="pl-7 h-8"
                data-testid="input-sub-user-search"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1" data-testid="list-sub-user-results">
            {debounced.length < 2 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center" data-testid="text-sub-user-hint">
                Type at least 2 characters to search.
              </p>
            ) : isFetching ? (
              <div className="px-3 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground" data-testid="status-sub-user-loading">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center" data-testid="text-sub-user-empty">
                No users found
              </p>
            ) : (
              results.slice(0, 8).map((u) => {
                const isSel = selected?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { onSelect(u); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 hover-elevate ${isSel ? "bg-accent" : ""}`}
                    data-testid={`option-sub-user-${u.id}`}
                  >
                    <span className="flex flex-col items-start min-w-0">
                      <span className="font-medium truncate">{u.username}</span>
                      {u.orgRole && (
                        <span className="text-xs text-muted-foreground capitalize truncate">
                          {u.orgRole.replace(/_/g, " ")}
                        </span>
                      )}
                    </span>
                    {isSel && <span className="text-xs text-muted-foreground">✓</span>}
                  </button>
                );
              })
            )}
            {results.length > 8 && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                Showing 8 of {results.length} results — refine your search.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: subs = [], isLoading } = useQuery<SubRow[]>({
    queryKey: ["/api/subscriptions"],
    enabled: user?.orgRole === "super_admin",
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/subscriptions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t("subs.toasts.created") });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: t("subs.toasts.failedCreate"), description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PUT", `/api/subscriptions/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t("subs.toasts.updated") });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: t("subs.toasts.failedUpdate"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/subscriptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t("subs.toasts.deleted") });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: t("subs.toasts.failedDelete"), description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm);
    setDialogOpen(true);
  };

  const openEdit = (row: SubRow) => {
    setEditingId(row.id);
    setForm({
      userId: row.userId,
      selectedUser: {
        id: row.userId,
        username: row.username || row.userId.slice(0, 8),
        displayName: row.displayName ?? null,
        orgRole: row.orgRole ?? null,
      },
      type: (row.type as "trial" | "paid") || "trial",
      startDate: row.startDate,
      endDate: row.endDate,
      manualOverride:
        row.manualActiveOverride === true ? "force_active"
        : row.manualActiveOverride === false ? "force_inactive"
        : "auto",
      notes: row.notes || "",
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.userId) {
      toast({ title: t("subs.toasts.selectUserError"), variant: "destructive" });
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast({ title: t("subs.toasts.datesRequired"), variant: "destructive" });
      return;
    }
    if (form.endDate < form.startDate) {
      toast({ title: t("subs.toasts.endAfterStart"), variant: "destructive" });
      return;
    }
    const payload: any = {
      userId: form.userId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      manualActiveOverride:
        form.manualOverride === "force_active" ? true
        : form.manualOverride === "force_inactive" ? false
        : null,
      notes: form.notes.trim() || null,
    };
    if (editingId) updateMutation.mutate({ id: editingId, payload });
    else createMutation.mutate(payload);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter(s => {
      const days = computeDaysRemaining(s.endDate);
      const isActive =
        s.manualActiveOverride === true ? true
        : s.manualActiveOverride === false ? false
        : (days !== null && days >= 0);
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      if (!q) return true;
      return (
        (s.username || "").toLowerCase().includes(q) ||
        (s.displayName || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q)
      );
    });
  }, [subs, search, statusFilter]);

  if (user?.orgRole !== "super_admin") {
    return (
      <div className="p-8 text-center" data-testid="text-no-access">
        <h2 className="text-xl font-bold mb-2">{t("subs.accessDenied")}</h2>
        <p className="text-muted-foreground">Only super admins can manage subscriptions.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">{t("subs.title")}</h1>
              <p className="text-muted-foreground text-sm">Manage trial and paid plans for every user.</p>
            </div>
          </div>
          <Button onClick={openCreate} data-testid="button-create-subscription">
            <Plus className="h-4 w-4" />
            New subscription
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3 gap-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">{t("subs.allSubs")}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("subs.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-64"
                    data-testid="input-search-subscriptions"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-36" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("subs.allStatuses")}</SelectItem>
                    <SelectItem value="active">{t("subs.activeOnly")}</SelectItem>
                    <SelectItem value="inactive">{t("subs.inactiveOnly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("subs.loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center" data-testid="text-no-subscriptions">
                {subs.length === 0
                  ? "No subscriptions yet. Click 'New subscription' to add one."
                  : "No subscriptions match your filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("subs.user")}</TableHead>
                      <TableHead>{t("subs.type")}</TableHead>
                      <TableHead>{t("subs.status")}</TableHead>
                      <TableHead>{t("subs.start")}</TableHead>
                      <TableHead>{t("subs.end")}</TableHead>
                      <TableHead>{t("subs.daysLeft")}</TableHead>
                      <TableHead>{t("subs.notes")}</TableHead>
                      <TableHead className="w-24 text-right">{t("subs.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const days = computeDaysRemaining(row.endDate);
                      const isActive =
                        row.manualActiveOverride === true ? true
                        : row.manualActiveOverride === false ? false
                        : (days !== null && days >= 0);
                      return (
                        <TableRow key={row.id} data-testid={`row-subscription-${row.id}`}>
                          <TableCell>
                            <div className="font-medium" data-testid={`text-sub-username-${row.id}`}>
                              {row.username || row.userId.slice(0, 8)}
                            </div>
                            {row.orgRole && (
                              <div className="text-xs text-muted-foreground capitalize">{row.orgRole.replace(/_/g, " ")}</div>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{row.type}</TableCell>
                          <TableCell>
                            <Badge variant={isActive ? "default" : "destructive"} data-testid={`badge-sub-status-${row.id}`}>
                              {isActive ? t("subs.active") : t("subs.inactive")}
                            </Badge>
                            {row.manualActiveOverride !== null && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                {row.manualActiveOverride ? t("subs.forcedActive") : t("subs.forcedInactive")}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(row.startDate)}</TableCell>
                          <TableCell>{formatDate(row.endDate)}</TableCell>
                          <TableCell data-testid={`text-sub-days-${row.id}`}>
                            {days === null ? "—" : days < 0 ? `${Math.abs(days)} ago` : days}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={row.notes || ""}>
                            {row.notes || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(row)} data-testid={`button-edit-sub-${row.id}`} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteId(row.id)} data-testid={`button-delete-sub-${row.id}`} title="Delete">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-subscription">
          <DialogHeader>
            <DialogTitle>{editingId ? t("subs.editTitle") : t("subs.newTitle")}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update plan details for this user." : "Create a trial or paid plan for a user."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>{t("subs.user")}</Label>
              <UserSearchPicker
                value={form.userId}
                selected={form.selectedUser}
                disabled={!!editingId}
                onSelect={(u) => setForm({ ...form, userId: u?.id || "", selectedUser: u })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("subs.planType")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "trial" | "paid" })}>
                  <SelectTrigger data-testid="select-sub-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">{t("subs.trial")}</SelectItem>
                    <SelectItem value="paid">{t("subs.paid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("subs.override")}</Label>
                <Select value={form.manualOverride} onValueChange={(v) => setForm({ ...form, manualOverride: v as any })}>
                  <SelectTrigger data-testid="select-sub-override"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("subs.autoDate")}</SelectItem>
                    <SelectItem value="force_active">{t("subs.forceActive")}</SelectItem>
                    <SelectItem value="force_inactive">{t("subs.forceInactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("subs.startDate")}</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  data-testid="input-sub-start"
                />
              </div>
              <div>
                <Label>{t("subs.endDate")}</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  data-testid="input-sub-end"
                />
              </div>
            </div>
            <div>
              <Label>{t("subs.notesOptional")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("subs.notesPlaceholder")}
                rows={2}
                data-testid="input-sub-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} data-testid="button-sub-cancel">Cancel</Button>
            <Button
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-sub-save"
            >
              {editingId ? t("subs.saveChanges") : t("subs.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent data-testid="dialog-delete-subscription">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("subs.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke this user's plan immediately. They will be locked out unless they have super admin bypass.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
