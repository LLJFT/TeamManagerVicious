import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Hash, Plus, Trash2, Send, Paperclip, X, AtSign, FileText, Download, Settings, Menu } from "lucide-react";

interface ChatChannelWithPerms {
  id: string;
  name: string;
  canSend?: boolean;
}

interface ChatMessageWithUser {
  id: string;
  channelId: string;
  userId: string;
  message: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  mentions: string[] | null;
  createdAt: string | null;
  senderName: string;
  senderAvatarUrl: string | null;
  senderRoleName: string | null;
}

interface TeamUser {
  id: string;
  username: string;
  status: string;
  roleId: string | null;
}

export default function Chat() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [editChannelName, setEditChannelName] = useState("");
  const [settingsChannelId, setSettingsChannelId] = useState<string | null>(null);
  const canManageChannels = hasPermission("manage_channels");
  const canSendMessages = hasPermission("send_messages");

  const extractFilename = (url: string): string => {
    return url.split("/").pop() || "attachment";
  };

  const { data: channels = [], isLoading: channelsLoading } = useQuery<ChatChannelWithPerms[]>({
    queryKey: ["/api/chat/channels"],
  });

  const { data: messages = [] } = useQuery<ChatMessageWithUser[]>({
    queryKey: ["/api/chat/channels", selectedChannelId, "messages"],
    enabled: !!selectedChannelId,
    refetchInterval: 5000,
  });

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ["/api/chat/users"],
  });

  const activeUsers = teamUsers.filter(u => u.status === "active");

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

  const { data: allRoles = [] } = useQuery<{ id: string; name: string; permissions: string[] }[]>({
    queryKey: ["/api/roles"],
    enabled: canManageChannels,
  });

  const { data: channelPermissions = [] } = useQuery<{ id: string; channelId: string; roleId: string; canSend: boolean }[]>({
    queryKey: ["/api/chat/channels", settingsChannelId, "permissions"],
    enabled: !!settingsChannelId && canManageChannels,
  });

  const renameChannelMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiRequest("PUT", `/api/chat/channels/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
      toast({ title: "Channel renamed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to rename channel", description: err.message, variant: "destructive" });
    },
  });

  const saveChannelPermMutation = useMutation({
    mutationFn: async ({ channelId, roleId, canSend }: { channelId: string; roleId: string; canSend: boolean }) => {
      await apiRequest("POST", `/api/chat/channels/${channelId}/permissions`, { roleId, canSend });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels", settingsChannelId, "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save permission", description: err.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ channelId, message, attachmentUrl, attachmentType, attachmentName, attachmentSize, mentions }: {
      channelId: string;
      message?: string;
      attachmentUrl?: string;
      attachmentType?: string;
      attachmentName?: string;
      attachmentSize?: number;
      mentions?: string[];
    }) => {
      await apiRequest("POST", `/api/chat/channels/${channelId}/messages`, {
        message: message || null,
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
        attachmentSize: attachmentSize || null,
        mentions: mentions || [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels", selectedChannelId, "messages"] });
      setMessageText("");
      setSelectedFile(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send message", description: err.message, variant: "destructive" });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/chat/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels", selectedChannelId, "messages"] });
      toast({ title: "Message deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete message", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateChannel = () => {
    const name = newChannelName.trim();
    if (!name) return;
    createChannelMutation.mutate(name);
  };

  const handleSendMessage = async () => {
    if (!selectedChannelId) return;
    const text = messageText.trim();

    if (selectedFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.message || "Upload failed");
        }
        const uploadData = await uploadRes.json();

        const mentionedUserIds = extractMentions(text);
        sendMessageMutation.mutate({
          channelId: selectedChannelId,
          message: text || undefined,
          attachmentUrl: uploadData.url,
          attachmentType: uploadData.mimeType,
          attachmentName: uploadData.originalName,
          attachmentSize: uploadData.size,
          mentions: mentionedUserIds,
        });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!text) return;
    const mentionedUserIds = extractMentions(text);
    sendMessageMutation.mutate({
      channelId: selectedChannelId,
      message: text,
      mentions: mentionedUserIds,
    });
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const ids: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentioned = activeUsers.find(u => u.username.toLowerCase() === match![1].toLowerCase());
      if (mentioned) ids.push(mentioned.id);
    }
    return ids;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageText(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex >= 0 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === " ")) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(" ")) {
        setShowMentions(true);
        setMentionSearch(query);
        setMentionStartIndex(atIndex);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (username: string) => {
    const before = messageText.slice(0, mentionStartIndex);
    const after = messageText.slice(mentionStartIndex + mentionSearch.length + 1);
    setMessageText(`${before}@${username} ${after}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMentionUsers = activeUsers.filter(u =>
    u.username.toLowerCase().includes(mentionSearch.toLowerCase())
  ).slice(0, 8);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showMentions && filteredMentionUsers.length > 0) {
        insertMention(filteredMentionUsers[0].username);
      } else {
        handleSendMessage();
      }
    }
    if (e.key === "Escape") {
      setShowMentions(false);
    }
  };

  const handleChannelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateChannel();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max file size is 10MB", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderMessageContent = (text: string | null) => {
    if (!text) return null;
    const tokenRegex = /(https?:\/\/[^\s]+|(?:www\.)[^\s]+\.[a-z]{2,}[^\s]*|@\w+)/gi;
    const result: JSX.Element[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      const token = match[0];
      if (token.startsWith("http") || token.startsWith("www.")) {
        const href = token.startsWith("http") ? token : `https://${token}`;
        result.push(
          <a key={`u-${match.index}`} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80" data-testid={`link-chat-url-${match.index}`}>
            {token}
          </a>
        );
      } else if (token.startsWith("@")) {
        const username = token.slice(1);
        const isMentioned = activeUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
        if (isMentioned) {
          result.push(<span key={`m-${match.index}`} className="text-primary font-semibold">{token}</span>);
        } else {
          result.push(<span key={`m-${match.index}`}>{token}</span>);
        }
      }
      lastIndex = tokenRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }
    return result;
  };

  if (!hasPermission("view_chat")) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="chat-no-access">
        <p className="text-muted-foreground">You do not have permission to access chat.</p>
      </div>
    );
  }

  const selectedChannel = channels.find((c: ChatChannelWithPerms) => c.id === selectedChannelId);
  const canSendInChannel = selectedChannel?.canSend !== false;

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
      {showMobileSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowMobileSidebar(false)} />
      )}
      <Card className={`w-64 shrink-0 flex flex-col rounded-none border-t-0 border-b-0 border-l-0 ${showMobileSidebar ? "fixed inset-y-0 left-0 z-50" : "hidden"} md:flex md:relative md:z-auto`}>
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
                  onClick={() => { setSelectedChannelId(channel.id); setShowMobileSidebar(false); }}
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
                        setSettingsChannelId(channel.id);
                        setEditChannelName(channel.name);
                        setShowChannelSettings(true);
                      }}
                      data-testid={`button-settings-channel-${channel.id}`}
                    >
                      <Settings className="h-3 w-3" />
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
              <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setShowMobileSidebar(true)} data-testid="button-mobile-channels">
                <Menu />
              </Button>
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
                    <div key={msg.id} className="group flex gap-3" data-testid={`message-item-${msg.id}`}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="shrink-0 mt-0.5" data-testid={`button-avatar-${msg.id}`}>
                            <Avatar className="h-8 w-8 cursor-pointer">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {msg.senderName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3">
                          <div className="flex flex-col items-center gap-2">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                {msg.senderName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <p className="font-semibold text-sm">{msg.senderName}</p>
                            {msg.senderRoleName && (
                              <Badge variant="secondary" className="text-xs">{msg.senderRoleName}</Badge>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-sm" data-testid={`text-sender-${msg.id}`}>
                            {msg.senderName}
                          </span>
                          {msg.senderRoleName && (
                            <Badge variant="outline" className="text-xs py-0">{msg.senderRoleName}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${msg.id}`}>
                            {formatTimestamp(msg.createdAt)}
                          </span>
                        </div>
                        {msg.message && (
                          <p className="text-sm" data-testid={`text-message-${msg.id}`}>
                            {renderMessageContent(msg.message)}
                          </p>
                        )}
                        {msg.attachmentUrl && msg.attachmentType?.startsWith("image/") && (
                          <div className="mt-1 max-w-sm">
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName || "Attachment"}
                              className="rounded-md border border-border max-h-64 object-contain cursor-pointer"
                              onClick={() => window.open(msg.attachmentUrl!, "_blank")}
                              data-testid={`img-attachment-${msg.id}`}
                            />
                          </div>
                        )}
                        {msg.attachmentUrl && msg.attachmentType?.startsWith("video/") && (
                          <div className="mt-1 max-w-sm">
                            <video
                              controls
                              className="rounded-md border border-border max-h-64 w-full"
                              data-testid={`video-attachment-${msg.id}`}
                            >
                              <source src={msg.attachmentUrl} type={msg.attachmentType} />
                            </video>
                          </div>
                        )}
                        {msg.attachmentUrl && msg.attachmentType?.startsWith("audio/") && (
                          <div className="mt-1 max-w-sm">
                            <audio
                              controls
                              className="w-full"
                              data-testid={`audio-attachment-${msg.id}`}
                            >
                              <source src={msg.attachmentUrl} type={msg.attachmentType} />
                            </audio>
                          </div>
                        )}
                        {msg.attachmentUrl && !msg.attachmentType?.startsWith("image/") && !msg.attachmentType?.startsWith("video/") && !msg.attachmentType?.startsWith("audio/") && (
                          <Card className="mt-1 p-3 max-w-sm" data-testid={`file-attachment-card-${msg.id}`}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" data-testid={`file-name-${msg.id}`}>
                                  {msg.attachmentName || extractFilename(msg.attachmentUrl)}
                                </p>
                                {msg.attachmentSize && (
                                  <p className="text-xs text-muted-foreground">{formatFileSize(msg.attachmentSize)}</p>
                                )}
                              </div>
                              <a
                                href={msg.attachmentUrl}
                                download={msg.attachmentName || true}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0"
                                data-testid={`link-download-${msg.id}`}
                              >
                                <Button size="icon" variant="ghost">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          </Card>
                        )}
                      </div>

                      {(msg.userId === user?.id || hasPermission("delete_any_message")) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0 invisible group-hover:visible"
                          onClick={() => deleteMessageMutation.mutate(msg.id)}
                          disabled={deleteMessageMutation.isPending}
                          data-testid={`button-delete-message-${msg.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t">
              {!canSendMessages && (
                <div className="text-center text-sm text-muted-foreground py-2" data-testid="text-send-messages-restricted">
                  You do not have permission to send messages.
                </div>
              )}
              {!canSendInChannel && canSendMessages && (
                <div className="text-center text-sm text-muted-foreground py-2" data-testid="text-send-restricted">
                  You do not have permission to send messages in this channel.
                </div>
              )}
              {canSendMessages && canSendInChannel && selectedFile && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-muted/50 border border-border">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    data-testid="button-remove-file"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {canSendMessages && canSendInChannel && (
                <div className="relative">
                  {showMentions && filteredMentionUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto z-50" data-testid="mentions-dropdown">
                      {filteredMentionUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover-elevate"
                          onClick={() => insertMention(u.username)}
                          data-testid={`mention-option-${u.id}`}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {u.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{u.username}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-attach-file"
                    >
                      <Paperclip />
                    </Button>
                    <Input
                      ref={inputRef}
                      placeholder={`Message #${selectedChannel.name}`}
                      value={messageText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      data-testid="input-message"
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending || uploading || (!messageText.trim() && !selectedFile)}
                      data-testid="button-send-message"
                    >
                      <Send />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="text-select-channel">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Select a channel to start chatting</p>
              <Button variant="outline" className="mt-3 md:hidden" onClick={() => setShowMobileSidebar(true)} data-testid="button-open-channels-mobile">
                <Menu className="h-4 w-4 mr-2" />
                View Channels
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showChannelSettings} onOpenChange={setShowChannelSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Channel Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Channel Name</Label>
              <div className="flex gap-2">
                <Input
                  value={editChannelName}
                  onChange={(e) => setEditChannelName(e.target.value)}
                  data-testid="input-edit-channel-name"
                />
                <Button
                  onClick={() => {
                    if (settingsChannelId && editChannelName.trim()) {
                      renameChannelMutation.mutate({ id: settingsChannelId, name: editChannelName.trim() });
                    }
                  }}
                  disabled={renameChannelMutation.isPending}
                  data-testid="button-rename-channel"
                >
                  Rename
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Role Permissions</Label>
              <p className="text-xs text-muted-foreground">Control which roles can send messages in this channel</p>
              {allRoles.map(role => {
                const perm = channelPermissions.find(p => p.roleId === role.id);
                const canSend = perm ? perm.canSend : true;
                return (
                  <div key={role.id} className="flex items-center justify-between gap-4 p-2 rounded-md border border-border">
                    <span className="text-sm font-medium">{role.name}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Can Send</Label>
                      <Switch
                        checked={canSend}
                        onCheckedChange={(checked) => {
                          if (settingsChannelId) {
                            saveChannelPermMutation.mutate({
                              channelId: settingsChannelId,
                              roleId: role.id,
                              canSend: checked,
                            });
                          }
                        }}
                        data-testid={`switch-perm-${role.id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => {
                  if (settingsChannelId && window.confirm("Are you sure you want to delete this channel?")) {
                    deleteChannelMutation.mutate(settingsChannelId);
                    setShowChannelSettings(false);
                  }
                }}
                data-testid="button-delete-channel-settings"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Channel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
