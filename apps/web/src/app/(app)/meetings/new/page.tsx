"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { BookText, FileText, Mic, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MeetingType } from "@/atoms/meeting";
import { meetingModeAtom, meetingTypeAtom } from "@/atoms/meeting";
import { selectedTeamIdAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateMeetingApiV1MeetingsPost } from "@/lib/api/__generated__/meetings/meetings";
import { cn } from "@/lib/utils";

export default function NewMeetingPage() {
  const router = useRouter();
  const setMode = useSetAtom(meetingModeAtom);
  const setMeetingType = useSetAtom(meetingTypeAtom);
  const selectedTeamId = useAtomValue(selectedTeamIdAtom);
  const [selectedMode, setSelectedMode] = useState<"upload" | "realtime">("upload");
  const [selectedType, setSelectedType] = useState<MeetingType>("weekly_report");

  const createMeeting = useCreateMeetingApiV1MeetingsPost({
    mutation: {
      onSuccess: (data) => {
        if (selectedMode === "realtime") {
          router.push(`/meetings/${data.id}/live`);
        } else {
          router.push(`/meetings/${data.id}/setup`);
        }
      },
      onError: () => {
        // Fallback: navigate with temp ID for development
        router.push("/meetings/new-temp/setup");
      },
    },
  });

  const hasTeam = !!selectedTeamId;

  const handleStart = () => {
    if (!selectedTeamId) return;

    setMode(selectedMode);
    setMeetingType(selectedType);

    const title =
      selectedType === "general"
        ? `${new Date().toLocaleDateString("ko-KR")} 일반 회의`
        : `${new Date().toLocaleDateString("ko-KR")} 주간회의`;

    createMeeting.mutate({
      data: {
        team_id: selectedTeamId,
        meeting_date: new Date().toISOString().split("T")[0],
        title,
        meeting_mode: selectedMode,
        meeting_type: selectedType,
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">새 회의 시작</h1>
        <p className="text-sm text-muted-foreground">회의 방식을 선택하세요</p>
      </div>

      {!hasTeam && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          팀을 먼저 선택해주세요.{" "}
          <button
            type="button"
            className="underline font-medium"
            onClick={() => router.push("/teams")}
          >
            팀 선택하기
          </button>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">회의 유형</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card
            className={cn(
              "cursor-pointer transition-all",
              selectedType === "weekly_report" && "ring-2 ring-primary",
            )}
            onClick={() => setSelectedType("weekly_report")}
          >
            <CardHeader className="p-4 text-center">
              <BookText className="mx-auto mb-1 h-8 w-8 text-primary" />
              <CardTitle className="text-base">주간회의</CardTitle>
              <CardDescription className="text-xs">주간업무록 기반 회의록 생성</CardDescription>
            </CardHeader>
          </Card>

          <Card
            className={cn(
              "cursor-pointer transition-all",
              selectedType === "general" && "ring-2 ring-primary",
            )}
            onClick={() => setSelectedType("general")}
          >
            <CardHeader className="p-4 text-center">
              <FileText className="mx-auto mb-1 h-8 w-8 text-primary" />
              <CardTitle className="text-base">일반 회의</CardTitle>
              <CardDescription className="text-xs">자유 형식 회의록 생성</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">회의 방식</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className={cn(
              "cursor-pointer transition-all",
              selectedMode === "upload" && "ring-2 ring-primary",
            )}
            onClick={() => setSelectedMode("upload")}
          >
            <CardHeader className="text-center">
              <Upload className="mx-auto mb-2 h-10 w-10 text-primary" />
              <CardTitle className="text-lg">녹음 파일 업로드</CardTitle>
              <CardDescription>기존 녹음 파일로 회의록 생성</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>- MP3, WAV, WebM, M4A 지원</li>
                <li>- 최대 100MB</li>
                <li>- AI 자동 회의록 생성</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "cursor-pointer transition-all",
              selectedMode === "realtime" && "ring-2 ring-primary",
            )}
            onClick={() => setSelectedMode("realtime")}
          >
            <CardHeader className="text-center">
              <Mic className="mx-auto mb-2 h-10 w-10 text-primary" />
              <CardTitle className="text-lg">실시간 회의</CardTitle>
              <CardDescription>Weeky가 회의를 진행</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>- 브라우저 녹음</li>
                <li>- 질문 트리 기반 진행</li>
                <li>- 키보드 단축키 지원</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleStart}
          size="lg"
          disabled={createMeeting.isPending || !hasTeam}
        >
          {createMeeting.isPending ? "생성 중..." : "다음"}
        </Button>
      </div>
    </div>
  );
}
