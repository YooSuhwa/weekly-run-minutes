import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the Orval-generated hook
const mockUseListMeetings = vi.fn();
vi.mock("@/lib/api/__generated__/meetings/meetings", () => ({
  useListMeetingsApiV1MeetingsGet: () => mockUseListMeetings(),
}));

// Mock MeetingCard to isolate dashboard logic
vi.mock("../meeting-card", () => ({
  MeetingCard: ({ meeting }: { meeting: { id: string; title: string } }) => (
    <div data-testid={`meeting-card-${meeting.id}`}>{meeting.title}</div>
  ),
}));

import DashboardPage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockUseListMeetings.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseListMeetings.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("회의 목록을 불러오는데 실패했습니다")).toBeInTheDocument();
  });

  it("shows empty state when no meetings", () => {
    mockUseListMeetings.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("아직 회의가 없습니다")).toBeInTheDocument();
    expect(screen.getByText("첫 회의 시작하기")).toBeInTheDocument();
  });

  it("renders meeting cards when meetings exist", () => {
    const meetings = [
      { id: "1", title: "1/15 주간회의", meeting_date: "2024-01-15", status: "draft_ready" },
      { id: "2", title: "1/22 주간회의", meeting_date: "2024-01-22", status: "created" },
    ];
    mockUseListMeetings.mockReturnValue({ data: meetings, isLoading: false, error: null });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByTestId("meeting-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("meeting-card-2")).toBeInTheDocument();
  });

  it("renders header with title and new meeting button", () => {
    mockUseListMeetings.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("새 회의")).toBeInTheDocument();
  });

  it("links new meeting button to /meetings/new", () => {
    mockUseListMeetings.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<DashboardPage />);
    const links = screen.getAllByRole("link");
    const newMeetingLink = links.find((l) => l.getAttribute("href") === "/meetings/new");
    expect(newMeetingLink).toBeDefined();
  });
});
