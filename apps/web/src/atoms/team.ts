import { atom } from "jotai";

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

export const currentTeamAtom = atom<Team | null>(null);
export const teamMembersAtom = atom<TeamMember[]>([]);
export const selectedMembersAtom = atom<string[]>([]);
