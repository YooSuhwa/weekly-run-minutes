import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to ensure stable references are available in hoisted vi.mock
const {
  mockTeamsList,
  mockTeamData,
  mockLoadWeeklyReportMutate,
  mockUploadRecordingMutate,
  mockStartTranscriptionMutate,
  mockRouterPush,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockTeamsList: [{ id: "team-1", name: "Product Team" }],
  mockTeamData: {
    id: "team-1",
    name: "Product Team",
    members: [
      { id: "m1", name: "Lee", presentation_order: 1, is_active: true, team_id: "team-1" },
      { id: "m2", name: "Sun", presentation_order: 2, is_active: true, team_id: "team-1" },
      { id: "m3", name: "Choi", presentation_order: 3, is_active: true, team_id: "team-1" },
    ],
  },
  mockLoadWeeklyReportMutate: vi.fn(),
  mockUploadRecordingMutate: vi.fn(),
  mockStartTranscriptionMutate: vi.fn(),
  mockRouterPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "meeting-123" }),
  useRouter: () => ({ push: mockRouterPush }),
}));

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

// Mock teams API
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: () => ({ data: mockTeamsList }),
  useGetTeamApiV1TeamsTeamIdGet: () => ({ data: mockTeamData }),
}));

// Track mutation callbacks for testing success/error paths
let loadWeeklyReportCallbacks: {
  onSuccess?: () => void;
  onError?: () => void;
} = {};
let uploadRecordingCallbacks: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
} = {};
let startTranscriptionCallbacks: {
  onSuccess?: () => void;
  onError?: () => void;
  onSettled?: () => void;
} = {};

// Mock weekly reports API
vi.mock("@/lib/api/__generated__/weekly-reports/weekly-reports", () => ({
  useLoadWeeklyReportForMeetingApiV1WeeklyReportsMeetingsMeetingIdWeeklyReportPost: (config: {
    mutation?: { onSuccess?: () => void; onError?: () => void };
  }) => {
    loadWeeklyReportCallbacks = config?.mutation ?? {};
    return {
      mutate: mockLoadWeeklyReportMutate,
      isPending: false,
    };
  },
}));

// Mock recordings API
vi.mock("@/lib/api/__generated__/recordings/recordings", () => ({
  useUploadRecordingApiV1RecordingsMeetingsMeetingIdRecordingPost: (config: {
    mutation?: { onSuccess?: () => void; onError?: (error: unknown) => void };
  }) => {
    uploadRecordingCallbacks = config?.mutation ?? {};
    return {
      mutate: mockUploadRecordingMutate,
    };
  },
}));

// Mock transcription API
vi.mock("@/lib/api/__generated__/transcription/transcription", () => ({
  useStartTranscriptionApiV1TranscriptionMeetingsMeetingIdTranscribePost: (config: {
    mutation?: { onSuccess?: () => void; onError?: () => void; onSettled?: () => void };
  }) => {
    startTranscriptionCallbacks = config?.mutation ?? {};
    return {
      mutate: mockStartTranscriptionMutate,
    };
  },
}));

// Mock FileUpload component
vi.mock("@/components/ui/file-upload", () => ({
  FileUpload: ({
    file,
    onFileSelect,
    onFileRemove,
    disabled,
  }: {
    file: File | null;
    onFileSelect: (file: File) => void;
    onFileRemove: () => void;
    disabled?: boolean;
  }) => (
    <div data-testid="file-upload">
      {file ? (
        <div data-testid="file-selected">
          <span data-testid="file-name">{file.name}</span>
          <button
            type="button"
            onClick={onFileRemove}
            disabled={disabled}
            data-testid="remove-file-btn"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onFileSelect(new File(["test"], "test.mp3", { type: "audio/mpeg" }))}
          disabled={disabled}
          data-testid="select-file-btn"
        >
          Select File
        </button>
      )}
    </div>
  ),
}));

// Mock ProgressBar component
vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ value, label }: { value: number; label: string }) => (
    <div data-testid="progress-bar" data-value={value}>
      {label}: {value}%
    </div>
  ),
}));

import MeetingSetupPage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("MeetingSetupPage", () => {
  beforeEach(() => {
    // Reset callback references before each test
    loadWeeklyReportCallbacks = {};
    uploadRecordingCallbacks = {};
    startTranscriptionCallbacks = {};
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders page title and subtitle", () => {
      renderWithProviders(<MeetingSetupPage />);
      expect(screen.getByText("회의 설정")).toBeInTheDocument();
      expect(screen.getByText("녹음 파일을 업로드하고 설정을 완료하세요")).toBeInTheDocument();
    });

    it("renders weekly report section with Confluence input", () => {
      renderWithProviders(<MeetingSetupPage />);
      expect(screen.getByText("주간업무록 (선택)")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Confluence 페이지 ID 입력")).toBeInTheDocument();
      expect(screen.getByText("불러오기")).toBeInTheDocument();
    });

    it("renders attendees section", () => {
      renderWithProviders(<MeetingSetupPage />);
      expect(screen.getByText("참석자")).toBeInTheDocument();
    });

    it("renders file upload section", () => {
      renderWithProviders(<MeetingSetupPage />);
      expect(screen.getByText("녹음 파일")).toBeInTheDocument();
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    it("renders start button (disabled without file)", () => {
      renderWithProviders(<MeetingSetupPage />);
      const startButton = screen.getByText("회의록 생성 시작");
      expect(startButton).toBeInTheDocument();
      expect(startButton).toBeDisabled();
    });
  });

  describe("Attendee Selection", () => {
    it("renders all team members as selectable buttons", () => {
      renderWithProviders(<MeetingSetupPage />);
      expect(screen.getByText("Lee")).toBeInTheDocument();
      expect(screen.getByText("Sun")).toBeInTheDocument();
      expect(screen.getByText("Choi")).toBeInTheDocument();
    });

    it("toggles member selection on click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      const leeButton = screen.getByText("Lee");

      // Initially selected (all members selected by default based on useEffect)
      // Click to deselect
      await user.click(leeButton);

      // Click again to reselect
      await user.click(leeButton);
    });
  });

  describe("Confluence Integration", () => {
    it("disables load button when input is empty", () => {
      renderWithProviders(<MeetingSetupPage />);
      const loadButton = screen.getByText("불러오기");
      expect(loadButton).toBeDisabled();
    });

    it("enables load button when page ID is entered", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      const input = screen.getByPlaceholderText("Confluence 페이지 ID 입력");
      await user.type(input, "12345678");

      const loadButton = screen.getByText("불러오기");
      expect(loadButton).not.toBeDisabled();
    });

    it("calls loadWeeklyReport mutation when load is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      const input = screen.getByPlaceholderText("Confluence 페이지 ID 입력");
      await user.type(input, "12345678");

      const loadButton = screen.getByText("불러오기");
      await user.click(loadButton);

      expect(mockLoadWeeklyReportMutate).toHaveBeenCalledWith({
        meetingId: "meeting-123",
        data: { confluence_page_id: "12345678" },
      });
    });

    it("shows success toast on successful load", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      const input = screen.getByPlaceholderText("Confluence 페이지 ID 입력");
      await user.type(input, "12345678");
      await user.click(screen.getByText("불러오기"));

      // Simulate success callback
      loadWeeklyReportCallbacks.onSuccess?.();

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("주간업무록을 불러왔습니다");
      });
    });

    it("shows error toast on load failure", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      const input = screen.getByPlaceholderText("Confluence 페이지 ID 입력");
      await user.type(input, "12345678");
      await user.click(screen.getByText("불러오기"));

      // Simulate error callback
      loadWeeklyReportCallbacks.onError?.();

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("주간업무록 로드에 실패했습니다");
      });
    });
  });

  describe("File Upload Integration", () => {
    it("enables start button when file is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      // Select a file
      await user.click(screen.getByTestId("select-file-btn"));

      const startButton = screen.getByText("회의록 생성 시작");
      expect(startButton).not.toBeDisabled();
    });

    it("shows file name after selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));

      expect(screen.getByTestId("file-name")).toHaveTextContent("test.mp3");
    });

    it("disables start button after file is removed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      // Select file
      await user.click(screen.getByTestId("select-file-btn"));
      expect(screen.getByText("회의록 생성 시작")).not.toBeDisabled();

      // Remove file
      await user.click(screen.getByTestId("remove-file-btn"));

      expect(screen.getByText("회의록 생성 시작")).toBeDisabled();
    });
  });

  describe("Processing Flow", () => {
    it("start button is disabled without file", () => {
      renderWithProviders(<MeetingSetupPage />);

      const startButton = screen.getByText("회의록 생성 시작");
      expect(startButton).toBeDisabled();
    });

    it("calls uploadRecording mutation when start is clicked with file", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      // Select file
      await user.click(screen.getByTestId("select-file-btn"));

      // Click start
      await user.click(screen.getByText("회의록 생성 시작"));

      expect(mockUploadRecordingMutate).toHaveBeenCalledWith({
        meetingId: "meeting-123",
        data: { file: expect.any(File) },
      });
    });

    it("shows uploading button text while uploading", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      expect(screen.getByText("업로드 중...")).toBeInTheDocument();
    });

    it("shows success toast and starts transcription on upload success", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      // Simulate upload success
      uploadRecordingCallbacks.onSuccess?.();

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("파일 업로드 완료");
      });
      expect(mockStartTranscriptionMutate).toHaveBeenCalledWith({ meetingId: "meeting-123" });
    });

    it("navigates to processing page on transcription success", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      // Simulate transcription success
      startTranscriptionCallbacks.onSuccess?.();

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/meetings/meeting-123/processing");
      });
    });

    it("navigates to processing page even on transcription error", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      // Simulate transcription error (still navigates - processing page handles polling)
      startTranscriptionCallbacks.onError?.();

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith("/meetings/meeting-123/processing");
      });
    });

    it("shows error toast on upload failure with detail", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      // Simulate upload error with detail
      uploadRecordingCallbacks.onError?.({ detail: "파일 크기 초과" });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("파일 크기 초과");
      });
    });

    it("shows default error message when error has no detail", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      // Simulate upload error without detail
      uploadRecordingCallbacks.onError?.({});

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("업로드 실패");
      });
    });

    it("resets uploading state on transcription settled", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      await user.click(screen.getByTestId("select-file-btn"));
      await user.click(screen.getByText("회의록 생성 시작"));

      // Verify uploading state
      expect(screen.getByText("업로드 중...")).toBeInTheDocument();

      // Simulate onSettled callback
      startTranscriptionCallbacks.onSettled?.();

      // After onSettled, the button should reset to normal state
      await waitFor(() => {
        expect(screen.queryByText("업로드 중...")).not.toBeInTheDocument();
      });
    });
  });

  describe("Weekly Report Loaded State", () => {
    it("disables input and shows success message after weekly report is loaded", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MeetingSetupPage />);

      const input = screen.getByPlaceholderText("Confluence 페이지 ID 입력");
      await user.type(input, "12345678");
      await user.click(screen.getByText("불러오기"));

      // Simulate success
      loadWeeklyReportCallbacks.onSuccess?.();

      // After success, the input should be disabled and success message shown
      await waitFor(() => {
        expect(input).toBeDisabled();
      });
      expect(screen.getByText("주간업무록이 연결되었습니다")).toBeInTheDocument();
    });
  });
});
