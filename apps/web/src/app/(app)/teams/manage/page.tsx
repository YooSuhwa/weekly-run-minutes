"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { TeamCreate, TeamResponse, TeamUpdate } from "@/lib/api/__generated__/schemas";
import {
  getListTeamsApiV1TeamsGetQueryKey,
  useCreateTeamApiV1TeamsPost,
  useDeleteTeamApiV1TeamsTeamIdDelete,
  useGetTeamApiV1TeamsTeamIdGet,
  useListTeamsApiV1TeamsGet,
  useUpdateTeamApiV1TeamsTeamIdPut,
} from "@/lib/api/__generated__/teams/teams";
import { formatDate } from "@/lib/utils";

interface TeamFormData {
  name: string;
  password: string;
  confluenceBaseUrl: string;
  confluenceSpaceKey: string;
}

const initialFormData: TeamFormData = {
  name: "",
  password: "",
  confluenceBaseUrl: "",
  confluenceSpaceKey: "",
};

export default function TeamManagePage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form and selection states
  const [formData, setFormData] = useState<TeamFormData>(initialFormData);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Fetch teams list
  const { data: teams, isLoading: isLoadingTeams } = useListTeamsApiV1TeamsGet();

  // Fetch selected team details for editing
  const { data: selectedTeam } = useGetTeamApiV1TeamsTeamIdGet(selectedTeamId ?? "", {
    query: { enabled: !!selectedTeamId && isEditDialogOpen },
  });

  // Mutations
  const createTeam = useCreateTeamApiV1TeamsPost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsApiV1TeamsGetQueryKey() });
        setIsCreateDialogOpen(false);
        setFormData(initialFormData);
        toast.success("팀이 생성되었습니다");
      },
      onError: () => {
        toast.error("팀 생성에 실패했습니다");
      },
    },
  });

  const updateTeam = useUpdateTeamApiV1TeamsTeamIdPut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsApiV1TeamsGetQueryKey() });
        setIsEditDialogOpen(false);
        setFormData(initialFormData);
        setSelectedTeamId(null);
        toast.success("팀이 수정되었습니다");
      },
      onError: () => {
        toast.error("팀 수정에 실패했습니다");
      },
    },
  });

  const deleteTeam = useDeleteTeamApiV1TeamsTeamIdDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsApiV1TeamsGetQueryKey() });
        setIsDeleteDialogOpen(false);
        setSelectedTeamId(null);
        toast.success("팀이 삭제되었습니다");
      },
      onError: () => {
        toast.error("팀 삭제에 실패했습니다");
      },
    },
  });

  // Handlers
  const handleOpenCreateDialog = useCallback(() => {
    setFormData(initialFormData);
    setIsCreateDialogOpen(true);
  }, []);

  const handleOpenEditDialog = useCallback((team: TeamResponse) => {
    setSelectedTeamId(team.id);
    setFormData({
      name: team.name,
      password: "",
      confluenceBaseUrl: "",
      confluenceSpaceKey: "",
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleOpenDeleteDialog = useCallback((team: TeamResponse) => {
    setSelectedTeamId(team.id);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleInputChange = useCallback(
    (field: keyof TeamFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  const handleCreateSubmit = useCallback(() => {
    if (!formData.name.trim()) {
      toast.error("팀 이름을 입력해주세요");
      return;
    }

    const teamCreate: TeamCreate = {
      name: formData.name.trim(),
      password: formData.password || null,
      confluence_base_url: formData.confluenceBaseUrl || null,
      confluence_space_key: formData.confluenceSpaceKey || null,
    };

    createTeam.mutate({ data: teamCreate });
  }, [formData, createTeam, toast]);

  const handleEditSubmit = useCallback(() => {
    if (!selectedTeamId) return;

    if (!formData.name.trim()) {
      toast.error("팀 이름을 입력해주세요");
      return;
    }

    const teamUpdate: TeamUpdate = {
      name: formData.name.trim(),
      password: formData.password || null,
      confluence_base_url: formData.confluenceBaseUrl || null,
      confluence_space_key: formData.confluenceSpaceKey || null,
    };

    updateTeam.mutate({ teamId: selectedTeamId, data: teamUpdate });
  }, [selectedTeamId, formData, updateTeam, toast]);

  const handleDeleteConfirm = useCallback(() => {
    if (!selectedTeamId) return;
    deleteTeam.mutate({ teamId: selectedTeamId });
  }, [selectedTeamId, deleteTeam]);

  // Update form when selected team data is loaded
  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setSelectedTeamId(null);
      setFormData(initialFormData);
    }
  }, []);

  // Sync selected team details to form when editing
  if (selectedTeam && isEditDialogOpen) {
    const hasChanges =
      formData.confluenceBaseUrl !== (selectedTeam.confluence_base_url ?? "") ||
      formData.confluenceSpaceKey !== (selectedTeam.confluence_space_key ?? "");

    if (hasChanges && formData.confluenceBaseUrl === "" && formData.confluenceSpaceKey === "") {
      setFormData((prev) => ({
        ...prev,
        confluenceBaseUrl: selectedTeam.confluence_base_url ?? "",
        confluenceSpaceKey: selectedTeam.confluence_space_key ?? "",
      }));
    }
  }

  const selectedTeamForDelete = teams?.find((t) => t.id === selectedTeamId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">팀 관리</h1>
          <p className="text-sm text-muted-foreground">팀을 생성하고 관리하세요</p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4" />새 팀 만들기
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />팀 목록
          </CardTitle>
          <CardDescription>등록된 팀 {teams?.length ?? 0}개</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTeams ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            </div>
          ) : teams && teams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>팀 이름</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="w-[100px]">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{formatDate(team.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEditDialog(team)}
                          aria-label={`${team.name} 수정`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenDeleteDialog(team)}
                          aria-label={`${team.name} 삭제`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">등록된 팀이 없습니다</p>
              <Button variant="link" onClick={handleOpenCreateDialog} className="mt-2">
                첫 번째 팀 만들기
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Team Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 팀 만들기</DialogTitle>
            <DialogDescription>새로운 팀을 생성합니다</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">팀 이름 *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={handleInputChange("name")}
                placeholder="팀 이름을 입력하세요"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-password">비밀번호 (선택)</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={handleInputChange("password")}
                placeholder="팀 접근 비밀번호"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-confluence-url">Confluence Base URL (선택)</Label>
              <Input
                id="create-confluence-url"
                value={formData.confluenceBaseUrl}
                onChange={handleInputChange("confluenceBaseUrl")}
                placeholder="https://your-domain.atlassian.net/wiki"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-confluence-space">Confluence Space Key (선택)</Label>
              <Input
                id="create-confluence-space"
                value={formData.confluenceSpaceKey}
                onChange={handleInputChange("confluenceSpaceKey")}
                placeholder="TEAM"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createTeam.isPending}>
              {createTeam.isPending ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀 수정</DialogTitle>
            <DialogDescription>팀 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">팀 이름 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={handleInputChange("name")}
                placeholder="팀 이름을 입력하세요"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">새 비밀번호 (변경 시에만 입력)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={handleInputChange("password")}
                placeholder="새 비밀번호"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-confluence-url">Confluence Base URL</Label>
              <Input
                id="edit-confluence-url"
                value={formData.confluenceBaseUrl}
                onChange={handleInputChange("confluenceBaseUrl")}
                placeholder="https://your-domain.atlassian.net/wiki"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-confluence-space">Confluence Space Key</Label>
              <Input
                id="edit-confluence-space"
                value={formData.confluenceSpaceKey}
                onChange={handleInputChange("confluenceSpaceKey")}
                placeholder="TEAM"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleEditDialogOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateTeam.isPending}>
              {updateTeam.isPending ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀 삭제</DialogTitle>
            <DialogDescription>
              정말로 <span className="font-semibold">{selectedTeamForDelete?.name}</span> 팀을
              삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteTeam.isPending}
            >
              {deleteTeam.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
