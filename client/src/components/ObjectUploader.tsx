import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  uploadUrl?: string;
  accept?: string;
  onUploaded?: (result: { url: string; path: string; file?: File; index: number; total: number }) => void;
  onError?: (error: string) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  children: ReactNode;
  /** When true, the file picker accepts multiple files and `onUploaded`
   *  fires once per successfully uploaded file. */
  multiple?: boolean;
  /** Hard cap to keep one accidental drag-from-Pictures-folder from
   *  enqueuing thousands of uploads. */
  maxFiles?: number;
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
  multiple = false,
  maxFiles = 50,
}: ObjectUploaderProps) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const picked = files.slice(0, maxFiles);
    if (files.length > maxFiles) {
      onError?.(`Only the first ${maxFiles} files were queued.`);
    }

    setProgress({ done: 0, total: picked.length });
    const completed: { url: string; path: string }[] = [];

    // Upload sequentially so we never thrash the bandwidth or storage
    // sidecar with N parallel multi-MB POSTs. Errors on any single file
    // are reported via onError but do not abort the rest of the batch.
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
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
          // Prefer the human-readable `message` over the machine `error` code
          // (e.g. "not_a_scoreboard") so toasts surface the friendly text.
          throw new Error(err.message || err.error || "Upload failed");
        }
        const data = await res.json();
        completed.push(data);
        onUploaded?.({ ...data, file, index: i, total: picked.length });
      } catch (err: any) {
        console.error("Upload error:", err);
        onError?.(`${file.name}: ${err.message || "Upload failed"}`);
      } finally {
        setProgress((prev) => prev ? { done: prev.done + 1, total: prev.total } : null);
      }
    }

    onComplete?.({ successful: completed.map((c) => ({ uploadURL: c.url || c.path })) });
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [uploadUrl, onUploaded, onComplete, onError, maxFiles]);

  const uploading = progress !== null;
  const label = uploading
    ? (progress.total > 1 ? `Uploading ${progress.done}/${progress.total}…` : "Uploading…")
    : children;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
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
        {label}
      </Button>
    </div>
  );
}
