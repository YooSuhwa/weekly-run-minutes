import { atom } from "jotai";

export type MeetingStatus =
  | "created"
  | "weekly_report_loaded"
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
  errorMessage: string | null;
  confluencePageId: string | null;
  confluencePageUrl: string | null;
}

export const currentMeetingAtom = atom<Meeting | null>(null);
export const meetingsListAtom = atom<Meeting[]>([]);
export const meetingModeAtom = atom<"upload" | "realtime">("upload");
