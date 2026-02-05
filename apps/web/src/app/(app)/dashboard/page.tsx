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
        <div className="flex flex-col items-center justify-center py-16">
          <Weeky expression="thinking" size="lg" message="회의 목록을 불러오고 있어요..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Weeky expression="sorry" size="lg" message="회의 목록을 불러오는데 실패했어요" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Welcome Card with Gradient */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-[oklch(0.95_0.05_175)] to-[oklch(0.92_0.08_220)] p-6 border border-primary/20 shadow-sm">
        <div className="flex items-center justify-between">
          <Weeky
            expression="greeting"
            variant="bubble"
            size="md"
            message="안녕하세요! 이번 주도 화이팅해요!"
          />
          <Link href="/meetings/new">
            <Button size="lg" className="shadow-md">
              <Plus className="h-4 w-4" />새 회의 시작
            </Button>
          </Link>
        </div>
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
