import { atom } from "jotai";

export type MinutesSaveStatus = "idle" | "saving" | "saved" | "error";

export interface CorrectionItem {
  original: string;
  corrected: string;
  category: "terminology" | "formatting" | "grammar";
  paragraphIndex: number | null;
  startOffset: number | null;
  endOffset: number | null;
}

export interface MinutesState {
  content: string;
  isEdited: boolean;
  saveStatus: MinutesSaveStatus;
  corrections: CorrectionItem[];
  lastSavedAt: string | null;
  confluenceSynced: boolean;
}

const initialState: MinutesState = {
  content: "",
  isEdited: false,
  saveStatus: "idle",
  corrections: [],
  lastSavedAt: null,
  confluenceSynced: false,
};

export const minutesAtom = atom<MinutesState>(initialState);
export const minutesContentAtom = atom(
  (get) => get(minutesAtom).content,
  (get, set, content: string) => {
    set(minutesAtom, { ...get(minutesAtom), content, isEdited: true });
  },
);
