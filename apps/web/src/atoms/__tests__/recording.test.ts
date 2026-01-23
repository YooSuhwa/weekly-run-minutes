import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { recordingAtom, recordingFileAtom } from "../recording";

describe("recording atoms", () => {
  describe("recordingAtom", () => {
    it("should have initial uploadStatus of 'idle'", () => {
      const store = createStore();
      expect(store.get(recordingAtom).uploadStatus).toBe("idle");
    });

    it("should have initial file as null", () => {
      const store = createStore();
      expect(store.get(recordingAtom).file).toBeNull();
    });

    it("should have initial uploadProgress of 0", () => {
      const store = createStore();
      expect(store.get(recordingAtom).uploadProgress).toBe(0);
    });

    it("should have initial recordingId as null", () => {
      const store = createStore();
      expect(store.get(recordingAtom).recordingId).toBeNull();
    });

    it("should have initial errorMessage as null", () => {
      const store = createStore();
      expect(store.get(recordingAtom).errorMessage).toBeNull();
    });

    it("should store updated state", () => {
      const store = createStore();
      store.set(recordingAtom, {
        file: null,
        uploadStatus: "uploading",
        uploadProgress: 50,
        recordingId: null,
        errorMessage: null,
      });
      expect(store.get(recordingAtom).uploadStatus).toBe("uploading");
      expect(store.get(recordingAtom).uploadProgress).toBe(50);
    });
  });

  describe("recordingFileAtom", () => {
    it("should read file from recordingAtom", () => {
      const store = createStore();
      expect(store.get(recordingFileAtom)).toBeNull();
    });

    it("should write file to recordingAtom", () => {
      const store = createStore();
      const file = new File(["audio content"], "recording.mp3", {
        type: "audio/mpeg",
      });
      store.set(recordingFileAtom, file);
      expect(store.get(recordingFileAtom)).toBe(file);
      expect(store.get(recordingAtom).file).toBe(file);
    });

    it("should set file to null when removing", () => {
      const store = createStore();
      const file = new File(["audio content"], "recording.mp3", {
        type: "audio/mpeg",
      });
      store.set(recordingFileAtom, file);
      store.set(recordingFileAtom, null);
      expect(store.get(recordingFileAtom)).toBeNull();
    });

    it("should preserve other recording state when setting file", () => {
      const store = createStore();
      store.set(recordingAtom, {
        file: null,
        uploadStatus: "uploading",
        uploadProgress: 30,
        recordingId: "rec-1",
        errorMessage: null,
      });
      const file = new File(["audio"], "test.wav", { type: "audio/wav" });
      store.set(recordingFileAtom, file);
      expect(store.get(recordingAtom).uploadStatus).toBe("uploading");
      expect(store.get(recordingAtom).uploadProgress).toBe(30);
      expect(store.get(recordingAtom).recordingId).toBe("rec-1");
    });
  });
});
