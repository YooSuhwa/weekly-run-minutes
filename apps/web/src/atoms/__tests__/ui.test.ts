import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToastAtom, isLoadingAtom, toastsAtom, uiAtom } from "../ui";

describe("ui atoms", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("uiAtom", () => {
    it("should have initial isLoading as false", () => {
      const store = createStore();
      expect(store.get(uiAtom).isLoading).toBe(false);
    });

    it("should have initial toasts as empty array", () => {
      const store = createStore();
      expect(store.get(uiAtom).toasts).toEqual([]);
    });
  });

  describe("isLoadingAtom", () => {
    it("should read isLoading from uiAtom", () => {
      const store = createStore();
      expect(store.get(isLoadingAtom)).toBe(false);
    });

    it("should set isLoading to true", () => {
      const store = createStore();
      store.set(isLoadingAtom, true);
      expect(store.get(isLoadingAtom)).toBe(true);
      expect(store.get(uiAtom).isLoading).toBe(true);
    });

    it("should set isLoading to false", () => {
      const store = createStore();
      store.set(isLoadingAtom, true);
      store.set(isLoadingAtom, false);
      expect(store.get(isLoadingAtom)).toBe(false);
    });

    it("should preserve toasts when toggling loading", () => {
      const store = createStore();
      store.set(uiAtom, {
        isLoading: false,
        toasts: [{ id: "1", type: "info", message: "Hello" }],
      });
      store.set(isLoadingAtom, true);
      expect(store.get(uiAtom).toasts).toHaveLength(1);
    });
  });

  describe("toastsAtom", () => {
    it("should read toasts from uiAtom", () => {
      const store = createStore();
      expect(store.get(toastsAtom)).toEqual([]);
    });

    it("should set toasts array", () => {
      const store = createStore();
      const toasts = [
        { id: "1", type: "success" as const, message: "Done!" },
        { id: "2", type: "error" as const, message: "Failed" },
      ];
      store.set(toastsAtom, toasts);
      expect(store.get(toastsAtom)).toEqual(toasts);
    });

    it("should preserve isLoading when setting toasts", () => {
      const store = createStore();
      store.set(isLoadingAtom, true);
      store.set(toastsAtom, [{ id: "1", type: "info", message: "Test" }]);
      expect(store.get(uiAtom).isLoading).toBe(true);
    });
  });

  describe("addToastAtom", () => {
    it("should add a toast with generated id", () => {
      const store = createStore();
      store.set(addToastAtom, { type: "success", message: "Operation complete" });
      const toasts = store.get(toastsAtom);
      expect(toasts).toHaveLength(1);
      expect(toasts[0].id).toBe("test-uuid-1234");
      expect(toasts[0].type).toBe("success");
      expect(toasts[0].message).toBe("Operation complete");
    });

    it("should add multiple toasts", () => {
      const store = createStore();
      let uuidCounter = 0;
      vi.stubGlobal("crypto", {
        randomUUID: () => `uuid-${++uuidCounter}`,
      });

      store.set(addToastAtom, { type: "success", message: "First" });
      store.set(addToastAtom, { type: "error", message: "Second" });
      const toasts = store.get(toastsAtom);
      expect(toasts).toHaveLength(2);
      expect(toasts[0].message).toBe("First");
      expect(toasts[1].message).toBe("Second");
    });

    it("should auto-remove toast after default duration (4000ms)", () => {
      const store = createStore();
      store.set(addToastAtom, { type: "info", message: "Temporary" });
      expect(store.get(toastsAtom)).toHaveLength(1);

      vi.advanceTimersByTime(4000);
      expect(store.get(toastsAtom)).toHaveLength(0);
    });

    it("should auto-remove toast after custom duration", () => {
      const store = createStore();
      store.set(addToastAtom, { type: "warning", message: "Quick", duration: 2000 });
      expect(store.get(toastsAtom)).toHaveLength(1);

      vi.advanceTimersByTime(1999);
      expect(store.get(toastsAtom)).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(store.get(toastsAtom)).toHaveLength(0);
    });
  });
});
