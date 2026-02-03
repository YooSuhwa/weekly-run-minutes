import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentTeamAtom,
  selectedMembersAtom,
  selectedTeamIdAtom,
  type Team,
  type TeamMember,
  teamMembersAtom,
} from "../team";

// Mock localStorage for atomWithStorage tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("team atoms", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("selectedTeamIdAtom", () => {
    it("should have initial value of null", () => {
      const store = createStore();
      expect(store.get(selectedTeamIdAtom)).toBeNull();
    });

    it("should store a team ID", () => {
      const store = createStore();
      store.set(selectedTeamIdAtom, "team-123");
      expect(store.get(selectedTeamIdAtom)).toBe("team-123");
    });

    it("should allow setting back to null", () => {
      const store = createStore();
      store.set(selectedTeamIdAtom, "team-123");
      store.set(selectedTeamIdAtom, null);
      expect(store.get(selectedTeamIdAtom)).toBeNull();
    });

    it("should replace existing team ID when set", () => {
      const store = createStore();
      store.set(selectedTeamIdAtom, "team-1");
      store.set(selectedTeamIdAtom, "team-2");
      expect(store.get(selectedTeamIdAtom)).toBe("team-2");
    });

    it("should use correct localStorage key", () => {
      const store = createStore();
      store.set(selectedTeamIdAtom, "team-123");
      // The atom uses 'weeklyrun:selectedTeamId' as the key
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "weeklyrun:selectedTeamId",
        expect.any(String),
      );
    });

    it("should maintain independent state across stores", () => {
      const store1 = createStore();
      const store2 = createStore();

      store1.set(selectedTeamIdAtom, "team-1");
      store2.set(selectedTeamIdAtom, "team-2");

      expect(store1.get(selectedTeamIdAtom)).toBe("team-1");
      expect(store2.get(selectedTeamIdAtom)).toBe("team-2");
    });
  });

  describe("currentTeamAtom", () => {
    it("should have initial value of null", () => {
      const store = createStore();
      expect(store.get(currentTeamAtom)).toBeNull();
    });

    it("should store a team object", () => {
      const store = createStore();
      const team: Team = {
        id: "team-1",
        name: "Product Tech Team",
        members: [],
      };
      store.set(currentTeamAtom, team);
      expect(store.get(currentTeamAtom)).toEqual(team);
    });

    it("should store a team with members", () => {
      const store = createStore();
      const team: Team = {
        id: "team-1",
        name: "Product Tech Team",
        members: [
          {
            id: "member-1",
            name: "Lee Sangyun",
            presentationOrder: 1,
            isActive: true,
            teamId: "team-1",
          },
          {
            id: "member-2",
            name: "Seon Seolhee",
            presentationOrder: 2,
            isActive: true,
            teamId: "team-1",
          },
        ],
      };
      store.set(currentTeamAtom, team);
      expect(store.get(currentTeamAtom)).toEqual(team);
      expect(store.get(currentTeamAtom)?.members).toHaveLength(2);
    });

    it("should allow setting back to null", () => {
      const store = createStore();
      const team: Team = {
        id: "team-1",
        name: "Product Tech Team",
        members: [],
      };
      store.set(currentTeamAtom, team);
      store.set(currentTeamAtom, null);
      expect(store.get(currentTeamAtom)).toBeNull();
    });

    it("should replace existing team when set", () => {
      const store = createStore();
      const team1: Team = {
        id: "team-1",
        name: "Team A",
        members: [],
      };
      const team2: Team = {
        id: "team-2",
        name: "Team B",
        members: [],
      };
      store.set(currentTeamAtom, team1);
      store.set(currentTeamAtom, team2);
      expect(store.get(currentTeamAtom)).toEqual(team2);
      expect(store.get(currentTeamAtom)?.id).toBe("team-2");
    });
  });

  describe("teamMembersAtom", () => {
    it("should have initial value of empty array", () => {
      const store = createStore();
      expect(store.get(teamMembersAtom)).toEqual([]);
    });

    it("should store a list of team members", () => {
      const store = createStore();
      const members: TeamMember[] = [
        {
          id: "member-1",
          name: "Lee Sangyun",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-1",
        },
        {
          id: "member-2",
          name: "Seon Seolhee",
          presentationOrder: 2,
          isActive: true,
          teamId: "team-1",
        },
      ];
      store.set(teamMembersAtom, members);
      expect(store.get(teamMembersAtom)).toEqual(members);
      expect(store.get(teamMembersAtom)).toHaveLength(2);
    });

    it("should store members with different active states", () => {
      const store = createStore();
      const members: TeamMember[] = [
        {
          id: "member-1",
          name: "Active Member",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-1",
        },
        {
          id: "member-2",
          name: "Inactive Member",
          presentationOrder: 2,
          isActive: false,
          teamId: "team-1",
        },
      ];
      store.set(teamMembersAtom, members);
      const storedMembers = store.get(teamMembersAtom);
      expect(storedMembers[0].isActive).toBe(true);
      expect(storedMembers[1].isActive).toBe(false);
    });

    it("should preserve presentation order", () => {
      const store = createStore();
      const members: TeamMember[] = [
        {
          id: "member-3",
          name: "Third",
          presentationOrder: 3,
          isActive: true,
          teamId: "team-1",
        },
        {
          id: "member-1",
          name: "First",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-1",
        },
        {
          id: "member-2",
          name: "Second",
          presentationOrder: 2,
          isActive: true,
          teamId: "team-1",
        },
      ];
      store.set(teamMembersAtom, members);
      const storedMembers = store.get(teamMembersAtom);
      expect(storedMembers[0].presentationOrder).toBe(3);
      expect(storedMembers[1].presentationOrder).toBe(1);
      expect(storedMembers[2].presentationOrder).toBe(2);
    });

    it("should allow clearing members", () => {
      const store = createStore();
      const members: TeamMember[] = [
        {
          id: "member-1",
          name: "Test Member",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-1",
        },
      ];
      store.set(teamMembersAtom, members);
      store.set(teamMembersAtom, []);
      expect(store.get(teamMembersAtom)).toEqual([]);
    });

    it("should replace existing members when set", () => {
      const store = createStore();
      const members1: TeamMember[] = [
        {
          id: "member-1",
          name: "Old Member",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-1",
        },
      ];
      const members2: TeamMember[] = [
        {
          id: "member-2",
          name: "New Member",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-1",
        },
      ];
      store.set(teamMembersAtom, members1);
      store.set(teamMembersAtom, members2);
      expect(store.get(teamMembersAtom)).toEqual(members2);
      expect(store.get(teamMembersAtom)[0].name).toBe("New Member");
    });
  });

  describe("selectedMembersAtom", () => {
    it("should have initial value of empty array", () => {
      const store = createStore();
      expect(store.get(selectedMembersAtom)).toEqual([]);
    });

    it("should store selected member IDs", () => {
      const store = createStore();
      const selectedIds = ["member-1", "member-2", "member-3"];
      store.set(selectedMembersAtom, selectedIds);
      expect(store.get(selectedMembersAtom)).toEqual(selectedIds);
      expect(store.get(selectedMembersAtom)).toHaveLength(3);
    });

    it("should allow single member selection", () => {
      const store = createStore();
      store.set(selectedMembersAtom, ["member-1"]);
      expect(store.get(selectedMembersAtom)).toEqual(["member-1"]);
    });

    it("should allow clearing selection", () => {
      const store = createStore();
      store.set(selectedMembersAtom, ["member-1", "member-2"]);
      store.set(selectedMembersAtom, []);
      expect(store.get(selectedMembersAtom)).toEqual([]);
    });

    it("should replace existing selection when set", () => {
      const store = createStore();
      store.set(selectedMembersAtom, ["member-1", "member-2"]);
      store.set(selectedMembersAtom, ["member-3"]);
      expect(store.get(selectedMembersAtom)).toEqual(["member-3"]);
      expect(store.get(selectedMembersAtom)).not.toContain("member-1");
    });

    it("should allow duplicate IDs (primitive atom)", () => {
      const store = createStore();
      const selectedIds = ["member-1", "member-1", "member-2"];
      store.set(selectedMembersAtom, selectedIds);
      expect(store.get(selectedMembersAtom)).toEqual(selectedIds);
      expect(store.get(selectedMembersAtom)).toHaveLength(3);
    });
  });

  describe("atoms independence", () => {
    it("should maintain independent state between atoms", () => {
      const store = createStore();

      const team: Team = {
        id: "team-1",
        name: "Product Tech Team",
        members: [
          {
            id: "member-1",
            name: "Lee Sangyun",
            presentationOrder: 1,
            isActive: true,
            teamId: "team-1",
          },
        ],
      };

      const separateMembers: TeamMember[] = [
        {
          id: "member-2",
          name: "Seon Seolhee",
          presentationOrder: 1,
          isActive: true,
          teamId: "team-2",
        },
      ];

      store.set(currentTeamAtom, team);
      store.set(teamMembersAtom, separateMembers);
      store.set(selectedMembersAtom, ["member-3"]);

      expect(store.get(currentTeamAtom)?.members[0].id).toBe("member-1");
      expect(store.get(teamMembersAtom)[0].id).toBe("member-2");
      expect(store.get(selectedMembersAtom)[0]).toBe("member-3");
    });

    it("should allow stores to have different state", () => {
      const store1 = createStore();
      const store2 = createStore();

      const team1: Team = {
        id: "team-1",
        name: "Team A",
        members: [],
      };
      const team2: Team = {
        id: "team-2",
        name: "Team B",
        members: [],
      };

      store1.set(currentTeamAtom, team1);
      store2.set(currentTeamAtom, team2);

      expect(store1.get(currentTeamAtom)?.name).toBe("Team A");
      expect(store2.get(currentTeamAtom)?.name).toBe("Team B");
    });
  });

  describe("TeamMember interface", () => {
    it("should correctly type all required fields", () => {
      const store = createStore();
      const member: TeamMember = {
        id: "member-1",
        name: "Test Member",
        presentationOrder: 1,
        isActive: true,
        teamId: "team-1",
      };
      store.set(teamMembersAtom, [member]);
      const stored = store.get(teamMembersAtom)[0];

      expect(typeof stored.id).toBe("string");
      expect(typeof stored.name).toBe("string");
      expect(typeof stored.presentationOrder).toBe("number");
      expect(typeof stored.isActive).toBe("boolean");
      expect(typeof stored.teamId).toBe("string");
    });
  });

  describe("Team interface", () => {
    it("should correctly type all required fields", () => {
      const store = createStore();
      const team: Team = {
        id: "team-1",
        name: "Product Tech Team",
        members: [],
      };
      store.set(currentTeamAtom, team);
      const stored = store.get(currentTeamAtom);

      expect(typeof stored?.id).toBe("string");
      expect(typeof stored?.name).toBe("string");
      expect(Array.isArray(stored?.members)).toBe(true);
    });
  });
});
