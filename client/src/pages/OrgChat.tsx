import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function OrgChat() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/org-chat/messages"],
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", "/api/org-chat/messages", { content }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/org-chat/messages"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <div className="p-4 border-b flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h1 className="text-lg font-semibold" data-testid="text-org-chat-title">Management Chat</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No messages yet. Start the conversation.</p>
            </div>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isOwn = msg.userId === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`} data-testid={`org-chat-msg-${msg.id}`}>
                <span className="text-[10px] text-muted-foreground mb-0.5">{msg.senderName}</span>
                <div className={`px-3 py-1.5 rounded-md text-sm max-w-[80%] ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="resize-none text-sm min-h-[38px] max-h-[100px]"
          rows={1}
          data-testid="input-org-chat-message"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          data-testid="button-send-org-chat"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
