import { atom } from "jotai";

export type SttStep = "voice" | "terminology" | "formatting";
export type SttStatus = "idle" | "processing" | "completed" | "error";

export interface SttState {
  status: SttStatus;
  currentStep: SttStep;
  progress: number;
  segmentsCount: number;
  durationSeconds: number | null;
  errorMessage: string | null;
}

const initialState: SttState = {
  status: "idle",
  currentStep: "voice",
  progress: 0,
  segmentsCount: 0,
  durationSeconds: null,
  errorMessage: null,
};

export const sttAtom = atom<SttState>(initialState);
