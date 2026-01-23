import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { currentMeetingAtom, meetingModeAtom, meetingsListAtom } from "../meeting";

describe("meeting atoms", () => {
  describe("meetingsListAtom", () => {
    it("should have initial value of empty array", () => {
      const store = createStore();
      expect(store.get(meetingsListAtom)).toEqual([]);
    });

    it("should store a list of meetings", () => {
      const store = createStore();
      const meetings = [
        {
          id: "1",
          teamId: "team-1",
          meetingDate: "2024-01-15",
          title: "Weekly Meeting",
          status: "created" as const,
          errorMessage: null,
          confluencePageId: null,
          confluencePageUrl: null,
        },
      ];
      store.set(meetingsListAtom, meetings);
      expect(store.get(meetingsListAtom)).toEqual(meetings);
    });
  });

  describe("currentMeetingAtom", () => {
    it("should have initial value of null", () => {
      const store = createStore();
      expect(store.get(currentMeetingAtom)).toBeNull();
    });

    it("should store a meeting object", () => {
      const store = createStore();
      const meeting = {
        id: "1",
        teamId: "team-1",
        meetingDate: "2024-01-15",
        title: "Weekly Meeting",
        status: "created" as const,
        errorMessage: null,
        confluencePageId: null,
        confluencePageUrl: null,
      };
      store.set(currentMeetingAtom, meeting);
      expect(store.get(currentMeetingAtom)).toEqual(meeting);
    });
  });

  describe("meetingModeAtom", () => {
    it("should have initial value of 'upload'", () => {
      const store = createStore();
      expect(store.get(meetingModeAtom)).toBe("upload");
    });

    it("should accept 'realtime' value", () => {
      const store = createStore();
      store.set(meetingModeAtom, "realtime");
      expect(store.get(meetingModeAtom)).toBe("realtime");
    });

    it("should accept 'upload' value", () => {
      const store = createStore();
      store.set(meetingModeAtom, "realtime");
      store.set(meetingModeAtom, "upload");
      expect(store.get(meetingModeAtom)).toBe("upload");
    });
  });
});
