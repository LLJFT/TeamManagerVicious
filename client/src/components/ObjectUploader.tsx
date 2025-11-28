import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  onOpen?: () => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  onOpen,
  buttonClassName,
  buttonVariant = "outline",
  buttonSize = "sm",
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  
  const onCompleteRef = useRef(onComplete);
  const onGetUploadParametersRef = useRef(onGetUploadParameters);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    onGetUploadParametersRef.current = onGetUploadParameters;
  }, [onGetUploadParameters]);

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['image/*'],
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: () => onGetUploadParametersRef.current(),
      })
      .on("complete", (result) => {
        console.log('[ObjectUploader] Upload complete, result:', result);
        if (result.successful && result.successful.length > 0) {
          console.log('[ObjectUploader] Successful upload:', result.successful[0]);
          console.log('[ObjectUploader] Upload URL:', result.successful[0].uploadURL);
        }
        onCompleteRef.current?.(result);
        setShowModal(false);
        uppy.cancelAll();
      })
  );
  
  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  const handleOpen = useCallback(() => {
    uppy.cancelAll();
    onOpen?.();
    setShowModal(true);
  }, [uppy, onOpen]);

  return (
    <div>
      <Button
        onClick={handleOpen}
        className={buttonClassName}
        variant={buttonVariant}
        size={buttonSize}
        type="button"
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => {
          uppy.cancelAll();
          setShowModal(false);
        }}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
