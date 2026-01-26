import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface TeamMember {
  id: string;
  name: string;
  presentationOrder: number;
  isActive: boolean;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

/**
 * Persisted team ID for P2 multi-team support.
 * This is stored in localStorage to persist across sessions.
 */
export const selectedTeamIdAtom = atomWithStorage<string | null>("weeklyrun:selectedTeamId", null);

/**
 * Current team object with full details including members.
 */
export const currentTeamAtom = atom<Team | null>(null);

/**
 * Team members list (can be used independently of currentTeamAtom).
 */
export const teamMembersAtom = atom<TeamMember[]>([]);

/**
 * Selected member IDs for meeting participant selection.
 */
export const selectedMembersAtom = atom<string[]>([]);
