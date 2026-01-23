import { cleanup, render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-meeting-id" }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock heavy components to reduce memory
vi.mock("@/components/weeky/weeky", () => ({
  Weeky: ({ expression }: { expression: string }) => (
    <div data-testid="weeky" data-expression={expression} />
  ),
}));

vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ value }: { value: number }) => (
    <div role="progressbar" aria-valuenow={value} />
  ),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api/__generated__/meetings/meetings", () => ({
  useGetMeetingProgressApiV1MeetingsMeetingIdProgressGet: () => ({ data: undefined }),
}));

import ProcessingPage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("ProcessingPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders 3 processing steps", () => {
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByText("음성 인식")).toBeInTheDocument();
    expect(screen.getByText("용어 교정")).toBeInTheDocument();
    expect(screen.getByText("문서 정리")).toBeInTheDocument();
  });

  it("shows thinking expression initially", () => {
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByTestId("weeky").getAttribute("data-expression")).toBe("thinking");
  });

  it("shows step descriptions", () => {
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByText("녹음 파일에서 음성을 텍스트로 변환 중")).toBeInTheDocument();
  });

  it("renders progress bar", () => {
    renderWithProviders(<ProcessingPage />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
