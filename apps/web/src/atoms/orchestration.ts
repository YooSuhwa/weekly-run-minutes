import { atom } from "jotai";

export interface QuestionItem {
  text: string;
  hint: string | null;
  status: string;
}

export interface QuestionCategory {
  name: string;
  items: QuestionItem[];
}

export interface SpeakerQuestions {
  speakerName: string;
  categories: QuestionCategory[];
}

export interface QuestionTree {
  speakers: SpeakerQuestions[];
}

export type OrchestrationPhase = "idle" | "preparing" | "in_progress" | "ended";

export interface OrchestrationState {
  phase: OrchestrationPhase;
  questionTree: QuestionTree | null;
  currentSpeakerIndex: number;
  currentItemIndex: number;
  isRecording: boolean;
}

const initialState: OrchestrationState = {
  phase: "idle",
  questionTree: null,
  currentSpeakerIndex: 0,
  currentItemIndex: 0,
  isRecording: false,
};

export const orchestrationAtom = atom<OrchestrationState>(initialState);

export const currentSpeakerAtom = atom((get) => {
  const state = get(orchestrationAtom);
  if (!state.questionTree) return null;
  return state.questionTree.speakers[state.currentSpeakerIndex] ?? null;
});

export const currentItemAtom = atom((get) => {
  const state = get(orchestrationAtom);
  const speaker = get(currentSpeakerAtom);
  if (!speaker) return null;

  let itemCount = 0;
  for (const category of speaker.categories) {
    for (const item of category.items) {
      if (itemCount === state.currentItemIndex) {
        return { ...item, categoryName: category.name };
      }
      itemCount++;
    }
  }
  return null;
});

export const totalItemsForSpeakerAtom = atom((get) => {
  const speaker = get(currentSpeakerAtom);
  if (!speaker) return 0;
  return speaker.categories.reduce((sum, cat) => sum + cat.items.length, 0);
});
