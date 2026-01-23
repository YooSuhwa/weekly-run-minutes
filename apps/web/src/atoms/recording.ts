import { atom } from "jotai";

export type UploadStatus = "idle" | "uploading" | "uploaded" | "error";

export interface RecordingState {
  file: File | null;
  uploadStatus: UploadStatus;
  uploadProgress: number;
  recordingId: string | null;
  errorMessage: string | null;
}

const initialState: RecordingState = {
  file: null,
  uploadStatus: "idle",
  uploadProgress: 0,
  recordingId: null,
  errorMessage: null,
};

export const recordingAtom = atom<RecordingState>(initialState);
export const recordingFileAtom = atom(
  (get) => get(recordingAtom).file,
  (get, set, file: File | null) => {
    set(recordingAtom, { ...get(recordingAtom), file });
  },
);
