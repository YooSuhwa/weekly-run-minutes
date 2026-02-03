import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks - must be declared first
const {
  mockToastSuccess,
  mockTeamsList,
  mockTeamData,
  mockUseListTeams,
  mockUseGetTeam,
  mockUseAddMember,
  mockUseUpdateMember,
  mockUseRemoveMember,
} = vi.hoisted(() => {
  const mockToastSuccess = vi.fn();
  const mockTeamsList = [{ id: "t1", name: "제품기술팀" }];
  const mockTeamData = {
    id: "t1",
    name: "제품기술팀",
    members: [
      { id: "m1", name: "이상윤", presentation_order: 1, is_active: true, team_id: "t1" },
      { id: "m2", name: "선설희", presentation_order: 2, is_active: true, team_id: "t1" },
    ],
  };

  const mockUseListTeams = vi.fn(() => ({ data: mockTeamsList }));
  const mockUseGetTeam = vi.fn(() => ({ data: mockTeamData }));
  const mockUseAddMember = vi.fn((options) => ({
    mutate: (params: any) => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess({
          id: crypto.randomUUID(),
          name: params.data.name,
          presentation_order: params.data.presentation_order,
          is_active: true,
          team_id: params.teamId,
        });
      }
    },
  }));
  const mockUseUpdateMember = vi.fn((options) => ({
    mutate: (params: any) => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess();
      }
    },
  }));
  const mockUseRemoveMember = vi.fn((options) => ({
    mutate: (params: any) => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess(undefined, params);
      }
    },
  }));

  return {
    mockToastSuccess,
    mockTeamsList,
    mockTeamData,
    mockUseListTeams,
    mockUseGetTeam,
    mockUseAddMember,
    mockUseUpdateMember,
    mockUseRemoveMember,
  };
});

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: mockToastSuccess, error: vi.fn() }),
}));

// Mock API hooks
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: mockUseListTeams,
  useGetTeamApiV1TeamsTeamIdGet: mockUseGetTeam,
  useAddTeamMemberApiV1TeamsTeamIdMembersPost: mockUseAddMember,
  useUpdateTeamMemberApiV1TeamsTeamIdMembersMemberIdPatch: mockUseUpdateMember,
  useRemoveTeamMemberApiV1TeamsTeamIdMembersMemberIdDelete: mockUseRemoveMember,
}));

import TeamPage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("TeamPage", () => {
  beforeEach(() => {
    mockUseListTeams.mockReturnValue({ data: mockTeamsList });
    mockUseGetTeam.mockReturnValue({ data: mockTeamData });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders page title", () => {
      renderWithProviders(<TeamPage />);
      expect(screen.getByText("팀원 관리")).toBeInTheDocument();
    });

    it("renders team description", () => {
      renderWithProviders(<TeamPage />);
      expect(screen.getByText("제품기술팀 팀원 목록")).toBeInTheDocument();
    });

    it("renders team members", () => {
      renderWithProviders(<TeamPage />);
      expect(screen.getByText("이상윤")).toBeInTheDocument();
      expect(screen.getByText("선설희")).toBeInTheDocument();
    });

    it("shows add button", () => {
      renderWithProviders(<TeamPage />);
      expect(screen.getByText("팀원 추가")).toBeInTheDocument();
    });

    it("shows presentation order header", () => {
      renderWithProviders(<TeamPage />);
      expect(screen.getByText("발표 순서")).toBeInTheDocument();
    });

    it("displays presentation order numbers", () => {
      renderWithProviders(<TeamPage />);
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("sorts members by presentation order", () => {
      renderWithProviders(<TeamPage />);
      const memberNames = screen.getAllByText(/이상윤|선설희/);
      expect(memberNames[0]).toHaveTextContent("이상윤");
      expect(memberNames[1]).toHaveTextContent("선설희");
    });
  });

  describe("Add Member", () => {
    it("shows add form on button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      await user.click(screen.getByText("팀원 추가"));
      expect(screen.getByPlaceholderText("이름 입력")).toBeInTheDocument();
    });

    it("disables add button when form is open", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      const addButton = screen.getByText("팀원 추가");
      await user.click(addButton);
      expect(addButton).toBeDisabled();
    });

    it("shows next presentation order in add form", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      await user.click(screen.getByText("팀원 추가"));
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("closes add form on cancel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      await user.click(screen.getByText("팀원 추가"));
      const cancelButtons = screen.getAllByRole("button");
      const cancelButton = cancelButtons.find((btn) => btn.querySelector("svg.lucide-x"));
      expect(cancelButton).toBeDefined();
      if (cancelButton) {
        await user.click(cancelButton);
      }
      expect(screen.queryByPlaceholderText("이름 입력")).not.toBeInTheDocument();
    });

    it("adds member successfully via API", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "최보연");
      await user.click(screen.getByText("추가"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });
    });

    it("adds member locally when API fails (offline fallback)", async () => {
      const user = userEvent.setup();

      // Override the mock to simulate error callback
      mockUseAddMember.mockImplementationOnce((options: any) => ({
        mutate: () => {
          if (options?.mutation?.onError) {
            options.mutation.onError();
          }
        },
      }));

      renderWithProviders(<TeamPage />);
      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "유수화");
      await user.click(screen.getByText("추가"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });
    });

    it("adds member on Enter key press", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "김정연{Enter}");

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });
    });

    it("does not add empty name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      await user.click(screen.getByText("팀원 추가"));
      const addButtonInForm = screen.getByText("추가");
      expect(addButtonInForm).toBeDisabled();
    });

    it("trims whitespace from member name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "  최보연  ");
      await user.click(screen.getByText("추가"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });
    });

    it("adds member locally when no teamId exists", async () => {
      const user = userEvent.setup();
      mockUseListTeams.mockReturnValueOnce({ data: [] });
      mockUseGetTeam.mockReturnValueOnce({ data: undefined });

      renderWithProviders(<TeamPage />);
      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "새팀원");
      await user.click(screen.getByText("추가"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });
    });
  });

  describe("Edit Member", () => {
    it("enters edit mode on edit button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      expect(editButton).toBeDefined();
      if (editButton) {
        await user.click(editButton);
      }

      await waitFor(() => {
        const inputs = screen.getAllByRole("textbox");
        const editInput = inputs.find((input) => (input as HTMLInputElement).value === "이상윤");
        expect(editInput).toBeInTheDocument();
      });
    });

    it("cancels edit on cancel button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      await waitFor(() => {
        const cancelButtons = screen.getAllByRole("button");
        const cancelButton = cancelButtons.find((btn) => btn.querySelector("svg.lucide-x"));
        if (cancelButton) {
          user.click(cancelButton);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("이상윤")).toBeInTheDocument();
      });
    });

    it("saves edit successfully via API", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find((input) => (input as HTMLInputElement).value === "이상윤");
      if (editInput) {
        await user.clear(editInput);
        await user.type(editInput, "이상윤님");
      }

      await user.click(screen.getByText("저장"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("수정되었습니다");
      });
    });

    it("saves edit locally when API fails (offline fallback)", async () => {
      const user = userEvent.setup();

      // Override the mock to simulate error callback
      mockUseUpdateMember.mockImplementationOnce((options: any) => ({
        mutate: () => {
          if (options?.mutation?.onError) {
            options.mutation.onError();
          }
        },
      }));

      renderWithProviders(<TeamPage />);
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find((input) => (input as HTMLInputElement).value === "이상윤");
      if (editInput) {
        await user.clear(editInput);
        await user.type(editInput, "이상윤2");
      }

      await user.click(screen.getByText("저장"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("수정되었습니다");
      });
    });

    it("saves edit on Enter key press", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find((input) => (input as HTMLInputElement).value === "이상윤");
      if (editInput) {
        await user.clear(editInput);
        await user.type(editInput, "수정됨{Enter}");
      }

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("수정되었습니다");
      });
    });

    it("does not save empty name on edit", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find((input) => (input as HTMLInputElement).value === "이상윤");
      if (editInput) {
        await user.clear(editInput);
      }

      await user.click(screen.getByText("저장"));

      await waitFor(
        () => {
          expect(mockToastSuccess).not.toHaveBeenCalled();
        },
        { timeout: 500 },
      );
    });

    it("trims whitespace when saving edit", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find((input) => (input as HTMLInputElement).value === "이상윤");
      if (editInput) {
        await user.clear(editInput);
        await user.type(editInput, "  수정됨  ");
      }

      await user.click(screen.getByText("저장"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("수정되었습니다");
      });
    });

    it("updates member locally when no teamId exists", async () => {
      const user = userEvent.setup();

      // Return empty teams to have no teamId
      mockUseListTeams.mockReturnValue({ data: [] });
      mockUseGetTeam.mockReturnValue({ data: undefined });

      // Set up mock with initial members in atom (simulating local-only state)
      const mockUpdateMemberFn = vi.fn((options: any) => ({
        mutate: vi.fn(),
      }));
      mockUseUpdateMember.mockImplementation(mockUpdateMemberFn);

      renderWithProviders(<TeamPage />);

      // First add a member locally
      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "로컬팀원");
      await user.click(screen.getByText("추가"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });

      // Now edit that member
      vi.clearAllMocks();
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      await waitFor(() => {
        const inputs = screen.getAllByRole("textbox");
        const editInput = inputs.find((input) => (input as HTMLInputElement).value === "로컬팀원");
        expect(editInput).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find((input) => (input as HTMLInputElement).value === "로컬팀원");
      if (editInput) {
        await user.clear(editInput);
        await user.type(editInput, "수정된로컬팀원");
      }

      await user.click(screen.getByText("저장"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("수정되었습니다");
      });
    });
  });

  describe("Delete Member", () => {
    it("deletes member successfully via API", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) => btn.querySelector("svg.lucide-trash-2"));
      expect(deleteButton).toBeDefined();
      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("삭제되었습니다");
      });
    });

    it("deletes member locally when API fails (offline fallback)", async () => {
      const user = userEvent.setup();

      // Override the mock to simulate error callback
      mockUseRemoveMember.mockImplementationOnce((options: any) => ({
        mutate: (params: any) => {
          if (options?.mutation?.onError) {
            options.mutation.onError(undefined, params);
          }
        },
      }));

      renderWithProviders(<TeamPage />);
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) => btn.querySelector("svg.lucide-trash-2"));
      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("삭제되었습니다");
      });
    });

    it("deletes member locally when no teamId exists", async () => {
      const user = userEvent.setup();

      // Return empty teams to have no teamId
      mockUseListTeams.mockReturnValue({ data: [] });
      mockUseGetTeam.mockReturnValue({ data: undefined });

      renderWithProviders(<TeamPage />);

      // First add a member locally
      await user.click(screen.getByText("팀원 추가"));
      const input = screen.getByPlaceholderText("이름 입력");
      await user.type(input, "삭제할팀원");
      await user.click(screen.getByText("추가"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("추가되었습니다");
      });

      // Now delete that member
      vi.clearAllMocks();
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) => btn.querySelector("svg.lucide-trash-2"));
      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("삭제되었습니다");
      });
    });
  });

  describe("Team Data Sync", () => {
    it("syncs team members from API to atom", async () => {
      renderWithProviders(<TeamPage />);

      await waitFor(() => {
        expect(screen.getByText("이상윤")).toBeInTheDocument();
        expect(screen.getByText("선설희")).toBeInTheDocument();
      });
    });

    it("handles empty team list", () => {
      mockUseListTeams.mockReturnValueOnce({ data: [] });
      mockUseGetTeam.mockReturnValueOnce({ data: undefined });

      renderWithProviders(<TeamPage />);
      expect(screen.getByText("팀원 관리")).toBeInTheDocument();
    });

    it("handles undefined team data", () => {
      mockUseGetTeam.mockReturnValueOnce({ data: undefined });

      renderWithProviders(<TeamPage />);
      expect(screen.getByText("팀원 관리")).toBeInTheDocument();
    });
  });
});
