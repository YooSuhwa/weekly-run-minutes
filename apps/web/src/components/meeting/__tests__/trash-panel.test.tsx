import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FilteredContentListResponse,
  FilteredContentResponse,
  FilterStatsResponse,
} from "@/lib/api/__generated__/schemas";

// Mock the API hooks
vi.mock("@/lib/api/__generated__/filters/filters", () => ({
  useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet: vi.fn(),
  useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet: vi.fn(),
  useRestoreFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdRestorePost: vi.fn(),
  useConfirmFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdConfirmPost: vi.fn(),
  useRestoreAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredRestoreAllPost: vi.fn(),
  useConfirmAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredConfirmAllPost: vi.fn(),
  getGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGetQueryKey: vi.fn(() => ["filtered"]),
  getGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGetQueryKey: vi.fn(() => ["stats"]),
}));

import {
  useConfirmAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredConfirmAllPost,
  useConfirmFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdConfirmPost,
  useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet,
  useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet,
  useRestoreAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredRestoreAllPost,
  useRestoreFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdRestorePost,
} from "@/lib/api/__generated__/filters/filters";
import { TrashPanel } from "../trash-panel";

// Factory functions for test data
function createFilteredContent(
  overrides: Partial<FilteredContentResponse> = {},
): FilteredContentResponse {
  return {
    id: `content-${Math.random().toString(36).slice(2)}`,
    meeting_id: "meeting-123",
    content: "테스트 잡담 내용입니다",
    filter_reason: "casual_talk",
    confidence: 0.85,
    is_restored: false,
    is_confirmed: false,
    speaker_label: "speaker_0",
    speaker_name: "이상윤",
    start_time: 10.5,
    end_time: 15.2,
    created_at: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

function createFilteredContentList(
  items: FilteredContentResponse[] = [],
  overrides: Partial<FilteredContentListResponse> = {},
): FilteredContentListResponse {
  const restoredCount = items.filter((i) => i.is_restored).length;
  const confirmedCount = items.filter((i) => i.is_confirmed).length;
  return {
    meeting_id: "meeting-123",
    items,
    total_count: items.length,
    restored_count: restoredCount,
    confirmed_count: confirmedCount,
    ...overrides,
  };
}

function createFilterStats(overrides: Partial<FilterStatsResponse> = {}): FilterStatsResponse {
  return {
    meeting_id: "meeting-123",
    total_filtered: 5,
    by_reason: { casual_talk: 3, off_topic: 2 },
    restored_count: 1,
    confirmed_count: 2,
    average_confidence: 0.78,
    ...overrides,
  };
}

// Test wrapper with query client
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode, queryClient?: QueryClient) {
  const client = queryClient || createQueryClient();
  return {
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
    queryClient: client,
  };
}

// Mutation mock factory
function createMutationMock(overrides = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
    ...overrides,
  };
}

describe("TrashPanel", () => {
  const mockRestoreMutation = createMutationMock();
  const mockConfirmMutation = createMutationMock();
  const mockRestoreAllMutation = createMutationMock();
  const mockConfirmAllMutation = createMutationMock();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mutation mocks
    mockRestoreMutation.mutate = vi.fn();
    mockRestoreMutation.isPending = false;
    mockRestoreMutation.variables = undefined;

    mockConfirmMutation.mutate = vi.fn();
    mockConfirmMutation.isPending = false;
    mockConfirmMutation.variables = undefined;

    mockRestoreAllMutation.mutate = vi.fn();
    mockRestoreAllMutation.isPending = false;

    mockConfirmAllMutation.mutate = vi.fn();
    mockConfirmAllMutation.isPending = false;

    // Default mock implementations
    vi.mocked(
      useRestoreFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdRestorePost,
    ).mockReturnValue(
      mockRestoreMutation as ReturnType<
        typeof useRestoreFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdRestorePost
      >,
    );
    vi.mocked(
      useConfirmFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdConfirmPost,
    ).mockReturnValue(
      mockConfirmMutation as ReturnType<
        typeof useConfirmFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdConfirmPost
      >,
    );
    vi.mocked(
      useRestoreAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredRestoreAllPost,
    ).mockReturnValue(
      mockRestoreAllMutation as ReturnType<
        typeof useRestoreAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredRestoreAllPost
      >,
    );
    vi.mocked(
      useConfirmAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredConfirmAllPost,
    ).mockReturnValue(
      mockConfirmAllMutation as ReturnType<
        typeof useConfirmAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredConfirmAllPost
      >,
    );
  });

  afterEach(() => {
    cleanup();
  });

  describe("Loading state", () => {
    it("renders loading state when content is loading", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      const { container } = renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("잡담 필터링")).toBeInTheDocument();
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("renders loading state when stats is loading", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([createFilteredContent()]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      const { container } = renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("renders error state when content fetch fails", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("필터링 데이터를 불러오는데 실패했습니다")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("renders empty state when no filtered items", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats({ total_filtered: 0, restored_count: 0, confirmed_count: 0 }),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("필터링된 내용이 없습니다")).toBeInTheDocument();
    });
  });

  describe("Header rendering", () => {
    beforeEach(() => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([createFilteredContent(), createFilteredContent()]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats({ total_filtered: 2, restored_count: 0, confirmed_count: 0 }),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);
    });

    it("renders header with title", () => {
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("잡담 필터링")).toBeInTheDocument();
    });

    it("displays item count badge in header", () => {
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      // The header badge shows item count from the items array
      const header = screen.getByText("잡담 필터링").parentElement;
      expect(header).toBeInTheDocument();
      expect(within(header!).getByText("2건")).toBeInTheDocument();
    });
  });

  describe("Stats display", () => {
    it("renders stats correctly", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([createFilteredContent()]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats({
          total_filtered: 10,
          restored_count: 3,
          confirmed_count: 5,
        }),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("10건")).toBeInTheDocument();
      expect(screen.getByText("3건")).toBeInTheDocument();
      expect(screen.getByText("5건")).toBeInTheDocument();
    });
  });

  describe("Filtered item rendering", () => {
    it("renders filtered content text", () => {
      const content = createFilteredContent({ content: "이건 잡담이에요" });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("이건 잡담이에요")).toBeInTheDocument();
    });

    it("renders filter reason badge", () => {
      const content = createFilteredContent({ filter_reason: "casual_talk" });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("잡담")).toBeInTheDocument();
    });

    it("renders confidence score", () => {
      const content = createFilteredContent({ confidence: 0.92 });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText(/신뢰도: 92%/)).toBeInTheDocument();
    });

    it("renders speaker name", () => {
      const content = createFilteredContent({ speaker_name: "선설희" });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("선설희")).toBeInTheDocument();
    });

    it("handles null confidence", () => {
      const content = createFilteredContent({ confidence: null });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      // Should not crash and not display confidence
      expect(screen.queryByText(/신뢰도:/)).not.toBeInTheDocument();
    });

    it("handles null speaker name", () => {
      const content = createFilteredContent({ speaker_name: null });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      // Should not crash
      expect(screen.getByText("테스트 잡담 내용입니다")).toBeInTheDocument();
    });
  });

  describe("Filter reason variants", () => {
    const testCases: Array<{ reason: string; label: string }> = [
      { reason: "casual_talk", label: "잡담" },
      { reason: "off_topic", label: "주제 이탈" },
      { reason: "filler", label: "필러 단어" },
      { reason: "duplicate", label: "중복" },
      { reason: "noise", label: "잡음" },
      { reason: "unknown", label: "기타" },
    ];

    testCases.forEach(({ reason, label }) => {
      it(`renders "${label}" for filter reason "${reason}"`, () => {
        const content = createFilteredContent({ filter_reason: reason });
        vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
          data: createFilteredContentList([content]),
          isLoading: false,
          error: null,
        } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
        vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
          data: createFilterStats(),
          isLoading: false,
        } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

        renderWithProviders(<TrashPanel meetingId="meeting-123" />);

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it("renders raw reason for unknown filter reasons", () => {
      const content = createFilteredContent({ filter_reason: "custom_reason" });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("custom_reason")).toBeInTheDocument();
    });
  });

  describe("Restored item rendering", () => {
    it("shows restored badge for restored items", () => {
      const content = createFilteredContent({ id: "restored-1", is_restored: true });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId("filtered-item-restored-1");
      // Badge text "복원됨" appears in restored badge
      expect(within(item).getAllByText("복원됨").length).toBeGreaterThanOrEqual(1);
    });

    it("disables restore button for already restored items", () => {
      const content = createFilteredContent({ id: "restored-1", is_restored: true });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId("filtered-item-restored-1");
      const restoreButton = within(item).getByRole("button", { name: /복원/ });
      expect(restoreButton).toBeDisabled();
    });
  });

  describe("Confirmed item rendering", () => {
    it("shows confirmed badge for confirmed items", () => {
      const content = createFilteredContent({ id: "confirmed-1", is_confirmed: true });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("확인됨")).toBeInTheDocument();
    });

    it("hides action buttons for confirmed items", () => {
      const content = createFilteredContent({ id: "confirmed-1", is_confirmed: true });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId("filtered-item-confirmed-1");
      // No action buttons for confirmed items
      expect(within(item).queryByRole("button", { name: /잡담 확인/ })).not.toBeInTheDocument();
    });
  });

  describe("Single item actions", () => {
    const contentId = "content-1";

    beforeEach(() => {
      const content = createFilteredContent({ id: contentId });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);
    });

    it("calls restore mutation when restore button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId(`filtered-item-${contentId}`);
      const restoreButton = within(item).getByRole("button", { name: /복원/ });
      await user.click(restoreButton);

      expect(mockRestoreMutation.mutate).toHaveBeenCalledWith({
        meetingId: "meeting-123",
        contentId,
      });
    });

    it("calls confirm mutation when confirm button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId(`filtered-item-${contentId}`);
      const confirmButton = within(item).getByRole("button", { name: /잡담 확인/ });
      await user.click(confirmButton);

      expect(mockConfirmMutation.mutate).toHaveBeenCalledWith({
        meetingId: "meeting-123",
        contentId,
      });
    });

    it("disables restore button during pending mutation for that item", () => {
      mockRestoreMutation.isPending = true;
      mockRestoreMutation.variables = { meetingId: "meeting-123", contentId };

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId(`filtered-item-${contentId}`);
      const restoreButton = within(item).getByRole("button", { name: /복원/ });
      expect(restoreButton).toBeDisabled();
    });

    it("disables confirm button during pending mutation for that item", () => {
      mockConfirmMutation.isPending = true;
      mockConfirmMutation.variables = { meetingId: "meeting-123", contentId };

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId(`filtered-item-${contentId}`);
      const confirmButton = within(item).getByRole("button", { name: /잡담 확인/ });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe("Bulk actions", () => {
    beforeEach(() => {
      const items = [
        createFilteredContent({ id: "content-1" }),
        createFilteredContent({ id: "content-2" }),
      ];
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList(items),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);
    });

    it("renders bulk action buttons when pending items exist", () => {
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByRole("button", { name: /전체 복원/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /전체 잡담 확인/ })).toBeInTheDocument();
    });

    it("hides bulk action buttons when all items are confirmed", () => {
      const items = [
        createFilteredContent({ id: "content-1", is_confirmed: true }),
        createFilteredContent({ id: "content-2", is_confirmed: true }),
      ];
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList(items),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.queryByRole("button", { name: /전체 복원/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /전체 잡담 확인/ })).not.toBeInTheDocument();
    });

    it("calls restore all mutation when restore all button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const restoreAllButton = screen.getByRole("button", { name: /전체 복원/ });
      await user.click(restoreAllButton);

      expect(mockRestoreAllMutation.mutate).toHaveBeenCalledWith({
        meetingId: "meeting-123",
      });
    });

    it("calls confirm all mutation when confirm all button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const confirmAllButton = screen.getByRole("button", { name: /전체 잡담 확인/ });
      await user.click(confirmAllButton);

      expect(mockConfirmAllMutation.mutate).toHaveBeenCalledWith({
        meetingId: "meeting-123",
      });
    });

    it("disables restore all button during pending mutation", () => {
      mockRestoreAllMutation.isPending = true;

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const restoreAllButton = screen.getByRole("button", { name: /전체 복원/ });
      expect(restoreAllButton).toBeDisabled();
    });

    it("disables confirm all button during pending mutation", () => {
      mockConfirmAllMutation.isPending = true;

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const confirmAllButton = screen.getByRole("button", { name: /전체 잡담 확인/ });
      expect(confirmAllButton).toBeDisabled();
    });
  });

  describe("Multiple items", () => {
    it("renders multiple filtered items", () => {
      const items = [
        createFilteredContent({ id: "1", content: "첫 번째 잡담" }),
        createFilteredContent({ id: "2", content: "두 번째 잡담" }),
        createFilteredContent({ id: "3", content: "세 번째 잡담" }),
      ];
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList(items),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats({ total_filtered: 3 }),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText("첫 번째 잡담")).toBeInTheDocument();
      expect(screen.getByText("두 번째 잡담")).toBeInTheDocument();
      expect(screen.getByText("세 번째 잡담")).toBeInTheDocument();
    });

    it("renders mixed state items correctly", () => {
      const items = [
        createFilteredContent({ id: "1", is_restored: true }),
        createFilteredContent({ id: "2", is_confirmed: true }),
        createFilteredContent({ id: "3", is_restored: false, is_confirmed: false }),
      ];
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList(items),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats({
          total_filtered: 3,
          restored_count: 1,
          confirmed_count: 1,
        }),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      // Should have 3 items rendered
      expect(screen.getByTestId("filtered-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("filtered-item-2")).toBeInTheDocument();
      expect(screen.getByTestId("filtered-item-3")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to card", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([createFilteredContent()]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      const { container } = renderWithProviders(
        <TrashPanel meetingId="meeting-123" className="my-custom-class" />,
      );

      expect(container.querySelector(".my-custom-class")).toBeInTheDocument();
    });

    it("applies custom className in loading state", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      const { container } = renderWithProviders(
        <TrashPanel meetingId="meeting-123" className="loading-class" />,
      );

      expect(container.querySelector(".loading-class")).toBeInTheDocument();
    });

    it("applies custom className in error state", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Error"),
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      const { container } = renderWithProviders(
        <TrashPanel meetingId="meeting-123" className="error-class" />,
      );

      expect(container.querySelector(".error-class")).toBeInTheDocument();
    });

    it("applies custom className in empty state", () => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      const { container } = renderWithProviders(
        <TrashPanel meetingId="meeting-123" className="empty-class" />,
      );

      expect(container.querySelector(".empty-class")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles very long content text", () => {
      const longContent = "이것은 아주 긴 잡담입니다. ".repeat(10);
      const content = createFilteredContent({ id: "long-content", content: longContent });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      // Check the item exists with long content
      const item = screen.getByTestId("filtered-item-long-content");
      expect(item).toBeInTheDocument();
      expect(item.textContent).toContain("이것은 아주 긴 잡담입니다.");
    });

    it("handles special characters in content", () => {
      const content = createFilteredContent({
        content: '특수문자 <script>alert("xss")</script> & " \'',
      });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText('특수문자 <script>alert("xss")</script> & " \'')).toBeInTheDocument();
    });

    it("handles zero confidence", () => {
      const content = createFilteredContent({ confidence: 0 });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText(/신뢰도: 0%/)).toBeInTheDocument();
    });

    it("handles confidence of 1 (100%)", () => {
      const content = createFilteredContent({ confidence: 1 });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByText(/신뢰도: 100%/)).toBeInTheDocument();
    });

    it("handles empty speaker name string", () => {
      const content = createFilteredContent({ id: "empty-speaker", speaker_name: "" });
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([content]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);

      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      // Should not crash and should not display empty string as speaker
      expect(screen.getByTestId("filtered-item-empty-speaker")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet).mockReturnValue({
        data: createFilteredContentList([createFilteredContent({ id: "access-test" })]),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet>);
      vi.mocked(useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet).mockReturnValue({
        data: createFilterStats(),
        isLoading: false,
      } as ReturnType<typeof useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet>);
    });

    it("has accessible button labels for item actions", () => {
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      const item = screen.getByTestId("filtered-item-access-test");
      expect(within(item).getByRole("button", { name: /복원/ })).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: /잡담 확인/ })).toBeInTheDocument();
    });

    it("has accessible bulk action button labels", () => {
      renderWithProviders(<TrashPanel meetingId="meeting-123" />);

      expect(screen.getByRole("button", { name: /전체 복원/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /전체 잡담 확인/ })).toBeInTheDocument();
    });
  });
});
