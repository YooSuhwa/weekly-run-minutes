import { cleanup, render, screen, within } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type OrchestrationState,
  orchestrationAtom,
  type QuestionCategory,
  type QuestionItem,
  type QuestionTree,
  type SpeakerQuestions,
} from "@/atoms/orchestration";
import { QuestionTreePanel } from "../question-tree-panel";

// Factory functions for creating test data
function createQuestionItem(overrides: Partial<QuestionItem> = {}): QuestionItem {
  return {
    text: "테스트 질문",
    hint: "테스트 힌트",
    status: "pending",
    ...overrides,
  };
}

function createQuestionCategory(overrides: Partial<QuestionCategory> = {}): QuestionCategory {
  return {
    name: "테스트 카테고리",
    items: [createQuestionItem()],
    ...overrides,
  };
}

function createSpeakerQuestions(overrides: Partial<SpeakerQuestions> = {}): SpeakerQuestions {
  return {
    speakerName: "테스트 발표자",
    categories: [createQuestionCategory()],
    ...overrides,
  };
}

function createQuestionTree(overrides: Partial<QuestionTree> = {}): QuestionTree {
  return {
    speakers: [createSpeakerQuestions()],
    ...overrides,
  };
}

function createTestStore(initialState?: Partial<OrchestrationState>) {
  const store = createStore();
  const defaultState: OrchestrationState = {
    phase: "in_progress",
    questionTree: createQuestionTree(),
    currentSpeakerIndex: 0,
    currentItemIndex: 0,
    isRecording: true,
    ...initialState,
  };
  store.set(orchestrationAtom, defaultState);
  return store;
}

function renderWithProviders(ui: ReactNode, initialState?: Partial<OrchestrationState>) {
  const store = createTestStore(initialState);
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("QuestionTreePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Empty state", () => {
    it("renders empty state when questionTree is null", () => {
      renderWithProviders(<QuestionTreePanel />, { questionTree: null });

      expect(screen.getByText("질문 트리가 없습니다.")).toBeInTheDocument();
    });

    it("renders empty state when speakers array is empty", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: { speakers: [] },
      });

      expect(screen.getByText("질문 트리가 없습니다.")).toBeInTheDocument();
    });

    it("applies custom className to empty state", () => {
      const { container } = renderWithProviders(<QuestionTreePanel className="custom-class" />, {
        questionTree: null,
      });

      const emptyDiv = container.querySelector(".custom-class");
      expect(emptyDiv).toBeInTheDocument();
    });

    it("has centered text styling in empty state", () => {
      renderWithProviders(<QuestionTreePanel />, { questionTree: null });

      const emptyText = screen.getByText("질문 트리가 없습니다.");
      expect(emptyText).toHaveClass("text-sm");
    });
  });

  describe("Header section", () => {
    it("renders header with title", () => {
      renderWithProviders(<QuestionTreePanel />);

      expect(screen.getByText("진행 현황")).toBeInTheDocument();
    });

    it("displays progress counter when current speaker exists", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            speakerName: "이상윤",
            categories: [
              createQuestionCategory({
                name: "AI",
                items: [
                  createQuestionItem({ text: "첫 번째 질문" }),
                  createQuestionItem({ text: "두 번째 질문" }),
                  createQuestionItem({ text: "세 번째 질문" }),
                ],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
      });

      expect(screen.getByText("1/3")).toBeInTheDocument();
    });

    it("does not display progress when current speaker is null", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: createQuestionTree({ speakers: [] }),
      });

      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
    });

    it("displays correct progress for second item", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [
                  createQuestionItem({ text: "첫 번째" }),
                  createQuestionItem({ text: "두 번째" }),
                ],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 1,
      });

      expect(screen.getByText("2/2")).toBeInTheDocument();
    });
  });

  describe("Single speaker", () => {
    it("renders speaker name", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "이상윤" })],
      });

      renderWithProviders(<QuestionTreePanel />, { questionTree });

      expect(screen.getByText("이상윤")).toBeInTheDocument();
    });

    it("applies active styling to current speaker", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "이상윤" })],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      const speakerName = screen.getByText("이상윤");
      expect(speakerName).toHaveClass("text-primary");
    });

    it("displays category name for active speaker", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [createQuestionCategory({ name: "AI" })],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText("AI")).toBeInTheDocument();
    });

    it("displays question items for active speaker", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [
                  createQuestionItem({ text: "첫 번째 질문" }),
                  createQuestionItem({ text: "두 번째 질문" }),
                ],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText("첫 번째 질문")).toBeInTheDocument();
      expect(screen.getByText("두 번째 질문")).toBeInTheDocument();
    });
  });

  describe("Multiple speakers", () => {
    const multiSpeakerTree = createQuestionTree({
      speakers: [
        createSpeakerQuestions({
          speakerName: "이상윤",
          categories: [
            createQuestionCategory({
              name: "AI",
              items: [createQuestionItem({ text: "AI 질문" })],
            }),
          ],
        }),
        createSpeakerQuestions({
          speakerName: "선설희",
          categories: [
            createQuestionCategory({
              name: "SDK",
              items: [createQuestionItem({ text: "SDK 질문" })],
            }),
          ],
        }),
        createSpeakerQuestions({
          speakerName: "최보연",
          categories: [
            createQuestionCategory({
              name: "HWP",
              items: [createQuestionItem({ text: "HWP 질문" })],
            }),
          ],
        }),
      ],
    });

    it("renders all speakers", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
      });

      expect(screen.getByText("이상윤")).toBeInTheDocument();
      expect(screen.getByText("선설희")).toBeInTheDocument();
      expect(screen.getByText("최보연")).toBeInTheDocument();
    });

    it("highlights only the current speaker", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 1,
      });

      const sangyunName = screen.getByText(/이상윤/);
      const seolheeName = screen.getByText(/선설희/);
      const boyeonName = screen.getByText(/최보연/);

      expect(sangyunName).not.toHaveClass("text-primary");
      expect(seolheeName).toHaveClass("text-primary");
      expect(boyeonName).not.toHaveClass("text-primary");
    });

    it("shows checkmark for completed speakers", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 2,
      });

      // First two speakers should have checkmarks (index 0, 1 < currentSpeakerIndex 2)
      const sangyunSection = screen.getByText(/이상윤/).closest("div");
      const seolheeSection = screen.getByText(/선설희/).closest("div");

      expect(sangyunSection?.textContent).toContain("✓");
      expect(seolheeSection?.textContent).toContain("✓");
    });

    it("does not show checkmark for current speaker", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 1,
      });

      const seolheeText = screen.getByText("선설희");
      expect(seolheeText.textContent).not.toContain("✓");
    });

    it("applies opacity to completed speakers", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 1,
      });

      const sangyunSection = screen.getByText(/이상윤/).closest("div");
      expect(sangyunSection).toHaveClass("opacity-60");
    });

    it("applies line-through to completed speaker names", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 1,
      });

      const sangyunName = screen.getByText(/이상윤/);
      expect(sangyunName).toHaveClass("line-through");
    });

    it("shows items only for active speaker", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 1,
      });

      // Should show SDK question for active speaker (선설희)
      expect(screen.getByText("SDK 질문")).toBeInTheDocument();

      // Should not show questions for other speakers
      expect(screen.queryByText("AI 질문")).not.toBeInTheDocument();
      expect(screen.queryByText("HWP 질문")).not.toBeInTheDocument();
    });
  });

  describe("Question item states", () => {
    const questionTree = createQuestionTree({
      speakers: [
        createSpeakerQuestions({
          speakerName: "이상윤",
          categories: [
            createQuestionCategory({
              name: "AI",
              items: [
                createQuestionItem({ text: "첫 번째 질문" }),
                createQuestionItem({ text: "두 번째 질문" }),
                createQuestionItem({ text: "세 번째 질문" }),
              ],
            }),
          ],
        }),
      ],
    });

    it("shows play icon for current item", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 0,
      });

      const firstItem = screen.getByText("첫 번째 질문");
      expect(firstItem.parentElement?.textContent).toContain("▶");
    });

    it("shows checkmark for completed items", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 2,
      });

      const firstItem = screen.getByText("첫 번째 질문");
      const secondItem = screen.getByText("두 번째 질문");

      expect(firstItem.parentElement?.textContent).toContain("✓");
      expect(secondItem.parentElement?.textContent).toContain("✓");
    });

    it("shows bullet for pending items", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 0,
      });

      const thirdItem = screen.getByText("세 번째 질문");
      expect(thirdItem.parentElement?.textContent).toContain("•");
    });

    it("applies primary color to current item", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 1,
      });

      const secondItem = screen.getByText("두 번째 질문").closest("li");
      expect(secondItem).toHaveClass("text-primary");
      expect(secondItem).toHaveClass("font-semibold");
    });

    it("applies muted styling to completed items", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 2,
      });

      const firstItem = screen.getByText("첫 번째 질문").closest("li");
      expect(firstItem).toHaveClass("text-muted-foreground");
      expect(firstItem).toHaveClass("line-through");
    });

    it("does not apply special styling to pending items", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 0,
      });

      const thirdItem = screen.getByText("세 번째 질문").closest("li");
      expect(thirdItem).not.toHaveClass("text-primary");
      expect(thirdItem).not.toHaveClass("font-semibold");
      expect(thirdItem).not.toHaveClass("text-muted-foreground");
      expect(thirdItem).not.toHaveClass("line-through");
    });
  });

  describe("Multiple categories", () => {
    const multiCategoryTree = createQuestionTree({
      speakers: [
        createSpeakerQuestions({
          speakerName: "이상윤",
          categories: [
            createQuestionCategory({
              name: "AI",
              items: [
                createQuestionItem({ text: "AI 첫 번째" }),
                createQuestionItem({ text: "AI 두 번째" }),
              ],
            }),
            createQuestionCategory({
              name: "SDK",
              items: [createQuestionItem({ text: "SDK 첫 번째" })],
            }),
            createQuestionCategory({
              name: "HWP",
              items: [
                createQuestionItem({ text: "HWP 첫 번째" }),
                createQuestionItem({ text: "HWP 두 번째" }),
              ],
            }),
          ],
        }),
      ],
    });

    it("renders all categories for active speaker", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiCategoryTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText("AI")).toBeInTheDocument();
      expect(screen.getByText("SDK")).toBeInTheDocument();
      expect(screen.getByText("HWP")).toBeInTheDocument();
    });

    it("renders all items across categories", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiCategoryTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText("AI 첫 번째")).toBeInTheDocument();
      expect(screen.getByText("AI 두 번째")).toBeInTheDocument();
      expect(screen.getByText("SDK 첫 번째")).toBeInTheDocument();
      expect(screen.getByText("HWP 첫 번째")).toBeInTheDocument();
      expect(screen.getByText("HWP 두 번째")).toBeInTheDocument();
    });

    it("correctly tracks item index across categories", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiCategoryTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 2, // SDK 첫 번째 (index 2)
      });

      // Items 0, 1 should be completed (AI category)
      const aiFirst = screen.getByText("AI 첫 번째").closest("li");
      const aiSecond = screen.getByText("AI 두 번째").closest("li");
      expect(aiFirst).toHaveClass("line-through");
      expect(aiSecond).toHaveClass("line-through");

      // Item 2 should be current (SDK category)
      const sdkFirst = screen.getByText("SDK 첫 번째").closest("li");
      expect(sdkFirst).toHaveClass("text-primary");

      // Items 3, 4 should be pending (HWP category)
      const hwpFirst = screen.getByText("HWP 첫 번째");
      expect(hwpFirst.parentElement?.textContent).toContain("•");
    });

    it("displays correct progress across all categories", () => {
      renderWithProviders(<QuestionTreePanel />, {
        questionTree: multiCategoryTree,
        currentItemIndex: 3, // HWP 첫 번째
      });

      // Total items: 2 (AI) + 1 (SDK) + 2 (HWP) = 5
      expect(screen.getByText("4/5")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles speaker with empty categories array", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            speakerName: "이상윤",
            categories: [],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText("이상윤")).toBeInTheDocument();
      expect(screen.getByText("1/0")).toBeInTheDocument();
    });

    it("handles category with empty items array", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                name: "빈 카테고리",
                items: [],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText("빈 카테고리")).toBeInTheDocument();
    });

    it("handles very long speaker names", () => {
      const longName = "가".repeat(100);
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: longName })],
      });

      renderWithProviders(<QuestionTreePanel />, { questionTree });

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it("handles very long question text", () => {
      const longQuestion = "질".repeat(200);
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: longQuestion })],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText(longQuestion)).toBeInTheDocument();
    });

    it("handles special characters in speaker names", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "이상윤 <script>alert('xss')</script>" })],
      });

      renderWithProviders(<QuestionTreePanel />, { questionTree });

      expect(screen.getByText("이상윤 <script>alert('xss')</script>")).toBeInTheDocument();
    });

    it("handles special characters in question text", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: '질문 & 답변 < > "' })],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      expect(screen.getByText('질문 & 답변 < > "')).toBeInTheDocument();
    });

    it("handles currentItemIndex beyond total items", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: "유일한 질문" })],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 999,
      });

      // Should not crash, all items should be marked as done
      const item = screen.getByText("유일한 질문").closest("li");
      expect(item).toHaveClass("line-through");
    });

    it("handles negative currentItemIndex", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: "질문" })],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: -1,
      });

      // Should show bullet for pending item
      const item = screen.getByText("질문");
      expect(item.parentElement?.textContent).toContain("•");
    });

    it("handles currentSpeakerIndex beyond speakers length", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "유일한 발표자" })],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 5,
      });

      // Should mark all speakers as completed
      const speakerName = screen.getByText(/유일한 발표자/);
      expect(speakerName).toHaveClass("line-through");
    });
  });

  describe("Custom className", () => {
    it("applies custom className to main container", () => {
      const { container } = renderWithProviders(<QuestionTreePanel className="my-custom-class" />);

      const mainDiv = container.querySelector(".my-custom-class");
      expect(mainDiv).toBeInTheDocument();
    });

    it("combines custom className with default classes", () => {
      const { container } = renderWithProviders(<QuestionTreePanel className="custom" />);

      const mainDiv = container.querySelector(".custom");
      expect(mainDiv).toHaveClass("flex");
      expect(mainDiv).toHaveClass("flex-col");
    });
  });

  describe("Styling classes", () => {
    it("applies correct border styling to speaker sections", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "이상윤" })],
      });

      renderWithProviders(<QuestionTreePanel />, { questionTree });

      const speakerSection = screen.getByText("이상윤").closest("div");
      expect(speakerSection).toHaveClass("rounded-lg");
      expect(speakerSection).toHaveClass("border");
    });

    it("applies primary border to active speaker", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "이상윤" })],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      const speakerSection = screen.getByText("이상윤").closest("div");
      expect(speakerSection).toHaveClass("border-primary");
      expect(speakerSection).toHaveClass("bg-primary/5");
    });

    it("has scrollable overflow for speaker list", () => {
      const { container } = renderWithProviders(<QuestionTreePanel />);

      const speakerList = container.querySelector(".overflow-y-auto");
      expect(speakerList).toBeInTheDocument();
    });
  });

  describe("Integration with atoms", () => {
    it("updates when orchestration state changes", () => {
      const store = createTestStore({
        questionTree: createQuestionTree({
          speakers: [
            createSpeakerQuestions({
              categories: [
                createQuestionCategory({
                  items: [
                    createQuestionItem({ text: "첫 번째" }),
                    createQuestionItem({ text: "두 번째" }),
                  ],
                }),
              ],
            }),
          ],
        }),
        currentItemIndex: 0,
      });

      const { rerender } = render(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // First item should be current
      let firstItem = screen.getByText("첫 번째").closest("li");
      expect(firstItem).toHaveClass("text-primary");

      // Update state to move to second item
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: createQuestionTree({
          speakers: [
            createSpeakerQuestions({
              categories: [
                createQuestionCategory({
                  items: [
                    createQuestionItem({ text: "첫 번째" }),
                    createQuestionItem({ text: "두 번째" }),
                  ],
                }),
              ],
            }),
          ],
        }),
        currentSpeakerIndex: 0,
        currentItemIndex: 1,
        isRecording: true,
      });

      rerender(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // First item should now be completed
      firstItem = screen.getByText("첫 번째").closest("li");
      expect(firstItem).toHaveClass("line-through");

      // Second item should be current
      const secondItem = screen.getByText("두 번째").closest("li");
      expect(secondItem).toHaveClass("text-primary");
    });

    it("correctly calculates totalItemsForSpeaker from atom", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [createQuestionItem(), createQuestionItem(), createQuestionItem()],
              }),
              createQuestionCategory({
                items: [createQuestionItem(), createQuestionItem()],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentItemIndex: 0,
      });

      // Total should be 3 + 2 = 5
      expect(screen.getByText("1/5")).toBeInTheDocument();
    });

    it("handles transition between speakers", () => {
      const multiSpeakerTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            speakerName: "첫 번째 발표자",
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: "첫 질문" })],
              }),
            ],
          }),
          createSpeakerQuestions({
            speakerName: "두 번째 발표자",
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: "둘째 질문" })],
              }),
            ],
          }),
        ],
      });

      const store = createTestStore({
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
      });

      const { rerender } = render(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // First speaker should be active
      expect(screen.getByText("첫 질문")).toBeInTheDocument();
      expect(screen.queryByText("둘째 질문")).not.toBeInTheDocument();

      // Move to second speaker
      store.set(orchestrationAtom, {
        phase: "in_progress",
        questionTree: multiSpeakerTree,
        currentSpeakerIndex: 1,
        currentItemIndex: 0,
        isRecording: true,
      });

      rerender(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // Second speaker should now be active
      expect(screen.queryByText("첫 질문")).not.toBeInTheDocument();
      expect(screen.getByText("둘째 질문")).toBeInTheDocument();

      // First speaker should have checkmark
      const firstSpeaker = screen.getByText(/첫 번째 발표자/);
      expect(firstSpeaker.textContent).toContain("✓");
    });
  });

  describe("Accessibility", () => {
    it("uses semantic heading tags", () => {
      renderWithProviders(<QuestionTreePanel />);

      const heading = screen.getByText("진행 현황");
      expect(heading.tagName).toBe("H2");
    });

    it("uses semantic heading for speaker names", () => {
      const questionTree = createQuestionTree({
        speakers: [createSpeakerQuestions({ speakerName: "이상윤" })],
      });

      renderWithProviders(<QuestionTreePanel />, { questionTree });

      const speakerHeading = screen.getByText("이상윤");
      expect(speakerHeading.tagName).toBe("H3");
    });

    it("uses list elements for items", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            categories: [
              createQuestionCategory({
                items: [createQuestionItem({ text: "질문" })],
              }),
            ],
          }),
        ],
      });

      renderWithProviders(<QuestionTreePanel />, {
        questionTree,
        currentSpeakerIndex: 0,
      });

      const item = screen.getByText("질문").closest("li");
      expect(item).toBeInTheDocument();
      expect(item?.parentElement?.tagName).toBe("UL");
    });
  });

  describe("Real-world scenarios", () => {
    it("handles complete meeting flow for single speaker", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            speakerName: "이상윤",
            categories: [
              createQuestionCategory({
                name: "AI",
                items: [
                  createQuestionItem({ text: "AI 질문 1" }),
                  createQuestionItem({ text: "AI 질문 2" }),
                ],
              }),
            ],
          }),
        ],
      });

      const store = createTestStore({
        questionTree,
        currentItemIndex: 0,
      });

      const { rerender } = render(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // Start: first item is current
      expect(screen.getByText("1/2")).toBeInTheDocument();
      let firstItem = screen.getByText("AI 질문 1").closest("li");
      expect(firstItem).toHaveClass("text-primary");

      // Progress to second item
      store.set(orchestrationAtom, {
        ...store.get(orchestrationAtom),
        currentItemIndex: 1,
      });

      rerender(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      expect(screen.getByText("2/2")).toBeInTheDocument();
      firstItem = screen.getByText("AI 질문 1").closest("li");
      expect(firstItem).toHaveClass("line-through");

      const secondItem = screen.getByText("AI 질문 2").closest("li");
      expect(secondItem).toHaveClass("text-primary");
    });

    it("handles complete meeting flow with multiple speakers", () => {
      const questionTree = createQuestionTree({
        speakers: [
          createSpeakerQuestions({
            speakerName: "이상윤",
            categories: [
              createQuestionCategory({
                name: "AI",
                items: [createQuestionItem({ text: "이상윤 질문" })],
              }),
            ],
          }),
          createSpeakerQuestions({
            speakerName: "선설희",
            categories: [
              createQuestionCategory({
                name: "SDK",
                items: [createQuestionItem({ text: "선설희 질문" })],
              }),
            ],
          }),
        ],
      });

      const store = createTestStore({
        questionTree,
        currentSpeakerIndex: 0,
        currentItemIndex: 0,
      });

      const { rerender } = render(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // Start with first speaker
      expect(screen.getByText("이상윤 질문")).toBeInTheDocument();
      expect(screen.queryByText("선설희 질문")).not.toBeInTheDocument();

      // Complete first speaker, move to second
      store.set(orchestrationAtom, {
        ...store.get(orchestrationAtom),
        currentSpeakerIndex: 1,
        currentItemIndex: 0,
      });

      rerender(
        <Provider store={store}>
          <QuestionTreePanel />
        </Provider>,
      );

      // Second speaker should be active
      expect(screen.queryByText("이상윤 질문")).not.toBeInTheDocument();
      expect(screen.getByText("선설희 질문")).toBeInTheDocument();

      // First speaker should be marked completed
      const firstSpeaker = screen.getByText(/이상윤/);
      expect(firstSpeaker).toHaveClass("line-through");
      expect(firstSpeaker.textContent).toContain("✓");
    });
  });
});
