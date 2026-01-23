"use client";

import { useAtom } from "jotai";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { meetingsListAtom } from "@/atoms/meeting";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingCard } from "./meeting-card";

export default function DashboardPage() {
  const [meetings, setMeetings] = useAtom(meetingsListAtom);

  useEffect(() => {
    // TODO: Replace with actual API call via Orval
    async function fetchMeetings() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/meetings`,
        );
        if (res.ok) {
          const data = await res.json();
          setMeetings(data);
        }
      } catch {
        // API not available yet - show empty state
      }
    }
    fetchMeetings();
  }, [setMeetings]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-sm text-muted-foreground">최근 회의 목록</p>
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
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  );
}
