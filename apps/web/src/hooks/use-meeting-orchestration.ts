"use client";

import { useAtom } from "jotai";
import { useCallback } from "react";
import type { QuestionTree } from "@/atoms/orchestration";
import { orchestrationAtom } from "@/atoms/orchestration";
import {
  advanceToNextItemApiV1RealtimeMeetingsMeetingIdNextItemPost,
  advanceToNextSpeakerApiV1RealtimeMeetingsMeetingIdNextSpeakerPost,
  endRealtimeMeetingApiV1RealtimeMeetingsMeetingIdEndPost,
  startRealtimeMeetingApiV1RealtimeMeetingsMeetingIdStartPost,
} from "@/lib/api/__generated__/realtime-meeting/realtime-meeting";

interface UseMeetingOrchestrationReturn {
  startMeeting: (meetingId: string) => Promise<void>;
  nextItem: (meetingId: string) => Promise<void>;
  nextSpeaker: (meetingId: string) => Promise<void>;
  endMeeting: (meetingId: string) => Promise<void>;
  resetOrchestration: () => void;
}

export function useMeetingOrchestration(): UseMeetingOrchestrationReturn {
  const [, setOrchestration] = useAtom(orchestrationAtom);

  const startMeeting = useCallback(
    async (meetingId: string) => {
      const response = await startRealtimeMeetingApiV1RealtimeMeetingsMeetingIdStartPost(meetingId);

      const tree = response.question_tree as unknown as QuestionTree | null;

      setOrchestration({
        phase: "in_progress",
        questionTree: tree ?? null,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: true,
      });
    },
    [setOrchestration],
  );

  const nextItem = useCallback(
    async (meetingId: string) => {
      const response = await advanceToNextItemApiV1RealtimeMeetingsMeetingIdNextItemPost(meetingId);

      setOrchestration((prev) => ({
        ...prev,
        currentSpeakerIndex: response.current_speaker_index ?? prev.currentSpeakerIndex,
        currentItemIndex: response.current_item_index ?? prev.currentItemIndex,
      }));
    },
    [setOrchestration],
  );

  const nextSpeaker = useCallback(
    async (meetingId: string) => {
      const response =
        await advanceToNextSpeakerApiV1RealtimeMeetingsMeetingIdNextSpeakerPost(meetingId);

      setOrchestration((prev) => ({
        ...prev,
        currentSpeakerIndex: response.current_speaker_index ?? prev.currentSpeakerIndex,
        currentItemIndex: response.current_item_index ?? 0,
      }));
    },
    [setOrchestration],
  );

  const endMeeting = useCallback(
    async (meetingId: string) => {
      await endRealtimeMeetingApiV1RealtimeMeetingsMeetingIdEndPost(meetingId);

      setOrchestration((prev) => ({
        ...prev,
        phase: "ended",
        isRecording: false,
      }));
    },
    [setOrchestration],
  );

  const resetOrchestration = useCallback(() => {
    setOrchestration({
      phase: "idle",
      questionTree: null,
      currentSpeakerIndex: 0,
      currentItemIndex: 0,
      isRecording: false,
    });
  }, [setOrchestration]);

  return {
    startMeeting,
    nextItem,
    nextSpeaker,
    endMeeting,
    resetOrchestration,
  };
}
