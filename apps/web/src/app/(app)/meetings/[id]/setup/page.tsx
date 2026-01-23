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
import { useUploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost } from "@/lib/api/__generated__/recordings/recordings";
import {
  useGetTeamApiV1TeamsTeamIdGet,
  useListTeamsApiV1TeamsGet,
} from "@/lib/api/__generated__/teams/teams";
import { useStartTranscriptionApiV1TranscriptionMeetingsMeetingIdTranscribePost } from "@/lib/api/__generated__/transcription/transcription";
import { useLoadWeeklyReportForMeetingApiV1WeeklyReportsMeetingsMeetingIdWeeklyReportPost } from "@/lib/api/__generated__/weekly-reports/weekly-reports";
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

  // Fetch teams list
  const { data: teams } = useListTeamsApiV1TeamsGet();
  const firstTeamId = teams?.[0]?.id ?? "";

  // Fetch first team's details (members)
  const { data: teamData } = useGetTeamApiV1TeamsTeamIdGet(firstTeamId, {
    query: { enabled: !!firstTeamId },
  });

  // Sync team members from query to atoms
  useEffect(() => {
    if (teamData?.members) {
      const mappedMembers: TeamMember[] = teamData.members.map((m) => ({
        id: m.id,
        name: m.name,
        presentationOrder: m.presentation_order,
        isActive: m.is_active,
        teamId: m.team_id,
      }));
      setMembers(mappedMembers);
      setSelectedMembers(mappedMembers.map((m) => m.id));
    }
  }, [teamData, setMembers, setSelectedMembers]);

  // Weekly report mutation
  const loadWeeklyReport =
    useLoadWeeklyReportForMeetingApiV1WeeklyReportsMeetingsMeetingIdWeeklyReportPost({
      mutation: {
        onSuccess: () => {
          setConfluence({
            ...confluence,
            weeklyReportLoaded: true,
            weeklyReportPageId: confluencePageId,
          });
          toast.success("주간업무록을 불러왔습니다");
        },
        onError: () => {
          toast.error("주간업무록 로드에 실패했습니다");
        },
      },
    });

  // Upload recording mutation
  const uploadRecording = useUploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost({
    mutation: {
      onSuccess: () => {
        setRecording({ ...recording, uploadStatus: "uploaded", uploadProgress: 100 });
        toast.success("파일 업로드 완료");
        // Start transcription after upload
        startTranscription.mutate({ meetingId });
      },
      onError: (error) => {
        const errorDetail = (error as { detail?: string })?.detail || "업로드 실패";
        setRecording({ ...recording, uploadStatus: "error", errorMessage: errorDetail });
        toast.error(errorDetail);
        setIsUploading(false);
      },
    },
  });

  // Start transcription mutation
  const startTranscription = useStartTranscriptionApiV1TranscriptionMeetingsMeetingIdTranscribePost(
    {
      mutation: {
        onSuccess: () => {
          router.push(`/meetings/${meetingId}/processing`);
        },
        onError: () => {
          // Navigate anyway, processing page will handle polling
          router.push(`/meetings/${meetingId}/processing`);
        },
        onSettled: () => {
          setIsUploading(false);
        },
      },
    },
  );

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

  const handleLoadWeeklyReport = () => {
    if (!confluencePageId.trim()) return;
    loadWeeklyReport.mutate({
      meetingId,
      data: { confluence_page_id: confluencePageId },
    });
  };

  const handleStartProcessing = () => {
    if (!recording.file) {
      toast.error("녹음 파일을 업로드해주세요");
      return;
    }

    setIsUploading(true);
    setRecording({ ...recording, uploadStatus: "uploading", uploadProgress: 0 });

    uploadRecording.mutate({
      meetingId,
      data: { file: recording.file },
    });
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
                disabled={
                  !confluencePageId.trim() ||
                  confluence.weeklyReportLoaded ||
                  loadWeeklyReport.isPending
                }
              >
                {confluence.weeklyReportLoaded ? (
                  <Check className="h-4 w-4" />
                ) : loadWeeklyReport.isPending ? (
                  "로딩..."
                ) : (
                  "불러오기"
                )}
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
