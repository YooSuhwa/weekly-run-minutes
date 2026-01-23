"use client";

import { Upload, X } from "lucide-react";
import { useCallback } from "react";
import { type Accept, useDropzone } from "react-dropzone";
import { cn, formatFileSize } from "@/lib/utils";
import { Button } from "./button";

const AUDIO_ACCEPT: Accept = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/webm": [".webm"],
  "audio/ogg": [".ogg"],
  "audio/mp4": [".m4a"],
  "audio/aac": [".aac"],
  "audio/flac": [".flac"],
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  file,
  onFileSelect,
  onFileRemove,
  disabled,
  className,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: AUDIO_ACCEPT,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled,
  });

  const rejectionMessage =
    fileRejections.length > 0
      ? fileRejections[0].errors[0].code === "file-too-large"
        ? "파일 크기가 100MB를 초과합니다"
        : "지원하지 않는 파일 형식입니다"
      : null;

  if (file) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onFileRemove} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-1 text-sm font-medium">
          {isDragActive ? "여기에 놓으세요" : "녹음 파일을 드래그하거나 클릭하세요"}
        </p>
        <p className="text-xs text-muted-foreground">
          MP3, WAV, WebM, M4A, OGG, AAC, FLAC (최대 100MB)
        </p>
      </div>
      {rejectionMessage && <p className="mt-2 text-xs text-destructive">{rejectionMessage}</p>}
    </div>
  );
}
