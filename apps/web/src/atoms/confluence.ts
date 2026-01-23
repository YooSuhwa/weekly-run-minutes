import { atom } from "jotai";

export type ConfluenceStatus = "idle" | "uploading" | "uploaded" | "error";

export interface ConfluencePage {
  id: string;
  title: string;
  url: string;
}

export interface ConfluenceState {
  weeklyReportPageId: string | null;
  weeklyReportLoaded: boolean;
  publishStatus: ConfluenceStatus;
  publishedPage: ConfluencePage | null;
  errorMessage: string | null;
}

const initialState: ConfluenceState = {
  weeklyReportPageId: null,
  weeklyReportLoaded: false,
  publishStatus: "idle",
  publishedPage: null,
  errorMessage: null,
};

export const confluenceAtom = atom<ConfluenceState>(initialState);
