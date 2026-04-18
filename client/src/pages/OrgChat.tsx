import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Paperclip,
  X,
  Mic,
  Square,
  Smile,
  FileText,
  Download,
  Hash,
  Plus,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Theme } from "emoji-picker-react";

const LazyEmojiPicker = lazy(() => import("emoji-picker-react"));

interface OrgChatChannel {
  id: string;
  name: string;
}

interface OrgChatMessage {
  id: string;
  userId: string;
  message: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  senderName: string;
  createdAt: string | null;
}

export default function OrgChat() {
  const { user, hasOrgRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasOrgRole("org_admin");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const { data: channels = [] } = useQuery<OrgChatChannel[]>({
    queryKey: ["/api/org-chat/channels"],
  });

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      const def = channels.find(c => c.name === "Management") || channels[0];
      setSelectedChannelId(def.id);
    }
  }, [channels, selectedChannelId]);

  const { data: messages = [], isLoading } = useQuery<OrgChatMessage[]>({
    queryKey: ["/api/org-chat/messages", selectedChannelId],
    queryFn: async () => {
      const qp = selectedChannelId ? `?channelId=${selectedChannelId}` : "";
      const res = await fetch(`/api/org-chat/messages${qp}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!selectedChannelId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/org-chat/channels", { name });
      return res.json();
    },
    onSuccess: (channel: OrgChatChannel) => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chat/channels"] });
      setNewChannelName("");
      setShowNewChannelInput(false);
      if (channel?.id) setSelectedChannelId(channel.id);
      toast({ title: "Channel created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/org-chat/channels/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chat/channels"] });
      if (selectedChannelId === id) setSelectedChannelId(null);
      toast({ title: "Channel deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const formData = new FormData();
      formData.append("content", messageText.trim());
      if (selectedChannelId) formData.append("channelId", selectedChannelId);
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      const res = await fetch("/api/org-chat/messages", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send");
      }
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      setSelectedFile(null);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/org-chat/messages", selectedChannelId] });
    },
    onError: (e: any) => {
      setUploading(false);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/org-chat/messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chat/messages", selectedChannelId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!selectedChannelId) return;
    sendMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg";
        const file = new File([blob], `voice-message.${ext}`, { type: mimeType });
        setSelectedFile(file);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice messages.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    recordingChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingTime(0);
    setIsRecording(false);
  };

  const formatRecordingTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    const cursor = inputRef.current?.selectionStart ?? messageText.length;
    const before = messageText.slice(0, cursor);
    const after = messageText.slice(cursor);
    setMessageText(before + emojiData.emoji + after);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const renderAttachment = (msg: OrgChatMessage) => {
    if (!msg.attachmentUrl) return null;
    const url = msg.attachmentUrl;
    const type = msg.attachmentType || "";
    const name = msg.attachmentName || "file";

    if (type.startsWith("image/")) {
      return (
        <img src={url} alt={name} className="max-w-[300px] max-h-[200px] rounded-md mt-1 cursor-pointer" onClick={() => window.open(url, "_blank")} data-testid={`img-attachment-${msg.id}`} />
      );
    }
    if (type.startsWith("video/")) {
      return (
        <video src={url} controls className="max-w-[300px] rounded-md mt-1" data-testid={`video-attachment-${msg.id}`} />
      );
    }
    if (type.startsWith("audio/")) {
      return (
        <audio src={url} controls className="mt-1 max-w-[300px]" data-testid={`audio-attachment-${msg.id}`} />
      );
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-1 p-2 rounded border bg-muted/50 max-w-[300px]" data-testid={`file-attachment-${msg.id}`}>
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{name}</p>
          <p className="text-[10px] text-muted-foreground">{formatFileSize(msg.attachmentSize)}</p>
        </div>
        <Download className="h-3 w-3 text-muted-foreground shrink-0" />
      </a>
    );
  };

  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Channels sidebar */}
      <div className="w-60 border-r bg-muted/20 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold truncate">Channels</span>
          </div>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setShowNewChannelInput(v => !v)}
              data-testid="button-new-org-channel"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {showNewChannelInput && isAdmin && (
          <div className="p-2 border-b flex items-center gap-2">
            <Input
              autoFocus
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChannelName.trim()) {
                  createChannelMutation.mutate(newChannelName.trim());
                } else if (e.key === "Escape") {
                  setShowNewChannelInput(false);
                  setNewChannelName("");
                }
              }}
              placeholder="channel-name"
              className="h-8 text-sm"
              data-testid="input-new-org-channel"
            />
          </div>
        )}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {channels.map((ch) => {
              const isActive = ch.id === selectedChannelId;
              return (
                <div
                  key={ch.id}
                  className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md cursor-pointer hover-elevate ${isActive ? "bg-accent" : ""}`}
                  onClick={() => setSelectedChannelId(ch.id)}
                  data-testid={`org-channel-${ch.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{ch.name}</span>
                  </div>
                  {isAdmin && ch.name !== "Management" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete channel "${ch.name}"? All its messages will be removed.`)) {
                          deleteChannelMutation.mutate(ch.id);
                        }
                      }}
                      data-testid={`button-delete-org-channel-${ch.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Messages pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b flex items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold" data-testid="text-org-chat-title">
            {selectedChannel ? selectedChannel.name : "Management Chat"}
          </h1>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No messages yet. Start the conversation.</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.userId === user?.id;
                const canDelete = isOwn || isAdmin;
                return (
                  <div key={msg.id} className={`group flex flex-col ${isOwn ? "items-end" : "items-start"}`} data-testid={`org-chat-msg-${msg.id}`}>
                    <span className="text-[10px] text-muted-foreground mb-0.5">
                      {msg.senderName}
                      {msg.createdAt && <span className="ml-2">{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                    </span>
                    <div className={`flex items-center gap-1 ${isOwn ? "flex-row-reverse" : "flex-row"} max-w-[80%]`}>
                      <div className={`px-3 py-1.5 rounded-md text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                        {renderAttachment(msg)}
                      </div>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            if (confirm("Delete this message?")) {
                              deleteMessageMutation.mutate(msg.id);
                            }
                          }}
                          data-testid={`button-delete-org-msg-${msg.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {selectedFile && (
          <div className="px-4 py-2 border-t flex items-center gap-2 bg-muted/50">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
            <Button size="icon" variant="ghost" onClick={() => setSelectedFile(null)} data-testid="button-remove-file">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="p-4 border-t">
          {isRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-500">Recording {formatRecordingTime(recordingTime)}</span>
              </div>
              <Button size="icon" variant="ghost" onClick={cancelRecording} data-testid="button-cancel-recording">
                <X className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={stopRecording} data-testid="button-stop-recording">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.mp3,.m4a,.ogg,.wav,.webm,.aac"
                onChange={handleFileSelect}
                data-testid="input-file-upload"
              />
              <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} data-testid="button-attach-file">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={startRecording} data-testid="button-start-recording">
                <Mic className="h-4 w-4" />
              </Button>
              <div className="relative" ref={emojiPickerRef}>
                <Button size="icon" variant="ghost" onClick={() => setShowEmojiPicker(!showEmojiPicker)} data-testid="button-emoji-picker">
                  <Smile className="h-4 w-4" />
                </Button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 z-50">
                    <Suspense fallback={<div className="w-[350px] h-[400px] bg-background border rounded-md flex items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
                      <LazyEmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} width={350} height={400} />
                    </Suspense>
                  </div>
                )}
              </div>
              <Input
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedChannel ? `Message #${selectedChannel.name}` : "Select a channel..."}
                className="flex-1 text-sm"
                disabled={!selectedChannelId}
                data-testid="input-org-chat-message"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={(!messageText.trim() && !selectedFile) || uploading || !selectedChannelId}
                data-testid="button-send-org-chat"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
