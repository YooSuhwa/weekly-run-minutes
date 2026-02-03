"use client";

import { useAtomValue } from "jotai";
import { Plus } from "lucide-react";
import Link from "next/link";
import { selectedTeamIdAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Weeky } from "@/components/weeky/weeky";
import { useListMeetingsApiV1MeetingsGet } from "@/lib/api/__generated__/meetings/meetings";
import { MeetingCard } from "./meeting-card";

export default function DashboardPage() {
  const selectedTeamId = useAtomValue(selectedTeamIdAtom);

  const {
    data: meetings = [],
    isLoading,
    error,
  } = useListMeetingsApiV1MeetingsGet(
    selectedTeamId ? { team_id: selectedTeamId } : undefined,
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <p className="text-destructive">회의 목록을 불러오는데 실패했습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Weeky expression="greeting" size="md" />
          <div>
            <h1 className="text-2xl font-bold">대시보드</h1>
            <p className="text-sm text-muted-foreground">
              안녕하세요! 이번 주 잘 지내고 있나요?
            </p>
          </div>
        </div>
        <Link href="/meetings/new">
          <Button>
            <Plus className="h-4 w-4" />새 회의
          </Button>
        </Link>
      </div>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="mb-4 text-muted-foreground">아직 회의가 없습니다</p>
            <Link href="/meetings/new">
              <Button variant="outline">
                <Plus className="h-4 w-4" />첫 회의 시작하기
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              style={{ contentVisibility: "auto", containIntrinsicSize: "0 120px" }}
            >
              <MeetingCard meeting={meeting} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
