import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to ensure stable references are available in hoisted vi.mock
const {
  mockStartMeeting,
  mockNextItem,
  mockNextSpeaker,
  mockEndMeeting,
  mockStartRecording,
  mockStopRecording,
  mockRouterPush,
  mockUploadRecording,
  mockToast,
} = vi.hoisted(() => ({
  mockStartMeeting: vi.fn().mockResolvedValue(undefined),
  mockNextItem: vi.fn().mockResolvedValue(undefined),
  mockNextSpeaker: vi.fn().mockResolvedValue(undefined),
  mockEndMeeting: vi.fn().mockResolvedValue(undefined),
  mockStartRecording: vi.fn().mockResolvedValue(undefined),
  mockStopRecording: vi.fn().mockReturnValue(new Blob(["test"], { type: "audio/webm" })),
  mockRouterPush: vi.fn(),
  mockUploadRecording: vi.fn().mockResolvedValue(undefined),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-meeting-id" }),
  useRouter: () => ({ push: mockRouterPush }),
}));

// Mock the orchestration hook
vi.mock("@/hooks/use-meeting-orchestration", () => ({
  useMeetingOrchestration: () => ({
    startMeeting: mockStartMeeting,
    nextItem: mockNextItem,
    nextSpeaker: mockNextSpeaker,
    endMeeting: mockEndMeeting,
  }),
}));

// Mock the media recorder hook
vi.mock("@/hooks/use-media-recorder", () => ({
  useMediaRecorder: () => ({
    status: "recording",
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    duration: 125,
    error: null,
  }),
}));

// Mock the keyboard shortcuts hook
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// Mock Weeky component
vi.mock("@/components/weeky/weeky", () => ({
  Weeky: ({ expression, message }: { expression: string; message: string }) => (
    <div data-testid="weeky" data-expression={expression} data-message={message}>
      {message}
    </div>
  ),
}));

// Mock QuestionTreePanel
vi.mock("@/components/meeting/question-tree-panel", () => ({
  QuestionTreePanel: () => <div data-testid="question-tree-panel">Question Tree</div>,
}));

// Mock upload recording API
vi.mock("@/lib/api/__generated__/recordings/recordings", () => ({
  uploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost: mockUploadRecording,
}));

// Mock useToast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => mockToast,
}));

import {
  type OrchestrationState,
  orchestrationAtom,
  type QuestionTree,
} from "@/atoms/orchestration";
import LiveMeetingPage from "../page";

const mockQuestionTree: QuestionTree = {
  speakers: [
    {
      speakerName: "이상윤",
      categories: [
        {
          name: "AI",
          items: [
            { text: "첫 번째 질문", hint: "힌트 1", status: "pending" },
            { text: "두 번째 질문", hint: null, status: "pending" },
          ],
        },
      ],
    },
    {
      speakerName: "선설희",
      categories: [
        {
          name: "SDK",
          items: [{ text: "SDK 질문", hint: "SDK 힌트", status: "pending" }],
        },
      ],
    },
  ],
};

function createTestStore(initialState?: Partial<OrchestrationState>) {
  const store = createStore();
  const defaultState: OrchestrationState = {
    phase: "in_progress",
    questionTree: mockQuestionTree,
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

describe("LiveMeetingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Initial Rendering", () => {
    it("renders the main layout with question tree panel", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByTestId("question-tree-panel")).toBeInTheDocument();
    });

    it("renders Weeky component with correct expression", () => {
      renderWithProviders(<LiveMeetingPage />);
      const weeky = screen.getByTestId("weeky");
      expect(weeky).toBeInTheDocument();
      expect(weeky.getAttribute("data-expression")).toBe("questioning");
    });

    it("displays current question text", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText("첫 번째 질문")).toBeInTheDocument();
    });

    it("displays hint when available", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText(/Hint: 힌트 1/)).toBeInTheDocument();
    });

    it("displays current speaker name", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText("이상윤")).toBeInTheDocument();
    });

    it("displays item progress (1 / 2)", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });
  });

  describe("Recording Indicator", () => {
    it("shows recording indicator when recording", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText(/녹음 중/)).toBeInTheDocument();
    });

    it("displays formatted duration", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText(/2:05/)).toBeInTheDocument();
    });
  });

  describe("Navigation Buttons", () => {
    it("renders next item button", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByRole("button", { name: "다음 항목 (Space)" })).toBeInTheDocument();
    });

    it("renders next speaker button", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByRole("button", { name: "다음 발표자 (Enter)" })).toBeInTheDocument();
    });

    it("renders end meeting button", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByRole("button", { name: "종료 (Esc)" })).toBeInTheDocument();
    });

    it("disables buttons when phase is not in_progress", () => {
      renderWithProviders(<LiveMeetingPage />, { phase: "ended" });
      const nextItemBtn = screen.getByRole("button", { name: "다음 항목 (Space)" });
      const nextSpeakerBtn = screen.getByRole("button", { name: "다음 발표자 (Enter)" });
      const endBtn = screen.getByRole("button", { name: "종료 (Esc)" });

      expect(nextItemBtn).toBeDisabled();
      expect(nextSpeakerBtn).toBeDisabled();
      expect(endBtn).toBeDisabled();
    });

    it("calls nextItem when next item button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "다음 항목 (Space)" }));
      expect(mockNextItem).toHaveBeenCalledWith("test-meeting-id");
    });

    it("calls nextSpeaker when next speaker button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "다음 발표자 (Enter)" }));
      expect(mockNextSpeaker).toHaveBeenCalledWith("test-meeting-id");
    });
  });

  describe("End Meeting Confirmation Dialog", () => {
    it("shows confirmation dialog when end button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));
      expect(screen.getByText("회의를 종료하시겠어요?")).toBeInTheDocument();
    });

    it("displays warning message in dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));
      expect(screen.getByText("녹음이 중단되고 STT 처리를 시작합니다.")).toBeInTheDocument();
    });

    it("shows cancel button in dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));
      expect(screen.getByText("취소")).toBeInTheDocument();
    });

    it("closes dialog when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));
      expect(screen.getByText("회의를 종료하시겠어요?")).toBeInTheDocument();

      await user.click(screen.getByText("취소"));
      expect(screen.queryByText("회의를 종료하시겠어요?")).not.toBeInTheDocument();
    });

    it("calls endMeeting and uploads recording when confirmed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

      // Click the confirm button in dialog (exact match "종료")
      const confirmButton = screen.getByRole("button", { name: /^종료$/ });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalled();
        expect(mockEndMeeting).toHaveBeenCalledWith("test-meeting-id");
      });
    });

    it("navigates to processing page after ending meeting", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

      // Click the confirm button in dialog (exact match "종료")
      const confirmButton = screen.getByRole("button", { name: /^종료$/ });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/meetings/test-meeting-id/processing");
      });
    });
  });

  describe("Keyboard Hints", () => {
    it("displays keyboard shortcut hints", () => {
      renderWithProviders(<LiveMeetingPage />);
      expect(screen.getByText(/Space: 다음 항목/)).toBeInTheDocument();
      expect(screen.getByText(/Enter: 다음 발표자/)).toBeInTheDocument();
      expect(screen.getByText(/Esc: 종료/)).toBeInTheDocument();
    });
  });

  describe("Weeky Expression States", () => {
    it("shows questioning expression when current item exists", () => {
      renderWithProviders(<LiveMeetingPage />);
      const weeky = screen.getByTestId("weeky");
      expect(weeky.getAttribute("data-expression")).toBe("questioning");
    });

    it("shows listening expression when speaker but no item", () => {
      renderWithProviders(<LiveMeetingPage />, {
        currentItemIndex: 99, // Beyond available items
      });
      const weeky = screen.getByTestId("weeky");
      expect(weeky.getAttribute("data-expression")).toBe("listening");
    });

    it("shows done expression when phase is ended", () => {
      renderWithProviders(<LiveMeetingPage />, { phase: "ended" });
      const weeky = screen.getByTestId("weeky");
      expect(weeky.getAttribute("data-expression")).toBe("done");
    });
  });

  describe("Weeky Messages", () => {
    it("shows current question text as message", () => {
      renderWithProviders(<LiveMeetingPage />);
      const weeky = screen.getByTestId("weeky");
      expect(weeky.getAttribute("data-message")).toBe("첫 번째 질문");
    });

    it("shows ended message when phase is ended", () => {
      renderWithProviders(<LiveMeetingPage />, { phase: "ended" });
      const weeky = screen.getByTestId("weeky");
      expect(weeky.getAttribute("data-message")).toBe("회의가 종료되었어요!");
    });
  });

  describe("Navigation Logic", () => {
    it("calls nextSpeaker when at last item of speaker", async () => {
      const user = userEvent.setup();
      // Set currentItemIndex to 1 (second and last item for first speaker)
      renderWithProviders(<LiveMeetingPage />, { currentItemIndex: 1 });

      await user.click(screen.getByRole("button", { name: "다음 항목 (Space)" }));
      expect(mockNextSpeaker).toHaveBeenCalledWith("test-meeting-id");
    });

    it("calls nextItem when not at last item", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />, { currentItemIndex: 0 });

      await user.click(screen.getByRole("button", { name: "다음 항목 (Space)" }));
      expect(mockNextItem).toHaveBeenCalledWith("test-meeting-id");
    });
  });

  describe("No Hint Display", () => {
    it("does not show hint section when hint is null", () => {
      renderWithProviders(<LiveMeetingPage />, { currentItemIndex: 1 });
      expect(screen.queryByText(/Hint:/)).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles end meeting error gracefully", async () => {
      mockEndMeeting.mockRejectedValueOnce(new Error("Network error"));

      const user = userEvent.setup();
      renderWithProviders(<LiveMeetingPage />);

      await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

      // Click the confirm button in dialog (exact match "종료")
      const confirmButton = screen.getByRole("button", { name: /^종료$/ });
      await user.click(confirmButton);

      // Should not navigate on error
      await waitFor(() => {
        expect(mockRouterPush).not.toHaveBeenCalled();
      });
    });
  });

  describe("Multiple Speakers", () => {
    it("displays second speaker info when navigated", () => {
      renderWithProviders(<LiveMeetingPage />, {
        currentSpeakerIndex: 1,
        currentItemIndex: 0,
      });
      expect(screen.getByText("선설희")).toBeInTheDocument();
      expect(screen.getByText("SDK 질문")).toBeInTheDocument();
    });

    it("shows correct item count for second speaker", () => {
      renderWithProviders(<LiveMeetingPage />, {
        currentSpeakerIndex: 1,
        currentItemIndex: 0,
      });
      expect(screen.getByText("1 / 1")).toBeInTheDocument();
    });
  });
});

describe("LiveMeetingPage - Idle Phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state during meeting initialization", async () => {
    // Create a store with idle phase to trigger initialization
    const store = createStore();
    store.set(orchestrationAtom, {
      phase: "idle",
      questionTree: null,
      currentSpeakerIndex: 0,
      currentItemIndex: 0,
      isRecording: false,
    });

    render(
      <Provider store={store}>
        <LiveMeetingPage />
      </Provider>,
    );

    // During initialization, it should show the loading/thinking state
    const weeky = screen.getByTestId("weeky");
    expect(weeky.getAttribute("data-expression")).toBe("thinking");
    expect(weeky.getAttribute("data-message")).toBe("회의를 준비하고 있어요...");
  });

  it("calls startMeeting and startRecording on mount when idle", async () => {
    const store = createStore();
    store.set(orchestrationAtom, {
      phase: "idle",
      questionTree: null,
      currentSpeakerIndex: 0,
      currentItemIndex: 0,
      isRecording: false,
    });

    render(
      <Provider store={store}>
        <LiveMeetingPage />
      </Provider>,
    );

    await waitFor(() => {
      expect(mockStartMeeting).toHaveBeenCalledWith("test-meeting-id");
      expect(mockStartRecording).toHaveBeenCalled();
    });
  });
});

describe("LiveMeetingPage - No Question Tree", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows greeting expression when no current speaker", () => {
    renderWithProviders(<LiveMeetingPage />, {
      questionTree: null,
    });

    const weeky = screen.getByTestId("weeky");
    expect(weeky.getAttribute("data-expression")).toBe("greeting");
  });

  it("does not display speaker info when no question tree", () => {
    renderWithProviders(<LiveMeetingPage />, {
      questionTree: null,
    });

    expect(screen.queryByText("이상윤")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });
});

describe("LiveMeetingPage - Keyboard Event Integration", () => {
  afterEach(() => {
    cleanup();
  });

  it("receives keyboard shortcuts configuration", async () => {
    const { useKeyboardShortcuts } = await import("@/hooks/use-keyboard-shortcuts");
    renderWithProviders(<LiveMeetingPage />);

    expect(useKeyboardShortcuts).toHaveBeenCalled();
    const callArgs = vi.mocked(useKeyboardShortcuts).mock.calls[0][0];

    expect(callArgs.shortcuts).toHaveLength(5);
    expect(callArgs.shortcuts.map((s) => s.key)).toContain("Space");
    expect(callArgs.shortcuts.map((s) => s.key)).toContain("Enter");
    expect(callArgs.shortcuts.map((s) => s.key)).toContain("Escape");
    expect(callArgs.shortcuts.map((s) => s.key)).toContain("ArrowRight");
    expect(callArgs.shortcuts.map((s) => s.key)).toContain("ArrowLeft");
  });

  it("disables keyboard shortcuts when end confirm dialog is shown", async () => {
    const { useKeyboardShortcuts } = await import("@/hooks/use-keyboard-shortcuts");
    const user = userEvent.setup();

    renderWithProviders(<LiveMeetingPage />);

    // Open the end confirm dialog
    await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

    // Check the last call to useKeyboardShortcuts
    const lastCallArgs = vi.mocked(useKeyboardShortcuts).mock.calls.at(-1)?.[0];
    expect(lastCallArgs?.enabled).toBe(false);
  });
});

describe("LiveMeetingPage - Upload Recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("uploads recording blob with correct parameters", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LiveMeetingPage />);

    await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

    // Click the confirm button in dialog (exact match "종료")
    const confirmButton = screen.getByRole("button", { name: /^종료$/ });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockUploadRecording).toHaveBeenCalledWith("test-meeting-id", {
        file: expect.any(Blob),
        source: "browser",
      });
    });
  });

  it("does not upload when stopRecording returns null", async () => {
    mockStopRecording.mockReturnValueOnce(null);

    const user = userEvent.setup();
    renderWithProviders(<LiveMeetingPage />);

    await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

    // Click the confirm button in dialog (exact match "종료")
    const confirmButton = screen.getByRole("button", { name: /^종료$/ });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockEndMeeting).toHaveBeenCalled();
    });

    expect(mockUploadRecording).not.toHaveBeenCalled();
  });

  it("shows error dialog when upload fails after all retries", async () => {
    mockUploadRecording.mockRejectedValue(new Error("Upload failed"));

    const user = userEvent.setup();
    renderWithProviders(<LiveMeetingPage />);

    await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

    const confirmButton = screen.getByRole("button", { name: /^종료$/ });
    await user.click(confirmButton);

    // Wait for retries and error dialog
    await waitFor(
      () => {
        expect(screen.getByText("업로드 실패")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText("건너뛰기")).toBeInTheDocument();
    expect(screen.getByText("재시도")).toBeInTheDocument();
  });

  it("navigates to processing page when skip is clicked after upload error", async () => {
    mockUploadRecording.mockRejectedValue(new Error("Upload failed"));

    const user = userEvent.setup();
    renderWithProviders(<LiveMeetingPage />);

    await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

    const confirmButton = screen.getByRole("button", { name: /^종료$/ });
    await user.click(confirmButton);

    // Wait for error dialog
    await waitFor(
      () => {
        expect(screen.getByText("업로드 실패")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click skip
    await user.click(screen.getByText("건너뛰기"));

    expect(mockRouterPush).toHaveBeenCalledWith("/meetings/test-meeting-id/processing");
  });

  it("retries upload when retry button is clicked", async () => {
    // First call fails, second succeeds
    mockUploadRecording.mockRejectedValueOnce(new Error("Upload failed"));
    mockUploadRecording.mockRejectedValueOnce(new Error("Upload failed"));
    mockUploadRecording.mockRejectedValueOnce(new Error("Upload failed"));
    mockUploadRecording.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderWithProviders(<LiveMeetingPage />);

    await user.click(screen.getByRole("button", { name: "종료 (Esc)" }));

    const confirmButton = screen.getByRole("button", { name: /^종료$/ });
    await user.click(confirmButton);

    // Wait for error dialog
    await waitFor(
      () => {
        expect(screen.getByText("업로드 실패")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click retry
    await user.click(screen.getByText("재시도"));

    // Should navigate after successful retry
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/meetings/test-meeting-id/processing");
    });
  });
});
