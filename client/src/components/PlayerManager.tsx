import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import type { Player } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface PlayerManagerProps {
  players: Player[];
  roleOptions: string[];
  onAddPlayer: (name: string, role: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onEditPlayer: (playerId: string, name: string, role: string) => void;
}

const roleColorPalette = [
  "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20",
  "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-500/20",
  "bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-500/20",
  "bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20",
  "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border-yellow-500/20",
];

export function PlayerManager({ players, roleOptions, onAddPlayer, onRemovePlayer, onEditPlayer }: PlayerManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState(roleOptions[0] || "Tank");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      if (editingPlayer) {
        onEditPlayer(editingPlayer.id, newPlayerName.trim(), newPlayerRole);
        setEditingPlayer(null);
      } else {
        onAddPlayer(newPlayerName.trim(), newPlayerRole);
      }
      setNewPlayerName("");
      setNewPlayerRole(roleOptions[0] || "Tank");
      setIsOpen(false);
    }
  };

  const handleEditClick = (player: Player) => {
    setEditingPlayer(player);
    setNewPlayerName(player.name);
    setNewPlayerRole(player.role);
    setIsOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingPlayer(null);
      setNewPlayerName("");
      setNewPlayerRole(roleOptions[0] || "Tank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2" data-testid="button-add-player">
          <Plus className="h-4 w-4" />
          Manage Players
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingPlayer ? 'Edit Player' : 'Manage Players'}</DialogTitle>
          <DialogDescription>
            {editingPlayer ? 'Edit player information' : 'Add new players or remove existing ones'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">Player Name</Label>
              <Input
                id="player-name"
                placeholder="Enter player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                data-testid="input-player-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="player-role">Role</Label>
              <Select value={newPlayerRole} onValueChange={setNewPlayerRole}>
                <SelectTrigger id="player-role" data-testid="select-player-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAddPlayer}
              disabled={!newPlayerName.trim()}
              className="w-full"
              data-testid="button-confirm-add-player"
            >
              {editingPlayer ? (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Update Player
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Player
                </>
              )}
            </Button>
          </div>

          {!editingPlayer && players.length > 0 && (
            <div className="space-y-2">
              <Label>Current Players</Label>
              <div className="max-h-[300px] overflow-y-auto space-y-2 rounded-md border border-border p-3">
                {players.map((player) => {
                  const roleIdx = roleOptions.indexOf(player.role);
                  const colorClass = roleIdx >= 0 ? roleColorPalette[roleIdx % roleColorPalette.length] : roleColorPalette[0];
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 rounded-md hover-elevate border border-border"
                      data-testid={`player-item-${player.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className={`${colorClass} text-xs`}>
                          {player.role}
                        </Badge>
                        <span className="text-sm font-medium">{player.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(player)}
                          data-testid={`button-edit-player-${player.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemovePlayer(player.id)}
                          data-testid={`button-remove-player-${player.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} data-testid="button-close-dialog">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
