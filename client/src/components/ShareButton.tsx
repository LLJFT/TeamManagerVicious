import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  text: string;
}

export function ShareButton({ text }: ShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleCopy}
      data-testid="button-share"
    >
      {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
