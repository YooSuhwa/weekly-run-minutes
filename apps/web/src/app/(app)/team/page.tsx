"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAtom, useAtomValue } from "jotai";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { selectedTeamIdAtom, type TeamMember, teamMembersAtom } from "@/atoms/team";
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

interface SortableMemberItemProps {
  member: TeamMember;
  editingId: string | null;
  editName: string;
  onEditNameChange: (name: string) => void;
  onEdit: (member: TeamMember) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

function SortableMemberItem({
  member,
  editingId,
  editName,
  onEditNameChange,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: SortableMemberItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {member.presentationOrder}
      </span>

      {editingId === member.id ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" variant="ghost" onClick={onSaveEdit}>
            저장
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{member.name}</span>
          <Button size="icon" variant="ghost" onClick={() => onEdit(member)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(member.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function TeamPage() {
  const toast = useToast();
  const selectedTeamId = useAtomValue(selectedTeamIdAtom);
  const [members, setMembers] = useAtom(teamMembersAtom);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Fetch teams list as fallback
  const { data: teams } = useListTeamsApiV1TeamsGet();
  const teamId = selectedTeamId ?? teams?.[0]?.id ?? "";

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const sortedMembers = [...members].sort((a, b) => a.presentationOrder - b.presentationOrder);
      const oldIndex = sortedMembers.findIndex((m) => m.id === active.id);
      const newIndex = sortedMembers.findIndex((m) => m.id === over.id);

      const reordered = arrayMove(sortedMembers, oldIndex, newIndex);

      // Update presentation order for all items
      const updatedMembers = reordered.map((member, index) => ({
        ...member,
        presentationOrder: index + 1,
      }));

      setMembers(updatedMembers);

      // Update order on server for each changed member
      if (teamId) {
        for (const member of updatedMembers) {
          const original = members.find((m) => m.id === member.id);
          if (original && original.presentationOrder !== member.presentationOrder) {
            updateMember.mutate({
              teamId,
              memberId: member.id,
              data: { presentation_order: member.presentationOrder },
            });
          }
        }
      }

      toast.success("순서가 변경되었습니다");
    }
  };

  if (!teamId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="text-center text-muted-foreground">팀을 선택해주세요.</div>
      </div>
    );
  }

  const sortedMembers = [...members].sort((a, b) => a.presentationOrder - b.presentationOrder);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">팀원 관리</h1>
          <p className="text-sm text-muted-foreground">{teamData?.name ?? "팀"} 팀원 목록</p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="h-4 w-4" />
          팀원 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">발표 순서</CardTitle>
          <p className="text-xs text-muted-foreground">드래그하여 순서를 변경하세요</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedMembers.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedMembers.map((member) => (
                  <SortableMemberItem
                    key={member.id}
                    member={member}
                    editingId={editingId}
                    editName={editName}
                    onEditNameChange={setEditName}
                    onEdit={handleEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>

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
