"use client";

import { useAtom, useAtomValue } from "jotai";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  currentItemAtom,
  currentSpeakerAtom,
  orchestrationAtom,
  totalItemsForSpeakerAtom,
} from "@/atoms/orchestration";
import { QuestionTreePanel } from "@/components/meeting/question-tree-panel";
import { Button } from "@/components/ui/button";
import type { WeekyExpression } from "@/components/weeky/weeky";
import { Weeky } from "@/components/weeky/weeky";
import { useKeyboardShortcuts, useMeetingOrchestration } from "@/hooks";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { uploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost } from "@/lib/api/__generated__/recordings/recordings";
import { formatDuration } from "@/lib/utils";

export default function LiveMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [orchestration] = useAtom(orchestrationAtom);
  const currentSpeaker = useAtomValue(currentSpeakerAtom);
  const currentItem = useAtomValue(currentItemAtom);
  const totalItems = useAtomValue(totalItemsForSpeakerAtom);

  const { startMeeting, nextItem, nextSpeaker, endMeeting } = useMeetingOrchestration();
  const { status: recorderStatus, startRecording, stopRecording, duration } = useMediaRecorder();

  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const initializedRef = useRef(false);

  // Start meeting on mount
  useEffect(() => {
    if (initializedRef.current) return;
    if (orchestration.phase === "idle") {
      initializedRef.current = true;
      const init = async () => {
        setIsStarting(true);
        try {
          await startMeeting(meetingId);
          await startRecording();
        } catch {
          // Error handled by orchestration state
        } finally {
          setIsStarting(false);
        }
      };
      init();
    }
  }, [orchestration.phase, meetingId, startMeeting, startRecording]);

  const handleNextItem = useCallback(async () => {
    if (orchestration.phase !== "in_progress") return;

    // Check if last item for current speaker
    if (orchestration.currentItemIndex + 1 >= totalItems) {
      await nextSpeaker(meetingId);
    } else {
      await nextItem(meetingId);
    }
  }, [orchestration, totalItems, meetingId, nextItem, nextSpeaker]);

  const handlePrevItem = useCallback(async () => {
    // Only go back if not at the beginning
    if (orchestration.currentItemIndex > 0 || orchestration.currentSpeakerIndex > 0) {
      // For simplicity, going backwards uses the update progress API
      // which is handled by the orchestration hook
      await nextItem(meetingId);
    }
  }, [orchestration, meetingId, nextItem]);

  const handleNextSpeaker = useCallback(async () => {
    if (orchestration.phase !== "in_progress") return;
    await nextSpeaker(meetingId);
  }, [orchestration.phase, meetingId, nextSpeaker]);

  const handleEndMeeting = useCallback(async () => {
    setIsEnding(true);
    try {
      const blob = stopRecording();
      await endMeeting(meetingId);

      if (blob) {
        await uploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost(meetingId, {
          file: blob,
          source: "browser",
        });
      }

      router.push(`/meetings/${meetingId}/processing`);
    } catch {
      setIsEnding(false);
    }
  }, [meetingId, endMeeting, stopRecording, router]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: orchestration.phase === "in_progress" && !showEndConfirm,
    shortcuts: [
      {
        key: "Space",
        handler: handleNextItem,
        description: "다음 항목",
      },
      {
        key: "Enter",
        handler: handleNextSpeaker,
        description: "다음 발표자",
      },
      {
        key: "Escape",
        handler: () => setShowEndConfirm(true),
        description: "회의 종료",
      },
      {
        key: "ArrowRight",
        handler: handleNextItem,
        description: "다음 항목",
      },
      {
        key: "ArrowLeft",
        handler: handlePrevItem,
        description: "이전 항목",
      },
    ],
  });

  // Determine Weeky expression based on state
  const getWeekyExpression = (): WeekyExpression => {
    if (isStarting) return "thinking";
    if (orchestration.phase === "ended") return "done";
    if (currentItem) return "questioning";
    if (currentSpeaker) return "listening";
    return "greeting";
  };

  // Get Weeky message
  const getWeekyMessage = (): string => {
    if (isStarting) return "회의를 준비하고 있어요...";
    if (orchestration.phase === "ended") return "회의가 종료되었어요!";
    if (currentItem) return currentItem.text;
    if (currentSpeaker) return `${currentSpeaker.speakerName}님, 말씀해주세요!`;
    return "회의를 시작할게요!";
  };

  if (isStarting) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Weeky expression="thinking" size="lg" message="회의를 준비하고 있어요..." />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Panel: Question Tree */}
      <div className="w-80 border-r overflow-y-auto">
        <QuestionTreePanel />
      </div>

      {/* Right Panel: Main Content */}
      <div className="flex-1 flex flex-col items-center justify-between p-8">
        {/* Weeky + Current Question */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Weeky expression={getWeekyExpression()} size="lg" message={getWeekyMessage()} />

          {currentItem?.hint && (
            <p className="text-xs text-muted-foreground max-w-md text-center">
              Hint: {currentItem.hint}
            </p>
          )}

          {currentSpeaker && (
            <div className="text-center">
              <p className="text-lg font-semibold">{currentSpeaker.speakerName}</p>
              <p className="text-sm text-muted-foreground">
                {orchestration.currentItemIndex + 1} / {totalItems}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-lg space-y-4">
          {/* Recording indicator */}
          {recorderStatus === "recording" && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-muted-foreground">녹음 중 {formatDuration(duration)}</span>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextItem}
              disabled={orchestration.phase !== "in_progress"}
            >
              다음 항목 (Space)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextSpeaker}
              disabled={orchestration.phase !== "in_progress"}
            >
              다음 발표자 (Enter)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowEndConfirm(true)}
              disabled={orchestration.phase !== "in_progress"}
            >
              종료 (Esc)
            </Button>
          </div>

          {/* Keyboard hints */}
          <p className="text-xs text-center text-muted-foreground">
            Space: 다음 항목 | Enter: 다음 발표자 | Esc: 종료 | \u2190\u2192: 이동
          </p>
        </div>
      </div>

      {/* End confirmation dialog */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">회의를 종료하시겠어요?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              녹음이 중단되고 STT 처리를 시작합니다.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEndConfirm(false)}>
                취소
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndMeeting}
                disabled={isEnding}
              >
                {isEnding ? "종료 중..." : "종료"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
