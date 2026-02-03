import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectedTeamIdAtom } from "@/atoms/team";

// Use vi.hoisted() for stable mock references
const mockPush = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockIsPending = vi.hoisted(() => ({ value: false }));

// Store callbacks globally to trigger them in tests
let capturedCallbacks: {
  onSuccess?: (data: { id: string }) => void;
  onError?: () => void;
} = {};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Orval hook
vi.mock("@/lib/api/__generated__/meetings/meetings", () => ({
  useCreateMeetingApiV1MeetingsPost: (opts?: {
    mutation?: { onSuccess?: (data: { id: string }) => void; onError?: () => void };
  }) => {
    // Capture callbacks for test control
    capturedCallbacks = opts?.mutation || {};
    return {
      mutate: mockMutate,
      isPending: mockIsPending.value,
    };
  },
}));

import NewMeetingPage from "../page";

const TEST_TEAM_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function renderWithProviders(ui: ReactNode, teamId: string | null = TEST_TEAM_ID) {
  const store = createStore();
  store.set(selectedTeamIdAtom, teamId);
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("NewMeetingPage", () => {
  beforeEach(() => {
    capturedCallbacks = {};
    mockIsPending.value = false;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders mode selection cards", () => {
    renderWithProviders(<NewMeetingPage />);
    expect(screen.getByText("녹음 파일 업로드")).toBeInTheDocument();
    expect(screen.getByText("실시간 회의")).toBeInTheDocument();
  });

  it("renders page title", () => {
    renderWithProviders(<NewMeetingPage />);
    expect(screen.getByText("새 회의 시작")).toBeInTheDocument();
    expect(screen.getByText("회의 방식을 선택하세요")).toBeInTheDocument();
  });

  it("renders meeting type selection cards", () => {
    renderWithProviders(<NewMeetingPage />);
    expect(screen.getByText("주간회의")).toBeInTheDocument();
    expect(screen.getByText("일반 회의")).toBeInTheDocument();
  });

  it("upload mode is selected by default", () => {
    renderWithProviders(<NewMeetingPage />);
    // Upload card should have ring-2 ring-primary class
    const uploadCard = screen.getByText("녹음 파일 업로드").closest("[class*='cursor-pointer']");
    expect(uploadCard?.className).toContain("ring-2");
  });

  it("weekly_report type is selected by default", () => {
    renderWithProviders(<NewMeetingPage />);
    const weeklyCard = screen.getByText("주간회의").closest("[class*='cursor-pointer']");
    expect(weeklyCard?.className).toContain("ring-2");
  });

  it("can select realtime mode", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const realtimeCard = screen.getByText("실시간 회의").closest("[class*='cursor-pointer']");
    await user.click(realtimeCard!);

    expect(realtimeCard?.className).toContain("ring-2");
  });

  it("can select general meeting type", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const generalCard = screen.getByText("일반 회의").closest("[class*='cursor-pointer']");
    await user.click(generalCard!);

    expect(generalCard?.className).toContain("ring-2");
  });

  it("shows next button", () => {
    renderWithProviders(<NewMeetingPage />);
    expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
  });

  it("calls mutate with selected team_id on next button click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          team_id: TEST_TEAM_ID,
          meeting_mode: "upload",
          meeting_type: "weekly_report",
        }),
      }),
    );
  });

  it("sends meeting_type: general when general is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const generalCard = screen.getByText("일반 회의").closest("[class*='cursor-pointer']");
    await user.click(generalCard!);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meeting_type: "general",
          title: expect.stringContaining("일반 회의"),
        }),
      }),
    );
  });

  it("displays upload mode features", () => {
    renderWithProviders(<NewMeetingPage />);
    expect(screen.getByText("- MP3, WAV, WebM, M4A 지원")).toBeInTheDocument();
    expect(screen.getByText("- 최대 100MB")).toBeInTheDocument();
  });

  it("displays realtime mode features", () => {
    renderWithProviders(<NewMeetingPage />);
    expect(screen.getByText("- 브라우저 녹음")).toBeInTheDocument();
    expect(screen.getByText("- 질문 트리 기반 진행")).toBeInTheDocument();
  });

  it("navigates to setup page on successful upload mode creation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    // Simulate successful API response
    capturedCallbacks.onSuccess?.({ id: "test-meeting-123" });

    expect(mockPush).toHaveBeenCalledWith("/meetings/test-meeting-123/setup");
  });

  it("navigates to live page on successful realtime mode creation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    // Select realtime mode
    const realtimeCard = screen.getByText("실시간 회의").closest("[class*='cursor-pointer']");
    await user.click(realtimeCard!);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    // Simulate successful API response
    capturedCallbacks.onSuccess?.({ id: "test-meeting-456" });

    expect(mockPush).toHaveBeenCalledWith("/meetings/test-meeting-456/live");
  });

  it("navigates to fallback page on creation error", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    // Simulate API error
    capturedCallbacks.onError?.();

    expect(mockPush).toHaveBeenCalledWith("/meetings/new-temp/setup");
  });

  it("can switch back to upload mode after selecting realtime", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    // Select realtime mode
    const realtimeCard = screen.getByText("실시간 회의").closest("[class*='cursor-pointer']");
    await user.click(realtimeCard!);

    // Switch back to upload mode
    const uploadCard = screen.getByText("녹음 파일 업로드").closest("[class*='cursor-pointer']");
    await user.click(uploadCard!);

    expect(uploadCard?.className).toContain("ring-2");
  });

  it("disables button and shows loading text when mutation is pending", () => {
    mockIsPending.value = true;
    renderWithProviders(<NewMeetingPage />);

    const nextButton = screen.getByRole("button", { name: "생성 중..." });
    expect(nextButton).toBeDisabled();
  });

  it("sends correct meeting_mode based on selection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    // Select realtime mode
    const realtimeCard = screen.getByText("실시간 회의").closest("[class*='cursor-pointer']");
    await user.click(realtimeCard!);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meeting_mode: "realtime",
        }),
      }),
    );
  });

  it("includes team_id and meeting_date in mutation data", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewMeetingPage />);

    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.click(nextButton);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          team_id: TEST_TEAM_ID,
          meeting_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          title: expect.stringContaining("주간회의"),
        }),
      }),
    );
  });

  describe("when no team is selected", () => {
    it("shows team selection warning", () => {
      renderWithProviders(<NewMeetingPage />, null);
      expect(screen.getByText(/팀을 먼저 선택해주세요/)).toBeInTheDocument();
    });

    it("disables next button", () => {
      renderWithProviders(<NewMeetingPage />, null);
      const nextButton = screen.getByRole("button", { name: "다음" });
      expect(nextButton).toBeDisabled();
    });

    it("does not call mutate when next is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewMeetingPage />, null);

      const nextButton = screen.getByRole("button", { name: "다음" });
      await user.click(nextButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("shows link to team selection page", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewMeetingPage />, null);

      const teamLink = screen.getByText("팀 선택하기");
      await user.click(teamLink);

      expect(mockPush).toHaveBeenCalledWith("/teams");
    });
  });
});
