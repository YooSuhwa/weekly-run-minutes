"use client";

import { useSetAtom } from "jotai";
import { Mic, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { meetingModeAtom } from "@/atoms/meeting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateMeetingApiV1MeetingsPost } from "@/lib/api/__generated__/meetings/meetings";
import { cn } from "@/lib/utils";

export default function NewMeetingPage() {
  const router = useRouter();
  const setMode = useSetAtom(meetingModeAtom);
  const [selectedMode, setSelectedMode] = useState<"upload" | "realtime">("upload");

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

  const handleStart = () => {
    setMode(selectedMode);

    createMeeting.mutate({
      data: {
        team_id: "00000000-0000-0000-0000-000000000001", // TODO: Get from current team
        meeting_date: new Date().toISOString().split("T")[0],
        title: `${new Date().toLocaleDateString("ko-KR")} 주간회의`,
        meeting_mode: selectedMode,
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">새 회의 시작</h1>
        <p className="text-sm text-muted-foreground">회의 방식을 선택하세요</p>
      </div>

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

      <div className="mt-8 flex justify-end">
        <Button onClick={handleStart} size="lg" disabled={createMeeting.isPending}>
          {createMeeting.isPending ? "생성 중..." : "다음"}
        </Button>
      </div>
    </div>
  );
}
