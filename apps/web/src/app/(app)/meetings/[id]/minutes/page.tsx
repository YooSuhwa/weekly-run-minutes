"use client";

import { useAtom } from "jotai";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { confluenceAtom } from "@/atoms/confluence";
import { type CorrectionItem, minutesAtom } from "@/atoms/minutes";
import { CelebrationModal } from "@/components/meeting/celebration-modal";
import { TrashPanel } from "@/components/meeting/trash-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Weeky } from "@/components/weeky/weeky";
import {
  useGetMeetingApiV1MeetingsMeetingIdGet,
  useUpdateMeetingApiV1MeetingsMeetingIdPut,
} from "@/lib/api/__generated__/meetings/meetings";
import {
  useGetMeetingMinutesApiV1MinutesMeetingsMeetingIdMinutesGet,
  usePublishMinutesToConfluenceApiV1MinutesMeetingsMeetingIdPublishPost,
  useStartMinutesGenerationApiV1MinutesMeetingsMeetingIdGenerateMinutesPost,
  useUpdateMeetingMinutesApiV1MinutesMeetingsMeetingIdMinutesPut,
} from "@/lib/api/__generated__/minutes/minutes";
import {
  useGetTeamApiV1TeamsTeamIdGet,
  useListTeamsApiV1TeamsGet,
} from "@/lib/api/__generated__/teams/teams";
import { CorrectionPanel } from "./correction-panel";
import { RegenerateModal, type RegenerateSettings } from "./regenerate-modal";

// Generate Confluence URL from page ID
const CONFLUENCE_BASE_URL = "https://hancom.atlassian.net/wiki/spaces/ProductTech/pages";

function getConfluenceUrl(pageId: string | undefined | null): string | undefined {
  if (!pageId) return undefined;
  return `${CONFLUENCE_BASE_URL}/${pageId}`;
}

const MinutesEditor = dynamic(
  () => import("./minutes-editor").then((m) => ({ default: m.MinutesEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-border bg-card min-h-[500px] flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse">
          <div className="h-20 w-20 rounded-full bg-primary/10" />
        </div>
        <p className="text-sm text-muted-foreground">에디터를 준비하고 있어요...</p>
      </div>
    ),
  },
);

export default function MinutesPage() {
  const params = useParams();
  const toast = useToast();
  const meetingId = params.id as string;
  const [minutes, setMinutes] = useAtom(minutesAtom);
  const [_confluence, setConfluence] = useAtom(confluenceAtom);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeCorrectionIndex, setActiveCorrectionIndex] = useState<number | null>(null);
  // Edit mode for published minutes
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateMutateRef = useRef<typeof updateMinutes.mutate>(null);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Regenerate state
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Fetch meeting data to check publish status
  const { data: meetingData, refetch: refetchMeeting } =
    useGetMeetingApiV1MeetingsMeetingIdGet(meetingId);

  // Fetch teams list and team members for regenerate modal
  const { data: teams } = useListTeamsApiV1TeamsGet();
  const firstTeamId = teams?.[0]?.id ?? "";
  const { data: teamData } = useGetTeamApiV1TeamsTeamIdGet(firstTeamId, {
    query: { enabled: !!firstTeamId },
  });
  const teamMembers = teamData?.members?.map((m) => ({ id: m.id, name: m.name })) ?? [];

  // Check if meeting is published (read-only mode)
  const isPublished = Boolean(meetingData?.confluence_page_id);

  // Fetch minutes via generated hook
  const { data: minutesData, error: minutesError } =
    useGetMeetingMinutesApiV1MinutesMeetingsMeetingIdMinutesGet(meetingId);

  // Sync fetched data to atom
  useEffect(() => {
    if (minutesData) {
      setMinutes((prev) => ({
        ...prev,
        content: minutesData.edited_content || minutesData.content_markdown,
        corrections: (minutesData.corrections ?? []).map((c) => ({
          original: c.original,
          corrected: c.corrected,
          category: c.category as CorrectionItem["category"],
          paragraphIndex: c.paragraph_index ?? null,
          startOffset: c.start_offset ?? null,
          endOffset: c.end_offset ?? null,
        })),
        confluenceSynced: minutesData.confluence_synced,
      }));
    } else if (minutesError) {
      // Demo content on error
      setMinutes((prev) => ({
        ...prev,
        content: getDemoContent(),
        corrections: getDemoCorrections(),
      }));
    }
  }, [minutesData, minutesError, setMinutes]);

  // Sync confluence status from meeting data (4번: 게시 상태 동기화)
  useEffect(() => {
    if (meetingData?.confluence_page_id) {
      setConfluence((prev) => ({
        ...prev,
        publishStatus: "uploaded",
        publishedPage: {
          id: meetingData.confluence_page_id as string,
          title: "",
          url: meetingData.confluence_page_url as string,
        },
      }));
    }
  }, [meetingData, setConfluence]);

  // Update minutes mutation
  const updateMinutes = useUpdateMeetingMinutesApiV1MinutesMeetingsMeetingIdMinutesPut({
    mutation: {
      onSuccess: () => {
        setMinutes((prev) => ({
          ...prev,
          saveStatus: "saved",
          lastSavedAt: new Date().toISOString(),
          // Mark as out of sync when content is saved after publish
          confluenceSynced: isPublished ? false : prev.confluenceSynced,
        }));
      },
      onError: () => {
        setMinutes((prev) => ({ ...prev, saveStatus: "error" }));
      },
    },
  });

  updateMutateRef.current = updateMinutes.mutate;

  // Update meeting mutation (for title)
  const updateMeeting = useUpdateMeetingApiV1MeetingsMeetingIdPut({
    mutation: {
      onSuccess: () => {
        refetchMeeting();
        setIsEditingTitle(false);
        toast.success("제목이 저장되었습니다");
      },
      onError: () => {
        toast.error("제목 저장에 실패했습니다");
      },
    },
  });

  // Regenerate minutes mutation
  const regenerateMinutes =
    useStartMinutesGenerationApiV1MinutesMeetingsMeetingIdGenerateMinutesPost({
      mutation: {
        onSuccess: () => {
          toast.success("회의록 재생성을 시작했습니다.");
          setShowRegenerateModal(false);
          // Redirect to processing page to show progress
          window.location.href = `/meetings/${meetingId}/processing`;
        },
        onError: (error) => {
          const errorDetail = (error as { detail?: string })?.detail || "재생성 실패";
          toast.error(errorDetail);
        },
        onSettled: () => {
          setIsRegenerating(false);
        },
      },
    });

  // Handle regenerate with updated settings
  const handleRegenerateWithSettings = useCallback(
    async (settings: RegenerateSettings) => {
      setIsRegenerating(true);

      // First, update meeting with new settings
      try {
        await updateMeeting.mutateAsync({
          meetingId,
          data: {
            attendees: settings.attendees,
            context_terms: settings.contextTerms.length > 0 ? settings.contextTerms : undefined,
            context_instructions: settings.contextInstructions || undefined,
          },
        });
      } catch (error) {
        console.error("Failed to update meeting settings:", error);
        toast.error("설정 저장에 실패했습니다");
        setIsRegenerating(false);
        return;
      }

      // Then trigger regeneration
      regenerateMinutes.mutate({
        meetingId,
        params: { regenerate: true },
      });
    },
    [meetingId, updateMeeting, regenerateMinutes, toast],
  );

  // Publish mutation
  const publishMinutes = usePublishMinutesToConfluenceApiV1MinutesMeetingsMeetingIdPublishPost({
    mutation: {
      onSuccess: (data) => {
        setConfluence((prev) => ({
          ...prev,
          publishStatus: "uploaded",
          publishedPage: {
            id: data.confluence_page_id,
            title: "",
            url: data.confluence_page_url,
          },
        }));
        // Mark as synced with Confluence
        setMinutes((prev) => ({ ...prev, confluenceSynced: true }));
        // 4번: 게시 후 meeting 데이터 refetch하여 상태 동기화
        refetchMeeting();
        // Show celebration modal
        setShowCelebration(true);
      },
      onError: (error) => {
        const errorDetail = (error as { detail?: string })?.detail || "게시 실패";
        setConfluence((prev) => ({
          ...prev,
          publishStatus: "error",
          errorMessage: errorDetail,
        }));
        toast.error(errorDetail);
      },
      onSettled: () => {
        setIsPublishing(false);
      },
    },
  });

  // Auto-save every 30 seconds
  // Disabled for published minutes (requires explicit save via edit mode)
  useEffect(() => {
    if (!minutes.isEdited) return;
    // Skip auto-save for published minutes - they need explicit save
    if (isPublished) return;

    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);

    autoSaveRef.current = setTimeout(() => {
      updateMutateRef.current?.({
        meetingId,
        data: { content_markdown: minutes.content },
      });
    }, 30000);

    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [minutes.content, minutes.isEdited, meetingId, isPublished]);

  const handleSaveDraft = useCallback(() => {
    setMinutes((prev) => ({ ...prev, saveStatus: "saving" }));
    updateMutateRef.current?.({
      meetingId,
      data: { content_markdown: minutes.content },
    });
    toast.success("저장되었습니다");
  }, [meetingId, minutes.content, setMinutes, toast]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([minutes.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-minutes-${meetingId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("다운로드 완료");
  }, [meetingId, minutes.content, toast]);

  const handlePublish = useCallback(() => {
    setIsPublishing(true);
    setConfluence((prev) => ({ ...prev, publishStatus: "uploading" }));
    publishMinutes.mutate({ meetingId });
  }, [meetingId, publishMinutes, setConfluence]);

  const handleContentChange = useCallback(
    (content: string) => {
      setMinutes((prev) => ({ ...prev, content, isEdited: true, saveStatus: "idle" }));
    },
    [setMinutes],
  );

  const correctionsRef = useRef(minutes.corrections);
  correctionsRef.current = minutes.corrections;

  const handleCorrectionClick = useCallback((correction: CorrectionItem) => {
    const index = correctionsRef.current.indexOf(correction);
    setActiveCorrectionIndex(index >= 0 ? index : null);
  }, []);

  // Enter edit mode for published minutes
  const handleStartEdit = useCallback(() => {
    setOriginalContent(minutes.content);
    setIsEditMode(true);
  }, [minutes.content]);

  // Request to finish editing - show confirmation dialog
  const handleFinishEditRequest = useCallback(() => {
    setShowSaveConfirm(true);
  }, []);

  // Confirm save and exit edit mode
  const handleConfirmSave = useCallback(() => {
    setMinutes((prev) => ({ ...prev, saveStatus: "saving" }));
    updateMutateRef.current?.({
      meetingId,
      data: { content_markdown: minutes.content },
    });
    setIsEditMode(false);
    setShowSaveConfirm(false);
    toast.success("저장되었습니다");
  }, [meetingId, minutes.content, setMinutes, toast]);

  // Cancel edit and rollback to original content
  const handleCancelEdit = useCallback(() => {
    setMinutes((prev) => ({
      ...prev,
      content: originalContent,
      isEdited: false,
      saveStatus: "idle",
    }));
    setIsEditMode(false);
    setShowSaveConfirm(false);
    toast.info("수정이 취소되었습니다");
  }, [originalContent, setMinutes, toast]);

  // Title editing handlers
  const handleStartEditTitle = useCallback(() => {
    setEditedTitle(meetingData?.title || "");
    setIsEditingTitle(true);
    // Focus on next tick after input is rendered
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [meetingData?.title]);

  const handleSaveTitle = useCallback(() => {
    if (!editedTitle.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    updateMeeting.mutate({
      meetingId,
      data: { title: editedTitle.trim() },
    });
  }, [editedTitle, meetingId, toast, updateMeeting]);

  const handleCancelEditTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditedTitle("");
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveTitle();
      } else if (e.key === "Escape") {
        handleCancelEditTitle();
      }
    },
    [handleSaveTitle, handleCancelEditTitle],
  );

  // Format date for display
  const formatDisplayDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear() % 100}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <>
      {/* Save confirmation dialog for published minutes */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수정 내용을 저장하시겠습니까?</DialogTitle>
            <DialogDescription>
              저장하면 Confluence와 동기화가 해제됩니다. 재게시하면 변경 사항이 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              취소 (되돌리기)
            </Button>
            <Button onClick={handleConfirmSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate settings modal */}
      <RegenerateModal
        open={showRegenerateModal}
        onOpenChange={setShowRegenerateModal}
        onConfirm={handleRegenerateWithSettings}
        isLoading={isRegenerating}
        initialAttendees={meetingData?.attendees ?? []}
        initialContextTerms={meetingData?.context_terms ?? []}
        initialContextInstructions={meetingData?.context_instructions ?? ""}
        teamMembers={teamMembers}
      />

      <CelebrationModal
        isOpen={showCelebration}
        confluenceUrl={getConfluenceUrl(meetingData?.confluence_page_id)}
        onClose={() => setShowCelebration(false)}
      />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Weeky expression="done" size="sm" />
            <div>
              <h1 className="text-xl font-bold">회의록 첨삭</h1>
              <p className="text-xs text-muted-foreground">
                {minutes.saveStatus === "saved"
                  ? `마지막 저장: ${minutes.lastSavedAt ? new Date(minutes.lastSavedAt).toLocaleTimeString("ko-KR") : ""}`
                  : minutes.saveStatus === "saving"
                    ? "저장 중..."
                    : "수정됨 (미저장)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync status badge - only show when not synced */}
            {isPublished && !isEditMode && !minutes.confluenceSynced && (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                재게시 필요
              </span>
            )}
            {/* Edit mode indicator */}
            {isPublished && isEditMode && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Pencil className="h-3.5 w-3.5" />
                수정 중
              </span>
            )}

            {/* Buttons for unpublished minutes */}
            {!isPublished && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenerateModal(true)}
                  disabled={isRegenerating}
                >
                  <RefreshCw className="h-4 w-4" />
                  재생성
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                  <FileText className="h-4 w-4" />
                  저장
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  MD 다운로드
                </Button>
                <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                  {isPublishing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Confluence 게시
                </Button>
              </>
            )}

            {/* Buttons for published minutes */}
            {isPublished && !isEditMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4" />
                  수정하기
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  MD 다운로드
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(getConfluenceUrl(meetingData?.confluence_page_id), "_blank")
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  Confluence
                </Button>
                {!minutes.confluenceSynced && (
                  <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    재게시
                  </Button>
                )}
              </>
            )}

            {/* Buttons for edit mode */}
            {isPublished && isEditMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4" />
                  취소
                </Button>
                <Button size="sm" onClick={handleFinishEditRequest}>
                  <Check className="h-4 w-4" />
                  수정완료
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Meeting info section with editable title */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    placeholder="회의 제목을 입력하세요"
                    className="text-lg font-semibold h-9"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveTitle}
                    disabled={updateMeeting.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEditTitle}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">
                    {meetingData?.title || "회의 제목"}
                  </h2>
                  <button
                    type="button"
                    onClick={handleStartEditTitle}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                    title="제목 수정"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {meetingData?.meeting_date && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDisplayDate(meetingData.meeting_date)}
                  </span>
                )}
                {meetingData?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {meetingData.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MinutesEditor
              content={minutes.content}
              onChange={handleContentChange}
              corrections={minutes.corrections}
              activeCorrectionIndex={activeCorrectionIndex}
              readOnly={isPublished && !isEditMode}
            />
            {isPublished && !isEditMode && minutes.confluenceSynced && (
              <p className="mt-3 text-xs text-muted-foreground text-center">
                수정하려면 상단의 수정하기 버튼을 눌러주세요
              </p>
            )}
          </div>
          <div className="space-y-6">
            <CorrectionPanel
              corrections={minutes.corrections}
              onCorrectionClick={handleCorrectionClick}
            />
            <TrashPanel meetingId={meetingId} />
          </div>
        </div>
      </div>
    </>
  );
}

function getDemoContent(): string {
  return `# 2025-01-23 주간회의 회의록

## 참석자
이상윤, 선설희, 최보연, 유수화, 김정연

## 이상윤
### AI
- [진행] GPT 프롬프트 최적화 - 응답 품질 개선
  - 1/20: 프롬프트 v2 작성 완료
  - 1/22: 테스트 결과 정확도 15% 향상

### SDK
- [완료] SDK v2.1 릴리즈 (1/21)

## 선설희
### HWP
- [진행] HWP 파서 성능 개선
  - 대용량 파일 처리 시간 50% 단축 목표

## 회의 결론
- AI 프롬프트 v2 정식 반영 예정 (이상윤)
- HWP 파서 성능 테스트 결과 공유 예정 (선설희)

## Action Items
- [ ] 프롬프트 v2 프로덕션 반영 (이상윤, 1/27)
- [ ] 성능 테스트 보고서 작성 (선설희, 1/24)
`;
}

function getDemoCorrections(): CorrectionItem[] {
  return [
    {
      original: "GPT",
      corrected: "GPT-4o",
      category: "terminology",
      paragraphIndex: null,
      startOffset: null,
      endOffset: null,
    },
    {
      original: "SDK v2.1",
      corrected: "WeeklyRun SDK v2.1",
      category: "terminology",
      paragraphIndex: null,
      startOffset: null,
      endOffset: null,
    },
    {
      original: "대용량 파일",
      corrected: "대용량 HWP 파일 (50MB+)",
      category: "formatting",
      paragraphIndex: null,
      startOffset: null,
      endOffset: null,
    },
  ];
}
