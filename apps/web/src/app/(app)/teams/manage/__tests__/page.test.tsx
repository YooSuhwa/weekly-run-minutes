import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks
const {
  mockToastSuccess,
  mockToastError,
  mockTeamsList,
  mockTeamDetails,
  mockUseListTeams,
  mockUseGetTeam,
  mockUseCreateTeam,
  mockUseUpdateTeam,
  mockUseDeleteTeam,
  mockInvalidateQueries,
} = vi.hoisted(() => {
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockInvalidateQueries = vi.fn();

  const mockTeamsList = [
    {
      id: "t1",
      name: "제품기술팀",
      created_at: "2024-01-15T09:00:00Z",
      updated_at: "2024-01-15T09:00:00Z",
    },
    {
      id: "t2",
      name: "디자인팀",
      created_at: "2024-01-10T09:00:00Z",
      updated_at: "2024-01-10T09:00:00Z",
    },
  ];

  const mockTeamDetails = {
    id: "t1",
    name: "제품기술팀",
    confluence_base_url: "https://example.atlassian.net/wiki",
    confluence_space_key: "PROD",
    has_password: true,
    members: [],
    created_at: "2024-01-15T09:00:00Z",
    updated_at: "2024-01-15T09:00:00Z",
  };

  const mockUseListTeams = vi.fn(() => ({ data: mockTeamsList, isLoading: false }));
  const mockUseGetTeam = vi.fn(() => ({ data: mockTeamDetails }));
  const mockUseCreateTeam = vi.fn((options) => ({
    mutate: (params: any) => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess({ id: "new-team", ...params.data });
      }
    },
    isPending: false,
  }));
  const mockUseUpdateTeam = vi.fn((options) => ({
    mutate: (params: any) => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess({ id: params.teamId, ...params.data });
      }
    },
    isPending: false,
  }));
  const mockUseDeleteTeam = vi.fn((options) => ({
    mutate: (params: any) => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess();
      }
    },
    isPending: false,
  }));

  return {
    mockToastSuccess,
    mockToastError,
    mockTeamsList,
    mockTeamDetails,
    mockUseListTeams,
    mockUseGetTeam,
    mockUseCreateTeam,
    mockUseUpdateTeam,
    mockUseDeleteTeam,
    mockInvalidateQueries,
  };
});

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

// Mock API hooks
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: mockUseListTeams,
  useGetTeamApiV1TeamsTeamIdGet: mockUseGetTeam,
  useCreateTeamApiV1TeamsPost: mockUseCreateTeam,
  useUpdateTeamApiV1TeamsTeamIdPut: mockUseUpdateTeam,
  useDeleteTeamApiV1TeamsTeamIdDelete: mockUseDeleteTeam,
  getListTeamsApiV1TeamsGetQueryKey: () => ["/api/v1/teams"],
}));

// Mock useQueryClient
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

import TeamManagePage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>{ui}</Provider>
    </QueryClientProvider>,
  );
}

describe("TeamManagePage", () => {
  beforeEach(() => {
    mockUseListTeams.mockReturnValue({ data: mockTeamsList, isLoading: false });
    mockUseGetTeam.mockReturnValue({ data: mockTeamDetails });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders page title", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("팀 관리")).toBeInTheDocument();
    });

    it("renders page description", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("팀을 생성하고 관리하세요")).toBeInTheDocument();
    });

    it("renders create team button", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("새 팀 만들기")).toBeInTheDocument();
    });

    it("renders team list card", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("팀 목록")).toBeInTheDocument();
    });

    it("displays team count", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("등록된 팀 2개")).toBeInTheDocument();
    });

    it("renders teams in table", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("제품기술팀")).toBeInTheDocument();
      expect(screen.getByText("디자인팀")).toBeInTheDocument();
    });

    it("renders table headers", () => {
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("팀 이름")).toBeInTheDocument();
      expect(screen.getByText("생성일")).toBeInTheDocument();
      expect(screen.getByText("액션")).toBeInTheDocument();
    });

    it("renders edit buttons for each team", () => {
      renderWithProviders(<TeamManagePage />);
      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      expect(editButtons).toHaveLength(2);
    });

    it("renders delete buttons for each team", () => {
      renderWithProviders(<TeamManagePage />);
      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      expect(deleteButtons).toHaveLength(2);
    });
  });

  describe("Loading State", () => {
    it("shows loading text when teams are loading", () => {
      mockUseListTeams.mockReturnValueOnce({ data: undefined, isLoading: true });
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no teams exist", () => {
      mockUseListTeams.mockReturnValueOnce({ data: [], isLoading: false });
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("등록된 팀이 없습니다")).toBeInTheDocument();
    });

    it("shows create team link in empty state", () => {
      mockUseListTeams.mockReturnValueOnce({ data: [], isLoading: false });
      renderWithProviders(<TeamManagePage />);
      expect(screen.getByText("첫 번째 팀 만들기")).toBeInTheDocument();
    });

    it("opens create dialog from empty state link", async () => {
      const user = userEvent.setup();
      mockUseListTeams.mockReturnValue({ data: [], isLoading: false });
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("첫 번째 팀 만들기"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("새로운 팀을 생성합니다")).toBeInTheDocument();
      });
    });
  });

  describe("Create Team Dialog", () => {
    it("opens create dialog on button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("새로운 팀을 생성합니다")).toBeInTheDocument();
    });

    it("renders all form fields in create dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      expect(screen.getByLabelText("팀 이름 *")).toBeInTheDocument();
      expect(screen.getByLabelText("비밀번호 (선택)")).toBeInTheDocument();
      expect(screen.getByLabelText("Confluence Base URL (선택)")).toBeInTheDocument();
      expect(screen.getByLabelText("Confluence Space Key (선택)")).toBeInTheDocument();
    });

    it("closes create dialog on cancel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));
      await user.click(screen.getByText("취소"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("closes create dialog on close button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("creates team successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      const nameInput = screen.getByLabelText("팀 이름 *");
      await user.type(nameInput, "새팀");

      const passwordInput = screen.getByLabelText("비밀번호 (선택)");
      await user.type(passwordInput, "secret123");

      const urlInput = screen.getByLabelText("Confluence Base URL (선택)");
      await user.type(urlInput, "https://test.atlassian.net/wiki");

      const spaceInput = screen.getByLabelText("Confluence Space Key (선택)");
      await user.type(spaceInput, "TEST");

      // Click the create button in the dialog footer
      const dialog = screen.getByRole("dialog");
      const createButton = within(dialog).getByText("생성");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("팀이 생성되었습니다");
      });
    });

    it("shows error when team name is empty", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      const dialog = screen.getByRole("dialog");
      const createButton = within(dialog).getByText("생성");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("팀 이름을 입력해주세요");
      });
    });

    it("trims whitespace from team name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      const nameInput = screen.getByLabelText("팀 이름 *");
      await user.type(nameInput, "  새팀  ");

      const dialog = screen.getByRole("dialog");
      const createButton = within(dialog).getByText("생성");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("팀이 생성되었습니다");
      });
    });

    it("handles create team error", async () => {
      const user = userEvent.setup();

      // Save original implementation
      const originalImpl = mockUseCreateTeam.getMockImplementation();

      mockUseCreateTeam.mockImplementation((options) => ({
        mutate: () => {
          if (options?.mutation?.onError) {
            options.mutation.onError();
          }
        },
        isPending: false,
      }));

      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      const nameInput = screen.getByLabelText("팀 이름 *");
      await user.type(nameInput, "새팀");

      const dialog = screen.getByRole("dialog");
      const createButton = within(dialog).getByText("생성");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("팀 생성에 실패했습니다");
      });

      // Restore original implementation
      if (originalImpl) {
        mockUseCreateTeam.mockImplementation(originalImpl);
      }
    });

    it("invalidates queries after successful create", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      const nameInput = screen.getByLabelText("팀 이름 *");
      await user.type(nameInput, "새팀");

      const dialog = screen.getByRole("dialog");
      const createButton = within(dialog).getByText("생성");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ["/api/v1/teams"],
        });
      });
    });
  });

  describe("Edit Team Dialog", () => {
    it("opens edit dialog on edit button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("팀 수정")).toBeInTheDocument();
      });
    });

    it("pre-fills team name in edit dialog", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        const nameInput = screen.getByLabelText("팀 이름 *") as HTMLInputElement;
        expect(nameInput.value).toBe("제품기술팀");
      });
    });

    it("closes edit dialog on cancel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByText("취소"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("updates team successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText("팀 이름 *");
      await user.clear(nameInput);
      await user.type(nameInput, "수정된 팀");

      const dialog = screen.getByRole("dialog");
      const updateButton = within(dialog).getByText("수정");
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("팀이 수정되었습니다");
      });
    });

    it("shows error when editing with empty name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText("팀 이름 *");
      await user.clear(nameInput);

      const dialog = screen.getByRole("dialog");
      const updateButton = within(dialog).getByText("수정");
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("팀 이름을 입력해주세요");
      });
    });

    it("handles update team error", async () => {
      const user = userEvent.setup();

      // Save original implementation
      const originalImpl = mockUseUpdateTeam.getMockImplementation();

      mockUseUpdateTeam.mockImplementation((options) => ({
        mutate: () => {
          if (options?.mutation?.onError) {
            options.mutation.onError();
          }
        },
        isPending: false,
      }));

      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog");
      const updateButton = within(dialog).getByText("수정");
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("팀 수정에 실패했습니다");
      });

      // Restore original implementation
      if (originalImpl) {
        mockUseUpdateTeam.mockImplementation(originalImpl);
      }
    });
  });

  describe("Delete Team Dialog", () => {
    it("opens delete dialog on delete button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("팀 삭제")).toBeInTheDocument();
      });
    });

    it("shows team name in delete confirmation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText("제품기술팀")).toBeInTheDocument();
        expect(screen.getByText(/이 작업은 되돌릴 수 없습니다/)).toBeInTheDocument();
      });
    });

    it("closes delete dialog on cancel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByText("취소"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("deletes team successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog");
      const confirmDeleteButton = within(dialog).getByRole("button", { name: "삭제" });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("팀이 삭제되었습니다");
      });
    });

    it("handles delete team error", async () => {
      const user = userEvent.setup();

      // Save original implementation
      const originalImpl = mockUseDeleteTeam.getMockImplementation();

      mockUseDeleteTeam.mockImplementation((options) => ({
        mutate: () => {
          if (options?.mutation?.onError) {
            options.mutation.onError();
          }
        },
        isPending: false,
      }));

      renderWithProviders(<TeamManagePage />);

      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog");
      const confirmDeleteButton = within(dialog).getByRole("button", { name: "삭제" });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("팀 삭제에 실패했습니다");
      });

      // Restore original implementation
      if (originalImpl) {
        mockUseDeleteTeam.mockImplementation(originalImpl);
      }
    });
  });

  describe("Keyboard Navigation", () => {
    it("closes dialog on Escape key", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Pending States", () => {
    it("shows pending state during team creation", async () => {
      const user = userEvent.setup();

      mockUseCreateTeam.mockImplementation(() => ({
        mutate: vi.fn(),
        isPending: true,
      }));

      renderWithProviders(<TeamManagePage />);

      await user.click(screen.getByText("새 팀 만들기"));

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        const createButton = within(dialog).getByText("생성 중...");
        expect(createButton).toBeDisabled();
      });
    });

    it("shows pending state during team update", async () => {
      const user = userEvent.setup();

      mockUseUpdateTeam.mockImplementation(() => ({
        mutate: vi.fn(),
        isPending: true,
      }));

      renderWithProviders(<TeamManagePage />);

      const editButtons = screen.getAllByRole("button", { name: /수정/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        const updateButton = within(dialog).getByText("수정 중...");
        expect(updateButton).toBeDisabled();
      });
    });

    it("shows pending state during team deletion", async () => {
      const user = userEvent.setup();

      mockUseDeleteTeam.mockImplementation(() => ({
        mutate: vi.fn(),
        isPending: true,
      }));

      renderWithProviders(<TeamManagePage />);

      const deleteButtons = screen.getAllByRole("button", { name: /삭제/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        const deleteButton = within(dialog).getByText("삭제 중...");
        expect(deleteButton).toBeDisabled();
      });
    });
  });

  describe("Date Formatting", () => {
    it("displays formatted creation date", () => {
      renderWithProviders(<TeamManagePage />);
      // formatDate returns Korean date format
      expect(screen.getByText(/2024년 1월 15일/)).toBeInTheDocument();
      expect(screen.getByText(/2024년 1월 10일/)).toBeInTheDocument();
    });
  });
});
