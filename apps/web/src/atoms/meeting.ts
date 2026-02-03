import { atom } from "jotai";

export type MeetingMode = "upload" | "realtime";
export type MeetingType = "weekly_report" | "general";

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
  meetingType: MeetingType;
  errorMessage: string | null;
  confluencePageId: string | null;
  confluencePageUrl: string | null;
}

export const currentMeetingAtom = atom<Meeting | null>(null);
export const meetingsListAtom = atom<Meeting[]>([]);
export const meetingModeAtom = atom<MeetingMode>("upload");
export const meetingTypeAtom = atom<MeetingType>("weekly_report");
