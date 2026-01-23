import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock toast
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// Use vi.hoisted to ensure stable references are available in hoisted vi.mock
const { mockTeamsList, mockTeamData, mockAddMutate } = vi.hoisted(() => ({
  mockTeamsList: [{ id: "t1", name: "제품기술팀" }],
  mockTeamData: {
    id: "t1",
    name: "제품기술팀",
    members: [
      { id: "m1", name: "이상윤", presentation_order: 1, is_active: true, team_id: "t1" },
      { id: "m2", name: "선설희", presentation_order: 2, is_active: true, team_id: "t1" },
    ],
  },
  mockAddMutate: vi.fn(),
}));
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: () => ({ data: mockTeamsList }),
  useGetTeamApiV1TeamsTeamIdGet: () => ({ data: mockTeamData }),
  useAddTeamMemberApiV1TeamsTeamIdMembersPost: () => ({ mutate: mockAddMutate }),
  useUpdateTeamMemberApiV1TeamsTeamIdMembersMemberIdPatch: () => ({ mutate: vi.fn() }),
  useRemoveTeamMemberApiV1TeamsTeamIdMembersMemberIdDelete: () => ({ mutate: vi.fn() }),
}));

import TeamPage from "../page";

function renderWithProviders(ui: ReactNode) {
  const store = createStore();
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("TeamPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders page title", () => {
    renderWithProviders(<TeamPage />);
    expect(screen.getByText("팀원 관리")).toBeInTheDocument();
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

  it("shows add form on button click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TeamPage />);
    await user.click(screen.getByText("팀원 추가"));
    expect(screen.getByPlaceholderText("이름 입력")).toBeInTheDocument();
  });

  it("shows presentation order header", () => {
    renderWithProviders(<TeamPage />);
    expect(screen.getByText("발표 순서")).toBeInTheDocument();
  });
});
