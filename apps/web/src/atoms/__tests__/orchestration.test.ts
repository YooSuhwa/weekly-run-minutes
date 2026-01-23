import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import type { OrchestrationState, QuestionTree } from "../orchestration";
import {
  currentItemAtom,
  currentSpeakerAtom,
  orchestrationAtom,
  totalItemsForSpeakerAtom,
} from "../orchestration";

const mockTree: QuestionTree = {
  speakers: [
    {
      speakerName: "이상윤",
      categories: [
        {
          name: "AI",
          items: [
            { text: "GPT 연동 진행 상황?", hint: "API 키 관련", status: "pending" },
            { text: "성능 테스트 결과?", hint: null, status: "pending" },
          ],
        },
        {
          name: "SDK",
          items: [{ text: "SDK 배포 일정?", hint: "v2.0", status: "pending" }],
        },
      ],
    },
    {
      speakerName: "선설희",
      categories: [
        {
          name: "HWP",
          items: [{ text: "HWP 파서 이슈?", hint: null, status: "pending" }],
        },
      ],
    },
  ],
};

describe("orchestration atoms", () => {
  describe("orchestrationAtom", () => {
    it("should have correct initial state", () => {
      const store = createStore();
      const state = store.get(orchestrationAtom);
      expect(state).toEqual({
        phase: "idle",
        questionTree: null,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: false,
      });
    });

    it("should update to in_progress with question tree", () => {
      const store = createStore();
      const newState: OrchestrationState = {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: true,
      };
      store.set(orchestrationAtom, newState);
      expect(store.get(orchestrationAtom)).toEqual(newState);
    });

    it("should update phase to ended", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: true,
      });
      store.set(orchestrationAtom, (prev) => ({
        ...prev,
        phase: "ended",
        isRecording: false,
      }));
      expect(store.get(orchestrationAtom).phase).toBe("ended");
      expect(store.get(orchestrationAtom).isRecording).toBe(false);
    });
  });

  describe("currentSpeakerAtom", () => {
    it("should return null when no question tree", () => {
      const store = createStore();
      expect(store.get(currentSpeakerAtom)).toBeNull();
    });

    it("should return first speaker at index 0", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: true,
      });
      const speaker = store.get(currentSpeakerAtom);
      expect(speaker?.speakerName).toBe("이상윤");
    });

    it("should return second speaker at index 1", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 1,
        currentItemIndex: 0,
        isRecording: true,
      });
      const speaker = store.get(currentSpeakerAtom);
      expect(speaker?.speakerName).toBe("선설희");
    });

    it("should return null for out-of-bounds index", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 99,
        currentItemIndex: 0,
        isRecording: true,
      });
      expect(store.get(currentSpeakerAtom)).toBeNull();
    });
  });

  describe("currentItemAtom", () => {
    it("should return null when no speaker", () => {
      const store = createStore();
      expect(store.get(currentItemAtom)).toBeNull();
    });

    it("should return first item from first category", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: true,
      });
      const item = store.get(currentItemAtom);
      expect(item?.text).toBe("GPT 연동 진행 상황?");
      expect(item?.categoryName).toBe("AI");
      expect(item?.hint).toBe("API 키 관련");
    });

    it("should return second item from first category", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 1,
        isRecording: true,
      });
      const item = store.get(currentItemAtom);
      expect(item?.text).toBe("성능 테스트 결과?");
      expect(item?.categoryName).toBe("AI");
    });

    it("should cross category boundary for third item", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 2,
        isRecording: true,
      });
      const item = store.get(currentItemAtom);
      expect(item?.text).toBe("SDK 배포 일정?");
      expect(item?.categoryName).toBe("SDK");
    });

    it("should return null for out-of-bounds item index", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 99,
        isRecording: true,
      });
      expect(store.get(currentItemAtom)).toBeNull();
    });
  });

  describe("totalItemsForSpeakerAtom", () => {
    it("should return 0 when no speaker", () => {
      const store = createStore();
      expect(store.get(totalItemsForSpeakerAtom)).toBe(0);
    });

    it("should count items across all categories for first speaker", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
        isRecording: true,
      });
      // AI: 2 items + SDK: 1 item = 3
      expect(store.get(totalItemsForSpeakerAtom)).toBe(3);
    });

    it("should count items for second speaker", () => {
      const store = createStore();
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: mockTree,
        currentSpeakerIndex: 1,
        currentItemIndex: 0,
        isRecording: true,
      });
      // HWP: 1 item
      expect(store.get(totalItemsForSpeakerAtom)).toBe(1);
    });
  });
});
