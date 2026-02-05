import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectedTeamIdAtom } from "@/atoms/team";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
vi.mock("@/components/ui/toast", () => ({
  useToast: () => mockToast,
}));

// Mock QueryClient
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

// Mock Weeky component
vi.mock("@/components/weeky/weeky", () => ({
  Weeky: ({ message }: { message?: string }) => <div data-testid="weeky">{message}</div>,
}));

// Mock the Orval-generated hooks
const mockUseListTeams = vi.fn();
const mockAuthenticateMutation = {
  mutate: vi.fn(),
  isPending: false,
};
const mockCreateMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};
const mockUpdateMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};
const mockDeleteMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
};
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: () => mockUseListTeams(),
  getListTeamsApiV1TeamsGetQueryKey: () => ["teams"],
  useAuthenticateTeamApiV1TeamsTeamIdAuthPost: (options: {
    mutation: { onSuccess: (data: unknown) => void; onError: () => void };
  }) => {
    (mockAuthenticateMutation as Record<string, unknown>).onSuccess = options?.mutation?.onSuccess;
    (mockAuthenticateMutation as Record<string, unknown>).onError = options?.mutation?.onError;
    return mockAuthenticateMutation;
  },
  useCreateTeamApiV1TeamsPost: () => mockCreateMutation,
  useUpdateTeamApiV1TeamsTeamIdPut: () => mockUpdateMutation,
  useDeleteTeamApiV1TeamsTeamIdDelete: () => mockDeleteMutation,
}));

import TeamsPage from "../page";

function renderWithProviders(ui: ReactNode, initialTeamId: string | null = null) {
  const store = createStore();
  if (initialTeamId) {
    store.set(selectedTeamIdAtom, initialTeamId);
  }
  return {
    store,
    ...render(<Provider store={store}>{ui}</Provider>),
  };
}

describe("TeamsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateMutation.isPending = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe("Loading state", () => {
    it("shows loading state", () => {
      mockUseListTeams.mockReturnValue({ data: undefined, isLoading: true, error: null });
      renderWithProviders(<TeamsPage />);
      // Weeky shows loading message
      expect(screen.getByTestId("weeky")).toHaveTextContent("팀 목록을 불러오고 있어요...");
    });
  });

  describe("Error state", () => {
    it("shows error state", () => {
      mockUseListTeams.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      });
      renderWithProviders(<TeamsPage />);
      // Weeky shows error message
      expect(screen.getByTestId("weeky")).toHaveTextContent("팀 목록을 불러오는데 실패했어요");
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no teams", () => {
      mockUseListTeams.mockReturnValue({ data: [], isLoading: false, error: null });
      renderWithProviders(<TeamsPage />);
      expect(screen.getByText("등록된 팀이 없습니다")).toBeInTheDocument();
    });
  });

  describe("Team list", () => {
    const mockTeams = [
      {
        id: "team-1",
        name: "Product Tech Team",
        has_password: false,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
      {
        id: "team-2",
        name: "Design Team",
        has_password: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseListTeams.mockReturnValue({ data: mockTeams, isLoading: false, error: null });
    });

    it("renders team cards when teams exist", () => {
      renderWithProviders(<TeamsPage />);
      expect(screen.getByText("Product Tech Team")).toBeInTheDocument();
      expect(screen.getByText("Design Team")).toBeInTheDocument();
    });

    it("renders header with title", () => {
      renderWithProviders(<TeamsPage />);
      expect(screen.getByText("팀 선택")).toBeInTheDocument();
      expect(screen.getByText("회의를 진행할 팀을 선택해주세요")).toBeInTheDocument();
    });

    it("renders team cards with correct test ids", () => {
      renderWithProviders(<TeamsPage />);
      expect(screen.getByTestId("team-card-team-1")).toBeInTheDocument();
      expect(screen.getByTestId("team-card-team-2")).toBeInTheDocument();
    });

    it("shows creation date for each team", () => {
      renderWithProviders(<TeamsPage />);
      const dateElements = screen.getAllByText(/생성일:/);
      expect(dateElements).toHaveLength(2);
    });
  });

  describe("Password dialog", () => {
    const mockTeams = [
      {
        id: "team-1",
        name: "Product Tech Team",
        has_password: true,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseListTeams.mockReturnValue({ data: mockTeams, isLoading: false, error: null });
    });

    it("opens password dialog on team click when team has password", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));

      // Check dialog content is shown
      expect(screen.getByText(/팀에 접근하려면 비밀번호를 입력해주세요/)).toBeInTheDocument();
      expect(screen.getByTestId("password-input")).toBeInTheDocument();
    });

    it("enables submit button when password is entered", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));

      const submitButton = screen.getByTestId("submit-password");
      expect(submitButton).toBeDisabled();

      await user.type(screen.getByTestId("password-input"), "secret123");
      expect(submitButton).not.toBeDisabled();
    });

    it("closes dialog when clicking cancel button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      expect(screen.getByText(/팀에 접근하려면 비밀번호를 입력해주세요/)).toBeInTheDocument();

      // Click the cancel button
      const cancelButton = screen.getByRole("button", { name: /취소/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByText(/팀에 접근하려면 비밀번호를 입력해주세요/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Team authentication", () => {
    const mockTeams = [
      {
        id: "team-1",
        name: "Product Tech Team",
        has_password: true,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseListTeams.mockReturnValue({ data: mockTeams, isLoading: false, error: null });
    });

    it("calls authenticate mutation with correct data on password submit", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "secret123");
      await user.click(screen.getByTestId("submit-password"));

      expect(mockAuthenticateMutation.mutate).toHaveBeenCalledWith({
        teamId: "team-1",
        data: { password: "secret123" },
      });
    });

    it("navigates to dashboard on successful authentication", async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "secret123");
      await user.click(screen.getByTestId("submit-password"));

      // Simulate successful authentication
      const onSuccess = (
        mockAuthenticateMutation as unknown as Record<string, (data: unknown) => void>
      ).onSuccess;
      onSuccess({ team_id: "team-1", team_name: "Product Tech Team" });

      expect(store.get(selectedTeamIdAtom)).toBe("team-1");
      expect(mockToast.success).toHaveBeenCalledWith("Product Tech Team 팀이 선택되었습니다");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("shows error message on authentication failure", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "wrongpassword");
      await user.click(screen.getByTestId("submit-password"));

      // Simulate authentication failure
      const onError = (mockAuthenticateMutation as unknown as Record<string, () => void>).onError;
      onError();

      await waitFor(() => {
        expect(screen.getByTestId("auth-error")).toHaveTextContent("비밀번호가 올바르지 않습니다");
      });
    });

    it("shows loading state while authenticating", async () => {
      const user = userEvent.setup();
      mockAuthenticateMutation.isPending = true;

      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "secret123");

      expect(screen.getByTestId("submit-password")).toHaveTextContent("확인 중...");
    });
  });

  describe("Direct selection (no password)", () => {
    const mockTeams = [
      {
        id: "team-1",
        name: "Product Tech Team",
        has_password: false,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseListTeams.mockReturnValue({ data: mockTeams, isLoading: false, error: null });
    });

    it("navigates to dashboard directly when team has no password", async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));

      // No password dialog, directly selected
      expect(store.get(selectedTeamIdAtom)).toBe("team-1");
      expect(mockToast.success).toHaveBeenCalledWith("Product Tech Team 팀이 선택되었습니다");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("Password form submission", () => {
    const mockTeams = [
      {
        id: "team-1",
        name: "Product Tech Team",
        has_password: true,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseListTeams.mockReturnValue({ data: mockTeams, isLoading: false, error: null });
    });

    it("submits form on Enter key press", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "secret123{enter}");

      expect(mockAuthenticateMutation.mutate).toHaveBeenCalled();
    });

    it("trims password before submission", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "  secret123  ");
      await user.click(screen.getByTestId("submit-password"));

      expect(mockAuthenticateMutation.mutate).toHaveBeenCalledWith({
        teamId: "team-1",
        data: { password: "secret123" },
      });
    });

    it("does not submit when password is empty or whitespace only", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "   ");

      const submitButton = screen.getByTestId("submit-password");
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Dialog state management", () => {
    const mockTeams = [
      {
        id: "team-1",
        name: "Product Tech Team",
        has_password: true,
        created_at: "2024-01-15T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      },
      {
        id: "team-2",
        name: "Design Team",
        has_password: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseListTeams.mockReturnValue({ data: mockTeams, isLoading: false, error: null });
    });

    it("clears password input when dialog is closed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "secret123");

      // Close dialog
      await user.click(screen.getByRole("button", { name: /취소/i }));

      // Open dialog again with different team
      await user.click(screen.getByTestId("team-card-team-2"));

      expect(screen.getByTestId("password-input")).toHaveValue("");
    });

    it("clears error message when dialog is closed and reopened", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-1"));
      await user.type(screen.getByTestId("password-input"), "wrongpassword");
      await user.click(screen.getByTestId("submit-password"));

      // Simulate authentication failure
      const onError = (mockAuthenticateMutation as unknown as Record<string, () => void>).onError;
      onError();

      await waitFor(() => {
        expect(screen.getByTestId("auth-error")).toBeInTheDocument();
      });

      // Close dialog
      await user.click(screen.getByRole("button", { name: /취소/i }));

      // Open dialog again
      await user.click(screen.getByTestId("team-card-team-2"));

      expect(screen.queryByTestId("auth-error")).not.toBeInTheDocument();
    });

    it("shows correct team name in dialog title", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamsPage />);

      await user.click(screen.getByTestId("team-card-team-2"));

      // The dialog title shows team name - there are 2 elements: card title and dialog title
      const teamNameElements = screen.getAllByText("Design Team");
      expect(teamNameElements.length).toBeGreaterThanOrEqual(2);
    });
  });
});
