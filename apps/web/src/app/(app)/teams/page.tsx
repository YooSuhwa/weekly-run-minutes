"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { Lock, LockOpen, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { selectedTeamIdAtom } from "@/atoms/team";
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
import { useToast } from "@/components/ui/toast";
import { Weeky } from "@/components/weeky/weeky";
import type { TeamResponse } from "@/lib/api/__generated__/schemas";
import {
  getListTeamsApiV1TeamsGetQueryKey,
  useAuthenticateTeamApiV1TeamsTeamIdAuthPost,
  useCreateTeamApiV1TeamsPost,
  useListTeamsApiV1TeamsGet,
} from "@/lib/api/__generated__/teams/teams";

interface PasswordDialogState {
  open: boolean;
  team: TeamResponse | null;
  hasPassword: boolean;
}

export default function TeamsPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setSelectedTeamId = useSetAtom(selectedTeamIdAtom);

  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>({
    open: false,
    team: null,
    hasPassword: false,
  });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Create team dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPassword, setNewTeamPassword] = useState("");

  const { data: teams = [], isLoading, error } = useListTeamsApiV1TeamsGet();

  const createTeam = useCreateTeamApiV1TeamsPost({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListTeamsApiV1TeamsGetQueryKey() });
        setShowCreateDialog(false);
        setNewTeamName("");
        setNewTeamPassword("");
        setSelectedTeamId(data.id);
        toast.success(`${data.name} 팀이 생성되었습니다`);
        router.push("/dashboard");
      },
      onError: () => {
        toast.error("팀 생성에 실패했습니다");
      },
    },
  });

  const authenticateMutation = useAuthenticateTeamApiV1TeamsTeamIdAuthPost({
    mutation: {
      onSuccess: (data) => {
        setSelectedTeamId(data.team_id);
        toast.success(`${data.team_name} 팀이 선택되었습니다`);
        router.push("/dashboard");
      },
      onError: () => {
        setAuthError("비밀번호가 올바르지 않습니다");
      },
    },
  });

  const handleTeamClick = (team: TeamResponse) => {
    // Check if team has password
    if (team.has_password) {
      // Show password dialog
      setPasswordDialog({ open: true, team, hasPassword: true });
      setPassword("");
      setAuthError(null);
    } else {
      // No password, select directly
      handleDirectSelect(team);
    }
  };

  const handleDirectSelect = (team: TeamResponse) => {
    // Direct selection without password (for teams without passwords)
    setSelectedTeamId(team.id);
    toast.success(`${team.name} 팀이 선택되었습니다`);
    router.push("/dashboard");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordDialog.team || !password.trim()) return;

    setAuthError(null);
    authenticateMutation.mutate({
      teamId: passwordDialog.team.id,
      data: { password: password.trim() },
    });
  };

  const handleCloseDialog = () => {
    setPasswordDialog({ open: false, team: null, hasPassword: false });
    setPassword("");
    setAuthError(null);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Weeky expression="thinking" size="lg" message="팀 목록을 불러오고 있어요..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Weeky expression="sorry" size="lg" message="팀 목록을 불러오는데 실패했어요" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col items-center">
        <Weeky
          expression="greeting"
          variant="bubble"
          size="lg"
          message="안녕하세요! 어떤 팀으로 입장하시겠어요?"
          className="mb-6"
        />
        <h1 className="text-3xl font-bold">팀 선택</h1>
        <p className="mt-2 text-muted-foreground">회의를 진행할 팀을 선택해주세요</p>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">등록된 팀이 없습니다</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />첫 번째 팀 만들기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />새 팀 만들기
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                onClick={() => handleTeamClick(team)}
                data-testid={`team-card-${team.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    {team.has_password ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <LockOpen className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    생성일: {new Date(team.created_at).toLocaleDateString("ko-KR")}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Password Dialog */}
      <Dialog open={passwordDialog.open} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{passwordDialog.team?.name}</DialogTitle>
            <DialogDescription>팀에 접근하려면 비밀번호를 입력해주세요.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="password-input"
                aria-invalid={!!authError}
                autoFocus
              />
              {authError && (
                <p className="text-sm text-destructive" data-testid="auth-error">
                  {authError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={!password.trim() || authenticateMutation.isPending}
                data-testid="submit-password"
              >
                {authenticateMutation.isPending ? "확인 중..." : "확인"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 팀 만들기</DialogTitle>
            <DialogDescription>새로운 팀을 생성합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">팀 이름</Label>
              <Input
                id="team-name"
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="팀 이름 입력"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-password">비밀번호 (선택)</Label>
              <Input
                id="team-password"
                type="password"
                value={newTeamPassword}
                onChange={(e) => setNewTeamPassword(e.target.value)}
                placeholder="비밀번호 입력 (선택)"
              />
              <p className="text-xs text-muted-foreground">
                비밀번호를 설정하면 팀 접근 시 인증이 필요합니다
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (!newTeamName.trim()) return;
                createTeam.mutate({
                  data: {
                    name: newTeamName.trim(),
                    password: newTeamPassword || null,
                  },
                });
              }}
              disabled={!newTeamName.trim() || createTeam.isPending}
            >
              {createTeam.isPending ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
