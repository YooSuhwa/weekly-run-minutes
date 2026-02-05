import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href} data-testid="card-link">
      {children}
    </a>
  ),
}));

// Mock the Orval-generated hooks
vi.mock("@/lib/api/__generated__/meetings/meetings", () => ({
  getListMeetingsApiV1MeetingsGetQueryKey: vi.fn(() => ["meetings"]),
  useDeleteMeetingApiV1MeetingsMeetingIdDelete: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useUpdateMeetingApiV1MeetingsMeetingIdPut: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Mock useToast
vi.mock("@/components/ui/toast", () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
  })),
}));

import { MeetingCard } from "../meeting-card";

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const jotaiStore = createStore();
  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={jotaiStore}>{ui}</JotaiProvider>
    </QueryClientProvider>
  );
}

describe("MeetingCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders meeting title", () => {
    const meeting = {
      id: "test-1",
      title: "1/15 주간회의",
      meeting_date: "2024-01-15",
      status: "created" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByText("1/15 주간회의")).toBeInTheDocument();
  });

  it("shows correct status label for draft_ready", () => {
    const meeting = {
      id: "test-2",
      title: "회의",
      meeting_date: "2024-01-15",
      status: "draft_ready" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByText("초안 완료")).toBeInTheDocument();
  });

  it("shows correct status label for transcribing", () => {
    const meeting = {
      id: "test-3",
      title: "회의",
      meeting_date: "2024-01-15",
      status: "transcribing" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByText("STT 처리 중")).toBeInTheDocument();
  });

  it("shows correct status label for failed", () => {
    const meeting = {
      id: "test-4",
      title: "실패 회의",
      meeting_date: "2024-01-15",
      status: "failed" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByText("실패")).toBeInTheDocument();
  });

  it("links to setup page for created status", () => {
    const meeting = {
      id: "abc",
      title: "회의",
      meeting_date: "2024-01-15",
      status: "created" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByTestId("card-link").getAttribute("href")).toBe("/meetings/abc/setup");
  });

  it("links to processing page for transcribing status", () => {
    const meeting = {
      id: "def",
      title: "회의",
      meeting_date: "2024-01-15",
      status: "transcribing" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByTestId("card-link").getAttribute("href")).toBe("/meetings/def/processing");
  });

  it("links to minutes page for draft_ready status", () => {
    const meeting = {
      id: "ghi",
      title: "회의",
      meeting_date: "2024-01-15",
      status: "draft_ready" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByTestId("card-link").getAttribute("href")).toBe("/meetings/ghi/minutes");
  });

  it("links to live page for in_progress status", () => {
    const meeting = {
      id: "jkl",
      title: "회의",
      meeting_date: "2024-01-15",
      status: "in_progress" as const,
      team_id: "t1",
      meeting_mode: "realtime" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByTestId("card-link").getAttribute("href")).toBe("/meetings/jkl/live");
  });

  it("shows published status label", () => {
    const meeting = {
      id: "mno",
      title: "게시된 회의",
      meeting_date: "2024-01-15",
      status: "published" as const,
      team_id: "t1",
      meeting_mode: "upload" as const,
    };
    renderWithProviders(<MeetingCard meeting={meeting} />);
    expect(screen.getByText("게시 완료")).toBeInTheDocument();
  });
});
