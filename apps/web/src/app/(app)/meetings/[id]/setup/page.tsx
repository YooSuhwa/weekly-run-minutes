"use client";

import { useAtom } from "jotai";
import { Check, Link as LinkIcon, ListTodo, Plus, Trash2, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { confluenceAtom } from "@/atoms/confluence";
import { recordingAtom } from "@/atoms/recording";
import { selectedMembersAtom, type TeamMember, teamMembersAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Weeky } from "@/components/weeky/weeky";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import type { WeeklyReportResponse } from "@/lib/api/__generated__/schemas/weeklyReportResponse";

interface AgendaItem {
  title: string;
  description: string;
  presenter: string;
  duration_minutes: number | null;
}

interface ParsedMemberTask {
  status: string;
  title: string;
  details: string[];
}

interface ParsedCategory {
  name: string;
  tasks: ParsedMemberTask[];
}

interface ParsedMember {
  name: string;
  categories: ParsedCategory[];
}

interface ParsedWeeklyData {
  team_members: ParsedMember[];
}
import {
  useGetMeetingApiV1MeetingsMeetingIdGet,
  useUpdateMeetingApiV1MeetingsMeetingIdPut,
} from "@/lib/api/__generated__/meetings/meetings";
import { useUploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost } from "@/lib/api/__generated__/recordings/recordings";
import {
  useGetTeamApiV1TeamsTeamIdGet,
  useListTeamsApiV1TeamsGet,
} from "@/lib/api/__generated__/teams/teams";
import { useStartTranscriptionApiV1TranscriptionMeetingsMeetingIdTranscribePost } from "@/lib/api/__generated__/transcription/transcription";
import { useLoadWeeklyReportForMeetingApiV1WeeklyReportsMeetingsMeetingIdWeeklyReportPost } from "@/lib/api/__generated__/weekly-reports/weekly-reports";
import { cn } from "@/lib/utils";

const defaultAgendaItem: AgendaItem = {
  title: "",
  description: "",
  presenter: "",
  duration_minutes: null,
};

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
  const [weeklyReportPreview, setWeeklyReportPreview] = useState<WeeklyReportResponse | null>(
    null,
  );

  // Agenda items for general meetings (P2)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // Fetch meeting to detect type
  const { data: meetingData } = useGetMeetingApiV1MeetingsMeetingIdGet(meetingId);
  const isGeneralMeeting = meetingData?.meeting_type === "general";

  // Update meeting mutation for agenda
  const updateMeeting = useUpdateMeetingApiV1MeetingsMeetingIdPut();

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
        onSuccess: (data) => {
          setConfluence({
            ...confluence,
            weeklyReportLoaded: true,
            weeklyReportPageId: confluencePageId,
          });
          setWeeklyReportPreview(data as WeeklyReportResponse);
        },
        onError: (error) => {
          const detail =
            (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            "주간업무록 로드에 실패했습니다";
          toast.error(detail);
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
        startTranscription.mutate({ meetingId, data: null });
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

  const extractConfluencePageId = (input: string): string => {
    const trimmed = input.trim();
    // Extract page ID from full Confluence URL (e.g., .../pages/1985282090/...)
    const match = trimmed.match(/\/pages\/(\d+)/);
    if (match) return match[1];
    // Already a plain ID
    return trimmed;
  };

  const handleLoadWeeklyReport = () => {
    if (!confluencePageId.trim()) return;
    const pageId = extractConfluencePageId(confluencePageId);
    loadWeeklyReport.mutate({
      meetingId,
      data: { confluence_page_id: pageId },
    });
  };

  const handleStartProcessing = async () => {
    if (!recording.file) {
      toast.error("녹음 파일을 업로드해주세요");
      return;
    }

    setIsUploading(true);
    setRecording({ ...recording, uploadStatus: "uploading", uploadProgress: 0 });

    // Save agenda items for general meetings (P2)
    if (isGeneralMeeting && agendaItems.length > 0) {
      const validAgendaItems = agendaItems.filter((item) => item.title.trim());
      if (validAgendaItems.length > 0) {
        try {
          await updateMeeting.mutateAsync({
            meetingId,
            data: { agenda_items: validAgendaItems },
          });
        } catch (error) {
          // Continue even if agenda save fails
          console.error("Failed to save agenda items:", error);
        }
      }
    }

    uploadRecording.mutate({
      meetingId,
      data: { file: recording.file },
    });
  };

  // Get summary of weekly report tasks for smart preview
  const getWeeklyReportSummary = (): string[] => {
    const parsedData = weeklyReportPreview?.parsed_data as unknown as ParsedWeeklyData | undefined;
    if (!parsedData?.team_members) return [];

    const summary: string[] = [];
    for (const member of parsedData.team_members.slice(0, 3)) {
      const taskCount = member.categories.reduce((acc, cat) => acc + cat.tasks.length, 0);
      if (taskCount > 0) {
        summary.push(`${member.name}: ${taskCount}개 항목`);
      }
    }
    return summary;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Weeky
          expression={confluence.weeklyReportLoaded ? "noting" : "questioning"}
          size="md"
          message={
            confluence.weeklyReportLoaded
              ? "주간업무록을 확인했어요! 녹음 파일을 업로드해주세요."
              : "회의록을 생성할 준비를 해볼까요?"
          }
        />
      </div>

      <div className="space-y-6">
        {/* Confluence Weekly Report - only for weekly_report type */}
        {!isGeneralMeeting && (
          <Card className={cn(confluence.weeklyReportLoaded && "border-primary/30 bg-primary/5")}>
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
                  placeholder="Confluence 페이지 URL 또는 ID 입력"
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

              {/* Smart Preview */}
              {confluence.weeklyReportLoaded && weeklyReportPreview && (
                <div className="mt-4 rounded-lg bg-gradient-to-br from-[oklch(0.97_0.03_175)] to-[oklch(0.95_0.05_200)] p-4">
                  <div className="flex items-start gap-3">
                    <Weeky expression="noting" size="sm" message="" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-2">
                        오늘의 안건을 확인했어요!
                      </p>
                      <ul className="space-y-1">
                        {getWeeklyReportSummary().map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 p-0 h-auto text-xs"
                        onClick={() => setWeeklyReportPreview(weeklyReportPreview)}
                      >
                        전체 내용 보기 →
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {confluence.weeklyReportLoaded && !weeklyReportPreview && (
                <p className="mt-2 text-xs text-green-600">주간업무록이 연결되었습니다</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Agenda Items - only for general meetings (P2) */}
        {isGeneralMeeting && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="h-4 w-4" />
                회의 안건 (선택)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {agendaItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  회의 안건을 추가하면 구조화된 회의록을 생성할 수 있습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  {agendaItems.map((item, index) => (
                    <div key={index} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="text"
                          placeholder="안건 제목"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = { ...item, title: e.target.value };
                            setAgendaItems(newItems);
                          }}
                          className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAgendaItems(agendaItems.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="발표자 (선택)"
                          value={item.presenter}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = { ...item, presenter: e.target.value };
                            setAgendaItems(newItems);
                          }}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          type="number"
                          placeholder="시간 (분)"
                          value={item.duration_minutes ?? ""}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = {
                              ...item,
                              duration_minutes: e.target.value ? Number(e.target.value) : null,
                            };
                            setAgendaItems(newItems);
                          }}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <textarea
                        placeholder="상세 설명 (선택)"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...agendaItems];
                          newItems[index] = { ...item, description: e.target.value };
                          setAgendaItems(newItems);
                        }}
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAgendaItems([...agendaItems, { ...defaultAgendaItem }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                안건 추가
              </Button>
            </CardContent>
          </Card>
        )}

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

      {/* Weekly Report Preview Modal */}
      <Dialog
        open={weeklyReportPreview !== null}
        onOpenChange={(open) => {
          if (!open) setWeeklyReportPreview(null);
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>주간업무록 확인</DialogTitle>
            <DialogDescription>Confluence에서 불러온 주간업무록입니다.</DialogDescription>
          </DialogHeader>
          {(weeklyReportPreview?.parsed_data as unknown as ParsedWeeklyData | undefined)?.team_members && (
            <div className="space-y-4">
              {(weeklyReportPreview!.parsed_data as unknown as ParsedWeeklyData).team_members.map(
                (member) => (
                  <div key={member.name} className="rounded-lg border p-3">
                    <h4 className="mb-2 font-semibold">{member.name}</h4>
                    {member.categories.map((cat) => (
                      <div key={cat.name} className="mb-2 ml-2">
                        <p className="text-sm font-medium text-muted-foreground">{cat.name}</p>
                        <ul className="ml-4 list-disc text-sm">
                          {cat.tasks.map((task, taskIdx) => (
                            <li key={`${cat.name}-${taskIdx}`}>
                              <span
                                className={cn(
                                  "mr-1 rounded px-1 py-0.5 text-xs font-medium",
                                  task.status === "완료" && "bg-green-100 text-green-700",
                                  task.status === "진행" && "bg-blue-100 text-blue-700",
                                  task.status === "예정" && "bg-gray-100 text-gray-600",
                                )}
                              >
                                {task.status}
                              </span>
                              {task.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setWeeklyReportPreview(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
