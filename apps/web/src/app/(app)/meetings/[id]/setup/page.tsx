"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAtom } from "jotai";
import {
  Check,
  GripVertical,
  Link as LinkIcon,
  ListTodo,
  MessageSquare,
  Plus,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { confluenceAtom } from "@/atoms/confluence";
import { recordingAtom } from "@/atoms/recording";
import { selectedMembersAtom, type TeamMember, teamMembersAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Weeky } from "@/components/weeky/weeky";
import type { WeeklyReportResponse } from "@/lib/api/__generated__/schemas/weeklyReportResponse";

interface AgendaItem {
  title: string;
  description: string;
}

interface MeetingAttendee {
  id: string;
  name: string;
  isGuest: boolean;
  order: number;
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
};

// Sortable attendee item component
function SortableAttendeeItem({
  attendee,
  onRemove,
}: {
  attendee: MeetingAttendee;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: attendee.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {attendee.order}
      </span>
      <span className="flex-1 text-sm">
        {attendee.name}
        {attendee.isGuest && <span className="ml-1 text-xs text-muted-foreground">(게스트)</span>}
      </span>
      <button
        type="button"
        onClick={() => onRemove(attendee.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function MeetingSetupPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const meetingId = params.id as string;

  const [recording, setRecording] = useAtom(recordingAtom);
  const [confluence, setConfluence] = useAtom(confluenceAtom);
  const [members, setMembers] = useAtom(teamMembersAtom);
  const [, setSelectedMembers] = useAtom(selectedMembersAtom);
  const [confluencePageId, setConfluencePageId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [weeklyReportPreview, setWeeklyReportPreview] = useState<WeeklyReportResponse | null>(null);

  // Meeting attendees (team members + guests, with order)
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [guestName, setGuestName] = useState("");

  // DnD sensors for attendee reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Agenda items for general meetings (P2)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // Context terms for session-level terminology
  const [contextTerms, setContextTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState("");

  // Context instructions for natural language directives
  const [contextInstructions, setContextInstructions] = useState("");

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

  // Sync team members from query to atoms and attendees
  useEffect(() => {
    if (teamData?.members && attendees.length === 0) {
      const mappedMembers: TeamMember[] = teamData.members.map((m) => ({
        id: m.id,
        name: m.name,
        presentationOrder: m.presentation_order,
        isActive: m.is_active,
        teamId: m.team_id,
      }));
      setMembers(mappedMembers);
      setSelectedMembers(mappedMembers.map((m) => m.id));

      // Initialize attendees from team members
      const initialAttendees: MeetingAttendee[] = mappedMembers
        .sort((a, b) => a.presentationOrder - b.presentationOrder)
        .map((m, idx) => ({
          id: m.id,
          name: m.name,
          isGuest: false,
          order: idx + 1,
        }));
      setAttendees(initialAttendees);
    }
  }, [teamData, setMembers, setSelectedMembers, attendees.length]);

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

  // Attendee management handlers
  const handleAttendeeDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = attendees.findIndex((a) => a.id === active.id);
        const newIndex = attendees.findIndex((a) => a.id === over.id);
        const reordered = arrayMove(attendees, oldIndex, newIndex).map((a, idx) => ({
          ...a,
          order: idx + 1,
        }));
        setAttendees(reordered);
        setSelectedMembers(reordered.map((a) => a.id));
      }
    },
    [attendees, setSelectedMembers],
  );

  const handleToggleAttendee = useCallback(
    (id: string) => {
      setAttendees((prev) => {
        const exists = prev.find((a) => a.id === id);
        if (exists) {
          // Remove attendee
          const filtered = prev.filter((a) => a.id !== id);
          return filtered.map((a, idx) => ({ ...a, order: idx + 1 }));
        }
        // Add team member back
        const member = members.find((m) => m.id === id);
        if (member) {
          return [
            ...prev,
            { id: member.id, name: member.name, isGuest: false, order: prev.length + 1 },
          ];
        }
        return prev;
      });
    },
    [members],
  );

  const handleAddGuest = useCallback(() => {
    const name = guestName.trim();
    if (!name) return;
    const guestId = `guest-${Date.now()}`;
    setAttendees((prev) => [...prev, { id: guestId, name, isGuest: true, order: prev.length + 1 }]);
    setGuestName("");
  }, [guestName]);

  const handleRemoveAttendee = useCallback((id: string) => {
    setAttendees((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      return filtered.map((a, idx) => ({ ...a, order: idx + 1 }));
    });
  }, []);

  // Context terms handlers
  const handleAddTerm = useCallback(() => {
    const term = termInput.trim();
    if (!term || contextTerms.includes(term)) return;
    if (contextTerms.length >= 50) {
      toast.error("최대 50개까지 추가할 수 있습니다");
      return;
    }
    setContextTerms((prev) => [...prev, term]);
    setTermInput("");
  }, [termInput, contextTerms, toast]);

  const handleRemoveTerm = useCallback((term: string) => {
    setContextTerms((prev) => prev.filter((t) => t !== term));
  }, []);

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

    // Save meeting metadata (agenda items, context terms, context instructions)
    const hasAgendaItems = isGeneralMeeting && agendaItems.some((item) => item.title.trim());
    const hasContextTerms = contextTerms.length > 0;
    const hasContextInstructions = contextInstructions.trim().length > 0;

    if (hasAgendaItems || hasContextTerms || hasContextInstructions) {
      try {
        await updateMeeting.mutateAsync({
          meetingId,
          data: {
            ...(hasAgendaItems && {
              agenda_items: agendaItems.filter((item) => item.title.trim()),
            }),
            ...(hasContextTerms && { context_terms: contextTerms }),
            ...(hasContextInstructions && { context_instructions: contextInstructions.trim() }),
          },
        });
      } catch (error) {
        // Continue even if metadata save fails
        console.error("Failed to save meeting metadata:", error);
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
                          <li
                            key={idx}
                            className="text-xs text-muted-foreground flex items-center gap-2"
                          >
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
                <div className="space-y-2">
                  {agendaItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          placeholder="안건"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = { ...item, title: e.target.value };
                            setAgendaItems(newItems);
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          type="text"
                          placeholder="설명 (선택)"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = { ...item, description: e.target.value };
                            setAgendaItems(newItems);
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setAgendaItems(agendaItems.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
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
          <CardContent className="space-y-4">
            {/* Current attendees with drag-and-drop reordering */}
            {attendees.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2">발표 순서 (드래그하여 변경)</p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleAttendeeDragEnd}
                >
                  <SortableContext
                    items={attendees.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {attendees.map((attendee) => (
                        <SortableAttendeeItem
                          key={attendee.id}
                          attendee={attendee}
                          onRemove={handleRemoveAttendee}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Team members toggle */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">팀원 추가/제거</p>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const isAttending = attendees.some((a) => a.id === member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleAttendee(member.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        isAttending
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add guest */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">게스트 추가</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="게스트 이름"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGuest()}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddGuest}
                  disabled={!guestName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4" />
              세션 용어 (선택)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              이번 회의에서 자주 사용될 용어나 키워드를 추가하면 STT 정확도와 회의록 품질이
              향상됩니다.
            </p>

            {/* Current terms */}
            {contextTerms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contextTerms.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm"
                  >
                    {term}
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(term)}
                      className="ml-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add term input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="용어 입력 (예: Phoenix, Sprint 15)"
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTerm()}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddTerm}
                disabled={!termInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Context Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              특별 지시사항 (선택)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              이번 회의록 생성에 특별히 적용할 지시사항을 자연어로 입력하세요.
            </p>
            <textarea
              placeholder="예: 'OOO 이름이 나오는 얘기는 다 빼줘', '기술 용어는 영문으로 표기해줘'"
              value={contextInstructions}
              onChange={(e) => setContextInstructions(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">
              {contextInstructions.length}/1000
            </p>
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
          {(weeklyReportPreview?.parsed_data as unknown as ParsedWeeklyData | undefined)
            ?.team_members && (
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
