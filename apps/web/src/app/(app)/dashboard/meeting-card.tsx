"use client";

import { AlertCircle, CheckCircle, FileText, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import type { Meeting, MeetingStatus } from "@/atoms/meeting";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

const statusConfig: Record<MeetingStatus, { label: string; color: string; icon: React.ReactNode }> =
  {
    created: {
      label: "생성됨",
      color: "text-muted-foreground",
      icon: <FileText className="h-4 w-4" />,
    },
    weekly_report_loaded: {
      label: "업무록 로드",
      color: "text-blue-600",
      icon: <FileText className="h-4 w-4" />,
    },
    recording_uploaded: {
      label: "녹음 업로드",
      color: "text-blue-600",
      icon: <Upload className="h-4 w-4" />,
    },
    transcribing: {
      label: "STT 처리 중",
      color: "text-yellow-600",
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
    },
    transcribed: {
      label: "STT 완료",
      color: "text-blue-600",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    generating_minutes: {
      label: "회의록 생성 중",
      color: "text-yellow-600",
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
    },
    draft_ready: {
      label: "초안 완료",
      color: "text-green-600",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    published: {
      label: "게시 완료",
      color: "text-green-700",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    failed: { label: "실패", color: "text-destructive", icon: <AlertCircle className="h-4 w-4" /> },
  };

function getMeetingLink(meeting: Meeting): string {
  switch (meeting.status) {
    case "created":
    case "weekly_report_loaded":
    case "recording_uploaded":
      return `/meetings/${meeting.id}/setup`;
    case "transcribing":
    case "transcribed":
    case "generating_minutes":
      return `/meetings/${meeting.id}/processing`;
    case "draft_ready":
    case "published":
      return `/meetings/${meeting.id}/minutes`;
    case "failed":
      return `/meetings/${meeting.id}/setup`;
    default:
      return `/meetings/${meeting.id}/setup`;
  }
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const config = statusConfig[meeting.status];
  const href = getMeetingLink(meeting);

  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-2", config.color)}>{config.icon}</div>
            <div>
              <p className="font-medium">{meeting.title}</p>
              <p className="text-xs text-muted-foreground">{formatDate(meeting.meetingDate)}</p>
            </div>
          </div>
          <span
            className={cn("rounded-full bg-secondary px-3 py-1 text-xs font-medium", config.color)}
          >
            {config.label}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
