import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider, useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrchestrationState, QuestionTree } from "@/atoms/orchestration";
import { orchestrationAtom } from "@/atoms/orchestration";
import { useMeetingOrchestration } from "../use-meeting-orchestration";

// Mock the API functions
vi.mock("@/lib/api/__generated__/realtime-meeting/realtime-meeting", () => ({
  startRealtimeMeetingApiV1RealtimeMeetingsMeetingIdStartPost: vi.fn(),
  advanceToNextItemApiV1RealtimeMeetingsMeetingIdNextItemPost: vi.fn(),
  advanceToNextSpeakerApiV1RealtimeMeetingsMeetingIdNextSpeakerPost: vi.fn(),
  endRealtimeMeetingApiV1RealtimeMeetingsMeetingIdEndPost: vi.fn(),
}));

import {
  advanceToNextItemApiV1RealtimeMeetingsMeetingIdNextItemPost,
  advanceToNextSpeakerApiV1RealtimeMeetingsMeetingIdNextSpeakerPost,
  endRealtimeMeetingApiV1RealtimeMeetingsMeetingIdEndPost,
  startRealtimeMeetingApiV1RealtimeMeetingsMeetingIdStartPost,
} from "@/lib/api/__generated__/realtime-meeting/realtime-meeting";

const mockStartMeeting = vi.mocked(startRealtimeMeetingApiV1RealtimeMeetingsMeetingIdStartPost);
const mockNextItem = vi.mocked(advanceToNextItemApiV1RealtimeMeetingsMeetingIdNextItemPost);
const mockNextSpeaker = vi.mocked(
  advanceToNextSpeakerApiV1RealtimeMeetingsMeetingIdNextSpeakerPost,
);
const mockEndMeeting = vi.mocked(endRealtimeMeetingApiV1RealtimeMeetingsMeetingIdEndPost);

const mockQuestionTree: QuestionTree = {
  speakers: [
    {
      speakerName: "Speaker 1",
      categories: [
        {
          name: "AI",
          items: [
            { text: "Item 1", hint: "Hint 1", status: "pending" },
            { text: "Item 2", hint: null, status: "pending" },
          ],
        },
      ],
    },
    {
      speakerName: "Speaker 2",
      categories: [
        {
          name: "SDK",
          items: [{ text: "Item 3", hint: "Hint 3", status: "pending" }],
        },
      ],
    },
  ],
};

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider>{children}</Provider>;
  };
}

// Helper hook to read orchestration state for verification
function useOrchestrationState() {
  return useAtomValue(orchestrationAtom);
}

describe("useMeetingOrchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("startMeeting", () => {
    it("should call startRealtimeMeeting API with meeting ID", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startMeeting("test-meeting-id");
      });

      expect(mockStartMeeting).toHaveBeenCalledWith("test-meeting-id");
      expect(mockStartMeeting).toHaveBeenCalledTimes(1);
    });

    it("should update orchestration state to in_progress with question tree", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("in_progress");
      expect(result.current.state.questionTree).toEqual(mockQuestionTree);
      expect(result.current.state.currentSpeakerIndex).toBe(0);
      expect(result.current.state.currentItemIndex).toBe(0);
      expect(result.current.state.isRecording).toBe(true);
    });

    it("should handle null question tree from API response", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: null,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("in_progress");
      expect(result.current.state.questionTree).toBeNull();
    });

    it("should handle undefined question tree from API response", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: undefined as unknown as null,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.questionTree).toBeNull();
    });

    it("should propagate API error", async () => {
      const apiError = new Error("API Error");
      mockStartMeeting.mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.startMeeting("test-meeting-id")).rejects.toThrow("API Error");
    });
  });

  describe("nextItem", () => {
    it("should call advanceToNextItem API with meeting ID", async () => {
      mockNextItem.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 0,
        current_item_index: 1,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.nextItem("test-meeting-id");
      });

      expect(mockNextItem).toHaveBeenCalledWith("test-meeting-id");
      expect(mockNextItem).toHaveBeenCalledTimes(1);
    });

    it("should update currentItemIndex from API response", async () => {
      mockNextItem.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 0,
        current_item_index: 2,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      expect(result.current.state.currentItemIndex).toBe(2);
    });

    it("should update currentSpeakerIndex from API response", async () => {
      mockNextItem.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 1,
        current_item_index: 0,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(1);
      expect(result.current.state.currentItemIndex).toBe(0);
    });

    it("should keep previous index when API returns null for speaker index", async () => {
      // First set up some state
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      mockNextItem.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: null,
        current_item_index: 1,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(0);
      expect(result.current.state.currentItemIndex).toBe(1);
    });

    it("should keep previous index when API returns null for item index", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      mockNextItem.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 1,
        current_item_index: null,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(1);
      expect(result.current.state.currentItemIndex).toBe(0);
    });

    it("should propagate API error", async () => {
      const apiError = new Error("Next item failed");
      mockNextItem.mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.nextItem("test-meeting-id")).rejects.toThrow("Next item failed");
    });
  });

  describe("nextSpeaker", () => {
    it("should call advanceToNextSpeaker API with meeting ID", async () => {
      mockNextSpeaker.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 1,
        current_item_index: 0,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.nextSpeaker("test-meeting-id");
      });

      expect(mockNextSpeaker).toHaveBeenCalledWith("test-meeting-id");
      expect(mockNextSpeaker).toHaveBeenCalledTimes(1);
    });

    it("should update speaker index and reset item index to 0 when null", async () => {
      mockNextSpeaker.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 1,
        current_item_index: null,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.nextSpeaker("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(1);
      expect(result.current.state.currentItemIndex).toBe(0);
    });

    it("should update both speaker and item index from API response", async () => {
      mockNextSpeaker.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 2,
        current_item_index: 3,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.nextSpeaker("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(2);
      expect(result.current.state.currentItemIndex).toBe(3);
    });

    it("should keep previous speaker index when API returns null", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      mockNextSpeaker.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: null,
        current_item_index: 0,
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      await act(async () => {
        await result.current.orchestration.nextSpeaker("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(0);
    });

    it("should propagate API error", async () => {
      const apiError = new Error("Next speaker failed");
      mockNextSpeaker.mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.nextSpeaker("test-meeting-id")).rejects.toThrow(
        "Next speaker failed",
      );
    });
  });

  describe("endMeeting", () => {
    it("should call endRealtimeMeeting API with meeting ID", async () => {
      mockEndMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "RECORDING_DONE",
      });

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.endMeeting("test-meeting-id");
      });

      expect(mockEndMeeting).toHaveBeenCalledWith("test-meeting-id");
      expect(mockEndMeeting).toHaveBeenCalledTimes(1);
    });

    it("should update orchestration state to ended and stop recording", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      mockEndMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "RECORDING_DONE",
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      // Start meeting first
      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.isRecording).toBe(true);

      // End meeting
      await act(async () => {
        await result.current.orchestration.endMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("ended");
      expect(result.current.state.isRecording).toBe(false);
    });

    it("should preserve other state properties when ending meeting", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      mockNextItem.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 0,
        current_item_index: 1,
        question_tree: mockQuestionTree,
      });

      mockEndMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "RECORDING_DONE",
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      await act(async () => {
        await result.current.orchestration.endMeeting("test-meeting-id");
      });

      // Should preserve question tree and indices
      expect(result.current.state.questionTree).toEqual(mockQuestionTree);
      expect(result.current.state.currentItemIndex).toBe(1);
    });

    it("should propagate API error", async () => {
      const apiError = new Error("End meeting failed");
      mockEndMeeting.mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.endMeeting("test-meeting-id")).rejects.toThrow(
        "End meeting failed",
      );
    });
  });

  describe("resetOrchestration", () => {
    it("should reset orchestration state to initial values", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      // First modify state
      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("in_progress");

      // Reset
      act(() => {
        result.current.orchestration.resetOrchestration();
      });

      expect(result.current.state).toEqual({
        phase: "idle",
        questionTree: null,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: false,
      });
    });

    it("should not make any API calls", () => {
      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.resetOrchestration();
      });

      expect(mockStartMeeting).not.toHaveBeenCalled();
      expect(mockNextItem).not.toHaveBeenCalled();
      expect(mockNextSpeaker).not.toHaveBeenCalled();
      expect(mockEndMeeting).not.toHaveBeenCalled();
    });

    it("should work when called multiple times", async () => {
      mockStartMeeting.mockResolvedValue({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      // Start, reset, start, reset
      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      act(() => {
        result.current.orchestration.resetOrchestration();
      });

      expect(result.current.state.phase).toBe("idle");

      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("in_progress");

      act(() => {
        result.current.orchestration.resetOrchestration();
      });

      expect(result.current.state.phase).toBe("idle");
    });
  });

  describe("hook return value stability", () => {
    it("should return stable function references", () => {
      const { result, rerender } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      const initialFunctions = {
        startMeeting: result.current.startMeeting,
        nextItem: result.current.nextItem,
        nextSpeaker: result.current.nextSpeaker,
        endMeeting: result.current.endMeeting,
        resetOrchestration: result.current.resetOrchestration,
      };

      rerender();

      expect(result.current.startMeeting).toBe(initialFunctions.startMeeting);
      expect(result.current.nextItem).toBe(initialFunctions.nextItem);
      expect(result.current.nextSpeaker).toBe(initialFunctions.nextSpeaker);
      expect(result.current.endMeeting).toBe(initialFunctions.endMeeting);
      expect(result.current.resetOrchestration).toBe(initialFunctions.resetOrchestration);
    });

    it("should return all expected functions", () => {
      const { result } = renderHook(() => useMeetingOrchestration(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toHaveProperty("startMeeting");
      expect(result.current).toHaveProperty("nextItem");
      expect(result.current).toHaveProperty("nextSpeaker");
      expect(result.current).toHaveProperty("endMeeting");
      expect(result.current).toHaveProperty("resetOrchestration");

      expect(typeof result.current.startMeeting).toBe("function");
      expect(typeof result.current.nextItem).toBe("function");
      expect(typeof result.current.nextSpeaker).toBe("function");
      expect(typeof result.current.endMeeting).toBe("function");
      expect(typeof result.current.resetOrchestration).toBe("function");
    });
  });

  describe("full workflow integration", () => {
    it("should handle complete meeting flow", async () => {
      mockStartMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        question_tree: mockQuestionTree,
      });

      mockNextItem
        .mockResolvedValueOnce({
          meeting_id: "test-meeting-id",
          status: "IN_PROGRESS",
          current_speaker_index: 0,
          current_item_index: 1,
          question_tree: mockQuestionTree,
        })
        .mockResolvedValueOnce({
          meeting_id: "test-meeting-id",
          status: "IN_PROGRESS",
          current_speaker_index: 0,
          current_item_index: 2,
          question_tree: mockQuestionTree,
        });

      mockNextSpeaker.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "IN_PROGRESS",
        current_speaker_index: 1,
        current_item_index: 0,
        question_tree: mockQuestionTree,
      });

      mockEndMeeting.mockResolvedValueOnce({
        meeting_id: "test-meeting-id",
        status: "RECORDING_DONE",
      });

      const { result } = renderHook(
        () => ({
          orchestration: useMeetingOrchestration(),
          state: useOrchestrationState(),
        }),
        { wrapper: createWrapper() },
      );

      // Start meeting
      await act(async () => {
        await result.current.orchestration.startMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("in_progress");
      expect(result.current.state.isRecording).toBe(true);

      // Next item
      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      expect(result.current.state.currentItemIndex).toBe(1);

      // Next item again
      await act(async () => {
        await result.current.orchestration.nextItem("test-meeting-id");
      });

      expect(result.current.state.currentItemIndex).toBe(2);

      // Next speaker
      await act(async () => {
        await result.current.orchestration.nextSpeaker("test-meeting-id");
      });

      expect(result.current.state.currentSpeakerIndex).toBe(1);
      expect(result.current.state.currentItemIndex).toBe(0);

      // End meeting
      await act(async () => {
        await result.current.orchestration.endMeeting("test-meeting-id");
      });

      expect(result.current.state.phase).toBe("ended");
      expect(result.current.state.isRecording).toBe(false);

      // Reset
      act(() => {
        result.current.orchestration.resetOrchestration();
      });

      expect(result.current.state.phase).toBe("idle");
      expect(result.current.state.questionTree).toBeNull();
    });
  });
});
