"use client";

import { useAtom } from "jotai";
import { Download, FileText, Send } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { confluenceAtom } from "@/atoms/confluence";
import { type CorrectionItem, minutesAtom } from "@/atoms/minutes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Weeky } from "@/components/weeky/weeky";
import {
  useGetMeetingMinutesApiV1MinutesMeetingsMeetingIdMinutesGet,
  usePublishMinutesToConfluenceApiV1MinutesMeetingsMeetingIdPublishPost,
  useUpdateMeetingMinutesApiV1MinutesMeetingsMeetingIdMinutesPut,
} from "@/lib/api/__generated__/minutes/minutes";
import { useGetMeetingApiV1MeetingsMeetingIdGet } from "@/lib/api/__generated__/meetings/meetings";
import { CelebrationModal } from "@/components/meeting/celebration-modal";
import { TrashPanel } from "@/components/meeting/trash-panel";
import dynamic from "next/dynamic";
import { CorrectionPanel } from "./correction-panel";

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
  const [confluence, setConfluence] = useAtom(confluenceAtom);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeCorrectionIndex, setActiveCorrectionIndex] = useState<number | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateMutateRef = useRef<typeof updateMinutes.mutate>(null);

  // Fetch meeting data to check publish status
  const { data: meetingData, refetch: refetchMeeting } =
    useGetMeetingApiV1MeetingsMeetingIdGet(meetingId);

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
        }));
      },
      onError: () => {
        setMinutes((prev) => ({ ...prev, saveStatus: "error" }));
      },
    },
  });

  updateMutateRef.current = updateMinutes.mutate;

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

  // Auto-save every 30 seconds (6번: 게시 완료 시 자동 저장 비활성화)
  useEffect(() => {
    if (!minutes.isEdited || isPublished) return;

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

  return (
    <>
      <CelebrationModal
        isOpen={showCelebration}
        confluenceUrl={confluence.publishedPage?.url}
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
          {/* 6번: 게시 완료 시 저장 버튼 비활성화 */}
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isPublished}>
            <FileText className="h-4 w-4" />
            저장
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            MD 다운로드
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing || isPublished}
          >
            <Send className="h-4 w-4" />
            {isPublished ? "게시 완료" : "Confluence 게시"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* 6번: 게시 완료 시 에디터 읽기 전용 */}
          <MinutesEditor
            content={minutes.content}
            onChange={handleContentChange}
            corrections={minutes.corrections}
            activeCorrectionIndex={activeCorrectionIndex}
            readOnly={isPublished}
          />
          {isPublished && (
            <p className="mt-2 text-sm text-muted-foreground text-center">
              게시 완료된 회의록은 수정할 수 없습니다.
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
