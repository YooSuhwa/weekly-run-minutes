import { atom } from "jotai";

export type MeetingMode = "upload" | "realtime";

export type MeetingStatus =
  | "created"
  | "weekly_report_loaded"
  | "preparing"
  | "in_progress"
  | "recording_done"
  | "recording_uploaded"
  | "transcribing"
  | "transcribed"
  | "generating_minutes"
  | "draft_ready"
  | "published"
  | "failed";

export interface Meeting {
  id: string;
  teamId: string;
  meetingDate: string;
  title: string;
  status: MeetingStatus;
  meetingMode: MeetingMode;
  errorMessage: string | null;
  confluencePageId: string | null;
  confluencePageUrl: string | null;
}

export const currentMeetingAtom = atom<Meeting | null>(null);
export const meetingsListAtom = atom<Meeting[]>([]);
export const meetingModeAtom = atom<"upload" | "realtime">("upload");
