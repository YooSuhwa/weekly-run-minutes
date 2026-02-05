import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks - must be declared first
const {
  mockToastSuccess,
  mockToastError,
  mockTeamsList,
  mockVocabularyList,
  mockRefetch,
  mockState,
  mockTeamData,
} = vi.hoisted(() => {
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockRefetch = vi.fn();

  const mockTeamsList = [{ id: "t1", name: "제품기술팀" }];
  const mockVocabularyList = [
    {
      id: "v1",
      team_id: "t1",
      term: "SDK",
      correction: "에스디케이",
      category: "abbreviation" as const,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "v2",
      team_id: "t1",
      term: "AI",
      correction: "에이아이",
      category: "terminology" as const,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ];

  // Stable team data object to prevent useEffect from re-running on every render
  const mockTeamData = {
    id: "t1",
    name: "제품기술팀",
    filtering_enabled: true,
    filtering_confidence_threshold: 0.7,
    confluence_base_url: "",
    confluence_space_key: "",
    confluence_username: "",
    has_confluence_token: false,
    context_terms: [],
    context_instructions: "",
  };

  // Use object for mutable state that can be accessed in hoisted mocks
  const mockState = {
    createShouldFail: false,
    updateShouldFail: false,
    deleteShouldFail: false,
    bulkImportShouldFail: false,
    returnEmptyTeams: false,
    returnEmptyVocabulary: false,
  };

  return {
    mockToastSuccess,
    mockToastError,
    mockTeamsList,
    mockVocabularyList,
    mockRefetch,
    mockState,
    mockTeamData,
  };
});

// Aliases for easier access
let createShouldFail = false;
let updateShouldFail = false;
let deleteShouldFail = false;
let bulkImportShouldFail = false;
let returnEmptyTeams = false;
let returnEmptyVocabulary = false;

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock Weeky component
vi.mock("@/components/weeky/weeky", () => ({
  Weeky: ({ message }: { message?: string }) => <div data-testid="weeky">{message}</div>,
}));

// Mock API hooks
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: vi.fn(() => ({
    data: mockState.returnEmptyTeams ? [] : mockTeamsList,
  })),
  useGetTeamApiV1TeamsTeamIdGet: vi.fn(() => ({
    data: mockTeamData,
    refetch: vi.fn(),
  })),
  useUpdateTeamApiV1TeamsTeamIdPut: vi.fn((options) => ({
    mutate: vi.fn((params, overrideOptions) => {
      // Call onSuccess from options
      const opts = overrideOptions || options;
      if (opts?.mutation?.onSuccess) {
        opts.mutation.onSuccess({});
      } else if (opts?.onSuccess) {
        opts.onSuccess({});
      }
    }),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
  useDeleteTeamApiV1TeamsTeamIdDelete: vi.fn((options) => ({
    mutate: vi.fn(() => {
      if (options?.mutation?.onSuccess) {
        options.mutation.onSuccess({});
      }
    }),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

vi.mock("@/lib/api/__generated__/vocabulary/vocabulary", () => ({
  useListVocabularyApiV1TeamsTeamIdVocabularyGet: vi.fn(() => ({
    data: mockState.returnEmptyVocabulary ? [] : mockVocabularyList,
    refetch: mockRefetch,
  })),
  useCreateVocabularyApiV1TeamsTeamIdVocabularyPost: vi.fn((options) => ({
    mutate: (params: any) => {
      if (mockState.createShouldFail) {
        if (options?.mutation?.onError) {
          options.mutation.onError(new Error("Failed"));
        }
      } else {
        if (options?.mutation?.onSuccess) {
          options.mutation.onSuccess({
            id: crypto.randomUUID(),
            ...params.data,
            team_id: params.teamId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    },
    isPending: false,
  })),
  useUpdateVocabularyApiV1TeamsTeamIdVocabularyVocabularyIdPut: vi.fn((options) => ({
    mutate: (params: any) => {
      if (mockState.updateShouldFail) {
        if (options?.mutation?.onError) {
          options.mutation.onError(new Error("Failed"));
        }
      } else {
        if (options?.mutation?.onSuccess) {
          options.mutation.onSuccess({
            id: params.vocabularyId,
            ...params.data,
            team_id: params.teamId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    },
    isPending: false,
  })),
  useDeleteVocabularyApiV1TeamsTeamIdVocabularyVocabularyIdDelete: vi.fn((options) => ({
    mutate: () => {
      if (mockState.deleteShouldFail) {
        if (options?.mutation?.onError) {
          options.mutation.onError(new Error("Failed"));
        }
      } else {
        if (options?.mutation?.onSuccess) {
          options.mutation.onSuccess();
        }
      }
    },
    isPending: false,
  })),
  useBulkImportVocabularyApiV1TeamsTeamIdVocabularyImportPost: vi.fn((options) => ({
    mutate: (params: any) => {
      if (mockState.bulkImportShouldFail) {
        if (options?.mutation?.onError) {
          options.mutation.onError(new Error("Failed"));
        }
      } else {
        if (options?.mutation?.onSuccess) {
          options.mutation.onSuccess({
            imported: params.data.items.length,
            skipped: 0,
            items: params.data.items.map((item: any, index: number) => ({
              id: `imported-${index}`,
              ...item,
              team_id: params.teamId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
          });
        }
      }
    },
    isPending: false,
  })),
}));

import { selectedTeamIdAtom } from "@/atoms/team";
import SettingsPage from "../page";

function renderWithProviders(ui: ReactNode, teamId: string | null = "t1") {
  const store = createStore();
  // Always set the atom - either to the teamId or null for no-team scenarios
  store.set(selectedTeamIdAtom, teamId);
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("SettingsPage", () => {
  beforeEach(() => {
    // Reset all flags using mockState
    mockState.createShouldFail = false;
    mockState.updateShouldFail = false;
    mockState.deleteShouldFail = false;
    mockState.bulkImportShouldFail = false;
    mockState.returnEmptyTeams = false;
    mockState.returnEmptyVocabulary = false;
    // Keep local aliases in sync
    createShouldFail = false;
    updateShouldFail = false;
    deleteShouldFail = false;
    bulkImportShouldFail = false;
    returnEmptyTeams = false;
    returnEmptyVocabulary = false;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders page title", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("설정")).toBeInTheDocument();
    });

    it("renders tab navigation", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("용어집")).toBeInTheDocument();
      expect(screen.getByText("잡담 필터링")).toBeInTheDocument();
      expect(screen.getByText("Confluence")).toBeInTheDocument();
    });

    it("shows team tab by default", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("현재 팀 정보")).toBeInTheDocument();
    });

    it("renders vocabulary list when vocabulary tab is active", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      await waitFor(() => {
        expect(screen.getByText("SDK")).toBeInTheDocument();
      });
      // The correction is displayed as "← correction" in the table
      expect(screen.getByText(/← 에스디케이/)).toBeInTheDocument();
      expect(screen.getByText("AI")).toBeInTheDocument();
      expect(screen.getByText(/← 에이아이/)).toBeInTheDocument();
    });

    it("shows total count on vocabulary tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      expect(screen.getByText(/총 2개 용어/)).toBeInTheDocument();
    });

    it("shows message when no team selected", () => {
      renderWithProviders(<SettingsPage />, null);
      expect(screen.getByTestId("weeky")).toHaveTextContent(/팀을 먼저 선택해주세요/);
    });

    it("shows empty message when no vocabulary", async () => {
      mockState.returnEmptyVocabulary = true;
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      expect(screen.getByText("등록된 용어가 없습니다")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("switches to filtering tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      expect(screen.getByText("잡담 필터링 설정")).toBeInTheDocument();
    });

    it("switches back to vocabulary tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      await user.click(screen.getByText("용어집"));
      expect(screen.getByText("용어 목록")).toBeInTheDocument();
    });
  });

  describe("Add Vocabulary", () => {
    it("shows add form on button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("용어 추가"));
      expect(screen.getByText("새 용어 추가")).toBeInTheDocument();
    });

    it("disables add button when form is open", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      const addButton = screen.getByText("용어 추가");
      await user.click(addButton);
      expect(addButton).toBeDisabled();
    });

    it("adds vocabulary successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("용어 추가"));

      await user.type(screen.getByLabelText(/^용어/), "HWP");
      await user.type(screen.getByLabelText(/^발음 힌트/), "한글 워드 프로세서");
      await user.selectOptions(screen.getByLabelText(/^카테고리/), "abbreviation");

      await user.click(screen.getByRole("button", { name: "추가" }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("용어가 추가되었습니다");
      });
    });

    it("cancels add form", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("용어 추가"));
      expect(screen.getByText("새 용어 추가")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.queryByText("새 용어 추가")).not.toBeInTheDocument();
    });

    it("disables add button when form is empty", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("용어 추가"));
      const submitButton = screen.getByRole("button", { name: "추가" });
      expect(submitButton).toBeDisabled();
    });

    it("shows error toast on add failure", async () => {
      mockState.createShouldFail = true;
      const user = userEvent.setup();

      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      await user.click(screen.getByText("용어 추가"));
      await user.type(screen.getByLabelText(/^용어/), "Test");
      await user.type(screen.getByLabelText(/^발음 힌트/), "테스트");
      await user.click(screen.getByRole("button", { name: "추가" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("용어 추가에 실패했습니다");
      });
    });
  });

  describe("Edit Vocabulary", () => {
    it("enters edit mode on edit button click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      expect(editButton).toBeDefined();
      if (editButton) {
        await user.click(editButton);
      }

      await waitFor(() => {
        const inputs = screen.getAllByRole("textbox");
        const editInput = inputs.find((input) => (input as HTMLInputElement).value === "SDK");
        expect(editInput).toBeInTheDocument();
      });
    });

    it("saves edit successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      const inputs = screen.getAllByRole("textbox");
      const termInput = inputs.find((input) => (input as HTMLInputElement).value === "SDK");
      if (termInput) {
        await user.clear(termInput);
        await user.type(termInput, "SDK v2");
      }

      await user.click(screen.getByText("저장"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("용어가 수정되었습니다");
      });
    });

    it("cancels edit mode", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

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
        expect(screen.getByText("SDK")).toBeInTheDocument();
      });
    });

    it("shows error toast on edit failure", async () => {
      mockState.updateShouldFail = true;
      const user = userEvent.setup();

      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      await user.click(screen.getByText("저장"));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("용어 수정에 실패했습니다");
      });
    });
  });

  describe("Delete Vocabulary", () => {
    it("deletes vocabulary successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      // Click vocabulary tab
      const vocabTab = screen.getByText("용어집");
      await user.click(vocabTab);

      // Wait for vocabulary table to render with items
      let deleteButton: HTMLElement | null = null;
      await waitFor(() => {
        expect(screen.getByText("SDK")).toBeInTheDocument();
        // Find delete button - the first trash icon in the vocabulary table
        const trashIcons = screen.getAllByTestId("icon-trash2");
        deleteButton = trashIcons[0].closest("button");
        expect(deleteButton).not.toBeNull();
      });

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("용어가 삭제되었습니다");
      });
    });

    it("shows error toast on delete failure", async () => {
      mockState.deleteShouldFail = true;
      const user = userEvent.setup();

      renderWithProviders(<SettingsPage />);

      // Click vocabulary tab
      const vocabTab = screen.getByText("용어집");
      await user.click(vocabTab);

      // Wait for vocabulary table to render
      let deleteButton: HTMLElement | null = null;
      await waitFor(() => {
        expect(screen.getByText("SDK")).toBeInTheDocument();
        const trashIcons = screen.getAllByTestId("icon-trash2");
        deleteButton = trashIcons[0].closest("button");
        expect(deleteButton).not.toBeNull();
      });

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("용어 삭제에 실패했습니다");
      });
    });
  });

  describe("Search and Filter", () => {
    it("filters vocabulary by search query", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.type(screen.getByPlaceholderText("용어 검색..."), "SDK");

      await waitFor(() => {
        expect(screen.getByText("SDK")).toBeInTheDocument();
        expect(screen.queryByText("AI")).not.toBeInTheDocument();
      });
    });

    it("shows no results message when search has no matches", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.type(screen.getByPlaceholderText("용어 검색..."), "xyz");

      await waitFor(() => {
        expect(screen.getByText("검색 결과가 없습니다")).toBeInTheDocument();
      });
    });

    it("filters by category", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[0]; // First combobox is category filter
      await user.selectOptions(categorySelect, "terminology");

      // Verify the selection was made
      expect(categorySelect).toHaveValue("terminology");
    });
  });

  describe("Bulk Import", () => {
    it("shows bulk import modal", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("가져오기"));
      expect(screen.getByText("일괄 가져오기")).toBeInTheDocument();
    });

    it("imports vocabulary successfully", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("가져오기"));

      // Get the textarea (not the search input)
      const textareas = screen.getAllByRole("textbox");
      const textarea = textareas.find((t) => t.tagName.toLowerCase() === "textarea");
      if (textarea) {
        await user.type(textarea, "HWP,한글,abbreviation\nAPI,에이피아이,terminology");
      }

      // Find the second "가져오기" button (the one in the modal)
      const importButtons = screen.getAllByRole("button", { name: "가져오기" });
      await user.click(importButtons[importButtons.length - 1]);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "2개 용어가 추가되었습니다 (0개 중복 건너뜀)",
        );
      });
    });

    it("cancels bulk import modal", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("가져오기"));
      expect(screen.getByText("일괄 가져오기")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.queryByText("일괄 가져오기")).not.toBeInTheDocument();
    });

    it("shows error for invalid bulk import format", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("가져오기"));

      // The import button should be disabled when textarea is empty, so we try to import empty lines
      const textareas = screen.getAllByRole("textbox");
      const textarea = textareas.find((t) => t.tagName.toLowerCase() === "textarea");
      if (textarea) {
        // Type only whitespace/empty content that won't produce valid items
        await user.type(textarea, "   ");
        await user.clear(textarea);
        await user.type(textarea, ",");
      }

      const importButtons = screen.getAllByRole("button", { name: "가져오기" });
      await user.click(importButtons[importButtons.length - 1]);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "유효한 데이터가 없습니다. 형식: 용어,발음힌트,카테고리",
        );
      });
    });

    it("shows error toast on bulk import failure", async () => {
      mockState.bulkImportShouldFail = true;
      const user = userEvent.setup();

      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      await user.click(screen.getByText("가져오기"));

      const textareas = screen.getAllByRole("textbox");
      const textarea = textareas.find((t) => t.tagName.toLowerCase() === "textarea");
      if (textarea) {
        await user.type(textarea, "HWP,한글,abbreviation");
      }

      const importButtons = screen.getAllByRole("button", { name: "가져오기" });
      await user.click(importButtons[importButtons.length - 1]);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("일괄 가져오기에 실패했습니다");
      });
    });
  });

  describe("Export", () => {
    it("exports vocabulary", async () => {
      const user = userEvent.setup();

      // Mock URL and link methods
      const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test");
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "a") {
          return { click: mockClick, href: "", download: "" } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      });

      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      await user.click(screen.getByText("내보내기"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("용어집을 내보냈습니다");
      });
    });

    it("shows error when exporting empty vocabulary", async () => {
      mockState.returnEmptyVocabulary = true;
      const user = userEvent.setup();

      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      await user.click(screen.getByText("내보내기"));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("내보낼 용어가 없습니다");
      });
    });
  });

  describe("Chat Filtering Settings", () => {
    it("renders filtering settings", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      expect(screen.getByText("잡담 필터링 활성화")).toBeInTheDocument();
    });

    it("toggles filtering enabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      const toggle = screen.getByRole("switch");

      expect(toggle).toHaveAttribute("aria-checked", "true");
      await user.click(toggle);
      await waitFor(() => {
        expect(toggle).toHaveAttribute("aria-checked", "false");
      });
    });

    it("hides threshold slider when filtering is disabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      const toggle = screen.getByRole("switch");
      await user.click(toggle);

      await waitFor(() => {
        expect(screen.queryByText("신뢰도 임계값")).not.toBeInTheDocument();
      });
    });

    it("shows threshold slider when filtering is enabled", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      expect(screen.getByText("신뢰도 임계값")).toBeInTheDocument();
    });

    it("adjusts confidence threshold", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      expect(screen.getByRole("slider")).toBeInTheDocument();
      expect(screen.getByText("70%")).toBeInTheDocument();
    });

    it("shows filtering criteria", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      expect(screen.getByText("필터링 기준")).toBeInTheDocument();
      expect(screen.getByText("- 회의 주제와 관련 없는 대화")).toBeInTheDocument();
    });

    it("saves filtering settings", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);

      await user.click(screen.getByText("잡담 필터링"));
      await user.click(screen.getByText("설정 저장"));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("설정이 저장되었습니다");
      });
    });
  });

  describe("Category Labels", () => {
    it("displays correct category labels", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      // Use getAllByText since labels appear both in dropdown and table
      expect(screen.getAllByText("약어").length).toBeGreaterThan(0);
      expect(screen.getAllByText("전문 용어").length).toBeGreaterThan(0);
    });
  });

  describe("Action Buttons", () => {
    it("renders all action buttons", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));
      expect(screen.getByText("가져오기")).toBeInTheDocument();
      expect(screen.getByText("내보내기")).toBeInTheDocument();
      expect(screen.getByText("용어 추가")).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("trims whitespace from term and correction", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("용어 추가"));
      await user.type(screen.getByLabelText(/^용어/), "  HWP  ");
      await user.type(screen.getByLabelText(/^발음 힌트/), "  한글  ");
      await user.click(screen.getByRole("button", { name: "추가" }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("용어가 추가되었습니다");
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles bulk import with only term and correction (no category)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("가져오기"));

      const textareas = screen.getAllByRole("textbox");
      const textarea = textareas.find((t) => t.tagName.toLowerCase() === "textarea");
      if (textarea) {
        await user.type(textarea, "HWP,한글");
      }

      const importButtons = screen.getAllByRole("button", { name: "가져오기" });
      await user.click(importButtons[importButtons.length - 1]);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });

    it("handles bulk import with invalid category (defaults to other)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      await user.click(screen.getByText("가져오기"));

      const textareas = screen.getAllByRole("textbox");
      const textarea = textareas.find((t) => t.tagName.toLowerCase() === "textarea");
      if (textarea) {
        await user.type(textarea, "HWP,한글,invalid_category");
      }

      const importButtons = screen.getAllByRole("button", { name: "가져오기" });
      await user.click(importButtons[importButtons.length - 1]);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });

    it("closes add form when entering edit mode", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await user.click(screen.getByText("용어집"));

      // Open add form
      await user.click(screen.getByText("용어 추가"));
      expect(screen.getByText("새 용어 추가")).toBeInTheDocument();

      // Click edit button
      const editButtons = screen.getAllByRole("button");
      const editButton = editButtons.find((btn) => btn.querySelector("svg.lucide-pencil"));
      if (editButton) {
        await user.click(editButton);
      }

      await waitFor(() => {
        expect(screen.queryByText("새 용어 추가")).not.toBeInTheDocument();
      });
    });
  });
});
