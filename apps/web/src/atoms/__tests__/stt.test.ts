import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { sttAtom } from "../stt";

describe("stt atoms", () => {
  describe("sttAtom", () => {
    it("should have initial status of 'idle'", () => {
      const store = createStore();
      expect(store.get(sttAtom).status).toBe("idle");
    });

    it("should have initial currentStep of 'voice'", () => {
      const store = createStore();
      expect(store.get(sttAtom).currentStep).toBe("voice");
    });

    it("should have initial progress of 0", () => {
      const store = createStore();
      expect(store.get(sttAtom).progress).toBe(0);
    });

    it("should have initial segmentsCount of 0", () => {
      const store = createStore();
      expect(store.get(sttAtom).segmentsCount).toBe(0);
    });

    it("should have initial durationSeconds of null", () => {
      const store = createStore();
      expect(store.get(sttAtom).durationSeconds).toBeNull();
    });

    it("should have initial errorMessage of null", () => {
      const store = createStore();
      expect(store.get(sttAtom).errorMessage).toBeNull();
    });

    it("should update status to 'processing'", () => {
      const store = createStore();
      store.set(sttAtom, {
        ...store.get(sttAtom),
        status: "processing",
      });
      expect(store.get(sttAtom).status).toBe("processing");
    });

    it("should update currentStep to 'terminology'", () => {
      const store = createStore();
      store.set(sttAtom, {
        ...store.get(sttAtom),
        currentStep: "terminology",
      });
      expect(store.get(sttAtom).currentStep).toBe("terminology");
    });

    it("should update currentStep to 'formatting'", () => {
      const store = createStore();
      store.set(sttAtom, {
        ...store.get(sttAtom),
        currentStep: "formatting",
      });
      expect(store.get(sttAtom).currentStep).toBe("formatting");
    });

    it("should update progress value", () => {
      const store = createStore();
      store.set(sttAtom, {
        ...store.get(sttAtom),
        progress: 75,
      });
      expect(store.get(sttAtom).progress).toBe(75);
    });

    it("should store error state", () => {
      const store = createStore();
      store.set(sttAtom, {
        ...store.get(sttAtom),
        status: "error",
        errorMessage: "STT processing failed",
      });
      expect(store.get(sttAtom).status).toBe("error");
      expect(store.get(sttAtom).errorMessage).toBe("STT processing failed");
    });

    it("should store completed state with duration", () => {
      const store = createStore();
      store.set(sttAtom, {
        status: "completed",
        currentStep: "formatting",
        progress: 100,
        segmentsCount: 42,
        durationSeconds: 1800,
        errorMessage: null,
      });
      expect(store.get(sttAtom).status).toBe("completed");
      expect(store.get(sttAtom).segmentsCount).toBe(42);
      expect(store.get(sttAtom).durationSeconds).toBe(1800);
    });
  });
});
