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
  FileText,
  GripVertical,
  Link as LinkIcon,
  ListTodo,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { confluenceAtom } from "@/atoms/confluence";
import { recordingAtom } from "@/atoms/recording";
import { selectedMembersAtom, type TeamMember, teamMembersAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import { Weeky } from "@/components/weeky/weeky";
import type { WeeklyReportResponse } from "@/lib/api/__generated__/schemas/weeklyReportResponse";

interface AgendaItem {
  id: string;
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
import {
  useImportTranscriptApiV1TranscriptionMeetingsMeetingIdImportTranscriptPost,
  useStartTranscriptionApiV1TranscriptionMeetingsMeetingIdTranscribePost,
} from "@/lib/api/__generated__/transcription/transcription";
import { useLoadWeeklyReportForMeetingApiV1WeeklyReportsMeetingsMeetingIdWeeklyReportPost } from "@/lib/api/__generated__/weekly-reports/weekly-reports";
import { cn } from "@/lib/utils";

const createAgendaItem = (): AgendaItem => ({
  id: `agenda-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  title: "",
  description: "",
});

// Sortable attendee item component
function SortableAttendeeItem({
  attendee,
  onRemove,
  showOrder = true,
}: {
  attendee: MeetingAttendee;
  onRemove: (id: string) => void;
  showOrder?: boolean;
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
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-all duration-200",
        isDragging && "scale-[1.02] border-primary/50 opacity-80 shadow-lg",
        !isDragging && "hover:border-border/80 hover:bg-accent/30",
      )}
    >
      {showOrder && (
        <button
          type="button"
          aria-label={`${attendee.name} 순서 변경`}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {showOrder && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {attendee.order}
        </span>
      )}
      <span className="flex-1 text-sm font-medium">
        {attendee.name}
        {attendee.isGuest && (
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            게스트
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => onRemove(attendee.id)}
        aria-label={`${attendee.name} 제거`}
        className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

  // Generate unique IDs for form accessibility
  const confluenceInputId = useId();
  const guestInputId = useId();
  const termInputId = useId();
  const instructionsInputId = useId();

  const [recording, setRecording] = useAtom(recordingAtom);
  const [confluence, setConfluence] = useAtom(confluenceAtom);
  const [members, setMembers] = useAtom(teamMembersAtom);
  const [, setSelectedMembers] = useAtom(selectedMembersAtom);
  const [confluencePageId, setConfluencePageId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [weeklyReportPreview, setWeeklyReportPreview] = useState<WeeklyReportResponse | null>(null);

  // Upload input type toggle: audio recording or script text
  type UploadInputType = "audio" | "script";
  const [uploadInputType, setUploadInputType] = useState<UploadInputType>("audio");
  const [scriptFile, setScriptFile] = useState<File | null>(null);

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

  // Import transcript mutation (for script text files)
  const importTranscript =
    useImportTranscriptApiV1TranscriptionMeetingsMeetingIdImportTranscriptPost({
      mutation: {
        onSuccess: () => {
          router.push(`/meetings/${meetingId}/processing`);
        },
        onError: () => {
          router.push(`/meetings/${meetingId}/processing`);
        },
        onSettled: () => {
          setIsUploading(false);
        },
      },
    });

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
    const isScriptMode = uploadInputType === "script";
    const currentFile = isScriptMode ? scriptFile : recording.file;

    if (!currentFile) {
      toast.error(isScriptMode ? "스크립트 파일을 업로드해주세요" : "녹음 파일을 업로드해주세요");
      return;
    }

    setIsUploading(true);
    if (!isScriptMode) {
      setRecording({ ...recording, uploadStatus: "uploading", uploadProgress: 0 });
    }

    // Save meeting metadata (attendees, agenda items, context terms, context instructions)
    const hasAgendaItems = isGeneralMeeting && agendaItems.some((item) => item.title.trim());
    const hasContextTerms = contextTerms.length > 0;
    const hasContextInstructions = contextInstructions.trim().length > 0;
    // Always save attendees if they exist (to track selected participants)
    const attendeeNames = attendees.map((a) => a.name);

    // Always update meeting to save attendees and other metadata
    try {
      await updateMeeting.mutateAsync({
        meetingId,
        data: {
          // Always include attendees (selected participants)
          attendees: attendeeNames,
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

    if (isScriptMode) {
      // Script mode: import transcript directly (skip STT)
      importTranscript.mutate({
        meetingId,
        data: { file: currentFile },
      });
    } else {
      // Audio mode: upload recording then start transcription
      uploadRecording.mutate({
        meetingId,
        data: { file: currentFile },
      });
    }
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      {/* Header with Weeky */}
      <header className="mb-8">
        <div className="flex items-start gap-4 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent p-4 sm:p-6">
          <Weeky
            expression={
              (uploadInputType === "script" ? scriptFile : recording.file)
                ? "celebrating"
                : confluence.weeklyReportLoaded
                  ? "noting"
                  : "questioning"
            }
            size="md"
            message={
              (uploadInputType === "script" ? scriptFile : recording.file)
                ? uploadInputType === "script"
                  ? "스크립트가 준비됐어요! 이제 회의록을 생성해볼까요?"
                  : "준비가 다 됐어요! 이제 회의록을 생성해볼까요?"
                : confluence.weeklyReportLoaded
                  ? "주간업무록을 확인했어요! 파일을 업로드해주세요."
                  : "회의록을 생성할 준비를 해볼까요?"
            }
          />
        </div>
      </header>

      {/* Form Sections */}
      <div className="space-y-5">
        {/* Confluence Weekly Report - only for weekly_report type */}
        {!isGeneralMeeting && (
          <Card
            className={cn(
              "transition-all duration-300",
              confluence.weeklyReportLoaded && "border-primary/40 bg-primary/5 shadow-sm",
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    confluence.weeklyReportLoaded ? "bg-primary/20" : "bg-muted",
                  )}
                >
                  <LinkIcon
                    className={cn(
                      "h-4 w-4",
                      confluence.weeklyReportLoaded ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </div>
                주간업무록
                <span className="text-xs font-normal text-muted-foreground">(선택)</span>
              </CardTitle>
              <CardDescription>
                Confluence에서 주간업무록을 불러와 회의록 생성에 참조합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={confluenceInputId} className="sr-only">
                  Confluence 페이지 URL 또는 ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={confluenceInputId}
                    type="url"
                    placeholder="Confluence 페이지 URL 또는 ID 입력"
                    value={confluencePageId}
                    onChange={(e) => setConfluencePageId(e.target.value)}
                    disabled={confluence.weeklyReportLoaded}
                    className="flex-1"
                  />
                  <Button
                    variant={confluence.weeklyReportLoaded ? "secondary" : "outline"}
                    onClick={handleLoadWeeklyReport}
                    disabled={
                      !confluencePageId.trim() ||
                      confluence.weeklyReportLoaded ||
                      loadWeeklyReport.isPending
                    }
                    className="cursor-pointer min-w-[100px]"
                  >
                    {confluence.weeklyReportLoaded ? (
                      <>
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-primary">연결됨</span>
                      </>
                    ) : loadWeeklyReport.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>로딩 중</span>
                      </>
                    ) : (
                      "불러오기"
                    )}
                  </Button>
                </div>
              </div>

              {/* Smart Preview */}
              {confluence.weeklyReportLoaded && weeklyReportPreview && (
                <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <Weeky expression="noting" size="sm" message="" />
                    <div className="flex-1">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        오늘의 안건을 확인했어요!
                      </p>
                      <ul className="space-y-1.5" aria-label="주간업무록 요약">
                        {getWeeklyReportSummary().map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-3 h-auto cursor-pointer p-0 text-xs font-medium"
                        onClick={() => setWeeklyReportPreview(weeklyReportPreview)}
                      >
                        전체 내용 보기 →
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {confluence.weeklyReportLoaded && !weeklyReportPreview && (
                <output
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-center gap-2 text-sm text-primary"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  주간업무록이 연결되었습니다
                </output>
              )}
            </CardContent>
          </Card>
        )}

        {/* Agenda Items - only for general meetings (P2) */}
        {isGeneralMeeting && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                </div>
                회의 안건
                <span className="text-xs font-normal text-muted-foreground">(선택)</span>
              </CardTitle>
              <CardDescription>
                회의 안건을 추가하면 구조화된 회의록을 생성할 수 있습니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agendaItems.length > 0 && (
                <ul className="space-y-3" aria-label="회의 안건 목록">
                  {agendaItems.map((item, index) => (
                    <li
                      key={item.id}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/80"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <Input
                          type="text"
                          placeholder="안건 제목"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = { ...item, title: e.target.value };
                            setAgendaItems(newItems);
                          }}
                          className="h-9"
                          aria-label={`안건 ${index + 1} 제목`}
                        />
                        <Input
                          type="text"
                          placeholder="설명 (선택)"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...agendaItems];
                            newItems[index] = { ...item, description: e.target.value };
                            setAgendaItems(newItems);
                          }}
                          className="h-8 text-xs"
                          aria-label={`안건 ${index + 1} 설명`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => setAgendaItems(agendaItems.filter((a) => a.id !== item.id))}
                        aria-label={`안건 ${index + 1} 삭제`}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAgendaItems([...agendaItems, createAgendaItem()])}
                className="cursor-pointer"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                안건 추가
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Attendees */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              참석자
              {attendees.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {attendees.length}명
                </span>
              )}
            </CardTitle>
            <CardDescription>회의에 참석하는 팀원과 게스트를 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Current attendees with drag-and-drop reordering (weekly) or simple list (general) */}
            {attendees.length > 0 && (
              <div className="space-y-2">
                {!isGeneralMeeting && (
                  <Label className="text-xs text-muted-foreground">
                    발표 순서 (드래그하여 변경)
                  </Label>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleAttendeeDragEnd}
                >
                  <SortableContext
                    items={attendees.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {attendees.map((attendee) => (
                        <SortableAttendeeItem
                          key={attendee.id}
                          attendee={attendee}
                          onRemove={handleRemoveAttendee}
                          showOrder={!isGeneralMeeting}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Team members toggle */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">팀원 추가/제거</Label>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const isAttending = attendees.some((a) => a.id === member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleAttendee(member.id)}
                      aria-pressed={isAttending}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isAttending
                          ? "border-primary bg-primary/10 text-foreground shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent/50",
                      )}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add guest */}
            <div className="space-y-2">
              <Label htmlFor={guestInputId} className="text-xs text-muted-foreground">
                게스트 추가
              </Label>
              <div className="flex gap-2">
                <Input
                  id={guestInputId}
                  type="text"
                  placeholder="게스트 이름"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGuest()}
                  className="h-9 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddGuest}
                  disabled={!guestName.trim()}
                  className="h-9 cursor-pointer px-3"
                  aria-label="게스트 추가"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context Terms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Tag className="h-4 w-4 text-muted-foreground" />
              </div>
              세션 용어
              <span className="text-xs font-normal text-muted-foreground">(선택)</span>
              {contextTerms.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {contextTerms.length}/50
                </span>
              )}
            </CardTitle>
            <CardDescription>
              이번 회의에서 자주 사용될 용어나 키워드를 추가하면 STT 정확도와 회의록 품질이
              향상됩니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current terms */}
            {contextTerms.length > 0 && (
              <ul
                className="flex flex-wrap gap-2"
                aria-label={`등록된 용어 ${contextTerms.length}개`}
              >
                {contextTerms.map((term) => (
                  <li
                    key={term}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10"
                  >
                    {term}
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(term)}
                      aria-label={`${term} 삭제`}
                      className="cursor-pointer rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add term input */}
            <div className="space-y-2">
              <Label htmlFor={termInputId} className="sr-only">
                용어 입력
              </Label>
              <div className="flex gap-2">
                <Input
                  id={termInputId}
                  type="text"
                  placeholder="용어 입력 (예: Phoenix, Sprint 15)"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTerm()}
                  className="h-9 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTerm}
                  disabled={!termInput.trim() || contextTerms.length >= 50}
                  className="h-9 cursor-pointer px-3"
                  aria-label="용어 추가"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              특별 지시사항
              <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </CardTitle>
            <CardDescription>
              이번 회의록 생성에 특별히 적용할 지시사항을 자연어로 입력하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={instructionsInputId} className="sr-only">
                특별 지시사항
              </Label>
              <textarea
                id={instructionsInputId}
                placeholder="예: 'OOO 이름이 나오는 얘기는 다 빼줘', '기술 용어는 영문으로 표기해줘'"
                value={contextInstructions}
                onChange={(e) => setContextInstructions(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                회의록 생성 시 AI가 이 지시사항을 참고합니다
              </p>
              <p
                className={cn(
                  "text-xs tabular-nums",
                  contextInstructions.length > 900 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {contextInstructions.length}/1000
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card
          className={cn(
            "transition-all duration-300",
            (uploadInputType === "script" ? scriptFile : recording.file) &&
              "border-primary/40 bg-primary/5 shadow-sm",
          )}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  (uploadInputType === "script" ? scriptFile : recording.file)
                    ? "bg-primary/20"
                    : "bg-muted",
                )}
              >
                {uploadInputType === "script" ? (
                  <FileText
                    className={cn("h-4 w-4", scriptFile ? "text-primary" : "text-muted-foreground")}
                  />
                ) : (
                  <Mic
                    className={cn(
                      "h-4 w-4",
                      recording.file ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                )}
              </div>
              {uploadInputType === "script" ? "스크립트 텍스트" : "녹음 파일"}
              {(uploadInputType === "script" ? scriptFile : recording.file) && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  준비됨
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {uploadInputType === "script"
                ? "STT가 완료된 스크립트 텍스트 파일을 업로드해주세요 (txt / 최대 5MB)"
                : "회의 녹음 파일을 업로드해주세요 (mp3, wav, webm, m4a / 최대 100MB)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input type toggle */}
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={uploadInputType === "audio"}
                onClick={() => {
                  if (uploadInputType !== "audio") {
                    setUploadInputType("audio");
                    setScriptFile(null);
                  }
                }}
                disabled={isUploading}
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  uploadInputType === "audio"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  isUploading && "cursor-not-allowed opacity-50",
                )}
              >
                <Mic className="h-4 w-4" />
                녹음 파일
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={uploadInputType === "script"}
                onClick={() => {
                  if (uploadInputType !== "script") {
                    setUploadInputType("script");
                    setRecording({ ...recording, file: null, uploadStatus: "idle" });
                  }
                }}
                disabled={isUploading}
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  uploadInputType === "script"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  isUploading && "cursor-not-allowed opacity-50",
                )}
              >
                <FileText className="h-4 w-4" />
                스크립트 텍스트
              </button>
            </div>

            {uploadInputType === "script" ? (
              <FileUpload
                file={scriptFile}
                onFileSelect={setScriptFile}
                onFileRemove={() => setScriptFile(null)}
                disabled={isUploading}
                mode="text"
              />
            ) : (
              <FileUpload
                file={recording.file}
                onFileSelect={handleFileSelect}
                onFileRemove={handleFileRemove}
                disabled={isUploading}
              />
            )}
            {recording.uploadStatus === "uploading" && uploadInputType === "audio" && (
              <ProgressBar value={recording.uploadProgress} label="업로드 중" className="mt-4" />
            )}
          </CardContent>
        </Card>

        {/* Start Button */}
        <div className="flex flex-col items-end gap-3 pt-2">
          {!(uploadInputType === "script" ? scriptFile : recording.file) && (
            <p className="text-sm text-muted-foreground">
              {uploadInputType === "script"
                ? "스크립트 파일을 업로드하면 시작할 수 있어요"
                : "녹음 파일을 업로드하면 시작할 수 있어요"}
            </p>
          )}
          <Button
            size="lg"
            onClick={handleStartProcessing}
            disabled={!(uploadInputType === "script" ? scriptFile : recording.file) || isUploading}
            className={cn(
              "cursor-pointer px-8 transition-all duration-200",
              (uploadInputType === "script" ? scriptFile : recording.file) &&
                !isUploading &&
                "shadow-lg shadow-primary/25 hover:shadow-primary/40",
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadInputType === "script" ? "처리 중..." : "업로드 중..."}
              </>
            ) : (
              "회의록 생성 시작"
            )}
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
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              주간업무록 확인
            </DialogTitle>
            <DialogDescription>Confluence에서 불러온 주간업무록입니다.</DialogDescription>
          </DialogHeader>
          {(weeklyReportPreview?.parsed_data as unknown as ParsedWeeklyData | undefined)
            ?.team_members && (
            <div className="space-y-4">
              {(weeklyReportPreview!.parsed_data as unknown as ParsedWeeklyData).team_members.map(
                (member) => (
                  <div
                    key={member.name}
                    className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/30"
                  >
                    <h4 className="mb-3 flex items-center gap-2 font-semibold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">
                        {member.name.charAt(0)}
                      </span>
                      {member.name}
                    </h4>
                    {member.categories.map((cat) => (
                      <div key={cat.name} className="mb-3 ml-2 last:mb-0">
                        <p className="mb-1.5 text-sm font-medium text-muted-foreground">
                          {cat.name}
                        </p>
                        <ul className="space-y-1.5 text-sm">
                          {cat.tasks.map((task, taskIdx) => (
                            <li
                              key={`${cat.name}-${taskIdx}`}
                              className="flex items-start gap-2 pl-2"
                            >
                              <span
                                className={cn(
                                  "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                                  task.status === "완료" && "bg-green-100 text-green-700",
                                  task.status === "진행" && "bg-blue-100 text-blue-700",
                                  task.status === "예정" && "bg-gray-100 text-gray-600",
                                )}
                              >
                                {task.status}
                              </span>
                              <span className="leading-relaxed">{task.title}</span>
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
          <DialogFooter className="mt-4">
            <Button onClick={() => setWeeklyReportPreview(null)} className="cursor-pointer">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
