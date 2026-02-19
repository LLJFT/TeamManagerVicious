import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ChatChannel } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Hash, Plus, Trash2, Send } from "lucide-react";

interface ChatMessageWithUser {
  id: string;
  channelId: string;
  userId: string;
  message: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: string | null;
  senderName: string;
}

export default function Chat() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const canManageChannels = hasPermission("manage_chat_channels");

  const { data: channels = [], isLoading: channelsLoading } = useQuery<ChatChannel[]>({
    queryKey: ["/api/chat/channels"],
  });

  const { data: messages = [] } = useQuery<ChatMessageWithUser[]>({
    queryKey: ["/api/chat/channels", selectedChannelId, "messages"],
    enabled: !!selectedChannelId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/chat/channels", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
      setNewChannelName("");
      setShowNewChannelInput(false);
      toast({ title: "Channel created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create channel", description: err.message, variant: "destructive" });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      await apiRequest("DELETE", `/api/chat/channels/${channelId}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
      if (selectedChannelId === deletedId) {
        setSelectedChannelId(null);
      }
      toast({ title: "Channel deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete channel", description: err.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ channelId, message }: { channelId: string; message: string }) => {
      await apiRequest("POST", `/api/chat/channels/${channelId}/messages`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels", selectedChannelId, "messages"] });
      setMessageText("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send message", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateChannel = () => {
    const name = newChannelName.trim();
    if (!name) return;
    createChannelMutation.mutate(name);
  };

  const handleSendMessage = () => {
    const text = messageText.trim();
    if (!text || !selectedChannelId) return;
    sendMessageMutation.mutate({ channelId: selectedChannelId, message: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleChannelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateChannel();
    }
  };

  if (!hasPermission("access_chat")) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="chat-no-access">
        <p className="text-muted-foreground">You do not have permission to access chat.</p>
      </div>
    );
  }

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return "";
    try {
      return format(new Date(ts), "MMM d, h:mm a");
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden" data-testid="chat-page">
      <Card className="w-64 shrink-0 flex flex-col rounded-none border-t-0 border-b-0 border-l-0">
        <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">Channels</h2>
          {canManageChannels && (
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-add-channel"
              onClick={() => setShowNewChannelInput(!showNewChannelInput)}
            >
              <Plus />
            </Button>
          )}
        </div>

        {showNewChannelInput && canManageChannels && (
          <div className="p-2 border-b flex gap-2">
            <Input
              placeholder="Channel name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={handleChannelKeyDown}
              data-testid="input-new-channel-name"
            />
            <Button
              size="icon"
              onClick={handleCreateChannel}
              disabled={createChannelMutation.isPending || !newChannelName.trim()}
              data-testid="button-create-channel"
            >
              <Plus />
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {channelsLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-channels">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No channels yet</p>
              {canManageChannels && <p className="mt-1">Create one to get started</p>}
            </div>
          ) : (
            <div className="py-1">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover-elevate ${
                    selectedChannelId === channel.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedChannelId(channel.id)}
                  data-testid={`channel-item-${channel.id}`}
                >
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{channel.name}</span>
                  {canManageChannels && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      style={{ visibility: "visible" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChannelMutation.mutate(channel.id);
                      }}
                      data-testid={`button-delete-channel-${channel.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChannel ? (
          <>
            <div className="p-3 border-b flex items-center gap-2">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold" data-testid="text-channel-name">{selectedChannel.name}</h2>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground" data-testid="text-no-messages">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-0.5" data-testid={`message-item-${msg.id}`}>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm" data-testid={`text-sender-${msg.id}`}>
                          {msg.senderName}
                        </span>
                        <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${msg.id}`}>
                          {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm" data-testid={`text-message-${msg.id}`}>{msg.message}</p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder={`Message #${selectedChannel.name}`}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                data-testid="input-message"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !messageText.trim()}
                data-testid="button-send-message"
              >
                <Send />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="text-select-channel">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
