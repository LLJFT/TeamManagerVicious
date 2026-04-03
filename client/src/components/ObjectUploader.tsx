import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  uploadUrl?: string;
  accept?: string;
  onUploaded?: (result: { url: string; path: string }) => void;
  onError?: (error: string) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  children: ReactNode;
  onGetUploadParameters?: () => Promise<any>;
  onComplete?: (result: any) => void;
  onOpen?: () => void;
  maxNumberOfFiles?: number;
  maxFileSize?: number;
}

export function ObjectUploader({
  uploadUrl = "/api/objects/upload",
  accept = "image/*",
  onUploaded,
  onError,
  onComplete,
  buttonClassName,
  buttonVariant = "outline",
  buttonSize = "sm",
  children,
}: ObjectUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || err.message || "Upload failed");
      }

      const data = await res.json();
      onUploaded?.(data);
      onComplete?.({ successful: [{ uploadURL: data.url || data.path }] });
    } catch (err: any) {
      console.error("Upload error:", err);
      onError?.(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [uploadUrl, onUploaded, onComplete, onError]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-file-upload"
      />
      <Button
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
        variant={buttonVariant}
        size={buttonSize}
        type="button"
        disabled={uploading}
      >
        {uploading ? "Uploading..." : children}
      </Button>
    </div>
  );
}
