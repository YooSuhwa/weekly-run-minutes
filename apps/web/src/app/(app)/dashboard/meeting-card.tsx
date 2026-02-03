"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Mic,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  getListMeetingsApiV1MeetingsGetQueryKey,
  useDeleteMeetingApiV1MeetingsMeetingIdDelete,
  useUpdateMeetingApiV1MeetingsMeetingIdPut,
} from "@/lib/api/__generated__/meetings/meetings";
import type { MeetingResponse } from "@/lib/api/__generated__/schemas/meetingResponse";
import type { MeetingStatus } from "@/lib/api/__generated__/schemas/meetingStatus";
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
    preparing: {
      label: "준비 중",
      color: "text-yellow-600",
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
    },
    in_progress: {
      label: "진행 중",
      color: "text-green-600",
      icon: <Play className="h-4 w-4" />,
    },
    recording_done: {
      label: "녹음 완료",
      color: "text-blue-600",
      icon: <Mic className="h-4 w-4" />,
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

function getMeetingLink(meeting: MeetingResponse): string {
  switch (meeting.status) {
    case "created":
    case "weekly_report_loaded":
    case "recording_uploaded":
      return `/meetings/${meeting.id}/setup`;
    case "preparing":
    case "in_progress":
      return `/meetings/${meeting.id}/live`;
    case "recording_done":
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

export const MeetingCard = memo(function MeetingCard({ meeting }: { meeting: MeetingResponse }) {
  const config = statusConfig[meeting.status];
  const href = getMeetingLink(meeting);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState(meeting.title);

  // Delete mutation
  const deleteMutation = useDeleteMeetingApiV1MeetingsMeetingIdDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListMeetingsApiV1MeetingsGetQueryKey(),
        });
        toast.success("회의가 삭제되었습니다");
        setShowDeleteDialog(false);
      },
      onError: () => {
        toast.error("삭제에 실패했습니다");
      },
    },
  });

  // Update mutation
  const updateMutation = useUpdateMeetingApiV1MeetingsMeetingIdPut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListMeetingsApiV1MeetingsGetQueryKey(),
        });
        toast.success("회의가 수정되었습니다");
        setShowEditDialog(false);
      },
      onError: () => {
        toast.error("수정에 실패했습니다");
      },
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ meetingId: meeting.id });
  };

  const handleEdit = () => {
    if (!editTitle.trim()) return;
    updateMutation.mutate({
      meetingId: meeting.id,
      data: { title: editTitle.trim() },
    });
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Link href={href}>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className={cn("flex items-center gap-2", config.color)}>{config.icon}</div>
              <div>
                <p className="font-medium">{meeting.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(meeting.meeting_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn("rounded-full bg-secondary px-3 py-1 text-xs font-medium", config.color)}
              >
                {config.label}
              </span>
              <div onClick={handleMenuClick}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        setEditTitle(meeting.title);
                        setShowEditDialog(true);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      제목 수정
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회의 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{meeting.title}" 회의를 삭제하시겠습니까?
            <br />
            삭제된 회의는 복구할 수 없습니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Title Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회의 제목 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">제목</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                placeholder="회의 제목"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateMutation.isPending || !editTitle.trim()}
            >
              {updateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
