"use client";

import { useSetAtom } from "jotai";
import { Lock, LockOpen, Users } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import type { TeamResponse } from "@/lib/api/__generated__/schemas";
import {
  useAuthenticateTeamApiV1TeamsTeamIdAuthPost,
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
  const setSelectedTeamId = useSetAtom(selectedTeamIdAtom);

  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>({
    open: false,
    team: null,
    hasPassword: false,
  });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const { data: teams = [], isLoading, error } = useListTeamsApiV1TeamsGet();

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
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">팀 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <p className="text-destructive">팀 목록을 불러오는데 실패했습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">팀 선택</h1>
        <p className="mt-2 text-muted-foreground">회의를 진행할 팀을 선택해주세요</p>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">등록된 팀이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
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
    </div>
  );
}
