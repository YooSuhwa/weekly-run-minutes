import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock functions
const mockPush = vi.fn();
const mockSuccessToast = vi.fn();
const mockErrorToast = vi.fn();
const mockUseProgress = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-meeting-id" }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock heavy components to reduce memory
vi.mock("@/components/weeky/weeky", () => ({
  Weeky: ({ expression, message }: { expression: string; message?: string }) => (
    <div data-testid="weeky" data-expression={expression} data-message={message} />
  ),
}));

vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ value }: { value: number }) => (
    <div role="progressbar" aria-valuenow={value} />
  ),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    success: mockSuccessToast,
    error: mockErrorToast,
  }),
}));

vi.mock("@/lib/api/__generated__/meetings/meetings", () => ({
  useGetMeetingProgressApiV1MeetingsMeetingIdProgressGet: () => mockUseProgress(),
}));

import ProcessingPage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("ProcessingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders 3 processing steps", () => {
    mockUseProgress.mockReturnValue({ data: undefined });
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByText("음성 인식")).toBeInTheDocument();
    expect(screen.getByText("용어 교정")).toBeInTheDocument();
    expect(screen.getByText("문서 정리")).toBeInTheDocument();
  });

  it("shows thinking expression initially", () => {
    mockUseProgress.mockReturnValue({ data: undefined });
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByTestId("weeky").getAttribute("data-expression")).toBe("thinking");
  });

  it("shows step descriptions", () => {
    mockUseProgress.mockReturnValue({ data: undefined });
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByText("녹음 파일에서 음성을 텍스트로 변환 중")).toBeInTheDocument();
  });

  it("renders progress bar", () => {
    mockUseProgress.mockReturnValue({ data: undefined });
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  describe("Status transitions", () => {
    it("updates to voice step when status is transcribing", async () => {
      mockUseProgress.mockReturnValue({
        data: { status: "transcribing" },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("33");
      });
    });

    it("updates to terminology step when status is transcribed", async () => {
      mockUseProgress.mockReturnValue({
        data: {
          status: "transcribed",
          segments_count: 42,
        },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("66");
      });
    });

    it("handles transcribed status with missing segments_count", async () => {
      mockUseProgress.mockReturnValue({
        data: {
          status: "transcribed",
        },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("66");
      });
    });

    it("updates to formatting step when status is generating_minutes", async () => {
      mockUseProgress.mockReturnValue({
        data: { status: "generating_minutes" },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("80");
      });
    });

    it("shows completion when status is draft_ready", async () => {
      vi.useFakeTimers();

      mockUseProgress.mockReturnValue({
        data: { status: "draft_ready" },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const weeky = screen.getByTestId("weeky");
        expect(weeky.getAttribute("data-expression")).toBe("done");
        expect(weeky.getAttribute("data-message")).toBe("회의록이 준비되었어요!");
      });

      await waitFor(() => {
        expect(mockSuccessToast).toHaveBeenCalledWith("회의록 생성이 완료되었습니다!");
      });

      // Fast-forward 1500ms to trigger navigation
      vi.advanceTimersByTime(1500);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/meetings/test-meeting-id/minutes");
      });

      vi.useRealTimers();
    });

    it("handles failure with error message", async () => {
      mockUseProgress.mockReturnValue({
        data: {
          status: "failed",
          error_message: "STT 처리 실패",
        },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const weeky = screen.getByTestId("weeky");
        expect(weeky.getAttribute("data-expression")).toBe("sorry");
        expect(weeky.getAttribute("data-message")).toBe("STT 처리 실패");
      });

      await waitFor(() => {
        expect(mockErrorToast).toHaveBeenCalledWith("STT 처리 실패");
      });
    });

    it("handles failure without error message", async () => {
      mockUseProgress.mockReturnValue({
        data: {
          status: "failed",
        },
      });

      renderWithProviders(<ProcessingPage />);

      await waitFor(() => {
        const weeky = screen.getByTestId("weeky");
        expect(weeky.getAttribute("data-expression")).toBe("sorry");
        expect(weeky.getAttribute("data-message")).toBe("처리 중 오류가 발생했습니다");
      });

      await waitFor(() => {
        expect(mockErrorToast).toHaveBeenCalledWith("처리 실패");
      });
    });

    it("ignores progress updates after completion", async () => {
      vi.useFakeTimers();

      mockUseProgress.mockReturnValue({
        data: { status: "draft_ready" },
      });

      const { rerender } = renderWithProviders(<ProcessingPage />);

      // Wait for initial completion
      await waitFor(() => {
        expect(mockSuccessToast).toHaveBeenCalledWith("회의록 생성이 완료되었습니다!");
      });

      // Update mock to return different status
      mockUseProgress.mockReturnValue({
        data: { status: "transcribing" },
      });

      // Force re-render
      rerender(
        <Provider store={createStore()}>
          <ProcessingPage />
        </Provider>
      );

      // Progress should remain at 100, not reset to 33
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar.getAttribute("aria-valuenow")).toBe("100");

      vi.useRealTimers();
    });
  });

  describe("Edge cases", () => {
    it("handles undefined progressData gracefully", () => {
      mockUseProgress.mockReturnValue({ data: undefined });

      renderWithProviders(<ProcessingPage />);

      expect(screen.getByTestId("weeky").getAttribute("data-expression")).toBe("thinking");
    });

    it("handles null progressData gracefully", () => {
      mockUseProgress.mockReturnValue({ data: null });

      renderWithProviders(<ProcessingPage />);

      expect(screen.getByTestId("weeky").getAttribute("data-expression")).toBe("thinking");
    });

    it("handles unknown status gracefully", async () => {
      mockUseProgress.mockReturnValue({
        data: { status: "unknown_status" },
      });

      renderWithProviders(<ProcessingPage />);

      // Should remain in initial processing state
      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("10");
      });
    });
  });
});
