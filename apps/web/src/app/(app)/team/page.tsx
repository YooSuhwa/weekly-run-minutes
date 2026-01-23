"use client";

import { useAtom } from "jotai";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type TeamMember, teamMembersAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  useAddTeamMemberApiV1TeamsTeamIdMembersPost,
  useGetTeamApiV1TeamsTeamIdGet,
  useListTeamsApiV1TeamsGet,
  useRemoveTeamMemberApiV1TeamsTeamIdMembersMemberIdDelete,
  useUpdateTeamMemberApiV1TeamsTeamIdMembersMemberIdPatch,
} from "@/lib/api/__generated__/teams/teams";

export default function TeamPage() {
  const toast = useToast();
  const [members, setMembers] = useAtom(teamMembersAtom);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // Fetch teams list
  const { data: teams } = useListTeamsApiV1TeamsGet();
  const teamId = teams?.[0]?.id ?? "";

  // Fetch team details with members
  const { data: teamData } = useGetTeamApiV1TeamsTeamIdGet(teamId, {
    query: { enabled: !!teamId },
  });

  // Sync fetched team members to atom
  useEffect(() => {
    if (teamData?.members) {
      setMembers(
        teamData.members.map((m) => ({
          id: m.id,
          name: m.name,
          presentationOrder: m.presentation_order,
          isActive: m.is_active,
          teamId: m.team_id,
        })),
      );
    }
  }, [teamData, setMembers]);

  // Mutations
  const addMember = useAddTeamMemberApiV1TeamsTeamIdMembersPost({
    mutation: {
      onSuccess: (data) => {
        const newMember: TeamMember = {
          id: data.id,
          name: data.name,
          presentationOrder: data.presentation_order,
          isActive: data.is_active,
          teamId: data.team_id,
        };
        setMembers((prev) => [...prev, newMember]);
        setNewName("");
        setIsAdding(false);
        toast.success("추가되었습니다");
      },
      onError: () => {
        // Offline fallback: add locally
        const localMember: TeamMember = {
          id: crypto.randomUUID(),
          name: newName.trim(),
          presentationOrder: members.length + 1,
          isActive: true,
          teamId: teamId || "",
        };
        setMembers((prev) => [...prev, localMember]);
        setNewName("");
        setIsAdding(false);
        toast.success("추가되었습니다");
      },
    },
  });

  const updateMember = useUpdateTeamMemberApiV1TeamsTeamIdMembersMemberIdPatch({
    mutation: {
      onSuccess: () => {
        setMembers((prev) =>
          prev.map((m) => (m.id === editingId ? { ...m, name: editName.trim() } : m)),
        );
        setEditingId(null);
        toast.success("수정되었습니다");
      },
      onError: () => {
        // Offline fallback: update locally
        setMembers((prev) =>
          prev.map((m) => (m.id === editingId ? { ...m, name: editName.trim() } : m)),
        );
        setEditingId(null);
        toast.success("수정되었습니다");
      },
    },
  });

  const removeMember = useRemoveTeamMemberApiV1TeamsTeamIdMembersMemberIdDelete({
    mutation: {
      onSuccess: (_data, variables) => {
        setMembers((prev) => prev.filter((m) => m.id !== variables.memberId));
        toast.success("삭제되었습니다");
      },
      onError: (_error, variables) => {
        // Offline fallback: remove locally
        setMembers((prev) => prev.filter((m) => m.id !== variables.memberId));
        toast.success("삭제되었습니다");
      },
    },
  });

  const handleEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;

    if (teamId) {
      updateMember.mutate({
        teamId,
        memberId: editingId,
        data: { name: editName.trim() },
      });
    } else {
      // No team, update locally
      setMembers((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, name: editName.trim() } : m)),
      );
      setEditingId(null);
      toast.success("수정되었습니다");
    }
  };

  const handleDelete = (id: string) => {
    if (teamId) {
      removeMember.mutate({ teamId, memberId: id });
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success("삭제되었습니다");
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;

    if (teamId) {
      addMember.mutate({
        teamId,
        data: {
          name: newName.trim(),
          presentation_order: members.length + 1,
        },
      });
    } else {
      // No team, add locally
      const localMember: TeamMember = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        presentationOrder: members.length + 1,
        isActive: true,
        teamId: "",
      };
      setMembers((prev) => [...prev, localMember]);
      setNewName("");
      setIsAdding(false);
      toast.success("추가되었습니다");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">팀원 관리</h1>
          <p className="text-sm text-muted-foreground">제품기술팀 팀원 목록</p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="h-4 w-4" />
          팀원 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">발표 순서</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members
              .sort((a, b) => a.presentationOrder - b.presentationOrder)
              .map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {member.presentationOrder}
                  </span>

                  {editingId === member.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
                        저장
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{member.name}</span>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(member)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(member.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

            {isAdding && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {members.length + 1}
                </span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="이름 입력"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
                  추가
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
