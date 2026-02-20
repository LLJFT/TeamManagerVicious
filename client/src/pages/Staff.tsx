import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCog, Plus, Pencil, Trash2, Phone, User } from "lucide-react";
import type { Staff } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AccessDenied } from "@/components/AccessDenied";

interface StaffFormData {
  name: string;
  role: string;
  fullName: string;
  phone: string;
  snapchat: string;
}

const emptyForm: StaffFormData = {
  name: "",
  role: "",
  fullName: "",
  phone: "",
  snapchat: "",
};

export default function StaffPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_staff");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);

  const { data: staffList = [], isLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      await apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member added successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add staff member", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StaffFormData }) => {
      await apiRequest("PUT", `/api/staff/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update staff member", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member deleted successfully" });
      setDeleteDialogOpen(false);
      setStaffToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete staff member", description: error.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingStaff(null);
    setFormData(emptyForm);
  }

  function openAddDialog() {
    setEditingStaff(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(s: Staff) {
    setEditingStaff(s);
    setFormData({
      name: s.name,
      role: s.role,
      fullName: s.fullName || "",
      phone: s.phone || "",
      snapchat: s.snapchat || "",
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(s: Staff) {
    setStaffToDelete(s);
    setDeleteDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.role.trim()) return;

    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function handleConfirmDelete() {
    if (staffToDelete) {
      deleteMutation.mutate(staffToDelete.id);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!hasPermission("view_staff")) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="p-6" data-testid="staff-loading">
        <div className="flex items-center gap-2 mb-6">
          <UserCog className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Staff</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="staff-page">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-staff-title">Staff</h1>
        </div>
        {canManage && (
          <Button onClick={openAddDialog} data-testid="button-add-staff">
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        )}
      </div>

      {staffList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCog className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-staff">No staff members yet</p>
            {canManage && (
              <Button variant="outline" className="mt-4" onClick={openAddDialog} data-testid="button-add-staff-empty">
                <Plus className="h-4 w-4 mr-2" />
                Add your first staff member
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((s) => (
            <Card key={s.id} data-testid={`card-staff-${s.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-lg" data-testid={`text-staff-name-${s.id}`}>{s.name}</CardTitle>
                <Badge variant="secondary" data-testid={`badge-staff-role-${s.id}`}>{s.role}</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {s.fullName && (
                    <div className="flex items-center gap-2" data-testid={`text-staff-fullname-${s.id}`}>
                      <User className="h-4 w-4 shrink-0" />
                      <span>{s.fullName}</span>
                    </div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-2" data-testid={`text-staff-phone-${s.id}`}>
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                  {s.snapchat && (
                    <div className="flex items-center gap-2" data-testid={`text-staff-snapchat-${s.id}`}>
                      <span className="font-medium text-xs">SC:</span>
                      <span>{s.snapchat}</span>
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(s)}
                      data-testid={`button-edit-staff-${s.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(s)}
                      data-testid={`button-delete-staff-${s.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent data-testid="dialog-staff-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Name *</Label>
              <Input
                id="staff-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Display name"
                required
                data-testid="input-staff-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role *</Label>
              <Input
                id="staff-role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Coach, Manager, Analyst"
                required
                data-testid="input-staff-role"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-fullname">Full Name</Label>
              <Input
                id="staff-fullname"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Full name"
                data-testid="input-staff-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">Phone</Label>
              <Input
                id="staff-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="input-staff-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-snapchat">Snapchat</Label>
              <Input
                id="staff-snapchat"
                value={formData.snapchat}
                onChange={(e) => setFormData({ ...formData, snapchat: e.target.value })}
                placeholder="Snapchat username"
                data-testid="input-staff-snapchat"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel-staff">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-testid="button-save-staff">
                {isSaving ? "Saving..." : editingStaff ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setStaffToDelete(null); } }}>
        <DialogContent data-testid="dialog-delete-staff">
          <DialogHeader>
            <DialogTitle>Delete Staff Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{staffToDelete?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setStaffToDelete(null); }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
