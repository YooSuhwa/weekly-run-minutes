import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { minutesAtom, minutesContentAtom } from "../minutes";

describe("minutes atoms", () => {
  describe("minutesAtom", () => {
    it("should have initial content as empty string", () => {
      const store = createStore();
      expect(store.get(minutesAtom).content).toBe("");
    });

    it("should have initial isEdited as false", () => {
      const store = createStore();
      expect(store.get(minutesAtom).isEdited).toBe(false);
    });

    it("should have initial saveStatus as 'idle'", () => {
      const store = createStore();
      expect(store.get(minutesAtom).saveStatus).toBe("idle");
    });

    it("should have initial corrections as empty array", () => {
      const store = createStore();
      expect(store.get(minutesAtom).corrections).toEqual([]);
    });

    it("should have initial lastSavedAt as null", () => {
      const store = createStore();
      expect(store.get(minutesAtom).lastSavedAt).toBeNull();
    });

    it("should store updated state", () => {
      const store = createStore();
      store.set(minutesAtom, {
        content: "# Meeting Minutes",
        isEdited: true,
        saveStatus: "saving",
        corrections: [
          {
            original: "teh",
            corrected: "the",
            category: "grammar",
            paragraphIndex: null,
            startOffset: null,
            endOffset: null,
          },
        ],
        lastSavedAt: "2024-01-15T10:00:00Z",
      });
      expect(store.get(minutesAtom).content).toBe("# Meeting Minutes");
      expect(store.get(minutesAtom).isEdited).toBe(true);
      expect(store.get(minutesAtom).saveStatus).toBe("saving");
      expect(store.get(minutesAtom).corrections).toHaveLength(1);
    });
  });

  describe("minutesContentAtom", () => {
    it("should read content from minutesAtom", () => {
      const store = createStore();
      expect(store.get(minutesContentAtom)).toBe("");
    });

    it("should write content and set isEdited to true", () => {
      const store = createStore();
      store.set(minutesContentAtom, "# Updated Minutes");
      expect(store.get(minutesContentAtom)).toBe("# Updated Minutes");
      expect(store.get(minutesAtom).isEdited).toBe(true);
    });

    it("should preserve other state when writing content", () => {
      const store = createStore();
      store.set(minutesAtom, {
        content: "",
        isEdited: false,
        saveStatus: "saved",
        corrections: [
          {
            original: "SDK",
            corrected: "SDK",
            category: "terminology",
            paragraphIndex: null,
            startOffset: null,
            endOffset: null,
          },
        ],
        lastSavedAt: "2024-01-15T10:00:00Z",
      });
      store.set(minutesContentAtom, "New content");
      expect(store.get(minutesAtom).saveStatus).toBe("saved");
      expect(store.get(minutesAtom).corrections).toHaveLength(1);
      expect(store.get(minutesAtom).lastSavedAt).toBe("2024-01-15T10:00:00Z");
    });

    it("should set isEdited to true even when content is same as before", () => {
      const store = createStore();
      store.set(minutesContentAtom, "Some content");
      store.set(minutesAtom, { ...store.get(minutesAtom), isEdited: false });
      store.set(minutesContentAtom, "Some content");
      expect(store.get(minutesAtom).isEdited).toBe(true);
    });
  });
});
