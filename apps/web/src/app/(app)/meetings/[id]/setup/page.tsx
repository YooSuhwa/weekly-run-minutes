"use client";

import { useAtom } from "jotai";
import { Check, Link as LinkIcon, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { confluenceAtom } from "@/atoms/confluence";
import { recordingAtom } from "@/atoms/recording";
import { selectedMembersAtom, type TeamMember, teamMembersAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function MeetingSetupPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const meetingId = params.id as string;

  const [recording, setRecording] = useAtom(recordingAtom);
  const [confluence, setConfluence] = useAtom(confluenceAtom);
  const [members, setMembers] = useAtom(teamMembersAtom);
  const [selectedMembers, setSelectedMembers] = useAtom(selectedMembersAtom);
  const [confluencePageId, setConfluencePageId] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch team members on mount
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/teams`,
        );
        if (res.ok) {
          const teams = await res.json();
          if (teams.length > 0) {
            const teamRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/teams/${teams[0].id}`,
            );
            if (teamRes.ok) {
              const team = await teamRes.json();
              setMembers(team.members || []);
              setSelectedMembers(team.members?.map((m: TeamMember) => m.id) || []);
            }
          }
        }
      } catch {
        // Use fallback data
        setMembers([
          { id: "1", name: "이상윤", presentationOrder: 1, isActive: true, teamId: "" },
          { id: "2", name: "선설희", presentationOrder: 2, isActive: true, teamId: "" },
          { id: "3", name: "최보연", presentationOrder: 3, isActive: true, teamId: "" },
          { id: "4", name: "유수화", presentationOrder: 4, isActive: true, teamId: "" },
          { id: "5", name: "김정연", presentationOrder: 5, isActive: true, teamId: "" },
        ]);
        setSelectedMembers(["1", "2", "3", "4", "5"]);
      }
    }
    fetchMembers();
  }, [setMembers, setSelectedMembers]);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleFileSelect = (file: File) => {
    setRecording({ ...recording, file, uploadStatus: "idle", errorMessage: null });
  };

  const handleFileRemove = () => {
    setRecording({ ...recording, file: null, uploadStatus: "idle" });
  };

  const handleLoadWeeklyReport = async () => {
    if (!confluencePageId.trim()) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/weekly-reports/meetings/${meetingId}/weekly-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confluence_page_id: confluencePageId }),
        },
      );

      if (res.ok) {
        setConfluence({
          ...confluence,
          weeklyReportLoaded: true,
          weeklyReportPageId: confluencePageId,
        });
        toast.success("주간업무록을 불러왔습니다");
      } else {
        toast.error("주간업무록 로드에 실패했습니다");
      }
    } catch {
      toast.warning("API 연결 불가 - 오프라인 모드로 진행합니다");
      setConfluence({
        ...confluence,
        weeklyReportLoaded: true,
        weeklyReportPageId: confluencePageId,
      });
    }
  };

  const handleStartProcessing = async () => {
    if (!recording.file) {
      toast.error("녹음 파일을 업로드해주세요");
      return;
    }

    setIsUploading(true);
    setRecording({ ...recording, uploadStatus: "uploading", uploadProgress: 0 });

    try {
      // Upload file
      const formData = new FormData();
      formData.append("file", recording.file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/recordings/meetings/${meetingId}/recording`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (res.ok) {
        setRecording({ ...recording, uploadStatus: "uploaded", uploadProgress: 100 });
        toast.success("파일 업로드 완료");

        // Start transcription
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/transcription/meetings/${meetingId}/transcribe`,
          { method: "POST" },
        );

        router.push(`/meetings/${meetingId}/processing`);
      } else {
        const error = await res.json();
        setRecording({ ...recording, uploadStatus: "error", errorMessage: error.detail });
        toast.error(error.detail || "업로드 실패");
      }
    } catch {
      toast.warning("API 연결 불가 - 데모 모드로 진행합니다");
      router.push(`/meetings/${meetingId}/processing`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">회의 설정</h1>
        <p className="text-sm text-muted-foreground">녹음 파일을 업로드하고 설정을 완료하세요</p>
      </div>

      <div className="space-y-6">
        {/* Confluence Weekly Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4" />
              주간업무록 (선택)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Confluence 페이지 ID 입력"
                value={confluencePageId}
                onChange={(e) => setConfluencePageId(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={confluence.weeklyReportLoaded}
              />
              <Button
                variant="outline"
                onClick={handleLoadWeeklyReport}
                disabled={!confluencePageId.trim() || confluence.weeklyReportLoaded}
              >
                {confluence.weeklyReportLoaded ? <Check className="h-4 w-4" /> : "불러오기"}
              </Button>
            </div>
            {confluence.weeklyReportLoaded && (
              <p className="mt-2 text-xs text-green-600">주간업무록이 연결되었습니다</p>
            )}
          </CardContent>
        </Card>

        {/* Attendees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              참석자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selectedMembers.includes(member.id)
                      ? "border-primary bg-primary/10 text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">녹음 파일</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              file={recording.file}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              disabled={isUploading}
            />
            {recording.uploadStatus === "uploading" && (
              <ProgressBar value={recording.uploadProgress} label="업로드 중" className="mt-4" />
            )}
          </CardContent>
        </Card>

        {/* Start Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleStartProcessing}
            disabled={!recording.file || isUploading}
          >
            {isUploading ? "업로드 중..." : "회의록 생성 시작"}
          </Button>
        </div>
      </div>
    </div>
  );
}
